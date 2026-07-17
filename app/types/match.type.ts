interface RoundMeta {
  currentRoundNo: number;
  accumulated: { khap: number; sanh: number };
  roundId: string;
}
export interface MatchLoaderData {
  roundMeta: RoundMeta;
  playerTotals: Array<{
    playerId: string;
    playerName: string;
    orderNo: number;
    totalScore: number | null;
  }>;
  textToSpeed?: any
}

// ── Types ────────────────────────────────────────────────────
export type HeoType = "do" | "den";
export interface ChatHeo {
  id: string;
  chatterId: string;
  chatterName: string;
  victimId: string;
  victimName: string;
  heo: { do: number; den: number };
}
export interface VictimHeo {
  victimId: string;
  heo: { do: number; den: number };
}
export interface NhotBai {
  id: string;
  nhotterId: string;
  victims: VictimHeo[];
  dennerId?: string;
  denForIds: string[];
}

export type GameConfigs = {
  rankPoints: number[];
  khapPoints: number;
  sanhPoints: number;
  maxKhapAccumulate: number;
  maxSanhAccumulate: number;
  heoDoPoints: number;
  heodenPoints: number;
  nhotBystanderPenalty: number;
};
