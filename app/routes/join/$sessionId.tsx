import {
  redirect,
  useNavigate,
  useParams,
} from "react-router";
import type { Route } from "./+types/join";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  CheckCircle2,
  Gamepad2,
  ShieldCheck,
  Spade,
  Users,
  Clock,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createFingerprint } from "~/helpers/fingerprint.helper";
import {
  sendJoinRequest,
  onJoinRequestSent,
  onParticipantApproved,
  onJoinRequestRejected,
  offJoinRequestSent,
  offParticipantApproved,
  offJoinRequestRejected,
  getSocket,
} from "~/lib/socket.client";

const FINGERPRINT_KEY = "device_fingerprint";
const DEFAULT_TIMEOUT_MS = 8000;

// ── Timeout helper ────────────────────────────────────────────
function withTimeout<T>(
  promise: Promise<T>,
  ms = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

async function getOrCreateFingerprint(): Promise<string> {
  const existing = localStorage.getItem(FINGERPRINT_KEY);
  if (existing) return existing;

  const fingerprint = await withTimeout(createFingerprint());
  localStorage.setItem(FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

function detectPlatform(): "ios" | "android" | "web" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "web";
}

/** Đăng ký thiết bị (upsert player_devices) sau khi được chủ phòng duyệt. */
async function registerDevice(
  sessionDbId: string,
  participantId: string,
  fingerprint: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    await fetch(`/api/sessions/${sessionDbId}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        fingerprint,
        platform: detectPlatform(),
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Server Loader ─────────────────────────────────────────────
export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId: sessionCode } = params;

  const [session] = await db
    .select({ id: sessions.id, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session) throw redirect("/");
  if (session.status === "finished") throw redirect("/");
  return { sessionId: session.id };
}

// ── Client Loader ─────────────────────────────────────────────
// Nếu thiết bị (fingerprint) đã active sẵn trong session này -> vào thẳng,
// khỏi bắt gửi request.
export async function clientLoader({
  params,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const data = await serverLoader();
  const sessionCode = params.sessionId!;

  let fingerprint: string | null = null;
  try {
    fingerprint = await getOrCreateFingerprint();
  } catch {
    return { ...data, fingerprint: null };
  }

  if (fingerprint) {
    const response = await fetch(`/api/sessions/${sessionCode}/devices/reconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint }),
    });

    if (response.ok) {
      throw redirect(`/session/${sessionCode}`);
    }
  }

  return { ...data, fingerprint };
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────

type JoinStatus = "idle" | "waiting" | "approved" | "rejected";

