# Thirteen Game Score Tracker

> Ứng dụng web ghi điểm và quản lý lịch sử các ván bài **Tiến Lên (Thirteen)** theo thời gian thực, có hỗ trợ PWA, đa thiết bị và các luật tính điểm nâng cao (nhốt bài, khạp, sảnh, chặt heo).

Đây là tài liệu tổng quan và tham chiếu cho toàn bộ project. Các tài liệu chi tiết được tách ra trong thư mục `docs/`:

- `docs/architecture.md` — mô hình tiến trình, luồng dữ liệu, hợp đồng realtime, mô hình thiết bị/người tham gia.
- `docs/data-model.md` — schema database đầy đủ (Drizzle).
- `docs/scoring.md` — luật tính điểm Tiến Lên được implement.
- `docs/features.md` — danh mục route / trang UI và chức năng.

---

## Trạng thái hiện tại của codebase (quan trọng)

Tài liệu cũ (phiên bản spec MVP) mô tả một kiến trúc module-based (`session.service`, `participant.service`, `game-calculator`, ...). **Thực tế các file `app/modules/**` đều rỗng** — logic không nằm ở đó.

Kiến trúc thực tế là:

- **Route actions/loaders** (React Router) là nơi xử lý HTTP và ghi DB.
- **`app/lib/`** chứa logic server: `round.server.ts` (lưu/xoá ván, tính khạp/sảnh tích luỹ), `socket.server.ts` (Socket.IO server độc lập), `socket.client.ts` (wrapper client).
- **`app/helpers/match.helper.ts`** chứa toán tính điểm (`computedScoresHelper`, `reRanking`, `buildPigCounts`).
- **`app/stores/useSessionStore.ts`** là Zustand store (persist localStorage) giữ state realtime phía client.
- **`app/hooks/`** (`useMatchScoring`, `usePWA`, `useAudio`) là logic UI.
- **`app/db/schema/`** định nghĩa schema Drizzle (codebase-first).

> Khi đọc code, đừng tìm logic trong `app/modules/*` — chúng chỉ là khung rỗng.

---

## Technology Stack (thực tế)

### Frontend / Full-stack framework
- **React Router v7** (framework mode, SSR enabled) — v7.16.0
- **TypeScript** (strict)
- **Tailwind CSS v4** (`@tailwindcss/vite`) + **shadcn/ui** (trên **radix-ui**, `class-variance-authority`, `clsx`, `tailwind-merge`)
- **Socket.IO Client** (`socket.io-client`)
- **Zustand** (client state, persisted)
- **Recharts** (biểu đồ điểm số)
- **qrcode** + **@yudiel/react-qr-scanner** (tạo/quét QR mời người chơi)
- **yet-another-react-lightbox**, **lucide-react**, **read-vietnamese-number**, **tw-animate-css**

### Backend / Realtime
- **React Router v7 Server** (Express adapter `@react-router/express`)
- **Socket.IO Server** (`socket.io`) — chạy trên tiến trình Node riêng (port 3000)
- **PostgreSQL** + **Drizzle ORM** (`drizzle-orm`, `pg`)
- **Express 5** + **tsup** (bundle server) + **tsx** (dev watch)

### Build / Deploy / Infra
- **Vite** (qua `@react-router/dev/vite`) cho client + SSR build
- **Docker** (multi-stage, `node:20-alpine`)
- **PWA**: `public/manifest.json` + `public/sw.js` (installable, standalone)
- **TTS (Text-to-Speech)**: gọi external API (`TTS_API_URL`, mặc định everai.vn) để đọc kết quả ván — route `app/routes/api.tts.ts`

---

## Kiến trúc tổng quan

```
                  ┌─────────────────────────────────────────┐
   Browser  ─────▶│  React Router dev server (Vite :5173)    │
   (PWA)          │  - SSR / routes / loaders / actions      │
                  │  - proxy /socket.io & /api → :3000       │
                  └───────────────┬───────────────┬──────────┘
                                  │               │
                       /api (HTTP) │               │ /socket.io (ws)
                                  ▼               ▼
                  ┌─────────────────────────────────────────┐
                  │  Express + Socket.IO server (:3000)       │
                  │  server/index.ts → initSocketServer()     │
                  │  - Socket handlers (join, approve, ...)   │
                  │  - Authoritative broadcast sau khi ghi DB │
                  └───────────────┬───────────────────────────┘
                                  │ Drizzle ORM
                                  ▼
                          ┌───────────────┐
                          │  PostgreSQL   │
                          └───────────────┘
```

- `npm run dev` chạy **đồng thời** hai tiến trình: `react-router dev --host` (Vite :5173) và `tsx watch server/index.ts` (Express+Socket :3000) qua `concurrently`.
- Vite dev proxy: `/socket.io` (ws) và `/api` được chuyển tiếp tới `localhost:3000`.
- **Luồng realtime chuẩn**: client gửi action (lưu/xoá ván) qua route → route ghi DB xong → client emit `round:publish` / `round:delete` tới Socket server → Socket server **đọc lại DB (authoritative)** → broadcast `round:finished` + `score:updated` / `round:deleted` cho toàn bộ room → các client cập nhật Zustand store.
- Mỗi session là một Socket room: `session:${code}`.

