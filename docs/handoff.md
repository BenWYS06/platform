# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue 0.2 Contracts folder: done. PR #11 merged; plan 002 marked done; 0.2 ticked in the roadmap.
- Branch: `docs/one-pr-per-issue`: one PR per issue; the last plan task closes the plan,
  index, roadmap and handoff on the feature branch (rule in `.claude/rules/git-and-docs.md`).
- Next issue: 0.3 Local infra with Caddy (Sprint 1, Phase 0, 3 points).

## Done

- Plan 002, tasks 1 to 5: done. `cd contracts && npm ci && npm test`: 23 tests pass, all four
  contract files valid, 0 vulnerabilities.

## Next step: issue 0.3 Local infra with Caddy (3 points)

1. Merge this PR (`docs/one-pr-per-issue`).
2. Branch `feature/local-infra` from an updated `main`.
3. 3 points, so a spec is required: run `/write-spec` for issue 0.3, then `/write-plan`.
   Its last task is "Close the issue" (new rule); no separate closing PR.
   Scope from the docs: `infra/compose.yml` with MongoDB (replica set), Redis, RabbitMQ,
   Qdrant and Caddy; Caddy routes `/api/<service>` and `/ws`, and blocks `/internal` (D-002).

## Known gaps

- Permission rules match command text only: `cat .env` through Bash is not blocked. The
  protect hook is the second layer for edits.
- The contracts check is not in CI yet: issue 0.6.
- Services do not read `contracts/` yet: issues 0.4 and 0.5.

## Open questions for the user

- None.

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
