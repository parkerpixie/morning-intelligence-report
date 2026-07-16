(() => {
  const image = document.getElementById('clementine-hero-image');
  const figure = image?.closest('.report-title-art');

  if (!image || !figure) return;

  const markReady = () => {
    figure.classList.remove('image-error');
    figure.classList.add('is-ready');
  };

  image.addEventListener('load', markReady, { once: true });
  image.addEventListener('error', () => {
    figure.classList.remove('is-ready');
    figure.classList.add('image-error');
  }, { once: true });

  image.src = 'assets/images/clementine-madison-morning.webp';

  if (image.complete && image.naturalWidth > 0) {
    markReady();
  }
})();
