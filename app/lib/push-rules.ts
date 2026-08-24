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
  const { name, delta, prevTotal, newTotal } = input;

  const bigSwing = Math.abs(delta) >= PUSH_SWING_THRESHOLD;
  const flippedPositive = prevTotal < 0 && newTotal > 0;
  const flippedNegative = prevTotal > 0 && newTotal < 0;
  const signFlip = flippedPositive || flippedNegative;

  if (!bigSwing && !signFlip) {
    return { shouldNotify: false, title: "", body: "" };
  }

  let body: string;
  if (flippedPositive) {
    // Lội ngược lên dương
    if (Math.abs(delta) >= PUSH_SWING_THRESHOLD) {
      body =
        `Chúc mừng bạn đã được ${delta} điểm. ` +
        `Điểm tích lũy đã được nâng lên ${newTotal}. Thế như đang chẻ tre`;
    } else {
      body =
        `Chúc mừng bạn đã tích lũy được ${newTotal}. ` +
        `Thừa thắng xông tới nào`;
    }
  } else if (flippedNegative) {
    // Rớt xuống âm
    body =
      `Điểm tích lũy của bạn đã đi vào lòng đất ${newTotal} điểm. ` +
      `Hãy tận dụng cơ hội nhỏ nhất lật ngược tình hình nào`;
  } else {
    // Swing thuần (không đổi dấu)
    body = `${name} ${delta > 0 ? "+" : ""}${delta} điểm (tổng ${newTotal})`;
  }

  return { shouldNotify: true, title: name, body };
}
