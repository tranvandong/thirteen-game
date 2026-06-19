import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/history";
import { eq, asc, inArray } from "drizzle-orm";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { players as playersSchema } from "~/db/schema/players";
import { rounds } from "~/db/schema/rounds";
import { roundResults } from "~/db/schema/round-results";
import { sessionTotals } from "~/db/schema/session-totals";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "~/components/ui/table";
import { History, Trophy, TrendingUp, TrendingDown } from "lucide-react";

export interface HistoryLoaderData {
  players: Array<{ id: string; name: string; shortName: string }>;
  rounds: Array<{
    id: string;
    roundNo: number;
    scores: number[];
  }>;
  playerTotals: number[];
}

export async function loader({
  params,
}: Route.LoaderArgs): Promise<HistoryLoaderData> {
  const { sessionId } = params;

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) {
    throw redirect("/");
  }

  const players = await db
    .select()
    .from(playersSchema)
    .where(eq(playersSchema.sessionId, session.id))
    .orderBy(asc(playersSchema.orderNo));

  const playerList = players.map((p) => ({
    id: p.id,
    name: p.name,
    shortName: p.name.split(" ").pop() ?? p.name,
  }));

  const roundRows = await db
    .select({
      id: rounds.id,
      roundNo: rounds.roundNo,
    })
    .from(rounds)
    .where(eq(rounds.sessionId, session.id))
    .orderBy(asc(rounds.roundNo));

  const roundIds = roundRows.map((r) => r.id);

  const resultsByRound = new Map<string, Map<string, number>>();

  if (roundIds.length > 0) {
    const results = await db
      .select({
        roundId: roundResults.roundId,
        playerId: roundResults.playerId,
        score: roundResults.score,
      })
      .from(roundResults)
      .where(inArray(roundResults.roundId, roundIds));

    for (const row of results) {
      if (!resultsByRound.has(row.roundId)) {
        resultsByRound.set(row.roundId, new Map());
      }
      resultsByRound.get(row.roundId)!.set(row.playerId, row.score);
    }
  }

  const roundList = roundRows.map((round) => {
    const scoreMap = resultsByRound.get(round.id) ?? new Map();
    return {
      id: round.id,
      roundNo: round.roundNo,
      scores: players.map((p) => scoreMap.get(p.id) ?? 0),
    };
  });

  const totalsRows = await db
    .select({
      playerId: sessionTotals.playerId,
      totalScore: sessionTotals.totalScore,
    })
    .from(sessionTotals)
    .where(eq(sessionTotals.sessionId, session.id));

  const totalsMap = new Map(
    totalsRows.map((t) => [t.playerId, t.totalScore]),
  );

  const playerTotals = players.map((p) => totalsMap.get(p.id) ?? 0);

  return {
    players: playerList,
    rounds: roundList,
    playerTotals,
  };
}

