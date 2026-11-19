#!/usr/bin/env bash
# Job: fail when a part's LINE coverage is below its line in coverage-thresholds.txt.
# Usage: bash scripts/ci/coverage-gate.sh <part> [repo root]   (default root: this repo)
# Reads coverage/coverage-summary.json (Vitest) or target/site/jacoco/jacoco.csv (JaCoCo),
# so run the part's tests with coverage first (bash scripts/test-all.sh <part>).
# Thresholds only go up: 2+ points above prints the new value to write.
set -euo pipefail

part="${1:-}"
root="${2:-$(cd "$(dirname "$0")/../.." && pwd)}"
thresholds="$root/scripts/ci/coverage-thresholds.txt"

case "$part" in
  auth-service) report="apps/server/auth-service/coverage/coverage-summary.json" ;;
  web) report="apps/web/coverage/coverage-summary.json" ;;
  platform-common-java) report="packages/platform-common-java/target/site/jacoco/jacoco.csv" ;;
  chat-service | ai-service) report="apps/server/$part/target/site/jacoco/jacoco.csv" ;;
  *)
    echo "coverage-gate: unknown part '$part'." >&2
    echo "Parts: auth-service web platform-common-java chat-service ai-service" >&2
    exit 1
    ;;
esac

if [ ! -f "$root/$report" ]; then
  echo "coverage-gate: $part FAILED: no report at $report." >&2
  echo "Run its tests with coverage first: bash scripts/test-all.sh $part" >&2
  exit 1
fi
if [ ! -f "$thresholds" ]; then
  echo "coverage-gate: FAILED: scripts/ci/coverage-thresholds.txt is missing." >&2
  exit 1
fi

threshold="$(grep -E "^$part=" "$thresholds" | head -n 1 | cut -d= -f2 | tr -d '\r ' || true)"
if ! [[ "$threshold" =~ ^[0-9]+$ ]]; then
  echo "coverage-gate: $part FAILED: no '$part=NN' line in scripts/ci/coverage-thresholds.txt." >&2
  exit 1
fi

# Line percent with two decimals, from either report format.
pct="$(node -e '
  const fs = require("fs");
  const file = process.argv[1];
  const text = fs.readFileSync(file, "utf8");
  let covered, total;
  if (file.endsWith(".json")) {
    const lines = JSON.parse(text).total.lines;
    covered = lines.covered;
    total = lines.total;
  } else {
    const rows = text.trim().split(/\r?\n/).map((r) => r.split(","));
    const head = rows.shift();
    const miss = head.indexOf("LINE_MISSED");
    const cov = head.indexOf("LINE_COVERED");
    covered = rows.reduce((s, r) => s + Number(r[cov]), 0);
    total = covered + rows.reduce((s, r) => s + Number(r[miss]), 0);
  }
  console.log(total === 0 ? "0.00" : ((100 * covered) / total).toFixed(2));
' "$root/$report")"

verdict="$(awk -v p="$pct" -v t="$threshold" \
  'BEGIN { if (p + 0 < t + 0) print "low"; else if (p - t >= 2) print int(p) - 1; else print "ok" }')"

if [ "$verdict" = "low" ]; then
  echo "coverage-gate: $part FAILED: line coverage $pct% is below the threshold $threshold%." >&2
  echo "Add tests. Never lower the threshold (scripts/ci/coverage-thresholds.txt)." >&2
  exit 1
fi
echo "coverage-gate: $part OK: line coverage $pct% (threshold $threshold%)."
if [ "$verdict" != "ok" ]; then
  echo "coverage went up, raise the threshold to $part=$verdict"
fi
