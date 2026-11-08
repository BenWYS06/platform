# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue 0.1 Repo and harness: done. PR #9 merged; plan 001 marked done; 0.1 ticked in the roadmap.
- Branch: `docs/close-plan-001` (this closing PR).
- Next issue: 0.2 Contracts folder (Sprint 1, Phase 0).

## Done

- Plan 001, tasks 1 to 11: done. Tasks 9 and 11 closed by the user after PR #9 merged.
- User checks: `/memory` lists the 7 rules with stack rules path-scoped (task 6);
  `/write-spec` ran on a dummy idea (task 8).

## Next step: issue 0.2 Contracts folder (2 points)

1. Merge this PR (`docs/close-plan-001`).
2. Branch `feature/contracts` from an updated `main`.
3. Under 3 points, so no spec or plan is required; ask the user whether they want one anyway.

## Known gaps

- Permission rules match command text only: `cat .env` through Bash is not blocked. The
  protect hook (task 4) is the second layer for edits.

## Open questions for the user

- None.

## Notes for later issues

- 0.6: on GitHub Free, branch protection applies only to public repos. This repo is public,
  so protect `main` once CI exists.

## Settled

- Repo is public (user's decision). Before every push: scan for the forbidden names (list
  kept outside the repo) and for `.env` files and keys; push only if the scan is empty.
- The old README title in commit `de681e5` on main stays: rewriting main is riskier.
- Roadmap phases 1 to 6 filled from the user's Build plan.
- No LICENSE for now; easy to add later.
- Express rules: argon2 only for passwords; the log library is chosen in issue 0.4.
