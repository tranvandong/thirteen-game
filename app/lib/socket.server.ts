/**
 * server/socket.server.ts
 */

import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { db } from "~/db/client.server";
import { joinRequests, participants } from "~/db/schema";
import { eq } from "drizzle-orm";

// ── Singleton ─────────────────────────────────────────────────

let io: Server | null = null;

export function getIO(): Server {
  if (!io)
    throw new Error(
      "Socket.IO chưa được khởi tạo. Gọi initSocketServer() trước.",
    );
  return io;
}

/**
 * Lấy room name chuẩn từ sessionId.
 * Dùng chung ở cả server handler và action routes.
 */
export function sessionRoom(sessionCode: string) {
  return `session:${sessionCode}`;
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

    socket.on("send-join-request", async ({ sessionId, displayName }) => {
      const [req] = await db
        .insert(joinRequests)
        .values({
          sessionId,
          displayName,
          status: "pending",
          requestToken: crypto.randomUUID(),
        })
        .returning();

      io!.to(sessionRoom(sessionId)).emit("join-request-created", {
        requestId: req.id,
        displayName,
        sessionId,
      });
    });

    socket.on(
      "approve-join-request",
      async ({ sessionId, requestId, displayName }) => {
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
            sessionId,
            displayName,
            role: "member",
          })
          .returning();

        io!.to(sessionRoom(sessionId)).emit("participant-approved", {
          requestId,
          participant: {
            id: participant.id,
            displayName: participant.displayName,
            role: participant.role,
          },
        });
      },
    );

    socket.on(
      "reject-join-request",
      async ({ sessionId, requestId, displayName }) => {
        await db
          .update(joinRequests)
          .set({
            status: "rejected",
          })
          .where(eq(joinRequests.id, requestId));

        io!.to(sessionRoom(sessionId)).emit("join-request-rejected", {
          requestId,
          displayName,
        });
      },
    );

    /**
     * Bridge giữa action và realtime.
     *
     * fetcher.submit()
     *      ↓
     * action() -> DB
     *      ↓
     * useEffect()
     *      ↓
     * finishRound(...)
     *      ↓
     * Socket Server
     *      ↓
     * broadcast
     */
    socket.on("finish-round", ({ sessionCode, round, totals }) => {
      console.log("Received finish-round event from client", { sessionCode, round, totals });
      io!.to(sessionRoom(sessionCode)).emit("round-finished", {
        round,
      });

      io!.to(sessionRoom(sessionCode)).emit("score-updated", {
        totals,
      });
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket] Server initialized");
  return io;
}