export default function JoinPage({ loaderData }: Route.ComponentProps) {
  const { sessionId: sessionDbId } = loaderData;
  const { sessionId: sessionCode } = useParams();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<string | null>(null);
  const codeRef = useRef(sessionCode ?? "");
  const dbIdRef = useRef(sessionDbId);
  const fingerprintRef = useRef<string | null>(null);
  const statusRef = useRef<JoinStatus>("idle");
  statusRef.current = status;

  // Lắng nghe phản hồi realtime từ chủ phòng
  useEffect(() => {
    codeRef.current = sessionCode ?? "";
    dbIdRef.current = sessionDbId;

    const onSent = ({ requestId }: { requestId: string }) => {
      requestIdRef.current = requestId;
      setStatus("waiting");
    };

    const onApproved = async ({
      requestId,
      participant,
    }: {
      requestId: string;
      participant: { id: string; displayName: string; role: string };
    }) => {
      if (requestId !== requestIdRef.current) return;
      setStatus("approved");
      try {
        const fp = fingerprintRef.current ?? (await getOrCreateFingerprint());
        await registerDevice(dbIdRef.current, participant.id, fp);
        navigate(`/session/${codeRef.current}`, { replace: true });
      } catch {
        setStatus("rejected");
        setError("Không thể đăng ký thiết bị. Vui lòng thử lại.");
      }
    };

    const onRejected = ({ requestId }: { requestId: string }) => {
      if (requestId !== requestIdRef.current) return;
      setStatus("rejected");
      setError("Yêu cầu tham gia đã bị từ chối.");
    };

    onJoinRequestSent(onSent);
    onParticipantApproved(onApproved);
    onJoinRequestRejected(onRejected);

    return () => {
      offJoinRequestSent(onSent);
      offParticipantApproved(onApproved);
      offJoinRequestRejected(onRejected);
    };
  }, [sessionCode, sessionDbId, navigate]);

  const reset = () => {
    requestIdRef.current = null;
    setStatus("idle");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError("Vui lòng nhập tên hiển thị");
      return;
    }
    if (name.length > 100) {
      setError("Tên tối đa 100 ký tự");
      return;
    }

    setError(null);
    setStatus("waiting");

    try {
      const fp = await getOrCreateFingerprint();
      fingerprintRef.current = fp;

      const socket = getSocket();
      const emit = () => sendJoinRequest(codeRef.current, name);

      if (socket.connected) {
        emit();
      } else {
        // Chờ kết nối rồi gửi; nếu lỗi hoặc quá 6s thì báo lỗi
        const failTimer = setTimeout(() => {
          if (statusRef.current === "waiting") {
            setStatus("rejected");
            setError("Không thể kết nối tới máy chủ realtime. Thử lại.");
          }
        }, 6000);
        socket.once("connect", () => {
          clearTimeout(failTimer);
          emit();
        });
        socket.once("connect_error", () => {
          clearTimeout(failTimer);
          setStatus("rejected");
          setError("Lỗi kết nối realtime. Thử lại.");
        });
      }
    } catch {
      setStatus("rejected");
      setError("Không thể tạo nhận diện thiết bị. Vui lòng thử lại.");
    }
  };

  const busy = status === "waiting" || status === "approved";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-chart-2/20 blur-3xl" />
        <div className="absolute -right-32 top-40 h-80 w-80 rounded-full bg-chart-4/20 blur-3xl" />
      </div>

      <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-xl flex-col justify-center gap-6">
        <section className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-card shadow-2xl shadow-primary/20 ring-1 ring-border">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-lg shadow-primary/25">
              <Spade className="size-7" />
            </div>
          </div>

          <div className="mb-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <span className="size-2 rounded-full bg-primary" />
              Thirteen Game Score Tracker
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Tham gia phòng chơi
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
            Nhập tên hiển thị, gửi yêu cầu và đợi chủ phòng phê duyệt để vào
            bàn chơi.
          </p>
        </section>

        <Card className="relative overflow-hidden border-border/70 bg-card/85 shadow-2xl shadow-black/10 backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-chart-4 to-chart-2" />

          <CardHeader className="pb-5 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Users className="size-7" />
            </div>

            <CardTitle className="text-xl font-black">
              Bạn đã được mời
            </CardTitle>

            <div className="mx-auto mt-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-3xl border border-border/70 bg-muted/40 px-4 py-3">
              <ShieldCheck className="size-4 shrink-0 text-chart-4" />
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  Mã phòng
                </p>
                <p className="font-mono text-lg font-black tracking-[0.28em] text-foreground">
                  {sessionCode}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {status === "idle" || status === "rejected" ? (
              <>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label
                      htmlFor="displayName"
                      className="text-xs font-black uppercase tracking-wide text-muted-foreground"
                    >
                      Tên hiển thị
                    </Label>

                    <div className="relative">
                      <Input
                        id="displayName"
                        name="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ví dụ: Hùng"
                        maxLength={100}
                        autoFocus
                        autoComplete="off"
                        disabled={busy}
                        className="h-13 rounded-2xl bg-background pr-11 text-base font-semibold shadow-sm"
                      />
                      <Gamepad2 className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/50" />
                    </div>

                    {error && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <XCircle className="size-3.5" />
                        {error}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="h-13 rounded-2xl text-base font-black shadow-xl shadow-primary/20"
                    size="lg"
                    disabled={busy}
                  >
                    <CheckCircle2 className="size-4" />
                    Gửi yêu cầu tham gia
                  </Button>
                </form>

                <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                  Chủ phòng sẽ nhận được thông báo và phê duyệt yêu cầu của bạn
                  theo thời gian thực.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                {status === "waiting" ? (
                  <>
                    <div className="flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                      <Clock className="size-7 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-base font-black text-foreground">
                        Đang chờ phê duyệt
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Yêu cầu của bạn đã được gửi đến chủ phòng. Vui lòng chờ
                        trong giây lát…
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reset}
                      className="text-xs"
                    >
                      Hủy
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex size-14 items-center justify-center rounded-3xl bg-chart-2/10 text-chart-2">
                      <CheckCircle2 className="size-7" />
                    </div>
                    <div>
                      <p className="text-base font-black text-foreground">
                        Đã được chấp nhận!
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Đang đưa bạn vào phòng…
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
