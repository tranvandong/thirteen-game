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

/**
 * Tham gia phòng trực tiếp (không cần phê duyệt). Server tạo participant +
 * đăng ký thiết bị (player_devices) rồi phản hồi `join-direct-success`.
 */
export function joinSessionDirect(
  sessionCode: string,
  displayName: string,
  fingerprint: string,
  platform: "ios" | "android" | "web",
) {
  getSocket().emit("join-session-direct", {
    sessionCode,
    displayName,
    fingerprint,
    platform,
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
export function publishRound(
  sessionCode: string,
  actorParticipantId?: string,
) {
  getSocket().emit("round:publish", { sessionCode, actorParticipantId });
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

/**
 * Chủ phòng tạm dừng / tiếp tục phiên chơi.
 * Server (owner-checked) cập nhật DB rồi broadcast `session:paused`
 * cho toàn bộ room — mọi thiết bị (kể cả chủ phòng) cập nhật store.
 */
export function setSessionPaused(sessionCode: string, paused: boolean) {
  getSocket().emit("session:set-paused", { sessionCode, paused });
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
  /** Participant vừa ghi ván — thiết bị của họ bỏ qua toast thông báo. */
  actorParticipantId?: string;
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
// Participant lifecycle events
//
// Hợp đồng event:
//   join-direct-success  { participantId, displayName, role, sessionCode } (gửi riêng cho người vừa tham gia)
//   participant-joined   { participantId, displayName }                    (broadcast room)
//   participant-kicked   { participantId, sessionCode }                    (broadcast room)
// ─────────────────────────────────────────────

export interface JoinDirectSuccessEvent {
  participantId: string;
  displayName: string;
  role: string;
  sessionCode: string;
}

export interface ParticipantJoinedEvent {
  participantId: string;
  displayName: string;
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

export function onJoinDirectSuccess(
  callback: (data: JoinDirectSuccessEvent) => void,
) {
  getSocket().on("join-direct-success", callback);
}

export function onParticipantJoined(
  callback: (data: ParticipantJoinedEvent) => void,
) {
  getSocket().on("participant-joined", callback);
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

export interface SessionPausedEvent {
  sessionCode: string;
  paused: boolean;
}

export function onSessionPaused(callback: (data: SessionPausedEvent) => void) {
  getSocket().on("session:paused", callback);
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

export const offJoinDirectSuccess = (
  cb?: (data: JoinDirectSuccessEvent) => void,
) => off("join-direct-success", cb);

export const offParticipantJoined = (
  cb?: (data: ParticipantJoinedEvent) => void,
) => off("participant-joined", cb);

export const offParticipantKicked = (
  cb?: (data: ParticipantKickedEvent) => void,
) => off("participant-kicked", cb);

export const offPlayerSelected = (cb?: (data: PlayerSelectedEvent) => void) =>
  off("player:selected", cb);

export const offPlayerDeselected = (
  cb?: (data: PlayerDeselectedEvent) => void,
) => off("player:deselected", cb);

export const offSessionPaused = (cb?: (data: SessionPausedEvent) => void) =>
  off("session:paused", cb);

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
