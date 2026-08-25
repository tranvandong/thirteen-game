/**
 * lib/socket.server.ts
 *
 * Socket.IO server. Chạy trong process riêng (port 3000), được Vite dev
 * proxy `/socket.io` tới. Browser luôn kết nối được tới process này.
 *
 * Quan trọng: action (lưu/xoá ván) chạy ở process Vite dev, KHÔNG có
 * io instance → không thể tự broadcast. Vì vậy client phát sự kiện
 * `round:publish` / `round:delete` tới process này, và chính process này
 * đọc lại DB (authoritative) rồi broadcast `round:finished` /
 * `score:updated` / `round:deleted` cho toàn bộ room.
 */

import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { desc, eq, and } from "drizzle-orm";

import { db } from "~/db/client.server";
import {
  joinRequests,
  participants,
  sessions,
  sessionTotals,
  rounds,
  roundResults,
  playerDevices,
  players,
} from "~/db/schema";
import { getRoundMeta } from "./round.server";
import { sendPushToPlayer } from "./push.server";
import { buildScoreChangeNotification } from "./push-rules";

// ── Singleton ─────────────────────────────────────────────────

let io: Server | null = null;

export function getIO(): Server {
  if (!io)
    throw new Error(
      "Socket.IO chưa được khởi tạo. Gọi initSocketServer() trước.",
    );
  return io;
}

/** Trả về io nếu đã init, ngược lại null (vd: process không chạy socket). */
function getIOSafe(): Server | null {
  try {
    return getIO();
  } catch {
    return null;
  }
}

/**
 * Lấy room name chuẩn từ sessionId.
 * Dùng chung ở cả server handler và action routes.
 */
export function sessionRoom(sessionCode: string) {
  return `session:${sessionCode}`;
}

// ── Helpers (authoritative, đọc từ DB) ────────────────────────

async function readTotals(
  sessionDbId: string,
): Promise<Array<{ playerId: string; totalScore: number }>> {
  const rows = await db
    .select({
      playerId: sessionTotals.playerId,
      totalScore: sessionTotals.totalScore,
    })
    .from(sessionTotals)
    .where(eq(sessionTotals.sessionId, sessionDbId));

  return rows.map((r) => ({
    playerId: r.playerId,
    totalScore: Number(r.totalScore),
  }));
}

async function resolveSessionDbId(
  sessionCode: string,
): Promise<string | null> {
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);
  return session?.id ?? null;
}

/**
 * Sau khi 1 ván được lưu: đọc lại totals + round mới nhất + roundMeta
 * từ DB rồi broadcast cho room.
 */
export async function broadcastRoundSaved(
  sessionCode: string,
  exceptParticipantId?: string,
) {
  const io = getIOSafe();
  if (!io) return;

  const sessionDbId = await resolveSessionDbId(sessionCode);
  if (!sessionDbId) return;

  const totals = await readTotals(sessionDbId);
  const roundMeta = await getRoundMeta(sessionDbId);
  const [round] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.sessionId, sessionDbId))
    .orderBy(desc(rounds.roundNo))
    .limit(1);

  const room = sessionRoom(sessionCode);
  io.to(room).emit("round:finished", {
    sessionCode,
    round,
    roundMeta,
    totals,
  });
  // actorParticipantId để client bỏ qua toast thông báo trên thiết bị của
  // người vừa ghi ván (họ đã biết kết quả).
  io.to(room).emit("score:updated", {
    sessionCode,
    totals,
    actorParticipantId: exceptParticipantId,
  });

  // Web Push OS-level: thông báo thiết bị của người tham gia được kết nối
  // với nhân vật có biến động điểm lớn / đổi thứ hạng. Loại thiết bị của
  // người vừa ghi ván (exceptParticipantId).
  try {
    await notifyScoreChanges(
      sessionDbId,
      sessionCode,
      round.id,
      totals,
      exceptParticipantId,
    );
  } catch (err) {
    console.error("notifyScoreChanges failed:", err);
  }
}

