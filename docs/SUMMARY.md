# ABRA — Project Summary

**Version 5.258.0 · 2026-09-06 · Will Hooper**

**5.258.0 - THE TWO-NUMBER PROBLEM IS OVER FOR THE RIGHT REASON: THE TREE SETTLED, THE MEASUREMENT WAS RE-TAKEN, AND `data/game-differential.json` NOW HOLDS BOARD-MATERIAL 50 OF 961 AND PROTOCOL 151 OF 961. FIVE ITEMS LANDED TONIGHT, EACH MEASURED ALONE, AND THE "1.53x PROTECT AMPLIFICATION" PUBLISHED LAST NIGHT IS CORRECTED - IT WAS MEASURED AGAINST THE WRONG DENOMINATOR.**

| question | artifact and arm | answer |
|---|---|---|
| the whole-game clause that GATES | `data/game-differential.json`, EMPIRICAL arm | **board-material 50 of 961** - republished off a settled tree, release `db248fe67a5e`, cap 20, pool `data/team-pool-frozen` |
| the whole-game clause that REPORTS | the same artifact and arm | **protocol first divergence 151 of 961** |
| what those two failed on before tonight | the same artifact | **withheld staleness**, not a count; they now fail on measured counts |
| the sequence the five fixes produced | the per-step artifacts under `data/verification/` | board-material **59, 58, 56, 56, 51, 50**; protocol **161, 160, 158, 158, 153, 151** |
| the overall engine gate | `node engine/status.js` | **7 of 9 clauses passing**; the two failures are the two whole-game clauses |
| the census | `data/mechanics-census.json` | **829 live / 829 probed / 0 missing**, regenerated twice tonight and level throughout |
| the deliberate roster | `data/roster.{items,abilities,moves}.json` | **140 / 129 / 475** tested, with `FIRED-AND-BOARDS-DIFFER` and `DID-NOT-FIRE` at **zero** on all three |
| the damage differential | `data/engine-diff.json` | **0 of 6000** disagree at the midpoint and at all sixteen corners |
| how much Protect the stand-in really over-clicks | the driver counters, 17,532 decisions | **1.257x** against the pool-matched denominator, not 1.53x against the ladder's |

**WHAT LANDED, IN ORDER, AND WHY EACH ONE IS ATTRIBUTABLE.** The pins were held identical on every run, each step ran on its own frozen release, and each fix carried a probe shown FAILING before it and passing after it plus a switch that puts the defect back. **Big Root** names five kinds of healing and this engine had implemented one, and it rounds the heal down before applying the boost rather than after. **Leech Seed** was still taking health off a Pokemon after the Pokemon that planted the seed had died - the real game's handler returns before it damages anything in that case, and this engine had applied the check to the healing only. **A repair to the measuring tool itself** moved nothing, which was the written prediction and was verified paired rather than assumed. **Fairy Aura** was being priced off a field that a departed, returned or killed holder never cleared. **Beat Up** was printing the right number of hits in the wrong order, because the real game permutes its party array on every switch-in and this engine walked the unpermuted one.

**THE FINDING WITH THE LONGEST REACH IS ABOUT THE RULER, NOT THE GAME.** Three fixed test setups in the comparison harness were wired to "the first configuration in the list" and were documented as using the maximum-damage one. On 13 August a new configuration was added to the front of that list and they silently started using it instead. **All four failing checks were that one line, and the engine was never at fault**: run the damage measurement fourteen times and this engine's interior never moves while the reference implementation's wanders and once loses its own minimum. They are bound by NAME now. **Two of those checks had been passing by luck for fourteen days**, until an unrelated hash change made the drift visible.

**THE CORRECTION, STATED AS A CORRECTION.** Last night this project published that the stand-in player clicks Protect 1.53 times as often as its own instruction table says, and blamed the way that table is renormalised onto the four moves a body carries. Decomposed over the same 17,532 decisions: the declared input is **13.565%**; the same table weighted by the decisions this arm actually took is **16.209%**; renormalisation takes it to **20.257%**; and the sampler realised **20.374%**, faithful to within a factor of 1.006. **Renormalisation is half of it and the denominator is the other half** - the arm plays a census-steered pool, not the ladder, so 13.565% was never its ruler. Against the pool-matched 16.209% the arm reads 1.257. **And one part of last night's explanation is withdrawn outright:** legality subsetting is not a cause and its sign is backwards - 87.0% of decisions have all four moves and are the ones reading 21.724%, while a body down to one legal move reads 8.134%, because it is usually down to its attacking move rather than its Protect.

**THE MISSES ARE PUBLISHED BESIDE THE HITS.** Three of five predictions landed at their point estimates. The Leech Seed step called 58 and 157 and read 56 and 158; the Fairy Aura step called 54 and 156 and read 51 and 153. **Both misses are the same error - reading a list that is capped at 40 rows as though it were the population.** Both ran in the good direction, which is not a defence.

