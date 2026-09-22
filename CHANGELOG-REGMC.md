# Changelog — ABRA on Reg M-C

<!-- LINE: id=abra/regmc; label=ABRA on Champions Reg M-C; format=gen9championsvgc2026regmc -->

All notable changes to ABRA's **Reg M-C** line are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**This is a separate version series and it starts at 0.1.0.** A leading `0` means NOT USABLE YET
(SemVer 2.0.0 clause 4). This line reaches **1.0.0 the day the Reg M-C gate opens** — computed by
`node engine/quarantine.js`, never declared by anyone.

**Reg M-B's record is `CHANGELOG.md` and is CLOSED at 7.0.0.** Nothing here renumbers it, rewrites a
released row, or moves a published figure. A version in this file is not comparable to a version in
that one: they answer different questions about different regulations. See
[`docs/REGMC.md`](docs/REGMC.md) — *The version scheme* — for what a number means and when it resets.

**Rule.** Every change is logged here in the same pass as the code, together with the matching row in
`docs/RUNNING-NOTES.md` (tagged `## [abra/regmc <version>]`). A prior conclusion is never silently
rewritten; what changed and why is stated.

---

## [0.45.0] — 2026-09-22

### Fixed
- **Ice Spinner removes the terrain after it hits, in both regulations.** Its handler pair is
  `onAfterHit() { this.field.clearTerrain(); }` and `onAfterSubDamage() { if (source.hp) this.field.clearTerrain(); }`
  (M-C checkout `data/moves.ts` icespinner :9417-9437; the Reg M-B checkout is identical). It has no `onTry`, so the
  `failsWithoutTerrain` tag (Steel Roller) never matched it, no tag said the terrain goes, and this engine left it up.
  New move tag `clearsTerrainAfterHit` in `engine/tag_dex.js` (read off `onAfterHit` only; `throughSubstitute`,
  `subNeedsUserHP`, `onlyOnConnect`); membership printed before wiring: Ice Spinner alone, in both regulations. Read in
  `engine/medicham2-browser.js` by `_afterHitField`, the step that already holds the other two `onAfterHit` families
  (`hazardOnHit`, `removesHazards`), gated on a connected hit, a user still standing (`AfterHit` runs only
  `if (pokemon.hp)`, `sim/battle-actions.ts` :1120) and the substitute rule. Knob `MEDI_AFTERHIT_TERRAIN_INERT`.
- `tests/probe_regmc_ice_spinner.js` (`--regulation regmc`): CLEAR, SUB (behind a Substitute), NONE (no terrain) and
  CONTROL (a plain hit leaves the terrain). Exit 0 clean; exit 1 under the knob and on release `1f475312c778` with the
  0.44.0 engine bytes.

### Changed
- **`data/tags.json` (Reg M-B) moves, by Will's approval for this fix.** Exactly two rule changes, in both tag files and
  printed by a structural diff: the `icespinner` row gains `clearsTerrainAfterHit`, and the tag's descriptor is added.
  No other row moved; usage figures are the committed ones. `data/abra-tags.js` rebuilt (`build/build_tags_js.js
  --check` passes). `data/protocol-events.json` and `data/move-effects.js` byte-identical.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 4 of 954 → 3 of 954 on release
  `d0e34207d250`; the Ice Spinner game left, none joined.
- Reg M-B (release `a193df3c8301`, `SHOWDOWN_PATH` the M-B checkout): lattice 1200 **0 of 961**, 1350 **0 of 1069**,
  1950 **0 of 1497**, 0 void each. The 1 and 2 protocol-only divergences at 1350 and 1950 are all Kingambit's silent
  `-end …|fallenundefined` line, and no game in either dump contains Ice Spinner. Readings:
  `docs/_reports/2026-09-22-regmc-engine-4.md` §1.

## [0.44.0] — 2026-09-22

### Fixed
- **Berserk is not raised by a Sheer Force hit.** Berserk's boost is an `onAfterMoveSecondary` handler, and
  `afterMoveSecondaryEvent` (`sim/battle-actions.ts` :811-818, the same in both checkouts) skips that whole event when
  `move.hasSheerForce` and the attacker has Sheer Force — which Sheer Force's `onModifyMove` sets exactly when the move
  had secondaries. This engine's `boostsAtHPThreshold` step never asked. New `sheerForceSkipsAfterMove(attacker, move)`
  in `engine/medicham2-browser.js`, read off the attacker's `removesOwnSecondaries` tag and the move's rulebook row; the
  Emergency Exit door, which asked the same question inline since 0.22.0, now calls it (its probe stays green). No tag
  moved. Knob `MEDI_THRESHOLD_IGNORES_SHEER_FORCE`.
- `tests/probe_regmc_sheer_force_threshold.js` (`--regulation regmc`): SHEER (a Sheer Force attacker's move with a
  secondary takes the holder across half: no boost) and CONTROL (the same attacker on its other ability: the boost).
  Exit 0 clean; exit 1 under the knob and on release `04de2d2fc705` with the 0.43.0 engine bytes.

