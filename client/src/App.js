import React, { useState } from 'react';
import './App.css';

function App() {
  const [essay, setEssay] = useState('');
  const [taskType, setTaskType] = useState('Task 2');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // OCR states
  const [imageFile, setImageFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // AI scoring states
  const [useAi, setUseAi] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

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
      const response = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, taskType }),
      });
      if (!response.ok) throw new Error('Failed to evaluate essay');
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
      const res = await fetch(`${API}/ocr-evaluate`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setEssay(data.text);
      } else {
        alert(data.error || 'OCR failed');
      }
    } catch (e) {
      alert('Error calling OCR API');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleAiEvaluate = async () => {
    if (!essay) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API}/ai-evaluate`, {
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
      alert('Error calling AI API');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>IELTS Writing Evaluator</h1>
      </header>
      <div className="container">

        {/* OCR Section */}
        <div className="form-group">
          <label>Upload Handwritten Essay Image (Optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && setImageFile(e.target.files[0])}
          />
          <button
            type="button"
            onClick={handleOcr}
            disabled={!imageFile || ocrLoading}
            className="ocr-btn"
          >
            {ocrLoading ? 'Extracting Text...' : 'Extract Text from Image'}
          </button>
        </div>

        {/* AI Toggle */}
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
            />
            {' '}Use Advanced AI Scoring (Google Gemini)
          </label>
        </div>

        <form onSubmit={handleSubmit} className="evaluation-form">
          <div className="form-group">
            <label htmlFor="taskType">Task Type</label>
            <select
              id="taskType"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
            >
              <option value="Task 1">Task 1</option>
              <option value="Task 2">Task 2</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="essay">Your Essay</label>
            <textarea
              id="essay"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="Paste your IELTS essay here..."
              rows={15}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Evaluating...' : 'Submit'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <h3>Error</h3>
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
                  <div className="score-item"><span>Task Achievement</span><span>{results.bandScores.taskAchievement || results.bandScores.taskResponse}</span></div>
                  <div className="score-item"><span>Coherence & Cohesion</span><span>{results.bandScores.coherenceCohesion}</span></div>
                  <div className="score-item"><span>Lexical Resource</span><span>{results.bandScores.lexicalResource}</span></div>
                  <div className="score-item"><span>Grammatical Range</span><span>{results.bandScores.grammaticalRange}</span></div>
                  <div className="score-item overall"><span>Overall Band Score</span><span>{results.bandScores.overall}</span></div>
                </div>
              </div>
            )}
            {results.feedback && (
              <div className="feedback-section">
                <h3>Detailed Feedback</h3>
                <div className="feedback-content">
                  {typeof results.feedback === 'string'
                    ? <p>{results.feedback}</p>
                    : <pre>{JSON.stringify(results.feedback, null, 2)}</pre>
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {aiResult && (
          <div className="ai-results-section">
            <h2>AI-Powered Evaluation Results</h2>
            <div className="ai-band-scores">
              <div className="overall-band">
                <h3>Overall Band Score</h3>
                <div className="band-number">{aiResult.bands?.overall ?? 'N/A'}</div>
              </div>
              <div className="criteria-scores">
                <div className="score-item"><span>Task Achievement</span><span>{aiResult.bands?.taskAchievement ?? 'N/A'}</span></div>
                <div className="score-item"><span>Coherence & Cohesion</span><span>{aiResult.bands?.coherenceCohesion ?? 'N/A'}</span></div>
                <div className="score-item"><span>Lexical Resource</span><span>{aiResult.bands?.lexicalResource ?? 'N/A'}</span></div>
                <div className="score-item"><span>Grammatical Range</span><span>{aiResult.bands?.grammaticalRangeAccuracy ?? 'N/A'}</span></div>
              </div>
            </div>
            {aiResult.strengths?.length > 0 && (
              <div className="feedback-section strengths">
                <h3>Strengths</h3>
                <ul>{aiResult.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {aiResult.weaknesses?.length > 0 && (
              <div className="feedback-section weaknesses">
                <h3>Areas for Improvement</h3>
                <ul>{aiResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            {aiResult.suggestions?.length > 0 && (
              <div className="feedback-section suggestions">
                <h3>Suggestions</h3>
                <ul>{aiResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
