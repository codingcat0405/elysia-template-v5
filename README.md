# Elysia + MikroORM template v4

Production-hardened rework of v3. Bun runtime, Elysia, MikroORM (PostgreSQL).

## Run

```bash
cp .env.example .env   # fill JWT_SECRET (openssl rand -base64 48) and DATABASE_URL
bun install
bun dev                # watch mode; dev uses schema auto-sync
```

Swagger UI: http://localhost:3000/swagger-ui (auto-disabled in production unless `ENABLE_SWAGGER=true`).

Docker:

```bash
docker build -t elysia-template-v4 .
docker run -p 3000:3000 --env-file .env -e NODE_ENV=production elysia-template-v4
```

## Architecture

Feature-based modules, per-request EntityManager fork via `derive` — no `RequestContext`/AsyncLocalStorage dependency.

```
src/
  index.ts              # boot: env checks, migrations, graceful shutdown, /health
  db.ts                 # cached initORM()
  mikro-orm.config.ts   # pool config, migrations
  setup.ts              # per-request: em fork + service instances
  modules/
    user/
      index.ts          # Elysia controller
      service.ts        # plain class, em via constructor
      model.ts          # typebox request/response schemas
  entities/             # shared MikroORM entities
  macros/auth.ts        # role-based JWT auth macro
  middlewares/          # error mapping + entity serialization
  utils/http-errors.ts  # framework-free HttpError classes
  migrations/
```

### The rules that keep MikroORM happy

1. **One `em.fork()` per request** — done in `setup.ts`, shared by all services of that request (one Unit of Work, one Identity Map).
2. **Never use the global `orm.em` in modules** — only the derived `em` / services. Grep for `orm.em` outside `setup.ts` in code review.
3. **Services are per-request instances, not singletons** — an app-lifetime object must never hold a request-lifetime `em`.
4. **Production schema changes via migrations only**:

```bash
bun run migration:create   # generate from entity diff
bun run migration:up
```

In cluster mode, run migrations once (deploy step), not in every worker.

### Pool sizing

Per-process pool via `DB_POOL_MAX` (default 10). With `node:cluster` / multiple instances: `total connections = workers × DB_POOL_MAX` — keep it under Postgres `max_connections` with headroom, or put pgBouncer in front.

## Changes vs v3

- `.env` removed from git (secrets were committed); `.env.example` added
- `password` hidden from serialization + response schemas enforce output shape
- JWT: `expiresIn`, boot fails fast on missing `JWT_SECRET`, invalid token → 401 (was 400/500)
- 500 responses no longer leak internal error messages
- `@Unique()` on username (findOne-then-create was a race)
- `RequestContext.enter` → explicit `derive` fork (Bun-safe)
- `updateSchema()` only in dev; migrations in prod
- Pool config, acquire timeout 10s (was 60s hang)
- Graceful shutdown (SIGTERM/SIGINT), `/health`, non-zero exit on boot failure
- Dockerfile: pinned image, frozen lockfile, non-root user, port matches app
- Custom `HttpError` classes; services framework-free
- Response middleware serializes entity arrays too, no longer forces status 200

***Created by CodingCat, happy coding!***
