/* ---------------------------------------------------------------- motion layer: scroll reveal, deferred chart entrances, number morphing, day strip, standings race */
const MOTION_OK = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const IO = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => { for (const e of entries) { if (!e.isIntersecting) continue; IO.unobserve(e.target); revealNow(e.target); } }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }) : null;
function revealNow(t){ t.classList.add('in'); if (t._anims){ const a=t._anims; t._anims=null; a.forEach(x=>{ try{ x.play(); }catch(e){} }); } if (t._onReveal){ const f=t._onReveal; t._onReveal=null; try{ f(); }catch(e){ console.error(e); } } }
function inView(el){ const r=el.getBoundingClientRect(); return r.width>0 && r.height>0 && r.top < (window.innerHeight||800)-30 && r.bottom > 0; }
/* pause a chart's WAAPI entrance until it scrolls into view */
function deferAnims(host){ if (!host || !IO || !MOTION_OK() || !host.getAnimations) return; if (inView(host)) return; const a=host.getAnimations({subtree:true}); if (!a.length) return; a.forEach(x=>{ try{ x.pause(); }catch(e){} }); host._anims=a; IO.observe(host); }
/* run fn once el is on screen (immediately when it already is, or when motion is off) */
function whenVisible(el, fn){ if (!el) return; if (!IO || !MOTION_OK() || inView(el)){ fn(); return; } el._onReveal=fn; IO.unobserve(el); IO.observe(el); }
/* panels and tiles fade up the first time they enter the viewport */
function armReveals(){ if (!IO || !MOTION_OK()) return; document.querySelectorAll('.view .panel, .view .grid-three > *, .view .kpis, .view .summary-row > *').forEach((p,k)=>{ if (p.dataset.rv) return; p.dataset.rv='1'; if (inView(p) && !p.closest('.view:not(.active)')){ p.classList.add('rvl'); requestAnimationFrame(()=>requestAnimationFrame(()=>p.classList.add('in'))); return; } p.classList.add('rvl'); IO.observe(p); }); }
window.addEventListener('beforeprint', ()=>document.querySelectorAll('.rvl').forEach(p=>p.classList.add('in')));
/* numbers glide from their previous value instead of restarting at zero */
const NUMPREV={};
function morphNum(el, to, f, dur){ if (!el) return; let from=parseFloat(el.dataset.v); if (!isFinite(from) && el.id && NUMPREV[el.id]!=null) from=NUMPREV[el.id]; el.dataset.v=String(to); if (el.id) NUMPREV[el.id]=to; if (!isFinite(to)){ el.textContent=f(to); return; } if (window.Charts&&Charts.countUp) Charts.countUp(el, to, {from: isFinite(from)?from:0, duration: dur||650, format:f}); else el.textContent=f(to); }
const shortName = s => { const w=String(s||'').trim().split(/\s+/); return w.length>3 ? w.slice(0,3).join(' ') : w.join(' '); };

/* ---- reporting-day strip: a micro stacked column per business day (XM bottom, GSR top), morphs in place on filter changes */
function renderDayStrip(){ const {dy}=C; const iMax=DI[META.maxDate]; const k0=Math.max(0,iMax-8); const single = state.from===state.to ? state.from : null; const host=document.getElementById('days'); const idx=[]; for(let i=k0;i<=iMax;i++) idx.push(i);
  const H=58, mx=Math.max(1,...idx.map(i=>dy.xm[i]+dy.gsr[i])); const key=idx.map(i=>DATES[i]).join(',');
  if (host.dataset.key!==key){ host.innerHTML=idx.map((i,k)=>{ const dt=new Date(DATES[i]+'T00:00:00Z'); return `<button type="button" class="day" data-d="${DATES[i]}" style="--i:${k}"><span class="d">${WD[dt.getUTCDay()]}</span><b>${dt.getUTCDate()}</b><span class="mcol" aria-hidden="true"><i class="x"></i><i class="g"></i></span><span class="xg"><b class="nx"></b> · <b class="ng"></b></span><span class="v"></span></button>`; }).join(''); host.dataset.key=key; host.classList.remove('grown'); void host.offsetWidth; host.classList.add('grown');
    host.querySelectorAll('.day').forEach(el=>el.addEventListener('click',()=>{ const d=el.dataset.d; if(state.from===d&&state.to===d){ setPreset('7'); toast('Back to the last 7 days'); return; } state.from=d; state.to=d; state.preset='custom'; syncInputs(); renderAll(); toast(`Focused on ${fd(d)} · click the day again or pick a period to go back`); })); }
  idx.forEach((i,k)=>{ const b=host.children[k]; if(!b) return; const x=dy.xm[i], g=dy.gsr[i], v=x+g, p=i>0?dy.xm[i-1]+dy.gsr[i-1]:null, dir=p==null?0:v-p;
    b.querySelector('.x').style.height=(H*x/mx).toFixed(1)+'px'; b.querySelector('.g').style.height=(H*g/mx).toFixed(1)+'px'; b.querySelector('.mcol').classList.toggle('nog', g===0);
    morphNum(b.querySelector('.nx'), x, n0, 500); morphNum(b.querySelector('.ng'), g, n0, 500); const ve=b.querySelector('.v'); ve.textContent=p==null?'':(dir>0?'▲':dir<0?'▼':'→')+n0(Math.abs(dir)); ve.className='v '+(dir>0?'up':dir<0?'down':'');
    b.className=`day ${i===iMax?'latest':''} ${single===DATES[i]?'sel':''}`; b.title=`${fd(DATES[i])}: XM ${x} · GSR ${g}${p==null?'':` · ${dir>=0?'+':''}${dir} vs the day before`} · click to focus the dashboard on this day`; });
  document.getElementById('stripRange').textContent=`${fds(DATES[k0])} – ${fdl(DATES[iMax])} · click a day to focus`; }

