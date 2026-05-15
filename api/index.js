/**
 * BandCheck IELTS Writing Evaluator API
 * Scoring powered by Groq (llama-3.3-70b-versatile)
 * FIXED: Robust JSON parsing for LLM responses
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// FIX 1: Robust JSON extractor — handles nested {}, markdown code blocks, and partial LLM output
function extractJSON(content) {
  // Step 1: Try direct parse first (cleanest case)
  try {
    return JSON.parse(content);
  } catch (_) {}

  // Step 2: Strip markdown code fences ```json ... ``` or ``` ... ```
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) {}
  }

  // Step 3: Extract the LAST (most complete) JSON object using bracket counting
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i;
        // Don't break — keep scanning to find the LAST complete object
      }
    }
  }

  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch (_) {}
  }

  throw new Error('No valid JSON found in Groq response');
}

// FIX 2: Sanitize feedback object — ensure all values are strings
function sanitizeFeedback(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') return { overall: raw };
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};

  const clean = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val == null) continue;
    if (typeof val === 'string') {
      if (val.trim()) clean[key] = val.trim();
    } else if (typeof val === 'object') {
      // Sometimes LLM wraps feedback in nested objects
      const str = JSON.stringify(val);
      clean[key] = str;
    } else {
      clean[key] = String(val);
    }
  }
  return clean;
}

async function evaluateWithGroq(task, topic, essay) {
  const taskKey = task === 'task1' ? 'taskAchievement' : 'taskResponse';

  const prompt = `You are an expert IELTS examiner. Evaluate the following IELTS Writing ${task === 'task1' ? 'Task 1' : 'Task 2'} essay and return a JSON object ONLY. No explanation, no markdown, no text outside the JSON.

Topic: ${topic || 'General'}

Essay:
${essay}

Return this exact JSON structure:
{
  "overall": 6.5,
  "${taskKey}": 6.5,
  "coherenceCohesion": 6.5,
  "lexicalResource": 6.5,
  "grammaticalRange": 6.5,
  "feedback": {
    "${taskKey}": "2-3 sentences of feedback here.",
    "coherenceCohesion": "2-3 sentences of feedback here.",
    "lexicalResource": "2-3 sentences of feedback here.",
    "grammaticalRange": "2-3 sentences of feedback here.",
    "overall": "3-4 sentences of overall feedback with improvement tips."
  }
}`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  // FIX 1 applied here
  return extractJSON(content);
}

function roundHalf(num) {
  if (typeof num !== 'number' || Number.isNaN(num)) return null;
  return Math.round(num * 2) / 2;
}

async function handleEvaluate(req, res) {
  try {
    const { task, topic, essay } = req.body;

    if (!essay || essay.trim().length < 50) {
      return res.status(400).json({ error: 'Essay too short. Minimum 50 characters.' });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY not configured on server.' });
    }

    const selectedTask = task || 'task2';
    const result = await evaluateWithGroq(selectedTask, topic || '', essay);

    const rawTaskScore = result.taskAchievement ?? result.taskResponse;
    const ta  = roundHalf(rawTaskScore);
    const cc  = roundHalf(result.coherenceCohesion);
    const lr  = roundHalf(result.lexicalResource);
    const gra = roundHalf(result.grammaticalRange);

    const computedOverall =
      [ta, cc, lr, gra].every(v => typeof v === 'number')
        ? roundHalf((ta + cc + lr + gra) / 4)
        : roundHalf(result.overall);

    // FIX 2 applied here
    const cleanFeedback = sanitizeFeedback(result.feedback);

    return res.json({
      success: true,
      bandScores: {
        overall: computedOverall,
        taskResponse: ta,
        taskAchievement: ta,
        coherenceCohesion: cc,
        lexicalResource: lr,
        grammaticalRange: gra
      },
      feedback: {
        taskResponse:       cleanFeedback.taskResponse       ?? cleanFeedback.taskAchievement ?? '',
        taskAchievement:    cleanFeedback.taskAchievement    ?? cleanFeedback.taskResponse    ?? '',
        coherenceCohesion:  cleanFeedback.coherenceCohesion  ?? '',
        lexicalResource:    cleanFeedback.lexicalResource     ?? '',
        grammaticalRange:   cleanFeedback.grammaticalRange    ?? '',
        overall:            cleanFeedback.overall             ?? ''
      }
    });
  } catch (err) {
    console.error('Evaluate error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}

app.post('/evaluate', handleEvaluate);
app.post('/api/evaluate', handleEvaluate);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ ok: true, groq: !!GROQ_API_KEY, model: MODEL });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`BandCheck API running on port ${PORT}`));

module.exports = app;
