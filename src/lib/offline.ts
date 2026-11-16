/** Cache names shared with public/sw.js. */
export const apiCache = "mise-api-v1";
export const imageCache = "mise-images-v1";

/** Removes saved recipes and images so the next person on this device can't read them. */
export const clearOfflineData = async () => {
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
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  });
};