/**
 * Sau khi lưu ván, tính biến động của từng nhân vật (so với totals trước ván)
 * và gửi Web Push TARGETED tới thiết bị của người đã chọn nhân vật đó.
 * - prevTotals = newTotals - điểm ván này (tái tạo từ round_results)
 * - push nếu |Δđiểm| ≥ PUSH_SWING_THRESHOLD HOẶC tổng điểm đổi dấu (âm↔dương).
 *   Cùng rule với toast in-app (xem app/lib/push-rules.ts).
 */
async function notifyScoreChanges(
  sessionDbId: string,
  sessionCode: string,
  roundId: string,
  newTotals: Array<{ playerId: string; totalScore: number }>,
  exceptParticipantId?: string,
) {
  const results = await db
    .select({ playerId: roundResults.playerId, score: roundResults.score })
    .from(roundResults)
    .where(eq(roundResults.roundId, roundId));
  if (!results.length) return;

  const newMap = new Map(
    newTotals.map((t) => [t.playerId, Number(t.totalScore)]),
  );

  // Tái tạo totals trước ván: prev = new - điểm ván này
  const prevMap = new Map<string, number>();
  for (const [pid, total] of newMap) {
    const r = results.find((x) => x.playerId === pid);
    prevMap.set(pid, total - (r ? Number(r.score) : 0));
  }

  // Map tên nhân vật
  const pls = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.sessionId, sessionDbId));
  const nameMap = new Map(pls.map((p) => [p.id, p.name]));

  for (const r of results) {
    const pid = r.playerId;
    const name = nameMap.get(pid) ?? "Nhân vật";
    const delta = Number(r.score);
    const prevTotal = prevMap.get(pid) ?? 0;
    const newTotal = newMap.get(pid) ?? 0;

    // Dùng chung rule với toast in-app (app/lib/push-rules.ts):
    // thông báo khi |Δđiểm| ≥ ngưỡng HOẶC tổng điểm đổi dấu (âm↔dương).
    const notif = buildScoreChangeNotification({ name, delta, prevTotal, newTotal });
    if (!notif.shouldNotify) continue;

    const pushResult = await sendPushToPlayer(
      sessionDbId,
      pid,
      {
        title: notif.title,
        body: notif.body,
        url: `/session/${sessionCode}`,
        tag: `player-${pid}`,
      },
      exceptParticipantId,
    );
    console.log(
      `[Push] notifyScoreChanges → player ${pid} (${name}): ` +
        `delta=${delta}, total ${prevTotal}→${newTotal}, ` +
        `push sent=${pushResult.sent}/${pushResult.targeted} ` +
        `(failed=${pushResult.failed}, invalid=${pushResult.invalid})`,
    );
  }
}

/**
 * Sau khi 1 ván bị xoá: broadcast round:deleted + score:updated (totals
 * sau khi hoàn trả điểm).
 */
export async function broadcastRoundDeleted(
  sessionCode: string,
  roundId: string,
) {
  const io = getIOSafe();
  if (!io) return;

  const sessionDbId = await resolveSessionDbId(sessionCode);
  if (!sessionDbId) return;

  const totals = await readTotals(sessionDbId);
  const room = sessionRoom(sessionCode);
  io.to(room).emit("round:deleted", { sessionCode, roundId });
  io.to(room).emit("score:updated", { sessionCode, totals });
}

// ── Init ──────────────────────────────────────────────────────

