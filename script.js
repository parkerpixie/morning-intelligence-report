(() => {
  const style = document.createElement('style');
  style.textContent = `
    body {
      background:
        radial-gradient(circle at 14% 10%, rgba(64, 207, 222, 0.18), transparent 23rem),
        radial-gradient(circle at 86% 12%, rgba(223, 123, 111, 0.15), transparent 25rem),
        radial-gradient(circle at 72% 42%, rgba(212, 173, 98, 0.12), transparent 20rem),
        linear-gradient(180deg, #fffaf2 0%, #f4eee5 48%, #e9e1d7 100%);
      background-attachment: fixed;
    }

    body::after {
      position: fixed;
      inset: 0;
      z-index: -2;
      pointer-events: none;
      content: '';
      opacity: .45;
      background-image:
        linear-gradient(rgba(23,59,69,.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(23,59,69,.025) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: linear-gradient(to bottom, black, transparent 78%);
    }

    .report-updated {
      margin: .35rem 0 0;
      color: rgba(255,255,255,.78);
      font-size: .78rem;
      font-weight: 700;
    }

    .report-freshness {
      max-width: 360px;
      margin: .55rem 0 0 auto;
      padding: .42rem .7rem;
      color: #fff8e7;
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 999px;
      background: rgba(223,123,111,.2);
      font-size: .75rem;
      font-weight: 800;
      line-height: 1.35;
    }

    .hero-banner {
      position: relative;
      width: min(calc(100% - 2.5rem), 1180px);
      margin: clamp(2rem, 5vw, 4.5rem) auto clamp(4rem, 8vw, 7rem);
    }

    .hero-banner img {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 3 / 2;
      object-fit: contain;
      border: 8px solid rgba(255,255,255,.78);
      border-radius: 34px;
      background: rgba(255,253,248,.72);
      box-shadow: 0 26px 64px rgba(23,59,69,.18);
    }

    .hero-button {
      position: absolute;
      left: 50%;
      bottom: clamp(1rem, 3vw, 2rem);
      display: inline-flex;
      align-items: center;
      gap: .55rem;
      min-height: 46px;
      padding: .8rem 1.25rem;
      color: #fff;
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px;
      background: rgba(23,59,69,.9);
      box-shadow: 0 12px 28px rgba(23,59,69,.24);
      backdrop-filter: blur(10px);
      font-weight: 800;
      text-decoration: none;
      transform: translateX(-50%);
    }

    .quick-scan-section { padding: 2rem 0 1rem; }
    .quick-scan-list { display: grid; gap: .75rem; margin-top: 1.25rem; }
    .quick-item { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .8rem; padding: 1rem 1.1rem; border: 1px solid rgba(23,59,69,.1); border-radius: 16px; background: rgba(255,253,248,.78); text-decoration: none; transition: transform .18s ease, box-shadow .18s ease; }
    .quick-item:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(23,59,69,.09); }
    .quick-source { color: #2f9fa7; font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .quick-headline { color: #173b45; font-weight: 800; line-height: 1.35; }
    .quick-arrow { color: #df7b6f; font-weight: 800; }

    .lead-story { display: grid; grid-template-columns: minmax(300px,.9fr) minmax(0,1.1fr); padding: 0; overflow: hidden; }
    .lead-image { width: 100%; height: 100%; min-height: 420px; object-fit: cover; }
    .lead-content { padding: clamp(2rem,5vw,3.5rem); }

    .story-card { padding: 0; overflow: hidden; }
    .story-card-body { display: flex; flex-direction: column; flex: 1; padding: 1.5rem; }
    .card-image { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #e8e3dc; }
    .story-take { margin-top: 1rem; padding: 1rem 1.1rem; border-left: 3px solid #df7b6f; border-radius: 0 12px 12px 0; background: rgba(223,123,111,.07); }
    .story-take strong { color: #58364f; font-size: .76rem; letter-spacing: .1em; text-transform: uppercase; }
    .story-take p { margin: .35rem 0 0; color: #546268; font-size: .94rem; }

    .uplifting-card { display: grid; grid-template-columns: minmax(260px,.8fr) minmax(0,1.2fr); align-items: stretch; gap: 0; padding: 0; overflow: hidden; }
    .uplifting-card > div { padding: clamp(1.8rem,4vw,3rem); }
    .feed-status { grid-column: 1 / -1; padding: 1.1rem 1.25rem; border: 1px dashed rgba(23,59,69,.18); border-radius: 16px; background: rgba(255,253,248,.64); color: #546268; }

    @media (max-width: 960px) {
      .lead-story,
      .uplifting-card { grid-template-columns: 1fr; }
      .lead-image { min-height: 300px; max-height: 520px; }
    }

    @media (max-width: 720px) {
      .header-meta { text-align: left; }
      .report-freshness { margin-left: 0; border-radius: 14px; }

      .hero-banner {
        width: calc(100% - 1rem);
        margin-top: 1rem;
        margin-bottom: 3.5rem;
      }

      .hero-banner img {
        border-width: 4px;
        border-radius: 20px;
      }

      .hero-button {
        position: static;
        width: calc(100% - 1.5rem);
        margin: .9rem auto 0;
        transform: none;
      }

      .quick-item { grid-template-columns: 1fr auto; }
      .quick-source { grid-column: 1 / -1; }
    }
  `;
  document.head.appendChild(style);

  const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const formatUpdated = (value) => new Date(value).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const setText = (root, selector, value) => {
    const el = root?.querySelector(selector);
    if (el && value) el.textContent = value;
  };

  const setLink = (root, selector, url) => {
    const link = root?.querySelector(selector);
    if (!link) return;
    if (url) {
      link.href = url;
      link.hidden = false;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      link.hidden = true;
    }
  };

  const setImage = (root, selector, url, headline) => {
    const image = root?.querySelector(selector);
    if (!image) return;
    if (!url) {
      image.hidden = true;
      return;
    }
    image.src = url;
    image.alt = headline ? `Photo for: ${headline}` : 'Article photo';
    image.hidden = false;
    image.addEventListener('error', () => { image.hidden = true; }, { once: true });
  };

  const fillStory = (root, story) => {
    if (!root || !story) return;
    setText(root, '[data-field="source"]', story.source);
    setText(root, '[data-field="headline"]', story.headline);
    setText(root, '[data-field="summary"]', story.summary);
    setText(root, '[data-field="take"]', story.take);
    setLink(root, '[data-field="source-link"]', story.url);
    setImage(root, '[data-field="image"]', story.image, story.headline);
  };

  const renderSection = (name, stories) => {
    const container = document.querySelector(`[data-feed="${name}"]`);
    const template = document.getElementById('story-card-template');
    if (!container || !template) return;
    container.innerHTML = '';

    if (!Array.isArray(stories) || stories.length === 0) {
      const p = document.createElement('p');
      p.className = 'feed-status';
      p.textContent = 'No distinct fresh stories made the cut for this section today.';
      container.appendChild(p);
      return;
    }

    stories.forEach((story) => {
      const fragment = template.content.cloneNode(true);
      fillStory(fragment, story);
      container.appendChild(fragment);
    });
  };

  const renderQuickScan = (stories) => {
    const list = document.getElementById('quick-scan-list');
    if (!list) return;
    list.innerHTML = '';

    (stories || []).forEach((story) => {
      const a = document.createElement('a');
      a.className = 'quick-item';
      a.href = story.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = '<span class="quick-source"></span><span class="quick-headline"></span><span class="quick-arrow">↗</span>';
      a.querySelector('.quick-source').textContent = story.source || 'News';
      a.querySelector('.quick-headline').textContent = story.headline;
      list.appendChild(a);
    });
  };

  const renderFreshness = (report) => {
    const updated = document.getElementById('report-updated');
    const status = document.getElementById('report-freshness');
    const generated = report?.generated_at ? new Date(report.generated_at) : null;

    if (!generated || Number.isNaN(generated.getTime())) {
      if (updated) updated.textContent = 'Refresh time unavailable';
      if (status) {
        status.hidden = false;
        status.textContent = 'The page loaded, but the refresh timestamp is missing.';
      }
      return;
    }

    if (updated) updated.textContent = `Updated ${formatUpdated(report.generated_at)}`;

    const ageHours = (Date.now() - generated.getTime()) / 36e5;
    if (status) {
      if (ageHours > 6) {
        status.hidden = false;
        status.textContent = 'Today’s refresh is running late. Showing the most recent report.';
      } else {
        status.hidden = true;
        status.textContent = '';
      }
    }
  };

  const renderReport = (report) => {
    const date = document.getElementById('report-date');
    if (date && report.report_date) {
      date.dateTime = report.report_date;
      date.textContent = formatDate(report.report_date);
    }

    renderFreshness(report);
    fillStory(document.getElementById('lead-story'), report.top_story);
    renderQuickScan(report.quick_scan);
    Object.entries(report.sections || {}).forEach(([name, stories]) => renderSection(name, stories));
    fillStory(document.getElementById('wonderful-story'), report.wonderful);
    setText(document.getElementById('capybara-message'), '[data-field="message"]', report.capybara_message);
  };

  fetch(`data/report.json?cache=${Date.now()}`, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Report request failed: ${response.status}`);
      return response.json();
    })
    .then(renderReport)
    .catch((error) => {
      console.error(error);
      setText(document.getElementById('lead-story'), '[data-field="headline"]', 'The report data did not load this time.');
      setText(document.getElementById('lead-story'), '[data-field="summary"]', 'The page is working, but the latest report file could not be retrieved.');
      const updated = document.getElementById('report-updated');
      const status = document.getElementById('report-freshness');
      if (updated) updated.textContent = 'Latest refresh could not be confirmed';
      if (status) {
        status.hidden = false;
        status.textContent = 'The report file did not load. Please refresh the page in a moment.';
      }
    });
})();