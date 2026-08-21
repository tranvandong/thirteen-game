"use client";

import { useState, useEffect } from "react";
import { useParams } from "react-router";
import type { Route } from "./+types/score-board";
import { db } from "~/db/client.server";
import { players } from "~/db/schema/players";
import { sessionTotals } from "~/db/schema/session-totals";
import { eq } from "drizzle-orm";
import { onScoreUpdated, offScoreUpdated } from "~/lib/socket.client";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const playerList = await db.query.players.findMany({
    where: eq(players.sessionId, sessionId as any),
    orderBy: players.orderNo,
  });

  const totals = await db.query.sessionTotals.findMany({
    where: eq(sessionTotals.sessionId, sessionId as any),
  });

  const sorted = playerList
    .map((p: any) => ({
      ...p,
      totalScore: totals.find((t: any) => t.playerId === p.id)?.totalScore || 0,
    }))
    .sort((a: any, b: any) => b.totalScore - a.totalScore);

  return { playerList: sorted };
}

export default function ScoreBoardPage({ loaderData }: Route.ComponentProps) {
  const { sessionId } = useParams();
  const [players, setPlayers] = useState(loaderData.playerList);

  useEffect(() => {
    const handler = ({
      totals,
    }: {
      totals: Array<{ playerId: string; totalScore: number }>;
    }) => {
      const map = new Map(totals.map((t) => [t.playerId, t.totalScore]));
      const sorted = loaderData.playerList
        .map((p: any) => ({
          ...p,
          totalScore: map.get(p.id) ?? p.totalScore,
        }))
        .sort((a: any, b: any) => b.totalScore - a.totalScore);
      setPlayers(sorted);
    };

    onScoreUpdated(handler);
    return () => offScoreUpdated(handler);
  }, [loaderData.playerList]);

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Bảng Điểm</h1>
        <div className="space-y-3">
          {players.map((player: any, index: number) => (
            <div
              key={player.id}
              className="flex items-center justify-between bg-white rounded-lg shadow p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {index + 1}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">{player.name}</p>
                </div>
              </div>
              <p
                className={`text-3xl font-bold ${
                  player.totalScore >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {player.totalScore}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
