const SOURCE_URL = 'https://www.mypollenpal.com/madison-wi';

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
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

const extractLevel = (text, label) => {
  const pattern = new RegExp(`${label}\\s+Pollen\\s+(None|Low|Moderate|High|Very High)`, 'i');
  return text.match(pattern)?.[1] || null;
};

const extractOverall = (text) => text.match(/Overall:\s*(None|Low|Moderate|High|Very High)/i)?.[1] || null;
const extractScore = (text) => text.match(/(\d+)\/10\s+Breathability/i)?.[1] || null;

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'MorningIntelligenceReport/1.0' }
    });
    if (!response.ok) throw new Error(`Pollen source returned ${response.status}`);

    const text = cleanText(await response.text());
    const pollen = {
      tree: extractLevel(text, 'Tree'),
      grass: extractLevel(text, 'Grass'),
      weed: extractLevel(text, 'Weed')
    };

    if (!Object.values(pollen).some(Boolean)) throw new Error('No pollen levels found');

    return json({
      location: 'Madison, WI',
      generated_at: new Date().toISOString(),
      overall: extractOverall(text),
      breathability_score: extractScore(text),
      pollen,
      source: 'MyPollenPal',
      source_url: SOURCE_URL
    });
  } catch (error) {
    console.error('Pollen function failed.', error);
    return json({
      error: 'Pollen data is temporarily unavailable.',
      source_url: SOURCE_URL
    }, 502);
  }
};

export const config = { path: '/api/pollen' };