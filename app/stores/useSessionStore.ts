/**
 * stores/useSessionStore.ts
 */

import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

// ── Types ─────────────────────────────────────────────────────

export interface GameConfig {
  id: string;
  firstPlaceScore: number;
  secondPlaceScore: number;
  thirdPlaceScore: number;
  fourthPlaceScore: number;
  redPigScore: number;
  blackPigScore: number;
  tripleScore: number;
  khapScore: number;
  khapLimit: number;
  sanhScore: number;
  sanhLimit: number;
  /** Hệ số nhân điểm tổng (mặc định 3) */
  scoreMultiplier: number;
  /** Phạt người ngoài khi nhốt 2 victim (mặc định = |thirdPlaceScore|) */
  nhotBystanderPenalty: number;
  showBackground?: boolean;
  enableTTS?: boolean; 
}

export interface Player {
  id: string;
  name: string;
  orderNo: number;
  initialScore: number;
}

export interface SessionParticipant {
  id: string;
  displayName: string;
  role: "owner" | "member";
}

export interface ActiveSession {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  ownerParticipantId: string;
  createdAt: string;
  /** Phiên đang tạm dừng? Nếu true, không ai được lưu/xoá ván. */
  paused: boolean;
}

export interface RoundResult {
  playerId: string;
  rank: number;
  score: number;
  khapNo: number;
  sanhNo: number;
  blackPigNo: number;
  redPigNo: number;
}

export interface Round {
  id: string;
  roundNo: number;
  createdAt: string;
  results: RoundResult[];
  accumulatedKhap: number;
  accumulatedSanh: number;
  hadKhap: boolean;
  hadSanh: boolean;
}

export interface SessionTotal {
  playerId: string;
  totalScore: number;
}

// ── State & Actions ───────────────────────────────────────────

interface SessionState {
  session: ActiveSession | null;
  config: GameConfig | null;
  players: Player[];
  currentParticipant: SessionParticipant | null;

  /** Player (nhân vật) mà thiết bị/người tham gia hiện tại đã chọn. */
  mySelectedPlayerId: string | null;

  /** Danh sách ván đã chơi, mới nhất ở đầu */
  rounds: Round[];

  /** Bảng điểm tổng */
  totals: SessionTotal[];

  /** Ván hiện tại đang hiển thị (để navigate realtime) */
  currentRoundNo: number;

  /** Sắp xếp danh sách người chơi theo orderNo */
  sortPlayers: (players: Player[]) => void;

  // ── Actions ────────────────────────────────────────────────

  hydrate: (payload: {
    session: ActiveSession;
    config: GameConfig;
    players: Player[];
    currentParticipant: SessionParticipant;
    rounds?: Round[];
    totals?: SessionTotal[];
  }) => void;

  setSessionStatus: (status: ActiveSession["status"]) => void;
  /** Chuyển trạng thái tạm dừng của phiên (real-time, từ socket). */
  setPaused: (paused: boolean) => void;
  updateConfig: (patch: Partial<GameConfig>) => void;
  upsertPlayer: (player: Player) => void;

  /**
   * Thêm round mới vào đầu danh sách + cập nhật totals.
   * Gọi khi nhận event `round:finished` từ socket.
   */
  addRound: (round: Round) => void;

  /** Xoá 1 round khỏi danh sách (khi nhận event `round:deleted`). */
  removeRound: (roundId: string) => void;

  /** Cập nhật toàn bộ bảng điểm tổng */
  setTotals: (totals: SessionTotal[]) => void;

  /** Gán / xoá nhân vật mà người tham gia hiện tại đã chọn */
  setMySelectedPlayer: (playerId: string | null) => void;

  /** Advance round counter (dùng cho UI navigate) */
  setCurrentRoundNo: (no: number) => void;

  clearSession: () => void;
}

