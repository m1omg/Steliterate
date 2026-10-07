#!/bin/sh
# Tally harness output (tools/sim.ts): games, survivals (VICTORY + ENDURANCE), victories, and the
# mean number of Degenerate Age turns.  Usage: tools/tally.sh sim.txt [more.txt …]
for f in "$@"; do
  awk -v F="$f" '/^seed /{n++; if ($3=="VICTORY") v++; if ($3=="VICTORY"||$3=="ENDURANCE") s++; if (match($0,/"degenerate":[0-9]+/)) {d+=substr($0,RSTART+13,RLENGTH-13); dn++}} END {printf "%s: %d games, %d survive, %d victories, %.0f Degenerate turns (mean of %d)\n", F, n, s, v, d/dn, dn}' "$f"
done
