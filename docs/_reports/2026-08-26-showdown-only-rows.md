# The eight SHOWDOWN-ONLY rows — what they are, why the flag is unset, and whether they should count

MEASURE, 2026-08-26. Read-only pass. No game was played, nothing was written outside this file.
Every artifact was read with `git show HEAD:<file>` because ENGINE is live in the tree.

Artifact under examination: `data/all-mechanics-fire.json`
`generated 2026-08-26T21:02:01.999Z`, `release 667278050dcf`, `arm bottom-tie-first`.
Current release (`data/engine-release.json`) is `667278050dcf` — the artifact is **not** stale.

---

## VERDICT

**Zero of the eight are engine defects that the mechanics clause is failing to catch.** Six are the
instrument; one (Forewarn) is a known narration gap already in Will's closet; one (Supreme Overlord)
is a divergence the whole-game clause **already declares AUTHORITY-WRONG** and the mechanics clause
counts anyway — that one is the real bug in this set, and it holds the gate shut today.

**The flag is unset because `counts_against_the_gate` was never a gate opinion.** It is written in
exactly one place — `engine/all_mechanics_fire.js:3334`, inside `applyCloset()` — always to `false`,
never to `true`, and **it is read by zero lines of code in this repository.** It marks Will's closet
and nothing else. `undefined` therefore means "not on the shelf", not "unclassified". Ten rows carry
it; that is the ten shelved rows (3 moves + 6 abilities + 1 item), and the counts match
`shelved_by_owner` exactly.

**The deeper hole is real, and it is one layer up.** `SHOWDOWN-ONLY` is a verdict **no gate, clause
or test reads.** Grep for `showdown_only` / `SHOWDOWN-ONLY` outside the generator returns two
comments and nothing else. The mechanics clause (`classifyMechanics`, `engine/quarantine.js:711`)
filters on `if (!r || !r.diverged || r.deferred) continue;` — it never looks at `verdict`. So a class
that says on its face *"the authority moved and we did not"* is published, printed to the console,
and consumed by nobody. That is the correct answer for these eight (see below) and it is correct **by
accident**: nothing checked.

**Should they count? No — but only because something measured them, not because the field is blank.**
Argued from the clause's own bar below.

---

## 1. WHAT ACTUALLY HAPPENED, PER ROW

`SHOWDOWN-ONLY` is decided at `engine/all_mechanics_fire.js:2841-2845`:

```js
const sdMoved = !same(GD.sdStream(on.sdLog), GD.sdStream(off.sdLog));
const meMoved = !same(on.mediTrace,          off.mediTrace);
...
else if (sdMoved && !meMoved) verdict = 'SHOWDOWN-ONLY';
```

`GD.sdStream` is a **filter only** — it keeps every line kind in `M.TRACE_EVENTS` (43 kinds,
including `-ability` and `-activate`) and drops transport. It does **not** apply `semantic()` /
`EQUIV`, the cross-engine equivalence layer whose whole job is to stop two protocol vocabularies
reading as a disagreement. The whole-game divergence on the same pair of games **does** apply it.

**Two rulers, one pair of games.** `EQUIV`'s first rule is `ability-announcement`:
`fn: f => (f[1] === '-ability' ? null : f)` — Showdown's on-entry `-ability` line is declared
cosmetic and dropped. `sdStream` keeps it. That single asymmetry produces this entire class.

### The proof that six of them carry no board content at all

For the six rows with `diverged: false`, both arms report `NO-DIVERGENCE` with
`boundaries_agreed === boundaries` (4/4 or 5/5). Write `R` for the differential's reduced stream:

- `R(sd_ON) = R(me_ON)` — the ON arm did not diverge
- `R(sd_OFF) = R(me_OFF)` — the control arm did not diverge
- `me_ON == me_OFF` byte-identical — that is what `meMoved: false` means