// ── Store ─────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set) => ({
        session: null,
        config: null,
        players: [],
        currentParticipant: null,
        mySelectedPlayerId: null,
        rounds: [],
        totals: [],
        currentRoundNo: 0,

        hydrate: ({
          session,
          config,
          players,
          currentParticipant,
          rounds = [],
          totals = [],
        }) =>
          set(
            {
              session,
              config,
              players,
              currentParticipant,
              rounds,
              totals,
              currentRoundNo: rounds.length > 0 ? rounds[0].roundNo : 0,
            },
            false,
            "session/hydrate",
          ),

        setSessionStatus: (status) =>
          set(
            (s) => (s.session ? { session: { ...s.session, status } } : s),
            false,
            "session/setStatus",
          ),

        setPaused: (paused) =>
          set(
            (s) => (s.session ? { session: { ...s.session, paused } } : s),
            false,
            "session/setPaused",
          ),

        updateConfig: (patch) =>
          set(
            (s) => (s.config ? { config: { ...s.config, ...patch } } : s),
            false,
            "session/updateConfig",
          ),

        upsertPlayer: (player) =>
          set(
            (s) => {
              const exists = s.players.find((p) => p.id === player.id);
              return {
                players: exists
                  ? s.players.map((p) => (p.id === player.id ? player : p))
                  : [...s.players, player].sort(
                      (a, b) => a.orderNo - b.orderNo,
                    ),
              };
            },
            false,
            "session/upsertPlayer",
          ),

        sortPlayers: (players) =>
          set(
            { players: players.sort((a, b) => a.orderNo - b.orderNo) },
            false,
            "session/sortPlayers",
          ),

        addRound: (round) =>
          set(
            (s) => ({
              // Prepend, đảm bảo không trùng lặp
              rounds: [round, ...s.rounds.filter((r) => r.id !== round.id)],
              currentRoundNo: round.roundNo,
            }),
            false,
            "session/addRound",
          ),

        removeRound: (roundId) =>
          set(
            (s) => ({
              rounds: s.rounds.filter((r) => r.id !== roundId),
              currentRoundNo:
                s.currentRoundNo > 0
                  ? Math.max(0, s.rounds.filter((r) => r.id !== roundId).length)
                  : 0,
            }),
            false,
            "session/removeRound",
          ),

        setTotals: (totals) => set({ totals }, false, "session/setTotals"),

        setMySelectedPlayer: (playerId) =>
          set(
            { mySelectedPlayerId: playerId },
            false,
            "session/setMySelectedPlayer",
          ),

        setCurrentRoundNo: (no) =>
          set({ currentRoundNo: no }, false, "session/setCurrentRoundNo"),

        clearSession: () =>
          set(
            {
              session: null,
              config: null,
              players: [],
              currentParticipant: null,
              rounds: [],
              totals: [],
              currentRoundNo: 0,
            },
            false,
            "session/clear",
          ),
      }),
      {
        name: "thirteen-session",
        partialize: (s) => ({
          session: s.session,
          config: s.config,
          players: s.players,
          currentParticipant: s.currentParticipant,
          mySelectedPlayerId: s.mySelectedPlayerId,
          rounds: s.rounds,
          totals: s.totals,
          currentRoundNo: s.currentRoundNo,
        }),
      },
    ),
    { name: "SessionStore" },
  ),
);

// ── Selectors ─────────────────────────────────────────────────

export const useSession = () => useSessionStore((s) => s.session);
export const useGameConfig = () => useSessionStore((s) => s.config);
export const usePlayers = () => useSessionStore((s) => s.players);
export const useCurrentParticipant = () =>
  useSessionStore((s) => s.currentParticipant);
export const useMySelectedPlayer = () =>
  useSessionStore((s) => s.mySelectedPlayerId);
export const useRounds = () => useSessionStore((s) => s.rounds);
export const useTotals = () => useSessionStore((s) => s.totals);
export const useCurrentRoundNo = () => useSessionStore((s) => s.currentRoundNo);
