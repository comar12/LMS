/* My Shift: shift timer and call log as an Academy station at #/academy/my-shift, and a team board for leaders at #/academy/my-shift/team-board. Built from the Academy's own components. The call log is saved only in this browser; the board reads the files a leader adds, in this browser only, and keeps nothing. */
(function(){
"use strict";
var ROUTE="#/academy/my-shift", BOARD=ROUTE+"/team-board", LABEL="My Shift", KEY="coachflow.myshift.v1", PLANNED_H=8, DAY=86400000, REPEAT_DAYS=7, SAME_CONTACT=30*60000;
var TITLES={shift:"My Shift · CoachFlow Academy",board:"Team board · My Shift · CoachFlow Academy"};
var OFFLINE=window.CF_STANDALONE||null, LIVE=OFFLINE&&OFFLINE.live||"";
var BTN_P="inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 aura-brand text-brand-contrast min-h-11 rounded-[var(--radius-control-md)] px-4 py-2.5 text-sm";
var BTN_S="inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 aura-control text-ink min-h-11 rounded-[var(--radius-control-md)] px-4 py-2.5 text-sm";
var TH='class="ms-th border-b border-line-strong px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted"';
var NODE="sl-gate-node tabular text-sm font-semibold text-muted", TALLY="sl-gate-tally tabular ml-auto text-sm font-semibold text-muted";
var CALL_TYPES=["Internet","TV","Mobile","Billing","Outage","Other"];
var NOT_OFFERED=["Account not eligible","Account restriction","Customer upset","Unauthorized caller","No opening","Already has it","Other"];
var GSR_WHY=["Price","Not interested","Needs to think","Partner decides","Contract","Already at top tier","Other"];
var XM_WHY=["Price","Not interested","Coverage","Contract","Needs to think","Partner decides","Happy with current carrier","Credit check","Other"];
var TRANSFER_WHY=["Wrong queue","Billing","Mobile","Advanced repair","Security team","Retention / cancel","Sales","Other"];
/* Where the Academy already practises each reason: a Scenario Lab call, or a lesson where no call fits. */
var LAB="#/academy/scenario-lab/", LESSON="#/academy/knowledge/";
var PRACTICE={
  "no:Price":[LAB+"objection-handling-acknowledge-be-curious-elevator-pitch","It's too much for what we'd use"],
  "no:Needs to think":[LAB+"si-a-call-later-to-finish-it","A call later to finish the order"],
  "no:Partner decides":[LAB+"sp-not-the-one-who-can-add-it","Not the one who can add it"],
  "no:Contract":[LAB+"sp-their-internet-our-tv","Their internet, our TV"],
  "gsr:Not interested":[LAB+"sp-loves-the-package","Loves the package"],
  "xm:Not interested":[LAB+"sp-only-called-about-the-internet","I only called about the internet"],
  "xm:Coverage":[LAB+"sp-where-it-needs-to-work","Where it needs to work"],
  "xm:Happy with current carrier":[LAB+"sp-happy-with-their-carrier","Happy where I am"],
  "xm:Credit check":[LAB+"sp-three-tries-at-the-check","Three tries at the check"],
  "not:No opening":[LAB+"relevant-or-unrelated-value-conversation","After the repair, before the offer"],
  "transfer:Billing":[LAB+"billing-which-charge-and-period","Which charge, and which period"],
  "transfer:Mobile":[LAB+"mobile-line-activation-status","Which line, which device, which order"],
  "transfer:Advanced repair":[LAB+"self-heal-expectation-setting","The tool says it will try to fix itself"],
  "transfer:Security team":[LESSON+"password-reset-and-authorised-users","Password resets and who may authorise them"],
  "repeat":[LAB+"repeat-contact-and-expectations","Third time calling about the same thing"],
  "cameback":[LAB+"confirming-the-fix-with-the-customer","The tool says done"]
};
var FIRST=["cameback","repeat","not:No opening"];
function opts(a){ return a.map(function(x){ return [x,x]; }); }
var st=load(), whoEdit=false, root=null, view=null, form={}, editId=null, tries=0, timer=null, newId=null, tick=false, lastRail={}, arriveT=null, loggedT=null;
var bd={files:[],rows:[],idx:{},period:"week",full:false,example:false,allReps:false};
var SEAL='<span class="ms-seal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
var LOOP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-2a4 4 0 0 1 4-4h12"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v2a4 4 0 0 1-4 4H4"/></svg>';
var FINE=false; try{ FINE=window.matchMedia("(hover: hover) and (pointer: fine)").matches; }catch(e){}
function load(){ try{ var s=JSON.parse(localStorage.getItem(KEY)||"null"); if(s&&s.calls){ if(typeof s.agent!=="string") s.agent=""; if(typeof s.hrId!=="string") s.hrId=""; return s; } }catch(e){} return {shift:null,calls:[],history:[],agent:"",hrId:""}; }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} }
function q(id){ return root.querySelector("#"+id); }
function pad(n){ return (n<10?"0":"")+n; }
function dkey(t){ var d=new Date(t); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function hm(t){ var d=new Date(t); return pad(d.getHours())+":"+pad(d.getMinutes()); }
function dur(ms){ ms=Math.max(0,ms); var s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60); return h+":"+pad(m)+":"+pad(s%60); }
function durShort(ms){ var m=Math.round(Math.max(0,ms)/60000); return Math.floor(m/60)+"h "+pad(m%60)+"m"; }
function fmtAcct(a){ return (a||"").replace(/(\d{4})(?=\d)/g,"$1 "); }
function mask(a){ a=a||""; return a.length>4?"•••• "+a.slice(-4):a; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function cap(s){ return s?s.charAt(0).toUpperCase()+s.slice(1):s; }
function plural(n,w,ws){ return n+" "+(n===1?w:(ws||w+"s")); }
function ordinal(n){ var s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function pct(a,b){ return b?Math.round(100*a/b)+"%":"–"; }
function todayStr(){ return new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"}); }
function shortDay(t){ return new Date(t).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"}); }
function dayName(t){ var d=new Date(t), n=new Date(), diff=Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/DAY);
  return diff===0?"today":diff===1?"yesterday":diff<7?d.toLocaleDateString(undefined,{weekday:"long"}):d.toLocaleDateString(undefined,{day:"numeric",month:"short"}); }
function hashPath(){ return location.hash.replace(/\?.*$/,"").replace(/\/$/,""); }
function routeView(){ var h=hashPath(); return h===ROUTE?"shift":h===BOARD?"board":null; }
function onRoute(){ return !!routeView(); }
function reduced(){ try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
/* A practice link opens in this tab on the live site; the offline copy opens the live Academy in a new tab. */
function href(p){ return LIVE?LIVE+p:p; }
function ext(){ return LIVE?' target="_blank" rel="noopener"':""; }
function practice(key){ var m=/^(gsr|xm):(.*)$/.exec(key||""); return PRACTICE[key]||(m&&PRACTICE["no:"+m[2]])||null; }
function scrollToEl(el){ if(!el) return; var hh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sl-header-h"))||72, y=el.getBoundingClientRect().top+window.pageYOffset-hh-16;
  try{ window.scrollTo({top:Math.max(0,y),behavior:reduced()?"auto":"smooth"}); }catch(e){ window.scrollTo(0,Math.max(0,y)); } }

/* ---------- markup, from the Academy's own parts ---------- */
function chips(field,label,opts,extra,keys){ return '<div class="sl-chips ms-chips'+(extra?" "+extra:"")+'" role="group" aria-label="'+esc(label)+'" data-field="'+field+'">'+opts.map(function(o,i){ return '<button type="button" class="sl-chip" aria-pressed="false" data-v="'+esc(o[0])+'"'+(keys?' aria-keyshortcuts="'+(i+1)+'"':'')+'>'+esc(o[1])+(keys?'<kbd class="ms-kbd" aria-hidden="true">'+(i+1)+'</kbd>':'')+'</button>'; }).join("")+'</div>'; }
function shiftMarkup(){ return '<header class="role-rail mb-6" data-ms-i="0"><div class="flex flex-wrap items-start justify-between gap-4"><div class="min-w-0 max-w-2xl"><h1 class="text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">My Shift</h1><div class="mt-1.5 text-[0.95rem] text-body">Start the timer when you sit down, write every call down in under a minute, and hand your team leader one line at the end. It all stays in this browser.</div></div><p class="tabular text-sm font-semibold text-muted" id="ms-date"></p></div><div class="ms-who" id="ms-who"></div></header>'+
  '<div class="sl-gate-layout"><div class="sl-gate-main">'+
   '<section class="sl-gate-phase" aria-labelledby="ms-h1" data-ms-i="1"><div class="sl-gate-phase-head"><span class="'+NODE+'" id="ms-n1" aria-hidden="true">1</span><h2 id="ms-h1">Your shift</h2><p class="'+TALLY+'" id="ms-t1">not started</p></div>'+
    '<div class="ms-bar" id="ms-bar" data-state="idle"><div class="ms-ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="14" fill="none" stroke-width="4"/><circle class="fg" id="ms-fg" cx="18" cy="18" r="14" fill="none" stroke-width="4" stroke-dasharray="88" stroke-dashoffset="88"/></svg></div><span class="ms-time" id="ms-clock">0:00:00</span><span class="text-sm text-body" id="ms-note"></span><span class="ms-sep" id="ms-sep" hidden></span><div class="ms-stats" id="ms-stats" hidden></div><div class="ms-right" id="ms-btns"></div></div></section>'+
   '<section class="sl-gate-phase" aria-labelledby="ms-h2" data-ms-i="2"><div class="sl-gate-phase-head"><span class="'+NODE+'" aria-hidden="true">2</span><h2 id="ms-h2">Log this call</h2><p class="'+TALLY+'" id="ms-t2">under a minute</p></div>'+
    '<div class="ms-quick"><button type="button" class="'+BTN_S+' ms-btn-sm" id="ms-same" disabled>Same as last call</button><span class="ms-keys" aria-hidden="true"><kbd>1</kbd>–<kbd>6</kbd> pick the call type · <kbd>Enter</kbd> in the account or note box logs the call</span></div>'+
    '<div class="ms-grid1 grid gap-4 sm:grid-cols-2"><div><label class="ms-lab" for="ms-acct">Account number <i>*</i></label><input class="ms-input" id="ms-acct" type="text" inputmode="numeric" autocomplete="off" placeholder="Numbers only" maxlength="24"></div>'+
     '<div class="ms-repeat" id="ms-repeat" hidden></div>'+
     '<div><span class="ms-lab">Call type <i>*</i></span>'+chips("callType","Call type",opts(CALL_TYPES),"",true)+'</div>'+
     '<div><span class="ms-lab" id="ms-l-res">Issue resolved? <i>*</i></span>'+chips("resolved","Issue resolved",[["resolved","Resolved"],["not","Not resolved"],["escalated","Escalated"],["transferred","Transferred"]])+'<div class="ms-why ms-hide" id="ms-w-transferWhy"><span class="ms-lab">Why was it transferred? <i>*</i></span>'+chips("transferWhy","Why the call was transferred",opts(TRANSFER_WHY))+'</div></div>'+
     '<div><span class="ms-lab" id="ms-l-sat">Customer satisfied? <i>*</i></span>'+chips("satisfied","Customer satisfied",[["yes","Satisfied"],["no","Not satisfied"]])+'</div></div>'+
    '<div class="grid gap-4 sm:grid-cols-2 ms-sub"><div class="sl-measure"><p class="sl-measure-kind">GSR · home upgrade <span>offered → result → why</span></p>'+chips("gsrOffered","GSR offered",[["yes","Offered"],["no","Not offered"]])+'<div class="ms-why ms-hide" id="ms-w-gsrNotWhy"><span class="ms-lab">Why was it not offered? <i>*</i></span>'+chips("gsrNotWhy","Why GSR was not offered",opts(NOT_OFFERED))+'</div>'+chips("gsrResult","GSR result",[["completed","Completed"],["declined","Declined"],["followup","Follow-up"]],"ms-hide")+chips("gsrWhich","Which GSR",[["Internet tier","Internet tier"],["TV package","TV package"],["Home add-on","Home add-on"],["Watch line","Watch line"],["Tablet line","Tablet line"]],"ms-hide")+'<div class="ms-why ms-hide" id="ms-w-gsrWhy"><span class="ms-lab" id="ms-l-gsrWhy">Why did the customer decline? <i>*</i></span>'+chips("gsrWhy","Why GSR was declined",opts(GSR_WHY))+'</div></div>'+
     '<div class="sl-measure"><p class="sl-measure-kind">XM · Xfinity Mobile <span>offered → result → why not</span></p>'+chips("xmOffered","XM offered",[["yes","Offered"],["no","Not offered"]])+'<div class="ms-why ms-hide" id="ms-w-xmNotWhy"><span class="ms-lab">Why was it not offered? <i>*</i></span>'+chips("xmNotWhy","Why XM was not offered",opts(NOT_OFFERED))+'</div>'+chips("xmResult","XM result",[["completed","Completed"],["declined","Declined"],["followup","Follow-up"]],"ms-hide")+'<div class="ms-why ms-hide" id="ms-w-xmWhy"><span class="ms-lab" id="ms-l-xmWhy">Why did the customer decline? <i>*</i></span>'+chips("xmWhy","Why XM was declined",opts(XM_WHY))+'</div></div></div>'+
    '<div class="mt-4"><label class="ms-lab" for="ms-notein">What happened, in a few words (optional)</label><input class="ms-input ms-note" id="ms-notein" type="text" placeholder="Callback time, what was quoted, what the customer said" maxlength="240"></div>'+
    '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"><button type="button" class="'+BTN_P+'" id="ms-save">Log call</button><button type="button" class="'+BTN_S+'" id="ms-cancel" hidden>Cancel edit</button><button type="button" class="sl-link-button" id="ms-del" hidden>Delete this call</button></div>'+
    '<p class="ms-msg" id="ms-msg" role="status" aria-live="polite"></p><p class="visually-hidden" id="ms-live" role="status" aria-live="polite"></p></section>'+
   '<section class="sl-gate-phase" aria-labelledby="ms-h3" data-ms-i="3"><div class="sl-gate-phase-head"><span class="'+NODE+'" aria-hidden="true">3</span><h2 id="ms-h3" ><span id="ms-listname">Today</span></h2><p class="'+TALLY+'" id="ms-t3">0 calls</p></div>'+
    '<div class="mb-3 flex flex-wrap items-center gap-3"><input class="ms-input ms-search" id="ms-search" type="text" inputmode="numeric" placeholder="Search by account number, all days" aria-label="Search by account number"><span class="text-sm text-muted" id="ms-searchnote"></span></div>'+
    '<div class="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]"><div class="scrollable-x" tabindex="0" role="region" aria-label="Calls table"><table class="w-full border-collapse text-sm" id="ms-tbl"><thead><tr><th '+TH+'>Time</th><th '+TH+'>Type</th><th '+TH+'>Account</th><th '+TH+'>Issue</th><th '+TH+'>Happy</th><th '+TH+'>GSR</th><th '+TH+'>XM</th><th '+TH+'>Note</th></tr></thead><tbody id="ms-rows"></tbody></table><p class="ms-empty" id="ms-empty" hidden>No calls logged yet today. The first one goes here.</p></div></div>'+
    '<p class="mt-2 text-sm text-muted">Tap a row to open it again.</p></section>'+
   '<section class="sl-gate-final" aria-labelledby="ms-h4" data-ms-i="4"><h2 id="ms-h4" class="sl-gate-h">End of shift</h2><p class="mt-2 max-w-prose text-sm leading-relaxed text-body">One line for your team leader. Nothing leaves this browser unless you copy or download it.</p><p class="tabular mt-3 max-w-prose text-sm font-semibold text-ink" id="ms-summary"></p>'+
    '<div class="ms-next" id="ms-next" hidden></div>'+
    '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"><button type="button" class="'+BTN_S+'" id="ms-copy">Copy summary</button><button type="button" class="'+BTN_S+'" id="ms-csv">Download CSV</button><button type="button" class="sl-link-button" id="ms-clear">Clear calls older than 30 days</button></div>'+
    '<p class="ms-note-p">Your team leader adds the CSV to the <a class="ms-inline" href="'+BOARD+'">team board</a>. Account numbers are kept so you can find a follow-up. They are on this computer only; clear them when you no longer need them.</p></section>'+
  '</div>'+
  '<nav class="sl-gate-rail" data-sl-sticky="strip" aria-label="Your shift so far" data-ms-i="5"><div class="sl-gate-rail-panel rounded-[var(--radius-card)] border border-line bg-surface p-4"><p class="sl-gate-rail-count tabular text-sm font-semibold text-ink" id="ms-railcount">Nothing logged yet</p><dl class="ms-dl" id="ms-dl"></dl><div class="ms-reasons" id="ms-reasons" hidden></div><p class="mt-3 text-xs text-muted" id="ms-railnote">Counts come from the calls you log today.</p></div></nav>'+
  '</div>'; }
function boardMarkup(){ return '<header class="role-rail mb-6" data-ms-i="0"><div class="min-w-0 max-w-2xl"><h1 class="text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">Team board</h1><div class="mt-1.5 text-[0.95rem] text-body">For team leaders. Add the CSV files your agents download from My Shift and see the team\'s offers, the reasons behind every no, repeat callers and transfers. The files are read in this browser only: nothing is uploaded, and nothing is kept once you close or reload the page.</div></div></header>'+
  '<section class="sl-gate-phase" aria-labelledby="tb-h1" data-ms-i="1"><div class="sl-gate-phase-head"><span class="'+NODE+'" aria-hidden="true">1</span><h2 id="tb-h1">Your team\'s files</h2><p class="'+TALLY+'" id="tb-t1">none yet</p></div>'+
   '<div class="tb-drop" id="tb-drop"><p class="tb-drop-h">Drop your agents\' CSV files here</p><span class="tb-drop-p">or</span><button type="button" class="'+BTN_S+'" id="tb-pick">Choose files</button><input type="file" id="tb-file" accept=".csv,text/csv" multiple hidden></div>'+
   '<p class="tb-help">Each agent opens My Shift, goes to End of shift and presses Download CSV, then sends you the file. Their name and HR ID come with it. Add the files as they arrive, without opening and saving them in a spreadsheet first. Add as many as you like: a call that appears in two files is counted once.</p>'+
   '<p class="tb-example" id="tb-clash" hidden></p><p class="tb-example" id="tb-example-note" hidden>Example data: made-up calls and HR IDs for ten agents over three days, to show how the board reads. Adding a real file clears it.</p>'+
   '<ul class="tb-files" id="tb-files"></ul><p class="ms-msg" id="tb-msg" role="status" aria-live="polite"></p>'+
   '<div class="tb-row"><button type="button" class="sl-link-button" id="tb-example">See it with example data</button><button type="button" class="sl-link-button" id="tb-clear" hidden>Clear the board</button></div></section>'+
  '<section class="sl-gate-phase" aria-labelledby="tb-h2" data-ms-i="2" data-tb-part hidden><div class="sl-gate-phase-head"><span class="'+NODE+'" aria-hidden="true">2</span><h2 id="tb-h2">The team at a glance</h2><p class="'+TALLY+'" id="tb-t2"></p></div>'+
   '<div class="sl-chips ms-chips" role="group" aria-label="Which days to count" id="tb-period"><button type="button" class="sl-chip" aria-pressed="false" data-v="latest">Latest day</button><button type="button" class="sl-chip" aria-pressed="false" data-v="week">Last 7 days</button><button type="button" class="sl-chip" aria-pressed="false" data-v="all">Every day in the files</button></div>'+
   '<div class="tb-tiles" id="tb-tiles"></div></section>'+
  '<section class="sl-gate-phase" aria-labelledby="tb-h3" data-ms-i="3" data-tb-part hidden><div class="sl-gate-phase-head"><span class="'+NODE+'" aria-hidden="true">3</span><h2 id="tb-h3">Agent by agent</h2><p class="'+TALLY+'" id="tb-t3"></p></div>'+
   '<div class="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]"><div class="scrollable-x" tabindex="0" role="region" aria-label="Agents table"><table class="w-full border-collapse text-sm"><thead><tr><th '+TH+'>Agent</th><th '+TH+'>Calls</th><th '+TH+'>GSR offered</th><th '+TH+'>GSR got</th><th '+TH+'>XM offered</th><th '+TH+'>XM got</th><th '+TH+'>Resolved</th><th '+TH+'>Came back</th><th '+TH+'>Transferred</th><th '+TH+'>Practise next</th></tr></thead><tbody id="tb-rows"></tbody><tfoot id="tb-foot"></tfoot></table></div></div>'+
   '<p class="tb-help">Came back: the customer called the team again within '+REPEAT_DAYS+' days. Practise next: the Academy call for the reason that comes up more for that agent than for the team as a whole.</p></section>'+
  '<section class="sl-gate-phase" aria-labelledby="tb-h4" data-ms-i="4" data-tb-part hidden><div class="sl-gate-phase-head"><span class="'+NODE+'" aria-hidden="true">4</span><h2 id="tb-h4">The reasons behind the numbers</h2></div>'+
   '<div class="tb-cols"><div class="tb-col"><h3>Not offered</h3><div id="tb-not"></div></div><div class="tb-col"><h3>Customer said no</h3><div id="tb-no"></div></div><div class="tb-col"><h3>Transferred</h3><div id="tb-tr"></div></div></div></section>'+
  '<section class="sl-gate-phase" aria-labelledby="tb-h5" data-ms-i="5" data-tb-part hidden><div class="sl-gate-phase-head"><span class="'+NODE+'" aria-hidden="true">5</span><h2 id="tb-h5">Repeat callers</h2><p class="'+TALLY+'" id="tb-t5"></p></div>'+
   '<p class="tb-help">The same account calling the team again within '+REPEAT_DAYS+' days. A transfer that reaches another of your agents within 30 minutes counts as one contact.</p>'+
   '<label class="tb-check"><input type="checkbox" id="tb-full"> Show full account numbers</label><ol class="tb-reps" id="tb-reps"></ol><button type="button" class="sl-link-button tb-more" id="tb-more" hidden></button></section>'+
  '<section class="sl-gate-final" aria-labelledby="tb-h6" data-ms-i="6" data-tb-part hidden><h2 id="tb-h6" class="sl-gate-h">One line for your supervisor</h2><p class="tabular mt-3 max-w-prose text-sm font-semibold text-ink" id="tb-summary"></p>'+
   '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"><button type="button" class="'+BTN_S+'" id="tb-copy">Copy team summary</button></div></section>'; }
function build(){
  root=document.createElement("main"); root.id="my-shift"; root.className="sl-main mx-auto w-full max-w-[86rem] flex-1 px-4 py-6 [overflow-wrap:anywhere] sm:px-6 sm:py-8"; root.setAttribute("aria-label",LABEL);
  root.innerHTML='<nav class="ms-tabs" aria-label="My Shift pages"><a class="ms-tab" data-view="shift" href="'+ROUTE+'">My shift</a><a class="ms-tab" data-view="board" href="'+BOARD+'">Team board</a></nav>'+
   '<div class="space-y-8" id="ms-view-shift">'+shiftMarkup()+'</div><div class="space-y-8" id="ms-view-board" hidden>'+boardMarkup()+'</div>';
  // events: the call log
  root.querySelectorAll("#ms-view-shift .sl-chips[data-field]").forEach(function(g){ g.addEventListener("click",function(e){ var b=e.target.closest("button.sl-chip"); if(!b||b.closest(".sl-chips[data-field]")!==g) return; var f=g.getAttribute("data-field"); form[f]=(form[f]===b.getAttribute("data-v"))?null:b.getAttribute("data-v"); syncForm(); }); });
  q("ms-acct").addEventListener("input",function(){ var v=this.value.replace(/\D/g,""); if(v!==this.value) this.value=v; this.classList.remove("err"); renderRepeat(); });
  q("ms-save").addEventListener("click",saveCall); q("ms-cancel").addEventListener("click",function(){ resetForm(); setMsg(""); renderList(); });
  q("ms-same").addEventListener("click",sameAsLast);
  q("ms-del").addEventListener("click",function(){ if(!editId) return; if(this.textContent!=="Really delete?"){ this.textContent="Really delete?"; return; } st.calls=st.calls.filter(function(c){ return c.id!==editId; }); save(); resetForm(); setMsg("Call deleted.",true); tick=true; renderList(); renderBar(); tick=false; });
  q("ms-repeat").addEventListener("click",function(e){ var b=e.target.closest('[data-act="show"]'); if(!b) return; q("ms-search").value=q("ms-acct").value.replace(/\D/g,""); renderList(); scrollToEl(q("ms-h3")); });
  root.querySelector("#ms-rows").addEventListener("click",function(e){ var tr=e.target.closest("tr.ms-row"); if(tr) editCall(tr.getAttribute("data-id")); });
  root.querySelector("#ms-rows").addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ var tr=e.target.closest("tr.ms-row"); if(tr){ e.preventDefault(); editCall(tr.getAttribute("data-id")); } } });
  q("ms-search").addEventListener("input",renderList);
  q("ms-who").addEventListener("click",function(e){ var b=e.target.closest("[data-who]"); if(!b) return; var a=b.getAttribute("data-who"); if(a==="save") saveWho(); else { whoEdit=a==="change"; renderWho(); if(whoEdit) q("ms-name").focus(); } });
  q("ms-who").addEventListener("keydown",function(e){ if(e.key==="Enter"&&e.target.tagName==="INPUT"){ e.preventDefault(); saveWho(); } });
  q("ms-who").addEventListener("input",function(e){ if(e.target.id==="ms-hrid"){ var v=e.target.value.replace(/\D/g,""); if(v!==e.target.value) e.target.value=v; } });
  q("ms-copy").addEventListener("click",function(){ copy(summaryText(),this,"Copy summary"); });
  q("ms-csv").addEventListener("click",function(){ if(!st.hrId){ whoEdit=true; renderWho("Add your name and HR ID first, so your team leader knows the file is yours."); scrollToEl(q("ms-who")); q("ms-name").focus(); return; }
    var name=(st.agent||"").replace(/[\\\/:*?"<>|]+/g,"").trim().replace(/\s+/g,"-").slice(0,40); download(csvText(),"my-shift-"+(name?name+"-":"")+st.hrId+"-"+dkey(Date.now())+".csv"); });
  q("ms-clear").addEventListener("click",function(){ var cut=Date.now()-30*86400000, n=st.calls.filter(function(c){ return c.ts<cut; }).length, self=this, reset=function(t){ setTimeout(function(){ self.textContent="Clear calls older than 30 days"; },t); };
    if(!n){ self.textContent="Nothing older than 30 days"; reset(1500); return; } if(self.textContent.indexOf("Really")!==0){ self.textContent="Really clear "+n+"?"; reset(4000); return; } st.calls=st.calls.filter(function(c){ return c.ts>=cut; }); save(); self.textContent="Cleared"; reset(1500); renderList(); });
  q("ms-date").textContent=todayStr(); renderWho();
  // events: the team board
  var drop=q("tb-drop"), file=q("tb-file");
  q("tb-pick").addEventListener("click",function(){ file.click(); });
  file.addEventListener("change",function(){ addFiles(file.files); file.value=""; });
  drop.addEventListener("dragover",function(e){ e.preventDefault(); drop.setAttribute("data-over",""); });
  drop.addEventListener("dragleave",function(e){ if(!drop.contains(e.relatedTarget)) drop.removeAttribute("data-over"); });
  drop.addEventListener("drop",function(e){ e.preventDefault(); drop.removeAttribute("data-over"); addFiles(e.dataTransfer&&e.dataTransfer.files); });
  q("tb-example").addEventListener("click",function(){ var was=bd.rows.length; bd.files=exampleFiles(); bd.example=true; mergeRows(); boardMsg("Example data loaded. Add your team's real files to replace it.",true); renderBoard(!was); });
  q("tb-clear").addEventListener("click",function(){ bd.files=[]; bd.example=false; mergeRows(); boardMsg(""); renderBoard(); });
  q("tb-files").addEventListener("click",function(e){ var b=e.target.closest("[data-remove]"); if(!b) return; bd.files.splice(+b.getAttribute("data-remove"),1); if(!bd.files.length) bd.example=false; mergeRows(); renderBoard(); });
  q("tb-files").addEventListener("change",function(e){ var i=e.target.getAttribute("data-file"); if(i===null) return; var k=e.target.getAttribute("data-k"), v=k==="hrId"?e.target.value.replace(/\D/g,""):e.target.value.trim(); if(v||k==="hrId"){ bd.files[+i][k]=v; e.target.value=v; mergeRows(); renderBoard(); } else e.target.value=bd.files[+i].agent; });
  q("tb-period").addEventListener("click",function(e){ var b=e.target.closest("button.sl-chip"); if(!b||b.getAttribute("data-v")===bd.period) return; bd.period=b.getAttribute("data-v"); tick=true; renderBoard(); tick=false; });
  q("tb-full").addEventListener("change",function(){ bd.full=this.checked; renderBoard(); });
  q("tb-more").addEventListener("click",function(){ bd.allReps=!bd.allReps; renderBoard(); });
  q("tb-copy").addEventListener("click",function(){ copy(boardSummary(),this,"Copy team summary"); });
  resetForm();
}
/* Who is logging: a name and an HR ID, asked once and remembered. Each call is stamped with the HR ID, so if someone else uses this computer, each person's summary and file hold only their own calls. */
function renderWho(msg){ var w=q("ms-who"), set=!!st.hrId;
  if(set&&!whoEdit){ w.setAttribute("data-state","set"); w.innerHTML='<p>Logging as <b>'+esc(st.agent)+'</b> · HR ID <b class="tabular">'+esc(st.hrId)+'</b></p><button type="button" class="sl-link-button" data-who="change">Not you? Change</button>'; return; }
  w.setAttribute("data-state","edit");
  w.innerHTML='<p class="ms-who-h">'+(set?"Who is logging on this computer?":"Before your first call: who are you?")+'</p><div class="ms-who-row"><div><label class="ms-lab" for="ms-name">Your name <i>*</i></label><input class="ms-input ms-note" id="ms-name" type="text" maxlength="40" autocomplete="off" value="'+esc(set?st.agent:"")+'"></div><div><label class="ms-lab" for="ms-hrid">HR ID <i>*</i></label><input class="ms-input" id="ms-hrid" type="text" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="Numbers only" value="'+esc(set?st.hrId:"")+'"></div><div class="ms-who-btns"><button type="button" class="'+BTN_P+'" data-who="save">Save</button>'+(set?'<button type="button" class="sl-link-button" data-who="cancel">Cancel</button>':'')+'</div></div><p class="ms-msg" id="ms-who-msg" role="status" aria-live="polite">'+esc(msg||"")+'</p><p class="ms-who-help">Asked once and remembered on this computer. Your team leader\'s board uses it to know the file is yours.</p>'; }
function saveWho(){ var n=q("ms-name").value.trim(), id=q("ms-hrid").value.replace(/\D/g,""), m=q("ms-who-msg");
  if(!n||id.length<3){ m.textContent=!n?"Add your name.":"Add your HR ID, numbers only."; (!n?q("ms-name"):q("ms-hrid")).focus(); return; }
  var old=st.hrId;
  if(!old) st.calls.forEach(function(c){ if(!c.hrId) c.hrId=id; });
  else if(old!==id&&st.shift&&!st.shift.endedAt){ endShift(); }
  st.agent=n; st.hrId=id; whoEdit=false; save();
  if(old&&old!==id){ resetForm(); setMsg(""); }
  renderWho(); renderBar(); renderList(); say("Logging as "+n+", HR ID "+id+"."); }
function copy(t,btn,label){ var done=function(){ btn.textContent="Copied"; setTimeout(function(){ btn.textContent=label; },1500); }; if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done,function(){ fallbackCopy(t); done(); }); else { fallbackCopy(t); done(); } }
function fallbackCopy(t){ var ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); }catch(e){} document.body.removeChild(ta); }
function download(text,name){ var blob=new Blob([text],{type:"text/csv"}); var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500); }

/* ---------- timer ---------- */
function breakMs(sh,now){ var t=0; (sh.breaks||[]).forEach(function(b){ t+=(b.end||now)-b.start; }); return t; }
function elapsed(sh,now){ var end=sh.endedAt||now; return end-sh.startedAt-breakMs(sh,end); }
function onBreak(sh){ var b=sh.breaks&&sh.breaks[sh.breaks.length-1]; return !!(b&&!b.end); }
function mk(cls,label,fn){ var b=document.createElement("button"); b.type="button"; b.className=cls; b.textContent=label; b.addEventListener("click",fn); return b; }
function setRing(p){ p=Math.max(0,Math.min(1,p)); q("ms-fg").setAttribute("stroke-dashoffset",(88*(1-p)).toFixed(1)); }
/* Motion, in the Academy's own vocabulary: a ring pulse on the timer, a tick on changed counts, the station's parts arriving in order. */
function pulse(el){ if(!el) return; el.removeAttribute("data-pulse"); void el.offsetWidth; el.setAttribute("data-pulse",""); setTimeout(function(){ el.removeAttribute("data-pulse"); },800); }
function retick(el){ if(!el) return; el.removeAttribute("data-tick"); void el.offsetWidth; el.setAttribute("data-tick",""); }
function arrive(){ root.classList.remove("ms-opening"); void root.offsetWidth; root.classList.add("ms-opening"); clearTimeout(arriveT); arriveT=setTimeout(function(){ root.classList.remove("ms-opening"); },1500); }
function renderBar(){
  if(!root) return; var sh=st.shift, now=Date.now(), bar=q("ms-bar"), btns=q("ms-btns"), stats=q("ms-stats"), n1=q("ms-n1");
  btns.innerHTML=""; stats.hidden=true; q("ms-sep").hidden=true; n1.className=NODE;
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
function startShift(){ st.shift={id:"s"+Date.now(),startedAt:Date.now(),breaks:[],endedAt:null,hrId:st.hrId||null}; save(); renderBar(); renderRail(); pulse(ring()); }
function startBreak(){ st.shift.breaks.push({start:Date.now(),end:null}); save(); renderBar(); }
function endBreak(){ var b=st.shift.breaks[st.shift.breaks.length-1]; if(b&&!b.end) b.end=Date.now(); save(); renderBar(); pulse(ring()); }
function endShift(){ var sh=st.shift; if(onBreak(sh)) endBreak(); sh.endedAt=Date.now(); st.history.push({id:sh.id,date:dkey(sh.startedAt),startedAt:sh.startedAt,endedAt:sh.endedAt,breakMs:breakMs(sh,sh.endedAt),summary:summaryText()}); save(); renderBar(); renderList(); pulse(ring()); }

/* ---------- form ---------- */
var FIELDS=["callType","resolved","transferWhy","satisfied","gsrOffered","gsrNotWhy","gsrResult","gsrWhich","gsrWhy","xmOffered","xmNotWhy","xmResult","xmWhy"];
function group(f){ return root.querySelector('#ms-view-shift .sl-chips[data-field="'+f+'"]'); }
function syncForm(){
  var gOn=form.gsrOffered==="yes", gOff=form.gsrOffered==="no", xOn=form.xmOffered==="yes", xOff=form.xmOffered==="no", tr=form.resolved==="transferred";
  var gNo=gOn&&(form.gsrResult==="declined"||form.gsrResult==="followup"), xNo=xOn&&(form.xmResult==="declined"||form.xmResult==="followup");
  if(!tr) form.transferWhy=null;
  if(!gOn){ form.gsrResult=null; form.gsrWhich=null; form.gsrWhy=null; } if(!gOff) form.gsrNotWhy=null; if(gOn&&form.gsrResult!=="completed") form.gsrWhich=null; if(!gNo) form.gsrWhy=null;
  if(!xOn){ form.xmResult=null; form.xmWhy=null; } if(!xOff) form.xmNotWhy=null; if(!xNo) form.xmWhy=null;
  FIELDS.forEach(function(f){ group(f).querySelectorAll("button.sl-chip").forEach(function(b){ b.setAttribute("aria-pressed", form[f]===b.getAttribute("data-v")?"true":"false"); }); });
  q("ms-w-transferWhy").classList.toggle("ms-hide",!tr);
  q("ms-w-gsrNotWhy").classList.toggle("ms-hide",!gOff); group("gsrResult").classList.toggle("ms-hide",!gOn); group("gsrWhich").classList.toggle("ms-hide",!(gOn&&form.gsrResult==="completed")); q("ms-w-gsrWhy").classList.toggle("ms-hide",!gNo);
  q("ms-w-xmNotWhy").classList.toggle("ms-hide",!xOff); group("xmResult").classList.toggle("ms-hide",!xOn); q("ms-w-xmWhy").classList.toggle("ms-hide",!xNo);
  q("ms-l-gsrWhy").firstChild.textContent=form.gsrResult==="followup"?"Why not today? ":"Why did the customer decline? "; q("ms-l-xmWhy").firstChild.textContent=form.xmResult==="followup"?"Why not today? ":"Why did the customer decline? ";
}
function resetForm(){ form={}; editId=null; q("ms-acct").value=""; q("ms-notein").value=""; q("ms-acct").classList.remove("err"); syncForm(); q("ms-save").textContent="Log call"; q("ms-cancel").hidden=true; q("ms-del").hidden=true; q("ms-del").textContent="Delete this call"; q("ms-t2").textContent="under a minute"; renderRepeat(); updateSame(); }
function validate(){ var a=q("ms-acct").value.replace(/\D/g,""), miss=[];
  if(a.length<6){ q("ms-acct").classList.add("err"); miss.push("the account number"); }
  if(!form.callType) miss.push("the call type");
  if(!form.resolved) miss.push("whether the issue was resolved"); else if(form.resolved==="transferred"&&!form.transferWhy) miss.push("why it was transferred");
  if(!form.satisfied) miss.push("whether the customer was satisfied");
  if(!form.gsrOffered) miss.push("whether GSR was offered"); else if(form.gsrOffered==="no"&&!form.gsrNotWhy) miss.push("why GSR was not offered"); else if(form.gsrOffered==="yes"&&!form.gsrResult) miss.push("the GSR result"); else if(form.gsrResult==="completed"&&!form.gsrWhich) miss.push("which GSR"); else if((form.gsrResult==="declined"||form.gsrResult==="followup")&&!form.gsrWhy) miss.push("why GSR was "+(form.gsrResult==="declined"?"declined":"not closed today"));
  if(!form.xmOffered) miss.push("whether XM was offered"); else if(form.xmOffered==="no"&&!form.xmNotWhy) miss.push("why XM was not offered"); else if(form.xmOffered==="yes"&&!form.xmResult) miss.push("the XM result"); else if((form.xmResult==="declined"||form.xmResult==="followup")&&!form.xmWhy) miss.push("why XM was "+(form.xmResult==="declined"?"declined":"not closed today"));
  return miss; }
function saveCall(){ var miss=validate(); if(miss.length){ setMsg("Still needed: "+miss.join(", ")+"."); return; }
  var rec={account:q("ms-acct").value.replace(/\D/g,""),note:q("ms-notein").value.trim()}, when; FIELDS.forEach(function(f){ rec[f]=form[f]||null; });
  if(editId){ var i=st.calls.findIndex(function(c){ return c.id===editId; }); if(i>=0){ rec.id=editId; rec.ts=st.calls[i].ts; rec.edited=Date.now(); rec.shiftId=st.calls[i].shiftId; rec.hrId=st.calls[i].hrId||null; st.calls[i]=rec; } newId=editId; setMsg("Call updated.",true); when="updated"; }
  else { rec.id="c"+Date.now(); rec.ts=Date.now(); rec.shiftId=st.shift?st.shift.id:null; rec.hrId=st.hrId||null; st.calls.push(rec); newId=rec.id; setMsg("Logged at "+hm(rec.ts)+".",true); when="logged "+hm(rec.ts); }
  save(); resetForm(); q("ms-t2").textContent=when; retick(q("ms-t2")); clearTimeout(loggedT); loggedT=setTimeout(function(){ if(!editId) q("ms-t2").textContent="under a minute"; },5000);
  tick=true; renderList(); renderBar(); tick=false; focusAcct(); }
function setMsg(t,ok){ var m=q("ms-msg"); m.innerHTML=(ok&&t?SEAL:"")+esc(t); m.className="ms-msg"+(ok?" ok":""); }
function say(t){ var l=q("ms-live"); l.textContent=""; setTimeout(function(){ l.textContent=t; },50); }
function editCall(id){ var c=st.calls.find(function(x){ return x.id===id; }); if(!c) return; editId=id; form={}; FIELDS.forEach(function(f){ form[f]=c[f]||null; }); if(!form.xmWhy&&c.xmReason) form.xmWhy=c.xmReason; q("ms-acct").value=c.account; q("ms-notein").value=c.note||""; syncForm();
  q("ms-save").textContent="Update call"; q("ms-cancel").hidden=false; q("ms-del").hidden=false; q("ms-del").textContent="Delete this call"; q("ms-t2").textContent="editing "+hm(c.ts); setMsg(""); renderRepeat(); updateSame(); renderList(); scrollToEl(q("ms-h2")); }
/* Faster logging: the last call's answers in one press, number keys for the call type, Enter to log, and the cursor back in the account box. */
function mine(){ var id=st.hrId||null; return st.calls.filter(function(c){ return (c.hrId||null)===id; }); }
function lastCall(){ var l=null; mine().forEach(function(c){ if(!l||c.ts>l.ts) l=c; }); return l; }
function updateSame(){ var b=q("ms-same"); b.disabled=!lastCall()||!!editId; b.hidden=!!editId; }
function sameAsLast(){ var c=lastCall(); if(!c||editId) return; FIELDS.forEach(function(f){ form[f]=c[f]||null; }); if(!form.xmWhy&&c.xmReason) form.xmWhy=c.xmReason; syncForm();
  setMsg("Filled in from your "+hm(c.ts)+" call. Add the account number and change anything that was different.",true); if(!q("ms-acct").value) focusAcct(true); }
function focusAcct(always){ if(!FINE&&!always) return; var a=q("ms-acct"), hh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sl-header-h"))||72, r=a.getBoundingClientRect();
  if(r.top<hh||r.bottom>window.innerHeight) scrollToEl(q("ms-h2")); try{ a.focus({preventScroll:true}); }catch(e){ a.focus(); } }
function sheetOpen(){ var s=document.getElementById("academy-navigation-sheet"); return !!(s&&s.getClientRects().length); }
document.addEventListener("keydown",function(e){
  if(!root||root.hidden||view!=="shift"||e.defaultPrevented||e.altKey||e.metaKey||e.isComposing) return;
  var t=e.target, field=t&&t.nodeType===1&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if(e.key==="Enter"){ if((t&&(t.id==="ms-acct"||t.id==="ms-notein")&&root.contains(t))||(e.ctrlKey&&(root.contains(t)||t===document.body))){ e.preventDefault(); saveCall(); } return; }
  if(e.ctrlKey||field||sheetOpen()||!/^[1-9]$/.test(e.key)) return;
  var i=+e.key-1; if(i>=CALL_TYPES.length) return; e.preventDefault(); form.callType=CALL_TYPES[i]; syncForm(); say("Call type: "+CALL_TYPES[i]);
});

/* ---------- repeat callers ---------- */
function sameContact(a,b){ return a.resolved==="transferred"&&Math.abs(b.ts-a.ts)<=SAME_CONTACT; }
function byAccount(list){ var m={}; (list||st.calls).forEach(function(c){ if(c.account) (m[c.account]=m[c.account]||[]).push(c); }); Object.keys(m).forEach(function(k){ m[k].sort(function(a,b){ return a.ts-b.ts; }); }); return m; }
function isRepeat(c,idx){ var l=idx[c.account]||[]; for(var i=0;i<l.length;i++){ var x=l[i]; if(x.id!==c.id&&x.ts<c.ts&&c.ts-x.ts<=REPEAT_DAYS*DAY&&!sameContact(x,c)) return true; } return false; }
function issueText(c){ return c.resolved==="resolved"?"resolved":c.resolved==="escalated"?"escalated":c.resolved==="transferred"?"transferred"+(c.transferWhy?" to "+c.transferWhy.toLowerCase():""):"not resolved"; }
function offerText(p,c){ var o=p==="GSR"?c.gsrOffered:c.xmOffered, r=p==="GSR"?c.gsrResult:c.xmResult, w=p==="GSR"?c.gsrWhy:(c.xmWhy||c.xmReason);
  if(o!=="yes") return p+" not offered"; if(r==="completed") return p+" got"+(p==="GSR"&&c.gsrWhich?" ("+c.gsrWhich.toLowerCase()+")":""); return p+(r==="followup"?" follow-up":" declined")+(w?", "+w.toLowerCase():""); }
/* When the account typed has called before, show what happened last time, so the agent can pick up from there instead of starting over. */
function renderRepeat(){
  var box=q("ms-repeat"), a=q("ms-acct").value.replace(/\D/g,""), cur=editId?st.calls.find(function(c){ return c.id===editId; }):null, before=cur?cur.ts:Date.now();
  var prior=a.length<6?[]:st.calls.filter(function(c){ return c.account===a&&c.id!==editId&&c.ts<before; }).sort(function(x,y){ return y.ts-x.ts; });
  if(!prior.length){ box.hidden=true; box.removeAttribute("data-key"); return; }
  var last=prior[0], n7=prior.filter(function(c){ return before-c.ts<=REPEAT_DAYS*DAY&&!sameContact(c,{ts:before}); }).length, rep=n7>0, key=a+"|"+prior.length+"|"+last.id+"|"+(editId||"");
  if(box.getAttribute("data-key")===key&&!box.hidden) return; box.setAttribute("data-key",key); box.setAttribute("data-kind",rep?"repeat":"before");
  var head=rep?"Repeat caller · "+ordinal(n7+1)+" call in "+REPEAT_DAYS+" days":"Called before · "+dayName(last.ts);
  var bits=[cap(dayName(last.ts))+" "+hm(last.ts),last.callType,issueText(last),last.satisfied==="yes"?"satisfied":"not satisfied",offerText("GSR",last),offerText("XM",last)];
  box.innerHTML='<p class="ms-repeat-h">'+LOOP+'<span>'+esc(head)+'</span></p><p><span class="ms-repeat-k">Last time:</span> '+esc(bits.filter(Boolean).join(" · "))+'</p>'+(last.note?'<p class="ms-repeat-note">“'+esc(last.note)+'”</p>':'')+
    (rep?'<p class="ms-repeat-tip">Start from what happened last time, say why if you repeat a step, and don\'t promise a time you can\'t confirm.</p>':'')+
    '<p class="ms-repeat-act"><button type="button" class="sl-link-button" data-act="show">'+(prior.length===1?"See that call in the list":"See all "+prior.length+" calls in the list")+'</button>'+(rep?'<a class="sl-coach-link" href="'+href(PRACTICE.repeat[0])+'"'+ext()+'>Practise: '+esc(PRACTICE.repeat[1])+'</a>':'')+'</p>';
  box.hidden=false; say(head+". Last time: "+bits.filter(Boolean).join(", ")+".");
}

/* ---------- list, counts, practice, summary ---------- */
function todayCalls(){ var k=dkey(Date.now()); return mine().filter(function(c){ return dkey(c.ts)===k; }).sort(function(a,b){ return b.ts-a.ts; }); }
function bump(o,k){ if(k) o[k]=(o[k]||0)+1; }
/* Counts for a list of calls. coach tallies every reason the Academy can practise: declines, no opening, transfers, and repeats (or, on the board, calls that came back). */
function counts(list,opt){ opt=opt||{}; var c={n:list.length,res:0,sat:0,gO:0,gG:0,xmO:0,xmG:0,fu:0,tr:0,rep:0,back:0,types:{},gNot:{},xNot:{},gWhy:{},xWhy:{},which:{},trWhy:{},coach:{}};
  list.forEach(function(x){ bump(c.types,x.callType); if(x.resolved==="resolved") c.res++; if(x.satisfied==="yes") c.sat++;
    if(x.resolved==="transferred"){ c.tr++; bump(c.trWhy,x.transferWhy); bump(c.coach,x.transferWhy&&"transfer:"+x.transferWhy); }
    if(opt.rep&&opt.rep(x)){ c.rep++; if(!opt.back) bump(c.coach,"repeat"); }
    if(opt.back&&opt.back(x)){ c.back++; bump(c.coach,"cameback"); }
    if(x.gsrOffered==="yes") c.gO++; else { bump(c.gNot,x.gsrNotWhy); bump(c.coach,x.gsrNotWhy&&"not:"+x.gsrNotWhy); }
    if(x.gsrResult==="completed"){ c.gG++; bump(c.which,x.gsrWhich); } if(x.gsrResult==="declined"||x.gsrResult==="followup"){ bump(c.gWhy,x.gsrWhy); bump(c.coach,x.gsrWhy&&"gsr:"+x.gsrWhy); }
    if(x.xmOffered==="yes") c.xmO++; else { bump(c.xNot,x.xmNotWhy); bump(c.coach,x.xmNotWhy&&"not:"+x.xmNotWhy); }
    if(x.xmResult==="completed") c.xmG++; if(x.xmResult==="declined"||x.xmResult==="followup"){ var w=x.xmWhy||x.xmReason; bump(c.xWhy,w); bump(c.coach,w&&"xm:"+w); }
    if(x.gsrResult==="followup"||x.xmResult==="followup") c.fu++; });
  return c; }
function myCounts(list){ var idx=byAccount(); return counts(list,{rep:function(x){ return isRepeat(x,idx); }}); }
function top(o,n){ return Object.keys(o).sort(function(a,b){ return o[b]-o[a]||a.localeCompare(b); }).slice(0,n); }
function listStr(o,n){ return top(o,n||99).map(function(k){ return k.toLowerCase()+" "+o[k]; }).join(", "); }
function merge(a,b){ var o={}; [a,b].forEach(function(s){ Object.keys(s).forEach(function(k){ o[k]=(o[k]||0)+s[k]; }); }); return o; }
/* Reasons grouped by the Academy page that practises them, so a reason that came up for both GSR and XM counts once, in full. */
function groups(t){ var g={}; Object.keys(t).forEach(function(k){ var p=practice(k), r=FIRST.indexOf(k); if(!p||!t[k]) return; var e=g[p[0]]||(g[p[0]]={href:p[0],title:p[1],n:0,key:k,kn:0,rank:99}); e.n+=t[k]; if(t[k]>e.kn){ e.kn=t[k]; e.key=k; } if(r>=0&&r<e.rank) e.rank=r; }); return g; }
function chosen(e,x){ return {key:e.key,n:e.n,href:e.href,title:e.title,lesson:e.href.indexOf(LESSON)===0,expected:x}; }
/* The practice for the reason that came up most. */
function nextPractice(t){ var g=groups(t), best=null; Object.keys(g).forEach(function(h){ var e=g[h]; if(!best||e.n>best.n||(e.n===best.n&&e.rank<best.rank)) best=e; }); return best?chosen(best):null; }
/* On the board, an agent's suggestion is the practisable reason that stands out most against the team's own rate, so each agent gets what is particular to them. */
function standOut(a,n,t,tn){ var ga=groups(a), gt=groups(t), best=null, ex=0, exp=0; Object.keys(ga).forEach(function(h){ var e=ga[h], x=tn&&gt[h]?gt[h].n*n/tn:0; if(e.n<2||e.n-x<=ex+.0001) return; ex=e.n-x; exp=x; best=e; });
  return best?chosen(best,exp):nextPractice(a); }
function practiceWhy(p,when){ var n=p.n, m=/^(gsr|xm|not|transfer):(.*)$/.exec(p.key), r=m?m[2]:"", w=when?" "+when:"";
  if(p.key==="repeat") return plural(n,"repeat caller")+w+".";
  if(p.key==="cameback") return plural(n,"call")+w+" came back within "+REPEAT_DAYS+" days.";
  if(m&&m[1]==="not") return "No opening to offer on "+plural(n,"call")+w+".";
  if(m&&m[1]==="transfer") return plural(n,"call")+" transferred to "+r.toLowerCase()+w+".";
  return "“"+r+"” was the reason for "+n+" no"+(n===1?"":"'s")+w+"."; }
function pracLink(key,label){ var p=practice(key), verb=p&&p[0].indexOf(LESSON)===0?"Read":"Practise"; return p?'<a class="ms-prac" href="'+href(p[0])+'"'+ext()+' title="'+esc(verb+": "+p[1])+'" aria-label="'+esc(verb+" for "+label+": "+p[1])+'">'+verb+'</a>':''; }
function tag(cls,t){ return '<span class="ms-tag '+cls+'">'+esc(t)+'</span>'; }
function why(r){ return r?" · "+r.toLowerCase():""; }
function issueTag(c){ return c.resolved==="resolved"?tag("ok","Resolved"):c.resolved==="escalated"?tag("fu","Escalated"):c.resolved==="transferred"?tag("","Transferred"+why(c.transferWhy)):tag("no","Not resolved"); }
function gsrTag(c){ if(c.gsrOffered!=="yes") return tag("","Not offered"+why(c.gsrNotWhy)); if(c.gsrResult==="completed") return tag("ok","Got"+(c.gsrWhich?" · "+c.gsrWhich:"")); if(c.gsrResult==="followup") return tag("fu","Follow-up"+why(c.gsrWhy)); return tag("no","Declined"+why(c.gsrWhy)); }
function xmTag(c){ if(c.xmOffered!=="yes") return tag("","Not offered"+why(c.xmNotWhy)); if(c.xmResult==="completed") return tag("ok","Got"); var r=why(c.xmWhy||c.xmReason); if(c.xmResult==="followup") return tag("fu","Follow-up"+r); return tag("no","Declined"+r); }
function renderList(){
  if(!root) return; var qv=q("ms-search").value.replace(/\D/g,""), list, name, idx=byAccount();
  if(qv){ list=mine().filter(function(c){ return c.account.indexOf(qv)>=0; }).sort(function(a,b){ return b.ts-a.ts; }); name="Matches for "+qv; q("ms-searchnote").textContent=list.length+" found, all days"; } else { list=todayCalls(); name="Today"; q("ms-searchnote").textContent=""; }
  q("ms-listname").textContent=name; q("ms-t3").textContent=list.length+" call"+(list.length===1?"":"s");
  q("ms-rows").innerHTML=list.map(function(c){ var when=qv?new Date(c.ts).toLocaleDateString(undefined,{day:"numeric",month:"short"})+" "+hm(c.ts):hm(c.ts);
    return '<tr class="ms-row" data-id="'+c.id+'" tabindex="0"'+(c.id===editId?' data-editing=""':'')+(c.id===newId?' data-new=""':'')+'><td class="ms-td">'+when+'</td><td class="ms-td">'+esc(c.callType||"")+'</td><td class="ms-td">'+fmtAcct(c.account)+(isRepeat(c,idx)?' '+tag("rep","Repeat"):'')+'</td><td class="ms-td">'+issueTag(c)+'</td><td class="ms-td">'+(c.satisfied==="yes"?tag("ok","Yes"):tag("no","No"))+'</td><td class="ms-td">'+gsrTag(c)+'</td><td class="ms-td">'+xmTag(c)+'</td><td class="ms-td note">'+esc(c.note)+'</td></tr>'; }).join("");
  q("ms-empty").hidden=list.length>0||!!qv; q("ms-tbl").hidden=list.length===0; newId=null;
  renderSummary(); renderRail(); updateSame();
}
function renderSummary(){ var sum=summaryText(), sEl=q("ms-summary"); if(sEl.textContent!==sum){ sEl.textContent=sum; if(tick) retick(sEl); } renderNext(); }
function renderNext(){ var el=q("ms-next"), p=nextPractice(myCounts(todayCalls()).coach);
  if(!p){ el.hidden=true; el.removeAttribute("data-key"); return; }
  var key=p.key+"|"+p.n; if(el.getAttribute("data-key")===key&&!el.hidden) return; el.setAttribute("data-key",key);
  el.innerHTML='<p class="ms-next-k">Practise next</p><a class="ms-next-a" href="'+href(p.href)+'"'+ext()+'>'+esc(p.title)+'</a><p class="ms-next-why">'+esc(practiceWhy(p,"today"))+' '+(p.lesson?"It is a lesson in Knowledge.":"It is a practice call in the Scenario Lab, about ten minutes.")+'</p>';
  var shown=!el.hidden; el.hidden=false; if(shown&&tick) retick(el); }
function renderRail(){ var c=myCounts(todayCalls()), rc=q("ms-railcount"), rcT=c.n?c.n+" call"+(c.n===1?"":"s")+" today":"Nothing logged yet today"; if(rc.textContent!==rcT){ rc.textContent=rcT; if(tick) retick(rc); }
  var rows=[["Resolved",c.res],["Satisfied",c.sat],["GSR offered / got",c.gO+" / "+c.gG],["XM offered / got",c.xmO+" / "+c.xmG],["Follow-ups",c.fu],["Transferred",c.tr],["Repeat callers",c.rep]];
  q("ms-dl").innerHTML=rows.map(function(r){ var v=String(r[1]), moved=tick&&lastRail[r[0]]!==undefined&&lastRail[r[0]]!==v; lastRail[r[0]]=v; return "<dt>"+r[0]+"</dt><dd"+(moved?" data-tick":"")+">"+v+"</dd>"; }).join("");
  var notAll=merge(c.gNot,c.xNot), noAll=merge(c.gWhy,c.xWhy), r=q("ms-reasons");
  r.innerHTML=reasons("Not offered, top reasons",notAll,function(k){ return "not:"+k; })+reasons("Customer said no, top reasons",noAll,function(k){ return ((c.xWhy[k]||0)>=(c.gWhy[k]||0)?"xm:":"gsr:")+k; })+reasons("Transferred to",c.trWhy,function(k){ return "transfer:"+k; });
  r.hidden=!r.innerHTML;
  var sh=st.shift; q("ms-railnote").textContent=sh&&!sh.endedAt?"Shift started "+hm(sh.startedAt)+". Counts come from the calls you log today.":"Counts come from the calls you log today."; }
function reasons(head,o,keyOf){ var ks=top(o,3); if(!ks.length) return ""; return '<p class="ms-rh">'+esc(head)+'</p><ul class="ms-rl">'+ks.map(function(k){ return '<li><span>'+esc(k)+'</span><b>'+o[k]+'</b>'+pracLink(keyOf(k),k)+'</li>'; }).join("")+'</ul>'; }
function summaryText(){ var c=myCounts(todayCalls()); var sh=st.shift&&dkey(st.shift.startedAt)===dkey(Date.now())?st.shift:null, p=nextPractice(c.coach);
  var parts=[(st.agent?st.agent+(st.hrId?" (HR ID "+st.hrId+")":"")+" · ":"")+todayStr()+(sh?" · "+durShort(elapsed(sh,Date.now())):""), c.n+" call"+(c.n===1?"":"s")+(Object.keys(c.types).length?" ("+listStr(c.types)+")":""), c.res+" resolved", c.sat+" satisfied",
    "GSR not offered "+(c.n-c.gO)+(Object.keys(c.gNot).length?" ("+listStr(c.gNot)+")":"")+", offered "+c.gO+", got "+c.gG+(Object.keys(c.which).length?" ("+listStr(c.which)+")":"")+(Object.keys(c.gWhy).length?", no's: "+listStr(c.gWhy):""),
    "XM not offered "+(c.n-c.xmO)+(Object.keys(c.xNot).length?" ("+listStr(c.xNot)+")":"")+", offered "+c.xmO+", got "+c.xmG+(Object.keys(c.xWhy).length?", no's: "+listStr(c.xWhy):""), "follow-ups "+c.fu,
    "transferred "+c.tr+(Object.keys(c.trWhy).length?" ("+listStr(c.trWhy)+")":""), "repeat callers "+c.rep];
  if(p) parts.push("next practice: "+p.title);
  return parts.join(" · "); }
function csvCell(v){ v=String(v==null?"":v); return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function csvText(){ var idx=byAccount(), head=["date","time","account","call_type","issue","satisfied","gsr_offered","gsr_not_offered_why","gsr_result","gsr_which","gsr_why","xm_offered","xm_not_offered_why","xm_result","xm_why","what_happened","transfer_reason","repeat_7d","agent","hr_id","call_id"];
  var rows=mine().sort(function(a,b){ return a.ts-b.ts; }).map(function(c){ return [dkey(c.ts),hm(c.ts),c.account,c.callType||"",c.resolved,c.satisfied,c.gsrOffered,c.gsrNotWhy||"",c.gsrResult||"",c.gsrWhich||"",c.gsrWhy||"",c.xmOffered,c.xmNotWhy||"",c.xmResult||"",c.xmWhy||c.xmReason||"",c.note||"",c.transferWhy||"",isRepeat(c,idx)?"yes":"",st.agent||"",c.hrId||st.hrId||"",c.id]; });
  return [head].concat(rows).map(function(r){ return r.map(csvCell).join(","); }).join("\r\n"); }

/* ---------- team board: reads My Shift CSV files in this browser, keeps nothing ---------- */
function boardMsg(t,ok){ var m=q("tb-msg"); m.innerHTML=(ok&&t?SEAL:"")+esc(t); m.className="ms-msg"+(ok?" ok":""); }
function parseCsv(t){ t=String(t||"").replace(/^\s+/,""); var rows=[], row=[], f="", qd=false;
  for(var i=0;i<t.length;i++){ var ch=t[i];
    if(qd){ if(ch==='"'){ if(t[i+1]==='"'){ f+='"'; i++; } else qd=false; } else f+=ch; }
    else if(ch==='"') qd=true; else if(ch===","){ row.push(f); f=""; }
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&t[i+1]==="\n") i++; row.push(f); rows.push(row); row=[]; f=""; } else f+=ch; }
  if(f!==""||row.length){ row.push(f); rows.push(row); }
  return rows.filter(function(r){ return r.length>1||r[0]!==""; }); }
function fromFile(n,i){ var m=/^my-shift-(.+?)(?:-(\d{3,12}))?-\d{4}-\d{2}-\d{2}(?: ?\(\d+\))?\.csv$/i.exec(n||""); return {agent:m&&!/^\d{4}$/.test(m[1])?m[1].replace(/[-_]+/g," "):"Agent "+(i+1),hrId:m&&m[2]||""}; }
function parseShiftCsv(text,name,i){ var rows=parseCsv(text); if(!rows.length) return null; var h=rows[0].map(function(x){ return x.trim().toLowerCase(); });
  if(["date","time","account","gsr_offered","xm_offered"].some(function(k){ return h.indexOf(k)<0; })) return null;
  var get=function(r,k){ var j=h.indexOf(k); return j<0||r[j]==null?"":String(r[j]).trim(); }, out=[], names={}, ids={}, skipped=0, damaged=0;
  rows.slice(1).forEach(function(r){ var d=get(r,"date"), tm=get(r,"time"), raw=get(r,"account"); if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!/^\d{1,2}:\d{2}$/.test(tm)){ skipped++; return; }
    var p=d.split("-"), hh=tm.split(":"), bad=/e\+/i.test(raw); if(bad) damaged++; bump(names,get(r,"agent")); bump(ids,get(r,"hr_id").replace(/\D/g,""));
    out.push({ts:new Date(+p[0],+p[1]-1,+p[2],+hh[0],+hh[1]).getTime(),date:d,account:bad?"":raw.replace(/\D/g,""),callType:get(r,"call_type"),resolved:get(r,"issue"),satisfied:get(r,"satisfied"),gsrOffered:get(r,"gsr_offered"),gsrNotWhy:get(r,"gsr_not_offered_why"),gsrResult:get(r,"gsr_result"),gsrWhich:get(r,"gsr_which"),gsrWhy:get(r,"gsr_why"),xmOffered:get(r,"xm_offered"),xmNotWhy:get(r,"xm_not_offered_why"),xmResult:get(r,"xm_result"),xmWhy:get(r,"xm_why"),transferWhy:get(r,"transfer_reason"),id:get(r,"call_id")||d+" "+tm+" "+get(r,"account")}); });
  var ff=fromFile(name,i); return {name:name,agent:top(names,1)[0]||ff.agent,hrId:top(ids,1)[0]||ff.hrId,rows:out,skipped:skipped,damaged:damaged}; }
