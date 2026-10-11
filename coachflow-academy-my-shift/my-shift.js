/* My Shift: shift timer and call log as an Academy station at #/academy/my-shift. Built from the Academy's own components; saved only in this browser. */
(function(){
"use strict";
var ROUTE="#/academy/my-shift", LABEL="My Shift", TITLE="My Shift · CoachFlow Academy", KEY="coachflow.myshift.v1", PLANNED_H=8;
var BTN_P="inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 aura-brand text-brand-contrast min-h-11 rounded-[var(--radius-control-md)] px-4 py-2.5 text-sm";
var BTN_S="inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 aura-control text-ink min-h-11 rounded-[var(--radius-control-md)] px-4 py-2.5 text-sm";
var TH='class="ms-th border-b border-line-strong px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted"';
var CALL_TYPES=["Internet","TV","Mobile","Billing","Outage","Other"];
var NOT_OFFERED=["Account not eligible","Account restriction","Customer upset","Unauthorized caller","No opening","Already has it","Other"];
var GSR_WHY=["Price","Not interested","Needs to think","Partner decides","Contract","Already at top tier","Other"];
var XM_WHY=["Price","Not interested","Coverage","Contract","Needs to think","Partner decides","Happy with current carrier","Credit check","Other"];
function opts(a){ return a.map(function(x){ return [x,x]; }); }
var st=load(), root=null, form={}, editId=null, tries=0, timer=null, newId=null, tick=false, lastRail={}, arriveT=null;
var SEAL='<span class="ms-seal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
function load(){ try{ var s=JSON.parse(localStorage.getItem(KEY)||"null"); if(s&&s.calls) return s; }catch(e){} return {shift:null,calls:[],history:[]}; }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} }
function q(id){ return root.querySelector("#"+id); }
function pad(n){ return (n<10?"0":"")+n; }
function dkey(t){ var d=new Date(t); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function hm(t){ var d=new Date(t); return pad(d.getHours())+":"+pad(d.getMinutes()); }
function dur(ms){ ms=Math.max(0,ms); var s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60); return h+":"+pad(m)+":"+pad(s%60); }
function durShort(ms){ var m=Math.round(Math.max(0,ms)/60000); return Math.floor(m/60)+"h "+pad(m%60)+"m"; }
function fmtAcct(a){ return (a||"").replace(/(\d{4})(?=\d)/g,"$1 "); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function todayStr(){ return new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"}); }
function onRoute(){ var h=location.hash.replace(/\?.*$/,""); return h===ROUTE||h===ROUTE+"/"; }

/* ---------- markup, from the Academy's own parts ---------- */
function chips(field,label,opts,extra){ return '<div class="sl-chips ms-chips'+(extra?" "+extra:"")+'" role="group" aria-label="'+esc(label)+'" data-field="'+field+'">'+opts.map(function(o){ return '<button type="button" class="sl-chip" aria-pressed="false" data-v="'+esc(o[0])+'">'+esc(o[1])+'</button>'; }).join("")+'</div>'; }
function build(){
  root=document.createElement("main"); root.id="my-shift"; root.className="sl-main mx-auto w-full max-w-[86rem] flex-1 px-4 py-6 [overflow-wrap:anywhere] sm:px-6 sm:py-8"; root.setAttribute("aria-label",LABEL);
  root.innerHTML='<div class="space-y-8">'+
  '<header class="role-rail mb-6" data-ms-i="0"><div class="flex flex-wrap items-start justify-between gap-4"><div class="min-w-0 max-w-2xl"><h1 class="text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">My Shift</h1><div class="mt-1.5 text-[0.95rem] text-body">Start the timer when you sit down, write every call down in under a minute, and hand your team leader one line at the end. It all stays in this browser.</div></div><p class="tabular text-sm font-semibold text-muted" id="ms-date"></p></div></header>'+
  '<div class="sl-gate-layout"><div class="sl-gate-main">'+
   '<section class="sl-gate-phase" aria-labelledby="ms-h1" data-ms-i="1"><div class="sl-gate-phase-head"><span class="sl-gate-node tabular text-sm font-semibold text-muted" id="ms-n1" aria-hidden="true">1</span><h2 id="ms-h1">Your shift</h2><p class="sl-gate-tally tabular ml-auto text-sm font-semibold text-muted" id="ms-t1">not started</p></div>'+
    '<div class="ms-bar" id="ms-bar" data-state="idle"><div class="ms-ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="14" fill="none" stroke-width="4"/><circle class="fg" id="ms-fg" cx="18" cy="18" r="14" fill="none" stroke-width="4" stroke-dasharray="88" stroke-dashoffset="88"/></svg></div><span class="ms-time" id="ms-clock">0:00:00</span><span class="text-sm text-body" id="ms-note"></span><span class="ms-sep" id="ms-sep" hidden></span><div class="ms-stats" id="ms-stats" hidden></div><div class="ms-right" id="ms-btns"></div></div></section>'+
   '<section class="sl-gate-phase" aria-labelledby="ms-h2" data-ms-i="2"><div class="sl-gate-phase-head"><span class="sl-gate-node tabular text-sm font-semibold text-muted" aria-hidden="true">2</span><h2 id="ms-h2">Log this call</h2><p class="sl-gate-tally tabular ml-auto text-sm font-semibold text-muted" id="ms-t2">under a minute</p></div>'+
    '<div class="grid gap-4 sm:grid-cols-2"><div><label class="ms-lab" for="ms-acct">Account number <i>*</i></label><input class="ms-input" id="ms-acct" type="text" inputmode="numeric" autocomplete="off" placeholder="Numbers only" maxlength="24"></div>'+
     '<div><span class="ms-lab">Call type <i>*</i></span>'+chips("callType","Call type",opts(CALL_TYPES))+'</div>'+
     '<div><span class="ms-lab" id="ms-l-res">Issue resolved? <i>*</i></span>'+chips("resolved","Issue resolved",[["resolved","Resolved"],["not","Not resolved"],["escalated","Escalated"]])+'</div>'+
     '<div><span class="ms-lab" id="ms-l-sat">Customer satisfied? <i>*</i></span>'+chips("satisfied","Customer satisfied",[["yes","Satisfied"],["no","Not satisfied"]])+'</div></div>'+
    '<div class="grid gap-4 sm:grid-cols-2 ms-sub"><div class="sl-measure"><p class="sl-measure-kind">GSR · home upgrade <span>offered → result → why</span></p>'+chips("gsrOffered","GSR offered",[["yes","Offered"],["no","Not offered"]])+'<div class="ms-why ms-hide" id="ms-w-gsrNotWhy"><span class="ms-lab">Why was it not offered? <i>*</i></span>'+chips("gsrNotWhy","Why GSR was not offered",opts(NOT_OFFERED))+'</div>'+chips("gsrResult","GSR result",[["completed","Completed"],["declined","Declined"],["followup","Follow-up"]],"ms-hide")+chips("gsrWhich","Which GSR",[["Internet tier","Internet tier"],["TV package","TV package"],["Home add-on","Home add-on"],["Watch line","Watch line"],["Tablet line","Tablet line"]],"ms-hide")+'<div class="ms-why ms-hide" id="ms-w-gsrWhy"><span class="ms-lab" id="ms-l-gsrWhy">Why did the customer decline? <i>*</i></span>'+chips("gsrWhy","Why GSR was declined",opts(GSR_WHY))+'</div></div>'+
     '<div class="sl-measure"><p class="sl-measure-kind">XM · Xfinity Mobile <span>offered → result → why not</span></p>'+chips("xmOffered","XM offered",[["yes","Offered"],["no","Not offered"]])+'<div class="ms-why ms-hide" id="ms-w-xmNotWhy"><span class="ms-lab">Why was it not offered? <i>*</i></span>'+chips("xmNotWhy","Why XM was not offered",opts(NOT_OFFERED))+'</div>'+chips("xmResult","XM result",[["completed","Completed"],["declined","Declined"],["followup","Follow-up"]],"ms-hide")+'<div class="ms-why ms-hide" id="ms-w-xmWhy"><span class="ms-lab" id="ms-l-xmWhy">Why did the customer decline? <i>*</i></span>'+chips("xmWhy","Why XM was declined",opts(XM_WHY))+'</div></div></div>'+
    '<div class="mt-4"><label class="ms-lab" for="ms-notein">What happened, in a few words (optional)</label><input class="ms-input ms-note" id="ms-notein" type="text" placeholder="Callback time, what was quoted, what the customer said" maxlength="240"></div>'+
    '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"><button type="button" class="'+BTN_P+'" id="ms-save">Log call</button><button type="button" class="'+BTN_S+'" id="ms-cancel" hidden>Cancel edit</button><button type="button" class="sl-link-button" id="ms-del" hidden>Delete this call</button></div>'+
    '<p class="ms-msg" id="ms-msg" role="status" aria-live="polite"></p></section>'+
   '<section class="sl-gate-phase" aria-labelledby="ms-h3" data-ms-i="3"><div class="sl-gate-phase-head"><span class="sl-gate-node tabular text-sm font-semibold text-muted" aria-hidden="true">3</span><h2 id="ms-h3" ><span id="ms-listname">Today</span></h2><p class="sl-gate-tally tabular ml-auto text-sm font-semibold text-muted" id="ms-t3">0 calls</p></div>'+
    '<div class="mb-3 flex flex-wrap items-center gap-3"><input class="ms-input ms-search" id="ms-search" type="text" inputmode="numeric" placeholder="Search by account number, all days" aria-label="Search by account number"><span class="text-sm text-muted" id="ms-searchnote"></span></div>'+
    '<div class="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]"><div class="scrollable-x" tabindex="0" role="region" aria-label="Calls table"><table class="w-full border-collapse text-sm" id="ms-tbl"><thead><tr><th '+TH+'>Time</th><th '+TH+'>Type</th><th '+TH+'>Account</th><th '+TH+'>Issue</th><th '+TH+'>Happy</th><th '+TH+'>GSR</th><th '+TH+'>XM</th><th '+TH+'>Note</th></tr></thead><tbody id="ms-rows"></tbody></table><p class="ms-empty" id="ms-empty" hidden>No calls logged yet today. The first one goes here.</p></div></div>'+
    '<p class="mt-2 text-sm text-muted">Tap a row to open it again.</p></section>'+
   '<section class="sl-gate-final" aria-labelledby="ms-h4" data-ms-i="4"><h2 id="ms-h4" class="sl-gate-h">End of shift</h2><p class="mt-2 max-w-prose text-sm leading-relaxed text-body">One line for your team leader. Nothing leaves this browser unless you copy or download it.</p><p class="tabular mt-3 max-w-prose text-sm font-semibold text-ink" id="ms-summary"></p>'+
    '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"><button type="button" class="'+BTN_S+'" id="ms-copy">Copy summary</button><button type="button" class="'+BTN_S+'" id="ms-csv">Download CSV</button><button type="button" class="sl-link-button" id="ms-clear">Clear calls older than 30 days</button></div>'+
    '<p class="ms-note-p">Account numbers are kept so you can find a follow-up. They are on this computer only; clear them when you no longer need them.</p></section>'+
  '</div>'+
  '<nav class="sl-gate-rail" data-sl-sticky="strip" aria-label="Your shift so far" data-ms-i="5"><div class="sl-gate-rail-panel rounded-[var(--radius-card)] border border-line bg-surface p-4"><p class="sl-gate-rail-count tabular text-sm font-semibold text-ink" id="ms-railcount">Nothing logged yet</p><dl class="ms-dl" id="ms-dl"></dl><div class="ms-reasons" id="ms-reasons" hidden></div><p class="mt-3 text-xs text-muted" id="ms-railnote">Counts come from the calls you log today.</p></div></nav>'+
  '</div></div>';
  // events
  root.querySelectorAll(".sl-chips[data-field]").forEach(function(g){ g.addEventListener("click",function(e){ var b=e.target.closest("button.sl-chip"); if(!b||b.closest(".sl-chips[data-field]")!==g) return; var f=g.getAttribute("data-field"); form[f]=(form[f]===b.getAttribute("data-v"))?null:b.getAttribute("data-v"); syncForm(); }); });
  q("ms-acct").addEventListener("input",function(){ var v=this.value.replace(/\D/g,""); if(v!==this.value) this.value=v; this.classList.remove("err"); });
  q("ms-save").addEventListener("click",saveCall); q("ms-cancel").addEventListener("click",function(){ resetForm(); setMsg(""); renderList(); });
  q("ms-del").addEventListener("click",function(){ if(!editId) return; if(this.textContent!=="Really delete?"){ this.textContent="Really delete?"; return; } st.calls=st.calls.filter(function(c){ return c.id!==editId; }); save(); resetForm(); setMsg("Call deleted.",true); tick=true; renderList(); renderBar(); tick=false; });
  root.querySelector("#ms-rows").addEventListener("click",function(e){ var tr=e.target.closest("tr.ms-row"); if(tr) editCall(tr.getAttribute("data-id")); });
  root.querySelector("#ms-rows").addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ var tr=e.target.closest("tr.ms-row"); if(tr){ e.preventDefault(); editCall(tr.getAttribute("data-id")); } } });
  q("ms-search").addEventListener("input",renderList);
  q("ms-copy").addEventListener("click",function(){ var t=summaryText(), self=this, done=function(){ self.textContent="Copied"; setTimeout(function(){ self.textContent="Copy summary"; },1500); }; if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done,function(){ fallbackCopy(t); done(); }); else { fallbackCopy(t); done(); } });
  q("ms-csv").addEventListener("click",function(){ var blob=new Blob([csvText()],{type:"text/csv"}); var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="my-shift-"+dkey(Date.now())+".csv"; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500); });
  q("ms-clear").addEventListener("click",function(){ var cut=Date.now()-30*86400000, n=st.calls.filter(function(c){ return c.ts<cut; }).length, self=this, reset=function(t){ setTimeout(function(){ self.textContent="Clear calls older than 30 days"; },t); };
    if(!n){ self.textContent="Nothing older than 30 days"; reset(1500); return; } if(self.textContent.indexOf("Really")!==0){ self.textContent="Really clear "+n+"?"; reset(4000); return; } st.calls=st.calls.filter(function(c){ return c.ts>=cut; }); save(); self.textContent="Cleared"; reset(1500); renderList(); });
  q("ms-date").textContent=todayStr();
  resetForm();
}
function fallbackCopy(t){ var ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); }catch(e){} document.body.removeChild(ta); }

