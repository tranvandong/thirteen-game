import { Server as IOServer } from "socket.io";
import { Server as HTTPServer } from "http";

let io: IOServer | null = null;

export function initSocket(httpServer: HTTPServer) {
  io = new IOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join-session", (sessionId: string, participantId: string, displayName: string) => {
      const room = `session:${sessionId}`;
      socket.join(room);
      console.log(`${displayName} joined session ${sessionId}`);

      io?.to(room).emit("participant-joined", {
        participantId,
        displayName,
        timestamp: new Date(),
      });
    });

    socket.on("send-join-request", (data: { sessionId: string; displayName: string }) => {
      const room = `session:${data.sessionId}`;
      io?.to(room).emit("join-request", {
        displayName: data.displayName,
        timestamp: new Date(),
      });
    });

    socket.on("approve-join-request", (data: { sessionId: string; participantId: string; displayName: string }) => {
      const room = `session:${data.sessionId}`;
      io?.to(room).emit("participant-approved", {
        participantId: data.participantId,
        displayName: data.displayName,
        timestamp: new Date(),
      });
    });

    socket.on("reject-join-request", (data: { sessionId: string; displayName: string }) => {
      io?.to(`participant:${data.displayName}`).emit("join-request-rejected", {
        reason: "Owner rejected your join request",
      });
    });

    socket.on(
      "round-finished",
      (data: { sessionId: string; roundNo: number; results: Array<{ playerId: string; rank: number; score: number }> }) => {
        const room = `session:${data.sessionId}`;
        io?.to(room).emit("round-finished", {
          roundNo: data.roundNo,
          results: data.results,
          timestamp: new Date(),
        });
      }
    );

    socket.on("update-scores", (data: { sessionId: string; totalScores: Array<{ playerId: string; totalScore: number }> }) => {
      const room = `session:${data.sessionId}`;
      io?.to(room).emit("score-updated", {
        totalScores: data.totalScores,
        timestamp: new Date(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}
