# BandCheck — IELTS Writing Evaluator

AI-powered IELTS Writing Task 1 & Task 2 band-score estimator with feedback.

- **Frontend**: React (CRA) — `client/`
- **Backend**: Express on Vercel Serverless — `api/index.js`
- **Scoring**: Groq — `llama-3.3-70b-versatile`

## Features

- IELTS Writing **Task 1** and **Task 2** evaluation
- Criterion-wise band scores
- Overall estimated band score
- Actionable feedback, strengths, and improvements
- Word, sentence, and paragraph counts
- Clean responsive UI with dark/light theme

## How scoring works

Each essay is evaluated by **Groq `llama-3.3-70b-versatile`** using IELTS-style scoring logic based on the main writing criteria:

1. **Task Response / Task Achievement** — how well the essay answers the prompt
2. **Coherence & Cohesion** — organization, clarity, and logical progression
3. **Lexical Resource** — vocabulary range and word choice
4. **Grammatical Range & Accuracy** — grammar variety and correctness

The API returns:
- Criterion-wise scores
- Overall band score
- Feedback
- Strengths
- Improvements
- Basic writing stats

Scores are rounded to IELTS-style **0.5 bands**.

## Local development

```bash
# API
cd api
cp .env.example .env   # then add your GROQ_API_KEY
npm install
npm run dev            # http://localhost:3001

# Client (separate terminal)
cd client
npm install
npm start              # http://localhost:3000
```

## Environment variables

| Name | Where | Required | Description |
|------|-------|----------|-------------|
| `GROQ_API_KEY` | Vercel / api `.env` | yes | Groq API key |
| `REACT_APP_API_URL` | client | no | Defaults to `/api` in production |

## API

`POST /api/evaluate`

```json
{
  "task": "task2",
  "topic": "optional question/topic",
  "essay": "your essay text"
}
```

Response:

```json
{
  "task": "task2",
  "bandScores": {
    "taskResponse": 6.5,
    "coherenceCohesion": 6.5,
    "lexicalResource": 7.0,
    "grammaticalRange": 6.0,
    "overall": 6.5
  },
  "estimate": {
    "overall_band": 6.5,
    "task_response": 6.5,
    "coherence_cohesion": 6.5,
    "lexical_resource": 7.0,
    "grammatical_range_accuracy": 6.0
  },
  "feedback": ["..."],
  "strengths": ["..."],
  "improvements": ["..."],
  "counts": {
    "words": 285,
    "sentences": 16,
    "paragraphs": 4
  },
  "model": "Groq llama3-70b"
}
```

> For **Task 1**, `taskResponse` may be returned as `taskAchievement`.

## Deploy

Push to GitHub — Vercel auto-builds via `vercel.json`.

Make sure `GROQ_API_KEY` is set in:

**Project Settings → Environment Variables**

Then redeploy.

## Author

Built by **Nakib Mahmud Tanim**  
AI-assisted development with Perplexity AI
