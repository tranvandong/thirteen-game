import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { Plus, Users, ScanLine, X, ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";

import { InstallPWA } from "~/components/install-pwa";
import { createFingerprint } from "~/helpers/fingerprint.helper";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Thirteen Game - Ghi Điểm Tiến Lên" },
    {
      name: "description",
      content: "Ứng dụng ghi điểm Tiến Lên theo thời gian thực",
    },
  ];
}

// ── QR Scanner Modal ──────────────────────────────────────────
function QRScannerModal({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (results: Array<{ rawValue: string }>) => {
    if (!results.length) return;
    const raw = results[0].rawValue;
    const match = raw.match(/\/join\/([A-Z0-9]{4}-[A-Z0-9]{4})/i);
    const code = match ? match[1].toUpperCase() : raw.trim().toUpperCase();
    onDetected(code);
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="relative flex items-center justify-between px-4 py-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold text-white">
            Quét mã QR phòng chơi
          </span>
          <span className="text-[11px] text-white/50">
            Đưa mã QR vào khung hình để vào nhanh
          </span>
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
            <p className="max-w-xs text-sm leading-6 text-white/80">{error}</p>
            <button
              onClick={onClose}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Đóng
            </button>
          </div>
        ) : (
          <CameraScanner onScan={handleScan} onError={setError} />
        )}
      </div>

      <div className="border-t border-white/10 bg-black/70 px-6 py-5 text-center">
        <p className="text-xs leading-5 text-white/50">
          Mã QR phòng chơi có dạng{" "}
          <strong className="text-white">/join/XXXX-XXXX</strong>
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Scanner with Overlay ──────────────────────────────────────
function CameraScanner({
  onScan,
  onError,
}: {
  onScan: (results: Array<{ rawValue: string }>) => void;
  onError: (err: string) => void;
}) {
  const [Scanner, setScanner] = useState<any>(null);

  useEffect(() => {
    import("@yudiel/react-qr-scanner").then((mod) => {
      setScanner(() => mod.Scanner);
    });
  }, []);

  if (!Scanner) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="absolute inset-4 overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 shadow-2xl shadow-black/50">
      <Scanner
        onScan={onScan}
        onError={(err: any) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes("permission")) {
            onError("Vui lòng cấp quyền camera để quét mã QR.");
          } else {
            onError("Không thể mở camera. Hãy nhập mã phòng thủ công.");
          }
        }}
        constraints={{ facingMode: "environment" }}
        components={{ tracker: undefined }}
        styles={{
          container: { width: "100%", height: "100%", position: "relative" },
          video: { width: "100%", height: "100%", objectFit: "cover" },
        }}
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
      </div>
    </div>
  );
}

// ── Fingerprint Helper ────────────────────────────────────────
async function getOrCreateFingerprint(): Promise<string> {
  const STORAGE_KEY = "device_fingerprint";
  // Note: In a Vite client context, we can directly access localStorage
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const fingerprint = await createFingerprint();
  localStorage.setItem(STORAGE_KEY, fingerprint);
  return fingerprint;
}

// ── Home Page ─────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [resumeState, setResumeState] = useState<"checking" | "idle">(
    "checking"
  );

  // ── Check for active session on mount ─────────────────────
  useEffect(() => {
    let cancelled = false;

    async function checkActiveSession() {
      try {
        const fingerprint = await getOrCreateFingerprint();
        const res = await fetch(
          `/api/sessions/active-by-device?fingerprint=${encodeURIComponent(fingerprint)}`
        );

        if (!res.ok) {
          setResumeState("idle");
          return;
        }

        const data = (await res.json()) as { sessionCode: string };

        if (!cancelled && data.sessionCode) {
          navigate(`/session/${data.sessionCode}`, { replace: true });
          return;
        }
      } catch {
        // Ignore network errors and just show the home page
      }

      if (!cancelled) setResumeState("idle");
    }

    checkActiveSession();
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
      setCodeError("Mã phòng không hợp lệ (dạng XXXX-XXXX)");
      return;
    }
    navigate(`/join/${code}`);
  };

  const handleQRDetected = (code: string) => {
    setShowScanner(false);
    navigate(`/join/${code}`);
  };

  // Show loading spinner while checking for an active session
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
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -left-24 bottom-20 h-72 w-72 rounded-full bg-chart-2/20 blur-3xl" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-chart-4/20 blur-3xl" />
      </div>

      <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-2xl flex-col justify-center gap-8">
        {/* Hero Section */}
        <section className="text-center">
          <div className="mx-auto mb-8 flex size-24 items-center justify-center rounded-[2rem] bg-white p-2 shadow-2xl shadow-primary/20 dark:bg-card">
            <img
              src="/icons/icon-72x72.png"
              alt="logo"
              className="h-full w-full rounded-[1.6rem]"
            />
          </div>

          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Ghi điểm Tiến Lên
            <br />
            theo thời gian thực
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
            Tạo phòng, mời bạn bè và theo dõi bảng điểm ngay trên điện thoại.
          </p>
        </section>

        {/* Action Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Create Session */}
          <Card className="group relative overflow-hidden rounded-[2rem] border-border/70 bg-card/90 p-0 shadow-lg transition hover:shadow-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-chart-4 opacity-80 transition-all group-hover:h-2" />
            <CardHeader className="space-y-3 pb-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Plus className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Tạo phòng mới</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  Thiết lập luật và mời người chơi vào
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Link
                to="/session/create"
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Bắt đầu
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardContent>
          </Card>

          {/* Join Session */}
          <Card className="group relative overflow-hidden rounded-[2rem] border-border/70 bg-card/90 p-0 shadow-lg transition hover:shadow-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-2 to-chart-1 opacity-80 transition-all group-hover:h-2" />
            <CardHeader className="space-y-3 pb-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-chart-2/10 text-chart-2">
                <Users className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Tham gia nhanh</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  Nhập mã phòng hoặc quét QR
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase());
                      setCodeError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    placeholder="XXXX-XXXX"
                    className={`h-11 rounded-2xl bg-background text-center font-mono text-base font-black tracking-[0.24em] placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground/50 ${
                      codeError
                        ? "border-destructive focus-visible:ring-destructive/20"
                        : ""
                    }`}
                    maxLength={9}
                  />
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-chart-2/10 text-chart-2 transition hover:bg-chart-2/20 active:scale-95"
                  title="Quét mã QR"
                >
                  <ScanLine className="size-5" />
                </button>
              </div>
              <button
                onClick={handleJoin}
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-foreground py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
              >
                Vào phòng
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              {codeError && (
                <p className="text-left text-xs text-destructive pt-1">
                  {codeError}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features / Install PWA */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/60 p-4 text-center backdrop-blur-sm">
              <Users className="size-5 text-primary" />
              <span className="text-xs font-medium">Realtime</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/60 p-4 text-center backdrop-blur-sm">
              <ScanLine className="size-5 text-chart-2" />
              <span className="text-xs font-medium">Quét QR</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/60 p-4 text-center backdrop-blur-sm">
              <Plus className="size-5 text-chart-4" />
              <span className="text-xs font-medium">Dễ dùng</span>
            </div>
          </div>
          
          <InstallPWA />
        </div>
      </main>

      {showScanner && (
        <QRScannerModal
          onClose={() => setShowScanner(false)}
          onDetected={handleQRDetected}
        />
      )}
    </div>
  );
}