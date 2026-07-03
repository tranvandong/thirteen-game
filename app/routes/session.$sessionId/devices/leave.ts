/**
 * PATCH /api/sessions/:sessionId/devices/leave
 * Body: { fingerprint: string }
 *
 * Đánh dấu thiết bị (fingerprint) đã thoát khỏi session này:
 * set player_devices.status = 'left'. Chỉ update bản ghi đang 'active' —
 * nếu thiết bị đã left từ trước (hoặc chưa từng join) thì coi như no-op
 * thành công (idempotent), tránh lỗi vặt khi user bấm thoát nhiều lần
 * hoặc request bị gửi trùng lúc điều hướng (keepalive).
 *
 * Note: params.sessionId ở đây là session code, giống convention ở layout.tsx.
 *
 * Response 200: { success: true, left: boolean }
 * Response 400: { error: "missing_fingerprint" }
 * Response 404: { error: "session_not_found" }
 * Response 405: { error: "method_not_allowed" }
 */

import { playerDevices } from "~/db/schema/player-devices";
import { sessions } from "~/db/schema/sessions";
import { eq, and } from "drizzle-orm";
import { db } from "~/db/client.server";

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { sessionId: string };
}) {
  if (request.method !== "PATCH") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const sessionCode = params.sessionId;

  let fingerprint: string | undefined;
  try {
    const body = await request.json();
    fingerprint = body?.fingerprint;
  } catch {
    // body rỗng hoặc không phải JSON hợp lệ
  }

  if (!fingerprint) {
    return Response.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  // 1. Tìm session theo code
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session) {
    return Response.json({ error: "session_not_found" }, { status: 404 });
  }

  // 2. Set status = 'left' cho bản ghi đang active của fingerprint trong session
  const updated = await db
    .update(playerDevices)
    .set({ status: "left", updatedAt: new Date() })
    .where(
      and(
        eq(playerDevices.sessionId, session.id),
        eq(playerDevices.fingerprint, fingerprint),
        eq(playerDevices.status, "active"),
      ),
    )
    .returning({ id: playerDevices.id });

  return Response.json({ success: true, left: updated.length > 0 });
}