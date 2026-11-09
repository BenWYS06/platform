---
name: write-plan
description: Turn an agreed spec in docs/specs/, or the "Done when" list of a 2 to 3 point issue, into docs/plans/NNN-name.md - small ordered tasks, each with its own check and one commit. Use after /write-spec, for a 2 to 3 point issue with no contract change, or when the user says "write a plan".
---

# write-plan

Job: split a spec, or an issue's "Done when" list, into tasks small enough that each one is
built, checked and committed alone. A tiny fix (one file or one rule) needs no plan.

## Steps

1. **Pick the source.**
   - 5+ points, or a change to an API, a contract or security: the spec the user names, or
     the newest in `docs/specs/`. The plan takes the same `NNN` and name. Security means
     login, permissions, data access or secrets handling in code. CI and repo settings do
     not count.
   - 2 to 3 points with no contract change: the issue; its "Done when" list is the source.
     Write a short plan with the next free `NNN`.
   - Estimates are 1, 2, 3, 5 or 8. A 4 means round up to 5.
   Name: `docs/plans/NNN-short-name.md`.
   NNN is the next free number across docs/specs and docs/plans, so a spec and its plan
   share a number and a short plan never reuses one.
2. **Read** the spec or issue, `CLAUDE.md`, the matching `.claude/rules/` files and the code
   it touches.
3. **Split** "What we build" (or the issue's "Done when") into tasks:
   - One task = one commit, about 15 to 60 minutes of work.
   - Each task has a **Check**: a command to run or a thing to open, with the expected result.
     "Looks good" is not a check.
   - Order: things others depend on first; risky or unknown parts early.
   - Tests go in the same task as the code they test.
   - Docs updates go in the task that changes the behavior.
   - The last task is always "Close the issue": on the feature branch, before the PR opens,
     run the full checks, tick the plan and mark it `done`, set the plans index line to
     `done`, tick the issue in `docs/roadmap.md`, and point `docs/handoff.md` to the next
     issue. Write `done`, never "merged" or a PR number. Merging is not a task: the user
     merges after reading the diff. One PR per issue; no follow-up PR to close the plan.
4. Every "Done when" item of the spec or issue must be covered by at least one task's check.
   Say which.
5. **Write** the plan with the template below and add a line to `docs/plans/README.md`.
6. **Show** the plan and ask for changes. Do not start Task 1 until the user says so.

## Template

```markdown
# Plan NNN: Title

Spec: docs/specs/NNN-short-name.md   (short plan: Issue: #n, its "Done when" list)
Branch: feature/<short-name>
Rule: one task, one commit, one check. Stop after each task and show the check output.

## Global Constraints

- Branch: `feature/<short-name>` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan NNN.` and the attribution line.

## Tasks

- [ ] Task 1. <name>
  <what to do, in one to three lines>
  Check: <command or action> -> <expected result>.

- [ ] Task N. Close the issue
  Run the full checks. Tick this plan and set `Status: done`; set its line in
  docs/plans/README.md to `done`; tick the issue in docs/roadmap.md; point docs/handoff.md
  to the next issue (/session-summary). Scan, push, open the PR.
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names the next issue.
```

## Index line

```markdown
| NNN | [Title](NNN-short-name.md) | [spec](../specs/NNN-short-name.md) | <issue> | not started |
```
