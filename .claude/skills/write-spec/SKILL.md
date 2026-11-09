---
name: write-spec
description: Interview the user about a feature or issue and write docs/specs/NNN-name.md with Why, What we build, Out of scope, Edge cases and Done when. Use for a story of 5+ points or one that changes an API, a contract or security, or when the user says "write a spec".
---

# write-spec

Job: turn an idea or issue into a spec the user agrees with, before any plan or code.

When: a story of 5+ points, or one that changes an API, a contract or security. Security
means login, permissions, data access or secrets handling in code. CI and repo settings do
not count. A 2 to 3 point story with no contract change keeps its "Done when" in the issue
and gets only a short plan (`/write-plan`). A tiny fix (one file or one rule) needs neither.
Estimates are 1, 2, 3, 5 or 8. A 4 means round up to 5. If the story does not need a spec,
say so and stop.

## Steps

1. **Find the number.** List `docs/specs/`. The new spec is the highest `NNN` + 1, three digits.
   Name: `NNN-short-name.md`, lower case, words joined with `-`.
2. **Read context.** The issue text if given, `docs/roadmap.md`, `docs/architecture.md`,
   `docs/decisions.md`, and `contracts/` if it exists. Do not ask what these already answer.
3. **Interview.** Ask the user, a few questions at a time, only what you cannot find:
   - Who needs this and why now?
   - What exactly is built? What is the smallest version that is still useful?
   - What is explicitly not part of it (and which issue covers it instead)?
   - What can go wrong: bad input, no network, two users at once, Windows vs Linux?
   - How will we know it is done: what can be run, clicked or measured?
   Stop asking when every section below can be written without guessing.
4. **Write** `docs/specs/NNN-short-name.md` with the template below. Short sentences.
   Each "Done when" item must be checkable by running or opening something.
   "Must not happen" lists what would make the work wrong even if every Done when passes.
   In "Decisions", mark each choice `Owner` (the user chose it) or `Claude` (Claude chose it;
   the user can overrule it).
5. **Show** the spec and ask for changes. Edit until the user says it is right.
6. Do not write a plan or code in this skill. Suggest `/write-plan` as the next step.

## Template

```markdown
# Spec NNN: Title

Issue: <number and title>. Sprint <n>. Estimate <points>.

## Why

<who needs it and what breaks or is slow without it>

## What we build

1. <part>
   - <detail>

## Out of scope

- <thing>: <issue that covers it, or "not planned">

## Edge cases

- <case and the expected behavior>

## Must not happen

- <outcome that is never acceptable, for example a secret in a log or a route left open>

## Decisions

- <choice>: <what was chosen>. Owner | Claude

## Done when

1. <checkable result>
```
