# Narration batch D — Hyper Cutter line order, Mortal Spin's `[from]`, Magician's `-enditem` — 2026-09-19, ENGINE (light mode)

A findings record, not a living document. It is superseded by the register rows it feeds. Do not cite it as
current state. `node engine/status.js` holds the current state.

---

## 0. VERDICT

- **All three assigned games are fixed.** Each one replays on the fix release `88de74589dc3` to the end of the
  battle, with no protocol divergence and every board held. Each one reproduced its artifact split exactly on
  `1a6550ea5ec6` first.
- **Two more defects were found while checking the class. Both are fixed.**
  - The spin family's own Leech Seed `-end` has the same missing `[from]` (narration).
  - A Magician thief that dies inside its own move stole the item onto its corpse. This is a **board** defect.
- **One more defect was found and is not fixed.** Tidy Up writes its boosts above its sweep and omits
  `-activate|…|move: Tidy Up`. See §5.
- **Census 947 → 951 live, 0 missing, 0 hollow.** Each knob, set alone, reads 950 live / 1 missing (its own row) and
  refuses to write.
- **Probe `tests/probe_narration_d.js`, 14 arms.**
  - PASS on `88de74589dc3`.
  - On `1a6550ea5ec6`, all 7 red arms go RED. The `magicianDead` control also goes RED there, because it carries
    the old Magician `-enditem` line.
  - No knob moves a control.
- **No joins in what I ran.**
  - The other 5 g1950 and 3 g1350 first-divergence games are byte-identical in their first divergence on both
    releases.
  - A 131-game sentinel (pairs 0–15 of every config, g1950) reads 0 diverged / 0 parted on both releases, line
    for line.
- **Predicted, NOT MEASURED (light mode):** undeclared narration 0 / 2 / 6 → **0 / 2 / 3**, and board-material
  stays 0 / 0 / 0. The lattice re-run is owed.

## 1. PINS

| pin | value |
|---|---|
| pre-fix release | `1a6550ea5ec6`. I re-cut it in this worktree before any edit, and it came back as the same id |
| fix release | `88de74589dc3`. I cut it in this worktree. A re-cut after the census regeneration returned the same id |
| intermediate | `5bddbc150a2a` (the first three fixes) and `c94d3a4bc534` (plus the dead-thief guard). Both were superseded; the Leech Seed line landed after `c94d…` |
| team store | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` (the main tree's absolute path) |
| flags | `--games 1950` or `1350` (each lattice at its own size), `--arm middle --steering empirical --end-state --turns 50`, no warm-up |
| census | not pinned. Under empirical steering the census is credited only and does not select |

**Reproduction.**
- Run as single games (`engine/replay_one.js --no-warmup`), Mortal Spin and Magician reproduced at index 79 and
  119. The Hyper Cutter game did NOT reproduce. It played a different game that never parted.
- The replay_one warm-up would have played about **2,838 games** to reach that game (pair #136 of 216 in the 9th
  config). That is a lattice run, so I did not run it.
- Instead I played all eight g1950 first-divergence games in the artifact's row order in ONE process (scratchpad
  `replay_list.js`: `pairsFor` + `playGame`, the same calls replay_one makes). On `1a6550ea5ec6` **all eight
  reproduced their artifact index and raw lines exactly**, the Hyper Cutter game at 145. That run is the baseline
  for the before/after below.

## 2. THE THREE MECHANISMS

### 2a. Parting Shot into Hyper Cutter — line order (g1950 pair-speedctrl `…2662455751`, idx 145, t9)

**What the authority does.** `Battle#boost` (`sim/battle.ts:2017-2082`; the Champions `scripts.ts` does not
override it) runs these steps in order:
1. `ChangeBoost`
2. `getCappedBoost` (`sim/pokemon.ts:1216`)
3. **`TryBoost` over the whole table** (`:2031`)
4. the per-stat loop that writes `-boost` / `-unboost` (`:2035`)

Every refuser writes its line **inside** step 3, while it deletes the key:
- Hyper Cutter: `-fail|…|unboost|Attack|[from] ability: Hyper Cutter|[of] …`
- Clear Body / White Smoke: one line for the whole table
- Flower Veil: `-block`
- Mirror Armor: its reflected `boost()`

So the refusal is written above every stat of the same table that lands.

**What we did, and the cause.** `boostTableOnto` and the pivot's code-table loop both asked `statDropRefusal` per
stat, inside the loop, and announced once **after** the loop. So we wrote `-unboost|spa|1` first and the `-fail`
second.

