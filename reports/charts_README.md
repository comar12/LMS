# charts.js — inline-SVG chart library for the executive sales dashboard

Dependency-free, plain ES2020, no build step. Include with `<script src="charts.js"></script>`
(or inline it); everything lives on `window.Charts`. ~46 KB unminified.

## Host contract

* **Colours** come only from CSS custom properties the host page defines:
  `--s1…--s5` (series), `--other`, `--good`, `--bad`, `--warn`, `--text`, `--muted`,
  `--line`, `--grid`, `--card`, `--soft`, `--heat1…--heat7`. Marks use `var(--x)`; text uses `--text`/`--muted` only.
  A series `color` may be a token name (`'s3'`, `'warn'`) or any CSS colour string.
* **Sizing**: charts use the container's `clientWidth` (fallback 600 when hidden/0) and a `height` option,
  rendered as a `viewBox` SVG at `width:100%`, so they rescale with the card. Font family is inherited from the container.
  The container's contents are replaced on every render; put legends/tables outside it.
* **Tooltips**: pass `tip(x, y, title, items)` and `hideTip()`; `x, y` are viewport (client) coordinates,
  `items = [{label, value, color?}]`. Line-type charts use a crosshair snapped to the nearest x;
  bars/dots/cells have per-mark hit areas ≥ 24 px. Insert labels with `textContent` (they are untrusted data).
* **Every chart returns** `{ tableView(): string[][], destroy() }` (first row is the header; values are formatted)
  and, for multi-series charts, `series: [{name, color, kind}]` (`kind`: `line | dashed | area | bar | dot`) so the host can render a legend.
  `calendar`/`heatmap` also return `scale: {min, max, colors}` for a scale legend.
* **Animation**: every entrance is a finite Web Animation created synchronously inside the render call (`fill: backwards`,
  staggered by `delay`), so a host can pause an off-screen chart straight after rendering with
  `container.getAnimations({subtree: true}).forEach(a => a.pause())` and `.play()` them when it scrolls into view.
  Gridlines and axis labels fade in first (250 ms), then the data; each chart settles within ~1.2 s and no stagger spans
  more than 450 ms, whatever the mark count. Lines draw left to right on one shared clock (markers, extreme labels and the
  gradient area wash follow the pen; end dots land with their line, then give two soft halo pulses, the one accent that
  runs to ~2.4 s; end labels come last). Columns grow left to right (stacks fill bottom-up), bullets grow row by row with
  the target tick dropping in after, waterfall steps cascade with their connectors, calendar/heatmap cells ripple in
  diagonally, scatter dots pop in x order after the reference lines draw, slope lines draw with a stagger, cumulative
  target and actual draw together with the projection carrying on, small multiples draw cell by cell, histogram bins grow
  in turn, and the gauge sweeps with its figure counting in step before a rounded end-cap pops. Hovering a column, bar,
  waterfall step, histogram bin or bullet row dims the other categories to 40 % (150 ms); crosshair points enlarge to
  r 5.5. Honoured `prefers-reduced-motion` skips all motion (that transition included); the static render is complete on
  its own. Re-rendering into the same container cancels the previous entrance and replays it with the new data.
* Formatting: `format`/`yFormat` is `(value) => string`; default `Charts.format` compacts to `1.2K / 3.4M`.

## API (all take `(el, opts)` unless noted; common opts: `height`, `tip`, `hideTip`, `format`)

| Function | Key options |
|---|---|
| `line` | `labels`, `series:[{name, values, color?, area?, markers?, dash?}]`, `target?`, `targetLabel?`, `volume?` (+`volumeLabel`), `yFormat`, `pctAxis?`, `weekendShade?` (ISO labels), `labelExtremes?`. Nulls are gaps; end labels get leader lines when pushed apart. |
| `columns` | `cats`, `series:[{name, values, color?}]`, `stacked?`, `highlightMax?` (single series), `target?`, `valueLabels:'max'|'all'|'none'`, `yFormat`. Labels that would collide are dropped to the tooltip. |
| `bullet` | `rows:[{label, value, target?, max?, sub?}]`, `rowHeight` (34). Bar is `--good`/`--bad` vs target, `--s1` without one; target tick `--warn`. |
| `slope` | `items:[{label, from, to}]`, `fromLabel`, `toLabel`. Up `--good`, down `--bad`, flat `--muted`; labels pushed apart ≥ 13 px. |
| `scatter` | `points:[{label, x, y, size?, group?, labelled?}]`, `xLabel`, `yLabel`, `xRef?`, `yRef?`, `quadrantLabels?:[tl,tr,bl,br]`, `xFormat`, `yFormat`, `sizeLabel?`. Up to 3 groups → `--s1/--s2/--s3`. |
| `calendar` | `days:[{date:'YYYY-MM-DD', value}]`, `weekStart` (1 = Mon), `label?`. Weeks as columns, month labels on top, `--heat1…7` by value, zero/empty days `--soft`. Height is derived from the cell size. |
| `heatmap` | `rows`, `cols`, `values:[[…]]`, `label?`. Cell text only when cells are ≥ 36×16 px. |
| `waterfall` | `start:{label, value}`, `steps:[{label, delta}]`, `end:{label}`. Totals `--s1`, deltas `--good`/`--bad`, hairline connectors. |
| `cumulative` | `labels`, `actual`, `target` (cumulative), `projection?` (dashed). Gap between actual and target shaded `--good`/`--bad`. |
| `sparkline(values, {width, height, color, endDot})` | Returns an SVG **string** for inline use in tables. |
| `donutGauge` | `value`, `max`, `label`, `color?` (default `--s1`; pass `'good'`/`'bad'`). 180° arc with sweep and counted-up centre figure. |
| `smallMultiples` | `items:[{title, labels, values, target?}]`, `columns` (4), `cellHeight`. One shared y-scale; ticks labelled in the first column. |
| `histogram` | `values`, `bins` (nice edges, so the count is approximate), `xLabel`, `markers?:[{value, label}]`. |
| `countUp(el, to, {duration, format, from})` | Animates a DOM element's text; sets the final value under reduced motion. |
| `niceTicks(min, max, n)`, `format(v)` | Shared helpers, exported for host use (e.g. scale legends, stat tiles). |

## Example

```js
const chart = Charts.line(document.getElementById('bookings'), {
  labels: days, series: [{ name: 'Bookings', values, area: true }, { name: 'Last year', values: ly, color: 's3', dash: true }],
  target: 55000, volume: deals, weekendShade: true, labelExtremes: true, yFormat: v => '€' + Charts.format(v),
  height: 300, tip: showTip, hideTip
});
renderLegend(chart.series); renderTable(chart.tableView());
```
