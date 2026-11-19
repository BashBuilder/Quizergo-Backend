# agent.md — Quizergo Backend

Instructions for AI coding agents (and humans) working in this repository.
Read this fully before changing anything. Follow the structure and principles
below when adding or modifying features.

---

## 1. What this project is

Quizergo is a quiz/exam-practice API (aimed at Nigerian exams such as
JAMB/WAEC, using subjects from the ALOC question API). Users register, verify by
email OTP, log in, start timed quiz sessions across one or more subjects,
sync answers while taking the quiz, submit for grading, and view their history.

Questions are **not owned by this service**. They are fetched from the external
ALOC API, cached in Redis, and graded server-side. Only finished results are
persisted to PostgreSQL.

## 2. Tech stack

| Concern       | Choice                                                         |
| ------------- | -------------------------------------------------------------- |
| Runtime       | Node 22, ESM (`"type": "module"`), pnpm 10                     |
| Language      | TypeScript (strict, `nodenext` module resolution)              |
| HTTP          | Express 5, helmet, cors, cookie-parser, express-rate-limit     |
| Validation    | Zod 4                                                          |
| Database      | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`)              |
| Cache / state | Redis (`redis` v5 client): sessions, OTPs, throttling, caching |
| Email         | Resend (`src/lib/resend.ts`, HTML templates inline)            |
| External API  | ALOC questions API via axios (`src/config/axios.ts`)           |
| Auth          | JWT (access + refresh) backed by a `KeyStore` row per user     |
| Logging       | Winston + daily rotate file (`core/Logger.ts`)                 |
| Tests         | Vitest + Supertest                                             |

## 3. Commands

```bash
pnpm install
pnpm dev            # tsx watch src/index.ts
pnpm build          # prisma generate && tsc  -> dist/
pnpm start          # node dist/index.js
pnpm test           # vitest (watch), NODE_ENV=test
pnpm test:run       # vitest --run
pnpm seed           # creates an API key (prints raw key once)

pnpm prisma migrate dev --name <what_changed>   # create + apply migration
pnpm prisma generate                            # regenerate client
docker compose up                               # app + redis-stack + postgres + pgadmin
```

The Prisma client is generated into `src/generated/prisma` (git-ignored).
Always run `pnpm prisma generate` after pulling schema changes or fresh clones.

## 4. Environment variables

See `.env.example`. Never read, print, or commit `.env`. Code actually reads:

`PORT`, `NODE_ENV`, `LOG_DIRECTORY`, `ACCESS_TOKEN_VALIDITY_SEC`,
`REFRESH_TOKEN_VALIDITY_SEC`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_SECRET`,
`JWT_ALGORITHM`, `ALOC_API_KEY`, `ALOC_BASE_URL`, `DB_URL` (Postgres connection
string), `REDIS_URL`, `RESEND_API_KEY`, `RESEND_CONTACT_EMAIL`.

> Note: every env var is validated at startup by the Zod schema in
> `src/utils/env.util.ts` (`handleEnv`), so keep that schema, `.env.example`
> and this list in sync when adding a variable. When you add a new env var, add
> it to `.env.example` with a comment, add it to the schema, and read it
> **only** through `src/config/`. Never log env values.

## 5. Project structure

```
src/
  index.ts            # process entry: listen + SIGINT shutdown
  app.ts              # builds the Express app, wires middleware/routes/error handler
  config/             # env-derived config + client singletons (prisma, redis, axios, resend, events)
  routes/             # URL -> middleware chain -> controller. One file per resource.
  controllers/        # HTTP layer: read req, call service, shape res, emit events
  services/           # business logic (classes or functions). No Express types here.
  models/             # Zod schemas + inferred types for request validation
  middleware/         # auth (JWT), api-key, permission middlewares
  helper/             # validator.ts (validateRequest), asyncHandle.ts
  lib/                # errors.ts, jwt.ts, utility.ts (OTP/password), resend.ts, constants.ts, middleware.ts (throttle + errorHandler)
  cache/              # redis client + connect/disconnect
  utils/              # small shared utils (headers enum, env check)
  __types__/          # global/ambient types (Express.Request augmentation, quiz types)
  generated/prisma/   # GENERATED — never edit, never commit
core/Logger.ts        # Winston logger (also compiled copies exist in src/core; see Known issues)
prisma/               # schema.prisma, migrations/, seed.ts
tests/                # vitest + supertest integration tests
```

