# Entry order — the report the interrupted pass owed. 2026-08-24

An earlier agent was fixing how Pokémon act when they walk onto the field. It was cut off twice by
connection errors and never wrote this up. Its work was sitting in the tree, uncommitted. I checked
it as if a stranger had written it, finished it, and this is the account.

**Short version: the work was sound, it was one test short of finished, and I found and fixed the
gap plus one more real defect.**

---

## 1. What state I found it in

Two files had been changed and not committed: the simulator (`engine/medicham2-browser.js`) and the
census (`tests/test-mechanics.js`). Three claims came with them. I checked each.

| Claim it made | Verdict |
|---|---|
| Both places that sort arriving Pokémon are wired to the new code | **True.** Neither is dead. Counted over 120 real games below. |
| Nothing is left dangling | **True** for the engine. **FALSE for the tests** — see §2. |
| A real bug was fixed: the battle was building its dice twice from one seed | **True and correct.** One call now, and the two dice it hands out come off different streams. Built twice, they would have produced the same numbers in lockstep. |

### The one thing it broke and did not notice

`tests/test-resolution-order.js` deliberately breaks the engine in twenty-six small, named ways and
checks each break makes the right thing go wrong. One of those breaks pointed at a line of code the
new work had deleted. So the break could not be applied, and **the test was red.** It reported
`PLANT FAILED … anchor matched 0 times`.

That is the safety net doing exactly its job, and it is the whole reason the brief said to check
this work like a stranger's. **I re-pointed the break at where that behaviour now lives and the test
is green again**, with the arm that must fail still failing and the arm that must not still passing.

---

## 2. The hazard I was told to check: did it add a second coin?

**No. It reads the shared coin.** There is one place in this project where "who goes first when two
Pokémon are exactly as fast" is decided, and both simulators are wired to the same one so a
comparison between them stays honest. The new code asks for that same coin
(`MED_TIE_RNG`, fed only from the shared `tie` stream) and nowhere else. When the comparison harness
pins that coin flat, the new code produces the same order every time, which is what a pinned coin is
supposed to mean.

Measured over 120 real games rather than argued: **the coin was in scope every single time**
(`entryOrderTieNoDie = 0`), and it was actually used 237 times.

---

## 3. Re-proving the fix from scratch

I did not trust any reading taken before the interruption.

**The claim.** When two Pokémon arrive at the same speed, Pokémon does not simply keep them in the
order they were listed. It runs a particular kind of sort whose swaps can shuffle *untied* Pokémon
past the tied pair, leaving the tied pair reversed. A plain sort cannot produce that order.

**The demonstration.** Four Pokémon lead. One brings rain, one brings sun. Whichever resolves *last*
owns the sky for the rest of the battle, and the sky multiplies every attack.

| Rain-bringer's speed | Real Pokémon says | Our simulator says |
|---|---|---|
| 113 — no tie | **sun** | sun |
| 112 — an exact tie | **rain** | rain |

I staged both arms in the official simulator myself before believing the engine. The tie flips the
sky. The control (113) does not move, which is what says the fixture is staging what it claims.

**Knob check.** With the old behaviour restored (`MEDI_ENTRY_STABLE_SORT=1`) the tied arm answers
sun — wrong — and the control still answers sun. So the switch really is wired to the thing being
tested.

**A wider sweep, because one board is one board.** 625 boards: the same four Pokémon, every
combination of four speeds, with the tie sitting across the two sides.

- current engine: **0 of 625 disagree** with the official simulator
- old behaviour restored: **30 of 625 disagree**

And the 30 are the exact shape of the bug that was reported from real games:
`|-unboost| Archaludon` against `|-weather| rain`. **That was the "Intimidate before Drizzle"
divergence, and it is fixed.** It is gone from the pool run in §6.

---

## 4. The two "unambiguous" jobs from the brief

### Switch-in priority — already done, nine days ago

The brief said there was an open finding that we do not model this at all. **That finding is
stale.** It was closed on 2026-08-22. The engine reads the priority out of `data/switchin-order.json`
and applies it at both entry sites.

I re-derived the list from the format myself rather than trusting the file:

```
16 abilities declare a switch-in priority; 5 of them have a Pokémon in this format that can carry it
  +1  Klutz (3 carriers)      +1  Unnerve (6)
  -1  Mimicry (1)
  -2  Forecast (4)            -2  Hospitality (2)
Intimidate (19 carriers) and Drizzle (2) declare none — they sort on speed alone.
```

That matches `data/switchin-order.json` exactly. The brief's "7 declare" counted Zero to Hero and
Imposter; those two declare nothing here (I checked — both read `undefined`), they hang off a
different hook.

**Proved live against the official simulator, with a knob that moves.** Same board, same speeds, the
fastest Pokémon on the field:

- carrying **Hospitality** (priority −2): resolves **last**, after a much slower Intimidate.
- carrying **Drizzle** (priority 0): resolves **first**.

Both engines agree on both arms. Over 120 real games the priority key decided the order 60 times, so
it is not decoration.

### Intimidate before Drizzle — fixed by the entry-order work

Covered in §3. Neither ability declares a priority, so it was pure speed order on an exact tie, and
the old sort got it backwards. It is not a separate defect. There is no such row left in the pool.

---

## 5. Boost reactions — three checked, one was wrong, and I fixed it