function readFile(f){ if(f.text) return f.text().catch(function(){ return ""; }); return new Promise(function(res){ var r=new FileReader(); r.onload=function(){ res(String(r.result||"")); }; r.onerror=function(){ res(""); }; r.readAsText(f); }); }
function addFiles(list){ var fs=Array.prototype.slice.call(list||[]); if(!fs.length) return;
  Promise.all(fs.map(readFile)).then(function(texts){ var bad=[], good=[], was=bd.rows.length&&!bd.example, base=bd.example?0:bd.files.length;
    texts.forEach(function(t,i){ var r=parseShiftCsv(t,fs[i].name,base+good.length); if(r&&r.rows.length) good.push(r); else bad.push(fs[i].name); });
    if(good.length&&bd.example){ bd.files=[]; bd.example=false; }
    bd.files=bd.files.concat(good); mergeRows(); renderBoard(!was&&good.length>0);
    var calls=0, skipped=0, damaged=0; good.forEach(function(f){ calls+=f.rows.length; skipped+=f.skipped; damaged+=f.damaged; });
    var warn=(skipped?" "+plural(skipped,"row")+" left out because the date or time had been changed.":"")+(damaged?" "+plural(damaged,"account number")+" had been turned into a short form, so those calls can't be matched as repeats.":"")+(skipped||damaged?" A file opened and saved again in a spreadsheet does this; ask for the file as My Shift saved it.":"");
    boardMsg((good.length?"Added "+plural(good.length,"file")+" with "+plural(calls,"call")+".":"")+(bad.length?(good.length?" ":"")+"Not read: "+bad.join(", ")+". Only the CSV files My Shift downloads can be added.":"")+warn,!bad.length&&!warn); }); }
