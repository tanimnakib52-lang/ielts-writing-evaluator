# IELTS Writing Evaluator API

Enhanced Express API for logic-based IELTS writing evaluation with smarter grammar checks, nuanced vocabulary analysis, passive/active voice detection, and detailed, actionable feedback.

## What’s New
- Grammar: detect run-ons, comma splices, and sentence fragments; sentence length variation
- Voice: passive vs. active detection with balance guidance
- Lexical: type-token ratio, complex word ratio, academic signal words, common collocations
- Scoring: quarter-band (0.25) granularity for TR, CC, LR, GRA; overall averaged and rounded to 0.25
- Feedback: concrete fixes with examples and sentence indices
- Health endpoint: /health

## Endpoints

### POST /evaluate
Evaluate an IELTS essay and return counts, features, criterion band scores, overall, and feedback.

Request body
```json
{
  "essay": "Your essay text here..."
}
```

Response shape
```json
{
  "counts": { "words": 287, "sentences": 15, "paragraphs": 4 },
  "features": {
    "avgSentenceLen": 19.1,
    "complexWordCount": 45,
    "fragments": [{"index": 3, "text": "Such as pollution and traffic."}],
    "runOns": [{"index": 7, "text": "I love reading, it makes me calm."}],
    "passive": [{"index": 5, "text": "The policy was implemented by the council."}],
    "active": [{"index": 6, "text": "The council implemented the policy."}],
    "vocab": { "typeTokenRatio": 0.47, "academicCount": 3, "collocations": 2 },
    "avgWordLen": 4.9
  },
  "scores": { "TR": 6.75, "CC": 7.0, "LR": 6.75, "GRA": 6.5, "overall": 6.75 },
  "feedback": [
    "Fix run-on sentences (e.g., in sentences: 2). Try subordinators like \"because/although\" or use a period.",
    "Complete sentence fragments (e.g., sentences: 4). Ensure each sentence has a subject and a finite verb.",
    "Reduce heavy passive voice. Prefer clear agents: \"The government should invest...\"",
    "Upgrade: good -> beneficial/constructive; bad -> detrimental/adverse"
  ]
}
```

Notes on scoring heuristics
- TR (Task Response): word count targeting 250–320 words; paragraphing and cohesion bonus; soft penalty for excessive length
- CC (Coherence & Cohesion): sentence length variation, cohesive phrases, penalties for run-ons and fragments
- LR (Lexical Resource): type-token ratio, complex word share, academic signals
- GRA (Grammar Range & Accuracy): penalties for fragments/run-ons; passive balance; average word length proxy

### GET /health
Simple health check.

Response
```json
{ "ok": true }
```

## Local development

Requirements
- Node.js 18+

Install and run
```bash
npm install
npm run dev # or: npm start
```

Example curl
```bash
curl -X POST http://localhost:3000/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"essay":"In modern societies, many people ..."}'
```

## Deployment
This app exports an Express app (module.exports = app). Deploy with:
- Vercel: set the api directory as a serverless function entry (Node.js runtime), or wrap with vercel serverless adapter if needed.
- Render/Fly/Heroku: create a small server that listens (e.g., index.js with app.listen) or use an adapter as required by the platform.

Tip: If your platform expects a server to listen on a port, create a server.js:
```js
const app = require('./api/index');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('API listening on', port));
```
