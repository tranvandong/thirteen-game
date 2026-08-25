import { redirect, useFetcher, useLoaderData, useParams } from "react-router";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { History, LockKeyhole, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useGameConfig } from "~/stores/useSessionStore";
import { cn } from "~/lib/utils";
// NOTE: adjust this import to wherever useGameConfig actually lives in your app

export interface RoundPlayerResult {
  playerId: string;
  rank: number;
  score: number;
  khapNo: number;
  sanhNo: number;
  blackPigNo: number;
  redPigNo: number;
}

export interface HistoryLoaderData {
  players: Array<{ id: string; name: string; shortName: string }>;
  rounds: Array<{
    id: string;
    roundNo: number;
    scores: number[];
    hadKhap: boolean;
    hadSanh: boolean;
    hadNhot: boolean;
    accumulatedKhap: number;
    accumulatedSanh: number;
    results: RoundPlayerResult[];
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
      hadKhap: rounds.hadKhap,
      hadSanh: rounds.hadSanh,
      hadNhot: rounds.hadNhot,
      accumulatedKhap: rounds.accumulatedKhap,
      accumulatedSanh: rounds.accumulatedSanh,
    })
    .from(rounds)
    .where(eq(rounds.sessionId, session.id))
    .orderBy(asc(rounds.roundNo));

  const roundIds = roundRows.map((r) => r.id);

  const resultsByRound = new Map<string, Map<string, RoundPlayerResult>>();

  if (roundIds.length > 0) {
    const results = await db
      .select({
        roundId: roundResults.roundId,
        playerId: roundResults.playerId,
        rank: roundResults.rank,
        score: roundResults.score,
        khapNo: roundResults.khapno,
        sanhNo: roundResults.sanhno,
        blackPigNo: roundResults.blackPigNo,
        redPigNo: roundResults.redPigNo,
      })
      .from(roundResults)
      .where(inArray(roundResults.roundId, roundIds));

    for (const row of results) {
      if (!resultsByRound.has(row.roundId)) {
        resultsByRound.set(row.roundId, new Map());
      }
      resultsByRound.get(row.roundId)!.set(row.playerId, {
        playerId: row.playerId,
        rank: row.rank,
        score: row.score,
        khapNo: row.khapNo,
        sanhNo: row.sanhNo,
        blackPigNo: row.blackPigNo,
        redPigNo: row.redPigNo,
      });
    }
  }

  const roundList = roundRows.map((round) => {
    const scoreMap = resultsByRound.get(round.id) ?? new Map();
    return {
      id: round.id,
      roundNo: round.roundNo,
      hadKhap: round.hadKhap,
      hadSanh: round.hadSanh,
      hadNhot: round.hadNhot,
      accumulatedKhap: round.accumulatedKhap,
      accumulatedSanh: round.accumulatedSanh,
      scores: players.map((p) => scoreMap.get(p.id)?.score ?? 0),
      results: players.map(
        (p) =>
          scoreMap.get(p.id) ?? {
            playerId: p.id,
            rank: 0,
            score: 0,
            khapNo: 0,
            sanhNo: 0,
            blackPigNo: 0,
            redPigNo: 0,
          },
      ),
    };
  });

  const totalsRows = await db
    .select({
      playerId: sessionTotals.playerId,
      totalScore: sessionTotals.totalScore,
    })
    .from(sessionTotals)
    .where(eq(sessionTotals.sessionId, session.id));

  const totalsMap = new Map(totalsRows.map((t) => [t.playerId, t.totalScore]));

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

function rankLabel(rank: number) {
  switch (rank) {
    case 1:
      return "Nhất";
    case 2:
      return "Nhì";
    case 3:
      return "Ba";
    case 4:
      return "Tư";
    default:
      return `Hạng ${rank}`;
  }
}

function StatChip({
  label,
  count,
  points,
  signBy = "points",
}: {
  label: string;
  count: number;
  points: number;
  /** which value's sign decides the red/green tone — pig counts can go negative on their own */
  signBy?: "points" | "count";
}) {
  const tone = scoreTone(signBy === "count" ? count : points);

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs sm:text-sm font-bold border",
        tone.bg,
        tone.border,
        tone.text,
      ].join(" ")}
    >
      {label} x{Math.abs(count)}
      <span className="opacity-30">|</span>
      <span className="tabular-nums">{formatScore(points)}</span>
    </span>
  );
}

