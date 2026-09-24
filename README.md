# Deep Sea Adventure — Phiêu lưu biển sâu 🤿

Bản chơi online **thời gian thực** của board game
[Deep Sea Adventure](https://oinkgames.com/en/games/analog/deep-sea-adventure/) (Oink Games) — 2 đến 6 thợ lặn,
đủ luật gốc theo `Deep-Sea-Adventure-Rules.pdf`.

- **Realtime** qua WebSocket (Socket.IO) — vào bàn bằng mã 4 ký tự.
- **Đăng nhập bằng mã email**: nhập email → nhận mã 6 số → nhập mã.
  Chỉ các email trong `HOST_EMAILS` được **tạo bàn**; người khác chỉ vào bàn bằng mã.
- **Chat trong bàn**: ở phòng chờ và trong ván; tin nhắn hiện thành bong bóng trên đầu thợ lặn.
- **Máy chủ là trọng tài**: client chỉ gửi ý định, mọi luật do server quyết. Giá trị kho báu
  được giấu trên server tới khi lật — không ai (kể cả người mang) xem trộm được.
- **Bot** để chơi thử một mình hoặc cho đủ người.
- **Vào lại được**: F5 hay rớt mạng vẫn quay lại đúng ghế.
- **Hình vẽ lại hoàn toàn bằng SVG** (tàu ngầm, thợ lặn, kho báu, xúc xắc) theo phong cách
  sách tranh: nền giấy cát, biển tối dần theo độ sâu, màu mờ — không neon, không phát sáng.
- **Hoạt ảnh**: xúc xắc lăn, thợ lặn nhảy từng ô (lộn đầu khi lặn, quay lên khi về), kho báu bay
  từ đáy biển vào túi người nhặt, bong bóng khí bay lên khi thở, vạch khí trượt trên tàu, báo động
  khi hết khí, lật kho báu khi về tàu, bục vinh danh + pháo giấy cuối ván.
- Chạy tốt từ điện thoại tới desktop.

---

## Cấu trúc

```
deepsea/
├── shared/            # Luật chơi thuần tuý (dùng chung server + client)
│   ├── types.ts
│   ├── engine.ts      # đường lặn, thở, bơi, nhặt/thả, hết lượt lặn, thắng thua
│   └── timing.ts      # thời lượng hoạt ảnh (server chờ theo đó trước khi bot đi)
├── server/            # Express + Socket.IO — trọng tài
│   ├── src/room.ts    # một bàn: người chơi, ván, nhật ký, chat
│   ├── src/bot.ts     # AI: cân khoảng cách về tàu với lượng khí còn lại
│   ├── src/auth.ts    # đăng nhập bằng mã email, ký phiên
│   ├── src/index.ts   # socket + HTTP
│   └── test/sim.ts    # kiểm tra luật + 600 ván bot tự đánh
├── api/send-code.js   # hàm Vercel: gửi mail mã đăng nhập qua Gmail SMTP
├── client/            # React + Vite + Tailwind + Framer Motion
│   └── src/components/
│       ├── Seascape.tsx     # tàu, dây lặn, kho báu, thợ lặn — một hệ toạ độ
│       ├── art/             # SVG: Diver, Chip, Die, Submarine
│       ├── GameScreen.tsx   # biến dòng sự kiện của server thành hoạt ảnh + âm thanh
│       ├── ActionBar.tsx    # lượt của bạn: hướng bơi, nhặt/thả
│       └── Overlays.tsx     # hết lượt lặn, kết thúc ván
└── images/            # ảnh gốc bạn cung cấp (tham khảo; bản chơi dùng SVG vẽ lại)
```

`shared/engine.ts` **không** có I/O. Server dùng nó để phân xử, client dùng đúng file đó để
xem trước các ô có thể tới khi rê chuột lên nút tung xúc xắc.

---

## Chạy ở máy

```bash
npm install
```

```bash
npm run install:all
```

```bash
npm run dev          # server :4100 + client :5180
```

Client tự trỏ về `http://localhost:4100` khi chạy dev. Cổng khác dự án SCOUT nên chạy song song được.

Chưa cấu hình gửi mail thì mã đăng nhập được in ra console của server và hiện luôn dưới ô nhập mã.
Cấu hình thật nằm trong `server/.env` (xem `server/.env.example`; `.env` đã bị `.gitignore` bỏ qua).

Chạy test luật:

```bash
npm test
```

---

## Deploy

Client là trang tĩnh, server cần WebSocket chạy liên tục — nên tách đôi:
**Vercel cho client, Render cho server.** Giống hệt dự án SCOUT.

### 1. Server → Render.com

1. Push repo lên GitHub.
2. Trên Render: **New → Blueprint**, chọn repo. Render đọc `render.yaml` và tạo service `deepsea-server`.
3. Đợi build xong, copy URL (ví dụ `https://deepsea-server.onrender.com`).
4. Kiểm tra: mở `https://<url>/health` phải thấy `{"ok":true,...}`.
   `hostRestricted: false` nghĩa là bạn **chưa** đặt `HOST_EMAILS` — ai đăng nhập cũng tạo được bàn.

Tạo thủ công thay vì Blueprint:

| Mục | Giá trị |
| --- | --- |
| Runtime | Node |
| Build Command | `npm install --prefix server --include=dev && npm run build --prefix server` |
| Start Command | `npm run start --prefix server` |
| Health Check Path | `/health` |

> Gói Free của Render ngủ sau ~15 phút không dùng; lần vào đầu mất 30–60 giây để tỉnh.
> Ván đang chơi dở sẽ mất vì trạng thái nằm trong RAM (phiên đăng nhập thì không mất).

### 2. Client → Vercel

1. **Add New → Project**, chọn repo, để nguyên thiết lập (Vercel đọc `vercel.json`).
2. Biến môi trường: `VITE_SERVER_URL` = `https://deepsea-server.onrender.com`
3. Deploy.

### 3. Gửi email mã đăng nhập

Render Free **chặn cổng SMTP**, nên Render nhờ hàm Vercel `api/send-code.js` gửi mail qua Gmail.

```bash
openssl rand -hex 32
```

**Vercel**: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER` (Gmail), `SMTP_PASS`
(app password 16 ký tự), `MAIL_FROM="Deep Sea <gmail-cua-ban@gmail.com>"`, `MAIL_RELAY_SECRET` (chuỗi vừa tạo).

**Render**: `MAIL_RELAY_URL=https://<app>.vercel.app/api/send-code`, `MAIL_RELAY_SECRET` (cùng chuỗi),
`HOST_EMAILS` (email được tạo bàn, cách nhau bằng dấu phẩy).

Đổi biến môi trường trên Vercel xong phải **Redeploy**. Cách khác: `BREVO_API_KEY` hoặc `RESEND_API_KEY`
trên Render. Thứ tự ưu tiên: Vercel relay → Brevo → Resend → SMTP.

### 4. Nối hai bên

Trên Render đặt `CLIENT_ORIGIN=https://<app>.vercel.app` để siết CORS (nhiều domain thì cách nhau bằng dấu phẩy).

### Biến môi trường

| Nơi | Biến | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| server | `PORT` | `4100` | Render tự đặt |
| server | `CLIENT_ORIGIN` | `*` | Origin được phép |
| server | `SESSION_SECRET` | tự sinh | Khoá ký phiên đăng nhập (30 ngày) — đừng đổi |
| server | `HOST_EMAILS` | (trống = ai cũng tạo được) | Email được tạo bàn |
| server | `MAIL_RELAY_URL` / `MAIL_RELAY_SECRET` | — | Nhờ Vercel gửi mail (khuyên dùng) |
| server | `BREVO_API_KEY` / `RESEND_API_KEY` | — | Gửi mail qua HTTPS |
| server | `SMTP_*` | — | Gửi mail SMTP (chỉ chạy ở máy) |
| server | `MAIL_FROM` | `Deep Sea <no-reply@deepsea.local>` | Người gửi |
| Vercel | `SMTP_*`, `MAIL_FROM`, `MAIL_RELAY_SECRET` | — | Cho `api/send-code` |
| client | `VITE_SERVER_URL` | `localhost:4100` khi dev | URL server realtime |

---

## Luật đã cài đặt

- **32 kho báu**: cấp 1 tam giác (0–3), cấp 2 vuông (4–7), cấp 3 ngũ giác (8–11), cấp 4 lục giác
  (12–15), mỗi giá trị 2 chiếc; xáo trong từng cấp rồi xếp từ nông đến sâu.
- **Bình khí chung 25**, 3 lượt lặn.
- **Mỗi lượt**: thở (khí − số kho báu đang mang) → quay đầu (một lần mỗi lượt lặn) → tung 2 xúc xắc 1–3,
  trừ số kho báu đang mang, bơi; nhảy qua ô có người; không vượt quá ô cuối → nhặt / thả / bỏ qua.
- **Khí về 0**: người làm cạn vẫn đi nốt lượt, rồi lượt lặn kết thúc.
- **Hết lượt lặn**: người về tàu lật kho báu và giữ điểm; người chưa về đánh rơi hết — người gần tàu
  xếp trước, gom thành chồng 3 chiếc ở cuối đường (một chồng tính như một kho báu); bỏ ô trống.
  Người về tàu cuối cùng đi trước lượt sau (không ai về thì người ở sâu nhất).
- **Thắng**: tổng điểm cao nhất; bằng điểm thì ai nhiều kho báu cấp cao hơn; vẫn bằng thì hoà.

### Chống treo bàn

- Bảng kết quả lượt lặn tự chuyển sau 20 giây.
- Ai ngồi quá 60 giây trong lượt của mình thì máy đi hộ một nước (có thanh thời gian dưới thẻ người chơi).
- Ai mất kết nối quá 15 giây thì bot đi hộ; vào lại là lấy ghế về ngay.
- Bàn không ai dùng trong 1 giờ sẽ tự xoá.

---

## Bản quyền

Deep Sea Adventure do **Jun Sasaki & Goro Sasaki** thiết kế, **Oink Games** phát hành. Đây là bản dựng lại
phi thương mại để chơi cùng bạn bè; mọi hình trong `client/src/components/art` được vẽ lại bằng SVG.
Nếu thích, hãy mua bản giấy — nhỏ gọn và rất vui.