function agentKey(f){ return f.hrId?"id:"+f.hrId:"name:"+f.agent.toLowerCase(); }
function mergeRows(){ var seen={}, rows=[], shown={}, spelt={};
  bd.files.forEach(function(f){ var key=agentKey(f); if(!shown[key]) shown[key]=f.agent; if(f.hrId){ spelt[f.hrId]=spelt[f.hrId]||[]; if(spelt[f.hrId].indexOf(f.agent)<0) spelt[f.hrId].push(f.agent); }
    f.rows.forEach(function(r){ var k=key+"|"+r.id; if(seen[k]) return; seen[k]=1; var x=Object.assign({},r); x.key=key; x.agent=shown[key]; x.hrId=f.hrId||""; rows.push(x); }); });
  bd.clash=Object.keys(spelt).filter(function(id){ return spelt[id].length>1; }).map(function(id){ return "HR ID "+id+" is "+spelt[id].join(" in one file and ")+" in another; counted as one agent, "+spelt[id][0]+"."; });
  rows.sort(function(a,b){ return a.ts-b.ts; }); var idx=byAccount(rows);
  /* Across the whole team: was this call a repeat, and did the customer call again within the window? */
  Object.keys(idx).forEach(function(k){ var l=idx[k]; l.forEach(function(r,i){ r.rep=false; r.back=false;
    for(var j=i-1;j>=0&&r.ts-l[j].ts<=REPEAT_DAYS*DAY;j--) if(!sameContact(l[j],r)){ r.rep=true; break; }
    for(var n=i+1;n<l.length&&l[n].ts-r.ts<=REPEAT_DAYS*DAY;n++) if(!sameContact(r,l[n])){ r.back=true; break; } }); });
  bd.rows=rows; bd.idx=idx; }
