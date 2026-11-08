# Spec 002: Contracts folder

Issue: 0.2 Contracts folder. Sprint 1. Estimate 2.

## Why

Three services and two clients must agree on the same names: error codes, capabilities,
RabbitMQ names and event names. Without one shared source, each part types its own strings,
and a typo shows up only at run time, across a service boundary. The rules already point to
`contracts/error-codes.json` and `contracts/messaging.json`, and testing.md expects a contract
test helper from this issue. Issues 0.4 and 0.5 need the generic error codes before they can
write their error handlers.

## What we build

1. `contracts/error-codes.json`
   - A list of entries `{ "code", "status", "description" }`.
   - `code`: UPPER_SNAKE. `status`: HTTP status, 400 to 599. `description`: one sentence.
   - Seed codes only: `VALIDATION_FAILED` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403),
     `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500).
2. `contracts/capabilities.json`
   - A list of entries `{ "name", "description" }`. `name`: UPPER_SNAKE.
   - Empty list. Issue 1.3 adds the first capabilities.
3. `contracts/messaging.json`
   - A list of entries `{ "name", "kind", "value", "description" }`.
   - `name`: UPPER_SNAKE, used in code. `kind`: `exchange`, `queue` or `routingKey`.
     `value`: the actual broker name, lower case with dots (for example `ai.requests`).
   - Empty list. Issue 3.1 adds the first names.
4. `contracts/events.json`
   - A list of entries `{ "name", "version", "description" }`. `name`: UPPER_SNAKE.
     `version`: integer from 1.
   - Empty list. Issue 1.4 adds the first events (logout, permission change).
5. JSON Schemas in `contracts/schemas/`, one per file above
   - Each entry's fields are required; extra fields are rejected.
6. Check script and tests
   - `contracts/package.json` with `ajv` as the only dev dependency; tests use `node:test`.
   - `npm test` validates each file against its schema and checks rules a schema cannot:
     no duplicate `code` or `name` within a file, and no duplicate `value` in messaging.json.
   - On failure it prints the file, the entry and the rule, and exits non-zero.
7. Docs
   - `contracts/README.md`: what each file is for, the entry shape, how to add a name
     (in the PR of the issue that first uses it), and how to run the check.
   - CLAUDE.md: commands table gets the contracts check; folder map marks `contracts/` as existing.
   - testing.md: the "helper from issue 0.2" row points to `contracts/` and its check.
   - `docs/decisions.md`: one entry for UPPER_SNAKE names and status inside error codes.

## Out of scope

- Generated TS constants or Java enums from the JSON: not planned.
- TS or Java loaders that services use in their own tests: issues 0.4 and 0.5.
- Error codes, capabilities, messaging names and events for real features: added by the
  issue that first uses each one (1.x, 3.1 and later).
- Event payload schemas: the issue that adds the event (1.4 and later).
- Running the check in CI: issue 0.6.

## Edge cases

- Duplicate `code` or `name` in one file: the check fails and names both entries.
- Name not UPPER_SNAKE (for example `notFound` or `NOT-FOUND`): the schema check fails.
- `status` outside 400 to 599, or not an integer: the schema check fails.
- Missing field or an extra field in an entry: the schema check fails.
- File not valid JSON, or saved with a UTF-8 BOM (Windows editors): the check fails with the
  file name, not a stack trace.
- Empty list: valid.
- Windows Git Bash and Linux: the check uses only node and npm, no shell tools, so it runs the
  same on both.

## Done when

1. `cd contracts && npm ci && npm test` passes on the committed files, and its output shows
   all four files checked.
2. A test adds a duplicate code to a copy of `error-codes.json` and the check fails naming the code.
3. A test uses a lower-case name and the check fails.
4. A test uses `"status": 200` and the check fails.
5. A test uses a file with a BOM and the check fails with a readable message.
6. `contracts/README.md` exists and explains how to add a new name.
7. CLAUDE.md, testing.md and decisions.md are updated in the same PR.
