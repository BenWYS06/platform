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

## Next step: task 9

Task 9. GitHub files: PR template, bug and feature issue templates, CODEOWNERS (`@BenWYS06`).
Check: push the branch, open a PR, see the template; "New issue" shows both templates.

## Known gaps

- Permission rules match command text only: `cat .env` through Bash is not blocked. The protect hook (task 4) is the second layer for edits.
- README.md is UTF-16 (not seen as text by git); rewritten in task 10.

## Open questions for the user

- LICENSE: which license, or none?
- Phases 1 to 6 in [roadmap.md](roadmap.md) are empty until the planning notes are added.
