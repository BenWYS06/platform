---
name: write-plan
description: Turn an agreed spec in docs/specs/ into docs/plans/NNN-name.md - small ordered tasks, each with its own check and one commit. Use after /write-spec, or when the user says "write a plan" for a spec.
---

# write-plan

Job: split a spec into tasks small enough that each one is built, checked and committed alone.

## Steps

1. **Pick the spec.** Use the one the user names, or the newest in `docs/specs/`. The plan
   takes the same `NNN` and name: `docs/plans/NNN-short-name.md`.
2. **Read** the spec, `CLAUDE.md`, the matching `.claude/rules/` files and the code it touches.
3. **Split** "What we build" into tasks:
   - One task = one commit, about 15 to 60 minutes of work.
   - Each task has a **Check**: a command to run or a thing to open, with the expected result.
     "Looks good" is not a check.
   - Order: things others depend on first; risky or unknown parts early.
   - Tests go in the same task as the code they test.
   - Docs updates go in the task that changes the behavior.
   - The last task is always "Final check and handoff" (run `/session-summary`, user reads
     the diff, PR merged).
4. Every "Done when" item of the spec must be covered by at least one task's check. Say which.
5. **Write** the plan with the template below and add a line to `docs/plans/README.md`.
6. **Show** the plan and ask for changes. Do not start Task 1 until the user says so.

## Template

```markdown
# Plan NNN: Title

Spec: docs/specs/NNN-short-name.md
Branch: feature/<short-name>
Rule: one task, one commit, one check. Stop after each task and show the check output.

- [ ] Task 1. <name>
  <what to do, in one to three lines>
  Check: <command or action> -> <expected result>.

- [ ] Task N. Final check and handoff
  Run /session-summary. User reads the full diff and merges the PR.
  Check: new session, ask "what is the next step?", answer matches docs/handoff.md.
```

## Index line

```markdown
| NNN | [Title](NNN-short-name.md) | [spec](../specs/NNN-short-name.md) | <issue> | not started |
```
