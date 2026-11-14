---
paths:
  - "apps/server/chat-service/**"
  - "apps/server/ai-service/**"
  - "packages/platform-common-java/**"
---

# Spring Boot rules

Job: conventions for the Java 21 Spring Boot services and the shared Java library.

- Java 21, Spring Boot 3, one Maven build at the repo root (`pom.xml`, `./mvnw`). Build all:
  `./mvnw verify`; one service: `./mvnw -pl apps/server/<name> -am verify`.
- Package by feature (`chat/message`, `chat/room`), not by layer.
- Constructor injection only; no field `@Autowired`.
- DTOs are `record`s. Never return a Mongo document class from a controller.
- Validate input with Bean Validation (`@Valid`, `@NotBlank`, `@Size`) on request DTOs.
- Errors: throw the shared exception type from `platform-common-java`; the shared handler
  turns it into `{ code, message? }`. No `try/catch` that only logs and rethrows.
- Health: Spring Actuator, health the only exposed endpoint, at `/api/<service>/health`,
  `show-details` and `show-components` `never`, only the indicators the service needs
  (D-010a); 503 is `{"status":"DOWN"}`, not the error body (D-010b).
- Config through `@ConfigurationProperties` records; no `@Value` scattered in classes.
  The production guard from `platform-common-java` checks required values at startup.
- Security: identity from the JWT filter in `platform-common-java`, read through the
  security context, never from the request.
- Logs: SLF4J, JSON output, include the request id; no `System.out`.
- Mongo: indexes declared in code; queries that can grow use paging.
- RabbitMQ: names (exchanges, queues, routing keys) come from `contracts/messaging.json`.
- Tests: see `testing.md`; Testcontainers for MongoDB, Redis and RabbitMQ.
