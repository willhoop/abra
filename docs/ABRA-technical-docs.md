# ABRA — Technical Documentation

**Version 5.261.0 · Last updated 2026-09-06**

**5.260.0 - FOUR ENGINE DEFECTS ARE CORRECTED. EACH ONE IS MEASURED ALONE.**

**PUBLICATION.** `data/game-differential.json` holds board-material 50 of 961 and protocol first-divergence 114 of 961. **CONDITIONS.** Release `a985300cb8ed`. 961 games. Cap 20. Arm `middle`. Steering `empirical`. End-state comparison on. Census pin `data/verification/census-pin-9446a684709d.json`. Pool `--team-store data/team-pool-frozen`.

**DEFECT 1.** The tag `setsOwnTypeAlways` is derived from a two-statement handler. The engine read one statement. **ACTION.** Derive the `announce` record with the existing `announceIn` reader. Emit the line above the move line. **RESULT.** Protocol 151 to 137.

**DEFECT 2.** A move's own `onTryHit` runs inside `spreadMoveHit`, below every hit step. The engine emitted the item announcement beside `onTry`, above every hit step. **ACTION.** Move the emission into a step in the step list. **RESULT.** Protocol 137 to 130.

**DEFECT 3.** The condition `mustrecharge` declares `onBeforeMovePriority: 11`. That is the highest value in this format. The engine asked it last. **CONSEQUENCE.** A sleeping body that owed a recharge spent a sleep tick that the authority does not spend. This is a board leaf. **ACTION.** Hoist the refusal to the top of the BeforeMove block. Keep one implementation. **RESULT.** Protocol 130 to 130. The pinned pool did not move. This was predicted before the run.

**DEFECT 4.** `useMoveInner` writes `-fail` when a non-field move has no legal target. The engine wrote nothing. **SIZE.** 32 of 130 first-divergence rows carried a bare `-fail`. **ACTION.** Emit the line. Exclude the four field target classes, which the authority routes past the `-fail`. **RESULT.** Protocol 130 to 114.

**METHOD.** Each fix runs on its own frozen release. Each fix has a probe that is red before the fix and green after it. Each fix has a knob that restores the defect and moves no byte of any control. Each step has a prediction written to disk before the run. **PREDICTION RESULT.** Four board-material calls, four hits. Four protocol calls, one hit and three misses of one, one and two games.

**INSTRUMENT NOTE.** Four times a new probe reported a divergence that `engine/game_differential.js` does not count. The cause was the probe, not the engine. The four declared equivalences are now applied inside the probes: `|split|` line selection, move-line truncation, `[of]` and `[silent]` removal, and `-ability` line removal.

**RE-RUN.** Damage differential 0 of 6000 at the midpoint and at all sixteen roll indices. Roster items 140, abilities 129, moves 475, with zero FIRED-AND-BOARDS-DIFFER and zero DID-NOT-FIRE on all three stages. Mechanics census 829 live, 829 probed, 0 missing.

**5.259.0 - TWO CITED FIGURES ARE CORRECTED.** **RULE.** A figure must be present in the artifact it cites. **DEFECT 1.** The white paper and the summary attributed a length ratio and a kept/dropped pair to `data/quality-filter.json`. That file does not contain those values, and no version of it contains a mean-turn field. **ACTION.** Use the funnel step the artifact records, `provenance.funnel.after_min_turns` to `provenance.funnel.after_full_bring`. Withdraw the ratio. **DEFECT 2.** `docs/WEB.md` published a leaf calibration figure from a quarantined artifact, and a head-to-head share with no citation. **ACTION.** Withhold both figures. Give the condition and the command that make each quotable again.

**5.258.0 - THE PUBLISHED WHOLE-GAME FIGURE IS RE-MEASURED AND REPUBLISHED.** **PUBLICATION.** `data/game-differential.json` is republished off a settled tree. It holds board-material 50 of 961 and protocol first-divergence 151 of 961. **CONDITIONS.** Release `db248fe67a5e`. 961 games. Cap 20. Arm `middle`. Steering `empirical`. End-state comparison on. Census pin `data/verification/census-pin-9446a684709d.json`. Pool `--team-store data/team-pool-frozen`. **PRIOR STATE.** The file held 46, measured on a superseded release, for 1.3 days. Both whole-game clauses failed on withheld staleness. **CURRENT STATE.** Both clauses fail on the measured counts. **DETAIL.** 911 games never part a board. 4 of the 50 part a board with no protocol divergence in the game. 10376 of 10539 compared turn boundaries are identical. **PROOF OF PUBLICATION.** The settled-tree run reproduces the last fix step byte for byte on `classes`, `first_divergences`, `state.first_board_divergences` and the by-cause summary.

**5.258.0 - FIVE ITEMS LANDED. EACH ONE IS MEASURED ALONE.** **RULE.** The pins are identical on every run, so each delta is attributable. **SEQUENCE.** Board-material 59 to 58 on Big Root, 58 to 56 on Leech Seed, 56 to 56 on the staged-pin repair, 56 to 51 on Fairy Aura, 51 to 50 on Beat Up. Protocol 161 to 160, 160 to 158, 158 to 158, 158 to 153, 153 to 151. **METHOD.** Each step runs on its own frozen release. Each fix has a probe that is shown red before the fix and green after it. Each fix has a knob that restores the defect and moves no byte of either control. Each step has a prediction that is written to disk before the run.

**5.258.0 - BIG ROOT DECLARES FIVE HEAL SOURCES. THIS ENGINE READ ONE.** **AUTHORITY.** The item lists `drain`, `leechseed`, `ingrain`, `aquaring` and `strengthsap`. Champions overrides neither the item nor any of the five handlers. **DEFECT.** `healMultBySource` had two readers. Both are on the drain road. Both filter `from.includes('drain')`. The other four sources had no reader. **SECOND DEFECT.** `Battle#heal` truncates the base value before it runs `TryHeal`. A 155 HP Ingrain gives `trunc(155/16) = 9` and then `modify(9, 5324, 4096) = 12`. A multiplier folded into the fraction gives 12 by luck. A truncation after a float multiply gives 11. **EVIDENCE.** An `[from] Ingrain` line pays 71 of 155 in the authority and 68 in this engine. The case comes from the pinned pool, not from the lab. **RESULT.** Board-material 59 to 58. Protocol 161 to 160. The class `-heal field 3` moves 1 to 0. No other class moves. **PROBE.** `tests/probe_bigroot_family.js`. Knob `MEDI_BIGROOT_DRAIN_ONLY`.

**5.258.0 - A LEECH SEED CHIPPED A BODY AFTER ITS SOWER DIED.** **AUTHORITY.** `leechseed.condition.onResidual` finds the sower by slot. It returns before it damages anything if the slot is empty or if the body in it has fainted. **DEFECT.** This engine applied that lookup to the heal only. A seed whose sower had died continued to take `maxhp/8` a turn from the seeded body. **CLASS.** This is a board leaf. It is not a message. **NARRATION DEFECTS.** The victim's chip carried no `[of]` field. The authority always has a source after the guard. The sower's heal carried a `[from]` field and an `[of]` field. The authority routes that line past the branch that adds them. **RESULT.** Board-material 58 to 56. Protocol 160 to 158. **PROBE.** `tests/probe_leechseed_silent.js`, four arms, three red and one control. Knobs `MEDI_LEECHSEED_CHIP_WITHOUT_SEEDER` and `MEDI_LEECHSEED_HEAL_ATTRIBUTED`.

**5.258.0 - THE STAGED PINS WERE BOUND TO THE WRONG ARM. ROADMAP #545.** **DEFECT.** `engine/game_differential.js` read `const PRIMARY_ARM = ARMS[0]`. Three module-scope staged pins were bound to it. **CAUSE.** `ARMS[0]` stopped being the max-damage arm on 2026-08-13, at commit `cf7a2c5a`, when the opt-in `middle` arm was prepended. That arm is not part of the default set and its dice are live. **EFFECT.** All four failures of `tests/test-game-differential.js` come from this one line. **REPAIR.** The three pins are bound by name through `ARM_BY_ID.get('top-tie-first')`. A throw sits beside them, so a rename cannot repeat the defect silently. **NOT CHANGED.** `PRIMARY_ARM` is unchanged. It is the arm the run plays. **THE ENGINE IS NOT IMPLICATED.** A 14-call control holds this engine's damage interior constant at `108..127`. The authority's interior wanders and loses its own minimum on one run. After the repair the authority's span falls onto this engine's span: knock-off `108..177` to `108..127`, contact punish `66..104` to `66..78`. This engine's values do not move in either scenario. **DURATION.** Both clauses passed by luck for fourteen days. A hash change on 2026-08-27 made the drift visible. **COMPARABILITY.** The repair moves `driver_code` from `e87506b2d737` to `0c1fc935a5fb` over 11 files. The measurement was repeated paired on the same release, census pin and pool. Board-material 56 to 56. Protocol 158 to 158. Every class, every first divergence and every end state is identical.

**5.258.0 - FAIRY AURA WAS PRICED FROM A STALE FIELD. ROADMAP #542 (a).** **DEFECT.** `field.aura` had two writers. The identically-shaped `recomputeWeatherSuppression` has four. A holder that left the field, returned to it or was killed continued to price Fairy moves. **REPAIR.** One writer, `refreshAura`. It is called from the entry pass and from the mid-turn faint site, and the two pre-existing write sites now call it. **SCOPE CORRECTION.** `onAnyBasePower` fires for any Fairy move by any user with `target !== source`. The divergence cause string names the victim, not the mechanic. **RESULT.** Five board-material causes closed. Nothing new appeared. Board-material 56 to 51. Protocol 158 to 153. **PROBE.** `tests/probe_fairy_aura.js`. Knob `MEDI_AURA_STALE`. The knob reproduces every red reading and moves no byte of either control. **REGISTER.** #542 stays open for clause (d) alone.

**5.258.0 - BEAT UP IS AN ALLY ORDER. IT IS NOT A HIT COUNT. ROADMAP #544, CLOSED.** **OBSERVATION.** Both engines print four hits. **CAUSE.** `sim/battle-actions.ts` swaps positions inside `side.pokemon` on every entrance. `beatUpAllies` walked `sf.team`, which nothing permutes. **EVIDENCE.** The authority gives `[25,22,21,16]`. This engine gave `[25,16,21,22]`. The multiset is the same and the order is wrong. This engine's switch-arm output was byte-identical to the authority's no-switch output. **REPAIR.** `bringIn` performs the authority's swap. **RESULT.** Board-material 51 to 50. Protocol 153 to 151. **PROBE.** `tests/probe_beatup_ally_order.js`. Knob `MEDI_BEATUP_BUILD_ORDER`. **SIDE EFFECT CHECKED.** The one reader that a permuted party could disturb was asked. `tests/test-end-state.js` PART 3 is green. The plant is still caught and still localised.

**5.258.0 - CORRECTION. THE PROTECT AMPLIFICATION WAS MEASURED AGAINST THE WRONG DENOMINATOR.** **PRIOR FIGURE.** 1.53 times the driver's own input, attributed to renormalisation. **STATUS.** Half of that attribution is confirmed. The other half is a denominator error. **DECOMPOSITION.** All steps are computed on the same 17,532 decisions. Declared input 13.565%. The same table's marginal, weighted by the decisions this arm took, 16.209%, a factor of 1.195. Renormalised over the legal candidate set, 20.257%, a factor of 1.250. Realised by the sampler, 20.374%, a factor of 1.006. Total 1.502. **CAUSE OF THE FIRST FACTOR.** The arm plays a census-steered pool. Its bodies carry the protect family at a higher marginal rate than the ladder's own click distribution. **RULE.** 13.565% is the wrong denominator for this run. The pool-matched denominator is 16.209%. Against it the arm reads 1.257. **REPORTING RULE.** A statement of the form "the arm reads X% against 13.565%" must carry the pool-matched marginal beside it. A change of census pin moves that denominator.

**5.258.0 - CORRECTION. LEGALITY SUBSETTING IS NOT A CAUSE, AND ITS SIGN IS INVERTED.** **PRIOR CLAIM.** Candidate sets averaging about 3.14 of four moves contribute to the residual. **MEASUREMENT.** The mean candidate set on this run is 3.772 of four. 87.0% of decisions, 15,253 of them, have all four moves. Those decisions read 21.724%. A decision with one legal candidate reads 8.134%. **CAUSE.** A body narrowed to one move is usually narrowed to its attacking move, not to its Protect. **STATUS.** The prior claim is withdrawn. Legality subsetting is a small negative contribution. **THE RULE THAT SURVIVES, SIZED.** On 185,422 scored human clicks the marginal reads 14.233%, the driver's rule reads 16.228%, and humans clicked 14.757%. **HELD OUT.** Split-half on games, 92,949 and 92,473 clicks, fitted on one half and evaluated on the other. The half-vs-half spread of the observed rate is 0.002 points. The rule over-predicts by +1.644 and +1.646 points. A carriage correction removes about 72% of that. **STATUS.** Named. Not repaired in this version. **REASON.** A repair changes the driver's declared input. Five engine fixes in the same pass would then not be attributable.

**5.258.0 - TWO PREDICTIONS MISSED. BOTH MISSES ARE THE SAME ERROR.** **MISS 1.** The Leech Seed step called 58 and 157. It read 56 and 158. **CAUSE.** The prediction reasoned from `state.first_board_divergences`. That list is capped at 40 rows and is a sample, not the population. The sowerless chip was outside the sample. **MISS 2.** The Fairy Aura step called 54 and 156. It read 51 and 153. **CAUSE.** The prediction credited only the causes that name a Floette-Mega as the damage target. **HITS.** The Big Root and Beat Up steps landed at their point estimates. The staged-pin step predicted no movement and no published count moved.

**5.258.0 - THE GATE STATE, AND WHAT IS NOT CLAIMED.** **GATE.** `node engine/status.js` reads 7 of 9 clauses passing. The two failures are the whole-game BOARD-MATERIAL clause, which gates, and the whole-game NARRATION clause, which reports. **CLAUSES RE-RUN AND UNCHANGED.** Damage differential 0 of 6000 at the midpoint and at all sixteen corners, seed 20260804. Roster items 140 of 148, abilities 129 of 202, moves 475 of 500, with `FIRED-AND-BOARDS-DIFFER` and `DID-NOT-FIRE` at zero on all three. `all_mechanics_fire --kind all` 1313 games played and 0 threw. Census 829 live, 829 probed, 0 missing. **QUARANTINE.** No quarantined figure becomes quotable. **REFIT.** The MAG refit stays owed. It is a refit and not a restamp. `data/policy-weights.json` is not touched. The damage table under the fitted vector moved from 318 species to 322. **OWED, NOT FIXED.** Struggle's `-activate` line, 17 games, pending a `tags.json` regeneration. Poltergeist announces at use time where the authority announces inside `onTryHit`, 7 games. `mustrecharge` carries priority 11 and outranks sleep and freeze. **NARRATION GAPS MEASURED AND NOT FIXED.** No Fairy Aura ability line on the carrier's entry or mega. No Unnerve ability line on a switch-in. **FILED AS INSTRUMENT.** About 6 Poison Touch, Cursed Body and Flame Body games draw in the `any` bucket that `midGameVoid` declares unreadable. 5 `stall` games carry a board divergence with no protocol divergence, which `--dump-games` cannot show. **REPORTS.** `docs/_reports/2026-09-06-apply-three-fixes.md`, `docs/_reports/2026-09-05-longtail-batch-A.md`, `docs/_reports/2026-09-05-red-endpoints-and-protect-prior.md`, `docs/_reports/2026-09-06-publish-pass.md`.

**5.257.0 - THE DRIVER WAS HANDED ONE OPTION.** **DEFECT.** The `prefer` axis of `engine/game_differential.js` was a hard narrowing. It applied at each decision in two swarm configs of nine. The preferred set of those two configs contains the protect family. **MEASUREMENT.** 22.2% of decisions arrived at the sampler with one candidate. 60% of those candidates were Protect. **CONTROL.** On decisions where the body kept all four moves, the arm gave 15.3%. That is the human rate. **CONCLUSION.** The policy did not over-weight the move. The candidate set was reduced before the policy saw it. **REPAIR.** The axis does not narrow the draw under the empirical and joint arms. The coverage arm is unchanged. `MEDI_PREFER_HARD=1` restores the defect for a control run.

**5.257.0 - THE PAIRED RESULT, WITH THE ARM NAMED.** **CONDITIONS.** 961 games for each leg. Release `688e696f00c8`. Empirical arm. The driver rule is the only difference. **RATES.** Protect share of clicks 32.77% to 20.79%, against an input table of 13.565% and a human rate of 14.76%. P(protect given protected last turn) 68.58% to 36.48%, against a human rate of 10.50%. **COMPLETION.** Games that reach an ending 56% to 79%. Resolved 539 to 762. Open at the cap 418 to 189. **BOARD.** Board-material 34 to 47. **RULE.** This increase is the expected consequence of the repair. It is not a regression. A game that ends reaches late positions that the previous arm did not play.

**5.257.0 - THE COMPARATOR IS COMPLETE.** **RESULT.** Compared leaves 40 to 54. The standing hole is 16 to 0. **METHOD.** 14 leaves were wired. Each leaf was shown invisible before the wire and caught after the wire, against a board that already read 40 leaves. Each leaf has a silent control. **REFUSAL 1.** `volatile:unburden` has no field in this engine. `effSpeed` recomputes the doubling from the current ability inside an `_hadItem && !m.item` guard. **REFUSAL 2.** `volatile:powershift` cannot be written by a legal body. Champions un-bans the move. No legal body learns it. **GUARD.** The probe derives the carrier count on each run. The probe fails if the count is not zero.

**5.257.0 - CORRECTION. THE JOINT ARM IS DETERMINISTIC.** **PRIOR CLAIM.** This version's changelog note records that `joint-empirical-click/v1` gave 167, 167 and 138 on identical pins, that the cause was under investigation, and that the joint figures 110, 53, 167 and 138 were one draw from an uncharacterised distribution. **STATUS.** That claim is WITHDRAWN. **EVIDENCE.** Six runs used one identical set of pins. The runs split at the protect fix, which landed at 02:27. The three runs on the previous driver gave protocol and board-material 121/34, 121/34 and 138/53, with `prefer_narrowed` at 20,507, 20,507 and 20,353. The three runs on the repaired driver gave 167/69, 167/69 and 147/55, with `prefer_narrowed` at 0. Each group is bit-identical inside itself, to `credit_events` and `shuffle_calls`. **CONCLUSION.** There is no distribution. The joint figure of 53 stands and repeats.

**5.257.0 - THE PINS FREEZE THE INPUTS AND DO NOT FREEZE THE INSTRUMENT.** **DEFECT.** A measurement pins the engine release, the census and the team pool. All three are inputs to the instrument. The instrument was not digested. **EVIDENCE.** `engine/arms_comparable.js` was asked about two of the runs above. It answered "COMPARABLE. Both arms selected their sample the same way, so a difference between their numbers is the change under test". The two runs used different driver code. **CAUSE.** The limits block of that file already named the gap in prose: "THE DRIVER ITSELF ... no artifact records its digest. WIRE 4 asserted it by hand." **RULE.** A named limit is not a guard. **REPAIR.** `engine/steering.js` digests the require closure of the instrument into `steering.driver_code`. `engine/game_differential.js` takes that digest at module load, takes it again at write time, and voids the run if the digest moved. The voided run withholds `diverged`, `mid_void` and `state`. `engine/arms_comparable.js` computes the limit line from the two artifacts, and refuses a pair where only one side carries the stamp.

**5.257.0 - CORRECTION. THE EMPIRICAL ARM READS 55 ON THE REPAIRED DRIVER.** **PRIOR FIGURE.** 47 board-material. **CURRENT FIGURE.** 55 board-material, with protocol 147. **REASON.** 47 was measured before the comparator widened. That run read 40 leaves. The current run reads 54 leaves. **STATUS.** Both figures are correct for their own comparator. 47 stays correct as the second leg of the paired protect measurement above. **RULE.** Name the artifact and the arm beside each whole-game figure.

**5.257.0 - THE RESIDUAL PROTECT RATE IS A SECOND DEFECT.** **MEASUREMENT.** The protect rate of the repaired driver is 1.53 times its own input. **CAUSE.** The move-prior table gives a marginal P(move given species). The driver renormalises that row onto the four moves that the body carries. Row mass 0.917 over 8 moves becomes 0.521 over approximately 3.1 moves. Protect stays in the subset in almost all cases. **STATUS.** Named. Not repaired in this version. **REASON.** A repair changes the declared input of the driver. Two repairs in one pass are not attributable.

**5.257.0 - THE PUBLISHED WHOLE-GAME FIGURE IS A DIFFERENT NUMBER.** **PUBLICATION.** `data/game-differential.json` is not republished. It holds board-material 46 of 961. The gate prints that figure. **STATUS.** The published figure is stale as a description of tonight's engine. Only a settled-tree pass replaces it. **LOCATION.** The measurements of this version are in the verification artifacts under `data/verification/`, one for each arm, with a knob-cleared control beside each one. **REPORTS.** `docs/_reports/2026-09-05-protect-amplification.md`, `docs/_reports/2026-09-05-leaf-widening-all16.md`, `docs/_reports/2026-09-05-cap-or-stall.md`.

**5.256.0 - A CHARGED MOVE STRUCK THE WRONG SLOT.** **DEFECT.** The release turn of `vol.charging` aimed at `live(foes)[0]`. The authority replays the `targetLoc` that is stored on the sub-volatile. **EFFECT.** A Phantom Force charged at slot b struck slot a. **VISIBILITY.** The defect could not be seen before this session. The previous driver resolved each foe-aimed click with the lowest live index for both slots. Re-aiming was therefore a no-op by construction, and a correct implementation and this defect gave the same play. **CAUSE OF THE BLIND SPOT.** The focus-fire behaviour of the driver hid a real targeting defect. **SECOND DEFECT.** The claim on the defect card was also real. The charge wrapper that survives a BeforeMove refusal fires 2 times in 961 games. The defect on the card was the minor half of the pair.

**5.256.0 - THE FIGURES, WITH THE ARM NAMED ON EACH ONE.** **RULE.** The two arms are different policies. `arms_comparable` refuses to pair them by design. Do not compare a figure from one arm with a figure from the other. **JOINT ARM.** Board-material 110 to 53. Protocol first-divergence 191 to 138. VOID 38 to 4. **EMPIRICAL ARM.** Board-material 35 to 34. Protocol first-divergence 120 to 121. **ADDRESSES.** Charge moves are now fully absent from `unshared_address_shapes`. **CENSUS.** 829 of 829, with 0 unprobed. **GATE.** Back to 2 of 9 failing clauses.

**5.256.0 - THE PUBLISHED WHOLE-GAME FIGURE IS A DIFFERENT NUMBER.** **PUBLICATION.** `data/game-differential.json` is not republished. It holds board-material 46 of 961. That is what the gate prints. **STATUS.** The published figure is stale as a description of tonight's engine. Only a settled-tree pass replaces it. **LOCATION.** The measurements of this version are in the verification artifacts under `data/verification/`, one for each arm, with a knob-cleared control beside each one. **RULE.** Name the artifact each time a whole-game figure is quoted.

**5.256.0 - THE CONTROLS ARE THE PROOF OF THE ATTRIBUTION.** **CONTROL.** The knob-cleared runs use the same release, the same pinned pool and the same driver, with the two fixes switched off. **RESULT.** They reproduce the earlier figures exactly: joint 110 and empirical 35, against 53 and 34 with the fixes live. **DRIFT.** `engine/engine_release.js drift` reports that only `medicham2-browser.js` moved between the two releases. **CONCLUSION.** The full 57-game movement of the joint arm is these two fixes and nothing else.

**5.256.0 - THE FIXTURE WAS ONE HOUR OLD WHEN IT PAID.** **PRIOR STATE.** `vol.charging` was recorded as REAL and UNSTAGEABLE earlier in the same session. `scripted()` fell back to a target field that the request of a locked move does not carry. The authority refused the choice. No staged scenario in this repository had played a two-turn release turn. **ENABLER.** The VOID games of the joint driver made the scenario stageable. They are dominated by `phantomforce`, `electroshot` and `solarbeam`, against zero charge-move shapes in the control arm. **REPAIR.** One line. `Pokemon#getMoves(lockedMove)` returns no `target` field, so the encoder no longer supplies one. This is the rule that the unscripted chooser already used. **RESULT.** Each directed scenario can now reach a release turn. None had before. **REGRESSION.** The `directed` block did not move. The three roster stages, `all_mechanics_fire --kind all` and nine adjacent scripted probes are unchanged.

**5.256.0 - A DRIVER CHANGE EXPOSED A DEFECT FOR THE SECOND TIME IN ONE SESSION.** **CASE ONE.** The change from the coverage driver to the empirical driver moved board-material from 0 to 135, because the new driver plays games that end. **CASE TWO.** The change from the focus-fire driver to the joint driver exposed a targeting defect that a constant aim made unobservable. **RULE.** Neither figure was wrong. Each figure was a statement about a population. A driver is part of the ruler and is not part of the subject.

**5.256.0 - A GREEN TEST WAS A STALE ASSERTION THAT PASSED BY LUCK.** **DEFECT.** The `!x.top` filter of `tests/test-pin-arms.js` swept in the `middle` arm. The `chance` field of that arm is a live uniform. Its own description reads "moves miss at their printed accuracy". **EFFECT.** The test was green only when one hash landed under 0.01. **CLASS.** A stale assertion, not a defect in the arms. **ACTION.** Fixed. All arms pass.

**5.256.0 - THE PREDICTION CARD AND WHAT IS OWED.** **SCORE.** 3 of 8. **EMPIRICAL MISSES.** Both were by one, and both are attributed. **JOINT MISSES.** All three were in the same direction. Each called the fix smaller than it was. **CLASS.** A systematic error in the prior, not noise in the measurement. **WITHHELD.** No quarantined figure becomes quotable. Leaf calibration, each rollout figure and each head-to-head stay withheld. **OWED.** The MAG refit is owed and is a refit, not a restamp. `docs/ENGINE.md` still carries `vol.charging` and was not restamped. One new control-arm board row is attributed and not diagnosed. 13 of the 53 in the joint arm are unnamed under the 40-row cap of the artifact. The semi-invulnerable half of the abort fix is wired and not staged. **RED TEST.** `tests/test-wiring.js` is a pre-existing red. It plays self-play games and was not repeated. **REPORT.** `docs/_reports/2026-09-05-charging-fixture.md`.

**5.255.0 - A RELEASE DIGEST THAT MOVES NOW REPORTS WHY IT MOVED.** **PROBLEM.** A measurement is taken against a frozen release. The release id is a digest of the frozen sources. A change to the line endings of one source moves the digest. **COST.** An agent found the engine gate at 7 of 9 failing clauses instead of 2 of 9. Five heavy clauses were re-run to restore it. Nothing had changed: `engine/medicham2-browser.js` had different line endings, and all 26 frozen sources were content-identical. `diff --strip-trailing-cr` reported 0 differences. **STANDING CASE.** One cited release differs from the tree in exactly one file. The file holds 39,932 LF terminators against 39,932 CRLF terminators. Zero characters are edited. **ACTION.** `engine/engine_release.js` and `engine/pin_guard.js` classify each drift as CONTENT-CHANGED or EOL-ONLY. `tests/probe_release_drift_diagnosis.js` holds the demonstration. **MEASUREMENT.** On the current tree there are 36 cited releases: 34 CONTENT-CHANGED, 1 EOL-ONLY, 1 NO-DRIFT, 0 UNDIAGNOSABLE. Cost inside the gate is 37 ms.

**5.255.0 - THE DRIFT REPORT IS A DIAGNOSIS AND NOT AN EXEMPTION.** **CONSTRAINT.** The digest is unchanged. It hashes raw bytes. The id still moves on a line-ending change. Artifacts stranded by an aged-out release stay stranded. **RESULT.** The two failing clauses of this version are diagnosed CONTENT-CHANGED. They still FAIL. Every count is withheld and the report states that a re-measurement is owed. **REFUSED OPTION ONE.** Pinning the nine unpinned sources to LF would rewrite those files, move every release id, and break `tests/roster.js`, whose red demonstrations match a carriage return against the simulator's source. **REFUSED OPTION TWO.** Normalising the comparator is forbidden here, because the difference is already observable to an instrument. **PROPERTY.** The classifier reads no filename, no path, no `.gitattributes` entry and not the frozen source list. One probe case diagnoses a file whose name is not in this repository, by calling the classifier on two bare buffers. **REUSE.** `engine/status.js` and `engine/quarantine.js` needed no edit. Both already render the guard's `why` field verbatim.

**5.255.0 - THE DRIFT DIAGNOSIS CONTAINED A FALSE ALARM AND WAS SHOWN RED FOUR WAYS.** **DEFECT.** The first line-terminator counter reported two identical files as different. **RULE.** A tool built to prevent false alarms must be shown to produce none. **PROOF.** With the normaliser broken to the identity function the probe scores 9 of 16, which reproduces the pre-fix behaviour. With an over-excusing break it scores 10 of 16. Repaired, it scores 17 of 17.

