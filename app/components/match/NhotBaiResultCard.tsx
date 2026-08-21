import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Crown, Lock, X } from "lucide-react";
import type { Player } from "~/stores/useSessionStore";
import type { GameConfigs, NhotBai } from "~/types/match.type";

export interface NhotBaiResultCardProps {
  nhotList: NhotBai[];
  confirmNhot: boolean;
  gameConfig: GameConfigs;
  players: Player[];
  pShort: (id: string) => string;
  nhotterId: string | null;
  nhotVictimIds: string[];
  nhotOthers: string[];
  denBaiLosses: Record<string, number>;
  nhotCount: number;
  onClose: () => void;
  onReset: () => void;
}

/**
 * Hiển thị kết quả của lượt "Nhốt bài" đã chốt (khối tóm tắt điểm
 * nhận/mất, đền bài, nút "Chọn lại"). Tách ra từ match.tsx.
 */
export function NhotBaiResultCard({
  nhotList,
  confirmNhot,
  gameConfig,
  players,
  pShort,
  nhotterId,
  nhotVictimIds,
  nhotOthers,
  denBaiLosses,
  nhotCount,
  onClose,
  onReset,
}: NhotBaiResultCardProps) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <button className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-chart-3/10 text-chart-3">
            <Lock className="size-5" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Nhốt Bài</p>
            <p className="text-xs text-muted-foreground">
              Thiết lập người nhốt, bị nhốt và đền bài
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
          type="submit"
        >
          <X className="size-5" />
        </Button>
      </button>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {confirmNhot &&
          nhotList.length > 0 &&
          nhotList.map((n) => {
            const nv = n.victims.length;
            const ecPts =
              Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
            const heoPtsOf = (heo: { do: number; den: number }) =>
              heo.den * gameConfig.heodenPoints +
              heo.do * gameConfig.heoDoPoints;
            const denForIds = n.denForIds ?? [];
            const dennerLoss = denForIds.reduce(
              (sum, victimId) => sum + (denBaiLosses[victimId] ?? 0),
              0,
            );
            let gain = 0;

            if (nv === 1) {
              gain =
                gameConfig.rankPoints[0] * 2 +
                heoPtsOf(n.victims[0]?.heo ?? { do: 0, den: 0 });
            } else {
              if (n.dennerId && denForIds.length > 0) {
                const ecPts =
                  Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
                const heoPtsOf = (heo: { do: number; den: number }) =>
                  heo.den * gameConfig.heodenPoints +
                  heo.do * gameConfig.heoDoPoints;
                const denForIds = n.denForIds ?? [];
                const victimLosses = n.victims.map((v) => {
                  return nv === 1
                    ? gameConfig.rankPoints[0] * 2 +
                        heoPtsOf(v.heo ?? { do: 0, den: 0 })
                    : ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });
                });
                gain = victimLosses.reduce((sum, loss) => sum + loss, 0);
              } else {
                n.victims.forEach((v) => {
                  gain += ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });
                });
              }
              if (nv === 2) gain += gameConfig.nhotBystanderPenalty;
            }

            const caseLabel =
              nv === 1 ? "Nhốt 1" : nv === 2 ? "Nhốt 2" : "Nhốt 3";
            const caseColor = nv === 3 ? "bg-primary" : "bg-chart-3";
            return (
              <div
                key={n.id}
                className="flex flex-col gap-3 rounded-3xl border border-chart-3/20 bg-chart-3/10 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black text-background ${caseColor}`}
                    >
                      {caseLabel}
                    </span>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Người nhốt
                    </p>
                    <div className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-background px-3 py-2 font-black text-primary">
                      <Crown className="size-3.5" />
                      {pShort(n.nhotterId)}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Điểm nhận
                    </p>
                    <p className="mt-1 text-2xl font-black text-chart-2">
                      +{gain}
                    </p>
                  </div>
                </div>

                {n.dennerId && denForIds.length > 0 && (
                  <div className="rounded-2xl border border-destructive/15 bg-destructive/5 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-destructive">
                      Người đền bài
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-background px-3 py-1.5 text-xs font-black text-destructive ring-1 ring-destructive/20">
                        {pShort(n.dennerId)}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        đền cho {denForIds.map((id) => pShort(id)).join(", ")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">
                      Mất {dennerLoss} điểm
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Người bị nhốt
                  </p>
                  {n.victims.map((v) => {
                    const ecPts =
                      Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
                    const heoPtsOf = (heo: { do: number; den: number }) =>
                      heo.den * gameConfig.heodenPoints +
                      heo.do * gameConfig.heoDoPoints;

                    const baseLoss =
                      nv === 1
                        ? gameConfig.rankPoints[0] * 2 +
                          heoPtsOf(v.heo ?? { do: 0, den: 0 })
                        : ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });

                    const isDenFor = denForIds.includes(v.victimId);
                    const finalLoss = isDenFor
                      ? 0
                      : n.dennerId === v.victimId
                        ? baseLoss +
                          (denBaiLosses[v.victimId] ?? 0)
                        : baseLoss;

                    return (
                      <div
                        key={v.victimId}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-black text-destructive">
                            {pShort(v.victimId)}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(v.heo?.do ?? 0) > 0 && (
                              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                                {v.heo?.do} Đỏ
                              </span>
                            )}
                            {(v.heo?.den ?? 0) > 0 && (
                              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-black text-background">
                                {v.heo?.den} Đen
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-black text-destructive">
                          {isDenFor ? "0" : `-${finalLoss}`}
                        </span>
                      </div>
                    );
                  })}

                  {nv === 2 &&
                    (() => {
                      const victimLoss = players.find(
                        (p) =>
                          !n.victims
                            .map((v) => v.victimId)
                            .includes(p.id) && p.id !== n.nhotterId,
                      );

                      if (!victimLoss) return null;

                      return (
                        <div className="flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
                          <span className="text-sm font-black text-destructive">
                            {pShort(victimLoss.id)}
                          </span>
                          <span className="text-sm font-black text-destructive">
                            -{gameConfig.nhotBystanderPenalty}
                          </span>
                        </div>
                      );
                    })()}
                </div>

                <Button
                  className="relative z-20 h-10 w-full text-xs font-black"
                  onClick={onReset}
                >
                  Chọn lại
                </Button>
              </div>
            );
          })}
      </div>
    </Card>
  );
}
