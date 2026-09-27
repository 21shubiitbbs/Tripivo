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
npm run db:migrate # apply migrations without starting the API
npm run db:seed    # sample travelers, trips, chats + the demo account; `-- +91XXXXXXXXXX` also enrolls your own number
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
- **Errors**: throw `HttpError` (`HttpError.badRequest(...)`, `.unauthorized(...)`, etc. in `shared/http/errors.ts`) from anywhere. Express 5 forwards rejected async handlers to `errorHandler`, so don't wrap handlers in try/catch just to send error responses. Every error response has the shape `{ error: string, code?: string, field?: string }`. `code` is a machine-readable reason (`email_not_verified`, `email_taken`, `invalid_credentials`, `weak_password`, `rate_limited`, `session_expired`, …) and `field` names the input a form should highlight. Pass them with `HttpError.badRequest(message, { code, field })`. Unexpected errors are logged and returned as a generic 500.
- **Auth** (`modules/auth/`):
  - `POST /api/auth/google` takes `{ idToken }`, verifies it against `GOOGLE_CLIENT_IDS` with `google-auth-library`, upserts the user, and returns `{ token, user }`. If a user already has that email, Google is linked to their account; when that email was unverified, the old password is dropped and its sessions are revoked, which blocks pre-registration account takeover.
  - `GET /api/auth/me` returns `{ user }`.
  - `GET /api/auth/google/start?returnTo=<app url>` → Google → `GET /api/auth/google/callback` is a server-side authorization-code flow (`google-oauth.service.ts`) for Expo Go, which can't load the native Google SDK. The callback redirects to `returnTo?token=…` or `returnTo?error=…`. The return URL travels in a signed, 10-minute JWT `state`, and must match one of `OAUTH_RETURN_URL_PREFIXES` (`exp://` should only be allowed in development). The flow needs `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` and `PUBLIC_API_URL`, a public HTTPS origin such as an ngrok domain; `<PUBLIC_API_URL>/api/auth/google/callback` must be registered as a redirect URI on the Web client.
  - Phone sign-in (`modules/auth/phone/`): `POST /api/auth/phone/send-code { phone }` returns `{ phone, resendAfterSeconds }`, then `POST /api/auth/phone/verify { phone, code }` returns `{ token, user }`, upserting the user by `phone`. Numbers are normalized to E.164.
    - Codes go through an `OtpProvider` picked by `OTP_PROVIDER`. `console` (development only; `env.ts` refuses it when `NODE_ENV=production`) keeps HMAC-hashed codes in `phone_otp_codes` (5 minutes, 5 attempts, single use) and prints them to the API log. `twilio` uses the Twilio Verify REST API, which stores and checks the codes itself.
    - Sending is rate-limited by the service using `phone_otp_sends`: a 30 s cooldown, 5 codes per number per hour, and 20 per IP per hour. Set `TRUST_PROXY=1` behind ngrok or a load balancer so `request.ip` is the real client.
    - `PublicUser` includes `phone`.
  - **Sessions** (`session.ts`) are rows in `sessions`.
    - Every sign-in method calls `createSession(userId, method, requestContext(request))`. The token is a 30-day HS256 JWT signed with `SESSION_SECRET` (via `jose`), with `sub` = user uuid and `sid` = session row.
    - `requireAuth` checks both the JWT and that the row is neither revoked nor expired, so logout, password changes and resets take effect immediately. Tokens issued before sessions existed are rejected.
    - `POST /auth/logout`, `GET /auth/sessions`, `POST /auth/sessions/revoke-others` and `DELETE /auth/sessions/:id` manage sessions.
  - **Email + password** (`email-auth.service.ts`):
    - `POST /auth/signup { name, email, password, acceptTerms }` creates an unverified account and emails a 6-digit code. `POST /auth/email/verify { email, code }` returns `{ token, user }`; `POST /auth/email/resend { email }` sends a new code.
    - `POST /auth/login { identifier, password }` accepts an email or a phone number. An unverified email gets a fresh code and a 403 with code `email_not_verified`.
    - `POST /auth/password/forgot { email }` and `POST /auth/password/reset { email, code, password }` reset the password; a reset revokes every session and signs the user in.
    - `POST /auth/password/change { currentPassword?, newPassword }` requires auth and revokes the user's other sessions. `currentPassword` is optional when the account has no password yet.
    - `POST /auth/me/email/send-code` and `/me/email/verify` verify an email added from the profile. Changing the email in `PATCH /users/me` clears `email_verified_at`.
    - Passwords are hashed with scrypt (`password.ts`, self-describing `scrypt$N$r$p$salt$hash`). The policy (8+ characters, a letter and a number, not common, doesn't contain the email) is mirrored in the frontend's `PasswordStrength.tsx`.
    - Codes live in `email_codes`: HMAC-hashed, 10 minutes, 5 attempts, single use. Forgot/resend respond the same way whether or not the email exists.
  - **Email delivery** (`email/`) is chosen by `EMAIL_PROVIDER`:
    - `console` (the default) prints the email with its code to the API log. `env.ts` refuses it when `NODE_ENV=production`.
    - `smtp` uses `nodemailer` and needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS`; Gmail works with an App Password. `EMAIL_FROM` defaults to the SMTP user.
    - `resend` sends through Resend's REST API and needs `RESEND_API_KEY` and `EMAIL_FROM` (on a verified domain).
  - **Development codes**: while email or SMS uses the console provider, the send endpoints also return the code as `devCode`. This covers phone `send-code`, `signup`, `email/resend`, `password/forgot` (only when the account exists), `me/email/send-code`, and the `email_not_verified` 403 from login. The app shows it in `DevCodeBanner` with a "Use code" button, so sign-up and login can be tested without Twilio or an email account. It never happens in production, because console providers are refused there.
  - **`DEV_MASTER_OTP`** (in `backend/.env`, currently `654321`) is accepted as the code for every phone sign-in and email verification or reset, whichever provider is configured. `env.ts` refuses to start with it when `NODE_ENV=production`. Delete the line to turn it off.
  - **Rate limits** (`rate-limit.ts`, over `auth_events`):
    - sign-ups: 10 per IP per hour
    - failed logins: 8 per identifier and 40 per IP per 15 minutes
    - code emails: a 30 s cooldown per kind, 5 per address and 20 per IP per hour
    - wrong codes: 10 per address per hour
  - Protect a route with `requireAuth` from `auth.middleware.ts`. `response.locals.userId` and `response.locals.sessionId` are then set, typed through `src/types/express.d.ts`.
- `GET /api/health` returns `{ status: 'ok', service: 'tripivo-api', database: 'ok' | 'unreachable' }`.
- `POST /api/auth/dev-login` returns `{ token, user }` for the demo account (phone `+910000000000`, `DEMO_PHONE` in `auth.service.ts`). It is only enabled outside production and can be turned off with `DEV_LOGIN=false`. `npm run db:seed` fills that account with trips, chats and notifications.
- **App endpoints**: every one requires auth except `GET /api/destinations`. Input is read with the helpers in `shared/http/validate.ts`, which throw 400s that name the field.
  - `users/`:
    - `GET|PATCH /api/users/me` reads and updates the profile (plus `stats`). `completed: true` finishes setup.
    - `GET /api/users/:id` returns a public profile with `isFollowing`/`isBlocked`.
    - `POST|DELETE /api/users/:id/follow` and `/block` follow or block a user.
    - `GET /api/users/me/blocked` and `/me/contacts` list blocked users and the people you share a room with.
  - `places/`: real place search. This replaced the fixed destination list, which is now only a fallback.
    - `GET /api/places/autocomplete?q=&scope=destination|city&lat=&lng=` requires auth and is limited to 30 requests per 10 s per IP. Candidates are re-ranked by kind (city above village above hamlet), name match and distance from `lat/lng`.
    - `GET /api/places/:id` returns a place with coordinates and a photo, looked up on Wikipedia the first time and then stored on the place.
    - `GET /api/places/popular` ranks places by open upcoming trips; `GET /api/places/trending` ranks them by the last 14 days of new trips, joins, requests and saves. Both are padded from `destinations` when there's little data.
    - The provider is chosen by `PLACES_PROVIDER`: `photon` (the default, OpenStreetMap, no key; `PHOTON_URL` points at a self-hosted instance) or `google` (Places API New, needs `GOOGLE_PLACES_API_KEY`).
    - Places are stored in `places` when first returned. Photon autocomplete responses are cached for 7 days in `place_search_cache`; Google results aren't, per its terms.
    - If the provider fails, places seen before plus the catalog are searched; when that finds nothing, the endpoint returns 503 `places_unavailable`.
    - Trips store `place_id`, `country` and the place's coordinates and photo (`POST /api/trips { placeId, … }`, where `destination` text is still accepted). `GET /api/trips?placeId=` matches trips linked to the place, named like it, or within 60 km.
    - `PATCH /users/me { cityPlaceId }` links the home city; the profile returns `homeLocation`.
  - `trips/`:
    - `GET /api/trips` searches with query params `q`, `category`, `activities`, `groupSize`, `budget` (`under5k|5k-10k|10k-20k|20k+`), `from`, `to`, `lat`, `lng`, `radiusKm`, `saved`. `GET /api/trips/mine` returns trips where you have a `membership`. `POST /api/trips` creates a trip.
    - `GET /api/trips/:id` returns the detail: itinerary, travelers, reviews, `ratingDistribution`, `chatRoomId`, `canReview` and `pendingRequestCount`.
    - `PUT /:id/itinerary` (host only) replaces the whole itinerary.
    - `POST|DELETE /:id/save` saves or unsaves a trip.
    - `POST /:id/join` joins directly when the trip is `join_method = 'open'`, otherwise creates a join request. `DELETE /:id/membership` leaves the trip or withdraws the request.
    - `GET /:id/requests` and `POST /:id/requests/:requestId/accept|reject` are for the host.
    - `POST /:id/reviews` is for members once the trip has ended.
  - `chats/`:
    - `GET /api/chats` lists rooms with last message and unread count. `POST /api/chats/direct { userId }` finds or creates a direct chat.
    - `GET /api/chats/:id` returns the room and its latest 100 messages, and marks the room read.
    - `POST /:id/messages` sends a message; `POST /:id/polls` creates a poll and `POST /:id/polls/:pollId/vote` votes. These routes respond with the room's messages.
  - `notifications/`: `GET /api/notifications?kind=` returns `{ notifications, unread }`; `POST /read-all` marks everything read. Trip and chat services create notifications for join requests and decisions, new members and messages (at most one unread per room).
  - `reports/`: `POST /api/reports { targetType, targetId?, details }`.
  - `uploads/`: `POST /api/uploads { data: base64, contentType }` returns `{ url }`. It is mounted before the global `express.json()` because it needs an 8 MB body limit. Files are written to `UPLOAD_DIR` (default `backend/uploads/`, gitignored) and served from `/uploads`. That only works with a single server, so switch to object storage before scaling out.
- **Trip model**: creating a trip, in `insertTrip`, also creates its `groups` row, its group `chat_rooms` row and the creator's admin membership. Being a member means an active `group_members` row plus a `chat_room_members` row. `addMember` and `removeMember` handle both and flip `trips.status` between `open` and `full`. `phase` (`upcoming`/`active`/`completed`) is computed from the dates. Search hides trips whose host has blocked the viewer, or whom the viewer blocked.
- **Database** (`db/`): PostgreSQL through `pg`, with no ORM.
  - `pool.ts` exports the shared `pool`, `Queryable` (pool or transaction client) and `checkDatabase()`.
  - Repository functions take an optional `db: Queryable = pool` as their last argument, so they can be combined inside `withTransaction(async (client) => ...)` from `transaction.ts`.
  - `migrator.ts` applies the SQL files in `backend/migrations/` once each, in filename order, each inside a transaction, under an advisory lock, and records them in `schema_migrations`. `npm run db:migrate` (`src/scripts/migrate.ts`) runs them without starting the API.
  - To change the schema, add a new `NNN_name.sql` file; never edit one that has already been applied. `002_core_schema.sql` holds the domain model:
    - `006_places.sql` adds `places`, `place_search_cache`, `trips.place_id/country` and `travel_profiles.city_place_id`.
    - `005_email_password_auth.sql` adds `users.email_verified_at/terms_accepted_at/password_changed_at`, `sessions`, `email_codes` and `auth_events`.
    - `004_app_features.sql` adds:
      - profile fields (`users.username`, `travel_profiles.age/gender/city/profession/travel_styles/completed_at`)
      - trip fields (`cover_image`, `activities`, `join_method`, `audience`, `latitude/longitude`)
      - `destinations`, `saved_trips`
      - direct chats (`chat_rooms.kind`, nullable `group_id`) and `chat_room_members` (with `last_read_at`)
      - polls (`chat_polls` / `chat_poll_options` / `chat_poll_votes`, posted as a `poll` message)
      - `notifications`, `user_follows`, `user_blocks`, `reports`
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
  - `(app)`: `(tabs)` (Home, Trips, a "+" button that opens `/create`, Messages, Profile), plus search, filters (modal), results, `trip/[id]` (+ itinerary, travelers, reviews, join, requests), the create-trip wizard, `chat/[id]`, `user/[id]`, notifications, edit-profile, settings, safety and map.
  - The navigator isn't mounted until the stored session has been checked; mounting it earlier drops the URL the app was opened with. `auth/google` is an unguarded route that catches the Google browser-flow redirect.
- **Auth** (`src/lib/auth.tsx`, `useAuth()` / `useProfile()`):
  - It restores the stored session, then loads the profile from `GET /users/me`. `profile.completed` decides between setup and the app, and `updateProfile()` PATCHes the API.
  - The last profile is cached under `tripivo.profile` (in `src/lib/storage.ts` / `storage.web.ts`) so the app can start offline. A 401 from any call signs the user out through `setUnauthorizedHandler`.
  - **Sign-in options**:
    - Email + password: `signup` → `verify-email` → setup. Login accepts an email or phone number plus a password, and `forgot-password` resets it.
    - A texted code: `phone` → `verify`.
    - Google.
    - Apple shows a "not available yet" message.
  - Forms show server errors next to the matching input using `fieldError(error, 'email')` from `api.ts`, and `ApiError` carries the API's `code`.
  - `(app)/security` changes or adds a password and lists and signs out devices. `(app)/confirm-email` verifies an email added from Edit Profile.
  - `signOut()` calls `POST /auth/logout` first, so the token really stops working.
  - `EXPO_PUBLIC_BYPASS_LOGIN=true` (in `frontend/.env.local`) is a development flag. With no stored session, the app signs in through `POST /auth/dev-login` as the seeded demo account. After signing out, the login screens show until the next launch.
  - `src/components/auth.tsx` holds the Google/Apple buttons. `googleSignIn.ts` / `.web.ts` / `googleBrowserSignIn.ts` run the Google flows.
- **Data comes from the API.**
  - Screens load data with `useQuery(key, fetcher, { pollMs? })` from `src/lib/useQuery.ts`. It refetches when the screen gains focus and when `key` changes. Screens show `LoadingState`/`ErrorState` from the UI kit, and mutations call `api.ts` and then `reload()`.
  - Chat polls every 4 s and the Messages tab every 10 s. There are no websockets yet.
  - `src/lib/appData.tsx` holds only client-side UI state: the search filters and recent searches, saved on the device.
  - `src/data/catalog.ts` has the fixed lists (interests, group sizes, budget keys) and the onboarding photos. Destinations are not fixed: every place input uses `src/components/PlaceSearch.tsx`.
    - `usePlaceSuggestions` debounces input by 300 ms and ignores stale responses. `PlaceResults` lists suggestions with the OpenStreetMap attribution the licence requires. `PlacePickerField` is a form field; typed text that isn't picked is saved as plain text.
    - The places screens use it: Create Trip step 1 (search plus "Popular with travelers"), Search (suggestions, "Search trips for …", trending), Filters, the city in profile setup and Edit Profile, Home's popular places, and results by `placeId`.
    - `useApproxLocation()` (last known device position without prompting, else the home city) biases suggestions. The map falls back to the home city when device location is unavailable.
  - Photos are picked with `pickAndUploadSquarePhoto()` (base64 → `POST /uploads`).
- **Theme** (`src/theme.tsx`): light and dark palettes (primary blue `#1D6AE5`). The preference (system/light/dark, set in Settings) is saved under `tripivo.theme`. Build styles with `const useStyles = makeStyles((c) => ({...}))` rather than `StyleSheet.create` with hard-coded colors, so dark mode keeps working. Content is capped at `MAX_CONTENT_WIDTH` (560).
- **UI kit** (`src/components/ui.tsx`): `Screen` (safe area, scroll, pinned `header`/`footer`), `Header`, `Txt`, `Button`, `Field`, `SearchBar`, `Chip`/`ChipRow`, `SegmentTabs`, `UnderlineTabs`, `RadioOption`, `InterestGrid`, `StepProgress`, `Avatar`, `ListRow` and others. Trip cards are in `trips.tsx`, and itinerary/travelers/reviews sections in `tripSections.tsx`. `Calendar.tsx` is a dependency-free date picker. The map view draws the real trip coordinates (and the device location, via `expo-location`) onto an SVG illustration (`MapIllustration.tsx`); it isn't a tiled map.
- Device APIs: `expo-location` (the permission prompt, and the position used by the map) and `expo-image-picker` (profile photo). Both have permission strings in `app.json`. The deep-link scheme is `tripivo`.
- **API access** goes through `src/lib/api.ts`, which has a typed function per endpoint and adds the session token itself (`setAuthToken`). Errors are `ApiError`s carrying the server's `{ error }` message, with status 0 when the API is unreachable. The base URL comes from `EXPO_PUBLIC_API_URL`, falling back to `http://localhost:4000/api`. Settings shows the `getApiHealth()` status. Routes added for the backend: `user/[id]` (traveler profile: follow, message, block) and `trip/[id]/requests` (host). The itinerary screen has a host edit mode.
- Native Google sign-in only runs in a development or store build. The native module is `require`d lazily so that Expo Go doesn't crash at startup. Its config plugin is added in `app.config.ts`, and only when `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is set, because the plugin fails prebuild without an `iosUrlScheme`.
- On web, `ImageBackground` needs an explicit `width`/`height: '100%'`. Without it, react-native-web draws the image at its native pixel size and the screen shows only its top-left corner.

## Environment / device gotchas

- `EXPO_PUBLIC_*` variables are inlined at bundle time, so restart Expo after changing `frontend/.env.local`.
- Android emulator: set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api`. Physical phone: use the computer's LAN IP, not `localhost`.
- Expo APIs change every SDK release. Check the versioned docs at `https://docs.expo.dev/versions/v57.0.0/` instead of relying on memory.
- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them. Configure native behavior in `app.json` and config plugins instead. Libraries with native code need a development build (`npx expo run:android|ios`) because Expo Go won't include them.
