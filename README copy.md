# WA Survey — Local Development

## Prerequisites

- Node.js v20+
- npm v10+

## Setup

```bash
# 1. Install root dependencies
npm install

# 2. Install frontend dependencies
npm install --prefix frontend
```

## Run

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend** → http://localhost:3001
- **Frontend (Vite)** → http://localhost:5173

Open http://localhost:5173 in your browser.

## First-Time Login

1. Open http://localhost:5173 — you'll be redirected to the login page.
2. Click **"Sign in with WhatsApp"**.
3. Scan the QR code with WhatsApp → **Linked Devices → Link a Device**.
4. You'll be logged in and redirected to the Dashboard.

Your session token is stored in `localStorage` and lasts 30 days — no re-scan needed on refresh.

## Environment Variables

Copy `.env.example` to `.env` and edit as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend port |
| `JWT_SECRET` | (dev default) | Secret for signing JWTs — **change in production** |

## Project Structure

```
├── backend/
│   ├── server.js          # Express + Socket.io
│   ├── db.js              # SQLite (better-sqlite3)
│   ├── auth.js            # JWT utilities + middleware
│   └── services/
│       ├── whatsapp.js    # Baileys multi-session manager
│       └── scheduler.js   # CronJob per session
├── frontend/              # React + Vite + Tailwind
│   └── src/
│       ├── pages/         # Dashboard, Connect, Configure, History, Login
│       └── hooks/         # useAuth, useSession, useSocket
├── data/                  # SQLite database (auto-created)
├── auth_sessions/         # WhatsApp auth files (auto-created)
└── package.json
```

## Data & Auth Persistence

- **Database:** `data/app.db` — poll config, history, sessions
- **WhatsApp auth:** `auth_sessions/<sessionId>/` — avoids re-scanning QR on restart

## Stopping

`Ctrl+C` in the terminal running `npm run dev`.