**WHAT THIS DOES NOT DO.** The gate did not open. No quarantined figure becomes quotable: leaf calibration, every rollout figure and every head-to-head stay WITHHELD rather than annotated. The MAG refit stays OWED and is a REFIT rather than a restamp - no weights were touched, and the damage table under the fitted vector has moved from 318 species to 322. Three engine gaps are named and not fixed (Struggle's activate line at 17 games, Poltergeist announcing at use time at 7 games, and `mustrecharge` outranking sleep and freeze at priority 11), two narration gaps are measured and not fixed (no Fairy Aura and no Unnerve ability line on entry), and about 6 plus 5 further mismatches are filed as the INSTRUMENT with the reason given rather than counted against the engine. Full accounts in `docs/_reports/2026-09-06-apply-three-fixes.md`, `docs/_reports/2026-09-05-longtail-batch-A.md`, `docs/_reports/2026-09-05-red-endpoints-and-protect-prior.md` and `docs/_reports/2026-09-06-publish-pass.md`.

**5.257.0 - THE STAND-IN PLAYER WAS NOT PRESSING PROTECT TOO OFTEN. IT WAS BEING HANDED A MENU WITH ONE ITEM ON IT, AND FIXING THAT MADE 79% OF THE TEST GAMES ACTUALLY FINISH INSTEAD OF 56%. WE ALSO WITHDREW A CLAIM WE PUBLISHED THREE HOURS EARLIER: THE MEASURING ARM WE CALLED UNREPRODUCIBLE IS BIT-IDENTICAL, AND THE REAL DEFECT IS THAT WE NEVER FROZE THE MEASURING TOOL AT ALL.**

| question | artifact and arm | answer |
|---|---|---|
| the whole-game clause that GATES | `data/game-differential.json` | **board-material 46 of 961** - again NOT republished, and stale as a description of tonight's engine |
| the same clause on tonight's engine, EMPIRICAL arm | the protect-fix artifact under `data/verification/` | **147 protocol / 55 board-material**, on a comparator now reading 54 leaves |
| the strictly paired protect measurement, EMPIRICAL arm | the two protect-fix artifacts under `data/verification/` | **34 to 47 board-material**, 961 games each, the driver rule the only difference |
| the same clause, JOINT arm - a different policy, NOT pairable with the rows above | the leaf-widening artifacts under `data/verification/` | **53 board-material** on the driver as it was, and it repeats; the same arm on the repaired driver reads **167 protocol / 69 board-material**, twice, identically |
| how often the stand-in pressed Protect | the same paired artifacts | **32.77% to 20.79%** of clicks, against an input table of 13.565% and humans at 14.76% |
| how many decisions had one option in them | the driver counters | **22.2%**, of which **60%** were Protect; with all four moves present the arm was already at **15.3%** |
| how much of the comparison is now wired | `tests/probe_uncompared_leaves.js` | **54 of the leaves compared, standing hole 16 to 0**, two refusals both derived rather than asserted |

**WHAT THE FIX ACTUALLY WAS, IN ONE LINE: A SETTING NAMED `prefer` WAS DELETING THE OTHER OPTIONS RATHER THAN FAVOURING ONE.** Protect makes a turn happen with nothing in it, so a stand-in that presses it constantly produces games that grind to the time limit and never end. **Resolved games went 539 to 762 and games still running at the cap went 418 to 189.** The count of games where the two engines part on the board went **up**, 34 to 47, and that is what a fix looks like here: a game that ends reaches late positions the old stand-in never played, so there is more game in which to disagree. We say that in the same breath as the number, because a score rising looks like bad news and this one is not.

**THE CORRECTION IS THE MORE VALUABLE HALF OF THIS VERSION.** Earlier tonight we published that one measuring arm gave 167, 167 and 138 on identical settings, that we did not know why, and that none of its numbers could be quoted until we did. **That is withdrawn: six runs split perfectly cleanly either side of the moment the protect fix landed, three on each side, and each group is identical to itself down to its last internal counter.** There was no randomness. **The real defect is bigger:** every measurement here freezes the engine, the scenario list and the team pool - all of them things the measuring tool READS - and **the measuring tool itself was never fingerprinted**. A program whose whole job is to answer "are these two runs comparable" answered **COMPARABLE** about two runs made by different code, and its own notes had described that exact gap in writing. **A hole that is written down is not a hole that is closed.** The tool now fingerprints its own code, refuses to publish a run that was edited while it played, and derives that warning from the two runs in front of it.

**AND ONE FIGURE PUBLISHED TONIGHT IS CORRECTED: 47 SHOULD READ 55 WHERE IT DESCRIBES THE CURRENT EMPIRICAL ARM.** Both are real. 47 is the pre-widening comparison at 40 leaves and stays correct as one leg of the paired measurement; 55 is the same run through the widened comparison at 54 leaves. **A whole-game figure without its artifact and its arm named is not a figure**, which is why every row of the table above carries both. Still open and named rather than tuned away: the stand-in presses Protect **1.53** times as often as its own input table says, because that table is a population-wide rate squeezed onto the four moves a Pokemon actually carries and Protect survives the squeeze. Full accounts in `docs/_reports/2026-09-05-protect-amplification.md`, `docs/_reports/2026-09-05-leaf-widening-all16.md` and `docs/_reports/2026-09-05-cap-or-stall.md`.

**5.256.0 - THE BEST FINDING OF THE NIGHT WAS ONE NO INSTRUMENT HERE COULD HAVE FOUND YESTERDAY. A TWO-TURN MOVE CHARGED AT ONE ENEMY CAME OUT AND STRUCK THE OTHER, AND A FLAW IN THE STAND-IN PLAYER HAD BEEN MAKING THAT UNOBSERVABLE BY CONSTRUCTION.**

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES | `data/game-differential.json` | **board-material 46 of 961** — again NOT republished, and stale as a description of tonight's engine |
| the same clause on tonight's engine, JOINT arm | the joint charge-fixture artifact under `data/verification/` | **board-material 53 of 961**, protocol first-divergence 138, VOID 4 |
| the same clause, EMPIRICAL arm — a different policy, NOT pairable with the row above | the empirical charge-fixture artifact under `data/verification/` | **board-material 34 of 961**, protocol 121 |
| the knob-cleared controls, one per arm | the two `-knobs` artifacts under `data/verification/` | the old figures reproduced **exactly**: joint **110**, empirical **35** |
| probed mechanics live | `data/mechanics-census.json` | **829 of 829**, 0 unprobed |
| the engine gate | `node engine/status.js` | back to **2 of 9** failing clauses |
| the prediction card, written before the runs | this version's prediction artifact | **3 of 8**, with every miss recorded |

**WHAT THE DEFECT WAS, AND WHY IT COULD NOT HAVE BEEN SEEN.** Some moves spend a turn charging and land on the next. The real game remembers which enemy you aimed at when you started and lands the hit there; our simulator aimed at the lowest live enemy index instead, so a Phantom Force charged at slot b struck slot a. **Until tonight the stand-in player driving these games aimed both of its Pokemon at that same lowest index anyway**, so remembering the aim and forgetting it produced identical games and no comparison could tell them apart. A flaw in the ruler was hiding a flaw in the subject. The second fix, the one actually written on the defect card, was the smaller half: a charge wrapper surviving a refusal it should not survive, 2 times in 961 games.

**EVERY SCORE ABOVE BELONGS TO AN ARM, AND THE ARMS ARE NOT INTERCHANGEABLE.** They are different policies playing different games, and the program refuses to pair them by design. The joint arm moved 110 to 53; the empirical arm moved 35 to 34. The games thrown away because the two simulators never drew a die at the same address fell from 38 to 4 in the joint arm, and charge moves have left that list entirely.

**THE 57-GAME MOVEMENT IS ATTRIBUTED, NOT ASSERTED.** Re-running with the same release, the same pinned pool and the same driver, with only the two fixes switched off, reproduced the old figures exactly, and the drift tool confirms that only the simulator file moved between the two releases. **So the whole movement is these two fixes and nothing else** — which is a stronger claim than any before-and-after taken on a tree that was moving underneath it.

**TWO METHOD FINDINGS WORTH MORE THAN EITHER FIX.** The staging fixture that caught this was one hour old: the same defect had been filed earlier the same night as real and impossible to stage, because no staged scenario in this project had ever played a two-turn move's landing turn. And this is the **second** time in one night that changing the stand-in player exposed a defect rather than causing one — the earlier swap moved the different-board count from 0 to 135 simply by playing games that end. Neither number was wrong; each was a statement about which games were being played.

**AND A TEST THAT HAD ALWAYS BEEN GREEN HAD ONLY EVER BEEN LUCKY.** Its filter scooped in a setting whose value is re-rolled at random, so it passed only when one hash landed under 0.01. It was winning a coin flip, not checking anything. Fixed.

**THE HONEST COLUMN.** The prediction card scored 3 of 8. Both misses on the empirical arm were by one. **All three misses on the joint arm went the same way** — the fix being much larger than called — which is a bias in the prior rather than noise in the measurement, and it is only visible because the misses are written down.

**WHAT IS STILL WITHHELD.** Everything downstream of the simulator: leaf calibration, every rollout figure, every head-to-head. The gate is shut and the MAG refit is owed as a refit rather than a restamp. `docs/ENGINE.md` still carries the charging defect and was not restamped in this pass, one changed game is attributed but not diagnosed, 13 of the joint arm's 53 are unnamed under the artifact's 40-row cap, and the semi-invulnerable half of the second fix is wired but not staged.

**5.255.0 - THE MOST EXPENSIVE THING THIS VERSION FOUND WAS NOT A GAME MECHANIC. A RELEASE FINGERPRINT MOVED BECAUSE A FILE'S LINE ENDINGS CHANGED, NOTHING ELSE DIFFERED IN ANY OF THE 26 FROZEN SOURCES, AND FIVE HEAVY RE-RUNS WERE SPENT DISCOVERING THAT.**

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES | `data/game-differential.json` | **board-material 46 of 961** — again NOT republished, and stale as a description of tonight's engine |
| the same clause, measured on tonight's engine | `data/verification/fix-batch-8.json` | **board-material 35 of 961**, protocol first-divergence 120, VOID 4 |
| board leaves the comparator actually looks at | the leaf-widening verification artifact | **40 of 56** standing leaves, up from 37 |
| the stage-by-stage damage comparison | `data/engine-diff.json` | not re-run in this pass; the last measured result is carried forward from the block below |
| probed mechanics live | `data/mechanics-census.json` | **829 of 829**, level throughout |
| cited releases, classified by why their digest moved | `engine/pin_guard.js` | **34** CONTENT-CHANGED, **1** EOL-ONLY, **1** NO-DRIFT, **0** UNDIAGNOSABLE, of **36** |

**WHAT WENT WRONG, AND WHY THE FIX IS A DIAGNOSIS RATHER THAN AN EXEMPTION.** Every measurement here is taken against a frozen photograph of the code, identified by a fingerprint over its bytes. If the fingerprint moves, the measurement is stale. Tonight the fingerprint moved and nothing had changed: one source had been re-saved with different line endings, so all 26 frozen files were letter-for-letter identical while the id was new. The gate read 7 of 9 clauses failing instead of 2 of 9, and five heavy clauses were re-run to restore it. The tool now says WHICH happened — the sources changed, or they are identical apart from their line endings. **It excuses nothing:** the fingerprint still hashes raw bytes, it still moves on a line-ending change, stranded artifacts stay stranded, and this version's two failing clauses are labelled CONTENT-CHANGED and still fail with every count withheld. Both obvious repairs are correctly shut — pinning the nine unpinned sources would rewrite them, move every release id and break a suite that matches a carriage return against the simulator's own text, and normalising the comparison is banned because the difference is already observable to an instrument. **The tool also caught a false alarm in itself before being trusted**, and was shown red four ways: 9 of 16 with its normaliser disabled, 10 of 16 over-applied, 17 of 17 repaired.

**THE ENGINE HALF, AND THE RULE ABOUT WHICH FILE A SCORE CAME FROM.** Two mechanics landed. Imprison had been setting a volatile and sealing nothing, so a foe played a sealed move, dealt damage and spent PP — the tag carried the seal all along and no engine line read it. And the pivot road never asked whether a move had been bounced, so a Parting Shot reflected by Magic Bounce dropped the wrong Pokemon's stats and made the wrong Pokemon leave; the two engines were 14 board leaves apart before the fix and identical after. Board-material went 37 of 961 to 35, protocol 122 to 120, VOID 6 to 4, census level. Both closed games were attributed by id with zero new. **The published artifact was again deliberately not rewritten**, so two numbers exist for one question by design and neither may be quoted without its file.

**WE ALSO WIDENED THE COMPARISON ITSELF, ON WILL'S RULING THAT THE LEAVES COME BEFORE THE COUNT.** Board-material zero on 37 of 56 standing leaves is not the same claim as zero on all 56 — a comparator that does not look at a leaf agrees about it for free. Three more are wired, each traced to a real write AND read site before wiring and each staged in a real game, taking it to 40 of 56. **The game score stayed flat at 35 and that was called exactly in advance**: the pinned pool holds zero Lock-On and zero Dragapult, so the lab moved and the pool correctly did not.

**AN IDEA WAS REFUTED RATHER THAN TRIED, WHICH IS THE CHEAPER ORDER.** Driving the differential with recorded human clicks cannot work here. A replay stops being a replay at the first damage-dependent faint, and at least 24.8% of frozen-pool games have one on turn 1, because Champions sheets never publish the 66 stat points — the spread is absent on 100% of sheet bodies across 47,856 of them. And the differential deliberately pairs one game's team against another game's team, so no recorded sequence exists for the matchups it plays. **The gap in the driver we do use was already quantified in this repository and nobody had acted on it:** humans double-target 23.4% of the time against roughly half under independent choice, the driver declares it has no target model and no switch model, switches are 12.1% of real decisions, and its games run a median of 11 turns against real VGC's 7 with 49% hitting the cap instead of ending.

**WHAT IS STILL WITHHELD.** Everything downstream of the simulator: leaf calibration, every rollout figure, every head-to-head. The gate is shut and the MAG refit is owed as a refit rather than a restamp. The remaining whole-game differences no longer form a large group — after fencing the rows already filed, the largest actionable group was two rows.

**5.254.0 - A GENERATED COPY OF OUR RULEBOOK HAD BEEN SHIPPING A LIVE SIMULATOR BUG FOR SIX DAYS, AND THE CHECK THAT CATCHES IT WAS RED THE WHOLE TIME AND WAS FILED INSTEAD OF ACTED ON. FOUR MECHANICS ALSO LANDED: 41 OF 961 BECOMES 37.**

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES | `data/game-differential.json` | **board-material 46 of 961** — NOT republished this pass, and now stale as a description of the engine |
| the same clause, measured on tonight's engine | `data/verification/fix-batch-7.json` | **board-material 37 of 961**, protocol first-divergence 122 |
| the stage-by-stage damage comparison | `data/engine-diff.json` | **6,000 compared, 0 disagreed**, re-run after every release this version cut |
| probed mechanics live | `data/mechanics-census.json` | **829 of 829**, level throughout |

**WHAT WENT WRONG, AND IT IS NOT THE ENGINE HALF.** One rulebook describes what every move, item and ability does. A second copy of it is generated for the browser simulator and frozen into every engine release. A rule was fixed in the source on 2026-08-29 and the copy was never rebuilt, so the copy went six days behind - **and three of the differences were rule parameters the engine reads by name.** Parting Shot's pivot lost its condition, so the browser engine took its unreadable-condition fallback and sent the user back to the bench unconditionally. **Fifth instance of this class.**

**THE CHECK WAS NOT MISSING AND IT DID NOT MISS IT.** `engine/artifact_audit.js` derives every self-declaring generated bundle from that bundle's own header and re-runs its builder. It exited 1, said `1 GAP(S) FOUND`, named the exact pair, in under two seconds, and it is a registered gate. It went unacted-on because only a full suite runs it - **and it was written down in a session report, annotated "this check got BETTER across the session."** That is *a check nobody acts on is not a check*, verbatim. **The fix is a PLACEMENT, not a sixth comparison:** the pre-commit hook now runs it above its scope guard, because that guard waves a data-only commit through and "regenerate the tags, commit the data" is the shape of all five instances. No new comparison code was written.

**THE ENGINE HALF.** Four mechanics: a move's self-inflicted stat drops never ran when a Substitute ate the hit, a sleep chosen inside a handler was attributed to the move that called it, and a body standing in the sun could be frozen because the sky's own refusal handler had never been read - only its damage handlers had. Every closure was named before the run, and the games that closed were joined to the games that had parted rather than inferred from the totals.

**WHAT WE ARE NOT CLAIMING.** No model was refitted, no quarantined figure becomes quotable and the gate did not open - it is back at its found shape, with both failing clauses reading the artifact that was deliberately not republished. Four self-test plants were found unable to go red, hidden because every published run of that suite omits the switch that arms them; a suite never shown able to fail is not evidence, so all four were re-aimed and verified by hand. Five suspects were refuted before any edit. One job is owed and named: the rulebook builder should rebuild the browser copy in the same act, and proving it would strand the frozen release tonight's numbers were measured on.

**5.253.0 - A ROW ON OUR OWN LIST OF BROKEN THINGS SAID "STILL BROKEN" AND WAS BEING READ AS "FIXED", BECAUSE OF A PUNCTUATION MARK INSIDE THE CELL. NO MECHANIC CHANGED, NO GAME WAS PLAYED, AND THE SCORE IS STILL 46 OF 961.**

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES | `data/game-differential.json` | **board-material 46 of 961** — unchanged, and nothing was re-measured this pass |
| open rows on the defect register | the register | **237 → 222** after eighteen rows were made readable |
| open rows that assert something is broken | the register | **50 → 51**, because one live defect had been hiding |
| what the new check reads today | the new check | **506 rows, 0 verdict failures** |

**WHAT WENT WRONG.** Our register writes each row's status in a table cell. The reader that decides whether a row is closed takes the text after the last vertical bar in the row — and a cell that contains a bar of its own, inside a piece of quoted code, gets cut in half. One row said `open — engine DEFECT` in its first words and reported CLOSED to the gate, because the reader had picked up a note appended after the cut. **The same fault moved verdicts in both directions, and nothing prevented the next row doing it.**

**THE HALF NOBODY HAD NAMED WAS THE BIGGER ONE.** Bars hid 8 rows. **Bold text hid nine** — the reader skips spaces before the status word and does not skip asterisks, so a cell written as bold fails to match at all. Eighteen rows were repaired, notation only, one line each. A replay of the whole register through the shipping readers confirms exactly 17 verdicts moved and no eighteenth by accident.

**THE NEW CHECK ASKS A PROPERTY RATHER THAN LISTING THE TWO KNOWN SHAPES.** For every row: the verdict the gate sees must be the same whether the cell is read the way the shipping reader reads it, or the way the author wrote it. It calls the shipping reader rather than writing its own — a third copy of that reader once disagreed with the real one on 24 of 292 rows, in both directions. It was shown failing on seven made-up bad rows, four of them shapes nobody here has ever written, and then on the real register as it stood before the repair, where it names 15 rows and fails.

**WHAT WE ARE NOT CLAIMING.** Sixteen closures were made READABLE without being RE-VERIFIED, and each one says so in its own cell. A repair to how a row is read must never be mistaken for evidence that the thing it describes was fixed. 15 more cells are still cut by a bar in a way that does not change any verdict; those are reported and deliberately not put behind a count that may only go down, because a count like that invites the next author to argue their row is the exception. Ninety rows and 631 bars were checked and left alone.

**5.252.0 - THE PUBLISHED GATING FIGURE MOVES AND, FOR THE FIRST TIME TONIGHT, IT IS THE SAME NUMBER WE MEASURED: BOARD-MATERIAL 77 OF 961 → 46 OF 961 (4.8%). THE GATE ALSO STOPPED FAILING FOR THE WORST REASON AND STARTED FAILING FOR THE RIGHT ONE.**

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES, as PUBLISHED | `data/game-differential.json` | **board-material 46 of 961** — republished this pass, on release `0dec37ff5ad9` |
| the whole-game clause that REPORTS and does not gate | `data/game-differential.json` | **protocol first-divergence 141 of 961** raw, 140 after one declared |
| games actually played, and how many were unusable | `data/game-differential.json` | **961 played** of a 1200-PAIR budget; 7 void, 1 threw |
| the stage-by-stage damage differential, re-run this pass | `data/engine-diff.json` | **0 disagreed** of 6,000 compared, at 17 damage indices, seed 20260804 |
| mechanics live in the census | `data/mechanics-census.json` | **829 of 829**, 0 missing |

**THE HEADLINE UNDER THE HEADLINE.** The gate reads `CLOSED — 1 of 8 GATING clauses fail`, against 6 of 8 earlier in the day. Five of those six failed because the artifact answering them could not prove which engine produced it — nothing was known. All five were regenerated against one frozen release, and **no clause is in that state now.** The one remaining failure is a named instrument genuinely RED on the current engine over 46 real games. Moving from *unmeasured* to *measured-and-red* is progress, and the two must not be reported as the same thing. Separately, and inside a clause that PASSES: 40 open register rows assert breakage with no instrument that decides them, 7 name an instrument that answers nothing usable, and 3 name a green one.

**THE METHOD, IN TWO LINES.** The run was predicted in writing before it started — 46 board-material, 141 protocol, 7 void, 1 thrown — and read 46, 141, 7, 1: four of four, all exact. The premise behind that prediction was incomplete, and the gap was found before the run rather than after: `data/smogon-priors.json` had also moved, from Smogon month 2026-07 to 2026-08 and from 284 species to 283, and it is not a counter. It was named as the falsifier in advance and then measured inert.

**WHAT THIS VERSION DOES NOT CLAIM.** No model was refitted, no quarantined figure becomes quotable, and the gate did not open. The MAG refit stays OWED and is a REFIT rather than a restamp, because the damage table moved from 318 species to 322. One disclosure carried forward: the release that first produced the 46 was cut from a working tree that no commit contains; it is superseded by one cut from committed bytes, and every figure above names the latter.

**5.251.0 - THE GATING FIGURE DID NOT MOVE, BECAUSE THIS RELEASE IS THE DEFECT REGISTER AND THE COUNTERS. WHAT MOVED IS THE LIST OF WHAT IS STILL BROKEN: OPEN ROWS 261 → 237, OPEN-AND-ASSERTING-BREAKAGE 74 → 50, AND MORE THAN HALF THE UNVERIFIABLE CLAIMS WERE ALREADY FALSE.**

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES, as PUBLISHED | `data/game-differential.json` | **board-material 77 of 961** — unchanged, and not re-derived in this pass |
| the same clause, RE-MEASURED at the previous version | `data/verification/fix-batch-M6instr-defog.json` | **board-material 46 of 961** — measured, not published, and not re-run here |
| the whole-game clause that REPORTS, at that same measurement | the same verification artifact | **protocol first-divergence 141 of 961** |

**WHAT ACTUALLY CHANGED, IN ONE LINE EACH.** Of the **43** open register rows that asserted a defect while nothing in the repository could confirm or refute them, **24 were already fixed** and **6 were duplicates of another row**. That is the whole result: a backlog whose majority was false. Open rows fell **261 → 237** and open-and-asserting-breakage fell **74 → 50**. Separately, **four counters were reading `NaN`** because they were incremented into an object that never declared them, and one of the four was published as `null` in two artifacts — the capability fired and the counter recorded nothing, twice.

**THE THREE THINGS FROM THIS PASS THAT ARE METHOD RATHER THAN SCORE.** First, **none of the 24 closures rests on the triage**: each carries its own dated evidence in the cell with the prior status verbatim, and **22 of the 24 were re-verified against a newer commit** because one landed between the two passes. Second, **the repair that had been specified does not work and was measured before anything was touched** — escaping the pipes in a roadmap cell changes nothing, because the capture stops at an escaped pipe exactly as it stops at a bare one; the pipes were removed instead, and the shared closed-row detector was left alone because mutation testing showed it can be replaced with `return true` while all **159** of its assertions still pass. Third, the sweep found a class rather than an instance — **98** rows carry **669** unescaped pipes and **22** have a cut status cell — and **those rows were reported and left**, because inferring a closure from a parse artifact is the error that started the evening.

**WHAT THIS VERSION DOES NOT CLAIM.** No mechanic changed, no differential was run, no model was refitted, no quarantined figure becomes quotable, and no whole-game figure is re-derived. `node engine/status.js --write` was not run for the third release running, so the generated blocks in the division ledgers are three passes behind — read the gate, not the block.

**5.250.0 - THE GATING FIGURE COMES BACK DOWN, 53 OF 961 → 46 OF 961, AND THE SESSION READS 77 → 61 → 50 → 53 → 46 WITH THE RISE LEFT IN. THE PUBLISHED CLAUSE STILL READS 77 BECAUSE THE GATE'S ARTIFACT WAS AGAIN DELIBERATELY NOT REWRITTEN.** Two fixes: the INSTRUMENT half of the confusion self-hit damage draw, which lives in the differential as well as in the simulator, and a Defog that swept the wrong side. Protocol first-divergence is 154 → 141, VOID holds at 7, the census is level at 829 of 829, and the undeclared side-selection count falls 80 → 78 with its ratchet lowered to match.

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES, as PUBLISHED | `data/game-differential.json` | **board-material 77 of 961** — not rewritten in this pass either |
| the same clause, RE-MEASURED after this version's fixes | `data/verification/fix-batch-M6instr-defog.json` | **board-material 46 of 961** — measured, not published |
| the whole-game clause that REPORTS, re-measured | the same verification artifact | **protocol first-divergence 141 of 961** |

**THE TWO THINGS FROM THIS PASS THAT ARE METHOD RATHER THAN SCORE.** First: thirteen of the fourteen items in the confusion defect closed and the fourteenth was never part of it, but the game figure improved by only seven, because six of the thirteen games carry a second divergence that was already counted - **a cause count and a game count are different quantities.** Second: `PIN_DIGEST` moved, so this before-and-after spans a changed instrument as well as a changed engine; the cause count survives that and the headline integer is not strictly one-variable.

**AND THE THIRD, WHICH COST A FILE.** Four uncommitted declaration rows were destroyed by a `git checkout --` during the batch. Two were restored verbatim; two are reconstructions, labelled as such in the file, each quoting the original answer from the expired key's own text. The code has not moved a byte and the census verifies that by digest. `git checkout --` on a file another session has edited and not committed is unrecoverable, and git holds nothing to restore from.

**BOTH WHOLE-GAME FIGURES ARE CORRECTLY MEASURED ON IDENTICAL PINS AND ONLY ONE IS PUBLISHED.** Say which of the two you are quoting, every time. The 5.249.0 table below records the same split one pass earlier and is dated evidence of it rather than a competing answer.

**5.249.0 - THE GATING FIGURE WENT UP, 50 OF 961 → 53 OF 961, AND THE RISE IS THE FIX WORKING. THE PUBLISHED CLAUSE STILL READS 77 BECAUSE THE GATE'S ARTIFACT WAS AGAIN DELIBERATELY NOT REWRITTEN.** One fix inside `engine/medicham2-browser.js`: the confusion self-hit drew both of its values from one address where the authority uses two, because `data/conditions.ts` writes `this.activeTarget = pokemon` between the roll and `getConfusionDamage`. **THE DEFECT'S TRUE SIZE IS 14 GAMES; FOUR HAD BEEN HIDDEN BY A COIN LANDING THE SAME WAY ON BOTH ENGINES**, and correcting the address removed the coincidence. The evidence is narrow and is the whole argument: one class moved, `-damage field` 18 to 22, and eight of the eight moved causes carry `[from]confusion`; nothing else changed by a single game. The direction was called in writing before the run as neutral-to-slightly-worse and protocol missed the stated band by one. Protocol first-divergence is 150 → 154, VOID held at 7, the census was level, and the pins are identical — release `9b449a41c865` → `7ffc58da8ef8`, same census pin, same frozen pool, same empirical driver, same 961 games. **KEPT, NOT REVERTED**; the revert is one environment variable and is the owner's call. **THE LARGER RESULT IS ABOUT THE RULERS.** 9 of 124 register markers were being silently refused by the register tool's own predicate, and 2 of them sat on rows asserting live breakage — 22% of that register's live instrument coverage was fictional. The guard that refused them was itself fictional: measured on the pre-fix bytes, the very commands its comment claimed to keep out were already admitted one character away, so it guarded spelling and not cost. One count was summing two defects — every one of the 27 rows filed as an unrunnable instrument was a refused marker — and they are now separated. **THE SIDE-SELECTION ALARM WAS ANCHOR DRIFT, NOT NEW CODE:** four sites byte-identical to code classified on 2026-08-29, with the enclosing function drifted 1,660 lines against a 1,500-line window; undeclared 84 → 80 and the check exits 0. **A REAL DEFECT WAS FOUND WHILE PROVING THE FOURTH SITE INNOCENT** — a Defog target-side defect whose old note named the wrong line. **AND THE BEST DECISION WAS A REFUSAL:** repairing one open row's marker would have made it report green while the defect it names is untouched, so no marker was written. **STILL OPEN:** the gate is red at 53; the instrument half of the confusion defect is worth all 14 games; the Defog defect; 80 undeclared side selections; and the full register pass must not run beside a live agent until an owner decides. Nothing was fitted, the quarantine does not lift, no withheld figure becomes quotable, and `node engine/status.js --write` is OWED.

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES, as PUBLISHED | `data/game-differential.json` | **board-material 77 of 961** — not rewritten in this pass either |
| the same clause, RE-MEASURED after this version's fix | `data/verification/fix-batch-M6-sidesel.json` | **board-material 53 of 961** — measured, not published |
| the whole-game clause that REPORTS, re-measured | the same verification artifact | **protocol first-divergence 154 of 961** |

**BOTH WHOLE-GAME FIGURES ARE CORRECTLY MEASURED ON IDENTICAL PINS AND ONLY ONE IS PUBLISHED.** Say which of the two you are quoting, every time. The 5.248.0 table below records the same split one pass earlier and is dated evidence of it rather than a competing answer.

**5.248.0 - ELEVEN MORE GAMES STOPPED DISAGREEING WITH THE OFFICIAL ENGINE. THE GATING FIGURE IS 61 OF 961 → 50 OF 961, AND THE PUBLISHED CLAUSE STILL READS 77 BECAUSE THE GATE'S ARTIFACT WAS AGAIN DELIBERATELY NOT REWRITTEN.** Three more fixes inside `engine/medicham2-browser.js`: Sucker Punch did not fail into a redirector — this engine evaluated the refusal against the original aim and redirected 137 lines later, where the authority redirects first (`sim/battle-actions.ts:467` → `sim/pokemon.ts:835`) and then asks `willMove` of the Follow Me user; the `stall` die of an Encore'd Protect ran as two independent coins, our address reading `…|any|crunch|p10` against the authority's `…|any|protect|p20`, read from both logs side by side before any edit; and a contact ability transfer announced on the wrong body, red-first at `boosts.atk` with this engine at 0 against the authority's −1. Protocol first-divergence, the quantity that reports without gating, is 161 → 150; VOID is unchanged; the mechanics census is level throughout. The pins are identical — release `f3504e5f88d6` → `9b449a41c865`, same census pin, same frozen pool, same empirical driver, same 961 games — so the eleven games are attributable. Across this session the run is 77 → 61 → 50. **FOUR PREDICTIONS WERE WRITTEN DOWN BEFORE THE RUN AND ALL FOUR HIT**, stated beside the two-of-three recorded below rather than in place of it. **THE PART TO KEEP IS A TEST THAT PASSED FOR THE WRONG REASON.** The first form of the third probe had the holder clicking Protect, so the contact move never reached the handler on EITHER engine — two boards agreeing about a mechanic that never fired, caught by a counter and not by the boards. A measurement command in this session's own brief was likewise wrong and silent: `--out` without `--write` writes nothing and exits 0, the ninth variant of that class here. And about 60 checks that nothing runs were triaged with ZERO wired, which is the correct outcome — 63 of the 66 load a simulator that was being edited throughout, and certifying arms against a moving tree proves nothing. **TWO OPEN DEFECTS, NAMED:** `engine/side_selection_census.js` exits 1 at undeclared 84 against a ratchet of 81, with all four new sites arriving in earlier commits and nothing having run the check; and 9 of 124 `VERIFIED BY:` markers are refused by `engine/register_reality.js`'s own `SAFE` predicate and read as `NOT_STARTED`. **STILL OPEN AND NAMED:** the gate is red at 50; the third clause of ROADMAP #541 is not closed; the `active[].species` counter is unmoved and what remains is forme-flip TIMING rather than the revert; the largest unexamined VOID head is an accuracy case involving Parting Shot; a fourth mechanism stays fenced by ROADMAP #542. Cutting the release stranded pinned artifacts — `engine-diff`, the roster stages and `all-mechanics-fire` — which is the pin guard working, not a regression. Nothing was fitted, the quarantine does not lift, no withheld figure becomes quotable, and `node engine/status.js --write` is OWED.

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES, as PUBLISHED | `data/game-differential.json` | **board-material 77 of 961** — not rewritten in this pass either |
| the same clause, RE-MEASURED after this version's three fixes | `data/verification/fix-batch-M5M7M8.json` | **board-material 50 of 961** — measured, not published |
| the whole-game clause that REPORTS, re-measured | the same verification artifact | **protocol first-divergence 150 of 961** |

**BOTH WHOLE-GAME FIGURES ARE CORRECTLY MEASURED ON IDENTICAL PINS AND ONLY ONE IS PUBLISHED.** Say which of the two you are quoting, every time. The 5.247.0 table below records the same split one pass earlier and is dated evidence of it rather than a competing answer.

**5.247.0 - SIXTEEN GAMES STOPPED DISAGREEING WITH THE OFFICIAL ENGINE. THE GATING FIGURE IS 77 OF 961 → 61 OF 961, AND THE PUBLISHED CLAUSE STILL READS 77 BECAUSE THE GATE'S ARTIFACT WAS DELIBERATELY NOT REWRITTEN.** Three fixes inside `engine/medicham2-browser.js`: a `multiaccuracy` volley landed the wrong number of arrivals (the authority rolls accuracy per arrival and stops at the first miss; Triple Axel and Population Bomb are the two carriers in this regulation, derived rather than recalled), a non-permanent forme was not reverted on switch-out (`clearVolatile` ends with `setSpecies(baseSpecies)`, `sim/pokemon.ts:1564`), and a `choicelock` was never cleared — one of the five leaves the protocol never narrates, which is why the board clause could see it and a protocol comparison could not; that divergence family went 5 → 0. Protocol first-divergence, the quantity that reports without gating, is 168 → 161. Both runs are pinned identically — release `8ad06030e129` → `f3504e5f88d6`, same census pin, same frozen pool, same empirical driver, same 961 games — so the three fixes are the only variable and the sixteen games are attributable. **THE METHOD IS THE PART TO KEEP.** The diagnosis card was right about WHERE three times and wrong about WHY twice — the volley's addresses were eleven of eleven shared before and after, so the cause was the accuracy VALUE, proved arithmetically off the shared die before a line was edited, and two of the three bodies named for the forme defect were already correct. **The prediction was written down before the run and scored two of three**: board-material called at 60–70 and landed 61, protocol called at about 162 and landed 161, and a third counter called at 0–2 that did not move — a MISS, recorded as one, because a prediction whose misses go uncounted is not a prediction. **And a regression was caught by the lab and not by the pool**: the first form of the choice-lock fix took the mechanics census 829 → 828 while the pinned pool measured identically on both forms; narrowed, the census returned to 829. **STILL OPEN AND NAMED:** the `active[].species` counter is unmoved, and what remains there is forme-flip TIMING rather than the revert, with no probe covering it; the largest unexamined divergence head is an accuracy case involving Parting Shot; a fourth mechanism stays fenced until it is split. A fourth check could not run at all — an artifact audit died at node's default heap mid-audit and blocked commits on a partial verdict that read worse than the truth; with the heap set it is green, and the real fault was the pre-commit hook running its whole gate loop with bare `node`, so every gate in that loop carried the same trap. Nothing was fitted, the quarantine does not lift, no withheld figure becomes quotable, and `node engine/status.js --write` is OWED.

| question | artifact | answer |
|---|---|---|
| the whole-game clause that GATES, as PUBLISHED | `data/game-differential.json` | **board-material 77 of 961** — not rewritten in this pass |
| the same clause, RE-MEASURED after this version's three fixes | `data/verification/fix-batch-M1M3M4.json` | **board-material 61 of 961** — measured, not published |
| the whole-game clause that REPORTS, re-measured | the same verification artifact | **protocol first-divergence 161 of 961** (was 168) |

**BOTH WHOLE-GAME FIGURES ARE CORRECTLY MEASURED ON IDENTICAL PINS AND ONLY ONE IS PUBLISHED.** Say which of the two you are quoting, every time. The 5.245.0 table below is dated evidence of what the gate read then and is superseded from here rather than rewritten.

**5.246.0 - THE ENGINE BUG WE PUBLISHED HOURS AGO IS RETRACTED. THE TOOL THAT FOUND IT WAS COMPARING ITSELF AGAINST THE REAL GAME, NOT OUR SIMULATOR.** The 5.245.0 section below states that *"every Pokemon that loses an item — knocked off, eaten berry, spent Focus Sash — is given Unburden's doubled Speed."* **That is false and is withdrawn**; it stays where it was published and is superseded from here rather than rewritten. The line quoted there is only the entry guard; the Speed multiplier is applied on the next line and is gated on the ability's own tag, which exactly one ability in `data/tags.json` carries. The control already on record reads `ability none 187,187` for the arm that must not move against `Unburden 187,374` for the arm that must. **THE MECHANISM IS THE LESSON.** `tests/probe_leaf_widening.js:277` never read our Speed: it computed its own answer to *did this body lose an item* and compared that with the real game's record of who held the Unburden volatile, so an agreement said only that both bodies had lost an item. **An instrument can be wrong before the engine is**, and that happened three times in one night. **A REAL DEFECT REMAINS AND IT IS NARROWER** — ROADMAP #535: we recompute the doubling from whatever ability the body has now, instead of holding it from the moment the item went, so an Unburden acquired afterwards (Skill Swap is the door) doubles for us and not in the real game. Filed `INSTRUMENT OWED`: nothing currently decides it. **SIX PROBLEMS THAT EXISTED ONLY AS PROSE ARE NOW REGISTER ROWS** (`497` → `503` rows, `251` → `257` open); one carries a measurement, five say plainly that the instrument does not exist. Nothing was fitted, no measured figure moved, and `node engine/status.js --write` is OWED.

**5.245.0 - THE GATE WAS COUNTING THE COMMENTARY. IT COUNTS THE BOARD NOW, AND THE TWO NUMBERS ARE 77 AND 167 AND MUST NEVER BE POOLED.** Our headline correctness check plays the same 961 games on our simulator and on the official one. Two different things can be counted there: the **commentary** — the text a Pokemon battle prints — and the **board** — who is out, at what HP, with what boosts and status. Will's ruling of 2026-08-22 is that commentary may differ and boards may not; until today the gating clause counted commentary anyway. **The gating figure is now board-material: 961 games less the 884 whose board never diverged = 77 of 961 (8.0%).** Protocol first-divergence, **167 of 961**, has its own clause which REPORTS without gating, keeps its own row and count, and exits 1 on `--narration` so it cannot decay into a backlog. Every dated block below that quotes 167 as *the* whole-game number is superseded here rather than rewritten. **THIS IS NOT A RELAXATION, AND THE PROOF IS A MEASUREMENT.** Of the 168 protocol divergences, 102 write no differing board leaf anywhere. Against that, **11 of the 77 part a board while the protocol never diverges at all** — derived as 77 − (168 − 102) from four fields of the artifact and printed as its own kind. Under the single clause those 11 games were not counted anywhere, **so a fix could have improved the headline without improving the engine.** On them, the split raises the bar.

| question | artifact | answer |
|---|---|---|
| the gate | `engine/quarantine.js` | **CLOSED — 1 of 8 GATING clauses fail** |
| the whole-game clause that GATES | `data/game-differential.json` | **board-material 77 of 961 (8.0%)** — `state.games` less `state.games_board_never_diverged` |
| the whole-game clause that REPORTS | the same artifact | **protocol first-divergence 167 of 961** (168 raw, less one declared) — `gates: false` |
| boards that parted with nothing in the narration | derived from four fields | **11 of the 77** |
| how much of the board is compared | `tests/probe_uncompared_leaves.js` | **37 of 80 leaves** (34 → 37), the unread hole 42 → 39 |
| damage differential | `data/engine-diff.json` | **0 of 6,000** at the midpoint and both corners, on a regenerated and now verifiable pin |
| the three roster stages | `data/roster.{items,abilities,moves}.json` | 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three, regenerated, pin verifiable |

**THREE LEAVES WERE WIRED INTO THE COMPARATOR AND THE POOL DID NOT MOVE.** `throatchop`, `mustrecharge` and `flashfire` were being written onto the board with nothing reading them, so a game whose only disagreement lived in one of them scored as agreement. Each was shown red first with a control that stayed silent. The 961 games in `data/game-differential.json` then measured **flat — 77 board-material and 168 protocol, before and after** — on byte-identical engine bytes (release `8ad06030e129` is unchanged, because the comparator is not a frozen source). Flat was predicted in advance as *rise or stay flat, it cannot fall*; it does not prove those three leaves clean. **ONE HONEST CORRECTION FROM EARLIER THE SAME DAY, AND IT FOUND A REAL BUG.** The widening was said to generalise. The comparator side does; **the fixtures do not.** Unburden looked wireable on every derived signal and holds a different quantity under the same name: our simulator keeps no state for it and recomputes the doubling from *did this body lose an item*, so **every Pokemon that loses an item — knocked off, eaten berry, spent Focus Sash — is given Unburden's doubled Speed.** Filed as an engine defect owed a register row. **AND A GUARD ADDED HOURS EARLIER HAD BROKEN TWO OF OUR OWN SCRIPTS WITH THE EXIT CODE THAT MEANS SKIPPED**, so three of the five pinned regenerations were impossible and the runner would have reported a polite skip rather than a failure. **NOTHING DOWNSTREAM MOVED:** no model was fitted, `data/policy-weights.json` was not written, MAG stays paused, and nothing withheld becomes quotable. Smogon's August 2026 statistics were archived in `data/smogon-coverage-2026-08.json` as a comparison set that feeds nothing — 310 species, 1,269,250 bo1 battles, zero illegal — and our own store was re-measured rather than re-discovered at **85 species that are `isNonstandard: 'Past'`**, with **0** species Smogon has seen that we never have.

**5.244.0 - THE REPOSITORY ALREADY KNEW AND NOTHING ACTED, IN EVERY ONE OF THIS SESSION'S FINDINGS.** No simulator byte moved, no model was retrained and nothing withheld becomes quotable. What changed is the set of tools that read what our other tools were already saying. The gate mess of the last version was printed on line 103 of a 253-line status output; the store problem was explained in a comment that said, in capitals, to run something before any re-parse; the test runner was red on its own check that every test is accounted for. All three facts existed and no consumer read them. **So each fix is labelled by what it makes impossible, not by what it repaired.** CLASS-level means the same mistake cannot recur in a different spelling; INSTANCE-level means one door is shut. **New: a tool that asks what each instrument fails to check about itself** — five derived sections, about three seconds, and it refuses to pass on any finding. First run: **60 checks nothing runs**, **3 of 8 gate clauses blind to their own staleness**, **12 published figures out of date**, **783 of 1,048 counters nothing reads**, **614 store rows with no raw log**. Each of its five sections was broken on purpose and shown red first. **New: mutation testing, aimed at our gates rather than at the engine** — the engine has the official simulator as a referee and the gates have none, which is how a perfect eight-of-eight reading survived being false. **83 mutants, 57 killed, 26 survived.** **Biggest repair: the raw log is the source of truth and the store is a derived view.** We were keeping the file we can rebuild and, in one path, deleting the file we cannot: a game the current parser could not read had its raw log thrown away. Order, filter and error handling are all fixed, and **7,275 raw logs were recovered across the two stores — 6,661 and 614, none unavailable, none undated.** Re-parsing is unblocked. **Two published statements are reversed rather than quietly replaced.** The archive was said to be about **65 days** from trouble: measured, it compresses to **13.98%** and stands at **78 MB, already 78% of the 100 MB limit**, so it is now dated write-once shards. And last version's damage-table alarm repair was called sufficient: it was INSTANCE-level, the hashed field list is now derived instead, and the derivation found a blind spot the list could not — **a missing field hashed the same as an empty one**, live on 4 rows for moves and 10 for items. The alarm's value did not change, so nothing new is owed. **One check had five silent limits at once** and, between them, a **230-key** table inside the very file written to catch hand-typed lookups was never inspected; the speed argument for the shortcuts was false at **733ms against 596ms**. **We broke one thing and proved it rather than claimed it.** The full run is **143 passed, 28 failed**; every failure was re-run at the prior commit in a separate copy of the project, which left exactly one as ours and **refuted** the two that looked most like the simulator breaking. The failure count was itself wrong twice before it settled — 23, then 30, truth 28 — the first from counting a runner's output while it was still being written. **Not done, on purpose:** the status blocks in the division ledgers are one pass behind, the weights file was not touched, MAG stays paused, and the mutation dependency is declared but not installed.
**5.243.0 - THE GATE SAID THE SIMULATOR WAS DONE. IT WAS READING GAMES THAT NEVER FINISHED, AND THE OPEN GATE IS RETRACTED.** The whole-game check — play the same game on both engines, see whether the boards ever part — was being answered by a run from a driver that hunts rare mechanics instead of trying to win. In that run 17 of 961 games reached a result (1.8%), 944 stopped at the 12-turn cap with both sides still standing, and 0 boards parted. Nothing can part at the end of a game that has no end. Re-run with everything else pinned identical — release `8ad06030e129`, cap 12, pool `0d103fb9fa87`, census pin `9446a684709d`, 961 games of a 1200 PAIR budget, the driver the only difference — the empirical driver that copies real human clicks reaches a result in 474 of 961 (49.3%) and 77 boards part. **The gate now reads CLOSED — 1 of 8 clauses fail, and that is the correct reading. Nothing was tuned.** **The corrected figures, and there are two of them:** board-material divergence 77 of 961 (8.0%), protocol first-divergence 168. Say which one every time. **This reverses what this document published.** The dated blocks below reporting a clean or near-clean whole-game differential, and the 8-of-8 gate readings beside them, were all measured on the coverage arm; they are kept as written and superseded here rather than quietly rewritten, and the MEDICHAM quarantine is not near lifting. **What was changed:** the published differential file IS the empirical arm now rather than a second file that could drift from it, the generator refuses to publish a coverage run into that path, and the clause refuses any artifact whose own steering policy is not the empirical one with the verdict MEASURED ON THE WRONG POPULATION. It was shown red against the real coverage artifact before that artifact was replaced; selftest 159 passed, 0 failed. **What was deliberately not changed:** the clause prints 167 because it counts protocol first-divergence less one declared case rather than board-material, which the owner's 2026-08-22 call makes the right bar — moving it in the same pass that turned the gate red would be indistinguishable from tuning, so it is his call. The move-choosing weights were not written and MAG stays paused. `node engine/status.js --write` was not run, so the generated ledger blocks are one pass behind.
**5.242.0 - THE ALARM ON OUR DAMAGE TABLE COULD NOT SEE A TYPE CHANGE OR A WEIGHT CHANGE, AND IT NEVER COULD.** No model, no game rule and no damage number moved this version. The change is to one of our own rulers. The move-choosing model is trained against a table of every Pokemon, and an alarm compares a short fingerprint of that table against the fingerprint saved at training time. The fingerprint asked each row for a typing field spelled `ty`; this table spells it `t`, so all 322 rows answered nothing and the term was a constant blank. Weight was not in the fingerprint at all - and weight really does change damage in this format, through Low Kick, Grass Knot, Heavy Slam, Heat Crash, Heavy Metal and Light Metal. We proved both by changing one field at a time and watching whether the fingerprint moved, with two fields we already knew were watched as the control, and with the missing field invented on a single row as a second control - because a field that is absent looks identical to a field that is present and empty, and only a change can tell those apart. The fingerprint moved `1bda9df11d73` -> `9d289cf77e24` with no change to the table itself. **We did not re-save the fingerprint and we did not re-train the model, deliberately.** The saved stamp is now out of date for two separate reasons - the table was rebuilt from 318 to 322 Pokemon, and the ruler changed - and re-saving would merge the two so that nobody could ever tell afterwards which was which; the distinction is written down in the changelog instead. Re-training is paused by the owner's decision until the simulator underneath it is correct, since re-fitting against a simulator we know is still wrong would only have to be redone. The dashboard's warning is still showing, still fires on the same clause, and still says the same thing. Full account: `docs/_reports/2026-09-03-table-digest-blind-fields.md`.
**5.241.0 - A DELAYED ATTACK COULD NOT CRIT, AND BREAKING A SUBSTITUTE CHARGED FOR MORE DAMAGE THAN IT ACTUALLY DEALT.** Two fixes inside the simulator, taken one at a time so each could be attributed. A move that is set up now and lands two turns later took no critical-hit roll at all in our engine. We proved it without hunting for a rare event: handed a die that must crit and then a die that cannot, the official game answered 72 damage with the critical-hit message and 48 without, while ours answered 69 both times - no movement across a varied input, which is the signature of a wire that was never connected. The roll now happens, and at the same point in the damage sum the real game uses. Separately, when an attack overkills a Substitute doll, the real game only counts what the doll absorbed; we were counting the whole swing, so a recoil move that should have cost 12 health cost 25 and a draining move that should have healed 21 healed 62. One shared piece of code now answers "how much did that actually deal" for all three places that ask. Census 827 -> 829 mechanics proven live, with nothing missing, hollow or throwing. **The whole-game comparison against the pinned pool of real ladder games was NOT run** - the machine was in use - so no movement in it is claimed in either direction; both mechanics are rare and the expectation was written down before the work, but an unrun measurement is left out rather than captioned. Separately and outside the simulator, a red warning on our own dashboard was settled: the rebuilt damage table does NOT force the move-choosing model to be re-trained. All 91 changed rows are mega or mid-battle formes, no stat, type, item or ability moved on any row, and the substantive change - 76 mega movesets - never reaches the model, which overwrites those moves with the team sheet's. Upper bound on games affected at all: 12 of 16,830 (0.07%). The verdict is a re-stamp, not a re-fit. The alarm that watches that table was also found to be partly blind - it reads a field that exists on none of the 322 rows and ignores weight entirely - and is deliberately left unfixed until it can land in the same pass as the re-stamp.
**5.240.0 - ELECTRIC TERRAIN NOW REFUSES SLEEP, WHICH IS HALF OF WHY ANYONE SETS IT.** Our simulator read the half of Electric Terrain that boosts Electric moves and none of the half that keeps grounded Pokemon awake, so Sleep Powder and Yawn worked on it exactly as on an empty field. Both refusals are now wired off one shared rule, and deliberately at two separate points: Yawn hangs a countdown rather than sleeping you immediately, so stopping only the sleep would have left that countdown and its announcement standing for two turns. Airborne bodies are still fair game, other statuses still land, and Rest now fails outright on the terrain. Two of our own test setups were found to use a Pokemon and a move this regulation does not allow; they were reported and left alone rather than quietly changed. Census 825 -> 827 mechanics proven live. On 961 real ladder games every figure is unchanged - predicted in writing before the run, and confirmed rather than assumed by counting how often the new rule fired in those games: zero times.
**5.239.0 - TWO ABILITIES WERE AIMING THEIR EFFECT AT THE WRONG PLACE, AND THEY TURNED OUT TO BE TWO SEPARATE MISTAKES RATHER THAN ONE.** Toxic Debris scatters poison spikes on the side of whoever hit it - which the real game resolves as "the side that is not the holder's", so when your OWN partner lands the hit the spikes still go to the opponent. We were reading it off the attacker, so an ally's Earthquake put them on our own half. Sand Spit kicks up a sandstorm whenever its holder is hit, over the top of any other weather; we only allowed it from a clear sky, so it did nothing in exactly the games a Sandaconda is brought for. Both were proved against the official simulator and each was given its own off-switch, which is how we showed they are independent: each switch breaks only its own case, and a third ability in the same family does not move at all. Census 819 -> 821 mechanics proven live; on 961 real ladder games the board disagreement count fell 82 -> 80 and the disagreement list lost exactly the two entries naming these abilities.
**5.237.0 - AN ACCURACY DROP AND AN EVASION BOOST ARE ONE NET STEP, NOT TWO SEPARATE MULTIPLICATIONS.** The real game adds the two together, clamps the total, looks up a single number and rounds it down. We were multiplying each one in turn and keeping the fraction, so “lowered accuracy into a boosted target” read 56.25% where the truth is 60%, and at the extremes 11% where the truth is 33%. In one shape it went the other way (80% against a true 75%), which is what stops this being a one-directional “we were too harsh” correction. The rounding half turned out to reach further than the combining half: it separates the two versions even when only one of the effects is present, and it caught one of our own tests that had recorded the un-rounded value as correct. Both are fixed, both are proved by a test that was shown failing first against the official simulator's own instrumented number, and the 961-game whole-game comparison is unchanged in every figure - predicted before the run, because the ingredients are rare in the sampled games.

**5.236.0 - THE KING'S ROCK FLINCH ROLL NOW HAPPENS ONCE PER HIT THAT LANDS, NOT ONCE PER ATTACK.** On a ten-strike move that is the difference between a 10% flinch and a 65% one, and our simulator was giving every volley the flat 10%. The official simulator's own dice were counted with an instrument rather than reasoned about; ours now produce the same count, including the case where the target faints part-way through and the remaining strikes never happen. The mechanics census rose 817 -> 818 and the 961-game comparison against the official simulator is identical in every figure - both predicted in writing before the run.

**5.235.0 - THE NEXT REGULATION IS BUILT FOR BEFORE IT EXISTS, AND THE ROTATION ALARM WE ALREADY HAD COULD NEVER HAVE FIRED.** A new regulation is expected around 9 September and Showdown usually adds it a day or two after. The public replay pool is a rolling window of roughly 1,250 games per format, so the first days of a metagame cannot be fetched later. The new collector asks Showdown's live server which formats it runs, recognises a Champions regulation by the shape of its id rather than by a name we typed, and starts collecting on the next six-hourly run with no code edit. **Until then it collects nothing and says so, with counts** - because a capability doing nothing and a capability that was never connected produce the same output every day but one. Each regulation gets its own store file named after the format, so regulations can never be pooled. **A set difference against our config would have been the wrong test:** the PREVIOUS regulation is also live on the server and also missing from our config, so a naive rule would have started collecting a dead metagame. The regulation letter is part of the format id, so the collector compares order and takes only what comes after the active one. **The defect found while building it:** every stored game was labelled with the active regulation's name regardless of which regulation it came from. Our only rotation alarm tallies that label, so it was comparing a constant with itself. It is now read off the battle log; games from the current regulation keep exactly the label they already had, verified against 800 real stored games, so nothing already collected changes meaning. **No engine number moved and none is quoted here** - another session was editing the simulator while this work ran, so every census figure on disk belongs to that pass, not this one.

**5.234.0 - OUR DISAGREEMENT REPORT WAS FILING REAL PROBLEMS AS IMPOSSIBLE, AND TWO OF THEM CHANGE THE BOARD.** Every time our engine disagrees with the official simulator we tag the disagreement with whether the things it mentions are even legal in this format, so nobody works on something no real game can reach. The tag looked each name up and took the first answer - and a name can mean more than one thing. The condition Heal Block is caused by a legal move and shares its name with a banned one; the Metronome item is legal and shares its name with a banned move; and Floette-Mega, which people bring, appears in the battle log as plain "Floette", which is not legal. **All three were marked impossible, and two of them are disagreements where the boards genuinely end up different.** This is the worst failure shape we have: a tool that hides a problem makes no noise at all. **The fix asks the format instead of keeping a list** - we work out all 96 conditions something legal can cause and find the three that share a name with a banned move, and do the same for items and Pokemon formes. **Nothing in the fix names a Pokemon or a move, so the next one is caught for free.** **Proved by switching it off**: a knob puts the old behaviour back and the new test fails six ways; with it on, it passes, and re-reading our real measurement file shows three rows relabelled and nothing newly hidden. **No game moved** - the frozen engine is identical before and after, and every headline number is unchanged: 82 boards differing, 172 disagreements, 815 of 815 lab checks passing. Six predictions written down first, six exactly right.

**5.233.0 - TEN FORMES HAD NO WEIGHT, FOUR MOVES ARE PRICED ENTIRELY BY WEIGHT, AND THE DATA FILE IS REGENERATED.** Bring one of those ten and a weight move deals ONE damage where the real game deals fifty-five, because a missing weight falls through to a base power of zero. Transform into one mid-battle and it keeps the weight of whatever it used to be. The generator was fixed yesterday and the file deliberately left alone; this is the file. **It turned out to be two changes rather than three** - the third was a duplicate row for a body we already had, our own artifact audit named it the moment it landed, and the generator now drops such a duplicate by asking the game which species a row is rather than by naming anything. **The row reordering was proven harmless rather than assumed harmless**: we found the one consumer that genuinely reads rows in order, showed this reordering never reaches it, and then ran all 815 mechanic checks against a control file holding the old numbers in the new order - zero verdicts moved. **Predictions written down first: six of eight exactly right, eight of eight in band.** Lab checks 814 -> 815 passing; against 961 recorded human games, disagreements 173 -> 172 and boards that actually differ 83 -> 82. The single fixed game is a Heat Crash at a freshly mega-evolved Falinks - which was on our list of Pokemon this could NOT affect, and was our own control, because it is safe for one pair of weight moves and not for the other. The measurement found what the arithmetic missed.

**5.232.0 - WE PREDICTED THE LADDER MEASUREMENT WOULD MOVE FOR THE FIRST TIME IN SIX BATCHES, WROTE IT DOWN FIRST, AND IT MOVED.** Bug Bite and Pluck take a berry off the body they hit and the ATTACKER eats it. This engine took the berry and threw it away, and announced the theft with the wrong attribution. Both halves are fixed. **The membership was derived rather than taken from the brief and this time it agreed with it**: of the nine legal moves that call `takeItem`, exactly two make the attacker eat what they took - the seventh time in this session a derived membership has been checked and the first time it came back equal. **The scoreboard question was answered in advance, with arithmetic**: 369 pool games MENTION Bug Bite but only 81 CLICK it, 53 of 117 clicks land on a body whose sheet item is a berry, and the 961-game sample settles it exactly because the differential's `-enditem field 4` class was 3 games and all three of its causes were this line. Measured after: protocol-diverged 175 -> 173, board-parted 84 -> 83, distinct causes 153 -> 151, that class GONE, end-state 903/55 -> 905/53. Five of seven predictions at the point estimate, seven of seven in band, and every movement attributed by name - three causes removed, all three this defect; one added, and it is the third game running further to an unrelated damage value. **The over-fire controls are the arms that matter**: Knock Off strips the same berry and the attacker must still eat nothing, a Sticky Hold berry must not be eaten at all, and the thief must gain no `lastItem` - Hydrapple learns both Bug Bite and Recycle, so that last one is reachable rather than decorative. **One fix or two was settled twice**: a 2x2 over two revert knobs, each moving its own staged board and leaving the other's byte-identical under both settings; and Ripen's second resist-berry halve, measured at 94 where the authority requires ~47, is a SEPARATE fix and is blocked on a derived-table regeneration that is itself blocked on a store being appended to every few hours. Two hand-list rows now want the same one pass, which is a stronger case for it than either had alone. Census 813 -> 814 live / 814 probed / 0 missing.

**5.231.0 - WE WERE HANDED THREE BROKEN ROADS AND DERIVED TEN, THEN REFUSED THREE OF THEM WITH MEASUREMENTS.** An ability that reacts to eating a berry - Cheek Pouch heals a third, Cud Chew eats it again next turn, Ripen doubles it - only fired on four of the seven ways this engine actually eats a berry. It missed a type-resist berry spent to soften a hit, a berry spent to cure confusion, and a berry FLUNG at a body by the opponent. **All three are fixed and all three change HP**: on a staged board the resist-berry arm goes from 328 to 725, the confusion arm from 476 to 873 and the fling arm from 767 to 1164, each exactly a third of max on top of its own no-ability control. **The membership was not taken from the brief.** Read out of the format there are TEN roads, and the three left alone were each refused by a derivation: Cud Chew's residual re-eat can only reach its own ability, which the authority deletes two lines later, because exactly three legal entities in this format carry any `on*EatItem` hook and all three are abilities on the eater; Bug Bite and Pluck raise it on the ATTACKER and no legal carrier of any of the three abilities learns either move; Fling's thrower-side firing needs a Cud Chew body that knows Fling and none exists. **One missing call was five mechanics, and that is why the fix routes through the shared consumption site rather than adding a heal**: the authority does the whole of `eatItem` in one straight line, so the resist-berry road had also been skipping the record Harvest, Belch, Recycle, Pickup and Symbiosis read. **Census 812 -> 813 live / 813 probed / 0 missing. The pinned pool came back byte-identical - 153 causes, zero added, zero removed, zero moved, protocol 175, board-parted 84, `ordering` 24, end-state verdicts identical - and all five figures were written to disk before the run with the arithmetic that predicted them** (Cheek Pouch is 10 of 13,214 pool games, Ripen 2, Cheek Pouch beside a confusion berry ZERO). That is the lab moving and the ladder not having these Pokemon on it, not an unwired knob: the resist-berry road demonstrably runs in the pool, and it is the CONSUMER that is absent. **The over-fire controls are the arms that matter** - the two roads that already worked must stay character-identical, and they are, before the fix, after it, and under the knob. **Neither outstanding red is this batch's**: `probe_upkeep_lines.js` is the inherited 4 of 49 by name and `probe_red_demo.js` the inherited 5 plus 1 hollow. **One defect was FILED rather than fixed and it is this batch's own consequence**: Ripen's second halve of a resist berry needs `abilityState.berryWeaken`, written from `onEatItem`, which is only now derivable.

**5.230.0 - THE HYPOTHESIS THAT THESE WERE ONE DEFECT WAS TREATED AS A HYPOTHESIS, AND AGAIN THEY WERE TWO.** A busted Disguise revealed itself at the moment of the hit; the real game writes the reveal at the `Update` raised at the FOOT of the hit, below everything else the move still owed - the other spread target's damage, a secondary's stat drop, a Throat Chop's silence. Separately, Cheek Pouch healed ABOVE the berry it was reacting to, and the berry's own `-heal` line then reported the post-BOTH total, because the heal had already been applied. A 2x2 over the two revert knobs settles it: each moves its own staged board and leaves the other byte-identical under both settings of the other. **G6 IS NOT THE STANDING DISGUISE DEFECT** - that one is ROADMAP #392, closed 2026-08-23 and carried live in the census; it asks WHO the absorb refuses, this asks WHERE the reveal lands, and ROADMAP #505 cannot reach it because this forme change passes `isPermanent: true`. **G8 was re-measured on the current tree before being diagnosed**, as the brief required, and the resist-berry fix that landed hours earlier had not changed it - the two are different roads, and the resist berry never went through the shared consumption site at all. **Census 810 -> 812 live / 812 probed / 0 missing; empirical protocol 181 -> 175 of 961 and the `ordering` class 31 -> 24 - exactly seven games, every one of the seven removed causes naming one of the two mechanisms, with one cause added that is one of the seven diverging later - board-parted unmoved at 84 and the end-state verdicts identical. The prediction was 175 / 84 / 24 / identical, written to disk before the run: all four exact.** Both probes were shown red first and the over-fire controls are the point: a plain single-target click must keep the reveal adjacent (a fix deferring it to the end of turn would break that), a multi-arrival volley must keep its between-arrival bust, and the status-berry road - which was already in the authority's order - must not move. **Neither outstanding red is this batch's**: `probe_upkeep_lines.js` is character-identical with both knobs restored, and `probe_red_demo.js` reads the inherited five. **A gap this batch's reading exposed was FILED rather than fixed**: three berry-eating roads raise no `EatItem` at all, so a resist berry eaten under Cheek Pouch heals nothing - measured on a staged board, and its own batch because it changes HP.

**5.229.0 - THE HYPOTHESIS THAT THESE WERE ONE DEFECT WAS WRITTEN INTO THE BRIEF, AND IT WAS REFUTED BEFORE EITHER FIX LANDED.** Both were described as *"the packet loop defers something the authority does per arrival"*. A 2x2 over the two revert knobs says otherwise - each moves its own staged board and leaves the other byte-identical under both settings of the other - and the second one is not about the packet loop at all: a type-resist berry is spent during the damage CALCULATION, so on a plain single-hit spread move every target's berry is announced before any target takes damage. The first is genuinely the volley: `DamagingHit` is raised inside `spreadMoveHit`, once per hit, and this engine paid every reaction below the whole loop. **Census 808 -> 810 live / 810 probed / 0 missing; empirical protocol 191 -> 181 of 961 and the `ordering` class 43 -> 31 - exactly twelve games, and every one of the twelve removed causes names one of the two mechanisms - with board-parted unmoved at 84 and the end-state verdicts identical. The prediction was 183 / 84 / 31, stated before the run: three exact and one inside its stated band.** Both probes were shown red first and the over-fire controls are the point: the reaction probe's two controls are SINGLE-HIT clicks off the same bodies into the same reactors, which must not move, and the berry probe carries an arithmetic control (empty hand, exactly double the damage) and a substitute arm where the berry must survive. **A KNOWN-OPEN row in `tests/test-resolution-order.js` had stopped being true** - it declared this interleaving unreachable without converting the whole hit loop, and it was one restructure too pessimistic - so it is promoted to a RED PROVEN arm in the same pass rather than left standing with a footnote. **One red WAS this batch's and was repaired**: a demonstration in `tests/probe_red_demo.js` anchored on the berry's old line; another, `tests/probe_upkeep_lines.js` at 4 of 49 arms, was cleared of this batch by a knob-cleared control and by re-running it against the pre-change release.

**5.228.0 - THE ENGINE'S OWN COMMENTS DESCRIBED BOTH DEFECTS, AND `data/residual-order.json` ALREADY CARRIED BOTH ORDERS.** `RESIDUAL_GROUPS`' header read *"psn/tox/brn are 9,9,10 and run as one step"* - it named the defect out loud - and `residualOrder`'s header called the `|-sideend|...|tailwind` rows "a case it does NOT fix", which was the wrong cause AND the wrong count. The burn now has its own step at order 10 and Perish Song has one at order 24; neither fix wrote a byte of data. **They are two fixes and that was measured before either was landed**, a 2x2 over the two revert knobs in which each moves its own board and leaves the other byte-identical. **Census 806 -> 808 live / 808 probed / 0 missing; empirical protocol 199 -> 191 of 961 and the `ordering` class 53 -> 43 - exactly the ten dumped games - with board-parted unmoved at 84 and the end-state verdicts identical. The prediction was 191 / 84 / unmoved, stated before the run, and it held at its point estimate.** Two new census probes, each red under its own knob first, and the over-fire controls are the point: the status probe brackets its split with the order-5 Leftovers heal, the order-8 Leech Seed chip and the order-13 trap chip, all asserted unmoved, and the four-armed `move/perishClock` probe - the control for where the perish `|faint|` lands - was deliberately not touched. **The closeted ROADMAP #440 row still holds**, and my first reading of its falsifier (a) was my own instrument: I grepped the dump for a field name the closet's matcher uses and the dump calls it something else. **`tests/test-perish-song.js --break-the-faint` was dead at HEAD** - its mutation anchor had not matched since 2026-08-24 - and is repaired and shown red rather than filed.

**5.227.0 - `checkWin` RETURNS ABOVE `AfterFaint`, SO THE KILL THAT WINS THE GAME WAS BEING PAID FOR ON A BOARD THAT NO LONGER EXISTED.** `faintMessages()` announces every `|faint|` of a drain, then asks `checkWin` (`sim/battle.ts:2592`) and RETURNS if the battle is over; only past that does it raise `runEvent('AfterFaint', ..., length)` at `:2596` - ONCE, sized by the depth of the drain. This engine paid inside its per-row faint step, so a spread that killed two wrote `faint,BOOST,faint,BOOST` where the authority writes `faint,faint,BOOST:+2`, and it kept paying after a drain that emptied a side. One new once-per-move step, gated on the engine's own `sideWiped`. **Census 804 -> 806 live / 806 probed / 0 missing; empirical board-parted 88 -> 84 of 961 and protocol 204 -> 199, five causes removed and none added.** New two-engine probe `tests/probe_afterfaint_boundary.js` whose OVER-FIRE control is the point of the file - a Ground-immune body in the second slot makes every turn exactly one KO on a battle that keeps going, so an engine that learned *stop after a faint* rather than *stop after the WIN* fails there. **The prediction MISSED by 4, in the improving direction**, and the reason is written down rather than absorbed. **Two of this repo's own instruments were keyed to a spelling the authority never writes** and reported a correct fix as a broken mechanic; both now read the authority's `|-ability|` line. **ROADMAP #362 is not this site** - it was closed by WIRE 160 on 2026-08-23 and its row is stale.

**5.226.0 - THE VOLLEY THAT KILLS TOLLED THE ATTACKER FOR HITS THAT NEVER LANDED, AND THE CARD REVIEW'S D-FAMILY IS RE-CUT.** The Champions hit loop refuses to open an arrival against a body already on zero (`data/mods/champions/scripts.ts:461-464`) and writes `-hitcount` as `hit - 1`; this engine's packet loop already knew both facts, and its REACTION count was a second, wrong reading of the same quantity - so `|-hitcount|1` was printed beside two Rough Skin tolls off one click. One expression, one knob (`MEDI_VOLLEY_REACT_DRAWN=1`), one counter; `R.react` feeds both the punish and the buff families, so both were corrected at once. **Census 803 -> 804 live / 804 probed / 0 missing; empirical board-parted 90 -> 88 of 961 and protocol 205 -> 204, predicted at the point estimate before the run.** New two-engine probe `tests/probe_volley_reactor_count.js`, with the survivor turn as the over-fire control and Sharpedo's other legal ability as the cleared control. **The grouping this came from was wrong, and that is the second deliverable**: D2 is four causes, not one; D4 is refuted (both engines fire Stamina twice - it is a position, not a frequency, and it is the same defect as D2's ordering half); D3 is its own site. Only the board-material half was landed; the rest is filed with its cause in `docs/_reports/2026-08-29-faint-boundary.md`.

