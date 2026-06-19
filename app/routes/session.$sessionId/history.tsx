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

function ScoreCell({ score }: { score: number }) {
  return (
    <span
      className={`font-black tabular-nums text-xs sm:text-sm ${
        score > 0
          ? "text-chart-2"
          : score < 0
            ? "text-destructive"
            : "text-muted-foreground"
      }`}
    >
      {score > 0 ? `+${score}` : score}
    </span>
  );
}

function PlayerScoreCell({ score }: { score: number }) {
  return (
    <div
      className={`inline-flex min-w-0 items-center justify-center rounded-2xl px-1.5 py-1.5 text-xs font-black tabular-nums sm:px-2 sm:py-2 ${
        score > 0
          ? "bg-chart-2/10 text-chart-2"
          : score < 0
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {score > 0 ? `+${score}` : score}
    </div>
  );
}

function TotalScoreCell({ score }: { score: number }) {
  return (
    <div
      className={`inline-flex min-w-0 items-center justify-center rounded-2xl px-1.5 py-1.5 text-xs font-black tabular-nums sm:px-2 sm:py-2 ${
        score > 0
          ? "bg-chart-4/10 text-chart-4"
          : score < 0
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {score > 0 ? `+${score}` : score}
    </div>
  );
}

export default function HistoryPage() {
  const { players, rounds, playerTotals } = useLoaderData<HistoryLoaderData>();

  return (
    <main className="p-4 flex flex-col h-[calc(100dvh-3.5rem-5rem)] min-h-0 box-border">
      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="shrink-0 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <History className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Lịch sử ván đấu</CardTitle>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Xem lại kết quả từng ván và tổng điểm hiện tại.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-background/80 px-3 py-2 shadow-sm">
              <Trophy className="size-4 text-chart-4" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Tổng ván
                </p>
                <p className="text-sm font-black text-foreground">
                  {rounds.length}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
          {rounds.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <History className="size-7" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Chưa có ván đấu nào
                </p>
                <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
                  Sau khi lưu ván đầu tiên, lịch sử và tổng điểm sẽ hiển thị tại đây.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative h-full overflow-y-auto overflow-x-hidden overscroll-contain">
              <Table className="w-full min-w-0 border-separate border-spacing-0 table-fixed">
                <TableHeader className="sticky top-0 z-30">
                  <TableRow className="bg-background/95 backdrop-blur shadow-[inset_0_1px_0_0_rgba(148,163,184,0.18)] [&>th]:py-2">
                    <TableHead className="w-12 px-1 text-center text-[11px] uppercase tracking-wider text-chart-4">
                      Ván
                    </TableHead>
                    {players.map((player) => (
                      <TableHead key={player.id} className="px-1 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="max-w-full truncate text-[11px] font-bold uppercase tracking-wide text-foreground">
                            {player.shortName}
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
                      className={`transition-colors hover:bg-primary/5 [&>td]:py-2 ${
                        roundIndex % 2 === 0
                          ? "bg-background/70"
                          : "bg-muted/20"
                      }`}
                    >
                      <TableCell className="w-12 px-1 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-primary text-[11px] font-black text-primary-foreground shadow-sm">
                          {round.roundNo}
                        </span>
                      </TableCell>
                      {round.scores.map((score, index) => (
                        <TableCell key={index} className="px-1 text-center">
                          <PlayerScoreCell score={score} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>

                <TableFooter className="sticky bottom-0 z-30">
                  <TableRow className="bg-card/95 backdrop-blur shadow-[0_-1px_0_0_rgba(148,163,184,0.18)] [&>td]:py-2">
                    <TableCell className="w-12 px-1 text-center font-black text-foreground">
                      Tổng
                    </TableCell>
                    {playerTotals.map((total, index) => (
                      <TableCell key={index} className="px-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {total > 0 ? (
                            <TrendingUp className="size-3.5 text-chart-2" />
                          ) : total < 0 ? (
                            <TrendingDown className="size-3.5 text-destructive" />
                          ) : null}
                          <TotalScoreCell score={total} />
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