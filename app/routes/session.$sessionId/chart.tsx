"use client";

import { useParams } from "react-router";
import type { Route } from "./+types/chart";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { rounds } from "~/db/schema/rounds";
import { players } from "~/db/schema/players";
import { roundResults } from "~/db/schema/round-results";
import { sessionTotals } from "~/db/schema/session-totals";
import { eq, sql } from "drizzle-orm";
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
  ReferenceLine,
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

  // 3. Chỉ lấy đúng những cột cần cho biểu đồ điểm tích lũy theo từng ván
  //    (đây là dữ liệu chuỗi thời gian nên bắt buộc phải lấy theo hàng,
  //    không gộp được bằng SUM/COUNT như các biểu đồ tổng hợp bên dưới)
  const roundScoreRows = await db
    .select({
      roundNo: rounds.roundNo,
      playerId: roundResults.playerId,
      score: roundResults.score,
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

  // 5. Đếm số lần về nhất/nhì/ba/tư theo từng player — dùng COUNT + GROUP BY
  //    thay vì kéo toàn bộ round_results về rồi filter/đếm ở JS.
  const rankCounts = await db
    .select({
      playerId: roundResults.playerId,
      rank: roundResults.rank,
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(roundResults)
    .innerJoin(rounds, eq(roundResults.roundId, rounds.id))
    .where(eq(rounds.sessionId, sessionId))
    .groupBy(roundResults.playerId, roundResults.rank);

  const rankCountMap = new Map<string, Record<1 | 2 | 3 | 4, number>>();
  for (const row of rankCounts) {
    if (row.rank < 1 || row.rank > 4) continue;
    if (!rankCountMap.has(row.playerId)) {
      rankCountMap.set(row.playerId, { 1: 0, 2: 0, 3: 0, 4: 0 });
    }
    rankCountMap.get(row.playerId)![row.rank as 1 | 2 | 3 | 4] = row.total;
  }

  // 6. Tổng sảnh/khạp dương & âm theo từng player — dùng SUM có điều kiện
  //    (CASE WHEN ... > 0 / < 0) ngay trong SQL thay vì reduce ở JS.
  const bonusSums = await db
    .select({
      playerId: roundResults.playerId,
      sanhDuong:
        sql<number>`sum(case when ${roundResults.sanhno} > 0 then ${roundResults.sanhno} else 0 end)`.mapWith(
          Number,
        ),
      sanhAm:
        sql<number>`sum(case when ${roundResults.sanhno} < 0 then ${roundResults.sanhno} else 0 end)`.mapWith(
          Number,
        ),
      khapDuong:
        sql<number>`sum(case when ${roundResults.khapno} > 0 then ${roundResults.khapno} else 0 end)`.mapWith(
          Number,
        ),
      khapAm:
        sql<number>`sum(case when ${roundResults.khapno} < 0 then ${roundResults.khapno} else 0 end)`.mapWith(
          Number,
        ),
      redPigDuong:
        sql<number>`sum(case when ${roundResults.redPigNo} > 0 then ${roundResults.redPigNo} else 0 end)`.mapWith(
          Number,
        ),
      redPigAm:
        sql<number>`sum(case when ${roundResults.redPigNo} < 0 then ${roundResults.redPigNo} else 0 end)`.mapWith(
          Number,
        ),
      blackPigDuong:
        sql<number>`sum(case when ${roundResults.blackPigNo} > 0 then ${roundResults.blackPigNo} else 0 end)`.mapWith(
          Number,
        ),
      blackPigAm:
        sql<number>`sum(case when ${roundResults.blackPigNo} < 0 then ${roundResults.blackPigNo} else 0 end)`.mapWith(
          Number,
        ),
    })
    .from(roundResults)
    .innerJoin(rounds, eq(roundResults.roundId, rounds.id))
    .where(eq(rounds.sessionId, sessionId))
    .groupBy(roundResults.playerId);

  const bonusSumMap = new Map(bonusSums.map((b) => [b.playerId, b]));

  // ── Xây dựng dữ liệu cho Chart 1: Điểm tích lũy qua từng ván ──
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
    const resultsForRound = roundScoreRows.filter(
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

  // ── Chart 2: Số lần về nhất / nhì / ba / tư ──
  const rankData = sessionPlayers.map((p) => {
    const counts = rankCountMap.get(p.id) ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
    return {
      name: p.name,
      nhat: counts[1],
      nhi: counts[2],
      ba: counts[3],
      tu: counts[4],
    };
  });

  // ── Chart 3a: Sảnh — cột dương / âm riêng theo từng player ──
  const sanhData = sessionPlayers.map((p) => {
    const sums = bonusSumMap.get(p.id);
    return {
      name: p.name,
      duong: sums?.sanhDuong ?? 0,
      am: sums?.sanhAm ?? 0,
    };
  });

  // ── Chart 3b: Khạp — cột dương / âm riêng theo từng player ──
  const khapData = sessionPlayers.map((p) => {
    const sums = bonusSumMap.get(p.id);
    return {
      name: p.name,
      duong: sums?.khapDuong ?? 0,
      am: sums?.khapAm ?? 0,
    };
  });

  // ── Chart 3c: Heo đỏ & Heo đen — 4 cột riêng theo từng player ──
  const pigData = sessionPlayers.map((p) => {
    const sums = bonusSumMap.get(p.id);
    return {
      name: p.name,
      redDuong: sums?.redPigDuong ?? 0,
      redAm: sums?.redPigAm ?? 0,
      blackDuong: sums?.blackPigDuong ?? 0,
      blackAm: sums?.blackPigAm ?? 0,
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
    sanhData,
    khapData,
    pigData,
    totalScores,
  };
}

// ── Component ────────────────────────────────────────────────
export default function ChartPage({ loaderData }: Route.ComponentProps) {
  const {
    players,
    roundCount,
    roundScores,
    rankData,
    sanhData,
    khapData,
    pigData,
    totalScores,
  } = loaderData;

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
    nhi: { label: "Về nhì", color: "var(--chart-1)" },
    ba: { label: "Về ba", color: "var(--chart-3)" },
    tu: { label: "Về tư", color: "var(--destructive)" },
  } satisfies ChartConfig;

  const sanhChartConfig = {
    duong: { label: "Thắng", color: "var(--chart-2)" },
    am: { label: "Thua", color: "var(--destructive)" },
  } satisfies ChartConfig;

  const khapChartConfig = {
    duong: { label: "Thắng", color: "var(--chart-2)" },
    am: { label: "Thua", color: "var(--destructive)" },
  } satisfies ChartConfig;

  const pigChartConfig = {
    redDuong: { label: "Đỏ thắng", color: "var(--chart-2)" },
    redAm: { label: "Đỏ thua", color: "var(--destructive)" },
    blackDuong: { label: "Đen thắng", color: "var(--chart-2)" },
    blackAm: { label: "Đen thua", color: "var(--destructive)" },
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

      {/* ── 2. Số lần về nhất / nhì / ba / tư ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Xếp hạng qua các ván</CardTitle>
          <CardDescription>
            Số lần đạt hạng 1, 2, 3 và 4 của từng người chơi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={rankChartConfig} className="relative z-10">
            <BarChart
              data={rankData}
              margin={{
                top: 30,
                right: 0,
                left: 0,
                bottom: 5,
              }}
            >
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
              <Bar dataKey="nhat" fill="var(--color-nhat)" radius={4}>
                <LabelList
                  dataKey="nhat"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
              <Bar dataKey="nhi" fill="var(--color-nhi)" radius={4}>
                <LabelList
                  dataKey="nhi"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
              <Bar dataKey="ba" fill="var(--color-ba)" radius={4}>
                <LabelList
                  dataKey="ba"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
              <Bar dataKey="tu" fill="var(--color-tu)" radius={4}>
                <LabelList
                  dataKey="tu"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
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

      {/* ── 3a. Sảnh — dương / âm riêng theo từng player ──────── */}
      <Card>
        <CardHeader>
          <CardTitle>Sảnh</CardTitle>
          <CardDescription>
            Tổng số sảnh thắng và thua của từng người chơi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={sanhChartConfig} className="relative z-10">
            <BarChart
              data={sanhData}
              margin={{
                top: 30,
                right: 0,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="duong" fill="var(--color-duong)" radius={4}>
                <LabelList
                  dataKey="duong"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
              <Bar dataKey="am" fill="var(--color-am)" radius={4}>
                <LabelList
                  dataKey="am"
                  position="bottom"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tổng hợp sảnh trong toàn bộ phiên
        </CardFooter>
      </Card>

      {/* ── 3b. Khạp — dương / âm riêng theo từng player ──────── */}
      <Card>
        <CardHeader>
          <CardTitle>Khạp</CardTitle>
          <CardDescription>
            Tổng số khạp thắng và thua của từng người chơi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={khapChartConfig} className="relative z-10">
            <BarChart
              data={khapData}
              margin={{
                top: 30,
                right: 0,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="duong" fill="var(--color-duong)" radius={4}>
                <LabelList
                  dataKey="duong"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
              <Bar dataKey="am" fill="var(--color-am)" radius={4}>
                <LabelList
                  dataKey="am"
                  position="bottom"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tổng hợp khạp trong toàn bộ phiên
        </CardFooter>
      </Card>

      {/* ── 3c. Heo đỏ & Heo đen — 4 cột riêng theo từng player ── */}
      <Card>
        <CardHeader>
          <CardTitle>Pig</CardTitle>
          <CardDescription>
            Tổng số heo đỏ và heo đen thắng/thua của từng người chơi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={pigChartConfig} className="relative z-10">
            <BarChart
              data={pigData}
              margin={{
                top: 30,
                right: 0,
                left: 0,
                bottom: 5,
              }}
              // barGap={0}
              barCategoryGap="12%"
              
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />

              <Bar dataKey="redDuong" fill="var(--color-redDuong)" radius={2} stroke="#f00" strokeWidth={1}>
                <LabelList
                  dataKey="redDuong"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground border-red-500 border-2"
                />
              </Bar>
              <Bar dataKey="redAm" fill="var(--color-redAm)" radius={2} stroke="#f00" strokeWidth={1}>
                <LabelList
                  dataKey="redAm"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
              <Bar
                dataKey="blackDuong"
                fill="var(--color-blackDuong)"
                radius={2}
                stroke="#000" strokeWidth={1}
              >
                <LabelList
                  dataKey="blackDuong"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
              <Bar dataKey="blackAm" fill="var(--color-blackAm)" radius={2} stroke="#000" strokeWidth={1}>
                <LabelList
                  dataKey="blackAm"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                
                />
              </Bar>
              {/* <ReferenceLine y={0} stroke="#fff" /> */}
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tổng hợp heo đỏ và heo đen trong toàn bộ phiên
        </CardFooter>
      </Card>
    </main>
  );
}
