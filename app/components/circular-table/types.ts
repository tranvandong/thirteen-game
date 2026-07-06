/**
 * Circular Table Types
 */

export interface ChatHeo {
  id: string;
  chatterId: string;
  victimId: string;
  heo: { do: number; den: number };
}

export interface RowMeta {
  label: string;
  labelColor: string;
  style: string;
  isFixed: boolean;
  bgColor: string;
  borderColor: string;
}

export interface GameConfigSlice {
  khapPoints: number;
  sanhPoints: number;
  maxKhapAccumulate: number;
  heoDoPoints: number;
  heodenPoints: number;
}

export interface Position {
  x: number;
  y: number;
}

export type RankStyle = {
  bg: string;
  text: string;
  border: string;
  ring: string;
  gradient: string;
};

export interface CircularTableProps {
  players: Array<{
    id: string;
    name: string;
    orderNo: number;
    initialScore: number;
  }>;
  ranking: string[];
  selectOrder: (number | null)[];
  toggleSelect: (playerId: string) => void;
  selectableIds: string[];
  selectCounter: number;
  requiredSelections: number;
  computedScores: Record<string, number>;
  activeNhot: { dennerId?: string; denForIds?: string[] } | null;
  nhotCount: number;
  nhotterId: string | null;
  nhotVictimIds: string[];
  denForIds: string[];
  khapWinner: string | null;
  khapCount: number;
  sanhWinner: string | null;
  toggleKhapPlayer: (pid: string) => void;
  updateKhapCount: (delta: number) => void;
  toggleSanhPlayer: (pid: string) => void;
  chatHeoList: ChatHeo[];
  accumulated: { khap: number; sanh: number };
  gameConfig: GameConfigSlice;
  getRowMeta: (playerId: string, rankIndex: number) => RowMeta;
  save: () => void;
  disabledSaveButton: boolean;
}