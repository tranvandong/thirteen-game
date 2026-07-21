import type { Player } from "~/stores/useSessionStore";
import type { ChatHeo, GameConfigs, NhotBai } from "~/types/match.type";

// ── Score computation ─────────────────────────────────────
export const computedScoresHelper = ({
  players,
  ranking,
  activeNhot,
  gameConfig,
  nhotCount,
  nhotterId,
  nhotVictimIds,
  nhotOthers,
  khapWinner,
  khapCount,
  sanhWinner,
  chatHeoList,
  accumulated,
  denBaiLosses,
}: {
  players: Player[];
  ranking: string[];
  activeNhot: NhotBai;
  gameConfig: GameConfigs;
  nhotCount: number;
  nhotterId: string;
  nhotVictimIds: string[];
  nhotOthers: string[];
  khapWinner: string | null;
  khapCount: number;
  sanhWinner: string | null;
  chatHeoList: ChatHeo[];
  accumulated: { khap: number; sanh: number };
  denBaiLosses: { [key: string]: number };
}): Record<string, number> => {
  const s: Record<string, number> = Object.fromEntries(
    players.map((p) => [p.id, 0]),
  );
  const heoPts = (heo: { do: number; den: number }) =>
    heo.den * gameConfig.heodenPoints + heo.do * gameConfig.heoDoPoints;

  if (!activeNhot) {
    ranking.forEach((pid, i) => {
      s[pid] += gameConfig.rankPoints[i] ?? 0;
    });
  } else {
    const ecPts = Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
    const victimHeoMap = Object.fromEntries(
      activeNhot.victims.map((v) => [v.victimId, v.heo]),
    );

    if (nhotCount === 1) {
      const vh = (victimHeoMap[nhotVictimIds[0]] as
        | { do: number; den: number }
        | undefined) ?? { do: 0, den: 0 };
      const hp = heoPts(vh);
      s[nhotterId!] += gameConfig.rankPoints[0] * 2 + hp;
      s[nhotVictimIds[0]] -= gameConfig.rankPoints[0] * 2 + hp;
      const othersInRanking = ranking.filter((id) => nhotOthers.includes(id));
      othersInRanking.forEach((oid, i) => {
        s[oid] += gameConfig.rankPoints[i + 1] ?? 0;
      });
    } else if (nhotCount === 2) {
      let gain = 0;

      activeNhot.victims.forEach(({ victimId, heo }) => {
        const loss = ecPts + heoPts(heo);
        s[victimId] -= loss;
        gain += loss;
      });

      if (activeNhot.dennerId && activeNhot.denForIds.length > 0) {
        const denBaiLoss = activeNhot.denForIds.reduce(
          (sum, victimId) => sum + (denBaiLosses[victimId] ?? 0),
          0,
        );

        activeNhot.denForIds.forEach((victimId) => {
          const loss = denBaiLosses[victimId] ?? 0;
          s[victimId] += loss;
        });

        s[activeNhot.dennerId] -= denBaiLoss;
      }

      s[nhotterId!] += gain + gameConfig.nhotBystanderPenalty;
      nhotOthers.forEach((oid) => {
        s[oid] -= gameConfig.nhotBystanderPenalty;
      });
    } else {
      let gain = 0;
      activeNhot.victims.forEach(({ victimId, heo }) => {
        const loss = ecPts + heoPts(heo);
        s[victimId] -= loss;
        gain += loss;
      });

      if (activeNhot.dennerId && activeNhot.denForIds.length > 0) {
        const denBaiLoss = activeNhot.denForIds.reduce(
          (sum, victimId) => sum + (denBaiLosses[victimId] ?? 0),
          0,
        );

        activeNhot.denForIds.forEach((victimId) => {
          const loss = denBaiLosses[victimId] ?? 0;
          s[victimId] += loss;
        });

        s[activeNhot.dennerId] -= denBaiLoss;
      }

      s[nhotterId!] += gain;
    }
  }

  // Khạp
  if (khapWinner && khapCount > 0) {
    const gain = accumulated.khap * khapCount * gameConfig.khapPoints * 3;
    const loss = accumulated.khap * khapCount * gameConfig.khapPoints;
    s[khapWinner] += gain;
    players.forEach((p) => {
      if (p.id !== khapWinner) s[p.id] -= loss;
    });
  }
  // Sảnh
  if (sanhWinner) {
    const gain = accumulated.sanh * gameConfig.sanhPoints * 3;
    const loss = accumulated.sanh * gameConfig.sanhPoints;
    s[sanhWinner] += gain;
    players.forEach((p) => {
      if (p.id !== sanhWinner) s[p.id] -= loss;
    });
  }
  // Chặt heo
  chatHeoList.forEach(({ chatterId, victimId, heo }) => {
    const pts =
      (heo.do ?? 0) * gameConfig.heoDoPoints +
      (heo.den ?? 0) * gameConfig.heodenPoints;
    s[chatterId] += pts;
    s[victimId] -= pts;
  });

  return s;
};

