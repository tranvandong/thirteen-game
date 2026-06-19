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
    <main className="p-4 flex flex-col h-[calc(100dvh-3.5rem-5rem)] min-h-0 box-border">
      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
              <History className="size-4" />
            </div>
            Lịch sử ván đấu
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
          {rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 px-4">
              Chưa có ván đấu nào.
            </p>
          ) : (
            <div className="relative h-full overflow-auto">
              <Table className="[&>div]:overflow-visible">
                <TableHeader className="sticky top-0 z-20">
                  <TableRow className="bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    <TableHead className="text-center w-12 sticky left-0 bg-muted/95 backdrop-blur z-30">
                      Van
                    </TableHead>
                    {players.map((player) => (
                      <TableHead
                        key={player.id}
                        className="text-center min-w-[60px]"
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
                      <TableCell className="text-center font-bold sticky left-0 bg-background z-10">
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
                  <TableRow className="bg-muted/95 backdrop-blur font-bold">
                    <TableCell className="text-center sticky left-0 bg-muted/95 backdrop-blur z-30">
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
