# Kiến trúc & Luồng dữ liệu

Tài liệu này mô tả cách hệ thống thực sự hoạt động (không phải spec MVP cũ). Đọc kèm `CLAUDE.md` và `docs/data-model.md`, `docs/scoring.md`, `docs/features.md`.

## 1. Mô hình tiến trình (Process Model)

```
 Browser (PWA)
   │  HTTP  / , /session/* , /join/* , /api/*
   ▼
 React Router dev server  (Vite)  :5173
   ├─ SSR, routes loaders/actions
   └─ dev proxy:
        /socket.io  ──ws──▶  Express + Socket.IO server :3000
        /api       ──http─▶  Express + Socket.IO server :3000
                              server/index.ts → initSocketServer(httpServer)
                              └─ Drizzle ORM ──▶ PostgreSQL
```

- `npm run dev`: `concurrently` chạy `react-router dev --host` (Vite :5173) **và** `tsx watch server/index.ts` (Express+Socket.IO :3000).
- **Tại sao tách 2 process?** RRv7 actions chạy trong tiến trình Vite (không có `io` instance), nên không thể tự broadcast. Vì vậy: client ghi xong DB qua action → emit `round:publish`/`round:delete` tới Socket process → process này **đọc lại DB (authoritative)** rồi broadcast.
- Build production: `npm run build` = `react-router build` (client+SSR) **+** `tsup server/index.ts --format esm --out-dir dist`. `npm start` = `node dist/index.js` (Express+Socket.IO, port từ `PORT` hoặc `3000`; `0.0.0.0` ở prod).
- `vite.config.ts` proxy: `allowedHosts` có ngrok free host; `/socket.io` (ws) và `/api` → `localhost:3000`.

## 2. Nơi đặt logic (thực tế)

| Vai trò | File thực tế |
|---------|--------------|
| HTTP / ghi DB | `app/routes/**` (loaders + actions) |
| Lưu/xoá ván, tích luỹ khạp/sảnh | `app/lib/round.server.ts` (`saveRound`, `deleteRound`, `getRoundMeta`, `nextKhapSanhAccumulated`) |
| Socket server | `app/lib/socket.server.ts` (`initSocketServer`, `broadcastRoundSaved`, `broadcastRoundDeleted`, `sessionRoom`) |
| Socket client | `app/lib/socket.client.ts` (singleton `io()`, emitters + subscribers) |
| Toán tính điểm | `app/helpers/match.helper.ts` (`computedScoresHelper`, `reRanking`, `buildPigCounts`, `playTTS`) |
| State client (realtime) | `app/stores/useSessionStore.ts` (Zustand, persist `thirteen-session`), `app/stores/useToastStore.ts` |
| Logic UI match | `app/hooks/useMatchScoring.ts` |
| Fingerprint | `app/helpers/fingerprint.helper.ts` (`createFingerprint`, `getOrCreateFingerprint`) |
| DB client | `app/db/client.server.ts` (`drizzle(pg.Pool, {schema})`) |
| Schema | `app/db/schema/**` (barrel `app/db/schema/index.ts`) |

> **File rỗng (stub) — KHÔNG chứa logic**: `app/modules/**` (toàn bộ session/participant/game/score), `app/services/auth.server.ts`, `app/db/index.ts`, `app/lib/constants.ts`. Đừng sửa ở đó.

## 3. Realtime contract (Socket.IO)

Room mỗi session: `session:${code}` (`sessionRoom()`).

### Client → Server (commands)
| Event | Payload | Xử lý |
|-------|---------|-------|
| `join-session` | `{ sessionCode, participantId, displayName }` | `socket.join(room)`, lưu `socket.data.*`, emit `participant-joined` cho others. |
| `leave-session` | `{ sessionId }` | `socket.leave(room)`. |
| `send-join-request` | `{ sessionCode, displayName }` | Insert `join_requests` (pending, `requestToken: crypto.randomUUID()`), join room, emit `join-request-sent` (cho người gửi) + `join-request-created` (room). |
| `approve-join-request` | `{ sessionCode, requestId }` | `assertOwner` → update status=`approved`, insert `participants` (role member), emit `participant-approved`. |
| `reject-join-request` | `{ sessionCode, requestId }` | `assertOwner` → status=`rejected`, emit `join-request-rejected`. |
| `kick-participant` | `{ sessionCode, participantId }` | `assertOwner` (không tự kick) → delete `participants` (cascade `participant_players`+`player_devices`), emit `participant-kicked`. |
| `round:publish` | `{ sessionCode }` | `broadcastRoundSaved` (đọc lại DB). |
| `round:delete` | `{ sessionCode, roundId }` | `broadcastRoundDeleted` (đọc lại DB). |
| `player:select` | `{ sessionCode, participantId, playerId }` | Đọc tên (authoritative) rồi broadcast `player:selected` cho room. |
| `player:deselect` | `{ sessionCode, participantId, playerId }` | Đọc tên rồi broadcast `player:deselected` cho room. |

