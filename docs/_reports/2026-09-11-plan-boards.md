# Plan: the 225 mechanics with no compared board (2026-09-11)

Planning only. Nothing was run except read-only derivations. Every `data/*` figure below comes from
`git show HEAD:<file>`. The HEAD artifact is `data/all-mechanics-fire.json`, generated
2026-09-11T03:18:26Z on release `5973a4e3c768` with arm `bottom-tie-first`. The working tree was not
read, because an ENGINE agent is rewriting it.

## Verdict

- **225 = 106 real work + 119 out of scope.**
- **The biggest single cause is a harness filter.** `engine/all_mechanics_fire.js:331` builds
  `LEGAL_SPECIES` with `!s.isMega`, and `AB_CARRIERS` (`:357-361`) is built from that list. As a result,
  **14 abilities whose only legal carrier is a mega forme are reported "NO LEGAL CARRIER"**. That
  includes Fairy Aura, whose carrier is Floette-Mega, the third most-held stone in the pinned pool.
- **The 75 mega stones are legal and in scope.** Derived: 75 of 75 have a legal mega forme, and none of
  the items is `isNonstandard`. They have no board row because `runItems` excuses them at `:3006`.
- **All 106 are harness or fixture work.** No batch in this plan has to edit
  `engine/medicham2-browser.js`. Engine work arises only if a newly compared board parts.
- **The finish line with every batch landed is 845 of 964. The 119 are permanent.** The honest
  denominator is therefore 845.
- **Separately, the 739 over-counts.** 68 of its rows have a board, but the mechanic never fired in
  that game: 58 abilities DID-NOT-FIRE, 9 items did not fire, and one move did not resolve. "Board
  compared and fired" is **663**, or 671 if the 8 SHOWDOWN-ONLY ability rows are counted. See §4.

## 1. How the 225 splits

`coverage.js:625-630` counts `summary.boards.<kind>.rows` against `summary.<kind>.exist`. At HEAD that is
moves 496/500, abilities 170/316 and items 73/148. A row gets a board only when `abRow` or the move arm
calls `boardVerdict(on, …)` (`:1772`, `:3210`). Every row that exits before a game is played has none.

| kind | no board | exit taken | my derivation | class |
|---|---|---|---|---|
| ability | 129 | `runAbilities` `:2207` — "NO LEGAL CARRIER" | **115 truly have none.** Carriers were walked over the legal species list with megas included. **14 have a legal mega carrier**: aerilate, dragonize, eelevate, electricsurge, fairyaura, filter, firemane, innardsout, megasol, parentalbond, piercingdrill, shadowtag, spicyspray, unseenfist | 115 (a), **14 (c, misfiled)** |
| ability | 14 | `:2214` — "NO CONTROL", every carrier has only this ability | carriers confirmed legal | (c) never staged |
| ability | 2 | `:2432` — "carrier body could not be built" (imposter, limber) | Ditto's move pool is `transform` only, so `bodyOf` (`:422-436`) finds no wanted move and no `FILLERS` move, and returns null. Limber has five other legal carriers but picks Ditto first (`:2212`) | (c) fixture |
| ability | 1 | battlebond — "TeamValidator refused the team" | Greninja's `S` slot resolves to Greninja-Bond, which is `isNonstandard: 'Past'`. The validator's own words: *"Greninja (Greninja-Bond) does not exist in Gen 9."* | (a), mislabelled as a staging failure |
| item | 75 | `runItems` `:3006` — "a mega stone" | 75 of 75 legal. `data/roster.items.json` rates all 75 FIRED-AND-BOARDS-MATCH (single-turn roster, same release) | (c) never staged here |
| move | 3 | powershift, softboiled, spore — "NO LEGAL CARRIER" | 0 legal learners via `Dex.species.getMovePool` | (a) |
| move | 1 | struggle — "NO LEGAL CARRIER" | Nothing learns it, but every body can use it. **1,008 uses in the clean store** (`regulation-usage.json` `clean.moves.struggle`) | **(c), mislabelled** |