/* ---- standings race + products on the day, one shared clock that plays through the period when it scrolls into view */
const MOTION={};
function renderMotion(id, cfg){ const host=document.getElementById(id); if(!host) return; const old=MOTION[id]; if(old&&old.timer) clearInterval(old.timer);
  const {dy,i0,i1}=cfg; const n=i1-i0+1; const rowH=30; const maxRows=cfg.maxRows||14;
  const ents=cfg.ents.map(e=>{ const cx=[],cg=[]; let sx=0,sg=0; for(let i=i0;i<=i1;i++){ sx+=e.dy.xm[i]; sg+=e.dy.gsr[i]; cx.push(sx); cg.push(sg); } return Object.assign({},e,{cx,cg}); }).filter(e=>e.cx[n-1]+e.cg[n-1]>0);
  const fmax=Math.max(1,...ents.map(e=>e.cx[n-1]+e.cg[n-1])); const vis=Math.max(1,Math.min(maxRows,ents.length));
  const step=Math.max(140,Math.min(900,Math.round(8400/Math.max(1,n)))); const keys=[['xm','XM Lines','s1'],['speed','Speed Upgrade','s2'],['xpro','X-PRO','s3'],['lob','Adding LOB','s4'],['mplus','Mobile Plus','s5'],['xmcG','XMC (GSR)','other']];
  const pmax=Math.max(1,...keys.flatMap(([k])=>dy[k].slice(i0,i1+1))); const dots=n<=45;
  host.innerHTML=`<div class="mo" style="--step:${step}ms">
    <div class="mo-head"><div class="mo-when"><div class="mo-date" id="${id}-date"></div><div class="mo-sum" id="${id}-sum"></div></div><div class="mo-meter" id="${id}-meter"></div></div>
    <div class="mo-grid">
      <div class="mo-col"><div class="mo-cap"><b>${esc(cfg.raceTitle)}</b><span>running total since ${fds(DATES[i0])} · <i class="sw" style="background:var(--s1)"></i>XM <i class="sw" style="background:var(--s2)"></i>GSR · ▲▼ = places moved that day</span></div>
        ${ents.length?`<div class="race" style="height:${vis*rowH}px">${ents.map((e,j)=>`<div class="rr${e.mine?' mine':''}" data-j="${j}"><span class="rk"><b></b><em></em></span><span class="rn" title="${esc(e.name)}">${esc(e.label||e.name)}</span><span class="rt"><i class="x"></i><i class="g"></i></span><span class="rv3"></span><span class="ri"></span></div>`).join('')}</div>${ents.length>vis?`<div class="mo-more">Top ${vis} of ${ents.length} shown · the rest are below the cut on the day</div>`:''}`:`<div class="panel-meta" style="padding:18px 0">No sales in this scope and period.</div>`}</div>
      <div class="mo-col"><div class="mo-cap"><b>Products on the day</b><span>bar = that day · thin marker = the day before</span></div>
        <div class="pd">${keys.map(([k,nm,c])=>`<div class="pr" data-k="${k}"><div class="pl"><span><i class="sw" style="background:${cvar(c)}"></i>${esc(nm)}</span><b class="pv"></b><em class="pdlt"></em></div><div class="ptr"><i class="pb" style="background:${cvar(c)}"></i><i class="pg"></i></div></div>`).join('')}</div></div>
    </div>
    ${dots?`<div class="rtl"><div class="rprog" id="${id}-prog"></div>${DATES.slice(i0,i1+1).map((d,k)=>`<button type="button" class="rdot" data-i="${i0+k}" title="${fd(d)}" aria-label="${fd(d)}"></button>`).join('')}</div>`:`<input type="range" class="mo-range" id="${id}-range" min="${i0}" max="${i1}" value="${i1}" aria-label="Business day">`}
    <div class="rfoot"><span id="${id}-state"></span><span>${fds(DATES[i0])} → ${fds(DATES[i1])} · ${n} business day${n>1?'s':''}</span></div></div>`;
  const R={timer:null,cur:i1,rank:{}}; MOTION[id]=R; const mo=host.querySelector('.mo'); const rowsEl=[...host.querySelectorAll('.rr')]; const st=document.getElementById(id+'-state');
  const tot=(e,k)=>e.cx[k]+e.cg[k];
  const go=(ix,quiet)=>{ const i=Math.max(i0,Math.min(i1,ix)); R.cur=i; const k=i-i0; const prevI=i>0?i-1:null;
    const order=ents.map((e,j)=>j).sort((a,b)=>tot(ents[b],k)-tot(ents[a],k) || ((R.rank[a]??a)-(R.rank[b]??b))); const nr={}; order.forEach((j,r)=>nr[j]=r);
    rowsEl.forEach((row,j)=>{ const e=ents[j], r=nr[j], on=r<vis; row.style.transform=`translateY(${(on?r:vis)*rowH}px)`; row.style.opacity=on?'1':'0'; row.style.zIndex=String(on?200-r:0);
      const x=e.cx[k], g=e.cg[k]; row.querySelector('.x').style.width=(100*x/fmax).toFixed(2)+'%'; row.querySelector('.g').style.width=(100*g/fmax).toFixed(2)+'%'; row.querySelector('.rt').classList.toggle('nog',g===0); row.querySelector('.rt').classList.toggle('nox',x===0);
      row.querySelector('.rk b').textContent=String(r+1); const mv=(R.rank[j]!=null&&k>0)?R.rank[j]-r:0; const me=row.querySelector('.rk em'); me.textContent=mv>0?'▲'+mv:mv<0?'▼'+(-mv):''; me.className=mv>0?'up':mv<0?'down':'';
      const ve=row.querySelector('.rv3'); if(quiet){ ve.dataset.v=String(x+g); ve.textContent=n0(x+g); } else morphNum(ve, x+g, n0, Math.min(600,step*0.9));
      const inc=k>0?tot(e,k)-tot(e,k-1):tot(e,0); const ie=row.querySelector('.ri'); ie.textContent=inc>0?'+'+inc:''; ie.classList.remove('pop'); if(inc>0&&!quiet){ void ie.offsetWidth; ie.classList.add('pop'); } row.classList.toggle('scored', inc>0); });
    R.rank=nr;
    const d=DATES[i]; const dv=dy.xm[i]+dy.gsr[i], pv=prevI!=null?dy.xm[prevI]+dy.gsr[prevI]:null; let cx=0,cg=0; for(let q=i0;q<=i;q++){ cx+=dy.xm[q]; cg+=dy.gsr[q]; }
    document.getElementById(id+'-date').textContent=fd(d); document.getElementById(id+'-sum').innerHTML=`<span class="tx">XM <b>${n0(dy.xm[i])}</b></span> · <span class="tg">GSR <b>${n0(dy.gsr[i])}</b></span> on the day · ${dy.act[i]} sellers${pv==null?'':` · <span class="score-chip ${dcls(dv-pv)}">${arrow(dv-pv)}${sgn(dv-pv)} vs ${fds(DATES[prevI])}</span>`}<br><span class="mo-run">Running total: XM ${n0(cx)} · GSR ${n0(cg)} · day ${i-i0+1} of ${n}</span>`;
    const me=document.getElementById(id+'-meter'); if(cfg.target){ const r=dv/cfg.target; me.innerHTML=`<div class="mm-l"><span>Day vs daily target</span><b>${n0(dv)} <small>of ${n0(cfg.target)}</small></b></div><div class="mm-t"><i class="${r>=1?'good':r>=0.95?'warn':'bad'}" style="width:${Math.min(100,100*r).toFixed(1)}%"></i></div><div class="mm-s">${pct0(r)} of target${r>=1?' · ✓ met':''}</div>`; } else me.innerHTML='';
    for(const [kk] of keys){ const pr=host.querySelector(`.pr[data-k="${kk}"]`); const v=dy[kk][i], p=prevI!=null?dy[kk][prevI]:0; pr.querySelector('.pb').style.width=(100*v/pmax).toFixed(1)+'%'; pr.querySelector('.pg').style.left=(100*p/pmax).toFixed(1)+'%'; pr.querySelector('.pg').style.opacity=prevI!=null&&i>i0?'1':'0'; const pve=pr.querySelector('.pv'); if(quiet){ pve.dataset.v=String(v); pve.textContent=n0(v); } else morphNum(pve, v, n0, Math.min(500,step*0.8)); const de=pr.querySelector('.pdlt'); de.textContent=prevI==null?'':(v-p===0?'→ 0':arrow(v-p)+sgn(v-p)); de.className='pdlt '+dcls(v-p); }
    host.querySelectorAll('.rdot').forEach(b=>{ const bi=+b.dataset.i; b.classList.toggle('on',bi===i); b.classList.toggle('past',bi<i); }); const pg=document.getElementById(id+'-prog'); if(pg) pg.style.width=(100*(i-i0)/Math.max(1,i1-i0)).toFixed(1)+'%'; const rg=document.getElementById(id+'-range'); if(rg) rg.value=String(i); };
  const stop=msg=>{ if(R.timer){ clearInterval(R.timer); R.timer=null; } mo.classList.remove('playing'); st.innerHTML=msg||(n>1?`Showing ${fds(DATES[R.cur])} · click any day on the timeline to hold it · <button type="button" class="text-button mo-replay">Replay ↻</button>`:'Single business day selected'); const rb=st.querySelector('.mo-replay'); if(rb) rb.addEventListener('click',play); };
  const snap=i=>{ mo.classList.add('snap'); go(i,true); void mo.offsetWidth; mo.classList.remove('snap'); };
  function play(){ if(n<2) return; if(R.timer){ clearInterval(R.timer); R.timer=null; } R.rank={}; snap(i0); mo.classList.add('playing'); st.textContent=`Playing through the period · ${fds(DATES[i0])} → ${fds(DATES[i1])}`; R.timer=setInterval(()=>{ if(R.cur>=i1){ stop(); return; } go(R.cur+1); }, step); }
  host.querySelectorAll('.rdot').forEach(b=>b.addEventListener('click',()=>{ if(R.timer){ clearInterval(R.timer); R.timer=null; } go(+b.dataset.i); stop(); }));
  const rg=document.getElementById(id+'-range'); if(rg) rg.addEventListener('input',()=>{ if(R.timer){ clearInterval(R.timer); R.timer=null; } go(+rg.value); stop(); });
  if(n>1 && MOTION_OK() && IO){ snap(i0); stop('Starts when this panel is on screen'); whenVisible(host, play); } else { snap(i1); stop(); } }

