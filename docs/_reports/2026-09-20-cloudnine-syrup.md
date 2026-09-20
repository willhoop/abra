# Cloud Nine's arrival announcement, and Supersweet Syrup's bare one — 2026-09-20, ENGINE

This is a findings record, not a living document. It is not current state and is not cited as such.
`node engine/status.js` and `node engine/quarantine.js` hold current state.

**LIGHT MODE, ISOLATED WORKTREE**
`C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a2515a3cca63604a9`.
No gate lattice, no full battery, no `quarantine.js`, no `status.js --write`, no commit, no push.
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.

Answers the two mechanisms named in `docs/_reports/2026-09-19-834713-remeasure.md` (main tree, HEAD
`61a2b68d`, release `834713ccb303`): **75 of 89** gate-lattice protocol divergences are Cloud Nine's
arrival announcement and **11 of 89** are Supersweet Syrup announced with a `|boost` field.

---

## 0. VERDICT

- **Both classes are fixed at one shared place each, and the membership of each is DERIVED from the
  handler rather than named.**
- **Census `data/mechanics-census.json`: 977 live / 0 missing → 979 live / 0 missing.** 986 probed,
  0 threw, 0 hollow, **2 new rows, 0 lost, 0 verdict flips**.
- **Two probes, each green clean and red under its own knob, both pinned to worktree release
  `e352496db151`.** Both knobs are stamped at load and are in `DELIBERATE_BREAK`; a census run under
  either reads `978 live / 1 missing` and REFUSES to write, demonstrated.
- **Eight named lattice games replayed.** Six reproduce their artifact divergence EXACTLY under the
  matching knob; **all eight are clean on the fixed engine, no board parted, every boundary agreed.**
- **NO LATTICE WAS RUN.** No narration figure for the gate is claimed here.

---

## 1. PINS

| pin | value |
|---|---|
| release | **`e352496db151`**, cut in this worktree, 27 files frozen. `data/engine-release.json` was backed up and RESTORED at the end (backup: `<scratch>/cloudnine-syrup/engine-release.json.bak`) |
| showdown | `SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` |
| team store (replay only) | `data/team-pool-frozen`, hard-linked from the main tree; `loadTeams` rebuilt the cache and read **8,778 teams, pool digest `f807cbc40299`** |
| corpus (tag regeneration only) | `data/games.{bo3,ots,ladder}.jsonl` hard-linked from the main tree, then REMOVED again |
| artifacts read from the main tree | `data/game-differential.json` (the `--games 1200` lattice on `834713ccb303`) for the named seeds |
| base | worktree HEAD `61a2b68d`, clean at start |

---

## 2. THE AUTHORITY — CLASS A, "ANNOUNCES ON ARRIVAL"

`data/abilities.ts`, read whole. `/data/mods/champions/abilities.ts` overrides NEITHER — counted, 0
occurrences of `cloudnine`, `airlock`, `supersweetsyrup` or `intimidate` in the mod file.

```js
cloudnine: {                                                       // data/abilities.ts:534-538
  onSwitchIn(pokemon) {
    // Cloud Nine does not activate when Skill Swapped or when Neutralizing Gas leaves the field
    this.add('-ability', pokemon, 'Cloud Nine');
    ((this.effect as any).onStart as (p: Pokemon) => void).call(this, pokemon);
  },
  onStart(pokemon)  { pokemon.abilityState.ending = false; this.eachEvent('WeatherChange', this.effect); },
  onEnd(pokemon)    { pokemon.abilityState.ending = true;  this.eachEvent('WeatherChange', this.effect); },
  suppressWeather: true,
airlock: { ... }                                                   // data/abilities.ts:90-94, identical
```

**WHAT it writes:** `|-ability|BODY|Cloud Nine` — three fields, BARE, no `boost` marker.
**WHEN:** every time the body ARRIVES. There is no latch; `onSwitchInPriority` is `undefined` on both
members, so the line is priority 0 and sorts BELOW the entry hazards on the ability subOrder
(`sim/battle.ts:953` → `comparePriority` `:404-411`, side condition 4 / ability 7 at `:957-987`).
**WHEN NOT:** on any other road. `getCallback` runs an ability's `onStart` AS its `onSwitchIn` from
gen 5 on — but an ability that declares `onSwitchIn` ITSELF gets that handler at an entry and its
`onStart` everywhere else. So a mega (`setAbility` → `singleEvent('Start')`), a Trace, a Skill Swap
and a Neutralizing-Gas departure all raise `onStart`, which writes nothing. The handler's own comment
says so.

