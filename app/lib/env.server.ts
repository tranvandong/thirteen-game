import dotenv from "dotenv";

// ────────────────────────────────────────────────────────────────
// Load .env tập trung 1 lần.
// - Nếu đã được load ở entry (`dotenv/config`) thì `config()` trả
//   kết quả cũ, không lặp lại parse.
// - Chỉ load file `.env` mặc định; các file như `.env.local`
//   đã được tự động gom bởi dotenv theo priority.
// ────────────────────────────────────────────────────────────────
dotenv.config();

// ────────────────────────────────────────────────────────────────
// Schema kiểm dữ liệu
// ────────────────────────────────────────────────────────────────
interface Env {
  // App
  DATABASE_URL: string;
  PROD: string;

  // AI / TTS
  GEMINI_KEY?: string;
  TTS_API_URL?: string;
  TTS_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  AI_API_URL?: string;

  // Web Push (VAPID)
  VITE_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;

  // Node runtime (đôi khi cần kiểm tra đúng chỗ)
  NODE_ENV: string;
  PORT?: string;
}

// ────────────────────────────────────────────────────────────────
// Validate biến bắt buộc
// ────────────────────────────────────────────────────────────────
const required: (keyof Env)[] = ["DATABASE_URL"];

for (const key of required) {
  const value = process.env[key];
  if (!value || (typeof value === "string" && value.trim() === "")) {
    throw new Error(`[env] Biến môi trường bắt buộc thiếu hoặc rỗng: ${key}`);
  }
}

// ────────────────────────────────────────────────────────────────
// Build object env cuối cùng
// ────────────────────────────────────────────────────────────────
const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  PROD: process.env.PROD ?? "false",
  GEMINI_KEY: process.env.GEMINI_KEY,
  TTS_API_URL: process.env.TTS_API_URL,
  TTS_API_KEY: process.env.TTS_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  VITE_VAPID_PUBLIC_KEY: process.env.VITE_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT ?? "mailto:push@thirteen.game",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT,
  AI_API_URL: process.env.AI_API_URL,
};

// ────────────────────────────────────────────────────────────────
// Freeze để đảm bảo không bị sửa đổi lúc runtime
// ────────────────────────────────────────────────────────────────
Object.freeze(env);

export { env };
export type { Env };
