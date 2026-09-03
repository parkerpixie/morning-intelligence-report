(() => {
  const SECRET_KEY='mir:personalSync:secret:v1';
  const SHADOW_KEY='mir:personalSync:shadow:v1:wellbeing';
  const FEELINGS_KEY='morning-intelligence-report:dbt-checkins:v1';
  const PRACTICES_KEY='mir:dbtPractices:v1';
  const ENDPOINT='/api/personal-sync';
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const toB64=(bytes)=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')};
  const fromB64=(value)=>{const n=String(value||'').replaceAll('-','+').replaceAll('_','/');const p=n+'='.repeat((4-n.length%4)%4);const s=atob(p),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b};
  const valid=(v)=>{try{return fromB64(v).length===32}catch{return false}};
  const imported=()=>{if(!location.hash.startsWith('#sync='))return null;const v=decodeURIComponent(location.hash.slice(6));if(!valid(v))return null;history.replaceState(null,'',location.pathname+location.search);return v};
  const secret=()=>{const imp=imported();if(imp){localStorage.setItem(SECRET_KEY,imp);return imp}const stored=localStorage.getItem(SECRET_KEY);if(stored&&valid(stored))return stored;const v=toB64(crypto.getRandomValues(new Uint8Array(32)));localStorage.setItem(SECRET_KEY,v);return v};
  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
  const write=(key,v)=>localStorage.setItem(key,JSON.stringify(v));
  const mergeList=(a,b)=>{const map=new Map();[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].forEach((item)=>{if(!item)return;const id=item.id||`${item.timestamp||''}|${item.skill||''}|${item.family||''}`;const prior=map.get(id);if(!prior||String(item.timestamp||'')>=String(prior.timestamp||''))map.set(id,item)});return [...map.values()].sort((x,y)=>String(x.timestamp||'').localeCompare(String(y.timestamp||'')))};
  const localState=()=>({version:1,feelings:read(FEELINGS_KEY,[]),practices:read(PRACTICES_KEY,[])});
  const merge=(a,b)=>({version:1,feelings:mergeList(a?.feelings,b?.feelings),practices:mergeList(a?.practices,b?.practices)});
  const post=async(payload)=>{const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Sync failed');return j};
  const encrypt=async(key,value)=>{const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(value))));return{iv:toB64(iv),ciphertext:toB64(ciphertext)}};
  const decrypt=async(key,record)=>JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(record.iv)},key,fromB64(record.ciphertext))));
  let busy=false,lastRaw='';
  const sync=async()=>{if(busy||!navigator.onLine)return;busy=true;try{const s=secret(),bytes=fromB64(s),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),syncId=[...digest].map(v=>v.toString(16).padStart(2,'0')).join(''),key=await crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);const local=localState();const loaded=await post({action:'load',sync_id:syncId,namespace:'wellbeing'});let merged=local;if(loaded.found){const remote=await decrypt(key,loaded.record);merged=merge(local,remote)}write(FEELINGS_KEY,merged.feelings);write(PRACTICES_KEY,merged.practices);const encrypted=await encrypt(key,merged);await post({action:'save',sync_id:syncId,namespace:'wellbeing',...encrypted,client_updated_at:new Date().toISOString()});localStorage.setItem(SHADOW_KEY,JSON.stringify(merged));lastRaw=JSON.stringify(merged);window.dispatchEvent(new CustomEvent('mir:wellbeing-synced',{detail:{at:new Date().toISOString()}}))}catch(e){console.warn('Wellbeing sync unavailable.',e)}finally{busy=false}};
  const monitor=()=>{const raw=JSON.stringify(localState());if(raw!==lastRaw){lastRaw=raw;sync()}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();setInterval(monitor,1800)},{once:true});else{sync();setInterval(monitor,1800)}
  window.addEventListener('online',sync);window.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});window.addEventListener('mir:personal-data-changed',sync);
})();
