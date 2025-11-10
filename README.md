# Supabase Proximity GPS App

This repository contains a sample proximity coordination stack built with Supabase, Vercel serverless functions, and a React Native mobile client. The backend polls user locations, runs Haversine-based geo queries, and tracks when users enter a 100 meter radius for two consecutive updates. Clients can use Supabase Realtime subscriptions to get notified of proximity changes.

## Project Structure

```
/
├── api/
│   ├── cleanup.js                 # Vercel cron handler to prune stale locations
│   └── location/
│       ├── nearby.js              # Returns users within 100 meters
│       └── update.js              # Accepts location updates & emits proximity alerts
├── lib/
│   └── supabase.js                # Supabase service-role client
├── mobile/
│   ├── App.js                     # React Native entry point
│   └── services/
│       └── location.js            # Expo location helpers
├── sql/
│   └── schema.sql                 # Database schema & stored procedures
├── package.json                   # Serverless function dependencies
└── vercel.json                    # Vercel cron configuration
```

## Prerequisites

- Supabase project with the [PostGIS extension](https://supabase.com/docs/guides/database/extensions/postgis) enabled
- Vercel account for deploying the serverless functions
- React Native toolchain (Expo recommended)

## Environment Variables

Create the following environment variables in Vercel:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Database Setup

1. Open the Supabase SQL editor.
2. Paste the contents of [`sql/schema.sql`](sql/schema.sql) and run the script.
3. Confirm that the `locations` table exists with RLS disabled and the helper functions created successfully.

## Deploying Serverless Functions

1. Install dependencies locally:
   ```bash
   npm install
   ```
2. Deploy to Vercel (adjust scope as needed):
   ```bash
   vercel
   ```
3. Ensure the cron job defined in `vercel.json` is active so `/api/cleanup` runs hourly.

## Mobile App Setup

1. Copy the `mobile/` directory into your Expo or React Native project.
2. Install mobile dependencies:
   ```bash
   expo install expo-location @react-native-async-storage/async-storage
   npm install @supabase/supabase-js
   ```
3. Update `API_BASE_URL` in [`mobile/App.js`](mobile/App.js) to point to your deployed Vercel domain.
4. (Optional) Set up Supabase Realtime subscriptions to listen for proximity updates on the `locations` table.
5. Run the mobile project via `expo start` or your preferred bundler.

## Usage Notes

- The client polls `/api/location/update` every 30 seconds while the app is foregrounded and sharing is enabled.
- Location updates with accuracy worse than 50 meters are ignored to reduce noisy data.
- Proximity detection requires two consecutive updates within 100 meters before the system tracks it.
- Background polling stops automatically when the app transitions to the background to preserve battery.
- The cleanup cron removes locations not updated in the last 10 minutes.
- For real-time notifications, use Supabase Realtime to subscribe to changes in the `locations` table.

## Security Considerations

- Service role access is scoped to trusted serverless functions. User identifiers are validated server-side to prevent injection attacks even without RLS.
- Limit query result sizes (10 nearest neighbors) to keep payloads small and performant.

## Local Testing

You can run functions locally with the [Vercel CLI](https://vercel.com/docs/cli):

```bash
vercel dev
```

Then point the mobile app to `http://localhost:3000` during development.
