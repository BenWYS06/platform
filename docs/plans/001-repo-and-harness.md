# Plan 001: Repo and harness

Spec: docs/specs/001-repo-and-harness.md
Branch: feature/repo-harness
Rule: one task, one commit, one check. Stop after each task and show the check output.

- [x] Task 1. Basics
  Add .gitignore (node, java, android, .env and .env.*, except .env.example), .editorconfig, .env.example (empty with a comment), LICENSE decision left to the user.
  Check: `git status` shows only these files; `.env` created by hand is ignored.

- [x] Task 1b. Line endings
  Add .gitattributes (* text=auto eol=lf, CRLF for *.bat, *.cmd, *.ps1) so core.autocrlf cannot turn hook scripts into CRLF. Run git add --renormalize .
  Check: `git ls-files --eol` shows i/lf for every text file.

- [x] Task 2. Docs skeleton
  Create docs/handoff.md, roadmap.md, decisions.md, architecture.md, environments.md, and the folders specs/, plans/ with plans/README.md. Copy spec 001 and plan 001 into specs/ and plans/. Roadmap lists phases 0 to 6 from the planning notes the user gives.
  Check: every file opens, handoff.md says "next step: task 3".

- [ ] Task 3. Settings
  Write .claude/settings.json with allow and deny lists from the spec.
  Check: run `/permissions`; a read of `.env` is denied; `git push --force` is denied.

- [ ] Task 4. Hook: protect-files.sh
  Write the script. It reads JSON from stdin, takes `tool_input.file_path` with node, exits 2 and prints a reason for .env (not .env.example) and key files, exits 0 otherwise. Register it in settings.json as PreToolUse for Edit and Write.
  Check, run both:
  `echo '{"tool_input":{"file_path":".env"}}' | bash .claude/hooks/protect-files.sh; echo $?` must print 2.
  `echo '{"tool_input":{"file_path":"README.md"}}' | bash .claude/hooks/protect-files.sh; echo $?` must print 0.
  Then ask Claude to edit .env in a real session and see it blocked.

- [ ] Task 5. Hook: format-on-edit.sh
  PostToolUse for Edit and Write. Picks a formatter by file extension and runs it only if installed; otherwise exits 0 silently.
  Check: fake input for a .md file exits 0; a fake input for a missing file exits 0 with no crash.

- [ ] Task 6. Rules
  Write the 7 rule files. Stack rules have `paths:` front matter. Keep each under 60 lines.
  Check: `/memory` lists them; stack rules show as path-scoped.

- [ ] Task 7. CLAUDE.md
  Write the root CLAUDE.md: what the project is, folder map, commands (placeholders until services exist), the rules that matter every session, and pointers to docs/handoff.md and the plans index.
  Check: `wc -l CLAUDE.md` is under 200.

- [ ] Task 8. Skills
  Write write-spec, write-plan, session-summary, each with front matter (name, description).
  Check: type `/` in Claude Code and see all three; run write-spec on a tiny dummy idea and delete the output.

- [ ] Task 9. GitHub files
  Add PR template, two issue templates, CODEOWNERS (the user as owner).
  Check: push the branch, open a PR, and see the template in the description; open "New issue" and see both templates.

- [ ] Task 10. Human docs
  Write README.md, CONTRIBUTING.md (loop, branch and commit rules, file map with one-line jobs), CHANGELOG.md (Unreleased), SECURITY.md, .gitleaksignore (empty with a comment).
  Check: README explains how to start in 5 lines even though services are not there yet.

- [ ] Task 11. Final check and handoff
  Run /session-summary: tick this plan and the roadmap, set handoff.md to "next step: issue 0.2".
  Check: new session, ask "what is the next step?", answer matches handoff.md. User reads the full diff and merges the PR.
