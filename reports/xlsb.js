/* ---------------------------------------------------------------- in-browser .xlsb reader (zip + BIFF12 records, no libraries) */
async function unzipBin(buf){ const dv=new DataView(buf), u8=new Uint8Array(buf); let e=-1; for (let i=u8.length-22; i>=Math.max(0,u8.length-70000); i--){ if (dv.getUint32(i,true)===0x06054b50){ e=i; break; } } if (e<0) throw new Error('Not an Excel file (zip directory not found)');
  const count=dv.getUint16(e+10,true); let p=dv.getUint32(e+16,true); const files={}; for (let k=0;k<count;k++){ if (dv.getUint32(p,true)!==0x02014b50) break; const method=dv.getUint16(p+10,true), csize=dv.getUint32(p+20,true), nlen=dv.getUint16(p+28,true), elen=dv.getUint16(p+30,true), clen=dv.getUint16(p+32,true), loff=dv.getUint32(p+42,true); const name=new TextDecoder().decode(u8.subarray(p+46,p+46+nlen)); files[name]={method,csize,loff}; p+=46+nlen+elen+clen; }
  const bytes=async name=>{ const f=files[name]; if(!f) return null; const q=f.loff; const nlen=dv.getUint16(q+26,true), elen=dv.getUint16(q+28,true); const data=u8.subarray(q+30+nlen+elen, q+30+nlen+elen+f.csize); if (f.method===0) return data.slice(); const ds=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(ds).arrayBuffer()); };
  const text=async name=>{ const b=await bytes(name); return b? new TextDecoder().decode(b) : null; };
  return {names:Object.keys(files), bytes, text}; }
