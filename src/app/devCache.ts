export async function disableDevelopmentCaches() {
  if (!import.meta.env.DEV) return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => {
          console.info("[ForteStack] unregistering development service worker", registration.scope);
          return registration.unregister();
        }),
      );
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          console.info("[ForteStack] deleting development cache", cacheName);
          return caches.delete(cacheName);
        }),
      );
    }
  } catch (error) {
    console.warn("[ForteStack] development cache cleanup failed", getErrorMessage(error));
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}
