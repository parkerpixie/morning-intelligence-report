(() => {
  const TIME_ZONE = 'America/Chicago';

  const currentDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const friendlyToday = () => new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  const applyToday = () => {
    const key = currentDateKey();
    const label = friendlyToday();
    document.querySelectorAll('.report-date').forEach((element) => {
      if (element.id === 'journal-header-date') return;
      if (element.dateTime !== key) element.dateTime = key;
      if (element.textContent !== label) element.textContent = label;
    });
  };

  applyToday();

  const observer = new MutationObserver(() => applyToday());
  document.querySelectorAll('.report-date').forEach((element) => {
    observer.observe(element, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['datetime'] });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') applyToday();
  });

  window.setInterval(applyToday, 60 * 1000);
})();
