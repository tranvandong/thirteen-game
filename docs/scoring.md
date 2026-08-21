# Luật tính điểm Tiến Lên (Thirteen)

Toán tính điểm nằm ở `app/helpers/match.helper.ts` (`computedScoresHelper`, `reRanking`, `buildPigCounts`) và tích luỹ khạp/sảnh ở `app/lib/round.server.ts` (`nextKhapSanhAccumulated`). Kết quả mỗi ván được ghi vào `round_results.score` (đã bao gồm mọi thưởng/phạt), sau đó cộng dồn vào `session_totals`.

## Cấu hình (gameConfigs)

- `rankPoints` (client) = `[firstPlaceScore, secondPlaceScore, thirdPlaceScore, fourthPlaceScore]`.
- `khapPoints` = `khapScore`; `sanhPoints` = `sanhScore`.
- `maxKhapAccumulate` = `khapLimit`; `maxSanhAccumulate` = `sanhLimit`.
- `heoDoPoints` = `redPigScore`; `heodenPoints` = `blackPigScore`.
- `nhotBystanderPenalty` = phạt người ngoài khi nhốt 2 victim.

### Tích luỹ khạp / sảnh (`nextKhapSanhAccumulated`)
Mỗi ván mới, hệ số tích luỹ = hệ số ván trước + 1, nhưng **bị reset về 1** nếu ván trước có người thắng (`hadKhap`/`hadSanh`), và **bị giới hạn** bởi `khapLimit`/`sanhLimit`.

```
next = lastRound ?
  { khap: lastRound.hadKhap ? 1 : min(lastRound.accumulatedKhap + 1, khapLimit),
    sanh: lastRound.hadSanh ? 1 : min(lastRound.accumulatedSanh + 1, sanhLimit) }
  : { khap: 1, sanh: 1 }
```

---

## 1. Điểm hạng (không nhốt)

Nếu không có nhốt bài:
```
score[pid] += rankPoints[rankIndex]   // rankIndex = thứ hạng - 1
```
Ví dụ rankPoints `[3, 2, -2, -3]` → hạng 1 được +3, hạng 4 được -3.

## 2. Nhốt bài (chốt) — `activeNhot`

### 2.1. Nhốt 1 victim
```
ecPts = |rankPoints[last]| * 2
hp     = victim.heo.do * heoDoPoints + victim.heo.den * heodenPoints
score[nhotter] += rankPoints[0] * 2 + hp
score[victim]  -= rankPoints[0] * 2 + hp
// các người khác giữ rankPoints[i+1]
```
`reRanking`: victim xuống áp chót, nhotter lên hạng 1.

### 2.2. Nhốt 2 victims
```
ecPts = |rankPoints[last]| * 2
với mỗi victim: loss = ecPts + heoPts(heo); score[victim] -= loss; gain += loss
// Đền bài (nếu có):
if dennerId && denForIds.length:
   denBaiLoss = Σ denBaiLosses[victim]  (cho denForIds)
   score[dennerId] -= denBaiLoss
   score[victim]   += denBaiLosses[victim]   // hoàn cho victim bị đền
score[nhotter] += gain + nhotBystanderPenalty
với mỗi người ngoài (không nhotter, không victim, không denner):
   score[oid] -= nhotBystanderPenalty
```
`reRanking`: 2 victim xuống đáy (vị trí `last`, `last+1`), người hạng 2 đẩy lên áp chót.

### 2.3. Nhốt ≥ 3 victims
Tương tự 2 victims nhưng **không** cộng/trừ `nhotBystanderPenalty` cho người ngoài:
```
score[nhotter] += gain   // không + nhotBystanderPenalty
```

## 3. Khạp (tứ quý)
```
if khapWinner && khapCount > 0:
  gain = accumulated.khap * khapCount * khapPoints * 3
  loss = accumulated.khap * khapCount * khapPoints
  score[khapWinner] += gain
  mọi player khác    -= loss
```

## 4. Sảnh (dây)
```
if sanhWinner:
  gain = accumulated.sanh * sanhPoints * 3
  loss = accumulated.sanh * sanhPoints
  score[sanhWinner] += gain
  mọi player khác    -= loss
```

## 5. Chặt heo (đè heo đỏ/đen) — `chatHeoList`
```
với mỗi { chatterId, victimId, heo }:
  pts = (heo.do ?? 0) * heoDoPoints + (heo.den ?? 0) * heodenPoints
  score[chatterId] += pts
  score[victimId]  -= pts
```

---

## Ghi chú implement

- `computedScoresHelper` trả về `Record<playerId, number>` — điểm **thay đổi** của ván này (chưa cộng `initialScore`; `initialScore` chỉ cộng khi hiển thị tổng).
- `buildPigCounts(playerIds, chatHeoList, activeNhot)` → tổng heo đỏ/đen mỗi player (dùng hiển thị biểu đồ/chip).
- `reRanking(ranking, activeNhot)` trả `Map<playerId, rank>` để hiển thị thứ hạng sau nhốt.
- `saveRound` (server): trong transaction, tính `hadKhap = any khapno>0`, `hadSanh = any sanhno>0`, `hadNhot = any nhotterId!=""`, ghi `rounds` + `round_results`, cộng dồn `session_totals`.
- `deleteRound` (server): trừ ngược `score` khỏi `session_totals`, xoá `round_results` rồi `rounds`.

---

## TTS (đọc kết quả bằng giọng nói)
Khi `enableTTS` bật, `playTTS(text)` (`match.helper.ts`) gọi `POST /api/tts` → nhận blob audio → phát qua `<audio>`. Backend proxy ElevenLabs (`ELEVENLABS_API_KEY`).
