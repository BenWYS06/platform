# Testing rules

Job: which tests each layer needs, and when a change is tested enough. Loaded every session.

## Every bug fix has a regression test

1. Write a test that fails because of the bug.
2. Fix the bug; the test passes.
3. Name the test after the behavior, not the ticket: `rejects_expired_token`, not `bug_42`.

## Test types in this project

1. **Unit / service-level** (the majority): logic with its dependencies mocked or faked; fast,
   no Docker. Services, guards, pure functions, Vue components.
2. **Integration**: supertest on the Express app in memory; Testcontainers with a real
   MongoDB, Redis or RabbitMQ for the data and messaging layers (Docker running).
3. **Later**: a post-deploy smoke script, then browser end-to-end with Playwright.
   Today there is **no browser end-to-end test**: nothing clicks through the web app.

## Narrow test and full gate

- Narrow test, inside a task: one test file or one package, not the whole repo.
  Vitest: `cd D:/openbox/platform/apps/<part> && npx vitest run <file>`.
  Java: `./mvnw -pl apps/server/<name> -am verify -Dtest=<Class> -Dsurefire.failIfNoSpecifiedTests=false`.
  Node check scripts: `node --test scripts/ci/test/<file>.test.mjs`.
- Full gate: `bash scripts/test-all.sh <parts>`, before "done" and before a PR
  (`test-gate.md`).

## Tests per layer

| Layer | Test type | Tools |
|---|---|---|
| Domain logic (any service) | unit, no I/O | JUnit 5 / Vitest |
| Spring controllers | slice test with MockMvc | `@WebMvcTest` |
| Spring + MongoDB/Redis/RabbitMQ | integration with real containers | Testcontainers |
| Express routes | HTTP test against the app | Vitest + supertest |
| Shared names | contract test against `contracts/*.json` | `cd contracts && npm test`; services read the JSON in their tests |
| Vue components | component test | Vitest + Vue Test Utils |
| Vue flows | end-to-end (later) | Playwright |
| Android view models | unit | JUnit + Turbine |
| Android screens | UI test | Compose UI test |

## Rules

- A new endpoint has tests for success, 401 (no token), 403 (other user) and bad input.
- Tests do not call real external services (AI providers, email). Use fakes at the boundary.
- No sleeps to wait for async work; poll with a timeout or use the tool's await helper.
- Tests must pass in any order and in parallel; each test sets up its own data.
- Do not delete or skip a failing test to make the build green. Fix it or ask the user.
- Tests assert real values; a test that only calls a function proves nothing (`test-gate.md`).
- Claude runs the tests itself (`test-gate.md`); CI runs the same gate again on the open PR.
