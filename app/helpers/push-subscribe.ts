/**
 * app/helpers/push-subscribe.ts
 *
 * Đăng ký / huỷ Web Push ĐÚNG CÁCH cho PWA điện thoại (đặc biệt iOS Safari).
 *
 * QUAN TRỌNG (iOS / PWA):
 *  - iOS Safari CHỈ cho phép `Notification.requestPermission()` và
 *    `pushManager.subscribe()` khi được gọi TỪ MỘT USER GESTURE (cú tap).
 *    Gọi trong useEffect / on mount sẽ bị bỏ qua THẦM LẶNG → user không bao
 *    giờ nhận được thông báo (lỗi kinh điển hay gặp).
 *  - iOS CHỈ hỗ trợ Web Push khi app đã được "Add to Home Screen" (standalone).
 *    Nếu chưa cài, requestPermission() trả về 'denied' ngay, không hiện prompt.
 *
 * Do đó toàn bộ luồng permission + subscribe PHẢI nằm trong hàm được gọi từ
 * onClick của một nút (xem app/components/push-notifications.tsx). Module này
 * là client-only (dùng window/navigator/import.meta.env).
 */

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** App đang chạy ở chế độ standalone (đã cài PWA / Add to Home Screen). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore - navigator.standalone là thuộc tính riêng của Safari iOS
    navigator.standalone === true
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function currentPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export function isIOSDevice(): boolean {
  return isIOS();
}

function detectPlatform(): "ios" | "android" | "web" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "web";
}

/** VAPID public key phải là base64url của public key P-256 uncompressed
 *  (0x04 + 32 byte + 32 byte = 65 byte). */
function isValidVapidPublicKey(key: string): boolean {
  try {
    const b64 = key.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    return bin.length === 65 && bin.charCodeAt(0) === 0x04;
  } catch {
    return false;
  }
}

export interface SubscribeArgs {
  /** DB uuid của session (dùng cho endpoint upsert player_devices). */
  sessionId: string;
  participantId: string;
  fingerprint: string;
}

/**
 * Đăng ký push. PHẢI được gọi từ user gesture (onClick).
 * Trả về PushSubscription nếu thành công, ném Error với message tiếng Việt
 * nếu thất bại (để component hiển thị cho user).
 */
export async function subscribeToPush({
  sessionId,
  participantId,
  fingerprint,
}: SubscribeArgs): Promise<PushSubscription> {
  if (!pushSupported()) {
    throw new Error("Trình duyệt này không hỗ trợ thông báo đẩy (Web Push).");
  }

  // iOS bắt buộc phải cài PWA (standalone) mới cho phép push.
  if (isIOS() && !isStandalone()) {
    throw new Error(
      "iPhone cần cài đặt ứng dụng trước: mở menu Chia sẻ → Thêm vào Màn hình chính, mở lại app rồi bấm nút.",
    );
  }

  // 1. Đảm bảo Service Worker đã đăng ký & active (idempotent, an toàn
  //    gọi trong gesture). iOS cần SW control page trước khi subscribe.
  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
  }
  registration = await navigator.serviceWorker.ready;

  // 2. Quyền thông báo — gọi TỪ GESTURE. Trên iOS nếu chưa cài PWA,
  //    hàm này trả về 'denied' ngay (đã check ở trên).
  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error(
      "Quyền thông báo bị từ chối. Hãy bật trong Cài đặt của trình duyệt / thiết bị rồi thử lại.",
    );
  }

  // 3. VAPID public key (phía client).
  const rawKey =
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";
  const vapidPublicKey = rawKey.trim().replace(/\s+/g, "");
  if (!vapidPublicKey) {
    throw new Error(
      "Máy chủ chưa cấu hình VAPID public key (VITE_VAPID_PUBLIC_KEY).",
    );
  }
  if (!isValidVapidPublicKey(vapidPublicKey)) {
    throw new Error(
      "VAPID public key không hợp lệ (không phải base64url của public key P-256).",
    );
  }

  // 4. Subscribe (huỷ subscription cũ nếu có để tránh lỗi "Existing registration").
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey,
  });

  // 5. Lưu token (JSON PushSubscription) vào player_devices.
  await fetch(`/api/sessions/${sessionId}/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId,
      fingerprint,
      platform: detectPlatform(),
      pushToken: JSON.stringify(subscription),
    }),
  });

  return subscription;
}

/**
 * Huỷ đăng ký push: unsubscribe ở client + xoá pushToken trong DB.
 * Có thể gọi từ user gesture (nút "Tắt thông báo").
 */
export async function unsubscribeFromPush({
  sessionId,
  participantId,
  fingerprint,
}: SubscribeArgs): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    // bỏ qua lỗi SW — vẫn tiếp tục xoá token trong DB
  }

  await fetch(`/api/sessions/${sessionId}/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId,
      fingerprint,
      platform: detectPlatform(),
      pushToken: null,
    }),
  });
}

/** Kiểm tra xem thiết bị hiện tại đã có local subscription chưa. */
export async function hasLocalSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return false;
    const sub = await registration.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
