import { useParams, useLoaderData } from "react-router";
import type { Route } from "./+types/match";
import { Button } from "~/components/ui/button";
import {
  RotateCcw,
  Flame,
  Plus,
  X,
  Trash,
  Spade,
  ArrowUpIcon,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { db } from "~/db/client.server";
import { sessions } from "~/db/schema/sessions";
import { players, sessionTotals } from "~/db/schema";
import {
  deleteRound,
  getRoundMeta,
  saveRound,
  type RoundResultInput,
} from "~/lib/round.server";
import { useMatchScoring } from "~/hooks/useMatchScoring";
import { CircularTable3 } from "~/components/circular-table3";
import type { MatchLoaderData } from "~/types/match.type";
import { heatBackground, PROGRESS_COLORS } from "~/helpers/match.helper";
import { ChatHeoDialog } from "~/components/match/chatheo-dialog";
import { NhotBaiDialog } from "~/components/match/nhotbai-dialog";
import { NhotBaiResultCard } from "~/components/match/NhotBaiResultCard";
import { ChatHeoListCard } from "~/components/match/ChatHeoListCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

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

  const sessionCode = params.sessionId!;

  // Kiểm tra phiên tồn tại
  const [sessionRow] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, sessionCode))
    .limit(1);

  if (!sessionRow) {
    throw redirect("/");
  }

  // Đọc trạng thái tạm dừng của phiên để chặn ghi/xoá ván khi đang pause
  // (authoritative — bảo vệ cả khi UI bị lách). Chỉ chủ phòng mới được
  // bỏ pause, nên mọi người chơi (kể cả chủ) đều bị chặn khi paused.
  // try/catch để tương thích ngược: nếu chưa chạy `db:push` thêm cột
  // `paused`, phiên được coi là không tạm dừng (không gãy tính năng lưu).
  let paused = false;
  try {
    const [p] = await db
      .select({ paused: sessions.paused })
      .from(sessions)
      .where(eq(sessions.code, sessionCode))
      .limit(1);
    paused = p?.paused ?? false;
  } catch {
    paused = false;
  }

  if (paused) {
    return {
      error: "Phiên đang tạm dừng, không thể lưu hoặc xoá ván đấu",
    };
  }

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

