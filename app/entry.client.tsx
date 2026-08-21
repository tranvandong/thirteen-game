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

// Service Worker — BẮT BUỘC để Web Push hoạt động (cả dev & prod).
// Chiến lược cache trong sw.js là network-first nên không gây stale asset
// ở môi trường dev (tránh HMR bị đơ như lỗi cũ từng gặp).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => console.log("[SW] Registered:", reg.scope))
    .catch((err) => console.error("[SW] Registration failed:", err));
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
