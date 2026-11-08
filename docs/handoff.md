# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue: 0.3 Local infra with Caddy (Sprint 1, Phase 0, 3 points).
- Branch: `feature/local-infra` (from up-to-date `main`; no commits yet).
- Spec: [specs/003-local-infra.md](specs/003-local-infra.md) (written, agreed, not committed yet).
- Plan: [plans/003-local-infra.md](plans/003-local-infra.md) (agreed; tasks run one commit each).

## Done

- Spec 003 written with the user's answers: services run on the host behind Caddy
  (`host.docker.internal`), ports on `127.0.0.1` only, Caddy on 8080, RabbitMQ password from
  `.env`, Caddy errors as contract JSON with a new `SERVICE_UNAVAILABLE` code. It has the new
  "Must not happen" and "Decisions" sections.
- Working rules on `main`: one PR per issue, scope and 200-line rules, clean-code rules,
  git safety denies, `git push` asks first, Global Constraints in the plan template.

## Next step: `/write-plan` for spec 003

1. Run `/write-plan` on `docs/specs/003-local-infra.md`. Use the new template: Global
   Constraints block, last task "Close the issue".
2. Task 1 of the plan commits spec 003, the plan and the index line on `feature/local-infra`.
3. Before the infra tasks: the user copies `.env.example` to `.env` by hand and fills in
   `RABBITMQ_USER` and `RABBITMQ_PASSWORD` (Claude cannot read or write `.env`).
   Check: plan 003 exists, each spec "Done when" item maps to a task check.

## Known gaps

- Permission rules match command text only: `cat .env` through Bash is not blocked. The
  protect hook is the second layer for edits.
- The contracts check is not in CI yet: issue 0.6.
- Services do not read `contracts/` yet: issues 0.4 and 0.5.

## Open questions for the user

- Did `git push` show a confirmation prompt (ask rule)? If not, the ask rule has no effect
  in auto mode.

## Notes for later issues

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
- One PR per issue: the last plan task marks plan, index and roadmap `done` and points the
  handoff to the next issue, on the feature branch, before the PR opens.
