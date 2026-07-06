"use client";

import { useCallback } from "react";
import { Crown, Flame, Spade, Check, ChevronUp, ChevronDown } from "lucide-react";
import type { CircularTableProps, ChatHeo, GameConfigSlice } from "./types";
import { formatScore, getScoreColorClass, getRankStyle, getShortName } from "./utils";
import { Button } from "~/components/ui/button";

// ── Types ───────────────────────────────────────────────────

interface ScoreCardProps {
  player: { id: string; name: string; orderNo: number; initialScore: number };
  rankIndex: number;
  order: number | null;
  score: number;
  isSelectable: boolean;
  isSelected: boolean;
  isFixed: boolean;
  isNhotter: boolean;
  isVictim: boolean;
  isDenFor: boolean;
  isDenner: boolean;
  isKhapWinner: boolean;
  isSanhWinner: boolean;
  khapPts: { gain: number; loss: number };
  sanhPts: { gain: number; loss: number };
  chatHeo: { asChatter: ChatHeo[]; asVictim: ChatHeo[] };
  gameConfig: GameConfigSlice;
  onToggleSelect: () => void;
  onToggleKhap: () => void;
  onToggleSanh: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  getRowMeta: (playerId: string, rankIndex: number) => {
    label: string;
    labelColor: string;
    style: string;
    isFixed: boolean;
    bgColor: string;
    borderColor: string;
  };
}

// ── ScoreCard ─────────────────────────────────────────────────

