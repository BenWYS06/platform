---
name: session-summary
description: End-of-session update - tick finished tasks in the current plan, tick finished issues in docs/roadmap.md, update the plans index, and rewrite docs/handoff.md with what was done and the exact next step. Use when the user ends a session, says "wrap up", or a plan task is finished.
---

# session-summary

Job: leave the repo so that a new session can answer "what is the next step?" from
`docs/handoff.md` alone.

## Steps

1. **Collect facts, do not guess.**
   - `git status`, `git log --oneline main..HEAD`, current branch.
   - Current plan: from `docs/handoff.md`, or the plan in `docs/plans/README.md` marked
     in progress.
   - Which tasks were finished this session and whether their check passed. If unsure, ask.
2. **Plan.** Tick `- [x]` only tasks whose check passed and whose commit exists, or that
   are being finished now (the last task, "Close the issue"). When it is the last task, set
   the plan's `Status: done`.
3. **Plans index.** Update the status column in `docs/plans/README.md`:
   `not started`, `in progress (task N next)`, or `done`.
4. **Roadmap.** Tick the issue in `docs/roadmap.md` in the last plan task, on the feature
   branch, before the PR opens. Write `done`, never "merged" or a PR number, here, in the
   plan and in the plans index.
5. **Handoff after the last task.** "Now" says the issue is done; "Next step" is the next
   issue from the roadmap (merge this PR first, then branch and start it).
6. **Handoff.** Rewrite `docs/handoff.md` with the template below. Keep it under 60 lines.
   Move finished items out of "Open questions"; keep "Known gaps" that still apply.
7. **Show** the diff of the docs you changed. Commit only if the user asks
   (`docs: session summary`).

## Template

```markdown
# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: YYYY-MM-DD

## Now

- Issue: <number and title>
- Branch: `<branch>`
- Spec: [specs/NNN-name.md](specs/NNN-name.md)
- Plan: [plans/NNN-name.md](plans/NNN-name.md)

## Done

- Task N. <name>: <one line, with the check result>

## Next step: <task N or issue X.Y>

<what to do, and its check, copied from the plan>

## Known gaps

- <thing that is not right yet and where it will be fixed>

## Open questions for the user

- <question>
```
