# TipHouse Production Guide

This repository now contains a production-oriented TipHouse stack:

- `apps/frontend`: Next.js 15 public site, donation page, dashboard, settings, OBS overlay.
- `apps/backend`: NestJS API, JWT auth, Prisma/PostgreSQL, payment webhook endpoints, Socket.io overlay gateway.
- `packages/types`: shared TypeScript contracts.
- `docker-compose.yml`: PostgreSQL, Redis, backend, frontend, nginx.

## 1. Prepare environment

Copy `.env.example` to `.env` and replace every secret:

```bash
cp .env.example .env
```

Required production values:

- `DOMAIN`
- `FRONTEND_URL`
- `API_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- payment gateway keys and webhook secrets

Use long random secrets. Do not commit `.env`.

## 2. Install and migrate locally

```bash
npm install
npm run prisma:generate -w apps/backend
npm run prisma:dev -w apps/backend
npm run db:seed
```

## 3. Run development

```bash
npm run dev -w apps/backend
npm run dev -w apps/frontend
```

Frontend: `http://127.0.0.1:3000`

Backend: `http://127.0.0.1:4000/api`

## 4. Run with Docker

```bash
docker compose --env-file .env up --build -d
docker compose exec backend npm run prisma:migrate -w apps/backend
```

## 5. Payment production rule

Never mark a donation as paid from the frontend. Production flow must be:

```text
Create donation pending
Payment gateway creates charge / QR
Gateway sends signed webhook
Backend verifies signature
Backend marks donation paid
Backend emits Socket.io event to overlay room
OBS browser source shows alert
```

The current webhook signature code is intentionally strict but generic. Replace the placeholder in:

`apps/backend/src/modules/payments/payments.service.ts`

with the official signature verification for Omise, GBPrimePay, or your selected gateway.

## 6. OBS setup

Use the overlay URL:

```text
https://yourdomain.com/overlay/{streamerKey}
```

Recommended OBS Browser Source:

- Width: 1920
- Height: 1080
- FPS: 60
- Shutdown source when not visible: OFF
- Refresh browser when scene becomes active: OFF

## 7. Security checklist before launch

- Enable HTTPS through Cloudflare or Let's Encrypt.
- Replace all secrets in `.env`.
- Verify payment webhook signatures with official gateway docs.
- Add admin 2FA enforcement before exposing admin panel.
- Add CAPTCHA to public donation submit.
- Add bad-word/link moderation.
- Add backup schedule for PostgreSQL.
- Add monitoring: uptime checks, error logs, webhook failure alerts.
- Add KYC and payout review before sending money to bank accounts.

## 8. Deployment recommendation

For MVP production, use a VPS with:

- 2 vCPU / 4 GB RAM minimum
- Ubuntu LTS
- Docker + Docker Compose
- Cloudflare DNS/WAF
- Daily PostgreSQL backups

For higher traffic, split services into managed PostgreSQL, managed Redis, object storage, CDN, and horizontally scaled backend workers.
