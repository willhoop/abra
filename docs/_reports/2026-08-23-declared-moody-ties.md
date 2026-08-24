# Declared divergences — Moody landed, speed ties refused

MEASURE, 2026-08-23. Artifact read: `data/game-differential.json`, release `a7839b20e7d5`, mode
`A/middle/pins:6a6b87eafc6a`, 961 games, 48 diverged, generated 2026-08-24T03:04:50Z. A byte copy was
taken before any work and every number below was computed against that copy, because an ENGINE agent
was live in the tree. The live file did not move during the session (mtime 23:04 throughout).

**Nothing was run that plays a game. The differential was not re-run by MEASURE.**

**THE ARTIFACT MOVED UNDER THE MEASUREMENT AND IT WAS CAUGHT, AND THE NUMBERS REPRODUCED.** The live
ENGINE agent rewrote `data/game-differential.json` at 04:02:15Z, on a NEW release `6875293c5159`, while
this work was in progress. The byte copy taken at the start is what every figure below was computed
from. Re-reading the fresh artifact afterwards gives the SAME clause result — 961 games, 48 diverged,
13 declared (8 INCOMPARABLE / 5 AUTHORITY-WRONG), 35 undeclared — so the declaration reproduces across
two independent runs on two different releases rather than resting on one. That is stated because
CLAUDE.md's rule about torn reads is exactly this shape, and "I checked" is only worth something when
the check is written down.

---

## 1. The verdict in one table

| row | kind | games | landed? |
|---|---|---|---|
| Moody's stat pick | INCOMPARABLE | 8 | **yes** |
| Speed tie / tie-break coin flip | — | 3 | **NO — refused, see §3** |
| Supreme Overlord `fallenundefined` | AUTHORITY-WRONG | 5 | already there |

Clause numbers, computed by driving `wholeGameClause()` directly against the artifact copy on
`HEAD`'s `quarantine.js` and on the edited one:

```
BEFORE  ok=false  games=961  diverged=48  declared=5   undeclared=43
AFTER   ok=false  games=961  diverged=48  declared=13  undeclared=35
                                          INCOMPARABLE=8  AUTHORITY-WRONG=5
```

`diverged` (48) and `declared` (13) both still print, split by kind, and the verdict string still
reads `48 raw, less 13 declared and 0 cleared on decision impact`. The allowance is legible, not
absorbed. The clause is still RED and nothing here was capable of opening it.

---

## 2. Moody — declared, and what the matcher refuses

### The derivation, read at the line

- `pokemon-showdown/data/abilities.ts:2691-2716`. Two `this.sample(stats)` draws: `+2` on one stat,
  `-1` on another. Both loops `continue` on `accuracy` and `evasion`; both exclude stats already at
  the cap; the second excludes the stat the first chose. **Champions does not override it** —
  `data/mods/champions/abilities.ts` has no `moody` entry.
- `engine/medicham2-browser.js:25831`. Draws over `['at','df','sa','sd','sp']` — the same five, no
  accuracy, no evasion — `+2` then `-1`, second pick excluding the first, capped stats excluded, via
  `rng()`. So Will's condition (*"as long as we genuinely model a random chance its fine"*) is met and
  his second point (*"no accuracy or evasion (anymore)"*) is already implemented on both sides.
  **The rule is not in dispute. Only which stat the die names is.**

### Why the die has no shared address

The middle arm addresses a draw as `[seed, turn, category, move, target]` **plus an occurrence
index** (`midEventDraw`, `medicham2-browser.js:15712`). A residual `sample()` belongs to no named
category on either engine, so both take it off the generic `any` stream — at an occurrence index each
engine fills with its own unrelated draws (target selection, chooser coins, status timers, forme
cycles on our side; whatever is not acc/crit/sec/dmg on theirs). The indices cannot line up.

Six streams are shared or neutralised: `MID_CATS = ['acc','crit','sec','dmg','stall']`
(`engine/game_differential.js:699`) and `tie` (`o.tie = () => 0`, `:1182`). This is not one of them.

**Corroboration, derived rather than recalled:** in the pinned corner arms a Moody divergence is
impossible. `pinRandom` returns `top ? m-1 : 0` and medicham2's `_pick` reads the same end of the same
list, so both engines take index 0 (bottom) or the last index (top). A Moody divergence can only exist
in the arm with real dice, and that is where all 8 of these are. *(This is the mechanism behind the
"8 in middle, zero in either corner" split quoted in the brief. This artifact ran the middle arm ONLY
— `pins.arms_run: ["middle"]` — so the corner half is derived from the pin code, not measured here.)*

### The row is revisitable and says so

