// Service worker: guarda o app e as bibliotecas para funcionar offline.
const VERSAO = 'pel-v10';
const BASE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './pdf.min.js', './pdf.worker.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// comprovante compartilhado pelo app do banco (Android): guarda e abre o app
function guarda(k, v) {
  return new Promise((ok, er) => {
    const r = indexedDB.open('qaj', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arq');
    r.onerror = () => er(r.error);
    r.onsuccess = () => { const t = r.result.transaction('arq', 'readwrite'); t.objectStore('arq').put(v, k); t.oncomplete = ok; t.onerror = () => er(t.error); };
  });
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/compartilhar')) {
    e.respondWith((async () => {
      try { const fd = await req.formData(), f = fd.getAll('comprovante').find(x => x && x.size); if (f) await guarda('compartilhado', { file: f, em: Date.now() }); } catch (err) {}
      return Response.redirect(new URL('./?compartilhado=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co')) return; // dados: sempre pela rede
  if (url.origin === location.origin) {
    // o app: tenta a rede (para pegar atualizações) e cai no cache sem internet
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // bibliotecas e fontes (CDN): cache primeiro
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(VERSAO).then(x => x.put(req, c)); }
    return res;
  })));
});
