import { useEffect, useState } from "react";
import { getInstallPrompt } from "~/entry.client";

// app/hooks/usePWA.ts — thêm helper detect
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari() {
  return (
    /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent)
  );
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  ); // iOS specific
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [isIOSSafari, setIsIOSSafari] = useState(false);

  useEffect(() => {
    if (isIOS() && isSafari() && !isInStandaloneMode()) {
      setIsIOSSafari(true);
    }
    // Đăng ký Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          setSwRegistration(reg);
          console.log("[SW] Registered:", reg.scope);
        })
        .catch((err) => console.error("[SW] Registration failed:", err));
    }
    const existing = getInstallPrompt();
    if (existing) {
      setInstallPrompt(existing as BeforeInstallPromptEvent);
    }
    // Bắt sự kiện install prompt
    const handler = (e: Event) => {
      console.log("[PWA] beforeinstallprompt fired ✅");
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Kiểm tra đã install chưa
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  const canInstall = !!installPrompt && !isInstalled;
  const showManualInstallHint = !installPrompt && !isInstalled;

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    promptInstall,
    swRegistration,
    showManualInstallHint,
    isIOSSafari,
  };
}