⟹ `R(sd_ON) = R(sd_OFF)`. **The authority's own reduced stream is identical between the two arms.**
Since `sdMoved` was computed *without* that reduction, the entire ON-vs-OFF difference in Showdown's
log lives in what `semantic()` drops — announcements and attributions. The authority's **board** did
not move either. The verdict name is wrong on its face for these six.

That argument does not depend on any per-ability reasoning. The per-ability reading below says
*which* announcement, read off the authority's source.

### The table

Usage from `data/sheet-usage.json` (13,116 open-sheet games). Ability reach shelf derives to
**6 teams** (25 clicks × 13,116 / 64,846 = 5.06, ceil 6).

| ability | teams | which line flipped `sdMoved` | whose line | real defect? |
|---|---|---|---|---|
| **Unnerve** | 2,343 | `\|-ability\|p1a: Aerodactyl\|Unnerve` on entry | the subject's | **No.** Roster: `FIRED-AND-BOARDS-MATCH`, Sitrus retained, HP 79 vs 119 |
| **Rock Head** | 1,885 | `\|-ability\|…\|Pressure` — **the control's** | the control's | **No.** Rock Head calls no `this.add` anywhere. Roster: recoil cancelled, HP 600 vs 584 |
| **Mold Breaker** | 338 | `\|-ability\|p1a: Basculegion\|Mold Breaker` | the subject's | **No.** Roster: Mud-Slap lands through Levitate, HP 157 vs 167, accuracy −1 vs 0 |
| **Pressure** | 223 | `\|-ability\|p1a: Absol\|Pressure` | the subject's | **No board defect.** PP is compared now (16/16 slots) and agreed |
| **Natural Cure** | 147 | `\|-ability\|…\|Cloud Nine` — **the control's** | the control's | **No defect shown — and not confirmed either.** See the caveat below |
| **Supreme Overlord** | 112 | `\|-end\|…\|fallenundefined\|[silent]` | the subject's | **No.** Already declared AUTHORITY-WRONG. This is the one that counts wrongly |
| **Super Luck** | 19 | `\|-ability\|…\|Pressure` — **the control's** | the control's | **No.** Super Luck calls no `this.add`; and this arm resolves the crit die as a constant |
| **Forewarn** | 4 | `\|-activate\|…\|ability: Forewarn\|Hydro Pump` | the subject's | **Known narration gap, already shelved by Will 2026-08-10** |

Source lines for "whose line", read from `pokemon-showdown/data/abilities.ts` (none of the eight is
overridden in `/data/mods/champions/abilities.ts` except Natural Cure, which is):

- `moldbreaker:2681` `this.add('-ability', pokemon, 'Mold Breaker')`
- `unnerve:5254` `this.add('-ability', pokemon, 'Unnerve')`
- `pressure:3429` `this.add('-ability', pokemon, 'Pressure')`
- `cloudnine:536` `this.add('-ability', pokemon, 'Cloud Nine')` — **a control, not a subject**
- `supremeoverlord:4732` `this.add('-end', pokemon, \`fallen${this.effectState.fallen}\`, '[silent]')`
- `rockhead:3896-3902`, `superluck:4695-4698` — **no `this.add` at all, in any handler**
- controls `swiftswim:4800`, `synchronize:4849`, `defiant:891` — silent on entry

### The reciprocal-pair artefact

The harness picked its controls from the carrier's own ability slots, and two of the pairs are
mutually reciprocal:

- Absol: **Pressure** (control Super Luck) and **Super Luck** (control Pressure)
- Aerodactyl: **Unnerve** (control Rock Head) and **Rock Head** (control Pressure)

Each pair contains exactly one ability that announces on entry. **Four rows in this class are
produced by one announcement line each, twice over** — once charged to the ability that emits it and
once charged to the ability that happens to be sitting opposite it.

The harness knows: `control_not_quiet: true` on six of the eight, with
*"A third arm would settle it; this pass did not run one."* The deliberate roster **does** run one
(`second_control.ran: true`), which is why it is the stronger instrument on exactly this question.
`all_mechanics_fire.js` flags 108 of 316 ability rows `control_not_quiet` and resolves none of them.

