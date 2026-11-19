#!/usr/bin/env bash
# Job: run what CI runs for the named parts (lint, build, tests with coverage), then the
# coverage gate. Local green means CI green. Stops at the first failure.
# Usage: bash scripts/test-all.sh [--no-gate] [part...]   (no part = all parts)
# Parts: contracts repo-checks auth-service web platform-common-java chat-service ai-service
# CI calls it with --no-gate per job and runs scripts/ci/coverage-gate.sh as its own step.
# Not done here: install. Run npm ci in a Node part first (CI does).
# Docker must be running for auth-service, chat-service and ai-service (Testcontainers).
set -euo pipefail

ALL=(contracts repo-checks auth-service web platform-common-java chat-service ai-service)
JAVA=" platform-common-java chat-service ai-service "

# Uppercase absolute root: on Windows, Node started from a lowercase d:\ makes Vitest fail
# every suite. pwd -W exists only in Git Bash; Linux keeps pwd.
root="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
root="${root^}"
if [ "${1:-}" = "--root" ]; then
  echo "$root" # for scripts/ci/test/test-all.test.mjs
  exit 0
fi

gate=1
if [ "${1:-}" = "--no-gate" ]; then
  gate=0
  shift
fi
parts=("$@")
[ ${#parts[@]} -gt 0 ] || parts=("${ALL[@]}")
for p in "${parts[@]}"; do
  if [[ " ${ALL[*]} " != *" $p "* ]]; then
    echo "test-all: unknown part '$p'. Parts: ${ALL[*]}" >&2
    exit 1
  fi
done

in_dir() {
  local dir="$1"
  shift
  echo
  echo "== $dir: $*"
  (cd "$root/$dir" && "$@")
}

# Refuse to start Vitest when Node would see a lowercase drive letter.
vitest_drive_check() {
  (cd "$root/$1" && node -e '
    if (/^[a-z]:/.test(process.cwd())) {
      console.error("test-all: Node sees a lowercase drive (" + process.cwd() + "); Vitest would fail every suite.");
      process.exit(1);
    }')
}

gate_part() {
  if [ "$gate" = 1 ]; then bash "$root/scripts/ci/coverage-gate.sh" "$1" "$root"; fi
}

java_done=0
run_java() {
  [ "$java_done" = 0 ] || return 0
  java_done=1
  local mods=() p
  for p in "${parts[@]}"; do
    case "$p" in
      platform-common-java) mods+=("packages/$p") ;;
      chat-service | ai-service) mods+=("apps/server/$p") ;;
    esac
  done
  local list
  list="$(IFS=,; echo "${mods[*]}")"
  in_dir . ./mvnw -B -pl "$list" -am spotless:check
  in_dir . ./mvnw -B -pl "$list" -am verify
  for p in "${parts[@]}"; do
    if [[ "$JAVA" == *" $p "* ]]; then gate_part "$p"; fi
  done
}

for p in "${parts[@]}"; do
  case "$p" in
    contracts)
      in_dir contracts npm test
      ;;
    repo-checks)
      in_dir . node --test "scripts/ci/test/*.test.mjs"
      for check in check-env check-file-size check-tests-exist check-structure; do
        in_dir . node "scripts/ci/$check.mjs"
      done
      ;;
    auth-service)
      in_dir apps/server/auth-service npm run build
      in_dir apps/server/auth-service npm run lint
      vitest_drive_check apps/server/auth-service
      in_dir apps/server/auth-service npm run test:cov
      gate_part auth-service
      ;;
    web)
      in_dir apps/web npm run lint
      in_dir apps/web npm run build
      vitest_drive_check apps/web
      in_dir apps/web npm run test:cov
      gate_part web
      ;;
    *)
      run_java
      ;;
  esac
done

echo
echo "test-all: green (${parts[*]}) in ${SECONDS}s."
