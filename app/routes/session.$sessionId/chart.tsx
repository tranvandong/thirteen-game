"use client";

import { useParams } from "react-router";
import type { Route } from "./+types/chart";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { rounds } from "~/db/schema/rounds";
import { players } from "~/db/schema/players";
import { roundResults } from "~/db/schema/round-results";
import { sessionTotals } from "~/db/schema/session-totals";
import { eq } from "drizzle-orm";
import { TrendingUp, BarChart2, TrendingDown } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Cell,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "~/components/ui/chart";

// ── Loader ───────────────────────────────────────────────────
export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId: sessionCode } = params;

  // 0. Resolve sessionId từ sessionCode
  const session = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1)
    .then((rows) => rows[0]);

  if (!session) throw new Response("Session not found", { status: 404 });

  const sessionId = session.id;

  // 1. Lấy danh sách players trong session, sắp xếp theo orderNo
  const sessionPlayers = await db
    .select()
    .from(players)
    .where(eq(players.sessionId, sessionId))
    .orderBy(players.orderNo);

  // 2. Lấy tất cả rounds trong session, sắp xếp theo roundNo
  const sessionRounds = await db
    .select()
    .from(rounds)
    .where(eq(rounds.sessionId, sessionId))
    .orderBy(rounds.roundNo);

  // 3. Lấy tất cả round_results cho session này
  //    Join round_results → rounds để lọc theo sessionId
  const allResults = await db
    .select({
      roundId: roundResults.roundId,
      roundNo: rounds.roundNo,
      playerId: roundResults.playerId,
      rank: roundResults.rank,
      score: roundResults.score,
      khapno: roundResults.khapno,
      sanhno: roundResults.sanhno,
      blackPigNo: roundResults.blackPigNo,
      redPigNo: roundResults.redPigNo,
    })
    .from(roundResults)
    .innerJoin(rounds, eq(roundResults.roundId, rounds.id))
    .where(eq(rounds.sessionId, sessionId))
    .orderBy(rounds.roundNo);

  // 4. Tổng điểm từ session_totals
  const totals = await db
    .select()
    .from(sessionTotals)
    .where(eq(sessionTotals.sessionId, sessionId));

  // ── Xây dựng dữ liệu cho Chart 1: Điểm tích lũy qua từng ván ──
  // Tính cumulative score theo từng ván cho từng player
  const playerIdToKey = (id: string) => {
    const idx = sessionPlayers.findIndex((p) => p.id === id);
    return idx >= 0 ? `p${idx + 1}` : null;
  };

  // Map: roundNo → { van, p1, p2, p3, p4, ... }
  const cumulativeMap: Record<number, Record<string, string | number>> = {};

  // Khởi tạo accumulator
  const accScore: Record<string, number> = {};
  sessionPlayers.forEach((p, i) => {
    accScore[`p${i + 1}`] = 0;
  });

  for (const round of sessionRounds) {
    const resultsForRound = allResults.filter(
      (r) => r.roundNo === round.roundNo,
    );
    for (const res of resultsForRound) {
      const key = playerIdToKey(res.playerId);
      if (key) accScore[key] = (accScore[key] ?? 0) + res.score;
    }
    cumulativeMap[round.roundNo] = {
      van: `Ván ${round.roundNo}`,
      ...accScore,
    };
  }

  const roundScores = Object.values(cumulativeMap);

  // ── Chart 2: Số lần về nhất / về tư ──
  const rankData = sessionPlayers.map((p, i) => {
    const key = `p${i + 1}`;
    const playerResults = allResults.filter((r) => r.playerId === p.id);
    return {
      name: p.name,
      key,
      nhat: playerResults.filter((r) => r.rank === 1).length,
      tu: playerResults.filter((r) => r.rank === 4).length,
    };
  });

  // ── Chart 3: Số lượng sảnh / khạp ──
  const bonusData = sessionPlayers.map((p) => {
    const playerResults = allResults.filter((r) => r.playerId === p.id);
    return {
      name: p.name,
      sanh: playerResults.reduce((sum, r) => sum + r.sanhno, 0),
      khap: playerResults.reduce((sum, r) => sum + r.khapno, 0),
    };
  });

  // ── Chart 4: Tổng điểm ──
  const totalScores = sessionPlayers.map((p) => {
    const total = totals.find((t) => t.playerId === p.id);
    return {
      name: p.name,
      diem: total?.totalScore ?? 0,
    };
  });

  return {
    players: sessionPlayers,
    roundCount: sessionRounds.length,
    roundScores,
    rankData,
    bonusData,
    totalScores,
  };
}