(b), staged and fired but no board row: **0**. Every row that played a game carries a board.

(d), writes a leaf the comparator does not compare: **no rows of the 225**. Among the 739 there are 46
board rows with an uncompared leaf. Classified with `tests/probe_uncompared_leaves.js` `derive()`:
38 are duration-1 (flinch, protect family, helping hand and similar), 2 remove themselves inside the
action (fling, sparklingaria), and 6 are declared in `NOT_COMPARED` (attract ×2, curse, healblock,
yawn, unburden). `standing_at_the_boundary` = **0**, and the ceiling is 54 = compared. So there is no
comparator widening to do for this gap. *Caveat: `derive()` reads the LIVE `board_state.js` and
`medicham2-browser.js`, not HEAD. Re-run it once the live agent lands (see OWED).*

**Out of scope, 119:** 115 abilities with no legal carrier, battlebond, powershift, softboiled and spore.
None may be listed as work.

- One note on Simple. It is carried by no legal species, but Simple Beam has 2 legal learners, so the
  ability can reach a board through the move. The `simplebeam` move row has a board (NO-DIVERGENCE). It
  is still owed a check that the row plays a boost after the beam; otherwise Simple's doubling was never
  exercised.
- The clean store records **230 Simple sheet entries**. No legal species carries it, so the store is
  wrong somewhere. My guess is that the ingest records a `[from] move: Simple Beam` reveal as the
  body's declared ability. That is a guess and it belongs to **OPS**. I have not fixed it.

## 2. Groups by cause, weighted by the pinned pool

Counts come from `data/team-pool-frozen/games.{bo3,ots}.jsonl`: 17,381 games and 34,704 sheets. The
files are frozen and were read by streaming. **These are sheet counts, not trigger counts.** A mega
ability's weight is its stone's sheet count. Only one mega per side per battle, so a team with two
stones over-counts.

| # | group | n | pool weight | cause | fix type |
|---|---|---|---|---|---|
| **G1** | mega stones | 75 | **58,785** (Charizardite Y 7,263 · Staraptite 6,911 · Floettite 5,325 · Raichunite Y 4,159 · Delphoxite 3,278 …) | `runItems` excuses stones (`:3006`) | harness: stage the stone with a `mega: true` click |
| **G2** | mega-only abilities misfiled "no carrier" | 14 | **10,739** — the same sheets as their stones (Fairy Aura 5,325 · Shadow Tag 1,604 · Spicy Spray 1,170 · Eelevate 526 · Electric Surge 501 · Fire Mane 423 · Parental Bond 407 · Mega Sol 335 · Filter 139 · Unseen Fist 98 · Piercing Drill 95 · Dragonize 59 · Innards Out 34 · Aerilate 23) | `LEGAL_SPECIES` drops `isMega` (`:331`) | harness: mega carriers |
| **G3** | single-ability carriers, no A/B control | 14 | **10,573** (Levitate 4,428 · Good as Gold 4,321 · Illusion 450 · Zero to Hero 387 · Stance Change 382 · Disguise 205 · Wandering Spirit 149 · Mummy 95 · Mega Launcher 66, plus Blastoise-Mega via 1,421 Blastoisinite · Hunger Switch 43 · Surge Surfer 28 · Forecast 11 · Fur Coat 4 · Mimicry 4) | the A/B needs a second legal ability (`:2214`) | harness: a board-only arm with the trigger proven off the authority's log |
| G4 | Ditto builds | 2 | 355 (Limber 232 · Imposter 123) | `bodyOf` cannot build a 1-move body, and the carrier pick ignores buildability | harness |
| G5 | Struggle | 1 | 1,008 clean-store uses (sheets do not declare it) | labelled as a learnable move | harness: stage out-of-PP |

