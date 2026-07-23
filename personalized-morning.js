(() => {
  const dayIndex = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  };
  const pick = (items, offset = 0) => items[(dayIndex() + offset) % items.length];

  const card = (icon, kicker, title, text) => {
    const article = document.createElement('article');
    article.className = 'morning-feature-card';
    article.innerHTML = `<span class="morning-feature-icon" aria-hidden="true">${icon}</span><div><p class="morning-feature-kicker">${kicker}</p><h2>${title}</h2><p>${text}</p></div>`;
    return article;
  };

  const buildPollenCard = async () => {
    const cardEl = document.createElement('article');
    cardEl.className = 'pollen-card';
    cardEl.innerHTML = `<div><p class="morning-feature-kicker">Allergy watch</p><h2>Madison Pollen Levels</h2><p class="pollen-status">Checking today’s sneeze suspects…</p><div class="pollen-levels"></div><a href="https://www.mypollenpal.com/madison-wi" target="_blank" rel="noopener noreferrer">Full pollen report ↗</a></div>`;

    try {
      const response = await fetch('/api/pollen', { cache: 'no-store' });
      if (!response.ok) throw new Error('Pollen unavailable');
      const data = await response.json();
      const levels = cardEl.querySelector('.pollen-levels');
      const rows = [
        ['🌳', 'Tree', data.pollen?.tree],
        ['🌱', 'Grass', data.pollen?.grass],
        ['🌿', 'Weed / ragweed', data.pollen?.weed]
      ];
      rows.forEach(([icon, label, value]) => {
        const item = document.createElement('div');
        item.className = 'pollen-level';
        item.innerHTML = `<span>${icon} ${label}</span><strong data-level="${String(value || 'Unknown').toLowerCase().replace(/\s+/g, '-')}">${value || 'Unknown'}</strong>`;
        levels.appendChild(item);
      });
      const summary = data.overall ? `Overall pollen: ${data.overall}.` : 'Today’s pollen mix is shown below.';
      cardEl.querySelector('.pollen-status').textContent = summary;
    } catch {
      cardEl.querySelector('.pollen-status').textContent = 'Live pollen levels could not load, but the full Madison report is still available below.';
    }
    return cardEl;
  };

  const buildHome = async () => {
    if (document.body.dataset.page !== 'home') return;
    document.querySelector('#quick-scan')?.remove();

    const weather = document.querySelector('.weather-strip-shell');
    if (!weather || document.querySelector('#morning-personal-features')) return;

    const curiosities = [
      'Capybaras can stay underwater for about five minutes, using water as both refuge and social lounge.',
      'Octopus arms can taste what they touch, which is a frankly excessive amount of sensory ambition.',
      'Sandhill cranes practice dancing before they are old enough to use it for courtship.',
      'Crows can remember human faces for years and teach other crows who is trustworthy.',
      'A teaspoon of healthy soil can contain more organisms than there are people on Earth.',
      'Bumblebees can learn simple tasks by watching other bees solve them first.',
      'Some trees exchange nutrients through underground fungal networks, making a forest more neighborhood than crowd.'
    ];
    const noticing = [
      'Notice the first sound today that was not made by a machine.',
      'Look for one small thing growing where nobody deliberately planted it.',
      'Find three different shades of green before noon.',
      'Pause for the first bird you hear and let it have the whole stage for five seconds.',
      'Notice one moment when your shoulders soften without being told.',
      'Watch the shape of a shadow change instead of checking the clock.',
      'Notice one ordinary object that quietly makes your life easier.'
    ];
    const nature = [
      'Late-July prairie flowers are feeding bees and butterflies across southern Wisconsin. Hummingbirds are also becoming busier as migration approaches.',
      'Warm, humid mornings favor dragonflies near ponds and marshes. After rain, woodland paths may produce mushrooms almost overnight.',
      'Monarch activity is building across southern Wisconsin. Milkweed patches may hold eggs, caterpillars, or newly emerged adults.',
      'Dawn and dusk are prime hours for sandhill cranes, rabbits, and deer. Listen near wetlands for crane calls.',
      'Prairie seeds are beginning to form even while summer flowers remain bright. Goldfinches often arrive early to inspect the buffet.',
      'Fireflies remain active along darker yard edges and meadows, especially after warm, humid days.',
      'Young birds are everywhere now, often nearly adult-sized while still loudly requesting room service.'
    ];

    const section = document.createElement('section');
    section.id = 'morning-personal-features';
    section.className = 'morning-personal-features';
    section.append(
      card('✦', 'A small astonishment', 'Today’s Curiosity', pick(curiosities)),
      card('🍃', 'A five-second practice', 'One Thing Worth Noticing', pick(noticing, 2)),
      card('🌼', 'Outside in Madison', 'Wisconsin Nature Forecast', pick(nature, 4)),
      await buildPollenCard()
    );
    weather.after(section);
  };

  const moonPhase = () => {
    const knownNewMoon = new Date('2024-01-11T11:57:00Z').getTime();
    const cycle = 29.53058867;
    const age = ((Date.now() - knownNewMoon) / 86400000) % cycle;
    if (age < 1.8 || age > 27.7) return 'New moon';
    if (age < 5.5) return 'Waxing crescent';
    if (age < 9.2) return 'First quarter';
    if (age < 12.9) return 'Waxing gibbous';
    if (age < 16.6) return 'Full moon';
    if (age < 20.3) return 'Waning gibbous';
    if (age < 24) return 'Last quarter';
    return 'Waning crescent';
  };

  const buildCapybara = () => {
    if (document.body.dataset.page !== 'capybara') return;
    const anchor = document.querySelector('.capybara-section');
    if (!anchor || document.querySelector('#clementine-daily-notes')) return;

    const powers = [
      ['Pattern Recognition', 'Your brain notices relationships and inconsistencies quickly. Trust the connection you spot before you can fully explain it.'],
      ['Curiosity', 'The question pulling you sideways may be pointing somewhere useful. Give it a small, intentional window.'],
      ['Hyperfocus', 'When attention locks onto meaningful work, you can build astonishing momentum. Choose the target carefully.'],
      ['Creative Association', 'Your mind keeps distant ideas in neighboring rooms. Open the connecting door today.'],
      ['Improvisation', 'You are good at finding a workable path when the official map stops making sense.'],
      ['Enthusiasm', 'Interest gives your brain electricity. Let genuine excitement help you begin.'],
      ['Crisis Clarity', 'When something matters, unnecessary noise often falls away. Borrow that clarity before an emergency arrives.']
    ];
    const canopy = [
      'An emotion can be real without being an instruction. Name it, make room for it, and choose your next move from your values.',
      'You are allowed to pause before answering. A thoughtful delay is sometimes how wisdom catches up with adrenaline.',
      'Not every uncomfortable feeling needs fixing. Some only need a safe place to finish passing through.',
      'Replace “What is wrong with me?” with “What is my nervous system trying to protect?” The second question opens a door.',
      'A boundary does not require anger to be valid. Calm and firm can occupy the same sentence.',
      'You can dislike a situation and still choose the version of yourself you want to bring into it.',
      'Self-compassion is not letting yourself off the hook. It is refusing to use cruelty as a productivity tool.'
    ];
    const future = [
      'You were never behind. You were building skills in places that did not yet know how to name them.',
      'The work you are documenting now becomes evidence later. Keep the screenshots. Keep the story.',
      'One difficult meeting does not get to narrate the whole week.',
      'You become much better at protecting your energy without apologizing for it.',
      'The things that feel scattered right now eventually look like a body of work.',
      'You do not need every answer today. You only need the next honest step.',
      'The version of you reading this later is grateful that you kept building before certainty arrived.'
    ];

    const [power, powerText] = pick(powers, 1);
    const section = document.createElement('section');
    section.id = 'clementine-daily-notes';
    section.className = 'clementine-daily-notes';
    section.innerHTML = `
      <article><p class="morning-feature-kicker">🌙 Celestial Minute</p><h2>${moonPhase()}</h2><p>The moon is keeping its own schedule. You are permitted to do the same.</p></article>
      <article><p class="morning-feature-kicker">🧠 ADHD Superpower</p><h2>${power}</h2><p>${powerText}</p></article>
      <article><p class="morning-feature-kicker">🍄 Under the Canopy</p><h2>A quieter place to stand</h2><p>${pick(canopy, 3)}</p></article>
      <article><p class="morning-feature-kicker">✉️ Future Jen</p><h2>A note from farther down the path</h2><p>${pick(future, 5)}</p></article>`;
    anchor.after(section);
  };

  buildHome();
  buildCapybara();
})();