### Notes
- **This is a shared-engine fix and Reg M-B's rule is the same.** Berserk (Drampa, Drampa-Mega) and Sheer Force (nine
  carriers, Camerupt-Mega among them) are legal in Reg M-B, and the Reg M-B checkout's `afterMoveSecondaryEvent` carries
  the identical gate, so the closed line carried this defect latent: no Reg M-B lattice dealt the pair. Reg M-B
  measured unmoved: three files byte-identical; lattice `--games 1200` 0 of 961 with `agreement_by_turn` identical to
  this pass's first Reg M-B reading (release `0d1733910f65`). Its held-out draw was not run.
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 5 of 954 → 4 of 954 on release
  `1f475312c778`; the Berserk game (Camerupt-Mega's Earth Power into Drampa-Mega) left, none joined. Readings:
  `docs/_reports/2026-09-22-regmc-engine-3.md` §4.

## [0.43.0] — 2026-09-22

### Fixed
- **Seed Sower sets Grassy Terrain when its holder is hit, in Reg M-C.** The ability was `untagged`: `effectRecipients`
  in `engine/tag_dex.js` counted `setWeather` and `sideCondition` as a cost to the attacker but not `setTerrain`, so
  `punishesAttacker` never matched it. M-C checkout `data/abilities.ts` seedsower :4119-4127
  (`onDamagingHit() { this.field.setTerrain('grassyterrain'); }`). `punishesAttacker` now reads `setsTerrain`, written
  only when present, so every existing row keeps its keys; membership, printed before wiring: `seedsower` (Arboliva in
  Reg M-C; no legal carrier in Reg M-B, so no Reg M-B row). The row alone was spliced into `data/tags-regmc.json`.
  `engine/medicham2-browser.js`: beside Sand Spit's weather, the terrain is set through the same four steps the terrain
  move takes (a standing terrain refuses, the holder's Terrain Extender, `-fieldstart … [from] ability`, the seeds'
  `TerrainChange`). Knob `MEDI_PUNISH_TERRAIN_INERT`.
- `tests/probe_regmc_seed_sower.js` (`--regulation regmc`): HIT (the terrain starts and the partner's Grassy Seed is
  spent), UP (a second hit into the standing terrain starts nothing) and a CONTROL on the holder's other ability. Exit 0
  clean; exit 1 under the knob and on release `e4ec330c6314` with the 0.42.0 engine bytes.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 6 of 954 → 5 of 954 on release
  `04de2d2fc705`; the Seed Sower game left, none joined. Reg M-B unmoved: three files byte-identical, lattice
  `--games 1200` 0 of 961 (release `fb3fcbb03756`). Readings: `docs/_reports/2026-09-22-regmc-engine-3.md` §3.

## [0.42.0] — 2026-09-22

### Fixed
- **Liquid Ooze turns a drain, a Leech Seed return and a Strength Sap into damage, in Reg M-C.** The ability was
  `untagged` and nothing read it, so the healer healed. M-C checkout `data/abilities.ts` liquidooze :2402-2415
  (`onSourceTryHeal`: for `drain`, `leechseed` and `strengthsap`, `this.damage(damage); return 0`), and `Battle#heal`
  (`sim/battle.ts` :2261-2301) runs TryHeal before its full-HP refusal, so a full-HP healer is damaged too. New ability
  tag `reversesHeal {from}` in `engine/tag_dex.js`, derived off the handler (membership: `liquidooze`, whose one legal
  carrier is Swalot in Reg M-C; no legal carrier in Reg M-B, so no Reg M-B row); the row and its descriptor spliced
  into `data/tags-regmc.json`, nothing else moved. `engine/medicham2-browser.js` `oozeReverse` at the three heal sites,
  on the Big-Root-multiplied amount, honouring Magic Guard (`refusesIndirect`). Knob `MEDI_OOZE_INERT`.
- `tests/probe_regmc_liquid_ooze.js` (`--regulation regmc`): DRAIN, SAP and SEED into the holder from a full-HP healer,
  and a CONTROL on the holder's other ability. Exit 0 clean; exit 1 under the knob and on release `2d5d6ec26e28` with
  the 0.41.0 engine bytes.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`): 7 of 954 → 6 of 954 on release
  `e4ec330c6314`; the Liquid Ooze game left, none joined. Reg M-B unmoved: three files byte-identical, lattice
  `--games 1200` 0 of 961 (release `97d18af7a5a9`). Readings: `docs/_reports/2026-09-22-regmc-engine-3.md` §2.

## [0.41.0] — 2026-09-22

### Fixed
- **Revival Blessing revives a fainted ally, in Reg M-C.** With a fainted body in the party the move was counted
  `MEDFAILS.reviveUnmodelled` and played as a pivot that brought a LIVE bench body in; the authority revives the first
  fainted body in party order to half its max HP (`sethp` truncates), writes `-heal|pN: <name>|…|[from] move: Revival
  Blessing`, and, when the corpse still holds an active slot, instaswitches it back in: at once when any move is still
  queued that turn, after the residual otherwise (M-C checkout `sim/battle.ts` :2781-2798 and :2916-2923,
  `sim/battle-queue.ts` :307-313). `engine/medicham2-browser.js` `reviveFainted` / `reviveInstaswitch`: the pick reads
  `sf.team` (kept in the authority's party order since ROADMAP #544), the revived body goes to the bench in party order
  or back into its slot, its own queued action is cancelled by the instaswitch, and `fallenCount` keeps counting the
  death (`side.totalFainted` is never decremented). Read off the existing `revivesFainted` tag (`hpFraction`,
  `instaswitchIfActiveSlot`); no tag file moved. The revived body's own SwitchOut handlers on its instaswitch are not
  modelled and are counted (`MEDFAILS.reviveSwitchOutUnmodelled`). Knob `MEDI_REVIVE_UNMODELLED`.
- `tests/probe_regmc_revive.js` (`--regulation regmc`): BENCH (revived to the bench), NOW (revived in its slot with a
  slower foe still to move) and LAST (every foe already moved: the instaswitch lands after `|upkeep`). Exit 0 clean;
  exit 1 under the knob and on release `5c6df1a5e969` with the 0.40.0 engine bytes.

### Notes
- Pinned Reg M-C differential (`--games 1200`, census pin `f3b70bc0c47c`, pool `team-pool-frozen-regmc`): 13 of 953
  board-material on release `5c6df1a5e969` (0.40.0) → 7 of 954 on `2d5d6ec26e28`; the six revive games left, none
  joined, and all 12 revival requests are now mirrored from a revive this engine made. Reg M-B unmoved: its three files
  byte-identical, lattice `--games 1200` 0 of 961 (release `7335f5460a29`). Readings:
  `docs/_reports/2026-09-22-regmc-engine-3.md`. Nothing here is published.

## [0.40.0] — 2026-09-22

### Fixed
- **The differential's mega-slot choice no longer crosses games under Reg M-C.** `engine/game_differential.js` chose
  which slot megas, when both could, by a parity that flipped on every mega of the whole run and sat outside
  `driverSnap`, so a game's boards depended on the games played before it. Under any regulation but the artifact owner
  the choice is now a draw at the driver's own per-game address. Reg M-B keeps the parity byte for byte: its lattices
  ask the rule, so changing it there would re-deal published games. `GD_MEGA_SLOT_CARRIES=1` restores the parity;
  `GD_MEGA_SLOT_PER_GAME=1` measures the address under Reg M-B. The rule and how often it was asked are printed and
  stamped (`mega.slot_rule`, `mega.both_slots_offered`). Guard: `tests/test-driver-per-game.js`.
- **A revival request is answered, so a revive is compared instead of thrown.** `mirrorRevival` answers the slots
  whose request entry carries Showdown's own `reviving` flag: with the body medicham2 revived when it revived one,
  otherwise with the authority's own default (the first fainted body in party order), and drops the pivot body
  medicham2 queued for that slot. Counted and stamped as `revival_requests`. `GD_REVIVE_UNANSWERED=1` restores the old
  road. Guard: `tests/test-revive-mirror.js`.
- **Seventeen Reg M-C census rows re-staged to derive from the selected regulation.** Each typed a Reg M-B stat,
  damage number, free pick, key spelling or authority line. They now read the number from the build or from the
  authority on the run (new `tests/census_authority.js`: the selected checkout, the engine body's stats copied
  across), or search for the first candidate whose control arm stages the mechanic, starting with the historical
  fixture. The Spicy Spray announcement row is registered only when the selected authority writes the line. The Taunt
  row reads a move's category from the `statusCategory` tag instead of a zero `bp`.
- **The roster stages the selected regulation.** `tests/roster.js` read Reg M-B's tag file out of every release and
  read descriptions the Reg M-C checkout does not attach (and writes "1.5×" for "1.5x"). It now reads the selected tag
  file, and a view of the dex supplies the checkout's own text table to its rules without touching the shared dex.
- **An artifact stamped with another regulation's release is not STRANDED.** `tests/test-artifact-rerunnable.js` opened
  every release under the default regulation, and `open()` refuses a release cut for another one, so the first
  committed Reg M-C roster artifacts read STRANDED and the commit hook refused them. Such a release is now VERIFIED
  (content intact) and banded ANOTHER-REGULATION with the regulation named; a modified one is still STRANDED.

### Added
- `tests/probe_regmc_changed_pp.js`: every move legal in both regulations whose PP changed, derived from both dexes,
  run out of PP in a real game against the authority.
- `fixture_legality` in every roster artifact: each built set judged by the selected format's TeamValidator.
  `engine/quarantine.js` fails a roster stage on a NOT-baselined refusal or on a block saying nothing was judged; an
  artifact without the field (every Reg M-B roster artifact) is unaffected. Three selftest arms.
- The Reg M-C roster artifacts (`data/roster.{items,abilities,moves}-regmc.json`, release `fa68d953e73f`) and the
  census pin `data/verification/census-pin-regmc-f3b70bc0c47c.json`.

### Notes
- Reg M-B unmoved: its census rows are identical apart from the sampled `formatSecondaryChance` row, which moves by
  the same amount between any two runs; its lattice at `--games 1200` reads 0 of 961 with the same state, mega and
  first-divergence blocks as the published artifact; `engine/quarantine.js` with no flag prints the same output as
  HEAD's copy on the same tree. Readings: `docs/_reports/2026-09-22-regmc-instruments.md`. Nothing here is published.

## [0.36.0] — 2026-09-22

### Fixed
- **White Herb is spent on the move that ends the battle, in Reg M-C.** The two checkouts differ here. Reg M-C's
  whiteherb restores inside `useMove` (`onAnyAfterMove() { this.effect.onStart.call(...) }`), before `runAction`'s
  `faintMessages()` ends the battle (M-C checkout `sim/battle.ts` :2832-2833); Reg M-B's QUEUES it
  (`insertChoice({ event: "WhiteHerb", order: 99 })`), which never runs after the battle has ended. This engine spent
  it in `_updateAll`, which both `sideWiped` break sites skip, so a Close Combat that knocked out the last foe left its
  user holding the herb at -1/-1 under Reg M-C. `engine/tag_dex.js` now writes `restoresStats.afterMoveImmediate` for
  the M-C shape only (Reg M-B's row derives byte-identically; the M-C row was spliced), and `herbAtWin` runs the herb's
  reader at the two breaks for a holder whose tag says so. Knob `MEDI_HERB_SKIPPED_AT_WIN`.
- `tests/probe_regmc_white_herb_at_win.js` (`--regulation regmc`): a three-turn wipe whose last knockout is the herb
  holder's self-dropping hit, and a no-item control. Exit 0 clean; exit 1 under the knob and on the 0.35.0 release and
  bytes.

### Notes
- The first cut ran the herb for every holder, and the Reg M-B lattice parted on four games the other way (the
  authority kept the herb). That is how the two checkouts' handlers were found to differ; the tag now carries it.

## [0.35.0] — 2026-09-22

### Fixed
- **Steely Spirit boosts its holder's and its partner's Steel moves.** `onAllyBasePower` (M-C checkout
  `data/abilities.ts` steelyspirit: `if (move.type === 'Steel') return this.chainModify(1.5)`) is collected over the
  attacker's `alliesAndSelf()` (`sim/battle.ts` :1056-1057). Two defects: the tag's multiplier parse stopped at the
  decimal point (`mult: 1`), and the engine had no consumer for `allyBasePowerBoost` at all. `engine/tag_dex.js` now
  reads a decimal or `[n, 4096]` multiplier, whether the holder's own move counts (`includesSelf`: Battery and Power
  Spot exclude it) and a category gate; only the Steely Spirit row was spliced into `data/tags-regmc.json` (Reg M-B has
  no carrier and its tag file does not move). `engine/medicham2-browser.js` adds the member to the base-power chain for
  the attacker's own ability and for its active partner (`hit.attPartner`, told at the hit site like Friend Guard).
  Knob `MEDI_ALLY_BP_BOOST_INERT`.
- `tests/probe_regmc_steely_spirit.js` (`--regulation regmc`): Perrserker's Iron Head with and without the ability, and
  a partner's Iron Head beside it with and without. Exit 0 clean; exit 1 under the knob and on the 0.34.0 release and
  bytes.

## [0.34.0] — 2026-09-22

### Fixed
- **The Leek is two crit stages, and only for Farfetch'd and Sirfetch'd.** M-C checkout `data/items.ts` leek:
  `if (["farfetchd", "sirfetchd"].includes(this.toID(user.baseSpecies.baseSpecies))) return critRatio + 2;`. The item
  crit tag gave every `onModifyCritRatio` item `critRatio: 2` (one stage, Scope Lens's `+ 1`), so a Sirfetch'd's Leek
  was one stage short and any other holder was one stage long. `engine/tag_dex.js` now reads the increment and the
  species lock off the handler (`critRatio` = 1 + stage, `onlySpecies` = the base-species ids; a lock it cannot read is
  marked `lockUnparsed` and refused downstream). Scope Lens derives the identical row it always had, so Reg M-B's tag
  file does not move; only the Leek row was spliced into `data/tags-regmc.json` (a structural diff of the regenerated
  file showed no other rule change). `engine/medicham2-browser.js` reads the lock against the key's base segment
  (0.33.0's fix). Knob `MEDI_CRIT_ITEM_ONE_STAGE`.
- `tests/probe_regmc_leek.js` (`--regulation regmc`, the middle arm): Farfetch'd @ Leek's Night Slash crits five of
  five; an unlocked holder and a no-item control agree with the authority roll for roll. Exit 0 clean; exit 1 under the
  knob and on the 0.33.0 release and bytes. `tests/regmc_probe_kit.js`'s `play` takes an optional arm.

## [0.33.0] — 2026-09-22

### Fixed
- **A species whose base name carries punctuation is keyed as one base, and U+2019 folds like `'`.** Two defects on one
  shape. (1) `build/build_engine_data_regmc.js` collapsed every non-alphanumeric run of the display name to a hyphen,
  and the engine reads a key's segment before its first hyphen as the base species (the `statMult.onlySpecies` lock), so
  `Sirfetch’d`, `Farfetch’d`, `Mr. Rime`, `Mr. Mime` and `Kommo-o` were keyed `sirfetch-d`, `farfetch-d`, `mr-rime`,
  `mr-mime`, `kommo-o`, as if each had a forme. The base part is now the base species' id and only the forme tail keeps
  the hyphen rule; every legal species is scanned for the shape on every build (5 found), a name that is neither
  `<base>` nor `<base>-<forme>` refuses the build, and the regenerated table differs from the old one by those five
  renames and nothing else. `ABRA_REGMC_KEY_WHOLE_NAME=1` restores the old rule. (2) The M-C checkout spells the two
  Farfetch'd names with U+2019 (`data/pokedex.ts`), and `traceCanon` folded only the ASCII apostrophe, so the first
  `|switch|` of every game that brought one parted on a spelling. Knob `MEDI_CANON_KEEPS_TYPO_APOSTROPHE`.
- `tests/probe_regmc_species_key.js` (`--regulation regmc`): every table key's base segment is its species' base id, and
  every legal punctuated species walks in with identical reduced `|switch|` lines and identical boards. Exit 0 clean;
  exit 1 under the knob and on the 0.32.0 release and engine bytes.

### Notes
- The five hidden games now show their real first causes: four are a critical hit the authority rolls and this engine
  does not (Leek), one is narration. The board-material count did not move on this commit; the report says why.

## [0.32.1] — 2026-09-22

### Added
- Step 14 of `docs/REGULATION-ROTATION.md`, *Downstream consumers*. CHOMP reads ABRA's usage model keyed
  by its own old-regulation species table, and some ABRA builders still read CHOMP files. The step gives
  the command that prints the live list. Will deferred the CHOMP update ("chomp update will come later"),
  so `data/meta-usage.json` stays Reg M-B's until he says otherwise.

### Notes
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.32.0] — 2026-09-22