**5.255.0 - TWO MECHANICS LANDED. BOARD-MATERIAL 37 OF 961 TO 35 OF 961.** **MEASUREMENT.** Protocol first-divergence 122 to 120. VOID 6 to 4. Census level at 829 of 829. **ATTRIBUTION.** Both games were attributed by id on identical game lists. New games: zero. **PUBLICATION.** `data/game-differential.json` is not republished. It holds board-material 46 of 961 and that is what the gate prints. That published figure is stale as a description of tonight's engine. **RULE.** Name the artifact each time a whole-game figure is quoted.

**5.255.0 - THE TWO FIXED MECHANICS, WITH THE AUTHORITY CITED.** **ONE.** Imprison set a volatile and sealed nothing. The tag bundle carries `sealsMoves {fromUsersOwnMoves: true}` and no engine line read it. A foe played a sealed move, dealt damage and spent PP. Authority `data/moves.ts:9492-9524`. Probe `tests/probe_imprison_seal.js`. The live arm read the defender at 78 HP in this engine against 130 in the authority before the fix, and identical after. Three over-fire controls are green in both directions: an unshared move, the user's own ally, and no Imprison. **CLASS.** Same shape as Destiny Bond: implemented, and doing nothing. **TWO.** The pivot road never asked `bounceOff`. Magic Bounce hands the move over with `useMove(newMove, target, {target: source})`. A Parting Shot at a bouncer therefore lowers the clicker and makes the bouncer leave. This engine did both backwards. The two engines were 14 board leaves apart before the fix and identical after. The Synchronize, U-turn and Taunt controls did not move.

**5.255.0 - THREE MORE LEAVES ARE WIRED. THE COMPARATOR STANDS AT 40 OF 56.** **RULING.** Will ruled that the leaves come before chasing the count to zero. Board-material zero on 37 of 56 standing leaves is not the same claim as zero on all of them. **ACTION.** `lockon`, `minimize` and `noretreat` are wired. **METHOD.** Each leaf was traced to a real write site AND a real read site before wiring. A leaf can look wireable on every derived column while the engine holds nothing under that name. Each was then staged in a real game to confirm that it stands at the boundary. Each was red first, with a control. `lockon` holds a clock and was compared as a clock. **RESULT.** Board-material stayed flat at 35. That result was called exactly in advance. The pinned pool holds zero Lock-On and zero Dragapult, so the lab moved and the pool correctly did not.

**5.255.0 - STORE-REPLAY IS REFUTED AS A DRIVER.** **CLAIM.** Recorded human click sequences cannot drive this differential. **REASON ONE.** A replay stops being a replay at the first damage-dependent faint. At least 24.8% of frozen-pool games have one on turn 1. **CAUSE.** Champions sheets never publish the 66 stat points. The spread is absent on 100% of sheet bodies, measured across 47,856 of them. Simulated damage therefore cannot match the real game's damage. **REASON TWO.** The change is to the population and not to the driver. The differential pairs team A from one game against team B from another game. No recorded sequence exists for the matchups it plays. **STATUS.** Refuted structurally. No measurement is owed.

**5.255.0 - THE COORDINATION GAP WAS ALREADY QUANTIFIED AND NOBODY HAD ACTED ON IT.** **MEASUREMENT.** `engine/board.js:377` measures humans double-targeting 23.4% of the time. Independent choice gives approximately 50%. **DECLARATION.** `engine/empirical_driver.js:56-64` states that it has no target model and no switch model. Switches are 12.1% of real slot decisions. **EFFECT.** The arm runs a median of 11 turns. Real VGC runs 7. 49% of its games hit the turn cap instead of ending. **RULE.** A figure that is measured and acted on by nobody is worth what an unmeasured figure is worth.

**5.255.0 - THE REMAINING WHOLE-GAME LEAVES HOLD NO LARGE BUCKET.** **RE-DIAGNOSIS.** Of the 37 rows standing at the start of this version: about 12 are damage-value rows already fenced by a filed row; 5 are `stall` and are refuted as a die; 3 are Cursed Body, Flame Body and castform and are refuted; 2 are Poison Touch and are a die value, with the ability wired and both engines reaching the draw at the same point; 2 are `vol.charging`; the rest is a one-row tail. **RESULT.** After fencing, the largest actionable group was two rows. **OPEN DEFECT.** `vol.charging` is confirmed and cannot be probed today. The scripted chooser in `engine/game_differential.js` falls back to a target field that a locked move's request does not carry, so the authority refuses the choice. No staged scenario in this repository has played a two-turn release turn. The unscripted chooser in the same file already has the correct rule. **STATUS.** Reported, not fixed. It can move the artifact's `directed` block.

**5.255.0 - PREDICTIONS AND WHAT IS STILL OWED.** **PREDICTIONS.** The leaf batch scored 4 of 4, exact on all four, with the flat board called in writing before the run. On the mechanics batch the VOID call was wrong: 6 predicted against 4 measured. The bounced Parting Shot restored a shared accuracy address, which fell from 8 to 5. The miss is recorded. **WITHHELD.** No quarantined figure becomes quotable. Leaf calibration, every rollout figure and every head-to-head stay withheld. The gate is shut and both failing clauses read the unrepublished whole-game artifact. **OWED.** The MAG refit is owed and is a refit, not a restamp. **REPORTS.** `docs/_reports/2026-09-05-fix-batch-8.md`, `docs/_reports/2026-09-05-leaf-widening-batch2.md`, `docs/_reports/2026-09-05-release-drift-diagnosis.md`.

**5.254.0 - A GENERATED BUNDLE SHIPPED A LIVE ENGINE DEFECT IN HEAD FOR SIX DAYS.** **DEFECT.** `data/abra-tags.js` is generated from `data/tags.json` and is frozen into every engine release. The generated copy was stale against its source by 1,084 leaves. Three of those leaves are tag params that the engine reads by name. **EFFECT.** `moves.partingshot.params.pivotStatus` held only `{selfSwitch:true}` in the generated copy. `medicham2-browser.js` therefore took its `pivotConditionUnreadable` fallback and pivoted unconditionally. **CAUSE.** The fix landed in the source at 09:57 on 2026-08-29. The generated copy was not rebuilt. **ACTION.** The bundle was rebuilt from its source. **SCOPE.** The remaining differences are usage counts, usage-ranked linkage re-sorts and one `consumedBy`. Membership is identical on both sides. **CLASS.** Fifth instance.

**5.254.0 - THE CHECK WAS NOT MISSING AND IT DID NOT MISS IT.** **STATE.** `engine/artifact_audit.js` check G derives every self-declaring bundle from that bundle's own `GENERATED by <builder> from <source>` header. It runs the builder's own `--check`. It is a registered gate in `tests/run-all.js`. **MEASUREMENT.** Before the rebuild it exited 1, reported `1 GAP(S) FOUND`, and named the exact pair. Run time 1.56 seconds. **DEFECT.** Only a full suite runs it. The failing result was filed in a session report and annotated as an improvement. **RULE.** A check nobody acts on is not a check. **ACTION.** `.githooks/pre-commit` runs `engine/artifact_audit.js` above its scope guard. The guard exits 0 for a commit that stages only `data/`. **REASON.** All five instances of this class have the shape *regenerate the tags, commit the data*. A clause below the guard cannot fire on that shape. **CONSTRAINT.** No new comparison code was written. Two implementations of one fact is the recurring failure in this repository.

**5.254.0 - FOUR MECHANICS LANDED. BOARD-MATERIAL 41 OF 961 TO 37 OF 961.** **MEASUREMENT.** Protocol first-divergence 128 to 122. VOID 7 to 6. Census level at 829 of 829. Release sequence `3187ea18c625`, `014fe780a1a6`, `316669459d67`, `ae608567e8a8`. **ARTIFACT.** The new figure is in `data/verification/fix-batch-7.json`. **ATTRIBUTION.** `MEDI_SAMPLE_DUMP` gives an identical 961-row game list on both sides of each batch. Joined on `config|seed` the result is CLOSED 1 then 3, NEW 0. Every closure was named in advance. **PUBLICATION.** `data/game-differential.json` is not republished. It holds board-material 46 of 961 and that is what the gate prints. That published figure is stale as a description of the engine and is superseded by the verification artifact. **RULE.** Name the artifact each time a whole-game figure is quoted.

**5.254.0 - THE THREE FIXED MECHANICS, WITH THE AUTHORITY CITED.** **ONE.** Self-inflicted stat drops did not run when a Substitute absorbed the hit. The authority sets `targets[i] = null`, not `false`, at `sim/battle-actions.ts:1063-1066`. `selfDrops` opens `if (target === false) continue`, so its step 4 still runs. This engine set `R.out` on the substitute road, the driver skipped `out` rows, and the once-per-move backstop did not flush `_stepSelfPay`. RED `{def:0,spd:0}` against `{def:-1,spd:-1}`. GREEN identical. **TWO.** A sleep chosen inside a handler was attributed to the move. Champions' Dire Claw calls `trySetStatus(status, source)` with no `sourceEffect`, so `slp.onStart` takes its bare arm. Measured across four moves in the authority. **THREE.** A body under sun could be frozen. The sunnyday condition carries an `onImmunity` at `data/conditions.ts:579-582` that refuses `frz`. This engine read only the condition's damage handlers. `desolateland` carries the byte-identical handler and Champions overrides neither. **PROOF.** Probe `tests/probe_sun_refuses_freeze.js`. Knob `MEDI_FRZ_IN_SUN=1`. Red first at `SUN UP medi ["frz"] / sd []`. Nine arms, including a Cloud Nine control that restores the freeze in both engines, and a derived assertion that the engine's refusal table equals the authority's.

**5.254.0 - FOUR ROSTER SELF-TEST PLANTS COULD NOT GO RED.** **DEFECT.** Four planted faults no longer matched a site. Two carried a literal carriage return against an LF engine file. One anchored a signature that grew a fourth parameter. One matched two sites. **WHY IT WAS INVISIBLE.** Every shipped roster artifact is written without `--reds`, so the artifact holds an empty red list and the clause passes whatever the plants do. **RULE.** A suite that has never been shown able to fail is not evidence. **ACTION.** All four were re-aimed. Each was then verified independently, one rule at a time, and not read off the artifact that had hidden the fault. **STATE.** The shipped stages carry 18, 29 and 35 reds, 0 not-ok, 0 unaimed plants, 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE.

**5.254.0 - FIVE CANDIDATES WERE REFUTED BEFORE ANY EDIT.** **RESULT ONE.** The Dire Claw sleep clock is correct. Both engines read the same distribution off Champions' `sample([2,3,3])`. The refutation is now a permanent arm of that probe, not a sentence in a report. **RESULT TWO.** `stall` is the largest single named leaf at five games and it is a die, not a missing mechanic. All six legal stalling moves and the lapse agree. **RESULT THREE.** `castform.species` was not reachable in either shape staged. **RESULT FOUR AND FIVE.** Flame Body and Cursed Body were shown to fire in the previous batch. **RULE.** A refutation is cheaper than a wrong fix, and it must be recorded where the next diagnosis will read it.

**5.254.0 - `ABRA-HEAP: 3072` ON `engine/tag_dex.js` IS A SAFETY DECLARATION.** **DEFECT.** The builder exhausted the default heap. This blocks every tag-derived fix. **HAZARD.** Its only write is near the end of the file. An out-of-memory death therefore leaves `data/tags.json` holding its old content and its old mtime. Nothing on disk records the death, and every consumer reads a stale tag set that looks freshly generated. **ACTION.** The heap requirement is declared in the file. `tools/lownode.cmd` and `.githooks/pre-commit` read the declaration. It was previously prose that a caller had to remember. **VERIFICATION.** By the stamp, not the exit code. The tag artifact's own generated stamp moved from `2026-08-29T13:37:50Z` to `2026-09-05T00:34:28Z`.

**5.254.0 - WHAT THIS VERSION DOES NOT ESTABLISH.** **STATE.** The gate is closed and is back at its found shape, 2 of 9 clauses failing, both of them whole-game clauses reading the unrepublished artifact. **WITHHELD.** Leaf calibration, every rollout result and every head-to-head. **RE-RUNS.** Each batch re-ran the five clauses its own release staled. All five returned numerically identical: damage differential 6,000 of 6,000 with 0 disagreed, roster items 140, abilities 129 and moves 475, each at 0 DIFFER and 0 DID-NOT-FIRE. **CAUTION.** `all_mechanics_fire.js` defaults to `--kind moves` and takes the gate to 3 of 9 until it is re-run with `--kind all`. **REFIT.** Owed, and a refit rather than a restamp. **OWED.** `engine/tag_dex.js` should rebuild the generated bundle in the same act that writes its source. Verifying that needs a `tag_dex` run, which would strand release `ae608567e8a8` and void the five re-runs. **NOT RUN BY THIS PASS.** This documentation pass ran no game and no engine. It did not run `node engine/status.js --write` and it did not hand-edit inside a `<!-- GENERATED -->` block.

**5.253.0 - A REGISTER ROW THAT ASSERTS A LIVE DEFECT WAS READ AS CLOSED.** **DEFECT.** The status reader takes the text after the LAST pipe in a register row. A status cell that contains a code span with a pipe is cut, and the text after the cut is read as the verdict. **EFFECT.** Row #175 begins `open — engine DEFECT` and reported CLOSED to the gate. **ACTION.** The row notation was repaired. **STATE.** The row is open and asserts breakage. **SCOPE.** No mechanic changed. No differential ran. No game was played. `data/game-differential.json` holds board-material 46 of 961, unchanged.

**5.253.0 - THE DEFECT CLASS HAS TWO HALVES AND THE SECOND HALF IS LARGER.** **HALF ONE.** A pipe inside the status cell. It hid 8 rows. **HALF TWO.** Emphasis marks before the status word. The leading-whitespace skip is `\s*`, which does not skip `**`, so a cell authored in bold does not match and no pipe is involved. It hid nine rows. **ACTION.** Eighteen rows were repaired, notation only, one line each. **RESULT.** Open rows 237 → 222. Open-and-asserting-breakage 50 → 51. **VERIFICATION.** A replay of the whole register through the shipping detectors reports exactly 17 moved verdicts. **CONTROL.** The two detector functions are byte-identical to HEAD.

**5.253.0 - THE NEW CHECK IS A PROPERTY AND IT IMPORTS THE DETECTOR IT CHECKS.** **PROPERTY.** For each row, the gate-visible verdict must be the same when the status cell is read as the shipping detector reads it and when it is read as the column the author wrote and then rendered to plain text. **RULE.** The check imports the shipping closed-row detector. It does not reimplement it. **REASON.** A third copy of that detector once disagreed with the canonical one on 24 of 292 rows, in both directions. **PROOF.** The check was shown red on seven synthetic doors, four of which have never been used in this repository, and each door has a repaired twin that goes quiet. It was then shown red on the pre-repair register, where it names 15 rows and exits 1. **STATE.** Current register 506 rows, 0 verdict failures, 0.17s, writes nothing.

**5.253.0 - AN ESCAPED PIPE IS NOT A FIX, AND A CUT WITH NO CONSEQUENCE IS REPORTED AND NOT RATCHETED.** **MEASUREMENT.** The capture uses a negated-pipe character class. It stops at an escaped pipe exactly as it stops at a bare pipe. The authored form and the fully escaped form extract identical wrong text. **RULE.** Remove the pipe. Do not escape it. **JUDGEMENT.** 15 cells are still cut by a pipe whose verdict is unchanged either way. They are reported as a list. They are not put behind a count that may only fall, because such a count invites an argument for an exception. **SCOPE.** Ninety rows and 631 pipes were checked and left unchanged: 13 closed, 2 correctly open.

**5.253.0 - SIXTEEN CLOSURES ARE READABLE AND NOT RE-VERIFIED.** **RULE.** A parse repair must not be recorded as a verification. **STATE.** Sixteen closed rows were made readable without being re-verified. Each row records that fact in its own cell. **EVIDENCE.** Cheap artifact checks passed for seven of them. Four rest only on the named instrument existing on disk, and say so. **OWED.** Re-verification of those sixteen rows. **NOT RUN BY THIS PASS.** This documentation pass did not run `node engine/status.js --write`. It did not hand-edit inside a `<!-- GENERATED -->` block. Those blocks were restamped by another division's pass while this text was being written. They are current to that pass and not to this one. They carry no register figure.

**5.252.0 - THE PUBLISHED WHOLE-GAME CLAUSE IS RE-MEASURED AND REPUBLISHED ONTO ITS OWN ARTIFACT.** **RULE.** A whole-game figure must name the artifact that holds it. **STATE.** `data/game-differential.json` was rewritten on engine release `0dec37ff5ad9`. It holds board-material 46 of 961 and protocol first-divergence 141 of 961 raw, 140 after one declared. It records 961 games PLAYED of a 1200-PAIR budget, 7 void and 1 thrown. **CHANGE.** The published figure was 77 of 961. It is now 46 of 961. **DISCHARGED.** Previous versions of this document state that the published clause still holds 77 while the measured value is 46. That condition no longer exists. The two figures are now one figure in one artifact.

**5.252.0 - THE GATE FAILS FOR A DIFFERENT REASON THAN IT DID BEFORE. THE REASON IS THE RESULT.** **STATE.** The gate reads `CLOSED — 1 of 8 GATING clauses fail`. Before this pass it read 6 of 8. **CAUSE.** Five of the six failures were state (a): the artifact could not prove which engine produced it. **ACTION.** All five pinned artifacts were regenerated against one release. **RESULT.** No clause is in state (a). The one remaining FAIL is state (b): a named instrument is RED on the current engine over 46 real games. **RULE.** Do not report state (a) and state (b) as the same failure. An unmeasured clause and a measured red clause carry different information. **SEPARATE REPORT.** State (c) sits inside the defect clause that PASSES: 40 open rows assert breakage with no instrument, 7 name an instrument that answers nothing usable, and 3 name a green instrument.

**5.252.0 - THE RUN WAS PREDICTED IN WRITING BEFORE IT STARTED.** **METHOD.** The prediction was saved to `data/verification/2026-09-04-settled-republish-prediction.json` before the differential started. **PREDICTION.** Board-material 46, protocol 141, void 7, thrown 1. **RESULT.** 46, 141, 7, 1. Four of four, all exact. **CONTROL.** The stated premise was incomplete. `data/smogon-priors.json` had moved from Smogon month 2026-07 to 2026-08 and from 284 species to 283, and it is not a counter. It reaches the run through `engine/champions_sim.js`, `engine/set_priors.js` and `engine/smogon_priors.js`. It was named as the falsifier before the run. It was then measured inert: `classes` and `first_divergences` are byte-identical to the artifact that first carried the 46. **RULE.** Name the falsifier before the run. A prediction with no named falsifier cannot be told apart from luck.

**5.252.0 - THE FIVE PINNED ARTIFACTS AND THEIR SCOPES.** **STATE.** All five were regenerated against release `0dec37ff5ad9`. The stage-by-stage damage differential reads 0 disagreements over 6,000 comparisons at 17 damage indices, seed 20260804. The three deliberate-roster stages each read 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE. The staged mechanics sweep reads 5 diverge, 1 declared, 4 below the reach shelf and 0 left, over 1,313 games with none thrown. The live mechanics census is 829 of 829 with 0 missing. The undeclared side-selection count is 78, with its ratchet at 78. **LIMIT.** One release was cut from a working tree that no commit contains. That release is superseded, and the figures above name the release that is cut from committed bytes.

**5.252.0 - THE FITTED WEIGHTS OWE A REFIT AND NOT A RESTAMP.** **DEFECT.** The damage table that feeds the feature function moved from 318 species to 322. **RULE.** A restamp is valid only if the feature FUNCTION is unchanged. A moved damage table changes the function's input. **ACTION.** No fitted vector was written. No fit was started. **STATE.** The refit is OWED and is the owner's decision. **NOTE.** `node engine/status.js --write` was run last in the sequence, for the first time in three releases. The `<!-- GENERATED -->` blocks in the division ledgers are current. Do not edit inside them.

**5.251.0 - THIS RELEASE CHANGES THE DEFECT REGISTER AND THE COUNTERS. IT DOES NOT CHANGE A MECHANIC AND IT DOES NOT MEASURE A BOARD.** **RULE.** A whole-game figure must name the artifact that holds it. **STATE.** `data/verification/fix-batch-M6instr-defog.json` holds board-material 46 of 961 and protocol first-divergence 141. `data/game-differential.json` was not rewritten. It holds board-material 77 of 961, and it is the artifact the gate clause reads. **LIMIT.** No figure above was re-derived in this pass. Do not read this version as engine progress.

**5.251.0 - MORE THAN HALF OF THE UNVERIFIABLE DEFECT CLAIMS WERE ALREADY FALSE.** **DEFECT.** The register held **43** open rows that asserted a defect. Nothing in the repository could confirm or refute them. **MEASUREMENT.** **24** of the 43 rows were already fixed. **6** of the 43 rows were duplicates of another row. **RESULT.** Open rows fall **261 → 237**. Open rows that assert breakage fall **74 → 50**. **RULE.** A backlog that nothing can refute is not a conservative estimate. Measure the population before you plan against it.

**5.251.0 - EACH CLOSURE CARRIES ITS OWN EVIDENCE. NO ROW WAS CLOSED ON A TRIAGE.** **RULE.** A triage is a hypothesis. A closure is a measurement. **METHOD.** Each of the 24 closures records evidence in its own cell: a live census row, a roster verdict, a tag value, or a knob-and-counter pair. Each closure is dated. Each closure keeps the prior status verbatim. **CONTROL.** **22** of the 24 closures were verified again against a newer commit, because a commit landed between the two passes. **NOTE.** Two claims in the triage were transcription errors. They are recorded as errors. They were not applied.

**5.251.0 - THE SPECIFIED PIPE REPAIR DOES NOT WORK. IT WAS MEASURED FIRST.** **DEFECT.** One register row reads OPEN-AND-BROKEN. Its own cell says CLOSED. The status-cell capture reads the text after the last pipe. The closure text quotes a protocol line that contains pipes. **REJECTED REPAIR.** An escape of the form `\|` changes nothing. The capture is a negated-pipe character class. It stops at an escaped pipe in the same way that it stops at a bare pipe. **PROOF.** A synthetic row was driven through the shipping detectors. The row as authored and the row fully escaped give the same wrong fragment. Only the removal of the pipes gives the correct status. **CORRECTION.** The pipes were removed. **LIMIT.** The shared closed-row detector was not changed. It is the one implementation of *is this row closed*. Mutation testing shows that it can be replaced by `return true` while all **159** of its assertions pass.

**5.251.0 - THE PIPE DEFECT IS A CLASS. THE CLASS WAS REPORTED AND LEFT.** **MEASUREMENT.** **98** rows carry **669** unescaped pipes inside inline code. **22** rows have a cut status cell. **Nine of the remaining 21 rows read OPEN against a cell that their author wrote as `closed` or `PART DONE`.** One row parses empty. **DECISION.** These rows were not closed. No one of them reaches the gate. **RULE.** Do not infer a closure from a parse artifact. A malformed cell is a fact about the ruler. It is not a fact about the world. **OWED.** The owner of each row must state its status again.

**5.251.0 - FOUR COUNTERS READ `NaN`. ONE WAS PUBLISHED AS `null` IN TWO ARTIFACTS.** **DEFECT.** A field that is incremented into an object that does not declare it evaluates to `NaN`. It is written as `null`. **INSTANCE.** One such field was published as `null` in `data/million-run.json` and in `data/million-run-150k.json`. The capability fired. The counter recorded nothing. **SECOND INSTANCE.** One field was declared in one object literal and incremented on a different object literal. The declared field read zero for every run. The incremented field read `NaN`. A comparison of `undefined` against zero cannot go red. **CORRECTION.** Each declaration was moved to the object that is incremented. **REJECTED CORRECTION.** No `|| 0` was added at an increment site. A default at the increment hides the owner of the counter. The owner was the defect.

**5.251.0 - EVERY INCREMENT MUST TARGET A DECLARED FIELD.** **RULE.** The check is a property. It is not a list of known-bad names. **MEASUREMENT.** The check reads **507** files and **602** counter literals. It reports exactly **4** violations. It reports zero false positives. **RESULT.** The check needs no exemption list. **PROOF.** The check was shown RED on all four violations before the correction. It carries a synthetic red-proof arm, so it cannot pass when it asks nothing. **LIMIT.** The check names the **6** computed-key increments that it cannot decide. It does not guess them.

**5.251.0 - A PIN-GUARD BRANCH HAD NO READER.** **DEFECT.** The branch that fires when an artifact was measured against a different release was not read. The asserting code quoted the founding rule and then named five of six branches. **CORRECTION.** The branch list is derived from the guard object's own keys. A sixth branch needs no edit. **RESULT.** The selftest moves **216 → 218** passed, 0 failed. **CORRECTION TO THE AUDIT.** The branch was already driven. Only the reader was absent. **SECOND CORRECTION.** Five counters that the audit called unread are read. They reach published artifacts through `Object.assign`. A search by name cannot see this.

**5.251.0 - WHAT THIS VERSION DOES NOT DO.** No mechanic changed. No differential ran. No model was fitted. `data/policy-weights.json` was not written. No quarantined figure becomes quotable. `node engine/status.js --write` was not run, for the third release in sequence, so each `<!-- GENERATED -->` block in the division ledgers is three passes behind. Read the gate. Do not read the block.

**5.250.0 - TWO DEFECTS ARE CORRECTED. BOARD-MATERIAL WHOLE-GAME DIVERGENCE IS 53 OF 961 BEFORE AND 46 OF 961 AFTER. PROTOCOL FIRST-DIVERGENCE IS 154 BEFORE AND 141 AFTER.** **RULE.** A whole-game figure must name the artifact that holds it. **RULE.** A sequence of figures is reported complete. Do not remove a step that moved in the unwanted direction. **RESULT.** The sequence for this session is 77, then 61, then 50, then 53, then 46. The step to 53 is an increase. The increase was correct: it removed a coincidence that hid four games. **PINS.** VOID is 7 before and after. The mechanics census is 829 of 829 before and after. The engine release is `7ffc58da8ef8` before and `252025cfcddc` after. The undeclared side-selection count is 80 before and 78 after, and its ratchet is lowered to 78.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE.** `data/verification/fix-batch-M6instr-defog.json` holds board-material 46 of 961 and protocol 141 of 961. `data/game-differential.json` was not rewritten. It still holds board-material 77 of 961 and protocol 168. That is the PUBLISHED figure. Both artifacts are correct on the pins they record. Name the artifact each time you state either figure.

**5.250.0 - THE CONFUSION SELF-HIT DEFECT IS CLOSED. THIRTEEN OF FOURTEEN ITEMS CLOSED. THE FOURTEENTH IS A DIFFERENT DEFECT.** **RULE.** A cause is not a game. Do not subtract one count from the other. **DEFECT.** The authority takes the confusion damage roll directly, not through the damage function. The differential wrapped the damage function only. The two engines therefore read one shared draw in opposite directions. **FIX.** The differential wraps the confusion damage method, and the simulator draws from the same stream. One environment variable restores the old behaviour in BOTH files. **RESULT.** Thirteen confusion damage-value causes are gone. That class is 22 before and 9 after. **LIMIT.** Board-material fell by 7 only, because 6 of the 13 games carry a second divergence that was already counted. **LIMIT.** The fourteenth item is a stream-position defect with a confusion line at the join. It is in the ordering family. It did not move, and it could not have moved.

**5.250.0 - DEFOG SWEPT THE WRONG SIDE.** **DEFECT.** The call site selected the side the mover is not on. The authority names the TARGET's side for screens and hazards, and the SOURCE's side for hazards. On an ally-aimed Defog the selection is wrong twice and in opposite directions. A bounced Defog moves the source as well. **FIX.** The bounce reports itself where the bounce happens. The call site reads the target's side from the row that survived target selection. **PROOF.** `tests/probe_defog_target_side.js` has three arms. The ally-aim arm and the bounce arm are red before the fix and green after. The foe-aim arm is the control and is green throughout. **RESULT.** The pinned pool moved by zero. This was stated before the run. An ally-aimed Defog does not occur in real human play.

**5.250.0 - THREE SIDE-SELECTION SITES ARE NOT THREE COPIES. DO NOT CONSOLIDATE THEM.** **RULE.** One fact, one implementation. **LIMIT ON THAT RULE.** Two sites that look the same can ask different questions. **DEFECT AVOIDED.** Tidy Up is `target: 'self'`. Its authority names the mover's own side and the foe sides with conditions. A merge with the Defog site would collapse two bags into one bag. The opponent's hazards would then stay on the field. **CONTROL.** The membership of each family is derived from the tag corpus and from the authority text on every run. A new carrier fails by name.

**LIMIT ON THE BEFORE-AND-AFTER COMPARISON.** `PIN_DIGEST` moved from `ccb365985023` to `bcb38e47d94f`. Half of the confusion fix is in the measuring instrument. The comparison therefore spans a changed instrument and a changed engine. The cause count is robust: a cause names the same event on both sides, or it does not. The board-material integer is NOT strictly one-variable. Do not present it as one-variable.

