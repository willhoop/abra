# The last refused roster fixtures, rebuilt legal. 2026-09-23 (ENGINE, abra/regmc 0.79.0)

Light mode. I ran no roster stage, no differential, no census, no `quarantine.js` and no `status.js`, because another
ENGINE agent was playing games. Only `tests/roster.js` changed; no file under `engine/` moved. Releases `89ac57f1f81b`
(Reg M-B) and `485d0a6840ad` (Reg M-C) still describe the engine bytes. I copied them, and
`data/engine-release-regmc.json`, from the main checkout into this worktree so the roster could open them. They are
git-ignored or untracked and I did not commit them.

## Verdict

| distinct refused sets: items / abilities / moves (+ rule-built) | before (main `380e997d`; `tests/roster.js` is byte-identical at main `08cc6e88`) | after |
|---|---|---|
| Reg M-B | 0 / 6 / 3 (+2) | **0 / 0 / 0 (+0)** |
| Reg M-C | 0 / 7 / 3 (+2) | **0 / 0 / 0 (+0)** |
| rows that stopped staging, either regulation | — | **0** |

`tests/probe_roster_fixture_legality.js --strict` exits 0 in both regulations. I measured it first on `380e997d`,
then again after fast-forwarding the branch to main `08cc6e88` (0.78.0). Both runs read 0 refused and the same
staged counts. The roster opens releases `89ac57f1f81b` and `485d0a6840ad`, so the proof games play those bytes. No
release has been cut for main's pass-9 engine. The command was
`tools\lownode.cmd`, launched as an argument-vector spawn. I kept nothing refused and baselined nothing. **No mechanic
went out of scope: every one has a legal carrier in both regulations.** The staged-id sets for all three stages are
identical to main's in both regulations: 148 / 199 / 497 under Reg M-B and 166 / 213 / 511 under Reg M-C.

## What each refusal became

### 1. The Skill Swap lender (84 Reg M-B rows and 90 Reg M-C rows, plus `proof/swap-control`)

- **Cause.** The lender had to hold a QUIET ability. The TeamValidator says no legal quiet-ability species learns Skill
  Swap.
- **What the lender actually has to be.** Its ability is on the field in both arms, and it lands on the carrier in the
  control arm. So the requirement is BOARD-INERT, and "quiet" is only one road to that. The second road is already
  derived in the file:
  - `fieldFamilyBranch` classifies an ability as `announces-only` when its ONLY handler is an `onStart` that calls
    `this.add` and pure readers.
  - I printed the membership before wiring it. It is **Frisk only, in both regulations.**
  - The tag dex derives `announcesOnEntry.visibleOnABoard: false` for Frisk, and its own roster row is graded on the
    protocol line for that reason.
- **Change (`swapperFor`).** The pool is every legal, buildable body that legally learns Skill Swap and holds a quiet or
  announces-only ability. A quiet ability wins when the same body has both. The pool is ranked by bulk, as before.
  - Derived pool, identical in both regulations, printed by `ROSTER_PRINT_SWAPPER=1`: Gourgeist-Super,
    Gourgeist-Large, Gourgeist, Gourgeist-Small, Wyrdeer, Trevenant, Espathra, Banette.
  - The lender is **Gourgeist-Super lending Frisk** on every arm, including `bottom-tie-first`, because Frisk is not a
    crit armour.
- **Two follow-on refusals, found and fixed.**
  - **Early Bird.** Its board holds Yawn, so Focus Energy stays. The lender restage branch then swapped Gourgeist-Super
    for a Frisk body that learns Focus Energy but not Skill Swap: *"Grimmsnarl can't learn Skill Swap."*
  - **Super Luck.** A crit-ratio entity keeps Focus Energy, and *"Gourgeist-Super can't learn Focus Energy."*
  - **Why a legal Focus Energy lender is not available.** The legal species that learn both Skill Swap and Focus Energy
    are Espeon, Umbreon and Sylveon, and none of them holds a lendable ability.
  - **What I built instead.** A sharper per-body question, asked of the LENDER ONLY (`isSwapLender`):
    - `sleepCannotReachLender` checks the script. Every scripted sleep click must be single-target and aimed away from
      side A slot 1, and nothing may switch in or out of that slot.
    - `lenderNeverAttacks` removes the crit guard for a lender that never clicks a damaging move.
    - With both in place the lender idles on Sleep Talk.
    - The restage branch now asks this of both arms, and its same-ability replacement must also learn Skill Swap.
    - Every other body keeps the old gate. The runtime watch `INERT_SUB_SLEPT` still counts any sleeping body idling
      on the substitute.
