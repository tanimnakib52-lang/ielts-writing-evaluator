# BandCheck — IELTS Writing Evaluator

AI-powered IELTS Writing Task 1 & Task 2 band-score estimator with feedback.

- **Frontend**: React (CRA) — `client/`
- **Backend**: Express on Vercel Serverless — `api/index.js`
- **Scoring**: Hugging Face zero-shot classification with
  [`FacebookAI/roberta-large-mnli`](https://huggingface.co/FacebookAI/roberta-large-mnli)

## How scoring works

The essay is run through several zero-shot classification calls against
`FacebookAI/roberta-large-mnli`:

1. **Overall band** — candidate labels: `overall band 5`, `overall band 6`,
   `overall band 7`, `overall band 8` (expected-value math returns a 0.5-rounded band).
2. **Grammar** — `grammar weak` vs `grammar strong`
3. **Coherence** — `coherence weak` vs `coherence strong`
4. **Vocabulary** — `vocabulary weak` vs `vocabulary strong`
5. **Task response** — `task response weak` vs `task response strong`

The 4 strong/weak probabilities are mapped linearly to band 4.5–8.0 and rounded to 0.5.
If any single classification call fails the API still returns a usable response
with the remaining scores plus a `warnings` object — it never returns a raw HF error.

## Local development

```bash
# API
cd api
cp .env.example .env   # then add your HF_TOKEN
npm install
npm run dev            # http://localhost:3001

# Client (separate terminal)
cd client
npm install
npm start              # http://localhost:3000
```

## Environment variables

| Name       | Where    | Required | Description                              |
|------------|----------|----------|------------------------------------------|
| `HF_TOKEN` | Vercel / api `.env` | yes | Hugging Face Inference API token with "Make calls to Inference Providers" permission |
| `REACT_APP_API_URL` | client | no | Defaults to `/api` in production |

## API

`POST /api/evaluate`

```json
{
  "task": "task2",          // or "task1"
  "topic": "optional question/topic",
  "essay": "your essay text"
}
```

Response:

```json
{
  "task": "task2",
  "bandScores": {
    "taskResponse": 6.5,        // or "taskAchievement" for task1
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
  "feedback": ["...", "..."],
  "strengths": ["..."],
  "improvements": ["..."],
  "counts": { "words": 285, "sentences": 16, "paragraphs": 4 },
  "model": "FacebookAI/roberta-large-mnli"
}
```

## Deploy

Push to GitHub — Vercel auto-builds via `vercel.json`. The `HF_TOKEN` env var
must be set in Project Settings → Environment Variables, then redeploy.
