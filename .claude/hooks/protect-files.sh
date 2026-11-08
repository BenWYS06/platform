#!/usr/bin/env bash
# Job: PreToolUse hook for Edit and Write. Blocks edits to .env files and private keys.
# Reads the hook JSON from stdin and takes tool_input.file_path (parsed with node, no jq).
# Exit 2 = block (reason on stderr goes back to Claude). Exit 0 = allow.
# If the input cannot be read, it allows the action and prints a warning: a broken hook
# must never stop the session.

warn() {
  echo "protect-files: $1; allowing the action" >&2
  exit 0
}

input="$(cat)"

command -v node >/dev/null 2>&1 || warn "node not found"

file_path="$(printf '%s' "$input" | node -e '
let d = "";
process.stdin.on("data", c => (d += c)).on("end", () => {
  try {
    const p = JSON.parse(d)?.tool_input?.file_path;
    if (typeof p !== "string" || p === "") process.exit(3);
    process.stdout.write(p);
  } catch {
    process.exit(3);
  }
});
')" || warn "could not read tool_input.file_path from hook input"

# Normalize Windows separators, keep only the file name, compare in lower case.
path="${file_path//\\//}"
base="${path##*/}"
base="${base,,}"

block() {
  echo "protect-files: blocked edit to '$file_path' ($1). Edit it by hand outside Claude Code." >&2
  exit 2
}

case "$base" in
  .env.example) exit 0 ;;
  .env | .env.*) block "env file with secrets" ;;
  *.pem | *.key | *.p12 | *.pfx | *.jks | *.keystore) block "private key or keystore" ;;
  id_rsa | id_dsa | id_ecdsa | id_ed25519) block "SSH private key" ;;
esac

exit 0