- **Red demonstration.** `ROSTER_SWAPPER_UNREPAIRED=1` restores the old lender and the old restage branch. With it on,
  the Reg M-B abilities stage refuses 5 sets and the rule-built sets refuse 2 again (`--strict` exit 1).
- **Load order.** The swapper is derived at module load. `ANNOUNCE_READERS`, `mcKey` and `_monsLoaded` moved above it,
  because it reads them and would otherwise hit their temporal dead zone. The first attempt threw exactly that error.

### 2. Heal Bell

- **Validator.** *"Goodra-Hisui can't learn Heal Bell."* The only legal learner in both regulations is Chimecho, and
  its only ability is Levitate.
- **Why Levitate can be admitted.** `QUIET_EXCLUDE` keeps Levitate out for one stated reason, "grants a Ground
  immunity". That reason does not apply on a board with nothing that reads groundedness.
- **Change.** The new pool `inertBodies(arm, {groundFree})` is the quiet pool first, byte for byte, then
  announces-only bodies. Under `groundFree`, it also admits an ability with no handler that `QUIET_EXCLUDE` keeps out
  ONLY for the Ground immunity. `move/generic-status` asks for it in the LEGAL_FIRST re-match, and only when no quiet
  body learns the move.
- **Proof.** The chip is drawn from a type other than Ground, learned by the clicker (`neutralHit2`). Then
  `groundFreeBoard` must hold on the finished board, or the row is refused rather than played:
  - no Ground-typed move;
  - no terrain, side, slot, weather or field condition;
  - no ability or move text that reads groundedness.
- **Fixture.** Chimecho (Levitate) @ Sitrus Berry clicks Heal Bell on turn 2. The clicker chips with Sludge Bomb, whose
  secondary never fires on the primary arm.

### 3. Roost (a HELD row)

- **Validator.** *"Torkoal can't learn Roost."* No quiet body in the heal band learns Roost.
- **Change.** `chippableBody` takes `opt.pool`, and the heal rule's LEGAL_FIRST path falls back to
  `inertBodies(arm)`.
- **Fixture.** Noivern (Frisk) is chipped 132 of 160 by Dragon Claw, then clicks Roost twice. No body on the board
  holds an item, so Frisk announces nothing. Noivern's maximum divides by 2, so the note says the rounding is not
  exercised. The row itself states this.

### 4. Transform

- **Validator.** *"Goodra-Hisui can't learn Transform."* The only learner is Ditto, and Ditto learns nothing else: no
  Focus Energy, no Sleep Talk, no delivery move. Ditto therefore cannot chip on turn 1 or idle on turn 3. The move
  stage's control, which replaces the click with the idle click, is not a set Ditto can declare.
- **Change.** `retargetScenario` gives it the one shape it can have. The fixture is one turn:
  - Ditto (Limber) clicks Transform at the foe (Goodra-Hisui) in the subject arm, and at its partner (Torterra) in the
    control arm (`sc.retargetControl`; `controlOf` sets `ally: true` on the click and ignores nothing).
  - Transform's own `target: normal` admits both aims.
  - The two targets are different species, so the arms part on everything Transform copies.
  - If an engine's Transform did nothing, it would read the same in both arms and differently from the authority.
  - `scaffold`'s appended idle click is taken back off Ditto.
- **Why Limber is admitted.** `oneStatusAbility` reads that its handlers are only `onUpdate`/`onSetStatus` and that
  they name only `par`. `boardWritesStatus` proves nothing on the board writes paralysis.

### 5. The two rule-built sets

Both were `proof/swap-control` (*"Goodra-Hisui / Glimmora can't learn Skill Swap."*). The proof now plays with the
derived lender. It reads **31 leaves in Showdown and 31 in MEDICHAM** (lending Frisk off Gourgeist-Super), so the tier
stays open by measurement.

## The controls still separate: sampled, played, named

Script: for each row, play the subject arm and its control in both engines. Count the Showdown board leaves that
differ between the arms, excluding the control's own PP and `.ability` bookkeeping. Then read `runEntry`'s own
verdict. Nothing was written.

