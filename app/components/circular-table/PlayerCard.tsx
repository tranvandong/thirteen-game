"use client";

import { Crown, Flame, Spade, Check } from "lucide-react";
import type { Player, ChatHeo, RowMeta, GameConfigSlice } from "./types";
import { getShortName, getRankStyle, formatScore, getScoreColorClass } from "./utils";
import { ChatHeoTag } from "./ChatHeoTag";

interface PlayerCardProps {
  player: Player;
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
  getRowMeta: (playerId: string, rankIndex: number) => RowMeta;
}

export function PlayerCard({
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
  getRowMeta,
}: PlayerCardProps) {
  const meta = getRowMeta(player.id, rankIndex);
  const rankStyle = getRankStyle(rankIndex);
  const shortName = getShortName(player.name);

  // Disable bonus buttons for victims
  const bonusDisabled = isVictim || isDenner || isDenFor;

  return (
    <div
      onClick={isSelectable && !isFixed ? onToggleSelect : undefined}
      className={`
        relative flex flex-col rounded-2xl border-2 p-4 transition-all duration-200
        ${isSelected || isFixed
          ? `${meta.borderColor} ${meta.bgColor} shadow-lg`
          : "border-border/60 bg-card/80 hover:border-primary/30"
        }
        ${isSelectable && !isFixed
          ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:shadow-md"
          : ""
        }
        ${!isSelectable && !isFixed ? "opacity-50" : ""}
      `}
    >
      {/* Selection Indicator - Top Right */}
      {isSelectable && !isFixed && (
        <div
          className={`
            absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full
            border-2 transition-all duration-200 text-xs font-black
            ${isSelected
              ? "bg-primary border-primary text-primary-foreground scale-110"
              : "bg-background border-border text-muted-foreground hover:border-primary/50"
            }
          `}
        >
          {isSelected ? <Check className="size-3" /> : order ?? "·"}
        </div>
      )}

      {/* Header - Rank Badge & Name & Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          {/* Rank Badge */}
          <div
            className={`
              flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-black gap-1.5
              ${isFixed
                ? `bg-gradient-to-br ${rankStyle.gradient} ${rankStyle.text} ring-2 ${rankStyle.ring}`
                : isSelected
                  ? `bg-gradient-to-br ${rankStyle.gradient} ${rankStyle.text}`
                  : "bg-muted text-muted-foreground"
              }
            `}
          >
            {isNhotter && (
              <>
                <Crown className="size-3.5" />
                <span>Nhốt</span>
              </>
            )}
            {isVictim && <span className="text-destructive">Bị nhốt</span>}
            {isDenner && <span className="text-orange-500">Đền</span>}
            {isDenFor && <span className="text-emerald-500">Được đền</span>}
            {!isNhotter && !isVictim && !isDenner && !isDenFor && isSelected && order !== null && (
              <span>#{order}</span>
            )}
            {!isNhotter && !isVictim && !isDenner && !isDenFor && !isSelected && (
              <span className="text-xs">Hạng {rankIndex + 1}</span>
            )}
          </div>

          {/* Player Name */}
          <span className="text-sm font-bold text-foreground truncate max-w-[90px]">
            {shortName}
          </span>
        </div>

        {/* Score */}
        <div className={`text-xl font-black tabular-nums ${getScoreColorClass(score)}`}>
          {formatScore(score)}
        </div>
      </div>

      {/* Bonus Buttons Row */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {/* Khạp Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleKhap();
          }}
          disabled={bonusDisabled}
          className={`
            flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold
            transition-all duration-200 disabled:opacity-40
            ${isKhapWinner
              ? "bg-rose-500/20 border-rose-500/50 text-rose-600"
              : bonusDisabled
                ? "opacity-50 border-border bg-muted/50"
                : "border-border/70 bg-muted/30 text-muted-foreground hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-600"
            }
          `}
        >
          <Flame className={`size-3 ${isKhapWinner ? "text-rose-500" : ""}`} />
          <span>Khạp</span>
          {isKhapWinner && khapPts.gain > 0 && (
            <span className="text-emerald-500">+{khapPts.gain}</span>
          )}
          {!isKhapWinner && khapPts.loss > 0 && (
            <span className="text-red-500">-{khapPts.loss}</span>
          )}
        </button>

        {/* Sảnh Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSanh();
          }}
          disabled={bonusDisabled}
          className={`
            flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold
            transition-all duration-200 disabled:opacity-40
            ${isSanhWinner
              ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-600"
              : bonusDisabled
                ? "opacity-50 border-border bg-muted/50"
                : "border-border/70 bg-muted/30 text-muted-foreground hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-600"
            }
          `}
        >
          <Spade className={`size-3 ${isSanhWinner ? "text-indigo-500" : ""}`} />
          <span>Sảnh</span>
          {isSanhWinner && sanhPts.gain > 0 && (
            <span className="text-emerald-500">+{sanhPts.gain}</span>
          )}
          {!isSanhWinner && sanhPts.loss > 0 && (
            <span className="text-red-500">-{sanhPts.loss}</span>
          )}
        </button>
      </div>

      {/* Chat Heo Tags */}
      {(chatHeo.asChatter.length > 0 || chatHeo.asVictim.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chatHeo.asChatter.map((c) => (
            <ChatHeoTag key={c.id} chat={c} gameConfig={gameConfig} isChatter={true} />
          ))}
          {chatHeo.asVictim.map((c) => (
            <ChatHeoTag key={c.id} chat={c} gameConfig={gameConfig} isChatter={false} />
          ))}
        </div>
      )}
    </div>
  );
}