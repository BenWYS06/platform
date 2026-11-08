#!/usr/bin/env bash
# Job: PostToolUse hook for Edit and Write. Formats the edited file with the formatter for
# its type, only if that formatter is installed. Otherwise it does nothing.
# Reads the hook JSON from stdin and takes tool_input.file_path (parsed with node, no jq).
# Always exits 0: formatting must never block or break the session.

input="$(cat)"

command -v node >/dev/null 2>&1 || exit 0

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
')" || exit 0

[ -f "$file_path" ] || exit 0

# Prefer the project's own prettier; never use npx (it would download one).
prettier_bin() {
  local local_bin="${CLAUDE_PROJECT_DIR:-.}/node_modules/.bin/prettier"
  if [ -x "$local_bin" ]; then echo "$local_bin"; return; fi
  command -v prettier
}

run() {
  # $1 = formatter (empty when not installed), rest = arguments
  [ -n "$1" ] || exit 0
  "$@" >/dev/null 2>&1 || echo "format-on-edit: '$1' failed on '$file_path'; file left as is" >&2
  exit 0
}

name="${file_path##*/}"
case "${name,,}" in
  *.js | *.mjs | *.cjs | *.ts | *.tsx | *.vue | *.json | *.css | *.scss | *.html | *.md | *.yml | *.yaml)
    run "$(prettier_bin)" --write "$file_path" ;;
  *.java)
    run "$(command -v google-java-format)" --replace "$file_path" ;;
  *.kt | *.kts)
    run "$(command -v ktlint)" -F "$file_path" ;;
  *.sh)
    run "$(command -v shfmt)" -w -i 2 "$file_path" ;;
esac

exit 0
