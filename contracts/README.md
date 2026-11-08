# contracts

Job: the names that services and clients share, in one place, and the check that keeps them valid.

## Files

| File | What | Entry |
|---|---|---|
| `error-codes.json` | codes in error responses `{ code, message? }` | `{ code, status, description }` |
| `capabilities.json` | permissions that roles grant (from issue 1.3) | `{ name, description }` |
| `messaging.json` | RabbitMQ exchanges, queues, routing keys (from issue 3.1) | `{ name, kind, value, description }` |
| `events.json` | events services publish to each other (from issue 1.4) | `{ name, version, description }` |

Each file is a JSON list. Its schema is in `schemas/`.

## Rules

- `code` and `name`: UPPER_SNAKE, for example `NOT_FOUND`. Unique in their file.
- `status`: the HTTP status for that error code, an integer from 400 to 599.
- `kind`: `exchange`, `queue` or `routingKey`.
- `value`: the real broker name, lower case with dots, for example `ai.requests`. Code uses
  `name`; the broker sees `value`. Unique in `messaging.json`.
- `version`: an integer from 1. A breaking change to an event's payload raises it.
- No other fields. Files are UTF-8 without BOM.

## Add a name

1. Add the name in the PR of the issue that first uses it, not earlier.
2. Add one entry at the end of the right file, for example in `error-codes.json`:
   ```json
   { "code": "AUTH_INVALID_CREDENTIALS", "status": 401, "description": "Wrong email or password." }
   ```
3. Run the check (below). Fix any line it prints.
4. Never rename or remove a name that a service already uses; add a new one and move the
   callers first.

## Run the check

```bash
cd contracts && npm ci && npm test
```

Each problem prints as one line: the file, the entry and the rule it breaks. Services read
these files in their own tests (issues 0.4 and 0.5). CI runs the check from issue 0.6.
