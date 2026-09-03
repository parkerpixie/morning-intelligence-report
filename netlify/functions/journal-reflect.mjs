const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

const sameSiteRequest = (request) => {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
};

const clean = (value, limit = 6000) => String(value || '').trim().slice(0, limit);

const safeOracleImage = (request, value) => {
  const raw = clean(value, 1200);
  if (!raw) return '';
  try {
    const imageUrl = new URL(raw);
    const requestUrl = new URL(request.url);
    if (imageUrl.host !== requestUrl.host) return '';
    if (!imageUrl.pathname.startsWith('/assets/oracle/oracle/')) return '';
    if (!/\.(?:webp|png|jpe?g)$/i.test(imageUrl.pathname)) return '';
    return imageUrl.href;
  } catch { return ''; }
};

const extractOutputText = (data) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  if (!Array.isArray(data?.output)) return '';
  return data.output.flatMap((item) => Array.isArray(item?.content) ? item.content : []).filter((item) => item?.type === 'output_text' && typeof item?.text === 'string').map((item) => item.text).join('\n').trim();
};

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!sameSiteRequest(request)) return json({ error: 'Cross-site journal requests are not allowed.' }, 403);

  const apiKey = Netlify.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'AI reflection is not configured yet.', code: 'CONFIG_REQUIRED' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid journal request.' }, 400); }

  const mode = clean(body?.mode, 30) === 'shape' ? 'shape' : 'reflect';
  const cards = Array.isArray(body?.cards) ? body.cards.slice(0, 4).map((card) => ({
    deck: clean(card?.deck, 50), title: clean(card?.title, 100), message: clean(card?.message, 500), readingImageUrl: safeOracleImage(request, card?.readingImageUrl)
  })) : [];
  const feelings = Array.isArray(body?.feelings) ? body.feelings.slice(0, 12).map((entry) => ({
    source: clean(entry?.source, 30), family: clean(entry?.family, 80), middle: clean(entry?.middle, 80), feelings: Array.isArray(entry?.feelings) ? entry.feelings.slice(0, 6).map((word) => clean(word, 80)).filter(Boolean) : [], intensity: Number(entry?.intensity) || null, note: clean(entry?.note, 500)
  })) : [];
  const journal = clean(body?.journal, 8000);
  const date = clean(body?.date, 20);

  if (mode === 'shape' && !journal) return json({ error: 'Write a few thoughts before shaping the reflection.', code: 'EMPTY_REFLECTION' }, 400);

  const cardText = cards.length ? cards.map((card) => `${card.deck}: ${card.title}${card.message ? ` — ${card.message}` : ''}${card.readingImageUrl ? ' — full reading supplied as an image below' : ''}`).join('\n') : 'No cards were drawn for this date.';
  const feelingsText = feelings.length ? feelings.map((entry) => `${entry.source === 'morning' ? 'morning check-in' : 'check-in'}: ${entry.feelings.join(' + ') || entry.middle || entry.family}${entry.intensity ? ` — intensity ${entry.intensity}/10` : ''}${entry.note ? ` — note: ${entry.note}` : ''}`).join('\n') : 'No feelings check-in was logged for this date.';

  const shapePrompt = `You are helping Parker shape their own morning card reflection into a polished first-person journal entry. Parker has already supplied the meaning. Preserve it, clarify it, and make it sound warm, candid, grounded, and naturally Parker-like.\n\nImportant voice rules:\n- Write in first person as Parker.\n- Preserve Parker's actual meaning, emotional nuance, specificity, humor, frustration, uncertainty, and contradictions when they matter.\n- Treat the logged feelings as context Parker explicitly chose to record. You may connect them to Parker's own words when supported, but do not invent causes, hidden motives, breakthroughs, diagnoses, or conclusions.\n- The cards are prompts and metaphors, never supernatural certainty, diagnosis, prediction, or proof.\n- Do not turn this into therapy-speak, advice, a pep talk, inspirational-poster language, or a social-media caption.\n- No bullets, no title, no hashtags, no closing journaling question.\n- Aim for 2 to 4 cohesive short paragraphs.\n\nDate: ${date || 'Today'}\nCards:\n${cardText}\n\nFeelings Parker logged today:\n${feelingsText}\n\nParker's raw thoughts:\n${journal}`;

  const reflectPrompt = `You are a thoughtful journaling companion inside a private morning reflection app. Reflect on the user's own journal entry, today's logged feelings, and card context without diagnosing, predicting, or claiming the cards reveal hidden truth. Treat feelings as user-provided context, not evidence of a cause. Be warm, curious, specific, and grounded. Do not tell the user what they feel. Write 2 to 4 short paragraphs and end with one genuinely useful question for further journaling.\n\nDate: ${date || 'Today'}\nCards:\n${cardText}\n\nFeelings logged:\n${feelingsText}\n\nJournal entry:\n${journal || '(The journal entry is blank.)'}`;

  const content = [{ type: 'input_text', text: mode === 'shape' ? shapePrompt : reflectPrompt }];
  cards.forEach((card) => {
    if (!card.readingImageUrl) return;
    content.push({ type:'input_text', text:`Golden Oracle full-reading image for ${card.title}:` });
    content.push({ type:'input_image', image_url:card.readingImageUrl });
  });

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ model:Netlify.env.get('OPENAI_JOURNAL_MODEL') || 'gpt-5.6-terra', input:[{ role:'user', content }], max_output_tokens:mode === 'shape' ? 700 : 500 })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Journal reflection API failed.', response.status, data?.error?.message || data);
      return json({ error:'AI reflection could not be generated right now.', code:'AI_FAILED' }, 502);
    }
    const reflection = clean(extractOutputText(data), 7000);
    if (!reflection) return json({ error:'AI returned an empty reflection.', code:'EMPTY_AI' }, 502);
    return json({ reflection, mode });
  } catch (error) {
    console.error('Journal reflection request failed.', error);
    return json({ error:'AI reflection could not be reached right now.', code:'AI_UNAVAILABLE' }, 502);
  }
};
