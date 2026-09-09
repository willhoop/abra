# Pre-6.0.0 audit — untested causal claims in the living documents, and the handoff boundary

Read-only. Tree at `d6789951` (2026-09-09 11:53 -0400). Nothing was edited except this file. No engine
script was run; every receipt below is a line read or a `git log` query. This file is historical by
construction (`docs/_reports/`), never cited as current state.

Scope of the sweep: `docs/ABRA-whitepaper.md`, `docs/ABRA-deck-plain-english.md`,
`docs/ABRA-technical-docs.md`, `docs/SUMMARY.md`, `docs/MODELS.md`, `docs/ARCHITECTURE.md`, `README.md`,
`CLAUDE.md`, `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md`.

---

## Q1 — causal claims about measured results

### How many there are

Lines carrying a causal phrase (`because | caused by | the cause | root cause | which/this/that is why |
due to | the mechanism is/was`), per document:

| document | broad | strong-form (`the cause was/is`, `root cause`, `confirmed cause`, `the mechanism is`, `which/this/that is why`) |
|---|---|---|
| ENGINE.md | 1,230 | 167 |
| MEASURE.md | 239 | 33 |
| whitepaper | 155 | 27 |
| MODELS.md | 126 | 19 |
| deck | 123 | 5 |
| SEARCH.md | 106 | 17 |
| SUMMARY.md | 79 | 11 |
| technical-docs | 69 | 8 |
| CLAUDE.md | 26 | 2 |
| WEB.md | 22 | 4 |
| ARCHITECTURE.md | 6 | 1 |
| OPS.md | 5 | 1 |
| README.md | 0 | 0 |
| **total** | **2,186** | **295** |

**Seen: 2,186 causal-phrase lines, 295 strong-form. Read in context: about 90. Classified below: 34.**
The ENGINE.md ledger is the bulk and was SAMPLED, not audited — its convention is a `fix | knob | probe`
table per entry (e.g. `docs/ENGINE.md:14486-14489`), and every sampled entry carried one. A full pass over
its 167 strong-form lines is owed (see the end).

### Class counts

| class | claims | copies across documents |
|---|---|---|
| REFUTED-BUT-STILL-STATED | **5** (+1 in a live script header, not a living doc) | 6 |
| HYPOTHESIS | 9 | 13 |
| TESTED | 20 | 43 |

### REFUTED-BUT-STILL-STATED — every one

**R1. `CLAUDE.md:356-357` — the union merge driver is "the confirmed cause of the store duplicating".**
Stated as diagnosed, never as tested: CHANGELOG 3.1.2 (`CHANGELOG.md:28240-28258`) gives a mechanism
argument ("`merge=union` resolves a conflicting hunk by concatenating both sides") and no reproduction.
The only test the repo ever ran is the ancestry check in CHANGELOG 3.23.0 (`CHANGELOG.md:26611-26620`),
and it found a **counter-example**: `009af26` "store: dedupe after rebase (137 duplicate lines)" sits
208 commits AFTER the driver was removed, and the entry closes *"Recorded as a hypothesis with a known
counter-example rather than as the cause."* CLAUDE.md still says "confirmed". Same sentence, same
confidence, in `.gitattributes:9-11` and `.github/workflows/ingest.yml:355-357` (not living docs, but
live files a reader trusts). **What is safe to say:** the three large doublings (ancestry depth 329, 336,
383) all fell inside the driver's active window (307-417); a fourth, smaller one did not. Removing the
driver was correct; calling it THE cause is not supported.

