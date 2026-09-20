# The differential was blind to every `|-ability|` line for 44 days. The blind spot is 250 of 961 games.

**2026-09-19. MEASURE. Main tree, LIGHT MODE.** No gate lattice, no full battery, no
`status.js --write`, no commit, no push. One scratch `--games 1200` run plus one 20-game deliberate
break, both to a scratch `--out`. `data/game-differential.json` and the two lattice artifacts were
**not** written and still hold the BEFORE numbers.

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.

---

## THE VERDICT

| | BEFORE (`data/game-differential.json`, 18:09 local) | AFTER (scratch, same pins) |
|---|---|---|
| games | 961 | **961** |
| diverged (protocol) | **0** | **250** |
| board-material (`state.games` − `state.games_board_never_diverged`) | 0 of 961 | **0 of 961 — unchanged** |
| narration-only games (`by_cause_totals.games_narration_only`) | 0 | **250**, over **77** causes |
| `by_cause_reconciles` | true | **true** |
| threw | 0 | **0** |
| games cut off by the turn cap (50) | 0 | **0** |
| turn boundaries identical | 10,716 / 10,716 | **10,716 / 10,716** |

**The blind spot was 250 of 961 games — 26.0% of the sample — and every one of them is narration.
No board moved.** All 77 causes name an `|-ability|` line; there is not one cause in the new set that
is anything else.

---

## 1. WHAT WAS DROPPED, AND WHY IT WAS ADDED

`engine/game_differential.js` `EQUIV[0]`, born with the file at **`f60b01c7` (3.60.0,
2026-08-06)** and **never edited** in the 44 days it stood — `git log -L 2682,2688` returns exactly
one commit.

```js
{ id: 'ability-announcement',
  why: 'Showdown\'s `|-ability|` is a COSMETIC announcement that an ability activated (SIM-PROTOCOL). '
     + 'Every consequence of it is a separate line and is kept, so dropping the announcement cannot '
     + 'hide an ability that did not fire — its effect would still be missing.',
  fn: f => (f[1] === '-ability' ? null : f),
  equal: ['|-ability|p1a: Sharpedo|Speed Boost|boost', ''],
  distinct: ['|-boost|p1a: Sharpedo|spe|1', '|-boost|p1a: Sharpedo|atk|1'] },
```

**THE ORIGINAL REASON, from that commit's own message rather than from inference.** Run one of the
driver read *"160/160 games diverging with a median of ONE completed turn"*; seven equivalences
collapsed 4,627 lines of shape noise, and the commit reports the honest outcome — *"THE NORMALISED
RATE IS 159/160 AND THE RATE BARELY MOVED... THE SHAPE NOISE WAS HIDING REAL CLASSES, NOT INFLATING A
SMALL NUMBER."* The unifying argument it states, and the file header still states: **every rule drops
an announcement or an attribution and never a state change.**

**For an ability with a consequence that argument is sound.** It has one hole:

> **An ability whose whole effect IS the announcement has no consequence line to keep.**

`data/tags.json` derives exactly that class — `params.<tag>.visibleOnABoard: false` — and 6.71.1
taught `engine/quarantine.js` to accept those roster rows as `ANNOUNCEMENT-ONLY` on that basis.
Anticipation, Forewarn and Frisk. For those three the rule deleted the only evidence that exists,
and the two engines agreed by construction. ENGINE measured it on 2026-09-19
(`docs/_reports/2026-09-19-announcement-receipts.md` §4): with `MEDI_ANTICIPATION_SILENT=1`, this
engine writing **no Anticipation line at all**, the whole-game comparison read
**`first divergence none`**.

**AND THE RULE'S OWN RED DEMONSTRATION COULD NOT HAVE CAUGHT THAT.** Its `distinct` pair is two
`|-boost|` lines. The rule's `fn` never touches a `-boost` line, so `keeps_the_meaning: true` was a
true statement about the comparator and said **nothing about the rule**. Every other rule in the list
exercises its own `fn` in its `distinct` pair (`move-target-field` is the deliberate exception and
says so in its `why`). This is "a green test can be asking nothing", in the one place in the file
built to prevent it.

---

## 2. THE NEW RULE — AND IT IS NO RULE AT ALL

**`|-ability|` lines are compared, like any other line. Nothing is excused.**

That is smaller than a narrowed exemption, and it is what the measurement supports: **every**
difference the run sees is an emission gap in one engine or the other (§3). No form needed a written
excusal, so none was written — an excusal with no case to cover is the permanent exemption that fires
on nothing that `engine/quarantine.js`'s own closet notes refuse.

