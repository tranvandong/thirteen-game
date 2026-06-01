"use client";

import { useParams } from "react-router";
import type { Route } from "./+types/round-detail";
import { db } from "~/db/client.server";
import { rounds } from "~/db/schema/rounds";
import { roundResults } from "~/db/schema/round-results";
import { players } from "~/db/schema/players";
import { eq } from "drizzle-orm";

export async function loader({ params }: Route.LoaderArgs) {
  const { roundId } = params;

  const round = await db.query.rounds.findFirst({
    where: eq(rounds.id, roundId as any),
  });

  if (!round) {
    throw new Response("Round not found", { status: 404 });
  }

  const results = await db.query.roundResults.findMany({
    where: eq(roundResults.roundId, roundId as any),
  });

  const playerMap = await db.query.players.findMany({
    where: eq(players.sessionId, round.sessionId as any),
  });

  const detailedResults = results.map((r: any) => ({
    ...r,
    playerName: playerMap.find((p: any) => p.id === r.playerId)?.name || "Unknown",
  }));

  return { round, results: detailedResults };
}

export default function RoundDetailPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Ván #{loaderData.round.roundNo}
        </h1>
        <div className="space-y-3">
          {loaderData.results.map((result: any) => (
            <div
              key={result.id}
              className="bg-white rounded-lg shadow p-6 flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-gray-800">{result.playerName}</p>
                <p className="text-sm text-gray-600">Hạng {result.rank}</p>
              </div>
              <p className={`text-2xl font-bold ${result.score >= 0 ? "text-green-600" : "text-red-600"}`}>
                {result.score > 0 ? "+" : ""}{result.score}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
