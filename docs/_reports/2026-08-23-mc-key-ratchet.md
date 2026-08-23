# test-mc-key.js — the red was REAL, and the ratchet was ALSO blind

2026-08-23, MEASURE. Historical findings record; not current state, not a living document.

## 1. What the gate actually said

```
  FAIL no NEW file hand-rolls the species lookup
       (engine/rollout_seed_prevalence.js, tests/probe_red_demo.js,
        tests/test-rollout-seed.js, tests/test-seed-clock.js, tests/test-seed-residue.js)
  ok   no baselined file grew more of them (none)
  MC KEY TESTS: 14 passed, 1 failed
```

One clause of fifteen. Section 1 (the resolver itself — 322 keys, the forme fallback, the
LookupMiss contract) was entirely green; the red is section 2, the ban on hand-rolled lookups,
and it is the NOVEL-FILE clause, not the growth clause.

**Age.** `data/mc-key-baseline.json` was last stamped 2026-08-11 (`825ac9f`). Four of the five
accused files were born after it: `rollout_seed_prevalence.js` and `test-rollout-seed.js` on
2026-08-13 (`25d67c5`), `test-seed-clock.js` on 2026-08-14 (`58a26a7`), `test-seed-residue.js` on
2026-08-14 (`435be2b`). The gate has been red for roughly ten days. It is not tonight's damage,
which matches ENGINE's independent stash-and-rerun.

## 2. Real violation or the ruler? BOTH, and here are the counts

Eleven flagged sites across the five files. Classified by hand, each one read:

| class | sites | files |
|---|---|---|
| **a real bug, published** | 1 | `engine/rollout_seed_prevalence.js:95` |
| **a real latent forme-drop** | 2 | `tests/test-rollout-seed.js:91, :100` |
| behaviour-identical (key already a valid MC.mons key) | 8 | the seed tests, `probe_red_demo.js` |

So the red was **not** the ruler in the sense that `test-effective-identity.js` was tonight. One of
the eleven is a live defect in a published artifact. The other ten are the ban working as designed:
deliberately over-broad, because — as the file's own header argues — a regex clever enough to allow
the safe ones is clever enough to let the next unsafe one through.

### 2a. The real bug

`engine/rollout_seed_prevalence.js:95`, as written:

```js
const datasetMoves = sp => ((globalThis.MC.mons[base(sp)] || {}).mv || []).map(norm).sort();
```

`base()` ends in `norm()`, which strips the hyphen that `MC.mons` keys every forme WITH. So
`Rotom-Wash` asked the table for `rotomwash`, got nothing, and returned an **empty** dataset
moveset — which the caller at line 162 then compares against the sheet's declared four:

```js
if (declared.length && declared.join(',') !== datasetMoves(sp).join(',')) movesDiffer = true;
```

An empty dataset moveset can only push `movesDiffer` **up**. Measured over
`data/games.bo3.jsonl` (19,401 games):

- **47 of 256 distinct species names** in the store resolved to no row under `base()` and DO
  resolve through `mcKey` — Rotom-Wash, Ninetales-Alola, Arcanine-Hisui, Floette-Eternal,
  Lycanroc-Dusk, Zoroark-Hisui, Samurott-Hisui, Decidueye-Hisui, Tauros-Paldea-Aqua and 38 more.
  Two names remain genuinely absent from the table.
- **10,980 of 144,260 brought bodies — 7.61%.**
- At the sheet-body level: **19,236 of 231,924 declared-moveset bodies (8.29%) hit the bug**, and
  **7,177 of them (3.095% of all bodies) have their `movesDiffer` verdict FLIP true → false** once
  the row is found. The other 12,055 really do differ and are unaffected.
  Top flippers: Floette-Eternal 3,022, Arcanine-Hisui 1,919, Lycanroc-Dusk 1,059,
  Ninetales-Alola 308.

**What this contaminates.** `data/rollout-seed-prevalence.json` (generated 2026-08-14T00:27Z,
14,102 games / 190,378 decision points) publishes `movesDiffer: 105,430` = **55.379%**, and the
`any` headline of **70.55%**. Both are quoted in `docs/SEARCH.md` and in ROADMAP #248's closure
text. Both are biased **upward** by an amount bounded above by the body-level flip rate. The
decision-point figure ORs over the live bench, so the flip rate does not translate one-for-one and
the exact correction needs the re-run. **I did not re-run it** — see OWED below.

