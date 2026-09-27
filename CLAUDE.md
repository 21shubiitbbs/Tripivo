# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Tripivo is a trip-planning mobile app. The repo holds two independent npm packages with no shared workspace tooling. Each one has its own `package.json`, lockfile and `node_modules`, so run every command from inside `frontend/` or `backend/`:

- `frontend/`: Expo (SDK 57) + React Native 0.86 + React 19, TypeScript strict. It also runs on web through `react-native-web`.
- `backend/`: Express 5 API in TypeScript (ESM, `"type": "module"`, `NodeNext` resolution).

Node 22.13+ is required (see `.nvmrc`).

`frontend/CLAUDE.md` imports `frontend/AGENTS.md`, which holds the Expo-specific rules. Read it before touching frontend code. The most important points are summarized below.

## Commands

Backend (`cd backend`):

```sh
npm run dev        # tsx watch src/server.ts, port 4000 (override with PORT)
npm run build      # tsc -> dist/
npm start          # node dist/server.js (build first)
npm run typecheck
```

Frontend (`cd frontend`):

```sh
cp .env.example .env.local   # first time only
npm start                    # expo start --lan
npm run android | ios | web
npm run lint                 # expo lint (eslint-config-expo flat config)
npm run typecheck
npx expo install <pkg>       # ALWAYS use this rather than npm install, so versions match the SDK
npx expo-doctor              # diagnose dependency/config problems
```

There is no test framework in either package yet. Before you call a task done, run `lint` + `typecheck` for the frontend and `typecheck` for the backend.

## Architecture

**Backend** (`backend/src/`) is layered and organized by feature:

- `server.ts` is the process entry point. It applies migrations (and exits if PostgreSQL is unreachable), starts listening, and shuts down gracefully on SIGTERM/SIGINT. `app.ts` builds the Express app (`createApp()`) without starting it: `cors()`, `express.json()`, the routers under `/api`, then `notFoundHandler` and `errorHandler`.
- `config/env.ts` is the only place that reads `process.env`. It exports a validated, typed `env` object. Add new settings there, not inline.
- `modules/<feature>/` holds one folder per feature, split into `*.routes.ts` (HTTP only: parse input, call a service, send JSON) → `*.service.ts` (business rules, throws `HttpError`) → `*.repository.ts` (all SQL). Follow this split for new features such as trips, groups and chat.
- **Errors**: throw `HttpError` (`HttpError.badRequest(...)`, `.unauthorized(...)`, etc. in `shared/http/errors.ts`) from anywhere. Express 5 forwards rejected async handlers to `errorHandler`, so don't wrap handlers in try/catch just to send error responses. Every error response has the shape `{ error: string }`, and unexpected errors are logged and returned as a generic 500.
- **Auth** (`modules/auth/`):
  - `POST /api/auth/google` takes `{ idToken }`, verifies it against `GOOGLE_CLIENT_IDS` with `google-auth-library`, upserts the user, and returns `{ token, user }`. The token is a stateless 30-day HS256 JWT signed with `SESSION_SECRET` (via `jose`); its `sub` is the user's uuid.
  - `GET /api/auth/me` returns `{ user }`.
  - `GET /api/auth/google/start?returnTo=<app url>` → Google → `GET /api/auth/google/callback` is a server-side authorization-code flow (`google-oauth.service.ts`) for Expo Go, which can't load the native Google SDK. The callback redirects to `returnTo?token=…` or `returnTo?error=…`. The return URL travels in a signed, 10-minute JWT `state`, and must match one of `OAUTH_RETURN_URL_PREFIXES` (`exp://` should only be allowed in development). The flow needs `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` and `PUBLIC_API_URL`, a public HTTPS origin such as an ngrok domain; `<PUBLIC_API_URL>/api/auth/google/callback` must be registered as a redirect URI on the Web client.
  - Phone sign-in (`modules/auth/phone/`): `POST /api/auth/phone/send-code { phone }` returns `{ phone, resendAfterSeconds }`, then `POST /api/auth/phone/verify { phone, code }` returns `{ token, user }`, upserting the user by `phone`. Numbers are normalized to E.164.
    - Codes go through an `OtpProvider` picked by `OTP_PROVIDER`. `console` (development only; `env.ts` refuses it when `NODE_ENV=production`) keeps HMAC-hashed codes in `phone_otp_codes` (5 minutes, 5 attempts, single use) and prints them to the API log. `twilio` uses the Twilio Verify REST API, which stores and checks the codes itself.
    - Sending is rate-limited by the service using `phone_otp_sends`: a 30 s cooldown, 5 codes per number per hour, and 20 per IP per hour. Set `TRUST_PROXY=1` behind ngrok or a load balancer so `request.ip` is the real client.
    - `PublicUser` includes `phone`.
  - Protect a route with `requireAuth` from `auth.middleware.ts`. The user's ID is then available as `response.locals.userId`, typed through `src/types/express.d.ts`.
