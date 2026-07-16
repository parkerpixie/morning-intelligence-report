(() => {
  const ENDPOINT = '/api/weather';
  const CACHE_KEY = 'morning-intelligence-report:last-weather';
  const TIME_ZONE = 'America/Chicago';
  const FETCH_TIMEOUT_MS = 11000;

  const root = document.getElementById('weather-strip');
  if (!root) return;

  const byId = (id) => document.getElementById(id);
  const temperature = (value) => Number.isFinite(value) ? `${Math.round(value)}°` : '—';
  const percentage = (value) => Number.isFinite(value) ? `${Math.round(value)}%` : '—';

  const iconFor = (theme, isDaytime = true) => {
    const icons = {
      alert: '⚠', storm: '⛈', rain: '☔', snow: '❄', haze: '◌',
      sunny: '☀', cloudy: '☁', night: '☾'
    };
    if (!isDaytime && theme === 'sunny') return '☾';
    return icons[theme] || '✦';
  };

  const formatUpdated = (value) => {
    if (!value) return 'Forecast time unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Forecast time unavailable';
    return `Updated ${date.toLocaleTimeString('en-US', {
      timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit'
    })}`;
  };

  const formatAlertEnd = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return ` · until ${date.toLocaleTimeString('en-US', {
      timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit'
    })}`;
  };

  const saveCache = (weather) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ weather, saved_at: new Date().toISOString() }));
    } catch (error) {
      console.warn('Weather loaded, but the browser cache was unavailable.', error);
    }
  };

  const loadCache = () => {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return value?.weather ? value : null;
    } catch {
      return null;
    }
  };

  const setLoading = (loading) => {
    root.classList.toggle('is-loading', loading);
    root.setAttribute('aria-busy', String(loading));
    const refresh = byId('weather-refresh');
    if (refresh) refresh.disabled = loading;
  };

  const renderHours = (hours = []) => {
    const container = byId('weather-hours');
    if (!container) return;
    container.replaceChildren();

    hours.slice(0, 4).forEach((hour) => {
      const item = document.createElement('div');
      item.className = 'weather-hour';
      item.innerHTML = '<span class="weather-hour-time"></span><strong class="weather-hour-temp"></strong><span class="weather-hour-rain"></span>';
      item.querySelector('.weather-hour-time').textContent = hour.time;
      item.querySelector('.weather-hour-temp').textContent = temperature(hour.temperature);
      item.querySelector('.weather-hour-rain').textContent = hour.precipitation > 0
        ? `${Math.round(hour.precipitation)}% rain`
        : 'dry signal';
      container.appendChild(item);
    });
  };

  const renderAlert = (alert) => {
    const element = byId('weather-alert');
    if (!element) return;
    if (!alert) {
      element.hidden = true;
      element.replaceChildren();
      return;
    }

    element.hidden = false;
    element.href = alert.url;
    element.target = '_blank';
    element.rel = 'noopener noreferrer';
    element.replaceChildren();

    const icon = document.createElement('span');
    icon.className = 'weather-alert-icon';
    icon.textContent = '!';
    icon.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.innerHTML = '<strong></strong><small></small>';
    copy.querySelector('strong').textContent = alert.event;
    copy.querySelector('small').textContent = `${alert.severity || 'Active'} alert${formatAlertEnd(alert.ends)}`;
    element.append(icon, copy);
  };

  const render = (weather, options = {}) => {
    root.dataset.theme = weather.theme || 'cloudy';
    root.classList.remove('is-unavailable');
    root.classList.toggle('is-cached', Boolean(options.cached));

    byId('weather-icon').textContent = iconFor(weather.theme, weather.current?.is_daytime);
    byId('weather-current-temp').textContent = temperature(weather.current?.temperature);
    byId('weather-condition').textContent = weather.current?.condition || 'Conditions unavailable';
    byId('weather-feels').textContent = Number.isFinite(weather.current?.feels_like)
      ? `Feels like ${temperature(weather.current.feels_like)}`
      : 'Feels-like temperature unavailable';
    byId('weather-high').textContent = temperature(weather.today?.high);
    byId('weather-low').textContent = temperature(weather.today?.low);
    byId('weather-rain').textContent = percentage(weather.today?.precipitation_chance);
    byId('weather-humidity').textContent = percentage(weather.current?.humidity);

    const windPieces = [
      weather.current?.wind_direction,
      Number.isFinite(weather.current?.wind_speed) ? `${weather.current.wind_speed} mph` : null
    ].filter(Boolean);
    if (Number.isFinite(weather.current?.wind_gust) && weather.current.wind_gust > weather.current.wind_speed) {
      windPieces.push(`gusts ${weather.current.wind_gust}`);
    }
    byId('weather-wind').textContent = windPieces.join(' ') || 'Calm';
    byId('weather-advice').textContent = weather.advice || 'Clementine is withholding judgment pending additional cloud paperwork.';
    byId('weather-updated').textContent = options.cached
      ? `Last saved forecast · ${formatUpdated(weather.observed_at || weather.generated_at)}`
      : formatUpdated(weather.observed_at || weather.generated_at);

    const forecast = byId('weather-forecast-link');
    forecast.href = weather.forecast_url;
    forecast.target = '_blank';
    forecast.rel = 'noopener noreferrer';

    renderHours(weather.next_hours);
    renderAlert(weather.alert);
    setLoading(false);
  };

  const renderUnavailable = () => {
    root.dataset.theme = 'cloudy';
    root.classList.add('is-unavailable');
    byId('weather-current-temp').textContent = '—';
    byId('weather-condition').textContent = 'The sky declined to comment.';
    byId('weather-feels').textContent = 'No current reading available';
    byId('weather-advice').textContent = 'Weather data is temporarily unavailable. The full National Weather Service forecast is still one tap away.';
    byId('weather-updated').textContent = 'Forecast unavailable';
    setLoading(false);
  };

  const fetchWeather = async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(ENDPOINT, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Weather request failed with ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  };

  const loadWeather = async () => {
    root.classList.remove('is-unavailable');
    setLoading(true);
    try {
      const weather = await fetchWeather();
      saveCache(weather);
      render(weather);
    } catch (error) {
      console.warn('Live weather could not be loaded.', error);
      const cached = loadCache();
      if (cached) render(cached.weather, { cached: true });
      else renderUnavailable();
    }
  };

  byId('weather-refresh')?.addEventListener('click', loadWeather);
  window.addEventListener('online', () => {
    if (root.classList.contains('is-cached') || root.classList.contains('is-unavailable')) loadWeather();
  });

  loadWeather();
})();