function addDays(d,n){ var p=d.split("-"); return dkey(new Date(+p[0],+p[1]-1,+p[2]+n).getTime()); }
function periodRows(){ var rows=bd.rows; if(!rows.length) return []; var last=rows[rows.length-1].date, from=bd.period==="latest"?last:bd.period==="week"?addDays(last,-6):"";
  return rows.filter(function(r){ return r.date>=from; }); }
function periodLabel(list){ if(!list.length) return ""; var a=list[0].ts, b=list[list.length-1].ts; return dkey(a)===dkey(b)?shortDay(a):shortDay(a)+" to "+shortDay(b); }
function agentsOf(list){ var o={}; list.forEach(function(r){ (o[r.key]=o[r.key]||[]).push(r); }); return o; }
function boardCounts(list){ return counts(list,{rep:function(x){ return x.rep; },back:function(x){ return x.back; }}); }
function ofCell(a,b){ return '<b>'+pct(a,b)+'</b><span class="tb-of">'+a+' of '+b+'</span>'; }
function tile(k,v,s){ return '<div class="tb-tile"><p class="tb-k">'+esc(k)+'</p><p class="tb-v"'+(tick?" data-tick":"")+'>'+esc(v)+'</p><p class="tb-s">'+esc(s)+'</p></div>'; }
function bars(o,keyOf,empty){ var ks=top(o,6); if(!ks.length) return '<p class="tb-empty">'+esc(empty)+'</p>'; var max=o[ks[0]];
  return '<ol class="tb-bars">'+ks.map(function(k){ return '<li><span>'+esc(k)+'</span><b class="tabular">'+o[k]+'</b><span class="tb-bar" aria-hidden="true"><span class="tb-fill" data-w="'+Math.max(4,Math.round(100*o[k]/max))+'"></span></span>'+pracLink(keyOf(k),k)+'</li>'; }).join("")+'</ol>'; }
