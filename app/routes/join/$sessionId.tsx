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
import { Spade, Users } from "lucide-react";

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 text-primary mb-8">
        <Spade className="size-7" />
        <span className="text-2xl font-bold">Thirteen Game</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary mx-auto mb-2">
            <Users className="size-6" />
          </div>
          <CardTitle className="text-xl">Tham gia phòng</CardTitle>
          <p className="text-sm text-muted-foreground">
            Mã phòng:{" "}
            <span className="font-mono font-semibold text-foreground">
              {sessionCode}
            </span>
          </p>
        </CardHeader>

        <CardContent>
          <Form method="POST" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Tên hiển thị</Label>
              <Input
                id="displayName"
                name="displayName"
                placeholder="Nhập tên của bạn..."
                maxLength={100}
                autoFocus
                autoComplete="off"
                disabled={isSubmitting}
              />
              {actionData?.error && (
                <p className="text-xs text-destructive">{actionData.error}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Đang vào phòng..." : "Vào phòng"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}