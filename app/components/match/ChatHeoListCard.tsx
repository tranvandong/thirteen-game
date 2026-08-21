import type { Dispatch, SetStateAction } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Plus, Scissors, X } from "lucide-react";
import type { ChatHeo, GameConfigs } from "~/types/match.type";

export interface ChatHeoListCardProps {
  chatHeoList: ChatHeo[];
  nhotVictimIds: string[];
  gameConfig: GameConfigs;
  showChatHeoForm: boolean;
  setShowChatHeo: (value: boolean) => void;
  setShowChatHeoForm: (value: boolean) => void;
  setChatHeoList: Dispatch<SetStateAction<ChatHeo[]>>;
  setChatForm: Dispatch<
    SetStateAction<{
      chatterId: string;
      victimId: string;
      heo: { do: number; den: number };
    }>
  >;
  removeChatHeo: (id: string) => void;
  pShort: (id: string) => string;
}

/**
 * Hiển thị danh sách các lượt "Chặt heo" đã chốt + nút Thêm.
 * Tách ra từ match.tsx (khối {showChatHeo && ...}).
 */
export function ChatHeoListCard({
  chatHeoList,
  nhotVictimIds,
  gameConfig,
  showChatHeoForm,
  setShowChatHeo,
  setShowChatHeoForm,
  setChatHeoList,
  setChatForm,
  removeChatHeo,
  pShort,
}: ChatHeoListCardProps) {
  return (
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

        {nhotVictimIds.length === 3 ? (
          <p className="text-xs font-medium italic text-muted-foreground">
            Nhốt tất cả · không tính chặt heo
          </p>
        ) : null}

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
                    <span className="font-black">{pShort(c.chatterId)}</span>
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
  );
}