function renderBoard(opening){
  if(!root) return; var has=bd.rows.length>0, list=periodRows(), files=bd.files;
  var who={}; files.forEach(function(f){ who[agentKey(f)]=1; }); var cl=q("tb-clash"); cl.textContent=(bd.clash||[]).join(" "); cl.hidden=!cl.textContent; q("tb-t1").textContent=files.length?plural(Object.keys(who).length,"agent"):"none yet"; q("tb-example-note").hidden=!bd.example; q("tb-clear").hidden=!files.length; q("tb-example").hidden=files.length>0;
  var fk=files.map(function(f){ return f.name+"|"+f.agent+"|"+f.hrId+"|"+f.rows.length; }).join("/"), fl=q("tb-files"); if(fl.getAttribute("data-key")!==fk){ fl.setAttribute("data-key",fk);
  fl.innerHTML=files.map(function(f,i){ var days={}; f.rows.forEach(function(r){ days[r.date]=1; }); return '<li class="tb-file"><input class="ms-input" type="text" value="'+esc(f.agent)+'" data-file="'+i+'" data-k="agent" aria-label="Agent name for '+esc(f.name)+'" maxlength="40"><input class="ms-input tb-id" type="text" inputmode="numeric" value="'+esc(f.hrId)+'" placeholder="HR ID" data-file="'+i+'" data-k="hrId" aria-label="HR ID for '+esc(f.name)+'" maxlength="12"><span class="tb-file-m">'+esc(plural(f.rows.length,"call"))+' · '+esc(plural(Object.keys(days).length,"day"))+' · '+esc(f.name)+'</span><button type="button" class="sl-link-button" data-remove="'+i+'">Remove</button></li>'; }).join(""); }
  root.querySelectorAll("[data-tb-part]").forEach(function(s){ s.hidden=!has; });
  if(!has) return;
  q("tb-period").querySelectorAll("button.sl-chip").forEach(function(b){ b.setAttribute("aria-pressed",b.getAttribute("data-v")===bd.period?"true":"false"); });
  var c=boardCounts(list), by=agentsOf(list), names=Object.keys(by).sort(function(a,b){ return by[a][0].agent.localeCompare(by[b][0].agent)||a.localeCompare(b); }), p=nextPractice(c.coach);
  q("tb-t2").textContent=periodLabel(list); q("tb-t3").textContent=plural(names.length,"agent");
  q("tb-tiles").innerHTML=tile("Calls",String(c.n),plural(names.length,"agent")+" · "+(c.res?pct(c.res,c.n)+" resolved":"none resolved"))+tile("GSR offered",pct(c.gO,c.n),c.gO+" of "+c.n+" calls · "+c.gG+" got")+tile("XM offered",pct(c.xmO,c.n),c.xmO+" of "+c.n+" calls · "+c.xmG+" got")+
    tile("Came back in "+REPEAT_DAYS+" days",pct(c.back,c.n),plural(c.back,"call")+" · the customer called again")+tile("Transferred",pct(c.tr,c.n),plural(c.tr,"call")+(Object.keys(c.trWhy).length?" · most to "+top(c.trWhy,1)[0].toLowerCase():""))+tile("Satisfied",pct(c.sat,c.n),c.sat+" of "+c.n+" calls");
  q("tb-rows").innerHTML=names.map(function(nm){ var a=boardCounts(by[nm]), ap=standOut(a.coach,a.n,c.coach,c.n);
    var r0=by[nm][0]; return '<tr><td class="ms-td"><b>'+esc(r0.agent)+'</b><span class="tb-of">'+(r0.hrId?"HR ID "+esc(r0.hrId):"No HR ID")+'</span></td><td class="ms-td">'+a.n+'</td><td class="ms-td">'+ofCell(a.gO,a.n)+'</td><td class="ms-td">'+a.gG+'</td><td class="ms-td">'+ofCell(a.xmO,a.n)+'</td><td class="ms-td">'+a.xmG+'</td><td class="ms-td">'+ofCell(a.res,a.n)+'</td><td class="ms-td">'+ofCell(a.back,a.n)+'</td><td class="ms-td">'+ofCell(a.tr,a.n)+'</td><td class="ms-td tb-next">'+(ap?'<a class="ms-prac" href="'+href(ap.href)+'"'+ext()+'>'+esc(ap.title)+'</a><span class="tb-of">'+esc(practiceWhy(ap,"")+(ap.expected!==undefined?" About "+Math.round(ap.expected)+" at the team's rate.":""))+'</span>':'<span class="tb-of">Nothing stands out</span>')+'</td></tr>'; }).join("");
  q("tb-foot").innerHTML='<tr class="tb-total"><td class="ms-td"><b>Team</b></td><td class="ms-td">'+c.n+'</td><td class="ms-td">'+ofCell(c.gO,c.n)+'</td><td class="ms-td">'+c.gG+'</td><td class="ms-td">'+ofCell(c.xmO,c.n)+'</td><td class="ms-td">'+c.xmG+'</td><td class="ms-td">'+ofCell(c.res,c.n)+'</td><td class="ms-td">'+ofCell(c.back,c.n)+'</td><td class="ms-td">'+ofCell(c.tr,c.n)+'</td><td class="ms-td tb-next">'+(p?'<a class="ms-prac" href="'+href(p.href)+'"'+ext()+'>'+esc(p.title)+'</a>':'')+'</td></tr>';
  q("tb-not").innerHTML=bars(merge(c.gNot,c.xNot),function(k){ return "not:"+k; },"Every call had an offer.");
  q("tb-no").innerHTML=bars(merge(c.gWhy,c.xWhy),function(k){ return ((c.xWhy[k]||0)>=(c.gWhy[k]||0)?"xm:":"gsr:")+k; },"No customer said no.");
  q("tb-tr").innerHTML=bars(c.trWhy,function(k){ return "transfer:"+k; },"No transfers.");
  root.querySelectorAll("#ms-view-board .tb-fill[data-w]").forEach(function(f){ f.style.setProperty("--w",f.getAttribute("data-w")+"%"); });
  renderRepeats(list); q("tb-full").checked=bd.full;
  var sum=boardSummary(); if(q("tb-summary").textContent!==sum){ q("tb-summary").textContent=sum; if(tick) retick(q("tb-summary")); }
  if(opening) arrive(); }
