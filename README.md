# NexChat — Real-Time Chat App

A fast, efficient real-time chat application with stored room history and ephemeral private messages.
Room messages are written to Supabase for history; direct messages stay out of the database.

---

## Features

- 4 permanent global chat rooms
- Create public or private groups (private = invite code)
- Real-time private messaging between users
- File & image sharing via Cloudinary
- Download chat history as .txt or .zip (client-side only)
- User profiles with avatars
- Typing indicators
- Online user presence
- Room history in Supabase; private DMs stay ephemeral

---

## Tech Stack

| Layer       | Technology                  |
|-------------|-----------------------------|
| Frontend    | React + Vite + CSS Modules  |
| Backend     | Node.js + Express           |
| Real-time   | Socket.io                   |
| Database    | Supabase (PostgreSQL)       |
| Cache       | Upstash Redis               |
| File Upload | Cloudinary                  |
| Auth        | JWT                         |
| Deploy FE   | Vercel                      |
| Deploy BE   | Railway                     |

---

## Setup Guide

### Step 1 — Clone & install

```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/nexchat.git
cd nexchat

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

---

### Step 2 — Supabase Setup

1. Go to https://supabase.com and create a new project
2. Go to **SQL Editor** and run the entire contents of `server/db/schema.sql`
3. Go to **Settings → API** and copy:
   - `Project URL` → SUPABASE_URL
   - `service_role` key → SUPABASE_SERVICE_ROLE_KEY

---

### Step 3 — Upstash Redis Setup

1. Go to https://upstash.com → Create Database → Select Redis
2. Choose region closest to your Railway server
3. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

### Step 4 — Cloudinary Setup

1. Go to https://cloudinary.com → Sign up
2. From the Dashboard copy:
   - Cloud Name
   - API Key
   - API Secret

---

### Step 5 — Server Environment Variables

Create `server/.env` from `server/.env.example`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

JWT_SECRET=make_this_long_and_random_32chars_min

UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx

CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=xxxxxx
```

---

### Step 6 — Client Environment Variables

Create `client/.env`:

```env
VITE_SERVER_URL=http://localhost:5000
```

---

### Step 7 — Run Locally

```bash
# Terminal 1 — start backend
cd server && npm run dev

# Terminal 2 — start frontend
cd client && npm run dev
```

Open http://localhost:5173

---

## Deployment

### Deploy Backend to Railway

1. Push your code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo → choose the `server` folder as root
4. Add all environment variables from `server/.env` in Railway dashboard
5. Change `CLIENT_URL` to your Vercel URL (e.g. `https://nexchat.vercel.app`)
6. Deploy — Railway will give you a URL like `https://nexchat-server.railway.app`

### Deploy Frontend to Vercel

1. Go to https://vercel.com → New Project → Import from GitHub
2. Set **Root Directory** to `client`
3. Add environment variable:
   - `VITE_SERVER_URL` = your Railway backend URL
4. Deploy

---

## Environment Variables Reference

### Server

| Variable | Description |
|---|---|
| PORT | Server port (default 5000) |
| CLIENT_URL | Frontend URL for CORS |
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (server only) |
| JWT_SECRET | Random secret for JWT signing |
| UPSTASH_REDIS_REST_URL | Upstash Redis REST URL |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis token |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Cloudinary API key |
| CLOUDINARY_API_SECRET | Cloudinary API secret |

### Client

| Variable | Description |
|---|---|
| VITE_SERVER_URL | Backend URL |

---

## Project Structure

```
chat-app/
├── client/                   # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Home.jsx
│   │   │   └── Profile.jsx
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── ChatRoom.jsx
│   │   │   └── PrivateChat.jsx
│   │   ├── hooks/
│   │   │   ├── useChat.js
│   │   │   └── usePrivateChat.js
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── utils/
│   │       ├── api.js
│   │       └── download.js
│   └── vercel.json
│
└── server/                   # Node.js backend
    ├── routes/
    │   ├── auth.js
    │   ├── groups.js
    │   └── upload.js
    ├── middleware/
    │   └── authMiddleware.js
    ├── socket/
    │   └── socketHandler.js
    ├── db/
    │   ├── supabase.js
    │   └── schema.sql          ← Run this in Supabase SQL Editor
    ├── redis/
    │   └── redisClient.js
    ├── config/
    │   └── cloudinary.js
    ├── index.js
    └── railway.json
```

---

## Security Features

- JWT authentication on all API routes and socket connections
- Rate limiting (200 requests per 15 min per IP)
- Input sanitization (HTML tags stripped)
- Message content filtering
- File type and size restrictions (10MB max)
- CORS locked to your domain
- Room chat messages are written to Supabase for history; DMs are not stored
- Private groups accessible by invite code only

---

## How Messages Work

```
User sends room message
      ↓
Socket.io server receives it
      ↓
Server stores it in Supabase and broadcasts it to the room
      ↓
Each browser stores it in React state (RAM)
      ↓
User closes tab / logs out → room history remains in Supabase
```

Private DMs are still session-only and are not written to the database.
Download option lets users save their own session locally before leaving.

---

## License
MIT
