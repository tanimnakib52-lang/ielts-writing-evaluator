import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_URL || '/api';

const TASK_COPY = {
  task2: {
    label: 'Task 2',
    minWords: 250,
    topicLabel: 'Essay Question / Topic',
    topicPlaceholder: 'e.g., Some people think that universities should provide free education. To what extent do you agree or disagree?',
    essayPlaceholder: 'Paste or type your IELTS Task 2 essay here. Aim for at least 250 words across an introduction, two body paragraphs and a conclusion.',
  },
  task1: {
    label: 'Task 1',
    minWords: 150,
    topicLabel: 'Chart / Diagram Description',
    topicPlaceholder: 'e.g., The graph below shows the percentage of households in different income brackets in three countries between 2000 and 2020.',
    essayPlaceholder: 'Paste or type your IELTS Task 1 report here. Aim for at least 150 words summarising the main features of the chart, graph, or diagram.',
  },
};

const CRITERIA_TASK2 = [
  { key: 'taskResponse', short: 'TR', label: 'Task Response' },
  { key: 'coherenceCohesion', short: 'CC', label: 'Coherence & Cohesion' },
  { key: 'lexicalResource', short: 'LR', label: 'Lexical Resource' },
  { key: 'grammaticalRange', short: 'GRA', label: 'Grammatical Range & Accuracy' },
];
const CRITERIA_TASK1 = [
  { key: 'taskAchievement', short: 'TA', label: 'Task Achievement' },
  { key: 'coherenceCohesion', short: 'CC', label: 'Coherence & Cohesion' },
  { key: 'lexicalResource', short: 'LR', label: 'Lexical Resource' },
  { key: 'grammaticalRange', short: 'GRA', label: 'Grammatical Range & Accuracy' },
];

function bandColor(v) {
  if (v == null) return 'var(--muted)';
  if (v < 5) return '#e63946';
  if (v < 6) return '#f59e0b';
  if (v < 7) return '#d4a017';
  return '#16a34a';
}

