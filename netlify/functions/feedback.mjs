import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'morning-report-feedback';
const PROFILE_KEY = 'preference-profile';
const ACTIONS = new Set(['save', 'useful', 'more', 'less']);
const ACTION_WEIGHTS = {
  save: { section: 0.5, source: 0.5, keyword: 0.75 },
  useful: { section: 1, source: 1.5, keyword: 1 },
  more: { section: 1.5, source: 2, keyword: 3 },
  less: { section: -1.5, source: -2, keyword: -3 }
};
const STOPWORDS = new Set([
  'about','after','again','against','also','amid','among','another','around','because','before','being','between','could','during','from','have','into','latest','more','news','over','report','says','show','shows','story','their','there','these','they','this','through','today','under','using','what','when','where','which','while','with','would','your'
]);
const PHRASES = [
  'taylor swift','artificial intelligence','marketing automation','mental health','customer experience',
  'salesforce','wisconsin','madison','dane county','openai','anthropic','autism','adhd','climate change'
];

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

const emptyProfile = () => ({
  version: 1,
  updated_at: null,
  total_signals: 0,
  action_counts: { save: 0, useful: 0, more: 0, less: 0 },
  section_weights: {},
  source_weights: {},
  keyword_weights: {}
});

const clean = (value, limit = 500) => String(value || '').trim().slice(0, limit);
const key = (value) => clean(value, 120).toLowerCase();
const safeId = (value) => clean(value, 100).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);

const allowedOrigin = (request) => {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'mymorningintelligencereport.netlify.app'
      || host === 'mymorningintelligencereport.com'
      || host === 'www.mymorningintelligencereport.com'
      || host.endsWith('--mymorningintelligencereport.netlify.app');
  } catch {
    return false;
  }
};

const extractKeywords = (story) => {
  const text = `${story.headline} ${story.summary}`.toLowerCase();
  const result = PHRASES.filter((phrase) => text.includes(phrase));
  const words = text.match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
  for (const word of words) {
    const cleaned = word.replace(/^'+|'+$/g, '');
    if (cleaned.length < 4 || STOPWORDS.has(cleaned) || /^\d+$/.test(cleaned)) continue;
    if (!result.includes(cleaned)) result.push(cleaned);
    if (result.length >= 12) break;
  }
  return result.slice(0, 12);
};

const adjust = (map, mapKey, amount) => {
  if (!mapKey || !amount) return;
  const next = Number((Number(map[mapKey] || 0) + amount).toFixed(2));
  if (Math.abs(next) < 0.01) delete map[mapKey];
  else map[mapKey] = Math.max(-30, Math.min(30, next));
};

const ensureProfileShape = (profile) => {
  profile.action_counts ||= { save: 0, useful: 0, more: 0, less: 0 };
  profile.section_weights ||= {};
  profile.source_weights ||= {};
  profile.keyword_weights ||= {};
  profile.total_signals = Number(profile.total_signals || 0);
  return profile;
};

const applyWeight = (profile, story, action, direction) => {
  const weight = ACTION_WEIGHTS[action];
  const factor = direction === 'remove' ? -1 : 1;
  adjust(profile.section_weights, key(story.section), weight.section * factor);
  adjust(profile.source_weights, key(story.source), weight.source * factor);
  extractKeywords(story).forEach((keyword) => adjust(profile.keyword_weights, keyword, weight.keyword * factor));
};

const normalizeStory = (raw) => ({
  source: clean(raw?.source, 120),
  headline: clean(raw?.headline, 260),
  summary: clean(raw?.summary, 700),
  url: clean(raw?.url, 1000),
  section: clean(raw?.section, 80)
});

const isStoryValid = (story) => Boolean(
  story.source && story.headline && story.url.startsWith('http') && story.section
);

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (request.method === 'GET') {
    const profile = ensureProfileShape(
      await store.get(PROFILE_KEY, { type: 'json' }) || emptyProfile()
    );
    return json(profile);
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!allowedOrigin(request)) return json({ error: 'Origin not allowed' }, 403);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const action = clean(payload?.action, 20);
  const active = payload?.active !== false;
  const deviceId = safeId(payload?.device_id);
  const storyId = safeId(payload?.story_id);
  const story = normalizeStory(payload?.story);

  if (!ACTIONS.has(action) || !deviceId || !storyId || !isStoryValid(story)) {
    return json({ error: 'Invalid feedback payload' }, 400);
  }

  const voteKey = `votes/${createHash('sha256').update(deviceId).digest('hex').slice(0, 24)}/${storyId}/${action}`;
  const existing = await store.get(voteKey, { type: 'json' });
  const wasActive = Boolean(existing?.active);
  if (wasActive === active) {
    const profile = ensureProfileShape(
      await store.get(PROFILE_KEY, { type: 'json' }) || emptyProfile()
    );
    return json({ ok: true, changed: false, profile_updated_at: profile.updated_at });
  }

  const profile = ensureProfileShape(
    await store.get(PROFILE_KEY, { type: 'json' }) || emptyProfile()
  );
  const direction = active ? 'add' : 'remove';
  applyWeight(profile, story, action, direction);
  profile.action_counts[action] = Math.max(0, Number(profile.action_counts[action] || 0) + (active ? 1 : -1));
  profile.total_signals = Math.max(0, profile.total_signals + (active ? 1 : -1));
  profile.updated_at = new Date().toISOString();

  if (active) {
    await store.setJSON(voteKey, {
      active: true,
      action,
      story,
      report_date: clean(payload?.report_date, 20),
      created_at: new Date().toISOString()
    });
  } else {
    await store.delete(voteKey);
  }
  await store.setJSON(PROFILE_KEY, profile);

  return json({ ok: true, changed: true, profile_updated_at: profile.updated_at });
};

export const config = { path: '/api/feedback' };
