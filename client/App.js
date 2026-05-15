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

function getBandColor(value) {
  if (value == null) return 'var(--muted)';
  if (value < 5) return '#e63946';
  if (value < 6) return '#f59e0b';
  if (value < 7) return '#d4a017';
  return '#16a34a';
}

function countWords(text) {
  return (text.match(/\b[\w']+\b/g) || []).length;
}

function countSentences(text) {
  return (
    text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || []
  ).length || (text.trim() ? 1 : 0);
}

function countParagraphs(text) {
  return text.split(/\n\s*\n/).filter((block) => block.trim().length).length || (text.trim() ? 1 : 0);
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

function normalizeFeedback(feedback) {
  if (!feedback) return [];

  if (Array.isArray(feedback)) {
    return feedback
      .map((item, index) => {
        if (typeof item === 'string') return [`feedback-${index}`, item];
        if (item && typeof item === 'object') {
          if (item.label && item.text) return [item.label, item.text];
          if (item.key && item.text) return [item.key, item.text];
          return [`feedback-${index}`, JSON.stringify(item)];
        }
        return [`feedback-${index}`, String(item)];
      })
      .filter(([, text]) => String(text || '').trim());
  }

  if (typeof feedback === 'string') {
    return feedback.trim() ? [['overall', feedback.trim()]] : [];
  }

  if (typeof feedback === 'object') {
    return Object.entries(feedback).filter(([, text]) => String(text || '').trim());
  }

  return [];
}

function CriterionCard({ crit, value }) {
  const progress = value == null ? 0 : Math.max(0, Math.min(100, (value / 9) * 100));
  const color = getBandColor(value);

  return (
    <div className="bc-criterion-card">
      <div className="bc-criterion-head">
        <div className="bc-criterion-name">
          <span className="bc-criterion-short" style={{ background: color }}>
            {crit.short}
          </span>
          <span className="bc-criterion-label">{crit.label}</span>
        </div>
        <span className="bc-criterion-value" style={{ color }}>
          {value != null ? Number(value).toFixed(1) : '—'}
        </span>
      </div>
      <div className="bc-criterion-bar">
        <div
          className="bc-criterion-bar-fill"
          style={{ width: `${progress}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';

    try {
      const savedTheme = localStorage.getItem('bandcheck-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    } catch (_) {}

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [task, setTask] = useState('task2');
  const [topic, setTopic] = useState('');
  const [essay, setEssay] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    try {
      localStorage.setItem('bandcheck-theme', theme);
    } catch (_) {}
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleThemeChange = (event) => {
      try {
        const savedTheme = localStorage.getItem('bandcheck-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') return;
      } catch (_) {}

      setTheme(event.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleThemeChange);
    } else {
      mediaQuery.addListener(handleThemeChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleThemeChange);
      } else {
        mediaQuery.removeListener(handleThemeChange);
      }
    };
  }, []);

  const copy = TASK_COPY[task];
  const wordCount = useMemo(() => countWords(essay), [essay]);
  const sentenceCount = useMemo(() => countSentences(essay), [essay]);
  const paragraphCount = useMemo(() => countParagraphs(essay), [essay]);
  const hasRequiredWords = wordCount >= copy.minWords;
  const criteria = task === 'task1' ? CRITERIA_TASK1 : CRITERIA_TASK2;
  const feedbackEntries = normalizeFeedback(results?.feedback);
  const overall = typeof results?.bandScores?.overall === 'number' ? results.bandScores.overall : null;

  const resetEvaluationState = () => {
    setResults(null);
    setError(null);
  };

  const switchTask = (nextTask) => {
    setTask(nextTask);
    resetEvaluationState();
  };

  const handleEvaluate = async (event) => {
    event.preventDefault();
    resetEvaluationState();

    if (essay.trim().length < 20) {
      setError('Please write at least a few sentences before evaluating.');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    setLoading(true);

    try {
      const response = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, topic, essay }),
        signal: controller.signal,
      });

      let data = {};
      try {
        data = await response.json();
      } catch (_) {
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Evaluation failed');
      }

      setResults(data);

      window.setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err.message || 'Something went wrong.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="bc-root">
      <header className="bc-header">
        <div className="bc-header-inner">
          <div className="bc-brand" aria-label="BandCheck brand">
            <div className="bc-logo-shell">
              <div className="bc-logo-mark" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
            </div>

            <div className="bc-brand-text">
              <div className="bc-brand-title">BandCheck</div>
              <div className="bc-brand-sub">IELTS Writing Evaluator</div>
            </div>
          </div>

          <button
            className="bc-theme-toggle"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            type="button"
          >
            <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>
        </div>
      </header>

      <main className="bc-main">
        <section className="bc-hero">
          <h1 className="bc-hero-title">IELTS Writing Essay Checker</h1>
          <div className="bc-author">
            Author — <span className="bc-author-name">Nakib Mahmud Tanim</span>
          </div>
          <p className="bc-hero-text">
            Get an instant band score and AI-powered feedback for IELTS Writing Task 1 and Task 2.
          </p>
        </section>

        <div className="bc-tabs" role="tablist" aria-label="IELTS writing task selector">
          <button
            role="tab"
            aria-selected={task === 'task2'}
            className={`bc-tab${task === 'task2' ? ' active' : ''}`}
            onClick={() => switchTask('task2')}
            type="button"
          >
            Task 2 (Essay)
          </button>
          <button
            role="tab"
            aria-selected={task === 'task1'}
            className={`bc-tab${task === 'task1' ? ' active' : ''}`}
            onClick={() => switchTask('task1')}
            type="button"
          >
            Task 1 (Report)
          </button>
        </div>

        <form className="bc-form" onSubmit={handleEvaluate}>
          <label className="bc-label" htmlFor="topic">
            {copy.topicLabel}
          </label>
          <input
            id="topic"
            className="bc-input"
            type="text"
            placeholder={copy.topicPlaceholder}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />

          <div className="bc-essay-head">
            <label className="bc-label bc-label--inline" htmlFor="essay">
              Your Essay
            </label>
            <span className={`bc-wordcount${hasRequiredWords ? ' ok' : ''}`}>
              {wordCount} words <span className="bc-wordcount-hint">/ min {copy.minWords}</span>
            </span>
          </div>

          <textarea
            id="essay"
            className="bc-textarea"
            value={essay}
            onChange={(event) => setEssay(event.target.value)}
            placeholder={copy.essayPlaceholder}
            rows={16}
          />

          <button type="submit" className="bc-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="bc-spinner" /> Evaluating…
              </>
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
              <div className="bc-overall-value">{overall != null ? overall.toFixed(1) : '—'}</div>
              <div className="bc-overall-sub">out of 9.0</div>
            </div>

            <div className="bc-criteria-grid">
              {criteria.map((criterion) => {
                const score =
                  results?.bandScores?.[criterion.key] ??
                  results?.bandScores?.taskAchievement ??
                  results?.bandScores?.taskResponse;

                return (
                  <CriterionCard
                    key={`${task}-${criterion.key}-${criterion.label}`}
                    crit={criterion}
                    value={score}
                  />
                );
              })}
            </div>

            {feedbackEntries.length > 0 && (
              <div className="bc-feedback">
                <h3>AI Feedback</h3>
                {feedbackEntries.map(([key, text]) => (
                  <div className="bc-feedback-item" key={key}>
                    <div className="bc-feedback-label">{getFeedbackLabel(key, task)}</div>
                    <p>{typeof text === 'string' ? text : JSON.stringify(text)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bc-stats">
              <div className="bc-stat-card">
                <div className="bc-stat-value">{results.counts?.words ?? wordCount}</div>
                <div className="bc-stat-label">Words</div>
              </div>
              <div className="bc-stat-card">
                <div className="bc-stat-value">{results.counts?.sentences ?? sentenceCount}</div>
                <div className="bc-stat-label">Sentences</div>
              </div>
              <div className="bc-stat-card">
                <div className="bc-stat-value">{results.counts?.paragraphs ?? paragraphCount}</div>
                <div className="bc-stat-label">Paragraphs</div>
              </div>
            </div>

            {Object.keys(results.warnings || {}).length > 0 && (
              <div className="bc-warnings">
                <strong>Note:</strong> Some AI services returned partial results.
                <ul>
                  {Object.entries(results.warnings).map(([service, message]) => (
                    <li key={service}>
                      {service}: {message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="bc-footer">
        <div className="bc-footer-brand">BandCheck — IELTS Writing Evaluator</div>
      </footer>
    </div>
  );
}
