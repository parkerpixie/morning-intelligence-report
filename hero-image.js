(() => {
  const image = document.getElementById('clementine-hero-image');
  const figure = image?.closest('.report-title-art');

  if (!image || !figure) return;

  const parts = [
    'assets/images/clementine-madison-morning/part-01a.txt',
    'assets/images/clementine-madison-morning/part-01b.txt',
    'assets/images/clementine-madison-morning/part-02.txt',
    'assets/images/clementine-madison-morning/part-03.txt',
    'assets/images/clementine-madison-morning/part-04.txt'
  ];

  const loadHeroImage = async () => {
    const responses = await Promise.all(parts.map((path) => fetch(path)));

    const failed = responses.find((response) => !response.ok);
    if (failed) throw new Error(`Hero image request failed: ${failed.status}`);

    const chunks = await Promise.all(responses.map((response) => response.text()));
    const encoded = chunks.join('').replace(/\s/g, '');
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));

    image.addEventListener('load', () => {
      figure.classList.add('is-ready');
      URL.revokeObjectURL(objectUrl);
    }, { once: true });

    image.src = objectUrl;
  };

  loadHeroImage().catch((error) => {
    console.error(error);
    figure.classList.add('image-error');
  });
})();
