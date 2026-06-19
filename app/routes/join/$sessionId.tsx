import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/join";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { participants } from "~/db/schema/participants";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CheckCircle2, Gamepad2, ShieldCheck, Spade, Users } from "lucide-react";

// ── Helpers cookie ────────────────────────────────────────────

const PARTICIPANT_COOKIE = "participant_id";

function getParticipantIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith(`${PARTICIPANT_COOKIE}=`));
  return match ? decodeURIComponent(match.trim().split("=")[1]) : null;
}

function setParticipantCookie(participantId: string): string {
  return `${PARTICIPANT_COOKIE}=${encodeURIComponent(participantId)}; Path=/; Max-Age=${
    60 * 60 * 24 * 30
  }; SameSite=Lax`;
}

// ── Loader ────────────────────────────────────────────────────
// Nếu đã có cookie hợp lệ → skip trang join, vào thẳng session

export async function loader({ params, request }: Route.LoaderArgs) {
  const { sessionId } = params;
  const cookieHeader = request.headers.get("Cookie");
  const participantIdFromCookie = getParticipantIdFromCookie(cookieHeader);

  // Verify session tồn tại
  const [session] = await db
    .select({ code: sessions.code, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) throw redirect("/");
  if (session.status === "finished") throw redirect("/");

  // Nếu đã có participant hợp lệ cho session này → vào thẳng
  if (participantIdFromCookie) {
    const [existing] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.id, participantIdFromCookie))
      .limit(1);

    if (existing) throw redirect(`/session/${sessionId}`);
  }

  return { sessionCode: session.code };
}

// ── Action ────────────────────────────────────────────────────

export async function action({ params, request }: Route.ActionArgs) {
  const { sessionId } = params;
  const form = await request.formData();
  const displayName = (form.get("displayName") as string)?.trim();

  if (!displayName || displayName.length < 1) {
    return { error: "Vui lòng nhập tên hiển thị" };
  }
  if (displayName.length > 100) {
    return { error: "Tên tối đa 100 ký tự" };
  }

  // Tìm session theo code
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) throw redirect("/");

  // Tạo participant mới với role "member"
  const [newParticipant] = await db
    .insert(participants)
    .values({
      sessionId: session.id,
      displayName,
      role: "member",
    })
    .returning({ id: participants.id });

  // Set cookie và redirect vào session
  return redirect(`/session/${sessionId}`, {
    headers: {
      "Set-Cookie": setParticipantCookie(newParticipant.id),
    },
  });
}

// ── Component ─────────────────────────────────────────────────

export default function JoinPage() {
  const { sessionCode } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // actionData không có type helper ở đây nên cast thủ công
  const actionData = undefined as { error?: string } | undefined;

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

            <CardTitle className="text-xl font-black">Bạn đã được mời</CardTitle>

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
                    disabled={isSubmitting}
                    className="h-13 rounded-2xl bg-background pr-11 text-base font-semibold shadow-sm"
                  />
                  <Gamepad2 className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/50" />
                </div>

                {actionData?.error && (
                  <p className="text-xs text-destructive">{actionData.error}</p>
                )}
              </div>

              <Button
                type="submit"
                className="h-13 rounded-2xl text-base font-black shadow-xl shadow-primary/20"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
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