# Plan 013: auth-service organised by feature

Issue: #52, its "Done when" list. Short plan. No behaviour, API, contract or security change;
decided in D-012.
Branch: chore/auth-service-structure
Status: done
Rule: one task, one commit. Exception for this plan only (owner's choice, 2026-11-19): all
tasks in one run without stopping between tasks; at the end run build, lint and the full
tests of auth-service, the contracts test and the repo checks locally, fix red, report once.
No push and no PR until the owner says so.

## Global Constraints

- Branch: `chore/auth-service-structure` from an up-to-date `main`; never commit to `main`.
- Scope: auth-service, its CI checks and the docs that name its files. Java and web are a
  later issue.
- Move with `git mv` so history follows. A move changes only imports and paths: no logic,
  no renamed function, type or constant (`createSessionService` keeps its name inside
  `sessionRestore.service.ts`).
- After each move task, `git diff -M --stat main` shows renames (`old => new`), not a delete
  plus an add. If a file shows as delete plus add, say so in the report.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task is done, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 013.` and the attribution line.
- No new package.
- A task diff over about 200 lines (not tests, not pure renames): stop and ask.

## Target layout of `src/`

| New path | Was |
|---|---|
| `app.ts`, `server.ts`, `config.ts`, `logger.ts` | same |
| `common/apiError.ts` | `errors.ts` |
| `common/storeErrors.ts` | `repositories/errors.ts` |
| `common/failureCounter.ts` | `repositories/failureCounter.ts` |
| `common/chars.ts` | `routes/chars.ts` |
| `common/secretToken.ts` | `services/tokens.ts` |
| `infra/stores.ts` | `repositories/stores.ts` |
| `middleware/errorHandler.ts` | `middleware/errors.ts` |
| `middleware/requestLog.ts`, `ready.ts`, `internalKey.ts`, `burstLimit.ts`, `clientIp.ts` | same |
| `modules/users/users.repository.ts`, `user.model.ts`, `password.util.ts` | `repositories/users.ts`, `models/user.ts`, `services/password.ts` |
| `modules/invitations/invitations.routes.ts`, `invitations.service.ts`, `acceptLimit.service.ts`, `invitations.repository.ts`, `invitation.model.ts` | `routes/invitations.ts`, `services/invitations.ts`, `services/acceptLimit.ts`, `repositories/invitations.ts`, `models/invitation.ts` |
| `modules/auth/auth.routes.ts`, `login.service.ts`, `loginLimit.service.ts`, `refresh.service.ts`, `logout.service.ts`, `sessionRestore.service.ts` | `routes/auth.ts`, `services/login.ts`, `loginLimit.ts`, `refresh.ts`, `logout.ts`, `session.ts` |
| `modules/auth/session/session.repository.ts`, `session.scripts.ts`, `sessionTokens.service.ts`, `sessionCheck.service.ts`, `sessionRevoker.service.ts`, `requireAccess.middleware.ts` | `repositories/sessions.ts`, `repositories/sessionScripts.ts`, `services/sessionTokens.ts`, `sessionCheck.ts`, `sessionRevoker.ts`, `middleware/requireAccess.ts` |
| `modules/health/health.routes.ts`, `health.service.ts` | `routes/health.ts`, `services/health.ts` |
| `modules/internal/internal.routes.ts` | `routes/internal.ts` |
| `modules/bootstrap/startup.service.ts`, `bootOwner.service.ts` | `services/startup.ts`, `services/bootOwner.ts` |

`modules/auth/session/` is part of module `auth`: files in `auth/` and `auth/session/` import
each other directly; other modules import them only through `modules/auth/index.ts`.

Module `index.ts` files export only what other modules, `app.ts`, `server.ts` or
`middleware/` use:

- users: `createUsersRepository`, `UsersRepository`, `Role`, `ROLES`, `normalizeEmail`,
  `hashPassword`, `verifyPassword`.
- invitations: `invitationsRouter`, `createInvitationsService`, `InvitationsService`,
  `createInvitationsRepository`, `InvitationsRepository`, `createAcceptLimit`, `AcceptLimit`,
  `ACCEPT_KEY_PREFIX`, `ACCEPT_WINDOW_SECONDS`.
- auth: `authRouter`; login, login limit, refresh, logout and session restore factories,
  types and key constants that `server.ts` and `app.ts` use; `createSessionStore`,
  `createSessionCheck`, `createSessionRevoker`, `createSessionTokens`.
- health: `healthRouter`, `createHealth`, `Health`. internal: `internalRouter`.
- bootstrap: `createStartupLoop`, `Readiness`, `createBootOwnerStep`.

Import graph after the move, checked against today's imports: no cycle.
users <- invitations <- bootstrap; users <- auth. `middleware/ready.ts` imports only the
`Readiness` type from the bootstrap index.

## Tests

Stay in `test/` (they cover the whole app): `app`, `burst-and-headers`, `config`, `contract`,
`log-masking`, `route-paths`, `startup`; and `login-flow`, `refresh` (point 1 below);
and `require-access`, `startup-loop`, which build a small app with
`middleware/errorHandler.ts`, a file rule 3 does not let a module import (point 7).
`test/helpers/` stays; tests next to source import it by relative path. Files in `test/`
may import any `src/` file; the module rules apply to `src/` only.

Move next to their file:

| Was `test/` | New |
|---|---|
| `password.test.ts` | `modules/users/password.util.test.ts` |
| `repositories.test.ts` | split by its two `describe` blocks: `modules/users/users.repository.test.ts`, `modules/invitations/invitations.repository.test.ts`; the shared setup moves to `test/helpers/repos.ts` (point 2) |
| `accept.test.ts` | `modules/invitations/invitations.routes.test.ts` |
| `accept-limit.test.ts` | `modules/invitations/acceptLimit.service.test.ts` |
| `login.test.ts`, `login-limit.test.ts` | `modules/auth/login.service.test.ts`, `loginLimit.service.test.ts` |
| `login-route.test.ts`, `refresh-route.test.ts`, `logout-route.test.ts`, `session-routes.test.ts` | `modules/auth/login.routes.test.ts`, `refresh.routes.test.ts`, `logout.routes.test.ts`, `sessionRestore.routes.test.ts` (point 2) |
| `sessions.test.ts`, `session-rotate.test.ts`, `session-revoke.test.ts` | `modules/auth/session/session.repository.test.ts`, `sessionRotate.repository.test.ts`, `sessionRevoke.repository.test.ts` (point 2) |
| `session-tokens.test.ts`, `session-revoker.test.ts` | `modules/auth/session/sessionTokens.service.test.ts`, `sessionRevoker.service.test.ts` |
| `health.test.ts` | `modules/health/health.routes.test.ts` (covers route and service) |
| `boot-owner.test.ts` | `modules/bootstrap/bootOwner.service.test.ts` |

## Choices (decided by the owner, 2026-11-19)

1. `test/login-flow.test.ts` and `test/refresh.test.ts` use `userModel` from users directly
   (block, delete and re-create a user), so they stay in `test/`. No lint exception for tests.
2. Some files have more than one test file. The name rule `<name>.<role>.test.ts` then uses
   the topic as `<name>` with the role of the file under test: `login.routes.test.ts`
   covers the login route in `auth.routes.ts`. `repositories.test.ts` covers two modules, so
   it is split in two; the shared setup goes to `test/helpers/repos.ts`, not copied.
3. Rule 4 (about 12 files per folder) counts source files only, not tests. Not checked by
   CI; reviewers apply it.
4. Extra imports allowed by rule 3:
   - module files may import `config.ts`, `common/`, `infra/` and `middleware/clientIp.ts`;
   - `common/failureCounter.ts` may import the `RedisClient` type from `infra/stores.ts`;
   - tests next to source may also import `app.ts`, `logger.ts` and `test/helpers/`;
   - no other module file imports `app.ts` or `server.ts` (lint).
5. MongoDB lint rule (A31), adapted: `mongoose` and `mongodb` are allowed only in
   `*.model.ts`, `*.repository.ts`, `infra/stores.ts` (the connection) and
   `common/storeErrors.ts` (Mongoose error classes); no other file in `src/`, tests included.
   A `*.model.js` file is imported only by `*.repository.ts`, another `*.model.ts` or its
   module's `index.ts` (`invitation.model.ts` takes `ROLES` from the users index).
6. Old finished plans: paths only, nothing else.
7. Found during the run: `require-access` and `startup-loop` tests mount
   `middleware/errorHandler.ts`, which rule 3 does not allow for module files; as in point
   1, they stay in `test/`. Tests next to source import `logger.ts` (to build the app), so
   lint allows `logger.ts` for tests only; no source file in a module imports it.

## Kept working

- `tsconfig.build.json`: add `"exclude": ["src/**/*.test.ts"]` so `dist/` holds no tests.
  `tsconfig.json` keeps `src` and `test`, so lint type-checks tests in both places.
- Vitest: today no config, so the default pattern runs. Add `vitest.config.ts` with
  `include: ['src/**/*.test.ts', 'test/**/*.test.ts']` so helpers and `dist/` never run.
- `scripts/ci/check-tests-exist.mjs`: no change; it finds `*.test.ts` anywhere in the
  service folder.
- `scripts/ci/check-file-size.mjs`: today matches `src/(routes|services)/`, which would match
  nothing after the move. New pattern: `src/modules/**/*.(routes|service).ts`, 500 lines;
  its sample in `checks.test.mjs` moves to `src/modules/users/users.routes.ts`.
- `test/route-paths.test.ts`: checks URL paths, not file paths; only its imports change.
- `openapi.yaml`: names no source file; no change.
- File paths in docs: `apps/server/auth-service/CLAUDE.md` (layout rewritten),
  `.claude/rules/express.md` (layout rule replaced), `docs/architecture.md` (one path),
  plans `009a`, `009b`, `012a`, `012b` (old paths changed to new ones), `CONTRIBUTING.md`
  and `.github/workflows/ci.yml` (new check). Specs name no auth-service file.

## Tasks

- [x] Task 1. Plan and decision
  This plan, D-012 in `docs/decisions.md`, the line in `docs/plans/README.md` and in
  `docs/roadmap.md`.
  Check: `git diff main --stat` lists only these four files.

- [x] Task 2. Build and test config for tests next to source
  `tsconfig.build.json` excludes `src/**/*.test.ts`; new `vitest.config.ts` with the include
  above.
  Check: build and lint pass; CI `npm test` runs the same number of test files as on `main`.

- [x] Task 3. common/, infra/ and the error handler
  `git mv` the six files to `common/` and `infra/`, `middleware/errors.ts` to
  `middleware/errorHandler.ts`; fix imports in `src/` and `test/`; the MongoDB lint rule
  also allows `infra/stores.ts` and `common/storeErrors.ts`.
  Check: build and lint pass; `git diff -M --stat main` shows 7 renames; CI tests pass.

- [x] Task 4. modules/users and modules/invitations
  `git mv` 8 source files and their tests (table above), split `repositories.test.ts`, add
  both `index.ts` files; other files import them through the index. The MongoDB lint rule
  also allows `src/modules/**/*.model.ts` and `*.repository.ts`.
  Check: build and lint pass; renames shown; CI tests pass, same test count as `main`.

- [x] Task 5. modules/auth/session
  `git mv` the 6 session files and 5 of their tests (`require-access` stays, point 7);
  imports follow. The auth index comes in Task 6, so `services/*` do not import it in between.
  Check: build and lint pass; renames shown; CI tests pass.

- [x] Task 6. modules/auth
  `git mv` the 6 auth files and their 6 tests (points 1 and 2); add `modules/auth/index.ts`
  with the router, services, session factories and constants; `app.ts` and `server.ts` use it.
  Check: build and lint pass; renames shown; CI tests pass.

- [x] Task 7. modules/health, internal and bootstrap
  `git mv` the 5 files and 2 tests (`startup-loop` stays, point 7); add the three
  `index.ts` files; `middleware/ready.ts`
  takes `Readiness` from the bootstrap index. `src/routes`, `services`, `repositories` and
  `models` are now gone.
  Check: build and lint pass; `ls src` shows only `app.ts config.ts logger.ts server.ts
  common infra middleware modules`; CI tests pass, same test count as `main`.

- [x] Task 8. Lint rules 2 and 3
  `no-restricted-imports` in `eslint.config.js`: routes never import a model or Mongoose;
  the MongoDB and model rules of point 5; a module imports another module only through its
  `index.ts`; `common/` and `infra/` import no module; `app.ts`, `server.ts` and
  `middleware/` import only module `index.ts` files; no module file imports `app.ts` or
  `server.ts`. Old `src/models/**` and `src/repositories/**` ignores removed.
  Check: lint passes on the branch; a trial import of `../users/users.repository.js` from
  `modules/auth/login.service.ts`, and of `./user.model.js` from a routes file, each make
  lint fail (tried locally, not committed).

- [x] Task 9. CI structure check and file-size pattern
  New `scripts/ci/check-structure.mjs`: for each `apps/server/*` with a `package.json`, fails
  when `src/routes`, `src/services`, `src/repositories` or `src/models` exists, or when a
  file under `src/modules/` other than `index.ts` does not match
  `<name>.<role>.ts` or `<name>.<role>.test.ts`, role in routes, service, repository,
  model, middleware, scripts, util. Tests in `scripts/ci/test/checks.test.mjs`: passes on
  the real repo; fails on a sample with `src/services/` and on a sample with
  `src/modules/users/helpers.ts`. `check-file-size.mjs` pattern and sample as above. Step in
  `.github/workflows/ci.yml` and the line in `CONTRIBUTING.md`.
  Check: CI `repo-checks` passes and runs check-structure; the new tests prove both
  failures and the pass on the real repo; a 501-line `users.routes.ts` sample fails the size
  check.

- [x] Task 10. Rules and docs
  `.claude/rules/express.md`: the layer layout line is replaced by rules 1 to 5 (with points
  3 and 4). `apps/server/auth-service/CLAUDE.md`: "Layout" rewritten for the new folders;
  every file path in it updated. Old paths updated in `docs/architecture.md` and plans
  `009a`, `009b`, `012a`, `012b`.
  Check: a search for `routes/`, `services/`, `repositories/`, `models/` followed by an
  auth-service file name, and for the old test file names, finds nothing in `docs/`,
  `.claude/`, or any `CLAUDE.md`.

- [x] Task 11. Close the issue
  Tick this plan and set `Status: done`; set its line in docs/plans/README.md to `done`;
  tick the line in docs/roadmap.md; point docs/handoff.md to the next issue (1.3)
  (/session-summary). Scan; when the user says so, push and open the PR. CI runs the full
  checks: read `gh pr checks` once, fix all red checks in one commit, push again.
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names 1.3;
  `git diff -M --stat main` shows renames for every moved file.

## Done when

1. `src/` has the target layout; no file under `src/routes`, `services`, `repositories`,
   `models` (Tasks 3 to 7, check-structure in Task 9).
2. No behaviour change: the same tests pass in CI as on `main`, with the same count; only
   imports and paths changed (Tasks 2 to 7).
3. Rules 2 and 3 enforced by lint (Task 8); names and old folders by CI (Task 9).
4. Rules written in `.claude/rules/express.md` and the auth-service `CLAUDE.md`; no doc
   names an old path (Task 10).
5. History follows: renames in `git diff -M --stat main` (every move task, Task 11).
