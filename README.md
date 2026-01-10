# KindSpread

Spread kindness daily with simple missions. A Progressive Web App that sends you daily kindness reminders.

## Features

- 🌟 Daily kindness missions
- 🔔 Push notifications (daily reminders)
- 🌙 Dark/Light mode
- 📱 PWA - Add to Home Screen support
- ☁️ Runs on Cloudflare Workers

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account (for deployment)

### Installation

```sh
pnpm install
```

### Database Setup (Cloudflare D1)

1. Create a D1 database:
```sh
wrangler d1 create kindspread-db
```

2. Update `wrangler.jsonc` with your database ID

3. Run the schema migration:
```sh
wrangler d1 execute kindspread-db --file=./schema.sql
```

### Push Notifications Setup

1. Generate VAPID keys:
```sh
npx tsx scripts/generate-vapid-keys.ts
```

2. Set the secrets in Cloudflare:
```sh
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
```

For local development, create a `.env` file (copy from `.env.example`).

## Developing

```sh
pnpm dev
```

## Building & Deployment

```sh
pnpm build
wrangler deploy
```

## Cron Trigger

The app includes a cron trigger that sends daily push notifications at 8:00 AM UTC.
This is configured in `wrangler.jsonc`.

---

Built with ☕ Swedish snus and passion for Svelte by [m7n.dev](https://m7n.dev)
