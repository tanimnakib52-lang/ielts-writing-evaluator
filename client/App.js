import React, { useState } from 'react';
import './App.css';

function ScoreBox({ label, value, highlight }) {
  return (
    <div className={`score-box${highlight ? ' score-box--overall' : ''}`}>
      <span className="score-label">{label}</span>
      <span className="score-value">{value ?? 'N/A'}</span>
    </div>
  );
}

function FeedbackBlock({ icon, title, items, cls }) {
  return (
    <div className={`feedback-block feedback-block--${cls}`}>
      <h3>{icon} {title}</h3>
      <ul>{items && items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  );
}

export default function App() {
  const [essay, setEssay] = useState('');
  const [taskType, setTaskType] = useState('task1');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setAiResult(null);

    if (useAi) {
      await handleAiEvaluate();
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(API + '/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          essay: essay,
          taskType: taskType,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to evaluate essay');
      }
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOcr = async () => {
    if (!imageFile) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('essayImage', imageFile);
      const res = await fetch(API + '/ocr-evaluate', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setOcrText(data.text);
        setEssay(data.text);
      } else {
        alert(data.error || 'OCR failed');
      }
    } catch (e) {
      console.error(e);
      alert('Error calling OCR API');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleAiEvaluate = async () => {
    if (!essay) return;
    setAiLoading(true);
    try {
      const res = await fetch(API + '/ai-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, taskType }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data);
      } else {
        alert(data.error || 'AI evaluation failed');
      }
    } catch (e) {
      console.error(e);
      alert('Error calling AI API');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>IELTS Writing Evaluator</h1>
        <p>Instant band-score feedback for Task 1 and Task 2</p>
      </header>
      <div className="container">

        <section className="card">
          <h3>Upload Handwritten Essay Image (optional)</h3>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setImageFile(e.target.files[0]);
              }
            }}
          />
          <button
            type="button"
            onClick={handleOcr}
            disabled={!imageFile || ocrLoading}
            className="ocr-btn"
          >
            {ocrLoading ? 'Extracting Text...' : 'Extract Text from Image'}
          </button>
        </section>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
            />
            {' '}Use Advanced AI Scoring
          </label>
        </div>

        <form onSubmit={handleSubmit} className="evaluation-form">
          <div className="form-group">
            <label htmlFor="taskType">Task Type:</label>
            <select
              id="taskType"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              required
            >
              <option value="task1">Task 1</option>
              <option value="task2">Task 2</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="essay">Your Essay:</label>
            <textarea
              id="essay"
              value={essay}
              rows="15"
              required
              placeholder="Paste your IELTS essay here..."
              onChange={(e) => setEssay(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Evaluating...' : 'Submit'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <h3>Error:</h3>
            <p>{error}</p>
          </div>
        )}

        {results && (
          <div className="results-section">
            <h2>Evaluation Results</h2>
            {results.bandScores && (
              <div className="band-scores">
                <h3>Band Scores</h3>
                <div className="scores-grid">
                  <ScoreBox label="Task Achievement" value={results.bandScores.taskAchievement} />
                  <ScoreBox label="Task Response" value={results.bandScores.taskResponse} />
                  <ScoreBox label="Coherence & Cohesion" value={results.bandScores.coherenceCohesion} />
                  <ScoreBox label="Lexical Resource" value={results.bandScores.lexicalResource} />
                  <ScoreBox label="Grammatical Range" value={results.bandScores.grammaticalRange} />
                  <ScoreBox label="Overall Band Score" value={results.bandScores.overall} highlight={true} />
                </div>
              </div>
            )}
            {results.counts && (
              <p className="stats">
                Words: <strong>{results.counts.words}</strong> |
                Sentences: <strong>{results.counts.sentences}</strong> |
                Paragraphs: <strong>{results.counts.paragraphs}</strong>
              </p>
            )}
            {Array.isArray(results.feedback) && results.feedback.length > 0 && (
              <FeedbackBlock icon="&#128172;" title="Detailed Feedback" items={results.feedback} cls="feedback" />
            )}
          </div>
        )}

        {aiResult && (
          <div className="ai-results-section">
            <h2>AI-Powered Evaluation</h2>
            <div className="band-scores">
              <h3>AI Band Scores</h3>
              <div className="scores-grid">
                <ScoreBox label="Task Achievement" value={aiResult.bands && aiResult.bands.taskAchievement} />
                <ScoreBox label="Coherence & Cohesion" value={aiResult.bands && aiResult.bands.coherenceCohesion} />
                <ScoreBox label="Lexical Resource" value={aiResult.bands && aiResult.bands.lexicalResource} />
                <ScoreBox label="Grammatical Range" value={aiResult.bands && aiResult.bands.grammaticalRangeAccuracy} />
                <ScoreBox label="Overall Band Score" value={aiResult.bands && aiResult.bands.overall} highlight={true} />
              </div>
            </div>
            {aiResult.strengths && aiResult.strengths.length > 0 && (
              <FeedbackBlock icon="&#9989;" title="Strengths" items={aiResult.strengths} cls="strengths" />
            )}
            {aiResult.weaknesses && aiResult.weaknesses.length > 0 && (
              <FeedbackBlock icon="&#9888;" title="Areas for Improvement" items={aiResult.weaknesses} cls="weaknesses" />
            )}
            {aiResult.suggestions && aiResult.suggestions.length > 0 && (
              <FeedbackBlock icon="&#128161;" title="Suggestions" items={aiResult.suggestions} cls="suggestions" />
            )}
          </div>
        )}

      </div>
    </div>
  );
}
