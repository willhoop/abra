# The speed-tie corner arms now measure something, and ties are clean

**Historical by construction. Every figure here is derived; re-derive rather than quoting this file.**
`node engine/status.js` prints what is true now.

**One line.** Both corner arms of `engine/game_differential.js` now play as the run's primary arm, carry
a pin-completeness receipt in place of a void filter that never applied to them, and REFUSE instead of
scoring zero over an empty population — and on the fixed instrument the tie question answers **CLEAN**:
**71,009 speed-tie groups resolved across the two corners' 1,922 games and ZERO board-material
divergences attributable to tie order.** The middle arm is unmoved at **BOARD-MATERIAL 0 of 961** and
**NARRATION 0 undeclared of 961**.

---

## 0. THE PREDICTION, WRITTEN FIRST

`data/verification/_prediction-2026-09-10-corner-arms.json`, written before any file was edited.

| # | predicted | measured | |
|---|---|---|---|
| 0 | the probe is RED on today's bytes | 15 claims RED | ✔ |
| 1 | the fix is `RUN_PRIMARY = ARMS_RUN[0]`, `PRIMARY_ARM` stays `ARMS[0]` for the eight external callers | exactly that | ✔ |
| 2 | 961 games, 8,000–16,000 boundaries, **top > bottom** | top 12,632, bottom 9,020 | ✔ |
| 3 | board-material ≈ 15 top / ≈ 13 bottom, allow 5..30 | **16 of 961** and **15 of 961** | ✔ |
| 4 | **ties are CLEAN**; `ordering` contributes ~0 board-material games | see §4 — clean | ✔ |
| 5 | `mid_void` is the wrong instrument; the receipt reads zero violations; ~25% risk a live stream leaks | zero violations on both corners; nothing leaked | ✔ |
| 6 | the refusal fires on no arm run at 1200 games | it did not fire on any measured run | ✔ |
| 7 | **the middle arm does not move** — 961 / 10,705 / 0 / 0 | 961 / 10,705 / 0 / 0, `mode` byte-identical | ✔ |
| 8 | I expect NOT to have to file a NOT-A-DEFECT tie decision | none filed | ✔ |

Prediction 3's basis was the previous chain's per-arm `end_state` by-cause block (15 and 13 games),
which is a different cause vocabulary from the board-leaf shapes reported below. The numbers landing one
apart is agreement, not identity.

---

## 1. THE PROBE, WRITTEN FIRST AND SHOWN RED

`tests/probe_corner_arm_measures.js`. On the pre-fix bytes, **15 claims FAILED**:

```
  ---- CORNER — top-tie-first as the only arm ----
  state.games 0   turn_boundaries_compared 0   games_board_never_diverged 0   BOARD-MATERIAL 0 of 0
  FAIL  A CORNER ARM PLAYS GAMES INTO `results`
  FAIL  A CORNER ARM COMPARES A BOARD
  FAIL  the receipt names the arm it measured        pins.primary = middle
  FAIL  `mode` carries the arm                        mode = A/middle/...
  FAIL  the corner arm carries a `corner_pin` receipt
  FAIL  `mid_void` is NULL on a corner arm            mid_void = object
  ---- CONTROL — MEDI_DIFF_LEGACY_PRIMARY=1 ----
  FAIL  THE EMPTY CASE EXITS NON-ZERO                 exit 0
  FAIL  THE EMPTY CASE DECLARES ITSELF VOID           void = undefined
  FAIL  THE EMPTY CASE BLANKS `state`                 state = PRESENT, games 0 / never_diverged 0
```

The two pre-fix artifacts are kept beside the new ones as
`data/verification/game-differential-{top,bottom}-tie-first.PRE-FIX.json`.

---

## 2. THE THREE FIXES

### A. A corner arm now runs as the run's primary — ROADMAP #569

`--arm` moved `ARMS_RUN`; it did not move the arm whose games become `results`. `PRIMARY_ARM = ARMS[0]`
is always `middle`, so on a corner-only run `isPrimary` was false for every arm, `results` stayed empty,
and `STATE_SUMMARY` walked nothing. **The bar the quarantine clause names — `state.games` less
`state.games_board_never_diverged` — then computed `0 − 0 = 0`, byte-identical to a perfect score.**

Two names now, because they are two questions:

```
PRIMARY_ARM   the default pin a caller gets when it names no arm      = ARMS[0]
RUN_PRIMARY   the arm whose games become `results` on THIS run        = ARMS_RUN[0]
```