**5.250.0 - FOUR UNCOMMITTED DECLARATION ROWS WERE DESTROYED.** **DEFECT.** A `git checkout --` was run on a file that another session had edited and had not committed. Four rows were lost. **RECOVERY.** Two rows are restored word for word from a printout made before the loss. Two rows are RECONSTRUCTIONS. The file labels them as reconstructions. Each reconstruction quotes the original answer from the expired key's own text. Each asks for a re-read by its author. **EVIDENCE THAT THE SUBSTANCE SURVIVED.** The code under those rows did not change. The census verifies this by digest. **LIMIT.** `git checkout --` on an uncommitted file is not reversible. Git holds no copy.

**5.250.0 - REGISTER COVERAGE, MEASURED.** Of 219 open rows: 13 name a marker the classifier admits, 43 declare in writing that no instrument decides them, and 0 name a marker the classifier refuses. **DEFECT.** 163 of the 219 rows have neither a marker nor a declaration. 43 of the 74 rows that assert breakage are in that group. For those rows the open-defect clause rests on prose. **NOTE.** The declared half improved. The undeclared half grew with the register. Report both.

**STILL OPEN.** `tests/staged_board.js` is board-identical on 25 of 25 scenarios and exits 1 on a pre-existing red. The anchor it looks for is absent at `HEAD`. It is reported and not patched. Two premature-close candidates are filed with evidence and are not reopened. Four closures rest on markers that have never run. One defect stays fenced rather than split. `node engine/status.js --write` was not run in this pass. The generated blocks in the division ledgers are one pass behind.

**5.249.0 - ONE DEFECT IS CORRECTED IN `engine/medicham2-browser.js`. BOARD-MATERIAL WHOLE-GAME DIVERGENCE IS 50 OF 961 BEFORE AND 53 OF 961 AFTER. THE FIGURE INCREASED. THE INCREASE IS CORRECT.** **RULE.** A whole-game figure must name the artifact that holds it. **RULE.** A figure that moves in the unwanted direction is reported first and explained second. **MEASUREMENT.** Protocol first-divergence is 150 before and 154 after. VOID is 7 before and after. The mechanics census is level. The engine release is `9b449a41c865` before and `7ffc58da8ef8` after. All other pins are identical. **DEFECT.** The confusion self-hit drew from one address. The authority uses two. `data/conditions.ts` writes `this.activeTarget = pokemon` between the roll for the self-hit and `getConfusionDamage`. The two draws therefore have different addresses when the confused body has clicked at a foe. **WHY THE FIGURE INCREASED.** The defect is 14 games. Four of the 14 were hidden. In those four a shared coin landed the same way on both engines and the boards agreed by accident. The correction removed the coincidence. The instrument now sees the four games. **EVIDENCE.** One divergence class moved. `-damage field` moves 18 to 22. Eight of the eight moved causes carry `[from]confusion`. No other part of the run changed by one game. **PREDICTION.** The direction was written before the run in `data/verification/2026-09-04-M6-address-prediction.json`. It reads neutral-to-slightly-worse. Protocol missed the stated band by one. **PROBE.** `tests/probe_confusion_selfhit_address.js`. 17 checks are green. 2 checks are red under `MEDI_CONFUSION_DMG_ADDR_LEGACY=1`. The self-aimed control is green in both states. Anti-vacuity was asserted on the `confusionSelfHit` counter first. **DECISION.** The fix is kept. The revert is one environment variable. The revert is the owner's call. **STATUS.** The gate is red. No model was fitted and no weight vector was written.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE.** `data/verification/fix-batch-M6-sidesel.json` holds board-material 53 of 961 and protocol 154 of 961. `data/game-differential.json` was not rewritten and still holds board-material 77 of 961 and protocol 168. That is the PUBLISHED figure. Both are correctly measured. Name the artifact each time either is quoted.

**5.249.0 - THE REGISTER'S MARKER PREDICATE IS NOW A PROPERTY. IT WAS A LIST OF SPELLINGS.** **RULE.** A row that names an instrument must be run by that instrument or must be reported as not run. **DEFECT.** `engine/register_reality.js` carried a `SAFE` predicate. It refused 9 of 124 `VERIFIED BY:` markers. A refused marker took the same verdict as an instrument that fails to start. A ruler defect and a world defect had one label. **SCOPE.** 2 of the 9 register rows that both assert breakage and name an instrument were refused. 22% of the register's live instrument coverage was fictional. **PRIOR FIX.** ROADMAP #521 corrected this class once. It enumerated one wrong form. Nine markers walked past it. **CORRECTION.** `classifyMarker()` replaces the predicate. There is no shell in the path. The tool uses `execFileSync` and never `shell:true`. The rule is that node reads only the tokens before the entry point. That region fails closed. The entry point must resolve inside the repository. Tokens after the entry point are inert by construction. `--arm middle` and `--arm=middle` are one fact. 22 hostile strings are still refused. **REGRESSION.** 124 markers. 115 identical argv. 0 moved. 0 lost. The selftest moves 58 to 73.

**5.249.0 - THE REMOVED GUARD WAS FICTIONAL, AND ONE COUNT WAS SUMMING TWO DEFECTS.** **DEFECT 1.** The old guard's comment said bare values were refused to keep game-playing runs out of the register pass. Measured on the pre-fix bytes, `--arm=middle`, `--stage=moves` and `--games=1200` were already admitted. The guard was a spelling guard and not a cost guard. **DEFECT 2.** In the last published artifact all 27 rows counted as an unrunnable instrument were refused markers. **CORRECTION.** `engine/quarantine.js` reports `MARKER REJECTED` apart from `unrunnable`. Each has its own count, its own sentence and its own per-row verdict. The selftest moves 210 to 216 passed with 0 failed. All six new arms were shown red first on four separate deliberate breaks. `tests/test-divergence-composition.js` stayed green and was not edited.

**LIMIT.** `data/register-reality.json` is the 2026-08-27 artifact. It predates the new vocabulary. The live rejected count is 0 because the artifact has not been regenerated. Regeneration is blocked on an undecided question.

**5.249.0 - FOUR MARKERS WERE REPAIRED AND ONE WAS DELIBERATELY NOT WRITTEN.** **REPAIRED.** ROADMAP #316, #319, #330 and #526 carried an unexpanded `SHOWDOWN_PATH=...` prefix. The prefix is decoration. Every instrument requires `engine/showdown_path.js`, which resolves the sibling checkout and sets the variable. **PLACEHOLDER.** `--release <id>` was removed and not filled in. `tests/roster.js:145` treats a null release as the newest release. A typed identifier ages out and strands the marker. **WRONG KIND.** The marker on ROADMAP #330 was `data/switchin-order.json`. That is a data file and not a command.

**REFUSED — AND THE REFUSAL IS THE RESULT.** ROADMAP #318 is an open row that asserts breakage. Dropping its prefix would produce a marker that reports the row green while the defect the row names is untouched. `tests/roster.js:9167` passes `learnsetMode: 'report'`. 632 learnset refusals go to a printed bucket. They never reach the count that becomes the exit code. No marker was written. The row keeps its `INSTRUMENT OWED` declaration.

**5.249.0 - THE SIDE-SELECTION ALARM WAS ANCHOR DRIFT AND NOT NEW CODE. ONE REAL DEFECT WAS FOUND UNDER IT.** **SYMPTOM.** `engine/side_selection_census.js` read undeclared 84 against a ratchet of 81. Four sites fell outside every hunk of the session's diff. **FINDING.** All four are byte-identical to code classified on 2026-08-29. The expression is the same and the site digest is the same. The census anchor moved. A new branch test was inserted above two sites. The enclosing function drifted 1,660 lines against a 1,500-line search window for the other two sites. Three declarations expired for lines that did not change. **VERIFICATION.** All four verdicts were re-derived from the authority. All four are correct. Undeclared moves 84 to 80. The ratchet is met. The check exits 0. **CORRECTION.** A new `ANCHOR-DRIFT` verdict names the expired key. The row stays undeclared and still counts against the ratchet. The verdict was shown against a control. It flags those four sites and none of the other eighty. **DEFECT FOUND.** The foe-side box in `sweepField` is read only by Defog and by Tidy Up. The fourth site's own note named the wrong line. The live Defog target-side defect is at `engine/medicham2-browser.js:26471`. It is owed.

**NOT WRITTEN AND NOT RUN.** `data/policy-weights.json` was not written. MAG stays paused. `data/game-differential.json` was not republished. The instrument half of the confusion defect is open in `engine/game_differential.js` and is worth all 14 games. 80 side selections remain undeclared. Four newly-runnable markers are heavy and two rewrite gate inputs, so the full register pass must not run beside a live agent until an owner decides.

**5.248.0 - THREE DEFECTS ARE CORRECTED IN `engine/medicham2-browser.js`. BOARD-MATERIAL WHOLE-GAME DIVERGENCE IS 61 OF 961 BEFORE AND 50 OF 961 AFTER.** **RULE.** A whole-game figure must name the artifact that holds it. **MEASUREMENT.** Protocol first-divergence is 161 before and 150 after. VOID is unchanged. The mechanics census is level throughout. The engine release is `f3504e5f88d6` before and `9b449a41c865` after. All other pins are identical. Four predictions were written before the run. All four are correct. **DEFECT 1.** Sucker Punch did not fail into a redirector. This engine evaluated the refusal against the ORIGINAL aim and redirected 137 lines later. The authority redirects FIRST (`sim/battle-actions.ts:467` to `sim/pokemon.ts:835`) and then runs `onTry` on `targets[0]`, so its `willMove` question goes to the Follow Me user and the move prints `-fail`. The probe is red first at `p1.party.maushold.hp`, this engine 62 against the authority 149, and identical after. The queue clause of ROADMAP #403 is intact: arm 4 is the control over it and is green in both knob states. **DEFECT 2.** The `stall` die of an Encore'd Protect ran as two independent coins. This engine addressed the die `...|any|crunch|p10`. The authority addresses it `...|any|protect|p20`. The two logs were read side by side BEFORE any edit. The die is shared after the fix. **DEFECT 3.** A contact ability transfer announced on the wrong body. The probe is red first at `boosts.atk`, this engine 0 against the authority -1, four times. The writes were already correct. The announcement body was not correct, and two `Start` events were absent. **PROBES.** `tests/probe_sucker_redirect_refusal.js`, `tests/probe_encore_stall_address.js` and `tests/probe_contact_ability_transfer.js`. `tests/staged_board.js` reads 25 of 25. `engine/quarantine.js --selftest` reads 210 passed and 0 failed. **LEAF ATTRIBUTION.** No changed divergence family increased. `active[].stall` moves 11 to 5. `party.ability` moves 2 to 0. `active[].vol.encore` moves 1 to 0. `pp[].ragepowder` moves 1 to 0. `boosts.atk` moves 5 to 3 on both sides. **INSTRUMENT.** `tests/probe_leaf_widening.js` measures the engine now. It calls `effSpeed` out of the frozen release the game is played on, twice per body, against the authority's `getStat('spe')` modified and unmodified. On its own fixture a body that lost its item and does not carry the ability reads `effSpeed 122<-122 x1` and does not register. A body that carries the ability reads `344<-172 x2` and does register. The probe was shown red twice before it was trusted. The engine half of ROADMAP #535 is measured: a body handed the ability's spelling with its hand already empty reads `effSpeed 244<-122 x2`, so the doubling follows the CURRENT ability. The authority half stays `INSTRUMENT OWED`. **STATUS.** The gate is red. No model was fitted and no weight vector was written.

**NOT WRITTEN AND NOT RUN.** `data/policy-weights.json` was not written. MAG stays paused. `node engine/status.js --write` was not run. The `<!-- GENERATED -->` blocks in the division ledgers are one pass behind. Cutting the new engine release stranded pinned artifacts: `engine-diff`, the roster stages and `all-mechanics-fire` name a release the tree has moved past. Those clauses are WITHHELD until they are regenerated. This is the pin guard in operation. It is not a regression.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE.** `data/verification/fix-batch-M5M7M8.json` holds board-material 50 of 961. `data/game-differential.json` was not rewritten and still holds 77 of 961. That is the PUBLISHED figure. Both are correctly measured. Name the artifact with the figure.

**5.248.0 - THREE FINDINGS THAT ARE NOT ENGINE DEFECTS.** **FINDING 1.** A probe can pass because the mechanic never ran. The first fixture for defect 3 had the holder clicking Protect, so the contact move reached `onDamagingHit` on NEITHER engine. The two boards agreed about a mechanic that did not fire. A counter reported it. The boards could not. **FINDING 2.** `--out` without `--write` writes no file and exits 0. This is the ninth command of the class that succeeds and does nothing. **FINDING 3.** `engine/side_selection_census.js` exits 1. Undeclared side selections are 84 against a ratchet of 81. The four new sites are `:29955`, `:29973`, `:35133` and `:35142` in `engine/medicham2-browser.js`. All four are outside every hunk of this session's diff. They arrived in earlier commits and nothing ran the check. **FINDING 4.** 9 of 124 `VERIFIED BY:` markers are refused by the `SAFE` predicate of `engine/register_reality.js` and read as `NOT_STARTED`. The row names an instrument, the tool declines to run it, and the row is neither verified nor reported as unverified. ROADMAP #521 corrected this class once and corrected only the `-r <preload>` case. **TRIAGE.** About 60 checks that nothing runs were triaged. RUNNABLE NOW is 0. NEEDS A BASELINE CHOICE is 65. NOT A CHECK is 1. 63 of the 66 load a simulator and the simulator was moving, so none was wired. Unaccounted moves 66 to 63. The PENDING-WIRE audit gives 0 of 36 wireable, 34 blockers still true and 2 texts corrected.

**5.247.0 - THREE DEFECTS ARE CORRECTED IN `engine/medicham2-browser.js`. BOARD-MATERIAL WHOLE-GAME DIVERGENCE IS 77 OF 961 BEFORE AND 61 OF 961 AFTER.** **RULE.** A whole-game figure must name the artifact that holds it. The next paragraph names both artifacts. Do not quote a whole-game figure without one of those names. **PINS.** The engine release is `8ad06030e129` before and `f3504e5f88d6` after. The census pin, the team-pool pin, the driver and the game count are identical on the two runs. The three fixes are thus the only variable. **SECOND QUANTITY.** Protocol first-divergence is 168 before and 161 after. This quantity reports and does not gate. Do not add it to the board figure. **DEFECT 1 - MULTI-ACCURACY VOLLEY.** A `multiaccuracy` move rolls accuracy one time for each arrival. The move stops at the first miss. This regulation contains two such moves, Triple Axel and Population Bomb. The membership is derived from the format. It is not recalled. This engine landed a different number of arrivals. The probe is `tests/probe_multiaccuracy_address.js`. **DEFECT 2 - NON-PERMANENT FORME REVERT.** `clearVolatile` ends with `setSpecies(baseSpecies)` (`sim/pokemon.ts:1564`). A non-permanent forme thus reverts when the body leaves the field. This engine kept the forme. The probe is `tests/probe_nonpermanent_forme_revert.js`. Its control is a body whose forme IS permanent. That control must not revert, and it does not. **DEFECT 3 - CHOICE LOCK NOT CLEARED.** The `choicelock` volatile was never cleared. The protocol does not narrate this leaf. A protocol comparison could thus not see the defect. The probe is `tests/probe_choicelock_cleared.js`. The `choicelock` divergence family is 5 before and 0 after. **METHOD 1 - A DIAGNOSIS CARD IS RELIABLE ABOUT LOCATION AND UNRELIABLE ABOUT CAUSE.** The card gave the correct location three times. It gave the wrong cause two times. For defect 1 the addresses were the same on both engines, eleven of eleven, before and after the fix. The true cause was the accuracy VALUE. The proof is arithmetic on the shared die. The proof was made before any line was changed. For defect 2, two of the three named bodies were already correct on the switch-out road. This is the same result for thirty-two batches. **METHOD 2 - THE PREDICTION WAS WRITTEN BEFORE THE RUN. IT SCORED TWO OF THREE.** The board figure was called at 60–70 and measured 61. The protocol figure was called at about 162 and measured 161. The third counter was called at 0–2 and did not move. The miss is recorded. A prediction without recorded misses is not a prediction. **METHOD 3 - THE LABORATORY FOUND A REGRESSION THAT THE PINNED POOL COULD NOT SEE.** The first form of the defect 3 fix moved the mechanics census from 829 to 828. The pinned pool measured the same on both forms of the fix. The fix was made narrower. The census returned to 829. Two scoreboards are necessary for this reason. **OPEN ITEMS.** The `active[].species` counter did not move. The remaining cause is the TIMING of the forme flip. It is not the revert. No probe covers it. The largest unexamined disagreement class is an accuracy case for Parting Shot. A fourth planned fix is not started. It stays fenced until it is split. **A FOURTH CHECK COULD NOT RUN.** `tests/test-artifact-rerunnable.js` stopped at the default heap in the middle of its audit. It thus blocked commits with a partial verdict, and that partial verdict was worse than the true result. With the heap set, the check is green. The true fault was in `.githooks/pre-commit`. That hook ran its gate loop with bare `node` and ignored the heap declaration. Every gate in that loop had the same fault. The hook now reads each script's own declaration.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE.** `data/verification/fix-batch-M1M3M4.json` holds board-material 61 of 961. `data/game-differential.json` was not rewritten and still holds 77 of 961. Both figures are correctly measured. Only the second one is published. State which one you quote.

**5.246.0 - THE UNBURDEN ENGINE DEFECT REPORTED IN 5.245.0 IS RETRACTED. THE PROBE WAS WRONG.** **RULE.** An instrument must compare the engine's value with the authority's value. An instrument must not compare its own value with the authority's value. **RETRACTION.** The 5.245.0 block below says: *"`effSpeed` computes the doubling from `_hadItem && !m.item` at line 14770. Every body that loses an item therefore gets the doubling."* That is not correct. The block stays as it was published. This note replaces it. **THE CODE.** Line `14770` is the entry guard only. The next line, `14772`, applies the multiplier. That line is gated on `TAGS.param('ability', m.ability, 'speedOnItemLoss')`. Only an ability with that tag gets the multiplier. **THE DATA.** A walk of the ability block of `data/tags.json` gives one key with that parameter: `unburden`. **THE CONTROL.** A census control on record gives `ability none 187,187` for the arm that must not move. It gives `Unburden 187,374` for the arm that must move. **THE CAUSE OF THE ERROR.** `tests/probe_leaf_widening.js:277` holds `const stand = m => (m && m._hadItem && !m.item) ? 1 : 0`. The probe compared that value with the authority's `unburden` volatile. It did not read the engine's Speed. An agreement therefore showed only that both bodies had lost an item. The probe could not show a multiplier, or the absence of one, in either direction. **THE REMAINING DEFECT.** ROADMAP #535. The engine computes the doubling from the body's current ability. The authority grants a volatile at the moment the item goes. An ability that arrives after the item is lost therefore doubles the Speed in this engine and does not double it in the authority. Skill Swap is the reachable door. The row is filed `INSTRUMENT OWED`. No instrument decides that defect now. **REGISTER.** Six rows were filed for defects that existed only as prose. The register moves from `497` rows to `503` rows, and from `251` open to `257` open. One row carries a `VERIFIED BY`. Five rows say `INSTRUMENT OWED`. **THE WORDS IN A REGISTER CELL ARE EXECUTABLE.** `engine/quarantine.js:1040` matches `NOT A DEFECT` in a row's status cell. It reads the match as a ruling that overrides the derived verdict. The phrase was therefore used in none of the six rows. **STATUS.** This version fixes no engine defect and publishes no new measurement. `node engine/status.js --write` was not run.

**5.245.0 - `engine/quarantine.js` GATES ON BOARD-MATERIAL GAMES, AND NARRATION IS A SEPARATE CLAUSE THAT REPORTS.** **RULE.** Will gave the rule on 2026-08-22. Commentary can differ. Boards cannot differ. The gate must therefore count the games whose BOARD parts. **DEFECT.** The whole-game clause counted `j.diverged`. That field holds the protocol first-divergence count. The clause printed 167 of 961. The board-material count sat unread in the same artifact at 77 of 961. The clause did not measure the quantity it published. **CHANGE.** The gating clause now computes `state.games` less `state.games_board_never_diverged`. This is 961 less 884. The result is 77 of 961, or 8.0%. A new clause, `narrationClause`, counts protocol first-divergence. It reads 167 of 961. It carries `gates: false`. It does not hold the gate shut. It has a row, a count and a place in `failing`. The command `node engine/quarantine.js --narration` exits 1 while that clause is red. A wrapper applies `gates: false` to every return path of that clause, including each refusal path. A refusal that lost the flag would default to gating. **NAMING.** Each clause states its quantity in its first words. Each clause carries a `quantity` field. The two values are `board_material_games` and `protocol_first_divergence_games`. Do not read the two numbers as one quantity. **DERIVED FIGURE.** 11 of the 77 games part a board while the protocol does not diverge. The clause derives this figure from four artifact fields. The expression is `material - (protocol_diverged_games - protocol_diverged_board_never_did)`. This is 77 less (168 less 102). The clause does not clamp a negative result. A negative result means that the artifact contradicts itself. The earlier single clause did not count these 11 games at all. **RESULT.** The gate reads `CLOSED - 1 of 8 GATING clauses fail`. **COMPARATOR.** `engine/board_state.js` now compares three more per-body volatiles. They are `throatchop`, `mustrecharge` and `flashfire`. The compared-leaf count is 37 of 80. It was 34. The unread hole is 39. It was 42. The 961-game differential did not move. Board-material reads 77 before and after. Protocol first-divergence reads 168 before and after. The engine release id is unchanged at `8ad06030e129`, because `engine/board_state.js` is not one of the 26 frozen sources. A flat result does not prove that these three leaves are clean. The artifact records divergences. It does not record per-leaf agreements. **CORRECTION TO AN EARLIER CLAIM OF THE SAME DAY.** The widening does not generalise as a whole. The comparator side generalises: each leaf needs two lines, and `SD_VOLATILE_KEYS` derives itself. The fixtures do not generalise. Each fixture is a script written against the authority's own refusals. **ENGINE DEFECT, FILED AND NOT FIXED.** `engine/medicham2-browser.js` holds no state named `unburden`. `effSpeed` computes the doubling from `_hadItem && !m.item` at line 14770. Every body that loses an item therefore gets the doubling. The authority grants the volatile only from Unburden's own `onAfterUseItem` and `onTakeItem` handlers. This defect is owed a register row. **PINS.** Five artifacts were regenerated. They are `engine-diff`, the three roster stages and `all-mechanics-fire`. Each one carries 26 `source_digests` and a `showdown_commit`. `engine/pin_guard.js` withholds a figure when the pin is absent, wrong or unverifiable. No measured figure moved. The damage differential reads 0 of 6000 at the midpoint and at both corners. The roster reads 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three stages. The mechanics verdicts are identical row for row. **DEFECT IN A GUARD ADDED THE SAME DAY.** The coverage-arm refusal in `engine/game_differential.js` ran at module load. It read the argv of the whole process. `tests/roster.js --write` and `engine/all_mechanics_fire.js --write` then exited 2 before they played a game. Exit 2 is the SKIP code. The runner would have reported a skip and not a failure. The guard now tests `require.main === module`. **HOW TO REPRODUCE.** Run `node engine/quarantine.js --selftest`. It must read 210 passed, 0 failed. Run `node engine/quarantine.js --whole-game`. It must name BOARD-MATERIAL in its first words. Run `node engine/quarantine.js --narration`. It must name protocol first-divergence, and it must exit 1 while red. Run `node tests/test-divergence-composition.js`. It must read 18 checks passed. **NOT RUN.** `node engine/status.js --write` was not run. The generated blocks in the division ledgers are one pass behind. `data/policy-weights.json` was not written.

