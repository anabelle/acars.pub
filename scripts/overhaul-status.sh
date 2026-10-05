#!/usr/bin/env bash
# Prints the live state of the overhaul by reading every session brief in
# docs/overhaul/sessions/. The briefs are the source of truth; this script
# never writes anything.
#
# Usage: scripts/overhaul-status.sh [--all]
#   default: in-progress sessions first, then the next sessions from the
#            recommended order in docs/overhaul/STATUS.md
#   --all:   every session
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/docs/overhaul/sessions"
STATUS_MD="$ROOT/docs/overhaul/STATUS.md"

field() { # field <file> <label>
  grep -m1 "^> \*\*$2:\*\*" "$1" | sed -E "s/^> \*\*$2:\*\* *//"
}

row() { # row <file>
  local f="$1" id title status next branch pr done total
  id="$(basename "$f" | cut -d- -f1)"
  title="$(head -1 "$f" | sed -E 's/^# [A-Z0-9]+ — //')"
  status="$(field "$f" Status)"
  next="$(field "$f" "Next step")"
  branch="$(field "$f" Branch)"
  pr="$(field "$f" PR)"
  done="$(grep -cE '^- \[x\] \*\*S[0-9]+\.[0-9]+\*\*' "$f" || true)"
  total="$(grep -cE '^- \[[ x]\] \*\*S[0-9]+\.[0-9]+\*\*' "$f" || true)"
  printf '| %s | %s | %s | %s/%s | %s | %s | %s |\n' \
    "$id" "$title" "$status" "$done" "$total" "$next" "$branch" "$pr"
}

header() {
  echo "| ID | Title | Status | Steps | Next step | Branch | PR |"
  echo "| -- | ----- | ------ | ----- | --------- | ------ | -- |"
}

if [[ "${1:-}" == "--all" ]]; then
  header
  for f in "$DIR"/S*.md; do row "$f"; done
  exit 0
fi

echo "## In progress"
header
found=0
for f in "$DIR"/S*.md; do
  if field "$f" Status | grep -q "in progress"; then row "$f"; found=1; fi
done
[[ $found -eq 0 ]] && echo "| — | nothing in progress | | | | | |"

echo
echo "## Up next (recommended order, not yet done)"
header
shown=0
# Recommended order = the S-ids listed in STATUS.md's "Recommended order" table, in order.
for id in $(sed -n '/^## 3\. Recommended order/,/^## 4\./p' "$STATUS_MD" | grep -oE '\bS[0-9]{2}\b' | awk '!seen[$0]++'); do
  f="$(ls "$DIR"/"$id"-*.md 2>/dev/null | head -1)"
  [[ -z "$f" ]] && continue
  st="$(field "$f" Status)"
  if ! echo "$st" | grep -qE "merged|in progress"; then
    row "$f"; shown=$((shown + 1))
  fi
  [[ $shown -ge 5 ]] && break
done
