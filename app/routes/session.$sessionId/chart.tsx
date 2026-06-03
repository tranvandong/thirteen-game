"use client";

import { useParams } from "react-router";
// import type { Route } from "./+types/chart";
// import { db } from "~/db/client.server";
// import { rounds } from "~/db/schema/rounds";
// import { players } from "~/db/schema/players";
// import { eq } from "drizzle-orm";
import { TrendingUp, BarChart2 } from "lucide-react";
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

// Mock data
const mockPlayers = [
  { id: "p1", name: "Nguoi Choi 1", shortName: "NC1" },
  { id: "p2", name: "Nguoi Choi 2", shortName: "NC2" },
  { id: "p3", name: "Nguoi Choi 3", shortName: "NC3" },
  { id: "p4", name: "Nguoi Choi 4", shortName: "NC4" },
];

// Điểm tích lũy qua từng ván (cộng dồn)
const mockRoundScores = [
  { van: "Van 1", p1: 3, p2: -3, p3: 1, p4: -1 },
  { van: "Van 2", p1: 6, p2: -4, p3: 0, p4: -2 },
  { van: "Van 3", p1: 7, p2: -5, p3: 3, p4: -5 },
  { van: "Van 4", p1: 10, p2: -2, p3: 2, p4: -10 },
  { van: "Van 5", p1: 9, p2: 1, p3: 3, p4: -13 },
  { van: "Van 6", p1: 12, p2: 4, p3: 0, p4: -16 },
];

// Số lần về nhất / về tư
const mockRankData = [
  { name: "NC1", nhat: 4, tu: 0 },
  { name: "NC2", nhat: 1, tu: 1 },
  { name: "NC3", nhat: 1, tu: 2 },
  { name: "NC4", nhat: 0, tu: 3 },
];

// Số lượng sảnh / khạp
const mockBonusData = [
  { name: "NC1", sanh: 2, khap: 3 },
  { name: "NC2", sanh: 1, khap: 1 },
  { name: "NC3", sanh: 0, khap: 2 },
  { name: "NC4", sanh: 1, khap: 0 },
];

// ── Chart configs ────────────────────────────────────────────
const lineChartConfig = {
  p1: { label: mockPlayers[0].name, color: "var(--chart-1)" },
  p2: { label: mockPlayers[1].name, color: "var(--chart-2)" },
  p3: { label: mockPlayers[2].name, color: "var(--chart-3)" },
  p4: { label: mockPlayers[3].name, color: "var(--chart-4)" },
} satisfies ChartConfig;

const rankChartConfig = {
  nhat: { label: "Ve nhat", color: "var(--chart-4)" },
  tu: { label: "Ve tu", color: "var(--destructive)" },
} satisfies ChartConfig;

const bonusChartConfig = {
  sanh: { label: "Sanh", color: "var(--chart-1)" },
  khap: { label: "Khap", color: "var(--chart-4)" },
} satisfies ChartConfig;

// Tổng điểm mỗi người chơi
const mockTotalScores = [
  { name: "NC1", diem: 20 },
  { name: "NC2", diem: 4 },
  { name: "NC3", diem: -8 },
  { name: "NC4", diem: -16 },
];

const totalScoreConfig = {
  diem: { label: "Tong diem" },
} satisfies ChartConfig;

// ── Loader ───────────────────────────────────────────────────
export async function loader() {
  return {};
}

// ── Component ────────────────────────────────────────────────
export default function ChartPage() {
  const { sessionId } = useParams();

  return (
    <main className="p-4 flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
          <BarChart2 className="size-4" />
        </div>
        <h1 className="text-lg font-semibold">Bieu Do</h1>
      </div>

      {/* ── 1. Điểm tích lũy qua các ván ─────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Diem tich luy</CardTitle>
          <CardDescription>Diem cong don qua tung van dau</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineChartConfig}>
            <LineChart data={mockRoundScores} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="van"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => v.replace("Van ", "V")}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={28}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {mockPlayers.map((p) => (
                <Line
                  key={p.id}
                  dataKey={p.id}
                  type="monotone"
                  stroke={`var(--color-${p.id})`}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Tong {mockRoundScores.length} van dau da hoan thanh
        </CardFooter>
      </Card>

      {/* ── 2. Số lần về nhất / về tư ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Ve nhat & Ve tu</CardTitle>
          <CardDescription>So lan dat hang 1 va hang 4</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={rankChartConfig}>
            <BarChart data={mockRankData}>
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
        <CardFooter className="flex gap-2 text-sm">
          <div className="flex items-center gap-1 text-chart-4 font-medium">
            <TrendingUp className="size-4" />
            NC1 dan dau so lan ve nhat
          </div>
        </CardFooter>
      </Card>

      {/* ── 3. Số lượng sảnh / khạp ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Sanh & Khap</CardTitle>
          <CardDescription>
            So luong sanh va khap cua tung nguoi choi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={bonusChartConfig}>
            <BarChart data={mockBonusData}>
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
          Tong hop sanh va khap trong toan bo phien
        </CardFooter>
      </Card>

      {/* ── 4. Tổng điểm mỗi người chơi ─────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Tong diem</CardTitle>
          <CardDescription>
            Tong diem tich luy cua tung nguoi choi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={totalScoreConfig}>
            <BarChart accessibilityLayer data={mockTotalScores}>
              <CartesianGrid vertical={false} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel hideIndicator />}
              />
              <Bar dataKey="diem">
                <LabelList position="top" dataKey="name" fillOpacity={1} />
                {mockTotalScores.map((item) => (
                  <Cell
                    key={item.name}
                    fill={
                      item.diem >= 0 ? "var(--chart-2)" : "var(--destructive)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </main>
  );
}
