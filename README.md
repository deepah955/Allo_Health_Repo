# Allo Inventory — Warehouse Reservation System

A full-stack Next.js application that solves the inventory race condition at checkout: reserving stock atomically so two customers can never buy the same physical unit.

---

## Live Demo

> Deploy to Vercel (see instructions below) and paste your URL here.

---

## Local Setup

### Prerequisites
- Node.js 18+
- A hosted PostgreSQL instance (Supabase, Neon, or Railway)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd allo-inventory
npm install
```

### 2. Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Supabase pooled connection (session mode for schema migrations):
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-X-[region].pooler.supabase.com:5432/postgres?sslmode=no-verify"
```

> **Note on port:** Use port `5432` (session mode) for local development and migrations. Use port `6543` (transaction mode) for production serverless deployments on Vercel.

### 3. Push Schema & Seed

```bash
# Push Prisma schema to your database
npm run db:push

# Seed with sample warehouses, products and stock
npm run db:seed
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the Reservation System Works

### The Race Condition Problem

When a customer proceeds to checkout, payment can take several minutes (3DS flows, UPI, wallet redirects). During this window, thousands of shoppers may view the same product. Two naive approaches fail:

- **Decrement at payment** → Two customers can pay for the same unit
- **Decrement at add-to-cart** → 80% of abandoned carts cause false stock depletion

### Our Solution: Atomic Reservation

When a customer hits **Reserve**, we run a single atomic SQL `UPDATE` on the `Stock` row:

```sql
UPDATE "Stock"
SET    "reserved" = "reserved" + $quantity
WHERE  "productId"   = $productId
  AND  "warehouseId" = $warehouseId
  AND  ("total" - "reserved") >= $quantity
```

PostgreSQL serializes writes to the same row, so if 10 requests arrive simultaneously for the last unit:
- Exactly **1** will satisfy the `WHERE` condition and update the row (affected rows = 1 → `201 Created`)
- The other **9** will find `(total - reserved) < quantity` and update nothing (affected rows = 0 → `409 Conflict`)

This is verified by the automated concurrency test in `scripts/test-concurrency.ts`.

---

## Expiry Mechanism

### In Production (Vercel Cron)

`vercel.json` defines a cron job that runs every 5 minutes:

```json
{
  "crons": [{ "path": "/api/cron/cleanup", "schedule": "*/5 * * * *" }]
}
```

The `/api/cron/cleanup` endpoint calls `releaseExpiredReservations()` which:
1. Finds all `PENDING` reservations where `expiresAt < NOW()`
2. Decrements `Stock.reserved` for each atomically
3. Sets their status to `RELEASED`

### Lazy Cleanup on Read

Every `GET /api/products` and `POST /api/reservations` call first runs `releaseExpiredReservations()` before returning data. This ensures stock counts are always accurate even between cron ticks.

### Confirm endpoint safety net

Even if neither cleanup mechanism has fired, the `POST /api/reservations/:id/confirm` endpoint always checks `expiresAt < NOW()` and returns `410 Gone` if the reservation is expired — the stock is never permanently decremented for an expired hold.

---

## Idempotency (Bonus)

POST endpoints (`/api/reservations` and `/api/reservations/:id/confirm`) support idempotency via the `Idempotency-Key` request header.

**How it works:**
1. Client sends `Idempotency-Key: <unique-uuid>` with the request
2. The `withIdempotency()` wrapper checks the `IdempotencyRequest` table in Postgres
3. If the key exists → returns the cached `statusCode` and `body` immediately (no side effects)
4. If not → runs the handler, stores `{ key, statusCode, body }`, returns the response

This means retrying a failed payment confirmation is safe — the stock won't be double-decremented.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List all warehouses |
| POST | `/api/reservations` | Reserve units — returns `409` if insufficient stock |
| POST | `/api/reservations/:id/confirm` | Confirm reservation — returns `410` if expired |
| POST | `/api/reservations/:id/release` | Release reservation early |
| GET | `/api/cron/cleanup` | Release all expired reservations (used by Vercel Cron) |

---

## Concurrency Test

With the server running (`npm run dev` or `npm run start`):

```bash
npx tsx scripts/test-concurrency.ts
```

This fires 10 simultaneous requests for the last unit of a test SKU and asserts:
- Exactly `1` response with `201 Created`
- Exactly `9` responses with `409 Conflict`

---

## Deploying to Vercel

1. Push your code to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Set environment variable `DATABASE_URL` to your **transaction mode pooler URL** (port `6543`)
4. Deploy — Vercel Cron picks up `vercel.json` automatically

---

## Trade-offs & What I'd Do Differently

### What works well
- **Atomic SQL reservation** — fully race-condition-free without Redis or distributed locks
- **Lazy cleanup** — always-accurate stock counts on reads without dedicated infra
- **Idempotency in Postgres** — bonus feature implemented without Redis

### Trade-offs made
- **No Redis** — idempotency and concurrency are handled entirely in Postgres. Redis would give faster idempotency lookups but adds infra complexity
- **Pooler limitations** — Supabase's transaction-mode pooler (port 6543) doesn't support DDL, so migrations must use session mode (port 5432). In production, the `DATABASE_URL` should use port 6543
- **No authentication** — reservations aren't tied to user accounts in this demo. A real system would associate reservations with customer sessions/JWTs
- **No pricing** — the checkout page doesn't show prices; a real system would lock the price at reservation time
- **Cron granularity** — the free Vercel plan supports crons no more frequent than once per minute. For tighter expiry windows, a background worker (BullMQ, Inngest) would be better

### With more time
- Add user authentication (NextAuth.js) and tie reservations to user accounts
- Replace lazy cleanup with a proper job queue (Inngest or BullMQ) for instant expiry
- Add price locking at reservation creation time
- Write more comprehensive integration tests per endpoint
- Add admin dashboard for warehouse stock management