The brief asked whether we handle three things the way the real game does. I staged all three
against the official simulator on the same board.

| | State | Message order |
|---|---|---|
| **Defiant** (Kingambit) | correct | **correct** — the first Pokémon's Defiant fires *before* the second one is touched, exactly as the real game interleaves it |
| **Competitive** (Milotic) | correct | correct |
| **Mirror Armor** (Corviknight) | correct | **WRONG — a missing line** |

**Mirror Armor sends a stat drop back at whoever caused it. We were doing that, and saying nothing
about it.** The real game prints `|-ability| Corviknight | Mirror Armor` immediately before each drop
it sends back — one line per stat, so Parting Shot (which drops two) prints two. We printed none, so
the attacker's own stat fell in the log with nothing explaining why.

I wrote the probe first and watched it fail, then fixed it, then re-checked against the official
simulator — Parting Shot into Mirror Armor now matches line for line, including the doubling.

*(My first version of that probe was wrong, not the engine: I asserted the line would be at position
0 when the Intimidate announcement is already there. Caught by comparing to the real simulator rather
than to my own expectation.)*

**Honest caveat:** the whole-game comparison strips `|-ability|` lines by design, so this fix cannot
show up there. It is proved by the census probe and by the direct comparison, and by nothing else.

---

## 6. The numbers

Everything below names its arm and its pins. All of it was re-measured on this tree; nothing is
carried over.

### Must not move — did not

```
damage differential      0 of 6000 disagreements, seed 20260804
                         and 0 of 6000 at every one of the 16 corners of the damage roll
census                   667 -> 668 live, 668 probed, 0 missing, 0 threw
                         (the one added probe is the Mirror Armor announcement)
```

### Whole game — a RE-BASELINE, not a delta

Arm **middle**. Release **`8b083baf2890`** (fresh, cut on this tree). Team pool
`data/team-pool-frozen`. Census pinned to `data/verification/census-pin-9446a684709d.json`.
The pool holds **961** game pairs, so `--games 1200` plays 961; the standing figures were taken the
same way.

| | standing (`6875293c5159`) | now (`8b083baf2890`) |
|---|---|---|
| raw parted | 48 | **46** |
| **board-material** | **24 games / 23 causes** | **24 games / 23 causes — UNMOVED** |
| narration-only | 24 games | **22 games / 20 causes** |
| declared (nothing to fix) | 13 | 13 |

**Board-material did not rise.** That was the stop condition and it held. Two narration divergences
went away and none appeared.

### Which scoreboard, said before the run

Entry ties are a **pool** mechanic — they happen on turn one of a real game — so I expected the pool
to move, and it did (48 → 46). The Mirror Armor announcement is a **lab** mechanic here, because the
pool comparison deletes ability announcements before comparing; I expected the pool to sit still on
that one and it did.

### Counters, over 120 real games

```
entryOrderUnranked      = 0     a caller bug detector — must be 0, and is
entryOrderTieNoDie      = 0     the shared coin was in scope every time
entryTieResolved        = 237   the new sort met real ties; it is not dead code
switchInPrioritySeparated = 60  the priority layer decided real orderings
statDropReflected       = 2     Mirror Armor fired, so the new line is exercised
entryStableSortRestored = 0     the old-behaviour knob was off, as it should be
```

### Every ENGINE instrument, re-run green

`test-mechanics` · `test-engine-diff` · `test-resolution-order` (was red, fixed) ·
`test-speed-tie` · `test-protocol-trace` · `test-volatile-duration` · `test-bracket-regain` ·
`test-encore-fail-silent` · `test-engine-consistency` · `test-wiring` · `test-end-state` ·
`test-middle-identity` · `test-immunity-gate` · `test-tag-params-derived` · `test-mc-seal` ·
`test-roster-arm-pin` · `test-damage-roll-support` · `test-entry-effects`.

---

## 7. Observed, not caused, not fixed

`tests/test-rollout-effects.js` reports 6 failures and exits 0 (so it is not a gate). All six name
things that **do not exist in this format** — Dark Void, Vital Throw, Lovely Kiss and Poison Gas are
`isNonstandard: 'Past'`, and Full Metal Body and Guard Dog have **zero legal carriers**. It is
walking mainline data. Pre-existing, unrelated to this pass, left alone and reported.

---

## OWED, NOT RUN

- **The deliberate roster** (`tests/roster.js`, three stages) is stale — it was measured against the
  previous engine release, so `status.js` withholds it. Re-running it is the largest remaining piece
  and it needs `--stage items`, `--stage abilities`, `--stage moves`.
- **`tests/interaction_matrix.js`** — last run 2026-08-11, before several engine releases.
- **The two remaining wrong sorts** — the mega phase and the residual still use a plain sort where
  the real game uses the tie-resolving one. This is card 3 of
  `docs/_reports/2026-08-24-ordering-cards.md` and it is **Will's call whether to take them as one
  batch or two**, so I did not touch them.
- **The other three cards in that file** are also Will's and are not answered here.
- The `|-ability|` line I added is invisible to the whole-game comparison by construction. If the
  narration gate ever stops stripping ability announcements, this becomes measurable there too.

---

## What I did NOT claim

No strength gain. ENGINE cannot measure one. Landing the mechanics is the result.