// ── Component ────────────────────────────────────────────────
export default function ChartPage({ loaderData }: Route.ComponentProps) {
  const { players, roundCount, roundScores, rankData, bonusData, totalScores } =
    loaderData;

  // Tạo chart config động từ danh sách players
  const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
  ];

  const specificColors = ["#ef4444", "#22c55e", "#eab308", "#3b82f6"];

  const lineChartConfig = Object.fromEntries(
    players.map((p, i) => [
      `p${i + 1}`,
      { label: p.name, color: CHART_COLORS[i % CHART_COLORS.length] },
    ]),
  ) satisfies ChartConfig;

  const rankChartConfig = {
    nhat: { label: "Về nhất", color: "var(--chart-4)" },
    tu: { label: "Về tư", color: "var(--destructive)" },
  } satisfies ChartConfig;

  const bonusChartConfig = {
    sanh: { label: "Sảnh", color: "var(--chart-1)" },
    khap: { label: "Khạp", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  const totalScoreConfig = {
    diem: { label: "Tổng điểm" },
  } satisfies ChartConfig;

  // Tìm người dẫn đầu số lần về nhất
  const topRank = rankData.reduce(
    (best, cur) => (cur.nhat > (best?.nhat ?? -1) ? cur : best),
    rankData[0],
  );

  // Tìm người dẫn đầu số lần về bét
  const topRank2 = rankData.reduce(
    (best, cur) => (cur.tu > (best?.tu ?? -1) ? cur : best),
    rankData[0],
  );

  return (
    <main className="p-4 flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
          <BarChart2 className="size-4" />
        </div>
        <h1 className="text-lg font-semibold">Biểu Đồ</h1>
      </div>

      {/* ── 1. Điểm tích lũy qua các ván ─────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Điểm tích lũy</CardTitle>
          <CardDescription>Điểm cộng dồn qua từng ván đấu</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineChartConfig} className="relative z-10">
            <LineChart data={roundScores} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="van"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v: string) => ""}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={28}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {players.map((p, i) => (
                <Line
                  key={p.id}
                  dataKey={`p${i + 1}`}
                  type="monotone"
                  stroke={specificColors[i] ?? `var(--color-p${i + 1})`}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 5 }}
                  markerEnd="s"
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tổng {roundCount} ván đấu đã hoàn thành
        </CardFooter>
      </Card>

      {/* ── 2. Số lần về nhất / về tư ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Về nhất &amp; Về tư</CardTitle>
          <CardDescription>Số lần đạt hạng 1 và hạng 4</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={rankChartConfig}  className="relative z-10">
            <BarChart data={rankData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="nhat" fill="var(--color-nhat)" radius={4} />
              <Bar dataKey="tu" fill="var(--color-tu)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
        {topRank && (
          <CardFooter className="flex flex-col gap-2 text-sm">
            <div className="flex gap-1 text-chart-2 text-sm">
              <TrendingUp className="size-4" />
              {topRank.name} dẫn đầu số lần về nhất ({topRank.nhat} lần)
            </div>
            <div className="flex items-center gap-1 text-destructive text-sm">
              <TrendingDown className="size-4" />
              {topRank2.name} dẫn đầu số lần về tư ({topRank2.tu} lần)
            </div>
          </CardFooter>
        )}
      </Card>

      {/* ── 3. Số lượng sảnh / khạp ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Sảnh &amp; Khạp</CardTitle>
          <CardDescription>
            Số lượng sảnh và khạp của từng người chơi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={bonusChartConfig}  className="relative z-10">
            <BarChart data={bonusData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="sanh" fill="var(--color-sanh)" radius={4} />
              <Bar dataKey="khap" fill="var(--color-khap)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tổng hợp sảnh và khạp trong toàn bộ phiên
        </CardFooter>
      </Card>
    </main>
  );
}
