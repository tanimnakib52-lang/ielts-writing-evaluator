/**
 * BandCheck IELTS Writing Evaluator API
 *
 * Scoring is done by zero-shot classification against
 *   FacebookAI/roberta-large-mnli
 * via the Hugging Face Inference API (zero-shot-classification pipeline).
 *
 * No KevSun/* models are used anywhere in this file.
 *
 * Endpoints:
 *   POST /evaluate         body: { task: "task1"|"task2", topic?: string, essay: string }
 *   POST /api/evaluate     (same)
 *   GET  /health           { ok, hf, model }
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
const MODEL = 'FacebookAI/roberta-large-mnli';

// roberta-large-mnli is served as a text-classification model by default.
// To use it for zero-shot we must hit the dedicated pipeline endpoint.
const HF_URLS = (model) => [
  `https://router.huggingface.co/hf-inference/models/${model}/pipeline/zero-shot-classification`,
  `https://router.huggingface.co/hf-inference/pipeline/zero-shot-classification/${model}`,
  `https://api-inference.huggingface.co/pipeline/zero-shot-classification/${model}`,
  `https://api-inference.huggingface.co/models/${model}`,
];

// ---------------- Helpers ----------------
const countWords = (t) => (t.match(/\b[\w']+\b/g) || []).length;
const countSentences = (t) =>
  (t.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || []).length || (t.trim() ? 1 : 0);
const countParagraphs = (t) =>
  t.split(/\n\s*\n/).filter((p) => p.trim().length).length || (t.trim() ? 1 : 0);

const toHalfBand = (s) => {
  if (s == null || isNaN(s)) return null;
  return Math.round(Math.max(0, Math.min(9, Number(s))) * 2) / 2;
};

// ---------------- HF zero-shot call ----------------
/**
 * Call HF zero-shot-classification.
 *
 * @param {string} text       - essay text (truncated to ~3500 chars to stay under model max)
 * @param {string[]} labels   - candidate labels
 * @param {boolean} multi     - multi_label mode (independent probabilities per label)
 * @returns {{labels:string[], scores:number[]}}
 */