**5.244.0 - `engine/sweep.js` REPORTS WHAT EACH INSTRUMENT DOES NOT CHECK ABOUT ITSELF.** **RULE.** An instrument must be able to report its own blind spots. A fact that is derived and not read is not a control. **DEFECT (the class).** Three facts were derived and were not read. `engine/status.js` printed `driver policies the gate quotes — 1 of 2` on line 103 of a 253-line output. `engine/durable-ingest.js:464` explained the archive drift in a comment. That comment gives the instruction *"RUN THIS BEFORE ANY REPARSE"*. `tests/run-all.js` was red on its own unaccounted-checks clause. No consumer read any of the three. **CORRECTION (CLASS-level).** `engine/sweep.js` is new. It has five derived sections. It runs in about three seconds. It exits 1 on any finding. **RESULT.** The first run reports 60 checks that nothing runs. It reports 3 of 8 clauses that are blind to their own staleness. It reports 12 published figures that are out of date. It reports 783 of 1,048 counter fields that nothing reads. It reports 614 store rows with no raw log. **PROOF OF THE INSTRUMENT.** Each `CANNOT DERIVE` path was shown red with `SWEEP_BREAK=1..5` before the tool was trusted. **HOW TO REPRODUCE.** Run `node engine/sweep.js`. **MUTATION TESTING IS PILOTED ON THE GATES.** **RULE.** A test must fail when the thing it tests is wrong. **DEFECT.** The engine has an external oracle. The gates have no oracle. A gate that read `8 of 8 PASS` was false and stayed green. **CORRECTION (CLASS-level).** Use `tools/mutate-gates.js` with `stryker.gates.conf.json`. **RESULT.** There were 83 mutants. 57 were killed. 26 survived. The run took 28s. A surviving mutant is a clause that can fail without an observer. **THE RAW LOG IS THE SOURCE OF TRUTH. THE STORE IS A DERIVED VIEW.** **RULE.** Keep the artifact that cannot be made again. The store can be made again from the raw log. **DEFECT S1.** `engine/durable-ingest.js:543` applied the completeness filter before the archive write. A game that the current parser could not read lost its raw log. **DEFECT S2.** The store row was written before the log. The two streams were independent. A crash left an orphan row. **DEFECT S3.** The archive was one compressed blob. **DEFECT S4.** `get()` resolved an empty string for an HTTP error, for a timeout and for an empty body. Three facts had one value. **CORRECTION.** S1 and S2 use two passes through one exported function, `archiveThenStore()`. The store output is byte-identical. S3 writes dated write-once shards. S4 returns null on failure. The discriminator is derived from the endpoint. **RESULT.** 7,275 raw logs were recovered. 6,661 are ladder logs. 614 are bo3 logs. 0 are unavailable. 0 have no timestamp. Both archives are complete supersets. `MODE=reparse` is unblocked. **A PRIOR ESTIMATE IS SUPERSEDED.** An earlier note gives the blob about 65 days. That estimate is wrong. Compression is 13.98%. A single blob is 78 MB across both archives today. That is 78% of the 100 MB limit. **CAUTION.** A `-2` collision suffix sorts before `.jsonl`. This replays an append-only archive out of order. Do not add a numeric suffix to a shard name. **ONE GUARD ASSUMED EQUALITY AND THE ARCHIVE IS NOW A SUPERSET.** **RULE.** The archive holds logs that the store does not hold. **DEFECT.** `engine/rebuild_records.js:117` compared counts. It would refuse a valid rebuild. It also let a bad rebuild through. With a truncated log the counts balanced 3 == 3. It swapped in a corrupted store at exit 0. In a second arm it lost a game. **CORRECTION.** It filters on completeness. It asks the guard by id. It names each game that would be lost. **THE DIGEST DERIVES ITS HASHED FIELDS.** **RULE.** A digest must cover every field that the consumer reads. **DEFECT.** The 5.242.0 repair named two fields. A named list is INSTANCE-level. A field that is added later is not hashed. **CORRECTION (CLASS-level).** The hashed set is derived from the rows' keys. A declared exclusion map of six entries is subtracted. **SECOND DEFECT, FOUND BY THE DERIVATION.** An absent field hashes as an empty field. Deletion of a full moveset moved nothing. This was live on 4 rows for `mv`. It was live on 10 rows for `item`. **RESULT.** The digest value does not change. It is `9d289cf77e24`. No third reason to restamp is created. **A KEY GATE HAD FIVE LIMITS.** **DEFECT.** `tests/test-artifact-keys.js` sliced to 8 keys. It capped depth at 3. The deepest real object has depth 10. It did not descend arrays. It iterated a hard-coded list of two names. It exited 0 when the engine data did not load. **CONSEQUENCE.** `MC.priors` has 230 keys. It was never inspected. **THE COST ARGUMENT WAS FALSE.** A full walk takes 733ms. The truncated walk takes 596ms. **CORRECTION.** It walks fully. It fails when a budget is hit. It does not truncate. It prints its out-of-scope set. That set is 5,466 `.json` files in 12 directories. **REPORTED AND NOT FIXED.** There are 13 undeclared tables. **ONE REGRESSION WAS CAUSED BY THIS PASS.** `tests/test-divergence-composition.js` uses two synthetic fixtures. The fixtures carry no steering block. The 5.243.0 refusal fires on them. **CORRECTION.** The fixture reads the constant from `engine/steering.js`. A third arm asserts the refusal. Without that arm the repair would delete coverage of the new branch. **THREE CHECKS COULD NOT RUN.** They gave exit 134. They were out of heap. No heap ceiling was declared. **RESULT WITH A CEILING.** `tests/test-engine-release.js` gives 71 passed and 0 failed. `tests/test-set-realism.js` gives 6 passed and 0 failed. `engine/validate_selfplay.js` gives a verdict and one finding. **ATTRIBUTION.** `tests/run-all.js` gives 143 passed and 28 failed. Exactly one failure was caused by this pass. Each red test was re-run at the prior commit in a control worktree. Five tests assert a stale fact. Three were heap ceilings. Twenty were already red. The `test-pin-arms` hypothesis is refuted. The `test-game-differential` hypothesis is refuted. **CAUTION ON COUNTING.** The failure count was reported as 23. It was then reported as 30. The correct value is 28. The first value came from a line count on output that was still being written. Do not count the runner's output during the run. **CAUTION ON A LONG RUN.** One command ran for twenty minutes and did nothing. The exit code did not show this. The CPU time was 2 seconds. A buffering pipeline stage hides a stall. **HOW TO REPRODUCE.** Run `node tests/run-all.js`. It must give 143 passed and 28 failed. **WHAT WAS NOT RUN.** `node engine/status.js --write` was not run. The generated blocks in the division ledgers are one pass behind. The fitted policy weights were not written. MAG stays paused. `npm install` was not run. The mutation dependency is declared and not installed. **WHAT IS STILL OPEN.** The self-play store holds 89 duplicate ids. `engine/conformance.js` has one unattributed finding. The 13 undeclared key tables are open. The raw-log census artifact asserts the old subset relation and has no generator. Full accounts are in `docs/_reports/2026-09-04-*.md`.
**5.243.0 - `engine/quarantine.js` REFUSES A WHOLE-GAME ARTIFACT THAT A COVERAGE DRIVER PRODUCED.** **RULE.** The whole-game clause compares two engines over complete games. A game that stops at the turn cap is not a complete game. **DEFECT.** The clause read an artifact made by the `census-coverage-seeking/v1` driver. That driver seeks census coverage. It does not try to win. It reached a result in 17 of 961 games. This is 1.8%. It stopped 944 games at the 12-turn cap. It parted 0 boards. The clause reported PASS. The gate reported 8 of 8 PASS. **CONTROL.** The same games were played again. The engine release was `8ad06030e129`. The turn cap was 12. The team pool was `0d103fb9fa87`. The census pin was `9446a684709d`. The count was 961 games of a 1200 PAIR budget. Only the driver changed. The `empirical-click/v1` driver reached a result in 474 of 961 games. This is 49.3%. It parted 77 boards. **CORRECTION.** `data/game-differential.json` is the empirical arm now. `engine/game_differential.js` refuses `--write` without `--out` unless you also give `--steering empirical`. The whole-game clause reads `steering.policy` in the artifact. It withholds the figures if the value is not `empirical-click/v1`. It also withholds them if the artifact has no steering block. The verdict is `MEASURED ON THE WRONG POPULATION`. The `clauseExit` value is 2. The selftest result is 159 passed and 0 failed. **RESULT.** The gate reads CLOSED. 1 of 8 clauses fails. Clauses 1 to 5, 7 and 8 pass. Nothing was tuned. **TWO QUANTITIES. DO NOT MIX THEM.** Board-material divergence is 77 of 961. This is 8.0%. Protocol first-divergence is 168. Always say which one you quote. **HOW TO REPRODUCE.** Run `node engine/quarantine.js`. The gate must read CLOSED. 1 of 8 clauses must fail. **A PRIOR INSTRUCTION IS SUPERSEDED.** The 5.209.0 block below tells you the gate must read OPEN, 8 of 8. Do not follow that line. It was written against the coverage arm. **WHAT IS STILL OPEN.** The clause prints 167. It gates on protocol first-divergence less one declared case. The owner decided on 2026-08-22 that the bar is board-material. The figure the clause should read is therefore 77. This was not changed in this pass. A change to the count in the same pass that made the gate red is not distinguishable from tuning. The owner must decide it. **WHAT WAS NOT RUN.** `node engine/status.js --write` was not run. The generated blocks in the division ledgers are one pass behind. `data/policy-weights.json` was not written. MAG stays paused.
**5.242.0 - `engine/feature_fixture.js` `tableDigest()` HASHES `m.t` AND `m.wt`.** **RULE.** The damage table spells typing `t`. The table carries no field named `ty`. **DEFECT.** `tableDigest()` hashed `m.ty`. The field `m.ty` is present on 0 of 322 rows. The term thus gave a constant `null`. The digest could not see a type change. The function did not hash `m.wt` at all. The digest could not see a weight change. Weight is a damage input. These read weight or change it: Low Kick, Grass Knot, Heavy Slam, Heat Crash, Heavy Metal and Light Metal. **PROOF OF THE DEFECT.** Change `t` on one row in memory. The digest does not move. Change `wt` on one row. The digest does not move. Change `mv` and then `st` on one row. The digest moves both times. This is the control. It shows that the method can detect a change. After the fix, all four fields move the digest. **SECOND CONTROL.** An absent field hashes as `null`. A field that is present and empty also hashes as `null`. The output does not separate these two states. Add a `ty` field to one row. The digest moves before the fix. The term was thus live in the hash. The data had never filled it. Use a mutation test to separate the two states. Do not use inspection of the code alone. **ENGINE.** The function now hashes `m.t` and `m.wt`. Keep the term order append-only. The diff then reads as one repaired term and one new term. Do not hash `nature` or `sp`. They reach the damage formula through `st`. The function hashes `st`. Do not hash the four provenance fields. **EXPORT.** `tableDigest` is exported. The probe calls the exported function. Do not copy the function into a probe. **MEASURED.** The digest moves `1bda9df11d73` -> `9d289cf77e24`. The table itself does not change. `tests/test-feature-semantics.js` gives 24 passed and 0 failed. **GATE.** `engine/status.js` parses the printed output of the gate. The output shape is unchanged. The gate still matches `FEATURE SEMANTICS CHECK FAILED`. It still exits 1. The verdict is unchanged. The `how:` string stays byte-identical to the one stamped in `docs/MEASURE.md`. **STALENESS.** The stamp in `data/policy-weights.json` is stale for two independent reasons. The table was regenerated from 318 to 322 species. The ruler also changed. One restamp absorbs both reasons. You cannot separate them after that restamp. The CHANGELOG records the distinction. **NOT RUN.** No restamp was run. No refit was run. This is the owner's decision, not an omission. MAG stays paused until MEDICHAM is correct. MEDICHAM is upstream of the weights. `data/policy-weights.json` was not written. Full account: `docs/_reports/2026-09-03-table-digest-blind-fields.md`.
**5.241.0 - `medicham2-browser.js` DRAWS A CRIT FOR THE DELAYED PAYOUT, AND `_reDealt` TAKES AN EXPLICIT CEILING.** **RULE (delayed hit).** `data/conditions.ts:415` gives the delayed payout to `trySpreadMoveHit`. The payout thus takes the full step list. The crit step is `sim/battle-actions.ts:1156` -> `:1636-1642`. The table is `critMult = [0,24,8,2,1]` at `:1633`. The multiplier is x1.5 at `data/mods/champions/scripts.ts:222`. The message is the `|-crit|` line at `:285`. Champions has no `futuremove` key. This is read from the mod, not remembered. **DEFECT (delayed hit).** The payout drew damage only. It drew no crit. The engine could not crit a delayed hit at any rate. **PROOF OF THE DEFECT.** Give the two engines a crit-certain die. Then give them a crit-impossible die. The authority answers 72 with the `-crit` line, then 48 without it. This engine answers 69 both times. The counter `delayedHitCritDrawn` reads 0. An output that does not change when the input changes shows an unwired knob. It does not show a rare event. **ENGINE (delayed hit).** The residual block now takes one crit draw. It takes the draw unconditionally. An arm with Shell Armor and an arm without must spend the same stream. The draw uses the same crit owner as the direct click. The hit is then re-priced as a certain crit. Do not multiply the result. The authority applies the x1.5 above the randomizer, the STAB step, the type chart and the burn step. A late multiply is the wrong stage. The `-crit` line is written between the effectiveness line and the damage line. **RULE (substitute).** `data/moves.ts:18341-18357`. There is no override in `data/mods/champions/`. The authority clamps the damage to the remaining HP of the doll. It clamps before it writes `lastDamage`. Recoil and drain read the clamped value. Nothing pays the value twice. **DEFECT (substitute).** This engine clamped to the current HP of the BODY. It did this sixty lines above the substitute branch. The ceiling was thus never the doll's. An overkill into a doll paid recoil -25 where the authority pays -12. It paid drain +62 where the authority pays +21. **ENGINE (substitute).** `_reDealt(nd, cap)` now takes an explicit ceiling. The default ceiling keeps the two existing callers identical. The substitute branch passes the pre-hit HP of the doll. There is one helper and three callers. Two implementations of "how much did this deal" are a facts-are-global breach. **COUNTERS.** `MEDSEEN.delayedHitCritDrawn`, `MEDSEEN.delayedHitCrit`, `MEDSEEN.subDealtCapped`. `subDealtCapped` is kept apart from `dealtReReadAfterClamp`. The two ceilings are facts about different bodies. **KNOBS.** `MEDI_DELAYED_HIT_NO_CRIT=1` and `MEDI_SUB_DEALT_UNCLAMPED=1`. Each knob restores one defect. Do not put two defects on one knob. A shared knob cannot attribute them. Neither knob is shared with `MEDI_DEALT_BEFORE_CLAMP`. **INSTRUMENTS.** `tests/probe_delayed_crit.js` and `tests/probe_sub_clamp.js`. Each probe was RED before the fix. The controls were green at the same time. Each probe is RED again under its own knob. The delayed-crit probe failed on the delayed row only; both control rows stayed green. The substitute probe failed on the two overkill arms only; both wide-doll controls agreed number for number before the fix. **A CENSUS ROW WENT RED FOR A FIXTURE REASON.** `rngStreams` aliased one plain function onto all seven streams. The band row's bucket 0 therefore drew a value below the 1/24 crit rate as soon as the payout started drawing a crit. The row's `rng` is now a split struct that pins `crit`. The other fifteen buckets are byte-identical. A row that fails when a NEW die reaches it is a fixture fault. Do not read it as a regression. **MEASURED.** Census 827 -> 829 live / 829 probed / 0 missing / 0 hollow / 0 threw / 0 unarmed. **NOT MEASURED.** The pinned pool was not run. Do not quote a pool movement for this release. The machine was in light mode. The command is in the report OWED block. **DECLARED REMAINDER.** The drain on the substitute road uses `Math.ceil` in the authority and `Math.round` here. The two agree on every 1/2-fraction move in this format. They part on the 3/4 fraction of Draining Kiss. This is a different line and is on the hand list. **TWO INSTRUMENT NOTES.** `engine/feature_fixture.js:741` hashes `m.ty`. The field `m.ty` is present on 0 of 322 rows; the types are in `t`. The field `wt` is not hashed. The digest therefore cannot see a type change or a weight change. Do not fix this before the restamp. The fix moves the digest. **The damage-table verdict is RESTAMP, not refit.** All 91 touched rows are megas or in-battle formes. The fields `st`, `bs`, `t`, `item` and `ab` moved on zero rows. There are 76 mega moveset rewrites. `engine/board.js` has two `buildMon` call sites, at `:1466` and `:3956`. The first is overwritten by the sheet moves. The second is given base-species names. The mega `mv` thus reaches 0 of 16,830 corpus games. The upper bound on games touched at all is 12 of 16,830 (0.07%). Full accounts: `docs/_reports/2026-09-03-crit-draw-and-substitute-clamp.md`, `docs/_reports/2026-09-03-damage-table-refit-verdict.md`.
**5.240.0 - `medicham2-browser.js` READS `electricterrain.condition`'s `onSetStatus` AND `onTryAddVolatile`.** **RULE.** `data/moves.ts`, `electricterrain.condition`, no Champions override (no `electricterrain` key in `data/mods/champions/moves.ts` or `conditions.ts`): `onSetStatus` refuses when `status.id === 'slp' && target.isGrounded() && !target.isSemiInvulnerable()`, announcing `-activate|TARGET|move: Electric Terrain` when `effect.id === 'yawn' || (effect.effectType === 'Move' && !effect.secondaries)`; `onTryAddVolatile` returns null on `yawn` for the same body, with the same line. **ENGINE.** One predicate, `eTerrainRefusesSleepOn(t)`: reads the field off `t._sf._S.field` (the road ROADMAP #213's Leaf Guard arm already takes), `terrainId(...)==='electric'`, `isGrounded(t)`, and `t._invuln && t._charging && TAGS.has('move', t._charging, 'semiInvulnerable')`. Called from `applyStatus` below the Safeguard `sideBuffRefuses` block and from the `a.kind==='yawn'` branch below `allyRefusesVolatile` and above `shieldRefuses`. The announce gate is DERIVED, not typed: `formatSecondaryCount.count` on the tag row is `effect.secondaries.length`. **THE `-fail` OVER-FIRE.** The direct-status announcer writes `TR.fail(t)` for any refusal it cannot name and the authority writes none here; `why.reason='terrain'` plus a matching branch (`MEDSEEN.statusRefusedByTerrain`) stops it. **COUNTERS.** `MEDSEEN.terrainRefusedSleep`, `terrainRefusedYawn`, `terrainRefusalAnnounced`, `statusRefusedByTerrain`; `MEDFAILS.terrainStatusFieldUnknown` (no side stamp - declines to refuse and counts, rather than reading 'no terrain') and `terrainRefusalSecondaryUnknown` (announces and counts). **KNOB.** `MEDI_ETERRAIN_ALLOWS_SLEEP=1` restores both halves, stamped into `MEDFAILS.eTerrainSleepAllowedRestored` and registered in `tests/test-mechanics.js` `DELIBERATE_BREAK`; one knob over the pair, because the two handlers were absent together and no measurement needs to attribute one without the other. **INSTRUMENTS.** Two `probe('move','setsTerrain',...)` census rows, each asserting the board AND the protocol line, with a clear-field control, a wrong-terrain control, an airborne-target control and (on the status probe) a Will-O-Wisp control. **MEASURED.** Census 825 -> 827 live / 827 probed / 0 missing / 0 hollow / 0 threw. Whole-game differential on release `53e3e90dce8d`, census pinned `9446a684709d`, pool `0d103fb9fa87`: board-parted 77, protocol 168, causes 146, end-state 910/49/1/0/1 - identical across a knob-armed before-arm and the after-arm, with `classes`, `first_divergences`, `coverage`, `state`, `end_state` and `credit` byte-identical. `tests/test-engine-diff.js` 6000 compared / 6000 agreed / 0 disagreed, seed 20260804.
**5.239.0 - `medicham2-browser.js` WIRE 68 LAYS ITS HAZARD ON THE HOLDER'S FAR SIDE, AND THE `setsWeather` GUARD IS `field.weather !== w`.** **RULE (E1).** `data/abilities.ts:5096`, no Champions override: `const side = source.isAlly(target) ? source.side.foe : source.side;` - both branches are the side opposite the TARGET in a two-side game. **ENGINE (E1).** `layHazard(m._sf, ..., m._sf.side==='A'?'p1':'p2', ...)` becomes `_punHzOn`, derived from `tg._sf._S` (the back-reference `battleInit` writes: `S.sfA._S=S; S.sfB._S=S;`) as `_os===_SS.sfA?_SS.sfB:_SS.sfA`; the protocol label is read off `_punHzOn` itself so state and line cannot disagree. **RULE (E2).** `data/abilities.ts:3978` is `onDamagingHit(){ this.field.setWeather('sandstorm'); }` with no gate; `sim/field.ts:45-52` returns false only when `this.weather === status.id` and `sourceEffect.effectType === 'Ability'` and `gen > 5`. Desolate Land / Primordial Sea / Delta Stream block `SetWeather` and have zero legal carriers in this regulation, so no primal branch is represented. **ENGINE (E2).** `if(_pun.setsWeather && !field.weather)` becomes `if(_pun.setsWeather && field.weather !== weatherId(_pun.setsWeather))`, which is the same predicate `applyMoveWeather` and the `weatherSetter` entry block already use. **COUNTERS.** `MEDFAILS.punishHazardNoFarSide` - a hazard punish on a body whose side field carries no `_S`; the layer is NOT laid and the miss is counted rather than falling back to the attacker's side. **KNOBS.** `MEDI_HAZARD_ON_ATTACKER_SIDE=1` and `MEDI_PUNISH_WEATHER_IF_CLEAR=1`, stamped at declaration into `MEDFAILS.punishHazardOnAttackerSideRestored` / `punishWeatherIfClearRestored` and registered in `tests/test-mechanics.js` `DELIBERATE_BREAK`, so a run under either refuses to write `data/mechanics-census.json`. Two knobs, because the 2x2 that separates the two causes needs to move them independently. **INSTRUMENTS.** `tests/probe_punish_side_and_sky.js` - five scenarios x two ability arms against the official simulator under the differential's `bottom-tie-first` pin, comparing each turn's protocol as a sequence and reading layers-per-side and the sky out of each engine's own state at the same instant; the AUTHORITY is asserted to move across every ability knob first. Two `probe('ability','punishesAttacker',...)` census rows. **INSTRUMENT DEFECT FOUND AND CORRECTED HERE ONLY.** Showdown's `|split|` shared half carries an HP-bar colour (`20/100y`, `...r`); the normaliser inherited from `tests/probe_punish_announce.js` had no place for it, so the twin failed to dedupe and produced a phantom `-damage`. Pattern is now `\|\d+\/\d+(\/\d+)?[yr]?( [a-z]+)?`; the ancestor is left alone - false-failure-only, and its fixtures never drive a body below half HP. **SIDE-SELECTION CENSUS.** The old site was one of the 102 and was UNDECLARED; it is now two expressions, `fn:_damagingHit | sfB:sfA | dba899f4` (SIDE) and `fn:_damagingHit | p1:p2 | a034cd87` (READER), both declared. 103 sites, undeclared 83 -> 82. `data/side-selection-census.json` is deliberately NOT restamped: the ratchet floor is the previous artifact's value, so writing it would raise 81 to 82. **MEASURED.** Census 821 live / 821 probed / 0 missing / 0 hollow / 0 threw. Whole-game differential, `--end-state --steering empirical --team-store data/team-pool-frozen --arm middle`, release `cde6cb10daa7`: board-parted 82 -> 80 of 961, protocol 172 -> 171, causes 150 -> 149, end-state 905/53/2/0/1 -> 907/52/1/0/1, against a knob-armed before-arm that reproduces the published baseline exactly.
**5.237.0 - `medicham2-browser.js` `hitChance` COMBINES THE ACCURACY AND EVASION STAGES INTO ONE CLAMPED BOOST, BELOW THE MODIFIER WALK, AND TRUNCATES.** **RULE.** `sim/battle-actions.ts:713-727`: `boost = clampIntRange(boosts['accuracy'], -6, 6)` when `!move.ignoreAccuracy`; `boost = clampIntRange(boost - boosts['evasion'], -6, 6)` when `!move.ignoreEvasion`; then `accuracy = trunc(accuracy * (3 + boost) / 3)` or `trunc(accuracy * 3 / (3 - boost))`. Champions does not override `hitStepAccuracy` - its only `ignoreAccuracy` / `ignoreEvasion` text is at `data/mods/champions/scripts.ts:487` and `:496`, inside `hitStepMoveHitLoop`'s `multiaccuracy` branch. `Dex#trunc` is `num >>> 0` (`sim/dex.ts:391`). **ENGINE.** The old pair `if(_ab)acc*=accStageMul(_ab); if(_eb)acc/=accStageMul(_eb);` is removed from above the `_cat` lookup and replaced, BELOW the Gravity / item / ability `ACCMOD` walk, by `_bst=clamp(_ab,-6,6); _bst=clamp(_bst-_eb,-6,6); if(_bst!==0){const _pre=_bst>0?acc*(3+_bst)/3:acc*3/(3-_bst); acc=_pre>>>0;}`. The relocation is the authority's order (`runEvent('ModifyAccuracy', ...)` precedes the stages) and is load-bearing only because of the truncation. The attacker-ability `ignoresEvasion` consumer that zeroes `_eb` is unchanged and still sits above. **COUNTERS.** `MEDSEEN.accStageCombined` (non-zero combined boost), `accStageBothSides` (both stages non-zero - the only case the old form got wrong by combination), `accStageTruncated` (the `>>> 0` actually discarded a fraction). Three, not one, because the populations differ by orders of magnitude. **KNOB.** `MEDI_ACC_EVA_SEPARATE=1` restores the old pair at the old position and stamps `MEDFAILS.accEvaSeparateRestored` at declaration; registered in `tests/test-mechanics.js` `DELIBERATE_BREAK`, so a run under it refuses to write `data/mechanics-census.json` (verified: artifact digest unchanged across such a run). **INSTRUMENTS.** `tests/probe_accuracy_stage_combine.js` (11 arms, `--red`) wraps `BattleActions.prototype.hitStepAccuracy`, writes the two stages onto the live bodies and captures the argument that call hands to `randomChance(accuracy, 100)`; medicham2 is asked `hitChance`, the function its four roll sites call; each arm then spends a real turn at two dice straddling the authority's number. RED first at 10 assertions over 5 live arms with all 4 controls green. A new `move|accuracyMod` census row sets BOTH stages non-zero on four live arms - every pre-existing accuracy row zeroes one of them - and holds three controls. **CORRECTED.** `ability|accuracyMod - the bot PRICES an evasive body` asserted `0.2667` for an 80-printed move at +6 evasion; the authority rolls against **26**, measured by the `trunc-eva6` arm. **NOT MODELLED, FILED.** `move.ignoreEvasion` (Darkest Lariat, Sacred Sword): `data/tags.json` gives both `ignoresBoosts {defensive:true}`, derived from `ignoreDefensive` and read by the damage chain; no tag carries `ignoreEvasion`. **MEASURED.** `data/mechanics-census.json` 819 live / 819 probed / 0 missing; whole-game differential on release `52e0e7effbd6` identical to its baseline in every figure (`docs/_reports/2026-08-31-accuracy-stage-combine.md`).

**5.236.0 - `medicham2-browser.js` WIRE 103 TAKES `R.arrivals` KING'S ROCK DICE, NOT ONE.** **RULE.** `kingsrock.onModifyMove` pushes `{chance: 10, volatileStatus: 'flinch'}` onto `move.secondaries` (`data/items.ts:3219`) for a non-Status move carrying no flinch secondary of its own; Champions does not override the item. `BattleActions#secondaries` draws `this.battle.random(100)` per secondary per living target (`sim/battle-actions.ts:1343`) and is step 5 of the Champions `spreadMoveHit` (`data/mods/champions/scripts.ts:388`), invoked once per hit by `hitStepMoveHitLoop` (`:518`) under `if (targets.every(target => !target?.hp)) break;` (`:464`). The die is therefore taken once per LANDED arrival and `-hitcount` is the same counter (`hit - 1`, `:550`). **ENGINE.** `_stepApply` now writes `R.arrivals = _packets ? _landed : 1` - one expression shared by `-hitcount` (`R.hitLanded`), `timesAttacked` and WIRE 103. WIRE 103 loops `R.arrivals` draws, counting each in `MEDSEEN.kingsRockRolls`; `MEDSEEN.flinch` increments on the `_flinch` TRANSITION so two passing dice in one volley are one flinch. A row with no arrival count falls back to 1 and increments `MEDFAILS.kingsRockNoArrivalCount`. A fainted row takes no die and adds `Math.max(1, R.arrivals)` to `MEDSEEN.kingsRockRollSkippedOnKO` (declared remainder: `addVolatile` refuses a body at zero, `sim/pokemon.ts:1980`). **KNOB.** `MEDI_KINGSROCK_ONCE_PER_MOVE=1` restores one die per click and stamps `MEDFAILS.kingsRockOncePerMoveRestored` at declaration; registered in `tests/test-mechanics.js` `DELIBERATE_BREAK`, so a run under it refuses to write `data/mechanics-census.json`. **INSTRUMENTS.** `tests/probe_kingsrock_volley.js` (7 arms, `--red`) wraps `BattleActions.prototype.secondaries` and counts King's-Rock-shaped entries per living target per call; expectations come from that count and from `|-hitcount|` on both streams. A second `item`/`addsFlinch` census row counts dice with the rng pinned to 0.5. **MEASURED.** `data/mechanics-census.json` reads 818 live, 818 probed, 0 missing. The whole-game differential on release `b43a2fea0cb1` is identical to its baseline in every figure; the counts and the sample-identity block are in `docs/_reports/2026-08-31-kingsrock-volley.md`.

**5.235.0 - `engine/next_regulation.js` DERIVES THE TARGET FORMAT SET; `engine/next_regulation_ingest.js` COLLECTS IT INTO ONE STORE PER FORMAT ID; `engine/durable-ingest.js` READS THE REGULATION FROM THE TIER LINE.** **DETECTOR.** `next_regulation.js` exports `detect(opts)`, `parseFormatId(id)`, `laterThan(a, b)`, `toID(s)`, `configBlock(res)`, `report(res)` and `VGC_REG`. `detect({ net, active, knownIds })` merges rows from the live client format list (`https://play.pokemonshowdown.com/data/formats.js`, evaluated with `vm.runInNewContext` in a sandbox holding only `exports`, 5 s timeout) and from `Dex.formats.all()` through `engine/showdown_path.js`; `net: false` uses the dex only. A row is kept when `toID(name)` matches `/^gen(\d+)championsvgc(\d{4})reg([a-z0-9]+)$/` after an optional trailing `bo3`, and is rejected when the authority declares a `mod` not matching `/^champions/` or a `gameType` other than `doubles`. `bo3` is decided by `Best of = 3` in the `ruleset` where a ruleset is present, and by the id suffix otherwise; the choice is recorded in `bo3_source`. `open_team_sheets` is `forced`, `optional` or `none`, read from the same ruleset. Each row gets `known` (id present in any `showdownFormat`/`bo3Format` in `data/regulations.json`), `later_than_active` and `classification` in `{known, candidate, superseded}`. `active` and `knownIds` override the config side; they exist so the ordering rule can be varied in a test, because zero candidates is also what an unwired rule produces. **COLLECTOR.** `next_regulation_ingest.js` exports `reconcile(store)`, `ownStores()`, `storeFor(id)` and `collect(id)`. Flags: `--dry-run`, `--format <id>` (rehearsal override), `--reconcile` (no network), `--no-net`, `--no-write`, `--force-write`. `storeFor(id)` is `data/games.<id>.jsonl`; `collect(id)` spawns `engine/durable-ingest.js` with `FORMATS=<id>` and reads its report from STDERR (`spawnSync`, not `execFileSync`, which returns stdout and gave a blank progress line on a run that collected 51 games). `reconcile(store)` unions the `.gz` and the plain store keyed by `"id":"..."`, first occurrence winning, refuses a path ending in `.gz`, refuses to write a result smaller than it found, and rewrites both files. `ownStores()` discovers `games.<id>.jsonl` AND `games.<id>.jsonl.gz`, excludes every id in `data/regulations.json`, and always returns the PLAIN path. **ARTIFACT.** `data/next-regulation.json` carries `generated`, `by`, `source_digests` (via `engine/run_stamp.js`, so `engine/provenance.js` verifies it by CONTENT), `mode`, `detection`, `counters`, `collected`, `reconciled`, `problems`, `signature` and a `note`. It is rewritten only when `signature` moves or games were appended, so a six-hourly job that collects nothing does not stage a file on every run. **EXTRACTOR.** `durable-ingest.js` `extract()` now derives the Champions format tag from `|tier|` as `'champions-reg' + token`, matching `/\breg\s*([a-z0-9]+(?:-[a-z0-9]+)*)/i`, falling back to `'champions-reg?'`. Reg M-B output is unchanged. **WORKFLOW.** `.github/workflows/ingest.yml` gains one `continue-on-error` step after the shrink guard, a `--reconcile` call inside the push-retry loop, `data/next-regulation.json` in `add_artifacts`, and a `for f in data/games.gen9champions*.jsonl.gz; do if [ -e "$f" ]; ...` loop that is a no-op under `bash -e` when the glob matches nothing. `.gitignore` gains `data/games.gen9champions*.jsonl`. **GATE.** `tests/test-next-regulation.js`, 19 checks, no game, no release, no artifact write; `tests/test-no-silent-failure.js` reports 0 NEW. No frozen source moved.

