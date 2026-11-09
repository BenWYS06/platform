# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-09

## Now

- Issue 0.5 platform-common-java library (#6): done. Plan 005 tasks 1 to 7 done; 0.5 ticked.
- Spec: [specs/005-platform-common-java.md](specs/005-platform-common-java.md)
- Plan: [plans/005-platform-common-java.md](plans/005-platform-common-java.md)

## Done

- Root `pom.xml` and one `./mvnw` build library, chat and ai in order; service wrappers gone.
- `libs/platform-common-java`: errors, production guard (per-service prod variables),
  request id, Spring Security chain (health public, `/internal` by key, other `/api` 401 via
  a JWT stub), contract JSON for 401/403/400. 30 library tests; 7 per service.
- End to end: smoke `--services` 23/23; closed routes 401 with no cookie or
  `WWW-Authenticate`; no generated password; prod without key or `MONGODB_URI` exits 1.

## Next step: issue 0.6 CI pipeline (3 points, #7)

1. Branch `feature/ci-pipeline` from an updated `main`.
2. 3 points, CI and repo settings only (not security by the rule in "Settled"): "Done when"
   in issue #7 and a short plan (`/write-plan` from the issue). Workflow: contracts, root
   `./mvnw verify` with Docker for Testcontainers, auth build/lint/test, gitleaks, env-leak
   check.

## Known gaps

- Java on Windows needs `-XX:-UseThreadPriorities` (set for `spring-boot:run`; IDE run
  configs must add it).
- `MONGODB_URI` set to an empty string fails in the MongoDB driver before the guard runs
  (still exit 1, but the message is the driver's). Unset works as designed.
- Permission rules match command text only: `cat .env` through Bash is not blocked.
- Builds and checks are not in CI yet: issue 0.6.
- Spring Boot 3.5 gets no free security fixes (owner decision, D-006).

## Open questions for the user

- Did `git push` show a confirmation prompt (ask rule)? If not, the ask rule has no effect
  in auto mode.

## Settled

- Repo is public. Before every push: scan for the forbidden names (list kept outside the
  repo) and for `.env` files and keys; push only if the scan is empty.
- Contract names UPPER_SNAKE, codes carry their status (D-003). Local dev: services on the
  host behind Caddy, `/internal` blocked by segment (D-004). Skeletons: D-005. Root Maven
  build, Java APIs closed by default, stay on Boot 3.5: D-006.
- One PR per issue: the last plan task marks plan, index and roadmap `done` and points the
  handoff to the next issue, on the feature branch, before the PR opens. PR body: `Closes #n`.
- `main` is protected: PR plus the six CI jobs required, admins included, no force push or
  deletion (D-007). A renamed or new required job updates the rule in the same PR.
- What a story needs: 5+ points, or an API, contract or security change: spec and plan.
  Security means login, permissions, data access or secrets handling in code. CI and repo
  settings do not count. 2 to 3 points, no contract change: "Done when" in the issue, short
  plan only. Tiny fix (one file or one rule): no spec, no plan; the issue and a PR.
  Estimates are 1, 2, 3, 5 or 8. A 4 means round up to 5.
