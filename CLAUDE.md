# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server on **port 3002** (not the Next.js default 3000).
- `npm run build` / `npm start` — production build / start (also port 3002).
- `npm run lint` — `next lint`. There is no test suite.
- `npx prisma generate` — regenerate the Prisma client after editing `prisma/schema.prisma`.
- `npx prisma migrate dev --name <name>` — create + apply a migration in development.
- `npx prisma studio` — DB GUI.

Requires `POSTGRES_URL` in `.env` (PostgreSQL).

## Architecture

Next.js 14 App Router project that exposes a thin REST-style JSON API over Prisma. Each resource flows through three layers:

```
src/app/api/<resource>/route.ts   ← HTTP handler, dispatches by query/body shape
src/services/<resource>.service.ts ← Zod validation + business rules (bcrypt, etc.)
src/repositories/<resource>.repository.ts ← Prisma calls + a fixed `select` shape
src/db.ts                          ← PrismaClient singleton (cached on globalThis in dev)
```

Resources: `users`, `companies`, `employees`, `products`, `orders`. Schema in `prisma/schema.prisma` — note the Prisma model is `Users` (plural) but Company/Employee/Product/Order are singular.

Path alias: `@/*` → `./src/*`.

### API conventions (important — they are not uniform)

There are **no dynamic `[id]` route segments**. A single `route.ts` per resource implements GET/POST/PATCH/DELETE and reads the id from either the query string or the JSON body. The convention varies across resources:

- **GET single**: `?id=…` on every resource. Without it, returns the full list. `orders` also accepts `?companyId=…`.
- **PATCH**:
  - `users`, `employees`, `products`, `orders` → id from `?id=…` query param.
  - `companies` → id is `companyId` **in the JSON body** (validated by the service's Zod schema).
- **DELETE**: id always from JSON body (`{ id }`).

When adding a new endpoint, match the existing resource it's most similar to rather than inventing a new convention.

### Response + error shape

Use the helpers in `src/lib/apiResponse.ts`:

- `ok(data, status?)` → `{ data }`
- `err(message, status)` → `{ message }`
- `catchErr(e)` → 500 with `e.message`

Services signal HTTP status by attaching `.status` to thrown errors:
```ts
throw Object.assign(new Error('…'), { status: 404 });
```
Route handlers branch on `(e as {status?:number}).status` to map 400/404 → `err(...)`, otherwise `catchErr`. Keep this pattern when adding handlers.

### Service layer rules

- Every mutating service method validates input with a Zod schema (`safeParse`) and throws a 400-tagged error containing `parsed.error.flatten()` as JSON.
- Password hashing (bcryptjs, salt rounds 10) happens in the **service**, never in the repository or route. See `user.service.ts` and `employee.service.ts`.
- Repositories expose only `findAll / findById / create / update / remove` and apply a fixed `select` projection — they do **not** validate or transform input. Don't put business logic there.

### Other

- CORS is wide open on `/api/*` (`Access-Control-Allow-Origin: *`) via `next.config.mjs`. Tighten before any non-dev deployment.
- `.idea/` files are committed; ignore IDE noise in diffs.