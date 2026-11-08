# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue: 0.2 Contracts folder (Sprint 1, Phase 0).
- Branch: `feature/contracts` (PR open, waiting for the user's review).
- Spec: [specs/002-contracts-folder.md](specs/002-contracts-folder.md)
- Plan: [plans/002-contracts-folder.md](plans/002-contracts-folder.md)

## Done

- Task 1. Branch, spec and plan: committed on `feature/contracts`.
- Task 2. Check tool and error codes: `cd contracts && npm ci && npm test` passes; status 200,
  BOM and bad JSON each fail with a one-line message. ajv pinned to 8.20.0 (8.17.1 had a
  moderate advisory); `npm audit` finds 0 vulnerabilities.
- Task 3. Other contract files and duplicate checks: 23 tests pass; the output lists all four
  files as valid; duplicate and lower-case names fail naming the entry.
- Task 4. Docs: `contracts/README.md`; CLAUDE.md, testing.md, architecture.md, CHANGELOG.md
  updated; D-003 added. A dummy code added by following the README passed, then was reverted.

## Next step: finish task 5 of plan 002, then issue 0.3

1. User reads the full diff of the PR from `feature/contracts` and merges it.
2. Then: tick task 5 in plan 002, mark plan 002 `done` in the index, tick 0.2 in the roadmap.
3. Next issue: 0.3 Local infra with Caddy (3 points), so start with `/write-spec`.
   Check for task 5: new session, ask "what is the next step?", answer matches this file.

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
