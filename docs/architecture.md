# Architecture

Job: how the system fits together. Update in the same PR that changes it.

Status: planned. Nothing below exists in code yet; it comes from the Phase 0 issues.

## Parts

| Part | Stack | Issue |
|---|---|---|
| Caddy | reverse proxy, one entry point | 0.3 |
| auth-service | Express + TypeScript | 0.4 |
| chat-service | Spring Boot, Java 21 | 0.4 |
| ai-service | Spring Boot, Java 21 | 0.4 |
| libs/platform-common-java | shared errors, config guards, JWT filter | 0.5 |
| contracts/ | shared error codes, capabilities, messaging, events | 0.2 |
| web | Vue 3 | 0.7 |
| android | Kotlin, Compose, Hilt | 0.7 |

## Data stack

MongoDB (replica set), Redis, RabbitMQ, Qdrant. Runs locally with `infra/compose.yml` (issue 0.3).

## Routing

```
client -> Caddy :8080 -> /api/auth/*     -> auth-service  :3001
                      -> /api/chat/*     -> chat-service  :8081
                      -> /api/ai/*       -> ai-service    :8082
                      -> /api/connector  -> (TBD, issue 5.2)
                      -> /ws             -> (TBD, issue 2.2)
                         any /internal segment -> 404, never forwarded
```

- Config: `infra/Caddyfile`. Caddy keeps the `/api/<service>` prefix; locally it forwards to
  services on the host via `host.docker.internal` (ports from `.env`, defaults above).
- `/internal` is blocked in any case, encoded or not, and when followed by any non-word
  character (`internal;x`, `internal%09`), before routing. Services still check `X-Internal-Key`.
- Caddy answers its own errors as contract JSON: service down -> 503 `SERVICE_UNAVAILABLE`,
  unknown path or `/internal` -> 404 `NOT_FOUND`, anything else -> 500 `INTERNAL`.

## Rules that cross services

- Error responses use `{ code, message? }`; codes live in `contracts/error-codes.json`.
- Capabilities, RabbitMQ names and events live in `contracts/` too; each issue adds the names it first uses.
- Clients use a relative `/api` base URL, never a service port.
