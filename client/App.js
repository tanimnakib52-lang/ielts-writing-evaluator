import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_URL || '/api';

const TASK_COPY = {
  task2: {
    label: 'Task 2',
    minWords: 250,
    topicLabel: 'Essay Question / Topic',
    topicPlaceholder:
      'e.g., Some people think that universities should provide free education. To what extent do you agree or disagree?',
    essayPlaceholder:
      'Paste or type your IELTS Task 2 essay here. Aim for at least 250 words across an introduction, two body paragraphs and a conclusion.',
  },
  task1: {
    label: 'Task 1',
    minWords: 150,
    topicLabel: 'Chart / Diagram Description',
    topicPlaceholder:
      'e.g., The graph below shows the percentage of households in different income brackets in three countries between 2000 and 2020.',
    essayPlaceholder:
      'Paste or type your IELTS Task 1 report here. Aim for at least 150 words summarising the main features of the chart, graph, or diagram.',
  },
};

const CRITERIA_TASK2 = [
  { key: 'taskResponse',      short: 'TR',  label: 'Task Response' },
  { key: 'coherenceCohesion', short: 'CC',  label: 'Coherence & Cohesion' },
  { key: 'lexicalResource',   short: 'LR',  label: 'Lexical Resource' },
  { key: 'grammaticalRange',  short: 'GRA', label: 'Grammatical Range & Accuracy' },
];

const CRITERIA_TASK1 = [
  { key: 'taskAchievement',   short: 'TA',  label: 'Task Achievement' },
  { key: 'coherenceCohesion', short: 'CC',  label: 'Coherence & Cohesion' },
  { key: 'lexicalResource',   short: 'LR',  label: 'Lexical Resource' },
  { key: 'grammaticalRange',  short: 'GRA', label: 'Grammatical Range & Accuracy' },
];

function bandColor(v) {
  if (v == null) return 'var(--muted)';
  if (v < 5) return '#e63946';
  if (v < 6) return '#f59e0b';
  if (v < 7) return '#d4a017';
  return '#16a34a';
}