Fixed to go through the door, with the mega/G-Max strip preserved so the measurement's own
semantics are unchanged:

```js
const NO_ROW = { mayMiss: 'MC.mons does not cover the whole format; a body with no row has no dataset four' };
const datasetMoves = sp => ((mcKey.row(base(sp), NO_ROW) || {}).mv || []).map(norm).sort();
```

### 2b. The real latent forme-drop

`tests/test-rollout-seed.js:100`, inside `carriersOf(ability)`:

```js
  .map(s => s.id).filter(id => globalThis.MC.mons[id]);
```

A dex `s.id` is FLAT (`rotomwash`); `MC.mons` keys formes with a hyphen. So a forme carrier of a
tagged ability is dropped **silently**, and the assertion two lines later —
`ok(CAR.length === 1, 'the fallen-count ability has exactly one carrier in this regulation, derived')`
— would still pass, over the wrong population. Inert today only because Supreme Overlord's one
carrier is Kingambit, which has no hyphen. This is the same shape as the 2026-08-23
`test-engine-diff.js` bug, in a test file, waiting.

Line 91, `observedUsersOf`, was the same thing one level out: `.map(nrm).filter(sp => BUILDABLE.includes(sp))`
dropped every hyphenated forme from the fixture pool, and the ratchet's patterns could not see it at
all because it never touches `MC.mons`.

Both now go through `mcKey`, and `carriersOf` is deduped because the resolver's same-body fallback
can legitimately send a cosmetic forme and its base to the same row.

### 2c. The eight behaviour-identical sites

`tests/test-seed-clock.js` (3), `tests/test-seed-residue.js` (2), `tests/test-rollout-seed.js` (3)
index with keys taken straight out of `Object.keys(MC.mons)` (`MINE[n]`, `THEIRS[n]`, `K`), and
`tests/probe_red_demo.js` (2) uses correct hyphenated literals held in a `const`. All routed
through `mcKey.row`; proven equivalent rather than assumed —
`MC.mons['floette-mega'] === mcKey.row('floette-mega', OPTS)` is **object-identical** for all three
keys `probe_red_demo` uses, so that file's expensive run was not needed to clear the change.

## 3. What I changed

| file | change |
|---|---|
| `engine/rollout_seed_prevalence.js` | the real bug, above. Comment states the measured size and that the artifact is owed a re-run |
| `tests/test-rollout-seed.js` | `carriersOf` and `observedUsersOf` through `mcKey` (+ dedupe); 3 benign sites through `mcKey.row` |
| `tests/test-seed-clock.js` | 3 sites through `mcKey.row` |
| `tests/test-seed-residue.js` | 2 sites through `mcKey.row` |
| `tests/probe_red_demo.js` | 2 sites through `mcKey.row` |
| `tests/test-mc-key.js` | **new section 3, the DOORWAY** — see below |
| `data/mc-key-door-baseline.json` | **NEW file**, section 3's own ratchet, established at today's level |

**`data/mc-key-baseline.json` was NOT touched.** Section 2 went green because the five files stopped
violating it, not because the baseline moved. It still reads exactly the same 16 files, and the
`hand-rolled lookups remaining` census dropped 21 → 16.

### One thing I tried and reverted, because it is a real constraint

