import { clearOutbox } from "@/lib/outbox";

/** Cache names shared with public/sw.js. */
export const apiCache = "mise-api-v1";
export const imageCache = "mise-images-v1";

/** Removes saved recipes and images so the next person on this device can't read them. */
export const clearOfflineData = async () => {
  clearOutbox();
  try {
    if (!("caches" in window)) return;
    await Promise.all([caches.delete(apiCache), caches.delete(imageCache)]);
  } catch {
    // Nothing else to clear.
  }
};

export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    // The version query skips any copy a CDN cached before sw.js was marked
    // no-cache; bump it only if that ever happens again.
    navigator.serviceWorker.register("/sw.js?v=2").catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  });
};
