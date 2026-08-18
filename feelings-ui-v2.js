(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const FAMILY_ORDER=['Happy','Surprised','Bad / Off','Fearful','Angry','Disgusted','Sad'];
  const SLICE=360/FAMILY_ORDER.length;
  let rotation=0,dragging=false,startAngle=0,startRotation=0,moved=false;

  const angleAt=(e,el)=>{const r=el.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);return Math.atan2(y,x)*180/Math.PI};
  const normalize=a=>((a%360)+360)%360;
  const targetForFamily=name=>-FAMILY_ORDER.indexOf(name)*SLICE;

  function animateReveal(el){if(!el)return;el.classList.remove('v2-arriving');void el.offsetWidth;el.classList.add('v2-arriving');setTimeout(()=>el.classList.remove('v2-arriving'),450)}
  function smartScroll(el){if(!el)return;setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),80)}

  function updateWheel(rot,instant=false){
    const wheel=q('#emotion-wheel'); if(!wheel)return;
    rotation=rot;
    wheel.style.setProperty('--wheel-rotation',`${rotation}deg`);
    qa('.family-wheel-button').forEach((b,i)=>{
      const a=i*SLICE+rotation;
      b.style.setProperty('--angle',`${a}deg`);
      b.style.setProperty('--reverse-angle',`${-a}deg`);
      if(instant)b.style.transition='none'; else b.style.removeProperty('transition');
    });
  }

  function snapAndChoose(){
    let idx=Math.round(-rotation/SLICE);
    idx=((idx%FAMILY_ORDER.length)+FAMILY_ORDER.length)%FAMILY_ORDER.length;
    const snap=-idx*SLICE;
    updateWheel(snap);
    const btn=qa('.family-wheel-button').find(b=>b.dataset.family===FAMILY_ORDER[idx]);
    if(btn){
      btn.click();
      const center=q('#wheel-center-label');
      if(center)center.innerHTML=`${FAMILY_ORDER[idx]}<small>selected • choose a middle feeling below</small>`;
    }
  }

  function setupWheel(){
    const wheel=q('#emotion-wheel'); const shell=q('.emotion-wheel-shell');
    if(!wheel||!shell)return;
    if(!shell.querySelector('.wheel-pointer-v2')){
      const p=document.createElement('div');p.className='wheel-pointer-v2';p.setAttribute('aria-hidden','true');shell.appendChild(p);
    }
    const oldHint=q('.wheel-instruction');
    if(oldHint&&!q('.wheel-spin-hint')){const h=document.createElement('p');h.className='wheel-spin-hint';h.textContent='Spin, swipe, or tap a feeling family';oldHint.before(h)}
    updateWheel(0,true); requestAnimationFrame(()=>updateWheel(0,false));

    wheel.addEventListener('pointerdown',e=>{
      if(e.target.closest('.family-wheel-button'))return;
      dragging=true;moved=false;startAngle=angleAt(e,wheel);startRotation=rotation;wheel.classList.add('is-spinning');wheel.setPointerCapture?.(e.pointerId);
    });
    wheel.addEventListener('pointermove',e=>{if(!dragging)return;const delta=angleAt(e,wheel)-startAngle;if(Math.abs(delta)>2)moved=true;updateWheel(startRotation+delta,true)});
    const finish=e=>{if(!dragging)return;dragging=false;wheel.classList.remove('is-spinning');try{wheel.releasePointerCapture?.(e.pointerId)}catch{};if(moved)snapAndChoose()};
    wheel.addEventListener('pointerup',finish);wheel.addEventListener('pointercancel',finish);

    qa('.family-wheel-button').forEach(b=>b.addEventListener('click',()=>{
      updateWheel(targetForFamily(b.dataset.family));
      const center=q('#wheel-center-label');
      if(center)center.innerHTML=`${b.dataset.family}<small>selected • go outward</small>`;
      animateReveal(q('#middle-step'));smartScroll(q('#middle-step'));
    }));
  }

  function setupStepFeedback(){
    qa('.middle-option').forEach(b=>b.addEventListener('click',()=>{animateReveal(q('#outer-step'));smartScroll(q('#outer-step'))}));
    const middle=q('#middle-options');
    if(middle)new MutationObserver(()=>qa('.middle-option').forEach(b=>{if(b.dataset.v2)return;b.dataset.v2='1';b.addEventListener('click',()=>{animateReveal(q('#outer-step'));smartScroll(q('#outer-step'))})})).observe(middle,{childList:true});

    const outer=q('#outer-options');
    if(outer)new MutationObserver(()=>qa('.outer-option').forEach(b=>{if(b.dataset.v2)return;b.dataset.v2='1';b.addEventListener('click',()=>{const c=q('#continue-to-context');if(c&&!c.disabled){c.animate?.([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:300});setTimeout(()=>c.scrollIntoView({behavior:'smooth',block:'center'}),120)}})})).observe(outer,{childList:true});

    const cont=q('#continue-to-context');
    if(cont)cont.addEventListener('click',()=>{animateReveal(q('#context-step'));smartScroll(q('#context-step'))});

    qa('#decision-options button').forEach(b=>b.addEventListener('click',()=>{
      /* The old UI only enabled a button much farther down the page. Make the choice do something immediately. */
      setTimeout(()=>{const r=q('#recommend-skill');if(r&&!r.disabled){r.click();animateReveal(q('#skill-result'));smartScroll(q('#skill-result'))}},60);
    }));
  }

  function setupTabs(){
    /* On phones the tabs are now a bottom dock. Switching views should return the user to the start of that view. */
    qa('.dbt-tab').forEach(b=>b.addEventListener('click',()=>{
      setTimeout(()=>{const v=q(`[data-view="${b.dataset.tab}"]`);if(v&&window.innerWidth<=680)v.scrollIntoView({behavior:'smooth',block:'start'})},60);
    }));
  }

  function fixProgressReset(){
    const reset=q('#reset-checkin');
    if(reset)reset.addEventListener('click',()=>{rotation=0;setTimeout(()=>updateWheel(0),0)});
  }

  function init(){setupWheel();setupStepFeedback();setupTabs();fixProgressReset()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