/* ---------- timer ---------- */
function breakMs(sh,now){ var t=0; (sh.breaks||[]).forEach(function(b){ t+=(b.end||now)-b.start; }); return t; }
function elapsed(sh,now){ var end=sh.endedAt||now; return end-sh.startedAt-breakMs(sh,end); }
function onBreak(sh){ var b=sh.breaks&&sh.breaks[sh.breaks.length-1]; return !!(b&&!b.end); }
function mk(cls,label,fn){ var b=document.createElement("button"); b.type="button"; b.className=cls; b.textContent=label; b.addEventListener("click",fn); return b; }
function setRing(p){ p=Math.max(0,Math.min(1,p)); q("ms-fg").setAttribute("stroke-dashoffset",(88*(1-p)).toFixed(1)); }
/* Motion, in the Academy's own vocabulary: a ring pulse on the timer, a tick on changed counts, the station's parts arriving in order. */
function pulse(el){ if(!el) return; el.removeAttribute("data-pulse"); void el.offsetWidth; el.setAttribute("data-pulse",""); setTimeout(function(){ el.removeAttribute("data-pulse"); },800); }
function retick(el){ if(!el) return; el.removeAttribute("data-tick"); void el.offsetWidth; el.setAttribute("data-tick",""); }
function arrive(){ root.classList.remove("ms-opening"); void root.offsetWidth; root.classList.add("ms-opening"); clearTimeout(arriveT); arriveT=setTimeout(function(){ root.classList.remove("ms-opening"); },1300); }
function renderBar(){
  if(!root) return; var sh=st.shift, now=Date.now(), bar=q("ms-bar"), btns=q("ms-btns"), stats=q("ms-stats"), n1=q("ms-n1");
  btns.innerHTML=""; stats.hidden=true; q("ms-sep").hidden=true; n1.className="sl-gate-node tabular text-sm font-semibold text-muted";
  if(!sh){ bar.setAttribute("data-state","idle"); q("ms-clock").textContent="0:00:00"; q("ms-note").textContent="Click Start shift when you sit down."; q("ms-t1").textContent="not started"; setRing(0); btns.appendChild(mk(BTN_P,"Start shift",startShift)); return; }
  if(sh.endedAt){ bar.setAttribute("data-state","done"); q("ms-clock").textContent=dur(elapsed(sh,now)); setRing(1); n1.setAttribute("data-complete","true");
    q("ms-note").textContent="Shift complete · "+hm(sh.startedAt)+" to "+hm(sh.endedAt)+" · breaks "+durShort(breakMs(sh,sh.endedAt)); q("ms-t1").textContent="complete"; btns.appendChild(mk(BTN_S,"Start a new shift",startShift)); return; }
  var e=elapsed(sh,now); q("ms-clock").textContent=dur(e); setRing(e/(PLANNED_H*3600000));
  if(onBreak(sh)){ bar.setAttribute("data-state","paused"); q("ms-note").textContent="On break since "+hm(sh.breaks[sh.breaks.length-1].start)+" · started "+hm(sh.startedAt); q("ms-t1").textContent="on break"; btns.appendChild(mk(BTN_P,"Back from break",endBreak)); }
  else { bar.setAttribute("data-state","run"); q("ms-note").textContent="Started "+hm(sh.startedAt)+" · ends about "+hm(sh.startedAt+PLANNED_H*3600000+breakMs(sh,now)); q("ms-t1").textContent="running"; btns.appendChild(mk(BTN_S,"Break",startBreak)); }
  btns.appendChild(mk(BTN_S,"End shift",endShift));
  var c=counts(todayCalls()), T=tick?" data-tick":""; stats.innerHTML="<span"+T+"><b>"+c.n+"</b> call"+(c.n===1?"":"s")+"</span><span"+T+">XM <b>"+c.xmO+" / "+c.xmG+"</b></span><span"+T+">GSR <b>"+c.gO+" / "+c.gG+"</b></span><span"+T+"><b>"+c.fu+"</b> follow-up"+(c.fu===1?"":"s")+"</span>"; stats.hidden=false; q("ms-sep").hidden=false;
}
function ring(){ return root.querySelector(".ms-ring"); }
function startShift(){ st.shift={id:"s"+Date.now(),startedAt:Date.now(),breaks:[],endedAt:null}; save(); renderBar(); renderRail(); pulse(ring()); }
function startBreak(){ st.shift.breaks.push({start:Date.now(),end:null}); save(); renderBar(); }
function endBreak(){ var b=st.shift.breaks[st.shift.breaks.length-1]; if(b&&!b.end) b.end=Date.now(); save(); renderBar(); pulse(ring()); }
function endShift(){ var sh=st.shift; if(onBreak(sh)) endBreak(); sh.endedAt=Date.now(); st.history.push({id:sh.id,date:dkey(sh.startedAt),startedAt:sh.startedAt,endedAt:sh.endedAt,breakMs:breakMs(sh,sh.endedAt),summary:summaryText()}); save(); renderBar(); renderList(); pulse(ring()); }

