# Git and docs rules

Job: how work moves from a branch to main, and how docs stay true. Loaded every session.

## Branches

- Never commit to `main`. Branch from an up-to-date `main`.
- Names: `feature/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `docs/<short-name>`.
  Lower case, words joined with `-`.

## Commits

- Conventional Commits: `type: summary` in the imperative, under 72 characters.
  Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`.
- One plan task, one commit. The body says which task: `Task 3 of plan 001.`
- When a task's check passes, tick it (`- [x]`) in the plan and put that change in the same
  commit as the task. No separate commit for ticks.
- Commit only when the user asks or the plan says so. Never commit `.env` files or keys.

## Never

- `git push --force` in any form, `git reset --hard` on shared branches, rewriting pushed
  history. Settings deny force push; do not look for another way.
- Skipping hooks (`--no-verify`).

## PR flow

1. What a story needs before code:
   - 5+ points, or a change to an API, a contract or security: spec (`docs/specs/NNN-*.md`)
     and plan (`docs/plans/NNN-*.md`). Security means login, permissions, data access or
     secrets handling in code. CI and repo settings do not count.
   - 2 to 3 points with no contract change: "Done when" in the issue, and a short plan.
   - Tiny fix (one file or one rule): no spec, no plan; the issue and a PR.
   - Estimates are 1, 2, 3, 5 or 8. A 4 means round up to 5.
2. Work task by task; stop after each task and show the check output.
3. The last plan task closes the issue on the feature branch, before the PR opens: tick the
   plan and mark it `done`, set its line in `docs/plans/README.md` to `done`, tick the issue
   in `docs/roadmap.md`, and point `docs/handoff.md` to the next issue. Write `done`, never
   "merged" or a PR number. Merging is not a plan task.
4. Scan before every push, then push the branch and open a PR with the template filled in:
   spec link, if there is one, Done when, tests, docs, handoff.
5. CI green (from issue 0.6), the user reads the full diff, the user merges.
6. One PR per issue. No follow-up PR just to close the plan or tick the roadmap.

Exception for now: web first. The Android skeleton is issue #25, built later. Until
then a client PR says 'Android: later, issue #25'. Remove this line when issue
#25 is done.

## Docs in the same PR

- A change to behavior, API, env variables, setup or architecture updates the matching doc
  in the same PR: `docs/architecture.md`, `docs/environments.md`, `.env.example`, the OpenAPI
  file, README.
- A hard-to-reverse choice gets an entry in `docs/decisions.md`.
- Every session ends with `docs/handoff.md` updated (use `/session-summary`).
- User-visible changes get a line under `Unreleased` in `CHANGELOG.md`.
