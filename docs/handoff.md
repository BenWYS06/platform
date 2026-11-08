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

## Next step: task 5

Task 5. Hook `format-on-edit.sh` (PostToolUse, Edit and Write): pick a formatter by file extension, run it only if installed, otherwise exit 0 silently.
Check: fake input for a `.md` file exits 0; fake input for a missing file exits 0 with no crash.

## Known gaps

- Permission rules match command text only: `cat .env` through Bash is not blocked. The protect hook (task 4) is the second layer for edits.
- README.md is UTF-16 (not seen as text by git); rewritten in task 10.

## Open questions for the user

- LICENSE: which license, or none?
- Phases 1 to 6 in [roadmap.md](roadmap.md) are empty until the planning notes are added.