/* ---------- form ---------- */
var FIELDS=["callType","resolved","satisfied","gsrOffered","gsrNotWhy","gsrResult","gsrWhich","gsrWhy","xmOffered","xmNotWhy","xmResult","xmWhy"];
function group(f){ return root.querySelector('.sl-chips[data-field="'+f+'"]'); }
function syncForm(){
  var gOn=form.gsrOffered==="yes", gOff=form.gsrOffered==="no", xOn=form.xmOffered==="yes", xOff=form.xmOffered==="no";
  var gNo=gOn&&(form.gsrResult==="declined"||form.gsrResult==="followup"), xNo=xOn&&(form.xmResult==="declined"||form.xmResult==="followup");
  if(!gOn){ form.gsrResult=null; form.gsrWhich=null; form.gsrWhy=null; } if(!gOff) form.gsrNotWhy=null; if(gOn&&form.gsrResult!=="completed") form.gsrWhich=null; if(!gNo) form.gsrWhy=null;
  if(!xOn){ form.xmResult=null; form.xmWhy=null; } if(!xOff) form.xmNotWhy=null; if(!xNo) form.xmWhy=null;
  FIELDS.forEach(function(f){ group(f).querySelectorAll("button.sl-chip").forEach(function(b){ b.setAttribute("aria-pressed", form[f]===b.getAttribute("data-v")?"true":"false"); }); });
  q("ms-w-gsrNotWhy").classList.toggle("ms-hide",!gOff); group("gsrResult").classList.toggle("ms-hide",!gOn); group("gsrWhich").classList.toggle("ms-hide",!(gOn&&form.gsrResult==="completed")); q("ms-w-gsrWhy").classList.toggle("ms-hide",!gNo);
  q("ms-w-xmNotWhy").classList.toggle("ms-hide",!xOff); group("xmResult").classList.toggle("ms-hide",!xOn); q("ms-w-xmWhy").classList.toggle("ms-hide",!xNo);
  q("ms-l-gsrWhy").firstChild.textContent=form.gsrResult==="followup"?"Why not today? ":"Why did the customer decline? "; q("ms-l-xmWhy").firstChild.textContent=form.xmResult==="followup"?"Why not today? ":"Why did the customer decline? ";
}
function resetForm(){ form={}; editId=null; q("ms-acct").value=""; q("ms-notein").value=""; q("ms-acct").classList.remove("err"); syncForm(); q("ms-save").textContent="Log call"; q("ms-cancel").hidden=true; q("ms-del").hidden=true; q("ms-del").textContent="Delete this call"; q("ms-t2").textContent="under a minute"; }
function validate(){ var a=q("ms-acct").value.replace(/\D/g,""), miss=[];
  if(a.length<6){ q("ms-acct").classList.add("err"); miss.push("the account number"); }
  if(!form.callType) miss.push("the call type");
  if(!form.resolved) miss.push("whether the issue was resolved"); if(!form.satisfied) miss.push("whether the customer was satisfied");
  if(!form.gsrOffered) miss.push("whether GSR was offered"); else if(form.gsrOffered==="no"&&!form.gsrNotWhy) miss.push("why GSR was not offered"); else if(form.gsrOffered==="yes"&&!form.gsrResult) miss.push("the GSR result"); else if(form.gsrResult==="completed"&&!form.gsrWhich) miss.push("which GSR"); else if((form.gsrResult==="declined"||form.gsrResult==="followup")&&!form.gsrWhy) miss.push("why GSR was "+(form.gsrResult==="declined"?"declined":"not closed today"));
  if(!form.xmOffered) miss.push("whether XM was offered"); else if(form.xmOffered==="no"&&!form.xmNotWhy) miss.push("why XM was not offered"); else if(form.xmOffered==="yes"&&!form.xmResult) miss.push("the XM result"); else if((form.xmResult==="declined"||form.xmResult==="followup")&&!form.xmWhy) miss.push("why XM was "+(form.xmResult==="declined"?"declined":"not closed today"));
  return miss; }
