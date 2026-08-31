(() => {
  const TIME_ZONE = 'America/Chicago';
  const CARD_STORAGE_KEY = 'mir:cardDecks:v1';
  const JOURNAL_STORAGE_KEY = 'mir:journal:v1';
  const MANIFEST_URL = 'assets/oracle/oracle-manifest.json?v=20260721-1';
  const REFLECT_URL = '/.netlify/functions/journal-reflect';

  const el = {};
  let manifest = null;
  let requestInProgress = false;

  const localDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const readJson = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
    } catch (error) {
      console.warn(`Could not read ${key}.`, error);
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Could not save ${key}.`, error);
      return false;
    }
  };

  const escapeHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const paragraphHtml = (value) => String(value || '')
    .trim()
    .split(/\n\n+/)
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join('');

  const currentJournal = () => {
    const journal = readJson(JOURNAL_STORAGE_KEY, { version: 1, entries: {} });
    if (!journal.entries || typeof journal.entries !== 'object') journal.entries = {};
    if (!journal.version) journal.version = 1;
    return journal;
  };

  const saveJournalFields = (fields) => {
    const date = localDateKey();
    const journal = currentJournal();
    const existing = journal.entries[date] || {};
    const now = new Date().toISOString();
    journal.entries[date] = {
      ...existing,
      ...fields,
      updatedAt: now
    };
    return writeJson(JOURNAL_STORAGE_KEY, journal);
  };

  const saveRawThoughts = ({ quiet = false } = {}) => {
    const raw = el.raw.value.trim();
    const date = localDateKey();
    const cardState = readJson(CARD_STORAGE_KEY, { version: 1, pulls: {}, reflections: {}, shareDrafts: {} });
    cardState.version ||= 1;
    cardState.pulls ||= {};
    cardState.reflections ||= {};
    cardState.shareDrafts ||= {};

    if (raw) cardState.reflections[date] = raw;
    else delete cardState.reflections[date];
    writeJson(CARD_STORAGE_KEY, cardState);

    const journal = currentJournal();
    const existing = journal.entries[date] || {};
    const hasAnythingElse = Boolean(existing.text?.trim() || existing.aiReflection || existing.dailyReflection);
    if (raw || hasAnythingElse) {
      journal.entries[date] = {
        ...existing,
        cardReflectionRaw: raw,
        updatedAt: new Date().toISOString()
      };
    } else {
      delete journal.entries[date];
    }
    writeJson(JOURNAL_STORAGE_KEY, journal);

    if (!quiet) {
      el.status.textContent = raw
        ? 'Your original thoughts are saved with today’s Journal page.'
        : 'Your card notes are cleared.';
      window.setTimeout(enhanceHistory, 0);
    }
    return raw;
  };

  const cardsForToday = () => {
    if (!manifest) return [];
    const date = localDateKey();
    const cardState = readJson(CARD_STORAGE_KEY, { pulls: {} });
    const pulls = cardState.pulls?.[date] || {};
    const cards = [];

    if (pulls.animal) {
      const card = manifest.reflection_cards?.find((item) => item.id === pulls.animal.cardId);
      cards.push({
        deck: 'animal',
        title: pulls.animal.title || card?.animal || 'Animal Wisdom',
        message: String(card?.message || '').trim()
      });
    }

    if (pulls.oracle) {
      const card = manifest.oracle_cards?.find((item) => item.id === pulls.oracle.cardId);
      cards.push({
        deck: 'oracle',
        title: pulls.oracle.title || card?.animal || 'Golden Oracle',
        message: '',
        readingImageUrl: card?.back ? new URL(card.back, window.location.href).href : ''
      });
    }

    return cards;
  };

  const setBusy = (busy) => {
    requestInProgress = busy;
    el.shape.disabled = busy;
    el.retry.disabled = busy;
    el.saveAi.disabled = busy;
    el.shape.textContent = busy ? 'Shaping your reflection…' : 'Help me shape this ✨';
  };

  const showWorkspace = (value = '') => {
    el.workspace.hidden = false;
    if (value) el.ai.value = value;
  };

  const requestReflection = async () => {
    if (requestInProgress) return;
    const raw = saveRawThoughts({ quiet: true });
    const cards = cardsForToday();

    if (cards.length < 2) {
      el.status.textContent = 'Draw and reveal both daily cards first so the reflection can consider them together.';
      return;
    }
    if (!raw) {
      el.status.textContent = 'Write what the cards are bringing up for you first. Messy absolutely counts.';
      el.raw.focus();
      return;
    }

    setBusy(true);
    el.status.textContent = 'Sending only today’s two cards and the words you wrote to AI…';
    showWorkspace();
    el.aiStatus.textContent = 'Working from your meaning, not inventing one for you.';

    try {
      const response = await fetch(REFLECT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'shape',
          date: localDateKey(),
          cards,
          journal: raw
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.reflection) {
        const error = new Error(payload.error || 'The reflection could not be shaped right now.');
        error.code = payload.code;
        throw error;
      }

      el.ai.value = payload.reflection.trim();
      el.aiStatus.textContent = 'This is a draft. Change anything that does not sound or feel like you.';
      el.status.textContent = 'Your shaped reflection is ready below.';
      el.ai.focus();
    } catch (error) {
      console.error('Card reflection AI request failed.', error);
      if (error.code === 'CONFIG_REQUIRED') {
        el.status.textContent = 'The experience is built, but the private OpenAI key still needs to be connected in Netlify.';
      } else {
        el.status.textContent = 'AI could not shape the reflection right now. Your original thoughts are still safely saved.';
      }
      el.aiStatus.textContent = '';
    } finally {
      setBusy(false);
    }
  };

  const saveDailyReflection = () => {
    const reflection = el.ai.value.trim();
    const raw = saveRawThoughts({ quiet: true });
    if (!reflection) {
      el.aiStatus.textContent = 'There is not a reflection to save yet.';
      return;
    }

    const now = new Date().toISOString();
    const saved = saveJournalFields({
      cardReflectionRaw: raw,
      dailyReflection: reflection,
      dailyReflectionUpdatedAt: now
    });

    if (!saved) {
      el.aiStatus.textContent = 'The reflection could not be saved on this device.';
      return;
    }

    el.aiStatus.textContent = 'Saved in Journal. This is now part of today’s record. ✓';
    el.status.textContent = 'Daily reflection saved to Journal.';
    el.openJournal.hidden = false;
    window.setTimeout(enhanceHistory, 0);
  };

  const renderSavedToday = () => {
    const date = localDateKey();
    const cardState = readJson(CARD_STORAGE_KEY, { reflections: {} });
    const journal = currentJournal();
    const entry = journal.entries[date] || {};
    const raw = entry.cardReflectionRaw || cardState.reflections?.[date] || '';
    if (raw && !el.raw.value) el.raw.value = raw;

    if (entry.dailyReflection) {
      showWorkspace(entry.dailyReflection);
      el.aiStatus.textContent = 'Saved in Journal. You can edit this copy and save again if today keeps unfolding.';
      el.openJournal.hidden = false;
    }
  };

  const enhanceHistory = () => {
    const list = document.getElementById('card-path-list');
    if (!list) return;
    const journal = currentJournal();

    list.querySelectorAll('.card-path-day').forEach((item) => {
      item.querySelector('.card-path-daily-reflection')?.remove();
      const date = item.querySelector('.card-path-date span')?.textContent?.trim();
      const reflection = journal.entries?.[date]?.dailyReflection;
      if (!date || !reflection) return;

      const block = document.createElement('div');
      block.className = 'card-path-daily-reflection';
      block.innerHTML = `<strong>Daily reflection</strong>${paragraphHtml(reflection)}`;
      item.appendChild(block);
    });
  };

  const start = async () => {
    Object.assign(el, {
      raw: document.getElementById('cards-reflection'),
      saveRaw: document.getElementById('cards-reflection-save'),
      shape: document.getElementById('cards-reflection-ai'),
      status: document.getElementById('cards-reflection-status'),
      workspace: document.getElementById('cards-ai-workspace'),
      ai: document.getElementById('cards-ai-reflection'),
      saveAi: document.getElementById('cards-ai-save'),
      retry: document.getElementById('cards-ai-retry'),
      aiStatus: document.getElementById('cards-ai-status'),
      openJournal: document.getElementById('cards-open-journal')
    });

    if (!el.raw || !el.shape || !el.workspace || !el.ai) return;

    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (response.ok) manifest = await response.json();
    } catch (error) {
      console.warn('Card manifest was unavailable to the reflection workspace.', error);
    }

    el.saveRaw?.addEventListener('click', () => saveRawThoughts());
    el.shape.addEventListener('click', requestReflection);
    el.retry?.addEventListener('click', requestReflection);
    el.saveAi?.addEventListener('click', saveDailyReflection);

    renderSavedToday();
    window.setTimeout(enhanceHistory, 0);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