**The attribution half is still collapsed, by rules that were always generic and were never about
abilities:** `source-tag` strips `[of] pXy` from every line, and `effect-namespace` folds
`ability:` / `move:` / `item:` prefixes. So what is compared on an `-ability` line is WHO, WHICH
ABILITY, and the fields the authority writes beside it.

**The retired row is published, not deleted.** `RETIRED_EQUIV` in `engine/game_differential.js`
carries the id, the date it was added, the date it was retired, its original `why`, the measurement
that retired it, and what replaced it. It is written into every artifact as
`normalisation.retired` and printed on every run, because an artifact generated before 2026-09-19
carries a number taken with `-ability` invisible and a reader has to be able to tell the two
populations apart **from the artifact alone**.

**IF A FORM EVER MUST BE EXCUSED IT DOES NOT COME BACK TO `EQUIV`.** It goes in
`engine/quarantine.js DECLARED_DIVERGENCE` with a kind the gate counts — `AUTHORITY-WRONG`,
`INCOMPARABLE`, `CLOSETED` — where it is matched on a cause string, named on every run, and
subtracted **visibly**, exactly as Supreme Overlord's `fallenundefined` is. A silent drop in `EQUIV`
is how one line class went 44 days without anybody able to size it.

### The audit that makes the class sizeable

`normalisation.ability_lines` is new: every `(body, ability, tail)` form seen this run, counted **per
side on the RAW streams before any equivalence runs**, with `gap = authority − ours`. It is published
and printed. On this run: **346 distinct forms, 210 of them with a non-zero gap; the authority wrote
43,384 `-ability` lines and this engine wrote 32,348.**

---

## 3. THE COST, BUCKETED BY MECHANISM

Read off `end_state[0].summary.by_cause` of the AFTER artifact — the **full** by-cause table, not
`first_divergences` (capped at 60) and not `first_board_divergences` (capped at 40). A capped list is
evidence of what exists, never of how much.

| mechanism | causes | games | what it is |
|---|---|---|---|
| **`event missing from medicham2`** | 31 | **198** | the authority announces an ability and this engine writes no line at all |
| **`-ability field 4`** | 42 | **47** | an ability REWRITE: the authority writes the OLD ability's name as field 4, we write nothing there |
| **`extra event emitted by medicham2`** | 3 | **4** | we announce where the authority does not |
| **`ordering`** | 1 | **1** | the line is written, in the wrong place |
| | **77** | **250** | |

### 3a. `event missing from medicham2` — 198 games, and it is one generic rule

| ability | causes | games |
|---|---|---|
| stamina | 4 | **112** |
| speedboost | 4 | **48** |
| cloudnine | 8 | **16** |
| lightningrod | 4 | **10** |
| moody | 7 | **8** |
| weakarmor | 2 | 2 |
| sapsipper | 2 | 2 |

A verbatim cause, the largest single row (46 games):

```
event missing from medicham2 :: |-ability|p2a|stamina|boost <> |-boost|p2a|def|1
```

**THE SITE IS ONE BRANCH, NOT SEVEN ABILITIES.** `sim/battle.ts:2060-2070`, inside `boost()`:

```js
} else {
    if (effect.effectType === 'Ability' && !boosted) {
        this.add('-ability', target, effect.name, 'boost');
        boosted = true;
    }
    this.add(msg, target, boostName, boostBy);
}
```

So **any** ability-sourced boost announces the ability first, once per `boost()` call. This engine
already does it for Intimidate, Defiant, Competitive, Moxie, Berserk and Eelevate — the audit table
shows those forms matching exactly, 338/338 and so on — and does not for Stamina, Speed Boost, Moody,
Lightning Rod, Weak Armor or Sap Sipper. Cloud Nine is the separate bare `onStart` announce
(`data/abilities.ts:536`), the same family 6.70.0-era work landed for Pressure, Mold Breaker and
Unnerve (`announcesOnStart`). **This is ENGINE's, and it is small: one generic announce at one site,
plus one tag membership.**

### 3b. `-ability field 4` — 47 games, one missing field

```
-ability field 4 :: |-ability|p1a|torrent|trace|[from]trace <> |-ability|p1a|torrent|[from]trace
```

`sim/pokemon.ts:1939-1941`:

```js
this.battle.add('-ability', this, ability.name, oldAbility.name, `[from] ${sourceEffect.fullname}`, `[of] ${source}`);
```

