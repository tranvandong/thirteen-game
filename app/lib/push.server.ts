/**
 * lib/push.server.ts
 *
 * Gửi Web Push (OS-level) tới thiết bị participant bằng thư viện `web-push`
 * (VAPID). Dùng cho 2 trường hợp:
 *   - ai đó chọn nhân vật                    → push cho cả phòng (trừ người chọn)
 *   - nhân vật có biến động điểm / thứ hạng → push TARGETED tới thiết bị của
 *     người tham gia đã chọn nhân vật đó.
 *
 * Subscription được lưu ở `player_devices.pushToken` (JSON, do
 * `registerDevice` ở layout.tsx tạo qua pushManager).
 *
 * Yêu cầu env (cùng 1 cặp VAPID):
 *   - Client: VITE_VAPID_PUBLIC_KEY  (dùng để subscribe)
 *   - Server: VAPID_PRIVATE_KEY      (dùng để ký gửi push)
 *   - Server: VAPID_SUBJECT         (mailto:, tuỳ chọn)
 * Nếu chưa cấu hình, dev fallback sẽ tự sinh cặp khoá (nhưng client vẫn cần
 * VITE_VAPID_PUBLIC_KEY khớp mới subscribe được).
 */

import webpush from "web-push";
import { db } from "~/db/client.server";
import { playerDevices } from "~/db/schema/player-devices";
import { participantPlayers } from "~/db/schema/participant-players";
import { participants } from "~/db/schema/participants";
import { eq, and, ne } from "drizzle-orm";

/** Ngưỡng "biến động điểm lớn" (điểm) để push thông báo. */
export const PUSH_SWING_THRESHOLD = 30;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Nhóm notification (tag) — các push cùng tag sẽ thay thế nhau. */
  tag?: string;
}

let vapidReady = false;

function ensureVapid(): void {
  const subject = process.env.VAPID_SUBJECT ?? "mailto:push@thirteen.game";
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    // Cặp khoá thật → set và cache (chỉ set 1 lần là đủ).
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
    return;
  }

  // Chưa cấu hình đủ: dùng khoá tạm NHƯNG KHÔNG cache vĩnh viễn.
  // Nếu process được khởi động trước khi env có sẵn, lần gửi sau vẫn
  // re-check env (tránh ký bằng khoá tạm không khớp với public key
  // mà client đã subscribe → push bị push service từ chối).
  const keys = webpush.generateVAPIDKeys();
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  console.warn(
    "[Push] VAPID chưa cấu hình đầy đủ — dùng khoá tạm (push sẽ lỗi). " +
      "Thiết lập VITE_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY CÙNG 1 cặp, " +
      "sau đó RESTART process Socket.",
  );
}

function parseSubscription(token: string | null) {
  if (!token) return null;
  try {
    const sub = JSON.parse(token);
    if (sub && typeof sub.endpoint === "string" && sub.keys) return sub;
  } catch {
    // token hỏng — bỏ qua
  }
  return null;
}

async function sendOne(
  token: string | null,
  payload: PushPayload,
): Promise<void> {
  const sub = parseSubscription(token);
  if (!sub) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log(
      "[Push] sent OK →",
      (sub.endpoint || "").slice(0, 48) + "…",
    );
  } catch (err: any) {
    // 404/410 = subscription không còn hợp lệ (user huỷ quyền / gỡ app) →
    // nên xoá pushToken trong DB. Ở đây chỉ log, không block luồng khác.
    const status = err?.statusCode ?? err?.status;
    const body =
      typeof err?.body === "string" ? err.body.slice(0, 240) : "";
    if (status === 404 || status === 410) {
      console.warn("[Push] subscription không hợp lệ (404/410) — cần dọn pushToken.");
    } else {
      console.error(
        `[Push] sendNotification thất bại: status=${status} ` +
          `msg=${err?.message ?? err} body=${body}`,
      );
    }
  }
}

/** Gửi push tới 1 participant (tất cả thiết bị active của họ). */
export async function sendPushToParticipant(
  participantId: string,
  payload: PushPayload,
): Promise<void> {
  ensureVapid();
  const devices = await db
    .select({ pushToken: playerDevices.pushToken })
    .from(playerDevices)
    .where(
      and(
        eq(playerDevices.participantId, participantId),
        eq(playerDevices.status, "active"),
      ),
    )
    .limit(50);
  await Promise.all(devices.map((d) => sendOne(d.pushToken, payload)));
}

/**
 * Gửi push TARGETED tới thiết bị của người tham gia đã chọn nhân vật
 * (playerId) trong session. Đây là cơ chế "thông báo tới thiết bị được
 * kết nối với nhân vật".
 */
export async function sendPushToPlayer(
  sessionId: string,
  playerId: string,
  payload: PushPayload,
): Promise<void> {
  ensureVapid();
  const rows = await db
    .select({ pushToken: playerDevices.pushToken })
    .from(participantPlayers)
    .innerJoin(
      playerDevices,
      and(
        eq(playerDevices.participantId, participantPlayers.participantId),
        eq(playerDevices.sessionId, sessionId),
        eq(playerDevices.status, "active"),
      ),
    )
    .where(eq(participantPlayers.playerId, playerId))
    .limit(50);
  console.log(
    `[Push] sendPushToPlayer player=${playerId}: tìm thấy ${rows.length} thiết bị`,
  );
  await Promise.all(rows.map((r) => sendOne(r.pushToken, payload)));
}

/**
 * Gửi push cho mọi participant trong session. Truyền `exceptParticipantId`
 * để không push cho chính người thao tác.
 */
export async function sendPushToSession(
  sessionId: string,
  payload: PushPayload,
  exceptParticipantId?: string,
): Promise<void> {
  ensureVapid();
  const where = exceptParticipantId
    ? and(
        eq(participants.sessionId, sessionId),
        ne(participants.id, exceptParticipantId),
      )
    : eq(participants.sessionId, sessionId);

  const list = await db
    .select({ id: participants.id })
    .from(participants)
    .where(where)
    .limit(200);

  await Promise.all(
    list.map((p) => sendPushToParticipant(p.id, payload)),
  );
}