/* walk BIFF12 records: cb(type, offset, size) */
function biffWalk(u8, cb){ let p=0; const n=u8.length; while(p<n){ let t=u8[p++]; if(t&0x80){ t=(t&0x7f)|((u8[p++]&0x7f)<<7); } let sz=0, sh=0; for(let k=0;k<4;k++){ const b=u8[p++]; sz|=(b&0x7f)<<sh; sh+=7; if(!(b&0x80)) break; } if(cb(t,p,sz)===false) return; p+=sz; } }
function biffWide(dv, u8, o){ const cch=dv.getUint32(o,true); if(cch===0xFFFFFFFF) return [null,o+4]; let s=''; const end=o+4+cch*2; for(let q=o+4;q<end;q+=2) s+=String.fromCharCode(u8[q]|(u8[q+1]<<8)); return [s,end]; }
const _rkBuf=new DataView(new ArrayBuffer(8));
function biffRk(v){ let x; if(v&2){ x=v>>2; } else { _rkBuf.setUint32(0,0,true); _rkBuf.setUint32(4,v&0xFFFFFFFC,true); x=_rkBuf.getFloat64(0,true); } return (v&1)? x/100 : x; }
/* read named sheets as arrays of rows; cols (optional) limits which columns are kept per sheet */
async function readXlsb(buf, want, cols){ const z=await unzipBin(buf); const wbB=await z.bytes('xl/workbook.bin'); if(!wbB) throw new Error('Not an .xlsb workbook');
  const relsTxt=await z.text('xl/_rels/workbook.bin.rels'); const rel={}; for(const m of relsTxt.matchAll(/<Relationship\b[^>]*>/g)){ const id=/Id="([^"]+)"/.exec(m[0]), tg=/Target="([^"]+)"/.exec(m[0]); if(id&&tg) rel[id[1]]=tg[1]; }
  const dvW=new DataView(wbB.buffer,wbB.byteOffset,wbB.byteLength); const sheetsMeta=[]; biffWalk(wbB,(t,o)=>{ if(t===156){ const [rid,o2]=biffWide(dvW,wbB,o+8); const [name]=biffWide(dvW,wbB,o2); sheetsMeta.push({name,target:rel[rid]}); } });
  const sst=[]; const ssB=await z.bytes('xl/sharedStrings.bin'); if(ssB){ const dv=new DataView(ssB.buffer,ssB.byteOffset,ssB.byteLength); biffWalk(ssB,(t,o)=>{ if(t===19){ sst.push(biffWide(dv,ssB,o+1)[0]); } }); }
  const out={names:sheetsMeta.map(s=>s.name)};
  for(const sm of sheetsMeta){ if(want && !want.includes(sm.name)) continue; let tg=(sm.target||'').replace(/^\//,''); if(!tg.startsWith('xl/')) tg='xl/'+tg; const b=await z.bytes(tg); if(!b) continue; const dv=new DataView(b.buffer,b.byteOffset,b.byteLength); const keep=cols&&cols[sm.name]; const kset=keep?new Set(keep):null; const rowsArr=[]; let cur=null;
    biffWalk(b,(t,o,sz)=>{ if(t===0){ cur=[]; rowsArr[dv.getUint32(o,true)]=cur; return; } if(t<1||t>11||!cur) return; const c=dv.getUint32(o,true); if(kset&&!kset.has(c)) return; const v=o+8; let val=null;
      switch(t){ case 2: val=biffRk(dv.getUint32(v,true)); break; case 3: case 11: val=null; break; case 4: case 10: val=!!b[v]; break; case 5: case 9: val=dv.getFloat64(v,true); break; case 6: case 8: val=biffWide(dv,b,v)[0]; break; case 7: val=sst[dv.getUint32(v,true)]??null; break; default: val=null; }
      cur[c]=val; });
    out[sm.name]=Array.from(rowsArr,r=>r||[]); }
  return out; }

/* ---------------------------------------------------------------- TSX handover -> calls per agent per business day (same rules as calls_data.py) */
const CALL_SHIFT=[14,15,16,17,18,19,20,21,22,23,0,1,2,3,4,5,6,7];
function parseHandover(sh, name, lob='EG TSX 4P'){ const da=sh['D-Agent']; if(!da||!da.length) throw new Error(`${name}: no "D-Agent" sheet – is this the TSX handover?`);
  /* calls are summed from the D-Agent interval table exactly as the handover's "Performance per OM" sheet does:
     Handled Calls, IN THT and TRANSFERRED per row, attributed by the table's HRID column; repeated-looking rows are separate calls */
  const ix={}; (da[0]||[]).forEach((h,i)=>{ if(h!=null&&h!=='') ix[String(h).trim()]=i; });
  const miss=['Date','Time','Handled Calls','IN THT','TRANSFERRED','HRID','LOB'].filter(n=>ix[n]==null); if(miss.length) throw new Error(`${name}: D-Agent is missing ${miss.join(', ')}`);
  const num=v=>typeof v==='number'&&isFinite(v)?v:0; const acc={}; let day=null;
  for(const r of da){ if(!r||typeof r[ix['Date']]!=='number') continue; if(lob&&String(r[ix['LOB']]??'').trim()!==lob) continue; const hv=r[ix['HRID']]; const hr=typeof hv==='number'?String(Math.trunc(hv)):String(hv??'').trim(); if(!hr||hr==='-'||hr==='0') continue;
    if(day==null) day=r[ix['Date']]; const h=num(r[ix['Handled Calls']]); const o=acc[hr] ||= {h:0,tht:0,tr:0,hours:new Array(CALL_SHIFT.length).fill(0)}; o.h+=h; o.tht+=num(r[ix['IN THT']]); o.tr+=num(r[ix['TRANSFERRED']]);
    if(h){ const cairo=(Math.floor(num(r[ix['Time']])*24+1e-6)+7)%24; const si=CALL_SHIFT.indexOf(cairo); if(si>=0) o.hours[si]+=h; } }
  if(day==null) throw new Error(`${name}: no ${lob} rows with a date in D-Agent`);
  const iso=new Date(Date.UTC(1899,11,30)+Math.trunc(day)*86400000).toISOString().slice(0,10);
  const a=[]; for(const [hr,o] of Object.entries(acc)) if(o.h) a.push([hr, Math.trunc(o.h), Math.trunc(o.h), Math.floor(o.tht/o.h+0.5), Math.trunc(o.tr), o.hours]);
  return {date:iso, src:name, a}; }
