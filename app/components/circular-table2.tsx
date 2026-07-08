"use client";

import {
  Crown,
  Flame,
  Scissors,
  Spade,
  X,
  Plus,
  Minus,
  Check,
  Users,
} from "lucide-react";
import type { Player } from "~/stores/useSessionStore";
import { Button } from "./ui/button";

interface ChatHeo {
  id: string;
  chatterId: string;
  chatterName: string;
  victimId: string;
  victimName: string;
  heo: { do: number; den: number };
}

interface RowMeta {
  label: string;
  labelColor: string;
  style: string;
  isFixed: boolean;
  bgColor?: string;
  borderColor?: string;
}

interface GameConfigSlice {
  khapPoints: number;
  sanhPoints: number;
  maxKhapAccumulate: number;
  heoDoPoints: number;
  heodenPoints: number;
}

// Helper functions
function scoreFmt(v: number) {
  return v > 0 ? `+${v}` : `${v}`;
}

function scoreColor(v: number) {
  return v > 0
    ? "text-chart-2"
    : v < 0
      ? "text-destructive"
      : "text-muted-foreground";
}

function getRankStyle(rankIndex: number, isActive: boolean) {
  const styles = [
    {
      bg: "bg-gradient-to-br from-amber-400 to-amber-600",
      text: "text-amber-950",
      border: "border-amber-500/30",
      glow: "shadow-amber-500/20",
    },
    {
      bg: "bg-gradient-to-br from-slate-300 to-slate-500",
      text: "text-slate-950",
      border: "border-slate-400/30",
      glow: "shadow-slate-400/20",
    },
    {
      bg: "bg-gradient-to-br from-orange-300 to-orange-500",
      text: "text-orange-950",
      border: "border-orange-400/30",
      glow: "shadow-orange-400/20",
    },
    {
      bg: "bg-gradient-to-br from-rose-400 to-rose-600",
      text: "text-rose-950",
      border: "border-rose-400/30",
      glow: "shadow-rose-400/20",
    },
  ];
  return styles[rankIndex] || styles[3];
}

const rankBgColors = [
  "bg-chart-1",
  "bg-primary",
  "bg-destructive/70",
  "bg-destructive text-destructive-foreground",
];

