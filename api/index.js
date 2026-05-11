/**
 * BandCheck IELTS Writing Evaluator API
 * Scoring: KevSun/IELTS_essay_scoring  (5 dimensions: TA, CC, V, G, Overall)
 * Feedback (optional): KevSun/IELTS_essay_comments
 *
 * Endpoints:
 *   POST /evaluate         body: { task: "task1"|"task2", topic?: string, essay: string }
 *   POST /api/evaluate     (same)
 *   GET  /health           { ok, hf }
 *   GET  /api/health
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---------------- Config ----------------
const HF_TOKEN = process.env.HF_TOKEN;

const SCORING_MODEL = 'KevSun/IELTS_essay_scoring';
const FEEDBACK_MODEL = 'KevSun/IELTS_essay_comments';

// Try the new router URL first, then the legacy endpoint
const HF_URLS = (model) => [
  `https://router.huggingface.co/hf-inference/models/${model}`,
  `https://api-inference.huggingface.co/models/${model}`,
];

// Fixed dimension order returned by KevSun/IELTS_essay_scoring
// (see model card https://huggingface.co/KevSun/IELTS_essay_scoring)
const SCORE_DIMENSIONS = [
  'Task Achievement',
  'Coherence and Cohesion',
  'Vocabulary',
  'Grammar',
  'Overall',
];

// Map model dimensions to the keys the existing frontend expects
const KEY_MAP_TASK2 = {
  'Task Achievement': 'taskResponse',          // Task 2 uses "Task Response"
  'Coherence and Cohesion': 'coherenceCohesion',
  'Vocabulary': 'lexicalResource',
  'Grammar': 'grammaticalRange',
  'Overall': 'overall',
};
const KEY_MAP_TASK1 = {
  'Task Achievement': 'taskAchievement',
  'Coherence and Cohesion': 'coherenceCohesion',
  'Vocabulary': 'lexicalResource',
  'Grammar': 'grammaticalRange',
  'Overall': 'overall',
};

// ---------------- Helpers ----------------
function toHalfBand(s) {
  if (s == null || isNaN(s)) return null;
  return Math.round(Math.max(0, Math.min(9, Number(s))) * 2) / 2;
}
const countWords = (t) => (t.match(/\b[\w']+\b/g) || []).length;
const countSentences = (t) =>
  (t.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || []).length || (t.trim() ? 1 : 0);
const countParagraphs = (t) =>
  t.split(/\n\s*\n/).filter((p) => p.trim().length).length || (t.trim() ? 1 : 0);

// ---------------- HF call ----------------
async function hfCall(model, inputs, { timeoutMs = 45000 } = {}) {
  if (!HF_TOKEN) throw new Error('HF_TOKEN is not set on the server');

  const body = JSON.stringify({
    inputs,
    options: { wait_for_model: true, use_cache: true },
  });

  const headers = {
    Authorization: `Bearer ${HF_TOKEN}`,
    'Content-Type': 'application/json',
  };

  let lastErr;
  for (const url of HF_URLS(model)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const resp = await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
        clearTimeout(t);
        const text = await resp.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        if (resp.status === 503 && attempt === 0) {
          // Model still loading even with wait_for_model, retry once
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        if (!resp.ok) {
          lastErr = new Error(
            `HF ${resp.status} for ${model} @ ${url}: ${
              typeof data === 'string' ? data.slice(0, 250) : JSON.stringify(data).slice(0, 250)
            }`
          );
          break; // try next URL
        }
        return data;
      } catch (e) {
        clearTimeout(t);
        lastErr = e;
      }
    }
  }
  throw lastErr || new Error(`HF call failed for ${model}`);
}

// ---------------- Parsing ----------------
/**
 * Parse the scoring response from KevSun/IELTS_essay_scoring.
 *
 * Likely response shapes:
 *   1) [[{label:"LABEL_0", score:0.x}, {label:"LABEL_1", score:0.x}, ...]]
 *   2) [{label, score}, ...]
 *   3) An object with "logits" or "scores" array
 *
 * Per the model card, raw scores are normalized by:
 *     normalized = (raw / max(raw)) * 9
 * then rounded to nearest 0.5.
 */
function parseScores(raw) {
  let arr = raw;
  if (arr && typeof arr === 'object' && Array.isArray(arr.logits)) arr = arr.logits;
  if (Array.isArray(arr) && Array.isArray(arr[0])) arr = arr[0];

  let values = [];
  if (Array.isArray(arr)) {
    if (arr.length && typeof arr[0] === 'object' && arr[0] && 'score' in arr[0]) {
      // Sort by LABEL_N index when labels look like "LABEL_0", "LABEL_1", ...
      const looksLabeled =
        arr.every((x) => typeof x.label === 'string' && /^LABEL_\d+$/.test(x.label)) ||
        arr.every((x) => typeof x.label === 'string' && /^\d+$/.test(x.label));
      const ordered = looksLabeled
        ? [...arr].sort((a, b) => {
            const ia = parseInt(String(a.label).replace(/\D/g, ''), 10);
            const ib = parseInt(String(b.label).replace(/\D/g, ''), 10);
            return ia - ib;
          })
        : arr;
      values = ordered.map((x) => Number(x.score));
    } else if (arr.every((x) => typeof x === 'number')) {
      values = arr.map(Number);
    }
  }

  if (!values.length) return null;

  // Apply the model card's normalization: (v / max) * 9
  const max = Math.max(...values);
  let normalized;
  if (max > 0 && max <= 1.0001) {
    // Already in 0..1 range (typical classifier softmax-like). Normalize as per card.
    normalized = values.map((v) => (v / max) * 9);
  } else if (max > 1 && max <= 9.01) {
    // Already in band-scale roughly
    normalized = values.map((v) => v);
  } else {
    // Generic logits — fall back to (v / max) * 9
    normalized = values.map((v) => (v / max) * 9);
  }

  return normalized.slice(0, SCORE_DIMENSIONS.length).map(toHalfBand);
}

