# Merged-tree re-measure on `482e8f5ca701` — 2026-09-18 (late), ENGINE, measure only

A findings record, not a living document. It is superseded by the register rows it feeds and is not
cited as current state. `node engine/status.js` and `node engine/quarantine.js` hold the current state.
No engine or test file was changed by this pass.

---

## 0. VERDICT

| `--games` | games | board-material | narration (undeclared) | protocol-diverged | boundaries identical |
|---|---|---|---|---|---|
| 1200 | 961 | **0** (was 0) | **0** (was 0) | 0 (was 0) | 10705/10705 |
| 1350 | 1069 | **7** (was 7) | **12** (was 12) | 20 (was 20) | 11825/11842 |
| 1950 | 1497 | **20** (was 20) | **24** (was 25) | 43 (was 44) | 16619/16702 |

"Was" is release `ce34d0a89f01` (`docs/_reports/2026-09-18-lattice-remeasure.md` §5). Board-material is
`state.games − state.games_board_never_diverged`. Narration is the gate's NARRATION clause as
`engine/quarantine.js` printed it.

- **No game joined.** No board-material game left either. All 27 board-material games are the same
  games, and each first board diff is byte-identical to the one on `ce34d0a89f01` (7 of 7 and 20 of 20).
- **One narration game left** (`--games 1950`). It is the Mold Breaker fix in 6.49.0. See §3.
- **Gate: `CLOSED — 3 of 8 GATING clauses fail`.** On `ce34d0a89f01` it was 1 of 8. The two new FAILs
  are **not engine regressions. They are an instrument regression that came in with the 6.48.0 merge.**
  The roster red demonstrations for `item/accuracy-scaled` and `ability/weather-evasion` now go NOT
  CAUGHT. Their plants break the name-keyed `ACCMOD` branch, and since 6.48.0 that branch runs only
  under `MEDI_ACCMOD_BY_NAME=1`. See §4.
- The roster predictions held. Moves **494 of 497** tested, abilities **194 of 200**, items 148 of 148.
  0 COULD-NOT-STAGE in every stage.

## 1. PINS, AND WHY THIS IS NOT A STRICT BEFORE/AFTER

| pin | this run | previous run (`ce34d0a89f01`) |
|---|---|---|
| release | `482e8f5ca701` (cut 2026-09-19T01:50:02Z on HEAD `bc270762`; `engine_release list`: "0 of 27 files have moved since") | `ce34d0a89f01` |
| census `steering.input_digest` | **`2a669b4c2dea`**, 894 rows, generated 2026-09-19T01:50:02.151Z | `632a699468ca` |
| team store | `data/team-pool-frozen` | same |
| pools (`team_pool_digest`) | `0d103fb9fa87` / `7e7a37ded7fc` / `a5ce76242f8d` | same |
| mode | `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real` | same |
| turns cap / end-state / until-covered | 50 / true / false | same |
| steering | `empirical-click/v1`; driver code `3f21624ad50d`; alignment `d90aa554e7f4`; `driver_code_stable` true | policy the same |
| `--games` | 1200 / 1350 / 1950 | same |

**Which census, and why.** The census I used is `data/mechanics-census.json` as committed at HEAD
`bc270762`. `git diff` on the file is empty. It was regenerated in the same second the release was cut, so
it is the census that belongs to that release. `632a699468ca` (886 rows) is two regenerations old. The
`959405d780a2` that the previous report's OWED block names has also been superseded (it became 891, then
894). `engine/quarantine.js` requires the census to be the same across all three lattices, not the same
as last time. This run meets that requirement.

**Two pins moved at once, the release and the census, so this is not a strict before/after.** Under
`--steering empirical`, each artifact records `census_role: "CREDITED ONLY — it measures coverage and
does not select"`. The census therefore cannot change which games are played. The data agrees: the same
pool digests, the same games played, the same number of boundaries compared, and the same first diffs on
every game that stayed. That makes the comparison a close one. It is still not the controlled
comparison that the rule asks for, and it should not be quoted as one.