### Fixed
- **White Herb is spent before an Eject Button or Red Card switch, not after it.** The herb restores from
  `onAnyAfterMove`, and `AfterMove` is raised inside `useMove`, before `runAction`'s tail does the drags and the owed
  switches (M-C checkout `sim/battle.ts` :2820-2907). This engine spent it at its post-action pass, after the
  replacement had walked in, so a switch-in Intimidate's drop was cleared together with the move's self-drop. The
  herb (`restoreStatsAll`, its one reader) now runs before those two M-C-only doors when either is owed; every other
  road keeps its post-action pass. Knob `MEDI_HERB_AFTER_OWED_SWITCH`.
- `tests/probe_regmc_white_herb_before_switch.js` (`--regulation regmc`): a self-dropping hit into an Eject Button
  holder whose replacement has Intimidate, and a control with no Eject Button. Exit 0 clean; exit 1 under the knob and
  on the 0.31.0 engine bytes.

### Notes
- Two more pinned games end with the authority spending a White Herb on the battle's last move and this engine not
  (the engine ends the battle before its post-action pass). A hypothesis, not probed: a side wiped by one move cannot
  be staged in the four-body harness in one turn. Recorded.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.31.0] — 2026-09-22

### Added
- **Normal Gem.** Item tag `typeGem {type, mod, volatile, skipsSelfTarget, skipsStatus}` (`engine/tag_dex.js`), derived
  from the item's `onSourceTryPrimaryHit` and the `gem` condition's `onBasePower`. Membership, whole item dex, both
  checkouts: all 18 gems match; the only legal one is Normal Gem in Reg M-C; none is legal in Reg M-B. Spliced into
  `data/tags-regmc.json`: the Normal Gem row and the descriptor.
- The engine spends the gem on the first row of a damaging use of its type that reaches the damage step (the
  authority's TryPrimaryHit), writes `-enditem ... [from] gem|[move] <Move>`, records the use (Unburden, Symbiosis), and
  multiplies that use's base power by the tag's `[5325, 4096]`, last in the base-power relay (`onBasePowerPriority:
  14`). Knob `MEDI_TYPE_GEM_INERT`.
- `tests/probe_regmc_type_gem.js` (`--regulation regmc`): a Normal move spends the gem and hits harder, an off-type
  move keeps it, and a no-item control. Exit 0 clean; exit 1 under the knob and on the 0.30.0 engine bytes.

### Notes
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.30.0] — 2026-09-22