`assertOwner`: so sánh `sessions.ownerParticipantId` với `socket.data.participantId`.

### Server → Client (events)
| Event | Payload | Ý nghĩa |
|-------|---------|---------|
| `join-request-sent` | `{ requestId, sessionCode }` | Gửi riêng cho người gửi request. |
| `join-request-created` | `{ requestId, displayName, sessionCode }` | Broadcast room (owner hiện toast). |
| `participant-approved` | `{ requestId, participant:{id,displayName,role} }` | Broadcast room. |
| `join-request-rejected` | `{ requestId, displayName, sessionCode }` | Broadcast room. |
| `participant-kicked` | `{ participantId, sessionCode }` | Broadcast room. |
| `participant-joined` | `{ participantId, displayName }` | Cho others khi có người join room. |
| `round:finished` | `{ sessionCode, round, roundMeta:getRoundMeta, totals }` | Ván mới được lưu (authoritative). |
| `score:updated` | `{ sessionCode, totals:[{playerId,totalScore}] }` | Bảng điểm mới. |
| `round:deleted` | `{ sessionCode, roundId }` | Ván bị xoá. |
| `player:selected` | `{ sessionCode, participantId, displayName, playerId, playerName }` | Có người chọn nhân vật (broadcast room, kể cả chủ phòng) → hiện push notification (toast). |
| `player:deselected` | `{ sessionCode, participantId, displayName, playerId, playerName }` | Có người bỏ chọn nhân vật (broadcast room) → hiện push notification (toast). |

Client **chỉ lắng nghe**; không tin payload tự tính — server luôn đọc lại DB.

## 4. Luồng dữ liệu chính

### 4.1 Tạo session
`session.create.tsx` `action()` → `db.transaction`:
1. Insert `sessions` (tạo `code` `XXXX-XXXX`).
2. Insert `participants` (role `owner`).
3. Set `sessions.ownerParticipantId`.
4. Insert `game_configs` (unique `sessionId`).
5. Insert 4 `players`.
6. Insert `playerDevices` (owner, `platform:'anonymous'`).
→ `redirect("/session/{code}")`.

### 4.2 Join request (realtime)
Client `sendJoinRequest` → socket `send-join-request` (insert `join_requests`, broadcast `join-request-created`) → owner `approveJoinRequest` → socket `approve-join-request` (owner-checked, insert `participants`, broadcast `participant-approved`) → join page `onParticipantApproved` → `registerDevice` (POST `/devices`) → navigate vào session.

### 4.3 Lưu ván (ghi điểm)
1. `match.tsx` `action` (`intent:save-round`) → `saveRound(sessionCode, createdBy, results)`.
2. `saveRound` (transaction): tính `hadKhap=any khapno>0`, `hadSanh=any sanhno>0`, `hadNhot=any nhotterId!=""`; tính `accumulated = nextKhapSanhAccumulated(lastRound, limits)`; insert `rounds` (+ `accumulatedKhap/Sanh`, flags); insert `round_results`; upsert `session_totals` (`totalScore += score`).
3. Trả `{ round, totals }` về client.
4. Client `publishRound(sessionCode)` → socket `round:publish` → `broadcastRoundSaved` đọc lại DB → `round:finished` + `score:updated` cho room.
5. Mọi client (kể cả người gửi) update `useSessionStore` (`addRound`, `setTotals`).
6. Nếu `enableTTS` và điều kiện thoả → `playTTS(...)` đọc kết quả.

### 4.4 Xoá ván (hoàn trả điểm)
`match.tsx` `action` (`intent:delete-round`) → `deleteRound` (transaction: trừ ngược `score` khỏi `session_totals`, xoá `round_results` rồi `rounds`) → client `publishRoundDeleted` → socket `round:delete` + `score:updated` → client `removeRound`.

### 4.4b Push notification biến động nhân vật
Mỗi thiết bị lưu `mySelectedPlayerId` (nhân vật người tham gia đó chọn) vào `useSessionStore` — lấy từ `GET /api/sessions/{code}/devices/active` (trả thêm `selectedPlayerId`) và cập nhật khi chọn/bỏ chọn ở `settings.tsx`.

Khi có ván mới / xoá ván, server broadcast `score:updated` (totals) cho room. Ở `layout.tsx`, listener `onScoreUpdated` so sánh bảng điểm mới với bảng điểm gần nhất (lưu trong `scoreRef`):
- Nếu nhân vật **của thiết bị này** có `|Δđiểm| ≥ SWING_THRESHOLD` (mặc định 30) **hoặc** thay đổi thứ hạng → hiện toast `"<tên nhân vật> có biến động"` (chi tiết hạng cũ→mới và/hoặc Δđiểm).
- Chỉ thiết bị đã chọn nhân vật đó nhận toast (targeted push). Reset `scoreRef` khi đổi nhân vật.