**5.225.0 - ALL TWENTY-TWO FAR-SIDE SITES ARE CLASSIFIED, AND THE FIVE THAT WERE WRONG ARE ONE CAUSE.** `docs/_reports/2026-08-29-armor-tail-ally.md` §3.2 filed twenty-two sites in the simulator that hard-code the mover's far side and said eighteen were unclassified; each now carries the authority line that decides it - **seven SIDE, fifteen TARGET, seventeen CORRECT, five WRONG**. The five share one cause: a body `reaimToSlot` already resolved onto the mover's OWN side is looked up in the foe array, scores `-1`, and the site does nothing in silence. **Two were fixed** - the status and damaging halves of `forcesSwitch`, which are one authority function (`sim/battle-actions.ts:1353`) and therefore one batch - and **three are filed as separate batches** with their own fixtures. **Census 801 -> 803 live / 803 probed / 0 missing**; new probe `tests/probe_ally_forced_switch.js`, 6 arms, 3 red and 3 controls, 0 failing. **The pool did not move and the prediction said so before the run**: board-parted unmoved at 90 of 961, protocol unmoved at 205, end-state 898/60/2/1 identical - neither driver can aim a `normal` move at a partner. What is left behind is `engine/side_selection_census.js`, an ENGINE-side census of 102 side-selecting sites with a downward ratchet on the undeclared count; it catches four spellings a single regex misses, including one containing no `side` token at all, and it would NOT catch a site that picks a side without an A/B ternary.