`PRIMARY_ARM` is unchanged and still exported, because **eight callers outside the file read it as a
default pin** — `tests/roster.js`, `engine/replay_one.js`, four probes and two tests — and
`tests/roster.js:1014` records by name what moving it cost on 2026-08-13 (`ARMS[0]` silently stopped
meaning `top-tie-first` and handed Showdown a live crit die while medicham kept a pinned one).
`RUN_PRIMARY` drives `results`/`control`, the `mid_void` gate, `PINS.primary` and `MODE`. On a default
run and on `--arm middle` the two are the same object, which is why §5 finds the middle arm unmoved.

### B. `mid_void` was the wrong instrument, not a missing one — ROADMAP #570

**The framing in the previous report is REFUTED.** It read: the low-identity exclusion is middle-only,
so a corner arm cannot separate an engine board split from a dice-stream split. **A corner arm has no
dice stream.** `engine/game_differential.js`'s own ARMS comment says so — *"Every other arm's dice are a
constant and cannot desynchronise"* — and the code says it twice: the authority-side `random` on a
corner arm is a pure function of its arguments (`m-1` / `0` / `damageIndex` / `m`, no state read, no
counter), and `mediRng` answers every named stream with `() => spec.corner`. Nothing is excludable, so a
void FILTER there can only publish a `0` that reads as *the instrument could not tell*.

That sentence is an ARGUMENT, and an argument is what this repository keeps paying for. So it is
MEASURED. `corner_pin` is a **pin-completeness receipt** over every draw actually taken: one call shape,
one value, on both sides, all run.

**It can fail, and the shape that would do it is named.** `mediRng` builds the corner object as
`Object.assign({}, streams, { any, acc, crit, sec, dmg, stall, tgt, tie })` — a **typed** override list
over a live `M.rngStreams` LCG. A stream medicham2 gains that the list does not name comes through LIVE
against a pinned constant: the mispinned die of CHANGELOG 3.45.0, and the corner-arm analogue of a
desync. Measured on 961 games:

| | authority draws / shapes | medicham draws / streams | shapes or streams with >1 value |
|---|---|---|---|
| top-tie-first | 186,425 / 20 | 160,957 / 8 | **0** |
| bottom-tie-first | 139,193 / 24 | 132,463 / 8 | **0** |

**And the receipt has a red arm, because a green check with none is a check that might be asking
nothing.** `MEDI_CORNER_UNPIN=tgt` restores the live LCG for one stream; the receipt names it and the
run refuses:

```
!! MEDICHAM STREAM NOT PINNED  tgt  values [0.3313907450065017, 0.41589992004446685, ...]
!! THE CORNER PIN IS INCOMPLETE, so this arm cannot tell an engine board split from the ruler's own.
   The figures are withheld rather than captioned.                                    exit 1
```

`MEDI_CORNER_UNPIN=acc` is refused **earlier still**, by `PIN_CLAIMS` at module load — *"THE PIN IS
WRONG — accuracy, crit, secondary and damage are ALL still the corner"*, exit 1 before a game is played.
That guard already existed and is stronger; `tgt` carries no `PIN_CLAIMS` row, which is exactly the gap
the receipt covers — the claims are a typed list, the receipt is over every draw taken.

### C. An empty population refuses instead of scoring zero — ROADMAP #569

Three clauses, all reachable, none inferred from another:

1. the primary arm produced **no games**;
2. games were played and **no turn boundary** was compared (asked only when `--state`/`--end-state` is
   on, since a protocol-only run legitimately compares no board and says so by carrying no `state`);
3. the **corner pin is incomplete** (§B).

Any one sets `void: true` — which `engine/provenance.js` honours as a self-declaration — **blanks**
`diverged`, `mid_void`, `corner_pin` and `state`, and exits non-zero. Same treatment `driverCodeGuard`
gives an instrument that moved mid-run, and for the same stated reason: a caption is not a quarantine.

---

## 3. THE RUNS, WITH EVERY PIN AND EVERY FLAG

Release **`8ac9c4d888f1`** — cut after the edits and **the id did not move**, which is the finding:
`engine/game_differential.js` is not one of the 27 frozen SOURCE files, so **no engine byte changed in
this pass.** Everything below is the instrument.

Census `data/mechanics-census.json` digest **`257acf955593`**, team pool
`data/team-pool-frozen` (`0d103fb9fa87`, 1968 teams from a corpus of 8778),
`--steering empirical --end-state --games 1200 --turns 50 --write --out …`, every leg through
`tools\lownode.cmd`. **961 games of the 1200 requested** on all three arms — the pinned pool truncates.

