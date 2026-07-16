(() => {
  const heroArt = document.querySelector('.hero-art');
  if (heroArt) {
    heroArt.remove();
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
      display: block;
      min-height: auto;
      padding: clamp(5rem, 10vw, 8rem) 0 clamp(5rem, 10vw, 8rem);
      text-align: center;
    }

    .hero::before,
    .hero::after {
      position: absolute;
      z-index: -1;
      border-radius: 50%;
      content: '';
      pointer-events: none;
    }

    .hero::before {
      top: 12%;
      left: 50%;
      width: min(78vw, 760px);
      height: min(78vw, 760px);
      transform: translateX(-50%);
      border: 1px solid rgba(47, 159, 167, 0.12);
      box-shadow:
        0 0 0 3rem rgba(64, 207, 222, 0.025),
        0 0 0 7rem rgba(223, 123, 111, 0.018);
    }

    .hero::after {
      top: 18%;
      left: 50%;
      width: min(52vw, 500px);
      height: min(52vw, 500px);
      transform: translateX(-50%);
      background: radial-gradient(circle, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.12) 48%, transparent 70%);
      filter: blur(2px);
    }

    .hero-copy {
      position: relative;
      z-index: 2;
      max-width: 900px;
      margin: 0 auto;
      padding: clamp(2rem, 5vw, 4rem);
      border: 1px solid rgba(23, 59, 69, 0.09);
      border-radius: 38px;
      background: rgba(255, 253, 248, 0.66);
      box-shadow: 0 28px 70px rgba(23, 59, 69, 0.11);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
    }

    .hero h1 {
      max-width: 13ch;
      margin-inline: auto;
    }

    .hero-intro {
      margin-inline: auto;
    }

    .featured-section {
      position: relative;
    }

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

    @media (max-width: 720px) {
      .hero {
        padding-top: 3.5rem;
        padding-bottom: 4rem;
      }

      .hero-copy {
        padding: 2.25rem 1.35rem;
        border-radius: 26px;
      }

      .hero::before {
        width: 92vw;
        height: 92vw;
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