| reg | row | lender / carrier | Showdown leaves differing (beyond bookkeeping) | engine disagreements, either arm | verdict |
|---|---|---|---|---|---|
| M-B | adaptability | Gourgeist-Super [Frisk] | 31 (6: aggressor HP) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | aerilate (MEGA tier) | Gourgeist-Super [Frisk] | 31 (6) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | angerpoint | Gourgeist-Super [Frisk] | 31 (6: carrier `boosts.atk`) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | dragonize (MEGA tier) | Gourgeist-Super [Frisk] | 31 (6) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | earlybird | Gourgeist-Super [Frisk], Sleep Talk idle | 45 (6: carrier `status`/`status_counter`) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | electromorphosis | Gourgeist-Super [Frisk] | 31 (6) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | insomnia | Gourgeist-Super [Frisk] | 32 (4: `status`) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | sniper (bottom-tie-first) | Gourgeist-Super [Frisk] | 31 (6) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | superluck | Gourgeist-Super [Frisk], Sleep Talk idle | 31 (6) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | unseenfist (MEGA tier) | Gourgeist-Super [Frisk] | 31 (6) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | healbell | Chimecho [Levitate] | 4 (0 — PP only) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | roost | Noivern [Frisk] | 8 (4: Noivern HP) | 0 | FIRED-AND-BOARDS-MATCH |
| M-B | transform | Ditto [Limber] | 4 (4: Ditto species, types) | 0 | FIRED-AND-BOARDS-MATCH |
| M-C | adaptability, earlybird, stakeout, superluck | Gourgeist-Super [Frisk] | 31 / 45 / 23 / 31 (6 / 6 / 4 / 6) | 0 | FIRED-AND-BOARDS-MATCH, all four |
| M-C | healbell, roost, transform | as Reg M-B | 4 (0) / 8 (4) / 4 (4) | 0 | FIRED-AND-BOARDS-MATCH, all three |

**One weakness, and it predates this pass.** Heal Bell separates only on its own PP. The generic fixture puts no
status on the board, so the cure is never exercised. This is the same shape as the old Goodra-Hisui fixture, which
read the same way. I have put it on the ENGINE hand list and did not fix it here.

## Other instruments, run

| probe | Reg M-B | Reg M-C |
|---|---|---|
| `probe_roster_learnset_refusals.js` (on each regulation's release) | GREEN, 0 refused pairs | GREEN, 0 refused pairs |
| `probe_roster_inert_legality.js --strict` | 1122 sets, 0 illegal | 1183 sets, 0 illegal |

Game count: each legality sweep plays the rules' 13 proof games. The separation sample played 2 arms per row through
`play()` and again through `runEntry`.

## OWED, NOT RUN

Run these one at a time after the other ENGINE agent finishes, through the wrapper. From Bash, use an argument-vector
spawn of `cmd.exe /c tools\lownode.cmd ...`. The engine bytes have not changed, so the gate's releases still apply.

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown   tools\lownode.cmd tests/roster.js --stage items     --reds --write --release 89ac57f1f81b
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown   tools\lownode.cmd tests/roster.js --stage abilities --reds --write --release 89ac57f1f81b
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown   tools\lownode.cmd tests/roster.js --stage moves     --reds --write --release 89ac57f1f81b
ABRA_REGULATION=regmc SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc tools\lownode.cmd tests/roster.js --stage items     --reds --write --release 485d0a6840ad
ABRA_REGULATION=regmc SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc tools\lownode.cmd tests/roster.js --stage abilities --reds --write --release 485d0a6840ad
ABRA_REGULATION=regmc SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc tools\lownode.cmd tests/roster.js --stage moves     --reds --write --release 485d0a6840ad
```

- **Expect.**
  - `fixture_legality.not_baselined` reads 0 / 0 / 0 in both regulations, with no rule-built refusal.
  - Every swap-controlled ability row keeps a verdict. The lender changed on all 84 (Reg M-B) and 90 (Reg M-C) rows,
    so read the abilities stage in full, not just the sample above.
  - Heal Bell, Roost and Transform read FIRED-AND-BOARDS-MATCH, as sampled.
  - `[SWAP CONTROL]` lines name Gourgeist-Super lending Frisk.
- **If a swap row changes verdict**, dump it with `ROSTER_DUMP_BOARDS=<id>`. Compare the run under
  `ROSTER_SWAPPER_UNREPAIRED=1` to see whether the lender is the cause. Do not trade a staged row for a legal one.
- **Then read both gates**: `tools\lownode.cmd engine/quarantine.js`, and the same with `--regulation regmc`.
- **Carried from 0.78.0 (first numbered 0.71.0), still owed**:
  - wire `tests/probe_roster_inert_legality.js --strict` into `tests/run-all.js`;
  - the status stamps (`node engine/status.js --write`), after the roster stages.
- **Hand list.** Heal Bell's cure is not exercised by its roster fixture.