/**
 * Parse the feedback response from KevSun/IELTS_essay_comments.
 * Common shapes:
 *   [{ generated_text: "..." }]
 *   { generated_text: "..." }
 *   "...." (raw string)
 */
function parseFeedback(raw) {
  if (!raw) return [];
  let text = '';
  if (typeof raw === 'string') text = raw;
  else if (Array.isArray(raw) && raw[0]?.generated_text) text = raw[0].generated_text;
  else if (raw?.generated_text) text = raw.generated_text;
  else if (Array.isArray(raw) && typeof raw[0] === 'string') text = raw[0];
  if (!text) return [];

  return text
    .replace(/\r/g, '')
    .split(/\n+|(?:\d+\.\s)|(?:•\s)|(?:- )/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
    .slice(0, 8);
}

// ---------------- Handler ----------------
async function evaluateHandler(req, res) {
  try {
    const body = req.body || {};
    const taskRaw = String(body.task || body.taskType || 'task2').toLowerCase();
    const task = taskRaw === 'task1' ? 'task1' : 'task2';
    const essay = String(body.essay || '').replace(/\r/g, '\n').trim();
    const topic = String(body.topic || '').trim();

    if (!essay || essay.length < 20) {
      return res.status(400).json({ error: 'Essay text required (min 20 characters).' });
    }
    if (!HF_TOKEN) {
      return res
        .status(500)
        .json({ error: 'Server is missing the HF_TOKEN environment variable.' });
    }

    const feedbackInput = topic ? `Topic: ${topic}\n\nEssay:\n${essay}` : essay;

    // Parallel: scoring (required) + feedback (optional)
    const [scoreRes, feedbackRes] = await Promise.allSettled([
      hfCall(SCORING_MODEL, essay),
      hfCall(FEEDBACK_MODEL, feedbackInput),
    ]);

    if (scoreRes.status !== 'fulfilled') {
      console.error('Scoring failed:', scoreRes.reason?.message);
      return res.status(502).json({
        error: 'Scoring model failed',
        message: scoreRes.reason?.message || 'Unknown error from Hugging Face',
      });
    }

    const numericScores = parseScores(scoreRes.value);
    if (!numericScores || numericScores.length < 5) {
      console.error('Could not parse scores. Raw:', JSON.stringify(scoreRes.value).slice(0, 500));
      return res.status(502).json({
        error: 'Could not parse scoring model output',
        raw: JSON.stringify(scoreRes.value).slice(0, 500),
      });
    }

    const keyMap = task === 'task1' ? KEY_MAP_TASK1 : KEY_MAP_TASK2;
    const bandScores = {};
    SCORE_DIMENSIONS.forEach((dim, i) => {
      bandScores[keyMap[dim]] = numericScores[i];
    });

    let feedback = [];
    let warnings;
    if (feedbackRes.status === 'fulfilled') {
      feedback = parseFeedback(feedbackRes.value);
    } else {
      warnings = { feedback: feedbackRes.reason?.message || 'feedback model unavailable' };
      console.warn('Feedback failed:', feedbackRes.reason?.message);
    }

    // Helpful fallback if feedback model returns nothing usable
    if (feedback.length === 0) {
      feedback = buildFallbackFeedback(task, bandScores, essay);
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
      model: { scoring: SCORING_MODEL, feedback: FEEDBACK_MODEL },
      ...(warnings ? { warnings } : {}),
    });
  } catch (err) {
    console.error('evaluate error:', err);
    return res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
}

function buildFallbackFeedback(task, bands, essay) {
  const tips = [];
  const minWords = task === 'task1' ? 150 : 250;
  const wc = countWords(essay);
  if (wc < minWords) tips.push(`Your response is ${wc} words; aim for at least ${minWords}.`);

  const pairs = [
    ['Task Achievement / Response', bands.taskResponse ?? bands.taskAchievement],
    ['Coherence & Cohesion', bands.coherenceCohesion],
    ['Vocabulary', bands.lexicalResource],
    ['Grammar', bands.grammaticalRange],
  ];
  pairs
    .filter(([, v]) => v != null && v < 6.5)
    .forEach(([name, v]) => tips.push(`${name} is at ${v.toFixed(1)} — focus on this area to lift your band.`));

  if (countParagraphs(essay) < 3) tips.push('Use clearer paragraphing — introduction, body, and conclusion.');
  if (tips.length === 0)
    tips.push('Strong overall performance — keep practising with a range of topics to maintain consistency.');
  return tips;
}

// ---------------- Routes ----------------
app.post('/evaluate', evaluateHandler);
app.post('/api/evaluate', evaluateHandler);

const healthHandler = (_, res) =>
  res.json({ ok: true, hf: !!HF_TOKEN, scoring: SCORING_MODEL, feedback: FEEDBACK_MODEL });
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ---------------- Server ----------------
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`BandCheck API on port ${PORT}`));
}

module.exports = app;
