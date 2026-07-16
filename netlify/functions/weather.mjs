const LOCATION = { latitude: 43.0731, longitude: -89.4012, label: 'Madison, WI' };
const NWS_BASE = 'https://api.weather.gov';
const USER_AGENT = 'MorningIntelligenceReport/1.0 (https://mymorningintelligencereport.netlify.app)';
const TIME_ZONE = 'America/Chicago';
const FORECAST_PAGE = `https://forecast.weather.gov/MapClick.php?lat=${LOCATION.latitude}&lon=${LOCATION.longitude}`;
const nwsHeaders = { Accept: 'application/geo+json', 'User-Agent': USER_AGENT };

const json = (payload, status = 200, cache = true) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': cache
      ? 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800'
      : 'no-store'
  }
});

const fetchJson = async (url, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: nwsHeaders, signal: controller.signal });
    if (!response.ok) throw new Error(`NWS request failed (${response.status}) for ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const settledValue = (result, fallback = null) => result.status === 'fulfilled' ? result.value : fallback;
const celsiusToFahrenheit = (value) => Number.isFinite(value) ? Math.round((value * 9) / 5 + 32) : null;
const metersPerSecondToMph = (value) => Number.isFinite(value) ? Math.round(value * 2.23694) : null;
const roundOrNull = (value) => Number.isFinite(value) ? Math.round(value) : null;

const compassDirection = (degrees) => {
  if (!Number.isFinite(degrees)) return null;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(degrees / 45) % 8];
};

const localDateKey = (value) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
};

const hourLabel = (value) => new Date(value).toLocaleTimeString('en-US', {
  timeZone: TIME_ZONE, hour: 'numeric'
});

const parseWindSpeed = (value) => {
  const matches = String(value || '').match(/\d+/g);
  return matches?.length ? Math.max(...matches.map(Number)) : null;
};

const severityRank = { Extreme: 5, Severe: 4, Moderate: 3, Minor: 2, Unknown: 1 };
const chooseAlert = (features = []) => [...features].sort((a, b) =>
  (severityRank[b?.properties?.severity] || 0) - (severityRank[a?.properties?.severity] || 0)
)[0] || null;

const themeFor = ({ alert, condition, isDaytime }) => {
  const text = `${alert?.event || ''} ${condition || ''}`.toLowerCase();
  if (alert && ['Extreme', 'Severe'].includes(alert.severity)) return 'alert';
  if (/thunder|tornado|storm|squall/.test(text)) return 'storm';
  if (/snow|sleet|blizzard|ice|freezing/.test(text)) return 'snow';
  if (/rain|shower|drizzle/.test(text)) return 'rain';
  if (/fog|haze|smoke/.test(text)) return 'haze';
  if (/sun|clear|fair/.test(text)) return isDaytime === false ? 'night' : 'sunny';
  if (isDaytime === false) return 'night';
  return 'cloudy';
};

const practicalAdvice = ({ alert, currentTemp, feelsLike, high, precipitation, wind, condition }) => {
  const text = String(condition || '').toLowerCase();
  if (alert) return `No weather heroics: ${alert.event} is active. Check the details before heading out.`;
  if (/thunder|storm/.test(text)) return 'The sky has scheduled a meeting. Keep an indoor backup plan nearby.';
  if (/snow|sleet|freezing|ice/.test(text)) return 'Winter paperwork is active. Add travel time and wear shoes with opinions.';
  if ((precipitation || 0) >= 70) return 'Umbrella diplomacy is strongly advised. The clouds appear committed.';
  if ((feelsLike || currentTemp || high || 0) >= 95) return 'Serious heat. Hydration is not optional, and errands deserve strategic retreat.';
  if ((high || currentTemp || 0) >= 88) return 'Warm and sticky. Cold water earns a promotion before the day gets ambitious.';
  if ((currentTemp ?? high ?? 100) <= 32) return 'The air has chosen violence. Gloves and a slower departure are sensible policy.';
  if ((wind || 0) >= 25) return 'Windy enough to audit every unsecured patio object. Plan accordingly.';
  if ((precipitation || 0) >= 35) return 'A small rain gamble is on the board. Toss an umbrella in the car and feel superior later.';
  if (/fog|haze|smoke/.test(text)) return 'Visibility may be a little theatrical. Give the commute extra breathing room.';
  return 'The weather appears willing to cooperate, which feels suspicious but welcome.';
};

const normalizeAlert = (feature) => {
  if (!feature?.properties) return null;
  const properties = feature.properties;
  return {
    event: properties.event || 'Weather alert',
    headline: properties.headline || properties.event || 'Weather alert',
    severity: properties.severity || 'Unknown',
    urgency: properties.urgency || 'Unknown',
    ends: properties.ends || properties.expires || null,
    instruction: properties.instruction || null,
    description: properties.description || null,
    url: properties.web || properties['@id'] || feature.id || FORECAST_PAGE
  };
};

const getLatestObservation = async (stationsUrl) => {
  if (!stationsUrl) return null;
  const stations = await fetchJson(stationsUrl);
  const firstStation = stations?.features?.[0]?.id;
  return firstStation ? fetchJson(`${firstStation}/observations/latest`) : null;
};

const buildWeather = async () => {
  const point = await fetchJson(`${NWS_BASE}/points/${LOCATION.latitude},${LOCATION.longitude}`);
  const properties = point?.properties || {};

  const [forecastResult, hourlyResult, alertResult, observationResult] = await Promise.allSettled([
    fetchJson(properties.forecast),
    fetchJson(properties.forecastHourly),
    fetchJson(`${NWS_BASE}/alerts/active?point=${LOCATION.latitude},${LOCATION.longitude}`),
    getLatestObservation(properties.observationStations)
  ]);

  const forecast = settledValue(forecastResult, {});
  const hourly = settledValue(hourlyResult, {});
  const alerts = settledValue(alertResult, { features: [] });
  const observation = settledValue(observationResult, {});
  const hourlyPeriods = hourly?.properties?.periods || [];
  const currentHour = hourlyPeriods[0] || null;
  const observationProperties = observation?.properties || {};
  const todayKey = localDateKey(new Date());
  const todayHours = hourlyPeriods.filter((period) => localDateKey(period.startTime) === todayKey);
  const temperatures = todayHours.map((period) => period.temperature).filter(Number.isFinite);
  const precipitationValues = todayHours.map((period) => period?.probabilityOfPrecipitation?.value).filter(Number.isFinite);

  const currentTemp = celsiusToFahrenheit(observationProperties?.temperature?.value) ?? currentHour?.temperature ?? null;
  const heatIndex = celsiusToFahrenheit(observationProperties?.heatIndex?.value);
  const windChill = celsiusToFahrenheit(observationProperties?.windChill?.value);
  const feelsLike = heatIndex ?? windChill ?? currentTemp;
  const windSpeed = metersPerSecondToMph(observationProperties?.windSpeed?.value) ?? parseWindSpeed(currentHour?.windSpeed);
  const windGust = metersPerSecondToMph(observationProperties?.windGust?.value);
  const windDirection = compassDirection(observationProperties?.windDirection?.value) ?? currentHour?.windDirection ?? null;
  const condition = observationProperties?.textDescription || currentHour?.shortForecast || forecast?.properties?.periods?.[0]?.shortForecast || 'Forecast available';
  const high = temperatures.length ? Math.max(...temperatures) : null;
  const low = temperatures.length ? Math.min(...temperatures) : null;
  const precipitation = precipitationValues.length ? Math.max(...precipitationValues) : 0;
  const alert = normalizeAlert(chooseAlert(alerts?.features || []));
  const isDaytime = currentHour?.isDaytime ?? true;

  const nextHours = [0, 3, 6, 9].map((index) => hourlyPeriods[index]).filter(Boolean).map((period) => ({
    time: hourLabel(period.startTime),
    temperature: period.temperature,
    precipitation: roundOrNull(period?.probabilityOfPrecipitation?.value) ?? 0,
    condition: period.shortForecast,
    is_daytime: period.isDaytime
  }));

  const weather = {
    location: LOCATION.label,
    generated_at: new Date().toISOString(),
    observed_at: observationProperties.timestamp || currentHour?.startTime || null,
    source: 'National Weather Service',
    forecast_url: FORECAST_PAGE,
    theme: themeFor({ alert, condition, isDaytime }),
    current: {
      temperature: currentTemp,
      feels_like: feelsLike,
      condition,
      humidity: roundOrNull(observationProperties?.relativeHumidity?.value),
      wind_speed: windSpeed,
      wind_gust: windGust,
      wind_direction: windDirection,
      is_daytime: isDaytime
    },
    today: {
      high,
      low,
      precipitation_chance: roundOrNull(precipitation) ?? 0,
      detailed_forecast: forecast?.properties?.periods?.[0]?.detailedForecast || null
    },
    next_hours: nextHours,
    alert,
    advice: practicalAdvice({
      alert, currentTemp, feelsLike, high, precipitation,
      wind: Math.max(windSpeed || 0, windGust || 0), condition
    })
  };

  if (!Number.isFinite(weather.current.temperature) && !weather.current.condition) {
    throw new Error('The National Weather Service response did not contain usable current conditions.');
  }
  return weather;
};

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, false);
  try {
    return json(await buildWeather());
  } catch (error) {
    console.error('Weather function failed.', error);
    return json({ error: 'Weather data is temporarily unavailable.', forecast_url: FORECAST_PAGE }, 502, false);
  }
};

export const config = { path: '/api/weather' };