**No instrument has a board for six of these.** The roster's `COULD-NOT-STAGE` covers aerilate,
dragonize, filter, furcoat, megalauncher and zerotohero, and the harness has no row for any of them. So
the first real board for each will come from this plan. These six are where a first engine finding is
most likely.

## 3. Batches

**They all edit one file.** Every harness batch below edits only `engine/all_mechanics_fire.js`. None
touches `medicham2-browser.js`, `board.js`, `magnemite.js` or `engine-data.js`. They can therefore run
beside the live ENGINE agent, but **not beside each other**, and not beside anyone else editing that
harness. Each verification run needs `--release <id>` and `--out <scratch>`, never `--write`, while the
live agent owns `data/all-mechanics-fire.json`. The final `--write` happens once, after it finishes.

### Harness-only batches (serial, same file)

| batch | mechanics | fix | edits | plays games? | effect on 739/964 | red demonstration (must be shown RED first) |
|---|---|---|---|---|---|---|
| **HB-1: board-only arm** | G3's 14 | Where `:2214` currently exits, play the ON game only. Attach `board: boardVerdict(on,…)` with verdict `FIRED-UNCONTROLLED` **only if the authority's log shows the ability acting** (`[from] ability: <Name>` / `-ability` / its forme change). Otherwise emit `board_unproven` and **no `board` key**, so the count cannot rise on a silent row. The row stays out of `summary.abilities.fired`. | `engine/all_mechanics_fire.js` (`runAbilities`, `abRow`, `BOARD_SUMMARY`) | yes, 14 rows × ≤3 rungs | **+10 to +14.** Fur Coat and Zero to Hero need a physical hit and a switch cycle, and may prove unstaged | (i) `--break-triggers` must drop every HB-1 row to `board_unproven`, so the board count for those ids stays 0. (ii) A board plant on an HB-1 row, the `red()` statePlant mechanism at `:3443-3459` pointed at a board-only row (e.g. `vol.destinybond` on p1a at `AT`), must read `STATE` on that leaf with no new line |
| **HB-2: mega carriers** *(after HB-1)* | G2's 14 | Stop `AB_CARRIERS` dropping megas: carry the base species holding the stone, and prepend `{ m: …, mega: true }` on turn 1. The driver supports it (`game_differential.js:5142`, `scriptMegaRefused`). Every mega forme in the regulation has one ability, so these rows always take HB-1's board-only arm. **Print what the widened carrier map adds before wiring it:** it must be exactly these 14 plus `megalauncher`'s second carrier and `levitate`'s Chimecho-Mega, and nothing else | `engine/all_mechanics_fire.js` (`:331` or a separate mega-carrier map, `runAbilities`) | yes | **+11 to +14**. Aerilate, Dragonize and Filter have never been staged by anything | (i) A `--break-mega` knob (asks `mega: false`) must leave every HB-2 row unboarded and exit non-zero. (ii) Every counted row must show the authority's `\|-mega\|` / `detailschange` line (the fixture read off the authority, as `probe_corner_mechanisms.js` does). (iii) `scriptMegaRefused` is asserted at 0 |
| **HB-3: Ditto** | imposter, limber | Choose the first carrier that **builds and has a control** instead of `find(control) \|\| carriers[0]`. When no wanted or filler move fits, let `bodyOf` fall back to the body's own pool. **Print every species whose built body changes** under the fallback; it must be Ditto only | `engine/all_mechanics_fire.js` (`bodyOf :422`, `:2212`) | yes, 2 rows | **+2** | Revert the pick and both rows must return to "could not be built", which is HEAD's state and already recorded above. The over-match list must name Ditto alone |
| **HB-4: mega stones** | G1's 75 | Replace the `:3006` exemption with an item row. ON = base species holding the stone + `mega: true` on turn 1. OFF = the same body with no item (the item arm's existing A/B, *"swapping it for (no item)"*). Board from ON. Keep `di.zMove \|\| di.isPokeball` excused | `engine/all_mechanics_fire.js` (`runItems`, the `rosterOverlap` exemption `:3504-3517`) | yes, 75 rows, the largest run | **+75 → 814 once HB-1 to HB-3 have landed** | (i) Plant the base species back onto the medicham body after the mega (a statePlant on `species`); it must read `STATE` on `species`. (ii) Over-fire control: a FOREIGN stone on the same body (the `probe_knockoff_megastone.js` pattern) must read DID-NOT-FIRE, with the mega refused by the authority. (iii) `scriptMegaRefused` = 0 across the 75 |
| **HB-5: labels + Struggle** | struggle; battlebond relabel | Take Struggle out of `CARRIERS`-based unreachability. Stage it on a body whose only move is at 0 PP, using the existing `pp-exhausted` board-state kind. Mark battlebond `unreachable`, with the validator's message as evidence, so the row reads correctly | `engine/all_mechanics_fire.js` (`runMoves :1606`, `runAbilities`) | yes, 1 row | **+1** (battlebond does not move the count) | The authority's log must show `\|move\|…\|Struggle`. An HP plant on the struggler at the click turn must read `STATE` |

