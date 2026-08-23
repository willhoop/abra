# The identity gate stopped counting and started measuring — and the first run found one

MEASURE, 2026-08-23. Historical findings record. Not maintained, not current state.

Brief: *"REPLACE A COUNTER WITH A CHECK."* Will: *"you do what you think is best just make it a
permanent solution."*

---

## 0. Verdict

| | |
|---|---|
| what the gate measures now | a RUNTIME assertion: no code may read a live stone-holder's `ability` / `baseStats` / `weighthg` / `weightkg` except `board.js effective()` |
| assertions | **24 passed, 0 failed**, exit 0. The 18 behavioural pins are byte-identical; 6 are new |
| what it provably catches | 6 planted shapes, including the 3 the old header conceded no text scan can see; and a real break in `engine/board.js` |
| what it found unprompted | `engine/position_features.js:249` — a genuine raw read of a live stone-holder that the retired count was GREEN on |
| what it provably cannot do | EXECUTION coverage only; blind to a sheet value copied before a `Board` existed. Stated in the gate's own header AND printed on every run |
| old count baseline | **RETIRED, not restamped.** Numbers kept under `last_count_baseline`. `--update` / `--propose` refuse, exit 2. Nothing adopted |
| is this permanent, or merely better | **permanent for the four fields on the driven path; merely better everywhere else, and the gate says which is which every time it runs** |

---

## 1. What was wrong with the counter — confirmed, then made irrelevant

The prior analysis (`docs/_reports/2026-08-23-effective-identity-ratchet.md`) is correct and I did not
re-litigate it. One line is worth adding, because it is the strongest single argument and nobody had
it yet:

> **The count was GREEN on a real defect.** `engine/position_features.js` sits at exactly its
> per-file number of 5 and has since 2026-08-02. It contains a raw read of a live stone-holder. A
> ratchet that only asks *did the number go up* cannot see a defect that was there when the number
> was written down — and 100% of the reads it was actually gating are of that kind, because a
> baseline adopts everything that exists at the moment it is taken.

That is not an argument about noise or about prose. It is an argument that the instrument was
answering the wrong question, and it is why narrowing the regex would not have helped.

---

## 2. What replaced it

`tests/test-effective-identity.js` section 3.

1. **Booby-trap the field.** `B.Board.prototype.switchIn` is wrapped so that every mon a Board puts
   on the field gets a recording accessor on `ability`, `baseStats`, `weighthg`, `weightkg`. The
   accessor returns exactly the stored value and mirrors `enumerable`, so nothing downstream behaves
   differently for being watched. It is installed on the CLASS, not on four objects, so a consumer
   that switches in a body of its own mid-drive is covered too.
2. **Make every read a defect by construction.** The board is built from a sweep of the dex crossed
   with the damage table: species with an MC row, holding a mega stone (Z stones excluded for the
   reason section 2b already gives), whose mega forme has exactly one ability and that ability is not
   one the base forme can have. **57 such stone-holders exist**; the first eight fill both sides plus
   the bench. An assertion then checks that `effAbility(mon, dex) !== mon.ability` for **all four
   actives** — if the sheet and the effective value ever agreed, every read below would be safe and
   the gate would pass by asking nothing.
3. **Drive the live decision path**, then attribute every recorded read to the first stack frame that
   is neither the accessor nor the test file.
4. **Exactly one call site may see the raw field**: `board.js effective()`. Everything else is an
   offender, named by file, line and source text.

Measured on the clean tree: **194 reads across 2 call sites** — 158 in `effective()` and 36 in
`position_features.js`.

### Why this is the right shape and not a cleverer grep

The header of the old file cited Fowler's SELF ENCAPSULATE FIELD as the fix and then implemented a
word count. The tripwire is that refactoring stated as an executable assertion: *nobody but the
accessor touches the raw field.* It enumerates no bad shapes and no call sites, so a consumer written
tomorrow on the driven path is covered with no edit here — which is precisely what a checker that
enumerates known-bad shapes cannot do, and what this repository has paid for three times.

---

## 3. The defect it found

`engine/position_features.js:249`, in `priorityRefusedAbove()`:

```js
return { ability: B.norm(f.mon.ability || e.ability || ''), fainted: false };
```

`engine/board.js:3520` is the **same function, one file over**, and it resolves:

```js
return { ability: effAbility(f.mon, dex) || norm(e.ability || ''), fainted: false };
```

One fact with two implementations — the failure CLAUDE.md names as *FEATURES ARE PER-MODEL, FACTS ARE
GLOBAL*. `board.js`'s own comment at 3364 says why it resolves.

**Exposure is zero today, and the gate re-derives that rather than asserting it.** The value is
consumed only by `medicham2`'s priority bar, which is the `blocksMove{what:'priority'}` tag set —
`armortail`, `queenlymajesty` (and `goodasgold` for status). Swept across every mega stone in the
format: **0 legal megas gain or lose a `blocksMove` ability.** So the read cannot currently be wrong.

It is **DECLARED with a `guard()`**, not waved through and not fixed:

- MEASURE does not own `engine/position_features.js`, so the fix is proposed as a roadmap row below.
- The declaration's safety rests on a fact about the format, so the declaration carries a function
  that re-derives that fact **on every run** and fails the gate **by name** the day a mega changes a
  `blocksMove` ability. That is the one property the old `DECLARED` mechanism did not have: 32
  well-argued paragraphs, none of which could ever go red.
- The guard also fails if the tag set comes back empty — a guard that is asking nothing must not
  report `HOLDS`.

**Proposed ROADMAP row** (MEASURE does not edit `docs/ROADMAP.md`):

> | #NNN | **`engine/position_features.js:249` READS A LIVE STONE-HOLDER'S DECLARED ABILITY WHERE `engine/board.js:3520` RESOLVES IT — ONE FACT, TWO IMPLEMENTATIONS. FOUND 2026-08-23 BY THE RUNTIME TRIPWIRE IN `tests/test-effective-identity.js`, WHICH THE RETIRED COUNT RATCHET WAS GREEN ON.** `priorityRefusedAbove()` in `position_features.js` builds its defender list with `B.norm(f.mon.ability \|\| e.ability \|\| '')`; the identical function in `board.js` uses `effAbility(f.mon, dex)`. **EXPOSURE IS ZERO TODAY AND IS RE-DERIVED EVERY RUN** — the value is consumed only by the `blocksMove{what:'priority'}` bar (`armortail`, `queenlymajesty`), and 0 legal megas gain or lose a `blocksMove` ability; the gate's `guard()` goes red by name the day one does. FIX: thread the dex into `priorityRefusedAbove` and call `B.effAbility(f.mon, dex)`, then delete the `RUNTIME_ALLOWED` entry. VERIFIED BY: `node tests/test-effective-identity.js` \| open — ENGINE/SEARCH own the file |

---

## 4. Shown RED before being trusted, on seven shapes

### 4a. Six planted shapes — `ABRA_EI_PLANT=all`

Compiled through `vm.compileFunction` with a synthetic filename, so the shapes exist **only while the
knob is set** and no scanner in this repository can ever count them as debt. Every one reads the
booby-trapped field off a live stone-holder, so every one is a real defect.

```
  FAIL every read of a live stone-holder's identity goes through board.js effective() (6 site(s) do not)
         engine/_planted_stale_read_dot.js:1          x1 [ability]
         engine/_planted_stale_read_destructure.js:1  x1 [ability]
         engine/_planted_stale_read_param.js:1        x1 [ability]
         engine/_planted_stale_read_spread.js:1       x1 [ability]
         engine/_planted_stale_read_assign.js:1       x1 [ability]
         engine/_planted_stale_read_computed.js:1     x1 [ability]
```

exit **1**.

| plant | source | the old scan |
|---|---|---|
| `dot` | `mon.ability` | counted |
| `destructure` | `const { ability } = mon` | counted separately, 0 sites, not in the ratchet |
| `param` | `({ ability }) => ability` | same |
| `spread` | `{ ...mon }` then read | **conceded undetectable by any text scan** |
| `assign` | `Object.assign({}, mon)` then read | **conceded undetectable by any text scan** |
| `computed` | `mon[k]`, `k` built at runtime | **conceded undetectable by any text scan** |

