# TipHouse Free Public URL Deployment

เป้าหมาย: เปิดเว็บให้คนอื่นเข้าได้ผ่าน URL ฟรี โดยไม่ต้องเปิด Docker หรือ server จากเครื่องตัวเอง

## URL ฟรีที่ใช้ได้

ไม่ต้องซื้อ domain จริง ให้ใช้ subdomain ฟรีจากผู้ให้บริการ:

- Frontend: `https://tiphouse-frontend.onrender.com`
- Backend: `https://tiphouse-backend.onrender.com`
- หรือถ้าใช้ Vercel สำหรับ frontend: `https://tiphouse.vercel.app`

หมายเหตุ: ชื่อ subdomain จะได้ตามชื่อ service/project และขึ้นกับว่ายังว่างหรือไม่

## ชุดบริการฟรีที่แนะนำ

สำหรับทดลอง public แบบไม่เสียเงิน:

- Render Free Web Service: frontend + backend
- Render Free Postgres หรือ Neon Free Postgres: database
- Render Key Value Free หรือ Upstash Free: Redis

ข้อจำกัดสำคัญของ free tier:

- Render Free Web Service อาจ sleep หลังไม่มี traffic ประมาณ 15 นาที ทำให้เปิดครั้งแรกช้า
- Free tier ไม่เหมาะกับ production รับเงินจริงหรือ traffic เยอะ
- ถ้าผู้ให้บริการเปลี่ยน policy ต้องเช็กอีกครั้งก่อน launch จริง

## ขั้นตอน deploy ฟรีด้วย Render

1. Push โปรเจกต์ขึ้น GitHub
2. สมัคร/เข้า Render
3. กด New > Blueprint
4. เลือก repo ของ TipHouse
5. Render จะอ่าน `render.yaml`
6. เลือก plan เป็น Free ถ้าหน้าจอถาม
7. สร้าง PostgreSQL และ Redis แบบ free
8. ใส่ environment variables ให้ครบ

## Backend environment variables

ใส่ที่ service `tiphouse-backend`:

```text
NODE_ENV=production
FRONTEND_URL=https://tiphouse-frontend.onrender.com
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=สุ่มยาวอย่างน้อย 64 ตัวอักษร
JWT_REFRESH_SECRET=สุ่มยาวอย่างน้อย 64 ตัวอักษร
STREAMLABS_REDIRECT_URI=https://tiphouse-backend.onrender.com/api/auth/streamlabs/callback
```

Payment keys ใส่ทีหลังได้ถ้ายังทดลอง:

```text
OMISE_PUBLIC_KEY=
OMISE_SECRET_KEY=
OMISE_WEBHOOK_SECRET=
GBPRIMEPAY_MERCHANT_ID=
GBPRIMEPAY_SECRET=
STREAMLABS_CLIENT_ID=
STREAMLABS_CLIENT_SECRET=
```

## Frontend environment variables

ใส่ที่ service `tiphouse-frontend`:

```text
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://tiphouse-backend.onrender.com/api
NEXT_PUBLIC_SOCKET_URL=https://tiphouse-backend.onrender.com
NEXT_PUBLIC_FRONTEND_URL=https://tiphouse-frontend.onrender.com
```

## ตรวจหลัง deploy

เปิด URL เหล่านี้:

```text
https://tiphouse-backend.onrender.com/api/health
https://tiphouse-frontend.onrender.com
https://tiphouse-frontend.onrender.com/register
```

ถ้า `api/health` ได้ `{ "ok": true }` แปลว่า backend public ใช้งานได้

## สรุป

ใช้แบบไม่เสียเงินได้ด้วย subdomain ฟรี เช่น `.onrender.com` หรือ `.vercel.app`

แต่ domain จริงแบบ `tiphouse.com` โดยปกติต้องเสียเงินจด domain
