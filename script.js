(() => {
  const LEAD_FALLBACK_IMAGE = 'assets/images/clementine-madison-morning.webp';
  const REPORT_URL = 'data/report.json';
  const REPORT_INDEX_URL = 'data/report-index.json';
  const REPORT_CACHE_KEY = 'morning-intelligence-report:last-successful-report';
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

  const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const formatUpdated = (value) => new Date(value).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

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
      status.textContent = 'The quick scan is still gathering today’s strongest signals.';
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

  const renderFreshness = (report) => {
    const updated = document.getElementById('report-updated');
    const status = document.getElementById('report-freshness');
    const generated = report?.generated_at ? new Date(report.generated_at) : null;

    if (!generated || Number.isNaN(generated.getTime())) {
      if (updated) updated.textContent = 'Refresh time unavailable';
      if (status) {
        status.hidden = false;
        status.textContent = 'The page loaded, but the refresh timestamp is missing.';
      }
      return;
    }

    if (updated) updated.textContent = `Updated ${formatUpdated(report.generated_at)}`;

    const ageHours = (Date.now() - generated.getTime()) / 36e5;
    if (!status) return;

    if (ageHours > 6) {
      status.hidden = false;
      status.textContent = 'Today’s refresh is running late. Showing the most recent report.';
    } else {
      status.hidden = true;
      status.textContent = '';
    }
  };

  const renderReportMeta = (report) => {
    const dates = document.querySelectorAll('.report-date');
    dates.forEach((date) => {
      if (!report.report_date) return;
      date.dateTime = report.report_date;
      date.textContent = formatDate(report.report_date);
    });
    renderFreshness(report);
  };

  const renderReport = (report) => {
    renderReportMeta(report);

    const lead = document.getElementById('lead-story');
    if (lead) fillStory(lead, report.top_story, { requireImage: true });

    renderQuickScan(report.quick_scan);

    document.querySelectorAll('[data-feed]').forEach((container) => {
      const sectionName = container.dataset.feed;
      renderSection(container, report.sections?.[sectionName] || []);
    });

    const capybaraMessage = document.getElementById('capybara-message');
    setText(capybaraMessage, '[data-field="message"]', report.capybara_message);
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
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}cache=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Report request failed for ${url}: ${response.status}`);
    return response.json();
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

  const showFallbackNotice = (source) => {
    const status = document.getElementById('report-freshness');
    if (!status) return;

    status.hidden = false;
    if (source === 'archive') {
      status.textContent = 'The current report file was unavailable. Showing the most recent completed archive.';
    } else if (source === 'browser') {
      status.textContent = 'The report files could not be reached. Showing the last report saved on this device.';
    }
  };

  const showLoadError = (error) => {
    console.error(error);
    const lead = document.getElementById('lead-story');
    setText(lead, '[data-field="headline"]', 'The report data did not load this time.');
    setText(lead, '[data-field="summary"]', 'The page is working, but no current, archived, or saved report could be retrieved.');
    setImage(lead, '[data-field="image"]', '', 'Morning Intelligence Report', LEAD_FALLBACK_IMAGE);

    const updated = document.getElementById('report-updated');
    const status = document.getElementById('report-freshness');
    if (updated) updated.textContent = 'Latest refresh could not be confirmed';
    if (status) {
      status.hidden = false;
      status.textContent = 'No completed report is available on this device yet. Please refresh after the next report run.';
    }
  };

  const loadReportWithFallbacks = async () => {
    try {
      const report = await loadPrimaryReport();
      renderReport(report);
      saveCachedReport(report);
      document.body.dataset.reportSource = 'current';
      return;
    } catch (primaryError) {
      console.warn('The current report could not be used.', primaryError);
    }

    try {
      const report = await loadArchivedReport();
      renderReport(report);
      saveCachedReport(report);
      showFallbackNotice('archive');
      document.body.dataset.reportSource = 'archive';
      return;
    } catch (archiveError) {
      console.warn('The archived report could not be used.', archiveError);
    }

    const cachedReport = loadCachedReport();
    if (cachedReport) {
      renderReport(cachedReport);
      showFallbackNotice('browser');
      document.body.dataset.reportSource = 'browser';
      return;
    }

    showLoadError(new Error('All report sources failed.'));
    document.body.dataset.reportSource = 'unavailable';
  };

  setActiveNavigation();
  loadReportWithFallbacks();
})();
