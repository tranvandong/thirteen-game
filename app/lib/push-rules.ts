/**
 * app/lib/push-rules.ts
 *
 * Quy tắc CHUNG (single source of truth) cho thông báo biến động điểm,
 * dùng BOTH cho:
 *   - Web Push OS-level (server: push.server.ts → notifyScoreChanges)
 *   - Toast in-app     (client: layout.tsx → onScoreUpdated)
 * để hai kênh luôn ĐỒNG BỘ (cùng ngưỡng, cùng rule đổi dấu, cùng nội dung).
 *
 * Module này thuần (pure) — không import bất kỳ dependency server-only nào,
 * nên an toàn dùng cả ở client và server.
 */

/** Ngưỡng "biến động điểm lớn" (điểm) để thông báo. */
export const PUSH_SWING_THRESHOLD = 10;

/** Nhãn app hiển thị trong tiêu đề thông báo (thay thế "from thirteen").
 *  iOS lấy tên người gửi push từ manifest nên không thể đổi riêng; ta chèn
 *  nhãn này vào tiêu đề để '"Chặt heo"' xuất hiện trong thông báo. */
export const APP_PUSH_LABEL = "Chặt heo";

export interface ScoreChangeInput {
  /** Tên nhân vật. */
  name: string;
  /** Điểm ván này (newTotal - prevTotal). */
  delta: number;
  /** Tổng điểm trước ván. */
  prevTotal: number;
  /** Tổng điểm sau ván. */
  newTotal: number;
}

export interface ScoreChangeNotification {
  shouldNotify: boolean;
  title: string;
  body: string;
}

/**
 * Quyết định có thông báo không + nội dung (title/body).
 *
 * Rule (giống nhau cho OS push & toast in-app):
 *   thông báo khi |Δđiểm| ≥ PUSH_SWING_THRESHOLD HOẶC tổng điểm đổi dấu
 *   (âm → dương hoặc dương → âm). KHÔNG dựa vào thứ hạng.
 */
export function buildScoreChangeNotification(
  input: ScoreChangeInput,
): ScoreChangeNotification {
  const { delta, prevTotal, newTotal } = input;

  const bigSwing = Math.abs(delta) >= PUSH_SWING_THRESHOLD;
  const flippedPositive = prevTotal < 0 && newTotal > 0;
  const flippedNegative = prevTotal > 0 && newTotal < 0;
  const signFlip = flippedPositive || flippedNegative;

  if (!bigSwing && !signFlip) {
    return { shouldNotify: false, title: "", body: "" };
  }

  // Tiêu đề: dựa trên dấu của biến động điểm (dương → về bờ, âm → lòng đất).
  // Được chèn nhãn app phía trước để thông báo hiện "Chặt heo" (thay cho
  // "from thirteen" của hệ thống).
  const title =
    delta >= 0
      ? "Chúc mừng bạn đã về bờ"
      : "Bạn đã về với lòng đất";

  // Nội dung: nếu biến động lớn → thông điệp tích lũy điểm lớn.
  const body = bigSwing
    ? `Tuyệt vời, bạn vừa tích lũy được số điểm lớn (${delta > 0 ? "+" : ""}${delta} điểm.`
    : `Tổng điểm của bạn hiện là ${newTotal} điểm.`;

  return { shouldNotify: true, title, body };
}
