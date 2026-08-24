/**
 * API route (DEBUG): POST/GET /api/debug/push
 *
 * Dùng để kiểm tra thực tế Web Push có gửi tới thiết bị hay không,
 * không cần phải chơi nguyên 1 ván. Trả về báo cáo JSON:
 *   { ok, mode, sessionCode, playerId, result: { targeted, sent, failed, invalid, targets } }
 *
 * - Nếu truyền `playerId` → gửi TARGETED tới thiết bị của người chọn nhân vật đó
 *   (cùng đường dẫn `notifyScoreChanges` dùng) — test sát với luồng thật nhất.
 * - Nếu không truyền `playerId` → gửi cho toàn bộ phòng (trừ `exceptParticipantId`).
 *
 * Chỉ hoạt động khi PROD !== "true" (dev/test). Ở production trả 403.
 *
 * Cách test trên điện thoại (dễ nhất):
 *   1. Mở app → Settings → chọn nhân vật của bạn.
 *   2. Nhấn "Gửi test push".
 *   3. Background app (hoặc tắt màn hình) → xem có hiện OS notification không.
 * Hoặc curl:
 *   curl -X POST http://localhost:3000/api/debug/push \
 *     -H 'Content-Type: application/json' \
 *     -d '{"sessionCode":"XXXX-XXXX","playerId":"<uuid>"}'
 */
import type { Route } from "./+types/api.debug.push";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import {
  sendPushToPlayer,
  sendPushToSession,
  type PushPayload,
} from "~/lib/push.server";
import { eq } from "drizzle-orm";

interface PushTestInput {
  sessionCode?: string;
  playerId?: string;
  exceptParticipantId?: string;
  title?: string;
  body?: string;
}

function disabledResponse() {
  return new Response("Debug endpoint disabled in production", {
    status: 403,
  });
}

async function runPushTest(input: PushTestInput): Promise<Response> {
  const { sessionCode, playerId, exceptParticipantId, title, body } = input;

  if (!sessionCode) {
    return new Response("sessionCode is required", { status: 400 });
  }

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session) {
    return new Response(`Session not found: ${sessionCode}`, {
      status: 404,
    });
  }

  const payload: PushPayload = {
    title: title || "🔔 Test Push",
    body:
      body ||
      "Đây là thông báo test từ server. Nếu bạn thấy thông báo này, Web Push đang hoạt động!",
    url: `/session/${sessionCode}`,
    tag: "debug-push",
  };

  const result = playerId
    ? await sendPushToPlayer(session.id, playerId, payload)
    : await sendPushToSession(session.id, payload, exceptParticipantId);

  return Response.json({
    ok: true,
    mode: playerId ? "player" : "session",
    sessionCode,
    playerId: playerId ?? null,
    result,
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  if (process.env.PROD === "true") return disabledResponse();
  const url = new URL(request.url);
  return runPushTest({
    sessionCode: url.searchParams.get("sessionCode") ?? undefined,
    playerId: url.searchParams.get("playerId") ?? undefined,
    exceptParticipantId:
      url.searchParams.get("exceptParticipantId") ?? undefined,
    title: url.searchParams.get("title") ?? undefined,
    body: url.searchParams.get("body") ?? undefined,
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (process.env.PROD === "true") return disabledResponse();

  const ct = request.headers.get("content-type") ?? "";
  let input: PushTestInput;

  if (ct.includes("application/json")) {
    input = (await request.json().catch(() => ({}))) as PushTestInput;
  } else {
    const form = await request.formData().catch(() => new URLSearchParams());
    input = {
      sessionCode: form.get("sessionCode")?.toString(),
      playerId: form.get("playerId")?.toString(),
      exceptParticipantId: form.get("exceptParticipantId")?.toString(),
      title: form.get("title")?.toString(),
      body: form.get("body")?.toString(),
    };
  }

  return runPushTest(input);
}
