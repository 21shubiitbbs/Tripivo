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

**Frontend**: the entry point is `index.ts`, which calls `registerRootComponent(App)` and loads `App.tsx`.
- **Navigation is plain state, not Expo Router (yet).** `App.tsx` holds an `auth` state (`restoring` / `signedOut` / `signedIn`). When signed out, the app renders `src/screens/LoginScreen.tsx`, a full-bleed photo (`assets/login-bg.jpg`) with gradient overlays and Google/Apple/Phone buttons. When signed in, it shows the trips home screen inline in `App.tsx`. `frontend/AGENTS.md` prescribes Expo Router with routes in `src/app/`, but `expo-router` is not installed. If you add real navigation, follow that guidance: install it with `npx expo install` and change `main` in `package.json`.
- **Trips are local state only.** They start from a hard-coded seed in `App.tsx`, and the "Plan a trip" modal prepends new trips to that state. Nothing is persisted or sent to the backend.
- **Auth: only Google is real.** `src/lib/googleSignIn.ts` (native, `@react-native-google-signin/google-signin`) and `googleSignIn.web.ts` (web, an `expo-auth-session` OIDC popup) both expose `useGoogleSignIn()`, which returns a Google ID token. `LoginScreen` exchanges that token through `signInWithGoogle()` in `api.ts`. The session is stored by `src/lib/session.ts` (`expo-secure-store`) or `session.web.ts` (`localStorage`), and on launch it is checked again with `/auth/me`. Apple and Phone still let the user straight in, with `session: null`.
- Native Google sign-in needs a development build (it does not work in Expo Go). Its config plugin is added in `app.config.ts`, and only when `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is set, because the plugin fails prebuild without an `iosUrlScheme`.
- On web, `ImageBackground` needs an explicit `width`/`height: '100%'`. Without it, react-native-web draws the image at its native pixel size and the screen shows only its top-left corner.
- **API access** goes through `src/lib/api.ts`. The base URL comes from `EXPO_PUBLIC_API_URL`, falling back to `http://localhost:4000/api`. Right now the only call is `getApiHealth()`, which drives the "API online/offline" badge on the home screen. Put new API calls in this module.
- **Styling** uses `StyleSheet.create` in each file, with no theme module. Screens share a hand-picked palette (background `#F3F2EC`, primary dark green `#263A2D`, accents `#DB9270` / `#E8B282`) and repeated brand elements such as the "T" mark and the "GO LIGHT. COME BACK FULL." footer. Match these when adding screens. Content is centered with a `maxWidth` of roughly 520–560 so it looks right on tablet and web too.

## Environment / device gotchas

- `EXPO_PUBLIC_*` variables are inlined at bundle time, so restart Expo after changing `frontend/.env.local`.
- Android emulator: set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api`. Physical phone: use the computer's LAN IP, not `localhost`.
- Expo APIs change every SDK release. Check the versioned docs at `https://docs.expo.dev/versions/v57.0.0/` instead of relying on memory.
- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them. Configure native behavior in `app.json` and config plugins instead. Libraries with native code need a development build (`npx expo run:android|ios`) because Expo Go won't include them.