### 4.5 Xác thực thiết bị (không cookie)
- Vào session: layout `clientLoader` gọi `GET /api/sessions/{code}/devices/active?fingerprint=` → nếu không có participant active → redirect `/join/{code}`.
- Home auto-resume: `GET /api/sessions/active-by-device?fingerprint=` → redirect vào session nếu có.
- `POST /api/sessions/{code}/devices` upsert `player_devices` (`onConflict` `[sessionId,fingerprint]`).
- `PATCH .../devices/leave` set `status='left'` (idempotent); `POST .../devices/reconnect` set `status='active'` lại.

### 4.6 TTS
`POST /api/tts` `{ text }` → proxy ElevenLabs (`ELEVENLABS_API_KEY`) → stream `audio/mpeg` về client phát qua `<audio>`.

### 4.7 Web Push (OS-level notification)
Push thông báo hệ điều hành (Web Push API + VAPID) tới thiết bị participant — hoạt động kể cả khi app đã đóng / background.

- **Client đăng ký**: `registerDevice` (layout) request `Notification.requestPermission()`, `pushManager.subscribe({ applicationServerKey: VITE_VAPID_PUBLIC_KEY })` → lưu `pushToken` (JSON PushSubscription) vào `player_devices` (cột `text`).
- **Server gửi**: `lib/push.server.ts` dùng `web-push` (VAPID từ `VAPID_PRIVATE_KEY` + `VITE_VAPID_PUBLIC_KEY` + `VAPID_SUBJECT`). Hàm:
  - `sendPushToSession(sessionId, payload, exceptParticipantId?)` — toàn bộ participant (trừ actor).
  - `sendPushToPlayer(sessionId, playerId, payload)` — TARGETED: chỉ thiết bị của người đã chọn nhân vật `playerId` (join `participant_players` → `player_devices` active).
- **Trigger**:
  - `player:select` / `player:deselect` (socket handler) → `sendPushToSession(..., exceptParticipantId)`.
  - `broadcastRoundSaved` → `notifyScoreChanges`: tính `prevTotals = newTotals − điểm ván này` (từ `round_results`), so sánh `|Δđiểm| ≥ PUSH_SWING_THRESHOLD (10)` hoặc đổi dấu âm/dương (âm↔dương). **Cùng rule với toast in-app** (định nghĩa chung ở `app/lib/push-rules.ts` → `buildScoreChangeNotification`) → `sendPushToPlayer` cho nhân vật đó.
- **Service Worker** (`public/sw.js`): `push` handler hiện notification, **nhưng bỏ qua nếu app đang mở & focus** (tránh trùng với toast realtime in-app); `notificationclick` focus/navigate tab hiện có hoặc mở mới.
- **Env (cùng 1 cặp VAPID)**: `VITE_VAPID_PUBLIC_KEY` (client), `VAPID_PRIVATE_KEY` (server), `VAPID_SUBJECT`. Sinh: `npx web-push generate-vapid-keys`.
- **Schema**: `player_devices.pushToken` đổi `varchar(512)` → `text` (subscription vượt 512 ký tự). Chạy `npm run db:push`.

## 5. Device & Participation model

- `participants`: thiết bị/người truy cập (role `owner`/`member`).
- `players`: người được tính điểm (có `orderNo`, `initialScore`).
- `participant_players`: ánh xạ 1-1 (unique `(sessionId, participantId)` và `(sessionId, playerId)`) — mỗi participant chọn 1 player.
- `player_devices`: thiết bị (fingerprint) tham gia. Unique `(sessionId, fingerprint)`. Có `status` active/left, `pushToken` (nullable), `platform`.
- **Ràng buộc "1 thiết bị active / 1 session"**: app logic (`leave`/`reconnect`) đảm bảo; **không có partial unique index** trong DDL.

## 6. Cảnh báo / Drift (quan trọng)

- **Migrations cũ**: `drizzle/*.sql` không chứa `player_devices`, `participant_players`, cột `rounds.accumulated_*`, `players.initial_score`, enum `session_status`/`player_device_status`. Dự án dùng **codebase-first** (`drizzle-kit push`), không chạy `db:migrate`. Nên xoá/regen migrations hoặc cam kết dùng push.
- **`sessionStatusEnum` khai báo nhưng không dùng** (cột `status` là `varchar`). `participant.role` cũng `varchar`.
- **Mặc định limit khạp/sảnh**: schema `game_configs` `khapLimit=3, sanhLimit=2`; nhưng `getKhapSanhLimits` fallback `5/3`. Giá trị DB thắng.
- **`useMatchScoring`** hardcode `nhotBystanderPenalty=2`, `heoDoPoints=redPigScore??3`, `heodenPoints=blackPigScore??5` (không lấy từ config store) — dễ gây lệch nếu đổi config.
- **`socket.server.ts`** import `playerDevices` nhưng không dùng trong handlers.

## 7. Testing

- **Vitest** (`vitest.config.ts`). `app/helpers/match.helper.test.ts` kiểm thử `computedScoresHelper` (rank, khạp, sảnh, chặt heo, nhốt 1/2/3 victim, đền bài), `reRanking`, `buildPigCounts`.
- Chạy: `npm test`.
