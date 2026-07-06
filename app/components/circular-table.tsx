"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useFetcher, useLoaderData, useParams } from "react-router";
import type { Route } from "./+types/match";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Swords,
  CheckCircle2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Flame,
  Scissors,
  Lock,
  Plus,
  X,
  Crown,
  Trash,
  Spade,
  LayoutGrid,
  List,
  Minus,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import {
  deleteRound,
  getRoundMeta,
  saveRound,
  type RoundResultInput,
} from "~/lib/round.server";
import {
  useCurrentParticipant,
  useGameConfig,
  usePlayers,
  useRounds,
  type Round,
} from "~/stores/useSessionStore";
import { useSessionStore } from "~/stores/useSessionStore";
import {
  getSocket,
  onRoundFinished,
  onScoreUpdated,
} from "~/lib/socket.client";
import { finishRound } from "~/lib/socket.client";
import { players, sessionTotals } from "~/db/schema";
import { CircularTable } from "~/components/circular-table";

interface RoundMeta {
  currentRoundNo: number;
  accumulated: { khap: number; sanh: number };
  roundId: string;
}
export interface MatchLoaderData {
  roundMeta: RoundMeta;
  playerTotals: Array<{
    playerId: string;
    playerName: string;
    orderNo: number;
    totalScore: number | null;
  }>;
}

export async function loader({ params }: Route.LoaderArgs) {
  const { sessionId: sessionCode } = params;

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!session) {
    throw redirect("/");
  }

  const [playerTotals, roundMeta] = await Promise.all([
    db
      .select({
        playerId: players.id,
        playerName: players.name,
        orderNo: players.orderNo,
        totalScore: sessionTotals.totalScore,
      })
      .from(players)
      .leftJoin(sessionTotals, eq(sessionTotals.playerId, players.id))
      .where(eq(players.sessionId, session.id))
      .orderBy(players.orderNo),
    getRoundMeta(session.id),
  ]);

  return { roundMeta, playerTotals };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();

  if (formData.get("intent") === "delete-round") {
    const roundId = formData.get("roundId") as string;
    if (!roundId) {
      return { error: "Thiếu roundId" };
    }
    try {
      await deleteRound(params.sessionId!, roundId);
      return { success: true };
    } catch (err) {
      if (err instanceof Response) throw err;
      console.error("delete round failed:", err);
      return { error: "Không thể xóa ván đấu" };
    }
  }

  if (formData.get("intent") !== "save-round") {
    return { error: "Yeu cau khong hop le" };
  }

  const createdBy = formData.get("createdBy") as string;
  const payloadRaw = formData.get("payload") as string;

  if (!createdBy || !payloadRaw) {
    return { error: "Thieu du lieu van dau" };
  }

  let results: RoundResultInput[];
  try {
    results = JSON.parse(payloadRaw) as RoundResultInput[];
  } catch {
    return { error: "Du lieu van dau khong hop le" };
  }

  try {
    const saved = await saveRound(params.sessionId!, createdBy, results);
    return {
      success: true,
      roundNo: saved.roundNo,
      round: saved.round,
      totals: saved.totals,
    };
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("save round failed:", err);
    return { error: "Khong the luu van dau" };
  }
}

// Types
type HeoType = "do" | "den";
interface ChatHeo {
  id: string;
  chatterId: string;
  victimId: string;
  heo: { do: number; den: number };
}
interface VictimHeo {
  victimId: string;
  heo: { do: number; den: number };
}
interface NhotBai {
  id: string;
  nhotterId: string;
  victims: VictimHeo[];
  dennerId?: string;
  denForIds: string[];
}

function buildPigCounts(
  playerIds: string[],
  chatHeoList: ChatHeo[],
  activeNhot: NhotBai | null,
) {
  const counts = Object.fromEntries(
    playerIds.map((id) => [id, { red: 0, black: 0 }]),
  );

  chatHeoList.forEach((c) => {
    counts[c.victimId].red += c.heo.do ?? 0;
    counts[c.victimId].black += c.heo.den ?? 0;
  });

  activeNhot?.victims.forEach((v) => {
    counts[v.victimId].red += v.heo?.do ?? 0;
    counts[v.victimId].black += v.heo?.den ?? 0;
  });

  return counts;
}

