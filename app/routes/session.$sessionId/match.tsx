import { useState, useMemo, useEffect, useRef } from "react";
import { useFetcher, useLoaderData, useParams } from "react-router";
import type { Route } from "./+types/match";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { doReadNumber, ReadingConfig } from "read-vietnamese-number";
import {
  RotateCcw,
  Flame,
  Scissors,
  Lock,
  Plus,
  X,
  Crown,
  Trash,
  Spade,
  ArrowUpIcon,
  Loader2,
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
import { CircularTable3 } from "~/components/circular-table3";
import type {
  ChatHeo,
  HeoType,
  MatchLoaderData,
  NhotBai,
  VictimHeo,
} from "~/types/match.type";
import {
  buildPigCounts,
  computedScoresHelper,
  heatBackground,
  playTTS,
  PROGRESS_COLORS,
} from "~/helpers/match.helper";
import { ChatHeoDialog } from "~/components/match/chatheo-dialog";
import { NhotBaiDialog } from "~/components/match/nhotbai-dialog";

const readingConfig = new ReadingConfig();
readingConfig.unit = [""];

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

// ── Component ────────────────────────────────────────────────
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
  const deleteFetcher = useFetcher();
  const isDeletingRound = deleteFetcher.state !== "idle";
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

  const totalScore = playerTotals.reduce(
    (acc, pt) =>
      acc + (pt.totalScore !== null && pt.totalScore > 0 ? pt.totalScore : 0),
    0,
  );

  // ── State ─────────────────────────────────────────────────
  const [selectOrder, setSelectOrder] = useState<(number | null)[]>([]);
  const [khapWinner, setKhapWinner] = useState<string | null>(null);
  const [khapCount, setKhapCount] = useState(0);
  const [sanhWinner, setSanhWinner] = useState<string | null>(null);
  const [chatHeoList, setChatHeoList] = useState<ChatHeo[]>([]);
  const [showChatHeoForm, setShowChatHeoForm] = useState(false);
  const [showBtnToTop, setShowBtnToTop] = useState(false);
  const [chatForm, setChatForm] = useState<{
    chatterId: string;
    victimId: string;
    heo: { do: number; den: number };
  }>({ chatterId: "", victimId: "", heo: { do: 0, den: 0 } });
  const [nhotList, setNhotList] = useState<NhotBai[]>([]);
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

  const playerIdsKey = useMemo(
    () => players.map((p) => p.id).join(","),
    [players],
  );

  useEffect(() => {
    if (!sessionCode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // tránh refetch chồng lên lúc đang save/delete round
      if (fetcher.state !== "idle") return;
      if (deleteFetcher.state !== "idle") return;

      matchLoaderFetcher.load(`/session/${sessionCode}/match`);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  useEffect(() => {
    if (deleteFetcher.state !== "idle") return;
    if (!(deleteFetcher.data as any)?.success) return;
    if (sessionCode) {
      matchLoaderFetcher.load(`/session/${sessionCode}/match`);
    }
  }, [deleteFetcher.state, deleteFetcher.data, sessionCode]);

  useEffect(() => {
    window.addEventListener("scroll", () => {
      if (window.scrollY >= 360) {
        setShowBtnToTop(true);
      } else {
        setShowBtnToTop(false);
      }
    });
  }, [showBtnToTop]);

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

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

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
        chatterName:
          players.find((p) => p.id === chatForm.chatterId)?.name ?? "",
        victimId: chatForm.victimId,
        victimName: players.find((p) => p.id === chatForm.victimId)?.name ?? "",
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
  const computedScores = useMemo(
    () =>
      computedScoresHelper({
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
      }),
    [
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
    ],
  );

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

  const handleSave = async () => {
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

    await fetcher.submit(
      {
        intent: "save-round",
        createdBy: currentParticipant.id,
        payload: JSON.stringify(results),
      },
      { method: "post" },
    );
    setSubmitted(true);
    if (config?.enableTTS) {
      const nextKhap = !khapWinner
        ? accumulated.khap < gameConfig.maxKhapAccumulate
          ? accumulated.khap + 1
          : gameConfig.maxKhapAccumulate
        : 1;

      const nextSanh = !sanhWinner
        ? accumulated.sanh < gameConfig.maxSanhAccumulate
          ? accumulated.sanh + 1
          : gameConfig.maxSanhAccumulate
        : 1;
      if (nextKhap > 2 || nextSanh > 4) {
        const text = `Ván tiếp theo. Khạp ${doReadNumber(`${nextKhap}`, readingConfig)}. Sảnh ${doReadNumber(`${nextSanh}`, readingConfig)}.`;
        playTTS(text);
      }
    }
  };

  const pShort = (id: string) =>
    (players.find((p) => p.id === id)?.name ?? id).split(" ").pop()!;

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
    <>
      <main className="relative mx-auto flex max-w-3xl flex-col gap-4 px-3 pb-4 pt-6 sm:px-4">
        {/* Header */}
        <section
          style={{
            background: heatBackground(totalScore),
          }}
          className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-sm"
        >
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
                    <deleteFetcher.Form
                      method="post"
                      className="flex-1 sm:flex-none"
                    >
                      <input type="hidden" name="intent" value="delete-round" />
                      <input
                        type="hidden"
                        name="roundId"
                        value={currentRoundId}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDeletingRound}
                        className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
                        type="submit"
                      >
                        {isDeletingRound ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash className="size-3.5" />
                        )}
                      </Button>
                    </deleteFetcher.Form>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
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
                        style={{
                          ...(i < accumulated.khap
                            ? { backgroundColor: PROGRESS_COLORS[i] }
                            : {}),
                        }}
                        className={`h-2 rounded-full transition-all bg-muted`}
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
                        style={{
                          ...(i < accumulated.sanh
                            ? { backgroundColor: PROGRESS_COLORS[i] }
                            : {}),
                        }}
                        className={`h-2 rounded-full transition-all bg-muted`}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 my-4">
              {sorted.map((player, index) => {
                const score = player.totalScore ?? 0;
                return (
                  <div
                    key={player.playerId}
                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition-colors ${scoreBoxClass(score)}`}
                  >
                    <span className="text-xs tracking-wider font-black uppercase opacity-70 text-card-foreground">
                      {pShort(player.playerId)}
                    </span>
                    <span className="text-xl font-black tabular-nums">
                      {scoreFmt(score)}
                    </span>
                  </div>
                );
              })}
            </div>
            <CircularTable3
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
              isLoading={isSaving}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between relative z-20 mb-4">
            <div className="flex items-center justify-center gap-2 w-full">
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-9 gap-2 font-black text-sm"
                  onClick={() => setExpandBonus(true)}
                >
                  <Plus className="size-4" />
                  Nhốt bài
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-9 gap-2 font-black text-sm"
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
        </section>

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
                            Math.abs(
                              gameConfig.rankPoints[players.length - 1],
                            ) * 2;
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
                          <span className="font-black">
                            {pShort(c.victimId)}
                          </span>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="relative z-10 h-9 gap-1 font-black"
                  onClick={() => setShowChatHeoForm((v) => !v)}
                >
                  <Plus className="size-3.5" />
                  Thêm
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {fetcher.data?.error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-center text-sm font-semibold text-destructive">
            {fetcher.data.error}
          </div>
        )}
      </main>
      <ChatHeoDialog
        open={showChatHeo && showChatHeoForm}
        onOpenChange={(o) => {
          setShowChatHeoForm(o);
          if (!o) setShowChatHeo(false);
        }}
        players={players}
        chatForm={chatForm}
        setChatForm={setChatForm}
        nhotVictimIds={nhotVictimIds}
        addChatHeo={addChatHeo}
        updateChatFormHeo={updateChatFormHeo}
        pShort={pShort}
      />

      <NhotBaiDialog
        open={expandBonus && !confirmNhot}
        onOpenChange={(o) => (o ? setExpandBonus(true) : closeNhotBai())}
        players={players}
        nhotForm={nhotForm}
        setNhotForm={setNhotForm}
        nhotFormVictimIds={nhotFormVictimIds}
        showDenBai={showDenBai}
        setShowDenBai={setShowDenBai}
        dennerId={dennerId}
        setDennerId={setDennerId}
        denForIds={denForIds}
        setDenForIds={setDenForIds}
        dennerCandidates={dennerCandidates}
        denForCandidates={denForCandidates}
        toggleNhotVictim={toggleNhotVictim}
        updateVictimHeo={updateVictimHeo}
        addNhot={addNhot}
        removeNhot={removeNhot}
        pShort={pShort}
      />
      {isDeletingRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-5 shadow-lg border border-border/70">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">
              Đang xóa ván đấu...
            </p>
          </div>
        </div>
      )}
      {showBtnToTop && (
        <div className="fixed z-20 bottom-24 right-6">
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              scrollToTop();
            }}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      )}
    </>
  );
}
