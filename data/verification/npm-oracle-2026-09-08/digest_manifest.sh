#!/usr/bin/env bash
# SHA-256 of every file under dist/data and dist/sim in two Showdown builds, and which differ.
# MEASURE 2026-09-08.  usage: digest_manifest.sh <buildA> <buildB>
set -u
A="$1"; B="$2"
same=0; diff=0
for sub in data sim; do
  for f in $(cd "$A/dist/$sub" && find . -name '*.js' -not -name '*.map' | sort); do
    if [ -f "$B/dist/$sub/$f" ]; then
      ha=$(sha256sum "$A/dist/$sub/$f" | cut -d' ' -f1)
      hb=$(sha256sum "$B/dist/$sub/$f" | cut -d' ' -f1)
      if [ "$ha" = "$hb" ]; then same=$((same+1)); else diff=$((diff+1)); echo "DIFFERS dist/$sub/$f"; fi
    else echo "ONLY-IN-A dist/$sub/$f"; fi
  done
done
echo "identical=$same differs=$diff"
