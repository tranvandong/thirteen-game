import { Crown, Flame, Scissors, Spade } from "lucide-react";
import type { Player } from "~/stores/useSessionStore";
import { Button } from "./ui/button";

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

// Each seat is a corner piece of a square, rotated to sit on each edge.
// wrapStyle positions the SVG element; innerRotation counter-rotates the content
// so text/buttons read correctly from the outside edge perspective.
const SEAT_CONFIGS = [
  {
    // Top seat: sits centered on top edge, "reads" downward (outer edge = top)
    wrapStyle: { left: "50%", top: "0px", transform: "translateX(-50%)" },
    innerRotation: "0deg",
  },
  {
    // Right seat: SVG rotated 90deg CW, content counter-rotated -90deg
    wrapStyle: {
      right: "-58px",
      top: "50%",
      transform: "translateY(-50%) rotate(90deg)",
    },
    innerRotation: "270deg",
  },
  {
    // Bottom seat: SVG rotated 180deg, content counter-rotated 180deg
    wrapStyle: {
      left: "50%",
      bottom: "0px",
      transform: "translateX(-50%) rotate(180deg)",
    },
    innerRotation: "180deg",
  },
  {
    // Left seat: SVG rotated -90deg, content counter-rotated 90deg
    wrapStyle: {
      left: "-58px",
      top: "50%",
      transform: "translateY(-50%) rotate(-90deg)",
    },
    innerRotation: "-270deg",
  },
];

