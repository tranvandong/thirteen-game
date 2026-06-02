"use client";

import { useParams } from "react-router";
// import type { Route } from "./+types/history";
// import { db } from "~/db/client.server";
// import { rounds } from "~/db/schema/rounds";
// import { eq } from "drizzle-orm";
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

// Mock data for UI development
const mockPlayers = [
  { id: "p1", name: "Nguoi Choi 1", shortName: "NC1" },
  { id: "p2", name: "Nguoi Choi 2", shortName: "NC2" },
  { id: "p3", name: "Nguoi Choi 3", shortName: "NC3" },
  { id: "p4", name: "Nguoi Choi 4", shortName: "NC4" },
];

const mockRounds = [
  {
    id: "r1",
    roundNo: 1,
    scores: [10, -5, 5, -10],
    khap: 2,
    sanh: 1,
    createdAt: new Date("2024-01-15T10:30:00"),
  },
  {
    id: "r2",
    roundNo: 2,
    scores: [-15, 20, -5, 0],
    khap: 1,
    sanh: 0,
    createdAt: new Date("2024-01-15T10:45:00"),
  },
  {
    id: "r3",
    roundNo: 3,
    scores: [5, -10, 15, -10],
    khap: 0,
    sanh: 2,
    createdAt: new Date("2024-01-15T11:00:00"),
  },
  {
    id: "r4",
    roundNo: 4,
    scores: [20, 5, -15, -10],
    khap: 3,
    sanh: 1,
    createdAt: new Date("2024-01-15T11:15:00"),
  },
  {
    id: "r5",
    roundNo: 5,
    scores: [-10, 10, 5, -5],
    khap: 1,
    sanh: 0,
    createdAt: new Date("2024-01-15T11:30:00"),
  },
];

// export async function loader({ params }: Route.LoaderArgs) {
//   const { sessionId } = params;

//   const roundList = await db.query.rounds.findMany({
//     where: eq(rounds.sessionId, sessionId as any),
//     orderBy: rounds.roundNo,
//   });

//   return { roundList };
// }

export default function HistoryPage() {
  const { sessionId } = useParams();

  // Calculate totals for each player
  const playerTotals = mockPlayers.map((_, index) => {
    return mockRounds.reduce((sum, round) => sum + round.scores[index], 0);
  });

  // Calculate total khap and sanh
  const totalKhap = mockRounds.reduce((sum, round) => sum + round.khap, 0);
  const totalSanh = mockRounds.reduce((sum, round) => sum + round.sanh, 0);

  const ScoreCell = ({ score }: { score: number }) => (
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

  return (
    <main className="p-4 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
              <History className="size-4" />
            </div>
            Lich Su Van Dau
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-center w-12 sticky left-0 bg-muted/50 z-10">
                    Van
                  </TableHead>
                  {mockPlayers.map((player) => (
                    <TableHead
                      key={player.id}
                      className="text-center min-w-[60px]"
                    >
                      <span className="hidden sm:inline">{player.name}</span>
                      <span className="sm:hidden">{player.shortName}</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[50px]">
                    Khap
                  </TableHead>
                  <TableHead className="text-center min-w-[50px]">
                    Sanh
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRounds.map((round) => (
                  <TableRow key={round.id} className="hover:bg-muted/30">
                    <TableCell className="text-center font-bold sticky left-0 bg-background z-10">
                      {round.roundNo}
                    </TableCell>
                    {round.scores.map((score, index) => (
                      <TableCell key={index} className="text-center">
                        <ScoreCell score={score} />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-chart-4/20 text-chart-4 text-xs font-medium">
                        {round.khap}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-chart-1/20 text-chart-1 text-xs font-medium">
                        {round.sanh}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted font-bold">
                  <TableCell className="text-center sticky left-0 bg-muted z-10">
                    Tong
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
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-full bg-chart-4/30 text-chart-4 text-sm font-bold">
                      {totalKhap}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-full bg-chart-1/30 text-chart-1 text-sm font-bold">
                      {totalSanh}
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-chart-4/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">{totalKhap}</p>
            <p className="text-sm text-muted-foreground">Tong So Khap</p>
          </CardContent>
        </Card>
        <Card className="border-chart-1/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-1">{totalSanh}</p>
            <p className="text-sm text-muted-foreground">Tong So Sanh</p>
          </CardContent>
        </Card>
      </div>

      {/* Round Count */}
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-3xl font-bold text-primary">{mockRounds.length}</p>
          <p className="text-sm text-muted-foreground">Tong So Van Da Choi</p>
        </CardContent>
      </Card>
    </main>
  );
}