**5.234.0 - `engine/effect_kind.js` GAINS THE DERIVED CONDITION SET, THE REACHABLE-KIND PREFERENCE AND THE BASE-FORME RESCUE; `engine/game_differential.js` CALLS THEM AND IMPLEMENTS NONE OF THEM.** `entityStanding` and `annotateCause` moved out of the differential into `EK.makeStanding({ dex, tags, abilityCarriers, fails })`, which returns `{ entityStanding, annotateCause, counters, conditions, formes, isCondition, resolution }`. The differential aliases the first two and exports them. Rationale: requiring `game_differential.js` costs about 26 s and rebuilds a team pool cache, so a naming rule exercisable only through it is untested in practice - the argument `effect_kind.js` was created on. **THREE RULES, EACH DERIVED AT LOAD.** (1) `conditionNames(dex)` walks every legal move, ability and item (`exists && !isNonstandard && tier !== 'Illegal'`), collecting `volatileStatus`, `sideCondition`, `slotCondition`, `pseudoWeather`, `weather`, `terrain` and `status` string fields recursively and regex-scanning handler sources for `addVolatile` / `addSideCondition` / `addSlotCondition` / `addPseudoWeather` / `setWeather` / `setTerrain` string-literal calls, then unions the standalone `Dex.data.Conditions` table. Returns 96 names, 35 standalone, 964 entities scanned, and a `collisions[]` of names that also name an out-of-format move: `confusion`, `hail`, `healblock`. (2) `entityStanding` now collects one candidate per kind over `STANDING_KINDS` and returns the first with `reachable === true`, falling back to the first hit; `counters.kind_preference_rescues` counts the difference. (3) `legalFormesByBase(dex)` maps `ID(baseSpecies)` to the legal formes under it and reports `rescues[]` - base spellings not in the format that carry one; the species branch sets `reachable` true through it and attaches `via[]`, leaving `legal` at the species' own standing. `counters.species_forme_rescues` counts it. **ARTIFACT.** `entity_annotation` gains `condition_names_in_play`, `collisions_with_an_out_of_format_move[]`, `illegal_base_species_with_a_legal_forme[]`, `kind_preference_rescues` and `species_forme_rescues`, and its `rule` string is rewritten; `standalone_conditions` is unchanged in meaning. **KNOB.** `makeStanding({ resolution: 'first-hit' })` restores the pre-2026-08-31 resolution exactly (standalone table only, first dex hit, no forme rescue). **GATE.** `tests/probe_entity_kind.js`, registered in `tests/run-all.js` GATES; about 1 s, no game, no release, no artifact write. It iterates the DERIVED collision sets rather than a list, asserts each against both arms, keeps `octolock`/`telekinesis`/`iceball` and `|move|p1a|<name>` clicks as negative controls, asserts `max_uses` is unchanged across the knob for protect/tailwind/encore/reflect/substitute, and re-annotates every cause of a stored differential artifact (`--artifact <path>`) asserting nothing becomes newly impossible. `PROBE_ENTITY_KIND_ARM=first-hit` reproduces the red run: 6 failures, exit 1. `tests/test-effect-kind.js` PART 4 was rewritten from a classification assertion to an outcome assertion, the classification having changed under it. **Six new catch blocks in `effect_kind.js` count and report through `deriveFail`; `tests/test-no-silent-failure.js` reports 0 NEW.** No frozen source moved; engine release `862624c9826e` unchanged.

**5.233.0 - `build/build_engine_data.js` GAINS A DUPLICATE-ROW RULE, AND `data/engine-data.js` IS REGENERATED FOR THE FIRST TIME SINCE 2026-08-10.** The artifact's `mons` block goes 322 rows -> 322 rows with TWO changes and no third: ten `wt` fields filled from `species.weighthg/10` (`victreebel-mega` 125.5, `feraligatr-mega` 108.8, `skarmory-mega` 40.4, `barbaracle-mega` 100, `falinks-mega` 99, `aegislash-blade` 53, `gourgeist-small` 9.5, `gourgeist-large` 14, `gourgeist-super` 39, `palafin-hero` 97.4, each placed after `ab`, the slot the five declared rows that already carried it use), and the key order moving the 15 rows of `data/mc-declared-rows.json` to the end. `moves` (500 rows), `MC.C` and `MC.priors` are byte-identical; the semantic diff reports zero field differences outside the ten. **THE NEW RULE.** After all three sources have contributed and before the `wt` pass, rows are grouped by `DEX.species.get(key).id`; in a group of more than one the key whose lower-cased alphanumeric-only form EQUALS that id survives and the rest are deleted with both rows' mv/ab shapes printed. A group with a canonical-key count other than exactly 1 is `console.warn`ed and **nothing is dropped**, because a silent narrowing is the failure this builder's header spends four hundred lines on. Measured over the 323 candidate rows before it was wired: one group (`floettemega` carrying `floette-eternal-mega` and `floette-mega`), 322 distinct dex species, 0 rows the dex cannot resolve. `--check` now reports that `data/engine-data.js` is exactly what its sources would produce today; the row census reports `wt null: 0` (was 10), `ab null: 0`, `mv empty: 4`, UNEXPLAINED 3 (the three Gourgeist `item: null` rows, pre-existing). `engine/artifact_audit.js` 2 GAPs -> 1; `engine/generated_audit.js` DRIFTED 2 -> 1. **NO ENGINE BYTE MOVED** - `engine/medicham2-browser.js` is untouched; `weightFollowsForme` and `effWeight` were already correct and were reading a hole. **STAGE 2 (`build/rebuild_sets_from_sheets.js`) was re-run and reports `materially changed 0`, `illegal abilities fixed 0`. STAGE 3 (`engine/merge_mega_into_engine.js`) was NOT run**: it reads `data/games.bo3.jsonl` and `games.ladder.jsonl` through `engine/mega_sets_from_sheets.js`, both appended eighteen minutes before this batch, and would fold a corpus change into a weight batch; stage 1's spread of the previous row carried every stage-3 field (`base`, `mega`, `mv_provenance`) through untouched. **ORDER-SENSITIVITY, ENUMERATED.** `mc_key.js`'s first-key-wins map, `merge_mega_into_engine.js`'s `byNorm` and `replay_differential.js`'s `FLAT_MONS` are order-sensitive only on a flattened-key collision, of which the candidate has zero; `replay_differential.js`'s `SLOW_POOL` is genuinely tie-sensitive (stable sort then `.slice(0, 60)`, with a three-way speed-60 tie on the boundary) and is not reached, because its hyphen filter removes every one of the 15 moved rows and the filtered input subsequence is identical under both orders; `million_run.js`'s `pickSpecies` walks the table in order by construction and changes from the weights anyway; `engine/feature_fixture.js`'s `tableDigest()` hashes in iteration order and MOVES. Proven empirically with a REORDER-ONLY control artifact (old values, new order, 322 rows): 0 verdict differences over 359 census result rows. **New census row** `move/variablePower`, seven arms over two doors: `megaWtTarget` for Skarmory/Victreebel/Falinks through a real `battleTurn` with the foe's action carrying `mega: true`, and a new `wtRatioAt(defSp)` firing Grass Knot and Energy Ball from a Venusaur at a body built at each Gourgeist size plus the base. Every arm is a ratio against a fixed-base-power move of the same type and category, so stat, STAB and effectiveness cancel. Engine release `0e8ec5729a7b` -> `862624c9826e`.

**5.232.0 - THE ITEM STRIP IN `_stepAfterHit` GAINS THE OTHER THREE STATEMENTS OF THE HANDLER, AND A SIX-ARGUMENT `-enditem` EMITTER.** In `engine/medicham2-browser.js`, `_stepAfterHit`'s strip branch now splits on a steal-eat gate. The gate reads `takesTargetItem.consumesAndGainsEffect` first and falls back on `removesItem.requiresItemClass === ['isBerry'] && !steals`, counting `MEDFAILS.stealEatViaClassGuard` on every fallback, because ROADMAP #529 leaves the direct statement mis-derived for exactly these two moves. On the steal-eat road the branch writes `TR.stealeat(target, item, moveName, thief)` - a NEW emitter, because `TR.enditem(m,it,tag,of,extra)` places `of` at field 4 and `extra` at field 5 and therefore cannot write `[from] stealeat`, `[move] <Name>` and `[of]` as three fields in the authority's order - then `berryForceEat(thief, item)` (the shared `singleEvent('Eat')` implementation, also used by Stuff Cheeks, Teatime and Cud Chew), then `runEatItemEvent(thief, item, moveId)` with the MOVE ID as `fromEffect` (which is exactly the list Cud Chew's `notFromEffects` names), then `thief._ateBerry = true`. The move NAME is read off the tag record's own `name` field and is never typed. `MEDI_STEALEAT_STRIP_ONLY=1` restores the old shape whole, is stamped at declaration as `MEDFAILS.stealEatStripOnlyRestored`, and is registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`. New counters: `MEDSEEN.stolenBerryEaten`, `stolenBerryEffectUnexpressed` (kept separate from `forcedBerryEffectUnexpressed`; legitimately non-zero for the 18 resist berries, whose authority handler is also empty), `eatEventOffStolenBerry`, and `MEDFAILS.stealEatAttackerFainted` / `stealEatStalenessUnmodelled` for the two statements deliberately left unmodelled (the authority's `source.hp` guard over the STRIP, and `target.staleness = 'external'` on a stolen Leppa). Probe: `move/takesTargetItem`, seven arms, one staging, both bodies unfaintable. Census 813 -> 814 live / 814 probed / 0 missing; engine release `f933a01b792a` -> `0e8ec5729a7b`.

**5.231.0 - `runEatItemEvent(m, itemId, fromEffect)` IS LIFTED OUT OF `consumeBerry` AND THREE SITES NOW CALL IT.** In `engine/medicham2-browser.js`, the `_eatItemEvent` closure (Cheek Pouch's `healsOnBerryEaten` heal and Cud Chew's `reEatsBerry` arm) becomes a module-level function taking the authority's `sourceEffect`, so the three roads that never call `consumeBerry` can raise the event without pretending to be one. `itemCuresVolatile` and the resist-berry `_spend` closure are routed through `consumeBerry` WHOLE - because `Pokemon#eatItem` is one straight line, a road that skipped `runEvent('EatItem')` had also skipped `lastItem`, `ateBerry`, `usedItemThisTurn` and `runEvent('AfterUseItem')`, i.e. Harvest, Belch, Recycle, Pickup and Symbiosis. The resist site now reads `consumeBerry(tg, _it, null)` then `TR.enditem(tg, _it, '[weaken]')`, which is the handler's own order; `itemCuresVolatile` passes the `removeVolatile` plus `TR.vend` pair as the `onEat` closure so the `-enditem [eat]` precedes the `-end`. **Fling is deliberately NOT routed through `consumeBerry`**: it calls `runEatItemEvent(tg, _fi, a.move.id)` beside `berryForceEat`, because the berry is the THROWER's and `fling.condition.onUpdate` writes its `-enditem [from] move: Fling` and its `lastItem` there - the authority puts only `ateBerry` on the foe. `fromEffect` makes `reEatsBerry.notFromEffects` (`['bugbite','pluck']`) reachable for the first time; it is still unreachable in practice and now for a MEASURED reason (`getMovePool` over all ten legal consumer carriers contains neither move) rather than an assumed one. **The non-berry branch of `itemCuresVolatile` is loud, not silent**: membership was printed before wiring and `curesVolatile` has three legal members, one of which is MENTAL HERB - it cannot reach the confusion road today because its `cures` list has no `confusion`, so a non-berry arriving there keeps the old shape and bumps `MEDFAILS.volatileCuredByNonBerry`. New counters `MEDSEEN.eatItemEventRaised`, `eatEventOffResistBerry`, `eatEventOffVolatileBerry` and `eatEventOffFlungBerry`; the invariant is `eatItemEventRaised >= berryConsumed` over any sample where a berry was weakened, cured a confusion or was flung. Revert knob `MEDI_EATEVENT_UPDATE_ONLY=1`, stamping `MEDFAILS.eatEventUpdateOnlyRestored` at declaration and registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`; it is NOT `MEDI_EATREACT_BEFORE_BERRY`, which is a claim about WHERE the one firing lands rather than WHETHER it fires. One census probe, `ability/healsOnBerryEaten`, eleven arms on one unfaintable Maushold at 40% - three test roads, an arithmetic control, an empty-hand control, and two over-fire controls asserting the pinch (`BIP`) and status (`BSP`) roads are unmoved and fire the ability exactly once. **`tests/test-resolution-order.js` exits 134 at node's default old space and that is a heap ceiling, not a verdict** - run through `tools/lownode.cmd`, which derives `ABRA-HEAP: 6144` from the script's own header, it reports PASS on 26 arms.

**5.230.0 - THE SINGLE-ARRIVAL DISGUISE BUST MOVES TO `_stepUpdate`, AND THE `-enditem` LINE MOVES INSIDE `consumeBerry`.** In `engine/medicham2-browser.js`, the absorb block's `dmg=_abs.chip; TR.dmg(tg); _bust();` becomes `dmg=0` plus a move-scoped `_bustPending`, flushed at `_stepUpdate` above `_updateEvent` (Showdown's `findPokemonEventHandlers` collects a body's handlers ability-first, so the forme change precedes a pinch berry in the one pass). Three consequences, each the authority rather than bookkeeping: `dmg` is 0 because `onDamage` returns 0, so the Focus Sash, Endure and recoil blocks below - which read `dmg` - cannot answer a chip whose source effect is a Species; the ROADMAP #308 zero-damage line is now emitted by the shared `tg.curHP-=dmg` / `TR.dmg(tg,_cf)` pair below rather than at the absorb site, so there is one emitter and not two; and the flush is placed ABOVE the `NO_INMOVE_UPDATE` knob so an unrelated break cannot strand a renamed body with no `detailschange`. The volley road is untouched - it has fired at the between-arrival seam since ROADMAP #526 - and both roads call the same closure. `consumeBerry(m, itemId, onEat)` is now `Pokemon#eatItem`'s body in its order: the Ripen `onTryEatItem` announce, the `-enditem`, the caller's `onEat` (`singleEvent('Eat')`), then one `_eatItemEvent()` holding Cheek Pouch and Cud Chew (`runEvent('EatItem')` - one hook, one position), then the slot clear and Symbiosis. All four callers - `eatHeldBerry`, `berryCureUpdate`, `berryPinchUpdate`, `berryPPUpdate` - drop their own `TR.enditem` and pass their effect as the closure. New counters `MEDSEEN.formeAbsorbBustAtUpdate` / `formeAbsorbBustPaidAtUpdate` (which must be equal), `berryEatReactionAfterEffect`, and `MEDFAILS.formeBustPendingUnpaid`. Revert knobs `MEDI_FORME_BUST_INLINE=1` and `MEDI_EATREACT_BEFORE_BERRY=1`, both stamping `MEDFAILS.formeBustInlineRestored` / `eatReactBeforeBerryRestored` at declaration and both registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`. Two new census probes, `ability/formeOnHit` (the reveal position, five arms) and `ability/healsOnBerryEaten` (the `EatItem` position, four arms). The eat-knob restores the ORDER faithfully and not the pre-change engine's intermediate HP on the pinch road, because the berry heal moved into the closure - stated rather than claimed as a byte-exact restore.

**5.229.0 - THE `DamagingHit` PAYMENT MOVES INTO THE PACKET LOOP AND THE RESIST BERRY MOVES INTO `_stepDamage`.** In `engine/medicham2-browser.js`, `_damagingHit(_n)` and `_stepBuffOnHit(R, _n)` now take an arrival count; the packet loop calls each with a literal `1` for every interior arrival, under that arrival's `-damage` and above that hit's `eachEvent('Update')`, and `R._reactPaid` / `R._buffPaid` are what the deferred call subtracts from `_react`. The LAST arrival stays with `_stepDamagingHit`. Passing the count explicitly is load-bearing: `_react` is a `const` declared BELOW the packet loop (it needs `_landed`), so an inline call that evaluated it would enter its temporal dead zone. `_stepBuffOnHit`'s `!R.hit && !R.fainted` gate is asked on the deferred call only - both fields are written at the bottom of `_stepApply`, so asking them from the loop would refuse every interior arrival silently. `gainsVolatile` and `boostsAtHPThreshold` are both left once-per-move and both are gated on `_n == null`, the second because it is `onAfterMoveSecondary` at `scripts.ts:577`, below the whole loop. The resist-berry decision moves to the end of `_stepDamage` under the effectiveness/crit emit, carrying an explicit `subBlocks` guard because the substitute branch that used to supply it now sits below the spend; on the addressed-arrival road the closure is handed to the packet loop and fired under arrival 0's pair. New counters `MEDSEEN.reactionPaidPerArrival`, `resistBerrySpent`, `resistBerryAtFirstArrival`. Revert knobs `MEDI_REACT_BATCHED=1` and `MEDI_BERRY_AT_APPLY=1`, both stamping `MEDFAILS.reactBatchedRestored` / `berryAtApplyRestored` at declaration and both registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`. Two new census probes, `ability/reactionPerArrival` and `item/resistBerryAtCalculation`. `tests/test-resolution-order.js` gains the break `react-batched` and its `a1-multihit-frequency` arm is promoted from `known-open` to `red`; `tests/probe_red_demo.js`'s Knock Off / Focus Sash demonstration is re-aimed at the statement now standing where the berry's old line stood.

**5.228.0 - `RESIDUAL_GROUPS` GAINS A `statusBrn` STEP AT ORDER 10 AND A `perish` STEP AT ORDER 24.** In `engine/medicham2-browser.js`, the single `{step:'status', id:'psn'}` entry that carried all three chips is split; the walk now dispatches on the body's own status, and the `healsFromOwnStatus` interception moves with the chip it intercepts because it is an `onDamage` at priority 1 and occupies no position of its own. `{step:'perish', id:'perishsong', ns:'condition'}` places the tick that stood in the foot-of-turn clock loop; the foot-of-turn line survives behind `PERISH_AT_FOOT`. Two supporting guards: the group close is now `if(m.curHP<=0 && !m.fainted)`, so a body the perish step has already queued does not get its deferred `|faint|` written inline; and the walk's `break _TURN` is now `sideWiped(S) && !faintQueueOwed()`, because `this.ended` is set inside a drain and the duration-expiry branch skips it. New counter `MEDSEEN.perishKOInWalk`. Revert knobs `MEDI_STATUS_ONE_STEP=1` and `MEDI_PERISH_AT_FOOT=1`, both applied to the MAP rather than to the walk, both stamping `MEDFAILS.statusOneStepRestored` / `perishAtFootRestored` and both registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`. Two new census probes, `condition/residualStatusOrder` and `condition/residualPerishStep`. `tests/test-perish-song.js --break-the-faint` re-aimed at the walk's site; its old anchor had not matched since 2026-08-24.

**5.227.0 - `runEvent('AfterFaint')` IS ONE PAYMENT, SIZED BY THE DRAIN, BELOW `checkWin`.** In `engine/medicham2-browser.js`, WIRE 104's `boostsOnKO` payment moved out of `_stepFaint` (which the driver runs per row) into a new once-per-move step `_stepAfterFaint`, inserted between `_stepDrainFaints` and `_stepHitCount`. `_afterFaintN` accumulates the drain depth at the two sites this engine announces - `_stepFaint` per row plus the pending self-KO, and `_stepDrainFaints`, which now returns what it emptied. The step returns early on `sideWiped(S)`, counting `MEDSEEN.afterFaintSkippedBattleEnded`. `_koBoost(n, attr, announce)` is one function with two callers; it emits `TR.ab(m, <tag display name>, 'boost')` above a bare `TR.bst(...)`, matching `boost()`'s Ability branch at `sim/battle.ts:2058-2064`. New counters `MEDSEEN.afterFaintPaid`, `afterFaintSkippedBattleEnded`, `afterFaintMultiDrain`; revert knob `MEDI_AFTERFAINT_PER_TARGET=1` stamping `MEDFAILS.afterFaintPerTargetRestored` at declaration and registered in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`. New probe `tests/probe_afterfaint_boundary.js` - two engines, three arms, 24 assertions, forces `--state`, 0 failing after the fix. `tests/test-mechanics.js` gains two `ability`/`boostsOnKO` rows, the first of which reads the WIRE through `battleInit`'s `trace` sink because the STATE cannot distinguish two `+1`s from one `+2`. Two existing instruments keyed to `-boost ... [from] ability: eelevate` were re-aimed at the `|-ability|` line.

**5.226.0 - THE `onDamagingHit` REACTION COUNT IS THE LANDED ARRIVAL COUNT.** In `engine/medicham2-browser.js`, `_stepApply`'s `_react` took the DRAWN hit count `_hitsThisUse` for any `multiHit` move; it now takes `_landed` when the packet road ran and the volley stopped early (`_packets && _landed > 0 && _landed < _drawn`). `R.react` is read by the `punishesAttacker` loop and by `buffsHolderOnHit`'s loop, so both families are corrected by the one expression; the single-packet and COLLAPSED roads are unchanged. New counter `MEDSEEN.volleyReactStoppedAtKO`; revert knob `MEDI_VOLLEY_REACT_DRAWN=1` stamping `MEDFAILS.volleyReactDrawnRestored` at declaration. `tests/test-mechanics.js` gains a named `DELIBERATE_BREAK` list (`residualCollapsed`, `volleyReactDrawnRestored`) and refuses to write `data/mechanics-census.json` under either. New probe `tests/probe_volley_reactor_count.js` - two engines, two arms, forces `--state`, 0 failing after the fix.

**5.225.0 - THE FORCED-SWITCH ADDRESS BOOK IS THE RESOLVED TARGET'S SIDE.** New shared reader `sideBoxOf(body, it, actA, actB, benchA, benchB, sfA, sfB)` returns `{own, bench, sf, foes}` for the side the body actually stands on, with a COUNTED far-side fallback (`MEDSEEN.targetSideNotOnField`) for a body on neither active array. Both `forcesSwitch` doors route through it - the `phaze` action kind and the post-hit damaging branch, whose box is now computed per target row inside the loop rather than once above it. Counter `MEDSEEN.targetSideIsMoversOwn`; revert knob `MEDI_TARGET_SIDE_FOE_ONLY=1`. `engine/game_differential.js`'s scripted encoder gains `{ ally: true }`, which writes the negative targetLoc for a `normal`/`any` move and refuses-and-counts it (`scriptCounters().allyAimRefused`) for any other class. New instrument `engine/side_selection_census.js` + `data/side-selection-declarations.json` + `data/side-selection-census.json`: 102 side-selecting sites keyed `anchor | expr | digest-of-line`, 21 declared, 81 undeclared and ratcheted downward. Probe `tests/probe_ally_forced_switch.js`, 6 arms, 0 failing.
**SUPERSEDED 2026-09-04 (CHANGELOG 5.249.0).** The site and declaration counts in the sentence above are the figures as measured at 5.225.0 and are kept as written. `engine/side_selection_census.js` was regenerated on 2026-09-04 and now reads 103 sites, 23 declared and 80 undeclared, against a ratchet of 81; the prior undeclared count is no longer in `data/side-selection-census.json`.

**5.224.0 - THE INSTRUCTED REPEAT REUSES THE RECORDED SLOT.** The aimed slot pair (`aimT`/`aimA`, the engine’s equivalent of a signed `targetLoc`) is captured at the collection site and written to `mon._lastAim` at the same commit site as `_lastMove`, keyed by the move id. It is frozen separately from `tgtSlot`/`allySlot` because Encore’s execution-time override and the `randomNormal` re-roll rewrite those two and the authority never writes back to `action.targetLoc`. The `instruct` branch resolves the pair through `reaimToSlot`, which already implements `Battle#getTarget`’s live-occupant and fainted-foe clauses. The read is gated by `aimTravelsByLoc`, which classifies on `targetClass.target` from `data/tags.json`; `randomNormal` is excluded by the authority’s own clause and `scripted` by a stated judgement. New counters `MEDSEEN.instructAimReused / instructAimSlotVacated / instructAimNoSlot / instructAimRepicked / instructAimClassNotByLoc / instructAimFaintedOccupant`; loud fallbacks `MEDFAILS.instructAimUnrecorded` and `instructAimClassUnknown`. Revert knob `MEDI_INSTRUCT_NO_AIM_REUSE=1`. Probe `tests/probe_instruct_target.js`, 14 arms, 0 failing.

**5.223.0 - A SHIELD REFUSES INSTRUCT, AND THE REFUSAL IS ASKED BEFORE THE ABILITY.** `shieldRefuses(target, moveId)` is now the first question in the `instruct` branch. It is asked before the status-refusing ability check, because both handlers answer in the `TryHit` event and the shield declares `onTryHitPriority: 3` while the ability declares none. It reads `shieldRefuses` and not the `protect` flag on the body, because `shieldsUser.blocksStatus` is what separates the four shields that refuse a status move from the one that does not. It is not gated on the target being a foe, because the authority does not look at sides. New counter `MEDSEEN.instructRefusedByShield`. Revert knob `MEDI_INSTRUCT_NO_SHIELD=1`.

**5.222.0 - THE RUN WRAPPER READS THE HEAP DECLARATION. THE DAMAGE DIFFERENTIAL ACCEPTS AN OUTPUT
PATH.**

**The heap declaration.** A check that needs more heap than the default writes `ABRA-HEAP: <MB>` in
its header. `tests/run-all.js` reads this value from the source of the check. It then adds
`--max-old-space-size=<MB>` before the script path.

`tools/lownode.cmd` now does the same. Obey these limits:

- The wrapper reads only the first argument.
- The wrapper reads the first argument only if this argument is a file that exists.
- The wrapper changes forward slashes to backslashes before it starts `findstr`. `findstr` reads a
  leading forward slash as an option. Without this step, `findstr` opens no file and finds no value.
- If the file has no declaration, the wrapper does not add a flag.
- If the first argument is not a file, the wrapper does not add a flag.
- The wrapper does not change the exit code. `tests/test-lownode.js` tests this.

To give a check more heap, write the declaration in the header of the check. Do not write the value in
a table in the runner.

**The output path.** `tests/test-engine-diff.js` writes `data/engine-diff.json` through
`engine/publish_guard.js`. The guard refuses to write a smaller sample over a larger one. The guard
also sets exit code 3. This is correct. But the default sample of this check is smaller than the
published sample. Thus each automatic run failed.

Use `--out <file>` to send the artifact of the run to a different path. Obey these limits:

- The path must be below `data/verification/`. The check refuses other paths with exit code 2.
- With `--out`, the check does not ask the guard.
- With `--out`, the exit code comes only from the three conformance sections.
- The artifact keeps a `NOT_PUBLISHED` block. This block gives the reason.

`tests/run-all.js` gives this flag to the check. Thus the test suite does not write the published
artifact.

**CORRECTION TO 5.221.0.** `docs/DAMAGE-STAGES.md` at version 5.221.0 says that
`tests/test-engine-diff.js` "has no `--out`". This was true at that time. This is no longer true.

**5.221.0 - A CONDITIONAL SELF-SWITCH IS GATED ON THE STAT CHANGE HAVING LANDED.**
`engine/tag_dex.js`, `engine/medicham2-browser.js`.

`data/moves.ts:13178-13181` gives `partingshot` an `onHit` that reads
`const success = this.boost({atk:-1, spa:-1}, target, source); if (!success &&
!target.hasAbility("mirrorarmor")) delete move.selfSwitch;`. `data/mods/champions/moves.ts` does not
mention the move, and the mod's `abilities.ts` and `scripts.ts` touch neither `selfSwitch` nor
`onTryBoost` nor `boost(`, so mainline applies.

`Battle#boost` (`sim/battle.ts:2017-2085`) sets `success` on the first non-zero APPLIED delta, so a
partial application is a success. `getCappedBoost` runs before the `TryBoost` event, so a stat at -6
reaches every ability handler as `0`. `mirrorarmor.onTryBoost` `continue`s past a stat at -6, so a
floored reflector reflects nothing and `success` is still falsy.

Seven legal moves carry `selfSwitch`; exactly one is conditional (`delete move.selfSwitch` occurs once
in the dex). Five legal abilities can refuse a foe's `atk` or `spa`: `clearbody`, `whitesmoke` and
`flowerveil` (`onAllyTryBoost`, Grass targets only) cancel the pivot; `mirrorarmor` is the exception;
`hypercutter` refuses `atk` alone, so the pivot stands. `fullmetalbody` has zero legal carriers and is
not implemented. The five Intimidate-gated refusers test `effect.name === 'Intimidate'` and are inert.

`pivotStatus` now derives `conditional`, `cancelsWhen` and `exceptAbilities` from the handler text.
The engine's `a.kind === 'switch'` branch records `_dropLanded` (`null` = the drop block never ran,
`false` = ran with no applied delta, `true` = a stage moved) and refuses the pivot only on `false`,
only when `cancelsWhen === 'noStatChangeLanded'`, and only when the target's ability is not in
`exceptAbilities`. `cancelsWhen === null` bumps `MEDFAILS.pivotConditionUnreadable` and keeps the
pre-fix behaviour. `MEDI_PIVOT_UNCONDITIONAL=1` restores the defect;
`MEDSEEN.pivotCancelledNothingLanded` and `MEDSEEN.pivotKeptByExceptAbility` count the two branches.

Probe: `tests/probe_partingshot_conditional.js` (19 arms). Census rows: three under
`move / pivotStatus`.

**5.220.0 - A PRIORITY GATE READS THE ABILITY-MODIFIED PRIORITY.** `engine/medicham2-browser.js`.
`Battle#getActionSpeed` (`sim/battle.ts:2639-2645`) runs the `ModifyPriority` event and then assigns
`action.move.priority = priority` for gen > 5. It does NOT add `action.fractionalPriority` to that
field, which is why every gate compares against `0.1`. Champions overrides eight files and touches
neither `getActionSpeed` nor any of the five gates.

