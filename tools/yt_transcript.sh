#!/usr/bin/env bash
# yt_transcript.sh — pull a YouTube transcript as plain text.
#
#   tools/yt_transcript.sh <url-or-id> [outfile]
#
# WHY THIS EXISTS. On 2026-08-31 a transcript was needed and four routes were tried
# and all four failed:
#
#   WebFetch on the watch page       returns the site footer, not the video
#   the timedtext caption URL        0 bytes — YouTube signs it against the requesting IP
#   /youtubei/v1/get_transcript      0 segments
#   the ANDROID player client        0 caption tracks
#   the browser pane                 navigation denied
#
# `yt-dlp` was already installed and gets it in one call, because it carries the
# client impersonation the bare endpoints now demand. Do not re-derive the scrape;
# it is a moving target and every hand-rolled version of it has already failed here.
#
# The VTT is kept beside the text: cues carry timestamps, and a claim about a video
# is worth more with the timestamp than without it.

set -u
URL="${1:-}"
OUT="${2:-transcript.txt}"

if [ -z "$URL" ]; then
  echo "usage: tools/yt_transcript.sh <url-or-id> [outfile]" >&2
  exit 2
fi
case "$URL" in http*) ;; *) URL="https://www.youtube.com/watch?v=$URL" ;; esac

command -v yt-dlp >/dev/null 2>&1 || {
  echo "yt-dlp is not on PATH. Install with: pip install -U yt-dlp" >&2
  exit 3
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --write-subs first, --write-auto-subs as the fallback: a human-written track beats ASR.
yt-dlp --skip-download --write-subs --write-auto-subs \
       --sub-langs "en.*,en" --sub-format vtt \
       -o "$TMP/sub" "$URL" >"$TMP/log" 2>&1

VTT="$(ls "$TMP"/sub*.vtt 2>/dev/null | head -1)"
if [ -z "${VTT:-}" ]; then
  echo "no subtitle track was written. yt-dlp said:" >&2
  tail -20 "$TMP/log" >&2
  exit 4
fi

cp "$VTT" "${OUT%.txt}.vtt"

# VTT -> prose. Auto-generated tracks repeat each line as a rolling caption, so the
# duplicate collapse is not cosmetic: without it the text is roughly twice as long
# and every sentence appears twice.
python - "$VTT" "$OUT" <<'PY'
import io, re, sys
src, dst = sys.argv[1], sys.argv[2]
raw = io.open(src, encoding='utf-8', errors='replace').read()
out, seen_last = [], None
for line in raw.splitlines():
    s = line.strip()
    if not s or s.startswith(('WEBVTT', 'Kind:', 'Language:', 'NOTE')):
        continue
    if '-->' in s:
        continue
    s = re.sub(r'<[^>]+>', '', s)          # inline <c> timing spans
    s = re.sub(r'\s+', ' ', s).strip()
    if not s or s == seen_last:
        continue
    out.append(s)
    seen_last = s
text = ' '.join(out)
io.open(dst, 'w', encoding='utf-8').write(text)
print('%s  %d chars, %d cues kept' % (dst, len(text), len(out)))
PY