That last group is the one that matters. The brief asked for a checker that catches a NEW instance
spelled a way nobody anticipated; the spelling is irrelevant to an accessor, and the three shapes the
old header named as permanently invisible are caught by name.

### 4b. One real break in a repository file

`engine/board.js:3520` was edited from `effAbility(f.mon, dex)` to `norm(f.mon.ability)`. The gate:

```
  FAIL every read of a live stone-holder's identity goes through board.js effective() (1 site(s) do not)
         engine/board.js:3520  x4 [ability]
           return { ability: norm(f.mon.ability) || norm(e.ability || ''), fainted: false };
```

**Restored from a byte copy taken before the edit, not with `git checkout`**, and verified:
`90ae57fe3bcaf886a29f8affc273bf437dd9d2af` before and after.

### 4c. And it must prove it ran

`ok(TRIP.length > 0 && SITES.size > 0)`. The likeliest way this instrument rots is a changed
signature making every drive throw, after which "no unauthorised reads" would be a statement about an
empty set. The drive list records `[THREW: ...]` per entry and prints it.

---

## 5. What it provably CANNOT do — and where that is stated

All of this is in the gate's own header (section 3) and the second point is **printed on every run**,
because a limit nobody reads is a limit nobody applies.

1. **Coverage is EXECUTION coverage.** Driven today: `board.js candidates()+featuresFor()` and
   `foeActionDistribution()` for all four actives; `position_features.js positionFeatures()` and
   `rollout_leaf.js rolloutWinProb(n=2)` for both sides. That is the MAG feature path and the leaf.
   **Not driven:** `magnemite.js`'s live loop, the fitters, the differential harnesses, and anything
   that builds its own bodies instead of a `Board`.
2. **The drive list is printed every run**, so a reader can check whether their consumer is in it
   rather than assuming.
3. **Blind to a value copied out of the sheet before a `Board` existed** and then treated as live. The
   read happens on an object nothing poisoned. This is the old scan's `Object.assign` hole **moved
   rather than closed**, and the header says so in those words.
4. **It poisons Board slot mons only** — deliberately. A sheet entry's `.ability` genuinely IS the
   pre-mega one and reading it is correct; that was always the ratchet's stated legitimate case, and
   it is now excluded BY CONSTRUCTION rather than by 32 hand-written per-file declarations.
5. **A raw read inside `engine/medicham2-browser.js` is a different and legitimate case** — that
   engine materialises the effective ability into `.ability` — and section 2b pins that behaviourally
   at both moments (before the choice and after a real turn in which the body megas).

So: **permanent for those four fields on that path; merely better elsewhere.** The honest claim is
that the gate now cannot be satisfied by editing a comment, cannot recommend a restamp, cannot be
fooled by a spelling, and states its own blind spots in the same output as its verdict.

---

## 6. The old baseline: RETIRED, not restamped

`data/effective-identity-baseline.json` now reads:

```
retired        2026-08-23
retired_by     MEASURE
retired_why    <the measured case, in full>
replaced_by    <the tripwire, and where its allow-list lives>
do_not_restamp --update and --propose REFUSE and exit 2
last_count_baseline  { generated: 2026-08-11, count: 1198, allowed: {...80 files} }   ← UNCHANGED
```

**Nothing was adopted.** The 31 files that were over their per-file number are still over it and the
inventory still prints that fact — as context, labelled `THIS IS NOT A VERDICT`.

Kept, and asserting nothing:

- the per-file PROSE / WRITE / READ inventory and `--split`, because the split is genuinely useful to
  a human auditing this class of bug and costs one pass over the tree;
- the **32 walked-file notes**, because each is somebody's line-by-line account of one file and that
  is the expensive part of the old mechanism. They are notes now, not exemptions.

Kept, and still asserting: **one narrow static check**, `baseSpecies(...).baseStats` at zero. It is
the single text shape a whole-repository walk named as dangerous, it is 0 today, and it reaches files
the tripwire never executes. It is labelled a supplement in the file, in the honest terms the brief
asked for: *it refuses one spelling of one shape and nothing more.*

