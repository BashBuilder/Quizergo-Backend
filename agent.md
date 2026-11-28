# agent.md — Quizergo Backend

Instructions for AI coding agents (and humans) working in this repository.
Read this fully before changing anything. Follow the structure and principles
below when adding or modifying features.

---

## 1. What this project is

Quizergo is a quiz/exam-practice API (aimed at Nigerian exams such as
JAMB/WAEC, with questions stored in the service database). Users register, verify by
email OTP, log in, start timed quiz sessions across one or more subjects,
sync answers while taking the quiz, submit for grading, and view their history.

Questions live in this service's PostgreSQL database (`Question` table),
are loaded per session and graded server-side. Finished results are persisted
to PostgreSQL as well.

## Question Format and Data Structure

When generating or populating questions for any subject, follow these requirements:

1. **Data File**
   - Create a JSON file inside the `data/` directory, named after the subject (e.g., `literature.json`, `mathematics.json`, `english.json`).
   - Each file must contain a valid JSON array of question objects as already declared in the project.
   - Ensure the JSON is properly structured, valid, and consistent with the existing question schema.

2. **Question Sources and Authenticity**
   - Research and retrieve authentic JAMB questions for the specified examination year (2026 by default).
   - Prioritize credible sources such as MySchool, ALOC and other reputable educational platforms.
   - Do not fabricate questions or present generated questions as authentic past examination questions.
   - Where possible, cross-reference questions and answers across multiple credible sources.
   - If an original question cannot be verified, clearly distinguish it from an officially sourced JAMB question.

3. **Question Formatting**
   - Questions must follow the standard JAMB examination structure and conventions.
   - Format question content for HTML rendering using appropriate semantic HTML elements where necessary.
   - Use elements such as `<strong>`, `<em>`, `<u>`, `<sub>`, `<sup>`, `<p>`, `<ol>`, `<ul>`, `<br>` and others where appropriate.
   - Preserve mathematical expressions use Use KaTeX or <math xmlns="http://www.w3.org/1998/Math/MathML"> where necessary with math elements, scientific notation, special characters, tables, passages, and other subject-specific formatting requirements.
   - Ensure questions remain readable and render correctly in the application's question interface.

4. **Question Structure**
   - Follow the standard JAMB question count and examination structure for the relevant subject. Where the examination format specifies 40 questions, provide exactly 40 questions per examination set.
   - Each question must contain the appropriate answer options (A, B, C, and D), except where the official examination format specifies otherwise.
   - Every question must have one clearly identified correct answer.
   - Avoid duplicated questions, repeated options, ambiguous wording, and incorrect answer mappings.

5. **Solutions and Explanations**
   - Every question must include a `solutions` field containing a correct, comprehensive, step-by-step explanation.
   - Explanations must be written in simple language that a child or beginner can easily understand.
   - Explain the reasoning behind the correct answer rather than simply restating it.
   - Where applicable, explain calculations, formulas, definitions, concepts, and why the other options are incorrect.
   - Use appropriate HTML formatting in explanations to improve readability.
   - Never include unverified answers or explanations. Validate correctness before adding questions to the dataset.

6. **Categories and Topics**
   - The `category` field must contain the appropriate official JAMB syllabus topic for the question.
   - Use the official syllabus for the relevant subject to determine topic classifications.
   - Do not use arbitrary categories, broad generic labels, or topics that do not accurately represent the question being tested.
   - Ensure topic names remain consistent across questions belonging to the same syllabus topic.

7. **Quality Assurance**
   - Validate the JSON structure before completing the task.
   - Confirm that every question has all required fields and valid answer options.
   - Verify that the correct answer matches the explanation.
   - Check for duplicates, formatting errors, missing solutions, and incorrect topic classifications.
   - Ensure all questions meet the required examination standard and are suitable for the intended learners.

**Important:** These requirements apply universally to every subject supported by the application. Subject-specific differences, including question counts, examination structure, answer options, and formatting conventions, must follow the applicable official JAMB syllabus and examination guidelines rather than assuming that every subject uses an identical format.

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
pnpm import:questions data/mathematics.json mathematics  # bulk-import questions (dedup by subject + exam year + question number, DB assigns UUID, mockId left NULL)

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
`JWT_ALGORITHM`, `DB_URL` (Postgres connection
string), `REDIS_URL`, `RESEND_API_KEY`, `RESEND_CONTACT_EMAIL`, and the Qbot
settings (`Qbot_LLM_*`, `Qbot_MAX_HISTORY_MESSAGES`, `Qbot_SUMMARY_THRESHOLD`,
`Qbot_RECENT_MESSAGES_KEEP`, `Qbot_RATE_LIMIT_*`).

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
`/webhook`, `/auth`, `/questions`, `/quiz`, `/user`, `/qbot`.

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

**Quiz session.** `POST /quiz` loads questions per subject from the `Question`
table (random window, so repeat sessions differ), shuffles them, stores the **full**
session (including answers) in Redis at `session:<id>` and returns questions with
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
- Store a snapshot (like `QuizAnswer.questionSnapshot`) when source data can
  change and history must stay stable.
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
- Mock external services (Resend) with `vi.mock`; never call real ones in tests.
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

---

_Keep this file current: if you introduce a new pattern, dependency, env var,
or convention, update the relevant section in the same change._
