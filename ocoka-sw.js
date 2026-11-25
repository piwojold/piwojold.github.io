// OCOKA Planer – zapis strony i podkładów mapowych do pracy bez internetu
const PAGE = 'ocoka-page-v1', TILES = 'ocoka-tiles-v1', MAXT = 5000;
const noCors = new Set();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
async function trim() {
  const c = await caches.open(TILES), k = await c.keys();
  if (k.length > MAXT) for (const r of k.slice(0, 600)) await c.delete(r);
}
async function tile(req) {
  const c = await caches.open(TILES), hit = await c.match(req.url);
  if (hit) return hit;
  const host = new URL(req.url).host;
  let res = null;
  if (!noCors.has(host)) { try { res = await fetch(req.url, { mode: 'cors', credentials: 'omit' }); } catch (e) { noCors.add(host); } }
  if (!res) res = await fetch(req.url, { mode: 'no-cors', credentials: 'omit' });
  if (res.ok || res.type === 'opaque') { c.put(req.url, res.clone()).then(trim).catch(() => {}); }
  return res;
}
async function page(req) {
  const c = await caches.open(PAGE);
  try { const res = await fetch(req); if (res.ok) c.put(req.url.split(/[?#]/)[0], res.clone()); return res; }
  catch (e) { const hit = await c.match(req.url.split(/[?#]/)[0]); if (hit) return hit; throw e; }
}
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) { if (r.mode === 'navigate' || /ocoka\.html$/.test(u.pathname)) e.respondWith(page(r)); return; }
  if (r.destination === 'image' || u.host === 'cdn.jsdelivr.net') e.respondWith(tile(r).catch(() => Response.error()));
});
