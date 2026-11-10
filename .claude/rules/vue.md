---
paths:
  - "clients/web/**"
---

# Vue rules

Job: conventions for the Vue 3 web client.

- Vue 3, `<script setup lang="ts">`, Composition API, Vite. Scripts: `npm run dev`,
  `npm run build`, `npm test`, `npm run lint`.
- All HTTP goes through the api layer (`src/api/`), with the relative base URL `/api`.
  Components never call `fetch` or axios directly, and never hold a host or port.
- Server errors map from `code` to an i18n message key; never show a raw server message.
- Every user-visible string is in i18n files, in both `en` and `vi`.
- Colors, spacing and fonts come from design tokens; no hard-coded hex values in components.
- Style with Tailwind classes from the token theme. No arbitrary color values, no inline styles for color.
- State: Pinia stores per feature; keep component state local when no one else needs it.
- Tokens: never in `localStorage`. Follow the auth design from Sprint 2.
- No `v-html` with data that came from a user or the server.
- Tests: Vitest + Vue Test Utils, see `testing.md`.
