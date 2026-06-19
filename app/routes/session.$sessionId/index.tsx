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
import { Trophy, Crown } from "lucide-react";
import { cn } from "~/lib/utils";

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

  return {
    session,
    playerTotals,
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

function ScoreRow({
  player,
  rank,
}: {
  player: PlayerTotal;
  rank: number;
}) {
  const score = player.totalScore ?? 0;
  const isLeader = rank === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-all",
        isLeader
          ? "border-primary/25 bg-primary/8 shadow-sm shadow-primary/10"
          : "border-border/70 bg-card/70",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-black",
          isLeader
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {rank + 1}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-foreground sm:text-base">
          {player.playerName}
        </p>
      </div>

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
  const { playerTotals } = loaderData;

  const sorted = [...playerTotals].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0),
  );

  const leader = sorted[0] ?? null;
  const lowest = sorted[sorted.length - 1] ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-4 pb-32">
      {/* Leader vs lowest */}
      <div className="grid grid-cols-2 gap-3">
        <LeaderSummaryCard
          title="Dẫn đầu"
          player={leader}
          accent="leader"
        />

        <LeaderSummaryCard
          title="Thấp nhất"
          player={lowest}
          accent="lowest"
        />
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
              <ScoreRow
                key={player.playerId}
                player={player}
                rank={index}
              />
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}