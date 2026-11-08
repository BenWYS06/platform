# Security policy

Job: how to report a vulnerability, and what must never go into this repo.

## Reporting a vulnerability

Do not open a public issue. Use GitHub's private report instead:
**Security** tab -> **Report a vulnerability**.

Include what is affected, how to reproduce it, and the impact you expect.
You will get an answer within 7 days.

## Supported versions

Nothing is released yet. Only `main` is supported.

## Never in the repo

- `.env` files, passwords, API keys, tokens, private keys, keystores.
- Real user data in tests, fixtures or logs.

If a secret is committed by mistake: rotate it first, then remove it from the code.
Removing it from history alone is not enough.

Rules for code: `.claude/rules/security.md`.
