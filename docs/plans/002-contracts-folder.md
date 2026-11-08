# Plan 002: Contracts folder

Spec: docs/specs/002-contracts-folder.md
Branch: feature/contracts
Rule: one task, one commit, one check. Stop after each task and show the check output.
Status: done (PR #11 merged).

- [x] Task 1. Branch, spec and plan
  Branch `feature/contracts` from an updated `main`. Commit spec 002, this plan and the
  plans index line.
  Check: `git log --oneline -1` shows the docs commit on `feature/contracts`;
  `git status` is clean.

- [x] Task 2. Check tool and error codes
  Add `contracts/package.json` (`ajv` as the only dev dependency, `npm test` runs `node --test`)
  and `package-lock.json`. Add a check module that reads a contract file, fails on a BOM or bad
  JSON with the file name and no stack trace, and validates it against its schema.
  Add `schemas/error-codes.schema.json` (UPPER_SNAKE code, integer status 400 to 599, required
  fields, no extra fields) and `error-codes.json` with the seven seed codes. Tests use temp
  copies, never the real files.
  Check: `cd contracts && npm ci && npm test` -> passes; tests for status 200, a BOM file and
  bad JSON each fail the check with a readable message (Done when 4, 5).

- [x] Task 3. Other contract files and duplicate checks
  Add schemas and empty-list files for `capabilities.json`, `messaging.json` (kind enum, lower
  dotted `value`) and `events.json` (integer `version` from 1). Add the duplicate rules: no
  repeated `code`/`name` in a file, no repeated `value` in messaging.json; the error names both
  entries. The run prints each of the four files as checked.
  Check: `cd contracts && npm test` -> passes, output lists all four files; tests for a
  duplicate code and a lower-case name fail the check naming the entry (Done when 1, 2, 3).

- [x] Task 4. Docs
  Write `contracts/README.md` (purpose of each file, entry shapes, how to add a name in the PR
  that first uses it, how to run the check). Update CLAUDE.md (folder map: `contracts/`
  exists; commands: contracts check), testing.md (helper row points to `contracts/`),
  architecture.md if the contracts line needs it, and add D-003 to decisions.md (UPPER_SNAKE
  names, HTTP status kept in error codes).
  Check: open `contracts/README.md` and follow "how to add a name" to add a dummy code
  locally, `npm test` passes, then revert it; `git diff main --stat` shows CLAUDE.md,
  testing.md and decisions.md changed (Done when 6, 7).

- [x] Task 5. Final check and handoff
  Run `cd contracts && npm ci && npm test` once more. Run /session-summary. Before pushing, run
  the forbidden-names and `.env`/key scan; push only if it is empty. Open the PR with the
  template filled in. User reads the full diff and merges the PR.
  Check: new session, ask "what is the next step?", answer matches docs/handoff.md.

## Done when coverage

| Spec Done when | Task |
|---|---|
| 1. `npm ci && npm test` passes, four files checked | 3, 5 |
| 2. Duplicate code fails | 3 |
| 3. Lower-case name fails | 3 |
| 4. Status 200 fails | 2 |
| 5. BOM fails readably | 2 |
| 6. README explains adding a name | 4 |
| 7. CLAUDE.md, testing.md, decisions.md updated | 4 |
