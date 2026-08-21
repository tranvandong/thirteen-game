/**
 * stores/useToastStore.ts
 *
 * Toast state cho toàn bộ app (dùng chung ở session layout).
 * Mỗi toast có thể chứa các action nhanh (vd: Duyệt / Từ chối yêu cầu)
 * và được dismiss bằng id hoặc theo requestId (khi request đã được xử lý).
 */

import { create } from "zustand";

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  /** ms tự động đóng. Để Infinity để không tự đóng (chỉ đóng bằng nút X). */
  duration?: number;
  actions?: ToastAction[];
  /** Gắn với 1 join request cụ thể để dismiss khi request được xử lý. */
  requestId?: string;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id"> & { id?: string }) => string;
  dismissToast: (id: string) => void;
  dismissByRequestId: (requestId: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = toast.id ?? crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

    // Tự động xoá khỏi store sau `duration`, bất kể Toaster có mounted hay
    // không. Quan trọng: nếu user rời session (layout unmount) trước khi toast
    // tự đóng, timer của Radix bị huỷ nhưng store vẫn giữ toast -> khi quay
    // lại session toast cũ hiện lại. Timer này đảm bảo store tự dọn dẹp.
    const dur = toast.duration ?? 1000000;
    if (Number.isFinite(dur) && dur > 0 && dur !== Infinity) {
      setTimeout(() => {
        useToastStore.getState().dismissToast(id);
      }, dur);
    }

    return id;
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  dismissByRequestId: (requestId) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.requestId !== requestId) })),

  clearToasts: () => set({ toasts: [] }),
}));

// ── Standalone helpers (dùng ngoài React component) ─────────────
export function addToast(toast: Omit<ToastItem, "id"> & { id?: string }): string {
  return useToastStore.getState().addToast(toast);
}

export function dismissToast(id: string): void {
  useToastStore.getState().dismissToast(id);
}

export function dismissToastByRequestId(requestId: string): void {
  useToastStore.getState().dismissByRequestId(requestId);
}

export function clearToasts(): void {
  useToastStore.getState().clearToasts();
}
