self.options = {
    "domain": "5gvci.com",
    "zoneId": 11098917
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')

const CACHE_NAME = 'straykin-images-cache-v1';

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Cache images: check if the request is an image or if the url has an image extension
  // Often Firestore/Cloud Storage images don't have typical extensions in the URL path, 
  // so we also rely on the request destination.
  if (event.request.destination === 'image' || 
      requestUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/i) ||
      requestUrl.hostname.includes('firebasestorage.googleapis.com')) {
    
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // If we have a cached version, return it
        if (cachedResponse) {
          // Optional: we can still fetch in the background to keep the cache fresh (stale-while-revalidate)
          // But for offline support, returning the cached item is the priority
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
           // In a full implementation, you could return a default offline placeholder image here.
        });
      })
    );
  }
});