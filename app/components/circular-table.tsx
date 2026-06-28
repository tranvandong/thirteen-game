import {
  ChevronDown,
  ChevronUp,
  Crown,
  Flame,
  Scissors,
  Spade,
} from "lucide-react";
import type { Player } from "~/stores/useSessionStore";

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

const SEAT_CONFIGS = [
  {
    wrapStyle: { left: "50%", top: "-8px", transform: "translateX(-50%)" },
    innerStyle: {} as React.CSSProperties,
    bonusStyle: {
      left: "50%",
      top: "100%",
      transform: "translateX(-50%)",
      marginTop: 4,
    } as React.CSSProperties,
  },
  {
    wrapStyle: {
      right: "-48px",
      top: "50%",
      transform: "translateY(-50%) rotate(90deg)",
    },
    innerStyle: { transform: "rotate(-90deg)" },
    bonusStyle: {
      right: "100%",
      top: "50%",
      transform: "translateY(-50%) rotate(-90deg)",
      marginRight: 8,
      width: 140,
    } as React.CSSProperties,
  },
  {
    wrapStyle: {
      left: "50%",
      bottom: "-8px",
      transform: "translateX(-50%) rotate(180deg)",
    },
    innerStyle: { transform: "rotate(180deg)" },
    bonusStyle: {
      left: "50%",
      bottom: "100%",
      transform: "translateX(-50%) rotate(180deg)",
      marginBottom: 4,
    } as React.CSSProperties,
  },
  {
    wrapStyle: {
      left: "-48px",
      top: "50%",
      transform: "translateY(-50%) rotate(-90deg)",
    },
    innerStyle: { transform: "rotate(90deg)" },
    bonusStyle: {
      left: "100%",
      top: "50%",
      transform: "translateY(-50%) rotate(90deg)",
      marginLeft: 8,
      width: 140,
    } as React.CSSProperties,
  },
];

const HEX_PATH = "M54.4939 74.9939L0 20.5L20.5 0L130.914 0L151.414 20.5L96.9203 74.9939L96.5668 74.6403C90.8065 68.8801 83.8533 66 75.7071 66C67.5609 66 60.6076 68.8801 54.8475 74.6403L54.4939 74.9939L54.4939 74.9939ZM75.7071 65C67.4519 65 60.3817 67.8607 54.4964 73.5822L1.41421 20.5L20.9142 1L130.5 1L150 20.5L96.9178 73.5822C91.0325 67.8607 83.9623 65 75.7071 65L75.7071 65Z";

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

