(() => {
  const MANIFEST_URL = 'assets/oracle/oracle-manifest.json?v=20260721-1';
  const TIME_ZONE = 'America/Chicago';
  const STORAGE_KEY = 'mir:cardDecks:v1';
  const DISABLED_ORACLE_IDS = new Set(['otter']);
  const MIN_PATTERN_DAYS = 4;

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
    data: { version: 1, pulls: {}, reflections: {}, shareDrafts: {} },
    cards: { animal: [], oracle: [] },
    current: { animal: null, oracle: null },
    view: { animal: 'idle', oracle: 'idle' },
    shareDeck: null
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
        state.data = {
          version: 1,
          pulls: parsed.pulls || {},
          reflections: parsed.reflections || {},
          shareDrafts: parsed.shareDrafts || {}
        };
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

  const countWords = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const findCard = (deck, id) => state.cards[deck].find((card) => card.id === id) || null;
  const todayPull = (deck) => state.data.pulls[localDateKey()]?.[deck] || null;
  const cardTitle = (deck, card) => card?.[deckConfig[deck].titleField] || '';

  const persistPull = (deck, card) => {
    const date = localDateKey();
    state.data.pulls[date] ||= {};
    state.data.pulls[date][deck] = {
      cardId: card.id,
      title: cardTitle(deck, card),
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
    const share = el[`${deck}Share`];

    const hasDailyPull = Boolean(todayPull(deck));
    draw.hidden = hasDailyPull;
    reveal.hidden = !card || view !== 'drawn';
    reading.hidden = deck !== 'oracle' || !card || (view !== 'revealed' && view !== 'reading');
    share.hidden = !card || view === 'drawn';

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
    renderPatterns();
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

  const renderPatterns = () => {
    const entries = Object.entries(state.data.pulls)
      .filter(([, pulls]) => pulls?.animal || pulls?.oracle)
      .sort(([a], [b]) => b.localeCompare(a));

    el.patternsList.innerHTML = '';
    if (entries.length < MIN_PATTERN_DAYS) {
      el.patternsEmpty.hidden = false;
      return;
    }

    const observations = [];
    const counts = { animal: new Map(), oracle: new Map(), pair: new Map() };

    entries.forEach(([, pulls]) => {
      ['animal', 'oracle'].forEach((deck) => {
        const title = pulls?.[deck]?.title;
        if (!title) return;
        counts[deck].set(title, (counts[deck].get(title) || 0) + 1);
      });
      if (pulls?.animal?.title && pulls?.oracle?.title) {
        const key = `${pulls.animal.title}|||${pulls.oracle.title}`;
        counts.pair.set(key, (counts.pair.get(key) || 0) + 1);
      }
    });

    ['animal', 'oracle'].forEach((deck) => {
      [...counts[deck].entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 2)
        .forEach(([title, count]) => observations.push({
          icon: deck === 'animal' ? '🐾' : '✨',
          text: `${title} has appeared ${count} times in ${deckConfig[deck].label}.`
        }));
    });

    const repeatedPair = [...counts.pair.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])[0];
    if (repeatedPair) {
      const [animal, oracle] = repeatedPair[0].split('|||');
      observations.push({
        icon: '↔',
        text: `${animal} and ${oracle} have appeared together ${repeatedPair[1]} times.`
      });
    }

    const recent = entries.slice(0, Math.min(7, entries.length));
    const bothCount = recent.filter(([, pulls]) => pulls?.animal && pulls?.oracle).length;
    if (recent.length >= 4 && bothCount >= Math.ceil(recent.length * 0.6)) {
      observations.push({
        icon: '✦',
        text: `You drew from both decks on ${bothCount} of your last ${recent.length} card days.`
      });
    }

    if (!observations.length) {
      el.patternsEmpty.hidden = false;
      el.patternsEmpty.textContent = 'You have enough card days to look, but nothing is repeating strongly enough to call a pattern yet.';
      return;
    }

    el.patternsEmpty.hidden = true;
    observations.slice(0, 5).forEach((observation) => {
      const item = document.createElement('div');
      item.className = 'card-pattern-item';
      item.innerHTML = `<span aria-hidden="true">${escapeHtml(observation.icon)}</span><p>${escapeHtml(observation.text)}</p>`;
      el.patternsList.appendChild(item);
    });
  };

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

  const shareDraftKey = (deck) => `${localDateKey()}:${deck}`;

  const getShareDraft = (deck) => state.data.shareDrafts[shareDraftKey(deck)] || null;

  const defaultOpening = (deck, card) => {
    if (deck !== 'animal') return '';
    const message = String(card?.message || '').trim();
    return /^I(?:\s|['’])/i.test(message) && countWords(message) <= 15 ? message : '';
  };

  const validateOpening = (value) => {
    const words = countWords(value);
    if (!value.trim()) return { valid: true, words, message: '' };
    if (!/^I(?:\s|['’])/i.test(value.trim())) return { valid: false, words, message: 'Start the reflection with “I”.' };
    if (words > 15) return { valid: false, words, message: 'Keep the opening to 15 words or fewer.' };
    return { valid: true, words, message: '' };
  };

  const validateBullets = (bullets) => {
    const tooLong = bullets.findIndex((bullet) => countWords(bullet) > 10);
    if (tooLong >= 0) return { valid: false, message: `Wisdom point ${tooLong + 1} is over 10 words.` };
    return { valid: true, message: '' };
  };

  const updateShareValidation = () => {
    const openingResult = validateOpening(el.shareOpening.value);
    el.shareOpeningCount.textContent = `${openingResult.words} / 15 words`;
    el.shareOpeningError.textContent = openingResult.message;
    el.shareOpening.classList.toggle('has-error', !openingResult.valid);

    const bullets = el.shareBullets.map((input) => input.value.trim());
    const bulletResult = validateBullets(bullets);
    el.shareBulletsStatus.textContent = bulletResult.message;
    el.shareBullets.forEach((input) => input.classList.toggle('has-error', countWords(input.value) > 10));
    return openingResult.valid && bulletResult.valid;
  };

  const openShareDialog = (deck) => {
    const card = state.current[deck];
    if (!card) return;
    state.shareDeck = deck;
    const draft = getShareDraft(deck);
    const image = deck === 'oracle' ? card.front : card.image;

    el.shareCardDeck.textContent = deckConfig[deck].label;
    el.shareCardName.textContent = cardTitle(deck, card);
    el.shareCardSubtitle.textContent = `Shape your ${cardTitle(deck, card)} reflection without changing the card itself.`;
    el.shareCardImage.src = image;
    el.shareCardImage.alt = `${cardTitle(deck, card)} card artwork`;
    el.shareOpening.value = draft?.opening ?? defaultOpening(deck, card);
    el.shareBullets.forEach((input, index) => {
      input.value = draft?.bullets?.[index] || '';
    });
    el.shareCardStatus.textContent = draft ? 'Saved draft restored.' : '';
    updateShareValidation();

    if (typeof el.shareDialog.showModal === 'function') el.shareDialog.showModal();
    else el.shareDialog.setAttribute('open', '');
  };

  const closeShareDialog = () => {
    if (typeof el.shareDialog.close === 'function') el.shareDialog.close();
    else el.shareDialog.removeAttribute('open');
    state.shareDeck = null;
  };

  const saveShareDraft = () => {
    if (!state.shareDeck || !updateShareValidation()) {
      el.shareCardStatus.textContent = 'Fix the word limits before saving.';
      return false;
    }
    const deck = state.shareDeck;
    const card = state.current[deck];
    state.data.shareDrafts[shareDraftKey(deck)] = {
      deck,
      cardId: card.id,
      title: cardTitle(deck, card),
      opening: el.shareOpening.value.trim(),
      bullets: el.shareBullets.map((input) => input.value.trim()),
      savedAt: new Date().toISOString()
    };
    saveState();
    el.shareCardStatus.textContent = 'Share draft saved.';
    return true;
  };

  const buildCaption = () => {
    const opening = el.shareOpening.value.trim();
    const bullets = el.shareBullets.map((input) => input.value.trim()).filter(Boolean);
    return [opening, bullets.length ? bullets.map((item) => `• ${item}`).join('\n') : ''].filter(Boolean).join('\n\n');
  };

  const copyShareCaption = async () => {
    if (!state.shareDeck || !updateShareValidation()) {
      el.shareCardStatus.textContent = 'Fix the word limits before copying.';
      return;
    }
    saveShareDraft();
    const caption = buildCaption();
    if (!caption) {
      el.shareCardStatus.textContent = 'Add an opening or wisdom points before copying.';
      return;
    }
    try {
      await navigator.clipboard.writeText(caption);
      el.shareCardStatus.textContent = 'Caption copied. Facebook can have it now.';
    } catch (error) {
      console.warn('Clipboard copy failed.', error);
      el.shareCardStatus.textContent = 'Copy was blocked by this browser. Your draft is still saved.';
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const saveShareImage = async () => {
    if (!state.shareDeck) return;
    const deck = state.shareDeck;
    const card = state.current[deck];
    const src = deck === 'oracle' ? card.front : card.image;
    el.shareCardStatus.textContent = 'Preparing the card image…';
    try {
      const response = await fetch(src, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Image request failed with ${response.status}.`);
      const blob = await response.blob();
      const slug = cardTitle(deck, card).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      downloadBlob(blob, `${localDateKey()}-${slug}-${deckConfig[deck].label.toLowerCase().replace(/\s+/g, '-')}.webp`);
      el.shareCardStatus.textContent = 'Card image saved.';
    } catch (error) {
      console.error(error);
      el.shareCardStatus.textContent = 'The card image could not be saved. Please try again.';
    }
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
      animalShare: document.getElementById('animal-share'),
      animalStatus: document.getElementById('animal-status'),
      oracleStage: document.getElementById('golden-stage'),
      oracleBack: document.getElementById('golden-back'),
      oracleImage: document.getElementById('golden-image'),
      oracleName: document.getElementById('golden-name'),
      oracleDraw: document.getElementById('golden-draw'),
      oracleReveal: document.getElementById('golden-reveal'),
      oracleReading: document.getElementById('golden-reading'),
      oracleShare: document.getElementById('golden-share'),
      oracleStatus: document.getElementById('golden-status'),
      reflection: document.getElementById('cards-reflection'),
      reflectionSave: document.getElementById('cards-reflection-save'),
      reflectionStatus: document.getElementById('cards-reflection-status'),
      patternsList: document.getElementById('card-patterns-list'),
      patternsEmpty: document.getElementById('card-patterns-empty'),
      historyList: document.getElementById('card-path-list'),
      historyEmpty: document.getElementById('card-path-empty'),
      shareDialog: document.getElementById('share-card-dialog'),
      shareClose: document.getElementById('share-card-close'),
      shareCardSubtitle: document.getElementById('share-card-subtitle'),
      shareCardImage: document.getElementById('share-card-image'),
      shareCardDeck: document.getElementById('share-card-deck'),
      shareCardName: document.getElementById('share-card-name'),
      shareOpening: document.getElementById('share-opening'),
      shareOpeningCount: document.getElementById('share-opening-count'),
      shareOpeningError: document.getElementById('share-opening-error'),
      shareBullets: [...document.querySelectorAll('.share-bullet')],
      shareBulletsStatus: document.getElementById('share-bullets-status'),
      shareDraftSave: document.getElementById('share-draft-save'),
      shareCopy: document.getElementById('share-copy'),
      shareSaveImage: document.getElementById('share-save-image'),
      shareCardStatus: document.getElementById('share-card-status')
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
    el.animalShare.addEventListener('click', () => openShareDialog('animal'));
    el.oracleShare.addEventListener('click', () => openShareDialog('oracle'));
    el.reflectionSave.addEventListener('click', saveReflection);
    el.shareClose.addEventListener('click', closeShareDialog);
    el.shareDialog.addEventListener('click', (event) => {
      if (event.target === el.shareDialog) closeShareDialog();
    });
    el.shareOpening.addEventListener('input', updateShareValidation);
    el.shareBullets.forEach((input) => input.addEventListener('input', updateShareValidation));
    el.shareDraftSave.addEventListener('click', saveShareDraft);
    el.shareCopy.addEventListener('click', copyShareCaption);
    el.shareSaveImage.addEventListener('click', saveShareImage);
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
    renderPatterns();

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
