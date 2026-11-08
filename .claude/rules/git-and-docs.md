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
- Commit only when the user asks or the plan says so. Never commit `.env` files or keys.

## Never

- `git push --force` in any form, `git reset --hard` on shared branches, rewriting pushed
  history. Settings deny force push; do not look for another way.
- Skipping hooks (`--no-verify`).

## PR flow

1. Spec (`docs/specs/NNN-*.md`) and plan (`docs/plans/NNN-*.md`) exist for work of 3+ points.
2. Work task by task; stop after each task and show the check output.
3. The last plan task closes the issue on the feature branch, before the PR opens: tick the
   plan and mark it `done`, set its line in `docs/plans/README.md` to `done`, tick the issue
   in `docs/roadmap.md`, and point `docs/handoff.md` to the next issue. Write `done`, never
   "merged" or a PR number. Merging is not a plan task.
4. Scan before every push, then push the branch and open a PR with the template filled in:
   spec link, Done when, tests, docs, handoff.
5. CI green (from issue 0.6), the user reads the full diff, the user merges.
6. One PR per issue. No follow-up PR just to close the plan or tick the roadmap.

## Docs in the same PR

- A change to behavior, API, env variables, setup or architecture updates the matching doc
  in the same PR: `docs/architecture.md`, `docs/environments.md`, `.env.example`, the OpenAPI
  file, README.
- A hard-to-reverse choice gets an entry in `docs/decisions.md`.
- Every session ends with `docs/handoff.md` updated (use `/session-summary`).
- User-visible changes get a line under `Unreleased` in `CHANGELOG.md`.
