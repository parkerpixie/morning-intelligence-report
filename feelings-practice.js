(() => {
  const PROMPTS = {
    'WISE MIND':'What does emotion mind know that matters? What does reasonable mind know that matters? What answer remains when neither side gets erased?',
    STOP:'What happens if you obey the first urge? What becomes possible if you wait long enough to choose?',
    TIPP:'Which part of TIPP can you do in the next two minutes?',
    'RADICAL ACCEPTANCE':'What exact fact are you refusing to let be true? What changes if you acknowledge it without approving of it?',
    'OPPOSITE ACTION':'What is the emotion telling you to do? If that urge is ineffective, what is its behavioral opposite?',
    'PROBLEM SOLVING':'What part is actually solvable today? What would count as progress rather than perfection?',
    'DEAR MAN':'What exactly are you asking for? Can you describe the facts without building the prosecution case first?',
    FAST:'If you walked away still respecting yourself, what would you have said, not said, or refused to pretend?'
  };

  const render = () => {
    const core = window.MIRFeelings;
    const result = document.getElementById('skill-result');
    const nameEl = document.getElementById('recommended-skill-name');
    if (!core || !result || !nameEl || result.hidden) return;
    const skill = nameEl.textContent.trim();
    if (!skill || result.querySelector('.guided-dbt-practice')?.dataset.skill === skill) return;
    result.querySelector('.guided-dbt-practice')?.remove();
    const prompt = PROMPTS[skill] || 'What did using this skill help you notice or choose?';
    const before = Number(document.getElementById('intensity')?.value || 5);
    const box = document.createElement('section');
    box.className = 'guided-dbt-practice';
    box.dataset.skill = skill;
    box.innerHTML = `<p class="section-kicker">Actually use the skill</p><h3>Practice ${skill}</h3><p>${prompt}</p><textarea rows="4" placeholder="Write the useful part, not the perfect part…"></textarea><div class="guided-intensity"><label>Before <strong>${before}/10</strong></label><label>After <output>${before}/10</output><input type="range" min="1" max="10" value="${before}"></label></div><div class="skill-result-actions"><button class="primary-action" type="button">Save practice</button><button class="secondary-action" type="button" data-another>Choose another skill</button></div><p class="save-status" role="status"></p>`;
    result.appendChild(box);
    const slider = box.querySelector('input');
    const output = box.querySelector('output');
    slider.addEventListener('input',()=>output.textContent=`${slider.value}/10`);
    box.querySelector('.primary-action').addEventListener('click',()=>{
      core.savePractice({ source:'feelings', skill, prompt, response:box.querySelector('textarea').value.trim(), beforeIntensity:before, afterIntensity:+slider.value });
      box.querySelector('[role=status]').textContent='Practice saved to My Days. ✓';
    });
    box.querySelector('[data-another]').addEventListener('click',()=>{
      document.querySelector('[data-tab="skills"]')?.click();
      document.getElementById('view-skills')?.scrollIntoView({behavior:'smooth'});
    });
  };

  const start=()=>{
    const button=document.getElementById('recommend-skill');
    button?.addEventListener('click',()=>setTimeout(render,0));
    const style=document.createElement('style');
    style.textContent='.guided-dbt-practice{margin-top:24px;padding:20px;border-radius:18px;background:#fff;border:1px solid rgba(88,54,79,.14)}.guided-dbt-practice h3{margin:.2rem 0 .5rem}.guided-dbt-practice textarea{width:100%;box-sizing:border-box;border:1px solid rgba(54,63,71,.2);border-radius:14px;padding:12px;font:inherit}.guided-intensity{display:grid;grid-template-columns:1fr 2fr;gap:16px;margin:16px 0}.guided-intensity label{display:grid;gap:6px}.guided-intensity input{width:100%}';
    document.head.appendChild(style);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
