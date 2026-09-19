# Closing the two failing clauses on `d92bdfb50d88` — 2026-09-19, ENGINE (light mode)

This is a findings record, not a living document. It is not cited as current state; `node engine/status.js` and
`node engine/quarantine.js` hold that.

Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a938fe037dc8cdbc9` (HEAD `49ec0cb7`).
The store and pool were read from the main tree: `--team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen`.

---

## 0. VERDICT

| clause on `d92bdfb50d88` | cause | verdict on the named rows |
|---|---|---|
| roster / items: `item/resist-berry` red anchor DEAD | instrument: the anchor named a line that 6.63.0's Ripen fix rewrote | **CAUGHT** (single-rule `--reds`, via Babiri Berry, FIRED-AND-BOARDS-DIFFER on `hp`), on `d92bdfb50d88` and on `9a031254d967` |
| mechanics: Natural Cure DID-NOT-FIRE | instrument: a merge regression in `engine/stage_planner.js`, two trigger switches on one turn | **FIRED** on the planner, near-a and far-a, against a quiet Cloud Nine control; boards NO-DIVERGENCE in both arms |
| mechanics: 8 moves "NOT RESOLVED ON MEDICHAM" | instrument: the MEDICHAM-side resolution reader | **all 8 resolved on both engines**; Psych Up (its fixture moved) also resolved |

**No engine defect was found.** None of the eight moves fails to act in our engine. Both red demonstrations are
CAUGHT. Release: **`9a031254d967`**, cut in this worktree. It adds two knobs, both default off. No gate run was
made (light mode).

## 1. THE RESIST-BERRY PLANT

- The dead anchor was `if(_rb&&_rb.onType===mvT&&(!_rb.requiresSuperEffective||eff>1)&&!berryRefusedByFoeNew(def))MODMUL((_rb.mult||0.5));`.
  The Ripen fix split it into `const _rbEats=!!(<condition>);` + `if(_rbEats)MODMUL(...)`
  (`engine/medicham2-browser.js`, `dmgRangeOneHit`). It is the second time this anchor died because somebody edited the condition.
- The brief asked for the tag read. `const _rb=TAGS.param('item',def.item,'resistBerry');` matches **twice**
  (`ripenWeakenPriced` carries the identical statement), and the roster refuses any anchor that is not exactly once.
- New anchor: `const _rbEats=!!(` → `const _rbEats=false&&!!(`. It names the HEAD of the binding the code now
  builds, so any clause added to or removed from the condition leaves it alive. The patch drops the halve and
  Ripen's fresh-eat second halve. The berry is still held, and the battle loop still eats it at the hit.
- `tests/roster.js --rule item/resist-berry --stage items --reds --release d92bdfb50d88`: exit 0, **CAUGHT via
  babiriberry → FIRED-AND-BOARDS-DIFFER on party.hp, hp**, 18/18 FIRED-AND-BOARDS-MATCH clean, no DEAD ANCHOR.
  The same on `9a031254d967`.

## 2. NATURAL CURE

- **Mechanism.** `triggersOf` gives Natural Cure two triggers that both mean "the carrier leaves":
  `carrier-switches-out` (tag `switchOutTrigger`, whose printed members are naturalcure, regenerator and zerotohero;
  added by force-fire-b) and `switch-out` (an `onSwitchOut` that reads `.status`, member naturalcure only; added
  by the showdown-only batch). Each batch pushed its own `C sw CB` phase-1 click. Merged, `layTurns` refused the
  fixture: "C is asked for two trigger clicks on one turn". The row then fell back to a legacy fixture that never
  switched.
- **Fix** (`engine/stage_planner.js`, the `switch-out` branch): if C already carries a phase-1 switch to the bench,
  the branch adds no second click. It still sets the STATUS leaf, because the other block's `species` leaf belongs to
  Zero to Hero. The fixture is now T1 Feraligatr Ice Beam → Altaria and T2 Altaria switches to the bench, which is
  the fixture the showdown-only report recorded as FIRED.
- **Row** (`--release 9a031254d967 --kind abilities --only naturalcure`): **FIRED**, stage planner, variants
  near-a FIRED and far-a FIRED, control Cloud Nine, `control_not_quiet` false, board NO-DIVERGENCE, control-arm
  board NO-DIVERGENCE. The A/B board moved `sides.p1.party.altaria.status` in both engines (same leaves).
- **Regression sweep.** I planned the whole population (964 mechanics) and diffed each fixture (bodies, abilities,
  items, moves, read turn, observed leaf) against the fixtures the published `data/all-mechanics-fire.json` played:
  **348 rows compared, 347 identical, 1 differs: `ability:naturalcure`** (published: REFUSED). The fresh plan has
  **0** "two trigger clicks" refusals and 0 attempts refused on it. The refusal summary goes from
  PLANNER-CANNOT-CONSTRUCT 2 to 1; the one left is Imposter, "C (Ditto) has no inert click", as published. The
  published move rows carry no planner block, so moves were diffed plan against plan below. `tests/test-stage-planner.js`
  (full population, all red demonstrations) is GREEN.

## 3. THE EIGHT MOVES

### What the reader keys on

`verdictFor` in `engine/all_mechanics_fire.js` opens a segment on each `|move|` line and counts consequence lines
(`-` events and `faint drag switch swap detailschange formechange replace`) inside it. `-fail` naming the user, or a
`-fail` on a non-spread move, is HARD. A later `[from] move: <NAME>` line credits a delayed effect. It reads each
engine's RAW log, and for ours that is `mediTrace`. The whole-game comparator reads `reduce()`d streams, which drop
events our engine is declared not to emit. So "the streams agree" (the comparator) and "our trace has the line"
(the reader) are different statements. The brief's premise that both engines print the same lines is true of the
reduced streams and false of the raw ones. Printed side by side with `--dumplog` on `d92bdfb50d88`:

| move | authority's consequence | our raw trace | cause |
|---|---|---|---|
| Wish | `-heal …\|[from] move: Wish\|[wisher] …` | `-heal …\|[from] move: wish\|[wisher] …` | **reader**: matched the NAME, our trace writes the id |
| Sleep Talk | `move …\|Facade\|…\|[from] move: Sleep Talk` | `move …\|facade\|…` (no `[from]`) | **reader**: the called move opened its own segment |
| Life Dew | `move …\|Life Dew\|\|[still]\|[spread] p1a,p1b`, `-heal p1a`, `-fail p1b heal` | `move …\|lifedew\|p1a`, `-heal p1a`, `-fail p1b heal` | **reader**: our trace never writes `[spread]`, so the ally's `-fail` read HARD |
| Ally Switch | `swap\|p1a\|1\|[from] move: Ally Switch` | nothing | our engine writes no line (declared) |
| Guard Swap / Power Swap | `-swapboost\|…\|def, spd` / `atk, spa` | nothing | declared un-emitted, `data/protocol-events.json` |
| Topsy-Turvy | `-invertboost\|p2a` | nothing | declared un-emitted |
| Destiny Bond | `-singlemove\|p1a\|Destiny Bond` | nothing | declared un-emitted ("not modelled", a stale reason: the volatile IS modelled) |

### The fix, in two halves

1. **Protocol half, for our trace only** (`opts.engine === 'medicham'`, `MEDI_READ`):
   - `[from] move:` is compared by id.
   - A `|move|` by the same actor, immediately after a segment whose move has dex `callsMove`, is that call (Sleep Talk).
   - `spread` falls back to the move's dex target class (`allies`, `allAdjacent`, `allAdjacentFoes`), because our trace never writes the marker.
   The authority's verdict is read exactly as before. Each rule still needs a consequence line that our engine
   writes only when the effect happened, and none can turn a resolved row into an unresolved one.
2. **State half, `stateCredit`** (after `plannedMoveStage`): for a row the authority resolved and ours did not, and
   with no HARD refusal in our segment, read each planner variant's fixture arm against its control arm
   (`abBoardFinal`: each engine against itself, the control swaps only the subject's click for a proven-inert one).
   The row is credited only when the authority's board moved AND ours moved on exactly the same leaves
   (`same_leaves`). Otherwise `medicham_state_credit.why` says which of the two failed.
3. **The fixture half** (`engine/stage_planner.js`): Guard Swap and Power Swap swapped two EMPTY stat pairs, and
   Topsy-Turvy failed on an unboosted receiver, so no board moved in either engine and there was nothing to read.
   New derivation `target-boosted`: the handler reads `target.boosts` AND writes stages (`setBoost(` or a
   `boosts[..] =` assignment), on a foe-targeting move. The stats come from the handler's own array literal.
   Membership, printed before wiring, over the legal moves: **guardswap [def,spd], powerswap [atk,spa], psychup
   [any], topsyturvy [any]**. Acupressure, Belly Drum and Strength Sap read `target.boosts` too. They are excluded
   because they target the user, or read the stage without writing it. The receiver now clicks a self-boost of one
   of those stats on T1 (Calm Mind, Dragon Dance, Agility). A plan-vs-plan diff across all 964 mechanics changes
   exactly those 4.

### Verdicts (`--release 9a031254d967 --kind moves --only …`, 107 games, 0 threw, `red_ok` true)

| move | authority | ours | read by | board |
|---|---|---|---|---|
| Ally Switch | resolved | **resolved** | state, planner main/near-a, 13 leaves | NO-DIVERGENCE |
| Destiny Bond | resolved | **resolved** | state, planner main/near-a, `vol.destinybond` | NO-DIVERGENCE |
| Guard Swap | resolved | **resolved** | state, planner main/near-a, `boosts.spd` on both bodies | NO-DIVERGENCE |
| Life Dew | resolved | **resolved** | protocol (spread) | NO-DIVERGENCE |
| Power Swap | resolved | **resolved** | state, planner main/near-a, `boosts.atk` on both bodies | NO-DIVERGENCE |
| Sleep Talk | resolved | **resolved** | protocol (nested call) | NO-DIVERGENCE |
| Topsy-Turvy | resolved | **resolved** | state, planner main/near-a, `boosts.spe` | NO-DIVERGENCE |
| Wish | resolved | **resolved** | protocol (id) | NO-DIVERGENCE |
| Psych Up (fixture moved) | resolved | resolved | protocol | NO-DIVERGENCE |

Every planner variant of every row reads board NO-DIVERGENCE. Destiny Bond's credit is for the volatile. That is
what the authority's `-singlemove` announces, but the KO-the-killer half is not exercised by this row. The existing
`MEDI_NO_DESTINY_BOND` knob leaves the volatile written, so it would NOT flip this row, and I do not claim it would.

### Red demonstrations (`9a031254d967`)

- `MEDI_WISH_NO_PAYOUT=1`: the Wish comes due, heals nobody and writes no line. **Wish reads NOT resolved on
  MEDICHAM** ("the move executed and produced no consequence line at all"), and the board parts (STATE). This is
  the protocol half.
- `MEDI_STAT_INVERT_NOOP=1`: Topsy-Turvy reports success and inverts nothing. **Topsy-Turvy reads NOT resolved on
  MEDICHAM**, and the board parts (STATE). `medicham_state_credit.why`: "the authority's board moved between the
  fixture and control arms and OURS did not move on the same leaves (main/near-a: authority 2, ours unmoved;
  main/far-a: authority 2, ours unmoved)". This is the state half.
- Both are asserted by **`tests/probe_state_credit_red.js`**: GREEN, 12 of 12 checks (9 moves on both engines,
  Natural Cure FIRED, both red arms CAUGHT). The probe says CANNOT ANSWER on a release that lacks the knobs,
  including `d92bdfb50d88`. It does not call an unwired knob a pass.
- **The fail comes first:** the same eight named rows on `d92bdfb50d88`, with the unmodified reader, read
  `medicham_resolved: false`, 8 of 8. Natural Cure read PLANNER-CANNOT-CONSTRUCT before the planner fix.

## 4. FILES CHANGED (worktree, uncommitted)

- `tests/roster.js`: the `item/resist-berry` plant is re-aimed.
- `engine/stage_planner.js`: the double switch-out is dropped (Natural Cure); new `target-boosted` derivation for
  stage-rewriting moves; the receiver's boost is restricted to the stats the handler names.
- `engine/all_mechanics_fire.js`: `segments`/`verdictFor` take `opts` (`MEDI_READ`) with the three our-trace
  substitutions; `[from] move:` is compared by id; `hard` is returned on an unresolved verdict; `medicham_hard` is
  added to move rows; the planned move list carries `ab_board`; `stateCredit` is new, with a printed count.
- `engine/medicham2-browser.js`: two knobs, default off: `MEDI_WISH_NO_PAYOUT`, `MEDI_STAT_INVERT_NOOP` (loud in
  `MEDFAILS.wishPayoutSuppressed` / `statInvertNoop`). With both off the behaviour is unchanged. Checked: no roster
  or `probe_red_demo` anchor names an edited line.
- `tests/probe_state_credit_red.js`: new.
- `docs/ENGINE.md`: new section with the hand list; the probe is added to the Owns list.
- `data/engine-release.json` and `data/releases/d92bdfb50d88/{cuts.jsonl,release.json}`: my cuts wrote to them, and
  I restored all three to HEAD. `data/releases/9a031254d967/` is on disk (gitignored, not tracked). A cut on the
  merged tree reproduces it only if the tree is byte-identical.
- Not touched: `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `board.js`, `magnemite.js`, `engine-data.js`, the census.
  I did not run `status.js --write`.
- Processes: every process I started ended on its own. None was killed.

## PROPOSED NOTES ROW

```
| <<VER>> | 2026-09-19 | **The two failing gate clauses on `d92bdfb50d88` close on their named rows; all three causes were the instrument.** (1) The `item/resist-berry` red plant is re-aimed at `const _rbEats=!!(` (the tag read matches twice: `ripenWeakenPriced` carries it). A single-rule `--reds` run reads CAUGHT (Babiri Berry, FIRED-AND-BOARDS-DIFFER on `hp`). (2) Natural Cure: a merge left two trigger switches on one turn in `engine/stage_planner.js`. The duplicate is dropped, and the row reads FIRED on the planner against a quiet Cloud Nine control. A whole-population plan diff against the published fixtures changes 1 of 348. (3) Eight moves (Ally Switch, Destiny Bond, Guard Swap, Life Dew, Power Swap, Sleep Talk, Topsy-Turvy, Wish) were read "not resolved on MEDICHAM" by a reader keyed on lines our raw trace never writes. Three our-trace substitutions (`[from]` by id, a `callsMove` nested call, `[spread]` from the target class) and a board reading against the planner's control arm (`stateCredit`, credited only on the authority's exact leaves) resolve all eight on both engines. A new `target-boosted` planner derivation gives Guard Swap, Power Swap, Topsy-Turvy and Psych Up a boosted receiver. Red: `MEDI_WISH_NO_PAYOUT=1` and `MEDI_STAT_INVERT_NOOP=1` each flip their row back to not resolved. `tests/probe_state_credit_red.js` GREEN on worktree release `9a031254d967`. Named rows only (light mode). The full battery and `engine/quarantine.js` are owed before the gate reading changes. `docs/_reports/2026-09-19-close-two-clauses.md` | **Supersedes.** Nothing published: the gate still reads CLOSED 2 of 10 until the battery is re-run. **Basis.** unchanged | ENGINE.md (done); white paper at the next major |
```

## OWED, NOT RUN

1. **The full staged-game battery** (`engine/all_mechanics_fire.js --kind all --write`, pinned) on a release cut
   from the merged tree, then `engine/quarantine.js`. These are the only runs that can move the gate reading from
   "2 of 10". I ran named rows only.
2. **The roster items stage in full** (`tests/roster.js --stage items --reds --write --release <id>`). I ran the
   single rule only; the other 21 anchors were not re-run here.
3. **The census** (`node tests/test-mechanics.js`). The engine change is two knobs, both default off, so I expect no
   movement, but it is not measured. The count stays at the published 967 live / 0 missing.
4. **The published move rows other than the nine.** The reader changes can only add resolution, and on the
   published artifact all 497 moves are resolved on the authority and 488 on ours, so no row can flip down. That is
   argued from the code and not measured over 497 rows.
5. **Narration, not engine:** our engine still writes no `swap`, `-swapboost`, `-invertboost` or `-singlemove`, no
   `[from]` on a called move, and no `[spread]`. The first four are declared in `data/protocol-events.json`. The
   `-singlemove` reason there ("Destiny Bond / Grudge are not modelled") is stale, because the volatile IS modelled.
   I did not check whether the whole-game reducer compares a called move's `[from]`.
6. **Destiny Bond's KO-the-killer half** is not exercised by its staged row. The row proves only the volatile.
7. **Anger Point against a same-hit secondary drop** (+6 ours, +5 authority, from the d92b report) is still open,
   and it still has no failing probe.
8. **Regenerator's planner fixture** still observes `species` (the `carrier-switches-out` block's leaf, which
   belongs to Zero to Hero). Its row falls back to legacy FIRED, as published. Not changed here.
