import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/history";
import { eq, asc, inArray } from "drizzle-orm";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { players as playersSchema } from "~/db/schema/players";
import { rounds } from "~/db/schema/rounds";
import { roundResults } from "~/db/schema/round-results";
import { sessionTotals } from "~/db/schema/session-totals";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { History } from "lucide-react";

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
        "inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-black tabular-nums",
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

function RoundTable({
  rounds,
  players,
  playerTotals,
}: {
  rounds: HistoryLoaderData["rounds"];
  players: HistoryLoaderData["players"];
  playerTotals: number[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-border/70 bg-muted/70">
            <TableHead className="w-12 p-2 text-center text-[10px] font-black uppercase tracking-wide">
              Ván
            </TableHead>
            {players.map((player) => (
              <TableHead key={player.id} className="p-2 text-center">
                <span className="max-w-full truncate text-[10px] font-black text-foreground">
                  {player.shortName}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rounds.map((round) => (
            <TableRow
              key={round.id}
              className="border-border/50 transition-colors hover:bg-primary/5"
            >
              <TableCell className="w-12 p-2 text-center">
                <span className="inline-flex size-7 items-center justify-center rounded-xl bg-primary text-xs font-black text-primary-foreground">
                  {round.roundNo}
                </span>
              </TableCell>
              {round.scores.map((score, index) => (
                <TableCell
                  key={`${round.id}-${index}`}
                  className="p-2 text-center"
                >
                  <ScorePill score={score} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow className="border-t border-border/80 bg-muted/70 font-bold">
            <TableCell className="w-12 p-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
              Tổng
            </TableCell>
            {players.map((player, index) => (
              <TableCell key={player.id} className="p-2 text-center">
                <ScorePill score={playerTotals[index] ?? 0} />
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export default function HistoryPage() {
  const { players, rounds, playerTotals } = useLoaderData<HistoryLoaderData>();

  return (
    <main className="flex h-[calc(100dvh-3.5rem-5rem)] min-h-0 box-border overflow-hidden p-3 sm:p-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden">
        <div className="shrink-0 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <History className="size-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">
                Lịch sử ván đấu
              </h1>
              <p className="text-xs text-muted-foreground">
                Bảng điểm theo từng ván.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {players.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                <History className="size-6" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Chưa có người chơi</p>
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
            <RoundTable
              rounds={rounds}
              players={players}
              playerTotals={playerTotals}
            />
          )}
        </div>
      </div>
    </main>
  );
}