```bash
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release 8ac9c4d888f1 \
  --arm <ARM> --end-state --census data/mechanics-census.json --games 1200 \
  --team-store data/team-pool-frozen --turns 50 --write --out data/verification/game-differential-<ARM>.json
```

**Judged on the artifact's own `generated` stamp and the size of its output, never on the exit code.**

| clause, named | middle (recheck) | top-tie-first | bottom-tie-first |
|---|---|---|---|
| `generated` | 08:03:18.736Z | 08:08:27.954Z | 08:11:12.071Z |
| `mode` | `A/middle/pins:de38d17e15a2/…` | `A/top-tie-first/pins:7759a509491f/…` | `A/bottom-tie-first/pins:844515f6a72a/…` |
| **BOARD-MATERIAL** = `state.games` less `state.games_board_never_diverged` | 961 − 961 = **0** | 961 − 945 = **16** | 961 − 946 = **15** |
| `turn_boundaries_identical` / `turn_boundaries_compared` | 10,705 / 10,705 | 12,558 / 12,632 | 8,990 / 9,020 |
| `protocol_diverged_games` | 1 | 25 | 33 |
| `protocol_diverged_board_never_did` | 1 | 10 | 20 |
| `board_parted_before_the_protocol_did` | 0 | 1 | 2 |
| `games_cut_off_by_the_turn_cap` | 0 | 2 | 0 |
| `games_void_excluded` | 0 | 0 | 0 |
| `mid_void.usable_games` | 961 of 961 | **null** (§2B) | **null** (§2B) |
| `corner_pin.usable_games` | null | 961 of 961, 0 violations | 961 of 961, 0 violations |
| median turn of first board divergence | — | 10 | 6 |

`state.first_board_divergences` is `.slice(0, 40)` and `first_divergences` is `.slice(0, 60)`. **On these
runs the caps do not bite** — 16 and 15 board rows, 25 and 33 protocol rows — so the lists below ARE the
populations, and that is checked rather than assumed.

---

## 4. THE TIE QUESTION — CLEAN, AND THE FIXTURE IS ENORMOUS

**The instrument was already there and had never been read against a corner arm that ran.**
`speed_ties` counts the groups Showdown's own `speedSort` asked its shuffle to resolve, and
`sim/battle.ts:455` calls `prng.shuffle` **only** when `nextIndexes.length > 1` — a genuine tie group —
which is why `shuffle_calls` and `tied_groups_resolved` are equal by construction.

| | tie groups resolved | of size 2 / 3 / 4 / 5 / 6 | tie sequence saturated |
|---|---|---|---|
| top-tie-first | **38,319** | 37,789 / 446 / 67 / 9 / 8 | 0 |
| bottom-tie-first | **32,690** | 32,114 / 469 / 91 / 8 / 8 | 0 |

**71,009 tie groups across 1,922 games, and ZERO board-material divergences attributable to tie order.**
That is the answer, and it is not an absence of evidence — it is a very large fixture returning nothing.

**The `ordering` class is not the tie class, and reading it as one would have manufactured a finding.**
Of the two corners' protocol classes, `ordering` (2 top, 6 bottom) and `turn order` (1 top) are the only
candidates. Every `ordering` row is two events in a different order **within** a turn, not a different
actor: `|-activate|skillswap` against `|-end|flashfire`; `|-start|typechange|[from]burnup` against
`|faint|`; `|-status|frz` against `|-resisted|`; `|-enditem|sitrusberry|[eat]` against `|-unboost|atk`.
Seven of the eight part no board at all. The one that does (bottom, `omit-weather` t4) is
`|upkeep` against `|faint|p2a` after a `perish0` — **the perish drain Will closeted on 2026-08-28**, in a
corner arm, parting a board at turn 8 on one HP leaf. That is a known, declared row reaching a board in
a corner it does not reach in the middle; it is recorded here and is not a new defect.

**The one genuine turn-order divergence is a Speed Swap, not a tie — ROADMAP #571.** Top arm, config
`pair-redirect-priority`, seed `…-2656451791 vs …-2656439218`, turn 8: the authority moves Pelipper
(Weather Ball), this engine moves Sylveon (Hyper Voice), and the board parts on two fainted bodies.
MEASURED at that boundary rather than inferred — Showdown's `getStat('spe')` for `p1a sylveon` reads
**91**, this engine's `effSpeed` reads **166**, `same_when_floored: false`. A real speed-VALUE gap
cannot be a tie. The game contains `Speed Swap` from p2a Alakazam onto p1a Sylveon at turn 5, after
which Sylveon switched out (t6) and back in (t7); no earlier boundary in the game records a disagreeing
speed reading. Root cause deliberately **not guessed**: Showdown's `clearVolatile`
(`sim/pokemon.ts:1514`) does not reset `storedStats`, and this engine's `statrewire` writes `m.st`/`t.st`
(`engine/medicham2-browser.js:32280`). Filed and left.

