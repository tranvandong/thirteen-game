/**
 * GET /api/sessions/active-by-device?fingerprint=<fingerprint>
 *
 * Tìm session đang active (status = 'active') mà thiết bị có fingerprint
 * đã từng tham gia. Dùng để tự động redirect người dùng quay lại phiên chơi.
 *
 * Response 200: { sessionCode: string }
 * Response 404: { error: "not_found" }
 * Response 400: { error: "missing_fingerprint" }
 */

import { playerDevices } from "~/db/schema/player-devices";
import { sessions } from "~/db/schema/sessions";
import { eq, and } from "drizzle-orm";
import { db } from "~/db/client.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const fingerprint = url.searchParams.get("fingerprint");

  if (!fingerprint) {
    return Response.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  // Tìm bản ghi player_devices theo fingerprint, join với sessions
  // để lọc chỉ lấy session có status = 'active'.
  // Đồng thời chỉ xét player_devices.status = 'active' — nếu thiết bị đã
  // "leave" khỏi session đó thì không được tự động kéo về nữa, dù session
  // vẫn còn đang diễn ra.
  const result = await db
    .select({
      sessionCode: sessions.code,
    })
    .from(playerDevices)
    .innerJoin(
      sessions,
      and(
        eq(sessions.id, playerDevices.sessionId),
        eq(sessions.status, "active"),
      ),
    )
    .where(
      and(
        eq(playerDevices.fingerprint, fingerprint),
        eq(playerDevices.status, "active"),
      ),
    )
    // Nhờ partial unique index (fingerprint, status='active') nên tối đa
    // chỉ có 1 bản ghi thỏa điều kiện — limit(1) chỉ để an toàn.
    .limit(1);

  if (!result.length) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ sessionCode: result[0].sessionCode });
}