**The fix.** A new helper, `tableDropRefusals`, asks every negative stat of the table first. `announceTableRefusal`
then writes WIRE 3's one line (or the veil's `-block`) ABOVE the loop, and the loop skips the refused stats. Both
roads now use it. Mirror Armor's reflection also moves into the pre-pass, which is where the authority's
`onTryBoost` puts it.
- Knob: `MEDI_DROP_REFUSAL_AFTER_TABLE=1`, which moves the announcement back below the loop.
- Counter: `MEDSEEN.dropRefusalAnnouncedFirst`.

**The class, derived by the probe on every run.**
- Legal refusers with carriers:
  - Big Pecks (def): Pidgeot
  - Clear Body (all): Metagross, Dragapult, Garganacl
  - Hyper Cutter (atk): Pinsir, Mawile, Gliscor, Crabominable
  - Illuminate and Keen Eye (accuracy)
  - Mirror Armor (all): Corviknight
  - White Smoke (all): Torkoal
  - Flower Veil (ally, Grass): Floette-Eternal, Florges
  - Inner Focus, Oblivious, Own Tempo and Scrappy refuse Intimidate only, and Intimidate is a single stat, so it
    has no ordering case.
- Legal multi-stat target tables with a drop in them: Memento, Noble Roar, Parting Shot, Spicy Extract, Tearful
  Look, Tickle.
- The **ordering** case needs a partial refuser (Hyper Cutter, Big Pecks, Keen Eye, Illuminate) and a table where
  another stat lands. A full refuser has nothing to be out of order with, and the probe's `pshot` control (Clear
  Body) shows that under the knob too.
- Staged: Parting Shot (the pivot road) and Tickle (the declared-table road), both into Hyper Cutter.
- Not staged separately: Noble Roar, Tearful Look, Memento, and Spicy Extract into Big Pecks. They go through the
  same `boostTableOnto` road as Tickle.

**Replay.** On `88de74589dc3` the game **never parts**, and the board held at 13 of 13 boundaries. It reproduced
at 145 on `1a6550ea5ec6` in the same run order.

### 2b. Mortal Spin's `[from]` / `[of]` (g1950 omit-intimidate `…2659871951`, idx 79)

**What the authority writes.** From `data/moves.ts` (no Champions override):

| move | line | attributed? |
|---|---|---|
| Mortal Spin, Rapid Spin | `-sideend|<side>|<Condition name>|[from] move: <Move>|[of] <user>` for each hazard | yes |
| Mortal Spin, Rapid Spin | `-end|<user>|Leech Seed|[from] move: <Move>|[of] <user>` | yes |
| Mortal Spin, Rapid Spin | partial trap: the condition's own `-end|<user>|<move>|[partiallytrapped]` | no |
| Mortal Spin | poison: the secondary's plain `-status|<target>|psn` | no |
| Defog | hazards on both sides | yes |
| Defog | screens: the condition's own bare `onSideEnd` line | no |
| Tidy Up | `-sideend|<side>|<name>` | no |

**What we did.** Every hazard line went through `TR.sendSide`, which writes it bare. The seed line went through
`TR.vend`, which is also bare. The trap and poison lines already agreed with the authority.

**The fix.** `tag_dex.js` now derives two params off the handler's own `add()` call:
- `removesHazards.attributesSideEnd`, which matches Defog, Mortal Spin and Rapid Spin, and not Tidy Up;
- `removesHazards.attributesSeedEnd`, which matches Mortal Spin and Rapid Spin.

Both match lists were printed before wiring. `sweepField` now takes the move id and writes
`[from] move: <tag record name>` plus `[of] <user>` through two new emitters, `sendSideFrom` and `vendFrom`. A
carrier that reaches `sweepField` with no move identity is counted in `MEDFAILS.sweepAttributionNoMove`. It is not
defaulted.
- Knob: `MEDI_SWEEP_UNATTRIBUTED=1`, which covers both lines.

**`data/tags.json` was patched, not regenerated.**
- This worktree has no store, so a full `tag_dex.js` run (through `tools/lownode.cmd`, exit 0) wrote
  `sheet_entries: 0` and zeroed 804 usage counts.
- I diffed its params against HEAD. Exactly three rows differed (defog, mortalspin, rapidspin), and each differed
  only by the new keys.
