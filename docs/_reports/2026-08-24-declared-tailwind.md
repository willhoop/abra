# The Tailwind pair was NOT declared — the incomparability premise failed at the lines

2026-08-24 · MEASURE · nothing was written to `engine/quarantine.js`

---

## Verdict

**Refused.** The two games were put forward as `DECLARED / IMPOSSIBLE TO COMPARE` — "Showdown flips a
coin for the order of the two `-sideend` lines and we have no shared address for that coin".

The first half of the case is true and the second half is not. In a **real battle** the order of the
two Tailwind ends is a coin flip. **In this harness the coin is switched off on both sides**, exactly
as it is for speed ties, and what is left is a deterministic, reproducible ordering disagreement
between two sort algorithms. Declaring it would have subtracted a live defect under a heading that
reads "NO DEFECT, NOTHING TO FIX" — the `medicham2-browser.js:17440` failure with a better-sounding
reason, and the same trap the speed-tie declaration was refused for on 2026-08-23.

**The board claim held. The incomparability claim did not.** Both are needed and only one survived.

---

## What is in the artifact

`data/game-differential.json`, release `b35e96a0e7c7`, generated 2026-08-24T21:20:29Z, one arm
(`middle`), 961 games. Read from a byte copy taken at 18:29 EDT
(sha1 `e1eac407df87d3ca2af320f8ca231735a9590c93`, verified identical to the live file at the moment of
the copy) so that an ENGINE agent re-running the differential could not tear the read.

```
ordering :: |-sideend|p2:|tailwind <> |-sideend|p1:|tailwind      n = 2
```

Both rows, in full:

| | game 1 | game 2 |
|---|---|---|
| config | `pair-speedctrl` | `pair-speedctrl` |
| showdown | `\|-sideend\|p2: B\|move: Tailwind` | `\|-sideend\|p2: B\|move: Tailwind` |
| medicham2 | `\|-sideend\|p1: \|move: Tailwind` | `\|-sideend\|p1: \|move: Tailwind` |
| lines agreed first | 47 | 47 |

In both games the six preceding Showdown lines show **both** sides clicking Tailwind and **failing**
(`|-fail|`), i.e. both side clocks were already up and running on the same schedule.

---

## The three checks that were asked for, at the lines

### 1. Are the two handlers tied on all five of the authority's sort keys? — YES, verified

`sim/battle.ts:404-411`, `comparePriority`, five keys in order: `order`, `priority`, `speed`,
`subOrder`, `effectOrder`.

| key | p1 Tailwind | p2 Tailwind | why |
|---|---|---|---|
| `order` | 26 | 26 | `data/moves.ts:18869` tailwind.condition `onSideResidualOrder: 26` |
| `priority` | 0 | 0 | no `onSideResidualPriority` declared → `\|\| 0` |
| `speed` | unset | unset | `findSideEventHandlers` passes no `customHolder`, so `effectHolder` is the **Side**; `resolvePriority`'s speed block is guarded on `(effectHolder as Pokemon).getStat` |
| `subOrder` | 5 | 5 | `data/moves.ts` `onSideResidualSubOrder: 5` |
| `effectOrder` | unset | unset | `sim/battle.ts:994` assigns it **only** when `callbackName.endsWith('SwitchIn') \|\| endsWith('RedirectTarget')`. The callback here is `onSideResidual`. |

The brief cited `sim/battle.ts:993-999` for the fifth key; the `if` is at **994** and the assignment
at **999**. The claim is correct.

`data/residual-order.json` — which is derived from the format, not typed — carries the same row and
says so in as many words: `"speedFrom": "none — the holder is a Side/Field and has no speed, so this
sorts as 0"`. Tailwind is also the **only** effect in the whole table at `order 26, subOrder 5`, so
the tied group is exactly these two handlers and nothing can be interleaved between them.

So the pair is genuinely tied, and `speedSort` does hand it to `this.prng.shuffle` at
`sim/battle.ts:456`. **Every citation in the brief checked out.**

### 2. Is that shuffle a live coin in THIS harness? — NO. This is where the case dies.

`engine/game_differential.js:1085` installs `pinShuffle` over `battle.prng.shuffle`
(`game_differential.js:2854`). It counts the call and then:

```js
if (!spec.sdShuffleReverses) return;      // ← every shipped arm. The shuffle is a NO-OP.
```