function countWords(text) {
  return (text.match(/[\p{L}\p{N}']+/gu) || []).length;
}

function countSentences(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 0;
  const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g);
  return sentences ? sentences.length : 1;
}

function countParagraphs(text) {
  return text.split(/\n\s*\n/).filter((p) => p.trim().length).length || (text.trim() ? 1 : 0);
}

function getFeedbackLabel(key, task) {
  if (key === 'taskResponse')      return task === 'task1' ? 'Task Achievement' : 'Task Response';
  if (key === 'taskAchievement')   return 'Task Achievement';
  if (key === 'coherenceCohesion') return 'Coherence & Cohesion';
  if (key === 'lexicalResource')   return 'Lexical Resource';
  if (key === 'grammaticalRange')  return 'Grammatical Range & Accuracy';
  if (key === 'overall')           return 'Overall Feedback';
  return key;
}

function SafeText({ value }) {
  if (value == null) return null;
  if (typeof value === 'string') return <p>{value}</p>;
  if (Array.isArray(value)) {
    return (
      <ul>
        {value.map((item, i) => (
          <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <p style={{ fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(value, null, 2)}
      </p>
    );
  }
  return <p>{String(value)}</p>;
}

function CriterionCard({ crit, value }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 9) * 100));
  const color = bandColor(value);

  return (
    <div className="crit-card">
      <div className="crit-head">
        <div className="crit-name">
          <span className="crit-short" style={{ background: color }}>
            {crit.short}
          </span>
          <span className="crit-label">{crit.label}</span>
        </div>
        <div className="crit-value" style={{ color }}>
          {value != null ? Number(value).toFixed(1) : '—'}
        </div>
      </div>
      <div className="crit-bar">
        <div
          className="crit-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = localStorage.getItem('bandcheck-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [task,    setTask]    = useState('task2');
  const [topic,   setTopic]   = useState('');
  const [essay,   setEssay]   = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('bandcheck-theme', theme); } catch (_) {}
  }, [theme]);

  const copy          = TASK_COPY[task];
  const wordCount     = useMemo(() => countWords(essay),      [essay]);
  const sentenceCount = useMemo(() => countSentences(essay),  [essay]);
  const paragraphCount= useMemo(() => countParagraphs(essay), [essay]);
  const wordOk        = wordCount >= copy.minWords;

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, topic, essay }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let data = {};
      try { data = await res.json(); }
      catch { throw new Error('Invalid server response — could not parse JSON'); }

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Evaluation failed');
      }

      setResults(data);

      setTimeout(() => {
        const el = document.getElementById('results');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const overall  = typeof results?.bandScores?.overall === 'number' ? results.bandScores.overall : null;
  const criteria = task === 'task1' ? CRITERIA_TASK1 : CRITERIA_TASK2;

  const feedbackEntries = useMemo(() => {
    if (!results?.feedback) return [];
    if (typeof results.feedback === 'string') {
      const trimmed = results.feedback.trim();
      return trimmed ? [['overall', trimmed]] : [];
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
    <div className="bc-root">

      {/* ── HEADER ── */}
      <header className="bc-header">
        <div className="bc-header-inner">

          {/* Logo: icon square + text column, side by side */}
          <div className="bc-brand">
            <div className="bc-logo" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor">
                <rect x="2"  y="14" width="4" height="14" rx="1.5" />
                <rect x="9"  y="8"  width="4" height="20" rx="1.5" />
                <rect x="16" y="2"  width="4" height="26" rx="1.5" />
                <rect x="23" y="10" width="4" height="18" rx="1.5" />
              </svg>
            </div>
            <div className="bc-brand-text">
              <div className="bc-brand-title">BandCheck</div>
              <div className="bc-brand-sub">IELTS Writing Evaluator</div>
            </div>
          </div>

          {/* Theme toggle — pinned to the right via margin-left: auto in CSS */}
          <button
            className="bc-theme-toggle"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle dark mode"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="bc-main">

        <section className="bc-hero">
          <div className="bc-hero-badge">AI-Powered Feedback</div>
          <h1>IELTS Writing Essay Checker</h1>
          <p>
            Get an instant band score and AI-powered feedback for IELTS Writing
            Task 1 and Task 2.
          </p>
        </section>

        <div className="bc-card">
          <div className="bc-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={task === 'task2'}
              className={`bc-tab${task === 'task2' ? ' active' : ''}`}
              onClick={() => { setTask('task2'); setResults(null); setError(null); }}
            >
              <span className="bc-tab-title">Task 2 (Essay)</span>
              <span className="bc-tab-sub">250 words minimum</span>
            </button>
            <button
              role="tab"
              aria-selected={task === 'task1'}
              className={`bc-tab${task === 'task1' ? ' active' : ''}`}
              onClick={() => { setTask('task1'); setResults(null); setError(null); }}
            >
              <span className="bc-tab-title">Task 1 (Report)</span>
              <span className="bc-tab-sub">150 words minimum</span>
            </button>
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
              <label className="bc-label" htmlFor="essay">Your Essay</label>
              <span className={`bc-wordcount${wordOk ? ' ok' : ''}`}>
                <span className="bc-wordcount-dot" />
                {wordCount} / min {copy.minWords} words
              </span>
            </div>

            <div className="bc-progress">
              <div
                className={`bc-progress-fill${wordOk ? ' ok' : ''}`}
                style={{ width: `${Math.min(100, (wordCount / copy.minWords) * 100)}%` }}
              />
            </div>

            <textarea
              id="essay"
              className="bc-textarea"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder={copy.essayPlaceholder}
              rows={14}
            />

            <div className="bc-form-footer">
              <div className="bc-mini-stats">
                <span>{sentenceCount} sentences</span>
                <span className="dot">·</span>
                <span>{paragraphCount} paragraphs</span>
              </div>
              <button type="submit" className="bc-submit" disabled={loading}>
                {loading ? (
                  <><span className="bc-spinner" /> Evaluating…</>
                ) : (
                  <>Evaluate Essay <span className="bc-arrow">→</span></>
                )}
              </button>
            </div>

            {error && <div className="bc-error">{error}</div>}
          </form>
        </div>

        {/* ── RESULTS ── */}
        {results && (
          <section id="results" className="bc-results">
            <h2 className="bc-results-title">Your Band Score</h2>

            <div className="bc-overall-card">
              <div>
                <div className="bc-overall-label">Overall Band Score</div>
                <div
                  className="bc-overall-value"
                  style={{ color: bandColor(overall) }}
                >
                  {overall != null ? overall.toFixed(1) : '—'}
                </div>
                <div className="bc-overall-sub">out of 9.0</div>
              </div>
            </div>

            <div className="bc-crit-grid">
              {criteria.map((c) => (
                <CriterionCard
                  key={`${task}-${c.key}`}
                  crit={c}
                  value={results?.bandScores?.[c.key] ?? null}
                />
              ))}
            </div>

            {feedbackEntries.length > 0 ? (
              <div className="bc-feedback">
                <h3>AI Feedback</h3>
                {feedbackEntries.map(([key, text]) => (
                  <div className="bc-feedback-item" key={key}>
                    <div className="bc-feedback-label">
                      {getFeedbackLabel(key, task)}
                    </div>
                    <SafeText value={text} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bc-feedback">
                <h3>AI Feedback</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  No detailed feedback was returned. Try submitting a longer essay.
                </p>
              </div>
            )}

            <div className="bc-stats">
              <div className="bc-stat">
                <div className="bc-stat-value">{wordCount}</div>
                <div className="bc-stat-label">Words</div>
              </div>
              <div className="bc-stat">
                <div className="bc-stat-value">{sentenceCount}</div>
                <div className="bc-stat-label">Sentences</div>
              </div>
              <div className="bc-stat">
                <div className="bc-stat-value">{paragraphCount}</div>
                <div className="bc-stat-label">Paragraphs</div>
              </div>
            </div>

            {results.warnings && Object.keys(results.warnings).length > 0 && (
              <div className="bc-warnings">
                <strong>Note:</strong> Some AI services returned partial results.
                <ul>
                  {Object.entries(results.warnings).map(([k, v]) => (
                    <li key={k}>{k}: {v}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="bc-footer">
        <p>BandCheck — IELTS Writing Evaluator</p>
      </footer>
    </div>
  );
}
