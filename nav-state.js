(() => {
  const NAV_SCROLL_KEY = 'morning-intelligence-report:section-nav-scroll';
  const nav = document.querySelector('.section-nav-inner');

  if (!nav) return;

  const archiveLink = nav.querySelector('[data-nav="archive"]');
  if (archiveLink) nav.appendChild(archiveLink);

  try {
    const savedScroll = Number(sessionStorage.getItem(NAV_SCROLL_KEY));
    if (Number.isFinite(savedScroll)) {
      requestAnimationFrame(() => {
        nav.scrollLeft = savedScroll;
      });
    }
  } catch (error) {
    console.warn('Navigation position could not be restored.', error);
  }

  const savePosition = () => {
    try {
      sessionStorage.setItem(NAV_SCROLL_KEY, String(nav.scrollLeft));
    } catch (error) {
      console.warn('Navigation position could not be saved.', error);
    }
  };

  nav.addEventListener('scroll', savePosition, { passive: true });
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', savePosition);
  });
})();
