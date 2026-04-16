import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist, NetworkOnly } from "serwist";

declare const self: typeof globalThis & {
  __SW_MANIFEST: (string | PrecacheEntry)[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Match any request that looks like an API call (POST/PUT/DELETE or specific headers)
      // or simply rely on the fact that we don't want to cache anything from our API base URL
      matcher: ({ url, request }) => 
        request.method !== "GET" || 
        url.pathname.includes("/api/") ||
        url.hostname.includes("supabase.co"), // Don't cache Supabase calls either    
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});
serwist.addEventListeners();
