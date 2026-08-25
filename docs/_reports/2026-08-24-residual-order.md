# End-of-turn order — the last of the four speed sorts. 2026-08-24

Will asked for one thing: **the end of a turn has to resolve in the order the real game resolves it
in.** His reason was a board — two Pokémon on lethal end-of-turn damage, and whichever the game
handles first faints first. He worked out that this can decide who wins, and he is right: it does,
and the two engines were giving **different winners on the same board**.

**Short version: it was wrong, it is fixed, and I have a staged game where our answer flipped from
"B wins" to "A wins" to match the real simulator. The two Tailwind messages did NOT clear, and that
is a real finding rather than an excuse — the reason is in §5.**

---

## 1. What the real game does, read off the source rather than recalled

The end of a turn is **two** sorted lists, not one.

- **The clock list.** `fieldEvent('Residual')` (`sim/battle.ts:484-506`) gathers every end-of-turn
  effect on the field — the weather, each side's screens and Tailwind, and per Pokémon its status,
  its item, its ability and each of its temporary conditions — and sorts **the whole thing once, at
  line 505, before it walks it.**
- **The weather chip.** Sandstorm's own handler calls `eachEvent('Weather')` (`:465-468`), which
  sorts a list of exactly **the four Pokémon on the field**, in the order p1 slot A, p1 slot B, p2
  slot A, p2 slot B.

Both use `Battle#speedSort` (`sim/battle.ts:429-459`), and its five keys are order, then priority,
then **Speed**, then sub-order, then a creation counter. That last key is filled **only** for
switch-in and redirection events (`:993-999`) — so at the end of a turn two effects that match on
the first four are **completely tied**, and the game breaks the tie by shuffling them.

**And `speedSort` is a selection sort.** It repeatedly finds the next thing to place and **swaps** it
into position with whatever was standing there. If the thing it pulls forward came from *behind* a
tied pair, the front half of that pair is thrown to the back — **behind its own partner.** An
ordinary sort cannot produce that order, whatever comparison you give it. That is the same fact the
move queue learned in 3.74.0 and the entry pass and the mega phase learned earlier today. The end of
the turn was the last place still using an ordinary sort.

## 2. Why this is not just about message order

`checkWin` (`sim/battle.ts:2603`): when **both** sides run out of Pokémon at the same moment, the
game is **not** a draw — it is given to *"the side of the body that fainted last"*. The list of
faints is filled in exactly the order the end-of-turn walk resolves things.

So the sort picks the winner. It is not narration.

## 3. The board, and what each engine said

Perish Song counting down on four Pokémon with nothing left in the back, so all four go at once.
I put it through the official simulator first, with its coin held flat so that what I was reading was
the **sort** and not luck.

| on the field, in list order | Speed |
|---|---|
| p1 slot A — Absol | 95 |
| p1 slot B — Primarina | 91 |
| p2 slot A — Primarina | **91 — an exact tie** |
| p2 slot B — Gengar | 130 |

```
the real simulator   Gengar, Absol, p2's Primarina, p1's Primarina   -> p1's faints LAST -> A WINS
ours, before         Gengar, Absol, p1's Primarina, p2's Primarina   -> p2's faints LAST -> B WINS
ours, after          Gengar, Absol, p2's Primarina, p1's Primarina   -> A WINS  (matches)
```

**The two engines disagreed about who won the game, and now they agree, line for line.**

I also read the real simulator's own internal list on that board (by instrumenting its sort). It
holds **exactly the four Perish Song entries and nothing else**, which is what says the tie was
decided by the swap and by nothing else.

### The controls, and the switch that puts the bug back

- Slow p1's Primarina by three points — no tie — **A wins**, both engines, before and after.
- Slow p2's Primarina instead — no tie — **B wins**, both engines, before and after.

The two controls answer **opposite** winners, which is what says the board is actually sensitive to
the thing being tested. Only the exact tie ever disagreed.

`MEDI_RESIDUAL_STABLE_SORT=1` puts the old sort back. Under it the census probe goes **MISSING** and
the tied board answers B again; the two controls do not move. So the switch is wired to the fix and
to nothing else.

Census probe: `move/perishClock — a residual SPEED TIE is broken by the authority's selection sort,
and it picks the WINNER of a double wipe`.

