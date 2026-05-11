const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ---------------- Config ----------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json({ limit: '2mb' }));

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

// Sanitize raw JSON-like string by removing literal newlines and control chars
function sanitizeJson(str) {
  // Replace literal newlines/tabs within the string with spaces
  // This handles Gemini inserting newlines inside JSON string values
  let result = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) {
      result += ch;
      escape = false;
    } else if (ch === '\\') {
      result += ch;
      escape = true;
    } else if (ch === '"') {
      result += ch;
      inString = !inString;
    } else if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      result += ' ';
    } else {
      result += ch;
    }
  }
  return result;
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
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // Strip markdown fences if present
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return sanitizeJson(stripped);
}

// ---------------- Prompt Builder ----------------
function buildPrompt(task, topic, essay) {
  const taskLabel = task === 'task1' ? 'IELTS Academic Writing Task 1' : 'IELTS Academic Writing Task 2';
  const taskKey = task === 'task1' ? 'taskAchievement' : 'taskResponse';
  return `You are an expert IELTS examiner. Evaluate the essay below and respond with ONLY a JSON object. No text before or after. No markdown. No code fences. Just pure JSON.

JSON format (replace numbers with actual scores 0-9, half bands allowed):
{"bandScores":{"${taskKey}":7,"coherenceCohesion":6.5,"lexicalResource":6,"grammaticalRange":7,"overall":6.5},"feedback":["point1","point2","point3","point4","point5"]}

${topic ? `Topic: ${topic}\n\n` : ''}Essay: ${essay}`;
}

// ---------------- /evaluate ----------------
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
      console.error('Failed to parse Gemini JSON:', rawJson.substring(0, 500));
      // Try to extract JSON object from response
      const match = rawJson.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(sanitizeJson(match[0]));
        } catch (e2) {
          console.error('Regex extract also failed:', e2.message);
        }
      }
      if (!parsed) {
        return res.status(500).json({ error: 'Gemini returned invalid JSON', raw: rawJson.substring(0, 300) });
      }
    }

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
const healthHandler = (_, res) => res.json({ ok: true, gemini: !!GEMINI_API_KEY, model: GEMINI_MODEL });
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ---------------- Server ----------------
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`BandCheck API running at http://localhost:${PORT}`));
}

module.exports = app;