### Fixed
- **Binding Band deepens its holder's partial trap to a sixth.** `partiallytrapped.onStart` sets `boundDivisor =
  source.hasItem("bindingband") ? 6 : 8` (M-C checkout, read from the dist dex), and the `partialTrap` tag has carried
  that as `chipItem` (and Grip Claw's eight turns as `durationItem`) since the trap was derived; nothing read either, so
  a holder chipped an eighth. The trap now reads the trapper's item when it lands and keeps the divisor as a divisor, so
  the tick is `floor(maxhp / 6)`. Both items are `Past` in Reg M-B. Knob `MEDI_TRAP_CHIP_ITEM_BLIND`.
- `tests/probe_regmc_binding_band.js` (`--regulation regmc`): a holder's Infestation chips a sixth at two residuals, and
  the no-item control an eighth. Exit 0 clean; exit 1 under the knob and on the 0.29.0 engine bytes.

### Notes
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.29.0] — 2026-09-22

### Fixed
- **Terrain Extender makes its holder's terrain last eight turns.** Every terrain condition in the M-C checkout answers
  `durationCallback(source) { if (source?.hasItem('terrainextender')) return 8; return 5; }`, and both terrain
  writers in `engine/medicham2-browser.js` (the move and the Surge ability on entry) wrote a literal 5. `terrainTurns`
  reads the setter's item's `extendsDuration` tag, as `weatherTurns` does for the rocks; nothing about 8 is typed.
  Terrain Extender is `Past` in Reg M-B, so no Reg M-B item names a terrain. Knob `MEDI_TERRAIN_FIVE_ALWAYS`.
- `tests/probe_regmc_terrain_extender.js` (`--regulation regmc`): a terrain move and a Surge ability, each from a holder,
  and a control with no item; the terrain clock is a compared board leaf. Exit 0 clean; exit 1 under the knob and on
  the 0.28.0 engine bytes.

### Notes
- The move road's `-fieldstart` carries `[of] <user>` here and nothing on the authority; the differential's reducer
  folds it (narration, recorded).
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.28.0] — 2026-09-22

### Fixed
- **Revival Blessing fails when nobody has fainted.** Its `selfSwitch` only raises the switch request that names a
  fainted body (the move's own comment, M-C checkout `data/moves.ts` :15126-15129), and `onTryHit` fails the move when
  the user's party holds no fainted body. This engine read the `selfSwitch` as a status pivot and switched a live bench
  body in. New move tag `revivesFainted {slotCondition, failsWithoutFainted, hpFraction, instaswitchIfActiveSlot}`
  (`engine/tag_dex.js`), the shape read off the move and the fraction off `Battle.prototype.runAction`; `pivotStatus`
  no longer claims it. Membership, whole dex, both checkouts: Revival Blessing only; legal in Reg M-C, `Past` in Reg
  M-B. The engine fails the move (`-fail|USER`, nobody switches) when the user's roster holds no fainted body. Knob
  `MEDI_REVIVE_AS_PIVOT`.
- `tests/probe_regmc_revival_blessing.js` (`--regulation regmc`): the move with no fainted ally fails and the user
  stays. Exit 0 clean; exit 1 under the knob and on the 0.27.0 engine bytes.

### Notes
- **The revive itself is not modelled** (a fainted body exists): it is counted (`MEDFAILS.reviveUnmodelled`) and still
  pivots. The differential's forced-switch mirror answers a switch request with a LIVE bench body, so it cannot express
  a revival request, and the seven pinned choices the authority refused ("You have to pass to a fainted Pokémon") are
  that. Filed for MEASURE; the engine half waits for an instrument that can show it right.
- `data/tags-regmc.json`: the Revival Blessing row and the two descriptors (spliced). Reg M-B's tag file has no member.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.27.0] — 2026-09-22

### Fixed
- **Octolock drops Defence and Sp. Def every turn until its source is gone.** The per-turn-boost residual read every
  member's `_vol` entry as a clock; Octolock declares no duration, so its bare 1 ran out and the lock ENDED at its first
  residual, where the authority drops two stages. `perTurnBoost` (`engine/tag_dex.js`) now also carries, read off the
  condition, `residualSourceEnd {clauses, endArgs}` (the source-gone test at the top of Octolock's own `onResidual`)
  and `trapsWhileSourceActive` (`onTrapPokemon`). A member with no duration and a residual source end is ticked
  without a clock and ended at the residual by the partial trap's three clauses (`sourceOffField`, `_newlySwitched`),
  writing `-end ... [partiallytrapped]|[silent]`; the `onUpdate` sweep leaves it alone. `switchTrapVerdict` refuses a
  switch while its source is active (counted, `MEDSEEN.volTrapBlocked`; the staged harness cannot offer a switch the
  authority refuses, so that half is not probed). Syrup Bomb's row is unchanged. Knob `MEDI_PERTURN_BOOST_CLOCK_ALWAYS`.
- `engine/board_state.js` compares `vol.octolock` (presence). `tests/probe_uncompared_leaves.js --regulation regmc`
  now lists no uncompared leaf that can stand at a turn boundary.
- `tests/probe_regmc_octolock.js` (`--regulation regmc`): three residual drops while locked; two, then a silent end,
  when the user switches out. Exit 0 clean; exit 1 under the knob and on the 0.26.0 engine bytes.

### Notes
- The authority writes `[of] <source>` on Octolock's `-start` and this engine does not; the differential's reducer
  folds that field (narration). Recorded, not fixed.
- `data/tags-regmc.json`: only the Octolock row changed (spliced). Reg M-B's `data/tags.json` has no member with
  either new field.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.26.0] — 2026-09-22

### Added
- **Glaive Rush leaves its user exposed.** Move tag `exposesUser {volatile, damageTakenMult, alwaysHitBy,
  endsBeforeOwnMove, silentStart}` (`engine/tag_dex.js`), derived from the condition of the move's own
  `self.volatileStatus`: an `onSourceModifyDamage` that `chainModify`s the damage its holder takes, an `onAccuracy`
  that returns true, an `onBeforeMove` that removes it. Membership, whole dex, both checkouts: Glaive Rush only; legal
  in Reg M-C, `Past` in Reg M-B. `data/tags-regmc.json` carries the descriptor and the Glaive Rush row (spliced; no
  other row moved).
- The engine arms the volatile at the self-drop step when the move reached a target, doubles every damage calc into
  the holder, makes every move into it hit, and drops it at the top of the holder's own BeforeMove gate (priority 100,
  above recharge). Knob `MEDI_SELF_EXPOSED_INERT`.
- `engine/board_state.js` compares `vol.glaiverush` (presence), which stands across the turn boundary. It was listed
  by `tests/probe_uncompared_leaves.js` as written and uncompared; it no longer is. No Reg M-B move writes it.
- `tests/probe_regmc_glaive_rush.js` (`--regulation regmc`): an exposed user takes a doubled hit from a slower foe on
  the same turn and a normal one after it moves again; a control with a plain contact move. Exit 0 clean; exit 1 under
  the knob and on the 0.25.0 engine bytes.

### Notes
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.25.0] — 2026-09-22

### Fixed
- **Aura Guard halves contact damage.** The `damageReduce` reader in `engine/medicham2-browser.js` had no branch for
  `onlyWhen: 'contact'`, so the condition was refused as unknown (`MEDFAILS.damageReduceUnknown`) and the cut was never
  applied: every contact hit into Lucario-Mega-Z did double damage here. The reader now asks the per-use contact fact
  (`mvMakesContact(id, att, use)`), which is what the authority's handler reads (`move.flags['contact']` on the active
  move, after Long Reach). The ability is `breakable`, and Mold Breaker already removes it from `defAb`. Knob
  `MEDI_DAMAGE_REDUCE_CONTACT_UNKNOWN`.
- `tests/probe_regmc_aura_guard.js` (`--regulation regmc`): a contact hit, a non-contact hit and a Mold Breaker contact
  hit into the mega holder. Exit 0 clean; exit 1 under the knob and on the 0.24.0 engine bytes.

### Notes
- **The "Aura Guard card that only parts after earlier games" is not engine state.** Replayed in a fresh process with
  the driver's coverage counters restored, the Lucario game reproduces line for line. A second game that did NOT
  reproduce parts at the driver's mega choice: `MEGA_PREFER_B` in `engine/game_differential.js` alternates across
  games and is not in `driverSnap`, so whether the Lucario megas into the Aura Guard forme depends on the games before
  it. The instrument's, filed for MEASURE; see the report.
- No Reg M-B tag carries a contact-only `damageReduce`, so the new branch cannot run under Reg M-B.
- Reg M-B unmoved: the three Reg M-B files byte-identical; damage differential identical but for its output-path
  line; lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.
## [0.24.0] — 2026-09-22

### Added
- **The move-effects rulebook is per-regulation.** `data/move-effects.js` (a move's secondaries, certain boosts and
  accuracy, read by `moveFxTable` in `engine/medicham2-browser.js`) joins the per-regulation map
  (`engine/regulation.js` `REG_FILE_KEYS` `moveEffects`; `runtime.regmc.moveEffects` in `data/regulations.json`). Reg
  M-C reads `data/move-effects-regmc.js`, built by `node build/build_browser_data.js --regulation regmc` from the Reg
  M-C checkout: 515 legal moves, against Reg M-B's 500. An M-C release freezes it (`engine/engine_release.js`
  `REGULATION_SOURCES`). Knob `MEDI_MOVE_EFFECTS_OWNER_TABLE` reads Reg M-B's file by its bytes, around the resolver.
- `tests/probe_regmc_move_effects.js` (`--regulation regmc`): a 100% secondary stat drop and a certain self-boost, each
  from a move Reg M-B's table has no row for, chosen from the dex; and a row for every legal move. Exit 0 clean; exit 1
  under the knob and on the 0.22.0 engine bytes.

### Changed
- `build/build_browser_data.js` writes each output where the selected regulation reads it, and SKIPS
  `data/mega-formes.js` (printed) under a regulation that has no copy of its own, so a Reg M-C run cannot overwrite
  Reg M-B's file.
- `tests/test-regulation-table.js` expects the move-effects copy in an M-C cut; `tests/test-regulation-artifacts.js`
  drops it from `NOT_YET`.
- `.gitattributes` pins `data/move-effects-regmc.js` to LF, like its Reg M-B twin: it is frozen into every M-C release,
  and an unpinned LF file is rewritten CRLF by a checkout, which moves the release id with no code change.

### Notes
- The Reg M-C table differs from Reg M-B's on the 15 new moves and on one shared row: Curse carries no `volatile` in
  the Reg M-C checkout.
- Reg M-B unmoved: `data/tags.json`, `data/protocol-events.json` and `data/move-effects.js` byte-identical; damage
  differential identical but for its output-path line (control seed differs); lattice at `--games 1200` 0 of 961.
- Pinned Reg M-C readings are in `docs/_reports/2026-09-22-regmc-engine.md` and are not published. **Supersedes.**
  Nothing. **Basis.** unchanged.

## [0.23.1] — 2026-09-21

### Added
- A row in `docs/REGULATION-ROTATION.md`: `engine/status.js --write` stamps the default regulation's
  live gate into every ledger, and the default is still the closed Reg M-B. A restamp after today's
  Reg M-C engine fixes would have written the Reg M-B gate as CLOSED and raised the `mtime_only`
  provenance ratchet. The restamp was reverted and not committed.

### Notes
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.23.0] — 2026-09-21

### Added
- **Reg M-C's usage model, the file CHOMP reads.** `node engine/analyze.js --regulation regmc` writes
  `data/meta-usage-regmc.json` through the new `engine/usage_regulation.js`, in the shape CHOMP already reads
  (top-level `threats`, `views.competitive`, `views.ladder`). It is counted over the LIVE Reg M-C stores (the tracked
  `.jsonl.gz`, never a plain local copy), with the frozen pool's own predicate and then the shared quality filter,
  and stamps both store digests as `source_digests`. New: per-species `sets` (the items, abilities and moves the open
  sheets declared) and a `legality` block auditing every species, item, ability and move in the corpus against the
  Reg M-C format and `TeamValidator`. An absent store refuses and writes nothing.
- `engine/regmc_pool_predicate.js` — the pool's scope and Eject Button conjunction as one module, read by
  `engine/cut_regmc_pool.js` and the usage model. `engine/usage_table.js` — the usage table itself, lifted verbatim
  out of `engine/analyze.js` so every regulation's file is counted by one function.
- `engine/durable-ingest.js storeFormatFor()` — the store token for any regulation entry; `activeStoreFormat()` is it
  applied to `active`.

### Changed
- `meta-usage.json` is declared per regulation in `engine/regulation.js`. Under Reg M-C the differential's severity
  ranking now reads Reg M-C usage; it read Reg M-B's. `tests/test-regulation-artifacts.js` drops it from NOT YET and
  probes the seam's refusal with another undeclared Reg M-B file.

### Fixed
- `engine/analyze.js` read `process.argv[2]` as its store, so an explicit `--regulation` became the store path. It now
  reads the first positional argument.

### Notes
- Reg M-B unmoved: `data/meta-usage.json` untouched, and HEAD's `analyze.js` and this one write byte-identical models
  on the same Reg M-B store. The cutter's dry run is identical with the predicate moved. Nothing is published from the
  Reg M-C model. Full account: `docs/_reports/2026-09-22-regmc-usage.md`.
## [0.22.0] — 2026-09-21

### Added
- **Emergency Exit.** Ability tag `switchesOutAtHalf` (`engine/tag_dex.js`), derived from `onEmergencyExit`; its members
  are Emergency Exit and Wimp Out, and the only legal carrier in Reg M-C is Golisopod (none in Reg M-B).
  `clearsOtherSwitches` is read off the handler the format resolves: `false` under the Champions override in the M-C
  checkout, so a pivot into the holder switches too; `true` under mainline.
- The engine asks at the two move doors: a target the move took from above half to at or below it (after the
  `AfterMoveSecondary` event, not under a Sheer Force-boosted move), and the attacker after its own recoil, punishes and
  Life Orb. The switch is one of the end-of-action switches beside an Eject Button's and a pivot's. Knobs
  `MEDI_EMERGENCY_EXIT_INERT` and `MEDI_EMERGENCY_EXIT_MAINLINE`.
- `tests/probe_regmc_emergency_exit.js` (`--regulation regmc`): a crossing hit (announce, switch), a hit that stays
  above half (nothing), a U-turn that crosses (both switch). Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Changed
- `tests/regmc_probe_kit.js` pins its census stub only while the regulation has no census of its own; Reg M-C has one
  since 0.19.0.

### Fixed
- **Two pinned Reg M-C games threw** (`Cannot read properties of null (reading 'secondary')`) once the Eject Button pass
  changed what they played: the statusInflict volatile read assumed every move has a row in `data/move-effects.js`, and
  that table is not per-regulation. Guarded and counted (`MEDFAILS.moveFxMissing`). The missing rows themselves are a
  finding for the next pass: 15 legal Reg M-C moves have none, so their secondaries are not modelled.

### Notes
- Counted, not modelled: the residual and hazard doors (`MEDFAILS.emergencyExitOtherDoorUnmodelled`). An attacker's
  crossing on its recoil is announced after the target-side events rather than above them (narration).
- The Double Shock `-fail` field, the Inner Focus stat name and the fallen counter were classified, not fixed: all
  three are narration by the differential's own board comparison. See the report.
- Reg M-B unmoved: tags and protocol-events byte-identical; the damage differential identical but for its output-path
  line; the Reg M-B lattice at `--games 1200` reads 0 board-material.
- Pinned Reg M-C readings are in the report and are not published. **Supersedes.** Nothing. **Basis.** unchanged.

## [0.21.0] — 2026-09-21

### Added
- **Red Card and Eject Button.** Item tags `dragsAttackerOnHit` and `ejectsHolderOnHit` (`engine/tag_dex.js`), derived
  from each item's `onAfterMoveSecondary`; the members are Red Card and Eject Button, both legal in Reg M-C and neither in
  Reg M-B. `ejectsHolderOnHit.cancelsSourceSwitch` is read off the handler the format resolves: `false` under the Reg M-C
  checkout (Showdown `aa6d5f0856`), `true` under the mainline one.
- The engine spends Eject Button first on the event (priority 2), then Red Card; at the end of the action the Red Card
  attacker is dragged (a random bench body), then every Eject Button holder switches out, beside a pivot the button did
  not cancel, the faster leaver first. A Red Card drag cancels the attacker's own pivot. Knobs `MEDI_RED_CARD_INERT`,
  `MEDI_EJECT_BUTTON_INERT`, `MEDI_EJECT_BUTTON_MAINLINE`.
- `tests/probe_regmc_eject_items.js` (`--regulation regmc`): Red Card, Red Card into U-turn, Eject Button, Eject Button
  into U-turn (both switch), one spread hit into both items. Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Notes
- Counted, not modelled: a speed tie between two owed switches (the authority breaks it with a die), and a Red Card
  drag refused by Ingrain.
- Reg M-B unmoved: tags and protocol-events byte-identical; the damage differential identical but for its output-path
  line; the Reg M-B lattice at `--games 1200` reads 0 board-material.
- The Reg M-C smoke is unpinned and is not published. Full account: `docs/_reports/2026-09-21-regmc-items.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.20.0] — 2026-09-21

