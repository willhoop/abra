# When a suppressor leaves, what it suppressed resumes — the class, derived; Unnerve, the second member

Written 2026-08-23/24 by ENGINE, against Will's statement:

> *"when an ability that suppresses things like cloud nine switches out, there is a moment when
> whatever it suppressed ends. for example when unnerve is active, no berries can be eaten, but when
> [the carrier] switches out, all berries that can be eaten normally, proc. same with weather. (also
> applies if the relevant mon dies)."*

Nothing below is taken from that message. Every clause was re-derived from the format and MEASURED in
the official simulator on a staged board before anything was written.

---

## VERDICT

1. **HIS RULE HOLDS, IN FULL, WITH NO PART REFUTED.** Both halves are true of the authority for both
   members with legal carriers, on **both** departure paths, and the held-back effect fires **at that
   moment** — not at the next boundary. Citations and staged streams below.
2. **THE CLASS IS TWO MEMBERS, NOT FIVE, AND THE FILTER IS THE CARRIER.** `suppressWeather` →
   **Cloud Nine** (2 legal carriers), `onFoeTryEatItem` → **Unnerve** (6). Air Lock and Neutralizing
   Gas are legal ABILITIES with **zero legal carriers** and are unreachable in this regulation.
3. **CLOUD NINE WAS ALREADY CORRECT** — landed earlier the same day. **UNNERVE WAS NOT, AND THE
   DEFECT WAS BIGGER THAN THE RESUMPTION HALF:** this engine applied Unnerve to **two of the five
   places a berry is eaten**. The cure berry and the resist berry were eaten under Unnerve, so
   nothing was ever held back and nothing could resume.
4. **THE BOARD-MATERIAL HALF IS A KO.** Close Combat into a Chople Berry Tyranitar with an Unnerve
   body opposite: the authority reads `|-damage|p2a: Tyranitar|0 fnt`; this engine halved the hit and
   left it standing at **19/175**.
5. **LANDED**, one shared reader, one knob `MEDI_UNNERVE_PARTIAL=1`, two census probes.
   **Census 664 → 666 live / 666 probed / 0 missing / 0 hollow / 0 threw.** Damage differential
   **0 of 6000 at all 16 corners**, exit 0.

---

## 1. THE CLASS, DERIVED AND CARRIER-FILTERED

`Dex.forFormat('gen9championsvgc2026regmb')`, species filtered `exists && !isNonstandard && tier !==
'Illegal'` (347 legal species), then every legal ability scanned for a suppression-shaped flag or
handler — **not** for a name and **not** for a description.

| ability | suppression | **legal carriers** | in scope? |
|---|---|---|---|
| **cloudnine** | `suppressWeather` | **2** — Altaria, Drampa | **YES** — landed 2026-08-23, see the Cloud Nine report |
| **unnerve** | `onFoeTryEatItem` | **6** — Arbok, Aerodactyl, Houndoom, Tyranitar, Pyroar, Corviknight | **YES — this pass** |
| airlock | `suppressWeather` | **0** | no |
| neutralizinggas | `suppressAbilities` | **0** | **no — legal ability, ZERO legal carriers** |
| asoneglastrier / asonespectrier | `onFoeTryEatItem` | **0** | no |
| arenatrap / magnetpull | `onFoeTrapPokemon` | **0** | no |
| shadowtag | `onFoeTrapPokemon` | 1 — Gengar-Mega | out of class: nothing is held back behind it |
| armortail / queenlymajesty / dazzling | `onFoeTryMove` | 1 / 1 / 0 | out of class: same reason |
| damp | blocks self-destruct | 3 | out of class: same reason |
| klutz | suppresses its OWN item | 3 | out of class: the item leaves with the body |
| ripen / berserk | `onTryEatItem` on ITSELF | 2 / 2 | out of class: not a foe suppression |

