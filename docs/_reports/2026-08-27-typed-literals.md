# Typed vs derived illegal species literals — 2026-08-27, MEASURE

Findings record. Not a living document, never current state, superseded by the register rows it feeds
(ROADMAP #471, #472). Every figure below is dated evidence; re-run the instrument rather than quoting it.

---

## VERDICT

**All ten are TYPED. Zero are DERIVED.** The brief's nine was a site count; the derived population is
**ten literals at nine sites**, and the tenth is `tests/test-choice-lock.js:56`, which declares two on
one line. Evidence for TYPED, per literal, is below — it is not the file's say-so.

**The DERIVED class the brief was pointing at is real, larger, and lives somewhere else entirely.**
Not one derived value reaches a source literal, and that is true by construction rather than by luck:
a derived name never appears in `.js` at all. It appears in `data/`. **76 of 88,179 stored games
(0.09%) name at least one species this regulation does not contain, 71 distinct**, and they reach
**17 generated artifacts** including `data/meta-usage.json`, the file CHOMP reads.

**Repaired: 7 of 10** — the one I own in `tests/bench-medicham.js` and the six in `engine/playstyle.js`.
**Reported and left: 3** in two test files I do not own.

**What the repaired benchmark invalidates: `data/medicham-bench.json`'s 0.4614 ms/turn is withdrawn,
and it was invalid the day it was recorded, not because the roster changed.** Amoonguss has never been
in `data/engine-data.js`, so the pinned six has never been six. The re-record is OWED; this batch may
not play a game.

**Where the filter belongs for the derived ones:** one new rule in `data/quality-filter.json`, read by
`reasons()` in `engine/quality.js`, with a `FUNNEL_STEPS` entry beside it. Upstream of every reader,
so it is one edit and not seventeen. **The predicate must ask about CARRIERS, not `isNonstandard`.**

---

## 1. The population, derived rather than taken from the brief

Scan: every string literal in every `.js` outside `data/`, `node_modules`, `docs`, `memory`,
comments stripped, keeping only literals that **name themselves** as a species (`dex.species.get(s).id
=== nrm(s)`, rule 1 of `engine/fixture_legality.js`) and are either `isNonstandard` / `tier: 'Illegal'`
or absent from `MC.mons`. **52 hits, 30 distinct literals.**

Most of those are not bodies. This repository names its own models, CLI flags and MCP servers after
Pokémon, which is exactly the false-positive class `fixture_legality.js`'s blind-spot 1 already
documents. Splitting by **what the literal is used as**:

### NOT A BODY — reported, not touched, not counted among the ten

| site | literal(s) | what it actually is |
|---|---|---|
| `engine/build-status.js:34–53` | Xatu, Porygon, Dusclops, hypno/HYPNO/Hypno, kadabra/KADABRA/Kadabra, xatu | this project's own MODEL names and their `full:` labels. XATU, PORY, DUSK, HYPNO, KADABRA are ABRA models |
| `engine/mag_bot.js:143`, `engine/mew.js:183` | `--miltank` | a CLI flag |
| `engine/orient.js:143` | `abra` | a module id passed to `broken()` |
| `mcp/server.js:33` | `abra` | the MCP server's own name |
| `tests/test-model-map.js:146,300–303` | MAGNEMITE, ZUBAT | model names |
| `engine/game_differential.js:4505` | `smeargle` (paired with `ditto`) | a state PLANT — the proof deliberately flips a species string to prove the comparator detects it. Two distinct strings is the whole requirement |
| `tests/test-mc-seal.js:124` | `urshifurapidstrike` | a PLANTED BREAK that must THROW. The key's absence from `MC.mons` is the point of the assertion |
| `tests/test-click-match.js:78–84` | `Floette` | **not illegal in context.** The sheet declares `Floette-Eternal`, which is LEGAL (`isNonstandard: null`, tier UU); `Floette` is the BASE name Showdown writes on the battle line, and folding base↔forme is what the test measures |
| `engine/medicham2-browser.js:5797` | `",floette:"` | a fragment. Rule 1's normalisation looseness, already named in `fixture_legality.js`'s blind spot 4 |
| `engine/tag_dex.js:8684` | `Eiscue` | inside a `/* */` block that documents `formeChange("Eiscue")`. A comment-stripper artefact of my scan, not a live literal |

### A BODY — the ten

| # | site | literal | reaches | TYPED or DERIVED |
|---|---|---|---|---|
| 1 | `tests/bench-medicham.js:45` | `amoonguss` | `M.buildMon()` in the pinned ROSTER | **TYPED** |
| 2 | `engine/playstyle.js:63` | `groudon` | `roleSet('SUN', …)` | **TYPED** |
| 3 | `engine/playstyle.js:64` | `gigalith` | `roleSet('SAND', …)` | **TYPED** |
| 4 | `engine/playstyle.js:95` | `rillaboom` | `roleSet('FAKEOUT', …)` | **TYPED** |
| 5 | `engine/playstyle.js:95` | `mienshao` | `roleSet('FAKEOUT', …)` | **TYPED** |
| 6 | `engine/playstyle.js:95` | `hitmontop` | `roleSet('FAKEOUT', …)` | **TYPED** |
| 7 | `engine/playstyle.js:95` | `purugly` | `roleSet('FAKEOUT', …)` | **TYPED** |
| 8 | `tests/test-charge.js:145` | `rillaboom` | `mk('rillaboom')` — a real third body | **TYPED** — not mine |
| 9 | `tests/test-choice-lock.js:56` | `rillaboom` | `b.party.p1` bench | **TYPED** — not mine |
| 10 | `tests/test-choice-lock.js:56` | `amoonguss` | `b.party.p1` bench | **TYPED** — not mine |

All ten are `isNonstandard: 'Past'`, `tier: 'Illegal'` in `gen9championsvgc2026regmb`, asked of
`Dex.forFormat(CS.FORMAT)`. **Positive control on the same call, same file:** the five roster-mates of
#1 return `isNonstandard: null` and a non-null `mcKey` through the identical code path, so the
accusation is the format's and not the instrument's.

---

## 2. Why all ten are TYPED, and it is not an assumption

Three independent lines, because the brief is right that they look identical in a file.

**(a) THE STRUCTURAL ONE, AND IT IS DECISIVE.** A derived value has no source literal. If the name is
in the `.js`, a human wrote it. There is no mechanism by which a store row reaches a `const ROSTER =
[…]`. This is the same argument `engine/fixture_legality.js` makes about its own population and it now
says so in the artifact (`origin: 'TYPED'`).

**(b) THE STORE CANNOT HAVE PRODUCED THE SIX ROLE PRIORS.** `playstyle.js`'s `LIVE` set is derived from
`data/smogon-priors.json`. `USAGE['amoonguss']`, `['rillaboom']`, `['groudon']`, `['gigalith']`,
`['mienshao']`, `['hitmontop']`, `['purugly']` are all **`null` — no usage row at all**. A derivation
cannot emit a name its source does not contain.

**(c) THE FILES SAY SO, AND THEY WERE CHECKED RATHER THAN BELIEVED.** `playstyle.js`'s own header:
*"Every species list below is a hand-typed guess at a role"*. `bench-medicham.js`'s: *"Six species
chosen to exercise different paths"*. Consistent with (a) and (b) rather than standing alone.

**The coordinator's hypothesis — "the role priors look derived" — is REFUTED**, and refuting it was
worth the time, because the derivation pathway it was pointing at turned out to exist somewhere else
and to be much bigger.

---

## 3. What was repaired

### 3.1 `tests/bench-medicham.js` — and the benchmark was already dead

The literal was the smaller half.

- **`amoonguss` has never been in `data/engine-data.js`.** Checked on every commit that touched the
  file back to 2026-07-23: **zero key hits, twenty commits**, including `9a060821` on 2026-08-10, the
  day the benchmark was written.
- **At the baseline commit `5884fd23` (2026-08-10), `buildMon` returned `null` silently** —
  `function monRow(key){ return (key&&MC.mons[key])||null; }` / `if(!m) return null;`.
- **Every game draws all six roster indices exactly once** (`a = g%6, g+1, g+2`; `b = g+3, g+4, g+5`),
  so **all 120 games ran with a null body on one side**. `turns: 450` against a 120 × 12 cap is the
  fingerprint of a side that could not last.
- **Therefore `data/medicham-bench.json`'s 0.4614 ms/turn timed five bodies and a hole, and is
  withdrawn.** It was invalid when recorded. That is a separate claim from "this repair invalidates
  it", and the separate claim is the true one.
- **Today it cannot run at all.** `monKey` throws (`engine/lookup.js`, armed 2026-08-02):
  `LookupMiss: MC.mons: no entry for "amoonguss"`. The canonical speed benchmark that ROADMAP #76 and
  #61 exist to provide has been dead, loudly, and nothing said so.

**The replacement is derived, not picked.** The slot's stated job is *"a status-heavy body"*. Ranking
every legal, MC-carried, `buildMon`-safe species (318 of them) by Status-category moves in the set
`buildMon` actually gives it, keeping those that retain a damaging move (Amoonguss's real set is three
status and one attack, not four), and taking the highest team-rate body in the **sub-56 Speed tier** —
the tier Amoonguss occupied at base 30, and the one farigiraf's Trick Room acts on — gives **toxapex**:
3.63% of teams / 1,554 games, base Speed 35, Regenerator + Leftovers, Infestation / Toxic / Wide Guard
/ Baneful Bunker. `champions_sim.checkLegal`: **legal**, as are the other five.

**What this changes about what the benchmark measures, stated before the re-record rather than after:**
turn COUNT rises, because a sixth living body plays where a hole was, and ms/turn moves with it in an
**unknown direction** — Toxapex adds damage, status and side-condition work per turn that a null
contributed nothing to. The old number is not a comparand in either direction.

**Two guards, both aimed at exactly this failure and neither of them a new gate:**

- `mk()` throws on a null body instead of playing a hole. It matters for `--vs <relId>`, which loads a
  FROZEN engine whose `buildMon` may still return null — the one run where a quiet hole would read as
  an optimization.
- the comparison **REFUSES** when `base.roster` differs from `ROSTER`. The artifact has always carried
  `roster` and **nothing ever compared it**, so the file's own *"changing this list invalidates every
  stored number"* was prose. It now refuses instead of annotating, which is the distinction CLAUDE.md
  draws about captions.

### 3.2 `engine/playstyle.js` — six removed, and no label moves

Removed: `groudon` (SUN), `gigalith` (SAND), `rillaboom`, `mienshao`, `hitmontop`, `purugly` (FAKEOUT).

**No legal forme collapses onto any of the six** — measured by family, not asserted:

```
amoonguss  family=1  LEGAL members: NONE      floette   family=3  LEGAL: Floette-Eternal, Floette-Mega
rillaboom  family=2  LEGAL members: NONE      tyranitar family=2  LEGAL: Tyranitar, Tyranitar-Mega
groudon    family=2  LEGAL members: NONE      mimikyu   family=4  LEGAL: Mimikyu, Mimikyu-Busted
gigalith / mienshao / hitmontop / purugly     family=1  LEGAL members: NONE
```

**No classification changes, and that is measured.** The role sets resolve identically before and
after, because `roleSet` already dropped all six for having no usage row:

```
RAIN     LIVE=[pelipper, politoed]              DEAD=[]
SUN      LIVE=[torkoal, ninetales, charizard]   DEAD=[groudon]      -> DEAD=[]
SAND     LIVE=[tyranitar, hippowdon]            DEAD=[gigalith, tyranitarmega] -> DEAD=[tyranitarmega]
FAKEOUT  LIVE=[incineroar, meowscarada]         DEAD=[rillaboom, mienshao, hitmontop, purugly] -> DEAD=[]
```

The only artifact field that moves is `dead_list_entries`, **7 → 1**, at the next regeneration. I did
not regenerate: `playstyle.js` reads the store, another agent is appending to it, and no figure here
needs the artifact.

**`tyranitarmega` stays.** It is LEGAL (tier UU, base Tyranitar) and dead by NAMING, which the file's
own header explains — a different bug from an illegal name, and not mine to decide.

**The audit now says WHICH KIND of dead a member is.** It pooled "outside the regulation" with "no
usage", which is how a typed illegal name survived an audit built to catch it. Three arms, controlled:

```
groudon             NOT IN THIS REGULATION — delete it from the source, the audit only hides it
tyranitarmega       a forme name, and the store writes base forms
florgeswhite        a forme name, and the store writes base forms
floette             no usage in the table
```

---

## 4. The DERIVED half, and where its filter belongs

### 4.1 It is real and it is measured

Scanning both human stores (`games.bo3.jsonl` + `games.ladder.jsonl`, `sheets` / `six` / `brought`):

**76 of 88,179 games (0.09%) name at least one species outside this regulation. 71 distinct.**
salamence 18 games, revavroom 9, riolu 9, tapukoko 9, **rillaboom 9**, **amoonguss 8**, chienpao 8,
ogerponwellspring 8, ironvaliant 8, ursalunabloodmoon 8, indeedee 7, smeargle 6, …

These are Will's custom-rule games still tagged reg-mb.

### 4.2 Nothing filters them, and that is a specific, locatable gap

`data/quality-filter.json` is *"the single definition of a USABLE game"*, read by `reasons()` in
`engine/quality.js`. It holds five rules: `exclude_bot_games`, `exclude_behavioural_bots`,
`exclude_forfeits`, `min_turns`, `require_full_bring`. **None of them is about legality.** So a
custom-rules game is CLEAN by every check this project applies.

### 4.3 Where it lands — `node engine/fixture_legality.js --derived`

**17 artifacts**, 258 `data/*.json` parsed:

| distinct | artifact | stamped |
|---|---|---|
| 89 | `data/battle-formes.json` | 2026-07-25 00:12 |
| 69 | `data/bring-priors.json` | 2026-08-26 21:11 |
| 53 | `data/mega-dex-official.json` | 2026-08-02 22:20 |
| 37 | `data/mega-decision.json` | 2026-08-07 03:02 |
| 19 | `data/sheet-usage.json` | 2026-08-11 00:58 |
| 15 | `data/xatu.json` | 2026-08-04 21:47 |
| 12 | `data/species-abilities.json` | 2026-07-31 20:20 |
| **11** | **`data/meta-usage.json`** — the file CHOMP reads | 2026-08-26 21:11 |
| 10 | `data/move-priors.observed.json` | 2026-08-26 21:11 |
| 8 | `data/engine-diff.json`, `data/move-priors.json` | 2026-08-27 |
| 4 | `data/mega-usage.json`, `data/pokemon-roles.json`, `data/porygon2-species.json` | |
| 1 | `data/medicham-bench.json`, `data/mutation-coverage.json`, `data/redirect-audit.json` | |

`data/engine-diff.json` (04:43) and `data/diff-team-pool.json` (04:50) were being written by another
agent while this scan ran. They are named for completeness and **no figure here rests on either**.

### 4.4 The filed location — exact

**`engine/quality.js`, in `reasons()` (~line 158), driven by a new rule in `data/quality-filter.json`,
with a matching `FUNNEL_STEPS` entry.**

That is upstream of `analyze.js`, `bring_priors.js`, `derive_sets.js`, `playstyle.js`, `cores.js` and
every other reader, which is why it is **one edit and not seventeen**. A filter applied to an artifact
after the name has landed is the wrong place by construction: the generator writes it straight back.
Filed as ROADMAP #471; NOT implemented here, because `engine/quality.js` is not this batch's to change
and because the cost has not been measured.

**AND THE PREDICATE MUST ASK ABOUT CARRIERS.** Artifacts collapse formes to BASE names.
`Floette-Eternal` and `Floette-Mega` are LEGAL; their base, `Floette`, is `Past`/`Illegal`. A bare
`isNonstandard` filter deletes the largest usage row in the table — **316,361 raw**. The correct
predicate:

```
outside(s):  S = dex.species.get(s)
             if S does not name itself                       -> not a species literal
             if (!S.isNonstandard && S.tier !== 'Illegal')    -> INSIDE (legal in its own right)
             return !legalBase.has(S.id)   // a legal forme may collapse onto this base name
```

**Not measured, and it is a judgement rather than a derivation:** whether to drop the GAME or only the
offending species row, and what either costs. 0.09% is an upper bound on a whole-game exclusion; the
per-artifact effect is unknown.

---

## 5. The sweep now says which kind it has found

`engine/fixture_legality.js`:

- `findings` and `pairs` carry **`origin: 'TYPED'`** with the repair line *"a string literal in source
  — replace it"*, and the header explains why that is true by construction rather than by luck.
- the CLI prints the ORIGIN line and `notStaticallyPairedDerived` — **192 of the 520** construction
  sites outside the population build their body from a derived value, which is the DERIVED-shaped half
  the sweep already declined to guess about.
- **`derivedScan()` / `--derived`** answers the other question: which generated artifact carries a name
  this regulation does not contain, with the opposite instruction attached — *do NOT edit the
  artifact.*
- **It is not wired into the gate**, deliberately. The gate is a ratchet on the TYPED population;
  adding an unratcheted second population to it is a new failure surface with no baseline, and
  `derivedScan()` walks `data/` and costs seconds.

### 5.1 The instrument was wrong first, and its own control caught it

`derivedScan`'s first predicate asked whether a name was in a set built by walking
`dex.species.all()` filtered to the regulation. **Cosmetic formes are not in that walk** — they hang
off the base as `cosmeticFormes` — so it accused **four legal bodies**: `florgeswhite`, `florgesblue`,
`alcremiesaltedcream`, `furfroudandy`, every one `isNonstandard: null`, `tier: 'UU'`, across **seven
artifacts**. That is CLAUDE.md's `.all()` warning in the other direction: the filtered walk is right
for ENUMERATING and wrong for DECIDING one name; `dex.species.get` resolves a cosmetic forme to a row
that carries its own legality.

Effect of the correction, measured: 20 artifacts → **17**; `bring-priors` 77 → 69; `xatu` 22 → 15;
`meta-usage` 15 → **11**; `move-priors.observed` 12 → 10; `pokemon-roles` 6 → 4;
`jolteon-weights.json` and `diff-team-pool.json` leave the report entirely.

**Two negative controls now ship with the scan** and are printed on every run: `floette` (a legal
forme's illegal base — if it appears, the predicate has regressed to a bare `isNonstandard` check) and
`florgeswhite` (a cosmetic forme — if it appears, the predicate is asking a walk instead of a row).

That is the seventeenth instrument failure in two days and the first one caught before it was
published rather than after.

---

## 6. No game number moved — predicted, then checked

| | before | after |
|---|---|---|
| `.js` files scanned | 428 | 428 |
| set declarations | 1308 | 1308 |
| distinct sets | 411 | 411 |
| distinct sets REJECTED | 40 | 40 |
| distinct verdicts | 30 | 30 |
| illegal DECLARATIONS (pairs) | 30 | 30 |
| UNREACHABLE | 1 | 1 |
| not statically paired | 520 | 520 |
| **`tests/test-fixture-legality.js`** | **2 FAILED** | **2 FAILED** |

The gate's two failures are the 15 new verdicts and 15 new pairs the position-independent row matcher
armed on 2026-08-27. **They are correct, they are not mine, and no allowance was added.**

Predicted in advance and confirmed: both repaired lists are BARE SPECIES LISTS, which
`fixture_legality.js` blind-spot 1 excludes from the population by measurement, so neither repair could
move a sweep number. No engine byte, no census, no differential, no release, no store read.

---

## OWED, NOT RUN

1. **`node tests/bench-medicham.js --record` on a quiet machine.** This batch may not play a game.
   **Until it runs there is NO speed baseline for MEDICHAM**, and no optimization may claim a delta —
   the comparison now refuses rather than printing one. `data/medicham-bench.json` still holds the
   withdrawn 0.4614 ms/turn and the roster containing `amoonguss`; it is left as it is on purpose,
   because the refusal is what should surface it, and because editing an artifact by hand is the
   failure this whole batch is about.
2. **The repaired benchmark has not been executed at all**, so the `mk()` null guard and the roster
   refusal are read but not observed firing. The roster refusal is the one that WILL fire on the first
   run, against the stored `amoonguss` roster — that is the intended first output.
3. **`engine/playstyle.js` was not re-run**, so `data/playstyle-matchups.json` still carries the old
   `dead_list_entries` (7, without reasons). Predicted at the next regeneration: **7 → 1**, the
   survivor being `tyranitarmega:(a forme name, and the store writes base forms)`, and **no style label
   moves**. Not verified by execution.
4. **ROADMAP #471 is filed, not fixed.** No legality rule has been added to `data/quality-filter.json`.
   The cost of adding one is unmeasured: 0.09% of games is an upper bound on a whole-game exclusion,
   the per-artifact effect is unknown, and drop-the-game vs drop-the-species-row is a judgement.
5. **Three typed literals were left in place** — `tests/test-charge.js:145` (`rillaboom`) and
   `tests/test-choice-lock.js:56` (`rillaboom`, `amoonguss`). Both are live bodies in fixtures I do not
   own. Repairing them changes what those scenarios measure, which is the owning division's call.
6. **The 17 contaminated artifacts were not regenerated and must not be**, until #471 lands. Any figure
   read from `data/meta-usage.json`, `data/bring-priors.json`, `data/sheet-usage.json` or
   `data/xatu.json` today includes species this regulation does not contain.
7. **`data/battle-formes.json` (89), `data/mega-dex-official.json` (53) and `data/mega-decision.json`
   (37) were NOT diagnosed.** They are the three largest rows in §4.3 and they are older than the store
   contamination story; they may be a mega-dex build walking the National Dex rather than store
   contamination at all. That is a different defect with a different filter and it is unexamined.
8. **No `node engine/status.js --write`.** Forbidden to this batch; the generated blocks are unstamped.