**5.224.0 - THE INSTRUCTED REPEAT PICKED ITS OWN TARGET, AND THE AUTHORITY REUSES THE SLOT THE CLICK NAMED.** ROADMAP #534, filed by the batch before this one from a failing over-fire control, is closed. Two roads were wrong in different ways: `targetForMove` ranked the foes by damage and sent a damaging repeat at whichever it hurt most, and it returns null for a move with no base power, so a single-target STATUS repeat fell to `live(foes)[0]` and was pinned to foe slot 0 for **73 of the 355 legal single-target moves**. The empirical pool moved **board-parted 91 -> 90 of 961** with protocol unmoved at 205 and throws 2 -> 1, and the delta is KNOB-CONTROLLED rather than diffed — the same run under the revert knob on the same release reproduces the baseline exactly. Exactly one divergence cause removed and none added. The census is **unmoved at 801 live / 801 probed / 0 missing**, which was predicted; the pool prediction was "unmoved" and MISSED by one, in the improving direction. New probe `tests/probe_instruct_target.js`, 14 arms, 0 failing; the sibling probe’s declared KNOWN-OPEN arm is promoted to a counted control and it reads 13 / 0 / 0.

**5.223.0 - INSTRUCT NEVER ASKED THE SHIELD, SO A PROTECTING BODY TOOK A SECOND ACTION THE AUTHORITY NEVER GAVE IT.** `shieldRefuses` had thirteen callers and the `instruct` branch was not one of them. Instruct is the ONE legal move in this format that hands another body an EXTRA action — derived on every run, not named: twelve others only reorder an action that already exists. Champions does not rewrite Instruct, checked rather than assumed. The empirical pool moved **board-parted 92 -> 91 of 961** and **protocol 207 -> 205**, and exactly one divergence cause changed with no new one appearing, so the movement is fully attributed. The census is **unmoved at 801 live / 801 probed / 0 missing**, which was predicted — this wires no new tag. A second, independent engine defect was found by a failing over-fire control and is FILED as ROADMAP #534, not fixed: the instructed repeat re-picks its target instead of reusing the slot the move was aimed at.

