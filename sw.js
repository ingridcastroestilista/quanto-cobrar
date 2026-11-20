// Guarda o app no celular para abrir sem internet.
// Ao publicar uma versão nova, mude VERSAO para o celular baixar os arquivos novos.
const VERSAO = 'qc-v11';
const ARQUIVOS = [
  './', 'index.html', 'css/app.css', 'js/app.js', 'js/calc.js', 'js/store.js', 'js/ui.js', 'js/proposta.js', 'js/acesso.js', 'js/moeda.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

// Só apaga caches deste app: no GitHub Pages os dois apps dividem o mesmo endereço base.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('qc-') && k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Arquivos do app: usa a internet quando tem (pega atualizações) e o cache quando não tem.
// Fontes do Google: cache primeiro.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin.includes('fonts.g')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
      const copia = res.clone();
      caches.open(VERSAO).then((c) => c.put(req, copia));
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Sempre confere com o site se o arquivo mudou, para a versão nova chegar inteira.
  e.respondWith(
    fetch(req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' })).then((res) => {
      const copia = res.clone();
      caches.open(VERSAO).then((c) => c.put(req, copia));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
