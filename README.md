# IELTS Writing Evaluator

A web-based tool that evaluates IELTS Writing Task 1 and Task 2 essays. I built this project to help IELTS learners get instant, detailed feedback on their writing without paying for expensive tutoring services.

Live demo: https://ielts-writing-evaluator.vercel.app

## What it does

- Scores essays across all 4 IELTS criteria: Task Response (TR), Coherence & Cohesion (CC), Lexical Resource (LR), and Grammatical Range & Accuracy (GRA)
- Supports handwritten essay images via OCR (Tesseract.js) — upload a photo, it extracts the text automatically
- Optional AI-powered feedback using Google Gemini API for more human-like evaluation
- Separate evaluation modes for Task 1 and Task 2
- Grammar analysis: detects run-on sentences, fragments, passive/active voice
- Vocabulary analysis: checks academic word usage, lexical richness, cohesive devices

## Tech stack

**Backend:** Node.js, Express.js, Tesseract.js, Google Gemini API

**Frontend:** React, CSS3

**Deployment:** Vercel (frontend), Render (backend)

## Project structure

```
ielts-writing-evaluator/
├── api/          # Express.js backend
│   ├── index.js  # Main server + scoring logic
│   └── .env.example
├── client/       # React frontend
│   ├── App.js
│   └── App.css
└── README.md
```

## Running locally

**1. Clone the repo**
```bash
git clone https://github.com/tanimnakib52-lang/ielts-writing-evaluator.git
cd ielts-writing-evaluator
```

**2. Start the backend**
```bash
cd api
npm install
npm start
# Runs on http://localhost:3001
```

**3. Start the frontend**
```bash
cd client
npm install
npm start
# Opens at http://localhost:3000
```

**4. (Optional) Add Google Gemini API key**

Create `api/.env` from the example file and add your key:
```
GEMINI_API_KEY=your_key_here
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

## License

MIT — free to use for learning or personal projects.