**5.222.0 - FIVE CARRIED TEST FAILURES CLOSED: THREE WERE THE INSTRUMENT, ONE WAS THE HARNESS, ONE IS
A REAL ENGINE DEFECT AND IS FILED.** Five checks had been reported red, correctly and verified as
pre-existing, through eleven test batches. `CLAUDE.md` bans "known failure" as a status, so each is
closed with a verdict.

| check | verdict |
|---|---|
| `tests/test-resolution-order.js` | FIXED - `tools/lownode.cmd` did not honour the `ABRA-HEAP` the check declares. 134 to 0; 26 arms, 0 failing |
| `tests/test-engine-diff.js` | INSTRUMENT - exit 3 was `engine/publish_guard.js` refusing a shrink. `--out` added and wired into the suite |
| `tests/probe_shield_refusal_line.js` | INSTRUMENT - a blanket expectation demanded silence from a control that correctly speaks. 13 arms, 0 failing |
| `tests/probe_random_target_address.js` | INSTRUMENT - it assumed one shared address per die call, which the middle arm violates by design |
| `tests/probe_instruct_shield.js` | FILED as ROADMAP #532 - a real, board-material engine defect, deliberately not fixed |

**NO ENGINE BYTE CHANGED AND NO PUBLISHED ARTIFACT WAS REWRITTEN.** `data/engine-diff.json` is
unchanged and still carries 0 disagreements over 6,000 matchups at all sixteen roll positions.
`data/published-samples.json` is unmodified.

