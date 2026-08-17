const OWNER = 'parkerpixie';
const REPO = 'morning-intelligence-report';
const WORKFLOW = 'update-report.yml';
const BRANCH = 'main';
const MIN_REFRESH_GAP_MS = 5 * 60 * 1000;

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  }
});

const getLatestReport = async () => {
  const response = await fetch(
    `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data/report.json?cache=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!response.ok) return null;
  return response.json();
};

const sameSiteRequest = (request) => {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!sameSiteRequest(request)) return json({ error: 'Cross-site refresh requests are not allowed.' }, 403);

  const token = Netlify.env.get('GITHUB_REPORT_TOKEN');
  if (!token) {
    return json({
      error: 'Manual report generation is not configured yet.',
      code: 'CONFIG_REQUIRED',
      setup: 'Add GITHUB_REPORT_TOKEN to the Netlify site environment variables.'
    }, 503);
  }

  try {
    const current = await getLatestReport();
    const generatedAt = current?.generated_at ? new Date(current.generated_at).getTime() : 0;
    const ageMs = generatedAt ? Date.now() - generatedAt : Infinity;

    if (ageMs >= 0 && ageMs < MIN_REFRESH_GAP_MS) {
      return json({
        accepted: false,
        already_fresh: true,
        generated_at: current.generated_at,
        message: 'A fresh report was generated less than five minutes ago.'
      });
    }

    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'MorningIntelligenceReport-Netlify'
        },
        body: JSON.stringify({ ref: BRANCH })
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error('GitHub workflow dispatch failed.', response.status, details);
      return json({ error: 'GitHub would not start the report refresh.', code: 'DISPATCH_FAILED' }, 502);
    }

    return json({
      accepted: true,
      baseline_generated_at: current?.generated_at || null,
      message: 'Fresh report generation started.'
    }, 202);
  } catch (error) {
    console.error('Manual report refresh failed.', error);
    return json({ error: 'The fresh report request could not be started.', code: 'REFRESH_FAILED' }, 502);
  }
};

export const config = { path: '/api/generate-report' };
