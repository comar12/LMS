"""Make the hosted build: hide the offline upload tools, add phone home-screen metadata, and drop
the vendored SheetJS (only used by those tools) and the import-source copy of the data; the page
renders from __TSX_BASELINE__ + __TSX_MANIFEST__."""
import json, sys
src, out = sys.argv[1], sys.argv[2]
L = open(src).read().split('\n')
i = next(n for n, l in enumerate(L) if l.startswith('window.__TSX_INITIAL__='))
s = next(n for n, l in enumerate(L) if l.startswith('/*! xlsx.js'))
assert s < i and all(not l.startswith('window.__') for l in L[s:i])
rev = json.loads(L[i][len('window.__TSX_INITIAL__='):].rstrip().rstrip(';'))['revision']
L[i] = 'window.__TSX_INITIAL__=' + json.dumps({'revision': rev}) + ';'
L[s:i] = ['/* SheetJS omitted in the hosted build: data uploads are done in the offline file. */']
html = '\n'.join(L)
marker = '</style></head>'
assert html.count(marker) == 1
html = html.replace(marker, '</style>\n<style>/* Hosted (shared) build: viewers only read the snapshot; data uploads happen in the offline file. */\n'
    '.offline-tools{display:none!important}</style>\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="TSX Dashboard">\n</head>')
open(out, 'w').write(html)