**THE GENERALISATION, MEASURED.** 79 files in this repository start a node child process, and exactly
one - `tests/run-all.js` - derives the child's heap from the child's own source. Today's exposure is
nonetheless small and is stated as such: only two files declare `ABRA-HEAP`, and the second was
measured passing at the default. Full account and the `OWED, NOT RUN` list:
`docs/_reports/2026-08-29-five-reds.md`.

**5.221.0 - `selfSwitch: true` IS A DEFAULT THE HANDLER TAKES BACK, AND THIS ENGINE READ IT AS A
PROMISE.** Parting Shot's own `onHit` deletes its `selfSwitch` when `this.boost({atk:-1, spa:-1})`
landed on nobody, with `mirrorarmor` named as the exception - the only `delete move.selfSwitch` in the
whole dex. We pivoted unconditionally, so we were right about the exception by being wrong about the
rule it is an exception to, and the wrong body held the slot for the rest of the game. **Derived from
the format, and wider than the card: THREE abilities cancel it** - Clear Body, White Smoke and Flower
Veil, which covers a Grass ALLY and not its Fairy holder - **Mirror Armor is the exception, and Hyper
Cutter refuses one stat only, so the pivot SURVIVES it** because a partial landing is a success.
**Full Metal Body has zero legal carriers and was not wired.** **Census 798 to 801 live / 801 probed /
0 missing. Board-parted 93 to 92 of 961, protocol 208 to 207 - predicted UNMOVED, so the prediction
MISSED by one, in the improving direction.**

**5.220.0 - EVERY PRIORITY GATE COMPARED THE PRINTED MOVE PRIORITY AND THE AUTHORITY COMPARES
THE ONE THE ABILITY CHANGED.** `getActionSpeed` writes the modified number onto the move, which is
why all five gates test against 0.1 rather than 0. This engine had two implementations of that one
fact - the turn sort read the tag, the gates read the constant - so Gale Wings was absent from Armor
Tail, Queenly Majesty, Quick Guard, Upper Hand and Psychic Terrain alike, and a full-HP Talonflame's
Brave Bird landed here where the authority refuses it. **Census 797 to 798 live / 798 probed / 0
missing. Board-parted 94 to 93 of 961 - predicted at its point estimate before the run - protocol 211
to 208, end-state 894/63 to 895/62.** The sibling card, `move.target === 'all'`, is REFUTED rather
than landed: the authority EXEMPTS that class and the three moves it does refuse cannot be reached
above priority 0.1 in this regulation.

**5.219.0 - THE ARMOR TAIL CARD WAS A TARGETING DEFECT WEARING AN ABILITY'S NAME.** A Helping
Hand forced by Encore was refused by an Armor Tail it had never been aimed at. The refusal is
correct and is unchanged - it fires only on an action whose target is in the mover's foe array, and
an ordinary clicked Helping Hand at one's own partner is green on the pre-fix bytes. What was wrong
is that all three of this engine's default-target draws (Encore at selection, Encore at execution,
and the called-move branch) went straight to the foes, where `Battle#getRandomTarget` answers the 91
near-side moves first. **Census 796 to 797 live / 797 probed / 0 missing. Board-parted UNMOVED at
94 of 961, protocol 213 to 211, two causes removed and none added - and the prediction that the
pool would not move was made before the run.** Card C6 stands: the foe axis is refused on both
engines on all three arms that stage it.

