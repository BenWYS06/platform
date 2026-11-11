# Plan 008: Spotless in the Java build and CI

Issue: #22, its "Done when" list. Short plan: 2 points, build and CI only, no spec.
Branch: chore/spotless
Status: not started
Rule: one task, one commit, one check. Stop after each task and show the check output.

## Global Constraints

- Branch: `chore/spotless` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files. Exception: Task 2,
  whose whole job is formatting every Java file once.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
  Exception: Task 2's commit holds formatting only, so its tick goes in Task 3's commit.
- Every commit ends with the trailer `Task N of plan 008.` and the attribution line.
- Versions pinned exactly, each at least two weeks old: Spotless Maven plugin 3.10.4 and
  google-java-format 1.37.0 (owner decision).
- Out of scope: TypeScript formatting (prettier).

## Tasks

- [ ] Task 1. Spotless in the root pom
  Add `spotless-maven-plugin` to the root `pom.xml` so it applies to the library and both
  services: the chosen Java format, unused imports removed, trailing whitespace trimmed,
  files end with a newline. Not bound to a phase: `./mvnw verify` does not change; the check
  runs as its own command.
  Check: `./mvnw -B spotless:check` -> runs for platform-common-java, chat-service and
  ai-service and lists the files that are not formatted yet (fails); `./mvnw -B verify` ->
  BUILD SUCCESS, library 30, chat 7, ai 7.

- [ ] Task 2. Format all Java code once
  `./mvnw spotless:apply`. The commit holds only the formatting changes, nothing else.
  After `spotless:apply`, show `git diff --stat`. If the change is large (more than about
  20% of the Java lines; today about 1,600 lines, so more than about 320 changed lines),
  stop and ask the user before committing.
  Check: `./mvnw -B spotless:check` -> BUILD SUCCESS; `git diff --stat HEAD~1` lists only
  `*.java` files; `./mvnw -B clean verify` -> BUILD SUCCESS, library 30, chat 7, ai 7.

- [ ] Task 3. CI runs the check; docs
  The `java` job runs `./mvnw -B spotless:check` before `./mvnw -B verify`. Docs: `CLAUDE.md`
  Commands and `CONTRIBUTING.md` (local command row) say how to check
  (`./mvnw spotless:check`) and how to fix (`./mvnw spotless:apply`). Add
  `.git-blame-ignore-revs` with the Task 2 commit hash, and a line in `CONTRIBUTING.md`:
  `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
  Check: actionlint -> no output; a Java file with broken formatting (extra spaces, unused
  import) -> `./mvnw -B spotless:check` fails and names it, then the change is reverted and
  the check passes again; `git blame` with the ignore file skips the Task 2 commit;
  `spotless:check` passes locally on Windows and on the CI runner (Linux), so line endings
  follow `.gitattributes` (seen in Task 4's PR checks).

- [ ] Task 4. Close the issue
  Run the full checks. Tick this plan and set `Status: done`; set its line in
  docs/plans/README.md to `done`; add #22 to docs/roadmap.md under Phase 0 and tick it;
  point docs/handoff.md to Phase 1 issue 1.1 (/session-summary). Scan, push, open the PR
  (`Closes #22`).
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names 1.1; `gh pr checks`
  -> all seven green, the `java` job log shows `spotless:check` passing.

## Done when coverage (issue #22)

| Done when | Task |
|---|---|
| Spotless in the root `pom.xml` for the library and both services, one agreed format | 1 |
| Java code formatted once, in a single commit with no other change | 2 |
| `./mvnw spotless:check` passes locally; the `java` CI job runs it; unformatted code fails | 2, 3, 4 |
| `CLAUDE.md` Commands and `CONTRIBUTING.md` say how to check and fix | 3 |

Roadmap: #22 has no line yet; Task 4 adds `- [x] Spotless in the Java build and CI (2, #22)`
under Phase 0 (owner agreed).
