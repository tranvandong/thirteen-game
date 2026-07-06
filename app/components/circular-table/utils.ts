/**
 * Utility functions for circular table
 */

import type { GameConfigSlice, RankStyle } from "./types";

/**
 * Format score with +/- prefix
 */
export function formatScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

/**
 * Get score color class based on value
 */
export function getScoreColorClass(score: number): string {
  if (score > 0) return "text-emerald-500";
  if (score < 0) return "text-red-500";
  return "text-muted-foreground";
}

/**
 * Calculate points for khạp/sảnh display
 */
export function calculateKhapSanhPoints(
  isWinner: boolean,
  winner: string | null,
  playerId: string,
  khapCount: number,
  accumulatedKhap: number,
  khapPoints: number
): { gain: number; loss: number } {
  if (isWinner && khapCount > 0) {
    return {
      gain: accumulatedKhap * khapCount * khapPoints * 3,
      loss: 0,
    };
  }
  return {
    gain: 0,
    loss:
      winner && khapCount > 0
        ? accumulatedKhap * khapCount * khapPoints
        : 0,
  };
}

/**
 * Get rank style based on position
 */
export function getRankStyle(rankIndex: number): RankStyle {
  const styles: RankStyle[] = [
    {
      bg: "bg-amber-400",
      text: "text-amber-950",
      border: "border-amber-500/30",
      ring: "ring-amber-400/30",
      gradient: "from-amber-400 to-amber-600",
    },
    {
      bg: "bg-slate-300",
      text: "text-slate-800",
      border: "border-slate-400/30",
      ring: "ring-slate-300/30",
      gradient: "from-slate-300 to-slate-400",
    },
    {
      bg: "bg-orange-300",
      text: "text-orange-950",
      border: "border-orange-400/30",
      ring: "ring-orange-300/30",
      gradient: "from-orange-300 to-orange-400",
    },
    {
      bg: "bg-rose-400",
      text: "text-white",
      border: "border-rose-400/30",
      ring: "ring-rose-400/30",
      gradient: "from-rose-400 to-rose-500",
    },
  ];

  return styles[Math.min(rankIndex, 3)] || styles[3];
}

/**
 * Calculate position on circle for a given index
 */
export function getCircularPosition(
  index: number,
  totalPlayers: number,
  radius: number,
  centerX: number,
  centerY: number
): { x: number; y: number } {
  const angleStep = (2 * Math.PI) / Math.max(totalPlayers, 1);
  const startAngle = -Math.PI / 2; // Start from top
  const angle = startAngle + index * angleStep;

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

/**
 * Get short name (last word) from full name
 */
export function getShortName(name: string): string {
  return name.split(" ").pop() || name;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(
  current: number,
  total: number
): number {
  if (total === 0) return 0;
  return (current / total) * 100;
}

/**
 * Filter chat heo for a specific player
 */
export function filterChatHeoForPlayer(
  chatHeoList: Array<{
    id: string;
    chatterId: string;
    victimId: string;
    heo: { do: number; den: number };
  }>,
  playerId: string,
  nhotVictimIds: string[]
): {
  asChatter: Array<{
    id: string;
    chatterId: string;
    victimId: string;
    heo: { do: number; den: number };
  }>;
  asVictim: Array<{
    id: string;
    chatterId: string;
    victimId: string;
    heo: { do: number; den: number };
  }>;
} {
  return {
    asChatter: chatHeoList.filter(
      (c) =>
        c.chatterId === playerId &&
        !nhotVictimIds.includes(c.victimId)
    ),
    asVictim: chatHeoList.filter(
      (c) =>
        c.victimId === playerId &&
        !nhotVictimIds.includes(c.victimId)
    ),
  };
}

/**
 * Calculate chat heo points
 */
export function calculateChatHeoPoints(
  heo: { do: number; den: number },
  gameConfig: GameConfigSlice
): number {
  return (
    (heo.do ?? 0) * gameConfig.heoDoPoints +
    (heo.den ?? 0) * gameConfig.heodenPoints
  );
}