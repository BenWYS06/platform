---
paths:
  - "services/chat-service/**"
  - "services/ai-service/**"
  - "libs/platform-common-java/**"
---

# Spring Boot rules

Job: conventions for the Java 21 Spring Boot services and the shared Java library.

- Java 21, Spring Boot 3, one Maven build at the repo root (`pom.xml`, `./mvnw`). Build all:
  `./mvnw verify`; one service: `./mvnw -pl services/<name> -am verify`.
- Package by feature (`chat/message`, `chat/room`), not by layer.
- Constructor injection only; no field `@Autowired`.
- DTOs are `record`s. Never return a Mongo document class from a controller.
- Validate input with Bean Validation (`@Valid`, `@NotBlank`, `@Size`) on request DTOs.
- Errors: throw the shared exception type from `platform-common-java`; the shared handler
  turns it into `{ code, message? }`. No `try/catch` that only logs and rethrows.
- Config through `@ConfigurationProperties` records; no `@Value` scattered in classes.
  The production guard from `platform-common-java` checks required values at startup.
- Security: identity from the JWT filter in `platform-common-java`, read through the
  security context, never from the request.
- Logs: SLF4J, JSON output, include the request id; no `System.out`.
- Mongo: indexes declared in code; queries that can grow use paging.
- RabbitMQ: names (exchanges, queues, routing keys) come from `contracts/messaging.json`.
- Tests: see `testing.md`; Testcontainers for MongoDB, Redis and RabbitMQ.
