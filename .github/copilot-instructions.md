# Location Chat Workspace Instructions

## Stack
- Next.js App Router with TypeScript and Tailwind CSS
- Supabase for authentication, PostgreSQL, and realtime updates
- Leaflet with OpenStreetMap tiles for maps
- Geospatial filtering based on a 5km radius

## Project Rules
- Keep location sharing explicit and tied to browser permission or manual map selection
- Auto-update nearby users and chat room membership when location changes
- Prefer small, focused components over large monoliths
- Keep UI bold, readable, and mobile-friendly
- Avoid adding external map APIs or paid services

## Implementation Notes
- Use client-safe Supabase access for auth and realtime UI behavior
- Store the current location and room membership in PostgreSQL tables
- Use exact distance checks for nearby users and a deterministic room key for chat grouping
- Document required environment variables and Supabase SQL schema in the README
