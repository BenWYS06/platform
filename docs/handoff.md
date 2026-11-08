# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue 0.3 Local infra with Caddy: done. Plan 003 tasks 1 to 7 done; 0.3 ticked in the roadmap.
- Branch: `feature/local-infra`, PR open for the user to read and merge.
- Spec: [specs/003-local-infra.md](specs/003-local-infra.md)
- Plan: [plans/003-local-infra.md](plans/003-local-infra.md)

## Done

- `infra/compose.yml`: MongoDB 8 replica set `rs0`, Redis, RabbitMQ, Qdrant, Caddy; pinned
  tags, ports on `127.0.0.1`, healthchecks, named volumes. Missing RabbitMQ variables stop
  compose with a message naming them.
- `infra/Caddyfile`: `/api/auth|chat|ai/*` to the host on 3001/8081/8082; any `internal`
  segment (any case, encoded, `;x`, `%09`) gives 404 and is never forwarded; service down 503.
- `infra/smoke.mjs`: 17 checks, all pass. `contracts` 23 tests pass (`SERVICE_UNAVAILABLE`).
- Data and replica set survive `down` / `up`; host clients connect with `replicaSet=rs0`.
- Docs: `infra/README.md`, environments, architecture, CLAUDE.md, CHANGELOG, D-004.

## Next step: issue 0.4 Service skeletons: auth, chat, ai (5 points)

1. The user adds `RABBITMQ_USER` and `RABBITMQ_PASSWORD` to `.env` by hand (still missing),
   then `docker compose --env-file .env -f infra/compose.yml up -d --wait` and
   `node infra/smoke.mjs`.
2. Merge the 0.3 PR, branch `feature/service-skeletons` from an updated `main`.
3. 5 points: `/write-spec` for issue 0.4, then `/write-plan`.

## Known gaps

- Permission rules match command text only: `cat .env` through Bash is not blocked. The
  protect hook is the second layer for edits.
- The contracts and smoke checks are not in CI yet: issue 0.6.
- Services do not read `contracts/` yet: issues 0.4 and 0.5.
- `smoke.mjs` expects no service running (`/api/auth/health` must be 503); adjust it when
  services exist.

## Open questions for the user

- Did `git push` show a confirmation prompt (ask rule)? If not, the ask rule has no effect
  in auto mode.

## Notes for later issues

- 0.4: services listen on 3001 (auth), 8081 (chat), 8082 (ai) on the host; Caddy keeps the
  prefix, so routes live under `/api/<service>/...`. Mongo URI
  `mongodb://localhost:27017/?replicaSet=rs0`. `/internal` routes still check `X-Internal-Key`.
- 0.6: on GitHub Free, branch protection applies only to public repos. This repo is public,
  so protect `main` once CI exists. CI runs `cd contracts && npm ci && npm test`.

## Settled

- Repo is public (user's decision). Before every push: scan for the forbidden names (list
  kept outside the repo) and for `.env` files and keys; push only if the scan is empty.
- The old README title in commit `de681e5` on main stays: rewriting main is riskier.
- Roadmap phases 1 to 6 filled from the user's Build plan.
- No LICENSE for now; easy to add later.
- Express rules: argon2 only for passwords; the log library is chosen in issue 0.4.
- Contract names are UPPER_SNAKE; error codes carry their HTTP status (D-003).
- Local dev: services on the host behind Caddy, `/internal` blocked by segment (D-004).
- One PR per issue: the last plan task marks plan, index and roadmap `done` and points the
  handoff to the next issue, on the feature branch, before the PR opens.
