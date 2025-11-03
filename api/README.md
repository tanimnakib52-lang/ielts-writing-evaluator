# IELTS Writing Evaluator API

A free, open-source IELTS writing evaluation API that provides instant scoring and feedback using logic-based algorithms. No AI dependencies - fast, accurate, and completely free!

## Features

- ✅ **Free & Open Source** - No API keys or paid services required
- ⚡ **Fast** - Pure logic-based evaluation (no external API calls)
- 📊 **Comprehensive Scoring** - Band scores for all IELTS criteria
- 💡 **Detailed Feedback** - Strengths, weaknesses, and improvement suggestions
- 🔍 **Grammar & Vocabulary Analysis** - Pattern-based checks
- 📈 **Statistics** - Word count, sentence analysis, paragraph structure

## Installation

```bash
# Install dependencies
npm install

# For development with auto-reload
npm run dev

# For production
npm start
```

## API Endpoints

### POST /evaluate

Evaluates an IELTS writing essay and returns band scores with detailed feedback.

**Request Body:**
```json
{
  "essay": "Your essay text here...",
  "taskType": "task1"  // or "task2"
}
```

**Response Example:**
```json
{
  "success": true,
  "taskType": "task2",
  "bandScores": {
    "overall": 6.5,
    "taskAchievement": 6.5,
    "coherenceCohesion": 7.0,
    "lexicalResource": 6.5,
    "grammaticalRangeAccuracy": 6.0
  },
  "statistics": {
    "wordCount": 287,
    "sentenceCount": 15,
    "paragraphCount": 4,
    "complexWords": 45,
    "linkingWords": 8,
    "averageWordsPerSentence": "19.1"
  },
  "feedback": {
    "strengths": [
      "Good word count: 287 words",
      "Well-organized paragraph structure",
      "Good use of cohesive devices and linking words",
      "Good range of vocabulary with complex words"
    ],
    "weaknesses": [
      "Some grammar and punctuation issues detected"
    ],
    "suggestions": [
      "Review your work for repeated words, capitalization, and punctuation"
    ]
  },
  "grammarIssues": [
    "Repeated words detected: 2 instances"
  ]
}
```

### GET /

Health check endpoint that returns API information.

### GET /sample-response

Returns a sample evaluation response for documentation purposes.

## Scoring Criteria

The API evaluates essays based on four IELTS criteria:

### 1. Task Achievement (Task 1) / Task Response (Task 2)
- Word count requirements (Task 1: 150+ words, Task 2: 250+ words)
- Essay length and completeness

### 2. Coherence and Cohesion
- Paragraph structure (4+ paragraphs ideal)
- Use of linking words and transitional phrases
- Overall organization

### 3. Lexical Resource
- Vocabulary range and complexity
- Complex word usage (words with 7+ characters)
- Average word length

### 4. Grammatical Range and Accuracy
- Grammar pattern checks
- Punctuation correctness
- Sentence variety and complexity
- Detection of common errors (repeated words, capitalization issues)

## Grammar Checks

The API performs basic grammar and style checks:

- ✓ Repeated word detection
- ✓ Capitalization after punctuation
- ✓ Missing spaces after punctuation
- ✓ Sentence length analysis

## Usage Example

### Using cURL

```bash
curl -X POST http://localhost:3001/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "essay": "In recent years, technology has transformed the way we communicate. Many people believe that social media has brought people closer together. However, others argue that it has created distance between individuals. In my opinion, while technology offers convenience, face-to-face interaction remains irreplaceable. Firstly, social media allows instant communication across distances. Moreover, it enables people to maintain relationships despite geographical barriers. Nevertheless, excessive screen time can reduce the quality of personal interactions. Therefore, a balanced approach is essential for healthy relationships.",
    "taskType": "task2"
  }'
```

### Using JavaScript (fetch)

```javascript
const evaluateEssay = async () => {
  const response = await fetch('http://localhost:3001/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      essay: 'Your essay text here...',
      taskType: 'task2'
    })
  });
  
  const result = await response.json();
  console.log(result);
};
```

## Configuration

The API runs on port 3001 by default. You can change this by setting the PORT environment variable:

```bash
PORT=5000 npm start
```

## Dependencies

- **express**: ^4.18.2 - Web framework
- **cors**: ^2.8.5 - CORS middleware

## Development

- **nodemon**: ^3.0.1 - Auto-restart server on file changes

## How It Works

The evaluation system uses pure logic-based algorithms:

1. **Text Analysis**: Counts words, sentences, paragraphs
2. **Pattern Matching**: Detects linking words, complex vocabulary
3. **Grammar Checks**: Identifies common issues using regex patterns
4. **Scoring Algorithm**: Calculates band scores based on predefined criteria
5. **Feedback Generation**: Provides contextual suggestions based on analysis

## Advantages

✅ **No AI Costs** - Completely free to use
✅ **Privacy** - All processing happens locally
✅ **Speed** - Instant results with no API delays
✅ **Reliability** - No dependency on external services
✅ **Accuracy** - Logic-based scoring aligned with IELTS criteria
✅ **Transparency** - Open-source algorithm you can inspect and modify

## Limitations

⚠️ This is a basic evaluator using pattern matching and logic. For production use:
- Consider adding more sophisticated NLP libraries
- Implement content relevance checking
- Add spell checking functionality
- Enhance grammar detection with dedicated libraries

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Improve scoring algorithms
- Add more grammar checks

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
