import { Scissors } from "lucide-react";
import type { HeoType } from "~/types/match.type";

export default function BageHeo({
  count,
  score,
  type,
}: {
  count: number;
  score: number;
  type: HeoType;
}) {
  const pts = count * score;
  return count > 0 ? (
    <div className="flex items-center gap-0.5 rounded border border-chart-2/30 bg-chart-2/15 px-1 py-0.5 text-[8px] text-chart-2">
      <Scissors className="size-2 shrink-0" />
      {type === "do" && (
        <span className="rounded-full bg-red-500 px-1 font-black text-white">
          {count}
        </span>
      )}
      {type === "den" && (
        <span className="rounded-full bg-foreground px-1 font-black text-background">
          {count}
        </span>
      )}
      <span className="font-black">+{pts}</span>
    </div>
  ) : (
    <div className="flex items-center gap-0.5 rounded border border-destructive/20 bg-destructive/10 px-1 py-0.5 text-[8px] text-destructive">
      <Scissors className="size-2 shrink-0" />
      {type === "do" && (
        <span className="rounded-full bg-red-500 px-1 font-black text-white">
          {count}
        </span>
      )}
      {type === "den" && (
        <span className="rounded-full bg-foreground px-1 font-black text-background">
          {count}
        </span>
      )}
      <span className="font-black">-{pts}</span>
    </div>
  );
}
