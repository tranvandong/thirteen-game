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
import { History, TrendingUp, TrendingDown } from "lucide-react";

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
      className={`font-medium ${
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

export default function HistoryPage() {
  const { players, rounds, playerTotals } = useLoaderData<HistoryLoaderData>();

  return (
    <main className="h-[100dvh] min-h-0 overflow-hidden p-4 pb-[calc(6.25rem_+_env(safe-area-inset-bottom))]">
      <Card className="h-full min-h-0 flex flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
              <History className="size-4" />
            </div>
            Lịch sử ván đấu
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          {rounds.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Chưa có ván đấu nào.
              </p>
            </div>
          ) : (
            <div className="h-full overflow-auto overscroll-contain">
              <Table className="border-separate border-spacing-0">
                <TableHeader className="sticky top-0 z-20">
                  <TableRow className="bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80 [&>th]:border-b">
                    <TableHead className="sticky left-0 z-30 w-12 bg-muted/95 text-center backdrop-blur">
                      Ván
                    </TableHead>
                    {players.map((player) => (
                      <TableHead
                        key={player.id}
                        className="min-w-[60px] text-center"
                      >
                        <span className="hidden sm:inline">{player.name}</span>
                        <span className="sm:hidden">{player.shortName}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rounds.map((round) => (
                    <TableRow key={round.id} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 z-10 bg-background text-center font-bold">
                        {round.roundNo}
                      </TableCell>
                      {round.scores.map((score, index) => (
                        <TableCell key={index} className="text-center">
                          <ScoreCell score={score} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>

                <TableFooter className="sticky bottom-0 z-20">
                  <TableRow className="bg-muted/95 font-bold backdrop-blur supports-[backdrop-filter]:bg-muted/80 [&>td]:border-t">
                    <TableCell className="sticky left-0 z-30 bg-muted/95 text-center backdrop-blur">
                      Tổng
                    </TableCell>
                    {playerTotals.map((total, index) => (
                      <TableCell key={index} className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {total > 0 ? (
                            <TrendingUp className="size-3 text-chart-2" />
                          ) : total < 0 ? (
                            <TrendingDown className="size-3 text-destructive" />
                          ) : null}
                          <ScoreCell score={total} />
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