### Added
- **Air Balloon.** Item tag `poppedOnHit` (`engine/tag_dex.js`), derived from the handlers: an item whose `onStart`
  announces it and whose `onDamagingHit` writes `-enditem` and empties the hand. Its one member is Air Balloon, legal in
  Reg M-C and not in Reg M-B. The engine announces it on entry (lead wave, refill, single switch) after the holder's own
  ability, silenced by Gravity, and pops it on the first damaging hit, after the holder's ability handlers and before
  the attacker's; the pop is a loss (no `lastItem`) that still wakes Unburden and Symbiosis. The ground immunity was
  already `isGrounded`'s last clause. Knobs `MEDI_AIR_BALLOON_SILENT` and `MEDI_AIR_BALLOON_UNPOPPED`.
- `tests/probe_regmc_air_balloon.js` (`--regulation regmc`): lead (announce, Ground refused, popped, Ground lands),
  no-item control, mid-game switch-in, two-arrival volley. Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Notes
- The announcement is narration (under `MEDI_AIR_BALLOON_SILENT` the boards stay identical); the pop is board-material.
- Counted, not modelled: a balloon given mid-battle, a hit a doll absorbed, an announcement in the slot of an ability
  whose switch-in priority is not 0.
- Reg M-B unmoved: tags and protocol-events byte-identical; the damage differential identical but for its output-path
  line; the Reg M-B lattice at `--games 1200` reads 0 board-material.
- The Reg M-C smoke is unpinned and is not published. Full account: `docs/_reports/2026-09-21-regmc-items.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.19.0] — 2026-09-21

### Added
- **Reg M-C has its own census.** `tests/test-mechanics.js --regulation regmc` writes
  `data/mechanics-census-regmc.json` through the artifact seam, and it is pinned as
  `data/verification/census-pin-regmc-98c69a4fee7f.json`. The `regmc-` infix keeps a Reg M-C pin from being
  read as a Reg M-B one. A steered Reg M-C differential can now run pinned.
- **The seeds get census rows, for Reg M-C only.** Three rows: a terrain seed spent on entry, one spent the
  moment its terrain starts, and the Grassy heal skipping a semi-invulnerable body. Each is derived from the
  tags and the format and each goes MISSING under its knob. They register only when the selected tag file
  carries a legal seed (the seed rows) or the regulation is not Reg M-B (the Grassy row). So Reg M-B's
  census does not move.
- `engine/regulation_stores.js`: which human games a steering input is counted from. Reg M-B keeps its own
  stores. Any other regulation reads its frozen pool, checked by size and sha256 against the pool receipt,
  and REFUSES by name on an absent or altered file.
- `tests/test-regulation-steering.js` (29 checks): Reg M-B selects its literal stores; Reg M-C maps its
  behaviour table and censuses; in a sandbox the four builders count a synthetic pool and leave Reg M-B's
  files byte-identical; an absent or altered pool file refuses. Shown red on six deliberate breaks.

### Changed
- **The steering inputs follow the regulation.** `engine/click_counts.js`, `engine/sheet_usage.js`,
  `engine/policy.js` (the behaviour clone) and `engine/rollout_switch_census.js` read the selected
  regulation's pool (and its raw-log shards) under any regulation but Reg M-B. The behaviour table is a
  per-regulation engine file (`runtime.regmc.movePriors` → `data/move-priors-regmc.json`), and a Reg M-C
  release freezes it. `data/rollout-switch-census.json`, `data/joint-click-census.json` and
  `data/move-priors.observed.json` are declared per-regulation.
- `engine/game_differential.js` prints the file the seam wrote, and stamps the behaviour table and the
  switch census under the names and digests of the files it actually read.
- `engine/joint_click_census.js` refuses under a non-owner regulation. Its stores are still Reg M-B's by name.
- `tests/test-regulation-artifacts.js`: the three steering inputs leave NOT_YET. A new check fails a NOT_YET
  entry that already follows the regulation.

### Notes
- Reg M-B is unmoved. Its census rows, click counts and sheet usage are identical to what HEAD's code
  produces. No tracked Reg M-B artifact changed. `node engine/quarantine.js` differs from HEAD in one line:
  the size of its artifact inventory, which counts every file in `data/` and so counts the new Reg M-C
  files. Every clause is identical. A regulation-aware inventory is owed.
- `engine/policy.js` and `engine/rollout_switch_census.js` stamp `by` into what they write under a
  non-owner regulation. A file written through the seam has no literal writer for `engine/provenance.js`
  to find.
- The first pinned Reg M-C differential (`--games 1200`, release `2d3d1f48b940`, cut in a worktree) is a
  reading, not a published figure or a gate verdict. Full account: `docs/_reports/2026-09-21-regmc-census.md`.
- Version 0.19.0 was taken because ENGINE is working on items in parallel and may take 0.18.0.

## [0.18.0] — 2026-09-21

### Added
- **Rocky Helmet.** Item tag `punishesAttackerItem` (`engine/tag_dex.js`), derived from the handler: an item whose
  `onDamagingHit` damages the attacker by a fraction of its own max HP behind the contact check. Its one member is
  Rocky Helmet, legal in Reg M-C and not in Reg M-B. The engine pays the toll once per landed arrival, after an
  order-1 ability punisher (Rough Skin) and before an undeclared one, not behind a doll, not through Magic Guard,
  and still on the blow that knocks the holder out. Knobs `MEDI_ROCKY_HELMET_INERT` and `MEDI_ROCKY_HELMET_ONCE`.
- `tests/probe_regmc_rocky_helmet.js` (`--regulation regmc`): five staged arms (contact, non-contact control,
  Rough Skin order, a two-arrival volley, the holder knocked out). Exit 0 clean, 1 under each knob and on the
  pre-fix engine.
- `tests/regmc_probe_kit.js`, the shared scaffolding of the Reg M-C staged probes.

### Fixed
- **Every Reg M-C staged probe died at load after 0.17.0**, the 0.16.0 seeds probe included: the steering needs a census,
  and under Reg M-C it now reads `data/mechanics-census-regmc.json`, which does not exist yet. A scripted probe now pins a
  declared one-row stub outside `data/` (`scriptedCensusPin`); its games never consult the census.

### Notes
- Reg M-B unmoved: `data/tags.json` and `data/protocol-events.json` byte-identical; the damage differential
  (`--n 6000 --seed 20260804`) identical but for its own output-path line, with a control seed that differs; the
  Reg M-B lattice at `--games 1200` reads 0 board-material.
- The Reg M-C smoke is unpinned and is not published. Full account: `docs/_reports/2026-09-21-regmc-items.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.17.0] — 2026-09-21

### Added
- **The MEDICHAM gate answers per regulation.** `node engine/quarantine.js --regulation regmc` evaluates
  the same ten clauses against Reg M-C's own artifacts, pool and releases, and names the regulation on its
  first line. A missing Reg M-C artifact reads NO ARTIFACT or CANNOT-ANSWER; it never falls back to Reg M-B's.
- `engine/regulation.js` gains `artifactFor` and an fs seam: under any regulation but Reg M-B, every
  artifact the gate reads or its instruments write (`PER_REGULATION_ARTIFACTS`) is read and written as a
  `-<id>` sibling, and a write onto any other existing file under `data/` is refused. Nothing is installed
  under Reg M-B.
- `engine/lattice_walk.js` — the 2026-09-12 lattice walk made repeatable. Reg M-C's lattice is
  **1200 / 1600 / 1900**, derived on its own pool; the same rule reproduces Reg M-B's 1950.
- `tests/test-regulation-artifacts.js` — the list against the gate's derived closure, the mapping both
  ways, and the seam in a throwaway root with a Reg M-B control. Shown red on three deliberate breaks.

