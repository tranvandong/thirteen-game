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
  Trophy,
  Zap,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
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

// ── Step Guide Component ───────────────────────────────────
function StepGuide() {
  const steps = [
    {
      icon: <Plus className="size-5" />,
      title: "Tạo phòng",
      desc: "Thiết lập luật chơi và người tham gia",
    },
    {
      icon: <Users className="size-5" />,
      title: "Mời bạn bè",
      desc: "Chia sẻ mã phòng hoặc quét QR",
    },
    {
      icon: <Trophy className="size-5" />,
      title: "Ghi điểm",
      desc: "Cập nhật kết quả realtime cho tất cả",
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3 sm:flex-col sm:text-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {step.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <p className="text-xs text-muted-foreground sm:text-center">{step.desc}</p>
          </div>
          {i < steps.length - 1 && (
            <div className="ml-12 hidden h-px w-full bg-border sm:ml-0 sm:mt-2 sm:mb-0 sm:h-px sm:w-auto sm:flex-1" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Feature Card ────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  desc,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: "primary" | "chart2" | "chart4";
}) {
  const colors = {
    primary: "bg-primary/10 text-primary border-primary/20",
    chart2: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    chart4: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur-sm transition hover:bg-card/100 hover:shadow-md">
      <div className={`flex size-10 items-center justify-center rounded-2xl border ${colors[accent]}`}>
        {icon}
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
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
          <div className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-lg shadow-primary/20">
            <Play className="size-4" />
          </div>
          <span className="text-base font-bold text-foreground">Thirteen Game</span>
        </Link>
        <ModeToggle />
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-12 sm:px-6">
        {/* ── Hero ─────────────────────────────────────── */}
        <section className="relative py-10 text-center sm:py-14">
          {/* Logo bubble */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] border border-border/40 bg-card p-1.5 shadow-2xl shadow-primary/15 ring-1 ring-border">
            <div className="flex h-full w-full items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-primary to-chart-4">
              <Trophy className="size-9 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Ghi điểm Tiến Lên
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-chart-4">
              theo thời gian thực
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
            Tạo phòng, mời bạn bè và theo dõi bảng điểm ngay trên điện thoại.
          </p>
        </section>

        {/* ── Step Guide ──────────────────────────────── */}
        <section className="mb-8 rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-sm">
          <StepGuide />
        </section>

        {/* ── Action Cards ────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2">
          {/* Create Session */}
          <div className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 shadow-md transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-chart-4 to-chart-2 opacity-80 transition-all group-hover:h-1.5" />
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Plus className="size-6" />
            </div>
            <h3 className="mb-1 text-lg font-bold text-foreground">Tạo phòng mới</h3>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Thiết lập luật chơi, thêm người chơi và bắt đầu ván đầu tiên
            </p>
            <Link
              to="/session/create"
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              <Play className="size-4" />
              Bắt đầu ngay
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Join Session */}
          <div className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-5 shadow-md transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-2 via-chart-1 to-chart-3 opacity-80 transition-all group-hover:h-1.5" />
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-chart-2/10 text-chart-2">
              <Users className="size-6" />
            </div>
            <h3 className="mb-1 text-lg font-bold text-foreground">Tham gia phòng</h3>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Nhập mã phòng hoặc quét mã QR để vào bàn chơi
            </p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setCodeError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="XXXX-XXXX"
                  className={`h-11 flex-1 rounded-2xl bg-background/80 text-center font-mono text-base font-black tracking-[0.2em] placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground/50 ${
                    codeError ? "border-destructive focus-visible:ring-destructive/20" : ""
                  }`}
                  maxLength={9}
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-chart-2/10 text-chart-2 transition hover:bg-chart-2/20 active:scale-95"
                  title="Quét mã QR"
                >
                  <ScanLine className="size-5" />
                </button>
              </div>
              {codeError && (
                <p className="text-left text-xs text-destructive pl-1">{codeError}</p>
              )}
              <button
                onClick={handleJoin}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3 text-sm font-bold text-background transition hover:bg-foreground/90 active:scale-[0.98]"
              >
                <Users className="size-4" />
                Vào phòng
              </button>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────── */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <FeatureCard
            accent="primary"
            icon={<Zap className="size-5" />}
            title="Realtime"
            desc="Cập nhật điểm tức thì cho tất cả người chơi"
          />
          <FeatureCard
            accent="chart2"
            icon={<ScanLine className="size-5" />}
            title="Quét QR"
            desc="Vào phòng nhanh chóng bằng camera"
          />
          <FeatureCard
            accent="chart4"
            icon={<Smartphone className="size-5" />}
            title="Di động"
            desc="Sử dụng mượt mà trên mọi thiết bị"
          />
        </section>

        {/* ── Trust Badges ────────────────────────────── */}
        <section className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-chart-2" />
            Bảo mật cao
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-primary" />
            Không cần tài khoản
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-chart-4" />
            Miễn phí sử dụng
          </div>
        </section>

        {/* ── PWA Install ─────────────────────────────── */}
        <section className="mx-auto mt-8 max-w-xs">
          <InstallPWA />
        </section>
      </main>

      {/* QR Modal */}
      {showScanner && (
        <QRScannerModal onClose={() => setShowScanner(false)} onDetected={handleQRDetected} />
      )}
    </div>
  );
}