## 4. The coin is the shared one

There is one place in this project that decides who goes first when two Pokémon are exactly as fast,
and both simulators are wired to it so that a comparison between them stays honest. The new code asks
that same coin and nowhere else — no second source, which was the specific hazard the entry pass
nearly introduced.

**One detail is load-bearing.** The real game sorts its clock list once and walks it. Ours re-asks
for the order at each stage of the walk, on purpose, because Speed can change during it (Speed Boost
is itself an end-of-turn step). So the coin is drawn **once per end of turn** and remembered — if it
were drawn per stage, one tied pair could come out one way early in the walk and the other way later,
which is an order the real game cannot produce.

## 5. The two Tailwind messages did NOT clear — and here is why, staged

The brief said these two should be removed by this fix rather than excused. **They were not, and I
can show why rather than assert it.**

Both sides' Tailwind runs out on the same turn; the real game prints p2's first and we print p1's.
I built that board from scratch and swept four versions of it:

| the board | real simulator | us |
|---|---|---|
| bare — nothing else ending that turn | p1 then p2 | p1 then p2 |
| Leftovers on everything, fastest body on p1 | p1 then p2 | p1 then p2 |
| no Leftovers, fastest body on p2 | p1 then p2 | p1 then p2 |
| **Leftovers on everything AND the fastest body on p2** | **p2 then p1** | p1 then p2 |

Only the fourth arm parts, and the mechanism is now plain: the two Tailwinds are tied, and their
final order depends on the swaps made while the *Leftovers* entries were being placed — entries that
belong to Pokémon, not to sides, and that sit in between the two Tailwinds in the real game's list.

**Our end-of-turn walk does not have that list.** It walks *Pokémon*, stage by stage, and handles the
side and field clocks separately; it does not know which individual effects a given Pokémon is
carrying. So it reproduces the weather chip **exactly** (that list really is just the four Pokémon),
and it reproduces a clock stage exactly **when the tied things are the whole of what is in play** —
which is the Perish Song board in §3, and is not the Tailwind board.

Fixing the Tailwind pair therefore means teaching the engine to build the real game's full
end-of-turn list, effect by effect. That is a different and much larger piece of work than this one,
and it is written down as owed rather than done. The same limitation applies to two screens expiring
on both sides in the same turn.

## 6. The numbers

Everything re-measured on this tree. Nothing carried over.

### Must not move — did not

```
damage differential   0 of 6000 disagreements, seed 20260804,
                      and 0 of 6000 at every one of the 16 corners of the damage roll
census                686 -> 687 probed / 687 live / 0 missing / 0 threw
                      the one added probe is the one in §3
```

### Whole game — a RE-BASELINE, and it did not move at all

Arm **`middle`**. Release **`ffdec64bed0c`** (fresh, cut on this tree). Team pool
`data/team-pool-frozen`. Census pinned to `census-pin-9446a684709d.json`. `--games 1200` is a pair
budget; the pool holds **961** pairs, so 961 games played — the same way the standing figures were
taken, and the pin digest matches the standing run's (`6a6b87eafc6a`) so the two are comparable.

| | standing (`f9ff2b031d93`) | now (`ffdec64bed0c`) |
|---|---|---|
| raw parted | 35 | **35** |
| **board-material** | 18 games / 17 causes | **18 games / 17 causes** |
| narration-only | 17 games / 16 causes | **17 games / 16 causes** |

**Game for game, the same 35: nothing cleared and nothing new.** That is a measured null result, not
an assumption — the two artifacts were compared by `config|seed`.

**And this was the expectation, stated before the run.** A residual speed tie that changes a compared
line is a lab mechanic; the pool comparison never asks who won, and a tied pair only comes out
differently when a faster body sits behind it in the list. Board-material did not rise and narration
did not rise, which were the two stop conditions.

### The new code is not dead — counters over 120 real pool games

```
residualGroupsWalked      = 32880   the end-of-turn walk ran
residualTieResolved       =  4087   the new sort MET a real speed tie this many times
residualTieLargestGroup   =     2   every one of them was a pair
residualOrderTieNoDie     =     0   the shared coin was in scope every time
residualStableSortRestored=     0   the old-behaviour switch was off, as it should be
```