**No NOT-A-DEFECT decision is owed to Will.** The brief anticipated a tie divergence with no correct
answer; none was found.

### The board-material causes, by leaf shape

Both lists are complete (the 40-cap does not bite). Normalised `active[N]` → `active[]`, party keyed by
`<mon>`.

| top-tie-first, 16 games | n | | bottom-tie-first, 15 games | n |
|---|---|---|---|---|
| `active[].hp + party.hp` | 4 | | `active[].hp + party.hp` | 3 |
| `active[].vol.encore` | 4 | | fainted family (`fainted+hp+maxhp+species+status`) | 2 |
| fainted family (`fainted+hp+status`) | 2 | | `active[].boosts.atk + party.boosts.atk` | 2 |
| `hp + item + party.hp + party.item` | 1 | | fainted family (`fainted+hp+status`) | 2 |
| `boosts.atk + boosts.spa + species` | 1 | | `active[].stall` | 2 |
| `screens.named.lightscreen + screens.special` | 1 | | `boosts.def + boosts.spd` | 1 |
| `item + vol.choicelock + party.item` | 1 | | `status + party.status` | 1 |
| `hp + party.fainted/hp/status + weather_turns` | 1 | | `ability+item+maxhp+species+types+pp[1]×3` | 1 |
| `boosts.def/spd + hp + types + party.…` | 1 | | `hp + stall + party.hp` | 1 |

**The previous report's "the two corners share ZERO causes" is superseded, not contradicted** — it was
computed over `end_state[0].summary.by_cause`, a different vocabulary, on artifacts that compared no
board. On the board-leaf vocabulary the two corners share three shapes, the largest being
`active[].hp + party.hp` (4 top, 3 bottom).

**These are not "dice shapes".** The earlier reading — miss/crit/damage-roll causes are the signature of
unshared dice — cannot apply: §2B measures both engines answering every draw from a constant, with zero
violations, so there is no unshared die to be the explanation. What the corners exercise that the middle
does not is the EXTREMES: every sub-100 move missing (top) or every sub-100 move hitting and every crit
landing (bottom), which is a different game and legitimately reaches different code.

---

## 5. THE PART THAT WAS EASY TO MISS — THE MIDDLE ARM DID NOT MOVE

The instrument that produced tonight's headline was changed, so it was re-run under identical pins to
`data/verification/game-differential-middle-recheck.json`:

```
PUBLISHED 07:04  games 961  bnd 10705  never 961  BOARD-MATERIAL 0  proto 1  proto_board_never 1
RECHECK  08:03   games 961  bnd 10705  never 961  BOARD-MATERIAL 0  proto 1  proto_board_never 1
mode  A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real   — identical on both
first_board_divergences  0 rows on both
```

**BOARD-MATERIAL 0 of 961 and NARRATION 0 undeclared of 961 both hold.** `data/game-differential.json`
was NOT overwritten — the recheck is a separate artifact, so the published slot still carries the 07:04
run and the publisher decides whether to refresh it.

`node engine/quarantine.js` → **GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld**, all
clauses PASS, including *"BOARD-MATERIAL: 0 of 961 games"* and *"NARRATION-ONLY: ZERO undeclared across
961 games"*.

Adjacent instruments, all green after the change: `tests/test-game-differential.js` **ALL PASSED**
(including PART 3b's damage interior and PART 3c's three distinguishable arms),
`tests/test-speed-tie.js` **PASS — every arrangement agrees, and the tie is a coin**,
`tests/test-middle-damage-roll.js` **all clauses green**, and its broken arm still breaks.

---

## 6. WHAT WAS FOUND AND LEFT

- **#571** — the Speed Swap / switch speed gap above. One board-material game, top corner only.
- **#572** — `engine/replay_one.js:187` decides whether to play the stones-removed CONTROL game with
  `arm.id === G.PRIMARY_ARM.id`. That was harmless while a corner arm could not be primary; now a
  corner-primary replay skips one control game per pair and starts the target game from a different
  driver state. The tool already prints `NO STORED RECORD … UNCHECKED` and writes no artifact. Owed: a
  `--run-primary <id>` flag defaulting to `PRIMARY_ARM.id`.