The artifact agrees, in its own metadata: `arms[0].showdown_shuffle: "identity in every arm"`, and
`speed_ties: { shuffle_calls: 58616, tied_groups_resolved: 58616 }` — 58,616 tied groups, every one
of them resolved by a no-op.

The other side is neutralised to match. `game_differential.js:1182`, ROADMAP #290:

```js
o.tie = () => 0;
```

with the comment stating the design outright: *"`pinShuffle` above is a NO-OP in every shipped arm …
so the authority NEVER re-orders a tied group and always keeps whatever permutation its selection
sort produced … The engine still resolves the group by its own selection sort, exactly as the
authority does; what is removed is a die the authority does not roll."*

**So there is no unshared draw here.** Both engines are deterministic on this pair. That is precisely
the finding that got the speed-tie declaration refused on 2026-08-23, arriving at a different
callback name.

### 3. Then why do they still differ? — an unstable selection sort against a stable one

The brief's staging claim was *"pinning the shuffle to the identity gives p1 first"*. **It does not,
and the artifact is the counter-example** — the shipped arm has the identity shuffle and Showdown
emits **p2** first. Demonstrated directly against the authority's own compiled `speedSort`, with no
game played and the shuffle a pure no-op:

```js
const {Battle} = require('<showdown>/dist/sim/battle.js');
const fake = { prng: { shuffle() {} },              // exactly what pinShuffle does
               comparePriority: Battle.prototype.comparePriority };
const T1 = {id:'T1 (p1 tailwind)', order:26, subOrder:5};
const T2 = {id:'T2 (p2 tailwind)', order:26, subOrder:5};
const X  = {id:'X (a body residual, order 5)', order:5, subOrder:0};
```

| list handed to `speedSort` | result |
|---|---|
| `[T1, T2]` | `T1 T2` |
| `[T1, T2, X]` | `X` **`T2 T1`** ← the tied pair came out **reversed** |
| `[X, T1, T2]` | `X T1 T2` |

`speedSort` is a **selection sort** (`sim/battle.ts:429-458`). Its swap step lifts a lower-`order`
element out of the middle of the list by exchanging it with whatever occupies the target slot — and
what occupied it was one of the tied pair. `sim/battle.ts:484-507` builds the residual list as
*field handlers, then p1's side clocks, then p1's bodies, then p2's side clocks, then p2's bodies*,
so p1's Tailwind always has body-level handlers (Leftovers, status chip, etc., all `order` well below
26) sitting **behind** it in the list. Case B above is that situation, and it reproduces the observed
`p2`-first exactly.

medicham2 does not do that. `engine/medicham2-browser.js:5823`:

```js
tw('twA','p1'); tw('twB','p2');
```

pushes the two jobs p1-then-p2 at the same published `subOrder`, and line 5860 sorts them with
`jobs.sort((a,b)=>a.sub-b.sub)` — `Array.prototype.sort` is **stable** since ES2019, so equal keys
keep insertion order. p1 first, always.

**This engine already diagnosed this exact class of defect and fixed it once.** WIRE 134,
`engine/medicham2-browser.js:11030`, on the turn queue:

> *"THIS ENGINE AND THE AUTHORITY HAVE DISAGREED ABOUT EVERY SPEED TIE FOR THE LIFE OF THE PROJECT,
> AND THE CAUSE IS THE SORT ALGORITHM RATHER THAN THE COMPARATOR. … A stable sort cannot produce that
> permutation from any comparator. SO THE ALGORITHM IS REPRODUCED LINE FOR LINE."*

The turn queue got the authority's selection sort plus a key-per-action draw. The **residual expiry
phase did not**, and this is the bill for that.

---

## The half of the brief that DID hold: nothing on the board differs

Re-verified, because the refusal does not rest on it but the roadmap row does.

- **Both Tailwinds end in both engines.** This is not an inference — it is what the class name means.
  `game_differential.js:3911` assigns `ordering` only when `sdLater && meLater`, i.e. **each side's
  line is found later in the other side's stream**. A missing or mistimed `-sideend` would classify as
  `event missing from medicham2` or as a plain mismatch, not as `ordering`.
- **Nothing runs between the two lines.** Tailwind is the unique effect at `order 26 / subOrder 5` in
  `data/residual-order.json`, so the tied group has exactly two members.
