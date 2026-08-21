# Tính năng & Danh mục trang (UI Routes)

Routes được định nghĩa trong `app/routes.ts` (React Router v7, `route()`/`index()`). Ứng dụng dùng **server loaders/actions** kết hợp **client loaders** (dựa trên device fingerprint, không dùng cookie). Realtime qua Socket.IO client (`~/lib/socket.client`).

> Không có authentication. Danh tính thiết bị = `localStorage` `device_fingerprint` (`createFingerprint` trong `~/helpers/fingerprint.helper`). Layout redirect thiết bị chưa tham gia sang `/join`.

---

## 1. Home — `/`
**File:** `app/routes/home.tsx`

- Màn hình chào. Tự động resume session đang active của thiết bị (fingerprint → `GET /api/sessions/active-by-device`) rồi `navigate("/session/{code}")`.
- "Tạo phòng mới" → `/session/create`.
- Nhập mã phòng (regex `^[A-Z0-9]{4}-[A-Z0-9]{4}$`) → `/join/{code}`.
- `QRScannerModal` (quét QR `@yudiel/react-qr-scanner`, parse `/join/XXXX-XXXX`).
- Grid tính năng + `<InstallPWA />`.

---

## 2. Create Session — `/session/create`
**File:** `app/routes/session.create.tsx` (`"use client"`)

- Form: tên chủ phòng, 4 player, cấu hình điểm hạng + luật Tiến Lên nâng cao (heo/khạp/sảnh/nhốt).
- `action()` (POST): trong 1 `db.transaction` insert `sessions` + `participants` (role `owner`) + set `ownerParticipantId` + `gameConfigs` + 4 `players` + `playerDevices`. `generateSessionCode()` → `XXXX-XXXX` (loại ký tự dễ nhầm). `redirect("/session/{code}")`.
- Collapsible "Cài đặt nâng cao" (Heo đỏ/đen, Khạp, Sảnh, Nhốt phạt người ngoài). Mặc định: rank `3/2/-2/-3`, heo `3/2`, triple `20`, khap `1/10`, sanh `1/10`, nhotPenalty `2`.

---

## 3. Session Layout — `/session/:sessionId` (bao bọc các tab con)
**File:** `app/routes/session.$sessionId/layout.tsx`

- `loader()`: session + config + players từ code; redirect `/` nếu không tồn tại / `finished`.
- `clientLoader()` (`hydrate`): re-check `finished`; `resolveParticipant()` qua `GET /api/sessions/{code}/devices/active?fingerprint=`; redirect `/join/{code}` nếu chưa có participant; đọc `localStorage` (`showBackground`, `textToSpeed`, `player-positions`); `useSessionStore.hydrate(loaderData)`.
- `registerDevice()` (POST `/devices`), `markDeviceLeft()` (PATCH `/devices/leave`, `keepalive`).
- Socket events: `onJoinRequestCreated` (owner toast Duyệt/Từ chối), `onParticipantApproved`/`onParticipantRejected`, `onParticipantKicked` (toast + leave + navigate `/join`).
- Header (logo, mã phòng, `ModeToggle`, nút rời). `Background` + bottom **tab 5 cột**: Xếp hạng(`/`), Lịch Sử(`/history`), FAB Ván Đấu(`/match`), Thống Kê(`/chart`), Cấu Hình(`/settings`). `<Toaster />` + `ThemeProvider`.

---

## 4. Lobby / Xếp hạng — `/session/:sessionId` (index)
**File:** `app/routes/session.$sessionId/index.tsx`

- Bảng xếp hạng live (tab mặc định). `loader()`: session + `playerTotals` (join `players`↔`sessionTotals`) + `getRoundMeta`.
- `ScoreRow`/`ScorePill` (`scoreTone` xanh/đỏ/trung tính), highlight nhất, badge `initialScore`, hiển thị `score * 3`.
- 2 progress card Khạp (`Flame`) / Sảnh (`Spade`). Revalidate khi `visibilitychange`.

---

## 5. Settings — `/session/:sessionId/settings`
**File:** `app/routes/session.$sessionId/settings.tsx`

- `SessionQRCode` (QR + copy/share).
- **Cấu hình nhân vật**: owner sửa tên + `initialScore`; reorder bằng `Move` (lưu `player-positions` localStorage). Non-owner chọn player 1 lần (`select-player` fetcher).
- **Người tham gia**: owner `reset-player` / `kick-participant` (`AlertDialog`).
- **Yêu cầu tham gia**: owner duyệt/từ chối realtime.
- Toggle `showBackground` (`updateConfig`), `enableTTS`.
- **Kết thúc phiên** (owner): `finish-session` (verify owner qua `playerDevices`+fingerprint) → `sessions.status = finished`.
- `action` intents: `select-player`, `reset-player`, `update-players`, `finish-session`.

---

## 6. History — `/session/:sessionId/history`
**File:** `app/routes/session.$sessionId/history.tsx`

