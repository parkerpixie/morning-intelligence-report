(() => {
  const NAV_SCROLL_KEY = 'morning-intelligence-report:section-nav-scroll';
  const nav = document.querySelector('.section-nav-inner');
  const activePage = document.body.dataset.page;
  const isFeelingsPage = activePage === 'feelings';

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

  const loadReportRefresh = () => {
    if (document.querySelector('script[src^="report-refresh.js"]')) return;
    const script = document.createElement('script');
    script.src = 'report-refresh.js?v=20260816-1';
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

  if (isFeelingsPage) {
    loadFeelingsUiV2();
  } else {
    loadPersonalizedFeatures();
    loadWeatherEnhancements();
    loadReportRefresh();
  }

  if (!nav) return;

  let feelingsLink = nav.querySelector('[data-nav="feelings"]');
  if (!feelingsLink) {
    feelingsLink = document.createElement('a');
    feelingsLink.href = 'feelings.html';
    feelingsLink.dataset.nav = 'feelings';
    feelingsLink.textContent = 'Feelings';
    const archive = nav.querySelector('[data-nav="archive"]');
    if (archive) archive.before(feelingsLink);
    else nav.appendChild(feelingsLink);
  }

  const capybaraLink = nav.querySelector('[data-nav="capybara"]');
  const bigStoryLink = nav.querySelector('[data-nav="big-story"]');
  const archiveLink = nav.querySelector('[data-nav="archive"]');

  if (capybaraLink && bigStoryLink) bigStoryLink.after(capybaraLink);
  if (archiveLink) nav.appendChild(archiveLink);

  const activeLink = activePage ? nav.querySelector(`[data-nav="${activePage}"]`) : null;

  try {
    const savedScroll = Number(localStorage.getItem(NAV_SCROLL_KEY));
    if (Number.isFinite(savedScroll)) nav.scrollLeft = savedScroll;

    requestAnimationFrame(() => {
      if (!activeLink) return;
      const start = activeLink.offsetLeft;
      const end = start + activeLink.offsetWidth;
      if (start < nav.scrollLeft || end > nav.scrollLeft + nav.clientWidth) {
        activeLink.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    });
  } catch (error) {
    console.warn('Navigation position could not be restored.', error);
  }

  const savePosition = () => {
    try {
      localStorage.setItem(NAV_SCROLL_KEY, String(nav.scrollLeft));
    } catch (error) {
      console.warn('Navigation position could not be saved.', error);
    }
  };

  nav.addEventListener('scroll', savePosition, { passive: true });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', savePosition));
  window.addEventListener('pagehide', savePosition);
})();
