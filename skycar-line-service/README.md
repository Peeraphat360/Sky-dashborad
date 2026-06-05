# SkyCarPark LINE Service

FastAPI service ที่ส่ง **LINE Flex Message** ให้ลูกค้า 2 แบบ:

| โค้ด | เหตุการณ์ | Flex |
|------|-----------|------|
| UC3  | จองได้รับการยืนยัน (`bookings.status = CONFIRMED`) | แจ้งยืนยันการจอง |
| UC5  | ชำระเงินสำเร็จ (`payments.status = PAID`)           | ใบเสร็จรับรถ |

ดีไซน์ Flex ใช้โทนสีเว็บ SkyCarPark (sky-blue) + โลโก้ร้าน

> ⚠️ เอกสารนี้เน้น **รัน + ทดสอบบนเครื่อง (local)** ส่วนการ deploy + ต่อ Supabase
> Webhook จริง จะทำภายหลัง (endpoint `/webhooks/*` มีในโค้ดแล้ว พร้อมใช้ต่อ)

---

## โครงสร้าง

```
skycar-line-service/
  app/
    main.py            # FastAPI app + endpoints
    config.py          # อ่าน env
    supabase ↔ repository.py   # ดึง booking/payment/line_id + log กันส่งซ้ำ
    line_client.py     # push Flex ผ่าน LINE Messaging API
    services.py        # fetch → build flex → push → log
    flex/
      receipt.py       # UC5 ใบเสร็จ
      confirmation.py  # UC3 ยืนยันจอง
      theme.py         # พาเลตสี + row helper
    schemas.py, utils.py
  tests/test_flex.py   # unit test (ไม่ต้องต่อเน็ต)
  requirements.txt, .env.example, pytest.ini
```

---

## 1) ติดตั้ง

```bash
cd skycar-line-service
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
```

## 2) ตั้งค่า env

```bash
copy .env.example .env      # Windows  (macOS/Linux: cp .env.example .env)
```

แล้วกรอกค่าใน `.env`:

| ตัวแปร | หาได้จาก |
|--------|----------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → **Messaging API** channel → Channel access token |
| `LOGO_URL` | อัปโหลด `logo.png` ขึ้น Supabase Storage (public bucket) แล้วเอา public URL มาใส่ |
| `WEBHOOK_SECRET` | ตั้งเอง (สุ่มยาวๆ) |
| `SHOP_PHONE` | เบอร์ร้าน (default 082-325-8380) |

> LINE Flex โหลดรูปจากไฟล์ในเครื่องไม่ได้ — `LOGO_URL` ต้องเป็น **https สาธารณะ**

## 3) รัน

```bash
uvicorn app.main:app --reload --port 8000
```

เปิด http://localhost:8000/docs เพื่อดู/ลองยิง endpoint (Swagger UI)

## 4) ทดสอบ (unit test — ไม่ต้องต่อเน็ต/DB)

```bash
pytest
```

ทดสอบ logic การสร้าง Flex, การคำนวณจำนวนวัน, ฟอร์แมตวันที่ไทย, คอมมาเงิน

## 5) ทดสอบยิง endpoint จริงด้วย curl

ต้องตั้ง `.env` ครบ + มี booking/payment จริงใน Supabase และลูกค้ามี `line_id`

```bash
# ส่งใบเสร็จ (UC5) — ต้องมี payment PAID ของ booking นั้น
curl -X POST http://localhost:8000/receipts/<BOOKING_ID>/send

# ส่งแจ้งยืนยันจอง (UC3)
curl -X POST http://localhost:8000/notifications/<BOOKING_ID>/confirmed
```

ผลลัพธ์: `{"sent": true, "booking_id": "..."}`
ถ้าเคยส่งแล้ว: `{"sent": false, ..., "reason": "already_sent"}` (กันส่งซ้ำผ่านตาราง `notifications`)

---

## Endpoints

| Method/Path | ใช้ทำอะไร |
|-------------|-----------|
| `GET /health` | health check |
| `POST /receipts/{booking_id}/send` | ส่งใบเสร็จ (UC5) — manual/ทดสอบ |
| `POST /notifications/{booking_id}/confirmed` | ส่งยืนยันจอง (UC3) — manual/ทดสอบ |
| `POST /webhooks/payment-paid` | รับ Supabase webhook ตาราง `payments` *(ใช้ตอนต่อ webhook ภายหลัง)* |
| `POST /webhooks/booking-confirmed` | รับ Supabase webhook ตาราง `bookings` *(ภายหลัง)* |

`/webhooks/*` ต้องมี header `X-Webhook-Secret` ตรงกับ `WEBHOOK_SECRET`

---

## ตัวอย่าง Flex JSON (เอาไปวางใน LINE Flex Message Simulator ได้)

ใบเสร็จ (ตัดมาบางส่วน — โครงสร้างเต็มสร้างจาก `build_receipt_flex`):

```json
{
  "type": "bubble",
  "header": {
    "type": "box", "layout": "vertical", "backgroundColor": "#0369a1", "paddingAll": "20px",
    "contents": [
      { "type": "image", "url": "<LOGO_URL>", "size": "sm", "align": "center" },
      { "type": "text", "text": "ใบเสร็จรับรถ", "color": "#ffffff", "weight": "bold", "size": "xl", "align": "center", "margin": "md" },
      { "type": "text", "text": "Sky Car Park — ขอบคุณที่ใช้บริการ", "color": "#cce4f5", "size": "xs", "align": "center" }
    ]
  },
  "body": {
    "type": "box", "layout": "vertical", "paddingAll": "20px",
    "contents": [
      { "type": "box", "layout": "horizontal", "margin": "md", "contents": [
        { "type": "text", "text": "รวมทั้งหมด", "weight": "bold", "flex": 4 },
        { "type": "text", "text": "2,400 บาท", "size": "xl", "color": "#0369a1", "weight": "bold", "align": "end", "flex": 6 }
      ]}
    ]
  },
  "footer": {
    "type": "box", "layout": "vertical", "paddingAll": "16px",
    "contents": [
      { "type": "box", "layout": "vertical", "backgroundColor": "#e7f6ef", "cornerRadius": "md", "paddingAll": "10px",
        "contents": [ { "type": "text", "text": "ชำระเงินแล้ว · 4 มิ.ย. 2567 14:32", "color": "#059669", "weight": "bold", "align": "center" } ] }
    ]
  }
}
```

---

## ต่อ Supabase Webhook (ทำภายหลัง — ยังไม่ทำตอนนี้)

เมื่อพร้อม deploy ให้ตั้ง Database Webhooks 2 ตัวใน Supabase ชี้มาที่
`/webhooks/payment-paid` (ตาราง payments) และ `/webhooks/booking-confirmed`
(ตาราง bookings) พร้อม header `X-Webhook-Secret` ระบบจะส่ง Flex อัตโนมัติทุกครั้ง
ที่มีการชำระเงิน/ยืนยันจอง โดยไม่ต้องแก้โค้ดเว็บเดิม