Three legal abilities carry `onModifyPriority`: `galewings` (one carrier), `prankster` (seven) and
`triage` (zero carriers - not implemented). Five legal entities gate on the result: `armortail`,
`queenlymajesty`, `quickguard`, `upperhand` and `psychicterrain`; `dazzling` has zero carriers.

`abilityPriorityShift(mon, moveId, isAtk)` is the single reader, lifted out of `actionPriority`, so
the turn sort and the gates cannot answer differently. `gatePriority(mon, moveId, field,
legacyShift)` is the value each gate compares; `legacyShift` is the term the site previously added,
so `MEDI_PRIORITY_GATE_STATIC=1` restores each site exactly. Upper Hand passes its TARGET, because
the number it reads is the target's queued move.

`priorityRefusedAbove` takes an optional fourth out-param reporting which source held the bar, so
Psychic Terrain can emit its own `|-activate|BODY|move: Psychic Terrain` instead of refusing in
silence. A refusal that narrates nothing increments `MEDFAILS.priorityRefusedSilently`.

The `all` and `foeSide` target classes are EXEMPT on the authority and are not wired here: the three
moves that fall through the exemption are unreachable above priority 0.1 in this regulation.

Probe: `tests/probe_priority_modified.js` (14 arms). Census row: `ability / priorityMod`.

**5.219.0 - A SUBSTITUTED MOVE RESOLVES ITS DEFAULT TARGET FROM `targetClass.target`.**
`engine/medicham2-browser.js`. `Battle#getRandomTarget` (`sim/battle.ts:2487`) returns the USER for
`self`, `all`, `allySide`, `allyTeam` and `adjacentAllyOrSelf`, and a sampled adjacent ally for
`adjacentAlly`, BEFORE the `randomFoe()` fall-through. Champions overrides eight files and touches
none of them.
- `defaultTargetOf(mon, mvId, allies, pick)` is new. It reads the class off the move's own
  `targetClass` tag, so no move is named in the engine. `pick` is the caller's existing far-side
  draw and is invoked ONLY on the far-side road, which keeps the addressed `midTargetDraw` stream
  bit-identical for every move already resolved correctly. An `adjacentAlly` move takes no die at
  all: `sample()` over a doubles side is a draw of one.
- Three call sites route through it: the Encore branch in `chooseAction`, WIRE 143's
  execution-time override, and the called-move branch (ROADMAP #308). Instruct is excluded - the
  authority reaches it through `runMove(move.id, target, targetLoc)`, not `getRandomTarget`.
- The Encore override and the spliced copied-move entry now write the signed `tgtSlot` /
  `allySlot` pair instead of `tgtSlot` alone; stamping `-1` for an ally-directed move was what made
  `reaimToSlot` re-aim the move line at nothing.
- A move with no `targetClass` row falls through to the caller's draw and is COUNTED and NAMED
  (`MEDFAILS.defaultTargetClassUnknown`), never silently defaulted.

Knob: `MEDI_DEFAULT_TARGET_FOE_ONLY=1`, stamping `MEDFAILS.defaultTargetFoeOnlyRestored` at load.
Probe: `tests/probe_default_target_side.js`, 12 arms, 6 red and 6 controls. Census row:
`move / targetClass`.

**5.218.0 - THE SHIELD GATE IS RE-ARMED AT EXECUTION WHEN THE ACTION'S MOVE IS NOT THE ONE THE
PRE-PASS ARMED AGAINST.**
`engine/medicham2-browser.js`. `protect.onPrepareHit` -
`!!this.queue.willAct() && this.runEvent('StallMove', pokemon)` - lives inside `useMoveInner`, i.e.
per action at execution. Champions overrides `protect` with `{inherit: true, pp: 5}` and nothing
else, so the handler is mainline's. This engine armed `_shieldPending` / `_guardPending` /
`_stallPending` once per turn in the pre-pass, off `it.a.kind` and `actionMoveId(it.a)`.
- `_armShieldGate(it, idx)` is new and is the pre-pass's own three branches MOVED, not rewritten -
  the same order, the same `volatileForbidsMove` question, the same `_preWillAct` record, the same
  `STALL_EAGER_CLEAR` restore. It clears the three pendings before it sets them and records
  `it._armMv`, the move id the arming was decided against.
- It is re-asked at the gate's own call site (below the `BeforeMove` refusals, above the `|move|`
  line) whenever `it._armMv !== actionMoveId(it.a)`. That covers all three substituting sites without
  naming any of them: WIRE 143's Encore override, which rewrites `it.a` in place; Instruct's
  `acts.splice(actIdx+1, 0, _entry)`; and the called-move splice. An ordinary action costs one string
  compare and takes the identical path.
- `_shieldGate` now records `it._shieldRaised` for the ACTION and restores a shield that was
  already standing when this action's shield is refused - the authority's `onPrepareHit` returning
  false fails the MOVE and writes no `protect` volatile, so the earlier one survives. The
  `kind:'protect'` branch announces `_shieldRaised` and falls back to `m.protect` when no gate
  ran, which is what it always read. `MEDSEEN.shieldStoodThroughRefusal`.
- Counters: `MEDSEEN.shieldGateRearmed` / `shieldGateRearmedArmed` / `shieldGateRearmedDisarmed`.
  `MEDI_SHIELD_NO_REARM=1` restores the pre-pass-only arming and stamps
  `MEDFAILS.shieldNoRearmRestored` at module load.
- `tests/probe_shield_rearm.js`: 11 arms, 5 red and 6 controls, no typed expectation - both engines
  play one script under the `middle` pin and the shield lines AND the stall counter are compared, the
  counter through medicham2's own `stallBoardCounter`. The red arms are free of the die by
  construction: turn 1 all four bodies shield and the slowest holds the last action, so `willAct()`
  refuses it BEFORE `StallMove` and the turn-2 substitution meets counter 0.

**5.217.0 - A MID-TURN ENCORE NOW RELOCATES THE TARGET'S QUEUED ACTION INTO THE ENCORED MOVE'S
PRIORITY BRACKET.**
`engine/medicham2-browser.js`. `data/mods/champions/moves.ts:286-320` replaces
`encore.condition.onStart`; its last clause calls `this.queue.changeAction(target, {choice:'move',
moveid, order})` and rewrites the new entry's `.priority`. Mainline's `encore` stops at
`this.effectState.duration++` and leaves the swap to `onOverrideAction`, documented at
`sim/battle-queue.ts:290` as the door that does not change priority order. WIRE 118 implemented
mainline, correctly for the case Champions leaves alone.
- `encoreRelocateQueued(who, mvId)` is new. It walks the live turn queue from the cursor forward,
  finds the target's own pending entry and writes `_selMv = mvId` on it. It rebuilds no action and
  draws no die; the MOVE is still swapped at execution by WIRE 143.
- It is called from `applyMoveVolatile` BELOW `mentalHerbCures` and only while `_vol.encore` still
  stands, which takes the authority's `!target.hasItem('mentalherb')` clause from the item's own
  implementation rather than a second copy. `sdChoiceOf(it.a) !== 'move'` is `willMove`'s own
  restriction and `actionMoveId(it.a) === mvId` is `action.moveid !== move.id`.
- `ENCORE_Q` is the live turn's `acts` array plus its cursor, assigned at the top of every action
  (above the mega phase and above `_resortTail`) and cleared on the outer exit of the turn beside the
  flinch clear, so every `break _TURN` drops it. `MEDFAILS.encoreRelocateNoQueue` must read 0.
- `actionPriority` now resolves the bracket's VALUE and CATEGORY from one move id. It read the value
  off `_selMv` and the category off the action's `kind`; the authority reads `baseMove.priority` and
  `baseMove.pranksterBoosted` off one record on consecutive lines, and `getActionSpeed` re-derives
  both off `action.move`. Every kind routes through the `_selMv` line now, not only `attack`.
  `movePriority` returns each displaced branch's own constant (protect 4, wideguard 3, tailwind 0,
  trickroom -7), checked before the line was written; a bare switch carries no `_selMv` and still
  returns 6.
- `MEDSEEN.encoreRelocatedQueuedAction`; `MEDI_ENCORE_KEEPS_SELECTED_BRACKET=1` restores the previous
  reading and stamps `MEDFAILS.encoreKeepsSelectedBracketRestored`.
- `tests/probe_encore_bracket.js`: 11 arms, 5 red and 6 negative, no typed expectation - both engines
  play one script under the `middle` pin and the `|move|` orders are compared. The bracket that lands
  is a full re-derivation rather than the override's printed delta, because `Battle#runAction` ends
  (gen >= 8, `sim/battle.ts:2915-2922`) by running `getActionSpeed` over the queue and re-sorting; the
  `prankster-status` arm separates the two and the authority answers the re-derivation.

**5.216.0 - `sideBuffRefuses` NO LONGER SKIPS THE TARGET'S OWN SIDE CONDITION WHEN THE SOURCE IS A
PARTNER.**
`engine/medicham2-browser.js`. The authority's `safeguard.condition.onSetStatus` and
`onTryAddVolatile` both end on `if (target !== source)`; the sole `isAlly` in either is inside the
`effect.infiltrates` early return, which is one-directional by construction.
- `sideBuffRefuses(t, src, what, quiet)` loses `if(src._sf&&src._sf===sf)return null;`. The TARGET's
  side object still selects which conditions are asked; only the SOURCE's side stops being a reason to
  skip them.
- Three call sites share the reader - `applyStatus` (`blocksStatus`), `applyConfusion`
  (`blocksVolatile`) and the status branch's narration guard - so both handlers and the `-fail`
  suppression are corrected by the one deletion.
- `quiet` marks the narration guard's call as a re-ask. Without it a single near-side refusal
  incremented the counter twice, because that site asks a second time about a refusal that has already
  happened.
- `MEDSEEN.allySideBuffRefused` counts near-side refusals across both roads.
  `MEDFAILS.sideBuffFoeSideOnlyRestored` counts refusals suppressed by
  `MEDI_SIDEBUFF_FOE_SIDE_ONLY=1`, taken inside the loop after the condition matches, so it is the
  defect's size rather than the fixture's.
- `tests/probe_ally_safeguard.js`: 11 arms, 4 of which the knob reds and 7 negative.
Derived over the format, filtered `exists && !isNonstandard && tier !== 'Illegal'`: **13** legal moves
lay a side or slot condition, **5** carry a source-taking decision handler, and the remaining three
(Reflect, Light Screen, Aurora Veil, `onAnyModifyDamage`) were verified correct - their side test is
on the target, and the screen read here keys off `def._sf` alone. The field-wide walk was extended to
items and move conditions: **White Herb** and **Uproar** join the seven abilities, and all nine gather
correctly. Census 792 to 794. Whole-game board-parted unmoved at 97 of 961.

**5.215.0 — THE MOVE ARM OF THE ROSTER ASKS WHETHER A LEAF'S EFFECT RAN, NOT ONLY WHETHER IT WAS
ANNOUNCED.**
`engine/all_mechanics_fire.js` reads a move row's verdict from the reference simulator's log. It
counts any `-` event that is not in `NOT_A_CONSEQUENCE` as a consequence. `-singleturn` is not in that
set and remains outside it; the reason is recorded at the declaration.
- `leafEffectMarkers(moveId)` derives, per move, the protocol events the move's own state emits from
  an INTERCEPTION handler — a handler that can only run because an incoming move reached the state.
  The anchor is the literal third argument of that handler's `this.add`, not the move's display name:
  the reference simulator announces the whole guard family as `move: Protect`.
- `leafEffectSeen(log, spec, slot)` asks whether such a line appears on the subject's own slot, or on
  the subject's own side for a side condition. Both anchors are required. The fixture's two partner
  bodies click Protect every turn, so an unanchored search would credit any row.
- `engine/faces.js` gains a consequence verb `attackedOnTheSameTurn`. Every other verb in that table
  stages a later turn; a state with a declared duration of one turn has none. Four tag keys carry it:
  `shieldsUser` (5 moves), `oneTurnGuard` (2), `preTurnShield` (2), `survivesAnyHit` (1).
- `setupFor` now calls `thenWhatFor`. Before this change the move arm did not, and the volatile half
  of that table reached zero rows in the only arm that did call it.
- The ladder's stop condition becomes *resolved AND the declared effect was seen*. For a row with no
  declared marker the condition is identical to the previous one.
Measured over 500 move rows: 11 declare a marker, 7 demonstrate it on both engines, 4 do not and state
why, 76 write a state that emits nothing on interception. Zero rows changed verdict.

**5.214.0 — A PIVOT MOVE IS A MOVE AT THE REDIRECTION SITE.**
`engine/medicham2-browser.js` decides the target of a single-target move that is not an attack in one
block. Before this change, the block refused any action whose `kind` field was `'switch'`.
- `playerAction` gives every move carrying the `pivotStatus` tag the action `{kind:'switch', mv,
  target}`. Two moves in this format carry that tag: `chillyreception` and `partingshot`.
- The reference simulator runs its `RedirectTarget` event in `Pokemon#getMoveTargets`
  (`sim/pokemon.ts`, line 829). The event runs for every single-target move. The category of the move
  and the self-switch of the move are not conditions of the event.
- The block now refuses only the action `kind` `'attack'`, which has its own redirection call. An
  action that is a real switch carries no `mv` field, so `actionMoveId` returns null and the existing
  test skips it.
- The counter `MEDSEEN.redirectedPivotStatus` counts each pivot move that is redirected. The counter
  `MEDFAILS.pivotSkipsRedirectRestored` counts each pivot move that is not redirected because
  `MEDI_PIVOT_SKIPS_REDIRECT=1` is set. On a normal run, the second counter must be 0.
- `tests/probe_pivot_redirect.js` tests the change. It also tests four conditions that must stay true:
  Stalwart stops the redirection, a Grass-type user is not drawn by Rage Powder, a Grass-type user is
  drawn by Follow Me, and `chillyreception` is not redirected.

**5.213.0 — A BODY'S WEIGHT FOLLOWS ITS SPECIES.**
`engine/medicham2-browser.js` keeps the weight of each body in the field `wt`. Before this change,
`buildMon` set `wt` one time and no other function changed it.
- Four moves in this format read a weight. Low Kick and Grass Knot read the weight of the target.
  Heavy Slam and Heat Crash read the ratio of the weight of the user to the weight of the target.
- The reference simulator sets the weight again each time the species of a body changes. It does this
  in `Pokemon#setSpecies` (`sim/pokemon.ts`, line 1402).
- A mega evolution changes the species. `medicham2` did not set the weight again, so it used the
  weight of the base form.
- The function `weightFollowsForme` now sets the weight again. Seven functions call it. These are the
  functions that change the species of a body.
- If the data row for the new form has no weight, the engine uses the weight of the base form and
  increases the counter `MEDFAILS.weightRowNoValue`. If there is no data row, the engine keeps the
  weight it has and increases the counter `MEDFAILS.weightNoRow`.
- Set `MEDI_WEIGHT_STATIC=1` to get the previous behaviour. The engine then sets the counter
  `MEDFAILS.weightStaticRestored`.

**5.212.0 — THE FORCED-SWITCH MIRROR READS THE ORDERED OCCUPANCY OF A SLOT.**
`engine/game_differential.js` gives the reference simulator the replacement that `medicham2` chose.
Before this change it read the body that occupied the slot at the END of the turn.
- `medicham2` plays one whole turn in one call. The reference simulator stops in the middle of a turn
  when a pivot move resolves, and it asks for a replacement at that moment.
- If one slot received two bodies in the same turn, the two moments give two different bodies. The
  harness then named a body that the reference simulator had on the field. The reference simulator
  refused the choice and the harness stopped the game.
- The harness now records each body as it enters a slot, in order, for the turn being played. It
  answers each request with the next body in that list. It removes the switch that the driver itself
  ordered, and it removes a drag, because the reference simulator does not ask about either. Both
  removals are counted and printed.
- The message for a refused mirror now says `has FAINTED` or `already has ACTIVE on the field`. The
  earlier message said `(fainted/active)` for both. The two conditions have opposite causes.
- Set `MEDI_MIRROR_END_OF_TURN=1` to restore the earlier behaviour.
  `tests/probe_forced_switch_mirror.js` fails with this variable set and passes without it.

On the same pins the empirical driver arm gives 48.4% of games with a result and 117 games with a
different board. The earlier values were 47.8% and 135.

**5.211.0 — THE GATE NOW PRINTS THREE MORE LIMITS OF ITS OWN VERDICTS.**
`engine/coverage.js` prints three new rows. Each row is calculated at run time. Each row shows
`NOT DERIVED` and the reason if its source does not parse.
- `differential bodies on a REAL spread` — the whole-game differential gives each body a spread that
  it calculates from the position of the body in the team. A team sheet does not show a spread. The
  rule (66 points, a limit of 32, a Speed ladder, no HP) is read from the source of the driver. The
  nature is the real nature from the sheet. Both engines get the same calculated spread. Therefore
  the comparison is correct, but the damage is not the damage of a real ladder game.
- `board leaves compared` — the denominator is now the CEILING (56) and not the population (80). The
  comparator reads the board only at the end of a turn. 24 leaves cannot be present at that moment.
- `driver policies the gate quotes` — a whole-game result is only correct for the driver policy that
  made it. The gate reads one policy of two.

**5.210.0 — THE PORY TWO-FEATURE PAIR IS WITHDRAWN: ITS GENERATOR WRITES NO ARTIFACT.**
`engine/pory_baseline.py` prints a five-arm table and saves nothing, so the material-baseline
pair it published on 2026-07-25 never had a source to check it against, and it was scored
before that script had a clean-data filter at all. On the clean corpus the comparison is a
TIE rather than a loss, measured PAIRED and clustered by game in `data/pory-eval.json`. The
withdrawn pair stays in `docs/REVIEW-2026-07-25.md`, the review that measured it. This document quoted the pair in its value-network
section and no longer does.

**5.209.0 — GRANT FLASH FIRE'S VOLATILE. COMPARE THE CHOICE LOCK.**
The block for 5.208.0 is below. Its counts come from engine release `4e5c7b3400de`.
Those counts are out of date. They are kept as a record. Read this block for the current state.

**WHAT CHANGED IN THE SIMULATOR.**
Flash Fire now grants the volatile it absorbs the hit for.
The volatile multiplies the holder's Fire moves by 1.5 at the attacking-stat stage.
The multiplier, the boosted type, the announcement text and the end condition are all derived.
They are derived by `engine/tag_dex.js` into `typeImmunity.gain.volatileBoost`.
No name is written into the engine.
The `-immune` line is the gift's else. It now appears on the second Fire hit only.
The volatile is removed when the ability that granted it is removed.

**WHAT CHANGED IN THE COMPARATOR.**
`engine/board_state.js` now compares `volatile:choicelock`.
It compares the MOVE the body is locked into, not the presence of a lock.
The compared-leaf count is 34 of 80. It was 33.

**HOW TO REPRODUCE.**
Run `node tests/test-mechanics.js`. The census must read 784 live, 784 probed, 0 missing.
Set `MEDI_ABSORB_GIFT_VOLATILE_BLIND=1` and run it again. Two rows must read MISSING.
Run `node tests/probe_uncompared_leaves.js`. It must read COMPARED 34, NEITHER 42.
Run `node engine/quarantine.js`. The gate must read OPEN, 8 of 8.

**WHAT IS STILL OPEN.**
The two engines remove a dead Choice lock at different moments.
The authority removes it when it builds a request.
This engine removes it when something asks for the menu.
No game in the 961-game sample staged the difference. No probe exists for it.

**Version 5.208.0 · Last updated 2026-08-28**

**5.208.0 — WIRE THE METRONOME ITEM. THEN MEASURE THE FIVE CLAUSES AGAIN.**
The block for 5.207.0 is below. Its counts come from engine release `5f3f7141227c`.
Those counts are out of date. They are kept as a record. Read this block for the current state.

**WHAT CHANGED IN THE SIMULATOR.**
The Metronome item now has a consumer.
The tag `damageMultOnRepeat` was correct before this change. No code read it.
The item makes a move stronger each time the holder uses the same move.
The multiplier ladder is read from the tag. It is not typed into the code.

**THE STATE. THESE COUNTS ARE SUPERSEDED BY THE 5.209.0 BLOCK ABOVE.**
The census below reads 782. The artifact now reads 784.
The gate has eight clauses. All eight clauses pass. The gate is open.
Five clauses were measured again on engine release `4e5c7b3400de`.
Read `data/roster.items.json`. There are 140 tested of 148 in scope.
Read `data/roster.abilities.json`. There are 129 tested of 202 in scope.
Read `data/roster.moves.json`. There are 475 tested of 500 in scope.
Each of the three has 0 disagreements and 0 failures to fire.
Red demonstrations are 18, 29 and 35. Each one was caught.
Read `data/game-differential.json`. There are 961 games and 6 differences.
All 6 are declared. 0 are undeclared. There are 12,445 turn boundaries compared and 12,445 identical.
Read `data/mechanics-census.json`. There are 782 probed, 782 live and 0 missing.
Read `data/all-mechanics-fire.json`. There are 1,289 games played and 0 that threw.

**WHAT MOVED, AND WHERE.**
The items stage moved. The row for `item:metronome` was `DEFERRED-BY-OWNER`. It is now
`FIRED-AND-BOARDS-MATCH`.
The census moved by two rows. One row is the climb. One row is the reset.
The reset row is the important one. A counter that counts turns passes the first row and fails the
second.
The whole-game comparison did not move. This was predicted before the run.
The pinned team pool holds 19 teams with this item out of 26,232.

**HOW TO COMPARE TWO RUNS OF THE WHOLE-GAME COMPARISON.**
The whole-game comparison is steered by the census. The census selects the sample.
Pin the census to the file the earlier run used. Do not use the live census.
Pin the team store to `data/team-pool-frozen`.
Then prove the two samples are the same. Compare the game count, the first-divergence list and the
coverage block.
The staged-mechanics comparison does not read the census. It does not need this pin.

**WHAT THIS DOES NOT DO.**
It does not make a withheld result true.
72 of 250 artifacts changed from WITHHELD to RE-RUNNABLE. That count is printed by
`engine/quarantine.js` and is recorded in `docs/_reports/2026-08-28-gate-rerun.md`.
No artifact was run again.
ROADMAP #440 stays open.

**5.207.0 — DECLARE A DIVERGENCE WITH A MECHANISM, NOT WITH A SENTENCE.**
The block for 5.206.0 is below. It says that seven of the eight gate clauses pass.
That statement is out of date. It is kept as a record. Read this block for the current state.

**THE STATE.**
The gate has eight clauses.
All eight clauses pass.
The whole-game comparison finds 6 differences in 961 games.
All 6 are declared. 0 are undeclared.

**THE ONE NEW DECLARATION.**
One game differs at turn 11.
A Pokemon dies from Perish Song.
The official simulator writes `|upkeep` first and the faint message second.
This simulator writes the faint message first and `|upkeep` second.
The board is the same in both simulators.
This is a difference in a message. It is not a difference in the game.

**HOW THE PROOF IS MADE.**
Compare the board at the end of every turn.
The run compares 12,445 turn boundaries. All 12,445 are identical.
The board includes `fainted`, `hp`, `maxhp` and `status` for each Pokemon.
Read these fields in `engine/board_state.js` at lines 866, 1034, 769 and 843.
Do not accept a "no difference" result for a field that the comparison does not read.
ROADMAP #528 shows that 43 of 80 possible fields are not read.
The fields used here ARE read.

**HOW TO DECLARE A DIVERGENCE.**
Add a row to `DECLARED_DIVERGENCE` in `engine/quarantine.js`.
Set `kind` to `CLOSETED`.
Give the row these fields:
`closet.by`, `closet.on`, `closet.ruling`, `closet.authority`.
Give the row these fields also:
`evidence.instrument`, `evidence.release`, `evidence.on`, `evidence.says`.
Give the row a `falsifiedBy` field.
Give the row a `match` function. Make the function as narrow as possible.
The function `closetFault` refuses the row if a field is missing.
A refused row does not open the gate.

**WHAT THIS DOES NOT DO.**
It does not repair the defect.
ROADMAP #440 stays open.
It does not make a withheld result true.
Re-run each downstream result before you use it.

**5.206.0 — DO NOT LET GIT TRANSLATE A LINE ENDING IN A FROZEN SOURCE.**
The block for 5.205.0 is below. It says that five of the eight gate clauses are withheld.
That statement is out of date. It is kept as a record. Read this block for the current state.

**THE FAULT.**
The setting `core.autocrlf` is `true` on this machine.
Git changes a line ending to CRLF when it writes a text file to the disk.
A frozen source has one form from its generator and one form from git.
The release identifier is the hash of the bytes of 26 frozen sources.
The identifier changes when the line endings change. The program does not change.
This fault occurred on 2026-08-26. It occurred again on 2026-08-28 between 09:58Z and 10:06Z.
The gate went from 7 clauses correct to 3 clauses correct. No engine byte changed.

**THE EVIDENCE.**
The file that moved is the tag artifact. `engine/tag_dex.js` writes it.
The committed blob of that file has the hash `576a4bbe91af`. It has 0 CR bytes.
The release `5f3f7141227c` holds a copy of the same file. The two are equal byte for byte.
The file on the disk had the hash `a32ee545cf67`. It had one more byte for each line.
The two are equal after you replace CRLF with LF. The two are equal as parsed JSON.
The byte counts are in `docs/_reports/2026-08-28-crlf-recurrence.md`.

**THE CORRECTION.**
Ask git for the stored version of the file. Do not edit the file by hand.
An edit by hand gives an identifier that a checkout cannot make again.
Cut the release again. The identifier is `5f3f7141227c`. This is the identifier the five artifacts hold.

**THE PREVENTION.**
Add `text eol=lf` to `.gitattributes` for each frozen source that has LF bytes on the disk.
This setting has a higher priority than `core.autocrlf`.
17 of the 26 frozen sources have this setting. The other 9 have CRLF bytes on the disk today.
Do not pin those 9. A change to those 9 moves every release identifier.
A change to those 9 also breaks `tests/roster.js`. Its red demonstrations look for `\r\n` in the simulator source.
Record the 9 as owed work.

**THE PROOF.**
Write the committed blob to the disk. Then do `git checkout HEAD -- data/tags.json`.
Before the setting: the hash went from `576a4bbe91af` to `a32ee545cf67`. Nothing was edited.
After the setting: the hash stays `576a4bbe91af`.
`tests/test-engine-release.js` makes this a permanent test.
The rule is: a frozen source with LF bytes on the disk must have the `eol=lf` setting.
The rule reads each file. The rule does not use a list of exceptions.
Remove one line from `.gitattributes` and the test fails and names the file.

**THE RESULT. THESE COUNTS ARE PRIOR. THEY ARE SUPERSEDED BY THE 5.208.0 BLOCK ABOVE.**
Run the five instruments again. Compare each result with the previous result.
Roster: 139, 129 and 475 tested. 0 disagreements. 0 failures to fire. Red demonstrations 18, 29 and 35.
Whole game: 1 of 961. Board material: 0 of 961. Staged mechanics: 0 counted.
`data/all-mechanics-fire.json` differs in 3 time fields and 1 timestamp.
`data/game-differential.json` differs in 1 field. The field is the count of cuts of the same release.
Gate: 7 of 8 clauses correct. 1 clause fails. The quarantine stays closed.


**5.205.0 — END THE SPRINT. DELETE THE LOG. READ THE GATE, DO NOT REMEMBER IT.**
The MEDICHAM sprint started on 2026-08-10. The owner stopped it on 2026-08-28.
During the sprint, each change wrote one row to a running log. The full document pass was deferred.
The log had 274 rows. The changelog has 233 releases for the same period. The reports folder has 189 accounts.
This pass writes up the sprint. Then it deletes the log. The deletion re-arms the full document rule.
Do not read a number from the log. The log is deleted. Read a number from an artifact.

**THE MEASUREMENT TOOL WAS THE DEFECT SIX TIMES OR MORE.**
Examine the instrument before you change the engine. This is the order of work.
One night the tool made 30 accusations. 23 accusations were an incorrect test. 7 accusations were an incorrect rule.
1 accusation was a true engine defect. Do not repair 30 items. Repair the tool first.
A red demonstration that is not written to its artifact cannot fail a gate. Write the demonstration to the artifact.
An expired certificate is not a defect. Give each certificate a date. Refuse an expired certificate.

**PUT A FINALISING MIX AT THE END OF A HASH THAT ADDRESSES A DIE.**
The functions `midEventHash` and `midHash` ended with `h = Math.imul(h ^ c, 0x01000193)`.
There was no operation after the last round. FNV-1a has no diffusion after its last round.
The last field of a draw address is the arrival index `nth`. The index has one digit for a usual move.
A one-digit change is a change of four low bits. The hash value moves. The hash value does not re-draw.
The maximum circular shift was 0.0351571. The correct value is near 0.5.
Two arrivals in sequence shared a damage bucket 89.5% of the time. The correct value is 6.25%.
The lag-1 autocorrelation was 0.8873. The correct value is near 0.
The marginal hit rate was 0.9214. The target was 0.9. **The marginal rate was always correct.**
Do not test a die on its marginal rate only. Test the die one step at a time.
Add `fmix32` after the last round. The whole-game difference count went from 3 games to 14 games.
This is a repair of the instrument. This is not a new defect.

