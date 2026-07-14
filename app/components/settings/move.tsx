import { ChevronDown, ChevronUp } from "lucide-react";
import { useSessionStore, type Player } from "~/stores/useSessionStore";

export function Move({
  move,
  player,
}: {
  move: (players: Player[]) => void;
  player: Player;
}) {
  const { players } = useSessionStore();
  const moveRank = (player: Player, direction: "up" | "down") => {
    const playerClone = [...players];

    const currentIndex = playerClone.findIndex((p) => p.id === player.id);
    if (currentIndex === -1) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    // Kiểm tra vượt giới hạn
    if (targetIndex < 0 || targetIndex >= playerClone.length) return;

    // Hoán đổi vị trí trong mảng
    [playerClone[currentIndex], playerClone[targetIndex]] = [
      playerClone[targetIndex],
      playerClone[currentIndex],
    ];

    // Cập nhật lại orderNo
    playerClone.forEach((item, index) => {
      item.orderNo = index + 1;
    });

    move(playerClone);
  };
  const canMoveUp = player.orderNo > 1;
  const canMoveDown = player.orderNo < players.length;
  return (
    <div
      className="relative z-10 ml-1 flex shrink-0 flex-col gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => moveRank(player, "up")}
        disabled={!canMoveUp}
        className="relative z-10 flex size-6 items-center justify-center rounded-full bg-muted/70 font-black hover:bg-background disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        onClick={() => moveRank(player, "down")}
        disabled={!canMoveDown}
        className="relative z-10 flex size-6 items-center justify-center rounded-full bg-muted/70 font-black hover:bg-background disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  );
}
