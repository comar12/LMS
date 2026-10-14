/* ---------------------------------------------------------------- director-style hero: insight headline, attainment ring, glass KPI cards */
const VIEWNAME={exec:'Executive view', om:'Ops manager view', leader:'Team leader view', agents:'Agent view', insights:'Insights', data:'Data & settings'};
let DVSEQ=0;
function dvSetView(){ const el=document.getElementById('dvView'); if(el) el.textContent=VIEWNAME[state.tab]||VIEWNAME.exec; }
function dvScope(){ const p=[]; if(state.tl&&state.tl!=='All') p.push(`${state.tl}'s team`); else if(state.om&&state.om!=='All') p.push(`${state.om}'s teams`); else p.push('Whole floor'); if(state.phase&&state.phase!=='All') p.push(`${state.phase} agents`); if(state.tenure&&state.tenure!=='All') p.push(`tenure ${state.tenure}`); return p; }
const dvArrow = v => v>0?'▲':v<0?'▼':'→';
const dvChip = (v,f=n0) => `<span class="${v>0?'up':v<0?'down':'flat'}">${dvArrow(v)} ${sgn(v,f)}</span>`;
/* area sparkline sized to its card: gradient wash, a line that draws in, an end dot with a halo */
function dvSpark(vals, color, w){ w=Math.max(120,Math.round(w||220)); const h=46, pad=5; const vs=vals.map(v=>v==null||!isFinite(v)?null:+v); const nn=vs.filter(v=>v!=null); if(nn.length<2) return '<div class="dv-nospark">not enough days yet</div>';
  const lo=Math.min(...nn), hi=Math.max(...nn); const x=i=>pad+i*(w-2*pad)/Math.max(1,vs.length-1), y=v=>h-pad-(v-lo)/((hi-lo)||1)*(h-2*pad-4);
  let d='', pen=false; vs.forEach((v,i)=>{ if(v==null){ pen=false; return; } d+=(pen?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1); pen=true; });
  const full=vs.every(v=>v!=null); const area=full?`M${x(0).toFixed(1)},${h}`+vs.map((v,i)=>`L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')+`L${x(vs.length-1).toFixed(1)},${h}Z`:'';
  let li=vs.length-1; while(li>0&&vs[li]==null) li--; const gid='dvg'+(++DVSEQ); const cx=x(li).toFixed(1), cy=y(vs[li]).toFixed(1);
  return `<svg class="dv-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".30"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${area?`<path class="ar" d="${area}" fill="url(#${gid})"/>`:''}<path class="ln" d="${d}" pathLength="1" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle class="hl" cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${color}" stroke-width="1.5"/><circle class="dt" cx="${cx}" cy="${cy}" r="4" fill="${color}" stroke="#0e2d3d" stroke-width="2"/></svg>`; }
/* attainment ring: bezel ticks, gradient arc with a glowing end cap, a yellow reference tick */
function dvRingBuild(host){ if(host.querySelector('svg')) return; const S=232, c=S/2, r=90, C2=2*Math.PI*r; let t='';
  for(let k=0;k<72;k++){ const mj=k%6===0, r1=mj?101:104, r2=mj?112:109, a=(k*5-90)*Math.PI/180; t+=`<line class="${mj?'mj':''}" style="--k:${k}" x1="${(c+r1*Math.cos(a)).toFixed(2)}" y1="${(c+r1*Math.sin(a)).toFixed(2)}" x2="${(c+r2*Math.cos(a)).toFixed(2)}" y2="${(c+r2*Math.sin(a)).toFixed(2)}"/>`; }
  host.innerHTML=`<svg viewBox="0 0 ${S} ${S}" role="img" aria-labelledby="dvRingT"><title id="dvRingT">Target attainment</title><defs><linearGradient id="dvRG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8af0d6"/><stop offset=".55" stop-color="#5fd6d0"/><stop offset="1" stop-color="#2fb0c2"/></linearGradient></defs><g class="ticks">${t}</g><circle class="trk" cx="${c}" cy="${c}" r="${r}"/><circle class="arc" cx="${c}" cy="${c}" r="${r}" stroke-dasharray="${C2.toFixed(2)}" stroke-dashoffset="${C2.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/><g class="base"><line x1="${c}" y1="${c-r-13}" x2="${c}" y2="${c-r+13}"/></g><g class="cap"><circle cx="${c}" cy="${c-r}" r="7"/></g></svg><div class="dv-ring-c"><b id="dvRV">0%</b><span>Target attainment</span><em id="dvRB"></em></div>`;
  host._C=C2; }
function dvRingSet(v, base, baseLabel){ const host=document.getElementById('dvRing'); dvRingBuild(host); const C2=host._C, f=Math.max(0,Math.min(1,v||0)); const arc=host.querySelector('.arc'), cap=host.querySelector('.cap'), bs=host.querySelector('.base');
  const go=()=>{ arc.style.strokeDashoffset=(C2*(1-f)).toFixed(2); cap.style.transform=`rotate(${(360*f).toFixed(2)}deg)`; const on=f>0.001; arc.style.opacity=on?'1':'0'; cap.style.opacity=on?'1':'0'; };
  if(!host._init){ host._init=true; if(MOTION_OK()){ host.classList.add('intro'); setTimeout(()=>host.classList.remove('intro'),2400); requestAnimationFrame(()=>requestAnimationFrame(go)); } else go(); } else go();
  if(base!=null){ bs.style.transform=`rotate(${(360*Math.max(0,Math.min(1,base))).toFixed(2)}deg)`; bs.style.opacity='1'; } else bs.style.opacity='0';
  morphNum(document.getElementById('dvRV'), (v||0)*100, x=>x.toFixed(1)+'%', 1150); document.getElementById('dvRB').textContent=baseLabel||'';
  host.querySelector('title').textContent=`Target attainment ${((v||0)*100).toFixed(1)}%${base!=null?`; ${baseLabel}`:''}`; }

function renderHero(){ const {cur,prev,dy,i1,len,target}=C; const hero=document.getElementById('hero'); if(!hero.dataset.ready){ hero.dataset.ready='1'; if(MOTION_OK()){ hero.classList.add('intro'); setTimeout(()=>hero.classList.remove('intro'),2800); } }
  dvSetView(); const pt=target*len, ratio=pt?cur.u/pt:0, hasPrior=C.p1>=0, pratio=pt&&hasPrior?prev.u/pt:null; const dx=cur.xm-prev.xm, dg=cur.gsr-prev.gsr; const PT=prodTotals(C.perRows); const fm=String(C.fiscal||'').split(' ')[0];
  // eyebrow: scope · period · dates
  const per = state.preset==='mtd' ? `Fiscal month to date · ${C.fiscal} (${fds(C.fs)} – ${fds(C.fe)})` : state.preset==='today' ? `Latest business day · ${fd(state.from)}` : state.preset==='all' ? `Whole tracker · ${fds(state.from)} – ${fds(state.to)}` : ['7','14','30'].includes(state.preset) ? `Last ${state.preset} days · ${fds(state.from)} – ${fds(state.to)}` : len===1 ? `Focused day · ${fd(state.from)}` : `Custom range · ${fds(state.from)} – ${fds(state.to)}`;
  document.getElementById('dvScope').textContent=[...dvScope(), per].join(' · ');
  // headline: the result in one sentence
  const when = len===1 ? `on ${fd(state.from)}` : state.preset==='mtd' ? `in fiscal ${fm} so far` : `in ${len} business days`;
  document.getElementById('dvHead').innerHTML=`<span class="ln"><em class="x"><b id="dvHX"></b> XM line${cur.xm===1?'':'s'}</em> and <em class="g"><b id="dvHG"></b> GSR</em></span><span class="ln">sold ${when}</span>`;
  morphNum(document.getElementById('dvHX'), cur.xm, n0, 1100); morphNum(document.getElementById('dvHG'), cur.gsr, n0, 1100);
  const types=[['XM Lines',PT.xmG],['Speed Upgrade',PT.speed],['X-PRO',PT.xpro],['Adding LOB',PT.lob],['Mobile Plus',PT.mplus],['XMC',PT.xmcG]].sort((a,b)=>b[1]-a[1]); const top=types[0]; const es=cur.xm?PT.esimL/cur.xm:null;
  const bits=[]; if(pt) bits.push(`<b>${pct0(ratio)}</b> of the ${n0(pt)} target`); if(cur.gsr&&top[1]) bits.push(`top GSR type <b>${esc(top[0])}</b> (${pct0(top[1]/cur.gsr)} of GSR)`); if(es!=null) bits.push(`e‑SIM on ${pct0(es)} of XM lines`); bits.push(`${n0(cur.active)} of ${n0(C.hcScope)} agents sold`);
  document.getElementById('dvSub').innerHTML=bits.join(' · ');
  // change vs the prior period
  const de=document.getElementById('dvDelta'); const vs=len===1?'the day before':`the prior ${len} days`;
  if(hasPrior){ const t=cur.u-prev.u, pc=prev.u?t/prev.u:null; de.className='dv-delta '+(t>0?'up':t<0?'down':''); de.innerHTML=`<span class="ar">${dvArrow(t)}</span><span>XM ${sgn(dx)} · GSR ${sgn(dg)} vs ${vs}</span><span class="dim">(${n0(prev.xm)} XM · ${n0(prev.gsr)} GSR before${pc!=null?`, ${sgn(pc*100,x=>x.toFixed(0)+'%')} combined`:''})</span>`; }
  else { de.className='dv-delta'; de.innerHTML='<span class="dim">No earlier period in the tracker to compare with</span>'; }
  // ring
  dvRingSet(pt?ratio:0, pratio, pratio!=null?`prior ${pct(pratio)}`:(pt?'no prior period':'no target'));
  document.getElementById('dvCap').innerHTML = pt ? `${pratio!=null?`<span><i class="tk"></i>Yellow tick = ${len===1?'the day before':`prior ${len} days`} · ${pct(pratio)}</span>`:''}<span>Target = ${state.perAgent} per agent × ${n0(C.hcTarget)} agents × ${len} day${len>1?'s':''}</span>` : '<span>No agents in scope, so no target</span>';
  // glass KPI cards
  const s0=Math.max(0,i1-13), s14=a=>a.slice(s0,i1+1); const perHead=len&&C.hcTarget?cur.u/len/C.hcTarget:0, pPerHead=len&&C.hcTarget?prev.u/len/C.hcTarget:0; const part=C.hcScope?cur.active/C.hcScope:0; const xr=cur.xmcRate, pxr=prev.xmcRate, xt=state.xmcTarget;
  const att=s14(dy.xy).map((v,k)=>{ const i=s0+k, d=dy.xy[i]+dy.xn[i]; return d?dy.xy[i]/d:null; });
  const to=state.to, dim=C.dim, ms=DI[C.fs]!=null?DI[C.fs]:0, mtd=sum(dy.u,ms,DI[to]), elapsed=daysBetween(C.fs,to)+1, remain=Math.max(0,dim-elapsed), monthTarget=state.perAgent*C.hcTarget*dim, need=remain>0?Math.max(0,(monthTarget-mtd)/remain):0, pace=elapsed?mtd/elapsed:0, proj=mtd+pace*remain;
  const cards=[
    {k:'xm', l:'XM Lines', v:cur.xm, f:n0, c:'x', s:`${dvChip(dx)} vs prior${es!=null?` · ${pct0(es)} e‑SIM`:''}`, sp:s14(dy.xm), col:'#5ccfe0'},
    {k:'gsr', l:'GSR units', v:cur.gsr, f:n0, c:'g', s:`${dvChip(dg)} vs prior${cur.gsr&&top[1]?` · ${esc(top[0])} ${pct0(top[1]/cur.gsr)}`:''}`, sp:s14(dy.gsr), col:'#f6a56b'},
    {k:'ph', l:'Sales / agent / day', v:perHead, f:n2, c:perHead>=state.perAgent?'good':'bad', s:`target ${state.perAgent} · ${dvChip(perHead-pPerHead,n2)}`, sp:s14(dy.u).map(v=>C.hcTarget?v/C.hcTarget:0), col:'#e6f0f5'},
    {k:'pa', l:'Participation', v:part, f:pct0, c:'', s:`${n0(cur.active)} of ${n0(C.hcScope)} agents · <em class="bad">${n0(Math.max(0,C.hcScope-cur.active))} with no sale</em>`, sp:s14(dy.act).map(a=>C.hcScope?a/C.hcScope:0), col:'#e6f0f5'},
    {k:'xa', l:'XMC attach', v:xr==null?NaN:xr, f:xr==null?(()=>'—'):pct, c:xt==null||xr==null?'':(xr>=xt/100?'good':'bad'), s:xr==null?'no answered XM entries':`${n0(cur.xy)} of ${n0(cur.xy+cur.xn)} entries${pxr==null?'':` · ${dvChip((xr-pxr)*100,x=>x.toFixed(1)+' pts')}`}`, sp:att, col:'#e6f0f5'},
    {k:'fi', l:`Fiscal ${fm} pace`, v:pace, f:n1, suf:'/day', c:target?(pace>=target?'good':'bad'):'', s:target?`<em class="${need>pace?'bad':'good'}">${n0(need)}/day needed</em> · ${remain} day${remain===1?'':'s'} left`:'no target in scope', meter:target?{f:Math.min(1,mtd/Math.max(1,monthTarget)), t:Math.min(1,elapsed/Math.max(1,dim)), mtd, proj, monthTarget}:null}
  ];
  const host=document.getElementById('dvCards'); if(host.children.length!==cards.length) host.innerHTML=cards.map((c,i)=>`<div class="dv-card" data-k="${c.k}" style="--i:${i}"><div class="dv-l"></div><div class="dv-v"><b id="dvc-${c.k}"></b><small></small></div><div class="dv-s"></div><div class="dv-sp"></div></div>`).join(''); else host.classList.add('upd');
  cards.forEach((c,i)=>{ const el=host.children[i]; el.querySelector('.dv-l').textContent=c.l; el.querySelector('.dv-v').className='dv-v '+(c.c||''); morphNum(el.querySelector('b'), c.v, c.f, 1000); el.querySelector('small').textContent=c.suf||''; el.querySelector('.dv-s').innerHTML=c.s; const sp=el.querySelector('.dv-sp');
    if(c.meter){ sp.innerHTML=`<div class="dv-meter"><i class="${c.c==='bad'?'bad':''}"></i><em style="left:${(100*c.meter.t).toFixed(1)}%" title="days elapsed"></em></div><div class="dv-mk"><span>MTD <b>${n0(c.meter.mtd)}</b> / ${n0(c.meter.monthTarget)}</span><span>proj. <b>${n0(c.meter.proj)}</b></span></div>`; const bar=sp.querySelector('i'); const wv=(100*c.meter.f).toFixed(1)+'%'; if(MOTION_OK()) requestAnimationFrame(()=>requestAnimationFrame(()=>{ bar.style.width=wv; })); else bar.style.width=wv; }
    else sp.innerHTML=dvSpark(c.sp, c.col, sp.clientWidth); });
  renderDayStrip(); }
