self.options = {
    "domain": "5gvci.com",
    "zoneId": 11098917
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')

const CACHE_NAME = 'straykin-assets-cache-v3';

const AD_FILES = [
  '/',
  '/index.html',
  '/ad-160x600.html',
  '/ad-300x250.html',
  '/ad-728x90.html',
  '/ad-inpage.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(AD_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('straykin-')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  if (event.request.destination === 'document' && requestUrl.pathname.startsWith('/ad-')) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
             return cachedResponse || fetch(event.request);
        })
      );
      return;
  }

  // Cache JS, CSS or HTML files
  if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.destination === 'document') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate for JS/CSS
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
            // When offline and navigating, return index.html for SPA as a fallback
            if (event.request.destination === 'document') {
                return caches.match('/index.html');
            }
        });
      })
    );
    return;
  }

  // Cache map tiles, images
  if (event.request.destination === 'image' || 
      requestUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/i) ||
      requestUrl.hostname.includes('firebasestorage.googleapis.com') ||
      requestUrl.hostname.includes('bunnycdn.com') ||
      requestUrl.hostname.includes('b-cdn.net') || 
      requestUrl.hostname.includes('tile.openstreetmap.org')) {
    
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // If we have a cached version, return it
        if (cachedResponse) {
          // Fetch and update occasionally
          if (!requestUrl.hostname.includes('tile.openstreetmap.org')) {
            fetch(event.request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                 caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
              }
            }).catch(() => {});
          }
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          // We also cache opaque responses (status === 0), typical for cross-origin without CORS
          if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
            return networkResponse;
          }

          // Clone the response because it's a stream and can only be consumed once
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
           // Fetch failed (e.g. offline) and no cache found. 
        });
      })
    );
  }
});