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
  { key: 'taskResponse',       short: 'TR',  label: 'Task Response' },
  { key: 'coherenceCohesion',  short: 'CC',  label: 'Coherence & Cohesion' },
  { key: 'lexicalResource',    short: 'LR',  label: 'Lexical Resource' },
  { key: 'grammaticalRange',   short: 'GRA', label: 'Grammatical Range & Accuracy' },
];
const CRITERIA_TASK1 = [
  { key: 'taskAchievement',    short: 'TA',  label: 'Task Achievement' },
  { key: 'coherenceCohesion',  short: 'CC',  label: 'Coherence & Cohesion' },
  { key: 'lexicalResource',    short: 'LR',  label: 'Lexical Resource' },
  { key: 'grammaticalRange',   short: 'GRA', label: 'Grammatical Range & Accuracy' },
];

function bandColor(v) {
  if (v == null) return 'var(--muted)';
  if (v < 5)  return '#e63946';
  if (v < 6)  return '#f59e0b';
  if (v < 7)  return '#d4a017';
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

function CriterionCard({ crit, value }) {
  const pct   = value == null ? 0 : Math.max(0, Math.min(100, (value / 9) * 100));
  const color = bandColor(value);
  return (
    <div className="crit-card">
      <div className="crit-head">
        <div className="crit-name">
          <span className="crit-short">{crit.short}</span>
          {crit.label}
        </div>
        <div className="crit-score" style={{ color }}>
          {value != null ? value.toFixed(1) : '\u2014'}
        </div>
      </div>
      <div className="crit-bar">
        <div className="crit-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const FEEDBACK_LABELS = {
  taskResponse:     'Task Response',
  taskAchievement:  'Task Achievement',
  coherenceCohesion:'Coherence & Cohesion',
  lexicalResource:  'Lexical Resource',
  grammaticalRange: 'Grammatical Range & Accuracy',
  overall:          'Overall Feedback',
};

// ── Standalone SVG logo mark ──────────────────────────────────────────────────
// Renders the teal rounded-square with a white checkmark exactly as intended,
// with no dependency on emoji rendering or Unicode glyph availability.
function LogoMark({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, borderRadius: 10, display: 'block' }}
    >
      {/* teal background */}
      <rect width="40" height="40" rx="10" fill="#2a9d8f" />
      {/* white checkmark */}
      <polyline
        points="10,21 17,28 30,13"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('bandcheck-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [task,    setTask]    = useState('task2');
  const [topic,   setTopic]   = useState('');
  const [essay,   setEssay]   = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

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
    if (mq.addEventListener)    mq.addEventListener('change', handler);
    else if (mq.addListener)    mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const copy          = TASK_COPY[task];
  const wordCount     = useMemo(() => countWords(essay),     [essay]);
  const sentenceCount = useMemo(() => countSentences(essay), [essay]);
  const paragraphCount= useMemo(() => countParagraphs(essay),[essay]);

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
      const res  = await fetch(`${API}/evaluate`, {
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

  const overall  = results?.bandScores?.overall;
  const criteria = task === 'task1' ? CRITERIA_TASK1 : CRITERIA_TASK2;

  const feedbackEntries = useMemo(() => {
    if (!results?.feedback) return [];
    if (typeof results.feedback === 'string') {
      return [['overall', results.feedback]];
    }
    if (typeof results.feedback === 'object' && !Array.isArray(results.feedback)) {
      return Object.entries(results.feedback).filter(([, text]) => text && String(text).trim().length > 0);
    }
    if (Array.isArray(results.feedback)) {
      return results.feedback.map((f, i) => [String(i), String(f)]);
    }
    return [];
  }, [results]);

  return (
    <div className="bc-app">
      <header className="bc-header">
        {/* ── Logo ── */}
        <div className="bc-logo">
          <LogoMark size={40} />
          <div>
            <div className="bc-logo-name">BandCheck</div>
            <div className="bc-logo-sub">IELTS Writing Evaluator</div>
          </div>
        </div>

        {/* ── Dark-mode toggle ── */}
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
      </header>

      <main className="bc-main">
        <div className="bc-hero">
          <h1 className="bc-hero-title">IELTS Writing Essay Checker</h1>
          <p className="bc-hero-author">AUTHOR &mdash; <strong>NAKIB MAHMUD TANIM</strong></p>
          <p className="bc-hero-sub">Get an instant band score and AI-powered feedback for IELTS Writing Task 1 and Task 2.</p>
        </div>

        <form className="bc-form" onSubmit={handleEvaluate}>
          <div className="bc-task-tabs">
            <button type="button" className={`bc-task-tab${task === 'task2' ? ' active' : ''}`} onClick={() => setTask('task2')}>Task 2 (Essay)</button>
            <button type="button" className={`bc-task-tab${task === 'task1' ? ' active' : ''}`} onClick={() => setTask('task1')}>Task 1 (Report)</button>
          </div>

          <div className="bc-field">
            <label className="bc-label" htmlFor="topic">{copy.topicLabel}</label>
            <input
              id="topic"
              className="bc-input"
              type="text"
              placeholder={copy.topicPlaceholder}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="bc-field">
            <label className="bc-label" htmlFor="essay">
              Your Essay &nbsp;<span className="bc-wc">{wordCount} words</span>&nbsp;/ min {copy.minWords}
            </label>
            <textarea
              id="essay"
              className="bc-textarea"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder={copy.essayPlaceholder}
              rows={16}
            />
          </div>

          <button type="submit" className="bc-submit" disabled={loading}>
            {loading ? (<><span className="bc-spinner" /> Evaluating&hellip;</>) : ('Evaluate Essay')}
          </button>
          {error && <div className="bc-error">{error}</div>}
        </form>

        {results && (
          <section id="results" className="bc-results">
            <h2 className="bc-results-title">Your Band Score</h2>
            <div className="bc-overall">
              <div className="bc-overall-label">Overall Band Score</div>
              <div className="bc-overall-value">
                {overall != null ? overall.toFixed(1) : '\u2014'}
              </div>
              <div className="bc-overall-sub">out of 9.0</div>
            </div>

            <div className="bc-crit-grid">
              {criteria.map(c => (
                <CriterionCard key={c.key} crit={c} value={results.bandScores?.[c.key] ?? null} />
              ))}
            </div>

            {feedbackEntries.length > 0 && (
              <div className="bc-feedback">
                <h3>AI Feedback</h3>
                <ul>
                  {feedbackEntries.map(([key, text]) => (
                    <li key={key}>
                      <strong>{FEEDBACK_LABELS[key] || key}:</strong>{' '}
                      {typeof text === 'string' ? text : JSON.stringify(text)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bc-stats">
              <div className="bc-stat">
                <div className="bc-stat-value">{results.counts?.words     ?? wordCount}</div>
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