**5.218.0 - CARD F2's FAMILY WAS NOT A COUNTER DEFECT AT ALL, AND THE COUNTER WAS ALREADY
RIGHT.** The `stall` lifecycle was staged nine ways - consecutive shields, the `duration: 2` gap, a
switch-out, Detect, Endure, Baneful Bunker, a Wide Guard feed - and agreed with the authority at every
turn boundary. What was wrong is one line up: the shield GATE was armed in the turn pre-pass off the
move the player clicked, and three sites substitute the move afterwards (Encore's execution-time
override, Instruct's spliced action, a called move). A substituted shield never reached the gate, so it
drew no die and was announced from a stale flag. **Census 795 to 796 live / 796 probed / 0 missing.
Board-parted 97 to 94 of 961, `active[].stall` 13 leaves / 13 games to 11 / 11, protocol 214 to 213.**
Instruct is the SAME defect, measured by arm rather than argued. What is left of the family is the
shield's own DIE - four games at counter 3, one of them the opposite sign - and that is a different
batch. Full account: `docs/_reports/2026-08-29-stall-counter.md`.

**5.217.0 - CARD F1's SYMPTOM WAS RIGHT AND ITS CAUSE WAS THE WRONG WAY ROUND, WHICH IS NOW FOUR
CARDS IN A ROW.** The card read the encored body as moving to the BACK of our turn. What happens is
that the authority moves it FORWARD: Champions overrides `encore.condition.onStart` and rewrites the
target's queued action through `queue.changeAction`, where mainline leaves the swap to
`onOverrideAction` - the door `sim/battle-queue.ts` documents as the one that does not change ordering.
This engine implemented mainline's rule, which is correct for the case Champions leaves alone.
**Census 794 to 795.** **`order_probe` 11 rows to 2** - nine of the eleven turn-order disagreements in
961 real games were this single mechanic, including the four `protect(+4)` rows the card review nearly
filed as a priority-table defect and retracted. Protocol divergence **216 to 214**; **board-parted
unmoved at 97**, which was NOT the prediction and is recorded as wrong: the ordering line was masking
the causes the games actually part on, two of which are now visible and filed (Armor Tail refusing a
priority move aimed at the mover's own ally; the `stall` family, which this pass **refutes** as
downstream of F1 - 13 leaves in 13 games before and after, not one moved).

**5.216.0 - THE THIRD PLACE THIS SIMULATOR ASSERTED THAT THE NEAR SIDE OF THE FIELD COULD NOT
MATTER, AND THE ASSERTION WAS WRITTEN OUT IN WORDS ABOVE THE BRANCH.** Safeguard's refusal was gated
on the source standing opposite; the authority gates on the source not being the target itself. Both
of its handlers - the status road and the confusion road - go through one reader here, so a single
deletion corrected both plus the suppression of the redundant failure line. **Census 792 to 794.**
**Board-parted unmoved at 97 of 961 and every block of the artifact identical string-for-string**,
predicted before the run: Safeguard is **22 corpus uses** and appears in **17 of 13,214** frozen-pool
games. The class was then DERIVED rather than read around, and both previous enumerations were widened
first - the side-condition frame from 11 to **13** (slot conditions) and from `onTryHit` to *any
handler receiving a source*, the field-wide frame from abilities to **items and move conditions**.
**Zero further instances.** Nothing left behind would catch a fourth spelled differently, and that is
stated rather than glossed: a gate for the class needs an artifact naming which authority handler each
consumer implements, and no such artifact exists.

**5.215.0 — EIGHT GUARD MOVES WERE SCORED RESOLVED ON A TURN WHERE NOTHING ATTACKED THEM, AND TWO OF
THE ELEVEN ROWS THE AUDIT NAMED WERE NOT ACTUALLY IN THAT CASE.** The roster's move arm credited a
click that printed a line; a guard prints one when it goes up. Focus Punch and Beak Blast were named
in the same list and do not belong there — both are attacking moves and resolved on damage. The
systemic half stands for all eleven: the roster covered the state's CREATION and not its FUNCTION.
A derived effect check now asks the second question. Over the 500 legal moves it matches **11**, of
which **7** demonstrate the refusal on both engines and **4** state why they cannot; **76** further
rows write a state that prints nothing when it fires and belong to a counter comparison. **Zero rows
changed verdict** against the previous artifact, and **no engine defect was found** — three of the
first run's seven reds were the instrument, whose anchor asked for the move's own name where the
authority prints `move: Protect` for the whole family. `engine/coverage.js` gains
**uncomparable leaves w/ a firing writer — 23 of 24**.

**5.214.0 — PARTING SHOT WALKED PAST A FOLLOW ME, AND THE REASON WAS A LABEL RATHER THAN A RULE.**
The engine already redirected damaging moves and already redirected status moves; it refused Parting
Shot alone, because a move that switches its user out carries the same internal action label as an
ordinary switch. On identical pins the empirical driver arm goes from **114 games whose board
diverged to 106 of 961**, and the mechanics census goes from **786 to 788 live probes with 0
missing**. Both scoreboards were predicted to move before the run and both did. Two further cards in
the same group — an ally's draw ability, and Wide Guard against an ally's own spread move — were
reproduced under controls, are DIFFERENT defects, and are filed rather than fixed.

**5.213.0 — A MEGA EVOLUTION WAS PRICED OFF THE BODY THAT LEFT THE FIELD.** Four moves in
this format scale on weight, and the simulator held weight as a value stamped when the body was built
— so when a Pokemon mega-evolved, its weight did not change, and the authority's does.
Fixed where the authority writes it: at every door that changes a body's species. On identical pins
the empirical driver arm goes from **117 games whose board diverged to 114 of 961**, and the
mechanics census goes from **784 to 786 live probes with 0 missing**. Both scoreboards were predicted to
move before the run and both did. The five Moonblast cards filed in the same group are a DIFFERENT
cause and are untouched.

**5.212.0 — THE FORCED-SWITCH MIRROR WAS THE HARNESS, AND THE EMPIRICAL ARM'S DENOMINATOR MOVED.**
`M.battleTurn()` plays a whole turn atomically while Showdown stops dead at a pivot and asks who comes
in, so on any turn where one slot took TWO bodies the harness answered the FIRST request with the
SECOND body — and then stopped the game claiming the boards had parted, on boards that agreed. The
mirror now answers from medicham2's ORDERED occupancy of the slot, observed as the turn is played. No
engine byte moved; medicham2's pivot was never wrong. On identical pins the empirical arm goes from
**47.8% completion and 135 games whose board diverged** to **48.4% and 117**, with mirror truncations
42 → 27. The 27 that remain are 19 genuinely parted boards and 6 downstream of other named engine
defects. Census unmoved at 784 / 784 / 0, predicted, because this is the harness and not a mechanic.

**5.211.0 — THREE SCOPE LINES ADDED TO `engine/coverage.js`.** Nothing measured moved. Three
verdicts are now printed with their limits: the whole-game differential's stat spreads are ASSIGNED
by the driver from a slot index (66 points, 32 cap, no HP) and are therefore not metagame damage;
the board-leaf denominator is the CEILING **56** and not the 80-leaf population, because 24 leaves
cannot be standing at the turn boundary the comparator reads; and a whole-game figure names its
DRIVER, since the coverage-seeking arm reaches a result in 1.8% of games (0 diverging boards) where
the empirical arm reaches 47.8% (135) on identical pins. All three are derived at run time.
*(The empirical arm's two figures are 48.4% and 117 as of 5.212.0 — see above. The 47.8% / 135 pair is
left as it was written, because it is what that release measured.)*

**5.210.0 — THE PORY TWO-FEATURE PAIR IS WITHDRAWN: ITS GENERATOR WRITES NO ARTIFACT.**
`engine/pory_baseline.py` prints a five-arm table and saves nothing, so the material-baseline
pair it published on 2026-07-25 never had a source to check it against, and it was scored
before that script had a clean-data filter at all. On the clean corpus the comparison is a
TIE rather than a loss, measured PAIRED and clustered by game in `data/pory-eval.json`. The
withdrawn pair stays in `docs/REVIEW-2026-07-25.md`, the review that measured it. The PORY row quoted the pair and no longer does.

**5.209.0 — FLASH FIRE'S ABSORBED GIFT IS GRANTED AND PAID, AND THE BOARD COMPARATOR READS ONE MORE
LEAF. GATE 8 OF 8 PASS, OPEN.** The 5.208.0 block below is retained as dated history; its counts were
measured on engine release `4e5c7b3400de` and are SUPERSEDED by this one. An engine byte moved, so
these are new measurements on release `e129bca605e3`.

| question | artifact | answer |
|---|---|---|
| every mechanic staged and live | `data/mechanics-census.json` | **784 probed, 784 live, 0 missing** (the 782 of 5.208.0 is superseded) |
| how much of the board is compared | `tests/probe_uncompared_leaves.js` | **34 of 80 leaves** (33 → 34), 4 declared uncomparable, 42 read by nothing |
| the three roster stages | `data/roster.{items,abilities,moves}.json` | **140 / 129 / 475 tested**, 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three |
| whole-game differential | `data/game-differential.json` | **961 paired games, 6 raw, 6 declared, 0 undeclared**; 12,445 turn boundaries compared, 12,445 identical — **PRIOR reading, superseded at 5.243.0**: it was taken on the census-coverage arm, where the games mostly do not end, and the artifact has since been republished from the empirical arm |
| damage differential | `data/engine-diff.json` | **0 of 6000** at each of the sixteen band indices |
| the gate | `engine/quarantine.js` | **8 of 8 PASS, OPEN** |

Which scoreboard was stated before the runs: the lab moves, the pool does not. Both held. Flash Fire
is 1,177 of 17,381 pool games by sheet presence but 365 of 8,778 deduped teams, and the absorb never
happened in any of the 961 games; `choicelock` WAS reached and agreed everywhere.

**Version 5.208.0 · 2026-08-28 · Will Hooper**

**5.208.0 — THE METRONOME ITEM IS WIRED AND ALL FIVE GATE CLAUSES ARE RE-RUN ON THE RELEASE THAT
WIRING PRODUCED. GATE 8 OF 8 PASS, OPEN.** The 5.207.0 block below is retained as dated history; its
counts were measured on engine release `5f3f7141227c` and are SUPERSEDED by this one. **An engine byte
did move this time** — WIRE 158 gave `damageMultOnRepeat` its first consumer — so these are new
measurements and not a restatement.

| question | artifact | answer |
|---|---|---|
| the three roster stages | `data/roster.items.json`, `data/roster.abilities.json`, `data/roster.moves.json` | **140 / 129 / 475 tested**, 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three; red demonstrations 18 / 29 / 35, all caught |
| what moved in that triple | the items stage only | `item:metronome` went `DEFERRED-BY-OWNER` → `FIRED-AND-BOARDS-MATCH`, taking that column 1 → **0** |
| the same game on both engines | `data/game-differential.json` | **961 paired games, 6 raw divergences, 6 declared, 0 undeclared**; 12,445 turn boundaries compared, 12,445 identical — **PRIOR reading, superseded at 5.243.0**: it was taken on the census-coverage arm, where the games mostly do not end, and the artifact has since been republished from the empirical arm |
| is that the same sample as before | the same artifact | **yes, proven not assumed** — same 643-row census pin, same frozen pool (**1,968 of 8,778** teams), same six first divergences in the same order |
| every mechanic staged and live | `data/mechanics-census.json` | **782 probed, 782 live, 0 missing**; 782 armed, 0 unarmed, 0 threw, 0 hollow — PRIOR reading, superseded at 5.209.0 by 784 / 784 / 0 |
| staged mechanics, each one compared | `data/all-mechanics-fire.json` | **1,289 games, 0 threw**; items `shelved_by_owner` 1 → **0**, owner closet 7 → 6 ids — **PRIOR reading, superseded**: the artifact has since been regenerated at release `8ad06030e129`, so read the current count out of the file rather than from this row |
| damage against the authority | `data/engine-diff.json` | **6000 compared, 0 disagreed**, and 0 at each of the sixteen band indices separately — not re-run this pass, nothing that feeds it changed |

**WHAT THE OPEN GATE IS NOT.** 72 of 250 artifacts moved from WITHHELD to RE-RUNNABLE — the count is
`engine/quarantine.js`'s own print, recorded in `docs/_reports/2026-08-28-gate-rerun.md` — and **not one
was re-run**. RE-RUNNABLE is not true; it is permission to measure. ROADMAP #57 is the list, ROADMAP
#440 stays open and still says `DEFECT`, and the seven MEASURE/SEARCH figures that used to read
QUARANTINED now read WITHHELD on `engine/provenance.js` calling their artifact UNSAFE — a different
and weaker withholding, and still a withholding.

**ONE STALE STAMP, REPORTED RATHER THAN TIDIED.** `data/quarantine-stamp.json` is stamped 15:33 and
says `gate_open` false; the five re-runs finished after 20:25, and the gate reading above is the run
of `engine/quarantine.js` recorded in `docs/_reports/2026-08-28-gate-rerun.md`, corroborated by
`engine/status.js` printing no quarantine banner (it prints one only when the gate is shut).

**5.207.0 — THE LAST OPEN GATE CLAUSE IS CLOSED BY A DECLARATION AND NOT BY A FIX. GATE
8 OF 8 PASS, OPEN.** The 5.206.0 block below is retained as dated history; its "GATE 7 OF 8" reading is
SUPERSEDED by this one. **No engine byte moved in this pass and no artifact was regenerated** — the
before and after runs read the same `data/game-differential.json` and differ only in whether the
declaration exists.

| question | artifact | answer |
|---|---|---|
| the same game on both engines | `data/game-differential.json` | **6 raw divergences of 961 games, 6 declared, 0 undeclared** |
| — of which the authority's own typo | `fallenundefined`, AUTHORITY-WRONG | 5 |
| — of which closeted by the owner | the perish drain's position, CLOSETED | **1** |
| did any board differ | `state` in the same artifact | **no — 12,445 turn boundaries compared, 12,445 identical; 961 of 961 games never board-diverged** |
| is the deciding leaf actually compared | `engine/board_state.js:866 / :1034 / :769 / :843` | **yes — `fainted`, `hp`, `maxhp`, `status`**, so this is not one of ROADMAP #528's 43 unread leaves |
| is the defect fixed | ROADMAP #440 | **no. It stays open and still says `DEFECT`** |

**WHAT THE CLOSET COSTS TO OPEN.** A `CLOSETED` row must name the owner, the date, the ruling in his
own words, the register row that carries the account, the instrument that measured the no-board-effect
claim, the frozen release it was measured on, what it reported, and the observation that would prove
the entry wrong. `closetFault` refuses the row at the door if any of those is missing, and eleven
selftest arms prove each missing field holds the gate shut. **A phrase anybody can type is not a
ruling.**

**AND THE GATE OPENING IS NOT A RESULT.** 61 downstream artifacts stop being WITHHELD and start
printing as RE-RUNNABLE. They are not current, and none was re-run here (ROADMAP #57).

**5.206.0 — THE FIVE BLANK CLAUSES WERE A LINE ENDING, THEY PRINT AGAIN, AND EVERY ONE OF THEM
REPRODUCED ITS PREVIOUS NUMBER EXACTLY. GATE 7 OF 8 PASS.** The 5.205.0 block below is retained as
dated history and its "WHAT IS QUOTABLE TODAY" table is SUPERSEDED by this one; the five WITHHELD
rows in it are withheld no longer.

| question | artifact | answer |
|---|---|---|
| every mechanic staged and live | `data/mechanics-census.json` | **780 probed, 780 live, 0 missing** — PRIOR reading, superseded at 5.208.0 by 782 / 782 / 0 |
| damage against the authority | `data/engine-diff.json` | **6000 compared, 0 disagreed**, and 0 at each of the sixteen band indices separately |
| is the gate open | `data/quarantine-stamp.json` | **no** — `gate_open` false, **one** clause failing |
| the three roster stages | `data/roster.{items,abilities,moves}.json` | **139 / 129 / 475 tested, 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three**; red demonstrations 18 / 29 / 35 |
| whole-game differential | `data/game-differential.json` | **1 of 961** (6 raw, less 5 declared); **board-material 0 of 961** |
| staged-mechanics comparison | `data/all-mechanics-fire.json` | 5 diverge, 1 declared, 4 below the reach shelf — **0 counted** |

**THE CAUSE WAS NOT AN ENGINE CHANGE AND THE REMEDY WAS NOT A HAND EDIT.** `core.autocrlf = true`
rewrites any file git considers text to CRLF on checkout, so a frozen source whose generator writes LF
has two byte-forms and the release id follows whichever wrote it last. The file that moved was the tag
artifact written by `engine/tag_dex.js`.

Measured here: its committed blob is **byte-identical** to release `5f3f7141227c`'s own snapshot —
both hash to `576a4bbe91af` — and the working copy was that same blob after translation, hashing to
`a32ee545cf67`. Restoring it is therefore git handing back what the generator wrote, not somebody
editing an input until a ruler agreed. The tree re-cuts to `5f3f7141227c`, the id those five artifacts
already stamp. The byte and carriage-return counts are recorded in
`docs/_reports/2026-08-28-crlf-recurrence.md`.

**IT IS FIXED AT THE SOURCE, AND THE FIX WAS SHOWN RED FIRST.** `.gitattributes` now pins seventeen of
the twenty-six frozen sources with `text eol=lf`. Before the entry, writing the committed blob and then
`git checkout HEAD -- data/tags.json` took the digest `576a4bbe91af -> a32ee545cf67` with nothing
edited; after it, the same sequence returns `576a4bbe91af`. Removing the one line again fails
`tests/test-engine-release.js` by name. **Nine sources are deliberately not pinned** — they are CRLF in
the working tree today, and flattening them would rewrite every release id and break `tests/roster.js`,
whose red demonstrations match `\r\n` against the simulator's source. That is filed, not done.

**NOTHING MOVED, WHICH IS THE RESULT.** The three roster stages, the staged-mechanics comparison and the
whole-game differential were all re-run against release `5f3f7141227c`, census pin `9446a684709d`, arm
`middle`, cap 12, `--games 1200` (yields 961), `--team-store data/team-pool-frozen`, `--state
--end-state`. `data/all-mechanics-fire.json` differs from its predecessor in three wall-clock
`seconds` fields and one timestamp; `data/game-differential.json` differs in one field, the count of
recorded cuts of the same release. `data/provenance-stamp.json` recovered from 1 content-verified
artifact to 3 with `mtime_only` unchanged at 175 — the same event, the same way back.


**5.205.0 — THE MEDICHAM SPRINT IS PAUSED, THE DOCUMENTS ARE UNFROZEN, AND FIVE OF THE EIGHT GATE
CLAUSES ARE BLANK RATHER THAN GREEN.** The living-docs rule was deferred by the owner on 2026-08-10
for the duration of the simulator-correctness sprint; each fix wrote one row to a running log instead.
Will paused the sprint on 2026-08-28 and this pass discharges the debt: the log held 274 rows, the
changelog carries 233 releases from the same stretch, and `docs/_reports/` carries 189 dated accounts.
The log is deleted, which is what re-arms the full rule.

**THE THROUGH-LINE: THE INSTRUMENT WAS THE DEFECT AT LEAST SIX TIMES, AND THE LARGEST FIX OF THE
SPRINT RAISED THE DEFECT COUNT.** Of thirty accusations against the engine on one night, twenty-three
were a miswritten demonstration, seven were a wrong rule, and exactly one was the engine. Eighteen
expired "shown red" certificates were being published as a broken simulator. The roster's red
demonstrations had never been written into its artifact, so a gate clause that reads them had nothing
to fail on. **Suspect the instrument before the engine** was earned here rather than assumed.

**THE EVENT DIE WAS THE BIG ONE, AND IT IS WHY EVERY EARLIER FIGURE IS VOID RATHER THAN STALE.**
`midEventHash`/`midHash` ended on a bare FNV-1a round with no finalising mix, and the last field of
every draw address is the arrival index — so a one-digit index change translated the hash instead of
re-drawing it. Consecutive arrivals shared a 16-bucket damage index 89.5% of the time against a
correct 6.25%; lag-1 autocorrelation down that axis was 0.8873 against ~0. **The marginal hit rate was
0.9214 against a target of 0.9 — always fine, and the only thing anything was watching.** The two
engines had been agreeing over a narrow slice of outcome space. Fixing it moved the whole-game
differential from 3 to 14 games and board-material from 1 to 12: an instrument repaired, not a
regression. Every figure in this document measured before 2026-08-27 that passed through that die is
retained as dated history and **may not be cited as current.**

**WHAT IS QUOTABLE TODAY**

| question | artifact | answer |
|---|---|---|
| every mechanic staged and live | `data/mechanics-census.json` | **780 probed, 780 live, 0 missing**; 780 armed, 0 unarmed — PRIOR reading, superseded at 5.208.0 by 782 / 782 / 0 |
| damage against the authority | `data/engine-diff.json` | **6000 compared, 6000 agreed, 0 disagreed**, and 0 at each of the sixteen band indices separately |
| is the gate open | `data/quarantine-stamp.json` | **no** — `gate_open` false, five clauses failing |
| the three roster stages | — | **WITHHELD** |
| whole-game differential | — | **WITHHELD** |
| staged-mechanics comparison | — | **WITHHELD** |

**THE THREE THINGS THAT TABLE MUST NOT BE READ AS SAYING.**

1. **The damage result is narrow.** Its own `scope` field says damage only — no items, no abilities,
   no turn order, no status duration, no switching. It records `skipped_multihit` 134 and
   `skipped_ability_multihit` 17, because the harness calls the authority's single-hit entry point and
   not the volley loop. **It has never applied a multi-hit move**, and the four multi-hit defects
   fixed this month were invisible to it by construction.
2. **The census is a laboratory, not the metagame.** One staged scenario per mechanic, regardless of
   usage. It answers *is this correct*; the pinned pool answers *does this matter*, and the pinned
   pool's scoreboard is one of the withheld ones.
3. **"The boards match" means 33 leaves of 80.** `tests/probe_uncompared_leaves.js` derives, over 500
   moves, 201 abilities and 148 items, every leaf a legal mechanic writes: **33 compared, 4 declared
   uncompared, 43 in neither list**, and 25 of those 43 can be standing on the board at the turn
   boundary. An unlisted omission reads exactly like agreement. This is the largest caveat in the
   document set.

**WHY FIVE CLAUSES ARE BLANK, AND WHY THAT IS NOT SOFTENED.** Each of the five artifacts was measured
against engine release `5f3f7141227c`; the tree now hashes to a different release, so those counts
describe a program that is not the one on disk. The cause is measured and is not an engine change:
exactly one of the twenty-six frozen sources moved, `data/tags.json`, whose release copy is
byte-identical to the tree after newline normalisation and deep-equal when parsed — a checkout under
`core.autocrlf = true` rewrote a generated LF file as CRLF. `docs/ENGINE.md` records the same event on
2026-08-26. **It still counts.** The numbers are withheld rather than printed with a caveat, because
this project has already paid for the caveat version, and the only remedy is a re-run.

**QUARANTINE HAS NOT LIFTED, AND BOTH HALVES OF THAT ARE TRUE.** The computed condition is not met, so
everything downstream of the simulator stays withheld. Will's narrower bar of 2026-08-22 —
board-material zero plus a clean roster, with narration as a separate gate afterwards — was met by the
last measurements before the stranding. **Nobody has re-cut the gate to test that narrower bar**, so
the gate still computes the wider condition and still reads shut. This document does not resolve the
two; it records both. And a withheld figure does not become true when the engine becomes correct — it
becomes **re-runnable**.


**3.98.0 — QUICK GUARD BLOCKED NOTHING, AND THE TWO GUARDS CARRY BYTE-IDENTICAL TAGS.** Staged on the
frozen release, a +1 priority attack: Armor Tail, Dazzling, Queenly Majesty and Psychic Terrain all
refused it; Wide Guard let it through (correct — it stops spread); Quick Guard let it through too, on 927
corpus clicks. `quickguard` and `wideguard` carry the same four tags, so three sites told them apart by
NAME — the classifier (Quick Guard resolved to the no-op `{kind:'pass'}`), the `buildMon` move filter, and
the field's boolean pair. The param that separates them, `oneTurnGuard.blocks`, was already in the
artifact and nothing read it, so `tag_dex.js` did not change and nothing was regenerated. Wired onto the
gate the ability sources already use, so a Prankster-boosted status move is refused too, and Feint still
breaks through. Census 354 → **357 live**; Wide Guard unchanged and green.

**3.97.0 — ONE ROLL MULTIPLIED BY N: FOUR MOVES, ONE ROOT CAUSE, TWO OF THEM 2x.** Triple Axel escalates
20/40/60 and we applied a flat 20 three times — exactly half the move. Dragon Darts splits across the
target and its partner and we put both darts in one body. Beat Up summed every ally's base power into a
single packet and lost three of the formula's four `+2`s. Fickle Beam's 30% double was a flat ×1.3, i.e.
104 base power, a value the move never takes — the 3.90.0 mean-versus-draw defect in a second code path.
Fixed with a per-hit damage loop; single-hit damage unchanged by construction and measured against the
frozen release across all 500 moves. Census 350 → 354 live, damage stages 1728/1728 exact.

**3.96.0 — ITEMS QUEUE 6 → 3, AND ALL THREE WERE NAME HARDCODES OR AN UNREADABLE AMOUNT.** Iron Ball
(139 uses) went untagged because `speedMult` matched on the NAME "choicescarf" — the consumer worked
and was starved. `statMult` hardcoded four items **all banned in this format**, had no consumer, and
`dmgRange` carried three matching permanently-false conditions; its only live member is Light Ball
(41). Oran Berry heals a flat 10 rather than a fraction, so its amount read null and the consumer
correctly refused. Census unmoved at 330 live; nothing else moved.

**3.95.0 — THE DAMAGE CALCULATOR NEVER KNEW ABOUT DISGUISE, AND THAT WAS A QUARTER OF THE GATE.**
One row out of 150: `chesnaught woodhammer -> mimikyu`, showdown `0-0`, ours `120-130`. The battle
loop was right all along; `dmgRange` — read by every board feature and rollout leaf — gave the same
answer with and without the ability. Two readers of one fact, the 3.87.0 defect again. Stated once now.
**Gate 3 failing clauses to 2**; differential clean at 0/150; census unmoved at 330 live; all four
clauses re-measured under one release.

**3.94.0 — THE USER'S OWN STAT DROP LIVES IN TWO SHOWDOWN FIELDS AND THE BUILDER READ ONE.**
`self.boosts` (Close Combat, Superpower, Draco Meteor, Overheat, Leaf Storm, Make It Rain) all read
MATCH, which is why this looked closed. `selfBoost` is a separate field and its two moves here —
Clanging Scales 810 uses, Scale Shot 199 — had no self-data at all: Showdown drove the user to −1 then
−2 Defence, ours stayed at 0. Roster moves **25 → 23** differ, exactly those two verdicts changed;
census unmoved at 330 live. Also recorded: a 22,277-use alarm about the `lowersUser` tag having no
consumer, raised and then **killed** — the engine implements it by another path, and six MATCH rows
are what proved it.

**3.93.0 — THE PARTIAL TRAP COUNTER WAS ONE LOW FROM THE TURN IT LANDED: SEVEN MOVES, ONE FACT.**
Bind, Fire Spin, Infestation, Sand Tomb, Snap Trap, Whirlpool and Wrap all read `showdown 4 / ours 3`
then `3 / 2` — identical, which is what identified it as one fact. `partialTrap: { turns: '4-5' }` was
typed by hand and is the felt duration; the compared quantity is Showdown's counter, which starts at 5
and ticks in the residual of the landing turn. The volatile-duration defect a third time, surviving the
previous two because this counter lives in `_trap` and not `_vol`. Now derived from Showdown's own
condition, failing closed. Roster moves **32 → 25** differ, exactly seven verdicts changed; census
unmoved at 330 live; **whole-game differential unmoved at 65/107 diverging on both releases.** Red shown
on the frozen pre-fix release (`3 · 2 · 1`) rather than asserted.

**3.92.0 — FIVE MORE SITES STAGED MOVES THIS FORMAT DOES NOT CONTAIN, AND TWO OF THEM MATTERED.**
The sweep after 3.91.0's `Tackle` finding: the `.item`/`.ability` surface across 238 files is clean,
move literals are not. Three were cosmetic. `test-priority-block.js` silenced three slots with Splash,
which has no row in the engine at all — the silencing worked by ACCIDENT. `test-dead-volatile.js`
guarded on `.exists`, which is true for a banned move, so the guard could never fire and the case
always ran on Thousand Arrows. Its subject is derived from the format now (Smack Down) rather than
tightened into a vacuous skip. All five green, no figure moved.

**3.91.0 — A PROBE COULD STAGE A BANNED MECHANIC AND BOTH ENGINES WOULD HAVE AGREED ABOUT IT.**
`new Battle()` validates nothing, so every hand-staged body in this repo was legal by luck rather than
by construction. `tests/probe_pair.js` now asks Showdown's `TeamValidator` first, through one shared
implementation in `engine/champions_sim.checkLegal`. Existence problems (the format does not contain
this) are always fatal; compatibility problems (this species cannot hold this) are legitimate in a
controlled isolation and must be declared in writing — the distinction matters because the named quiet
control ability is illegal on most species deliberately, and refusing it would have refused every
honest probe. The guard's first two catches were in the harness itself: `Tackle` does not exist in this
format and every inert slot carried it, and the padding species were named from memory and included
one that is not in the format. Instrument only — no engine behaviour changed, no artifact was
regenerated, every quarantined figure stays quarantined. `probe_pair` self-test 16 green,
`test-pinch-family` 65 green.

**3.90.0 — THE MULTI-HIT CLUSTER WAS A COUNT, NOT AN ARITHMETIC.** Eleven moves disagreed with the
official simulator by small amounts in BOTH directions, which is the signature of a wrong hit COUNT
rather than wrong per-hit maths. The engine answered 3.1 hits — the mean of the 2-5 distribution — to
every question, including questions asked by a turn that actually happened; the authority's own
`|-hitcount|` reports 5 or 2 under the two pinned corners and never a 3. The count is now drawn from
the authority's own twenty-element table, the per-hit accuracy is rolled and breaks at the first miss
instead of being discounted by a mean, and the reaction count reads the same draw the damage does.
Census 329 to 330 live, 0 missing; the roster's moves stage 40 to 32 disagreements, abilities and
items unmoved, the damage differential unmoved. Triple Axel, Scale Shot and Dragon Darts remain and
are three DIFFERENT mechanics, each filed on its own.

**3.89.0 — THE CONDITION 3.88.0 DERIVED IS NOW READ, AND A HEAL FAMILY THAT HEALED NOTHING WORKS.**
`buffsHolderOnHit` applied its boost on every connecting hit, so eleven of twelve members were wrong
every time: Anger Point maxed Attack off a non-critical hit and did the same on a critical one — an
unwired knob — Justified fired off Close Combat, Weak Armor off Dark Pulse. Stamina (2,773 of the
family's 2,972 uses) carries no condition, was right throughout, and is now the positive control on
both sides of the crit die. Synthesis, Moonlight, Morning Sun and Strength Sap — 1,024 uses — resolved
to a wasted turn healing 0.000 HP in every sky, and in sand were strictly worse than passing. Census
326 to 329 live, 0 missing; roster and differential unmoved.

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
The R1 gate published a PASS; recomputed from the only committed evidence it is **UNDECIDED**. Nothing
was falsified: the row dump recorded the answers and not the settings, so a run at exploration 0 and a
run at exploration 1 left byte-compatible files, and the two configurations do not give the same
answer.

Auditing the sibling gates against the same standard found two more.

| gate | published | what the evidence supports |
|---|---|---|
| R1 leaf accuracy | PASSED | **UNDECIDED** |
| R2 leaf cost | a median leaf time | reproduces only as arithmetic on itself, and it timed `explore=0` at a 20-turn horizon while the shipped leaf runs `explore=1.0` at 60 |
| R3 divergence | a divergence rate | recomputes exactly — from two fields in the same file. **Its control was printed and never stored**, and the gate's own verdict branches on that control |

**THE FIGURES IN THIS TABLE ARE WITHHELD, 2026-08-22, AND THE VERDICTS ARE NOT.** R1, R2 and R3 all
read artifacts downstream of MEDICHAM, and `node engine/status.js` names each of them QUARANTINED. A
caption is not a quarantine, so the rates, medians and intervals are cut rather than annotated; what
this table is actually about — that a gate which does not stamp its own configuration cannot be
audited — does not need them. They become re-runnable, not true, when the gate opens.

Every gate now writes a sidecar (`engine/run_stamp.js`) recording budget, exploration rate, horizon,
content digests of every source it reads, the commit, and whether the tree was dirty. Older artifacts
carry one reconstructed from the commit that contained them, labelled inferred rather than observed.

## The components at a glance

| Model | What it is | Status | Headline result |
|---|---|---|---|
| **MEDICHAM** | Hand-written doubles battle simulator. **Its justification is now falsifiable (ADR-003, 3.62.2): it exists so per-turn re-solving is affordable, so the engine work is justified if and only if search pays — gated by ROADMAP #62.** The speed ratio that originally justified it is corrected in the section above | **Correctness sprint PAUSED 2026-08-28 by the owner. The MEDICHAM gate reads CLOSED — 1 of 8 clauses fail (2026-09-03). The whole-game clause is genuinely red on the empirical arm; the earlier 8-of-8 PASS was measured on a coverage-driver population where the games do not end, and is retracted** | **EVERY COUNT IN THIS CELL WAS SUPERSEDED AND IS NOW CUT (2026-08-22).** It stated a mechanics census, an interaction-matrix agreement and coverage fraction, a damage-differential ratio, a scenario count, a win-probability gap against the official engine, a two-rulebook collision ratchet, a DEAD-tag ratchet and a mutation-tier count. Every one of those instruments has been re-run since the cell was written and every artifact now reads something else. This is a CURRENT-STATE table, so a figure in it that is a release old reads as a claim about tonight — which is the failure the whole document set exists to prevent. State is printed, not typed: run **`node engine/status.js`** for the gate, the census, the differentials and the withheld set, and **`node engine/quarantine.js`** for the full derivation. ADR-001 stands: MEDICHAM becomes a lookup over precomputed tables. The win-probability gap against the official Champions engine is additionally QUARANTINED — it is a rollout figure — so it is withheld rather than restated. |
| **GURU** | Meta matchup matrix from real outcomes | ⚠️ **No decisive cells that survive multiplicity** | `data/guru-matchups.json`, 2026-07-31, **5,265 clean games / 12 archetypes / 144 cells**. **6 directed = 3 distinct** matchups clear a 95% test one at a time, and **ZERO survive FDR at q=0.05 or Bonferroni** — 66 pairs, 3.3 expected by chance, 3 observed, smallest exact p 6.1e-3 against a BH threshold of 7.6e-4. Predictive test **0.7124** vs a coin 0.6931 over 1,053 held-out games — **worse than a coin**. Descriptive structure only. (This row read *1,124 clean games, 11 archetypes, 0.735* until 2026-08-04, from a superseded run; the verdict is unchanged.) |
| **XATU** | Opponent set + next-move belief | ✅ Built | Top-1 36% / top-3 72% on held-out human moves (beats its baselines) |
| **PORY** | Mid-game win-probability value net | ⚠️ **Contribution unclear** | Log-loss **0.6236** 95% CI [0.6070, 0.6387] vs coin 0.6931 and vs the material heuristic 0.6428 (regenerated 2026-08-05 on 5,883 clean games; the previously published 0.567 predated the current quality filter) — but its features ARE the material state, and against a logistic on `alive_diff + hp_diff` alone — same estimator, same standardisation, same split — it **ties**: 0.623623 to 0.623623, a paired difference of +0.000001 (positive = PORY worse), 95% CI [−0.000026, +0.000029] clustered by game over 1,177 held-out games, containing zero. **WITHDRAWN: this cell used to state that PORY LOSES to that baseline, on a two-number pair from `engine/pory_baseline.py`. That script prints its table and writes no artifact, so the pair never had a source; it scored every arm on the unfiltered raw archive, its clean-data filter having landed five days after publication; and on the clean corpus the result is the tie above, not a loss. The withdrawn pair stays in `docs/REVIEW-2026-07-25.md`, which measured it, and is not restated here.** Report the gain over MATERIAL, not over a coin. |
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

The one load-bearing win is the **validated damage engine** — **36 scenarios compared, 100% within 5%
of `@smogon/calc`, worst 0%** (`data/damage-validation.json`).

This line has now been corrected twice and both corrections are kept. It first read "31/31 within
2%", which overstated the single load-bearing result in both the count and the tolerance. It then
read "97% within 2%, median error 0%, worst 3%" against the 2026-08-05 artifact; the 2026-08-08
regeneration reports worst 0% and states no median or 2% band, so those three figures are cut rather
than carried. The artifact is the authority. PORY was the other load-bearing win, until 2026-07-25 showed it loses to a two-feature material baseline.
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
| engine release | A measurement reads the snapshot, not the live tree, so the divisions can run concurrently. The current release id and the set of frozen files are printed by `node engine/engine_release.js list` and declared as `SOURCES` in `engine/engine_release.js`. *(This cell named a release id and "12 files frozen" until 2026-08-22. Both had moved: the id is a digest of the frozen tree and changes whenever it does, and the file set has grown several times since.)* |
| provenance method | **content digests**, no longer mtime. The counts are read from `data/provenance-stamp.json` (`verified` and `mtime_only`) and printed on every run, ratcheted downward by a NAMED LIST rather than a count — the stamp's own note records why: the first time the ratchet fired it could only say "one more than last time" and nobody could tell which file. *(This cell read "0 verified by content, 92 by mtime alone" until 2026-08-22. Both had moved, in opposite directions, and neither was reread.)* |
| exploitability | **no figure.** 63.2% retracted on its own merits; the 2026-08-04 re-run is `void: true`. |
| mirror control | **49.7% [46.2, 53.2]**, n=782 — survives the void run and retires the seat-asymmetry worry. |
| MAG refit | ran; **moved nothing measurable.** Weather fix +0.048 top-1 [0.009, 0.093]; the refit itself −0.074 [−0.155, +0.004] against a 0.192-point noise floor. |
| open, needs a decision | the fit sees `{nature, item}`; the player sees `{nature, item, ability, moves}`. **50.47% of trained decisions**, 99.75% of games. |
| click censoring | **FIGURES WITHHELD — QUARANTINED, 2026-08-22.** `data/click-censoring-census.json` is downstream of MEDICHAM (`engine/click_census.js` reaches the simulator through `require`) and `node engine/status.js` names it withheld. This cell used to state the count of recorded actions that were never clicks, the redirected-attack share and the paired held-out effect; those are cut rather than captioned. The QUALITATIVE finding does not depend on them and stands: actions the game FORCED — Encore, `\|drag\|` — were being fitted as if a human had chosen them, and a redirected attack now enters the fit as a two-member candidate set instead of a certainty on the redirector. `data/click-censoring-census.json`, `data/censoring-value.json` |

