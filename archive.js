(() => {
  const INDEX_URL = 'data/report-index.json';
  const SEARCH_URL = 'data/archive-search.json';
  const FEEDBACK_KEY = 'morning-intelligence-report:feedback-state';
  const DEVICE_KEY = 'morning-intelligence-report:feedback-device';
  const FEEDBACK_ENDPOINT = '/api/feedback';
  const SECTION_LABELS = {
    'big-story': 'Big Story',
    'quick-scan': 'Quick Scan',
    local: 'Local',
    'must-know': 'Must Know',
    'ai-tech': 'AI & Tech',
    'work-marketing': 'Work & Marketing',
    wellbeing: 'Wellbeing',
    entertainment: 'Entertainment',
    animals: 'Animals',
    wonderful: 'Wonderful'
  };

  const state = {
    editions: [],
    stories: [],
    query: '',
    section: 'all',
    date: 'all',
    sort: 'newest',
    view: 'all',
    page: 1,
    pageSize: 18,
    loading: true
  };

  const elements = {};
  const byId = (id) => document.getElementById(id);
  const clean = (value) => String(value || '').trim();
  const normalize = (value) => clean(value).toLowerCase();
  const safeParse = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };

  const fetchJson = async (url) => {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}cache=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  };

  const formatDate = (value, options = {}) => {
    const date = new Date(`${value}T12:00:00`);
    return date.toLocaleDateString('en-US', {
      month: options.short ? 'short' : 'long',
      day: 'numeric',
      year: options.year === false ? undefined : 'numeric'
    });
  };

  const escapeHtml = (value) => clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const storySearchText = (story) => normalize([
    story.source,
    story.headline,
    story.summary,
    ...(story.sections || []).map((section) => SECTION_LABELS[section] || section)
  ].join(' '));

  const getSavedStories = () => {
    const profile = safeParse(localStorage.getItem(FEEDBACK_KEY), {});
    return Array.isArray(profile?.saved) ? profile.saved : [];
  };

  const savedToSearchStory = (item) => ({
    id: item.id || `saved-${normalize(item.url || item.headline).replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`,
    feedback_id: item.id || '',
    source: item.source || 'Saved story',
    headline: item.headline || 'Untitled saved story',
    summary: item.summary || '',
    url: item.url || '',
    image: item.image || '',
    published: item.published || '',
    sections: [item.section || 'saved'],
    report_dates: item.report_date ? [item.report_date] : [],
    first_seen: item.report_date || '',
    last_seen: item.report_date || '',
    saved_at: item.saved_at || '',
    appearances: 1,
    is_saved: true
  });

  const buildFallbackSearch = (report) => {
    const stories = new Map();
    const reportDate = report.report_date;
    const add = (section, story) => {
      if (!story?.url) return;
      const id = story.url;
      const existing = stories.get(id) || {
        id,
        source: story.source,
        headline: story.headline,
        summary: story.summary,
        url: story.url,
        image: story.image || '',
        published: story.published || '',
        sections: [],
        report_dates: [reportDate],
        first_seen: reportDate,
        last_seen: reportDate,
        appearances: 1
      };
      if (!existing.sections.includes(section)) existing.sections.push(section);
      stories.set(id, existing);
    };
    add('big-story', report.top_story);
    (report.quick_scan || []).forEach((story) => add('quick-scan', story));
    Object.entries(report.sections || {}).forEach(([section, storiesInSection]) => {
      (storiesInSection || []).forEach((story) => add(section, story));
    });
    return Array.from(stories.values());
  };

  const loadArchiveData = async () => {
    const index = await fetchJson(INDEX_URL);
    let editions = Array.isArray(index.editions) ? index.editions : [];

    if (!editions.length && index.latest) {
      const latestReport = await fetchJson(index.latest);
      editions = [{
        report_date: latestReport.report_date,
        generated_at: latestReport.generated_at,
        path: index.latest,
        top_story: latestReport.top_story,
        story_count: buildFallbackSearch(latestReport).length,
        section_counts: Object.fromEntries(
          Object.entries(latestReport.sections || {}).map(([key, stories]) => [key, stories.length])
        )
      }];
    }

    let search;
    try {
      search = await fetchJson(SEARCH_URL);
    } catch {
      const latestPath = editions[0]?.path || index.latest;
      const latestReport = latestPath ? await fetchJson(latestPath) : await fetchJson('data/report.json');
      search = {
        edition_count: editions.length || 1,
        story_count: 0,
        stories: buildFallbackSearch(latestReport)
      };
      search.story_count = search.stories.length;
    }

    state.editions = editions;
    state.stories = Array.isArray(search.stories) ? search.stories : [];
    state.loading = false;
    updateStats(search);
  };

  const updateStats = (search) => {
    if (elements.editionCount) elements.editionCount.textContent = String(search.edition_count || state.editions.length || 0);
    if (elements.storyCount) elements.storyCount.textContent = String(search.story_count || state.stories.length || 0);
    if (elements.savedCount) elements.savedCount.textContent = String(getSavedStories().length);
  };

  const readUrlState = () => {
    const params = new URLSearchParams(location.search);
    state.query = clean(params.get('q'));
    state.section = params.get('section') || 'all';
    state.date = params.get('date') || 'all';
    state.sort = params.get('sort') || (state.query ? 'relevance' : 'newest');
    state.view = params.get('view') === 'saved' ? 'saved' : 'all';
  };

  const writeUrlState = () => {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.section !== 'all') params.set('section', state.section);
    if (state.date !== 'all') params.set('date', state.date);
    if (state.sort !== (state.query ? 'relevance' : 'newest')) params.set('sort', state.sort);
    if (state.view === 'saved') params.set('view', 'saved');
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
  };

  const populateFilters = () => {
    const sectionOptions = Object.entries(SECTION_LABELS)
      .filter(([key]) => !['big-story', 'quick-scan'].includes(key))
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join('');
    elements.section.innerHTML = `<option value="all">All sections</option>${sectionOptions}`;

    elements.date.innerHTML = [
      '<option value="all">All editions</option>',
      ...state.editions.map((edition) => (
        `<option value="${edition.report_date}">${formatDate(edition.report_date)}</option>`
      ))
    ].join('');

    elements.query.value = state.query;
    elements.section.value = state.section;
    elements.date.value = state.date;
    elements.sort.value = state.sort;
    setViewButtons();
  };

  const renderEditions = () => {
    elements.editions.innerHTML = '';
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = `edition-card edition-card--all${state.date === 'all' ? ' is-active' : ''}`;
    allButton.innerHTML = '<span class="edition-card-date">All editions</span><span class="edition-card-copy">Search the full report memory.</span>';
    allButton.addEventListener('click', () => {
      state.date = 'all';
      elements.date.value = 'all';
      state.page = 1;
      render();
    });
    elements.editions.appendChild(allButton);

    state.editions.forEach((edition) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `edition-card${state.date === edition.report_date ? ' is-active' : ''}`;
      button.innerHTML = `
        <span class="edition-card-date">${escapeHtml(formatDate(edition.report_date, { short: true }))}</span>
        <span class="edition-card-headline">${escapeHtml(edition.top_story?.headline || 'Morning Intelligence Report')}</span>
        <span class="edition-card-meta">${Number(edition.story_count || 0)} stories</span>
      `;
      button.addEventListener('click', () => {
        state.date = edition.report_date;
        elements.date.value = edition.report_date;
        state.view = 'all';
        state.page = 1;
        render();
      });
      elements.editions.appendChild(button);
    });
  };

  const relevanceScore = (story, terms, phrase) => {
    if (!terms.length) return 0;
    const headline = normalize(story.headline);
    const summary = normalize(story.summary);
    const source = normalize(story.source);
    const sections = normalize((story.sections || []).join(' '));
    let score = 0;
    if (phrase && headline.includes(phrase)) score += 24;
    if (phrase && summary.includes(phrase)) score += 10;
    terms.forEach((term) => {
      if (headline.includes(term)) score += 8;
      if (source.includes(term)) score += 4;
      if (sections.includes(term)) score += 3;
      if (summary.includes(term)) score += 2;
    });
    return score;
  };

  const filteredStories = () => {
    const sourceStories = state.view === 'saved'
      ? getSavedStories().map(savedToSearchStory)
      : state.stories;
    const phrase = normalize(state.query);
    const terms = phrase.split(/\s+/).filter(Boolean);

    const results = sourceStories
      .map((story) => ({ story, score: relevanceScore(story, terms, phrase) }))
      .filter(({ story, score }) => {
        if (terms.length && (!terms.every((term) => storySearchText(story).includes(term)) || score === 0)) return false;
        if (state.section !== 'all' && !(story.sections || []).includes(state.section)) return false;
        if (state.date !== 'all' && !(story.report_dates || []).includes(state.date)) return false;
        return true;
      });

    results.sort((a, b) => {
      if (state.sort === 'relevance' && terms.length && b.score !== a.score) return b.score - a.score;
      if (state.sort === 'oldest') return clean(a.story.first_seen).localeCompare(clean(b.story.first_seen));
      if (state.sort === 'source') return clean(a.story.source).localeCompare(clean(b.story.source));
      return clean(b.story.last_seen || b.story.saved_at).localeCompare(clean(a.story.last_seen || a.story.saved_at));
    });
    return results.map(({ story }) => story);
  };

  const makeSectionPills = (sections) => (sections || [])
    .filter((section) => SECTION_LABELS[section])
    .slice(0, 3)
    .map((section) => `<span>${escapeHtml(SECTION_LABELS[section])}</span>`)
    .join('');

  const removeSavedStory = async (story, button) => {
    const profile = safeParse(localStorage.getItem(FEEDBACK_KEY), {});
    if (!Array.isArray(profile.saved)) return;
    profile.saved = profile.saved.filter((item) => item.id !== story.feedback_id);
    if (profile.votes?.[story.feedback_id]) profile.votes[story.feedback_id].save = false;
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(profile));
    button.textContent = 'Removed';
    button.disabled = true;
    updateStats({ edition_count: state.editions.length, story_count: state.stories.length });
    window.setTimeout(render, 250);

    const deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId || !story.feedback_id) return;
    try {
      await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          active: false,
          device_id: deviceId,
          story_id: story.feedback_id,
          report_date: story.last_seen || '',
          story: {
            source: story.source,
            headline: story.headline,
            summary: story.summary,
            url: story.url,
            section: story.sections?.[0] || 'archive'
          }
        })
      });
    } catch {
      // Local removal is authoritative for this device; the server can catch up later.
    }
  };

  const createResultCard = (story) => {
    const article = document.createElement('article');
    article.className = `archive-result${story.image ? '' : ' archive-result--text'}`;

    const image = story.image
      ? `<a class="archive-result-image" href="${escapeHtml(story.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(story.image)}" alt="" loading="lazy" decoding="async"></a>`
      : '';

    const dateLabel = story.saved_at
      ? `Saved ${new Date(story.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : `Seen ${formatDate(story.last_seen || story.first_seen, { short: true })}`;
    const repeat = Number(story.appearances || 1) > 1
      ? `<span class="archive-repeat">Appeared in ${Number(story.appearances)} reports</span>`
      : '';
    const remove = story.is_saved
      ? '<button type="button" class="archive-remove-saved">Remove saved</button>'
      : '';

    article.innerHTML = `
      ${image}
      <div class="archive-result-body">
        <div class="archive-result-topline">
          <span class="archive-result-date">${escapeHtml(dateLabel)}</span>
          <span class="archive-result-sections">${makeSectionPills(story.sections)}</span>
        </div>
        <p class="archive-result-source">${escapeHtml(story.source)}</p>
        <h2><a href="${escapeHtml(story.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(story.headline)}</a></h2>
        <p class="archive-result-summary">${escapeHtml(story.summary)}</p>
        <div class="archive-result-actions">
          <a class="archive-read-link" href="${escapeHtml(story.url)}" target="_blank" rel="noopener noreferrer">Read story</a>
          ${repeat}
          ${remove}
        </div>
      </div>
    `;

    const img = article.querySelector('img');
    img?.addEventListener('error', () => {
      article.classList.add('archive-result--text');
      article.querySelector('.archive-result-image')?.remove();
    }, { once: true });

    const removeButton = article.querySelector('.archive-remove-saved');
    removeButton?.addEventListener('click', () => removeSavedStory(story, removeButton));
    return article;
  };

  const renderResults = () => {
    const stories = filteredStories();
    const visible = stories.slice(0, state.page * state.pageSize);
    elements.results.replaceChildren(...visible.map(createResultCard));

    const context = [];
    if (state.view === 'saved') context.push('saved stories');
    if (state.query) context.push(`matching “${state.query}”`);
    if (state.section !== 'all') context.push(`in ${SECTION_LABELS[state.section] || state.section}`);
    if (state.date !== 'all') context.push(`from ${formatDate(state.date)}`);

    elements.status.textContent = `${stories.length} ${stories.length === 1 ? 'story' : 'stories'}${context.length ? ` ${context.join(' ')}` : ' in the archive'}.`;
    elements.loadMore.hidden = visible.length >= stories.length;
    elements.empty.hidden = stories.length > 0;
    elements.results.hidden = stories.length === 0;
  };

  const setViewButtons = () => {
    document.querySelectorAll('[data-archive-view]').forEach((button) => {
      const active = button.dataset.archiveView === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const render = () => {
    writeUrlState();
    renderEditions();
    setViewButtons();
    renderResults();
  };

  const clearFilters = () => {
    state.query = '';
    state.section = 'all';
    state.date = 'all';
    state.sort = 'newest';
    state.view = 'all';
    state.page = 1;
    populateFilters();
    render();
    elements.query.focus();
  };

  const wireEvents = () => {
    elements.form.addEventListener('submit', (event) => event.preventDefault());
    elements.query.addEventListener('input', () => {
      state.query = elements.query.value;
      if (state.query && state.sort === 'newest') {
        state.sort = 'relevance';
        elements.sort.value = 'relevance';
      }
      if (!state.query && state.sort === 'relevance') {
        state.sort = 'newest';
        elements.sort.value = 'newest';
      }
      state.page = 1;
      render();
    });
    elements.section.addEventListener('change', () => {
      state.section = elements.section.value;
      state.page = 1;
      render();
    });
    elements.date.addEventListener('change', () => {
      state.date = elements.date.value;
      state.page = 1;
      render();
    });
    elements.sort.addEventListener('change', () => {
      state.sort = elements.sort.value;
      render();
    });
    elements.clear.addEventListener('click', clearFilters);
    elements.loadMore.addEventListener('click', () => {
      state.page += 1;
      renderResults();
    });
    document.querySelectorAll('[data-archive-view]').forEach((button) => {
      button.addEventListener('click', () => {
        state.view = button.dataset.archiveView;
        state.date = 'all';
        elements.date.value = 'all';
        state.page = 1;
        render();
      });
    });
    window.addEventListener('storage', (event) => {
      if (event.key === FEEDBACK_KEY) {
        updateStats({ edition_count: state.editions.length, story_count: state.stories.length });
        if (state.view === 'saved') render();
      }
    });
  };

  const showError = (error) => {
    console.error(error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.errorMessage.textContent = navigator.onLine
      ? 'The archive catalog could not be opened. The live report is still available, and this page can be tried again.'
      : 'You are offline and this device has not loaded the archive yet.';
  };

  const start = async () => {
    Object.assign(elements, {
      form: byId('archive-search-form'),
      query: byId('archive-query'),
      section: byId('archive-section'),
      date: byId('archive-date'),
      sort: byId('archive-sort'),
      clear: byId('archive-clear'),
      editions: byId('archive-editions'),
      results: byId('archive-results'),
      status: byId('archive-results-status'),
      loadMore: byId('archive-load-more'),
      empty: byId('archive-empty'),
      loading: byId('archive-loading'),
      error: byId('archive-error'),
      errorMessage: byId('archive-error-message'),
      editionCount: byId('archive-edition-count'),
      storyCount: byId('archive-story-count'),
      savedCount: byId('archive-saved-count')
    });

    readUrlState();
    wireEvents();
    try {
      await loadArchiveData();
      populateFilters();
      elements.loading.hidden = true;
      byId('archive-app').hidden = false;
      render();
    } catch (error) {
      showError(error);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
