/**
 * GET /api/sessions/:sessionId/devices/active?fingerprint=<fingerprint>
 *
 * Tìm participant đang gắn với thiết bị (fingerprint) trong ĐÚNG session này,
 * với điều kiện player_devices.status = 'active'. Dùng ở layout của session
 * để xác thực thiết bị mỗi khi vào phòng (checkActiveSession) — không dùng
 * cookie nữa.
 *
 * Note: params.sessionId ở đây là session code (route dạng /session/:sessionId),
 * giống convention đang dùng ở layout.tsx.
 *
 * Response 200: { participant: { id, displayName, role, selectedPlayerId } }
 *   - selectedPlayerId: id nhân vật participant này đã chọn (null nếu chưa chọn)
 * Response 400: { error: "missing_fingerprint" }
 * Response 404: { error: "session_not_found" | "device_not_found" }
 */

import { playerDevices } from "~/db/schema/player-devices";
import { participants } from "~/db/schema/participants";
import { participantPlayers } from "~/db/schema/participant-players";
import { sessions } from "~/db/schema/sessions";
import { eq, and } from "drizzle-orm";
import { db } from "~/db/client.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { sessionId: string };
}) {
  const url = new URL(request.url);
  const fingerprint = url.searchParams.get("fingerprint");
  const sessionCode = params.sessionId;

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

  // 2. Tìm bản ghi player_devices active của fingerprint trong session này,
  //    join sang participants để lấy thông tin trả về cho client.
  //    leftJoin participantPlayers để biết participant đã chọn nhân vật nào.
  const [row] = await db
    .select({
      id: participants.id,
      displayName: participants.displayName,
      role: participants.role,
      selectedPlayerId: participantPlayers.playerId,
    })
    .from(playerDevices)
    .innerJoin(participants, eq(participants.id, playerDevices.participantId))
    .leftJoin(
      participantPlayers,
      and(
        eq(participantPlayers.participantId, participants.id),
        eq(participantPlayers.sessionId, session.id),
      ),
    )
    .where(
      and(
        eq(playerDevices.sessionId, session.id),
        eq(playerDevices.fingerprint, fingerprint),
        eq(playerDevices.status, "active"),
      ),
    )
    .limit(1);

  if (!row) {
    return Response.json({ error: "device_not_found" }, { status: 404 });
  }

  return Response.json({
    participant: {
      id: row.id,
      displayName: row.displayName,
      role: row.role,
      selectedPlayerId: row.selectedPlayerId ?? null,
    },
  });
}