- **The speed-agreement table is entirely corpse reads and is not a finding.** All 735 rows (top), 454
  (bottom) and 558 (middle) carry `status=-/sd:fnt` — Showdown's body is FAINTED at the reading, so its
  `runEvent('ModifySpe')` handlers do not fire and `getActionSpeed` returns the raw stored stat while
  ours returns the modified one. The ratios say it outright: Choice Scarf 98→147 (×1.5), Unburden
  162→324 (×2), Tailwind 173→346 (×2), paralysis 112→56 (×0.5), −2 stages 104→52 (×0.5). Recorded so the
  next reader does not open it as 735 speed defects.
- **`engine/medicham2-browser.js`'s MTIME MOVED AND ITS CONTENT DID NOT.** `02:30` -> `03:36` local
  during this pass, `git diff --stat` empty against HEAD. Nothing here edited it; something rewrote it
  with identical bytes. It is reported and not chased, because the only thing that reads it is
  `status.js`'s mtime-based REFIT OWED line, which declares itself mtime-based. The five ledger
  `<!-- GENERATED -->` stamps moved with it (`03:23` -> `04:41`) as `status.js --write` restamped them.
- **The item-disposition leaf** (`lastItem` / `ateBerry`) was not touched, per the brief.
- `docs/MODELS.md`, `docs/ABRA-*.md` and `docs/SUMMARY.md` were not touched.

---

## OWED, NOT RUN

```bash
# 1. #571 — THE SPEED SWAP / SWITCH SPEED GAP. Read which side rewrites, restores or rebuilds the
#    stored speed across a switch-out, then probe it directly rather than through a whole game.
#    Showdown: sim/pokemon.ts:1514 clearVolatile does NOT reset storedStats; setSpecies (:1415) does.
#    This engine: engine/medicham2-browser.js:32280, `statrewire` writes m.st / t.st.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/replay_one.js \
  --release 8ac9c4d888f1 --team-store data/team-pool-frozen --games 1200 \
  --census data/mechanics-census.json --steering empirical --arm top-tie-first \
  --config pair-redirect-priority \
  --seed "gen9championsvgc2026regmbbo3-2656451791 vs gen9championsvgc2026regmbbo3-2656439218"

# 2. #572 — replay_one's warm-up. Add --run-primary <id>, default PRIMARY_ARM.id, and show a
#    corner-arm game reading REPRODUCED against data/divergence-turns.json.

# 3. THE PERISH DRAIN REACHES A BOARD IN THE BOTTOM CORNER. Will's 2026-08-28 closet ruling was
#    measured on the MIDDLE arm, where it parts no board; in bottom-tie-first it parts one
#    (omit-weather t4 -> board at t8, staraptor hp 59 vs 125). The declaration's own WOULD BE WRONG IF
#    clause (b) is about the middle-arm artifact and is not tripped by this. Decide whether the
#    ruling is arm-scoped and say so in the declaration, rather than leaving a reader to find it.
node -e "const j=require('./data/verification/game-differential-bottom-tie-first.json');console.log(j.state.first_board_divergences.filter(r=>r.config==='omit-weather'))"

# 4. SHOULD data/game-differential.json BE REFRESHED ON THE CURRENT INSTRUMENT? The recheck at
#    08:03 is numerically identical to the published 07:04 run, so nothing is wrong; but the
#    published slot was written by an instrument that no longer exists and arms_comparable will
#    say NOT COMPARABLE across the edit. A publisher decision, not an engine one.
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release 8ac9c4d888f1 \
  --arm middle --end-state --census data/mechanics-census.json --games 1200 \
  --team-store data/team-pool-frozen --turns 50 --write

# 5. THE PROBE IS NOT IN ANY BATCH RUNNER. tests/probe_corner_arm_measures.js plays 5 x 40 games
#    (~50s) and is not registered in tests/run-all.js. Decide whether a corner arm that stops
#    measuring should break the build.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  cmd /c tools\lownode.cmd tests\probe_corner_arm_measures.js --games 40

# 6. CARRIED, UNTOUCHED BY THIS PASS: the multi-hit volley loop (134 skipped volleys, 17 Parental
#    Bond clicks) and the Supreme Overlord declaration that matches nothing in the narration clause.
node -e "const j=require('./data/engine-diff.json');console.log(j.skipped_multihit, j.skipped_ability_multihit)"
```