/* ---- when in the shift sales are logged (Cairo time, shift 14:00 → 07:00, business day cut at noon) */
const SHIFT_HOURS=[14,15,16,17,18,19,20,21,22,23,0,1,2,3,4,5,6,7];
function shiftHours(rs){ const xm=SHIFT_HOURS.map(()=>0), gs=SHIFT_HOURS.map(()=>0); let ox=0,og=0; for(const r of rs){ const k=SHIFT_HOURS.indexOf(r.h); if(k<0){ ox+=r.xm; og+=r.gsr; } else { xm[k]+=r.xm; gs[k]+=r.gsr; } } return {xm,gs,ox,og}; }
function renderShift(figId, footId, rs){ const s=shiftHours(rs); const cats=SHIFT_HOURS.map(h=>String(h).padStart(2,'0')+':00'); const xm=s.xm.slice(), gs=s.gs.slice(); if(s.ox+s.og){ cats.push('08–13'); xm.push(s.ox); gs.push(s.og); }
  chart(figId,'columns',{cats, series:[{name:'XM Lines',values:xm,color:'s1'},{name:'GSR units',values:gs,color:'s2'}], stacked:true, valueLabels:'max', yFormat:n0, height:250});
  const tot=xm.reduce((a,b)=>a+b,0)+gs.reduce((a,b)=>a+b,0); const foot=document.getElementById(footId); if(!foot) return; if(!tot){ foot.innerHTML='<span>No sales in this scope and period.</span>'; return; }
  const byH=cats.map((c,k)=>[c,xm[k]+gs[k]]); const peak=[...byH].sort((a,b)=>b[1]-a[1])[0]; const am=SHIFT_HOURS.reduce((a,h,k)=>a+(h<12?xm[k]+gs[k]:0),0); const ev=SHIFT_HOURS.reduce((a,h,k)=>a+(h>=14&&h<18?xm[k]+gs[k]:0),0);
  let b3=0, b3s=0; for(let k=0;k+2<SHIFT_HOURS.length;k++){ const v=xm[k]+gs[k]+xm[k+1]+gs[k+1]+xm[k+2]+gs[k+2]; if(v>b3){ b3=v; b3s=k; } }
  foot.innerHTML=`<span>Peak hour <b>${peak[0]}</b> (${n0(peak[1])} · ${pct0(peak[1]/tot)}) · busiest 3-hour window <b>${cats[b3s]}–${String((SHIFT_HOURS[b3s+2]+1)%24).padStart(2,'0')}:00</b> with ${pct0(b3/tot)} of sales · <b>${pct0(am/tot)}</b> logged after midnight · ${pct0(ev/tot)} in the first four hours (14:00–18:00)${s.ox+s.og?` · ${n0(s.ox+s.og)} outside shift hours`:''}</span>`; }
