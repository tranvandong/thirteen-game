"use client";

import type { CircularTableProps } from "./types";
import { CenterHub } from "./CenterHub";
import { CircularLayout } from "./CircularLayout";
import { ProgressBar } from "./ProgressBar";
import { BonusControls } from "./BonusControls";

/**
 * CircularTable - Main component for displaying players in a circular layout
 * 
 * Features:
 * - Circular positioning of player cards
 * - Selection state management
 * - Khạp/Sảnh bonus indicators
 * - Chat heo display
 * - Progress tracking
 */
export function CircularTable({
  players,
  ranking,
  selectOrder,
  toggleSelect,
  selectableIds,
  selectCounter,
  requiredSelections,
  computedScores,
  activeNhot,
  nhotCount,
  nhotterId,
  nhotVictimIds,
  denForIds,
  khapWinner,
  khapCount,
  sanhWinner,
  toggleKhapPlayer,
  updateKhapCount,
  toggleSanhPlayer,
  chatHeoList,
  accumulated,
  gameConfig,
  getRowMeta,
  save,
  disabledSaveButton,
}: CircularTableProps) {
  const totalSlots = activeNhot ? requiredSelections : players.length;

  return (
    <div className="relative w-full py-4">
      {/* Center confirm button */}
      <CenterHub
        activeNhot={activeNhot}
        nhotCount={nhotCount}
        selectCounter={selectCounter}
        requiredSelections={requiredSelections}
        totalPlayers={players.length}
        save={save}
        disabledSaveButton={disabledSaveButton}
      />

      {/* Circular player layout */}
      <CircularLayout
        players={players}
        ranking={ranking}
        selectOrder={selectOrder}
        toggleSelect={toggleSelect}
        selectableIds={selectableIds}
        computedScores={computedScores}
        activeNhot={activeNhot}
        nhotterId={nhotterId}
        nhotVictimIds={nhotVictimIds}
        denForIds={denForIds}
        khapWinner={khapWinner}
        khapCount={khapCount}
        sanhWinner={sanhWinner}
        toggleKhapPlayer={toggleKhapPlayer}
        toggleSanhPlayer={toggleSanhPlayer}
        chatHeoList={chatHeoList}
        accumulated={accumulated}
        gameConfig={gameConfig}
        getRowMeta={getRowMeta}
      />

      {/* Progress indicator */}
      <ProgressBar current={selectCounter} total={totalSlots} />

      {/* Bonus controls */}
      <BonusControls
        khapWinner={khapWinner}
        khapCount={khapCount}
        sanhWinner={sanhWinner}
        accumulatedSanh={accumulated.sanh}
        updateKhapCount={updateKhapCount}
        maxKhapAccumulate={gameConfig.maxKhapAccumulate}
      />
    </div>
  );
}

// Re-export types and utilities for external use
export type { CircularTableProps, ChatHeo, GameConfigSlice, RowMeta } from "./types";
export { formatScore, getScoreColorClass, getRankStyle, getShortName } from "./utils";