**Launch.** From Node, `spawnSync('cmd.exe', ['/c', 'tools\\lownode.cmd', 'engine/game_differential.js',
'--steering','empirical','--release','482e8f5ca701','--arm','middle','--end-state','--census',
'data/mechanics-census.json','--team-store','data/team-pool-frozen','--games',N,'--write','--out',<slot>,
'--dump-games','400','--dump-out',<scratch>])`. This matches `latticeRerun()` in `engine/quarantine.js`,
plus the dump. Exit 0 on all three runs (454 s, 508 s, 768 s). The `generated` stamps moved:
2026-09-19T02:09:41Z, 02:18:11Z and 02:30:59Z. The old stamps were 00:45 / 00:47 / 00:51. The dumps
hold 0 of 0, 20 of 20 and 43 of 43 protocol-diverged games, so each dump is the whole population.

## 2. BOARD-MATERIAL, BY MECHANISM (27 games, none new, none gone)

The data comes from `state.first_board_divergences` (7 and 20 entries, under the cap of 40, so the whole
population). Each game is joined to its full `--dump-games` card. The mechanism names come from the
previous report's §3, and each is re-read against the card for this run.

**The six leads in flight in other worktrees account for 10 games:**

| lead (in flight) | games | where |
|---|---|---|
| Gooey's Speed drop skips Contrary / Defiant | 2 | 1350 (Kingambit, Defiant), 1950 (Staraptor, Contrary) |
| Transform does not run the copied ability's `Start` (Hospitality from a transformed Ditto) | 2 | 1950 ×2 |
| Rough Skin paid twice after a Parental Bond first hit KOs | 2 | 1350, 1950 |
| `vol.allyswitch` left on a benched Runerigus (no protocol divergence) | 2 | 1950 ×2 |
| Mummy overwrites Zero to Hero | 1 | 1950 |
| Electric `vol.charge` kept after a damaging Electric click stopped by Protect | 1 | 1950 |

**The other 17 games have one game per mechanism:** Grav Apple damage 39 vs 16 on Torkoal (1350). Game-end
Life Orb chip on Slowking-Galar (1350). Helping Hand succeeds at an ally that has already moved (1350).
Round not promoted after the ally's Round (1350). Sleep wakes on one engine only, Trevenant (1350).
Darkest Lariat misses (1950). Game-end Lum Berry not eaten (1950). Alluring Voice confuses without the
stat-raised condition (1950). Poison Touch on a flinched Scovillain (1950). Full paralysis on one engine
only, Sinistcha (1950). Cursed Body Disable absent against Triple Axel (1950). Magic Bounce does not
reflect Yawn, Hatterene (1950). Decorate's boosts skip Malamar's Contrary (1950). Trace picks a different
foe on Alakazam (1950). PP `thunderbolt 2|1` with no protocol divergence (1950). Heal Pulse ignores Mega
Launcher on Blastoise (1950). Game-end burn chip on Sinistcha (1950).

Three of the 20 at `--games 1950` part a board with no protocol divergence: the two allyswitch games and
the PP game. Four parted the board before the protocol did.

## 3. WHAT LEFT, AND WHICH FIX REMOVED IT

**Board-material:** nothing left and nothing joined, at every lattice.

**Narration: one game left, and no game joined.** The two protocol sets were compared key by key. None
of the 63 games present in both runs moved its split point.

- `--games 1950`, `baseline …2660351933 vs …2660331172`. Before: SD `|-singleturn|p2a: Gholdengo|Helping
  Hand|[of] p2b: Tinkaton`, ME `|-immune|p2a: Gholdengo|[from] ability: Good as Gold`. In the pinned
  pool (`data/team-pool-frozen/games.bo3.jsonl`), this Tinkaton's ability is `MoldBreaker`. Good as Gold
  refuses a Status move from any other body (`data/abilities.ts:1620-1627`) and is `breakable: 1`.
  Helping Hand is Status and targets `adjacentAlly`, so the authority lets a Mold Breaker ally through.
  **The fix that removed it is 6.49.0, "Mold Breaker pierces Good as Gold"** (the `statusRefuser` check).
  This game was protocol-only; its board never parted. It drops narration from 25 to 24 and moves no
  board-material count.

No other merged fix (Beat Up, Future Sight vs Substitute, Harvest, Prankster target, the accuracy and
shield tags) changed any game on any lattice. That was expected: `ce34d0a89f01` already had Beat Up, and
the pinned pool gives the rest no games in which to fire.

