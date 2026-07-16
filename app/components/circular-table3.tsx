import { Crown, Flame, Scissors, Spade, Swords } from "lucide-react";
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
      width: SIZE,
      height: BORDER,
      right: -OFFSET,
      bottom: OFFSET,
      transform: "rotate(90deg)",
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
      width: SIZE,
      height: BORDER,
      left: -OFFSET,
      bottom: OFFSET,
      transform: "rotate(270deg)",
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

  const getBackgroundImage = (score: number, active: boolean) => {
    if (!active) return undefined;

    if (score <= -10) {
      return "radial-gradient(rgba(255, 0, 0, 0.9), rgba(255,255,255,0))";
    }

    if (score >= 10) {
      return "radial-gradient(rgb(0 255 0 / 0.7), rgba(255,255,255,0))";
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
    <div className="relative z-10 mx-auto w-full">
      <div className="relative mx-auto w-full aspect-square">
        {/* Center hub */}

        <Button
          className={cn(
            "absolute pointer-events-auto left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border border-border/60 shadow-xl shadow-primary/20",
            !disabledSaveButton && "animate-holy-glow",
          )}
          style={{ width: 80, height: 80 }}
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
        <div
          className="absolute pointer-events-none left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-card"
          style={{ width: 78, height: 78 }}
        ></div>
        <div className="absolute inset-0 w-full h-full flex items-center justify-center z-0">
          <Swords className="size-full text-primary/3" />
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
          const effectiveSanh = isSanhWinner ? accumulated.sanh : 0;
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

          const chatHeoAsChatter = chatHeoList.filter(
            (c) =>
              c.chatterId === playerId && !nhotVictimIds.includes(c.victimId),
          );
          const chatHeoAsVictim = chatHeoList.filter(
            (c) =>
              c.victimId === playerId && !nhotVictimIds.includes(c.victimId),
          );
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
                  "pointer-events-auto absolute inset-0 border-solid border-transparent transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
                  isSelectable
                    ? "cursor-pointer bg-gray-300/10"
                    : "cursor-default bg-transparent",
                  // score > 20 && isSelected ? "border border-chart-1/20 bg-chart-1/10" : "",
                )}
                style={{
                  borderWidth: BORDER,
                  borderRadius: RADIUS,
                  clipPath: section.clipPath,
                  ...(section.side === "Top" && { borderBottomWidth: 0 }),
                  ...(section.side === "Bottom" && { borderTopWidth: 0 }),
                  ...(section.side === "Right" && { borderLeftWidth: 0 }),
                  ...(section.side === "Left" && { borderRightWidth: 0 }),
                  ...(showAsActive ? { border: "4px solid #02bc7d" } : {}),
                  backgroundImage: getBackgroundImage(score, showAsActive),
                }}
              />

              {/* Noi dung cua nguoi choi, tach rieng khoi vung click, dinh vi & xoay
                  dung nhu .top-content/.right-content/.bottom-content/.left-content
                  trong file mau, de chu luon doc dung chieu tu huong ngoi cua nguoi do. */}
              <div
                className="pointer-events-none absolute z-10 flex flex-col items-center py-3 gap-1 px-2 text-center"
                style={section.contentStyle}
              >
                {showAsActive && (
                  <div className="pointer-events-auto flex items-center gap-2">
                    {/* Khap button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTap();
                        toggleKhapPlayer(playerId);
                      }}
                      disabled={nhotVictimIds.includes(playerId)}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] font-black disabled:opacity-40 ${
                        isKhapWinner
                          ? "border-chart-4/50 bg-chart-4/20 text-chart-4"
                          : khapTaken
                            ? "border-destructive/20 bg-destructive/10 text-destructive"
                            : "border-border/70 bg-background/90 text-muted-foreground"
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

                    {/* Khap count +/- (only when winner) */}
                    {isKhapWinner && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateKhapCount(-1);
                          }}
                          disabled={khapCount <= 1}
                          className="flex size-5 items-center justify-center rounded-full bg-background/90 px-1 text-[12px] font-black shadow-sm disabled:opacity-30"
                        >
                          -
                        </button>
                        <span className="min-w-[14px] text-center text-[12px] font-black text-foreground">
                          {khapCount}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateKhapCount(1);
                          }}
                          disabled={khapCount >= gameConfig.maxKhapAccumulate}
                          className="flex size-5 items-center justify-center rounded-full bg-background/90 px-1 text-[12px] font-black shadow-sm disabled:opacity-30"
                        >
                          +
                        </button>
                      </>
                    )}

                    {/* Sanh button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTap();
                        toggleSanhPlayer(playerId);
                      }}
                      disabled={nhotVictimIds.includes(playerId)}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] font-black disabled:opacity-40 ${
                        isSanhWinner
                          ? "border-chart-1/50 bg-chart-1/20 text-chart-1"
                          : sanhTaken
                            ? "border-destructive/20 bg-destructive/10 text-destructive"
                            : "border-border/70 bg-background/90 text-muted-foreground"
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
                <div className="flex flex-col items-center gap-1">
                  {isFixed ? (
                    <span
                      className={`flex size-4 items-center justify-center rounded-full text-[10px] font-black ${
                        playerId === nhotterId
                          ? "bg-white/20 text-white"
                          : nhotVictimIds.includes(playerId)
                            ? "bg-white/20 text-white"
                            : "bg-white/20 text-white"
                      }`}
                    >
                      {playerId === nhotterId ? (
                        <Crown className="size-3" />
                      ) : denForIds.includes(playerId) ? (
                        "-"
                      ) : nhotVictimIds.includes(playerId) ? (
                        "x"
                      ) : (
                        "3"
                      )}
                    </span>
                  ) : (
                    isSelected && (
                      <span className="flex size-6 items-center justify-center rounded-full border border-card-foreground/30 text-[14px] font-black bg-primary text-primary-foreground">
                        {order}
                      </span>
                    )
                  )}

                  <span
                    className={`truncate font-bold uppercase leading-tight text-card-foreground ${showAsActive ? "text-base" : "mt-8 text-xl"}`}
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
                      className={`tabular-nums leading-none font-bold text-xl text-shadow-sm ${scoreColor(
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
  );
}