**`isNonstandard` alone would have sent this pass to implement Neutralizing Gas.** It reads `null`,
i.e. legal. The ability is unreachable because **nothing legal carries it** — `Dex.forFormat` is not a
legality filter, which CLAUDE.md already says and which is a live instance here. Recorded so a later
entity sweep does not re-add it.

**Gastro Acid is legal AND reachable** — 5 legal direct learners (Arbok, Victreebel, Snorlax,
Serperior, Eelektross). It is the same class through a different door (suppression REMOVED mid-turn
rather than walking away) and is **not** staged here; see OWED.

---

## 2. DOES THE AUTHORITY RESUME LIVE, AND DO WE?

### The authority's mechanism, cited

| where | what it says |
|---|---|
| `sim/pokemon.ts:1785-1787` | `eatItem` raises `TryEatItem` — **the only raise of that event in the sim** — unless `force` |
| `data/abilities.ts:5250-5267` | Unnerve is `onStart` sets `effectState.unnerved`, `onEnd` clears it, `onFoeTryEatItem() { return !this.effectState.unnerved; }` |
| `sim/field.ts:101-115` | Cloud Nine's half: `suppressingWeather()` walks `sides[].active` on **every call**, no cache |
| `data/moves.ts:18263`, `:19054` | the only two `eatItem(**true**)` callers in this format — **Stuff Cheeks** and **Teatime**, which bypass the event |
| `data/abilities.ts:743-752` | Cud Chew never calls `eatItem` at all; Harvest only `setItem` |

**Champions overrides none of it.** `grep -n "unnerve\|neutralizinggas\|cloudnine\|airlock\|asone"
data/mods/champions/abilities.ts` returns **nothing**.

So the authority has no "resume" step to run: **it never caches the refusal.** Every un-forced
`eatItem()` asks the live board, so the moment the carrier stops being an active foe the next
`eatItem()` succeeds.

### This engine, before

`engine/medicham2-browser.js` had the refusal **written out twice**, as an inline expression, on the
two `onUpdate` berries only:

```
berryPinchUpdate   if(foes&&foes.some(x=>...blocksBerries))return;     Sitrus, Oran
berryPPUpdate      if(foes&&foes.some(x=>...blocksBerries))return;     Leppa
berryCureUpdate    — NO GATE AT ALL —                                   Lum, Chesto, Cheri, Pecha,
                                                                        Rawst, Aspear, Persim
applyConfusion     — NO GATE AT ALL —                                   the instantaneous Lum/Persim
                                                                        confusion cure
dmgRange / the hit — NO GATE AT ALL —                                   every resist berry
```

Two copies of one fact is the FACTS-ARE-GLOBAL breach CLAUDE.md names; the missing three were the
expensive half.

### MEASURED — three knobs that moved the authority and moved us by zero

**A. The cure berry (Lum, 353 sheet entries).** A paralysed Lum holder, an Unnerve Tyranitar opposite,
the carrier switching out on turn 2. Authority:

```
Unnerve / STAYS    t1 status=par item=lumberry   t2 status=par item=lumberry
Unnerve / SWITCH   t1 status=par item=lumberry   t2 |switch|p1a: Gallade
                                                    |-enditem|p2a: Milotic|Lum Berry|[eat]
                                                    |-curestatus|p2a: Milotic|par|[msg]
Sand Stream (control) — cured on turn 1, before the knob can matter
```

This engine, before: **cured on all four arms.** Two arms reading the same across a varied knob that
moves the authority is an unwired knob, not a mechanic that does not matter.

**B. The instantaneous confusion cure.** Confuse Ray at a Lum holder with an Unnerve body opposite.

```
authority   Unnerve   |-start|confusion  |-activate|confusion       confused=true  item=lumberry
            control   |-start|confusion  |-enditem|Lum Berry|[eat]  |-end|confusion
this engine before — the Lum was spent on BOTH arms
```

**C. The resist berry (~18,000 sheet entries across the family; Chople alone 5,132).** Close Combat
into a Chople Berry Tyranitar:

```
authority   Unnerve    |-supereffective|  |-damage|p2a: Tyranitar|0 fnt      berry NOT eaten
            control    |-supereffective|  |-enditem|Chople Berry|[eat]
                                          |-enditem|Chople Berry|[weaken]
                                          |-damage|p2a: Tyranitar|19/175
this engine before — halved and survived on BOTH arms
```

**That is a KO either way, which is what makes this board-material rather than narration.**

---

## 3. FAINT VERSUS SWITCH — BOTH, AND THEY ARE THE SAME ANSWER

Will said the rule applies when the carrier dies too. It does, and the authority's own reason is that
the refusal is never cached: `Side#foes()` excludes a body at 0 HP, which happens at the damage site,
**before** `faintMessages()` sets `fainted`. Staged, an Unnerve Tyranitar at 1 HP killed by Dragon
Claw while a foe Milotic sits at exactly half with a Sitrus:

```
|-damage|p1a: Tyranitar|0 fnt
|-enditem|p2a: Milotic|Sitrus Berry|[eat]        <- the berry fires ABOVE the faint line
|-heal|p2a: Milotic|127/170|[from] item: Sitrus Berry
|faint|p1a: Tyranitar
```

**This engine emits the same order**, and did so before this pass — its gate already read
`!x.fainted && x.curHP>0`, and the in-move `_updateEvent` landed at `battle-actions.ts:967` two
batches ago is exactly the pass that runs there. Traced on the same board:

```
|move|p2b:garchomp|dragonclaw|p1a:tyranitar
|-damage|p1a:tyranitar|0fnt
|-enditem|p2a:milotic|sitrusberry|[eat]
|-heal|p2a:milotic|127/170|[from]item:sitrusberry
|faint|p1a:tyranitar
```

**So the faint path was already right for the two berries that had a gate**, and it is now right for
the three that did not, because they all come through one reader.

---

## 4. DOES THE PENDING EFFECT FIRE AT THAT MOMENT, OR AT THE NEXT BOUNDARY?

**At that moment.** This is the half of Will's sentence that a turn-boundary comparison cannot see,
and it is directly observable: the suppressor leaves on the fast action and a foe attacks the berry
holder later in the SAME turn.

