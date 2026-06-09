import type { Route } from "./+types/index";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { players } from "~/db/schema/players";
import { rounds } from "~/db/schema/rounds";
import { roundResults } from "~/db/schema/round-results";
import { sessionTotals } from "~/db/schema/session-totals";
import { eq, desc, max } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Trophy,
  Crown,
  ArrowBigUpDash,
  ArrowBigDownDash,
  Minus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Loader — chạy server-side, fetch đúng 3 query từ DB
// ---------------------------------------------------------------------------

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  // 1. Lấy thông tin session
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionId))
    .limit(1);

  if (!session) throw new Response("Session not found", { status: 404 });

  // 2. Danh sách players + tổng điểm từ session_totals
  //    JOIN players ← session_totals để lấy tên + totalScore cùng lúc
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

  // 3. Tìm roundNo lớn nhất (ván cuối cùng) của session
  const [lastRoundRow] = await db
    .select({ maxRoundNo: max(rounds.roundNo) })
    .from(rounds)
    .where(eq(rounds.sessionId, session.id));

  const maxRoundNo = lastRoundRow?.maxRoundNo ?? null;

  // 4. Nếu có ít nhất 1 ván → lấy round_results của ván cuối
  //    để tính rank trước ván cuối (= totalScore - lastRoundScore)
  let lastRoundResults: { playerId: string; score: number }[] = [];

  if (maxRoundNo !== null) {
    const [lastRound] = await db
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.sessionId, session.id))
      // Lấy đúng ván có roundNo = maxRoundNo
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

/**
 * So sánh rank sau ván cuối vs rank trước ván cuối.
 *
 * Rank trước = sort by (totalScore - lastRoundScore) desc
 * Rank sau   = sort by totalScore desc
 */
function computeRankChanges(
  playerTotals: PlayerTotal[],
  lastRoundResults: LastRoundResult[],
): Map<string, "up" | "down" | "same"> {
  const lastScoreMap = new Map(
    lastRoundResults.map((r) => [r.playerId, r.score]),
  );

  const normalize = (t: PlayerTotal) => t.totalScore ?? 0;

  // Rank hiện tại
  const currentRanked = [...playerTotals]
    .sort((a, b) => normalize(b) - normalize(a))
    .map((t) => t.playerId);

  // Rank trước ván cuối
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RankChangeIndicator({ change }: { change: "up" | "down" | "same" }) {
  if (change === "up")
    return (
      <span className="flex items-center text-chart-2">
        <ArrowBigUpDash className="size-4" fill="currentColor" />
      </span>
    );
  if (change === "down")
    return (
      <span className="flex items-center text-destructive">
        <ArrowBigDownDash className="size-4" fill="currentColor" />
      </span>
    );
  return (
    <span className="flex items-center text-muted-foreground opacity-40">
      <Minus className="size-3" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SessionScoreboard({
  loaderData,
}: Route.ComponentProps) {
  const { playerTotals, lastRoundResults } = loaderData;

  // Sort desc by totalScore
  const sorted = [...playerTotals].sort(
    (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0),
  );

  const rankChanges = computeRankChanges(playerTotals, lastRoundResults);

  const getRowStyle = (score: number) =>
    score >= 0
      ? "bg-chart-2/20 text-chart-2 border-chart-2/30"
      : "bg-destructive/10 text-destructive border-destructive/30";

  return (
    <main className="p-4 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-chart-4/20 text-chart-4">
              <Trophy className="size-4" />
            </div>
            Bảng Điểm
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có người chơi nào.
            </p>
          )}
          {sorted.map((player, index) => {
            const score = player.totalScore ?? 0;
            const rankChange = rankChanges.get(player.playerId) ?? "same";

            return (
              <div
                key={player.playerId}
                className={`flex items-center justify-between p-3 rounded-lg border ${getRowStyle(score)}`}
              >
                <div className="flex items-center gap-3">
                  {index === 0 ? (
                    <span className="flex items-center justify-center size-6">
                      <Crown className="size-4 text-chart-4" />
                    </span>
                  ) : (
                    <span className="flex items-center justify-center size-6 rounded-full bg-background text-xs font-bold">
                      {index + 1}
                    </span>
                  )}
                  <span className="font-medium">{player.playerName}</span>
                  <RankChangeIndicator change={rankChange} />
                </div>
                <span
                  className={`text-lg font-bold ${
                    score >= 0 ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {score > 0 ? `+${score}` : score}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
