# Roster staging: Natural Cure, Regenerator, Belch, Effect Spore and the berry red demonstration (2026-09-24)

Scope: the four roster entries the pass-10 gate re-read (`docs/_reports/2026-09-24-gate-reread-pass10.md`) could not
stage, and the one move red demonstration that had stopped biting. **Test code only** (`tests/roster.js`). No engine
byte moved; no instrument proved an engine defect, so there is no separate engine commit.

Releases were cut in this worktree over the unchanged engine tree and reproduced the pass-10 ids exactly:

| reg | release | authority |
|---|---|---|
| Reg M-B | `7822a83cc49b` | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` |
| Reg M-C | `ec377f6f8159` | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` (`ABRA_REGULATION=regmc`) |

## Verdict per stage (full stage, `--reds --write --release <id>`, through `tools\lownode.cmd`)

| stage | DID-NOT-FIRE | FIRED-AND-BOARDS-DIFFER | COULD-NOT-STAGE | tested / in scope | red demonstrations |
|---|---|---|---|---|---|
| Reg M-B abilities | 0 | 0 | **0** (was 3) | 196 / 200 (was 193) | all CAUGHT; exit 0 |
| Reg M-B moves | 0 | 0 | **0** (was 1) | 495 / 497 (was 494) | all CAUGHT (was 1 NOT CAUGHT, exit 1); exit 0 |
| Reg M-C abilities | 0 | 0 | **0** (was 3) | 210 / 214 (was 207) | all CAUGHT; exit 0 |
| Reg M-C moves | 0 | 0 | **0** (was 1) | 509 / 511 (was 508) | all CAUGHT (was 1 NOT CAUGHT, exit 1); exit 0 |

The remainders are unchanged and are not COULD-NOT-STAGE: abilities 1 DEFERRED-BY-OWNER + 3 ANNOUNCEMENT-ONLY in both
regulations; moves 1 DEFERRED-BY-OWNER + 1 BELOW-USAGE-SHELF (Reflect Type) in both.

Artifacts: Reg M-C `data/roster.abilities-regmc.json`, `data/roster.moves-regmc.json` (committed; the gate reads them).
Reg M-B readings parked at `data/verification/roster.{abilities,moves}-7822a83cc49b-staging.json`; the published
`data/roster.{abilities,moves}.json` stay at HEAD for the same reason pass 10 gave (they back the closed 7.0.0 record
and folding new figures into it is Will's call).

## 1. Natural Cure and Regenerator (`ability/switch-out`) — commit 0.88.0

**Fault.** The switch-out script's turn 1 handed side A slot 1 the aggressor's hit (`click(hitThem, 1)`). When the
control is an in-play Skill Swap, slot 1 is the lender — Gourgeist-Super in both regulations — and it does not learn
the hit, so it carries no such move. `scripted()` answers `pass` for a click the body does not carry and Showdown
refuses `pass` from a healthy active body: `Can't pass: Your Gourgeist must make a move`.

**Second fault, found while fixing the first.** Natural Cure's last green (release `2e9db8bb11fd`) had one `sd_delta`
family: the ability field the control itself rewrites. Nothing ever put a status on the carrier, so the cure had
nothing to remove and the green was vacuous.

**Fix.** The switch-out script is rebuilt after the control is chosen, so it knows which body stands in slot 1:
- Slot 1 throws a DERIVED major status at the carrier (`switchOutStatusFor`): Status category, single target, learned
  legally by that body, not refused by the carrier's typing (move type, status, powder — the authority's type chart),
  100 accuracy first, paralysis first. Derived result in both regulations: Will-O-Wisp off Gourgeist-Super (the only
  qualifying move that body learns), 85 accurate, so the row is pinned to `bottom-tie-first` through `mclick`.
- A precondition reads the carrier's status off Showdown's board.
- The partner stays the negative: it is chipped by slot 0 on a turn of its own.
- Natural Cure moves to a new shape rule, `ability/switch-out-cures` (an `onSwitchOut` that calls `clearStatus` or
  `cureStatus`), with its own plant: `if(_sot.does==='cure'){` → `if(false&&...)`. A rule's red demonstration stops
  at its first flipping member, so under the shared heal plant the cure could never be shown to have teeth.
  Membership printed before wiring: `ability/switch-out` = Regenerator; `ability/switch-out-cures` = Natural Cure.

**Evidence.** Reg M-B `sd_delta` for Natural Cure now carries `p2.party.altaria.status: '' vs 'brn'`; Regenerator
`p2.party.toxapex.hp 469 vs 338`. Both reds CAUGHT in both regulations: cure plant → Natural Cure DID-NOT-FIRE on
`party.status`; heal plant → Regenerator DID-NOT-FIRE on `party.hp`.

