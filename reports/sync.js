/* ---------------------------------------------------------------- website storage: every upload is saved on the site (/api/store), so each browser and device sees the same history */
const SYNC={on:false, tried:false, err:'', days:[], trackerTo:null}; const SYNC_API='api/store';
const syncable=()=>/^https?:$/.test(location.protocol);
async function syncFetch(opt){ const r=await fetch(SYNC_API,{cache:'no-store',credentials:'same-origin',headers:{'content-type':'application/json'},...opt}); const j=await r.json().catch(()=>null); if(!r.ok||!j||!j.ok) throw new Error((j&&j.error)||('website storage answered '+r.status)); return j; }
function syncSnapshot(){ return {meta:{...META, rowsRaw:undefined}, rows:rows.map(r=>[r.d,r.hr,r.tl,r.om,r.xm,r.gsr0,r.xmc,r.esim,r.dev,r.promo,r.dup,r.inr,r.ov,r.ty,r.id,r.h,r.sim]), roster:roster.map(a=>[a.hr,a.name,a.tl,a.om,a.phase,a.tenure,a.wave]), rosters:EPOCHS.slice(0,-1).map(e=>({from:e.from,name:e.name,roster:e.list})), tls:TLS, oms:OMS}; }
const syncNewer=(a,b)=>{ const am=String(a.meta.maxDate), bm=String(b.meta.maxDate); return am>bm||(am===bm&&(a.rows.length>b.rows.length||(a.rows.length===b.rows.length&&(a.meta.rosterAt||0)>(b.meta.rosterAt||0)))); };
async function syncPull(){ if(!syncable()) { renderSyncStatus(); return; } SYNC.tried=true;
  try{ const j=await syncFetch({method:'GET'}); SYNC.on=true; SYNC.err=''; let changed=false;
    const sd=(j.calls&&j.calls.days)||{}; CALLS_SERVER=sd; for(const [d,v] of Object.entries(sd)){ const l=CALLS.days[d]; if(!l||(v.added||0)>=(l.added||0)){ if(!l||l.added!==v.added||l.src!==v.src) changed=true; CALLS.days[d]=v; } }
    const missing=Object.keys(CALLS.days).filter(d=>!sd[d]); SYNC.days=Object.keys(sd).sort(); callsPersist();
    const t=j.tracker; if(t&&t.rows&&t.rows.length&&syncNewer(t,{meta:META,rows})){ applyData(t); persist(); rebuildForData(); changed=false; }
    SYNC.trackerTo=t?t.meta.maxDate:null;
    if(changed) renderAll(); renderSyncStatus();
    // anything this browser has that the website does not (built-in days, an upload made offline) is saved up now
    for(const d of missing) await syncPushCalls(d,true);
    if(!t||syncNewer({meta:META,rows},t)) await syncPushTracker(true);
  }catch(e){ SYNC.on=false; SYNC.err=e.message; renderSyncStatus(); } }
async function syncPushCalls(date,quiet){ if(!syncable()) return false; const v=CALLS.days[date]; if(!v) return false;
  try{ const j=await syncFetch({method:'POST',body:JSON.stringify({kind:'calls',day:{date,src:v.src,a:v.a,added:v.added||0}})}); SYNC.on=true; SYNC.err=''; SYNC.days=j.days; CALLS_SERVER[date]=v; renderSyncStatus(); return true; }
  catch(e){ SYNC.err=e.message; renderSyncStatus(); if(!quiet) toast('Calls kept in this browser only – the website could not save them ('+e.message+')',true); return false; } }
async function syncPushTracker(quiet){ if(!syncable()) return false;
  try{ const j=await syncFetch({method:'POST',body:JSON.stringify({kind:'tracker',data:syncSnapshot()})}); SYNC.on=true; SYNC.err=''; const t=j.tracker; SYNC.trackerTo=t.meta.maxDate;
    if(t.rows.length!==rows.length||t.meta.minDate!==META.minDate||t.meta.maxDate!==META.maxDate){ applyData(t); persist(); rebuildForData(); }
    renderSyncStatus(); return t; }
  catch(e){ SYNC.err=e.message; renderSyncStatus(); if(!quiet) toast('Sales data kept in this browser only – the website could not save it ('+e.message+')',true); return false; } }
async function syncDeleteDay(date){ try{ const r=await fetch(SYNC_API+'?day='+encodeURIComponent(date),{method:'DELETE',credentials:'same-origin'}); const j=await r.json().catch(()=>null); if(!r.ok||!j||!j.ok) throw new Error((j&&j.error)||('website storage answered '+r.status)); delete CALLS_SERVER[date]; SYNC.days=SYNC.days.filter(d=>d!==date); return true; }catch(e){ toast('Could not remove '+fd(date)+' from the website ('+e.message+')',true); return false; } }
function renderSyncStatus(){ const on=SYNC.on, el=document.getElementById('syncStatus');
  const txt=!syncable()? 'Opened as a file: uploads are kept in this browser only. Open the website link to save them for everyone.'
    : on? `Saved on the website: ${SYNC.days.length} day${SYNC.days.length===1?'':'s'} of calls${SYNC.trackerTo?` · sales through ${fdl(SYNC.trackerTo)}`:''}. Every upload is added to this history and shows on every device.`
    : SYNC.tried? `Website storage not reachable${SYNC.err?` (${SYNC.err})`:''}: uploads are kept in this browser for now and are saved to the website on the next visit.` : 'Connecting to website storage…';
  if(el){ el.textContent=txt; el.className='sync-status '+(on?'ok':syncable()&&SYNC.tried?'warn':''); }
  const um=document.getElementById('uploadMsg'); if(um&&um.dataset.idle!=='0') um.textContent=`Drop the Sales Tracker export (.xlsx), the daily TSX handover with calls (.xlsb) or the roster workbook anywhere on this page · ${on?'each upload is saved on the website and adds to the history':'processed in this browser'}.`;
  const cc=document.getElementById('clearCalls'); if(cc) cc.hidden=on; renderCallsSources(); }
