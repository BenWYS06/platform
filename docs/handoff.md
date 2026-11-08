# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue: 0.1 Repo and harness (Sprint 1, Phase 0)
- Branch: `feature/repo-harness`
- Spec: [specs/001-repo-and-harness.md](specs/001-repo-and-harness.md)
- Plan: [plans/001-repo-and-harness.md](plans/001-repo-and-harness.md)

## Done

- Task 1. Basics: .gitignore, .editorconfig, .env.example
- Task 1b. Line endings: .gitattributes forces LF
- Task 2. Docs skeleton: this folder
- Task 3. Settings: `.claude/settings.json` denies `.env` reads, force push (also `git -C <path> push --force` and `+refspec`), `rm -rf`. Each tested live.
- Task 4. Hook `.claude/hooks/protect-files.sh` (PreToolUse, Edit|Write|MultiEdit): blocks `.env`/`.env.*` (not `.env.example`) and key files. Fake inputs: `.env` exits 2, `README.md` exits 0. Live: a Write to `hook-test.pem` was blocked.
- Task 5. Hook `.claude/hooks/format-on-edit.sh` (PostToolUse): prettier / google-java-format / ktlint / shfmt by extension, only if installed; always exits 0. No formatter is installed yet.
- Task 6. Rules: 7 files in `.claude/rules/` (20 to 44 lines). security, git-and-docs, testing always load; spring, express, vue, android are scoped with `paths:`. User still to confirm with `/memory`.
- Task 7. Root `CLAUDE.md`: project, folder map, placeholder commands, every-session rules, gotchas, pointers.
- Task 8. Skills `write-spec`, `write-plan`, `session-summary` in `.claude/skills/<name>/SKILL.md`. User still to check `/` shows them and to try write-spec on a dummy idea.
- Task 9 (files only). `.github/` PR template, bug and feature issue templates, CODEOWNERS (`@BenWYS06`). Committed; the check (push, open PR, see templates) waits for the user's go-ahead.
- Task 10. README (rewritten in UTF-8, 5 start steps), CONTRIBUTING (loop, rules, file map of all 32 harness files), CHANGELOG, SECURITY, .gitleaksignore.

## Next step: task 9 check, then task 11

1. Task 9 check: push `feature/repo-harness`, open a PR, see the template; "New issue" shows the bug and feature templates. Waits for the user's go-ahead.
2. Task 11. Run /session-summary: tick plan and roadmap, set this file to "next step: issue 0.2".
   Check: new session, ask "what is the next step?", answer matches this file. User reads the full diff and merges the PR.

## Checks the user still has to run

- `/memory`: 7 rules listed, stack rules path-scoped (task 6).
- `/`: write-spec, write-plan, session-summary listed; try write-spec on a dummy idea (task 8).

## Known gaps

- Permission rules match command text only: `cat .env` through Bash is not blocked. The protect hook (task 4) is the second layer for edits.

## Open questions for the user

- LICENSE: which license, or none?
- Phases 1 to 6 in [roadmap.md](roadmap.md) are empty until the planning notes are added.