function saveCall(){ var miss=validate(); if(miss.length){ setMsg("Still needed: "+miss.join(", ")+"."); return; }
  var rec={account:q("ms-acct").value.replace(/\D/g,""),note:q("ms-notein").value.trim()}; FIELDS.forEach(function(f){ rec[f]=form[f]||null; });
  if(editId){ var i=st.calls.findIndex(function(c){ return c.id===editId; }); if(i>=0){ rec.id=editId; rec.ts=st.calls[i].ts; rec.edited=Date.now(); rec.shiftId=st.calls[i].shiftId; st.calls[i]=rec; } newId=editId; setMsg("Call updated.",true); }
  else { rec.id="c"+Date.now(); rec.ts=Date.now(); rec.shiftId=st.shift?st.shift.id:null; st.calls.push(rec); newId=rec.id; setMsg("Logged at "+hm(rec.ts)+".",true); }
  save(); resetForm(); tick=true; renderList(); renderBar(); tick=false; }
function setMsg(t,ok){ var m=q("ms-msg"); m.innerHTML=(ok&&t?SEAL:"")+esc(t); m.className="ms-msg"+(ok?" ok":""); }
function editCall(id){ var c=st.calls.find(function(x){ return x.id===id; }); if(!c) return; editId=id; form={}; FIELDS.forEach(function(f){ form[f]=c[f]||null; }); q("ms-acct").value=c.account; q("ms-notein").value=c.note||""; syncForm();
  q("ms-save").textContent="Update call"; q("ms-cancel").hidden=false; q("ms-del").hidden=false; q("ms-del").textContent="Delete this call"; q("ms-t2").textContent="editing "+hm(c.ts); setMsg(""); renderList(); root.querySelector("#ms-h2").scrollIntoView({block:"start",behavior:"smooth"}); }