`mcKey.all()` sorts its entries deliberately ("so a digest taken over these is stable across runs
and across key insertion order"). Three of these test files build their fixture pool as
`Object.keys(globalThis.MC.mons)` and take `.slice(0,6)` / `.slice(6,12)`. Swapping in `mcKey.all()`
reorders the pool, changes which species the fixtures use, and turned `test-rollout-seed.js` from
48/0 to 38/10 — every failure a fixture artefact, none a mechanic. Reverted. Those three
`Object.keys` calls therefore survive, in the new door baseline, and are a proposal for Will
(§5).

## 4. The ratchet itself — section 3, "THE DOORWAY"

The brief's diagnosis is right and it is worth stating precisely why. Section 2 is a list of
**wrong spellings**. On 2026-08-23 `tests/test-engine-diff.js` wrote
`MEDI.buildMon(s.toLowerCase(), {})`, which never mentions `MC.mons` at all, dropped **138 of 345
species**, and the differential had never compared a single one of the 76 megas. Section 2 was
green throughout. A list of wrong forms cannot catch a new wrong form.

Section 3 inverts the question: *does this line touch the mon table by any route other than
`mcKey`?* Five patterns — any non-literal index, ANY enumeration, a `for..in` walk, an alias of the
table into a local, all of them under ANY identifier (`MC.mons`, `globalThis.MC.mons`, `out.mons`,
`prior.mons`), plus `buildMon()` handed a flattened name.

**Section 2's `Object.keys(MC.mons)` pattern did not survive a `globalThis.` prefix.** That was a
live hole: `Object.keys(globalThis.MC.mons)` appears in eight files today and section 2 sees none
of them.

**The patterns are themselves asserted**, against the five real broken lines this class has produced
and four lines that are correct. Without that clause a future edit could quietly narrow a regex and
every clause below it would still print `ok` — which is the exact failure mode the file exists to
prevent.

### Would it catch a fourth instance spelled a new way?

**Yes for the `.mons` half, honestly qualified for the rest, and section 3's own comment says so in
the file rather than only here.**

Caught: any new caller indexing, enumerating, walking or aliasing the table under any name; any new
caller handing `buildMon` a `.toLowerCase()` / `.replace()` / `norm()` / `nrm()` / `flat()` / dex
`.id`.

**Not caught, stated in the gate's header with specifics:**
- a key BUILT by concatenation without the hyphen (`base + 'mega'` → `venusaurmega`). That was the
  ORIGINAL 2026-07-30 bug, 0 of 67 writes matching. `engine/artifact_audit.js` covers that one by
  comparing a generated artifact to its source, which is why that file exists.
- a flattened species reaching any consumer **other than** `buildMon` — `bd.setParty(...)`,
  `bd.switchIn(...)`, a key written to JSON and read back elsewhere.
- anything in Python, or in a run-time template string.

The `buildMon` clause is still a shape list, and the header says so plainly instead of glossing it.
It is defensible only because the set of ways to lowercase-and-strip a string in JavaScript is small
and closed, where the set of functions that might consume a species key is open. **Better axis, not
a safe one.**

### Shown RED on deliberate breaks first — three of them

1. **A brand-new file** containing `Object.keys(globalThis.MC.mons).slice(0,4)`:
   section 2 printed `ok no NEW file hand-rolls the species lookup (none)` and section 3 printed
   `FAIL no NEW file reaches the mon table except through mcKey`. That single run is the whole
   argument for section 3. (File created by me for the demo and removed by me.)
2. **The 2026-08-23 shape, one call deeper** — `MEDI.buildMon(String(sp).toLowerCase(), {})`
   appended to a baselined file: `FAIL no baselined file grew more doorways (tests/test-tag-wire.js: 1 -> 2)`.
   **This break caught a bug in my own first draft**: the argument pattern was `[^),]*`, which cannot
   cross a nested call, so the demo initially passed green. Widened to a bounded non-greedy
   `[^;]{0,80}?` and the case is now one of the asserted HISTORY lines, so it cannot regress.
3. The pattern-integrity clause fires by construction if any regex is narrowed — demonstrated
   incidentally when edit (2) landed the HISTORY line before the regex fix:
   `FAIL the doorway patterns still catch every historical instance...`.

All three files restored byte-identical afterwards (`diff -q` clean); the demo file was removed by
the session that created it.

## 5. For Will to decide — three proposals, nothing done unilaterally

**(a) The one judgement call I made.** `data/mc-key-door-baseline.json` is a NEW ratchet established
at today's measured level: **37 files, 96 sites** of pre-existing debt. This is not the same act as
moving an existing baseline to make a red gate pass — section 2's baseline was untouched and the
gate went green on fixes. But it is a hand-written baseline and it is yours to reject. If you would
rather the 96 be paid down before the clause is armed, delete the file and the clause fails loudly.

**(b) `mcKey.all()` sorts, and three fixture files need insertion order.** Either add an ordering
option to the accessor, or rework the three fixture pools to be order-independent. Until then
`Object.keys(globalThis.MC.mons)` legitimately survives in `test-rollout-seed.js`,
`test-seed-clock.js` and `test-seed-residue.js`.

**(c) The durable fix is in the CONSUMER, and it is ENGINE's, not mine.** No regex would have been
needed on 2026-08-23 if `buildMon` — and the board setters — threw `LookupMiss` on an undeclared
miss the way `mcKey` already does. A flattened forme would then crash on the first one instead of
silently dropping 138 of 345 species. That is a change to `engine/medicham2-browser.js` and I did
not make it.

### Proposed ROADMAP row text (I do not own `docs/ROADMAP.md`)

> **THE ROLLOUT-SEED PREVALENCE ARTIFACT WAS MEASURED THROUGH A BROKEN SPECIES LOOKUP — 2026-08-23.**
> `engine/rollout_seed_prevalence.js` read `MC.mons[base(sp)]`, and `base()` ends in `norm()`, which
> strips the hyphen `MC.mons` keys every forme with. So every forme got an EMPTY dataset moveset and
> was scored as "the moves differ" — a one-directional inflation. Measured over
> `data/games.bo3.jsonl`: **47 of 256 store species names, 10,980 of 144,260 brought bodies (7.61%)**;
> at the sheet-body level **19,236 of 231,924 bodies hit it and 7,177 (3.095% of all bodies) flip
> true → false** once the row is found. `data/rollout-seed-prevalence.json` (`movesDiffer` **55.379%**,
> `any` **70.55%**, both quoted in `docs/SEARCH.md` and in #248's closure) is therefore biased upward
> by an unpublished amount and is **OWED A RE-RUN**. The lookup is fixed and goes through
> `engine/mc_key.js`. **VERIFIED BY: `node tests/test-mc-key.js`.**

> **THE MC-KEY RATCHET COULD NOT SEE THE 2026-08-23 INSTANCE, AND NOW HAS A SECOND SECTION — 2026-08-23.**
> `tests/test-mc-key.js` banned three KNOWN-BAD SPELLINGS; `buildMon(s.toLowerCase())` is none of
> them and dropped 138 of 345 species with the gate green. Section 3 bans every route into the mon
> table that is not `engine/mc_key.js`, under any identifier, plus `buildMon` handed a flattened
> name; the patterns are asserted against all five historical instances and four correct lines, so
> they cannot be quietly narrowed. Baseline `data/mc-key-door-baseline.json`, established at
> **37 files / 96 sites** of pre-existing debt, ratcheted downward only. What it still cannot see is
> named in the gate's own header: key CONCATENATION (the 2026-07-30 bug — `artifact_audit.js`'s job),
> a flattened species reaching a consumer other than `buildMon`, and anything in Python.
> **VERIFIED BY: `node tests/test-mc-key.js`.**

## 6. OWED, NOT RUN

- **`data/rollout-seed-prevalence.json` — RE-RUN OWED.** `node engine/rollout_seed_prevalence.js`
  against the same store. Not run tonight: it rewrites a published artifact while four agents are
  live, and CLAUDE.md's torn-read rule cuts both ways. Until it is re-run, **55.379%** and the
  **70.55%** headline in `docs/SEARCH.md` and ROADMAP #248 are known-inflated and should be
  withheld, not annotated. Note the store has grown 14,102 → 19,401 games since 2026-08-14, so a
  re-run is **not** a before/after unless it is pinned to the same sample.
- **`docs/SEARCH.md` and `docs/ROADMAP.md` not edited** — held by other agents tonight; row text
  proposed above instead.
- **`CHANGELOG.md` not written** — held by ENGINE, by instruction.
- **`tests/probe_red_demo.js` not executed.** It is independently RED (10 of 200 demos, 8 stale
  reversals — registered in `tests/run-all.js`) and expensive. My two-line change was cleared by
  object-identity instead. Its own redness is unchanged and is not mine.
- **Nothing committed. `node engine/status.js --write` not run**, by instruction.
- **`tests/run-all.js` not run** — it would have played games.

## 7. Verification actually performed

| command | before | after |
|---|---|---|
| `node tests/test-mc-key.js` | **14 passed, 1 failed, exit 1** | **18 passed, 0 failed, exit 0** |
| `node tests/test-rollout-seed.js` | 48 passed, 0 failed | 48 passed, 0 failed |
| `node tests/test-seed-clock.js` | 134 passed, 0 failed | 134 passed, 0 failed |
| `node tests/test-seed-residue.js` | 20 passed, 0 failed | 20 passed, 0 failed |
| `node tests/test-drop-guard.js` | — | exit 0 |
| `node tests/test-target-provenance.js` | — | exit 0 |
| `node --check engine/rollout_seed_prevalence.js` | — | ok; `datasetMoves` spot-checked on 6 names |

Section 2 census: **21 → 16** hand-rolled lookups, baseline untouched.
</content>
</invoke>
