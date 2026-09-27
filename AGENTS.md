# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

# Effect v4 (rc) conventions in this repo

- `effect@4.0.0-rc.117` is installed as a dev dependency at the repo root and
  as a dependency in `@blackwall/shared`, `@blackwall/database`,
  `@blackwall/backend`, `@blackwall/queue`, `blackwall`, and `frontend`. Keep
  versions pinned in sync.
- Stable imports come from `"effect"` (`Effect`, `Layer`, `Context`, `Schema`,
  `ManagedRuntime`). Server, client, and RPC modules live under
  `"effect/unstable/*"` (`http`, `httpapi`, `rpc`, `sql`, `schema`) and may
  still change between rc releases.
- All validation and domain modeling uses `Schema`. Do not add new `zod`
  schemas.
- Hono routes stay on `*.zod.ts` until their group moves to the HttpApi.
  `hono-openapi` `validator()` calls `resolver()` eagerly, and
  `@standard-community/standard-json` still targets effect v3, so Effect v4
  schemas break `/api/docs/openapi`.
- API contracts live in `@blackwall/shared`, one file per group, with
  `workspaces.ts` as the reference. Each file holds the request and response
  schemas, the group's errors, and its `HttpApiGroup`. Register the group in `api.ts` above `RequestValidation` and
  export the file from `index.ts`. Contracts must stay runtime-neutral: no
  drizzle, better-auth, or node imports, so the frontend bundle can import them.
- Entity schemas such as `User`, `Team`, `Label`, and `Issue` live in
  `shared/models.ts`. Build responses from them. Dates are `Schema.Date`, so
  clients get `Date` objects. Encoding drops undeclared fields, which keeps
  private columns out of responses.
- Every API error extends `ApiError` (`shared/errors.ts`), which stamps a fixed
  `code` from `ErrorCode` and a default message. The frontend localizes that
  code. A new code needs an `error_*` message in `frontend/messages/en.json`
  and `pl.json` and an entry in `lib/error-localization.ts`.
- Groups scoped to a workspace add `.middleware(WorkspaceMembership)` and then
  `.middleware(Authorization)`. Handlers read `CurrentUser` and
  `CurrentWorkspace`; the workspace comes from the `x-blackwall-workspace-slug`
  header.
- Drizzle stays as the SQL layer, wrapped by the `Database`
  `Context.Service` in `@blackwall/database/effect`. Services call
  `database.use((db) => ...)` or `database.transaction((tx) => ...)`. The
  transaction callback is synchronous because bun:sqlite can't await inside a
  transaction. Both fail with `DatabaseError`. Map the cases you expect, such as
  `isUniqueViolation`, to domain errors and turn the rest into defects. Data
  functions take the handle as a parameter.
- Services are `Context.Service` classes with a static `layer` that takes
  `Database` and any other services from context. Add each one to `ServicesLive`
  in backend `lib/effect/runtime.ts`. That one graph backs the HttpApi handler
  and `runtime`, which Hono routes use to call services while they still exist.
- better-auth stays as the auth implementation, wrapped by the `Auth`
  `Context.Service` in backend `features/auth/Auth.ts`. Read sessions through
  it, never through `auth.api` directly in new code.
- Handlers are `HttpApiBuilder.group` layers in backend `api/`, registered in
  `api/handlers.ts`. The Hono app mounts the Effect handler at `/api/effect/*`.
- Test a group through `runApi` in backend `test/api.ts`: it runs the real
  handlers, middleware, and services against the in-memory test database, with
  the session cookie from `seedTestSetup`. Don't test handlers with fakes alone.
- The frontend calls the API through `runApi((client) => ...)` from
  `lib/api-effect.ts`. It shows the localized toast and redirects to `/signin`
  on 401, like `apiFetch`. Keep Effect inside loaders and actions; Solid
  components don't import it.
- Follow `node_modules/effect/AGENTS.md`: `Effect.gen` inline, `Effect.fn`
  for reusable functions, `Context.Service` for services with `Service.of` and
  a static `layer`, `Schema.TaggedError` for typed errors, `Predicate` module
  instead of hand-written guards.
