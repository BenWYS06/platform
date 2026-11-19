# Test gate rules

Job: when work counts as done. Claude runs the tests itself; CI runs the same gate again on
a clean machine. Loaded every session. Decision: D-013.

## The gate

1. After changing code, run `bash scripts/test-all.sh <parts>` for the parts you touched
   before saying "done". Before the final push or PR: the full run, `bash scripts/test-all.sh`
   with no argument.
   Parts: `contracts`, `repo-checks`, `auth-service`, `web`, `platform-common-java`,
   `chat-service`, `ai-service`. Inside a task, run the narrow test first (one test file
   or one package, see `testing.md`).
2. A failing test or coverage below the threshold means NOT done: no success report, no PR.
   Never disable a test, skip a red test or lower a threshold to get green.
3. New or changed logic needs tests: happy path, bad input (empty, missing), no permission,
   dependency error, edge cases. Prefer logic (services, guards, pure functions) over UI.
4. Tests assert real values (`toEqual`, `toHaveBeenCalledWith`, `rejects.toThrow(X)`,
   `assertEquals`). No test that only calls a function. No snapshot for logic.
   Check that a test is real: break the code on purpose, the test must fail, then revert.
5. Ratchet: when the gate prints "coverage went up, raise the threshold to <part>=NN",
   write that value in `scripts/ci/coverage-thresholds.txt` in the same PR. Thresholds only
   go up, never down.
6. A real bug found outside the task: do not sneak a fix in. Add the test as `it.skip`
   (`@Disabled` in Java) with a comment `BUG: ...`, and tell the user.
7. Known traps:
   - Docker must be running for `auth-service`, `chat-service` and `ai-service`
     (Testcontainers). Without it most of their tests fail; that is not a code failure.
     Check with `docker version` (it must show a Server).
   - Windows: Vitest fails every suite when Node starts from a lowercase `d:\`.
     `test-all.sh` switches to an uppercase drive and refuses to start Vitest otherwise.
     For a narrow Vitest run by hand, `cd D:/openbox/...` first.
   - `test-all.sh` does not install packages: run `npm ci` in a Node part after a
     lockfile change (CI does). Stop a running auth-service before `npm ci` (argon2 lock).
8. Report when done: the parts run, tests passed, coverage before -> after per part, and
   whether a threshold was raised.

## Where things are

- `scripts/test-all.sh`: lint, build and tests with coverage per part, then the gate. CI
  calls the same script (`--no-gate`) and runs the gate as its own step.
- `scripts/ci/coverage-gate.sh <part>`: LINE percent from `coverage/coverage-summary.json`
  (Vitest) or `target/site/jacoco/jacoco.csv` (JaCoCo) against the threshold.
- `scripts/ci/coverage-thresholds.txt`: one `part=NN` line per gated part.