The authority writes the **old** ability's name as field 4 on every ability rewrite. This engine
writes the new ability and the `[from]`, and omits field 4. It shows up under 42 distinct ability
names — Trace, Entrainment, Skill Swap and their friends — because the name in field 3 varies; the
defect does not. One field, one call site.

### 3c. `extra event emitted by medicham2` — 4 games

```
extra event emitted by medicham2 :: |-boost|p2b|atk|0 <> |-ability|p2b|defiant|boost
```

The authority's announce sits **inside** `if (boostBy)`. When the stat is already at its cap
`boostBy` is 0, the branch is not taken, and no ability line is written — it falls to
`else if (effect?.effectType === 'Ability')`. This engine announces anyway. Narrow, real, and the
mirror image of 3a.

### 3d. `ordering` — 1 game

```
ordering :: |-ability|p2a|unnerve <> |-damage|p2a|H/H|[from]stealthrock
```

The Unnerve line is written, on the right body, relative to entry-hazard damage in the wrong order.

---

## 4. THE RED DEMONSTRATION — A FOURTH PLANT, INSIDE THE PROOF THE GATE ALREADY READS

It went in `plantedProof`, not into a new test file, because that proof runs on **every** differential
run and `engine/quarantine.js`'s `narrationVerdict` already refuses any run whose
`planted_divergence_proof_ok` is false. A separate test would have been a second thing to remember.

```
an `|-ability|` line ONLY ONE ENGINE WROTE — the retired ability-announcement rule erased this
```

It **inserts** `|-ability|p1a: PLANTED|pressure` into the medicham stream at the last agreeing line,
rather than deleting a real one. A delete is the closer analogue of `MEDI_ANTICIPATION_SILENT`, and it
would be SKIPPED on every pair whose agreeing prefix holds no ability line — a plant that quietly does
not run on most games is the same silence in a new costume. An insert lands on any stream with an
agreeing prefix, so this proof fires on every run or fails. The comparator cannot tell a line one
engine omitted from one the other invented: both are `a[i] !== b[i]` at that index. `p1a: PLANTED` is
a body neither engine can produce, so a catch cannot be the game's own divergence.

**GREEN (AFTER, `--games 1200`, the clean run):**

```
CAUGHT at line 168  exactly where planted: an `|-ability|` line ONLY ONE ENGINE WROTE — the retired ability-announcement rule erased this
CAUGHT at line 168  exactly where planted: a wrong FIELD on the last agreeing line
CAUGHT at line 168  exactly where planted: a MISSING event — the last agreeing line deleted
CAUGHT at line 167  exactly where planted: two agreeing events SWAPPED — the ordering class must fire
```

**RED, ON A DELIBERATE BREAK, SHOWN BEFORE IT WAS TRUSTED.** The old rule was pasted back as
`ability-announcement-DELIBERATE-BREAK` and a 20-game run made:

```
NOT CAUGHT — an `|-ability|` line ONLY ONE ENGINE WROTE — the retired ability-announcement rule erased this
CAUGHT at line 140  exactly where planted: a wrong FIELD on the last agreeing line
CAUGHT at line 140  exactly where planted: a MISSING event — the last agreeing line deleted
CAUGHT at line 139  exactly where planted: two agreeing events SWAPPED — the ordering class must fire
THE COMPARATOR FAILED ITS OWN PROOF — everything below is worthless.
```

`planted_divergence_proof_ok: false`, which is the exact refusal `narrationVerdict` makes on a run it
cannot believe. The break was then restored from a byte-for-byte backup and verified with `cmp`
(`md5` `d608c0f78a06` before and after; `grep -c DELIBERATE-BREAK` → 0).

---

## 5. THE SAMPLE IS THE SAME SAMPLE, AND IT WAS CHECKED RATHER THAN ASSUMED

| pin | BEFORE | AFTER |
|---|---|---|
| release | `18773c22878f` | `18773c22878f` |
| `mode` | `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real` | identical |
| `--games` | 1200 → 961 played | 1200 → **961 played** |
| team store | `data/team-pool-frozen`, pool `0d103fb9fa87`, 8,778 teams, 1,968 picked | identical |
| steering | `empirical-click/v1` (census CREDITED ONLY, does not select) | identical |
| flags | `--arm middle --state --end-state`, cap 50 | identical |
| turn boundaries compared | 10,716 | **10,716** |

