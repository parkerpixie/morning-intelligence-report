(() => {
  const REPORT_URL = 'data/report.json';
  const GENERATE_URL = '/api/generate-report';
  const POLL_INTERVAL_MS = 10000;
  const MAX_POLLS = 30;
  const TAYLOR_CONFETTI_KEY = 'morning-intelligence-report:taylor-dress-confetti';

  let refreshInProgress = false;

  const ensureStyles = () => {
    if (document.getElementById('manual-report-refresh-styles')) return;
    const style = document.createElement('style');
    style.id = 'manual-report-refresh-styles';
    style.textContent = `
      .manual-report-refresh-row{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-top:.45rem}
      .manual-report-refresh-button{appearance:none;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.1);color:inherit;border-radius:999px;padding:.48rem .78rem;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;transition:transform .15s ease,background .15s ease,opacity .15s ease}
      .manual-report-refresh-button:hover{background:rgba(255,255,255,.18);transform:translateY(-1px)}
      .manual-report-refresh-button:disabled{cursor:wait;opacity:.62;transform:none}
      .manual-report-refresh-note{font-size:.78rem;opacity:.8}
      .manual-report-refresh-note[data-tone="success"]{opacity:1;font-weight:700}
      .manual-report-refresh-note[data-tone="error"]{opacity:1;font-weight:700}
      .confetti-layer{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:99999}
      .confetti-piece{position:absolute;top:-12vh;width:10px;height:18px;border-radius:2px;animation:report-confetti-fall var(--fall-time) linear forwards,report-confetti-spin var(--spin-time) ease-in-out infinite;animation-delay:var(--delay)}
      @keyframes report-confetti-fall{to{transform:translate3d(var(--drift),115vh,0) rotate(720deg)}}
      @keyframes report-confetti-spin{50%{border-radius:50%;scale:.65 1.25}}
      @media (prefers-reduced-motion:reduce){.confetti-layer{display:none}.manual-report-refresh-button{transition:none}}
    `;
    document.head.appendChild(style);
  };

  const fetchReport = async () => {
    const response = await fetch(`${REPORT_URL}?manualRefresh=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Report request failed (${response.status}).`);
    return response.json();
  };

  const reportTimestamp = (report) => {
    const value = report?.generated_at ? new Date(report.generated_at).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
  };

  const setNote = (message, tone = 'info') => {
    const note = document.getElementById('manual-report-refresh-note');
    if (!note) return;
    note.textContent = message;
    note.dataset.tone = tone;
  };

  const setButtonState = (button, busy) => {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Generating fresh report…' : 'Generate fresh report';
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  };

  const allReportText = (report) => {
    const stories = [
      report?.top_story,
      ...(Array.isArray(report?.quick_scan) ? report.quick_scan : []),
      ...Object.values(report?.sections || {}).flatMap((stories) => Array.isArray(stories) ? stories : [])
    ].filter(Boolean);
    return stories.map((story) => `${story.headline || ''} ${story.summary || ''}`).join(' ').toLowerCase();
  };

  const shouldCelebrateTaylorDress = (report) => {
    const text = allReportText(report);
    if (!text.includes('taylor swift') || !text.includes('dress')) return false;
    return ['reveal', 'reveals', 'revealed', 'unveil', 'unveils', 'unveiled', 'debut', 'new dress', 'dress drops', 'wears'].some((phrase) => text.includes(phrase));
  };

  const launchConfetti = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ff5ca8', '#8a5cff', '#20c7c7', '#ffd166', '#ffffff', '#7bd389', '#ff8c42'];
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    layer.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < 150; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 38}vw`);
      piece.style.setProperty('--fall-time', `${3.2 + Math.random() * 2.6}s`);
      piece.style.setProperty('--spin-time', `${0.45 + Math.random() * 0.8}s`);
      piece.style.setProperty('--delay', `${Math.random() * 1.2}s`);
      layer.appendChild(piece);
    }

    document.body.appendChild(layer);
    window.setTimeout(() => layer.remove(), 7000);
  };

  const celebrateIfNeeded = (report) => {
    if (!shouldCelebrateTaylorDress(report)) return false;
    const eventKey = report?.generated_at || 'taylor-dress';
    try {
      if (localStorage.getItem(TAYLOR_CONFETTI_KEY) === eventKey) return false;
      localStorage.setItem(TAYLOR_CONFETTI_KEY, eventKey);
    } catch {}
    launchConfetti();
    return true;
  };

  const waitForFreshReport = async (baselineTimestamp) => {
    for (let attempt = 1; attempt <= MAX_POLLS; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      setNote(`Clementine is gathering fresh intelligence… check ${attempt} of ${MAX_POLLS}`);
      try {
        const report = await fetchReport();
        if (reportTimestamp(report) > baselineTimestamp) return report;
      } catch (error) {
        console.warn('Fresh report poll failed; trying again.', error);
      }
    }
    return null;
  };

  const requestFreshReport = async (button) => {
    if (refreshInProgress) return;
    refreshInProgress = true;
    setButtonState(button, true);
    setNote('Clementine is waking the newsroom and asking GitHub for a brand-new edition. ✨');

    try {
      const current = await fetchReport().catch(() => null);
      const baselineTimestamp = reportTimestamp(current);

      const response = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseline_generated_at: current?.generated_at || null })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.code === 'CONFIG_REQUIRED') {
          setNote('One setup step remains: Netlify needs the private GITHUB_REPORT_TOKEN before this button can start GitHub.', 'error');
        } else {
          setNote(result.error || 'The refresh request could not be started. Try again in a moment.', 'error');
        }
        return;
      }

      if (result.already_fresh) {
        setNote('Fresh as heck. A new report was generated less than five minutes ago. ✓', 'success');
        return;
      }

      setNote('Fresh report requested. Now watching for the new edition to land…');
      const freshReport = await waitForFreshReport(baselineTimestamp);
      if (!freshReport) {
        setNote('The generator started, but the new edition has not landed yet. You can leave this page and check again shortly.', 'error');
        return;
      }

      const celebrated = celebrateIfNeeded(freshReport);
      setNote('Fresh report landed! Reloading the new edition… ✓', 'success');
      window.setTimeout(() => window.location.reload(), celebrated ? 5200 : 900);
    } catch (error) {
      console.error('Manual report refresh failed.', error);
      setNote('Something interrupted the refresh request. The current report is still safe on screen.', 'error');
    } finally {
      refreshInProgress = false;
      setButtonState(button, false);
    }
  };

  const installRefreshControl = () => {
    ensureStyles();
    const headerMeta = document.querySelector('.header-meta');
    if (!headerMeta || document.getElementById('manual-report-refresh')) return;

    const row = document.createElement('div');
    row.className = 'manual-report-refresh-row';
    row.id = 'manual-report-refresh';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'manual-report-refresh-button';
    button.textContent = 'Generate fresh report';
    button.addEventListener('click', () => requestFreshReport(button));

    const note = document.createElement('span');
    note.className = 'manual-report-refresh-note';
    note.id = 'manual-report-refresh-note';
    note.textContent = 'On-demand refresh';

    row.append(button, note);
    headerMeta.appendChild(row);
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.report-status-retry');
    if (!button || !/refresh/i.test(button.textContent || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const manualButton = document.querySelector('.manual-report-refresh-button') || button;
    requestFreshReport(manualButton);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installRefreshControl, { once: true });
  } else {
    installRefreshControl();
  }
})();
