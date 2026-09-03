import {
  Crown,
  Flame,
  Minus,
  Plus,
  Scissors,
  Spade,
  Swords,
  XCircle,
} from "lucide-react";
import type { Player } from "~/stores/useSessionStore";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";
import { useEffect, useRef } from "react";
import { useAudio } from "~/hooks/useAudio";

interface ChatHeo {
  id: string;
  chatterId: string;
  victimId: string;
  heo: { do: number; den: number };
}

interface RowMeta {
  label: string;
  labelColor: string;
  style: string;
  isFixed: boolean;
}

interface GameConfigSlice {
  khapPoints: number;
  sanhPoints: number;
  maxKhapAccumulate: number;
  heoDoPoints: number;
  heodenPoints: number;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const BORDER = 160;
const RADIUS = 50;
// Khoảng cách content tràn ra ngoài cạnh vuông (giống offset -80px trong sample:
// .right-content { right: -80px }, .left-content { left: -80px }
const OFFSET = (SIZE - BORDER) / 2;

// Mỗi section gồm: clipPath cho vùng click hình tam giác (giữ nguyên như cũ)
// và contentStyle mô phỏng chính xác .top-content/.right-content/.bottom-content/.left-content
// trong file styles.css mẫu: content luôn có width/height = SIZE x BORDER, được xoay
// (rotate 0/90/180/270deg) để chữ luôn đọc được đúng chiều từ vị trí ngồi của người chơi đó.
const SECTIONS = [
  {
    id: "top",
    label: "Trên",
    side: "Top",
    clipPath: "polygon(0 0, 100% 0, 50% 50%)",
    contentStyle: {
      top: 0,
      left: 0,
      right: 0,
      width: "100%",
      height: BORDER,
      transform: "none",
    },
  },
  {
    id: "right",
    label: "Phải",
    side: "Right",
    clipPath: "polygon(100% 0, 100% 100%, 50% 50%)",
    contentStyle: {
      width: "100%",
      height: "50%",
      right: "25%",
      bottom: "25%",
      transform: "translateX(50%) rotate(90deg)",
    },
  },
  {
    id: "bottom",
    label: "Dưới",
    side: "Bottom",
    clipPath: "polygon(100% 100%, 0 100%, 50% 50%)",
    contentStyle: {
      bottom: 0,
      left: 0,
      right: 0,
      width: "100%",
      height: BORDER,
      transform: "rotate(180deg)",
    },
  },
  {
    id: "left",
    label: "Trái",
    side: "Left",
    clipPath: "polygon(0 100%, 0 0, 50% 50%)",
    contentStyle: {
      width: "100%",
      height: "50%",
      left: "25%",
      bottom: "25%",
      transform: "translateX(-50%) rotate(270deg)",
    },
  },
];

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

export function CircularTable3({
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
  isLoading,
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
  isLoading: boolean;
}) {
  const successAudioRef = useRef(new Audio("/sounds/success.mp3"));
  const tapSound = useAudio("/sounds/tap.mp3", 0.5);

  const handleTap = () => {
    tapSound.play();
  };

  const getBackgroundImage = (score: number) => {
    if (score <= -10) {
      return "radial-gradient(rgba(255, 0, 0, 1), rgba(255,0,0,0.4))";
    }

    if (score >= 10) {
      return "radial-gradient(rgb(216 0 255 / 1), rgba(216,0,255,0.4))";
    }

    if (score < 0) {
      return "radial-gradient(rgba(255, 0, 0, 0.6), rgba(255,255,255,0))";
    }

    if (score > 0) {
      return "radial-gradient(rgba(0,255,0,.35), rgba(255,255,255,0))";
    }

    return undefined;
  };
  return (
    <>
      <div className="relative z-10 mx-auto w-full">
        <div className="relative mx-auto w-full aspect-square">
          {/* Center hub */}

          <Button
            className={cn(
              "w-[25%] h-[25%] absolute pointer-events-auto left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 shadow-xl shadow-primary/20",
              // !disabledSaveButton && "animate-holy-glow",
            )}
            onClick={(e) => {
              e.stopPropagation();
              save();
              successAudioRef.current.currentTime = 0;
              successAudioRef.current.play();
            }}
            disabled={disabledSaveButton}
          >
            {/* {!disabledSaveButton && (
            <div className="absolute inset-1 rounded-full animate-spin">
              <div className="w-full h-full rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-300 opacity-70" />
            </div>
          )} */}

            {isLoading && (
              <div className="absolute inset-1 rounded-full animate-spin">
                <div className="w-full h-full rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-300 opacity-70" />
              </div>
            )}

            {!disabledSaveButton || isLoading ? (
              <div className="absolute inset-0 p-2 w-full h-full flex items-center justify-center z-30 rounded-full">
                <img
                  src="/icons/swords.gif"
                  alt="swords"
                  className="size-full text-primary/3 rounded-full"
                />
              </div>
            ) : (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center z-10">
                <Swords className="size-14 text-white/50" />
              </div>
            )}
          </Button>
          <div className="absolute inset-0 w-full h-full flex items-center justify-center z-0">
            <Swords className="size-full text-primary/5" />
          </div>
          <div className="absolute inset-0 w-full h-full flex items-center justify-center z-0">
            <div
              className="w-full h-px rotate-45"
              style={{
                border: 0,
                backgroundImage:
                  " linear-gradient(to left, rgba(145, 145, 145, 0.2), rgba(0, 0, 0, 0))",
              }}
            ></div>
          </div>

          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
            <div
              className="w-full h-px rotate-135"
              style={{
                border: 0,
                backgroundImage:
                  " linear-gradient(to left,rgba(145, 145, 145, 0.2  ),  rgba(0, 0, 0, 0))",
              }}
            ></div>
          </div>

          {players.map((player, idx) => {
            const playerId = player.id;
            const rankIndex = ranking.indexOf(playerId);
            const order = selectOrder[idx];
            const isSelectable = selectableIds.includes(playerId);
            const isSelected = order !== null;
            const { label, labelColor, isFixed } = getRowMeta(
              playerId,
              rankIndex,
            );
            const showAsActive = isFixed || isSelected;
            const score = computedScores[playerId];
            const isKhapWinner = khapWinner === playerId;
            const isSanhWinner = sanhWinner === playerId;
            const khapTaken = khapWinner !== null && !isKhapWinner;
            const sanhTaken = sanhWinner !== null && !isSanhWinner;
            const khapPtsDisplay =
              isKhapWinner && khapCount > 0
                ? accumulated.khap * khapCount * gameConfig.khapPoints * 3
                : 0;
            const khapPtsLoss =
              !isKhapWinner && khapWinner !== null && khapCount > 0
                ? accumulated.khap * khapCount * gameConfig.khapPoints
                : 0;
            const sanhPtsDisplay = isSanhWinner
              ? accumulated.sanh * gameConfig.sanhPoints * 3
              : 0;
            const sanhPtsLoss =
              !isSanhWinner && sanhWinner !== null
                ? accumulated.sanh * gameConfig.sanhPoints
                : 0;

            const showBonus =
              showAsActive ||
              (selectCounter >= selectableIds.length - 1 &&
                rankIndex === ranking.length - 1 &&
                !isFixed);
            const section = SECTIONS[idx];
            return (
              <div
                key={section.id}
                className="pointer-events-none absolute inset-0"
              >
                {/* Vung hinh tam giac de bat click, giu nguyen clip-path nhu file mau (.border) */}
                <button
                  type="button"
                  aria-label={`Chon huong ${section.label}`}
                  onClick={() => {
                    handleTap();
                    if (isSelectable) {
                      toggleSelect(playerId);
                    }
                  }}
                  disabled={!isSelectable}
                  className={cn(
                    "pointer-events-auto absolute inset-0 border-solid border-transparent transition-all duration-300 hover:opacity-80 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
                    isSelectable
                      ? "cursor-pointer bg-gray-300/10"
                      : "cursor-default bg-transparent",
                  )}
                  style={{
                    borderRadius: RADIUS,
                    clipPath: section.clipPath,
                    ...(showAsActive ? { border: "4px solid #02bc7d" } : {}),
                    backgroundImage: showAsActive ? getBackgroundImage(score) : "",
                    opacity: showAsActive ? 1 : 0.5,
                  }}
                />

                <div
                  className="pointer-events-none absolute z-10 flex flex-col items-center pt-3 px-2 text-center"
                  style={section.contentStyle}
                >
                  {showAsActive && (
                    <div className="pointer-events-auto flex items-center gap-3">
                      {/* Khap button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTap();
                          toggleKhapPlayer(playerId);
                        }}
                        disabled={nhotVictimIds.includes(playerId)}
                        className={`flex w-full min-w-28 items-center justify-center gap-1 trasition-all duration-300 rounded-2xl border px-4 py-3 text-xs font-black disabled:opacity-40 sm:w-auto ${
                          isKhapWinner
                            ? "border-amber-500/50 bg-amber-500/20 text-amber-500 shadow-md"
                            : khapTaken
                              ? "border-destructive/20 bg-destructive/10 text-destructive shadow-md"
                              : "border-border/30 bg-background/10 text-muted-foreground"
                        }`}
                      >
                        <Flame className="size-3 shrink-0" />
                        Khạp
                        {isKhapWinner && khapPtsDisplay > 0 && (
                          <>
                            <span className="opacity-30">|</span>
                            <span>+{khapPtsDisplay}</span>
                          </>
                        )}
                        {!isKhapWinner && khapPtsLoss > 0 && (
                          <>
                            <span className="opacity-30">|</span>
                            <span>-{khapPtsLoss}</span>
                          </>
                        )}
                      </button>

                      {/* Sanh button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTap();
                          toggleSanhPlayer(playerId);
                        }}
                        disabled={nhotVictimIds.includes(playerId)}
                        className={`flex w-full min-w-28 items-center justify-center gap-1 trasition-all duration-300 rounded-2xl border px-4 py-3 text-[12px] font-black disabled:opacity-40 shadow-lg ${
                          isSanhWinner
                            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-500 shadow-md"
                            : sanhTaken
                              ? "border-destructive/20 bg-destructive/10 text-destructive shadow-md"
                              : "border-border/30 bg-background/10 text-muted-foreground"
                        }`}
                      >
                        <Spade className="size-3 shrink-0" />
                        Sảnh
                        {isSanhWinner && sanhPtsDisplay > 0 && (
                          <>
                            <span className="opacity-30">|</span>
                            <span>+{sanhPtsDisplay}</span>
                          </>
                        )}
                        {!isSanhWinner && sanhPtsLoss > 0 && (
                          <>
                            <span className="opacity-30">|</span>
                            <span>-{sanhPtsLoss}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Hang 1: badge trang thai + ten + diem (tuong duong dong "Nam" trong mau) */}
                  <div className="flex flex-col items-center gap-0.5">
                    {isFixed ? (
                      <span
                        className={`flex size-5 items-center justify-center rounded-full text-white ${
                          playerId === nhotterId
                            ? "bg-amber-500"
                            : nhotVictimIds.includes(playerId)
                              ? "bg-destructive"
                              : denForIds.includes(playerId)
                                ? "bg-muted-foreground"
                                : "bg-white/20"
                        }`}
                      >
                        {playerId === nhotterId ? (
                          <Crown className="size-3" />
                        ) : nhotVictimIds.includes(playerId) ? (
                          <XCircle className="size-3" />
                        ) : denForIds.includes(playerId) ? (
                          <Minus className="size-3" />
                        ) : (
                          <span className="text-[10px] font-black">3</span>
                        )}
                      </span>
                    ) : (
                      isSelected && (
                        <span
                          className={cn(
                            "flex size-6 -mt-2 items-center justify-center rounded-full border border-card-foreground/30 text-[16px] font-black leading-normal",
                            order < 3
                              ? "bg-primary text-primary-foreground"
                              : "bg-[red]/70 text-primary-foreground",
                          )}
                        >
                          {order}
                        </span>
                      )
                    )}

                    <span
                      className={`truncate tracking-wider font-bold uppercase leading-tight text-base text-card-foreground ${showAsActive ? "mt-1" : "mt-6"}`}
                    >
                      {player.name}
                    </span>

                    {/* {label && (
                    <span
                      className="text-[9px] font-bold leading-none"
                      style={{ color: labelColor }}
                    >
                      {label}
                    </span>
                  )} */}

                    {showAsActive && (
                      <span
                        className={`tabular-nums text-xl font-black leading-none ${scoreColor(
                          score,
                        )}`}
                      >
                        {scoreFmt(score)}
                      </span>
                    )}

                    {!showAsActive && showBonus && (
                      <span className="size-1.5 rounded-full bg-chart-1" />
                    )}
                  </div>

                  {/* Hang 2: nut Khap + Sanh (tuong duong dong "Sanh Khap" trong mau) */}

                  {/* Hang 3: chip chat heo (chi hien khi co du lieu) */}
                  {/* {(chatHeoAsChatter.length > 0 || chatHeoAsVictim.length > 0) &&
                  showAsActive && (
                    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-0.5">
                      {chatHeoAsChatter.map((c) => {
                        const pts =
                          (c.heo.do ?? 0) * gameConfig.heoDoPoints +
                          (c.heo.den ?? 0) * gameConfig.heodenPoints;
                        return (
                          <div
                            key={c.id}
                            className="flex items-center gap-0.5 rounded border border-chart-2/30 bg-chart-2/15 px-1 py-0.5 text-[8px] text-chart-2"
                          >
                            <Scissors className="size-2 shrink-0" />
                            {(c.heo.do ?? 0) > 0 && (
                              <span className="rounded-full bg-red-500 px-1 font-black text-white">
                                {c.heo.do}
                              </span>
                            )}
                            {(c.heo.den ?? 0) > 0 && (
                              <span className="rounded-full bg-foreground px-1 font-black text-background">
                                {c.heo.den}
                              </span>
                            )}
                            <span className="font-black">+{pts}</span>
                          </div>
                        );
                      })}
                      {chatHeoAsVictim.map((c) => {
                        const pts =
                          (c.heo.do ?? 0) * gameConfig.heoDoPoints +
                          (c.heo.den ?? 0) * gameConfig.heodenPoints;
                        return (
                          <div
                            key={c.id}
                            className="flex items-center gap-0.5 rounded border border-destructive/20 bg-destructive/10 px-1 py-0.5 text-[8px] text-destructive"
                          >
                            <Scissors className="size-2 shrink-0" />
                            {(c.heo.do ?? 0) > 0 && (
                              <span className="rounded-full bg-red-500 px-1 font-black text-white">
                                {c.heo.do}
                              </span>
                            )}
                            {(c.heo.den ?? 0) > 0 && (
                              <span className="rounded-full bg-foreground px-1 font-black text-background">
                                {c.heo.den}
                              </span>
                            )}
                            <span className="font-black">-{pts}</span>
                          </div>
                        );
                      })}
                    </div>
                  )} */}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {khapWinner && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {khapWinner && khapCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-chart-4/30 bg-chart-4/10 px-4 py-2">
              <Flame className="size-5 text-chart-4" />
              <span className="text-base font-bold text-chart-4">
                Khạp x{khapCount * accumulated.khap}
              </span>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => updateKhapCount(-1)}
                  disabled={khapCount <= 1}
                  className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-6 text-center font-bold">{khapCount}</span>
                <button
                  onClick={() => updateKhapCount(1)}
                  disabled={khapCount >= gameConfig.maxKhapAccumulate}
                  className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background text-xs font-bold disabled:opacity-30"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