**Narration-only games, grouped (13 at 1350, 26 at 1950, before declared rows are subtracted).** Each
group is taken from the dump card's first split. The groups are named, not diagnosed:
- Roost `-singleturn` missing from ME: 4 (1350 ×1, 1950 ×3)
- Supreme Overlord `fallenundefined`: 3. This is the declared AUTHORITY-WRONG row (1350 ×1, 1950 ×2),
  and it is subtracted by the gate.
- Forewarn activation missing from ME: 3 (1350 ×2, 1950 ×1)
- A spread move with `[notarget]`: ME emits `-fail`, SD emits a hit, resist or immune: 3 (1350 ×2, 1950 ×1)
- Synchronize bouncing a status back onto an immune source: SD `-immune`, ME moves on: 3 (1350 ×2, 1950 ×1)
- Perish Song start order: 2 (1950)
- Coaching `-fail` in SD, ME proceeds: 2 (1950)
- Singletons: Helping Hand after the ally moved (the narration twin of §2), sandstorm chip order, Sitrus
  side, Floette `detailschange`, Outrage fatigue confusion, Mortal Spin clearing Toxic Spikes text,
  Chilly Reception `-fail`, Magician's item text, a White Herb consumer, Misty Terrain versus Sleep
  Powder, Dragon Darts retarget, Perish KO timing, Poison Point, Salt Cure versus Infestation damage
  source, Water Absorb versus Life Dew, a switch-slot order, and Good as Gold versus an ally's Life Dew
  (1950 `…2634231341`: SD `-immune`, ME heals).

## 4. THE GATE, AND THE INSTRUMENT REGRESSION IN IT

`node engine/quarantine.js` (through `tools\lownode.cmd`, exit 0, 160 s): **`GATE: CLOSED — 3 of 8
GATING clauses fail`.**

| clause | reading |
|---|---|
| game differential (damage) | PASS. Midpoint 0 of 6000, top 0/6000, bottom 0/6000, idx01–idx14 0/6000 (`data/engine-diff.json`, seed 20260804, `--n 6000`, liveStamp = `482e8f5ca701`) |
| roster / items | **FAIL.** 148 of 148 tested, 0 differ, 0 did-not-fire. **1 red demonstration did not behave as its rule predicted** |
| roster / abilities | **FAIL.** 194 of 200 tested, 0 differ, 0 did-not-fire, 6 deferred-by-owner. **1 red demonstration did not behave** |
| roster / moves | PASS, 494 of 497 tested, 3 deferred-by-owner |
| coverage | PASS, all 412 moves above 25 clicks are measured |
| whole-game BOARD-MATERIAL | FAIL, 0 / 7 / 20 |
| whole-game NARRATION | RPRT (does not gate), 0 / 12 / 24 |
| mechanics (`data/all-mechanics-fire.json`) | PASS. 2 diverge, 1 declared, 1 below the shelf, 0 left |
| no open, known engine defect | PASS |

**The two new FAILs are in the roster's instrument, not in the engine.**

- `NOT CAUGHT item/accuracy-scaled`: "the accuracy modifier row is dropped, so every holder reads as
  untabled". The plant is `tests/roster.js:7031-7032`, which patches `  if(row)return row.off?null:row;`.
- `NOT CAUGHT ability/weather-evasion`: "the evasion stage is ignored when accuracy is computed". The plant
  is `tests/roster.js:9178-9179`, which patches `const row=ACCMOD[kind+':'+key];`.

Both anchors still match exactly once, in `engine/medicham2-browser.js:11698-11699` and in the release
copy. Since 6.48.0 ("ACCMOD and PROTECTMOVES read the accuracyMod / shieldsUser tags; name paths behind
knobs"), both lines sit inside `if(ACCMOD_BY_NAME){…}`, which runs only under `MEDI_ACCMOD_BY_NAME=1`. The
live path is `TAGS.param(kind,key,'accuracyMod')`. **The patch lands on dead code, so no board moves.**
The rows' greens still exercise the mechanic through the tag path (148 match and 194 match, and the
engine-diff ACCURACY-MODIFIER CONFORMANCE reads `disagree: 0`). What is lost is the proof that these two
rules can express their own mechanic. On `ce34d0a89f01` (before the merge) both were CAUGHT, via
Bright Powder, in the previous pass's `--reds` run. After 6.48.0 nobody ran `--reds`: the 6.49.0 row lists
the full stages as OWED, NOT RUN. **The fix is to re-aim the two plants at the tag read. That is an
ENGINE edit to `tests/roster.js` and is not made here.**

