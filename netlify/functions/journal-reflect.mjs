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

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!sameSiteRequest(request)) return json({ error: 'Cross-site journal requests are not allowed.' }, 403);

  const apiKey = Netlify.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'AI reflection is not configured yet.', code: 'CONFIG_REQUIRED' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid journal request.' }, 400); }

  const cards = Array.isArray(body?.cards) ? body.cards.slice(0, 4).map((card) => ({
    deck: clean(card?.deck, 50),
    title: clean(card?.title, 100),
    message: clean(card?.message, 300)
  })) : [];
  const journal = clean(body?.journal, 8000);
  const date = clean(body?.date, 20);

  const cardText = cards.length
    ? cards.map((card) => `${card.deck}: ${card.title}${card.message ? ` — ${card.message}` : ''}`).join('\n')
    : 'No cards were drawn for this date.';

  const prompt = `You are a thoughtful journaling companion inside a private morning reflection app. Reflect on the user's own journal entry and today's oracle/card context without diagnosing, predicting, or claiming the cards reveal hidden truth. Treat the cards as prompts and metaphors, not supernatural certainty. Be warm, curious, specific, and grounded. Notice tensions, repeated ideas, possible questions, or connections the user may want to explore. Do not tell the user what they feel. Do not prescribe treatment. Do not produce a social-media caption. Write 2 to 4 short paragraphs and end with one genuinely useful question for further journaling.\n\nDate: ${date || 'Today'}\nCards:\n${cardText}\n\nJournal entry:\n${journal || '(The journal entry is blank. Reflect only on the card context and invite the user to begin.)'}`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: Netlify.env.get('OPENAI_JOURNAL_MODEL') || 'gpt-5-mini',
        input: prompt,
        max_output_tokens: 500
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Journal reflection API failed.', response.status, data?.error?.message || data);
      return json({ error: 'AI reflection could not be generated right now.', code: 'AI_FAILED' }, 502);
    }

    const outputText = Array.isArray(data?.output)
      ? data.output.flatMap((item) => Array.isArray(item?.content) ? item.content : []).find((item) => item?.type === 'output_text')?.text
      : '';
    const reflection = clean(data?.output_text || outputText, 6000);
    if (!reflection) return json({ error: 'AI returned an empty reflection.', code: 'EMPTY_AI' }, 502);
    return json({ reflection });
  } catch (error) {
    console.error('Journal reflection request failed.', error);
    return json({ error: 'AI reflection could not be reached right now.', code: 'AI_UNAVAILABLE' }, 502);
  }
};
