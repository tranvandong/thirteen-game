"use client";

import { useState, useMemo } from "react";
import { useParams } from "react-router";
// import type { Route } from "./+types/match";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Swords,
  CheckCircle2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Flame,
  Sparkles,
  Scissors,
  Lock,
  Plus,
  X,
  ChevronRight,
  ChevronDown as CollapseIcon,
  Crown,
} from "lucide-react";

// ── Config ───────────────────────────────────────────────────
const mockConfig = {
  rankPoints: [3, 1, -1, -3],
  khapPoints: 3,
  sanhPoints: 5,
  maxKhapAccumulate: 10,
  maxSanhAccumulate: 10,
  heoDoPoints: 3,
  heodenPoints: 5,
  nhotBystanderPenalty: 2,
};
const mockAccumulated = { khap: 5, sanh: 10 };
const mockPlayers = [
  { id: "p1", name: "Nguoi1" },
  { id: "p2", name: "Nguoi2" },
  { id: "p3", name: "Nguoi3" },
  { id: "p4", name: "Nguoi4" },
];
const mockCurrentRound = 6;

export async function loader() {
  return {};
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
}

// ── Component ────────────────────────────────────────────────
export default function MatchPage() {
  const { sessionId } = useParams();

  // ── State ─────────────────────────────────────────────────
  const [selectOrder, setSelectOrder] = useState<(number | null)[]>(
    mockPlayers.map(() => null),
  );
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
  const [expandBonus, setExpandBonus] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmNhot, setConfirmNhot] = useState(false);

  // ── Derived nhot state ────────────────────────────────────
  const activeNhot = nhotList[0] ?? null;
  const nhotCount = activeNhot ? activeNhot.victims.length : 0;
  const nhotterId = activeNhot?.nhotterId ?? null;
  const nhotVictimIds = activeNhot?.victims.map((v) => v.victimId) ?? [];
  const nhotOthers = mockPlayers
    .map((p) => p.id)
    .filter((id) => id !== nhotterId && !nhotVictimIds.includes(id));

  // ── Ranking logic phụ thuộc vào nhốt ─────────────────────
  const selectableIds = useMemo(() => {
    if (!activeNhot) return mockPlayers.map((p) => p.id);
    if (nhotCount === 3) return [];
    if (nhotCount === 2) return [];
    return nhotOthers;
  }, [activeNhot, nhotCount, nhotOthers]);

  const requiredSelections = selectableIds.length;

  const ranking = useMemo(() => {
    if (!activeNhot) {
      const selected = mockPlayers
        .map((p, i) => ({ p, order: selectOrder[i] }))
        .filter((x) => x.order !== null)
        .sort((a, b) => a.order! - b.order!)
        .map((x) => x.p.id);
      const unselected = mockPlayers
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

    const othersOrdered = mockPlayers
      .map((p, i) => ({ id: p.id, order: selectOrder[i] }))
      .filter((x) => nhotOthers.includes(x.id) && x.order !== null)
      .sort((a, b) => a.order! - b.order!)
      .map((x) => x.id);
    const othersUnselected = nhotOthers.filter((id) => {
      const i = mockPlayers.findIndex((p) => p.id === id);
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
    ? selectCounter === mockPlayers.length
    : nhotCount === 3
      ? true
      : nhotCount === 2
        ? true
        : selectCounter >= requiredSelections;

  // ── Helpers: ranking ─────────────────────────────────────
  const toggleSelect = (playerId: string) => {
    if (!selectableIds.includes(playerId)) return;
    const idx = mockPlayers.findIndex((p) => p.id === playerId);
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
    const idxA = mockPlayers.findIndex((p) => p.id === playerId);
    const idxB = mockPlayers.findIndex((p) => p.id === swapId);
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
      return Math.min(n, mockConfig.maxKhapAccumulate);
    });
  };
  const toggleSanhPlayer = (pid: string) => setSanhWinner(pid);

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

  // ── Helpers: nhot bai ────────────────────────────────────
  const addNhot = () => {
    if (!nhotForm.nhotterId || nhotForm.victims.length === 0) return;
    setSelectOrder(mockPlayers.map(() => null));
    setNhotList([
      {
        id: `nh-${Date.now()}`,
        nhotterId: nhotForm.nhotterId,
        victims: nhotForm.victims,
      },
    ]);
    setShowNhotForm(false);
    setConfirmNhot(true);
  };
  const removeNhot = () => {
    setNhotList([]);
    setSelectOrder(mockPlayers.map(() => null));
  };
  const toggleNhotVictim = (pid: string) => {
    setNhotForm((prev) => {
      const exists = prev.victims.find((v) => v.victimId === pid);
      return {
        ...prev,
        victims: exists
          ? prev.victims.filter((v) => v.victimId !== pid)
          : [...prev.victims, { victimId: pid, heo: { do: 0, den: 0 } }],
      };
    });
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
      mockPlayers.map((p) => [p.id, 0]),
    );
    const heoPts = (heo: { do: number; den: number }) =>
      heo.den * mockConfig.heodenPoints + heo.do * mockConfig.heoDoPoints;

    if (!activeNhot) {
      ranking.forEach((pid, i) => {
        s[pid] += mockConfig.rankPoints[i] ?? 0;
      });
    } else {
      const ecPts = Math.abs(mockConfig.rankPoints[mockPlayers.length - 1]);
      const victimHeoMap = Object.fromEntries(
        activeNhot.victims.map((v) => [v.victimId, v.heo]),
      );

      if (nhotCount === 1) {
        const vh = (victimHeoMap[nhotVictimIds[0]] as
          | { do: number; den: number }
          | undefined) ?? { do: 0, den: 0 };
        const hp = heoPts(vh);
        s[nhotterId!] += mockConfig.rankPoints[0] + hp;
        s[nhotVictimIds[0]] -= mockConfig.rankPoints[0] + hp;
        const othersInRanking = ranking.filter((id) => nhotOthers.includes(id));
        othersInRanking.forEach((oid, i) => {
          s[oid] += mockConfig.rankPoints[i + 1] ?? 0;
        });
      } else if (nhotCount === 2) {
        let gain = 0;
        activeNhot.victims.forEach(({ victimId, heo }) => {
          const loss = ecPts + heoPts(heo);
          s[victimId] -= loss;
          gain += loss;
        });
        s[nhotterId!] += gain;
        nhotOthers.forEach((oid) => {
          s[oid] -= mockConfig.nhotBystanderPenalty;
        });
      } else {
        let gain = 0;
        activeNhot.victims.forEach(({ victimId, heo }) => {
          const loss = ecPts + heoPts(heo);
          s[victimId] -= loss;
          gain += loss;
        });
        s[nhotterId!] += gain;
      }
    }

    // Khạp
    if (khapWinner && khapCount > 0) {
      const gain = mockAccumulated.khap * khapCount * mockConfig.khapPoints * 3;
      const loss = mockAccumulated.khap * khapCount * mockConfig.khapPoints;
      s[khapWinner] += gain;
      mockPlayers.forEach((p) => {
        if (p.id !== khapWinner) s[p.id] -= loss;
      });
    }
    // Sảnh
    if (sanhWinner) {
      const gain = mockAccumulated.sanh * mockConfig.sanhPoints * 3;
      const loss = mockAccumulated.sanh * mockConfig.sanhPoints;
      s[sanhWinner] += gain;
      mockPlayers.forEach((p) => {
        if (p.id !== sanhWinner) s[p.id] -= loss;
      });
    }
    // Chặt heo
    chatHeoList.forEach(({ chatterId, victimId, heo }) => {
      const pts =
        (heo.do ?? 0) * mockConfig.heoDoPoints +
        (heo.den ?? 0) * mockConfig.heodenPoints;
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
    setSelectOrder(mockPlayers.map(() => null));
    setKhapWinner(null);
    setKhapCount(0);
    setSanhWinner(null);
    setChatHeoList([]);
    setNhotList([]);
    setSubmitted(false);
  };

  const pShort = (id: string) =>
    (mockPlayers.find((p) => p.id === id)?.name ?? id).split(" ").pop()!;
  const scoreColor = (v: number) =>
    v > 0
      ? "text-chart-2"
      : v < 0
        ? "text-destructive"
        : "text-muted-foreground";
  const scoreFmt = (v: number) => (v > 0 ? `+${v}` : `${v}`);

  const getRowMeta = (playerId: string, rankIndex: number) => {
    if (activeNhot) {
      if (playerId === nhotterId)
        return {
          label: "Nhốt",
          labelColor: "text-primary",
          style: "border-primary/40 bg-primary/10",
          isFixed: true,
        };
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
  return (
    <main className="p-4 flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
            <Swords className="size-4" />
          </div>
          <span>Ván {mockCurrentRound}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1.5 text-muted-foreground h-8"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>
      <div className="flex gap-2">
        <div className="flex items-center gap-2 flex-1 rounded-lg bg-chart-4/10 border border-chart-4/20 px-3 py-2">
          <div className="flex flex-col w-full">
            <div className="flex justify-between items-center gap-2">
              <div>
                <span className="text-xs text-muted-foreground">Khạp</span>
                <div className="flex items-end gap-1">
                  <span className="text-lg font-bold text-chart-1 leading-none">
                    {mockAccumulated.khap}
                  </span>
                  <span className="text-xs text-muted-foreground mb-0.5">
                    / {mockConfig.maxKhapAccumulate}
                  </span>
                </div>
              </div>
              <Flame className="size-3.5 text-chart-1 shrink-0" />
            </div>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: mockConfig.maxKhapAccumulate }).map(
                (_, i) => (
                  <div
                    key={i}
                    className={`size-2 rounded-full ${i < mockAccumulated.khap ? "bg-chart-1" : "bg-chart-4/20"}`}
                  />
                ),
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 rounded-lg bg-chart-4/10 border border-chart-4/20 px-3 py-2">
          <div className="flex flex-col w-full">
            <div className="flex justify-between items-center gap-2">
              <div>
                <span className="text-xs text-muted-foreground">Sảnh</span>
                <div className="flex items-end gap-1">
                  <span className="text-lg font-bold text-chart-1 leading-none">
                    {mockAccumulated.sanh}
                  </span>
                  <span className="text-xs text-muted-foreground mb-0.5">
                    / {mockConfig.maxKhapAccumulate}
                  </span>
                </div>
              </div>
              <Flame className="size-3.5 text-chart-1 shrink-0" />
            </div>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: mockConfig.maxKhapAccumulate }).map(
                (_, i) => (
                  <div
                    key={i}
                    className={`size-2 rounded-full ${i < mockAccumulated.sanh ? "bg-chart-1" : "bg-chart-4/20"}`}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Nhốt bài ─────────────────────────── */}
      <Card className="p-2">
        <button
          onClick={() => setExpandBonus((v) => !v)}
          className="flex items-center justify-between w-full px-2 pt-2 pb-2"
        >
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-chart-3" />
            <span className="text-sm font-semibold">Nhốt Bài</span>
          </div>
          {expandBonus ? (
            <CollapseIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>

        {expandBonus && (
          <div className="flex flex-col gap-2 w-full">
            {confirmNhot &&
              nhotList.length > 0 &&
              nhotList.map((n) => {
                const nv = n.victims.length;
                const ecPts = Math.abs(
                  mockConfig.rankPoints[mockPlayers.length - 1],
                );
                const heoPtsOf = (heo: { do: number; den: number }) =>
                  heo.den * mockConfig.heodenPoints +
                  heo.do * mockConfig.heoDoPoints;
                let gain = 0;
                if (nv === 1) {
                  gain =
                    mockConfig.rankPoints[0] +
                    heoPtsOf(n.victims[0]?.heo ?? { do: 0, den: 0 });
                } else {
                  n.victims.forEach((v) => {
                    gain += ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });
                  });
                }
                const caseLabel =
                  nv === 1 ? "Nhốt 1" : nv === 2 ? "Nhốt 2" : "Nhốt 3";
                const caseColor = nv === 3 ? "bg-primary" : "bg-chart-3";
                return (
                  <div
                    key={n.id}
                    className="flex flex-col gap-2 items-center justify-between w-full px-3 py-2 rounded-lg bg-chart-3/10 border border-chart-3/30 text-xs"
                  >
                    <div className="flex flex-col gap-1.5 py-1.5 w-full">
                      <p className="text-xs text-muted-foreground mb-1">
                        Nguoi nhot:
                      </p>
                      <div className="flex justify-between gap-2 flex-wrap w-full">
                        <div
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors bg-primary text-primary-foreground border-primary"`}
                        >
                          {pShort(n.nhotterId)}
                        </div>
                        <span className="text-chart-2 font-bold">+{gain}đ</span>
                      </div>

                      <p className="text-xs text-muted-foreground mb-1">
                        Người bị nhốt:
                      </p>
                      {n.victims.map((v) => {
                        const ecPts = Math.abs(
                          mockConfig.rankPoints[mockPlayers.length - 1],
                        );
                        const heoPtsOf = (heo: { do: number; den: number }) =>
                          heo.den * mockConfig.heodenPoints +
                          heo.do * mockConfig.heoDoPoints;

                        const victimLoss =
                          nv === 1
                            ? mockConfig.rankPoints[0] +
                              heoPtsOf(v.heo ?? { do: 0, den: 0 })
                            : ecPts + heoPtsOf(v.heo ?? { do: 0, den: 0 });

                        return (
                          <div
                            key={v.victimId}
                            className="flex justify-between items-center w-full gap-2 px-2 py-1.5 rounded-md bg-destructive/10 border border-destructive/20"
                          >
                            <div className="text-xs font-medium flex-1 text-destructive">
                              {pShort(v.victimId)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {((v.heo?.do ?? 0) > 0 ||
                                (v.heo?.den ?? 0) > 0) && (
                                <span className="text-muted-foreground text-xs flex gap-1">
                                  {(v.heo?.do ?? 0) > 0 && (
                                    <span className="px-2 py-0.5 leading-normal rounded font-bold text-xs bg-red-500 text-white">
                                      {v.heo?.do} Đỏ
                                    </span>
                                  )}
                                  {(v.heo?.den ?? 0) > 0 && (
                                    <span className="px-2 py-0.5 leading-normal rounded font-bold text-xs bg-foreground text-background">
                                      {v.heo?.den} Đen
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            <span className="text-destructive font-bold text-xs">
                              -{victimLoss}đ
                            </span>
                          </div>
                        );
                      })}

                      {nv === 2 && (
                        <span className="text-muted-foreground">
                          (ngoai -{mockConfig.nhotBystanderPenalty}đ)
                        </span>
                      )}
                    </div>
                    <Button
                      className="h-8 text-xs w-full"
                      onClick={() => setConfirmNhot(false)}
                    >
                      Reset
                    </Button>
                  </div>
                );
              })}

            {!confirmNhot && (
              <div className="flex flex-col gap-2 p-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Nguoi nhot:
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {mockPlayers.map((p) => (
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
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${nhotForm.nhotterId === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-muted"}`}
                      >
                        {pShort(p.id)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Người bị nhốt:
                  </p>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {mockPlayers
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
                            className={`flex justify-between items-center w-full gap-2 px-2 py-1.5 rounded-md 
          ${isVictim ? "bg-destructive/10 border border-destructive/20" : "bg-muted border-muted py-[0.56rem]"}`}
                          >
                            <div
                              className={`text-xs font-medium w-10 flex-1 ${isVictim ? "text-destructive" : ""}`}
                              onClick={() => toggleNhotVictim(p.id)}
                            >
                              {pShort(p.id)}
                            </div>
                            {isVictim && (
                              <div className="flex gap-3">
                                {(["do", "den"] as HeoType[]).map((t) => (
                                  <div
                                    key={t}
                                    className="flex items-center gap-1 text-xs"
                                  >
                                    <span
                                      className={`px-2 py-0.5 leading-normal rounded font-bold text-xs ${t === "den" ? "bg-foreground text-background" : "bg-red-500 text-white"}`}
                                    >
                                      {t === "do" ? "Đỏ" : "Đen"}
                                    </span>
                                    <button
                                      onClick={() =>
                                        updateVictimHeo(p.id, t, -1)
                                      }
                                      className="size-4 flex items-center justify-center rounded bg-muted/60 font-bold text-xs"
                                    >
                                      −
                                    </button>
                                    <span className="w-3 text-center font-bold">
                                      {vicTimHeoCount?.[t] ?? 0}
                                    </span>
                                    <button
                                      onClick={() =>
                                        updateVictimHeo(p.id, t, 1)
                                      }
                                      className="size-4 flex items-center justify-center rounded bg-muted/60 font-bold text-xs"
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
                <div className="flex gap-2 pt-1">
                  {!confirmNhot ? (
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={addNhot}
                      disabled={
                        !nhotForm.nhotterId || nhotForm.victims.length === 0
                      }
                    >
                      Thêm
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setConfirmNhot(false)}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Chặt heo ─────────────────────────── */}
      <Card className="p-2 gap-0">
        <div className="flex items-center justify-between w-full px-2 pt-2 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Scissors className="size-3.5 text-red-400" />
              <span className="text-xs font-semibold">Chặt Heo</span>
            </div>
          </div>
          {nhotCount === 3 && (
            <p className="text-xs text-muted-foreground italic px-1">
              Nhốt tất cả · không tính chặt heo
            </p>
          )}
          {nhotCount < 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs px-2"
              onClick={() => setShowChatHeoForm((v) => !v)}
            >
              <Plus className="size-3" />
              Thêm
            </Button>
          )}
        </div>

        {(showChatHeoForm || chatHeoList.length > 0) && (
          <CardContent className="pt-0 flex flex-col gap-4 p-2">
            <div className="flex flex-col gap-2">
              {chatHeoList
                .filter((c) => !nhotVictimIds.includes(c.victimId))
                .map((c) => {
                  const pts =
                    (c.heo.do ?? 0) * mockConfig.heoDoPoints +
                    (c.heo.den ?? 0) * mockConfig.heodenPoints;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">
                          {pShort(c.chatterId)}
                        </span>
                        <Scissors className="size-3 text-muted-foreground" />
                        <span className="font-medium">
                          {pShort(c.victimId)}
                        </span>
                      </div>
                      <div>
                        {(c.heo.do ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 leading-normal rounded bg-red-500 text-white font-bold">
                            {c.heo.do} Đỏ
                          </span>
                        )}
                        {(c.heo.den ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 leading-normal rounded bg-foreground text-background font-bold">
                            {c.heo.den} Đen
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-chart-2 font-bold">+{pts}đ</span>
                        <span className="text-muted-foreground">/ -{pts}đ</span>
                        <button
                          onClick={() => removeChatHeo(c.id)}
                          className="text-muted-foreground hover:text-destructive ml-1"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              {showChatHeoForm && nhotCount < 3 && (
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/40 border border-muted">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Người chặt:
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {mockPlayers
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
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${chatForm.chatterId === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-muted"}`}
                          >
                            {pShort(p.id)}
                          </button>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Người bị chặt:
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {mockPlayers
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
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${chatForm.victimId === p.id ? "bg-destructive text-destructive-foreground border-destructive" : "bg-muted border-muted"}`}
                          >
                            {pShort(p.id)}
                          </button>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Số lượng heo:
                    </p>
                    <div className="flex gap-3 justify-between">
                      {(["do", "den"] as HeoType[]).map((t) => (
                        <div
                          key={t}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <span
                            className={`px-2 py-0.5 leading-normal rounded font-bold text-xs ${t === "den" ? "bg-foreground text-background" : "bg-red-500 text-white"}`}
                          >
                            {t === "do" ? "Đỏ" : "Đen"}
                          </span>
                          <button
                            onClick={() => updateChatFormHeo(t, -1)}
                            className="size-5 flex items-center justify-center rounded bg-muted font-bold"
                          >
                            −
                          </button>
                          <span className="w-4 text-center font-bold">
                            {chatForm.heo[t]}
                          </span>
                          <button
                            onClick={() => updateChatFormHeo(t, 1)}
                            className="size-5 flex items-center justify-center rounded bg-muted font-bold"
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={addChatHeo}
                      disabled={
                        !chatForm.chatterId ||
                        !chatForm.victimId ||
                        (chatForm.heo.do === 0 && chatForm.heo.den === 0)
                      }
                    >
                      Thêm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setShowChatHeoForm(false)}
                    >
                      Huy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Xếp hạng ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {!activeNhot
                ? "Chọn thứ tự người chơi"
                : nhotCount === 3
                  ? "Nhốt tất cả · không tính hạng"
                  : nhotCount === 2
                    ? "Nhốt 2 · người chơi còn lại đồng hạng 3"
                    : "Nhốt 1 · cShọn hạng 2 và 3 cho 2 người chơi còn lại"}
            </p>
            {activeNhot && (
              <span className="text-xs text-chart-3 font-medium flex items-center gap-1">
                <Lock className="size-3" />
                {selectCounter}/{requiredSelections}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-2">
          {ranking.map((playerId, rankIndex) => {
            const player = mockPlayers.find((p) => p.id === playerId)!;
            const pIdx = mockPlayers.findIndex((p) => p.id === playerId);
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
                ? mockAccumulated.khap * khapCount * mockConfig.khapPoints * 3
                : 0;
            // ── THÊM MỚI: điểm âm khạp/sảnh cho người không phải winner ──
            const khapPtsLoss =
              !isKhapWinner && khapWinner !== null && khapCount > 0
                ? mockAccumulated.khap * khapCount * mockConfig.khapPoints
                : 0;
            const effectiveSanh = isSanhWinner ? mockAccumulated.sanh : 0;
            const sanhPtsDisplay = isSanhWinner
              ? mockAccumulated.sanh * mockConfig.sanhPoints * 3
              : 0;
            const sanhPtsLoss =
              !isSanhWinner && sanhWinner !== null
                ? mockAccumulated.sanh * mockConfig.sanhPoints
                : 0;

            const nextInRanking = ranking[rankIndex + 1];
            const nextIdx = nextInRanking
              ? mockPlayers.findIndex((p) => p.id === nextInRanking)
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
                mockPlayers.findIndex((p) => p.id === ranking[rankIndex - 1])
              ] !== null;

            const showBonus =
              showAsActive ||
              (selectCounter >= selectableIds.length - 1 &&
                rankIndex === ranking.length - 1 &&
                !isFixed);

            // ── THÊM MỚI: lọc danh sách chặt heo liên quan đến player này ──
            const chatHeoAsChatter = chatHeoList.filter(
              (c) =>
                c.chatterId === playerId && !nhotVictimIds.includes(c.victimId),
            );
            const chatHeoAsVictim = chatHeoList.filter(
              (c) =>
                c.victimId === playerId && !nhotVictimIds.includes(c.victimId),
            );

            return (
              <div
                key={playerId}
                className={`rounded-lg border flex flex-col overflow-hidden transition-all ${showAsActive ? style : "border-muted/40 bg-muted/10 opacity-60"}`}
              >
                <button
                  onClick={() =>
                    isSelectable && !isFixed && toggleSelect(playerId)
                  }
                  className={`flex items-center gap-2 px-3 py-2.5 w-full text-left transition-colors ${isSelectable && !isFixed ? "hover:bg-background/30 cursor-pointer" : "cursor-default"}`}
                >
                  {/* Badge */}
                  {isFixed ? (
                    <span
                      className={`flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0 ${
                        playerId === nhotterId
                          ? "bg-primary text-primary-foreground"
                          : nhotVictimIds.includes(playerId)
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {playerId === nhotterId ? (
                        <Crown className="size-3" />
                      ) : nhotVictimIds.includes(playerId) ? (
                        "✕"
                      ) : (
                        "3"
                      )}
                    </span>
                  ) : (
                    <span
                      className={`flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0 transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-muted-foreground/20"}`}
                    >
                      {isSelected ? order : "·"}
                    </span>
                  )}
                  
                  {/* Label hạng */}
                  <span
                    className={`text-xs font-bold w-12 shrink-0 ${showAsActive ? labelColor : "text-muted-foreground"}`}
                  >
                    {showAsActive ? label : ""}
                  </span>

                  <span className="font-medium text-sm flex-1 truncate">
                    {player.name}
                  </span>

                  {showAsActive && (
                    <span
                      className={`text-sm font-bold tabular-nums shrink-0 ${scoreColor(score)}`}
                    >
                      {scoreFmt(score)}
                    </span>
                  )}

                  {isSelected && !isFixed && (
                    <div
                      className="flex flex-col gap-0.5 shrink-0 ml-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => moveRank(playerId, "up")}
                        disabled={!canMoveUp}
                        className="flex items-center justify-center size-5 rounded hover:bg-background/60 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        onClick={() => moveRank(playerId, "down")}
                        disabled={!canMoveDown}
                        className="flex items-center justify-center size-5 rounded hover:bg-background/60 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                  )}
                </button>

                {/* ── Khạp + Sảnh ── */}
                {showBonus && (
                  <div className="flex gap-2 px-3 pb-2.5">
                    {/* Khạp */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${isKhapWinner ? "bg-chart-4/20 border-chart-4/50 text-chart-4" : khapTaken ? "opacity-80 bg-muted border-destructive/20 text-destructive" : "bg-muted/60 border-muted text-muted-foreground"}`}
                    >
                      <button
                        onClick={() => toggleKhapPlayer(playerId)}
                        className="flex items-center gap-1 hover:opacity-80"
                        disabled={nhotVictimIds.includes(playerId)}
                      >
                        <span className="font-medium">Khap</span>
                      </button>
                      {isKhapWinner && (
                        <>
                          <span className="mx-1 opacity-30">|</span>
                          <button
                            onClick={() => updateKhapCount(-1)}
                            disabled={khapCount <= 1}
                            className="size-4 flex items-center justify-center rounded hover:bg-background/50 disabled:opacity-30 font-bold"
                          >
                            −
                          </button>
                          <span className="font-bold w-4 text-center">
                            {khapCountDisplay}
                          </span>
                          <button
                            onClick={() => updateKhapCount(1)}
                            disabled={khapCount >= mockConfig.maxKhapAccumulate}
                            className="size-4 flex items-center justify-center rounded hover:bg-background/50 disabled:opacity-30 font-bold"
                          >
                            +
                          </button>
                          <span className="mx-1 opacity-30">|</span>
                          <span className="font-bold text-chart-4">
                            +{khapPtsDisplay}
                          </span>
                        </>
                      )}
                      {/* ── THÊM MỚI: điểm âm khạp cho người còn lại ── */}
                      {!isKhapWinner && khapPtsLoss > 0 && (
                        <>
                          <span className="mx-1 opacity-30">|</span>
                          <span className="font-bold text-destructive">
                            -{khapPtsLoss}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Sảnh */}
                    <button
                      onClick={() => toggleSanhPlayer(playerId)}
                      disabled={nhotVictimIds.includes(playerId)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors disabled:cursor-not-allowed ${isSanhWinner ? "bg-chart-1/20 border-chart-1/50 text-chart-1" : sanhTaken ? "opacity-80 bg-muted border-destructive/20 text-destructive" : "bg-muted/60 border-muted text-muted-foreground hover:border-chart-1/40"}`}
                    >
                      <span className="font-medium">Sanh</span>
                      {isSanhWinner && (
                        <>
                          <span className="font-bold ml-0.5">
                            {effectiveSanh}
                          </span>
                          <span className="mx-1 opacity-30">|</span>
                          <span className="font-bold">+{sanhPtsDisplay}</span>
                        </>
                      )}
                      {/* ── THÊM MỚI: điểm âm sảnh cho người còn lại ── */}
                      {!isSanhWinner && sanhPtsLoss > 0 && (
                        <>
                          <span className="mx-1 opacity-30">|</span>
                          <span className="font-bold text-destructive">
                            -{sanhPtsLoss}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ── THÊM MỚI: Chặt heo trong row player ── */}
                {showBonus &&
                  (chatHeoAsChatter.length > 0 ||
                    chatHeoAsVictim.length > 0) && (
                    <div className="flex flex-col gap-1 px-3 pb-2.5">
                      {/* Người chặt */}
                      {chatHeoAsChatter.map((c) => {
                        const pts =
                          (c.heo.do ?? 0) * mockConfig.heoDoPoints +
                          (c.heo.den ?? 0) * mockConfig.heodenPoints;
                        return (
                          <div
                            key={c.id}
                            className="flex items-center gap-1.5 py-1"
                          >
                            <div
                              key={c.id}
                              className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border text-xs bg-chart-2/10 border-chart-2/30 text-chart-2"
                            >
                              {(c.heo.do ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold leading-normal">
                                  {c.heo.do} Đỏ
                                </span>
                              )}
                              {(c.heo.den ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-foreground text-background font-bold leading-normal">
                                  {c.heo.den} Đen
                                </span>
                              )}
                              <span className="mx-0.5 opacity-30">|</span>
                              <span className="font-bold">+{pts}</span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Người bị chặt */}
                      {chatHeoAsVictim.map((c) => {
                        const pts =
                          (c.heo.do ?? 0) * mockConfig.heoDoPoints +
                          (c.heo.den ?? 0) * mockConfig.heodenPoints;
                        return (
                          <div className="flex items-center gap-1.5 py-1">
                            <div
                              key={c.id}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs bg-destructive/10 border-destructive/20 text-destructive"
                            >
                              {(c.heo.do ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold leading-normal">
                                  {c.heo.do} Đỏ
                                </span>
                              )}
                              {(c.heo.den ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-foreground text-background font-bold leading-normal">
                                  {c.heo.den} Đen
                                </span>
                              )}
                              <span className="mx-0.5 opacity-30">|</span>
                              <span className="font-bold">-{pts}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Kết quả */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Ket qua van {mockCurrentRound}
          </p>
          <div className="grid grid-cols-4 gap-1">
            {mockPlayers.map((player) => {
              const sc = computedScores[player.id];
              return (
                <div
                  key={player.id}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="text-xs text-muted-foreground truncate w-full text-center">
                    {pShort(player.id)}
                  </span>
                  <span className={`text-base font-bold ${scoreColor(sc)}`}>
                    {scoreFmt(sc)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        size="lg"
        className="w-full gap-2"
        disabled={submitted || !rankingComplete}
        onClick={() => setSubmitted(true)}
      >
        {submitted ? (
          <>
            <CheckCircle2 className="size-4" />
            Da luu van dau
          </>
        ) : !rankingComplete ? (
          <>
            <Swords className="size-4" />
            {activeNhot
              ? `Chon hang 2 va 3 (${selectCounter}/${requiredSelections})`
              : `Chon du nguoi (${selectCounter}/${mockPlayers.length})`}
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4" />
            Luu Van {mockCurrentRound}
          </>
        )}
      </Button>
    </main>
  );
}
