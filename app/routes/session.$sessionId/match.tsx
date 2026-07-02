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
  ChevronRight,
  ChevronDown as CollapseIcon,
  Crown,
  Trash,
  Spade,
  LayoutGrid,
  List,
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

export async function loader({
  params,
}: Route.LoaderArgs): Promise<MatchLoaderData> {
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

// ── Types ────────────────────────────────────────────────────
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

interface DenBai {
  dennerId: string;
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

// ── Component ────────────────────────────────────────────────
export default function MatchPage() {
  const { sessionId: sessionCode } = useParams();
  const loaderData = useLoaderData<MatchLoaderData>();
  const players = usePlayers();
  const config = useGameConfig();
  const currentParticipant = useCurrentParticipant();
  const addRound = useSessionStore((s) => s.addRound);
  const rounds = useRounds();
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

  // ── State ─────────────────────────────────────────────────
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
  const [rankViewMode, setRankViewMode] = useState<"list" | "table">("list");

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
      prev.length === players.length ? prev : players.map(() => null),
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

    // Cập nhật store cho chính người vừa lưu
    if (data.round) addRound(data.round as any);
    if (data.totals) setTotals(data.totals);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data, sessionCode]);

  const isSaving = fetcher.state !== "idle";

  const fetcherDataRef = useRef(fetcher.data);
  useEffect(() => {
    fetcherDataRef.current = fetcher.data;
  }, [fetcher.data]);
  // ── Socket: nhận round-finished từ người khác ────────────────
  useEffect(() => {
    if (!session?.code) return;

    const handleRoundFinished = (payload: { round: Round }) => {
      // Bỏ qua nếu chính mình vừa lưu (đã xử lý ở fetcher effect)
      // if (handledSaveRoundRef.current === payload.round.roundNo) return;
      addRound(payload.round);

      // Reset form để chuẩn bị ván mới
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

      // Reload accumulated (khạp/sảnh tích lũy) từ server
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

  // ── Derived nhot state ────────────────────────────────────
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

  // ... existing code ...
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
  }, [
    dennerCandidates,
    dennerId,
    denForCandidates,
    denForIds.length,
    showDenBai,
  ]);

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

  // ── Ranking logic phụ thuộc vào nhốt ─────────────────────
  // ... existing code ...

  // ── Ranking logic phụ thuộc vào nhốt ─────────────────────
  const selectableIds = useMemo(() => {
    if (!activeNhot) return players.map((p) => p.id);
    if (nhotCount === 3) return [];
    if (nhotCount === 2) return [];
    return nhotOthers;
  }, [activeNhot, nhotCount, nhotOthers]);

  const requiredSelections = selectableIds.length;

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
  }, [
    selectOrder,
    activeNhot,
    nhotCount,
    nhotterId,
    nhotVictimIds,
    nhotOthers,
  ]);

  const selectCounter = selectOrder.filter((o) => o !== null).length;
  const rankingComplete = !activeNhot
    ? selectCounter === players.length
    : nhotCount === 3
      ? true
      : nhotCount === 2
        ? true
        : selectCounter >= requiredSelections;

  // ── Helpers: ranking ─────────────────────────────────────
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

  const moveRank = (playerId: string, direction: "up" | "down") => {
    const rankPos = ranking.indexOf(playerId);
    const swapPos = direction === "up" ? rankPos - 1 : rankPos + 1;
    if (swapPos < 0 || swapPos >= ranking.length) return;
    const swapId = ranking[swapPos];
    if (!selectableIds.includes(playerId) || !selectableIds.includes(swapId))
      return;
    const idxA = players.findIndex((p) => p.id === playerId);
    const idxB = players.findIndex((p) => p.id === swapId);
    if (selectOrder[idxA] === null || selectOrder[idxB] === null) return;
    setSelectOrder((prev) => {
      const next = [...prev];
      [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
  };

  // ── Helpers: khap/sanh ────────────────────────────────────
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

  // ── Helpers: chat heo ────────────────────────────────────
  const addChatHeo = () => {
    if (
      !chatForm.chatterId ||
      !chatForm.victimId ||
      chatForm.chatterId === chatForm.victimId
    )
      return;
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

  // ── Helpers: nhot bai ────────────────────────────────────
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

  // ── Score computation ─────────────────────────────────────
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
  }, [
    ranking,
    activeNhot,
    nhotCount,
    nhotterId,
    nhotVictimIds,
    nhotOthers,
    khapWinner,
    khapCount,
    sanhWinner,
    chatHeoList,
  ]);

  // ── UI helpers ────────────────────────────────────────────
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
    v > 0
      ? "text-chart-2"
      : v < 0
        ? "text-destructive"
        : "text-muted-foreground";
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
        };

      const denForIds = activeNhot.denForIds ?? [];
      if (activeNhot.dennerId === playerId && denForIds.length > 0) {
        return {
          label: "Đền",
          labelColor: "text-destructive",
          style: "border-destructive/30 bg-destructive/5",
          isFixed: true,
        };
      }

      if (denForIds.includes(playerId)) {
        return {
          label: "Được đền",
          labelColor: "text-muted-foreground",
          style: "border-muted bg-muted/30",
          isFixed: true,
        };
      }

      if (nhotVictimIds.includes(playerId))
        return {
          label: "Bị nhốt",
          labelColor: "text-destructive",
          style: "border-destructive/30 bg-destructive/5",
          isFixed: true,
        };

      if (nhotCount === 2)
        return {
          label: "Ba",
          labelColor: "text-muted-foreground",
          style: "border-muted bg-muted/30",
          isFixed: true,
        };
    }
    const rankLabels = ["Nhất", "Nhì", "Ba", "Tư"];
    const rankColors = [
      "text-chart-4",
      "text-chart-2",
      "text-muted-foreground",
      "text-destructive",
    ];
    const rankStyles = [
      "border-chart-4/40 bg-chart-4/10",
      "border-chart-2/30 bg-chart-2/5",
      "border-muted bg-muted/30",
      "border-destructive/30 bg-destructive/5",
    ];
    return {
      label: rankLabels[rankIndex],
      labelColor: rankColors[rankIndex],
      style: rankStyles[rankIndex],
      isFixed: false,
    };
  };

  // ── Render ────────────────────────────────────────────────
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
                    <input
                      type="hidden"
                      name="roundId"
                      value={currentRoundId}
                    />
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
            {sorted.map((player, index) => {
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

      {/* ── Nhốt bài ─────────────────────────── */}
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
              type="submit"
            >
              <X className="size-5" />
            </Button>
          </button>

          <div className="flex flex-col gap-3 px-4 pb-4">
            {confirmNhot &&
              nhotList.length > 0 &&
              nhotList.map((n) => {
                const nv = n.victims.length;
                const ecPts =
                  Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
                const heoPtsOf = (heo: { do: number; den: number }) =>
                  heo.den * gameConfig.heodenPoints +
                  heo.do * gameConfig.heoDoPoints;
                const denForIds = n.denForIds ?? [];
                const dennerLoss = denForIds.reduce(
                  (sum, victimId) => sum + (denBaiLosses[victimId] ?? 0),
                  0,
                );
                let gain = 0;

                if (nv === 1) {
                  gain =
                    gameConfig.rankPoints[0] * 2 +
                    heoPtsOf(n.victims[0]?.heo ?? { do: 0, den: 0 });
                } else {
                  if (n.dennerId && denForIds.length > 0) {
                    const ecPts =
                      Math.abs(gameConfig.rankPoints[players.length - 1]) * 2;
                    const heoPtsOf = (heo: { do: number; den: number }) =>
                      heo.den * gameConfig.heodenPoints +
                      heo.do * gameConfig.heoDoPoints;
                    const denForIds = n.denForIds ?? [];
                    const victimLosses = n.victims.map((v) => {
                      return nv === 1
                        ? gameConfig.rankPoints[0] * 2 +
                            heoPtsOf(v.heo ?? { do: 0, den: 0 })
                        : ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });
                    });
                    gain = victimLosses.reduce((sum, loss) => sum + loss, 0);
                  } else {
                    n.victims.forEach((v) => {
                      gain += ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });
                    });
                  }
                  if (nv === 2) gain += gameConfig.nhotBystanderPenalty;
                }

                const caseLabel =
                  nv === 1 ? "Nhốt 1" : nv === 2 ? "Nhốt 2" : "Nhốt 3";
                const caseColor = nv === 3 ? "bg-primary" : "bg-chart-3";
                return (
                  <div
                    key={n.id}
                    className="flex flex-col gap-3 rounded-3xl border border-chart-3/20 bg-chart-3/10 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black text-background ${caseColor}`}
                        >
                          {caseLabel}
                        </span>
                        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Người nhốt
                        </p>
                        <div className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-background px-3 py-2 font-black text-primary">
                          <Crown className="size-3.5" />
                          {pShort(n.nhotterId)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Điểm nhận
                        </p>
                        <p className="mt-1 text-2xl font-black text-chart-2">
                          +{gain}
                        </p>
                      </div>
                    </div>

                    {n.dennerId && denForIds.length > 0 && (
                      <div className="rounded-2xl border border-destructive/15 bg-destructive/5 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-destructive">
                          Người đền bài
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-background px-3 py-1.5 text-xs font-black text-destructive ring-1 ring-destructive/20">
                            {pShort(n.dennerId)}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            đền cho{" "}
                            {denForIds.map((id) => pShort(id)).join(", ")}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          Mất {dennerLoss} điểm
                        </p>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Người bị nhốt
                      </p>
                      {n.victims.map((v) => {
                        const ecPts =
                          Math.abs(gameConfig.rankPoints[players.length - 1]) *
                          2;
                        const heoPtsOf = (heo: { do: number; den: number }) =>
                          heo.den * gameConfig.heodenPoints +
                          heo.do * gameConfig.heoDoPoints;

                        const baseLoss =
                          nv === 1
                            ? gameConfig.rankPoints[0] * 2 +
                              heoPtsOf(v.heo ?? { do: 0, den: 0 })
                            : ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });

                        const isDenFor = denForIds.includes(v.victimId);
                        const finalLoss = isDenFor
                          ? 0
                          : n.dennerId === v.victimId
                            ? baseLoss +
                              (denForIds.reduce(
                                (sum, victimId) =>
                                  sum + (denBaiLosses[victimId] ?? 0),
                                0,
                              ) ?? 0)
                            : baseLoss;

                        return (
                          <div
                            key={v.victimId}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-black text-destructive">
                                {pShort(v.victimId)}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(v.heo?.do ?? 0) > 0 && (
                                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                                    {v.heo?.do} Đỏ
                                  </span>
                                )}
                                {(v.heo?.den ?? 0) > 0 && (
                                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-black text-background">
                                    {v.heo?.den} Đen
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-sm font-black text-destructive">
                              {isDenFor ? "0" : `-${finalLoss}`}
                            </span>
                          </div>
                        );
                      })}

                      {nv === 2 &&
                        (() => {
                          const victimLoss = players.find(
                            (p) =>
                              !n.victims
                                .map((v) => v.victimId)
                                .includes(p.id) && p.id !== n.nhotterId,
                          );

                          if (!victimLoss) return null;

                          return (
                            <div className="flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
                              <span className="text-sm font-black text-destructive">
                                {pShort(victimLoss.id)}
                              </span>
                              <span className="text-sm font-black text-destructive">
                                -{gameConfig.nhotBystanderPenalty}
                              </span>
                            </div>
                          );
                        })()}
                    </div>

                    <Button
                      className="relative z-20 h-10 w-full text-xs font-black"
                      onClick={() => resetNhot()}
                    >
                      Chọn lại
                    </Button>
                  </div>
                );
              })}

            {!confirmNhot && (
              <div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Người nhốt
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setNhotForm((f) => ({
                            ...f,
                            nhotterId: p.id,
                            victims: f.victims.filter(
                              (v) => v.victimId !== p.id,
                            ),
                          }))
                        }
                        className={`relative z-10 rounded-2xl border px-3 py-2 font-black transition-colors ${
                          nhotForm.nhotterId === p.id
                            ? "border border-primary bg-chart-1/10 text-chart-1"
                            : "border-border bg-background/10 text-foreground hover:border-primary/40"
                        }`}
                      >
                        {pShort(p.id)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mt-4">
                    Người bị nhốt
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    {players
                      .filter((p) => p.id !== nhotForm.nhotterId)
                      .map((p) => {
                        const isVictim = nhotForm.victims.some(
                          (v) => v.victimId === p.id,
                        );
                        const victimData = nhotForm.victims.find(
                          (v) => v.victimId === p.id,
                        );
                        const vicTimHeoCount = victimData?.heo;

                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
                              isVictim
                                ? "border-destructive/25 bg-destructive/5"
                                : "border-border bg-background"
                            }`}
                          >
                            <div
                              className={`relative z-10 flex-1 font-black  ${isVictim ? "text-destructive" : "text-foreground"}`}
                              onClick={() => toggleNhotVictim(p.id)}
                            >
                              {pShort(p.id)}
                            </div>
                            {isVictim && (
                              <div className="flex gap-1">
                                {(["do", "den"] as HeoType[]).map((t) => (
                                  <div
                                    key={t}
                                    className="flex items-center gap-0.5 text-xs"
                                  >
                                    <span
                                      className={`rounded-full px-2 py-0.5 font-black ${
                                        t === "den"
                                          ? "bg-foreground text-background"
                                          : "bg-red-500 text-white"
                                      }`}
                                    >
                                      {t === "do" ? "Đỏ" : "Đen"}
                                    </span>
                                    <button
                                      onClick={() =>
                                        updateVictimHeo(p.id, t, -1)
                                      }
                                      className="relative z-10 size-6 rounded-full bg-muted/70 font-black"
                                    >
                                      −
                                    </button>
                                    <span className="w-4 text-center font-black">
                                      {vicTimHeoCount?.[t] ?? 0}
                                    </span>
                                    <button
                                      onClick={() =>
                                        updateVictimHeo(p.id, t, 1)
                                      }
                                      className="relative z-10 size-6 rounded-full bg-muted/70 font-black"
                                    >
                                      +
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {showDenBai && (
                  <div className="rounded-3xl border border-chart-3/20 bg-chart-3/10 p-4 mt-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Người đền bài
                        </p>
                        {/* <span className="text-xs text-muted-foreground">
                          Chọn 1 trong {dennerCandidates.length}
                        </span> */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowDenBai(false);
                            setDennerId(null);
                            setDenForIds([]);
                          }}
                          className="h-9 gap-1.5 text-xs font-bold sm:h-10 relative z-10"
                          type="submit"
                        >
                          <X className="size-5" />
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dennerCandidates.map((pid) => {
                          const selected = dennerId === pid;
                          return (
                            <button
                              key={pid}
                              onClick={() => {
                                setDennerId(pid);
                                setDenForIds(
                                  denForCandidates.filter((id) => id !== pid),
                                );
                              }}
                              className={`relative z-10 rounded-2xl border px-3 py-2 font-black transition-colors ${
                                selected
                                  ? "border-destructive bg-destructive/10 text-destructive"
                                  : "border-border bg-background text-foreground hover:border-destructive/30"
                              }`}
                            >
                              {pShort(pid)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {dennerId && denForCandidates.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Người được đền
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {denForCandidates.map((pid) => {
                            const selected = denForIds.includes(pid);
                            return (
                              <button
                                key={pid}
                                onClick={() =>
                                  setDenForIds((prev) =>
                                    prev.includes(pid)
                                      ? prev.filter((id) => id !== pid)
                                      : [...prev, pid],
                                  )
                                }
                                className={`relative z-10 rounded-2xl border px-3 py-2 font-black transition-colors ${
                                  selected
                                    ? "border-chart-1 bg-chart-1/20 text-chart-1"
                                    : "border-border bg-background text-foreground hover:border-chart-1/30"
                                }`}
                              >
                                {pShort(pid)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {nhotFormVictimIds.length > 1 && !showDenBai && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative z-10 h-10 font-black w-full mt-2"
                    onClick={() => setShowDenBai(true)}
                  >
                    <Plus className="size-3.5" />
                    Đền bài
                  </Button>
                )}
                <div className="grid grid-cols-[8fr_2fr] gap-2 pt-1 mt-2 relative z-20 ">
                  {!confirmNhot ? (
                    <>
                      <Button
                        size="sm"
                        className="relative z-10 h-10 font-black"
                        onClick={addNhot}
                        disabled={
                          !nhotForm.nhotterId || nhotForm.victims.length === 0
                        }
                      >
                        Chốt nhốt {dennerId ? "và đền bài" : ""}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="relative z-10 h-10 font-black"
                        onClick={() => removeNhot()}
                      >
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="relative z-10 h-10 font-black"
                      onClick={() => resetNhot()}
                    >
                      Chọn lại
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Chặt heo ─────────────────────────── */}
      {showChatHeo && (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                <Scissors className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Chặt Heo</p>
                <p className="text-xs text-muted-foreground">
                  {chatHeoList.length > 0
                    ? `${chatHeoList.length} lượt chặt heo`
                    : "Thêm lượt chặt heo nếu có"}
                </p>
              </div>
            </div>
            {nhotCount === 3 && (
              <p className="text-xs font-medium italic text-muted-foreground">
                Nhốt tất cả · không tính chặt heo
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowChatHeoForm(false);
                setShowChatHeo(false);
                setChatHeoList([]);
                setChatForm({
                  chatterId: "",
                  victimId: "",
                  heo: { do: 0, den: 0 },
                });
              }}
              className="h-9 gap-1.5 text-xs font-bold sm:h-10 relative z-10"
              type="submit"
            >
              <X className="size-5" />
            </Button>
          </div>

          <CardContent className="flex flex-col gap-4 pt-0">
            {chatHeoList.length === 0 && showChatHeoForm && (
              <p className="text-sm text-muted-foreground">
                Chọn người chặt, người bị chặt và số lượng heo.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {chatHeoList
                .filter((c) => !nhotVictimIds.includes(c.victimId))
                .map((c) => {
                  const pts =
                    (c.heo.do ?? 0) * gameConfig.heoDoPoints +
                    (c.heo.den ?? 0) * gameConfig.heodenPoints;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-1 rounded-2xl border border-red-500/20 bg-red-500/10 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                        <span className="font-black">
                          {pShort(c.chatterId)}
                        </span>
                        <Scissors className="size-3.5 text-muted-foreground" />
                        <span className="font-black">{pShort(c.victimId)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {(c.heo.do ?? 0) > 0 && (
                          <span className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white">
                            {c.heo.do} Đỏ
                          </span>
                        )}
                        {(c.heo.den ?? 0) > 0 && (
                          <span className="rounded-full bg-foreground px-2 py-1 text-[10px] font-black text-background">
                            {c.heo.den} Đen
                          </span>
                        )}
                        <span className="text-sm font-black text-chart-2">
                          +{pts}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          / -{pts}
                        </span>
                        <button
                          onClick={() => removeChatHeo(c.id)}
                          className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              {showChatHeoForm && nhotCount < 3 ? (
                <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-muted/35 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Người chặt
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {players
                        .filter((p) => !nhotVictimIds.includes(p.id))
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() =>
                              setChatForm((f) => ({
                                ...f,
                                chatterId: p.id,
                                victimId:
                                  f.victimId &&
                                  nhotVictimIds.includes(f.victimId)
                                    ? ""
                                    : f.victimId,
                              }))
                            }
                            className={`relative z-10 rounded-2xl border px-3 py-2 font-black transition-colors ${
                              chatForm.chatterId === p.id
                                ? "border border-primary bg-chart-1/10 text-chart-1"
                                : "border-border bg-background/10 text-foreground hover:border-primary/40"
                            }`}
                          >
                            {pShort(p.id)}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Người bị chặt
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1 relative z-10">
                      {players
                        .filter(
                          (p) =>
                            p.id !== chatForm.chatterId &&
                            !nhotVictimIds.includes(p.id),
                        )
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() =>
                              setChatForm((f) => ({ ...f, victimId: p.id }))
                            }
                            className={`relative z-10 rounded-2xl border px-3 py-2 font-black transition-colors ${
                              chatForm.victimId === p.id
                                ? "border-destructive bg-destructive/10 text-destructive"
                                : "border-border bg-background/10 text-foreground hover:border-destructive/30"
                            }`}
                          >
                            {pShort(p.id)}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Số lượng heo
                    </p>
                    <div className="mt-2 flex gap-0.5">
                      {(["do", "den"] as HeoType[]).map((t) => (
                        <div
                          key={t}
                          className="flex flex-1 items-center justify-between gap-0.5 rounded-2xl border border-border/70 bg-background p-2"
                        >
                          <span
                            className={`rounded-full px-2 py-1 text-[12px] font-black ${
                              t === "den"
                                ? "bg-foreground text-background"
                                : "bg-red-500 text-white"
                            }`}
                          >
                            {t === "do" ? "Đỏ" : "Đen"}
                          </span>
                          <button
                            onClick={() => updateChatFormHeo(t, -1)}
                            className="size-7 rounded-full bg-muted/70 font-black relative z-10"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-sm font-black">
                            {chatForm.heo[t]}
                          </span>
                          <button
                            onClick={() => updateChatFormHeo(t, 1)}
                            className="size-7 rounded-full bg-muted/70 font-black relative z-10"
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-[8fr_2fr] gap-2 pt-1 relative z-10">
                    <Button
                      size="sm"
                      className="h-10 font-black opacity-80"
                      onClick={addChatHeo}
                      disabled={
                        !chatForm.chatterId ||
                        !chatForm.victimId ||
                        (chatForm.heo.do === 0 && chatForm.heo.den === 0)
                      }
                    >
                      Chốt chặt heo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-10 font-black"
                      onClick={() => setShowChatHeoForm(false)}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="relative z-10 h-9 gap-1 font-black"
                  onClick={() => setShowChatHeoForm((v) => !v)}
                >
                  <Plus className="size-3.5" />
                  Thêm
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Xếp hạng ─────────────────────────────────────── */}
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Crown className="size-4" />
                </div>
                <div>
                  <div>Xếp hạng</div>
                  <p className="text-xs text-muted-foreground">
                    {!activeNhot
                      ? "Chọn thứ tự người chơi"
                      : nhotCount === 3
                        ? "Nhốt tất cả · không tính hạng"
                        : nhotCount === 2
                          ? "Nhốt 2 · người chơi còn lại đồng hạng 3"
                          : "Nhốt 1 · chọn hạng 2 và 3 cho 2 người chơi còn lại"}
                  </p>
                </div>
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {activeNhot && rankViewMode === "list" && (
                <span className="rounded-full bg-chart-3/10 px-3 py-1 text-xs font-black text-chart-3 ring-1 ring-chart-3/20">
                  {selectCounter}/{requiredSelections}
                </span>
              )}
              <div className="flex rounded-xl border border-border/70 bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    rankViewMode === "list"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Danh sách xếp hạng"
                >
                  <List className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    rankViewMode === "table"
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Bàn tròn"
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          {rankViewMode === "table" ? (
            <CircularTable
              players={players}
              ranking={ranking}
              selectOrder={selectOrder}
              toggleSelect={toggleSelect}
              selectableIds={selectableIds}
              selectCounter={selectCounter}
              requiredSelections={requiredSelections}
              computedScores={computedScores}
              activeNhot={activeNhot}
              nhotCount={nhotCount}
              nhotterId={nhotterId}
              nhotVictimIds={nhotVictimIds}
              denForIds={denForIds}
              khapWinner={khapWinner}
              khapCount={khapCount}
              sanhWinner={sanhWinner}
              toggleKhapPlayer={toggleKhapPlayer}
              updateKhapCount={updateKhapCount}
              toggleSanhPlayer={toggleSanhPlayer}
              chatHeoList={chatHeoList}
              accumulated={accumulated}
              gameConfig={gameConfig}
              getRowMeta={getRowMeta}
              save={handleSave}
              disabledSaveButton={
                isSaving ||
                (submitted && fetcher.data?.success) ||
                !rankingComplete ||
                !currentParticipant
              }
            />
          ) : (
            ranking.map((playerId, rankIndex) => {
              const player = players.find((p) => p.id === playerId)!;
              const pIdx = players.findIndex((p) => p.id === playerId);
              const order = selectOrder[pIdx];
              const isSelectable = selectableIds.includes(playerId);
              const isSelected = order !== null;
              const score = computedScores[playerId];
              const { label, labelColor, style, isFixed } = getRowMeta(
                playerId,
                rankIndex,
              );

              const showAsActive = isFixed || isSelected;

              const isKhapWinner = khapWinner === playerId;
              const isSanhWinner = sanhWinner === playerId;
              const khapTaken = khapWinner !== null && !isKhapWinner;
              const sanhTaken = sanhWinner !== null && !isSanhWinner;
              const khapCountDisplay = isKhapWinner ? khapCount : 0;
              const khapPtsDisplay =
                isKhapWinner && khapCount > 0
                  ? accumulated.khap * khapCount * gameConfig.khapPoints * 3
                  : 0;
              // ── THÊM MỚI: điểm âm khạp/sảnh cho người không phải winner ──
              const khapPtsLoss =
                !isKhapWinner && khapWinner !== null && khapCount > 0
                  ? accumulated.khap * khapCount * gameConfig.khapPoints
                  : 0;
              const effectiveSanh = isSanhWinner ? accumulated.sanh : 0;
              const sanhPtsDisplay = isSanhWinner
                ? accumulated.sanh * gameConfig.sanhPoints * 3
                : 0;
              const sanhPtsLoss =
                !isSanhWinner && sanhWinner !== null
                  ? accumulated.sanh * gameConfig.sanhPoints
                  : 0;

              const nextInRanking = ranking[rankIndex + 1];
              const nextIdx = nextInRanking
                ? players.findIndex((p) => p.id === nextInRanking)
                : -1;
              const canMoveDown =
                !isFixed &&
                isSelectable &&
                rankIndex < ranking.length - 1 &&
                nextIdx !== -1 &&
                selectableIds.includes(nextInRanking) &&
                selectOrder[nextIdx] !== null;
              const canMoveUp =
                !isFixed &&
                isSelectable &&
                rankIndex > 0 &&
                selectableIds.includes(ranking[rankIndex - 1]) &&
                selectOrder[
                  players.findIndex((p) => p.id === ranking[rankIndex - 1])
                ] !== null;

              const showBonus =
                showAsActive ||
                (selectCounter >= selectableIds.length - 1 &&
                  rankIndex === ranking.length - 1 &&
                  !isFixed);

              // ── THÊM MỚI: lọc danh sách chặt heo liên quan đến player này ──
              const chatHeoAsChatter = chatHeoList.filter(
                (c) =>
                  c.chatterId === playerId &&
                  !nhotVictimIds.includes(c.victimId),
              );
              const chatHeoAsVictim = chatHeoList.filter(
                (c) =>
                  c.victimId === playerId &&
                  !nhotVictimIds.includes(c.victimId),
              );

              return (
                <div
                  key={playerId}
                  className={`relative z-10 overflow-hidden rounded-3xl border transition-all ${
                    showAsActive
                      ? "border-border/70 bg-card shadow-sm"
                      : "border-border/30 bg-muted/20 opacity-75"
                  } ${showAsActive ? style : ""}`}
                >
                  <div
                    onClick={() =>
                      isSelectable && !isFixed && toggleSelect(playerId)
                    }
                    className={`relative z-10 flex w-full items-center gap-2 px-3 py-3 text-left transition-colors ${
                      isSelectable && !isFixed
                        ? "cursor-pointer hover:bg-background/60"
                        : "cursor-default"
                    }`}
                  >
                    {/* Badge */}
                    {isFixed ? (
                      <span
                        className={`flex shrink-0 items-center justify-center size-6 rounded-full text-xs font-black ${
                          playerId === nhotterId
                            ? "bg-primary text-primary-foreground"
                            : nhotVictimIds.includes(playerId)
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {playerId === nhotterId ? (
                          <Crown className="size-3" />
                        ) : denForIds.includes(playerId) ? (
                          "—"
                        ) : nhotVictimIds.includes(playerId) ? (
                          "✕"
                        ) : (
                          "3"
                        )}
                      </span>
                    ) : (
                      <span
                        className={`relative z-10 flex shrink-0 items-center justify-center size-4 p-4 rounded-full font-black transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "border border-muted-foreground/20 bg-muted text-muted-foreground"
                        }`}
                      >
                        {isSelected ? order : "·"}
                      </span>
                    )}

                    {/* Label hạng */}
                    <span
                      className={`shrink-0 w-14 font-black ${
                        showAsActive ? labelColor : "text-muted-foreground"
                      }`}
                    >
                      {showAsActive ? label : ""}
                    </span>

                    <span className="min-w-0 flex-1 truncate font-black">
                      {player.name}
                    </span>

                    {showAsActive && (
                      <span
                        className={`shrink-0 text-sm font-black tabular-nums ${scoreColor(score)}`}
                      >
                        {scoreFmt(score)}
                      </span>
                    )}

                    {isSelected && !isFixed && (
                      <div
                        className="relative z-10 ml-1 flex shrink-0 flex-col gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => moveRank(playerId, "up")}
                          disabled={!canMoveUp}
                          className="relative z-10 flex size-6 items-center justify-center rounded-full bg-muted/70 font-black hover:bg-background disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => moveRank(playerId, "down")}
                          disabled={!canMoveDown}
                          className="relative z-10 flex size-6 items-center justify-center rounded-full bg-muted/70 font-black hover:bg-background disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Khạp + Sảnh ── */}
                  {showBonus && (
                    <div className="flex flex-wrap gap-2 px-3 pb-3">
                      {/* Khạp */}
                      <div
                        className={`inline-flex items-center gap-1 rounded-2xl border px-2.5 py-1 text-xs transition-colors ${
                          isKhapWinner
                            ? "border-chart-4/40 bg-chart-4/10 text-chart-4"
                            : khapTaken
                              ? "border-destructive/20 bg-destructive/5 text-destructive"
                              : "border-border bg-muted/35 text-muted-foreground"
                        }`}
                      >
                        <button
                          onClick={() => toggleKhapPlayer(playerId)}
                          className="relative z-10 flex items-center gap-1 font-black hover:opacity-80"
                          disabled={nhotVictimIds.includes(playerId)}
                        >
                          <Flame className="size-3.5" />
                          <span>Khạp</span>
                        </button>
                        {isKhapWinner && (
                          <>
                            <span className="mx-0.5 opacity-30">|</span>
                            <button
                              onClick={() => updateKhapCount(-1)}
                              disabled={khapCount <= 1}
                              className="relative z-10 size-5 rounded-full bg-background font-black disabled:opacity-30"
                            >
                              −
                            </button>
                            <span className="w-4 text-center font-black">
                              {khapCountDisplay}
                            </span>
                            <button
                              onClick={() => updateKhapCount(1)}
                              disabled={
                                khapCount >= gameConfig.maxKhapAccumulate
                              }
                              className="relative z-10 size-5 rounded-full bg-background font-black disabled:opacity-30"
                            >
                              +
                            </button>
                            <span className="mx-1 opacity-30">|</span>
                            <span className="font-black">
                              +{khapPtsDisplay}
                            </span>
                          </>
                        )}
                        {/* ── THÊM MỚI: điểm âm khạp cho người còn lại ── */}
                        {!isKhapWinner && khapPtsLoss > 0 && (
                          <>
                            <span className="mx-0.5 opacity-30">|</span>
                            <span className="font-black text-destructive">
                              -{khapPtsLoss}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Sảnh */}
                      <button
                        onClick={() => toggleSanhPlayer(playerId)}
                        disabled={nhotVictimIds.includes(playerId)}
                        className={`relative z-10 inline-flex items-center gap-1 rounded-2xl border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed ${
                          isSanhWinner
                            ? "border-chart-1/40 bg-chart-1/10 text-chart-1"
                            : sanhTaken
                              ? "border-destructive/20 bg-destructive/5 text-destructive"
                              : "border-border bg-muted/35 text-muted-foreground hover:border-chart-1/30"
                        }`}
                      >
                        <Spade className="size-3.5" />
                        <span className="font-black">Sảnh</span>
                        {isSanhWinner && (
                          <>
                            <span className="font-black">{effectiveSanh}</span>
                            <span className="mx-0.5 opacity-30">|</span>
                            <span className="font-black">
                              +{sanhPtsDisplay}
                            </span>
                          </>
                        )}
                        {/* ── THÊM MỚI: điểm âm sảnh cho người còn lại ── */}
                        {!isSanhWinner && sanhPtsLoss > 0 && (
                          <>
                            <span className="mx-0.5 opacity-30">|</span>
                            <span className="font-black text-destructive">
                              -{sanhPtsLoss}
                            </span>
                          </>
                        )}
                      </button>

                      {/* ── THÊM MỚI: Chặt heo trong row player ── */}
                      {showBonus &&
                        (chatHeoAsChatter.length > 0 ||
                          chatHeoAsVictim.length > 0) && (
                          <div className="flex flex-col gap-1">
                            {/* Người chặt */}
                            {chatHeoAsChatter.map((c) => {
                              const pts =
                                (c.heo.do ?? 0) * gameConfig.heoDoPoints +
                                (c.heo.den ?? 0) * gameConfig.heodenPoints;
                              return (
                                <div
                                  key={c.id}
                                  className="inline-flex items-center gap-1 rounded-2xl border border-chart-2/30 bg-chart-2/10 px-2 py-1 text-xs text-chart-2"
                                >
                                  {(c.heo.do ?? 0) > 0 && (
                                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-normal text-white">
                                      {c.heo.do} Đỏ
                                    </span>
                                  )}
                                  {(c.heo.den ?? 0) > 0 && (
                                    <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-black leading-normal text-background">
                                      {c.heo.den} Đen
                                    </span>
                                  )}

                                  <span className="font-black">+{pts}</span>
                                </div>
                              );
                            })}

                            {/* Người bị chặt */}
                            {chatHeoAsVictim.map((c) => {
                              const pts =
                                (c.heo.do ?? 0) * gameConfig.heoDoPoints +
                                (c.heo.den ?? 0) * gameConfig.heodenPoints;
                              return (
                                <div className="inline-flex items-center gap-1 rounded-2xl border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                                  {(c.heo.do ?? 0) > 0 && (
                                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-normal text-white">
                                      {c.heo.do} Đỏ
                                    </span>
                                  )}
                                  {(c.heo.den ?? 0) > 0 && (
                                    <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-black leading-normal text-background">
                                      {c.heo.den} Đen
                                    </span>
                                  )}
                                  <span className="font-black">-{pts}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Kết quả tạm tính */}
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-chart-2/10 text-chart-2">
              <CheckCircle2 className="size-4" />
            </div>
            Kết quả tạm tính
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {players.map((player) => {
              const sc = computedScores[player.id];
              return (
                <div
                  key={player.id}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-colors ${scoreBoxClass(sc)}`}
                >
                  <span className="text-xs font-black uppercase tracking-wide opacity-70">
                    {pShort(player.id)}
                  </span>
                  <span className="text-xl font-black tabular-nums">
                    {scoreFmt(sc)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {fetcher.data?.error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-center text-sm font-semibold text-destructive">
          {fetcher.data.error}
        </div>
      )}

      {/* Submit */}
      <Button
        size="lg"
        className="sticky bottom-24 z-20 h-14 w-full gap-2 rounded-2xl text-sm font-black shadow-xl shadow-primary/20"
        disabled={
          isSaving ||
          (submitted && fetcher.data?.success) ||
          !rankingComplete ||
          !currentParticipant
        }
        onClick={handleSave}
      >
        {isSaving ? (
          <>
            <Swords className="size-4 animate-pulse" />
            Đang lưu ván đấu...
          </>
        ) : submitted && fetcher.data?.success ? (
          <>
            <CheckCircle2 className="size-4" />
            Đã lưu ván đấu
          </>
        ) : !rankingComplete ? (
          <>
            <Swords className="size-4" />
            {activeNhot
              ? `Chọn hạng 2 và 3 (${selectCounter}/${requiredSelections})`
              : `Chọn đủ người chơi (${selectCounter}/${players.length})`}
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4" />
            Lưu ván {currentRoundNo}
          </>
        )}
      </Button>
    </main>
  );
}
