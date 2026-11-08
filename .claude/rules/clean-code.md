# Clean code rules

Job: limits on file size and layering that keep code easy to read and review. Loaded every session.

## File size

- A screen or component (Vue, Compose): at most 400 lines.
- A service or controller (Spring, Express): at most 500 lines.
- Past the limit: split by responsibility (one screen part, one use case), not by line count.

## Controllers

- A controller only parses the request, calls one service method, and returns a DTO.
- No business logic, no repository or database calls, no calls to other services in a controller.
- Never return a database entity or document; map it to a DTO.

## Helpers

- Extract a helper only when it is used from 2 places or more.
- Code used in one place stays where it is used.
