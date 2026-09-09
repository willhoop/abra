# Fix red tests, batch 1 — 2026-09-09 (MEASURE)

**Dated evidence, not current state.** Every line below was read from a command run on 2026-09-09
between roughly 20:00Z and 22:10Z on a tree whose engine release was `b730e44f3314`. Nothing in this
file is maintained; the register rows and RUNNING-NOTES row it proposes supersede it. No commit was
made. Rules honoured: no game_differential / roster / run-all / status.js; one game-playing probe at a
time; `tools\lownode.cmd` for every heavy run; `data/mechanics-census.json` proven byte-identical.

A previous MEASURE agent on this task was killed mid-edit. Section 1 is the audit of what it left.

---

## 1. Audit of the partial work — kept / reverted

Method: `git diff` of each named file, then the test that judges it. **Nothing was reverted**: every
partial edit was verified by running its instrument, and two of them needed correction (marked FIXED).

| file | what the prior agent did | verdict | how verified |
|---|---|---|---|
| `tests/probe_hazard_sweep_order.js` | Toxapex→Torterra (SR + Sand Tomb), Toxapex→Garganacl (DEFOG/TIDY) | KEPT, **FIXED** — the Torterra swap made Excadrill FAINT on turn 3 (Sand Tomb is 2x into Ground/Steel, Infestation was 0.5x) so the SPIN arm swept nothing and the CONTROL passed on an empty log; see §2.1 | probe run, Showdown log reproduced turn by turn |
| `tests/probe_turn_order.js` | Whimsicott Agility→Cotton Guard | KEPT, **extended** — the same sweep refused eight more pairings in this file the prior agent had not reached; see §2.1 | probe run: every arm `SPEED AGREES` |
| `tests/probe_weather_forme_faint.js` | inline `_switchKey \|\| name` / `set.species \|\| set.name` → `BS.stableKey(x, normId)` | KEPT — semantically identical to `stableKey`'s own branch order; `node --check` passes; NOT RUN (it builds a team pool and plays games) | `engine/identity_audit.js` → `UNROUTED 0`, green |
| `tests/bench-medicham.js` | float LCG → mulberry32 | KEPT | `tests/test-prng.js` 7/7 |
| `tests/test-mechanics.js` | three float LCG rng helpers → mulberry32 | KEPT | full run EXIT=0; census restored byte-exact (§2.2) |
| `tests/test-protocol-trace.js` | float LCG → mulberry32 | KEPT | `tests/test-prng.js` 7/7 (structural grep clean) |
| `tests/test-parse.js` | `// RAW-STORE-NOT-READ` line 1 | KEPT, **FIXED** — a `//` line above the `/*` block made `engine/conformance.js` flag "no opening comment"; folded into the block | conformance re-run |
| `tests/test-side-guard-chooser.js` | `// RAW-STORE-NOT-READ` | KEPT, FIXED (same fold) | conformance re-run |
| `engine/bench_speed_consolidate.js` | `// RAW-STORE-NOT-READ` | KEPT, FIXED (same fold) | selftest + conformance |
| `engine/click_counts.js` | `// RAW-STORE-OK` (mechanics-coverage count) | KEPT, FIXED (same fold) | selftest + conformance |
| `engine/replay_differential.js` | `// RAW-STORE-OK` (log is the authority whoever played) | KEPT, FIXED (same fold) | selftest + conformance |
| `data/replay-differential-freezes.json` | moved the existing `generated` key above the 430-char `note` so it sits inside conformance's 400-byte header window | KEPT — the stamp is the file's own, unchanged | conformance: finding gone |
| `data/whole-game-baseline.json` | added `generated` = existing `stamped` | KEPT, **FIXED** — it was appended after a long `what` and still fell outside the 400-byte window; moved to line 2 | conformance: finding gone |
| `data/store-validation.json` | `node engine/validate_store.js --write` at 18:46:06Z | KEPT — **complete, not torn**: `judged.games 92379` = `wc -l` of the ladder store, 0 unreadable lines, 425.7 s; HEAD's copy was 2026-08-27 on 67,384 games | `tests/test-quality.js` reads it: `the legality verdict was read (2026-09-09T18:46:06.725Z)`, `155 resolved + 0 forme-only = 155 expected` |
| `data/conformance.json` | rewritten by a conformance run at 18:51Z | KEPT — it is the ratchet's own artifact and is rewritten by any run whose findings differ; my two runs rewrote it again | — |

