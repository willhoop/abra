# ABRA — Project Summary

**Version 3.88.0 · 2026-08-09 · Will Hooper**

**3.88.0 — TWELVE MOVES WERE PRICED OFF GENERIC GEN-9 DATA INSTEAD OF THIS FORMAT'S, AND THE
BUILDER THAT FIXED THEM WAS ONE RUN AWAY FROM DELETING TEN SPECIES.** Trop Kick read 70 where the
format says 85, Mountain Gale 100 against 120 — ours low in all twelve, and MAG's own table had the
right numbers the whole time, so the two engines disagreed on every one. Asking what a regeneration
WOULD do, before running one, turned up 788 destructive changes waiting in the same builder and a
header stamp whose regex had never once matched. `buffsHolderOnHit` also gained its condition by
derivation — Anger Point only on a critical hit, Justified only on Dark — but **the engine does not
read it yet and nothing behaves differently**, which is said here rather than left to look like a fix.

**3.87.0 — THE BATTLE LOOP AND THE DAMAGE CALCULATION READ TWO DIFFERENT SKIES.** `effMoveType`,
which the loop asks what type a move really is, read the raw field weather; `dmgRange` read the
EFFECTIVE one, which applies a private sky. So a Meganium-Mega's Weather Ball was priced as a Fire
move at 128-151 and refused by the loop as a Normal one — literally zero into a Ghost, the mega's
headline click doing nothing at all. One authority now: `effMoveType` calls the same function the
damage calculation calls. Census 325 to 326 live, 0 missing; the roster and the 150-row damage
differential did not move. The new probe is the CROSS neither half's probe could reach — a private
sky AND a move the sky retypes AND a Ghost, so the reading is zero-against-a-number.

**3.86.0 — EVERY PUBLISHED ARTIFACT HAS A WRITER NOW, INCLUDING THE ARM MILTANK ACTUALLY RUNS.**
The tool that answers "is this number still true" could only find a writer by an artifact's literal
name beside a write call in two directories — so the mechanics census, the game differential, the
interaction matrix and the deliberate roster, which are the four clauses of the MEDICHAM gate, had no
row at all. Not ok, not unsafe: absent. The graph goes 115 to 160 artifacts and the unknown set 61 to
16, membership derived through four ranked arms that each record how they matched. UNSAFE rises 13 to
20 because seven artifacts that were always unsafe are now visible; none left the set.

**3.85.0 — THE WHOLE SITE WITHHOLDS NOW, AND THE DEPLOYED COPY WAS MISSING THE FILE THAT MAKES IT
WORK.** Five pages LOADED a quarantined artifact as data instead of quoting its verdict, so the
citation checker could not see them at all; seven of the Stadium's fifteen cabinets now go dark, each
keeping its seat and its button and answering with the quarantine instead of a number. The file that
drives all of it, `quarantine-data.js`, did not exist under `app/` — which is the copy a visitor
loads — so every guard there took the healthy path. That is the same failure as the day before, one
directory over.

**3.83.0 — THE PINCH FAMILY FIRES FOR THE FIRST TIME, AND THE ENGINE HAD BEEN RIGHT TO REFUSE IT.**
Blaze, Torrent, Overgrow and Swarm carry 9,141 sheet uses between them and none of the four had ever
fired. The consumer's guard was correct at every moment: their condition sat in the artifact as the
SENTENCE "only below 1/3 HP", and a guessed threshold is worse than no wire at all. What nobody had
done was make the condition READABLE — so the refusal was permanent, and the shape the consumer did
serve is five abilities with **zero** corpus uses. The gate is now derived by shape from Showdown's
own handler and evaluated in integer arithmetic, because a body at exactly one third of its maximum
HP must get the boost and one HP above must not. The roster's abilities queue went from one
DID-NOT-FIRE to none, with exactly four verdicts changed and nothing else moved, and the census rose
324 → 325. Failing closed is unchanged: a condition the engine still cannot read refuses, and is now
counted rather than silent.

**3.82.0 — THE FIRST ENGINE FIX OF THE QUEUE LANDS: THE VOLATILE DURATION FAMILY, 9,092 USES, AND
IT WAS THE PERISH SONG BUG A SECOND TIME.** Showdown decrements a volatile's duration inside the
Residual event, so one applied on turn N has already spent a turn by the end of it. That defect was
documented in this engine for Perish Song, fixed for Perish Song, and left standing for every other
duration-bearing volatile. Taunt and Disable now match the official engine; Encore's counter row is
gone and only a separate HP row remains. Whole-game board agreement rose 76.9% to 78.9% on a paired
differential, the roster's moves queue fell from 52 to 50, and the census did not move. The previously
published baseline could not be reproduced because the census digest and the team store had both
shifted underneath it — so the run was discarded and re-taken paired. The delta is the measurement.

**3.81.0 — THE QUARANTINE REACHED THE BOARD, AND THE CHECKER THAT POLICES IT WAS BLIND TO THE
PUBLISHED COPY.** Thirteen slots on ABRA WORLD's status board now render as a redaction bar rather
than a number, each carrying the artifact, the reason and the command that re-runs it. Two defects
in the guard itself were found doing it: its own selftest had gone red — an `all`-stage artifact was
matching ANY requested stage name, so "a missing stage must FAIL" stopped being enforced — and its
citation walker looked at docs/ and web/ but never at app/, which is the copy a visitor actually
loads. Five withheld verdicts were being published from app/ the whole time the check read green.

**3.80.0 — THE DELIBERATE ROSTER'S INERT BUCKET COLLAPSED BY 94.1% OF ITS USAGE, AND A FAMILY OF
ABILITIES WORTH 8,524 USES TURNS OUT NEVER TO HAVE FIRED.** 124 abilities were falling through a
catch-all that stages a plain attack, so the condition each one needs was never created and the
roster honestly reported INERT — which reads as "nothing to test" when the truth is "never tested".
Fifteen new shape rules take that bucket to 59 abilities / 4,261 uses, all 22 ability rules caught
their own break, and nothing left in the bucket is above 500 uses. The first real defect it found:
Blaze, Torrent, Overgrow and Swarm carry their below-1/3-HP condition as PROSE, and the consumer
refuses any condition it cannot evaluate — so the pinch family has never once fired. The roster's
artifacts are now written per stage, so the quarantine gate reads measurement rather than absence.

