# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-11

## Now

- Issue #22 Spotless in the Java build and CI: done. Plan 008 tasks 1 to 4 done.
- Plan: [plans/008-spotless.md](plans/008-spotless.md)

## Done

- Spotless 3.10.4 with google-java-format 1.36.1 in the root `pom.xml` (1.37.0 does not run
  in Spotless 3.10.4). Java formatted once (`.git-blame-ignore-revs`); CI `java` job runs
  `spotless:check`. Phase 0 is done apart from 0.7b (Android, #25, later).

## Next step: Phase 1, issue 1.1 Users, first owner, password login

1. Merge the #22 PR. 1.1 has no GitHub issue yet: create it (estimate, Sprint 2).
2. Login is security, so spec first (`/write-spec 1.1`), then `/write-plan`.

## Known gaps

- Local RabbitMQ refuses the login from `.env`, so chat and ai health say Down locally. Fix
  `.env` or reset infra (`down -v`), then confirm three Up rows at `localhost:5173`.
- Java on Windows needs `-XX:-UseThreadPriorities` (set for `spring-boot:run`).
- `MONGODB_URI` set to an empty string fails in the MongoDB driver before the guard runs.
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
