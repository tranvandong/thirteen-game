import type { Route } from "./+types/index";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { players } from "~/db/schema/players";
import { rounds } from "~/db/schema/rounds";
import { roundResults } from "~/db/schema/round-results";
import { sessionTotals } from "~/db/schema/session-totals";
import { eq, desc, max } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
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

  const [lastRoundRow] = await db
    .select({ maxRoundNo: max(rounds.roundNo) })
    .from(rounds)
    .where(eq(rounds.sessionId, session.id));

  const maxRoundNo = lastRoundRow?.maxRoundNo ?? null;

  let lastRoundResults: { playerId: string; score: number }[] = [];

  if (maxRoundNo !== null) {
    const [lastRound] = await db
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.sessionId, session.id))
      .orderBy(desc(rounds.roundNo))
      .limit(1);

    if (lastRound) {
      lastRoundResults = await db
        .select({
          playerId: roundResults.playerId,
          score: roundResults.score,
        })
        .from(roundResults)
        .where(eq(roundResults.roundId, lastRound.id));
    }
  }

  return {
    session,
    playerTotals,
    lastRoundResults,
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

function statusLabel(status: string) {
  switch (status) {
    case "playing":
      return "Đang chơi";
    case "finished":
      return "Hoàn tất";
    default:
      return "Chờ bắt đầu";
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "playing":
      return "border-chart-2/20 bg-chart-2/10 text-chart-2";
    case "finished":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
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
        "inline-flex items-center justify-center rounded-2xl border px-4 py-2 font-black tabular-nums shadow-sm",
        "min-w-20 text-2xl sm:text-3xl",
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
  description,
  accent,
}: {
  title: string;
  player: PlayerTotal | null;
  description: string;
  accent: "leader" | "lowest";
}) {
  const score = player?.totalScore ?? 0;

  return (
    <Card
      className={cn(
        "overflow-hidden border p-4 shadow-sm",
        accent === "leader"
          ? "border-primary/20 bg-primary/5"
          : "border-destructive/15 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            {accent === "leader" ? (
              <Crown className="size-3.5 text-primary" />
            ) : (
              <Trophy className="size-3.5 text-destructive" />
            )}
            {title}
          </div>

          <p className="mt-2 truncate text-lg font-black text-foreground">
            {player?.playerName ?? "—"}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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
          "flex size-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black",
          isLeader
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {rank + 1}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-foreground">
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
  const { session, playerTotals } = loaderData;

  const sorted = [...playerTotals].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0),
  );

  const leader = sorted[0] ?? null;
  const lowest = sorted[sorted.length - 1] ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-4 pb-32">
      {/* Header */}
      <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Trophy className="size-6" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardDescription className="text-xs font-black uppercase tracking-wide text-primary">
                    Phòng {session.code}
                  </CardDescription>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-xs font-black",
                      statusBadgeClass(session.status),
                    )}
                  >
                    {statusLabel(session.status)}
                  </Badge>
                </div>

                <CardTitle className="mt-1 text-2xl font-black tracking-tight text-foreground">
                  Bảng điểm tổng
                </CardTitle>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Theo dõi thứ hạng và tổng điểm hiện tại của từng người chơi.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Leader vs lowest */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <LeaderSummaryCard
          title="Dẫn đầu"
          player={leader}
          description="Tổng điểm cao nhất"
          accent="leader"
        />

        <LeaderSummaryCard
          title="Thấp nhất"
          player={lowest}
          description="Tổng điểm thấp nhất"
          accent="lowest"
        />
      </div>

      {/* Ranking list */}
      <Card className="mt-4 overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div>
            <CardTitle className="text-base">Xếp hạng hiện tại</CardTitle>
            <CardDescription>
              Tên người chơi và tổng điểm được hiển thị rõ ràng.
            </CardDescription>
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