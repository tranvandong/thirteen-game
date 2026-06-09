import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function initSocket() {
  if (socket) return socket;

  socket = io({
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("disconnect", () => {
    console.log("[Socket] Disconnected");
  });

  return socket;
}

export function getSocket() {
  return socket ?? initSocket();
}

// ─────────────────────────────────────────────
// Client -> Server (Commands)
// ─────────────────────────────────────────────

export function joinSession(
  sessionId: string,
  participantId: string,
  displayName: string,
) {
  console.log("joinSession", sessionId, participantId, displayName);
  getSocket().emit("join-session", {
    sessionCode: sessionId,
    participantId,
    displayName,
  });
}

export function leaveSession(sessionId: string) {
  getSocket().emit("leave-session", {
    sessionId,
  });
}

export function sendJoinRequest(sessionId: string, displayName: string) {
  getSocket().emit("send-join-request", {
    sessionId,
    displayName,
  });
}

export function approveJoinRequest(
  sessionId: string,
  requestId: string,
  displayName: string,
) {
  getSocket().emit("approve-join-request", {
    sessionId,
    requestId,
    displayName,
  });
}

export function rejectJoinRequest(
  sessionId: string,
  requestId: string,
  displayName: string,
) {
  getSocket().emit("reject-join-request", {
    sessionId,
    requestId,
    displayName,
  });
}

/**
 * Gọi từ useEffect sau khi action trả về thành công
 */
export function finishRound(sessionCode: string, round: any, totals: any) {
  console.log("Emitting finish-round event", { sessionCode, round, totals });
  getSocket().emit("finish-round", {
    sessionCode,
    round,
    totals,
  });
}

// ─────────────────────────────────────────────
// Server -> Client (Events)
// ─────────────────────────────────────────────

export function onParticipantJoined(callback: (data: any) => void) {
  getSocket().on("participant-joined", callback);
}

export function onJoinRequestCreated(callback: (data: any) => void) {
  getSocket().on("join-request-created", callback);
}

export function onParticipantApproved(callback: (data: any) => void) {
  getSocket().on("participant-approved", callback);
}

export function onJoinRequestRejected(callback: (data: any) => void) {
  getSocket().on("join-request-rejected", callback);
}

export function onRoundFinished(callback: (data: any) => void) {
  console.log("Listening for round-finished event");
  getSocket().on("round-finished", callback);
}

export function onScoreUpdated(callback: (data: any) => void) {
  getSocket().on("score-updated", callback);
}

// ─────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────

function off(event: string, callback?: (...args: any[]) => void) {
  callback ? getSocket().off(event, callback) : getSocket().off(event);
}

export const offParticipantJoined = (cb?: (data: any) => void) =>
  off("participant-joined", cb);

export const offJoinRequestCreated = (cb?: (data: any) => void) =>
  off("join-request-created", cb);

export const offParticipantApproved = (cb?: (data: any) => void) =>
  off("participant-approved", cb);

export const offJoinRequestRejected = (cb?: (data: any) => void) =>
  off("join-request-rejected", cb);

export const offRoundFinished = (cb?: (data: any) => void) =>
  off("round-finished", cb);

export const offScoreUpdated = (cb?: (data: any) => void) =>
  off("score-updated", cb);

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