function renderRepeats(list){ var inPeriod={}, chains=[]; list.forEach(function(r){ if(r.rep||r.back) inPeriod[r.account]=1; });
  Object.keys(inPeriod).forEach(function(a){ var l=bd.idx[a]||[]; if(l.length>1) chains.push(l); });
  chains.sort(function(x,y){ return y.length-x.length||y[y.length-1].ts-x[x.length-1].ts; });
  q("tb-t5").textContent=plural(chains.length,"account");
  var shown=bd.allReps?chains:chains.slice(0,8), more=q("tb-more"); more.hidden=chains.length<=8; more.textContent=bd.allReps?"Show fewer":"Show all "+chains.length;
  q("tb-reps").innerHTML=chains.length?shown.map(function(l){ var who=[]; l.forEach(function(r){ if(who.indexOf(r.agent)<0) who.push(r.agent); });
    return '<li class="tb-rep"><p class="tb-rep-h"><span class="tabular">'+esc(bd.full?fmtAcct(l[0].account):mask(l[0].account))+'</span><b>'+plural(l.length,"call")+'</b><span class="tb-of">'+esc(who.join(", "))+'</span></p><ol class="tb-steps">'+l.map(function(r){ return '<li><span class="tabular">'+esc(shortDay(r.ts)+" "+hm(r.ts))+'</span> '+esc(r.agent)+' · '+esc(r.callType||"call")+' · '+issueTag(r)+'</li>'; }).join("")+'</ol></li>'; }).join(""):'<li class="tb-empty">No account called twice within '+REPEAT_DAYS+' days.</li>'; }
