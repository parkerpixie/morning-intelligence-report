(() => {
  const FEELINGS_KEY = 'morning-intelligence-report:dbt-checkins:v1';
  const PRACTICES_KEY = 'mir:dbtPractices:v1';
  const TIME_ZONE = 'America/Chicago';

  const FAMILIES = {
    Happy:{color:'#e1b75b',soft:'#f7edcf',middle:{Playful:['Aroused','Cheeky'],Content:['Free','Joyful'],Interested:['Curious','Inquisitive'],Proud:['Successful','Confident'],Accepted:['Respected','Valued'],Powerful:['Courageous','Creative'],Peaceful:['Loving','Thankful'],Trusting:['Sensitive','Intimate'],Optimistic:['Hopeful','Inspired']}},
    Surprised:{color:'#e29a61',soft:'#f8e3d2',middle:{Startled:['Shocked','Dismayed'],Confused:['Disillusioned','Perplexed'],Amazed:['Astonished','Awe'],Excited:['Eager','Energetic']}},
    'Bad / Off':{color:'#8c8993',soft:'#e9e7eb',middle:{Bored:['Indifferent','Apathetic'],Busy:['Pressured','Rushed'],Stressed:['Overwhelmed','Out of control'],Tired:['Sleepy','Unfocused']}},
    Fearful:{color:'#9386bd',soft:'#ebe7f5',middle:{Scared:['Helpless','Frightened'],Anxious:['Overwhelmed','Worried'],Insecure:['Inadequate','Inferior'],Weak:['Worthless','Insignificant'],Rejected:['Excluded','Persecuted'],Threatened:['Nervous','Exposed']}},
    Angry:{color:'#d97873',soft:'#f5dfdc',middle:{'Let down':['Betrayed','Resentful'],Humiliated:['Disrespected','Ridiculed'],Bitter:['Indignant','Violated'],Mad:['Furious','Jealous'],Aggressive:['Provoked','Hostile'],Frustrated:['Infuriated','Annoyed'],Distant:['Withdrawn','Numb'],Critical:['Skeptical','Dismissive']}},
    Disgusted:{color:'#7ea88d',soft:'#e3eee6',middle:{Disapproving:['Judgmental','Embarrassed'],Disappointed:['Appalled','Revolted'],Awful:['Nauseated','Detestable'],Repelled:['Horrified','Hesitant']}},
    Sad:{color:'#77a8c5',soft:'#e2edf4',middle:{Hurt:['Disappointed','Embarrassed'],Depressed:['Inferior','Empty'],Guilty:['Remorseful','Ashamed'],Despair:['Grief','Powerless'],Vulnerable:['Victimized','Fragile'],Lonely:['Isolated','Abandoned']}}
  };

  const read = (key, fallback = []) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('mir:personal-data-changed', { detail: { key } }));
  };

  const dateKey = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const feelings = () => {
    const value = read(FEELINGS_KEY, []);
    return Array.isArray(value) ? value : [];
  };

  const practices = () => {
    const value = read(PRACTICES_KEY, []);
    return Array.isArray(value) ? value : [];
  };

  const saveFeeling = (entry) => {
    const now = new Date();
    const value = {
      id: entry.id || crypto.randomUUID?.() || `feeling-${Date.now()}`,
      timestamp: entry.timestamp || now.toISOString(),
      date: entry.date || dateKey(now),
      source: entry.source || 'feelings',
      family: entry.family || '',
      middle: entry.middle || '',
      outer: Array.isArray(entry.outer) ? entry.outer : [],
      intensity: Number(entry.intensity) || 5,
      decision: entry.decision || null,
      skill: entry.skill || null,
      bodyContext: Array.isArray(entry.bodyContext) ? entry.bodyContext : [],
      note: String(entry.note || '').trim()
    };
    const list = feelings();
    list.push(value);
    write(FEELINGS_KEY, list);
    return value;
  };

  const savePractice = (entry) => {
    const now = new Date();
    const value = {
      id: entry.id || crypto.randomUUID?.() || `practice-${Date.now()}`,
      timestamp: entry.timestamp || now.toISOString(),
      date: entry.date || dateKey(now),
      source: entry.source || 'feelings',
      skill: String(entry.skill || '').trim(),
      prompt: String(entry.prompt || '').trim(),
      response: String(entry.response || '').trim(),
      beforeIntensity: Number(entry.beforeIntensity) || null,
      afterIntensity: Number(entry.afterIntensity) || null,
      note: String(entry.note || '').trim()
    };
    const list = practices();
    list.push(value);
    write(PRACTICES_KEY, list);
    return value;
  };

  window.MIRFeelings = { FEELINGS_KEY, PRACTICES_KEY, TIME_ZONE, FAMILIES, read, write, dateKey, feelings, practices, saveFeeling, savePractice };
})();