// Player Card Component
function PlayerCard({
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
  index,
}: {
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
  index: number;
}) {
  const meta = getRowMeta(player.id, rankIndex);
  const rankStyle = getRankStyle(rankIndex, isSelected || isFixed);

  const shortName = player.name.split(" ").pop() || player.name;

  return (
    <div
      onClick={isSelectable && !isFixed ? onToggleSelect : undefined}
      className={`
        relative flex flex-col rounded-3xl border-2 p-4 transition-all duration-200
        ${isSelected || isFixed ? `${rankStyle.border} ${meta.bgColor}` : "border-border/60 bg-card/80"}
        ${isSelectable && !isFixed ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]" : ""}
        ${!isSelectable && !isFixed ? "opacity-60" : ""}
        ${isFixed ? "shadow-lg" : "shadow-sm"}
      `}
    >
      {/* Header - Rank Badge & Name */}
      <div className="flex items-start justify-between gap-2">
        <div className={`flex gap-1.5 items-center`}>
          {/* Rank Badge */}
          <div
            className={`
            flex items-center justify-center rounded-2xl px-3 py-1.5 text-sm font-black
            ${isFixed ? rankStyle.bg : "text-muted-foreground"}
            ${isFixed ? rankStyle.text : ""}
            ${isSelected && order !== null ? `${rankBgColors[order - 1]} text-white` : "bg-muted "}
          `} //
          >
            {isNhotter ? (
              <div className="flex items-center gap-1">
                <Crown className="size-4" />
                <span>Nhốt</span>
              </div>
            ) : isVictim ? (
              <span>Bị nhốt</span>
            ) : isDenner ? (
              <span>Đền</span>
            ) : isDenFor ? (
              <span>Được đền</span>
            ) : isSelected && order !== null ? (
              <span>{order}</span>
            ) : (
              "−"
            )}
          </div>

          {/* Player Name */}
          <span className="text-base font-bold text-foreground truncate max-w-[100px]">
            {shortName}
          </span>
        </div>

        {/* Score Display */}
        <div
          className={`
          flex flex-col items-end gap-0.5
          ${isSelected || isFixed ? "" : "opacity-0"}
        `}
        >
          <span
            className={`
            text-xl font-black tabular-nums
            ${scoreColor(score)}
          `}
          >
            {scoreFmt(score)}
          </span>
        </div>
      </div>

      {/* Selection Indicator */}
      {/* {isSelectable && !isFixed && (
        <div
          className={`
          absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full
          border-2 transition-all duration-200
          ${
            isSelected
              ? "bg-primary border-primary text-primary-foreground scale-110"
              : "bg-background border-border text-muted-foreground hover:border-primary/50"
          }
        `}
        >
          {isSelected ? (
            <Check className="size-4" />
          ) : (
            <span className="text-xs font-bold">{order ?? "·"}</span>
          )}
        </div>
      )} */}

      {/* Bonus Buttons Row */}
      <div
        className={`mt-3 flex items-center gap-2 ${index % 2 === 0 ? "" : "flex-col"}`}
      >
        {/* Khạp Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleKhap();
          }}
          disabled={isVictim}
          className={`
            flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold
            transition-all duration-200 disabled:opacity-40 w-full
            ${
              isKhapWinner
                ? "bg-chart-4/20 border-chart-4/50 text-chart-4"
                : isSanhWinner || isDenner || isDenFor
                  ? "opacity-50"
                  : "border-border/70 bg-background/80 text-muted-foreground hover:border-chart-4/50 hover:bg-chart-4/10"
            }
          `}
        >
          <Flame className={`size-3.5 ${isKhapWinner ? "text-chart-4" : ""}`} />
          <span>Khạp</span>
          {isKhapWinner && khapPts.gain > 0 && (
            <span className="text-chart-2">+{khapPts.gain}</span>
          )}
          {!isKhapWinner && khapPts.loss > 0 && (
            <span className="text-destructive">-{khapPts.loss}</span>
          )}
        </button>

        {/* Sảnh Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSanh();
          }}
          disabled={isVictim}
          className={`
            flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold
            transition-all duration-200 disabled:opacity-40 w-full
            ${
              isSanhWinner
                ? "bg-chart-1/20 border-chart-1/50 text-chart-1"
                : isKhapWinner || isDenner || isDenFor
                  ? "opacity-50"
                  : "border-border/70 bg-background/80 text-muted-foreground hover:border-chart-1/50 hover:bg-chart-1/10"
            }
          `}
        >
          <Spade className={`size-3.5 ${isSanhWinner ? "text-chart-1" : ""}`} />
          <span>Sảnh</span>
          {isSanhWinner && sanhPts.gain > 0 && (
            <span className="text-chart-2">+{sanhPts.gain}</span>
          )}
          {!isSanhWinner && sanhPts.loss > 0 && (
            <span className="text-destructive">-{sanhPts.loss}</span>
          )}
        </button>
      </div>
    </div>
  );
}

// Main Circular Table Component
export function CircularTable2({
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
}: {
  players: Player[];
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
}) {
  // Calculate positions for circular layout (4 players around center)
  const centerX = 160;
  const centerY = 160;
  const radius = 160;
  const playerCount = players.length;
  const angleStep = (2 * Math.PI) / playerCount;
  const startAngle = -Math.PI / 2; // Start from top

  const getPosition = (index: number) => {
    const angle = startAngle + index * angleStep;

    let x = centerX + radius * Math.cos(angle);
    let y = centerY + radius * Math.sin(angle);

    return { x, y };
  };

  // Determine grid layout based on player count
  const gridCols = playerCount <= 2 ? 2 : playerCount <= 4 ? 2 : 3;

  return (
    <div className="relative w-full py-4">
      {/* Circular Background */}

      {/* Center Hub - Confirm Button */}
      {/* Player Cards in Circular Layout */}
      <div className="relative z-20 mx-auto w-[320px] h-[380px] mt-8">
        {players.map((player, idx) => {
          const playerId = player.id;
          const rankIndex = ranking.indexOf(playerId);
          const order = selectOrder[idx];
          const isSelectable = selectableIds.includes(playerId);
          const isSelected = order !== null;
          const score = computedScores[playerId] || 0;
          const { isFixed, bgColor } = getRowMeta(playerId, rankIndex);

          const isNhotter = nhotterId === playerId;
          const isVictim = nhotVictimIds.includes(playerId);
          const isDenner = activeNhot?.dennerId === playerId;
          const isDenFor = denForIds.includes(playerId);

          const isKhapWinner = khapWinner === playerId;
          const isSanhWinner = sanhWinner === playerId;

          // Calculate points for khap/sanh
          const khapPts =
            isKhapWinner && khapCount > 0
              ? {
                  gain:
                    accumulated.khap * khapCount * gameConfig.khapPoints * 3,
                  loss: 0,
                }
              : {
                  gain: 0,
                  loss:
                    khapWinner && khapCount > 0
                      ? accumulated.khap * khapCount * gameConfig.khapPoints
                      : 0,
                };

          const sanhPts = isSanhWinner
            ? { gain: accumulated.sanh * gameConfig.sanhPoints * 3, loss: 0 }
            : {
                gain: 0,
                loss: sanhWinner ? accumulated.sanh * gameConfig.sanhPoints : 0,
              };

          // Filter chat heo for this player
          const chatHeo = {
            asChatter: chatHeoList.filter(
              (c) =>
                c.chatterId === playerId && !nhotVictimIds.includes(c.victimId),
            ),
            asVictim: chatHeoList.filter(
              (c) =>
                c.victimId === playerId && !nhotVictimIds.includes(c.victimId),
            ),
          };

          // Calculate position
          const pos = getPosition(idx);
          const cardWidth = idx % 2 === 0 ? 240 : 146;
          const cardHeight = 140;

          // Adjust position to center the card on the point
          const left = pos.x - cardWidth / 2;
          const top = pos.y - cardHeight / 2;

          const offsetY = [-30, 0, 70, 0];
          const offsetX = [0, 0, 0, 0];

          // Limit to visible area
          const adjustedLeft =
            Math.max(0, Math.min(320 - cardWidth, left)) + offsetX[idx];
          const adjustedTop =
            Math.max(0, Math.min(320 - cardHeight, top)) + offsetY[idx];

          return (
            <div
              key={playerId}
              className="absolute transition-all duration-300"
              style={{
                left: adjustedLeft,
                top: adjustedTop,
                width: cardWidth,
              }}
            >
              <PlayerCard
                player={player}
                rankIndex={rankIndex}
                order={order}
                score={score}
                isSelectable={isSelectable}
                isSelected={isSelected}
                isFixed={isFixed}
                isNhotter={isNhotter}
                isVictim={isVictim}
                isDenFor={isDenFor}
                isDenner={isDenner}
                isKhapWinner={isKhapWinner}
                isSanhWinner={isSanhWinner}
                khapPts={khapPts}
                sanhPts={sanhPts}
                chatHeo={chatHeo}
                gameConfig={gameConfig}
                onToggleSelect={() => toggleSelect(playerId)}
                onToggleKhap={() => toggleKhapPlayer(playerId)}
                onToggleSanh={() => toggleSanhPlayer(playerId)}
                getRowMeta={getRowMeta}
                index={idx}
              />
            </div>
          );
        })}
      </div>
      {/* Khạp/Sảnh Controls (when winner selected) */}
      {(khapWinner || sanhWinner) && (
        <div className="flex items-center justify-center gap-2 mb-4">
          {khapWinner && khapCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-chart-4/30 bg-chart-4/10 px-4 py-2">
              <Flame className="size-5 text-chart-4" />
              <span className="text-sm font-bold text-chart-4">
                Khạp x{khapCount * accumulated.khap}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateKhapCount(-1)}
                  disabled={khapCount <= 1}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold">
                  {khapCount}
                </span>
                <button
                  onClick={() => updateKhapCount(1)}
                  disabled={khapCount >= gameConfig.maxKhapAccumulate}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>
          )}
          {sanhWinner && (
            <div className="flex items-center gap-2 rounded-2xl border border-chart-1/30 bg-chart-1/10 px-4 py-2">
              <Spade className="size-5 text-chart-1" />
              <span className="text-sm font-bold text-chart-1">
                Sảnh x{accumulated.sanh}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 mb-4">
        {chatHeoList
          .filter((c) => !nhotVictimIds.includes(c.victimId))
          .map((c) => {
            const pts =
              (c.heo.do ?? 0) * gameConfig.heoDoPoints +
              (c.heo.den ?? 0) * gameConfig.heodenPoints;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3"
              >
                <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                  <span className="font-black">{c.chatterName}</span>
                  <Scissors className="size-3.5 text-muted-foreground" />
                  <span className="font-black">{c.victimName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(c.heo.do ?? 0) > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white">
                      {c.heo.do} Đỏ
                    </span>
                  )}
                  {(c.heo.den ?? 0) > 0 && (
                    <span className="rounded-full bg-foreground px-2 py-1 text-[10px] font-black text-background">
                      {c.heo.den} Đen
                    </span>
                  )}
                  <span className="font-black text-chart-2">
                    +{pts}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    / -{pts}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
      <div className="relative z-10 flex items-center justify-center pb-4">
        <Button
          onClick={save}
          disabled={disabledSaveButton}
          size="lg"
          className={`
            w-full h-14 flex items-center justify-center gap-1 shadow-xl transition-all duration-300
            ${
              disabledSaveButton
                ? "bg-muted text-muted-foreground border-border"
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105"
            }
          `}
        >
          <Check className="size-5" /> Xác nhận
        </Button>
      </div>
    </div>
  );
}
