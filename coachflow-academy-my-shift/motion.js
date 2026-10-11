/* CoachFlow motion layer: gives every station the moves My Shift has. It watches the Academy's own updates and marks what should move; motion.css does the moving with the Academy's keyframes. Nothing in academy.js is changed, nothing is stored, and reduced motion turns it all off. */
(function(){
"use strict";
var NODE_SEL=".sl-gate-node,.sl-step-node,.sl-guide-step-node,.sl-cf-node";
var COUNT_SEL=".tabular,.sl-know-count,.sl-know-area-count,.sl-chip-count,.sl-turn-count,.sl-case-log-count";
var NO_RISE=/^(SPAN|A|B|I|EM|STRONG|SMALL|BR|IMG|INPUT|LABEL|OPTION|SCRIPT|STYLE|TEMPLATE|CODE|SUP|SUB|ABBR|TIME|MARK|U|S|KBD|TR|TD|TH|THEAD|TBODY|SVG|svg|path|circle|g|line|polyline|rect)$/;
var OVERLAY=/^#\/academy\/(my-shift(\/team-board)?|sales-integrity-gate)$/;
var MAX_BLOCKS=9, MAX_NODES=9, MAX_RISE=12, ARRIVE_MS=1400, RISE_MS=900, SEAL_MS=1000;
var lastKey=null, lastW=null, lastSig=null, pending=false, arriveT=null, counts=new WeakMap();

function reduced(){ try{ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
function routeKey(){ return (location.hash||"#/").replace(/\?.*$/,"").replace(/\/$/,"")||"#"; }
function mainEl(){ return document.getElementById("main"); }
function overlayUp(){ var c=document.documentElement.classList; return c.contains("my-shift-on")||c.contains("gate-simple-on"); }
function seen(el){ if(!el||!el.isConnected||(el.classList&&el.classList.contains("visually-hidden"))) return false; var r=el.getBoundingClientRect(); return r.width>0&&r.height>0; }
function busy(el){ try{ return getComputedStyle(el).animationName!=="none"; }catch(e){ return true; } }
function restart(el,attr,ms){ el.removeAttribute(attr); void el.offsetWidth; el.setAttribute(attr,""); setTimeout(function(){ el.removeAttribute(attr); },ms); }

/* ---------- arriving: the station's parts, one after another ---------- */
function blocksOf(w){ var kids=Array.prototype.filter.call(w.children,function(c){ return !c.classList.contains("visually-hidden"); });
  return kids.length===1&&kids[0].children.length>1?blocksOf(kids[0]):kids; }
function arrive(main){
  if(!main||reduced()) return; var w=main.firstElementChild; if(!w) return;
  main.classList.remove("cf-arriving");
  Array.prototype.forEach.call(main.querySelectorAll("[data-cf-i],[data-cf-n]"),function(e){ e.removeAttribute("data-cf-i"); e.removeAttribute("data-cf-n"); });
  var blocks=blocksOf(w), vh=window.innerHeight||800, i=0;
  for(var k=0;k<blocks.length&&i<MAX_BLOCKS;k++){ var b=blocks[k]; if(!seen(b)) continue;
    var r=b.getBoundingClientRect(); if(r.top>vh) break; if(r.bottom<0||busy(b)) continue;
    b.setAttribute("data-cf-i",String(i++));
    var n=0; Array.prototype.forEach.call(b.querySelectorAll(NODE_SEL),function(nd){ if(n>=MAX_NODES||nd.closest(".sl-map")) return; var nr=nd.getBoundingClientRect(); if(!nr.width||nr.top>vh||busy(nd)) return; nd.setAttribute("data-cf-n",String(n++)); }); }
  if(!i) return;
  void main.offsetWidth; main.classList.add("cf-arriving");
  clearTimeout(arriveT); arriveT=setTimeout(function(){ main.classList.remove("cf-arriving"); },ARRIVE_MS);
}
function remember(main){ if(!main) return; Array.prototype.forEach.call(main.querySelectorAll(COUNT_SEL),function(t){ counts.set(t,t.textContent); }); }

/* ---------- opening: what appears rises into place ---------- */
function rise(recs,main){
  if(main.classList.contains("cf-arriving")) return;
  var cand=[], picked=[];
  for(var i=0;i<recs.length;i++){ var r=recs[i];
    if(r.type==="childList"){ for(var j=0;j<r.addedNodes.length;j++) if(r.addedNodes[j].nodeType===1) cand.push(r.addedNodes[j]); }
    else if(r.type==="attributes"){ var t=r.target;
      if(r.attributeName==="hidden"&&r.oldValue!==null&&!t.hidden) cand.push(t);
      else if(r.attributeName==="open"&&r.oldValue===null&&t.open) Array.prototype.forEach.call(t.children,function(k){ if(k.tagName!=="SUMMARY") cand.push(k); }); } }
  for(var c=0;c<cand.length&&picked.length<MAX_RISE;c++){ var e=cand[c];
    if(!e.isConnected||!main.contains(e)||NO_RISE.test(e.tagName)||e.closest("[data-cf-rise]")) continue;
    var inside=false; for(var p=0;p<picked.length;p++) if(picked[p].contains(e)){ inside=true; break; } if(inside) continue;
    var cs=getComputedStyle(e); if(cs.display==="inline"||cs.display==="contents"||cs.display==="none"||cs.animationName!=="none") continue;
    var rr=e.getBoundingClientRect(); if(rr.height<8||rr.bottom<0||rr.top>(window.innerHeight||800)) continue;
    picked.push(e); }
  picked.forEach(function(e,k){ if(k) e.setAttribute("data-cf-r",String(k)); e.setAttribute("data-cf-rise",""); });
  if(picked.length) setTimeout(function(){ picked.forEach(function(e){ e.removeAttribute("data-cf-rise"); e.removeAttribute("data-cf-r"); }); },RISE_MS);
}

/* ---------- counting: a number that changes ticks over ---------- */
function tick(recs,main){
  var hit=[], known=[];
  for(var i=0;i<recs.length;i++){ var r=recs[i], el=null, changed=false;
    if(r.type==="characterData"){ if(r.oldValue===r.target.nodeValue) continue; el=r.target.parentElement; changed=true; }
    else if(r.type==="childList"&&r.target.nodeType===1) el=r.target;
    if(!el||!el.closest) continue;
    var t=el.closest(COUNT_SEL); if(!t||!main.contains(t)||t.matches(NODE_SEL)||t.closest(".visually-hidden")) continue;
    var at=hit.indexOf(t); if(at<0){ hit.push(t); known.push(changed); } else if(changed) known[at]=true; }
  hit.forEach(function(t,k){ var v=t.textContent, old=counts.get(t); counts.set(t,v);
    if((old!==undefined&&old!==v)||(old===undefined&&known[k])) restart(t,"data-cf-tick",600); });
}

/* ---------- finishing: marking a lesson reviewed seals it ---------- */
function seal(recs){
  for(var i=0;i<recs.length;i++){ var r=recs[i];
    if(r.type==="attributes"&&r.attributeName==="aria-pressed"&&r.oldValue==="false"&&r.target.getAttribute("aria-pressed")==="true"&&r.target.matches('[data-testid="mark-reviewed"]')) restart(r.target,"data-cf-seal",SEAL_MS); }
}

/* ---------- route changes ---------- */
function check(recs){
  try{
    var main=mainEl(); if(!main) return;
    var key=routeKey();
    if(key!==lastKey){ var w=main.firstElementChild, h=w&&w.querySelector("h1"), sig=h?h.textContent:"";
      if(w&&(lastKey===null||w!==lastW||sig!==lastSig)){ lastKey=key; lastW=w; lastSig=sig; pending=false;
        if(!OVERLAY.test(key)){ if(overlayUp()){ pending=true; requestAnimationFrame(await_); } else arrive(main); }
        remember(main); return; } }
    if(reduced()) return;
    rise(recs,main); tick(recs,main); seal(recs);
  }catch(e){}
}
/* When My Shift or the gate is still drawn over the page, wait for it to step aside. Checking just before each frame is painted means the page under it is already arriving in the first frame it shows. */
function settle(){ if(pending&&!overlayUp()){ pending=false; arrive(mainEl()); remember(mainEl()); } }
function await_(){ if(!pending) return; settle(); if(pending) requestAnimationFrame(await_); }

var mo=new MutationObserver(check);
function start(){ var r=document.getElementById("root"); if(!r){ setTimeout(start,50); return; }
  mo.observe(r,{subtree:true,childList:true,characterData:true,characterDataOldValue:true,attributes:true,attributeOldValue:true,attributeFilter:["hidden","open","aria-pressed"]}); }
start();
window.CFMotion={settle:settle,arrive:function(){ arrive(mainEl()); }};
})();