**3.79.0 — EVERY FIGURE DOWNSTREAM OF MEDICHAM IS NOW WITHHELD RATHER THAN CAPTIONED, AND THE
DELIBERATE ROSTER'S MOVES STAGE RAN FOR THE FIRST TIME.** Will's standing call: *"all engines that
take medicham's output should be regarded as out of date and we should stop referencing them until
medicham is up to date and we can rerun them."* 34 of 114 artifacts are downstream and are no longer
printed at all — R1, R2, R3, R4, leaf calibration and the weights among them — because a caption is
not a quarantine: `PRE-CHANGE` had been printed beside those numbers for days and they went on being
quoted anyway. Membership is derived from the dependency graph, not typed, and the gate that lifts it
is computed from the differential and the roster, where a MISSING stage counts as failing. The roster
gained 26 move shape rules and staged all 500 legal moves for the first time, returning a 79-row
queue over ~15,000 uses. Its control arm was found to be measuring the CONTROL rather than the
subject, which made six ability findings false; **Weather Ball, Sand Rush and Damp are retracted as
defects and are correct.**

**3.78.0 — THE SHEET'S REAL NATURE NOW REACHES BOTH ENGINES, AND THE TURN-1 NUMBER FELL. THAT IS THE
INSTRUMENT GETTING HONEST.** The whole-game differential built every body `Serious` while the stored
sheet beside it said `Modest`, and with every body flat AND Serious, 326 of 357 species in the format share a Speed
with some other species — so the rig MANUFACTURED speed ties and almost never tested a real speed
differential. Carrying the declared nature cut the tied groups the resolver has to break from 348,595
to 243,467 over the same 1,998 games, a 30.2% fall. The instrument's own numbers went DOWN, as
predicted before the run: the board at the end of turn 1 is identical in 97.4% of games flat against
97.3% natured, games whose board never parted 80.8% against 78.8%, and the median turn of first board
divergence one turn earlier at 7. Encore divergences nearly doubled (10 to 19 games), which is what a
duration volatile that only bites when turn order does looks like when turn order starts being tested.
THE SPREADS REMAIN ABSENT AND ALWAYS WILL BE — a Showdown open team sheet does not reveal them
(`"evs": null` on 173,784 of 173,784 stored bodies), so this narrows the declared gap and does not
close it. Neither engine is told the other's answer: both are told the nature and each computes, and
the alignment assertion still reads 0. It read 21 on the first run and all 21 were Ditto — entry-time
Imposter had already transformed the medicham body, and the harness was writing the copied stat line
onto Showdown's Ditto before the game began. Census 324 live, 0 missing, unchanged.


**3.77.0 — CONFUSION DID NOT EXIST, AND BURN HAD NEVER BEEN ON A BOARD.** The confusion volatile was
written and never read or ticked, so Hurricane's secondary — 3,779 uses — fell through every branch, and
the two berries that clear confusion looked dead because there was nothing to clear. The sleep counter
was an ordering bug: the authority runs sleep before flinch, ours ran flinch first, so a body that was
asleep AND flinched never ticked and woke a full turn late. Burn, by contrast, is CORRECT and was
confirmed rather than changed — but it had never once been staged, because Will-O-Wisp is 85-accurate
and the harness pin makes every sub-100 move miss. The freeze timer is correct too; what was missing was
the instrument, which carried no freeze counter at all, so the engine's value could drift and no
measurement would see it. Census 324 live, 0 missing.


**3.77.0 — THE ACROSS-A-SWITCH ARM FOUND A DEFECT ONE DAY OLD THAT FIXING SOMETHING ELSE CREATED.**
A transform never reverts when the body leaves the field: the authority clears it in `clearVolatile`,
and this engine sets the flag and never unsets it. Since the transform also overwrites the body's name,
stats, types, moves, boosts and ability, a benched Ditto is PERMANENTLY the thing it copied — so the two
engines then choose replacements from benches that no longer describe the same Pokemon, and worse, a
Ditto can only ever transform ONCE PER BATTLE, because the guard refuses a second. Re-copying is the
entire function of the Pokemon. Imposter first fired the day before, and the out-and-back scenario that
exposes this only became expressible hours earlier. The roster's two owed arms — across a switch, and
at the exact HP line — are both built, both red-demonstrated, and Speed Boost and Focus Sash both match.


**3.77.0 — A STAGED SCENARIO CAN NOW SWITCH, SO A MID-TURN ENTRANT IS EXPRESSIBLE FOR THE FIRST
TIME.** The scenario driver understood only a move; every other step became a pass, so no staged test
could put a body on the field part-way through a turn. That single gap blocked three things at once:
Speed Boost's entry gate, which exists only for a body that just switched in; Hunger Switch's flip and
Zero to Hero's switch-out transform; and the whole across-a-switch arm of the roster. Four of the six
engine defects found the day before were about a MOMENT rather than an effect, and no scenario without
an entrant can express one. Verified end to end: Espathra switches in and reads +0 Speed in both
engines on the turn it arrives, then +1 at the end of the next, with all 131 fields identical on both
boundaries.


**3.77.0 — ALL 316 ABILITIES STAGED DELIBERATELY, AND A FREE +6 ATTACK FELL OUT.** Anger Point and
Justified are one defect twice: a conditional boost-on-being-hit whose condition is never checked, so
Anger Point grants +6 Attack off an ordinary hit where it requires a crit, and Justified grants +1 off
a Poison move where it requires Dark. Hustle applies no 1.5x Attack at all. Two facts about the
instrument matter as much: Gastro Acid does not suppress an ability here, and since suppression is the
ONLY control available to 23 abilities, checking that control against a known-live fixture is what
stopped five more from being published as dead for the control's failure rather than their own. And a
fact about the regulation rather than the simulator: 113 of 316 legal abilities have NO legal carrier,
so the effective roster of this format is about 203.


**3.77.0 — FIVE MECHANICS THAT DID NOTHING, AND ONE THAT WAS ALREADY RIGHT.** Imposter never
transformed Ditto; Hunger Switch never flipped Morpeko; Knock Off took its 1.5x against an item it
cannot remove; Fling never became an attack at all, because a base power of 0 made the click fail a
`hasPower()` gate; and Roar's phaze branch held a Pokemon-first target, so a phaze after a pivot dragged
nobody — the SIXTH site missed by the slot-first sweep, and at priority -6 the worst possible place to
hold a body rather than a slot. Mawile's mega ability swap, which had been blamed for a whole family of
Attack-stage divergences, WAS ALREADY CORRECT: the scenario was board-identical on its first run, and
deleting the swap deliberately parts two fields at once, so the symptoms were real symptoms of a bug
this engine does not have. Census 319/319 live, 0 missing; the staged harness now carries 24 scenarios,
all clean and all breakable.