### Changed
- The open-defect clause reads CANNOT-ANSWER when the register verdicts are absent. It used to pass on
  "0 verdicts read", which is how the first Reg M-C run passed it. Reg M-B has the file; its output is unchanged.

### Notes
- Reg M-B unmoved: its gate output is byte-identical apart from the new first line, and so are
  `--selftest`, `--graph`, `--whole-game`, `--narration` and `--order-probe`. No tracked Reg M-B artifact moved.
- No Reg M-C figure is published. Full account: `docs/_reports/2026-09-21-regmc-gate.md`.
- **Supersedes.** Nothing. **Basis.** unchanged.

## [0.16.0] — 2026-09-21

### Added
- **The terrain seeds.** Item tag `consumedOnTerrain` (`engine/tag_dex.js`), derived from each seed's
  `onTerrainChange`; its members are the four seeds, all legal in Reg M-C and none in Reg M-B. The engine
  spends a seed the instant its terrain starts (ability or move, every active holder in speed order) and on
  entry into a standing terrain, then boosts the holder and records the spent item. Knobs
  `MEDI_SEED_UNCONSUMED` and `MEDI_SEED_NO_TERRAIN_CHANGE`.
- `tests/probe_regmc_terrain_seeds.js` (`--regulation regmc`): six staged arms against the Reg M-C authority.
  Exit 0 clean, 1 under each knob and on the pre-fix engine.

### Fixed
- **Grassy Terrain healed a semi-invulnerable body.** The smoke card read as a heal ORDER; it is the missing
  `!isSemiInvulnerable()` half of the handler. Knob `MEDI_TERRAIN_HEAL_SEMIINV`. The mechanic is reachable in
  Reg M-B too. A census row for it was written, went live, and was WITHHELD: the census is Reg M-B's, and a
  new row moves a figure the closed Reg M-B line has published. That decision is the coordinator's.

### Notes
- Reg M-B unmoved: its tag and protocol-events files are untouched, the damage differential is identical,
  and the Reg M-B lattice at `--games 1200` reads 0 board-material.
- Smoke (unpinned, not published): board-material 43 → 16 of 86 on the same sample; the next cause is
  Rocky Helmet. Full account: `docs/_reports/2026-09-21-regmc-seeds.md`.
- **Supersedes.** Nothing published. **Basis.** unchanged.

## [0.15.1] — 2026-09-21

### Added
- `docs/REGULATION-ROTATION.md` gains a running section, *Found during the rebuild*, with seven traps
  hit on Reg M-B → M-C and what to do next time. Will asked for the rotation document to be updated
  continuously; each new trap gets a row in the same commit as its fix.

### Notes
- **Supersedes.** Nothing. No figure moves. **Basis.** unchanged.

## [0.15.0] — 2026-09-21

### Added
- `data/tags-regmc.json` and `data/protocol-events-regmc.json`. Both are derived from the Reg M-C checkout
  and selected by `runtime.regmc.tags` and `runtime.regmc.protocolEvents` in `data/regulations.json`,
  using the same sibling rule as the species table. Reg M-C usage is weighted by Reg M-C's own stores:
  212,856 sheet entries.
- The six Reg M-C mega stones now carry their mega tag. The first cause "mega forme did not evolve" fell
  from 8 games to 0.
- While Reg M-C is selected, a write onto Reg M-B's tag, protocol-events or species file is refused by
  name.
- `tests/test-regulation-table.js` rises from 18 to 24 clauses. They were shown failing on a deliberate
  break first.

### Fixed
- Under Reg M-C, the differential chose its teams by Reg M-B tag membership, through `engine/names.js`.
  That file now reads the selected regulation's tag file.
- Curse had no `typeSplitMove` tag under Reg M-C, because the Reg M-C checkout has no `nonGhostTarget`
  field. The tag is now read from the handler when the field is absent. Reg M-B is unchanged.
- **The pre-commit hook's staged audit copied whole directory trees into `%TEMP%`.**
  `engine/regulation.js` spells `'..', '..', '..', '..'`, and `engine/artifact_audit.js` read that as a
  sibling checkout called `..`. So every commit copied the Projects directory (from the main tree), or
  every agent worktree (from a worktree), into `%TEMP%`, and hung silently. A name made only of dots is no
  longer treated as a sibling.

### Notes
- **Terrain set on entry is closed.** It was the first cause of 45 of the 65 dumped games; after the
  change it is the first cause of none. Of those 45 games, 19 no longer diverge. Most of the rest now part
  on the terrain seeds, which have no tag and no engine code. The seeds are the next job, and it is
  engine work. A smoke reading: board-material fell from 65 of 77 to 45 of 85 on the same sample. Not
  published.
- Reg M-B unmoved: `data/tags.json` and `data/protocol-events.json` are byte-identical, and the damage
  differential is identical apart from the launcher's pid line.

## [0.14.0] — 2026-09-21

### Added
- **Selecting Reg M-C loads the Reg M-C species table everywhere**, live and inside a frozen release.
  135 files load the table; 70 needed no edit and 61 got one line.
- `tests/test-regulation-table.js` — 18 of 18, shown failing on a deliberate break first.

### Changed
- A frozen release carries the M-C table only when Reg M-C is selected; the same tree yields two release
  ids and a release refuses to open under the other regulation.

### Fixed
- `tests/test-mc-key.js`, which the coordinator shipped red in 0.13.0 — the new table files were never
  declared to it and the pre-commit hook does not run it.

### Notes
- **The first Reg M-C games play end to end: 87 of 87, none crashed.** 65 of 77 usable games part
  boards; **53 of those are terrain set on entry**, ~9 are mega formes that cannot evolve, 11 are
  leftovers. A smoke reading, not published.
- Reg M-B unmoved: damage differential byte-identical, lattice 0 of 961 before and after. No gate
  reading is claimed for this tree.

## [0.13.0] — 2026-09-21

### Added
- `data/engine-data-regmc.js` and its builder `build/build_engine_data_regmc.js` — MEDICHAM can build
  **all 382 legal Reg M-C species, including all 35 added ones**, in a table separate from Reg M-B's.
- `tests/test-engine-data-regmc.js` — every species through `buildMon`, 15 of 15, shown red on a broken
  table first.

### Fixed
- Under the test runner, a Reg M-C run announced the M-C checkout while reading Reg M-B's. The
  announcement now names the checkout that actually runs.

### Notes
- Reg M-B unmoved: damage differential byte-for-byte identical; `data/engine-data.js` not written.
- **Still not playable**: about fifty callers load the Reg M-B table by path, and adding the new one to
  frozen releases is MEASURE's call. Six M-C stones lack a mega tag.

## [0.12.0] — 2026-09-21

### Added
- **The regulation is selectable at RUN TIME.** `engine/regulation.js` is the one resolver:
  `--regulation <id>` on any script, then `ABRA_REGULATION=<id>`, then `data/regulations.json`
  `active`. `<id>` may be a key or a full Showdown format id. `champions_sim.FORMAT` reads it, so all
  **490 readings across 357 files** follow with no edit — the differential, the roster, the census and
  the staged battery included, because each resolves through `CS.FORMAT`.
- **Selecting a regulation selects its Showdown CHECKOUT.** `data/regulations.json` gains a `runtime`
  block carrying each regulation's checkout and pinned commit; `engine/showdown_path.js` tries the
  selected regulation's checkout first. An explicit `SHOWDOWN_PATH` still wins over everything.
  `showdown_path.js` also gained the git-worktree anchor, so a worktree can now find a sibling checkout
  at all.
- **`tests/test-regulation-runtime.js`** — 35 clauses, every varying clause paired with a cleared
  control. Shown RED at 17/35 on a deliberate one-line unwiring before being trusted.

### Changed
- **`PINNED_COMMIT` / `PINNED_DATE` are per regulation**, read from `data/regulations.json` `runtime`
  rather than being literals in `engine/champions_sim.js`. One constant cannot pin two authorities.
  Absent is reported as UNKNOWN by `verify().commit_matches`, never as a mismatch.
- **`verify()` reports `regulation`, `regulation_source` and `regulation_explicit`**, so an artifact
  that stamps it can say whether a caller NAMED a regulation or the config decided.
- **`engine/engine_release.js` SOURCES gains `engine/regulation.js`** (the sixth growth, and the second
  refused at the cut rather than found by a crash). Existing releases are untouched and nothing is
  stranded; every future release id changes, which is correct.

### Fixed
- **Nine inlined reads of `data/regulations.json`, each with its own silent fallback literal, are
  gone** — `analyze.js`, `chomp_ev.js`, `durable-ingest.js`, `fetch_smogon_stats.js`, `meta-ingest.js`,
  `smogon_priors.js`, `validate_damage_sim.js`, `sim/champions-battle.js`, `champions_sim.js`.
  Hardcoded regulation sites **26 → 19** — nine deleted, two created and both declared: the resolver's
  one surviving literal, and `tests/test-regulation-runtime.js`'s independent re-reading of the
  expression it replaced, which is the control that makes clause 1 mean anything.
- **`engine/durable-ingest.js` refuses an empty format list** (exit 2) instead of running clean over
  zero formats.
- **`engine/regulation.js` was unpinned in `.gitattributes`** — caught by `tests/test-engine-release.js`
  in the same pass it was written; an LF source with no pin moves the release id on a fresh checkout
  with no code change. 79/1 → **80/0**.

### Notes
- **THIS IS A REFACTOR AND NOTHING MOVED.** Damage differential `--n 6000 --seed 20260804`:
  byte-for-byte identical. Lattice `--games 1200 --team-store data/team-pool-frozen`, no `--regulation`
  on either arm: 35,980 bytes, **two lines differ** — the release id and the wall clock. All 10
  divergences, the pool digest `0d103fb9fa87` and the census digest are identical.
  **The 10 is a fingerprint, not a gate reading**: these runs omit `--steering empirical --arm middle
  --end-state` and answer a different question from `engine/quarantine.js`.