The `why` states plainly: *"IT IS THE INSTRUMENT'S ADDRESSING, NOT A LAW: give the residual pick a
named stream on both sides, the way ROADMAP #290 did for `tie`, and this row must be deleted rather
than kept."* This is the honest form of "permanent until a run shares a sixth die".

### What the matcher deliberately does NOT match — all demonstrated

Each of the following is a real defect wearing the same cause shape. Every one was injected through
the shipping `wholeGameClause` and every one fell through to UNDECLARED (`declared=0`), holding the
gate shut. **These negative cases are the proof, not the positive one.**

| mutation | result |
|---|---|
| `evasion` in the pool | undeclared |
| `accuracy` in the pool | undeclared |
| raise magnitude `+3` instead of `+2` | undeclared |
| drop magnitude `-2` instead of `-1` | undeclared |
| our line not attributed to Moody | undeclared |
| two occurrences, only one attributed to Moody | undeclared |
| the authority attributes its boost to a different effect | undeclared |
| the boost immediately follows that slot clicking a MOVE | undeclared |
| a different slot on each side | undeclared |

Control: the unmutated cause declares. All nine are permanent assertions in
`node engine/quarantine.js --selftest` (**108 passed, 0 failed**).

---

## 3. Speed ties — REFUSED, and this is the finding of the session

**The brief's derivation is correct about the GAME and false about this HARNESS, and only the
harness's number reaches this clause.**

Yes, `pokemon-showdown/sim/battle.ts:429` `speedSort` collects the tied group and ends with
`this.prng.shuffle(list, sorted, sorted + nextIndexes.length)` at `:455-457`, and in a real battle a
tie is an actual coin flip. But the whole-game differential does not run real dice on that coin, **on
either side**:

1. Showdown's shuffle is replaced by a **no-op** in every shipped arm — `pinShuffle`,
   `sdShuffleReverses` false everywhere (`engine/game_differential.js:1085`).