export const reRanking = (ranking: string[], activeNhot: NhotBai | null) => {
  console.log("ranking: ", ranking);
  console.log("activeNhot: ", activeNhot);

  const rankingMap = new Map(ranking.map((pid, i) => [pid, i + 1]));
  const lastIndex = ranking.length - 1;
  if (activeNhot && activeNhot.victims.length === 2) {
    rankingMap.set(ranking[1], lastIndex);
    activeNhot.victims.forEach((v) => {
      rankingMap.set(v.victimId, lastIndex + 1);
    });
  }
  return rankingMap;
};

export function buildPigCounts(
  playerIds: string[],
  chatHeoList: ChatHeo[],
  activeNhot: NhotBai | null,
) {
  const counts = Object.fromEntries(
    playerIds.map((id) => [id, { red: 0, black: 0 }]),
  );

  chatHeoList.forEach((c) => {
    counts[c.victimId].red -= c.heo.do ?? 0;
    counts[c.victimId].black -= c.heo.den ?? 0;
    counts[c.chatterId].red += c.heo.do ?? 0;
    counts[c.chatterId].black += c.heo.den ?? 0;
  });

  activeNhot?.victims.forEach((v) => {
    counts[v.victimId].red -= v.heo?.do ?? 0;
    counts[v.victimId].black -= v.heo?.den ?? 0;
  });

  return counts;
}

export const PROGRESS_COLORS = [
  "#00FF7F",
  "#00FF40",
  "#66FF00",
  "#B8FF00",
  "#F2FF00",
  "#FFF000",
  "#FFC400",
  "#FF9100",
  "#FF3D00",
  "#FF0033",
];

export const heatBackground = (totalScore: number) =>
  totalScore <= 25
    ? "linear-gradient(to bottom, rgba(34,197,94,.35) 0%, transparent 16%)"
    : totalScore <= 50
      ? "linear-gradient(to bottom, rgba(250,204,21,.35) 0%, transparent 20%)"
      : totalScore <= 75
        ? "linear-gradient(to bottom, rgba(245,158,11,.5) 0%, rgba(245,158,11,.12) 15%, transparent 24%)"
        : totalScore <= 100
          ? "linear-gradient(to bottom, rgba(249,115,22,.65) 0%, rgba(249,115,22,.18) 18%, transparent 28%)"
          : totalScore <= 125
            ? "linear-gradient(to bottom, rgba(239,68,68,.8) 0%, rgba(239,68,68,.22) 20%, transparent 40%)"
            : "linear-gradient(to bottom, rgba(185,28,28,.95) 0%, rgba(239,68,68,.28) 22%, transparent 70%)";

// play-tts

let currentAudio: HTMLAudioElement | null = null;

export async function playTTS(text: string) {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  currentAudio = new Audio(url);

  currentAudio.onended = () => {
    URL.revokeObjectURL(url);
  };

  await currentAudio.play();
}
