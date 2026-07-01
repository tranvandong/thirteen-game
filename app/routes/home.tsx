import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { InstallPWA } from "~/components/install-pwa";
import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { Plus, Users, ScanLine, X } from "lucide-react";
import { Input } from "~/components/ui/input";
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

// ── Fingerprint helper ────────────────────────────────────────

/**
 * Tạo hoặc lấy fingerprint thiết bị từ localStorage.
 * Dùng làm key nhận diện thiết bị giữa các lần truy cập.
 */
async function getOrCreateFingerprint(): Promise<string> {
  const STORAGE_KEY = "device_fingerprint";
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  // Tạo fingerprint đơn giản từ các thông tin môi trường
  const fingerprint = await createFingerprint();

  localStorage.setItem(STORAGE_KEY, fingerprint);
  return fingerprint;
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
    // Parse URL dạng /join/ABCD-EFGH hoặc raw code
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
          <div className="absolute inset-4 overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 shadow-2xl shadow-black/50">
            <Scanner
              onScan={handleScan}
              onError={(err) => {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.toLowerCase().includes("permission")) {
                  setError("Vui lòng cấp quyền camera để quét mã QR.");
                } else {
                  setError("Không thể mở camera. Hãy nhập mã phòng thủ công.");
                }
              }}
              constraints={{ facingMode: "environment" }}
              components={{
                tracker: undefined,
              }}
              styles={{
                container: {
                  width: "100%",
                  height: "100%",
                  position: "relative",
                },
                video: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              }}
            />

            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
              <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-tl-3xl border-l-4 border-t-4 border-primary" />
              <div className="absolute left-1/2 top-1/2 h-8 w-8 translate-x-1/2 -translate-y-1/2 rounded-tr-3xl border-r-4 border-t-4 border-primary" />
              <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 translate-y-1/2 rounded-bl-3xl border-b-4 border-l-4 border-primary" />
              <div className="absolute left-1/2 top-1/2 h-8 w-8 translate-x-1/2 translate-y-1/2 rounded-br-3xl border-b-4 border-r-4 border-primary" />
            </div>
          </div>
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

// ── Home Page ─────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [codeError, setCodeError] = useState("");
  // "checking" trong khi tra fingerprint, "idle" khi xong
  const [resumeState, setResumeState] = useState<"checking" | "idle">(
    "checking",
  );

  // ── Kiểm tra phiên đang diễn ra khi vào Home ────────────────
  useEffect(() => {
    let cancelled = false;

    async function checkActiveSession() {
      try {
        const fingerprint = await getOrCreateFingerprint();

        // Gọi API tìm session active theo fingerprint thiết bị
        const res = await fetch(
          `/api/sessions/active-by-device?fingerprint=${encodeURIComponent(fingerprint)}`,
        );
        console.log(res);
        if (!res.ok) {
          // 404 = không tìm thấy → bình thường, hiện home
          setResumeState("idle");
          return;
        }

        const data = (await res.json()) as { sessionCode: string };

        if (!cancelled && data.sessionCode) {
          // Có phiên đang diễn ra → redirect thẳng vào
          navigate(`/session/${data.sessionCode}`, { replace: true });
          return;
        }
      } catch {
        // Lỗi mạng / API chưa sẵn sàng → cứ hiện home bình thường
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

  // Trong khi đang kiểm tra → hiện màn splash mờ để tránh flash UI
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

      <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col justify-center gap-6">
        <section className="text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white p-2 shadow-2xl shadow-primary/20 dark:bg-card">
            <img
              src="/icons/icon-72x72.png"
              alt="logo"
              className="h-full w-full rounded-[1.6rem]"
            />
          </div>

          <div className="mb-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span className="size-2 rounded-full bg-primary" />
              Thirteen Game Score Tracker
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Ghi điểm Tiến Lên
            <br />
            theo thời gian thực
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
            Tạo phòng, mời bạn bè và theo dõi bảng điểm ngay trên điện thoại.
          </p>
        </section>

        <section className="grid gap-3">
          <Link
            to="/session/create"
            className="group flex items-center justify-between rounded-[1.75rem] bg-primary px-5 py-4 text-primary-foreground shadow-xl shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <Plus className="size-6" />
              </div>
              <div className="text-left">
                <p className="text-base font-bold">Tạo phòng mới</p>
                <p className="mt-0.5 text-xs text-primary-foreground/70">
                  Thiết lập người chơi và luật điểm
                </p>
              </div>
            </div>

            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-black transition group-hover:translate-x-0.5">
              →
            </span>
          </Link>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/5 backdrop-blur">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Tham gia phòng chơi
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Nhập mã phòng hoặc quét QR để vào nhanh.
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="size-6" />
              </div>
            </div>

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
                  className={`h-12 rounded-2xl bg-background text-center font-mono text-lg font-black tracking-[0.24em] placeholder:tracking-normal ${
                    codeError
                      ? "border-destructive focus-visible:ring-destructive/20"
                      : ""
                  }`}
                  maxLength={9}
                />
                {codeError && (
                  <p className="mt-1 text-left text-xs text-destructive">
                    {codeError}
                  </p>
                )}
              </div>

              <button
                onClick={() => setShowScanner(true)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 active:scale-95"
                title="Quét mã QR"
              >
                <ScanLine className="size-5" />
              </button>
            </div>

            <button
              onClick={handleJoin}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-background text-sm font-black transition hover:bg-foreground/90 active:scale-[0.99]"
            >
              <Users className="size-4" />
              Vào phòng
            </button>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-[1.35rem] border border-border/70 bg-card/70 p-4 text-center shadow-sm">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-chart-4/15 text-chart-4">
              <Users className="size-4" />
            </div>
            <p className="text-xs font-bold text-foreground">Nhiều người</p>
          </div>

          <div className="rounded-[1.35rem] border border-border/70 bg-card/70 p-4 text-center shadow-sm">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-chart-2/15 text-chart-2">
              <ScanLine className="size-4" />
            </div>
            <p className="text-xs font-bold text-foreground">Realtime</p>
          </div>

          <div className="rounded-[1.35rem] border border-border/70 bg-card/70 p-4 text-center shadow-sm">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Plus className="size-4" />
            </div>
            <p className="text-xs font-bold text-foreground">Dễ dùng</p>
          </div>
        </section>

        <InstallPWA />
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
