/**
 * components/ui/toaster.tsx
 *
 * Global Toaster dựa trên Radix Toast (meta package `radix-ui`).
 * Đọc danh sách toast từ useToastStore và render fixed viewport.
 *
 * Đặc điểm cho yêu cầu "thông báo realtime, chuyển tab vẫn hiển thị, có nút đóng":
 * - Mount ở session layout (tồn tại xuyên suốt các tab).
 * - Toast yêu cầu tham gia dùng duration = Infinity (chỉ đóng khi user bấm X)
 *   nên không biến mất khi đổi tab. Danh sách ở Settings vẫn giữ để duyệt sau.
 */

import { Toast } from "radix-ui";
import { X, UserPlus } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { useToastStore } from "~/stores/useToastStore";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);

  return (
    <Toast.Provider swipeDirection="right" duration={1000000}>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          duration={t.duration ?? 1000000}
          className={cn(
            "pointer-events-auto relative flex w-full max-w-sm flex-col gap-2 overflow-hidden rounded-2xl border p-4 pr-9 shadow-2xl backdrop-blur bg-card text-foreground ring-1 ring-border/60",
            t.variant === "destructive" &&
              "border-destructive/50 bg-destructive text-destructive-foreground ring-destructive/20",
          )}
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
                t.variant === "destructive" && "bg-white/15 text-destructive-foreground",
              )}
            >
              <UserPlus className="size-4" />
            </div>

            <div className="min-w-0 flex-1">
              <Toast.Title className="text-sm font-bold leading-tight">
                {t.title}
              </Toast.Title>
              {t.description && (
                <Toast.Description className="mt-0.5 text-xs text-muted-foreground">
                  {t.description}
                </Toast.Description>
              )}
            </div>

            <Toast.Close
              aria-label="Đóng"
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Toast.Close>
          </div>

          {t.actions && t.actions.length > 0 && (
            <div className="flex gap-2 pl-11">
              {t.actions.map((a, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={a.variant === "destructive" ? "destructive" : "default"}
                  className="h-7 text-xs"
                  onClick={() => {
                    a.onClick();
                    dismiss(t.id);
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </Toast.Root>
      ))}

      <Toast.Viewport className="fixed bottom-[calc(6.75rem_+_env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 p-4 outline-none" />
    </Toast.Provider>
  );
}