- `loader()`: players (tên ngắn), rounds (scores, `hadKhap/hadSanh/hadNhot`, `accumulatedKhap/Sanh`), `roundResults`, `playerTotals`.
- `RoundTable` (sticky): mỗi dòng 1 ván, `ScorePill` màu, footer "Tổng". Click → `RoundDetailDialog` (rank, score, chip Khạp/Sảnh/Đen/Đỏ, nhốt).

---

## 7. Match (Ghi ván) — `/session/:sessionId/match`
**File:** `app/routes/session.$sessionId/match.tsx`

- Màn hình tính điểm chính. `loader()`: session + `playerTotals` + `getRoundMeta`.
- `action()`: intents `save-round` (`saveRound`), `delete-round` (`deleteRound`).
- Logic trong `useMatchScoring({ sessionCode, loaderData })` → ranking, select order, computedScores, khap/sanh winners, nhot state, `handleSave`, `deleteRound`.
- `<CircularTable3>`: bàn tròn 4 chỗ, tap chọn rank, hub giữa là nút lưu, toggle Khạp/Sảnh mỗi ghế, sound tap/success.
- "Nhốt bài" → `NhotBaiDialog` + `NhotBaiResultCard`; "Chặt heo" → `ChatHeoDialog` + `ChatHeoListCard`.
- `AlertDialog` xoá ván.

---

## 8. Chart — `/session/:sessionId/chart`
**File:** `app/routes/session.$sessionId/chart.tsx` (`"use client"`)

- `loader()`: players/rounds/`roundResults`/`sessionTotals` + SQL aggregates (rank counts, bonus sums ký hiệu).
- KPI cards + Recharts: Tổng điểm (Bar), Điểm tích luỹ (Line), Tỷ lệ xếp hạng (stacked %), Điểm TB/ván (Bar), Hồ sơ (Radar), Xếp hạng qua ván (Bar), Sảnh/Khạp (Bar), bảng Heo.

---

## 9. Round Detail — `/session/:sessionId/history/:roundId`
**File:** `app/routes/session.$sessionId/round-detail.tsx` (`"use client"`)

- `loader()`: round + `roundResults` + player map → `{ round, results }`.
- Card list: playerName, "Hạng {rank}", score màu.

---

## 10. Join — `/join/:sessionId`
**File:** `app/routes/join/$sessionId.tsx`

- `loader()`: session; redirect `/` nếu thiếu/`finished`.
- `clientLoader()`: thử `POST /api/sessions/{code}/devices/reconnect` → vào thẳng nếu ok.
- `JoinStatus`: `idle | waiting | approved | rejected`. `sendJoinRequest(code, name)`; `onParticipantApproved` → `registerDevice` → navigate; `onJoinRequestRejected` → lỗi.

---

## 11–15. API Routes

| Route | File | Chức năng |
|-------|------|-----------|
| `POST /api/sessions/:sessionId/devices` | `devices.ts` | Upsert `playerDevices` (`onConflict` theo `[sessionId, fingerprint]`). 204/400/404. |
| `GET /api/sessions/:sessionId/devices/active` | `devices/active.ts` | Resolve participant active của fingerprint (`status='active'`). 200/{participant}/400/404. |
| `PATCH /api/sessions/:sessionId/devices/leave` | `devices/leave.ts` | Set `status='left'` (idempotent). |
| `POST /api/sessions/:sessionId/devices/reconnect` | `devices/reconnect.ts` | Re-activate thiết bị đã join. |
| `GET /api/sessions/active-by-device` | `api/sessions/active-by-device.ts` | Tìm session active của thiết bị (home auto-resume). |
| `POST /api/tts` | `api.tts.ts` | Proxy ElevenLabs TTS → `audio/mpeg` (khi `enableTTS`). |

---

## Components đáng chú ý

- `app/components/match/circular-table3.tsx` — bàn tròn 4 ghế (hub lưu, toggle khạp/sảnh, heat background). (Các bản `circular-table*.tsx`, `bage-heo.tsx` cũ hơn không dùng bởi `match.tsx`.)
- `app/components/match/chatheo-dialog.tsx` (`ChatHeoDialog`), `nhotbai-dialog.tsx` (`NhotBaiDialog`), `NhotBaiResultCard.tsx`, `ChatHeoListCard.tsx` — form/dialog nhốt & chặt heo.
- `app/components/session-qr-code.tsx` (`SessionQRCode`) — QR `${origin}/join/{code}` + copy/share.
- `app/components/settings/move.tsx` (`Move`) — swap `orderNo`.
- `app/components/install-pwa.tsx` (`InstallPWA`) — dùng `usePWA`.
- `app/components/background.tsx` (`Background`) — cross-fade ảnh nền mỗi 20s nếu `showBackground`.
- `app/components/ui/*` (shadcn): `button, input, label, card, badge, separator, collapsible, switch, dialog, alert-dialog, table, dropdown-menu, field, chart` (Recharts wrapper), `toaster`. Hỗ trợ: `mode-toggle`, `theme-provider`.