2. medicham2's tied-group key has had **its own named stream** since 2026-08-20:
   `RNG_STREAMS = ['acc','crit','sec','dmg','stall','tie']` (`medicham2-browser.js:15613`, ROADMAP
   #290), and the middle arm neutralises it with `o.tie = () => 0` (`game_differential.js:1182`) —
   the comment there says in as many words that this exists "because it is neutralised on the other
   side".
3. The tie was **fixed at the root in 3.74.0**: medicham2 runs the authority's own selection sort and
   resolves the residual group with the key it already drew. The two `tie-second` arms were RETIRED
   for "breaking a correct one" (`game_differential.js:1229-1256`).

**So the sixth die this declaration would have claimed does not exist is already shared.** A cause
that still diverges with both tie-breaks pinned is a real disagreement — a queue built in a different
order, or a speed the probe read as equal at the turn boundary that was not equal when the queue was
built. The probe's own artifact calls an EQUAL reading weak evidence for exactly that reason.

Declaring it would have subtracted a live turn-order defect under a heading reading "nothing to fix" —
the `medicham2-browser.js:17440` failure (a declaration that hid per-target spread accuracy for weeks)
repeated with a better-sounding reason.

**The 3 games stay UNDECLARED.** The withdrawal is written into `engine/quarantine.js` as a comment
where the row would have gone, matching the file's `drag: a different body` precedent, and asserted in
the selftest at gap 0 *and* gap 40 so re-adding the row goes red.

Will's ruling was about the game and it is right about the game. It does not reach this artifact.

---

## 4. The heading had to be widened, and the two kinds print apart

The old single heading read *"matching the authority here would make this engine LESS correct, so
these do not count"*. That is not why Moody qualifies — matching would not be wrong, it is **not
comparable**. Two headings now, each with its own count, never summed:

```
  DECLARED / IMPOSSIBLE TO COMPARE — the authority makes a RANDOM DRAW at an address this
  harness does not share ... NO DEFECT, NOTHING TO FIX:  [8 game(s), 1 row(s)]
  DECLARED / THE AUTHORITY IS WRONG — matching it here would make this engine LESS correct,
  so these do not count:  [5 game(s), 1 row(s)]
```

Machine-readable as `declared_by_kind: {INCOMPARABLE: 8, "AUTHORITY-WRONG": 5}` on the clause result.

---

## 5. The third kind (DEFERRED) — NOT built, and the hole is nailed shut

Per the brief, the deferred mechanism is **not implemented**. What *is* implemented is the guard that
makes not implementing it safe:

`DECLARED_KINDS` is a whitelist of exactly the two kinds above. A row carrying any other `kind` —
including `'DEFERRED'` — is **not subtracted**, is counted as UNDECLARED, and is **named on the run**
through the same channel a matcher that throws uses. Asserted in the selftest: a pushed
`kind: 'DEFERRED'` row with `match: () => true` yields `declared=0, undeclared=1, ok=false` and appears
by name.

So the coordinator's most important line holds by construction: **a deferred entry cannot make the
clause pass.**

### Proposal, if the deferred kind is ever wanted

- **Separate printer, separate count, opposite words.** Heading must say `A REAL DEFECT, KNOWINGLY NOT
  FIXED`, with the count on the same line, so `0 real defects deferred` is readable at a glance.
- **It must NOT be subtracted from `div`.** Print it beside the verdict, never inside it. The clause
  keeps passing on `undeclared === 0` with deferred rows counted in `undeclared`. Anything else
  re-creates *"one of the two known failures"*.
- **Every row must carry a derived relevance number** — a usage figure from `reachOf`/`usageIndex`, or
  a game count from the artifact — computed at run time, never typed. The existing `REACH_SHELF_CLICKS`
  = 25 threshold is the project's number; do not invent a second one.
- **Every row must carry an open ROADMAP row number**, validated through `roadmapRowIsClosed` (already
  exported for exactly this kind of sharing), so a row whose ticket got closed goes red instead of
  going quiet. That is the "way back" and it uses the mechanism that exists.

---

## 6. OWED, NOT RUN

1. **The 3 probed speed-tie divergences are unexplained and undeclared.** Someone must find out
   whether they are a queue-order defect, a speed that was not actually equal at queue-build time, or
   the `tie` neutralisation failing to reach a path. Proposed roadmap row in §7.
2. **The rest of the `ordering` class was not examined.** 14 games, 13 distinct causes; the order probe
   covers move-vs-move pairs only (3 of them). Switch ordering and residual ordering carry no probe and
   were therefore not declarable on any evidence — correctly, but they are also not explained.
3. **The corner-arm half of the Moody claim is derived from the pin code, not measured.** This artifact
   ran `middle` only. A multi-arm run would measure it.
4. **Moody's agreement rate was not measured.** The differential records only the FIRST divergence per
   game, so 8 is a floor on disagreements and says nothing about how many Moody residuals agreed. If
   the residual pick is ever given a shared address, that is the number to watch.
5. **The differential was not re-run**, per the brief. If the ENGINE agent's re-run changes the cause
   set, all counts above change with it; the matchers do not.
6. **`tests/test-web-quarantine-loaders.js` is RED and it is not mine.** `app/` is dated 08-10 and
   `web/` 08-22; the bundle rebuild is owed to WEB (`node web/build-quarantine.js`). Reported, not
   touched. It was red before this session's edit — the app/web split predates it by twelve days.

---

## 7. Proposed roadmap row text (not filed — MEASURE does not edit ROADMAP.md)

> **Three speed-tie divergences survive a tie that is pinned on both sides.**
> `data/game-differential.json` (release `a7839b20e7d5`, middle arm) carries 3 `ordering` causes whose
> own `order_probe` reads `speed_tied: true, speed_gap: 0, same_priority: true`. Showdown's
> `PRNG.shuffle` is a no-op in every arm and medicham2's `tie` stream is neutralised to 0
> (`game_differential.js:1182`, ROADMAP #290), and 3.74.0 made medicham2 run the authority's own
> selection sort — so under this pin a tie must resolve identically and these must be zero. They are
> not. This was proposed as a DECLARED divergence on 2026-08-23 and **refused**: declaring it would
> subtract a live turn-order defect under a heading that reads "nothing to fix".
> VERIFIED BY: `node engine/quarantine.js --order-probe` reading zero, and the three causes absent
> from a re-run differential.
>
> **Consider giving the residual `sample()` a shared address, the way `tie` got one.**
> `Moody's stat pick` is declared INCOMPARABLE today because both engines draw it off the generic
> `any` stream at occurrence indices that cannot line up. 8 games of 961. If the pick gets a named
> stream on both sides the declaration must be DELETED, not kept — the row's `why` says so.

---

## 8. Files touched

- `engine/quarantine.js` — the only file changed. Widened block header; `DECLARED_KINDS` whitelist;
  `causeEvidence()` / `parseBoostEvent()` / `MOODY_POOL`; the Moody row; the withdrawn speed-tie row
  as a comment; the loop passes evidence to `match(cause, evidence)` and refuses an unknown `kind`;
  two-block printer with per-kind counts; `declared_by_kind` on the result; 15 new selftest
  assertions.

No CHANGELOG entry written (the coordinator owns it). No ROADMAP edit. No living-doc figures changed
— the clause verdict, the divergence count and the game count are all unmoved.