function ScoreCard({
  player,
  rankIndex,
  order,
  score,
  isSelectable,
  isSelected,
  isFixed,
  isNhotter,
  isVictim,
  isDenFor,
  isDenner,
  isKhapWinner,
  isSanhWinner,
  khapPts,
  sanhPts,
  chatHeo,
  onToggleSelect,
  onToggleKhap,
  onToggleSanh,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  getRowMeta,
}: ScoreCardProps) {
  const meta = getRowMeta(player.id, rankIndex);
  const rankStyle = getRankStyle(rankIndex);
  const shortName = getShortName(player.name);

  const bonusDisabled = isVictim || isDenner || isDenFor;

  // Determine label text and style
  const labelText = isNhotter
    ? "Nhốt"
    : isVictim
      ? "Bị nhốt"
      : isDenner
        ? "Đền"
        : isDenFor
          ? "Được đền"
          : isSelected && order !== null
            ? `#${order}`
            : `Hạng ${rankIndex + 1}`;

  const labelColor = isNhotter
    ? "text-primary"
    : isVictim
      ? "text-destructive"
      : isDenner
        ? "text-orange-600"
        : isDenFor
          ? "text-emerald-600"
          : isSelected
            ? rankStyle.text
            : "text-muted-foreground";

  const labelBg = isNhotter
    ? "bg-primary/15"
    : isVictim
      ? "bg-destructive/15"
      : isDenner
        ? "bg-orange-500/15"
        : isDenFor
          ? "bg-emerald-500/15"
          : isSelected
            ? `bg-gradient-to-br ${rankStyle.gradient}`
            : "bg-muted";

  const cardBg = isSelected || isFixed ? meta.bgColor : "bg-card";
  const cardBorder = isSelected || isFixed ? meta.borderColor : "border-border/60";

  return (
    <div
      onClick={isSelectable && !isFixed ? onToggleSelect : undefined}
      className={`
        flex flex-col gap-2 rounded-2xl border-2 p-3 transition-all duration-150
        ${cardBg} ${cardBorder}
        ${isSelectable && !isFixed ? "cursor-pointer active:scale-[0.97] active:shadow-sm" : ""}
        ${!isSelectable && !isFixed ? "opacity-45" : ""}
        ${isFixed ? "shadow-md" : ""}
      `}
    >
      {/* ── Header Row ─────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        {/* Rank Badge */}
        <div className={`
          flex min-w-0 items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black
          ${labelBg} ${labelColor}
        `}>
          {isNhotter && <Crown className="size-3 shrink-0" />}
          <span className="truncate">{labelText}</span>
        </div>

        {/* Selection indicator */}
        {isSelectable && !isFixed && (
          <div className={`
            flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black
            transition-all duration-150
            ${isSelected
              ? "bg-primary border-primary text-primary-foreground scale-110"
              : "border-border bg-background text-muted-foreground hover:border-primary/50"
            }
          `}>
            {isSelected ? <Check className="size-3" /> : <span className="text-[10px]">{order ?? "·"}</span>}
          </div>
        )}

        {/* Name */}
        <span className="min-w-0 flex-1 truncate text-center text-sm font-bold">
          {shortName}
        </span>

        {/* Score */}
        <span className={`text-lg font-black tabular-nums shrink-0 ${getScoreColorClass(score)}`}>
          {formatScore(score)}
        </span>
      </div>

      {/* ── Bonus Buttons ─────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Khạp */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleKhap(); }}
          disabled={bonusDisabled}
          className={`
            flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold
            transition-all duration-150 active:scale-95 disabled:cursor-not-allowed
            ${isKhapWinner
              ? "border-rose-500/50 bg-rose-500/15 text-rose-600"
              : "border-border/70 bg-muted/50 text-muted-foreground hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
            }
          `}
        >
          <Flame className={`size-4 ${isKhapWinner ? "text-rose-500" : ""}`} />
          <span className="truncate">Khạp</span>
          {isKhapWinner && khapPts.gain > 0 && (
            <span className="text-emerald-600 tabular-nums">+{khapPts.gain}</span>
          )}
          {!isKhapWinner && khapPts.loss > 0 && (
            <span className="text-destructive tabular-nums">-{khapPts.loss}</span>
          )}
        </button>

        {/* Sảnh */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSanh(); }}
          disabled={bonusDisabled}
          className={`
            flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold
            transition-all duration-150 active:scale-95 disabled:cursor-not-allowed
            ${isSanhWinner
              ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-600"
              : "border-border/70 bg-muted/50 text-muted-foreground hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-600 disabled:opacity-40"
            }
          `}
        >
          <Spade className={`size-4 ${isSanhWinner ? "text-indigo-500" : ""}`} />
          <span className="truncate">Sảnh</span>
          {isSanhWinner && sanhPts.gain > 0 && (
            <span className="text-emerald-600 tabular-nums">+{sanhPts.gain}</span>
          )}
          {!isSanhWinner && sanhPts.loss > 0 && (
            <span className="text-destructive tabular-nums">-{sanhPts.loss}</span>
          )}
        </button>

        {/* Rank Swap Buttons */}
        {isSelected && !isFixed && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={!canMoveUp}
              className="flex size-8 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={!canMoveDown}
              className="flex size-8 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Chat Heo Tags ─────────────────── */}
      {(chatHeo.asChatter.length > 0 || chatHeo.asVictim.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {chatHeo.asChatter.map((c) => {
            const pts = (c.heo.do ?? 0) * gameConfig.heoDoPoints + (c.heo.den ?? 0) * gameConfig.heodenPoints;
            return (
              <div key={c.id} className="flex items-center gap-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5">
                <span className="text-[10px] font-bold text-emerald-600">+{pts}</span>
                {(c.heo.do ?? 0) > 0 && <span className="rounded bg-red-500 px-1 py-0.5 text-[9px] font-black text-white">{c.heo.do}đ</span>}
                {(c.heo.den ?? 0) > 0 && <span className="rounded bg-foreground px-1 py-0.5 text-[9px] font-black text-background">{c.heo.den}đ</span>}
              </div>
            );
          })}
          {chatHeo.asVictim.map((c) => {
            const pts = (c.heo.do ?? 0) * gameConfig.heoDoPoints + (c.heo.den ?? 0) * gameConfig.heodenPoints;
            return (
              <div key={c.id} className="flex items-center gap-0.5 rounded-lg border border-red-500/30 bg-red-500/10 px-1.5 py-0.5">
                <span className="text-[10px] font-bold text-destructive">−{pts}</span>
                {(c.heo.do ?? 0) > 0 && <span className="rounded bg-red-500 px-1 py-0.5 text-[9px] font-black text-white">{c.heo.do}đ</span>}
                {(c.heo.den ?? 0) > 0 && <span className="rounded bg-foreground px-1 py-0.5 text-[9px] font-black text-background">{c.heo.den}đ</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CircularTable ────────────────────────────────────────────────────────────

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
  // Point calculators
  const calcKhapPts = useCallback(
    (isWinner: boolean) => {
      if (isWinner && khapCount > 0) {
        return {
          gain: accumulated.khap * khapCount * gameConfig.khapPoints * 3,
          loss: 0,
        };
      }
      return {
        gain: 0,
        loss: khapWinner && khapCount > 0
          ? accumulated.khap * khapCount * gameConfig.khapPoints
          : 0,
      };
    },
    [accumulated.khap, khapCount, khapWinner, gameConfig.khapPoints],
  );

  const calcSanhPts = useCallback(
    (isWinner: boolean) => {
      if (isWinner) {
        return {
          gain: accumulated.sanh * gameConfig.sanhPoints * 3,
          loss: 0,
        };
      }
      return {
        gain: 0,
        loss: sanhWinner ? accumulated.sanh * gameConfig.sanhPoints : 0,
      };
    },
    [accumulated.sanh, sanhWinner, gameConfig.sanhPoints],
  );

  // Build a set for O(1) lookup
  const selectableSet = new Set(selectableIds);
  const canMoveMap = new Map<string, { up: boolean; down: boolean }>();

  ranking.forEach((pid, idx) => {
    const prev = ranking[idx - 1];
    const next = ranking[idx + 1];
    const up =
      idx > 0 &&
      selectableSet.has(pid) &&
      selectableSet.has(prev);
    const down =
      idx < ranking.length - 1 &&
      selectableSet.has(pid) &&
      selectableSet.has(next);
    canMoveMap.set(pid, { up, down });
  });

  // Swap helper
  const handleSwap = useCallback(
    (aId: string, bId: string) => {
      const aIdx = players.findIndex((p) => p.id === aId);
      const bIdx = players.findIndex((p) => p.id === bId);
      if (aIdx < 0 || bIdx < 0) return;
      setSelectOrder((prev: (number | null)[]) => {
        const next = [...prev];
        [next[aIdx], next[bIdx]] = [next[bIdx], next[aIdx]];
        return next;
      });
    },
    [players],
  );

  const totalSlots = activeNhot ? requiredSelections : players.length;
  const hasWinner = khapWinner || sanhWinner;

  return (
    <div className="flex w-full flex-col gap-3 px-0.5 pb-safe">
      {/* ── Progress Bar + Quick Controls ────── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/40 p-3">
        {/* Progress */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="text-sm font-black">{selectCounter}/{totalSlots}</span>
          </div>
          <div className="w-24 overflow-hidden rounded-full bg-muted sm:w-32">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(selectCounter / totalSlots) * 100}%` }}
            />
          </div>
        </div>

        {/* Quick Khap/Sanh controls */}
        {hasWinner && (
          <div className="flex items-center gap-2">
            {khapWinner && khapCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
                <Flame className="size-5 text-rose-500" />
                <span className="text-sm font-bold text-rose-600">×{khapCount}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateKhapCount(-1)}
                    disabled={khapCount <= 1}
                    className="flex size-7 items-center justify-center rounded-full bg-background text-sm font-bold disabled:opacity-30 active:scale-90"
                  >
                    −
                  </button>
                  <button
                    onClick={() => updateKhapCount(1)}
                    disabled={khapCount >= gameConfig.maxKhapAccumulate}
                    className="flex size-7 items-center justify-center rounded-full bg-background text-sm font-bold disabled:opacity-30 active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            {sanhWinner && (
              <div className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5">
                <Spade className="size-5 text-indigo-500" />
                <span className="text-sm font-bold text-indigo-600">×{accumulated.sanh}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Player Cards ───────────────────── */}
      {/*
        Mobile-first grid:
        - < sm : 2 columns (2×2)
        - sm+   : 4 columns (4×1 on larger screens)
      */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {players.map((player) => {
          const playerId = player.id;
          const rankIndex = ranking.indexOf(playerId);
          const pIdx = players.findIndex((p) => p.id === playerId);
          const order = selectOrder[pIdx];
          const isSelectable = selectableSet.has(playerId);
          const isSelected = order !== null;

          const isNhotter = nhotterId === playerId;
          const isVictim = nhotVictimIds.includes(playerId);
          const isDenner = activeNhot?.dennerId === playerId;
          const isDenFor = denForIds.includes(playerId);

          const isKhapWinnerLocal = khapWinner === playerId;
          const isSanhWinnerLocal = sanhWinner === playerId;
          const score = computedScores[playerId] || 0;

          const chatHeo = {
            asChatter: chatHeoList.filter(
              (c) => c.chatterId === playerId && !nhotVictimIds.includes(c.victimId),
            ),
            asVictim: chatHeoList.filter(
              (c) => c.victimId === playerId && !nhotVictimIds.includes(c.victimId),
            ),
          };

          const khapPts = calcKhapPts(isKhapWinnerLocal);
          const sanhPts = calcSanhPts(isSanhWinnerLocal);

          const { up, down } = canMoveMap.get(playerId) ?? { up: false, down: false };

          // Swap handlers
          const handleMoveUp = () => {
            const currIdx = ranking.indexOf(playerId);
            if (currIdx > 0) handleSwap(ranking[currIdx - 1], playerId);
          };
          const handleMoveDown = () => {
            const currIdx = ranking.indexOf(playerId);
            if (currIdx < ranking.length - 1) handleSwap(playerId, ranking[currIdx + 1]);
          };

          return (
            <ScoreCard
              key={playerId}
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
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              canMoveUp={up}
              canMoveDown={down}
              getRowMeta={getRowMeta}
            />
          );
        })}
      </div>

      {/* ── Confirm Button ────────────────── */}
      <Button
        onClick={save}
        disabled={disabledSaveButton}
        className={`
          flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black
          transition-all duration-150 active:scale-[0.97]
          ${disabledSaveButton
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
          }
        `}
      >
        <Check className="size-5" />
        {disabledSaveButton
          ? activeNhot
            ? `Chọn hạng 2 & 3 (${selectCounter}/${requiredSelections})`
            : `Chọn đủ người (${selectCounter}/${players.length})`
          : "Lưu ván đấu"}
      </Button>
    </div>
  );
}

// Re-export types
export type { CircularTableProps, ChatHeo, GameConfigSlice } from "./types";