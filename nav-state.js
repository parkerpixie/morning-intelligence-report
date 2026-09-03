(() => {
  const nav = document.querySelector('.section-nav-inner');
  const activePage = document.body.dataset.page;
  const isFeelingsPage = activePage === 'feelings';

  const ensureStylesheet = (href) => {
    if (document.querySelector(`link[href^="${href.split('?')[0]}"]`)) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = href;
    document.head.appendChild(style);
  };

  const ensureScript = (src) => {
    const base = src.split('?')[0];
    if (document.querySelector(`script[src^="${base}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  };

  const loadUiCleanup = () => ensureStylesheet('ui-cleanup.css?v=20260818-1');
  const loadAppNav = () => ensureStylesheet('app-nav.css?v=20260830-1');

  const loadPersonalizedFeatures = () => {
    ensureStylesheet('personalized-morning.css?v=20260723-1');
    ensureScript('personalized-morning.js?v=20260723-1');
  };

  const loadWeatherEnhancements = () => {
    if (!document.getElementById('weather-strip')) return;
    ensureScript('weather-enhancements.js?v=20260811-1');
  };

  const loadFeelingsUiV2 = () => {
    ensureStylesheet('feelings-ui-v2.css?v=20260817-2');
    ensureScript('feelings-ui-v2.js?v=20260817-2');
  };

  const loadPersonalHistory = () => {
    if (!['capybara','feelings','journal'].includes(activePage)) return;
    ensureScript('feelings-core.js?v=20260903-1');
    ensureScript('wellbeing-sync.js?v=20260903-1');
    if (activePage === 'capybara') {
      ensureStylesheet('morning-feelings.css?v=20260903-1');
      ensureScript('morning-feelings.js?v=20260903-1');
    }
    if (activePage === 'feelings') ensureScript('feelings-practice.js?v=20260903-1');
  };

  const loadDateAndRefreshHelpers = () => {
    ensureScript('today-date.js?v=20260831-1');
    if (document.getElementById('report-updated')) ensureScript('report-refresh.js?v=20260831-1');
  };

  loadUiCleanup();
  loadAppNav();
  loadDateAndRefreshHelpers();
  loadPersonalHistory();
  if (isFeelingsPage) loadFeelingsUiV2();
  else {
    loadPersonalizedFeatures();
    loadWeatherEnhancements();
  }

  if (!nav) return;

  const newsPages = new Set(['news','big-story','quick-scan','local','must-know','ai-tech','work-marketing','wellbeing','entertainment','animals','wonderful']);
  const activeNav = newsPages.has(activePage)
    ? 'news'
    : activePage === 'archive'
      ? 'library'
      : activePage;

  const items = [
    ['home', 'index.html', 'Home'],
    ['news', 'news.html', 'News'],
    ['capybara', 'capybara.html', 'Capybara'],
    ['feelings', 'feelings.html', 'Feelings'],
    ['journal', 'journal.html', 'Journal'],
    ['library', 'archive.html', 'Library']
  ];

  nav.replaceChildren(...items.map(([key, href, label]) => {
    const link = document.createElement('a');
    link.href = href;
    link.dataset.nav = key;
    link.textContent = label;
    if (key === activeNav) link.setAttribute('aria-current', 'page');
    return link;
  }));
})();
