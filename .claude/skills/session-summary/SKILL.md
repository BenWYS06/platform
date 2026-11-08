---
name: session-summary
description: End-of-session update - tick finished tasks in the current plan, tick merged issues in docs/roadmap.md, update the plans index, and rewrite docs/handoff.md with what was done and the exact next step. Use when the user ends a session, says "wrap up", or a plan task is finished.
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
2. **Plan.** Tick `- [x]` only tasks whose check passed and whose commit exists.
3. **Plans index.** Update the status column in `docs/plans/README.md`:
   `not started`, `in progress (task N next)`, or `done`.
4. **Roadmap.** Tick an issue in `docs/roadmap.md` only when its PR is merged into `main`.
5. **Handoff.** Rewrite `docs/handoff.md` with the template below. Keep it under 60 lines.
   Move finished items out of "Open questions"; keep "Known gaps" that still apply.
6. **Show** the diff of the docs you changed. Commit only if the user asks
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
