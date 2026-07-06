"use client";

import { useMemo } from "react";
import type { Player, ChatHeo, GameConfigSlice } from "./types";
import {
  getCircularPosition,
  filterChatHeoForPlayer,
  calculateKhapSanhPoints,
} from "./utils";
import { PlayerCard } from "./PlayerCard";

interface CircularLayoutProps {
  players: Player[];
  ranking: string[];
  selectOrder: (number | null)[];
  toggleSelect: (playerId: string) => void;
  selectableIds: string[];
  computedScores: Record<string, number>;
  activeNhot: { dennerId?: string; denForIds?: string[] } | null;
  nhotterId: string | null;
  nhotVictimIds: string[];
  denForIds: string[];
  khapWinner: string | null;
  khapCount: number;
  sanhWinner: string | null;
  toggleKhapPlayer: (pid: string) => void;
  toggleSanhPlayer: (pid: string) => void;
  chatHeoList: ChatHeo[];
  accumulated: { khap: number; sanh: number };
  gameConfig: GameConfigSlice;
  getRowMeta: (playerId: string, rankIndex: number) => {
    label: string;
    labelColor: string;
    style: string;
    isFixed: boolean;
    bgColor: string;
    borderColor: string;
  };
}

const CIRCULAR_SIZE = 320;
const CARD_WIDTH = 150;
const CARD_HEIGHT = 130;
const RADIUS = 115;
const CENTER = CIRCULAR_SIZE / 2;

export function CircularLayout({
  players,
  ranking,
  selectOrder,
  toggleSelect,
  selectableIds,
  computedScores,
  activeNhot,
  nhotterId,
  nhotVictimIds,
  denForIds,
  khapWinner,
  khapCount,
  sanhWinner,
  toggleKhapPlayer,
  toggleSanhPlayer,
  chatHeoList,
  accumulated,
  gameConfig,
  getRowMeta,
}: CircularLayoutProps) {
  // Calculate positions for all players
  const positions = useMemo(() => {
    return players.map((_, index) => {
      const pos = getCircularPosition(index, players.length, RADIUS, CENTER, CENTER);
      // Adjust to center the card on the point
      return {
        x: Math.max(0, Math.min(CIRCULAR_SIZE - CARD_WIDTH, pos.x - CARD_WIDTH / 2)),
        y: Math.max(0, Math.min(CIRCULAR_SIZE - CARD_HEIGHT, pos.y - CARD_HEIGHT / 2)),
      };
    });
  }, [players.length]);

  return (
    <div
      className="relative mx-auto"
      style={{ width: CIRCULAR_SIZE, height: CIRCULAR_SIZE }}
    >
      {/* Background ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-dashed border-border/20 pointer-events-none"
      />

      {/* Player cards */}
      {players.map((player, idx) => {
        const playerId = player.id;
        const rankIndex = ranking.indexOf(playerId);
        const order = selectOrder[idx];
        const isSelectable = selectableIds.includes(playerId);
        const isSelected = order !== null;
        const score = computedScores[playerId] || 0;

        const isNhotter = nhotterId === playerId;
        const isVictim = nhotVictimIds.includes(playerId);
        const isDenner = activeNhot?.dennerId === playerId;
        const isDenFor = denForIds.includes(playerId);

        const isKhapWinnerLocal = khapWinner === playerId;
        const isSanhWinnerLocal = sanhWinner === playerId;

        // Calculate points
        const khapPts = calculateKhapSanhPoints(
          isKhapWinnerLocal,
          khapWinner,
          playerId,
          khapCount,
          accumulated.khap,
          gameConfig.khapPoints
        );

        const sanhPts = calculateKhapSanhPoints(
          isSanhWinnerLocal,
          sanhWinner,
          playerId,
          1, // Sanh doesn't have count multiplier
          accumulated.sanh,
          gameConfig.sanhPoints
        );

        // Filter chat heo
        const chatHeo = filterChatHeoForPlayer(chatHeoList, playerId, nhotVictimIds);

        return (
          <div
            key={playerId}
            className="absolute transition-all duration-300 ease-out"
            style={{
              left: positions[idx].x,
              top: positions[idx].y,
              width: CARD_WIDTH,
            }}
          >
            <PlayerCard
              player={player}
              rankIndex={rankIndex}
              order={order}
              score={score}
              isSelectable={isSelectable}
              isSelected={isSelected}
              isFixed={getRowMeta(playerId, rankIndex).isFixed}
              isNhotter={isNhotter}
              isVictim={isVictim}
              isDenFor={isDenFor}
              isDenner={isDenner}
              isKhapWinner={isKhapWinnerLocal}
              isSanhWinner={isSanhWinnerLocal}
              khapPts={khapPts}
              sanhPts={sanhPts}
              chatHeo={chatHeo}
              gameConfig={gameConfig}
              onToggleSelect={() => toggleSelect(playerId)}
              onToggleKhap={() => toggleKhapPlayer(playerId)}
              onToggleSanh={() => toggleSanhPlayer(playerId)}
              getRowMeta={getRowMeta}
            />
          </div>
        );
      })}
    </div>
  );
}