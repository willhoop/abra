# Supporting Decisions in a Near-Unpredictable Game

**Version 5.266.0 · Last updated 2026-09-06**

**5.266.0 — THE WHOLE-GAME FIGURES ARE RESTORED ON MEASURED COUNTS: BOARD-MATERIAL 27 OF 961, PROTOCOL FIRST DIVERGENCE 93 OF 961, NARRATION-ONLY 70 OF 961, ON RELEASE `57679ef9a4a3`.** 5.265.0 published no whole-game count anywhere, and that was the correct answer at the time: the hazard-sweep order fix moved `engine/medicham2-browser.js`, so every whole-game artifact had been measured on release `d9e551ed0d5a` while the tree was `57679ef9a4a3`, and `engine/status.js` withheld rather than captioned. The re-measurement has been done. **This is a restoration and is written as one, not a silent reappearance.** `data/game-differential.json` is republished, generated `2026-09-06T17:42:35Z`, with pins identical to the superseded run: 961 games, cap 20, arm `middle`, steering `empirical-click/v1`, `--end-state`, census pin `data/verification/census-pin-9446a684709d.json`, pool `--team-store data/team-pool-frozen`, `team_pool_digest` `0d103fb9fa87` over 1,968 teams picked from a corpus of 8,778. Full account: `docs/_reports/2026-09-06-publish-5266.md`.

**EVERY OPERAND OF EVERY SUBTRACTION IS NAMED, BECAUSE THE WRONG OPERAND WOULD LOSE FIVE DEFECTS AND LOOK RIGHT.** The gating quantity is `state.games` **961** less `state.games_board_never_diverged` **934**, both read off `state`. The reporting quantity is `state.protocol_diverged_games` **93**. Narration is `state.protocol_diverged_board_never_did` **71** raw, less the **1** declared row, across 69 causes. **`by_cause_totals.games_board_material` reads 22 in this artifact and is NOT the bar**; the five-game difference is exactly the games that part a BOARD while the protocol never diverges at all, which carry no cause, no class and nothing to grep. Separately, 10,452 of 10,541 turn boundaries compared were identical — that is not this clause's denominator and always reads greener, because a game counts once if ANY boundary parted.

**IT IS A RE-MEASUREMENT, NOT A RESTATEMENT, AND THE DIFFERENCE IS SHOWN RATHER THAN ASSERTED.** `git show HEAD:data/game-differential.json` — the artifact as 5.264.0 and 5.265.0 found it — reads release `d9e551ed0d5a` with 961 / 934 / 93 / 71 and pool `0d103fb9fa87`. The new artifact reads release `57679ef9a4a3` and the identical five numbers: the same question, asked twice, on two engines, with the same answer. `engine/arms_comparable.js` answers **COMPARABLE, exit 0** on that pair and did not refuse. Its three declared blind spots are unchanged and are not claimed closed — a computed require path in the driver, `data/protocol-events.json` being unstamped, and an uncommitted edit inside `SHOWDOWN_PATH`.

**WHAT THE GATE READS, IN ONE FRAMING RATHER THAN TWO.** `engine/status.js` computes nine clauses and **two fail** — the whole-game BOARD-MATERIAL clause and the whole-game NARRATION clause — and **both fail on measured disagreements on the current bytes**, not on staleness. Eight of the nine GATE, narration being the one that does not, so exactly one of the eight gating clauses fails and the gate reads CLOSED. Those are the same state counted over two different sets and they are never quoted side by side. At 5.265.0 seven of nine failed and every one of the seven failed on the release mismatch alone — an answer about other bytes rather than a weaker answer. **Moving from unmeasured back to measured-and-red is this version's result**, and it is the reverse of the step this document recorded at 5.265.0.

**EVERY ARTIFACT THE RELEASE MISMATCH HAD STALED WAS RE-RUN ON `57679ef9a4a3`, AND NONE OF THEM MOVED.** `data/engine-diff.json` reads **0 of 6000** at the midpoint and at each of the sixteen band indices, seed 20260804, with 134 multi-hit comparisons skipped by construction. The deliberate roster reads `FIRED-AND-BOARDS-DIFFER` and `DID-NOT-FIRE` at **zero on all three stages**, with 140 of 148 items, 129 of 202 abilities and 475 of 500 moves tested. `data/all-mechanics-fire.json` played 1,313 games with **0 threw**. `data/mechanics-census.json` reads **830 live of 830 probed, 0 missing**, `run_ok` true.

**THE PREDICTION CARD READ SIX OF SIX WITH NO MISSES, AND FLAT WAS CALLED BEFORE THE RUN.** `data/verification/_prediction-remeasure-57679ef9a4a3.json` carries `written_before_the_run: true` and claims no tolerance band: games, board-material, protocol, narration raw, the pool digest and the teams-and-picked pair were all predicted exactly and all measured exactly. The named risk was registered too — that the 961-game draw is a *different* sample from the 777-game one rather than a superset, so 184 unplayed teams could have surfaced an ordering difference. It did not materialise. A flat prediction written down in advance is worth publishing precisely because it could have been wrong in a way nobody could argue about afterwards.

**THE 777-GAME SAMPLE 5.265.0 LEFT OPEN IS DIAGNOSED, AND IT IS `--games` RATHER THAN THE POOL CACHE.** That version recorded, correctly, that a matched pinned pair read 777 games where the published run read 961 under the same declared pins, and declined to guess. Reproduced deterministically against the frozen store: `--games 960` gives pool `b2b61ec40281`, 1,597 picked and **777** games; `--games 1200` gives pool `0d103fb9fa87`, 1,968 picked and **961** games. The rapidspin pair ran at 960 and the published run at 1200. **The durable half is a rule: `--games` is part of the sample DEFINITION, not a budget.** Two runs on identical declared pins and different `--games` draw different strides and are not a before/after. `engine/arms_comparable.js` already refuses on `games` differing, so the guard exists — what failed is that a report recorded the pins and not the command, and a run whose command is not written down cannot be audited.

**THE POOL PIN IS HONOURED, AND THAT IS A CONFIRMATION WITH ITS EVIDENCE RATHER THAN AN ASSURANCE.** `--team-store data/team-pool-frozen` reads the frozen bytes: the pinned cache's `source_content_digests` for `games.bo3.jsonl` is `2fd61bf80133`, the sha1 of `data/team-pool-frozen/games.bo3.jsonl` at 109,006,606 bytes, against the live store's `1a47b971bc46` at 227,347,410 bytes. Replaying `buildSwarm(2400, { storeDir: 'data/team-pool-frozen' })` reproduced all four steering fields exactly — the pin itself, `team_pool_teams` 8778, `team_pool_picked` 1968 and `team_pool_digest` `0d103fb9fa87`. The digest is taken over the picked team KEYS per configuration, so it is a receipt for the population and not merely for the path, and a swapped frozen store would move it. **Nothing published on that pool is withdrawn.**

**THREE DEFECTS ARE FILED AND NONE IS FIXED, WHICH IS THE DIVISION RULE AND NOT A DEFERRAL.** `engine/game_differential.js:6450` calls `SWARM.buildSwarm(...)` at module scope **above** its own main guard at `:6733`, so requiring the module rebuilds `data/diff-team-pool.json` from whatever store the caller's argv names (ROADMAP #546). `engine/diff_swarm.js:329` stamps `source_digests` from the fixed `POOL_SOURCES` literal at `:272`, which names the LIVE paths, so a pinned cache carries a live-store receipt beside the correct frozen one — **a receipt that describes the wrong store is worse than no receipt** (#547). And `game_differential.js` throws for any `--turns` below 3, because `identicalAtEndOfTurn` is `[1, 2, 3]` at `:7837` while `agreementByTurn` runs `1..MAXTURNS` at `:7857` and the cross-check at `:7866` indexes the shorter array (#548). No release SOURCE was edited on this pass.

**WHAT REMAINS WITHHELD INCLUDES THIS PROJECT'S HEADLINE METRIC, AND RESTORING THE WHOLE-GAME COUNTS DOES NOT TOUCH IT.** MEDICHAM is not correct — one gating clause fails on a measured count — so leaf calibration (`data/winrate-backtest.json`), the leaf/engine contrast, the click-censoring census, every rollout figure, the exploitability search and the fitted weights are absent from this document rather than captioned. It was not run on this pass. **No reliability curve is published in this version and none is implied by anything above.** The MAG refit likewise stays owed as a REFIT and not a restamp: `data/policy-weights.json` was not touched, and the damage table those weights were fitted against has been regenerated since — `engine/feature_fixture.js --check` fires its damage-table gate against the **318** species stamped into that file and reports a table that is now wider and carries a different digest — so the feature FUNCTION's input changed and a restamp would write over the evidence for the refit.

**5.265.0 — A HAZARD SWEEP RAN ITS CLAUSES IN ONE FIXED ORDER AND THE THREE CARRIERS EACH USE A DIFFERENT ONE. THE CENSUS READS 830 LIVE OF 830 PROBED AND 0 MISSING, AND NO WHOLE-GAME FIGURE IS PUBLISHED THIS VERSION.** `data/mechanics-census.json` reads **830 live of 830 probed, 0 missing**, `run_ok` true, with 0 armed-but-hollow and 0 thrown. The version answers two direct questions. Rapid Spin has four clauses in this format — the own side's hazards, the user's own Leech Seed, the user's own partial trap, and a 100% +1 Speed secondary — and Champions changes only its PP. The own-hazard clear had a real board probe; the own-Leech-Seed clear was exercised only through Mortal Spin's arm; **the partial-trap clear had no probe anywhere**, with a counter the engine wrote and nothing read. That is the "a capability that cannot prove it ran is assumed broken" shape, and it is now one census row, shown RED per clause by deleting each clause from the tag before the engine loads.

**THE DEFECT THE SECOND QUESTION EXPOSED IS AN ORDERING ONE, AND IT WAS INVISIBLE TO EVERY BOARD PROBE BY CONSTRUCTION.** `sweepField` ran one fixed clause order for all three carriers. Staged against the authority on an identical board, the spin family writes its Leech Seed `-end` above its `-sideend`, Defog writes the target's side before its own, and Tidy Up writes its Substitute `-end` below both side lines. **The board is identical under every one of those**, which is precisely why three green board probes sat over it: this is a narration defect, and narration is the second gate Will named on 2026-08-22 rather than a thing that may be waved through. The repair follows the authority's own skeleton — what comes off a BODY first, side conditions next, field and trap last — and every step is gated on a param already in `data/tags.json`, so no move is named in code and no tag regeneration was required. `tests/probe_hazard_sweep_order.js` asserts the emitted sequence in both engines, and was re-run on this pass rather than accepted on report: green, with the parent re-running itself under `MEDI_SWEEP_LEGACY_ORDER=1` and all three arms going red.

**AND THE ENGINE SOURCE MOVING IS ITSELF THE HEADLINE FOR THIS DIVISION.** The tree is now release `57679ef9a4a3` while the whole-game differential, the damage differential, the three roster stages and the staged-mechanics artifact were all measured on `d9e551ed0d5a`. `engine/status.js` computes nine clauses and **seven fail** — and **all seven read MEASURED AGAINST A DIFFERENT ENGINE**, across six artifacts. Not a weaker answer: an answer about other bytes. **No clause is red on a measured disagreement right now**, which is a worse state than a red one and must not be reported as the same thing — moving from measured-and-red back to unmeasured is a step backwards, and this document said so at 5.252.0 when the step went the other way. Eight of the nine GATE, narration being the one that does not, so six of the eight gating clauses fail and the gate reads CLOSED. **Every count in those five artifacts is WITHHELD and none is restated here**, because a caption is not a quarantine and this document has paid for that lesson twice. The re-measurement is owed on the current release and its commands are named in `docs/MEASURE.md`.

**WHICH SCOREBOARD THIS WAS SUPPOSED TO MOVE WAS CALLED BEFORE THE RUN, ON A DERIVED REASON, AND THE CALL HELD.** Rapid Spin appears 0 times on the frozen pool's sheets, so the lab was expected to move and the pinned pool was expected to sit still. A matched pair with the same census pin, the same `data/team-pool-frozen` store, the same arm and the same steering, differing only in the release, read **777 games, 98 diverged, 2 threw on both sides**, with the two run logs byte-identical apart from the release id. One attribution inside that pair is recorded as OPEN rather than accepted: the pair read 777 where the published run read a larger sample under the same declared pins, and the offered cause — a pool-cache rebuild — does not survive reading the cache, which is keyed on the store it was told to read and rebuilds deterministically from it. The pair is valid against itself; the difference against the published run is unexplained and is owed a diagnosis before the next publishing run.

**5.264.0 — THE PUBLISHED WHOLE-GAME FIGURE IS BOARD-MATERIAL 27 OF 961 AND PROTOCOL FIRST DIVERGENCE 93 OF 961, ON A DIE THE AUTHORITY DRAWS AND NEVER READS.** `data/game-differential.json` is republished on release `d9e551ed0d5a` — **the release does not move, because no engine source moved.** The change is one file and it is the INSTRUMENT, `engine/game_differential.js`; `engine/medicham2-browser.js` is untouched. The gating quantity is a subtraction and both operands are read off `state`: `state.games` less `state.games_board_never_diverged`, 961 less 934. The reporting quantity is `state.protocol_diverged_games`, 93. Conditions, identical on both runs of the pair: 961 games, cap 20, arm `middle`, steering `empirical-click/v1`, `--end-state`, census pin `data/verification/census-pin-9446a684709d.json`, pool `--team-store data/team-pool-frozen`, `driver_code_stable` true throughout. Full account: `docs/_reports/2026-09-06-dice-address-pass.md`; this pass: `docs/_reports/2026-09-06-publish-5264.md`.

**THE CAUSE IS ONE STEP UPSTREAM OF WHERE THE HAND LIST AIMED, AND THAT DISTINCTION IS THE RESULT.** `BattleActions#selfDrops` draws `random(100)` at `sim/battle-actions.ts:1325` on every self-drop move, and **no legal move in this format ever reads the value** — all ten moves carrying `self.boosts` leave `self.chance` undefined, and Curse assigns `self` at runtime and leaves it undefined too, so the `typeof … === 'undefined'` short-circuit discards the roll every time. That dead draw sat in the shared `any` address bucket at `nth 0`, which pushed the post-hit ability coin to `nth 1` on the authority against `nth 0` here: **the two engines drew different numbers for the same event.** The repair gives the dead draw its own address category, `sdrop`, a bucket this engine never draws in — ROADMAP #478's `tgtla` rule through a different door — and the `any` addresses the authority named while this engine never did fall from three figures to 18. The receipts are published in the artifact rather than asserted here: `mid_void.selfdrop_enters` 2235, `mid_void.selfdrop_draws` 1925, `mid_void.selfdrop_knob`, and `mid_void.selfdrop_seen` keyed `move|random(args)`.

**THREE SUB-FAMILIES CONFIRMED, TWO REFUTED, AND THE REFUTATIONS ARE PUBLISHED AS REFUTATIONS RATHER THAN QUIETLY DROPPED.** The hand list named one family of twelve board-material games. Poison Touch, Flame Body and Cursed Body each reproduced, every one with a control on the same bodies that shares its address exactly. **Sleep is REFUTED** — staged Sleep Powder shares its address and both engines slept the target for the same three turns — and **freeze was predicted not to move and did not**, because Champions' thaw sits below `setActiveMove` and above the hit, so no self-drop draw can precede it. Both are separate defects and both are **still open**. So the family was neither twelve mechanic bugs nor one thing: nine of the twelve were one instrument defect and three are not this at all. Both refusals were written to `data/verification/_prediction-selfdrop-address.json` under `not_claimed` BEFORE the measuring run, which is the only reason they can be read as refutations now rather than as omissions.

**THE DELTA COULD NOT BE PUBLISHED AS A BEFORE/AFTER, SO IT WAS NOT.** The addressing contract is hashed into `PIN_DIGEST`, so the pins moved and the instrument file moved with them, and `engine/arms_comparable.js` answered **NOT COMPARABLE** about the prior artifact against the new one, naming both causes. A **third arm** was run instead — identical bytes, identical pins, with the restore knob `MEDI_MID_SELFDROP_SHARED=1` armed — which `arms_comparable` calls **COMPARABLE**, and which reproduces the superseded publication to every digit: board-material 34, protocol 100, narration 70, 10429 of 10539 turn boundaries identical, 5 void, 1 threw, 717 authority-only `any` addresses and 669 `identical` verdicts. **That is what makes the fall attributable to one cause**, and it is the difference between a measured delta and two numbers printed next to each other. **The caveat is stated rather than left to be found: `arms_comparable` cannot see an environment variable.** It calls the pair COMPARABLE while the arms differ by exactly the variable under test, which is why `selfdrop_knob` and `selfdrop_draws` are published in BOTH artifacts — the two files declare the difference themselves.

**THE PREDICTION CARD READ TEN OF TWELVE AND BOTH MISSES ARE NAMED.** Board-material was called 30 against a measured 27, inside its own registered band of 26 to 34. And the claim that the new bucket swallows only `random(100)` **is false on the pool**: `outrage|random(2,4)` lands there through the ELSE branch of `selfDrops`. It is inert — a range-form draw is pinned and consumes no shared address — and the probe's assertion was corrected to a two-clause one rather than left standing. A card that records a miss against a band it wrote down first is worth more than a card that hits, because it is the only kind that can be audited.

**THE NARRATION CLAUSE READS 70 OF 961 AND DID NOT MOVE, WHICH IS ITSELF THE EVIDENCE THAT THE FALL IS REAL.** The clause counts games that diverge in narration and never part a board: 71 raw, less 1 declared, across 69 causes. Because repairing a board moves a game OUT of the board column and INTO this one, a fall in board-material with a flat narration column is a fall in the two columns read together, not a transfer between them. The clause REPORTS and does not hold the gate shut, per Will's call of 2026-08-22, and begins gating automatically when BOARD-MATERIAL reads zero.

**WHAT THE GATE READS, IN ONE FRAMING RATHER THAN TWO.** `engine/status.js` computes nine clauses and **two fail** — the whole-game BOARD-MATERIAL clause and the whole-game NARRATION clause, both on measured counts. Eight of the nine GATE, narration being the one that does not, so of the gating clauses exactly one fails and the gate reads CLOSED. Those are the same state counted over two different sets and they are never quoted side by side. Nothing downstream moved: the census reads 829 live of 829 probed and 0 missing (`data/mechanics-census.json`), and the damage differential reads 0 of 6000 at the midpoint and at each of the sixteen band indices on the same release, seed 20260804 (`data/engine-diff.json`).

**AND THE NEXT TARGET IS NAMED WITH EVIDENCE INSTEAD OF LEFT AS A COUNT.** Five of the 27 part a board while the protocol never diverges at all, and **three of those five are one family**: `p*.active[*].stall` reading `medi 0` against `sd 3`, the authority's body still holding a `stall` volatile at counter 3 while this engine's counter reads 0. Nothing on the wire reports it, because the counter is internal. **The obvious staging does not reproduce it** — Protect then attack, and Protect-Protect then attack, agree at every boundary — so the `duration: 2` grace is modelled and the condition is something else. It wants its own sweep across the six legal `stall` movers and across a faint, a drag and a turn that never reaches the residual, and saying so is worth more than a guess that would have to be withdrawn.

**5.263.0 — THE PUBLISHED WHOLE-GAME FIGURE IS BOARD-MATERIAL 34 OF 961 AND PROTOCOL FIRST DIVERGENCE 100 OF 961, ON FIVE FURTHER ENGINE FIXES MEASURED ONE AT A TIME.** `data/game-differential.json` is republished on release `d9e551ed0d5a`, with pins identical on every run in the sequence: 961 games, cap 20, arm `middle`, steering `empirical-click/v1`, `--end-state`, census pin `data/verification/census-pin-9446a684709d.json`, pool `--team-store data/team-pool-frozen`, and `driver_code_stable` true throughout. The gating quantity is a SUBTRACTION and both operands are read off `state`: 961 games less the 927 whose board never diverged. The five steps, each with a `MEDI_*` restore knob and a probe shown RED before any engine code existed: **`Battle#boost` refusing when the boosted body's foe side is empty** (41 to 38, 108 to 105), **a damaging pivot that emptied a side not pivoting** (38 to 36, 105 to 103), **an ability SCALING a status chip — the new tag `scalesOwnStatusDamage`, Heatproof halving its own burn** (36 to 35, 103 to 102), **the mega phase running below the previous action's `Update` pass** (board-material held at 35, protocol 102 to 101), and **a fainted body's ability no longer being ignored, so Pickpocket cannot steal from a corpse** (35 to 34, 101 to 100). `node engine/status.js` reads **7 of 9 clauses passing**; the two failures are the whole-game BOARD-MATERIAL and NARRATION clauses, both on measured counts. Full accounts: `docs/_reports/2026-09-06-longtail-batch-F.md` and `docs/_reports/2026-09-06-publish-5263.md`.

**THE BY-CAUSE TABLE THAT STEERED THREE BATCHES IS KEYED ON THE FIRST PROTOCOL DIVERGENCE, AND THE BAR IS READ OFF A DIFFERENT LIST.** `mid_void.any_bucket.by_cause` answers *how many games carrying this protocol cause also parted a board*; it does not assert that the protocol cause IS the board cause, and neither list is derivable from the other. The bar reads `state.first_board_divergences`, which carries one row per board-material game with the turn and the exact leaves. Re-read against that list: batch E's judgement that a Parental Bond `-hitcount` clause cannot move the bar is **CONFIRMED** — that game parts at turn 6 on a Parental Bond HP mismatch, not on the `-hitcount` line; **25 of the 34 carry causes the `any`-bucket join measures as instrument-suspect**; and **12 of the 34 are one family**, a status landing in one engine and not the other (Poison Touch six times, Flame Body, Cursed Body, a sleep counter, a freeze thaw). Their fix is to give the post-hit ability proc its own dice address category, which moves `PIN_DIGEST` and is owed its own pass. **Five further games part a board with no protocol divergence at all** (`state.board_parted_before_the_protocol_did` reads 5), and by construction those have no by-cause row to be steered by. This is the same failure shape this document records elsewhere: a well-formed table answering a question adjacent to the one being asked.

**NINE OF TEN PREDICTED VALUES HIT, AND THE ONE MISS NAMED ITS OWN MECHANISM IN ADVANCE.** The mega/`Update` step's board-material was called 34 and measured 35. Its prediction file records why: one narration-only game left the diverging set — protocol 102 to 101 with the bar unmoved — and the shared-coin game was RE-LABELLED from the White Herb ordering onto a Pickpocket row it had been standing in front of. That relabelling is where the fifth fix came from, and closing it took the bar to 34. A prediction that misses and explains the miss with a named mechanism is worth more than one that hits, because it is the only kind that can be audited.

**THE NARRATION CLAUSE READS 70 OF 961 AND THE FALL IS REAL IN BOTH COLUMNS.** The clause counts games that diverge in narration and never part a board: 71 narration-only raw, less 1 declared, across 69 causes. It read 71 at 5.262.0. Because repairing a board moves a game out of the board column and into this one, the two columns must be read together — 41 + 71 = 112 at 5.262.0 against **34 + 70 = 104** now. The clause REPORTS and does not hold the gate shut, per Will's call of 2026-08-22, and begins gating automatically when BOARD-MATERIAL reads zero. It is a LOWER BOUND on defects, not a count of them: a game records only its first divergence, so a defect that is never earliest is not counted at all.

**THE RE-RUN THE PASS OWED, AND WHY IT WAS OWED.** The new tag shifted the tag array in `data/tags.json`, twenty-two rows moved, and the browser bundle `data/abra-tags.js` was left stranded — `engine/artifact_audit.js` reported twenty-three tag rows out of sync. The node engine never read the stale bundle (`engine/tags.js` opens the JSON), but a red gate is fixed in the session that sees it: the bundle was rebuilt, the audit reads no gaps, the tree was re-cut as `d9e551ed0d5a` and every clause the pass staled was re-run on it. None moved. The damage differential reads **0 of 6000** at the midpoint and at each of the sixteen band indices (seed 20260804, 134 multi-hit comparisons skipped by construction); the deliberate roster reads **items 140, abilities 129, moves 475** tested with `FIRED-AND-BOARDS-DIFFER` and `DID-NOT-FIRE` at zero on all three stages; the census reads **829 live of 829 probed, 0 missing**.

**5.262.0 — THE PUBLISHED WHOLE-GAME FIGURE IS BOARD-MATERIAL 41 OF 961 AND PROTOCOL FIRST DIVERGENCE 108 OF 961, ON SIX ENGINE FIXES MEASURED ONE AT A TIME ACROSS TWO BATCHES.** `data/game-differential.json` is republished on release `14b62cd5aeec`, with pins identical on every run in the sequence: 961 games, cap 20, arm `middle`, steering `empirical-click/v1`, `--end-state`, census pin `data/verification/census-pin-9446a684709d.json`, pool `--team-store data/team-pool-frozen`, and `driver_code_stable` true throughout. Batch D: **King's Shield's stat punish routed through `Battle#boost`** (board-material 50 to 48, protocol 114 to 113), then **an ability arriving mid-battle running its own `Start`** (48 to 46, 113 to 111). Batch E: **the authority's second in-move `eachEvent('Update')`** (46 to 44, 111 to 109), **Pickpocket paid on `AfterMoveSecondary`** (44 to 43, 109 to 108), **the status road settling its Update before a body leaves on Shed Tail** (43 to 42), and **a redirect clearing `move.smartTarget`** (42 to 41). Every one carries a `MEDI_*` restore knob and a probe shown RED before any engine code existed, with a silent control. `node engine/status.js` reads **7 of 9 clauses passing**; the two failures are the whole-game BOARD-MATERIAL and NARRATION clauses, both on measured counts. Full accounts: `docs/_reports/2026-09-06-longtail-batch-D.md`, `docs/_reports/2026-09-06-longtail-batch-E.md` and `docs/_reports/2026-09-06-settled-publish-pass.md`.

**THE NARRATION CLAUSE IS NEW THIS SESSION AND ITS COUNT MOVED 69 TO 71. THAT IS NOT A REGRESSION AND IT MUST BE WRITTEN AS WHAT IT IS.** The clause counts games that diverge in NARRATION and never part a board, so **repairing a board moves a game out of the BOARD-MATERIAL column and into this one** — the game still diverges, it simply no longer diverges about state. `data/verification/longtail-D-anybucket.json` holds `protocol_diverged_board_never_did` **70** at batch D's publication, which is **69** once the one declared row is subtracted. `data/game-differential.json` now holds **72** raw and **71 after the same subtraction, across 70 causes**. The two columns together read 46 + 69 = 115 games at batch D and **41 + 71 = 112** now, which is the three-game fall the six fixes actually bought. The clause REPORTS and does not hold the gate shut — Will's call of 2026-08-22 — and begins gating automatically when BOARD-MATERIAL reads zero.

**THE `any` DICE BUCKET IS MEASURED, AND IT PUTS A VERDICT ON 39 OF THE 46 BOARD-MATERIAL CAUSES STANDING AT BATCH D.** `mid_void.any_bucket` in `data/game-differential.json` is INSTRUMENT-ONLY: it voids nothing, consumes nothing, and was proven three times to leave `classes`, `first_divergences` and `end_state` byte-identical. **13 causes have shared coins and are the simulator's; 26 do not and are WITHHELD**, including all six Poison Touch rows, which move from suspicion to a filing backed by a measurement. This is the difference between a cause chased because it looks like a defect and a cause chased because an instrument says the two engines drew the same die and disagreed anyway.

**AND THE RULER ITSELF WAS THE DEFECT IN THE OTHER HALF OF THIS SESSION.** `engine/quarantine.js` had **quarantined itself**: its `requiresOf` stripped comments and not string literals, and the file's own selftest fixture map contains the literal `require('./medicham2-browser.js')`, so the gate was in the play layer by its own reckoning and dragged `status.js`, `open_work.js`, `register_reality.js`, `docs_scan.js`, `where.js`, `orient.js` and `sweep.js` with it. The classifier is derived now — **an artifact the gate READS is an exit-condition input by construction** — and the typed list survives only as a declared residual of two, `million_run` and `medicham_coverage`, which the gate does not read.

**WITHHELD ARTIFACTS FELL FROM 72 TO 63.** Exactly nine moved and every one of the nine is an instrument; **nothing downstream moved**, so the weights, the rollouts, the leaf backtest, the exploitability search and the leaf contrasts are all still absent. A classifier repair that released a MODEL figure would have been the repair being wrong.

**SEPARATELY, A CONTENT HASH HAD BEEN PASSING FOR A MEASUREMENT.** The figure lexer now derives its exclusion from ROLE — a digit run glued to a letter is part of a token, not a measurement — which closed a coincidence engine inside `data/policy-weights.json`'s integer `featureHashes`, and generalises past hashes to release ids and format names without naming any of them. It **unmasked four documents restating `data/protocol-events.json` as `emittedCount 38 / notEmittedCount 56` where that artifact reads 44 / 50**, and has read so since 2026-08-26.

**WHAT IS STILL WITHHELD, AND IT INCLUDES THIS PROJECT'S HEADLINE METRIC.** MEDICHAM is not correct, so leaf calibration (`data/winrate-backtest.json`), the leaf/engine contrast, the click-censoring census, every rollout figure and the fitted weights are all absent from this document rather than captioned. **No reliability curve is published in this version and none is implied by anything above.**

**AND THE MAG REFIT STAYS OWED, AS A REFIT RATHER THAN A RESTAMP.** No fit was started and no fitted vector was written. The damage table these weights were fitted against has been regenerated and now covers four more species than the 318 stamped into `data/policy-weights.json`, so the feature FUNCTION's input changed. A restamp would answer the fixture gate, silence the table gate, and write over the evidence for the refit.

**5.260.0 — BOARD-MATERIAL HELD AT 50 OF 961 AND PROTOCOL FIRST-DIVERGENCE FELL 151 -> 114, ON FOUR FIXES MEASURED ONE AT A TIME.** Pins identical on every run: census `data/verification/census-pin-9446a684709d.json`, pool `data/team-pool-frozen`, arm `middle`, steering `empirical`, `--end-state`, cap 20, 961 games. Step by step: **Struggle's missing `-activate` line took protocol to 137**; **the item announcement moving from `onTry` down to `onTryHit` took it to 130**; **`mustrecharge`'s priority moved NOTHING in the pool, by design and as predicted**; **a move with no legal target announcing its own failure took it to 114**. `data/game-differential.json` is republished at 50 / 114 on release `a985300cb8ed`, reproducing the last fix step to the byte on `classes`, `first_divergences`, `state.first_board_divergences` and `end_state`. `node engine/status.js` reads **7 of 9 clauses passing**, both failures being the whole-game clauses on their measured counts. Full account: `docs/_reports/2026-09-06-longtail-batch-C.md`.

**THE LARGEST BUCKET IN THE ARTIFACT WAS A LINE ROADMAP #84 HAD ALREADY DERIVED AND HALF-WIRED.** `useMoveInner` writes `attrLastMove('[notarget]')` and `add('-fail', pokemon)` when a non-field move has no legal target (`sim/battle-actions.ts:508-513`); this engine set `moveThisTurnResult` and emitted nothing, with the authority's own `add('-fail')` quoted in the comment one line above the code. **32 of the 130 first-divergence rows carried a bare `|-fail|`**, and it had never been named — because it was found by bucketing the FULL by-cause list out of a `--dump-games` run rather than the `first_board_divergences` sample, which is capped at 40 and is not the population. Seventeen of the 32 closed; the other fifteen are other `-fail` causes and are itemised in the report.

**EVERY BOARD-MATERIAL CALL WAS 50 AND EVERY ONE LANDED; THE FOUR PROTOCOL CALLS MISSED BY ONE, ONE, ZERO AND TWO.** Each was written to `data/verification/_prediction-longtail-C-*.json` before its run. The misses are all the same shape and are recorded rather than rounded off: a bucket's row count is an upper bound on what closes, because a game whose first divergence is repaired may carry a second one behind it. Measured across the three moving buckets, 14 of 17, 8 of 8 and 16 of 17 closed outright.

**AND FOUR SEPARATE TIMES THE NEW PROBES ACCUSED THE ENGINE OF SOMETHING THE MEASUREMENT THEY DEFEND CANNOT SEE.** `|split|SIDE` carries the omniscient line then the spectator line and the differ keeps only the first; `[miss]` is appended to a `|move|` line the differ truncates to four fields; `[of]` and `[silent]` are dropped by two declared equivalences — that pair accused a probe's own CONTROL arm; and every `|-ability|` line is mapped to null. A probe stricter than its own measurement reports defects that measurement cannot see, which is the mirror image of the failure this project usually pays for. All four rules are now applied inside the probes with the differ's own line numbers beside them.

**5.259.0 — TWO PUBLISHED FIGURES ARE CORRECTED, AND BOTH ARE CITATION FAILURES RATHER THAN MEASUREMENT FAILURES.** §4.4's full-bring sentence attributed a length ratio and a kept/dropped pair to `data/quality-filter.json`; that file has six commits and none of them holds either count, and no version of it has ever carried a mean-turn field, so the citation never held on any day. The counts are corrected to the artifact's own funnel step — `provenance.funnel.after_min_turns` **26,142** to `provenance.funnel.after_full_bring` **18,908** — and the RATIO is withdrawn rather than restated, because nothing measures a mean turn count today. Separately, the WEB ledger was republishing a leaf calibration figure out of a QUARANTINED artifact; a caption is not a quarantine, so it is now WITHHELD, together with MILTANK's head-to-head share, which the same ledger carried with no artifact cited at all. Full account: `docs/_reports/2026-09-06-figure-corrections.md`.

**5.258.0 — THE PUBLISHED FIGURE AND THE MEASURED FIGURE ARE ONE FIGURE AGAIN: `data/game-differential.json` IS REPUBLISHED OFF A SETTLED TREE AND HOLDS BOARD-MATERIAL 50 OF 961 AND PROTOCOL FIRST-DIVERGENCE 151 OF 961.** Release `db248fe67a5e`, 961 games, cap 20, arm `middle`, steering `empirical`, `--end-state`, one census pin and `--team-store data/team-pool-frozen`. The artifact had carried a 46 measured on a superseded release for 1.3 days, and **both whole-game clauses were failing on WITHHELD STALENESS rather than on a count**; they now fail on the measured counts, which is the honest state and is what makes the pair quotable again. 911 games never part a board at all, 4 of the 50 part a board while the protocol never diverges anywhere in the game, and 10376 of 10539 compared turn boundaries were identical. The settled-tree run reproduces the last fix step **to the byte** on `classes`, `first_divergences`, `state.first_board_divergences` and the by-cause summary, which is why the republication is a publication and not a sixth measurement.

**FIVE ITEMS LANDED, EACH MEASURED ALONE SO EACH IS ATTRIBUTABLE, AND THE PINS WERE HELD IDENTICAL ACROSS EVERY RUN.** Starting from board-material 59 with protocol 161: **Big Root beyond `drain` took it to 58 / 160**; **Leech Seed's residual to 56 / 158**; **the staged-pin repair moved nothing at all, by design, and was re-measured paired to prove it**; **Fairy Aura to 51 / 153**; **Beat Up's ally order to 50 / 151**. Every step ran on its own frozen release, each fix had a probe shown RED before it and green after it, each had a knob that restores the defect and moves no byte of either control, and each carried a written prediction filed before the run. Three of the five landed at their point estimates and two did not; the misses are recorded below rather than rounded off.

**THE TWO ENGINE FINDINGS WORTH THE MOST ARE BOTH "THE HANDLER RETURNS EARLIER THAN THIS ENGINE THOUGHT".** Big Root's item declares **five** heal sources — `drain`, `leechseed`, `ingrain`, `aquaring`, `strengthsap` — and this engine had readers for one, both of them on the drain road filtering `from.includes('drain')`; the order matters as much as the list, because `Battle#heal` truncates the base BEFORE `TryHeal` runs, so a 155 HP Ingrain is `trunc(155/16) = 9` and then `modify(9, 5324, 4096) = 12`, while folding the multiplier into the fraction reaches 12 by luck and truncating after a float multiply reaches 11. And `leechseed.condition.onResidual` looks its sower up by slot and **returns before it damages anything** when that slot is empty or the body in it has fainted — this engine gated only the HEAL on that lookup, so **a seed whose sower had died went on taking `maxhp/8` a turn off a body the real game stops touching.** That is a board leaf and not a message, and it had never been measured; the two narration halves of the same handler travelled with it.

**THE INSTRUMENT FINDING IS THE ONE THAT SHOULD CHANGE HOW A FIGURE HERE IS READ: THE STAGED PINS WERE BOUND TO THE WRONG ARM FOR FOURTEEN DAYS AND BOTH CLAUSES PASSED BY LUCK THROUGHOUT.** `engine/game_differential.js` read `const PRIMARY_ARM = ARMS[0]`, and `ARMS[0]` stopped being the max-damage arm on 2026-08-13 when the opt-in `middle` arm was prepended — an arm whose own comment says it is not part of the default set and whose dice are live. All four failures of `tests/test-game-differential.js` were that one line. **The engine was never implicated:** a 14-call control held our damage interior constant at `108..127` while the authority's wandered and on one run lost its own minimum, and once the pins were bound BY NAME the authority's span came DOWN onto ours (knock-off `108..177` to `108..127`, contact punish `66..104` to `66..78`) with our own numbers never moving in either scenario. `PRIMARY_ARM` itself is untouched, because it is the arm the run plays. **A green clause that has never been shown able to go red is not evidence**, and this pair was green only until a hash change on 2026-08-27 made the drift visible.

**AND THE REPAIR BROKE COMPARABILITY BY CONSTRUCTION, SO IT WAS PAID FOR RATHER THAN ARGUED.** Changing the instrument moved `driver_code` from `e87506b2d737` to `0c1fc935a5fb` over eleven files, which is exactly the stamp this project added one version earlier so that a pair like this cannot be assumed. It was re-measured **paired**, on the same release, the same census pin and the same pool: board-material 56 to 56, protocol 158 to 158, with `classes`, `first_divergences`, the end state and every first board divergence identical. The stamp that made the break visible is what allowed the claim.

**CORRECTION — THE "1.53× PROTECT AMPLIFICATION" PUBLISHED IN THE VERSION BELOW WAS MEASURED AGAINST THE WRONG RULER, AND RENORMALISATION IS ONLY HALF OF IT.** Decomposed on the run's own 17,532 decisions, so that no step is a comparison across populations: the declared input reads **13.565%**; the SAME table's marginal, weighted by the decisions this arm actually took, reads **16.209%** — a factor of **1.195** that is not a driver defect at all but the arm playing a census-steered pool whose bodies carry the family at a higher rate than the ladder's own click distribution; renormalising onto the moves each body carries reads **20.257%**, a factor of **1.250**; and the sampler realised **20.374%**, faithful to a factor of **1.006**. **So `13.565%` is the wrong denominator to charge the driver against.** The right same-table denominator for this run is 16.209%, and against it the arm reads 1.257 rather than 1.53. Any future statement of the form *"the arm reads X% against 13.565%"* must carry the pool-matched marginal beside it, because a run whose census pin changes moves that denominator.

**AND THE SECOND HALF OF THAT CORRECTION RUNS AGAINST THE EARLIER DIAGNOSIS RATHER THAN BESIDE IT: LEGALITY SUBSETTING IS NOT A CAUSE, AND ITS SIGN IS BACKWARDS.** The mean candidate set on this run is **3.772** of four, not the approximately 3.14 previously reported, and conditioning on it shows that **87.0% of decisions — 15,253 of them — already have all four moves and are the ones reading 21.724%**, while a body narrowed to a single legal move reads 8.134%, because a body down to one move is usually down to its attacking move rather than to its Protect. That part of the earlier diagnosis is **withdrawn**. What survives is the renormalisation itself, and it now has a size measured held-out against ground truth with a noise floor under it: on 185,422 scored human clicks the marginal reads 14.233%, the driver's rule reads 16.228% and humans did 14.757%; split-half on games at 92,949 and 92,473 clicks, **the half-vs-half spread of the observed rate is 0.002 points** while the rule over-predicts by **+1.644 and +1.646 points**, which is 800 times the floor and therefore real, and a carriage correction removes about 72% of it. It is named and not tuned away in this version, because it changes the driver's declared input and repairing it beside five engine fixes would leave none of them attributable.

**TWO PREDICTIONS MISSED AND BOTH MISSES ARE THE SAME CLASS OF ERROR, WHICH IS WHY THEY ARE PUBLISHED.** The Leech Seed step called **58 / 157** and read **56 / 158**: it reasoned from `state.first_board_divergences`, which is **capped at 40 rows and is a SAMPLE rather than the population**, and the sowerless chip was in the other nineteen. The Fairy Aura step called **54 / 156** and read **51 / 153**: it credited only the causes that name a Floette-Mega as the damage target, when the aura prices any Fairy move by any user with `target !== source` — **the cause string names the VICTIM, not the mechanic**, so a Gengar, an Archaludon and a Kingambit eating a boosted Fairy move were the same defect all along. Both misses ran in the good direction, and both are the identical mistake of treating a capped list as a census.

**WHAT THIS VERSION DOES NOT ESTABLISH, WRITTEN OUT SO IT CANNOT BE INFERRED.** The gate did not open: `node engine/status.js` reads **7 of 9 clauses passing**, and the two that fail are the whole-game BOARD-MATERIAL clause, which gates, and the whole-game NARRATION clause, which reports. **No quarantined figure becomes quotable** — leaf calibration, every rollout figure, every head-to-head and every model report that reads a rollout stay WITHHELD rather than annotated. **The MAG refit stays OWED and it is a REFIT rather than a restamp:** `data/policy-weights.json` was not touched, no fit was started, and the damage table under the fitted vector has moved from 318 species to 322, so the feature function's input changed and a restamp would write over the evidence for the refit instead of answering it. Owed and not claimed fixed: Struggle's `-activate` line (17 games, pending a `tags.json` regeneration), Poltergeist announcing at use time where the authority announces inside `onTryHit` (7 games), and `mustrecharge` carrying priority 11 and so outranking sleep and freeze. Two narration gaps were measured beside the aura work and are NOT fixed — no Fairy Aura ability line on the carrier's entry or mega, and no Unnerve ability line on a switch-in — and both belong to the narration gate. Filed as INSTRUMENT rather than engine, with the reason stated: about 6 Poison Touch, Cursed Body and Flame Body games draw in the `any` bucket that `midGameVoid` already declares unreadable, and 5 `stall` games carry a board divergence with no protocol divergence at all, which `--dump-games` cannot show. Full accounts: `docs/_reports/2026-09-06-apply-three-fixes.md`, `docs/_reports/2026-09-05-longtail-batch-A.md`, `docs/_reports/2026-09-05-red-endpoints-and-protect-prior.md`, `docs/_reports/2026-09-06-publish-pass.md`.

**5.257.0 — THE DRIVER WAS NOT CHOOSING PROTECT TOO OFTEN. IT WAS BEING HANDED ONE OPTION, AND THAT IS A DIFFERENT DEFECT WITH A DIFFERENT FIX.** `engine/game_differential.js`'s `prefer` axis read as a preference and behaved as a **hard narrowing**, applied at every decision in two swarm configs of nine whose preferred set contains the protect family. **22.2% of decisions reached the sampler carrying exactly ONE candidate, and 60% of those were Protect** — so more than half the arm's protect clicks were never sampled at all, they were the only thing on the table. The diagnosis this replaces is the one a rate alone supports: that the policy over-weighted a move. It did not. **On decisions where the body still had its full four moves the arm already realised 15.3%, which is the human rate.** A sampler cannot be accused of a choice it was never offered, and no amount of re-weighting the input would have moved a decision with one candidate in it.

**THE PAIRED MEASUREMENT, WITH THE ARM NAMED ON IT: 961 GAMES EACH, RELEASE `688e696f00c8`, EMPIRICAL ARM, THE DRIVER RULE THE ONLY DIFFERENCE.** The protect-family share of clicks fell **32.77% → 20.79%** against an input table of 13.565% and a human rate of 14.76%; P(protect | protected last turn) fell **68.58% → 36.48%** against humans at 10.50%. The consequence that matters for every other figure in this document is that **games that finish went 56% → 79%** — resolved **539 → 762**, still running at the cap **418 → 189**. Board-material moved **34 → 47** on that pair and **that rise is the expected consequence of the fix rather than a regression against it**: a game that ends reaches late-turn positions the old arm never played, so the comparison gained board states rather than losing accuracy. A whole-game count is not comparable across a driver change in the direction a reader expects, and this is the second time in two nights that a driver change reset a baseline instead of improving one.

**ALL SIXTEEN REMAINING COMPARATOR LEAVES WERE ADDRESSED: COMPARED 40 → 54, AND THE STANDING HOLE IS 16 → 0.** Fourteen were wired, each shown INVISIBLE before the wire and caught after it against a board already reading 40 leaves, every one with a silent control. Two could not be wired and **both refusals are derived rather than asserted**: `volatile:unburden`, because the engine holds nothing under that name — the speed doubling is recomputed from the current ability inside an `_hadItem && !m.item` guard, so there is no field to compare — and `volatile:powershift`, because Champions un-bans the move and then no legal body learns it. The probe derives that carrier count on every run and fails the moment it is non-zero, so the denominator cannot quietly shrink.

**CORRECTION — THE JOINT ARM WAS NEVER NON-DETERMINISTIC, AND THAT CLAIM IS WITHDRAWN.** What was published, in this version's changelog note and in `docs/_reports/2026-09-05-leaf-widening-all16.md`, was that `joint-empirical-click/v1` gave **167, 167, 138** on identical pins, that the cause was under investigation, and that until it was settled every joint figure of the night — 110, 53, 167, 138 — was one draw from an uncharacterised distribution and could not be quoted as a result. **It is settled, and it is not what was suspected.** Six runs on one identical set of pins split perfectly cleanly either side of the protect fix, which landed at 02:27: the three runs on the old driver read protocol/board-material **121/34, 121/34 and 138/53** with `prefer_narrowed` at 20,507, 20,507 and 20,353; the three on the fixed driver read **167/69, 167/69 and 147/55** with `prefer_narrowed` at 0. Both sides are **bit-identical within themselves, down to `credit_events` and `shuffle_calls`**. So there is no distribution to characterise, **the joint 53 STANDS and is reproducible**, and the withdrawal is of the diagnosis rather than of the observation.

**THE REAL DEFECT IS LARGER THAN THE ONE THAT WAS WITHDRAWN: THE PINS FREEZE EVERY INPUT AND NEVER FROZE THE CODE THAT READS THEM.** A measurement here pins three things — the engine release, the census, the team pool — and all three are INPUTS. The instrument that consumes them was never digested at all. `engine/arms_comparable.js` was asked directly about two of these runs and answered *"COMPARABLE. Both arms selected their sample the same way, so a difference between their numbers is the change under test"*, about two runs playing different driver code. Its own limits block had named the hole in the same breath — *"THE DRIVER ITSELF … no artifact records its digest. WIRE 4 asserted it by hand"* — which is the finding worth carrying: **a named limit is not a guard, and prose that describes a hole is indistinguishable from a check that closes it right up until it is tested.** What now stands in its place is measured rather than asserted: `engine/steering.js` digests the instrument's own require closure into `steering.driver_code`, `engine/game_differential.js` re-takes that digest at write time and VOIDS a run whose instrument moved under it — withholding `diverged`, `mid_void` and `state` rather than captioning them — and `arms_comparable.js` now COMPUTES that limit line from the two artifacts in front of it instead of typing it.

**CORRECTION — THE EMPIRICAL ARM ON THE FIXED DRIVER READS 55 BOARD-MATERIAL, NOT 47.** The 47 is real and is correctly paired against 34 in the protect measurement above; it is the figure **from before the leaf widening landed**, and the widened comparator reads 54 leaves where that run read 40. On the current instrument the empirical arm stands at **147 protocol / 55 board-material**. The two are not a disagreement and neither supersedes the other on its own terms — they are a rate measured through two different comparators, which is exactly why a whole-game figure is never quoted here without the arm and the artifact beside it.

**THE RESIDUAL PROTECT RATE IS 1.53× ITS OWN INPUT, AND THAT IS A SECOND, MEASURED DEFECT THAT IS NAMED RATHER THAN TUNED AWAY.** The move-prior table the driver reads (`move-priors.json`, under `data/`) holds a marginal P(move | species) which the driver **renormalises onto the four moves the body actually carries** — row mass 0.917 spread over 8 becomes 0.521 over about 3.1 — and Protect, being on almost every body that has it in the marginal, always survives the subsetting. It is not fixed in this version deliberately: it changes the driver's declared input, and repairing both in one pass would leave neither attributable.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE, BECAUSE THE PUBLISHED ONE IS NONE OF THE ABOVE.** `data/game-differential.json` was again NOT republished. It holds board-material 46 of 961, that is what `node engine/status.js` prints, and it is stale as a description of tonight's engine — it is left that way on purpose, because republishing onto the live artifact while the simulator and the instrument are both under edit is how a figure arrives that nobody can trace. Every figure in this section is in a verification artifact under `data/verification/`, one per arm, each with a knob-cleared control beside it. Full accounts: `docs/_reports/2026-09-05-protect-amplification.md`, `docs/_reports/2026-09-05-leaf-widening-all16.md`, `docs/_reports/2026-09-05-cap-or-stall.md`.

**5.256.0 — A CHARGED MOVE STRUCK THE WRONG SLOT, AND IT WAS INVISIBLE BY CONSTRUCTION RATHER THAN BY OVERSIGHT.** `vol.charging`'s release turn aimed at `live(foes)[0]`, where the authority replays the `targetLoc` stored on the sub-volatile — so a Phantom Force charged at slot b came out of hiding and struck slot a. **No instrument in this repository could have seen it before tonight.** The driver in use until this version resolved every foe-aimed click with the lowest live index for both slots, so re-aiming was a no-op by construction: the two engines aimed at the same body whatever the volatile had recorded, and a targeting defect and a correct targeting implementation produce identical play. **The driver's focus-fire bug was hiding a real targeting defect**, and only replacing the driver made the defect a thing an instrument could disagree about. The claim written on the defect card was also real and was the minor half of the pair: the charge wrapper surviving a BeforeMove refusal fires **2 times in 961 games**, against a re-aiming error that reaches the board in a large fraction of every game a charge move appears in.

**EVERY FIGURE BELOW BELONGS TO AN ARM, AND THE TWO ARMS MAY NOT BE PAIRED — `arms_comparable` REFUSES TO PAIR THEM BY DESIGN.** They are different policies playing different games, so a movement in one is not a movement in the other and their difference is not an effect. **Joint arm: board-material 110 → 53, protocol first-divergence 191 → 138, VOID 38 → 4.** **Empirical arm: board-material 35 → 34, protocol 120 → 121.** Charge moves are now entirely absent from `unshared_address_shapes`, which is where the VOID collapse comes from — a charge move re-aimed differently in the two engines put a die at an address only one side ever drew. The census is level at 829 of 829 with 0 unprobed, and the engine gate is back to **2 of 9** failing clauses.

**THE PUBLISHED WHOLE-GAME FIGURE IS NOT ANY OF THOSE, AND NAMING THE ARTIFACT IS NOT OPTIONAL.** `data/game-differential.json` still holds board-material 46 of 961 and that is what `node engine/status.js` prints. It is stale as a description of tonight's engine, it was again deliberately not republished, and it is superseded only by a settled-tree pass and never by a sentence in this document. The measurements above live in this version's verification artifacts under `data/verification/`, one per arm, with the knob-cleared control beside each.

**THE CONTROLS ARE THE PROOF, AND WITHOUT THEM THE MOVEMENT WOULD BE AN ASSERTION.** Knob-cleared runs — the same release, the same pinned pool, the same driver, with the two fixes switched off — reproduce the old figures **exactly**: joint 110 and empirical 35, against 53 and 34 with the fixes live. `engine/engine_release.js drift` confirms that only `medicham2-browser.js` moved between the two releases. **So the entire 57-game movement in the joint arm is these two fixes and nothing else**, which is a stronger statement than a before-and-after on a tree that was also being edited, and it is the only form in which a 57-game movement can be attributed at all.

**THE FIXTURE ONLY EXISTED FOR AN HOUR BEFORE IT PAID, WHICH IS AN ARGUMENT ABOUT ORDER RATHER THAN ABOUT LUCK.** `vol.charging` was filed earlier the same night as REAL and **UNSTAGEABLE**: `scripted()` fell back to a target field that a locked move's request does not carry, the authority refused the choice, and **no staged scenario in this repository had ever played a two-turn release turn.** The joint driver's VOID games are what made it stageable — dominated by `phantomforce`, `electroshot` and `solarbeam`, against zero charge-move shapes in the control arm. The repair was then one line: `Pokemon#getMoves(lockedMove)` returns no `target` field, so the encoder no longer supplies one, which is the unscripted chooser's own rule applied to the scripted one. **Every directed scenario can now reach a release turn and none ever had**, and the `directed` block did not move — all three roster stages, `all_mechanics_fire --kind all` and nine adjacent scripted probes are unchanged.

**THIS IS THE SECOND TIME IN ONE NIGHT THAT A DRIVER CHANGE EXPOSED A DEFECT RATHER THAN CAUSING ONE, AND THE PATTERN IS WORTH MORE THAN EITHER INSTANCE.** The coverage-to-empirical swap took board-material 0 → 135 by playing games that end instead of games that run to a cap; the focus-fire-to-joint swap has now exposed a targeting defect that a constant aim made unobservable. **Neither number was wrong; both were statements about a population.** A differential measures the simulator only over the space of situations its driver actually reaches, so a driver is part of the ruler and not part of the subject — and a figure taken under one driver is not comparable with a figure taken under another, however similar the two look.

**A GREEN TEST WAS ASKING NOTHING, AND HAD ONLY EVER PASSED BY LUCK.** `tests/test-pin-arms.js` asserted a property over an arm set selected by a `!x.top` filter, and that filter swept in the `middle` arm, whose `chance` is a live uniform and whose own description reads *"moves miss at their printed accuracy"*. **It was green only when one hash landed under 0.01.** It is a stale assertion rather than a defect in the arms, it is fixed, and all arms pass. A green demonstration that has never been shown able to go red is not evidence; this one had never been shown able to go green on purpose either.

**THE PREDICTION CARD SCORED 3 OF 8, AND THE MISSES ARE THE PART WORTH KEEPING.** Both empirical misses were by one and are attributed. **All three joint misses were in the same direction — the fix being much larger than called** — which is a systematic error in the prior rather than noise in the measurement, and a card that only recorded its hits could not have shown that. It is recorded rather than rounded off, next to the running tally across the night.

**WHAT THIS VERSION DOES NOT DO, AND WHAT IT LEAVES OWED.** No quarantined figure becomes quotable: leaf calibration, every rollout figure and every head-to-head stay withheld, and the MAG refit stays owed as a refit rather than a restamp. `docs/ENGINE.md` still carries `vol.charging` and was not restamped, because the brief for this pass overrode the standing instruction. One new control-arm board row is attributed and not diagnosed. **13 of the joint arm's 53 are unnamed under the artifact's 40-row cap**, so the naming of that arm is incomplete by construction and is stated rather than implied. The semi-invulnerable half of the abort fix is wired and not staged. `tests/test-wiring.js` is a pre-existing red that was run once in a regression sweep before the agent realised it plays self-play games; it was not repeated and is reported rather than filed.

**5.255.0 — A RELEASE DIGEST THAT MOVES NOW SAYS WHY, AND THAT IS THE ITEM IN THIS VERSION WORTH THE MOST CARE.** A measurement in this project is taken against a frozen release, and the release id is a digest over its sources. Tonight an agent found the engine gate at **7 of 9 clauses failing instead of 2 of 9** and spent **five heavy re-runs** restoring it. The cause was not code. `engine/medicham2-browser.js` had its **line endings** changed, which moved the digest, while all **26** frozen sources were content-identical — `diff --strip-trailing-cr` returns 0 differences. The standing case is live in the tree right now: one cited release differs from the working tree in exactly one file, **39,932 LF against 39,932 CRLF, zero characters edited.** So `engine/engine_release.js` and `engine/pin_guard.js` now classify a drift as *the sources actually changed* or *content-identical modulo line endings*, and `tests/probe_release_drift_diagnosis.js` holds the demonstration. On the current tree, of **36** cited releases, **34** are CONTENT-CHANGED, **1** is EOL-ONLY, **1** is NO-DRIFT and **0** are UNDIAGNOSABLE, at a cost inside the gate of **37 ms**.

**IT IS A DIAGNOSIS AND NOT AN EXEMPTION, AND THE DISTINCTION IS THE WHOLE OF ITS SAFETY.** Nothing is excused. The digest is unchanged, it still hashes raw bytes, the id still moves on a line-ending change, and artifacts stranded by an aged-out release stay stranded. **Tonight's two failing clauses are diagnosed CONTENT-CHANGED and still FAIL, with every count withheld** and the words *"A re-measurement IS owed"* printed in place of a number. The two obvious repairs are both correctly shut, which is why a third door was needed: pinning the nine deliberately unpinned sources to LF **would rewrite them, move every release id, and break `tests/roster.js`, whose red demonstrations match a carriage return against the simulator's own source**; and normalising the comparator is forbidden here on the stated ground that *"the difference is already observable to an instrument."* The nine-source job stays filed, and is now visible every time it costs something. **The classifier is a PROPERTY rather than an enumeration** — it reads no filename, no path, no `.gitattributes` entry and not the frozen source list, and one probe case diagnoses a file whose name exists nowhere in this repository by calling the classifier on two bare buffers. **`engine/status.js` and `engine/quarantine.js` needed no edit at all**, because both already render the guard's `why` verbatim; one implementation landed in both, which is the opposite of this repository's most expensive recurring failure.

**AND THE DIAGNOSIS CAUGHT A BUG IN ITSELF BEFORE IT WAS TRUSTED — A FALSE ALARM FROM THE THING BUILT TO STOP FALSE ALARMS.** Its first line-terminator counter reported two identical files as differing. It was then shown red four ways rather than argued to be correct: with the normaliser broken to the identity function it scores 9 of 16, reproducing the pre-fix behaviour exactly, and with an over-excusing break it scores 10 of 16; repaired, 17 of 17. A rule that decides two things are the same claim carries a case it must catch and a case it must refuse, and both run before it is used on a release.

**THE ENGINE HALF: BOARD-MATERIAL 37 OF 961 → 35 OF 961, PROTOCOL FIRST-DIVERGENCE 122 → 120, VOID 6 → 4, CENSUS LEVEL AT 829 OF 829.** Both games that closed were attributed by id on identical game lists, with **zero new**. The published whole-game figure is **not** this number: `data/game-differential.json` was not republished and still holds board-material 46 of 961, which is stale as a description of tonight's engine and is what the gate prints. Name the artifact beside every whole-game figure, every time; the measurement above lives in this version's verification artifact and the published one is superseded only by a settled-tree pass.

**IMPRISON SET A VOLATILE AND SEALED NOTHING, WHICH IS THE DESTINY BOND SHAPE: IMPLEMENTED, AND DOING NOTHING.** The tag bundle has carried `sealsMoves {fromUsersOwnMoves: true}` all along and **no engine line read it**, so a foe played a sealed move, dealt damage and spent PP. The authority is `data/moves.ts:9492-9524`. The probe is `tests/probe_imprison_seal.js`, and its live arm read a defender at 78 HP in this engine against 130 in the authority before the fix and identical after, with **three over-fire controls** — an unshared move, the user's own ally, and no Imprison at all — green in both directions. A capability that cannot prove it ran is assumed broken; this one had a volatile to show for itself and no effect.

**THE PIVOT ROAD NEVER ASKED `bounceOff`, SO A BOUNCED PARTING SHOT DROPPED THE WRONG POKÉMON AND MADE THE WRONG ONE LEAVE.** Magic Bounce hands the move over — `useMove(newMove, target, {target: source})` — so a Parting Shot at a bouncer lowers the **CLICKER** and the **BOUNCER** is the one that switches. This engine did both backwards. **14** board leaves apart before the fix and identical after, with Synchronize, U-turn and Taunt controls unmoved.

**THREE MORE LEAVES ARE WIRED AND THE COMPARATOR STANDS AT 40 OF 56, ON WILL'S RULING THAT THE LEAVES COME BEFORE CHASING THE COUNT TO ZERO.** *Board-material zero on 37 of 56 standing leaves is not the same claim as zero on all of them* — a comparator that does not look at a leaf agrees on it for free, and the count it produces is an argument about coverage rather than about the simulator. `lockon`, `minimize` and `noretreat` were each traced to a real **write AND read** site before wiring — the Unburden check, because a leaf can look wireable on every derived column while the engine holds nothing under that name — and each was staged in a real game to confirm it stands at the boundary. All three were red first with a control, and `lockon`'s clock was compared as a clock rather than as a flag. **Board-material stayed flat at 35 and that was called exactly in advance**: the pinned pool holds zero Lock-On and zero Dragapult, so the lab moved and the pool correctly did not. That is the ranking rule working, not a null result.

**STORE-REPLAY IS REFUTED AS A DRIVER, AND THE REFUTATION IS STRUCTURAL RATHER THAN EMPIRICAL.** Replaying recorded human click sequences through the simulator stops being a replay at the **first damage-dependent faint**, and **at least 24.8%** of frozen-pool games have one on turn 1. The reason is a property of the format: Champions sheets never publish the **66** stat points, so the declared spread is absent on 100% of sheet bodies measured across **47,856** of them, and simulated damage cannot match the real game's. It is also a POPULATION change rather than a driver change — the differential pairs one game's team A against another game's team B, so **no recorded sequence exists for the matchups it plays.** A driver that cannot be replayed on the population under test is not a stricter driver; it is a different experiment.

**THE COORDINATION GAP WAS ALREADY QUANTIFIED IN THIS REPOSITORY AND NOBODY HAD ACTED ON IT, WHICH IS THE FINDING.** `engine/board.js:377` measures humans double-targeting **23.4%** of the time against roughly 50% under independent choice, and `engine/empirical_driver.js:56-64` declares in its own text that it has **no target model and no switch model**, with switches at **12.1%** of real slot decisions. That is why the empirical arm runs a median of **11** turns against real VGC's **7**, with **49%** of its games hitting the turn cap instead of ending. A number that exists in the tree and changes nobody's decision is the same failure as a number nobody measured.

**THE RE-DIAGNOSIS OF THE REMAINING WHOLE-GAME LEAVES FOUND NO BIG BUCKET LEFT, AND SAYING SO IS THE USEFUL RESULT.** Of the 37 that stood at the start of this version: roughly **12** are damage-value rows already fenced by a filed row, **5** are `stall` and were refuted — a die, not a missing mechanic — **3** are Cursed Body, Flame Body and castform and were refuted, **2** are Poison Touch and are a die value with the ability wired and both engines reaching the draw at the same point, **2** are `vol.charging`, and the rest is a one-row tail. **After fencing, the largest actionable group was two rows.** `vol.charging` is a confirmed defect that cannot be probed today: the differential's scripted chooser falls back to a target field a locked move's request does not carry, so the authority refuses the choice and no staged scenario in this repository has ever played a two-turn release turn. Reported, not fixed.

**PREDICTIONS, AND THE ONE THAT MISSED.** The leaf batch went **4 of 4**, exact on all four, with the flat board called in writing before the run. On the mechanics batch the VOID call was wrong — **6** predicted against **4** measured — because the bounced Parting Shot restored a shared accuracy address, and that count fell from **8** to **5** as a consequence of the fix rather than of the measurement. It is recorded as a miss.

**WHAT THIS VERSION DOES NOT ESTABLISH.** No quarantined figure becomes quotable. Leaf calibration, every rollout result and every head-to-head stay WITHHELD; the gate is closed and both failing clauses read the unrepublished whole-game artifact, and they are diagnosed CONTENT-CHANGED with their counts withheld rather than shown. **The MAG refit stays OWED and is a REFIT rather than a restamp.** Full accounts: `docs/_reports/2026-09-05-fix-batch-8.md`, `docs/_reports/2026-09-05-leaf-widening-batch2.md`, `docs/_reports/2026-09-05-release-drift-diagnosis.md`.

**5.254.0 — A GENERATED ARTIFACT HAD BEEN SHIPPING A LIVE ENGINE DEFECT IN HEAD FOR SIX DAYS, AND THE GATE THAT CATCHES IT WAS RED THE WHOLE TIME, NAMED THE EXACT PAIR IN 1.56 SECONDS, AND WAS FILED IN A REPORT INSTEAD OF ACTED ON.** `data/abra-tags.js` is generated from `data/tags.json` and frozen into every engine release. At HEAD the generated copy was stale against its source by **1,084 leaves**, and the drift was substantive rather than cosmetic: **three of those leaves were tag params the engine reads by name.** `moves.partingshot.params.pivotStatus` carried only `{selfSwitch:true}` in the browser copy against `{selfSwitch, conditional, cancelsWhen:"noStatChangeLanded", exceptAbilities:["mirrorarmor"]}` in the source, so `medicham2-browser.js` took its `pivotConditionUnreadable` fallback and **pivoted unconditionally** — the pre-fix behaviour, six days after the commit that fixed it landed in the source at 09:57 on 2026-08-29. The remaining differences are usage counts, usage-ranked linkage re-sorts and one `consumedBy`; membership is identical on both sides. **This is the fifth instance of this class**, and the class is the one CLAUDE.md names as this repository's most expensive: two implementations of one fact.

**THE PART THAT MUST NOT BE SOFTENED IS THAT THE CHECK WAS NOT MISSING AND IT DID NOT MISS IT.** `engine/artifact_audit.js` check G is already a PROPERTY rather than a named pair — it derives every self-declaring bundle under `data/` from that bundle's own `GENERATED by <builder> from <source>` header and spawns the builder's own `--check`. Measured before the rebuild it was **exit 1, `1 GAP(S) FOUND`, naming the exact pair, in 1.56 seconds**, and it is a registered gate in `tests/run-all.js`. It went unacted-on because the only thing that runs it is a full suite — **and it was FILED, in a session report, annotated "this check got BETTER across the session."** That is *a check nobody acts on is not a check*, verbatim, and it is the same normalisation that kept the docs-currency gate red for two consecutive days under the label "one of the two known failures."

**SO THE FIX IS A PLACEMENT AND NOT A SIXTH COMPARISON.** `.githooks/pre-commit` now runs `engine/artifact_audit.js` **above its scope guard**, because that guard exits 0 for a commit staging only `data/`, and *"regenerate the tags, commit the data"* is the shape of all five instances — a clause below the guard could not fire on the case it was written for. It costs about 1.6 seconds and writes nothing, and it was shown RED and then GREEN on the real pair against an isolated `GIT_INDEX_FILE`. **No new comparison code was written.** Two implementations of one fact is the recurring failure; a third would have been the same mistake wearing the costume of a fix.

**THE ENGINE HALF: BOARD-MATERIAL 41 OF 961 → 37 OF 961, PROTOCOL FIRST-DIVERGENCE 128 → 122, VOID 7 → 6, CENSUS LEVEL AT 829 OF 829 THROUGHOUT.** The measurement is in `data/verification/fix-batch-7.json` on release `316669459d67`; the release sequence across this version is `3187ea18c625` → `014fe780a1a6` → `316669459d67` → `ae608567e8a8`. **Attribution is measured rather than argued**: `MEDI_SAMPLE_DUMP` gives an identical 961-row game list on both sides of each batch, so the counts answer the same question, and joined on `config|seed` the result is **CLOSED 1 then 3, NEW 0**, with every closure named in advance.

**AND THE PUBLISHED FIGURE IS NOT THAT NUMBER.** `data/game-differential.json` is NOT republished and still holds board-material 46 of 961, which is what the gate prints. That figure is stale as a description of tonight's engine and is superseded by the verification artifact named above; republishing it is a settled-tree pass, because rewriting the live artifact while the simulator is being edited is how this project produced two numbers for one question in the first place. Say which artifact a whole-game figure lives in, every time.

**THE FOUR MECHANICS, EACH RED FIRST UNDER A KNOB WITH A CONTROL THAT AGREED AND STILL AGREES.** Self-inflicted stat drops never ran when a Substitute ate the hit: the authority sets `targets[i] = null` — not `false` — at `sim/battle-actions.ts:1063-1066`, and `selfDrops` opens `if (target === false) continue`, so its step 4 still runs; this engine's substitute road set `R.out`, the driver skipped `out` rows, and the once-per-move backstop flushed `_stepAfterHitField` and `_stepUpdate` but not `_stepSelfPay`. RED read `{def:0,spd:0}` against the authority's `{def:-1,spd:-1}`; identical after. A sleep chosen inside a handler was attributed to the move, because Champions' Dire Claw calls `trySetStatus(status, source)` with no `sourceEffect` and `slp.onStart` therefore takes its bare arm — measured across four moves in the authority. **And a body under sun could be frozen, because the sky carries an `onImmunity` and this engine read only its damage handlers**: `data/conditions.ts:579-582`, with `desolateland` byte-identical and Champions overriding neither, so mainline is authoritative and establishing that is itself a derivation. Probe `tests/probe_sun_refuses_freeze.js`, knob `MEDI_FRZ_IN_SUN=1`, red first at `SUN UP medi ["frz"] / sd []`, **nine arms including a Cloud Nine control that puts the freeze back in BOTH engines**, and a derived assertion that the engine's refusal table EQUALS the authority's — so a second refusing weather or a second refused status reds it by name.

**A SUITE THAT HAS NEVER BEEN SHOWN ABLE TO FAIL IS NOT EVIDENCE, AND FOUR OF THIS ONE'S PLANTS COULD NOT GO RED.** The roster stages plant deliberate faults to prove they can be caught. Four plants no longer matched anything — two carrying a literal carriage return against an LF engine file, one anchoring a signature that grew a fourth parameter, one matching two sites — and it was invisible because **every shipped roster artifact is written without `--reds`**, so `reds: []` and the clause passes whatever the plants do. All four were re-aimed and then verified **independently, one rule at a time, rather than read off the artifact that had been hiding them**. The shipped stages now carry 18 / 29 / 35 reds, 0 not-ok and 0 unaimed plants, at 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE.

**FIVE CANDIDATES WERE REFUTED BEFORE ANY EDIT, WHICH IS CHEAPER THAN A WRONG FIX AND IS THE PART THAT WOULD OTHERWISE BE GUESSED.** The Dire Claw sleep CLOCK is correct — both engines read the same one-turn-or-two distribution off Champions' `sample([2,3,3])` — and **that refutation is now a permanent arm of its probe rather than a sentence in a report**, so it cannot return as a diagnosis. `stall`, the largest single named leaf at five games, is a die and not a missing mechanic: all six legal stalling moves and the lapse agree. `castform.species` was not reachable in either shape staged. Flame Body and Cursed Body were shown to fire in the previous batch and stay off the list, which is the finding rather than an omission.

**A DECLARATION THAT IS A SAFETY PROPERTY RATHER THAN A PERFORMANCE ONE: `ABRA-HEAP: 3072` ON `engine/tag_dex.js`.** It was exhausting the default heap, which blocks every tag-derived fix, and the failure mode is the one this project is built against: **its only write is near the end of the file, so an OOM leaves `data/tags.json` holding its OLD CONTENT AND ITS OLD MTIME.** Nothing on disk records the death, and every consumer then reads a stale tag set that looks freshly generated — the signature failure of this repository, arriving through the heap. The requirement had been carried as prose a caller was expected to remember; `tools/lownode.cmd` and `.githooks/pre-commit` read the declaration now. **The rebuild was verified by the stamp rather than the exit code**: the tag artifact's own generated stamp moved from `2026-08-29T13:37:50Z` to `2026-09-05T00:34:28Z`.

**THE PREDICTIONS WERE WRITTEN DOWN BEFORE THE RUNS AND WENT 4 OF 4, THEN 4 OF 4.** The sun/freeze batch was called at board-material 38 with a range of 37 to 40, protocol 124 with a range of 122 to 125, VOID 7 with a range of 6 to 8, and the census level — measured 37, 122, 6, and level. The card was recorded pre-run in `data/verification/2026-09-04-sun-frz-prediction.json`. One prediction was beaten and the reason is recorded rather than claimed as skill: a game expected to keep parting closed, because its second divergence was downstream of the freeze.

**WHAT THIS VERSION DOES NOT ESTABLISH.** No quarantined figure becomes quotable. Leaf calibration, every rollout result and every head-to-head stay WITHHELD, because the gate is closed and is back at its found shape — **2 of 9 clauses failing, both of them the whole-game clauses reading the unrepublished artifact.** Each batch re-ran the five clauses its own release staled and all five returned numerically identical: the damage differential at 6,000 of 6,000 with 0 disagreed, and roster items 140 / abilities 129 / moves 475 each at 0 DIFFER and 0 DID-NOT-FIRE. **The MAG refit stays OWED and it is a REFIT rather than a restamp**; `data/abra-tags.js` is now named among the inputs that moved after the fit, which is exactly the exposure this release found. **One thing is owed and deliberately not done:** `engine/tag_dex.js` should rebuild the generated copy in the same act that writes the tag artifact, and verifying that needs a `tag_dex` run, which would strand release `ae608567e8a8` and void the five re-runs just completed. Full accounts: `docs/_reports/2026-09-04-fix-batch-6.md`, `docs/_reports/2026-09-04-fix-batch-7.md`, `docs/_reports/2026-09-05-abra-tags-drift.md`.

**5.253.0 — A DEFECT REGISTER IS AN INSTRUMENT, AND THIS ONE HAD A READING ERROR THAT MOVED VERDICTS IN BOTH DIRECTIONS: A ROW WHOSE STATUS CELL BEGINS `open — engine DEFECT` WAS REPORTING **CLOSED** TO THE GATE.** **NO MECHANIC CHANGED, NO DIFFERENTIAL RAN AND NO WHOLE-GAME FIGURE WAS RE-DERIVED**; `data/game-differential.json` holds board-material 46 of 961 exactly as the previous version published it, and nothing below is evidence about the simulator. The mechanism is a parse artifact with a wide blast radius. Each register row is a markdown table row; the shipping status reader takes the text after the LAST pipe in the row, which is correct for a well-formed row and wrong for a cell that itself contains a pipe inside a code span. The cell is cut, and whatever was appended after the cut — a closure narrative, in the row that matters — is read as the verdict. **The row is open and asserting breakage again, and that is the entire +1 in the gate's defect column.**

**THE CLASS IS TWO DEFECTS AND THE UNNAMED HALF IS THE LARGER ONE.** The pipe half hid 8 rows. The emphasis half hid **nine**: the cell's leading-whitespace skip is `\s*`, which does not skip `**`, so a status authored `| **CLOSED 2026-08-13** |` fails to match with **no pipe anywhere in the row** — a second door into the same failure, reached by a completely different spelling. Eighteen rows were repaired, notation only, one line each. Open rows fall **237 → 222** and open-and-asserting-breakage rises **50 → 51**. **The verification is a replay rather than an inspection:** the whole register was re-read through the shipping detectors before and after, confirming **exactly 17 moved verdicts and no eighteenth by accident**, with both detector functions byte-identical to HEAD. **No confidence interval is quoted and none is owed** — these are exact counts over the entire register, not estimates from a sample, and an interval on a census is decoration.

**THE GUARD IS STATED AS A PROPERTY, WHICH IS WHAT MAKES IT DURABLE, AND IT IMPORTS THE DETECTOR IT CHECKS.** The invariant is one per row: *the gate-visible verdict must be identical whether the status cell is read as the shipping detector reads it, or as the column the author wrote and then rendered to plain text.* A list of the two known-bad spellings would have been satisfied by the two rows already found; a property is not, and it caught a third shape — a title carrying an unpaired backtick, present before tonight, on which the two readings disagreed about closed versus open-and-broken — by **refusing to judge the row and printing NOT READABLE rather than guessing.** It **imports** the shipping closed-row detector: a third, independent copy of that detector once disagreed with the canonical one on **24 of 292 rows in both directions**, so a verifier that re-implements the rule it is verifying is a measured failure class here rather than a stylistic preference. It was shown red twice before being trusted — on **seven synthetic doors, four of them spellings nobody in this repository has ever used** (a link, inline HTML, a code-wrapped status, an escaped pipe), each with a repaired twin that goes quiet; and then on real data, where pointing it at the pre-repair register **names 15 rows and exits 1**, reproducing the repair pass's list by an instrument that had never seen it. A mixed-corpus arm and a lift arm fail if the comparison is removed or if the shipping reader ever stops cutting, so it cannot pass by asking nothing. On the current register it reads 506 rows with 0 verdict failures in 0.17s and writes nothing.

**TWO NEGATIVE RESULTS ARE RECORDED BECAUSE THEY ARE THE PART THAT WOULD OTHERWISE BE GUESSED.** First, **the escape that looks like the fix is not one, and this was measured rather than assumed**: the capture uses a negated-pipe character class, so it stops at `\|` exactly as it stops at `|`, and the authored and fully-escaped forms of a synthetic row extract identical wrong text through the shipping detectors. Only deleting the pipe recovers the status. Second, **cut-but-harmless is REPORTED and deliberately NOT RATCHETED**: 15 cells remain cut by a pipe whose verdict is unchanged either way, and failing on them would force the 631-pipe diff the repair pass declined while the verdict clause already covers every cut with a consequence. A count that may only fall invites the next author to argue that their row is the exception, which is how a gate stops being read. **Ninety rows and 631 pipes were left alone, every one checked — 13 closed, 2 correctly open** — and the decision not to churn them is recorded here rather than left as a silence.

**THE HONESTY CLAUSE, WHICH IS THE LOAD-BEARING PART OF THIS RELEASE: SIXTEEN CLOSURES WERE MADE READABLE WITHOUT BEING RE-VERIFIED, AND EACH SAYS SO IN ITS OWN CELL.** A repair to how a row PARSES tells you nothing about whether the defect it describes still exists, and the two are trivially confusable once the row reads cleanly — a document-level footnote would have been read by nobody, so the admission lives in the cell that carries the claim. Cheap artifact checks did pass for seven of the sixteen; the weakest four rest only on the named instrument existing on disk, and record that too. **Nothing in this version becomes quotable that was not quotable before**: leaf calibration, every rollout figure and every head-to-head stay WITHHELD behind the engine gate, no fitted vector was written, and the MAG refit stays OWED as a refit rather than a restamp. `node engine/status.js --write` was not run by this documentation pass and no `<!-- GENERATED -->` block was hand-edited; those blocks were restamped by another division's pass while this text was being written, so they are current to that pass rather than to this one, and they carry no register figure. Full accounts: `docs/_reports/2026-09-04-pipe-class-repair.md` and `docs/_reports/2026-09-04-cell-parse-guard.md`.

**5.252.0 — THE GATE'S PUBLISHED FIGURE MOVES FOR THE FIRST TIME IN FIVE FIXES: BOARD-MATERIAL 77 OF 961 FALLS TO 46 OF 961 (4.8%), MEASURED AND PUBLISHED ONTO THE SAME ARTIFACT.** `data/game-differential.json` was rewritten on engine release `0dec37ff5ad9`. It holds board-material 46 of 961 — `state.games` less the 915 games whose board never diverged — and protocol first-divergence 141 of 961 raw, 140 after one declared. 961 games were PLAYED of a 1200-PAIR budget; 7 ran void and 1 threw. **The caveat this document has carried in every version since 5.247.0 — *the published clause still reads 77* — is DISCHARGED.** It is discharged rather than quietly dropped: the two numbers agree because the measurement was republished onto the live artifact, not because either was re-argued. Every release before this one measured into `data/verification/` and left the gate printing a figure five fixes out of date, because no fix republishes onto the live artifact while the simulator is being edited.

**THE KIND OF FAILURE CHANGED, AND THAT IS THE LARGER RESULT.** The gate reads `CLOSED — 1 of 8 GATING clauses fail`, against 6 of 8 before this pass. **Five of those six failures were state (a): an artifact that could not prove which engine produced it, so nothing at all was known about the clause it answered.** All five stranded pins were regenerated against the one release and no clause is in that state now. The single remaining FAIL is **state (b) — a named instrument genuinely RED**, on the current engine, over 46 real games. A gate that moves from *unmeasured* to *measured-and-red* has improved even though its integer is what it is, and the two states may never be collapsed into one number. State (c) is reported separately, inside the defect clause that PASSES: 40 open register rows assert breakage with no instrument that decides them, 7 name an instrument that answers nothing usable, and 3 name a green one. Folding those 40 into the verdict would describe a broken simulator where what exists is an unmeasured one.

**THE PREDICTION WAS WRITTEN BEFORE THE RUN AND SCORED 4 OF 4, ALL EXACT.** Board-material was called at 46 in a band of 44 to 48, protocol at 141 in a band of 138 to 145, void at 7 and thrown at 1; the run read 46, 141, 7 and 1. It is recorded in `data/verification/2026-09-04-settled-republish-prediction.json`, saved before the differential was started. The running record across this session's called scoreboards is 2-of-3, then 4-of-4, then a one-game protocol miss, then 4-of-5, and now 4-of-4 — kept in full, because a prediction whose misses are not counted is not a prediction.

**AND THE PREMISE BEHIND THAT PREDICTION WAS INCOMPLETE, WHICH IS THE PART WORTH KEEPING.** The brief said the only change since the 46 was counter declarations. Byte-diffing the two frozen snapshots showed that four of 26 frozen files had moved and that the fourth was not a counter: `data/smogon-priors.json` advanced from Smogon month 2026-07 to 2026-08 and from 284 species to 283. It reaches the run through `engine/champions_sim.js` into `engine/set_priors.js` and `engine/smogon_priors.js`, where it fills unrevealed set slots — so it could have moved a board, and a counter declaration could not. **It was named as the falsifier BEFORE the run and then measured inert:** against the artifact that first carried the 46, `classes` and `first_divergences` are byte-identical, and every field that differs is a stamp or a live corpus count read from `data/meta-usage.json`, which the artifact itself labels as read live and outside the frozen release. That is the difference between a prediction that held and a prediction that was lucky. The open-team-sheet pool leaves the prior-fill path unexercised, so the inertness is a property of this population rather than a claim about the priors.

**A DISCLOSURE THAT COSTS NOTHING TODAY AND WOULD COST EVERYTHING IN A MONTH: THE RELEASE THAT FIRST PRODUCED THE 46 WAS CUT FROM A WORKING TREE REACHABLE FROM NO COMMIT.** `252025cfcddc` is superseded by `0dec37ff5ad9`, which is cut from committed bytes and is the release every figure above names. But a figure measured against bytes no commit contains cannot be re-derived if the snapshot directory is ever pruned, and the comparison between the two releases therefore had to be made by diffing the frozen snapshots with line endings normalised, rather than by `git diff`.

**FIVE PINNED ARTIFACTS WERE REGENERATED AGAINST THE ONE RELEASE, AND THAT IS WHAT CLEARED STATE (a).** The stage-by-stage damage differential reads 0 disagreements over 6,000 comparisons at every one of 17 damage indices, seed 20260804. The three deliberate-roster stages each read 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE, across items, abilities and moves. The staged mechanics sweep reads 5 diverge, 1 declared, 4 below the reach shelf and 0 left, over 1,313 games with none thrown. The live mechanics census is level at 829 of 829 with 0 missing, and the undeclared side-selection count stands at 78 with its ratchet at 78.

**WHAT THIS VERSION DOES NOT ESTABLISH.** No quarantined figure becomes quotable. Leaf calibration, every rollout result and every head-to-head stay WITHHELD, because the gate is CLOSED and the clause holding it shut is the board-material 46. **The MAG refit stays OWED and it is a REFIT rather than a restamp** — the damage table under the fitted vector moved from 318 species to 322, so the feature FUNCTION's input changed, and a restamp would write over the evidence for the refit instead of answering it. No fitted vector was written and MAG stays paused by its owner's decision. `node engine/status.js --write` DID run, last in the sequence and for the first time in three releases, so the `<!-- GENERATED -->` blocks in the division ledgers are current and were not hand-edited.

**5.251.0 — MORE THAN HALF THE UNVERIFIABLE DEFECT CLAIMS IN THIS PROJECT'S REGISTER WERE ALREADY FALSE. OPEN ROWS FALL 261 TO 237 AND OPEN-AND-ASSERTING-BREAKAGE FALLS 74 TO 50.** This release changes no mechanic, runs no differential and re-derives no whole-game figure. Of the **43** open rows that asserted a defect while nothing in the repository could confirm or refute them — the population the previous version measured and named as the real gap — **24 were already fixed** and **6 were duplicates of another row**. The interesting quantity is not the fall in the integer; it is that the *unverifiable* subset, the one every planning decision leaned on hardest because nothing contradicted it, had a majority of false members. A backlog nothing can refute is not a conservative estimate of remaining work. It is an unmeasured ruler, and it biases in the direction that flatters the schedule.

**THE WHOLE-GAME FIGURES ARE UNCHANGED AND ARE NOT RE-DERIVED HERE — NAME THE ARTIFACT EVERY TIME.** `data/verification/fix-batch-M6instr-defog.json` holds board-material 46 of 961 and protocol first-divergence 141. `data/game-differential.json` is the artifact the gate clause reads; it was not rewritten and still holds 77 of 961. Neither moved in this version and no sentence here may be read as evidence that either did.

**THE CLOSURE PROTOCOL IS THE RESULT, NOT THE COUNT.** None of the twenty-four rows was closed because a triage said so. Each closure carries its own evidence inside the cell — a live census row, a roster verdict, a tag value, or a knob-and-counter pair — dated, with the prior status carried forward verbatim rather than overwritten, so a later reader can dispute the closure without reconstructing it. **22 of the 24 were re-verified against a newer commit**, because a commit landed between the triage pass and the closure pass and every artifact had to be re-staged; two triage claims were themselves transcription errors and are recorded as such rather than absorbed. A triage is a hypothesis about the register. A closure is a measurement of it. Both passes would have produced the same integers, and only one of them produces a warrant.

**A REPAIR THAT WAS SPECIFIED IN ADVANCE DOES NOT WORK, AND IT WAS MEASURED BEFORE ANYTHING WAS TOUCHED.** A register row was reading OPEN-AND-BROKEN against a cell whose own text says CLOSED, because the status-cell capture takes the text after the last pipe and the closure quotes a protocol line containing pipes. The specified repair was to escape them. It changes nothing: the capture is a negated-pipe character class, which stops at an escaped pipe exactly as it stops at a bare one. This was demonstrated on a synthetic row driven through the shipping detectors — as authored and fully escaped both extract the same wrong fragment, and only deleting the pipes extracts the real status. The pipes were removed, and **the shared closed-row detector was deliberately not touched**, because it is the single implementation of *is this row closed* and mutation testing shows it can be replaced by `return true` with all **159** of its assertions still passing. Repairing an unproven detector to cure a symptom in its caller is how a ruler acquires a defect nobody can see.

**THE SWEEP FOUND A CLASS RATHER THAN AN INSTANCE, AND THE CLASS WAS LEFT ALONE ON PURPOSE.** **98** rows carry **669** unescaped pipes inside inline code and **22** have their status cell cut by one; **nine of the remaining 21 read OPEN against a cell their own author wrote as `closed` or `PART DONE`**, and one parses empty. None reaches the gate. They were reported and left for their owners to restate, because inferring a closure from a parse artifact is exactly the error that produced the row this work started from. A malformed cell is a fact about the ruler and never a fact about the world.

**FOUR COUNTERS WERE `NaN`, AND THE FAILURE IS THIS PROJECT'S SIGNATURE ONE.** A field incremented into an object that never declared it evaluates to `NaN` and is serialised as `null`. One such field went out as `null` in `data/million-run.json` and in `data/million-run-150k.json`: the capability fired, and the counter recorded nothing, in two published artifacts. Another was declared inside one object literal while being incremented on a different one, so the declared field read zero forever whatever the engine did and the incremented field was `NaN` — a comparison of `undefined` against zero can never go red, which is the trap this project documented and was then carrying live. **No `|| 0` was added at any increment site.** A default at the increment makes the arithmetic work and conceals which object owns the counter, and ownership was the defect.

**THE RULE IS NOW A PROPERTY, AND ITS FALSE-POSITIVE RATE IS THE EVIDENCE THAT IT IS THE RIGHT SHAPE.** `tests/test-counter-init.js` asserts that every increment targets a declared field. Across **507** files and **602** counter literals it returns exactly **4** violations with zero false positives, so it requires no exemption list — the strongest available evidence that a rule matches the thing it claims to describe, and the opposite of a check that has to be taught its own exceptions one waiver at a time. It was shown RED on all four before they were fixed, it carries a synthetic red-proof arm so it cannot pass by asking nothing, and it names the **6** computed-key increments it cannot decide rather than guessing them.

**A GUARD BUILT HOURS EARLIER WAS ALREADY MISSING THE BRANCH IT EXISTS FOR.** The pin guard's branch that fires when an artifact was measured against a *different* release had no reader. The asserting code quoted this project's founding rule in its own comment and then enumerated five of six branches, omitting that one. The list is now derived from the guard object's own keys, so a sixth branch is covered without an edit; the selftest moves **216 → 218 passed, 0 failed**. One correction to the audit is recorded in the code rather than in prose: the branch *was* being driven, and what did not exist was a reader. Separately, **five counters the audit called unread are read** — they reach published artifacts through `Object.assign`, which a name grep cannot see.

**WHAT THIS VERSION DOES NOT ESTABLISH.** No model was refitted, `data/policy-weights.json` was not written, and no quarantined figure — leaf calibration, any rollout result, any head-to-head — becomes quotable. The engine gate is untouched. `node engine/status.js --write` was not run for the third release running, so the generated blocks in the division ledgers are three passes behind and were not hand-edited.

**5.250.0 — THE BOARD-MATERIAL WHOLE-GAME FIGURE FALLS 53 OF 961 TO 46 OF 961, AND THE SESSION'S SEQUENCE IS 77, THEN 61, THEN 50, THEN 53, THEN 46 — INCLUDING THE RISE.** Protocol first-divergence falls 154 to 141, VOID holds at 7, the mechanics census is level at 829 of 829, and the undeclared side-selection count falls 80 to 78 with its ratchet lowered to match. The engine release is `7ffc58da8ef8` before and `252025cfcddc` after. **THE RISE IS PART OF THE RECORD AND IS NOT SMOOTHED OUT OF IT.** The step to 53 was the previous pass correcting an address that had been hiding four games behind a coincidence; a series that only ever falls is a series somebody has edited, so the sequence is written here in full and the direction of each step is stated with its reason. Two defects are corrected in this pass: the INSTRUMENT half of the confusion self-hit damage draw, which lives in `engine/game_differential.js` as well as in the simulator, and a Defog that swept the wrong side.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE — NAME IT EVERY TIME.** `data/verification/fix-batch-M6instr-defog.json` holds board-material 46 of 961 and protocol 141 of 961. `data/game-differential.json` is the artifact the gate clause reads; it was not rewritten in this pass either, and still holds board-material 77 of 961 and protocol 168. Both are correctly measured on the pins each records, and only the second is published. There are now five correctly-measured values of one quantity in this session's record and exactly one of them is the published one, which is why the artifact travels with the figure in every sentence that states it.

**M6 CLOSED 13 OF 14, THE 14th WAS NEVER M6, AND THAT IS A STATEMENT ABOUT UNITS BEFORE IT IS A STATEMENT ABOUT PROGRESS.** The fourteen items were CAUSES, not games. Thirteen were confusion damage-value disagreements — the two engines naming the same event and disagreeing about the number — and all thirteen are gone, with that class falling 22 to 9. The fourteenth is a stream-position defect that happens to carry a confusion line on one side of it: it belongs to the ordering family, the damage draw could not have touched it, and it did not. **BOARD-MATERIAL FELL BY ONLY 7 AGAINST 13 CLOSED CAUSES, BECAUSE 6 OF THE 13 GAMES CARRY A SECOND, ALREADY-COUNTED DIVERGENCE.** A cause count and a game count are different quantities and one may not be subtracted from the other. Every other class in the table is unchanged to the game, so the six survivors were already in another class rather than having moved into one.

**THE SCOREBOARD WAS CALLED BEFORE THE RUN, IT SCORED 4 OF 5, AND THE MISS IS THE HEADLINE FIGURE.** Board-material was predicted at 39 against a stated range of 39 to 43 and came in at 46. Protocol was called at 140 to 148 and read 141; VOID was called at 7 or lower and read 7; the census was called unchanged and was unchanged; the Defog fix was called to move the pinned pool by exactly zero and moved it by exactly zero, because an ally-aimed Defog is a play nobody makes and the pool replays real human clicks. The single miss has a single cause, and the cause is not a surprise in the mechanism: the caveat that a game carrying a second divergence stays counted was named IN the prediction and then under-weighted when the number was chosen. It is recorded because a prediction whose hits are counted and whose misses are not is not a prediction. The running record on called scoreboards is 2 of 3, then 4 of 4, then a one-game protocol miss, and now 4 of 5.

**THIS COMPARISON SPANS A CHANGED INSTRUMENT AS WELL AS A CHANGED ENGINE, SO THE HEADLINE INTEGER IS NOT STRICTLY ONE-VARIABLE.** `PIN_DIGEST` moved from `ccb365985023` to `bcb38e47d94f`, because half of the confusion fix is the differential's own wrapping of the authority's damage draw: the ruler and the thing being measured both moved in one pass. The cause count survives that, since a cause either names the same event on both sides and disagrees about it or it does not, and the count went to zero. The board-material integer does not survive it in the same way, and it is not presented as if it did. Where an integer cannot be attributed to one variable, the honest report is the caveat and not a cleaner number.

**THREE SITES THAT LOOKED LIKE THREE COPIES OF ONE SELECTION WERE NOT, AND CONSOLIDATING THEM WOULD HAVE BROKEN TIDY UP.** The three call sites that hand a field-sweep its two side arguments were previously reported as one duplicated selection. They answer different questions. Tidy Up is `target: 'self'` and the authority names the mover's own side together with the foe sides that carry conditions; folding it into the Defog repair would have collapsed its two bags into one and left the opponent's hazards standing. The damaging carriers never read the argument at all. **This is the *facts are global* rule correctly NOT applied:** the shared fact is the sweep itself, and which side a move names is a separate question that each move answers for itself. Both memberships are derived from the tag corpus and from the authority's own handler text on every run, so a new carrier fails by name rather than by silence.

**FOUR UNCOMMITTED DECLARATION ROWS WERE DESTROYED BY A `git checkout --` DURING THIS BATCH, AND THAT IS RECORDED AS A LOSS RATHER THAN AS A REPAIR.** Two were restored verbatim from a printout taken before the loss. Two are RECONSTRUCTIONS, labelled as such in the file itself, each quoting the original answer verbatim from the expired key's own text rather than from anybody's memory, and each asking to be re-read by its author. The code those rows cover has not moved a byte and the census verifies that by digest, so the substance survived. **`git checkout --` on a file another session has edited and not committed is unrecoverable: git holds nothing to restore from.** The symptom was an undeclared count that rose with no engine change, and it was chased as drift for some time before it was recognised as self-inflicted.

**THE REGISTER'S COVERAGE, MEASURED — AND THE HONEST NUMBER IS THE ONE NOBODY ASKED FOR.** Of 219 open rows, 13 name a marker the classifier admits, 43 declare in writing that no instrument decides them, and 0 carry a marker the classifier refuses, against nine refusals the night before. **163 of the 219 carry neither, and 43 of the 74 rows that assert breakage are among them** — for those rows the clause that holds the open-defect gate shut rests on prose. A declared debt is a good property and the declared half has improved; the undeclared half has grown with the register. Reporting only the first of those two facts would be the flattering half.

**WHAT IS NOT FINISHED, NAMED RATHER THAN IMPLIED.** `tests/staged_board.js` is board-identical on all 25 of its scenarios and still exits 1 on a pre-existing red: the anchor its proof plant looks for is absent at `HEAD` as well as in the working tree. It was reported and not patched. Two premature-close candidates are filed with evidence and are NOT reopened, because the instrument that produced the verdict was not re-run. Four closures rest on markers the register has never once executed. M2 stays fenced rather than split. The surviving ordering cause that carries a confusion line has no probe. Six of the thirteen games whose confusion cause closed remain board-material on a second cause that is not attributed per game. `node engine/status.js --write` was not run in this pass, so the generated blocks in the division ledgers are one pass behind and the gate — not this paragraph — is what says which clause is failing today.

**NOTHING DOWNSTREAM BECOMES QUOTABLE.** No model was fitted, no weight vector was written, `data/policy-weights.json` was not touched, the MEDICHAM quarantine does not lift, and every withheld figure in this paper — leaf calibration first among them — stays withheld rather than annotated.

**5.249.0 — THE BOARD-MATERIAL WHOLE-GAME FIGURE ROSE 50 OF 961 TO 53 OF 961, AND THE RISE IS THE CORRECTION WORKING RATHER THAN A REGRESSION.** Protocol first-divergence rose 150 to 154, VOID held at 7 and the mechanics census was level throughout; the pins are identical either side of the comparison — the same 961 games, the same census pin, the same frozen team pool and the same empirical steering driver — with the engine release `9b449a41c865` before and `7ffc58da8ef8` after. **THE MECHANISM.** `data/conditions.ts` writes `this.activeTarget = pokemon` between confusion's roll and `getConfusionDamage`, so the authority's two draws sit at two DIFFERENT addresses whenever the confused body had clicked at a foe; this engine stamped one address and used it for both. **THE DEFECT'S TRUE SIZE IS 14 GAMES, AND FOUR OF THEM HAD BEEN HIDDEN BY A COIN LANDING THE SAME WAY ON BOTH ENGINES.** Correcting the address removed that coincidence, so the counter now sees games it was previously blind to. **THE EVIDENCE FOR THAT READING IS NARROW AND IT IS THE WHOLE OF THE ARGUMENT: exactly one divergence class moved — `-damage field` 18 to 22 — and eight of the eight moved causes carry `[from]confusion`. Nothing else in the run changed by a single game.** The direction was called in writing BEFORE the run, in `data/verification/2026-09-04-M6-address-prediction.json`, as neutral-to-slightly-worse with the arithmetic attached; protocol missed the stated band by one, and the falsifier the prediction named is refuted by the class evidence rather than by argument. **THE FIX IS KEPT AND NOT REVERTED**, because the engine now matches the authority; the revert is one environment variable and is the owner's call, named rather than taken. This is the same shape as the coverage-driver swap that took the gate off its false all-clear at 5.243.0: a number that reads worse after a repair is usually an instrument that has stopped being fooled, and the way to tell the two apart is to require the movement to be attributable to one class rather than spread across the run.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE.** `data/verification/fix-batch-M6-sidesel.json` holds board-material 53 of 961 and protocol 154 of 961. `data/game-differential.json` is the artifact the gate clause reads; it was not rewritten in this pass either, and still holds board-material 77 of 961 and protocol 168. Both are correctly measured on identical pins and only the second is published. Name the artifact whenever either figure is quoted.

**5.249.0 — THE LARGER RESULT IS ABOUT THE RULERS: 9 OF 124 REGISTER MARKERS WERE BEING SILENTLY REFUSED, AND 2 OF THE 9 ROWS THAT BOTH ASSERT BREAKAGE AND NAME AN INSTRUMENT WERE AMONG THEM — 22% OF THIS REGISTER'S LIVE INSTRUMENT COVERAGE WAS FICTIONAL.** A `VERIFIED BY:` marker is a row's claim that an instrument decides it. `engine/register_reality.js` carried a `SAFE` predicate that refused nine of those markers outright, and a refused marker was reported under the same verdict a gate produces when it fails to start — so *my ruler would not read this marker* and *this instrument is broken* were one number. **THE PREVIOUS FIX OF THIS EXACT CLASS WAS TOO NARROW AND THAT IS THE POINT.** ROADMAP #521 repaired one wrong spelling and nine markers walked past it, which is why the replacement is a PROPERTY rather than another list of spellings: there is no shell in the path (`execFileSync`, never `shell:true`), so the rule is that node reads only the tokens BEFORE the entry point, that region fails closed, the entry must resolve inside the repository, and post-entry tokens are inert by construction. `--arm middle` and `--arm=middle` are now one fact. 22 hostile strings are still refused. The full-population regression is the load-bearing evidence that this is a widening and not a hole: 124 markers, 115 identical argv, 0 moved, 0 lost.

**THE GUARD THAT WAS REMOVED WAS ITSELF FICTIONAL, WHICH IS WHY THIS IS NOT A RELAXATION.** Its own comment claimed that bare values were refused in order to keep multi-minute game-playing runs out of the register pass. Measured on the pre-fix bytes, that defence is false: `--arm=middle`, `--stage=moves` and `--games=1200` were ALREADY admitted, one character away from the forms it rejected. It guarded spelling, not cost — and a guard whose stated justification has never been measured is indistinguishable from one that works.

**ONE NUMBER WAS HIDING TWO DEFECTS, AND THEY ARE NOW SEPARATED.** In the last published artifact every one of the 27 rows counted as an unrunnable instrument was in fact a refused marker — a defect in the RULER and a defect in the WORLD summed under a single heading. `engine/quarantine.js` now reports `MARKER REJECTED` (nobody was asked) apart from `unrunnable` (asked, and answered nothing usable), each with its own count, its own sentence and its own per-row verdict. Its selftest moves 210 to 216 passed with 0 failed, all six new arms shown RED first on four separate deliberate breaks, and `tests/test-divergence-composition.js` stayed green without being edited.

**THE LIVE REJECTED COUNT IS 0, AND THAT IS HONEST RATHER THAN A FIX THAT DID NOTHING.** `data/register-reality.json` is the 2026-08-27 artifact; it predates the new vocabulary, so the affected rows are still spelled with the old label in it. The mechanism is in the tool and the artifact has not caught up. Regenerating it is blocked on an undecided question, which is stated below rather than half-answered.

**5.249.0 — AN ALARM THAT LOOKED LIKE FOUR NEW ENGINE DEFECTS WAS THE MEASURING TOOL'S ANCHOR MOVING, AND A REAL DEFECT WAS FOUND WHILE PROVING THE FOURTH SITE INNOCENT.** `engine/side_selection_census.js` read undeclared 84 against a ratchet of 81, naming four side-selecting sites that fall outside every hunk of the session's diff. All four are byte-identical to code classified on 2026-08-29 — same expression, same site digest. What moved is the census's ANCHOR: a new branch test was inserted above two of them, and the enclosing function drifted 1,660 lines against a 1,500-line search window for the other two, so three declarations expired for lines that never changed. All four verdicts were re-derived from the authority rather than copied forward, and all four are correct. Undeclared falls 84 to 80, the ratchet is met and the check exits 0. A new `ANCHOR-DRIFT` verdict names the expired key, and the row STAYS undeclared — a site that moved into a different branch may select something else now, and auto-inheriting a declaration is the failure the key exists to catch. The verdict was shown against a control that flags exactly those four sites and none of the other eighty. **THE DEFECT FOUND ON THE WAY:** `sweepField`'s foe-side box is consumed only by Defog and Tidy Up, and the fourth site's own note named the wrong line. The live Defog target-side defect is at `engine/medicham2-browser.js:26471` and is OWED.

**5.249.0 — THE BEST JUDGEMENT IN THIS PASS WAS A REFUSAL TO WRITE A MARKER, AND IT IS RECORDED BECAUSE THE ALTERNATIVE WOULD HAVE LOOKED LIKE PROGRESS.** ROADMAP #318 is an OPEN row that asserts breakage. The obvious repair — dropping the unexpanded environment prefix, exactly as was done on four sibling rows — would have produced a marker that reports the row GREEN while the defect the row names is untouched: `tests/roster.js:9167` passes `learnsetMode: 'report'`, so 632 learnset refusals go to a printed bucket and never reach the count that becomes the exit code. No marker was written. The row's `INSTRUMENT OWED` declaration is its honest coverage, and a declared gap is worth more than a green instrument that cannot see the defect it is pointed at.

**WHAT IS NOT FINISHED, NAMED RATHER THAN IMPLIED.** The gate is red at 53. The instrument half of the confusion defect is open — `engine/game_differential.js` reads the same draw un-inverted, and it cannot be flipped from the engine side without the corner arm parting on every self-hit; it is worth all 14 games. The Defog target-side defect stands. Three further sites are three copies of one selection. 80 side selections remain undeclared. Two register rows still carry a now-stale machine-runnable paragraph. Four newly-runnable markers are heavy and two of them rewrite gate inputs, so the full register pass must not be run beside a live agent until an owner decides — filed as a decision rather than half-guarded.

**NOTHING DOWNSTREAM BECOMES QUOTABLE.** No model was fitted, no weight vector was written, `data/policy-weights.json` was not touched, the MEDICHAM quarantine does not lift, and every withheld figure in this paper — leaf calibration first among them — stays withheld rather than annotated.

**5.248.0 — THE BOARD-MATERIAL WHOLE-GAME FIGURE FALLS 61 OF 961 TO 50 OF 961 ON THREE FURTHER ENGINE FIXES, AND THE PUBLISHED CLAUSE STILL READS 77 BECAUSE THE GATE'S ARTIFACT WAS AGAIN DELIBERATELY NOT REWRITTEN.** Across one session the gating quantity has moved 77, then 61, then 50, entirely on engine work; protocol first-divergence, which reports without gating, is 161 to 150; VOID is unchanged and the mechanics census is level throughout. The pins are identical either side of the comparison — engine release `f3504e5f88d6` before and `9b449a41c865` after, the same census pin, the same frozen team pool, the same empirical steering driver and the same 961 games — which is the condition under which eleven games are attributable to three named mechanisms rather than to drift. **THE CAVEAT TRAVELS WITH THE FIGURE AND IS STATED IN ITS OWN PARAGRAPH BELOW**, because two correctly-computed numbers with only one published has already forced reconciliations in this project. **THE THREE MECHANISMS.** Sucker Punch did not fail into a redirector: this engine evaluated the refusal against the ORIGINAL aim and redirected 137 lines later, where the authority redirects first (`sim/battle-actions.ts:467` → `sim/pokemon.ts:835`) and only then runs `onTry` on `targets[0]`, so its `willMove` question is put to the Follow Me user and the move prints `-fail`. The `stall` die of an Encore'd Protect ran as two independent coins, our address reading `…|any|crunch|p10` where the authority reads `…|any|protect|p20` — measured with both logs side by side before any edit. And a contact ability transfer announced on the wrong body, red-first at `boosts.atk` with this engine at 0 against the authority's −1, four times over. **THE METHOD RESULT IS AGAIN THE MORE DURABLE ONE, AND THIS TIME IT CUTS BOTH WAYS.** The diagnosis card was right that the second defect was an ADDRESS and not the logic, and right that a fix aimed at the WRITE would move nothing in the third — the writes were already correct and the announcement body and two missing `Start` events were not. Thirty-two batches now carry the shape that a card is reliable about where and unreliable about why; a card that is right about why is worth recording precisely because it is not the base rate. **FOUR PREDICTIONS WERE WRITTEN DOWN BEFORE THE RUN AND ALL FOUR HIT.** The block below records a two-of-three and names its miss; this paper states the four-of-four beside it, because a prediction record that only appears when it flatters is not a record. **NO CHANGED DIVERGENCE FAMILY WENT UP:** `active[].stall` 11 → 5, `party.ability` 2 → 0, `active[].vol.encore` 1 → 0, `pp[].ragepowder` 1 → 0, and `boosts.atk` 5 → 3 on both sides. **WHAT IS NOT FINISHED, NAMED RATHER THAN IMPLIED.** The gate is red at 50. The third clause of ROADMAP #541 is not closed. The `active[].species` counter is still unmoved and what remains there is forme-flip TIMING rather than the revert. The largest unexamined VOID head is an accuracy case involving Parting Shot. A fourth mechanism stays fenced by ROADMAP #542 until it is split into attributable pieces. **NOTHING DOWNSTREAM BECOMES QUOTABLE.** No model was fitted, no weight vector was written, the quarantine does not lift, and every withheld figure in this paper stays withheld.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE — QUOTE NEITHER WITHOUT THE NAME.** `data/verification/fix-batch-M5M7M8.json` holds board-material 50 of 961 and protocol 150 of 961. `data/game-differential.json` is the artifact the gate clause reads; it was not rewritten in this pass and still holds board-material 77 of 961. Both are correctly measured on the pins each records. Only the second is published, and it is the one the gate prints.

**AN INSTRUMENT THIS PAPER RETRACTED A CLAIM FROM NOW MEASURES THE ENGINE, AND IT REFUTES THAT CLAIM ON ITS OWN FIXTURE.** `tests/probe_leaf_widening.js` is the probe behind the Unburden claim withdrawn at 5.246.0, and its defect was that it compared its own stand-in against the authority rather than the engine against the authority. It now calls `effSpeed` out of the same frozen release the game is played on, twice per body, against the authority's `getStat('spe')` modified versus unmodified. Both arms appear in one game: a non-carrier that lost its item reads `effSpeed 122←122 ×1` and does not register the volatile, while the carrier reads `344←172 ×2` and does. It was shown red twice before being trusted — injecting the retracted claim prints `DISAGREE`, and forcing `effSpeed` to throw prints `COULD-NOT-MEASURE`, which is the instrument declining to make a claim rather than making a weak one. The engine half of ROADMAP #535 is now measured, at `effSpeed 244←122 ×2` for a body handed the ability's spelling with its hand already empty, so the doubling follows the CURRENT ability; the authority half remains `INSTRUMENT OWED` and no citation was invented for it.

**THREE THINGS THIS PASS FOUND THAT ARE NOT ENGINE DEFECTS, AND THE FIRST IS THE ONE WORTH KEEPING.** A probe was VACUOUSLY GREEN in its first form and the COUNTERS caught it, not the boards: the fixture had the holder clicking Protect, so the contact move never reached the handler on EITHER engine and the two boards agreed about a mechanic that never fired. A comparison cannot detect its own silence, which is why an instrument must report how many times the thing under test actually ran. Second, a measurement command written into this session's own brief was wrong — `--out` without `--write` writes nothing and exits 0 — the ninth variant of the command-that-succeeds-having-done-nothing class recorded in this project, and the first one authored by the coordinator rather than found in the tree. Third, about 60 checks that nothing runs were triaged and ZERO were wired: 63 of the 66 load a simulator, an agent was editing that simulator throughout, and certifying a red arm and a green arm against a moving tree would have produced a certificate about nothing. Two open defects are named rather than filed away: `engine/side_selection_census.js` exits 1 at undeclared 84 against a ratchet of 81, with all four new sites arriving in earlier commits and nothing having run the check, and 9 of 124 `VERIFIED BY:` markers are refused by `engine/register_reality.js`'s own `SAFE` predicate and therefore read as `NOT_STARTED` — a register row that claims an instrument, is declined by the tool, and is reported neither verified nor unverified. **CUTTING THE NEW RELEASE ALSO STRANDED PINNED ARTIFACTS** — `engine-diff`, the roster stages and `all-mechanics-fire` now name a release the tree has moved past and must be regenerated before their clauses speak again. That is the pin guard working as designed, and a stranded artifact is a figure to withhold and re-measure rather than one to resurrect.

**5.247.0 — THE BOARD-MATERIAL WHOLE-GAME FIGURE FALLS 77 OF 961 TO 61 OF 961 ON THREE ENGINE FIXES — SIXTEEN GAMES — AND THE PUBLISHED CLAUSE STILL READS 77, BECAUSE THE GATE'S ARTIFACT WAS DELIBERATELY NOT REWRITTEN.** This is the first version in this document's recent history in which the gating quantity moves on engine work rather than on a ruler: 5.245.0 measured it flat at 77 → 77 with the comparator as the only variable, and 5.246.0 moved no engine byte at all. Protocol first-divergence, the quantity that reports without gating, is 168 → 161. Both runs are pinned identically — engine release `8ad06030e129` before and `f3504e5f88d6` after, the same census pin, the same frozen team pool, the same empirical steering driver and the same 961 games — so the three fixes are the only variable, which is the condition under which sixteen games is attributable at all. **THE CAVEAT IS PART OF THE FIGURE AND TRAVELS WITH IT EVERY TIME**; it is stated in its own paragraph below rather than buried in this one, because two correctly-computed numbers with only one of them published has forced three reconciliations in this project already. **THE THREE MECHANISMS.** A `multiaccuracy` volley landed the wrong number of arrivals: the authority rolls accuracy PER ARRIVAL and stops at the first miss, and the two moves in this regulation carrying that flag — Triple Axel and Population Bomb — were derived from the format rather than recalled. A non-permanent forme was not reverted on switch-out, where `clearVolatile` ends with `setSpecies(baseSpecies)` (`sim/pokemon.ts:1564`); the control is a body whose forme IS permanent and which must therefore NOT revert. And a `choicelock` was never cleared — one of the five leaves the protocol never narrates, which is exactly why a protocol comparison could not see it and why the board clause could; that divergence family goes 5 → 0. **THE METHOD IS THE MORE DURABLE RESULT, AND IT COST THIS PASS TWO OF ITS THREE STATED CAUSES.** The diagnosis card was right about WHERE all three times and wrong about WHY twice. The volley's addresses were **eleven of eleven shared before and after**, so the defect was never an address; it was the accuracy VALUE, and that was proved arithmetically off the shared die BEFORE any line was edited. Two of the three bodies named for the forme defect were already correct on the switch-out road. Thirty-two batches now carry the same shape: **a card is reliable about where and unreliable about why**, and treating a stated cause as evidence would have produced two wrong fixes here. **THE PREDICTION WAS WRITTEN DOWN BEFORE THE RUN AND SCORED TWO OF THREE.** Board-material was called at 60–70 and landed at 61; protocol was called at about 162 and landed at 161; the third counter was called at 0–2 and **did not move at all — that is a MISS and it is recorded as one.** The stated reason is that one fix removed a whole divergence shape while the games carrying it retain other unshared addresses, so they remain void. A prediction whose misses are not counted is not a prediction, and this project has paid for interim readings often enough to write the score down rather than the narrative. **A REGRESSION WAS CAUGHT BY THE LAB AND NOT BY THE POOL, WHICH IS THE TWO-SCOREBOARD RULE PAYING FOR ITSELF RATHER THAN BEING ARGUED FOR.** The first form of the choice-lock fix took the mechanics census 829 → 828 while the pinned pool measured **identically on both forms**; the fix was narrowed and the census returned to 829. The pool is usage-weighted by construction and answers *does this matter*; the lab stages one scenario per entity and answers *is this correct*. Neither is a substitute for the other, and only one of them could see this. **WHAT IS NOT FINISHED, NAMED RATHER THAN IMPLIED.** The `active[].species` counter is unmoved: what remains there is the TIMING of the forme flip rather than the revert, and no probe covers it. The largest remaining divergence head is an accuracy case involving Parting Shot, unexamined. A fourth mechanism in the same batch is deliberately untouched and stays fenced until it is split into attributable pieces. **NOTHING DOWNSTREAM BECOMES QUOTABLE.** No model was fitted, no weight vector was written, the quarantine does not lift, and every withheld figure in this paper stays withheld.

**WHICH ARTIFACT HOLDS WHICH WHOLE-GAME FIGURE — QUOTE NEITHER WITHOUT THE NAME.** `data/verification/fix-batch-M1M3M4.json` holds board-material 61 of 961. `data/game-differential.json` is the artifact the gate clause reads; it was NOT rewritten in this pass and still holds 77 of 961. Both are correctly measured on identical pins. Only the second is published, so the gate clause still prints 77 until MEASURE republishes it.

**5.246.0 — RETRACTION. THE BROAD UNBURDEN CLAIM PUBLISHED IN 5.245.0 IS REFUTED, AND THE INSTRUMENT WAS WRONG BEFORE THE ENGINE WAS.** The 5.245.0 block below states, in this paper's own words, that `effSpeed` recomputes the doubling from `_hadItem && !m.item` — *"so **every body in this engine that loses an item gets Unburden's speed doubling** — a Knock Off, a consumed berry, a spent Focus Sash"*. **That sentence is withdrawn.** It is left standing where it was published: a dated block is evidence, and it is superseded from here rather than rewritten. **THE READING WAS WRONG AT THE LINE.** `engine/medicham2-browser.js:14770` is the ENTRY GUARD only; the multiplier is pushed on the next line, `:14772`, gated on `TAGS.param('ability', m.ability, 'speedOnItemLoss')`. Walking the ability block of `data/tags.json` returns exactly one key carrying that parameter, `unburden`. A census control already on record separates the two readings directly: the must-not-move arm, an ability of `none`, reads `187,187`, and the Unburden arm reads `187,374`. **THE MECHANISM OF THE ERROR IS THE DURABLE HALF, AND IT GENERALISES PAST UNBURDEN.** `tests/probe_leaf_widening.js:277` never read this engine's Speed. It computed its own predicate — `const stand = m => (m && m._hadItem && !m.item) ? 1 : 0` — and compared that against the authority's `unburden` volatile. Its agreeing reading therefore asserted only that both bodies had lost an item; it could not have detected a multiplier, present or absent, in either direction. **An instrument that compares its own stand-in against the authority can only ever confirm its own stand-in.** This is the third instrument failure of the same night, after a probe printing `undefined<>undefined` as its receipt and a selftest exercising a five-line copy of the rule it was checking. **SOMETHING IS STILL WRONG AND IT IS NARROWER.** ROADMAP #535: the doubling is recomputed from the body's CURRENT ability rather than held as the volatile the authority grants at the instant the item is lost, so an Unburden acquired AFTER the hand is already empty doubles here and does not in the authority. Skill Swap is the reachable door. The row is filed `INSTRUMENT OWED` — nothing in the tree currently decides it, and no figure in this paper rests on it. **SIX REGISTER ROWS WERE FILED FOR DEFECTS THAT EXISTED ONLY AS PROSE**, taking the register from `497` to `503` rows and `251` to `257` open. Only one of the six carries a `VERIFIED BY`; the other five say `INSTRUMENT OWED` rather than citing a probe that does not exist, which is the difference between a defect that is measured and a defect that is asserted. The phrase `NOT A DEFECT` was deliberately used in none of them: `engine/quarantine.js:1040` matches that string in a row's status cell and treats it as a ruling that overrides the derived verdict, so a casual note in a register cell is executable. **THIS VERSION FIXES NO ENGINE DEFECT AND PUBLISHES NO NEW MEASUREMENT**, and `node engine/status.js --write` was not run in this pass, so every generated block in this repository is read from the tool rather than from prose.

**5.245.0 — THE WHOLE-GAME CLAUSE COUNTED PROTOCOL FIRST-DIVERGENCE AND NOW COUNTS BOARDS. THE GATING FIGURE IS BOARD-MATERIAL 77 OF 961 (8.0%); THE 167 OF 961 THIS PAPER HAS BEEN QUOTING AS *THE* WHOLE-GAME NUMBER IS NARRATION, AND NARRATION NOW REPORTS WITHOUT GATING.** **THIS REVERSES A PUBLISHED POSITION; THE DATED BLOCKS BELOW STAND AS WRITTEN AND ARE SUPERSEDED FROM HERE RATHER THAN REWRITTEN.** Wherever a block below states or implies that the whole-game clause counts protocol first-divergence, that reading is retired. The gating clause now reads `state.games − state.games_board_never_diverged` = 961 − 884 = **77**, and a separate `narrationClause` carries protocol first-divergence at **167** (168 raw, less one declared row) marked `gates: false`. Both clauses name their quantity in their first words and carry a machine-readable `quantity` field — `board_material_games` and `protocol_first_divergence_games` — because two correctly-computed numbers printed side by side with only one published has already cost this project three reconciliations in a single session. **THE NON-GATING FLAG IS APPLIED BY A WRAPPER TO EVERY RETURN PATH, INCLUDING THE REFUSALS.** In the first draft only the final verdict carried it, so a stale or torn artifact would have made narration come back WITHHELD, default to gating, and hold the gate shut on the exact quantity the ruling took off the critical path; two arms now assert that both refusal families keep the flag. **NO CONFIDENCE INTERVAL IS QUOTED AND NONE IS OWED.** Both figures are exact counts over one pinned paired sample — engine release `8ad06030e129`, census pin `9446a684709d`, frozen pool `data/team-pool-frozen`, 961 paired games, every die pinned on both sides — so an interval would be decoration on a deterministic comparison rather than an estimate of a population. **THE GATE READS `CLOSED — 1 of 8 GATING clauses fail`.** Seven pass on artifacts that can now prove what produced them; the one failure is the real engine backlog. **THIS IS WILL'S 2026-08-22 RULING BEING IMPLEMENTED AND IT IS NOT A RELAXATION, ON MEASURED EVIDENCE RATHER THAN ASSERTION.** Of the 168 protocol divergences in the artifact, **102** write no differing board leaf at any compared turn boundary: real work, and narration. Against that, **11 of the 77 part a BOARD while the protocol never diverges at all** — derived from four artifact fields as `material − (protocol_diverged_games − protocol_diverged_board_never_did)` = 77 − (168 − 102), named as derived, and deliberately not clamped, so that a negative reads as the artifact contradicting itself rather than as a clean bill of health. Under the single clause those eleven games left the count altogether, **so a fix that closed a protocol divergence without repairing the board would have improved the headline without improving the engine.** On those eleven the split raises the bar. Nothing may be subtracted from the board count, and that is structural rather than strict: both subtraction mechanisms attribute by protocol CAUSE over `classes[].causes[]`, while a parted board is recorded as a leaf PATH carrying no cause, so the board clause publishes a raw count and says so. Narration keeps `--narration` as its own exit — it returns 1 while red — because a quantity that only appears inside a four-minute report is a quantity nothing defends. **THE COMPARATOR WAS AGREEING BY NOT LOOKING, ON THREE OF THE LARGEST LEAVES IN THE FORMAT.** `volatile:throatchop` (5,577 uses), `volatile:mustrecharge` (4,701) and `volatile:flashfire` (1,416) were reaching the board with nothing reading them, so a game whose only disagreement lived in one of them scored as agreement. Board leaves compared move **34 → 37 of 80** and the unread hole **42 → 39**; each leaf was shown RED first, with the agreeing-board control silent on both sides. **THE WIDENING THEN MEASURED FLAT — board-material 77 → 77, protocol 168 → 168 — against a prediction registered before the run that it would rise or stay flat and could not fall.** The release id did not move (`8ad06030e129`), because the comparator `engine/board_state.js` is not one of the twenty-six frozen sources; the engine bytes were identical and the comparator was the only variable. **Flat does not prove those three leaves clean**: the artifact records divergences, not per-leaf agreements. **AN HONEST CORRECTION TO A CLAIM MADE EARLIER THE SAME DAY.** The widening was described as generalising. The comparator side does — two lines per leaf, and `SD_VOLATILE_KEYS` derives itself — but **the FIXTURES do not**, and Unburden is the proof that a leaf can look wireable on every derived column and still hold a different quantity under the same name. This engine keeps no state under that name: `effSpeed` recomputes the doubling from `_hadItem && !m.item` (`engine/medicham2-browser.js:14770`), so **every body in this engine that loses an item gets Unburden's speed doubling** — a Knock Off, a consumed berry, a spent Focus Sash — where the authority grants the volatile only from Unburden's own `onAfterUseItem` / `onTakeItem`. That is an ENGINE defect owed a register row, not a comparator gap, and the remaining nineteen leaves are real work rather than a loop. **THE FIVE PINNED ARTIFACTS WERE REGENERATED AND NOW CARRY A VERIFIABLE PIN** — `engine-diff`, the three roster stages and `all-mechanics-fire` — each with twenty-six `source_digests` plus `showdown_commit`, read back field by field rather than trusted, behind one door (`engine/pin_guard.js`) that withholds on an absent, wrong or unverifiable pin. **No measured figure moved:** the damage differential holds **0 of 6,000** at the midpoint and at both corners, the roster holds 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three stages, and the mechanics verdicts are identical row for row. Three of those five regenerations were impossible until a guard added hours earlier was repaired: it ran at MODULE LOAD off the whole process's argv and killed `roster.js --write` and `all_mechanics_fire.js --write` at exit 2 — **the SKIP code**, so the runner would have reported them politely skipped rather than failed. **NOTHING DOWNSTREAM MOVED AND NOTHING WITHHELD BECOMES QUOTABLE.** `data/policy-weights.json` was not written, no model was fitted, and MAG stays paused by the owner's decision; that the measuring path does not touch it was verified in code rather than assumed — `game_differential`, `roster`, `all_mechanics_fire`, `test-engine-diff` and `steering` contain zero references to MAG or the policy weights, and the empirical driver samples `data/move-priors.json`, which is recorded human play with no model in the path. Smogon's August 2026 statistics were archived as a COMPARISON SET that feeds nothing: **310 species, 1,269,250 bo1 battles, zero illegal**, with the Champions SP fingerprint (66/32, zero violations) checked because the header carries no format name and a filename proves nothing. Full accounts: six reports under `docs/_reports/2026-09-04-*.md`.

**5.244.0 — THE REPOSITORY ALREADY KNEW AND NOTHING ACTED. NO ENGINE BYTE MOVED, NO MODEL WAS FITTED AND NO QUARANTINED FIGURE BECOMES QUOTABLE; WHAT MOVED IS THE SET OF INSTRUMENTS THAT READ WHAT OTHER INSTRUMENTS ALREADY SAY.** **THE SHAPE IS THE RESULT.** Three findings in this pass share one structure and none of them is an engine defect. `engine/status.js` was printing the row `driver policies the gate quotes — 1 of 2` on line 103 of a 253-line output. `engine/durable-ingest.js:464` explained the archive drift in a comment and instructed *"RUN THIS BEFORE ANY REPARSE"*. `tests/run-all.js` was red on its own unaccounted-checks clause. In each case the fact was derived, was written down, and no consumer read it — the same failure this project already records for the fourteen stale handoffs and for a red gate reported as "one of the two known failures", arriving through a door where the prose was CORRECT and merely unread. **THE AXIS THAT MATTERS IS THEREFORE NOT WHICH BUG, BUT WHETHER THE REPAIR MAKES THE FAILURE UNREACHABLE.** Every item below is CLASS-level (the failure cannot recur in a new spelling) or INSTANCE-level (one door closed), and the acceptance test is the owner's: *would this catch a second instance, spelled differently, arriving through another door?* **CLASS-LEVEL: AN INSTRUMENT FOR WHAT EACH INSTRUMENT FAILS TO CHECK ABOUT ITSELF.** `engine/sweep.js`, five derived sections, about three seconds, exit 1 on any finding. First run: **60 checks nothing runs**, **3 of 8 clauses blind to their own staleness**, **12 published figures out of date**, **783 of 1,048 counter fields nothing reads**, **614 store rows with no raw log**. Every `CANNOT DERIVE` path was shown red under `SWEEP_BREAK=1..5` before the tool was trusted, because a sweep that silently derives nothing reports a clean repository — the exact failure mode it was built to find. **CLASS-LEVEL: MUTATION TESTING, PILOTED ON THE GATES RATHER THAN ON THE ENGINE.** The engine has a strong external oracle in the official simulator; **the gates have none**, and that asymmetry is how a gate reading `8 of 8 PASS` survived being false. `tools/mutate-gates.js` with `stryker.gates.conf.json`: **83 mutants, 57 killed, 26 survived, 28s**. A surviving mutant is a clause whose failure nothing observes, which is the same claim `tests/test-wiring.js` makes about a capability that cannot prove it ran. **CLASS-LEVEL: THE RAW LOG IS THE SOURCE OF TRUTH AND THE STORE IS A DERIVED VIEW.** The inversion behind a dozen store reworks was that the REGENERABLE artifact was durable and the IRREPLACEABLE one was gitignored. Four repairs, taken in order: `engine/durable-ingest.js:543` ran the completeness filter BEFORE the archive write, so a game the CURRENT parser could not read had its raw log deleted, destroying the one artifact a FUTURE parser could have used; the store row was written BEFORE the log on independent streams, so a crash left an orphan row rather than an unparsed log, which is the wrong direction, and both passes now run through one exported `archiveThenStore()` with store output verified byte-identical; the archive becomes **write-once dated shards** rather than one compressed blob; and `get()` resolved an empty string on HTTP error, on timeout AND on an empty body — **three facts collapsed into one value**, which is precisely why a dead API and a quiet day were indistinguishable, now null on failure with the discriminator derived from the endpoint rather than assumed. **A PUBLISHED ESTIMATE IS REVERSED HERE, NOT QUIETLY REPLACED.** The single-blob archive was previously described as roughly 65 days away from trouble. Measured at **13.98%** compression it is **78 MB across both archives today, already 78% of the 100 MB limit**; the estimate was wrong and the shard design is what follows from the measurement. The shard scheme also failed once under test before it shipped: a `-2` collision suffix sorts BEFORE `.jsonl`, which replays an append-only archive out of order. **AND ONE GUARD HAD ASSUMED THE OLD EQUALITY.** `engine/rebuild_records.js:117` compared COUNTS. Once an unparseable log is legitimately archived the archive is a SUPERSET by design, so that guard would have refused every valid rebuild — and it was already letting a bad one through: with a truncated log the counts balanced **3 == 3** and it swapped in a corrupted store at exit 0, while another arm lost a game outright. It now filters on completeness and re-asks the guard BY ID, naming any game that would be lost, which is strictly stronger than what it replaced. **A SECOND REVERSAL: 5.242.0's DIGEST REPAIR WAS INSTANCE-LEVEL AND RE-ARMED THE SAME FAILURE.** That version fixed two named terms in `engine/feature_fixture.js`'s `tableDigest()`. An ENUMERATED list of hashed fields means a field added tomorrow goes unhashed, so the class was untouched; the hashed set is now DERIVED from the rows' actual keys minus a six-entry declared exclusion map. The derivation then found a second blind class the list could not have: **an ABSENT field hashes identically to a PRESENT AND EMPTY one**, so deleting a Pokemon's entire moveset moved nothing — live on **4 rows for `mv` and 10 for `item`**. The digest value is **unchanged at `9d289cf77e24`**, so this adds no third reason to restamp, and 5.242.0's RESTAMP-not-refit verdict stands as the owner's call. **AND A KEY GATE HAD FIVE SILENT LIMITS RATHER THAN ONE.** `tests/test-artifact-keys.js` sliced to **8 keys**, capped depth at **3** where the deepest real object is **10**, never descended arrays, iterated a hard-coded two-name list, and **exited 0 when the engine data failed to load**. The compound effect was that `MC.priors`, **230 keys**, was never inspected once — inside the file written to catch hand-typed lookups. The cost argument that justified the truncation was false when measured: a full walk is **733ms** against **596ms** truncated. It now walks fully, FAILS rather than truncates when a budget is hit, and prints its own out-of-scope set by name (**5,466** `.json` files in **12** directories). **13 undeclared tables** are newly visible and are REPORTED, not fixed. **THE ONE REGRESSION THIS PASS CAUSED, AND THE ARM THAT KEEPS THE REPAIR HONEST.** `tests/test-divergence-composition.js` broke because 5.243.0's steering refusal fires on two synthetic fixtures that carry no steering block: quarantine's own selftest fixtures were updated in that commit and this consumer was missed. The fixture now takes the constant from `engine/steering.js` rather than a typed string, **and a third arm asserts the refusal** — without it, repairing the fixture would have silently deleted coverage of the branch 5.243.0 had just built. **THREE CHECKS COULD NOT RUN AT ALL** — exit 134, out of heap, with no declared heap ceiling. With one, `tests/test-engine-release.js` gives **71 passed / 0 failed**, `tests/test-set-realism.js` gives **6 passed / 0 failed**, and `engine/validate_selfplay.js` gives a real verdict plus a genuine finding it had been too dead to report. A check that cannot start is indistinguishable from a check that passes if nobody reads the exit code. **ATTRIBUTION WAS MEASURED, NOT INFERRED.** `tests/run-all.js` reads **143 passed, 28 failed**, and **exactly one failure was caused by this session** — established by re-running each red test at the prior commit in a control worktree. Five are tests asserting a stale fact, three were heap ceilings, twenty were already red. **The two strongest medicham2 hypotheses — `test-pin-arms` and `test-game-differential` — were both REFUTED by that control**, which is the whole reason the control was run before the diagnosis was written. **THE COUNT ITSELF WAS MISREPORTED TWICE BEFORE IT SETTLED: 23, then 30, and the truth is 28.** The first was a torn read — a line count taken on the runner's output while it was still being written, which is this repository's documented artifact hazard applied to a log. **AND A COMMAND RAN FOR TWENTY MINUTES HAVING DONE NOTHING**, where the tell was not the exit code but **2 seconds of CPU**: output piped through a buffering pipeline stage makes a stalled run and a working one look identical. **THE COMMENT CENSUS, over 495 files and 17,519 comments**, gives the base rate this project has never had: **0 confirmed** comments contradicting their own code across **1,371** candidates, **2** TODO/FIXME markers (both false positives), **37** references to things that no longer exist, **4** imperatives with no executor and **6** whose executor is RED. The standout is exactly the failure this entry opens with: `engine/engine_release.js:653` heads a section titled *"PRUNING, AND WHY IT IS SAFE"* whose safety argument reasons from **nine releases holding 23 MB**, against **523 releases holding 2.5 GB** today. `ROADMAP #144` is cited in the code and has never been a register row — **nine such ids across 30 citations**. **NOT FIXED, ROUTED, AND NAMED SO THEY CANNOT BE MISTAKEN FOR CLOSED:** **89 duplicate ids** in the self-play store; one unattributed finding in `engine/conformance.js`; the 13 undeclared key tables; and a raw-log census artifact that still asserts the old subset relation with no generator to correct it. **WHAT WAS NOT RUN, DELIBERATELY.** `node engine/status.js --write` was not run, so the generated blocks in the division ledgers are one pass behind. The fitted policy weights were not written and MAG stays paused. `npm install` was not run — the mutation dependency is declared and uninstalled. **7,275 raw logs were recovered across both stores** (**6,661** ladder, **614** bo3, **0 unavailable, 0 without a timestamp**), both archives are complete supersets, a re-parse is unblocked, and the unaccounted-checks count falls **60 to 58**. Full accounts: eleven reports under `docs/_reports/2026-09-04-*.md`.
**5.243.0 — THE WHOLE-GAME CLAUSE WAS ANSWERED BY A DRIVER THAT DOES NOT TRY TO WIN, SO IT CERTIFIED THE SIMULATOR ON A POPULATION IN WHICH THE GAMES DO NOT END. THE OPEN GATE IS RETRACTED.** `engine/quarantine.js` read **8 of 8 PASS**. It now reads **GATE: CLOSED — 1 of 8 clauses fail**, and that is the correct outcome rather than a regression; nothing was tuned to reach it, and the failing clause is state (b), a named instrument actually failing. **THE DEFECT.** The artifact answering the whole-game clause was produced by the `census-coverage-seeking/v1` driver, whose objective is census coverage and not victory: **17 of 961 games reached a result (1.8%)**, 944 stopped at the 12-turn cap with both sides standing, and **0 boards parted**. A board cannot part at the end of a game that has no end, so the clause was not measuring the quantity it published. **THE CONTROL IS EXACT AND THE DRIVER IS THE ONLY FREE VARIABLE.** Re-measured at the same engine release `8ad06030e129`, the same 12-turn cap, the same frozen pool `0d103fb9fa87`, the same census pin `9446a684709d` and the same 961 games played of a 1200 PAIR budget, the `empirical-click/v1` driver — which draws each action from real recorded human play — reaches a result in **474 of 961 (49.3%)** and **77 boards part**. **THE CORRECTED FIGURES ARE TWO QUANTITIES AND MUST NEVER BE POOLED.** Board-material divergence is **77 of 961 (8.0%)**; protocol first-divergence is **168**. Every statement of either must name which one it is. **THIS REVERSES A PUBLISHED POSITION.** Every clean or near-clean whole-game reading in the dated blocks below was taken on the coverage arm. Those blocks stand as written and are superseded here rather than rewritten, but the reason they read clean is now known: the population they described almost never reached an ending, so the instrument could not have seen a late divergence, and this document's earlier suggestion that the MEDICHAM quarantine was close to lifting rested on that arm. **WHAT CHANGED IN THE INSTRUMENTS.** `data/game-differential.json` IS the empirical arm now — one published quantity rather than two files that can drift — and `engine/game_differential.js` refuses at second zero to publish a coverage run into that path, because `--write` without `--out` now requires `--steering empirical`. The clause reads the artifact's own `steering.policy` and withholds its figures from anything that is not `empirical-click/v1`, including an artifact carrying no steering block at all, with verdict `MEASURED ON THE WRONG POPULATION` and `clauseExit` 2. **A gate that cannot tell which driver produced its input is the defect; the clean reading was only the symptom.** It was demonstrated RED against the real coverage artifact before that artifact was replaced and re-verified afterwards against a preserved byte copy of it; selftest 159 passed, 0 failed. **ONE MISMATCH IS DECLARED AND DELIBERATELY NOT CLOSED.** The clause prints **167** because it gates on protocol first-divergence less the single declared case, not on board-material. The owner's 2026-08-22 call is that the bar is board-material with narration as its own later gate, which makes 77 the figure the clause should read. Moving it in the same pass that turned the gate red would be indistinguishable from tuning, so it is his call and it is owed. **NOTHING DOWNSTREAM MOVED.** `data/policy-weights.json` was not written and MAG stays paused; `node engine/status.js --write` was deliberately not run, so the generated blocks in the division ledgers are one pass behind and may not be read as current. Full account: `docs/_reports/2026-09-03-gate-reads-empirical-arm.md`.
**5.242.0 - `tableDigest()` HASHED `m.ty`, A FIELD CARRIED BY 0 OF 322 ROWS, AND DID NOT HASH `wt` AT ALL.** **THE DEFECT IS IN A RULER, NOT IN THE GAME.** `engine/feature_fixture.js`'s `tableDigest()` is the function that decides whether the damage table underneath a fitted vector has moved. It hashed `m.ty` for typing, and this table spells typing `t` - so `m.ty` is present on **0 of 322 rows**, the term evaluated to a constant `null` on every row of every run, and a TYPE change has never been visible to it. `m.wt` was not hashed at all, and weight is a live damage input in this format, through Low Kick, Grass Knot, Heavy Slam, Heat Crash, Heavy Metal and Light Metal. Both are hashed now, `m.t` and `m.wt`; term order is append-only, so the diff reads as one repaired term plus one new one. `nature` and `sp` stay unhashed on purpose - they reach the damage formula only through `st`, which is hashed - as do the four provenance fields. **AN ABSENT FIELD HASHES AS `null` EXACTLY LIKE A FIELD THAT IS PRESENT AND EMPTY, WHICH IS WHY READING THE CODE WAS NEVER GOING TO SETTLE IT.** Nothing in the digest's output separates *the term is dead* from *the term is live and today's rows are empty*, so the blindness was demonstrated by MUTATION rather than by inspection: mutating one row's `t` in memory did not move the digest, nor did mutating `wt`, while mutating `mv` and `st` did - the control that proves the mutation harness can see a change at all. After the fix all four move. A second control was run in the other direction: a `ty` field was INVENTED on one row and moved the digest BEFORE the fix, proving the term was live in the hash and the data had simply never populated it. Only a mutation test separates those two readings, which is why one now exists, and `tableDigest` is exported so the probe calls the canonical function instead of copying it. **NO CONFIDENCE INTERVAL IS QUOTED, BECAUSE NOTHING HERE IS AN ESTIMATE.** Every claim above is an exact comparison of two hex digests over a fixture mutated one field at a time - no sampling, no rollout, no population, so an interval would be decoration on a deterministic result. What IS an estimate, and is not offered here, is any statement about how much a fitted vector would move; that is a refit, and no refit was run. **MEASURED.** The damage-table digest moved `1bda9df11d73` -> `9d289cf77e24` **with no change to the table itself** - the ruler changed and the thing it measures did not. `tests/test-feature-semantics.js` 24 passed, 0 failed. `engine/status.js` parses this gate's printed OUTPUT rather than its code, so the shape was deliberately not touched: it still matches `FEATURE SEMANTICS CHECK FAILED`, still exits 1, and its verdict is unchanged. **THE STAMP IN `data/policy-weights.json` IS NOW STALE FOR TWO INDEPENDENT REASONS AND ONE RESTAMP WOULD FUSE THEM.** The damage table was regenerated (318 -> 322 species) *and* the ruler that watches it changed. A single restamp absorbs both causes and cannot separate them afterwards, so the distinction is recorded in the CHANGELOG, which is the only place it survives. **NO RESTAMP AND NO REFIT WERE RUN, BY THE OWNER'S EXPLICIT DECISION - THAT IS A DECISION, NOT AN OMISSION.** MAG stays paused until MEDICHAM is correct; MEDICHAM is upstream of the weights, so a refit under a simulator still known wrong would only have to be repeated. `data/policy-weights.json` was not written, and the RESTAMP-not-refit verdict recorded at 5.241.0 stands and waits for him. **5.241.0 DEFERRED THIS FIX ON THE GROUND THAT CORRECTING THE RULER MOVES THE DIGEST; WHAT MADE IT SAFE TO LAND HERE IS THAT NOTHING WAS RESTAMPED.** The trap that deferral guarded against was clearing a gate ahead of the verdict it is supposed to inform, and the gate is not cleared - it fires on the same clause, with the same `how:` string already stamped in `docs/MEASURE.md`. Full account: `docs/_reports/2026-09-03-table-digest-blind-fields.md`.
**5.241.0 - A DELAYED HIT TOOK NO CRIT DRAW AT ALL, AND A BROKEN SUBSTITUTE'S `lastDamage` CARRIED THE BODY'S CEILING RATHER THAN THE DOLL'S.** **THE DELAYED HIT.** `data/conditions.ts:415` hands a delayed payout to `trySpreadMoveHit`, so the payout takes the FULL step list, crit step included (`sim/battle-actions.ts:1156` -> `:1636-1642`, `critMult = [0,24,8,2,1]` at `:1633`; the x1.5 at `data/mods/champions/scripts.ts:222`, the `|-crit|` line at `:285`). Champions carries no `futuremove` key at all - derived from the mod, not recalled. **THE SIGNATURE WAS THE UNWIRED KNOB RATHER THAN A MISSING LINE, AND THAT IS THE WHOLE EPISTEMIC POINT.** Handed a crit-CERTAIN die and then a crit-IMPOSSIBLE one on the same board, the authority answered **72** with `-crit` and **48** without; this engine answered **69 both times**, with `delayedHitCritDrawn` at **0**. Identical output across a varied input is not a null result about the mechanic, it is a positive result about the wiring: the knob was never connected, so no amount of sampling could have found the defect. The draw is now taken UNCONDITIONALLY, so a Shell Armor arm and a bare arm spend the same stream; it goes through the same crit owner the direct click already calls, so Shell Armor, Battle Armor, a Scope Lens and a raised stage need no second reader; and the hit is RE-PRICED as a certain crit rather than multiplied afterwards, because the authority's x1.5 lands above the randomizer, STAB, the type chart and burn - a late multiply would be the wrong stage as well as the wrong number. **THE SUBSTITUTE.** `data/moves.ts:18341-18357`, not overridden anywhere in `data/mods/champions/`: the authority clamps the damage to the doll's remaining HP BEFORE it books `lastDamage`, and recoil and drain are then paid from that clamped figure. This engine banked its own clamp sixty lines above the substitute branch, against the BODY's current HP, so the ceiling was never the doll's - an overkill into a doll paid recoil **-25 where the authority pays -12** and drain **+62 where the authority pays +21**. One helper now takes an explicit ceiling and three callers pass their own, rather than two implementations of "how much did this actually deal". **NO CONFIDENCE INTERVAL IS QUOTED, BECAUSE NEITHER RESULT IS AN ESTIMATE.** Both are exact-value comparisons against the authority on a staged board with the die pinned by the probe; each probe was shown RED first with its controls already green, and RED again under its restoring knob, which is what separates a fix from a coincidence. **DECLARED REMAINDER, NOT FIXED HERE.** The substitute road's drain is `Math.ceil` in the authority and `Math.round` in this engine. The two coincide on every 1/2-fraction drain move in this format and part on Draining Kiss's 3/4 - so the drain arm of the probe agrees partly by the luck of the fraction, and that is stated rather than left to be found. **MEASURED.** Census 827 -> **829 live / 829 probed / 0 missing / 0 hollow / 0 threw / 0 unarmed**. **THE PINNED POOL WAS NOT RUN AND NO POOL MOVEMENT IS CLAIMED IN EITHER DIRECTION** - the machine was in light mode. Both rows are rare-mechanic rows under the 2026-08-23 ranking rule, so the scoreboard was named before the work (the lab moves, the pool is expected to sit still); an unrun measurement is WITHHELD rather than captioned, and the command is in the report's OWED block. **TWO MEASUREMENT NOTES TRAVEL WITH THIS RELEASE AND NEITHER IS AN ENGINE CHANGE.** (1) **The weights-staleness gate has been blind to type and to weight.** `engine/feature_fixture.js:741` hashes `m.ty` - a field present on **0 of 322 rows**, because types live in `t` - and does not hash `wt` at all, so a type change or a weight change to any species moves the table and not the digest that is supposed to notice. It is deliberately NOT fixed in this pass: correcting it moves the digest, so it must land in the same pass as the restamp rather than before it, which is the trap of clearing a gate ahead of the verdict it is supposed to inform. (2) **The damage-table regeneration does not reach the fit - the verdict is RESTAMP, not refit.** All **91** touched rows are megas or in-battle formes, and `st`, `bs`, `t`, `item` and `ab` moved on ZERO rows. The substantive change is **76** mega moveset rewrites, and `engine/board.js` has exactly two `buildMon` call sites (`:1466`, `:3956`) - the first overwrites the table's moves with the sheet's, the second is fed base-species names - so the mega `mv` reaches **0 of 16,830** corpus games. Upper bound on games touched at all: **12 of 16,830 (0.07%)**. Full accounts: `docs/_reports/2026-09-03-crit-draw-and-substitute-clamp.md`, `docs/_reports/2026-09-03-damage-table-refit-verdict.md`.
**5.240.0 - ELECTRIC TERRAIN'S `onSetStatus` AND `onTryAddVolatile` WERE READ NOWHERE, WHILE ITS `onBasePower` WAS READ AT FOUR SITES.** `data/moves.ts`, `electricterrain.condition`; neither `data/mods/champions/moves.ts` nor `conditions.ts` carries an `electricterrain` key, so mainline is the authority and that is derived rather than assumed. The condition refuses `slp` to a grounded, non-semi-invulnerable body and refuses the `yawn` volatile to the same body, announcing `-activate|TARGET|move: Electric Terrain` when the source is Yawn or a Move with no secondaries. This engine did neither, so a Sleep Powder and a Yawn landed under Electric Terrain exactly as on a clear field. **ONE PREDICATE, TWO ROADS.** `eTerrainRefusesSleepOn` is called from `applyStatus` and from the yawn branch; wiring only the first would have looked finished and left the drowse and its `|-start|...|move: Yawn` standing for two turns. **THE MEMBERSHIP IS DERIVED AND IT CHANGED THE FIXTURE:** the legal sleep sources, carrier-checked through the format's own `checkCanLearn`, are Rest 346, Yawn 46, Hypnosis 27, Sleep Powder 26, Sing 7 and **Spore ZERO** - nothing in Reg M-B can click Spore. All five carry `formatSecondaryCount {count: 0}`, so the authority's `!effect.secondaries` branch is unreachable in this regulation; it is still read off the tag rather than collapsed. **`isSemiInvulnerable()` BELONGS HERE, WHICH IS THE OPPOSITE ANSWER TO THE `terrainScaled` ONE** - those handlers are on the MOVE and name `isGrounded()` alone; this pair is on the CONDITION and names it. **MEASURED.** Census 825 -> **827 live / 827 probed / 0 missing**, 0 hollow, 0 threw. Whole-game differential, `--end-state --steering empirical --census 9446a684709d --team-store data/team-pool-frozen`, release `53e3e90dce8d`: board-parted **unmoved at 77 of 961**, protocol **unmoved at 168**, causes **unmoved at 146** with zero added and zero removed, end-state identical at 910/49/1/0/1 - all four written to disk at their point estimate before the run, declared as a lab-only move. The still pool is MEASURED and not assumed: over the same 961 games `MEDSEEN.terrainRefusedSleep` and `terrainRefusedYawn` both read **0** while `terrainScaledGateApplied` reads 72, so the counter mechanism is alive and the mechanic is unreached. Ten of eleven predictions hit. Full account: `docs/_reports/2026-09-01-field-effect-part2.md`.
**5.239.0 - `punishesAttacker` ALREADY CARRIED A HAZARD AND A SKY; THE TWO EMPIRICAL CARDS ARE A SIDE SELECTOR AND A GUARD, AND THEY ARE TWO CAUSES.** The hypothesis under test was that the tag's payload could not express a side condition or a weather, so Toxic Debris laid its Toxic Spikes on the wrong side and Sand Spit set no sandstorm for the same reason. It is REFUTED by reading: `engine/tag_dex.js` derives `hazard`, `maxLayers` AND `setsWeather`, and `engine/medicham2-browser.js` consumes all three at two adjacent statements. **E1, the SIDE.** `data/abilities.ts:5096` picks it as `source.isAlly(target) ? source.side.foe : source.side`, and in a two-side game BOTH branches name the side opposite the HOLDER; this engine passed the ATTACKER's side field, which is the same answer for a foe and the wrong one for an ally, so a partner's spread move into its own Glimmora poisoned its own switch-ins. Only an ally can expose it, which is why `tests/probe_punish_announce.js` could write *"the layer was laid, on the right side"* and be correct about the arm it staged. **E2, the SKY.** `sandspit.onDamagingHit` is an ungated `setWeather('sandstorm')` and `Field#setWeather` (`sim/field.ts:45-52`) refuses ONLY when the same weather already stands (`gen > 5`, Ability source); this engine guarded on `!field.weather`, so a Sandaconda brought into weather - which is the usual case - never set its sand. That is also a facts-are-global break: `applyMoveWeather` and the `weatherSetter` entry block both ask `field.weather !== w`. **MEMBERSHIP, PRINTED FIRST:** thirteen `punishesAttacker` rows, every one with at least one legal carrier, exactly one carrying a hazard and exactly one a sky, so neither probe can be satisfied by a sibling. **TWO KNOBS, NOT ONE, AND THE 2x2 IS THE MEASUREMENT:** `MEDI_HAZARD_ON_ATTACKER_SIDE` and `MEDI_PUNISH_WEATHER_IF_CLEAR` each move only their own arms under both settings of the other, on the staged board and against the official simulator (0 failing clauses fixed, 6 under one knob, 6 under the other, 12 under both - the union with no interaction term), while the FOE-hit arm, the clear-sky arm, the already-sandstorm arm and ROUGH SKIN - a member of the same family that was already correct - do not move at any corner. **THE DELTA IS KNOB-CONTROLLED ON THE SAME RELEASE, NOT DIFFED AGAINST A PUBLISHED FIGURE:** the before-arm reproduces 172 protocol-diverged, 82 board-parted, 150 causes and end-state 905/53/2/0/1 exactly, with `first_divergences`, `classes` and `end_state` byte-identical strings to the baseline artifact. After: census 819 -> **821 live / 821 probed / 0 missing**, board-parted 82 -> **80 of 961**, protocol 172 -> **171**, causes 150 -> **149** (two removed, both naming one of these two mechanisms verbatim; one added, which is the same game running further and parting later on a different mechanism), end-state 905/53/2/0/1 -> **907/52/1/0/1**. Eight of eleven predictions hit, three missed by one step and none in the wrong direction. Full account: `docs/_reports/2026-09-01-punishes-attacker-kinds.md`.
**5.237.0 - THE ACCURACY STAGE AND THE EVASION STAGE ARE ONE CLAMPED STAGE, AND THIS ENGINE MULTIPLIED THEM SEPARATELY AND NEVER TRUNCATED.** `hitStepAccuracy` (`sim/battle-actions.ts:713-727`, no Champions override) sets `boost = clampIntRange(accuracyStage, -6, 6)`, then `boost = clampIntRange(boost - evasionStage, -6, 6)`, then looks the `(3+n)/3` table up ONCE and applies `trunc`. MEDICHAM did `acc *= accStageMul(accuracyStage); acc /= accStageMul(evasionStage)` with no combined clamp and no truncation. **IT DECIDES HIT OR MISS.** The authority's own numbers, captured from the argument that same call passes to `randomChance(accuracy, 100)` on a real staged Champions battle with the stages injected into the live bodies: printed 100 at -1 accuracy into +1 evasion is **60** where this engine rolled 56.25; at the caps it is **33** against 11.1; at +1 accuracy into +2 evasion it is **75** against 80, so the direction REVERSES and a fix that merely raised accuracy would be wrong. **THE TWO CLAMPS ARE SEPARATE AND NESTED AND ONLY THE SECOND CAN BITE:** a stage is already held inside +-6 when applied, and the one `onModifyBoost` ability with a legal carrier in this format sets a stage to zero rather than out of range, so the first clamp is a no-op; the second is the whole caps result, since -6 - (+6) is -12 and must come back as -6. **THE TRUNCATION REACHED FURTHER THAN THE COMBINATION DID, AND THAT WAS NOT PREDICTED.** The obvious sentence - the two forms agree whenever one side is zero - is false: they agree when one side is zero AND the result is an integer. An 80-printed move into +6 evasion alone is 26.667 here and **26** there, which is the exact board the census row `ability|accuracyMod - the bot PRICES an evasive body` stages, and it had been asserting 0.2667 since it was written; its expectation is corrected from the measurement, not from arithmetic. **THE STAGE STEP ALSO MOVED BELOW THE MODIFIER WALK**, which is the authority's order (`runEvent('ModifyAccuracy', ...)` first): multiplications commute, so the old position was harmless while nothing truncated, and the moment a truncation exists the order decides where the fraction is discarded. `>>> 0` is the authority's own `Dex#trunc` (`sim/dex.ts:391`). **PREDICTED AS A LAB-ONLY MOVE BEFORE THE RUN, WITH THE ARITHMETIC STATED FIRST:** the pinned pool holds 47 sheet entries carrying an evasion-stage mover across 26,428 team sheets, 40 of 13,214 games have one on either side, and only 2 of 13,214 pair one against an accuracy-stage mover - so a 961-game sample expects ~0.15 games in which both stages could be non-zero on one check. **TWELVE PREDICTIONS WRITTEN TO DISK BEFORE ANY RUN, ELEVEN HELD:** census 818 -> 819 live / 819 probed / 0 missing / 0 hollow / 0 threw; the whole-game differential on release `52e0e7effbd6` unmoved at 82 board-parted of 961, 172 protocol-diverged, 150 distinct causes with zero added and zero removed, end-state 905/53/2/0/1, with the class table, the 60-entry first-divergence list, the coverage block and the end-state summary all byte-equal to the baseline under identical pins. The one miss is named: the deliberate-break knob was predicted to move one census row and moves two, the second being the row whose typed expectation this fix corrected. Full account: `docs/_reports/2026-08-31-accuracy-stage-combine.md`.

**5.236.0 - THE KING'S ROCK FLINCH DIE IS TAKEN ONCE PER LANDED ARRIVAL, AND THIS ENGINE TOOK ONE PER CLICK.** The item runs no hit-time handler: `onModifyMove` pushes `{chance: 10, volatileStatus: 'flinch'}` onto `move.secondaries` (`data/items.ts:3219`), so the draw happens in `BattleActions#secondaries` (`sim/battle-actions.ts:1343`) - step 5 of the Champions `spreadMoveHit` (`data/mods/champions/scripts.ts:388`), called once per hit by `hitStepMoveHitLoop` (`:518`) under a guard that refuses to open an arrival against a body already at zero (`:464`). **The realised flinch rate is therefore `1 - (1 - p)^n`: 19% over two arrivals and 41% over five, against the flat 10% this engine applied to every volley.** THE AUTHORITY WAS INSTRUMENTED RATHER THAN INFERRED: `BattleActions.prototype.secondaries` was wrapped and the King's-Rock-shaped entry counted per living target per call, giving 2 dice on a `multihit: 2` Dual Wingbeat, 3 on a three-arrival Icicle Spear, 1 on a single-hit move, 1 on a volley that kills on arrival 1 of 2, and 0 on each of three over-fire controls. **NOTHING IN THE REPOSITORY COULD HAVE SEEN THIS.** WIRE 103's validation rests on 2,000 staged turns measuring `pFlinch x accuracy`, every one of them a single-hit click, so "one die per click" and "one die per landed arrival" were the same observation; and the standing once-per-move wrap of the step list could not expose it either, because all 14 legal `multiHit` moves in this format carry `secondaries: null` - King's Rock is the only road by which the authority's per-hit secondary loop is observable here. **THE POPULATION IS REAL ON PAPER AND RARE IN THE SAMPLE, AND BOTH WERE STATED BEFORE THE RUN:** 82 of 211 King's Rock sheet entries in the store carry a multi-arrival move, while only 36 of 7,772 distinct pinned-pool teams do (0.46%), so the lab was predicted to move and the pool to sit still. **ELEVEN PREDICTIONS WRITTEN TO DISK BEFORE ANY RUN, ELEVEN HELD AT THE POINT ESTIMATE:** census 817 -> 818 live / 818 probed / 0 missing / 0 hollow / 0 threw; whole-game differential on release `b43a2fea0cb1` unmoved at 82 board-parted of 961, 172 protocol-diverged, 150 distinct causes with zero added and zero removed, end-state 905/53/2/0/1, and a `by_cause` list byte-equal both ways under identical pins (961 games, cap 12, arm `middle`, steering `empirical-click/v1`, census pin `9446a684709d`, pool `0d103fb9fa87`). **THE FIX SHARES A NUMBER RATHER THAN DERIVING A SECOND ONE:** `R.arrivals` is set in `_stepApply` where the packet loop counts it, and `-hitcount`, `timesAttacked` and the King's Rock die are now three readers of it. **DECLARED REMAINDER:** the authority takes a die on the arrival that KILLS and this engine takes none, because its step list is wrapped once per move; it cannot part a board, since the authority's own `addVolatile` refuses a body at zero (`sim/pokemon.ts:1980`), and `MEDSEEN.kingsRockRollSkippedOnKO` counts how many were skipped. Full account: `docs/_reports/2026-08-31-kingsrock-volley.md`.

**5.235.0 - THE NEXT-REGULATION COLLECTOR DERIVES ITS TARGET FORMAT AT RUN TIME, AND THE EXISTING ROTATION TRIGGER WAS DEAD BY CONSTRUCTION.** A regulation rotation is announced for approximately 2026-09-09. Showdown's public replay pool is a rolling window - the ingest workflow's own measurement is ~1,250 replays per format, filling in ~18 h at peak on the bo1 ladder - so replays that age out between pulls are unreachable by any later pull, and the opening days of a metagame are not recoverable. **No format id is written anywhere in the new code.** `engine/next_regulation.js` reads three authorities on every run: `play.pokemonshowdown.com/data/formats.js` (342 entries, evaluated in a `vm` context holding only an empty `exports`) is the ARRIVAL signal, because a replay exists the moment the server accepts a battle; the pinned local checkout via `Dex.formats.all()` (333 entries) is the SIMULATION signal and lags by construction; and `replay.pokemonshowdown.com/search.json` is traffic corroboration only - measured 2026-08-31, its `page` parameter is IGNORED and pages 1 and 2 return byte-identical payloads, so that arm is the 51 most recent replays site-wide. Recognition is by SHAPE, `gen<N>championsvgc<YYYY>reg<token>[bo3]`, corroborated by `mod` matching `/^champions/` and `gameType === 'doubles'` where an authority carries those fields. **A set difference against `data/regulations.json` is the wrong test and would have collected a superseded metagame:** Reg M-A is live on the server and absent from the config, so a plain not-in-config rule reports two new regulations today. The regulation token is part of the id, so the ordering is derived - `(gen, year, token)` against the active regulation's triple, strictly greater is a CANDIDATE - and every unknown format is printed WITH its classification either way, so a wrong ordering is visible rather than silent. **Three outcomes, one of them an error:** `candidates == 0` is the expected state until the format ships and is stated in words at exit 0; `vgc_regulation_formats_detected == 0` is an `::error::`, since no moment has existed with no Champions VGC format and a zero there is the detector failing; and `collectable_not_simulatable` is its own counter, because a format on the live server and not in the pinned checkout can be collected and cannot be played. **`build/triggers.js`'s `formatTrigger` COULD NOT HAVE FIRED ON ANY ROTATION.** `engine/durable-ingest.js`'s `extract()` returned the literal `'champions-regmb'` for any tier containing "champions", and `formatTrigger` detects a rotation by tallying that field and comparing the store's modal format against a 2,000-game recent window; with one constant on both sides the two can never diverge. Measured: 51 Reg M-A replays stored under the Reg M-B label. The regulation is now read from the `|tier|` line. **Reg M-B is byte-identical to what the constant produced** - asserted by re-extracting 400 ladder and 400 bo3 raw logs, 800/800 unchanged - because relabelling the active regulation would make every new row differ from every stored row and fire the alarm on a rotation that had not occurred, which `triggers.js`'s own comment identifies as worse than no alarm. **Rehearsed against a format that does exist** (`gen9championsvgc2026regmabo3`, live and unknown to the config): 51 games appended, 51 carrying `|showteam|`, `.gz` verified to decompress to the same 51 rows; reconcile exercised at `51 -> 51`, `0 -> 51` (fresh checkout, `.gz` only) and `10 -> 51` (torn plain store, union wins). `tests/test-next-regulation.js` carries 19 checks and was shown RED first: reverting the format tag to its constant and forcing the ordering comparison false turns 5 red, and restoring makes them green. **INSTRUMENT AND COLLECTOR ONLY - NO GAME MOVED.** Nothing added or edited is in the frozen `SOURCES` set, so every release id is unchanged. **No census figure is quoted in this entry:** `engine/medicham2-browser.js` was rewritten by another process 17 minutes into the session and `data/mechanics-census.json` regenerated 11 minutes into it, so the numbers on disk belong to that pass. `node engine/status.js --write` was deliberately not run for the same reason. Full account: `docs/_reports/2026-08-31-next-regulation-ingest.md`.

**5.234.0 - THE DIVERGENCE ANNOTATOR RESOLVED THE FIRST DEX HIT, SO THREE LIVE CAUSES WORE `cannot_occur_in_format: true` AND TWO OF THEM PART A BOARD.** `engine/game_differential.js` annotates every divergence cause with the format standing of every entity the two protocol lines name, and publishes `cannot_occur_in_format` as `mentions.every(m => m.reachable === false)`. That is a TRIAGE flag - a row wearing it is closed without being read - and it is the failure direction that NEVER GOES RED, because a wrong "impossible" removes work from the queue rather than adding a failure to it. **THREE GUISES OF ONE FAULT, AND THE MEMBERSHIP OF EACH IS DERIVED FROM THE FORMAT RATHER THAN LISTED.** (i) A VOLATILE NAMED AFTER A `Past` MOVE. The existing rule asked the 35-entry standalone table `Dex.data.Conditions`; the Heal Block volatile is not in it, because it lives inside the move it is named after and is applied by Psychic Noise (`isNonstandard: null`, `secondary: { chance: 100, volatileStatus: 'healblock' }`) while the MOVE Heal Block is `Past`. The set is now computed - a name is a condition IN PLAY when something legal in this format can set it, read from declared `volatileStatus`/`sideCondition`/`slotCondition`/`pseudoWeather`/`weather`/`terrain`/`status` fields (including inside `self`, `secondary`, `secondaries` and an entity's own `condition` block) AND from `addVolatile(...)`-shaped literals inside those entities' handler sources. Over 964 legal moves/abilities/items: **96 names, of which exactly THREE collide with a move this format does not contain - `confusion` (Past), `hail` (Past), `healblock` (Past) - and the first two were already covered by the standalone table.** It is deliberately "settable by something legal" and NOT "is a condition at all": `octolock`, `telekinesis` and `iceball` have no legal setter here, genuinely cannot occur, and are the probe's negative control - widening to every condition name in the dex would silence correctly-labelled rows, which is the same fault pointed the other way. (ii) A LEGAL ITEM UNDER A `Past` MOVE'S NAME. `STANDING_KINDS` is `[moves, abilities, items]` and the loop returned the first hit; derived across the format, **1 item collides (`metronome`) and 0 abilities.** The resolver now collects a candidate per kind and prefers a REACHABLE one, which is the honest reading of "nothing this token can denote is reachable", and falls back to the first hit when nothing is reachable so a correctly-impossible token is unchanged. (iii) A LEGAL FORME UNDER AN OUT-OF-FORMAT BASE SPELLING, **and this is the expensive one.** Two rows read `|-damage|p1a:floette|74/149` against `92/149`; the rosters hold `floettemega` and `floetteeternal`, both in this format, while `dex.species.get('floette')` is `isNonstandard: 'Past'` AND `tier: 'Illegal'`. **Both rows are `board_parted: 1`, `DIFFERENT-END-STATE`.** Derived across the whole regulation, **exactly ONE illegal base species carries a legal forme**; `legal` still reports the base spelling honestly and only `reachable` is corrected, with the formes riding along as `via`. **SHOWN RED WITH A KNOB, NOT A TEMPORAL BEFORE/AFTER.** `EK.makeStanding({ resolution: 'first-hit' })` reproduces the old resolver exactly and `PROBE_ENTITY_KIND_ARM=first-hit node tests/probe_entity_kind.js` reports **6 failures, exit 1**; every claim is asserted against both arms, and the two names expected NOT to move across the knob say so as a stated control rather than banking an unearned pass. The second receipt is the artifact's own labels: re-annotating all 112 annotated causes of `data/verification/game-differential.enginedata.json` gives **3 relabelled REACHABLE, 0 still impossible, 0 newly impossible**, confirmed end to end through the SHIPPED `annotateCause` (was 3 -> now 0, `species_forme_rescues: 2`, `rescued_from_an_illegal_move: 11` = confusion x10 + healblock x1, printed and reconciled). `entityStanding` and `annotateCause` moved to `engine/effect_kind.js` and the differential calls them, because loading the differential costs 26 seconds and rebuilds a team-pool cache and a rule exercisable only that way is a rule nobody tests. **INSTRUMENT ONLY - NO GAME MOVED.** Neither file is in the frozen 26-file `SOURCES` set and `engine_release.js` reports the tree as `862624c9826e` before and after, so board-parted **82**, protocol **172**, distinct causes **150** and census **815/815/0** are unchanged by construction; no differential was re-run and the census was deliberately NOT regenerated, `tests/test-mechanics.js` having no dependency on the annotator. **THE STATED LIMIT:** a volatile applied through a COMPUTED name is invisible to the derivation; none exists in this format's legal set today, and the guard does not close that arm. **OWED:** the differential was not re-run, so the artifact on disk still carries the old three `true`s; the three rescued mechanics are open work and none was fixed; ROADMAP #321's declared-gap hole is FILED, NOT LANDED, because `DECLARED_NOT_EMITTED` is keyed by EVENT NAME and declaring that row would silence every `-end` divergence. Prediction written to disk first: **six figures, six hits at the point estimate.** Full account: `docs/_reports/2026-08-31-annotator-entity-kind.md`.

**5.233.0 - TEN ROWS OF `data/engine-data.js` CARRIED NO `wt` FIELD AT ALL, AND THE ARTIFACT IS REGENERATED.** `mons` is assembled from THREE sources - the `Object.entries(M.MONS)` walk of CHOMP's model, `data/mc-declared-rows.json` appended verbatim, and any row only the previous artifact holds - and only the first ran the weight derivation, so `victreebel-mega`, `feraligatr-mega`, `skarmory-mega`, `barbaracle-mega`, `falinks-mega`, `aegislash-blade`, the three Gourgeist sizes and `palafin-hero` had no weight. **A NULL `wt` IS NOT INERT AND IT FAILS TWO DIFFERENT WAYS**: a body that FORME-CHANGES into one keeps the stamp of the body that left the field (`weightFollowsForme` finds a row with no value and counts `MEDFAILS.weightRowNoValue`), and a body BUILT at one gets `wt: null` from `buildMon`, so `effWeight` returns null and Low Kick / Grass Knot / Heavy Slam / Heat Crash fall through to their dex `basePower` of **0** - 1 damage where the authority deals 55. **`--check` SAID THE REGENERATION WAS THREE CHANGES AND ONLY TWO SHIPPED.** The ten weights and a key reorder are real; the third, an added `floette-eternal-mega` row, is legal at the SPECIES level (`Dex.forFormat` resolves it to Floette-Mega, `isNonstandard: null`, and its stone is a real legal mega stone) and has **ZERO CARRIERS AS A KEY**, because the artifact already carries `floette-mega` for that same dex species and `megaKeyFor` (WIRE 132) asks `megaStone.into` FIRST, so the concatenated `baseKey + '-mega'` guess is never evaluated while the named row exists. Adding it took `engine/artifact_audit.js` from 2 GAPs to 3, in its own words: two representations of one body WILL diverge, and the emptier one wins wherever a consumer resolves by concatenation rather than through the artifact - and that consumer is `megaKeyFor`'s own fallback, whose cost WIRE 132 already measured at `ab: null`, `mv: []`. So the generator now groups rows by the species the dex resolves them to and keeps the key whose flattened form IS the dex species id, reporting rather than dropping when no key in a group is canonical; **printed before it was wired, it matches ONE group across 323 candidate rows, with 322 distinct dex species and zero rows the dex cannot resolve.** Audit **2 GAPs -> 1**, `generated_audit` **DRIFTED 2 -> 1**. **THE REORDER IS PROVABLY BEHAVIOUR-NEUTRAL AND WAS MEASURED, NOT ARGUED.** It is exactly the 15 declared rows moving to the end - 277 indices change and every one is a shift. The order-sensitive consumers were enumerated and the honest finding is that `replay_differential.js`'s `SLOW_POOL` **IS** tie-sensitive (a three-way speed-60 tie sits on its `.slice(0, 60)` boundary) and this permutation does not reach it, because the pool filters out every hyphenated key and all 15 moved rows are hyphenated. A REORDER-ONLY control artifact - the old values in the new order, no added row, no weight filled - was played through the whole census and moved **0 verdicts over 359 result rows**; the single detail that moved is a Monte-Carlo probe reading 19.7% against 19.8%, which moves the same way between two runs of identical bytes. `feature_fixture.js`'s table digest DOES move, because it is an order-dependent hash; that is a stamp and MEASURE's verdict. **PROBE, TWO DOORS, RED FIRST, WITH TWO KNOB-CLEARED CONTROLS.** `move/variablePower` stages the only DOWNWARD weight crossing in this format (Skarmory 50.5 -> 40.4 kg, BP 80 -> 60, ratio steps **-25.8%**), an upward one (Victreebel 15.5 -> 125.5 kg, BP 40 -> 100, **+142.4%**), a mega that gains 37 kg and crosses NO bracket (Falinks 62 -> 99, **+2.8% on both runs**), and the built-at ladder off one species (Gourgeist-Small/Large/Super at 9.5/14/39 kg landing on the exact **2.00x** and **3.00x** of a 20/40/60 step, against a Gourgeist that already had its weight at **1.00x**). Before the regeneration all four forme arms read the weight of the body that left and the three size arms read null. Census 814 -> **815 live / 815 probed / 0 missing**. **THE PREDICTION WAS ON DISK BEFORE THE PROBE WAS WRITTEN, AND HELD SIX OF EIGHT AT THE POINT ESTIMATE AND EIGHT OF EIGHT IN BAND**: protocol-diverged 173 -> **172**, board-parted 83 -> **82**, distinct causes 151 -> **150 with one removed and zero added**, end-state **identical at 905/53/2/0/1**, `ordering` **24** unmoved, `wt null` rows 10 -> **0**. **THE TWO THAT MOVED, MOVED FOR A REASON THE PREDICTION'S OWN ARITHMETIC HAD MISSED AND THE RUN THEN NAMED**: the single removed cause is `|-damage|p2a:falinks|37/140` against `24/140` off a `|move|p1a: Rhyperior|heatcrash|p2a: Falinks`. Falinks-Mega is a NON-crosser on the target-weight table - which is exactly why it is the probe's control - and a CROSSER on the RATIO family, 282.8/62 = 4.56 (>=4, BP 100) against 282.8/99 = 2.86 (>=2, BP 60). The prediction counted the six target-weight crossers and not the ratio family. Artifact `data/verification/game-differential.enginedata.json`, release `0e8ec5729a7b` -> `862624c9826e`, arm `middle`, census pin `9446a684709d`, pool `0d103fb9fa87` under `data/team-pool-frozen`, cap 12, sample identity checked field by field and the run executed twice with identical counts. **Stage 3 of the pipeline was deliberately NOT run** - `engine/merge_mega_into_engine.js` reads the live stores, which OPS appended to eighteen minutes before this batch, and its re-derivation cost is measured in the builder's own header at 14 mega movesets and all 76 `mv_provenance` blocks; stage 1 carried every stage-3 field through untouched, and it is owed on a pinned store.

**5.232.0 - BUG BITE AND PLUCK STRIP THE TARGET'S BERRY AND THE ATTACKER EATS IT, AND THIS ENGINE DID ONE OF THE HANDLER'S FOUR STATEMENTS.** `bugbite.onHit` and `pluck.onHit` are the same body (`data/moves.ts:1911-1934`, `:13442-13465`; Champions overrides neither - `grep -n "bugbite\|pluck" data/mods/champions/moves.ts` returns nothing): `this.add('-enditem', target, item.name, '[from] stealeat', '[move] Bug Bite', [of] source)`, then `if (this.singleEvent('Eat', item, target.itemState, source, source, move)) { this.runEvent('EatItem', source, source, move, item); ... }`, then `if (item.onEat) source.ateBerry = true`. This engine wrote only the strip, and attributed it `[from] move: bugbite` where the authority writes `[from] stealeat` and `[move] Bug Bite` as TWO SEPARATE FIELDS above the `[of]`. **THE MEMBERSHIP WAS DERIVED AND, FOR THE FIRST TIME IN THIS RUN OF BATCHES, IT IS THE TWO MOVES THE BRIEF NAMED**: over the 500 legal moves, NINE call `takeItem` and exactly TWO make the ATTACKER eat what they took. Corrosive Gas, Covet, Knock Off, Switcheroo, Thief and Trick call `takeItem` and no `singleEvent('Eat')`; Fling calls `singleEvent('Eat')` and no `takeItem`, and its eater is the FOE; Stuff Cheeks calls `eatItem(true)` on itself. **`singleEvent` RETURNS TRUE FOR EVERY LEGAL BERRY, so the inner `if` is a straight line here and this nearly went in as a branch** - `Battle#singleEvent` (`sim/battle.ts:623-651`) returns `relayVar` when the callback is `undefined`, and all 28 legal berries carry an `onEat` FUNCTION whose 18 resist-family bodies are EMPTY (`onEat() { }`, `data/items.ts` `chopleberry:1050`). **The road is deliberately NOT routed through `consumeBerry`, exactly as Fling's is not**: the authority writes no `lastItem`, no `usedItemThisTurn` and no `AfterUseItem` on the thief, and HYDRAPPLE LEARNS BOTH BUG BITE AND RECYCLE, so that difference is reachable and is a probe arm. **ROADMAP #529 IS STILL LIVE AND ITS BLOCKER IS TIGHTER**: `takesTargetItem.consumesAndGainsEffect` is the direct statement and the deriver tests `/eatItem|singleEvent\('Eat'/` - single quotes only - against a compiled body that writes `singleEvent("Eat"`; the fix is still exactly two rows and still behaviour-neutral, and FOUR OPS ingest commits have landed since `data/tags.json` was generated (the last twenty-five minutes before this batch), so a regeneration today rides four ingests' worth of usage churn. **The consumer was therefore written against the tag that IS correct** (`removesItem.requiresItemClass === ['isBerry'] && !steals`) with `MEDFAILS.stealEatViaClassGuard` counted out loud, and the equivalence MEASURED through `engine/tags.js`'s `__setDB` staged-tag seam: with the two rows corrected in memory, all eight `takeItem` moves gave byte-identical boards and the counter read 2 on-disk against 0 staged. **ONE FIX OR TWO - TWO, SETTLED TWICE.** A 2x2 over `MEDI_STEALEAT_STRIP_ONLY` x `MEDI_EATEVENT_UPDATE_ONLY` (the prerequisite that landed hours earlier and also touches berries) has each knob moving its OWN staged board under BOTH settings of the other and leaving the other's board BYTE-IDENTICAL under both; and the second owed item, Ripen's second resist-berry halve, is separate and NOT landable - Ice Beam into an Appletun holding a Yache reads 188 bare, 94 with the berry and 94 under Ripen where the authority requires ~47, with `MEDFAILS.damageReduceUnknown` naming `ripen/null`, because none of Ripen's three tag rows states `abilityState.berryWeaken`. The two mechanics cannot interact at all here: `getMovePool` over all TEN legal carriers of the format's three `on*EatItem` abilities returns neither move, against 38 legal Bug Bite learners and 9 Pluck learners. **PROBE, SEVEN ARMS, RED FIRST**, with five over-fire controls that are character-identical before, after and under the knob: Knock Off into the same Sitrus, a STICKY HOLD Sitrus that must NOT be eaten, an empty hand, a Life Orb, and the thief's `lastItem` staying empty. Census 813 -> **814 live / 814 probed / 0 missing**. **THE PREDICTION WAS WRITTEN TO DISK BEFORE THE RUN AND PREDICTED BOTH SCOREBOARDS WOULD MOVE - THE FIRST POOL MOVEMENT IN SIX BATCHES**: protocol-diverged 175 -> **173**, board-parted 84 -> **83**, distinct causes 153 -> **151**, the `-enditem field 4` class 3 -> **gone**, `ordering` **24** unmoved, end-state 903/55/2/0/1 -> **905/53/2/0/1**. Five of seven at the point estimate, seven of seven in band. Every movement is attributed by name: three causes removed, all three the `stealeat` line; one added, and it is the third game running FURTHER to an unrelated damage value. Artifact `data/verification/game-differential.stolenberry.json`, release `0e8ec5729a7b`, arm `middle`, census pin `9446a684709d`, pool `0d103fb9fa87` under `data/team-pool-frozen`, cap 12, `arms_comparable` COMPARABLE.

**5.231.0 - `Pokemon#eatItem` IS ONE STRAIGHT LINE AND THREE OF THIS ENGINE'S SEVEN BERRY-EATING ROADS NEVER RAN IT, SO `runEvent('EatItem')` WAS RAISED ON FOUR OF SEVEN.** Champions overrides nothing here - a walk of `data/mods/champions/` for `eatItem(` returns no hits - so `sim/pokemon.ts:1785-1811` is inherited whole: `runEvent('TryEatItem')`, `-enditem [eat]` (`:1789`), `singleEvent('Eat')` (`:1791`, the berry), `runEvent('EatItem')` (`:1792`, Cheek Pouch / Cud Chew / Ripen), `lastItem` / `item=''` / `usedItemThisTurn` / `ateBerry` (`:1806-1808`), `runEvent('AfterUseItem')` (`:1809`, Symbiosis). **The membership was DERIVED at TEN roads rather than the three that were reported**, and three of the ten are refused rather than fixed. FIXED: the type-resist berry (`chopleberry.onSourceModifyDamage` is `if (target.eatItem()) { this.add('-enditem', target, this.effect, '[weaken]'); return this.chainModify(0.5); }`, so the whole of `eatItem` precedes the `[weaken]`), the confusion berry (`persimberry.onUpdate` calls `eatItem()`, which this engine split out as `itemCuresVolatile`), and a berry FLUNG at a body (`fling.onPrepareHit` replaces `move.onHit` with `singleEvent('Eat')` then `runEvent('EatItem', foe, source, move, item)`). REFUSED WITH A DERIVATION, not with taste: Cud Chew's residual re-eat raises the event and is a **no-op in this format** - filtered `exists && !isNonstandard && tier !== 'Illegal'`, exactly three legal entities carry any `on*EatItem` hook (`cheekpouch`, `cudchew`, `ripen`, all plain `onEatItem` on the eater; no item and no move), so the only handler it can reach is its own, which re-arms and is deleted two lines below; Bug Bite and Pluck raise it on the ATTACKER and `D.species.getMovePool` over all ten legal carriers of those three abilities returns **neither move**; and Fling's thrower-side `singleEvent('EatItem')` fires only `if (source.hasAbility('cudchew'))` and no Cud Chew carrier learns Fling. **One missing call was five mechanics**: on the resist-berry road Cheek Pouch healed nothing, Harvest had no `lastItem` to give back, Belch stayed illegal, Pickup saw no spend and the partner's Symbiosis never answered - which is why the two `eatItem()` roads route through `consumeBerry` whole while the Fling road deliberately does not (the authority puts only `ateBerry` on the foe). **STAGED, ELEVEN ARMS, RED FIRST, WITH ALL THREE TEST ROADS READING EXACTLY THEIR OWN NO-ABILITY CONTROL**: resist `BWD` against `BWD`, confusion `BE` against `BE`, fling `DI` against `DI`; after, `BPWD` 725 against 328, `BEP` 873 against 476, `DIP` 1164 against 767, each exactly `control + maxhp/3`, with an arithmetic control asserting the empty hand takes exactly double (296 against 148) so the halve did not move. **The two OVER-FIRE controls are the point** - the pinch `onUpdate` road must still read `BIP` and the status road `BSP`, each firing the ability exactly once, and both are character-identical before, after and under the knob. Census 812 -> **813 live / 813 probed / 0 missing**. **The pinned empirical pool is BYTE-IDENTICAL: 153 causes before and after, zero added, zero removed, zero moved, protocol 175, board-parted 84, `ordering` 24, end-state 903 / 55 / 2 / 0 / 1** - all five written to disk at their point estimate before the run, with the carrier arithmetic that predicted them (`cheekpouch` is 10 of 13,214 pool games, `ripen` 2, `cheekpouch` beside a confusion berry ZERO). That is not an unwired knob: `[weaken]` is written four times inside the diverging subset alone, so the road RUNS in the pool and the CONSUMER is absent. Artifact `data/verification/game-differential.eatevent.json`, release `f933a01b792a`, arm `middle`, census pin `9446a684709d`, pool `data/team-pool-frozen`, cap 12, `arms_comparable` COMPARABLE. **Ripen's second halve is NOT wired and is this batch's own consequence**: `damageReduce.onlyWhen` is `null` and the reader correctly refuses, while the authority's condition is `abilityState.berryWeaken` written from `onEatItem` - now derivable for the first time, and filed as its own batch rather than smuggled in.

**5.230.0 - THE BUSTED-DISGUISE REVEAL IS WRITTEN AT `eachEvent('Update')` BELOW THE MOVE, AND AN `onEatItem` ABILITY RUNS BELOW THE BERRY'S OWN EFFECT; THIS ENGINE RAN BOTH ONE POSITION TOO EARLY.** `data/mods/champions/abilities.ts:14` declares `disguise: { inherit: true, onEffectiveness(...) }` - it replaces that handler and nothing else, checked first - so `onDamage` (`data/abilities.ts:962-967`, which writes the `-activate`, sets `busted` and RETURNS 0) and `onUpdate` (`:991-997`, the `formeChange` plus `this.damage(baseMaxhp/8, ..., species)`) are the mainline bodies. `onDamage` fires inside `spreadDamage`; `onUpdate` is raised by `eachEvent('Update')` at the FOOT of the hit iteration (`data/mods/champions/scripts.ts:538`), below the whole of `spreadMoveHit` - below every other spread target's `-damage` (`:368`), below `runMoveEffects` (`:373`) and below `secondaries` (`:386`). Separately, `data/mods/champions/abilities.ts` carries no `cheekpouch` key at all, so `onEatItem(item, pokemon) { this.heal(pokemon.baseMaxhp / 3); }` (`data/abilities.ts:483-485`) is inherited whole, and `Pokemon#eatItem` is one straight line: `-enditem [eat]` (`sim/pokemon.ts:1789`), `singleEvent('Eat')` (`:1791`, the BERRY), `runEvent('EatItem')` (`:1792`, CHEEK POUCH), then the slot is cleared (`:1806-1808`) and `AfterUseItem` reaches Symbiosis (`:1809`). **They are TWO fixes**: a 2x2 over `MEDI_FORME_BUST_INLINE` and `MEDI_EATREACT_BEFORE_BERRY` in which each knob moves its own staged board and leaves the other byte-identical, on the full canonical line arrays, under both settings of the other. **G6 is NOT ROADMAP #392** (closed 2026-08-23, probed live as `a body that is ALREADY the busted forme absorbs nothing`), which asks WHO the absorb refuses rather than WHERE the reveal lands; **nor ROADMAP #505**, because `formeChange(speciesid, this.effect, true)` passes `isPermanent`, and #505's row declares a permanent forme exempt from `clearVolatile`'s closing `setSpecies(baseSpecies)`. No HP moved: the holder ends on `maxhp - maxhp/8` either way and the Cheek Pouch body on the same total either way; what moved besides the order is what the berry's own `-heal` line SAYS, asserted against a no-ability control. One state change is declared rather than folded in: the absorbed hit's `dmg` now reads 0 rather than the chip, which is `onDamage`'s own return and is why no Focus Sash, Endure or recoil may answer it. Empirical protocol **181 -> 175 of 961** and the `ordering` class **31 -> 24**, with **exactly seven causes removed - four naming the Disguise reveal, three naming Cheek Pouch - and one added, which is one of the seven diverging later on a Rising Voltage KO named in the prediction before the run**; board-parted **unmoved at 84** and end-state verdicts identical at 903 / 55 / 2 / 0 / 1. Census 810 -> 812 live / 812 probed / 0 missing. Artifact `data/verification/game-differential.formeoneat.json`, release `68c90b3b9f17`, arm `middle`, census pin `9446a684709d`, pool `data/team-pool-frozen` (`0d103fb9fa87`), cap 12, steering `empirical-click/v1`, `arms_comparable` COMPARABLE. **The prediction was written to disk at 14:16Z against a run started at 14:22Z - 175 / 84 unmoved / ordering 24 / end-state identical - and all four landed at their point estimate.** A method note recorded because it cost two runs: `--out` does not imply `--write`, and a run without `--end-state` reports a different `diverged` count, so two arms differing in that flag are not comparable.

**5.229.0 - `DamagingHit` IS RAISED PER HIT AND THE RESIST BERRY IS SPENT DURING THE DAMAGE CALCULATION; THIS ENGINE BATCHED THE FIRST BELOW THE WHOLE VOLLEY AND DEFERRED THE SECOND TO THE MOMENT THE HP MOVED.** `data/mods/champions/scripts.ts` overrides BOTH `spreadMoveHit` (`:315`) and `hitStepMoveHitLoop` (`:428`) and leaves both positions verbatim - checked first, the Encore batch having turned entirely on an override. `runEvent('DamagingHit', damagedTargets, ...)` is at `:409`, INSIDE `spreadMoveHit`, which `:518` calls once per hit, so a two-hit volley writes `damage, toll, damage, toll`; `engine/medicham2-browser.js` wrote `damage, damage, toll, toll`. Separately, `ModifyDamage` is raised at `sim/battle-actions.ts:1825` inside `getDamage` - BELOW the `-supereffective`/`-resisted` line (`:1800`/`:1807`) and BELOW `-crit` (`:1814`) - and the resist berry is an `onSourceModifyDamage` calling `target.eatItem()` (`data/items.ts:1038-1049`; `data/mods/champions/items.ts` carries no berry at all). Since `getSpreadDamage` runs for every target (`scripts.ts:361`) before `spreadDamage` moves any HP (`:368`), every target's berry is announced before any target's `-damage`; this engine's step-outer/row-inner driver put it between them. **They are TWO fixes and the shared-cause hypothesis is REFUTED rather than unconfirmed**: a 2x2 over `MEDI_REACT_BATCHED` and `MEDI_BERRY_AT_APPLY` in which each knob moves its own staged board and leaves the other byte-identical under both settings of the other, and the berry defect is visible on a SINGLE-HIT spread click where there is no packet loop at all. No damage number moved - `dmgRange` already applied the halve as a pure read, and the probe's empty-hand arms assert the holder took exactly half. Empirical protocol **191 -> 181 of 961** and the `ordering` class **43 -> 31**, with **exactly twelve causes removed, six naming a resist berry and six naming a damage reaction**, and two added that are the same games diverging later; board-parted **unmoved at 84** and end-state verdicts identical at 903 / 55 / 2 / 0 / 1. Census 808 -> 810 live / 810 probed / 0 missing. Artifact `data/verification/game-differential.packettiming.json`, release `a18431d6dbe2`, arm `middle`, census pin `9446a684709d`, pool `data/team-pool-frozen`, cap 12, steering `empirical-click/v1`, `arms_comparable` COMPARABLE. **The prediction, stated before the run, was 183 (band 179-189) / 84 unmoved / ordering 31 / end-state identical: three exact and one inside the band in the improving direction.** `tests/test-resolution-order.js`'s A1 arm, which had declared this interleaving unreachable without converting the hit loop, is promoted from KNOWN-OPEN to RED PROVEN.

**5.228.0 - THE BURN CHIP IS RESIDUAL ORDER 10 AND RAN AT ORDER 9, AND PERISH SONG HAD NO RESIDUAL STEP AT ALL.** `data/conditions.ts` declares `brn.onResidualOrder: 10` (`:15`) against `psn` (`:133`) and `tox` (`:154`) at 9, and `data/moves.ts:13270` declares `perishsong.condition.onResidualOrder: 24`; `data/mods/champions/conditions.ts` carries exactly `par`, `slp` and `frz` and its `moves.ts` carries no `perishsong`, so mainline is the authority for all four and that was checked first. `Battle#comparePriority` (`sim/battle.ts:404`) sorts order ASC, priority DESC, speed DESC over ONE handler list built and `speedSort`ed BEFORE the walk (`:507`), so every body's poison chips before any body's burn; `engine/medicham2-browser.js` ran all three chips in one speed-sorted pass. Perish Song's tick stood below the whole walk, so `expiry:tailwind` at order 26 - spent inside the walk - announced above every `perishN`, and the counters were read off speeds the order-28 Speed Boost group had already moved. Neither fix wrote a byte of data: `data/residual-order.json` has published 9 / 9 / 10 / 24.2 / 26.5 since it was generated, and the whole of both changes is the step mapping in `RESIDUAL_GROUPS`. **They are TWO fixes and that was measured**: a 2x2 over the two revert knobs, one staged board per defect, in which each knob moves its own board and leaves the other byte-identical. The perish DEATH did not move - `onEnd` calls `Pokemon#faint()`, which writes no line, and the duration-expiry branch `continue`s past the `faintMessages()` at `:565`, so the step calls `queueFaint` exactly as the foot loop did and `residualFollowerRuns` still decides above-or-below `|upkeep|`. Empirical protocol **199 -> 191 of 961** and the `ordering` class **53 -> 43**, exactly the ten dumped games, with perish-vs-`-sideend` rows 5 -> 0 and psn-vs-brn rows 5 -> 0; board-parted **unmoved at 84** and end-state verdicts identical at 903 / 55 / 2 / 0 / 1. Census 806 -> 808 live / 808 probed / 0 missing. Artifact `data/verification/game-differential.residualorder.json`, release `b45e6b257029`, arm `middle`, census pin `9446a684709d`, pool `data/team-pool-frozen`, cap 12, steering `empirical-click/v1`. **The prediction, stated before the run, was 191 / 84 / unmoved and it HELD at its point estimate.** **The closeted ROADMAP #440 perish-drain row still holds** on falsifiers (a), (c) and (d); (b) rests on the coverage arm, which was not re-run and is named in OWED.

**5.227.0 - THE ON-KO BOOST RAN AFTER A BATTLE THE AUTHORITY HAD ALREADY ENDED, AND IT PAID ONCE PER CORPSE WHERE THE AUTHORITY PAYS ONCE PER DRAIN.** `sim/battle.ts:2532` `faintMessages()` holds three statements below its drain loop, and `engine/medicham2-browser.js` disagreed with all three. `runEvent('AfterFaint', ..., length)` at `:2596` is raised BELOW the whole `while`, ONCE, with `length` = the faint-queue depth at entry (`:2534`); and `checkWin` at `:2592` RETURNS above it, so a drain that empties a side ends the battle and the event never runs. `moxie` is `this.boost({atk: length}, source)` and `eelevate` the same expression on `getBestStat`, both read off `Dex.forFormat('gen9championsvgc2026regmb')`; `data/mods/champions/scripts.ts` overrides neither function, which was checked before mainline was treated as the authority. The payment moved into a once-per-move `_stepAfterFaint` between `_stepDrainFaints` and `_stepHitCount` - the authority's own order (`battle-actions.ts:976` against `:978`) - gated on `sideWiped(S)`, the engine's OWN `checkWin`. The reachable population is derived rather than named: of twelve legal abilities carrying a faint hook, eight are on `AfterFaint` and only Moxie (7 carriers) and Eelevate (Eelektross-Mega) have any, so **nine bodies across two abilities**. Empirical board-parted **88 -> 84 of 961** and protocol **204 -> 199**, with **five causes removed and none added, every one naming an on-KO `atk` boost**, and the only board-leaf families that moved being `party.boosts.atk` 9 -> 5 games and `active[].boosts.atk` 9 -> 5. DIFFERENT-WINNER reads 0 before and after. Census 804 -> 806 live / 806 probed / 0 missing. Artifact `data/verification/game-differential.afterfaint.json`, release `26787be1b8b4`, arm `middle`, census pin `9446a684709d`, pool `0d103fb9fa87`, cap 12. **The prediction, stated before the run, was "unmoved at 88" and it MISSED by 4 in the improving direction** - it assumed the two payment shapes always leave the same stage, which holds only while the battle continues. **ROADMAP #362 is NOT this site and its row is stale**: the winner defect it describes was closed by WIRE 160 on 2026-08-23.

**5.226.0 - A KILLING VOLLEY SET EVERY `onDamagingHit` REACTOR OFF ONCE PER ARRIVAL IT DREW, AND THE AUTHORITY COUNTS THE ONES THAT LANDED.** `data/mods/champions/scripts.ts:461-464` - the Champions override of `hitStepMoveHitLoop`, not mainline - opens each arrival behind `if (targets.every(target => !target?.hp)) break`, and writes `-hitcount` as `hit - 1` at `:550`. `runEvent('DamagingHit')` is raised inside `spreadMoveHit`, so a reactor fires once per LANDED arrival. `_stepApply`'s packet loop already broke on `tg.curHP<=0` and already counted what landed into `R.hitLanded`; `_react` was a second reading of that same quantity taken from the drawn count, so this engine printed `|-hitcount|1` beside two Rough Skin tolls off one click. Measured on both engines, one staged board: the authority reads `hit, TOLL, faint, -hitcount 1` and this engine read `hit, TOLL, TOLL, faint, -hitcount 1`; the survivor control on the turn before reads two tolls and `-hitcount 2` on both. Empirical board-parted **90 -> 88 of 961**, protocol **205 -> 204** - predicted at its point estimate before the run. Census 803 -> 804 live / 804 probed / 0 missing. Artifact `data/verification/game-differential.volleyreact.json`, release `12dae69813f6`, arm `middle`, census pin `9446a684709d`, pool `0d103fb9fa87`, cap 12. **And the D-family of `docs/_reports/2026-08-29-empirical-divergence-cards.md` is re-cut**: D2 is four distinct causes, D4 is REFUTED (both engines fire Stamina twice on Twin Beam - the position differs, not the frequency), and D3 is its own site at `sim/battle.ts:2592` returning above `runEvent('AfterFaint')` at `:2596`. Only the board-material half was landed.

**5.225.0 - A FORCED SWITCH IS ADDRESSED TO THE BODY THE AIM RESOLVED, AND BOTH DOORS READ THE MOVER'S FOE ARRAY.** `Battle#validTargetLoc` asks only adjacency for a `normal` move (`case 'randomNormal': case 'scripted': case 'normal': return isAdjacent;`), so a player may aim Roar, Whirlwind, Dragon Tail or Circle Throw at their own partner, and `BattleActions#forceSwitch` (`sim/battle-actions.ts:1353`, reached from `:1104` and `:1260`) runs over the resolved targets with no side test in it. `reaimToSlot` has returned an ally correctly since ROADMAP #223; both `forcesSwitch` sites then computed that body's party, bench and side-field as the mover's far side, scored `indexOf(...) === -1`, and the status door failed the move while the damaging door dealt its damage and skipped the drag in silence. Fixed through one shared reader. **All twenty-two far-side sites filed by `docs/_reports/2026-08-29-armor-tail-ally.md` §3.2 are now classified with the authority line that decides each: seven SIDE, fifteen TARGET, seventeen correct, five wrong** - two fixed here, three filed as separate batches (the redirect gate, the delayed-hit booking, and `defog.onHit`'s `target.side`). Measured on the pinned empirical pool: board-parted **unmoved at 90 of 961**, protocol unmoved at 205, end-state 898/60/2/1 identical, 184 causes identical - **predicted before the run** from the fact that `chooseAction` and `empiricalPick` both write `target = j + 1` over the foes, corroborated by the run's own AIM counter (`31216 at a foe, 467 at an ally`, all 467 `adjacentAlly`). Census 801 -> 803 live / 803 probed / 0 missing. Artifact `data/verification/game-differential.sidetarget.json`, release `070890fc77a2`.

**5.224.0 - INSTRUCT REBUILDS THE SECOND ACTION AT A SLOT, NOT AT A BODY.** The authority queues the repeat with `targetLoc: target.lastMoveTargetLoc` (`data/moves.ts:9670`), a signed relative slot written by `Pokemon#moveUsed(move, targetLoc)` at the same instant as `lastMove` and taken from `action.targetLoc` rather than from the body the move resolved onto. This engine discarded it and re-ran `targetForMove`, a best-damage heuristic; and because that function opens `if (!mv || !hasPower(mv)) return null`, a single-target STATUS repeat fell to `live(foes)[0]` and was pinned to foe slot 0 for **73 of the 355 legal single-target moves**. The aim is now recorded beside `_lastMove`, keyed by the move id, and resolved through `reaimToSlot` — this engine’s existing reading of `Battle#getTarget`, whose fourteenth caller it becomes. The read is gated on `targetClass.target` because `resolveAction` fills a `targetLoc` for every move and `getMoveTargets` ignores it for the spread and field classes: **360 of 500 legal moves spend the loc, 140 do not**. Measured on the pinned empirical pool against an identically-pinned baseline: board-parted **91 -> 90 of 961**, protocol unmoved at 205, throws 2 -> 1, one divergence cause removed and none added; the same run under the revert knob on the SAME release reproduces the baseline exactly, so the delta is knob-attributed. The census is unmoved at 801 / 801 / 0, as predicted; the pool prediction was "unmoved" and MISSED by one. Artifacts `data/verification/game-differential.instructaim534.json` and `...instructaim534-knob.json`.

**5.223.0 - A MOVE THAT MAKES ANOTHER BODY ACT IS STILL A MOVE, AND A SHIELD REFUSES IT.** Instruct carries `flags.protect` and `category: "Status"`, so `checkMoveBypassesProtect` answers with its default `blockStatus`, `protect.condition.onTryHit` writes `-activate` and returns `NOT_FAIL` at `hitStepTryHitEvent` — step 2 of eight — and Instruct's `onHit`, where the second action is built, is never reached. This engine asked that question nowhere. The refusal is now the branch's first question and sits ABOVE the Good as Gold check, because `protect.condition` declares `onTryHitPriority: 3` and the ability declares none. Measured on the pinned empirical pool against an identically-pinned baseline: board-parted **92 -> 91 of 961**, protocol **207 -> 205**, one divergence cause removed and none added. The census is unmoved at 801 / 801 / 0, as predicted. Artifact `data/verification/game-differential.instructshield532.json`.

**5.222.0 - NO RESULT IN THIS PAPER MOVED, AND THE REASON IS THE POINT: FIVE CHECKS THAT HAD BEEN
REPORTED AS FAILURES OF THE SIMULATOR WERE EXAMINED, AND THREE OF THEM WERE NEVER MEASURING THE
SIMULATOR AT ALL.** Two were defects in the machinery that runs a check, and one was a defect in the
check's own expectation. This matters to a paper of measured results because a false alarm and a real
one are read the same way, and a false alarm that is carried repeatedly trains a reader to discount
the instrument that raises it.

The first was a memory ceiling. One check declares, in its own header, that it needs more working
memory than the runtime gives by default, and the project's test runner reads that declaration and
honours it. The wrapper that the project's written procedure tells everybody to use for heavy runs did
not read it, so the check was killed by the runtime before it reached any conclusion, and the
resulting non-zero status was recorded as a failed comparison of turn order. Given the memory it asks
for, the check passes: twenty-six staged comparisons, each played through both implementations and
compared line by line, each replayed a second time against a deliberately reverted copy so that a pass
is distinguishable from an implementation that never changed.

The second was an exit status that no state of the simulator could have made clean. The damage
comparison writes a published artifact through a guard that refuses to replace a large sample with a
small one. Its default sample is smaller than the published one, so every automatic run was refused,
and the guard set a non-zero status because a run that did not publish what its own output describes
must not read as a success. The guard is correct. The consequence was that the check could never pass
while being run automatically. A named output path now lets a verification run say where its artifact
goes, which is the mitigation the original defect record asked for and which had never been built.

**THE PUBLISHED DAMAGE RESIDUAL IS UNCHANGED AND WAS NOT REWRITTEN.** The comparison still reads zero
disagreements over six thousand matchups at every one of the sixteen roll positions, and the artifact
carrying it was not touched in this pass; its modification time is unchanged. One clarification is
owed to any reader who has treated that check's exit status as its verdict: it never was. The
disagreement count is published to the artifact and read by the gate; the only three conditions that
set a failing status are the three separate conformance sections that compare our accuracy table, our
accuracy-modifier table and our substitute-bypass set against the format.

**ONE REAL DEFECT WAS FOUND AND IS RECORDED RATHER THAN REPAIRED.** A move that makes another Pokemon
act again does not ask whether the target is behind a protective barrier, so it grants a second action
in a turn where the reference implementation grants none. This changes the position, not merely the
commentary. It is recorded in the defect register with a check that decides it, and deliberately left
unfixed: other work was changing the simulator in the same window, and a repair made here could not
have been attributed.

**5.221.0 - A MOVE THAT SWAPS THE USER OUT ONLY DOES SO IF THE THING IT DID ON THE WAY OUT ACTUALLY
HAPPENED, AND THE SIMULATOR SWAPPED REGARDLESS.** One move in this format lowers two of the target's
stats and then retreats. In the reference implementation the retreat is CONDITIONAL: if neither stat
actually moved - because an ability refused the drop, or because both stats were already as low as
they can go - the move's own code cancels the retreat, with a single ability named as an exception
because it sends the drop back at the attacker instead. This simulator always retreated, so it was
right about the named exception only by being wrong about the rule the exception exists for, and the
wrong Pokemon was left standing for the rest of the battle.

The population was derived from the format rather than taken from the defect report, and it is wider
than the report said: three abilities cancel the retreat, not two, the third protecting a Grass-typed
ALLY rather than its own holder; a fourth refuses only one of the two stats, so the retreat SURVIVES
it; and a fifth named in the reference code has no legal holder in this regulation at all and was
deliberately not implemented. What the reference counts as "the drop happened" is a partial change,
not a complete one, which is what makes that fourth ability a control rather than a case.

Measured over 961 recorded games at a twelve-turn cap, the count of games whose board ever parts from
the reference falls from 93 to 92 and the narration disagreements from 208 to 207. **That was
predicted as UNMOVED and it moved, so the prediction is recorded as a miss.** The one game is
attributed by which board fields stopped disagreeing - the species, typing, ability, maximum health,
held item and remaining uses of that very move, all falling by exactly one game, which is the shape of
a single board holding the wrong Pokemon in a slot. Full account:
`docs/_reports/2026-08-29-partingshot-conditional.md`.

**5.220.0 - AN ABILITY THAT MAKES A MOVE FASTER ALSO DECIDES WHETHER FIVE DIFFERENT THINGS ARE
ALLOWED TO REFUSE IT, AND THE SIMULATOR ASKED THEM ALL THE WRONG NUMBER.** The reference
implementation works out a move's speed bracket once, applies whatever the user's ability does to
it, and then writes the RESULT back onto the move - so every later rule that asks "is this a fast
move?" sees the boosted value. Five things in this format ask that question: two abilities that
refuse fast moves aimed at their own side, a one-turn shield that stops them, a move that only works
against one, and a field effect that blocks them. This simulator answered all five with the move's
printed value, while the part that decides who acts first already read the boosted one - the same
fact implemented twice, in two places, disagreeing. The visible consequence is a body surviving on
one engine and dying on the other: a Flying-type attack from a full-health user with the relevant
ability is refused by the reference and landed here. Both readings are now one function.
Measured over 961 recorded games at a twelve-turn cap, the count of games whose board state ever
parts from the reference falls from 94 to 93 and the count of narration disagreements from 211 to
208. That the pool would move, and by roughly one game, was stated before the run. A third run
differing by a single switch isolates the change: it removes exactly one disagreement and adds none.
Full account: `docs/_reports/2026-08-29-priority-modified.md`.

**5.219.0 - WHEN SOMETHING ELSE CHOOSES A POKEMON'S MOVE FOR IT, THE SIMULATOR HAD TO PICK A
TARGET, AND IT ALWAYS PICKED AN OPPONENT.** The reference implementation resolves an unchosen
target from the move's own targeting rule, and it answers the moves that address your own side -
yourself, your partner, your half of the field - before it ever considers an opponent. Ninety-one of
this format's five hundred legal moves are of that kind. This simulator had three places that pick a
target for a move nobody aimed - the move an Encore forces, and the move a copying move produces -
and all three started from the opponents. The visible consequence was an ability that refuses fast
moves aimed at its own side refusing a support move that was aimed at the user's own partner: the
refusal itself was correct, and it was reading a target field that had been filled in wrongly.
Measured over 961 recorded games at a twelve-turn cap, the count of games whose board state ever
parts from the reference is unchanged at 94 and the count of narration disagreements falls from 213
to 211 - which was predicted before the run and is reported as a prediction that held rather than as
a gain. Both cleared disagreements were already classified as narration-only, so the board count
could not have moved. Full account: `docs/_reports/2026-08-29-armor-tail-ally.md`.

**5.218.0 - THE SIMULATOR DECIDED ONCE PER TURN WHETHER A SHIELD WOULD BE TESTED, AND THREE
MECHANICS REPLACE THE MOVE A BODY IS USING AFTER THAT POINT.** The reference implementation asks a
shielding move's own gate inside the routine that uses a move - per action, at execution - so it is
always asked about the move actually being used. This simulator decided in a pre-pass at the top of the
turn, from the move the player had selected. Three mechanics substitute a different move afterwards:
this format's Encore, which rewrites a queued action in place; the repeat action Instruct inserts; and
a called move. A shield arriving by any of the three was never tested at all, so it drew no consecutive-
use roll, never advanced the counter that makes repeated shields fail, and was announced from a flag
left over from earlier in the turn - reported as a failure for a body that had no shield, and as a free
untested success for one that did. Both directions, one cause. A second correction rides with it: a
shield that IS refused no longer removes one the same body already had standing, because the reference
implementation fails the move and writes no state. One probed mechanic added (795 to 796). Over 961
real games the end-state leaf for the consecutive-use counter falls from **thirteen games to eleven**,
boards parted from **97 to 94**, and protocol divergence from 214 to 213. The remainder of that leaf
family is a different defect and is stated rather than absorbed: the counters now agree and the roll
does not, in four games, one of them in the opposite direction.

**5.217.0 - THIS FORMAT'S OWN COPY OF ENCORE MOVES THE ENCORED ACTION TO A DIFFERENT PLACE IN THE
TURN, AND THE REFERENCE IMPLEMENTATION THE SIMULATOR WAS BUILT AGAINST DOES NOT.** The format
overrides the move's condition and, when the body it lands on has not yet acted, rewrites that body's
queued action outright and re-prices its priority; the unmodified implementation leaves the swap to an
execution-time hook whose own source comments state that it does not change ordering. The simulator
implemented the unmodified rule - which is correct for the case the format leaves alone, an Encore
already standing when the turn opens - so a body Encored into a faster-bracket move resolved in the
bracket of the move its player had chosen. The bracket that finally applies is not the arithmetic the
override writes, either: the override runs inside another body's action, and the post-action re-sort
recomputes priority from the encored move through the priority-modifying event, which answers
differently for an ability that keys on move CATEGORY. One arm stages exactly that separation and the
reference answers the re-derivation. A second correction rides with it: the priority function read its
value from the selected move and its category from the action's kind - two different moves whenever
anything overrode a choice - where the reference reads both off one record on consecutive lines. One
probed mechanic added (794 to 795). Over 961 real games the turn-order instrument falls from **eleven
disagreements to two**, protocol divergence from 216 to 214, and boards parted is **unmoved at 97** -
the affected games part on causes the ordering line was concealing, two of which are newly visible and
filed.

**5.216.0 - A SIDE-WIDE STATUS SHIELD REFUSED ONLY WHAT THE OPPOSING SIDE WROTE, AND THE RULE IT
WAS IMPLEMENTING MAKES NO SUCH DISTINCTION.** The reference simulator's handler excludes the affected
body ITSELF from its own shield and nothing else; the one place it mentions sides is inside a bypass
clause, where the mention exists precisely so that the bypass does NOT apply from the near side. This
simulator carried an extra exclusion for a source standing on the same side as the target, written
into the source as a sentence as well as a branch. The consequence is that a status or a confusion
written by a partner - directly, or as one arm of a move that reaches every adjacent body - landed
where the reference refuses it and prints a refusal line. Both roads are served by a single reader, so
one deletion corrects the status handler, the volatile handler and the suppression of the redundant
failure line together. Eleven staged arms accompany the change, seven of them negative: the body is
still not shielded from its own action, the opposing side's copy of the shield still does not protect
this one, a stat reduction is still not a status, and an ally's damaging move is unchanged to the
point. Two probed mechanics added (792 to 794). The whole-game measurement over 961 real games is
unmoved at 97 boards parted, predicted before the run: the move appears in 17 of 13,214 games in the
frozen pool, and the near-side road needs a second co-occurrence on top of that.

**5.215.0 — A GUARD THAT HAS NEVER BLOCKED ANYTHING WAS SCORED AS WORKING, BECAUSE THE INSTRUMENT
READ THE ANNOUNCEMENT AND NOT THE EFFECT.** The deliberate roster credits a move when the reference
simulator's own stream shows the click producing a consequence line. For a move whose entire function
is to create a one-turn state, the creation notice IS such a line, so eight guard moves scored as
resolved on a turn in which nothing was thrown at them. The board comparator cannot supply the missing
half: every one of those states carries a declared duration of one turn and is ended in the residual
before the boundary at which the board is sampled. A second, separate question is now asked of each
row — did the state this click created ever refuse anything — with the expected protocol marker
derived from the reference simulator's own handler source rather than assumed. Over the 500 legal
moves the derivation matches eleven; seven of those now demonstrate the refusal on both engines, four
state why they cannot, and 76 further rows are recorded as writing a state whose effect emits nothing
and is therefore a counter question rather than a protocol one. No row changed verdict and no engine
defect was found. The correction to the record is that the earlier reading was an unasked question,
not a pass.

**5.214.0 — A MOVE THAT SWITCHES ITS USER OUT WAS CLASSIFIED AS A SWITCH RATHER THAN AS A MOVE, AND
THE REDIRECTION SITE REFUSED IT ON THAT BASIS.** Doubles play turns on redirection: two moves and one
ability in this format can pull a single-target click off the body it named and onto themselves. The
reference simulator applies that test at target selection, in one place, to every single-target move
regardless of category and regardless of what the move does to its user afterwards. `medicham2`
applied it everywhere except to the one status move that also switches its user out, because the
internal action label for such a move is the same label a voluntary switch carries. Membership of the
affected class was enumerated from the format before the change and is exactly two moves, one of
which the redirection rule does not reach in the reference simulator either. On identical pins — same
driver policy, same team pool, same census pin, same turn cap — the count of games whose board
diverges falls from **114 to 106 of 961**, and the mechanics census rises from **786 to 788 live
probes with none missing**. The 6,000-comparison damage differential is unchanged at zero
disagreements at every one of the sixteen roll positions. **A second card in the same review group is
NOT the same defect and is not claimed fixed**: the draw ability is `onAny`-scoped in the reference
simulator and adjacency, not side, decides whether it may take a click — so a partner's ability draws
its own side's move, which this engine's draw function is never given the operands to see. It is
reproduced under a control and filed.

**5.213.0 — A BODY'S MASS WAS A BUILD-TIME CONSTANT, AND FOUR MOVES IN THIS FORMAT
COMPUTE THEIR BASE POWER FROM IT.** Two moves read the target's mass off a bracket table and two read
the ratio of user to target; the reference simulator recomputes the field on every identity change,
in the single function all of them pass through (`Pokemon#setSpecies`, `sim/pokemon.ts:1402`, reached
by the Champions `formeChange` override). `medicham2` stamped the field once, when the body was built,
so a mega evolution left it holding the base forme's mass. The defect is a BRACKET STEP rather than a
rounding error and is separable from a damage roll on that ground alone: two rolls of one base power
can differ by at most a factor of 1.177, and the two hand-verified cases differ by 0.478 and 0.677,
each matching the predicted bracket ratio (0.500 and 0.667) to within one roll. The correction is
applied at the seven doors that change a body's species rather than at the reader, because the
per-body field is legitimately writable by a caller and one of this project's own probes writes it.
On identical pins — same driver policy, same team pool, same census pin, same turn cap
— the count of games whose board diverges falls from **117 to 114 of 961**, and the
mechanics census rises from **784 to 786 live probes with none missing**. The 6,000-comparison damage
differential is unchanged at zero disagreements at both ends of the roll.

**5.212.0 — A HARNESS STOP WAS COUNTING AS A DIVERGED BOARD, AND THE EMPIRICAL ARM'S DENOMINATOR
MOVES FROM 135 TO 117.** No engine behaviour changed and no result about the simulator is retracted;
one instrument was reading the wrong moment. `medicham2`'s turn is atomic — `battleTurn()` plays the
whole turn and returns — while the reference simulator halts the instant a pivot move resolves and
asks which body replaces the user. The differential harness answered that MID-TURN question with
`medicham2`'s END-OF-TURN occupant of the slot, so on any turn in which one slot received two bodies
(a pivot brings a replacement in, that replacement dies, and the pivoter returns) the harness named a
body the authority already had standing, was refused, and stopped the game as a parted board. It was
reproduced on one pinned game before anything was changed, both protocol streams agreeing line for
line up to the halt. The mirror now answers from the ORDERED occupancy of the slot, observed as the
turn is played and resolved through the same single identity accessor every other roster question
uses. On identical pins (release `e129bca605e3`, census pin `9446a684709d`, pool `0d103fb9fa87`, 961
games, 12-turn cap) the empirical-click arm moves from **47.8% of games reaching a result and 135
whose board diverged** to **48.4% and 117**, with harness truncations falling 42 → 27. The 27 that
remain are 19 boards that genuinely parted and 6 downstream of separately-recorded engine defects,
so the completion figure is still a lower bound and is still labelled one. Detail:
`docs/_reports/2026-08-29-forced-switch-mirror.md`.

**5.211.0 — THREE SCOPE LINES: THE DIFFERENTIAL'S SPREADS ARE SYNTHETIC, THE BOARD-LEAF CEILING
IS 56 AND NOT 80, AND A WHOLE-GAME FIGURE IS ONLY ABOUT ITS DRIVER.** No result in this document
changes; three of them are now bounded, and the bounds are derived at run time by
`engine/coverage.js`. **(i)** Every damage figure the whole-game differential produces is computed
on a spread the driver ASSIGNS from a body's slot index — 66 points, a 32 cap, a descending Speed
ladder, nothing in HP — because an open team sheet reveals no spread. The nature is the sheet's own
and both engines receive the same invented spread, so the comparison is sound and **the damage is
not metagame damage**. **(ii)** The board comparator samples only at a turn boundary, so of the 80
leaves a legal mechanic can write, 24 can never be standing when it looks; the widening ceiling is
**56**, of which 34 are compared. **(iii)** On one set of pins (release `e129bca605e3`, cap 12, pool
`0d103fb9fa87`, 961 games) the coverage-seeking driver reaches a result in 1.8% of games with 0
diverging boards and the empirical driver reaches 47.8% with 135, and `engine/arms_comparable.js`
refuses the pair on `policy` — so **"board-material zero" is a statement about games that do not
end**, not about the engine in general.

**5.210.0 — THE PORY TWO-FEATURE PAIR IS WITHDRAWN: ITS GENERATOR WRITES NO ARTIFACT.**
`engine/pory_baseline.py` prints a five-arm table and saves nothing, so the material-baseline
pair it published on 2026-07-25 never had a source to check it against, and it was scored
before that script had a clean-data filter at all. On the clean corpus the comparison is a
TIE rather than a loss, measured PAIRED and clustered by game in `data/pory-eval.json`. The
withdrawn pair stays in `docs/REVIEW-2026-07-25.md`, the review that measured it. This document does not quote the pair and is
unchanged apart from this note.

**5.209.0 — FLASH FIRE ABSORBED THE HIT AND BINNED THE GIFT, AND THE BOARD COMPARATOR IS ONE
LEAF WIDER. GATE 8 OF 8, OPEN.** The 5.208.0 block below is dated history — its counts were taken on
engine release `4e5c7b3400de` and are superseded, not rewritten. An engine byte moved, so these are
fresh measurements on release `e129bca605e3`.

`absorbGift` priced a Fire hit at zero, counted the volatile it could not model
(`MEDFAILS.absorbGiftUnmodelled`) and threw it away, so a Flash Fire body ate the move correctly and
then hit no harder for it — board material through DAMAGE. The value lived on a handler the tag
derivation never opened: the absorb is `onTryHit`, the payoff is the ability's
`condition.onModifyAtk` / `onModifySpA`. `tag_dex.js` now derives `typeImmunity.gain.volatileBoost`
and the engine reads all five of its fields; nothing is named. **316 legal abilities were scanned and
exactly one matches**, printed on every run so a second member arrives named.

**The authority was played, not recalled.** One real `gen9championsvgc2026regmb` `Battle` with
medicham2's own built stats written onto its Pokemon, the damage roll pinned, and ONE knob — the TYPE
of the move that hit the Flash Fire body on turn 1. At roll 8 the turn-2 Flamethrower deals **91**
after a Body Slam and **136** after a Fire Punch (x1.4945); rolls 0 and 15 read 100/148 and 84/126,
and two Fire Punches read `-start` then `-immune` in that order.

| clause | reading on `e129bca605e3` |
|---|---|
| census | **784 probed, 784 live, 0 missing** (782 → 784; both new rows shown RED first under `MEDI_ABSORB_GIFT_VOLATILE_BLIND=1`) |
| board leaves compared | **34 of 80** (33 → 34; `volatile:choicelock`, 9,488 pool games, the largest comparable leaf in the hole) |
| whole-game differential | **961 paired games, 6 raw, 6 declared, 0 undeclared**; 12,445 turn boundaries compared and 12,445 identical |
| deliberate roster | **140 / 129 / 475 tested**, 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three |
| damage differential | **0 of 6000** at each of the sixteen band indices |
| gate | **8 of 8 PASS, OPEN** |

**Which scoreboard was stated before the runs, and both halves held for different reasons.** The lab
moved and the pool did not. Flash Fire is 1,177 of 17,381 pool games by SHEET PRESENCE but only 365
of 8,778 deduped teams (4.16%), and the absorb never happened in any of the 961 games — had it, the
pre-fix `-immune` would have parted from the authority's `-start` right there. `choicelock` WAS
reached and agreed. Before either run was believed, the new leaf was proved non-vacuous on a staged
board with the item as the only knob: no item → `""`/`""`, Choice Scarf →
`"dragonclaw"`/`"dragonclaw"`, both engines through the same reader.

**Filed, not fixed:** the two engines destroy a dead Choice lock at different moments — the authority
inside `onDisableMove` (request-building time), this engine inside `lockStillBinds` (menu-asking
time). Predicted before the run and not observed in 961 games, which is not the same as absent.

**Version 5.208.0 · Last updated 2026-08-28**

**5.208.0 — THE METRONOME ITEM IS WIRED, AND THE FIVE GATE CLAUSES ARE RE-MEASURED ON THE RELEASE
THAT WIRING PRODUCED. GATE 8 OF 8, OPEN. THE CLOSETED DEFECT IS STILL A DEFECT.** The 5.207.0 block
below is dated history: its counts were taken on engine release `5f3f7141227c` and are superseded, not
rewritten. Unlike the two passes before it, **an engine byte did move** — WIRE 158 gave the
`damageMultOnRepeat` tag its first consumer, five days short of three weeks after the tag was derived
correctly and left unread — so what follows is a fresh measurement rather than a reproduction.

**THE FIVE CLAUSES, RE-RUN ON RELEASE `4e5c7b3400de`**, each serialised through
`tools/lownode.cmd`, with the differential pinned to census `9446a684709d`, arm `middle`, turn cap 12
and `--team-store data/team-pool-frozen`:

| clause | reading |
|---|---|
| deliberate roster — items / abilities / moves | **140 / 129 / 475 tested** (of 148, 202 and 500 in scope), 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three; red demonstrations **18 / 29 / 35**, all caught |
| what moved in that triple | the items stage alone: `item:metronome` went `DEFERRED-BY-OWNER` → `FIRED-AND-BOARDS-MATCH`, so the tested count rose by one and the deferred column fell to **0** |
| whole-game differential | **961 paired games, 6 raw divergences, 6 declared, 0 undeclared**; 12,445 turn boundaries compared and 12,445 identical |
| staged mechanics | items `shelved_by_owner` 1 → **0**, the owner closet 7 → 6 ids; **1,289 games played, 0 threw** |
| census | **782 probed, 782 live, 0 missing** — two rows added by WIRE 158: the climb, and the reset when the holder changes move |
| damage differential (not re-run; nothing that feeds it changed) | **0 of 6000 at each of the sixteen band indices** |

**THE SAMPLE IS PROVEN IDENTICAL RATHER THAN ASSUMED, AND THE TWO INSTRUMENTS NEED DIFFERENT
ARGUMENTS.** The whole-game differential is census-STEERED — the census selects which scenarios the
driver seeks — so a run taken after the census gained two rows would not be a before/after at all. It
was therefore pinned to the same 643-row census file the previous run read, and to the same frozen
pool (digest `0d103fb9fa87`, **1,968 of 8,778** teams picked); it returns the same game count, the
same six first divergences in the same order, and the same coverage block. The staged-mechanics
harness reads no census at all — it iterates the format's own entities — so its delta is readable
without a pin. Metronome is 19 of 26,232 teams in that pool, which is why the pool was predicted to
sit still before the run rather than explained afterwards.

**AND THE OPEN GATE MAKES NOTHING DOWNSTREAM TRUE.** 72 of 250 artifacts moved from WITHHELD to
RE-RUNNABLE — `engine/quarantine.js`'s own print, recorded in
`docs/_reports/2026-08-28-gate-rerun.md` and not independently re-derived here — and not one was
re-run. RE-RUNNABLE is permission to measure, not a result. ROADMAP #440
stays open and still says `DEFECT`; the closeted Perish Song faint is recorded as a defect we chose
not to fix. Full account: `docs/_reports/2026-08-28-gate-rerun.md`.

**5.207.0 — THE LAST OPEN GATE CLAUSE IS CLOSED BY A DECLARATION AND NOT BY A FIX. GATE 8 OF
8, OPEN. THE DEFECT IS STILL A DEFECT.** The 5.206.0 block below is dated history and stands as
written.

`data/game-differential.json` (engine release `5f3f7141227c`, 961 paired games, arm `middle`, pins
`ccb365985023`, `--team-store data/team-pool-frozen`, turn cap 12) holds **6 raw divergences**. Five
are the Supreme Overlord `fallenundefined` family, declared `AUTHORITY-WRONG` since 2026-08-18 —
`data/abilities.ts` does not guard the ability's `onEnd` on `side.totalFainted`, so the template
emits the literal string `fallenundefined` on a `[silent]` line players never see. The sixth is one
game at turn 11 in which a Perish Song death's `|faint|` is written **above** `|upkeep|` and the
authority writes it **below**: a message-emission point, not a different game. Both positions are the
authority's own — `fieldEvent`'s duration-expiry branch `continue`s past `faintMessages()`
(`sim/battle.ts:565`), so the drain point is a function of the residual handler list, and when nothing
survives the walk the queue is paid at `runAction`'s tail (`:2832`), eighteen lines below the
`|upkeep|` written at `:2814`.

**THE NO-BOARD-EFFECT CLAIM IS MEASURED, AND IT RESTS ON A LEAF THAT WAS COMPARED RATHER THAN ONE
NOBODY LOOKED AT.** 12,445 turn boundaries compared and 12,445 identical;
`state.games_board_never_diverged` 961 of 961; `protocol_diverged_board_never_did` 6 of 6;
`state.first_board_divergences` empty. `fainted`, with `hp`, `maxhp` and `status`, is in the compared
set on the active bodies (`engine/board_state.js:866`), the party (`:1034`) and the bench (`:769`,
`:843`), and `statusOf` maps a corpse to `fnt` on both sides so that a body dead in one engine and
alive in the other cannot hide. That qualifier is load-bearing: ROADMAP #528 measured **43 of the 80
leaves a legal mechanic can write to be in neither the compared set nor the declared-uncompared list**,
so an unqualified "no board differs" can mean "nobody looked".

Will ruled the divergence into the closet on 2026-08-28. It is subtracted from the clause by a
`kind: 'CLOSETED'` row in `engine/quarantine.js` — the first that kind has ever carried — holding the
owner, the date, the ruling, the measuring instrument, the release the measurement was taken on, and a
four-part falsifier; `closetFault` refuses the row at the door if any field is missing, and the matcher
requires a `perish0` line in the divergence's own `showdown_before` so it cannot spread to another
residual drain. **It is recorded as a defect we chose not to fix, never as an absence of one.** ROADMAP
#440 stays open and still says `DEFECT`; which surviving handler the engine's predicate believes in on
that board is **undiagnosed**, and is recorded as undiagnosed.

**THE GATE OPENING DOES NOT MAKE ANY WITHHELD NUMBER TRUE.** 61 downstream artifacts now print as
RE-RUNNABLE rather than WITHHELD. Every one of them was measured under an engine that has since
changed, so each must be re-run before it is quoted (ROADMAP #57). None was re-run in this pass.

**5.206.0 — THE FIVE WITHHELD CLAUSES WERE A LINE ENDING. THEY ARE RESTORED AT 7 OF 8 PASS, AND EVERY
ONE OF THEM REPRODUCED ITS PREVIOUS NUMBER EXACTLY.** The 5.205.0 block below is dated history and its
withholding is SUPERSEDED, not rewritten.

**WHAT THE FIVE ARTIFACTS SAY, NOW THAT THEY MAY BE QUOTED.** Re-run against engine release
`5f3f7141227c`, census pin `9446a684709d`, arm `middle`, turn cap 12, `--games 1200` (yielding 961
paired games), `--team-store data/team-pool-frozen`, `--state --end-state`:

| clause | reading |
|---|---|
| deliberate roster — items / abilities / moves | **139 / 129 / 475 tested**, 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on all three; red demonstrations **18 / 29 / 35** |
| whole-game differential | **1 of 961** (6 raw, less 5 declared); **board-material 0 of 961** |
| staged mechanics | 5 diverge, 1 declared, 4 below the reach shelf — **0 counted** |
| damage differential (unaffected, restated for context) | **0 of 6000 at each of the sixteen band indices** |
| census (unaffected, restated for context) | **780 probed, 780 live, 0 missing** |

One clause of eight still fails: the whole-game differential, at the same single unreproducible faint
row it held before the stranding. **Quarantine has not lifted.**

**THE MECHANISM, MEASURED RATHER THAN INFERRED.** `core.autocrlf = true` rewrites any file git treats
as text to CRLF at checkout, so a frozen source whose generator emits LF has two byte-forms and the
release id follows whichever wrote it last. The file that moved was the tag artifact written by
`engine/tag_dex.js`.

Its committed blob hashes to `576a4bbe91af` and is **byte-identical to release `5f3f7141227c`'s own
snapshot of it**; the working copy was that same blob after translation, larger by exactly one byte
per line and hashing to `a32ee545cf67`. Restoring it is git handing back what the generator wrote —
not an input edited until a ruler agreed, which is the distinction that made the restoration
admissible. The tree then re-cuts to `5f3f7141227c`, the id those artifacts already carry. The byte
and carriage-return counts are in `docs/_reports/2026-08-28-crlf-recurrence.md`.

**THE IDENTITY CHECK IS THE RESULT, NOT A FORMALITY.** Re-running was owed because a withheld figure
becomes re-runnable rather than true. Both heavy artifacts came back essentially unchanged:
`data/all-mechanics-fire.json` differs from its predecessor in three wall-clock `seconds` fields and
one embedded timestamp, and `data/game-differential.json` differs in exactly one field —
`engine_release_cuts`, 5 -> 6, because this pass appended a cut event to the same release.
`engine/provenance.js` recovered independently, from 1 content-verified artifact to 3, with
`mtime_only` unchanged at 175.

**AND IT CANNOT RECUR ON SEVENTEEN OF THE TWENTY-SIX FROZEN SOURCES.** `.gitattributes` pins them with
`text eol=lf`, which overrides `core.autocrlf`, and the entry moved no byte when it was added because
all seventeen were already LF in both the index and the working tree. It was shown RED first: writing
the committed blob and then `git checkout HEAD -- data/tags.json` took the digest
`576a4bbe91af -> a32ee545cf67` with nothing edited, and returns `576a4bbe91af` afterwards.
`tests/test-engine-release.js` now asserts the invariant — *a frozen source whose working-tree bytes
are LF must not be translatable* — which is derived per file rather than from a typed exception list,
so a twenty-seventh source added LF without an attribute fails by name. **Nine sources are deliberately
excluded** because they are CRLF in the working tree today; pinning them would rewrite every release id
and break `tests/roster.js`, whose red demonstrations match `\r\n` against the simulator's own source.
That is filed as owed work, not done quietly.


**5.205.0 — THE MEDICHAM SPRINT IS PAUSED AND THE DOCUMENTS ARE UNFROZEN. THE GATE IS NOT OPEN, AND
FIVE OF ITS EIGHT CLAUSES ARE WITHHELD RATHER THAN REPORTED.**

On 2026-08-10 the living-docs rule was deferred by the owner for the duration of the MEDICHAM
correctness sprint: each fix wrote one row to a running log and the batch was to be written up when
the gate closed. Will paused the sprint on 2026-08-28 and this pass discharges the debt. The log held
274 rows; `CHANGELOG.md` carries 233 releases between 3.99.1 and 5.204.0, every one of them a sprint
row; `docs/_reports/` carries 189 dated accounts. **The per-release detail lives there and is not
restated here.** The log file is deleted and the full living-docs rule is re-armed, which is what
deleting it means.

**THE THROUGH-LINE IS NOT A LIST OF FIXES. It is that the INSTRUMENT was the defect at least six
times, and that the largest single event of the sprint RAISED the visible defect count rather than
lowering it.** Named, each with a report: the deliberate roster's red demonstrations had never been
written into its artifact, so a gate clause that reads them had nothing to fail on; of thirty
accusations then classified, twenty-three were a miswritten demonstration, seven were a wrong rule
and exactly one was the engine failing to react; eighteen expired "shown red" certificates were being
published as a broken simulator; three board-material games attributed to a spread secondary were the
ruler; a golden-master check was dead from its second load and had been read as a spread-immunity
damage defect; a grep-based identity check was red on a file that does the thing it checked for. The
project's own rule — *suspect the instrument before the engine* — was earned, not assumed.

**THE EVENT DIE WAS TRANSLATING RATHER THAN RE-DRAWING, AND THAT IS WHY TWO ENGINES HAD BEEN AGREEING
BY ACCIDENT.** `midEventHash` and `midHash` ended on `h = Math.imul(h ^ c, 0x01000193)` with no
finalising mix, and the last field of every draw address is the arrival index `nth`. Changing only
the final character therefore TRANSLATES the hash instead of re-drawing it:

`v(nth=d) − v(nth=0) = (((A ⊕ c_d) − (A ⊕ c_0)) · P mod 2³²) / 2³²`, with `P = 0x01000193` the FNV-1a
prime from the source line above — a constant of the hash, not a measurement.

A one-digit index differs in its low four bits only, which bounds the shift. Two-digit indices mix
correctly, which is why nothing caught it for weeks.

| quantity | bare FNV-1a | with a finalising mix | independent |
|---|---|---|---|
| max circular shift, `v(nth=d)` against `v(nth=0)` | 0.0351571 | 0.4999829 | ~0.5 |
| consecutive arrivals sharing a 16-bucket damage index | 89.5% | 6.2% | 6.25% |
| distinct damage indices from a ten-hit address | 1.75 | 7.60 | 7.56 |
| two same-turn residual half-coins landing the same way | 99.1% | 48.5% | 50% |
| lag-1 autocorrelation down one address axis | 0.8873 | −0.0024 | ~0 |
| marginal hit rate on that sweep | 0.9214 | 0.8992 | 0.9 |

**The last row is the lesson, and it is a general one about rulers. The marginal was always fine, and
the assertion watching this axis measured only the marginal.** A die can be uniform in aggregate and
almost perfectly predictable one step at a time. Fixing it moved the whole-game differential from 3
to 14 games and the board-material subset from 1 to 12 — an instrument repaired, not a regression
introduced. The prediction was written before the run and published as written: whole-game 3 to
between 3 and 15 (14, inside), board-material 1 to between 1 and 8 (12, **outside and above**).

**EVERY FIGURE IN THIS PROJECT THAT WAS MEASURED BEFORE 2026-08-27 AND PASSED THROUGH THAT DIE IS
VOID, NOT STALE.** Void means the two engines were compared over a narrower slice of outcome space
than the comparison claimed to cover, so an agreement is not evidence of agreement. Every such figure
that appears in the sections below is retained as DATED HISTORY, in this project's standing practice
of never silently rewriting a prior conclusion — and **none of them may be cited as current.** The
current state of any of them is what `node engine/status.js` prints today, and where that prints
nothing, nothing is known.

**WHAT THE GATE SAYS TODAY, AND WHY MOST OF IT IS BLANK.** `engine/quarantine.js` computes the
MEDICHAM gate from artifacts. Read from `data/quarantine-stamp.json`: `gate_open` is **false**, with
five failing clauses — the three deliberate-roster stages, the whole-game differential, and the
staged-mechanics comparison. Those five are **WITHHELD, not annotated**: each artifact was measured
against engine release `5f3f7141227c` and the tree now hashes to a different release, so every count
in them describes a simulator that is not the one on disk. A figure printed beside a warning is the
failure this project has already paid for, so no rate, no diverged count and no roster column is
reproduced here.

**The cause of that stranding is measured and is not an engine change.** Exactly one of the
twenty-six frozen sources moved: `data/tags.json`, whose stored copy inside the release is
byte-identical to the working tree after newline normalisation and deep-equal when both are parsed as
JSON. A checkout under `core.autocrlf = true` rewrote a generated LF file as CRLF between the
measurement and now. `docs/ENGINE.md` records the identical event on 2026-08-26. **This does not make
the withheld numbers quotable.** The remedy is a re-run over the bytes a checkout actually produces,
and until that run exists the clauses say nothing.

**WHAT IS NOT WITHHELD, AND EXACTLY HOW FAR IT REACHES.**

- **The behavioural census — this reading is PRIOR and is superseded at 5.208.0 above by 782 / 782 /
  0; it is left as it was written.** Read from `data/mechanics-census.json`: **780 probed, 780 live, 0
  missing**, 780 armed and 0 unarmed, 0 threw and 0 hollow. This is a lab: one deliberately staged
  scenario per mechanic, regardless of whether anybody plays it. It answers *is this correct*. It
  does not answer *does this matter*, which is the pinned pool's question.
- **The damage differential.** Read from `data/engine-diff.json`: 6000 compared, 6000 agreed, 0
  disagreed, and 0 disagreements at the midpoint and at each of the sixteen indices of the damage
  band separately, never pooled. **THIS FIGURE IS NARROWER THAN IT LOOKS AND MUST NOT BE QUOTED AS A
  GENERAL AGREEMENT.** The artifact's own `scope` field limits it to *"damage only, no items or
  abilities"*; turn order, status duration and switching are not attempted. It also records
  `skipped_multihit` at 134 and `skipped_ability_multihit` at 17: the harness calls the authority's
  single-hit entry point rather than the volley loop, so **it has never applied a multi-hit move**,
  and the four multi-hit defects fixed during this sprint were invisible to it by construction.

**THE BOARD COMPARISON READS 33 OF 80 LEAVES, AND THAT IS THE SINGLE MOST IMPORTANT CAVEAT IN THIS
DOCUMENT.** "The boards match" is a claim about the leaves the comparison actually reads.
`tests/probe_uncompared_leaves.js` derives, over 500 legal moves, 201 abilities with a legal carrier
and 148 legal items, every leaf a legal mechanic can write: 80 distinct leaves, of which **33 are
compared, 4 are explicitly declared uncompared, and 43 are in NEITHER list.** Twenty-five of those 43
can be standing on the board at the turn boundary where the comparison is taken. `board_state.js`
states the consequence in its own words — *an unlisted omission reads exactly like agreement* — and
twice in one night a mechanic's verdict proved unearned for exactly this reason. Any sentence in this
paper of the form "the boards agree" is bounded by that 33.

**QUARANTINE HAS NOT LIFTED, AND THE TWO FACTS UNDER THAT SENTENCE ARE BOTH TRUE.** The computed
condition — the differential clean and the roster clean across items, abilities and moves — is not
met, so every artifact downstream of the simulator stays withheld. Will's own bar, ruled on
2026-08-22, is narrower: board-material zero with narration as a separate gate afterwards, plus a
clean roster. The last measurements taken before the stranding met that narrower bar. **These two
facts are not resolved here, and this paper does not resolve them:** the ruling that would re-cut the
gate to test board-material rather than whole-game divergence was never implemented, so the gate
still computes the wider condition and still reads shut.

**EVERY FIGURE DOWNSTREAM OF THE SIMULATOR IS RE-RUNNABLE, NOT TRUE.** A quarantined number does not
become correct when MEDICHAM becomes correct. It becomes eligible to be measured again. That applies
without exception to leaf calibration, the rollout rungs R1 to R4, the exploitability results, the
MAG and joint weight vectors, and every head-to-head in the sections below. The re-run list is
ROADMAP #57 and the refit is owed, gated on the engine rather than on compute.


**3.98.0 — FIVE OF SIX SOURCES OF PRIORITY REFUSAL WERE CORRECT; THE SIXTH TOLD ITSELF APART BY NAME.**
A +1 priority attack was staged against each source in turn on the frozen release. Armor Tail, Dazzling,
Queenly Majesty and Psychic Terrain all refused it (0 damage against a control of 25); Wide Guard let it
through, correctly, because it stops spread moves rather than priority ones; **Quick Guard let it through
too**, and that is a defect on 927 corpus clicks. The cause is that `quickguard` and `wideguard` carry
*byte-identical tag lists* — `priority, neverMisses, oneTurnGuard, statusCategory` — so three sites in the
simulator separated them by spelling: the action classifier (`if(id==='wideguard')`, which sent Quick Guard
to the no-op `{kind:'pass'}` branch), the move-legality filter in `buildMon` (which deleted Quick Guard from
a declared body before any turn ran), and the field state itself (a boolean pair whose *name* was the only
record of what it guarded against). The parameter that separates them — `oneTurnGuard.blocks`, derived by
`tag_dex` from each move's own `condition.onTryHit` — has been in `data/tags.json` since the tag was
written and nothing read it, so **`engine/tag_dex.js` did not change and no artifact was regenerated.**
The refusal is wired onto the same gate the ability sources already use, above the action-kind dispatch,
which is what makes a Prankster-boosted status move refusable (Showdown tests the *final* priority:
`if (move.priority <= 0.1) return`). Feint and the other thirteen moves lacking `flags.protect` still break
through, by the same rule the authority applies. `data/mechanics-census.json` now reads **357 live and 357
probed**, three more than before this wire; Wide Guard's two existing probes are unchanged and green. The
roster and the differential were not run and no roster row is claimed closed.

**3.97.0 — THE DAMAGE FUNCTION WAS ONE ROLL MULTIPLIED BY N, AND FOUR MOVES PAID FOR IT.** `dmgRange`
ended `if(_hits>1) return {min: floor(roll(85)*_hits), max: floor(roll(100)*_hits)}`: everything a hit owns
individually — its own base power, its own `+2`, its own target — folded into a scalar. Triple Axel's
`basePowerCallback` is `20 * move.hit`, so a flat 20 three times is **exactly half** the move (24 against
47); Dragon Darts carries `smartTarget`, so both darts landed on the aimed body and its partner took zero
(−72/0 against −36/−34); Beat Up summed every ally's base power into one packet and lost three of the
formula's four `+2`s (24 against 28); and Fickle Beam's 30% double was applied as a flat ×1.3, giving 104
base power — a value the move never takes. The last is the 3.90.0 finding verbatim (*"the multi-hit count
was the MEAN, and the pin never lands on a middle"*) surviving in a second code path, with the comment
above the line stating the averaging as a deliberate choice. The fix is a per-hit loop entered only where
the artifact says base power depends on the hit index, so single-hit damage is unchanged **by
construction** — and measured anyway: every move in the tag corpus, four real turns each, whole-board
digests against the frozen release, **2,000 cells and 11 differences across exactly these four moves**.
`data/mechanics-census.json` read 354 live and 354 probed at that release, four more than before this
wire — a figure that has since moved on, and is quoted here as what the census previously held rather
than what it holds now (3.98.0 took it to 357). No roster row is claimed closed; the roster and the differential
were not run.

**3.96.0 — THE ITEMS QUEUE WENT 6 TO 3, AND NOT ONE OF THE THREE WAS A MISSING MECHANIC.** Each was a
producer that could not name its member. `speedMult` was hardcoded to `name === 'choicescarf'`, so
Iron Ball — which halves Speed through the identical `onModifySpe` handler — went untagged for 139
uses while the CONSUMER sat working and starved. `statMult` hardcoded four names of which **all four
are banned in this format**, had no row in the artifact, and was read by nothing; `dmgRange` carried
the matching hardcode for the same three banned items, three permanently-false conditions. Oran Berry
heals a flat 10 HP rather than a fraction, and the derivation read only `maxhp/N`, so its amount came
out null and the consumer refused — correctly, since a guessed heal is worse than none. CLAUDE.md's
rule, *"match on tag shape, never on a name"*, is written for precisely this, and the rule immediately
below `speedMult` in the same file records that lesson being learned for Life Orb while `speedMult`
sat unfixed above it. **What this says about coverage:** a mechanic can be implemented, correct, and
demonstrably live, and still be absent for a specific holder because the artifact never named them.
The deliberate roster finds those because it stages every legal entity rather than the ones anyone
thought to check.

**3.95.0 — TWO READERS OF ONE FACT, AGAIN, AND THIS TIME IT WAS A QUARTER OF THE GATE.** The damage
differential's sole remaining disagreement across 150 comparisons was `chesnaught woodhammer ->
mimikyu`: the authority reports `0-0`, this engine reported `120-130`. Showdown's Disguise returns
false from `onDamage`, so the MOVE deals nothing and the `maxhp/8` that busts the disguise is the
ABILITY's own damage, applied separately. The battle loop had this right and has since WIRE 136 — both
engines land on the same HP, which is exactly why the Disguise model could be recorded as correct and
the record be true. The DAMAGE CALCULATOR, which every board feature and every rollout leaf consults,
knew nothing: measured against a control it returned **the same 120-142 with Disguise and with no
ability at all**, the deliberate roster's own definition of an unwired knob. This is the
`effMoveType`/`effWeatherOf` defect of 3.87.0 in a new place — one fact, two readers, one silent, each
internally consistent so nothing ever failed. The fact is stated once now and both readers call it.
**The hazard was in the fix rather than the finding:** the loop's damage comes FROM the calculator, so
once the calculator correctly returned 0 the loop's `dmg > 0` guard would have been false precisely
when the disguise was there to bust — the forme would never have broken. Caught before running. **Gate:
3 of 4 clauses failing to 2**, the differential clean at 0 of 150, all four re-measured under one
release.

**3.94.0 — THE MECHANIC WAS WORKING ON 20,000 USES, AND THAT IS EXACTLY WHY THE HOLE SURVIVED.**
Showdown carries the user's own stat change in **two different fields**. `self.boosts` covers Close
Combat, Superpower, Draco Meteor, Overheat, Leaf Storm and Make It Rain — all six read
FIRED-AND-BOARDS-MATCH in the deliberate roster, so "the user's own drop" looked closed. `selfBoost` is
a separate field, the builder never read it, and the two moves in this format that use it — Clanging
Scales (810 uses) and Scale Shot (199) — carried **no self-data at all**: Showdown drove the user to −1
then −2 Defence across two clicks while this engine left it at 0 both times. A sibling field name, not
a missing mechanic, and no amount of re-reading the working path would have surfaced it. Roster moves
**25 → 23** differ with exactly those two verdicts changed; census unmoved at 330 live; the damage
table unmoved at 1728/1728 exact. **An alarm raised and then killed in the same pass, recorded because
the killing is the useful part:** the `lowersUser` tag has no consumer anywhere in the engine across 13
moves and 22,277 uses, and that is *not* a hole — the engine applies these through the move row and the
secondary path, never through that tag. A tag with no reader and a mechanic with no implementation are
different claims, and only measurement separates them.

**3.93.0 — SEVEN TRAPPING MOVES REPORTED THE IDENTICAL DIFFERENCE, WHICH IS HOW A FACT ANNOUNCES
ITSELF AS ONE FACT.** Bind, Fire Spin, Infestation, Sand Tomb, Snap Trap, Whirlpool and Wrap each read
`showdown 4 / ours 3` then `3 / 2`. The artifact carried `partialTrap: { turns: '4-5' }`, typed by hand,
and `'4-5'` is the folk quantity — how many turns of chip the trapped side *feels*. What the engines are
compared on is Showdown's `partiallytrapped` **duration**, which starts at 5 and is decremented in the
Residual event **of the turn the trap lands**; this engine initialised from the already-decremented 4
and then ticked it again on that same turn. **The volatile-duration defect a third time** — Perish Song,
then the family closed at 3.82.0, now this — surviving both because the counter lives in `_trap` rather
than `_vol`, outside either fix's reach. The shape is now read off Showdown's own condition rather than
restated: duration from the condition, the `[5,6]` range from its `random(5,7)` callback, the Grip Claw
branch, and the chip divisor from `onStart`'s ternary; it fails closed if the condition stops parsing.
Red was demonstrated on the **frozen release the finding was measured under** (`3 · 2 · 1` against the
authority's `4 · 3 · 2`), not asserted. Roster moves **32 → 25** differing with exactly seven verdicts
changed and nothing else moved; census unmoved at 330 live. **The whole-game differential did not move —
65 of 107 games diverge on both releases** — which is stated because it is the measurement: a game stops
at its first divergence and these moves rarely reach it.

**3.92.0 — THE SWEEP THAT FOLLOWED THE GUARD FOUND FIVE MORE SITES, AND TWO WERE DEFECTS RATHER THAN
COSMETICS.** 3.91.0 caught `Tackle` — `isNonstandard: 'Past'` — padding one harness, and the obvious
next question was whether it was alone. The `.item`/`.ability` assignment surface across 238 files is
clean; move literals are not. Three sites were cosmetic, naming a nonexistent move in a slot that never
acts. Two were not. `tests/test-priority-block.js` silenced three slots with Splash, which is not
merely banned but ABSENT from the engine's move table — **so the silencing worked because the engine
could not find the move, not because the move does nothing**, which is indistinguishable from working
until it is not. And a guard in `tests/test-dead-volatile.js` admitted its subject only on
`move.exists`, which is **true for a banned move**: the branch always ran, always on Thousand Arrows,
which this format does not contain, and the else-branch that would have reported the gap was
unreachable. Merely tightening that guard would have moved the hole rather than closing it, leaving the
case untested — so the subject is derived from the format instead, and is now Smack Down. Every
affected instrument re-runs green with no figure moved, which is the expected result: each was an inert
slot or an unreachable branch. The value is that none of them can become live and wrong later.

**3.91.0 — THE HARNESS COULD MEASURE A MECHANIC THE FORMAT DOES NOT CONTAIN, AND AGREEMENT ABOUT ONE
IS WORTH NOTHING.** `new Battle()` performs no validation, so a probe that assigns an ability or an
item directly bypasses every rule in the format. Both engines will then agree about a Rocky Helmet in a
format that bans it, and the row reads as a pass. `tests/probe_pair.js` now asks Showdown's own
`TeamValidator` before it builds anything — the authority ADR-002 already names, reached through the
instance `champions_sim.packTeam` already constructs, so the fact has one implementation. It catches
strictly more than a ban-list check would: *"Meganium can't learn Flamethrower"* is a legal move on a
species that cannot have it, which no `isNonstandard` test can see, and that exact set was hand-staged
on 2026-08-08. **Two kinds of illegal are separated, because collapsing them would have refused every
honest probe:** an entity the format does not contain is always fatal, while an entity this species
merely cannot hold is a deliberate isolation in a controlled probe — `probe_pair` stamps one named
quiet ability on every body precisely so the control does not vary with the species, and that ability
is illegal on most of them. The second class is waivable with a written declaration; the first is not,
and a self-test proves the declaration does not launder a ban. **The guard's first two findings were in
the harness that hosts it:** `Tackle` is `isNonstandard: 'Past'` and every inert slot in the file
carried it, and the five padding species this author named by hand included one that does not exist in
this format. Both were names recalled instead of read, which is the same defect as the retraction one
version below. Nothing downstream moved; this is an instrument, and every quarantined figure stays
quarantined.

**3.90.0 — A CLUSTER THAT DISAGREED IN BOTH DIRECTIONS AT ONCE, WHICH IS WHAT A COUNT ERROR LOOKS
LIKE.** Eleven multi-hit moves parted from the authority by small amounts, some high and some low, and
the shape of that disagreement was the diagnosis: a per-hit rounding error cannot be both. The engine
answered 3.1 hits — the mean of the 35/35/15/15 distribution over 2, 3, 4 and 5 — to every question
ever asked about the family, including the question a real turn asks. Read straight out of Showdown
through `battle.choose`, so every hit runs, its `|-hitcount|` reports FIVE at the differential's top pin
corner and TWO at the bottom and never a three: the authority samples a twenty-element table and the
pin selects its first or last element. **The competing hypothesis, a per-hit floor, was ruled out with
arithmetic rather than a preference:** the per-hit value is already an integer, so with an integer count
`floor(v*n)` and `n*v` are the same number, and the line that computes it did not change. The count is
drawn now, once per move use and after the accuracy steps, exactly where the authority draws it; the
per-hit accuracy is rolled and breaks at the first miss rather than being discounted by a mean; and the
count of REACTION events reads the same draw, so a Bullet Seed can no longer deal five hits of damage
while setting off Weak Armor three times. Census 329 to 330 live, 0 missing; the roster's moves stage
40 to 32 disagreements with the eight multi-hit members accounting for all eight of the difference,
abilities and items unmoved, the 150-row damage differential unmoved.

**3.89.0 — A FAMILY THAT PRODUCED A WRONG ANSWER ON EVERY HIT, AND A HEAL FAMILY THAT HEALED 0.000
HP.** 3.88.0 derived the condition for `buffsHolderOnHit` and said plainly that the engine did not
read it; it does now. Applied unconditionally, eleven of the family's twelve members were wrong on
every connecting hit — Anger Point maxed Attack off a NON-critical hit and did the same thing on a
critical one (an unwired knob), Justified fired off Close Combat, Weak Armor off Dark Pulse. Stamina,
2,773 of the family's 2,972 uses, carries no condition and was correct throughout, which is precisely
why nothing noticed the other eleven; it is now asserted on both sides of the crit die as the positive
control. **The direction of the error is what distinguishes this from the pinch family of 3.85.0:**
that one failed CLOSED, so the engine was merely missing a mechanic, while this one failed OPEN and was
stating something false about the board. Separately, Synthesis, Moonlight, Morning Sun and Strength Sap
(1,024 uses) resolved to a wasted turn healing nothing in every sky, and in sand the click was strictly
worse than passing, because the residual still chipped the body that had spent its turn. The blocker
was real and had expired: the tag said `heal: true`, a boolean in a fraction's clothing, and the
artifact now carries the weather fractions and the target-stat reference. Census 326 to 329 live, 0
missing; the roster and the 150-row damage differential are unmoved.

**3.88.0 — TWELVE MOVES WERE PRICED OFF GENERIC GEN-9 DATA INSTEAD OF THIS FORMAT'S, AND THE
BUILDER THAT FIXED THEM WAS ONE RUN AWAY FROM DELETING TEN SPECIES.** Trop Kick read 70 where the
format says 85, Mountain Gale 100 against 120 — ours low in all twelve, and MAG's own table had the
right numbers the whole time, so the two engines disagreed on every one. Asking what a regeneration
WOULD do, before running one, turned up 788 destructive changes waiting in the same builder and a
header stamp whose regex had never once matched. `buffsHolderOnHit` also gained its condition by
derivation — Anger Point only on a critical hit, Justified only on Dark — but **the engine does not
read it yet and nothing behaves differently**, which is said here rather than left to look like a fix.

**3.87.0 — TWO READERS OF ONE FACT, MEASURED: THE LOOP'S TYPE AUTHORITY AND THE DAMAGE CALCULATION
DISAGREED ABOUT THE WEATHER.** `effMoveType` resolved a weather-scaled move's type off the raw
`field.weather`; `dmgRange` resolved it off `effWeatherOf`, which applies the private sky carried by
the `privateWeather` tag. Under a private sun with a clear field the two part: the damage calculation
returned Fire, 128-151, and the loop's stage-5 immunity gate refused the same click as Normal, so the
damage dealt into a Ghost was 0. The official engine, played rather than cited
(`gen9championsvgc2026regmb`, a real battle, Weather Ball into Gengar): 0/135 with `-immune` without
the mega, 97/135 with it, and 97/135 under a public sun — the private sky must therefore give
EXACTLY the public-sky number, not merely a non-zero one, because Showdown's `effectiveWeather()`
feeds both `onModifyType` and `onModifyMove`. The probe asserts that equality. Census 325 to 326
live; the roster and the 1/150 damage differential are unmoved; the paired whole-game differential is
identical at 668 divergences of 1553 games in both arms, and the artifact names why — it lists this
mechanic among the 47 census rows it declares unmeasurable.

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

### A technical description of ABRA, a decision-support model family for competitive Pokémon


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

**A MORE CORRECT ENGINE DID NOT MAKE BETTER PREDICTIONS (3.69.0).** The release ladder below records
that ten fixes moved the differential's first-divergence depth from 13 to 19 protocol lines while the
median completed turn never moved off 1. Which of the two readings — if either — predicts the thing the
engine exists to serve had never been measured. It has now.
**EVERY FIGURE THIS PARAGRAPH CARRIED IS QUARANTINED — the figures are withheld, not annotated.**
`data/leaf-engine-contrast.json` is downstream of MEDICHAM: its generator
`engine/leaf_engine_contrast.js` is in the play layer, reaching `engine/medicham2-browser.js` through
`require`, so every number in it was produced by a simulator the gate does not certify. MEDICHAM is not
correct — `engine/quarantine.js` reports the failing clauses, and `node engine/status.js` names which.
No sample size, no paired Brier, no confidence interval, no noise floor, no rho, no ECE and no
discrimination share is carried in its place; the comparison of the leaf across two engine releases is
unquotable rather than retracted, and it is not a claim whose direction may be inferred from the
absence. It becomes quotable again when the gate opens AND this is re-run:
`node engine/leaf_engine_contrast.js`. The dated block above stands as written for what it says about
the INSTRUMENT — the two releases differ in exactly one file, the generator refuses to run if that is
not true, and the reversed-order control exists — because those are statements about apparatus rather
than measurements taken through the simulator.

**THE RELEASE LADDER, AND THE HONEST ANSWER IS THAT SIX FIXES DID NOT MOVE THE MEDIAN (3.68.0).**
`engine/wire_ladder.js` replays every frozen release of the 2026-08-06/07 wire night through the
differential under one pinned census and one team pool, so all nine arms are mutually comparable rather
than only adjacent — the defect that retracted the pairwise before/afters in 3.62.1.
**Read every figure from `data/wire-ladder.json`.** On 1,995 games per arm the median game parts after
**one completed turn at every rung, unchanged**, and 22 of 1,995 games agree completely against 2 at the
baseline. What did move is the DEPTH of the first divergence — mean 15.0 → 24.0 protocol lines, p90
30 → 57 — and per-rung effects that a pairwise comparison had misattributed: an intermediate cut that
was never published as a wire outranks WIRE 1, whose pairwise before/after had absorbed it, and one
unambiguously correct arithmetic fix moved **zero** of 1,995 games. The pre-WIRE-1 baseline was run first and last
with eight arms between and reproduced exactly, so the ladder is the engine change and not the run.

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

> This is a living document, updated in the same pass as any change to the code, together with the
> deck and the technical documentation. A prior conclusion is never silently rewritten; new
> information is added and what changed is stated. See `CHANGELOG.md`.

---

## Abstract

ABRA is a decision-support model family for **Pokémon Champions VGC, Regulation M-B, best-of-one
closed-sheet ladder**. It continuously ingests public battle replays from Pokémon Showdown and stores
the durable facts of every game, then builds small, CPU-trainable models on that store. Its central
empirical finding governs its design: **predicting the winner of a game from the two team sheets is
near-impossible in this format — even a player-Elo model ties a coin.** ABRA therefore does not sell
outcome prediction. It follows the recipe that worked in poker, Diplomacy, and sports analytics:
*support decisions, don't predict outcomes*, and judge every model by a proper score against an honest
baseline with a confidence interval. **As of 3.62.2 the headline metric is exploitability rather than
win rate** (§0, ADR-003): VGC is formally an imperfect-information game, the only prior work in this
exact format measures its own agents at approximately 100% exploitable despite beating a
professional, and the thesis under test is that a per-turn re-solving agent is harder to exploit than
a compiled policy — *unknown*, and stated as the experiment rather than the assumption. This paper
states that thesis and its metric, the empirical ceiling, the data model, each model with its
validated result (including two honest negatives), the mathematics, the limits, and the road to the
in-battle engine (ALAKAZAM).

## 0. The thesis, and the metric that follows from it (3.62.2)

**This project's headline metric is exploitability, not win rate.** The change is recorded in
ADR-003 and it is forced by a measurement somebody else made.

**The field has been treating VGC as a chess problem or a pure-RL problem. It is a poker problem.**
Chess and Go are perfect-information games: there is one true state, both players see it, and
minimax or MCTS over that state is sound. VGC is not. A player does not know which four of the
opponent's six will be brought, their items, their abilities, or the fourth move on each set, and
that hidden information is not noise to be averaged away — it is *strategically exploitable*. The
correct solution concept is therefore a **Nash equilibrium in mixed strategies, not a single best
move**, which is poker's situation verbatim and the reason RL+search methods that are sound in chess
break in imperfect-information games (ReBeL, ref. 4). `docs/POKER-TO-POKEMON.md` works the
correspondence through term by term and is honest about the three places it breaks — simultaneity,
action-space and horizon scale, and the nature of chance.

That argument was made from theory and had no measurement behind it. **VGC-Bench supplies the
measurement.** Angliss, Cui, Hu, Rahman and Stone (AAMAS 2026, ref. 5) trained behaviour cloning on
700,000+ human battle logs and fine-tuned with PPO under self-play, fictitious play and double
oracle. In a single-team mirror match their agent **beat a World Championships competitor**. And in
the same paper:

- *"In almost all cases, **all agents are approximately 100% exploitable**"* — measured by training a
  best-response policy against each agent.
- Their expert tester's feedback: *"although the agent is strong on initial play, it does have
  noticeable dips in performance in certain states. **After enough successive games, strong human
  players can adapt and beat the agent.**"*
- Against their *advanced* (not expert) tester the agent won **2 of 5**.

**That is not a weakness of their execution. It is the predicted behaviour of a compiled policy** — a
fixed map from state to action — in an imperfect-information game. A best response can find and drill
its blind spots, and so can a human given five games. Poker learned this over 2007–2021 and answered
it with equilibrium mixing and continual re-solving (CFR, DeepStack, Libratus, ReBeL; refs. 1–4).

**The thesis is therefore that a re-solving agent should be harder to exploit than a compiled one.**
A learned policy *recalls*; a search *recomputes*. A best-response exploiter attacks a fixed mapping,
and a per-turn re-solve presents none. **Whether this survives simultaneity, stochasticity and a
~6-turn horizon is UNKNOWN — that is the experiment of this project, not its assumption.**

**Two consequences for the model family.** WOBBUFFET (§4, and `docs/MODELS.md`) moves from side-check
to primary instrument, with VGC-Bench's ~100% as the published comparator. SLOWKING stops being
"the preview solver" and becomes the shape of the whole agent.

**And the honest state of that metric today is that we do not have one.** `data/exploitability.json`
is declared void; the 2026-07-26 figure was fitted on 17 features against the 58 we ship and the
2026-08-04 re-run had its defender refitted while it was running. Leading with a metric this project
cannot currently produce is deliberate — it makes the gap a deliverable instead of a footnote.

### 0.1 Why the comparison is legitimate although the agents can never meet

VGC-Bench's public checkpoints are Regulation M-A; we are Regulation M-B, and their own paper shows
policies do not transfer across team sets. A head-to-head is impossible. But **exploitability is
intrinsic**: it is defined against a best response trained against *you*, in *your* format, so the
two numbers live on the same scale without the two agents ever playing a game.

Two further points sharpen rather than weaken the frame:

- **VGC-Bench is open team sheets** — the same information setting as our Reg M-B best-of-three. They
  had *more* information than a closed-sheet agent and were still ~100% exploitable. The
  exploitability comes from holding a fixed policy, not from hidden teams.
- **Their dataset is not usable by us, and this project's code already said so.** Their Reg M-B
  holding is 4,167 games over 4 days in June 2026, and all 4,167 are already in our store as
  `data/games.ots.jsonl`, against our own 9,701 best-of-three games over 15 days. The 700,000
  headline is Reg M-A, the previous regulation. An earlier claim in this project that their archive
  covered our format inferred coverage from a *filename* and is withdrawn; `docs/PRIOR-ART.md` §2
  carries the correction.

### 0.2 What we are not claiming

- **Not that we will beat VGC-Bench.** Their agent beat a Worlds competitor; ours has never played a
  human.
- **Not that search is known to work here.** Metamon (RLC 2025, ref. 5) reached top 10% in singles
  with no search at all, and Future Sight AI removed its machine learning entirely after finding a
  structural method beat it on both accuracy and speed. Both are live counter-evidence.
- **Not novelty on the format or the infrastructure.** VGC-Bench owns both, including the poke-env
  doubles support the field now uses. We are not first, and in our own format we are behind.

**If the thesis fails, the instrumentation still stands.** No project in `docs/PRIOR-ART.md`
publishes a mechanics census that must be shown red before it counts, a step-level protocol
differential against the official engine, ratchets on silent failure, or a record of what it
retracted. If search loses, this remains the only account of what a hand-written VGC simulator gets
wrong and how you would know — publishable precisely because everyone else avoided the problem by
not having it.

### 0.3 The engine is justified if and only if search pays

VGC-Bench used real Showdown through poke-env and carried **no engine-correctness debt at all**,
because behaviour cloning and PPO do not need a fast simulator: they need throughput at training
time, not at decision time. We wrote MEDICHAM (§3) so that **per-turn re-solving is affordable**.
That makes the engine work falsifiable rather than assumed, and it promotes one roadmap item to the
status of a project gate.

Supporting evidence that this is the real trade and not a rationalisation — every project that
searches hits the engine-speed wall, and the pattern is clean:

| project | searches? | engine | depth reached |
|---|---|---|---|
| VGC-Bench | no | real Showdown | n/a |
| Future Sight AI | yes | modified Showdown | ~3 turns in 15 s on 16 cores |
| Foul Play | yes | built its own (poke-engine) | ~10+ turns |

**The plan is four phases, and the fourth is a result rather than a defeat:**

```
1  finish MEDICHAM        search needs an engine that is fast AND correct
2  GATE #62               does compute buy anything: untimed vs on-the-clock
3  if yes -> search, and measure EXPLOITABILITY against their ~100%
4  if no  -> adopt their recipe: BC + PPO self-play/FP/DO, open source, reproducible
```

Phase 4 is cheap precisely because VGC-Bench made it so — the method is published, open-source and
reproducible — and taking it would be a finding about VGC, not a failure of this project.

**On compute.** Cores help the search (it is CPU-bound and root-parallelisable); GPUs help behaviour
cloning and PPO. MILTANK currently needs **26 s against a 20 s budget on one core of sixteen**, so
sixteen cores fixes the clock today. But root parallelisation scales **sublinearly**, so cores
convert a failed budget into a met one rather than a shallow search into a deep one. Buying cores
does not buy depth, and the phase-2 gate is about depth.

## 1. The empirical ceiling (why the design is what it is)

On 600+ held-out real Champions games, a Bradley-Terry player-Elo model reaches a held-out log-loss of
**0.687 against a coin's 0.693** — a real but negligible edge. **A 2026-07-25 re-measurement makes the
ceiling lower still:** the previously published "higher-rated player wins 55.0%" was computed with a
name-only bot filter that missed six high-volume accounts. Removing them gives **52.4%, 95% CI
[49.9, 54.9]** — an interval containing a coin flip. A cloned-policy rollout engine
(MEDICHAM) does *worse* than a coin as a raw win-predictor.

**Re-measured 2026-08-04 on 6,886 clean games**, against the leaves MILTANK actually calls rather than
the `winProb2` entry point the earlier readings scored. Paired against a coin on identical turn-0
positions, the in-game leaf (`explore=1.0`, 200 rollouts, held-out n=1,378) loses by **Brier +0.0502,
95% CI [0.0371, 0.0628]**, and the team-preview leaf (n=6,886) by **+0.0740 [0.0668, 0.0813]**; both
also lose to player-Elo. The reliability curve is nearly flat — the in-game leaf's 90-100% bucket wins
53.6% and its 0-10% bucket wins 53.8% — and it names the winner on **50.99% of 1,314 decisive calls,
95% CI [48.3, 53.7]**, which is a coin. The preview leaf discriminates barely: 53.22% of 6,700
(CI [52.0, 54.4]), about 1.9 points above its own split-half noise floor.

*This supersedes, and partly corrects, the earlier reading.* The 2026-07-23 figure ("log-loss ≈ 1.2;
picks the winner on ~44% of decisive calls, i.e. systematically **inverted**") is retained here because
a prior conclusion is never silently rewritten. **WHAT THE LARGER RE-MEASUREMENT SAID IS QUARANTINED —
the figures are withheld, not annotated.** `data/winrate-backtest.json` is downstream of MEDICHAM: its
generator `engine/backtest_winrate.js` is in the play layer, reaching `engine/medicham2-browser.js`
through `require`, and the artifact was measured against a build of that simulator which no longer
exists. MEDICHAM is not correct — `node engine/status.js` names the failing clauses. So no replication
verdict, no bucket share, no calibration gap and no sample size is carried here: whether the inversion
replicates is an OPEN question in this document, not a settled one, and the reader may not infer the
direction from the absence. It becomes quotable again when the gate opens AND this is re-run:
`node engine/backtest_winrate.js`.

The conclusion is not "our models are weak." It is a property of the game: a two-player, zero-sum,
**imperfect-information, simultaneous-move** game with a non-transitive metagame has an irreducible
outcome-prediction ceiling from team sheets alone. This is the same reason expected-goals (xG) models
in football predict *shot quality* rather than final scores. **Design consequence: stop predicting
outcomes; support decisions.** Everything below serves that.

## 2. Data: store raw, analyse on top

ABRA reads Showdown's public replay API (`search.json?format=`, `search.json?user=`, `<id>.log`); it
reads nothing private and creates no accounts (`SECURITY.md`). The extractor
(`engine/durable-ingest.js`, `extract()`) turns one battle log into one durable record:

| Field | Meaning |
|---|---|
| `id`, `date` | replay id and upload time |
| `p1`, `p2` | `{name, rating, bot}` per player |
| `six.p1/p2` | the revealed team of six |
| `brought.p1/p2` | the four actually brought |
| `lead.p1/p2` | the two led |
| `sets` | per species, the moves / item / ability the replay *revealed* |
| `turns` | per-turn events (moves, damage, faints, status, field) |
| `winner` | the winning name |

The store is append-only JSON Lines keyed by replay id: idempotent, deduplicated at read time, and
grown hourly by a GitHub Action. The **governing rule** is *store raw, analyse on top*: every filter
(rating tier, humans-only, archetype, playstyle) is a re-computation over the store, never a re-pull.
Changing how we segment games is free; the fetch is a one-time cost. About 2,600 public games/day are
available, and the store grows ~18k/week, so every model below sharpens on its own over time.

## 3. The validated foundation — exact damage (MEDICHAM)

The one component that is *not* a coin flip is the damage engine. MEDICHAM's Gen-9 doubles damage
pipeline (`engine/medicham2-browser.js`) is validated against the Smogon damage calculator (the community
ground-truth). This is gated in CI (`engine/validate_damage.js` → `data/damage-validation.json`).
Every model that reasons about damage builds on this, and "will this move KO?" is a *winnable*
prediction, unlike "who wins the game."

Read from `data/damage-validation.json`: **36 scenarios compared, within 5% on 100% of them, worst
0%**, at level 50 in gen 9.

**This paragraph read "31 meta scenarios … median error 0%, worst 3%" until 2026-08-22, and both
halves were superseded rather than wrong when written.** The harness gained scenarios (31 → 36) and
the worst relative error fell to 0%; the artifact has said so since 2026-08-08 and the sentence did
not move with it. The artifact's own caveat still governs what the agreement means: it is agreement
on the DAMAGE FORMULA only, and says nothing about move selection, the accuracy model, or mechanics.

### 3.0 Why a hand-written engine exists at all, and the corrected speed figure (3.62.2)

**ADR-001 decided this architecture on a benchmark of 29 against 3,401 battles/sec/core — a ratio of
117x — and that ratio does not reproduce.** Re-measured on the same machine, both engines on the same
four teams (derived from the store rather than typed), 8-second runs at a 60-turn cap:

```
                 turns/sec    battles/sec
MEDICHAM           13,041         217
champions_sim         523          28
ratio               24.9x         7.7x
```

**`turns/sec` is the comparable unit and `battles/sec` is not.** The two engines were driven
differently — MEDICHAM to its 60-turn cap, Showdown with `choose('default')` to a natural end — so a
"battle" is not the same amount of work on the two sides, and the 7.7x is not like-for-like. The
honest statement of the gap is **24.9x**. The July figures are retained above and in ADR-001 because
a prior conclusion in this project is never silently rewritten, and a third reading exists that is
neither: ROADMAP #61 measured MEDICHAM at 1,606 battles/sec. **Nothing ratchets engine speed**, which
is how three readings of one quantity can differ by an order of magnitude with no test going red.

**The architectural decision survives the correction, but its justification changes.** A 24.9x gap
still rules out live browser simulation, so ADR-001's conclusion stands. What no longer stands is
"117x" as the reason. The reason is now the one §0.3 gives and it is falsifiable: **the engine work
is justified if and only if search pays**, gated by ROADMAP #62.

### 3.1 The engine can now say WHAT it did, not only what state it reached (3.58.0)

The damage validation above, the 150-row differential and the five scripted whole-game comparisons all
compare **outcomes**: a number, or a state after a turn. None of them can see an ordering, and none
can say *which mechanism* produced a disagreement. Showdown's own protocol log can — it is a
step-level trace already labelled with the mechanism behind each decision (`|-unboost|` is a stat
drop, `|-enditem|` is an item being spent, the order of two `|move|` lines is turn order).

`engine/medicham2-browser.js` now emits that stream on request. The event set is **derived from
Showdown's `add()` call sites** rather than transcribed (`engine/derive_protocol_events.js` →
`data/protocol-events.json`, whose own `showdownEvents`, `emittedCount`, `notEmittedCount` and
`partialCount` read 91 / 44 / 50 / 10), and two gates fail the run — claiming an event Showdown never
emits, or leaving one unexplained. The scan reads this **format's** overrides, not the generic
protocol: Champions emits `|-supereffective|POKEMON|N` where the base engine emits two fields.

It changes no mechanic, and two things it found on its first night are recorded because they are
about **what the existing instruments cannot see**:

1. **The damage differential is an endpoint comparison.** It calls the reference at `roll=0` and
   `roll=15` against MEDICHAM's `min` and `max`. In between, MEDICHAM interpolates linearly over an
   11-integer range and samples it uniformly; Showdown floors sixteen base values separately. 149/150
   endpoint agreement is compatible with every interior roll being off by one or two, and with every
   roll's *probability* being wrong. This is a limitation of the measurement, stated; it is not a
   claim that the damage is wrong.
2. **Order within a hit differs and end-of-turn state does not.** MEDICHAM resolves the knock-off, the
   resist berry and the contact punish before subtracting the target's HP. The whole-game state
   comparison agrees on every turn of all five scripted games; the trace does not agree on the order.

Neither is fixed here. Changing how a damage roll is drawn moves every seeded run in the repository.

**Finding 1's limitation was closed on 2026-08-22, and the closure is recorded rather than written
over the sentence above.** The differential no longer speaks only for the two corners.
`data/engine-diff.json` now reads **6000 requested, 6000 compared, 5995 agreed, 5 disagreed,
`band_missing` 0**. The artifact states the rule the sweep enforces in its own `band_why` field:
*"THREE SAMPLED POINTS OF A SIXTEEN-INDEX BAND CANNOT SPEAK FOR THE THIRTEEN THEY NEVER SAMPLE"* —
and its `arms_why` field records the separate demonstration that a midpoint cannot see a range wrong
by the same amount at both ends, because `--plant spread` leaves `disagreed` at its unplanted value
while both corner arms light up. So the paragraph above is now history: it was a true statement about
an endpoint-only instrument, and the instrument changed.

Every probability ships a **proper score** (log-loss and/or Brier), a **confidence interval**
(clustered by game where states within a game are correlated), and an **honest baseline**, persisted
to JSON and gated in CI.

### 4.1 GURU — meta / matchup matrix (descriptive)
From REAL outcomes, `engine/guru.py` builds an archetype × archetype matchup matrix (K is chosen from the data; see `data/archetypes.json`) over the generated game count in `data/live.js` (hardcoded sizes are retracted, S13) —
games, each cell a win-rate with a **Wilson score interval**. GURU is *descriptive*: its own predictive
test shows per-game winner prediction from the matrix ties a coin (log-loss 0.7122 vs 0.6931), exactly
as §1 predicts. Its value is honest matchup structure with error bars, and it is the real (not
simulated) payoff matrix that SLOWKING solves. Output: `data/guru-matchups.json`, `data/guru.js`.

### 4.2 XATU — opponent belief (modest, useful)
`engine/xatu.py` learns, per species, the set (item/ability/moves) usually run, and predicts the
opponent's next move from state. On held-out human moves the behaviour-clone reaches **top-1 35.9%
(CI 35.2–36.5), top-3 71.6%**, cross-entropy 2.27 nats — beating a species-agnostic baseline (4.54) and
uniform-over-moveset (2.91). A modest but real signal; human move choice has genuine entropy. Output:
`data/xatu.json`, `data/xatu.js`; harness `engine/eval_policy.py` → `data/policy-eval.json`.

### 4.3 PORY — mid-game win probability (RETRACTED as a value net; it is material arithmetic)
The pivot's proof. `engine/pory.py` reconstructs per-turn board state (mons alive out of four, mean
active HP, turn) and fits a logistic value net. Held-out, clustered by game: **log-loss 0.6236** 95% CI [0.6070, 0.6387] vs coin
0.693**, beating a material-sign heuristic, **calibrated to ECE 1.6%**, CI **[0.548, 0.583]**. The
*live board is predictable even though the pre-game sheets are not* — the thesis, demonstrated. PORY is
wired into KADABRA as a per-turn "you're at X%". Output: `data/pory.js`; report `data/pory-eval.json`.

### 4.4 CHOMP-EV — do CHOMP's brings beat humans'? (honest NULL)
The winnable team-preview test. For each held-out game (both full sixes, both actual brings, the
winner), `engine/chomp_ev.js` ranks each side's *actual* bring among all 15 candidate brings by
CHOMP's exact-damage coverage, and asks whether that quality signal tracks who won. On **1,205 games**:
CHOMP's bring ranking **does not beat a coin** (held-out log-loss 0.6918 vs 0.6931, CIs overlap), ties
an Elo and a usage-prior baseline, and winners are only marginally more CHOMP-aligned than losers
(sign test 0.512, CI [0.493, 0.535]). It is **robust to forfeits** (0.505; a forfeit is usually a
concession from a losing position, and dropping all forfeits does not change the result), and a
measured **selection audit** shows the required "all four revealed" filter is a mild bias (eval 6.5
turns / 1280 rating vs 6.08 / 1267 excluded) that, if anything, *favours* CHOMP — making the null
conservative. A **belief-weighted** variant (coverage vs the opponent's likely-4) also ties the coin
(0.6924). Interpretation: the bring decision sits at the same near-coin ceiling as pre-game prediction;
CHOMP's damage math stays validated and useful as a calculator, but "CHOMP builds better brings" is not
yet empirically supported. This negative is a guardrail: it stops optimising a bring metric that
carries no held-out winning signal . Report `data/chomp-ev.json`; test
`tests/test-chomp-ev.js`.

**Multiplicity, corrected 2026-07-31.** The fit reports a 95% interval for all 56 features, so at alpha 0.05 about **2.8 of them clear zero by chance alone**. The family is **every feature in the shipped fit**, because every one is reported to the reader — choosing a smaller family after seeing which are large is the practice the correction exists to prevent. Uncorrected, **53** clear zero. Under **Benjamini–Hochberg** (FDR, 1995) **53** survive; under **Bonferroni** (FWER) **49**. Nothing significant uncorrected fails the FDR correction, so the headline count is not an artefact of having looked at 56. Computed by `engine/weight_multiplicity.js` → `data/weight-multiplicity.json`. **This says which weights are distinguishable from zero. It says nothing about whether an imitation-fitted weight is evidence about WINNING** — a separate and larger question this project has measured going the other way.

**A phrasing the filter itself mandates.** `require_full_bring` conditions on game length, so every bring statistic in this project is *"the bring, **among games long enough to show it**"*, which is not the same as "the bring". `data/quality-filter.json` states that at the point of filtering, in `rules.require_full_bring.known_limitation`, and requires it to be said downstream; this is that. The SIZE of the conditioning is the step the artifact actually records: `provenance.funnel.after_min_turns` **26,142** to `provenance.funnel.after_full_bring` **18,908**, on `provenance.store_size` **67,384** at `provenance.measured_on` 2026-08-27.

**CORRECTION, 5.259.0 — THE THREE FIGURES THIS SENTENCE USED TO CARRY WERE NEVER IN THE ARTIFACT IT CITES.** The prior claim is stated first, in full, because a prior conclusion is never silently rewritten. Until 5.259.0 this paragraph read: *"`require_full_bring` conditions on game length: measured 2026-07-31, the games it keeps are 1.71x longer on average (7.4 vs 4.3 mean turns; 19,589 kept vs 8,713 dropped)"*, citing `data/quality-filter.json` for all three.
That citation could not have supported any of them on any day. The file has six commits in its whole history and not one of them contains either count, and no version of it has ever carried a mean-turn field — the only turn keys it has ever held are `min_turns` and `after_min_turns`. This is not a figure that went stale; it is a citation that never held, which is the larger failure of the two.
The counts were a REAL measurement of a DIFFERENT POPULATION, so they are corrected rather than called false: reconstructed at that commit they are a one-off pass over the UNION of the three raw, unfiltered stores as they stood on 2026-07-31 — a population the quality filter neither computes nor describes. `require_full_bring` in the artifact runs AFTER the bot, behavioural-bot, forfeit and min-turns rules; that measurement applied it to raw stores with none of them, which is why its counts are roughly four times the funnel's. The funnel's own answer is the one above: **18,908** kept and **7,234** dropped of the **26,142** that reach the rule, where the dropped count is the subtraction of two named fields and not a field itself.

**AND THE LENGTH RATIO IS WITHDRAWN RATHER THAN RESTATED.** ~~1.71x longer on average, 7.4 vs 4.3 mean turns~~ — nothing in this project measures a mean turn count today, and the reconstruction over the raw stores does not reproduce the published pair, so no ratio is published in its place. The length-conditioning CLAIM stands on its own, on the artifact's `rules.require_full_bring.known_limitation`; only its magnitude is withheld. It becomes quotable again when a pass through `engine/quality.js` over a pinned store writes a mean-turn field into `data/quality-filter.json` and something reads it.


### 4.5 SLOWKING — team-preview Nash and the playstyle cycle (suggestive)
`engine/slowking_preview.py` solves a matchup matrix to a mixed-strategy equilibrium and grades it by
**exploitability** (the worst-case win-edge a best pure counter extracts; lower is better; Nash ≈ 0),
against greedy "single best deck" and uniform baselines, with a bootstrap CI that propagates
matchup-count uncertainty (Beta resampling). Over GURU's 13 species-archetypes the equilibrium is far
less exploitable than uniform (Nash ≈ 0 vs 0.109), but greedy ≈ Nash because this meta is currently
near-transitive (a dominant deck). A **playstyle** re-analysis (`engine/playstyle.js` classifies each
team as TrickRoom / Rain / Sun / Sand / Snow / Setup / PerishTrap / TailwindOffense / FakeOutBalance /
Stall / HyperOffense) surfaces a non-transitive cycle — **TrickRoom → HyperOffense → Sand → TrickRoom**
— with a point exploitability gap of ~0.073 for greedy; the equilibrium now correctly leads with Sun (~31%), since Reg M-B Charizard is Mega-Y (Drought) and is classified as a Sun setter. **Honest caveat:** each cycle leg rests on only
13–18 games (win rates 73% / 71% / 67%) with 95% CIs that cross 50%, so the cycle is a **suggestive
pattern, not a settled fact**; it will sharpen as the store grows. Where matchups *are* well-sampled they tend to run flat against intuition — **Rain vs Sun is 51% (n=236)** and **Tailwind vs no-Tailwind is 47% (n=756)**, both statistical coin-flips. Reports `data/slowking-eval.json`,
`data/slowking-playstyle-eval.json`; test `tests/test-slowking.py`.

## 5. Mathematics

**Wilson score interval** (used for every matchup rate) for `w` wins in `n` games, `z = 1.96`:
`(p̂ + z²/2n ± z·√(p̂(1−p̂)/n + z²/4n²)) / (1 + z²/n)`, with `p̂ = w/n`. It is well-behaved at small
`n` and near 0/1, unlike the normal approximation.

**Value net.** Features `x = [alive_diff, hp_diff, my_alive, foe_alive, turn/10]` are standardised by
train mean/std; `P(win) = σ(w·z + b)`. Graded by held-out **log-loss** `−(y·ln p + (1−y)·ln(1−p))` and
**Brier** `(p−y)²`; the coin scores `ln 2 = 0.6931` and `0.25` respectively.

**Discrete choice — the scoring bot's policy (v3.28.0).** A player facing a turn chooses one of the
legal (move, target) pairs. Writing `x_j` for the attributes of alternative `j` — type effectiveness
against that specific target, base power, whether the move is already dead on the board, and the
behaviour clone's `P(move | species)` — the conditional logit model (McFadden 1974) is

`P(pick j) = exp(w·x_j) / Σ_k exp(w·x_k)`,

with `w` estimated by maximising `Σ_i [ w·x_{i,chosen} − ln Σ_k exp(w·x_{i,k}) ]` over **146,910** real
human decisions from **6,091** clean open-sheet games (117,824 train / 29,086 held out), with a
feature vector that has grown from 12 to **53**. The weights are **estimated, never written
down**, and the realism report is never consulted during fitting — it is held back as the
out-of-sample check, because a diagnostic stops being evidence once it becomes the objective.

Held out **by game** (decisions within a game are correlated — the same clustering argument as the
CIs below): logL/decision **−1.6006** and top-1 **33.6%**, against the behaviour clone alone at
−1.9302 / 27.1% and uniform at −1.7627 / 24.1%. Open-sheet games are used because they are the only
corpus in which the **choice set** is known rather than guessed: a normal replay reveals only the
moves that were *used*, so alternatives reconstructed from revelation are biased by revelation.

The model's known limitation is **independence of irrelevant alternatives**: logit implies the odds
between two options are unaffected by what else is on the menu, which fails for close substitutes
(the red-bus/blue-bus problem). A set carrying two moves of the same type is exactly that case.
Nested or mixed logit is the remedy and neither is implemented, so the fitted probabilities are a
good ranking and only an approximate distribution.

**Equilibrium and exploitability.** Each preview is a two-player zero-sum matrix game on an
antisymmetric edge matrix `M[i,j] = (p(i>j) − p(j>i))/2`. Regret matching (Hart & Mas-Colell) converges
to an ε-Nash. For a strategy `x`, **exploitability** `= −minⱼ (x·M[:,j])` — the worst-case loss to a
best response; the Nash value is 0, so a Nash strategy scores ≈ 0 and a predictable single-deck
strategy is punished.

**Confidence intervals.** Because per-turn states within a game are correlated, CIs are **bootstrapped
by resampling games** (clustered), not states. Matchup-matrix uncertainty is propagated by
**Beta(n·p+1, n·(1−p)+1) resampling** of each cell before re-solving.

**Future rating math.** For any descriptive meta-rating we will use an **intransitivity-capable** class
(blade-chest / low-rank bilinear, Chen & Joachims 2016; or Nash-averaging, Balduzzi et al. 2018) and a
**Helmholtz–Hodge / HodgeRank** decomposition (Jiang, Lim, Yao & Ye 2011) to split the matchup flow
into a transitive ranking plus a cyclic (rock-paper-scissors) component — the correct tool for "which
cores beat which" and for quantifying how cyclic the meta really is.

## 6. Limitations and honest ceilings

1. **The game-winner ceiling is permanent** (Elo ≈ coin). SLOWKING/ALAKAZAM are judged on decision
   quality and self-play/ladder win-rate, never on match-outcome prediction.
2. **Revealed sets are partial** (a mon that never attacked reveals no moves); belief is a lower bound.
3. **Small samples in the meta layer.** Playstyle and core matchups are thin; those results are
   suggestive until the store grows.
4. **Policy is the residual GIGO — and in 3.28.0 the binding constraint is the OBJECTIVE, not the
   knowledge.** The damage is validated. The policy now runs a real damage calculation and does
   decide switches — both were listed here as missing and both became false, and they are corrected
   rather than quietly dropped. What remains: **one ply**, no model of the opponent's move, no search.

   The sharper limitation is measured. Over 2026-07-30, **four separate feature additions produced
   four nulls**, while **two changes to the objective produced two large wins** — greedy action
   selection at +12 points (79.7% of decisive pairs) and self-play policy improvement at 55.9%. An
   overdispersion check across teams (~1.00, against 1.169 for a known real effect) rules out the
   obvious confound, so the nulls are genuine. Adding knowledge to an imitation-fitted policy has
   stopped paying.

> **RECONCILED 2026-07-31.** That 55.9% was measured on the **53-feature vector with switching OFF**. Repeating the experiment on the **56-feature vector with switching ON** gives **48.1%** [46.5, 49.8] over 9,728 paired games — a interval entirely below 50, i.e. self-play training made the policy *worse*. Both numbers stand as measurements of different configurations; neither generalises to 'self-play helps'. The difference is not explained, and three candidate causes are untested: switching exploration being harmful (consistent with the older 10-point switching loss), 36.5% drift over 18 iterations, or self-play eroding imitation-fitted features that were already good.

   The cleanest demonstration is the pair-scoring layer (DODUO), which is **built, wired, controlled
   and measured, and loses at 42.0%** [39.9, 44.3] over 1,934 seed-paired games against its own
   zeroed control. Its fit prices "use a spread move beside my own ally that does not hurt it" at
   **−5.054** — a statement that humans rarely click it, not that it is bad. Refitting those weights
   for *winning* rather than *resemblance* is untested and is the project's top open question.

   > **CORRECTED 2026-08-01, and this paragraph should no longer be cited as it stands.** The −5.054
   > was not a statement about human preference. `fit_joint.js` matched a human's click by requiring
   > the candidate's target to match, and a spread move is built with no target because it is not
   > aimed — so **no spread click could ever match**. Spread moves are 14.94% of all human move clicks
   > and 99.7% of them were thrown away; the fit used 24,997 of 82,483 joint turns, and the discarded
   > 70% was exactly the turns containing the play the feature describes. Refitted, the weight is
   > **+0.863**, and the corrected vector beats the shipped one at **66.7%** and **65.9%** of decisive
   > pairs on two disjoint seed blocks. DODUO's 42.0% was measured on the contaminated vector and does
   > not describe the current one. The imitation-versus-winning argument stands on its other evidence —
   > greedy action selection is worth about 12 points — but not on this example.

   A separate class of defect, worth naming because it is not a modelling disagreement: a fact
   reaching one consumer and not the next. Priority blocking lived in the tag artifact and never
   reached the simulator, so **Sucker Punch beat a Farigiraf in every rollout ever run**. A
   switch-in's own ability never reached the code that chooses the switch — over 40,001 matchups,
   declaring Intimidate, Drizzle or Drought moved the feature vector in **zero** of them against a
   control's 2,754. And every mega forme carried a null ability, an empty moveset and no item, so
   **26.0% of the format's usage scored as threatening nothing**. All fixed; a gate
   (`engine/artifact_audit.js`) now compares derived artifacts against their sources, because nothing
   had.

   Every `build_lab` win rate on record was measured against the older board-blind pilot and none has
   been re-run, so all of them remain provisional.
5. **Champions rule specifics** (sleep/paralysis edge cases) are flagged, not yet fully modelled.
6. **A result that does not record its own configuration is not reproducible, and three of the four
   rollout gates were in that state.** This is a methodological limitation, added 3.33.0, and it cost
   a published result. The R1 gate reported a PASS; recomputed from the only committed evidence it is
   **UNDECIDED**. No number was falsified. The row dump recorded
   `{gid, turn, p, mpy, y, aliveDiff, hpDiff}` and no sample size, no exploration rate and no build
   digest, so a dump taken at `explore=0` and a dump taken at `explore=1` were byte-compatible while
   the two configurations do not give the same answer. Only the surviving calibration shape
   distinguished them, in hindsight.

   **THE RATES AND INTERVALS THIS ITEM USED TO QUOTE ARE WITHHELD, 2026-08-22.** R1, R2 and R3 read
   artifacts downstream of MEDICHAM, and `node engine/status.js` names each one QUARANTINED. The
   limitation being described is about the CONFIGURATION RECORD and survives without them; a
   quarantined figure printed with a caveat beside it is the failure this section is about, one level
   up.

   Auditing the other rungs against the same standard produced two further findings. **The R3
   divergence gate publishes a rate and records no control.** Its own script computes
   the quantity that makes a divergence rate mean anything — the same search on a different seed
   disagreeing with *itself*, whose true value is 0 by construction — writes it to standard output,
   and does not store it; the script's verdict branches on that comparison, so the artifact cannot
   state which branch its own run took. At a rollout budget of N=20 that floor measured *higher* than
   the divergence it was meant to validate. **The R2 cost gate timed a leaf the system does not run**,
   inheriting library defaults of `explore=0` and a 20-turn horizon while the deployed leaf uses
   `explore=1.0` at 60 turns.

   The general statement is that a search is worth exactly what its leaf is worth, and a leaf
   measurement is worth exactly what its configuration record is worth. Every gate artifact now
   carries a sidecar (`engine/run_stamp.js`) recording the budget, the exploration rate, the horizon,
   content digests of every source the gate reads, the commit, and whether the working tree was dirty
   at the time. Artifacts predating the standard carry a stamp reconstructed from the commit that
   contained them, labelled as inferred rather than observed on every field.

7. **The headline metric has no current value, and that is the largest limitation in this paper**
   (added 3.62.2). §0 makes exploitability the number this project is judged on, and
   `data/exploitability.json` is declared void: the 2026-07-26 figure was fitted on 17 features
   against the 58 shipped, on an engine 25 wire-fixes old and before the quality filter existed, and
   the 2026-08-04 re-run had `data/policy-weights.json` — the defender itself — refitted at 22:15:24
   UTC while it was running. **So the comparison with VGC-Bench's ~100% is a comparison we have set
   up and not yet made.** Producing one figure requires training a best response against a frozen
   agent, which is expensive, and it requires the frozen-release discipline to hold for the whole
   run — the 2026-08-04 void *was* an exploitability run, so this is a demonstrated failure mode
   rather than a hypothetical one.

8. **Two speed readings of the same engine differ by an order of magnitude and nothing caught it**
   (added 3.62.2, §3.0). 3,401, 1,606 and 13,041 are three measurements of MEDICHAM's throughput
   taken over two weeks; the first two are battles/sec and the third is turns/sec, and no ratchet,
   test or artifact compares any of them. A project whose central architectural decision rests on a
   speed ratio should measure that ratio the way it measures a win rate. It does not, yet.

## 7. The road to ALAKAZAM

ALAKAZAM is the in-battle capstone, built last on the inputs above. Given a live position it will
output the win-%-optimal move (a mixed strategy) and its value by: (1) a **belief** over the opponent's
hidden sets (XATU), updated by a Bayesian filter; (2) **depth-limited search** over the validated
damage engine, solving each simultaneous turn as a **matrix game** (regret matching — this removes the
speed bias that inverted the greedy engine); (3) a **learned value** at the leaves (PORY, grown to an
NNUE-style net); (4) **human-anchoring** (KL-regularised to the behaviour-clone) so it stays strong and
unexploitable. Inference is light (CPU / Web Worker / WASM); the strongest version needs offline RL on
millions of human + self-play games and a rented cloud GPU. It is judged on decision quality and
self-play/ladder win-rate with CIs — never on predicting the winner. A self-play data engine (MEW) is
the pacing item toward the millions of games that path needs.

**Sequenced by the four phases (3.62.2, §0.3).** ALAKAZAM as described above is phase 3. It is
reached only through phase 1 (MEDICHAM complete — a search needs an engine that is both fast and
correct) and phase 2 (the gate: MILTANK untimed against MILTANK on the clock, ROADMAP #62, which
decides whether compute buys anything at all). If phase 2 says no, phase 4 replaces this road with
VGC-Bench's: behaviour cloning plus PPO under self-play, fictitious play and double oracle. That
branch is approved in advance and is a result about the game, not a defeat — and it is cheap because
the method is published and reproducible.

## 8. References

1. Zinkevich et al., *Regret Minimization in Games with Incomplete Information* (CFR), 2007.
2. Lanctot et al., *Monte Carlo Sampling for Regret Minimization* (MCCFR), 2009.
3. Moravčík et al., *DeepStack*, Science 2017. · Brown & Sandholm, *Libratus*, Science 2018.
4. Brown et al., *Combining Deep RL and Search* (ReBeL), NeurIPS 2020. · Schmid et al., *Player of Games*, 2021.
5. Angliss, Cui, Hu, Rahman & Stone, *VGC-Bench: A Benchmark and Strategy Suite for Competitive Pokémon Doubles Battling*, AAMAS 2026, [arXiv 2506.10326](https://arxiv.org/abs/2506.10326) — the only published work in this exact format; the source of the ~100%-exploitable finding and of the professional-beating result quoted in §0. · Grigsby, Xie, Sasek, Zheng & Zhu, *Metamon* (offline RL + large sequence models, no search), RLC 2025, [arXiv 2504.04395](https://arxiv.org/abs/2504.04395). · Full survey of the field, with what each project implies for this one: `docs/PRIOR-ART.md`.
6. Perolat et al., *DeepNash / R-NaD* (Stratego), Science 2022. · Vinyals et al., *AlphaStar*, 2019.
7. Meta FAIR, *CICERO / piKL* (human-regularised RL, Diplomacy), Science 2022.
8. Chen & Joachims, *Modeling Intransitivity in Matchup Data* (blade-chest), WSDM 2016. · Balduzzi et al., *Re-evaluating Evaluation* (Nash-averaging), NeurIPS 2018.
9. Jiang, Lim, Yao & Ye, *Statistical Ranking and Combinatorial Hodge Theory* (HodgeRank), 2011.
10. Wilson, *Probable Inference, the Law of Succession, and Statistical Inference*, JASA 1927.
11. McFadden, *Conditional Logit Analysis of Qualitative Choice Behavior*, in Zarembka (ed.), **Frontiers in Econometrics**, Academic Press 1974 — the discrete-choice model the scoring bot's policy is fitted with (§5).
12. the Smogon damage calculator — community damage ground-truth. · Pokémon Showdown replay API.

---

**Companion documents.** [Slide deck](ABRA-deck-plain-english.md) ·
[Technical documentation](ABRA-technical-docs.md) · [Model ledger](MODELS.md) · [Changelog](../CHANGELOG.md)

---

## The role family: multi-label composition, WAR, and emergent roles (v2.6.0)

### Motivation
The earlier playstyle model assigned each team exactly one archetype. This is a **multi-class** framing
of a **multi-label** object: a real team is Sun *and* Tailwind *and* Fake Out at once. Forcing one label
discards most of the information and shatters the data into archetype×archetype cells of n≈11–18, which
is why those matchup numbers were untrustworthy. The literature is explicit: multi-label classification
(Tsoumakas & Katakis 2007), team-as-mixture-of-latent-roles (topic models; Blei-Ng-Jordan 2003), and
latent roles beating raw identity for outcome prediction in team sports (arXiv 2304.08272).

### Role tagging (leak-free, data-earned)
We define 26 functional roles. A **species earns a role from data** — it is credited once it is observed
performing the role (≥2 times) across the store. Multi-effect moves carry several *factual* roles
(Matcha Gotcha = special+heal+status; Body Press = wall+attack; Fake Out = tempo, not attacker). Role
*presence* is binary; graded *strength* is deliberately **not** hand-set (asserting weights violates the
project's measurement standard). A team's role vector is built from the **team-preview six**, which are
public in every closed-sheet game, so the representation is uncensored and non-leaking.

Each ordered role pair (a, b) aggregates outcomes across every game where one side had a and the other
had b, with a Wilson score interval. Because roles co-occur, each game contributes to many cells, so the
**median cell rises from n≈15 to **n = 20** across 1,051 cells (measured 2026-07-25 on 1,061 quality-filtered games)**. The figure of 7,971 published in v2.6.0 was retracted in 2.7.0 as an artifact of over-tagging (19.6 of 26 roles per team); it has since gone 7,971 → 95 → ~50 → 20 as the taxonomy sharpened and the games were filtered — the structural fix. Empirically, however, a
logistic model on the preview role-difference vector predicts the winner at held-out log-loss 0.694 vs a
coin's 0.693: **roles describe and attribute, they do not predict.** The per-role coefficients are read
as **win-credit per role**; KO-credit per species is measured directly from the turn log.

### WAR — Wins Above Replacement (species RAPM)
To attribute wins to individual Pokémon while controlling for teammates and opponents, we use basketball's
**Regularized Adjusted Plus-Minus**. With one row per game, label y = 1 if p1 won and features
x_s = 1[s ∈ p1 six] − 1[s ∈ p2 six], a ridge logistic regression yields β_s, species s's adjusted win
contribution. Ridge shrinks rare species toward zero. With replacement β at the 20th percentile and the
logistic slope 1/4 at p = 0.5,

  WAR_s = 0.25 · (β_s − β_replacement) · (games s appeared).

Held-out, the species model reached log-loss 0.6875 against a coin's 0.6931 — a result now **withdrawn 2026-07-25** — that figure was measured on the UNFILTERED store; on quality-filtered games WAR scores 0.7048 against a coin's 0.6931 (accuracy 0.502). The apparent signal was four bot accounts playing one team in 1,446 games. It does not beat a coin: *which specific species* you bring at preview carries a small real signal that roles and raw
sheets do not. Leaders are Basculegion, Kingambit, Sylveon; trailers are negative. Effect sizes are small
and magnitudes ridge-shrunk — reported as an exploratory ordering, not settled wins.

### Emergent roles by NMF
Rather than hand-declaring roles, we factorize the data with **Non-negative Matrix Factorization**
(Lee & Seung 1999): X ≈ W H with W, H ≥ 0, so each team is a non-negative **blend** of latent roles and
each role is a recipe over features. Two cuts: (1) the team×move usage matrix (usage-weighted, which
down-weights the closed-sheet censoring skew) recovers **offensive cores** but is dominated by attacking
moves (relative reconstruction error 0.79); (2) the team×role matrix recovers **six clean archetypes**
(error 0.53): Intimidate+Fake-Out control, physical offense, special offense+sustain, bulky wall+screens+
redirection, Tailwind+Encore, priority. A move's loading on a role is **learned, not typed** — this is the
principled source of graded primary/secondary strength (Label Distribution Learning, Geng 2016). The rank
and the human names are the only non-data choices. Reconstruction error is **not** comparable across
weightings; the correct model-selection criterion is **topic coherence** (Mimno et al. 2011), noted as the
next refinement.

### Honest limits
Preview-composition signal is small; role-level winner-prediction ties a coin and WAR barely clears it.
Role tags are a censored lower bound on capability (closed sheets reveal only used moves). NMF factors are
soft and attacker-dominated at the move level. None of these is hidden; each is reported with its baseline.


## The coverage job lands, and the plan that drives it is amended (3.40.0)

Three results, each read from its artifact.

**The engine.** Wires 82–89 landed: the pre-turn shield class (Focus Punch / Beak Blast), the
variable-power family, per-hit reactors, priority blocking across every move kind, Memento,
drain-before-contact-toll order, the Steel Roller terrain gate, and secondary chances read from the
FORMAT's rulebook with a drift counter. `data/mechanics-census.json` moved 167 → **181 live of 186
probed, 5 missing with reasons**; the interaction matrix moved 68 disagreements → **13** (1,012 live
carrier × reactor cases, 999 agree, 98.7%); the Showdown damage differential stands at 1/150, and
the one row is a documented harness-layer artifact (Disguise), not an engine defect. Every new probe
was demonstrated red against a deliberately broken in-memory engine before its green was believed.
Shell Trap, flagged as entirely untagged, is `isNonstandard: 'Past'` — banned in this format; the
missing tag is the format door working.

**The two-rulebook question, measured before it was architected.** `data/tags.json` and
`CHOMP/data/move-effects.json` state overlapping move facts. Compared field by field
(`data/rulebook-collision.json`, a ratchet that may fall and never rise): 151 comparable facts, 149
agree, **2 clashes** — and the live one was Iron Head's flinch, where the tags copy carried the
Champions format's 20%, the generic copy carried 30%, and the engine read the wrong one. Wire 89
closes it at the consumer. The unified-generator layer of the coverage plan is therefore insurance
rather than urgency; the real exposure is the facts the comparison cannot yet reach — **27 tag-only
and 166 fx-only**, read from that artifact's own `not_compared` block rather than summed in prose.
*(This stated their SUM until 3.70.0. That sum appears in no artifact; it passed the currency check
only because the same numeral happened to occur somewhere inside `data/tags.json`, and it went red the
moment that file was regenerated. A figure that traces by coincidence does not trace.)*

**The fitting gap below is now half closed.** The sheet-channel section that follows reported that
the fit discarded the ability and moves the live player sees; the decision it asked for was made
(open team sheets always, closed sheets deferred), and the single-move layer (MAG) is refitted on
all four channels: 232,815 usable decisions of 241,927 seen at 3.42.0 (231,722 at the 3.40.0 fit,
before the click-censoring pass removed 1,336 actions that were not clicks), with a point-of-use
counter showing the declared channels
reached the board on 99.67% of scored decisions — an environment match stated by measurement, not
by diff-reading. The pre-refit weights are preserved and the two-channel incumbent is frozen as a
release (`d3d04b669e18`) for the pending paired held-out comparison against the 0.192-point noise
floor. The joint (pair) layer is **not yet refitted**; until it is, the pair layer still prices
against the two-channel board, and no improvement claim is made for either layer.

Separately, the coverage plan itself was re-examined at Will's request and amended where the
re-examination found it wrong — mutation testing now precedes the handler registry (the original
stub defense routed stubs into the one bucket the consumption ratchet deliberately never guards),
mutation operators gained per-param perturbation and a derived-set rebuild hook, and the planned
58-dimension exploitability re-run is cancelled by measurement: a step-rule probe against a planted
optimum showed one accepted step is worth 0.202 win-rate points against a 4.77-point resolution at
the affordable budget, so the search moves to a 4–8-parameter reparameterization first. The full
argument is `docs/COVERAGE-PLAN-REVIEW.md`. ABRA continues to have **no exploitability number**;
`data/exploitability.json` remains void.

**Taunt was not implemented, and the largest disagreement by pair volume was an engine fault rather
than a harness one (3.50.0).** The generated interaction matrix's disagreements were ranked by CARRIER
uses x REACTOR uses — the pair's real frequency, not the carrier's — and the head of that list was
`Taunt`, which appeared in twelve rows. The engine wrote the volatile, decremented it, and read it
nowhere, so a Taunted body still landed Hypnosis, Decorate, Strength Sap and another Taunt; Showdown's
two handlers (`onDisableMove` at selection, `onBeforeMove` at execution) are now both wired off one
derived table, `volatile -> the move category it refuses`. The row ranked #1 by volume,
`partingshot -> throatchop`, had been filed as a probable staging artifact on the strength of a
species mismatch; it was the engine — a pivot MOVE was given the bare-switch priority, so Parting Shot
out-sped everything and its replacement, not its user, took the incoming attack. Known disagreements
fell from 94 to 72 (19 inside the scored set, 53 in buckets the gate discards). The census rose
211 -> 216 live of 219 probed; the damage differential did not move.

**The mutation tier's defect count was wrong in the direction that inflates it, and the correction is
recorded rather than quietly applied (3.49.1).** The full sweep reported 97 DEFECT-CANDIDATE operators
and an open total of 340; the two highest-usage rows were checked by hand and **both were false
positives**. `damageMultAll / lifeorb` reads the tag for the damage and branches on the item's *name*
only for the recoil — latent, not live. `halvesDamage / lightscreen` is not a defect at all: the engine
ignores the tag's `mult` deliberately, because the artifact carries the singles value 0·5 and this is a
doubles engine where the reduction is 2732/4096. A mutation verdict says what *moved*; it cannot see a
deliberate override. The triage now grades every open operator **A/B/C/D from a parse of the frozen
engine source** — A, no lookup for the tag and no branch on the carrier's name; B, the param is
overridden by the engine's own constant; C, the behaviour is hardcoded by name; D, the param is read
and this battery could not move it. **Nought of the 97 is class A.** The ratchet counts class A only
(163 operators, 56 carrier × tag rows), because a number that counts false positives is a number
people learn to ignore. Class A is *not* a count of missing mechanics — it says the fact reaches the
simulator neither as a tag nor by name, and a third route (`mv.rc`, `data/move-effects.js`, an action
kind) can still carry it — so the census's `armed` field is the second sort key and 49 of the 56 rows
have no armed probe. The rule is gated on three cases decided by hand before it existed (Taunt A,
Light Screen B, Life Orb C) and refuses to publish if it cannot reproduce them.

## Outplayed turns are not noise: the click-censoring fix (3.42.0)

The policy fits learn from human clicks reconstructed out of replay logs. The log records what
**happened**; the fit needs what was **clicked**. Some recorded actions were never clicks at all and
were being fitted as though they were; the classifier that decides which is which is measured
separately against the protocol's own annotations.
**THE SIZE OF THE CORPUS, THE SIZE OF THE CENSORED SLICE AND THE CLASS SHARES ARE ALL QUARANTINED —
they are withheld, not annotated.** `data/policy-weights.json` and `data/click-censoring-census.json`
are both downstream of MEDICHAM: their generators `engine/fit_policy.js` and `engine/click_census.js`
sit in the play layer and reach `engine/medicham2-browser.js` through `require`, so the corpus counts
are counts of games this simulator could build a board for. MEDICHAM is not correct —
`node engine/status.js` names the failing clauses. No action count, no game count, no censored share
and no per-class table is carried in its place, and the absence may not be read as a claim that the
slice is small. They become quotable again when the gate opens AND these are re-run:
`node engine/fit_policy.js` and `node engine/click_census.js`. What survives without a figure is the
MECHANISM, which is a fact about the protocol rather than a measurement.

The census has been taken three times as the store grew and the class shares were stable across all
three, which is why it can be re-run without re-arguing the fit. The shares themselves are withheld
here for the reason above; the earlier readings stay where they were published, in `CHANGELOG.md`
3.42.0 and 3.47.0.

Both coerced classes were **invisible to every counter in the project**. The move Encore forces out
is on the victim's own legal menu, so the matcher accepted it; and `|drag|` is stored with the same
shape as `|switch|`, so a phazed arrival read as a voluntary switch decision. This is label noise,
and learning with mislabelled examples is strictly harder than learning with missing ones
(Natarajan, Dhillon, Ravikumar & Tewari, 2013). It is also **Missing Not At Random** in Rubin's
(1976) sense — the corruption lands precisely on the turns where the opponent's play worked.

Coerced actions now leave the labelled set and are counted. Redirected attacks are kept under the
**partial-label** likelihood (Cour, Sapp & Taskar, JMLR 2011): the contribution is the marginal
`log Σ_{c∈C} P_w(c | board, choice set)` over the candidate set, fitted by Generalized EM (Dempster,
Laird & Rubin 1977; Neal & Hinton 1998), where the E-step is the responsibility `q_c = p_c / Σ_{C}
p_{c'}` and the M-step is the existing conditional-logit gradient on `q`-weighted rows.

**The estimator was validated on planted weights before the refit ran.** Real corpus feature rows,
synthetic labels drawn from a known `w*`, the real censoring process applied to those labels, three
seeds (`data/partial-label-em.json`):

| regime | rows censored | ‖ŵ − w*‖₂ oracle | naive | EM | noise floor |
|---|---|---|---|---|---|
| heavy, systematic | 20.96% | 0.9978 | **1.8913** | **1.0208** | 0.2600 |
| the corpus's own rate | 0.44% | 0.9978 | 0.9948 | 1.0021 | 0.2600 |

EM recovers **97.4%** of the censoring bias where the naive fit is visibly wrong, and at the rate the
corpus actually censors the bias is **−0.0030 against a 0.2600 floor** — inside the noise.

**THE PAIRED HELD-OUT RESULT IS QUARANTINED — every figure it carried is withheld, not annotated.**
`data/censoring-value.json` is downstream of MEDICHAM: its generator `engine/censoring_value.js` is in
the play layer and reaches `engine/medicham2-browser.js` through `require`, so the held-out decisions
it scored were scored through a simulator the gate does not certify. MEDICHAM is not correct —
`node engine/status.js` names the failing clauses. No sample size, no per-class effect and no
confidence interval is carried in its place, and no direction may be inferred from the absence — in
particular this document does NOT here claim that the correction helped, that it did nothing, or that
it hurt. The earlier 3.42.0 reading stays where it was published, in `CHANGELOG.md` 3.42.0 and
`docs/MEASURE.md` §14, as history rather than as a current figure. It becomes quotable again when the
gate opens AND this is re-run: `node engine/censoring_value.js`.

Read plainly: **the verdict is withheld with the figures it rested on.** What is NOT withheld is the
justification for the fix, which never depended on the measurement: a wrong label is a wrong label,
and the redirection class was always small enough that its own validation predicted almost no bias to
remove. No corpus-wide top-1 improvement was ever claimed for it.

The mechanism is legible in the refit: of 58 weights, 9 moved past 2 SE and the largest single
movement is `stallIntoEncore` — *"I am about to Protect and something across from me can Encore me
for it"* — at **−1.0502 → −1.6281**. The poisoned rows were victims "choosing" their last move under
an active Encore; deleting them makes clicking into an Encore threat look worse, which is the
direction the mechanic predicts.

**Three limits, stated.** (i) The two vectors also differ by 86 games of corpus growth and by the
refit itself, so the attribution rests on the weight-movement pattern rather than on an isolated
control; `CENSORING=off` exists to run that control and has not been run. (ii) Priority-blocked
attempts (Armor Tail, Queenly Majesty) are recoverable — the protocol names the attacker and the
move in **299 of 299 cases (100.0%)** — but live only in raw logs covering 67.23% of the corpus, and
the missing third is one archive, so recovering them would reweight the sample by source. (iii)
`board.js` narrows the choice set for a Choice item and not for the `onDisableMove` family, so
**a measured fraction of logged actions** were priced against a menu that had already shrunk — a wrong
denominator rather than a wrong label, and a separate refit. *(The counts once printed here were from a
census superseded on 2026-08-06 when `engine/click_census.js` was given an explicit corpus scope. They
are NOT restated, because the artifact that would restate them — `data/censoring-value.json` — refuses
to regenerate: both weight vectors were fitted under the pre-WIRE-114 engine, so re-scoring them
through the current one would measure the censoring change plus three wires at once. It clears with the
refit. Read `data/click-censoring-census.json` for the current class counts.)*

## A degenerate signature: when every arm of a controlled probe returns the same integer (3.56.0)

The accuracy subsystem was probed with the instrument this division already had — stage the mechanic,
stage its absence, run both, difference the result. Six arms over four mechanics, ~5,000 combined uses
in the store:

| arm | with | without |
|---|---|---|
| Coil (`+1 accuracy`) | 0 | 0 |
| Minimize (`+2 evasion` on the target) | 258 | 258 |
| Wide Lens (`×1.1`) | 0 | 0 |
| Bright Powder (`×0.9`) | 116 | 116 |
| Sand Veil, in sand (`×0.8`) | 115 | 115 |
| No Guard (`accuracy → true`) | 0 | 0 |

**Exact equality across every arm is a stronger signal than a wrong number, and it is a different
one.** A miscalibrated modifier produces a difference of the wrong size; a difference of *identically
zero*, repeated over four independently-implemented mechanics, is evidence about the **path**, not the
**parameters**. Section *"A mechanic that fires everywhere"* (3.44.0) records the mirror-image
signature — a rule firing on 100% of a population it should split — and both are instances of the same
diagnostic: read the *distribution* of the controlled difference, not its mean.

Three unrelated defects were on that path, which is why no single hypothesis explained all six arms.
(i) The Showdown→engine stat map sent `accuracy` and `evasion` to `null`; eleven boost appliers key
off that map, so a payload of `{atk:+1, def:+1, accuracy:+1}` applied two of its three components and
reported success. (ii) No item or ability was consulted for accuracy at any call site. (iii) The roll
called `moveAccuracy(id, field)` — **a signature that admits no attacker and no defender**. Defects
(i) and (ii) are omissions and are ordinary; (iii) is a *type-level* impossibility, and it is the one
worth generalising from: a function whose parameters cannot express the question is unfalsifiable by
any test that only checks its output. The census had graded the accuracy family LIVE on exactly that
basis for as long as it had existed.

The repair is one authority, `hitChance(att, def, id, field, ctx)`, called at all four to-hit sites,
with `printedAccuracy` preserving `true` (never-miss) as distinct from `100`, the standard (3+n)/3
Gen-III+ stage table [Bulbapedia, *Accuracy*], and the roll relocated **below** target resolution so a
defender exists to interrogate. Direction is not hand-typed: `ACCURACY-MODIFIER CONFORMANCE` re-derives
all 12 handlers from the live format object and takes sign from the hook name — 12 handlers, 13 rows,
**0 disagreements**.

Separately, `Substitute` deducted 25% of the user's HP through the generic `costsUserHP` path and
created no substitute: `playerAction` resolves the move to `kind:'affect'`, so the `kind==='sub'`
branch added in WIRE 42 was unreachable at the time it was written. 1,976 clicks in the store of an
action **strictly dominated by passing** — a rare case where the correct baseline is not "a slightly
worse policy" but "a negative-value action no rational agent takes", which makes any policy fitted
over those turns miscalibrated in a *direction*, not merely in magnitude.

The bypass rule is likewise derived rather than reasoned. The intuitive encoding — *sound moves pass
through a substitute* — is true and insufficient: the three highest-usage bypassing moves in this
format are **Encore (4,848), Taunt (1,503) and Disable (730), and none carries the `sound` flag.**
`SUBSTITUTE-BYPASS CONFORMANCE` re-derives `bypasssub` across all 500 moves: **51 carried, 0 missing,
0 invented.** The general principle is the one this project states as *flags feed tags; match on tag
shape, never on a name* — a semantic proxy for a mechanical flag will be right on the examples that
motivated it and wrong on the tail that matters.

**Reported rather than closed.** Five tags are *absent*, not unprobed, and are declared with usage
counts instead of being probed red — gate (c) ratchets on "every probe MISSING", so a red probe would
have broken a ratchet to record a fact the (b) column already records. The largest, `ability|auraBoost`
(5,663 uses), is a **representational** limitation rather than a missing branch: the multiplier is
field-wide over the full roster and `dmgRange` is given two bodies and a field. Wiring it changes a
`board.js`-facing input and is therefore a design decision, routed as one.

## A mechanic that fires everywhere is not a mechanic that works (3.44.0)

Psychic Terrain refuses priority moves. The simulator knew that, and had known it since the tag
artifact was first read. What it did not know is that the refusal only applies to a **grounded**
target — so `priorityRefusedAbove` applied the terrain bar *outside* its own defender loop, without
inspecting a single body:

```js
for (const d of (defenders || [])) { /* the ability bar */ }
if (field && terrainId(field.terrain) === 'psychic') out = Math.min(out, 0);
```

The cost is concentrated on the most-clicked move in the format. **Fake Out (12,872 corpus uses)**,
along with Extreme Speed, Sucker Punch, Aqua Jet, Ice Shard and Upper Hand, failed against every
Flying type, every Levitate body and every Air Balloon whenever a Psychic Terrain was up.

The expected behaviour was taken from the official engine rather than from anyone's memory. Playing
Incineroar's Fake Out into a Psychic Terrain raised by the opposing Indeedee's Psychic Surge, at the
pinned commit under `gen9championsvgc2026regmb`:

| target | official engine | damage |
|---|---|---|
| Garchomp, grounded | `-activate move: Psychic Terrain` | 0 |
| Orthworm, Earth Eater | `-activate move: Psychic Terrain` | 0 |
| Talonflame, Fire/Flying | `-hint` *"doesn't affect airborne Pokémon"* | 237 → 216 |
| Hydreigon, Levitate | `-hint` *"doesn't affect airborne Pokémon"* | 251 → 233 |
| Talonflame + Iron Ball | `-activate move: Psychic Terrain` | 0 |

Two findings sit underneath the fix and matter more than it does.

**The predicate existed three times, and none of the three was the one that mattered.** Grounded-ness
was written by hand in the entry-hazard block, in the switch-trapping branch, and in the Grassy
Terrain heal — three copies that disagreed with each other about Iron Ball and about Eelevate. This
is the failure mode CLAUDE.md names *facts are global*: the Grassy Terrain copy applied only the
type half of the rule and **counted its own known-wrong half** in a failure counter. Somebody knew it
was wrong, declared it, and the declaration outlived the reason for it — the derivation it said was
unavailable had landed a release earlier. One `isGrounded(mon)` now answers the question for all
four sites.

**The census could not see the defect, because a scope is not a knob.** The existing probe for this
mechanic stages the block against a Garchomp, which is Dragon/Ground. It passes on the broken engine
and on the fixed one. Every instrument in this division asks whether a mechanic *fires*; none asks
whether it fires *only where it should*, and this is the fourth defect of that shape in two days. The
replacement probe carries five arms, and the reason for each is that a smaller probe would have
passed on some specific wrong engine — including an **Earth Eater** arm, which is the reason the
airborne ability set is a name rather than a shape read. The tempting artifact shape,
`typeImmunity {type: 'Ground'}`, has three members: Levitate, Eelevate **and Earth Eater**. Orthworm
is immune to Ground and firmly on the floor, and the official engine says so.

Mechanics census **210 live of 213 probed**, 3 missing with written reasons, 0 hollow.

## The matrix’s own arithmetic is closed, and the coverage figure moves (3.43.0)

The interaction matrix is this project's largest conformance instrument, and until this release
nothing checked its arithmetic. It printed a theoretical cross product, an emitted count and a
ledger of named drops four lines apart, and **no code compared them**. They did not agree.

The identity is `theoretical === staged + dropped`, per axis, and it is now asserted at generation
time rather than printed for a reader. It found three defects on its first run:

1. **The denominator omitted the generator's own supplementary keys.** `tests/interaction_matrix.js`
   stages against `tags.linkage` MERGED with keys it derives itself; the theoretical total counted
   only the artifact's. 170 pairs were staged or dropped against a universe that had never heard of
   them. Theoretical **8,506 → 8,676**.
2. **The type axis mis-costed its depth-cap tail by one.** The index was incremented before the cap
   was tested, so the tail excluded the very carrier the break was rejecting — 32 firings, 32 pairs
   of silence, in the direction that *flatters* the coverage rate.
3. **The outcome buckets were not a partition.** `saturated` did not exclude a case that had thrown
   and `ko_timing` excluded nothing, so four cases were counted twice and the five printed totals
   summed to more than the number of cases run.

With the ledger closed, the generator recovers pairs it had been dropping unnamed: emitted
**1,514 → 1,675**, live **899 → 1,031**.

**The headline agreement figure falls, and that is the instrument working.** The matrix reports
**1,027 of 1,031 (99.6%)**, where the previous release reported 899 of 899 (100.0%). MEDICHAM did not
regress: the four disagreements — Shield Dust against Fake Out, Throat Chop and Psychic Noise, and
Steadfast against Upper Hand — sit on pairs the smaller generator never emitted. A 100.0% computed
over a denominator that silently dropped 5,090 pairs was the less honest number. The four are
`UNWIRED` rather than miscalculated: MEDICHAM's own two arms are identical on each, meaning the knob
is absent rather than wrong.

The self-test is the point. `--selftest-reconcile` mis-costs exactly one drop by one pair — the
smallest lie the ledger can tell — and requires the identity to stop the run. The file previously
carried a header stating that the assertion fires; the assertion was defined and never called.

## Layer 0 executes; the joint layer refits; the channel value is measured (3.41.0)

Same night, three division runs later. **Engine:** Layer 0 of the coverage plan is done — census
**202 live of 205 probed, 3 missing with reasons**; interaction matrix **100.0%** (899 cases after
retiring four redundant tags shrank the generated set from 1,012 — the retired facts live on under
their surviving tags); the DEAD-tag ratchet fell **61 → 38**; the 26 orphan ability/item tags are
triaged with a full disposition table in ENGINE.md. Two real bugs surfaced in passing and were
fixed with probes shown failing first: the Intimidate retaliation arithmetic (Defiant read net +2
where the game gives +1; Competitive skipped the Attack drop) and Sheer Force missing its ×1.3
while its secondary-suppression half worked — strictly worse than no ability. The mutation tier's
injection point (`__setDB` plus the derived-set rebuild hook the amended plan requires) landed and
was exercised 26 times by the probe-red-demonstration harness.

**Measure:** the JOINT layer is refitted on the four-channel sheet — 95,886 usable joint turns,
channel-reach counters at 99.7%, feature semantics verified — closing the second half of the
fitting-environment gap. The held-out channel-value measurement ran A/B/C against the frozen
two-channel incumbent (release `d3d04b669e18`), 44,982 paired decisions, 10,000 game-bootstrap
resamples:

| paired difference | logL/decision | top-1 points |
|---|---|---|
| information alone, weights frozen | **+0.002853** [0.001611, 0.004072] | +0.009 [−0.140, +0.157] |
| refit, given the information | **+0.002234** [0.001638, 0.002831] | +0.165 [0.029, 0.299] |
| everything vs what shipped | **+0.005087** [0.003854, 0.006331] | +0.173 [−0.011, +0.360] |

Split-half noise floor of the shipping arm: **0.331 top-1 points** (median, 20 cuts). The honest
reading: the sheet channels buy a real per-decision likelihood gain — every logL interval clears
zero — and **no demonstrable top-1 gain**; the one clearing interval is half the noise floor and
resolves only because the comparison is paired. The first measurement attempt self-voided when the
engine moved mid-run and was re-run clean — the release discipline working as designed.

**And the tags regeneration was gated the way the rules demand:** after the staged derivations
landed in `data/tags.json`, `feature_fixture --check` confirmed both fitted weight vectors still
agree with `board.js` on every fixture board — the new tags moved zero of the 58 feature columns,
so the night's fits stand unre-run.

## Measuring an engine that is being edited (3.36.0 – 3.39.0)

### A refit that bought nothing, reported as such

The feature function was wrong about the weather on 10.72% of turn-boards: `engine/board.js` carried a
private weather map that recognised Desolate Land and Primordial Sea — neither of which this format can
produce — and did not recognise **sandstorm or snowscape**. Routing both reads through the engine's own
exported `weatherId` moves **14 of 58 feature columns**, and touches a small single-digit percentage of
vectors and decisions — consistent with the sand/snow share of the corpus. *(Exact counts withdrawn
2026-08-06: they were computed against a corpus superseded the same day, and the vectors they describe
are among the three whose MEANING changed under the mega work — `switchSurvives1`, `switchKOSlow`,
`switchDiesFirst`. They come back with the refit, measured, not restated from here.)*

Paired per decision on the same 46,162 held-out decisions across 1,772 games, bootstrapped over 10,000
game resamples:

| paired difference | logL / decision | top-1 points |
|---|---|---|
| fix alone, weights frozen | **+0.000348** [0.000075, 0.000623] | **+0.048** [0.009, 0.093] |
| the refit, given fixed features | −0.000076 [−0.000172, +0.000021] | −0.074 [−0.155, +0.004] |
| everything vs what shipped | +0.000273 [−0.000010, +0.000556] | −0.026 [−0.117, +0.064] |

Split-half noise floor for the refitted arm, 20 cuts: **median 0.192 top-1 points**. The fix is
detectable *only* because the comparison is paired, and it is a quarter of that floor. **Refitting bought
nothing** — the interval contains zero on both metrics, 1 of 58 weights moved beyond 2 SE, and the L2 of
the whole weight change is 0.216. The fix was worth making because the feature function was wrong about
the game, not because a metric improved; it did not need one and it did not get one.

### The fitting environment is not the playing environment, and the gap is 20× the defect above

`engine/fit_policy.js:376` hands the board `{nature, item}`. `engine/magnemite.js:522` — the live
player — hands it `{nature, item, ability, moves}`. Over 14,400 sheet entries in 1,200 games, **100.0%
declare an ability and 100.0% declare four moves**, and the fit discards both.

| | weather defect | sheet-channel gap |
|---|---|---|
| vectors that move | 1,768 (0.75%) | **WITHHELD** (see below) |
| decisions that move | 892 (2.78%) | **WITHHELD** (see below) |
| feature columns | 14 of 58 | **20 of 58** |
| games touched | 238 (19.83%) | **1,197 of 1,200 (99.75%)** |

> **TWO FIGURES WITHHELD 2026-08-15, AND THE REASON MATTERS MORE THAN THE NUMBERS.** The two cells above
> read **37,460 (15.95%)** and **16,177 (50.47%)**. **No artifact in this repository backs either
> one** — `37,460` occurs in no file at all, and `16,177` occurs only in unrelated artifacts it has
> nothing to do with. They are withheld rather than captioned, because
> [CLAUDE.md](../CLAUDE.md) is explicit that a caption is not a quarantine and printing a figure with a
> caveat is the bug.
>
> **They were not caught by the currency gate for an unknown length of time, and the reason is a
> COLLISION.** `data/tags.json` happened to carry `"uses": 16177` for an unrelated tag, so the check
> "does this number appear in an artifact" answered yes. Regenerating the tags on 2026-08-14 moved 233
> usage counts with the store, the coincidence evaporated, and the figure surfaced as untraceable. **It
> never had a source; it had a coincidence.** A traceability check that matches on a bare number will
> do this again, and that is now a register row rather than a footnote.
>
> The surrounding claim is NOT retracted: `engine/fit_policy.js:376` hands the board `{nature, item}`
> while `engine/magnemite.js:522` hands it `{nature, item, ability, moves}`, and the 100.0% / 100.0%
> sheet-declaration rates above are separately sourced. What is withheld is the SIZE of the resulting
> gap, which needs a run that leaves an artifact.

The choice set is identical game for game, so this is purely what the board *knows*. **Half of every
decision the fit trains on is priced against a board the player does not see.** This is CLAUDE.md's
fitting-vs-playing rule broken a second time and in the **opposite direction** from 2026-07-28 — the bot
now sees *more* than the fit — which is precisely why nothing was watching for it. Not landed: it is one
line plus a full refit, and it first needs a decision about the games where the opponent declines open
team sheets, since a model fitted on four channels degrades differently from one fitted on two.

### Interactions, generated rather than sampled

8,795 theoretical carrier × reactor pairs; 2,300 staged; **1,634 that can genuinely co-occur**, where
co-occurrence is decided by the reference engine's own two arms differing rather than by our judgement —
so "correctly blocked" stays distinguishable from "silently absent". The engine agrees on **1,614 of 1,634
(98.8%)**. Every pair the generator refuses is counted under a named reason and printed on each run. The
156 ordered persistent-field pairs each become an 8-turn script, which is the only construction that can
observe *Trick Room was already up when Tailwind landed*; that axis went from 30/156 to **156/156**.

### Validity: a measurement reads a frozen release

Three division agents ran concurrently with their files separated, and a 7,100-game exploitability run
was still destroyed: the defender's own weight vector was refitted between the two legs, and the
simulator showed four distinct content digests inside eight minutes. Nothing failed and nothing crashed.

The correction is not scheduling — serialising the divisions forfeits the parallelism they exist for.
A measurement now opens an **immutable snapshot** (`engine/engine_release.js`) of every file whose
content can change a reported number, the weights included, and reads those bytes rather than the live
tree. The membership of that set is declared as `SOURCES` in `engine/engine_release.js` and is read
from there, never counted in prose: this sentence said **twelve** until 2026-08-22 and the declaration
had grown well past it, each addition made because a release that was a valid digest set turned out
not to be a loadable — then not a runnable — engine. It is a copy and not a checksum: verifying digests afterwards establishes only that the run was
wasted. `engine/provenance.js` correspondingly stopped deciding staleness by **mtime** — the method this
project's own rules discredit by name — and now compares content digests, honours a self-declared
`void: true`, and prints how many artifacts still rest on timestamps alone (**0 verified, 92 by mtime**),
ratcheted downward. On its first run the content check caught a rollout artifact computed against a
version of its own generator that had since changed.

**Consequently ABRA publishes no exploitability figure.** The prior 63.2% [56.6, 69.3] is retracted on
its own merits — 17 features against the 58 shipped, an engine 25 wire-fixes old, computed before the
quality filter existed — and the re-run is void. One figure from the void run survives, because both of
its legs fall inside a single stable window: the mirror control at **49.7% [46.2, 53.2]**, n=782, which
retires the concern that an earlier 47.5% indicated a seat or pairing asymmetry rather than noise at
n=217. A separate finding stands independently of the invalid tree: the attack **dies in 58 dimensions**,
accepting 1 of 24 hill-climb steps against 10 of 18 at 17 features, so the step rule needs correcting
before the re-run is worth its cost.
