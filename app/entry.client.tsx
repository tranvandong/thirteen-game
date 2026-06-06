import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

let deferredPrompt: Event | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  console.log("[PWA] beforeinstallprompt captured in entry.client ✅");
  e.preventDefault();
  deferredPrompt = e;
});

export function getInstallPrompt() {
  return deferredPrompt;
}
export function clearInstallPrompt() {
  deferredPrompt = null;
}

// Service Worker
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
      });
  } else {
    // Xóa SW và cache cũ trong môi trường dev
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });

    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
