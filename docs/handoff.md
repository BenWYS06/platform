# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue: 0.1 Repo and harness (Sprint 1, Phase 0)
- Branch: `feature/repo-harness`, pushed; PR #9 open (https://github.com/BenWYS06/platform/pull/9)
- Spec: [specs/001-repo-and-harness.md](specs/001-repo-and-harness.md)
- Plan: [plans/001-repo-and-harness.md](plans/001-repo-and-harness.md)

## Done

- Tasks 1 to 8 and 10: done, each check passed (details in the plan and in the PR #9 body).
- Task 9 (files and PR). `.github/` templates and CODEOWNERS committed; branch pushed, PR #9
  opened with the template filled in by hand. Templates only show on GitHub after merge.
- Task 11 (summary part). `/session-summary` run: plan, plans index and this file updated.

## Next step: finish issue 0.1, then issue 0.2

1. Task 11 check: in a new session ask "what is the next step?"; the answer matches this file.
2. User reads the full diff of PR #9 and merges it.
3. Task 9 check, after merge: new PR shows the template; "New issue" shows bug and feature.
4. Then tick tasks 9 and 11 in the plan, mark plan 001 `done`, tick 0.1 in `docs/roadmap.md`.
5. Issue 0.2 Contracts folder (2 points): branch `feature/contracts` from an updated `main`.
   Under 3 points, so no spec or plan is required; ask the user whether they want one anyway.

## Checks the user still has to run

- `/memory`: 7 rules listed, stack rules path-scoped (task 6).
- `/`: write-spec, write-plan, session-summary listed; try write-spec on a dummy idea (task 8).

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
