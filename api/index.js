const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to count words
function countWords(text) {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Helper function to count sentences
function countSentences(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.length;
}

// Helper function to calculate average word length
function averageWordLength(text) {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length === 0) return 0;
  const totalLength = words.reduce((sum, word) => sum + word.length, 0);
  return totalLength / words.length;
}

// Helper function to count paragraphs
function countParagraphs(text) {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0).length;
}

// Helper function to detect complex vocabulary (words > 7 characters)
function countComplexWords(text) {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.filter(word => word.length > 7).length;
}

// Helper function to detect linking words
function countLinkingWords(text) {
  const linkingWords = [
    'however', 'therefore', 'moreover', 'furthermore', 'nevertheless',
    'consequently', 'additionally', 'alternatively', 'similarly',
    'in contrast', 'on the other hand', 'in addition', 'for example',
    'for instance', 'in conclusion', 'to sum up', 'firstly', 'secondly',
    'finally', 'although', 'despite', 'whereas', 'while'
  ];
  const lowerText = text.toLowerCase();
  return linkingWords.filter(word => lowerText.includes(word)).length;
}

// Helper function to check grammar patterns (basic checks)
function checkGrammarPatterns(text) {
  const issues = [];
  
  // Check for repeated words
  const repeatedWords = text.match(/(\b\w+\b)\s+\1/gi);
  if (repeatedWords && repeatedWords.length > 0) {
    issues.push(`Repeated words detected: ${repeatedWords.length} instances`);
  }
  
  // Check for sentence starting with lowercase
  const lowercaseStarts = text.match(/[.!?]\s+[a-z]/g);
  if (lowercaseStarts && lowercaseStarts.length > 0) {
    issues.push(`Sentences starting with lowercase: ${lowercaseStarts.length}`);
  }
  
  // Check for missing spaces after punctuation
  const missingSpaces = text.match(/[,;:][A-Za-z]/g);
  if (missingSpaces && missingSpaces.length > 0) {
    issues.push(`Missing spaces after punctuation: ${missingSpaces.length}`);
  }
  
  return issues;
}

// Scoring logic
function calculateScores(essay, taskType) {
  const wordCount = countWords(essay);
  const sentenceCount = countSentences(essay);
  const paragraphCount = countParagraphs(essay);
  const avgWordLength = averageWordLength(essay);
  const complexWordCount = countComplexWords(essay);
  const linkingWordCount = countLinkingWords(essay);
  const grammarIssues = checkGrammarPatterns(essay);
  
  // Word count requirements (Task 1: 150+, Task 2: 250+)
  const minWords = taskType === 'task1' ? 150 : 250;
  const idealWords = taskType === 'task1' ? 200 : 300;
  
  let taskAchievementScore = 5.0;
  let coherenceScore = 5.0;
  let lexicalScore = 5.0;
  let grammarScore = 5.0;
  
  // Task Achievement scoring
  if (wordCount >= idealWords) {
    taskAchievementScore = 7.0;
  } else if (wordCount >= minWords) {
    taskAchievementScore = 6.0;
  } else if (wordCount >= minWords * 0.8) {
    taskAchievementScore = 5.5;
  } else {
    taskAchievementScore = 5.0;
  }
  
  // Coherence and Cohesion scoring
  if (paragraphCount >= 4 && linkingWordCount >= 5) {
    coherenceScore = 7.0;
  } else if (paragraphCount >= 3 && linkingWordCount >= 3) {
    coherenceScore = 6.5;
  } else if (paragraphCount >= 2 && linkingWordCount >= 2) {
    coherenceScore = 6.0;
  } else {
    coherenceScore = 5.5;
  }
  
  // Lexical Resource scoring
  const complexWordRatio = complexWordCount / wordCount;
  if (complexWordRatio > 0.3 && avgWordLength > 5) {
    lexicalScore = 7.0;
  } else if (complexWordRatio > 0.2 && avgWordLength > 4.5) {
    lexicalScore = 6.5;
  } else if (complexWordRatio > 0.15) {
    lexicalScore = 6.0;
  } else {
    lexicalScore = 5.5;
  }
  
  // Grammar scoring (penalize for issues)
  if (grammarIssues.length === 0 && sentenceCount > 10) {
    grammarScore = 7.0;
  } else if (grammarIssues.length <= 2 && sentenceCount > 8) {
    grammarScore = 6.5;
  } else if (grammarIssues.length <= 4) {
    grammarScore = 6.0;
  } else {
    grammarScore = 5.5;
  }
  
  // Calculate overall band score (average of all components)
  const overallScore = ((taskAchievementScore + coherenceScore + lexicalScore + grammarScore) / 4).toFixed(1);
  
  return {
    overallBand: parseFloat(overallScore),
    taskAchievement: taskAchievementScore,
    coherenceCohesion: coherenceScore,
    lexicalResource: lexicalScore,
    grammaticalRange: grammarScore,
    wordCount,
    sentenceCount,
    paragraphCount,
    complexWordCount,
    linkingWordCount,
    grammarIssues
  };
}

