// service-worker.js
// ArtVault - Service Worker for Offline PWA Support

const CACHE_NAME = "artvault-cache-v1";

// Assets to cache immediately on installation
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/database.js",
  "./js/projects.js",
  "./js/folders.js",
  "./js/gallery.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon.svg",
  // Cache the Tailwind CSS Play CDN so compiling works completely offline!
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"
];

// 1. Install Event - Cache all static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching static assets");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event - Serve assets from cache first, fall back to network
self.addEventListener("fetch", (event) => {
  // We skip non-GET requests (e.g. Chrome extensions, database operations)
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Special handling for the dynamically generated icons
  // They are stored in cache by the main application thread on first run.
  // The SW will find them in the cache and serve them immediately.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Only cache valid successful responses from our own origin or Tailwind CDN
        const isSuccessful = networkResponse && networkResponse.status === 200;
        const isLocal = url.origin === self.location.origin;
        const isTailwind = url.href.includes("tailwindcss");

        if (isSuccessful && (isLocal || isTailwind)) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }

        return networkResponse;
      }).catch((err) => {
        // Offline fallback
        console.error("[Service Worker] Fetch failed and asset not in cache:", err);
        
        // If it's a page navigation request, return cached index.html as a fallback
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
        
        return null;
      });
    })
  );
});