/* ---------- list, counts, summary ---------- */
function todayCalls(){ var k=dkey(Date.now()); return st.calls.filter(function(c){ return dkey(c.ts)===k; }).sort(function(a,b){ return b.ts-a.ts; }); }
function bump(o,k){ if(k) o[k]=(o[k]||0)+1; }
function counts(list){ var c={n:list.length,res:0,sat:0,gO:0,gG:0,xmO:0,xmG:0,fu:0,types:{},gNot:{},xNot:{},gWhy:{},xWhy:{},which:{}};
  list.forEach(function(x){ bump(c.types,x.callType); if(x.resolved==="resolved") c.res++; if(x.satisfied==="yes") c.sat++;
    if(x.gsrOffered==="yes") c.gO++; else bump(c.gNot,x.gsrNotWhy); if(x.gsrResult==="completed"){ c.gG++; bump(c.which,x.gsrWhich); } if(x.gsrResult==="declined"||x.gsrResult==="followup") bump(c.gWhy,x.gsrWhy);
    if(x.xmOffered==="yes") c.xmO++; else bump(c.xNot,x.xmNotWhy); if(x.xmResult==="completed") c.xmG++; if(x.xmResult==="declined"||x.xmResult==="followup") bump(c.xWhy,x.xmWhy||x.xmReason);
    if(x.gsrResult==="followup"||x.xmResult==="followup") c.fu++; });
  return c; }