// ── Component (view mỏng) ──────────────────────────────────────
export default function MatchPage() {
  const { sessionId: sessionCode } = useParams();
  const loaderData = useLoaderData<MatchLoaderData>();
  const m = useMatchScoring({ sessionCode: sessionCode!, loaderData });

  const players = m.players;

  if (!m.isReady) {
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
        {m.isPaused && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm font-semibold text-amber-600 dark:text-amber-400">
            <Pause className="size-4 shrink-0" />
            Phiên chơi đang tạm dừng
          </div>
        )}
        {/* Header */}
        <section
          style={{
            background: heatBackground(m.totalScore),
          }}
          className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-sm"
        >
          <div className="relative p-5">
            <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-chart-2/10 blur-3xl" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex justify-between w-full">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  Ván {m.currentRoundNo}
                </h1>
                <div className="flex gap-2">
                  {m.isOwner && (
                    <Button
                      variant={m.isPaused ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={m.togglePause}
                      title={
                        m.isPaused
                          ? "Tiếp tục phiên chơi"
                          : "Tạm dừng phiên chơi"
                      }
                      className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
                    >
                      {m.isPaused ? (
                        <Play className="size-3.5" />
                      ) : (
                        <Pause className="size-3.5" />
                      )}
                      
                    </Button>
                  )}
                  {m.currentRoundId !== undefined && m.currentRoundNo > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={m.isDeletingRound || m.isPaused}
                      onClick={() => m.setConfirmDeleteOpen(true)}
                      className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
                    >
                      {m.isDeletingRound ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash className="size-3.5" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={m.handleReset}
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
                        {m.accumulated.khap}
                      </span>
                      <span className="mb-1 text-xs font-semibold text-muted-foreground">
                        / {m.gameConfig.maxKhapAccumulate}
                      </span>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-chart-4 shadow-sm">
                    <Flame className="size-5" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-10 gap-0.5">
                  {Array.from({ length: m.gameConfig.maxKhapAccumulate }).map(
                    (_, i) => (
                      <div
                        key={i}
                        style={{
                          ...(i < m.accumulated.khap
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
                        {m.accumulated.sanh}
                      </span>
                      <span className="mb-1 text-xs font-semibold text-muted-foreground">
                        / {m.gameConfig.maxSanhAccumulate}
                      </span>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-chart-1 shadow-sm">
                    <Spade className="size-5" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-10 gap-0.5">
                  {Array.from({ length: m.gameConfig.maxSanhAccumulate }).map(
                    (_, i) => (
                      <div
                        key={i}
                        style={{
                          ...(i < m.accumulated.sanh
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
              {m.sorted.map((player, index) => {
                const score = player.totalScore ?? 0;
                return (
                  <div
                    key={player.playerId}
                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition-colors ${m.scoreBoxClass(score)}`}
                  >
                    <span className="text-xs tracking-wider font-black uppercase opacity-70 text-card-foreground">
                      {m.pShort(player.playerId)}
                    </span>
                    <span className="text-xl font-black tabular-nums">
                      {m.scoreFmt(score)}
                    </span>
                  </div>
                );
              })}
            </div>
            <CircularTable3
              players={players}
              ranking={m.ranking}
              selectOrder={m.selectOrder}
              toggleSelect={m.toggleSelect}
              selectableIds={m.selectableIds}
              selectCounter={m.selectCounter}
              requiredSelections={m.requiredSelections}
              computedScores={m.computedScores}
              activeNhot={m.activeNhot}
              nhotCount={m.nhotCount}
              nhotterId={m.nhotterId}
              nhotVictimIds={m.nhotVictimIds}
              denForIds={m.denForIds}
              khapWinner={m.khapWinner}
              khapCount={m.khapCount}
              sanhWinner={m.sanhWinner}
              toggleKhapPlayer={m.toggleKhapPlayer}
              updateKhapCount={m.updateKhapCount}
              toggleSanhPlayer={m.toggleSanhPlayer}
              chatHeoList={m.chatHeoList}
              accumulated={m.accumulated}
              gameConfig={m.gameConfig}
              getRowMeta={m.getRowMeta}
              save={m.handleSave}
              disabledSaveButton={m.disabledSaveButton}
              isLoading={m.isSaving}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between relative z-20 mb-4">
            <div className="flex items-center justify-center gap-2 w-full">
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-9 gap-2 font-black text-sm"
                  onClick={() => m.setExpandBonus(true)}
                >
                  <Plus className="size-4" />
                  Nhốt bài
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-9 gap-2 font-black text-sm"
                  onClick={() => {
                    m.setShowChatHeo(true);
                    m.setShowChatHeoForm(true);
                  }}
                >
                  <Plus className="size-4" />
                  Chặt heo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Nhốt bài (kết quả) ─────────────────────────── */}
        {m.expandBonus && (
          <NhotBaiResultCard
            nhotList={m.nhotList}
            confirmNhot={m.confirmNhot}
            gameConfig={m.gameConfig}
            players={players}
            pShort={m.pShort}
            nhotterId={m.nhotterId}
            nhotVictimIds={m.nhotVictimIds}
            nhotOthers={m.nhotOthers}
            denBaiLosses={m.denBaiLosses}
            nhotCount={m.nhotCount}
            onClose={m.closeNhotBai}
            onReset={m.resetNhot}
          />
        )}

        {/* ── Chặt heo (danh sách) ───────────────────────── */}
        {m.showChatHeo && (
          <ChatHeoListCard
            chatHeoList={m.chatHeoList}
            nhotVictimIds={m.nhotVictimIds}
            gameConfig={m.gameConfig}
            showChatHeoForm={m.showChatHeoForm}
            setShowChatHeo={m.setShowChatHeo}
            setShowChatHeoForm={m.setShowChatHeoForm}
            setChatHeoList={m.setChatHeoList}
            setChatForm={m.setChatForm}
            removeChatHeo={m.removeChatHeo}
            pShort={m.pShort}
          />
        )}

        {m.saveError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-center text-sm font-semibold text-destructive">
            {m.saveError}
          </div>
        )}
      </main>

      <ChatHeoDialog
        open={m.showChatHeo && m.showChatHeoForm}
        onOpenChange={(o) => {
          m.setShowChatHeoForm(o);
          if (!o) m.setShowChatHeo(false);
        }}
        players={players}
        chatForm={m.chatForm}
        setChatForm={m.setChatForm}
        nhotVictimIds={m.nhotVictimIds}
        addChatHeo={m.addChatHeo}
        updateChatFormHeo={m.updateChatFormHeo}
        pShort={m.pShort}
      />

      <NhotBaiDialog
        open={m.expandBonus && !m.confirmNhot}
        onOpenChange={(o) => (o ? m.setExpandBonus(true) : m.closeNhotBai())}
        players={players}
        nhotForm={m.nhotForm}
        setNhotForm={m.setNhotForm}
        nhotFormVictimIds={m.nhotFormVictimIds}
        showDenBai={m.showDenBai}
        setShowDenBai={m.setShowDenBai}
        dennerId={m.dennerId}
        setDennerId={m.setDennerId}
        denForIds={m.denForIds}
        setDenForIds={m.setDenForIds}
        dennerCandidates={m.dennerCandidates}
        denForCandidates={m.denForCandidates}
        toggleNhotVictim={m.toggleNhotVictim}
        updateVictimHeo={m.updateVictimHeo}
        addNhot={m.addNhot}
        removeNhot={m.removeNhot}
        pShort={m.pShort}
      />
      {m.isDeletingRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-5 shadow-lg border border-border/70">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm font-semibold text-muted-foreground">
              Đang xóa ván đấu...
            </p>
          </div>
        </div>
      )}
      {m.showBtnToTop && (
        <div className="fixed z-20 bottom-24 right-6">
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              m.scrollToTop();
            }}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      )}
      <AlertDialog open={m.confirmDeleteOpen} onOpenChange={m.setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa dữ liệu ván trước?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. <br></br> Điểm số của ván trước
              sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                m.deleteRound(m.currentRoundId!);
                m.setConfirmDeleteOpen(false);
              }}
              variant={"destructive"}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