Authority, the switch path — the eat sits immediately below the `|switch|` line and above every
subsequent action of that turn (`runAction`'s tail Update, `sim/battle.ts:2842`):

```
|switch|p1a: Gallade|Gallade, L50, M|143/143
|-enditem|p2a: Milotic|Sitrus Berry|[eat]
|-heal|p2a: Milotic|127/170|[from] item: Sitrus Berry
```

This engine, same board, plus an Incineroar clicking Darkest Lariat at the berry holder afterwards:

```
suppressor STAYS    |move|p1b:incineroar|darkestlariat|p2a:milotic
                    |-damage|p2a:milotic|0fnt
                    |faint|p2a:milotic                      <- Milotic DIES
suppressor LEAVES   |switch|p1a:gallade|gallade,l50|143/143
                    |-enditem|p2a:milotic|sitrusberry|[eat]
                    |-heal|p2a:milotic|127/170|[from]item:sitrusberry
                    |move|p1b:incineroar|darkestlariat|p2a:milotic
                    |-damage|p2a:milotic|28/170             <- Milotic LIVES
```

**The berry is spent INSIDE the turn, in front of the hit that would otherwise have killed.** If it
had waited for the residual the body would be dead. The mechanical link the brief suspected is real:
this is `_updateAll` at the top of the next action plus `_updateEvent` inside the hit loop — the
positions corrected two batches ago — and **that fix already covers this half.** No new schedule was
needed here; only the refusal was missing.

---

## 5. WHAT LANDED

### One reader, five sites

`berryRefusedByFoe(m, foes)` — the whole refusal, asked of the artifact:

- **`isBerry` is load-bearing, not tidy.** Mental Herb carries `curesVolatile` exactly as Lum does and
  is **not** a berry (`data/tags.json` → `items.mentalherb` has no `isBerry` tag; its handler is
  `useItem`, not `eatItem`), so a gate keyed on the cure tag would have blocked Mental Herb under
  Unnerve — an over-match, and the exact failure mode the brief warns about. Checked before wiring.
- **Membership is `blocksBerries`**, which resolves to exactly `["unnerve"]` today and is **printed in
  both probes' detail on every run**. A member added later is honoured with no edit.
- **`foes` is optional and the fallback is not a silent default.** `liveFoesOf(m)` answers from the
  body's own `_sf._S`, which `battleInit` stamps on every party member, and reads the SAME `S.actA` /
  `S.actB` arrays the turn loop holds by reference. A body with no battle behind it has no foes and no
  berry to refuse — which is the right answer, and is why the damage differential (which builds
  exactly those bodies) is untouched.

Wired at: `berryPinchUpdate`, `berryPPUpdate` (the two old sites, now calling the shared reader instead
of two copies of one expression), `berryCureUpdate`, `applyConfusion`'s instantaneous cure, and the
resist berry at **both** of its two places — `dmgRange`'s pure read of the halve **and** the
consumption inside the hit. Those two must be asked with one reader or a run can halve the damage and
keep the berry.

### What is deliberately NOT gated, derived rather than assumed

`eatHeldBerry` — this engine's forced path, serving Teatime, Stuff Cheeks, Cud Chew, Harvest and
Symbiosis. Every one of those either passes `force` or never calls `eatItem`, so gating it would be a
NEW wrong answer bought with a right one.

### The knob

`MEDI_UNNERVE_PARTIAL=1` puts Unnerve back on two of the five sites. **The two OLD sites are not under
it** — they are the behaviour being restored, not the defect, the same call the Cloud Nine pass made
about the top-of-turn `wSup` site. Any run carrying it also carries a non-zero
`MEDFAILS.unnervePartialRestored`, and that flag is set **on the knob**, not on a refusal that happened
to change an answer, so a run with no Unnerve body in it still says the knob was on.
`MEDSEEN.berryRefusedByUnnerve` counts the REFUSAL, never the walk.

### The probes

`tests/test-mechanics.js` → `item`/`curesStatus` and `item`/`resistBerry`.

**Both halves of Will's rule are asserted separately, because they are two defects wearing one
sentence.** An engine that never suppressed at all satisfies "it resumes on departure" trivially —
which is precisely the state this engine was in.

**The arms are the DEPARTURE, not the ability.** The control is the identical board on which the
carrier STAYS.

```
              CLEAN                                       MEDI_UNNERVE_PARTIAL=1
curesStatus   STAYS  t1 par/lumberry  t2 par/lumberry     STAYS  t1 /-  t2 /-
              LEAVES t1 par/lumberry  t2 /-               LEAVES t1 /-  t2 /-
              none   t1 /-            t2 /-               none   t1 /-  t2 /-
resistBerry   no berry 175 HP                             no berry 175 HP
              berry, no suppressor 156 HP, spent          berry, no suppressor 156 HP, spent
              berry + unnerve 175 HP, STILL HELD          berry + unnerve 156 HP, spent
```

`resistBerry`'s arms are the **HP**, not the item: a probe that only read the item would pass an engine
that kept the berry and halved the damage anyway, which is the one wrong answer this fix could have
produced — the halve and the consumption live 14,000 lines apart. The no-berry arm pins the unhalved
number so "halved" is measured, not assumed.

---

## 6. THE NUMBERS

**Which scoreboard, said before the run.** The LAB was expected to move (+2 census). The POOL: joint
sheet exposure in `data/team-pool-frozen` (13,214 games, derived here, not quoted) is **8.37%** for
Unnerve-vs-a-resist-berry and **0.24%** for Unnerve-vs-a-cure-berry — so a small pool move was possible
on the resist berry and none was expected on the cure berry. Both figures count CARRIERS on opposing
sheets, not sheet rows.

**Census** — `data/mechanics-census.json`:

```
before   664 live / 664 probed / 0 missing / 0 hollow / 0 threw
after    666 live / 666 probed / 0 missing / 0 hollow / 0 threw
ratchets unarmed 0, directCall 1   (both held; no --accept)
under MEDI_UNNERVE_PARTIAL=1:  664 live, 2 missing — and the other 664 stay LIVE, so the knob is surgical
```

**Damage differential** — `tests/test-engine-diff.js --n 6000 --seed 20260804`: **0 disagreed at every
one of the 16 corner rows** (top, bottom, idx01–idx14 all `6000 / 6000 / 0`), 134 not comparable
(multihit 134, non-finite 0, threw 0), exit 0. Accuracy, accuracy-modifier and substitute-bypass
conformance all 0. **Unmoved.**

**Roster, all three stages re-run against release `6875293c5159`** (they go WITHHELD after any engine
edit). **Every verdict distribution is identical to the previous release's:**

```
items      0 FIRED-AND-BOARDS-DIFFER   0 DID-NOT-FIRE   139 match,   1 deferred,   8 could-not-stage
abilities  0 FIRED-AND-BOARDS-DIFFER   0 DID-NOT-FIRE   130 match,  45 control-not-quiet, 141 could-not-stage
moves      0 FIRED-AND-BOARDS-DIFFER   0 DID-NOT-FIRE   475 match,   3 deferred,  22 could-not-stage
```

**Other instruments, run and green:** `engine/move_result_state.js --selftest` (18 passed, 0 failed —
stated plainly, that instrument compares `moveThisTurnResult`/`moveLastTurnResult`, which this change
does not touch; it is a receipt that the comparator is intact, **not** evidence about Unnerve — the
real evidence is the HP and item tables above), `tests/test-engine-consistency.js` (all checks passed),
`tests/test-resolution-order.js` (26 arms, 1 declared KNOWN-OPEN, 0 failing),
`tests/test-protocol-trace.js` (ALL PASSED, both derivation gates), `tests/test-volatile-duration.js`
(4 of 4 identical).

**Whole-game** — see the block below.

**Whole-game** — `engine/game_differential.js --games 1200 --arm middle --release 6875293c5159
--team-store data/team-pool-frozen --census data/verification/census-pin-9446a684709d.json
--end-state --write`. **A RE-BASELINE, not a delta**: the release moved and the pins did not.

| quantity (arm `middle`, 961 games) | before, release `a7839b20e7d5` | after, release `6875293c5159` |
|---|---|---|
| `diverged`, protocol parted (RAW) | 48 | **48** |
| `declared` (5 Supreme Overlord `fallenundefined`) | 5 | **5** |
| **`undeclared`** | 43 of 961 = 4.5% | **43 of 961 = 4.5%** |
| `mid_void.void_games` | 2 | **2** |
| `mid_void.diverged_among_usable` | 46 | **46** |
| **BOARD-MATERIAL causes / games** | 23 / 24 | **23 / 24 — DID NOT RISE** |
| NARRATION-ONLY causes / games | 22 / 24 | **22 / 24** |
| DIFFERENT-END-STATE among parted | 17 | **17** |
| threw | 0 | **0** |

**`status.js` PRINTS A DIFFERENT NUMBER FOR THE SAME RUN AND IT IS NOT THIS PASS.** It reads
`35 of 961 = 3.6% (48 raw, less 13 declared)` because a MEASURE pass sitting uncommitted in the tree
widened `engine/quarantine.js`'s declaration set by 8 Moody games. The raw parted count — **48, before
and after** — is the quantity this pass moves or does not, and it did not.

**Per-game attribution, joined on the seed:** `0 games gained a first divergence, 0 stopped diverging,
0 first divergences changed cause.` The divergence set is **identical**.

**THAT IS THE PREDICTED RESULT AND IT WAS SAID BEFORE THE RUN, NOT AFTERWARDS.** The pool is
usage-weighted and the joint condition is deep: an Unnerve carrier and a berry holder must both be
BROUGHT, both be on the field at the same time, and the berry must be one the turn would actually have
spent. 8.37% of pool games carry the two on opposing SHEETS; the number that reach the interaction is
evidently zero in 961 games. **The lab is the instrument that sees this fix** — census 664 → 666, and
the staged boards above against the authority. **The load-bearing claim is that board-material did not
RISE**, and it did not.

---

## 7. OWED, NOT RUN

- **GASTRO ACID, and the ability-removal door generally.** Legal, 5 legal direct learners, and it is
  the same class from the other side: suppression REMOVED mid-action rather than walking away. Not
  staged, not claimed, no register row proposed — a row asserting breakage with no instrument that
  decides it is debt. Same for Skill Swap / Worry Seed / Entrainment taking a suppressor's ability.
  This is the family the Cloud Nine report also left open; it is **not** closed by this pass.
- **Magic Room** (16 legal learners) suppresses ITEMS on a timer rather than by departure. Whether its
  expiry flushes the held-back berries is the same question at a different door and was not measured.
- **`residualUpdatePass` does not call `berryCureUpdate`.** The residual pre-walk runs the cure berry
  ONCE, above the walk, and the in-walk pass carries only the pinch and PP berries. A status applied
  BY the residual itself (Yawn's `onEnd`) would therefore be cured a boundary late. Noticed while
  reading, **not** measured, and deliberately not touched in this batch.
- **`engine/quarantine.js`** — not run; `status.js` computes the same clauses.
- **`tests/roster.js`** three stages — see the whole-game block for whether they were re-run.
- **`tests/interaction_matrix.js`** — not run.
- **The whole-game `planted_state_proof_ok: false`** — six plants read `NOT APPLIED` because they want
  a BENCHED body the fixture does not carry. **True of the baseline artifact on disk as well; it is
  MEASURE's, not ENGINE's, and is not caused by this pass.**
- **No claim of a strength gain**, and none can be made from here.

---

## 8. REGISTER — PROPOSED TEXT (`docs/ROADMAP.md` NOT EDITED)

**Proposed NEW row, CLOSED on arrival** (it has an instrument that decides it, which is the bar):

> **UNNERVE REACHED TWO OF THE FIVE PLACES A BERRY IS EATEN. CLOSED 2026-08-23 (ENGINE).** The
> authority raises `TryEatItem` in exactly one place — `Pokemon#eatItem`, `sim/pokemon.ts:1785-1787` —
> so every un-forced berry consumption is refused while an Unnerve body stands opposite. This engine
> had the refusal written out twice as an inline expression on the two `onUpdate` berries and nowhere
> else, so the CURE berry, the instantaneous confusion cure and the RESIST berry were all eaten under
> Unnerve. The resist berry is board-material: Close Combat into a Chople Berry Tyranitar reads
> `|-damage|p2a: Tyranitar|0 fnt` on the authority and `19/175` here. Fixed as one reader
> (`berryRefusedByFoe`) keyed on `isBerry` + `blocksBerries`, wired at all five sites plus `dmgRange`'s
> pure read of the halve; `eatHeldBerry` stays ungated because Teatime and Stuff Cheeks pass `force`
> and Cud Chew and Harvest never call `eatItem`.
> **VERIFIED BY** `tests/test-mechanics.js` `item/curesStatus` (*"Unnerve holds a CURE berry back, and
> it is eaten the moment the Unnerve body leaves"*) and `item/resistBerry` (*"Unnerve refuses a RESIST
> berry, so the halve never happens and the hit kills"*), both under knob `MEDI_UNNERVE_PARTIAL=1`.

**Proposed note on the Cloud Nine row (#352), not a reopening:** its OWED list named "an ability
REMOVED mid-turn by Gastro Acid / Neutralizing Gas" as unstaged. **Neutralizing Gas is answered and
needs no work: it is a legal ability with ZERO legal carriers in Reg M-B.** Gastro Acid remains open
and reachable (5 legal learners).
