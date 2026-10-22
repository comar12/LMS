import re
SP='/tmp/claude-0/-home-user-LMS/7bc8d630-fb08-56ea-a055-12cb26b648f6/scratchpad/'
src=open(SP+'template_v2.html').read()
def between(a,b,s=src):
    i=s.index(a); j=s.index(b,i); return s[i:j]
head = src[:src.index('</style>')] + open(SP+'extra_v3.css').read() + '</style>\n</head>\n<body>\n'
body = open(SP+'body_v3.html').read()
data = between("const EMBEDDED = __DATA__;", "/* ---------------------------------------------------------------- compute */")
compute = between("/* ---------------------------------------------------------------- compute */", "/* ---------------------------------------------------------------- tooltip + charts */")
helpers_block = between("/* ---------------------------------------------------------------- tooltip + charts */", "/* ---------------------------------------------------------------- render */")
keep_prefixes = ("const tip=","function showTip","function hideTip","function heatStyle","const rankPill","const targetStatus","const miniTrack","const SERIES","function makeTable")
helpers = "/* ---- helpers ---- */\n" + "\n".join(l for l in helpers_block.splitlines() if l.startswith(keep_prefixes) or (l.startswith("  ") and False)) + "\n"
# makeTable spans multiple lines: take it fully
mt = between("function makeTable(", "/* ---------------------------------------------------------------- render */"); helpers = helpers.replace("function makeTable"+mt[len("function makeTable"):].split("\n")[0], "") if False else helpers
helpers = "/* ---- helpers ---- */\n" + "\n".join(l for l in helpers_block.splitlines() if l.startswith(("const tip=","function showTip","function hideTip","function heatStyle","const rankPill","const targetStatus","const miniTrack","const SERIES"))) + "\n" + mt
hist = between("/* ---------------------------------------------------------------- full-history insights */", "/* ---------------------------------------------------------------- in-browser .xlsx reader")
xlsx = between("/* ---------------------------------------------------------------- in-browser .xlsx reader", "function buildData(")
upload = between("function buildData(", "/* ---------------------------------------------------------------- custom pickers")
pickers = between("/* ---------------------------------------------------------------- custom pickers", "/* ---------------------------------------------------------------- wiring */")
wiring = src[src.index("/* ---------------------------------------------------------------- wiring */"):src.index("init();\n</script>")]
# --- modifications to wiring/pickers for v3
def rep(s,a,b):
    assert a in s, 'MISSING: '+a[:80]; return s.replace(a,b,1)
pickers = rep(pickers, "  for(const id of ['from','to']){ const e=document.getElementById(id); if(e){ e.min=META.minDate; e.max=META.maxDate; } }\n}",
 "  for(const id of ['from','to']){ const e=document.getElementById(id); if(e){ e.min=META.minDate; e.max=META.maxDate; } }\n  const lOpts=TLS.map(t=>({v:t,l:t,s:`HC ${roster.filter(a=>a.tl===t).length}`})); if(!state.leader||!TLS.includes(state.leader)) state.leader=TLS.includes('Omar Mansour')?'Omar Mansour':TLS[0]; if(PICKERS['pk-leader']){ PICKERS['pk-leader'].setOptions(lOpts); PICKERS['pk-leader'].setValue(state.leader); } else makePicker('pk-leader',{icon:'people',options:lOpts,value:state.leader,onChange:v=>{ state.leader=v; renderLeader(); }});\n}")
wiring = rep(wiring, "function showTab(k){ state.tab=k; document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('active',x.dataset.t===k)); document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='v-'+k)); renderAll(); }",
 "function showTab(k){ state.tab=k; document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('active',x.dataset.t===k)); document.querySelectorAll('.view').forEach(x=>{ const on=x.id==='v-'+k; x.classList.toggle('active',on); if(on){ x.classList.remove('active'); void x.offsetWidth; x.classList.add('active'); } }); dvSetView(); if(C) (VIEWS[k]||renderExec)(); else renderAll(); window.scrollTo({top:Math.max(0,document.querySelector('.control-panel').offsetTop-70),behavior:'smooth'}); }")
wiring = rep(wiring, "document.getElementById('leaderSel').innerHTML=''; document.getElementById('agentList').innerHTML='';", "document.getElementById('agentList').innerHTML='';")
wiring = rep(wiring, "document.getElementById('leaderSel').addEventListener('change',e=>{ state.leader=e.target.value; renderLeaderTrend(); }); document.getElementById('agentSel').addEventListener('change',e=>{ state.agent=e.target.value; renderAgentTrend(); });",
 "document.getElementById('agentSel').addEventListener('change',e=>{ state.agent=e.target.value; renderAgentTrend(); });")
wiring = rep(wiring, "for(const [k,l] of [['overview','Overview'],['leaders','Leaders'],['agents','Agents'],['insights','Insights'],['data','Data & settings']])", "for(const [k,l] of [['exec','Executive'],['om','Ops managers'],['leader','Team leaders'],['agents','Agents'],['calls','Calls & conversion'],['insights','Insights'],['data','Data & settings']])")
wiring = rep(wiring, "document.querySelectorAll('button[data-tv]').forEach(b=>b.addEventListener('click',()=>{ const fig=document.getElementById(b.dataset.tv); if(fig._tv) fig._tv(); }));", "document.querySelectorAll('button[data-tv]').forEach(b=>b.addEventListener('click',()=>toggleTable(b.dataset.tv)));")
wiring = rep(wiring, "document.getElementById('v-overview').classList.add('active');", "document.getElementById('v-exec').classList.add('active'); state.tab='exec';")
# state default tab
data = rep(data, "tab:'overview'", "tab:'exec'")
charts = open(SP+'charts/charts.js').read()
engine = open(SP+'engine.js').read()
render = open(SP+'motion.js').read() + '\n' + open(SP+'xlsb.js').read() + '\n' + open(SP+'calls.js').read() + '\n' + open(SP+'sync.js').read() + '\n' + open(SP+'hero.js').read() + '\n' + open(SP+'render_products.js').read() + '\n' + open(SP+'render_v3.js').read()
script = "<script>\n" + data + compute + helpers + "\n" + hist + "\n/* ---------------------------------------------------------------- chart library */\n" + charts + "\n" + engine + "\n" + render + "\n" + xlsx + upload + pickers + wiring + "init();\n</script>\n</body>\n</html>\n"
out = head + body + script
assert out.count('__DATA__')==1
open('/home/user/LMS/reports/dashboard_template.html','w').write(out)
print('assembled', len(out))
