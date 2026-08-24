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
export { PUSH_SWING_THRESHOLD } from "./push-rules";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Nhóm notification (tag) — các push cùng tag sẽ thay thế nhau. */
  tag?: string;
}

/** Kết quả gửi tới 1 thiết bị cụ thể. */
export interface PushSendTarget {
  endpoint: string;
  ok: boolean;
  status?: number;
  reason?: string;
}

/** Báo cáo tổng hợp của 1 lượt gửi push — dùng cho debug / endpoint test. */
export interface PushSendResult {
  /** Số thiết bị có pushToken hợp lệ được thử gửi. */
  targeted: number;
  /** Gửi thành công. */
  sent: number;
  /** Lỗi gửi (bao gồm cả subscription không hợp lệ). */
  failed: number;
  /** Subscription 404/410 — cần dọn pushToken trong DB. */
  invalid: number;
  targets: PushSendTarget[];
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
  deviceId?: string,
): Promise<PushSendTarget> {
  const sub = parseSubscription(token);
  const endpoint = (sub?.endpoint || "(no-endpoint)").slice(0, 48);
  if (!sub) {
    return { endpoint: "(missing-token)", ok: false, reason: "missing-token" };
  }
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log(`[Push] ✓ gửi OK → ${endpoint}`);
    return { endpoint, ok: true };
  } catch (err: any) {
    // 404/410 = subscription không còn hợp lệ (user huỷ quyền / gỡ app) →
    // dọn pushToken trong DB để lần sau thiết bị re-subscribe (tránh treo vĩnh viễn).
    const status = err?.statusCode ?? err?.status;
    const bodyText =
      typeof err?.body === "string" ? err.body.slice(0, 240) : "";
    if (status === 404 || status === 410) {
      console.warn(
        `[Push] ✗ subscription không hợp lệ (${status}) → ${endpoint}.`,
      );
      if (deviceId) {
        await db
          .update(playerDevices)
          .set({ pushToken: null })
          .where(eq(playerDevices.id, deviceId));
        console.warn(
          `[Push] ✗ đã dọn pushToken của device ${deviceId} → thiết bị sẽ re-subscribe ở lần mở sau.`,
        );
      }
      return { endpoint, ok: false, status, reason: "invalid-subscription" };
    }
    console.error(
      `[Push] ✗ sendNotification thất bại: status=${status} ` +
        `msg=${err?.message ?? err} body=${bodyText}`,
    );
    return {
      endpoint,
      ok: false,
      status,
      reason: String(err?.message ?? err),
    };
  }
}

/**
 * Gửi push TARGETED tới thiết bị của người tham gia đã chọn nhân vật
 * (playerId) trong session. Trả về báo cáo (targeted/sent/failed/invalid)
 * để dễ debug / test thực tế trên thiết bị.
 */
export async function sendPushToPlayer(
  sessionId: string,
  playerId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  ensureVapid();
  const rows = await db
    .select({ id: playerDevices.id, pushToken: playerDevices.pushToken })
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

  const result: PushSendResult = {
    targeted: 0,
    sent: 0,
    failed: 0,
    invalid: 0,
    targets: [],
  };
  for (const r of rows) {
    const t = await sendOne(r.pushToken, payload, r.id);
    if (t.reason === "missing-token") continue;
    result.targeted++;
    result.targets.push(t);
    if (t.ok) result.sent++;
    else {
      result.failed++;
      if (t.reason === "invalid-subscription") result.invalid++;
    }
  }
  console.log(
    `[Push] sendPushToPlayer player=${playerId}: targeted=${result.targeted} sent=${result.sent} failed=${result.failed} invalid=${result.invalid}`,
  );
  return result;
}

/**
 * Gửi push cho mọi participant trong session. Truyền `exceptParticipantId`
 * để không push cho chính người thao tác. Trả về báo cáo để dễ debug.
 */
export async function sendPushToSession(
  sessionId: string,
  payload: PushPayload,
  exceptParticipantId?: string,
): Promise<PushSendResult> {
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

  const result: PushSendResult = {
    targeted: 0,
    sent: 0,
    failed: 0,
    invalid: 0,
    targets: [],
  };
  for (const p of list) {
    const devs = await db
      .select({ id: playerDevices.id, pushToken: playerDevices.pushToken })
      .from(playerDevices)
      .where(
        and(
          eq(playerDevices.participantId, p.id),
          eq(playerDevices.status, "active"),
        ),
      )
      .limit(50);
    for (const d of devs) {
      const t = await sendOne(d.pushToken, payload, d.id);
      if (t.reason === "missing-token") continue;
      result.targeted++;
      result.targets.push(t);
      if (t.ok) result.sent++;
      else {
        result.failed++;
        if (t.reason === "invalid-subscription") result.invalid++;
      }
    }
  }
  console.log(
    `[Push] sendPushToSession session=${sessionId}: targeted=${result.targeted} sent=${result.sent} failed=${result.failed} invalid=${result.invalid}`,
  );
  return result;
}