export default function MatchPage() {
  const { sessionId: sessionCode } = useParams();
  const loaderData = useLoaderData<MatchLoaderData>();
  const players = usePlayers();
  const config = useGameConfig();
  const currentParticipant = useCurrentParticipant();
  const addRound = useSessionStore((s) => s.addRound);
  const setTotals = useSessionStore((s) => s.setTotals);
  const session = useSessionStore((s) => s.session);
  const fetcher = useFetcher<typeof action>();
  const matchLoaderFetcher = useFetcher<typeof loader>();
  const handledSaveRoundRef = useRef<number | null>(null);

  const roundMeta = matchLoaderFetcher.data?.roundMeta ?? loaderData.roundMeta;
  const playerTotals =
    matchLoaderFetcher.data?.playerTotals ?? loaderData.playerTotals;

  const accumulated = roundMeta?.accumulated;
  const currentRoundNo = roundMeta?.currentRoundNo;
  const currentRoundId = roundMeta?.roundId;

  const gameConfig = useMemo(
    () => ({
      rankPoints: [
        config?.firstPlaceScore ?? 3,
        config?.secondPlaceScore ?? 1,
        config?.thirdPlaceScore ?? -1,
        config?.fourthPlaceScore ?? -3,
      ],
      khapPoints: config?.khapScore ?? 3,
      sanhPoints: config?.sanhScore ?? 5,
      maxKhapAccumulate: config?.khapLimit ?? 5,
      maxSanhAccumulate: config?.sanhLimit ?? 3,
      heoDoPoints: config?.redPigScore ?? 3,
      heodenPoints: config?.blackPigScore ?? 5,
      nhotBystanderPenalty: 2,
    }),
    [config],
  );

  const isReady = Boolean(config && players.length > 0);

  const sorted = [...playerTotals]
    .map((pt) => {
      const player = players.find((p) => p.id === pt.playerId);
      return {
        ...pt,
        initialScore: player?.initialScore ?? 0,
        totalScore: (pt.totalScore ?? 0) + (player?.initialScore ?? 0),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  // State
  const [selectOrder, setSelectOrder] = useState<(number | null)[]>([]);
  const [khapWinner, setKhapWinner] = useState<string | null>(null);
  const [khapCount, setKhapCount] = useState(0);
  const [sanhWinner, setSanhWinner] = useState<string | null>(null);
  const [chatHeoList, setChatHeoList] = useState<ChatHeo[]>([]);
  const [showChatHeoForm, setShowChatHeoForm] = useState(false);
  const [chatForm, setChatForm] = useState<{
    chatterId: string;
    victimId: string;
    heo: { do: number; den: number };
  }>({ chatterId: "", victimId: "", heo: { do: 0, den: 0 } });
  const [nhotList, setNhotList] = useState<NhotBai[]>([]);
  const [showNhotForm, setShowNhotForm] = useState(false);
  const [nhotForm, setNhotForm] = useState<{
    nhotterId: string;
    victims: VictimHeo[];
  }>({ nhotterId: "", victims: [] });
  const [dennerId, setDennerId] = useState<string | null>(null);
  const [denForIds, setDenForIds] = useState<string[]>([]);
  const [showDenBai, setShowDenBai] = useState(false);
  const [expandBonus, setExpandBonus] = useState(false);
  const [showChatHeo, setShowChatHeo] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmNhot, setConfirmNhot] = useState(false);
  const [rankViewMode, setRankViewMode] = useState<"list" | "table">("table");

  const playerIdsKey = useMemo(
    () => players.map((p) => p.id).join(","),
    [players],
  );

  useEffect(() => {
    const mode = localStorage.getItem("rankViewMode");
    if (mode) setRankViewMode(mode as any);
  }, []);

  useEffect(() => {
    setSelectOrder((prev) =>
      prev.length === players.length ? prev

: players.map(() => null),
    );
  }, [playerIdsKey, players.length]);

  useEffect(() => {
    if (!fetcher.data?.success || sessionCode == null) return;
    finishRound(sessionCode, fetcher.data.roundNo, fetcher.data.round);
  }, [fetcher.data, sessionCode]);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const data = fetcher.data;
    if (!data?.success || data.roundNo == null) return;
    if (handledSaveRoundRef.current === data.roundNo) return;
    handledSaveRoundRef.current = data.roundNo;

    if (data.round) addRound(data.round as any);
    if (data.totals) setTotals(data.totals);

    // Reset form
    setSelectOrder(players.map(() => null));
    setKhapWinner(null);
    setKhapCount(0);
    setSanhWinner(null);
    setChatHeoList([]);
    setNhotList([]);
    setSubmitted(false);
    setConfirmNhot(false);
    setNhotForm({ nhotterId: "", victims: [] });
    setDennerId(null);
    setDenForIds([]);
    setShowDenBai(false);
    setExpandBonus(false);

    if (sessionCode) {
      matchLoaderFetcher.load(`/session/${sessionCode}/match`);
    }
  }, [fetcher.state, fetcher.data, sessionCode]);

  const isSaving = fetcher.state !== "idle";

  // Socket listeners
  useEffect(() => {
    if (!session?.code) return;

    const handleRoundFinished = (payload: { round: Round }) => {
      addRound(payload.round);
      setSelectOrder(players.map(() => null));
      setKhapWinner(null);
      setKhapCount(0);
      setSanhWinner(null);
      setChatHeoList([]);
      setNhotList([]);
      setSubmitted(false);
      setConfirmNhot(false);
      setNhotForm({ nhotterId: "", victims: [] });
      setExpandBonus(false);

      if (sessionCode) {
        matchLoaderFetcher.load(`/session/${sessionCode}/match`);
      }
    };

    const handleScoreUpdated = (payload: {
      totals: Array<{ playerId: string; totalScore: number }>;
    }) => {
      setTotals(payload.totals);
    };

    onRoundFinished(handleRoundFinished);
    onScoreUpdated(handleScoreUpdated);

    return () => {
      const s = getSocket();
      s.off("round-finished", handleRoundFinished);
      s.off("score-updated", handleScoreUpdated);
    };
  }, [session?.code]);

  // Nhot state derived
  const activeNhot = nhotList[0] ?? null;
  const nhotCount = activeNhot ? activeNhot.victims.length : 0;
  const nhotterId = activeNhot?.nhotterId ?? null;
  const nhotVictimIds = activeNhot?.victims.map((v) => v.victimId) ?? [];
  const nhotOthers = players
    .map((p) => p.id)
    .filter((id) => id !== nhotterId && !nhotVictimIds.includes(id));

  const nhotFormVictimIds = useMemo(
    () => nhotForm.victims.map((v) => v.victimId),
    [nhotForm.victims],
  );

  const dennerCandidates = useMemo(
    () =>
      players
        .map((p) => p.id)
        .filter(
          (id) => id !== nhotForm.nhotterId && nhotFormVictimIds.includes(id),
        ),
    [playerIdsKey, nhotForm.nhotterId, nhotFormVictimIds],
  );

  const denForCandidates = useMemo(() => {
    if (!dennerId) return nhotFormVictimIds;
    return nhotFormVictimIds.filter((id) => id !== dennerId);
  }, [dennerId, nhotFormVictimIds]);

  useEffect(() => {
    if (!showDenBai) {
      if (dennerId) setDennerId(null);
      if (denForIds.length > 0) setDenForIds([]);
      return;
    }
    if (dennerCandidates.length === 0) {
      if (dennerId) setDennerId(null);
      if (denForIds.length > 0) setDenForIds([]);
      return;
    }
    if (!dennerCandidates.includes(dennerId ?? "")) {
      const nextDennerId = dennerCandidates[0];
      setDennerId(nextDennerId);
      setDenForIds(denForCandidates.filter((id) => id !== nextDennerId));
      return;
    }
    if (denForIds.length === 0 && denForCandidates.length > 0) {
      setDenForIds(denForCandidates);
    }
  }, [dennerCandidates, dennerId, denForCandidates, denForIds.length, showDenBai]);

  const denBaiLosses = useMemo(() => {
    if (!activeNhot || !activeNhot.dennerId) return {};
    const ecPts = Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
    const heoPts = (heo: { do: number; den: number }) =>
      heo.den * gameConfig.heodenPoints + heo.do * gameConfig.heoDoPoints;
    return Object.fromEntries(
      activeNhot.victims.map((v) => {
        const loss = ecPts + heoPts(v.heo ?? { do: 0, den: 0 });
        return [v.victimId, loss];
      }),
    );
  }, [activeNhot, gameConfig, players.length]);

  // Selectable IDs based on nhot state
  const selectableIds = useMemo(() => {
    if (!activeNhot) return players.map((p) => p.id);
    if (nhotCount === 3) return [];
    if (nhotCount === 2) return [];
    return nhotOthers;
  }, [activeNhot, nhotCount, nhotOthers]);

  const requiredSelections = selectableIds.length;

  // Ranking logic
  const ranking = useMemo(() => {
    if (!activeNhot) {
      const selected = players
        .map((p, i) => ({ p, order: selectOrder[i] }))
        .filter((x) => x.order !== null)
        .sort((a, b) => a.order! - b.order!)
        .map((x) => x.p.id);
      const unselected = players
        .filter((_, i) => selectOrder[i] === null)
        .map((p) => p.id);
      return [...selected, ...unselected];
    }

    if (nhotCount === 3) {
      return [nhotterId!, ...nhotVictimIds];
    }

    if (nhotCount === 2) {
      return [nhotterId!, ...nhotVictimIds, ...nhotOthers];
    }

    const othersOrdered = players
      .map((p, i) => ({ id: p.id, order: selectOrder[i] }))
      .filter((x) => nhotOthers.includes(x.id) && x.order !== null)
      .sort((a, b) => a.order! - b.order!)
      .map((x) => x.id);
    const othersUnselected = nhotOthers.filter((id) => {
      const i = players.findIndex((p) => p.id === id);
      return selectOrder[i] === null;
    });
    return [
      nhotterId!,
      ...othersOrdered,
      ...othersUnselected,
      ...nhotVictimIds,
    ];
  }, [selectOrder, activeNhot, nhotCount, nhotterId, nhotVictimIds, nhotOthers]);

  const selectCounter = selectOrder.filter((o) => o !== null).length;
  const rankingComplete = !activeNhot
    ? selectCounter === players.length
    : nhotCount === 3
      ? true
      : nhotCount === 2
        ? true
        : selectCounter >= requiredSelections;

  // Toggle select
  const toggleSelect = (playerId: string) => {
    if (!selectableIds.includes(playerId)) return;
    const idx = players.findIndex((p) => p.id === playerId);
    setSelectOrder((prev) => {
      const next = [...prev];
      if (next[idx] !== null) {
        const removed = next[idx]!;
        next[idx] = null;
        return next.map((o) => (o !== null && o > removed ? o - 1 : o));
      } else {
        next[idx] = next.filter((o) => o !== null).length + 1;
        return next;
      }
    });
  };

  // Move rank
  const moveRank = (playerId: string, direction: "up" | "down") => {
    const rankPos = ranking.indexOf(playerId);
    const swapPos = direction === "up" ? rankPos - 1 : rankPos + 1;
    if (swapPos < 0 || swapPos >= ranking.length) return;
    const swapId = ranking[swapPos];
    if (!selectableIds.includes(playerId) || !selectableIds.includes(swapId)) return;
    const idxA = players.findIndex((p) => p.id === playerId);
    const idxB = players.findIndex((p) => p.id === swapId);
    if (selectOrder[idxA] === null || selectOrder[idxB] === null) return;
    setSelectOrder((prev) => {
      const next = [...prev];
      [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
  };

  // Khap/Sanh helpers
  const toggleKhapPlayer = (pid: string) => {
    if (khapWinner === pid) {
      setKhapWinner(null);
      setKhapCount(0);
    } else {
      setKhapWinner(pid);
      if (khapCount === 0) setKhapCount(1);
    }
  };

  const updateKhapCount = (delta: number) => {
    setKhapCount((c) => {
      const n = c + delta;
      if (n <= 0) {
        setKhapWinner(null);
        return 0;
      }
      return Math.min(n, gameConfig.maxKhapAccumulate);
    });
  };

  const toggleSanhPlayer = (pid: string) =>
    setSanhWinner((pidPrev) => (pidPrev === pid ? null : pid));

  // Chat heo helpers
  const addChatHeo = () => {
    if (!chatForm.chatterId || !chatForm.victimId || chatForm.chatterId === chatForm.victimId) return;
    if (chatForm.heo.do === 0 && chatForm.heo.den === 0) return;
    setChatHeoList((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}`,
        chatterId: chatForm.chatterId,
        victimId: chatForm.victimId,
        heo: { ...chatForm.heo },
      },
    ]);
    setChatForm({ chatterId: "", victimId: "", heo: { do: 0, den: 0 } });
    setShowChatHeoForm(false);
  };

  const updateChatFormHeo = (type: HeoType, delta: number) => {
    setChatForm((f) => ({
      ...f,
      heo: { ...f.heo, [type]: Math.max(0, f.heo[type] + delta) },
    }));
  };

  const removeChatHeo = (id: string) =>
    setChatHeoList((p) => p.filter((c) => c.id !== id));

  const setViewMode = (mode: "list" | "table") => {
    setRankViewMode(() => {
      localStorage.setItem("rankViewMode", mode);
      return mode;
    });
  };

  // Nhot helpers
  const addNhot = () => {
    if (!nhotForm.nhotterId || nhotForm.victims.length === 0) return;

    const nextDennerId = showDenBai ? dennerId : null;
    const nextDenForIds =
      showDenBai && dennerId ? denForIds.filter((id) => id !== dennerId) : [];

    setSelectOrder(players.map(() => null));
    setNhotList([
      {
        id: `nh-${Date.now()}`,
        nhotterId: nhotForm.nhotterId,
        victims: nhotForm.victims,
        dennerId: nextDennerId ?? undefined,
        denForIds: nextDenForIds,
      },
    ]);
    setShowNhotForm(false);
    setConfirmNhot(true);
  };

  const removeNhot = () => {
    setNhotList([]);
    setNhotForm({ nhotterId: "", victims: [] });
    setDennerId(null);
    setDenForIds([]);
    setShowDenBai(false);
    setSelectOrder(players.map(() => null));
    setConfirmNhot(false);
    setExpandBonus(false);
  };

  const resetNhot = () => {
    setNhotForm({ nhotterId: "", victims: [] });
    setDennerId(null);
    setDenForIds([]);
    setShowDenBai(false);
    setSelectOrder(players.map(() => null));
    setConfirmNhot(false);
    setExpandBonus(true);
    setNhotList([]);
  };

  const toggleNhotVictim = (pid: string) => {
    setNhotForm((prev) => {
      const exists = prev.victims.find((v) => v.victimId === pid);
      const nextVictims = exists
        ? prev.victims.filter((v) => v.victimId !== pid)
        : [...prev.victims, { victimId: pid, heo: { do: 0, den: 0 } }];

      const nextDennerId =
        dennerId && !nextVictims.some((v) => v.victimId === pid)
          ? null
          : dennerId;

      return {
        ...prev,
        victims: nextVictims,
      };
    });

    if (dennerId === pid) setDennerId(null);
    setDenForIds((prev) => prev.filter((id) => id !== pid));
  };

  const updateVictimHeo = (victimId: string, type: HeoType, delta: number) => {
    setNhotForm((prev) => ({
      ...prev,
      victims: prev.victims.map((v) =>
        v.victimId === victimId
          ? {
              ...v,
              heo: {
                ...(v.heo ?? { do: 0, den: 0 }),
                [type]: Math.max(0, (v.heo?.[type] ?? 0) + delta),
              },
            }
          : v,
      ),
    }));
  };

  // Score computation
  const computedScores = useMemo(() => {
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
        const vh = (victimHeoMap[nhotVictimIds[0]] as { do: number; den: number } | undefined) ?? { do: 0, den: 0 };
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

    // Khap
    if (khapWinner && khapCount > 0) {
      const gain = accumulated.khap * khapCount * gameConfig.khapPoints * 3;
      const loss = accumulated.khap * khapCount * gameConfig.khapPoints;
      s[khapWinner] += gain;
      players.forEach((p) => {
        if (p.id !== khapWinner) s[p.id] -= loss;
      });
    }

    // Sanh
    if (sanhWinner) {
      const gain = accumulated.sanh * gameConfig.sanhPoints * 3;
      const loss = accumulated.sanh * gameConfig.sanhPoints;
      s[sanhWinner] += gain;
      players.forEach((p) => {
        if (p.id !== sanhWinner) s[p.id] -= loss;
      });
    }

    // Chat heo
    chatHeoList.forEach(({ chatterId, victimId, heo }) => {
      const pts =
        (heo.do ?? 0) * gameConfig.heoDoPoints +
        (heo.den ?? 0) * gameConfig.heodenPoints;
      s[chatterId] += pts;
      s[victimId] -= pts;
    });

    return s;
  }, [ranking, activeNhot, nhotCount, nhotterId, nhotVictimIds, nhotOthers, khapWinner, khapCount, sanhWinner, chatHeoList]);

  // Handle reset
  const handleReset = () => {
    setSelectOrder(players.map(() => null));
    setKhapWinner(null);
    setKhapCount(0);
    setSanhWinner(null);
    setChatHeoList([]);
    setNhotList([]);
    setNhotForm({ nhotterId: "", victims: [] });
    setDennerId(null);
    setDenForIds([]);
    setShowDenBai(false);
    setSubmitted(false);
    setConfirmNhot(false);
    setShowChatHeoForm(false);
    setShowChatHeo(false);
  };

  const closeNhotBai = () => {
    setShowDenBai(false);
    setExpandBonus(false);
    setNhotList([]);
    setNhotForm({ nhotterId: "", victims: [] });
    setDennerId(null);
    setDenForIds([]);
    setShowDenBai(false);
    setSelectOrder(players.map(() => null));
    setConfirmNhot(false);
  };

  const handleSave = () => {
    if (!currentParticipant || !rankingComplete || isSaving) return;

    const pigCounts = buildPigCounts(
      players.map((p) => p.id),
      chatHeoList,
      activeNhot,
    );

    const results: RoundResultInput[] = players.map((player) => ({
      playerId: player.id,
      rank: ranking.indexOf(player.id) + 1,
      score: computedScores[player.id],
      khapno: khapWinner === player.id ? accumulated.khap * khapCount : 0,
      sanhno: sanhWinner === player.id ? accumulated.sanh : 0,
      blackPigNo: pigCounts[player.id].black,
      redPigNo: pigCounts[player.id].red,
    }));

    fetcher.submit(
      {
        intent: "save-round",
        createdBy: currentParticipant.id,
        payload: JSON.stringify(results),
      },
      { method: "post" },
    );
    setSubmitted(true);
  };

  const pShort = (id: string) =>
    (players.find((p) => p.id === id)?.name ?? id).split(" ").pop()!;

  const scoreColor = (v: number) =>
    v > 0 ? "text-chart-2" : v < 0 ? "text-destructive" : "text-muted-foreground";

  const scoreFmt = (v: number) => (v > 0 ? `+${v}` : `${v}`);

  const scoreBoxClass = (v: number) =>
    v > 0
      ? "border-chart-2/25 bg-chart-2/10 text-chart-2"
      : v < 0
        ? "border-destructive/25 bg-destructive/10 text-destructive"
        : "border-border bg-muted/35 text-muted-foreground";

  const getRowMeta = (playerId: string, rankIndex: number) => {
    if (activeNhot) {
      if (playerId === nhotterId)
        return {
          label: "Nhốt",
          labelColor: "text-primary",
          style: "border-primary/40 bg-primary/10",
          isFixed: true,
          bgColor: "bg-primary/15",
        };

      const denForIds = activeNhot.denForIds ?? [];
      if (activeNhot.dennerId === playerId && denForIds.length > 0) {
        return {
          label: "Đền",
          labelColor: "text-destructive",
          style: "border-destructive/30 bg-destructive/5",
          isFixed: true,
          bgColor: "bg-destructive/10",
        };
      }

      if (denForIds.includes(playerId)) {
        return {
          label: "Được đền",
          labelColor: "text-muted-foreground",
          style: "border-muted bg-muted/30",
          isFixed: true,
          bgColor: "bg-muted/30",
        };
      }

      if (nhotVictimIds.includes(playerId))
        return {
          label: "Bị nhốt",
          labelColor: "text-destructive",
          style: "border-destructive/30 bg-destructive/5",
          isFixed: true,
          bgColor: "bg-destructive/10",
        };

      if (nhotCount === 2)
        return {
          label: "Ba",
          labelColor: "text-muted-foreground",
          style: "border-muted bg-muted/30",
          isFixed: true,
          bgColor: "bg-muted/30",
        };
    }

    const rankLabels = ["Nhất", "Nhì", "Ba", "Tư"];
    const rankColors = [
      "text-amber-500",
      "text-slate-400",
      "text-orange-400",
      "text-destructive",
    ];
    const rankStyles = [
      "border-amber-500/30 bg-amber-500/10",
      "border-slate-400/30 bg-slate-400/5",
      "border-orange-400/30 bg-orange-400/5",
      "border-destructive/30 bg-destructive/5",
    ];
    const rankBgColors = [
      "bg-amber-500/15",
      "bg-slate-400/10",
      "bg-orange-400/10",
      "bg-destructive/10",
    ];

    return {
      label: rankLabels[rankIndex],
      labelColor: rankColors[rankIndex],
      style: rankStyles[rankIndex],
      isFixed: false,
      bgColor: rankBgColors[rankIndex],
    };
  };

  if (!isReady) {
    return (
      <main className="p-4 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground text-sm">
          Đang tải dữ liệu phòng...
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex max-w-3xl flex-col gap-4 px-3 pb-28 pt-4 sm:px-4">
      {/* Header */}
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-sm">
        <div className="relative p-5">
          <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-chart-2/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex justify-between w-full">
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Ván {currentRoundNo}
              </h1>
              <div className="flex gap-2">
                {currentRoundId !== undefined && currentRoundNo > 1 && (
                  <form method="post" className="flex-1 sm:flex-none">
                    <input type="hidden" name="intent" value="delete-round" />
                    <input type="hidden" name="roundId" value={currentRoundId} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
                      type="submit"
                    >
                      <Trash className="size-3.5" />
                    </Button>
                  </form>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10 z-10"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-3xl border border-chart-4/20 bg-chart-4/10 p-4 ring-1 ring-chart-4/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-chart-4">
                    <Flame className="size-3.5" />
                    Khạp
                  </div>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-4xl font-black tracking-tight text-chart-4">
                      {accumulated.khap}
                    </span>
                    <span className="mb-1 text-xs font-semibold text-muted-foreground">
                      / {gameConfig.maxKhapAccumulate}
                    </span>
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-chart-4 shadow-sm">
                  <Flame className="size-5" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-10 gap-0.5">
                {Array.from({ length: gameConfig.maxKhapAccumulate }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition-all ${i < accumulated.khap ? "bg-chart-4" : "bg-muted"}`}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-chart-1/20 bg-chart-1/10 p-4 ring-1 ring-chart-1/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-chart-1">
                    <Spade className="size-3.5" />
                    Sảnh
                  </div>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-4xl font-black tracking-tight text-chart-1">
                      {accumulated.sanh}
                    </span>
                    <span className="mb-1 text-xs font-semibold text-muted-foreground">
                      / {gameConfig.maxSanhAccumulate}
                    </span>
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-chart-1 shadow-sm">
                  <Spade className="size-5" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-10 gap-0.5">
                {Array.from({ length: gameConfig.maxSanhAccumulate }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition-all ${i < accumulated.sanh ? "bg-chart-1" : "bg-muted"}`}
                    />
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4">
            {sorted.map((player) => {
              const score = player.totalScore ?? 0;
              return (
                <div
                  key={player.playerId}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition-colors ${scoreBoxClass(score)}`}
                >
                  <span className="text-xs font-black uppercase tracking-wide opacity-70">
                    {pShort(player.playerId)}
                  </span>
                  <span className="text-xl font-black tabular-nums">
                    {scoreFmt(score)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between relative z-20">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex gap-2 items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Swords className="size-4" />
            </div>
            <p className="text-sm font-black text-foreground">Kết quả</p>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 font-black text-sm"
              onClick={() => setExpandBonus(true)}
            >
              <Plus className="size-4" />
              Nhốt bài
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 font-black text-sm"
              onClick={() => {
                setShowChatHeo((v) => !v);
                setShowChatHeoForm(true);
              }}
            >
              <Plus className="size-4" />
              Chặt heo
            </Button>
          </div>
        </div>
      </div>

      {/* Nhot Bai Section */}
      {expandBonus && (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <button className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-chart-3/10 text-chart-3">
                <Lock className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Nhốt Bài</p>
                <p className="text-xs text-muted-foreground">
                  Thiết lập người nhốt, bị nhốt và đền bài
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => closeNhotBai()}
              className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
            >
              <X className="size-5" />
            </Button>
          </button>

          <div className="flex flex-col gap-3 px-4 pb-4">
            {confirmNhot && nhotList.length > 0 && nhotList.map((n) => {
              const nv = n.victims.length;
              const ecPts = Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
              const heoPtsOf = (heo: { do: number; den: number }) =>
                heo.den * gameConfig.heodenPoints + heo.do * gameConfig.heoDoPoints;
              const denForIds = n.denForIds ?? [];
              const dennerLoss = denForIds.reduce(
                (sum, victimId) => sum + (denBaiLosses[victimId] ?? 0),
                0,
              );
              let gain = 0;

              if (nv === 1) {
                gain = gameConfig.rankPoints[0] * 2 + heoPtsOf(n.victims[0]?.heo ?? { do: 0, den: 0 });
              } else {
                if (n.dennerId && denForIds.length > 0) {
                  const victimLosses = n.victims.map((v) => {
                    return nv === 1
                      ? gameConfig.rankPoints[0] * 2

<dyad-write path="app/components/circular-table.tsx" description="Complete redesigned circular table with cleaner UI">
"use client";

import { Crown, Flame, Scissors, Spade, X, Plus, Minus, Check, Users, Zap } from "lucide-react";
import type { Player } from "~/stores/useSessionStore";
import { Button } from "./ui/button";

interface ChatHeo {
  id: string;
  chatterId: string;
  victimId: string;
  heo: { do: number; den: number };
}

interface RowMeta {
  label: string;
  labelColor: string;
  style: string;
  isFixed: boolean;
  bgColor: string;
  borderColor: string;
}

interface GameConfigSlice {
  khapPoints: number;
  sanhPoints: number;
  maxKhapAccumulate: number;
  heoDoPoints: number;
  heodenPoints: number;
}

function scoreFmt(v: number) {
  return v > 0 ? `+${v}` : `${v}`;
}

function scoreColor(v: number) {
  return v > 0 ? "text-emerald-500" : v < 0 ? "text-red-500" : "text-muted-foreground";
}

// Player Card with clean design
function PlayerCard({
  player,
  rankIndex,
  order,
  score,
  isSelectable,
  isSelected,
  isFixed,
  isNhotter,
  isVictim,
  isDenFor,
  isDenner,
  isKhapWinner,
  isSanhWinner,
  khapPts,
  sanhPts,
  chatHeo,
  gameConfig,
  onToggleSelect,
  onToggleKhap,
  onToggleSanh,
  getRowMeta,
}: {
  player: Player;
  rankIndex: number;
  order: number | null;
  score: number;
  isSelectable: boolean;
  isSelected: boolean;
  isFixed: boolean;
  isNhotter: boolean;
  isVictim: boolean;
  isDenFor: boolean;
  isDenner: boolean;
  isKhapWinner: boolean;
  isSanhWinner: boolean;
  khapPts: { gain: number; loss: number };
  sanhPts: { gain: number; loss: number };
  chatHeo: { asChatter: ChatHeo[]; asVictim: ChatHeo[] };
  gameConfig: GameConfigSlice;
  onToggleSelect: () => void;
  onToggleKhap: () => void;
  onToggleSanh: () => void;
  getRowMeta: (playerId: string, rankIndex: number) => RowMeta;
}) {
  const meta = getRowMeta(player.id, rankIndex);
  const shortName = player.name.split(" ").pop() || player.name;

  // Rank badge colors
  const rankStyles = [
    { bg: "from-amber-400 to-amber-600", text: "text-amber-950", ring: "ring-amber-400/30" },
    { bg: "from-slate-300 to-slate-400", text: "text-slate-800", ring: "ring-slate-300/30" },
    { bg: "from-orange-300 to-orange-400", text: "text-orange-950", ring: "ring-orange-300/30" },
    { bg: "from-rose-400 to-rose-500", text: "text-white", ring: "ring-rose-400/30" },
  ];
  const rankStyle = rankStyles[Math.min(rankIndex, 3)];

  return (
    <div
      onClick={isSelectable && !isFixed ? onToggleSelect : undefined}
      className={`
        relative flex flex-col rounded-2xl border-2 p-4 transition-all duration-200
        ${isSelected || isFixed 
          ? `${meta.borderColor} ${meta.bgColor} shadow-lg` 
          : "border-border/60 bg-card/80 hover:border-primary/30"
        }
        ${isSelectable && !isFixed ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:shadow-md" : ""}
        ${!isSelectable && !isFixed ? "opacity-50" : ""}
      `}
    >
      {/* Top Row: Rank + Name + Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          {/* Rank Badge */}
          <div className={`
            flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-black gap-1.5
            ${isFixed 
              ? `bg-gradient-to-br ${rankStyle.bg} ${rankStyle.text} ring-2 ${rankStyle.ring}` 
              : isSelected 
                ? `bg-gradient-to-br ${rankStyle.bg} ${rankStyle.text}` 
                : "bg-muted text-muted-foreground"
            }
          `}>
            {isNhotter ? (
              <>
                <Crown className="size-3.5" />
                <span>Nhốt</span>
              </>
            ) : isVictim ? (
              <span className="text-destructive">Bị nhốt</span>
            ) : isDenner ? (
              <span className="text-orange-500">Đền</span>
            ) : isDenFor ? (
              <span className="text-emerald-500">Được đền</span>
            ) : isSelected && order !== null ? (
              <span>#{order}</span>
            ) : (
              <span className="text-xs">Hạng {rankIndex + 1}</span>
            )}
          </div>

          {/* Player Name */}
          <span className="text-sm font-bold text-foreground truncate max-w-[90px]">
            {shortName}
          </span>
        </div>

        {/* Score */}
        <div className={`text-xl font-black tabular-nums ${scoreColor(score)}`}>
          {scoreFmt(score)}
        </div>
      </div>

      {/* Selection Indicator */}
      {isSelectable && !isFixed && (
        <div className={`
          absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full
          border-2 transition-all duration-200 text-xs font-black
          ${isSelected 
            ? "bg-primary border-primary text-primary-foreground scale-110" 
            : "bg-background border-border text-muted-foreground hover:border-primary/50"
          }
        `}>
          {isSelected ? <Check className="size-3" /> : order ?? "·"}
        </div>
      )}

      {/* Bonus Buttons */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {/* Khạp */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleKhap(); }}
          disabled={isVictim}
          className={`
            flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold
            transition-all duration-200 disabled:opacity-40
            ${isKhapWinner 
              ? "bg-rose-500/20 border-rose-500/50 text-rose-600" 
              : isDenner || isDenFor || isVictim
                ? "opacity-40 border-border bg-muted/50"
                : "border-border/70 bg-muted/30 text-muted-foreground hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-600"
            }
          `}
        >
          <Flame className={`size-3 ${isKhapWinner ? "text-rose-500" : ""}`} />
          <span>Khạp</span>
          {isKhapWinner && khapPts.gain > 0 && (
            <span className="text-emerald-500">+{khapPts.gain}</span>
          )}
          {!isKhapWinner && khapPts.loss > 0 && (
            <span className="text-red-500">-{khapPts.loss}</span>
          )}
        </button>

        {/* Sảnh */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSanh(); }}
          disabled={isVictim}
          className={`
            flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold
            transition-all duration-200 disabled:opacity-40
            ${isSanhWinner 
              ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-600" 
              : isDenner || isDenFor || isVictim
                ? "opacity-40 border-border bg-muted/50"
                : "border-border/70 bg-muted/30 text-muted-foreground hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-600"
            }
          `}
        >
          <Spade className={`size-3 ${isSanhWinner ? "text-indigo-500" : ""}`} />
          <span>Sảnh</span>
          {isSanhWinner && sanhPts.gain > 0 && (
            <span className="text-emerald-500">+{sanhPts.gain}</span>
          )}
          {!isSanhWinner && sanhPts.loss > 0 && (
            <span className="text-red-500">-{sanhPts.loss}</span>
          )}
        </button>
      </div>

      {/* Chat Heo Tags */}
      {(chatHeo.asChatter.length > 0 || chatHeo.asVictim.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chatHeo.asChatter.map((c) => {
            const pts = (c.heo.do ?? 0) * gameConfig.heoDoPoints + (c.heo.den ?? 0) * gameConfig.heodenPoints;
            return (
              <div key={c.id} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-1">
                <Scissors className="size-2.5 text-emerald-600" />
                {(c.heo.do ?? 0) > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                    {c.heo.do}đ
                  </span>
                )}
                {(c.heo.den ?? 0) > 0 && (
                  <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-black text-background">
                    {c.heo.den}đ
                  </span>
                )}
                <span className="text-[10px] font-bold text-emerald-600">+{pts}</span>
              </div>
            );
          })}
          {chatHeo.asVictim.map((c) => {
            const pts = (c.heo.do ?? 0) * gameConfig.heoDoPoints + (c.heo.den ?? 0) * gameConfig.heodenPoints;
            return (
              <div key={c.id} className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/15 px-2 py-1">
                <Scissors className="size-2.5 text-red-600" />
                {(c.heo.do ?? 0) > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                    {c.heo.do}đ
                  </span>
                )}
                {(c.heo.den ?? 0) > 0 && (
                  <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-black text-background">
                    {c.heo.den}đ
                  </span>
                )}
                <span className="text-[10px] font-bold text-red-600">-{pts}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Main Circular Table
export function CircularTable({
  players,
  ranking,
  selectOrder,
  toggleSelect,
  selectableIds,
  selectCounter,
  requiredSelections,
  computedScores,
  activeNhot,
  nhotCount,
  nhotterId,
  nhotVictimIds,
  denForIds,
  khapWinner,
  khapCount,
  sanhWinner,
  toggleKhapPlayer,
  updateKhapCount,
  toggleSanhPlayer,
  chatHeoList,
  accumulated,
  gameConfig,
  getRowMeta,
  save,
  disabledSaveButton,
}: {
  players: Player[];
  ranking: string[];
  selectOrder: (number | null)[];
  toggleSelect: (playerId: string) => void;
  selectableIds: string[];
  selectCounter: number;
  requiredSelections: number;
  computedScores: Record<string, number>;
  activeNhot: { dennerId?: string; denForIds?: string[] } | null;
  nhotCount: number;
  nhotterId: string | null;
  nhotVictimIds: string[];
  denForIds: string[];
  khapWinner: string | null;
  khapCount: number;
  sanhWinner: string | null;
  toggleKhapPlayer: (pid: string) => void;
  updateKhapCount: (delta: number) => void;
  toggleSanhPlayer: (pid: string) => void;
  chatHeoList: ChatHeo[];
  accumulated: { khap: number; sanh: number };
  gameConfig: GameConfigSlice;
  getRowMeta: (playerId: string, rankIndex: number) => RowMeta;
  save: () => void;
  disabledSaveButton: boolean;
}) {
  // Calculate circular positions
  const size = 320;
  const center = size / 2;
  const radius = 115;
  const angleStep = (2 * Math.PI) / Math.max(players.length, 4);
  const startAngle = -Math.PI / 2;

  const getPosition = (index: number) => {
    const angle = startAngle + index * angleStep;
    return {
      x: center + radius * Math.cos(angle) - 75,
      y: center + radius * Math.sin(angle) - 60,
    };
  };

  const totalSlots = activeNhot ? requiredSelections : players.length;
  const progress = totalSlots > 0 ? (selectCounter / totalSlots) * 100 : 0;

  return (
    <div className="relative w-full py-4">
      {/* Circular Background Ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="rounded-full border-2 border-dashed border-border/20"
          style={{
            width: size * 0.85,
            height: size * 0.85,
          }}
        />
      </div>

      {/* Center Confirm Button */}
      <div className="relative z-10 flex items-center justify-center pb-3">
        <Button
          onClick={save}
          disabled={disabledSaveButton}
          className={`
            flex flex-col items-center justify-center gap-0.5 rounded-full shadow-xl transition-all duration-300
            ${disabledSaveButton 
              ? "bg-muted text-muted-foreground border-2 border-border" 
              : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95"
            }
          `}
          style={{ width: 90, height: 90 }}
        >
          {activeNhot ? (
            <>
              <span className="text-[9px] font-bold uppercase tracking-wide">
                Xác nhận
              </span>
              <span className="text-[8px] uppercase tracking-wide opacity-70">
                Nhốt {nhotCount}
              </span>
              <span className="text-lg font-black tabular-nums">
                {selectCounter}/{requiredSelections}
              </span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-bold uppercase tracking-wide">
                Xác nhận
              </span>
              <span className="text-[8px] uppercase tracking-wide opacity-70">
                {players.length} người
              </span>
              <span className="text-lg font-black tabular-nums">
                {selectCounter}/{players.length}
              </span>
            </>
          )}
        </Button>
      </div>

      {/* Player Cards in Circular Layout */}
      <div 
        className="relative mx-auto"
        style={{ width: size, height: size }}
      >
        {players.map((player, idx) => {
          const playerId = player.id;
          const rankIndex = ranking.indexOf(playerId);
          const order = selectOrder[idx];
          const isSelectable = selectableIds.includes(playerId);
          const isSelected = order !== null;
          const score = computedScores[playerId] || 0;
          const { bgColor, borderColor } = getRowMeta(playerId, rankIndex);

          const isNhotter = nhotterId === playerId;
          const isVictim = nhotVictimIds.includes(playerId);
          const isDenner = activeNhot?.dennerId === playerId;
          const isDenFor = denForIds.includes(playerId);
          const isKhapWinnerLocal = khapWinner === playerId;
          const isSanhWinnerLocal = sanhWinner === playerId;

          // Calculate points
          const khapPts = isKhapWinnerLocal && khapCount > 0
            ? { gain: accumulated.khap * khapCount * gameConfig.khapPoints * 3, loss: 0 }
            : { gain: 0, loss: khapWinner && khapCount > 0 ? accumulated.khap * khapCount * gameConfig.khapPoints : 0 };

          const sanhPts = isSanhWinnerLocal
            ? { gain: accumulated.sanh * gameConfig.sanhPoints * 3, loss: 0 }
            : { gain: 0, loss: sanhWinner ? accumulated.sanh * gameConfig.sanhPoints : 0 };

          // Filter chat heo
          const chatHeo = {
            asChatter: chatHeoList.filter(c => c.chatterId === playerId && !nhotVictimIds.includes(c.victimId)),
            asVictim: chatHeoList.filter(c => c.victimId === playerId && !nhotVictimIds.includes(c.victimId)),
          };

          const pos = getPosition(idx);

          return (
            <div
              key={playerId}
              className="absolute transition-all duration-300 ease-out"
              style={{
                left: pos.x,
                top: pos.y,
                width: 150,
              }}
            >
              <PlayerCard
                player={player}
                rankIndex={rankIndex}
                order={order}
                score={score}
                isSelectable={isSelectable}
                isSelected={isSelected}
                isFixed={getRowMeta(playerId, rankIndex).isFixed}
                isNhotter={isNhotter}
                isVictim={isVictim}
                isDenFor={isDenFor}
                isDenner={isDenner}
                isKhapWinner={isKhapWinnerLocal}
                isSanhWinner={isSanhWinnerLocal}
                khapPts={khapPts}
                sanhPts={sanhPts}
                chatHeo={chatHeo}
                gameConfig={gameConfig}
                onToggleSelect={() => toggleSelect(playerId)}
                onToggleKhap={() => toggleKhapPlayer(playerId)}
                onToggleSanh={() => toggleSanhPlayer(playerId)}
                getRowMeta={getRowMeta}
              />
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          <span>
            {selectCounter}/{totalSlots} đã chọn
          </span>
        </div>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Khạp/Sảnh Winner Controls */}
      {(khapWinner || sanhWinner) && (
        <div className="mt-3 flex items-center justify-center gap-3">
          {khapWinner && khapCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
              <Flame className="size-4 text-rose-500" />
              <span className="text-xs font-bold text-rose-600">Khạp</span>
              <span className="text-xs font-bold text-muted-foreground">×{khapCount}</span>
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={() => updateKhapCount(-1)}
                  disabled={khapCount <= 1}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold disabled:opacity-30"
                >
                  <Minus className="size-2.5" />
                </button>
                <span className="w-5 text-center text-xs font-bold">{khapCount}</span>
                <button
                  onClick={() => updateKhapCount(1)}
                  disabled={khapCount >= gameConfig.maxKhapAccumulate}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold disabled:opacity-30"
                >
                  <Plus className="size-2.5" />
                </button>
              </div>
            </div>
          )}
          {sanhWinner && (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5">
              <Spade className="size-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-600">Sảnh</span>
              <span className="text-xs font-bold text-muted-foreground">×{accumulated.sanh}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}