import type { Player } from "~/stores/useSessionStore";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * Bàn hình thoi (diamond) hiển thị 4 người chơi tại 4 đỉnh tương ứng với
 * vị trí chỗ ngồi: Trên / Phải / Dưới / Trái (theo orderNo: 1/2/3/4).
 *
 * Thứ tự ghế được lấy từ `orderNo` của mỗi player (đã được sắp xếp bởi
 * `player-positions` trong localStorage đối với người chơi thường, hoặc bởi
 * DB đối với chủ phòng). Component này là visualization (read-only); việc
 * thay đổi vị trí nằm ở trang Cấu hình.
 *
 * Khi truyền `onMoveSeat`, mỗi ghế hiển thị 2 nút mũi tên ở viền ngoài:
 * - Ghế Trên / Dưới (nằm ngang): nút ChevronRight (viền phải) & ChevronLeft
 *   (viền trái) → đổi chỗ với ghế Phải / Trái tương ứng.
 * - Ghế Phải / Trái (nằm dọc): nút ChevronUp (viền trên) & ChevronDown
 *   (viền dưới) → đổi chỗ với ghế Trên / Dưới tương ứng.
 */

const SEAT_LABELS = ["Trên", "Phải", "Dưới", "Trái"];

const SEAT_POSITION_CLASS = [
  "top-0 left-1/2 -translate-x-1/2", // Trên  (top-center)
  "right-0 top-1/2 -translate-y-1/2", // Phải (right-center)
  "bottom-0 left-1/2 -translate-x-1/2", // Dưới (bottom-center)
  "left-0 top-1/2 -translate-y-1/2", // Trái  (left-center)
];

type MoveDirection = "up" | "down" | "left" | "right";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function DiamondTable({
  players,
  scoreById,
  myPlayerId,
  showScore = false,
  onMoveSeat,
  className = "",
}: {
  /** Player đã được sắp xếp theo orderNo (1..4) */
  players: Player[];
  /** playerId -> tổng điểm (tuỳ chọn, dùng khi showScore=true) */
  scoreById?: Record<string, number>;
  /** playerId của người dùng hiện tại (để đánh dấu "Bạn") */
  myPlayerId?: string | null;
  showScore?: boolean;
  /** Truyền vào để bật nút đổi vị trí trên mỗi ghế */
  onMoveSeat?: (playerId: string, direction: MoveDirection) => void;
  className?: string;
}) {
  const ordered = [...players].sort((a, b) => a.orderNo - b.orderNo);
  const interactive = !!onMoveSeat;

  return (
    <div
      className={`relative mx-auto aspect-square w-full max-w-sm ${className}`}
    >
      {/* Hub giữa */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-border/60 bg-card/80 text-muted-foreground shadow-inner sm:size-16">
          <span className="text-xl font-black sm:text-2xl">♠</span>
        </div>
      </div>

      {ordered.map((p) => {
        const seatIndex =
          (p.orderNo - 1 + SEAT_LABELS.length) % SEAT_LABELS.length;
        const isMe = myPlayerId === p.id;
        const score = scoreById?.[p.id];
        const seatClass = SEAT_POSITION_CLASS[seatIndex];
        const seatLabel = SEAT_LABELS[seatIndex];
        // Ghế dọc (Phải/Trái) dùng nút lên/xuống; ghế ngang (Trên/Dưới) dùng nút trái/phải
        const isVerticalSeat = seatIndex === 1 || seatIndex === 3;

        return (
          <div
            key={p.id}
            className={`absolute ${seatClass} z-10 w-24 sm:w-28`}
          >
            {/* Nút đổi vị trí cho ghế ngang (Trên/Dưới) */}
            {interactive && !isVerticalSeat && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSeat?.(p.id, "right");
                  }}
                  title="Chuyển sang phải"
                  className="absolute right-0 top-1/2 z-20 flex size-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSeat?.(p.id, "left");
                  }}
                  title="Chuyển sang trái"
                  className="absolute left-0 top-1/2 z-20 flex size-6 -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
              </>
            )}

            {/* Nút đổi vị trí cho ghế dọc (Phải/Trái) */}
            {interactive && isVerticalSeat && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSeat?.(p.id, "up");
                  }}
                  title="Chuyển lên trên"
                  className="absolute left-1/2 top-0 z-20 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSeat?.(p.id, "down");
                  }}
                  title="Chuyển xuống dưới"
                  className="absolute bottom-0 left-1/2 z-20 flex size-6 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </>
            )}

            <div
              className={[
                "flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-center shadow-sm transition-colors",
                isMe
                  ? "border-primary bg-primary/10"
                  : "border-border/70 bg-card/90",
              ].join(" ")}
            >
             
              <div
                className={[
                  "flex size-9 items-center justify-center rounded-full text-sm font-black",
                  isMe
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                ].join(" ")}
              >
                {initials(p.name)}
              </div>
              <span className="w-full truncate text-xs font-semibold leading-tight">
                {p.name}
              </span>
              {showScore && score !== undefined && (
                <span
                  className={[
                    "text-sm font-black tabular-nums",
                    score > 0
                      ? "text-chart-2"
                      : score < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                  ].join(" ")}
                >
                  {score > 0 ? `+${score}` : score}
                </span>
              )}
              {isMe && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                  Bạn
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
