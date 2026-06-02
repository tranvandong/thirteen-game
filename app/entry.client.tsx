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

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
