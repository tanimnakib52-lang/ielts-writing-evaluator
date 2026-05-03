import React, { useState } from 'react';
import './App.css';

function App() {
  const [essay, setEssay] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay }),
      });
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <h1>IELTS Writing Evaluator</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
          placeholder="Paste your IELTS essay here..."
          rows={10}
          cols={60}
        />
        <br />
        <button type="submit" disabled={loading}>
          {loading ? 'Evaluating...' : 'Evaluate'}
        </button>
      </form>
      {result && (
        <div className="result">
          <h2>Results</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
