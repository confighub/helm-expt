#!/usr/bin/env bash
# Config Workshop slop scan.
#   ./run.sh <site-dir> <out-prefix>
# Example: ./run.sh ../helm-expt/site cw
set -euo pipefail
SITE="$1"; OUT="${2:-cw}"

# 1. top-level authored pages
ls "$SITE"/*.html | python3 extract.py "${OUT}_top.txt" "${OUT}_top_stats.json"
# 2. rendered repo docs
find "$SITE/d" -name '*.html' | python3 extract.py "${OUT}_docs.txt" "${OUT}_docs_stats.json"

for c in top docs; do
  echo "########## $c"
  python3 scan.py "${OUT}_${c}.txt" "${OUT}_${c}_stats.json" "${OUT}_${c}"
  python3 refine.py "${OUT}_${c}.txt" "${OUT}_${c}_refined.csv"
  python3 structure.py "${OUT}_${c}.txt" "${OUT}_${c}"
done
