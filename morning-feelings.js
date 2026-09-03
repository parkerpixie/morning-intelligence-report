(() => {
  const start = () => {
    const core = window.MIRFeelings;
    const reflection = document.querySelector('.cards-reflection');
    if (!core || !reflection || document.getElementById('morning-feelings')) return;

    const section = document.createElement('section');
    section.id = 'morning-feelings';
    section.className = 'morning-feelings';
    section.innerHTML = `
      <div class="morning-feelings-heading">
        <div>
          <p class="section-kicker">Before you make meaning</p>
          <h2>Where are you starting today?</h2>
          <p>This is the same Feelings history you can use all day. Your morning check-in simply becomes the first pin on today’s emotional map.</p>
        </div>
        <a class="deck-button" href="feelings.html">Open full Feelings Wheel ↗</a>
      </div>
      <div class="morning-feelings-card">
        <div id="morning-family-row" class="morning-family-row"></div>
        <div id="morning-middle-row" class="morning-choice-row" hidden></div>
        <div id="morning-outer-row" class="morning-choice-row" hidden></div>
        <div id="morning-context" class="morning-context" hidden>
          <label>Intensity <output id="morning-intensity-output">5 / 10</output></label>
          <input id="morning-intensity" type="range" min="1" max="10" value="5">
          <label for="morning-feeling-note">Anything you want future-you to remember? <span>optional</span></label>
          <textarea id="morning-feeling-note" rows="3" placeholder="One sentence is plenty…"></textarea>
          <button class="deck-button deck-button--primary" id="morning-feeling-save" type="button">Save morning check-in</button>
          <span id="morning-feeling-status" role="status"></span>
        </div>
        <div id="morning-feeling-saved" class="morning-feeling-saved" hidden></div>
      </div>`;
    reflection.insertAdjacentElement('beforebegin', section);

    const familyRow = section.querySelector('#morning-family-row');
    const middleRow = section.querySelector('#morning-middle-row');
    const outerRow = section.querySelector('#morning-outer-row');
    const context = section.querySelector('#morning-context');
    const intensity = section.querySelector('#morning-intensity');
    const intensityOutput = section.querySelector('#morning-intensity-output');
    const note = section.querySelector('#morning-feeling-note');
    const status = section.querySelector('#morning-feeling-status');
    const saved = section.querySelector('#morning-feeling-saved');
    let family = '';
    let middle = '';
    const outer = new Set();

    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const todayEntries = () => core.feelings().filter((entry) => entry.date === core.dateKey() && entry.source === 'morning');

    const renderSaved = () => {
      const entries = todayEntries();
      if (!entries.length) return;
      const last = entries.at(-1);
      saved.hidden = false;
      saved.innerHTML = `<strong>Today began with ${esc(last.outer?.join(' + ') || last.family)}</strong><span>${esc(last.family)}${last.middle ? ` → ${esc(last.middle)}` : ''} · ${last.intensity}/10</span>`;
    };

    familyRow.innerHTML = Object.entries(core.FAMILIES).map(([name, data]) => `<button type="button" data-family="${esc(name)}" style="--feeling:${data.color};--soft:${data.soft}">${esc(name)}</button>`).join('');
    familyRow.querySelectorAll('[data-family]').forEach((button) => button.addEventListener('click', () => {
      family = button.dataset.family;
      middle = '';
      outer.clear();
      familyRow.querySelectorAll('button').forEach((b) => b.classList.toggle('is-selected', b === button));
      middleRow.hidden = false;
      outerRow.hidden = true;
      context.hidden = true;
      middleRow.innerHTML = `<strong>What kind of ${esc(family.toLowerCase())}?</strong>` + Object.keys(core.FAMILIES[family].middle).map((name) => `<button type="button" data-middle="${esc(name)}">${esc(name)}</button>`).join('');
      middleRow.querySelectorAll('[data-middle]').forEach((midButton) => midButton.addEventListener('click', () => {
        middle = midButton.dataset.middle;
        outer.clear();
        middleRow.querySelectorAll('button').forEach((b) => b.classList.toggle('is-selected', b === midButton));
        outerRow.hidden = false;
        context.hidden = false;
        outerRow.innerHTML = `<strong>Which words actually fit?</strong>` + core.FAMILIES[family].middle[middle].map((name) => `<button type="button" data-outer="${esc(name)}">${esc(name)}</button>`).join('');
        outerRow.querySelectorAll('[data-outer]').forEach((outerButton) => outerButton.addEventListener('click', () => {
          const value = outerButton.dataset.outer;
          outer.has(value) ? outer.delete(value) : outer.add(value);
          outerButton.classList.toggle('is-selected', outer.has(value));
        }));
      }));
    }));

    intensity.addEventListener('input', () => { intensityOutput.textContent = `${intensity.value} / 10`; });
    section.querySelector('#morning-feeling-save').addEventListener('click', () => {
      if (!family || !middle || !outer.size) {
        status.textContent = 'Choose the specific feeling word first.';
        return;
      }
      core.saveFeeling({ source:'morning', family, middle, outer:[...outer], intensity:+intensity.value, note:note.value.trim() });
      status.textContent = 'Saved to today’s My Days story. ✓';
      renderSaved();
    });

    renderSaved();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
})();
