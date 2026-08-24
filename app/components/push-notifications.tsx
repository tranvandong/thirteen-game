/**
 * app/components/push-notifications.tsx
 *
 * Card "🔔 Bật thông báo" — gọi requestPermission + subscribe TỪ CÚ TAP
 * (user gesture) để thoả mãn yêu cầu của iOS Safari / PWA điện thoại.
 *
 * Không bao giờ tự động gọi subscribe trong useEffect — đó là nguyên nhân
 * push không hoạt động trên iPhone. Toàn bộ luồng nằm trong handleEnable
 * (onClick). Xem app/helpers/push-subscribe.ts.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Bell, BellRing, ShieldAlert, Smartphone } from "lucide-react";
import { useSession, useCurrentParticipant } from "~/stores/useSessionStore";
import { getOrCreateFingerprint } from "~/helpers/fingerprint.helper";
import {
  pushSupported,
  isStandalone,
  isIOSDevice,
  currentPermission,
  subscribeToPush,
  unsubscribeFromPush,
  hasLocalSubscription,
} from "~/helpers/push-subscribe";

type Status =
  | "loading"
  | "unsupported"
  | "not-installed" // iOS chưa cài PWA
  | "denied"
  | "enabled"
  | "disabled"; // có thể bật

export function PushNotificationsCard() {
  const session = useSession();
  const currentParticipant = useCurrentParticipant();

  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function detect() {
    if (!pushSupported()) {
      setStatus("unsupported");
      return;
    }
    const perm = currentPermission();
    if (perm === "denied") {
      setStatus("denied");
      return;
    }
    // iOS cần cài PWA (standalone) mới cho phép push.
    if (isIOSDevice() && !isStandalone()) {
      setStatus("not-installed");
      return;
    }
    if (perm === "granted") {
      const hasSub = await hasLocalSubscription();
      setStatus(hasSub ? "enabled" : "disabled");
    } else {
      setStatus("disabled");
    }
  }

  useEffect(() => {
    detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnable = async () => {
    if (!session?.id || !currentParticipant?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const fingerprint = await getOrCreateFingerprint();
      await subscribeToPush({
        sessionId: session.id,
        participantId: currentParticipant.id,
        fingerprint,
      });
      setStatus("enabled");
      setMessage("Đã bật thông báo! Bạn sẽ nhận cập nhật sau mỗi ván đấu.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không thể bật thông báo.";
      setMessage(msg);
      await detect(); // quyền có thể đã đổi (denied) → cập nhật UI
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!session?.id || !currentParticipant?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const fingerprint = await getOrCreateFingerprint();
      await unsubscribeFromPush({
        sessionId: session.id,
        participantId: currentParticipant.id,
        fingerprint,
      });
      setStatus("disabled");
      setMessage("Đã tắt thông báo.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Không thể tắt thông báo.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Đang kiểm tra thông báo…
        </CardContent>
      </Card>
    );
  }

  if (status === "unsupported") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
              <Bell className="size-4" />
            </div>
            Thông báo đẩy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Trình duyệt này không hỗ trợ thông báo đẩy (Web Push). Hãy dùng
            Chrome / Safari mới trên điện thoại.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
            <Bell className="size-4" />
          </div>
          Thông báo đẩy
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === "not-installed" && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-semibold flex items-center gap-1.5">
              <Smartphone className="size-4" /> Cài đặt ứng dụng trước
            </p>
            <p className="mt-1 leading-5">
              iPhone chỉ cho phép nhận thông báo khi ứng dụng đã được thêm vào
              Màn hình chính. Mở menu <strong>Chia sẻ (□↗)</strong> →{" "}
              <strong>Thêm vào Màn hình chính</strong>, mở lại app, sau đó bấm
              nút bên dưới.
            </p>
          </div>
        )}

        {status === "denied" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldAlert className="size-4" /> Đã bị từ chối
            </p>
            <p className="mt-1 leading-5">
              Bạn đã từ chối quyền thông báo. Hãy bật lại trong Cài đặt của
              trình duyệt / iPhone (Cài đặt → Thông báo → Thirteen Game), sau đó
              tải lại trang.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Nhận thông báo khi nhân vật của bạn có biến động điểm / thứ hạng sau
          mỗi ván đấu — ngay cả khi đang ở ngoài ứng dụng.
        </p>

        {status === "enabled" ? (
          <Button
            variant="outline"
            onClick={handleDisable}
            disabled={busy}
            className="relative z-10"
          >
            <BellRing className="size-4" /> Đã bật — Tắt thông báo
          </Button>
        ) : (
          <Button
            onClick={handleEnable}
            disabled={busy}
            className="relative z-10"
          >
            {busy ? (
              <div className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            ) : (
              <Bell className="size-4" />
            )}
            🔔 Bật thông báo
          </Button>
        )}

        {message && (
          <p className="text-xs text-muted-foreground leading-5">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
