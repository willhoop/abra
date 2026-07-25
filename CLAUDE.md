# CLAUDE.md — ABRA

Project-specific context. Universal rules are inherited from the Pokémon umbrella and the global
instructions; only what is specific to ABRA is here.

## WHO MAY WRITE TO THIS REPO (S11 — one publisher)

Three agents can touch these files. Only one may touch git.

| Agent | May run tests/engines | May run git |
|---|---|---|
| **Claude Code** (runs on the machine, has the credentials) | yes | **yes — only this one** |
| **Cowork** (isolated VM, no git credentials, `push` cannot authenticate) | no — it has no real store | **never** |
| **The workspace auto-commit** (fires ~2 min after a file changes, commits AND pushes) | n/a | it will anyway — see below |

**Cowork proposes; Claude Code applies and pushes.** Cowork must not run a git command at all. Not a
trust judgement — its shell cannot authenticate a push, so it fails partway and leaves state behind.
That is how this repo reached a detached HEAD 43 commits into a 45-commit rebase.

**Never run both agents against this repo at the same time.** They cannot see each other's edits and
the later write silently wins.

**The auto-commit is the real collision risk, not Cowork.** It is an unattended publisher that pushes
on a timer (confirmed in CHANGELOG 2.8.1 — an earlier diagnosis blaming a `push-all.bat` timer was
wrong and was retracted). An auto-commit landing while a rebase is half-finished is what wedges the
repository. Therefore:

- **Before any git work, `git status` must be clean AND no rebase may be in progress.** Check first,
  every time. If a rebase is in progress, FINISH it (`git rebase --continue`) — do not `git checkout`
  away from it, which abandons every commit already replayed.
- `push-all.bat` stays disarmed behind its `GO` argument and refuses to act mid-rebase. Leave it that
  way. Its header comments still describe the retracted timer diagnosis and point at
  `find-autocommit-task.bat`, which was deleted — ignore both.
- Never use `git merge -X ours`, and never restore `merge=union` in `.gitattributes`. The union driver
  is the confirmed cause of the store duplicating, it applies to `rebase` as well as `merge`, and it is
  why switching to rebase alone did not stop it. See `.gitattributes` and CHANGELOG 3.1.2.

## What ABRA is
The Automated Battle Replay Analyzer. It ingests public Champions Reg M-B replays from Pokémon
Showdown, models the ladder meta, and feeds `data/meta-usage.json` to CHOMP. **Separate but
connected to CHOMP** — CHOMP is only the pick-4/lead-2 engine; ABRA is the meta brain.

## The one principle that governs the data
**Store raw, analyze on top.** Every game is stored durably with every fact we might ever want,
plus rating and bot tags. All filtering/analysis runs on the store. Changing how we segment games
is a re-filter, never a re-pull. Never design an analysis that forces re-fetching replays.

## Where things are
- `engine/durable-ingest.js` — the pull+store (source of truth for the schema; `extract()` exported).
- `engine/analyze.js` — views + writes the model CHOMP reads.
- `data/games.ladder.jsonl` — the append-only store. `data/meta-usage.json` — the CHOMP-facing model.
- `tests/test-parse.js` — pins the extractor.

## The CHOMP loop
ABRA produces `meta-usage.json`; CHOMP reads it to infer real leads/sets. When ABRA improves, CHOMP
gets smarter without a plugin change.

## Living docs — update these EVERY change (do not let them drift)
Any change to a model, a result, or the site updates ALL of the following in the **same pass**, each
with its matching PDF where applicable, plus a CHANGELOG entry and a version bump:
- `docs/ABRA-whitepaper.md` (+ `.pdf`) — technical, with math + cited sources + honest results/CIs.
- `docs/ABRA-deck-plain-english.md` (+ `.pdf`) — plain-English; links the white paper on the last slide.
- `docs/ABRA-technical-docs.md` (+ `.pdf`) — ASD-STE100 Simplified Technical English, by Diátaxis.
- `docs/SUMMARY.md` (+ `.pdf`) — whole-project + per-component summary table.
- `docs/MODELS.md` — the per-model living ledger. · `docs/HANDOFF-v2.md` — current state/build order.
- `CHANGELOG.md` — Keep-a-Changelog; the top version matches the artifacts.
A result reported on the site or in the deck must match the number in the white paper and the model's
JSON report. Rebuild PDFs from the `.md` (pandoc → HTML → weasyprint; see `docs/` build notes).
This standard failed once by drifting to v1 while code moved to v2 — it is now written down so it is
checked, not remembered.