**This is why it is a SECOND tag and not a widening of `announcesOnStart`.** That tag's own comment in
`engine/tag_dex.js` records that Cloud Nine was left out ON PURPOSE for exactly this reason; a member
folded into it would speak on all four of the roads above.

### The derived membership, PRINTED BEFORE ANYTHING WAS WIRED

```
CLASS A — an ability that ANNOUNCES ON ARRIVAL (onSwitchIn = announce + delegate to its own onStart)
  airlock    {"event":"-ability","on":"self","tail":null,"delegatesToStart":true,
              "switchInPriority":0,"visibleOnABoard":false}   legal carriers: NONE IN THIS REGULATION
  cloudnine  {"event":"-ability","on":"self","tail":null,"delegatesToStart":true,
              "switchInPriority":0,"visibleOnABoard":false}   legal carriers: Altaria, Drampa
  2 member(s) by shape

  REFUSED, and why — every other onSwitchIn in the dex:
    imposter          body is not announce+delegate   legal carriers: Ditto
    neutralizinggas   body is not announce+delegate   legal carriers: NONE
    terashift         body is not announce+delegate   legal carriers: NONE
    zerotohero        body is not announce+delegate   legal carriers: Palafin, Palafin-Hero
```

**SIX abilities in the whole dex declare an `onSwitchIn`, and the predicate takes exactly two.**
Neutralizing Gas is the near miss worth naming: its `onSwitchIn` DOES open with an announcement, but
it then does its own work and has no `onStart` to delegate to, so the predicate refuses it on the
body rather than on the name — and it has no legal carrier here either. Air Lock is derived anyway
and deliberately: it costs nothing and the artifact already knows the day a carrier appears.
`data/tags.json` walks only legal entities, so `airlock` has no row in it — that is the file's
existing convention, not a gap.

---

## 3. THE AUTHORITY — CLASS B, THE ENTRY-DROP ANNOUNCEMENT'S SHAPE

```js
intimidate.onStart                       supersweetsyrup.onStart        // data/abilities.ts:4705-4716
  let activated = false;                   if (pokemon.syrupTriggered) return;
  for (const t of pokemon.adjacentFoes()) {  pokemon.syrupTriggered = true;
    if (!activated) {                        this.add('-ability', pokemon, 'Supersweet Syrup');  // BARE
      this.add('-ability', pokemon,          for (const t of pokemon.adjacentFoes()) { ... }
               'Intimidate', 'boost');
      activated = true; }
```

