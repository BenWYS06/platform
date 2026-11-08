# Spec 001: Repo and harness

Issue: 0.1 Repo and harness. Sprint 1. Estimate 3.

## Why

Every later session and every later PR follows the rules set here. Setting them once, in files, means a new session needs no explanation, and a mistake (editing a secret, force-pushing) is blocked by a script, not by memory.

## What we build

1. Memory and rules
   - CLAUDE.md: build commands, project rules, known gotchas. Under 200 lines.
   - .claude/rules/security.md: identity from the token, internal key, secrets, checklist for a new endpoint.
   - .claude/rules/git-and-docs.md: branch names, commit format, PR flow, docs change in the same PR.
   - .claude/rules/testing.md: test types per layer, a regression test for every bug fix.
   - .claude/rules/spring.md, express.md, vue.md, android.md: short stack rules, each scoped with `paths:` so it loads only for that code.
2. Skills (.claude/skills/)
   - write-spec: interview the user, write docs/specs/NNN-name.md with Out of scope and Done when.
   - write-plan: turn a spec into small tasks, each with its own check.
   - session-summary: tick the plan and roadmap, update docs/handoff.md.
3. Settings and hooks
   - .claude/settings.json: allow build, test, lint, git and gh commands. Deny reading .env files, `git push --force`, `rm -rf`.
   - .claude/hooks/protect-files.sh (PreToolUse on Edit and Write): blocks .env files and private keys. Exit code 2 blocks.
   - .claude/hooks/format-on-edit.sh (PostToolUse on Edit and Write): runs the formatter for the edited file type, and does nothing if the formatter is not installed yet.
4. GitHub files
   - .github/pull_request_template.md: spec link, Done when, tests, docs, handoff.
   - .github/ISSUE_TEMPLATE/bug_report.md and feature_request.md.
   - .github/CODEOWNERS.
5. Docs skeleton
   - docs/handoff.md, roadmap.md, decisions.md, architecture.md, environments.md.
   - docs/specs/ and docs/plans/ with a README.md index in plans/.
6. Repo hygiene
   - README.md, CONTRIBUTING.md, CHANGELOG.md, SECURITY.md, .editorconfig, .gitignore, .gitleaksignore, .env.example.

## Out of scope

- CI workflow and branch protection on main: issue 0.6.
- contracts/ folder: issue 0.2.
- Service code, infra, clients: issues 0.3 to 0.7.
- Stack-specific CLAUDE.md inside services and clients: added when each folder exists.

## Edge cases

- Hooks must work on Windows (Git Bash). Do not depend on `jq`; parse the hook input with `node`.
- The hook reads the path from `tool_input.file_path`, not from the top level of the JSON.
- A hook that cannot read its input must not crash the session. It allows the action and prints a warning.
- `.env.example` must be allowed by the protect hook; `.env` and `.env.local` must be blocked.

## Done when

1. CLAUDE.md is under 200 lines.
2. protect-files.sh exits 2 for a fake input that edits `.env`, and exits 0 for an input that edits `README.md`. Both runs are shown in the PR.
3. settings.json denies `.env` reads and force push (checked with `/permissions`).
4. Opening a PR shows the PR template. "New issue" shows the bug and feature templates.
5. All files in "What we build" exist, and every file has a one-line job described in CONTRIBUTING.md or in the file itself.
6. A new Claude Code session, asked "what is the next step?", answers from docs/handoff.md without help.
7. The work arrives through a PR from `feature/repo-harness`, and the user has read the full diff.
