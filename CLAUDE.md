# Thirteen Game Score Tracker

## Overview

Thirteen Game Score Tracker là ứng dụng web hỗ trợ ghi điểm và quản lý lịch sử các ván bài Tiến Lên theo thời gian thực.

Ứng dụng cho phép một người tạo phiên chơi (session), cấu hình luật tính điểm, mời người khác tham gia thông qua đường link chia sẻ và cùng theo dõi bảng điểm realtime.

Mục tiêu của phiên bản đầu tiên (MVP):

- Tạo và quản lý session
- Quản lý người tham gia
- Ghi nhận kết quả từng ván
- Tự động tính tổng điểm
- Đồng bộ realtime giữa các thiết bị
- Lưu lịch sử để xem lại sau

---

# Technology Stack

## Frontend

- React Router v7
- TypeScript
- Shadcn UI
- Tailwind CSS v4
- Socket.IO Client

## Backend

- React Router v7 Server
- Socket.IO Server

## Database

- PostgreSQL
- Drizzle ORM

## Database Strategy

Codebase First

Schema được định nghĩa bằng TypeScript trong Drizzle.

Không sử dụng SQL migration files.

Sử dụng:

```bash
drizzle-kit push
```

để đồng bộ schema từ code xuống database.

---

# Core Concepts

## Session

Session đại diện cho một bàn chơi.

Mọi dữ liệu đều gắn với session:

- Cấu hình luật chơi
- Người tham gia
- Danh sách người chơi
- Kết quả các ván
- Bảng điểm tổng

Ví dụ:

```txt
Session ABC123

Players:
- Nam
- Hùng
- An
- Phúc
```

---

## Participant

Participant là người đang truy cập vào session.

Participant không nhất thiết là người chơi.

Ví dụ:

```txt
Participant:
- Nam (đang điều khiển điện thoại)

Players:
- Nam
- Hùng
- An
- Phúc
```

---

## Player

Player là người được tính điểm trong trận đấu.

---

# Functional Requirements

# Feature 1: Session Management

## Create Session

Người dùng truy cập ứng dụng.

Hiển thị form:

- Tên chủ phòng
- Danh sách người chơi
- Điểm hạng nhất
- Điểm hạng nhì
- Điểm hạng ba
- Điểm hạng bét

Sau khi submit:

1. Tạo session
2. Tạo cấu hình game
3. Tạo danh sách player
4. Tạo participant đầu tiên với role owner

Kết quả:

```txt
/session/{sessionId}
```

Ví dụ:

```txt
/session/abc123
```

---

## Session Owner

Người tạo session là owner.

Owner có quyền:

- Duyệt yêu cầu tham gia
- Từ chối yêu cầu tham gia
- Cập nhật điểm
- Quản lý session

---

## Reopen Session

Khi truy cập lại:

```txt
/session/{sessionId}
```

Hệ thống phải load:

- Session
- Players
- Config
- Score board
- Round history

từ database.

---

# Feature 2: Join Request

## Join Session

Người dùng mở link session.

Nếu chưa được tham gia:

Hiển thị:

```txt
Tên hiển thị
[Tham gia]
```

Sau khi submit:

Tạo Join Request.

---

## Join Request Approval

Owner nhận realtime notification:

```txt
Hùng muốn tham gia
```

Owner có thể:

- Approve
- Reject

---

## Approve Flow

Khi approve:

1. Update join request status = approved
2. Tạo participant
3. Emit realtime event

Client nhận:

```txt
Bạn đã được chấp nhận
```

---

## Reject Flow

Khi reject:

1. Update join request status = rejected
2. Emit realtime event

Client nhận:

```txt
Yêu cầu tham gia đã bị từ chối
```

---

# Feature 3: Score Management

## Create Round

Người dùng được phép tham gia session có thể tạo kết quả ván mới.

Form nhập:

```txt
Round 5

Nam  -> Rank 1
Hùng -> Rank 2
An   -> Rank 3
Phúc -> Rank 4
```

---

## Calculate Score

Dựa trên cấu hình session.

Ví dụ:

