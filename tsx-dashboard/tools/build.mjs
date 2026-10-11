// Rebuild the embedded TSX snapshot from a parsed export, using the dashboard's own modules.
import fs from "node:fs";
import vm from "node:vm";

const [htmlPath, sourcePath, outPath, from, to, filename, revision] = process.argv.slice(2);
const html = fs.readFileSync(htmlPath, "utf8");
const lines = html.split("\n");
const find = (prefix) => lines.findIndex((l) => l.startsWith(prefix));
const iInit = find("window.__TSX_INITIAL__="), iBase = find("window.__TSX_BASELINE__="), iMan = find("window.__TSX_MANIFEST__=");
const parse = (i, p) => JSON.parse(lines[i].slice(p.length).replace(/;\s*$/, ""));
const initial = parse(iInit, "window.__TSX_INITIAL__=");

const start = html.indexOf("const modules={"), end = html.indexOf("}};const cache={};", start);
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(html.slice(start, end + 2) + `;const cache={};function require(id){if(cache[id])return cache[id];const e={};cache[id]=e;modules[id](e,require);return e;};globalThis.req=require;`, ctx);
const { buildImported, fiscalLabel } = ctx.req("src/data/workbook.js");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const asOf = source.dates.at(-1);
const built = buildImported(source, initial.roster, asOf, asOf, filename);
const m = built.manifest;
const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
m.period = { from, to };
const fiscal = fiscalLabel(to);
m.periodNote = `${from} to ${to} · ${fiscal} · month-to-date (${days} days)`;
m.asOfEvidence = `Fiscal-month export (Call_Center VXI Global - Cairo). Data through ${to} (day ${days} of the fiscal month), inferred from TM Lines Pacing in the file.`;
m.source.updatedAt = new Date().toISOString();
m.provenance = m.provenance.map((p) => p
  .replace(/^Daily t-NPS is survey-weighted\..*$/, "The export is one fiscal-month-to-date row per agent; KPIs are shown exactly as reported. Team t-NPS is survey-weighted; team and LOB aICR/GSR are the mean of available agent results.")
  .replace(/^Only selected dated columns.*$/, "Fiscal-month columns are used once; the export's Total columns are never added again. Agents absent from the export keep their roster identity with Missing KPIs.")
  .replace(/^Workbook processing.*$/, `Roster: ${initial.roster.source?.filename || "TSX Updated Roster.xlsx"} (unchanged). Performance export: ${filename}, ${fiscal} month to date.`));

const out = { ...initial, revision, source, filename, from: asOf, to: asOf, raw: built.raw, manifest: m };
const j = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
lines[iInit] = `window.__TSX_INITIAL__=${j(out)};`;
lines[iBase] = `window.__TSX_BASELINE__=${j(built.raw)};`;
lines[iMan] = `window.__TSX_MANIFEST__=${j(m)};`;
fs.writeFileSync(outPath, lines.join("\n"));
console.log(JSON.stringify(built.raw.summary), "\nunmapped", built.unmapped.length);
