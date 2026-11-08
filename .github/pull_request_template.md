<!-- Job: the checklist every PR fills in before review. -->

## What and why

Issue: #
Spec: docs/specs/NNN-name.md
Plan: docs/plans/NNN-name.md

<one or two sentences: what changes and why>

## Done when

<!-- Copy the "Done when" list from the spec. Tick each item and show how it was checked. -->

- [ ] 1.

## Tests

- [ ] New or changed code has tests (see `.claude/rules/testing.md`)
- [ ] Bug fix: a regression test that failed before the fix
- [ ] Ran locally; output:

```
<paste test or check output>
```

## Security (for a new or changed endpoint)

- [ ] Went through the checklist in `.claude/rules/security.md`, or not an endpoint change

## Docs

- [ ] Docs updated in this PR (architecture, environments, `.env.example`, OpenAPI, README), or nothing to update
- [ ] `CHANGELOG.md` under Unreleased, if users see the change
- [ ] Decision added to `docs/decisions.md`, if hard to reverse

## Handoff

- [ ] Plan ticked and `docs/handoff.md` updated (`/session-summary`)
- [ ] I have read the full diff
