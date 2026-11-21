(function () {
  'use strict';

  var SHELL_CACHE = 'typing-master-v15';
  var RUNTIME_CACHE = 'typing-master-runtime-v1';

  var PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/data-ko.js',
    './js/data-en.js',
    './js/keyboard-config.js',
    './js/ime-evaluator.js',
    './js/mobile-viewport.js',
    './js/profile-store.js',
    './js/firebase-sync.js',
    './js/components/keyboard-view.js',
    './js/components/profile-modal.js',
    './js/components/dashboard-modal.js',
    './js/modes/position-mode.js',
    './js/modes/text-practice-mode.js',
    './js/modes/dictation-mode.js',
    './js/modes/acid-rain-mode.js',
    './js/app.js',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
  ];

  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches.open(SHELL_CACHE).then(function (cache) {
        return cache.addAll(PRECACHE_ASSETS);
      }).then(function () {
        return self.skipWaiting();
      })
    );
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) {
              return caches.delete(key);
            }
          })
        );
      }).then(function () {
        return self.clients.claim();
      })
    );
  });

  self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;

    var url = new URL(req.url);
    if (
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('firebaseapp.com')
    ) {
      return;
    }
    var isSameOrigin = url.origin === self.location.origin;

    if (isSameOrigin) {
      if (req.mode === 'navigate') {
        event.respondWith(
          fetch(req).then(function (resp) {
            if (resp && resp.status === 200) {
              var clone = resp.clone();
              caches.open(SHELL_CACHE).then(function (cache) {
                cache.put(req, clone);
              });
            }
            return resp;
          }).catch(function () {
            return caches.match(req).then(function (cached) {
              return cached || caches.match('./index.html');
            }).then(function (fallback) {
              return fallback || new Response('', { status: 503, statusText: 'Offline' });
            });
          })
        );
        return;
      }

      event.respondWith(
        caches.match(req).then(function (cached) {
          var networkUpdate = fetch(req).then(function (resp) {
            if (resp && resp.status === 200) {
              var clone = resp.clone();
              caches.open(SHELL_CACHE).then(function (cache) {
                cache.put(req, clone);
              });
            }
            return resp;
          }).catch(function () {
            return null;
          });

          if (cached) {
            event.waitUntil(networkUpdate);
            return cached;
          }

          return networkUpdate.then(function (resp) {
            if (resp) return resp;
            return new Response('', { status: 503, statusText: 'Offline' });
          });
        })
      );
      return;
    }

    // External assets (e.g. Pretendard webfont CDN)
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) {
          return cached;
        }
        return fetch(req).then(function (resp) {
          if (resp && (resp.status === 200 || resp.type === 'opaque')) {
            var clone = resp.clone();
            caches.open(RUNTIME_CACHE).then(function (cache) {
              cache.put(req, clone);
            });
          }
          return resp;
        }).catch(function () {
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    );
  });
})();
