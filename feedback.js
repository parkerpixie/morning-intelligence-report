(() => {
  const ENDPOINT = '/api/feedback';
  const STYLE_URL = 'feedback.css?v=20260716-1';
  const STORAGE_KEY = 'morning-intelligence-report:feedback-state';
  const DEVICE_KEY = 'morning-intelligence-report:feedback-device';
  const PENDING_KEY = 'morning-intelligence-report:feedback-pending';
  const ACTION_WEIGHTS = {
    save: { section: 0.5, source: 0.5, keyword: 0.75 },
    useful: { section: 1, source: 1.5, keyword: 1 },
    more: { section: 1.5, source: 2, keyword: 3 },
    less: { section: -1.5, source: -2, keyword: -3 }
  };
  const STOPWORDS = new Set([
    'about','after','again','against','also','amid','among','another','around','because','before','being','between','could','during','from','have','into','latest','more','news','over','report','says','show','shows','story','their','there','these','they','this','through','today','under','using','what','when','where','which','while','with','would','your'
  ]);
  const SECTION_LABELS = {
    home: 'big-story',
    'big-story': 'must-know',
    'quick-scan': 'quick-scan',
    local: 'local',
    'must-know': 'must-know',
    'ai-tech': 'ai-tech',
    'work-marketing': 'work-marketing',
    wellbeing: 'wellbeing',
    entertainment: 'entertainment',
    animals: 'animals',
    wonderful: 'wonderful'
  };

  let reorderTimer = null;
  let toastTimer = null;

  const addStylesheet = () => {
    if (document.querySelector(`link[href^="${STYLE_URL.split('?')[0]}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_URL;
    document.head.appendChild(link);
  };

  const safeParse = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };

  const emptyProfile = () => ({
    version: 1,
    votes: {},
    saved: [],
    section_weights: {},
    source_weights: {},
    keyword_weights: {}
  });

  const loadState = () => {
    const parsed = safeParse(localStorage.getItem(STORAGE_KEY), emptyProfile());
    return {
      ...emptyProfile(),
      ...parsed,
      votes: parsed?.votes && typeof parsed.votes === 'object' ? parsed.votes : {},
      saved: Array.isArray(parsed?.saved) ? parsed.saved : [],
      section_weights: parsed?.section_weights || {},
      source_weights: parsed?.source_weights || {},
      keyword_weights: parsed?.keyword_weights || {}
    };
  };

  const saveState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const getDeviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  };

  const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  const normalize = (value) => String(value || '').trim();
  const normalizeKey = (value) => normalize(value).toLowerCase();

  const extractKeywords = (story) => {
    const phrases = [
      'taylor swift','artificial intelligence','marketing automation','mental health','customer experience',
      'salesforce','wisconsin','madison','dane county','openai','anthropic','autism','adhd','climate change'
    ];
    const text = `${story.headline || ''} ${story.summary || ''}`.toLowerCase();
    const found = phrases.filter((phrase) => text.includes(phrase));
    const words = text.match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
    for (const word of words) {
      const cleaned = word.replace(/^'+|'+$/g, '');
      if (cleaned.length < 4 || STOPWORDS.has(cleaned) || /^\d+$/.test(cleaned)) continue;
      if (!found.includes(cleaned)) found.push(cleaned);
      if (found.length >= 12) break;
    }
    return found.slice(0, 12);
  };

  const adjustMap = (map, key, amount) => {
    if (!key || !amount) return;
    const next = Number((Number(map[key] || 0) + amount).toFixed(2));
    if (Math.abs(next) < 0.01) delete map[key];
    else map[key] = Math.max(-30, Math.min(30, next));
  };

  const applyLocalWeight = (state, story, action, direction) => {
    const weight = ACTION_WEIGHTS[action];
    if (!weight) return;
    const factor = direction === 'remove' ? -1 : 1;
    adjustMap(state.section_weights, normalizeKey(story.section), weight.section * factor);
    adjustMap(state.source_weights, normalizeKey(story.source), weight.source * factor);
    extractKeywords(story).forEach((keyword) => adjustMap(state.keyword_weights, keyword, weight.keyword * factor));
  };

  const getStoryId = (story) => hashString(story.url || `${story.source}|${story.headline}`);
  const reportDate = () => document.querySelector('.report-date')?.getAttribute('datetime') || '';

  const inferSection = (element) => {
    const feed = element.closest('[data-feed]')?.dataset.feed;
    if (feed) return feed;
    if (element.classList.contains('quick-item') || element.closest('#quick-scan-list')) return 'quick-scan';
    const page = document.body.dataset.page || 'home';
    return SECTION_LABELS[page] || page;
  };

  const storyFromElement = (element) => {
    const source = element.querySelector('[data-field="source"], .quick-source')?.textContent;
    const headline = element.querySelector('[data-field="headline"], .quick-headline')?.textContent;
    const summary = element.querySelector('[data-field="summary"], .story-summary')?.textContent || '';
    const link = element.matches('a.quick-item') ? element : element.querySelector('[data-field="source-link"], .story-link');
    return {
      source: normalize(source),
      headline: normalize(headline),
      summary: normalize(summary),
      url: link?.href || '',
      section: inferSection(element),
      report_date: reportDate()
    };
  };

  const queueEvent = (event) => {
    const pending = safeParse(localStorage.getItem(PENDING_KEY), []);
    pending.push(event);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(-100)));
  };

  const sendEvent = async (event) => {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true
    });
    if (!response.ok) throw new Error(`Feedback request failed: ${response.status}`);
    return response.json();
  };

  const flushPending = async () => {
    if (!navigator.onLine) return;
    const pending = safeParse(localStorage.getItem(PENDING_KEY), []);
    if (!pending.length) return;
    const remaining = [];
    for (const event of pending) {
      try { await sendEvent(event); } catch { remaining.push(event); }
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
  };

  const showToast = (message, tone = 'saved') => {
    let toast = document.getElementById('feedback-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'feedback-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.dataset.tone = tone;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  const eventPayload = (story, action, active) => ({
    version: 1,
    action,
    active,
    device_id: getDeviceId(),
    story_id: getStoryId(story),
    report_date: story.report_date,
    story: {
      source: story.source,
      headline: story.headline,
      summary: story.summary,
      url: story.url,
      section: story.section
    }
  });

  const syncEvent = async (event) => {
    try {
      await sendEvent(event);
      return true;
    } catch (error) {
      console.warn('Feedback saved locally and queued for sync.', error);
      queueEvent(event);
      return false;
    }
  };

  const scoreStory = (story, state) => {
    let score = Number(state.section_weights[normalizeKey(story.section)] || 0);
    score += Number(state.source_weights[normalizeKey(story.source)] || 0);
    for (const keyword of extractKeywords(story)) score += Number(state.keyword_weights[keyword] || 0);
    return score;
  };

  const reorderContainer = (container, selector) => {
    if (!container || container.dataset.feedbackOrdered === 'true') return;
    const items = [...container.querySelectorAll(`:scope > ${selector}`)];
    if (items.length < 2) return;
    const state = loadState();
    const scored = items.map((element, index) => ({
      element,
      index,
      score: scoreStory(storyFromElement(element.querySelector('.quick-item') || element), state)
    }));
    if (!scored.some((item) => item.score !== 0)) return;
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    scored.forEach(({ element }) => container.appendChild(element));
    container.dataset.feedbackOrdered = 'true';
  };

  const scheduleOrdering = () => {
    clearTimeout(reorderTimer);
    reorderTimer = setTimeout(() => {
      document.querySelectorAll('[data-feed]').forEach((container) => reorderContainer(container, '.story-card'));
      reorderContainer(document.getElementById('quick-scan-list'), '.quick-feedback-shell');
    }, 80);
  };

  const setButtonState = (bar, storyId, state) => {
    const vote = state.votes[storyId] || {};
    bar.querySelectorAll('[data-feedback-action]').forEach((button) => {
      const action = button.dataset.feedbackAction;
      const selected = action === 'save' ? Boolean(vote.save) : vote.signal === action;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      const label = button.querySelector('.feedback-label');
      if (action === 'save' && label) label.textContent = selected ? 'Saved' : 'Save';
    });
  };

  const updateSavedStories = (state, story, active) => {
    const id = getStoryId(story);
    state.saved = state.saved.filter((item) => item.id !== id);
    if (active) state.saved.unshift({ id, ...story, saved_at: new Date().toISOString() });
    state.saved = state.saved.slice(0, 250);
  };

  const handleAction = async (bar, story, action) => {
    const state = loadState();
    const storyId = getStoryId(story);
    const current = state.votes[storyId] || {};
    state.votes[storyId] = current;
    const events = [];

    if (action === 'save') {
      const next = !current.save;
      if (current.save) applyLocalWeight(state, story, 'save', 'remove');
      current.save = next;
      if (next) applyLocalWeight(state, story, 'save', 'add');
      updateSavedStories(state, story, next);
      events.push(eventPayload(story, 'save', next));
      showToast(next ? 'Saved for later. It also counts as a small positive signal.' : 'Removed from saved stories.', next ? 'saved' : 'neutral');
    } else {
      const previous = current.signal;
      if (previous) {
        applyLocalWeight(state, story, previous, 'remove');
        events.push(eventPayload(story, previous, false));
      }
      const next = previous === action ? null : action;
      current.signal = next;
      if (next) {
        applyLocalWeight(state, story, next, 'add');
        events.push(eventPayload(story, next, true));
      }
      const messages = {
        useful: 'Useful noted. This source and topic get a modest lift.',
        more: 'More like this. Tomorrow’s ranking gets a stronger nudge.',
        less: 'Less like this. The report will turn down similar stories.'
      };
      showToast(next ? messages[next] : 'Feedback removed.', next === 'less' ? 'less' : 'saved');
    }

    saveState(state);
    setButtonState(bar, storyId, state);
    document.querySelectorAll('[data-feed], #quick-scan-list').forEach((container) => delete container.dataset.feedbackOrdered);
    scheduleOrdering();

    let synced = true;
    for (const feedbackEvent of events) {
      if (!await syncEvent(feedbackEvent)) synced = false;
    }
    const status = bar.querySelector('.feedback-sync-status');
    if (status) status.textContent = synced ? 'Synced' : 'Saved here; sync queued';
  };

  const createButton = (action, icon, label, title) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `feedback-button feedback-button--${action}`;
    button.dataset.feedbackAction = action;
    button.setAttribute('aria-pressed', 'false');
    button.title = title;
    button.innerHTML = `<span class="feedback-icon" aria-hidden="true">${icon}</span><span class="feedback-label">${label}</span>`;
    return button;
  };

  const createFeedbackBar = (story, compact = false) => {
    const bar = document.createElement('div');
    bar.className = `feedback-actions${compact ? ' feedback-actions--compact' : ''}`;
    bar.dataset.storyId = getStoryId(story);
    bar.setAttribute('aria-label', `Feedback for ${story.headline}`);

    const intro = document.createElement('span');
    intro.className = 'feedback-intro';
    intro.textContent = compact ? 'Train report:' : 'Shape future reports:';

    const controls = document.createElement('div');
    controls.className = 'feedback-controls';
    controls.append(
      createButton('save', '☆', 'Save', 'Save this story and give it a small positive signal'),
      createButton('useful', '✓', 'Useful', 'This was useful'),
      createButton('more', '+', 'More', 'Show more stories like this'),
      createButton('less', '−', 'Less', 'Show fewer stories like this')
    );

    const status = document.createElement('span');
    status.className = 'feedback-sync-status';
    status.setAttribute('aria-live', 'polite');
    bar.append(intro, controls, status);

    bar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-feedback-action]');
      if (button) handleAction(bar, story, button.dataset.feedbackAction);
    });
    setButtonState(bar, getStoryId(story), loadState());
    return bar;
  };

  const decorateStoryCard = (element) => {
    if (element.dataset.feedbackReady === 'true') return;
    const story = storyFromElement(element);
    if (!story.headline || !story.url || story.headline.includes('Building your morning briefing')) return;
    const target = element.querySelector('.lead-content, .story-card-body') || element;
    target.appendChild(createFeedbackBar(story));
    element.dataset.feedbackReady = 'true';
  };

  const decorateQuickItem = (link) => {
    if (link.dataset.feedbackReady === 'true' || link.closest('.quick-feedback-shell')) return;
    const story = storyFromElement(link);
    if (!story.headline || !story.url) return;
    const shell = document.createElement('div');
    shell.className = 'quick-feedback-shell';
    link.before(shell);
    shell.append(link, createFeedbackBar(story, true));
    link.dataset.feedbackReady = 'true';
  };

  const decorateAll = () => {
    document.querySelectorAll('.lead-story, .story-card').forEach(decorateStoryCard);
    document.querySelectorAll('a.quick-item').forEach(decorateQuickItem);
    scheduleOrdering();
  };

  const start = () => {
    addStylesheet();
    decorateAll();
    const observer = new MutationObserver(decorateAll);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('online', flushPending);
    flushPending();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
