(() => {
  const MANIFEST_URL = 'assets/oracle/oracle-manifest.json?v=20260721-1';
  const TIME_ZONE = 'America/Chicago';
  const STORAGE_KEY = 'mir:cardDecks:v1';
  const DISABLED_ORACLE_IDS = new Set(['otter']);

  const deckConfig = {
    animal: {
      label: 'Animal Wisdom',
      type: 'reflection_cards',
      titleField: 'animal',
      imageField: 'image'
    },
    oracle: {
      label: 'Golden Oracle',
      type: 'oracle_cards',
      titleField: 'animal',
      imageField: 'front'
    }
  };

  const state = {
    data: { version: 1, pulls: {}, reflections: {} },
    cards: { animal: [], oracle: [] },
    current: { animal: null, oracle: null },
    view: { animal: 'idle', oracle: 'idle' }
  };

  const el = {};

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

  const friendlyDate = (key = localDateKey()) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  };

  const loadState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed && parsed.version === 1 && parsed.pulls && parsed.reflections) {
        state.data = parsed;
      }
    } catch (error) {
      console.warn('Card Path storage could not be read.', error);
    }
  };

  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    } catch (error) {
      console.warn('Card Path storage could not be saved.', error);
    }
  };

  const randomIndex = (length) => {
    if (length <= 1) return 0;
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  };

  const findCard = (deck, id) => state.cards[deck].find((card) => card.id === id) || null;

  const todayPull = (deck) => state.data.pulls[localDateKey()]?.[deck] || null;

  const persistPull = (deck, card) => {
    const date = localDateKey();
    state.data.pulls[date] ||= {};
    state.data.pulls[date][deck] = {
      cardId: card.id,
      title: card[deckConfig[deck].titleField],
      drawnAt: new Date().toISOString()
    };
    saveState();
  };

  const selectRandomCard = (deck) => {
    const cards = state.cards[deck];
    if (!cards.length) return null;
    return cards[randomIndex(cards.length)];
  };

  const setStatus = (deck, message) => {
    el[`${deck}Status`].textContent = message;
  };

  const cardTitle = (deck, card) => card?.[deckConfig[deck].titleField] || '';

  const imageForView = (deck, card, view) => {
    if (!card) return '';
    if (deck === 'oracle' && view === 'reading') return card.back;
    return card[deckConfig[deck].imageField];
  };

  const renderDeck = (deck) => {
    const card = state.current[deck];
    const view = state.view[deck];
    const stage = el[`${deck}Stage`];
    const image = el[`${deck}Image`];
    const back = el[`${deck}Back`];
    const name = el[`${deck}Name`];
    const draw = el[`${deck}Draw`];
    const reveal = el[`${deck}Reveal`];
    const reading = el[`${deck}Reading`];

    const hasDailyPull = Boolean(todayPull(deck));
    draw.hidden = hasDailyPull;
    reveal.hidden = !card || view !== 'drawn';
    reading.hidden = deck !== 'oracle' || !card || (view !== 'revealed' && view !== 'reading');

    if (!card) {
      stage.classList.remove('has-card', 'is-revealed', 'is-reading');
      back.hidden = false;
      image.hidden = true;
      name.textContent = 'Not drawn today';
      setStatus(deck, 'The deck is waiting for you.');
      return;
    }

    stage.classList.add('has-card');
    stage.classList.toggle('is-revealed', view === 'revealed' || view === 'reading');
    stage.classList.toggle('is-reading', view === 'reading');
    name.textContent = view === 'drawn' ? 'A card has stepped forward' : cardTitle(deck, card);

    if (view === 'drawn') {
      back.hidden = false;
      image.hidden = true;
      setStatus(deck, 'Tap the facedown card when you are ready to reveal it.');
    } else {
      back.hidden = true;
      image.hidden = false;
      image.src = imageForView(deck, card, view);
      image.alt = deck === 'animal'
        ? `${cardTitle(deck, card)} Animal Wisdom reflection card`
        : view === 'reading'
          ? `${cardTitle(deck, card)} Golden Oracle full reading`
          : `${cardTitle(deck, card)} Golden Oracle card`;
      setStatus(deck, view === 'reading'
        ? `${cardTitle(deck, card)} is open to the full reading.`
        : `${cardTitle(deck, card)} is your ${deckConfig[deck].label} card for today.`);
    }

    if (deck === 'oracle' && !reading.hidden) {
      reading.textContent = view === 'reading' ? 'Show card front' : 'Read full message';
    }
  };

  const drawDeck = (deck) => {
    if (todayPull(deck)) return;
    const card = selectRandomCard(deck);
    if (!card) return;
    state.current[deck] = card;
    state.view[deck] = 'drawn';
    persistPull(deck, card);
    renderDeck(deck);
    renderHistory();
    el[`${deck}Stage`].classList.remove('is-drawing');
    requestAnimationFrame(() => requestAnimationFrame(() => el[`${deck}Stage`].classList.add('is-drawing')));
  };

  const revealDeck = (deck) => {
    if (!state.current[deck]) return;
    state.view[deck] = 'revealed';
    renderDeck(deck);
  };

  const toggleOracleReading = () => {
    if (!state.current.oracle) return;
    state.view.oracle = state.view.oracle === 'reading' ? 'revealed' : 'reading';
    renderDeck('oracle');
  };

  const restoreToday = () => {
    ['animal', 'oracle'].forEach((deck) => {
      const pull = todayPull(deck);
      if (!pull) return;
      const card = findCard(deck, pull.cardId);
      if (!card) return;
      state.current[deck] = card;
      state.view[deck] = 'revealed';
    });
  };

  const renderHistory = () => {
    const entries = Object.entries(state.data.pulls)
      .filter(([, pulls]) => pulls?.animal || pulls?.oracle)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30);

    el.historyList.innerHTML = '';
    if (!entries.length) {
      el.historyEmpty.hidden = false;
      return;
    }

    el.historyEmpty.hidden = true;
    entries.forEach(([date, pulls]) => {
      const item = document.createElement('article');
      item.className = 'card-path-day';
      const reflection = state.data.reflections[date];
      const cards = [
        pulls.animal ? `<span>🐾 ${escapeHtml(pulls.animal.title)}</span>` : '',
        pulls.oracle ? `<span>✨ ${escapeHtml(pulls.oracle.title)}</span>` : ''
      ].filter(Boolean).join('');
      item.innerHTML = `
        <div class="card-path-date">
          <strong>${escapeHtml(friendlyDate(date))}</strong>
          <span>${escapeHtml(date)}</span>
        </div>
        <div class="card-path-cards">${cards}</div>
        ${reflection ? `<p>${escapeHtml(reflection)}</p>` : ''}
      `;
      el.historyList.appendChild(item);
    });
  };

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const loadReflection = () => {
    el.reflection.value = state.data.reflections[localDateKey()] || '';
    el.reflectionStatus.textContent = el.reflection.value ? 'Saved for today.' : '';
  };

  const saveReflection = () => {
    const value = el.reflection.value.trim();
    const date = localDateKey();
    if (value) state.data.reflections[date] = value;
    else delete state.data.reflections[date];
    saveState();
    el.reflectionStatus.textContent = value ? 'Reflection saved.' : 'Reflection cleared.';
    renderHistory();
  };

  const bindElements = () => {
    Object.assign(el, {
      animalStage: document.getElementById('animal-stage'),
      animalBack: document.getElementById('animal-back'),
      animalImage: document.getElementById('animal-image'),
      animalName: document.getElementById('animal-name'),
      animalDraw: document.getElementById('animal-draw'),
      animalReveal: document.getElementById('animal-reveal'),
      animalReading: document.getElementById('animal-reading'),
      animalStatus: document.getElementById('animal-status'),
      oracleStage: document.getElementById('golden-stage'),
      oracleBack: document.getElementById('golden-back'),
      oracleImage: document.getElementById('golden-image'),
      oracleName: document.getElementById('golden-name'),
      oracleDraw: document.getElementById('golden-draw'),
      oracleReveal: document.getElementById('golden-reveal'),
      oracleReading: document.getElementById('golden-reading'),
      oracleStatus: document.getElementById('golden-status'),
      reflection: document.getElementById('cards-reflection'),
      reflectionSave: document.getElementById('cards-reflection-save'),
      reflectionStatus: document.getElementById('cards-reflection-status'),
      historyList: document.getElementById('card-path-list'),
      historyEmpty: document.getElementById('card-path-empty')
    });
  };

  const bindEvents = () => {
    el.animalDraw.addEventListener('click', () => drawDeck('animal'));
    el.oracleDraw.addEventListener('click', () => drawDeck('oracle'));
    el.animalReveal.addEventListener('click', () => revealDeck('animal'));
    el.oracleReveal.addEventListener('click', () => revealDeck('oracle'));
    el.animalStage.addEventListener('click', () => {
      if (state.view.animal === 'drawn') revealDeck('animal');
    });
    el.oracleStage.addEventListener('click', () => {
      if (state.view.oracle === 'drawn') revealDeck('oracle');
    });
    el.oracleReading.addEventListener('click', toggleOracleReading);
    el.reflectionSave.addEventListener('click', saveReflection);
  };

  const validateManifest = (manifest) => {
    const animals = Array.isArray(manifest?.reflection_cards)
      ? manifest.reflection_cards.filter((card) => card?.id && card?.animal && card?.image)
      : [];
    const oracle = Array.isArray(manifest?.oracle_cards)
      ? manifest.oracle_cards.filter((card) => card?.id && card?.animal && card?.front && card?.back && !DISABLED_ORACLE_IDS.has(card.id))
      : [];
    if (!animals.length || !oracle.length) throw new Error('Card decks are incomplete.');
    return { animals, oracle };
  };

  const showError = (error) => {
    console.error(error);
    ['animal', 'oracle'].forEach((deck) => {
      el[`${deck}Draw`].disabled = true;
      el[`${deck}Reveal`].disabled = true;
      setStatus(deck, 'This deck could not be loaded. Refresh the page to try again.');
    });
  };

  const start = async () => {
    bindElements();
    loadState();
    bindEvents();
    loadReflection();
    renderHistory();

    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Card manifest request failed with ${response.status}.`);
      const { animals, oracle } = validateManifest(await response.json());
      state.cards.animal = animals;
      state.cards.oracle = oracle;
      restoreToday();
      renderDeck('animal');
      renderDeck('oracle');
    } catch (error) {
      showError(error);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
