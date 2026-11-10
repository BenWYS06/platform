# Spec 007: Web skeleton

Issue: #8 0.7a Web skeleton. Sprint 1. Estimate 5.

## Why

Sprint 2 starts login. Login needs a web client that already builds, reaches `/api`, shows
server errors in the user's language and passes CI. Without the skeleton, Sprint 2 mixes
setup work with the first feature, and the client rules (relative `/api`, error codes to
messages, en and vi, design tokens) are only on paper.

## What we build

1. Web client, `clients/web/`
   - Vue 3, `<script setup lang="ts">`, Vite, vue-router, Pinia, vue-i18n. Scripts:
     `dev`, `build`, `lint` (ESLint + `vue-tsc`), `test` (Vitest + Vue Test Utils).
   - Api layer `src/api/`: the only code that calls `fetch`; base URL is the relative
     `/api`; 5 s timeout; returns either the JSON body or an error `code`.
   - Dev: `npm run dev` serves the app; Vite forwards `/api` to `http://localhost:8080`
     (Caddy). No other host or port in web code.
   - Error mapping: a server `code` maps to the i18n key `errors.<CODE>`. An unknown code
     shows `errors.UNKNOWN`; no answer or a non-contract answer shows `errors.NETWORK`.
   - i18n: `en` and `vi`; the browser language picks `vi` for `vi*`, else `en`.
   - Design tokens: CSS variables for colors (light and dark, following the system),
     spacing, radius and type scale, in one file. Components use only the variables.
   - One route `/`: the health screen (part 2).

2. Health screen, web
   - Three rows: auth, chat, ai. Each shows Checking, Up, or Down with the mapped message.
   - The three calls run in parallel when the screen opens.
   - A "Check again" button runs the three calls again; it is disabled while checking.

3. CI and docs
   - CI job `web` (`npm ci`, lint, build, test), added to the required checks on `main`
     (D-007), so the required checks become 7.
   - Docs: `CLAUDE.md` (folder map, commands), `CONTRIBUTING.md` (local commands),
     `docs/architecture.md`, `docs/environments.md`, a short `clients/web/CLAUDE.md`.

## Out of scope

- Android client: issue #25, built later.
- Login, tokens and their storage: Sprint 2 (issues 1.1, 1.2).
- In-app language switch: not planned yet.
- Serving the built web through Caddy, and deploy: later deploy issue.
- A shared design-token file for web and Android: not planned yet.
- End-to-end tests (Playwright): later.
- Coverage ratchet: #23. Spotless: #22.

## Edge cases

- One service down: Caddy answers 503 `SERVICE_UNAVAILABLE`; that row shows Down with the
  mapped message, the others are unaffected.
- Caddy not running: the dev proxy fails; all rows Down with `errors.NETWORK`.
- A call takes longer than 5 s: that row shows Down (network message), no hang.
- An answer that is not contract JSON (HTML error page, empty body): treated as network
  failure, never shown raw.
- A code the client does not know (newer server): `errors.UNKNOWN`.
- "Check again" pressed twice fast: one round of calls; the button is disabled meanwhile.
- Browser language `vi-VN`: Vietnamese; `fr`: English.

## Must not happen

- A host or port in web code outside the Vite dev proxy config.
- A raw server `message`, HTML or stack trace shown to the user.
- A string the user sees that is missing in `en` or `vi`.
- A hard-coded color in a component.
- A secret or token in web code, logs or `localStorage`.
- `v-html` with server data.

## Decisions

- Web dev reaches `/api` through a Vite proxy to Caddy; Caddy does not serve the web yet:
  Owner.
- Health screen: three rows with retry: Owner.
- Language follows the browser; no switch: Owner.
- Minimal design tokens, written in the web client: Owner.
- Web first; Android is issue #25, built later: Owner.
- Error key per contract code, checked by a test against `contracts/error-codes.json`:
  Claude.
- Pinia store for health state; the component only renders it: Claude.

## Done when

1. `cd clients/web && npm ci && npm run lint && npm run build && npm test` passes.
2. Web tests cover: health rows for Up, `SERVICE_UNAVAILABLE`, unknown code, timeout and
   non-JSON answer; "Check again" disabled while checking; `en` and `vi` have the same keys;
   every code in `contracts/error-codes.json` has an `errors.<CODE>` key in both.
3. With infra and the three services running, `npm run dev` and opening the page shows three
   Up rows; with chat-service stopped, chat shows Down and the others Up.
4. `grep` for `http://` and `https://` in the `*.ts` and `*.vue` files of `clients/web/src`
   finds nothing, apart from an SVG namespace such as `www.w3.org` (already in
   `scripts/ci/allowed-hosts.txt`); `node scripts/ci/check-env.mjs` passes.
5. CI job `web` is green on the PR and is a required check on `main` (7 required checks).
6. `CLAUDE.md`, `CONTRIBUTING.md`, `docs/architecture.md`, `docs/environments.md` and
   `clients/web/CLAUDE.md` describe the web client and its commands; `CLAUDE.md` marks
   `clients/web/` as existing.
