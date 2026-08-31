(() => {
  const TIME_ZONE = 'America/Chicago';
  const CARD_STORAGE_KEY = 'mir:cardDecks:v1';
  const JOURNAL_STORAGE_KEY = 'mir:journal:v1';
  const MANIFEST_URL = 'assets/oracle/oracle-manifest.json?v=20260721-1';

  const state = {
    journal: { version: 1, entries: {} },
    cards: { pulls: {} },
    manifest: null,
    selectedDate: null,
    saveTimer: null
  };

  const el = {};

  const localDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const friendlyDate = (key, includeYear = false) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  };

  const shortDate = (key) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  };

  const loadJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (error) { console.warn(`Could not read ${key}.`, error); return fallback; }
  };

  const saveJournal = () => {
    try { localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(state.journal)); }
    catch (error) { console.warn('Journal could not be saved.', error); }
  };

  const currentEntry = () => state.journal.entries[state.selectedDate] || null;
  const pullsForDate = (date) => state.cards.pulls?.[date] || {};

  const findCardData = (deck, id) => {
    if (!state.manifest || !id) return null;
    const source = deck === 'animal' ? state.manifest.reflection_cards : state.manifest.oracle_cards;
    return source?.find((card) => card.id === id) || null;
  };

  const cardSnapshot = (deck, pull) => {
    if (!pull) return null;
    const card = findCardData(deck, pull.cardId);
    return {
      deck,
      title: pull.title || card?.animal || 'Card',
      message: deck === 'animal' ? String(card?.message || '').trim() : '',
      image: deck === 'animal' ? card?.image : card?.front
    };
  };

  const cardsForDate = (date) => {
    const pulls = pullsForDate(date);
    return [cardSnapshot('animal', pulls.animal), cardSnapshot('oracle', pulls.oracle)].filter(Boolean);
  };

  const renderCards = () => {
    const cards = cardsForDate(state.selectedDate);
    el.cardThumbs.innerHTML = '';
    if (!cards.length) {
      el.cardStatus.textContent = 'No cards were drawn for this date.';
      return;
    }
    el.cardStatus.textContent = cards.length === 2 ? 'Both daily pulls are attached to this page.' : 'One daily pull is attached to this page.';
    cards.forEach((card) => {
      const chip = document.createElement('div');
      chip.className = 'journal-card-chip';
      const image = card.image ? `<img src="${card.image}" alt="${card.title} card">` : '';
      chip.innerHTML = `${image}<span>${card.deck === 'animal' ? 'Animal Wisdom' : 'Golden Oracle'}<strong>${card.title}</strong></span>`;
      el.cardThumbs.appendChild(chip);
    });
  };

  const renderHistory = () => {
    const dates = new Set([
      ...Object.keys(state.journal.entries || {}),
      ...Object.keys(state.cards.pulls || {})
    ]);
    const today = localDateKey();
    const sorted = [...dates].filter((date) => date !== today).sort((a, b) => b.localeCompare(a)).slice(0, 60);
    el.history.innerHTML = '';
    sorted.forEach((date) => {
      const entry = state.journal.entries[date];
      const pulls = pullsForDate(date);
      const names = [pulls.animal?.title, pulls.oracle?.title].filter(Boolean).join(' + ');
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.toggle('is-active', date === state.selectedDate);
      button.innerHTML = `<strong>${shortDate(date)}</strong><span>${names || (entry?.text ? 'Journal entry' : 'Card day')}</span>`;
      button.addEventListener('click', () => selectDate(date));
      el.history.appendChild(button);
    });
  };

  const saveSelectedEntry = () => {
    const text = el.entry.value;
    const existing = state.journal.entries[state.selectedDate] || {};
    if (!text.trim() && !existing.aiReflection) {
      delete state.journal.entries[state.selectedDate];
    } else {
      state.journal.entries[state.selectedDate] = {
        ...existing,
        text,
        updatedAt: new Date().toISOString()
      };
    }
    saveJournal();
    el.saveStatus.textContent = 'Saved';
    renderHistory();
  };

  const scheduleSave = () => {
    el.saveStatus.textContent = 'Saving…';
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(saveSelectedEntry, 500);
  };

  const renderAi = () => {
    const reflection = currentEntry()?.aiReflection;
    if (reflection) {
      el.aiResponse.removeAttribute('data-mode');
      el.aiResponse.innerHTML = reflection.split(/\n\n+/).map((part) => `<p>${escapeHtml(part)}</p>`).join('');
    } else {
      el.aiResponse.removeAttribute('data-mode');
      el.aiResponse.innerHTML = '<p>Your reflection will appear here. The goal is curiosity, not declaring what your cards or feelings “must” mean.</p>';
    }
  };

  const localFallbackReflection = (cards) => {
    const names = cards.map((card) => card.title).join(' and ');
    const wisdom = cards.map((card) => card.message).filter(Boolean).join(' ');
    const cardLine = names ? `Today’s cards are ${names}.` : 'No card is attached to this page yet.';
    const wisdomLine = wisdom ? `The card language already on the page includes: “${wisdom}”` : '';
    return `${cardLine} ${wisdomLine}\n\nA useful place to begin: what part of this feels connected to something real in your day, and what part does not? You do not need to force the card to fit. Notice the sentence, reaction, memory, or resistance that has the most energy and write from there.`.trim();
  };

  const requestAiReflection = async () => {
    const cards = cardsForDate(state.selectedDate);
    const text = el.entry.value.trim();
    el.aiButton.disabled = true;
    el.aiStatus.textContent = 'Reflecting on the page…';
    try {
      const response = await fetch('/.netlify/functions/journal-reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: state.selectedDate, cards: cards.map(({ deck, title, message }) => ({ deck, title, message })), journal: text })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.reflection) throw new Error(payload.error || 'AI reflection is not configured.');
      state.journal.entries[state.selectedDate] = {
        ...(state.journal.entries[state.selectedDate] || {}),
        text: el.entry.value,
        aiReflection: payload.reflection,
        aiUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveJournal();
      renderAi();
      renderHistory();
      el.aiStatus.textContent = 'AI reflection saved with this journal page.';
    } catch (error) {
      const fallback = localFallbackReflection(cards);
      el.aiResponse.dataset.mode = 'fallback';
      el.aiResponse.innerHTML = `<p>${escapeHtml(fallback).replaceAll('\n\n','</p><p>')}</p>`;
      el.aiStatus.textContent = 'AI is not connected on the site yet, so this is a local card-guided reflection instead.';
    } finally {
      el.aiButton.disabled = false;
    }
  };

  const selectDate = (date) => {
    if (state.selectedDate && el.entry) saveSelectedEntry();
    state.selectedDate = date;
    el.dayTitle.textContent = friendlyDate(date, true);
    el.entry.value = state.journal.entries[date]?.text || '';
    el.saveStatus.textContent = state.journal.entries[date] ? 'Saved' : '';
    renderCards();
    renderAi();
    renderHistory();
  };

  const escapeHtml = (value) => String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const start = async () => {
    Object.assign(el, {
      headerDate: document.getElementById('journal-header-date'),
      dayTitle: document.getElementById('journal-day-title'),
      entry: document.getElementById('journal-entry'),
      saveStatus: document.getElementById('journal-save-status'),
      history: document.getElementById('journal-history'),
      today: document.getElementById('journal-today'),
      cardStatus: document.getElementById('journal-card-status'),
      cardThumbs: document.getElementById('journal-card-thumbs'),
      aiButton: document.getElementById('journal-ai-button'),
      aiResponse: document.getElementById('journal-ai-response'),
      aiStatus: document.getElementById('journal-ai-status')
    });

    state.journal = loadJson(JOURNAL_STORAGE_KEY, { version: 1, entries: {} });
    if (!state.journal.entries) state.journal = { version: 1, entries: {} };
    state.cards = loadJson(CARD_STORAGE_KEY, { pulls: {} });
    if (!state.cards.pulls) state.cards.pulls = {};
    state.selectedDate = localDateKey();
    el.headerDate.textContent = friendlyDate(state.selectedDate);

    try {
      const response = await fetch(MANIFEST_URL, { cache: 'force-cache' });
      if (response.ok) state.manifest = await response.json();
    } catch (error) {
      console.warn('Card manifest was unavailable in Journal.', error);
    }

    el.entry.addEventListener('input', scheduleSave);
    el.today.addEventListener('click', () => selectDate(localDateKey()));
    el.aiButton.addEventListener('click', requestAiReflection);
    window.addEventListener('pagehide', saveSelectedEntry);
    selectDate(state.selectedDate);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
