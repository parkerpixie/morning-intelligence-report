(() => {
  const MANIFEST_URL = 'assets/oracle/oracle-manifest.json?v=20260721-1';
  const TIME_ZONE = 'America/Chicago';
  const DISABLED_ORACLE_IDS = new Set(['otter']);
  const DAILY_REFLECTION_OVERRIDES = {
    '2026-07-21': 'beaver'
  };

  const elements = {
    reflectionCard: document.getElementById('reflection-card'),
    reflectionImage: document.getElementById('reflection-image'),
    reflectionDate: document.getElementById('reflection-date'),
    reflectionAnimal: document.getElementById('reflection-animal'),
    reflectionMessage: document.getElementById('reflection-message'),
    reflectionSave: document.getElementById('reflection-save'),
    reflectionShare: document.getElementById('reflection-share'),
    reflectionShareStatus: document.getElementById('reflection-share-status'),
    oracleCard: document.getElementById('oracle-card'),
    oracleFront: document.getElementById('oracle-front-image'),
    oracleBack: document.getElementById('oracle-back-image'),
    oracleAnimal: document.getElementById('oracle-animal'),
    oracleFlip: document.getElementById('oracle-flip'),
    oracleRedraw: document.getElementById('oracle-redraw'),
    oracleReturn: document.getElementById('oracle-return'),
    oracleEnlarge: document.getElementById('oracle-enlarge'),
    oracleStatus: document.getElementById('oracle-status'),
    oracleHint: document.getElementById('oracle-card-hint'),
    dialog: document.getElementById('oracle-dialog'),
    dialogTitle: document.getElementById('oracle-dialog-title'),
    dialogImage: document.getElementById('oracle-dialog-image'),
    dialogClose: document.getElementById('oracle-dialog-close')
  };

  let oracleCards = [];
  let reflectionCards = [];
  let dailyOracle = null;
  let currentOracle = null;
  let isFlipped = false;

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

  const friendlyDate = () => new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const dailyChoice = (items, salt) => {
    if (!items.length) return null;
    return items[hashString(`${localDateKey()}:${salt}`) % items.length];
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

  const setStatus = (message) => {
    elements.oracleStatus.textContent = message;
  };

  const validateManifest = (manifest) => {
    if (!manifest || !Array.isArray(manifest.oracle_cards) || !Array.isArray(manifest.reflection_cards)) {
      throw new Error('Oracle manifest is incomplete.');
    }
    const validOracle = manifest.oracle_cards.filter((card) =>
      card?.animal && card?.front && card?.back && !DISABLED_ORACLE_IDS.has(card.id)
    );
    const validReflections = manifest.reflection_cards.filter((card) => card?.animal && card?.image);
    if (!validOracle.length || !validReflections.length) throw new Error('Oracle decks are empty.');
    return { oracleCards: validOracle, reflectionCards: validReflections };
  };

  const preload = (src) => {
    const image = new Image();
    image.src = src;
  };

  const setReflection = (reflection) => {
    elements.reflectionImage.src = reflection.image;
    elements.reflectionImage.alt = `${reflection.animal} Spirit Animal of the Day reflection card`;
    elements.reflectionDate.textContent = friendlyDate();
    elements.reflectionAnimal.textContent = reflection.animal;
    elements.reflectionMessage.textContent = reflection.message || 'A reflection selected for today.';
    elements.reflectionCard.classList.remove('is-loading');
    elements.reflectionCard.setAttribute('aria-busy', 'false');
    elements.reflectionSave.disabled = false;
    elements.reflectionShare.disabled = false;
  };

  const setFlipState = (nextState, announce = true) => {
    isFlipped = Boolean(nextState);
    elements.oracleCard.classList.toggle('is-flipped', isFlipped);
    elements.oracleCard.setAttribute('aria-pressed', String(isFlipped));
    elements.oracleBack.parentElement?.setAttribute('aria-hidden', String(!isFlipped));
    elements.oracleFlip.textContent = isFlipped ? 'Turn to the front' : 'Reveal the message';
    elements.oracleHint.textContent = isFlipped
      ? 'The full reading is on the back. Open it larger for easier reading.'
      : 'Tap the card to reveal its message.';
    elements.oracleEnlarge.hidden = !isFlipped;
    elements.oracleCard.setAttribute(
      'aria-label',
      isFlipped
        ? `${currentOracle?.animal || 'Oracle'} card message. Turn back to the front.`
        : `${currentOracle?.animal || 'Oracle'} card. Reveal the message.`
    );
    if (announce && currentOracle) {
      setStatus(isFlipped ? `${currentOracle.animal} has revealed its full reading.` : `${currentOracle.animal} is showing its front.`);
    }
  };

  const setOracle = (card, { daily = false, animate = false } = {}) => {
    if (!card) return;
    currentOracle = card;
    setFlipState(false, false);
    elements.oracleAnimal.textContent = card.animal;
    elements.oracleFront.src = card.front;
    elements.oracleFront.alt = `${card.animal} oracle card front`;
    elements.oracleBack.src = card.back;
    elements.oracleBack.alt = `${card.animal} oracle card full reading`;
    elements.oracleCard.disabled = false;
    elements.oracleFlip.disabled = false;
    elements.oracleRedraw.disabled = oracleCards.length < 2;
    elements.oracleCard.classList.remove('is-loading');
    elements.oracleReturn.hidden = daily || card.id === dailyOracle?.id;
    preload(card.back);

    if (animate) {
      elements.oracleCard.classList.remove('is-drawing');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => elements.oracleCard.classList.add('is-drawing'));
      });
    }

    setStatus(daily ? `${card.animal} is your card for ${friendlyDate()}.` : `${card.animal} stepped forward for this draw.`);
  };

  const chooseDailyOracle = (reflection) => {
    const matched = reflection?.oracle_match
      ? oracleCards.find((card) => card.id === reflection.oracle_match)
      : null;
    return matched || dailyChoice(oracleCards, 'morning-oracle');
  };

  const drawAnother = () => {
    if (oracleCards.length < 2) return;
    let next = currentOracle;
    for (let attempts = 0; attempts < 8 && next?.id === currentOracle?.id; attempts += 1) {
      next = oracleCards[randomIndex(oracleCards.length)];
    }
    if (next?.id === currentOracle?.id) {
      const currentIndex = oracleCards.findIndex((card) => card.id === currentOracle.id);
      next = oracleCards[(currentIndex + 1) % oracleCards.length];
    }
    setOracle(next, { animate: true });
  };

  const openLargeReading = () => {
    if (!currentOracle) return;
    elements.dialogTitle.textContent = `${currentOracle.animal} oracle reading`;
    elements.dialogImage.src = isFlipped ? currentOracle.back : currentOracle.front;
    elements.dialogImage.alt = isFlipped
      ? `${currentOracle.animal} oracle card full reading`
      : `${currentOracle.animal} oracle card front`;
    if (typeof elements.dialog.showModal === 'function') elements.dialog.showModal();
    else window.open(elements.dialogImage.src, '_blank', 'noopener,noreferrer');
  };

  const downloadImage = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const reflectionFilename = () => {
    const animal = elements.reflectionAnimal.textContent || 'spirit-animal';
    const slug = animal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `${localDateKey()}-${slug}-spirit-animal.png`;
  };

  const fetchReflectionBlob = async () => {
    const response = await fetch(elements.reflectionImage.src, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Reflection image request failed with ${response.status}.`);
    return response.blob();
  };

  const saveReflectionImage = async () => {
    elements.reflectionSave.disabled = true;
    elements.reflectionShareStatus.textContent = 'Preparing your image…';
    try {
      downloadImage(await fetchReflectionBlob(), reflectionFilename());
      elements.reflectionShareStatus.textContent = 'Image saved.';
    } catch (error) {
      console.error(error);
      elements.reflectionShareStatus.textContent = 'The image could not be saved. Please try again.';
    } finally {
      elements.reflectionSave.disabled = false;
    }
  };

  const shareReflectionWithThoughts = async () => {
    elements.reflectionShare.disabled = true;
    elements.reflectionShareStatus.textContent = 'Preparing your image…';
    try {
      const blob = await fetchReflectionBlob();
      const file = new File([blob], reflectionFilename(), { type: blob.type || 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${elements.reflectionAnimal.textContent} — Spirit Animal of the Day`,
          text: 'My Spirit Animal of the Day, with a few thoughts of my own.'
        });
        elements.reflectionShareStatus.textContent = 'Your image is ready to share with your thoughts.';
      } else {
        downloadImage(blob, reflectionFilename());
        elements.reflectionShareStatus.textContent = 'Image saved. Facebook is opening—attach it and add your thoughts.';
        window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        elements.reflectionShareStatus.textContent = 'Sharing canceled. Your image is still right here.';
      } else {
        console.error(error);
        elements.reflectionShareStatus.textContent = 'The image could not be prepared. Please try again.';
      }
    } finally {
      elements.reflectionShare.disabled = false;
    }
  };

  const bindEvents = () => {
    elements.oracleCard.addEventListener('click', () => setFlipState(!isFlipped));
    elements.oracleFlip.addEventListener('click', () => setFlipState(!isFlipped));
    elements.oracleRedraw.addEventListener('click', drawAnother);
    elements.reflectionSave.addEventListener('click', saveReflectionImage);
    elements.reflectionShare.addEventListener('click', shareReflectionWithThoughts);
    elements.oracleReturn.addEventListener('click', () => setOracle(dailyOracle, { daily: true, animate: true }));
    elements.oracleEnlarge.addEventListener('click', openLargeReading);
    elements.dialogClose.addEventListener('click', () => elements.dialog.close());
    elements.dialog.addEventListener('click', (event) => {
      if (event.target === elements.dialog) elements.dialog.close();
    });
    elements.oracleCard.addEventListener('animationend', () => elements.oracleCard.classList.remove('is-drawing'));
  };

  const showError = (error) => {
    console.error(error);
    elements.reflectionCard.classList.remove('is-loading');
    elements.reflectionCard.setAttribute('aria-busy', 'false');
    elements.reflectionAnimal.textContent = 'The animal council is briefly unavailable';
    elements.reflectionMessage.textContent = 'Clementine recommends trying again after the clouds finish arguing with the filing system.';
    elements.oracleCard.classList.remove('is-loading');
    elements.oracleCard.disabled = true;
    elements.oracleFlip.disabled = true;
    elements.oracleRedraw.disabled = true;
    elements.reflectionSave.disabled = true;
    elements.reflectionShare.disabled = true;
    setStatus('The oracle deck could not be loaded. Refresh the page to try again.');
  };

  const start = async () => {
    bindEvents();
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Oracle manifest request failed with ${response.status}.`);
      const validated = validateManifest(await response.json());
      oracleCards = validated.oracleCards;
      reflectionCards = validated.reflectionCards;
      const matchedReflections = reflectionCards.filter((card) =>
        card.oracle_match && oracleCards.some((oracle) => oracle.id === card.oracle_match)
      );
      const reflectionPool = matchedReflections.length ? matchedReflections : reflectionCards;
      const overrideId = DAILY_REFLECTION_OVERRIDES[localDateKey()];
      const reflection = reflectionPool.find((card) => card.id === overrideId)
        || dailyChoice(reflectionPool, 'spirit-animal-reflection');
      setReflection(reflection);
      dailyOracle = chooseDailyOracle(reflection);
      setOracle(dailyOracle, { daily: true, animate: true });
    } catch (error) {
      showError(error);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
