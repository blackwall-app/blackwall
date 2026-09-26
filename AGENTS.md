# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

# Effect v4 (rc) conventions in this repo

- `effect@4.0.0-rc.117` is installed as a dev dependency at the repo root and
  as a dependency in `@blackwall/shared`, `@blackwall/database`,
  `@blackwall/backend`, and `frontend`. Keep versions pinned in sync.
- Stable imports come from `"effect"` (`Effect`, `Layer`, `Context`, `Schema`,
  `ManagedRuntime`). Server, client, and RPC modules live under
  `"effect/unstable/*"` (`http`, `httpapi`, `rpc`, `sql`, `schema`) and may
  still change between rc releases.
- All validation and domain modeling uses `Schema`. Do not add new `zod`
  schemas. New contracts go in `@blackwall/shared` (`workspaces.ts`, `api.ts`,
  `auth.ts`) next to the HttpApi, which consumes them directly.
- Hono routes stay on `*.zod.ts` for now. `hono-openapi` `validator()` calls
  `resolver()` eagerly, and `@standard-community/standard-json` still targets
  effect v3, so Effect v4 schemas break `/api/docs/openapi`. Switch a route to
  its Effect Schema only after that dependency supports v4.
- Shared API contracts live in `@blackwall/shared` (`workspaces.ts`, `api.ts`).
  They must stay runtime-neutral: no drizzle, better-auth, or node imports, so
  the frontend bundle can import them.
- Drizzle stays as the SQL layer, wrapped by the `Database`
  `Context.Service` in `@blackwall/database`. Effect services take `Database`
  from context instead of importing the `db` singleton. Data functions accept
  an optional db handle defaulting to the singleton until callers migrate.
- better-auth stays as the auth implementation, wrapped by the `Auth`
  `Context.Service` in backend `features/auth/Auth.ts`. Read sessions through
  it, never through `auth.api` directly in new code.
- New HTTP endpoints go on the shared `Api` HttpApi (`@blackwall/shared/api.ts`)
  with `HttpApiBuilder` handlers in backend `api/`. The Hono app mounts the
  Effect handler at `/api/effect/*`. The frontend calls it through
  `lib/api-effect.ts` (`ApiClient`), not `hono/client`.
- Follow `node_modules/effect/AGENTS.md`: `Effect.gen` inline, `Effect.fn`
  for reusable functions, `Context.Service` for services with `Service.of` and
  a static `layer`, `Schema.TaggedError` for typed errors, `Predicate` module
  instead of hand-written guards.