export function CircularTable({
  players,
  ranking,
  selectOrder,
  toggleSelect,
  moveRank,
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
}: {
  players: Player[];
  ranking: string[];
  selectOrder: (number | null)[];
  toggleSelect: (playerId: string) => void;
  moveRank: (playerId: string, direction: "up" | "down") => void;
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
}) {
  return (
    <div className="relative mx-auto w-full max-w-[380px] px-2 py-6">
      <div className="relative mx-auto aspect-square w-[300px] sm:w-[320px]">
        {/* Center hub */}
        <div
          className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border border-border/60 bg-card shadow-sm"
          style={{ width: 108, height: 108 }}
        >
          {activeNhot ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Nhốt {nhotCount}
              </span>
              <span className="text-lg font-black tabular-nums text-primary">
                {selectCounter}/{requiredSelections}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Xếp hạng
              </span>
              <span className="text-lg font-black tabular-nums text-primary">
                {selectCounter}/{players.length}
              </span>
            </>
          )}
        </div>

        {players.map((player, idx) => {
          const playerId = player.id;
          const rankIndex = ranking.indexOf(playerId);
          const order = selectOrder[idx];
          const isSelectable = selectableIds.includes(playerId);
          const isSelected = order !== null;
          const config = SEAT_CONFIGS[idx] ?? SEAT_CONFIGS[0];
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

          const nextInRanking = ranking[rankIndex + 1];
          const nextIdx = nextInRanking
            ? players.findIndex((p) => p.id === nextInRanking)
            : -1;
          const canMoveDown =
            !isFixed &&
            isSelectable &&
            rankIndex < ranking.length - 1 &&
            nextIdx !== -1 &&
            selectableIds.includes(nextInRanking) &&
            selectOrder[nextIdx] !== null;
          const canMoveUp =
            !isFixed &&
            isSelectable &&
            rankIndex > 0 &&
            selectableIds.includes(ranking[rankIndex - 1]) &&
            selectOrder[
              players.findIndex((p) => p.id === ranking[rankIndex - 1])
            ] !== null;

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

          const fillColor = isSelected
            ? "#7F77DD"
            : isFixed
              ? playerId === nhotterId
                ? "#534AB7"
                : nhotVictimIds.includes(playerId)
                  ? "#C45C5C"
                  : "#A8A6A0"
              : isSelectable
                ? "#CECBF6"
                : "#D3D1C7";

          return (
            <div
              key={playerId}
              className="absolute z-20"
              style={config.wrapStyle as React.CSSProperties}
            >
              <div className="relative flex flex-col items-center">
                <button
                  type="button"
                  disabled={!isSelectable && !isFixed}
                  onClick={() =>
                    isSelectable && !isFixed && toggleSelect(playerId)
                  }
                  className={`relative transition-all ${
                    isSelectable && !isFixed
                      ? "cursor-pointer"
                      : isFixed
                        ? "cursor-default"
                        : "cursor-not-allowed opacity-40"
                  }`}
                >
                  <svg
                    viewBox="0 0 170 105"
                    style={{ width: 200, height: "auto", display: "block" }}
                  >
                    <path
                      d={HEX_PATH}
                      fill={fillColor}
                      stroke={isSelected || isFixed ? "#534AB7" : "#B8B5AD"}
                      strokeWidth={2}
                      strokeOpacity={0.5}
                    />
                  </svg>

                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2"
                    style={{ ...config.innerStyle, pointerEvents: "none" }}
                  >
                    {showAsActive && (
                      <span
                        className={`text-[10px] font-black uppercase leading-none ${labelColor}`}
                      >
                        {label}
                      </span>
                    )}

                    <span
                      className={`max-w-[72px] truncate text-xs font-bold leading-tight ${
                        isSelected || isFixed ? "text-white" : "text-[#534AB7]"
                      }`}
                    >
                      {player.name}
                    </span>

                    {isFixed ? (
                      <span
                        className={`flex size-5 items-center justify-center rounded-full text-[10px] font-black ${
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
                          "—"
                        ) : nhotVictimIds.includes(playerId) ? (
                          "✕"
                        ) : (
                          "3"
                        )}
                      </span>
                    ) : (
                      <span
                        className={`flex size-5 items-center justify-center rounded-full text-[10px] font-black ${
                          isSelected
                            ? "bg-white text-[#534AB7]"
                            : "border border-[#534AB7]/30 bg-white/80 text-[#534AB7]"
                        }`}
                      >
                        {isSelected ? order : "·"}
                      </span>
                    )}

                    {showAsActive && (
                      <span
                        className={`text-xs font-black tabular-nums leading-none ${
                          isSelected || isFixed ? "text-white" : scoreColor(score)
                        }`}
                      >
                        {scoreFmt(score)}
                      </span>
                    )}
                  </div>
                </button>

                {isSelected && !isFixed && (
                  <div
                    className="absolute -right-1 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-0.5"
                    style={{ ...config.innerStyle }}
                  >
                    <button
                      type="button"
                      onClick={() => moveRank(playerId, "up")}
                      disabled={!canMoveUp}
                      className="flex size-5 items-center justify-center rounded-full bg-background/90 font-black shadow-sm hover:bg-background disabled:opacity-20"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRank(playerId, "down")}
                      disabled={!canMoveDown}
                      className="flex size-5 items-center justify-center rounded-full bg-background/90 font-black shadow-sm hover:bg-background disabled:opacity-20"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>
                )}

                {showBonus && (
                  <div
                    className="absolute z-30 flex min-w-[120px] max-w-[148px] flex-col gap-1"
                    style={config.bonusStyle}
                  >
                    <div
                      className={`flex flex-wrap items-center gap-0.5 rounded-xl border px-1.5 py-1 text-[10px] ${
                        isKhapWinner
                          ? "border-chart-4/40 bg-chart-4/10 text-chart-4"
                          : khapTaken
                            ? "border-destructive/20 bg-destructive/5 text-destructive"
                            : "border-border/70 bg-background/95 text-muted-foreground shadow-sm"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleKhapPlayer(playerId)}
                        disabled={nhotVictimIds.includes(playerId)}
                        className="flex items-center gap-0.5 font-black disabled:opacity-40"
                      >
                        <Flame className="size-3" />
                        Khạp
                      </button>
                      {isKhapWinner && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateKhapCount(-1)}
                            disabled={khapCount <= 1}
                            className="size-4 rounded-full bg-background font-black disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-3 text-center font-black">
                            {khapCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateKhapCount(1)}
                            disabled={
                              khapCount >= gameConfig.maxKhapAccumulate
                            }
                            className="size-4 rounded-full bg-background font-black disabled:opacity-30"
                          >
                            +
                          </button>
                          <span className="font-black">+{khapPtsDisplay}</span>
                        </>
                      )}
                      {!isKhapWinner && khapPtsLoss > 0 && (
                        <span className="font-black">-{khapPtsLoss}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSanhPlayer(playerId)}
                      disabled={nhotVictimIds.includes(playerId)}
                      className={`flex flex-wrap items-center gap-0.5 rounded-xl border px-1.5 py-1 text-[10px] font-black disabled:opacity-40 ${
                        isSanhWinner
                          ? "border-chart-1/40 bg-chart-1/10 text-chart-1"
                          : sanhTaken
                            ? "border-destructive/20 bg-destructive/5 text-destructive"
                            : "border-border/70 bg-background/95 text-muted-foreground shadow-sm"
                      }`}
                    >
                      <Spade className="size-3" />
                      Sảnh
                      {isSanhWinner && (
                        <>
                          <span>{effectiveSanh}</span>
                          <span>+{sanhPtsDisplay}</span>
                        </>
                      )}
                      {!isSanhWinner && sanhPtsLoss > 0 && (
                        <span>-{sanhPtsLoss}</span>
                      )}
                    </button>

                    {(chatHeoAsChatter.length > 0 ||
                      chatHeoAsVictim.length > 0) && (
                      <div className="flex flex-col gap-0.5">
                        {chatHeoAsChatter.map((c) => {
                          const pts =
                            (c.heo.do ?? 0) * gameConfig.heoDoPoints +
                            (c.heo.den ?? 0) * gameConfig.heodenPoints;
                          return (
                            <div
                              key={c.id}
                              className="flex flex-wrap items-center gap-0.5 rounded-xl border border-chart-2/30 bg-chart-2/10 px-1.5 py-0.5 text-[10px] text-chart-2"
                            >
                              <Scissors className="size-2.5 shrink-0" />
                              {(c.heo.do ?? 0) > 0 && (
                                <span className="rounded bg-red-500 px-1 font-black text-white">
                                  {c.heo.do}Đ
                                </span>
                              )}
                              {(c.heo.den ?? 0) > 0 && (
                                <span className="rounded bg-foreground px-1 font-black text-background">
                                  {c.heo.den}Đ
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
                              className="flex flex-wrap items-center gap-0.5 rounded-xl border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive"
                            >
                              <Scissors className="size-2.5 shrink-0" />
                              {(c.heo.do ?? 0) > 0 && (
                                <span className="rounded bg-red-500 px-1 font-black text-white">
                                  {c.heo.do}Đ
                                </span>
                              )}
                              {(c.heo.den ?? 0) > 0 && (
                                <span className="rounded bg-foreground px-1 font-black text-background">
                                  {c.heo.den}Đ
                                </span>
                              )}
                              <span className="font-black">-{pts}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
