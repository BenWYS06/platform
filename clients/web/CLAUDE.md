# web client

Job: what Claude needs when working in `clients/web`. Rules: `.claude/rules/vue.md`.

Vue 3 + TypeScript (`<script setup lang="ts">`), Vite, vue-router, Pinia, Node 24.
Android: later, issue #25.

## Commands

| Task | Command |
|---|---|
| Install, lint, build, test | `npm ci && npm run lint && npm run build && npm test` |
| Run locally (infra and services up) | `npm run dev` |

## Layout

- `src/main.ts`: creates the app with Pinia and the router.
- `src/router.ts`: routes; `createAppRouter(history)` so tests can pass a memory history.
- `src/views/`: one component per route.
- `src/api/`: the only code that calls `fetch` or browser storage (lint enforces it).
- `tests/`: Vitest + Vue Test Utils, jsdom.

## Style

- Style with Tailwind classes from the token theme. No arbitrary color values, no inline
  styles for color.
- Tailwind classes in `.vue` files stay readable; no class-sorting plugin.

## Gotchas

- TypeScript stays on 6.0.x until typescript-eslint supports 7 (as in auth-service).
- `npm run lint` runs ESLint and `vue-tsc` for the app (`tsconfig.app.json`) and for the
  Vite config (`tsconfig.node.json`).
