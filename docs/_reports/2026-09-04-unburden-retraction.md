# Retraction — "every body in this engine that loses an item gets Unburden's speed doubling"

2026-09-04. ENGINE. **Prose only.** No engine byte, no probe byte, no artifact byte and no run. The
census is untouched at **829 live / 829 probed / 0 missing**, read from `git show HEAD` and generated
`2026-09-04T03:12:47.158Z`. Files changed: `docs/ENGINE.md` (148 insertions, 16 deletions) and this
report. Nothing committed.

## The claim, and where it went

> *"every body in this engine that loses an item gets Unburden's speed doubling — a Knock Off, a
> consumed berry, a spent Focus Sash"*

Published in `docs/ENGINE.md` at `:206`, `:285-291` and `:325`, in `CHANGELOG.md` 5.245.0, in that
commit's message, and reported to Will as fact. **It is false.**

## Refuted three ways, each read on this pass

1. **The code.** `engine/medicham2-browser.js:14770` opens the block on `m._hadItem&&!m.item` — the
   ENTRY GUARD. The push is the next line, `:14772`:

   ```js
   const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)_mods.push(+_ub.speedMult);
   ```

   Nothing enters the speed-modifier chain unless the body's CURRENT ability carries the tag.
2. **The tag membership, derived here rather than recalled.** `data/tags.json` carries exactly **one**
   carrier of `speedOnItemLoss`: `unburden`. Five legal holders — Sceptile, Liepard, Slurpuff,
   Hawlucha, Sneasler — from `Dex.forFormat('gen9championsvgc2026regmb')` filtered on
   `exists && !isNonstandard && tier !== 'Illegal'`.
3. **A live census control that was already on record.** `data/mechanics-census.json` at HEAD,
   `{kind: "ability", tag: "speedOnItemLoss", label: "Unburden doubles Speed once the item is gone",
   live: true, armed: true}`, detail:

   ```
   [speed holding, speed once the item is gone] — ability none 187,187 (must not move); Unburden 187,374
   ```

   Same body, same item, ability off → **187,187, does not move**. With Unburden → **187,374**. The
   knob was cleared and the answer printed before the claim was ever written.

## The mechanism of the error

`tests/probe_leaf_widening.js:276`:

```js
const stand = m => (m && m._hadItem && !m.item) ? 1 : 0;
```

That value is reported as `medi`. **It is the probe's OWN stand-in — the guard on the OUTSIDE of the
block — never `effSpeed`'s Speed.** It was compared against the authority's `volatiles.unburden`, a
different quantity. So the observe arm's `medi="[1,1]" sd="[1,0]"` is two engines answering two
questions, and the `[1,1]` could not have read anything else: both bodies had lost an item, which is
the whole of what that predicate asks.

**A probe that reads the guard instead of the guarded quantity agrees with itself and then reports an
engine defect.** The general form worth keeping: *when an engine holds no named state, a leaf probe
must compare the CONSEQUENCE — here, Speed — because any stand-in it invents is its own hypothesis
wearing the engine's name.* This is the division's existing rule (test the OUTCOME, not the
classification) failing in a place it had not failed before: an OBSERVE arm, where a stand-in for
absent state feels like reading state.

## What is actually wrong — ROADMAP #535, narrower

The authority (`data/abilities.ts:5227-5249`; a recursive grep of `/data/mods/champions/` returns
nothing, so Champions overrides Unburden nowhere) adds a VOLATILE from Unburden's own
`onAfterUseItem` and `onTakeItem`, removes it in `onEnd`, and applies `chainModify(2)` only while
`!pokemon.item && !pokemon.ignoringAbility()`. The volatile records **who held the ability at the
moment the item went.**

This engine holds no state under that name and re-derives the answer from the CURRENT ability on
every `effSpeed` call. So a body that empties its hand and only AFTERWARDS acquires Unburden doubles
here and does not double there. **Skill Swap is the reachable door** — `a.kind==='abilityswap'`,
WIRE 110, `engine/medicham2-browser.js:27555` (ROADMAP #535 cites `:27556`; the line is `:27555`,
verified this pass — `:27556` is `m._lastMove=a.mv;`).

The switch-out half is already correct and separately green: `_hadItem` is re-stamped on every
switch-in at `:19973` (`nx._hadItem=!!nx.item;`). The `pokemon.ignoringAbility()` clause has no
counterpart in this engine at all and is stated rather than counted.

## What was corrected, and how