- `GET /api/health` returns `{ status: 'ok', service: 'tripivo-api', database: 'ok' | 'unreachable' }`. `GET /api/trips` is a stub that returns `{ trips: [] }`.
- **Database** (`db/`): PostgreSQL through `pg`, with no ORM.
  - `pool.ts` exports the shared `pool`, `Queryable` (pool or transaction client) and `checkDatabase()`.
  - Repository functions take an optional `db: Queryable = pool` as their last argument, so they can be combined inside `withTransaction(async (client) => ...)` from `transaction.ts`.
  - `migrator.ts` applies the SQL files in `backend/migrations/` once each, in filename order, each inside a transaction, under an advisory lock, and records them in `schema_migrations`. `npm run db:migrate` (`src/scripts/migrate.ts`) runs them without starting the API.
  - To change the schema, add a new `NNN_name.sql` file; never edit one that has already been applied. `002_core_schema.sql` holds the domain model:
    - users → travel_profiles → trip_preferences (1:1 each)
    - trips → join_requests, itinerary_days, expenses, trip_photos, trip_reviews
    - trips → groups → group_members, chat_rooms → chat_messages, and group_expenses → group_expense_splits
    - A user can sign in with any of `google_id`, `email` (unique, case-insensitive) or `phone`; at least one is required.
    - Statuses and roles are `text` + `CHECK` constraints, not enums.
    - `updated_at` columns are maintained by the `set_updated_at()` trigger.
- **Row types** (`db/schema/`, import from `db/schema/index.js`):
  - One file per domain (`users`, `trips`, `groups`, `chat`), each with a `…Row` type per table. `common.ts` has the shared scalar and timestamp types, and `index.ts` exports a `Tables` map of table name → row type.
  - `enums.ts` holds an `as const` array for every CHECK-constrained column (e.g. `TRIP_STATUSES`), plus `isOneOf(values, input)` for validating input.
  - Update these files in the same change as any migration.
  - `pg` returns `numeric` as a string (`Money`), and `date` columns come back as `'YYYY-MM-DD'` strings (`DateString`, set in `pool.ts`).
  - Never send `UserRow` to clients, because it contains `password_hash`. Use `PublicUser` from `modules/users/users.repository.ts`.

`npm run dev` / `npm start` load `backend/.env` with Node's `--env-file-if-exists`. See `backend/.env.example`. If `SESSION_SECRET` is missing, a random one is used and sessions end whenever the API restarts.

Because the package uses NodeNext ESM, relative imports between backend files must include the `.js` extension.

**Frontend** uses Expo Router (`main` is `expo-router/entry`). Routes live in `src/app/`; everything else goes in `src/components/`, `src/lib/`, `src/data/`.
- **Route groups and guards.** `src/app/_layout.tsx` wraps the app in `ThemeProvider` → `AuthProvider` → `AppDataProvider`, then renders a `Stack` with three `Stack.Protected` groups:
  - `(auth)`: welcome/splash, onboarding, location permission, login, sign-up, OTP `verify`. Shown when signed out.
  - `(setup)`: profile photo → about → interests. Shown when signed in but `profile.completed` is false.
  - `(app)`: `(tabs)` (Home, Trips, a "+" button that opens `/create`, Messages, Profile), plus search, filters (modal), results, `trip/[id]` (+ itinerary, travelers, reviews, join), the create-trip wizard, `chat/[id]`, notifications, edit-profile, settings, safety and map.
  - The navigator isn't mounted until the stored session has been checked; mounting it earlier drops the URL the app was opened with. `auth/google` is an unguarded route that catches the Google browser-flow redirect.