Files this session touched that were not on the audit list: `engine/mega_census.js`, `engine/sheet_usage.js`,
`engine/smogon_coverage.js` (one declaration line each, §2.6) and `tests/probe_punish_side_and_sky.js`
(§2.1). Not touched: anything on the forbidden list.

---

## 2. The six targets

### 2.1 `tests/test-fixture-legality.js` — RED → still RED, but every site in the three named files is gone

**Red line before** (`FIXTURE LEGALITY: 3 FAILED`, this tree, 20:0xZ):
```
FAIL  32 NEW illegal fixture set(s). The game would refuse these teams:
FAIL  26 NEW illegal DECLARATION(S) that no verdict sentence names:
FAIL  1 string literal(s) inside a set declaration name nothing in this format: "off" tests/probe_punish_side_and_sky.js:161
```
**This is not the 3-finding list the pre-6.0.0 review reported.** The validator and the Showdown data are
unchanged (`pokemon-showdown` HEAD `20ad99f` 2026-07-22; `dist/data/mods/champions/learnsets.js` mtime
2026-08-03; nothing under `dist/` modified this week; `learnCounters.validatorThrew 0`), so these sets
were refused at 16:03Z too and the review's count was low. I could not establish why; it is recorded,
not explained. The refusals are real Champions learnset facts read through `champions_sim.canLearn`
(e.g. `data/mods/champions/learnsets.ts` Incineroar block carries `fakeout` and no `knockoff`).

**Changes** — every carrier DERIVED from `Dex.forFormat('gen9championsvgc2026regmb')`, none typed:

`tests/probe_turn_order.js` (8 pairings refused; each arm's premise kept):
- never-clicked fillers on the same body: Incineroar Knock Off → Flare Blitz (5 sites); Garchomp's Scarf
  fillers Thunder Wave/Agility → Earthquake/Dragon Claw; Milotic's bench filler Agility → Recover.
- clicked priority-0 fillers: Incineroar Agility → Bulk Up (Status, priority 0, self, touches no Speed) at
  6 sites and in every script line that clicked it.
- where the MOVE is the point, the body moved to the nearest legal base Speed: four-Tailwinds arm
  Incineroar 60 → **Toucannon 60**, Garchomp 102 → **Pidgeot 101** (both learn Tailwind; Keen Eye);
  Scarf-x-Tailwind arm's Tailwind setter Garchomp → Pidgeot; paralysis arm Garchomp Thunder Wave →
  **Archaludon** (Stamina) Thunder Wave, and the Scarf holder Milotic 81 → **Maushold 111** (learns
  Agility; base Speed ODD, which the arm's truncation argument requires — comment updated to say so);
  Unburden arms Garchomp Knock Off → **Toucannon** Knock Off (2 sites).
- header paragraph added naming every refusal and repair.

`tests/probe_hazard_sweep_order.js` (2 more refusals + the prior agent's substitution corrected):
- Milotic Reflect → Light Screen (same `sideCondition` class Defog removes); Archaludon Body Press →
  Dragon Claw (priority-0 physical, no secondary).
- **SPIN arm:** Whimsicott's filler Moonblast → Cotton Guard. Reproduced on the authority: with the
  prior agent's Torterra/Sand Tomb the log read `|faint|p1a: Excadrill` on turn 3 BEFORE Rapid Spin
  (128→54→8→0 across turns 2–3), so both engines swept nothing. With Cotton Guard Excadrill ends turn 3
  on 44/185 and the spin removes seed, rocks and trap.
- **CONTROL arm:** click Iron Head → Swords Dance. A +4 Iron Head KOs Torterra (it did not KO Toxapex)
  and the authority then writes `-end|Excadrill|Sand Tomb|[partiallytrapped]|[silent]` — a trap ending
  because its source fainted. Before this session the control was passing on an EMPTY log (Excadrill
  dead). `spinScript`/`spinBuild` now read `dex.moves.get(mv).target` and pass no target for a self-move
  (the authority REFUSES `move swordsdance 1`).

`tests/probe_punish_side_and_sky.js`: the toll knob `['on','off']` → `['Rough Skin','Sand Veil']`
(Garchomp's own two abilities from the dex, `{0: Sand Veil, H: Rough Skin}`), and line 161 passes `sub`
straight through.

**Green lines after:**
```
tests/probe_turn_order.js        EXIT=0  — every ordering arm agrees; SPEED AGREES on all 5 speed arms (16/20/20/20/24 readings)
tests/probe_hazard_sweep_order.js EXIT=0 — ALL ARMS PASS; CONTROL authority [] medicham2 []; SPIN/DEFOG/TIDY sequences agree; child under MEDI_SWEEP_LEGACY_ORDER=1 exits 1 with 3 FAIL lines
tests/probe_punish_side_and_sky.js EXIT=0 — every arm ok
tests/test-fixture-legality.js: "ok  no new stray literal (0 known)"; 0 sites in the three files above
```
**Still red, and why:** `FIXTURE LEGALITY: 2 FAILED` — **25 NEW illegal sets / 19 declarations** remain
in 21 OTHER files, including `engine/game_differential.js:6179,6249,6318,6341` (Incineroar Knock Off),
which this brief forbids touching, and six `[EXISTENCE] … more than the limit of 4` moves sets. Full list
in `## OWED`. Cannot go green in this batch.

### 2.2 `tests/test-prng.js` — RED → GREEN; census byte-identical

Before: `no file multiplies its state by 1103515245 in float arithmetic` FAIL on `tests/bench-medicham.js`,
`tests/test-mechanics.js`, `tests/test-protocol-trace.js`. After: `PRNG TESTS: 7 passed, 0 failed`.

`tests/test-mechanics.js` full run under lownode: **EXIT=0**. It has no non-writing mode (writes the
census unconditionally unless a deliberate-break knob is set), so the census was hashed before
(`098de577…`), the run rewrote it (`249631c3…`: only `generated` and four rate strings moved — Iron
Head 20.3→21.3%, Moonblast 10.4→9.4%, Fiery Dance 45.3→49.8%, every verdict unchanged), and it was
restored with `git checkout -- data/mechanics-census.json`. **`sha256` matches the before-hash and
`git diff --stat data/mechanics-census.json` is empty.**

### 2.3 `engine/identity_audit.js` — RED → GREEN

Before: `RED — 2 identity read(s) do not go through the door` (`probe_weather_forme_faint.js:153,154`).
After: `UNROUTED 0 … green — every HARD identity read is the door, a stamp, routed, or declared.`
The probe itself was not run (it plays games); `node --check` passes.

### 2.4 `engine/conformance.js` S13 — the two named findings GONE; the gate is still red for other reasons

Before: `S13 | data/replay-differential-freezes.json | generated but does not say so`,
`S13 | data/whole-game-baseline.json | generated but does not say so`. After two runs: neither appears.
The header folds also took the convention count 29 → 24. `engine/conformance.js` still exits 1:
`RATCHET — 96 baselined, 121 new (106 regression, 15 discovery), 15 fixed` — tree-wide, not this batch's.
`scenarios-from-will.json` / `side-selection-declarations.json` "no generator writes it" were not
addressed (no generator exists to name).

### 2.5 `tests/test-quality.js` — 29/3 → 31/1; the drift clause is red and stays red on purpose

First run this session (20:1xZ): `FAIL same count: JS 32040, Python 32092`, `FAIL identical selection`,
`FAIL clean share 34.7% vs 28.0% recorded (drift 6.7 pts)`. Second run (21:5xZ): parity **ok** —
`JS 32040, Python 32040`, `sha f3903d12ab0d5151` both sides — on the same store bytes (mtime 17:05Z,
92,379 rows, 0 duplicate ids). The parity failure is **not reproducible** and no reader changed; the
likeliest cause is another agent's process on the store tree at the time (OPS shards under `data/raw/`
were written 20:46–20:55Z). Recorded, not attributed.

**Drift 6.7 pts is corpus, not filter.** `engine/quality.js` / `quality.py` are unchanged since
2026-08-27; the store gained 15,862 recovered games in HEAD `49793320` (14:19 local, after the review's
run) and grew 67,384 → 92,379; the live funnel is `92379 → 53278 → 47237 → 47049 → 44406 → 32141 → 32040`
(name-bot stage 57.7% pass vs 46.8% recorded — the recovered games are less bot-heavy). The recorded
block in `data/quality-filter.json` says of itself "It is restamped rather than the tolerance being
widened", so the restamp is the sanctioned fix — **but `data/quality-filter.json` is a frozen engine
SOURCE** (`data/releases/b730e44f3314/data/quality-filter.json`): writing it moves the release digest
under the agent that is measuring this wave. **Left unwritten; proposed block in `## OWED`.**
Tolerance not raised.

### 2.6 `engine/selftest.js` — 16 raw readers → 4 (declarations only)

Declared **RAW-STORE-OK** (one line inside the opening block): `click_counts.js` (mechanics coverage,
prior agent), `replay_differential.js` (log is the authority whoever played, prior agent),
`mega_census.js` (mega EVENTS for the coverage bar), `sheet_usage.js` (declared ability/item usage for
the gate's deferral; the line states the bot-inflation caveat), `smogon_coverage.js` (which species the
store CONTAINS vs Smogon's ladder). Declared **RAW-STORE-NOT-READ**: `bench_speed_consolidate.js`,
`tests/test-parse.js`, `tests/test-side-guard-chooser.js` (prior agent). Others cleared by work outside
this batch (e.g. `durable-ingest.js` carries a `// RAW-STORE-OK` line from another agent — see §3).

After: `24 passed, 1 failed — 4 file(s) read the ladder store with neither a clean filter nor a
RAW-STORE-OK declaration`. The four are **illegitimate raw reads, listed as owed, not declared**:
- `engine/joint_click_census.js` — a model of HUMAN clicks (target/switch prior for the empirical
  driver) read off raw logs with no bot exclusion; ~43% of the store fails the name-bot rule alone.
- `engine/rollout_switch_census.js` — "how often does a REAL game switch", same shape, same hole.
- `engine/mega_sets_from_sheets.js` — declared movesets for megas; a one-team behavioural bot with
  hundreds of games weights one set.
- `engine/medicham2-browser.js` — mentions the path in a comment only (line 7460); needs
  `RAW-STORE-NOT-READ`, forbidden to touch this wave → ENGINE.

---

## 3. Observations not asserted

- **medicham2 wrote nothing when a trapper fainted.** In the control repro the authority wrote
  `-end|p1a: Excadrill|Sand Tomb|[partiallytrapped]|[silent]` on Torterra's faint; medicham2's trace had
  no `-end`. Whether the volatile is cleared on the BOARD was not checked here. ENGINE, narration gate
  at minimum.
- `engine/durable-ingest.js` carries a `// RAW-STORE-OK` line above its block comment (another agent's
  edit, 76-line diff) and conformance flags it "no opening comment" — same fold needed, not mine.
- The review's fixture-legality count (3) vs this tree's (32 before repairs) is unexplained; the
  validator, format and Showdown data did not move.

---

## 4. Proposed RUNNING-NOTES row (NOT written)

> **2026-09-09 — MEASURE — batch 1 of the pre-6.0.0 red list.** `tests/test-prng.js` 6/1 → 7/0 (three
> float LCGs → mulberry32; `data/mechanics-census.json` proven byte-identical after the test-mechanics
> run). `engine/identity_audit.js` 2 UNROUTED → 0. `engine/conformance.js` S13: the two "generated but
> does not say so" findings on `replay-differential-freezes.json` / `whole-game-baseline.json` gone;
> convention 29 → 24. `engine/selftest.js` raw readers 16 → 4 (owed: joint_click_census,
> rollout_switch_census, mega_sets_from_sheets, medicham2-browser). `tests/test-quality.js` 29/3 → 31/1
> on the refreshed legality verdict (`data/store-validation.json` 2026-09-09T18:46Z, 92,379 games);
> drift 6.7 pts is the 15,862-game recovery, restamp owed. `tests/test-fixture-legality.js`: 11 illegal
> pairings + 1 stray literal repaired across `probe_turn_order.js`, `probe_hazard_sweep_order.js`,
> `probe_punish_side_and_sky.js` with carriers derived from the format; all three probes green; the
> SPIN control was passing on an empty log and now passes on a live Excadrill. 25 sets / 19 declarations
> remain in 21 other files. **Basis.** unchanged. **Supersedes.** Nothing published.

## 5. Proposed CHANGELOG bullets (NOT written — MINOR, no published figure moves)

- Fixed: three float-LCG generators in `tests/` replaced by the shared mulberry32; `test-prng` green.
- Fixed: the two hard identity reads in `probe_weather_forme_faint.js` now go through `stableKey`.
- Fixed: 11 fixture pairings the Champions validator refuses, in three probes, repaired with derived
  carriers; the hazard-sweep SPIN control no longer passes on an empty log.
- Fixed: `generated` stamps of two artifacts are inside conformance's header window; five RAW-STORE
  declarations folded into their opening block comments.
- Changed: `data/store-validation.json` refreshed on 92,379 games.
- Notes: 4 raw-store readers, the quality funnel restamp and 25 fixture sets remain owed (see report).

---

## OWED, NOT RUN

1. **Fixture legality, 25 sets / 19 declarations in 21 files** — `engine/game_differential.js`
   (Incineroar Knock Off x4; forbidden this wave), `tests/test-resolution-order.js` (Archaludon Body
   Press x2, Basculegion Final Gambit x2, Clefable Toxic), `probe_direclaw_refusal_line.js`,
   `probe_fail_names_the_move.js`, `probe_faint_before_source_gone_end.js`, `probe_recoil_on_a_corpse.js`,
   `probe_refusal_this_engine_swallowed.js`, `probe_shield_before_ability.js`,
   `probe_yawn_safeguard_refusal.js` (Kingambit / Garchomp / Milotic Nasty Plot), `probe_curse_pressure_pp.js`
   (Clefable Curse), `probe_ally_forced_switch.js` (Garchomp Roar), `probe_entry_announce_batched.js`
   (Gengar Explosion), `probe_pivot_magic_bounce.js` (Incineroar U-turn), `probe_choicelock_cleared.js` and
   `test-imposter-transform-line.js` (Incineroar Knock Off), `probe_doll_blind_family.js` (Malamar Power
   Split / Simple Beam), `test-effect-credit.js` (Meowscarada Swords Dance), `probe_selfdestruct_winner.js`
   (Reuniclus / Steelix Explosion), `probe_substitute_status_step.js` (Slowbro Swagger),
   `probe_endturn_clock_order.js` (Snorlax Double Team), `test-encore-fail-silent.js` (Snorlax Whirlwind);
   EXISTENCE (>4 moves): `probe_default_target_side.js:146,148`, `probe_megasol_announce.js:119,120`,
   `probe_encore_bracket.js:148`, `probe_priority_modified.js:152,153`, `probe_shield_rearm.js:115`.
   Each repair moves what its scenario measures; one file per pass, probe re-run each time.
2. **Quality funnel restamp** in `data/quality-filter.json` `provenance` (frozen SOURCE — do it in a
   pass that re-cuts the release): `measured_on 2026-09-09`, `store_size 92379`, funnel
   `92379 / 53278 / 47237 / 47049 / 44406 / 32141 / 32040`, and extend `why_this_block_was_restamped`
   with the 15,862-game recovery of `49793320`.
3. **Four raw-store readers** (§2.6): bot-exclude via the store's ids for the two censuses and the
   mega-set harvest; a `RAW-STORE-NOT-READ` line in `engine/medicham2-browser.js` (ENGINE).
4. **`engine/quarantine.js --stamp-whole-game` should write `generated`** (it writes `stamped`); the
   `generated` key added by hand disappears on the next stamp and the S13 finding returns. Forbidden file
   this wave.
5. `tests/probe_weather_forme_faint.js` — re-run to prove the `stableKey` routing plays (not run: builds
   a pool and plays games).
6. `engine/durable-ingest.js` header fold (another agent's `//` line).
7. medicham2's missing `-end … [silent]` on a trapper's faint — check the board volatile, then the
   narration gate (ENGINE).