`--games` is part of the sample definition and is recorded here for that reason. The census was
regenerated in this tree at 19:08 local; under `--steering empirical` its `census_role` is
*"CREDITED ONLY — it measures coverage and does not select"*, and the identical 961 games and
identical 10,716 turn boundaries on both sides are the measured confirmation rather than the claim.

**THE ONE THING THAT MOVED IS THE RULER, AND THE ARTIFACT SAYS SO.** `driver_code` digest
`9940ba0c3fd9` → `f4b3b2a5c270` for `engine/game_differential.js`. `engine/arms_comparable.js` will
therefore refuse this pair as "provably different code" — correctly. The pair is a
before/after **of the instrument**, which is the one comparison that is allowed to change it.

### The first attempt was VOID and its own guard said so

The first `--games 1200` run wrote `void: true` with
`driver_code_moved: ["engine/game_differential.js"]` — I edited the driver (adding the fourth plant)
while the run was in flight. Its numbers were identical (250 of 961), and **they are not the numbers
quoted above**: the run was repeated on a still tree and every figure in this report comes from that
repeat. The guard was right and it caught its author.

---

## 6. MINOR, NOT MAJOR, AND THE REASONING IS DECLARED

**`Basis.` unchanged — 6.72.0, a MINOR.** The quantity is still *"games whose protocol parts and whose
board never does"*. The definition did not move; the instrument stopped being blind to one line
class. A reader can be told *"0 became 250 on this lattice"*, which is CLAUDE.md's own test for a
MINOR, and ESS KS-RA-13-016 Item 2.0's routine revision — a change related to the regular data
production process — rather than Item 3.0's change in concepts, definitions or classifications.

The repository has the precedent on file: the turn-cap 20 → 50 instrument correction moved
board-material from a `0 of 958` that had 35 games still running when the instrument stopped watching,
and it was released as a MINOR.

**The declaration is under-declaration-prone here and I am saying so out loud:** a major costs the
person declaring it a full documentation pass, so the incentive runs the wrong way. The argument for
MAJOR would be that *every narration figure ABRA has published* was produced under the blind
comparator, which is ESS's "affect[s] a large part of the time series". I am not taking it, because
the series can be **linked** — the same lattice, the same release, the same pool, re-run — and a
series that links is one series. That re-run has not happened yet, which is why the old figure is
**withheld rather than restated** below.

---

## 7. THE RETRACTION, WHICH DOES NOT WAIT FOR A DOCUMENTATION PASS

`docs/ABRA-whitepaper.md` §3 carried `narration **0 undeclared of 961**`. **DELETED, not captioned**,
in this pass, with the retraction stated beside it and no replacement figure printed — the three gate
lattices have not been re-run under the honest comparator. `board-material **0 of 961**` STAYS, because
it was re-measured here at 0 of 961 on the same lattice and did not move.

**`docs/MODELS.md` carries the same figure twice (lines 33 and 1357, `narration 0 undeclared of 961`,
release `cbd510bc2b13`) AND WAS NOT TOUCHED.** That file is mid-edit by the held 7.0.0 draft — 147
insertions in the working tree, including hunks at both of those lines. Editing it would collide with
work I was told not to touch. **It is OWED and it is named below.**

`docs/RUNNING-NOTES.md` and `CHANGELOG.md` are LOGS — append-only, never edited to agree with today —
so their `0 / 0 / 0` rows stand as the history they are. The new row supersedes them in place.

---

## 8. FILES CHANGED

| file | what |
|---|---|
| `engine/game_differential.js` | `ability-announcement` retired into `RETIRED_EQUIV` (published as `normalisation.retired`, printed every run); `auditAbilityLines` / `abilityAuditRows` + `normalisation.ability_lines` and `ability_lines_compared`; the printed `\|-ability\|` table; a fourth plant in `plantsFor`; three new exports |
| `docs/ABRA-whitepaper.md` | the narration figure retracted (§7) |
| `docs/RUNNING-NOTES.md` | the 6.72.0 row |
| `CHANGELOG.md` | 6.72.0 |
| `docs/MEASURE.md` | the division ledger entry (outside the `<!-- GENERATED -->` block) |

Nothing under `data/` was written by this pass except the release-cut side effects named below.

---

## OWED, NOT RUN

- **THE THREE GATE LATTICES HAVE NOT BEEN RE-RUN AND THERE IS NO NEW PUBLISHED NARRATION FIGURE.**
  `data/game-differential.json`, `data/game-differential.g1350.json` and `.g1950.json` still hold
  `0 / 0 / 0`, measured by the blind comparator. **Those three zeros are WITHHELD, not corrected.**
  The 250-of-961 figure in this report is a SCRATCH artifact at one lattice
  (`<scratch>/after2.json`) and is not a gate reading. Re-run all three after ENGINE lands §3.
