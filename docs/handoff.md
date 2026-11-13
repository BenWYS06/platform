# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-13

## Now

- Issue #34 1.1a First owner: done. Plan 009a tasks 1 to 8 done.
- Plan: [plans/009a-first-owner.md](plans/009a-first-owner.md)

## Done

- auth-service: Mongoose repositories for users and invitations, indexes at startup with
  data routes on 503 until ready; the boot link for the first owner; token masking in logs;
  `POST /api/auth/invitations/<token>/accept-password`; the accept failure limit per client
  IP in Redis (429 with `Retry-After`). Error body `{ code, message?, params? }`.
- Web: messages for the five invitation error codes (en, vi).
- Checked through Caddy: accept gives 201, then 409; a restart prints no link.
- `.gitleaksignore`: one entry, the fake token of the first log-masking test commit.

## Next step: Phase 1, issue 1.1b Login (#35)

1. Merge the #34 PR.
2. Branch from `main`, then `/write-plan` for 1.1b from spec 009 part 1.1b (plan 009b).
3. After 1.1b: plan 011, Health with Actuator (#40).

## Known gaps

- The local `platform` database now holds a test owner (`owner@openbox.test`) from the
  Caddy run, so no boot link prints locally. Reset infra (`down -v`) to see it again.
- Local RabbitMQ refuses the login from `.env`, so chat and ai health say Down locally. Fix
  `.env` or reset infra (`down -v`), then confirm three Up rows at `localhost:5173`.
- Java on Windows needs `-XX:-UseThreadPriorities` (set for `spring-boot:run`).
- `MONGODB_URI` set to an empty string fails in the MongoDB driver before the guard runs.
- Vitest on Windows fails every suite ("failed to find the current suite") when the shell
  path starts with lowercase `d:`; run it from `D:/openbox/...`. CI (Linux) is not hit.
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