// Generate feedback based on scores
function generateFeedback(scores, taskType) {
  const strengths = [];
  const weaknesses = [];
  const suggestions = [];
  
  // Word count feedback
  const minWords = taskType === 'task1' ? 150 : 250;
  if (scores.wordCount >= minWords) {
    strengths.push(`Good word count: ${scores.wordCount} words`);
  } else {
    weaknesses.push(`Insufficient word count: ${scores.wordCount} words (minimum: ${minWords})`);
    suggestions.push('Expand your ideas with more details and examples');
  }
  
  // Paragraph structure feedback
  if (scores.paragraphCount >= 4) {
    strengths.push('Well-organized paragraph structure');
  } else {
    weaknesses.push(`Limited paragraph structure: ${scores.paragraphCount} paragraphs`);
    suggestions.push('Organize your essay into clear paragraphs (introduction, body paragraphs, conclusion)');
  }
  
  // Linking words feedback
  if (scores.linkingWordCount >= 5) {
    strengths.push('Good use of cohesive devices and linking words');
  } else {
    weaknesses.push('Limited use of linking words');
    suggestions.push('Use more transitional phrases (however, therefore, in addition, etc.)');
  }
  
  // Vocabulary feedback
  if (scores.complexWordCount >= 20) {
    strengths.push('Good range of vocabulary with complex words');
  } else {
    weaknesses.push('Limited vocabulary range');
    suggestions.push('Incorporate more sophisticated vocabulary to demonstrate lexical resource');
  }
  
  // Grammar feedback
  if (scores.grammarIssues.length === 0) {
    strengths.push('No obvious grammar or punctuation errors detected');
  } else {
    weaknesses.push('Grammar and punctuation issues detected');
    suggestions.push('Review your work for repeated words, capitalization, and punctuation');
  }
  
  // Sentence variety feedback
  const avgWordsPerSentence = scores.wordCount / scores.sentenceCount;
  if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 25) {
    strengths.push('Good sentence length variety');
  } else if (avgWordsPerSentence < 15) {
    weaknesses.push('Sentences are too short on average');
    suggestions.push('Combine simple sentences into more complex structures');
  } else {
    weaknesses.push('Sentences are too long on average');
    suggestions.push('Break down long sentences for better clarity');
  }
  
  return { strengths, weaknesses, suggestions };
}

// Main evaluation endpoint
app.post('/evaluate', (req, res) => {
  try {
    const { essay, taskType } = req.body;
    
    // Validate input
    if (!essay || typeof essay !== 'string') {
      return res.status(400).json({
        error: 'Essay text is required and must be a string'
      });
    }
    
    if (!taskType || !['task1', 'task2'].includes(taskType)) {
      return res.status(400).json({
        error: 'Task type is required and must be either "task1" or "task2"'
      });
    }
    
    // Calculate scores
    const scores = calculateScores(essay, taskType);
    
    // Generate feedback
    const feedback = generateFeedback(scores, taskType);
    
    // Prepare response
    const response = {
      success: true,
      taskType,
      bandScores: {
        overall: scores.overallBand,
        taskAchievement: scores.taskAchievement,
        coherenceCohesion: scores.coherenceCohesion,
        lexicalResource: scores.lexicalResource,
        grammaticalRangeAccuracy: scores.grammaticalRange
      },
      statistics: {
        wordCount: scores.wordCount,
        sentenceCount: scores.sentenceCount,
        paragraphCount: scores.paragraphCount,
        complexWords: scores.complexWordCount,
        linkingWords: scores.linkingWordCount,
        averageWordsPerSentence: (scores.wordCount / scores.sentenceCount).toFixed(1)
      },
      feedback: {
        strengths: feedback.strengths,
        weaknesses: feedback.weaknesses,
        suggestions: feedback.suggestions
      },
      grammarIssues: scores.grammarIssues
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error evaluating essay:', error);
    res.status(500).json({
      error: 'An error occurred while evaluating the essay',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'IELTS Writing Evaluator API',
    version: '1.0.0',
    endpoints: {
      evaluate: 'POST /evaluate'
    },
    sampleRequest: {
      essay: 'Your essay text here...',
      taskType: 'task1 or task2'
    }
  });
});

// Example response for documentation
app.get('/sample-response', (req, res) => {
  res.json({
    success: true,
    taskType: 'task2',
    bandScores: {
      overall: 6.5,
      taskAchievement: 6.5,
      coherenceCohesion: 7.0,
      lexicalResource: 6.5,
      grammaticalRangeAccuracy: 6.0
    },
    statistics: {
      wordCount: 287,
      sentenceCount: 15,
      paragraphCount: 4,
      complexWords: 45,
      linkingWords: 8,
      averageWordsPerSentence: '19.1'
    },
    feedback: {
      strengths: [
        'Good word count: 287 words',
        'Well-organized paragraph structure',
        'Good use of cohesive devices and linking words',
        'Good range of vocabulary with complex words'
      ],
      weaknesses: [
        'Some grammar and punctuation issues detected'
      ],
      suggestions: [
        'Review your work for repeated words, capitalization, and punctuation'
      ]
    },
    grammarIssues: [
      'Repeated words detected: 2 instances'
    ]
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`IELTS Writing Evaluator API running on port ${PORT}`);
});

module.exports = app;
