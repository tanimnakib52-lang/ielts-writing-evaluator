const express = require('express');
const cors = require('cors');
const app = express();
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// For AI scoring (Google Generative AI)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// Multer upload configuration
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Middleware
app.use(cors());
app.use(express.json());

// ---------- Utility helpers ----------
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9])/g; // simple sentence boundary
const WORD_SPLIT = /[\s]+/g;
const ALPHA_WORD = /[A-Za-z]/;

function tokenizeSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(SENTENCE_SPLIT)
    .filter(s => s.trim().length > 0);
}

function tokenizeWords(text) {
  return text
    .replace(/[()\[\]{}.,!?;:"'`]/g, ' ')
    .split(WORD_SPLIT)
    .filter(w => w && ALPHA_WORD.test(w));
}

function countWords(text) {
  return tokenizeWords(text).length;
}

function countSentences(text) {
  return tokenizeSentences(text).length;
}

function countParagraphs(text) {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0).length;
}

function averageWordLength(text) {
  const words = tokenizeWords(text);
  if (!words.length) return 0;
  const total = words.reduce((s, w) => s + w.length, 0);
  return total / words.length;
}

function countComplexWords(text) {
  return tokenizeWords(text).filter(w => w.length >= 7).length;
}

// ---------- Grammar & style diagnostics ----------
// Detect likely fragments: sentences lacking finite verb or too short
const FINITE_VERB = /\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|may|might|must|shall|should|will|would|'m|'re|'s)\b/i;
function detectFragments(sentences) {
  return sentences
    .map((s, idx) => ({ s: s.trim(), idx }))
    .filter(({ s }) => s.split(WORD_SPLIT).filter(Boolean).length < 5 || !FINITE_VERB.test(s))
    .map(({ s, idx }) => ({ index: idx, text: s }));
}

// Detect likely run-ons: multiple independent clauses joined by comma/no conjunction
const COORD_CONJ = /\b(and|but|or|nor|for|yet|so)\b/i;
function detectRunOns(sentences) {
  return sentences
    .map((s, idx) => ({ s: s.trim(), idx }))
    .filter(({ s }) => {
      const clauseLike = s.split(/[,;:]/).map(x => x.trim()).filter(Boolean);
      const manyClauses = clauseLike.length >= 3;
      const commaSpliceTwo = clauseLike.length === 2 && !/\b(and|but|or|so|yet)\b/i.test(s);
      const veryLong = s.split(WORD_SPLIT).length > 35 && /,/.test(s) && !COORD_CONJ.test(s);
      return manyClauses || commaSpliceTwo || veryLong;
    })
    .map(({ s, idx }) => ({ index: idx, text: s }));
}

// Passive voice heuristic: form of be + past participle (verb-ed or irregular common list)
const IRREG_PP = /(written|taken|given|seen|known|made|done|built|bought|thought|found|kept|left|felt|heard|held|led|lost|put|read|said|sent|set|spent|told|understood|won)\b/i;
function detectPassiveSentences(sentences) {
  return sentences
    .map((s, idx) => ({ s: s.trim(), idx }))
    .filter(({ s }) => /\b(am|is|are|was|were|be|been|being)\b\s+(\w+ed\b|\w+en\b|\w+n\b|${IRREG_PP.source})/i.test(s))
    .map(({ s, idx }) => ({ index: idx, text: s }));
}

function detectActiveSentences(sentences) {
  // active heuristic: subject pronoun/noun + lexical verb without be-aux
  return sentences
    .map((s, idx) => ({ s: s.trim(), idx }))
    .filter(({ s }) => /\b(I|We|You|They|He|She|People|Students|Government|Researchers|It)\b[^.?!]*\b(\w{3,})(?!\s*(been|being|be|am|is|are|was|were))\b/i.test(s))
    .map(({ s, idx }) => ({ index: idx, text: s }));
}

// Lexical sophistication: rare/academic word hints and phrase variety
const ACADEMIC_WORDS = [
  'moreover','however','nevertheless','consequently','furthermore','whereas','thus','therefore','significantly','predominantly','notwithstanding','albeit','paradigm','mitigate','underpin','alleviate','substantiate','robust','salient','ubiquitous','inadvertent'
];
function analyzeVocabulary(text) {
  const words = tokenizeWords(text).map(w => w.toLowerCase());
  const types = new Set(words);
  const typeTokenRatio = words.length ? types.size / words.length : 0;
  const academic = words.filter(w => ACADEMIC_WORDS.includes(w));
  const collocations = (text.match(/\b(play an important role|as a result|in addition to|on the other hand|in contrast|a wide range of)\b/gi) || []).length;
  return { typeTokenRatio, academicCount: academic.length, collocations };
}

// ---------- Scoring model (IELTS-like) ----------
// Four criteria: Task Response (TR), Coherence & Cohesion (CC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA)
// Return finer steps: .0, .25, .5, .75
function toQuarterBand(score) {
  return Math.round(score * 4) / 4; // to nearest 0.25
}

function scoreEssay(text) {
  const words = tokenizeWords(text);
  const sentences = tokenizeSentences(text);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim()).length;

  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLen = sentenceCount ? wordCount / sentenceCount : 0;
  const complexWordCount = words.filter(w => w.length >= 7).length;

  const fragments = detectFragments(sentences);
  const runOns = detectRunOns(sentences);
  const passive = detectPassiveSentences(sentences);
  const active = detectActiveSentences(sentences);
  const vocab = analyzeVocabulary(text);

  // Heuristic TR: penalize if too short (<240 words), reward if 250-320; light penalty >420
  let TR = 6.5;
  if (wordCount < 180) TR = 5.0;
  else if (wordCount < 240) TR = 6.0;
  else if (wordCount <= 320) TR = 7.0;
  else if (wordCount <= 420) TR = 6.75;
  else TR = 6.5;
  // Bonus for paragraphing and cohesive devices
  if (paragraphs >= 4) TR += 0.25;

  // CC: sentence length variation and limited run-ons/fragments
  let CC = 6.5;
  const longSentences = sentences.filter(s => s.split(WORD_SPLIT).length > 30).length;
  const shortSentences = sentences.filter(s => s.split(WORD_SPLIT).length < 6).length;
  const variation = (longSentences > 0 && shortSentences > 0) ? 1 : 0;
  CC += variation * 0.5;
  CC -= Math.min(1.5, (runOns.length * 0.3 + fragments.length * 0.2));
  if (vocab.collocations >= 3) CC += 0.25;

  // LR: type-token ratio, complex words, academic signals
  let LR = 6.5;
  if (vocab.typeTokenRatio > 0.5) LR += 0.5;
  else if (vocab.typeTokenRatio > 0.4) LR += 0.25;
  if (complexWordCount / (wordCount || 1) > 0.18) LR += 0.25;
  LR += Math.min(0.5, vocab.academicCount * 0.1);

  // GRA: fragments/run-ons penalties, passive balance, avg word length
  let GRA = 6.5;
  GRA -= Math.min(1.5, fragments.length * 0.2 + runOns.length * 0.3);
  const passiveRate = sentenceCount ? passive.length / sentenceCount : 0;
  if (passiveRate > 0.6) GRA -= 0.5; // overuse passive
  if (passiveRate < 0.15 && active.length > 0) GRA += 0.25; // clear active presence
  if (averageWordLength(text) >= 4.8) GRA += 0.25;

  // Clamp 0-9 and round to quarter bands
  TR = toQuarterBand(Math.max(0, Math.min(9, TR)));
  CC = toQuarterBand(Math.max(0, Math.min(9, CC)));
  LR = toQuarterBand(Math.max(0, Math.min(9, LR)));
  GRA = toQuarterBand(Math.max(0, Math.min(9, GRA)));

  const overall = toQuarterBand(Math.round(((TR + CC + LR + GRA) / 4) * 4) / 4);

  return {
    counts: { words: wordCount, sentences: sentenceCount, paragraphs },
    features: {
      avgSentenceLen,
      complexWordCount,
      fragments,
      runOns,
      passive,
      active,
      vocab,
      avgWordLen: averageWordLength(text)
    },
    bandScores: {
      taskAchievement: TR,
      coherenceCohesion: CC,
      lexicalResource: LR,
      grammaticalRange: GRA,
      overall: { overall
    }
  };
}

// ---------- Feedback generation ----------
function examplesForIssue(key) {
  switch (key) {
    case 'runOns':
      return [
        'Original: I love reading, it makes me calm. -> Fix: I love reading because it makes me calm.',
        'Original: The city expanded rapidly, the infrastructure could not cope. -> Fix: The city expanded rapidly, but the infrastructure could not cope.'
      ];
    case 'fragments':
      return [
        'Fragment: Because technology is advancing. -> Fix: Because technology is advancing, many jobs are being automated.',
        'Fragment: Such as pollution and traffic. -> Fix: The negative effects include pollution and traffic.'
      ];
    case 'passive':
      return [
        'Passive: The policy was implemented by the council. -> Active: The council implemented the policy.',
        'Passive: Mistakes were made. -> Active: We made mistakes.'
      ];
    case 'lexical':
      return [
        'Upgrade: good -> beneficial/constructive; bad -> detrimental/adverse',
        'Cohesion: on the other hand, in contrast, as a result, furthermore'
      ];
    default:
      return [];
  }
}

function buildFeedback(text) {
  const sentences = tokenizeSentences(text);
  const analysis = scoreEssay(text);
  const fb = [];

  if (analysis.counts.words < 240)
    fb.push('Aim for at least 250 words; add one supporting example in a body paragraph.');
  if (analysis.features.runOns.length)
    fb.push(`Fix run-on sentences (e.g., in sentences: ${analysis.features.runOns.map(r => r.index + 1).slice(0, 3).join(', ')}). Try subordinators like "because/although" or use a period.`);
  if (analysis.features.fragments.length)
    fb.push(`Complete sentence fragments (e.g., sentences: ${analysis.features.fragments.map(r => r.index + 1).slice(0, 3).join(', ')}). Ensure each sentence has a subject and a finite verb.`);

  const passiveRate = analysis.counts.sentences ? analysis.features.passive.length / analysis.counts.sentences : 0;
  if (passiveRate > 0.5)
    fb.push('Reduce heavy passive voice. Prefer clear agents: "The government should invest..."');
  if (analysis.features.vocab.typeTokenRatio < 0.42)
    fb.push('Increase lexical variety: replace repeated words and add precise synonyms.');
  if (analysis.features.vocab.collocations < 2)
    fb.push('Add cohesive phrases: "as a result", "on the other hand", "in contrast".');

  // Attach actionable examples
  if (analysis.features.runOns.length) fb.push(...examplesForIssue('runOns'));
  if (analysis.features.fragments.length) fb.push(...examplesForIssue('fragments'));
  if (passiveRate > 0.5) fb.push(...examplesForIssue('passive'));
  fb.push(...examplesForIssue('lexical'));

  return fb.slice(0, 10);
}

// ---------- API ----------
app.post('/evaluate', (req, res) => {
  const { essay = '' } = req.body || {};
  const text = String(essay || '').replace(/\r/g, '\n');
  const result = scoreEssay(text);
  const feedback = buildFeedback(text);
  res.json({ ...result, feedback });
});

app.get('/health', (_, res) => res.json({ ok: true }));

// ========== OCR Endpoint ==========
app.post('/ocr-evaluate', upload.single('essayImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imagePath = req.file.path;

    // Run OCR
    const result = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => console.log(m)
    });

    // Clean up uploaded file
    fs.unlink(imagePath, () => {});

    return res.json({
      success: true,
      text: result.data.text
    });
  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to run OCR on image',
      message: err.message
    });
  }
});

