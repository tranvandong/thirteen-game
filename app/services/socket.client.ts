import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function initSocket() {
  if (socket?.connected) return socket;

  socket = io(window.location.origin, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("Connected to socket server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from socket server");
  });

  return socket;
}

export function getSocket() {
  if (!socket?.connected) {
    return initSocket();
  }
  return socket;
}

export function joinSession(sessionId: string, participantId: string, displayName: string) {
  const s = getSocket();
  s.emit("join-session", sessionId, participantId, displayName);
}

export function sendJoinRequest(sessionId: string, displayName: string) {
  const s = getSocket();
  s.emit("send-join-request", { sessionId, displayName });
}

export function approveJoinRequest(sessionId: string, participantId: string, displayName: string) {
  const s = getSocket();
  s.emit("approve-join-request", { sessionId, participantId, displayName });
}

export function rejectJoinRequest(sessionId: string, displayName: string) {
  const s = getSocket();
  s.emit("reject-join-request", { sessionId, displayName });
}

export function finishRound(
  sessionId: string,
  roundNo: number,
  results: Array<{ playerId: string; rank: number; score: number }>
) {
  const s = getSocket();
  s.emit("round-finished", { sessionId, roundNo, results });
}

export function updateScores(sessionId: string, totalScores: Array<{ playerId: string; totalScore: number }>) {
  const s = getSocket();
  s.emit("update-scores", { sessionId, totalScores });
}

export function onParticipantJoined(callback: (data: any) => void) {
  const s = getSocket();
  s.on("participant-joined", callback);
}

export function onJoinRequest(callback: (data: any) => void) {
  const s = getSocket();
  s.on("join-request", callback);
}

export function onParticipantApproved(callback: (data: any) => void) {
  const s = getSocket();
  s.on("participant-approved", callback);
}

export function onJoinRequestRejected(callback: (data: any) => void) {
  const s = getSocket();
  s.on("join-request-rejected", callback);
}

export function onRoundFinished(callback: (data: any) => void) {
  const s = getSocket();
  s.on("round-finished", callback);
}

export function onScoreUpdated(callback: (data: any) => void) {
  const s = getSocket();
  s.on("score-updated", callback);
}

export function offParticipantJoined(callback?: (data: any) => void) {
  const s = getSocket();
  if (callback) {
    s.off("participant-joined", callback);
  } else {
    s.off("participant-joined");
  }
}

export function offJoinRequest(callback?: (data: any) => void) {
  const s = getSocket();
  if (callback) {
    s.off("join-request", callback);
  } else {
    s.off("join-request");
  }
}

export function offScoreUpdated(callback?: (data: any) => void) {
  const s = getSocket();
  if (callback) {
    s.off("score-updated", callback);
  } else {
    s.off("score-updated");
  }
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