Xem chi tiết: `docs/architecture.md`.

---

## Core Concepts

| Khái niệm | Ý nghĩa |
|-----------|---------|
| **Session** | Một bàn chơi. Mọi dữ liệu (config, players, rounds, totals) gắn với session. Có `code` (shareable) và `status` (`active`/`finished`). |
| **Participant** | Thiết bị/người đang truy cập session (có thể không phải player). Có `role` (`owner`/`member`). Owner được kick. |
| **Player** | Người được tính điểm trong trận. Thuộc session, có `orderNo` và `initialScore`. |
| **ParticipantPlayer** | Ánh xạ 1-1: mỗi participant chọn 1 player, mỗi player bị chọn bởi 1 participant (trong 1 session). |
| **PlayerDevice** | Thiết bị (fingerprint) tham gia session. Unique `(sessionId, fingerprint)`. Ràng buộc "1 thiết bị chỉ `active` trong 1 session" được **app logic** (leave/reconnect) đảm bảo, **không** bởi DDL (không có partial unique index). |
| **Round** | Một ván. Lưu `roundNo`, khạp/sảnh tích luỹ, các cờ `hadKhap`/`hadSanh`/`hadNhot`. |
| **RoundResult** | Kết quả từng player trong 1 ván (rank, score, số heo đỏ/đen, khạp, sảnh). |
| **SessionTotal** | Bảng điểm tổng (denormalized) để đọc nhanh, cập nhật mỗi khi lưu/xoá ván. |

---

## Game Configuration & Scoring (tóm tắt)

Session có `gameConfigs` với:

- **Điểm hạng**: `firstPlaceScore`, `secondPlaceScore`, `thirdPlaceScore`, `fourthPlaceScore` (rank points).
- **Heo (lợn)**: `redPigScore` (heo đỏ), `blackPigScore` (heo đen), `tripleScore` (tứ quý cơ bản).
- **Khạp / Sảnh**: `khapScore`, `khapLimit`, `sanhScore`, `sanhLimit` — điểm và ngưỡng tích luỹ.
- **Flags UI**: `showBackground`, `enableTTS` (trong store client).

Luật tính điểm Tiến Lên gồm: điểm hạng, **nhốt bài (chốt)**, **khạp (tứ quý)**, **sảnh (dây)**, **chặt heo (đè heo đỏ/đen)**, và **đền bài**. Khạp/sảnh tích luỹ qua các ván, reset về 1 khi có người thắng.

Chi tiết toán học: `docs/scoring.md`.

---

## Tính năng chính (routes)

| Route | Trang | Chức năng chính |
|-------|-------|-----------------|
| `/` | Home | Trang chủ, tạo/ vào session, danh sách session gần của thiết bị. |
| `/session/create` | Tạo phòng | Form chủ phòng, danh sách player, cấu hình luật, tạo session + owner participant. |
| `/session/:sessionId` | Lobby | Chia sẻ link/QR, danh sách participant, kick, chọn player. |
| `/session/:sessionId/settings` | Cài đặt | Sửa luật, background, TTS, xoá/sắp xếp player, kết thúc session. |
| `/session/:sessionId/match` | Ghi ván | Nhập kết quả ván, tính điểm realtime (nhốt, khạp, sảnh, chặt heo), lưu/xoá ván, TTS đọc kết quả. |
| `/session/:sessionId/chart` | Biểu đồ | Recharts theo dõi điểm số qua các ván. |
| `/session/:sessionId/history` | Lịch sử | Danh sách toàn bộ ván đã chơi. |
| `/session/:sessionId/history/:roundId` | Chi tiết ván | Kết quả chi tiết từng player trong ván. |
| `/join/:sessionId` | Tham gia | Form tên hiển thị → tham gia trực tiếp (không cần duyệt). |
| `/api/sessions/:sessionId/devices/*` | Device API | active / leave / reconnect thiết bị trong session. |
| `/api/sessions/active-by-device` | Device API | Lấy session đang active của 1 thiết bị (fingerprint). |
| `/api/tts` | TTS | POST text → trả audio để phát qua client. |

Chi tiết từng trang: `docs/features.md`.

---

## Realtime Events (hợp đồng Socket.IO)

**Client → Server (commands)**: `join-session`, `leave-session`, `join-session-direct` (tham gia trực tiếp, không cần duyệt), `kick-participant`, `round:publish`, `round:delete`.

**Server → Client (events)**: `join-direct-success`, `participant-joined`, `participant-kicked`, `round:finished`, `score:updated`, `round:deleted`.

