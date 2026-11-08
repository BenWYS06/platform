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
client -> Caddy -> /api/auth      -> auth-service
                -> /api/chat      -> chat-service
                -> /api/ai        -> ai-service
                -> /api/connector -> (TBD)
                -> /ws            -> (TBD)
                   /internal      -> blocked
```

## Rules that cross services

- Error responses use `{ code, message? }`; codes live in `contracts/error-codes.json`.
- Clients use a relative `/api` base URL, never a service port.
