import type { Dispatch, SetStateAction } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  ArrowBigDownDash,
  ArrowDown,
  Check,
  PiggyBank,
  Scissors,
  UserRoundMinus,
  UserRoundPlus,
} from "lucide-react";
import type { HeoType } from "~/types/match.type";

/**
 * ChatHeoDialog
 * ──────────────────────────────────────────────────────────────
 * Chỉ tách phần FORM nhập liệu của "Chặt heo" (chọn người chặt,
 * người bị chặt, số lượng heo) thành Dialog (shadcn/ui).
 *
 * Danh sách các lượt chặt heo đã chốt (`chatHeoList`) KHÔNG nằm
 * trong component này — vẫn hiển thị/quản lý trong match.tsx như
 * code gốc (đoạn `chatHeoList.filter(...).map(...)`).
 *
 * Gợi ý luồng dùng trong match.tsx (KHÔNG bắt buộc áp dụng ngay):
 *
 *   {/* danh sách đã chốt — giữ nguyên trong match.tsx *\/}
 *   {chatHeoList
 *     .filter((c) => !nhotVictimIds.includes(c.victimId))
 *     .map((c) => ( ... ))}
 *
 *   <Button
 *     onClick={() => {
 *       setShowChatHeo(true);
 *       setShowChatHeoForm(true);
 *     }}
 *   >
 *     Thêm
 *   </Button>
 *
 *   <ChatHeoDialog
 *     open={showChatHeo && showChatHeoForm}
 *     onOpenChange={(o) => {
 *       setShowChatHeoForm(o);
 *       if (!o) setShowChatHeo(false);
 *     }}
 *     players={players}
 *     gameConfig={gameConfig}
 *     chatForm={chatForm}
 *     setChatForm={setChatForm}
 *     nhotVictimIds={nhotVictimIds}
 *     addChatHeo={addChatHeo}
 *     updateChatFormHeo={updateChatFormHeo}
 *     pShort={pShort}
 *   />
 */

export interface ChatHeoPlayer {
  id: string;
  name: string;
}

export interface ChatHeoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  players: ChatHeoPlayer[];

  chatForm: {
    chatterId: string;
    victimId: string;
    heo: { do: number; den: number };
  };
  setChatForm: Dispatch<
    SetStateAction<{
      chatterId: string;
      victimId: string;
      heo: { do: number; den: number };
    }>
  >;

  nhotVictimIds: string[];

  /** Chốt chặt heo — thêm 1 mục vào chatHeoList (xử lý ở match.tsx) */
  addChatHeo: () => void;
  updateChatFormHeo: (type: HeoType, delta: number) => void;

  pShort: (id: string) => string;
}

export function ChatHeoDialog({
  open,
  onOpenChange,
  players,
  chatForm,
  setChatForm,
  nhotVictimIds,
  addChatHeo,
  updateChatFormHeo,
  pShort,
}: ChatHeoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto rounded-[2rem] p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 px-4 py-4 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <Scissors className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-sm font-black text-foreground">
              Thêm Chặt Heo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chọn người chặt, người bị chặt và số lượng heo.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs flex items-end gap-2 font-bold uppercase tracking-wide text-muted-foreground">
                <UserRoundPlus className="size-6 text-chart-1" /> Người chặt
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
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
                            f.victimId && nhotVictimIds.includes(f.victimId)
                              ? ""
                              : f.victimId,
                        }))
                      }
                      className={`relative z-10 flex gap-0.5 tracking-wider rounded-2xl border px-3 py-2 font-black transition-colors uppercase ${
                        chatForm.chatterId === p.id
                          ? "border border-primary bg-chart-1/10 text-chart-1"
                          : "border-border bg-background/10 hover:border-primary/40 text-chart-1/70"
                      }`}
                    >
                      {chatForm.chatterId === p.id && <Check size={18} />}
                      {pShort(p.id)}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <p className="text-xs flex items-end gap-2 font-bold uppercase tracking-wide text-muted-foreground">
                <UserRoundMinus className="size-6 text-destructive" /> Người bị
                chặt
              </p>
              <div className="relative z-10 mt-2 flex flex-wrap gap-2">
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
                      className={`relative z-10 flex gap-0.5 tracking-wider rounded-2xl border px-3 py-2 font-black transition-colors uppercase ${
                        chatForm.victimId === p.id
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border bg-background/10 hover:border-destructive/30 text-destructive/70"
                      }`}
                    >
                      {chatForm.victimId === p.id && <Check size={18} />}
                      {pShort(p.id)}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold flex items-end gap-2 uppercase tracking-wide text-muted-foreground">
                <PiggyBank className="size-6" /> Số lượng heo
              </p>
              <div className="mt-2 flex gap-4">
                {(["do", "den"] as HeoType[]).map((t) => (
                  <div
                    key={t}
                    className="flex flex-1 items-center justify-between gap-0.5 rounded-2xl border border-border/70 bg-background p-2"
                  >
                    <span
                      className={`rounded-full w-9 h-9 leading-[2.2] text-[16px] text-center font-black ${
                        t === "den"
                          ? "bg-foreground text-background"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {t === "do" ? "Đỏ" : "Đen"}
                    </span>
                    <button
                      onClick={() => updateChatFormHeo(t, -1)}
                      className="relative z-10 size-8 rounded-full bg-muted/70 font-black"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-base font-black">
                      {chatForm.heo[t]}
                    </span>
                    <button
                      onClick={() => updateChatFormHeo(t, 1)}
                      className="relative z-10 size-8 rounded-full bg-muted/70 font-black"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-[8fr_2fr] gap-2 pt-1">
              <Button
                size="sm"
                className="h-10 font-black "
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
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
