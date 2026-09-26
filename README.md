# Tripivo

Tripivo is a React Native app built with Expo and a separate Express API.

## Requirements

- Node.js 22.13 or newer and npm
- Expo Go on a phone, or Android Studio / Xcode for a simulator

## Start the backend

```sh
cd backend
npm install
npm run dev
```

The API listens on port `4000`. Check `http://localhost:4000/api/health` to confirm it is running.

## Start the mobile app

In a second terminal:

```sh
cd frontend
npm install
cp .env.example .env.local
npm start
```

Scan the Expo QR code with Expo Go, or press `a` to open an Android emulator. For the Android emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api` in `frontend/.env.local`. For a physical phone, use your computer's LAN IP address instead of `localhost`. Restart Expo after changing environment variables.

Run `npm run typecheck` in either `frontend/` or `backend/` to check that package.