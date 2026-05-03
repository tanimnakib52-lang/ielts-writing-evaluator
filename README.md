# BandCheck — IELTS Writing Evaluator

AI-powered IELTS Writing Task 1 & Task 2 band-score predictor with detailed feedback.

- **Frontend**: React (CRA) — `client/`
- **Backend**: Express on Vercel Serverless — `api/index.js`
- **Models** (Hugging Face Inference API):
  - Task 2 scoring: `KevSun/IELTS_essay_scoring`
  - Task 1 scoring: `KevSun/Engessay_grading_ML`
  - Feedback (both tasks): `KevSun/IELTS_essay_comments`

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
| `HF_TOKEN` | Vercel / api `.env` | yes | Hugging Face Inference API token |
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
    "taskResponse": 7.0,
    "coherenceCohesion": 6.5,
    "lexicalResource": 7.0,
    "grammaticalRange": 6.5,
    "overall": 7.0
  },
  "feedback": ["...", "..."],
  "counts": { "words": 285, "sentences": 16, "paragraphs": 4 }
}
```

## Deploy

Push to GitHub — Vercel auto-builds via `vercel.json`. Set `HF_TOKEN` in Project Settings → Environment Variables, then redeploy.