Ties are **common** at the end of a turn — 4,087 of them in 120 games — and the pool still did not
move. Both facts are true and they are not in tension: meeting a tie is not the same as the tie
coming out in a different order, and a different order only shows up in the pool if it changes a line
the comparison actually reads.

### The four artifacts a moving engine withholds — all four re-run

| | verdict |
|---|---|
| deliberate roster / items | **0 FIRED-AND-BOARDS-DIFFER, 0 DID-NOT-FIRE**, 139 of 148 tested |
| deliberate roster / abilities | **0 / 0**, 130 of 202 tested |
| deliberate roster / moves | **0 / 0**, 475 of 500 tested |
| `all_mechanics_fire --kind all` | **9 STATE rows, the SET identical to the standing run** — zero cleared, zero new |

All four stamped with release `ffdec64bed0c`. The gate is back where it was.

### Every ENGINE instrument, re-run green

`test-mechanics` · `test-engine-diff` · `test-speed-tie` · `test-resolution-order` ·
`test-engine-consistency` · `test-volatile-duration` · `test-end-state` · `test-bracket-regain` ·
`test-encore-fail-silent` · `test-wiring` · `test-middle-identity` · `test-immunity-gate` ·
`test-tag-params-derived` · `test-mc-seal` · `test-roster-arm-pin` · `test-damage-roll-support` ·
`test-entry-effects` · `test-protocol-trace` · `test-mega-timing` · `test-forme-assert` ·
`test-nature-differential` · `probe_selfdestruct_winner`.

`probe_selfdestruct_winner` matters most of the twenty-two: it is the file that owns "who wins when
both sides empty at once", two of its five boards are Perish Song boards, and all five still agree
with the real simulator and still go red on demand under their own deliberate break.

## 7. What changed in the code

`engine/medicham2-browser.js`, two places:

- `residualOrder()` now runs the authority's selection sort with the shared tie coin, behind
  `MEDI_RESIDUAL_STABLE_SORT`. Four new counters.
- one line at the top of the end-of-turn phase bumps the generation the coin is remembered against.

`tests/test-mechanics.js`: one probe, §3.

**The hand list in `docs/ENGINE.md` is unchanged, and that is correct rather than an omission.** It
holds one item, Rivalry, and has held only that for weeks. The residual sort was never on it — it was
judgement card 3 of `docs/_reports/2026-08-24-ordering-cards.md`, which Will answered directly. Card 3
is now closed on both halves: the mega phase this morning, the residual here.

## 8. Observed, not caused, not fixed

- **`planted_state_proof_ok` reads false**, so the run prints *"every state number below is
  worthless"*. Seven plants read NOT CAUGHT and six benched-body plants NOT APPLIED. **Byte-identical
  in the committed standing artifact** — I checked rather than assumed, because a plant named *"a
  Perish count off by one"* is exactly the kind of thing this pass could have broken. It did not; it
  was already failing before.
- **A perish death's `|faint|` sits one line from where the real game puts it** relative to
  `|upkeep|`. Present on the staged board in both the tied and untied arms and under the old sort as
  well, so it is pre-existing and not this pass's. It does not change any board.
- `tests/test-rollout-effects.js` still reports 6 failures and exits 0; all six name things that do
  not exist in this format. Pre-existing, unrelated, left alone.

## OWED, NOT RUN

- **The full end-of-turn list.** §5. Two Tailwind rows in the pool need it, and so would two screens
  expiring on both sides at once. Not attempted; the mechanism is staged and reproducible above.
- **`tests/run-all.js` in full.** The ENGINE instruments were run individually and are listed above.
- `tests/interaction_matrix.js` — last run 2026-08-11, before several engine releases.
- `tests/mutation_harness.js` — still needs `--gate-only --no-write` wiring.
- `engine/selftest.js`, `engine/conformance.js`, `engine/feature_fixture.js --check` — all three were
  RED at HEAD before this batch and are not this batch's.
- The end-of-turn walk still re-derives Speed at each stage while the real game freezes it at the top
  of the walk. That can only differ if something changes Speed mid-walk (Speed Boost is a late
  stage). **No probe fails on it and none was written.** Named, not claimed fixed.

## What I did NOT claim

No strength gain. ENGINE cannot measure one. Landing the mechanic is the result.