Tham gia phòng chỉ cần nhập tên + fingerprint thiết bị (socket `join-session-direct` tạo participant + đăng ký device). Chỉ owner (participant mang `ownerParticipantId`) mới được kick. Chi tiết payload: `docs/architecture.md`.

---

## Phát triển & Vận hành

### Yêu cầu
- Node.js 20+ (Docker dùng `node:20-alpine`)
- PostgreSQL (ứng dụng đang dùng Render Postgres qua `DATABASE_URL`)
- Biến môi trường (`.env`):
  - `DATABASE_URL` — connection string Postgres.
  - `PROD` — `true`/`false`.
  - `GEMINI_KEY` — (dự phòng AI).
  - `TTS_API_URL`, `TTS_API_KEY` — dịch vụ TTS (everai.vn).
  - `ELEVENLABS_API_KEY` — (dự phòng TTS).

### Scripts (`package.json`)
```bash
npm install
npm run dev          # Vite (:5173) + Socket server (:3000) cùng lúc
npm run build        # react-router build + tsup bundle server → dist/
npm start            # node dist/index.js
npm run typecheck    # react-router typegen + tsc
npm run db:push      # drizzle-kit push (đồng bộ schema → DB, codebase-first)
npm run db:studio    # drizzle-kit studio
npm run db:generate  # drizzle-kit generate (không dùng migration files)
npm test             # vitest run
```

> **Database strategy**: Codebase-first. Schema định nghĩa bằng TypeScript trong `app/db/schema`. Không dùng SQL migration files — dùng `drizzle-kit push`.

### Docker
```bash
docker build -t thirteen-game .
docker run -p 3000:3000 --env-file .env thirteen-game
```
Multi-stage build: cài deps, build (client + server), chạy `npm start` (Express + Socket.IO trên port 3000).

### Testing
- **Vitest** (`vitest.config.ts`). Test hiện có: `app/helpers/match.helper.test.ts` (kiểm thử toán tính điểm).

---

## Non-Functional Notes

- **Performance**: bảng điểm tổng (`session_totals`) được denormalize để đọc nhanh, không aggregate từ lịch sử mỗi request. Realtime broadcast từ server (authoritative) đọc lại DB.
- **Security (MVP)**: không có authentication. Phân quyền qua `role` + so khớp `ownerParticipantId` ở Socket server. Chỉ participant (tham gia trực tiếp qua `join-session-direct`) mới truy cập quản lý điểm.
- **PWA**: cài được vào màn hình chính, standalone, manifest + service worker (`public/sw.js`, `public/manifest.json`).
- **Thiết bị**: fingerprint nhận diện thiết bị; 1 thiết bị chỉ `active` trong 1 session nhờ logic app (`leave`/`reconnect` cập nhật `status`), không phải ràng buộc DB.

---

## Cảnh báo / Drift hiện tại (đọc trước khi sửa code)

- **File rỗng (stub)**: `app/modules/**` (toàn bộ session/participant/game/score), `app/services/auth.server.ts`, `app/db/index.ts`, `app/lib/constants.ts` — **không chứa logic**, đừng sửa ở đó. Logic nằm ở `app/lib`, `app/helpers`, `app/hooks`, `app/stores`, `app/routes`, `app/db`.
- **Không có partial unique index** trên `player_devices` (chỉ `unique(sessionId, fingerprint)`). "1 thiết bị active / 1 session" là ý định design, chưa được DB đảm bảo.
- **Migrations đã cũ**: thư mục `drizzle/` chứa SQL migration **không đồng bộ** với schema (thiếu `player_devices`, `participant_players`, các cột `rounds.accumulated_*`, `players.initial_score`, enum `session_status`/`player_device_status`). Dự án dùng **codebase-first** (`drizzle-kit push`), không chạy `db:migrate`, nên DB được điều khiển bởi `app/db/schema/*`. Cần cân nhắc xoá/regen migrations hoặc chuyển hẳn sang push.
- **`sessionStatusEnum`** được khai báo nhưng **không dùng** (cột `status` dùng `varchar`). `participant.role` cũng dùng `varchar` (không enum).
- **Mặc định limit khạp/sảnh**: schema `game_configs` mặc định `khapLimit=3, sanhLimit=2`; nhưng `getKhapSanhLimits` (fallback) dùng `5/3`. Giá trị DB thắng.
- **`useMatchScoring`** hardcode `nhotBystanderPenalty=2`, `heoDoPoints=redPigScore??3`, `heodenPoints=blackPigScore??5` (không lấy từ config store).

---

## Hướng phát triển (Scalability)

Kiến trúc sẵn sàng cho:
- Login / user accounts
- Nhiều loại game (không chỉ Tiến Lên)
- Luật Tiến Lên đặc biệt mở rộng
- Undo / delete round (đã có delete round + hoàn trả điểm)
- Tournament mode
- Push notification (đã có trường `pushToken` trong `player_devices`)
