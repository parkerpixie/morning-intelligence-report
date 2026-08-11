const LOCATION = { latitude: 43.0731, longitude: -89.4012, label: 'Madison, WI' };
const NWS_BASE = 'https://api.weather.gov';
const TIME_ZONE = 'America/Chicago';
const USER_AGENT = 'MorningIntelligenceReport/1.0 (https://mymorningintelligencereport.netlify.app)';
const FORECAST_PAGE = `https://forecast.weather.gov/MapClick.php?lat=${LOCATION.latitude}&lon=${LOCATION.longitude}`;
const headers = { Accept: 'application/geo+json', 'User-Agent': USER_AGENT };

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': status === 200
      ? 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800'
      : 'no-store'
  }
});

const fetchJson = async (url, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`NWS request failed (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const localParts = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    hour: Number(lookup.hour)
  };
};

const localToday = () => localParts(new Date()).date;
const rainChance = (period) => Number.isFinite(period?.probabilityOfPrecipitation?.value)
  ? Math.round(period.probabilityOfPrecipitation.value)
  : 0;

const chooseRepresentative = (periods) => {
  if (!periods.length) return null;
  const peak = Math.max(...periods.map(rainChance));
  if (peak >= 30) return periods.find((period) => rainChance(period) === peak) || periods[Math.floor(periods.length / 2)];
  return periods[Math.floor(periods.length / 2)];
};

const buildPart = (definition, periods) => {
  const matches = periods.filter((period) => {
    const local = localParts(period.startTime);
    return local.date === localToday() && local.hour >= definition.start && local.hour <= definition.end;
  });
  if (!matches.length) return null;

  const representative = chooseRepresentative(matches);
  const precipitation = Math.max(...matches.map(rainChance));
  const temperatures = matches.map((period) => period.temperature).filter(Number.isFinite);

  return {
    id: definition.id,
    label: definition.label,
    window: definition.window,
    condition: representative?.shortForecast || 'Forecast available',
    precipitation_chance: precipitation,
    temperature_low: temperatures.length ? Math.min(...temperatures) : null,
    temperature_high: temperatures.length ? Math.max(...temperatures) : null,
    is_daytime: representative?.isDaytime ?? true
  };
};

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const point = await fetchJson(`${NWS_BASE}/points/${LOCATION.latitude},${LOCATION.longitude}`);
    const hourlyUrl = point?.properties?.forecastHourly;
    if (!hourlyUrl) throw new Error('NWS point response did not include an hourly forecast URL.');

    const hourly = await fetchJson(hourlyUrl);
    const periods = hourly?.properties?.periods || [];
    if (!periods.length) throw new Error('NWS hourly forecast was empty.');

    const definitions = [
      { id: 'morning', label: 'Morning', window: '6–11 AM', start: 6, end: 11 },
      { id: 'afternoon', label: 'Afternoon', window: '12–5 PM', start: 12, end: 17 },
      { id: 'evening', label: 'Evening', window: '6–11 PM', start: 18, end: 23 }
    ];

    const dayparts = definitions.map((definition) => buildPart(definition, periods)).filter(Boolean);
    if (!dayparts.length) throw new Error('No usable daypart forecast was available for today.');

    return json({
      available: true,
      location: LOCATION.label,
      generated_at: new Date().toISOString(),
      source: 'National Weather Service',
      forecast_url: FORECAST_PAGE,
      dayparts
    });
  } catch (error) {
    console.error('Daypart forecast failed.', error);
    return json({
      available: false,
      error: 'Daypart forecast is temporarily unavailable.',
      forecast_url: FORECAST_PAGE
    }, 502);
  }
};

export const config = { path: '/api/dayparts' };