async function zeroShot(text, labels, { multi = false, timeoutMs = 35000 } = {}) {
  if (!HF_TOKEN) throw new Error('HF_TOKEN is not set on the server');

  const safeText = String(text || '').slice(0, 3500);
  const body = JSON.stringify({
    inputs: safeText,
    parameters: { candidate_labels: labels, multi_label: multi },
    options: { wait_for_model: true, use_cache: true },
  });

  const headers = {
    Authorization: `Bearer ${HF_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const errors = [];
  for (const url of HF_URLS(MODEL)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const resp = await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
        clearTimeout(t);
        const raw = await resp.text();
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        if (resp.status === 503 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        if (!resp.ok) {
          const snippet =
            typeof data === 'string' ? data.slice(0, 180) : JSON.stringify(data).slice(0, 180);
          errors.push(`${resp.status} @ ${url.split('/').slice(-3).join('/')}: ${snippet}`);
          break;
        }
        // Accept two shapes:
        //   (a) classic: { sequence, labels:[...], scores:[...] }
        //   (b) router pipeline: [{ label, score }, ...]
        if (data && Array.isArray(data.labels) && Array.isArray(data.scores)) {
          return { labels: data.labels, scores: data.scores };
        }
        if (Array.isArray(data) && data.length && data[0] && 'label' in data[0] && 'score' in data[0]) {
          return {
            labels: data.map((x) => String(x.label)),
            scores: data.map((x) => Number(x.score)),
          };
        }
        errors.push(`unexpected response shape: ${JSON.stringify(data).slice(0, 180)}`);
        break;
      } catch (e) {
        clearTimeout(t);
        errors.push(`EXC @ ${url.split('/').slice(-3).join('/')}: ${e.message}`);
      }
    }
  }
  throw new Error(`zero-shot call failed. tried: ${errors.join(' | ')}`);
}

// ---------------- Scoring logic ----------------

/**
 * Convert a {labels, scores} result into an expected-value band score.
 * Each label is mapped to a numeric band; we compute sum(score_i * band_i).
 *
 * @param {{labels:string[], scores:number[]}} result
 * @param {Record<string, number>} labelToBand
 * @returns {number} expected band, half-rounded
 */
function expectedBand(result, labelToBand) {
  if (!result || !Array.isArray(result.labels) || !result.labels.length) return null;
  let totalWeight = 0;
  let totalProb = 0;
  for (let i = 0; i < result.labels.length; i++) {
    const lbl = result.labels[i];
    const p = Number(result.scores[i]) || 0;
    const band = labelToBand[lbl];
    if (band == null) continue;
    totalWeight += p * band;
    totalProb += p;
  }
  if (totalProb === 0) return null;
  return toHalfBand(totalWeight / totalProb);
}

/**
 * Convert a strong-vs-weak binary zero-shot result into a band score.
 * If P(strong) -> band ~7.5 and P(weak) -> band ~5.0, linearly interpolate.
 *
 * @param {{labels:string[], scores:number[]}} result
 * @param {string} strongLabel
 * @returns {number}
 */
function strengthToBand(result, strongLabel) {
  if (!result) return null;
  const idx = result.labels.findIndex((l) => l === strongLabel);
  if (idx === -1) return null;
  const pStrong = Math.max(0, Math.min(1, Number(result.scores[idx]) || 0));
  // Map strong-probability in [0..1] to band in [4.5..8.0]
  const band = 4.5 + pStrong * 3.5;
  return toHalfBand(band);
}

// Overall band candidate labels and their numeric values
const OVERALL_LABELS = [
  'overall band 5',
  'overall band 6',
  'overall band 7',
  'overall band 8',
];
const OVERALL_TO_BAND = {
  'overall band 5': 5,
  'overall band 6': 6,
  'overall band 7': 7,
  'overall band 8': 8,
};

// Build a feedback list from the criterion scores
function buildFeedback(task, scores, counts) {
  const minWords = task === 'task1' ? 150 : 250;
  const items = [];
  const strengths = [];
  const improvements = [];

  const pairs = [
    ['Task response', scores.taskResponse],
    ['Coherence and cohesion', scores.coherenceCohesion],
    ['Vocabulary', scores.lexicalResource],
    ['Grammar', scores.grammaticalRange],
  ];

  pairs.forEach(([name, v]) => {
    if (v == null) return;
    if (v >= 7) strengths.push(`${name} is strong (band ${v.toFixed(1)}).`);
    else if (v >= 6) strengths.push(`${name} is solid (band ${v.toFixed(1)}).`);
    else improvements.push(`${name} needs work — currently around band ${v.toFixed(1)}.`);
  });

  if (counts.words < minWords) {
    improvements.push(`Your response is ${counts.words} words; the target is at least ${minWords}.`);
  } else {
    strengths.push(`Word count is healthy (${counts.words} words).`);
  }

  if (counts.paragraphs < 3) {
    improvements.push('Use clearer paragraphing — introduction, body, conclusion.');
  } else {
    strengths.push(`Clear paragraph structure (${counts.paragraphs} paragraphs).`);
  }

  // Generic top-level summary line
  if (scores.overall != null) {
    items.push(
      `Estimated overall band: ${scores.overall.toFixed(1)}. ` +
        (scores.overall >= 7
          ? 'Good performance overall — focus on refining nuance and accuracy.'
          : scores.overall >= 6
          ? 'Competent overall — targeted practice on weak criteria can lift your band.'
          : 'There are several areas to improve before test day; see suggestions below.')
    );
  }

  return {
    feedback: [...items, ...strengths.map((s) => `Strength: ${s}`), ...improvements.map((s) => `Improve: ${s}`)],
    strengths,
    improvements,
  };
}

// Map model dimensions to the keys the existing frontend expects
function toFrontendShape(task, est) {
  if (task === 'task1') {
    return {
      taskAchievement: est.task_response,
      coherenceCohesion: est.coherence_cohesion,
      lexicalResource: est.lexical_resource,
      grammaticalRange: est.grammatical_range_accuracy,
      overall: est.overall_band,
    };
  }
  return {
    taskResponse: est.task_response,
    coherenceCohesion: est.coherence_cohesion,
    lexicalResource: est.lexical_resource,
    grammaticalRange: est.grammatical_range_accuracy,
    overall: est.overall_band,
  };
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

    // For the task-response classifier, include the topic if provided.
    const taskResponseInput = topic ? `Topic: ${topic}\n\nEssay:\n${essay}` : essay;

    // Run all 5 zero-shot calls in parallel
    const calls = [
      zeroShot(essay, OVERALL_LABELS, { multi: false }),
      zeroShot(essay, ['grammar weak', 'grammar strong'], { multi: false }),
      zeroShot(essay, ['coherence weak', 'coherence strong'], { multi: false }),
      zeroShot(essay, ['vocabulary weak', 'vocabulary strong'], { multi: false }),
      zeroShot(taskResponseInput, ['task response weak', 'task response strong'], { multi: false }),
    ];
    const settled = await Promise.allSettled(calls);
    const [overallR, grammarR, coherenceR, vocabR, taskR] = settled;

    // Log which model is in use (helps you confirm in Vercel logs)
    console.log(`[evaluate] task=${task} model=${MODEL} essay_words=${countWords(essay)}`);

    const anyOk = settled.some((r) => r.status === 'fulfilled');
    if (!anyOk) {
      console.error(
        '[evaluate] all zero-shot calls failed:',
        settled.map((r) => r.reason?.message).join(' | ')
      );
      return res.status(200).json(buildFallback(task, essay, 'Scoring service is temporarily unavailable.'));
    }

    const overall =
      overallR.status === 'fulfilled' ? expectedBand(overallR.value, OVERALL_TO_BAND) : null;
    const taskResponse =
      taskR.status === 'fulfilled' ? strengthToBand(taskR.value, 'task response strong') : null;
    const coherence =
      coherenceR.status === 'fulfilled' ? strengthToBand(coherenceR.value, 'coherence strong') : null;
    const vocabulary =
      vocabR.status === 'fulfilled' ? strengthToBand(vocabR.value, 'vocabulary strong') : null;
    const grammar =
      grammarR.status === 'fulfilled' ? strengthToBand(grammarR.value, 'grammar strong') : null;

    // Compute final overall: prefer model's overall band; otherwise average the 4 criteria
    let finalOverall = overall;
    if (finalOverall == null) {
      const arr = [taskResponse, coherence, vocabulary, grammar].filter((v) => v != null);
      if (arr.length) finalOverall = toHalfBand(arr.reduce((a, b) => a + b, 0) / arr.length);
    }

    const est = {
      overall_band: finalOverall,
      task_response: taskResponse,
      coherence_cohesion: coherence,
      lexical_resource: vocabulary,
      grammatical_range_accuracy: grammar,
    };

    const counts = {
      words: countWords(essay),
      sentences: countSentences(essay),
      paragraphs: countParagraphs(essay),
    };

    const bandScores = toFrontendShape(task, est);
    const { feedback, strengths, improvements } = buildFeedback(task, bandScores, counts);

    // Surface partial-failure as a non-fatal warning
    const warnings = {};
    const labelMap = ['overall', 'grammar', 'coherence', 'vocabulary', 'task_response'];
    settled.forEach((r, i) => {
      if (r.status === 'rejected') warnings[labelMap[i]] = 'classifier unavailable';
    });

    return res.json({
      task,
      bandScores,        // frontend-shape (preserves React app compatibility)
      estimate: est,     // requested IELTS-style snake_case shape
      feedback,
      strengths,
      improvements,
      counts,
      model: MODEL,
      ...(Object.keys(warnings).length ? { warnings } : {}),
    });
  } catch (err) {
    // Never leak raw HF errors to the frontend
    console.error('[evaluate] fatal:', err?.message);
    return res
      .status(200)
      .json(buildFallback(req.body?.task || 'task2', String(req.body?.essay || ''), 'Could not reach the scoring service. Please try again in a moment.'));
  }
}

// Readable fallback when scoring is unavailable
function buildFallback(taskRaw, essayRaw, reason) {
  const task = String(taskRaw).toLowerCase() === 'task1' ? 'task1' : 'task2';
  const essay = String(essayRaw || '');
  const counts = {
    words: countWords(essay),
    sentences: countSentences(essay),
    paragraphs: countParagraphs(essay),
  };
  const minWords = task === 'task1' ? 150 : 250;
  const improvements = [];
  if (counts.words < minWords) improvements.push(`Aim for at least ${minWords} words (you wrote ${counts.words}).`);
  if (counts.paragraphs < 3) improvements.push('Use clear paragraphs — introduction, body, conclusion.');
  if (improvements.length === 0) improvements.push('Vary sentence structure and add cohesive linkers.');

  const bandScores =
    task === 'task1'
      ? { taskAchievement: null, coherenceCohesion: null, lexicalResource: null, grammaticalRange: null, overall: null }
      : { taskResponse: null, coherenceCohesion: null, lexicalResource: null, grammaticalRange: null, overall: null };

  return {
    task,
    bandScores,
    estimate: {
      overall_band: null,
      task_response: null,
      coherence_cohesion: null,
      lexical_resource: null,
      grammatical_range_accuracy: null,
    },
    feedback: [reason || 'Scoring service is temporarily unavailable.', ...improvements.map((s) => `Improve: ${s}`)],
    strengths: [],
    improvements,
    counts,
    model: MODEL,
    warnings: { scoring: reason || 'unavailable' },
  };
}

// ---------------- Routes ----------------
app.post('/evaluate', evaluateHandler);
app.post('/api/evaluate', evaluateHandler);

const healthHandler = (_, res) =>
  res.json({ ok: true, hf: !!HF_TOKEN, model: MODEL });
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Diagnostic: one zero-shot call, surfaces the raw HF status/snippet.
// Returns 200 with { ok:false, error } on failure so we can read it via curl.
async function diagHandler(_req, res) {
  try {
    const out = await zeroShot('This is a short test essay about parks.', OVERALL_LABELS);
    return res.json({ ok: true, model: MODEL, sample: out });
  } catch (e) {
    return res.json({ ok: false, model: MODEL, error: String(e.message || e) });
  }
}
app.get('/diag', diagHandler);
app.get('/api/diag', diagHandler);

// ---------------- Server ----------------
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`BandCheck API on port ${PORT} — model: ${MODEL}`));
}

module.exports = app;