**3.77.0 — THE INSTRUMENT RESOLVED A SWITCH BY TWO DIFFERENT KEYS AND FAILED SILENTLY BOTH WAYS.** The
driver names a bench member by Showdown's species id; the Showdown side looked it up by species id and
the medicham side by the body's DISPLAY NAME. Those agree until a body is renamed — which this engine
began doing the day before, when Disguise started renaming a busted Mimikyu, Zero to Hero started
renaming Palafin, and Hunger Switch was queued to flip Morpeko every turn. After a rename the two keys
part and that body can never be switched to again. Neither side raised anything: an unresolved lookup
answered `pass` on both, so one engine could switch while the other stood still, producing a different
board with no evidence attached. The key is now stamped at build time from the same expression the
driver uses, and a miss is counted and printed beside the other declared gaps (0/0 over 120 games).
This is an INSTRUMENT change rather than an engine one, so it alters what a measurement sees; it was
also LATENT UNTIL THE FORME FIXES LANDED, and the deliberate-roster build would have walked into it.


**WIRE 138-140 — THREE BOARD FAMILIES, AND A TARGETING MODEL THAT WAS WRONG WHENEVER ANYTHING MOVED
(3.77.0).** Aimed at the three largest surviving board-divergence families of the 1,530-game run at
release `288aee2e3501`. **Speed Boost fired a turn early**: Showdown gates it on `activeTurns`, which
is 0 on the turn a body switches in, and this engine's own comment said the gate "is not expressible
here" — true of `_turnsOut` and untrue since WIRE 135 added `_newlySwitched`, a reason that was
correct when written and stale when read. **A move targets a SLOT, not a Pokemon** (Will: *"we gotta
target slots, not mons"*): `Battle#getTarget` resolves from `targetLoc` at execution time, and five of
this engine's seven branches held the object they aimed at, so Charm and Parting Shot (10,535 uses: Charm 1,625 + Parting Shot 8,910, `data/tags.json`; this read 7,184 when first written and the corpus has grown since)
dropped stats on a body sitting on the BENCH. One shared reader now answers it everywhere, with
`tracksTarget` (Snipe Shot, Stalwart) as the negative. **Ally Switch did not exist** — 202 uses
resolving to a wasted turn — and it is the sharpest test of the slot rule, because both bodies stay on
the field: before it, one unimplemented move parted TEN board fields at the end of a single turn.
Each was RED on a staged board before its wire and IDENTICAL after; mega evolution, checked in the
same pass, was already correct. Census **311 → 313 live, 0 missing**; staged boards 18/18 identical
and 18/18 breaks caught.

**WIRE 133-137 — A SPEED TIE THAT HAS BEEN RESOLVED WRONGLY SINCE THE FIRST DAY, AND IT IS THE LIVE
ENGINE (3.74.0).** Measured on a staged pure tie under the differential's own primary pin: Showdown
moved p2a first and medicham2 moved p1a first. The comparator was never the problem.
`Array.prototype.sort` is STABLE, so a comparator returning 0 leaves the two in input order;
`Battle#speedSort` is a SELECTION SORT whose swaps move UNTIED elements around, so the tied group's
order when the shuffle finally sees it is not the input order, and no comparator can make a stable sort
produce that permutation. ROADMAP #86 records that 91.4% of legal species share a base Speed with some
other species, and `sortTurnOrder` is not an instrument — it orders every turn in every rollout and
every live game. The fix reproduces the selection sort and resolves the residual group by the
per-action uniform key already drawn, which is a uniform random permutation under real dice and the
identity under a constant pinned die; **hardcoding the pinned answer was explicitly refused**, because
it would have made the differential green on an engine that stayed wrong in play — the
fitting-environment-versus-playing-environment error. Beside it, two board defects proven by staged
comparison rather than by a probe (Zero to Hero's moment and Disguise's species), the switch-out
trigger built as a CLASS after Will named it as one, and the last MISSING census row closed by
enriching a tag that had described four different mechanics with one parameter. Census
**298/299 → 310/310, `missing` 0 for the first time**; `MEDFAILS.traceBodyOffField` 25 → 0.

**ROADMAP #88 AND #91 — ONE PIN WAS ONE CORNER, AND A CLICK WAS COUNTED AS A TEST (3.73.0).** Every
die in the differential was pinned a single way, which bought determinism — any difference is a bug,
no statistics — and paid for it in coverage nobody had priced. The speed tie always resolved the same
direction, every move below 100 accuracy MISSED ON BOTH SIDES, and damage was always the maximum roll,
which is the one roll where the crit's wrong position happened to come out right. Rock Slide had never
connected in this instrument; under the new arms it misses in one and hits in another, and a crit
lands in the bottom arm and not the top. The pin set is now a declared run parameter, digested into
`mode`, and a before/after pair whose pins differ is REFUSED rather than reported. Separately,
coverage credit moved from the CLICK to the OBSERVED EFFECT: the old rule incremented when an entity
was clicked and never asked whether the move did anything, so Haze clicked into a board with no boosts
on it — a no-op — marked Haze exercised and stopped the steering selecting it. Five rows were
clicked-or-present and did nothing at all: `critDamageUp`, `preventsSwitch`, `privateWeather`,
`clearsScreens` and `preTurnShield`. The old rule called all five covered. **THE BASELINE IS RESET:
both changes alter which games get played, so no run after this is comparable with the turn-1 figure
published at 3.71.0 or with `data/state-ladder.json`.** And an ENGINE defect fell out of the tie work,
filed rather than fixed here: the two engines have disagreed about EVERY speed tie for the life of
this instrument — the authority resolves a tie to the LATER body in input order, `sortTurnOrder` draws
one tie value per action from a constant scalar so the sort is stable and takes the EARLIER one. The
instrument's own header claimed the pin made them agree by construction; that claim was false and was
repeated as fact before it was checked. `sortTurnOrder` is the live engine, not instrument code.

**ROADMAP #92 — THE DAMAGE-STAGE CLASS. FOURTEEN MULTIPLIERS WERE APPLIED AT THE WRONG STAGE AND FIVE
WERE ABSENT (3.73.0).** Showdown applies each multiplier at a STAGE — a base power, a stat, or the
final damage — folds every handler at that stage into ONE modifier, and spends it ONCE. This engine
applied about a third of them a stage late, and separately: Black Glasses on the final damage where
the authority puts it on base power reads 109 against 108. That one-point shape is why it survived
every existing check — both engines "apply Black Glasses", so the census saw it LIVE, the interaction
matrix compares a ratio between arms, and the damage differential allows a 12% midpoint band by
design. LANDED: the 18 type items, Muscle Band, Wise Glasses, Technician, Tough Claws, Sharpness,
Iron Fist, Mega Launcher, Strong Jaw, Punk Rock, Sheer Force, Supreme Overlord, Expanding Force,
Rising Voltage, Dry Skin and the -ate x1.2 into ONE base-power relay spent once; Thick Fat (73%
wrong), Heatproof, Purifying Salt and Water Bubble (77%) into the STAT relay, because they modify a
stat and not the damage; Helping Hand (wrong on 5 of 5 audited rows) and Friend Guard (21.4%) off the
hit site and into the chains they belong in; Sniper out of the crit's plain multiply and into the
final chain; and the rolled crit's POSITION into the damage range before the randomizer, where it was
46.5% wrong at the bottom roll and invisible at the top one every check pins. The four FIELD terrains
were absent entirely — a Grassy-Terrain Earthquake was priced at DOUBLE the real number. New gate
`tests/test-damage-stages.js` is **1,728 of 1,728 exact** against the authority across all sixteen
damage rolls and both crit states, and was shown RED on two deliberate reversions before being
trusted. `damageBoost` is still NOT wired as a class and the reason is a property of the tag: it
carries neither the stage nor the condition, so wiring it would hand Blaze a permanent x1.5 on 5,808
sheets. Census 293/294 → 298/299 live.


**ROADMAP #81 WIRE 12 — FIVE ENGINE DEFECTS OFF THE TURN-1 BOARD, TWO OF THEM MIS-DIAGNOSED BEFORE
THEY WERE FIXED (3.71.0).** The auras (Fairy, Dark, Aura Break) are wired FIELD-WIDE at the base-power
stage — they multiply one type for every body on the field, the foe's moves included, and Aura Break
INVERTS to x0.75 rather than cancelling; exact against the official engine on 12 of 12 staged arms.
Baton Pass and Shed Tail switch for the first time (`passesState` had been derived and never
consumed, so Baton Pass was a no-op turn and Shed Tail paid half its user's HP to stand still). Curse
is two moves and the engine had neither. Perish Song counted from 3 instead of 4 and therefore fainted
every affected body on both sides a full turn early, on 1,141 corpus uses — the KO itself had always
fired. And ROADMAP #81 WIRE 10's measured board regression is one line: the Life Orb toll was being
paid by a move that MISSED. **Two of the five briefed diagnoses were wrong** — the tagger was not
testing `selfSwitch === true`, and the substitute doll was not confounded, it was a regression this
project introduced at WIRE 7 on a misquoted source line. Census 281/282 → 293/294 live.

**THE INSTRUMENT WAS MEASURING ANNOUNCEMENTS, AND THE HEADLINE IS NOW THE BOARD AT THE END OF
TURN 1 (3.70.0).** `engine/board_state.js` reads HP, status with its counters, items, all seven stat
stages, aliveness, every field condition WITH ITS CLOCK and the persistent volatiles out of BOTH
engines' live bodies at every turn boundary, after the whole residual phase. Read every figure from
`data/state-ladder.json`. **The board at the end of turn 1 is identical in 56.0% of games at the
pre-WIRE-1 baseline (1119/1998) and 66.9% at the top rung (1337/1998)**, peaking at 69.3% at WIRE 9;
whole-game board agreement went 6.4% -> 15.6% against a protocol number that read 1.8% -> 10.3%, so
the wires were real and the protocol number overstated them. **WIRE 10 is a regression the protocol
instrument scored as an improvement** — 47 fewer clean turn-1 boards, and diffed per field it is one
field, end-of-turn-1 HP wrong in 427 -> 473 games. **41.0% of games whose narration parted inside
turn 1 reached an identical board anyway.** The comparator proves itself first: 7 representation
mappings red-demonstrated in both directions and 25 planted state divergences, each of which must be
caught at the planted boundary and localised to the planted field — 25/25 on all fourteen arms.

**THE FORK IS DECIDED — A MORE CORRECT ENGINE DID NOT MAKE BETTER PREDICTIONS (3.69.0).**
`engine/leaf_engine_contrast.js` → `data/leaf-engine-contrast.json`. MILTANK's live in-game leaf scored
on **8,883 identical positions with identical seeds** through two frozen releases differing in exactly
`engine/medicham2-browser.js`.

| question | answer | n |
|---|---|---|
| paired Brier, WIRE 10 − pre-WIRE-1 | **0.0000 [−0.0007, +0.0007]** — floor 0.000642, MDE 0.001013 | 8,883 |
| McNemar, doubly-decisive calls | 37 vs 36, p = 0.91 | 7,994 |
| does **line** depth predict leaf error | **rho +0.0010 [−0.019, 0.022]** (MDE 0.0298) | 8,855 |
| does **turn** depth predict leaf error | **rho −0.0000 [−0.021, 0.023]** | 8,855 |
| Δdepth vs Δerror | **rho −0.0115 [−0.031, +0.008]** | 8,601 |
| is the depth ruler any good | **rho 0.836 [0.825, 0.846]** (reversed-order control) | 8,855 |
| both leaves vs a coin | **+0.0325 [0.0281, 0.0372]** Brier — worse | 8,883 |
| calibration | **ECE 0.1514**; says 94%, wins 59% | 8,883 |

**The interval is narrower than the smallest detectable effect, so this is a tight null and not an
underpowered one.** The engine fidelity gain is real and replicates here (never-parting games 13 → 246,
median divergence line 12 → 16, median completed turns 1 → 1) — it just does not reach the leaf.
**Engine correctness is not what limits the leaf; calibration is.**

**THE RELEASE LADDER — SEVEN FIXES DID NOT MOVE THE MEDIAN TURN (3.68.0, re-run 2026-08-07).**
`engine/wire_ladder.js` plays every frozen release of the wire series through the differential. It uses
one pinned census and one team pool, so all eleven arms compare with each other and not only with their
neighbour. **Read every figure from `data/wire-ladder.json`** — the figures below moved when ROADMAP
#81 WIRE 7 was added and the whole ladder was replayed, so any earlier quotation of them is retracted.
On 1,995 games for each arm, the median game stops after **one completed turn at every rung**. That
number does not change. 64 games of 1,995 agree completely, against 6 games at the baseline. The depth
of the first disagreement does change: the mean goes from 14.8 to 27.8 protocol lines, the 90th
percentile from 30 to 89, and the MEDIAN first-divergence line from 13 to 16 — the first rung in the
series to move it. The baseline arm ran first and last, with nine arms between them, and gave the same
result. Therefore the table shows the engine change and not the run.

**THE DIFFERENTIAL HAS RUN, AND MEGAS ARE IN IT (3.62.2).** `engine/game_differential.js` plays a real
stored team through MEDICHAM and through the official Showdown engine, step for step, against a stamped
frozen release. **Read every figure from `data/game-differential.json`, never from this sentence** — the
first version of this paragraph quoted a run that a later one replaced within the day, which is the
drift this whole document set keeps having to correct.

At the time of writing it reports every measured game diverging, with the median parting after a single
completed turn. **Mega bodies are now tested** (ROADMAP #31): no stone is stripped from the measured arm,
and every mega choice Showdown offered was taken by both engines.

**Two limits travel with any rate this instrument prints and must never be separated from it.** Nothing
past the first turn is exercised, because a game stops at its first divergence. And both sides are built
Serious / 0 EVs / 31 IVs so the two engines compute the same stat line before *and* after a forme change
— **this tests RULES, not the spreads the ladder actually brings.**

A one-page map of the whole project and every component. For depth: the
[white paper](ABRA-whitepaper.md) (math + sources), the [deck](ABRA-deck-plain-english.md)
(plain-English), the [technical docs](ABRA-technical-docs.md) (how to run it), and the living
[model ledger](MODELS.md).

## What ABRA is

ABRA is a decision-support model family for **Pokémon Champions VGC, Reg M-B, best-of-one
closed-sheet ladder**. It stores every public ladder replay and builds small, CPU-trainable models on
that growing store. It runs in a browser with no build step.

## The headline finding, 2026-08-06 — VGC is a poker problem, and the metric changes (3.62.2)

**The field has been treating VGC as a chess problem or a pure-RL problem. It is a poker problem.**
ABRA's headline metric is now **exploitability, not win rate** (ADR-003).

**The evidence is somebody else's measurement.** VGC-Bench (Angliss, Cui, Hu, Rahman, Stone — AAMAS
2026, [arXiv 2506.10326](https://arxiv.org/abs/2506.10326)) is the only published work in this exact
format. They trained behaviour cloning on 700,000+ human logs, fine-tuned with PPO under self-play,
fictitious play and double oracle, and **beat a World Championships competitor** in a single-team
mirror. They then trained a best response against each of their own agents and found **all of them
approximately 100% exploitable**. Their expert tester: *"after enough successive games, strong human
players can adapt and beat the agent."* Against their *advanced* tester the agent won 2 of 5.

**That is the predicted behaviour of a compiled policy in an imperfect-information game**, not a flaw
in their execution. `docs/POKER-TO-POKEMON.md` argued from theory that the solution concept here must
be a mixed equilibrium rather than a single best move; it now has the measurement it was missing.

| what changes | to what |
|---|---|
| headline metric | exploitability, comparator VGC-Bench's ~100% |
| WOBBUFFET | side-check → **primary instrument** |
| SLOWKING | preview solver → **the shape of the whole agent** |
| MEDICHAM's justification | "the official engine is slow" → **"the engine is justified iff search pays"**, gated by ROADMAP #62 |

**The thesis under test: a re-solving agent should be harder to exploit than a compiled one.** A
learned policy *recalls*; a search *recomputes*, and presents no fixed mapping for a best response to
attack. **Whether that survives simultaneity, stochasticity and a ~6-turn horizon is UNKNOWN — it is
the experiment, not the assumption.**

**And ABRA has no exploitability number today.** `data/exploitability.json` is declared void. Making
the headline a metric this project cannot currently produce is deliberate; it states the gap rather
than hiding it.

**Two more facts that make the comparison honest.** VGC-Bench is **open team sheets** — the same
information setting as our Reg M-B best-of-three — so they had *more* information than a closed-sheet
agent and were still ~100% exploitable; the exploitability comes from holding a fixed policy, not from
hidden teams. And a head-to-head is impossible (their checkpoints are Reg M-A, ours Reg M-B, and their
own paper shows policies do not transfer across team sets) — but **exploitability is intrinsic**,
measured against a best response trained against *you* in *your* format, so the numbers compare
although the agents can never meet.

**Their dataset is not usable and the code already knew.** Their Reg M-B holding is 4,167 games over
4 days in June 2026 and 100% of it is already in our store as `data/games.ots.jsonl`, against our own
9,701 best-of-three games over 15 days. The 700,000 headline is Reg M-A. An earlier claim in this
session that their archive covered our format inferred coverage from a filename and is withdrawn.

### The plan, four phases

```
1  finish MEDICHAM        search needs an engine that is fast AND correct
2  GATE #62               does compute buy anything: untimed vs on-the-clock
3  if yes -> search, and measure EXPLOITABILITY against their ~100%
4  if no  -> adopt their recipe: BC + PPO self-play/FP/DO, open source, reproducible
```

Branch 4 is approved in advance and is a **result, not a defeat** — the method is published and
reproducible, so taking it would be a finding about VGC rather than a failure of this project. On
compute: cores help the search (CPU-bound, root-parallelisable), GPUs help BC/PPO. MILTANK needs 26 s
against a 20 s budget on one core of sixteen, so sixteen cores fixes the clock — but root
parallelisation scales **sublinearly**, so it converts a failed budget into a met one rather than a
shallow search into a deep one.

### The correction that came with it: 117x was 24.9x

ADR-001 chose to keep a hand-written simulator on a benchmark of **29 vs 3,401 battles/sec/core —
117x**. Re-measured on this machine, same four teams (derived from the store), 8-second runs at a
60-turn cap: MEDICHAM **13,041 turns/sec / 217 battles/sec**, `champions_sim` **523 / 28** — a ratio
of **24.9x**. **`turns/sec` is the comparable unit and `battles/sec` is not**, because MEDICHAM ran to
its 60-turn cap and Showdown ran with `choose('default')` to a natural end. The old figures are kept in
ADR-001 with a dated correction beside them. **The decision stands and its stated justification does
not** — a 24.9x gap still rules out live browser simulation, but the reason for the engine is now the
falsifiable one above. A third reading exists that is neither: ROADMAP #61 measured 1,606 battles/sec.
**Nothing in this repository ratchets engine speed**, which is how three readings of one quantity
disagreed by an order of magnitude with no test going red.

## The finding that shapes everything

**You cannot reliably predict who wins from the two team sheets** — even a player-rating model ties a
coin. So ABRA does not sell outcome prediction. It supports *decisions* and grades every model with a
proper score, a confidence interval, and an honest baseline. Wins are reported as wins; two honest
negatives are reported as negatives.

## The finding that shapes what gets built next (2026-07-30)

**Four experiments added knowledge to the model. All four measured a null. Two experiments changed
what the model is optimising for. Both were large wins.**

| change | kind | result |
|---|---|---|
| take the best move instead of sampling it | objective | **+12 points, 79.7% of decisive pairs** |
| self-play policy improvement over the clone | objective | **55.9%** |
| four separate feature additions | knowledge | four nulls |

> **RECONCILED 2026-07-31.** That 55.9% was measured on the **53-feature vector with switching OFF**. Repeating the experiment on the **56-feature vector with switching ON** gives **48.1%** [46.5, 49.8] over 9,728 paired games — a interval entirely below 50, i.e. self-play training made the policy *worse*. Both numbers stand as measurements of different configurations; neither generalises to 'self-play helps'. The difference is not explained, and three candidate causes are untested: switching exploration being harmful (which used to be supported by the older 10-point switching loss — **that figure is RETRACTED 2026-08-06 as unattributable and confounded**: medicham2 playouts predating WIRES 123-128, no `engine_release` stamp, and `bringIn()` selects `live(bench)[0]`, so it measured switching to an ARBITRARY body rather than to a chosen one. The candidate cause stands; its supporting evidence does not. See #63), 36.5% drift over 18 iterations, or self-play eroding imitation-fitted features that were already good.

The nulls survived the obvious check: an overdispersion test across teams reads ~1.00, against 1.169
for a known real effect, so they are genuine rather than a real effect hidden by team variety.

**The constraint is the objective, not the knowledge.** This is why the next item is retraining a
model that already exists (DODUO, the pair-scoring layer, which lost at 42.0% fitted to *resemble
humans* and has never been fitted to *win*), rather than adding more features to MAG.

**A second, blunter lesson from the same day.** Every integrity bug found had one shape: a fact
reached one consumer and not the next. Priority blocking was in the artifact but not the simulator,
so Sucker Punch beat a Farigiraf in every game ever simulated. A switch-in's own ability never
reached the code that chooses the switch — measured over 40,001 matchups, declaring Intimidate,
Drizzle or Drought changed nothing at all. And every mega forme carried no ability, no moves and no
item, so **26% of the format scored as threatening nothing**. None of these were modelling
disagreements. They were plumbing.

**A third lesson, 2026-08-04, and it is about the rulers rather than the models.** A result that does
not record its own configuration cannot be checked by anyone, including the person who produced it.
The R1 gate published *"+2.91 [1.79, 4.04]"*; recomputed from the only committed evidence it is
**+0.456 [−0.717, +1.630] — UNDECIDED**. Nothing was falsified: the row dump recorded the answers and
not the settings, so a run at exploration 0 and a run at exploration 1 left byte-compatible files that
differ by nearly four accuracy points.

Auditing the sibling gates against the same standard found two more.

| gate | published | what the evidence supports |
|---|---|---|
| R1 leaf accuracy | +2.91 [1.79, 4.04], PASSED | **+0.456 [−0.717, +1.630], UNDECIDED** |
| R2 leaf cost | 5.83 ms median | reproduces only as arithmetic on itself, and it timed `explore=0` at a 20-turn horizon while the shipped leaf runs `explore=1.0` at 60 |
| R3 divergence | 72.9% over 70 decisions | recomputes exactly — from two fields in the same file. **Its control was printed and never stored**, and the gate's own verdict branches on that control |

Every gate now writes a sidecar (`engine/run_stamp.js`) recording budget, exploration rate, horizon,
content digests of every source it reads, the commit, and whether the tree was dirty. Older artifacts
carry one reconstructed from the commit that contained them, labelled inferred rather than observed.

## The components at a glance

| Model | What it is | Status | Headline result |
|---|---|---|---|
| **MEDICHAM** | Hand-written doubles doubles-battle simulator. **Its justification is now falsifiable (ADR-003, 3.62.2): it exists so per-turn re-solving is affordable, so the engine work is justified if and only if search pays — gated by ROADMAP #62.** The speed ratio that originally justified it is corrected in the section above | ⚠️ **Being replaced** | Within 5% of the Smogon calculator on 31 scenarios, but disagrees with the OFFICIAL Champions engine by 31.1 points of win probability. ADR-001: becomes a lookup over precomputed tables. **Mechanics census 231 live of 232 probed, 1 missing with a reason** (`data/mechanics-census.json`, wires 82–130 landed 3.40.0–3.56.0; **129 is the whole of accuracy** — Coil, Wide Lens, Sand Veil and No Guard all measured IDENTICAL with and without, ~5,000 uses, three unrelated causes, now one `hitChance(att,def,id,field,ctx)`; **130 is Substitute, charged for and never built**, 1,976 clicks of a move strictly worse than passing; 117 is Psychic Terrain refusing priority against airborne bodies, and the shared `isGrounded` that replaced three hand-written copies of the predicate; 118 is dynamic speed; **119 is TAUNT, which the simulator had never implemented at all** — 1,503 clicks, the volatile written and read by nothing — and 120–122 are a pivot move resolving at the bare-switch priority, Volt Switch pivoting out of an absorbed hit, and Yawn passing through Good as Gold); **generated interaction matrix 98.8% — 1,624 of 1,643 live carrier x reactor cases**, PLUS the artifact's own `off_gate` count of **53** disagreements in buckets the gate discards — read both, because 3.50.0 moved the second while the rate did not move of 2,300 staged from a theoretical 8,795, i.e. **26.2% coverage** (3.43.0 closed the generator’s own arithmetic — `theoretical = staged + dropped`, asserted per axis, which found an understated denominator, a depth-cap off-by-one and outcome buckets that were not a partition; 3.45.0 then recovered the 902 pairs dropped for “having a probability” and found that the harness’s two pinned dice were not the same die, so every sub-100-accuracy move had been MISSING in the reference engine while medicham2 hit. The agreement figure has fallen twice while the engine did not change — both falls are the denominator becoming honest), **multi-turn field axis 156/156** (`data/interaction-matrix.json`); damage differential **1/150**, the one row a documented harness-layer artifact (Disguise); two-rulebook collision ratchet **2 clashes / 151 comparable facts** (`data/rulebook-collision.json`); DEAD-tag ratchet **61 → 38**; mutation tier (`data/mutation-coverage.json`) **163 class-A operators over 56 carrier × tag rows** — the 97 "defect candidates" of 3.49.0 were triaged A/B/C/D from a parse of the engine source and **none of them is class A**, so the ratchet counts class A only |
| **GURU** | Meta matchup matrix from real outcomes | ⚠️ **No decisive cells that survive multiplicity** | `data/guru-matchups.json`, 2026-07-31, **5,265 clean games / 12 archetypes / 144 cells**. **6 directed = 3 distinct** matchups clear a 95% test one at a time, and **ZERO survive FDR at q=0.05 or Bonferroni** — 66 pairs, 3.3 expected by chance, 3 observed, smallest exact p 6.1e-3 against a BH threshold of 7.6e-4. Predictive test **0.7124** vs a coin 0.6931 over 1,053 held-out games — **worse than a coin**. Descriptive structure only. (This row read *1,124 clean games, 11 archetypes, 0.735* until 2026-08-04, from a superseded run; the verdict is unchanged.) |
| **XATU** | Opponent set + next-move belief | ✅ Built | Top-1 36% / top-3 72% on held-out human moves (beats its baselines) |
| **PORY** | Mid-game win-probability value net | ⚠️ **Contribution unclear** | Log-loss **0.6236** 95% CI [0.6070, 0.6387] vs coin 0.6931 and vs the material heuristic 0.6428 (regenerated 2026-08-05 on 5,883 clean games; the previously published 0.567 predated the current quality filter) — but its features ARE the material state, and it **loses to a two-feature baseline** (alive_diff+hp_diff 0.5822 vs PORY 0.5840, same estimator). Report the gain over MATERIAL, not over a coin. See engine/pory_baseline.py |
| **CHOMP** | Bring-4 / lead-2 team-preview engine | ✅ Ships (standalone) | Exact-damage picker; **CHOMP-EV proof: brings tie a coin (honest null)** |
| **SLOWKING** | Team-preview Nash (mixed strategy) — **and, since ADR-003 (3.62.2), the shape of the whole agent rather than the preview solver**: equilibrium mixing plus continual re-solving is the answer poker reached for exactly this class of game | ✅ Built | Equilibrium ≪ exploitable than uniform; playstyle cycle is **suggestive on small samples** |
| **KADABRA** | Replay coach | ✅ Works offline | Per-turn "you're at X%" from PORY |
| **DITTO** | Team optimiser | ⚠️ Pivoting | Objective de-biased to validated damage (was optimising a backwards signal) |
| **ALAKAZAM** | In-battle decision engine (capstone) | 🔜 In development | Belief + search + learned value; built last on the inputs above |
| **MEW** | Self-play data engine | ✅ **Built** | Runs the OFFICIAL Champions engine against itself on real observed teams. 1,000 games, 13/13 validation checks, mirror 51.0% CI [45.4, 56.6] |
| **MAGNEMITE** (MAG) | The in-battle policy that reads the board | **Built, and improving by self-play (3.28.0)** | Conditional logit over **58 features**, fitted to **232,815 usable human clicks of 241,927 seen** from 8,942 clean open-sheet games (`data/policy-weights.json`, 3.42.0 — this row read 53 / 146,910 / 6,091 until then, three fits behind). Held out by game: top-1 **32.9%** against the behaviour clone's 23.4%. **1,336 recorded actions that were not clicks at all have been removed from the labels** and 3,260 redirected ones are fitted over a candidate set. It now DOES decide switches and DOES run a real damage calculation — both were listed here as missing and both became false. Still one ply, still no model of the opponent's move |
| **WOBBUFFET** | Exploitability of MAG — hill-climb a counter over MAG's own weights. **PRIMARY INSTRUMENT since ADR-003 (3.62.2)**: this produces the project's headline metric, and its published comparator is VGC-Bench's approximately-100% exploitability | ❌ **NOT MEASURED** | **There is no exploitability number for this project (2026-08-04).** The published ~~63.2% [56.6, 69.3], mirror 47.5%~~ is **retracted**: 17 features against the 58 we ship, an engine 25 wire-fixes old, computed before the quality filter existed. The 58-feature re-run is **void** — `data/policy-weights.json` was refitted at 22:15:24 UTC *while it was running* and `engine/medicham2-browser.js` changed content twice more afterwards. Separately its hill-climb accepted **1 of 24** steps and would have been uninformative anyway. `engine/exploit.js` stamps nothing about what it read, which is why none of this was visible to it. See `docs/SEARCH.md` §R8 |
| **DUSK** | Endgame exact solver | 🔜 Roadmap | Solves small boards (≤2v2, 1v1) perfectly — sharpens ALAKAZAM's endgame and gives clean training targets for PORY |
| **HYPNO** | Opponent read / exploitability dial | 🔜 Roadmap | Estimates opponent strength + predictability; tells ALAKAZAM when to play safe (vs strong) or exploit (vs weak/predictable) |
| **ROLES** | Multi-label team composition (26 roles) | ✅ Built | Role-pair matrix pools data to median cell **n=20** across 1,051 cells (vs old single-label n=11–18) — the 7,971 once published was retracted in 2.7.0; preview roles tie a coin (honest null) |
| **WAR** | Wins Above Replacement (species RAPM) | ⚠️ **Null** | **Withdrawn 2026-07-25.** Beat a coin only on the unfiltered store (0.6860). On clean games: **0.7048 vs coin 0.6931, accuracy 0.502** — the signal was four bots playing one team 1,446 times |
| **NMF** | Emergent roles / archetypes | ⚠️ **Rank not defensible** | Rank 6 ships, but the project's own criterion (`engine/nmf_rank.py`, bootstrap factor stability, cf. Brunet et al. 2004) selects **rank 4** — and rank 6 scores **−0.107 excess over null**, i.e. its factors are *less* reproducible across resamples than factors fitted to shuffled data. The old justification here was reconstruction error 0.53, which that same script states **cannot select a rank** (it falls monotonically by construction). A team is a *blend*, learned not hand-labelled — but the number of blends is not currently defended |

**Multiplicity, corrected 2026-07-31.** The fit reports a 95% interval for all 56 features, so at alpha 0.05 about **2.8 of them clear zero by chance alone**. The family is **every feature in the shipped fit**, because every one is reported to the reader — choosing a smaller family after seeing which are large is the practice the correction exists to prevent. Uncorrected, **53** clear zero. Under **Benjamini–Hochberg** (FDR, 1995) **53** survive; under **Bonferroni** (FWER) **49**. Nothing significant uncorrected fails the FDR correction, so the headline count is not an artefact of having looked at 56. Computed by `engine/weight_multiplicity.js` → `data/weight-multiplicity.json`. **This says which weights are distinguishable from zero. It says nothing about whether an imitation-fitted weight is evidence about WINNING** — a separate and larger question this project has measured going the other way.

**A phrasing the filter itself mandates.** `require_full_bring` conditions on game length: measured 2026-07-31, the games it keeps are **1.71x longer** on average (7.4 vs 4.3 mean turns; 19,589 kept vs 8,713 dropped). Every bring statistic in this project is therefore *"the bring, **among games long enough to show it**"*, which is not the same as "the bring". `data/quality-filter.json` states this at the point of filtering and requires it to be said downstream; this is that.


## The engine can say WHAT it did, not only where it ended up (3.58.0)

`engine/medicham2-browser.js` emits a **Showdown-shaped protocol trace** on request
(`battleInit(A, B, {trace: []})`, off by default). The event set is derived from Showdown's own
`add()` call sites, including this **format's** overrides, and is published in
`data/protocol-events.json`, whose `showdownEvents`, `emittedCount`, `notEmittedCount` and
`partialCount` read 91 / 38 / 56 / 10 — every non-emitted event carries a written reason. Two gates
fail the run: an event claimed here that Showdown never emits, and an event Showdown emits that is
neither emitted nor explained. `tests/test-protocol-trace.js` fails if any claimed event never fires
in a real game.

No mechanic changed: census **234 live / 235 probed**, differential **1/150**, 122 red demonstrations
0 failed, all five scripted whole-game comparisons agree on every turn.

**It immediately said something about our own instruments.** The damage differential compares only
`roll=0` and `roll=15` — the endpoints — and in between MEDICHAM samples an 11-integer range uniformly
where Showdown floors 16 base values separately. **149/150 endpoint agreement is compatible with every
interior roll being off by one or two.** Separately, MEDICHAM resolves the knock-off, the resist berry
and the contact punish *before* subtracting the target's HP; end-of-turn state is identical, which is
why the state comparison agrees and the trace does not. Both are recorded, neither is fixed — changing
how a damage roll is drawn moves every seeded run in the repository.

## How it fits together

The **store** (every real game) feeds **GURU** (meta), **XATU** (belief), **PORY** (value), and
**MEDICHAM** (damage). **SLOWKING** solves the preview; **CHOMP** picks the bring; **KADABRA** coaches
a replay with PORY. **ALAKAZAM** is the capstone that assembles belief + search + value into the
win-%-optimal move, built last. Every change updates the code, this summary, the white paper, the
deck, the technical docs, and the CHANGELOG in the same pass.

## Repositories and site

| Piece | Repo | Live |
|---|---|---|
| ABRA (models + site) | `github.com/willhoop/abra` | `willhoop.github.io/abra/app/` |
| CHOMP (bring engine) | `github.com/willhoop/chomp` | Showdown userscript |
| Portfolio | `github.com/willhoop/willhoop.github.io` | `willhoop.github.io` |

## The data, as of 2026-07-25

| | |
|---|---|
| Collected (closed-sheet Bo1 ladder) | see `data/live.js` — generated on every refresh, growing hourly (hardcoded sizes retracted, S13) |
| Usable after the quality filter | **1,124** (12.8%) |
| Self-play (MEW, official engine) | 1,000 — separate file, never pooled |
| Open-team-sheet archive | 4,167 (MIT, 2026-06-17..20) — separate file, different information regime |
| Smogon official priors | 283 species, whole-ladder aggregate |

## Two metagames, not one

`meta-usage.json` publishes both, because they answer different questions:

```
competitive  garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion
ladder       garchomp, whimsicott, kingambit, basculegion, charizard, incineroar
```

**Competitive** is what humans choose when trying — right for tournament prep and for any claim about
the game. **Ladder** is what you actually face: three in four STORED games involve a bot. That is a property of what gets
uploaded rather than of the ladder: bot-team species are over-represented in the scrape by a mean of
+8.3 points against Smogon whole-ladder statistics, while other top species run -2.9. The true share
of bot opponents is lower than the store implies, but it is not small. Charizard sits at 25.7% on the ladder
view and outside the competitive top six because it is on the bot team. Consumers must say which they
used.

## Honest ceilings

Predicting the match winner from sheets is a coin flip in this format — and the previously published
55.0% skill ceiling was itself measured with bots included. Removing them gives 52.4%, an interval
that contains a coin flip. Every preview-level model now sits at that ceiling: JOLTEON, roles,
CHOMP-EV, and as of 3.2.0 **WAR, whose result is withdrawn**.

Most results here are also **underpowered**: 1,124 clean games can only detect an edge of ~4.2
accuracy points, and a 2-point effect needs ~4,900. `engine/eval_harness.py` now refuses to report a
null without stating what it could have seen.

The one load-bearing win is the **validated damage engine** — **36 scenarios, 100% within 5% of
`@smogon/calc`, 97% within 2%, median error 0%, worst 3%** (`data/damage-validation.json`,
2026-08-05). This line previously read "31/31 within 2%", which overstated the project's single
load-bearing result in both the count and the tolerance; the artifact is the authority and the
whitepaper's "within 5%, worst 3%" was the correct statement all along. PORY was the other, until 2026-07-25 showed it loses to a two-feature material baseline.
The project's two genuine contributions are the ones it treats as plumbing: **behavioural bot
detection**, and the **measurement discipline** that dissolved WAR, the 55% ceiling and GURU's matchup
matrix in a single day.

## Correction — the scrape over-samples bots

Measured 2026-07-25 against Smogon's whole-ladder statistics for the same format and month
(1,163,315 battles vs the count generated into `data/live.js`):

| | mean difference, uploaded vs whole ladder |
|---|---|
| The five bot-team species | **+8.3 points** |
| Every other top species | **−2.9 points** |

75% of *stored* games involve a detected bot. That is a fact about **what gets uploaded**, not about
the ladder — bots save replays far more readily than humans do. Any statement of the form "three in
four of your opponents are bots" is therefore an overestimate and should not be made from this store.

This also bounds the earlier upload-bias result. Comparing our open-team-sheet Bo3 games against the
whole Bo3 ladder gave a mean absolute difference of only 1.84 points — but that corpus contains
almost no bots (29 named-bot sides in 4,167 games). So **human** upload bias is small; **bot** upload
bias is large, and the closed-sheet Bo1 store carries the latter.

## Measurement validity (3.39.0)

| item | state |
|---|---|
| engine release | `5fc1f711a0e3`, 12 files frozen, Showdown `20ad99ff`. A measurement reads the snapshot, not the live tree, so the divisions can run concurrently. |
| provenance method | **content digests**, no longer mtime. 0 artifacts verified by content, **92 by mtime alone** — printed every run, ratcheted downward by a named list. |
| exploitability | **no figure.** 63.2% retracted on its own merits; the 2026-08-04 re-run is `void: true`. |
| mirror control | **49.7% [46.2, 53.2]**, n=782 — survives the void run and retires the seat-asymmetry worry. |
| MAG refit | ran; **moved nothing measurable.** Weather fix +0.048 top-1 [0.009, 0.093]; the refit itself −0.074 [−0.155, +0.004] against a 0.192-point noise floor. |
| open, needs a decision | the fit sees `{nature, item}`; the player sees `{nature, item, ability, moves}`. **50.47% of trained decisions**, 99.75% of games. |
| click censoring (3.42.0, re-measured 3.47.0) | **1,475 of 270,022 recorded actions were never clicks** (Encore 1,243, `\|drag\|` 232) and were being fitted as human choices. Removed and counted. **3,526 redirected attacks (1.3180%)** now enter as a two-member candidate set instead of a certainty on the redirector. Paired on 48,274 held-out decisions: on coerced turns P(the fabricated action) **−0.002613 [−0.003650, −0.001672]**; on redirection turns **no improvement**; corpus top-1 flat. Both artifacts were re-run under the current engine after four simulator wires landed underneath them, on a corpus grown to 10,009 games, and every 3.42.0 figure reproduced inside its interval — the smaller run's numbers are in `CHANGELOG.md` 3.42.0. `data/click-censoring-census.json`, `data/censoring-value.json` |