**Also red, and not gating:** the roster fixture legality check prints `385 illegal — NOT baselined`
(items), `583` (abilities) and `638` (moves). Every entry shown is "can't learn Focus Energy", built at
`tests/roster.js:775/1334/1335`. The check makes items and abilities exit 1 and leaves moves at exit 0,
so the exit codes of one checker disagree across its stages. `engine/all_mechanics_fire.js` prints
`102 checked, 83 illegal`, also Focus Energy, and exits 0. The 6.49.0 row already records this checker
finding illegal bodies. It does not move a verdict. It is recorded here because a check that exits 1 on
one stage and 0 on the next is a check that will be read wrongly.

**Compared with the prior predictions:** abilities went from 190 match / 5 COULD-NOT-STAGE / 5 deferred
to 194 / 0 / 6, which is the six staged rows plus Frisk deferred by Will. Moves went from 492 / 2 / 3 to
494 / 0 / 3. Items are unchanged at 148.

## 5. THE OTHER ARTIFACTS RE-RUN ON `482e8f5ca701`

The gate would otherwise have withheld these as measured on a different engine. Each `generated` stamp
moved:
`roster.items` 02:31:48Z, `roster.abilities` 02:35:32Z, `roster.moves` 02:36:35Z, `engine-diff`
02:44:27Z, `all-mechanics-fire` 02:44:51Z. Each is stamped `482e8f5ca701`.
`tests/test-mechanics.js` was **not** run. It regenerates the census, and the census is a pin of every
lattice above. The census is already at 894 live from the 6.49.0 pass, and this pass changed no engine
byte.

## 6. FILES CHANGED

Data (written by the runs): `data/game-differential.json`, `data/game-differential.g1350.json`,
`data/game-differential.g1950.json`, `data/published-samples.json`,
`data/roster.{items,abilities,moves}.json`, `data/roster.{items,abilities,moves}.prev.json`,
`data/roster.json`, `data/engine-diff.json` and `data/all-mechanics-fire.json`. Also the files that
`status.js --write` rewrites (the generated blocks in `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md`, plus
`data/open-work.json` and `data/provenance-stamp.json` if they moved).
Docs: `CHANGELOG.md` (6.49.1), `docs/RUNNING-NOTES.md` (one row), and this report.
Not touched: the held 7.0.0 documents (deck, technical docs, MODELS, SUMMARY and their PDFs) and
`docs/_reports/2026-09-11-*`. No git command was run. Nothing was deleted. Every child process was
spawned synchronously by my own launcher, and none was killed.

## OWED, NOT RUN

1. **Re-aim the two roster red demonstrations at the tag read (ENGINE, `tests/roster.js`).** Point
   `item/accuracy-scaled` (line ~7032) and `ability/weather-evasion` (line ~9179) at the
   `TAGS.param(kind,key,'accuracyMod')` path in `accModRow`, not at the knob-only `ACCMOD` branch. Then:
   ```powershell
   $env:SHOWDOWN_PATH="C:/Users/willj/Projects/Pokemon/pokemon-showdown"
   node engine/engine_release.js cut "roster: accuracy reds re-aimed at the tag read"
   cmd /c tools\lownode.cmd tests\roster.js --stage items --reds --write --release <new>
   cmd /c tools\lownode.cmd tests\roster.js --stage abilities --reds --write --release <new>
   node engine/quarantine.js      # expect CLOSED — 1 of 8 (board-material only)
   ```
   A release cut after a `tests/roster.js`-only change may also withhold the lattices, the damage diff and
   the mechanics artifact as "measured against a different engine". If it does, re-run them as in §1 and
   §5.
2. **Decide the fixture-legality exit-code inconsistency** (items and abilities exit 1, moves and AMF
   exit 0, on the same class of finding) and the Focus Energy filler behind all of it.
3. The six in-flight leads (10 board-material games). After they merge, cut a release and re-run the
   three lattices with this report's §1 pins. Record the census digest again, because any
   `tests/test-mechanics.js` run moves it.
4. **Not done by this pass, so not claimed:** a census-pinned before/after. Only a re-run of `ce34d0a89f01`
   under census `2a669b4c2dea` would give one. It is not needed while `census_role` stays CREDITED ONLY.