function top(o,n){ return Object.keys(o).sort(function(a,b){ return o[b]-o[a]; }).slice(0,n); }
function listStr(o,n){ return top(o,n||99).map(function(k){ return k.toLowerCase()+" "+o[k]; }).join(", "); }
function tag(cls,t){ return '<span class="ms-tag '+cls+'">'+esc(t)+'</span>'; }
function why(r){ return r?" · "+r.toLowerCase():""; }
function gsrTag(c){ if(c.gsrOffered!=="yes") return tag("","Not offered"+why(c.gsrNotWhy)); if(c.gsrResult==="completed") return tag("ok","Got"+(c.gsrWhich?" · "+c.gsrWhich:"")); if(c.gsrResult==="followup") return tag("fu","Follow-up"+why(c.gsrWhy)); return tag("no","Declined"+why(c.gsrWhy)); }
function xmTag(c){ if(c.xmOffered!=="yes") return tag("","Not offered"+why(c.xmNotWhy)); if(c.xmResult==="completed") return tag("ok","Got"); var r=why(c.xmWhy||c.xmReason); if(c.xmResult==="followup") return tag("fu","Follow-up"+r); return tag("no","Declined"+r); }
function renderList(){
  if(!root) return; var qv=q("ms-search").value.replace(/\D/g,""), list, name;
  if(qv){ list=st.calls.filter(function(c){ return c.account.indexOf(qv)>=0; }).sort(function(a,b){ return b.ts-a.ts; }); name="Matches for "+qv; q("ms-searchnote").textContent=list.length+" found, all days"; } else { list=todayCalls(); name="Today"; q("ms-searchnote").textContent=""; }
  q("ms-listname").textContent=name; q("ms-t3").textContent=list.length+" call"+(list.length===1?"":"s");
  q("ms-rows").innerHTML=list.map(function(c){ var when=qv?new Date(c.ts).toLocaleDateString(undefined,{day:"numeric",month:"short"})+" "+hm(c.ts):hm(c.ts);
    return '<tr class="ms-row" data-id="'+c.id+'" tabindex="0"'+(c.id===editId?' data-editing=""':'')+(c.id===newId?' data-new=""':'')+'><td class="ms-td">'+when+'</td><td class="ms-td">'+esc(c.callType||"")+'</td><td class="ms-td">'+fmtAcct(c.account)+'</td><td class="ms-td">'+(c.resolved==="resolved"?tag("ok","Resolved"):c.resolved==="escalated"?tag("fu","Escalated"):tag("no","Not resolved"))+'</td><td class="ms-td">'+(c.satisfied==="yes"?tag("ok","Yes"):tag("no","No"))+'</td><td class="ms-td">'+gsrTag(c)+'</td><td class="ms-td">'+xmTag(c)+'</td><td class="ms-td note">'+esc(c.note)+'</td></tr>'; }).join("");
  q("ms-empty").hidden=list.length>0||!!qv; q("ms-tbl").hidden=list.length===0; newId=null;
  var sum=summaryText(), sEl=q("ms-summary"); if(sEl.textContent!==sum){ sEl.textContent=sum; if(tick) retick(sEl); } renderRail();
}
function renderRail(){ var c=counts(todayCalls()), rc=q("ms-railcount"), rcT=c.n?c.n+" call"+(c.n===1?"":"s")+" today":"Nothing logged yet today"; if(rc.textContent!==rcT){ rc.textContent=rcT; if(tick) retick(rc); }
  var rows=[["Resolved",c.res],["Satisfied",c.sat],["GSR offered / got",c.gO+" / "+c.gG],["XM offered / got",c.xmO+" / "+c.xmG],["Follow-ups",c.fu]];
  q("ms-dl").innerHTML=rows.map(function(r){ var v=String(r[1]), moved=tick&&lastRail[r[0]]!==undefined&&lastRail[r[0]]!==v; lastRail[r[0]]=v; return "<dt>"+r[0]+"</dt><dd"+(moved?" data-tick":"")+">"+v+"</dd>"; }).join("");
  var notAll={}; Object.keys(c.gNot).forEach(function(k){ notAll[k]=(notAll[k]||0)+c.gNot[k]; }); Object.keys(c.xNot).forEach(function(k){ notAll[k]=(notAll[k]||0)+c.xNot[k]; });
  var noAll={}; Object.keys(c.gWhy).forEach(function(k){ noAll[k]=(noAll[k]||0)+c.gWhy[k]; }); Object.keys(c.xWhy).forEach(function(k){ noAll[k]=(noAll[k]||0)+c.xWhy[k]; });
  var r=q("ms-reasons"); r.innerHTML=(Object.keys(notAll).length?'<p class="ms-rh">Not offered, top reasons</p><p>'+esc(listStr(notAll,3))+'</p>':'')+(Object.keys(noAll).length?'<p class="ms-rh">Customer said no, top reasons</p><p>'+esc(listStr(noAll,3))+'</p>':''); r.hidden=!r.innerHTML;
  var sh=st.shift; q("ms-railnote").textContent=sh&&!sh.endedAt?"Shift started "+hm(sh.startedAt)+". Counts come from the calls you log today.":"Counts come from the calls you log today."; }
