# TipHouse Public Deployment Without Local Docker

เป้าหมายของไฟล์นี้คือทำให้ TipHouse ใช้งานบนเว็บสาธารณะได้โดยไม่ต้องเปิด Docker, PostgreSQL, Redis, backend หรือ frontend จากเครื่องส่วนตัว

## สรุปสถาปัตยกรรม

ใช้บริการ Cloud แทนเครื่อง local:

- Frontend: Render Web Service หรือ Vercel
- Backend: Render Web Service เพราะรองรับ Node.js และ WebSocket/Socket.io
- Database: Managed PostgreSQL เช่น Neon, Supabase, Render PostgreSQL หรือ Railway PostgreSQL
- Redis: Managed Redis เช่น Upstash, Render Key Value หรือ Redis Cloud
- Storage รูป/เสียง: S3-compatible storage เช่น Cloudflare R2, AWS S3 หรือ DigitalOcean Spaces
- Domain/DNS: Cloudflare หรือ registrar ที่ซื้อโดเมนไว้

## วิธีที่แนะนำสำหรับโปรเจกต์นี้

เริ่มง่ายที่สุดคือใช้ Render สำหรับ frontend/backend และใช้ managed PostgreSQL + managed Redis แยกต่างหาก

โปรเจกต์มีไฟล์ `render.yaml` แล้ว สามารถใช้เป็น Blueprint บน Render ได้

## 1. เตรียม Database

สร้าง PostgreSQL จากผู้ให้บริการ managed database แล้วคัดลอก connection string มาใส่เป็น:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

ต้องเป็น URL ที่ backend บน Cloud ต่อถึงได้ ไม่ใช่ `127.0.0.1` และไม่ใช่ `postgres`

## 2. เตรียม Redis

สร้าง Redis จากผู้ให้บริการ managed Redis แล้วคัดลอก connection string มาใส่เป็น:

```text
REDIS_URL=redis://USER:PASSWORD@HOST:PORT
```

ถ้าผู้ให้บริการให้ URL แบบ TLS อาจเป็น:

```text
REDIS_URL=rediss://USER:PASSWORD@HOST:PORT
```

## 3. Deploy ด้วย Render Blueprint

1. Push โปรเจกต์นี้ขึ้น GitHub
2. เข้า Render Dashboard
3. เลือก New > Blueprint
4. เลือก repo ของ TipHouse
5. Render จะอ่าน `render.yaml` และสร้าง service:
   - `tiphouse-backend`
   - `tiphouse-frontend`
6. ใส่ Environment Variables ให้ครบ

## 4. Environment Variables สำหรับ backend

ตั้งค่าที่ service `tiphouse-backend`:

```text
NODE_ENV=production
FRONTEND_URL=https://tiphouse-frontend.onrender.com
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=ใส่สุ่มยาวอย่างน้อย 64 ตัวอักษร
JWT_REFRESH_SECRET=ใส่สุ่มยาวอย่างน้อย 64 ตัวอักษร
OMISE_PUBLIC_KEY=
OMISE_SECRET_KEY=
OMISE_WEBHOOK_SECRET=
GBPRIMEPAY_MERCHANT_ID=
GBPRIMEPAY_SECRET=
STREAMLABS_CLIENT_ID=
STREAMLABS_CLIENT_SECRET=
STREAMLABS_REDIRECT_URI=https://tiphouse-backend.onrender.com/api/auth/streamlabs/callback
```

## 5. Environment Variables สำหรับ frontend

ตั้งค่าที่ service `tiphouse-frontend`:

```text
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://tiphouse-backend.onrender.com/api
NEXT_PUBLIC_SOCKET_URL=https://tiphouse-backend.onrender.com
NEXT_PUBLIC_FRONTEND_URL=https://tiphouse-frontend.onrender.com
```

หลังรู้ URL จริงของแต่ละ service ให้กลับมาแก้ค่าเหล่านี้ แล้ว redeploy

## 6. หลัง Deploy

ตรวจ URL เหล่านี้:

```text
https://tiphouse-frontend.onrender.com
https://tiphouse-backend.onrender.com/api/page/Test
https://tiphouse-frontend.onrender.com/overlay/abc123
```

ถ้าเปลี่ยน custom domain เช่น `https://tiphouse.com`:

- backend `FRONTEND_URL` ต้องเป็น domain frontend จริง
- frontend `NEXT_PUBLIC_API_URL` ต้องชี้ไป backend จริง
- frontend `NEXT_PUBLIC_SOCKET_URL` ต้องชี้ไป backend จริง
- Streamlabs callback ต้องใช้ backend domain จริง

## 7. สิ่งที่ยังต้องทำก่อนรับเงินจริง

- เชื่อม payment gateway จริง เช่น Omise หรือ GBPrimePay
- ตรวจ webhook signature ตามเอกสารของ payment provider
- ย้ายรูป banner และไฟล์เสียงจาก data URL/local preview ไปเก็บ S3-compatible storage
- เพิ่ม CAPTCHA หน้าโดเนท
- เพิ่ม admin 2FA
- ตั้ง backup database
- ตั้ง domain และ HTTPS

## หมายเหตุสำคัญ

เว็บสาธารณะต้องมี server หรือ cloud service เสมอ เพียงแต่เราไม่ต้องเปิดเครื่องตัวเองและไม่ต้องเปิด Docker ในเครื่อง เพราะ Render/ผู้ให้บริการ Cloud จะรัน service ให้ตลอดเวลา
