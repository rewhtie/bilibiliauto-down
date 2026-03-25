import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, ExpirationPlugin } from "serwist";

const SW_BYPASS_HOSTS = new Set([
  "pagead2.googlesyndication.com",
  "www.googletagmanager.com",
]);

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
        // Cache FFmpeg WASM files from CDN
        matcher: ({ url }) => url.hostname === "unpkg.com" || url.hostname === "cdn.jsdelivr.net",
        handler: new CacheFirst({
            cacheName: "ffmpeg-wasm-cache",
            plugins: [
                new ExpirationPlugin({
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                }),
            ],
        }),
    }
  ],
});

// Let the browser handle Google Ads and Analytics scripts directly.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (SW_BYPASS_HOSTS.has(url.hostname)) {
    event.stopImmediatePropagation();
  }
});

serwist.addEventListeners();