**R2. `docs/ARCHITECTURE.md:42-43` — "7,040 duplicates from `merge -X ours` reconciliations".**
This is the diagnosis that 3.1.2 explicitly retracted the same day (`CHANGELOG.md:28242-28244`: *"That
is wrong, and acting on it would not have stopped a fourth occurrence"*). ARCHITECTURE.md is stamped
`Version 1.2 · 2026-07-24` (`:3`) and was never revisited. Two competing mechanisms for one measured
event now stand in two living documents, and neither is the tested one.

**R3. `docs/SEARCH.md:2506` — "An unattended auto-commit publishes on a timer here, so a commit id is
not a stable statement".** The timer died 2026-07-25 16:51; measured dead on 2026-08-06
(`CLAUDE.md:330-335`, `.githooks/pre-commit:4-10`). The SEARCH.md sentence sits in the 2026-08-05 E1
release-tag block — written eleven days after the last `auto:` commit. The conclusion it supports
(digest set over git tag) still stands for the OTHER reason given in the same paragraph (a dirty tree),
so the fix is to delete the clause, not the argument.

**R4. `docs/ENGINE.md:404` heading "HOW MANY MORE CARDS ARE HIDING? ABOUT ONE IN SIX", and `:410-411`
"3 of the 19 causes", and `:419-420` "the gap is about 3 causes. 6.0.0 should say so in those words".**
Retracted to **2 of 19** in CHANGELOG 5.273.0 (`CHANGELOG.md:78-82`) and in the SAME FILE one hundred
lines above (`docs/ENGINE.md:306-311`, commit `47bcc4d4`). The heading and the two sentences are not
struck. Not in the whitepaper, deck, technical docs, SUMMARY or MODELS — checked; the 5.272.0 claim
never propagated. The line-420 instruction to 6.0.0 is the dangerous copy: a fold-in that follows it
publishes the retracted number.

**R5. `CLAUDE.md:577-579` — "MEDICHAM is known incorrect — Weather Ball ignores three of the four
weathers on 8,620 uses, Sand Rush and Damp fire in Showdown and not here, Solar Beam never charges, a
transform never reverts."** Only Damp carries the STALE marker (`:583-590`), and that marker asserts the
other four *"were not re-checked in that pass and are NOT claimed fixed here"*. The record says all four
were re-checked:

| claim | refuting receipt |
|---|---|
| Weather Ball ignores three weathers | CHANGELOG 3.79.0 `:21137` "Sand Rush (1,426 uses) and Damp (623) are CORRECT"; `docs/ENGINE.md:36378` "WEATHER BALL IS CORRECT AND IS NOW PROVEN CATEGORICALLY"; `:43372` live probe into a Gengar, all four skies; **five living-doc copies** say *"Weather Ball, Sand Rush and Damp are retracted as defects and are correct"* (`whitepaper:1098`, `deck:928`, `technical-docs:1112`, `SUMMARY:883`, `MODELS:632`) |
| Sand Rush fires in Showdown and not here | same 3.79.0 line; ROADMAP #100 (`docs/ROADMAP.md:1314`, DONE 3.78.0): the roster's control arm was measuring the control, which manufactured the Sand Rush finding |
| Solar Beam never charges | `docs/ENGINE.md:43373` `chargeSkippedByWeather` LIVE; `:38809`, `:38834` the `\|-prepare\|` announcement |
| a transform never reverts | `docs/ENGINE.md:14488` — `tests/probe_transform_faint_revert.js`, knob `MEDI_TRANSFORM_SURVIVES_FAINT=1` |

The paragraph is deliberately dated evidence and says so; the defect is that the STALE marker itself
makes a false present-tense claim ("not re-checked"). One line — *"all five re-checked since; read the
gate"* — fixes it without editing history.

**R6 (aside — a live script, not a living document). `push-all.bat:9-10`** — "`git merge -X ours` ...
That is the confirmed cause of the store duplication". Retracted by 3.1.2; `CLAUDE.md:352-355` already
tells readers to ignore this header. A header that must be ignored should be deleted.

**Checked and CLEAN — the two known ones that did NOT propagate:**
- **9.7% → 11.69% mechanism (CHANGELOG 5.74.0 `:14326-14338`, refuted at 5.79.0 `:14057-14062`, ROADMAP
  #367 `docs/ROADMAP.md:1177`).** The refuted mechanism (`--team-store` "did not take", "no team-store
  field") appears in NO living document. `11.69` has zero hits outside CHANGELOG and ROADMAP.
  `docs/ENGINE.md:24028` quotes "9.7% -> 8.76%" as a later paired-arm delta, which is a different,
  re-measured claim. The 777-vs-961 story in `CLAUDE.md:669-673` and `technical-docs:21` names the
  `--games` flag, which 5.79.0 REPRODUCED (`--games 777` → 777, `--games 1200` → 961) — TESTED.
- **"one narration card in six"** — retracted 5.273.0; present only in ENGINE.md (R4) and the dated
  `docs/_reports/2026-09-09-batch-V.md:269`, which is historical by construction.

### HYPOTHESIS — plausible, stated as fact, nothing tested it (ranked by copies)

| # | claim | copies | why it is a hypothesis |
|---|---|---|---|
| H1 | The union driver / `-X ours` caused the duplications (R1+R2 as a pair) | 5 (`CLAUDE.md:356`, `ARCHITECTURE.md:43`, `.gitattributes:9`, `ingest.yml:355`, `push-all.bat:9`) | two incompatible mechanisms, one ancestry check, one counter-example; no reproduction of either |
| H2 | "The constraint is the objective, not the knowledge" (DODUO) — which is why the next step is a retrain | 2 (`SUMMARY.md:1254`, `MODELS.md:1934`) | inferred from the pattern of two objective wins and several knowledge nulls; never tested by a retrain; quarantined anyway |
| H3 | `CLAUDE.md:167-171` — concurrent heavy runs "pushed RAM toward swap" and a swapping desktop "looks FROZEN, which is why the symptom was a force-quit" | 1 | no RAM or page-fault measurement cited; the fix (BELOWNORMAL priority) was adopted on the diagnosis |
| H4 | `ARCHITECTURE.md:229` — the statistical models "never touch damage ... which is why none of the faults above reached them" | 1 | structural reasoning; no artifact compares those models before/after the faults |
| H5 | `technical-docs:1697` — open sheets "need both players to agree, which is why only ~1% of the closed store has sheets" | 1 | the 1% is measured; the attribution to mutual consent is not |
| H6 | `deck:213` — "six of those thirteen games have a SECOND thing wrong, which is why the board score only improved by seven when thirteen causes closed" | 1 | the six is not tied to an artifact field in the sentence; if it is `by_cause` from `data/game-differential.json`, cite it |
| H7 | `docs/ENGINE.md:26795-26796` — "a full-HP Excadrill in sand reads showdown 140 / medicham 280 at turn 0, so Sand Rush doubles here and not there ... left open" | 1 | two readings, one game, no probe; dated 2026-08-20; no later closure found by grep |
| H8 | `docs/OPS.md:87` — one value for two facts "is why a dead API and a quiet day were indistinguishable" | 1 | structural; no incident where the two were confused is cited |
| H9 | `CLAUDE.md:286` "OPS appends ... hourly" | 1 | not causal but load-bearing for the boundary question below: `ingest.yml:5-16` measured and moved the cron to every six hours on 2026-08-21 |

### TESTED — representative, with the receipt

| claim | copies | receipt |
|---|---|---|
| speed ties: "the cause is the SORT rather than the comparison" (selection sort) | 4 (`technical-docs:1216`, `whitepaper:1208`, `SUMMARY:993`, `MODELS:742`) | knob `MEDI_ENTRY_STABLE_SORT=1` (`ENGINE.md:21276`), census probe `move/perishClock` (`:20647`), "reproduced line for line" (`:37372`) |
| joint arm "non-deterministic" — withdrawn | 4 (`whitepaper:109`, `technical-docs:165`, `MODELS:75`, `MEASURE:867`) | corrected inline in all four; RUNNING-NOTES row |
| 777 vs 961 games = the `--games` flag | 2 (`technical-docs:21`, `CLAUDE.md:669-673`) | reproduced, 5.79.0 `CHANGELOG.md:14057-14062` |
| the gate clauses went blank: "the cause is a line ending" | 3 (`MEASURE:2121`, `SUMMARY:608`, `whitepaper:137`) | `stripCR` pinned in both directions (`CLAUDE.md:848-852`) |
| joint 110 / empirical 35 attributed to two fixes | 1 (`MODELS.md:89`) | knob-cleared runs on the same release reproduce the earlier figures exactly; `engine_release.js drift` names the one moved file |
| `brought` inflated by battle forme changes | 1 (`ARCHITECTURE.md:37-40`) | 1,003 of 1,033 offenders contain `mega`, counted (`CHANGELOG.md:28291-28296`) |
| 117x → 24.9x → 3.94x speed ratio | 6 living docs | re-measured, 8 contention-free reps (`MEASURE.md:162-179`); 8.8x slowdown withdrawn BEFORE publication |
| event die "translating rather than re-drawing" | 1 (`whitepaper:746-758`) | closed-form derivation plus the three-column table that follows |
| the "counts were a real measurement of a different population" (union of three raw stores) | 2 (`whitepaper:1711`, `SUMMARY:1319`) | reconstructed at the commit (git-history check) |
| card hypotheses in the redirection batch were wrong | ENGINE only (`:9222`, `:9311`) | each replaced by a probe named in the entry; this is the "thirty cards" pattern the brief names, and the ledger records it as such |

**Pattern worth stating once.** Every REFUTED-BUT-STILL-STATED item is a claim about INFRASTRUCTURE
(git, a timer, a heading) or a dated CLAUDE.md paragraph. The measured-result claims in the five
publication documents are, on this sample, either tested or corrected inline — the retraction registry
(`engine/docs_scan.js:585 retractionRegistry`, `:689 retractionViolations`) is doing its job for
FIGURES. It cannot see a MECHANISM, which is why R1-R3 survived: no number in them to strike.

---

## Q2 — is the Cowork / Claude Code boundary enforced by structure or by convention?

Rule text: `CLAUDE.md:141-153` (Cowork handoff) and `:190-205` (WHO MAY WRITE).

| clause | verdict | what enforces it, or what would |
|---|---|---|
| Cowork writes ONLY `docs/_inbox/` | **CONVENTION ONLY** | Nothing. `engine/orient.js:398-413` checks that the two folders EXIST and counts drafts; it cannot see who wrote a file. No hook clause (`.githooks/pre-commit`, `commit-msg`) names `_inbox`; `engine/docs_scan.js:1202` explicitly EXCLUDES `_inbox/_outbox` from the notes gate. **Cheapest check:** a pre-commit line refusing any staged `docs/_inbox/*.md` outside `applied/` — a draft is applied, never committed raw. It cannot police Cowork's VM, but Claude Code is the only committer, so anything Cowork wrote elsewhere arrives in a Claude Code commit and can be caught there only by diff review; no mechanism can attribute a byte to Cowork. |
| Claude Code writes ONLY `docs/_outbox/`, never `_inbox` | **CONVENTION ONLY** | Same pre-commit line as above covers it exactly, since every commit is Claude Code's. |
| Only Claude Code runs git | **ENFORCED for `push`, CONVENTION for `commit`/`rebase`** | GitHub credentials (`CLAUDE.md:195`: Cowork's shell "cannot authenticate"). A local commit or rebase needs no credential — which is precisely how the detached-HEAD-43-into-45 happened. Hooks cannot help: `core.hooksPath` is local config, not cloned, so Cowork's VM never has them. **None possible** beyond the credential wall. |
| Never both agents at once | **CONVENTION ONLY** | `.claude/skills/start/SKILL.md:85-96` asks the session to run `ListAgents`; it also records that the case that actually occurs is a SECOND CLAUDE CODE SESSION, which CLAUDE.md does not mention. **Cheapest check:** a lock file written by `/start` (PID + timestamp) and read by pre-commit — refuse if another live PID holds it. |
| `_inbox` figures not `<<MEASURED>>` are suspect | **CONVENTION ONLY** | Text in `CLAUDE.md:152` and `SKILL.md:108`; no scanner reads `_inbox` (excluded at `docs_scan.js:1202`). **Cheapest check:** a `--inbox-check` in `docs_scan.js` that prints every `%`/3-digit number in `docs/_inbox/*.md` not wrapped in `<<MEASURED>>`. Low value today: the inbox has held exactly ONE draft, on 2026-07-24 (`docs/_inbox/applied/001-ORIENTATION.md`; `git log -- docs/_inbox` shows nothing since). |

### The second publisher

**It exists and it is not in the table.** `git log -n 300`: 250 commits by Will Hooper, **50 by
`abra-bot`** (`ingest.yml:272-273`). The WHO MAY WRITE table (`CLAUDE.md:194-198`) lists Claude Code,
Cowork and the dead auto-commit; the bot appears only as "OPS appends the store hourly" (`:286`, `:706`)
— and that cadence is stale: `ingest.yml:5-16` measured the replay window and moved the cron to
**every six hours** on 2026-08-21.

**The race is handled by structure, on both sides:**
- Bot side — `ingest.yml:373-428`: `git fetch`, `git reset --hard origin/main`, re-append this run's
  rows to ORIGIN's store, dedupe by id, commit, `git push`, three attempts; `concurrency: group: ingest,
  cancel-in-progress: false` (`:19-21`) serialises bot runs against each other. Every bot commit is a
  fast-forward by construction; it never merges and never rebases.
- Local side — git's own non-fast-forward rejection (seen firing: `CHANGELOG.md:8077`), then the
  reconciliation: `.gitattributes` binds the stores to the `jsonl-store` driver (`build/merge-jsonl-store.js`,
  union by game id, longer record wins) and it IS bound in this clone (`git config
  merge.jsonl-store.driver` → `node build/merge-jsonl-store.js %O %A %B %P`; `git check-attr` confirms
  both stores). `push-all.bat` rebases before pushing but is disarmed behind `GO` and recent history
  shows no `manual push` commits — sessions push directly.
- Shared — `tests.yml` runs `tests/run-all.js` on every push from either publisher. It is the only
  gate both publishers pass through; the pre-commit hooks are local and the bot never runs them (its
  commits touch only `data/`, which the scope guard would skip anyway).

**The one hole:** the merge-driver binding is per-clone and manual (`build/setup-git.sh`). Nothing
tests that it is bound. A fresh clone that hits a store conflict falls back to git's line merge — the
destructive default the driver exists to prevent. **Cheapest check:** one clause in `engine/orient.js`
(it already has a WHO MAY WRITE block) — `git config merge.jsonl-store.driver` empty → `fail()`.

**Verdict for Q2:** 1 clause ENFORCED (push credentials), 1 ENFORCED for the race (git fast-forward +
bound driver + serialised workflow), **4 CONVENTION ONLY** (inbox-only, outbox-only, one-at-a-time,
suspect-figures). The second publisher is real, race-safe by construction, and undocumented in the
table that claims there is one.

---

## OWED, NOT RUN

Exact commands. None was run in this audit.

```bash
# R1 — test the union-driver claim instead of restating it: are ALL duplication events inside the driver's window?
git log --format='%h %ad %s' --date=short --all | grep -i -E "dedupe|duplicate" 
git log --format='%h' -S'merge=union' -- .gitattributes          # driver added / removed commits
git rev-list --count <driver-removed-sha>..009af26                # confirm the 208-commit gap

# R4 — strike the one-in-six heading in the ledger (edit, then the gates):
node engine/docs_scan.js --owed
node tests/test-docs-current.js

# R5 — read the gate rather than the paragraph, then stamp a one-line "re-checked since" pointer:
node engine/status.js
node engine/open_work.js

# H7 — the Excadrill 140/280 Sand Rush reading: is it closed?
grep -n "Excadrill" docs/ENGINE.md | head -40
node engine/where.js speedCond

# Q2 — the merge-driver binding, per clone:
git config merge.jsonl-store.driver
git check-attr merge -- data/games.ladder.jsonl data/games.bo3.jsonl
bash build/setup-git.sh                                           # if the first line printed nothing

# Q2 — branch protection on origin (not queried here; gh was out of scope for a read-only file audit):
gh api repos/willhoop/ABRA/branches/main/protection

# Full pass over the 167 strong-form causal lines in ENGINE.md (sampled here, not audited):
grep -n -i -E "confirmed cause|root cause|the cause (was|is)|the mechanism (is|was)" docs/ENGINE.md
```