function boardSummary(){ var list=periodRows(); if(!list.length) return ""; var c=boardCounts(list), n=Object.keys(agentsOf(list)).length, p=nextPractice(c.coach), notAll=merge(c.gNot,c.xNot), noAll=merge(c.gWhy,c.xWhy);
  var parts=["Team · "+periodLabel(list)+" · "+plural(n,"agent")+" · "+plural(c.n,"call"), "resolved "+pct(c.res,c.n), "GSR offered "+pct(c.gO,c.n)+" ("+c.gO+"), got "+c.gG, "XM offered "+pct(c.xmO,c.n)+" ("+c.xmO+"), got "+c.xmG,
    "came back within "+REPEAT_DAYS+" days "+c.back+" ("+pct(c.back,c.n)+")", "transferred "+c.tr+" ("+pct(c.tr,c.n)+")"+(Object.keys(c.trWhy).length?": "+listStr(c.trWhy,3):"")];
  if(Object.keys(notAll).length) parts.push("not offered, top reasons: "+listStr(notAll,2)); if(Object.keys(noAll).length) parts.push("no's, top reasons: "+listStr(noAll,2)); if(p) parts.push("practise as a team: "+p.title);
  return parts.join(" · "); }
/* Example data so a leader can see the board before any agent has sent a file. Made up, seeded, and labelled as such. */
function exampleFiles(){ var seed=20261011, rnd=function(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  var pick=function(a,w){ var s=0, x; w=w||a.map(function(){ return 1; }); w.forEach(function(v){ s+=v; }); x=rnd()*s; for(var i=0;i<a.length;i++){ x-=w[i]; if(x<0) return a[i]; } return a[a.length-1]; };
  var spots=[["gsrWhy","Price"],["xmWhy","Happy with current carrier"],["transferWhy","Billing"],["gsrWhy","Needs to think"],["fix",""],["xmWhy","Coverage"],["gsrNotWhy","No opening"],["transferWhy","Advanced repair"],["gsrWhy","Partner decides"],["xmWhy","Credit check"]];
  var names="ABCDEFGHIJ".split("").map(function(l){ return "Agent "+l; }), files=names.map(function(nm,i){ var sp=spots[i], f={name:"example-"+nm.toLowerCase().replace(" ","-")+".csv",agent:nm,rows:[],gsr:.45+rnd()*.3,xm:.35+rnd()*.3,tr:.03+rnd()*.05,fix:.72+rnd()*.15,spot:sp};
    if(sp[0]==="fix") f.fix-=.25; if(sp[0]==="transferWhy") f.tr+=.06; if(sp[1]==="No opening"){ f.gsr-=.25; f.xm-=.2; } return f; });
  var wpick=function(f,field,a,w){ var sp=f.spot; return pick(a,sp[0]===field||(field==="xmNotWhy"&&sp[0]==="gsrNotWhy")?w.map(function(v,i){ return a[i]===sp[1]?v*4:v; }):w); };
  var now=new Date(), recent=[], k=0;
  for(var d=2;d>=0;d--){ var day=new Date(now.getFullYear(),now.getMonth(),now.getDate()-d).getTime(), n=240+Math.floor(rnd()*60), times=[];
    for(var i=0;i<n;i++) times.push(day+Math.floor((8*60+rnd()*540))*60000); times.sort(function(a,b){ return a-b; });
    times.forEach(function(ts){ var f=files[Math.floor(rnd()*files.length)], acct, prev=null;
      if(recent.length&&rnd()<.07){ prev=recent[Math.floor(rnd()*recent.length)]; acct=prev.account; } else { acct=String(8000000000+Math.floor(rnd()*1999999999)); }
      var tr=rnd()<f.tr, fixed=!tr&&rnd()<(prev?f.fix-.2:f.fix), gOn=rnd()<f.gsr, xOn=rnd()<f.xm, gR=gOn?pick(["completed","declined","followup"],[22,63,15]):"", xR=xOn?pick(["completed","declined","followup"],[15,72,13]):"";
      var r={ts:ts,date:dkey(ts),account:acct,callType:pick(CALL_TYPES,[40,20,15,10,10,5]),resolved:tr?"transferred":fixed?"resolved":pick(["not","escalated"],[3,1]),satisfied:rnd()<(fixed?.88:.45)?"yes":"no",
        gsrOffered:gOn?"yes":"no",gsrNotWhy:gOn?"":wpick(f,"gsrNotWhy",NOT_OFFERED,[12,6,15,7,25,25,5]),gsrResult:gR,gsrWhich:gR==="completed"?pick(["Internet tier","TV package","Home add-on","Watch line","Tablet line"],[45,20,15,12,8]):"",gsrWhy:gR&&gR!=="completed"?wpick(f,"gsrWhy",GSR_WHY,[30,25,15,10,8,8,4]):"",
        xmOffered:xOn?"yes":"no",xmNotWhy:xOn?"":wpick(f,"xmNotWhy",NOT_OFFERED,[12,6,15,7,25,25,5]),xmResult:xR,xmWhy:xR&&xR!=="completed"?wpick(f,"xmWhy",XM_WHY,[20,18,12,10,8,6,20,4,2]):"",transferWhy:tr?wpick(f,"transferWhy",TRANSFER_WHY,[15,35,20,10,5,8,4,3]):"",id:"x"+(k++)};
      f.rows.push(r); recent.push(r); });
    recent=recent.filter(function(r){ return r.ts>day-5*DAY; }); }
  return files.map(function(f,i){ return {name:f.name,agent:f.agent,hrId:String(204117+i*311),rows:f.rows}; }); }
document.addEventListener("dragover",function(e){ if(root&&!root.hidden&&view==="board") e.preventDefault(); });
document.addEventListener("drop",function(e){ if(root&&!root.hidden&&view==="board"&&!(e.target&&e.target.closest&&e.target.closest("#tb-drop"))){ e.preventDefault(); addFiles(e.dataTransfer&&e.dataTransfer.files); } });

/* ---------- station: nav + route ---------- */
function ensureNav(){ document.querySelectorAll("ol.sl-route").forEach(function(ol){ var li=ol.querySelector('[data-extra="my-shift"]');
  if(!li){ var last=ol.lastElementChild; if(!last||!last.querySelector("a")) return; li=last.cloneNode(true); li.setAttribute("data-extra","my-shift"); var a0=li.querySelector("a"); a0.setAttribute("href",ROUTE); a0.textContent=LABEL; a0.removeAttribute("data-testid"); ol.appendChild(li);
    a0.addEventListener("click",function(){ setTimeout(function(){ var c=document.querySelector('#academy-navigation-sheet button[aria-label="Close navigation"]'); if(c) c.click(); },0); }); }
  var a=li.querySelector("a"); if(onRoute()){ li.setAttribute("data-current","true"); a.setAttribute("aria-current","page"); } else { li.removeAttribute("data-current"); a.removeAttribute("aria-current"); } }); }
function showView(v){ var changed=v!==view; view=v; q("ms-view-shift").hidden=v!=="shift"; q("ms-view-board").hidden=v!=="board"; root.setAttribute("aria-label",v==="board"?"Team board":LABEL);
  root.querySelectorAll(".ms-tab").forEach(function(a){ if(a.getAttribute("data-view")===v) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  document.title=TITLES[v]; return changed; }
function mount(){ if(!root) build(); document.documentElement.classList.add("my-shift-on"); var fresh=!root.parentNode||root.hidden;
  if(!root.parentNode){ var app=document.querySelector("main#main"); if(app&&app.parentNode) app.parentNode.insertBefore(root, app.nextSibling); else (document.getElementById("root")||document.body).appendChild(root); }
  root.hidden=false; var v=routeView(), changed=showView(v);
  if(v==="shift"){ renderBar(); renderList(); renderRepeat(); } else renderBoard();
  if(changed&&!fresh) window.scrollTo(0,0);
  if(fresh||changed) arrive();
  if(!timer) timer=setInterval(function(){ if(root&&!root.hidden&&view==="shift"&&st.shift&&!st.shift.endedAt) renderBar(); },1000); }
function unmount(){ document.documentElement.classList.remove("my-shift-on"); if(root) root.hidden=true; }
function sync(){ ensureNav(); if(!onRoute()){ unmount(); return; } var app=document.querySelector("main#main"); if(!app&&tries<20){ tries++; setTimeout(sync,50); return; } tries=0; mount(); }
/* The Academy wraps each route change in a view transition (desktop, motion allowed). Mounting inside that same callback lets this station fade and slide with the rest; otherwise the hashchange fallback mounts it directly. */
function expectTransition(){ try{ return !OFFLINE&&typeof document.startViewTransition==="function"&&!document.hidden&&window.innerWidth>=768&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
(function(){ var list=window.__cfRouteSyncs=window.__cfRouteSyncs||[]; list.push(function(){ tries=0; sync(); });
  if(typeof document.startViewTransition==="function"&&!document.startViewTransition.__cf){ var orig=document.startViewTransition;
    var wrapped=function(arg){ var obj=!!(arg&&typeof arg==="object"), cb=obj?arg.update:arg; var run=function(){ var r=typeof cb==="function"?cb():undefined; list.forEach(function(f){ try{ f(); }catch(e){} }); return r; }; return orig.call(document, obj?Object.assign({},arg,{update:run}):run); };
    wrapped.__cf=true; document.startViewTransition=wrapped; } })();
window.addEventListener("hashchange",function(){ tries=0; setTimeout(sync, expectTransition()?500:0); });
try{ new MutationObserver(function(){ ensureNav(); }).observe(document.body,{childList:true,subtree:true}); }catch(e){}
try{ new MutationObserver(function(){ var v=routeView(); if(v&&document.title!==TITLES[v]) document.title=TITLES[v]; }).observe(document.head,{childList:true,subtree:true,characterData:true}); }catch(e){}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){ setTimeout(sync,0); }); else setTimeout(sync,0);
window.MyShift={state:function(){ return st; },csv:csvText,summary:summaryText,board:function(){ return bd; },boardSummary:boardSummary};
})();
