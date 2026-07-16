(() => {
  const heroImage = document.querySelector('.hero-art img');
  if (heroImage) {
    heroImage.src = 'assets/images/morning-intelligence-hero-new.webp.WEBP';
    heroImage.alt = 'A celestial capybara greeting the sunrise with coffee, books, and a journal';
  }

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
      opacity: 0.5;
      background-image:
        linear-gradient(rgba(23, 59, 69, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(23, 59, 69, 0.025) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: linear-gradient(to bottom, black, transparent 78%);
    }

    .hero {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 0.82fr) minmax(440px, 1.18fr);
      align-items: center;
      min-height: auto;
      padding: clamp(4rem, 8vw, 7rem) 0;
      gap: clamp(2rem, 5vw, 4.5rem);
    }

    .hero-copy {
      position: relative;
      z-index: 2;
      margin: 0;
      padding: clamp(2rem, 4vw, 3.25rem);
      border: 1px solid rgba(23, 59, 69, 0.09);
      border-radius: 34px;
      background: rgba(255, 253, 248, 0.76);
      box-shadow: 0 28px 70px rgba(23, 59, 69, 0.11);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
    }

    .hero h1 { max-width: 11ch; margin-inline: 0; }
    .hero-intro { margin-inline: 0; }
    .hero-art { position: relative; z-index: 1; }

    .hero-art::before {
      position: absolute;
      inset: 8% -5% -8% 8%;
      z-index: -1;
      border-radius: 50%;
      content: '';
      background: radial-gradient(circle, rgba(64, 207, 222, 0.2), transparent 68%);
      filter: blur(10px);
    }

    .hero-art img {
      width: 100%;
      height: auto;
      aspect-ratio: 3 / 2;
      object-fit: cover;
      object-position: center;
      border: 8px solid rgba(255, 255, 255, 0.72);
      border-radius: 34px;
      box-shadow: 0 26px 64px rgba(23, 59, 69, 0.18);
    }

    .featured-section, .report-chapter { position: relative; }

    .report-chapter::before {
      position: absolute;
      top: 2rem;
      right: -18vw;
      z-index: -1;
      width: 32rem;
      height: 32rem;
      border-radius: 50%;
      content: '';
      background: radial-gradient(circle, rgba(64, 207, 222, 0.07), transparent 68%);
      pointer-events: none;
    }

    .feed-status {
      grid-column: 1 / -1;
      margin: 0;
      padding: 1.1rem 1.25rem;
      border: 1px dashed rgba(23, 59, 69, 0.18);
      border-radius: 16px;
      color: #546268;
      background: rgba(255, 253, 248, 0.64);
    }

    @media (max-width: 960px) {
      .hero { grid-template-columns: 1fr; }
      .hero-copy { max-width: 760px; }
      .hero-art { max-width: 860px; }
    }

    @media (max-width: 720px) {
      .hero { padding-top: 3.5rem; padding-bottom: 4rem; }
      .hero-copy { padding: 2.25rem 1.35rem; border-radius: 26px; }
      .hero-art img { border-width: 5px; border-radius: 24px; }
    }
  `;
  document.head.appendChild(style);

  const formatDate = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const setText = (root, selector, value) => {
    const element = root?.querySelector(selector);
    if (element && value) element.textContent = value;
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

  const fillStory = (root, story) => {
    if (!root || !story) return;
    setText(root, '[data-field="category"]', story.category);
    setText(root, '[data-field="headline"]', story.headline);
    setText(root, '[data-field="summary"]', story.summary);
    setText(root, '[data-field="why-it-matters"]', story.why_it_matters);
    setText(root, '[data-field="parker-read"]', story.parker_read);
    setLink(root, '[data-field="source-link"]', story.url);
  };

  const renderSection = (feedName, stories) => {
    const container = document.querySelector(`[data-feed="${feedName}"]`);
    const template = document.getElementById('story-card-template');
    if (!container || !template) return;

    container.innerHTML = '';
    if (!Array.isArray(stories) || stories.length === 0) {
      const message = document.createElement('p');
      message.className = 'feed-status';
      message.textContent = 'This feed is waiting for its next successful refresh.';
      container.appendChild(message);
      return;
    }

    stories.forEach((story) => {
      const fragment = template.content.cloneNode(true);
      fillStory(fragment, story);
      container.appendChild(fragment);
    });
  };

  const renderReport = (report) => {
    const dateElement = document.getElementById('report-date');
    if (dateElement) {
      const reportDate = report.report_date || new Date().toISOString().slice(0, 10);
      dateElement.dateTime = reportDate;
      dateElement.textContent = formatDate(reportDate);
    }

    fillStory(document.getElementById('lead-story'), report.top_story);

    const sections = report.sections || {};
    document.querySelectorAll('[data-feed]').forEach((container) => {
      const name = container.dataset.feed;
      if (name !== 'top-story' && name !== 'uplifting') {
        renderSection(name, sections[name] || []);
      }
    });

    const tool = report.tool || {};
    const toolSection = document.querySelector('.tool-feature');
    setText(toolSection, '#tool-title', tool.name ? `AI Automation Tool of the Day: ${tool.name}` : 'AI Automation Tool of the Day');
    setText(toolSection, '[data-field="tool-summary"]', tool.summary);
    setText(toolSection, '[data-field="tool-best-for"]', tool.best_for);
    setText(toolSection, '[data-field="tool-verdict"]', tool.verdict);
    setLink(toolSection, '[data-field="tool-link"]', tool.url);

    fillStory(document.getElementById('uplifting-story'), report.uplifting);
    setText(document.getElementById('capybara-message'), '[data-field="message"]', report.capybara_message);
  };

  const showLoadError = () => {
    const lead = document.getElementById('lead-story');
    setText(lead, '[data-field="headline"]', 'The report data did not load this time.');
    setText(lead, '[data-field="summary"]', 'The page itself is working, but the latest report file could not be retrieved. Refresh once, then check the GitHub Actions run if the problem remains.');
  };

  fetch(`data/report.json?cache=${Date.now()}`, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Report request failed: ${response.status}`);
      return response.json();
    })
    .then(renderReport)
    .catch((error) => {
      console.error(error);
      showLoadError();
    });
})();