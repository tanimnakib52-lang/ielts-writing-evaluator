/**
 * BandCheck IELTS Writing Evaluator API
 * Scoring powered by Groq (llama-3.3-70b-versatile)
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

async function evaluateWithGroq(task, topic, essay) {
  const prompt = `You are an expert IELTS examiner. Evaluate the following IELTS Writing ${task === 'task1' ? 'Task 1' : 'Task 2'} essay and return a JSON object only, no explanation outside JSON.

Topic: ${topic || 'General'}

Essay:
${essay}

Return this exact JSON structure (use these exact key names):
{
  "overall": <number 0-9 in 0.5 steps>,
  "taskResponse": <number 0-9 in 0.5 steps>,
  "coherenceCohesion": <number 0-9 in 0.5 steps>,
  "lexicalResource": <number 0-9 in 0.5 steps>,
  "grammaticalRange": <number 0-9 in 0.5 steps>,
  "feedback": {
    "taskResponse": "<2-3 sentences feedback>",
    "coherenceCohesion": "<2-3 sentences feedback>",
    "lexicalResource": "<2-3 sentences feedback>",
    "grammaticalRange": "<2-3 sentences feedback>",
    "overall": "<3-4 sentences overall feedback with improvement tips>"
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

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Groq response');
  return JSON.parse(jsonMatch[0]);
}

function roundHalf(num) {
  return Math.round(num * 2) / 2;
}

async function handleEvaluate(req, res) {
  try {
    const { task, topic, essay } = req.body;

    if (!essay || essay.trim().length < 50) {
      return res.status(400).json({ error: 'Essay too short. Minimum 50 characters.' });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KYE not configured on server.' });
    }

    const result = await evaluateWithGroq(task || 'task2', topic || '', essay);

    return res.json({
      success: true,
      bandScores: {
        overall: roundHalf(result.overall),
        taskResponse: roundHalf(result.taskResponse),
        coherenceCohesion: roundHalf(result.coherenceCohesion),
        lexicalResource: roundHalf(result.lexicalResource),
        grammaticalRange: roundHalf(result.grammaticalRange)
      },
      feedback: result.feedback
    });
  } catch (err) {
    console.error('Evaluate error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}

app.post('/evaluate', handleEvaluate);
app.post('/api/evaluate', handleEvaluate);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    ok: true,
    groq: !!GROQ_API_KEY,
    model: MODEL
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`BandCheck API running on port ${PORT}`));

module.exports = app;
