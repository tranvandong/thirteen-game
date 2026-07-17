import type { Route } from "./+types/index";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { players } from "~/db/schema/players";
import { sessionTotals } from "~/db/schema/session-totals";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Trophy, Crown, Flame, Spade, Shield } from "lucide-react";
import { cn } from "~/lib/utils";
import { getRoundMeta } from "~/lib/round.server";
import { useLoaderData, useFetcher } from "react-router";
import { useGameConfig, usePlayers } from "~/stores/useSessionStore";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) throw new Response("Session not found", { status: 404 });

  const playerTotals = await db
    .select({
      playerId: players.id,
      playerName: players.name,
      orderNo: players.orderNo,
      totalScore: sessionTotals.totalScore,
    })
    .from(players)
    .leftJoin(sessionTotals, eq(sessionTotals.playerId, players.id))
    .where(eq(players.sessionId, session.id))
    .orderBy(players.orderNo);
  const roundMeta = await getRoundMeta(session.id);

  return {
    session,
    playerTotals,
    roundMeta,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PlayerTotal = {
  playerId: string;
  playerName: string;
  orderNo: number;
  totalScore: number | null;
  initialScore: number;
};

function formatScore(score: number) {
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreTone(score: number) {
  if (score > 0) {
    return {
      text: "text-chart-2",
      bg: "bg-chart-2/15",
      border: "border-chart-2/20",
      ring: "ring-chart-2/15",
    };
  }

  if (score < 0) {
    return {
      text: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      ring: "ring-destructive/10",
    };
  }

  return {
    text: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border/70",
    ring: "ring-muted/10",
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScorePill({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const tone = scoreTone(score);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border px-1 py-1 font-black tabular-nums shadow-sm",
        "min-w-12 text-base sm:min-w-20 sm:text-xl",
        tone.bg,
        tone.border,
        tone.text,
        tone.ring,
        "ring-1",
        className,
      )}
    >
      {formatScore(score)}
    </span>
  );
}

function LeaderSummaryCard({
  title,
  player,
  accent,
}: {
  title: string;
  player: PlayerTotal | null;
  accent: "leader" | "lowest";
}) {
  const score = player?.totalScore ?? 0;

  return (
    <Card
      className={cn(
        "overflow-hidden border p-3 shadow-sm",
        accent === "leader"
          ? "border-primary/20 bg-primary/5"
          : "border-destructive/15 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            {accent === "leader" ? (
              <Crown className="size-3 text-primary" />
            ) : (
              <Trophy className="size-3 text-destructive" />
            )}
            {title}
          </div>

          <p className="mt-1.5 pl-4 truncate text-sm font-black text-foreground sm:text-base">
            {player?.playerName ?? "—"}
          </p>
        </div>

        <ScorePill score={score} />
      </div>
    </Card>
  );
}

function ScoreRow({ player, rank }: { player: PlayerTotal; rank: number }) {
  const score = player.totalScore ?? 0;
  const isLeader = rank === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-all",
        score > 0
          ? "border-primary/25 bg-primary/8 shadow-sm shadow-primary/10"
          : score === 0
            ? "border-border/70 bg-card/70"
            : "border-destructive/25 bg-destructive/8 shadow-sm shadow-destructive/10",
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-xl font-black",
          score > 0
            ? "bg-primary text-primary-foreground"
            : score === 0
              ? "text-muted-foreground bg-muted/40 border-border/70 ring-muted/10"
              : "bg-destructive/80 text-primary-foreground",
        )}
      >
        {rank + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-foreground text-base">
          {player.playerName}
        </p>
      </div>
      {player.initialScore > 0 && (
        <div className="relative inline-flex items-center justify-center">
          <Shield className="size-8 text-muted-foreground" />
          <span className="absolute text-[9px] font-bold text-muted-foreground leading-none">
            {player.initialScore}
          </span>
        </div>
      )}
      <span className="text-gray-500">{score * 3}</span>
      <ScorePill score={score} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/30 p-8 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Trophy className="size-7" />
      </div>
      <p className="font-black text-foreground">Chưa có người chơi nào</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Bảng điểm sẽ xuất hiện ngay khi người chơi được thêm vào phòng.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SessionScoreboard({
  loaderData,
}: Route.ComponentProps) {
  const config = useGameConfig();
  const players = usePlayers();
  const { playerTotals, roundMeta } = loaderData;

  const sorted = [...playerTotals]
    .map((pt) => {
      const player = players.find((p) => p.id === pt.playerId);
      return {
        ...pt,
        initialScore: player?.initialScore ?? 0,
        totalScore: (pt.totalScore ?? 0) + (player?.initialScore ?? 0),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  const leader = sorted[0] ?? null;
  const lowest = sorted[sorted.length - 1] ?? null;

  const matchLoaderFetcher = useFetcher<typeof loader>();
  const accumulated = roundMeta.accumulated;

  const currentRoundNo = roundMeta.currentRoundNo;

  const gameConfig = useMemo(
    () => ({
      rankPoints: [
        config?.firstPlaceScore ?? 3,
        config?.secondPlaceScore ?? 1,
        config?.thirdPlaceScore ?? -1,
        config?.fourthPlaceScore ?? -3,
      ],
      khapPoints: config?.khapScore ?? 3,
      sanhPoints: config?.sanhScore ?? 5,
      maxKhapAccumulate: config?.khapLimit ?? 5,
      maxSanhAccumulate: config?.sanhLimit ?? 3,
      heoDoPoints: config?.redPigScore ?? 3,
      heodenPoints: config?.blackPigScore ?? 5,
      nhotBystanderPenalty: 2,
    }),
    [config],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-4 pb-32">
      <div className="grid grid-cols-2 gap-3">
        <div className="overflow-hidden rounded-3xl border border-chart-4/20 bg-chart-4/10 p-4 ring-1 ring-chart-4/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-chart-4">
                <Flame className="size-3.5" />
                Khạp
              </div>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-black tracking-tight text-chart-4">
                  {accumulated.khap}
                </span>
                <span className="mb-1 text-xs font-semibold text-muted-foreground">
                  / {gameConfig.maxKhapAccumulate}
                </span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-chart-4 shadow-sm">
              <Flame className="size-5" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-10 gap-0.5">
            {Array.from({ length: gameConfig.maxKhapAccumulate }).map(
              (_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${i < accumulated.khap ? "bg-chart-4" : "bg-muted"}`}
                />
              ),
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-chart-1/20 bg-chart-1/10 p-4 ring-1 ring-chart-1/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-chart-1">
                <Spade className="size-3.5" />
                Sảnh
              </div>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-black tracking-tight text-chart-1">
                  {accumulated.sanh}
                </span>
                <span className="mb-1 text-xs font-semibold text-muted-foreground">
                  / {gameConfig.maxSanhAccumulate}
                </span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-chart-1 shadow-sm">
              <Spade className="size-5" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-10 gap-0.5">
            {Array.from({ length: gameConfig.maxSanhAccumulate }).map(
              (_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${i < accumulated.sanh ? "bg-chart-1" : "bg-muted"}`}
                />
              ),
            )}
          </div>
        </div>
      </div>

      {/* Ranking list */}
      <Card className="mt-4 overflow-hidden border-border/70 shadow-sm">
        <CardHeader>
          <div>
            <CardTitle className="text-base">Xếp hạng hiện tại</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 pt-0">
          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            sorted.map((player, index) => (
              <ScoreRow key={player.playerId} player={player} rank={index} />
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
