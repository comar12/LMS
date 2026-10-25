/* CoachFlow elevation: the moving part of the depth layer (elevation.css does the drawing). A card you can open tilts a few degrees toward the mouse, with a soft light where the pointer is; the header rises off the page once the page scrolls under it. Mouse only, and nothing moves with reduced motion. */
(function(){
"use strict";
var TILT=".sl-entry,.sl-guide-next-link,.ca-select-card", MAX=5, REACH=420, PROPS=["--cf-rx","--cf-ry","--cf-mx","--cf-my"];
var cur=null, ev=null, raf=0, raised=null;

function mq(q){ try{ return window.matchMedia(q).matches; }catch(e){ return false; } }
function canTilt(){ return mq("(hover: hover) and (pointer: fine)")&&!mq("(prefers-reduced-motion: reduce)"); }
function clear(el){ if(!el) return; el.removeAttribute("data-cf-tilt"); PROPS.forEach(function(p){ el.style.removeProperty(p); }); }

/* Tilt: wider cards tilt less, so their far edge moves about as much as a small card's. */
function frame(){ raf=0; var e=ev, el=e&&e.target&&e.target.closest?e.target.closest(TILT):null;
  if(el&&(el.getAttribute("aria-disabled")==="true"||!el.isConnected||!canTilt())) el=null;
  if(el!==cur){ clear(cur); cur=el; } if(!el) return;
  var r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
  var x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)), y=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height)), k=Math.min(1,REACH/Math.max(r.width,r.height));
  el.style.setProperty("--cf-rx",((0.5-y)*MAX*k).toFixed(2)+"deg"); el.style.setProperty("--cf-ry",((x-0.5)*MAX*k).toFixed(2)+"deg");
  el.style.setProperty("--cf-mx",(x*100).toFixed(1)+"%"); el.style.setProperty("--cf-my",(y*100).toFixed(1)+"%");
  if(!el.hasAttribute("data-cf-tilt")) el.setAttribute("data-cf-tilt",""); }
document.addEventListener("pointermove",function(e){ if(e.pointerType&&e.pointerType!=="mouse") return; ev=e; if(!raf) raf=requestAnimationFrame(frame); },{passive:true});
document.documentElement.addEventListener("pointerleave",function(){ ev=null; clear(cur); cur=null; });
window.addEventListener("blur",function(){ clear(cur); cur=null; });
window.addEventListener("hashchange",function(){ clear(cur); cur=null; });

/* The header: rises once the page scrolls under it. */
function onScroll(){ var up=(window.scrollY||document.documentElement.scrollTop||0)>8; if(up!==raised){ raised=up; document.documentElement.classList.toggle("cf-raised",up); } }
window.addEventListener("scroll",onScroll,{passive:true}); window.addEventListener("hashchange",function(){ setTimeout(onScroll,0); }); onScroll();
})();
