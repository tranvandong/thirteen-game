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
import {
  TrendingUp,
  BarChart2,
  TrendingDown,
  Crown,
  Activity,
  Flame,
  Spade,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  LabelList,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
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

// ── Tiện ích hiển thị cho bảng Heo (chặt heo) ────────────────
const AVATAR_CLS = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
];

// Ô nhỏ: số đếm + thanh mini tô màu (xanh = thắng, đỏ = thua)
function PigMiniStat({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: "win" | "loss";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  const colorText = tone === "win" ? "text-chart-2" : "text-destructive";
  const colorBar = tone === "win" ? "bg-chart-2" : "bg-destructive";
  return (
    <td className="px-1 py-2 text-center align-middle">
      <div className={`text-sm font-bold tabular-nums ${colorText}`}>{value}</div>
      <div className="mx-auto mt-1 h-1 w-7 rounded-full bg-muted">
        <div
          className={`h-1 rounded-full ${colorBar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </td>
  );
}

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

  // 5. Đếm số lần về nhất/nhì/ba/tư theo từng player
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

  // 6. Tổng hợp thưởng phụ (sảnh / khạp / heo đỏ / heo đen)
  //    Lưu ý: các cột này lưu SỐ LƯỢNG có dấu (dương = thắng, âm = thua),
  //    không phải điểm. Điểm được tính sau qua game_config.
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

  // ── Chart 1: Điểm tích lũy qua từng ván ──
  const playerIdToKey = (id: string) => {
    const idx = sessionPlayers.findIndex((p) => p.id === id);
    return idx >= 0 ? `p${idx + 1}` : null;
  };

  const cumulativeMap: Record<number, Record<string, string | number>> = {};
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

  // ── Chart 3a: Sảnh — số lượng thắng / thua ──
  const sanhData = sessionPlayers.map((p) => {
    const sums = bonusSumMap.get(p.id);
    return {
      name: p.name,
      duong: sums?.sanhDuong ?? 0,
      am: sums?.sanhAm ?? 0,
    };
  });

  // ── Chart 3b: Khạp — số lượng thắng / thua ──
  const khapData = sessionPlayers.map((p) => {
    const sums = bonusSumMap.get(p.id);
    return {
      name: p.name,
      duong: sums?.khapDuong ?? 0,
      am: sums?.khapAm ?? 0,
    };
  });

  // ── Chart 3c: Heo — SỐ LƯỢNG heo đỏ / đen thắng & thua (mới) ──
  //    redPigNo / blackPigNo lưu số lượng có dấu:
  //    dương = chặt được (thắng), âm = bị chặt (thua).
  const pigData = sessionPlayers.map((p) => {
    const sums = bonusSumMap.get(p.id);
    return {
      name: p.name,
      // dương (thắng) vẽ lên, âm (thua) giữ nguyên để vẽ xuống dưới
      doThang: sums?.redPigDuong ?? 0,
      doThua: sums?.redPigAm ?? 0,
      denThang: sums?.blackPigDuong ?? 0,
      denThua: sums?.blackPigAm ?? 0,
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

  // ── Chart 5: Điểm trung bình mỗi ván ──
  const avgData = sessionPlayers.map((p) => {
    const total = totals.find((t) => t.playerId === p.id)?.totalScore ?? 0;
    const counts = rankCountMap.get(p.id) ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
    const games = counts[1] + counts[2] + counts[3] + counts[4];
    return {
      name: p.name,
      avg: games > 0 ? Math.round((total / games) * 10) / 10 : 0,
      games,
    };
  });

  // ── Chart 6: Tỷ lệ xếp hạng (win-rate %) ──
  const winRateData = sessionPlayers.map((p) => {
    const counts = rankCountMap.get(p.id) ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
    const games = counts[1] + counts[2] + counts[3] + counts[4];
    const pct = (n: number) => (games > 0 ? Math.round((n / games) * 100) : 0);
    return {
      name: p.name,
      nhat: pct(counts[1]),
      nhi: pct(counts[2]),
      ba: pct(counts[3]),
      tu: pct(counts[4]),
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
    avgData,
    winRateData,
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
    avgData,
    winRateData,
  } = loaderData;

  // ── Empty state ──
  if (roundCount === 0) {
    return (
      <main className="p-4 flex flex-col gap-4 pb-6">
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
            <BarChart2 className="size-4" />
          </div>
          <h1 className="text-lg font-semibold">Biểu Đồ</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BarChart2 className="size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              Chưa có dữ liệu thống kê
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Hãy hoàn thành ít nhất một ván đấu để xem biểu đồ điểm tích lũy,
              xếp hạng và các chỉ số phụ.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Màu nhất quán giữa line, radar và legend
  const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
  ];

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

  const avgChartConfig = {
    avg: { label: "Điểm TB/ván", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  const winRateChartConfig = rankChartConfig;

  const totalScoreConfig = {
    diem: { label: "Tổng điểm", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  // Radar: hồ sơ người chơi (các chỉ số được chuẩn hóa 0-100)
  const maxAvg = Math.max(1, ...avgData.map((a) => a.avg));
  const netBonusByPlayer = players.map((_, i) => {
    const s = sanhData[i].duong + sanhData[i].am;
    const k = khapData[i].duong + khapData[i].am;
    const pg = pigData[i].doThang + pigData[i].doThua + pigData[i].denThang + pigData[i].denThua;
    return s + k + pg;
  });
  const maxBonus = Math.max(
    1,
    ...netBonusByPlayer.map((n) => Math.max(0, n)),
  );

  const playerMetric = (fn: (i: number) => number) =>
    Object.fromEntries(players.map((_, i) => [`p${i + 1}`, fn(i)]));

  const radarData = [
    {
      metric: "Về nhất",
      ...playerMetric((i) => winRateData[i].nhat),
    },
    {
      metric: "Top 2",
      ...playerMetric((i) => winRateData[i].nhat + winRateData[i].nhi),
    },
    {
      metric: "Điểm TB",
      ...playerMetric((i) =>
        Math.round((avgData[i].avg / maxAvg) * 100),
      ),
    },
    {
      metric: "Thưởng",
      ...playerMetric((i) =>
        Math.round((Math.max(0, netBonusByPlayer[i]) / maxBonus) * 100),
      ),
    },
  ];

  const radarChartConfig = Object.fromEntries(
    players.map((p, i) => [
      `p${i + 1}`,
      { label: p.name, color: CHART_COLORS[i % CHART_COLORS.length] },
    ]),
  ) satisfies ChartConfig;

  // ── KPI insights ──
  const leader = totalScores.reduce(
    (best, cur) => (cur.diem > (best?.diem ?? -Infinity) ? cur : best),
    totalScores[0],
  );
  const topRank = rankData.reduce(
    (best, cur) => (cur.nhat > (best?.nhat ?? -1) ? cur : best),
    rankData[0],
  );
  const topRank2 = rankData.reduce(
    (best, cur) => (cur.tu > (best?.tu ?? -1) ? cur : best),
    rankData[0],
  );
  const topAvg = avgData.reduce(
    (best, cur) => (cur.avg > (best?.avg ?? -Infinity) ? cur : best),
    avgData[0],
  );
  const totalPool = totalScores.reduce((sum, t) => sum + t.diem, 0);

  const kpis: {
    label: string;
    name?: string;
    value: string;
    icon: typeof Crown;
    cls: string;
  }[] = [
    {
      label: "Dẫn đầu",
      name: leader?.name,
      value: leader ? `${leader.diem}` : "—",
      icon: Crown,
      cls: "bg-chart-2/10 text-chart-2",
    },
    {
      label: "Về nhất nhiều nhất",
      name: topRank?.name,
      value: topRank ? `${topRank.nhat} lần` : "—",
      icon: TrendingUp,
      cls: "bg-chart-4/10 text-chart-4",
    },
    {
      label: "Về tư nhiều nhất",
      name: topRank2?.name,
      value: topRank2 ? `${topRank2.tu} lần` : "—",
      icon: TrendingDown,
      cls: "bg-destructive/10 text-destructive",
    },
    {
      label: "Điểm TB/ván cao nhất",
      name: topAvg?.name,
      value: topAvg ? `${topAvg.avg}` : "—",
      icon: Activity,
      cls: "bg-chart-1/10 text-chart-1",
    },
  ];

  // Tổng heo toàn bàn (để hiển thị ở footer chart Heo)
  const totalRedThang = pigData.reduce((s, d) => s + d.doThang, 0);
  const totalRedThua = pigData.reduce((s, d) => s + Math.abs(d.doThua), 0);
  const totalDenThang = pigData.reduce((s, d) => s + d.denThang, 0);
  const totalDenThua = pigData.reduce((s, d) => s + Math.abs(d.denThua), 0);

  // Mức tối đa mỗi chỉ số — dùng để tỷ lệ thanh mini trong bảng Heo
  const maxRedWon = Math.max(1, ...pigData.map((d) => d.doThang));
  const maxRedLost = Math.max(1, ...pigData.map((d) => Math.abs(d.doThua)));
  const maxBlackWon = Math.max(1, ...pigData.map((d) => d.denThang));
  const maxBlackLost = Math.max(1, ...pigData.map((d) => Math.abs(d.denThua)));

  return (
    <main className="p-4 flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
          <BarChart2 className="size-4" />
        </div>
        <h1 className="text-lg font-semibold">Biểu Đồ</h1>
      </div>

      {/* ── KPI insights ── */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="border-border/70">
              <CardContent className="flex items-center gap-3 p-3">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${k.cls}`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="truncate text-sm font-bold text-foreground">
                    {k.name}
                  </p>
                  <p className={`text-xs font-semibold ${k.cls}`}>
                    {k.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── 0. Tổng điểm (nâng cấp từ chart cũ) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Tổng điểm</CardTitle>
          <CardDescription>
            Tổng điểm tích lũy của từng người chơi sau {roundCount} ván
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={totalScoreConfig} className="relative z-10">
            <BarChart
              data={totalScores}
              margin={{ top: 20, right: 0, left: 0, bottom: 5 }}
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
              <Bar dataKey="diem" fill="var(--color-diem)" radius={4}>
                <LabelList
                  dataKey="diem"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tổng điểm toàn bàn: {totalPool} điểm
        </CardFooter>
      </Card>

      {/* ── 1. Điểm tích lũy (đã sửa: màu đồng bộ, hiện nhãn trục X) ── */}
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
                tickFormatter={(v: string) => v.replace("Ván ", "")}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={4} width={28} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {players.map((p, i) => (
                <Line
                  key={p.id}
                  dataKey={`p${i + 1}`}
                  type="monotone"
                  stroke={`var(--color-p${i + 1})`}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tổng {roundCount} ván đấu đã hoàn thành
        </CardFooter>
      </Card>

      {/* ── 2. Tỷ lệ xếp hạng (win-rate 100% stacked) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Tỷ lệ xếp hạng</CardTitle>
          <CardDescription>
            Phần trăm các hạng đạt được trong tổng số ván tham gia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={winRateChartConfig} className="relative z-10">
            <BarChart
              data={winRateData}
              margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
              stackOffset="expand"
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={28}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="nhat" stackId="a" fill="var(--color-nhat)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="nhi" stackId="a" fill="var(--color-nhi)" />
              <Bar dataKey="ba" stackId="a" fill="var(--color-ba)" />
              <Bar dataKey="tu" stackId="a" fill="var(--color-tu)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Chuẩn hóa theo số ván mỗi người tham gia
        </CardFooter>
      </Card>

      {/* ── 3. Điểm trung bình mỗi ván ── */}
      <Card>
        <CardHeader>
          <CardTitle>Điểm trung bình mỗi ván</CardTitle>
          <CardDescription>
            Tổng điểm chia cho số ván tham gia — so sánh công bằng khi vào muộn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={avgChartConfig} className="relative z-10">
            <BarChart
              data={avgData}
              margin={{ top: 20, right: 0, left: 0, bottom: 5 }}
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
              <Bar dataKey="avg" fill="var(--color-avg)" radius={4}>
                <LabelList
                  dataKey="avg"
                  position="top"
                  fontSize={12}
                  className="text-card-foreground"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Trung bình toàn bàn:{" "}
          {avgData.length > 0
            ? `${Math.round(
                (avgData.reduce((s, a) => s + a.avg, 0) / avgData.length) * 10,
              ) / 10}`
            : "0"}{" "}
          điểm/ván
        </CardFooter>
      </Card>

      {/* ── 4. Hồ sơ người chơi (radar) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Hồ sơ người chơi</CardTitle>
          <CardDescription>
            So sánh các chỉ số (chuẩn hóa 0–100): về nhất, top 2, điểm TB, thưởng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={radarChartConfig} className="relative z-10">
            <RadarChart data={radarData}>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              {players.map((p, i) => (
                <Radar
                  key={p.id}
                  dataKey={`p${i + 1}`}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.08}
                  strokeWidth={2}
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ── 5. Xếp hạng qua các ván ── */}
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
              margin={{ top: 30, right: 0, left: 0, bottom: 5 }}
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
      </Card>

      {/* ── 6a. Sảnh — số lượng thắng / thua ── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-1">
              <Spade className="size-4 text-chart-1" /> Sảnh
            </span>
          </CardTitle>
          <CardDescription>
            Số lần thắng và thua sảnh của từng người chơi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={sanhChartConfig} className="relative z-10">
            <BarChart
              data={sanhData}
              margin={{ top: 30, right: 0, left: 0, bottom: 5 }}
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

      {/* ── 6b. Khạp — số lượng thắng / thua ── */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-1">
              <Flame className="size-4 text-chart-4" /> Khạp
            </span>
          </CardTitle>
          <CardDescription>
            Số lần thắng và thua khạp của từng người chơi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={khapChartConfig} className="relative z-10">
            <BarChart
              data={khapData}
              margin={{ top: 30, right: 0, left: 0, bottom: 5 }}
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

      {/* ── 6c. Heo — bảng lai: số lượng + thanh mini (mới) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Heo (chặt heo)</CardTitle>
          <CardDescription>
            Số lượng heo đỏ / đen chặt được (thắng) và bị chặt (thua). T = thắng,
            Th = thua.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2 text-left font-medium">Người</th>
                  <th className="px-1 py-2 text-center font-medium text-chart-2">
                    Đỏ T
                  </th>
                  <th className="px-1 py-2 text-center font-medium text-destructive">
                    Đỏ Th
                  </th>
                  <th className="px-1 py-2 text-center font-medium text-chart-2">
                    Đen T
                  </th>
                  <th className="px-1 py-2 text-center font-medium text-destructive">
                    Đen Th
                  </th>
                  <th className="px-1 py-2 text-center font-medium">Hiệu</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => {
                  const d = pigData[i];
                  const won = d.doThang + d.denThang;
                  const lost = Math.abs(d.doThua) + Math.abs(d.denThua);
                  const hieu = won - lost;
                  return (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${AVATAR_CLS[i % AVATAR_CLS.length]}`}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate text-xs font-medium">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <PigMiniStat
                        value={d.doThang}
                        max={maxRedWon}
                        tone="win"
                      />
                      <PigMiniStat
                        value={Math.abs(d.doThua)}
                        max={maxRedLost}
                        tone="loss"
                      />
                      <PigMiniStat
                        value={d.denThang}
                        max={maxBlackWon}
                        tone="win"
                      />
                      <PigMiniStat
                        value={Math.abs(d.denThua)}
                        max={maxBlackLost}
                        tone="loss"
                      />
                      <td className="px-1 py-2 text-center align-middle">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            hieu > 0
                              ? "text-chart-2"
                              : hieu < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {hieu > 0 ? `+${hieu}` : hieu}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>
            Tổng heo đỏ: thắng {totalRedThang} / thua {totalRedThua} — Tổng heo
            đen: thắng {totalDenThang} / thua {totalDenThua}
          </span>
          <span>
            Cả bàn: đỏ {totalRedThang + totalRedThua} con, đen{" "}
            {totalDenThang + totalDenThua} con
          </span>
        </CardFooter>
      </Card>
    </main>
  );
}