Two differences, both on the wire: the **fourth field** (`boost`, the protocol's marker for "this
announcement is about a stat change"), and **where the line sits relative to the foe loop** — inside
it, so a carrier with no adjacent foe says nothing, or above it, so it announces regardless.

This engine wrote ONE line for both: `engine/medicham2-browser.js`, `applyEntryDrops`,
`if(TR&&foes.some(f=>f&&!f.fainted))TR.ab(m,m.ability,'boost');` — Intimidate's line, unconditionally.

### The derived membership, PRINTED BEFORE ANYTHING WAS WIRED

```
CLASS B — the ENTRY-DROP announcement, with or without the `boost` fourth field
  intimidate        {"event":"-ability","tail":"boost","gatedOnFoe":true}
                    legal carriers: Arbok, Arcanine, Arcanine-Hisui, Tauros, Tauros-Paldea-Combat,
                    Tauros-Paldea-Blaze, Tauros-Paldea-Aqua, Gyarados, Qwilfish, Mawile,
                    Manectric-Mega, Staraptor, Luxray, Krookodile, Scrafty, Scrafty-Mega,
                    Incineroar, Wyrdeer, Overqwil
  supersweetsyrup   {"event":"-ability","tail":null,"gatedOnFoe":false}   legal carriers: Hydrapple
  2 member(s) by shape
```

That is the whole of `onSwitchInDrop` and nothing else — no over-match.

---

## 4. THE FIX — ONE SHARED PLACE EACH

| class | where | what |
|---|---|---|
| A | `switchInAnnounce()` in `engine/medicham2-browser.js`, beside `startAnnounceEarly` | reads `announcesOnSwitchIn` off `data/tags.json`; refuses a dead-on-arrival body; refuses a POSITIVE `switchInPriority` **loudly** (`MEDFAILS.startAnnouncePriorityMissing`) rather than placing a line it has no hoist for |
| A | two call sites, and only two | `runEntryPass` (every replacement and the deferred refill) and the lead pass — immediately above `applyEntryEffects`, which is where a priority-0 entry handler sorts. The THREE other `applyEntryEffects` callers (the mega road, the copy/Skill-Swap road, the acquired-on-contact road) are NOT arrivals and are deliberately not wired |
| B | `applyEntryDrops`'s announcement block | reads `onSwitchInDrop.announce`; writes the derived tail (`TR.ab(m, m.ability, _an.tail \|\| undefined)`, and the trace sink drops an empty field) and honours `gatedOnFoe` |
| B | the absent-shape branch | a row with no `announce` key predates the derivation: **nothing is written and it is COUNTED** (`MEDFAILS.entryDropAnnounceShapeMissing` + `…First`). Picking one of the two shapes would be the silent default this whole class was |

New counters: `MEDSEEN.switchInAnnounced`, `MEDSEEN.entryDropAnnounced`,
`MEDSEEN.entryDropAnnounceSkippedNoFoe`.

### `data/tags.json` was REGENERATED, and the diff is three entities

`engine/tag_dex.js` reads the corpus through `fit_policy.loadCorpus({scope:'all'})`, which this
worktree does not have. The three monoliths were hard-linked in from the main tree, the artifact was
regenerated, and the links were REMOVED again (they are the stale 2026-09-10 monoliths and a later run
here would read them silently).

```
sheet_entries  HEAD 316656   now 316656   IDENTICAL
uses moved: 0   entries missing: 0   entries added: 0
entities with a params/tags change: 3
  abilities cloudnine        tags ["weatherSuppression"] -> ["weatherSuppression","announcesOnSwitchIn"]
  abilities intimidate       onSwitchInDrop  + announce {"event":"-ability","tail":"boost","gatedOnFoe":true}
  abilities supersweetsyrup  onSwitchInDrop  + announce {"event":"-ability","tail":null,"gatedOnFoe":false}
tag rows  HEAD 320  ->  321
```

**This is the check the previous pass could not make** — `docs/_reports/2026-09-19-ability-announce-boost.md`
reverted the same Syrup derivation because its worktree's regeneration wrote `uses: 0` on 804 entries
and `sheet_entries 316,656 → 0`. Linking ALL THREE scope files (that pass linked ladder and bo3 and
not `games.ots.jsonl`) reproduces the corpus exactly.

---

## 5. THE PROBES, AND THE KNOBS THAT PUT THEM RED

Both pinned to `e352496db151`. Every arm of both also asserts `stateDiv === null` and
`boundaries === boundariesAgreed` — **narration only, asserted, not claimed** — clean AND under the knob.

### `tests/probe_switchin_announce.js` — 8 arms, 27 claims

| arm | claim |
|---|---|
| `LEAD-ALTARIA` / `LEAD-DRAMPA` | the authority writes exactly ONE bare member line; this engine writes the same `switch`/`detailschange`/`-ability` sequence |
| `CTRL-LEAD-ALTARIA` (Natural Cure) / `CTRL-LEAD-DRAMPA` (Berserk) | the same bodies, non-member ability: NO line in either engine |
| `SWITCH-DRAMPA` / `CTRL-SWITCH-DRAMPA` | a REPLACEMENT is an arrival too, and it is the other road (`runEntryPass`) |
| `RETURN-ALTARIA` | leads, pivots out, comes back: **TWO** lines. There is no latch |
| `SKILLSWAP-DOOR` | Alakazam Skill Swaps Cloud Nine off the Altaria. The authority writes **ONE** bare line — the Altaria's own lead — and none for the acquiring body |

```
LEAD-ALTARIA   ["switch:p1a:altaria", ..., "ability:p1a:cloudnine"]           both engines
RETURN-ALTARIA [... "ability:p1a:cloudnine", "switch:p1a:toxapex",
                    "switch:p1a:altaria", "ability:p1a:cloudnine"]            both engines
SKILLSWAP-DOOR ["switch:p1a:altaria","switch:p1b:milotic","switch:p2a:alakazam",
                "switch:p2b:toxapex","ability:p1a:cloudnine"]                 both engines
   and the swap LANDED: |-activate|p2a: Alakazam|Skill Swap|Cloud Nine|Magic Guard|[of] p1a: Altaria
PASSED — every claim held        switchInAnnounced +6
```

**THE DOOR ARM WAS VACUOUS ON ITS FIRST DRAFT AND THE PROBE NOW REFUSES THAT.** `skillswap` carries
`protect: 1` (read off `dex.moves.get('skillswap').flags`), so the target clicking Protect BLOCKED the
swap: the log read `|-activate|p1a: Altaria|move: Protect`, no rewrite happened, and the arm was green
having handed Cloud Nine to nobody. The Altaria now clicks Roost on that turn, and the arm asserts the
authority's own `-activate … Skill Swap …` line before it claims anything. This is the LESSONS §4
failure caught in flight rather than after.

```
RED:  MEDI_SWITCHIN_ANNOUNCE_SILENT=1
      every member arm is SILENT again        every control HOLDS
      switchInAnnounced +0                    switchInAnnounceSilentRestored = 1
      PASSED — every claim held
```

### `tests/probe_entrydrop_announce_shape.js` — 6 arms

The expected fourth field is READ OFF `onSwitchInDrop.announce`, never typed, and the probe **refuses
to run** if the two members derive the same tail — a row that cannot tell them apart is green on the
engine that confuses them.

```
SYRUP-LEAD    ["ANN:p1a:supersweetsyrup:BARE","unboost:p2a:evasion:1","unboost:p2b:evasion:1"]  both
INTIM-LEAD    ["ANN:p1a:intimidate:boost","unboost:p2a:atk:1","unboost:p2b:atk:1"]              both
SYRUP-RETURN  ONE announcement across a return trip (the `syrupTriggered` guard sits above the line)
INTIM-RETURN  TWO — which is what makes "one" a fact about the ability and not about the script
CTRL-SYRUP (Regenerator) / CTRL-INTIM (Blaze)   nothing at all, either engine
PASSED — every claim held        entryDropAnnounced +5
```

```
RED:  MEDI_ENTRYDROP_ANNOUNCE_INTIMIDATE_SHAPE=1
      SYRUP-LEAD    medicham ["ANN:p1a:supersweetsyrup:boost"]   PARTS from the authority
      SYRUP-RETURN  medicham ["ANN:p1a:supersweetsyrup:boost"]   PARTS
      INTIM-* and both controls HOLD
      entryDropAnnounceIntimidateShapeRestored = 1
      PASSED — every claim held
```

**THE RED ARM IS ASYMMETRIC AND THE PROBE SAYS SO.** The knob restores the single unconditional
Intimidate line, which for Intimidate is the RIGHT line — so the Intimidate arms are CONTROLS under
it. An arm asserting that Intimidate parts would be asserting a defect that never existed.

---

## 6. THE CENSUS

| | HEAD (`git show HEAD:data/mechanics-census.json`) | now |
|---|---|---|
| probed | 984 | **986** |
| **live** | **977** | **979** |
| missing | 0 | **0** |
| threw / hollow | 0 / 0 | **0 / 0** |
| armed / unarmed | 977 / 0 | **979 / 0** |

Diffed row by row: **2 new, 0 lost, 0 verdict flips.**

- `ability / announcesOnSwitchIn` — *"Cloud Nine announces itself as the body walks in, with a BARE
  line — and a body with no such ability says nothing"*. Members read off `data/tags.json`; three
  arms (the member's single line, the line being BARE, and the same entry with no ability).
- `ability / onSwitchInDrop` — *"an entry drop announces in ITS OWN shape — Intimidate with the
  `boost` field, Supersweet Syrup bare"*. The expected tail is read off the tag; the row refuses if
  the two members' tails stop differing; the control is the same entry with no ability.

### Each knob alone, shown refusing the census

```
MEDI_SWITCHIN_ANNOUNCE_SILENT=1
  978 live, 1 missing, 979 probed.
  REFUSED to write data/mechanics-census.json — the engine is running under a deliberate break
  (MEDFAILS.switchInAnnounceSilentRestored).

MEDI_ENTRYDROP_ANNOUNCE_INTIMIDATE_SHAPE=1
  978 live, 1 missing, 979 probed.
  MISSING  onSwitchInDrop  ... emitted supersweetsyrup ["|-ability|p1a: sinistcha|supersweetsyrup|boost"]
  REFUSED to write data/mechanics-census.json — the engine is running under a deliberate break
  (MEDFAILS.entryDropAnnounceIntimidateShapeRestored).
```

`data/mechanics-census.json`'s digest was **`0cc0a7d2c1b4` before and after both knob runs** — the
refusal is real, not a claim.

---

## 7. THE NAMED-GAME REPLAY

Eight games named by SEED in the main tree's `data/game-differential.json` (`--games 1200`, 961 games,
release `834713ccb303`). Each side's team is rebuilt from `data/team-pool-frozen` **by game id**, and
the game is played the way the lattice plays one — `playGame(a, b, <config>, '<idA> vs <idB>',
{ arm: middle, driverSeed: <config>|<tag> })`, which is `playOne`'s own call.

| # | class | config | seed (tail) | artifact cause | under the matching knob | FIXED ENGINE |
|---|---|---|---|---|---|---|
| 1 | Cloud Nine | `omit-weather` | …2654776814 | `\|-ability\|p1a\|cloudnine <> \|turn\|1` | **did NOT reproduce** | clean, 15/15 |
| 2 | Cloud Nine | `baseline` | …2659057254 | `\|-ability\|p2b\|cloudnine <> \|move\|p2a\|shadowball` | **DIVERGED @61, cause identical** | **clean, 11/11** |
| 3 | Cloud Nine | `omit-weather` | …2655173100 | `\|-ability\|p2a\|cloudnine <> \|-ability\|p1a\|intimidate\|boost` | **DIVERGED @5, cause identical** | **clean, 14/14** |
| 4 | Cloud Nine | `omit-spread` | …2658271291 | `\|-ability\|p2a\|cloudnine <> \|turn\|1` | **DIVERGED @5, cause identical** | **clean, 14/14** |
| 5 | Cloud Nine | `pair-protect-bust` | …2659130263 | `\|-ability\|p2a\|cloudnine <> \|turn\|4` | **DIVERGED @64, cause identical** | **clean, 6/6** |
| 6 | Cloud Nine | `omit-intimidate` | …2656876203 | `\|-ability\|p1a\|cloudnine <> \|turn\|4` | **did NOT reproduce** | clean, 9/9 |
| 7 | Syrup | `baseline` | …2634359620 | `-ability field 4 :: …supersweetsyrup <> …\|boost` | **DIVERGED @4, cause identical** | **clean, 10/10** |
| 8 | Syrup | `omit-protect` | …2657592206 | `-ability field 4 :: …supersweetsyrup <> …\|boost` | **DIVERGED @12, cause identical** | **clean, 9/9** |

`board_parted=false` on all eight in every arm.

**SIX OF EIGHT REPRODUCE THE ARTIFACT'S DIVERGENCE EXACTLY** — same cause string, and the same index
on five of the six (game 4 reads index 5 where the artifact says 4). Those six are the evidence: the
knob puts the pre-fix engine back, the divergence returns, the knob comes off and it is gone.

**GAMES 1 AND 6 DO NOT REPRODUCE AND THEREFORE PROVE NOTHING EITHER WAY.** The replay steers the BRING
with the LIVE census, and the lattice used a pinned one (`bdc8ee177ddb` at HEAD); a different census
steers a different four-of-six, so the Cloud Nine body need never reach the field. That is a fact
about the replay's pins, not about the fix — and it is why it is stated rather than counted as a win.

---

## 8. REGRESSION SURFACE CHECKED

Run pinned to `e352496db151`, all exit 0: `probe_start_announce`, `probe_ability_boost_announce`,
`probe_ability_start_on_rewrite`, `probe_entry_update_before_mega`, `probe_refill_entry_herb`,
`probe_narration_b_line_order`, `probe_ability_rewrite_name`. The full 986-row census is green.

`tests/walk_tags.js` was run and reads **AGREE 6 / DIVERGE 10**, byte-identical counts to HEAD's
`data/tag-walk.json`; the artifact it rewrote differed from HEAD only in its timestamp and was
restored with `git checkout --`.

---

## 9. FILES CHANGED

| file | what |
|---|---|
| `engine/tag_dex.js` | NEW tag `announcesOnSwitchIn`; `onSwitchInDrop` gains `announce` |
| `data/tags.json` | REGENERATED — 3 entities changed, 0 usage counts moved, `sheet_entries` identical |
| `engine/medicham2-browser.js` | `switchInAnnounce()` + its two arrival call sites; `applyEntryDrops`'s announcement block; `MEDI_SWITCHIN_ANNOUNCE_SILENT`, `MEDI_ENTRYDROP_ANNOUNCE_INTIMIDATE_SHAPE`; four new counters |
| `tests/probe_switchin_announce.js` | NEW — 8 arms, `--red` |
| `tests/probe_entrydrop_announce_shape.js` | NEW — 6 arms, `--red` |
| `tests/test-mechanics.js` | two new census rows; both knobs added to `DELIBERATE_BREAK` |
| `data/mechanics-census.json` | REGENERATED — 986 probed / **979 live** / 0 missing |
| `docs/ENGINE.md` | a section for this pass and the hand-list update (outside every `<!-- GENERATED -->` block) |

**NOT touched, per the brief:** `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`,
`engine/game_differential.js`, `engine/board.js`, `engine/magnemite.js`, `data/engine-data.js`.
`node engine/status.js --write` was NOT run. Nothing was committed or pushed.

---

## PROPOSED NOTES ROW

```markdown
### 6.75.0 — 2026-09-20 — Cloud Nine announces on ARRIVAL, and Supersweet Syrup announces BARE

**What changed.** `engine/tag_dex.js` derives two new facts and `engine/medicham2-browser.js` consumes
each at one place. **`announcesOnSwitchIn`** is every ability whose `onSwitchIn` is nothing but the
bare announcement of its own name plus a delegation to its own `onStart` — Cloud Nine
(`data/abilities.ts:534-538`) and Air Lock (`:90-94`), the whole of the dex, of which only Cloud Nine
has a legal carrier in Reg M-B. `switchInAnnounce()` writes that line from the TWO arrival roads and
from none of the three `applyEntryEffects` roads that are not arrivals, which is the authority's own
rule: an ability that declares `onSwitchIn` gets it at an entry and its `onStart` on a mega, a Trace,
a Skill Swap or a Neutralizing-Gas departure, and `onStart` writes nothing. Separately,
`onSwitchInDrop` gains a derived **`announce {event, tail, gatedOnFoe}`**, because Intimidate writes
`'-ability', pokemon, 'Intimidate', 'boost'` inside its foe loop and Supersweet Syrup (`:4708`) writes
it BARE above the loop, and `applyEntryDrops` had one unconditional line for both.

**Figure.** `data/mechanics-census.json` (regenerated this pass): **986 probed / 979 live / 0
missing**, up from 984 / 977 / 0 at `61a2b68d`; 2 new rows, 0 lost, 0 verdict flips. New rows
`ability / announcesOnSwitchIn` and a second `ability / onSwitchInDrop`.
`tests/probe_switchin_announce.js` (8 arms) and `tests/probe_entrydrop_announce_shape.js` (6 arms) are
green against the authority on worktree release `e352496db151` and red under
`MEDI_SWITCHIN_ANNOUNCE_SILENT=1` / `MEDI_ENTRYDROP_ANNOUNCE_INTIMIDATE_SHAPE=1`. `data/tags.json`
regenerated with `sheet_entries` unmoved at 316,656 and zero usage counts changed.

**Supersedes.** Nothing published. The two mechanisms are 86 of the 89 gate-lattice protocol
divergences reported in `docs/_reports/2026-09-19-834713-remeasure.md`; **no lattice was re-run and no
narration figure is claimed here**, so `23 / 30 / 33` stands until it is re-measured.

**Basis.** unchanged — the census still counts "probes whose arms both fire and whose engine matches
the authority", and the whole-game narration question is unchanged. The engine moved; the question did
not.

**Owes.** The three gate lattices at `--games` 1200 / 1350 / 1950, and the deliberate roster (the
`cloudnine`, `supersweetsyrup`, `earlybird`, `insomnia`, `sweetveil`, `vitalspirit`, `altarianite`,
`habanberry` rows and the seven move rows staged on a Cloud Nine body).
```

---

## OWED, NOT RUN

- **NO GATE LATTICE WAS RUN AND NO NARRATION FIGURE IS CLAIMED.** The brief is LIGHT MODE. The
  whole-game evidence here is eight NAMED games replayed individually. The gate's
  `23 / 30 / 33` at `--games` 1200 / 1350 / 1950 stands as last measured and is owed a re-run.
- **THE DELIBERATE ROSTER WAS NOT RUN.** `data/all-mechanics-fire.json` names 15 diverging staged
  mechanics on `834713ccb303`, 14 of them the Cloud Nine line and 1 the Syrup line. Every one should
  now clear, and none of it is measured here.
- **GAMES 1 AND 6 OF THE REPLAY DID NOT REPRODUCE** and are not evidence; see §7 for why (the replay
  steers with the live census, the lattice with a pinned one).
- **THE `gatedOnFoe: false` HALF OF SYRUP'S RULE HAS NO STAGED ARM.** A carrier arriving with no live
  adjacent foe is not reachable from any scripted board in this harness (a doubles side with both
  foes dead is refilled before the next entry). The counter `MEDSEEN.entryDropAnnounceSkippedNoFoe`
  exists, is asserted, and reads 0 — which is honest ignorance, not a pass.
- **A MEMBER WITH A POSITIVE `onSwitchInPriority` HAS NO HOIST.** `switchInAnnounce` refuses it loudly
  (`MEDFAILS.startAnnouncePriorityMissing`) rather than placing the line below the hazards where it
  would not belong. Both current members declare none, so nothing is affected today; the hoist
  `startAnnounceEarly` does for `announcesOnStart` would be the fix if one ever appears.
- **`data/games.{bo3,ots,ladder}.jsonl` WERE HARD-LINKED IN AND REMOVED AGAIN.** They are the stale
  2026-09-10 monoliths beside the main tree's tracked shards; a later run in this worktree would have
  read them silently. The originals are untouched (link counts back to 2).
- **`data/team-pool-frozen/games.{bo3,ots}.jsonl` ARE HARD LINKS INTO THE MAIN TREE AND ARE LEFT IN
  PLACE.** They are gitignored, nothing was written to them, and the pool is frozen by construction,
  so a link to it cannot go stale. `data/diff-team-pool.json` (the pool cache) was rebuilt in this
  worktree — pool digest `f807cbc40299`, 8,778 teams.
- **RELEASE-CUT SIDE EFFECT.** One cut in this worktree produced `e352496db151` under
  `data/releases/` (gitignored) and moved `data/engine-release.json`, which was **RESTORED** from
  `<scratch>/cloudnine-syrup/engine-release.json.bak` at the end. `data/provenance-stamp.json` did not
  move; a backup was taken anyway.
- **THE FULL BATTERY WAS NOT RUN** (the brief forbids it). What WAS run is in §8. Any probe outside
  that list which compares a raw stream carrying a Cloud Nine body or an entry drop may now be red and
  has not been counted.
- **NOT COMMITTED, NOT PUSHED.** `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js` and
  `engine/game_differential.js` were not authored; the notes row is proposed above.
  `node engine/status.js --write` was not run.
