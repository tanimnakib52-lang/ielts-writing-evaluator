import React, { useState } from 'react';
import './App.css';

function App() {
  const [essay, setEssay] = useState('');
  const [taskType, setTaskType] = useState('Task 1');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
    // OCR states
  const [imageFile, setImageFile] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  
  // AI scoring states
  const [useAi, setUseAi] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
        setAiResult(null); // Clear previous AI result

    
    // Check if AI scoring is enabled
    if (useAi) {
      await handleAiEvaluate();
      setLoading(false);
      return;
    }

    // Otherwise use normal evaluation
try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/ai-evaluate`, {
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

      const res = await fetch(`${process.env.REACT_APP_API_URL}/ocr-evaluate`, {
        method: 'POST',
        body: formData
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
      const res = await fetch(`${process.env.REACT_APP_API_URL}/ai-evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, taskType })
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
        </div>

        {/* AI Scoring Toggle */}
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
            />
            Use Advanced AI Scoring (OpenAI GPT)
          </label>
        </div>

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
                </ul
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
                  )
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      {/* AI Results Section */}
      {aiResult && (
        <div className="ai-results-section">
          <h2>🤖 AI-Powered Evaluation Results</h2>
          
          <div className="ai-band-scores">
            <div className="overall-band">
              <h3>Overall Band Score</h3>
              <div className="band-number">{aiResult.bands?.overall || 'N/A'}</div>
            </div>
            
            <div className="criteria-scores">
              <div className="score-item">
                <span className="score-label">Task Achievement:</span>
                <span className="score-value">{aiResult.bands?.taskAchievement || 'N/A'}</span>
              </div>
              <div className="score-item">
                <span className="score-label">Coherence & Cohesion:</span>
                <span className="score-value">{aiResult.bands?.coherenceCohesion || 'N/A'}</span>
              </div>
              <div className="score-item">
                <span className="score-label">Lexical Resource:</span>
                <span className="score-value">{aiResult.bands?.lexicalResource || 'N/A'}</span>
              </div>
              <div className="score-item">
                <span className="score-label">Grammatical Range & Accuracy:</span>
                <span className="score-value">{aiResult.bands?.grammaticalRangeAccuracy || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="ai-feedback">
            {aiResult.strengths && aiResult.strengths.length > 0 && (
              <div className="feedback-section strengths">
                <h3>✅ Strengths</h3>
                <ul>
                  {aiResult.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiResult.weaknesses && aiResult.weaknesses.length > 0 && (
              <div className="feedback-section weaknesses">
                <h3>⚠️ Areas for Improvement</h3>
                <ul>
                  {aiResult.weaknesses.map((weakness, index) => (
                    <li key={index}>{weakness}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiResult.suggestions && aiResult.suggestions.length > 0 && (
              <div className="feedback-section suggestions">
                <h3>💡 Suggestions</h3>
                <ul>
                  {aiResult.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
  );
}

export default App;