---

## 7. OWED, NOT RUN — and one thing that is not mine

- **`node engine/status.js --write` — see §8.** Another division was writing to this tree while I
  worked (below), and a generated restamp mid-flight would stamp a half-finished state.
- **`tests/run-all.js` NOT RUN.** It invokes heavy instruments; Will is asleep, the machine was
  force-quit once tonight, and another agent held the tree. The three pre-commit gates were run
  individually and are green: `test-docs-current.js` 23/0, `test-roadmap-register.js` exit 0,
  `test-artifact-rerunnable.js` exit 0.
- **`engine/position_features.js:249` IS NOT FIXED.** It is declared with a live guard and proposed
  as a roadmap row. The fix is two lines and belongs to whoever owns that file.
- **ROADMAP #391 is superseded and I did not edit it.** It asks Will to choose between (A) declare
  six twins, (B) accept a 1603-read re-baseline, (C) waive by name. None of the three is needed now:
  the ratchet those options were about no longer gates anything. The row should be closed with a
  pointer here.
- **ROADMAP #183's actual debt is still open**: a walk of `engine/medicham2-browser.js`'s own reads.
  The tripwire does not touch it — that engine's `.ability` IS the effective value and section 2b
  pins it — but the walk was never about the count either.
- **No coverage was added for the fitters or for `magnemite.js`.** They are named as uncovered in the
  gate's header and printed as absent from the drive list. That is a stated gap, not a silent one.

---

## 8. A tree that moved under the measurement — reported, not touched

The brief said the tree was clean and pushed, and it was at 21:0x. During this session another
division began writing. At the time of this report `git status` shows modified:
`data/provenance-stamp.json`, `engine/artifact_audit.js`, `engine/mc_key.js`,
`engine/medicham2-browser.js`, `engine/medicham_coverage.js`, `engine/position_features.js`,
`engine/rollout_r1.js`, `engine/seed_source_audit.js`, `engine/type_coverage.js`, several `tests/`
files, plus untracked `tests/test-mc-seal.js` and `data/_pair-pilot.json`.

**None of it is mine and none of it was touched.** Two consequences worth recording:

- The work is an `MC.mons` sealing pass, and it changed `engine/position_features.js` *while I was
  measuring it*. It did **not** touch line 249. Because the declaration matches on **source text**
  rather than on a line number, it survived the line moving — and it would correctly go red if
  somebody edited that line, which is what you want.
- My own run consumed `mcKey.row(name, {mayMiss})` rather than indexing `MC.mons` directly, which the
  sealing work makes throw. That was not foresight: the first version of the sweep threw on
  `raichualola` and `engine/lookup.js` said exactly what to call instead.

`data/_pair-pilot.json` and `tests/test-mc-seal.js` are not mine. **Reported, left in place.**

### AND MY COMMIT SWEPT IN ONE OF THEIR STAGED CHANGES. SAY SO LOUDLY.

I staged six paths by name and committed. The commit went out with **seven** files: the seventh is
`data/mc-key-door-baseline.json`, **deleted**. I did not delete it and did not stage it — the other
division had already staged that deletion in the shared index, and `git commit` takes the index, not
my `git add` list.

It is theirs and it is deliberate: their in-flight `tests/test-mc-key.js` opens with *"THE DOORWAY
DEBT FILE IS GONE, 2026-08-23"*. **Nothing is lost** — the file is tracked, so it is one
`git show eec2407:data/mc-key-door-baseline.json` away, which is exactly the difference between this
and the untracked-file rule.

**I did not restore it, and that is a judgement rather than an oversight.** Putting the file back
would write into another agent's working tree mid-task and re-stage a deletion they intend to make.
What it costs to leave it: `HEAD` is momentarily inconsistent — the version of `tests/test-mc-key.js`
*at HEAD* still references the file it no longer has, and their fixed version is uncommitted. The
working tree is fine, nothing is pushed, and their next commit closes it.

**ENGINE should be told**, because from their side the deletion has silently already shipped and
their commit will not contain it. The general lesson: `git add <paths>` does not scope a commit when
another agent shares the index. `git commit -- <paths>` does.
