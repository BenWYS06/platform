# OpenBox platform

Job: what Claude needs at the start of every session in this repo. Keep under 200 lines.

## What this is

A chat platform with AI features: an auth service, a chat service, an AI service, a web
client and an Android client, behind one address (Caddy).
Phase 0 (Sprint 1) is in progress: most folders below do not exist yet.

## Start here

1. Read `docs/handoff.md`: where the last session stopped and the next step.
2. Open the plan it points to (index: `docs/plans/README.md`) and do that step only.
3. Asked "what is the next step?": answer from `docs/handoff.md`.

## Folder map

| Path | What | Status |
|---|---|---|
| `docs/` | handoff, roadmap, decisions, architecture, environments | exists |
| `docs/specs/`, `docs/plans/` | one spec and one plan per issue, same number | exists |
| `.claude/` | settings, hooks, rules, skills | exists |
| `.github/` | PR and issue templates, CODEOWNERS, CI (`workflows/ci.yml`) | exists |
| `contracts/` | shared error codes, capabilities, messaging, events | exists |
| `infra/docker-compose/` | `compose.yml`: MongoDB, Redis, RabbitMQ, Qdrant, Caddy; `Caddyfile`; `smoke.mjs` | exists |
| `scripts/ci/` | repo checks run by CI (env names and hosts, file sizes, tests per service) | exists |
| `apps/server/auth-service/` | Express + TypeScript | exists |
| `apps/server/chat-service/` | Spring Boot, Java 21 | exists |
| `apps/server/ai-service/` | Spring Boot, Java 21 | exists |
| `packages/platform-common-java/` | shared Java: errors, config guard, security chain, JWT stub | exists |
| `apps/web/` | Vue 3, Vite, Tailwind v4 (issue 0.7a) | exists |
| `apps/client/` | Android: Kotlin, Compose, Hilt | issue 0.7b (#25), later |

Each service and client gets its own short CLAUDE.md when its folder is created.

## Commands

Placeholders until the code exists; update this table in the PR that adds each part.

| Task | Command |
|---|---|
| Contracts check | `cd contracts && npm ci && npm test` |
| Local infra up | `docker compose --env-file .env -f infra/docker-compose/compose.yml up -d --wait` |
| Local infra check | `node infra/docker-compose/smoke.mjs` (`--services`: all three must answer 200) |
| Local infra reset (deletes data) | `docker compose --env-file .env -f infra/docker-compose/compose.yml down -v` |
| auth-service | `cd apps/server/auth-service && npm ci && npm run build && npm run lint && npm test` |
| Java build, all parts (Docker running) | `./mvnw verify` (repo root) |
| One Java service | `./mvnw -pl apps/server/<name> -am verify` |
| Java format check / fix | `./mvnw spotless:check` / `./mvnw spotless:apply` (google-java-format) |
| Run a service locally | auth: `npm run dev`; chat / ai: `./mvnw -pl apps/server/<name> -am spring-boot:run` |
| Web | `cd apps/web && npm ci && npm run lint && npm run build && npm test`; dev: `npm run dev` |
| Android | `cd apps/client && ./gradlew testDevDebugUnitTest` (issue 0.7b, later) |
| CI checks locally | see "Run the CI checks locally" in `CONTRIBUTING.md` |
| Test a hook | `echo '{"tool_input":{"file_path":".env"}}' \| bash .claude/hooks/protect-files.sh; echo $?` |

## How we work

- 5+ points, or a change to an API, a contract or security: spec (`/write-spec`), then plan
  (`/write-plan`), then code. Security means login, permissions, data access or secrets
  handling in code. CI and repo settings do not count.
- 2 to 3 points with no contract change: the "Done when" list lives in the issue; short plan
  only (`/write-plan` from the issue).
- Tiny fix (one file or one rule): no spec, no plan; just the issue and a PR.
- Estimates are 1, 2, 3, 5 or 8. A 4 means round up to 5.
- One plan task at a time. After each task: run its check, show the output, stop.
- When a task's check passes, tick it in the plan and put that change in the same commit
  as the task.
- One task, one commit. Commit and push only when the user says so.
- One PR per issue. The last plan task marks the plan, plans index and roadmap `done` and
  points `docs/handoff.md` to the next issue, on the feature branch, before the PR opens.
- Branch per issue (`feature/...`, `fix/...`, `chore/...`, `docs/...`); never commit to `main`.
- Docs change in the same PR as the code they describe.
- Exception for now: web first. The Android skeleton is issue #25, built later. Until
  then a client PR says 'Android: later, issue #25'. Remove this line when issue
  #25 is done.
- End a session with `/session-summary` so `docs/handoff.md` is current.

Details: `.claude/rules/git-and-docs.md`, `.claude/rules/testing.md`.

## Rules that matter every session

- Identity comes from the verified token, never from the request body or query.
- Secrets only in env; never read, edit, print or commit `.env` files or keys.
- Errors are `{ code, message? }` with codes from `contracts/error-codes.json`.
- Clients call the relative `/api` base URL; no service host or port in client code.
- Every bug fix comes with a test that failed before the fix.
- Only change what the task needs. Outside the task, do not fix, rename or reformat: write an
  issue and tell the user.
- If one task's diff goes past about 200 lines (not tests), stop and ask.
- Never force push, never `--no-verify`, never `rm -rf`. Do not work around a deny rule or
  a blocking hook: stop and tell the user.

Details: `.claude/rules/security.md`. Stack rules load by path from `.claude/rules/`.

## Known gotchas

- Windows + Git Bash. Hooks parse JSON with `node`, not `jq` (not installed).
- `.gitattributes` forces LF; keep shell scripts LF or Git Bash breaks on them.
- A deny rule on `.env` reads also blocks writes to `.env`: edit env files by hand.
- Permission rules match command text only; they are a guard, not a sandbox.
- The format hook does nothing until formatters (prettier etc.) are installed per project.
- Keep text files UTF-8. PowerShell `echo >>` writes UTF-16; use the editor or Git Bash.
- Java services on Windows need `-XX:-UseThreadPriorities` (set for `spring-boot:run`),
  or the JVM stalls for seconds on a busy machine. See the service CLAUDE.md.
- Services read the repo `.env` at startup (Spring `spring.config.import`, Node
  `--env-file-if-exists`); Claude still never reads or edits it.

## Where things are written down

- Next step: `docs/handoff.md`
- Phases and issues: `docs/roadmap.md`
- Why we chose X: `docs/decisions.md`
- How parts fit: `docs/architecture.md`
- Environments and config: `docs/environments.md`
- Plans: `docs/plans/README.md`
