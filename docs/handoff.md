# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-10

## Now

- Issue 0.6 CI pipeline (#7): done. Plan 006 tasks 1 to 7 done; 0.6 ticked.
- Plan: [plans/006-ci-pipeline.md](plans/006-ci-pipeline.md)

## Done

- `.github/workflows/ci.yml` on every PR to `main` and push to `main`: jobs `contracts`,
  `auth-service`, `java` (`./mvnw -B verify`, Testcontainers), `repo-checks`, `secrets`
  (gitleaks 8.30.1, full history), `env-leak`. Read-only, actions pinned by SHA.
- `scripts/ci/`: env names in `.env.example` and allowed hosts only, file-size limits,
  every service has tests; 7 script tests. Found and added `RABBITMQ_HOST`/`RABBITMQ_PORT`.
- `main` protected (D-007). `CONTRIBUTING.md` lists how to run each check locally.
- Follow-ups: #22 Spotless (Phase 0, before phase 1), #23 coverage ratchet.

## Next step: issue 0.7a Web skeleton (5 points, #8)

1. Merge the `chore/web-first` PR, then branch `feature/web-skeleton` from `main`.
2. Spec 007 (web only) is written: `/write-plan`, then code. The plan adds the `web` job
   to `ci.yml` and to the required checks (D-007), 7 in total. Then #22 Spotless.

## Known gaps

- Java on Windows needs `-XX:-UseThreadPriorities` (set for `spring-boot:run`; IDE run
  configs must add it).
- `MONGODB_URI` set to an empty string fails in the MongoDB driver before the guard runs
  (still exit 1, but the message is the driver's). Unset works as designed.
- Permission rules match command text only: `cat .env` through Bash is not blocked.
- Spring Boot 3.5 gets no free security fixes (owner decision, D-006).
- `CONTRIBUTING.md` loop step 2 still says "3+ points: spec" (rule is now 5+; tiny fix).

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
- `main` is protected: PR plus the seven CI jobs required, admins included, no force push or
  deletion (D-007). A renamed or new required job updates the rule in the same PR.
- Web first: the Android skeleton is issue #25 (0.7b), built later. Until then a client
  PR says 'Android: later, issue #25'.
- What a story needs: 5+ points, or an API, contract or security change: spec and plan.
  Security means login, permissions, data access or secrets handling in code. CI and repo
  settings do not count. 2 to 3 points, no contract change: "Done when" in the issue, short
  plan only. Tiny fix (one file or one rule): no spec, no plan; the issue and a PR.
  Estimates are 1, 2, 3, 5 or 8. A 4 means round up to 5.