**Predicted total:** 739 + 14 + 14 + 2 + 75 + 1 = **845 of 964**. The remaining 119 are out of
scope for good.

### Accounting batch: not ENGINE's file, route it

| batch | what | edits | runs? | effect |
|---|---|---|---|---|
| **AC-1** | **Make the coverage line say what it claims.** (a) Denominator = `exist − unreachable − out_of_scope`, which the *"staged mechanics that fired"* line directly above (`:614-616`) already does. (b) Split the numerator into "board compared **and fired**" and "board compared, never fired" | `engine/coverage.js` `:623-630`. Not in ENGINE's owns list; `where.js` places it beside `engine/status.js`, which is MEASURE's | no | At HEAD it would read **663 of 845 fired-and-compared** (671 counting SHOWDOWN-ONLY), not 739 of 964. After HB-1 to HB-5 the in-scope denominator stays 845 |

### The fired-less rows already inside the 739

These do not move 739, but they are unchecked effects. Rows fall into several fixture clauses, taken
from `verdict_refined` and `cannot_fire_clause` at HEAD. Each is a harness batch on the same file, run
after HB-1 to HB-5. **R** = the roster has a board for it. **NONE** = no instrument does.

| batch | rows | pool weight (listed rows) | fix |
|---|---|---|---|
| HG-1 unexplained | prankster (R) 13,439 · hospitality (R) 9,831 · friendguard (R) 1,667 · innerfocus (R) 1,575 · technician (R) 1,094 · telepathy (R) 320 · magicguard (R) · curiousmedicine (R) · gluttony · longreach · pickup · screencleaner · unaware (last five NONE) | ≥27,900 | derive the trigger per row. `summary.abilities.did_not_fire_unexplained` = 20 is the population |
| HG-2 duration-extension | lightclay 4,758 · damprock 469 · heatrock 139 · smoothrock 41 · icyrock 28 (all R) | 5,435 | the holder clicks its own screen or weather, then `--trailing` past the unextended end |
| HG-3 arm-constant-roll | widelens 1,333 · compoundeyes 837 · brightpowder 363 · scopelens 259 (NONE, the only item nothing tests) · zoomlens 54 · tangledfeet · merciless | ≥2,846 | the arm pins accuracy and crit, so these items cannot move a board. Run them under an arm that draws the roll; confirm the flag spelling in the harness header before running |
| HG-4 trigger-unstaged / adversary / board-state / status / speed | lightningrod (R) 4,404 · scrappy (R) 922 · flowerveil (R) 5,335 · unburden (R) 4,421 · insomnia (R) 94 · and 24 more | ≥15,000 | per-clause fixture repair (`engine/faces.js` receiver moves, statusFirst, speed order) |
| declared | anticipation, frisk (announces-only), stall (read-by-nobody) | — | leave as declared. No board can see them |