```txt
First  = +20
Second = +10
Third  = 0
Fourth = -30
```

Kết quả:

```txt
Nam   +20
Hùng  +10
An     0
Phúc  -30
```

---

## Save Round

Khi người dùng nhấn:

```txt
Hoàn tất
```

Hệ thống:

1. Tạo round
2. Tạo round_results
3. Update session_totals
4. Emit realtime update

---

## Total Score

Session phải duy trì bảng điểm tổng.

Ví dụ:

```txt
Nam    120
Hùng    80
An      50
Phúc   -20
```

Nguồn dữ liệu:

```txt
session_totals
```

---

# Feature 4: Round History

Người dùng có thể xem toàn bộ lịch sử.

Ví dụ:

```txt
Round 1
Round 2
Round 3
Round 4
```

---

## Round Detail

Khi mở một round:

Hiển thị:

```txt
Nam   Rank 1   +20
Hùng  Rank 2   +10
An    Rank 3    0
Phúc  Rank 4   -30
```

---

# Realtime Requirements

Socket.IO được sử dụng cho realtime.

## Socket Room

Mỗi session là một room.

Ví dụ:

```txt
session:abc123
```

---

## Event: join-request

Client gửi:

```json
{
  "sessionId": "abc123",
  "displayName": "Hùng"
}
```

Owner nhận được realtime event.

---

## Event: join-approved

Owner approve request.

Server broadcast cho user tương ứng.

---

## Event: join-rejected

Owner reject request.

Server broadcast cho user tương ứng.

---

## Event: round-finished

Khi round được lưu thành công.

Server broadcast tới toàn bộ room.

Payload:

```json
{
  "sessionId": "abc123"
}
```

---

## Event: score-updated

Broadcast bảng điểm mới nhất.

Payload:

```json
{
  "totals": []
}
```

---

# Persistence Requirements

Toàn bộ dữ liệu phải được lưu trong PostgreSQL.

Các dữ liệu cần lưu:

- Sessions
- Participants
- Join Requests
- Game Configs
- Players
- Rounds
- Round Results
- Session Totals

---

# Database Schema

## sessions

```txt
id
code
ownerParticipantId
status
createdAt
updatedAt
```

---

## participants

```txt
id
sessionId
displayName
role
joinedAt
```

---

## join_requests

```txt
id
sessionId
displayName
status
approvedBy
approvedAt
createdAt
```

Status:

```txt
pending
approved
rejected
```

---

## game_configs

```txt
id
sessionId
firstPlaceScore
secondPlaceScore
thirdPlaceScore
fourthPlaceScore
```

---

## players

```txt
id
sessionId
name
orderNo
```

---

## rounds

```txt
id
sessionId
roundNo
createdBy
createdAt
```

---

## round_results

```txt
id
roundId
playerId
rank
score
```

---

## session_totals

```txt
id
sessionId
playerId
totalScore
updatedAt
```

---

# UI Pages

## Create Session

Route:

```txt
/session/create
```

Functions:

- Create session
- Configure rules
- Create players

---

## Lobby

Route:

```txt
/session/:sessionId
```

Functions:

- Share link
- Show participants
- Show join requests
- Approve requests

---

## Score Board

Route:

```txt
/session/:sessionId/score-board
```

Functions:

- Show total scores
- Realtime updates

---

## Add Round

Route:

```txt
/session/:sessionId/rounds/new
```

Functions:

- Input round result
- Calculate score
- Save round

---

## Round History

Route:

```txt
/session/:sessionId/history
```

Functions:

- View all rounds

---

## Round Detail

Route:

```txt
/session/:sessionId/history/:roundId
```

Functions:

- View round result details

---

# Non Functional Requirements

## Performance

- Realtime updates < 1 second
- Score board should not aggregate from history every request
- Use session_totals for fast reads

---

## Security

No authentication in MVP.

Access control:

- Owner can approve/reject requests
- Only approved participants can access score management

---

## Scalability

Architecture should support future features:

- Login
- User accounts
- Multiple game types
- Special Tiến Lên rules
- Undo round
- Delete round
- Tournament mode