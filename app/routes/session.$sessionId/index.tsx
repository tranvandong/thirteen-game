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
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Trophy,
  Crown,
  ArrowBigUpDash,
  ArrowBigDownDash,
  Minus,
  Users,
  Sparkles,
} from "lucide-react";
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

type LastRoundResult = { playerId: string; score: number };

function computeRankChanges(
  playerTotals: PlayerTotal[],
  lastRoundResults: LastRoundResult[],
): Map<string, "up" | "down" | "same"> {
  const lastScoreMap = new Map(
    lastRoundResults.map((r) => [r.playerId, r.score]),
  );

  const normalize = (t: PlayerTotal) => t.totalScore ?? 0;

  const currentRanked = [...playerTotals]
    .sort((a, b) => normalize(b) - normalize(a))
    .map((t) => t.playerId);

  const prevRanked = [...playerTotals]
    .map((t) => ({
      playerId: t.playerId,
      prevScore: normalize(t) - (lastScoreMap.get(t.playerId) ?? 0),
    }))
    .sort((a, b) => b.prevScore - a.prevScore)
    .map((t) => t.playerId);

  const result = new Map<string, "up" | "down" | "same">();
  for (const id of currentRanked) {
    const cur = currentRanked.indexOf(id);
    const prev = prevRanked.indexOf(id);
    if (prev === -1 || prev === cur) result.set(id, "same");
    else if (cur < prev) result.set(id, "up");
    else result.set(id, "down");
  }
  return result;
}

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

function playerInitial(playerName: string) {
  return playerName.trim().charAt(0).toUpperCase() || "?";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScorePill({
  score,
  large = false,
  className,
}: {
  score: number;
  large?: boolean;
  className?: string;
}) {
  const tone = scoreTone(score);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border font-black tabular-nums transition-colors",
        large
          ? "h-14 min-w-24 px-4 text-2xl shadow-sm"
          : "h-11 min-w-16 px-3 text-sm shadow-sm",
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

function RankChangeIndicator({
  change,
}: {
  change: "up" | "down" | "same";
}) {
  if (change === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-chart-2/10 px-2 py-1 text-xs font-black text-chart-2">
        <ArrowBigUpDash className="size-3.5" fill="currentColor" />
        Tăng hạng
      </span>
    );
  }

  if (change === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-black text-destructive">
        <ArrowBigDownDash className="size-3.5" fill="currentColor" />
        Giảm hạng
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-1 text-xs font-semibold text-muted-foreground">
      <Minus className="size-3.5" />
      Giữ hạng
    </span>
  );
}

function PlayerAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background text-sm font-black text-foreground shadow-sm ring-1 ring-border/70">
      {playerInitial(name)}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/75 p-4 shadow-sm transition-colors hover:bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 truncate text-sm font-black text-foreground">
        {value}
      </div>
    </div>
  );
}

function LeaderCard({
  leader,
}: {
  leader: {
    playerId: string;
    playerName: string;
    orderNo: number;
    totalScore: number | null;
  } | null;
}) {
  if (!leader) return null;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-chart-4/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardDescription className="text-xs font-black uppercase tracking-wide text-primary">
              Đang dẫn đầu
            </CardDescription>
            <CardTitle className="mt-1 truncate text-2xl font-black tracking-tight text-foreground">
              {leader.playerName}
            </CardTitle>
          </div>

          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Crown className="size-6" />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Tổng điểm hiện tại
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Lấy từ bảng session_totals
            </p>
          </div>
          <ScorePill score={leader.totalScore ?? 0} large />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({
  player,
  rank,
  rankChange,
}: {
  player: PlayerTotal;
  rank: number;
  rankChange: "up" | "down" | "same";
}) {
  const score = player.totalScore ?? 0;
  const isLeader = rank === 0;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border p-3 transition-all",
        isLeader
          ? "border-primary/25 bg-primary/8 shadow-sm shadow-primary/10"
          : "border-border/70 bg-card/70 hover:bg-card",
      )}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-sm",
          isLeader
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {rank + 1}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar name={player.playerName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black text-foreground">
              {player.playerName}
            </p>
            {isLeader && (
              <Badge
                variant="secondary"
                className="gap-1 rounded-full border-primary/10 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary"
              >
                <Crown className="size-3" />
                Nhất
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RankChangeIndicator change={rankChange} />
            <span className="text-xs text-muted-foreground">
              Điểm tổng đã cập nhật
            </span>
          </div>
        </div>
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
  const { session, playerTotals, lastRoundResults } = loaderData;

  const sorted = [...playerTotals].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0),
  );

  const rankChanges = computeRankChanges(playerTotals, lastRoundResults);
  const leader = sorted[0] ?? null;
  const hasLastRound = lastRoundResults.length > 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-4 pb-32">
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
                  Theo dõi thứ hạng hiện tại và điểm tích lũy của từng người
                  chơi trong phiên.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Người chơi"
            value={`${sorted.length} người`}
            icon={<Users className="size-3.5 text-chart-4" />}
            className="border-primary/10 bg-primary/5"
          />

          <StatCard
            label="Cập nhật"
            value={hasLastRound ? "Sau ván gần nhất" : "Chưa có ván nào"}
            icon={<Sparkles className="size-3.5 text-chart-2" />}
            className={
              hasLastRound
                ? "border-chart-2/20 bg-chart-2/5"
                : "border-border/70"
            }
          />

          <StatCard
            label="Nguồn điểm"
            value="session_totals"
            icon={<Trophy className="size-3.5 text-primary" />}
          />
        </CardContent>
      </Card>

      <div className="mt-4">
        <LeaderCard leader={leader} />
      </div>

      <Card className="mt-4 overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Xếp hạng hiện tại</CardTitle>
              <CardDescription>
                Điểm dương hiển thị màu xanh, điểm âm hiển thị màu đỏ.
              </CardDescription>
            </div>
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
                rankChange={rankChanges.get(player.playerId) ?? "same"}
              />
            ))
          )}
        </CardContent>

        <CardFooter className="border-t border-border/60 px-4 pb-4 pt-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-chart-2/20 bg-chart-2/10 text-chart-2"
            >
              <span className="size-2 rounded-full bg-chart-2" />
              Điểm dương
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-destructive/20 bg-destructive/10 text-destructive"
            >
              <span className="size-2 rounded-full bg-destructive" />
              Điểm âm
            </Badge>
            <span className="hidden sm:inline">·</span>
            <span>Mũi tên thể hiện thay đổi hạng sau ván gần nhất.</span>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}