import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "~/db/client.server";
import { gameConfigs } from "~/db/schema/game-configs";
import { rounds } from "~/db/schema/rounds";
import { roundResults } from "~/db/schema/round-results";
import { sessionTotals } from "~/db/schema/session-totals";
import { sessions } from "~/db/schema/sessions";
import { getIO } from "./socket.server";

export interface KhapSanhLimits {
  khapLimit: number;
  sanhLimit: number;
}

export interface LastRoundKhapSanh {
  accumulatedKhap: number;
  accumulatedSanh: number;
  hadKhap: boolean;
  hadSanh: boolean;
}

/** Tính khạp/sảnh tích lũy cho ván tiếp theo từ ván gần nhất. */
export function nextKhapSanhAccumulated(
  lastRound: LastRoundKhapSanh | null | undefined,
  limits: KhapSanhLimits,
) {
  if (!lastRound) {
    return { khap: 1, sanh: 1 };
  }

  return {
    khap: lastRound.hadKhap
      ? 1
      : Math.min(lastRound.accumulatedKhap + 1, limits.khapLimit),
    sanh: lastRound.hadSanh
      ? 1
      : Math.min(lastRound.accumulatedSanh + 1, limits.sanhLimit),
  };
}

export interface RoundResultInput {
  playerId: string;
  rank: number;
  score: number;
  khapno: number;
  sanhno: number;
  blackPigNo: number;
  redPigNo: number;
}

export interface SaveRoundResult {
  roundId: string;
  roundNo: number;
  totals: Array<{ playerId: string; totalScore: number }>;
  round: {
    id: string;
    roundNo: number;
    sessionId: string;
    createdBy: string;
    createdAt: Date;
    accumulatedKhap: number;
    accumulatedSanh: number;
    hadKhap: boolean;
    hadSanh: boolean;
  };
}

async function getKhapSanhLimits(sessionDbId: string) {
  const [config] = await db
    .select({
      khapLimit: gameConfigs.khapLimit,
      sanhLimit: gameConfigs.sanhLimit,
    })
    .from(gameConfigs)
    .where(eq(gameConfigs.sessionId, sessionDbId))
    .limit(1);

  return {
    khapLimit: config?.khapLimit ?? 5,
    sanhLimit: config?.sanhLimit ?? 3,
  };
}

export async function getRoundMeta(sessionDbId: string) {
  const limits = await getKhapSanhLimits(sessionDbId);

  const [lastRound] = await db
    .select({
      roundNo: rounds.roundNo,
      accumulatedKhap: rounds.accumulatedKhap,
      accumulatedSanh: rounds.accumulatedSanh,
      hadKhap: rounds.hadKhap,
      hadSanh: rounds.hadSanh,
      id: rounds.id,
    })
    .from(rounds)
    .where(eq(rounds.sessionId, sessionDbId))
    .orderBy(desc(rounds.roundNo))
    .limit(1);

  const accumulated = nextKhapSanhAccumulated(lastRound, limits);
  console.log("Calculated next round meta", {
    sessionDbId,
    limits,
    lastRound,
    accumulated,
  });
  return {
    currentRoundNo: (lastRound?.roundNo ?? 0) + 1,
    accumulated,
    roundId: lastRound?.id,
  };
}