---

## 2. IS EACH A DEFECT, A FIXTURE ARTEFACT, OR A FACT ABOUT THE FORMAT?

**Six are fixture artefacts of the A/B control choice, plus one reducer asymmetry.** Named plainly:

- *Showdown says "Mold Breaker!" when the body walks in and our engine says nothing.* The
  ability-ignoring itself works.
- *Showdown says "Unnerve!" on entry and we say nothing.* The berry block works.
- *Showdown says "Pressure!" on entry and we say nothing.* The extra PP deduction agrees.
- *Rock Head and Super Luck were each measured against a control that announces itself, so the
  announcement got charged to a silent ability.* Neither ability emits a protocol line in any engine.
- *Natural Cure was measured against Cloud Nine, which announces itself.*
- *Supreme Overlord closes a marker the authority spells `fallenundefined`.*

**Nothing here is a fact about the format.** All eight abilities are legal, carried, and tagged with
live params in `data/tags.json`.

### Corroboration from two independent instruments, both on release `667278050dcf`

`data/roster.abilities.json` (generated 21:01:25, 36 seconds before the mechanics run):

```
moldbreaker      FIRED-AND-BOARDS-MATCH
naturalcure      FIRED-AND-BOARDS-MATCH
rockhead         FIRED-AND-BOARDS-MATCH
unnerve          FIRED-AND-BOARDS-MATCH
forewarn         CONTROL-NOT-QUIET
pressure         CONTROL-NOT-QUIET
superluck        CONTROL-NOT-QUIET
supremeoverlord  CONTROL-NOT-QUIET
```

`data/mechanics-census.json` — every tag these eight carry has at least one `live: true` probe in
`tests/test-mechanics.js`:

| tag | probes | named on |
|---|---|---|
| `ignoresDefenderAbility` | 2 | *"Mold Breaker ignores Levitate, in the calc AND in the turn"* |
| `blocksBerries` | 1 | *"Unnerve stops the foe eating a berry"* |
| `noRecoil` | 1 | *"Rock Head takes no recoil"* |
| `deductsExtraPP` | 2 | *"Pressure halves how often a foe-aimed move can be clicked"* |
| `switchOutTrigger` | 1 | *"Natural Cure clears the status on the way out"* |
| `boostsFromFallen` | 6 | includes *"…refuses the authority fallenundefined"* |
| `critRatioUp` | 2 | Night Slash and Merciless — **not Super Luck** |
| `announcesOnEntry` | 1 | Frisk — **not Forewarn** |

### THE TWO PLACES I WILL NOT SAY "FINE"

