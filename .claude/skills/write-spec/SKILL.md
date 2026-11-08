---
name: write-spec
description: Interview the user about a feature or issue and write docs/specs/NNN-name.md with Why, What we build, Out of scope, Edge cases and Done when. Use before planning any work of 3+ points, or when the user says "write a spec".
---

# write-spec

Job: turn an idea or issue into a spec the user agrees with, before any plan or code.

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