Routes are mounted in `src/routes/index.ts` under `api/v1/<resource>`:
`/webhook`, `/auth`, `/questions`, `/quiz`, `/user`.

## 6. Core flows (how the system works today)

**Auth.** `register` hashes password (bcrypt, 10 rounds), creates the user,
stores a 6-digit OTP in Redis (`otp:auth:<email>`, 2h TTL) and emails it.
`verify` checks the OTP and sets `isVerified`. `login` requires a verified
user, creates random `primaryKey`/`secondaryKey` strings stored in `KeyStore`
(one row per user), and signs two JWTs whose `prm` claim holds each key.
`requireAuth` reads `Authorization: Bearer <token>`, verifies the JWT,
loads the user, and checks the `KeyStore` row matches `prm` and is `ACTIVE`.
Logout deletes the KeyStore row, which invalidates all tokens. Refresh tokens
are matched against `secondaryKey`.

**Quiz session.** `POST /quiz` fetches questions per subject from ALOC (or
Redis cache when `retake`), shuffles them, stores the **full** session
(including answers) in Redis at `session:<id>` and returns questions with
`answer`/`solution` stripped. `PATCH /quiz/:id/sync` merges in-progress
answers. `POST /quiz/:id/submit` grades server-side, deletes the session,
persists to Postgres (`QuizResult` + `QuizAnswer`, fire-and-forget), and
returns the breakdown. **Correct answers must never be sent to the client
before submission.**

**Events.** Side effects (welcome email, logging) go through the shared
`EventEmitter` in `src/config/events.ts`. Controllers `emit(...)` after
responding; listeners are registered in `src/services/event.service.ts`.

**API keys.** `ApiKey` rows (SHA-256 hashed keys) with `Permissions[]`; the
`apikey.middleware` + `permission.middleware` exist for service-to-service or
admin routes via `x-api-key`. They are currently not applied on routes.

## 7. Layering rules (the most important section)

Request flow, always in this order:

```
route  ->  validateRequest(zod model)  ->  [requireAuth / throttle / permission]  ->  controller  ->  service  ->  prisma | redis | external API
```

1. **Routes** only declare paths, HTTP verbs, and middleware order. No logic.
2. **Models** (`src/models/<feature>.model.ts`) hold Zod schemas. Export the
   schema and `z.infer` type together. Every route that accepts input must
   validate body, params, or query through `validateRequest(schema, ValidationSource.X)`.
3. **Controllers** are thin: pull validated input off `req`, call a service,
   send the response, emit events, and pass errors to `next(error)`.
   Controllers must **not** contain Prisma queries, Redis logic, or business rules.
4. **Services** own business logic and data access. They take plain arguments
   (no `req`/`res`), return plain data, and throw typed errors from
   `src/lib/errors.ts`. Prefer a class per feature
   (`QuizSessionService`, `UserProgressService` are the pattern), instantiated
   once at module level in the controller.
5. **Prisma and Redis** are imported only from `src/config/prisma.ts` and
   `src/cache/index.ts`. Never create new clients.
6. **External APIs** go through a dedicated service plus a configured axios
   instance in `src/config/`. Wrap failures with `handleFunctionError`.

> Existing code in `auth.controller.ts` queries Prisma directly in
> controllers. That is legacy. **New code must follow the layering above**, and
> when you touch an auth handler substantially, move its data logic into a service.

## 8. How to add a new feature (checklist)

Example: adding a `leaderboard` feature.

1. **Schema** — if you need persistence, edit `prisma/schema.prisma`, add
   indexes for every field you filter/sort by, then
   `pnpm prisma migrate dev --name add_leaderboard`. Commit the migration folder.
2. **Types** — add shared/ambient types to `src/__types__/` only if they are
   used across modules; otherwise export them from the model/service file.
3. **Model** — `src/models/leaderboard.model.ts` with Zod schemas + inferred types.
4. **Service** — `src/services/leaderboard.service.ts`. All logic and queries here.
5. **Controller** — `src/controllers/leaderboard.controller.ts`. Thin handlers.
6. **Route** — `src/routes/leaderboard.route.ts`, then register it in
   `src/routes/index.ts` as `app.use(\`/${version}/leaderboard\`, leaderboardRoutes)`.
7. **Events/side effects** — emit a named event (`leaderboard.updated`) and add
   the listener in `event.service.ts`. Do not block the response on side effects.
