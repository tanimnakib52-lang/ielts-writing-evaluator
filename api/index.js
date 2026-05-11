/**
 * BandCheck IELTS Writing Evaluator API
 * Scoring powered by Groq (llama3-70b-8192)
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const GROQ_API_KEY = process.env.GROQ_API_KYE;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function evaluateWithGroq(task, topic, essay) {
  const prompt = `You are an expert IELTS examiner. Evaluate the following IELTS Writing ${task === 'task1' ? 'Task 1' : 'Task 2'} essay and return a JSON object only, no explanation outside JSON.

Topic: ${topic || 'General'}

Essay:
${essay}

Return this exact JSON structure:
{
  "overall": <number 0-9 in 0.5 steps>,
  "task_achievement": <number 0-9 in 0.5 steps>,
  "coherence_cohesion": <number 0-9 in 0.5 steps>,
  "lexical_resource": <number 0-9 in 0.5 steps>,
  "grammatical_range": <number 0-9 in 0.5 steps>,
  "feedback": {
    "task_achievement": "<2-3 sentences feedback>",
    "coherence_cohesion": "<2-3 sentences feedback>",
    "lexical_resource": "<2-3 sentences feedback>",
    "grammatical_range": "<2-3 sentences feedback>",
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
      model: 'llama3-70b-8192',
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

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Groq response');
  return JSON.parse(jsonMatch[0]);
}

// Helper to round to nearest 0.5
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
      scores: {
        overall: roundHalf(result.overall),
        task_achievement: roundHalf(result.task_achievement),
        coherence_cohesion: roundHalf(result.coherence_cohesion),
        lexical_resource: roundHalf(result.lexical_resource),
        grammatical_range: roundHalf(result.grammatical_range)
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
    model: 'llama3-70b-8192'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`BandCheck API running on port ${PORT}`));

module.exports = app;