- `tagpatch2.js` (scratchpad) carries only those keys onto HEAD's bytes. It refuses unless HEAD round-trips through
  `JSON.stringify(…, null, 1)` byte for byte, and unless each row differs by the new keys alone.
- The result is 5 params and +8 / −3 lines. The next full regeneration on a machine with the store produces the
  same params.

**Replay.** On `88de74589dc3` the game **never parts**, with the board held at 13 of 13 and both engines ending the
battle. On `1a6550ea5ec6` it parted at 79.

### 2c. Magician's extra `-enditem` (g1950 omit-intimidate `…2662767282`, idx 119, t8)

**What the authority writes.** `data/abilities.ts:2467-2485` (no Champions override), `onAfterMoveSecondarySelf`,
writes **one** line when it steals:
`this.add('-item', source, yourItem, '[from] ability: Magician', `[of] ${pokemon}`)`.
The `-enditem|…|[silent]|[from] ability: …` + `-item` pair belongs to **Pickpocket** (`:3243-3244`).

**When it prints nothing:**
1. The handler returns early when:
   - the source already holds an item;
   - `switchFlag === true`;
   - there are no `hitTargets`;
   - it is holding a Gem;
   - the move is Fling;
   - the move is a Status move.
2. `takeItem` refuses. The handler continues to the next target, silently (a mega stone, for example).
3. **`source.setItem` refuses** (`sim/pokemon.ts:1874`, `if (!this.hp || !this.isActive) return false`). The handler
   writes `pokemon.item = yourItem.id` back with no line, and continues.
4. A fainted source's handler does not run at all (`sim/battle.ts:512`).

**What we did.**
- We wrote the borrowed `-enditem` line.
- **For case 3, we gave the item to a thief at 0 HP.** Staged in the probe: Delphox at 19 HP, Flare Blitz, recoil
  to 0. The authority leaves the victim's Leftovers alone. Ours took them onto the corpse, and the board parted at
  t4 under the knob.

**The fix.**
- The `-enditem` line is removed. Knob: `MEDI_MAGICIAN_ENDITEM_LINE=1`.
- A thief with `curHP <= 0` takes nothing (`MEDSEEN.magicianThiefCannotHold`). Knob:
  `MEDI_MAGICIAN_DEAD_THIEF_TAKES=1`.

**Replay.** On `88de74589dc3` the game **never parts**, with the board held at 10 of 10 and both engines ending the
battle. On `1a6550ea5ec6` it parted at 119.

## 3. EVIDENCE

**Probe `tests/probe_narration_d.js`.** Two engines, and both play the identical script. Species are derived from
the format, filtered to the regulation, and printed. `buildPair` reports 0 illegal fixture sets.

| arm | red: under its knob, it parts at | control |
|---|---|---|
| pshot (Grimmsnarl Parting Shot → Crabominable Hyper Cutter) | 10 `-fail…Hyper Cutter` <> `-unboost|spa|1` | Clear Body Metagross: agrees under the knob |
| table (Azumarill Tickle → Crabominable) | 10 `-fail…Hyper Cutter` <> `-unboost|def|1` | plain Aggron: agrees |
| mortalspin (Glimmora; Aggron Stealth Rock) | 22 `-sideend…[from] move: Mortal Spin` <> bare | nothing to sweep: agrees |
| spinseed (Glimmora seeded by Appletun) | 23 `-end…Leech Seed|[from] move: Mortal Spin` <> bare | no seed: agrees |
| defog (Conkeldurr; Aggron Stealth Rock) | 23 `-sideend…[from] move: Defog` <> bare | Defog removes Appletun's Reflect, a bare line: agrees |
| magician (Delphox Psychic → Aggron @ Leftovers) | 13 `-item…Magician` <> `-enditem…[silent]` | Pickpocket Grimmsnarl's pair: agrees |
| magicianDead (Delphox at 19 HP, Flare Blitz → Chesnaught @ Leftovers) | 47, **board PARTED t4** | full-HP theft: agrees |

**Census rows** (`tests/test-mechanics.js`, after the Berserk row). All four are in `DELIBERATE_BREAK`:

| kind | tag | row |
|---|---|---|
| ability | `preventsStatDrop` | a partial refuser's `-fail` is written ABOVE the landed stat. Tickle and Parting Shot into Hyper Cutter; control: Tickle into no ability |
| move | `removesHazards` | a spin's hazard `-sideend` and its own Leech Seed `-end` name the move; Tidy Up's line is bare |
| ability | `stealsItem` | Magician writes one `-item`; Pickpocket writes the pair |
| ability | `stealsItem` | a Magician thief killed by its own recoil takes nothing |