export async function saveRound(
  sessionCode: string,
  createdBy: string,
  results: RoundResultInput[],
): Promise<SaveRoundResult> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  if (results.length === 0) {
    throw new Response("Round results required", { status: 400 });
  }

  const hadKhap = results.some((r) => r.khapno > 0);
  const hadSanh = results.some((r) => r.sanhno > 0);

  const saved = await db.transaction(async (tx) => {
    const [config] = await tx
      .select({
        khapLimit: gameConfigs.khapLimit,
        sanhLimit: gameConfigs.sanhLimit,
      })
      .from(gameConfigs)
      .where(eq(gameConfigs.sessionId, session.id))
      .limit(1);

    const limits = {
      khapLimit: config?.khapLimit ?? 5,
      sanhLimit: config?.sanhLimit ?? 3,
    };

    const [lastRound] = await tx
      .select({
        accumulatedKhap: rounds.accumulatedKhap,
        accumulatedSanh: rounds.accumulatedSanh,
        hadKhap: rounds.hadKhap,
        hadSanh: rounds.hadSanh,
      })
      .from(rounds)
      .where(eq(rounds.sessionId, session.id))
      .orderBy(desc(rounds.roundNo))
      .limit(1);

    const accumulated = nextKhapSanhAccumulated(lastRound, limits);

    const [{ nextRoundNo }] = await tx
      .select({
        nextRoundNo: sql<number>`coalesce(max(${rounds.roundNo}), 0) + 1`,
      })
      .from(rounds)
      .where(eq(rounds.sessionId, session.id));

    const [round] = await tx
      .insert(rounds)
      .values({
        sessionId: session.id,
        roundNo: nextRoundNo,
        createdBy,
        accumulatedKhap: accumulated.khap,
        accumulatedSanh: accumulated.sanh,
        hadKhap,
        hadSanh,
      })
      .returning();

    await tx.insert(roundResults).values(
      results.map((r) => ({
        roundId: round.id,
        playerId: r.playerId,
        rank: r.rank,
        score: r.score,
        khapno: r.khapno,
        sanhno: r.sanhno,
        blackPigNo: r.blackPigNo,
        redPigNo: r.redPigNo,
      })),
    );

    const totals: Array<{ playerId: string; totalScore: number }> = [];

    for (const r of results) {
      const [existing] = await tx
        .select()
        .from(sessionTotals)
        .where(
          and(
            eq(sessionTotals.sessionId, session.id),
            eq(sessionTotals.playerId, r.playerId),
          ),
        )
        .limit(1);

      const newTotal = (existing?.totalScore ?? 0) + r.score;

      if (existing) {
        await tx
          .update(sessionTotals)
          .set({ totalScore: newTotal, updatedAt: new Date() })
          .where(eq(sessionTotals.id, existing.id));
      } else {
        await tx.insert(sessionTotals).values({
          sessionId: session.id,
          playerId: r.playerId,
          totalScore: newTotal,
        });
      }

      totals.push({ playerId: r.playerId, totalScore: newTotal });
    }

    return { roundId: round.id, roundNo: round.roundNo, round, totals };
  });

  // const io = getIO();
  // if (io) {
  //   const room = `session:${sessionCode}`;
  //   io.to(room).emit("round-finished", {
  //     sessionId: session.id,
  //     sessionCode,
  //     roundNo: saved.roundNo,
  //     results: results.map((r) => ({
  //       playerId: r.playerId,
  //       rank: r.rank,
  //       score: r.score,
  //     })),
  //     timestamp: new Date(),
  //   });
  //   io.to(room).emit("score-updated", {
  //     totalScores: saved.totals,
  //     timestamp: new Date(),
  //   });
  // }

  return saved;
}

export async function deleteRound(
  sessionCode: string,
  roundId: string,
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  await db.transaction(async (tx) => {
    // Kiểm tra ván thuộc session hiện tại
    const [round] = await tx
      .select()
      .from(rounds)
      .where(and(eq(rounds.id, roundId), eq(rounds.sessionId, session.id)))
      .limit(1);

    if (!round) {
      throw new Response("Round not found in this session", { status: 404 });
    }

    // Lấy kết quả của ván để hoàn trả điểm
    const results = await tx
      .select()
      .from(roundResults)
      .where(eq(roundResults.roundId, roundId));

    // Hoàn trả điểm cho từng người chơi
    for (const r of results) {
      const [existing] = await tx
        .select()
        .from(sessionTotals)
        .where(
          and(
            eq(sessionTotals.sessionId, session.id),
            eq(sessionTotals.playerId, r.playerId),
          ),
        )
        .limit(1);

      if (existing) {
        await tx
          .update(sessionTotals)
          .set({
            totalScore: existing.totalScore - r.score,
            updatedAt: new Date(),
          })
          .where(eq(sessionTotals.id, existing.id));
      }
    }

    // Xóa theo thứ tự: roundResults trước, sau đó rounds (tránh FK violation)
    await tx.delete(roundResults).where(eq(roundResults.roundId, roundId));
    await tx.delete(rounds).where(eq(rounds.id, roundId));
  });
}