export function initSocketServer(httpServer: HttpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on("join-session", ({ sessionCode, participantId, displayName }) => {
      const room = sessionRoom(sessionCode);

      socket.join(room);

      socket.data.sessionCode = sessionCode;
      socket.data.participantId = participantId;
      socket.data.displayName = displayName;

      socket.to(room).emit("participant-joined", {
        participantId,
        displayName,
      });
    });

    socket.on("leave-session", ({ sessionId }) => {
      socket.leave(sessionRoom(sessionId));
    });

    // ── Helpers: chỉ chủ phòng (socket đang mang participantId của owner)
    //    mới được duyệt / từ chối / đá người chơi. ──────────────────────────
    async function assertOwner(sessionDbId: string): Promise<boolean> {
      const [session] = await db
        .select({ ownerParticipantId: sessions.ownerParticipantId })
        .from(sessions)
        .where(eq(sessions.id, sessionDbId))
        .limit(1);

      return (
        !!session &&
        !!socket.data.participantId &&
        session.ownerParticipantId === socket.data.participantId
      );
    }

    // ── Người lạ gửi yêu cầu tham gia (realtime) ──────────────────────────
    socket.on(
      "send-join-request",
      async ({ sessionCode, displayName }) => {
        const sessionDbId = await resolveSessionDbId(sessionCode);
        if (!sessionDbId) return;

        const [req] = await db
          .insert(joinRequests)
          .values({
            sessionId: sessionDbId,
            displayName,
            status: "pending",
            requestToken: crypto.randomUUID(),
          })
          .returning();

        const room = sessionRoom(sessionCode);
        // Requester tham gia room để nhận event approve/reject realtime
        socket.join(room);
        socket.data.sessionCode = sessionCode;

        // Báo riêng cho người gửi biết id request vừa tạo (để match sau này)
        socket.emit("join-request-sent", {
          requestId: req.id,
          sessionCode,
        });

        // Broadcast cho cả room — chủ phòng sẽ hiện toast + cập nhật list
        io!.to(room).emit("join-request-created", {
          requestId: req.id,
          displayName,
          sessionCode,
        });
      },
    );

    // ── Chủ phòng duyệt yêu cầu ───────────────────────────────────────────
    socket.on(
      "approve-join-request",
      async ({ sessionCode, requestId }) => {
        const sessionDbId = await resolveSessionDbId(sessionCode);
        if (!sessionDbId) return;
        if (!(await assertOwner(sessionDbId))) return;

        // Đọc request để lấy displayName chuẩn và chặn duyệt 2 lần
        const [reqRow] = await db
          .select()
          .from(joinRequests)
          .where(eq(joinRequests.id, requestId))
          .limit(1);
        if (!reqRow || reqRow.status !== "pending") return;

        await db
          .update(joinRequests)
          .set({
            status: "approved",
            approvedBy: socket.data.participantId,
            approvedAt: new Date(),
          })
          .where(eq(joinRequests.id, requestId));

        const [participant] = await db
          .insert(participants)
          .values({
            sessionId: sessionDbId,
            displayName: reqRow.displayName,
            role: "member",
          })
          .returning();

        const room = sessionRoom(sessionCode);
        io!.to(room).emit("participant-approved", {
          requestId,
          participant: {
            id: participant.id,
            displayName: participant.displayName,
            role: participant.role,
          },
        });
      },
    );

    // ── Chủ phòng từ chối yêu cầu ─────────────────────────────────────────
    socket.on(
      "reject-join-request",
      async ({ sessionCode, requestId }) => {
        const sessionDbId = await resolveSessionDbId(sessionCode);
        if (!sessionDbId) return;
        if (!(await assertOwner(sessionDbId))) return;

        const [reqRow] = await db
          .select()
          .from(joinRequests)
          .where(eq(joinRequests.id, requestId))
          .limit(1);
        if (!reqRow || reqRow.status !== "pending") return;

        await db
          .update(joinRequests)
          .set({ status: "rejected" })
          .where(eq(joinRequests.id, requestId));

        const room = sessionRoom(sessionCode);
        io!.to(room).emit("join-request-rejected", {
          requestId,
          displayName: reqRow.displayName,
          sessionCode,
        });
      },
    );

    // ── Chủ phòng đá người tham gia khỏi phòng (đá cứng) ──────────────────
    socket.on(
      "kick-participant",
      async ({ sessionCode, participantId }) => {
        const sessionDbId = await resolveSessionDbId(sessionCode);
        if (!sessionDbId) return;
        if (!(await assertOwner(sessionDbId))) return;

        // Xoá participant + device rows (participant_players / player_devices
        // cascade theo participantId). Không cho đá chính chủ phòng.
        if (participantId === socket.data.participantId) return;

        await db
          .delete(participants)
          .where(
            and(
              eq(participants.id, participantId),
              eq(participants.sessionId, sessionDbId),
            ),
          );

        const room = sessionRoom(sessionCode);
        io!.to(room).emit("participant-kicked", {
          participantId,
          sessionCode,
        });
      },
    );

    /**
     * Client vừa lưu xong 1 ván (action đã commit DB thành công).
     * Process này đọc lại DB rồi broadcast cho cả room.
     */
    socket.on(
      "round:publish",
      async ({
        sessionCode,
        actorParticipantId,
      }: {
        sessionCode: string;
        actorParticipantId?: string;
      }) => {
        try {
          await broadcastRoundSaved(sessionCode, actorParticipantId);
        } catch (err) {
          console.error("broadcastRoundSaved failed:", err);
        }
      },
    );

    /**
     * Client vừa xoá 1 ván. Broadcast round:deleted + score:updated.
     */
    socket.on(
      "round:delete",
      async ({ sessionCode, roundId }: { sessionCode: string; roundId: string }) => {
        try {
          await broadcastRoundDeleted(sessionCode, roundId);
        } catch (err) {
          console.error("broadcastRoundDeleted failed:", err);
        }
      },
    );

    /**
     * Một participant vừa chọn nhân vật (player) — action settings.tsx đã
     * commit DB xong. Đọc tên participant + tên player (authoritative) rồi
     * broadcast cho toàn bộ room (kể cả chủ phòng) để mỗi thiết bị hiện
     * push notification (toast) về việc chọn nhân vật.
     */
    socket.on(
      "player:select",
      async ({
        sessionCode,
        participantId,
        playerId,
      }: {
        sessionCode: string;
        participantId: string;
        playerId: string;
      }) => {
        const sessionDbId = await resolveSessionDbId(sessionCode);
        if (!sessionDbId) return;

        const [participant] = await db
          .select({ displayName: participants.displayName })
          .from(participants)
          .where(eq(participants.id, participantId))
          .limit(1);
        const [player] = await db
          .select({ name: players.name })
          .from(players)
          .where(eq(players.id, playerId))
          .limit(1);
        if (!participant || !player) return;

        const room = sessionRoom(sessionCode);
        io!.to(room).emit("player:selected", {
          sessionCode,
          participantId,
          displayName: participant.displayName,
          playerId,
          playerName: player.name,
        });
      },
    );

    /**
     * Một participant vừa bỏ chọn nhân vật (reset-player, chỉ chủ phòng).
     * Broadcast tương tự `player:select` để các thiết bị cập nhật thông báo.
     */
    socket.on(
      "player:deselect",
      async ({
        sessionCode,
        participantId,
        playerId,
      }: {
        sessionCode: string;
        participantId: string;
        playerId: string;
      }) => {
        const sessionDbId = await resolveSessionDbId(sessionCode);
        if (!sessionDbId) return;

        const [participant] = await db
          .select({ displayName: participants.displayName })
          .from(participants)
          .where(eq(participants.id, participantId))
          .limit(1);
        const [player] = await db
          .select({ name: players.name })
          .from(players)
          .where(eq(players.id, playerId))
          .limit(1);
        if (!participant || !player) return;

        const room = sessionRoom(sessionCode);
        io!.to(room).emit("player:deselected", {
          sessionCode,
          participantId,
          displayName: participant.displayName,
          playerId,
          playerName: player.name,
        });
      },
    );

    /**
     * Chủ phòng tạm dừng / tiếp tục phiên chơi (toggle). Chỉ owner
     * (socket đang mang participantId của owner) mới được thực hiện.
     * Sau khi cập nhật DB, broadcast `session:paused` cho toàn bộ room
     * để mọi thiết bị (kể cả chủ phòng) đồng bộ trạng thái tạm dừng.
     */
    socket.on(
      "session:set-paused",
      async ({
        sessionCode,
        paused,
      }: {
        sessionCode: string;
        paused: boolean;
      }) => {
        const sessionDbId = await resolveSessionDbId(sessionCode);
        if (!sessionDbId) return;
        if (!(await assertOwner(sessionDbId))) return;

        await db
          .update(sessions)
          .set({ paused })
          .where(eq(sessions.code, sessionCode));

        const room = sessionRoom(sessionCode);
        io!.to(room).emit("session:paused", { sessionCode, paused });
      },
    );

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket] Server initialized");
  return io;
}
