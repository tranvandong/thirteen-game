/**
 * stores/useSessionStore.ts
 *
 * Global state cho session đang active.
 * Được hydrate từ loader data của React Router v7 sau khi tạo/join session.
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
}

export interface Player {
  id: string;
  name: string;
  orderNo: number;
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
}

// ── State & Actions ───────────────────────────────────────────

interface SessionState {
  /** Session đang active, null nếu chưa vào phòng nào */
  session: ActiveSession | null;

  /** Game config của session hiện tại */
  config: GameConfig | null;

  /** Danh sách 4 người chơi (theo orderNo) */
  players: Player[];

  /** Participant hiện tại (người đang dùng app) */
  currentParticipant: SessionParticipant | null;

  // ── Actions ────────────────────────────────────────────────

  /**
   * Hydrate toàn bộ state sau khi tạo hoặc join session.
   * Gọi từ clientLoader hoặc useEffect sau khi nhận loader data.
   */
  hydrate: (payload: {
    session: ActiveSession;
    config: GameConfig;
    players: Player[];
    currentParticipant: SessionParticipant;
  }) => void;

  /** Cập nhật status session (waiting → playing → finished) */
  setSessionStatus: (status: ActiveSession["status"]) => void;

  /** Cập nhật game config (ví dụ host chỉnh lại giữa chừng) */
  updateConfig: (patch: Partial<GameConfig>) => void;

  /** Thêm / cập nhật một player */
  upsertPlayer: (player: Player) => void;

  /** Xoá toàn bộ state khi rời / kết thúc session */
  clearSession: () => void;
}

// ── Store ─────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set) => ({
        // ── Initial state ──────────────────────────────────
        session: null,
        config: null,
        players: [],
        currentParticipant: null,

        // ── Actions ────────────────────────────────────────

        hydrate: ({ session, config, players, currentParticipant }) =>
          set(
            { session, config, players, currentParticipant },
            false,
            "session/hydrate",
          ),

        setSessionStatus: (status) =>
          set(
            (state) =>
              state.session ? { session: { ...state.session, status } } : state,
            false,
            "session/setStatus",
          ),

        updateConfig: (patch) =>
          set(
            (state) =>
              state.config ? { config: { ...state.config, ...patch } } : state,
            false,
            "session/updateConfig",
          ),

        upsertPlayer: (player) =>
          set(
            (state) => {
              const exists = state.players.find((p) => p.id === player.id);
              return {
                players: exists
                  ? state.players.map((p) => (p.id === player.id ? player : p))
                  : [...state.players, player].sort(
                      (a, b) => a.orderNo - b.orderNo,
                    ),
              };
            },
            false,
            "session/upsertPlayer",
          ),

        clearSession: () =>
          set(
            {
              session: null,
              config: null,
              players: [],
              currentParticipant: null,
            },
            false,
            "session/clear",
          ),
      }),
      {
        name: "thirteen-session", // key trong localStorage
        // Chỉ persist những field cần thiết để recover sau reload
        partialize: (state) => ({
          session: state.session,
          config: state.config,
          players: state.players,
          currentParticipant: state.currentParticipant,
        }),
      },
    ),
    { name: "SessionStore" },
  ),
);

// ── Selector hooks (tránh re-render không cần thiết) ──────────

export const useSession = () => useSessionStore((s) => s.session);
export const useGameConfig = () => useSessionStore((s) => s.config);
export const usePlayers = () => useSessionStore((s) => s.players);
export const useCurrentParticipant = () =>
  useSessionStore((s) => s.currentParticipant);
