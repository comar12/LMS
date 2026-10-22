import { put, get, list, del } from '@vercel/blob';
import { handlers } from '../lib/store.js';

const blob = {
  async read(pathname) {
    const r = await get(pathname, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return JSON.parse(await new Response(r.stream).text());
  },
  async write(pathname, obj) {
    await put(pathname, JSON.stringify(obj), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  },
  async list(prefix) {
    const out = []; let cursor;
    do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
    return out;
  },
  async remove(pathname) { await del(pathname); },
};

const h = handlers(blob);
export const GET = req => h.GET(req);
export const POST = req => h.POST(req);
export const DELETE = req => h.DELETE(req);
