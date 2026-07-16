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

    .hero h1 {
      max-width: 11ch;
      margin-inline: 0;
    }

    .hero-intro {
      margin-inline: 0;
    }

    .hero-art {
      position: relative;
      z-index: 1;
    }

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

    .featured-section,
    .report-chapter {
      position: relative;
    }

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

    @media (max-width: 960px) {
      .hero {
        grid-template-columns: 1fr;
      }

      .hero-copy {
        max-width: 760px;
      }

      .hero-art {
        max-width: 860px;
      }
    }

    @media (max-width: 720px) {
      .hero {
        padding-top: 3.5rem;
        padding-bottom: 4rem;
      }

      .hero-copy {
        padding: 2.25rem 1.35rem;
        border-radius: 26px;
      }

      .hero-art img {
        border-width: 5px;
        border-radius: 24px;
      }
    }
  `;

  document.head.appendChild(style);

  const dateElement = document.getElementById('report-date');
  if (dateElement) {
    const now = new Date();
    dateElement.dateTime = now.toISOString().split('T')[0];
    dateElement.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
})();