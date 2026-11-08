# Decisions

Job: a log of decisions that are hard to reverse, with the reason. Newest at the bottom. Never edit an old entry; add a new one that replaces it.

Format:

```
## D-NNN Title (YYYY-MM-DD)
Decision: what we chose.
Why: the reason.
Instead of: what we did not choose.
```

## D-001 Hooks parse JSON with node, not jq (2026-11-08)
Decision: Claude Code hook scripts read their stdin JSON with `node`.
Why: hooks must run on Windows Git Bash, where `jq` is often missing; node is needed for the project anyway.
Instead of: `jq`.

## D-002 One base URL through Caddy (2026-11-08)
Decision: every client calls one address; Caddy routes `/api/<service>` and `/ws`, and blocks `/internal`.
Why: clients never need to know service ports, and internal endpoints are never reachable from outside.
Instead of: one URL per service.

## D-003 Contract names are UPPER_SNAKE; error codes carry their HTTP status (2026-11-08)
Decision: every name in `contracts/` (error codes, capabilities, messaging and event names) is UPPER_SNAKE; RabbitMQ names keep the real broker name in a separate lower-dotted `value`. Each error code fixes its HTTP status in `error-codes.json`.
Why: UPPER_SNAKE maps straight to Java enums and TS constants; a fixed status means every service answers the same code with the same status, and clients can rely on it.
Instead of: dotted lower names (`auth.invalid_credentials`), and letting each service pick the status.
