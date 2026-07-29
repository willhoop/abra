# CLAUDE.md — ABRA

Project-specific context. Universal rules are inherited from the Pokémon umbrella and the global
instructions; only what is specific to ABRA is here.

## Cowork handoff

Cowork drafts docs and analysis; Claude Code applies, tests and pushes.

- Cowork writes ONLY to `docs/_inbox/`. Never anywhere else in the repo.
- Claude Code writes ONLY to `docs/_outbox/`. Never into `_inbox`.
  Single writer per folder, so the two sessions cannot collide.
- When the user says **"apply inbox"**: read every file in `docs/_inbox/`, apply what you agree
  with, fill any `<<MEASURED>>` placeholder with a real measured number, run the tests, commit and
  push, then move the file to `docs/_inbox/applied/` and write a short result note to
  `docs/_outbox/`.
- Cowork never authors a number. If a draft contains a figure that is not `<<MEASURED>>`, treat it
  as suspect and verify it yourself.
- You are the sole publisher. Cowork runs no git and no scripts.

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

## The failure mode this project actually has (2026-07-28)

Every serious bug found on 2026-07-28 had ONE shape: **a capability was absent, and everything
reported success.** No exception, no failed test, no discarded game.

- the player had never read a team sheet — `setSheet()` existed, six offline scripts called it,
  `magnemite.js` never did
- self-play had never used open team sheets — 0 `|showteam|` in 1,934 games, and structurally
  impossible in the ladder format
- mega evolution never fired on the server, and in self-play only from the LEFT slot
- the joint layer fell back on 100% of eligible turns
- PORYGON2 and DODUO were fitted, saved, quoted in documents, and never once in a live decision

**These are invisible to every automated check.** A head-to-head, an exploitability search and a
prediction score all compare two bots that SHARE the blind spot, so a missing capability cancels
out exactly. Only a human looking at the screen found them.

### The rules that follow

**A capability that cannot prove it ran is assumed broken.** Every capability emits a counter, the
run prints it, and a zero is called out. `tests/test-wiring.js` plays real games and FAILS if a
counter is zero. Not "is the code there", not "did it parse", not "did the run finish" — all of
those were true every time.

**Non-zero is not always a strong enough bar.** Mega passed "at least one happened" while running
at 56% of sides against the correct 85%, because the base class could only mega from the left slot.
Where a domain rule exists, it becomes a RATE floor: Will's "a game without a mega should be rare"
is now a test threshold.

**Replacing a hedge with a certainty is only an improvement if you also track what invalidates the
certainty.** The Focus Sash drag was a 78.6% population prior. Trusting the open sheet made it a
hard 1.0 — better on average, and CATASTROPHIC after a Knock Off, because nothing tracked that the
item was gone. A probability is wrong more often and fails more gracefully. If you sharpen an
estimate, you inherit responsibility for every event that stales it.

**Correct the diagnosis, not just the bug.** The Focus Sash example above is real but was NOT the
worst case, and Will caught that too: Knock Off DEALS DAMAGE, so the target is no longer at full HP
and the Sash drag never applied anyway. The genuine cost of an untracked Knock Off is that the
damage and speed calculations keep applying an Assault Vest, Choice Scarf or Life Orb that is gone —
and those apply at ANY hp. A fix aimed at the wrong mechanism is still a bug.

**Prefer OBSERVED over DECLARED.** The sheet says what they started with. Knock Off (1,640 uses),
Trick, consumed berries and used Sashes all make it a lie mid-battle.

**Fitting environment and playing environment must match.** MAG's weights were fitted WITH the
sheet visible and the bot played WITHOUT it. MACHAMP's champion was trained under broken mega. Same
error, twice: trained under one set of capabilities, deployed under another.

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
