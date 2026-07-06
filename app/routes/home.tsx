import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import {
  Plus,
  Users,
  ScanLine,
  X,
  ArrowRight,
  Play,
  Moon,
  Sun,
} from "lucide-react";

import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { InstallPWA } from "~/components/install-pwa";
import { ModeToggle } from "~/components/mode-toggle";
import { createFingerprint } from "~/helpers/fingerprint.helper";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Thirteen Game - Ghi Điểm Tiến Lên" },
    { name: "description", content: "Ứng dụng ghi điểm Tiến Lên theo thời gian thực" },
  ];
}

// ── QR Scanner Modal ───────────────────────────────────────
function QRScannerModal({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [Scanner, setScanner] = useState<any>(null);

  useEffect(() => {
    import("@yudiel/react-qr-scanner").then((mod) => setScanner(() => mod.Scanner));
  }, []);

  const handleScan = (results: Array<{ rawValue: string }>) => {
    if (!results.length) return;
    const raw = results[0].rawValue;
    const match = raw.match(/\/join\/([A-Z0-9]{4}-[A-Z0-9]{4})/i);
    const code = match ? match[1].toUpperCase() : raw.trim().toUpperCase();
    onDetected(code);
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold text-white">Quét mã QR phòng</span>
          <span className="text-xs text-white/50">Đưa QR vào khung để vào nhanh</span>
        </div>

        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
              <ScanLine className="size-8 text-white/70" />
            </div>
            <p className="max-w-xs text-sm text-white/80">{error}</p>
            <button
              onClick={onClose}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Đóng
            </button>
          </div>
        ) : (
          Scanner && (
            <div className="absolute inset-4 overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 shadow-2xl">
              <Scanner
                onScan={handleScan}
                onError={(err) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  if (msg.toLowerCase().includes("permission")) {
                    setError("Vui lòng cấp quyền camera để quét QR.");
                  } else {
                    setError("Không thể mở camera. Hãy nhập mã phòng thủ công.");
                  }
                }}
                constraints={{ facingMode: "environment" }}
                components={{ tracker: undefined }}
                styles={{
                  container: { width: "100%", height: "100%", position: "relative" },
                  video: { width: "100%", height: "100%", objectFit: "cover" },
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[240px] w-[240px] rounded-[2rem] border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
              </div>
            </div>
          )
        )}
      </div>

      <div className="border-t border-white/10 bg-black/70 px-6 py-5 text-center">
        <p className="text-xs text-white/50">
          Mã QR có dạng <strong className="text-white">/join/XXXX-XXXX</strong>
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Home Page ───────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [resumeState, setResumeState] = useState<"checking" | "idle">("checking");

  // ── Auto‑resume active session ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function checkActive() {
      try {
        const existing = localStorage.getItem("device_fingerprint");
        const fingerprint = existing ?? (await createFingerprint()).toString();
        if (!existing) localStorage.setItem("device_fingerprint", fingerprint);
        const res = await fetch(
          `/api/sessions/active-by-device?fingerprint=${encodeURIComponent(fingerprint)}`
        );
        if (!res.ok) {
          setResumeState("idle");
          return;
        }
        const { sessionCode } = (await res.json()) as { sessionCode: string };
        if (!cancelled && sessionCode) {
          navigate(`/session/${sessionCode}`, { replace: true });
          return;
        }
      } catch {
        // silently ignore
      }
      if (!cancelled) setResumeState("idle");
    }
    checkActive();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleJoin = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setCodeError("Vui lòng nhập mã phòng");
      return;
    }
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setCodeError("Mã phòng không hợp lệ (XXXX-XXXX)");
      return;
    }
    navigate(`/join/${code}`);
  };

  const handleQRDetected = (code: string) => {
    setShowScanner(false);
    navigate(`/join/${code}`);
  };

  // ── Loading while checking resume ─────────────────
  if (resumeState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm">Đang kiểm tra phiên chơi…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background animated gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl animate-pulse" />
        <div className="absolute -left-24 bottom-20 h-72 w-72 rounded-full bg-chart-2/20 blur-3xl animate-pulse" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-chart-4/20 blur-3xl animate-pulse" />
      </div>

      {/* Header with dark‑mode toggle */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background/90 backdrop-blur-md border-b border-border/30">
        <Link to="/" className="flex items-center gap-2">
          <Play className="size-6 text-primary" />
          <span className="text-lg font-bold text-foreground">Thirteen Game</span>
        </Link>
        <ModeToggle />
      </header>

      {/* Hero section */}
      <section className="mx-auto max-w-4xl py-12 text-center">
        <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
          Ghi điểm Tiến Lên
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-chart-4">
            theo thời gian thực
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
          Tạo phòng, mời bạn bè và theo dõi bảng điểm ngay trên điện thoại.
        </p>
      </section>

      {/* Action cards */}
      <section className="mx-auto max-w-4xl gap-6 px-4 md:grid md:grid-cols-2">
        {/* Create Session */}
        <Card className="group border-border/70 bg-card/90 shadow-lg transition hover:shadow-xl">
          <CardHeader className="space-y-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Plus className="size-6" />
            </div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Plus className="size-5" />
              Tạo phòng mới
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/session/create" className="flex items-center justify-center gap-2">
                <Play className="size-4" />
                Bắt đầu
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Join Session */}
        <Card className="group border-border/70 bg-card/90 shadow-lg transition hover:shadow-xl">
          <CardHeader className="space-y-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-chart-2/10 text-chart-2">
              <Users className="size-6" />
            </div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="size-5" />
              Tham gia nhanh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="XXXX-XXXX"
                className={`h-11 rounded-2xl bg-background text-center font-mono text-base font-black tracking-[0.24em] placeholder:tracking-normal ${
                  codeError ? "border-destructive focus-visible:ring-destructive/20" : ""
                }`}
                maxLength={9}
              />
              <button
                onClick={() => setShowScanner(true)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-chart-2/10 text-chart-2 hover:bg-chart-2/20 active:scale-95"
                title="Quét QR"
              >
                <ScanLine className="size-5" />
              </button>
            </div>
            {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            <Button onClick={handleJoin} className="w-full">
              <Users className="size-4 mr-1" />
              Vào phòng
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Feature grid */}
      <section className="mx-auto mt-12 max-w-4xl px-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureItem icon={<Users className="size-5 text-primary" />} text="Realtime" />
          <FeatureItem icon={<ScanLine className="size-5 text-chart-2" />} text="Quét QR" />
          <FeatureItem icon={<Plus className="size-5 text-chart-4" />} text="Dễ dùng" />
        </div>
      </section>

      {/* PWA install */}
      <section className="mx-auto mt-8 max-w-4xl px-4">
        <InstallPWA />
      </section>

      {/* QR Modal */}
      {showScanner && (
        <QRScannerModal onClose={() => setShowScanner(false)} onDetected={handleQRDetected} />
      )}
    </div>
  );
}

// ── Small reusable feature item ───────────────────────
function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/60 p-4 text-center backdrop-blur-sm">
      {icon}
      <span className="text-xs font-medium">{text}</span>
    </div>
  );
}