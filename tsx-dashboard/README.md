# TSX Performance Command Center — hosted build

The phone-friendly, read-only version of the TSX dashboard served on Vercel.

This repository is public, so the page (which holds agent names and KPIs) is only committed
encrypted as `bundle.enc`. Vercel decrypts it at build time with the `TSX_BUNDLE_KEY`
environment variable (`unpack.js`) and serves `public/index.html`.

## Monthly / weekly update

Inputs: the offline dashboard (`TSX_Performance_Command_Center_OFFLINE.html`, which carries the
roster) and the fiscal-month performance export (`data_XX.xlsx`, Call_Center = VXI Global - Cairo).

```sh
# 1. Export -> records. AS_OF = last day of data (check TM Lines Pacing: sold / pacing x 30 = days elapsed).
python3 tools/parse_export.py data_XX.xlsx AS_OF source.json
# 2. Rebuild the snapshot with the dashboard's own scoring code. FROM = fiscal month start (the 22nd).
node tools/build.mjs OFFLINE.html source.json offline.html FROM AS_OF data_XX.xlsx REVISION
# 3. Hosted build: hide upload tools, drop the Excel importer, minify (needs `npm i esbuild`).
python3 tools/slim.py offline.html hosted.html
node tools/minify.mjs hosted.html hosted.min.html
# 4. Encrypt with the same key as the Vercel project, commit bundle.enc and push.
node tools/pack.mjs hosted.min.html KEY_FILE bundle.enc
```

`offline.html` from step 2 is also the updated offline dashboard for laptops (it keeps the upload
buttons). Use a new REVISION string each time so browsers drop any older locally saved data.