**Replays.** Scratchpad `replay_list.js`, one process, in the artifact's row order, no warm-up.

| lattice | game | `1a6550ea5ec6` | `88de74589dc3` |
|---|---|---|---|
| 1950 | Mortal Spin `…2659871951` | 79 | never parted, 13/13 |
| 1950 | Magician `…2662767282` | 119 | never parted, 10/10 |
| 1950 | Hyper Cutter `…2662455751` | 145 | never parted, 13/13 |
| 1950 | Forewarn, Chilly Reception, Misty Terrain, two `fallenundefined` | 4 / 105 / 52 / 34 / 23 | identical |
| 1350 | two Forewarn, one `fallenundefined` | 6 / 38 / 70 | identical |

**Neighbouring probes on the worktree tree.** Each of these exits 0:
- `probe_defog_target_side`
- `probe_hazard_sweep_order`
- `probe_partingshot_conditional` (19 arms)
- `probe_partingshot_mirrorarmor`
- `probe_pickpocket_event_position`
- `probe_pickpocket_on_a_corpse`
- `probe_reopen_partings`
- `probe_narration_b_line_order`
- `probe_narration_a --release 88de…`
- `probe_moldbreaker_refusals --release 88de…`
- `test-tag-params-derived`
- `test-engine-consistency`

## 4. FILES CHANGED

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a7908d9402d3ba86f`.

- `engine/medicham2-browser.js`:
  - `tableDropRefusals` and `announceTableRefusal`, used at `boostTableOnto` and at the pivot's code table;
  - `sweepField(…, mvId)` with the attributed hazard and seed lines, and the three call sites pass the move id;
  - the `TR.sendSideFrom` and `TR.vendFrom` emitters;
  - the Magician site;
  - four knobs, stamped at load;
  - the MEDSEEN / MEDFAILS keys.
- `engine/tag_dex.js`: the `attributesSideEnd` and `attributesSeedEnd` derivations.
- `data/tags.json`: five params carried onto HEAD's bytes (see §2b).
- `tests/probe_narration_d.js`: new, 14 arms.
- `tests/test-mechanics.js`: four census rows and four `DELIBERATE_BREAK` names.
- `data/mechanics-census.json`: regenerated, 951 live.
- `docs/ENGINE.md`: one section with its hand list, and the probe added to the Owns list.
- This report.

These were not touched:
- `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, and `status.js --write`.
- `board.js`, `magnemite.js` and `engine-data.js`.

I ran no write git command other than one `git restore`, which put back my own appended cut on the tracked
`data/releases/1a6550ea5ec6/{cuts.jsonl,release.json}`. `data/engine-release.json` is restored to its HEAD bytes.
Releases `5bddbc150a2a`, `c94d3a4bc534` and `88de74589dc3` sit in this worktree's ignored `data/releases/`.

## 5. FOUND AND NOT FIXED

- **Tidy Up.** Ours writes `-boost|atk|1` above its `-sideend` and never writes `-activate|…|move: Tidy Up`. The
  authority's order, from its `onHit`, is:
  1. every doll `-end`
  2. `-sideend` ×n (bare)
  3. `-activate|<user>|move: Tidy Up` (if anything was removed)
  4. `-boost|atk` and `-boost|spe`

  I staged this in two engines as the first draft of the `defog` control, where it parts at index 18. It is in no
  lattice game. It is a separate mechanism, and I did not fold it into this batch.
- **A refused stat at the floor.** `getCappedBoost` runs before `TryBoost`, so a −1 into a −6 stat reaches the
  refuser as 0. The authority then writes `-unboost|…|0`, and the refuser writes nothing. Ours refuses and
  announces whatever the stage. Mirror Armor alone is floor-aware (`reflectSkipsAtFloor`). I read this from the
  code and did not stage it.
- **Reds I saw that this change did not cause:**
  - `tests/test-protocol-trace.js` PART 5 fails with "the two streams never part in the Intimidate arm". Both
    engines now print 112/170 in both arms, and the test still expects the damage lines to differ. This change does
    not touch damage, Intimidate or crits. **I did not re-run it at HEAD.**
  - `tests/probe_stealeat_derivation.js` exits 2 (CANNOT ANSWER). It pins the old release `2b5a6585d8cf`, whose
    `TRACE_EVENTS` has no `-block`, against HEAD's `data/protocol-events.json`. This batch leaves `TRACE_EVENTS`
    unchanged.
  - `tests/probe_moldbreaker_refusals.js` prints "132 distinct set(s) checked, 5 illegal — 5 NOT baselined". Those
    are its own fixtures. The probe passed.

