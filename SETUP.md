# Location Chat – Final Setup Guide

Your Next.js location-based proximity chat app is scaffolded and builds successfully. Follow these steps to connect it to a real Supabase project and go live.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in or create an account.
2. Click **"New project"** and choose a region close to you.
3. Set a strong database password.
4. Wait for the project to initialize (~2 minutes).

## 2. Run the Database Schema

1. In your Supabase project, open the **SQL Editor** from the left sidebar.
2. Click **"New query"** and paste the entire contents of `supabase/schema.sql`.
3. Click **"Run"** to apply all tables, triggers, and RLS policies.

**What this sets up:**
- `profiles` – User display names and avatars
- `user_locations` – Live location updates with room assignment
- `room_messages` – Chat messages grouped by proximity room
- Automatic profile creation on signup via trigger
- Realtime subscriptions for location and chat updates
- Row-level security so users only see nearby users and messages in their room

## 3. Get Your Supabase Keys

1. Click **Settings** (bottom left) → **API**.
2. Copy **Project URL** and **Anon Key** (public key).
3. In your project root, open or create `.env.local` and add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace with your actual values.

## 4. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 5. Test the Auth Flow

1. Click **"Sign up"** and create an account.
2. If you enabled email confirmations, confirm your email (or disable it in Supabase Auth settings for testing).
3. You'll be redirected to `/dashboard`.

## 6. Test Location & Chat

1. **Enable live location** by clicking the button and allowing browser geolocation.
2. Or **tap the map** to manually drop a pin at any location.
3. The dashboard shows:
   - Your current location and room key
   - All users within 5km in real-time
   - A live chat room that updates as you move between proximity zones
4. Open another browser tab (incognito) and sign up a second account to test proximity grouping and chat.

## Deployment

When ready to go live:

1. **Supabase** – Your database is already secure with RLS. No additional config needed.
2. **Vercel** – Push your code to GitHub, then deploy:
   - Connect your repo on [vercel.com](https://vercel.com)
   - Add the same `.env.local` values as environment variables
   - Deploy
3. **Custom server** – Run `npm run build && npm run start`

## How It Works

- **Auth**: Supabase handles signup, login, and session tokens via cookies.
- **Location**: When you set a location, the app calculates a deterministic room key based on a 5km grid.
- **Proximity**: The dashboard fetches all users' locations and filters to those within 5km using the haversine distance formula.
- **Chat**: Messages are stored per room. Supabase realtime subscriptions notify all users in the room instantly as messages arrive.
- **Auto-grouping**: If you move out of the 5km radius, you automatically leave the current room and join the next one.

## Troubleshooting

**"Missing NEXT_PUBLIC_SUPABASE_URL"** → Make sure `.env.local` is saved and you restarted the dev server.

**Geolocation not working** → Your browser requires HTTPS in production. On localhost, it works over HTTP.

**No nearby users showing** → Make sure another user account has set a location. Users don't appear until they have an entry in `user_locations`.

**Chat not updating** → Check browser console for errors. Ensure RLS policies are applied by running the schema.sql again.

## Next Steps

- Customize the dashboard UI in `src/components/dashboard.tsx`
- Add user profiles and avatars in `src/components/auth-panel.tsx`
- Adjust the 5km radius in `src/lib/geo.ts` (search for `5` in `roomKeyForPoint` and `withinRadius`)
- Add moderation or reporting features by extending the schema and adding API routes

---

**Built with:** Next.js 15 + TypeScript + Tailwind CSS + Supabase + Leaflet + OpenStreetMap