function summaryText(){ var c=counts(todayCalls()); var sh=st.shift&&dkey(st.shift.startedAt)===dkey(Date.now())?st.shift:null;
  var parts=[todayStr()+(sh?" · "+durShort(elapsed(sh,Date.now())):""), c.n+" call"+(c.n===1?"":"s")+(Object.keys(c.types).length?" ("+listStr(c.types)+")":""), c.res+" resolved", c.sat+" satisfied",
    "GSR not offered "+(c.n-c.gO)+(Object.keys(c.gNot).length?" ("+listStr(c.gNot)+")":"")+", offered "+c.gO+", got "+c.gG+(Object.keys(c.which).length?" ("+listStr(c.which)+")":"")+(Object.keys(c.gWhy).length?", no's: "+listStr(c.gWhy):""),
    "XM not offered "+(c.n-c.xmO)+(Object.keys(c.xNot).length?" ("+listStr(c.xNot)+")":"")+", offered "+c.xmO+", got "+c.xmG+(Object.keys(c.xWhy).length?", no's: "+listStr(c.xWhy):""), "follow-ups "+c.fu];
  return parts.join(" · "); }
function csvText(){ var head=["date","time","account","call_type","issue","satisfied","gsr_offered","gsr_not_offered_why","gsr_result","gsr_which","gsr_why","xm_offered","xm_not_offered_why","xm_result","xm_why","what_happened"];
  var rows=st.calls.slice().sort(function(a,b){ return a.ts-b.ts; }).map(function(c){ return [dkey(c.ts),hm(c.ts),c.account,c.callType||"",c.resolved,c.satisfied,c.gsrOffered,c.gsrNotWhy||"",c.gsrResult||"",c.gsrWhich||"",c.gsrWhy||"",c.xmOffered,c.xmNotWhy||"",c.xmResult||"",c.xmWhy||c.xmReason||"",c.note||""]; });
  return [head].concat(rows).map(function(r){ return r.map(function(v){ v=String(v==null?"":v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(","); }).join("\r\n"); }

/* ---------- station: nav + route ---------- */
function ensureNav(){ document.querySelectorAll("ol.sl-route").forEach(function(ol){ var li=ol.querySelector('[data-extra="my-shift"]');
  if(!li){ var last=ol.lastElementChild; if(!last||!last.querySelector("a")) return; li=last.cloneNode(true); li.setAttribute("data-extra","my-shift"); var a0=li.querySelector("a"); a0.setAttribute("href",ROUTE); a0.textContent=LABEL; a0.removeAttribute("data-testid"); ol.appendChild(li);
    a0.addEventListener("click",function(){ setTimeout(function(){ var c=document.querySelector('#academy-navigation-sheet button[aria-label="Close navigation"]'); if(c) c.click(); },0); }); }
  var a=li.querySelector("a"); if(onRoute()){ li.setAttribute("data-current","true"); a.setAttribute("aria-current","page"); } else { li.removeAttribute("data-current"); a.removeAttribute("aria-current"); } }); }
function mount(){ if(!root) build(); document.documentElement.classList.add("my-shift-on"); var fresh=!root.parentNode||root.hidden;
  if(!root.parentNode){ var app=document.querySelector("main#main"); if(app&&app.parentNode) app.parentNode.insertBefore(root, app.nextSibling); else (document.getElementById("root")||document.body).appendChild(root); }
  root.hidden=false; renderBar(); renderList(); document.title=TITLE; if(fresh) arrive(); if(!timer) timer=setInterval(function(){ if(root&&!root.hidden&&st.shift&&!st.shift.endedAt) renderBar(); },1000); }
function unmount(){ document.documentElement.classList.remove("my-shift-on"); if(root) root.hidden=true; }
function sync(){ ensureNav(); if(!onRoute()){ unmount(); return; } var app=document.querySelector("main#main"); if(!app&&tries<20){ tries++; setTimeout(sync,50); return; } tries=0; mount(); }
/* The Academy wraps each route change in a view transition (desktop, motion allowed). Mounting inside that same callback lets this station fade and slide with the rest; otherwise the hashchange fallback mounts it directly. */
function expectTransition(){ try{ return typeof document.startViewTransition==="function"&&!document.hidden&&window.innerWidth>=768&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
(function(){ var list=window.__cfRouteSyncs=window.__cfRouteSyncs||[]; list.push(function(){ tries=0; sync(); });
  if(typeof document.startViewTransition==="function"&&!document.startViewTransition.__cf){ var orig=document.startViewTransition;
    var wrapped=function(arg){ var obj=!!(arg&&typeof arg==="object"), cb=obj?arg.update:arg; var run=function(){ var r=typeof cb==="function"?cb():undefined; list.forEach(function(f){ try{ f(); }catch(e){} }); return r; }; return orig.call(document, obj?Object.assign({},arg,{update:run}):run); };
    wrapped.__cf=true; document.startViewTransition=wrapped; } })();
window.addEventListener("hashchange",function(){ tries=0; setTimeout(sync, expectTransition()?500:0); });
try{ new MutationObserver(function(){ ensureNav(); }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
try{ new MutationObserver(function(){ if(onRoute()&&document.title!==TITLE) document.title=TITLE; }).observe(document.head,{childList:true,subtree:true,characterData:true}); }catch(e){}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){ setTimeout(sync,0); }); else setTimeout(sync,0);
window.MyShift={state:function(){ return st; },csv:csvText,summary:summaryText};
})();
