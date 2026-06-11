const CACHE_VERSION = "tripsplit-pwa-v2";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const scopeUrl = new URL(self.registration.scope);
const shellUrls = [
    "",
    "index.html",
    "summary.html",
    "plan.html",
    "2026-shimanami.html",
    "select-sheet.html",
    "offline.html",
].map((path) => new URL(path, scopeUrl).toString());
const offlineUrl = new URL("offline.html", scopeUrl).toString();
const appUrl = new URL("", scopeUrl).toString();

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(APP_SHELL_CACHE)
            .then((cache) => cache.addAll(shellUrls))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
                        .map((cacheName) => caches.delete(cacheName)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const requestUrl = new URL(request.url);

    if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }

    if (
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker" ||
        request.destination === "image" ||
        requestUrl.pathname.includes("/_next/static/")
    ) {
        event.respondWith(staleWhileRevalidate(request));
    }
});

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch {
        const cachedResponse = await caches.match(request);
        return cachedResponse || caches.match(appUrl) || caches.match(offlineUrl);
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    const networkResponsePromise = fetch(request)
        .then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
        })
        .catch(() => cachedResponse);

    return cachedResponse || networkResponsePromise;
}
