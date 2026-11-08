# Plan 003: Local infra with Caddy

Spec: docs/specs/003-local-infra.md
Branch: feature/local-infra
Rule: one task, one commit, one check. Stop after each task and show the check output.
Status: in progress.

## Global Constraints

- Branch: `feature/local-infra` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 003.` and the attribution line.
- Claude never reads or writes `.env`. The user adds `RABBITMQ_USER` and `RABBITMQ_PASSWORD`
  to `.env` by hand after Task 3 adds the names to `.env.example`.
- Image tags pinned to an exact version; every port bound to `127.0.0.1`. Files are LF.

## Tasks

- [x] Task 1. Spec, plan and index
  Commit spec 003, this plan, its line in `docs/plans/README.md` and the current
  `docs/handoff.md` on `feature/local-infra`.
  Check: `git log --oneline -1` shows the docs commit on `feature/local-infra`;
  `git status` is clean.

- [x] Task 2. `SERVICE_UNAVAILABLE` contract code
  Add `SERVICE_UNAVAILABLE` (503) with a description to `contracts/error-codes.json`; add it
  to the seed-code list in `contracts/test/error-codes.test.mjs`.
  Check: `cd contracts && npm ci && npm test` -> all tests pass, four files checked
  (Done when 7).

- [x] Task 3. MongoDB replica set in compose (riskiest part first)
  Create `infra/compose.yml` with MongoDB 8 only: pinned tag, `127.0.0.1:27017`, named
  volume, `--replSet rs0`, healthcheck that runs `rs.initiate` with member
  `localhost:27017` only when `rs.status()` fails. Add the RabbitMQ and service-port names
  to `.env.example` (no real values) so the user can fill `.env`.
  Check: `docker compose -f infra/compose.yml up -d --wait` -> exits 0;
  `docker compose -f infra/compose.yml exec mongo mongosh "mongodb://localhost:27017/?replicaSet=rs0" --eval "rs.status().ok"` -> `1`;
  insert a test document, `down` (no `-v`), `up -d --wait` again -> healthy, `rs.status().ok`
  is 1 and the document is still found (Done when 5).

- [x] Task 4. Redis, RabbitMQ, Qdrant and the store smoke check
  Add Redis, RabbitMQ with management, Qdrant to compose: pinned tags, `127.0.0.1` ports
  (6379, 5672, 15672, 6333), named volumes, healthchecks. RabbitMQ user and password via
  `${RABBITMQ_PASSWORD:?...}` so a missing value names the variable. Add `infra/smoke.mjs`
  (node, no dependencies): one line per store port, non-zero exit on any failure.
  Check: `docker compose --env-file .env -f infra/compose.yml up -d --wait` -> exits 0 and
  `ps` shows all healthy; `node infra/smoke.mjs` -> every store line passes; `docker compose
  -f infra/compose.yml stop redis` then `node infra/smoke.mjs` -> exits non-zero naming Redis;
  starting with `RABBITMQ_PASSWORD` unset (e.g. `--env-file .env.example`) -> fails with a
  message naming `RABBITMQ_PASSWORD`; `docker compose -f infra/compose.yml config` shows no
  `0.0.0.0` and no `latest` (Done when 1, 2, 6).

- [x] Task 5. Caddy, Caddyfile and the routing smoke checks
  Add Caddy (pinned, `127.0.0.1:8080`, healthcheck, `extra_hosts: host.docker.internal:host-gateway`)
  and `infra/Caddyfile`: block any `/internal` segment first (case-insensitive, after path
  cleaning) with 404 JSON; route `/api/auth/*`, `/api/chat/*`, `/api/ai/*` with prefix kept to
  `host.docker.internal` on env ports (defaults 3001, 8081, 8082); upstream down -> 503 JSON;
  anything else -> 404 JSON; every error with `Content-Type: application/json`. Extend
  `smoke.mjs` with the Caddy checks, including the path tricks from the spec. Update the
  routing block in `docs/architecture.md` (ports, error answers).
  Check: `node infra/smoke.mjs` -> all lines pass; `curl -i localhost:8080/api/auth/health`
  -> 503, `application/json`, `{"code":"SERVICE_UNAVAILABLE"}`; `curl -i` on `/internal/x`,
  `/api/auth/internal/x`, `/INTERNAL/x`, `/api/auth/./internal/x`, `/api/auth/%69nternal/x`,
  `/api/auth//internal/x` -> 404 `{"code":"NOT_FOUND"}`; to prove "never forwarded", start
  `node -e "require('http').createServer((q,s)=>{console.log('HIT',q.url);s.end('ok')}).listen(3001)"`
  and repeat the `/internal` requests -> still 404 and no `HIT` line, while
  `/api/auth/health` -> 200 `ok` (Done when 3, 4).

- [ ] Task 6. Docs
  Write `infra/README.md` (start, stop, reset with `down -v`, connection strings, port in use
  on Windows: `netstat -ano | findstr :8080`, how to change a port). Update
  `docs/environments.md` (local row real: ports, URLs, reset command), CLAUDE.md (folder map:
  `infra/` exists; commands: infra up, smoke check, reset), `docs/decisions.md` (D-004:
  services on the host behind Caddy, `/internal` blocked by segment, ports on `127.0.0.1`),
  and a line under `Unreleased` in `CHANGELOG.md`.
  Check: follow `infra/README.md` from scratch: `down -v`, start, `node infra/smoke.mjs`
  passes; `git diff main --stat` lists `.env.example`, environments.md, architecture.md,
  CLAUDE.md, decisions.md, CHANGELOG.md and `infra/README.md` (Done when 8).

- [ ] Task 7. Close the issue
  Run the full checks: `cd contracts && npm test`, `down` then `up -d --wait`,
  `node infra/smoke.mjs`. Tick this plan and set `Status: done`; set its line in
  docs/plans/README.md to `done`; tick 0.3 in docs/roadmap.md; point docs/handoff.md to issue
  0.4 (/session-summary). Scan, push, open the PR.
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names issue 0.4.

## Done when coverage

| Spec Done when | Task |
|---|---|
| 1. `up -d --wait` exits 0, all healthy | 4, 7 |
| 2. Smoke check: every store answers | 4, 7 |
| 3. `/api/auth/health` with no service -> 503 JSON | 5 |
| 4. `/internal` paths and tricks -> 404 JSON, not forwarded | 5 |
| 5. Second `up` after `down` keeps replica set and data | 3, 7 |
| 6. Missing `RABBITMQ_PASSWORD` names the variable | 4 |
| 7. Contracts test passes with `SERVICE_UNAVAILABLE` | 2, 7 |
| 8. Docs updated in the same PR | 3, 5, 6 |
