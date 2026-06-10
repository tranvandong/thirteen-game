/**
 * components/session-qr.tsx
 *
 * QR Code hiển thị ở tab Settings của session.
 * Dùng thư viện `qrcode` (npm install qrcode @types/qrcode).
 *
 * Hiển thị:
 * - QR code chứa URL join session
 * - Mã phòng dạng text để nhập tay
 * - Nút copy link / share native
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Share2, QrCode } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useSession } from "~/stores/useSessionStore";

// ── Component ─────────────────────────────────────────────────

export function SessionQRCode() {
  const session = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  // Build URL join session
  const joinUrl = session
    ? `${window.location.origin}/session/${session.code}/join`
    : "";

  // Render QR lên canvas
  useEffect(() => {
    if (!canvasRef.current || !joinUrl) return;

    setQrReady(false);
    QRCode.toCanvas(canvasRef.current, joinUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: "#1a1a2e", // màu module
        light: "#ffffff", // màu nền
      },
      errorCorrectionLevel: "M",
    })
      .then(() => setQrReady(true))
      .catch(console.error);
  }, [joinUrl]);

  // Copy link vào clipboard
  const handleCopy = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Web Share API (mobile)
  const handleShare = async () => {
    if (!joinUrl || !session) return;
    if (navigator.share) {
      await navigator.share({
        title: "Tham gia phòng Thirteen Game",
        text: `Mã phòng: ${session.code}`,
        url: joinUrl,
      });
    } else {
      handleCopy();
    }
  };

  if (!session) return null;

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      {/* Title */}
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <QrCode className="size-4" />
        <span>Chia sẻ phòng chơi</span>
      </div>

      {/* QR Card */}
      <div className="relative flex flex-col items-center gap-3 p-5 rounded-2xl border bg-white shadow-sm">
        {/* Canvas QR */}
        <div
          className={`relative transition-opacity duration-300 ${qrReady ? "opacity-100" : "opacity-0"}`}
        >
          <canvas ref={canvasRef} className="rounded-lg" />

          {/* Logo overlay ở giữa QR */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-gray-100">
              <span className="text-lg">🃏</span>
            </div>
          </div>
        </div>

        {/* Skeleton khi QR chưa load */}
        {!qrReady && (
          <div
            className="absolute inset-5 rounded-lg bg-muted animate-pulse"
            style={{ width: 240, height: 240 }}
          />
        )}

        {/* Session code */}
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-xs text-muted-foreground">Mã phòng</p>
          <p className="text-2xl font-bold font-mono tracking-[0.2em] text-gray-900">
            {session.code}
          </p>
        </div>
      </div>

      {/* URL hint */}
      <p className="text-xs text-muted-foreground text-center px-6 break-all">
        {joinUrl}
      </p>

      {/* Actions */}
      <div className="flex gap-2 w-full max-w-xs">
        <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="size-4 text-green-500" />
              <span className="text-green-600">Đã copy!</span>
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copy link
            </>
          )}
        </Button>

        <Button className="flex-1 gap-2" onClick={handleShare}>
          <Share2 className="size-4" />
          Chia sẻ
        </Button>
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground text-center">
        Quét QR hoặc gửi link để mời người khác vào phòng
      </p>
    </div>
  );
}
