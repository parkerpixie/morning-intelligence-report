(() => {
  const root = document.getElementById('weather-strip');
  if (!root) return;

  const byId = (id) => document.getElementById(id);
  const compactCondition = (value = '') => {
    const text = String(value).trim();
    const lower = text.toLowerCase();
    if (/thunder|storm/.test(lower)) return 'Storms';
    if (/snow|sleet|freezing|ice/.test(lower)) return 'Wintry';
    if (/rain|showers|drizzle/.test(lower)) return /showers/.test(lower) ? 'Showers' : 'Rain';
    if (/mostly sunny/.test(lower)) return 'Mostly sunny';
    if (/partly sunny/.test(lower)) return 'Partly sunny';
    if (/sunny|clear|fair/.test(lower)) return 'Sunny';
    if (/mostly cloudy/.test(lower)) return 'Mostly cloudy';
    if (/partly cloudy/.test(lower)) return 'Partly cloudy';
    if (/cloud|overcast/.test(lower)) return 'Cloudy';
    if (/fog|haze|smoke/.test(lower)) return 'Hazy';
    return text.length > 22 ? `${text.slice(0, 21)}…` : text || 'Forecast';
  };

  const daypartIcon = (condition = '', isDaytime = true) => {
    const lower = String(condition).toLowerCase();
    if (/thunder|storm/.test(lower)) return '⛈';
    if (/snow|sleet|freezing|ice/.test(lower)) return '❄';
    if (/rain|showers|drizzle/.test(lower)) return '☔';
    if (/fog|haze|smoke/.test(lower)) return '◌';
    if (/cloud|overcast/.test(lower)) return '☁';
    return isDaytime ? '☀' : '☾';
  };

  const levelStyle = {
    none: { color: '#9fdcc0', percent: 2 },
    low: { color: '#76d29a', percent: 24 },
    moderate: { color: '#ffd166', percent: 55 },
    high: { color: '#ff9b6a', percent: 80 },
    'very-high': { color: '#ff776d', percent: 100 }
  };

  const fetchJson = async (url) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  };

  const renderPollen = (data) => {
    const panel = byId('pollen-panel');
    if (!panel || !data?.available) return;

    panel.classList.remove('is-unavailable');
    byId('pollen-summary').textContent = data.summary || 'Current Madison pollen';

    ['tree', 'grass', 'weed'].forEach((type) => {
      const reading = data[type];
      if (!reading) return;
      const meter = panel.querySelector(`[data-pollen="${type}"]`);
      const bar = byId(`pollen-${type}-bar`);
      const level = reading.level || 'low';
      const style = levelStyle[level] || levelStyle.low;
      if (meter) meter.dataset.level = level;
      byId(`pollen-${type}-level`).textContent = reading.label || 'Low';
      if (bar) {
        bar.style.width = `${Math.max(2, Math.min(100, Number(reading.percent) || style.percent))}%`;
        bar.style.backgroundColor = style.color;
      }
    });
  };

  const renderDayparts = (data) => {
    const container = byId('weather-hours');
    const dayparts = Array.isArray(data?.dayparts) ? data.dayparts : [];
    if (!container || !dayparts.length) return;

    container.setAttribute('aria-label', 'Morning, afternoon, and evening forecast');
    container.style.gridTemplateColumns = `repeat(${dayparts.length}, minmax(0, 1fr))`;
    container.replaceChildren();

    dayparts.forEach((part) => {
      const item = document.createElement('div');
      item.className = 'weather-hour';
      item.innerHTML = '<span class="weather-hour-time"></span><strong class="weather-hour-temp"></strong><span class="weather-hour-rain"></span>';
      item.querySelector('.weather-hour-time').textContent = part.label;
      item.querySelector('.weather-hour-temp').textContent = daypartIcon(part.condition, part.is_daytime);
      item.querySelector('.weather-hour-rain').textContent = `${compactCondition(part.condition)} · ${Math.round(part.precipitation_chance || 0)}% rain`;
      container.appendChild(item);
    });

    const rainVital = byId('weather-rain')?.closest('.weather-vital');
    const rainLabel = rainVital?.querySelector('span');
    if (rainLabel) rainLabel.textContent = 'Peak rain';

    refineAdvice(dayparts);
  };

  const refineAdvice = (dayparts) => {
    const advice = byId('weather-advice');
    const alert = byId('weather-alert');
    if (!advice || (alert && !alert.hidden)) return;
    if (['alert', 'storm', 'snow'].includes(root.dataset.theme)) return;

    const wet = dayparts.filter((part) => Number(part.precipitation_chance || 0) >= 35);
    const peak = Math.max(0, ...dayparts.map((part) => Number(part.precipitation_chance || 0)));
    if (!wet.length || peak < 35) return;

    const labels = wet.map((part) => part.label.toLowerCase());
    if (wet.length === 1) {
      advice.textContent = `${wet[0].label} is the rain window (${peak}%). This is more “umbrella in the car” than “surrender the whole day to rain.”`;
      return;
    }
    if (wet.length === 2) {
      advice.textContent = `Rain is mostly a ${labels.join(' + ')} situation, peaking around ${peak}%. Plan around the wet window, not the entire day.`;
      return;
    }
    advice.textContent = `The clouds look fairly committed today, with rain chances peaking around ${peak}%. Umbrella diplomacy is officially justified.`;
  };

  let inFlight = false;
  const refreshExtras = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const [pollenResult, daypartResult] = await Promise.allSettled([
        fetchJson('/api/pollen'),
        fetchJson('/api/dayparts')
      ]);

      if (pollenResult.status === 'fulfilled') renderPollen(pollenResult.value);
      else console.warn('Pollen enhancement could not load.', pollenResult.reason);

      if (daypartResult.status === 'fulfilled') renderDayparts(daypartResult.value);
      else console.warn('Daypart weather enhancement could not load.', daypartResult.reason);
    } finally {
      inFlight = false;
    }
  };

  const observer = new MutationObserver(() => {
    if (root.getAttribute('aria-busy') === 'false') window.setTimeout(refreshExtras, 0);
  });
  observer.observe(root, { attributes: true, attributeFilter: ['aria-busy'] });

  if (root.getAttribute('aria-busy') === 'false') refreshExtras();
})();
