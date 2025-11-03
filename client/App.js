import React, { useState } from 'react';
import './App.css';

function App() {
  const [essay, setEssay] = useState('');
  const [taskType, setTaskType] = useState('Task 1');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/evaluate', {
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>IELTS Writing Evaluator</h1>
      </header>

      <div className="container">
        <form onSubmit={handleSubmit} className="evaluation-form">
          <div className="form-group">
            <label htmlFor="taskType">Task Type:</label>
            <textarea
              id="taskType"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              placeholder="Enter task type (e.g., Task 1, Task 2)"
              rows="2"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="essay">Your Essay:</label>
            <textarea
              id="essay"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="Paste your IELTS essay here..."
              rows="15"
              required
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
                  {results.bandScores.taskAchievement && (
                    <div className="score-item">
                      <span className="score-label">Task Achievement:</span>
                      <span className="score-value">{results.bandScores.taskAchievement}</span>
                    </div>
                  )}
                  {results.bandScores.coherenceCohesion && (
                    <div className="score-item">
                      <span className="score-label">Coherence & Cohesion:</span>
                      <span className="score-value">{results.bandScores.coherenceCohesion}</span>
                    </div>
                  )}
                  {results.bandScores.lexicalResource && (
                    <div className="score-item">
                      <span className="score-label">Lexical Resource:</span>
                      <span className="score-value">{results.bandScores.lexicalResource}</span>
                    </div>
                  )}
                  {results.bandScores.grammaticalRange && (
                    <div className="score-item">
                      <span className="score-label">Grammatical Range & Accuracy:</span>
                      <span className="score-value">{results.bandScores.grammaticalRange}</span>
                    </div>
                  )}
                  {results.bandScores.overall && (
                    <div className="score-item overall">
                      <span className="score-label">Overall Band Score:</span>
                      <span className="score-value">{results.bandScores.overall}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {results.feedback && (
              <div className="feedback-section">
                <h3>Detailed Feedback</h3>
                <div className="feedback-content">
                  {typeof results.feedback === 'string' ? (
                    <p>{results.feedback}</p>
                  ) : (
                    <pre>{JSON.stringify(results.feedback, null, 2)}</pre>
                  )}
                </div>
              </div>
            )}

            {results.strengths && (
              <div className="strengths-section">
                <h3>Strengths</h3>
                <ul>
                  {Array.isArray(results.strengths) ? (
                    results.strengths.map((strength, index) => (
                      <li key={index}>{strength}</li>
                    ))
                  ) : (
                    <li>{results.strengths}</li>
                  )}
                </ul>
              </div>
            )}

            {results.improvements && (
              <div className="improvements-section">
                <h3>Areas for Improvement</h3>
                <ul>
                  {Array.isArray(results.improvements) ? (
                    results.improvements.map((improvement, index) => (
                      <li key={index}>{improvement}</li>
                    ))
                  ) : (
                    <li>{results.improvements}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
