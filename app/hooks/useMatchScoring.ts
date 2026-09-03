/**
 * hooks/useMatchScoring.ts
 *
 * Tách toàn bộ logic tính điểm / state / effects của trang Ván Đấu
 * (match.tsx) ra khỏi phần render. Component match.tsx chỉ còn là
 * "view" mỏng, gọi hook này và truyền kết quả vào các component con.
 *
 * Logic tính điểm nằm ở helpers/match.helper (computedScoresHelper) và
 * được giữ nguyên 100% hành vi.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { doReadNumber, ReadingConfig } from "read-vietnamese-number";

import {
  useCurrentParticipant,
  useGameConfig,
  usePlayers,
  useSessionStore,
  type Round,
} from "~/stores/useSessionStore";
import {
  onRoundFinished,
  onScoreUpdated,
  onRoundDeleted,
  offRoundFinished,
  offScoreUpdated,
  offRoundDeleted,
  publishRound,
  publishRoundDeleted,
  setSessionPaused,
  onSessionPaused,
  offSessionPaused,
} from "~/lib/socket.client";
import {
  buildPigCounts,
  computedScoresHelper,
  playTTS,
  reRanking,
} from "~/helpers/match.helper";
import type {
  ChatHeo,
  GameConfigs,
  HeoType,
  MatchLoaderData,
  NhotBai,
  VictimHeo,
} from "~/types/match.type";

const readingConfig = new ReadingConfig();
readingConfig.unit = [""];

type SaveRoundActionData = {
  success?: boolean;
  roundNo?: number;
  round?: Round;
  totals?: Array<{ playerId: string; totalScore: number }>;
  error?: string;
};

type DeleteRoundActionData = { success?: boolean; error?: string };

export interface UseMatchScoringArgs {
  sessionCode: string;
  loaderData: MatchLoaderData;
}

export function useMatchScoring({ sessionCode, loaderData }: UseMatchScoringArgs) {
  const players = usePlayers();
  const config = useGameConfig();
  const currentParticipant = useCurrentParticipant();
  const addRound = useSessionStore((s) => s.addRound);
  const setTotals = useSessionStore((s) => s.setTotals);
  const session = useSessionStore((s) => s.session);

  const fetcher = useFetcher<SaveRoundActionData>();
  const matchLoaderFetcher = useFetcher<MatchLoaderData>();
  const deleteFetcher = useFetcher<DeleteRoundActionData>();
  const isDeletingRound = deleteFetcher.state !== "idle";
  const handledSaveRoundRef = useRef<number | null>(null);
  const deletedRoundIdRef = useRef<string | null>(null);

  // Tránh chạy reset/roundMeta 2 lần khi action response VÀ socket
  // round:finished về gần như đồng thời.
  const handledRoundNoRef = useRef<number | null>(null);

  // ── Trạng thái tạm dừng (realtime, từ socket) ────────────────
  const isPaused = session?.paused ?? false;
  const isOwner =
    !!currentParticipant &&
    !!session &&
    session.ownerParticipantId === currentParticipant.id;

  /** Chủ phòng toggle tạm dừng / tiếp tục phiên chơi. */
  const togglePause = () => {
    if (!isOwner) return;
    setSessionPaused(sessionCode, !isPaused);
  };

  // ── Realtime overrides (cập nhật tức thì từ socket, không refetch) ──
  const [totalsOverride, setTotalsOverride] = useState<Record<
    string,
    number
  > | null>(null);
  const [roundMetaOverride, setRoundMetaOverride] =
    useState<MatchLoaderData["roundMeta"] | null>(null);

  const toTotalsMap = (
    totals: Array<{ playerId: string; totalScore: number }>,
  ) => Object.fromEntries(totals.map((t) => [t.playerId, t.totalScore]));

  const basePlayerTotals =
    matchLoaderFetcher.data?.playerTotals ?? loaderData.playerTotals;
  const playerTotals = useMemo(() => {
    if (!totalsOverride) return basePlayerTotals;
    return basePlayerTotals.map((pt) => ({
      ...pt,
      totalScore: totalsOverride[pt.playerId] ?? pt.totalScore,
    }));
  }, [basePlayerTotals, totalsOverride]);

  const roundMeta =
    roundMetaOverride ??
    matchLoaderFetcher.data?.roundMeta ??
    loaderData.roundMeta;

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
      nhotBystanderPenalty:
        config?.nhotBystanderPenalty ?? Math.abs(config?.thirdPlaceScore ?? 2),
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const playerIdsKey = useMemo(
    () => players.map((p) => p.id).join(","),
    [players],
  );

  /**
   * Reset toàn bộ state nhập điểm về trạng thái "ván mới".
   * Dùng chung cho cả người vừa lưu (optimistic) và các client khác
   * nhận event round:finished — đảm bảo bảng tiến tới ván kế tiếp đồng bộ.
   */
  const resetScoringState = () => {
    const playerCount = useSessionStore.getState().players.length;
    setSelectOrder(Array(playerCount).fill(null));
    setKhapWinner(null);
    setKhapCount(0);
    setSanhWinner(null);
    setChatHeoList([]);
    setChatForm({ chatterId: "", victimId: "", heo: { do: 0, den: 0 } });
    setShowChatHeoForm(false);
    setShowChatHeo(false);
    setNhotList([]);
    setSubmitted(false);
    setConfirmNhot(false);
    setNhotForm({ nhotterId: "", victims: [] });
    setDennerId(null);
    setDenForIds([]);
    setShowDenBai(false);
    setExpandBonus(false);
  };

  // Refs phục vụ visibility-change handler — đọc state mới nhất qua .current
  // thay vì capture từ closure (stale closure khi effect chạy 1 lần).
  const fetcherStateRef = useRef(fetcher.state);
  const deleteFetcherStateRef = useRef(deleteFetcher.state);
  const matchLoaderFetcherRef = useRef(matchLoaderFetcher);
  fetcherStateRef.current = fetcher.state;
  deleteFetcherStateRef.current = deleteFetcher.state;
  matchLoaderFetcherRef.current = matchLoaderFetcher;

  // Khi đổi session thì reset các ref đã track để tránh skip vòng đời mới.
  const sessionCodeRef = useRef(sessionCode);
  if (sessionCodeRef.current !== sessionCode) {
    handledSaveRoundRef.current = null;
    handledRoundNoRef.current = null;
    deletedRoundIdRef.current = null;
    sessionCodeRef.current = sessionCode;
  }

  useEffect(() => {
    if (!sessionCode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // Đọc qua ref để luôn lấy state mới nhất, tránh stale closure.
      if (fetcherStateRef.current !== "idle") return;
      if (deleteFetcherStateRef.current !== "idle") return;

      matchLoaderFetcherRef.current.load(`/session/${sessionCode}/match`);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionCode]);

  useEffect(() => {
    if (deleteFetcher.state !== "idle") return;
    if (!(deleteFetcher.data as DeleteRoundActionData)?.success) return;
    if (sessionCode) {
      matchLoaderFetcher.load(`/session/${sessionCode}/match`);
      if (deletedRoundIdRef.current) {
        publishRoundDeleted(sessionCode, deletedRoundIdRef.current);
        deletedRoundIdRef.current = null;
      }
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

  // Khi matchLoaderFetcher trả về data mới (sau khi load), clear override
  // để roundMeta lấy từ loader (server-authoritative) thay vì từ override cũ.
  useEffect(() => {
    if (matchLoaderFetcher.state !== "idle") return;
    if (!matchLoaderFetcher.data) return;
    setRoundMetaOverride(null);
    // totalsOverride giữ để tránh flicker, sẽ tự khớp với totals mới từ loader
    // nhờ playerTotals useMemo so sánh theo playerId.
  }, [matchLoaderFetcher.state, matchLoaderFetcher.data]);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const data = fetcher.data;
    if (!data?.success || data.roundNo == null) return;
    // Tránh chạy 2 lần khi React render lại với cùng fetcher.data.
    if (handledSaveRoundRef.current === data.roundNo) return;
    handledSaveRoundRef.current = data.roundNo;
    // Đánh dấu để socket handler không reset 2 lần cho cùng roundNo.
    handledRoundNoRef.current = data.roundNo;

    // Optimistic update từ kết quả action (authoritative cho lần lưu này).
    if (data.round) addRound(data.round as unknown as Round);
    if (data.totals) {
      setTotals(data.totals);
      setTotalsOverride(toTotalsMap(data.totals));
    }

    // Reset bảng về ván mới ngay lập tức (không chờ broadcast).
    resetScoringState();

    // Quan trọng: chủ động reload loader để lấy roundMeta mới (currentRoundNo,
    // accumulated khap/sanh) từ server. Không phụ thuộc vào broadcast socket
    // (có thể chậm/reconnect). Nếu socket round:finished đến sau, nó sẽ
    // được chặn bởi handledRoundNoRef để tránh reset 2 lần.
    if (sessionCode) {
      matchLoaderFetcher.load(`/session/${sessionCode}/match`);
      // Báo Socket.IO server để broadcast cho cả phòng (authoritative).
      // Truyền participantId người ghi ván để họ không nhận thông báo (đã biết).
      publishRound(sessionCode, currentParticipant?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data, sessionCode]);

  useEffect(() => {
    if (!session?.code) return;

    const handleRoundFinished = (payload: {
      round: Round;
      roundMeta: MatchLoaderData["roundMeta"];
      totals: Array<{ playerId: string; totalScore: number }>;
    }) => {
      // Cập nhật store + override từ dữ liệu authoritative do server phát.
      addRound(payload.round);
      setTotals(payload.totals);
      setTotalsOverride(toTotalsMap(payload.totals));
      if (payload.roundMeta) setRoundMetaOverride(payload.roundMeta);

      // Nếu action response đã xử lý ván này (handledRoundNoRef khớp),
      // không reset 2 lần — chỉ cần roundMetaOverride là đủ (action đã
      // gọi matchLoaderFetcher.load, sẽ sớm có roundMeta mới).
      // Vẫn cập nhật store/override ở trên để đảm bảo dữ liệu authoritative.
      if (handledRoundNoRef.current === payload.round.roundNo) {
        return;
      }
      handledRoundNoRef.current = payload.round.roundNo;

      // Client khác (không phải người vừa lưu) chuyển sang bảng ván mới.
      resetScoringState();
    };

    const handleScoreUpdated = (payload: {
      totals: Array<{ playerId: string; totalScore: number }>;
    }) => {
      setTotals(payload.totals);
      setTotalsOverride(toTotalsMap(payload.totals));
    };

    const handleRoundDeleted = (payload: { roundId: string }) => {
      useSessionStore.getState().removeRound(payload.roundId);
      // Xoá override để lấy roundMeta mới nhất từ server (currentRoundNo giảm).
      setRoundMetaOverride(null);
      setTotalsOverride(null);
      // Reset ref để vòng đời sau hoạt động đúng.
      handledRoundNoRef.current = null;
      handledSaveRoundRef.current = null;
      if (sessionCode) {
        matchLoaderFetcher.load(`/session/${sessionCode}/match`);
      }
    };

    onRoundFinished(handleRoundFinished);
    onScoreUpdated(handleScoreUpdated);
    onRoundDeleted(handleRoundDeleted);

    return () => {
      offRoundFinished(handleRoundFinished);
      offScoreUpdated(handleScoreUpdated);
      offRoundDeleted(handleRoundDeleted);
    };
  }, [session?.code]);

  // ── Realtime: cập nhật trạng thái tạm dừng từ socket ──────────
  useEffect(() => {
    if (!session?.code) return;

    const handlePaused = (payload: {
      sessionCode: string;
      paused: boolean;
    }) => {
      if (payload.sessionCode !== session.code) return;
      useSessionStore.getState().setPaused(payload.paused);
    };

    onSessionPaused(handlePaused);
    return () => offSessionPaused(handlePaused);
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
      return [nhotterId!, ...nhotOthers, ...nhotVictimIds];
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
  const updateVictimHeo = (
    victimId: string,
    type: HeoType,
    delta: number,
  ) => {
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
    if (!currentParticipant || !rankingComplete || isSaving || isPaused) return;

    const pigCounts = buildPigCounts(
      players.map((p) => p.id),
      chatHeoList,
      activeNhot,
    );

    const rankingMap = reRanking(ranking, activeNhot);

    const results = players.map((player) => ({
      playerId: player.id,
      rank: rankingMap.get(player.id) ?? 0,
      score: computedScores[player.id],
      khapno: khapWinner
        ? khapWinner === player.id
          ? (accumulated?.khap ?? 1) * khapCount
          : -((accumulated?.khap ?? 1) * khapCount)
        : 0,
      sanhno: sanhWinner
        ? sanhWinner === player.id
          ? accumulated?.sanh ?? 1
          : -(accumulated?.sanh ?? 1)
        : 0,
      blackPigNo: pigCounts[player.id].black,
      redPigNo: pigCounts[player.id].red,
      nhotterId: activeNhot?.nhotterId ?? "",
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
        ? (accumulated?.khap ?? 1) < gameConfig.maxKhapAccumulate
          ? (accumulated?.khap ?? 1) + 1
          : gameConfig.maxKhapAccumulate
        : 1;

      const nextSanh = !sanhWinner
        ? (accumulated?.sanh ?? 1) < gameConfig.maxSanhAccumulate
          ? (accumulated?.sanh ?? 1) + 1
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

  const isSaving = fetcher.state !== "idle";
  const disabledSaveButton =
    isSaving ||
    (submitted && fetcher.data?.success) ||
    !rankingComplete ||
    !currentParticipant ||
    isPaused;
  const saveError = fetcher.data?.error;

  return {
    // data
    roundMeta,
    playerTotals,
    accumulated,
    currentRoundNo,
    currentRoundId,
    gameConfig,
    players,
    config,
    isReady,
    sorted,
    totalScore,
    // realtime / mutations
    isDeletingRound,
    isSaving,
    disabledSaveButton,
    saveError,
    isPaused,
    isOwner,
    togglePause,
    deleteRound: (roundId: string) => {
      deletedRoundIdRef.current = roundId;
      deleteFetcher.submit(
        { intent: "delete-round", roundId },
        { method: "post" },
      );
    },
    // scoring state
    selectOrder,
    khapWinner,
    khapCount,
    sanhWinner,
    chatHeoList,
    setChatHeoList,
    showChatHeoForm,
    setShowChatHeoForm,
    chatForm,
    setChatForm,
    nhotList,
    nhotForm,
    setNhotForm,
    nhotFormVictimIds,
    dennerId,
    setDennerId,
    denForIds,
    setDenForIds,
    dennerCandidates,
    denForCandidates,
    showDenBai,
    setShowDenBai,
    expandBonus,
    setExpandBonus,
    showChatHeo,
    setShowChatHeo,
    showBtnToTop,
    confirmNhot,
    confirmDeleteOpen,
    setConfirmDeleteOpen,
    scrollToTop,
    // derived
    activeNhot,
    nhotCount,
    nhotterId,
    nhotVictimIds,
    nhotOthers,
    denBaiLosses,
    selectableIds,
    requiredSelections,
    selectCounter,
    ranking,
    rankingComplete,
    computedScores,
    // handlers
    toggleSelect,
    toggleKhapPlayer,
    updateKhapCount,
    toggleSanhPlayer,
    addChatHeo,
    updateChatFormHeo,
    removeChatHeo,
    addNhot,
    removeNhot,
    resetNhot,
    toggleNhotVictim,
    updateVictimHeo,
    handleReset,
    closeNhotBai,
    handleSave,
    // ui helpers
    pShort,
    scoreFmt,
    scoreBoxClass,
    getRowMeta,
  };
}