**A FIGURE FROM BEFORE 2026-08-27 IS VOID. IT IS NOT STALE.**
A void figure is not evidence. The comparison behind it covered a small part of the outcome space.
Do not cite a void figure. Do not put a warning beside a void figure. Withhold the figure.
Old paragraphs stay in this document. They are a dated record. They are not a current result.
Run `node engine/status.js` for a current figure. An empty field means that no artifact knows the answer.

**THE GATE IS SHUT. FIVE CLAUSES OF EIGHT GIVE NO ANSWER.**
Read `data/quarantine-stamp.json`. The field `gate_open` is false.
The five clauses are the three roster stages, the whole-game differential, and the staged mechanics comparison.
Each of the five artifacts records engine release `5f3f7141227c`. The tree has a different release now.
An artifact that records a different release describes a different program. Withhold every count in it.
Do not print a count with a caution beside it. A reader takes the count and leaves the caution.
Run the measurement again. This is the only remedy.

**A CHECKOUT CAN CHANGE A RELEASE IDENTIFIER WITHOUT A CHANGE TO THE ENGINE.**
One source of 26 moved. The source is `data/tags.json`.
The copy in the release and the copy in the tree are equal after newline normalisation.
Both parse to the same object. The content is the same. The digest is not the same.
This repository sets `core.autocrlf` to true. A generator writes LF. A checkout writes CRLF.
Cut the release over the bytes that a checkout gives. Do not cut over the bytes that a generator gives.
This event is recorded for 2026-08-26 in `docs/ENGINE.md`. It has occurred two times.

**THE CENSUS IS COMPLETE. THE CENSUS IS A LABORATORY. THE COUNT BELOW IS PRIOR AND IS SUPERSEDED BY
THE 5.208.0 BLOCK ABOVE.**
Read `data/mechanics-census.json`. There are 780 probed, 780 live and 0 missing. There are 780 armed and 0 unarmed.
The census stages one scenario for each mechanic. Usage has no effect on the census.
The census answers the question "is this correct". It does not answer the question "does this matter".
Use the pinned team pool for the second question. The two instruments are not equivalent.

**THE DAMAGE COMPARISON AGREES. THE SCOPE IS SMALL. STATE THE SCOPE.**
Read `data/engine-diff.json`. There are 6000 compared, 6000 agreed and 0 disagreed.
The result is 0 disagreements at the midpoint. The result is 0 disagreements at each of the 16 band indices.
The field `scope` says damage only. There are no items and no abilities in this comparison.
Turn order, status duration and switching are not in this comparison.
The field `skipped_multihit` is 134. The field `skipped_ability_multihit` is 17.
The tool calls the single-hit entry point. The tool does not call the volley loop.
**The tool has never applied a multi-hit move.** Do not quote this result as a general agreement.

**"THE BOARDS AGREE" MEANS 33 LEAVES OF 80.**
Run `tests/probe_uncompared_leaves.js`. It reads 500 moves, 201 abilities and 148 items.
The mechanics write 80 different leaves. The comparison reads 33 leaves. The comparison declares 4 leaves.
43 leaves are in no list. 25 of the 43 can be on the board at the turn boundary.
A leaf that is not read looks the same as a leaf that agrees. Add a leaf to one list or the other.

**THE QUARANTINE IS NOT LIFTED. TWO FACTS ARE TRUE AT THE SAME TIME.**
The computed condition is not met. The gate is shut. Every artifact below the simulator stays withheld.
The owner set a narrower bar on 2026-08-22. The bar is zero board-material differences and a clean roster.
The last measurements met the narrower bar. Nobody has changed the gate to test the narrower bar.
Do not resolve this in a document. Change the gate, or leave the gate shut.

**A WITHHELD FIGURE BECOMES RE-RUNNABLE. IT DOES NOT BECOME TRUE.**
This applies to leaf calibration, to the rollout rungs, to the exploitability results and to the weights.
The weight fit is owed. The engine controls it. Compute does not control it.


**3.98.0 — READ THE TAG PARAMETER. DO NOT MATCH THE MOVE NAME.**
The moves Quick Guard and Wide Guard have the same four tags.
The tag `oneTurnGuard` has a parameter `blocks`. The value is "priority moves" or "spread moves".
The simulator did not read the parameter. It matched the name "wideguard" in three places.
The move Quick Guard became the action `pass`. The action `pass` does nothing. This is 927 uses.
Read the parameter. Store the guard by its move identifier. Derive the class at each read.
Test the final priority. A status move with the ability Prankster has a priority of +1.
Do not block a move without the flag `protect`. The move Feint has no such flag.
Put the test beside the ability test, above the action dispatch. A status move does not reach the attack branch.
Do not put the spread test there. A spread move needs one message for each protected body.

**3.97.0 — GIVE EACH HIT ITS OWN ROLL. DO NOT MULTIPLY ONE ROLL.**
The function `dmgRange` made one damage roll. It multiplied the roll by the number of hits.
This is correct only if every hit is the same. Four moves in this format have hits that are not the same.
The move Triple Axel has a base power of `20 * move.hit`. The powers are 20, 40 and 60.
The move Dragon Darts has the field `smartTarget`. Hit 1 goes to the target. Hit 2 goes to its partner.
The move Beat Up has one hit for each usable team member. Each hit has its own base power.
The move Fickle Beam has a 30% chance of double power. It is 80 or 160. It is never 104.
Use a loop over the hits. Enter the loop only if the base power depends on the hit number.
Do not use a mean for a chance. Draw the chance in the battle loop. Keep the mean only for a price.

**3.96.0 — DERIVE TAG MEMBERSHIP FROM THE HANDLER. DO NOT MATCH A NAME.**
The rule `speedMult` matched the name "choicescarf". The item Iron Ball has the same handler
`onModifySpe`. It did not get the tag. The consumer was correct. The producer was not.
The rule `statMult` matched four names. All four names are `isNonstandard: 'Past'`. The rule could not
give a tag to any item. No code read the tag.
Read `chainModify` from the handler. Read the species lock from the handler. Do not write a name.
The item Oran Berry heals a flat amount. The handler is `heal(10)`. There is no `maxhp` in it. Use the
field `restoresFlat` for a flat amount. Do not multiply a flat amount by the maximum HP.

**3.95.0 — THE DAMAGE FUNCTION MUST HONOUR AN INTACT DISGUISE.**
The ability Disguise blocks the damage of a move. The move does 0 damage. The ability then does damage
equal to `maxhp/8`. These are two different sources. Showdown reports them separately.
The battle loop applied the ability damage. The function `dmgRange` did not apply the block. It gave
the same result with the ability and without it.
The function `formeOnHitAbsorbs` holds this fact. The function `dmgRange` calls it and returns 0. The
battle loop calls it and applies the chip. Do not write this rule in two places.
The guard in the loop must not read the damage. The damage is 0 when the block applies. Read the base
power of the move and the type effectiveness instead.

**3.94.0 — READ THE USER'S OWN BOOST FROM TWO FIELDS.**
A move can change the stats of its user. Showdown puts this fact in the field `self.boosts`. Showdown
also puts this fact in the field `selfBoost.boosts`. The two fields are not the same. The field
`self` applies on use. The field `selfBoost` applies only after the move hits a target.
The file `build/build_engine_data.js` read `self.boosts` only. Two moves use `selfBoost.boosts`.
These moves are Clanging Scales and Scale Shot. Their rows had no self-data.
The function `selfBoostsOf` reads both fields. It prefers `self`. It writes a warning if a move has
both fields. Do not merge the two fields without a warning.

**3.93.0 — THE PARTIAL TRAP COUNTER STARTS AT THE DURATION OF THE CONDITION.**
The condition `partiallytrapped` has a duration. The duration is 5. The engine decrements the duration
in the Residual event. The Residual event of the turn the trap lands also decrements it.
The tag `partialTrap` had the field `turns` with the value `'4-5'`. This is the number of turns of chip
damage. It is not the duration. Do not use `turns` for the counter.
The tag now has the field `duration`. Read the counter from `duration`. The field `turns` stays. It
answers a different question. No code reads it.
The function `partialTrapShape` in `engine/tag_dex.js` derives every value from the condition. It reads
`duration`, the range in `durationCallback`, the item in the callback, and the divisor in `onStart`. It
returns null if it cannot read them. A null makes the tag absent and the family refuses.

**3.92.0 — FIVE TEST FILES USED MOVES THAT ARE NOT IN THIS FORMAT.**
A move can have the property `isNonstandard` with the value `Past`. Such a move is not in this format.
The property `exists` is still true for such a move. Do not use `exists` to ask if a move is in this
format. Ask for `isNonstandard`.
Three files used the move `Tackle` for a slot that does not act. This is not correct. It has no effect.
The file `tests/test-priority-block.js` used the move `Splash` to make a slot do nothing. The engine has
no row for `Splash`. The slot did nothing because the move was unknown. Use `CS.INERT_MOVE`.
The file `tests/test-dead-volatile.js` used `exists` as its guard. The guard was always true. The file
now selects its move from the format by property.

**3.91.0 — THE PROBE HARNESS VALIDATES A STAGED BODY. IT DID NOT VALIDATE ONE BEFORE.**
The class `Battle` does not validate a team. A probe can give a Pokemon a banned item. The simulator
accepts it. The engines then agree about a mechanic the format does not contain.
A new function `checkLegal` is in `engine/champions_sim.js`. It takes a species, an ability, an item
and a list of moves. It gives the set a legal stat spread and five validated filler Pokemon. It calls
the `TeamValidator` of Showdown. It returns the problems of the subject only.
The function divides the problems into two lists. The list `banned` holds problems of existence. The
list `pairing` holds problems of compatibility.
The file `tests/probe_pair.js` calls `checkLegal` before it builds a body. A problem in `banned` stops
the probe always. A problem in `pairing` stops the probe unless the caller sets the flag
`iKnowThisPairingIsIllegal`. The flag does not apply to `banned`.
The quiet control ability is exempt from `pairing`. The control must not change with the species.
A new function `firstLegalMove` gives a move the species can learn. Use it for a slot that does not
act. Do not write the name of a move for such a slot. The move `Tackle` is not in this format.

**3.90.0 — THE ENGINE DRAWS A MULTI-HIT COUNT. IT USED AN EXPECTATION BEFORE.**
The function `expectedHitsOf` returns the mean of a hit distribution. For the 2-5 family that mean is
3.1. This is correct for a price. It is not correct for a turn. The authority draws a count from a
twenty-element table and the count is 2, 3, 4 or 5.
A new function `rollHitsOf` draws the count. It takes a move identifier and a random-number function.
It reads the range from the tag. For the range [2,5] it indexes the authority's table. For any other
range it uses a uniform draw and increments `MEDFAILS.multiHitRangeNot2To5`. That counter reads 0.
The battle loop calls `rollHitsOf` once for each use of a move. The call is made when the first target
is priced. It is not made when the move hits nothing. The count travels to `dmgRange` on the seventh
argument. `dmgRange` uses the expectation when no caller supplies a count.
The effects step reads the same count. It rounded the expectation before. Do not compute a fact twice.

**3.89.0 — THE ENGINE NOW READS THE CONDITION ON `buffsHolderOnHit`, AND FOUR HEALING MOVES WORK.**
The function `condHolds` evaluates a tag condition. Before this change it accepted two arguments: the
condition and the body that carries the ability. That is sufficient for a condition about the body. It
is not sufficient for a condition about the incoming move. The function now accepts a third argument.
The third argument holds the hit: the critical-hit flag, the resolved move type, the move category and
the move identifier. Four condition shapes are readable. A condition that is not readable is refused
and counted in `MEDFAILS.buffOnHitUnknownCond`. That counter reads 0.
The function `healParam` returns the size of a heal. It could only read a fraction stored as an array.
The tag for Synthesis, Moonlight, Morning Sun and Strength Sap stores `heal: true`. The function
therefore returned nothing and the move became a wasted turn. `healParam` now returns a recipe. The
resolution site spends the recipe, because the weather can change between the click and the move. The
heal uses `md4096`, which is the authority's own `modify` function. Do not use a plain fraction.

**3.88.0 — TWELVE MOVES WERE PRICED OFF GENERIC GEN-9 DATA INSTEAD OF THIS FORMAT'S, AND THE
BUILDER THAT FIXED THEM WAS ONE RUN AWAY FROM DELETING TEN SPECIES.** Trop Kick read 70 where the
format says 85, Mountain Gale 100 against 120 — ours low in all twelve, and MAG's own table had the
right numbers the whole time, so the two engines disagreed on every one. Asking what a regeneration
WOULD do, before running one, turned up 788 destructive changes waiting in the same builder and a
header stamp whose regex had never once matched. `buffsHolderOnHit` also gained its condition by
derivation — Anger Point only on a critical hit, Justified only on Dark — but **the engine does not
read it yet and nothing behaves differently**, which is said here rather than left to look like a fix.

**3.87.0 — THE SIMULATOR USED TWO DIFFERENT WEATHER VALUES FOR ONE MOVE.** The function `effMoveType`
gives the type of a move. The battle loop uses it. It read the weather directly from the field. The
function `dmgRange` gives the damage. It reads the weather from `effWeatherOf`. That function applies
a PRIVATE weather, which one ability gives only to its own body. The two functions then disagree. A
Weather Ball from that body had a damage value of 128-151 as a Fire move, and the battle loop refused
it as a Normal move. Against a Ghost type, the damage was 0.
CORRECTION: `effMoveType` now calls `effWeatherOf`. Do not copy the logic. One fact has one reader.
RESULT: the census is 326 live of 326 probed, with 0 missing. The roster did not change. The 150-row
damage comparison did not change, at 1 disagreement.

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

**3.83.0 — THE PINCH FAMILY FIRES, AND THE ENGINE'S REFUSAL WAS CORRECT THE WHOLE TIME.** Four
abilities — Blaze, Torrent, Overgrow, Swarm — carry 9,141 sheet uses and had never fired. The
simulator refused them because their condition was recorded as the SENTENCE "only below 1/3 HP", and
this project's rule is that a guessed threshold is worse than no wire. `engine/tag_dex.js` now derives
the condition as a STRUCTURE out of the official engine's own handler,
`{cond:'hpFraction', of:'self', cmp:'<=', num:1, den:3}`, and `condHolds` in
`engine/medicham2-browser.js` evaluates it. The fraction is never collapsed to a float: the test is
`hp × den <= maxhp × num` in integers, because `maxhp × (1/3)` is smaller than `maxhp / 3` and would
refuse a body at exactly one third the boost it is owed. Anything the engine still cannot read
refuses and is counted. New gate: `tests/test-pinch-family.js`, 61 rows against the official engine,
red at 31 of 61 before the change.

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


**3.77.0 — THE DIFFERENTIAL IDENTIFIED A SWITCH TARGET BY TWO DIFFERENT KEYS.** The driver selects a
bench member and records the species identifier. The official-engine side matched on that identifier.
The MEDICHAM side matched on the display name. The two values are equal until a forme change alters
the display name. Forme changes were added in the previous release. After a forme change, the values
differ and the body cannot be selected. Neither side reported the failure: each returned "pass". One
engine could therefore switch while the other did not. The differential now stamps one key at build
time and both sides use it. A failed lookup is counted and printed. The count was 0 and 0 over 120
games.


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

**WIRE 133-137 — THE SPEED TIE, THE SWITCH-OUT CLASS, AND THE LAST MISSING MECHANIC (3.74.0).** The
two engines have disagreed about every speed tie for the life of this project, and the cause is the
SORT rather than the comparison. `Array.prototype.sort` is stable, so two equal actions keep their
input order; the authority uses a selection sort whose swaps move UNTIED actions around, so the tied
group is no longer in input order by the time the tie is resolved. No comparison rule can produce that
from a stable sort. It is not confined to the test instrument: the same function orders every turn the
bot plays, and 91.4% of legal species share a base Speed with another species. The engine now performs
the same selection sort, and resolves the remaining tie with the random key it already drew — a fair
coin under real dice, and the identity under a frozen die, so both engines choose the same body without
either being told the answer. Taking "the later body" was refused: that is what the authority produces
under the frozen die, not the rule of the game. Beside it, three defects that changed a board rather
than a message: Zero to Hero changed forme on the RETURN instead of on the way out, Disguise never
renamed the body, and a Pokemon that pivoted out paid its recoil, its drain and its Life Orb cost from
the bench. Twelve mechanics that had never been probed are now probed; two of them were already
correct and unproved. The mechanic census reads 310 live of 310 probed, and `missing` is zero for the
first time.

**THE TEST USED ONE SET OF DICE. IT NOW USES FOUR (3.73.0).** The differential freezes each random
value so that both engines get the same result. Before this release it froze each value one way only.
The effect was that the speed tie always gave the same order, each move with accuracy below 100 always
missed in both engines, and the damage roll was always the maximum. A move with accuracy below 100 had
therefore never hit in this test. The test now runs four arms. Each arm freezes the values a different
way. Each arm stays fully deterministic. The set of frozen values is recorded in the artifact. If two
runs use different sets, the comparison is refused. This release also changes how coverage is counted.
Before, a mechanic counted as covered when the engine clicked it. A click can do nothing: Haze removes
stat changes, and there were no stat changes to remove. A mechanic now counts as covered only when the
board changes as the tag says it must, or when a declared negative case is reached and it correctly
does not fire. Five mechanics were counted as covered and did nothing. **Do not compare any result
after this release with a result before it. Both changes alter which games the test plays.** One
engine fault was found and is not yet corrected: when two Pokemon have equal Speed, the official
engine moves the later one first and this engine moves the earlier one first.

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

**WHETHER ENGINE CORRECTNESS CHANGES THE LEAF (3.69.0) — THE ANSWER IS WITHHELD.**

`engine/leaf_engine_contrast.js` measures the effect of engine correctness on prediction quality. It
writes `data/leaf-engine-contrast.json`. Read all figures from that file.

Procedure. The tool scores the in-game leaf on a fixed set of positions. It uses 200 rollouts for each
position. It uses the same seed for a given position in both arms. It reads the engine from two frozen
releases. The two releases differ in one file only: `engine/medicham2-browser.js`. The tool stops if
they differ in more than that file.

Results. THE RESULTS ARE WITHHELD.

- `engine/quarantine.js` withholds `data/leaf-engine-contrast.json`. The generator is in the play
  layer. It reads `engine/medicham2-browser.js`. The gate for that file is closed.
- A withheld figure is not printed with a caution beside it. It is absent. This applies to the sample
  size, the paired Brier difference, the confidence interval, the noise floor, the smallest detectable
  effect, the McNemar counts, all rank correlations, the control arm and the calibration error.
- Do not infer a direction from the absence. This document makes no claim about whether engine
  correctness changes prediction quality while the gate is closed.
- The figures become quotable again when two conditions hold. The gate must open. The tool must be
  run again with `node engine/leaf_engine_contrast.js`.

To run the tool:

```bash
SHOWDOWN_PATH=... node engine/leaf_engine_contrast.js --write
```

The tool can resume. Use `--work <dir>` to reuse a previous run's arms. The tool re-runs 24 positions of
each reused arm. The values must be identical. If they are not identical, the tool stops.

`engine/leaf_scoring.js` holds the scoring definitions. To check it against the published artifact:

```bash
node engine/leaf_scoring.js --verify
```

It compares 749 values. All values must match.

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

**Change record for 3.62.2.** The headline metric changed. It was the win rate. It is now the
exploitability. Read ADR-003 for the decision. Read `docs/POKER-TO-POKEMON.md` for the theory.

The reason is a measurement from other persons. VGC-Bench is the only published work in this format.
Its authors trained a policy on more than 700,000 human battle logs. They then improved it with PPO,
self-play, fictitious play and double oracle. The policy defeated a World Championships competitor in
a mirror match. The authors then trained a best response against each of their own agents. Almost all
of the agents were approximately 100% exploitable. Their expert tester wrote that strong human
players adapt and defeat the agent after sufficient successive games.

A fixed policy is a map from a state to an action. In a game with hidden information, a best response
can find the weak states of such a map. This project therefore tests one claim: an agent that
computes a new answer each turn is more difficult to exploit than an agent that recalls a stored
answer. **This claim is not proven. It is the experiment.**

The speed figure also changed. ADR-001 recorded 29 against 3,401 battles/sec/core. It gave a ratio of
117x. The measurement was made again on this machine. Both engines used the same four teams. The
teams are derived from the store. Each run was 8 seconds with a 60-turn limit. MEDICHAM gives 13,041
turns/sec and 217 battles/sec. `champions_sim` gives 523 turns/sec and 28 battles/sec. The ratio is
24.9x. Use `turns/sec`. Do not use `battles/sec`: MEDICHAM ran to its 60-turn limit and Showdown ran
with `choose('default')` to a natural end, so a battle is not the same quantity of work in the two
engines. The old figures stay in ADR-001. The decision in ADR-001 stays correct. The stated reason for
that decision changed: the engine is justified if, and only if, the search gives a measured gain.

The work is now in four phases. Complete MEDICHAM. Then run gate ROADMAP #62. If the gate passes,
build the search and measure the exploitability against approximately 100%. If the gate does not
pass, use the method of VGC-Bench: behaviour cloning, then PPO with self-play, fictitious play and
double oracle. Phase 4 is a result. It is not a failure.

**Change record for 3.47.0.** Two artifacts were computed from an engine that then changed. Do not
quote such an artifact. First measure whether the change moved the feature function: run every
feature column through the old engine and the new engine on the same rows. All 58 columns were
identical on 1,751,688 rows from 9,230 games. Then the two artifacts were computed again with the
new engine. `board.js` gives the priority rule a body with no type list. This is wrong for 0 of
1,751,688 rows. Do not change it yet.

The result of that recomputation is WITHHELD. `engine/quarantine.js` withholds
`data/censoring-value.json`. Its generator is in the play layer. No effect size, no confidence interval
and no held-out sample size is printed here. Run `node engine/censoring_value.js` again after the gate
opens.

**Change record for 3.42.0.** The fit checks whether a recorded action was a click. Some recorded
actions were not clicks. Encore replaced one group of them. A phazing move dragged in another group.
These actions are removed from the training labels. They are counted. Redirected attacks are kept.
They are fitted over a set of two possible targets, not one certain target. The estimator was tested on
data with known answers first. ALL COUNTS AND ALL EFFECT SIZES IN THIS RECORD ARE WITHHELD.
`engine/quarantine.js` withholds `data/policy-weights.json` and `data/censoring-value.json`. Their
generators are in the play layer. Run `node engine/fit_policy.js` and `node engine/censoring_value.js`
again after the gate opens. The overall
top-1 accuracy did not change. Two budget counters were replaced. The old counter measured two
different things at once.

**Change record for 3.45.0.** The matrix did not test a move that can miss. It also did not test a
move with a chance side effect. Many of these are the moves that players use most. The rule was
wrong. Both engines use the same fixed die, so a miss happens in both engines and cancels. The
removed counts are in `CHANGELOG.md`.

The two dice were not the same die. The harness set one die to the middle value. It set the other die
to a different rule. Showdown checks accuracy with the second die. So every move below 100 accuracy
missed in the official engine and hit in the simulator. This made false disagreements. It also made
many cases look empty. Nobody saw this, because all of these moves were removed from the test first.

The harness now checks that the two dice agree. The check runs when the file loads. The matrix stages
2,300 pairs of 8,795. At this release 1,453 of them could occur, and the matrix agreed with the
official engine on 1,436 of these. Release 3.46.0 changed both of those counts. Twelve new faults in
the simulator are recorded. They are not repaired in this release.

**Change record for 3.46.0.** A test needs the other Pokémon to do something while it is hit. The
harness gave it a move for this. If the Pokémon could not learn one of six safe moves, the harness
gave it Protect. Protect stops the move under test. The test then showed no result. A test with no
result looks the same as a test that cannot work. 379 of 2,300 tests were built this way.

The harness no longer uses Protect for this. It uses any move that the Pokémon aims at itself and
that does not block. If no such move exists, the test is not built, and the reason is recorded. A
check stops the run if a Pokémon is given a Protect for this purpose.

From `data/interaction-matrix.json`: 1,642 of the 2,250 tests can occur, and the matrix agrees with
the official engine on 1,642 of these — every one, with `part` at 0. The artifact also records 12
more disagreements in buckets the gate discards. These are real. Read `off_gate` and `off_gate_rows`,
not the agreement rate alone.

The control move for a test whose reactor is a MOVE must not carry the property under test. The
harness used to read that property from a usage-ranked index, which omits a move that carries the
property and that nobody plays. Fifteen contact moves are omitted in this way. One of them was
selected as a control, so both arms of the test made contact and 57 tests showed no result. The
property is now read from the move itself. `engine/linkage_carrier.js` holds the one rule, and both
the index builder and the test generator call it.

Many tests that showed no result now show one. The count of these is in `CHANGELOG.md`. Three new
faults in the simulator are recorded. One new fault in the harness is also recorded. The harness fault
must not be counted against the simulator.

**Change record for 3.44.0.** Psychic Terrain stops a fast move only if the target stands on the
ground. The simulator stopped the move against every target. A target that flies is not on the
ground. A Flying type, a Pokémon with Levitate and a Pokémon with an Air Balloon all fly. A Pokémon
that holds an Iron Ball is on the ground, even if it flies. The simulator now has one function for
this question. Four parts of the simulator ask that function. Before this release three parts each
had their own copy of the rule, and the copies did not agree. Grassy Terrain also used a copy. That
copy healed a Pokémon with Levitate. Grassy Terrain must not heal a Pokémon that flies. All expected
results come from the official engine. The count of tested mechanics is 210 of 213.

**Change record for 3.43.0.** The interaction matrix now checks its own arithmetic. The rule is
`theoretical = staged + dropped`, for each axis. The generator stops if the rule is broken. The rule
found three faults. The count of theoretical pairs was too small by 170. The depth limit on the type
axis lost one pair each time it applied, 32 times. Four cases were counted in two result groups.
After the repair the matrix stages 1,675 pairs of 8,676, and 1,031 of them can occur. The matrix
agrees with the official engine on 1,027 of these 1,031 cases.

**The agreement figure is lower than in 3.41.0. The simulator did not get worse.** The earlier figure
of 899 of 899 was measured on a smaller set. The four cases that disagree were not made before this
release.

**Change record for 3.41.0.** The simulator covers 202 of 205 probed mechanics. Three are missing.
Each has a written reason. The interaction matrix agrees with the official engine on 899 of 899
cases. The pair-layer fit now uses all four team-sheet channels (95,886 turns, 99.7% channel
reach). The value of the sheet was measured on 44,982 held-out decisions: the likelihood gain is
real; a top-1 gain is not shown. The pory family was refit on the current corpus. The DEAD-tag
count fell from 61 to 38.

**Change record for 3.40.0.** The simulator covers 181 of 186 probed mechanics. Five are missing.
Each has a written reason. The two rulebook files were compared. 151 facts were comparable. Two
facts did not agree. The engine now reads the format's own secondary-effect chance. The MAG fit
now uses all four team-sheet channels. A counter proves the channels reached the board (99.67% of
231,722 decisions). The pair-layer fit does not use them yet. The coverage plan changed: mutation
tests come before the handler registry. See `COVERAGE-PLAN-REVIEW.md` for the reasons. ABRA has no
exploitability number.

**Change record for 3.56.0.** The simulator did not use the accuracy of a move correctly. Four rules
change accuracy. The rules are Coil, Wide Lens, Sand Veil and No Guard. We measured each rule two
times. The first measurement had the rule. The second measurement did not have the rule. The two
measurements were the same for all four rules. This shows that no rule had an effect.

There are three causes. The first cause is a table that changed the words `accuracy` and `evasion`
into an empty value. Eleven parts of the simulator read that table. The second cause is that the
simulator did not read items and did not read abilities for accuracy. The third cause is that the
function which makes the accuracy decision does not receive the attacker and does not receive the
target. A function cannot use an item on a body that it does not have.

The simulator now has one function for accuracy. The name of the function is `hitChance`. The
function receives the attacker, the target, the move and the field. Four parts of the simulator call
this function. The accuracy decision now happens after the target is known.

The simulator also did not make a Substitute. It removed one quarter of the health of the user. It
did not give a Substitute to the user. A player made this move 1,976 times. The move was worse than
doing nothing. The simulator now gives a Substitute. A second use of the move fails and does not
remove health. One function decides if a move goes through a Substitute. The damage rules and the
status rules both use that function.

The count of tested mechanics is 231 of 232. One mechanic is missing. The mechanic has a written
reason. Five more rules are known to be absent. Each of the five has a written reason and a usage
count. The largest is Aura, which needs information the damage function does not receive.

**Change record for 3.50.0.** The simulator did not do Taunt. It recorded the Taunt condition. It did
not read the condition. A Pokemon with Taunt could still use a status move. The simulator now refuses
a status move at two times. The first time is move selection. The second time is move execution. The
rule comes from the tag data. It does not use the move name.

