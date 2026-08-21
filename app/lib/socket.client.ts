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

export function sendJoinRequest(sessionCode: string, displayName: string) {
  getSocket().emit("send-join-request", {
    sessionCode,
    displayName,
  });
}

export function approveJoinRequest(
  sessionCode: string,
  requestId: string,
  displayName: string,
) {
  getSocket().emit("approve-join-request", {
    sessionCode,
    requestId,
    displayName,
  });
}

export function rejectJoinRequest(
  sessionCode: string,
  requestId: string,
  displayName: string,
) {
  getSocket().emit("reject-join-request", {
    sessionCode,
    requestId,
    displayName,
  });
}

/** Chủ phòng đá một participant ra khỏi phòng (xoá cứng). */
export function kickParticipant(sessionCode: string, participantId: string) {
  getSocket().emit("kick-participant", {
    sessionCode,
    participantId,
  });
}

/**
 * Báo cho Socket.IO server rằng 1 ván vừa được lưu thành công.
 * Server sẽ đọc lại DB và broadcast `round:finished` + `score:updated`
 * cho toàn bộ room (authoritative, không tin payload client).
 */
export function publishRound(sessionCode: string) {
  getSocket().emit("round:publish", { sessionCode });
}

/**
 * Báo cho Socket.IO server rằng 1 ván vừa bị xoá.
 * Server broadcast `round:deleted` + `score:updated`.
 */
export function publishRoundDeleted(sessionCode: string, roundId: string) {
  getSocket().emit("round:delete", { sessionCode, roundId });
}

/**
 * Báo cho Socket.IO server rằng 1 participant vừa chọn nhân vật (player).
 * Server sẽ đọc lại tên (authoritative) rồi broadcast `player:selected`
 * cho toàn bộ room — mỗi thiết bị hiện push notification (toast).
 */
export function selectPlayer(
  sessionCode: string,
  participantId: string,
  playerId: string,
) {
  getSocket().emit("player:select", { sessionCode, participantId, playerId });
}

/**
 * Báo cho Socket.IO server rằng 1 participant vừa bỏ chọn nhân vật.
 * Server broadcast `player:deselected` cho toàn bộ room.
 */
export function deselectPlayer(
  sessionCode: string,
  participantId: string,
  playerId: string,
) {
  getSocket().emit("player:deselect", { sessionCode, participantId, playerId });
}

// ─────────────────────────────────────────────
// Server -> Client (Events)
//
// Hợp đồng event chuẩn cho match realtime:
//   round:finished  { sessionCode, round, roundMeta, totals }
//   score:updated   { sessionCode, totals }
//   round:deleted   { sessionCode, roundId }
//
// Lưu ý: broadcast được thực hiện ở server (action) sau khi ghi xong
// DB, KHÔNG phát từ client. Client chỉ lắng nghe và cập nhật store.
// ─────────────────────────────────────────────

export interface RoundFinishedEvent {
  sessionCode: string;
  round: any;
  roundMeta: any;
  totals: Array<{ playerId: string; totalScore: number }>;
}

export interface ScoreUpdatedEvent {
  sessionCode: string;
  totals: Array<{ playerId: string; totalScore: number }>;
}

export interface RoundDeletedEvent {
  sessionCode: string;
  roundId: string;
}

export function onRoundFinished(callback: (data: RoundFinishedEvent) => void) {
  getSocket().on("round:finished", callback);
}

export function onScoreUpdated(callback: (data: ScoreUpdatedEvent) => void) {
  getSocket().on("score:updated", callback);
}

export function onRoundDeleted(callback: (data: RoundDeletedEvent) => void) {
  getSocket().on("round:deleted", callback);
}

// ─────────────────────────────────────────────
// Join request / participant lifecycle events
//
// Hợp đồng event:
//   join-request-sent     { requestId, sessionCode }            (gửi riêng cho người gửi request)
//   join-request-created  { requestId, displayName, sessionCode } (broadcast room)
//   participant-approved  { requestId, participant }            (broadcast room)
//   join-request-rejected { requestId, displayName, sessionCode } (broadcast room)
//   participant-kicked    { participantId, sessionCode }        (broadcast room)
// ─────────────────────────────────────────────

export interface JoinRequestSentEvent {
  requestId: string;
  sessionCode: string;
}

export interface JoinRequestCreatedEvent {
  requestId: string;
  displayName: string;
  sessionCode: string;
}

export interface ParticipantApprovedEvent {
  requestId: string;
  participant: { id: string; displayName: string; role: string };
}

export interface JoinRequestRejectedEvent {
  requestId: string;
  displayName: string;
  sessionCode: string;
}

export interface ParticipantKickedEvent {
  participantId: string;
  sessionCode: string;
}

export interface PlayerSelectedEvent {
  sessionCode: string;
  participantId: string;
  displayName: string;
  playerId: string;
  playerName: string;
}

export interface PlayerDeselectedEvent {
  sessionCode: string;
  participantId: string;
  displayName: string;
  playerId: string;
  playerName: string;
}

export function onJoinRequestSent(
  callback: (data: JoinRequestSentEvent) => void,
) {
  getSocket().on("join-request-sent", callback);
}

export function onJoinRequestCreated(
  callback: (data: JoinRequestCreatedEvent) => void,
) {
  getSocket().on("join-request-created", callback);
}

export function onParticipantApproved(
  callback: (data: ParticipantApprovedEvent) => void,
) {
  getSocket().on("participant-approved", callback);
}

export function onJoinRequestRejected(
  callback: (data: JoinRequestRejectedEvent) => void,
) {
  getSocket().on("join-request-rejected", callback);
}

export function onParticipantKicked(
  callback: (data: ParticipantKickedEvent) => void,
) {
  getSocket().on("participant-kicked", callback);
}

export function onPlayerSelected(
  callback: (data: PlayerSelectedEvent) => void,
) {
  getSocket().on("player:selected", callback);
}

export function onPlayerDeselected(
  callback: (data: PlayerDeselectedEvent) => void,
) {
  getSocket().on("player:deselected", callback);
}

// ─────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────

function off(event: string, callback?: (...args: any[]) => void) {
  callback ? getSocket().off(event, callback) : getSocket().off(event);
}

export const offRoundFinished = (cb?: (data: RoundFinishedEvent) => void) =>
  off("round:finished", cb);

export const offScoreUpdated = (cb?: (data: ScoreUpdatedEvent) => void) =>
  off("score:updated", cb);

export const offRoundDeleted = (cb?: (data: RoundDeletedEvent) => void) =>
  off("round:deleted", cb);

export const offJoinRequestSent = (cb?: (data: JoinRequestSentEvent) => void) =>
  off("join-request-sent", cb);

export const offJoinRequestCreated = (
  cb?: (data: JoinRequestCreatedEvent) => void,
) => off("join-request-created", cb);

export const offParticipantApproved = (
  cb?: (data: ParticipantApprovedEvent) => void,
) => off("participant-approved", cb);

export const offJoinRequestRejected = (
  cb?: (data: JoinRequestRejectedEvent) => void,
) => off("join-request-rejected", cb);

export const offParticipantKicked = (
  cb?: (data: ParticipantKickedEvent) => void,
) => off("participant-kicked", cb);

export const offPlayerSelected = (cb?: (data: PlayerSelectedEvent) => void) =>
  off("player:selected", cb);

export const offPlayerDeselected = (
  cb?: (data: PlayerDeselectedEvent) => void,
) => off("player:deselected", cb);

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
