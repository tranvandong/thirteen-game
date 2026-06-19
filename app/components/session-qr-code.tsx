/**
 * components/session-qr.tsx
 *
 * QR Code hiển thị ở tab Settings của session.
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

  const joinUrl =
    session && typeof window !== "undefined"
      ? `${window.location.origin}/join/${session.code}`
      : "";

  useEffect(() => {
    if (!canvasRef.current || !joinUrl) return;

    setQrReady(false);
    QRCode.toCanvas(canvasRef.current, joinUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: "#1a1a2e",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then(() => setQrReady(true))
      .catch(console.error);
  }, [joinUrl]);

  const handleCopy = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <QrCode className="size-4 text-chart-4" />
          Chia sẻ phòng chơi
        </div>

        <div className="relative flex flex-col items-center gap-3 rounded-3xl border bg-background p-5 shadow-sm">
          <div
            className={`
              relative transition-opacity duration-300 
              ${qrReady ? "opacity-100" : "opacity-0"}
            `}
          >
            <canvas ref={canvasRef} className="rounded-2xl" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex size-10 items-center justify-center rounded-xl border bg-background shadow-sm">
                <span className="text-lg">🃏</span>
              </div>
            </div>
          </div>

          {!qrReady && (
            <div
              className="absolute inset-5 rounded-2xl bg-muted animate-pulse"
              style={{ width: 240, height: 240 }}
            />
          )}

          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mã phòng
            </p>
            <p className="font-mono text-2xl font-black tracking-[0.24em] text-foreground">
              {session.code}
            </p>
          </div>
        </div>

        <p className="break-all text-center text-xs text-muted-foreground">
          {joinUrl || `Tham gia qua mã phòng: ${session.code}`}
        </p>

        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-xs">
          <Button
            variant="outline"
            className="gap-2 rounded-2xl"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="size-4 text-chart-2" />
                <span className="text-chart-2">Đã copy</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy link
              </>
            )}
          </Button>

          <Button className="gap-2 rounded-2xl" onClick={handleShare}>
            <Share2 className="size-4" />
            Chia sẻ
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Quét QR hoặc gửi link để mời người khác vào phòng
        </p>
      </div>
    </div>
  );
}