/** gameConfig shape produced by the block you gave me */
type GameConfig = {
  rankPoints: number[];
  khapPoints: number;
  sanhPoints: number;
  maxKhapAccumulate: number;
  maxSanhAccumulate: number;
  heoDoPoints: number;
  heodenPoints: number;
  nhotBystanderPenalty: number;
};

function RoundDetailDialog({
  round,
  players,
  gameConfig,
  open,
  onOpenChange,
}: {
  round: HistoryLoaderData["rounds"][number] | null;
  players: HistoryLoaderData["players"];
  gameConfig: GameConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!round) return null;

  const playersById = new Map(players.map((p) => [p.id, p]));

  const sortedResults = [...round.results].sort((a, b) => {
    // unranked (0) results go last
    if (a.rank === 0) return 1;
    if (b.rank === 0) return -1;
    return a.rank - b.rank;
  });

  const effectiveKhap = Math.min(
    round.accumulatedKhap,
    gameConfig.maxKhapAccumulate,
  );
  const effectiveSanh = Math.min(
    round.accumulatedSanh,
    gameConfig.maxSanhAccumulate,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">
            Chi tiết ván {round.roundNo}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          {sortedResults.map((result) => {
            const player = playersById.get(result.playerId);
            const rankPoints =
              result.rank > 0
                ? (gameConfig.rankPoints[result.rank - 1] ?? 0)
                : 0;
            const khapPoints =
              result.khapNo > 0
                ? result.khapNo * gameConfig.khapPoints * 3
                : result.khapNo * gameConfig.khapPoints;
            const sanhPoints =
              result.sanhNo > 0
                ? result.sanhNo * gameConfig.sanhPoints * 3
                : result.sanhNo * gameConfig.sanhPoints;
            const blackPigPoints = result.blackPigNo * gameConfig.heodenPoints;
            const redPigPoints = result.redPigNo * gameConfig.heoDoPoints;

            // Rule: when round.hadNhot, rank 1 = người nhốt, rank 4 = người bị nhốt
            const isNhotter = round.hadNhot && result.rank === 1;
            const isNhotVictim = round.hadNhot && result.rank === 4;

            const hasPigOrBonus =
              result.khapNo !== 0 ||
              result.sanhNo !== 0 ||
              result.blackPigNo !== 0 ||
              result.redPigNo !== 0;

            return (
              <div
                key={result.playerId}
                className={[
                  "flex flex-col justify-between gap-1 rounded-xl border p-3",
                  isNhotter
                    ? "border-chart-2/40 bg-chart-2/5"
                    : isNhotVictim
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border/60 bg-muted/30",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={cn(
                        "flex size-6 items-center justify-center rounded-xl font-black",
                        isNhotter
                          ? "bg-primary text-primary-foreground"
                          : isNhotVictim
                            ? "border border-destructive/20 bg-red-500"
                            : "bg-primary text-primary-foreground",
                      )}
                    >
                      {isNhotter ? (
                        <LockKeyhole className="size-4" />
                      ) : isNhotVictim ? (
                        <X className="size-4" />
                      ) : result.rank > 0 ? (
                        result.rank
                      ) : (
                        "-"
                      )}
                    </div>
                    <p className="truncate text-base font-black text-foreground">
                      {player?.name ?? "—"}
                    </p>
                  </div>
                  <span
                    className={[
                      "inline-flex min-w-6 shrink-0 justify-center rounded-full px-2 py-1 text-base font-black tabular-nums border",
                      scoreTone(result.score).bg,
                      scoreTone(result.score).border,
                      scoreTone(result.score).text,
                    ].join(" ")}
                  >
                    {formatScore(result.score)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="min-w-0">
                    {hasPigOrBonus && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {result.khapNo !== 0 && (
                          <StatChip
                            label="Khạp"
                            count={result.khapNo}
                            points={khapPoints}
                          />
                        )}
                        {result.sanhNo !== 0 && (
                          <StatChip
                            label="Sảnh"
                            count={result.sanhNo}
                            points={sanhPoints}
                          />
                        )}
                        {result.blackPigNo !== 0 && (
                          <StatChip
                            label="Đen"
                            count={result.blackPigNo}
                            points={blackPigPoints}
                            signBy="count"
                          />
                        )}
                        {result.redPigNo !== 0 && (
                          <StatChip
                            label="Đỏ"
                            count={result.redPigNo}
                            points={redPigPoints}
                            signBy="count"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoundTable({
  rounds,
  players,
  playerTotals,
  onSelectRound,
}: {
  rounds: HistoryLoaderData["rounds"];
  players: HistoryLoaderData["players"];
  playerTotals: number[];
  onSelectRound: (round: HistoryLoaderData["rounds"][number]) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="max-h-[calc(100vh-272px)] overflow-y-auto relative z-10">
        <table className="w-full table-fixed caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/70">
              {/* ✅ sticky trực tiếp trên <th>, không phải <thead> hay <tr> */}
              <th className="sticky top-0 z-20 w-12 bg-muted/70 p-2 text-center text-[10px] font-black uppercase tracking-wide backdrop-blur-sm">
                Ván
              </th>
              {players.map((player) => (
                <th
                  key={player.id}
                  className="sticky top-0 z-20 bg-muted/70 p-2 text-center backdrop-blur-sm"
                >
                  <span className="max-w-full truncate font-black text-foreground">
                    {player.shortName}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rounds.map((round, idx) => {
              const isBonusRound = round.hadKhap || round.hadSanh;
              return (
                <tr
                  key={round.id}
                  onClick={() => onSelectRound(round)}
                  className={[
                    "cursor-pointer border-b border-border/50 transition-colors hover:bg-primary/10",
                    idx % 2 === 1 ? "bg-muted/30" : "bg-transparent",
                  ].join(" ")}
                >
                  <td className="w-12 p-2 text-center">
                    <span
                      title={
                        isBonusRound
                          ? [
                              round.hadKhap && "Có khạp",
                              round.hadSanh && "Có sảnh",
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : undefined
                      }
                      className={[
                        "inline-flex size-4 items-center justify-center text-sm font-black leading-[normal]",
                        isBonusRound
                          ? "border-b-2 pb-0.5 border-foreground text-foreground"
                          : "",
                      ].join(" ")}
                    >
                      {round.roundNo}
                    </span>
                  </td>
                  {round.scores.map((score, index) => (
                    <td
                      key={`${round.id}-${index}`}
                      className="p-2 text-center"
                    >
                      <ScorePill score={score} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-border/80 bg-muted/70 font-bold">
              {/* ✅ sticky bottom trực tiếp trên <td> */}
              <td className="sticky bottom-0 z-20 w-12 bg-muted/70 p-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                Tổng
              </td>
              {players.map((player, index) => (
                <td
                  key={player.id}
                  className="sticky bottom-0 z-20 bg-muted/70 p-2 text-center backdrop-blur-sm"
                >
                  <ScorePill score={playerTotals[index] ?? 0} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { sessionId: sessionCode } = useParams();
  const fetcher = useFetcher<typeof loader>();
  const loaderData = useLoaderData<HistoryLoaderData>();

  const players = fetcher.data?.players ?? loaderData.players;
  const rounds = fetcher.data?.rounds ?? loaderData.rounds;
  const playerTotals = fetcher.data?.playerTotals ?? loaderData.playerTotals;

  const config = useGameConfig();
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
      nhotBystanderPenalty:
        config?.nhotBystanderPenalty ?? Math.abs(config?.thirdPlaceScore ?? 2),
    }),
    [config],
  );

  const [selectedRound, setSelectedRound] = useState<
    HistoryLoaderData["rounds"][number] | null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectRound = (round: HistoryLoaderData["rounds"][number]) => {
    setSelectedRound(round);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!sessionCode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (fetcher.state !== "idle") return; // tránh gọi chồng khi đang có request khác chạy
      fetcher.load(`/session/${sessionCode}/history`);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);
  return (
    <main className="flex h-[calc(100dvh-180px)] min-h-0 box-border overflow-hidden p-3 sm:p-4">
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
                Bảng điểm theo từng ván. Nhấn vào một ván để xem chi tiết.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden h-full">
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
            <RoundTable
              rounds={rounds}
              players={players}
              playerTotals={playerTotals}
              onSelectRound={handleSelectRound}
            />
          )}
        </div>
      </div>

      <RoundDetailDialog
        round={selectedRound}
        players={players}
        gameConfig={gameConfig}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </main>
  );
}
