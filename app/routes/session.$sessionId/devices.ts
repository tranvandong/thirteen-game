/**
 * API route: POST /api/sessions/:sessionId/devices
 *
 * Upsert thiết bị cho participant trong session.
 * Được gọi từ client sau khi layout hydrate xong.
 */
import type { Route } from "./+types/devices";
import { db } from "~/db/client.server";
import { playerDevices } from "~/db/schema/player-devices";
import { participants } from "~/db/schema/participants";
import { and, eq } from "drizzle-orm";

interface DevicePayload {
  participantId: string;
  fingerprint: string;
  platform: "ios" | "android" | "web";
  pushToken?: string;
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const sessionId = params.sessionId;
  let body: DevicePayload;

  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { participantId, fingerprint, platform, pushToken } = body;

  if (!participantId || !fingerprint || !platform) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Kiểm tra participant thuộc session này
  const [participant] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.sessionId, sessionId),
      ),
    )
    .limit(1);

  if (!participant) {
    return new Response("Participant not found in session", { status: 404 });
  }

  // Upsert: nếu fingerprint đã tồn tại trong session thì update
  // participantId + pushToken (người dùng có thể đổi tên / cấp quyền sau)
  await db
    .insert(playerDevices)
    .values({
      sessionId,
      participantId,
      fingerprint,
      platform,
      pushToken: pushToken ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [playerDevices.sessionId, playerDevices.fingerprint], // unique constraint
      set: {
        participantId,
        ...(pushToken ? { pushToken } : {}),
        updatedAt: new Date(),
      },
    });

  return new Response(null, { status: 204 });
}
