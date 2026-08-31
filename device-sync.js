(() => {
  const TIME_ZONE = 'America/Chicago';
  const CARD_STORAGE_KEY = 'mir:cardDecks:v1';
  const JOURNAL_STORAGE_KEY = 'mir:journal:v1';
  const SYNC_SECRET_KEY = 'mir:personalSync:secret:v1';
  const SHADOW_PREFIX = 'mir:personalSync:shadow:v1:';
  const ENDPOINT = '/api/personal-sync';
  const PERSONAL_PAGES = new Set(['capybara', 'journal']);
  const KNOWN_PULL_DATE = '2026-08-31';
  const KNOWN_PULLS = {
    animal: { cardId: 'hawk', title: 'Hawk', drawnAt: '2026-08-31T10:55:00.000Z' },
    oracle: { cardId: 'dolphin', title: 'Dolphin', drawnAt: '2026-08-31T10:57:00.000Z' }
  };

  const page = document.body?.dataset?.page || '';
  if (!PERSONAL_PAGES.has(page)) return;

  const fallbackFor = (namespace) => namespace === 'cards'
    ? { version: 1, pulls: {}, reflections: {}, shareDrafts: {} }
    : { version: 1, entries: {} };

  const readJson = (key, fallback) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : structuredClone(fallback);
    } catch {
      return structuredClone(fallback);
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Cross-device sync could not update local storage.', error);
      return false;
    }
  };

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

  const rescueKnownPulls = (cards) => {
    const next = cards && typeof cards === 'object' ? cards : fallbackFor('cards');
    next.version = 1;
    next.pulls ||= {};
    next.reflections ||= {};
    next.shareDrafts ||= {};
    if (localDateKey() === KNOWN_PULL_DATE) {
      next.pulls[KNOWN_PULL_DATE] ||= {};
      next.pulls[KNOWN_PULL_DATE].animal = { ...KNOWN_PULLS.animal };
      next.pulls[KNOWN_PULL_DATE].oracle = { ...KNOWN_PULLS.oracle };
    }
    return next;
  };

  // Rescue today's iPhone pulls before the page's own card/journal scripts read localStorage.
  writeJson(CARD_STORAGE_KEY, rescueKnownPulls(readJson(CARD_STORAGE_KEY, fallbackFor('cards'))));

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const bytesToBase64Url = (bytes) => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  };

  const base64UrlToBytes = (value) => {
    const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const isValidSecret = (value) => {
    try { return base64UrlToBytes(value).length === 32; }
    catch { return false; }
  };

  const importedSecret = () => {
    if (!location.hash.startsWith('#sync=')) return null;
    const value = decodeURIComponent(location.hash.slice(6));
    if (!isValidSecret(value)) return null;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    return value;
  };

  const ensureSecret = () => {
    const imported = importedSecret();
    if (imported) {
      localStorage.setItem(SYNC_SECRET_KEY, imported);
      return { secret: imported, imported: true };
    }

    const stored = localStorage.getItem(SYNC_SECRET_KEY);
    if (stored && isValidSecret(stored)) return { secret: stored, imported: false };

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = bytesToBase64Url(bytes);
    localStorage.setItem(SYNC_SECRET_KEY, secret);
    return { secret, imported: false };
  };

  const sha256Hex = async (bytes) => {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
  };

  const importAesKey = (bytes) => crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const encryptJson = async (key, value) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = textEncoder.encode(JSON.stringify(value));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
    return { iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(encrypted) };
  };

  const decryptJson = async (key, record) => {
    const iv = base64UrlToBytes(record.iv);
    const encrypted = base64UrlToBytes(record.ciphertext);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return JSON.parse(textDecoder.decode(plaintext));
  };

  const post = async (payload, keepalive = false) => {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      keepalive
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Sync request failed with ${response.status}.`);
    return body;
  };

  const parseTime = (value) => {
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : 0;
  };

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const chooseThreeWay = (local, remote, base) => {
    if (same(local, remote)) return local;
    if (base !== undefined) {
      if (same(local, base) && !same(remote, base)) return remote;
      if (same(remote, base) && !same(local, base)) return local;
    }
    if (local === undefined || local === null || local === '') return remote;
    if (remote === undefined || remote === null || remote === '') return local;
    return local;
  };

  const choosePull = (local, remote) => {
    if (!local) return remote;
    if (!remote) return local;
    const localTime = parseTime(local.drawnAt) || Number.MAX_SAFE_INTEGER;
    const remoteTime = parseTime(remote.drawnAt) || Number.MAX_SAFE_INTEGER;
    if (localTime < remoteTime) return local;
    if (remoteTime < localTime) return remote;
    if (local.cardId === remote.cardId) return { ...remote, ...local };
    return local;
  };

  const chooseDraft = (local, remote, base) => {
    if (!local) return remote;
    if (!remote) return local;
    const localTime = parseTime(local.savedAt);
    const remoteTime = parseTime(remote.savedAt);
    if (localTime > remoteTime) return local;
    if (remoteTime > localTime) return remote;
    return chooseThreeWay(local, remote, base);
  };

  const mergeCards = (localRaw, remoteRaw, baseRaw) => {
    const local = rescueKnownPulls(localRaw || fallbackFor('cards'));
    const remote = rescueKnownPulls(remoteRaw || fallbackFor('cards'));
    const base = baseRaw || fallbackFor('cards');
    const merged = { version: 1, pulls: {}, reflections: {}, shareDrafts: {} };

    const dates = new Set([...Object.keys(local.pulls || {}), ...Object.keys(remote.pulls || {})]);
    for (const date of dates) {
      const day = {};
      const animal = choosePull(local.pulls?.[date]?.animal, remote.pulls?.[date]?.animal);
      const oracle = choosePull(local.pulls?.[date]?.oracle, remote.pulls?.[date]?.oracle);
      if (animal) day.animal = animal;
      if (oracle) day.oracle = oracle;
      if (Object.keys(day).length) merged.pulls[date] = day;
    }

    const reflectionDates = new Set([
      ...Object.keys(local.reflections || {}),
      ...Object.keys(remote.reflections || {}),
      ...Object.keys(base.reflections || {})
    ]);
    for (const date of reflectionDates) {
      const value = chooseThreeWay(local.reflections?.[date], remote.reflections?.[date], base.reflections?.[date]);
      if (value) merged.reflections[date] = value;
    }

    const draftKeys = new Set([
      ...Object.keys(local.shareDrafts || {}),
      ...Object.keys(remote.shareDrafts || {})
    ]);
    for (const key of draftKeys) {
      const value = chooseDraft(local.shareDrafts?.[key], remote.shareDrafts?.[key], base.shareDrafts?.[key]);
      if (value) merged.shareDrafts[key] = value;
    }

    return rescueKnownPulls(merged);
  };

  const entryTime = (entry) => Math.max(parseTime(entry?.updatedAt), parseTime(entry?.aiUpdatedAt));

  const mergeJournal = (localRaw, remoteRaw, baseRaw) => {
    const local = localRaw || fallbackFor('journal');
    const remote = remoteRaw || fallbackFor('journal');
    const base = baseRaw || fallbackFor('journal');
    const merged = { version: 1, entries: {} };
    const dates = new Set([
      ...Object.keys(local.entries || {}),
      ...Object.keys(remote.entries || {}),
      ...Object.keys(base.entries || {})
    ]);

    for (const date of dates) {
      const localEntry = local.entries?.[date];
      const remoteEntry = remote.entries?.[date];
      if (!localEntry) {
        if (remoteEntry) merged.entries[date] = remoteEntry;
        continue;
      }
      if (!remoteEntry) {
        merged.entries[date] = localEntry;
        continue;
      }
      const localTime = entryTime(localEntry);
      const remoteTime = entryTime(remoteEntry);
      if (localTime > remoteTime) merged.entries[date] = localEntry;
      else if (remoteTime > localTime) merged.entries[date] = remoteEntry;
      else merged.entries[date] = chooseThreeWay(localEntry, remoteEntry, base.entries?.[date]);
    }
    return merged;
  };

  const storageKeyFor = (namespace) => namespace === 'cards' ? CARD_STORAGE_KEY : JOURNAL_STORAGE_KEY;
  const mergeFor = (namespace) => namespace === 'cards' ? mergeCards : mergeJournal;

  let syncContext = null;
  let syncPanel = null;
  let syncStatus = null;
  let pairButton = null;
  let syncInFlight = null;
  let lastRaw = {};

  const setStatus = (message, mode = '') => {
    if (!syncStatus) return;
    syncStatus.textContent = message;
    syncStatus.dataset.mode = mode;
  };

  const injectStyles = () => {
    if (document.getElementById('mir-device-sync-styles')) return;
    const style = document.createElement('style');
    style.id = 'mir-device-sync-styles';
    style.textContent = `
      .mir-sync-panel{margin:18px 0 28px;padding:16px 18px;border:1px solid rgba(61,105,105,.24);border-radius:16px;background:linear-gradient(135deg,rgba(236,246,242,.96),rgba(247,240,246,.94));box-shadow:0 10px 30px rgba(29,51,56,.08);display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
      .mir-sync-copy{min-width:240px;flex:1}.mir-sync-kicker{margin:0 0 4px;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#58726f}.mir-sync-copy strong{display:block;color:#173b45;font-size:1rem;margin-bottom:3px}.mir-sync-copy p{margin:0;color:#4c5c5e;font-size:.9rem;line-height:1.45}
      .mir-sync-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.mir-sync-button{border:0;border-radius:999px;padding:10px 14px;background:#173b45;color:white;font:inherit;font-weight:750;cursor:pointer}.mir-sync-button:hover{filter:brightness(1.08)}.mir-sync-status{font-size:.82rem;color:#58726f;max-width:220px}.mir-sync-status[data-mode="error"]{color:#8b3a4a}
      @media(max-width:640px){.mir-sync-panel{align-items:flex-start}.mir-sync-actions{width:100%}.mir-sync-button{width:100%}.mir-sync-status{max-width:none}}
    `;
    document.head.appendChild(style);
  };

  const injectPanel = () => {
    injectStyles();
    if (document.querySelector('.mir-sync-panel')) return;
    syncPanel = document.createElement('section');
    syncPanel.className = 'mir-sync-panel';
    syncPanel.setAttribute('aria-label', 'Private device sync');

    const copy = document.createElement('div');
    copy.className = 'mir-sync-copy';
    copy.innerHTML = '<p class="mir-sync-kicker">Private device sync</p><strong>Your cards and journal can travel with you.</strong><p>Everything personal is encrypted in this browser before it is stored. Keep the pairing link private because it unlocks your synced copy.</p>';

    const actions = document.createElement('div');
    actions.className = 'mir-sync-actions';
    pairButton = document.createElement('button');
    pairButton.type = 'button';
    pairButton.className = 'mir-sync-button';
    pairButton.textContent = 'Pair another device';
    syncStatus = document.createElement('span');
    syncStatus.className = 'mir-sync-status';
    syncStatus.setAttribute('role', 'status');
    syncStatus.setAttribute('aria-live', 'polite');
    syncStatus.textContent = 'Preparing secure sync…';
    actions.append(pairButton, syncStatus);
    syncPanel.append(copy, actions);

    const target = page === 'journal'
      ? document.querySelector('.journal-hero')
      : document.querySelector('.card-decks-intro');
    if (target) target.insertAdjacentElement('afterend', syncPanel);
    else document.querySelector('main')?.prepend(syncPanel);

    const localNote = document.querySelector('.journal-local-note');
    if (localNote) localNote.textContent = 'Entries are encrypted in your browser and synced across paired devices.';
  };

  const loadRemote = async (namespace) => {
    const payload = await post({ action: 'load', sync_id: syncContext.syncId, namespace });
    if (!payload.found) return null;
    try {
      return await decryptJson(syncContext.key, payload.record);
    } catch (error) {
      console.warn(`Could not decrypt synced ${namespace} data.`, error);
      throw new Error('This device could not unlock the synced copy. Re-pair it from a device that already works.');
    }
  };

  const saveRemote = async (namespace, value) => {
    const encrypted = await encryptJson(syncContext.key, value);
    return post({
      action: 'save',
      sync_id: syncContext.syncId,
      namespace,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      client_updated_at: new Date().toISOString()
    }, true);
  };

  const syncNamespace = async (namespace) => {
    const storageKey = storageKeyFor(namespace);
    const fallback = fallbackFor(namespace);
    const local = namespace === 'cards'
      ? rescueKnownPulls(readJson(storageKey, fallback))
      : readJson(storageKey, fallback);
    const shadow = readJson(`${SHADOW_PREFIX}${namespace}`, fallback);
    const remote = await loadRemote(namespace);
    const merged = remote ? mergeFor(namespace)(local, remote, shadow) : local;
    const changedLocal = !same(local, merged);
    if (changedLocal) writeJson(storageKey, merged);
    await saveRemote(namespace, merged);
    writeJson(`${SHADOW_PREFIX}${namespace}`, merged);
    lastRaw[namespace] = localStorage.getItem(storageKey) || '';
    return changedLocal;
  };

  const reloadIfNeeded = (changed) => {
    const marker = `mir:personalSync:reload:${syncContext.syncId.slice(0, 12)}:${page}`;
    if (!changed) {
      sessionStorage.removeItem(marker);
      return false;
    }
    if (sessionStorage.getItem(marker) === '1') return false;
    sessionStorage.setItem(marker, '1');
    location.reload();
    return true;
  };

  const syncAll = async ({ allowReload = false } = {}) => {
    if (!syncContext) return false;
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      try {
        setStatus('Syncing encrypted copy…');
        const cardChanged = await syncNamespace('cards');
        const journalChanged = await syncNamespace('journal');
        const changed = cardChanged || journalChanged;
        setStatus('Securely synced.');
        if (allowReload && reloadIfNeeded(changed)) return true;
        if (!changed) reloadIfNeeded(false);
        return changed;
      } catch (error) {
        console.warn('Private device sync is temporarily unavailable.', error);
        setStatus(error.message || 'Sync is unavailable. Your local copy is still safe.', 'error');
        return false;
      } finally {
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  };

  const pairingLink = () => `${location.origin}/capybara.html#sync=${encodeURIComponent(syncContext.secret)}`;

  const sharePairingLink = async () => {
    const url = pairingLink();
    const shareData = {
      title: 'Morning Intelligence Report device sync',
      text: 'Private pairing link for my Morning Intelligence Report. Keep this link private.',
      url
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setStatus('Pairing link ready for your other device.');
      } else {
        await navigator.clipboard.writeText(url);
        setStatus('Private pairing link copied. Open it on your other device.');
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setStatus('Private pairing link copied. Open it on your other device.');
      } catch {
        setStatus('Could not share the pairing link from this browser.', 'error');
      }
    }
  };

  const monitorLocalChanges = () => {
    ['cards', 'journal'].forEach((namespace) => {
      const storageKey = storageKeyFor(namespace);
      lastRaw[namespace] = localStorage.getItem(storageKey) || '';
    });

    window.setInterval(() => {
      let changed = false;
      for (const namespace of ['cards', 'journal']) {
        const raw = localStorage.getItem(storageKeyFor(namespace)) || '';
        if (raw !== lastRaw[namespace]) {
          lastRaw[namespace] = raw;
          changed = true;
        }
      }
      if (changed) syncAll({ allowReload: false });
    }, 1500);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncAll({ allowReload: true });
    });
    window.addEventListener('online', () => syncAll({ allowReload: true }));
  };

  const start = async () => {
    injectPanel();
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
      setStatus('This browser cannot use encrypted sync. Your local copy still works.', 'error');
      pairButton.disabled = true;
      return;
    }

    const { secret, imported } = ensureSecret();
    const secretBytes = base64UrlToBytes(secret);
    const [key, syncId] = await Promise.all([importAesKey(secretBytes), sha256Hex(secretBytes)]);
    syncContext = { secret, key, syncId };
    pairButton.addEventListener('click', sharePairingLink);
    if (imported) setStatus('Pairing this device…');
    await syncAll({ allowReload: true });
    monitorLocalChanges();
  };

  start().catch((error) => {
    console.warn('Private device sync could not start.', error);
    injectPanel();
    setStatus('Sync could not start. Your on-device copy is still safe.', 'error');
  });
})();
