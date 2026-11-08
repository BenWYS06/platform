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
| `.github/` | PR and issue templates, CODEOWNERS (CI from issue 0.6) | exists |
| `contracts/` | shared error codes, capabilities, messaging, events | exists |
| `infra/` | `compose.yml`: MongoDB, Redis, RabbitMQ, Qdrant, Caddy | issue 0.3 |
| `services/auth-service/` | Express + TypeScript | issue 0.4 |
| `services/chat-service/` | Spring Boot, Java 21 | issue 0.4 |
| `services/ai-service/` | Spring Boot, Java 21 | issue 0.4 |
| `libs/platform-common-java/` | shared Java: errors, config guard, JWT filter | issue 0.5 |
| `clients/web/` | Vue 3 | issue 0.7 |
| `clients/android/` | Kotlin, Compose, Hilt | issue 0.7 |

Each service and client gets its own short CLAUDE.md when its folder is created.

## Commands

Placeholders until the code exists; update this table in the PR that adds each part.

| Task | Command |
|---|---|
| Contracts check | `cd contracts && npm ci && npm test` |
| Local infra up | `docker compose -f infra/compose.yml up -d` (issue 0.3) |
| auth-service | `cd services/auth-service && npm ci && npm test` (issue 0.4) |
| chat / ai service | `cd services/<name> && ./mvnw verify` (issue 0.4) |
| Web | `cd clients/web && npm ci && npm run build && npm test` (issue 0.7) |
| Android | `cd clients/android && ./gradlew testDevDebugUnitTest` (issue 0.7) |
| Test a hook | `echo '{"tool_input":{"file_path":".env"}}' \| bash .claude/hooks/protect-files.sh; echo $?` |

## How we work

- Work of 3+ points: spec first (`/write-spec`), then plan (`/write-plan`), then code.
- One plan task at a time. After each task: run its check, show the output, stop.
- One task, one commit. Commit and push only when the user says so.
- One PR per issue. The last plan task marks the plan, plans index and roadmap `done` and
  points `docs/handoff.md` to the next issue, on the feature branch, before the PR opens.
- Branch per issue (`feature/...`, `fix/...`, `chore/...`, `docs/...`); never commit to `main`.
- Docs change in the same PR as the code they describe.
- End a session with `/session-summary` so `docs/handoff.md` is current.

Details: `.claude/rules/git-and-docs.md`, `.claude/rules/testing.md`.

## Rules that matter every session

- Identity comes from the verified token, never from the request body or query.
- Secrets only in env; never read, edit, print or commit `.env` files or keys.
- Errors are `{ code, message? }` with codes from `contracts/error-codes.json`.
- Clients call the relative `/api` base URL; no service host or port in client code.
- Every bug fix comes with a test that failed before the fix.
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

## Where things are written down

- Next step: `docs/handoff.md`
- Phases and issues: `docs/roadmap.md`
- Why we chose X: `docs/decisions.md`
- How parts fit: `docs/architecture.md`
- Environments and config: `docs/environments.md`
- Plans: `docs/plans/README.md`
