# Environments

Job: each environment, how to reach it, and where its config lives. No secret values here.

| Environment | Where | Config | Status |
|---|---|---|---|
| local | developer machine, `docker compose up` in `infra/` | `.env` copied from `.env.example` | planned (issue 0.3) |
| dev | TBD | TBD | not set up |
| prod | TBD | TBD | not set up |

## Notes

- Android has `dev` and `prod` flavors; the server URL sits behind `ServerConfig` (issue 0.7).
- Services refuse to start in production with unsafe config (production guard, issue 0.4).
- Variable names are listed in `.env.example`; real values never go into git.
