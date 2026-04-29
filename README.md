# Location Chat

A Next.js + Supabase project where users sign up, share their location, see nearby users within 5km, and join a dynamic chat room that updates as they move.

## Stack
- Next.js 15 App Router (TypeScript)
- Tailwind CSS
- Supabase Auth + PostgreSQL + Realtime
- Leaflet + OpenStreetMap (free tiles, no API key)
- Client-side geolocation & haversine distance calculations

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Supabase
See **[SETUP.md](./SETUP.md)** for complete instructions:
- Create a free Supabase project
- Run the SQL schema from `supabase/schema.sql`
- Add your credentials to `.env.local`

### 3. Start the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign up.

## Features

✓ **Email/password authentication** with automatic profile creation  
✓ **Live geolocation** or manual map pin drop  
✓ **Real-time proximity detection** – see users within 5km  
✓ **Automatic room grouping** via deterministic location bucketing  
✓ **Instant group chat** that updates as users move  
✓ **Auto-room switching** when leaving the 5km zone  

## How It Works

1. **Sign up** → Supabase creates your profile automatically.
2. **Enable location** → Browser geolocation or tap the map to set a pin.
3. **Join a room** → App calculates a room key based on your location.
4. **See nearby users** → Real-time filter to users within 5km (haversine formula).
5. **Chat in your room** → Messages stream via Supabase Realtime.
6. **Move and switch rooms** → Automatic when you exceed the 5km boundary.

## Tech Highlights

- **Client-side Supabase**: Browser session management via cookies.
- **Row-Level Security**: All queries filtered by user ID.
- **Realtime subscriptions**: Chat and location updates via PostgreSQL listen/notify.
- **Deterministic room keys**: Same location always maps to the same room, so users naturally cluster.
- **No third-party map APIs**: 100% free OpenStreetMap tiles.

## Deployment

- **Vercel**: Push to GitHub, connect repo, add env vars, deploy.
- **Self-hosted**: Run `npm run build && npm run start` on any Node.js server.
- **Supabase**: No additional setup—your database is live and secure with RLS.

## Notes

- For development, geolocation works over HTTP localhost. Production requires HTTPS.
- Adjust the 5km radius in `src/lib/geo.ts` if needed.
- See [SETUP.md](./SETUP.md) for troubleshooting and next steps.
# Location-App