// ========== AI-Based Scoring Endpoint ==========
app.post('/ai-evaluate', async (req, res) => {
  try {
    const { essay, taskType } = req.body;

    if (!essay || typeof essay !== 'string') {
      return res.status(400).json({ error: 'Essay text is required' });
    }

    if (!) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const prompt = `You are an official IELTS writing examiner.
Evaluate the following IELTS ${taskType === 'task1' ? 'Task 1' : 'Task 2'} essay.

Give:
1) Band scores (1-9) for:
   - Task Achievement/Response
   - Coherence and Cohesion
   - Lexical Resource
   - Grammatical Range and Accuracy
2) An overall band (1-9)
3) A short list of strengths
4) A short list of weaknesses
5) Actionable suggestions.

Return JSON only in this format:

{
  "bands": {
    "taskAchievement": number,
    "coherenceCohesion": number,
    "lexicalResource": number,
    "grammaticalRangeAccuracy": number,
    "overall": number
  },
  "strengths": [string],
  "weaknesses": [string],
  "suggestions": [string]
}

Essay:
"${essay}"`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const json = JSON.parse(text);return res.json({ success: true, ...json });
  } catch (err) {
    console.error('AI evaluate error:', err);
    return res.status(500).json({
      success: false,
      error: 'AI evaluation failed',
      message: err.message
    });
  }
});

module.exports = app;
