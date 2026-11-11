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

## D-004 Local dev: services on the host behind Caddy; /internal blocked by segment (2026-11-08)
Decision: locally, only the data stores and Caddy run in Docker (`infra/compose.yml`); services run on the host and Caddy forwards to `host.docker.internal`, keeping the `/api/<service>` prefix. Caddy blocks any path segment that starts with `internal` followed by a non-word character or the end, in any case, before routing. Every published port is bound to `127.0.0.1`.
Why: services restart fast from the IDE with a debugger; one gateway config is tested from day one; blocking by segment means a stripped prefix, `;params` or encoding tricks cannot open an internal route; nothing is reachable from the LAN while MongoDB, Redis and Qdrant have no auth locally.
Instead of: services in compose for local dev (later, issue 3.6), blocking only `/internal` at the root, ports on `0.0.0.0`.

## D-005 Service skeletons: pino, standalone Maven projects, health pings stores (2026-11-08)
Decision: auth-service logs with pino + pino-http. chat-service and ai-service are standalone Maven projects, each with its own wrapper. Every service's health route pings the stores it uses with a 2.5 s limit and answers 503 `SERVICE_UNAVAILABLE` when one is down; Spring Actuator is not used. `APP_ENV` names the environment in all services.
Why: pino is JSON by default, fast, and redacts headers by path. Standalone projects keep each service buildable alone and match the commands already in CLAUDE.md. A health that checks stores proves config and connections end to end, and a plain controller keeps the body in contract shape. One variable for the environment means one guard rule in all three languages.
Instead of: winston; a root parent pom with modules (issue 0.5 decides how the services consume the shared library); a liveness-only health or Actuator; `NODE_ENV` and Spring profiles.

## D-006 One Maven build at the root; Java APIs closed by default; stay on Boot 3.5 (2026-11-09)
Decision: a root `pom.xml` aggregates `libs/platform-common-java` and the Java services, with one `./mvnw`; this replaces the "standalone Maven projects" part of D-005. The library brings a stateless Spring Security chain: health and `/error` public, `/internal/**` behind the internal key, every other `/api/<service>/**` route authenticated through a JWT stub that accepts nothing until issues 1.2 and 1.4. Spring Boot stays on 3.5.
Why: one reactor builds the library before the services, so a service never runs against an old library jar. Closed by default means a route added before real tokens exist cannot be open by mistake, and unknown routes do not reveal whether they exist. Staying on 3.5 keeps Phase 0 small (owner decision); the cost is no free security fixes from Spring for 3.5.
Instead of: `mvn install` of the library before each service build, or GitHub Packages; a stub that trusts any token, or plain servlet filters without Spring Security; moving to Spring Boot 4 now.

## D-007 main is protected: PR and seven CI checks required, admins included (2026-11-09)
Decision: branch protection on `main` requires a pull request (0 approvals) and the CI jobs `contracts`, `auth-service`, `web`, `env-leak`, `repo-checks`, `java` and `secrets` to pass (`web` added with issue 0.7a); it applies to admins too; force push and deletion are blocked. The branch need not be up to date with `main` before merge. Renaming or adding a required job means updating this rule in the same PR.
Why: the repo is public with a single owner, so nothing but this rule stops a broken or leaky commit from landing on `main`. Zero approvals because GitHub does not let an author approve their own PR. Including admins makes the rule apply to the only person who merges.
Instead of: no protection and trusting the process; required reviews (impossible solo); requiring an up-to-date branch (extra rebases for little gain with one author).

## D-008 One MongoDB database; one writer service per collection (2026-11-11)
Decision: auth-, chat- and ai-service use one MongoDB database, `platform`; this replaces the "one database per service" choice in spec 004. Each collection has exactly one service that writes it; other services may read it but never write.
Why: one database is simpler to run, back up and inspect, and lets a service read another's data (for example users) without an extra internal call. One writer per collection keeps ownership clear: rules and indexes for a collection live in one service.
Instead of: one database per service (`openbox_auth`, `openbox_chat`, `openbox_ai`), or any service writing any collection.
