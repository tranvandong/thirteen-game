import {
  Form,
  redirect,
  useActionData,
  useNavigate,
  useNavigation,
  useParams,
} from "react-router";
import type { Route } from "./+types/join";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { participants } from "~/db/schema/participants";
import { playerDevices } from "~/db/schema/player-devices";
import { eq, and } from "drizzle-orm";
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
} from "lucide-react";
import { useEffect, useState } from "react";
import { createFingerprint } from "~/helpers/fingerprint.helper";

const FINGERPRINT_KEY = "device_fingerprint";
const DEFAULT_TIMEOUT_MS = 8000;

// ── Timeout helper ────────────────────────────────────────────
// Không để bất kỳ bước nào (tạo fingerprint, gọi API) treo vô hạn.

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

/** Đăng ký thiết bị (upsert player_devices) — bắt buộc phải xong trước khi vào session */
async function registerDevice(
  sessionId: string,
  participantId: string,
  fingerprint: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    await fetch(`/api/sessions/${sessionId}/devices`, {
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

/** Kiểm tra thiết bị đã active sẵn trong session này chưa (để skip form join) */
async function resolveExistingParticipant(
  sessionCode: string,
  fingerprint: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(
      `/api/sessions/${sessionCode}/devices/active?fingerprint=${encodeURIComponent(
        fingerprint,
      )}`,
      { signal: controller.signal },
    );
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── Server Loader ─────────────────────────────────────────────
// Không dùng cookie nữa — chỉ verify session tồn tại & còn active.
// Việc "đã join sẵn thì skip form" chuyển sang clientLoader (cần fingerprint).

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
// khỏi bắt nhập tên lại.

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

  // Gọi endpoint mới/sửa đổi để vừa check vừa activate
  if (fingerprint) {
    const response = await fetch(`/api/sessions/${sessionCode}/devices/reconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint }),
    });

    if (response.ok) {
      // Nếu thành công (thiết bị tồn tại và đã được set active), redirect ngay
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
        <p className="text-sm">Đang kiểm tra phòng…</p>
      </div>
    </div>
  );
}

// ── Action ────────────────────────────────────────────────────
// Không redirect ở đây nữa. Chỉ tạo participant và trả kết quả về client —
// client sẽ đăng ký device (registerDevice) xong mới điều hướng sang session,
// để tránh trường hợp layout.tsx không tìm thấy device (device_not_found)
// ngay sau khi vừa join.

export async function action({ params, request }: Route.ActionArgs) {
  const { sessionId } = params;
  const form = await request.formData();
  const displayName = (form.get("displayName") as string)?.trim();
  const fingerprint = (form.get("fingerprint") as string) || null;

  if (!displayName || displayName.length < 1) {
    return { error: "Vui lòng nhập tên hiển thị" };
  }
  if (displayName.length > 100) {
    return { error: "Tên tối đa 100 ký tự" };
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) throw redirect("/");

  const participant = await db.transaction(async (tx) => {
    if (fingerprint) {
      // Giữ invariant "1 thiết bị chỉ active ở 1 session tại 1 thời điểm":
      // tắt active của fingerprint này ở MỌI session khác trước khi join
      // session hiện tại (dù reuse participant cũ hay tạo mới).
      await tx
        .update(playerDevices)
        .set({ status: "left", updatedAt: new Date() })
        .where(
          and(
            eq(playerDevices.fingerprint, fingerprint),
            eq(playerDevices.status, "active"),
          ),
        );

      // Thiết bị này đã từng join session này chưa? (bất kể đang active hay
      // đã left) -> nếu có, reuse lại participant cũ thay vì tạo mới.
      const [existingDevice] = await tx
        .select({ participantId: playerDevices.participantId })
        .from(playerDevices)
        .where(
          and(
            eq(playerDevices.sessionId, session.id),
            eq(playerDevices.fingerprint, fingerprint),
          ),
        )
        .limit(1);

      if (existingDevice) {
        const [reused] = await tx
          .update(participants)
          .set({ displayName })
          .where(eq(participants.id, existingDevice.participantId))
          .returning({
            id: participants.id,
            displayName: participants.displayName,
          });

        // Kích hoạt lại thiết bị ở session này (phòng trường hợp đang 'left')
        await tx
          .update(playerDevices)
          .set({ status: "active", updatedAt: new Date() })
          .where(
            and(
              eq(playerDevices.sessionId, session.id),
              eq(playerDevices.fingerprint, fingerprint),
            ),
          );

        return reused;
      }
    }

    // Thiết bị chưa từng join session này (hoặc không gửi fingerprint)
    // -> tạo participant mới. player_devices row sẽ được tạo ở client
    // (registerDevice) ngay sau khi action này trả về.
    const [created] = await tx
      .insert(participants)
      .values({
        sessionId: session.id,
        displayName,
        role: "member",
      })
      .returning({
        id: participants.id,
        displayName: participants.displayName,
      });

    return created;
  });

  return { participant };
}

// ── Component ─────────────────────────────────────────────────

export default function JoinPage({ loaderData }: Route.ComponentProps) {
  const { sessionId, fingerprint } = loaderData;
  const { sessionId: sessionCode } = useParams();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();

  const isSubmitting = navigation.state === "submitting";
  // "Đang vào phòng" bao trùm cả lúc submit form lẫn lúc đang registerDevice,
  // để nút không bị nhấp nháy quay lại trạng thái idle giữa 2 bước.
  const [isJoining, setIsJoining] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Sau khi action tạo participant thành công -> đăng ký device rồi mới vào session
  useEffect(() => {
    if (
      !actionData ||
      !("participant" in actionData) ||
      !actionData.participant
    ) {
      return;
    }

    let cancelled = false;

    async function finishJoin() {
      setIsJoining(true);
      setDeviceError(null);

      try {
        const deviceFingerprint =
          fingerprint ?? (await getOrCreateFingerprint());
        await registerDevice(
          sessionId,
          actionData!.participant!.id,
          deviceFingerprint,
        );
        if (!cancelled) navigate(`/session/${sessionCode}`, { replace: true });
      } catch {
        // Không tạo được fingerprint / đăng ký device thất bại (mạng, timeout...)
        // -> báo lỗi, cho phép user thử lại thay vì kẹt ở trạng thái loading mãi.
        if (!cancelled) {
          setIsJoining(false);
          setDeviceError(
            "Không thể đăng ký thiết bị. Vui lòng kiểm tra kết nối và thử lại.",
          );
        }
      }
    }

    finishJoin();
    return () => {
      cancelled = true;
    };
  }, [actionData, sessionCode, navigate]);

  const busy = isSubmitting || isJoining;
  const formError =
    actionData && "error" in actionData ? actionData.error : undefined;

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
            Nhập tên hiển thị để vào bàn chơi và theo dõi điểm theo thời gian
            thực.
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
            <Form method="POST" className="flex flex-col gap-4">
              <input
                type="hidden"
                name="fingerprint"
                value={fingerprint ?? ""}
              />

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
                    placeholder="Ví dụ: Hùng"
                    maxLength={100}
                    autoFocus
                    autoComplete="off"
                    disabled={busy}
                    className="h-13 rounded-2xl bg-background pr-11 text-base font-semibold shadow-sm"
                  />
                  <Gamepad2 className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/50" />
                </div>

                {formError && (
                  <p className="text-xs text-destructive">{formError}</p>
                )}
                {deviceError && (
                  <p className="text-xs text-destructive">{deviceError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="h-13 rounded-2xl text-base font-black shadow-xl shadow-primary/20"
                size="lg"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="mr-2 size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Đang vào phòng...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Vào phòng
                  </>
                )}
              </Button>
            </Form>

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
              Sau khi vào phòng, bạn có thể xem bảng điểm, lịch sử ván đấu và
              cập nhật kết quả realtime.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
