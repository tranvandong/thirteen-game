import type { Player } from "~/stores/useSessionStore";

const SEAT_CONFIGS = [
  {
    wrapStyle: { left: "50%", top: 0, transform: "translateX(-50%)" },
    innerStyle: {} as React.CSSProperties,
  },
  {
    wrapStyle: {
      right: "-42px",
      top: "50%",
      transform: "translateY(-50%) rotate(90deg)",
    },
    innerStyle: { transform: "rotate(-90deg)" },
  },
  {
    wrapStyle: {
      left: "50%",
      bottom: 0,
      transform: "translateX(-50%) rotate(180deg)",
    },
    innerStyle: { transform: "rotate(180deg)" },
  },
  {
    wrapStyle: {
      left: "-42px",
      top: "50%",
      transform: "translateY(-50%) rotate(-90deg)",
    },
    innerStyle: { transform: "rotate(90deg)" },
  },
];

const HEX_PATH = "M150 0L170 20L110 80L84 105L0 20L20 0L150 0Z";

export function CircularTable({
  players,
  selectOrder,
  toggleSelect,
  moveRank,
  selectableIds,
}: {
  players: Player[];
  selectOrder: (number | null)[];
  toggleSelect: (playerId: string) => void;
  moveRank: (playerId: string, direction: "up" | "down") => void;
  selectableIds: string[];
}) {
  const getRowMeta = (playerId: string, rankIndex: number) => {
    const rankLabels = ["Nhất", "Nhì", "Ba", "Tư"];
    const rankColors = [
      "text-chart-4",
      "text-chart-2",
      "text-muted-foreground",
      "text-destructive",
    ];
    const rankStyles = [
      "border-chart-4/40 bg-chart-4/10",
      "border-chart-2/30 bg-chart-2/5",
      "border-muted bg-muted/30",
      "border-destructive/30 bg-destructive/5",
    ];
    return {
      label: rankLabels[rankIndex],
      labelColor: rankColors[rankIndex],
      style: rankStyles[rankIndex],
      isFixed: false,
    };
  };

  return (
    <div className="relative mx-auto w-[320px] aspect-square">
      {/* Center */}
      <div
        className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card"
        style={{ width: 120, height: 120 }}
      >
        {/* <span className="text-xs font-bold text-foreground">Vòng</span> */}
      </div>

      {players.map((player, idx) => {
        const order = selectOrder[idx];
        const isSelectable = selectableIds.includes(player.id);
        const isSelected = order !== null;
        const config = SEAT_CONFIGS[idx] ?? SEAT_CONFIGS[0];

        const { label, labelColor, style, isFixed } = getRowMeta(
          player.id,
          order ?? 0,
        );

        const fillColor = isSelected
          ? "#7F77DD"
          : isSelectable
            ? "#CECBF6"
            : "#D3D1C7";

        const nameColor = isSelected
          ? "#fff"
          : isSelectable
            ? "#534AB7"
            : "#888780";

        const badgeColor = isSelected
          ? "#fff"
          : isSelectable
            ? "#3C3489"
            : "#888780";

        return (
          <button
            key={player.id}
            disabled={!isSelectable}
            className={`absolute transition-colors ${
              isSelected
                ? "text-primary"
                : isSelectable
                  ? "text-muted hover:text-primary/60"
                  : "text-muted-foreground/30 cursor-not-allowed opacity-40"
            } ${isSelectable ? "cursor-pointer" : ""}`}
            style={config.wrapStyle as React.CSSProperties}
          >
            <svg
              viewBox="0 0 170 105"
              style={{
                width: 240,
                height: "auto",
                display: "block",
                pointerEvents: "none",
              }}
            >
              <path
                d={HEX_PATH}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={3}
                strokeOpacity={0.3}
                style={{
                  pointerEvents: isSelectable ? "all" : "none",
                  cursor: isSelectable ? "pointer" : "not-allowed",
                }}
                onClick={() => isSelectable && toggleSelect(player.id)}
              />
            </svg>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
              style={{ ...config.innerStyle, pointerEvents: "none" }}
            >
              <span className="text-card-foreground font-bold leading-none">
                {player.name}
              </span>
              <span
                className={`flex shrink-0 items-center justify-center size-4 p-4 rounded-full font-black transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "border border-muted-foreground/20 bg-muted text-muted-foreground"
                } ${labelColor}`}
              >
                {isSelected ? order : "·"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