## PROPOSED NOTES ROW

```
## [<<VER>>] — 2026-09-19 — narration batch D: a table's TryBoost refusal above the stats that land, the spin/Defog `[from] move:` attribution, Magician's single `-item`; a Magician thief at 0 HP takes nothing
- **What changed.** `engine/medicham2-browser.js`, four fixes, each behind its own knob. (1) `Battle#boost` runs TryBoost over the whole table before its per-stat loop (sim/battle.ts:2031), so a partial refuser's `-fail` (Hyper Cutter, Big Pecks, Keen Eye) is now written ABOVE the stats of the same table that land, on both the declared-table road and Parting Shot's (`MEDI_DROP_REFUSAL_AFTER_TABLE`). (2) Rapid Spin, Mortal Spin and Defog write their hazard `-sideend` with `[from] move: <Move>|[of] <user>`, and the spin family's own Leech Seed `-end` likewise; Tidy Up stays bare. New params `removesHazards.attributesSideEnd` / `.attributesSeedEnd`, derived by `engine/tag_dex.js` off the handler's `add()` call, carried into `data/tags.json` for five rows (`MEDI_SWEEP_UNATTRIBUTED`). (3) Magician's theft writes one `-item`; the `-enditem [silent]` pair was Pickpocket's (`MEDI_MAGICIAN_ENDITEM_LINE`). (4) A Magician thief brought to 0 HP inside its own move no longer takes the item (`setItem` refuses on `!this.hp`) — a board fix (`MEDI_MAGICIAN_DEAD_THIEF_TAKES`). New probe `tests/probe_narration_d.js` (14 arms): PASS on `88de74589dc3`, every red arm RED on `1a6550ea5ec6`.
- **Measured.** Census **947 -> 951 live, 0 missing**, `data/mechanics-census.json`. Single-process replays (no warm-up, empirical steering, pinned team store) on `88de74589dc3`: the three g1950 games (`…2662455751` idx 145, `…2659871951` idx 79, `…2662767282` idx 119) play to the end with no protocol divergence and every board held; the other 5 g1950 and 3 g1350 first-divergence games are byte-identical; a 131-game sentinel reads 0 / 0 on both releases. Lattices NOT re-run (light mode).
- **Basis.** unchanged.
- **Supersedes.** ~~947 live~~ (6.58.0 row), now 951.
- **Owed to the next major.** Technical docs mechanics list. OWED, NOT RUN: the three lattices (predicted narration 0 / 2 / 6 -> 0 / 2 / 3, board-material 0 / 0 / 0) and the roster stages on `88de74589dc3`. Report: `docs/_reports/2026-09-19-narration-d.md`.
```

## OWED, NOT RUN

1. **The three lattices (1200 / 1350 / 1950) and the three roster stages on `88de74589dc3`.**
   - Predicted undeclared narration: **0 / 2 / 3**. The three games in this batch leave, and Forewarn ×3, Chilly
     Reception and Sleep Powder under Misty stay (the other agent is on those).
   - Predicted board-material: **0 / 0 / 0**.
   - A join is possible, because fix 1 changes line order on every partial refusal, and fix 4 changes a board. The
     sentinel and the 11 replayed games saw none.
2. **The CHANGELOG entry, the notes row above, and `status.js --write`.** These belong to the coordinator.
3. **Tidy Up's line order and its missing `-activate`** (§5). Staged, not fixed.
4. **The floor-capped TryBoost** (§5). Read, not staged.
5. **`tests/probe_hazard_sweep_order.js` still only PRINTS the attribution.** Its row in `docs/ENGINE.md` says
   deriving the discriminator "needs `tag_dex.js`, which exhausts the heap". That is no longer true: it now runs
   under `tools/lownode.cmd` (ABRA-HEAP 3072), and the params exist. That row's wording is stale, and I did not edit
   it.
6. **A full `tag_dex.js` regeneration on the main tree** (it has the store), to confirm that it writes the same five
   params and nothing else.
7. **The three pre-existing reds in §5.** I did not re-run `test-protocol-trace.js` at HEAD to prove it red there.
