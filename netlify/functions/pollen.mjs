const SOURCE_URL = 'https://www.mypollenpal.com/madison-wi';
const TIME_ZONE = 'America/Chicago';

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': status === 200
      ? 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=21600'
      : 'no-store'
  }
});

const cleanText = (html) => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

const LEVEL_VALUE = 'Very High|Moderate|High|Low|None';
const LEVEL_PATTERN = `(${LEVEL_VALUE})`;
const levelMeta = {
  none: { level: 'none', label: 'None', percent: 2 },
  low: { level: 'low', label: 'Low', percent: 24 },
  moderate: { level: 'moderate', label: 'Moderate', percent: 55 },
  high: { level: 'high', label: 'High', percent: 80 },
  'very high': { level: 'very-high', label: 'Very High', percent: 100 }
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const madisonDateLabel = () => new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  month: 'short',
  day: 'numeric'
}).format(new Date());

const extractLevel = (text, label) => {
  const patterns = [
    new RegExp(`${label}\\s+Pollen\\s+${LEVEL_PATTERN}`, 'i'),
    new RegExp(`${label}\\s*:\\s*${LEVEL_PATTERN}`, 'i')
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const extractForecastRow = (text, dateLabel) => {
  const date = escapeRegExp(dateLabel);
  const pattern = new RegExp(
    `${date}\\s+Overall:\\s*(${LEVEL_VALUE})\\s+Tree:\\s*(${LEVEL_VALUE})\\s+Grass:\\s*(${LEVEL_VALUE})\\s+Weed:\\s*(${LEVEL_VALUE})`,
    'i'
  );
  const match = text.match(pattern);
  if (!match) return null;
  return { overall: match[1], tree: match[2], grass: match[3], weed: match[4] };
};

const extractPageDate = (text) => text.match(/Madison, WI\s+Today\s+·\s+([A-Z][a-z]{2}\s+\d{1,2})/i)?.[1] || null;
const extractOverall = (text) => text.match(new RegExp(`Overall:\\s*${LEVEL_PATTERN}`, 'i'))?.[1] || null;
const extractScore = (text) => text.match(/(\d+)\/10\s+Breathability/i)?.[1] || null;
const toReading = (value) => value ? (levelMeta[value.toLowerCase()] || null) : null;

const summaryFor = (overall, readings) => {
  const value = String(overall || '').toLowerCase();
  if (value === 'very high') return 'Very high pollen today';
  if (value === 'high') return 'High pollen today';
  if (value === 'moderate') return 'Some pollen in the air';
  if (value === 'low' || value === 'none') return 'Pollen is running low';

  const order = { none: 0, low: 1, moderate: 2, high: 3, 'very-high': 4 };
  const highest = readings.filter(Boolean).sort((a, b) => (order[b.level] || 0) - (order[a.level] || 0))[0];
  if (!highest) return 'Current Madison pollen';
  if (highest.level === 'very-high') return 'Very high pollen today';
  if (highest.level === 'high') return 'High pollen today';
  if (highest.level === 'moderate') return 'Some pollen in the air';
  return 'Pollen is running low';
};

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MorningIntelligenceReport/1.0; +https://mymorningintelligencereport.netlify.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!response.ok) throw new Error(`Pollen source returned ${response.status}`);

    const text = cleanText(await response.text());
    const todayLabel = madisonDateLabel();
    const datedRow = extractForecastRow(text, todayLabel);

    const overall = datedRow?.overall || extractOverall(text);
    const tree = toReading(datedRow?.tree || extractLevel(text, 'Tree'));
    const grass = toReading(datedRow?.grass || extractLevel(text, 'Grass'));
    const weed = toReading(datedRow?.weed || extractLevel(text, 'Weed'));

    if (![tree, grass, weed].some(Boolean)) throw new Error('No pollen levels found');

    const pageDate = extractPageDate(text);
    const score = pageDate === todayLabel ? extractScore(text) : null;

    return json({
      available: true,
      location: 'Madison, WI',
      forecast_date: todayLabel,
      generated_at: new Date().toISOString(),
      overall,
      breathability_score: score,
      summary: summaryFor(overall, [tree, grass, weed]),
      tree: tree || levelMeta.none,
      grass: grass || levelMeta.none,
      weed: weed || levelMeta.none,
      source: 'MyPollenPal',
      source_url: SOURCE_URL
    });
  } catch (error) {
    console.error('Pollen function failed.', error);
    return json({
      available: false,
      error: 'Pollen data is temporarily unavailable.',
      source_url: SOURCE_URL
    }, 502);
  }
};

export const config = { path: '/api/pollen' };