- **`regmc` is in `runtime` and deliberately NOT in `regulations`.** `engine/next_regulation.js` walks
  `regulations` to decide what is already known, so an entry there would tell the hourly collector that
  M-C is known and stop it collecting. Being selectable is not being active; `active` is still `regmb`.
- **NO REG M-C FIGURE IS PUBLISHED and none was measured.** MEDICHAM still cannot build an M-C team —
  `data/engine-data.js` has no row for any of the 35 added species. The flag is necessary and not
  sufficient. Full account: `docs/_reports/2026-09-21-regulation-runtime.md`.

## [0.11.0] — 2026-09-21

### Added
- Nine checks wired into `tests/run-all.js` that nothing ran before: three selftests and six game-free
  probes. 9 passed, 0 failed, ~36 s added.

### Changed
- Twenty-six files named `PENDING_WIRE` with a reason. **None was named `NOT_A_CHECK`** — each asserts a
  contract, and calling one otherwise would be the failure the clause catches.

### Notes
- **The UNACCOUNTED-FOR clause is closed: 35 → 0**, from 30 before this session plus five of our own.
- No check went red once it ran — the weaker result, not the better one.
- One real defect named and not fixed: a usage probe throws `ENOENT` on an absent store instead of
  exiting 2. Twenty ledger rows are owed to ENGINE.

## [0.10.0] — 2026-09-21

### Fixed
- `tests/test-knob-control-arm.js` — three probes that gained a seal line had their recorded knob
  verdicts invalidated by the edit. Re-measured; 81 of 81 green.
- `engine/provenance.js` — the release the current artifacts were measured on (`adb08f5360f1`) was
  gitignored while the living documents cited artifacts stamped with it, so the citation chain ended at
  a string. Tracked, and **the rule written into `.gitignore`**: a release is tracked when a published
  record or the current living-document citations rest on it; a working release is not.

### Notes
- **Full 184-check suite: 172 pass, 9 waived, 4 fail** — from 17 at the start of this session.
- Remaining: `engine/conformance.js` (10 findings, 5 waiting on the model rebuild), the UNACCOUNTED-FOR
  clause (35 files nothing runs and nothing names, 30 of them pre-existing), and `test-mag-page`.

## [0.9.0] — 2026-09-21

### Fixed
- **Three classes of roster fixture never reached the legality judge.** `tests/roster.js` repairs only a
  scenario that becomes a row, so the rig's own proof fixtures, the control arm's appended click and the
  stat pricer were never judged. Illegal sets **152 → 141**; `probe_control_self_name` receipt **9 → 2**
  and GREEN. No roster count moved: items 148/148, abilities 196/200, moves 496/497 over six runs.

### Notes
- **Two illegal fixtures remain and cannot be staged legally**: no Reg M-B set both carries a quiet
  ability and clicks Skill Swap — 8 abilities, 9 carriers, 63 learners, intersection empty — and **84 of
  the 200 ability rows rest on that control**. Nothing baselined; the baseline serves a static sweep and
  this set is built at run time.
- The 9 baselined staged-board fixtures are deferred repairs, all but one repairable. Carry them, do not
  bless them.
- `tests/test-roster-arm-pin.js` builds four sets and all four are illegal — same shapes, another file.
  Reported, not repaired.

## [0.8.0] — 2026-09-21

### Changed
- **`data/meta-usage.json` regenerated on the filtered corpus** — the file CHOMP reads. `usable`
  33,539 → 28,454, with the custom-ruleset stage recorded (6,952 flagged, 5,085 removed) and the
  18.57% untestable share carried through so the count is not mistaken for a census.
- The division ledgers are restamped; `docs/ENGINE.md` records the re-measure.

### Notes
- **Whole battery on release `adb08f5360f1`: gate OPEN, board-material 0/0/0 across the lattices,
  narration zero on every lattice, held-out 7,182 games with 0 board partings**, damage 0 of 6000 at
  every corner, census 1004/1004/0.
- The engine reached those zeros while carrying a defect neither the gate nor the held-out draw could
  see. An open gate and a correct engine remain two different claims.
- Reg M-B's record is not restated: `abra/regmb` is closed at 7.0.0 and its closed-line clause refuses
  an entry above it.

## [0.7.0] — 2026-09-21

### Fixed
- **A body that dies the moment it arrives was never replaced.** The refill list was built once and
  never rebuilt, so a fainted replacement stood in its slot until the next turn; the authority loops
  until the board is settled. Found at turn 13 of a real game whose streams had been identical for 13
  turns. **This is a MEDICHAM defect the gate did not catch** — it reads zero on three lattices and on
  a 7,182-game held-out draw, and a mirror test outside the gate found it. Knob
  `MEDI_REFILL_ONE_WAVE`, probe `tests/probe_refill_second_wave.js` — 0 clean / 1 under the knob.
- **Three checks were passing vacuously**: a staged-board plant whose anchor a later wire had split in
  two, a control clause iterating an emptied array, and an end-state fixture starved to zero. Each now
  proves itself on a PLANT rather than on a defect that may cease to exist.
- A coverage driver was **stateful across games**, so one part's game count moved another part's
  verdict. Proved not-the-engine under the revert knob, then frozen and restored.
- `engine/scan_custom_rulesets.js` declared NOT_A_MODEL with its reason.

### Notes
- Census **1002 → 1004 live / 1004 probed / 0 missing**.
- **All seventeen reds a full-suite run found are closed, and thirteen of them were the instrument
  rather than the engine.**
- The engine moved, so the gate, the lattices and the held-out draw are owed a re-run, and no figure
  from the previous release is restated here.

## [0.6.0] — 2026-09-21

### Added
- **`exclude_custom_ruleset` — the ladder corpus is filtered of games played under custom rules.**
  Will: *"yes clean the store filter it all out"*. `engine/scan_custom_rulesets.js` streams
  `data/games.ladder.raw-logs.jsonl` and reads the `N custom rule(s):` infobox Showdown itself emits,
  writing the id set to `data/custom-ruleset-ids.json`; `data/quality-filter.json` 1.6.0 reads it.
  **The store is not edited** — `store raw, analyze on top`. **6,978 raw logs carry the infobox,
  6,952 distinct ids, all 6,952 present in the store = 7.37% of 94,360.** 129 alter what a team may
  legally contain or how many are picked; the other 6,823 set a different information regime, **5,210
  of them a bare `Best of = 3`** — bo3 tournament games misfiled in the bo1 ladder store. The clean
  ladder corpus moves **33,539 → 28,454 (−5,085, −15.16%)**, before and after on one store read.
  Contamination is **2.06× denser** in the clean corpus than in the store, because bots do not play
  custom-rules rooms.
- **The run prints the UNTESTABLE SHARE every time.** The infobox is in the raw log and **17,527 rows
  (18.57%)** have no local raw log, so the count is a **FLOOR, never a census**. Both readers carry
  that share out to `funnel()`.

### Fixed
- **`exclude_nonstandard_ruleset` had NO READER.** It was added and switched on at
  `data/quality-filter.json` 1.5.0 and neither `engine/quality.js` nor `engine/quality.py` looked at
  it — a rule written down, switched on, honoured by nobody, with every funnel printing a plausible
  number. Both readers honour it now, and `tests/test-quality.js` asks each enabled rule for a reason
  code a reader emits and a funnel stage that counts it, so a rule added without a reader fails by
  name rather than by a rule count.
- **`engine/sanity_check.py`'s `nobody brings more than four` honours the declaration** the way its
  winner clause already did: every over-four bring is counted, a declared one is attributed, an
  **undeclared one FAILS**, and a **declaration whose row no longer breaches FAILS** so it cannot
  outlive its defect. Shown red on both breaks before being trusted. `SANITY: 96 passed, 0 failed`.
- `engine/provenance.js` attributed `data/custom-ruleset-ids.json` to `engine/quality.py`, which only
  READS it — the reader's `open(CUSTOM_RULESET, ...)` outranked the writer's flag-bound path. The
  scanner now spells the name on its own write line and the graph says `write line`.

### Notes
- **Basis unchanged**, and **no published Reg M-B figure is affected**: `data/team-pool-frozen` holds
  `games.bo3.jsonl` and `games.ots.jsonl`, and **those two stores share zero ids with the ladder
  store** (measured 2026-09-21). This is a cleanup, not a retraction.
- **The 1,176 in `docs/_reports/2026-09-21-six-bring-game.md` §5b is superseded.** That scan's regex
  required the PLURAL `custom rules:`, so every one-rule room was invisible. Reconciled to the unit:
  its per-string joined counts (691 / 170 / 101 / 56) reproduce exactly, and the residue is 5,768
  single-rule rows plus one 8-row string.
- `data/live.js` and `data/meta-usage.json` still carry `usable 33539 / 35.5%` and are now STALE; they
  owe an OPS regeneration. `docs/SUMMARY.md` no longer cites them for that figure.
- Full account: `docs/_reports/2026-09-21-custom-ruleset-filter.md`.

## [0.5.0] — 2026-09-21

### Fixed
- **A certificate that applied and reverted nothing.** `probe_red_demo`'s mega-stone demonstration
  matched its pattern exactly once — in the arm where the stone is never taken — so it proved nothing
  while reporting fine, and its fixture had gone unreachable because the body now faints before the
  step under test runs. Four further demonstrations could not apply their patch at all after last
  night's engine work. **197 demonstrations: 0 HOLLOW, 0 COULD NOT BE APPLIED** (was 1 and 4). One
  assertion that had gone stale is now stricter, not weaker. No engine byte changed.
- **`engine/conformance.js`'s ratchet was laundering findings.** `classify()` asked *did the rule move*
  before *was this already outstanding at the seed*, and a seeded finding sits on an unchanged subject
  by definition — so editing a standard turned that standard's old findings into non-fatal DISCOVERIES,
  which **the first clean run would have adopted permanently.** Demonstrated by restoring the old order
  and reproducing it. The recorded fact now outranks the digest.
