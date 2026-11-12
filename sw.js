/* 跟诊录 · Service Worker
   预缓存全部文件，离线可用。改动文件后请把 VERSION 加一。 */
var VERSION = 'v2';
var CACHE = 'genzhenlu-' + VERSION;

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/db.js',
  './js/catalog.js',
  './js/app.js',
  './data/herbs.json',
  './data/patent.json',
  './data/western.json',
  './data/acupoints.json',
  './data/acupoints_pinyin.json',
  './data/units.json',
  './data/decoctions.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 页面、脚本、样式：网络优先，离线时回退缓存（保证改版后能拿到新代码）
  var isShell = req.mode === 'navigate' || /\.(js|css|webmanifest)$/.test(url.pathname) ||
    url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if (isShell) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 数据、图标：缓存优先，后台更新
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () { });
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return new Response('离线且未缓存', { status: 504 });
      });
    })
  );
});