8. **Tests** — add `tests/<feature>.test.ts` (see Testing).
9. **Docs/env** — update `.env.example` for any new env var and this file if
   you introduced a new pattern.
10. Run `pnpm build` and `pnpm test:run` before finishing.

### Naming conventions

- Files: `<feature>.route.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.model.ts`.
- Zod schemas: `<action><Thing>Schema` or `<thing>Model`; types: `<Action><Thing>Type`.
- Redis keys: `<domain>:<qualifier>:<id>` e.g. `session:<id>`, `otp:auth:<email>`,
  `questions:subject:<subject>`, `throttle:<email>:<ip>:<action>`. **Always set a TTL**
  (`setEx`/`EX`) for anything that is not a permanent value.
- Events: dot-separated lowercase `<domain>.<past-tense-verb>` (`user.verified`, `quiz.submitted`).
- API paths: plural nouns, lowercase, kebab-case, under `/api/v1`.

## 9. Backend principles

**Validation & input**

- Never trust `req.body`, `req.query`, `req.params`, or headers; validate with Zod first.
- Use `z.coerce` for numeric query/params. Keep error messages user-readable;
  `validateRequest` joins issue messages into a `BadRequestError`.

**Errors**

- Throw the typed classes from `src/lib/errors.ts` (`BadRequestError`,
  `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`,
  `TooManyRequestsError`, ...). Use `NotFoundError` for missing resources
  rather than a `ValidationError` with a 400.
- Wrap Prisma/axios calls with `handleFunctionError(error, "context")` so
  provider errors map to our error types.
- Controllers end every handler with `catch (error) { next(error); }`; the
  global `errorHandler` formats the response. Do not hand-roll
  `res.status(500)` in controllers.
- Never leak internals: do not return raw Prisma/axios messages for unexpected
  (non-`AppError`) errors in production responses.

**Response shapes**

- Success: JSON object with a `message` and/or named payload, e.g.
  `{ message, ...data }`. Use correct codes: `201` create, `200` read/update, `204` delete with no body.
- Error (produced by `errorHandler`): `{ success: false, message, code }`.
- Never return the `password` hash or `KeyStore` keys. Strip with destructuring
  (`const { password, ...safe } = user`) or use Prisma `select`.

**Auth & security**

- Protected routes use `requireAuth`; role/permission checks go in a middleware
  (use the `Roles` enum for user roles, `Permissions` for API keys).
- Authenticated resources must be scoped to `req.user.id` in the **query itself**
  (`where: { userId }`), not filtered after loading, to prevent IDOR.
- Rate-limit sensitive or expensive endpoints with `throttleNetwork(action, limit, windowSec)`
  or `express-rate-limit`.
- Secrets/keys are hashed or random; compare in constant time where feasible;
  never log passwords, OTPs, tokens, or full request bodies.
- Do not weaken helmet/CORS settings; tighten `origin` for production.

**Data access**

- Use `select`/`include` deliberately; avoid unbounded `findMany`. **Paginate**
  every list endpoint (`take`/`skip` or cursor) with an upper bound.
- Multi-step writes that must succeed together use `prisma.$transaction`.
- Add `@@index` for filter/sort columns and `onDelete` behavior on relations.
- Store a snapshot (like `QuizAnswer.questionSnapshot`) when upstream data
  (ALOC) can change and history must stay stable.
- Never hand-edit applied migrations; add a new one.

**Redis / state**

- Redis holds ephemeral state (sessions, OTPs, throttles, caches). Postgres
  is the source of truth for anything durable.
- Anything stored must have a TTL and a namespaced key. Handle cache misses
  gracefully and fail safe (do not crash the request on cache errors when the
  cache is an optimization).

**Async & side effects**

- Always `await` or explicitly handle promises. Fire-and-forget work must
  `.catch` and log with `Logger`, not `console`.
- Slow side effects (emails, analytics) are triggered through events, after
  the response is sent.

**Logging**

- Use `Logger` from `core/Logger.js`, not `console.log`. Levels: `error` for
  failures, `warn` for suspicious conditions, `info` for lifecycle events, `debug`
  for dev-only detail. Do not log secrets or PII beyond what is needed.

**TypeScript**

