import type { Dispatch, SetStateAction } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Lock, Plus, X } from "lucide-react";
import type { HeoType, VictimHeo } from "~/types/match.type";

/**
 * NhotBaiDialog
 * ──────────────────────────────────────────────────────────────
 * Chỉ tách phần FORM nhập liệu của "Nhốt bài" (chọn người nhốt,
 * người bị nhốt, đền bài) thành Dialog (shadcn/ui).
 *
 * Phần kết quả sau khi đã "Chốt nhốt" (khối tóm tắt hiển thị
 * điểm nhận/mất, nút "Chọn lại"...) KHÔNG nằm trong component
 * này — vẫn giữ nguyên trong match.tsx như code gốc (đoạn
 * `confirmNhot && nhotList.map(...)`).
 *
 * Phần "Đền bài" vẫn lồng bên trong dialog này (không tách dialog
 * riêng), đúng như yêu cầu trước đó.
 *
 * Gợi ý luồng dùng trong match.tsx (KHÔNG bắt buộc áp dụng ngay):
 *
 *   {/* phần đã confirm — giữ nguyên trong match.tsx * /}
 *   {confirmNhot && nhotList.length > 0 && nhotList.map((n) => ( ... ))}
 *
 *   {!confirmNhot && (
 *     <Button onClick={() => setExpandBonus(true)}>Nhốt bài</Button>
 *   )}
 *
 *   <NhotBaiDialog
 *     open={expandBonus && !confirmNhot}
 *     onOpenChange={(o) => (o ? setExpandBonus(true) : closeNhotBai())}
 *     players={players}
 *     nhotForm={nhotForm}
 *     setNhotForm={setNhotForm}
 *     nhotFormVictimIds={nhotFormVictimIds}
 *     showDenBai={showDenBai}
 *     setShowDenBai={setShowDenBai}
 *     dennerId={dennerId}
 *     setDennerId={setDennerId}
 *     denForIds={denForIds}
 *     setDenForIds={setDenForIds}
 *     dennerCandidates={dennerCandidates}
 *     denForCandidates={denForCandidates}
 *     toggleNhotVictim={toggleNhotVictim}
 *     updateVictimHeo={updateVictimHeo}
 *     addNhot={addNhot}
 *     removeNhot={removeNhot}
 *     pShort={pShort}
 *   />
 */

export interface NhotBaiPlayer {
  id: string;
  name: string;
}

export interface NhotBaiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  players: NhotBaiPlayer[];

  nhotForm: { nhotterId: string; victims: VictimHeo[] };
  setNhotForm: Dispatch<
    SetStateAction<{ nhotterId: string; victims: VictimHeo[] }>
  >;
  nhotFormVictimIds: string[];

  showDenBai: boolean;
  setShowDenBai: (value: boolean) => void;
  dennerId: string | null;
  setDennerId: (id: string | null) => void;
  denForIds: string[];
  setDenForIds: Dispatch<SetStateAction<string[]>>;
  dennerCandidates: string[];
  denForCandidates: string[];

  toggleNhotVictim: (playerId: string) => void;
  updateVictimHeo: (victimId: string, type: HeoType, delta: number) => void;
  /** Chốt nhốt — lưu form hiện tại thành 1 mục trong nhotList (xử lý ở match.tsx) */
  addNhot: () => void;
  /** Hủy — xóa trắng form nhập liệu (xử lý ở match.tsx) */
  removeNhot: () => void;

  pShort: (id: string) => string;
}

export function NhotBaiDialog({
  open,
  onOpenChange,
  players,
  nhotForm,
  setNhotForm,
  nhotFormVictimIds,
  showDenBai,
  setShowDenBai,
  dennerId,
  setDennerId,
  denForIds,
  setDenForIds,
  dennerCandidates,
  denForCandidates,
  toggleNhotVictim,
  updateVictimHeo,
  addNhot,
  removeNhot,
  pShort,
}: NhotBaiDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto rounded-[2rem] p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 px-4 py-4 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-chart-3/10 text-chart-3">
            <Lock className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-sm font-black text-foreground">
              Nhốt Bài
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Thiết lập người nhốt, bị nhốt và đền bài
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-4 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Người nhốt
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setNhotForm((f) => ({
                      ...f,
                      nhotterId: p.id,
                      victims: f.victims.filter((v) => v.victimId !== p.id),
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
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
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
                        <div className="flex gap-4">
                          {(["do", "den"] as HeoType[]).map((t) => (
                            <div
                              key={t}
                              className="flex items-center gap-1 text-xs"
                            >
                              <span
                                className={`rounded-full px-2 py-1 font-black border-2 border-white text-white leading-[normal] ${
                                  t === "den" ? "bg-black" : "bg-red-500"
                                }`}
                              >
                                {vicTimHeoCount?.[t] ?? 0}
                              </span>
                              <button
                                onClick={() => updateVictimHeo(p.id, t, -1)}
                                className="relative z-10 size-6 rounded-full bg-muted/70 font-black"
                              >
                                −
                              </button>
                              <span className="w-4 text-center font-black">
                                {vicTimHeoCount?.[t] ?? 0}
                              </span>
                              <button
                                onClick={() => updateVictimHeo(p.id, t, 1)}
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

          {/* ── Đền bài: lồng bên trong dialog Nhốt Bài, không tách riêng ── */}
          {showDenBai && (
            <div className="mt-4 rounded-3xl border border-chart-3/20 bg-chart-3/10 p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Người đền bài
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowDenBai(false);
                      setDennerId(null);
                      setDenForIds([]);
                    }}
                    className="relative z-10 h-9 gap-1.5 text-xs font-bold sm:h-10"
                    type="button"
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
              className="relative z-10 mt-2 h-10 w-full font-black"
              onClick={() => setShowDenBai(true)}
            >
              <Plus className="size-3.5" />
              Đền bài
            </Button>
          )}

          <div className="relative z-20 mt-2 grid grid-cols-[8fr_2fr] gap-2 pt-1">
            <Button
              size="sm"
              className="relative z-10 h-10 font-black"
              onClick={addNhot}
              disabled={!nhotForm.nhotterId || nhotForm.victims.length === 0}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
