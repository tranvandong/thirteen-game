"use client";

import { useParams } from "react-router";
import type { Route } from "./+types/history";
import { db } from "~/db/client.server";
import { rounds } from "~/db/schema/rounds";
import { eq } from "drizzle-orm";

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId } = params;

  const roundList = await db.query.rounds.findMany({
    where: eq(rounds.sessionId, sessionId as any),
    orderBy: rounds.roundNo,
  });

  return { roundList };
}

export default function HistoryPage({ loaderData }: Route.ComponentProps) {
  const { sessionId } = useParams();

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Lịch Sử Ván Đấu</h1>
        <div className="space-y-3">
          {loaderData.roundList.map((round: any) => (
            <a
              key={round.id}
              href={`/session/${sessionId}/history/${round.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg text-gray-800">Ván #{round.roundNo}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(round.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">→</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
