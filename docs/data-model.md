# Data Model (Drizzle Schema)

Schema định nghĩa trong `app/db/schema/` (codebase-first, đồng bộ bằng `drizzle-kit push`). Tất cả bảng dùng `uuid` PK (`defaultRandom()`), `createdAt`/`updatedAt` (UTC). FK dùng `onDelete: "cascade"` về `sessions`.

Export tập trung qua `app/db/schema/index.ts`.

---

## sessions
Bàn chơi.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid PK | |
| `code` | varchar(20) unique, notNull | Mã shareable, format `XXXX-XXXX`. |
| `ownerParticipantId` | uuid (FK → participants.id) | Có thể null. |
| `status` | varchar(20) default `active`, notNull | enum `session_status`: `active` / `finished`. |
| `createdAt` | timestamp defaultNow | |
| `updatedAt` | timestamp defaultNow | |

---

## participants
Thiết bị/người truy cập session.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid PK | |
| `sessionId` | uuid FK → sessions (cascade), notNull | |
| `displayName` | varchar(100), notNull | |
| `role` | varchar(20) default `member`, notNull | `owner` / `member`. |
| `joinedAt` | timestamp defaultNow | |

---

## join_requests
Yêu cầu tham gia chờ duyệt.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid PK | |
| `sessionId` | uuid FK → sessions (cascade), notNull | |
| `displayName` | varchar(100), notNull | |
| `status` | enum `join_request_status` default `pending` | `pending` / `approved` / `rejected`. |
| `requestToken` | varchar(255), notNull | Dùng match request sau này. |
| `approvedBy` | uuid FK → participants.id | Null đến khi duyệt. |
| `approvedAt` | timestamp | |
| `createdAt` | timestamp defaultNow | |

---

## game_configs
Cấu hình luật tính điểm (1-1 với session, `sessionId` unique).

| Cột | Kiểu | Mặc định | Ý nghĩa |
|-----|------|----------|---------|
| `id` | uuid PK | | |
| `sessionId` | uuid FK → sessions (cascade), unique, notNull | | |
| `firstPlaceScore` | integer, notNull | | Điểm hạng 1 |
| `secondPlaceScore` | integer, notNull | | Điểm hạng 2 |
| `thirdPlaceScore` | integer, notNull | | Điểm hạng 3 |
| `fourthPlaceScore` | integer, notNull | | Điểm hạng 4 (thường âm) |
| `redPigScore` | integer, notNull | 20 | Heo đỏ |
| `blackPigScore` | integer, notNull | 10 | Heo đen |
| `tripleScore` | integer, notNull | 20 | Tứ quý cơ bản |
| `khapScore` | integer, notNull | 1 | Điểm khạp (nhân với tích luỹ & số lần) |
| `khapLimit` | integer, notNull | 3 | Ngưỡng tích luỹ khạp tối đa |
| `sanhScore` | integer, notNull | 1 | Điểm sảnh |
| `sanhLimit` | integer, notNull | 2 | Ngưỡng tích luỹ sảnh tối đa |

> Lưu ý: store client (`useSessionStore.GameConfig`) còn có `showBackground`, `enableTTS` (flags UI, không lưu trong bảng này mà trong localStorage / store).

---

## players
Người được tính điểm.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid PK | |
| `sessionId` | uuid FK → sessions (cascade), notNull | |
| `name` | varchar(100), notNull | |
| `orderNo` | integer, notNull | Thứ tự chỗ ngồi. |
| `initialScore` | integer default 0, notNull | Điểm gốc (cộng vào tổng). |

---

## rounds
Một ván.

| Cột | Kiểu | Mặc định | Ý nghĩa |
|-----|------|----------|---------|
| `id` | uuid PK | | |
| `sessionId` | uuid FK → sessions (cascade), notNull | | |
| `roundNo` | integer, notNull | | Số thứ tự ván (tăng dần). |
| `createdBy` | uuid, notNull | | Participant tạo ván. |
| `accumulatedKhap` | integer default 1 | | Hệ số khạp tích luỹ áp dụng cho ván này. |
| `accumulatedSanh` | integer default 1 | | Hệ số sảnh tích luỹ áp dụng cho ván này. |
| `hadKhap` | boolean default false | | Ván có người thắng khạp. |
| `hadSanh` | boolean default false | | Ván có người thắng sảnh. |
| `hadNhot` | boolean default false | | Ván có nhốt bài. |
| `createdAt` | timestamp defaultNow | | |

---

## round_results
Kết quả từng player trong 1 ván.

| Cột | Kiểu | Mặc định | Ý nghĩa |
|-----|------|----------|---------|
| `id` | uuid PK | | |
| `roundId` | uuid FK → rounds (cascade), notNull | | |
| `playerId` | uuid FK → players (cascade), notNull | | |
| `rank` | integer, notNull | | Thứ hạng (1..4). |
| `score` | integer, notNull | | Điểm đã tính cho ván này (đã bao gồm mọi thưởng/phạt). |
| `khapno` | integer default 0 | | Số lần khạp của player. |
| `sanhno` | integer default 0 | | Số lần sảnh của player. |
| `blackPigNo` | integer default 0 | | Số heo đen. |
| `redPigNo` | integer default 0 | | Số heo đỏ. |
| `createdAt` | timestamp defaultNow | | |

---

## session_totals
Bảng điểm tổng (denormalized, đọc nhanh).

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid PK | |
| `sessionId` | uuid FK → sessions (cascade), notNull | |
| `playerId` | uuid FK → players (cascade), notNull | |
| `totalScore` | integer default 0, notNull | Tổng tích luỹ (có cộng `initialScore` khi hiển thị). |
| `updatedAt` | timestamp defaultNow | |

> Cập nhật mỗi khi `saveRound` / `deleteRound` (cộng/trừ `score`). Index/lookup theo `(sessionId, playerId)`.

---

## player_devices
Thiết bị tham gia session (nhận diện đa thiết bị + push).

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid PK | |
| `sessionId` | uuid FK → sessions (cascade), notNull | |
| `participantId` | uuid FK → participants (cascade), notNull | |
| `fingerprint` | varchar(255), notNull | Nhận diện thiết bị. |
| `pushToken` | varchar(512) | FCM/APNs (nullable nếu user từ chối). |
| `platform` | varchar(20), notNull | `ios` / `android` / `web`. |
| `status` | enum `player_device_status` default `active` | `active` / `left`. |
| `createdAt` / `updatedAt` | timestamp | |
| **Unique** | `uq_player_devices_fingerprint` on `(sessionId, fingerprint)` | 1 thiết bị 1 bản ghi / session. |

> **Lưu ý**: chỉ có unique `(sessionId, fingerprint)` — **không có partial unique index** `(fingerprint, status='active')` như comment trong code gợi ý. Ràng buộc "1 thiết bị chỉ `active` trong 1 session" được đảm bảo bằng **app logic** (`leave`/`reconnect` cập nhật `status`), không phải bởi DDL. `active-by-device` join `playerDevices.status='active'` ↔ `sessions.status='active'` (limit 1).

---

## participant_players
Ánh xạ participant ↔ player (1-1 trong session).

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid PK | |
| `sessionId` | uuid FK → sessions (cascade), notNull | |
| `participantId` | uuid FK → participants (cascade), notNull | |
| `playerId` | uuid FK → players (cascade), notNull | |
| `createdAt` | timestamp | |
| **Unique** | `uq_participant_players_participant` on `(sessionId, participantId)` | 1 participant chọn 1 player. |
| **Unique** | `uq_participant_players_player` on `(sessionId, playerId)` | 1 player bị 1 participant chọn. |