- **BOARD-MATERIAL WAS RE-MEASURED ON ONE LATTICE ONLY.** 0 of 961 at `--games 1200`, unchanged.
  1350 and 1950 are unmeasured under the honest comparator. The expectation is that they are also
  unchanged — the board comparison does not read the protocol normaliser — but that is a prediction
  and not a measurement.
- **`engine/quarantine.js` WAS NOT RUN, AND ITS NARRATION CLAUSE NOW GATES.** `narrationClause`'s
  `gates` flag is the board clause's own verdict, and that clause reads zero. So on the next gate run
  the narration clause will hold the gate SHUT at 250. That is the correct behaviour and it is not a
  regression; it is the number that was always there. Whoever runs the gate next should expect
  `GATE: CLOSED` on the narration clause and should not read it as the engine getting worse.
- **THE FULL TEST BATTERY WAS NOT RUN** (the brief forbids it), and **some probes will now be red**.
  Any probe that takes its verdict from `playGame`'s whole-stream comparison on a fixture carrying
  Stamina, Speed Boost, Moody, Lightning Rod, Cloud Nine, Weak Armor, Sap Sipper or an ability
  rewrite will part where it used to agree. 251 test files require `engine/game_differential.js`; how
  many of them read the whole-stream verdict has not been counted. **These are true reds, not new
  defects** — they are §3 becoming visible — but they are reds, and they are on the table.
- **Three test files carry prose that is now stale**, naming the drop in the present tense and
  explaining that their probe compares raw lines because of it: `tests/probe_start_announce.js:19`,
  `tests/test-imposter-transform-line.js:143`, `tests/test-precharge-order.js:199`. Plus ~20 more
  probe headers and ~7 `docs/ENGINE.md` passages. Reported, not edited — none of them is wrong about
  what its own probe does.
- **`docs/MODELS.md` LINES 33 AND 1357 STILL PUBLISH `narration 0 undeclared of 961`.** Not touched,
  because the file is mid-edit by the held 7.0.0 draft (§7). This is a live retraction owed in the
  next pass that touches that file.
- **`tests/test-docs-current.js` IS RED AND IT IS NOT MINE, AND IT IS NAMED RATHER THAN FILED.**
  35 passed / 2 failed: `figures a cited artifact does not contain` (baseline 18, now **29**) and
  `figures bound to no trace` (baseline 1884, now **1880**, but with NEW entries). **Measured both
  ways**: with only my five files stashed the gate reads the SAME 35/2 and the SAME 1880, and every
  NEW entry names `docs/ABRA-deck-plain-english.md`, `docs/ABRA-technical-docs.md`,
  `docs/MODELS.md` or `docs/SUMMARY.md` — the four documents already modified in the working tree by
  the **held 7.0.0 draft** when this session began. Against clean `HEAD` the gate reads 37/0. My
  edits contribute **zero** new entries to either clause. This is the 7.0.0 draft's to clear, and it
  is red now.
- **`node engine/docs_scan.js --owed` reads 96 of 100** after this row — four rows of headroom before
  the build fails. That is the next document pass's problem and it is close.
- **`node engine/status.js --write` was not run**, per the brief. The `<!-- GENERATED -->` block in
  `docs/MEASURE.md` is whatever the last writer stamped and was not hand-edited.
- **Not committed, not pushed.**
- **RELEASE-CUT SIDE EFFECTS I CAUSED, REPORTED RATHER THAN REVERTED.** Two failed `node -e` probes
  appended two cut events to `data/releases/18773c22878f/cuts.jsonl` (`by.entry: "(node -e)"`, at
  00:21:18Z and 00:21:32Z) and moved `latest_cut` / `latest_why` / `pointer_written` in
  `data/engine-release.json`. The release id is unchanged at `18773c22878f`, `cut`/`why` are
  untouched, and a re-cut over an identical tree appends by design. `data/releases/18773c22878f/release.json`
  gained 18 lines the same way. Left as written; they are events, not state.
- **Debris reported, not deleted:** `<scratch>/after.json` is the VOID first run and is kept beside
  the valid one on purpose. `data/roster.abilities.prev.json` and `data/roster.moves.prev.json` were
  already in the tree when this session started and are not mine.
