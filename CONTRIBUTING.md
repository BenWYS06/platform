# Contributing

Job: how work is done in this repo, and what every file in the harness is for.

## The loop

1. **Issue.** Every piece of work starts from a GitHub issue on the OpenBox board.
2. **Spec.** 3+ points: `/write-spec` writes `docs/specs/NNN-name.md`. The user agrees to it.
3. **Plan.** `/write-plan` splits the spec into tasks in `docs/plans/NNN-name.md`, each with
   a check.
4. **Branch.** One branch per issue from an up-to-date `main`.
5. **Task by task.** Do one task, run its check, show the output, stop. One task, one commit.
6. **Handoff.** End each session with `/session-summary`; `docs/handoff.md` holds the next step.
7. **Close.** The last plan task marks the plan, plans index and roadmap `done` and points
   the handoff to the next issue, on the feature branch, before the PR opens.
8. **PR.** One PR per issue. Scan, push, open a PR, fill in the template. CI
   (`.github/workflows/ci.yml`) runs on every PR to `main` and every push to `main`; all
   jobs green, then the user reads the full diff and merges.

## Run the CI checks locally

Each CI job, and the command that does the same on your machine (repo root, Git Bash):

| CI job | Local command |
|---|---|
| `contracts` | `cd contracts && npm ci && npm test` |
| `auth-service` | `cd services/auth-service && npm ci && npm run build && npm run lint && npm test` |
| `java` | `./mvnw -B verify` (Docker running, for Testcontainers) |
| `env-leak` | `git ls-files \| grep -E '(^\|/)\.env(\..*)?$\|\.(pem\|key\|p12\|jks\|keystore)$' \| grep -vE '(^\|/)\.env\.example$'` prints nothing |
| `repo-checks` | `node --test "scripts/ci/test/*.test.mjs"`, then `node scripts/ci/check-env.mjs`, `node scripts/ci/check-file-size.mjs`, `node scripts/ci/check-tests-exist.mjs` |
| workflow lint | `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/repo" -w /repo rhysd/actionlint:1.7.7` prints nothing |

## Branches

`feature/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`: lower case, words joined with `-`.
Never commit to `main`. Never force push.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type: summary`, imperative,
under 72 characters. Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`.
The body names the plan task, e.g. `Task 3 of plan 001.`

## Docs and tests

- Docs change in the same PR as the behavior they describe.
- Every bug fix has a test that failed before the fix.
- Details: `.claude/rules/git-and-docs.md` and `.claude/rules/testing.md`.

## File map

| File | Job |
|---|---|
| `README.md` | What the project is and how to start in 5 steps |
| `CONTRIBUTING.md` | This file: the work loop, branch and commit rules, file map |
| `CHANGELOG.md` | User-visible changes, newest first, under Unreleased until a release |
| `SECURITY.md` | How to report a vulnerability; what never goes into the repo |
| `CLAUDE.md` | What Claude reads at the start of every session (under 200 lines) |
| `.editorconfig` | One indentation and line-ending style for every editor |
| `.gitattributes` | Store text files with LF whatever `core.autocrlf` says |
| `.gitignore` | Keep build output, local tool files and secrets out of git |
| `.gitleaksignore` | Known false positives for the gitleaks secret scan (CI, issue 0.6) |
| `.env.example` | Every env variable name, with no real values |
| `.claude/settings.json` | Allowed and denied commands for Claude; registers the hooks |
| `.claude/hooks/protect-files.sh` | Blocks Claude from editing `.env` files and private keys (exit 2) |
| `.claude/hooks/format-on-edit.sh` | Formats a file after Claude edits it, if the formatter is installed |
| `.claude/rules/security.md` | Identity from the token, internal key, secrets, new endpoint checklist |
| `.claude/rules/git-and-docs.md` | Branch names, commit format, PR flow, docs in the same PR |
| `.claude/rules/testing.md` | Test types per layer; a regression test for every bug fix |
| `.claude/rules/clean-code.md` | File size limits, thin controllers, helpers only when shared |
| `.claude/rules/spring.md` | Spring Boot conventions; loads only for Java services and the Java library |
| `.claude/rules/express.md` | Express + TypeScript conventions; loads only for auth-service |
| `.claude/rules/vue.md` | Vue 3 conventions; loads only for the web client |
| `.claude/rules/android.md` | Android conventions; loads only for the Android client |
| `.claude/skills/write-spec/` | `/write-spec`: interview the user and write a spec |
| `.claude/skills/write-plan/` | `/write-plan`: turn a spec into small tasks with checks |
| `.claude/skills/session-summary/` | `/session-summary`: tick the plan and roadmap, update the handoff |
| `.github/pull_request_template.md` | Checklist every PR fills in: spec, Done when, tests, docs, handoff |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Form for a bug: steps, expected, logs |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Form for a user story with acceptance criteria |
| `.github/CODEOWNERS` | Who must review changes |
| `.github/workflows/ci.yml` | CI: the checks every PR to `main` must pass |
| `scripts/ci/` | Repo checks run by CI: env names and allowed hosts, file sizes, tests per service |
| `scripts/ci/allowed-hosts.txt` | URL hosts allowed in source and config; never a production host |
| `docs/handoff.md` | Where the last session stopped and the next step |
| `docs/roadmap.md` | Phases 0 to 6 and the issues in each |
| `docs/decisions.md` | Log of hard-to-reverse decisions and why |
| `docs/architecture.md` | How the services, clients and data stack fit together |
| `docs/environments.md` | Each environment, how to reach it, where config lives |
| `docs/specs/` | One spec per issue: why, what, out of scope, edge cases, done when |
| `docs/plans/` | One plan per spec; `README.md` is the index with status |