## 4. Engine-edit batches (contingent, scheduled separately)

None is required by the plan. **EB-1** opens only if HB-1 to HB-5 produce a `STATE` or
`FIRED-AND-BOARDS-DIFFER`. The likeliest places are the six rows nothing has staged: aerilate,
dragonize, filter, furcoat, megalauncher and zerotohero. EB-1 edits `engine/medicham2-browser.js` and
follows ENGINE's order: the failing row is the probe, then the fix, then `node tests/test-mechanics.js`,
then `node engine/status.js`. It collides with the live ENGINE agent, so it is scheduled after that
agent finishes.

The 8 SHOWDOWN-ONLY ability rows are unnerve, rockhead, moldbreaker, pressure, supremeoverlord,
naturalcure, forewarn and superluck. The harness header calls this verdict an engine bug (`:57`).
Their boards agreed, so they belong to the narration gate, not to this gap.

## OWED, NOT RUN

Cut a release after the live ENGINE agent lands. The harness is a reader and is not frozen, so the
engine bytes are what the release pins.

```bash
cd C:/Users/willj/Projects/Pokemon/ABRA
node engine/engine_release.js cut "boards plan HB-1..HB-5"
node engine/engine_release.js list | head -3        # take the new id as REL
```

Confirm group (d) against the landed tree: standing must still be 0.

```bash
node tests/probe_uncompared_leaves.js | head -12
```

Per batch, smoke only the batch's own rows to scratch. Never `--write` while another agent owns the artifact.

```bash
SP=C:/Users/willj/AppData/Local/Temp/claude/C--Users-willj-Projects-Pokemon-ABRA/4af1c0ef-5c10-47e8-8fca-e2cf744fece1/scratchpad
REL=<id>
# HB-1
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind abilities --only disguise,forecast,furcoat,goodasgold,hungerswitch,illusion,levitate,megalauncher,mimicry,mummy,stancechange,surgesurfer,wanderingspirit,zerotohero --release $REL --out $SP/amf-hb1.json"
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind abilities --only levitate,goodasgold --break-triggers --release $REL --out $SP/amf-hb1-red.json"
# HB-2
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind abilities --only aerilate,dragonize,eelevate,electricsurge,fairyaura,filter,firemane,innardsout,megasol,parentalbond,piercingdrill,shadowtag,spicyspray,unseenfist --release $REL --out $SP/amf-hb2.json"
# HB-3
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind abilities --only imposter,limber --release $REL --out $SP/amf-hb3.json"
# HB-4 (all 75 stones)
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind items --release $REL --out $SP/amf-hb4.json"
# HB-5
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind moves --only struggle --release $REL --out $SP/amf-hb5.json"
# the red demonstration block must pass before any green counts
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind all --red --release $REL --out $SP/amf-red.json"
```

When the live agent is done: one write, then the ENGINE finishing order.

```bash
cmd.exe //c "tools\\lownode.cmd engine\\all_mechanics_fire.js --kind all --release $REL --write"
node engine/coverage.js | grep -i "board compared"     # expect <= 845 of 964; 845 is the ceiling
node tests/test-mechanics.js
node engine/status.js
node engine/status.js --write
```

Separate checks, each routed to its owner.

```bash
# the simplebeam row: does it play a boost AFTER the beam? (Simple's only door in this regulation)
git show HEAD:data/all-mechanics-fire.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s).rows.moves.find(x=>x.id==='simplebeam');console.log(JSON.stringify({setup:r.setup,turns:r.turns,board:r.board.verdict}))})"
# OPS: where 230 clean-store 'Simple' sheet entries come from (no legal carrier exists).
# Read-only: find where the ingest assigns a revealed ability to a body. Do NOT re-run
# tests/regulation_usage.js for this; it rescans the 481 MB corpus and rewrites data/regulation-usage.json.
grep -n "\[from\]" engine/durable-ingest.js | grep -i "abilit" | head
```
