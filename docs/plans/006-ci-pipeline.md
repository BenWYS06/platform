# Plan 006: CI pipeline

Issue: #7 (0.6), its "Done when" list. Short plan: 3 points, CI and repo settings only, no spec.
Branch: feature/ci-pipeline
Status: done
Rule: one task, one commit, one check. Stop after each task and show the check output.

## Global Constraints

- Branch: `feature/ci-pipeline` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 006.` and the attribution line.
- Workflow: `permissions: contents: read`; every action pinned by full commit SHA with the
  version in a comment; no secrets used by any job.
- Triggers: `pull_request` to `main` and `push` to `main` only. CI first runs on GitHub when
  the PR opens in Task 5.

## Tasks

- [x] Task 1. Workflow with contracts, auth-service and env-leak jobs
  Add `.github/workflows/ci.yml`: job `contracts` (Node 24, `npm ci && npm test`), job
  `auth-service` (`npm ci`, build, lint, test), job `env-leak` (fails if `git ls-files`
  lists a `.env*` other than `.env.example`, or a key file). Docs: `CLAUDE.md` `.github/`
  row and Commands, `CONTRIBUTING.md` step 8 and how to run each check locally.
  Check: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint` -> no output; the
  contracts and auth commands locally -> green; the env-leak command on the real file list
  -> pass, and on a list with `.env` and `a.pem` added (piped, no file created) -> fail.

- [x] Task 2. Repo check scripts and their tests
  Add Node scripts under `scripts/ci` (no dependencies), run by a new job `repo-checks`:
  (a) env: every variable read in code (`process.env.X` in auth-service, `${X}` in Java
  `application*.yml`) is a name in `.env.example`; no production hostname: every URL host
  in source and config under `services/`, `libs/`, `clients/`, `infra/` must be listed in
  `scripts/ci/allowed-hosts.txt` (start: `localhost`, `127.0.0.1`, `10.0.2.2`,
  `example.com`, plus the namespace hosts the first run finds: today `maven.apache.org`
  and `www.w3.org`). Not scanned: `docs/`, `*.md`, test fixtures, lock files,
  `node_modules/`, `target/`, `dist/`. (b) file size: `*.vue` and `*Screen.kt` at most 400
  lines, `*Service.*`, `*Controller.*` and auth `routes/` and `services/` files at most
  500. (c) every folder in `services/` has at least one test file. Tests with `node --test`
  under `scripts/ci/test/`, bad samples in fixture folders. Docs: CONTRIBUTING local
  command.
  Check: `node --test "scripts/ci/test/*.test.mjs"` -> each script fails on its bad sample and passes on
  the real repo; actionlint -> no output.

- [x] Task 3. Java job
  Add job `java`: Temurin 21 with Maven cache, `./mvnw -B verify` (Testcontainers uses the
  runner's Docker). The job runs only that: Spotless is #22 and the coverage ratchet
  is #23, both out of scope.
  Check: actionlint -> no output; `./mvnw -B verify` locally -> BUILD SUCCESS, library 30,
  chat 7, ai 7 tests.

- [x] Task 4. Secrets job (gitleaks)
  Add job `secrets`: checkout with full history, gitleaks CLI at a pinned version with its
  checksum verified, `gitleaks git --redact` over all commits, `.gitleaksignore` honored.
  Check: actionlint -> no output; the same gitleaks version locally (Docker image) over the
  full history -> "no leaks found", or each hit judged false positive and listed in
  `.gitleaksignore` with a reason (a real secret: stop and tell the user).

- [x] Task 5. Open the PR, confirm all six checks green
  Pre-push scan, push the branch, open the PR (`Closes #7`, template filled in). A job
  that fails on GitHub gets a fix commit on the branch (its own commit, same task trailer).
  Check: `gh pr checks` -> contracts, auth-service, env-leak, repo-checks, java, secrets
  all green.

- [x] Task 6. Protect main
  Only on the user's go-ahead: set protection with `gh api`: PR required (0 approvals:
  single owner), required checks = the six job names, no force push, no deletion. Note it
  in `docs/decisions.md` (hard to reverse) and the handoff "Settled" line; push.
  Check: `gh api repos/BenWYS06/platform/branches/main/protection` -> the six checks
  listed, `allow_force_pushes` false, `allow_deletions` false; `gh pr checks` -> green.

- [x] Task 7. Close the issue (with the merge)
  Last commit on the branch, pushed to the same PR just before the user merges. Run the
  full checks. Tick this plan and set `Status: done`; set its line in docs/plans/README.md
  to `done`; tick 0.6 in docs/roadmap.md; drop the "not in CI" gap and point
  docs/handoff.md to issue 0.7 (/session-summary). Scan, push.
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names 0.7; `gh pr checks`
  -> all six green. Then the user reads the diff and merges.

## Done when coverage (issue #7)

| Done when | Task |
|---|---|
| ci.yml on PR and push to main, read-only, pinned actions | 1 (actionlint), 5 |
| contracts job | 1, 5 |
| auth-service job | 1, 5 |
| java job with Testcontainers | 3, 5 |
| secrets job (gitleaks, full history) | 4, 5 |
| env-leak check | 1 |
| repo check scripts (a), (b), (c) | 2 |
| a test per script: bad sample fails, real repo passes | 2 |
| all jobs green on the PR | 5, 7 |
| branch protection on main | 6 |
| docs say CI exists; CONTRIBUTING has local commands | 1, 2, 7 |
