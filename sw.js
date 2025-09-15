const CACHE_NAME = "planer-cache-2.0(0)";
const FILES_TO_CACHE = [
    "/",          // Startseite
    "/index.html",
    "/style.css",
    "/script.js",
    "/offline.html"
];

// Installation: Wichtige Dateien cachen
self.addEventListener("install", (event) => {
    console.log("[SW] Installiert");
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
    );
    self.skipWaiting();
});

// Aktivierung: Alte Caches löschen + Update melden
self.addEventListener("activate", (event) => {
    console.log("[SW] Aktiviert");
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
        )
    );
    self.clients.claim();

    // Signal an Clients: "Update bereit"
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
            client.postMessage({ type: "UPDATE_READY" });
        });
    });
});

// Fetch: Netzwerk bevorzugt, Fallback Cache
self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return; // Nur GET cachen

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Antwort cachen (stets neu)
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                return response;
            })
            .catch(() => caches.match(event.request).then((cached) => {
                return cached || caches.match("/offline.html");
            }))
    );
});
