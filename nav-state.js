(() => {
  const NAV_SCROLL_KEY = 'morning-intelligence-report:section-nav-scroll';
  const nav = document.querySelector('.section-nav-inner');
  if (!nav) return;

  const capybaraLink = nav.querySelector('[data-nav="capybara"]');
  const bigStoryLink = nav.querySelector('[data-nav="big-story"]');
  const archiveLink = nav.querySelector('[data-nav="archive"]');

  if (capybaraLink && bigStoryLink) bigStoryLink.after(capybaraLink);
  if (archiveLink) nav.appendChild(archiveLink);

  const activePage = document.body.dataset.page;
  const activeLink = activePage ? nav.querySelector(`[data-nav="${activePage}"]`) : null;

  try {
    const savedScroll = Number(localStorage.getItem(NAV_SCROLL_KEY));
    if (Number.isFinite(savedScroll)) nav.scrollLeft = savedScroll;

    requestAnimationFrame(() => {
      if (!activeLink) return;
      const start = activeLink.offsetLeft;
      const end = start + activeLink.offsetWidth;
      if (start < nav.scrollLeft || end > nav.scrollLeft + nav.clientWidth) {
        activeLink.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    });
  } catch (error) {
    console.warn('Navigation position could not be restored.', error);
  }

  const savePosition = () => {
    try {
      localStorage.setItem(NAV_SCROLL_KEY, String(nav.scrollLeft));
    } catch (error) {
      console.warn('Navigation position could not be saved.', error);
    }
  };

  nav.addEventListener('scroll', savePosition, { passive: true });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', savePosition));
  window.addEventListener('pagehide', savePosition);
})();