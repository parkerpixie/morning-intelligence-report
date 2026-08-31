(() => {
  const nav = document.querySelector('.section-nav-inner');
  const activePage = document.body.dataset.page;
  const isFeelingsPage = activePage === 'feelings';

  const loadUiCleanup = () => {
    if (document.querySelector('link[href^="ui-cleanup.css"]')) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'ui-cleanup.css?v=20260818-1';
    document.head.appendChild(style);
  };

  const loadPersonalizedFeatures = () => {
    if (!document.querySelector('link[href^="personalized-morning.css"]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'personalized-morning.css?v=20260723-1';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[src^="personalized-morning.js"]')) {
      const script = document.createElement('script');
      script.src = 'personalized-morning.js?v=20260723-1';
      script.defer = true;
      document.head.appendChild(script);
    }
  };

  const loadWeatherEnhancements = () => {
    if (!document.getElementById('weather-strip')) return;
    if (document.querySelector('script[src^="weather-enhancements.js"]')) return;
    const script = document.createElement('script');
    script.src = 'weather-enhancements.js?v=20260811-1';
    script.defer = true;
    document.head.appendChild(script);
  };

  const loadFeelingsUiV2 = () => {
    if (!document.querySelector('link[href^="feelings-ui-v2.css"]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'feelings-ui-v2.css?v=20260817-2';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[src^="feelings-ui-v2.js"]')) {
      const script = document.createElement('script');
      script.src = 'feelings-ui-v2.js?v=20260817-2';
      script.defer = true;
      document.head.appendChild(script);
    }
  };

  loadUiCleanup();
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
      : activePage === 'feelings'
        ? 'journal'
        : activePage;

  const items = [
    ['home', 'index.html', 'Home'],
    ['news', 'news.html', 'News'],
    ['capybara', 'capybara.html', 'Capybara'],
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