const HEX_PATH =
  "M54.4939 74.9939L0 20.5L20.5 0L130.914 0L151.414 20.5L96.9203 74.9939L96.5668 74.6403C90.8065 68.8801 83.8533 66 75.7071 66C67.5609 66 60.6076 68.8801 54.8475 74.6403L54.4939 74.9939L54.4939 74.9939ZM75.7071 65C67.4519 65 60.3817 67.8607 54.4964 73.5822L1.41421 20.5L20.9142 1L130.5 1L150 20.5L96.9178 73.5822C91.0325 67.8607 83.9623 65 75.7071 65L75.7071 65Z";

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
  return (
    <div className="relative mx-auto w-full py-6">
      <div className="relative mx-auto aspect-square w-[320px]">
        {/* Center hub */}
        <Button
          className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border border-border/60 shadow-xl shadow-primary/20"
          style={{ width: 110, height: 110 }}
          onClick={() => {
            save();
          }}
          disabled={disabledSaveButton}
        >
          {activeNhot ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wide">
               Xác nhận
              </span>
               <span className="text-[9px] uppercase tracking-wide">
               Nhốt {nhotCount}
              </span>
              <span className="text-lg font-black tabular-nums">
                {selectCounter}/{requiredSelections}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wide">
                Xác nhận
              </span>
              <span className="text-lg font-black tabular-nums">
                {selectCounter}/{players.length}
              </span>
            </>
          )}
        </Button>

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

          // The foreignObject covers the main area of the trapezoid path.
          // viewBox is 0 0 170 105; path occupies x=[0,151], y=[0,75].
          // We place content in the upper-middle zone to avoid the curved edges.
          // innerRotation counter-rotates content so it reads from the outer edge.
          const foContentStyle: React.CSSProperties = {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            transform: `rotate(${config.innerRotation})`,
            transformOrigin: "center center",
          };

          return (
            <div
              key={playerId}
              className="absolute z-20"
              style={config.wrapStyle as React.CSSProperties}
              onClick={() => {
                isSelectable && !isFixed && toggleSelect(playerId);
              }}
            >
              <svg
                viewBox="-1 -1 153 77"
                style={{ width: 229, height: 115, display: "block" }}
              >
                {/* Background shape */}
                <path
                  d={HEX_PATH}
                  fill={"transparent"}
                  stroke={isSelected || isFixed ? "#FE7F2D" : "#B8B5AD"}
                  strokeWidth={isSelected || isFixed ? 0.7 : 0.1}
                  strokeOpacity={isSelected || isFixed ? 1 : 0.3}
                  style={{ pointerEvents: "all", width: 229, height: 115 }}
                  className={`${labelColor} border-2 border-solid border-current`}
                />

                <foreignObject
                  x={0}
                  y={0}
                  width={60}
                  height={20}
                  style={{ pointerEvents: "all", transform: "translate(46px, 48px)" }}
                >
                  <div style={foContentStyle}>
                    <span
                      className={`truncate text-xs font-bold leading-tight text-card-foreground`}
                      style={{ transform: `rotate(${config.innerRotation})` }}
                    >
                      {player.name}
                    </span>
                  </div>
                </foreignObject>

                {/* Main player info - name, label, score/badge */}
                <foreignObject
                  x={52}
                  y={26}
                  width={52}
                  height={26}
                  style={{ pointerEvents: "all" }}
                >
                  <div style={foContentStyle}>
                    <div
                      className="flex items-center gap-1"
                      style={{ transform: `rotate(${config.innerRotation})` }}
                    >
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
                            "—"
                          ) : nhotVictimIds.includes(playerId) ? (
                            "✕"
                          ) : (
                            "3"
                          )}
                        </span>
                      ) : (
                        isSelected && (
                          <span
                            className={`flex size-5 items-center justify-center rounded-full text-[12px] font-black text-card-foreground border border-card-foreground/30`}
                          >
                            {order}
                          </span>
                        )
                      )}

                      {showAsActive && (
                        <span
                          className={`text-xs tabular-nums leading-none ${scoreColor(
                            score,
                          )}`}
                        >
                          {scoreFmt(score)}
                        </span>
                      )}
                    </div>
                  </div>
                </foreignObject>

                {/* Chat heo info row - bottom strip inside path */}
                {(chatHeoAsChatter.length > 0 ||
                  chatHeoAsVictim.length > 0) && (
                  <foreignObject
                    x={5}
                    y={4}
                    width={110}
                    height={18}
                    style={{
                      pointerEvents: "none",
                      transform: "rotate(45deg)",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 3,

                        transformOrigin: "center center",
                        pointerEvents: "none",
                      }}
                    >
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
                  </foreignObject>
                )}

                {/* Transparent hit layer — above display content, below interactive buttons */}
                <path
                  d={HEX_PATH}
                  fill="transparent"
                  style={{
                    pointerEvents: "all",
                    cursor:
                      isSelectable && !isFixed
                        ? "pointer"
                        : isFixed
                          ? "default"
                          : "not-allowed",
                  }}
                />

                {/* Khap + Sanh buttons — rendered last so they stay clickable */}
                {showBonus && (
                  <foreignObject
                    x={0}
                    y={0}
                    width={150}
                    height={30}
                    style={{ pointerEvents: "none" }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        transform: `rotate(${config.innerRotation}deg)`,
                        transformOrigin: "center center",
                        pointerEvents: "none",
                      }}
                    >
                      {/* Khap button */}
                      <button
                        type="button"
                        style={{ pointerEvents: "auto" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleKhapPlayer(playerId);
                        }}
                        disabled={nhotVictimIds.includes(playerId)}
                        className={`flex items-center gap-0.5 rounded-lg border px-1 py-0.5 text-[9px] font-black disabled:opacity-40 ${
                          isKhapWinner
                            ? "border-chart-4/50 bg-chart-4/20 text-chart-4"
                            : khapTaken
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-border/70 bg-background/90 text-muted-foreground"
                        }`}
                      >
                        <Flame className="size-2.5 shrink-0" />
                        Khạp
                        {isKhapWinner && khapPtsDisplay > 0 && (
                          <span>+{khapPtsDisplay}</span>
                        )}
                        {!isKhapWinner && khapPtsLoss > 0 && (
                          <span>-{khapPtsLoss}</span>
                        )}
                      </button>

                      {/* Khap count +/- (only when winner) */}
                      {isKhapWinner && (
                        <>
                          <button
                            type="button"
                            style={{ pointerEvents: "auto" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateKhapCount(-1);
                            }}
                            disabled={khapCount <= 1}
                            className="flex size-3 items-center justify-center px-1 rounded-full bg-background/90 text-[10px] font-black shadow-sm disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="min-w-[12px] text-center text-[10px] font-black text-foreground">
                            {khapCount}
                          </span>
                          <button
                            type="button"
                            style={{ pointerEvents: "auto" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateKhapCount(1);
                            }}
                            disabled={khapCount >= gameConfig.maxKhapAccumulate}
                            className="flex size-3 items-center px-1 justify-center rounded-full bg-background/90 text-[10px] font-black shadow-sm disabled:opacity-30"
                          >
                            +
                          </button>
                        </>
                      )}

                      {/* Sanh button */}
                      <button
                        type="button"
                        style={{ pointerEvents: "auto" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSanhPlayer(playerId);
                        }}
                        disabled={nhotVictimIds.includes(playerId)}
                        className={`flex items-center gap-0.5 rounded-lg border px-1 py-0.5 text-[9px] font-black disabled:opacity-40 ${
                          isSanhWinner
                            ? "border-chart-1/50 bg-chart-1/20 text-chart-1"
                            : sanhTaken
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-border/70 bg-background/90 text-muted-foreground"
                        }`}
                      >
                        <Spade className="size-2.5 shrink-0" />
                        Sảnh
                        {isSanhWinner && sanhPtsDisplay > 0 && (
                          <span>+{sanhPtsDisplay}</span>
                        )}
                        {!isSanhWinner && sanhPtsLoss > 0 && (
                          <span>-{sanhPtsLoss}</span>
                        )}
                      </button>
                    </div>
                  </foreignObject>
                )}
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
