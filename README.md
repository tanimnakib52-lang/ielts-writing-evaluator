# BandCheck — IELTS Writing Evaluator

BandCheck is an AI-powered web application that evaluates IELTS Writing Task 1 and Task 2 responses and returns estimated band scores with structured feedback.

## Overview

The application analyzes essays across the main IELTS writing criteria:
- Task Response / Task Achievement
- Coherence & Cohesion
- Lexical Resource
- Grammatical Range & Accuracy

It returns:
- Criterion-wise band scores
- Overall estimated band score
- Feedback
- Strengths
- Improvement suggestions
- Basic writing statistics

## Tech Stack

- **Frontend:** React
- **Backend:** Express
- **Deployment:** Vercel Serverless Functions
- **AI Model:** Groq `llama-3.3-70b-versatile`

## Project Structure

```bash
client/   # React frontend
api/      # Express serverless API
```

## Local Development

### Backend
```bash
cd api
cp .env.example .env
# add GROQ_API_KEY
npm install
npm run dev
```

### Frontend
```bash
cd client
npm install
npm start
```

## Environment Variables

| Name | Required | Description |
|------|----------|-------------|
| `GROQ_API_KEY` | Yes | API key for Groq model access |
| `REACT_APP_API_URL` | No | Custom API base URL for the frontend |

## API Endpoint

**POST** `/api/evaluate`

Example request:

```json
{
  "task": "task2",
  "topic": "Some IELTS topic",
  "essay": "Your essay text here"
}
```

## Deployment

The project is configured for Vercel deployment through `vercel.json`.  
After pushing to GitHub, set the required environment variables in Vercel and redeploy.

## Author

Built by **Nakib Mahmud Tanim**  
AI-assisted development with Perplexity AI