A pivot move had the priority of a switch. Parting Shot moved before all other moves. This is not
correct. A pivot move is a move. It now uses its own priority.

Volt Switch changed the user when the target absorbed the move. This is not correct. The user now
stays if the move does no damage.

Yawn worked against Good as Gold. This is not correct. Good as Gold refuses all status moves from an
opponent. The Yawn code now asks.

The count of known differences with the official engine went from 94 to 72.

**Change record for 3.49.1.** The mutation harness reported 97 defect candidates. The two largest were
not defects. The engine reads the Life Orb tag for the damage. The engine uses the item name only for
the recoil. This is latent. The engine ignores the Light Screen tag value on purpose. The tag holds the
singles value. This is a doubles engine. The doubles value is different. The harness now grades each
open operator. It uses four classes. Class A means no lookup and no name branch. Class B means the
engine substitutes its own value. Class C means the engine uses the name. Class D means the test could
not move the value. The grade comes from a parse of the engine source. It does not come from a comment.
No defect candidate is class A. The ratchet counts class A only. Class A is 163 operators. Three known
cases test the rule. The harness stops if the rule fails these cases.

*Written in ASD-STE100 Simplified Technical English. Sentences are short. The voice is active. One
word has one meaning. The document follows the Diátaxis structure: Tutorial, How-to, Reference,
Explanation.*

---

## 1. Tutorial — run ABRA for the first time

Do these steps in order.

1. Get the code. Clone the repository `github.com/willhoop/abra`.
2. Get the sibling engine. Clone `github.com/willhoop/chomp` next to it. ABRA reads it at `../CHOMP`.
3. Open the site. Open `web/index.html` in a web browser. The site needs no build step and no server.
4. Visit a model. Click a house in the town. Open **PORY** and move the sliders. The win % updates.
5. Run one check. In a terminal, run `node engine/validate_damage.js`. It confirms the damage engine.

You now have the site and one validated model.

## 2. How-to — common tasks

**Repair the raw archive before any reparse.**
`MODE=backfill node engine/durable-ingest.js data/games.ladder.jsonl`
The hourly Action appends to the store while the raw archive is gitignored, so CI-collected games have no local raw log. `MODE=reparse` REFUSES to run while any stored game is missing one, because reparse rebuilds the store from the archive and would delete them.

**Read which configuration produced a result (added 3.33.0).**
`node engine/run_stamp.js --show data/rollout-r3.json`
Every gate artifact has a `<name>.meta.json` file beside it. The file records the rollout budget, the
exploration rate, the horizon, content digests of every source the gate reads, the commit, and whether
the working tree was dirty. `node engine/status.js` prints the headline of that file under the gate.
Read three fields before you quote a result. `reconstructed: true` means the stamp was inferred from a
commit and not observed; read `confidence` beside it. `git.dirty: true` means the commit does not
describe what ran; use `source_digests` instead. `source_digests` holds hashes of working-copy bytes
and `git.blobs` holds git object names. Do not compare the two. On Windows they differ because git
changes the line endings.

**Do not quote an engine-speed figure from a document (added 3.62.2).**
There is no script in this repository that measures the speed of the two engines. Three figures are on
record for MEDICHAM — 3,401 battles/sec in ADR-001, 1,606 battles/sec in ROADMAP #61 and 13,041
turns/sec in the 3.62.2 correction. No artifact holds any of them. No test compares them. No ratchet
fails when one of them moves. If you need a speed figure, measure it, record the method beside it, and
state the unit: `turns/sec` compares the two engines and `battles/sec` does not, because the two
engines end a battle under different rules.

**Write a stamp from a new measurement (added 3.33.0).**
Call `require('./run_stamp.js').writeStamp({...})` at the point the run writes its numbers.
Do not write a second sidecar format. One artifact recorded a probability column and did not record
the exploration rate that produced it. A file written at rate 0 and a file written at rate 1 were then
identical byte for byte, and they differed by almost four accuracy points. The published result could
not be recovered.

**Show the project state on a web page (added 3.32.0).**
`node web/build-status.js` then open `web/status.html`.
The build step writes `web/status-data.js`. The page reads a script-tag global. Do not change it to `fetch()`. A `fetch()` of a local file fails under `file://` and shows no error to the reader.

**Show the model select screen (added 3.32.0).**
Open `web/stadium.html`. Run `node tests/test-stadium-roster.js` after you add or remove a model.
The test compares the page against `docs/MODELS.md`. The test fails if a model has no cabinet.

**Compare the engine with Showdown (changed 3.32.0).**
`SHOWDOWN_PATH=... node tests/test-engine-diff.js --seed 20260804`
The sampler is seeded. Two runs with the same seed give the same result. Before 3.32.0 the sampler used `Math.random()` and the count changed between runs. Always record the seed with the count.

**Check that every room parses (added 3.34.0).**
`node tests/test-web-parses.js`
This test runs the inline script of each page through a parser. A page can contain correct text and
still fail to run. On 2026-08-04 a page had one wrong quotation mark. The page showed only its title.
Two other tests gave the page full marks, because they read the page as text.

**Check that the live site has every room (changed 3.34.0).**
`node tests/test-site-sync.js`
`app/` is the folder the web server uses. `web/` is the folder you edit. The test now compares EVERY
page in `web/` against `app/`, and also the data files that a page loads. Before 3.34.0 it compared
one file only, so a NEW page that was never copied stayed invisible. If the test fails, run
`cp web/<page> app/<page>`.

**Check whether an artifact is too old to trust (changed 3.34.0).**
`node engine/provenance.js`
The report gives a drift percentage and, beside it, `ci_gain` and `max_shift`. Use `max_shift`.
It states how far the missing games can move the result. A percentage of a store that grows every
hour only states the AGE of the artifact. No artifact in this project can move a proportion by one
percentage point.

**Run the official Champions engine.**
`SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/champions_sim.js`
Needs a BUILT master checkout; the champions mod is not in the npm package.

**Generate self-play games (MEW).**
`SHOWDOWN_PATH=... node engine/mew.js --n 1000` then `SHOWDOWN_PATH=... node engine/validate_selfplay.js`
Output goes to `data/games.selfplay.jsonl` and must NEVER be pooled with the ladder store.

**Fit the scoring bot's policy.**
`SHOWDOWN_PATH=... node engine/fit_policy.js`
Reads every clean open-team-sheet game, builds one row per human decision, fits by conditional logit,
and writes `data/policy-weights.json`. It prints the held-out comparison against the behaviour clone;
if the fit does not beat the clone it says so in plain words and the weights must not ship.
`engine/selftest.js` refuses a weight file that lost to the clone, and refuses one whose feature list
does not match what `engine/board.js` computes.

**Check the corpus the policy was fitted on.**
`SHOWDOWN_PATH=... node engine/corpus_shift.js`
Compares open-sheet against closed-sheet ladder on the same code: team composition, behaviour given a
board, bot contamination before and after filtering, and mean rating. Run it before trusting a refit.
The teams differ by 551.9 points of total absolute species difference; the measured behaviour differs
by at most 1.49. `fit_policy.js` then re-estimates on a sample reweighted to the closed-sheet species
mix and reports the shift **in standard errors**. Five weights move materially — `priorLogP` by 10.8
SE, `bp` by 6.2 SE (its sign flips) — so the **reweighted vector ships**. Board-reading weights
(`eff`, `immune`, `deadStatus`) do not move: reading the board transfers between the two metagames,
how much popularity is worth does not.

**Pull the Bo3 open-team-sheet ladder.**
`PAGES=6 CONC=20 FORMATS=gen9championsvgc2026regmbbo3 node engine/durable-ingest.js data/games.bo3.jsonl`
CI does this hourly. This format's ruleset carries **`Force Open Team Sheets`**, so every game
publishes all six sets of both sides — the only continuously-collected corpus in which the choice set
of a decision is known. The main ladder format carries plain `Open Team Sheets`, which is optional and
needs both players to agree, which is why only ~1% of the closed store has sheets.
**It goes in its own store and is never pooled with the ladder store** — different information regime,
different metagame. Dedupe it with `python3 engine/dedupe_store.py data/games.bo3.jsonl --write`.

**Play with the scoring policy.**
`SHOWDOWN_PATH=... node engine/mew.js --n 1000 --policy score`

| `--policy` | what it does |
|---|---|
| `random` | Showdown's `RandomPlayerAI`. Correct for plumbing and matchup structure; not valid as training data |
| `prior` | samples the move a species actually clicks, from `data/move-priors.json`. Board-blind |
| `score` | tracks the board and scores every (move, target) pair with the fitted weights. **The only mode that aims** |

Check the run's own accounting: `policy=score` must report ~100% of decisions scored and a non-zero
`aiming:` line. A run reporting 0% is not a scoring bot.

**Compare two policies fairly.** Pass the SAME `--seed` to both runs — MEW derives its team sampling
from it, so the two corpora play identical teams and the comparison is paired rather than confounded
by which teams each happened to draw:

```
node engine/mew.js --n 600 --policy prior --seed 4242 --out data/_a.jsonl
node engine/mew.js --n 600 --policy score --seed 4242 --out data/_b.jsonl
node engine/realism_report.js --self data/_a.jsonl
node engine/realism_report.js --self data/_b.jsonl
```

**Generate self-play at scale (the farm).**
`SHOWDOWN_PATH=... node engine/mew_farm.js --n 200000 --procs 12 --conc 1`

`--conc` must stay at 1. The simulator is synchronous and CPU-bound, so in-process concurrency never
overlaps real work; it only holds N battles live at once and multiplies GC pressure. Measured on
8 physical / 16 logical cores: 8 procs at `--conc 4` gave 11 games/sec, the same 8 procs at `--conc 1`
gave 38. Process count is the unit; 12 procs / conc 1 reproduced at 44–46 games/sec.

Two files are written, and **both are needed**:

| file | contains | read by |
|---|---|---|
| `data/games.selfplay.jsonl` | game-level records (six / brought / lead / winner) | store-shaped engines |
| `data/games.selfplay.raw-logs.jsonl` | full protocol logs, `{id, uploadtime, log}` | PORY, `state_encoder.py` |

The value models reconstruct per-turn board states by replaying the **protocol log**; the records are
summaries and contain no per-turn state. A corpus written without the sidecar is unreadable by the
models it exists to train. Budget ~5 KB per game per file.

**Every battle is replayable.** A record carries `id`, `selfplay.seed`, `selfplay.policy` and
`selfplay.engine_commit`, and both the battle dice and both players' decision PRNGs are derived from
that seed. Re-running the same seed against the same pinned engine reproduces the game byte-for-byte
(verified 25/25, excluding the `|t:|` wall-clock line). This is what makes a claim like "this switch
won the game" checkable rather than asserted.

**Teams are validated against Showdown, not against our own rules.** `packTeam` enforces Item Clause
during packing, then runs the official `TeamValidator` and repairs what it can; MEW discards anything
still invalid rather than recording it. `BattleStream` does **not** validate — it plays whatever it is
handed — so without this gate an illegal team produces a record indistinguishable from a legitimate
game. Before the gate, the validator rejected 80.5% of the pool. Cost is 4.30 ms/team, ~9.6% of a
battle.

**Team preview is sampled, not fixed.** `chooseTeamPreview` draws four of six weighted by measured
P(brought | on team) and two leads weighted by P(lead | brought), from `data/bring-priors.json`
(regenerate with `node engine/bring_priors.js`). `MEW_PREVIEW_TEMP` controls how far the draw wanders
from the common line: 1.0 samples proportional to measured propensity, lower collapses toward the
single most likely bring, higher flattens toward uniform.

**Refresh the official priors.**
`node engine/fetch_smogon_stats.js` then `node engine/smogon_priors.js`
CI does this on the 4th and 11th of each month.

**Pull new replays.**
`PAGES=6 CONC=20 node engine/durable-ingest.js data/games.ladder.jsonl`
The command adds only new games. It never duplicates a game and never re-fetches a stored game.

**Rebuild the meta model.**
`node engine/analyze.js data/games.ladder.jsonl` writes `data/meta-usage.json`.

**Refresh the site data.**
`python3 engine/refresh-site-data.py` writes `data/live.js`, `data/archetypes.json`, and
`data/kad-replays.js`.

**Run a model or an evaluation.**
- GURU matchup matrix: `python3 engine/guru.py`
- XATU belief / policy eval: `python3 engine/eval_policy.py`
- PORY value net: `python3 engine/pory.py`
- CHOMP-EV proof: `node engine/chomp_ev.js`
- SLOWKING preview-Nash (species): `python3 engine/slowking_preview.py`
- SLOWKING preview-Nash (playstyle): first `node engine/playstyle.js`, then
  `MATRIX_FILE=data/playstyle-matchups.json TAG=playstyle python3 engine/slowking_preview.py`

**Validate the damage engine.**
`node engine/validate_damage.js`. It fails if any scenario is more than 5% from the Smogon damage calculator.

**Run the tests.**
`node tests/test-parse.js`, `node tests/test-dynamics.js`, `node tests/test-medicham.js`,
`node tests/test-chomp-ev.js`, `python3 tests/test-jolteon.py`, `python3 tests/test-slowking.py`.

**Edit the site, then mirror it.** After you change `web/index.html`, copy it: `cp web/index.html app/index.html`.

## 3. Reference

### 3.1 Stored game record (`data/games.ladder.jsonl`, one JSON object per line)

| Field | Meaning |
|---|---|
| `id`, `date` | replay id and upload time |
| `p1`, `p2` | `{name, rating, bot}` per player |
| `six.p1/p2` | the six revealed at preview |
| `brought.p1/p2` | the four actually brought |
| `lead.p1/p2` | the two led |
| `sets` | per species, the revealed moves / item / ability |
| `turns` | per-turn events (move, damage, faint, status, field) |
| `winner` | the winning name |

### 3.2 Model outputs

| File | Written by | Contents |
|---|---|---|
| `data/damage-validation.json` | `validate_damage.js` | damage error against the Smogon damage calculator |
| `data/guru-matchups.json`, `guru.js` | `guru.py` | archetype matchup matrix, Wilson CIs |
| `data/xatu.json`, `xatu.js` | `xatu.py` | opponent set/move belief |
| `data/pory.js`, `pory-eval.json` | `pory.py` | mid-game value net + its score |
| `data/chomp-ev.json` | `chomp_ev.js` | the bring proof (null result) |
| `data/playstyle-matchups.json` | `playstyle.js` | playstyle matchup matrix |
| `data/slowking-eval.json`, `slowking-playstyle-eval.json`, `slowking*.js` | `slowking_preview.py` | preview equilibrium + exploitability |
| `data/policy-weights.json` | `fit_policy.js` | the scoring bot's fitted weights, the feature list they were fitted against, and the held-out comparison against the behaviour clone |
| `data/meta-usage.json`, `live.js` | `analyze.js`, `refresh-site-data.py` | usage model + live site counts |
| `data/protocol-events.json` | `derive_protocol_events.js` | every event Showdown can emit, which of them `medicham2` emits, and a written reason for each one it does not |

### 3.2a Protocol trace (`engine/medicham2-browser.js`)

The simulator can emit a Showdown-shaped protocol stream. It is **off by default**; nothing in the
battle loop pays for it unless a caller asks.

**To turn it on:**

```js
const trace = [];
const S = M.battleInit(teamA, teamB, { trace });
M.battleTurn(S, rng);
// trace is an array of protocol lines:
//   |move|p1a: incineroar|fakeout|p2a: garchomp
//   |-damage|p2a: garchomp|154/175
//   |cant|p2a: garchomp|flinch
```

**To read it:**

| Export | Does |
|---|---|
| `M.TRACE_EVENTS` | the 36 event names this engine claims it can emit |
| `M.traceCounts(lines)` | counts by event name, PARSED from the lines rather than kept beside them |
| `M.traceCanon(line)` | the one normaliser — lowercase and strip whitespace **per field** |

**Identifiers are ids, not display names.** The engine writes `p1a: incineroar` and `fakeout` where
Showdown writes `p1a: Incineroar` and `Fake Out`. This engine holds no display-name table and
inventing one would be a translation layer that can itself be wrong. `traceCanon()` is applied to
**both** streams by any comparison driver, which makes the two agree by canonicalisation rather than
by translation.

**Do not add an event without regenerating the artifact.** `node engine/derive_protocol_events.js
--write` fails if a name in `TRACE_EVENTS` is one Showdown never emits, and fails if a Showdown event
is neither emitted nor given a reason. `tests/test-protocol-trace.js` fails if a claimed event never
fires in a real game.

### 3.3 Continuous collection

A GitHub Action (`.github/workflows/ingest.yml`) runs the pull hourly and commits the store. A
separate tests workflow runs the test suite and the damage validation on every push and pull request.

## 4. Explanation

### 4.-2 Why the exploitability is the headline metric (added 3.62.2)

**This section explains a decision. It does not give instructions.** For the decision itself, read
ADR-003.

**There are two kinds of game.** In the first kind, both players see all of the state. Chess and Go
are of this kind. A search over that state is correct, and one best move exists at each position. In
the second kind, each player holds private information. Poker is of this kind. VGC is also of this
kind: you do not see which four of the six the opponent brings, the items, the abilities, or the
fourth move of a set.

**In the second kind of game, one best move does not exist.** The correct object is a mixed strategy.
If you always make the same choice in the same situation, an opponent who watches you can find that
choice and defeat it. This is why the poker research of 2007 to 2021 produced CFR, DeepStack,
Libratus and ReBeL, and not a larger chess search.

**A fixed policy is therefore exploitable by construction.** A behaviour clone is a fixed policy. A
PPO agent is a fixed policy. Both give one answer for one state. VGC-Bench measured this on its own
agents: it trained a best response against each agent and found approximately 100% exploitability,
although one of those agents defeats a professional player. The two facts are consistent. Strength on
average and readability under study are different quantities.

**A win rate cannot show this defect.** A win rate is measured against a population that does not
adapt. An exploitability is measured against an opponent that is trained against you. Only the second
measurement finds a policy that is strong today and readable after five games.

**The claim under test in this project.** A search that computes a new answer each turn shows no
fixed map to an opponent. It should therefore be more difficult to exploit than a compiled policy.
Three properties of VGC can defeat this claim, and all three are open:

| property | why it can defeat the claim |
|---|---|
| simultaneous moves | sequential CFR does not apply directly to a turn node |
| stochastic resolution | damage rolls, accuracy and speed ties add variance to every leaf |
| short horizon | a median game is 6 turns, so there is little depth for a search to use |

**Do not read this section as a result.** The project has no exploitability figure.
`data/exploitability.json` is declared void. The comparison with approximately 100% is prepared and
not yet made.

### 4.-1 Why additivity is the recurring failure (added 3.28.0)

The same defect has now appeared at three levels of this project, and it is worth stating once
because the fix has the same shape every time.

**A sum of independent terms cannot express a conjunction.** If a score is `w1*a + w2*b`, there is no
setting of `w1` and `w2` that makes "a AND b together" worth more than the parts. Not *scored badly*
— **not representable**.

Where it bites:

| level | the thing that cannot be said | consequence |
|---|---|---|
| **one Pokémon** (PORY, §4.0) | "material lead matters on turn 3, not turn 25" | the neural net exists for this |
| **two Pokémon** (MAG → DODUO) | "Protect with A while B removes the thing killing A" | independent per-slot choice; MAG aims both attacks at one foe ~50% of the time where humans do 23.4% |
| **six Pokémon** (JOLTEON → DITTO) | "Pelipper + Archaludon is worth more than the sum" | measured: the additive species block moves the score by ~6.3 while the two non-additive terms move it by ~0.4, so hill-climbing converges on the top-6 by weight |

**The literature agrees and names the boundary.** Cooperative multi-agent value factorisation (QMIX,
Rashid et al. 2018) constrains the joint value to be *monotonic* in each agent's utility, and QPLEX
and Weighted QMIX exist precisely because that constraint cannot represent non-monotonic
coordination. Our case is the non-monotonic one.

**But the expensive machinery does not apply here.** That literature is about avoiding enumeration
when agents are many. With **two** Pokémon the coordination graph is a single edge, so Variable
Elimination degenerates to enumerating the joint actions and Max-Plus message passing is unnecessary.
Measured on a real mid-game board: **9 × 8 = 72** joint actions per side, of which only **28** have a
non-zero interaction term — the other 44 score exactly as the sum of two singles already computed.

**And the fix is not "add the interaction term", it is "fit it for the right thing."** DODUO's pair
block exists and is fitted; it loses at 42.0% because it was fitted to *resemble human pairs* rather
than to *win*. Expressiveness was necessary and not sufficient.

**Practical rule.** Before adding a feature, ask whether the thing you want to say is a conjunction.
If it is, no weight on an individual term will ever say it — and if the model already has the
interaction term, check what objective it was fitted to before concluding the idea failed.


### 4.0 What a neural network is here, and why it is not automatically an upgrade

Every model in ABRA answers one question: given the board right now, what is P(I win)? PORY answers it
with **logistic regression** — multiply each feature by a weight, add them up, squash to 0..1:

    p = sigmoid(w0 + w1*alive_diff + w2*hp_diff + ...)

That can only draw a straight dividing line through feature space. It cannot express *"being one
Pokémon ahead matters enormously on turn 3 and barely on turn 25"*, because that is an **interaction**
between two features, and a sum of independent terms has no way to say it.

A **neural network** is the same idea with a middle step. Inputs are combined into H hidden units,
each its own weighted sum passed through a nonlinearity (ReLU: `max(0, x)`), and those are combined
into the answer:

    h = relu(W1 @ x + b1)     # H learned intermediate quantities
    p = sigmoid(W2 @ h + b2)

Each hidden unit can become a detector for a **conjunction** — "ahead on material AND my active is
faster AND Trick Room is not up" — and the output layer weighs the detectors. Universal approximation
(Cybenko 1989; Hornik 1991) says one hidden layer of sufficient width can represent any continuous
function on a bounded domain, so the network is strictly **more expressive** than the linear model.

**Strictly more expressive is a claim about representation, not about learning.** Extra capacity spent
on features that contain no interactions buys nothing and costs variance. The relevant fact is that
PORY's five material features carry two degrees of freedom, and against a logistic on
`alive_diff + hp_diff` alone — same gradient descent, same standardisation, same split — PORY **ties**:
0.623623 to 0.623623, a paired difference of +0.000001 (positive = PORY worse), 95% CI
[−0.000026, +0.000029] clustered by game over 1,177 held-out games, containing zero. If the features
carry no more signal, a network fitted to them lands in the same place — and reporting otherwise would
be measuring the estimator rather than the game.

**WITHDRAWN: the pair this paragraph quoted for the same claim.** It read *"PORY's six material
features are beaten by two of them"* with a two-number comparison attributed to
`engine/pory_baseline.py`. Both halves are wrong to state as current fact. That script **prints its
table and writes no artifact**, so the figures never had a source to check them against — the same
P1 class as the PORY coefficients `docs/MEASURE.md` corrects. It also scored every arm on the **unfiltered raw
archive**, most of which is bots, forfeits and stubs; its clean-data filter landed five days after the
figures were published, and the clean corpus moves every arm by more than the gap between them. And
the claim itself is superseded: on the current corpus the comparison is a **tie**, not a loss, which
is what the numbers above report and what `docs/MODELS.md` has recorded since. The withdrawn pair is
left standing in `docs/REVIEW-2026-07-25.md`, the review that measured it, and is not restated here.

This is the lesson the game-playing literature learned repeatedly. **TD-Gammon** (Tesauro 1994) needed
hand-designed board features, not checker counts. **AlphaGo Zero / AlphaZero** (Silver et al. 2017,
2018) feed the value head a *stack of planes* — piece positions, repetition, side to move — because
material is precisely the baseline a value net must beat, and it beats it by seeing **where** the
pieces are. Leela Chess Zero's ablations show the value head collapsing toward the handcrafted
evaluation when the positional planes are stripped.

So the binding constraint was **representation, not capacity**. `engine/state_encoder.py` supplies the
planes: HP per slot, active vs benched, status, stat boosts, weather / terrain / Trick Room / Tailwind
/ screens, hazards, and the active Pokémon's types — 121 features where PORY had 6.

`engine/pory_nn.py` then separates the two explanations rather than conflating them, by running eight
arms on one split:

| arm | what it isolates |
|---|---|
| `B2` logistic, `alive_diff + hp_diff` | **the bar** — two material features |
| `L6` logistic, PORY's six | PORY itself |
| `LR` logistic, rich features | gain from **representation** alone |
| `N6` network, PORY's six | gain from **nonlinearity** alone |
| `NR` network, rich features | both |

If the network wins only on `N6`, the gain is nonlinearity. If only on `LR`, PORY was feature-starved
rather than model-starved. If neither beats `B2`, that is the result and it is reported as such.

Species identity is deliberately **excluded**: ~240 species one-hot across 8 slots is a
1,920-dimensional input, which on ~9,000 real games would be fitted almost entirely to noise. Species
enters only through type. Embeddings become defensible once the self-play corpus is large enough, and
the encoder is versioned so that change is visible rather than silent.

Two methodological points that decide whether any of these numbers mean anything. **Splits are by
game, never by state** — turns within a game share an outcome, so splitting on states leaks the label
across the boundary and flatters every arm equally. And **every state is emitted twice with the sides
swapped**, because antisymmetry in the two players is a property of the game; a model trained on p1's
view alone will not respect it.

**Store raw, analyse on top.** ABRA saves every game with every fact it may ever need. Every filter —
rating tier, humans-only, archetype, playstyle — runs over the store at read time. A change to how the
games are segmented is a re-computation, not a re-download. This makes the fetch a one-time cost and
keeps the analysis free to change.

**Support decisions, do not predict outcomes.** In this format, the winner of a game is near-impossible
to predict from the two team sheets; even a player-rating model ties a coin. ABRA therefore judges each
model on a decision, not on the match result. Each probability ships a proper score (log-loss or
Brier), a confidence interval, and an honest baseline.

**Why the confidence interval is clustered.** States within one game are correlated. A confidence
interval that resamples states would be too narrow. ABRA resamples whole games instead. For a matchup
matrix, it also resamples each cell from its Beta distribution before it solves, so the interval
carries the small-sample uncertainty.

**Honest negatives are kept.** Two results are negative and are reported plainly: the team-picker's
brings do not beat a coin (CHOMP-EV), and the playstyle rock-paper-scissors cycle rests on small
samples and is suggestive, not settled. A negative that is measured is more useful than a positive that
is asserted.

---

**Companion documents.** [White paper](ABRA-whitepaper.md) · [Deck](ABRA-deck-plain-english.md) ·
[Project summary](SUMMARY.md) · [Model ledger](MODELS.md) · [Changelog](../CHANGELOG.md)


## How to measure against a frozen engine

### Description

An engine release is a copy of every file whose content can change a measured number. A measurement
reads the copy. Other work on the repository does not change the copy.

The set of frozen files is declared as `SOURCES` in `engine/engine_release.js`. Read it from there.

```bash
node -e "console.log(require('./engine/engine_release.js').SOURCES.join('\n'))"
```

**Do not copy that list into this page.** It has grown four times — loader dependencies were added so
`REL.require` can resolve, lazily-read data files were added so a snapshot can actually play a game,
and the fitted weights were added because "can anything beat MAG" is a claim about one specific
vector. This paragraph said **twelve** and named twelve files until 2026-08-22, by which point the
declaration held more than twice that many. A release that is a valid digest set but not a loadable
engine is the failure the additions each fixed, and a typed list here cannot track them.

The release identifier is a digest of the file digests. If the files do not change, the identifier does
not change. A second cut of the same files makes no second copy.

### Procedure — cut a release

1. Make sure the files you want to freeze are correct.
2. Run this command. Give a reason.

```bash
node engine/engine_release.js cut "why this release exists"
```

3. Read the digests in the output — one per entry in `SOURCES`, and the count is whatever that
   declaration currently holds. Confirm the Showdown commit is not `UNKNOWN`.

### Procedure — measure against a release

1. Open the release at the start of the measurement.
2. Load every engine file from the release, not from `engine/`.
3. Put the stamp in the artifact you write.

```js
const REL  = require('./engine_release.js').open();
const MEDI = REL.require('engine/medicham2-browser.js');
const artifact = Object.assign({}, REL.stamp(), result);
```

`REL.stamp()` writes `engine_release`, `showdown_commit` and `source_digests` into the artifact.
`engine/provenance.js` reads `source_digests` and compares the content. An artifact without this stamp
can only be checked by timestamp, and a timestamp cannot show that a file changed after it was read.

### Procedure — check a release

```bash
node engine/engine_release.js list          # each release, and how many files have moved since
node engine/engine_release.js verify <id>   # has the copy itself changed?
```

`list` shows the drift. Drift is normal. Drift tells you if an old number still describes the engine
that ships today.

### Warning

Do not read `engine/` files during a measurement. Another division can write them at any time. This
does not cause an error. It causes a number that is wrong and looks correct.

On 2026-08-04 three divisions ran at the same time with separate files. The weights of the model under
test changed between the two halves of one measurement. The measurement completed. No check failed.
7,100 games were lost.