- `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are on.
  Do not silence them with `any`, `@ts-ignore`, or non-null `!` unless there
  is a documented reason. Prefer `unknown` + narrowing in `catch`.
- **Import paths must end in `.js`** (e.g. `from "../lib/errors.js"`) because of
  `nodenext` ESM resolution, even though the source is `.ts`.

## 10. Testing

- Framework: Vitest + Supertest against the exported `app` from `src/app.ts`.
  Tests live in `tests/`; `tests/setup.test.ts` mutes console output and wipes
  `keyStore` and `user` tables after each test.
- Tests are integration tests against a real Postgres and Redis (use a
  separate test DB; `NODE_ENV=test`). They need the services running
  (`docker compose up postgres redis`).
- For every new endpoint cover: happy path, validation failure (400),
  auth failure (401/403), not found (404), and any rate-limit/ownership rule.
- Mock external services (ALOC, Resend) with `vi.mock`; never call real ones in tests.
- Use the exported `version` from `src/routes/index.ts` to build URLs.
- Clean up any new tables you write to in `setup.test.ts` or in the test itself.

## 11. Working principles for agents

- **Read before you write.** Look at the closest existing feature
  (`quiz` is the best reference for layering) and mirror it.
- **Smallest correct change.** Don't refactor unrelated code or reformat files.
  If you spot a problem outside the task, mention it rather than silently fixing it.
- **Don't touch** `src/generated/`, `pnpm-lock.yaml` (except via pnpm),
  applied migrations, `.env`, or `logs/`.
- **Never expose answers early.** Any new endpoint returning questions must strip `answer` and `solution`.
- **Ask before** changing the auth/token model, the Prisma schema in a
  breaking way (dropping/renaming columns), or the public API contract.
- **Verify.** Run `pnpm build` (type-check) and `pnpm test:run` before
  declaring work done, and say if you could not run them.
- **Security-sensitive changes** (auth, OTP, tokens, permissions) need
  extra care and a test for the failure path.
- Keep commits focused; migration + code + tests for a feature belong together.

## 12. Known issues in the current codebase

Be aware of these; don't copy them into new code, and flag them if relevant to your task.

1. `src/utils/env.util.ts` `handleEnv()` validates every required env var with
   Zod (messages name the variable, never its value) and throws a
   `ConfigurationError` when one is missing/invalid. `initializeApp()` is
   `await`ed in `src/index.ts` before `app.listen`, so a bad environment exits
   the process instead of starting a broken server. Keep the schema in sync
   when adding env vars.
2. `connectRedis()` and `prisma.$connect()` are **commented out** in
   `initializeApp()`, so the Redis connection is not explicitly established at
   startup. Verify the connection path before relying on Redis in new code.
3. `resetPassword` has the OTP verification **commented out** and the schema
   requires `otp` — as written, anyone who knows an email can reset that
   account's password. Fix before production.
4. `generateOtp` uses `Math.random()`; use `crypto.randomInt` for OTPs.
   `login`/`forgot-password`/`register` also reveal whether an email exists.
5. `quiz.controller.ts` `submitSession` persists results fire-and-forget with
   `console.error`; failures are silently lost. Use `Logger` and consider a retry/outbox.
6. `syncAnswers` in the controller matches the error by message string
   (`"Session not found or expired"`) and returns 404; services should throw
   `NotFoundError` instead. `ValidationError` is used where 403/404 fits better.
7. Duplicated/legacy files: `src/controllers/aloc.questions.controller.ts` is
   unused; `core/Logger.*` exists both at the repo root and in `src/core`
   (compiled `.js`/`.d.ts`/`.map` files are checked in and `src/core` is
   excluded from `tsconfig`); `event.service.js` is imported twice in `app.ts`.
8. `userProgress.saveResult` and `getUserQuizHistory` have no pagination;
   `getUserHistory` returns raw `QuizResult` rows.
9. `questions.controller.ts` has an unfinished `gradeScore` stub and relies on
   `@ts-expect-error`; `questionQuerySchema` expects `subject` as an array
   while the controller treats it as a string.
10. CORS is `origin: "*"` with `credentials: true`, `PATCH` is not in the
    allowed methods list (yet `/quiz/:id/sync` uses PATCH), and the
    `throttleNetwork` keys on client-supplied `email`.
11. `docker-compose.yml` mounts the project and runs `pnpm dev` (a dev
    setup); `Dockerfile` runs `pnpm start` but never runs `pnpm build`.
12. `opencode.json` references `backend/agent.md` and `frontend/agent.md`;
    this repo is the backend root, so adjust that path (e.g. `agent.md`) if
    the file sits at the repo root.

---

_Keep this file current: if you introduce a new pattern, dependency, env var,
or convention, update the relevant section in the same change._