- **The list is sorted once, before the walk** (`sim/battle.ts:507`), then `shift()`ed — so an effect
  ending mid-walk cannot re-order anything after it.
- **The speed consequence lands next turn either way.** `updateSpeed()` runs at the *top* of the
  residual phase (`sim/battle.ts:2808-2811`, `case 'residual':`) and again in `commitChoices()`
  (`sim/battle.ts:2995-2996`). No speed is read between the two `-sideend` lines.

So this is narration-only. It is narration-only **and reproducible**, which is a roadmap row, not a
declaration.

---

## Clause numbers

Driven directly against the frozen artifact via the exported `wholeGameClause` — no game played, no
differential re-run.

```
ok false
games 961   diverged 37   declared 13   cleared 0   undeclared 24
declared_by_kind {"INCOMPARABLE":8,"AUTHORITY-WRONG":5}
matcher_threw []
```

**Before = after: nothing changed, because nothing was written.** Had the row landed it would have
read `declared 15 / undeclared 22`, and the clause would still be RED. The declaration was never
going to open the gate; it would only have removed two games from the count of things anyone is
looking for.

---

## The matcher that was written and then thrown away

For the record, so the next person does not re-derive it. It was drafted narrow — exact cause class
`ordering`, both halves parsed as `|-sideend|<side>:|tailwind`, sides required to be `p1`/`p2` and
different, and every `first_divergences` row for the cause required to carry `move: Tailwind` on both
engines. It would have refused a `-sideend` on a different turn, a single side ending alone, a
non-Tailwind side clock, and a missing line — because each of those either fails the cause-class test
or lands in a different class entirely.

**The matcher was fine. The claim it carried was not**, and a well-bounded matcher attached to a false
claim is worse than a sloppy one attached to a true one, because it looks careful.

---

## Proposed ROADMAP row (MEASURE does not own `engine/medicham2-browser.js`; not written)

> **The residual expiry phase resolves a tied group with a stable sort; the authority uses its
> selection sort. `-sideend` on the two Tailwinds comes out in the opposite order.**
> `engine/medicham2-browser.js:5823` pushes `tw('twA','p1'); tw('twB','p2')` and line 5860 sorts by
> `sub` with `Array.prototype.sort`, which is stable — so p1's side clock always spends first. The
> authority ties the pair on all five `comparePriority` keys (`order` 26, `priority` 0, no `speed`
> because the holder is a Side, `subOrder` 5, no `effectOrder` — `sim/battle.ts:994` assigns that key
> only for `SwitchIn`/`RedirectTarget`) and hands it to `speedSort`'s selection sort, whose swap step
> reverses the pair whenever a lower-`order` body handler sits behind it in the list. Under this
> harness's pin (`pinShuffle` is a no-op, `o.tie = () => 0`) the disagreement is deterministic and
> reproducible. **This is WIRE 134 on a second walk:** the turn queue got the authority's algorithm
> line-for-line plus a key-per-item draw; the residual walk did not. The fix is the same device — do
> not hardcode "take the later side", which is the pin's answer and not the game's rule. 2 of 961
> games on release `b35e96a0e7c7`; narration-only (both Tailwinds end either way, and no speed is
> read between the two lines), so this is a **narration-gate** row, not a board-material one.

---

## OWED, NOT RUN

- **Nothing was staged in a live battle.** The reversal was demonstrated against the authority's
  compiled `speedSort` with synthetic handlers, not inside a game. It reproduces the observed line
  order and it is not a whole-battle confirmation.
- **`game_differential.js` was not re-run** — the ENGINE agent owns the next run. The numbers above
  describe release `b35e96a0e7c7` at 21:20Z on 2026-08-24 and nothing later.
- **The list-composition claim is derived, not measured.** That p1's Tailwind always has lower-`order`
  handlers behind it follows from `fieldEvent`'s collection order at `sim/battle.ts:484-507`; it has
  not been instrumented on these two specific games.
- **Whether the other seven `ordering` causes in this artifact share this cause is unknown.** Five of
  them are `|move|…|protect` / `switch` pairs that smell like the same tied-group shape and were not
  investigated.
- **No CHANGELOG entry, no ROADMAP edit, no `status.js --write`** — the row above is proposed text;
  the coordinator owns both files this session.