**Natural Cure is the genuinely unmeasured one.** The roster's green is weak here. Its `sd_delta`
carries **only the ability-name leaves** (`p2.party.altaria.ability with=naturalcure
without=cloudnine`) and no `status` leaf — so the roster staged a switch-out with nothing to cure,
exactly as the mechanics harness did (`fixture_status: null`, and the preflight note on the row says
so in as many words: *"a board whose bodies are healthy shows nothing whatever the engine does…
Natural Cure read 419 identical leaves for exactly this reason"*). Two instruments agreeing that
nothing happened is not two instruments confirming the cure. The census probe *"Natural Cure clears
the status on the way out"* is the only thing that covers it, and I did not run it. **Owed.**

**Super Luck has no probe naming it.** `critRatioUp` is live via Night Slash and Merciless; Super
Luck's own `+1 crit ratio` on a carrier is covered by neither. And its preflight says the mechanic
*cannot* be tested under this arm — *"this run's arm resolves that roll as a CONSTANT"*. At 19 teams
it sits above the 6-team shelf. **Owed.**

Neither is an accusation. Both are gaps I can name and did not close.

---

## 3. WHY THE FLAG IS UNSET

`engine/all_mechanics_fire.js:3325-3341`:

```js
function applyCloset(kind, rows) {
  for (const r of rows || []) {
    const d = shelvedRow(r);
    if (!d) continue;
    r.deferred = d;
    r.counts_against_the_gate = false;
    ...
```

That is the only write in the repository. There is no `= true` branch. `shelvedRow` consults
`require('../tests/roster.js').DEFERRED` — seven names: `copycat battlebond stall pickup metronome
anticipation forewarn` — plus the Illusion species shelf imported from `game_differential.js`.

So the field is **not a classifier verdict about the gate**. It is a closet marker with a
gate-sounding name, and the name is what made it look like a hole. `SHOWDOWN-ONLY` is not "a branch
the classifier never reaches" and it is not "deliberately unclassified" — **the classifier does not
have a `counts_against_the_gate` axis at all.**

**The name is worth fixing even though the behaviour is right.** A field called
`counts_against_the_gate` that means "is on Will's shelf" and is read by nothing invites exactly the
reading the brief made. `shelved_by_owner` is the same fact under an honest name and is already
published in the summary.

## 5. FOREWARN — WHO SET `false`, AND IS IT THE TEMPLATE?

Nobody set it on Forewarn specifically. `applyCloset` set it because `forewarn` is a key in
`tests/roster.js` DEFERRED:

> **Will, 2026-08-10** — *"THE EFFECT IS A MESSAGE, for the identical reason as Anticipation one row
> up: Forewarn names the foe's strongest move on entry and changes nothing on the board. A board
> comparison cannot see it and a green from one would be vacuous; the protocol trace is the only
> instrument that could. Usage measured at 4."*

**It is the template for the reasoning and it is the wrong mechanism for the other seven.** Will's
decision is *"a message is not a board"*. That is precisely the argument for the other seven too —
but they do not need a shelf entry, because the differential's own `EQUIV` layer already drops
`-ability` announcements as cosmetic, with a red demonstration attached. They are handled one layer
lower, for free.

**The asymmetry that makes Forewarn different is a real inconsistency in the instrument, not a fact
about Forewarn.** Showdown announces some abilities with `-ability` and others with `-activate`.
`EQUIV` drops `-ability` and keeps `-activate`. So Pressure's entry announcement vanishes and
Forewarn's identical-in-kind entry announcement registers as a whole-game divergence and needed a
hand-written closet row to silence it. Same class of thing, two different fates, decided by which
protocol verb the authority happened to pick.

I am **not** proposing an `-activate` drop rule. `-activate` carries real state elsewhere (this same
artifact has `switcheroo` and `leppaberry` diverging on `-activate` field contents), and a blanket
drop would be a silencer, which is the thing `EQUIV`'s two rules forbid. Naming it, not fixing it.

---

## 4. SHOULD THEY COUNT?

Argued from the clause's own definition, not from convenience.

**The clause's bar is board-material.** Will, 2026-08-22: board-material now, narration as its own
separate gate afterwards. `wholeGameClause` and `classifyMechanics` read the same games through the
same reducer, and that reducer's `ability-announcement` rule *is* the project declaring an on-entry
`-ability` line to be narration — with a red demonstration that it cannot hide an ability which
failed to fire, because the effect would still be missing.

So:

**Seven of the eight: NO, and the reason is strong.** Six carry no board content whatever — proven
algebraically above from the artifact's own fields, not inferred. The seventh (Forewarn) is
narration the owner shelved by name with a dated quote. Counting any of them would make the mechanics
clause contradict the whole-game clause about the identical bytes, and would charge four rows for two
announcement lines.

**Supreme Overlord: it should be REMOVED from the clause, and it is not currently.** Confirming the
brief's known item, with the receipt:

- `wholeGameClause` declares it (`engine/quarantine.js:1281-1289`), `kind: 'AUTHORITY-WRONG'`,
  `match: (c) => /fallenundefined/.test(c)` — *"`data/abilities.ts` guards supremeoverlord's onStart
  on `pokemon.side.totalFainted` and does NOT guard its onEnd… Reproducing a typo is not
  correctness."* Verified in the source: `abilities.ts:4724` guards onStart, `4731` does not guard
  onEnd.
- `DECLARED_DIVERGENCE` is read at **one** site, `engine/quarantine.js:1481`, inside
  `wholeGameClause`. `classifyMechanics` never consults it.
- The row therefore enters `classifyMechanics` with `diverged: true`, `deferred` unset, reach 112
  teams (shelf 6), and `data/decision-impact.json` is **absent at HEAD** so nothing is excused.
  **It counts.**
- `tests/test-mechanics.js:15722` is a live probe asserting our engine deliberately refuses that
  line: *"Supreme Overlord closes its fallen marker on the way OUT, and refuses the authority
  fallenundefined"*.

So one gate says "the authority is wrong here, do not count it", a live probe says "we deliberately
do not reproduce it", and a second gate counts it as an engine defect. **That is one declared-list
reader missing, not seven unset flags.**

**What I am not claiming.** That the mechanics clause is green once this lands. Its ability count is
3 (`berserk`, `sandforce`, `supremeoverlord`); removing Supreme Overlord leaves two, plus the moves
and `leppaberry`. Those are the parallel `docs/_reports/2026-08-26-mechanics-clause.md` pass and I
did not re-derive them.

---

## OWED, NOT RUN

Nothing below was run. I did not play a game, and the whole-game differential was live in the tree.

**1. Read the actual arm logs for the eight and confirm which line flipped `sdMoved`.** My
attribution is derived from the authority's source plus the algebraic argument above; it has not been
read off a log. `--out` keeps it out of `data/`.

```bash
SHOWDOWN_PATH=../pokemon-showdown node engine/all_mechanics_fire.js \
  --release 667278050dcf --census data/mechanics-census.json --kind abilities \
  --only forewarn,moldbreaker,naturalcure,pressure,rockhead,superluck,supremeoverlord,unnerve \
  --dumplog --out "$TMP/so-probe.json"
```

Expect: in each ON/OFF pair, exactly one `|-ability|` or `|-activate|` or `|-end|fallenundefined`
line present in one arm and absent in the other, and no other difference.

**2. Close the Natural Cure gap — the one row nothing has confirmed.** Its A/B and its roster arm
both ran on a board with no status, so neither says the cure happens.

```bash
SHOWDOWN_PATH=../pokemon-showdown node tests/test-mechanics.js --tag switchOutTrigger
```

**3. Close the Super Luck gap.** `critRatioUp` is live via Night Slash and Merciless; Super Luck's
own `+1` on a carrier is covered by neither probe, and its own preflight says this arm cannot test
it. Needs a probe naming Super Luck, or an arm that rolls the crit die.

**4. Make `classifyMechanics` read `DECLARED_DIVERGENCE`, and re-run the gate.** ENGINE/whoever owns
`quarantine.js`. One reader, at `engine/quarantine.js:723`, on the same list `wholeGameClause` reads
at `:1481` — imported, never re-declared.

```bash
tools\lownode.cmd engine\quarantine.js
```

Expect the ability count to fall 3 → 2 and `supremeoverlord` to print under
*"DECLARED / THE AUTHORITY IS WRONG"* instead of in the counted set.

**5. Rename `counts_against_the_gate`, or delete it.** It is written once, read nowhere, and means
"on Will's shelf". `deferred` and `shelved_by_owner` already carry that fact under honest names.

**6. Not owed by me, filed for whoever owns the harness:** `all_mechanics_fire.js` picks its A/B
control from the carrier's own ability slots and never runs a third arm — 108 of 316 ability rows
come back `control_not_quiet` and none are resolved. `tests/roster.js` already runs a second control
and reports the delta. The mechanics harness could import that behaviour rather than re-deriving it.