| location | treatment |
|---|---|
| new `##` section, inserted directly below the `<!-- /GENERATED -->` block | **added** — the dated retraction, the three refutations, the mechanism, #535, and a list of what it changed below |
| `### UNBURDEN IS THIS DIVISION'S DEFECT…` (was `:206`) | **corrected in place.** It is a live claim about current engine state, not a measurement record. The old sentence is quoted verbatim inside the correction and marked FALSE |
| `### UNBURDEN IS THE FIFTH-LARGEST LEAF IN THE HOLE…` (was `:285-291`) | **superseded from above, NOT rewritten.** It is dated measured evidence — the `medi="[1,1]" sd="[1,0]"` reading really was taken. A dated note now sits at the head of the sub-section, quotes the two refuted sentences verbatim, and says what the reading actually measured. The block below it is byte-unchanged |
| hand-list bullet (was `:325`) | **corrected in place.** A hand list is a live work list; leaving a false open item there sends someone to fix a non-defect. Old bullet quoted verbatim, replaced by #535 |

### Surrounding argument that had to change

- *"It is decision-changing through turn order"* — **weakened.** Under the narrow defect it can only
  bite after an ability changes hands, and nothing has measured how often that is. It is no longer
  claimed to touch every board where an item was lost.
- *"…and it is owed a register row"* (twice) — **updated.** The row now exists: ROADMAP #535, open,
  unprobed, carrying INSTRUMENT OWED.

### Surrounding argument that survived, and why

- *"medicham2 holds no state under that name"* — **true**, and it is the #535 defect itself.
- *"It sits on a leaf nothing compares"* — **true and unchanged.**
- *"Unburden is the proof that a leaf can look wireable on every derived column and still hold a
  different quantity under the same name"* — **survives, and is strengthened**: that different
  quantity is exactly what caught the probe out. The second hand-list bullet (`the remaining 19
  leaves…`) repeats this and needed no change.
- *"Wiring presence between those two shapes would part every board on which anybody's Focus Sash
  broke"* — true **of the probe's stand-in only**, which is why adopting that stand-in as the leaf
  would have been the wrong wiring as well as the wrong reading. Said in the superseding note.

## Line endings

`docs/ENGINE.md` is LF-only and stays LF-only.

| | bytes | CRLF | bare LF |
|---|---|---|---|
| before | 2,763,021 | 0 | 39,016 |
| after | 2,774,041 | 0 | 39,148 |

`git ls-files --eol` reads `i/lf w/lf` before and after. **One hazard hit and repaired in this pass:**
verifying that a pre-existing red gate was not mine required `git stash push`/`pop` on the file, and
because `core.autocrlf=true` the pop re-checked it out as **CRLF (39,148 CRLF, 0 bare LF)**. It was
converted straight back to LF and the byte count returned exactly to 2,774,041. **A `git stash`
round-trip on an LF-only file in this repo rewrites its endings** — that is the same class as the
bare-LF insert repaired earlier today, arriving through git rather than through an editor.

# OWED

- **`CHANGELOG.md` 5.245.0 still states the refuted claim.** This pass owns `docs/ENGINE.md` only and
  did not touch it. Its commit message cannot be edited at all; the retraction section in
  `docs/ENGINE.md` is the standing correction for both.
- **`node engine/status.js --write` was NOT run** — another agent held the game-playing slot. The
  `<!-- GENERATED -->` block in `docs/ENGINE.md` is unrestamped. It carries no Unburden claim, so no
  generated figure is false; nothing was hand-edited inside it.
- **`tests/probe_leaf_widening.js` still asserts the refuted reading, in two places, and was left
  untouched deliberately** because another agent's work reads that file:
  - `:264` — `ours: 'NO NAMED STATE — recomputed in effSpeed from \`_hadItem && !m.item\` (:14770)'`.
    The first clause is true; the second names the entry guard as if it were the doubling.
  - `:276` — the `stand` predicate itself. **Until this is changed the probe cannot answer the
    question it appears to answer**, and its observe arm should not be cited about who receives the
    multiplier.
- **ROADMAP #535 is unprobed and nothing decides it.** The probe it needs empties a body's hand
  FIRST and only then grants Unburden by Skill Swap, asserting the Speed is unmoved. `_hadItem`
  carries no acquisition time for such a probe to assert against, so the fix and the instrument are
  the same piece of work. ROADMAP is not this pass's file; the row already carries this.
- **ROADMAP #535 cites `docs/ENGINE.md:207`, `:285-291`, `:325`** as the locations owing correction.
  They are corrected; the line numbers in that row are now stale by +132 lines. Not edited here.
- **ROADMAP #535's Skill Swap citation is `:27556`; the correct line is `:27555`.** Not edited here.
- **Pre-existing red, not caused by this pass and not filed:** `node tests/test-docs-current.js`
  exits 1 on *"every version-headed document is at 5.246.0 or is a declared pin"* — six docs at
  5.245.0 against a CHANGELOG top of 5.246.0. Verified identical with `docs/ENGINE.md` stashed, so it
  is somebody's in-flight pass, not this one. `docs/ENGINE.md` is not among the six.