function formatScore(score: number) {
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreTone(score: number) {
  if (score > 0) {
    return {
      text: "text-chart-2",
      bg: "bg-chart-2/10",
      border: "border-chart-2/20",
    };
  }

  if (score < 0) {
    return {
      text: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
    };
  }

  return {
    text: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
  };
}

function ScorePill({ score }: { score: number }) {
  const tone = scoreTone(score);

  return (
    <span
      className={[
        "inline-flex min-w-16 justify-center rounded-full px-2.5 py-1 text-sm font-black tabular-nums",
        tone.bg,
        tone.border,
        "border",
        tone.text,
      ].join(" ")}
    >
      {formatScore(score)}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "primary" | "chart" | "destructive";
}) {
  const toneClass =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "chart"
        ? "bg-chart-4/10 text-chart-4"
        : "bg-primary/10 text-primary";

  return (
    <div
      className={[
        "rounded-2xl border border-border/60 p-3 shadow-sm",
        toneClass,
      ].join(" ")}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <p className="truncate text-lg font-black">{value}</p>
    </div>
  );
}

function RoundSummary({
  scores,
  playerNames,
}: {
  scores: number[];
  playerNames: string[];
}) {
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);
  const bestPlayer = playerNames[scores.indexOf(bestScore)] ?? "—";
  const worstPlayer = playerNames[scores.indexOf(worstScore)] ?? "—";

  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-chart-2/10 px-3 py-2 text-chart-2 ring-1 ring-chart-2/15">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
          Cao nhất
        </p>
        <p className="truncate text-sm font-black">
          {bestPlayer} · {formatScore(bestScore)}
        </p>
      </div>
      <div className="rounded-2xl bg-destructive/10 px-3 py-2 text-destructive ring-1 ring-destructive/15">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
          Thấp nhất
        </p>
        <p className="truncate text-sm font-black">
          {worstPlayer} · {formatScore(worstScore)}
        </p>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { players, rounds, playerTotals } = useLoaderData<HistoryLoaderData>();

  const leaderIndex = playerTotals.reduce(
    (bestIndex, score, index) =>
      score > playerTotals[bestIndex] ? index : bestIndex,
    0,
  );

  const lowestIndex = playerTotals.reduce(
    (lowestIndex, score, index) =>
      score < playerTotals[lowestIndex] ? index : lowestIndex,
    0,
  );

  const playerNames = players.map((player) => player.name);

  return (
    <main className="flex h-[calc(100dvh-3.5rem-5rem)] min-h-0 box-border flex-col p-3 sm:p-4">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="shrink-0 gap-3 pb-3 sm:pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex size-8 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <History className="size-4" />
                </div>
                Lịch sử ván đấu
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Theo dõi điểm từng ván và tổng điểm hiện tại.
              </p>
            </div>

            <div className="rounded-2xl bg-muted px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Số ván
              </p>
              <p className="text-lg font-black text-foreground">{rounds.length}</p>
            </div>
          </div>

          {players.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Dẫn đầu"
                value={players[leaderIndex]?.name ?? "—"}
                icon={<Trophy className="size-3.5" />}
                tone="chart"
              />
              <StatCard
                label="Tổng cao nhất"
                value={formatScore(playerTotals[leaderIndex] ?? 0)}
                icon={<TrendingUp className="size-3.5" />}
                tone="chart"
              />
              <StatCard
                label="Thấp nhất"
                value={formatScore(playerTotals[lowestIndex] ?? 0)}
                icon={<TrendingDown className="size-3.5" />}
                tone="destructive"
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          {players.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                <History className="size-6" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Chưa có người chơi
                </p>
                <p className="text-sm text-muted-foreground">
                  Vui lòng thêm người chơi để bắt đầu ghi lịch sử.
                </p>
              </div>
            </div>
          ) : rounds.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <History className="size-6" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Chưa có ván nào</p>
                <p className="text-sm text-muted-foreground">
                  Hoàn tất ván đầu tiên để xem lịch sử điểm tại đây.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative h-full overflow-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="border-b border-border/70 bg-muted/95 backdrop-blur">
                    <TableHead className="sticky left-0 z-30 w-16 bg-muted/95 text-center text-xs uppercase tracking-wide">
                      Ván
                    </TableHead>
                    {players.map((player) => (
                      <TableHead
                        key={player.id}
                        className="min-w-[116px] px-3 text-center"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="max-w-[90px] truncate text-xs font-black text-foreground">
                            {player.name}
                          </span>
                          <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {formatScore(playerTotals[indexOfPlayer(players, player.id)] ?? 0)}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rounds.map((round, roundIndex) => (
                    <TableRow
                      key={round.id}
                      className="group border-border/50 transition-colors hover:bg-primary/5"
                    >
                      <TableCell className="sticky left-0 z-20 w-16 bg-background px-2 py-3 group-hover:bg-primary/5">
                        <div className="flex flex-col items-center gap-1">
                          <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-xs font-black text-primary-foreground shadow-sm">
                            {round.roundNo}
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {roundIndex === 0 ? "Mới nhất" : `#${round.roundNo}`}
                          </span>
                        </div>
                      </TableCell>

                      {round.scores.map((score, index) => (
                        <TableCell key={index} className="px-3 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <ScorePill score={score} />
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {playerNames[index]}
                            </span>
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>

                <TableFooter>
                  <TableRow className="border-t border-border/80 bg-muted/95 backdrop-blur font-bold">
                    <TableCell className="sticky left-0 z-30 w-16 bg-muted/95 text-center text-xs uppercase tracking-wide text-muted-foreground">
                      Tổng
                    </TableCell>
                    {playerTotals.map((total, index) => (
                      <TableCell key={players[index]?.id ?? index} className="px-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <ScorePill score={total} />
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {players[index]?.name ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function indexOfPlayer(
  players: Array<{ id: string; name: string; shortName: string }>,
  playerId: string,
) {
  return players.findIndex((player) => player.id === playerId);
}