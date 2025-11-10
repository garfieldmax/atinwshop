# Supabase Proximity GPS App

This repository contains a sample proximity coordination stack built with Supabase, Vercel serverless functions, and a React Native mobile client. The backend polls user locations, runs Haversine-based geo queries, and delivers Firebase Cloud Messaging (FCM) alerts when users enter a 100 meter radius for two consecutive updates.

## Project Structure

```
/
├── api/
│   ├── cleanup.js                 # Vercel cron handler to prune stale locations
│   └── location/
│       ├── nearby.js              # Returns users within 100 meters
│       └── update.js              # Accepts location updates & emits proximity alerts
├── lib/
│   ├── notifications.js           # Firebase Admin FCM client
│   └── supabase.js                # Supabase service-role client
├── mobile/
│   ├── App.js                     # React Native entry point
│   └── services/
│       ├── location.js            # Expo location helpers
│       └── notifications.js       # FCM topic subscription helpers
├── sql/
│   └── schema.sql                 # Database schema & stored procedures
├── package.json                   # Serverless function dependencies
└── vercel.json                    # Vercel cron configuration
```

## Prerequisites

- Supabase project with the [PostGIS extension](https://supabase.com/docs/guides/database/extensions/postgis) enabled
- Vercel account for deploying the serverless functions
- Firebase project with a service account JSON file for FCM
- React Native toolchain (Expo recommended) with `@react-native-firebase/messaging` installed

## Environment Variables

Create the following environment variables in Vercel:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FCM_SERVICE_ACCOUNT={"type":"service_account", ...}
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
   npm install @react-native-firebase/app @react-native-firebase/messaging
   ```
3. Update `API_BASE_URL` in [`mobile/App.js`](mobile/App.js) to point to your deployed Vercel domain.
4. Configure FCM for your platform following the [React Native Firebase setup guide](https://rnfirebase.io/messaging/usage).
5. Run the mobile project via `expo start` or your preferred bundler.

## Usage Notes

- The client polls `/api/location/update` every 30 seconds while the app is foregrounded and sharing is enabled.
- Location updates with accuracy worse than 50 meters are ignored to reduce noisy data.
- Proximity notifications require two consecutive updates within 100 meters before FCM alerts fire.
- Background polling stops automatically when the app transitions to the background to preserve battery.
- The cleanup cron removes locations not updated in the last 10 minutes.

## Security Considerations

- Service role access is scoped to trusted serverless functions. User identifiers are validated server-side to prevent injection attacks even without RLS.
- Limit query result sizes (10 nearest neighbors) to keep payloads small and performant.

## Local Testing

You can run functions locally with the [Vercel CLI](https://vercel.com/docs/cli):

```bash
vercel dev
```

Then point the mobile app to `http://localhost:3000` during development.
