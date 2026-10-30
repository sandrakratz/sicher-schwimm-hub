/** Registriert den Service Worker (Push und Offline-Nutzung). Mehrfaches Aufrufen ist unschädlich. */
export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    /* ohne Service Worker läuft alles online weiter */
  }
}

/** Leert den zwischengespeicherten Seitenrahmen (beim Abmelden). */
export async function clearShellCache() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    reg?.active?.postMessage("clear-shell");
  } catch {
    /* ignorieren */
  }
}
