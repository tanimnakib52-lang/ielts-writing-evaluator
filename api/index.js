const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ---------------- Config ----------------
const HF_TOKEN = process.env.HF_TOKEN;
const HF_API_BASE = 'https://api-inference.huggingface.co/models';

const MODELS = {
  task2_score: 'KevSun/IELTS_essay_scoring',
  task1_score: 'KevSun/Engessay_grading_ML',
  feedback:    'KevSun/IELTS_essay_comments',
};

// IELTS criterion order returned by KevSun scoring models
// (Task Response/Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy, Overall)
const SCORE_KEYS = [
  'taskResponse',
  'coherenceCohesion',
  'lexicalResource',
  'grammaticalRange',
  'overall',
];

// ---------------- Uploads (OCR) ----------------
const uploadsDir = path.join('/tmp', 'ielts-uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------------- Helpers ----------------
function toQuarterBand(score) {
  if (score == null || isNaN(score)) return null;
  const clamped = Math.max(0, Math.min(9, Number(score)));
  return Math.round(clamped * 2) / 2; // round to nearest 0.5 (IELTS bands)
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

// Call HF Inference API with retries on cold-start (503)
async function hfCall(modelId, inputs, { maxRetries = 2 } = {}) {
  if (!HF_TOKEN) throw new Error('HF_TOKEN not configured on server');
  const url = `${HF_API_BASE}/${modelId}`;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs, options: { wait_for_model: true } }),
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!resp.ok) {
        // 503 = model loading, retry
        if (resp.status === 503 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error(`HF ${modelId} ${resp.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt >= maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

// Parse KevSun scoring output -> { taskResponse, coherenceCohesion, lexicalResource, grammaticalRange, overall }
function parseScores(raw) {
  // Possible shapes:
  //   [[{label:"LABEL_0", score:0.x}, ...]]   (multi-label classification)
  //   [{label, score}, ...]
  //   { scores: [..] }
  let arr = raw;
  if (arr && Array.isArray(arr) && Array.isArray(arr[0])) arr = arr[0];

  const bands = {};
  if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object' && 'score' in arr[0]) {
    // KevSun models output 5 scores in fixed order, scaled 0..1 -> map to 0..9
    arr.forEach((item, i) => {
      const key = SCORE_KEYS[i];
      if (!key) return;
      let v = Number(item.score);
      // KevSun score is typically already 0..1; scale to 0..9
      if (v <= 1) v = v * 9;
      bands[key] = toQuarterBand(v);
    });
  }

  // If overall missing, average the 4 criteria
  if (bands.overall == null) {
    const vals = ['taskResponse', 'coherenceCohesion', 'lexicalResource', 'grammaticalRange']
      .map(k => bands[k]).filter(v => v != null);
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      bands.overall = toQuarterBand(avg);
    }
  }
  return bands;
}

// Parse KevSun/IELTS_essay_comments output -> array of feedback strings
function parseFeedback(raw) {
  if (!raw) return [];
  // Common HF text-generation shape: [{ generated_text: "..." }]
  if (Array.isArray(raw) && raw[0] && typeof raw[0].generated_text === 'string') {
    return splitFeedback(raw[0].generated_text);
  }
  if (typeof raw === 'string') return splitFeedback(raw);
  if (raw.generated_text) return splitFeedback(raw.generated_text);
  // Classification-like fallback
  if (Array.isArray(raw)) {
    return raw
      .map(x => (x && (x.label || x.generated_text)) || null)
      .filter(Boolean);
  }
  return [];
}

function splitFeedback(text) {
  return text
    .replace(/\r/g, '')
    .split(/\n+|(?:\d+\.\s)|(?:•\s)|(?:-\s)/)
    .map(s => s.trim())
    .filter(s => s.length > 4)
    .slice(0, 12);
}

// ---------------- /evaluate (HF-powered) ----------------
async function evaluateHandler(req, res) {
  try {
    const body = req.body || {};
    // Backwards-compat: accept "task" OR legacy "taskType"
    const taskRaw = String(body.task || body.taskType || 'task2').toLowerCase();
    const task = taskRaw === 'task1' ? 'task1' : 'task2';
    const essay = String(body.essay || '').replace(/\r/g, '\n').trim();
    const topic = String(body.topic || '').trim();

    if (!essay || essay.length < 20) {
      return res.status(400).json({ error: 'Essay text is required (min 20 chars).' });
    }
    if (!HF_TOKEN) {
      return res.status(500).json({ error: 'HF_TOKEN environment variable is not set on the server.' });
    }

    const scoreModel = task === 'task1' ? MODELS.task1_score : MODELS.task2_score;
    const feedbackModel = MODELS.feedback;

    // Build inputs
    const scoreInput = essay;
    const feedbackInput = topic
      ? `Topic: ${topic}\n\nEssay:\n${essay}`
      : essay;

    // Run scoring + feedback in parallel
    const [scoreRaw, feedbackRaw] = await Promise.all([
      hfCall(scoreModel, scoreInput).catch(e => ({ __error: e.message })),
      hfCall(feedbackModel, feedbackInput).catch(e => ({ __error: e.message })),
    ]);

    const errors = {};
    if (scoreRaw && scoreRaw.__error) errors.scoring = scoreRaw.__error;
    if (feedbackRaw && feedbackRaw.__error) errors.feedback = feedbackRaw.__error;

    const bands = scoreRaw && !scoreRaw.__error ? parseScores(scoreRaw) : {};
    const feedback = feedbackRaw && !feedbackRaw.__error ? parseFeedback(feedbackRaw) : [];

    // Rename TR -> taskAchievement when task1, for clarity in response
    const bandScores = { ...bands };
    if (task === 'task1' && bandScores.taskResponse != null) {
      bandScores.taskAchievement = bandScores.taskResponse;
      delete bandScores.taskResponse;
    }

    const counts = {
      words: countWords(essay),
      sentences: countSentences(essay),
      paragraphs: countParagraphs(essay),
    };

    return res.json({
      task,
      bandScores,
      feedback,
      counts,
      ...(Object.keys(errors).length ? { warnings: errors } : {}),
    });
  } catch (err) {
    console.error('evaluate error:', err);
    return res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
}
app.post('/evaluate', evaluateHandler);
app.post('/api/evaluate', evaluateHandler);

// ---------------- Health ----------------
const healthHandler = (_, res) => res.json({ ok: true, hf: !!HF_TOKEN });
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
  app.listen(PORT, () => console.log(`IELTS Evaluator API running at http://localhost:${PORT}`));
}

module.exports = app;