function countWords(text) {
  return (text.match(/\b[\w']+\b/g) || []).length;
}
function countSentences(text) {
  return (text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || []).length || (text.trim() ? 1 : 0);
}
function countParagraphs(text) {
  return text.split(/\n\s*\n/).filter(p => p.trim().length).length || (text.trim() ? 1 : 0);
}

function getFeedbackLabel(key, task) {
  if (key === 'taskResponse') return task === 'task1' ? 'Task Achievement' : 'Task Response';
  if (key === 'taskAchievement') return 'Task Achievement';
  if (key === 'coherenceCohesion') return 'Coherence & Cohesion';
  if (key === 'lexicalResource') return 'Lexical Resource';
  if (key === 'grammaticalRange') return 'Grammatical Range & Accuracy';
  if (key === 'overall') return 'Overall Feedback';
  return key;
}

function CriterionCard({ crit, value }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 9) * 100));
  const color = bandColor(value);
  return (
    <div className="crit-card">
      <div className="crit-head">
        <div className="crit-name">
          <span className="crit-short" style={{ background: color }}>{crit.short}</span>
          <span className="crit-label">{crit.label}</span>
        </div>
        <span className="crit-value" style={{ color }}>{value != null ? value.toFixed(1) : '—'}</span>
      </div>
      <div className="crit-bar">
        <div className="crit-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('bandcheck-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });
  const [task, setTask] = useState('task2');
  const [topic, setTopic] = useState('');
  const [essay, setEssay] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const saved = localStorage.getItem('bandcheck-theme');
      if (saved === 'light' || saved === 'dark') return;
      setTheme(e.matches ? 'dark' : 'light');
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const copy = TASK_COPY[task];
  const wordCount = useMemo(() => countWords(essay), [essay]);
  const sentenceCount = useMemo(() => countSentences(essay), [essay]);
  const paragraphCount = useMemo(() => countParagraphs(essay), [essay]);
  const wordOk = wordCount >= copy.minWords;

  const handleEvaluate = async (e) => {
    e.preventDefault();
    setError(null);
    setResults(null);
    if (essay.trim().length < 20) {
      setError('Please write at least a few sentences before evaluating.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, topic, essay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Evaluation failed');
      setResults(data);
      setTimeout(() => {
        const el = document.getElementById('results');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const overall = results?.bandScores?.overall;
  const criteria = task === 'task1' ? CRITERIA_TASK1 : CRITERIA_TASK2;

  const feedbackEntries = useMemo(() => {
    if (!results?.feedback) return [];

    if (typeof results.feedback === 'string') {
      return results.feedback.trim() ? [['overall', results.feedback.trim()]] : [];
    }

    if (typeof results.feedback === 'object' && !Array.isArray(results.feedback)) {
      return Object.entries(results.feedback).filter(([, text]) => {
        if (text == null) return false;
        if (typeof text === 'string') return text.trim().length > 0;
        return true;
      });
    }

    if (Array.isArray(results.feedback)) {
      return results.feedback
        .map((item, i) => [String(i), item])
        .filter(([, text]) => text != null);
    }

    return [];
  }, [results]);

  return (
    <div className="bc-root" data-theme={theme}>
      <header className="bc-header">
        <div className="bc-header-inner">
          <div className="bc-brand">
            <div className="bc-logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <div className="bc-brand-title">BandCheck</div>
              <div className="bc-brand-sub">IELTS Writing Evaluator</div>
            </div>
          </div>
          <button
            className="bc-theme-toggle"
            onClick={() => {
              setTheme(t => {
                const next = t === 'light' ? 'dark' : 'light';
                try { localStorage.setItem('bandcheck-theme', next); } catch (_) {}
                return next;
              });
            }}
            aria-label="Toggle dark mode"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="bc-main">
        <div className="bc-hero">
          <h1>IELTS Writing Essay Checker</h1>
          <div className="bc-author bc-author--hero">
            AUTHOR &mdash; <span className="bc-author-name">NAKIB MAHMUD TANIM</span>
          </div>
          <p>Get an instant band score and AI-powered feedback for IELTS Writing Task 1 and Task 2.</p>
        </div>

        <div className="bc-tabs">
          <button className={`bc-tab${task === 'task2' ? ' active' : ''}`} onClick={() => { setTask('task2'); setResults(null); setError(null); }}>Task 2 (Essay)</button>
          <button className={`bc-tab${task === 'task1' ? ' active' : ''}`} onClick={() => { setTask('task1'); setResults(null); setError(null); }}>Task 1 (Report)</button>
        </div>

        <form className="bc-form" onSubmit={handleEvaluate}>
          <label className="bc-label" htmlFor="topic">{copy.topicLabel}</label>
          <input
            id="topic"
            className="bc-input"
            type="text"
            placeholder={copy.topicPlaceholder}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />

          <div className="bc-essay-head">
            <label className="bc-label" htmlFor="essay" style={{ margin: 0 }}>Your Essay</label>
            <span className={`bc-wordcount${wordOk ? ' ok' : ''}`}>
              {wordCount} words <span className="bc-wordcount-hint">/ min {copy.minWords}</span>
            </span>
          </div>
          <textarea
            id="essay"
            className="bc-textarea"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            placeholder={copy.essayPlaceholder}
            rows={16}
          />
          <button type="submit" className="bc-submit" disabled={loading}>
            {loading ? (
              <><span className="bc-spinner" /> Evaluating&hellip;</>
            ) : (
              'Evaluate Essay'
            )}
          </button>
          {error && <div className="bc-error">{error}</div>}
        </form>

        {results && (
          <section id="results" className="bc-results">
            <h2 className="bc-results-title">Your Band Score</h2>
            <div className="bc-overall">
              <div className="bc-overall-label">Overall Band Score</div>
              <div className="bc-overall-value">
                {overall != null ? overall.toFixed(1) : '—'}
              </div>
              <div className="bc-overall-sub">out of 9.0</div>
            </div>

            <div className="bc-crit-grid">
              {criteria.map(c => (
                <CriterionCard key={c.key} crit={c} value={results.bandScores?.[c.key]} />
              ))}
            </div>

            <div className="bc-feedback">
              <h3>AI Feedback</h3>

              <div style={{ background: 'yellow', color: 'black', padding: 10, marginBottom: 12, borderRadius: 8, fontWeight: 700 }}>
                feedbackEntries: {feedbackEntries.length}
              </div>

              <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', background: 'var(--bg-alt)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                {JSON.stringify(results?.feedback, null, 2)}
              </pre>

              {feedbackEntries.length > 0 ? (
                feedbackEntries.map(([key, text]) => (
                  <div className="bc-feedback-item" key={key}>
                    <div className="bc-feedback-label">
                      {getFeedbackLabel(key, task)}
                    </div>
                    <p>
                      {typeof text === 'string'
                        ? text
                        : JSON.stringify(text, null, 2)}
                    </p>
                  </div>
                ))
              ) : (
                <p style={{ color: 'red', fontWeight: 700 }}>No mapped feedback entries found.</p>
              )}
            </div>

            <div className="bc-stats">
              <div className="bc-stat">
                <div className="bc-stat-value">{results.counts?.words ?? wordCount}</div>
                <div className="bc-stat-label">Words</div>
              </div>
              <div className="bc-stat">
                <div className="bc-stat-value">{results.counts?.sentences ?? sentenceCount}</div>
                <div className="bc-stat-label">Sentences</div>
              </div>
              <div className="bc-stat">
                <div className="bc-stat-value">{results.counts?.paragraphs ?? paragraphCount}</div>
                <div className="bc-stat-label">Paragraphs</div>
              </div>
            </div>

            {results.warnings && (
              <div className="bc-warnings">
                <strong>Note:</strong> Some services returned partial results.
                <ul>
                  {Object.entries(results.warnings).map(([k, v]) => <li key={k}>{k}: {v}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="bc-footer">
        <div className="bc-footer-brand">BandCheck &mdash; IELTS Writing Evaluator</div>
      </footer>
    </div>
  );
}
