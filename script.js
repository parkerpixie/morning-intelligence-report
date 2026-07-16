(() => {
  const LEAD_FALLBACK_IMAGE = 'assets/images/clementine-madison-morning.webp';
  const REPORT_URL = 'data/report.json';
  const REPORT_INDEX_URL = 'data/report-index.json';
  const REPORT_CACHE_KEY = 'morning-intelligence-report:last-successful-report';
  const STATUS_STYLESHEET = 'report-status.css?v=20260716-1';
  const REPORT_TIME_ZONE = 'America/Chicago';
  const FETCH_TIMEOUT_MS = 9000;
  const REQUIRED_SECTIONS = [
    'local',
    'must-know',
    'ai-tech',
    'work-marketing',
    'wellbeing',
    'entertainment',
    'animals',
    'wonderful'
  ];

  let activeReport = null;
  let activeSource = 'current';
  let loadInProgress = false;

  const addStatusStylesheet = () => {
    if (document.querySelector(`link[href^="${STATUS_STYLESHEET.split('?')[0]}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STATUS_STYLESHEET;
    document.head.appendChild(link);
  };

  const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const localDateKey = (value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: REPORT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(value);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  };

  const formatExactUpdated = (value) => {
    const date = new Date(value);
    const todayKey = localDateKey(new Date());
    const dateKey = localDateKey(date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = localDateKey(yesterday);

    const time = date.toLocaleTimeString('en-US', {
      timeZone: REPORT_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    if (dateKey === todayKey) return `Today at ${time}`;
    if (dateKey === yesterdayKey) return `Yesterday at ${time}`;

    const day = date.toLocaleDateString('en-US', {
      timeZone: REPORT_TIME_ZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    return `${day} at ${time}`;
  };

  const formatRelativeAge = (value) => {
    const elapsedMs = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(elapsedMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const setText = (root, selector, value) => {
    const element = root?.querySelector(selector);
    if (element && value) element.textContent = value;
  };

  const setLink = (root, selector, url) => {
    const link = root?.querySelector(selector);
    if (!link) return;

    if (!url) {
      link.hidden = true;
      return;
    }

    link.href = url;
    link.hidden = false;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  };

  const setCompactCardState = (image, isCompact) => {
    const card = image?.closest('.story-card');
    if (!card) return;
    card.classList.toggle('story-card--compact', isCompact);
  };

  const setImage = (root, selector, url, headline, fallback = '') => {
    const image = root?.querySelector(selector);
    if (!image) return;

    const selectedUrl = url || fallback;
    if (!selectedUrl) {
      image.hidden = true;
      setCompactCardState(image, true);
      return;
    }

    image.src = selectedUrl;
    image.alt = headline ? `Photo for: ${headline}` : 'Article photo';
    image.hidden = false;
    image.decoding = 'async';
    if (!fallback) image.loading = 'lazy';
    setCompactCardState(image, false);

    image.addEventListener('error', () => {
      if (fallback && !image.src.includes(fallback)) {
        image.src = fallback;
        image.hidden = false;
        setCompactCardState(image, false);
      } else {
        image.hidden = true;
        setCompactCardState(image, true);
      }
    }, { once: true });
  };

  const fillStory = (root, story, options = {}) => {
    if (!root || !story) return;

    setText(root, '[data-field="source"]', story.source);
    setText(root, '[data-field="headline"]', story.headline);
    setText(root, '[data-field="summary"]', story.summary);
    setLink(root, '[data-field="source-link"]', story.url);
    setImage(
      root,
      '[data-field="image"]',
      story.image,
      story.headline,
      options.requireImage ? LEAD_FALLBACK_IMAGE : ''
    );
  };

  const renderSection = (container, stories) => {
    const template = document.getElementById('story-card-template');
    if (!container || !template) return;

    container.innerHTML = '';

    if (!Array.isArray(stories) || stories.length === 0) {
      const status = document.createElement('p');
      status.className = 'feed-status';
      status.textContent = 'No distinct fresh stories made the cut for this section today.';
      container.appendChild(status);
      return;
    }

    stories.forEach((story) => {
      const fragment = template.content.cloneNode(true);
      fillStory(fragment, story);
      container.appendChild(fragment);
    });
  };

  const renderQuickScan = (stories) => {
    const list = document.getElementById('quick-scan-list');
    if (!list) return;

    list.innerHTML = '';

    if (!Array.isArray(stories) || stories.length === 0) {
      const status = document.createElement('p');
      status.className = 'feed-status';
      status.textContent = 'No quick-scan stories made the cut today.';
      list.appendChild(status);
      return;
    }

    stories.forEach((story) => {
      const link = document.createElement('a');
      link.className = 'quick-item';
      link.href = story.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = '<span class="quick-source"></span><span class="quick-headline"></span><span class="quick-arrow">↗</span>';
      link.querySelector('.quick-source').textContent = story.source || 'News';
      link.querySelector('.quick-headline').textContent = story.headline;
      list.appendChild(link);
    });
  };

  const setStatus = (message, options = {}) => {
    const status = document.getElementById('report-freshness');
    if (!status) return;

    status.hidden = false;
    status.dataset.tone = options.tone || 'info';
    status.replaceChildren();

    if (options.spinner) {
      const spinner = document.createElement('span');
      spinner.className = 'report-status-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      status.appendChild(spinner);
    }

    const messageElement = document.createElement('span');
    messageElement.className = 'report-status-message';
    messageElement.textContent = message;
    status.appendChild(messageElement);

    if (options.retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'report-status-retry';
      button.textContent = options.retryLabel || 'Try again';
      button.addEventListener('click', () => loadReportWithFallbacks({ forceRetry: true }));
      status.appendChild(button);
    }
  };

  const hideStatus = () => {
    const status = document.getElementById('report-freshness');
    if (!status) return;
    status.hidden = true;
    status.replaceChildren();
    delete status.dataset.tone;
  };

  const renderUpdatedTime = (report) => {
    const updated = document.getElementById('report-updated');
    const generated = report?.generated_at ? new Date(report.generated_at) : null;
    if (!updated) return;

    if (!generated || Number.isNaN(generated.getTime())) {
      updated.textContent = 'Last updated time unavailable';
      return;
    }

    const time = document.createElement('time');
    time.dateTime = generated.toISOString();
    time.textContent = formatExactUpdated(report.generated_at);
    time.title = generated.toLocaleString('en-US', { timeZone: REPORT_TIME_ZONE });

    const age = document.createElement('span');
    age.className = 'report-age';
    age.textContent = `• ${formatRelativeAge(report.generated_at)}`;

    updated.replaceChildren(document.createTextNode('Last updated '), time, age);
  };

  const renderFreshness = (report, source = 'current') => {
    const generated = report?.generated_at ? new Date(report.generated_at) : null;
    renderUpdatedTime(report);

    if (!generated || Number.isNaN(generated.getTime())) {
      setStatus('The report loaded, but its refresh timestamp is missing.', { tone: 'warning' });
      return;
    }

    const ageHours = Math.max(0, (Date.now() - generated.getTime()) / 36e5);
    const exact = formatExactUpdated(report.generated_at);
    const isToday = localDateKey(generated) === localDateKey(new Date());

    if (source === 'archive') {
      setStatus(`The live report file did not answer. Showing the latest completed archive from ${exact}.`, {
        tone: 'warning',
        retry: true,
        retryLabel: 'Check again'
      });
      return;
    }

    if (source === 'browser') {
      const message = navigator.onLine
        ? `The report files could not be reached. Showing the last copy saved on this device from ${exact}.`
        : `You are offline. Showing the last report saved on this device from ${exact}.`;
      setStatus(message, {
        tone: 'warning',
        retry: navigator.onLine,
        retryLabel: 'Check again'
      });
      return;
    }

    if (!isToday || ageHours > 6) {
      setStatus(`Today’s refresh is delayed. You are seeing the most recent completed report from ${exact}.`, {
        tone: 'warning',
        retry: true,
        retryLabel: 'Refresh'
      });
      return;
    }

    if (ageHours > 2) {
      setStatus(`This morning’s report was refreshed ${formatRelativeAge(report.generated_at)} and is still the latest completed edition.`, {
        tone: 'info'
      });
      return;
    }

    hideStatus();
  };

  const renderReportMeta = (report, source = 'current') => {
    document.querySelectorAll('.report-date').forEach((date) => {
      if (!report.report_date) return;
      date.dateTime = report.report_date;
      date.textContent = formatDate(report.report_date);
    });
    renderFreshness(report, source);
  };

  const renderReport = (report, source = 'current') => {
    activeReport = report;
    activeSource = source;
    renderReportMeta(report, source);

    const lead = document.getElementById('lead-story');
    if (lead) {
      lead.classList.remove('is-loading');
      fillStory(lead, report.top_story, { requireImage: true });
    }

    renderQuickScan(report.quick_scan);

    document.querySelectorAll('[data-feed]').forEach((container) => {
      const sectionName = container.dataset.feed;
      renderSection(container, report.sections?.[sectionName] || []);
    });

    const capybaraMessage = document.getElementById('capybara-message');
    setText(capybaraMessage, '[data-field="message"]', report.capybara_message);

    document.body.dataset.reportSource = source;
    document.body.dataset.reportState = 'ready';
    document.querySelector('main')?.setAttribute('aria-busy', 'false');
  };

  const renderLoadingState = () => {
    document.body.dataset.reportState = 'loading';
    document.querySelector('main')?.setAttribute('aria-busy', 'true');

    const updated = document.getElementById('report-updated');
    if (updated) updated.textContent = 'Loading the latest completed report…';
    setStatus('Checking today’s report and its backup copies.', { tone: 'loading', spinner: true });

    const lead = document.getElementById('lead-story');
    if (lead) {
      lead.classList.add('is-loading');
      setText(lead, '[data-field="source"]', 'Gathering today’s signals');
      setText(lead, '[data-field="headline"]', 'Building your morning briefing…');
      setText(lead, '[data-field="summary"]', 'Checking the newest completed report before we hand you the headlines.');
      setLink(lead, '[data-field="source-link"]', '');
    }

    const quickScan = document.getElementById('quick-scan-list');
    if (quickScan) {
      quickScan.innerHTML = '';
      for (let index = 0; index < 4; index += 1) {
        const item = document.createElement('div');
        item.className = 'report-skeleton';
        item.setAttribute('aria-hidden', 'true');
        quickScan.appendChild(item);
      }
    }

    document.querySelectorAll('[data-feed]').forEach((container) => {
      container.innerHTML = '';
      for (let index = 0; index < 4; index += 1) {
        const card = document.createElement('div');
        card.className = 'report-skeleton-card';
        card.setAttribute('aria-hidden', 'true');
        container.appendChild(card);
      }
    });

    const capybaraMessage = document.getElementById('capybara-message');
    setText(capybaraMessage, '[data-field="message"]', 'Clementine is checking the morning paperwork.');
  };

  const setActiveNavigation = () => {
    const currentPage = document.body.dataset.page || 'home';
    document.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.dataset.nav === currentPage) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const isNonemptyString = (value) => typeof value === 'string' && value.trim().length > 0;

  const isValidStory = (story) => (
    story
    && typeof story === 'object'
    && isNonemptyString(story.source)
    && isNonemptyString(story.headline)
    && isNonemptyString(story.summary)
    && isNonemptyString(story.url)
  );

  const isValidReport = (report) => {
    if (!report || typeof report !== 'object') return false;
    if (!isNonemptyString(report.generated_at) || Number.isNaN(new Date(report.generated_at).getTime())) return false;
    if (!isNonemptyString(report.report_date)) return false;
    if (!isValidStory(report.top_story)) return false;
    if (!Array.isArray(report.quick_scan) || report.quick_scan.length === 0 || !report.quick_scan.every(isValidStory)) return false;
    if (!report.sections || typeof report.sections !== 'object') return false;
    if (!REQUIRED_SECTIONS.every((section) => Array.isArray(report.sections[section]))) return false;
    if (!REQUIRED_SECTIONS.every((section) => report.sections[section].every(isValidStory))) return false;
    return isNonemptyString(report.capybara_message);
  };

  const fetchJson = async (url) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const separator = url.includes('?') ? '&' : '?';

    try {
      const response = await fetch(`${url}${separator}cache=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Report request failed for ${url}: ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  };

  const loadPrimaryReport = async () => {
    const report = await fetchJson(REPORT_URL);
    if (!isValidReport(report)) throw new Error('The current report file failed browser validation.');
    return report;
  };

  const loadArchivedReport = async () => {
    const index = await fetchJson(REPORT_INDEX_URL);
    if (!isNonemptyString(index?.latest)) throw new Error('The report archive index is missing its latest path.');
    const report = await fetchJson(index.latest);
    if (!isValidReport(report)) throw new Error('The archived report failed browser validation.');
    return report;
  };

  const saveCachedReport = (report) => {
    try {
      localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(report));
    } catch (error) {
      console.warn('The report loaded, but this browser would not save a local fallback.', error);
    }
  };

  const loadCachedReport = () => {
    try {
      const cached = localStorage.getItem(REPORT_CACHE_KEY);
      if (!cached) return null;
      const report = JSON.parse(cached);
      return isValidReport(report) ? report : null;
    } catch (error) {
      console.warn('The saved browser report could not be read.', error);
      return null;
    }
  };

  const showLoadError = (error) => {
    console.error(error);
    activeReport = null;
    activeSource = 'unavailable';
    document.body.dataset.reportSource = 'unavailable';
    document.body.dataset.reportState = 'error';
    document.querySelector('main')?.setAttribute('aria-busy', 'false');

    const lead = document.getElementById('lead-story');
    if (lead) {
      lead.classList.remove('is-loading');
      setText(lead, '[data-field="source"]', 'Report unavailable');
      setText(lead, '[data-field="headline"]', 'The morning report could not be reached.');
      setText(lead, '[data-field="summary"]', 'The page itself is working, but no current, archived, or device-saved report was available.');
      setImage(lead, '[data-field="image"]', '', 'Morning Intelligence Report', LEAD_FALLBACK_IMAGE);
      setLink(lead, '[data-field="source-link"]', '');
    }

    const updated = document.getElementById('report-updated');
    if (updated) updated.textContent = 'Last completed refresh unavailable';

    const offlineMessage = navigator.onLine
      ? 'None of the report sources answered. Try again now, or return after the next scheduled refresh.'
      : 'You are offline and this device does not have a saved report yet.';
    setStatus(offlineMessage, {
      tone: 'error',
      retry: navigator.onLine,
      retryLabel: 'Try again'
    });
  };

  const loadReportWithFallbacks = async () => {
    if (loadInProgress) return;
    loadInProgress = true;
    renderLoadingState();

    try {
      try {
        const report = await loadPrimaryReport();
        renderReport(report, 'current');
        saveCachedReport(report);
        return;
      } catch (primaryError) {
        console.warn('The current report could not be used.', primaryError);
      }

      try {
        const report = await loadArchivedReport();
        renderReport(report, 'archive');
        saveCachedReport(report);
        return;
      } catch (archiveError) {
        console.warn('The archived report could not be used.', archiveError);
      }

      const cachedReport = loadCachedReport();
      if (cachedReport) {
        renderReport(cachedReport, 'browser');
        return;
      }

      showLoadError(new Error('All report sources failed.'));
    } finally {
      loadInProgress = false;
    }
  };

  const refreshVisibleTimestamp = () => {
    if (activeReport) renderFreshness(activeReport, activeSource);
  };

  window.addEventListener('offline', () => {
    if (activeReport) {
      setStatus(`You are offline. The report currently on screen was saved ${formatRelativeAge(activeReport.generated_at)}.`, {
        tone: 'warning'
      });
    }
  });

  window.addEventListener('online', () => {
    if (activeSource === 'browser' || activeSource === 'unavailable') {
      setStatus('Your connection is back. Check for the newest completed report.', {
        tone: 'info',
        retry: true,
        retryLabel: 'Check now'
      });
    } else if (activeReport) {
      renderFreshness(activeReport, activeSource);
    }
  });

  addStatusStylesheet();
  setActiveNavigation();
  loadReportWithFallbacks();
  window.setInterval(refreshVisibleTimestamp, 60000);
})();
