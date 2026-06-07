/**
 * server/socket.server.ts
 *
 * Khởi tạo Socket.IO server và đăng ký tất cả event handlers.
 * Được gọi 1 lần từ entry.server.ts (hoặc server.ts) khi app start.
 *
 * getIO() export để action functions gọi emit từ server routes.
 */

import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { db } from "~/db/client.server";
import { joinRequests, participants } from "~/db/schema";
import { eq, and } from "drizzle-orm";

// ── Singleton IO instance ─────────────────────────────────────

let io: Server | null = null;

export function getIO(): Server {
  if (!io)
    throw new Error(
      "Socket.IO chưa được khởi tạo. Gọi initSocketServer() trước.",
    );
  return io;
}

// ── Init ──────────────────────────────────────────────────────

export function initSocketServer(httpServer: HttpServer) {
  if (io) return io; // đã init rồi, skip

  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── join-session ─────────────────────────────────────────
    // Client join vào room của session khi mở trang session
    socket.on(
      "join-session",
      (sessionId: string, participantId: string, displayName: string) => {
        const room = `session:${sessionId}`;
        socket.join(room);
        socket.data.sessionId = sessionId;
        socket.data.participantId = participantId;

        // Thông báo cho các client khác trong room
        socket
          .to(room)
          .emit("participant-joined", { participantId, displayName });
        console.log(`[Socket] ${displayName} joined room ${room}`);
      },
    );

    // ── send-join-request ────────────────────────────────────
    socket.on(
      "send-join-request",
      async ({
        sessionId,
        displayName,
      }: {
        sessionId: string;
        displayName: string;
      }) => {
        const room = `session:${sessionId}`;

        // Tạo join request trong DB
        const [req] = await db
          .insert(joinRequests)
          .values({
            sessionId,
            displayName,
            status: "pending",
            requestToken: crypto.randomUUID(),
          })
          .returning();

        // Emit tới owner (broadcast toàn room, owner sẽ filter)
        io!.to(room).emit("join-request", {
          requestId: req.id,
          displayName,
          sessionId,
        });
      },
    );

    // ── approve-join-request ─────────────────────────────────
    socket.on(
      "approve-join-request",
      async ({
        sessionId,
        requestId,
        displayName,
      }: {
        sessionId: string;
        requestId: string;
        displayName: string;
      }) => {
        const room = `session:${sessionId}`;

        // Update DB
        await db
          .update(joinRequests)
          .set({
            status: "approved",
            approvedBy: socket.data.participantId,
            approvedAt: new Date(),
          })
          .where(eq(joinRequests.id, requestId));

        // Tạo participant
        const [participant] = await db
          .insert(participants)
          .values({ sessionId, displayName, role: "member" })
          .returning();

        // Notify toàn room
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

    // ── reject-join-request ──────────────────────────────────
    socket.on(
      "reject-join-request",
      async ({
        sessionId,
        requestId,
        displayName,
      }: {
        sessionId: string;
        requestId: string;
        displayName: string;
      }) => {
        const room = `session:${sessionId}`;

        await db
          .update(joinRequests)
          .set({ status: "rejected" })
          .where(eq(joinRequests.id, requestId));

        io!.to(room).emit("join-request-rejected", { requestId, displayName });
      },
    );

    // ── disconnect ────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket] Server initialized");
  return io;
}
