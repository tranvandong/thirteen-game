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
} from "lucide-react";

const mockConfig = {
  rankPoints: [3, 1, -1, -3],
  khapPoints: 3,
  sanhPoints: 5,
  maxKhapAccumulate: 5,
  maxSanhAccumulate: 3,
};

const mockAccumulated = { khap: 2, sanh: 1 };

const mockPlayers = [
  { id: "p1", name: "Nguoi Choi 1" },
  { id: "p2", name: "Nguoi Choi 2" },
  { id: "p3", name: "Nguoi Choi 3" },
  { id: "p4", name: "Nguoi Choi 4" },
];

const mockCurrentRound = 6;

export async function loader() {
  return {};
}

export default function MatchPage() {
  const { sessionId } = useParams();

  // selectOrder[i] = thứ tự chọn (1-based) của mockPlayers[i], null = chưa chọn
  const [selectOrder, setSelectOrder] = useState<(number | null)[]>(
    mockPlayers.map(() => null),
  );

  const [khapWinner, setKhapWinner] = useState<string | null>(null);
  const [khapCount, setKhapCount] = useState(0);
  const [sanhWinner, setSanhWinner] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Derive từ state, không lưu riêng
  const selectCounter = selectOrder.filter((o) => o !== null).length;
  const rankingComplete = selectCounter === mockPlayers.length;

  // Sắp xếp: đã chọn theo thứ tự chọn trước, chưa chọn xuống cuối
  const ranking = useMemo(() => {
    const selected = mockPlayers
      .map((p, i) => ({ p, order: selectOrder[i] }))
      .filter((x) => x.order !== null)
      .sort((a, b) => a.order! - b.order!)
      .map((x) => x.p.id);

    const unselected = mockPlayers
      .filter((_, i) => selectOrder[i] === null)
      .map((p) => p.id);

    return [...selected, ...unselected];
  }, [selectOrder]);

  const toggleSelect = (playerId: string) => {
    const idx = mockPlayers.findIndex((p) => p.id === playerId);
    setSelectOrder((prev) => {
      const next = [...prev];
      if (next[idx] !== null) {
        // Bỏ chọn: compact lại thứ tự
        const removed = next[idx]!;
        next[idx] = null;
        return next.map((o) => (o !== null && o > removed ? o - 1 : o));
      } else {
        // Chọn mới: gán thứ tự tiếp theo
        const nextOrder = next.filter((o) => o !== null).length + 1;
        next[idx] = nextOrder;
        return next;
      }
    });
  };

  const moveRank = (playerId: string, direction: "up" | "down") => {
    const rankPos = ranking.indexOf(playerId);
    const swapPos = direction === "up" ? rankPos - 1 : rankPos + 1;
    if (swapPos < 0 || swapPos >= ranking.length) return;

    const swapPlayerId = ranking[swapPos];
    const idxA = mockPlayers.findIndex((p) => p.id === playerId);
    const idxB = mockPlayers.findIndex((p) => p.id === swapPlayerId);

    // Chỉ swap nếu cả 2 đều đã được chọn
    if (selectOrder[idxA] === null || selectOrder[idxB] === null) return;

    setSelectOrder((prev) => {
      const next = [...prev];
      [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
  };

  const toggleKhapPlayer = (playerId: string) => {
    if (khapWinner === playerId) {
      setKhapWinner(null);
      setKhapCount(0);
    } else {
      setKhapWinner(playerId);
      if (khapCount === 0) setKhapCount(1);
    }
  };

  const updateKhapCount = (delta: number) => {
    setKhapCount((c) => {
      const next = c + delta;
      if (next <= 0) {
        setKhapWinner(null);
        return 0;
      }
      return Math.min(next, mockConfig.maxKhapAccumulate);
    });
  };

  const toggleSanhPlayer = (playerId: string) => {
    setSanhWinner((prev) => (prev === playerId ? null : playerId));
  };

  const computedScores = useMemo(() => {
    const scores: Record<string, number> = Object.fromEntries(
      mockPlayers.map((p) => [p.id, 0]),
    );

    ranking.forEach((pid, i) => {
      scores[pid] += mockConfig.rankPoints[i] ?? 0;
    });

    if (khapWinner && khapCount > 0) {
      const effective = mockAccumulated.khap + khapCount;
      scores[khapWinner] += mockConfig.khapPoints * 3 * effective;
      mockPlayers.forEach((p) => {
        if (p.id !== khapWinner)
          scores[p.id] -= mockConfig.khapPoints * effective;
      });
    }

    if (sanhWinner) {
      const effective = mockAccumulated.sanh + 1;
      scores[sanhWinner] += mockConfig.sanhPoints * 3 * effective;
      mockPlayers.forEach((p) => {
        if (p.id !== sanhWinner)
          scores[p.id] -= mockConfig.sanhPoints * effective;
      });
    }

    return scores;
  }, [ranking, khapWinner, khapCount, sanhWinner]);

  const handleReset = () => {
    setSelectOrder(mockPlayers.map(() => null));
    setKhapWinner(null);
    setKhapCount(0);
    setSanhWinner(null);
    setSubmitted(false);
  };

  const getRankStyle = (rankIndex: number, isSelected: boolean) => {
    if (!isSelected) return "border-muted/40 bg-muted/10 opacity-60";
    switch (rankIndex) {
      case 0:
        return "border-chart-4/40 bg-chart-4/10";
      case 1:
        return "border-chart-2/30 bg-chart-2/5";
      case 2:
        return "border-muted bg-muted/30";
      default:
        return "border-destructive/30 bg-destructive/5";
    }
  };

  const rankLabels = ["1st", "2nd", "3rd", "4th"];
  const rankColors = [
    "text-chart-4",
    "text-chart-2",
    "text-muted-foreground",
    "text-destructive",
  ];

  return (
    <main className="p-4 flex flex-col gap-4 pb-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                <Swords className="size-4" />
              </div>
              <span>Van {mockCurrentRound}</span>
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
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3 flex flex-col gap-3">
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>
              Khap:{" "}
              <strong className="text-chart-4">
                {mockConfig.khapPoints}đ/ng · tối đa{" "}
                {mockConfig.maxKhapAccumulate}
              </strong>
            </span>
            <span>·</span>
            <span>
              Sanh:{" "}
              <strong className="text-chart-1">
                {mockConfig.sanhPoints}đ/ng · tối đa{" "}
                {mockConfig.maxSanhAccumulate}
              </strong>
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1 rounded-lg bg-chart-4/10 border border-chart-4/20 px-3 py-2">
              <Flame className="size-3.5 text-chart-4 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground">
                  Tich luy Khap
                </span>
                <div className="flex items-end gap-1">
                  <span className="text-lg font-bold text-chart-4 leading-none">
                    {mockAccumulated.khap}
                  </span>
                  <span className="text-xs text-muted-foreground mb-0.5">
                    / {mockConfig.maxKhapAccumulate}
                  </span>
                </div>
              </div>
              <div className="flex gap-0.5 ml-auto">
                {Array.from({ length: mockConfig.maxKhapAccumulate }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className={`size-2 rounded-full ${i < mockAccumulated.khap ? "bg-chart-4" : "bg-chart-4/20"}`}
                    />
                  ),
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1 rounded-lg bg-chart-1/10 border border-chart-1/20 px-3 py-2">
              <Sparkles className="size-3.5 text-chart-1 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground">
                  Tich luy Sanh
                </span>
                <div className="flex items-end gap-1">
                  <span className="text-lg font-bold text-chart-1 leading-none">
                    {mockAccumulated.sanh}
                  </span>
                  <span className="text-xs text-muted-foreground mb-0.5">
                    / {mockConfig.maxSanhAccumulate}
                  </span>
                </div>
              </div>
              <div className="flex gap-0.5 ml-auto">
                {Array.from({ length: mockConfig.maxSanhAccumulate }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className={`size-2 rounded-full ${i < mockAccumulated.sanh ? "bg-chart-1" : "bg-chart-1/20"}`}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking + Bonus */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <p className="text-xs text-muted-foreground">
            Chon thu tu nguoi choi · nguoi chon truoc = hang cao hon
          </p>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-2">
          {ranking.map((playerId, rankIndex) => {
            const player = mockPlayers.find((p) => p.id === playerId)!;
            const pIdx = mockPlayers.findIndex((p) => p.id === playerId);
            const order = selectOrder[pIdx];
            const isSelected = order !== null;
            const score = computedScores[playerId];

            const isKhapWinner = khapWinner === playerId;
            const isSanhWinner = sanhWinner === playerId;
            const khapTaken = khapWinner !== null && !isKhapWinner;
            const sanhTaken = sanhWinner !== null && !isSanhWinner;

            const effectiveKhap = isKhapWinner
              ? mockAccumulated.khap + khapCount
              : 0;
            const effectiveSanh = isSanhWinner ? mockAccumulated.sanh + 1 : 0;

            // Down disabled nếu vị trí kế là người chưa chọn
            const nextInRanking = ranking[rankIndex + 1];
            const nextIdx = nextInRanking
              ? mockPlayers.findIndex((p) => p.id === nextInRanking)
              : -1;
            const canMoveDown =
              rankIndex < ranking.length - 1 &&
              nextIdx !== -1 &&
              selectOrder[nextIdx] !== null;

            return (
              <div
                key={playerId}
                className={`rounded-lg border flex flex-col overflow-hidden transition-all ${getRankStyle(rankIndex, isSelected)}`}
              >
                {/* Row 1: tap to select */}
                <button
                  onClick={() => toggleSelect(playerId)}
                  className="flex items-center gap-2 px-3 py-2.5 w-full text-left hover:bg-background/30 transition-colors"
                >
                  {/* Order badge */}
                  <span
                    className={`flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground border border-muted-foreground/20"
                    }`}
                  >
                    {isSelected ? order : "·"}
                  </span>

                  {/* Rank label */}
                  {isSelected ? (
                    <span
                      className={`text-xs font-bold w-7 text-center shrink-0 ${rankColors[rankIndex]}`}
                    >
                      {rankLabels[rankIndex]}
                    </span>
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}

                  <span className="font-medium text-sm flex-1 truncate">
                    {player.name}
                  </span>

                  {isSelected && (
                    <span
                      className={`text-sm font-bold tabular-nums shrink-0 ${
                        score > 0
                          ? "text-chart-2"
                          : score < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {score > 0 ? `+${score}` : score}
                    </span>
                  )}

                  {isSelected && (
                    <div
                      className="flex flex-col gap-0.5 shrink-0 ml-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => moveRank(playerId, "up")}
                        disabled={rankIndex === 0 || !isSelected}
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

                {/* Row 2: Khap + Sanh */}
                {isSelected && (
                  <div className="flex gap-2 px-3 pb-2.5 pl-[3.75rem]">
                    {/* Khạp */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${
                        isKhapWinner
                          ? "bg-chart-4/20 border-chart-4/50 text-chart-4"
                          : khapTaken
                            ? "opacity-40 bg-muted border-muted"
                            : "bg-muted/60 border-muted text-muted-foreground"
                      }`}
                    >
                      <button
                        onClick={() => !khapTaken && toggleKhapPlayer(playerId)}
                        className="flex items-center gap-1 hover:opacity-80"
                      >
                        <Flame
                          className={`size-3 ${isKhapWinner ? "text-chart-4" : "text-muted-foreground"}`}
                        />
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
                            {effectiveKhap}
                          </span>
                          <button
                            onClick={() => updateKhapCount(1)}
                            disabled={khapCount >= mockConfig.maxKhapAccumulate}
                            className="size-4 flex items-center justify-center rounded hover:bg-background/50 disabled:opacity-30 font-bold"
                          >
                            +
                          </button>
                        </>
                      )}
                    </div>

                    {/* Sảnh */}
                    <button
                      onClick={() => !sanhTaken && toggleSanhPlayer(playerId)}
                      disabled={sanhTaken}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors disabled:cursor-not-allowed ${
                        isSanhWinner
                          ? "bg-chart-1/20 border-chart-1/50 text-chart-1"
                          : sanhTaken
                            ? "opacity-40 bg-muted border-muted"
                            : "bg-muted/60 border-muted text-muted-foreground hover:border-chart-1/40"
                      }`}
                    >
                      <Sparkles
                        className={`size-3 ${isSanhWinner ? "text-chart-1" : "text-muted-foreground"}`}
                      />
                      <span className="font-medium">Sanh</span>
                      {isSanhWinner && (
                        <span className="font-bold ml-0.5">
                          {effectiveSanh}
                        </span>
                      )}
                    </button>
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
              const score = computedScores[player.id];
              return (
                <div
                  key={player.id}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="text-xs text-muted-foreground truncate w-full text-center">
                    {player.name.split(" ").pop()}
                  </span>
                  <span
                    className={`text-base font-bold ${
                      score > 0
                        ? "text-chart-2"
                        : score < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {score > 0 ? `+${score}` : score}
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
            Chon du {mockPlayers.length} nguoi ({selectCounter}/
            {mockPlayers.length})
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
