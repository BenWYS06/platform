# Testing rules

Job: which tests each layer needs, and when a change is tested enough. Loaded every session.

## Every bug fix has a regression test

1. Write a test that fails because of the bug.
2. Fix the bug; the test passes.
3. Name the test after the behavior, not the ticket: `rejects_expired_token`, not `bug_42`.

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
- Run the tests for the code you changed before saying a task is done, and show the output.
