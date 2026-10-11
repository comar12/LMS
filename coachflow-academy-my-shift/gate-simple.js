/* Simplified Sales Integrity Gate (four ticks). Takes over the #/academy/sales-integrity-gate route; the rest of the Academy is untouched. */
(function(){
"use strict";
var G = window.COACHFLOW_GATE_DATA;
var ROUTE = "#/academy/sales-integrity-gate";
var MOMENTS = [
 {id:"pitch",title:"Before I pitched, the account and the offer were right for this customer.",phases:["before-pitching","before-creating-the-order"]},
 {id:"approval",title:"Before I sent approval, the customer heard the full price and approved it themselves.",phases:["mandatory-disclosures","before-requesting-approval","iguard-and-escalation","never-do-integrity-controls"]},
 {id:"activate",title:"Before I activated, nothing was outstanding and the customer said back what they are getting and paying.",phases:["before-activation","final-customer-understanding"]},
 {id:"redlines",title:"I crossed no red line on this call.",red:true}
];
var RED_GROUPS = ["no credit, backdating or wrong promo code to win the sale","never touched the customer's SSN, DOB or card","only the customer approved, on their own details","nothing added they did not agree to on this call","no proactive callback or smartwatch change","iGuard done properly, no bypass"];
var KIND = {REQUIRED_ACTION:["Do","do"],MANDATORY_DISCLOSURE:["Customer hears","hear"],PROHIBITED_ACTION:["Never","no"],ESCALATION_RULE:["Escalate","do"]};
var phaseById = {}; G.phases.forEach(function(p){ phaseById[p.id]=p; });
var state = {sales:{}, ticks:{}, open:{}, confirmed:false};
var STORE = "coachflow.gate-simple";
function load(){ try{ var s=JSON.parse(sessionStorage.getItem(STORE)||"null"); if(s){ state.sales=s.sales||{}; state.ticks=s.ticks||{}; } }catch(e){} }
function save(){ try{ sessionStorage.setItem(STORE, JSON.stringify({sales:state.sales,ticks:state.ticks})); }catch(e){} }
function keys(o){ return Object.keys(o).filter(function(k){return o[k];}); }
function srcLabel(id){ for(var i=0;i<G.sourceLabels.length;i++) if(G.sourceLabels[i].sourceId===id) return G.sourceLabels[i].label; return id; }
function applies(c){ if(!c.offers) return true; for(var i=0;i<c.offers.length;i++) if(state.sales[c.offers[i]]) return true; return false; }
function controlsFor(m){
  var out=[];
  if(m.red){ G.phases.forEach(function(p){ p.controls.forEach(function(c){ if(c.kind==="PROHIBITED_ACTION"&&applies(c)) out.push(Object.assign({phase:p.title},c)); }); }); return out; }
  m.phases.forEach(function(id){ var p=phaseById[id]; p.controls.forEach(function(c){ if(c.kind!=="PROHIBITED_ACTION"&&applies(c)) out.push(Object.assign({phase:p.title},c)); }); });
  return out;
}
function esc(s){ return String(s).replace(/[&<>"]/g,function(ch){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]; }); }
function h(tag, attrs, html){ var el=document.createElement(tag); if(attrs) for(var k in attrs){ if(k==="class") el.className=attrs[k]; else el.setAttribute(k, attrs[k]); } if(html!=null) el.innerHTML=html; return el; }

var root, just={}, openT=null;
var SEAL='<span class="gs-seal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
/* Motion, in the Academy's own vocabulary: the gate's parts arrive one after another; only what you just changed moves after that. */
function flash(el,ms){ el.removeAttribute("data-just"); void el.offsetWidth; el.setAttribute("data-just",""); setTimeout(function(){ el.removeAttribute("data-just"); },ms||1000); }
function settleOpening(){ clearTimeout(openT); if(root) root.classList.remove("gs-opening"); }
function opening(){ root.classList.remove("gs-opening"); void root.offsetWidth; root.classList.add("gs-opening"); clearTimeout(openT); openT=setTimeout(settleOpening,1300); }
function setText(el,v){ if(el.textContent===v) return; var had=el.textContent!==""; el.textContent=v; if(had) flash(el,700); }
function build(){
  root = h("main",{id:"gate-simple",class:"gs","aria-label":"Sales Integrity Gate, simplified"});
  root.innerHTML =
   '<h1 data-gs-i="0">Sales Integrity Gate</h1>'+
   '<p class="gs-lead" data-gs-i="1">Four things to confirm on every sale. Read the line under each one and tick it only if all of it is true.</p>'+
   '<h2 class="gs-q" data-gs-i="2">What are you selling on this call?</h2>'+
   '<div class="gs-pills" id="gs-pills" data-gs-i="3" role="group" aria-label="What you are selling"></div>'+
   '<div id="gs-hint" class="gs-hint" data-gs-i="3" hidden>Choose what you are selling. The lines below then show that sale\'s checks.</div>'+
   '<div class="gs-prog" data-gs-i="4"><span id="gs-progtext">0 of 4 done</span><span id="gs-count"></span></div>'+
   '<div class="gs-bar" data-gs-i="4"><i id="gs-barfill"></i></div>'+
   '<div id="gs-cards"></div>'+
   '<div class="gs-actions" data-gs-i="8"><button type="button" class="gs-btn" id="gs-confirm" disabled>Confirm this call</button><button type="button" class="gs-btn ghost" id="gs-reset">Reset</button><button type="button" class="gs-link" id="gs-all">Show every check for leaders and QA</button></div>'+
   '<div id="gs-okpanel" class="gs-ok-panel" hidden><h3>'+SEAL+'Confirmed for this call</h3><p id="gs-oktext"></p></div>'+
   '<p class="gs-note" data-gs-i="8">Nothing here is scored or recorded. Ticks live in this browser tab only and are gone when it closes.</p>'+
   '<section class="gs-about" data-gs-i="8"><h3>About this gate</h3>'+
   '<p>The same checks as before, from the same three sources, folded into four ticks in the order a sale meets them. Each tick\'s "Means" line names the checks it covers for the sale you chose. "Show the checks" opens the full wording, the memo category and the source of each one.</p>'+
   '<p id="gs-authority"></p><p><b>Memo categories:</b> <span id="gs-cats"></span></p></section>';
  root.querySelector("#gs-confirm").addEventListener("click", function(){ settleOpening(); just.ok=true; state.confirmed=true; root.querySelector("#gs-oktext").textContent=G.finalConfirmation; render(); });
  root.querySelector("#gs-reset").addEventListener("click", function(){ settleOpening(); state.ticks={}; state.confirmed=false; save(); render(); });
  root.querySelector("#gs-all").addEventListener("click", function(){ settleOpening(); var all = keys(state.open).length===MOMENTS.length; just.all=!all; state.open={}; if(!all) MOMENTS.forEach(function(m){ state.open[m.id]=true; }); render(); });
  root.querySelector("#gs-authority").textContent=G.authorityNote;
  root.querySelector("#gs-cats").textContent=G.categories.map(function(c){ return c.code+" = "+c.name; }).join(" · ");
  return root;
}
function renderPills(){
  var el=root.querySelector("#gs-pills"); el.innerHTML="";
  G.offers.forEach(function(o){
    var b=h("button",{type:"button",class:"gs-pill",id:"gs-pill-"+o.id,title:o.hint||"","aria-pressed":state.sales[o.id]?"true":"false"}); b.textContent=o.label; if(just.pill===o.id) b.setAttribute("data-just","");
    b.addEventListener("click", function(){ settleOpening(); just.pill=o.id; state.sales[o.id]=!state.sales[o.id]; state.confirmed=false; save(); render(); });
    el.appendChild(b);
  });
}
function renderCards(){
  var el=root.querySelector("#gs-cards"); el.innerHTML=""; var total=0;
  MOMENTS.forEach(function(m,i){
    var cs=controlsFor(m); total+=cs.length;
    var done=!!state.ticks[m.id], open=!!state.open[m.id];
    var always=cs.filter(function(c){return !c.appliesWhen;}), when=cs.filter(function(c){return !!c.appliesWhen;});
    var means = m.red ? RED_GROUPS.join(" · ") : always.map(function(c){ return G.short[c.id]||c.text; }).join(" · ");
    var whenHtml="";
    if(!m.red && when.length){
      var byWhen={}, order=[]; when.forEach(function(c){ if(!byWhen[c.appliesWhen]){ byWhen[c.appliesWhen]=[]; order.push(c.appliesWhen);} byWhen[c.appliesWhen].push(G.short[c.id]||c.text); });
      whenHtml='<p class="gs-when">'+order.map(function(w){ return '<b>If '+esc(w)+':</b> '+esc(byWhen[w].join(", ")); }).join(' <span aria-hidden="true">·</span> ')+'</p>';
    }
    var det = cs.map(function(c){ var k=KIND[c.kind]||[c.kind,"do"]; var isNewest=G.newest.indexOf(c.id)>=0;
      return '<div class="gs-ctl"><span class="gs-k '+k[1]+'">'+esc(k[0])+'</span><div class="gs-txt">'+esc(c.handle||c.text)+(c.handle?'<small>'+esc(c.text)+'</small>':'')+(c.detail?'<small>'+esc(c.detail)+'</small>':'')+(c.conflict?'<small><b>Sources differ.</b> '+esc(c.conflict)+'</small>':'')+
        '<div class="gs-meta"><b>'+esc(c.phase)+'</b> · '+esc(c.category)+(c.newInV15?' · New in V15':'')+(isNewest?' · Newest':'')+(c.appliesWhen?' · only if '+esc(c.appliesWhen):'')+' · '+esc(c.sources.map(srcLabel).join(", "))+'</div></div></div>'; }).join("");
    var card=h("div",{class:"gs-card"+(m.red?" red":"")+(done?" done":"")}); if(just.tick===m.id) card.setAttribute("data-just","");
    card.innerHTML='<div class="gs-row"><button type="button" class="gs-box" role="checkbox" aria-checked="'+done+'" id="gs-tick-'+m.id+'" aria-labelledby="gs-t-'+m.id+'"></button>'+
      '<div class="gs-body"><p class="gs-t" id="gs-t-'+m.id+'"><span class="gs-n">'+(i+1)+'</span>'+esc(m.title)+'</p>'+
      '<p class="gs-means"><b>Means:</b> '+esc(means)+'.</p>'+whenHtml+
      '<div class="gs-foot"><span>'+cs.length+' check'+(cs.length===1?'':'s')+(m.red?' · red lines':'')+' for this sale</span><button type="button" class="gs-link" id="gs-open-'+m.id+'" aria-expanded="'+open+'">'+(open?'Hide the checks':'Show the checks')+'</button></div>'+
      '<div class="gs-det" id="gs-det-'+m.id+'"'+(open?'':' hidden')+(open&&(just.open===m.id||just.all)?' data-just=""':'')+'>'+det+'</div></div></div>';
    el.appendChild(card);
    card.querySelector("#gs-tick-"+m.id).addEventListener("click", function(){ settleOpening(); just.tick=m.id; state.ticks[m.id]=!done; state.confirmed=false; save(); render(); });
    card.querySelector("#gs-open-"+m.id).addEventListener("click", function(){ settleOpening(); just.open=m.id; state.open[m.id]=!open; render(); });
  });
  var chosen=keys(state.sales).map(function(id){ for(var i=0;i<G.offers.length;i++) if(G.offers[i].id===id) return G.offers[i].label; return id; });
  setText(root.querySelector("#gs-count"),(chosen.length?chosen.join(" + ")+" · ":"")+total+" checks folded into 4 ticks");
}
function render(){
  renderPills(); renderCards();
  var n=keys(state.ticks).length; setText(root.querySelector("#gs-progtext"),n+" of 4 done");
  root.querySelector("#gs-barfill").style.width=(n*25)+"%";
  root.querySelector("#gs-hint").hidden=keys(state.sales).length>0;
  var ready=n===4&&keys(state.sales).length>0;
  var btn=root.querySelector("#gs-confirm"); btn.disabled=!ready||state.confirmed; btn.textContent=state.confirmed?"Confirmed":"Confirm this call";
  var ok=root.querySelector("#gs-okpanel"); ok.hidden=!state.confirmed; if(just.ok&&state.confirmed) flash(ok,1200);
  root.querySelector("#gs-all").textContent=keys(state.open).length===MOMENTS.length?"Hide every check":"Show every check for leaders and QA";
  just={};
}

function isGateRoute(){ var hsh=location.hash.replace(/\?.*$/,""); return hsh===ROUTE||hsh===ROUTE+"/"; }
function mount(){
  if(!root) build();
  document.documentElement.classList.add("gate-simple-on");
  var app=document.querySelector("main#main");
  if(root.parentNode) return;
  if(app&&app.parentNode) app.parentNode.insertBefore(root, app.nextSibling); else (document.getElementById("root")||document.body).appendChild(root);
  render(); opening();
}
function unmount(){ document.documentElement.classList.remove("gate-simple-on"); if(root&&root.parentNode){ settleOpening(); root.parentNode.removeChild(root); } if(window.CFMotion) window.CFMotion.settle(); }
var tries=0;
function sync(){
  if(!isGateRoute()){ unmount(); return; }
  var app=document.querySelector("main#main");
  if(!app && tries<20){ tries++; setTimeout(sync,50); return; }
  tries=0; mount();
}
load();
/* The Academy wraps each route change in a view transition (desktop, motion allowed). Mounting inside that same callback lets the gate fade with the rest; otherwise the hashchange fallback mounts it directly. */
function expectTransition(){ try{ return typeof document.startViewTransition==="function"&&!document.hidden&&window.innerWidth>=768&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
(function(){ var list=window.__cfRouteSyncs=window.__cfRouteSyncs||[]; list.push(function(){ tries=0; sync(); });
  if(typeof document.startViewTransition==="function"&&!document.startViewTransition.__cf){ var orig=document.startViewTransition;
    var wrapped=function(arg){ var obj=!!(arg&&typeof arg==="object"), cb=obj?arg.update:arg; var run=function(){ var r=typeof cb==="function"?cb():undefined; list.forEach(function(f){ try{ f(); }catch(e){} }); return r; }; return orig.call(document, obj?Object.assign({},arg,{update:run}):run); };
    wrapped.__cf=true; document.startViewTransition=wrapped; } })();
window.addEventListener("hashchange", function(){ tries=0; setTimeout(sync, expectTransition()?500:0); });
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(sync,0); }); else setTimeout(sync,0);
})();