## 2. Effect Spore (`ability/contact-statuses-the-attacker-by-chance`) — commit 0.89.0

**Fault.** The rule asked only that the chosen coin fall below the running total of the branches CAST.ATTACKER
(Dragapult) can take. Effect Spore's roll is sleep 0.11 / paralysis 0.10 / poison 0.09 in the tag's order; the
chosen coin (Body Slam, turn 3, 0.2637) lands in the **poison** band. And the body that actually threw it was not
Dragapult: Effect Spore can write sleep, so the idle click stays Focus Energy; Dragapult cannot learn Focus Energy, so
the #318 restaging pass swapped in a learner — **Archaludon** under Reg M-B (Steel: refuses poison) and **Rillaboom**
under Reg M-C (Grass: fails the handler's `source.runStatusImmunity('powder')`, carried on the tag as
`attackerStatusImmunity: 'powder'`). Showdown rolled the coin, the aggressor refused it, and the two arms agreed —
"THE STAGING IS INERT".

**Fix.** Bands are built from the tag in order; the coin must land in a band whose status the aggressor takes
(typing and the tag's own `attackerStatusImmunity`); when any band writes sleep, the aggressor must also learn the
idle click so the restaging pass has nothing to swap; CAST.ATTACKER is still asked first. A precondition reads the
aggressor's status off Showdown's board. Result in both regulations: Beedrill, X-Scissor, turn-3 coin 0.0139 in the
`slp` band. Static, Flame Body and Poison Point keep Dragapult / Body Slam byte for byte.

**Evidence.** `sd_delta` `p1.party.beedrill.status: 'slp' vs ''`. Red CAUGHT via Effect Spore on `party.status`.

## 3. Belch and `move/needs-a-berry-already-eaten` — commit 0.90.0

**Fault.** Belch is 90-accurate and runs on `bottom-tie-first`, where every crit lands. Since #318 its eater is a
legal learner — Salazzle (Reg M-B), Toxtricity (Reg M-C) — not the old bulky body. The chip count was priced without
the crit: "Crunch 61 a time into 143 HP, 2x" was really two crits, the second KO'd the eater, the bench Milotic was
handed the eater's click, and Showdown refused `pass`. The rule's plant (`_ateBerry=false` in `consumeBerry`) moves none
of the other three members (Bug Bite, Pluck and Recycle were green in pass 10 and the red still read NOT CAUGHT), so
with Belch unstaged it moved no board — the red that made both moves stages exit 1.

**Fix.** On `bottom-tie-first` the chip is priced as a crit, with the multiplier read off the format's own
`modifyDamage` (`CRIT_DAMAGE_MULT`; the Champions mod overrides that function in `scripts`, so the mod's copy is asked
first; null refuses by name). A chip count that would also KO the eater is refused by name. The other three members
run on the primary arm and are unchanged.

**Evidence.** Belch: one crit Crunch (~91 into 143, Reg M-B; ~81 into 150, Reg M-C) crosses half, the eater eats
and clicks. Red CAUGHT via Belch, FIRED-AND-BOARDS-DIFFER on `party.hp` in both regulations.

## Engine defects

**None proven by these fixtures.** Every re-staged row reads FIRED-AND-BOARDS-MATCH in both regulations.

Pre-existing and not part of this brief, reported because the stage prints it: **Reflect Type** is shelved on usage
(11 clicks < 25) with an underlying FIRED-AND-BOARDS-DIFFER in both regulations. From the parked Reg M-B artifact:
after the aggressor Stunfisk-Galar reflects Goodra-Hisui's type on turn 2, both engines read `dragon/steel` at
boundary 2, and at boundary 3 Showdown still reads `dragon/steel` while MEDICHAM reads `ground/steel` — our engine
drops the reflected type a turn early. Minimal reproduction:
`SHOWDOWN_PATH=<M-B checkout> node tests/roster.js --stage moves --only reflecttype --release 7822a83cc49b`
(`ROSTER_DUMP_BOARDS=reflecttype` prints both arms). This was already in the pass-10 reading; it is ENGINE's, not a
fixture fault, and no engine change was made here.

## Instrument notes

- In the pass-10 artifacts `ability/switch-out` had **no red row at all** — not NOT CAUGHT, absent — because the red
  loop only visits rules with a staged member. The COULD-NOT-STAGE rows still held the gate, so nothing was hidden,
  but a rule whose every member is unstaged is silent in the red list.
- `data/engine-release.json` was rewritten by the release cut and is not committed.
- Not done: `node engine/status.js --write` (it writes untracked files as fact from a worktree); the coordinator
  should run it after the merge. The quarantine gate itself was not re-run; the per-stage verdicts above are what its
  roster clauses read.
