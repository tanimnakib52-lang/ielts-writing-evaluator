const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ---------------- Config ----------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash-8b';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---------------- Uploads (OCR) ----------------
const uploadsDir = path.join('/tmp', 'ielts-uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------------- Helpers ----------------
function toHalfBand(score) {
  if (score == null || isNaN(score)) return null;
  const clamped = Math.max(0, Math.min(9, Number(score)));
  return Math.round(clamped * 2) / 2;
}

function countWords(text) {
  return (text.match(/\b[\w']+\b/g) || []).length;
}

function countSentences(text) {
  return (text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || []).length || (text.trim() ? 1 : 0);
}

function countParagraphs(text) {
  return text.split(/\n\s*\n/).filter(p => p.trim().length).length || (text.trim() ? 1 : 0);
}

// ---------------- Gemini Call ----------------
async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured on server');

  const resp = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // Strip markdown code fences if present
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

// ---------------- Prompt Builder ----------------
function buildPrompt(task, topic, essay) {
  const taskLabel = task === 'task1' ? 'IELTS Academic Writing Task 1' : 'IELTS Academic Writing Task 2';
  const taskKey = task === 'task1' ? 'taskAchievement' : 'taskResponse';
  return `You are an expert IELTS examiner. Evaluate the following ${taskLabel} essay and return ONLY valid JSON — no extra text, no markdown fences.

JSON format:
{
  "bandScores": {
    "${taskKey}": <number 0-9 rounded to nearest 0.5>,
    "coherenceCohesion": <number 0-9 rounded to nearest 0.5>,
    "lexicalResource": <number 0-9 rounded to nearest 0.5>,
    "grammaticalRange": <number 0-9 rounded to nearest 0.5>,
    "overall": <number 0-9 rounded to nearest 0.5>
  },
  "feedback": [
    "<specific actionable feedback point 1>",
    "<specific actionable feedback point 2>",
    "<specific actionable feedback point 3>",
    "<specific actionable feedback point 4>",
    "<specific actionable feedback point 5>"
  ]
}

${topic ? `Topic: ${topic}\n\n` : ''}Essay:\n${essay}`;
}

// ---------------- /evaluate (Gemini-powered) ----------------
async function evaluateHandler(req, res) {
  try {
    const body = req.body || {};
    const taskRaw = String(body.task || body.taskType || 'task2').toLowerCase();
    const task = taskRaw === 'task1' ? 'task1' : 'task2';
    const essay = String(body.essay || '').replace(/\r/g, '\n').trim();
    const topic = String(body.topic || '').trim();

    if (!essay || essay.length < 20) {
      return res.status(400).json({ error: 'Essay text is required (min 20 chars).' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set on the server.' });
    }

    const prompt = buildPrompt(task, topic, essay);
    const rawJson = await callGemini(prompt);

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      console.error('Failed to parse Gemini JSON:', rawJson);
      return res.status(500).json({ error: 'Gemini returned invalid JSON', raw: rawJson });
    }

    // Sanitise band scores to nearest 0.5
    const bandScores = {};
    for (const [k, v] of Object.entries(parsed.bandScores || {})) {
      bandScores[k] = toHalfBand(v);
    }

    const feedback = Array.isArray(parsed.feedback)
      ? parsed.feedback.filter(f => typeof f === 'string' && f.trim().length > 4)
      : [];

    const counts = {
      words: countWords(essay),
      sentences: countSentences(essay),
      paragraphs: countParagraphs(essay),
    };

    return res.json({ task, bandScores, feedback, counts });
  } catch (err) {
    console.error('evaluate error:', err);
    return res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
}

app.post('/evaluate', evaluateHandler);
app.post('/api/evaluate', evaluateHandler);

// ---------------- Health ----------------
const healthHandler = (_, res) => res.json({ ok: true, gemini: !!GEMINI_API_KEY });
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ---------------- OCR (kept) ----------------
async function ocrHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const imagePath = req.file.path;
    const result = await Tesseract.recognize(imagePath, 'eng');
    fs.unlink(imagePath, () => {});
    return res.json({ success: true, text: result.data.text });
  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ success: false, error: 'Failed to run OCR on image', message: err.message });
  }
}

app.post('/ocr-evaluate', upload.single('essayImage'), ocrHandler);
app.post('/api/ocr-evaluate', upload.single('essayImage'), ocrHandler);

// ---------------- Server ----------------
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`BandCheck API running at http://localhost:${PORT}`));
}
module.exports = app;
