(() => {
  const TIME_ZONE = 'America/Chicago';
  const CARD_KEY = 'mir:cardDecks:v1';
  const JOURNAL_KEY = 'mir:journal:v1';
  const FEELINGS_KEY = 'morning-intelligence-report:dbt-checkins:v1';

  const FAMILY_COLORS = {
    Happy: '#e1b75b',
    Surprised: '#e29a61',
    'Bad / Off': '#8c8993',
    Fearful: '#9386bd',
    Angry: '#d97873',
    Disgusted: '#7ea88d',
    Sad: '#77a8c5'
  };

  const state = {
    month: null,
    selectedDate: null,
    filter: 'all',
    journal: { entries: {} },
    cards: { pulls: {}, reflections: {} },
    feelings: []
  };

  const el = {};
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (error) { console.warn(`Could not read ${key}.`, error); return fallback; }
  };

  const localDateKey = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const partsForKey = (key) => key.split('-').map(Number);
  const dateAtNoon = (key) => {
    const [year, month, day] = partsForKey(key);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };
  const friendlyDate = (key) => new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }).format(dateAtNoon(key));
  const shortDate = (key) => new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric'
  }).format(dateAtNoon(key));

  const load = () => {
    state.journal = readJson(JOURNAL_KEY, { version: 1, entries: {} });
    state.cards = readJson(CARD_KEY, { version: 1, pulls: {}, reflections: {} });
    state.feelings = readJson(FEELINGS_KEY, []);
    if (!state.journal?.entries) state.journal = { version: 1, entries: {} };
    if (!state.cards?.pulls) state.cards = { ...state.cards, pulls: {} };
    if (!state.cards?.reflections) state.cards.reflections = {};
    if (!Array.isArray(state.feelings)) state.feelings = [];
  };

  const feelingsForDate = (date) => state.feelings
    .filter((entry) => entry?.date === date)
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

  const activityForDate = (date) => {
    const journal = state.journal.entries?.[date] || {};
    const pulls = state.cards.pulls?.[date] || {};
    const rawReflection = journal.cardReflectionRaw || state.cards.reflections?.[date] || '';
    const feelingEntries = feelingsForDate(date);
    return {
      date,
      pulls,
      journal,
      feelings: feelingEntries,
      hasCards: Boolean(pulls.animal || pulls.oracle),
      hasRawReflection: Boolean(String(rawReflection).trim()),
      hasSavedReflection: Boolean(String(journal.dailyReflection || '').trim()),
      hasJournal: Boolean(String(journal.text || '').trim()),
      hasAi: Boolean(String(journal.aiReflection || '').trim()),
      hasDbt: feelingEntries.some((entry) => entry.skill),
      rawReflection
    };
  };

  const allDates = () => {
    const dates = new Set([
      ...Object.keys(state.journal.entries || {}),
      ...Object.keys(state.cards.pulls || {}),
      ...state.feelings.map((entry) => entry?.date).filter(Boolean)
    ]);
    return [...dates].sort();
  };

  const dateMatchesFilter = (activity) => {
    if (state.filter === 'reflections') return activity.hasRawReflection || activity.hasSavedReflection;
    if (state.filter === 'journal') return activity.hasJournal;
    if (state.filter === 'feelings') return activity.feelings.length > 0;
    if (state.filter === 'dbt') return activity.hasDbt;
    return activity.hasCards || activity.hasRawReflection || activity.hasSavedReflection || activity.hasJournal || activity.feelings.length || activity.hasAi;
  };

  const badge = (kind, label) => `<span class="day-activity day-activity--${kind}" title="${esc(label)}" aria-label="${esc(label)}">${esc(kind.slice(0, 1).toUpperCase())}</span>`;

  const renderCalendar = () => {
    const current = state.month;
    const year = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const today = localDateKey();

    el.monthLabel.textContent = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const activity = activityForDate(date);
      const visible = dateMatchesFilter(activity);
      const marks = [];
      if (activity.hasSavedReflection || activity.hasRawReflection) marks.push(badge('reflection', activity.hasSavedReflection ? 'Saved Daily Reflection' : 'Card reflection thoughts'));
      if (activity.hasJournal) marks.push(badge('journal', 'Journal entry'));
      if (activity.hasDbt) marks.push(badge('dbt', 'DBT skill used'));
      else if (activity.hasCards && !marks.length) marks.push(badge('cards', 'Cards drawn'));

      const feelingDots = activity.feelings.slice(0, 5).map((entry) => {
        const color = FAMILY_COLORS[entry.family] || '#8c8993';
        return `<i class="day-feeling-dot" style="--feeling:${color}" title="${esc(entry.outer?.join(' + ') || entry.family || 'Feeling check-in')}"></i>`;
      }).join('');
      const overflow = activity.feelings.length > 5 ? `<span class="day-feeling-more">+${activity.feelings.length - 5}</span>` : '';

      const hasAnything = activity.hasCards || activity.hasRawReflection || activity.hasSavedReflection || activity.hasJournal || activity.feelings.length || activity.hasAi;
      cells.push(`
        <button type="button" class="intelligence-day ${d.getMonth() !== month ? 'is-outside' : ''} ${date === today ? 'is-today' : ''} ${date === state.selectedDate ? 'is-selected' : ''} ${hasAnything ? 'has-activity' : ''} ${visible ? '' : 'is-filtered'}" data-date="${date}" aria-label="${esc(friendlyDate(date))}">
          <span class="intelligence-day-number">${d.getDate()}</span>
          <span class="intelligence-day-activity">${marks.join('')}</span>
          <span class="intelligence-day-feelings">${feelingDots}${overflow}</span>
        </button>
      `);
    }
    el.grid.innerHTML = cells.join('');
    el.grid.querySelectorAll('[data-date]').forEach((button) => button.addEventListener('click', () => selectDate(button.dataset.date)));
    renderMonthSummary();
  };

  const renderLegend = () => {
    el.legend.innerHTML = `
      <span><b class="legend-badge legend-badge--reflection">R</b> reflection</span>
      <span><b class="legend-badge legend-badge--journal">J</b> journal</span>
      <span><b class="legend-badge legend-badge--dbt">D</b> DBT skill</span>
      <span><i class="legend-feeling"></i> each feeling check-in</span>
    `;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const storyItem = ({ time = '', type, title, meta = '', body = '', color = '' }) => `
    <article class="day-story-item" ${color ? `style="--story-color:${color}"` : ''}>
      <div class="day-story-rail"><span></span></div>
      <div class="day-story-copy">
        <div class="day-story-top"><span class="day-story-type">${esc(type)}</span>${time ? `<time>${esc(time)}</time>` : ''}</div>
        <h4>${esc(title)}</h4>
        ${meta ? `<p class="day-story-meta">${esc(meta)}</p>` : ''}
        ${body ? `<p>${esc(body)}</p>` : ''}
      </div>
    </article>`;

  const renderDayStory = () => {
    const date = state.selectedDate;
    const activity = activityForDate(date);
    const items = [];
    const pulls = activity.pulls || {};

    [pulls.animal, pulls.oracle].filter(Boolean).forEach((pull) => {
      items.push({
        sort: pull.drawnAt || `${date}T06:00:00`,
        html: storyItem({
          time: formatTime(pull.drawnAt),
          type: 'Card draw',
          title: pull.title || 'Daily card',
          meta: pull === pulls.animal ? 'Animal Wisdom' : 'Golden Oracle'
        })
      });
    });

    if (activity.rawReflection) {
      items.push({
        sort: activity.journal.cardReflectionUpdatedAt || activity.journal.updatedAt || `${date}T07:00:00`,
        html: storyItem({ type: 'Morning reflection', title: 'My original card thoughts', body: activity.rawReflection })
      });
    }
    if (activity.hasSavedReflection) {
      items.push({
        sort: activity.journal.dailyReflectionSavedAt || activity.journal.updatedAt || `${date}T07:30:00`,
        html: storyItem({ type: 'Saved reflection', title: 'Daily Reflection', body: activity.journal.dailyReflection })
      });
    }

    activity.feelings.forEach((entry) => {
      const feelings = entry.outer?.join(' + ') || entry.middle || entry.family || 'Feeling check-in';
      items.push({
        sort: entry.timestamp || `${date}T12:00:00`,
        html: storyItem({
          time: formatTime(entry.timestamp),
          type: 'Feeling check-in',
          title: feelings,
          meta: `${entry.family || 'Feeling'}${entry.middle ? ` → ${entry.middle}` : ''} · intensity ${entry.intensity || '?'}/10${entry.skill ? ` · ${entry.skill}` : ''}`,
          body: entry.note || '',
          color: FAMILY_COLORS[entry.family] || '#8c8993'
        })
      });
    });

    if (activity.hasJournal) {
      items.push({
        sort: activity.journal.updatedAt || `${date}T20:00:00`,
        html: storyItem({
          time: formatTime(activity.journal.updatedAt),
          type: 'Journal',
          title: 'What else was on my mind',
          body: activity.journal.text
        })
      });
    }
    if (activity.hasAi) {
      items.push({
        sort: activity.journal.aiUpdatedAt || activity.journal.updatedAt || `${date}T20:30:00`,
        html: storyItem({
          time: formatTime(activity.journal.aiUpdatedAt),
          type: 'AI reflection',
          title: 'A second set of eyes',
          body: activity.journal.aiReflection
        })
      });
    }

    items.sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
    const firstFeeling = activity.feelings[0];
    const lastFeeling = activity.feelings.at(-1);
    const skillCount = activity.feelings.filter((entry) => entry.skill).length;
    const summaryBits = [
      activity.feelings.length ? `${activity.feelings.length} feeling check-in${activity.feelings.length === 1 ? '' : 's'}` : '',
      skillCount ? `${skillCount} DBT skill${skillCount === 1 ? '' : 's'}` : '',
      activity.hasSavedReflection ? 'saved morning reflection' : activity.hasRawReflection ? 'morning thoughts saved' : '',
      activity.hasJournal ? 'journal entry' : ''
    ].filter(Boolean);

    el.storyTitle.textContent = friendlyDate(date);
    el.storySummary.textContent = summaryBits.length ? summaryBits.join(' · ') : 'Nothing recorded here yet.';
    el.story.innerHTML = items.length ? items.map((item) => item.html).join('') : '<p class="calendar-empty">This day is still blank. No judgment, no streak punishment.</p>';

    if (firstFeeling && lastFeeling && firstFeeling.id !== lastFeeling.id) {
      el.storyShift.hidden = false;
      el.storyShift.innerHTML = `<strong>Emotional arc:</strong> ${esc(firstFeeling.outer?.join(' + ') || firstFeeling.family)} → ${esc(lastFeeling.outer?.join(' + ') || lastFeeling.family)}`;
    } else {
      el.storyShift.hidden = true;
      el.storyShift.textContent = '';
    }
  };

  const selectDate = (date) => {
    state.selectedDate = date;
    const [year, month] = partsForKey(date);
    if (state.month.getFullYear() !== year || state.month.getMonth() !== month - 1) state.month = new Date(year, month - 1, 1);
    renderCalendar();
    renderDayStory();
  };

  const daysBetween = (endKey, count) => {
    const end = dateAtNoon(endKey);
    const days = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return days;
  };

  const renderPatterns = () => {
    const today = localDateKey();
    const last7 = daysBetween(today, 7);
    const last30 = daysBetween(today, 30);
    const allFeelings7 = state.feelings.filter((entry) => last7.includes(entry.date));
    const allFeelings30 = state.feelings.filter((entry) => last30.includes(entry.date));
    const skillEntries30 = allFeelings30.filter((entry) => entry.skill);
    const familyCounts = {};
    allFeelings30.forEach((entry) => { if (entry.family) familyCounts[entry.family] = (familyCounts[entry.family] || 0) + 1; });
    const mostCommon = Object.entries(familyCounts).sort((a, b) => b[1] - a[1])[0];
    const reflectionDays = last30.filter((date) => {
      const a = activityForDate(date);
      return a.hasRawReflection || a.hasSavedReflection;
    }).length;
    const journalDays = last30.filter((date) => activityForDate(date).hasJournal).length;
    const checkinDays7 = new Set(allFeelings7.map((entry) => entry.date)).size;

    const skillCounts = {};
    skillEntries30.forEach((entry) => { skillCounts[entry.skill] = (skillCounts[entry.skill] || 0) + 1; });
    const topSkill = Object.entries(skillCounts).sort((a, b) => b[1] - a[1])[0];

    el.patterns.innerHTML = `
      <div class="pattern-card"><strong>${reflectionDays}</strong><span>reflection days · last 30</span></div>
      <div class="pattern-card"><strong>${journalDays}</strong><span>journal days · last 30</span></div>
      <div class="pattern-card"><strong>${allFeelings30.length}</strong><span>feeling check-ins · last 30</span></div>
      <div class="pattern-card"><strong>${checkinDays7}</strong><span>check-in days · last 7</span></div>
      ${mostCommon ? `<div class="pattern-card pattern-card--wide"><strong>${esc(mostCommon[0])}</strong><span>most logged feeling family · ${mostCommon[1]} check-ins</span></div>` : ''}
      ${topSkill ? `<div class="pattern-card pattern-card--wide"><strong>${esc(topSkill[0])}</strong><span>most-used DBT skill · ${topSkill[1]} times</span></div>` : ''}
    `;
  };

  const renderMonthSummary = () => {
    const year = state.month.getFullYear();
    const month = state.month.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dates = allDates().filter((date) => date.startsWith(prefix));
    const activities = dates.map(activityForDate);
    const feelings = state.feelings.filter((entry) => entry.date?.startsWith(prefix));
    const reflectionDays = activities.filter((a) => a.hasRawReflection || a.hasSavedReflection).length;
    const journalDays = activities.filter((a) => a.hasJournal).length;
    const dbtUses = feelings.filter((entry) => entry.skill).length;
    el.monthSummary.innerHTML = `
      <div><strong>${reflectionDays}</strong><span>reflection days</span></div>
      <div><strong>${journalDays}</strong><span>journal days</span></div>
      <div><strong>${feelings.length}</strong><span>feeling check-ins</span></div>
      <div><strong>${dbtUses}</strong><span>DBT skills used</span></div>
    `;
  };

  const bind = () => {
    el.prev.addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); });
    el.next.addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); });
    el.today.addEventListener('click', () => selectDate(localDateKey()));
    document.querySelectorAll('[data-calendar-filter]').forEach((button) => button.addEventListener('click', () => {
      state.filter = button.dataset.calendarFilter;
      document.querySelectorAll('[data-calendar-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
      renderCalendar();
    }));
    window.addEventListener('storage', () => { load(); renderCalendar(); renderDayStory(); renderPatterns(); });
  };

  const start = () => {
    Object.assign(el, {
      monthLabel: document.getElementById('journal-calendar-month'),
      grid: document.getElementById('journal-calendar-grid'),
      prev: document.getElementById('journal-calendar-prev'),
      next: document.getElementById('journal-calendar-next'),
      today: document.getElementById('journal-calendar-today'),
      legend: document.getElementById('journal-calendar-legend'),
      storyTitle: document.getElementById('journal-story-title'),
      storySummary: document.getElementById('journal-story-summary'),
      story: document.getElementById('journal-day-story'),
      storyShift: document.getElementById('journal-story-shift'),
      patterns: document.getElementById('journal-patterns-grid'),
      monthSummary: document.getElementById('journal-month-summary')
    });
    if (!el.grid) return;
    load();
    state.selectedDate = localDateKey();
    const [year, month] = partsForKey(state.selectedDate);
    state.month = new Date(year, month - 1, 1);
    renderLegend();
    bind();
    renderCalendar();
    renderDayStory();
    renderPatterns();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
