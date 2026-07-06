"use client";

import { useMemo } from "react";
import { Crown, Flame, Spade, Check, ChevronUp, ChevronDown } from "lucide-react";
import type { CircularTableProps, ChatHeo, GameConfigSlice, RankStyle } from "./types";
import { formatScore, getScoreColorClass, getRankStyle, getShortName } from "./utils";
import { Button } from "~/components/ui/button";

// ── Score Card Component ──────────────────────────────────────────────────────

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
  gameConfig,
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
  const hasBonus = isKhapWinner || isSanhWinner;

  return (
    <div
      onClick={isSelectable && !isFixed ? onToggleSelect : undefined}
      className={`
        group relative flex flex-col gap-2 rounded-2xl border-2 p-3 transition-all duration-200
        ${isSelected || isFixed
          ? `${meta.borderColor} ${meta.bgColor} shadow-md`
          : "border-border/60 bg-card/80 hover:border-primary/30 hover:shadow-sm"
        }
        ${isSelectable && !isFixed ? "cursor-pointer active:scale-[0.98]" : ""}
        ${!isSelectable && !isFixed ? "opacity-50" : ""}
      `}
    >
      {/* Top Row: Rank Badge + Name + Score */}
      <div className="flex items-center justify-between gap-2">
        {/* Rank Badge */}
        <div
          className={`
            flex min-w-0 items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black
            ${isFixed
              ? `bg-gradient-to-br ${rankStyle.gradient} ${rankStyle.text} ring-2 ${rankStyle.ring}`
              : isSelected
                ? `bg-gradient-to-br ${rankStyle.gradient} ${rankStyle.text}`
                : "bg-muted text-muted-foreground"
            }
          `}
        >
          {isNhotter ? (
            <>
              <Crown className="size-3 shrink-0" />
              <span>Nhốt</span>
            </>
          ) : isVictim ? (
            <span className="text-destructive">Bị nhốt</span>
          ) : isDenner ? (
            <span className="text-orange-600">Đền</span>
          ) : isDenFor ? (
            <span className="text-emerald-600">Được đền</span>
          ) : isSelected && order !== null ? (
            <span>#{order}</span>
          ) : (
            <span className="text-[10px]">Hạng {rankIndex + 1}</span>
          )}
        </div>

        {/* Selection Indicator */}
        {isSelectable && !isFixed && (
          <div
            className={`
              flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black
              transition-all duration-200
              ${isSelected
                ? "bg-primary border-primary text-primary-foreground scale-110"
                : "border-border bg-background text-muted-foreground hover:border-primary/50"
              }
            `}
          >
            {isSelected ? <Check className="size-3" /> : order ?? "·"}
          </div>
        )}

        {/* Player Name */}
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground text-center">
          {shortName}
        </span>

        {/* Score */}
        <span className={`text-lg font-black tabular-nums shrink-0 ${getScoreColorClass(score)}`}>
          {formatScore(score)}
        </span>
      </div>

      {/* Bonus Buttons Row */}
      <div className="flex items-center gap-1.5">
        {/* Khạp Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleKhap(); }}
          disabled={bonusDisabled}
          className={`
            flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-bold
            transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40
            ${isKhapWinner
              ? "border-rose-500/50 bg-rose-500/15 text-rose-600"
              : "border-border/70 bg-muted/50 text-muted-foreground hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95"
            }
          `}
        >
          <Flame className={`size-3.5 shrink-0 ${isKhapWinner ? "text-rose-500" : ""}`} />
          <span className="truncate">Khạp</span>
          {isKhapWinner && khapPts.gain > 0 && (
            <span className="text-emerald-600 tabular-nums">+{khapPts.gain}</span>
          )}
          {!isKhapWinner && khapPts.loss > 0 && (
            <span className="text-destructive tabular-nums">-{khapPts.loss}</span>
          )}
        </button>

        {/* Sảnh Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSanh(); }}
          disabled={bonusDisabled}
          className={`
            flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-bold
            transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40
            ${isSanhWinner
              ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-600"
              : "border-border/70 bg-muted/50 text-muted-foreground hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-600 active:scale-95"
            }
          `}
        >
          <Spade className={`size-3.5 shrink-0 ${isSanhWinner ? "text-indigo-500" : ""}`} />
          <span className="truncate">Sảnh</span>
          {isSanhWinner && sanhPts.gain > 0 && (
            <span className="text-emerald-600 tabular-nums">+{sanhPts.gain}</span>
          )}
          {!isSanhWinner && sanhPts.loss > 0 && (
            <span className="text-destructive tabular-nums">-{sanhPts.loss}</span>
          )}
        </button>

        {/* Rank Move Buttons */}
        {isSelected && !isFixed && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={!canMoveUp}
              className="flex size-6 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={!canMoveDown}
              className="flex size-6 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Chat Heo Tags */}
      {(chatHeo.asChatter.length > 0 || chatHeo.asVictim.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {chatHeo.asChatter.map((c) => {
            const pts = (c.heo.do ?? 0) * gameConfig.heoDoPoints + (c.heo.den ?? 0) * gameConfig.heodenPoints;
            return (
              <div key={c.id} className="flex items-center gap-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5">
                <span className="text-[9px] font-bold text-emerald-600">+{pts}</span>
                {(c.heo.do ?? 0) > 0 && (
                  <span className="rounded bg-red-500 px-1 py-0.5 text-[8px] font-black text-white">{c.heo.do}đ</span>
                )}
                {(c.heo.den ?? 0) > 0 && (
                  <span className="rounded bg-foreground px-1 py-0.5 text-[8px] font-black text-background">{c.heo.den}đ</span>
                )}
              </div>
            );
          })}
          {chatHeo.asVictim.map((c) => {
            const pts = (c.heo.do ?? 0) * gameConfig.heoDoPoints + (c.heo.den ?? 0) * gameConfig.heodenPoints;
            return (
              <div key={c.id} className="flex items-center gap-0.5 rounded-lg border border-red-500/30 bg-red-500/10 px-1.5 py-0.5">
                <span className="text-[9px] font-bold text-destructive">-{pts}</span>
                {(c.heo.do ?? 0) > 0 && (
                  <span className="rounded bg-red-500 px-1 py-0.5 text-[8px] font-black text-white">{c.heo.do}đ</span>
                )}
                {(c.heo.den ?? 0) > 0 && (
                  <span className="rounded bg-foreground px-1 py-0.5 text-[8px] font-black text-background">{c.heo.den}đ</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main CircularTable Component ─────────────────────────────────────────────

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
  // Helper to calculate khap/sanh points
  const calcKhapPts = (isWinner: boolean) => {
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
  };

  const calcSanhPts = (isWinner: boolean) => {
    if (isWinner) {
      return {
        gain: accumulated.sanh * gameConfig.sanhPoints * 3,
        loss: 0,
      };
    }
    return {
      gain: 0,
      loss: sanhWinner
        ? accumulated.sanh * gameConfig.sanhPoints
        : 0,
    };
  };

  // Check if can move up/down for each player
  const canMoveMap = useMemo(() => {
    const result: Record<string, { up: boolean; down: boolean }> = {};
    ranking.forEach((pid, idx) => {
      const prevId = ranking[idx - 1];
      const nextId = ranking[idx + 1];
      const canUp = idx > 0 && selectableIds.includes(pid) && selectableIds.includes(prevId);
      const canDown = idx < ranking.length - 1 && selectableIds.includes(pid) && selectableIds.includes(nextId);
      result[pid] = { up: canUp, down: canDown };
    });
    return result;
  }, [ranking, selectableIds]);

  const totalSlots = activeNhot ? requiredSelections : players.length;
  const hasWinner = khapWinner || sanhWinner;

  return (
    <div className="relative flex w-full flex-col gap-4 px-1">
      {/* ── Progress & Controls Header ─────────────────── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/40 p-3">
        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="text-xs font-black">{selectCounter}/{totalSlots}</span>
          </div>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(selectCounter / totalSlots) * 100}%` }}
            />
          </div>
        </div>

        {/* Quick Khap/Sanh Controls */}
        {hasWinner && (
          <div className="flex items-center gap-2">
            {khapWinner && khapCount > 0 && (
              <div className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2 py-1">
                <Flame className="size-4 text-rose-500" />
                <span className="text-sm font-bold text-rose-600">×{khapCount}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => updateKhapCount(-1)}
                    disabled={khapCount <= 1}
                    className="flex size-5 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
                  >
                    −
                  </button>
                  <button
                    onClick={() => updateKhapCount(1)}
                    disabled={khapCount >= gameConfig.maxKhapAccumulate}
                    className="flex size-5 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            {sanhWinner && (
              <div className="flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2 py-1">
                <Spade className="size-4 text-indigo-500" />
                <span className="text-sm font-bold text-indigo-600">×{accumulated.sanh}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Player Cards Grid ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {players.map((player) => {
          const playerId = player.id;
          const rankIndex = ranking.indexOf(playerId);
          const idx = players.findIndex((p) => p.id === playerId);
          const order = selectOrder[idx];
          const isSelectable = selectableIds.includes(playerId);
          const isSelected = order !== null;

          const isNhotter = nhotterId === playerId;
          const isVictim = nhotVictimIds.includes(playerId);
          const isDenner = activeNhot?.dennerId === playerId;
          const isDenFor = denForIds.includes(playerId);

          const isKhapWinnerLocal = khapWinner === playerId;
          const isSanhWinnerLocal = sanhWinner === playerId;

          const score = computedScores[playerId] || 0;

          const chatHeo = {
            asChatter: chatHeoList.filter(c => c.chatterId === playerId && !nhotVictimIds.includes(c.victimId)),
            asVictim: chatHeoList.filter(c => c.victimId === playerId && !nhotVictimIds.includes(c.victimId)),
          };

          const khapPts = calcKhapPts(isKhapWinnerLocal);
          const sanhPts = calcSanhPts(isSanhWinnerLocal);

          const { up, down } = canMoveMap[playerId] ?? { up: false, down: false };

          const handleMoveUp = () => {
            const currentIdx = ranking.indexOf(playerId);
            if (currentIdx > 0) {
              const prevId = ranking[currentIdx - 1];
              if (selectableIds.includes(prevId)) {
                // Swap order values
                const currentOrder = selectOrder[idx];
                const prevPlayerIdx = players.findIndex(p => p.id === prevId);
                setSelectOrder((prev: (number | null)[]) => {
                  const next = [...prev];
                  [next[idx], next[prevPlayerIdx]] = [next[prevPlayerIdx], next[idx]];
                  return next;
                });
              }
            }
          };

          const handleMoveDown = () => {
            const currentIdx = ranking.indexOf(playerId);
            if (currentIdx < ranking.length - 1) {
              const nextId = ranking[currentIdx + 1];
              if (selectableIds.includes(nextId)) {
                const currentOrder = selectOrder[idx];
                const nextPlayerIdx = players.findIndex(p => p.id === nextId);
                setSelectOrder((prev: (number | null)[]) => {
                  const next = [...prev];
                  [next[idx], next[nextPlayerIdx]] = [next[nextPlayerIdx], next[idx]];
                  return next;
                });
              }
            }
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

      {/* ── Confirm Button ──────────────────────────────────── */}
      <Button
        onClick={save}
        disabled={disabledSaveButton}
        className={`
          flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black shadow-xl
          transition-all duration-200 active:scale-[0.98]
          ${disabledSaveButton
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
          }
        `}
      >
        {disabledSaveButton ? (
          <>
            {activeNhot
              ? `Chọn hạng 2 và 3 (${selectCounter}/${requiredSelections})`
              : `Chọn đủ người chơi (${selectCounter}/${players.length})`
            }
          </>
        ) : (
          <>
            <Check className="size-5" />
            Lưu ván đấu
          </>
        )}
      </Button>
    </div>
  );
}

// Re-export types
export type { CircularTableProps, ChatHeo, GameConfigSlice } from "./types";