const CACHE_NAME = "thirteen-game-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — Network First cho TẤT CẢ request cùng origin.
// Ưu tiên mạng (luôn lấy bản mới nhất, tránh stale asset ở dev/HMR),
// chỉ fallback về cache khi mạng lỗi (offline). Vẫn hỗ trợ PWA offline.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bỏ qua non-GET và cross-origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Chỉ cache response hợp lệ
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? fetch(request)))
  );
});

// Push Notifications
self.addEventListener("push", (event) => {
  const data =
    event.data?.json() ??
    { title: "Thirteen Game", body: "Có thông báo mới!", url: "/" };

  event.waitUntil(
    (async () => {
      // Nếu app đang mở và được focus → không hiện OS notification
      // (app đã cập nhật realtime / toast rồi) để tránh trùng lặp.
      // Riêng push TEST (debug, tag = "debug-push") luôn hiển thị để dễ
      // xác minh trên thiết bị bất kể tab có đang focus hay không.
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = allClients.some((c) => c.focused);
      const isDebug = data.tag === "debug-push";
      if (focused && !isDebug) return;

      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        data: data.url ?? "/",
        tag: data.tag, // cùng tag → thay thế notification cũ
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Nếu đã có tab app → focus và navigate tới url
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          // @ts-ignore - navigate có trên WindowClient
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }
      // Không có tab nào → mở mới
      await clients.openWindow(targetUrl);
    })(),
  );
});