- Two further conformance checks measured the wrong thing: *"declares its generator"* read the first 400
  bytes for a word, which measures **key order** — 5 of 8 subjects were pushed past the window by a
  digest block — and the subject digest did not normalise line endings, so from a worktree every `data/`
  subject read as CHANGED and four findings carried a fictional reason.
- **`data/battle-formes.json` gets a generator, and it was derivable exactly**: `species.battleOnly`
  reproduces the hand-built map **131/131, zero missing, zero extra, zero disagreements**. The walk is
  deliberately unfiltered — filtering to the regulation drops 48 entries, which in a store spanning
  regulations are 48 silent mis-keys.
- **A withdrawn figure was still published.** `docs/ABRA-whitepaper.md` carried PORY's held-out
  log-loss with its interval and calibration error; 7.0.0 withdrew every non-MEDICHAM figure and the
  pass missed this one. Deleted, not captioned.

### Changed
- `engine/sanity_check.py`'s cross-consistency clause **REQUIRED** PORY's log-loss in the white paper
  and the summary. Will, 2026-09-21: *"dont take the previous models not named medicham as gospel i
  will likely have to change them all."* A check demanding a withdrawn figure enforces the opposite of
  the policy, so it now asserts ABSENCE, and carries the note that it flips back the day PORY is re-run.

### Notes
- `sanity_check` 94 → 95 passing. Conformance 11 → 10, all S13 artifact provenance, none exempted
  beyond a `void: true` artifact whose writer can never restamp it. **Five of the ten need a decision
  rather than a cleanup** — each requires a refit or moves a published figure — and they wait on the
  model rebuild.
- **A second tool writes absence as fact from a worktree**: `provenance.js --strict` ratcheted its stamp
  down because the worktree lacked three files main has. Reverted. Same hazard as `status.js --write`.
- **Eleven of the seventeen reds are now closed.**

## [0.4.0] — 2026-09-21

### Fixed
- **Six counters incremented a field they never declared**, so each `++` yielded NaN and the counter
  counted nothing — a capability unable to prove it ran. Declared on the objects that own them.
- **`tests/test-unmodelled-clicks.js` proved itself on a real defect, and the defect ran out.** Every
  move in this format is now modelled — the sweep is EMPTY — so the three clauses that asserted the
  counter had fired went red exactly when the hunt succeeded. The proof of life is now a PLANT (a click
  that cannot be modelled by construction); the real sweep is asserted empty separately, and a
  regression is caught by the no-growth clause where that job always belonged.
- **A record in the test runner's own notes had outlived what it described.** It said a probe had never
  been measured and carried no marker; `docs/ROADMAP.md` names it, so both halves were false. Corrected
  rather than deleted. Note left for the next editor: the matcher reads a sentence as an assertion and
  cannot tell a live claim from a quotation of a retracted one — describe old wording, do not repeat it.
- **Three probes loaded the mon table without loading the door**, leaving `MC.mons` unsealed in their
  process, where a mistyped key reads `undefined` instead of throwing — the 2026-07-30 shape. One
  require line each.
- **A probe hand-rolled a species scan.** It SEARCHES for its fixture rather than resolving a key, which
  is legitimate, so it now takes the table through `mcKey.rawTable(<why>)` — the reason is greppable and
  recorded at run time rather than resting on a name in an exemption list.
- **Three identity reads went around the door.** Declared with their reason: they match this file's own
  plants by the name it chose, on inert set objects, so routing them through the resolver would be wrong
  twice over.

### Notes
- Five gates closed: `test-counter-init`, `test-unmodelled-clicks`, `test-claim-truth`, `test-mc-key`,
  `engine/identity_audit`. With `test-knob-control-arm` and `test-workflow-paths` earlier, **8 of the
  17 reds found by the full suite are now green.**
- The finding underneath the unmodelled-clicks fix: **every move in this format resolves to something.**

## [0.3.0] — 2026-09-20

### Added
- **The frozen Reg M-C team pool** — `data/team-pool-frozen-regmc/`, 24,832 games / 49,664 sides /
  11,608 distinct teams, digest `792daded918f`. Excluded: 31,888 not-open-sheet (the scope rule) and
  **363 by Will's Eject Button conjunction** — played before the fix AND the item declared on either
  sheet. A date-only cut would have discarded 8,352 to guard against 335.
- **`docs/REGULATION-ROTATION.md`** and `engine/regulation_touchpoints.js` — what changes between
  regulations, derived rather than typed. Of 1,586 tracked files: 3 configuration, 25 hardcoded,
  110 derived, 1,364 historical (86% is write-once evidence that must NOT change).
- `engine/screen_tags.js`, and two probes: `probe_future_scope_readmission`,
  `probe_tag_derivation_without_prose`.

### Fixed
- **The scope authority silently dropped a live ability.** `engine/legal_scope.js` now puts every
  `Future`-flagged candidate to the `TeamValidator` in the set it is reached through, and prints the
  re-admitted list every run. **Reg M-B re-admits NONE — all 20 candidates refused in the validator's
  own words — so the published M-B record is provably unaffected.** M-C re-admits exactly one ability.
  Ungated re-admission would have wrongly added two mega stones; it was measured before it was wired.
- **Tags were derived from prose, and the prose moved.** `tag_dex` read `move.shortDesc`; Reg M-C ships
  without the Champions descriptions, so the screens derived the wrong halved category and the
  screen-breakers lost their tag — silently, to a default. Now derived from the condition handlers:
  **0 of 500 moves move on M-B, 0 of 515 on M-C**, with every description empty.
- **Six counters incremented a field they never declared**, so each `++` yielded NaN and the counter
  counted nothing — a capability unable to prove it ran. Declared on the objects that own them.
- `tag_dex` refuses to write under a declared restore knob; it had zeroed 316,656 usage entries and
  exited 0.
- The local parsed store was **1,766 games behind the tracked shards** (92,594 against 94,360).
  Reconciled and re-sharded; `tests/test-workflow-paths.js` green.
- `tests/test-knob-control-arm.js` understands a defect held shut by TWO guards: a knob may declare
  `PAIRED WITH <other>`, and the measurement sets both. It had read a correct probe's single-knob green
  as an unwired knob. **81 of 81 pairs green, and the declared-red list is now EMPTY.**

### Changed
- **Will's three Reg M-C decisions** (published as `7.2.0` on the Reg M-B line before this line
  existed; the content is unchanged): the Reg M-B collector's schedule is off and the format carries
  `searchShow: false` so it cannot be laddered anyway; M-C scope is the same as M-B for now — open team
  sheets only, Illusion excluded, closed sheets and bo1 out of scope; and the Eject Button exclusion is
  a CONJUNCTION rather than a date range.

### Notes
- Census 1002 → 1003 probed/live, 0 missing. The second Showdown checkout is built and Reg M-B's legal
  species set is identical in both checkouts, so nothing published at 7.0.0 moved.
- Reg M-C is **not simulated**: the engine loads it, builds a legal team and plays a game, but builds
  0 of the 35 new species because `data/engine-data.js` is an M-B artifact. No M-C figure is published.

## [0.2.0] — 2026-09-20

### Added
- **A version is per (model, regulation), and the parsers read it.** `engine/docs_scan.js` now derives
  VERSION LINES from the changelogs present: each declares itself in its own masthead, each has its own
  top, its own major floor, its own documents and its own notes rows, and a version is compared only
  inside its own line. `node engine/docs_scan.js --lines` prints them.
- `engine/model_versions.js` — the per-(model, regulation) version, DERIVED and never typed: a model
  reaches `1.0.0` only when a gate certifies it on that regulation AND no artifact it publishes is
  quarantined or stale. `node engine/model_versions.js`.
- A closed-line clause: a changelog entry or a notes row carrying a version above the `closed=` its
  line declares is refused by `tests/test-docs-current.js`. "Closed" is machine-read, not remembered.

### Changed
- The two entries published as `7.1.0` and `7.2.0` were Reg M-C setup work carrying Reg M-B numbers.
  `7.1.0`'s content is this line's `0.1.0` below, unchanged word for word.
- A `0.x` line's documents are due EVERY release rather than at its next major, because a line that has
  never shipped a major has no deferred pass to measure a backlog against (SemVer 2.0.0 clause 4). That
  is stricter than the Reg M-B rule, and it relaxes by itself the day this line reaches 1.0.0.

### Notes
- No Reg M-B figure moved, and no Reg M-B document changed its version header. This is a documentation
  versioning change; the MEDICHAM gate's clauses are untouched.
- Full account: `docs/_reports/2026-09-20-version-per-regulation.md`.

## [0.1.0] — 2026-09-20

### Added
- A second Showdown checkout for Reg M-C (`pokemon-showdown-mc`, `f10d679`, 2026-09-20), so pulling the
  M-C authority can never move the bytes Reg M-B's published figures rest on.
- `docs/REGMC.md`, the Reg M-C ledger, opening at **0.1.0** — a leading zero means not usable yet; it
  reaches 1.0.0 when the M-C gate opens.

### Notes
- Delta against the PINNED M-B authority: species +35, moves +15, items +18, abilities +0, nothing
  removed. The ruleset is identical. The real surface is 41 mechanics (15 abilities, 14 moves, 12 held
  items), not 35 species.
- Two moves legal in both regulations had PP cut 10 → 5, and Rocky Helmet is unbanned — changes no
  added/removed list reveals.
- The strict legality filter drops one live ability in M-C (1 of 317); M-C must re-admit validator-
  accepted `Future` entries and print the list every run.
- M-B's legal species set is identical in both checkouts — 347 either way — so nothing published at 7.0.0 moved.
- Published as `7.1.0` on the Reg M-B line on the day it landed, and renumbered here with its content
  unchanged. `CHANGELOG.md` now carries no entry above 7.0.0.