- **Auth** (`src/lib/auth.tsx`, `useAuth()`): restores the session (checked again with `/auth/me`) and keeps the traveler `Profile` under `tripivo.profile` in `src/lib/storage.ts` (`expo-secure-store`) or `storage.web.ts` (`localStorage`). A profile is tied to a user id; if there's no match on sign-in, the user goes through setup again.
  - Only Google and phone OTP are real. The design's email/password fields became a phone number field, because the API has no password login. Sign-up keeps the name and email as a `draft` until the code is verified.
  - `src/components/auth.tsx` holds the Google/Apple buttons. `googleSignIn.ts` / `.web.ts` / `googleBrowserSignIn.ts` work as before; Apple still signs in with `session: null`.
- **Everything except auth is sample data.** Trips, travelers, chats, notifications and reviews live in `src/data/mock.ts` (Unsplash and randomuser.me image URLs), and `src/lib/appData.tsx` (`useAppData()`) keeps them in memory: saved trips, joining, publishing, chat messages, poll votes and search filters. Nothing is sent to the backend, and it all resets on restart. Profile edits are stored on the device only. Replace these pieces with calls in `src/lib/api.ts` as endpoints appear.
- **Theme** (`src/theme.tsx`): light and dark palettes (primary blue `#1D6AE5`). The preference (system/light/dark, set in Settings) is saved under `tripivo.theme`. Build styles with `const useStyles = makeStyles((c) => ({...}))` rather than `StyleSheet.create` with hard-coded colors, so dark mode keeps working. Content is capped at `MAX_CONTENT_WIDTH` (560).
- **UI kit** (`src/components/ui.tsx`): `Screen` (safe area, scroll, pinned `header`/`footer`), `Header`, `Txt`, `Button`, `Field`, `SearchBar`, `Chip`/`ChipRow`, `SegmentTabs`, `UnderlineTabs`, `RadioOption`, `InterestGrid`, `StepProgress`, `Avatar`, `ListRow` and others. Trip cards are in `trips.tsx`, and itinerary/travelers/reviews sections in `tripSections.tsx`. `Calendar.tsx` is a dependency-free date picker. The map view is an SVG illustration (`MapIllustration.tsx`), not a real map.
- Device APIs: `expo-location` (permission prompt only) and `expo-image-picker` (profile photo). Both have permission strings in `app.json`. The deep-link scheme is `tripivo`.
- **API access** goes through `src/lib/api.ts`. The base URL comes from `EXPO_PUBLIC_API_URL`, falling back to `http://localhost:4000/api`. Settings shows the `getApiHealth()` status.
- Native Google sign-in only runs in a development or store build. The native module is `require`d lazily so that Expo Go doesn't crash at startup. Its config plugin is added in `app.config.ts`, and only when `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is set, because the plugin fails prebuild without an `iosUrlScheme`.
- On web, `ImageBackground` needs an explicit `width`/`height: '100%'`. Without it, react-native-web draws the image at its native pixel size and the screen shows only its top-left corner.

## Environment / device gotchas

- `EXPO_PUBLIC_*` variables are inlined at bundle time, so restart Expo after changing `frontend/.env.local`.
- Android emulator: set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api`. Physical phone: use the computer's LAN IP, not `localhost`.
- Expo APIs change every SDK release. Check the versioned docs at `https://docs.expo.dev/versions/v57.0.0/` instead of relying on memory.
- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them. Configure native behavior in `app.json` and config plugins instead. Libraries with native code need a development build (`npx expo run:android|ios`) because Expo Go won't include them.
