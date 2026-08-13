# Changelog — ABRA

All notable changes to ABRA are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Rule.** Every change is logged here in the same pass as the code, together with the matching
updates to the white paper, the deck, and the technical documentation. A prior conclusion is never
silently rewritten; what changed and why is stated.

---

## [5.15.0] — 2026-08-13

### Fixed
- **A PRINTED-100 MOVE TOOK NO ACCURACY DRAW, SO THE `acc` STREAM WALKED OFF THE AUTHORITY'S
  (ROADMAP #264).** Will: *"even if a move is 100 accuracy it could still miss due to evasion, bright
  powder, sand veil, etc"*, then *"we gotta roll anyway"*. **Half the row was already true and
  measuring first is what stopped a fix for a bug that was not there**: `hitChance` has always
  returned the FINAL accuracy and the roll sites have always gated on it, so a printed-100 Ice Beam
  into a +2 evasion body missed **38.3%** here against the authority's **38.8%** over 400 real
  battles, and into a Bright Powder holder **9.7%** against **10.3%**. What was absent was the probe.
  - **THE REAL DEFECT WAS THE DRAW, AND IT WAS WRONG IN BOTH DIRECTIONS.** `hitStepAccuracy` ends in
    `if (accuracy !== true && !randomChance(accuracy, 100))`, so the authority draws for EVERY
    accuracy that is not literally `true` — counted, by wrapping the method and counting `prng.random`
    inside it: 1 draw at 100, at 133 (a Coil), at 110 (a Wide Lens), at 60 and at 90; **0** for
    `accuracy: true` and for No Guard. This engine gated the attack and stat-change sites on
    `acc < 100` (so a Coil or a Wide Lens stopped drawing) and rolled UNCONDITIONALLY at the two
    status sites (so a Poison-type's Toxic and a Lock-On drew where the authority does not).
    `accMustRoll(acc)` is now one answer for all four sites and it is `isFinite(acc)`.
  - **THE CHEAP-PREDICATE VERSION WAS BUILT, MEASURED AND THROWN AWAY.** "Skip the draw when nothing
    could have moved the accuracy off 100" is a measured REGRESSION: middle-arm VOID (per-category
    draw counts differ) **131/171 before, 133 with the predicate — worse than doing nothing — and
    100 with the authority's rule**; usable games **40 -> 71**. It is worse because the status sites
    already drew and the predicate took those draws away.
  - **AND THE SPEED PREMISE DOES NOT SURVIVE MEASUREMENT.** The skip never avoided the pipeline —
    `hitChance` (the artifact read, No Guard, Lock-On, the Toxic exemption, the OHKO tag, the stage
    arithmetic, Gravity, the att/def x ability/item walk) runs unconditionally at every roll site and
    always did; the guard sat underneath it, saving one LCG step against a ~270-microsecond turn.
    Three interleaved rounds of 6,000 scripted turns: pre-#264 1635/1627/1676 ms, predicate
    1602/1664/1696, shipped 1638/1640/1692 — the within-variant spread exceeds the between-variant
    spread and a different variant is fastest each round.
  - **Census 565 -> 567 live / 0 missing**, 0 hollow, 0 unarmed, 0 direct-call. Four deliberate
    breaks shown RED first. `tests/test-engine-diff.js --n 6000`: 0/6000 disagree, both corners.
  - **The corner arms cannot see this, and that is now measured rather than suspected.** Two frozen
    releases differing in **exactly one file** (`bdf8caedee59` -> `cbb3e287ac8d`), 200 games:
    top-tie-first 53/171 and bottom-tie-first 59/171, **identical before and after** — the pins force
    the accuracy die to a constant, so an extra draw from it is not observable.
  - **`engine/game_differential.js` needs a re-wording and did not get one here** (MEASURE owns it):
    its PIN_CLAIMS say *"a 100-accuracy move HITS"* while asserting `chance(100, 100)`, which is a
    claim about a FINAL accuracy of 100, not a printed one. Nothing is mis-asserted; the sentence
    invites the reading this row was filed on.
- **EVERY HAZARD LANDED ON THE SIDE THAT LAID IT IN THE OFFLINE BOARD, AND THE FIT DID NOT MOVE —
  THE LIVE BOT DID (ROADMAP #254).** `engine/board.js` recorded every side condition on the MOVER's
  side. Derived from `Dex.forFormat` and filtered to legal — never a list of names — **11
  side-condition moves in this regulation, 7 `allySide` and 4 `foeSide`** (Stealth Rock, Spikes,
  Sticky Web, Toxic Spikes), and **zero** using `self.sideCondition`, so `move.target === 'foeSide'`
  is the whole predicate. One helper, `sideFor(side, move)`, exported and called by **nine** sites:
  the write in `noteMove`, the `deadSide` read, the `alreadyUp` read that gates `setupTurns`, and six
  verbatim copies of the same derivation outside the file — `fit_policy.js:793` (**the fit itself**),
  `joint_rows.js`, `branch_recall.js`, `corpus_shift.js`, `feature_coverage.js`, `redirect_audit.js`.
  - **THE REFIT VERDICT IS NO, AND IT IS MEASURED RATHER THAN ARGUED.** The whole fit corpus was
    replayed through `FP.decisionsFor` under both boards — the pre-change `board.js` compiled in
    memory and injected, so the tree was never reverted. **9,226 games, 237,052 decisions, 1,731,851
    candidate vectors, 0 errored, identical decision key set — and 0 decisions, 0 games and 0 feature
    vectors move.**
  - **That zero is an ISOMORPHISM, not thin exposure, and both were counted because they mean
    opposite things.** Exposure: **24 hazard clicks** in the fit corpus (Stealth Rock 19, Toxic
    Spikes 2, Sticky Web 2, Spikes 1) against 9,911 `allySide` clicks, and **258 of 237,052 decisions
    (0.109%)** carry a hazard as a legal candidate. The write and both reads all took the mover's
    side, so the old board is the new one with the two sides relabelled and every offline-derived
    read lands on the same set.
  - **SO THE DEFECT WAS ONLY EVER IN PLAY, WHICH IS THE WORSE HALF.** `engine/magnemite.js:647` takes
    the side straight off `|-sidestart|` and calls `noteMove(..., worked=false)`, so nothing relabels
    the read. Constructed probe, all 11 moves, both boards: **offline arm identical; live arm
    pre-change reads `deadSide` p1=0, p2=1** for the four hazards — the LAYER re-lays Stealth Rock
    every turn believing it is not up, the VICTIM refuses to lay its own believing it is. Fixed:
    p1=1, p2=0. **MAG was fitted where `deadSide` was effectively right and played where it was
    inverted** — *fitting environment and playing environment must match*, broken in a new place and
    closed in the one direction that costs no refit.
  - **THE GUARD BUILT TO CATCH THIS WAS STRUCTURALLY BLIND TO IT.** Run under both boards with the
    fixture as it stood, **0 of 76 hashed columns moved**: `engine/feature_fixture.js` contained
    **zero hazard clicks** and the only side conditions any of its ten boards pre-set were `reflect`
    and `tailwind`, both `allySide` — exactly the half the fix leaves alone. R7 for the seventh time,
    and the new part generalises: the earlier misses were a SPECIES the boards did not stand on and a
    FIELD STATE they never entered; this is a MOVE CLASS nobody clicks. New board
    `hazards-already-up`, deliberately ONE-SIDED (`stealthrock`/`spikes` up on p2,
    `stickyweb`/`toxicspikes` up on p1) so the flip is exercised in both directions — setting a
    hazard on both sides moves nothing. `deadSide` now moves **`b984c210828d` → `d1be4f95d589`** and
    no other column does. Every set learnset-checked against `Dex.forFormat`.
  - **New gate `tests/test-hazard-side.js`, landed in the same commit as the fix** because a red test
    nobody can close is the banned "known failure". It walks all 11 moves from the format with both
    movers, asserts PLACEMENT and READBACK separately (a write-only fix is worse than the bug), keeps
    an `allySide` control and an inverse control, and holds all six sweep sites to reading
    `B.sideFor`. **5 passed / 3 failed at HEAD, 11 / 0 after**; reverting one sweep site fails by file
    name. `tests/test-feature-semantics.js` gained the matching clause: 16 → 18 assertions, and under
    the injected pre-change board it names all six wrong candidates.
  - **One correction to the roadmap row rather than a repetition of it:** *"crediting itself
    `setupTurns` each time"* is wrong. None of the four hazards carries a `condition.duration`
    (Reflect 5, Tailwind 4, the hazards none), so `setupTurns` is 0 for them under every variant;
    `deadSide` is the only observable column. The `alreadyUp` site is still routed through the helper
    — one fact, one function — and binds today only on the seven `allySide` moves.
  - **NO FIT WAS RUN AND NO WEIGHT FILE WAS RESTAMPED.** A refit stays OWED for the reasons
    `engine/status.js` already prints and this row adds nothing to them. Naming a consequence rather
    than leaving it to be discovered: the scenario count went 10 → 11, so
    `feature_fixture.js --check` now answers *"the fixture itself changed"* for every stamped file,
    which supersedes the per-feature message.
  - `tests/test-mechanics.js` **565 live / 0 missing**, unmoved — the whole-game differential
    exercises `medicham2`, not the feature board, so it was not expected to move and did not.
- **GOOD AS GOLD REFUSED FOES AND ACCEPTED ITS OWN PARTNER'S SUPPORT (ROADMAP #255).** The
  ability's whole handler is `if (move.category === "Status" && target !== source)` — **`target !==
  source`, not "target is a foe"** — so the authority refuses a partner's Decorate, Coaching, Skill
  Swap, Helping Hand, Life Dew, Howl or Perish Song aimed at your own Gholdengo exactly as it refuses
  a foe's Thunder Wave. Derived, not typed: **one carrier in this regulation** (a filtered
  `Dex.forFormat` walk) and `refusesStatusMoves` has **exactly one member over the whole tag corpus**
  (`abilities:goodasgold`, 3,043 uses), printed before anything was wired.
  - **The authority was measured first, one battle per route:** a supporter aiming at its own partner
    produces `|-immune|p1b: Gholdengo|[from] ability: Good as Gold` on **26 routes**, including the
    untargetable ones (Life Dew, Howl, Heal Bell, Perish Song, Teeter Dance, Corrosive Gas).
    **NOT refused, in the same sweep: Tailwind, Light Screen, Safeguard, Trick Room, Misty Terrain and
    Haze** — a side and a field are not a body, so `onTryHit` never runs. That is the boundary of the
    change, measured rather than assumed.
  - **Nine branches were wrong, in two shapes.** Five gated the refusal on `_isFoe` (`boostally`,
    `reorder`, `abilityswap`, `abilitywrite`, `statrewire` — a partner's Skill Swap **walked away with
    Good as Gold**); four carried **no refusal at all** (`helpinghand`, Life Dew's arm of `heal`,
    Howl's arm of `boostally`, and `perish`). **`perish` was therefore wrong for a FOE Gholdengo too**,
    which no `_isFoe` audit could have found, because there was no gate to audit.
  - **The fix is the existing announcer made side-blind**, because the authority's clause is:
    `tryHitRefusal` already carried `t!==m`, which IS `target !== source`. The spread branches call it
    **per body**, so Howl still lifts the user, Life Dew still heals the rest of the side and Perish
    Song still marks the other three. `pranksterBlocked` keeps its own foe gate inside that function
    because the authority gates it there, so this widens one ability and nothing else.

### Added
- **`MEDSEEN.tryHitRefusedAlly`** — the ally half of the onTryHit refusal, counted apart from
  `tryHitRefused` because it is the half that did not exist until this row. A zero on a run in which a
  partner supported a Gholdengo means the path has gone back to being unreachable.
- **One probe in `tests/test-mechanics.js`**, nine ally-aimed routes plus a five-route self-aimed
  exemption arm. Census **564 live / 0 missing -> 565 live / 0 missing**.

### Notes
- **The probe was wrong before the engine was, twice, and the second one is the lesson.** Its
  exemption arm was a self-aimed Nasty Plot, which routes to `kind:'setup'` — a branch that never asks
  about a refusal — so deleting the `target !== source` exemption outright left the probe **GREEN**.
  Every self route now goes through a branch this change actually edited (Howl, Life Dew, Perish Song,
  Rest), each measured on the authority first. Red proof in both directions: exemption deleted ->
  `564/1` naming all four self routes; `_isFoe` restored on `boostally` alone -> `564/1` naming
  `decorate`, with the pre-existing foe-side Decorate probe still LIVE.
- **The whole-game differential moved by one game in each arm and that is the honest result.**
  1,220-game pinned pair, both arms, releases `0c5bb83c5744` -> `9b25e830df49` verified to differ in
  exactly one file: top **254 -> 253**, bottom **294 -> 293**, `unrelated event mismatch` **30/26 ->
  29/25**, every other class identical to the instance, and one cause gone by name —
  `|-immune|p2a|[from]goodasgold <> |-singleturn|p2a|helpinghand`. No new causes. Normalised lines
  compared rose 1,507,925 -> 1,509,557, which is what removing an early stop looks like. The swarm
  aims 828 clicks at an ally across 1,220 games, so only a fraction can ever land on the one carrier
  in the format: **that is a fact about the instrument's reach, not a verdict on the fix.**
- `tests/test-engine-diff.js --n 6000`: **6000 agreed, 0 disagreed**, top 0/6000 and bottom 0/6000.
- **ROADMAP #257's stated mitigation does not work and is corrected in the row rather than left.**
  `tests/test-engine-diff.js` has **no `--write` flag at all** — it writes `data/engine-diff.json`
  unconditionally, and takes no `--out`. Omitting `--write` is a no-op. This run reproduced the
  published 6000/6000/0 exactly, so nothing was orphaned, but a smaller `--n` would have republished
  the measurement silently. MEASURE owns the fix.
- **Everything downstream of MEDICHAM is re-run owed.** This is a behaviour change, not a narration
  one, so any artifact measured on `0c5bb83c5744` or earlier describes an engine that plays one
  interaction differently.

## [5.14.0] — 2026-08-13

### Fixed
- **THE FALLEN COUNT WAS RIGHT AT TURN END AND WRONG AT BOTH ENDS OF THE TURN (ROADMAP #243 and
  #246, taken together).** They are the same field in the same file, and closing one alone leaves the
  count right at turn end and wrong at turn start.
  - **#243 — a same-turn kill was seen one action late.** The authority increments
    `side.totalFainted` inside `faintMessages()` (`dist/sim/battle.js:2092`), which runs at the end of
    every move (`dist/sim/battle-actions.js:301`), so a body that died earlier in the turn is already
    counted when the next action's `basePowerCallback` runs. This engine recounted only in the
    end-of-turn block, whose own comment admitted it. **Measured on the authority first**, seed
    `[1,2,3,4]`: a Garchomp KOs the Milotic ally and Houndstone's Last Respects then deals **69
    against 36** with the ally alive — x1.917, BP 50 -> 100. This engine read x1.000 and now reads
    x1.980.
  - **#246 — turn one of every seeded battle believed nobody had died.** `battleInit` wrote the
    literal `sfA:{fainted:0,…}` and the only recount was at turn end, so the first action of a
    playout priced Last Respects at a flat 50 whatever the roster said — and that is the
    decision-relevant action, because `rolloutAfterActions` forces the candidate click on turn one.
    Last Respects on the first action with 0/1/2/3 of the roster already fallen dealt **51/51/51/51**
    and now deals **51/101/151/201**. Identical results across a varied knob meant the knob was
    unwired, and it was.
- **The split between the two fallen-count mechanics survived, and is now asserted rather than
  assumed.** Last Respects re-reads the side's count at every use; Supreme Overlord reads it once in
  `onStart` and freezes it, so an ally dying while Kingambit stands there does nothing for it.
  Measured on the authority on the identical board: Iron Head from a Kingambit already out deals
  **70 against 70 — x1.000** where Last Respects is x1.917.

### Added
- Three probes in `tests/test-mechanics.js`. **Census 561 live / 0 missing -> 564 live / 0 missing.**
  The two Last Respects probes were shown RED on the unfixed engine before a byte moved. The Supreme
  Overlord probe asserts that NOTHING happened, so it passes on the unfixed engine too and was
  instead shown RED under a deliberate break (`_fallenStuck` swapped for `_sf.fainted` at the boost
  site): the census reported **563 live / 1 missing naming exactly that row**, while the pre-existing
  `boostsFromFallen` probe stayed green — which is why the new one had to exist. The break was
  reverted and the census re-run clean.

### Changed
- `engine/medicham2-browser.js` — `fallenSettle(S)` is one function called from four places (at
  `battleInit` after the roster is stamped, at the top of the action loop above the `sideWiped`
  break, after the last action, and in the residual) rather than four copies of two lines. The
  end-of-turn comment claiming the one-action-late approximation is retracted in place.

### Notes
- **The whole-game differential moves nothing, and that is reported rather than dressed up.** Two
  frozen releases verified to differ in exactly one file (`a2857a1bfd70` BEFORE, `0c5bb83c5744`
  AFTER), same pinned pool, 1,219 games, both arms: **220 / 239 diverged in both**, and every class
  row is identical to the instance. Expected — Mode A pins every die, so the arms rarely produce a
  same-turn kill followed by a Last Respects from the survivor. **No strength claim is made and none
  can be made from ENGINE.**
- The damage differential is **0 of 6,000** at the midpoint and at both corners (seed 20260804), run
  without `--write`.
- **The `Math.min(fainted, 5)` at the read site was checked, not assumed.** The authority has no cap
  on this move at all; ours first binds at six fallen allies, and a bring-4 game tops out at three.
  It is unreachable, is left in place so the timing movement stays attributable, and is now named in
  a comment so it stops reading as Supreme Overlord's cap of five, which is real and is a different
  rule.
- ROADMAP #245 and #247 were deliberately NOT touched. #245 is a counter change and would make this
  timing movement unattributable; #247 needs the board to remember the fallen count at each
  switch-in, which is upstream of ENGINE.

## [5.13.0] — 2026-08-13

### Fixed
- **TWELVE BRANCHES REFUSED THE SAME MOVE AND GAVE FOUR DIFFERENT ANSWERS (ROADMAP #241, parts 1 and
  2).** Good as Gold's refusal was already right on nine of twelve routes and its LINE was wrong on
  all twelve — the authority writes `|-immune|<target>|[from] ability: Good as Gold` and this engine
  wrote `|-fail|` on the MOVER, or nothing at all, or an unattributed `|-immune|`. It survived
  eleven named sites and nine passing probes because **every one of those probes reads the BOARD**,
  and a mechanic that behaves correctly and narrates wrongly is invisible to everything except a
  person reading a stream. A sweep over all 78 legal foe-aimed Status moves x 8 bodies (624 cases)
  also found that **Lock-On and Heal Pulse had no refusal at all** — a Lock-On at a Gholdengo applied
  the guarantee and a Heal Pulse healed it. Fixed as ONE announcer covering only the refusals that
  resolve at Showdown's `onTryHit` step.
- **A Ghost refuses a trap SILENTLY and the move then fails on the MOVER** — `tryTrap` calls
  `runStatusImmunity("trapped")` with no `message` argument (`sim/pokemon.js:1171`), so nothing is
  announced. This engine wrote `|-immune|` on the target.
- **A Prankster-boosted status move into a Dark type is a BARE `|-immune|` on the target**
  (`battle-actions.js:573`), gated on `!isAlly` exactly as the authority gates it. The refusal here
  was already correct and had collapsed into the same generic `mvFail` as every other reason a branch
  could decline, so the line named the mover.

### Changed
- `engine/tag_dex.js` — `refusesStatusMoves` now carries `announcesWith`, **read off `onTryHit`
  through the same `immuneAttrIn()` reader ROADMAP #239 built for `onSetStatus`** rather than a second
  derivation of the same fact. 0 of the 7 `statusImmune` rows moved; exactly 1 row in the whole
  artifact changed. Membership printed before wiring: `refusesStatusMoves` has one member,
  Gholdengo's Good as Gold, 3,043 corpus uses.

### Notes
- Census **558 -> 561 live / 0 missing**. Three probes, all shown RED before the engine moved.
- Whole-game differential on the same pinned pool, releases `718a7333f27b` -> `a2857a1bfd70`:
  top-tie-first **221 -> 218 of 1216**, bottom-tie-first **237 -> 244**. All seven target causes are
  gone by name; four of them were replaced by a LATER divergence in the same game, three of the four
  new `drag: a different body` causes naming Gholdengo. **The headline moved by three games and one
  arm moved the wrong way** — 3,043 uses counts entities on sheets, not games, and a narration fix
  cannot move a board that was already agreeing. No strength claim is made or implied.
- Damage differential at `--n 6000`: 0 disagreements, both corners.
- STILL OPEN and written down rather than left to be rediscovered: Good as Gold refuses an
  ALLY-aimed status move in the authority (`target !== source`) and every such branch here is still
  `_isFoe`-gated; Role Play and Spite reach `kind:'pass'`, which carries no target; Heal Pulse emits a
  second `|-fail|<mover>` on the ordinary full-HP path; Soundproof and Overcoat announce bare.
  ROADMAP #241 part (3) and the attribution case are untouched.

## [5.12.0] — 2026-08-13

### Added
- **THE PER-TURN PIPELINE IS WRITTEN DOWN (ROADMAP #251, #252, #253).** Will stated the whole ALAKAZAM
  loop out loud and it is now a dated section in `docs/ALAKAZAM-v2-spec.md` and a block at the top of
  `docs/MODELS.md`. The models were each documented and their **composition** was not, so no reader
  could tell from the ledger which one runs when. Five stages: MAG gates, DODUO scores joint actions
  and owns the sampling weights, MILTANK plays out on MEDICHAM, SLOWKING solves the mix, HYPNO decides
  how far to deviate. DUSK sits outside the loop as the exact endgame tablebase.

### Changed
- **MAG stops being a learned scorer and becomes a futility gate.** This fixes an ordering fault
  rather than merely simplifying: a learned MAG prunes what is bad ON AVERAGE and runs BEFORE DODUO,
  so it deleted exactly the actions that are bad alone and good in combination — the class DODUO
  exists to find. The gate is **derived from the engine, never a written list**: all four rules Will
  first proposed are wrong as typed (Fake Out is *first turn out*, not turn 1; Corrosion poisons
  Steel; Good as Gold is `breakable`; Armor Tail is one of Farigiraf's three abilities). It is also
  the only stage with no fitted parameters, so it is the one piece buildable before MEDICHAM lands.
- **AND THE GATE IS A RANGE, NOT A FILTER — the night's real correction, and Will's.** *"ive seen wolfe
  do the call out of calling a mon to switch out and using knock off into the new … or using a ghost
  move into a normal type calling a switch … ground into flying etc. thats the world champ
  difference."* A move follows the SLOT, so a switch replaces the body it lands on — meaning
  occupant-dependent futility is a PREDICTION, not a rule. Measured, that is not an edge case but the
  gate's entire membership: **8 type immunities and 29 legal abilities with an immunity-shaped
  handler.** What is genuinely assumption-free is only the user's own state — Fake Out out of
  position, a Choice lock, no PP, Disabled/Encored/Taunted, Belly Drum at half HP. So: **hard-cut the
  user-state half, weight the rest to near-zero rather than deleting it.** A near-zero weight costs
  what a deletion costs and keeps the action reachable, which lets SLOWKING *discover* the frequency
  for a Ghost move into a Normal type instead of us hand-deciding it is zero.

### Fixed
- **"Endgame" was claimed by two entries in our own ledger, which is why the architecture was hard to
  hold.** Will: *"wait didnt we have dusknoir as the endgame guy? its hard to keep track."* Correct,
  and the collision is ours — SLOWKING's **Job:** line reads *"the endgame — tell you the
  equilibrium-best move on a live position"*, indistinguishable in wording from DUSK's whole purpose.
  Now split explicitly: DUSK is small endgames, exact, offline; SLOWKING is any position, approximate,
  live; HYPNO is about the opponent rather than the position. **Only DUSK can say "guaranteed"**, so
  the late-game stage Will described belongs to DUSK and had been filed under HYPNO.

### Notes
- The matrix is kept **even if greedy wins more games** — already ADR-003's position, since
  VGC-Bench's policy beats a Worlds competitor and is ~100% exploitable. One correction to the stated
  reasoning: adapting to an opponent makes you MORE exploitable, not less. Nash never adapts and
  cannot be beaten long-run; what repeated play punishes is a FIXED mapping, and greedy is one. The
  matrix is the floor you measure deviations against; HYPNO is the deviation.
- Real games are short enough for the playout to reach true outcomes — open-sheet store, played-out
  games only (n=8,593): median **7** turns, 95.3% by 12, **99.8% by 20**. So the learned leaf
  evaluator (63.70% vs 60.28% for counting material) is load-bearing only on a 0.2% tail and is not a
  blocker. Separately: **36% of decided games are forfeits**, median 5 turns, which must be held apart
  from any win-probability learned off this store.
- **Not all of this is locked behind MEDICHAM, and the exceptions are worth keeping visible**: the
  futility gate has no fitted parameters, and HYPNO is the only model whose inputs never include the
  simulator. Everything else waits.

---

## [5.11.0] — 2026-08-13

### Fixed
- **THE ROLLOUT SEED DROPPED THE DEAD, SO EVERY PLAYOUT BELIEVED NOBODY HAD DIED (ROADMAP #244).**
  `battleInit` derives three things from the one array it is handed — the field (`teamA[0..1]`), the
  bench (`teamA.slice(2)`) and **the roster** (`sfA.team`), which is `fallenCount`'s denominator.
  `rollout_leaf.buildSide` dropped every fainted body, correct for the first two and fatal to the
  third: `fallenCount` returned a confident **0**, so a rollout seeded from a position with two dead
  allies priced Last Respects at 50 where the position says 150, and a Kingambit entered with a
  Supreme Overlord snapshot of zero. The corpses are now **appended after the living**, which is the
  only shape that fixes the roster without moving a body onto the field: the drop stays right for
  `actA`/`benchA`, and a corpse in the bench tail is inert because every bench reader in
  `medicham2-browser.js` goes through `_live` and `battleResult` sums `max(0,curHP)/hp`. They come
  from `board.graveyard`, not from the fainted actives — a Pokemon that died and was replaced was
  never in `sideTeam` at all, which was the larger half. **The count was NOT threaded through
  `battleInit` as an option**, deliberately: that would leave the seed handing MEDICHAM a side of four
  where the real side has six, and would be a second source for a fact the engine already owns.
  Gate `tests/test-rollout-fallen.js`, shown RED first (12 failures, `fallenCount -> 0` at every N,
  N=0 control green), now **27 passed / 0 failed**. The observable is Last Respects' base power,
  inverted out of a control damage table computed through the engine's own `dmgRange`, with `base`
  and `perFallen` read from `data/tags.json` rather than typed: **50 → 100 / 150 / 200 BP** at 1, 2
  and 3 fallen, and 50 unchanged at 0.

### Added
- **`engine/rollout_fallen_prevalence.js` → `data/rollout-fallen-prevalence.json`** — how often the
  fix above can matter. Over **13,592 open-sheet bo3 games / 183,840 decision points**: a death has
  already happened on the acting side at **50.83%** of them, the acting side brought a fallen-count
  carrier at **16.26%**, and **both hold at 8.75%** (16,082). Conditional on being affected the mean
  fallen count is **1.67**, i.e. Last Respects should have priced at **133.5 BP on average and priced
  at 50**. It is a **ceiling** on the fix's reach, not a count of flipped decisions, and it says so.
  The carriers are enumerated from `data/tags.json` (`lastrespects`, `supremeoverlord`), never typed.
  It reads the store and the tag artifact and **plays no game**, so it is not downstream of MEDICHAM,
  is not quarantined, and needed no engine release while ENGINE was editing the simulator.

### Notes
- **ROADMAP #246 opened and handed to ENGINE: the fix is green from turn TWO.** `battleInit` writes
  the literal `sfA:{fainted:0,…}` and the only recount is at turn end, so at t=0 the count is 0
  whatever the roster says — and that is the turn `rolloutAfterActions` forces the candidate click
  on, so a Last Respects being *ranked* is still priced at its floor. One line, in a file SEARCH may
  not edit while ENGINE holds it, and it needs nothing further from SEARCH because the roster it
  would read is now correct.
- **ROADMAP #247–#250 opened: four more approximations on the seeding path**, swept for rather than
  waited for, and none fixed — each changes what MILTANK clicks and owes its own arm. Supreme
  Overlord's entry snapshot is unseedable from the board; a benched Pokemon enters every rollout at
  full HP, unstatused and carrying the dataset's moves rather than its sheet's; the seed has no
  hazards, screens or Gravity; and every seeded body can Fake Out because `_mvActs` is 0.
  Chasing #249 found a defect underneath it: **`board.noteMove` starts every side condition on the
  MOVER's side, and `stealthrock`/`spikes`/`stickyweb`/`toxicspikes` are all `target: foeSide`**
  (derived from the format). The offline board — the fit's board — records every hazard on the side
  that laid it, while the live path reads `|-sidestart|` and is right.
- No feature was added; `board.js FEATURES` is still 58 and `data/policy-weights.json` keeps its
  dimensionality. No leaf value was re-measured and no SPRT was prepared: the simulator is moving, and
  measuring a half-fixed seed would describe a build nobody will ship.

---

## [5.10.0] — 2026-08-13

### Fixed
- **A MID-TURN SPEED CHANGE REORDERS THE MOVES AND NOT THE SWITCHES (ROADMAP #240).** Found by Will
  reading a published divergence card. Showdown re-sorts the action queue after every action, but the
  guard passes only when the NEXT queued action is a move — so between two switches nothing is
  recomputed and every switch keeps the speed stamped at turn start. On a turn where all four slots
  switch and Tyranitar arrives with Sand Stream, Excadrill's Sand Rush is live and never read; we
  recomputed. Implemented as the TRIGGER rather than as a rule about switches or about weather, both
  of which would look right on that card and be wrong the moment somebody clicks a move. `willAct()`
  now reads the same action-kind mapping, so ROADMAP #232 and #240 cannot come apart — they are one
  rule seen from opposite sides, and the probe proves it: breaking this fix to "never re-sort" takes
  #232's mega probe down with it.
  Census **557 → 558 live / 0 missing**. Whole-game differential on a 300-game pinned pair, two frozen
  releases differing in one token: top **98/260 → 97/260**, bottom **93/260 → 91/260**, with exactly
  one class moving on the primary arm (`ordering`, 16 → 15 games) and every other class unchanged to
  the instance. Honestly small — the register row's corpus figures are usage of the entities named,
  not games fixed.

### Changed
- **Register rows #241 and #242 re-sized against measurement, and #241 was pointing at its rarest
  case.** Both were opened off single cards Will read. Grouped over all 241 distinct causes in the
  1,539-game-per-arm run: **21 name `-fail`**, and the largest sub-family is **Good as Gold** — 4
  causes, one carrier in the regulation (Gholdengo), 3,043 corpus uses — emitting a bare `-fail`
  where the authority emits `-immune ... [from] ability: Good as Gold`. The refusal itself is already
  correct; only the line is wrong, which is exactly why nothing caught it. The attribution case the
  row was opened on does not appear in the top 20.
  For #242, derived and filtered to the regulation: **49 effects carry a duration and 44 own no
  residual handler**, so `residual_order.js`'s 42 rows overlap that set in only five. 19 of the 44
  announce their expiry; the other 25 expire silently and still consume a position in the same walk.

### Notes
- Two adjacent defects declared without being folded in: `getActionSpeed` re-derives PRIORITY as well
  as speed on every re-sort — a comment in this repo asserted the opposite and is corrected — and
  `eachEvent('Update')` sorts on the authority's cached speed where ours recomputes every time.

---

## [5.9.1] — 2026-08-13

### Fixed
- **THE VIEWER INVENTED A DEFECT, WHICH IS WORSE THAN MISSING ONE.** Will, reading card 3:
  *"but look at how busted our switches are, they are replacing themselves?"* — `Sinistcha sends in
  replacing Sinistcha`. That was the renderer, not the engine. The slot-occupancy table was module
  state shared by both panels: Showdown's rendered first and wrote `p2a → Gholdengo`, then ours read
  it back. **The two panels are alternative futures of one instant** and each must start from the board
  as it stood at the split, so occupancy is now snapshotted after the shared lead-in and restored
  before each side. 198 switch labels, **0 self-replacements**. The three-line render is also lifted
  out of the template literal into statements, because the order those three steps run in *is* the fix
  and burying it in template-expression evaluation order was too clever to trust.
- **The lead-in block said "both engines identical" and it is not identical.** It renders OUR stream,
  and the engines agree there only *after* normalisation — which is why Will saw
  `|-resisted|p2b: Sinistcha|1` inside a block claiming both sides emitted it. Showdown's only
  `-resisted` site (`battle-actions.js:1503`) emits no third field; ours appends a resistance depth.
  The label now reads "agree", with a caveat naming the seven equivalences and saying explicitly that
  who was actually hit is compared on the `-damage` / `-status` lines rather than on the
  `|move|` line's nominal target.

### Added
- `docs/ROADMAP.md` register rows **#240, #241, #242**, all found by Will reading the published cards:
  the action-queue re-sort trigger, the generic `-fail` attribution family, and duration-only residual
  expiry. #242 is the one that also indicts an instrument — `engine/residual_order.js` enumerates the
  42 effects owning an `onResidual` handler, and Tailwind owns none; it is in the authority's walk
  purely because it has a `duration`, so every duration-only effect expires from inside the residual
  and is invisible to the table we derive the order from.

---

## [5.9.0] — 2026-08-13

### Added
- **THE DIVERGENCE DUMP NOW DRAWS FROM BOTH PINNED CORNERS, NOT ONE.** Will: *"can we also include
  ones from the bottom where everything hits and it doesnt line up? that would provide more
  interactions for possible failure that i can see."* Every dump written before this took its games
  from `results`, which is the PRIMARY arm alone — `top-tie-first`, the corner where every
  sub-100-accuracy move MISSES and no secondary fires. That is not a stylistic narrowing. It makes a
  whole class of mechanic **untestable by construction**: Magic Bounce cannot be wrong about a
  Hypnosis that missed, and no secondary can be mistimed if none fired. `bottom-tie-first` is where
  every one of those lands. The two arms are now interleaved so a reader who stops halfway has seen
  both corners, and each card carries its arm — a defect present in one corner only is a narrower
  claim than one present in both, and the page lets you isolate either.
  Measured on 1,539 games per arm: **top 309 diverged (20.1%), bottom 346 (22.5%)**.
- **A SWITCH NOW SAYS WHO IT REPLACED.** Will: *"and include the clear switch ins"*, and earlier,
  reading a card, *"when we switch in a mon like it did with greninja it should say what it swapped
  for"*. A bare `sends in Greninja` hides the half that decides what the switch MEANT — a pivot, a
  forced replacement after a faint, and a lead arriving all read identically in the protocol. The
  renderer tracks slot occupancy through each card's own lead-in and prints `replacing <body>`.
  207 switches across the 80 published cards now name what left.

### Fixed
- **THE VIEWER'S OWN HEADER WAS TYPED, AND IT HAD GONE STALE — the failure this repo is built
  against, inside the tool built to expose it.** `divergence_cards.js` opened with the literals
  "Sixty diverging games out of 209" and "209 / 815 diverged". The run behind the page is 1,539 games
  per arm; the page would have introduced its reader to the sample with two confident wrong numbers.
  Every figure in the header is now read out of the artifact. The renderer still AUTHORS nothing —
  reading a count is not computing one.
- **`of_diverged` REPORTED A CAP AS A POPULATION.** The dump pool is capped at twice the dump size,
  and the artifact tallied the pool: the page said "80 of 160" for a run that diverged on **655**
  games. Both `of_diverged` and the per-arm counts are now taken off the arms themselves, with the
  cap kept separately as `pool_considered`. Same shape as the credit over-claim ROADMAP #91 fixed —
  a number that is smaller than the truth still misleads when it wears the truth's name.
- A dumped game from a non-primary arm reached the renderer with no `_cls`, because the report loop
  that stamps it walks the primary arm only. It now classifies through the same function rather than
  falling back to `unclassified`, which would have implied the classifier had no opinion.

### Notes
- The published sample changed shape twice tonight and neither is a regression: the Illusion closet
  exclusion dropped 13 teams, and the pool cache rebuilt against a moved store. Both are stamped in
  `data/divergence-turns.json`.

---

## [5.8.0] — 2026-08-12

### Fixed
- **THREE WRONG OUTCOMES, ALL FOUND BY READING BATTLES RATHER THAN BY ANY INSTRUMENT.** A rewritten
  type survived the bench: Showdown's `clearVolatile` ends by rebuilding the body from its base
  species, so a Soaked Meowscarada is Grass/Dark again when it switches back in. Ours kept it Water,
  and a Psychic move then killed a body that is immune to Psychic, from full HP. One fix covers Soak,
  Burn Up and Reflect Type — and Burn Up's own comment asserted "switching out rebuilds the body",
  which was never true here.
- **Fairy Aura was live everywhere except the moment it arrives.** The `onAny` half is correct — the
  aura prices the user, the partner and both foes — but the field's aura state is snapshotted at the
  top of the turn, and **a mega evolution is the one event that puts an ability on the field without a
  switch**. The mega turn was priced without its own aura. Fixed for all three field facts rather than
  the one that was measured.
- **Raging Bull's type now follows the user's forme**, closing a family derived to be exactly two moves
  wide. Into one Kingambit: base 33 resisted, Paldea-Combat 288 — four times.
- **Gravity's accuracy multiplier was absent because `ACCMOD` had no namespace for field effects.**
  The tag artifact carried the value all along and nothing read it. Hypnosis reaches 100 and cannot
  miss. RETRACTED IN THE SAME PASS: this entry first said the sweep also named Lock-On and Minimize as
  still missing. **Both halves were wrong.** Neither is an accuracy MULTIPLIER — Lock-On carries
  `onSourceAccuracy` and Minimize `onAccuracy`, a second hook family that returns a replacement
  accuracy or a never-miss rather than a factor — and neither is missing: the simulator has 9 and 13
  sites, both are tagged, and Lock-On has 0 corpus uses. The real finding underneath is that the
  ACCMOD conformance check knows only the `*ModifyAccuracy` family, so those two carriers are
  invisible to it.
- **Effects bind a SLOT, not a body.** 56 wrong-body hits to zero; 36 of them had been confirmed
  landing on an orphan object nobody reads again, so the effect silently did nothing and the live
  body's HP never moved — invisible to every board comparison in the project.
- **The weather residual ran in slot order while the clock residual had been speed-sorted for days.**
  Every body takes the same chip, so every total agreed and a damage differential is structurally
  blind to it.
- **Focus Band could not save anything** — its whole tag was `flingable`. **Regenerator emitted a heal
  the authority does not.** **Tangled Feet, Plus and Minus were switched off behind reasons that had
  expired.**

- **A ROADMAP ROW REFERENCE IS AN IDENTIFIER, and # was already declared one — in ID_WORD, beside
  §. It never fired: that lookbehind demands a space and this repo writes #224 with none, so the guard
  covered a spelling nobody uses. It cost a real verdict — a note reading *Closed #218 and #224 on measured
  evidence*, beside the two artifacts that prove it, was failed for citing a figure of 224 that neither
  contains. Naming the rows it closed is what made it fail.
- **The closed-detector was case-sensitive on a register that SHOUTS its titles.** closed 20\\d\\d\n  was written lowercase with no /i, so a row reading CLOSED 2026-08-11 in its own first line was counted
  OPEN — and #220 asserts breakage, so a defect fixed the day before was still inflating the MEDICHAM gate.
  That is #148 again with letter case in place of word choice. **The obvious fix was measured and rejected:**
  /i on the whole alternation also swallows #33 (*rollout_r1.js done, three callers left*) and #80, silently
  closing two live rows. Only the dated token ignores case. Rows asserting breakage: **4 to 1**, and the one
  left is real.

- **The OHKO class took every accuracy modifier and should take none.** `hitStepAccuracy` branches on
  `move.ohko` BEFORE the ModifyAccuracy event and before both stage adjustments, so Gravity, Compound
  Eyes, Wide Lens, an accuracy boost and an evasion boost all reach exactly nothing. `hitChance` had no
  such branch — every `ohko` mention in the simulator was in the damage path. Half of this was a
  same-day regression: the evasion half had been wrong for the life of the function, and adding Gravity
  to `ACCMOD` gave a standing hole a second way to be wrong on the same 141 corpus uses. The `ohko` tag
  also flattened `m.ohko` to `true`, discarding the string Showdown reads twice — Sheer Cold is 20 from
  a non-Ice body and refused outright by an Ice one. Both rules were underivable; the engine had neither.

### Changed
- **The whole-game comparison is a gate clause now**, at seven clauses rather than six. The bar is a
  ratchet rather than zero, and the clause prints the absolute figure every run with the words
  *NOT ZERO, AND THE RATCHET IS NOT A PASS*.
- **The team pool is frozen** at `data/team-pool-frozen`. It had been read live from stores that are
  appended to continuously, which is why three runs of one instrument reported 1,556, 1,213 and 983
  games — a measurement that froze the engine and pinned every die took its SAMPLE from a moving file.
- **The differential now fills a stat spread.** Every body had run at zero investment, which is not a
  neutral choice: with everything flat, 91.4% of legal species share a base Speed with some other
  species, so the rig manufactured speed ties and tested turn order in the one configuration where
  turn order cannot be got wrong.
- **The board comparison gained typing and ability**, which it had never carried. Without them the
  end-of-battle measurement would have returned "cosmetic" for the most serious defect in the register.

### Notes
- **THE HEADLINE, AND THE UNCOMFORTABLE PART.** The whole-game differential opened the day at
  **570 of 1,556 games diverging (36.6%)** and closes at **260 of 983 (26.4%)** on the top arm,
  **284 of 983 (28.9%)** on the bottom. But **five verified narration fixes moved it by nothing**
  (224 → 225), and **the three wrong-outcome fixes moved it by two games.** The rate counts games and
  weights a rare catastrophic defect below a common cosmetic one. It is the wrong measure of severity
  and a severity ladder is being built to replace it.
- **The end-state measurement says about 62% of diverging games finish in the same state** — different
  words, identical battle. It also refuted the assumption repeated all day that missing-or-extra lines
  are mostly harmless: that shape ends in the same state **least** often, 54% against 82% for pure
  ordering.
- **A narration fix was taken back OUT.** Announcing Encore's refusal cost **ten games** — battles that
  had agreed throughout began parting, because our gate fires where the authority is silent. The
  sub-case could not be found, so it did not ship.
- **The probe was wrong before the engine was, at least nine times.** A Showdown battle never taken
  through team preview reads an empty board with every leaf null; `battleInit` slices its own bench so
  a short team cannot switch; a regex matching single quotes finds nothing in a compiled source that
  uses double. Every one of those produced a confident false verdict first.
- **Predictions were wrong three times, in both directions**, each recorded before the run.

---

### Notes — SUPERSEDED MEASUREMENTS, RECORDED SO THEY REMAIN CHECKABLE

Re-running an instrument overwrites its artifact, and `tests/test-docs-current.js` calls a figure
traceable only while some artifact still contains it. A day of honest re-runs therefore orphaned the
numbers written earlier in the same day — not because any of them became false, but because the
evidence behind them was replaced. The registered repair is that a re-run should stamp the figures it
supersedes. Until that exists they are recorded here, which is what a historical record is for, rather
than pruned from the log or waved through by raising a ratchet twice in one day.

- **Whole-game differential, the re-run before the spreads landed:** 1,556 games each arm, top-tie-first
  570 diverged, bottom-tie-first 613, 0 threw either side, 201,493 tied groups resolved. Turn-1 boards
  identical on 1,529.
- **Rate run, staged arm:** Static 16,575 trials, 30.42%, CI [29.72, 31.12]; Quick Claw 12,697, 20.19%;
  Shed Skin 17,432, 33.27%; Healer 19,620, 50.02%; Harvest 19,620, 50.18%.
- **Rate run, self-play arm:** 30,052 scored major-status trials, of which 1,391 carried no damage line.
- **Pre-correction z on the targetBoosts family:** −3.107 against a same-family control of −0.584.
- **Protect corpus usage as the divergence report ranked it:** 100,806 clicks across 12 causes. Recorded
  because the sprint notes quote it while RETRACTING it as a sizing measure — the shield fix moved one game
  per arm, so 100,806 is usage of the entities named, never a count of games fixed.
- **Damage differential, overwritten by a 150-comparison run before being restored:** data/engine-diff.json\n  read compared: 150, agreed: 150, disagreed: 0 where the documented claim rests on 6,000. Re-run at
  6,000: agreed 6000, disagreed 0. A weaker run reads identically to a strong one unless something asks
  the denominator.
- **Protocol-trace theoretical denominator before 93 ability rows left the file:** 9376.

---

## [5.8.0] — 2026-08-12

### Added
- **THE END-STATE COMPARISON RANKS BY SEVERITY INSTEAD OF COUNTING.** `engine/end_state_severity.js`
  and the end-state reporting in `engine/game_differential.js`. `DIFFERENT-END-STATE` was one row per
  game, so a healthy body killed by a move it cannot be hit by weighed the same as a three-HP rounding
  residue. Six rungs now, ordered by what the difference means for the game: different winner, different
  bodies alive, HP beyond a typical hit, different identity on a live body, other state, small HP or
  boost. Each band reports a count, the bodies in it ranked by corpus usage, and the games themselves —
  team pair, seed, configuration and arm — so a band can be opened and re-played.
- **`tests/test-end-state-severity.js`** — shown red first and shown NOT firing: a planted death reaches
  the top rung, a planted three-HP residue must not, a one-sided forme change must not read as a death,
  all six rungs reachable, the ladder ordered, `severity()` refuses to run without a measured threshold,
  and the whole path through the real driver against a cleared control.

### Changed
- **THE BAND 3 THRESHOLD IS MEASURED FROM THE RUN, NOT PICKED** — the median DIRECT hit the AUTHORITY
  narrated, as a fraction of the struck body's own maximum HP, cut per arm and never pooled.
  **25.9% of a health bar over 2,092 hits (top-tie-first), 28.8% over 1,808 (bottom-tie-first).**
- **The driver sets medicham2's `S.maxTurns`.** `battleOver` is `S.turn >= (S.maxTurns || 20)` and the
  driver had never set it, so a run above 20 turns got a medicham2 that stopped while Showdown played
  on. Measured at `--turns 40`: 943 of 983 games ENDED-APART, 937 of them "ONLY medicham2 ended". Set to
  `max(turn cap + 1, 20)`, so every 12-turn run is byte-identical to before.

### Fixed
- **The severity ruler was excluding every killing blow.** Showdown writes a fainted body as `0 fnt`
  with no denominator, and a parse requiring `\d+/\d+` discarded exactly the largest hits in the sample
  — 13 direct hits narrated in one measured game, 8 reaching the ruler. Hits 1,612 → 2,092 and
  1,321 → 1,808.
- **The ruler was counting residual chip as a hit**, putting the median at 12.7% with quartiles 6.2 and
  34.2 — the middle of a bimodal mixture. Sandstorm, burn, poison, Leech Seed, hazards and Life Orb are
  identified by Showdown's own `[from]` attribution, excluded, and counted (4,838 and 4,947 events).
- **The per-arm hit receipts were pooled** and published the same excluded-residual figure against two
  arms whose hit counts differed. Re-derived per arm.
- **`tests/test-end-state.js` PART 3 is green again, and the attribution in `docs/ENGINE.md` was wrong.**
  Same frozen release, one flag apart: live team pool → 2 failures, `--team-store data/team-pool-frozen`
  → all green. The pool is read live from a file OPS appends to, so the fixture drifted until the item
  plant landed in a battle that legitimately undid it. The pool is now pinned by default.

### Notes
- **Measured, 2,300 games per arm, release `6155acc0fb26`, frozen team pool, turn cap 12, 0 threw:**
  band 2 (a body dead in one engine and standing in the other) is **25 of 278 (9.0%)** and **27 of 297
  (9.1%)**; band 4 (identity on a live body) is 86 (30.9%) and 95 (32.0%). `sinistcha` is the largest
  single body in band 2 — 6 and 7 games, 2,668 corpus teams — reading `0/146` for us against `146/146`
  for the authority. Filed to ENGINE, not diagnosed here.
- **Band 1 (a different winner) is 0 and that is not a clean bill.** 2,275 of 2,300 games stop at the
  turn cap, and above medicham2's 20-turn horizon the comparison degenerates. A 30-turn run refuses to
  publish because one of the state comparator's own planted defects can no longer be staged in long
  games. DIFFERENT-WINNER has no denominator in this harness yet.
- The shape prior holds as a rate and not as a headline: RULE reaches band 2 on 14.9% / 16.2% of its
  games against ORDERING's 7.1% / 4.8%, but EMISSION supplies the majority of band-2 games because it is
  the largest bucket. ORDERING is not zero — one game per arm.

## [5.7.0] — 2026-08-11

### Fixed
- **THE INTERACTION MATRIX IS AT 1,640 / 1,640 — 100.0%, ZERO PARTING ROWS.** All five live
  disagreements (ROADMAP #161) closed one at a time, each measured alone: `--full --write` matrix,
  `replay_differential --games 400`, and `quarantine.js` after every one. `live` stayed 1,640 and `ran`
  stayed 2,253 across all five, **so the rate moved because the engine moved, not because the instrument
  shrank** — which is the failure that hid here four days ago.
- **`throatchop -> shielddust` (3,739 uses)** — the sound lock was applied BELOW the secondary loop, so
  it stood outside that loop's Shield Dust and Sheer Force gate. Now a branch inside it. The volatile
  lives in `secondary.onHit`, a CLOSURE (`data/moves.ts:19420`), which is why no field-reading
  derivation ever saw it and why #139's wire closed Salt Cure, Psychic Noise and Syrup Bomb but not this.
- **`psychicnoise -> shielddust` (262)** — **my diagnosis did not cover it and the truth was worse.** The
  gated road wrote `_vol.healblock`, which nothing reads and nothing ticks; an ungated block below wrote
  `_healBlock`, which every consumer reads. **Two implementations of one fact**, which is the rule this
  file's instructions state and the defect that keeps arriving anyway.
- **`instruct -> goodasgold` (190)** — the Instruct branch is the only road to a second action in a turn
  and it asked NONE of the ordinary refusals.
- **`psyshieldbash -> aftermath` (24)** — **not the `!m.fainted` guard I sent the agent at.**
  `_stepEffects` opened `if(!R.hit)return;` and `R.hit` means *the target survived*, so a KO discarded
  the whole effects step — including the secondary that boosts the ATTACKER. Three hundred lines earlier
  than my hypothesis.
- **`rockwrecker -> bulletproof` (8) — and WIRE 43's COMMENT WAS FICTION.** It asserted *"a blocked or
  missed Hyper Beam still recharges in the real game"*. Four staged turns with an explicit control:
  Hyper Beam into Protect `[]`/`[]`; Rock Wrecker into Bulletproof `[]` vs ours `["mustrecharge"]`;
  Rock Wrecker into nothing `["mustrecharge"]`/`["mustrecharge"]`; and **Hyper Beam into a GHOST — `[]`
  vs ours `["mustrecharge"]`**. The Protect row is why the wrong sentence survived: we already left the
  branch on a shield, so the only wrong family is the one a shield never covers. **The 8-use row found a
  defect that lives on a far commoner board.** Comment rewritten with the measurement in it.
- **RESIDUALS NOW RUN IN SPEED ORDER (ROADMAP #115).** Will: *"pokemon faint in speed order"*, *"in trick
  room do they faint in reverse speed order?"*, *"sandstorm damage, etc"*. All DERIVED —
  `battle.ts:2811` runs `updateSpeed()` at the head of the residual step, `pokemon.ts:557` sets
  `speed = getActionSpeed()`, and that inverts under Trick Room. `medicham2-browser.js:14890` iterated
  `[...actA,...actB]` in SLOT order; it now sorts through `compareTurnOrder`, so Trick Room comes free.
  **Scoped by measurement**: the mega step (`:9313`) and the switch-in step (`:8827`) already sorted, so
  Intimidate and mega ordering were correct all along. **Not cosmetic** — `battle.ts:2604` awards a
  simultaneous double-KO to the side of the LAST faint off the queue, not a tie.

### Added
- **Every new capability carries a counter, each demonstrated non-zero on a staged turn**:
  `soundLockApplied`, `healBlockApplied`, `instructRefusedByAbility` (with `instructRepeat` 0 in the same
  arm), `rechargeSkippedNoTarget`, `volRefusedOnFainted`. A capability that cannot prove it ran is
  assumed broken.
- **`tests/test-assert-mode.js` — REGISTERED RED, AND THE RED IS THE POINT.** The roster files 14
  abilities `NO CONTROL` because every legal carrier has the ability as its only one; Will dissolved
  that — *"if a status move targets gholdengo, it fails. no status move can ever succeed"* — because the
  effects are ABSOLUTE and need no second arm. **And the harness already existed**: `staged_board.js`
  compares US against SHOWDOWN on one board, never two of our arms. **All 12 rows pass. They also pass
  with Good as Gold and Levitate deleted from the engine.** The mutation applies (anchors at 2, 12 and 1
  occurrences); the scenarios simply do not exercise the refusal. **Twelve green rows would have been
  reported as coverage of 5,769 teams.** The file says so, exits non-zero, and lists what to debug.

### Notes
- **THREE RED TESTS THAT ARE NOT FROM THIS WORK, measured rather than assumed.**
  `tests/test-tag-consumed.js` (23 tags newly with no consumer) and `tests/test-tag-wire.js` (10 dead
  wires, including *"contact into a SURVIVING Aftermath body costs nothing"*) are **byte-identically red
  with `medicham2-browser.js` restored to committed HEAD** — same assertions, same HP figures.
  `test-effective-identity.js` was red on arrival. Stated, owned, not filed.
- **`status.js` opens with a FEATURE SEMANTICS failure** — the damage table went 318 → 317 species under
  `data/policy-weights.json`. That is MEASURE's refit trigger and **#26 is OWNED BY WILL**; it stays red
  rather than being restamped, because a restamp makes the warning vanish without making it untrue.
- **An artifact was weakened and restored**: running `tests/test-engine-diff.js` standalone rewrote
  `data/engine-diff.json` at its 150 default over a published 20,000-game figure. Restored, and it reads
  0 disagreements at 20,000.

---

## [5.6.0] — 2026-08-11

### Fixed
- **RESIDUALS NOW RUN IN SPEED ORDER (ROADMAP #115), AND IN TRICK ROOM THEY RUN IN REVERSE.** Will, in five messages: *"pokemon faint in speed order"*, *"in trick room do they faint in reverse speed order?"*, *"speed decides who switches out first or who megas first"*, *"mega first or second can determine things like the weather"*, *"sandstorm damage, etc"*. All DERIVED: `battle.ts:2811` runs `updateSpeed()` at the head of the residual step, `pokemon.ts:557` sets `speed = getActionSpeed()`, and that returns `10000 - speed` under Trick Room — so the sort is already inverted before anything resolves. **`medicham2-browser.js:14890` iterated `[...actA,...actB]` — pure slot order, no sort.** It now sorts through `compareTurnOrder`, which reads the field, so Trick Room comes free rather than needing a branch.
- **SCOPED BY MEASUREMENT, WHICH IS THE USEFUL HALF**: the MEGA step (`:9313`) and the SWITCH-IN step (`:8827`) ALREADY speed-sort, so **Intimidate and mega ordering were correct all along** — the two obvious suspects. Reporting "our ordering is wrong" without that scoping sends the next person at the wrong sites.
- **IT IS THE WHOLE RESIDUAL FAMILY, NOT PERISH SONG** — Will got there in two words, *"sandstorm damage, etc"*. Sand and hail chip, burn, poison, Leftovers, Salt Cure, Yawn and Heal Block all ride this order.
- **AND IT IS NOT COSMETIC.** `battle.ts:2604` awards a SIMULTANEOUS double-KO to `faintData.target.side` — the side of the LAST faint off the queue, **not a tie**. So in a mutual-perish endgame the residual order picks the WINNER and we were picking it by slot position, and the rollout scores wins.

### Added
- **`engine/speed_vs_pokeenv.js` — three arms, not two.** Will: *"benchmark medicham against poke-env so we know what we need to beat"*. The two-arm version would produce a huge number and the number would be a lie: poke-env is Python over a WEBSOCKET to a Showdown server, so most of what it spends is transport. The claim ADR-003 and #62 actually rest on is about SIMULATION cost. So: **A. poke-env** (what VGC-Bench paid), **B. Showdown’s own `BattleStream` in-process** (the simulation alone), **C. MEDICHAM**. **B is the honest baseline** — if C/B is near 1, the engine programme’s justification is transport avoidance, which driving `BattleStream` in-process already gave us for free without writing a simulator. That is the outcome a two-arm benchmark would have hidden. poke-env is installed; arm A is still to run.

### Notes
- **THE MEta IS CONCENTRATED ENOUGH FOR PRE-SOLVED CHARTS, MEASURED**: of 277 species seen across 26,232 declared teams, **14 cover 50% of team slots, 40 cover 80%, 66 cover 90%**. Combined with #47’s measured cell counts, 1v1 charts over the top 40 are ~25,600 cells and 2v1 is ~3.0M — and #47 measures 2v1 as reachable in **45.9% of games**. Registered as #163.
- **TYPE IMMUNITY PRUNES LESS THAN IT SOUNDS**: 4,907 of 62,440 attacking clicks across the top-40 meta are 0x — **7.9%** provably dead on type alone. Will was right that real positions prune hard, but the pruning is structural (Showdown’s request disables Fake Out on turn 2) and strategic, not type-based. **And pruning attacks the wrong half**: a solver discovers dominated actions itself; what decides chart size is how many distinct MATRICES occur, not how many cells each has.
- **#164 — the end goal is written down for the first time**: closed team sheets, #1 on the ladder. I first filed the open-sheet corpus against it as a fitting-vs-playing violation; **Will corrected that — it is a curriculum, not a mismatch** — and the row and the memory were rewritten rather than left standing.
- **#163 rests on my RECALL of Libratus and Pluribus and is being verified**, because Will asked *"did you research them"* and the answer was no. A research pass is running.

---

## [5.5.0] — 2026-08-11

### Fixed
- **The interaction matrix stopped exercising the whole protect family and the agreement rate went UP.** Two `--full` runs five days apart read live 1,643 → 1,593 with agreement 98.8% → 99.7%: **57 of the 80 pairs that went LIVE → INERT had a protect-family reactor** (Spiky Shield 16, Baneful Bunker 16, King's Shield 13, Beak Blast 12) against contact carriers, and Spiky Shield versus a contact move is *never* inert — that is the chip damage. An INERT pair is **not scored**, so the regression could not make the headline look worse; it could only make it look better while covering less. **Root cause:** a reactor MOVE cannot be removed, so `controlCarrier()` varies the CARRIER instead — and it asked `LINKAGE[key].carrierMoves`, which `tag_dex` builds behind a **usage gate**, whether a candidate carried the flag. That list is *flagged moves people click*; **fifteen moves carrying `flags.contact` are absent from it purely for having zero usage** (crushclaw, axekick, bind, bounce, comeuppance, covet, doublehit, **flail**, pluck, pound, seismictoss, struggle, tailslap, thrash, wrap). Blastoise's control became **Flail**, both arms made contact, the shield punished both, and the reference engine's two arms came out identical. Measured before: **101 of 464 reactor-move cases had a control carrying the very key under test**; after: **0 of 436**. Live **1,593 → 1,640**, inert 566 → 491, **54 of the 57 exercised again**.
- **The defect did not arrive on 2026-08-10 — it was uncovered then.** The control previously chosen was `dive`, which *also* makes contact but is a two-turn charge move that never lands on turn 1, so it never touched anything and the case passed for the wrong reason. Dive earned nonzero usage, entered `carrierMoves`, stopped being eligible as a control, and Flail took its place. **A staged board printed in both arms is what settled this**; reading the code got it wrong four times.

### Added
- **`engine/linkage_carrier.js` — "does this move carry this linkage key", one implementation, two callers.** CLAUDE.md's FACTS-ARE-GLOBAL rule: `tag_dex.js` BUILDS `linkage.<key>.carrierMoves` with it and `tests/interaction_matrix.js` REFUSES a poisoned control with it, so a usage-ranked *ranking* can never again be mistaken for a *membership test*. Proven equivalent to the inline rule it replaces over **500 moves × 16 keys, 0 mismatches**, so `data/tags.json` is byte-unchanged and was **not** regenerated. It returns `null` — never `false` — for a key with no move-carrier rule, and the caller drops the pair under a printed reason rather than proceeding as though the answer were "no".

### Notes
- **A second, honest loss, named rather than papered over.** For the `statusMove` key — Taunt, and Sucker Punch and Upper Hand reached through it — *same category* and *without the key* **contradict**: every status move carries `statusMove`, so Taunt blocks the control exactly as it blocks the carrier. Eighteen pairs were staged that way and all eighteen read INERT with the reactor firing perfectly in both arms. They are now dropped under `control-impossible-for-this-key`, printed every run. **This costs Taunt every case it had.** The fix is not a cleverer control carrier — it is for a reactor MOVE to be controlled by varying the HOLDER'S ACTION, which is a change to the two-arm staging and is left open rather than smuggled in.
- **1,640 is not 1,643, and the two are not the same population** — the generator emits 2,253 now against 2,300 then. Eight of the recovered pairs correctly turned INERT rather than LIVE: `fly`/`dive` (charge moves) and `steelroller` (fails with no terrain) cannot express contact inside a one-turn script and used to read LIVE only because the *control* was the thing making contact. A carrier that cannot land inside the script should be a named DROP, not an INERT row. Open.

---

## [5.4.0] — 2026-08-11

### Added
- **`tests/test-perish-song.js` — the KO is proven, and the old guard was green against a mutant that never killed anything.** ROADMAP #90, Will 2026-08-07: the counter half landed in 3.71.0 and *"the counter being right is not evidence the faint happens"*. He was right, and it is now demonstrated rather than argued: with the perish KO deleted and the clock left intact, `tests/test-volatile-duration.js` still passes. **1,141 corpus uses rested on a step nothing had ever watched.** Three clauses, all Will’s: the faint fires on turn 4 (turns 1-3 are the negative, so a turn-early KO is caught); it fires on BOTH SIDES at once, including the singer’s own partner, because `perishsong.target` is `all`; and **a body that leaves the field survives**. Shown RED on `--break-the-faint` before being trusted.

### Notes
- **The switch clause was staged with a PIVOT, not declared impossible.** `staged_board.js` exclusion D says the script language has no voluntary switch (#122) — and its own text says *"every switch in this file is driven by a PIVOT MOVE"*. U-turn leaves the field and the volatile is cleared by leaving, not by the manner of leaving. **A COULD-NOT-STAGE VERDICT IS A CLAIM ABOUT THE FIXTURE, NEVER ABOUT THE MECHANIC** — Will has taught this twice. What the pivot does NOT answer is stated in the file: a pivot is not a voluntary switch, so "does a TRAPPED body escape the count" stays with #122.
- **Two of my own errors, kept because they are the lesson.** The first fixture used **Amoonguss, which is `isNonstandard: Past` in this format** — a body typed from memory on the night this repo gained a check against exactly that; `buildPair` returned null and the row read NOT-STAGED. And the first red demonstration was INVALID: I rebuilt the scenario by hand in a throwaway, both the clean and broken runs returned `SHORT`, and the check only asked "is the verdict not IDENTICAL" — reporting a guard firing when nothing had been shown. The mutation now lives inside the file that owns the scenarios.

---

## [5.3.0] — 2026-08-11

### Added
- **`engine/open_work.js` — what is open, PRINTED, never typed.** Will: *"i feel like we already talked
  about and fixed most of these."* He was right. I had just read out ~30 open defects: **eight had been
  closed for days and four had never had a register row at all.** It was the SECOND stale list I quoted
  inside an hour — the first was `data/interaction-matrix.json`, **4.3 days and 52 simulator commits
  old**, whose "19 disagreements" are really 5. Neither was carelessness: **nothing in this repo printed
  the open work.** `quarantine.js` computes a GATE — "is there an open row that ASSERTS BREAKAGE?" —
  narrow on purpose because an over-firing gate is the one people learn to ignore (#148). It is correct,
  it is not a work list, and #80/#84/#59/#60 are all open without tripping it. So the only list that
  existed was one somebody typed. The new tool prints all 127 register rows by status, every defect a
  live instrument is measuring with **no register row behind it**, and the AGE of every artifact it
  reads. Its closed-detector is **imported** from `quarantine.js`, not copied, so the gate and the work
  list can never disagree.
- **`tests/test-target-provenance.js` and a required `from` on every million-game target.** Will, after
  the fifth memory-typed value in one evening: *"stop typing from memory make that a rule."* A rule that
  is prose is a preference — this file says so three separate times and was right each time. `add()` now
  THROWS without `from`; the gate FAILS on any `HAND` value, on a citation naming a file that does not
  exist, and on one claim published with two numbers. **205 DERIVED, 28 READ, 0 HAND.** Shown red on a
  deliberate break before being trusted.
- **`docs/_outbox/assert-mode-spec.md`** — Will's fixture designs for the 14 abilities with no control
  arm, the one thing I had said I could not do.

### Fixed
- **Deriving instead of typing found four more wrong values in the target list.** **Healer 30% → 50%**
  (`randomChance(1,2)`; 30 is mainline's and I typed it). **Sheer Cold 30% → 20% for a non-Ice user** —
  `battle-actions.ts:701` overrides it and the row claimed a flat 30 for every OHKO move. **Effect Spore
  is 11/10/9, not a flat 30** — a `this.random(100)` threshold ladder, so sleep is deliberately likeliest.
  **Confusion was the sleep error a second time**: `random(2,6)` seeds a counter of 2-5 and `onBeforeMove`
  DECREMENTS BEFORE ROLLING, so the observable is **1-4 attempted moves at risk**. Will caught that shape
  on sleep; I had shipped it one row down. The twelve proc rates are now READ OUT OF THE HANDLER SOURCE —
  `randomChance(a,b)`, `random(100)` ladders and pushed `{chance}` secondaries — so the mod re-rolling any
  of them tomorrow is followed without an edit.
- **An OHKO move's `accuracy` field is a lie and the generator was publishing it.** Sheer Cold appeared at
  30% in the accuracy family AND 20% in the ohko family — one subject, two numbers for the run to chase.
- **THE ILLUSION CLOSET, DECLARED (ROADMAP #160).** Will: *"if there is a zoroark in the game lets just
  set those games aside"*, then *"at some point we are going to have to have zoroark in our engine."*
  Zoroark enters disguised as the last living body on its bench and **the protocol names the DISGUISE,
  not the mover**, so every click it makes is filed against a Pokémon that never moved — manufacturing
  false set evidence for the impersonated body and hiding the real one. Measured: 386/12,314 bo3 raw
  (3.13%), 1,731/52,840 ladder (3.28%), **384 games out of the clean fit corpus (8,543 → 8,159)**. The
  rejection is COUNTED and NAMED beside `partial_bring`, because a filter that cannot say how much it
  removed is indistinguishable from one that is not running. `ILLUSION_IN=1` re-admits them for the refit.

### Notes
- **MEASURED: the interaction matrix's shrink is a FIXTURE REGRESSION, not a reclassification.** My
  hypothesis — "the 29 new tag rules re-sorted them" — was wrong. Live 1,643 → 1,593; **80 pairs went
  LIVE → INERT and 44 came back**, and **57 of the 80 have a protect-family reactor** (Spiky Shield 16,
  Baneful Bunker 16, King's Shield 13, Beak Blast 12) against contact moves. INERT means *the reference
  engine behaves identically with and without the reactor* — which for Spiky Shield versus a contact move
  is never true. **The harness has stopped exercising 57 pairs and reports agreement for them.**
- **The five live matrix disagreements, registered as #161** so they stop being invisible: `throatchop`
  and `psychicnoise` into Shield Dust, `instruct -> goodasgold`, `rockwrecker -> bulletproof`,
  `psyshieldbash -> aftermath`. Fourteen of the old nineteen closed days ago, including Fake Out at
  13,292 uses (`bbd4cd5`).
- **Throat Chop diagnosed**: its volatile lives in `secondary.onHit`, not `volatileStatus`, so it never
  enters the loop the Shield Dust gate sits on — which is why #139's wire closed Salt Cure, Psychic Noise
  and Syrup Bomb and missed it. **A derivation that reads declared fields is blind to behaviour expressed
  as code** — the same reason `scripts.ts`'s eleven overrides are still UNVERIFIED.
- **One of those eleven is now verified**: Champions copies the multi-hit sampler verbatim
  (`scripts.ts:441` = `battle-actions.ts:869`), so the 35/35/15/15 hit-count distribution is confirmed
  identical rather than assumed.
- **Three of the six form-change abilities would PASS A BROKEN ENGINE under "did the stats change".**
  Morpeko and Morpeko-Hangry are both `58/95/58/70/58/97`; all four Castform formes are `70/70/70/70/70/70`;
  Stunfisk-Galar has no forme at all. Their observable is the TYPE — Aura Wheel flipping Electric/Dark,
  Castform's Normal/Fire/Water/Ice, Mimicry's four terrains (Misty gives **Fairy**). And Forecast is FIVE
  states, not three: sand and expiring weather both fall to the `default` revert branch.
- **Anger Shell has ZERO legal carriers in Reg M-B**; Berserk has two (Drampa, Drampa-Mega, 56 sheet teams).
  Champions drops the Sheer Force clause from both `onDamage` guards while `afterMoveSecondaryEvent` keeps
  its Sheer Force skip — so a Sheer Force hit on a Berserk holder leaves the held berry stuck.
- **`#26` OWNED BY WILL 2026-08-11** — he is reworking MAG's weights himself. The feature-semantics check
  on `data/policy-weights.json` stays RED until then (damage table regenerated under the fit, 318 → 317
  species). Not filed, not restamped: a restamp would make the warning vanish without making it untrue.

---

## [5.2.0] — 2026-08-10

### Added
- **`engine/mod_audit.js` — everything the Champions mod changes, all eight files, every field.**
  Will: *"where else might mainline data have snuck in aside from the champions mod?"*, then *"well read
  the mod bro"*, then *"yeah bro read everything no skipping."* Until tonight the question **"did
  Champions change this?" had no answer anybody could run** — every discovery came from Will asking, one
  at a time, after the gate had already opened.

### Fixed
- **71 moves, 7 abilities, 1 item and 3 conditions differ from mainline, and almost none was known.**
  - **2 moves have a different TYPE** — Growth is Grass (mainline Normal) and **Snap Trap is STEEL**
    (mainline Grass). A whole effectiveness column, never checked.
  - **42 PP values, 12 base powers, 4 accuracies** — Baneful Bunker 10→5, King's Shield 10→5,
    Beak Blast 15→5 and 100→120 BP, Apple Acid 80→90, **Make It Rain 100→95 accuracy and SpA −1 → −2**.
  - **4 secondaries** — Dire Claw 50→30, Iron Head 30→20, Moonblast 30→10, and **Freeze-Dry's freeze
    chance removed entirely**.
  - **7 abilities** — Anger Shell, Berserk, Disguise, Healer, Natural Cure, **Regenerator**, Unseen Fist.
    Regenerator's `onSwitchOut` is overridden and switching was added to the rollout the same evening;
    **Berserk** is one of the 22 untagged abilities that was about to have its rule derived from mainline.
- **The three status conditions, corrected twice each after Will pushed back.** Paralysis is
  `randomChance(1,8)` = **12.5%**, not 25%. Sleep's `sample([2,3,3])` is a *startTime*, and mainline's
  `onBeforeMove` decrements before acting — so the holder misses **1 or 2 turns**, ⅓ chance of 1, which
  is what Will said and not what I first reported. Freeze is **both** a **25% thaw roll every turn**
  *and* a hard 3-turn ceiling — I had stopped reading at line 45 and its `onBeforeMove` starts at 46.
- **Paralysis speed is 50% and Champions does NOT change it** — checked rather than assumed.

### Notes
- **`scripts.ts` is NAMED, NOT VERIFIED, and that is the honest half.** Eleven overridden methods —
  `modifyDamage`, `statModify`, `calculatePP`, `getActionSpeed`, `formeChange`, `clearVolatile`,
  `canMegaEvo`, `canTerastallize`, `spreadMoveHit`, `hitStepMoveHitLoop`, `init`. **A value diff cannot
  say what a rewritten function does.** Every mechanic debugged tonight has an implementation in that
  file, including the multi-hit loop an agent rewrote from mainline. Registered as human work.
- **357 species "differ" and none of it matters** — `tier`, `doublesTier`, `natDexTier` on every legal
  body, because Champions reclassifies the dex. **Zero differ in baseStats or types**, checked before
  excluding. A diff that reports everything reports nothing.
- **The pattern across the whole night, stated once**: everything DERIVED from `Dex.forFormat` was
  right; everything TYPED FROM MEMORY was wrong. `par`, `slp`, `frz` were the three I hand-wrote and all
  three were wrong. The generator that reads the format had Dire Claw at 30% already.

---

## [5.1.0] — 2026-08-10

### Fixed
- **THREE STATUS RATES IN THE MILLION-GAME LIST WERE MAINLINE AND ALL THREE ARE WRONG.** Will asked
  *"where else might mainline data have snuck in aside from the champions mod?"* — the answer was
  `data/mods/champions/conditions.ts`, which nothing here had ever opened. **Paralysis is
  `randomChance(1, 8)` = 12.5%, not 25% — half.** **Sleep is `sample([2,3,3])` — 2 or 3 turns, and it
  can NEVER last one.** **Freeze is a fixed 3-turn timer, not a 20% per-turn thaw roll** — not a die at
  all, and I had listed it as one. Each would have failed a correct engine, or passed a wrong one that
  happened to match mainline.
- Confusion, Attract and flinch are **not** overridden and inherit mainline — 33% / 50% stand. Checked
  rather than assumed, because "this file overrides some conditions" is not "it overrides this one".

### Notes
- **THE STRUCTURAL ANSWER: the Champions mod overrides EIGHT files and we had audited TWO** — both only
  after they bit us (`abilities.ts` via Unseen Fist, `moves.ts` via Moonblast and the 21 constants).
  Never read: `items.ts`, `learnsets.ts` (328 KB), `rulesets.ts`, `formats-data.ts`, and **`scripts.ts`**.
- **`scripts.ts` is 22 KB of overridden BATTLE MECHANICS, not constants** — `modifyDamage`,
  `statModify`, `calculatePP`, `formeChange`, `getActionSpeed`, `canMegaEvo`, `spreadMoveHit`,
  `hitStepMoveHitLoop`. **Every mechanic debugged tonight has an overridden implementation in a file we
  have never opened**, including the multi-hit loop an agent rewrote from mainline.
  `engine/format_audit.js` cannot see this: it sweeps CONSTANTS, and a rewritten function is not one.
- **Two builders still fetch mainline over the network** — `build_mega_dex.js:50` and
  `build_species_abilities.js:29` pull `play.pokemonshowdown.com/data/pokedex.json`, the first calling
  it *"the data the Showdown server runs this format on."* Measured harmless (all 76 legal megas exist
  in mainline with identical base stats; Champions does not override `pokedex.ts`) — but the belief is
  the one that produced the 21 constants.
- **`app/` and `web/` disagree about the gate** — `app/quarantine-data.js` still says CLOSED with 33
  withheld figures while `web/` says OPEN with 0, because the builder writes `web/` and never `app/`.
  Not a leak (`app/` over-withholds, the safe direction). Registered, not fixed — web is paused.
- *I nearly reported a catastrophe here twice in three minutes — first by reading a key that did not
  exist, then by testing `isNonstandard` when every gen-9 mega is `Past` by definition. Both were my
  probe, not the data.*

---

## [5.0.0] — 2026-08-10

### Changed
- **THE MEDICHAM GATE IS OPEN — all six clauses, verified against a frozen release.** Census
  **437 live / 437 probed / 0 missing / 0 unarmed**; differential **0 of 20,000**; all three roster
  stages re-run against release `82250b3c3139`, cut from this tree with **0 of 24 files moved**, at
  **0 FIRED-AND-BOARDS-DIFFER / 0 DID-NOT-FIRE**. Quarantine selftest 20/20 including the RED arm.
  **This is not 4.0.0 again** — that opening was retracted two commits later because the gate could
  not read its own defect register. This one is stamped to a release that has not drifted.

### Fixed
- **Four of the eight were already fixed and nobody closed the row.** `_lastMove`, the Choice lock,
  Struggle and Quick Guard were repaired by the previous batch and left open in the register, so the
  gate kept counting them. Each was re-measured rather than trusted.
- **The grounded axis was worse than #147 described.** The Ground immunity was read off the TYPE CHART
  and never asked `isGrounded()` at all. Earthquake into a Flying Corviknight: **0 → 148** under
  Gravity, **0 → 139** Smack Down, **0 → 138** Ingrain, **167 → 0** Magnet Rise. Iron Ball on a Flying
  body was wrong before this row existed.
- **#123 confirmed Will's correction and the row was wrong as written.** Earthquake **hits Dig for
  double** (23 → 46); Iron Head still misses (51 → 0); Surf/Dive 29 → 57; and **Hurricane into Fly is
  94 → 94** — pierce and double are different sets. `invulnPierced` 6, `invulnDoubled` 4.
- **The "32 no-op moves" was wrong: it is 15, and 307 clicks, not 1,702.** Transform 89, Entrainment
  72, Worry Seed 69, Role Play 35, and five at literally zero. Ratcheted in
  `data/unmodelled-clicks.json` — may shrink, never grow.
- **The gate clause itself was the last thing in the way**, and it counted **#148 against itself** for
  quoting the breakage vocabulary. It scanned prose case-sensitively, so rows headed `— CLOSED` kept
  counting. It reads the row's **status cell** now, refuses `PART DONE`, and was shown RED on a planted
  open row before being trusted.

### Notes
- **RETRACTED WITHIN THE HOUR: "Unseen Fist and Piercing Drill are two mechanisms sharing one tag."**
  I read `/data/abilities.ts` — **mainline** — where Unseen Fist deletes the `protect` flag and goes
  through at full damage. **The Champions mod overrides it**: `onModifyMove: undefined`, then the same
  `onHitProtect` as Piercing Drill, *"contact moves ignore a target's protection and deal 1/4 the usual
  damage."* Will caught it. Identical mechanisms, one tag, `damageMult: 0.25` — **the tag was right and
  I was wrong.** Same error as the 21 mainline constants and Moonblast's 30% against the format's 10%.
- **`piercesProtect` is derived with correct params and READ BY NOTHING** — both abilities are still
  stopped by Protect in our engine. Invisible to the usage shelf because both are mega-only and sheets
  declare the pre-mega ability. Registered as a defect: an open gate that has not registered a live
  defect is the sixth clause failing quietly.
- **OPEN IS NOT "START CONSUMING THE DOWNSTREAM NUMBERS".** Will: *"why run miltank when we probably
  are going to change medicham"*. Exactly — 88 scenario rows are still unbuilt, the last sweep found
  148 divergences from a THINNER fixture set, and every bug they expose moves the engine again. The 47
  artifacts are **re-runnable, not worth re-running yet**. Order agreed: build the scenarios → sweep →
  fix what it finds → million games → and only then re-run and refit, once, on an engine that has
  stopped moving.

---

## [4.13.0] — 2026-08-10

### Changed
- **Pickup is deliberately shelved and says so — 3 teams of 26,232, 0.011%.** Will: *"yes if it has
  almost no usage we can quarantine it, AS LONG AS WE KNOW ITS PURPOSELY NOT BEING BUILT."* Declared in
  `tests/roster.js`'s `DEFERRED` table with its number and its reason. It keeps its scenario, stays
  staged and is printed every run; it stops holding the gate. The shelf is not the risk — the silence
  is, which is the same rule `RAW-STORE-OK` already follows.
- **A flat usage threshold was proposed and killed before it shipped.** I suggested "under 25 teams,
  shelve it". Will pushed back and the measurement showed why: **Cud Chew sits on Farigiraf, which is
  on 18.3% of teams — the 8th most common Pokémon in the format — and Merciless on Toxapex at 5.0%.**
  Those are common bodies running a minority ability, and what matters for a simulator is how often you
  **face** a mechanic, not how often you bring it. The threshold would have cut four mechanics that
  occur in real games.

### Notes
- **The rule is usage × fixture cost, and exactly one row fails both.** Cheek Pouch, Cud Chew and
  Gluttony are equally rare and are BUILT, because they share **one** cheap fixture — hold a berry,
  cross the threshold, look. Merciless and Super Luck are a crit RATE and go to the million games.
  Pickup alone needs a second body to consume an item on an earlier turn, for the rarest ability in the
  format that has a legal carrier at all.

---

## [4.12.0] — 2026-08-10

### Added
- **`MOVE_FACES` — adversaries for the inert moves, 13 entries covering 29 of 54.** The move stage
  hands the subject a click and lets the receiver attack back, which reaches any move whose effect is
  DAMAGE and misses every move whose effect is about the adversary. Two of these Will named before the
  measurement existed: Wide Guard needs a spread move, contact needs Rough Skin. The
  `semiInvulnerable` five (Dig, Dive, Fly, Bounce, Phantom Force) now get SWUNG AT while they are
  gone — and the entry records that the PIERCE list and the DOUBLE list are different sets, so an
  engine implementing "pierces implies doubles" is wrong on five moves.
- **`pp`, `statusCategory`, `neverMisses` and `moveClass` get no entry, deliberately.** They are the
  four biggest tag buckets among the inert moves and they are PROPERTIES, not triggers — nothing
  follows from "this is a status move" about what must happen for it to be observable. A property is
  tested through its REACTOR, which is what the contact / sound / powder entries are.

### Notes
- **The remaining 25 need a CONSEQUENCE, not an adversary, and that is a second concept.** Haze,
  Magnet Rise, Safeguard, Poltergeist, Helping Hand, Lock-On and the stat-swap family are not failing
  for want of something to face — **they set a STATE and nothing downstream reads it.** Haze needs
  something to have boosted first; Magnet Rise needs a Ground move after; Safeguard needs a status
  move to follow. So the vocabulary is two things — `faces` (what you are up against) and `thenWhat`
  (what must happen next) — and forcing the second into the first would have produced entries that
  look like adversaries and mean nothing.

---

## [4.11.0] — 2026-08-10

### Added
- **The adversary table is wired into the gauntlet.** `gauntletScript` now takes the stated adversary's
  moves first and falls back to the bare gauntlet when a carrier cannot learn them, plus setup turns
  for preconditions that are not attacks — weather before Cloud Nine, a status before Quick Feet and
  Natural Cure, and a priority click **from the adversary** so Analytic's holder actually moves last.

### Fixed
- **It is 37 abilities that need an absolute assertion, not the 7 I reported.** Levitate never reached
  the new adversary at all: `NO CONTROL — every legal carrier has this as its only ability`. Counted
  against the format: **210 legal abilities have a legal carrier, 173 have some carrier with a second
  ability, 37 do not.** Six were raised by Will himself tonight — Levitate, Mummy, Innards Out,
  Piercing Drill, Mega Sol, Parental Bond — which is why the seven-item framing survived: each example
  looked like a special case instead of a class.

### Notes
- **The staging problem is three, not two.** ~26 blocked by the FIXTURE (fixed by `faces.js`), **37 by
  the METHOD** (no control body can exist), 2 by the DIE (a rate — million games). Will's form-change
  answer generalises to all 37: it is not "did the form change", it is **assert the outcome directly
  rather than comparing two bodies**. Levitate — did the Ground move deal zero? Mummy — is the
  attacker's ability now Mummy? None needs a control.
- **The two red ratchets get ONE CLEAN PASS when the ENGINE agent stops** — Will's call. They cannot
  converge against a moving tree: the silent-catch count went 52 → 47 while I fixed 14, because new
  code kept arriving. Recorded here so it is scheduled rather than filed.

---

## [4.10.0] — 2026-08-10

### Added
- **`engine/faces.js` — what the ADVERSARY must be doing, 27 entries keyed on the tag (ROADMAP #98).**
  One script ran at every ability — get hit physically, get hit specially, switch out — and against
  that, **63 legal abilities produce a board byte-identical to not having them.** The roster filed each
  `COULD-NOT-STAGE — THE STAGING IS INERT`, which reads as a limitation of the game and is a limitation
  of the fixture: Analytic acts only when the holder moves LAST, Levitate only against a GROUND move,
  Shield Dust only against a move carrying a SECONDARY. **A test that cannot fail is not evidence, and
  63 of them were counted as coverage.** Now **35 of 63 have a stated adversary**; 2 are excluded as
  crit RATE (million games); 26 carry no usable tag, so no adversary can be derived until the rule is
  written.

### Notes
- **One fixed target cannot proc everything, and Will asked exactly that.** *"DO WE WANT JUST A FIXED
  TARGET LIKE FERALIGATR OR MORE VARIED?"* Three different blindnesses: its **moves** (Flower Trick is
  Meowscarada's alone), its **type** (pure Water blocks nothing by accident — the right default, the
  wrong universal), and its **ability** (Torrent, so Trace, Receiver, Mummy and Wandering Spirit would
  be measured against one value forever and pass). **But varying it blindly would be worse than fixing
  it** — a random adversary makes a green mean something different each run, which is how the roster's
  control arm came to measure the control instead of the subject (#100). The target varies by TAG;
  Feraligatr remains the default.
- **A table must be importable without starting an instrument.** The table was first written inside
  `all_mechanics_fire.js` with a `module.exports` bolted on. That file RUNS on require, so the probe
  written to count coverage **began playing games** — it printed the harness banner before it printed
  an answer. Moved to a data-only module. The same shape as everything else here: the thing that looked
  like a read was a write.

---

## [4.9.0] — 2026-08-10

### Added
- **The million-game target list — 237 rows, derived rather than typed** (`engine/million_targets.js`
  → `data/million-targets.json`). Will: *"START A LIST OF ALL THE THINGS WE WANT TO TEST IN THE MILLION
  GAMES RUN."* Every row carries **its own denominator**, which is the part that is easy to get wrong:
  Rock Slide's 30% is over turns it CONNECTED with a target that could flinch, not turns it was
  clicked. A rate over the wrong denominator is worse than no rate because it looks like an answer.
- **112 of the 237 are ACCURACY, and accuracy has never been observed once.** The differential pins
  every sub-100% move to MISS on both engines, so they agree perfectly and prove nothing. The single
  busiest row is **Protect at 147,242 clicks** — the ⅓ / ⅑ / ¹⁄₂₇ chain-failure rate, the most-clicked
  mechanic in the format, never measured.

### Notes
- **THE LINE THE FILE DRAWS, and two of Will's own three examples fall on the far side of it.** Upper
  Hand blocking priority and Terrain Pulse doubling on Electric Terrain are RULES — one board each.
  Rock Slide's flinch is a DIE. **A deterministic mechanic that only shows up wrong at a million games
  means the scenario catalogue has a hole**, and both rule examples prove it: Terrain Pulse was broken
  and one fixture fixed it at 4.0.0; Upper Hand is broken now and one fixture would catch it.
- **Scenarios BEFORE the million games, and the reason is diagnostic.** (Will: *"BEFORE THE MILLION
  GAMES LETS TEST ALL OUR STAGING SCENARIOS AND COMPARE THEM TO SHOWDOWN RIGHT?"*) A rate test can only
  measure a mechanic that already works — if flinch reads 0%, a rate run cannot say whether the chance
  is wrong or the flinch is unwired. Reversed, every rule bug arrives disguised as a rate bug.
- **`preventsCrit` is deliberately EXCLUDED**, and Will's question is why. *"WHAT HAPPENS IF FLOWER
  TRICK HITS A BATTLE ARMOR MON?"* — `battle-actions.ts:1637-1646`: the guaranteed crit is set, the roll
  is SKIPPED because `willCrit` is defined, then `runEvent('CriticalHit')` cancels it. **It hits for
  normal damage and emits no `-crit`.** That is a three-arm deterministic fixture off one move —
  ordinary body, Battle Armor, then a Mold Breaker user — settling `preventsCrit`, `alwaysCrit` and
  `moldbreaker` with no die at all.
- **A coverage warning N cannot fix**: a self-play corpus where nobody switches yields ZERO samples for
  Intimidate-on-entry, hazard chip and Regenerator however many games it runs. Coverage is a property
  of the ACTION SET, not of N — which is why ROADMAP #63 had to land before this run, not after.

---

## [4.8.0] — 2026-08-10

### Added
- **The rollout can switch, and its cap is now measured rather than round (#63, #38).**
  `data/rollout-switch-census.json` over **58,639 stored games**: **71.22% of real games contain a
  voluntary switch**, and 9.98% of decisions with a live bench are one. The derived cap is **14 turns**
  (ladder 14, bo3 13, at 99% of occurrence-weighted positions) against the previous **60**, which the
  artifact records as `was_derived_from: "nothing — a round number"`. The two errors compounded: a
  rollout four times too long in which nobody ever leaves is exactly where stall lines that cannot
  exist get discovered.
- **Ten sprint generators declared as INSTRUMENT / CENSUS / PROBE**, each with its own reason and its
  own TRIGGER. `tests/test-stadium-roster.js` was red on all ten at once — the GURU hole — and three
  were mine. `click_counts` and `sheet_usage` are the borderline pair, declared as censuses on a
  stated argument: the usage shelf reads them, but the shelf is the thing that DECIDES.

### Fixed
- **The 56 unopenable releases resolve into causes and mostly are not broken (#109).**
  `data/release-census.json`: **54 serviceable, 55 predate an export, 4 pruned, 5 genuinely
  unloadable.** The dominant cause is `SOURCES` growing 12 → 17 → 23 — a loader-compatibility fact,
  not corruption, and a far smaller problem than the headline implied.
- **The differential clause had quietly weakened to a 133x smaller sample.** The gate read
  `0 of 150 comparisons` where it had been `0 of 20,000`; an agent ran it small and the artifact it
  left is what the clause reads. **A gate passing on a smaller sample is a weaker claim wearing the
  same word.** Re-run: still 0 of 20,000.

### Notes
- **FOUR AGENTS LANDED WORK AND NONE REPORTED — the session froze and had to be hard-restarted.**
  Their edits survived; their claims did not. **Everything here was verified by RUNNING it**, which is
  the only honest option once the reporter is gone. Verified green: `test-rollout-switch` 16/16,
  `test-web-quarantine-loaders` ALL PASS, `test-engine-release` 66/66.
- **The process failure is mine.** "One agent per division" is a COLLISION rule; I treated it as a
  capacity rule as well. Four concurrent agents each spawning Showdown battles is a load problem
  regardless of file separation.
- **ENGINE did NOT land #118/#119.** The gate is unchanged at **CLOSED, 1 of 6, 8 open defects**.

---

## [4.7.0] — 2026-08-10

### Fixed
- **THE REPLAYER'S PHAZE GUARD SILENTLY UNDID ITSELF IF THE DEX FAILED TO LOAD.** `PHAZE_MOVES` was
  built in a `try` that returned **null** on failure, and `turnHasPhaze()` opens with
  `if (!PHAZE_MOVES) return false` — so a null list meant **no turn was ever recognised as a phaze
  turn**, and the replayer went straight back to scoring every turn downstream of a Roar, Whirlwind,
  Dragon Tail or Circle Throw. Those draw the replacement AT RANDOM, so each later turn compares two
  different boards and charges the difference to the engine. That is 3.99.1 reverting itself with no
  symptom: the run completes and the numbers look plausible. **Now FATAL** — this file replays stored
  games *through Showdown*; a dex it cannot load is not a degraded mode, it is no instrument at all.
- **Twelve more silent catches in `engine/replay_differential.js` now speak**, each with the
  consequence stated where it happens. The ones that were not cosmetic: `movePriority` throwing left
  priority at **0**, so a Sucker Punch reordered the turn and the comparator blamed the engine;
  `effSpeed` throwing fell back to the **raw stat**, discarding Choice Scarf, paralysis and Tailwind;
  `playerAction` throwing became a **passed turn** (ROADMAP #125's shape) with nothing recording the
  lost click; `bodyFor` throwing removed exactly the species it could not build from the sample, so
  the remaining agreement read better than it was; and skipping a weather field in `speedSpan`
  **narrows** the interval — and `orderVerdict` scores a difference on disjointness, so a narrower
  interval **manufactures** disagreements rather than hiding them. `test-no-silent-failure` new count
  **52 → 38**.
- **An unknown flag was silently ignored.** `--n 8` — `test-engine-diff.js`'s flag, not this file's —
  ran the **default 100 games** with no warning. The run you ask for was not the run that happened.
  Unknown flags now refuse to run, with the known set derived from the parse sites rather than typed.

### Notes
- **RETRACTED IN THE SAME PASS: "a smoke run destroyed a real measurement".** I read the artifact
  being overwritten by `--n 8` as a destructive smoke run, and built a floor guard against it. It was
  false — `--n` was being ignored, so every one of those runs was a **full 100-game run** producing an
  artifact of the same size. Nothing was destroyed. **The guard was removed rather than kept on a
  better excuse**, because the file already refuses to publish when its red proof cannot be staged
  (*"An instrument that cannot be shown red is not evidence"*) — a stronger protection, and a second
  overlapping one is the two-things-deciding-one-fact hazard this repository is built to avoid. What
  survives is the real defect underneath: the silently-ignored flag that produced the wrong reading.
- **The wasted work is not the lesson; the SHAPE is.** I asked for eight games, got a hundred, and
  every available signal said success — the founding failure of this project, reached through the
  cheapest possible door. Four commands and a false finding is what it cost here. The same slip inside
  a measurement that matters produces a number computed over the wrong sample with nothing saying so.
- `data/replay-differential.json` and its freeze file were restored from HEAD after the confusion and
  are byte-identical to the published measurement. **No figure in them changed.**

---

## [4.6.0] — 2026-08-10

### Fixed
- **32 OF THE 34 CONSTRUCTED-GAME DIVERGENCE ROWS NOW AGREE.** The run went **125 → 93** diverging
  move rows; the census went **416 → 421 live / 421 probed / 0 missing / 0 unarmed**. The 148 rows
  turned out to rest on **three** root causes, not the two the list named.
- **A move whose damage is not COMPUTED cannot crit — and cannot announce effectiveness either
  (13 rows).** `getDamage`'s four early returns (`move.ohko`, `damageCallback`, `damage === 'level'`,
  `damage`) sit **above both** the crit die and the type chart, and we emitted both lines for all
  thirteen. Not cosmetic: the crit set `R.crit`, which Anger Point, Sniper and Shell Armor read. One
  predicate, `damageIsComputed(moveId)`, placed inside `critChance` so every caller shares it, with
  membership checked against the format — `ohko || damageCallback || damage` is **exactly** the
  `fixedDamage` tag's 13 entries. It also closed `sheercold` and `metalburst`, which diverged on
  `-resisted` rather than `-crit`: same predicate, other side.
- **The multi-hit volley was one aggregated `-damage` (10 rows), and the hit COUNT was never wrong.**
  `game_differential.js` pins the die over both engines, both rolled 2, and the exact-2× ratio was our
  aggregate against Showdown's **first packet**. **Not a ROADMAP #103 regression** — do not report it
  as one. The volley now applies per packet, emits effectiveness/crit/damage per arrival, stops at a
  KO, and closes with `|-hitcount|`. Two real mechanics fell out, **both previously declared open in
  the source**: a **Focus Sash now answers the first packet** for the 2–5 family, and a volley stopped
  early by per-hit accuracy **was being priced at the 3.1-hit expectation** because `if (_hitsThisUse
  > 1)` left the count unset and sent `hitPlanOf` to `expectedHitsOf`.
- **Stance Change did not exist (8 rows), and a fourth defect fell out of adding it.** Derived as
  `formeOnMoveCategory` by handler shape, carriers printed before wiring. `formeSwap` **threw the
  body's SP spread away** and adopted the new species' aggregated row: five Aegislash moves landed
  **1.31× too hard** and Gyro Ball went the other way — the signature of a stat, not a formula.
  Showdown provably preserves the spread (Palafin 90→180 and 122→212, delta 90 both). One existing
  probe's expected number moved 233 → 244 and **the engine is what moved**.
- **`MEDI_SPREAD` was published to nobody (#114) — registered, and it was already fixed.**
  `medicham2-browser.js` assigned `root.MEDI_SPREAD` and never `module.exports`, so
  `M.MEDI_SPREAD ? … : false` in `game_differential.js:2816` always took the false branch and **the
  0.75× spread multiplier was never applied to a staged span.** Verified on 2026-08-10: on
  `module.exports`, 38 moves, Earthquake present.

### Added
- **`tests/test-roadmap-register.js` now reads COMMIT MESSAGES (#149).** It checked division ledgers
  only, which is why two commits could cite `#145` and `#146` against a register that stopped at #143.
  **It caught a real orphan on its first run — `#114`, cited by `247d26b` and registered nowhere** —
  which is exactly the class it was built for. Scope is the last 40 commits deliberately: a gate that
  fails on ancient numbering schemes gets ignored, which is the disease this repo calls "one of the two
  known failures". Absent git is SKIPPED and said out loud, never counted as a pass.

### Changed
- **`engine/status.js` stamps LOCAL time, not UTC (#150).** `day()` used `toISOString()`, so any run
  after 20:00 EDT printed tomorrow's date beside a file whose mtime was today.

### Notes
- **Beat Up needed no change, and that was confirmed by measurement rather than reading.**
  `-hitcount` 4/4/3/3 on both engines across (clean, burned user, burned teammate, both) on a brought
  four. The user always participates, the party is the four brought, per-hit power is the ally's
  **base** Attack while the attack stat is the **user's**, and there is no contact flag. Will's catch
  on the party size was right and the implementation already matched it.
- **THREE ROWS ARE FILED, NOT FIXED, AND ARE NAMED.** `finalgambit` lost its crit and now diverges on
  `|faint|` vs our `-damage 0 fnt` — the self-KO faint-order family, shared with explosion,
  selfdestruct, memento and mistyexplosion. `steelbeam` agrees to the point (405/810 both) and differs
  only on `[from] Recoil` vs `[from] steelbeam`, the same family as the seven trapping rows. And
  `belch` / `lastresort` / `upperhand` — the unenforced `onTry` use-conditions — are untouched.
- **`tests/test-effective-identity.js` and `tests/test-no-silent-failure.js` ARE RED.** Said, not
  filed. Measured attribution: of the files each names, **13 of 14 and 11 of 12 are byte-identical to
  HEAD** — so this is not tonight's engine edits. `tests/roster.js` alone carries 247 of the 912 raw-read
  delta. **Neither was re-baselined**, because re-baselining is how a real defect gets laundered. The
  two new silent catches in `engine/sheet_usage.js` were mine and are fixed: both now speak to stderr
  and record the failure where a later reader can see it.
- **`data/all-mechanics-fire.json` predates the harness's attribution change** and must be re-run
  before its row counts are quoted again.
- **GATE: CLOSED, 1 of 6, on 8 open register rows.** `test-engine-diff --n 20000` = 0 disagreements
  before, between and after. All three roster stages 0 FIRED-AND-BOARDS-DIFFER / 0 DID-NOT-FIRE.
  Frozen release for the final numbers: `debbbe33ce6d`.

---

## [4.5.0] — 2026-08-10

### Fixed
- **TWO SHIPPED COMMITS CITED ROADMAP NUMBERS THAT WERE NEVER REGISTERED, AND A LATER AGENT REUSED
  THEM.** `0a28580` (4.1.0) names "ROADMAP #145" for the grounded axis and `e7d672a` (4.2.0) names
  "ROADMAP #146" for the sixth gate clause. **Neither existed in §5** — HEAD's register stopped at
  #143 — so the SEARCH agent correctly took #145/#146 for the PP work, and those two numbers now mean
  two different things depending on whether you read a commit message or the register. Re-registered
  as **#147** (grounded axis, open) and **#148** (sixth gate clause, closed), with **#149** recording
  the collision itself. The commit messages cannot be rewritten and are left alone.
- **THE GATE COUNTED 7 OPEN DEFECTS AGAINST A REGISTER HOLDING 8.** #147 first read *"Roost has no
  mechanism at all"* — plainly a live defect, matching none of the sixth clause's phrase list. **The
  ROW was reworded to the register's own vocabulary rather than the regex widened**, because widening
  prose-matching only moves the boundary. The clause errs SHUT on ambiguity and OPEN on unfamiliar
  phrasing, which is the wrong direction; the durable fix is a machine-readable severity field per
  row. **Gate now reads CLOSED, 1 of 6, on 8 open defects.**
- **`status.js` STAMPS UTC WHILE EVERY DATED ARTIFACT USES LOCAL (#150).** Measured 20:43 EDT:
  `engine/medicham2-browser.js` has mtime `2026-08-10 20:41:29 -0400` and `docs/SEARCH.md` renders it
  as `2026-08-11 00:40`. A CHANGELOG entry written in the same session was stamped
  `[4.4.0] — 2026-08-11` against a real date of the 10th, and corrected by hand. Small, and exactly
  the class this repository keeps paying for: **an artifact that looks newer than it is**, feeding a
  staleness comparison that then reads backwards — the reason `engine/provenance.js` already had to
  stop comparing mtimes.

### Notes
- **`tests/test-roadmap-register.js` did not catch the collision and is not wrong to have missed it.**
  It checks that every item a DIVISION LEDGER schedules is named in §5; these citations were in a
  commit message and in the sprint notes, neither of which it reads. Until it is widened, **a number
  in a commit message is not a registered number.**
- **`tests/test-effective-identity.js` and `tests/test-no-silent-failure.js` are RED**, routed to the
  ENGINE agent whose uncommitted work names every offender. Stated here rather than filed: 49 new
  silent catches inside a correctness batch is the defect class this project is built around — a
  capability absent while everything reports success.

---

## [4.4.0] — 2026-08-10

### Fixed
- **PP DID NOT EXIST IN A BOARD POSITION, SO EVERY MILTANK ROLLOUT STARTED AT FULL PP.** (Will:
  *"FIX 1"*.) ROADMAP #144 gave `engine/medicham2-browser.js` real PP the same evening, and it named
  its own remaining gap in its header: *"a rollout STARTS at full PP, because `board.js` does not
  track PP and is not ENGINE's to change."* Measured RED before a byte moved: a position that had
  already spent all 8 of Protect's PP rolled out **8 more — sixteen out of a move that has eight.**
  It is now capped at 8 and the drained body Struggles. `engine/pp_board_probe.js` →
  `data/pp-board-probe.json`; ROADMAP #145.
- **It is not a rounding error despite games ending at turn 6.** The rollout cap is 60, and that gap
  is the defect rather than a reason to shrug at it: a 60-turn playout with infinite PP discovers
  unlimited Protect, unlimited recovery and unlimited redirection — a systematically wrong valuation
  of exactly the positions the search believes it is being clever in.
- **`Board.pp` is per side and per SPECIES, not per slot**, and that was the easy thing to get wrong.
  `switchIn` builds a new mon object every time a Pokemon comes out — correct for stat stages, which
  belong to the slot's occupant — so a table held there would have silently refilled every move on a
  pivot, and pivoting is what a stall line is made of. The mon holds a reference; the ledger outlives
  it.
- **`noteMove` spends PP ABOVE the `worked` gate**, because Showdown deducts below every BeforeMove
  refusal and above the `|move|` announcement: a Protect that failed its own consecutive-use roll, a
  move that missed and a move a Protect ate have all been paid for. Charging on `worked` would have
  refunded every failed stall, which is the one case this fix is about.
- **`dmgMon` seeds the built body AFTER the sheet overwrites `b.moves`**, never before — seeding
  first would key the table to moves the body no longer carries, silently. `rollout_leaf.sideTeam`
  gives the BENCH its ledger too, which is the body that arrives at full PP most easily and the one
  that spent six turns on the field before it pivoted out.
- **The shipped `explore=1.0` playout was clicking empty slots — a defect in SEARCH's own file.**
  `runPlayout`'s uniform draw bypasses `chooseAction`, which is the point of it and is also where
  every selection guard lives, so a drained body answered `|cant|nopp` at execution and wasted the
  turn instead of Struggling: 52 such lines and 0 Struggles on the probe board. The draw now filters
  on selectability and falls back to the chooser when nothing is selectable. `pickByPrior` takes the
  filtered list, or the priors sampler would put the empty slot straight back — the leak WIRE 26
  found on Disable, one layer up.

### Added
- **`engine/pp.js` — Champions PP as one fact.** Maxima are READ off `data/tags.json`'s `pp` row
  (built by `engine/tag_dex.js` from a real `Battle` in `gen9championsvgc2026regmb`), never computed:
  Protect is 8 in this format against 16 mainline, and the mainline `pp * 8/5` rule matches only 85
  of the format's 500 moves. Selectability is modelled as its own predicate with PP as one input, so
  that when ENGINE widens the Struggle condition past PP — a Choice lock plus Disable empties the
  menu at full PP — every caller widens at once.
- **`tests/test-pp-fact.js` — 31 assertions, and it compares BEHAVIOUR rather than source.** It plays
  a real turn and asserts the number MEDICHAM wrote into its own `_pp` equals the number `pp.js`
  gives, at every maxpp tier the format produces (8, 12, 16, 20), because comparing two
  implementations by reading one of them proves nothing.

### Changed
- **Pressure is charged per APPARENT TARGET, so a self-targeting move pays nothing extra.** Measured
  in Showdown rather than reasoned: Protect goes 8 → 3 in five clicks against a Pressure foe and
  against a Levitate foe alike, while Flamethrower goes 16 → 6 against Pressure and 16 → 11 against
  Levitate. An implementation that simply doubles every deduction under Pressure passes the attacking
  arm and fails the Protect one, so both are probe arms. `noteMove` is not told which of two foes a
  single-target move hit, so the extra is charged only when it is unambiguous and
  `ppCounters.pressureAmbiguous` counts the rest — erring low keeps the board's PP an upper bound on
  the truth, which can only under-spend and never invent a turn.

### Notes
- **This is a MECHANISM fix and it is NOT a measurement.** No engine release was cut, and
  `engine/medicham2-browser.js` was being edited by ENGINE throughout. `data/pp-board-probe.json` is
  a receipt that a state is representable, not a leaf value, and must not be quoted as one.
- **It invalidates board-derived rollout numbers further, and that is the right order** — before the
  refit, not after. Nothing MAG scores reads PP: `FEATURES` is still 58 and
  `data/policy-weights.json` keeps its dimensionality, so the fitted vector is untouched.
- **`candidates()` still offers a drained move, deliberately.** Showdown would not, so this is
  probably wrong — and fixing it changes what MAG clicks, which makes it a SEARCH decision that
  deserves its own arm rather than a free ride on a mechanics fix. `Board.slotSelectable()` and
  `Board.mustStruggle()` exist for whoever takes it.
- **THE PP FACT HAS TWO READERS UNTIL ENGINE ADOPTS THE SHARED ONE (ROADMAP #146).**
  `medicham2-browser.js`'s five PP functions are file-local — on neither `module.exports` nor `root`
  — so `board.js` cannot call them and exporting them is an edit in a file SEARCH may not touch. The
  alternative was a copy, which is the hazard CLAUDE.md names by name. Guarded by
  `tests/test-pp-fact.js` rather than merely declared.
- **Measured correction to `docs/_outbox/pp-and-moldbreaker-notes.md`:** `floor(base * 0.8) + 4` fits
  **499 of 500** rows, not 500. Struggle carries `noPPBoosts` and stays at 1/1 where the formula
  gives 4. Nothing downstream is wrong — the number is read, never computed — but the claim as
  written would have to break before the artifact did.

---

## [4.3.0] — 2026-08-10

### Fixed
- **FIVE VERSIONS SHIPPED WITH NO CHANGELOG ENTRY — 3.99.1 through 4.2.0, backfilled below.** Each
  commit announced a version in its subject line and wrote nothing here. This is the living-docs rule
  broken five consecutive times, in the sprint whose own CLAUDE.md section is titled "KNOWN FAILURE"
  IS A BANNED PHRASE.
- **The pre-commit hook was armed and did not fire, which is its own defect.** `.githooks/pre-commit`
  is installed (`core.hooksPath = .githooks`) and checks that version-headed DOCUMENTS do not trail
  `CHANGELOG.md`. It never asserts the converse — that a version named in a COMMIT MESSAGE has a
  matching `## [x.y.z]` heading here. So the one direction that actually happened was unguarded. The
  hook was built on 2026-08-06 specifically to stop `f60b01c`, which stamped `3.60.0` in its message
  with no entry; it then failed to stop the identical thing five more times.

- **`.githooks/commit-msg` — the missing direction, shown RED on six fixtures before arming.** A
  pre-commit hook is never handed the commit message, which is why the check could not live there.
  Blocks `9.9.9: …` and `4.2.1: …` (no entry); passes `4.3.0: …`, `3.98.0: …`, a subject with no
  version, and `fix a typo in the 3.91.0 notes` (a version not at the start is a reference, not a
  claim). Skips mid-rebase, like `pre-commit`, for the same detached-HEAD reason.

- **The harness charged one slot's bug to three unrelated moves.** `engine/all_mechanics_fire.js`
  recorded a game's first protocol divergence and attributed it to whatever row the game was staged
  for. `afteryou`, `sleeptalk` and `snore` — 442 clicks — were each filed as the SUBJECT emitting a
  spurious `-fail`, when the line is `|-fail|p1b: Venusaur`: the PARTNER, mid-move, while every
  subject here is staged at `p1a`. Will read it off the mechanics without seeing the code.
  Divergences now record which slot's move segment they fell inside, and the reporter groups the
  rest as SHARED SUSPECTS.

### Notes
- **THE ATTRIBUTION RULE WAS WRITTEN THREE TIMES AND SHIPPED AS A FLAG, NOT A VERDICT.** Recorded
  because the pattern matters more than the fix. (1) *Compare the slot named on the line* — killed by
  its own fixture: `|-damage|p2a: Feraligatr` names the OPPONENT and is the subject's move landing, so
  the rule would have exonerated the entire Aegislash class while fixing three false rows. (2)
  *Attribute by the move's TARGET*, since After You reaches its partner — Will: *"AFTER YOU IS USED BY
  A FAST POKEMON LIKE LOPUNNY TO MAKE THEIR SLOW PARTNER MOVE FIRST LIKE TORKOAL"*, which is right, and
  measuring it killed the rule: After You's target in this format is `normal`, and `normal` in doubles
  includes the ally — as does Snore's. The dex does not separate these rows. (3) So the divergence is
  **flagged and grouped, never dismissed.** Each earlier version traded a false positive for a false
  negative, and here a false negative is strictly worse: a defect wrongly kept gets investigated, a
  defect wrongly disowned is invisible.
- **The doc pause does not extend to this file.** A changelog entry is the record that a change
  happened; the whitepaper/deck/technical-docs pass is the interpretation of it. Pausing the second is
  a scheduling choice. Pausing the first is how a sprint becomes unreconstructable.
- **A DUPLICATE RUNNING LIST WAS CREATED AND DELETED THE SAME HOUR.** Asked whether the notes list was
  being kept, I searched for `pend|owed|debt|running|defer|todo`, matched nothing, reported the absence
  as fact and started `docs/DOCS-OWED.md`. **`docs/MEDICHAM-SPRINT-NOTES.md` existed the whole time** —
  193 KB, written that evening, and already enforced by this hook's own sprint clause. A failed search
  is not evidence of absence, and a second running list is the "two files that both decide one fact"
  failure this repository has been bitten by repeatedly. The duplicate's content was folded into the
  sprint notes and the file removed; there is one list.

---

## [4.2.0] — 2026-08-10

### Changed
- **A SIXTH GATE CLAUSE — no open, known, unfixed engine defect.** *(Registered as **#148**. The
  commit says "#146"; that number was never in §5 and was later taken by different work — see #149.)*
  (Will: *"THE GATE SHOULDNT BE
  OPEN, SO MANY OF THESE ITEMS ARE DISQUALIFYING FOR THE ENGINE TO WORK."* Right, and the gate was
  wrong rather than the items.) The first five clauses ask whether our two engines agree, whether
  Showdown disagreed about what bots happened to click, and whether something measured it. **None
  asked whether we already KNOW a mechanic is broken** — and we did know, in a register the gate
  never read. That is "known failure" filed one level up.
- **THIS RETRACTS 4.0.0's HEADLINE.** The gate was reported OPEN two commits earlier and is CLOSED
  again here. Nothing about the engine regressed; the gate learned to read the defect register. The
  earlier entry stands as written rather than being rewritten — a prior conclusion is never silently
  amended — but **4.0.0's "the quarantine is lifted" must not be acted on.** The quarantine holds.

### Fixed
- **The first version of the clause OVER-FIRED and that is recorded rather than quietly corrected.**
  It counted any row filed to `docs/ENGINE.md` and reported SIXTEEN, of which four were not defects
  at all (including *"hand MEDICHAM to Fable 5 and make it faster"*) and three had been finished the
  same night. A bar that cries wolf is exactly how "one of the two known failures" begins. It now
  tests the row's own CLAIM, and still errs SHUT on ambiguous wording.

### Notes
- **GATE: CLOSED, 1 of 6 clauses fail**, on 7 registered defects plus 4 found that night and not yet
  registered. Eleven concrete defects, not fifty-one. Selftest 20/20.

---

## [4.1.0] — 2026-08-10

*(Two commits carry this version — `8a38cb3` and `0a28580`. Folded into one entry; the second
supersedes the first and adds the grounded axis.)*

### Added
- **The scenario catalogue — ONE SHAPE PER TAG, NOT PER ENTITY.** (Will: *"START DEVISING TESTS AND
  SCENARIOS FOR EACH MECHANIC (ITEM, ABILITY, MOVE, MON) IN THE GAME THAT WE CAN RUN."*) 920 entities
  across 500 moves, 272 abilities and 148 items carry 217 distinct tags between them, so **217 shapes
  cover all of them** and an entity added tomorrow inherits its shape for free. Plus 357 legal species
  as one `structural` shape needing no battle at all — the cheapest coverage here, and exactly where a
  mainline-versus-Champions error hides.
- **Ten archetypes, and the archetype decides which instrument can ask the question.** `chance` tags
  are marked so nobody builds a one-board test for a coin: a 30% effect that does not fire on one
  staged turn has told you nothing.
- **`faces` — what the subject must be FACING, Will's addition and the catalogue needed it.** (*"IE
  WIDE GUARD NEEDS A SPREAD MOVE AGAINST IT, ITS POINTLESS TO TEST IF IT DOESNT FACE THAT."*) A
  precondition is the subject's own state; `faces` is the ADVERSARY'S action. Omitting it produces a
  green that proves nothing — Wide Guard into a single-target attack, Counter against a special
  attacker, a trap with nobody leaving. It is "A CLICK IS NOT A TEST" one level up, and it explains
  the COULD-NOT-STAGE pile: the harness did not know what the subject had to face.
- **A PROPERTY IS TESTED THROUGH ITS REACTOR**, also Will's (*"HAVE CONTACT HIT ROUGH SKIN TO
  CHECK."*). Every property flag has one, derived rather than listed: contact/Rough Skin,
  sound/Soundproof, bullet/Bulletproof, slicing/Sharpness, punch/Iron Fist, powder/Overcoat. `wind`
  has three reactors and zero legal carriers here; `reflectable` has none at all and is tested by the
  move bouncing.

### Changed
- **ROADMAP #20 RETRACTED — a TYPE IS a reactor.** (Will: *"DYM A TYPE CANNOT BE A REACTOR? ALL TYPES
  HAVE A SORTA ABILITY."*) Fire refuses burn, Steel poison, Electric paralysis, Ice freeze; the type
  chart carries seven more; Prankster names Dark; the trapped volatile refuses Ghost; powder is gated
  in the battle rules. It looked impossible because **type reactions live in FIVE places and only one
  of them resembles a reactor.** A type reactor is cheaper than an ability reactor, not harder.

### Fixed
- **The grounded axis — `isGrounded()` misses its inputs.** *(Registered as **#147**. The commit says
  "#145"; that number was never in §5 and was later taken by different work — see #149.)* It consults
  Iron Ball, Air Balloon, the Flying type **and Levitate** — the claim that Levitate was missing is
  **RETRACTED**, measured at `medicham2-browser.js:1714`. Genuinely absent: **Roost (2,808 clicks),
  Gravity, Smack Down, Magnet Rise and Ingrain**. Seven mechanics read that predicate — Spikes, Toxic Spikes, Sticky Web and all four
  terrains — so one wrong answer is wrong seven ways, and Levitate is wrong on turn 1 with no setup.
  **Roost has NO mechanism at all**: nothing removes a type temporarily, so a Roosting Corviknight
  eats a full Earthquake here and takes zero in the real game.

### Notes
- **Will's Stun Spore question is the sharpest fixture of the night.** It is powder AND paralysis, so
  Grass refuses it before resolution and Electric refuses it at status application. A Grass/Electric
  body refuses it twice over — **an engine missing exactly one of the two gates still passes.**
- **THE GATE CANNOT SEE ANY OF THIS.** The roster compares our two engines; a shared wrong input
  produces perfect agreement. Third such class in one night, after the mainline constants and the
  mega movesets.

---

## [4.0.0] — 2026-08-10

> **SUPERSEDED BY 4.2.0 — DO NOT ACT ON THE HEADLINE.** The gate was reported open here and closed
> again two commits later when a sixth clause taught it to read the defect register. Nothing about the
> engine regressed. **The quarantine was NOT lifted and is still in force.** The entry is preserved as
> written because a prior conclusion is never silently rewritten.

### Changed
- **THE MEDICHAM GATE IS OPEN — all five clauses pass.** Game differential 0 of 20,000 comparisons
  disagree with Showdown; roster items 139 tested clean, abilities 94 clean, moves 427 clean; coverage
  says every used move is measured by some instrument. Zero FIRED-AND-BOARDS-DIFFER anywhere. Census
  408 live / 408 probed / 0 missing.

### Fixed
- **Ten of the eleven blocking move rows closed on their mechanics**: toxic's ramp order,
  clangoroussoul's 33/100 cost, steelbeam's recoil reader, noretreat's `failsIfVolatile`, saltcure's
  `perIfType`, growth's `weatherScaled` boosts, terrainpulse's `byTerrain`, painsplit's `sharesHP`,
  metalburst's scripted target, endure's `survivesAnyHit`. Block and Mean Look closed on a new
  `trapsTarget`; Aqua Ring and Ingrain came off the shelf free.
- **Parental Bond became TWO real hits** and passes Will's own test: frozen leaves the Focus Sash
  holder alive on 1, live KILLS it.
- **Mega movesets, from 44,163 sheet observations.** Of 76 mega rows, **68 differed from their source
  and not one carried an observation record** — nothing had ever observed a mega row, because the
  store names only the base species. Meganium-Mega now reads
  dazzlinggleam/protect/solarbeam/weatherball off 226 observations; Will named Weather Ball from
  memory and the data agrees.

### Notes
- **Copycat is SHELVED BY THE OWNER, not fixed** — *"PUT COPYCAT INTO THE QUARANTINE IM NOT TOUCHING
  THAT"*. Its mechanism is green; the row fails on a separate rule it reveals, and a blanket fix
  breaks Protect, Follow Me, Rage Powder and Helping Hand, all of which must be re-settable.
- **AND THE THING THE GATE DOES NOT SAY.** (Will: *"WE DONT KNOW SPS IN BO3 SO ITS STILL IMPOSSIBLE…
  WE HAVE TO CREATE THE GAMES OURSELVES AND TEST IT ON SHOWDOWN."*) Proved in one number: the bo3
  open-sheet ladder replayed at turn 1, with item, ability, moves and nature declared on both sides
  across 12,071 games, resolves **ZERO of 22,313 damage comparisons to an exact roll.** Champions
  sheets do not declare SP and the legal-SP envelope is wider than the whole 16-roll band. Replay can
  answer "does the engine contradict reality" and can NEVER answer "is the engine exact". The
  instrument that can is the one that BUILDS the game.
- **A STORE WAS MISSED FOR MOST OF THIS SPRINT.** Every usage figure before this commit read
  `games.ladder.jsonl` alone while `games.bo3.jsonl` had been ingesting in parallel since 2026-07-23
  at ~640 games a day. `click_counts.js` now reads both. Blast radius on the gate: one row, already
  fixed on its merits.

---

## [3.99.1] — 2026-08-10

### Fixed
- **The replayer stops scoring turns downstream of a phaze.** (Will: *"I MEAN ROAR IS RANDOM IT
  DOESNT REALLY MATTER WHAT IT DRAGS IN."*) Correct — and the roster's forced-switch arm is right to
  ask only whether the body LEFT. **That judgement does not survive an ALL-TURNS replay.** Roar,
  Whirlwind, Dragon Tail and Circle Throw draw the replacement at random; if the record drew
  Corviknight and we draw Venusaur, every later turn compares two different boards and this instrument
  would charge each of them to the engine. That is scoring a die, which the turn-order comparator
  already refuses to do for a speed tie.

---

## [3.98.0] — 2026-08-10

### Fixed
- **THE ABILITIES CLAUSE OF THE MEDICHAM GATE WAS GREEN OVER 27% COVERAGE AND FIFTEEN UNMEASURED
  ROWS. It now FAILS, on seven attributed engine defects.** (ROADMAP #120, #121, #122.)
  `data/roster.abilities.json` read 84 FIRED-AND-BOARDS-MATCH / 217 COULD-NOT-STAGE / 15
  CONTROL-NOT-QUIET and `engine/quarantine.js` printed `clean: 84 fired and matched` and PASSED.
  After: **2 FIRED-AND-BOARDS-DIFFER, 5 DID-NOT-FIRE, 77 MATCH, 18 CONTROL-NOT-QUIET, 214
  COULD-NOT-STAGE.**
- **A CONTROL THAT IS ITSELF A LIVE ABILITY IS NOW VARIED RATHER THAN CAPTIONED (#121).** Where the
  carrier species has a third ability, `tests/roster.js` plays the identical scenario a third time
  against it and keeps only the leaves whose delta is the same against BOTH controls, in both engines
  — so the measurement cannot depend on which ability was removed. 98 rows were varied this way. This
  format has only 8 quiet abilities and none shares a species with any of the 15, and `buildPair`
  clamps an ability to its species' own list, so no quiet control could ever have been lent in.
- **It immediately caught EIGHT VACUOUS GREENS** — Anger Point, Justified, Rivalry, Keen Eye, Shell
  Armor, Stalwart, Sticky Hold and Slush Rush agreed with the authority about the CONTROL's work
  (Intimidate's −1 Attack on three of them, Weak Armor's and Gooey's drops, Stamina's boost,
  Supersweet Syrup's evasion drop). Anger Point needs a crit the pin never lands; Rivalry needs a
  gender and every body is built genderless.
- **And it caught the instrument's own first answer.** "Nothing survives both controls" was called
  INERT and that is wrong: Anger Point really is inert, Slush Rush is live and coincides with Snow
  Cloak (evasion in snow makes the foe's drop miss — the same board by a different mechanism). Two
  arms cannot separate those, so such a row is UNATTRIBUTABLE and says so.
- **Six rows are DECLARED UNTESTABLE with the pool printed** — Aroma Veil, Flower Veil, Fluffy,
  Imposter, Rain Dish, Solar Power. Derived from the format every run, so a regulation change retires
  the declaration without anybody remembering to.

### Added
- **THE GATE CLAUSE STATES ITS DENOMINATOR (#120).** `data/roster.*.json` carries a `scope` block
  written at the refusal (`cannot(why, 'no-legal-carrier')`, tagged where the refusal happens, never
  matched out of prose), and `engine/quarantine.js` reads it. The abilities clause now reads
  `84 TESTED of 201 IN SCOPE, of 316 total (115 have NO LEGAL CARRIER in this format)` and names all
  18 unattributable rows. An artifact predating the block says **DENOMINATOR NOT CARRIED** and names
  the re-run rather than defaulting to zero.
- **THE ABILITY STAGE CAN ASK FOR A SWITCH (#122), and it closes zero rows.**
  `ability/traps-and-somebody-tries-to-leave` reuses the moves stage's `switchVerdict` rather than
  building a second probe. Arena Trap and Magnet Pull have no legal carrier in this format; Shadow
  Tag's only carrier is Gengar-Mega, whose ability the forme change writes, so its only control is
  suppression — measured dead here (6 leaves in Showdown, 0 in medicham2). The capability proves
  itself: `abilitySwitchWorks()` plays the same fixture with a NON-trapping carrier and requires both
  engines to complete the ask, printed as a selftest line so it can go red.
- `tests/roster.js --keep-shared` leaves `data/roster.json` alone, for a division running beside
  another that holds the shared convenience copy.

### Notes
- **A carrier tie-break was tried and taken back out.** Ranking "has a third ability" above bulk buys
  Rain Dish and Solar Power a second control — and moves Water Absorb onto Politoed, whose
  highest-ranked alternative is DRIZZLE, and Sand Rush and Sand Force onto Excadrill, where the
  staging is inert. Changing the fixture to suit the control is the wrong trade.
- **The seven new reds are ENGINE defects and are not fixed here** — Electromorphosis (Charge never
  applies), Ice Body (no snow residual heal), Curious Medicine (ally stat stages not reset on entry),
  Reckless (no recoil-move base-power boost), Sweet Veil (ally not protected from sleep), Mirror
  Armor (drop not reflected), Supersweet Syrup (evasion drops twice here, once in Showdown).
- **The judgement call, stated so it can be overruled:** an unattributable row is REPORTED in the
  clause text and does not hold the gate shut. Six of the 18 are untestable in this format by
  construction and a clause that can never open is not a gate.



- **ROADMAP #126 — QUICK GUARD WAS THE ONLY BROKEN SOURCE OF PRIORITY REFUSAL, AND THE ENGINE WAS
  TELLING THE TWO SIDE GUARDS APART BY NAME.** Will: *"have quick guard block all prio moves and test
  it against some prio moves not that hard"*, then *"its like armor tail"* — and the second sentence
  is the diagnosis. A +1 priority attack staged against each source of refusal in turn, on the frozen
  release, control first:

  ```
  CONTROL  no guard          25   landed
  Armor Tail 0  Dazzling 0  Queenly Majesty 0  Psychic Terrain 0     all REFUSED
  Wide Guard                 25   landed     <- CORRECT: it stops SPREAD, not priority
  Quick Guard                25   LANDED     <- the only broken source, 927 corpus clicks
  ```

  `quickguard` and `wideguard` carry **byte-identical tag lists** (`priority, neverMisses,
  oneTurnGuard, statusCategory`), so three sites separated them by spelling:

  | site | what it said | what it cost |
  |---|---|---|
  | `playerActionPrimary` | `if(id==='wideguard')` | Quick Guard fell through the cascade to `{kind:'pass'}` — a wasted turn on every click |
  | `buildMon`'s usable filter | `id==='wideguard'` | a declared Quick Guard was deleted from the body before any turn ran |
  | the field | `wgA:false, wgB:false` | a boolean pair whose NAME was the only record of what it guarded against |

- **`engine/tag_dex.js` did not change and no artifact was regenerated.** `data/tags.json` has carried
  `oneTurnGuard.blocks` — `"priority moves"` / `"spread moves"`, derived from each move's own
  `condition.onTryHit` — since the tag was written, and nothing read it. Membership printed before
  wiring: exactly **2** of 500 moves carry `oneTurnGuard`; `ignoresProtect` carries **14** and all 14
  genuinely lack `flags.protect` upstream.
- **Wired onto the gate the ability sources already use**, above the action-kind dispatch, which is
  what makes a Prankster-boosted status move refusable — Showdown tests the *final* priority
  (`if (move.priority <= 0.1) return`). It does not fold into `priorityRefusedAbove`'s single return
  value, because a side condition has its own announcement and its own bypass rule. Spread is answered
  per body downstream so Wide Guard keeps emitting one `-activate` line per shielded body.

### Added
- **Three census probes, each shown red first and each carrying a third arm**, because a two-arm probe
  passes on an engine that makes every guard block everything: Quick Guard blocks a +1 move
  (28 → **0**) *while Wide Guard on the same board still reads 28*; Quick Guard refuses a
  Prankster-boosted Thunder Wave (`par` → **`none`**) *while the same move with no Prankster through
  the same guard still reads `par`*; Feint (no `protect` flag) deals 29 through a Quick Guard that
  reads 0 against Bullet Punch.
- **The first probe written for this was broken and the failure is recorded rather than tidied away.**
  It used Sucker Punch, which fails unless the target is attacking — the defender was passing, so every
  arm *including the control* read 0 and the board looked like universal refusal.
- Counters `MEDSEEN.sideGuardBlocked` (one for the family, since the guard is re-derived from the
  artifact) and `MEDFAILS.guardClassUnknown` (an artifact class this engine has no predicate for — 0).

### Changed
- Census **354 → 357 live, 357 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.**
  Wide Guard's two existing probes are unchanged and green.
- `tests/probe_red_demo.js`: one demonstration re-aimed and one reversal re-anchored, and the reason is
  itself the finding — that file used **Quick Guard as its example of a click the engine models nothing
  for**, which is no longer true. Re-aimed onto `psychup`, which the neighbouring case already asserted.

### Notes
- **Named and deliberately not fixed:** `chooseAction` still name-matches `wideguard`, so a rollout will
  never click Quick Guard (measured: 40 games, 326 turns, `sideGuardBlocked` 0) — the mechanic is live
  through `playerAction`, which is what the live bot, the differential and every probe use. A side guard
  does not fail when its user holds the last action (`onTry: willAct`, a pre-existing Wide Guard gap).
  Wide Guard does not stop spread *status* moves. `ABRA_TAGS_OFF=1` now loses Wide Guard too, because
  the classifier asks the tag.
- **The stall counter, stating which behaviour was assumed (ROADMAP #59).** The authority: a side guard
  never rolls a consecutive-use die, but does `addVolatile('stall')`, which makes a later Protect fail.
  Assumed here: the first half only. The pre-pass line that resets `tookProtectTurns` is byte-identical
  to what it was, so nothing about Protect moved.
- MEDICHAM-only. Nothing refitted, quarantine unchanged, **no roster row claimed closed** — `tests/roster.js`
  was not run. PDFs not rebuilt.

---

## [3.97.0] — 2026-08-10

### Fixed
- **WIRE 147 — THE DAMAGE WAS ONE ROLL MULTIPLIED BY N. Four moves, one root cause, and two of them
  were 2x errors rather than rounding.** `dmgRange` ended
  `if(_hits>1) return {min: floor(roll(85)*_hits), max: floor(roll(100)*_hits), eff}` — everything a
  hit owns individually (its own base power, its own `+2`, its own target) folded into a scalar.

  | move | uses | what it was |
  |---|---|---|
  | Triple Axel | 753 | `basePowerCallback` is `20 * move.hit` — 20/40/60. We applied a flat 20 three times, so the move dealt **exactly half**: 8+8+8 = 24 against 8+16+23 = 47 |
  | Dragon Darts | 126 | `smartTarget: true`. One packet cannot be aimed at two bodies, so the partner took **zero**: −72/0 against the authority's −36/−34 |
  | Beat Up | 320 | every ally's base power summed into ONE packet. The formula's `+2` is paid per packet, so four hits lost three of them: 24 against 28 |
  | Fickle Beam | 38 | a 30% DOUBLE applied as a flat ×1.3 — 80 × 1.3 = **104 base power, a number the move never has**. Measured 54 against 42 |

- **Fickle Beam is the 3.90.0 defect verbatim** — *"the multi-hit count was the MEAN, and the pin never
  lands on a middle"* — surviving in the conditional-power path, with the comment above the line stating
  the averaging as a deliberate choice. It is fixed with the shape ROADMAP #103 already chose rather
  than a second shape: the battle loop draws it off the same rng as the hit count, the crit and the
  damage index; a pure call keeps the expectation, because that is the right object for a price.

### Added
- **A per-hit damage loop.** `dmgRange` is a wrapper over `dmgRangeOneHit`; `hitPlanOf` decides from the
  artifact whether a move's base power is a function of the hit index. **Single-hit damage is unchanged
  by construction** — every other move, multi-hit included, takes one trip with the identical `_hits`
  scalar the old line multiplied by — and was measured anyway: all 500 moves in `data/tags.json`, four
  real turns each, whole-board digests, against the frozen release `f727f7fdee4f`. **2,000 cells, 11
  differ, four moves, and they are the four above.**
- Two `tag_dex` derivations, each with its format membership measured before the pattern was written:
  `variablePower {kind:'perHitEscalates'}` (Triple Axel — the only legal move whose `basePowerCallback`
  reads `move.hit`) and a new `smartTarget` tag (Dragon Darts — the only move in the dex that declares
  the field). `data/tags.json` regenerated: **0 entities removed, 0 added, 2 semantic changes**; the
  other 305 rows moved only their `uses` count, because the ingest appended ~600 sides mid-session.
- Counters `MEDSEEN.perHitDamageLoop`, `perHitBasePower`, `smartTargetSplit`, `conditionalPowerRolled`,
  `conditionalPowerPriced` and `MEDFAILS.hitWeightsDisagree`, `beatUpAllyNoBaseAtk` — all zero on a
  control turn of Dragon Claw and Rock Blast.

### Changed
- **Beat Up's eligibility filter is the authority's now.** Showdown's
  `ally === pokemon || !ally.fainted && !ally.status` short-circuits, so the user is always in the list;
  this engine applied the fainted and status tests to the user too. There were **three** copies of that
  filter and they are now one function, `beatUpAllies`.
- **`tests/test-mechanics.js`'s `reactorPerHit` probe was GREEN on a falsehood** and is corrected: it
  asserted Weak Armor `-2/+4` off Dragon Darts against a body standing beside a healthy partner, where
  Showdown lands one dart. It now stages both ways and reads the partner's stages too.
- The `multiAccuracy` probe's denominator, not its claim: Triple Axel's discount is now measured against
  `d(20) + d(40) + d(60)` rather than `3 × d(20)`.

### Notes
- Census **350 → 354 live, 354 probed, 0 missing, 0 threw, 0 hollow, 0 unarmed, 0 direct-call.** Tag
  coverage 185/196 → 186/197. `tests/test-damage-stages.js` **1728/1728 exact**, unchanged.
- **No engine release was cut, and `tests/roster.js` and `engine/game_differential.js` were not run** —
  `game_differential.js:126` auto-cuts when no release is pinned, which would swap the pointer under
  another agent's measurement. **No roster row is claimed closed.**
- `FEATURE SEMANTICS CHECK FAILED` on `data/policy-weights.json` is unaffected, and here that is a
  measurement rather than a counter read: the per-hit loop DOES execute during the fixture build, so a
  full sandbox of the frozen release was hashed against the live tree — **0 of 58 fixture features
  moved.** REFIT OWED, and it is MEASURE's.
- Full working: `docs/MEDICHAM-SPRINT-NOTES.md`. Living-docs pass deferred under the sprint rule
  recorded at the top of that file.

## [3.96.0] — 2026-08-10

### Fixed
- **THE ITEMS QUEUE: 6 → 3 DID-NOT-FIRE. THREE ROWS, AND EVERY ONE WAS A NAME HARDCODE OR AN
  UNREADABLE AMOUNT — never a missing mechanic.**

  | item | uses | what was wrong |
  |---|---|---|
  | Iron Ball | 139 | `speedMult` was hardcoded to `name === 'choicescarf'`. The CONSUMER existed and worked; the producer starved it |
  | Light Ball | 41 | `statMult` was hardcoded to four names, **all four banned in this format**, and read by nothing at all |
  | Oran Berry | 1 | heals a **flat 10 HP**, not a fraction; the regex read only `maxhp/N`, so `restores` was null and the consumer refused |

- **A WORKING CONSUMER STARVED BY A HARDCODED PRODUCER.** `effSpeed` has read `speedMult` since WIRE 91.
  Iron Ball halves Speed through the identical `onModifySpe` handler as Choice Scarf. It read
  DID-NOT-FIRE for 139 uses because `tag_dex` asked for a NAME. CLAUDE.md's rule — *"match on tag
  shape, never on a name"* — was written for exactly this, and the very next rule in the file records
  that same lesson being learned for Life Orb while this one sat unfixed above it. Derived from the
  handler now; membership in this format is exactly two, Choice Scarf x1.5 and Iron Ball x0.5.

- **A DEAD RULE PRODUCING A DEAD TAG, DESCRIBING EACH OTHER.** `statMult` hardcoded Choice Band, Choice
  Specs, Assault Vest and Eviolite. **All four are `isNonstandard: 'Past'`** — the first three are on
  the format's ban list by name in CLAUDE.md — none has a row in `data/tags.json`, and **nothing in
  `engine/` consumed the tag.** `dmgRange` carried the matching hardcode:

  ```js
  if(phys && att.item==='choiceband')  ACH(1.5);   // permanently false
  if(!phys && att.item==='choicespecs')ACH(1.5);   // permanently false
  if(!phys && def.item==='assaultvest')DCH(1.5);   // permanently false
  ```

  Both derived now. The only member this format has is **Light Ball** — x2 to Atk and SpA, and only on
  Pikachu. The species lock is carried in the tag and honoured in the consumer, because an item that
  doubles everyone's Attack is a different item.

- **A DOCUMENTED GAP IS STILL A GAP.** The residual loop stated plainly that *"Oran restores a FLAT 10
  HP, not a fraction — its param is honestly null and it stays unwired"*. Honest, accurate, and the
  roster read the berry DID-NOT-FIRE anyway. `restoresFlat` is derived beside `restores`; the flat
  amount is an absolute HP count and is deliberately **not** scaled by max HP, which is the whole
  reason they are two fields. Sitrus is unchanged.

### Notes
- **CORRECTED BY WILL THE SAME DAY — what Iron Ball is actually for.** *"iron ball is mostly used in
  fling sets"*. The entry above framed 139 uses as though the Speed halving were the whole value.
  **The Fling half was already wired** (`flingable` carries its 130 BP, the highest in the game), so
  this fix adds nothing there. **But the Trick Room half makes the defect worse than described:** under
  Trick Room the slower body moves FIRST, so halving your own Speed is the point of the item — and
  before this fix the engine gave an Iron Ball holder *double its true Speed in exactly the room it is
  brought for*, moving it last where the real game moves it first.
- **AND THE 139 IS NOT A SOLID NUMBER — ROADMAP #70, met while using it.** `g.sheets` covers 1.7% of
  sides and yields 15 Iron Ball rows; `g.sets` yields 0; `tags.json` says 139. Three sources, three
  answers. **No Fling/Trick-Room split is quoted**, because n=15 cannot characterise 139 and the 139 is
  itself one of the disagreeing figures.
- **Three Fling facts checked and all three were already correct**, so none is queue work: Light Ball
  flings for **paralysis**, Iron Ball flings for 130 BP and **no flinch**, King's Rock flings for
  **flinch** (96 uses, the only legal item here whose Fling carries a volatile).
- **Every regeneration was diffed before it was trusted.** Batch 1: 5 params changed, 0 added, 0
  removed. Batch 2: 2 params changed, 0 added, 0 removed. Roster verdict changes were exactly the
  three predicted rows and nothing else moved.
- Census unmoved at **330 live / 330 probed / 0 missing**; `test-damage-stages` 1728/1728 exact, 0 at
  the wrong stage; `test-engine-consistency` all pass. Release `13bda114d649`, then the flat-heal cut.
- **Still open, named rather than implied:** Big Root (53 uses — multiplies drain heals by 5324/4096),
  Shell Bell (44 — heals 1/8 of damage dealt), Metronome (19 — powers up on consecutive same-move use).
  All three need a new tag AND a new consumer, which is a larger piece than the three above.

---

## [3.95.0] — 2026-08-10

### Fixed
- **THE DAMAGE CALCULATOR NEVER KNEW ABOUT DISGUISE. A WHOLE CLAUSE OF THE MEDICHAM GATE WAS ONE ROW.**
  The damage differential's only remaining disagreement, out of 150 comparisons:

  ```
  chesnaught woodhammer -> mimikyu    showdown 0-0    medicham 120-130
  ```

  Showdown's `disguise.onDamage` returns false, so the **move** deals zero; the `maxhp/8` chip that
  busts the disguise is applied separately, by the ability. `dmgRange` — the calculator every board
  feature, every rollout leaf and `punishExposure` consults — applied neither.

  **Measured with a control, which is what made it undeniable:**

  | | with Disguise | with no ability |
  |---|---|---|
  | Showdown, real turn | lost **20** (= maxhp/8) | lost 117 |
  | our battle **loop** | lost **16** (= maxhp/8) ✓ | lost 130 |
  | our damage **calculator** | **120–142** | **120–142** |

  The calculator returned the **same number with and without the ability** — the deliberate roster's
  own definition of an unwired knob.

- **THE LOOP WAS RIGHT ALL ALONG, WHICH IS WHY THIS SURVIVED.** WIRE 136 substitutes the chip and busts
  the forme, both engines land on the same HP, and ROADMAP #89 recorded the Disguise *model* as correct
  — truthfully. Nobody asked the other reader. **This is the `effMoveType` / `effWeatherOf` defect of
  3.87.0 again**: two readers of one fact, one right and one silent, each internally consistent, so
  nothing failed. The fact is now stated once in `formeOnHitAbsorbs()` and both readers call it.

- **ZERO, NOT THE CHIP — deliberately.** `dmgRange` answers "what does the MOVE do", which the authority
  answers with 0 and which is what the differential compares. The chip is the ABILITY's damage and stays
  with the loop. A hypothetical price therefore understates a click into a fresh Mimikyu by `maxhp/8` —
  stated rather than hidden, and far smaller than the 120 it replaces.

### Changed
- **THE LOOP'S GUARD CAN NO LONGER READ `dmg`, AND THAT WAS THE ONE REAL HAZARD IN THIS CHANGE.** The
  loop's damage comes *from* `dmgRange`, so once the calculator correctly returned 0 the old
  `dmg > 0` test would have been false **exactly when the disguise was there to bust** — the forme
  would never have broken and the chip never applied. Caught before running, not after. The guard now
  asks what it always meant: a damaging move (`bp > 0`) that is not immune (`eff > 0`).

### Notes
- **THE GATE MOVED: 3 of 4 clauses failing → 2.**

  ```
  PASS  game differential              0 of 150 disagree   (was FAIL, 1 of 150)
  PASS  deliberate roster / abilities  84 fired and matched
  FAIL  deliberate roster / items      0 differ, 6 did-not-fire
  FAIL  deliberate roster / moves      23 differ, 24 did-not-fire
  ```

- All four clauses re-measured under **one** release, `a4c7f898ad0e`. Roster abilities, items and moves
  all unchanged (0/0/84, 0/6/134, 23/24/362), census unmoved at **330 live / 330 probed / 0 missing**,
  `test-engine-consistency` all pass.
- Disguise is **149 sheet uses** on Mimikyu. Small in corpus terms and it was a quarter of the gate;
  more importantly it is a *decision* error — the search believed a Wood Hammer killed a Mimikyu when
  the move does nothing at all. Ice Face is the family's only other member and has **0 uses** here.

---

## [3.94.0] — 2026-08-10

### Fixed
- **SHOWDOWN PUTS THE USER'S OWN STAT CHANGE IN *TWO* FIELDS, AND THE BUILDER READ ONE (ROADMAP #110).**
  `build/build_engine_data.js` enriched every move row from `d.self.boosts`. Showdown also has a
  separate `selfBoost.boosts`, and the two moves in this format that use it got **no self-data at all**:

  | move | field | boosts | uses | was |
  |---|---|---|---|---|
  | Clanging Scales | `selfBoost` | `{def:-1}` | 810 | user stayed at 0 Def; Showdown drove it to −1 then −2 |
  | Scale Shot | `selfBoost` | `{def:-1, spe:+1}` | 199 | same, both directions |

  **Roster moves 25 → 23 differ / 360 → 362 match. Exactly those two verdicts changed.**

- **WHY NOTHING LOOKED WRONG, WHICH IS THE INTERESTING HALF.** Close Combat (12,155 uses), Make It
  Rain, Draco Meteor, Overheat, Leaf Storm and Superpower all use `self.boosts` and all read
  **FIRED-AND-BOARDS-MATCH**. The mechanic was demonstrably working on 20,000+ uses, so "the user's own
  drop" looked closed. The hole was a *sibling field name*, not a missing mechanic.

- The two fields are **not** merged blindly. `self` applies on use; `selfBoost` only once the move has
  actually hit something. `selfBoostsOf()` prefers `self`, and **warns** if a move ever carries both,
  rather than silently picking one.

### Notes
- **A 22,277-USE ALARM I RAISED AND THEN KILLED.** Mid-investigation I found the `lowersUser` tag has
  **no consumer anywhere in the engine** across 13 moves and 22,277 uses, Close Combat included, and
  was about to file it as a major hole. It is not one: the engine applies self-drops through
  `MC.moves[id].self` and the `selfBoosts` secondary path, never through that tag. The roster's six
  MATCH rows are what killed it. `docs/LESSONS.md` §5 — the tag having no reader is not the same claim
  as the mechanic having no implementation, and only measurement separates them.
- **The regeneration was asked before it was run**, per the 3.88.0 lesson: **2 move rows changed, 0
  added, 0 removed, 318 → 318 species, 0 species rows changed.** This builder was once one run from
  dropping ten species, so the diff is taken every time and not just when it feels risky.
- Census unmoved at **330 live / 330 probed / 0 missing**; `test-damage-stages` 1728/1728 exact, 0 at
  the wrong stage; `test-engine-consistency` all pass. Release `c587032378a3`.
- **Two rows investigated and NOT fixed, reported rather than left implied.** *Encore* (6,102 uses,
  the single heaviest row left) is **not** the missing action-override I first assumed — `WIRE 24`
  already binds a handed-in action to `_lock`, and Encore sets `_lock` when it lands. The residual
  difference is a **targeting** one: Showdown's second aggressor hit Corviknight for 36, ours hit
  Goodra-Hisui for 55. That needs its own pass. *The lock-in family* (Outrage, Petal Dance, Thrash,
  Raging Fury, Uproar) reads DID-NOT-FIRE because `self.volatileStatus: 'lockedmove'` **has no tag at
  all**, so the engine has nothing to read and the roster's control arm has nothing to strip — but it
  is **101 sheet uses total**, the lightest cluster in the queue, so it is filed rather than built.

---

## [3.93.0] — 2026-08-09

### Fixed
- **THE PARTIAL TRAP COUNTER WAS ONE LOW FROM THE MOMENT IT LANDED — SEVEN ROSTER ROWS, ONE FACT
  (ROADMAP #110).** Bind, Fire Spin, Infestation, Sand Tomb, Snap Trap, Whirlpool and Wrap all
  reported the **identical** difference — `showdown 4 / ours 3` at the end of turn 1, `3 / 2` at the end
  of turn 2 — which is what said it was one fact and not seven bugs.

  `data/tags.json` carried `partialTrap: { turns: '4-5' }`, **typed by hand**, and `'4-5'` is the folk
  description: how many turns of chip the trapped side *feels*. The thing the two engines are compared
  on is Showdown's `partiallytrapped` **duration**, which starts at 5 and is decremented in the
  Residual event **of the turn the trap lands**. The engine initialised from the already-post-decrement
  4 and then ticked it again on that same turn.

  **This is the volatile-duration defect a third time** — Perish Song, then the family in #111, now
  this — and it survived both fixes because this counter lives in `_trap` rather than in `_vol`, so
  neither blast radius reached it.

- **THE NUMBER IS DERIVED NOW, WHICH IS THE ONLY VERSION THAT CANNOT COME BACK.** `engine/tag_dex.js`
  reads the shape off Showdown's own condition rather than restating it: `duration` from the condition,
  `durationRange` `[5,6]` from `durationCallback`'s `this.random(5,7)`, `durationItem` from the Grip
  Claw branch, and `chipPerTurn` from `onStart`'s `boundDivisor` ternary. It **fails closed** — if the
  condition stops parsing the tag goes absent and the family refuses, which is #92's rule.
  - `turns: '4-5'` is **kept, unchanged, beside it.** It is the honest answer to a different question,
    and silently repurposing a field name is how the next one of these starts. Nothing reads it.
  - Grip Claw and Binding Band are both `isNonstandard: 'Past'` here, so the item branches are derived
    and **unreachable in this format** — recorded rather than pretended to be live.

### Changed
- `data/tags.json` regenerated. **Asked what the regeneration WOULD do before running it**, per the
  3.88.0 lesson: **7 `partialTrap` params changed, 0 removed, 0 other params touched.** `klutz` also
  gained a row — that is corpus growth, not this change; every `uses` count moved with it.

### Notes
- **SHOWN RED BEFORE GREEN, ON FROZEN BYTES.** The pre-fix release `b571cfd7a97e` — the one stamped
  into the roster artifact that reported the finding — reads `3 · 2 · 1` where Showdown reads
  `4 · 3 · 2`. The live tree reads `4 · 3 · 2`. Red was *measured on the old bytes*, not asserted.
- **Roster moves stage: 32 → 25 differ, 353 → 360 match.** Exactly seven verdicts changed and they are
  exactly the seven trapping moves; `DID-NOT-FIRE` unmoved at 24, `COULD-NOT-STAGE` unmoved at 91.
  Census unmoved at **330 live / 330 probed / 0 missing** — the family always fired, it just carried the
  wrong number.
- **THE WHOLE-GAME DIFFERENTIAL DID NOT MOVE: 65 of 107 games diverge, on both releases, same seed.**
  Stated because it is the measurement, not because it is the hoped-for result. A game stops at its
  first divergence and these moves rarely reach it, so the fix is invisible at that resolution.
- **A THROWAWAY PROBE READ AS FIVE FAILURES AND WAS WRONG.** An ad-hoc two-engine check reported five
  of the seven still disagreeing. It does not control accuracy: Bind, Fire Spin, Sand Tomb, Whirlpool
  and Wrap are 85–90% and **Showdown missed on turn 1**, shifting its column by a turn. The two
  100%-accuracy members agreed exactly. `docs/LESSONS.md` §5 again — rule out the probe first. The
  roster, which pins the dice, is what settled it.

---

## [3.92.0] — 2026-08-09

### Fixed
- **THE `Tackle` FINDING WAS NOT ONE FILE. A REPO-WIDE SWEEP FOUND FIVE MORE SITES, AND TWO OF THEM
  WERE DEFECTS RATHER THAN COSMETICS (ROADMAP #116).** 3.91.0 found `Tackle` — `isNonstandard: 'Past'`
  — padding the inert slots of `tests/probe_pair.js`. The obvious next question was whether it was
  alone. It was not.

  The `.item =` / `.ability =` surface across **238 files in `tests/` and `engine/` is clean** — the
  only hit is `noability`, which is the blank sentinel. **Move literals are not**, and the two
  categories below are different in kind:

  | site | what it staged | consequence |
  |---|---|---|
  | `test-engine-diff.js`, `test-damage-stages.js` | `Tackle` in every inert slot | cosmetic — those slots never act |
  | `test-degradation-budgets.js` | `['tackle']` as the fallback moveset | a slot with no recorded moves was scored on a move this format does not contain |
  | **`test-priority-block.js`** | `'splash'` to silence three slots | **the silencing worked by ACCIDENT** |
  | **`test-dead-volatile.js`** | `Thousand Arrows`, admitted `if (ta.exists)` | **the guard could never fire** |

- **`test-priority-block.js` SILENCED ITS SLOTS BY NAMING A MOVE THE ENGINE HAS NEVER HEARD OF.**
  Splash is `Past`, and it has **no row in `MC.moves` at all** — so the defender and both partners were
  quiet because the engine could not find the move, not because the move does nothing. That is
  indistinguishable from working until the day it is not. Every classic no-op is gone the same way:
  Celebrate and Hold Hands are `Past` too. Now `CS.INERT_MOVE` (Recycle: legal here, present in
  `MC.moves`, fails outright on a body that has consumed no item), and the file **asserts it has a row
  and 0 base power before it silences anything with it**. Every result unchanged — 21 HP through, 0 HP
  under each blocker, 13 HP under the Grassy Terrain control.
- **`.exists` IS TRUE FOR A BANNED MOVE, SO A GUARD IN `test-dead-volatile.js` COULD NEVER FIRE.** It
  admitted the damaging-move-with-volatile case only `if (ta && ta.exists)`, and Thousand Arrows is
  `isNonstandard: 'Past'` — `.exists` still returns `true`. The branch always ran, always on a move no
  game in this format can contain, and the else-branch that would have said so was unreachable.
  **Merely tightening the guard would have moved the hole rather than closing it**, leaving the case
  untested — so the subject is now derived from the format: the highest-power legal move carrying a
  volatile, which is Smack Down (50 BP, `smackdown`). Eight moves qualify; naming one would rot at the
  next regulation. 16/16 green.

### Added
- `CS.INERT_MOVE` — a filler move for a slot that must not act, **named and justified rather than
  derived.** Deriving one was tried first and abandoned honestly: filtering the format for a status
  move with no declarative effect fields still returns Belly Drum, Rest and Moonlight, because Showdown
  implements those in handlers rather than fields. A filter that cannot be trusted is worse than a
  choice that can be defended, and the same reasoning already governs `QUIET_ABILITY`.

### Notes
- All five sites re-run green: `test-damage-stages` 1728/1728 exact, `test-engine-diff` 0 disagree,
  `test-priority-block` all, `test-dead-volatile` 16/0, `test-degradation-budgets` 11/0. **No number
  moved**, which is the expected result — every one of these was an inert slot or an unreachable
  branch. The value is that they can no longer become live and wrong.
- The remaining #116 work is `tests/staged_board.js` and `engine/game_differential.js` (`buildPair`).

---

## [3.91.0] — 2026-08-09

### Added
- **NOTHING VALIDATED A STAGED BODY, SO A PROBE COULD MEASURE A MECHANIC NO GAME CAN REACH
  (ROADMAP #116).** Will asked the question that closes it: *"why dont we use showdowns teams validator
  that is universal truth"*. `new Battle()` runs **no validation at all** — every probe in this repo
  that assigns `p.ability = ab.id` or sets `p.item` walks straight past every rule in the format, and
  Showdown will simulate a banned item quite happily. Both engines then agree about it and the row
  reads as a **PASS while proving nothing**, which is this project's signature failure.

  `engine/champions_sim.checkLegal()` now asks Showdown's own `TeamValidator` — the same authority
  ADR-002 names and the same instance `packTeam` already builds, so there is one implementation of the
  fact. `tests/probe_pair.js` calls it before it builds anything.

  It catches strictly more than the `isNonstandard` check first proposed for this job:

  | staged | verdict | the authority's words |
  |---|---|---|
  | Rocky Helmet, Assault Vest, Loaded Dice, Silk Trap | **BANNED** | *"does not exist in Gen 9."* |
  | Flamethrower on Meganium | **PAIRING** | *"Meganium can't learn Flamethrower."* |
  | Pure Power on Snorlax | **PAIRING** | *"Snorlax can't have Pure Power."* |
  | Skill Link on Toucannon, Garchomp @ Choice Scarf | LEGAL | — |

  Flamethrower is a **perfectly legal move** — Meganium simply cannot learn it, and only a learnset
  walk knows that. An `isNonstandard` check would have waved it through. That exact set was hand-staged
  by a session on 2026-08-08 while probing Mega Sol, and nothing stopped it.

### Changed
- **THE TWO KINDS OF ILLEGAL ARE SEPARATED, BECAUSE COLLAPSING THEM WOULD HAVE REFUSED EVERY HONEST
  PROBE.** The first draft threw on any validator complaint and was wrong within the hour: `Illuminate`
  is `probe_pair`'s named quiet control, stamped on every body **on purpose** so the control does not
  vary with the species — and it is illegal on Snorlax, Gengar and Meganium alike. Forcing a
  per-species legal control is precisely the Fluffy/Sand Rush failure (ROADMAP #100) that produced four
  false findings across 2,049 uses. So:

  - **BANNED** — the entity does not exist in the format. **Always fatal, never waivable.** There is no
    probe for which a fictional mechanic is the right subject.
  - **PAIRING** — the entity is legal, this species cannot hold it. Legitimate for an isolation probe,
    and therefore **declarable** via `iKnowThisPairingIsIllegal` with a written reason.

  `tests/test-pinch-family.js` declares it once, at its single choke point: every row stages a typed
  ability and its matching typed move on one generic Farigiraf, and holding the body fixed is what
  makes Blaze's row comparable to Torrent's. The declaration waives pairing and **does not** waive the
  ban — proven by a self-test row that passes the declaration alongside a Rocky Helmet and still throws.

### Fixed
- **`Tackle` DOES NOT EXIST IN THIS FORMAT, AND EVERY INERT SLOT IN `probe_pair` CARRIED IT.** Found by
  pointing the new guard at the file that hosts it, within a minute of it running. `isNonstandard:
  'Past'`, like the rest of the class. Harmless — those slots never move — and the same habit that
  produced the Loaded Dice sentence retracted one commit ago: **a name recalled instead of read.**
  `CS.firstLegalMove(species)` now derives it from the species' own learnset, walking the prevo chain.
- **THE VALIDATOR'S OWN PADDING WAS ILLEGAL, WHICH IS THE JOKE WRITING ITSELF.** Champions rejects a
  team of one — *"You must bring at least 6 Pokémon"* — so the subject is validated inside a full team,
  and I named the five filler species by hand. **Sandshrew is not in this format.** Every verdict came
  back carrying *"Sandshrew does not exist in Gen 9."* The pool is now read from the format and each
  candidate is **validated before it is ever used as padding**; a filler that cannot pass alone is
  dropped, not trusted. Filler complaints are reported separately as `fillerProblems` and never folded
  into the subject's verdict.
- An unknown item or move NAME is now preserved verbatim rather than resolved to an empty string.
  `dex.items.get('nonsense')` returns a non-existent row whose `.name` is `''`, and an empty item is a
  **legal** item — so a garbage name would have validated clean. It now reports
  *"'nonsenseorb' is an invalid item."*

### Notes
- `tests/probe_pair.js` self-test: **16 checks, all green**, including four refusals and three
  forgiveness rows. A guard that refuses everything gets switched off, so the forgiven cases are tested
  as hard as the refused ones. `tests/test-pinch-family.js`: **65 green** after declaring.
- The remaining direct-assignment sites are named in ROADMAP #116 and are **not yet guarded**:
  `tests/test-damage-stages.js` (`setAb`), `tests/staged_board.js`, `tests/test-mechanics.js`, and
  `engine/game_differential.js` (`buildPair`). Stated here rather than implied by silence.

---

## [3.90.0] — 2026-08-09

### Fixed
- **THE MULTI-HIT CLUSTER WAS A COUNT, NOT AN ARITHMETIC (ROADMAP #103).** `engine/medicham2-browser.js`
  answered **3.1 hits** — the mean of the 2-5 distribution — to every question ever asked about the
  family, including questions asked by a turn that actually happened. Showdown's own `|-hitcount|`,
  read through `battle.choose` so every hit runs, reports **5 at the differential's top pin corner and
  2 at the bottom** and never a 3: `sim/battle-actions.ts:869` samples a twenty-element table and
  `PRNG.sample` is `items[random(items.length)]`, so the pin selects element 19 or element 0. That is
  why the eleven roster rows split **both ways at once** — too weak against a 5, too strong against a 2,
  on the same move. **The per-hit floor was NOT in it**: `roll()` returns an integer, so with an integer
  count `Math.floor(v*n)` and `n*v` are the same number, and the line at `dmgRange`'s tail did not need
  to change.
- **`rollHitsOf(moveId, rnd)` draws the count, beside `expectedHitsOf`, which stays a PRICE** and is
  still what board features, rollout leaves and `punishExposure` read. The 2-5 table is copied verbatim
  rather than summarised, because the pin reads an INDEX into it. The per-hit accuracy is rolled and
  BREAKS at the first miss (`battle-actions.ts:910`) rather than being discounted by a mean. **One draw
  per move use, lazily**, matching the authority's position in the stream — per target would hit one
  body five times and the other twice off one click.
- **The REACTION count now reads the same draw.** WIRE 84's comment claimed "3.1 → 3, which is what a
  seeded Showdown rolls"; the authority reports 5 or 2. Two implementations of one fact, so Bullet Seed
  dealt five hits of damage while setting off Weak Armor three times.
- Two refusals counted, both reading 0: `MEDFAILS.multiHitRangeNot2To5` (a non-[2,5] range, which would
  DISAGREE between the two engines under the pin — no such move exists in this format today) and
  `MEDFAILS.multiHitNoCount`.

### Added
- **The proof, red before green.** `probe('move','multiHit', 'Icicle Spear lands FIVE hits at one rng
  corner and TWO at the other, as Showdown does')` in `tests/test-mechanics.js`. The knob is the rng
  corner and the measurement is a RATIO against a single-hit copy of the same move **at that same
  corner**, because the corner also moves the damage roll and the crit. Red: ratios **3.10 and 3.10** —
  identical across a varied knob, so the knob is unwired. Green: **5.00 and 2.00**. Census
  **329 → 330 live / 330 probed**, 0 missing. **Double Hit, Dual Wingbeat and Twin Beam are the
  positive control and did not move.**

### Changed
- `data/roster.{moves,abilities,items}.json` re-written on release `b571cfd7a97e`; the previous bytes are
  kept at `data/roster.<stage>.prev.json`. Roster **moves 40 → 32 DIFFER · 24 DID-NOT-FIRE · 345 → 353
  MATCH**; abilities **0 · 0** (the PASS clause, undisturbed); items **0 · 6**, unmoved. Differential
  **1 of 150**, unmoved.

### Notes
- **The published baseline was stale and the correction matters.** `data/roster.moves.json` read
  **50 · 27 · 332** and was generated 2026-08-08 against release `6f7fbc538318` — before ROADMAP #112,
  #101 and #102. Against `9efcae3a60e2`, the tree those landed on, the same stage reads **40 · 24 ·
  345**. The attributable delta of this pass is exactly **−8 DIFFER / +8 MATCH**, which is exactly the
  eight multi-hit members. Same lesson as the interaction matrix on 2026-08-08: compare an artifact's
  mtime to the thing it measured before quoting it.
- **Three rows in the cluster are NOT this bug and are filed separately.** `tripleaxel` (718 uses) needs
  **rising base power** (20/40/60 by hit) and its tag says `variablePower: {computed:true, note:'idiom
  not yet derivable'}` — a `tag_dex` derivation, not a count. `scaleshot` (199) needs its **self-boost**
  and is **blocked on a file this division may not edit**: `MC.moves['scaleshot']` carries no `self` at
  all because `build/build_engine_data.js` writes `mv.self` for pure drops and Scale Shot's is mixed.
  `dragondarts` (124) is **`smartTarget`**, a targeting mechanic that moves a second body.
- **ONE adjacent gap this wire makes reachable for the first time, filed not fixed: Skill Link.** It
  forces a 2–5 move to always land 5 (`move.multihit = move.multihit[1]`), and until now there was no
  count for it to rewrite. **46 corpus uses**; the only legal carriers in this format are Heracross-Mega
  and Toucannon. It has no failing probe yet, so it is not open work.
- **CORRECTED IN THE SAME PASS, and the correction is the point:** this entry first named **Loaded Dice**
  beside Skill Link. **Loaded Dice is `isNonstandard: 'Past'` in `gen9championsvgc2026regmb` — it does
  not exist in this format and has no corpus row at all.** Will caught it. CLAUDE.md's rule is that the
  ban is a MECHANISM and must be read from the format rather than from memory, and this was written from
  memory, in the same session that measured the roster staging zero banned entities. The engine change is
  unaffected; the sentence was wrong.
- **`tests/roster.js:3694` now carries a wrong sentence** — *"a 2-5 range lands on TWO hits"*, printed on
  all fourteen rows of the family. It is 5 at the top corner; the claim is true of the authority's OTHER
  branch (`random(min, max+1)`), which the 2-5 family does not take. No verdict rests on it. Filed for
  whoever holds that file.

## [3.89.0] — 2026-08-09

### Fixed
- **`buffsHolderOnHit` NOW READS ITS CONDITION (ROADMAP #101) — the consumer half 3.88.0 said was
  owed.** `engine/medicham2-browser.js` applied the boost table on EVERY connecting hit, so eleven of
  the family's twelve members produced a **wrong answer on every hit**: Anger Point maxed Attack off a
  NON-crit (and identically on a crit — an unwired knob), Justified fired off Close Combat, Weak Armor
  off Dark Pulse. `condHolds` widened to `condHolds(w, self, hit)` — the cost ROADMAP #112 predicted,
  since `hpFraction` asks about the HOLDER and every #101 condition asks about the INCOMING MOVE.
  Four shapes readable (`crit`, `moveType`, `moveCategory`, `moveFlag`); anything else REFUSES and is
  counted in `MEDFAILS.buffOnHitUnknownCond`, which reads 0. **Stamina — 2,773 of the family's 2,972
  uses and correct throughout — is asserted on both sides of the crit die as the positive control.**
- **This family failed OPEN, unlike the pinch family**, so it was a wrong answer on the board rather
  than an absent one, and every landed condition is an improvement on its own.
- **The `_buff.boosts && tg.boosts` guard dropped every VOLATILE-payload member entirely** —
  `electromorphosis` (98 uses, `charge`), `windpower`, `perishbody`. Still not granted (no consumer for
  a banked Charge; `perishsong`'s duration is carried by the MOVE tag and no ability states one) but
  now **counted at the moment the condition holds** (`MEDFAILS.buffOnHitVolatileUnwired`) instead of
  being a dropped branch. Filed, not fixed, and named.
- **THE PROCEDURAL HEAL FAMILY DID NOTHING AT ALL (ROADMAP #102). 1,024 uses.** Synthesis, Moonlight
  and Morning Sun resolved to `{kind:'pass'}` — a wasted turn, 0.000 HP in every sky including clear,
  and in **sand strictly worse than doing nothing** because the residual still chipped. Measured on a
  155 HP body from half HP before a line changed: 0 / 0 / 0 / **-9**, against Recover's 77.
  `healParam` now sizes them from `weatherScaled.baseHealFraction`, through **`md4096`** (the handler
  is `this.heal(this.modify(maxhp, factor))` with factor literally 0.5 / 0.667 / 0.25 — `maxhp * 2/3`
  is a different number) and reading the **healer's own** sky through `effWeatherOf`, so Cloud Nine and
  Mega Sol's private sun both reach it. On 155 HP: clear 77, sun 103, rain 39.
- **Strength Sap (710 uses) heals again, and is deliberately NOT reclassified as a heal** — WIRE 79's
  Attack drop is the half that decides where the move is played, so the heal lands inside the `affect`
  branch where the target is in hand. Follows the handler in all three parts: a target already at -6
  Attack makes the whole move FAIL, the Attack is read BEFORE the drop, and it is the stat itself —
  boosted and unmodified, spelled the way `sim/pokemon.ts` spells it (multiply on a positive stage,
  **divide** on a negative one).

### Added
- Three census probes, all through real turns: `ability|buffsHolderOnHit` *"Anger Point needs the crit,
  and Stamina does not move"* (four knobs, each against its own control, plus a no-ability arm on the
  same crit); `move|weatherScaled` *"Synthesis heals half, two thirds in sun and a quarter in rain"*
  (staged at **1 HP** — a full-HP body reads 0 → 0 forever and a half-HP body caps the sun arm, hiding
  the 2/3); `move|healsSelf` *"Strength Sap heals by the TARGET's Attack, and drops it"* (the TARGET is
  the varied knob — Alakazam 63, Milotic 72).
- **Census 326 → 329 live / 326 → 329 probed, 0 missing, 0 hollow, 0 threw, 0 unarmed, 0 direct-call.**
  Roster unmoved on all three stages (abilities **0 · 0**, the one green gate clause, undisturbed).
  Differential 1 of 150, unchanged. `data/tags.json` was NOT regenerated.

### Notes — reported, not fixed
- **Growth is +1/+1 where Showdown gives +2/+2 in sun.** `weatherScaled.byWeather.boosts` has no
  consumer, and the build additionally patches `growth` so a private sun grants nothing. 5 uses.
- **`dmgRange` applies boost stages as `Math.floor(x * boostMul(s))` where the authority DIVIDES on a
  negative stage.** They disagree wherever the float lands just under an integer (`s = -1, x = 3`
  gives 1 and 2). Pre-existing, a DAMAGE change, named rather than swept into a heal fix.
- **`status.js` still opens FEATURE SEMANTICS CHECK FAILED on the same eight features.** Verified as
  the identical eight already recorded in `docs/ENGINE.md` — not caused by this pass.

---

## [3.88.0] — 2026-08-09

### Fixed
- **TWELVE MOVES CARRIED GENERIC GEN-9 BASE POWER INSTEAD OF THE FORMAT'S (ROADMAP #104).** Trop Kick
  70 against the format's 85, Mountain Gale 100 against 120, Psyshield Bash 70 against 90 — ours LOW
  in all twelve, 345 corpus uses. `build/build_engine_data.js` now reads base power from
  `Dex.forFormat` rather than keeping the stored generic value, and prints every correction by name.
  WIRE 89's hazard one field over: that WIRE took the secondary CHANCE from the format-aware artifact
  for exactly this reason and left `basePower` alone.
- **`engine/artifact_audit.js` check D** — the registered gate now fails if any written row disagrees
  with the format on base power. Shown RED (12 of 500) then GREEN. It judges only the rows the builder
  WRITES, prints the excluded count, and fails outright on `judged 0` — per CLAUDE.md, averaging over
  rows a builder skips clears the builder that is broken.
- **Independent confirmation nobody asked for:** `data/mag.js` — MAG's own move table, built from the
  format — already carried all twelve correct values. **MAG and MEDICHAM disagreed on every one of
  these until now.** They agree 12/12 after.

### Notes — TWO LATENT BUGS IN THE SAME BUILDER, found by asking what a regeneration WOULD do first
- The mons loop rebuilt a fresh literal, so a regeneration **dropped 10 species** (`victreebel-mega`,
  `feraligatr-mega`, `skarmory-mega`, `barbaracle-mega`, `falinks-mega`, `aegislash-blade`, three
  Gourgeist sizes, `palafin-hero`) and **deleted `nature`, `sp` and `set_source` from all 318 rows** —
  fields a later builder writes. The trial run produced 800 semantic differences, **788 of them
  destruction.** Now preserved, with the kept-species list printed.
- The header stamp regex ended `\*\/\n` while the file has CRLF, so it **matched nothing and never
  has**: `Last generated: 2026-07-24` survived every regeneration on this machine. Fixed, and a stamp
  that fails to land now exits non-zero rather than writing a false date.
- **Reported, left alone:** `data/move-effects.js` still carries the generic `tropkick` bp 70 — a
  second base-power table that now disagrees with `engine-data.js`. Nothing reads `bp` from it
  (medicham2 takes accuracy, secondary, target and priority from there, never power), so it is dormant
  rather than wrong-in-use. Flagged as the next place this divergence can grow back.

### Added
- **`buffsHolderOnHit` NOW CARRIES ITS CONDITION — half of ROADMAP #101, and the half that is done is
  the DERIVATION.** `engine/tag_dex.js` reads it by shape out of Showdown's own handler:
  `angerpoint {cond:'crit'}` · `justified {cond:'moveType', is:['Dark']}` ·
  `rattled {cond:'moveType', is:['Dark','Bug','Ghost']}` · `perishbody {cond:'moveFlag', is:['contact']}` ·
  `stamina when: null` — correctly unconditional, and the one member with real usage (2,773).
  The procedural heal family (`synthesis`, `moonlight`, `morningsun`, `strengthsap`) likewise gained
  its `byWeather` boosts.
  **THE ENGINE DOES NOT READ ANY OF IT YET, SO NOTHING BEHAVES DIFFERENTLY.** Anger Point still maxes
  Attack off any hit. The consumer half is owed and the tag is inert until then — stated plainly
  rather than left to read as a fix.
- `data/tags.json` regenerated and diffed against the committed copy: **0 entities lost, 0 tag sets
  changed**, 251 usage counts moved (the corpus grows hourly), 16 params changed — the conditions
  above. ROADMAP #65's regeneration hazard is measured closed for the second time.

---

## [3.87.0] — 2026-08-09

### Fixed
- **ROADMAP #96 WIRE 3: THE BATTLE LOOP AND THE DAMAGE CALCULATION READ TWO DIFFERENT SKIES, AND A
  MEGA SOL WEATHER BALL DEALT LITERALLY NOTHING TO A GHOST.** `effMoveType` — the loop's type
  authority for the stage-5 immunity gate, the absorb check, the Lightning Rod draw, Protean's retype
  and the Fire thaw — resolved the weather branch off `field.weather` RAW. `dmgRange` resolved it off
  `effWeatherOf`, which applies the PRIVATE sky (the `privateWeather` tag; Meganium-Mega's Mega Sol
  resolves its own moves as if its sun were up while the field reports none). Under a private sun with
  a clear field the damage calc priced Weather Ball as **Fire, 128-151**, and the loop refused it as
  **Normal** — so the mega's headline click was a whiffed turn in every rollout.
  - **The fix is a CALL, not a copy.** `effMoveType` now asks `effWeatherOf`. Re-deriving the private
    sky inside it would have rebuilt the two-implementations defect one line later — which is the
    hazard WIRE 126 was created to close, inside the function WIRE 126 created to close it.
  - **The defender's own suppression is still invisible from that helper and is written down rather
    than handled.** It is handed no defender; in the loop `field.wSup` already covers it, so a `def`
    parameter would be dead code at all five sites.
  - **WIRE 126's declared hold in `clickFragility` is lifted, with its reason kept.** That site did
    not pass `att` because it feeds the `benchRisk` feature and moving it owes a refit. The hold was
    half-effective and the other half was a contradiction inside one function: `base`, two lines
    above, is `dmgRange(att, ...)` and already saw the private sun — measured at `base.max = 151`
    beside `retention 0, "type-immune to Normal (chart)"` on the same call. **`benchRisk` moves for
    -ate bodies and private-weather bodies; a refit is owed at the next release cut. Routed to
    MEASURE, not spent here.**

### Added
- **The probe is the CROSS, because neither half's probe could ever have seen this.** `weatherBall`
  ran through the loop under PUBLIC skies only, where the two authorities agree; `privateWeather` ran
  Mega Sol with Flamethrower, whose type no sky can move. `ability/privateWeatherMoveType` is the
  intersection: a private sky, a move the sky retypes, and a **Ghost** — so the comparison is
  zero-against-a-number and cannot hide behind a multiplier. The third arm asserts **private sun ===
  public sun**, not merely `> 0`, because Showdown's `Pokemon.effectiveWeather()` returns `sunnyday`
  for a `megasol` body and BOTH of Weather Ball's handlers read it (`onModifyType` for the type,
  `onModifyMove` for the base power).
- **Three rows in `tests/probe_red_demo.js`, shown RED before green**, one of them the positive
  control: `shipped[control=0 publicSun=140 privateSun=140]` against
  `reverted[control=0 publicSun=140 privateSun=0]`. Public weather and the Normal-into-Ghost immunity
  are identical on both builds.
- **Census 325 → 326 live / 325 → 326 probed**, 0 missing, 0 hollow, 0 `threw`, 0 unarmed, 0
  direct-call.

### Notes
- **Official engine, played rather than remembered** (`gen9championsvgc2026regmb`, a real battle
  through `battle.makeChoices`, Weather Ball into a Gengar that is NOT Protecting — the first attempt
  had Gengar clicking Protect and read 0 in all four cells, the probe wrong before the engine again):
  no mega + clear sky **0/135 with `-immune`**; mega + clear sky **97/135**; no mega + public sun
  **62/135**; mega + public sun **97/135** — identical to the private sun, which is the equality the
  probe asserts. Ours: control 0, public sun 140, private sun **0 → 140**.
- **Nothing else moved.** Roster unchanged on all three stages (moves 50 DIFFER · 27 DID-NOT-FIRE ·
  332 MATCH; abilities **0 · 0**; items 0 DIFFER · 6 DID-NOT-FIRE); `test-engine-diff` unchanged at
  **1/150**.
- **The paired whole-game differential is IDENTICAL, and the reason is measured rather than assumed.**
  Two arms over one pinned team store and one pinned 326-row census, differing in `--release` and
  nothing else (`arms_comparable.js`: COMPARABLE): 1553 games, **668 / 668** diverged top-tie-first,
  738 / 738 bottom-tie-first, turn-1 boards identical 1520 both. Identical across a varied knob
  usually means the knob is unwired, so it was checked both ways — the arms' `source_digests` differ
  in **exactly one file**, and the cross case run against the two frozen snapshots the arms actually
  loaded gives `privateSun 0` and `privateSun 140`. The instrument then names its own limit: it lists
  `move:weatherBall` and `ability:privateWeatherMoveType` among the **47** census rows it declares
  unmeasurable (`why: "names"` — a census key that is not a tag in `tags.json` steers nothing). That
  count was 46; the new probe's key is synthetic, the same class as the existing `weatherBall` row.
- **The differential's own caveat reproduced and the state figures are quoted only as a paired delta.**
  At this game count the state comparator fails its own planted-divergence proof — one plant, a
  benched member's HP off by one, caught at boundary 11 instead of 10 and reported as
  `field.trickroom_turns` — **in BOTH arms, including the untouched bytes**.
- **RED ON ARRIVAL, NOT CAUSED HERE, AND NOT FILED.** `tests/test-docs-current.js` fails its
  untraceable-figures ratchet: `ABRA-technical-docs` 3 (was 2), `ABRA-whitepaper` 13 (was 12),
  `MODELS` 16 (was 15), `SUMMARY` 2 (was 1). The gained figure in all four is the same one —
  **`7,184` uses in the WIRE 138-140 paragraph** — which matches no number in any `data/*.json` and is
  not in this changelog. Proven not to be this pass's doing by re-running the gate against a
  reconstructed pre-session census: it fails identically. (`tags.json` puts Charm at 1,625 and Parting
  Shot at 8,910, so the figure may also simply be wrong.) Not ENGINE's figure to author or delete.
- **Two STALE reversals and one FAIL in `probe_red_demo.js` are likewise pre-existing and disjoint**
  from this change: a `sealsMoves` tag-strip row, and two WIRE 11 reversals that patch a
  `dmgRange(...)` spread line untouched here.
- **`tests/roster.js` carries stale prose.** Its `move/type-changing` rule still says "the known live
  defect is `effMoveType` reading `field.weather` RAW". That defect is closed; the file was out of
  scope for this pass and the sentence is named in `docs/ENGINE.md` rather than left to read as
  current.

## [3.86.0] — 2026-08-09

### Fixed
- **ROADMAP #105: ~50 ARTIFACTS HAD NO ROW IN THE DEPENDENCY GRAPH, AND ONE OF THEM WAS THE ARM
  MILTANK RUNS.** `engine/provenance.js` discovered a writer only by the artifact's literal name
  beside a write call in `engine/` or `build/`. Everything written by `tests/` — the mechanics census,
  the game differential, the interaction matrix, the deliberate roster, which are the four clauses of
  the MEDICHAM gate — and everything written through a computed path had **no row at all**: not `ok`,
  not UNSAFE, absent. The tool that answers "is this artifact still true" could not see the files that
  answer "is the engine still right".
  - **115 → 160 artifacts with a writer; 61 → 16 without.** The scan reads `tests/`; a concatenated or
    template path (`'roster.' + STAGE + '.json'`, `` `exploitability-${TAG}.json` ``, `+ '.meta.json'`)
    becomes a regex with one wildcard per runtime value; and where no source can say — `fit_policy.js`
    takes its output path from the `OUT_WEIGHTS` environment variable — the artifact's own `by` is
    accepted as the weakest evidence, only if the named script exists. Every row carries a new `via`
    saying which arm found it, so a consumer can tell a write call from a sentence.
  - **`data/rollout-r1-explore1.json` classifies on its own and is HELD.** `engine/quarantine.js` now
    withholds it by its own derived reason instead of the shipped arm borrowing `rollout-r1.json`'s
    classification, so the both-files workaround at `engine/status.js:665` is retired-able. Reported,
    not edited. Quarantine membership moved **34 of 114 → 40 of 160**: the instruments stayed clear and
    the consumers (`exploitability-mag`, `exploitability-machamp`, `scoreboard`,
    `policy-weights-joint-presheet`, `ab-batch-effect`) went behind the gate.
  - **A template match is corroborated, not trusted.** `exploitability-${TAG}.json` also reaches
    `data/exploitability-holdout.json`, which `engine/exploit.js` did not write and cannot — it has no
    holdout mode. A pattern attribution is revoked unless its top-level key shape agrees with an
    artifact the same generator writes by name, and the revocation is printed with its reason.
  - **Four false attributions closed, three of them introduced by this change and caught before it
    landed:** a read `open()` on a line that later contains the one-character string `'w'` (a JOLTEON
    test outranked `engine/ditto.py` and flipped the artifact to not-store-derived); a fixture written
    into a scratch directory taking ownership of the release pointer, fixed by requiring the write to
    be rooted in `data/` including through a helper whose own definition roots it; `writesNear` never
    stripping comments, whose first victim was this file's own new comment crediting
    `engine/provenance.js` with generating an artifact; and `data/regulations.json`, credited to
    `engine/analyze.js`, which only reads it — it is config and has no generator.
  - **UNSAFE 13 → 20, with all eight movements named.** Seven are newly visible and were always
    unsafe — `nature-arms.json` and six run sidecars pinned to superseded releases. The eighth,
    `quarantine-stamp.json`, stamps `engine/provenance.js` by content, so editing this file
    invalidated it by construction; it returned to `ok` when `engine/quarantine.js --check` re-ran.
    Nothing left the UNSAFE set. `provenance.js --strict` remains red on the pre-existing 13, which
    clear via the re-run list (#57), gated behind MEDICHAM (#99).

### Changed
- **The provenance ratchet can tell a DISCOVERY from a REGRESSION, and only one of them fails.**
  `data/provenance-stamp.json`'s `mtime_only` grew **91 → 128** because 38 artifacts became visible
  unstamped, not because anything regressed — 37 of them had no row for the ratchet to hold. The stamp
  now records `graph_files` and `no_writer_files`; a file that was visible and has lost its stamp
  still breaks the ratchet, while a newly visible one is printed in full and appended to a permanent
  `discoveries` list with its date, reason and files, so the growth is auditable rather than laundered.
  The first run cannot split (the old stamp carries no `graph_files`) and says so instead of guessing —
  an artifact-mtime heuristic was tried and accused five instruments other divisions had regenerated
  the same afternoon. Shown RED on a simulated regression before being trusted.

### Notes
- Filed, not fixed: `engine/conformance.js`'s S13 still decides "no generator writes it" with a
  substring scan of source text, so `data/roster.moves.prev.json` keeps tripping it — the answer is
  derived now and S13 should ask `provenance.js --graph --json` for it. `engine/rollout_r1_artifact.js`
  should derive its output path from the dump it read rather than always writing
  `data/rollout-r1.json`. `readsNear` has the same comment hole `writesNear` just lost, but it decides
  `from` and therefore staleness verdicts, so it belongs in a pass that re-derives the drift table.

---

## [3.85.0] — 2026-08-09

### Added
- **THE WHOLE SITE WITHHOLDS NOW, NOT JUST THE STATUS BOARD (ROADMAP #113).** Five pages LOADED a
  quarantined artifact as data rather than quoting its verdict, so the citation checker structurally
  could not see them. Each now loads `web/quarantine-data.js` first and calls `heldFor()` naming the
  exact artifact: `data/mag.js` (the MAG scoring room), `data/mew.js` (the viewer and the replay),
  `data/scoreboard.js` (the whole board). **7 of the Stadium's 15 cabinets go dark** — MEDICHAM, MAG,
  MILTANK, DODUO, WOBBUFFET, MACHAMP, DITTO.
- **THE STADIUM'S ANSWER TO "WHAT DOES A PAGE SAY WHEN ITS SUBJECT IS UNQUOTABLE".** The cabinet keeps
  its seat, its sprite and its verb; pressing `SHOW ME THE NUMBER` returns the quarantine — artifact,
  why it is downstream, which clauses fail, the re-run command. `docs/WEB.md` already held that
  NOT MEASURED is a legitimate outcome of pressing a button and *a control that visibly refuses is the
  finding*; QUARANTINED is that shape with a better reason. It is deliberately **not** a shade of
  STALE: stale means a number aged, this means it was measured through a simulator we have caught
  disagreeing with Showdown. The unit of darkening is the CONTROL, not "any held figure" — MEW quotes
  one borrowed round-0 mirror, so that card reads QUARANTINED and the egg still hatches.
- `tests/test-web-quarantine-loaders.js` — a detector for the class the citation walker cannot see.
  Shown RED first on four synthetic pages: unguarded load flagged; load guarded on the WRONG artifact
  flagged (a bare gate check would wave that through); a guard existing only in a comment flagged.
  33 of 33 harvested figures held with the gate closed, all 33 returned and byte-equal with it open.
  The values were harvested out of the pages by script, **never retyped**.

### Fixed
- **`app/quarantine-data.js` DID NOT EXIST, AND app/ IS THE DEPLOYED COPY.** Without it every guard on
  the published pages takes the healthy path and `app/` goes on drawing from the withheld bundles —
  **the exact `status-data.js` failure of 3.81.0, one day later, in the same directory.** Synced, along
  with five pages that had diverged. `tests/test-site-sync.js` 16 passed, 0 failed.

### Notes
- **A JUDGEMENT CALL, FLAGGED FOR REVERSAL RATHER THAN BURIED.** `replay.html` and index's MEW viewer
  carry **no figure at all** — which is precisely why nothing could see them — and they were withheld
  anyway. The argument: a visitor watching a MEW self-play battle concludes *the engine plays Champions
  correctly*, while the deliberate roster currently reports 50 move stagings resolving differently from
  Showdown. That is a reader misled by a withheld artifact. If a battle is exhibit rather than claim,
  this is the one to reverse; it is one `heldFor` branch in each file.
- **CITING `docs/MODELS.md` LAUNDERS THE QUARANTINE.** `quarantine.js` classifies `data/*`. A page that
  cites the ledger for a number which is really a self-play head-to-head through MEDICHAM is invisible
  to the classifier AND to the new loader detector. Left standing and named: the Stadium's MAG
  `Greedy over sampling 79.7%` and `Self-play improvement 55.9%`, MACHAMP's `+0.34 → +2.75`, MEW's
  `mirror 51.0%`. No artifact was invented for them — the ledger is MEASURE's.
- The Stadium's MACHAMP card said `2 of 6` where `data/ladder.json` says `gensRequested: 8`, and
  `models.html` had it right at "2 of the 8". Withholding **removed a wrong number rather than
  correcting it**; when `ladder.json` is re-run the release entry must be re-harvested, not restored.

---

## [3.84.0] — 2026-08-09

### Fixed
- **ROADMAP #109: THE PHOTOGRAPH FROZE THE SUBJECT AND NOT THE CAMERA — 56 of 65 frozen releases
  could not be opened by their own caller, and every one of the release ladder's 14 rungs is among
  them.** `engine/game_differential.js` died with `TypeError: M.natureL50 is not a function` at
  `flatL50` — 1,280 lines into a file about turn order, naming neither the release nor the symbol nor
  the fact that the snapshot was INTACT and merely predated the export. Measured over the 65 release
  directories on disk: **4 pruned, 1 (`d3d04b669e18`, the oldest with bodies) that predates
  `engine/mc_key.js` being in `SOURCES` at all and failed one layer earlier with a bare
  `Cannot find module`, 56 that predate `natureL50`, and 5 that can serve the current driver.**
  - **`SOURCES` did NOT grow a third time, and that is the decision.** It has grown twice before, both
    times because a release was not ENOUGH (+6 loader deps to LOAD, +5 data files to RUN). Adding the
    driver would have recovered none of the 56, changed every future release id over a file that
    cannot change a number the engine produces, and broken the ladder — `game_differential.js` already
    argues, about `steering.js` and `board_state.js`, that freezing the INSTRUMENT "would mean each
    rung was scored by its own contemporaneous reader, which is the one thing a ladder must not do."
  - **What was missing is a CONTRACT across that boundary.** A release knows what it froze and what
    those bytes export; a caller knows what it needs; nothing asked. `REL.require` now refuses by name
    on a file the release predates, and — when the caller declares `{ need: [...] }` — on a symbol,
    naming the release, its first cut, the missing symbols and the command that lists the releases
    which have them. `REL.path`/`REL.read` go through the same guard.
  - **THIS RECOVERS NOTHING AND THE 56 REMAIN UNRUNNABLE.** Those bytes never held the function and no
    message can put it there. What changes is that they fail in one sentence at second zero, and that
    `compat` answers "which releases can this run use" before the run. The same is true of the two
    earlier `SOURCES` growths — neither repaired a release cut before it either, and neither said so.
- **`engine/game_differential.js` has read `M.MEDI_SPREAD` since it was written and NOTHING has ever
  provided it, including the live engine.** `medicham2-browser.js` assigns `MEDI_SPREAD` to `root` and
  not to `module.exports`, so `M.MEDI_SPREAD ? ... : false` in `mediSpan` has taken the false branch on
  every run — every spread move's staged damage span was priced as a single-target hit. **Not fixed
  here**; the fix is one entry in medicham2's export list, which ENGINE did not hold this session. It
  is now declared `want: ['MEDI_SPREAD']` so the release loader shouts about it on every run instead
  of it staying invisible.

### Added
- **`node engine/engine_release.js compat <file> [symbol ...]`** — the inventory that turns a
  56-release backlog into a list. Every release, in cut order, PROVIDES or LACKS with the symbols
  named. It LOADS the frozen module rather than scanning its text, because a text search finds the
  definition and the `root` assignment and would have answered YES for `MEDI_SPREAD`, which no build
  has ever exported.
- **`REL.surface(id, file)` and `REL.compat(file, symbols)`**, exported for the same reason `sha12` is:
  three files would otherwise each grow their own idea of what a release provides.
- **`tests/test-engine-release.js` section 8 — the OLDEST release on disk.** Every other section cuts a
  release and reads it back seconds later, so nothing had ever opened an old one, which is the one
  that fails first. Shown RED against the pre-fix code (8 failures plus a hard crash) before green.
  It asserts the CONTRACT, not compatibility — the 56 are unrepairable and a test demanding they open
  would be red forever, which this project has already established is the same thing as no test — and
  it clears the control explicitly: the CURRENT release must satisfy the same need list, so a guard
  that refused everything cannot pass.

### Notes
- **`engine/wire_ladder.js` cannot run: all 14 of its rungs lack `natureL50`.** The published ladder
  result on disk stands — it was measured under the driver of its day — but it is no longer
  re-runnable, and the ladder's whole premise is that it is a replay rather than a re-do. Recovering it
  needs a decision nobody has taken: whether `--nature serious` may derive its flat level-50 line from
  something other than the frozen engine's own `natureL50`, which is a second copy of a FACT.
- ROADMAP #57's re-run list is unaffected — it classifies stamps and re-runs against the LIVE engine,
  so it never re-opens an old release. ROADMAP #99's quarantine lift condition does depend on the
  differential, and the differential can now only be run against 5 of the 65 releases.

## [3.83.0] — 2026-08-09

### Fixed
- **WIRE 2 / ROADMAP #112: THE PINCH FAMILY — 9,141 uses, and the refusal that hid them was correct
  the whole time.** Blaze (6,386 uses), Torrent (2,017), Overgrow (689) and Swarm (49) had never
  fired once. `data/tags.json` carried their condition as the SENTENCE `"only below 1/3 HP"`, and
  `medicham2-browser.js` gated on `!_db.onlyWhen` — which is exactly what ROADMAP #92 requires of a
  condition that cannot be evaluated. **The defect was that nobody ever made `onlyWhen` readable**, so
  the refusal was permanent, and the shape the consumer *did* admit is five abilities with **zero**
  corpus uses (`dragonsmaw, firemane, rockypayload, steelworker, transistor`): armed for what nobody
  runs, closed against what everybody runs.
  - `engine/tag_dex.js` derives the gate by SHAPE from Showdown's own `attacker.hp <= attacker.maxhp
    / 3` into `{cond:'hpFraction', of:'self', cmp:'<=', num:1, den:3}`. Nothing is name-matched, so a
    pinch ability added next regulation at 1/4 is picked up with no engine edit.
  - **The fraction is never collapsed to a float.** `maxhp * (1/3)` is not `maxhp / 3` — the nearest
    double to 1/3 is below it, so `150 * (1/3)` is `49.999999999999993` and a body at exactly one
    third would be refused a boost it is owed. `condHolds` asks `hp*den <= maxhp*num` in integers.
  - **Failing closed is unchanged.** An `onlyWhen` shape the engine cannot read still returns `null`,
    still refuses, and is now counted in `MEDFAILS.damageBoostUnknownCond`.
- **`tests/probe_red_demo.js` had been exiting on its second demonstration, so 186 of its 188 had not
  run at all.** `revertedEngine` throws when its patch no longer matches the engine — correctly — but
  the throw escaped and ended the process. A stale reversal is now a counted, NAMED red row and the
  run continues.

### Added
- **`tests/test-pinch-family.js`** — 61 rows, both engines on every one, through
  `tests/probe_pair.js`. Stages both parities of maxhp (divisible by three, where "exactly one third"
  is an integer that must PASS, and not, where the largest passing HP is the floor) and both sides of
  the line; asserts `tag_dex` and `tests/roster.js`'s own regex agree on the threshold; and carries
  the five 0-use members as an explicit positive control. **RED at 31 of 61 before the fix.**
- **`attHP` on `tests/probe_pair.js`** — the attacker's current HP, set on BOTH engines and asserted
  equal alongside species, ability, item and stats. A pinch ability on a full-HP body reads 0 = 0 in
  both arms and proves nothing.
- **A census probe for the boundary** — `ability|damageBoost`, "Blaze fires ONLY under a third of
  maximum HP, and the line is exact". Four arms, because two would pass on three different broken
  engines. **Census 324 → 325 live, 0 missing.**

### Changed
- **`data/tags.json` and `data/abra-tags.js` regenerated.** ROADMAP #65's hazard is CLOSED and this is
  the measurement that says so: a regeneration with NO code change loses 0 entities, 0 tags, 0 usage
  and produces 0 param diffs. The change itself then produces **exactly 5 param diffs** — the four
  pinch members plus `defeatist` — and nothing else. `damageReduce` is byte-identical.
- `tests/test-damage-stages.js`'s printed membership of the narrowed `damageBoost` shape follows the
  engine's clause rather than the old one: 5 → 9 members, still 0 at the wrong stage.

### Notes
- **`MEDI_SPREAD` was exported to nobody, and `engine/game_differential.js` had been running on the
  fallback since it was written.** `medicham2-browser.js:9972` assigns it to `root` only, so
  `require(...).MEDI_SPREAD` was `undefined` across all 65 exports and
  `M.MEDI_SPREAD ? M.MEDI_SPREAD.has(id) : false` took the FALSE branch on **every run this
  repository has ever done** — every spread move's staged span priced as a single-target hit, no
  doubles 0.75, against a Showdown side that applies it. Added to `module.exports`; `SPREAD`'s 38
  members and the `root` assignment are untouched, and `game_differential.js` was not edited.
  - **Landed AFTER the pinch measurement had both arms in hand**, deliberately, so the two deltas
    could not arrive in one before/after.
  - **Its measured effect is ZERO, so the baseline does NOT need resetting.** A third arm
    (`759a0d3292f5`, same pins, COMPARABLE) moves no `state.*` field, no `diverged` count, and
    neither `damage_interior` nor `knock_off_roadmap_80` — **because both damage-span probes stage
    single-target moves**, so the permanently-false branch is one neither ever needed. The defect was
    total; its exposure in the published figures was nil. Until a span probe stages a spread move,
    the fixed branch is untested by anything except the export check itself.
- **The paired differential is an honest NULL.** Same store, same census pin `909dd84f06ac`, same
  1546 games, COMPARABLE, differing only in `--release`: every state figure byte-identical
  (turn-1 97.7%, whole-game 80.3%, boundaries 98.3%, median 8) across two provably different builds.
  The wire is live in the exact bytes the after-arm played — the roster, the 61-row probe and the
  census probe all say so on release `2929deeb41f3` — so this is the sample not reaching the family,
  not a dead knob. No strength claim is made and none can be from here.
- **Roster `--stage abilities`: 1 DID-NOT-FIRE → 0.** Exactly four entities changed verdict and
  nothing else did — Overgrow `DID-NOT-FIRE → FIRED-AND-BOARDS-MATCH`, and Blaze, Swarm and Torrent
  `CONTROL-NOT-QUIET → FIRED-AND-BOARDS-MATCH`. Items, moves and `tests/test-engine-diff.js` all
  unchanged.
- **`data/engine-data.js` gives First Impression base power 90; the dex says 100.** Found because the
  probe's CONTROL arm disagreed with no ability on the body at all. That file belongs to MEASURE;
  reported, not fixed, and printed as NOT COMPARABLE rather than blamed on Swarm.
- **The state differential's own planted-divergence proof fails at `--games 2008` on the current
  store**, in BOTH arms including the before-arm on untouched bytes, so its turn-1 / whole-game /
  boundary percentages are **not quoted for this release**. Sample-dependent: the same proof passes
  26/26 at `--games 45`, and reproduces with the 324-row census as well as the 325-row one.
- **`tests/probe_red_demo.js` is RED at 3 of 188**, none of them this wire's: two STALE ROADMAP #81
  WIRE 11 reversals and one genuine `ARM sealsMoves` row whose stripped arm still holds. Named here
  rather than filed.

## [3.82.0] — 2026-08-08

### Fixed
- **WIRE: THE VOLATILE DURATION FAMILY — the top of the moves queue, 9,092 uses, one mechanism.**
  `Battle#residualEvent` decrements every handler carrying both an `end` and a `duration` **inside
  the Residual event**, so a volatile applied on turn N has already spent one of its turns by the end
  of turn N. `medicham2-browser.js:6588` documents that exact defect — for Perish Song — fixed one
  volatile with it, and left the general defect standing. Taunt and Disable move
  `FIRED-AND-BOARDS-DIFFER → FIRED-AND-BOARDS-MATCH`; Encore's counter row is gone.
  Three sub-rules Showdown carries that this engine had for nobody:
  - **Re-application FAILS.** `addVolatile` returns false when the volatile is present and its
    condition has no `onRestart`, so a Taunt clicked twice was **refreshing** the counter. That alone
    is the whole `t2 showdown=1 ours=2` row.
  - **The counter is adjusted by whether the target has already spent its turn.** `+1 when it has` is
    general; Disable is the one declared exception, because its declared 5 seals four turns.
  - **Encore and Disable need the target's last move.** WIRE 69 hand-wrote that as
    `_e.volatile === 'encore'`, so **Disable never had it** — the `t1 showdown=0 ours=4` row was an
    application-timing difference, not a counter one, exactly as predicted before the work started.
- Both suspected sites were real. `:3556` was a second decrement — and worse than a double-count: it
  was the *only* Encore tick, so in any rollout driven from outside `_chooseAction` the clock never
  moved at all. `:9252` walked `forbidByVolatile().keys()`, a table of **one** (taunt), so Encore was
  outside the tick entirely.
- Cursed Body was writing `turns+1` = 6 where Showdown writes 4; routed through the same helper.
- **`engine/quarantine.js` had eleven silent `catch` blocks**, found by `tests/test-no-silent-failure.js`
  the day they were written. Every one guards a read that is *allowed* to be absent, which is the
  right control flow and the wrong reporting — "a capability was absent and everything reported
  success" is the failure CLAUDE.md opens on, and a gate that cannot read what it polices must not
  report clean in silence. Each now records what it could not open and `--check` prints the tally.
  Fixed by changing the code to satisfy the detector, **not** by widening the detector.

### Changed
- Membership printed before it was wired: `taunt 3, encore 3, disable 5`. **Excluded** Torment and
  Imprison (`turns: null` — a counter would *expire* them) and Gravity and Throat Chop (no volatile).
  The no-restart rule is scoped to that set deliberately: a blanket one catches Protect, Follow Me,
  Rage Powder and Helping Hand.

### Notes — the measurement, and why its baseline is not the one previously quoted
- `tests/test-volatile-duration.js` runs four scenarios through `staged_board.js`, so **no number in
  it is an expectation** — Showdown is. Shown RED on the unfixed release first: 3 of 4 DIFFER, with
  taunt/disable/encore parting exactly as the roster reported. **Perish Song is scenario 4 and is
  asserted explicitly** — the one member already fixed, present so that a change to the shared model
  cannot quietly re-break it while turning three other rows green. Identical before and after.
- **The previously published baseline could not be reproduced, and the reason matters more than the
  number.** Two things that steer the sample had already moved: the census timestamp (regenerating it
  changes its digest, and the digest selects the games) and **the team store, which OPS was appending
  to mid-run — 7,777 → 7,817 teams.** That run was discarded and a fresh PAIRED before/after taken:
  same pinned team store, same census digest, same 2,008 games, same pin, differing in `--release`
  and nothing else. `engine/arms_comparable.js` says COMPARABLE. **The delta is the measurement; the
  absolute is not comparable across days.**

  | | before | after |
  |---|---|---|
  | census | 324 live / 324 probed / 0 missing | **unchanged** |
  | roster moves | 52 DIFFER · 27 DID-NOT-FIRE · 330 MATCH | **50 · 27 · 332** |
  | differential `--nature real` | turn-1 96.9% · whole game **76.9%** · boundaries 98.0% | turn-1 96.9% · whole game **78.9%** · boundaries **98.2%** |
  | differential `--nature serious` | whole game **77.4%** | whole game **77.7%** |
  | `test-engine-diff` | 1 of 150 disagree | 1 of 150 |

- **Encore fell out halfway.** Its counter row is gone; it remains DIFFER on **HP only**, and that is
  a different mechanic — Showdown's `encore.condition.onOverrideAction` replaces the target's chosen
  move, while medicham2 honours the lock only inside `_chooseAction`, so a scripted or
  caller-supplied action walks past it. Its own row, not swept in.
- **An instrument hazard worth carrying forward.** The first version of this fix rewrote the literal
  line `const _sm=TAGS.param('move',a.mv,'sealsMoves');` — which is exactly the string `tests/roster.js`
  nulls for its `move/volatile` red demonstration. The demo would have matched nothing and **silently
  stopped demonstrating.** The helper now takes the tag params as an argument, so severing either
  half is visible.
- `data/interaction-matrix.json` was NOT republished: a `--full` run stages 1,582 live cases against
  the artifact's 1,643 and the instrument correctly refuses to let a shallower run replace a deeper
  one. It agrees 1,567/1,582 (99.1%) and **no taunt/encore/disable pair is among the disagreements**,
  which is the check this change needed.

---

## [3.81.0] — 2026-08-08

### Fixed
- **THE QUARANTINE'S OWN SELFTEST WAS RED, AND `--check` WAS EXITING 1 REGARDLESS OF CITATIONS.**
  `rosterStage()` accepted any artifact declaring `stage: 'all'` for ANY requested stage name, so the
  moment `data/roster.all.json` first landed (3.80.0) the selftest's own probe for a nonexistent stage
  started matching a real file. The probe was right and the reader was wrong: `all` is a claim about
  items, abilities and moves, not a wildcard. Now scoped to `ROSTER_STAGES` explicitly. **This is the
  one case the whole file turns on** — "a MISSING stage is a FAILING clause, never a passing one" —
  so it failing silently would have let absence read as success, which is the defect the gate exists
  to prevent. 20/20 green.
- **`app/` WAS A BLIND SPOT IN THE CITATION WALKER, AND IT IS THE DEPLOYED COPY.** `citations()`
  walked `docs/` and `web/` only. So WEB closed all five leaks in `web/status-data.js`, the check went
  green, and **`app/status-data.js` went on quoting the same five withheld verdicts to anyone opening
  the site.** A checker whose blind spot is exactly the published copy is worse than none: it
  certifies the leak. The walker now covers `app/` too, which immediately surfaced the five rows, and
  the mirror has been re-synced from `web/` (`tests/test-site-sync.js`: 16 passed, 0 failed).

### Added
- **A WITHHELD FIGURE IS ABSENT ON THE BOARD, NOT CAPTIONED.** `web/build-status.js` now asks
  `engine/quarantine.js` — `medichamIsCorrect()`, `classify()`, `withholder(gate, rows)` — rather than
  carrying a hardcoded list, so the exemption lives with the rule. **13 slots withhold**: the whole
  MEASURE headline block, the weights, R1–R4, the explore sweep. A withheld slot carries **no value
  at all** and renders as a redaction bar at the exact size a number would be, with the artifact, why
  it is downstream, the failing-clause count and the command that re-runs it.
- `tests/test-web-quarantine.js` drives the shipping `buildPayload` twice over one classification,
  changing only the gate — **no `--force-open` flag anywhere**, because anything that can silence this
  from the command line eventually does. Shown RED first: with the pre-change behaviour the guard
  reported `withheld slots: 0 (requires >0)` and `leaked verdict strings: 5`, by name.

### Changed
- Three generators declared NOT A MODEL in `tests/test-stadium-roster.js`, each from the file's own
  header rather than inferred from its name — `diff_swarm.js` ("TEAM SELECTION FOR THE WHOLE-GAME
  DIFFERENTIAL"), `leaf_engine_contrast.js` ("DOES A MORE CORRECT ENGINE MAKE BETTER PREDICTIONS?"),
  `mega_decision_census.js` ("IS 'WHEN DO I MEGA' A DECISION, AND IS IT FITTABLE?"). The check warns
  that a wrong declaration stops it asking permanently and silently, so the evidence is quoted in the
  table where a reader can check it.
- Four board slots had gone dark or silently truncated because `engine/status.js` changed its wording
  underneath them: `provenance` rendered "did not run under status.js" (false), the store table showed
  1 of 3 files, `refit_moved` emptied when the refit went OWED **while its caption still asserted the
  refit was CLEAN**, and `missing_list` rendered NOT MEASURED at a census of 324/324 — telling a
  visitor nobody had checked. Empty and absent are now different answers.

### Notes
- **Five pages under `web/` LOAD a quarantined artifact as data rather than quoting its verdict**, so
  the citation checker never saw them: `index.html`, `replay.html`, `scoreboard.html`, `stadium.html`,
  `models.html`. Detecting this needs a different probe — walk the `<script src>` and `fetch()`
  targets, not the text. Filed; the Stadium's cabinets ARE those figures, so it is a design question
  and not a mechanical edit.

---

## [3.80.0] — 2026-08-08

### Added
- **FIFTEEN ABILITY SHAPE RULES, AND THE INERT BUCKET COLLAPSED.** 124 abilities covering 72,609 uses
  were falling through `ability/generic` — which stages a plain attack — so Showdown's own board came
  out identical with and without them and the roster reported INERT. That reads as "nothing to test"
  when the truth was **the condition was never created**: Blaze needs the user under a third HP,
  Defiant needs a stat drop, Chlorophyll needs sun, Lightning Rod needs an Electric move aimed at its
  ally. The bucket is now **59 abilities / 4,261 uses — 94.1% of the usage gone**, checked
  entity-by-entity against the pre-change artifact for regressions. Nothing left in it is above 500
  uses. New rules: pinch-offense, stat-drop-reaction, redirects-a-type, absorbs-a-type,
  type-conversion, no-recoil, survives-from-full, unconditional-stat-multiplier, base-power-scoped,
  damage-taken-scoped, speed-on-item-loss, weather-speed, weather-evasion, weather-residual,
  priority-mod, blocks-priority, aids-its-ally, entry-aids-ally, blocks-foe-berry.
  **All 22 ability rules CAUGHT their own break.** Two did not on the first attempt — `blocks-priority`
  was anchored on a logging line and `unconditional-stat-multiplier` on the wrong tag — and were
  re-anchored rather than declared.
- **`--write` IS STAGE-PRESERVING (ROADMAP #107).** It writes `data/roster.<stage>.json`; `--stage all`
  writes `data/roster.all.json`; `data/roster.json` remains a labelled convenience copy. An overwrite
  is ANNOUNCED — the outgoing artifact's stage, release, timestamp and counts are printed and its
  bytes kept at `data/roster.<stage>.prev.json`. One file could not carry three stages, and a moves
  run had already destroyed the abilities results twice in one day.

### Changed
- **THE QUARANTINE GATE NOW READS EVIDENCE INSTEAD OF ABSENCE.** Two of its four clauses had been
  failing purely because no artifact existed. All three roster clauses now read real per-stage
  content: items 0 differ / 6 did-not-fire, abilities 0 differ / 1 did-not-fire, moves 52 / 27. The
  gate is still CLOSED, which is the correct answer — but it is closed on measurement now.

### Fixed
- The mirror test is down from 6 caught pairs to 4. **Fluffy↔Sand Rush and Water Absorb↔Water Bubble
  are gone** because each member now has a staging of its own that does not use the other as control.
  Sand Rush, Chlorophyll, Swift Swim and Slush Rush all return FIRED-AND-BOARDS-MATCH under the new
  `ability/weather-speed` rule — the positive control this pass was required to pass, on the grounds
  that a rule family which cannot confirm a known-correct ability is not measuring anything.

### Notes
- **THE PINCH FAMILY IS DEAD — 8,524 uses.** Blaze 5,903, Torrent 1,924, Overgrow 651 and Swarm 46 all
  carry `onlyWhen: "only below 1/3 HP"` as PROSE, and the `damageBoost` consumer at
  `medicham2-browser.js:2761` requires `!_db.onlyWhen`. So none of the four has ever fired. The
  refusal is CORRECT under ROADMAP #92 — a guessed condition is worse than none — and the defect is
  that `onlyWhen` was never made machine-readable. The consumer's comment names its live members
  (dragonsmaw, firemane, rockypayload, steelworker, transistor) and says outright *"All five are 0
  corpus uses"*: it is armed for the abilities nobody runs and fails closed on the four everybody
  runs. Overgrow is the only member the roster can stage cleanly, which is why it is the row that
  surfaced; the other three sit in CONTROL-NOT-QUIET and are not unaffected.
- **CONTROL-NOT-QUIET now holds 20 abilities over 14,014 uses** (Blaze 5,882, Flower Veil 3,112,
  Torrent 1,910, Solar Power 797…). These are **not findings**. The condition was created and the
  delta is real, but no carrier of those abilities in this format has a quiet second ability, so the
  delta cannot be attributed to the subject. That is a fixture limit of the FORMAT and it is the
  honest ceiling for those rows — recording it as a verdict would repeat the contaminated-control
  defect that 3.79.0 fixed.
- **Six more times the instrument was wrong before the engine was**, written up in `docs/ENGINE.md`:
  Pure Power staged through a *special* click for an ability that doubles Attack; a drop-cover
  covering the same two stats twice; Keen Eye briefly losing a green it already held; `speedOnItemLoss`
  catching Sticky Hold **again, by name**; the ally rule throwing six games because `INERT` is a status
  move and Taunt forbids those; and a mutual-KO requirement retiring three known-correct abilities.

---

## [3.79.0] — 2026-08-08

### Added
- **THE QUARANTINE. EVERY FIGURE DOWNSTREAM OF MEDICHAM IS WITHHELD UNTIL MEDICHAM IS CORRECT.**
  Will's standing call: *"all engines that take medicham's output should be regarded as out of date
  and we should stop referencing them until medicham is up to date and we can rerun them."* New
  `engine/quarantine.js`, registered as a gate in `tests/run-all.js`, and a new CLAUDE.md section.
  `docs/DIVISIONS.md`'s graph is one-way — MEDICHAM → board.js → MAG weights → MILTANK baselines —
  so a wrong simulator does not stay in ENGINE, it reaches every number to its right.
  Withheld: R1, R2, R3, R4, leaf calibration, engine-correctness→leaf, click censoring,
  `policy-weights.json` and the joint weights. **34 of 114 artifacts.** Membership is DERIVED, not
  typed: the transitive closure of *requires the simulator*, seeded from `medicham2-browser.js`
  alone. Still printed in full: the census, the differential, the interaction matrix, the roster and
  every OPS store figure — they MEASURE MEDICHAM rather than consume it, and the store is upstream.
- **A CAPTION IS NOT A QUARANTINE.** `status.js` had been printing `PRE-CHANGE` and *"[engine moved
  since; transfer assumed, not measured]"* beside these numbers for days, and they went on being
  quoted anyway — including by the session that wrote this entry, to Will, on this date. That is the
  same failure as a red gate reported for two days as *"one of the two known failures"*: the number
  renders, the caveat is skimmed, the number gets used. **The figure is now ABSENT, not annotated.**
- **THE GATE IS COMPUTED, NOT REMEMBERED.** Quarantine lifts only when the differential shows zero
  disagreements AND the roster shows zero `FIRED-AND-BOARDS-DIFFER` and zero `DID-NOT-FIRE` across
  items, abilities and moves — read out of artifacts every run. **A MISSING STAGE IS A FAILING
  CLAUSE, NEVER A PASSING ONE.** Demonstrated RED on a hand-removed withhold before being armed, and
  demonstrated to LIFT: gate closed → 34 of 34 withheld, gate open → 0 of 34.
- **`tests/roster.js` GREW 26 MOVE SHAPE RULES, AND THE MOVES STAGE RAN FOR THE FIRST TIME.** The
  stage had been a stub: `--stage moves` dispatched and every one of the 500 legal moves returned
  *"no shape rule in this file matches its data shape"*, with `all 0 derived clicks`. The file's own
  header had DESCRIBED move rules reading `target`, `category`, `basePower`, `status`, `boosts`,
  `volatileStatus`, `weather`, `flags` since it was written. They were never implemented — prose kept
  as if it were built, in the file whose entire purpose is to end hand-maintained lists.
  All 500 staged in 15s: **330 match, 52 differ, 27 did not fire, 91 could not stage.**
- **`tests/probe_pair.js`** — one way to stage the same body in both engines, which REFUSES to return
  a number when the two bodies disagree. It also refuses a move carrying `onModifyType` (a direct
  `moveHit` never runs `ModifyType`, so the reported type is the unconverted one) and owns the
  damage-roll index convention in one place. Nine self-tests, including one that pins the actual
  defect: it asserts `buildMon('snorlax')` really does ship `thickfat`.

### Fixed
- **THE ROSTER'S CONTROL ARM WAS MEASURING THE CONTROL, NOT THE SUBJECT.** `ability/generic` built
  its control by swapping in another live ability, so the delta belonged to the control and the
  VERDICT accused the subject. Six findings were false. The mirror image is the proof — Sand Rush's
  control was Fluffy and Fluffy's was Sand Rush, and their deltas were the same two numbers swapped.
  A contaminated arm now emits `CONTROL-NOT-QUIET` *before* any accusing verdict, and a mirror test
  runs over the roster's own results: 25 pairs checked in the abilities stage, **6 caught**
  (Fluffy↔Sand Rush, Refrigerate↔Snow Warning, Gooey↔Shell Armor, Keen Eye↔Weak Armor, Water
  Absorb↔Water Bubble, Corrosion↔Toxic Debris). Zero in the moves stage, and that zero is printed.
  The abilities queue went from 2 differ + 4 did-not-fire to **0 and 0**.

### Changed
- `docs/LESSONS.md` §5 gains three lessons after FIVE instrument failures in one session, taking the
  running count to about twenty-five: `buildMon` hands you the species' real ability while the other
  engine's body gets a different one; against a neutral defender a wrong TYPE and a wrong MULTIPLIER
  are the same number; and an artifact is a photograph of the engine that wrote it while `status.js`
  prints it forever. The meta-lesson is now stated outright — **a red result is evidence about the
  PAIR (probe, engine), and the probe is both cheaper to check and the more likely culprit.**

### Notes — RETRACTIONS, stated rather than quietly dropped
- **Weather Ball is CORRECT** in all four skies, including sand→Rock and snow→Ice. It was reported
  broken on 8,620 uses. The probe gave the MEDICHAM Snorlax **Thick Fat** out of `MC.mons` and the
  Showdown Snorlax `abilities[0]` = Immunity; Thick Fat halves Fire and Ice, which is exactly the arms
  that went red. Both hypotheses offered at the time — "we convert to Water in every weather" and
  "the BP doubling is missing" — fit equally, because against a neutral defender they are one factor.
- **Sand Rush (1,426 uses) and Damp (623) are CORRECT.** `effSpeed:3658` reads the `speedCond` tag and
  doubles Speed in the right weather only; Damp is consumed at `:7203` across all four actives.
  Absence of the NAME in the simulator is not absence of the wire — the engine reads the tag, which
  is the correct design.
- **Solar Beam's charge turn was overstated.** The loop does charge (`:7165`); the comment at `:2330`
  describes a hole larger than the one that exists. It is a pricing gap in `dmgRange` only.

### Notes — FOUND AND FILED, not yet fixed
- `effMoveType` (`:2167`) reads `field.weather` raw while `dmgRange` reads `effWeatherOf`, so under a
  private sky the loop calls Weather Ball Normal while the damage calc prices it Fire. Meganium-Mega
  Weather Ball into Gengar, clear sky: **Showdown 115, ours 0.** One fact, two readers.
- The volatile DURATION family — Encore 5,599, Taunt 1,714, Infestation 971, Disable 808, **9,092
  uses on one rule.** Showdown decrements inside the Residual event (`battle.js:342`), ordered by
  `onResidualOrder`, so a volatile applied on turn N is already decremented by the end of turn N.
  This is the Perish Song bug again; that fix was applied to one volatile and every other
  duration-bearing volatile still has it.
- 12 moves carry generic gen-9 BASE POWER instead of the format's — Trop Kick 70 vs 85, Mountain Gale
  100 vs 120 — ours low in all 12, 345 uses. WIRE 89's hazard one field over. Confirmed twice by two
  independent instruments whose measured damage ratios match the BP ratios to three decimals.
- The procedural heal family resolves to `{kind:'pass'}` — Synthesis, Moonlight, Morning Sun and
  Strength Sap heal 0.000 in every sky, 1,024 uses, Strength Sap 693 of them.
- `buffsHolderOnHit` checks no condition and drops `gainsVolatile` entirely, so Anger Point maxes
  Attack off ANY hit rather than a critical one, and Electromorphosis is skipped.
- **56 of 62 frozen releases cannot be opened by the live driver.** `game_differential.js` is not in
  `engine_release.js`'s `SOURCES`, so the photograph freezes the subject and not the camera; a driver
  that began calling `M.natureL50` cannot open any release cut before that export existed. This
  undercuts the re-run list and the quarantine's own lift condition, and it is the third instance of
  the shape SOURCES already grew twice to fix.
- `data/interaction-matrix.json` is two days and 141 WIREs behind the simulator. Its nineteen parting
  rows describe a different engine and must not be treated as a bug list until it is re-run.

---

## [3.78.0] — 2026-08-08

### Added
- **THE SHEET'S REAL NATURE NOW REACHES BOTH ENGINES.** `buildPair` hardcoded `nature: 'Serious'`
  while the stored sheet beside it said `Modest`, so the whole-game differential threw away the single
  largest legal lever on a body we can actually observe, on 100% of them. Both sides are now told the
  nature and **each computes its own line** — nothing is copied, which is the rule the flat build
  existed to protect. New gate `tests/test-nature-differential.js`, 13 checks, with the mega case
  red-demonstrated on a planted break.
- `--nature real|serious` is a RUN PARAMETER and rides in `mode`, beside the pin digest and the credit
  rule, so `engine/arms_comparable.js` REFUSES a before/after spanning it. `serious` reproduces the
  pre-2026-08-08 build exactly, which is how the two arms of this measurement differ in one parameter
  and in no bytes at all.
- `natureShift` / `natureStat` / `natureL50` exported from `medicham2-browser.js` as FACTS, beside
  `md4096`. The paste path's own `Math.floor(x * 1.1)` was folded into them; the arithmetic is
  Showdown's fixed-point `tr(tr(stat * 110, 16) / 100)`, verbatim.

### Fixed
- **THE MEGA PATH WOULD HAVE LOST THE NATURE.** `megaEvolveNow` swaps stats as
  `megaL50 + (st - baseL50)`; with `st` natured and the anchors not, the delta is (mul − 1) × baseL50
  and the mega lands short on exactly the stat the nature moved — mid-turn, with no seam to re-align
  in, because `formeChange` -> `setSpecies` recomputes Showdown's `storedStats` from the SET. Both
  anchors now carry the body's nature. Staged: a Jolly Abomasnow @ Abomasite reads Speed 55 with the
  fix and 58 without it, and the planted break was caught reporting exactly 58.
- **`ALIGN_MOVED` READ 21 FOR THE FIRST TIME, AND ALL 21 ARE DITTO — NOT THE NATURE.** It read 21 in
  BOTH arms. `battleInit` applies entry effects, which since 3.76.0 include Imposter, so the medicham
  Ditto had already transformed by the time the alignment read it; Showdown's had not entered yet. The
  alignment then wrote medicham's COPIED line onto Showdown's `storedStats` **and `baseStoredStats`**,
  rebasing Showdown's Ditto onto another Pokemon's stats before the game began — and "do the two
  engines' Imposters copy the same thing" was being answered in medicham's favour, silently, on every
  Ditto in the pool. The alignment now compares the line AS BUILT, snapshot before `battleInit`, and
  the counter is back to 0 with the question restored.

### Changed
- **THE MEASUREMENT, 1,998 games per arm, same frozen release `72e361e1bd44`, same pinned census, same
  frozen team store, same pool digest `32b2abcbfeb7`, `threw` 0 in both.** THE NUMBERS FELL, as
  predicted before the run: board identical at end of turn 1 **97.4% -> 97.3%**, games whose board
  NEVER parted **80.8% -> 78.8%** (1615 -> 1574), median turn of first board divergence **8 -> 7**,
  protocol games diverged **839 -> 874**. The receipt for why is the tie counter: tied speed groups the
  resolver had to break fell **348,595 -> 243,467, a 30.2% drop**. The rig was manufacturing its own
  speed ties and is now testing turn order it had never tested. A rise would have meant the knob was
  not wired.
- Fields the natures exposed, games in which that leaf differed: `party.hp` +13, `active[].hp` +12,
  `active[].boosts.atk` +11, **`active[].vol.encore` +9 (10 -> 19, nearly doubled)**, `active[].item`
  +6, `active[].boosts.def` +6. Protocol classes move the same way: `ordering` 238 -> 245, `event
  missing from medicham2` 206 -> 216.
- The alignment counter and the nature fallback counter both NAME what they counted now. A bare `21`
  or a bare `96` cannot be acted on.

### Notes
- **THE SPREADS ARE NOT MISSING FROM OUR INGEST — THEY ARE NOT IN THE GAME.** A Showdown open team
  sheet reveals species, item, ability, moves, nature, gender and level and NOT the spread: every
  stored sheet reads `"evs": null`, on 173,784 of 173,784 bodies in the frozen store. Will worked this
  out himself and it is the correct constraint. **ROADMAP #68's declared gap is NARROWED and NOT
  CLOSED**, and that sentence is in the run's own output and in `rate_excludes` so the next reader does
  not have to find it in a document.
- **THE CONTROL WAS CLEARED EXPLICITLY.** `l50` grew an argument and `megaEvolveNow` grew two, so every
  body this engine has ever built went through edited arithmetic. Measured against frozen release
  `6b5447db1738` rather than argued: all 344 un-natured `buildMon` stat lines and all 75 un-natured
  mega swaps are identical.
- 96 bodies fell back to Serious and all 96 are the differential's OWN hand-written fixtures — the
  frozen store carries a dex-valid nature on 100% of bodies. The authority decides whether a string is
  a nature; `natureShift` answers `{plus:null,minus:null}` for a neutral nature and for a typo alike,
  so asking it would count `Modset` as declared and flatten the body in silence.
- Census unchanged at **324 live, 0 missing, 324 probed** — this is an instrument change and it must
  not move the engine's number.

### Reported, not fixed
- **`tests/test-effective-identity.js` is RED and was red before this pass**: `no NEW raw read of a
  transforming field` (869 total against a baseline of 234), from `tests/roster.js` 0 -> 97 and
  `tests/staged_board.js` 0 -> 13. Both landed with the roster work; neither is touched here. The fix
  is 110 written declarations of why each read is correct by construction, and authoring those for
  code I did not walk is how a justification gets laundered.

## [3.77.0] — 2026-08-08

### Fixed
- **CONFUSION DID NOT EXIST.** The generic volatile branch wrote `_vol.confusion = 1` and NOTHING read
  or ticked it, so the secondary path — Hurricane alone is 3,779 uses — fell through every branch. The
  counter now exists, decays, and hurts the confused body. This also explains the two "dead" berries
  below: a berry that clears confusion had nothing to clear.
- **LUM AND PERSIM WERE ONE TAG-DERIVATION GAP, NOT TWO ENGINE GAPS.** `curesVolatile` matched only
  Mental Herb's literal array; Lum and Persim declare theirs as `removeVolatile('confusion')` inside
  `onEat`. Membership was printed before wiring — exactly two matches, both `confusion`.
- **THE SLEEP COUNTER WAS AN ORDERING BUG.** `onBeforeMovePriority` is slp/frz 10, flinch 8, confusion 3,
  par 1; our loop ran FLINCH FIRST, so a body that was asleep AND flinched ate the flinch and never
  ticked its sleep. Showdown's Snorlax wakes on turn 3 and takes a Swords Dance ours does not get until
  turn 4.
- **THE FREEZE COUNTER IS NOW COMPARED.** `board_state.js` carried `frz` only in a display-name map, so
  `frzTurns` could drift and no measurement would see it. Will asked whether there was a freeze counter;
  there was one in the engine and none in the instrument.
- Two more, both found by the first probe run against the fix rather than by the fix: a `pass` or a
  switch was TICKING THE CLOCK, and `switchOut` never touched `_vol`, so a confusion rode the bench
  forever.

### Notes
- **BURN IS CORRECT AND WAS CONFIRMED, NOT CHANGED** — and it had NEVER ONCE BEEN ON A BOARD in this
  repository. Will-O-Wisp is 85-accurate and the primary pin makes every sub-100 move miss, which is
  exactly why the roster filed it COULD-NOT-STAGE. Staged on the `bottom-tie-first` arm: the halving
  lands, a Fire type cannot be burned at all, Facade is exempt, and Guts is exempt — a burned Conkeldurr
  deals 82 twice while a burned Scizor beside it drops 39 → 19 on the turn its burn lands.
  `medicham2-browser.js:2969` is untouched.
- **THE FREEZE TIMER IS ALSO CORRECT.** Champions' own override — a 3-turn timer plus a 1-in-4 thaw per
  attempt — is already exactly what the `frz` gate encodes. **THE "DID-NOT-FIRE" WAS THE INSTRUMENT**: a
  plant starting `frzTurns` at 1 instead of 0 was NOT CAUGHT on a board comparing 131 fields, and is now
  caught and localised.
- New tag `refusesVolatile` (membership printed first: Own Tempo→confusion, Inner Focus→flinch, four
  →yawn) so Own Tempo's 64 sheets do not acquire a divergence from the confusion fix.

### Reported, not fixed
- **A SLEEPING BODY CANNOT VOLUNTARILY SWITCH AT ALL** — the `continue` in the sleep gate. And
  `taunt` / `encore` / `disable` also survive a switch, while slp / frz / flinch also tick on a pass.
  `board_state.js` compares volatiles only on ACTIVE bodies, so a taunt riding the bench is invisible to
  every staged board.
- **A RELEASE WAS CUT OVER A WORKING TREE MID-EDIT AND BECAME THE NEWEST ONE.** `138261a235c7`, cut by a
  `game_differential` run at 07:33 while an agent was editing. Anything calling `open()` with NO id then
  gets a build nobody chose — and it cost a whole measurement: a BEFORE arm silently became its own
  AFTER arm and every scenario read IDENTICAL. Probes now pin a release BY NAME and refuse to run
  without one. The general fix belongs to `engine_release.js`.
- Misty Terrain's confusion refusal (9 uses) is counted as `MEDFAILS.confusionMistyUnmodelled` rather
  than silently allowed.

## [3.76.3] — 2026-08-08

### Added
- **THE ROSTER'S TWO OWED ARMS.** *Across a switch*: `ability/residual` now starts the carrier ON THE
  BENCH and walks it in mid-turn, so boundary 1 IS its entry turn — and the break re-aimed at that gate
  (`!m._newlySwitched` removed) goes RED on `boosts.spe`, which is the proof the staging reaches
  `activeTurns` at all. The old lead-only version applied the same break and moved nothing, which is
  what `--reds` caught. Speed Boost matches. *At the line*: `item/hp-floor` puts both cases on ONE board
  — a full-HP body takes a lethal hit and must survive, while a body beside it holding the same Sash,
  chipped the turn before, takes a lethal hit and must NOT. A floor reading "not dead yet" instead of
  "at full" saves the chipped one. The chip is DERIVED (`chipFor` finds the smallest move that moves HP
  without killing), so the line is found rather than typed. Focus Sash matches.

### Reported — engine defect, not fixed here
- **A TRANSFORM NEVER REVERTS ON SWITCH-OUT (#95).** `sim/pokemon.ts:1527` clears `transformed` inside
  `clearVolatile()`; medicham sets `_transformed` at `:4823` and NOTHING EVER UNSETS IT. Because the
  same function does `m.name = t.name` (plus stats, types, moves, boosts and ability), OUR BENCHED BODY
  IS PERMANENTLY THE THING IT COPIED. Two consequences: the two engines then choose from benches that
  no longer describe the same Pokemon — which is the `species` divergence the roster surfaced — and,
  worse, **A DITTO CAN ONLY EVER TRANSFORM ONCE PER BATTLE**, because the guard at `:4806` refuses a
  second one. Re-copying is the entire function of the Pokemon. THE DEFECT IS ONE DAY OLD AND WAS
  CREATED BY FIXING SOMETHING ELSE: Imposter first fired in 3.76.0, and the out-and-back scenario that
  exposes it only became expressible with the mid-turn entrant in 3.76.2.

### Notes
- **The suppression tier did NOT reopen, and it was re-checked rather than assumed.** A switch-in is a
  second control in principle, but those 23 entities are suppress-tier BECAUSE their ability cannot be
  swapped — switching them in brings the ability with them, so there is still no arm without it. Gastro
  Acid remains the only control and still does not suppress.
- Ability MATCH moved 31 → 29 and DIFFER 2 → 4 because the entry rule now stages a RE-ENTRY, which is
  strictly more demanding than what it asked before. Anger Point and Justified still reproduce on the
  measured bytes and are not yet fixed.
- **The instrument caught itself again.** `SB.fixtureAudit` reads `a.m`, so a `{ sw: ... }` step arrived
  as `no such move "undefined"` and REFUSED the whole run. The audit was right to be strict; a switch
  step is now nulled in the audit's own copy only, so the per-slot count check still applies and no real
  click escapes inspection. Neither engine sees that copy.
- Stage 4 (500 moves) deliberately not started — it needs its own shape-rule set and the agent stopped
  rather than half-build one. That is the correct call and the same judgement it made last round.

## [3.76.2] — 2026-08-08

### Added
- **A SCRIPTED SCENARIO CAN NOW SWITCH: `{ sw: 'espathra' }`.** Until now `scripted()` understood only a
  move and every other step fell through to `pass`, so NO STAGED SCENARIO COULD PUT A MID-TURN ENTRANT
  ON THE FIELD. That one gap blocked three separate things, all of them about a MOMENT rather than an
  effect: Speed Boost's `activeTurns` gate (which only exists for a body that just switched in), Hunger
  Switch's flip and Zero to Hero's switch-out transform, and the entire across-a-switch arm of the
  roster. FOUR OF THE SIX ENGINE BUGS FOUND ON 2026-08-07 WERE ABOUT A MOMENT, and a scenario with no
  entrant cannot express one.
- Verified end to end: Espathra switches in on turn 1 and reads **+0 Speed in both engines**, then +1 at
  the end of turn 2 — 131/131 fields identical on both boundaries. That is Will's rule
  (*"u gotta be in the whole turn to get the speed boost"*) staged for the first time rather than
  inferred from a random game.
- The ask uses the SAME key as the chooser (`id(species.id)`, which `buildPair` also stamps as
  `_switchKey`), so both engines resolve it identically — the failure 3.75.1 fixed. Legality stays
  Showdown's: an ask naming a fainted, active or absent body resolves to `pass` and is COUNTED.

### Notes
- **It took four fixture errors to verify, all mine and none the engine's** — Wobbuffet does not learn
  Splash, then not Safeguard, then a one-body bring where `buildPair` requires four. This is exactly why
  `tests/roster.js` built a `fixtureAudit` before trusting a single green, and why the roster's own
  `--reds` caught its prose claiming to stage a gate it could not reach.

## [3.76.1] — 2026-08-08

### Added
- **THE DELIBERATE ROSTER, STAGE 3 — all 316 legal abilities staged, plus the 4x berry arm and the
  two-modifier pair arm.** `tests/roster.js`, `data/roster.json`. Abilities
  `2 DIFFER · 4 DID-NOT-FIRE · 31 MATCH · 279 COULD-NOT-STAGE`; pairs `1 DIFFER · 474 MATCH`.

### Reported — engine defects, not fixed here
- **ANGER POINT AND JUSTIFIED ARE ONE DEFECT TWICE: a conditional boost-on-being-hit whose CONDITION IS
  NEVER CHECKED.** Anger Point requires a CRIT and we grant **+6 Attack off an ordinary hit** (Showdown
  0). Justified requires a DARK move and we grant +1 off a Poison one (Showdown 0).
- **HUSTLE does not apply its 1.5x Attack** — 89 against our 60, ratio 1.48. Found by the PAIR arm;
  stage 3's own staging was inert and missed it.
- Electromorphosis does nothing. Fluffy appears to do nothing, stated as an inference rather than a
  measurement because the delta sits on the carrier's own HP.

### Notes
- **113 OF 316 LEGAL ABILITIES HAVE NO LEGAL CARRIER.** Showdown marks the ability standard and marks
  every body that has it `isNonstandard: 'Past'` — Storm Drain's carriers are Gastrodon, Cradily and
  Maractus, all Past here. The effective ability roster of this format is **~203**, and that number is
  about the REGULATION rather than the simulator.
- **The 4x berry arm: 11 of 18 berries now run a flipped-KO arm and all 18 still match.** Chople into an
  Ice/Rock Avalugg-Hisui is 308 into 170 HP. The pairs are swept from the type chart, none hand-picked;
  seven stay at 2x with the reason printed — Normal, Dark, Dragon, Ghost and Electric have NO legal 4x
  carrier in this format. **No ratio is computed**: the assertion is `fainted` and `species`, so the
  HP-loss cap cannot distort it, and the rule says so in place so a future reader does not "fix" it.
- **THE PAIR ARM DID NOT REPRODUCE THE FOLDING HYPOTHESIS.** 474 of 475 clean pairs match on this
  release. The Iron Fist + Muscle Band case that motivated the arm predates the 3.72.0 stage work.
- **THE INSTRUMENT WAS WRONG TWICE MORE AND CAUGHT ITSELF BOTH TIMES.** GASTRO ACID DOES NOT SUPPRESS AN
  ABILITY IN THIS SIMULATOR — 23 abilities have no second ability to swap in, so suppression is their
  ONLY control, and without checking that control against a known-live fixture (Rough Skin: 6 board
  leaves move in Showdown, 0 here) the roster WOULD HAVE PUBLISHED Fur Coat, Hunger Switch, Parental
  Bond, Fire Mane and Spicy Spray AS DEAD for the control's failure rather than their own. And two live
  abilities were controlling each other on Bellibolt, so both read DID-NOT-FIRE while exactly one was
  real. Carrier ranking now prefers a quiet control and prints the caveat where the format offers none.
- `--reds` caught the roster's own prose: the residual rule claimed to stage Speed Boost's `activeTurns`
  entry gate and does not — a lead is not newly switched. Corrected, and the entrant arm is named as
  owed rather than assumed.
- Stage 4 (500 moves) is NOT started; the agent stopped on context rather than time, which is the right
  call — a half-built arm reporting confidently is the failure this file exists to prevent.

## [3.76.0] — 2026-08-08

### Fixed
- **IMPOSTER** never fired. Ditto now transforms on entry into the body opposite — species, types, every
  stat EXCEPT HP (`StatIDExceptHP` excludes it by the type of the loop variable, not by a condition),
  all seven boost stages, the moves at 5 PP each, and the ability. Before: slot read `ditto` against
  Showdown's `clefable`, boosts.spa/spd 0 against +1.
- **HUNGER SWITCH** never fired. Morpeko flips forme at the end of EVERY turn, `onResidualOrder: 29` —
  adjacent to Speed Boost's 28, the other end-of-turn effect fixed this week. Before: `morpeko` against
  `morpekohangry` on turns 1 and 3.
- **KNOCK OFF's x1.5 now asks `TakeItem` first**, exactly as the authority does, so an item that cannot
  leave the body grants no boost. Before: 50/153 against Showdown's 84/153 — the 34 HP the turn-1 case
  queue reported, 15 games.
- **FLING** spent nothing and did nothing, and it was worse than reported: base power 0 made
  `hasPower()` reject the click, so `playerAction` returned `{kind:'pass'}` and THE MOVE NEVER BECAME AN
  ATTACK AT ALL. Same shape as ROADMAP #84's spread moves. Power now comes from the item and the item
  is spent.
- **THE PHAZE BRANCH WAS THE SIXTH SITE WIRE 139 MISSED.** Roar held a POKEMON-first target
  (`const _t=a.target; _foes.indexOf(_t)` returned -1 after the target pivoted out) and failed silently.
  At priority -6 that is the worst place in the file to hold a body rather than a slot, because the
  switch always resolves first. The damaging half (Dragon Tail) was already right and was CHECKED
  rather than assumed.

### Notes
- **MAWILE WAS NOT A DEFECT.** `mawile-mega-swaps-the-ability` was board-identical on its first run —
  two Intimidates and one ability replacement in a single turn, all 131 fields agreeing. All three
  hypotheses in the brief are dead. The proof is the BREAK: deleting `m.ability=ab` from
  `megaEvolveNow` parts `boosts.atk` AND `hp` together, so both symptoms named were real symptoms of a
  bug this engine does not have. The `boosts.atk` family it was blamed for is a CASCADE — the artifact
  row has the two engines already holding different bodies in that slot.
- **THE ITEM-REFUSAL CLASS IS SMALLER THAN THE BRIEF ASSUMED, and it was measured rather than
  remembered.** All 75 legal items carrying `onTakeItem` in this format are MEGA STONES — no
  Z-crystals, no plates, no Griseous Orb. Sticky Hold does NOT gate Knock Off's boost (the authority
  uses `singleEvent`, the item handler only) and carries no `data/tags.json` row at all. And all 148
  legal items are flingable, so "cannot be thrown" has no member here.
- One genuinely isolated `boosts.atk` case survives and is REPORTED not fixed: `omit-weather` turn 0,
  `p2.active[1].boosts.atk` medi -1 / showdown 0 — a leads-time Intimidate refusal we are missing, with
  nothing else on the board parted.
- Census 313/313 → **319 live / 319 probed / 0 missing**. `tests/staged_board.js` 18 → 24 scenarios,
  24/24 clean and board-identical, 24/24 breaks caught and localised.
- The harness caught its own author: a multi-line break anchor matched 0 times because the files are
  CRLF, and `patchedSource` REFUSED it rather than skipping.

## [3.75.1] — 2026-08-08

### Fixed
- **THE TWO ENGINES RESOLVED A DECLARED SWITCH BY DIFFERENT KEYS, AND BOTH FAILED SILENTLY.** The driver
  names a bench member as `switchTo: id(q.species.id)`. The Showdown side found it with
  `id(q.species.id)`; the medicham side found it with `id(x.name)` — the DISPLAY name. Those agree for
  an ordinary body and stop agreeing the moment one is renamed, which this engine began doing on
  2026-08-07: Disguise renames a busted Mimikyu, Zero to Hero renames Palafin, and Hunger Switch is
  about to flip Morpeko every turn. After a rename `id(x.name)` reads `mimikyubusted` while `switchTo`
  still says `mimikyu`, so THAT BODY COULD NEVER BE SWITCHED TO AGAIN.
- And the failure was invisible: `find` returning undefined answered `pass`, `findIndex` returning -1
  answered `pass`, and nothing counted either. One engine switching while the other stood still is a
  different board with no evidence attached — this project's signature failure, this time in the
  INSTRUMENT rather than the engine. `_switchKey` is now stamped at build time from the same expression
  the driver uses to name the candidate, so both sides ask one question, and a miss is COUNTED and
  PRINTED on every run beside the other declared gaps. Verified 0/0 over 120 games.

### Notes
- **This was LATENT UNTIL YESTERDAY.** Every forme fix landed this week made it likelier to fire, and
  the deliberate-roster build now in progress would have walked straight into it — a roster that stages
  Disguise, Zero to Hero and Hunger Switch is a roster full of renamed bodies.
- Instrument change, not an engine change: it alters what a measurement SEES, so a run after this is
  not strictly comparable with one before it on any switch-heavy sample.

## [3.75.0] — 2026-08-08
### Added
- **`swapsSlots`, a derived tag, and ALLY SWITCH, which this engine did not have.** The move
  resolved to `{kind:'pass'}` — a wasted turn — while the real one swaps two bodies between slots.
  202 corpus uses. Derived from the handler (`swapPosition` inside `onHit`) rather than by name;
  membership over the whole move table is exactly one move and was printed before anything read it.
- **`tracksTarget`, a derived tag**, for the one exception to the slot rule below: Snipe Shot, and a
  user holding Stalwart (44 uses) or Propeller Tail. Both tags carry a stated name bridge in
  `medicham2-browser.js` until `data/tags.json` is regenerated, the same pattern as WIRE 3 and 113.
- Three staged-board scenarios, each aimed at one of the three largest board-divergence families and
  each RED before its wire: `speedboost-entry-gate`, `pivot-then-the-slot-is-hit`,
  `allyswitch-follows-the-slot`, plus `mega-forme-on-the-board`, which was GREEN on its first run.
- Two census probes: `move/swapsSlots` and `move/targetsASlot`. Census **311 → 313 live, 0 missing**.

### Fixed
- **WIRE 138 — Speed Boost fired a turn early.** Showdown gates it on `activeTurns`
  (`data/abilities.ts:4447`), which is 0 on the turn a body switches in. The engine's own comment
  said the gate "is not expressible here" — true of `_turnsOut`, which reads 0 for a lead and a
  mid-turn entrant alike, and untrue since WIRE 135 added `_newlySwitched`. Measured on a board:
  the entrant at +1/+2/+3 against Showdown's 0/+1/+2 while the Espathra beside it agreed throughout.
- **WIRE 139 — a move targets a SLOT, and five of seven branches targeted a Pokemon.** Will,
  2026-08-08: *"we gotta target slots, not mons"*. `Battle#getTarget` resolves from `targetLoc` at
  execution time; this engine held the object it aimed at, so Charm, Parting Shot and every generic
  effect dropped stats on a body sitting on the BENCH. One shared reader (`reaimToSlot`) now answers
  it for the attack, status, generic-effect, pivot-drop and trace sites — the FACTS-ARE-GLOBAL rule,
  which three separate copies of this question had already broken.
- **WIRE 140 — Ally Switch**, above. It is the sharpest test of WIRE 139: both bodies stay on the
  field, so the weaker "has my target left" question changes nothing. Before it, one unimplemented
  move parted TEN board fields at the end of one turn.
- `tests/staged_board.js`'s declared-divergence proof rested on `zerotohero-moment`, which WIRE 137
  FIXED — so it reported "the proof case no longer parts" and declared every verdict below it
  untrustworthy. It now runs against a deliberately PLANTED break, which no engine fix can take away.
- Four stale break anchors in the same file (`nuzzle-paralysis`, `disguise-forme`,
  `zerotohero-moment`, and the new mega one) matched nothing, which reads exactly like a comparator
  that found nothing. All 18 scenarios are now clean-identical AND caught-and-localised under break.
- One silent `catch` in `tests/staged_board.js` now carries the parse error, clearing this file from
  `tests/test-no-silent-failure.js`.

### Notes
- **Not a defect, said first.** Mega evolution was already correct on the board (species, party row,
  maxhp and the stone that stays held), on the first run of a scenario that could not have existed
  before the scripted mega opt-in landed. Cosmetic formes are a CONTROL, not a divergence —
  `buildPair` normalises through `mcKey` before either engine sees the set. And the rest of the
  `activeTurns` class has zero exposure in this format: Slow Start 0 uses, Stakeout 0, Truant absent.
- **Filed, not fixed.** When the aimed slot is EMPTY, Showdown retargets via `getRandomTarget` and
  this engine fails the move. Counted as `MEDSEEN.reaimSlotEmpty` rather than left silent.
- **Reported, not mine.** `engine/game_differential.js` dies at pair-build time on a species with no
  `MC.mons` row (`LookupMiss: florgesblue`) — `buildPair` writes `mcKey(p.species) || id(...)` and
  `mcKey` THROWS rather than returning null. One team in the pool kills an entire run.

---

## [3.74.0] — 2026-08-07

### Fixed
- **THE TWO ENGINES HAVE DISAGREED ABOUT EVERY SPEED TIE FOR THE LIFE OF THE PROJECT, and the cause
  is the SORT ALGORITHM rather than the comparator.** Measured on a staged pure tie (Volcarona vs
  Charizard, both 100 base Speed, both 120 exactly) under the differential's primary pin: Showdown
  moved Charizard first, medicham2 moved Volcarona first. `Array.prototype.sort` is STABLE, so a
  comparator returning 0 keeps input order; `Battle#speedSort` is a SELECTION SORT whose swaps move
  UNTIED elements around, so the tied group's order when the shuffle sees it is not the input order.
  No comparator can make a stable sort produce that permutation. **It is not confined to the
  instrument** — `sortTurnOrder` is the live engine, so every rollout MILTANK has run and every live
  game resolved a tied matchup to the wrong body, and 91.4% of legal species share a base Speed with
  some other species (ROADMAP #86). The selection sort is now reproduced line for line and the
  residual tie is resolved by the per-action uniform key the file already drew — a uniform random
  permutation under real dice (the coin the authority rolls) and the identity under a constant pinned
  die (what the neutralised shuffle does), so both engines land on the same body without either being
  told the answer. **"Take the later body" was explicitly REFUSED**: that is what the authority
  produces under this harness's pin, not the game's rule, and hardcoding it would have made the
  differential go green on an engine that was wrong in every rollout and every live game.
- **Zero to Hero fired at the wrong MOMENT and emitted neither of its two lines.** Showdown transforms
  Palafin on switch-OUT and announces on the way back IN; this engine transformed inside `bringIn()`.
  After a pivot, Showdown's party held `palafinhero` and ours held `palafin`. Staged board comparison,
  393 fields: now IDENTICAL.
- **Disguise never renamed the body.** The HP was exact (both engines end at 114/130, which is why
  this was once declared a non-bug) and Showdown's active slot AND party read `mimikyubusted` on every
  turn after the hit while ours read `mimikyu`. Staged board comparison: now IDENTICAL.
- **ROADMAP #89 — the comment justifying the Disguise model cited `battle.update()`, A SHOWDOWN METHOD
  THAT DOES NOT EXIST** (verified by enumerating the prototype). The model was correct; the stated
  reason was fiction, which is worse, because the next reader re-derives from it. The real reason is
  in the ability's own source: the self-inflicted eighth is dealt in `onUpdate` on the next update
  pass, as a separate damage event. Corrected in the engine and in `docs/ENGINE.md`, where the same
  claim had been copied.
- **`MEDFAILS.traceBodyOffField` 25 → 0**, and the cause was a STATE bug wearing an announcement's
  clothes: the `pivotDamaging` switch resolved ABOVE recoil, drain and the Life Orb toll, so a U-turn
  user paid all three FROM THE BENCH. `useMoveInner` queues `selfSwitch` after the hit and guards it
  with `else if (pokemon.hp)`, so a Life Orb holder on a sliver of HP that clicks U-turn dies to the
  orb and does not pivot. The last `??` was a status move still aiming at a BODY rather than at a
  SLOT — the attack branch has re-resolved its aim since voluntary switching existed, the status
  branch never did.
- **`tests/mutation_harness.js` scored every tag `THREW` and the planted-stub gate read
  `shipped = MISSING`.** `S.sfA._S = S` (ROADMAP #81 WIRE 9's battle-state back-reference) made the
  harness's own `projVal` recurse without bound. Proven to be the INSTRUMENT and not the engine: the
  gate passes on release `032b4a2979dd` (pre-WIRE-9) and fails identically on `dc3c43336539`, cut
  before this session. `_S` is now skipped beside `team`.

- **DEFIANT AND COMPETITIVE FIRED ON EXACTLY ONE ROUTE, AND FIRED THE WRONG NUMBER OF TIMES ON IT.**
  Will: *"WHEN PARTING SHOT GOES INTO A DEFIANT OR COMPETITIVE MON IT GETS DOUBLE BOOSTS, ONE FOR EACH
  DROP. I DONT THINK THATS THE CASE FOR CHARM BUT IDK."* Both halves are right: `Battle#boost` runs
  `AfterEachBoost` inside its PER-STAT loop, so Parting Shot's two drops are `-1 +2 +2 = +3 Attack`
  and Charm's single two-stage drop nets ZERO. The count was the smaller half — the retaliation lived
  inside `applyStatDrop`, which only Intimidate and Sticky Web reach, so **every move-driven stat drop
  escaped it entirely**: measured before a line changed, Parting Shot into a Defiant body read `-1,-1`,
  identical to a body with the ability blanked, on 7,661 Defiant sheets and 1,916 Competitive ones. It
  is now one shared reader called at every site that lowers a stat. Staged against the authority —
  Parting Shot, Charm and a no-ability control — all IDENTICAL over 262 fields, with the emitted
  stream reproducing the measured log line for line. The ally guard (`target.isAlly(source)`) and the
  source guard are the artifact's now, not typed. **A green probe went red during the fix and was
  right to**: the first cut passed `null` as Sticky Web's source, and Showdown's stickyweb condition
  boosts with `this.effectState.source`, so the setter is now recorded on the layer.

### Added
- **`switchOutTrigger` — the switch-out moment as a CLASS.** Will: *"ALL THE SWITCH OUT ABILITIES
  ACTIVATE ON SWITCH OUT LIKE REGENERATOR OR NATURAL CURE OR ZERO TO HERO."* Exactly three abilities
  in this format declare `onSwitchOut` and they are those three. Regenerator was right, Zero to Hero
  fired at the wrong moment, and **Natural Cure (97 uses) was `["untagged"]` and absent entirely**.
  Membership is derived from the authority and `does` is read out of the handler; an unrecognised
  `does` is COUNTED rather than silently ignored. Emergency Exit and Wimp Out are `onEmergencyExit` —
  a different moment — and are deliberately not folded in.
- **Nine mechanics that had never had a probe are now live**: Moody (`randomBoostEachTurn`, 605),
  Burning Jealousy / Alluring Voice (`punishesBoostedTarget`, 219), Instruct (`instructsTarget`, 178),
  Pollen Puff (`dualPurpose`, 139), Wonder Room (`swapsDefences`, 11), Safeguard (`sideBuff`, 8),
  Magic Room (`suppressesItems`, 4), plus Zero to Hero and Natural Cure above. **Two of the ten turned
  out to be ALREADY LIVE and merely unproved** — `terrainSetter` and `condStatMult` (Marvel Scale).
- **`needsTargetToAttack` — the last MISSING census row, and the fix was a TAG before it was any
  code.** All nine members carried the identical `{needs: "target attacking"}` while doing four
  different things. `effect` and `when` are now read out of each member's own callback. Counter,
  Mirror Coat and Metal Burst come out `reflectsDamage` and are **declared and NOT modelled**.
- **ROADMAP #60** — `failsIfTargetNotAttacking` carries `needsPriority` / `minPriority`, read off
  `move.priority <= 0.1` in Upper Hand's own onTry, so Upper Hand stops looking like it beats an
  ordinary Earthquake.
- **`tests/test-speed-tie.js`** — five arrangements chosen so that a comparator REVERSAL fails:
  opposite sides, the same two bodies with the TEAMS SWAPPED, both tied bodies on ONE side, a
  three-way tie, and a no-tie control. All five agree with the authority. It also asserts the tie is a
  COIN under real dice (a hardcoded side passes every board case) and prints a sensitivity check
  showing the shipped sort and the stable sort it replaces part on the same four actions.
- **`formeOnHit`** — Disguise and Ice Face, derived from the narrow shape (an `onUpdate` that
  forme-changes plus an `onDamage` that sets `busted`). The first predicate matched NINE abilities
  including Forecast, Flower Gift and Hunger Switch; the membership was printed before wiring, as
  `docs/LESSONS.md` §4 requires.

### Changed
- Census **298 live / 299 probed → 311 live / 311 probed**; `missing` **1 → 0 for the first time**.
  `armed` 311/311, `directCall` 0, `hollow` 0, `threw` 0.
- `sideBuff`, `dualPurpose`, `punishesBoostedTarget`, `instructsTarget` and `needsTargetToAttack` all
  had their params ENRICHED before any consumer was written, because each carried a NAME or a
  CONDITION with no EFFECT and could not be wired without guessing. `sideBuff` in particular: it said
  only `{sideCondition: "safeguard"}`, and treating the class as one thing would have made Mist — which
  refuses a STAT DROP, not a status — into a second Safeguard.

### Notes
- **THE SWEEP WILL ASKED FOR.** `partingshot.boosts` is `undefined` — it applies its drops in handler
  code, exactly as Curse did — while `charm.boosts` is a plain `{atk:-2}`, so two moves a player thinks
  of as the same kind of thing have different shapes in the source and only one is visible to a
  derivation reading static fields. Scanning every `on*` handler, every secondary callback and every
  condition of every legal move in this format: **16 moves apply a stat change in CODE, all 16 are in
  the format's table, and 7 carry `statChangeInCode`.** That is a COUNT and not a defect list — six of
  the nine without it are described by a SHARPER tag (`punishesContact`, `hazard`, `chargeTurn`, the
  on-KO branch, a residual) and Clangorous Soul also carries a static `boosts` field. Stockpile and
  Magnetic Flux are genuinely undescribed, at 51 combined uses. Reported, not fixed.
- `node tests/run-all.js`: **86 passed, 10 failed**, up from 85/11. Nine of the ten reds are
  attributed rather than filed — `test-forced-switch`, `test-team-preview-race` and `test-wiring` fail
  ONLY under `ABRA_STRICT_SEMANTICS` and their root is the **REFIT OWED**, the same eight features
  `engine/status.js` printed before this session began; `test-effective-identity` grows only on
  `tests/staged_board.js` (another division's new file), this pass's own two contributors now being
  DECLARED with construction reasons; the rest are WEB / OPS / MEASURE artifacts. No fit was run.
- **`data/engine-data.js` owes a `mimikyu-busted` row.** Disguise's rename is faithful only because
  the artifact states the pair is identical in stats and types; Ice Face's pair is not, and is refused
  and counted rather than renamed wrongly. That file is downstream of this division.

## [3.73.0] — 2026-08-07

### Changed
- **ONE PIN WAS ONE CORNER; THERE ARE NOW FOUR ARMS** (ROADMAP #88). Every die was pinned a single
  way, so a game ran once, deterministically — no noise, and no coverage either. The speed tie always
  resolved the same direction, every sub-100-accuracy move MISSED ON BOTH SIDES, and damage was always
  the maximum roll. **Rock Slide had never once connected in this instrument.** It does now: it misses
  in `top-tie-first` and hits in `bottom-tie-first`, and a crit lands in the bottom arm and not the top.
  The pin set is a run parameter, digested into `mode`, and `--baseline` refuses a mismatched pair and
  fails closed on an artifact carrying no `pins` block.
- **COVERAGE CREDIT MOVED FROM THE CLICK TO THE OBSERVED EFFECT** (ROADMAP #91). `creditClick`
  incremented when an entity was CLICKED and never asked whether the move did anything, and the
  steering then stopped selecting a row once credited. Caught live: Primarina clicked Haze on turn 1
  into a board with zero boosts on it — a no-op — and Haze was marked exercised. Five rows were
  clicked-or-present and did NOTHING: `ability:critDamageUp`, `ability:preventsSwitch`,
  `ability:privateWeather`, `move:clearsScreens`, `move:preTurnShield`. The old rule called all five
  covered.

### Fixed
- `chooseAction` scored each slot independently, so both slots could pick the SAME bench body
  (`switch 4, switch 4`), which Showdown rejects outright and which throws the game. Pre-existing; it
  threw 1 game in 51 under the old single pin and 19 in 51 under `bottom-tie-first`, because that arm's
  games last longer.
- `tests/test-state-differential.js` planted two divergences that could not be seen: `board_state.js`
  reads a dead body's status as `fnt` whatever the status field holds, so planting a burn on a corpse
  moved no compared leaf, and `Math.max(0, curHP-1)` on a body already at 0 is a no-op. Plants now pick
  a living body and report NOT APPLIED when there is none. 25/25 caught, localised.

### Notes
- **THE BASELINE IS RESET. No run after this is comparable with the 75.5% turn-1 figure or with
  `data/state-ladder.json`.** Both changes above alter which games get played. This is why they landed
  together rather than one at a time — two resets is one too many.
- **THE ORIGINAL PLAN FOR THE TIE ARM WAS WRONG AND IS RECORDED SO IT IS NOT RE-PROPOSED.**
  `random(m,n)` is NOT Showdown's speed-tie resolver. Its callers in the pinned checkout are the sleep
  duration `random(2,5)`, a multi-hit count, Loaded Dice, and where a mid-turn action is inserted in the
  queue. Pinning it to the top would have made every sleep four turns long and moved queued actions, so
  the tie arm would have differed from the baseline in four ways and been attributable to none. Pinning
  `PRNG.shuffle` does not move Showdown's turn order either — the reversing shuffle is implemented and
  asserted, and DELIBERATELY NOT INSTALLED, because a lever that moves one engine and not the other is
  CHANGELOG 3.45.0 repeating.
- **OPEN, AND IT IS AN ENGINE DEFECT RATHER THAN AN INSTRUMENT ONE: the two engines have disagreed
  about every speed tie for the life of this instrument.** Showdown resolves a tie to the LATER body in
  input order; medicham2's `sortTurnOrder` draws one tie value per action from a constant scalar, so
  every value is equal, the sort is stable, and it takes the EARLIER body. Measured on a staged pure tie
  in both orientations and with the tied pair on one side and on opposite sides. **The header's claim
  that the pin made them agree "by construction" was false, and it was repeated as fact to Will before
  it was checked.** 53,242 tied groups were resolved in the published run (2x50134, 3x2935, 4x141,
  5x16, 6x16). `sortTurnOrder` is the LIVE engine, not instrument code.
- `trace_body_off_field` reads 231 (was 82 earlier today). `tests/test-protocol-trace.js` PART 6 says
  it must read 0; that test is green because it plays its own shorter games, and the 12-turn state-mode
  games reach it.

## [3.72.0] — 2026-08-07

### Fixed
- **ROADMAP #92 — THE DAMAGE-STAGE CLASS.** Showdown applies each multiplier at a STAGE — a base
  power, a stat, or the final damage — folds every handler at that stage into ONE `event.modifier`,
  and spends it ONCE. This engine applied about a third of them at a different stage, and separately.
  The truncations between stages do not commute, so the answer came out a point or two off, which
  reads as rounding to every human and every gate:

  ```
  SHOWDOWN:  BP 85 -> x1.2 -> BP 102 -> base 72 -> STAB -> 108     Black Glasses is onBasePower
  OURS:      BP 85 ->         base 61 -> STAB 91 -> x1.2 -> 109    we multiplied the FINAL damage
  ```

  **That disguise is why it survived.** BOTH engines "apply Black Glasses", so `test-mechanics.js`
  saw it LIVE, the interaction matrix compares a RATIO between arms, `test-engine-diff.js` allows a
  12% midpoint band by design, and one point of damage rarely forks a whole game. It reached the
  surface only as an unexplained "off-by-one" bucket — 58 games at turn 1. The control residual with
  nothing switched on is 4.1%, so none of the rates below is rounding noise.
- **Into ONE `onBasePower` relay, spent once** (`battle-actions.ts:1650`): the 18 type items (Black
  Glasses measured 65.0% wrong, Charcoal 40.0%), Muscle Band (39.6%) and Wise Glasses (42.2%), all
  from the final ModifyDamage chain; Technician (40.3%), Tough Claws (34.0%), Sharpness (48.0%),
  Iron Fist, Mega Launcher, Strong Jaw, offensive Punk Rock, Sheer Force, Supreme Overlord and
  Expanding Force / Rising Voltage, all from the base DAMAGE; the -ate abilities' x1.2, from its own
  `Math.floor`; Helping Hand (4,306 clicks, wrong on 5 of 5 audited rows), from the hit site; Dry
  Skin's `onSourceBasePower` (40.0%), from the final chain.
- **Into the two STAT relays** (`:1708-1709`): Thick Fat, Heatproof and Purifying Salt (73.1% wrong
  between them) and Water Bubble both ways (77.3%). These modify a STAT, not the damage, which is a
  different fix from moving a stage. The members already at this stage — Choice items, Huge Power,
  Guts, Solar Power, Orichalcum, Hadron, Marvel Scale, the four Ruin abilities and the weather
  defence bumps — now share the relay instead of spending twelve separate `md4096` calls.
- **Into the final `ModifyDamage` chain:** Friend Guard (1,015 sheets; right stage, but a SECOND
  spend beside the chain — 60 of 281 base-damage values disagreed, 21.4%) and Sniper, which is
  `onModifyDamage` and had been folded into the crit's plain multiply (34.8% wrong at the top roll,
  54.1% at the bottom).
- **The rolled crit's POSITION.** The authority multiplies by 1.5 at `battle-actions.ts:1748`,
  BEFORE the randomizer, STAB, the type chart, burn and the ModifyDamage chain. The battle loop
  multiplied AFTER all six. It looked fine because every check in this repo pins the top damage roll,
  where the randomizer is the identity: measured across the interior it disagreed on 46.5% of rows at
  the bottom roll and 61.8% with a Life Orb. The crit's ARITHMETIC was already right and is unchanged.

### Added
- **The four FIELD terrain multipliers, which were absent entirely.** Electric and Psychic Terrain
  x[5325,4096] on their own type with the ATTACKER grounded; Grassy Terrain x0.5 on
  Earthquake/Bulldoze/Magnitude with the DEFENDER grounded and x[5325,4096] on Grass with the
  attacker grounded; Misty Terrain x0.5 on Dragon with the defender grounded. The usage is small and
  is stated rather than inflated — all terrain setters combined are 161 corpus uses against Fake
  Out's 15,106 — but the magnitudes are not: a Grassy-Terrain Earthquake was priced at 118 here
  against the authority's 60, exactly DOUBLE, and a Misty-Terrain Dragon Claw at 96 against 49.
- **`tests/test-damage-stages.js` — the gate this class cannot hide from.** 54 scenarios x 16 damage
  rolls x 2 crit states, EXACT equality against Showdown's own `moveHit`: **1,728/1,728**. Three
  things it does that no existing check does: it compares the whole roll INTERIOR rather than the
  endpoints; it checks the knob MOVES the authority's number before it checks the answer, so a row
  that agrees because neither engine did anything fails; and it carries nine TWO-MEMBER rows, because
  a stage fix that keeps one `Math.floor` per member passes every single-modifier test anybody would
  write (Gallade Drain Punch into Snorlax with Iron Fist AND Muscle Band: authority 228, this engine
  227, while each one alone agreed). It also re-derives the engine's exact-4096ths table from the
  live dex every run and prints the narrowed `damageBoost` membership with each member's stage.
- **Five census probes.** Four for the field terrains and one for the narrowed `damageBoost` family,
  under `move|setsTerrain` and `ability|damageBoost`. Census **293 live / 294 probed → 298 live / 299
  probed**; `missing` unchanged at 1 (Avalanche). `armed` 299/299, `directCall` 0, `hollow` 0,
  `threw` 0.
- **`dmgRange` gained a seventh argument, `hit`**, carrying the two facts only the hit site knows —
  Helping Hand and the ally's damage multiplier — and an optional `rolls` out-array. The comment that
  used to stand at the hit site said these "are not in dmgRange and never can be"; the premise was
  true and the conclusion did not follow. What the function cannot DERIVE it can be TOLD, and it has
  to be, because both belong inside chains only it spends. Every existing caller passes six arguments
  or fewer and is unaffected.
- **`MEDSEEN` counters** for every family that moved stage — `bpChainSpent`, `bpChainMembers`,
  `statChainSpent`, `damageBoostStat`, `helpingHandBP`, `friendGuardChain`, `critInRange`. Moving a
  multiplier is invisible in a head-to-head (both arms apply it, one applies it late), so a non-zero
  here is the only receipt that the new site is on the path. `bpChainMembers` exceeding
  `bpChainSpent` is the receipt that the CHAIN half, as against the STAGE half, is exercised at all.

### Changed
- **`tests/test-tag-wire.js`'s WIRE 13 assertions, because the engine was right and the test was
  wrong.** They divided boosted damage by unboosted damage and demanded the quotient equal the
  ability's multiplier within 0.04. That only holds while the multiplier is applied to the FINAL
  damage. Moving `boostsMoveClass` to its real stage made Mega Launcher's Dragon Pulse ratio 1.444 —
  and the authority's own ratio is 1.4444, checked before the file was touched (Garchomp Dragon Pulse
  into Incineroar reads 54 → 78 in both engines, on all sixteen rolls). The assertions now apply the
  multiplier to the move's BASE POWER by hand and demand the ability produce exactly that damage,
  which is stricter and is the thing that changed.

### Notes
- **SAID FIRST, because several things in the audit turned out not to be defects.** The -ate
  abilities' x1.2 was at the right stage AND the right value (`trunc(1.2 * 4096) = 4915`, which is
  the authority's literal); only its separate `Math.floor` was wrong. Analytic and Sand Force do not
  need a 4096ths override, because nothing reads them. The crit's arithmetic was correct throughout.
  Spread, weather, the randomizer's position, STAB, the type chart, burn, Life Orb, Expert Belt, the
  resist berries, the screens and the four Ruin abilities were all already correct — and are now
  re-checked by the new gate so they cannot silently stop being.
- **`damageBoost` is STILL not wired as a class, and that is the finding rather than a shortfall.**
  44 abilities carry it. The param has no STAGE (Analytic/Reckless/Rivalry/Sand Force are
  `onBasePower`; Steelworker/Transistor/Dragon's Maw/Rocky Payload/Stakeout/Hustle/Gorilla Tactics
  are `onModifyAtk`) and no CONDITION — Blaze, Torrent, Overgrow and Swarm carry
  `onlyWhen: "only below 1/3 HP"` as prose. Wiring the class hands Blaze a permanent x1.5 on 5,808
  sheets and DOUBLES the nine members already live under a sharper tag. The engine reads it only
  where the shape is self-describing: a multiplier, a type, no weather, no condition, and no other
  tag on the ability — today `firemane`, `dragonsmaw`, `rockypayload`, `steelworker`, `transistor`,
  all five verified `onModifyAtk`/`onModifySpA` against the live dex by the gate rather than by
  memory. All five are 0 corpus uses; they are wired because they are right.
- **NOT FIXED, named.** Charge's x2 on the user's next Electric move — the engine has no Charge
  volatile at all, so there is no state for the multiplier to read. The grounded SUBJECT on
  `terrainScaled` (Expanding Force reads the user's feet, Rising Voltage the target's) — the tag
  carries no subject and the divergence is unchanged and still stated at the site. Rivalry — still
  blocked on gender, which `MC.mons` does not carry. And `data/tags.json` still stores 1.3 as a float
  where the authority spells it `[5325,4096]`; the engine carries a four-entry `CH_EXACT` override
  and the gate re-derives every entry from the live dex every run, so it cannot go stale, but the
  artifact is the right long-term home.
- **The gate was shown RED before it was trusted.** Two deliberate reversions of this pass, each run
  and then restored: putting the crit back to certain-crits-only took it to 864/1728; putting the type
  items back in the ModifyDamage chain took it to 1594/1728. Independently, the frozen release
  `dc3c43336539` — the real pre-fix engine — disagrees with the authority on **37 of 50** endpoint
  comparisons over the same scenarios, and that UNDERSTATES the class, because the endpoints are where
  it hides.

---

## [3.71.0] — 2026-08-07

### Added
- **The AURAS, at the base-power stage and field-wide.** Fairy Aura, Dark Aura and Aura Break are
  `onAny*` handlers — they multiply one TYPE for every body on the field, the holder's moves and the
  foe's alike — and nothing in the engine read `auraBoost` at all. `field.aura` is now recomputed at
  the top of every turn from all four actives, exactly beside `field.wSup`, so `dmgRange` asks one
  place and no signature widens (this answers ROADMAP #64's open question the way WIRE 78 answered
  it). Applied to BASE POWER through a `ch4096` chain spent once, which is where `onAnyBasePower`
  runs; the multiplier is the derived pair `[5448, 4096]`, not the float 1.33 (`md4096(v, 1.33)`
  truncs to 5447 and would have been one 4096th low on every Fairy move in the format). **Aura Break
  INVERTS to `[3072, 4096]` = x0.75 rather than cancelling to 1.0.** Verified against the official
  engine on 12 arms — attacker-side, defender-side and under a break, across Moonblast, Light of Ruin
  and Crunch — **exact at both ends of the roll on all 12**.
- **New derived tag `auraBreak`** and a new derived tag **`typeSplitMove`** (Curse), both keyed on
  dex facts (`hasAuraBreak` in the handler; the `nonGhostTarget` FIELD) rather than on names.
  Membership printed before wiring: `auraBreak` matches exactly `aurabreak`, `typeSplitMove` matches
  exactly one move in this format.
- **Baton Pass and Shed Tail switch, and carry what the authority says they carry.** `passesState`
  had been derived since the pivot family was split three ways and read `used: false, uses: 0` — the
  engine had no consumer, so Baton Pass resolved to a NO-OP TURN and Shed Tail paid half its user's
  HP, built the doll and left the user standing there. Both now resolve through a `passstate` branch
  that runs the authority's checks in the authority's ORDER (an empty bench fails FREE, before the HP
  is charged). `passesState` carries `mode`, `passesBoosts` and `passesVolatiles` read off the move's
  own `selfSwitch` string, which is the same field `Pokemon#copyVolatileFrom` branches on.
- **Curse, both halves.** A non-Ghost gets +1 Atk / +1 Def / −1 Spe on ITSELF and pays nothing; a
  Ghost pays half its own max HP and hangs a 1/4-per-turn chip on the foe. Before this the move did
  literally nothing. The chip and the price land together on purpose: wired apart, Curse would have
  been a free permanent quarter-per-turn — strictly better than the real move.

### Fixed
- **Perish Song counted from the wrong number and killed a full turn early**, on both sides, on 1,141
  corpus uses. `perishsong.condition.duration` is 4 and the residual decrements at the end of every
  turn including the one it was set on, so the board reads 3 / 2 / 1 and everything faints at the end
  of turn 4. The engine set 3 and ticked to 2. Read from the authority's own `condition.duration` now,
  with no fallback constant. **The KO itself always fired** — that was checked before it was reported.
- **A body that switches out no longer keeps its perish clock.** `_perish` was never cleared on the
  way out, so the clock FROZE on the bench instead of ending and the body died to a count it had
  already escaped. This is the move's only counter-play. `_yawn` is cleared beside it for the same
  reason.
- **WIRE 10's board regression: the Life Orb toll was paid by a move that MISSED.** That rung moved
  the accuracy roll into the per-target step walk (correctly — `hitStepAccuracy` really is step 5),
  and the `continue` the old whole-move roll carried went with it. The drain, the self stat drop, the
  recoil, the crash and the pivot all have their own gates and are all still right on a miss; the Life
  Orb line never had one. Gated on `_reached > 0`. **Not a spread defect** — it is every missed move
  by a Life Orb holder (12,804 corpus sheets), which is why WIRE 10's own "36/36 single-target clicks
  are byte-identical" control could not see it: all 36 landed.
- **`Math.ceil` on the substitute doll, introduced by WIRE 7, reverted to the authority's `floor`.**
  That wire quoted `this.effectState.hp = Math.ceil(target.maxhp / 4)`; `data/moves.ts:18328` says
  `Math.floor`, and the volatile read out of a staged authority game agrees (137 HP → 34, 195 HP →
  48). The probe written for it asserted the misquote and went green. Both the doll's rounding and the
  three different COST roundings (Shed Tail is `Math.ceil(maxhp / 2)`; Substitute and Clangorous Soul
  trunc) are now derived per member rather than shared.
- **`preventsStatDrop` would have deleted Mirror Armor on the next regeneration.** Its derivation
  matched a bare `effect.name === '...'` and could not tell an INCLUSION (`if (effect.name ===
  'Intimidate' && boost.atk) { … }`) from an EARLY-RETURN GUARD (`… || effect.name === 'Mirror Armor')
  return;`), so the artifact would have said `onlyFrom: 'Mirror Armor'` and the ability would have
  blocked only drops named "Mirror Armor" — that is, nothing. Found by diffing a candidate
  regeneration rather than accepting one. Derived membership now matches the consumer's bridge exactly.

### Changed
- **`data/tags.json` regenerated, and `data/abra-tags.js` rebuilt from it.** It had been frozen since
  ROADMAP #65 because a regeneration silently dropped five entities; that cause (a bo3-only corpus
  scope inherited from `fit_policy`) is fixed and stated at the call site. The candidate was DIFFED
  before it was accepted: **0 entities lost**, `sheet_entries` 119,616 → 125,340, +3 entities
  (`aurabreak` plus the inert `receiver` and `persimberry`), 23 entity diffs and every one accounted
  for.
- Census **281 live / 282 probed → 293 live / 294 probed**; tag coverage 162/181 → 166/183.
  `tests/probe_red_demo.js` 177 → 185 demonstrations, 0 failed.

### Notes
- **Two of the five briefed diagnoses were wrong before the engine was**, and both are recorded in
  `docs/ENGINE.md`: the tagger does NOT test `selfSwitch === true` (it tests truthiness and routes the
  two string-valued moves to `passesState` deliberately), and the substitute doll was not confounded —
  it was a regression this project introduced.
- **`tests/test-effective-identity.js` is RED** on one new raw read, `engine/leaf_engine_contrast.js:
  0 -> 1`. That file is MEASURE's and was not touched here. Reported, not fixed — the routing rule.
- **`tests/test-roadmap-register.js` is RED** on `#87`, cited by an earlier section of
  `docs/ENGINE.md` and absent from the register. Not this change's citation.
- **`tests/test-wiring.js` was not run and cannot be from ENGINE** — it spawns self-play. Ten counters
  were added for the capabilities armed here and every one is proven non-zero by a probe that spends a
  real turn.

---

## [3.70.0] — 2026-08-07

### Added
- **`engine/board_state.js` — THE STATE DIFFERENTIAL.** The board is now read out of BOTH engines'
  live bodies at every turn boundary and compared field by field: per active body HP, status with its
  toxic stage and turns slept, item, all seven stat stages, fainted and species; every party member's
  HP and aliveness; weather / terrain / Trick Room / Tailwind / each screen WITH ITS COUNTER; hazard
  layer counts; and the persistent volatiles (Substitute with its HP, Taunt, Encore, Disable, Leech
  Seed, confusion, Perish, move-trapping with its counter). **Neither engine's log is opened** —
  deriving a board from the protocol would reproduce the bug this exists to escape. The boundary is
  **after the entire residual phase**, which is the only place Leftovers, chip, the toxic stage, Leech
  Seed, Perish and every clock touch the board.
- **A per-FIELD diff, not a boolean.** Every differing leaf is located to the slot, the body and the
  field, bucketed by magnitude (off-by-one / off-by-2-or-3 / off-by-4-or-more / present-in-one-engine /
  different-value), aggregated by field across the run, and written out in plain English with the two
  clicks each side made. The off-by-one HP bucket is kept apart on purpose: it is WIRE 4's fixed-point
  residue and is different work from a missing mechanic.
- **`data/state-ladder.json`** — all fourteen frozen releases replayed under the board comparison, one
  pinned census, one frozen team store, 1,998 games per arm.

### Notes
- **THE HEADLINE: the board at the end of turn 1 is identical in 56.0% of games at the pre-WIRE-1
  baseline (1119/1998) and 66.9% at the top rung (1337/1998), peaking at 69.3% at WIRE 9.** Turn 1 is
  the headline because it is the only turn that begins from a board both engines agree on; every later
  turn starts from wherever the run had already drifted. `agreement_by_turn` states its denominator at
  each turn and the pooled `turn_boundary_agreement` is kept beside it so the contamination is visible.
- **THE MEDIAN WAS THE WRONG STATISTIC.** The median first-divergence turn read 1 at all ten rungs and
  was reported ten times as "nothing moved". The distribution is bimodal — whole-game protocol
  agreement went 7 → 134 of 1,997 over the same series — and a median cannot move on a bimodal
  distribution until half the mass crosses. The bounded turn-1 rate has no such blind spot.
- **THE WIRES WERE REAL BUT THE PROTOCOL NUMBER OVERSTATED THEM.** Protocol whole-game agreement rose
  5.9x (1.8% → 10.3%); the turn-1 board rose 1.19x (56.0% → 66.9%). Whole-game board agreement went
  6.4% → 15.6%.
- **WIRE 10 IS A REGRESSION AND ONLY THE STATE INSTRUMENT SAW IT.** WIRE 9 → WIRE 10 loses 47 clean
  turn-1 boards and 56 clean games; diffed per field it is one field, **end-of-turn-1 HP wrong in 427
  → 473 games (+46)**, with several fields improving. The protocol instrument scored the same rung as
  an improvement. The drift check resolves to ZERO — the baseline release ran first and last, fourteen
  arms apart, and reproduced every measured field exactly — so 47 games is far above the instrument's
  resolution and is not noise.
- **IS IT JUST SEMANTICS: at the top rung 422 of 1,030 games (41.0%) whose narration parted inside
  turn 1 reached an identical board anyway.** By protocol class at the baseline, `ordering` is
  announcement-only in 179 of 257 games while `turn order` is only 2 of 73 — turn order is real,
  ordering mostly is not.
- **THE LIGHTNING ROD CASE WAS AN ANNOUNCEMENT DIFFERENCE, NOT A BOARD ONE.** Staged for real, the two
  reported protocol lines reproduce exactly and the board is 131 of 131 fields identical — Raichu is at
  +1 Special Attack in both engines. This engine emits an extra `|-immune|` the authority does not. The
  same probe then suppresses the boost in this engine's board and the comparator reports
  `p2a raichu boosts.spa SD 1 US 0`, localised, so the null rests on a comparator shown catching the
  exact field it was doubted on.
- **THE COMPARATOR PROVES ITSELF FIRST:** 7 representation mappings each red-demonstrated in both
  directions, and 25 planted state divergences — one per compared field family, written into the LIVE
  medicham board at a boundary the clean arm agreed at, each of which must be applied, caught, at
  exactly that boundary, and localised to the planted field. **25/25 on all fourteen arms**, with
  `reader_failures` empty on every one. Gated by `tests/test-state-differential.js`.
- **THREE LADDERS WERE RUN AND TWO WERE THROWN AWAY.** Ladder 1 had `engine/game_differential.js` and
  `engine/diff_swarm.js` edited under it between arms 11 and 14 (ROADMAP #87's pool cache landing
  mid-flight); its own `inputs_that_moved` and drift check caught it, the edit was proven
  measurement-neutral by re-running arm 1 under both instrument versions, and it was re-run anyway.
  Ladder 2 ran clean and its **drift check reproduced exactly**. Ladder 3 added `agreement_by_turn`
  and is the published artifact. **Ladders 2 and 3 are two independent fourteen-arm runs and are
  IDENTICAL on every measured field, arm by arm.**
- **THE PUBLISHED LADDER'S DRIFT CHECK IS RED, AND IT IS NOT WAIVED.** The two baseline arms differ in
  exactly one field and it is not a measurement: `declared_gaps.tags_release_matches_live` went
  `true` → `false` because **`data/tags.json` was rewritten by something outside the run at 18:14:50**
  (476,130 → 452,721 bytes), mid-ladder. Every arm read the release's frozen tags for the engine, all
  fourteen reported the same team-pool digest `32b2abcbfeb7`, all thirteen cleared comparability, and
  per-game depth is identical — and ladder 2, which ran before the rewrite, was green with the same
  numbers. The gate is right to fire; the fix belongs to whatever regenerated `data/tags.json` against
  a live tree while a measurement was in frame (CLAUDE.md's photograph rule). Routed, not held.
- **NOT MEASURED, AND SAID SO:** ability trapping (medicham2 stores no trapped flag; MOVE trapping IS
  compared, with its counter), item disposition, PP, and the stall counter behind consecutive Protect.
  `NOT_COMPARED` ships with every artifact.
- **FILED, NOT FIXED:** `engine/status.js` reads `data/wire-ladder.json` and knows nothing about
  `data/state-ladder.json`, so its generated block still reports the protocol ladder alone. `status.js`
  belongs to MEASURE.

## [3.69.0] — 2026-08-07

### Notes
- **THE FORK IS DECIDED AND THE ANSWER IS NO. A MORE CORRECT ENGINE DID NOT MAKE BETTER PREDICTIONS.**
  MILTANK's live in-game leaf, at its own budget (200 rollouts, explore 1.0, horizon 60), scored on
  **8,883 identical positions with identical seeds** through two frozen releases that differ in
  **exactly one file** — `cf6a68fa412c` (pre-WIRE-1) against `dc3c43336539` (WIRE 10). Paired Brier
  **TOP − BASELINE = 0.0000, 95% CI [−0.0007, +0.0007]**, against a split-half noise floor of 0.000642
  and a detectable effect of 0.001013. **The interval is narrower than the smallest effect this sample
  can see, so this is a tight null and not an underpowered one.** McNemar on 7,994 doubly-decisive
  calls: 37 for TOP, 36 for BASELINE, p = 0.91.
- **NEITHER DEPTH METRIC PREDICTS LEAF ERROR.** Per-position divergence depth against per-position
  Brier: under the shipping engine, **lines rho +0.0010 [−0.019, 0.022]** and **turns rho −0.0000
  [−0.021, 0.023]**, MDE 0.0298. Under the baseline both are significant, **both have the wrong sign**
  (more correct simulation → larger leaf error) and both sit at the detection threshold. Δdepth against
  Δerror is **rho −0.0115 [−0.031, +0.008]** on 8,601 positions.
- **THE TWO INSTRUMENTS THE PROJECT THOUGHT WERE DISAGREEING BEHAVE IDENTICALLY**, and the turn metric
  is **not** degenerate here — 13 distinct values, modal share 0.68. "Turns cannot predict because it
  has no spread" is measured and rejected.
- **THE NULL IS NOT THE RULER.** A reversed-order control re-measures the baseline depth with the
  coverage driver's history deliberately changed: **rho 0.836 [0.825, 0.846]** on 8,855 positions. The
  depth reading is mostly a property of the position, so the ceiling on the correlations above is high
  and the zeros are real.
- **THE FIDELITY GAIN IS REAL AND REPLICATES ON AN INDEPENDENT SAMPLE.** On corpus positions rather
  than the swarm's team pool: games that never part **13 → 246**, median first-divergence line
  **12 → 16** — and **median completed turns 1 → 1**, the ladder's own finding, reproduced. The night's
  work was real. It does not reach the leaf.
- **WHAT DOES LIMIT THE LEAF IS CALIBRATION.** ECE **0.1514**; 88 points of predicted range compress
  onto **13 points of observed range**; **when it says 94% it wins 59%.** Both engines remain
  decisively worse than a coin (Brier vs coin **+0.0325 [0.0281, 0.0372]**). Discrimination is 52.48%
  of 8,320 decisive in-sample against a **2.49-point split-half floor for a 2.48-point effect**, and
  **50.48%, p = 0.70, on the held-out fifth** — no ranking out of sample.
- **RECOMMENDATION: STOP SPENDING ENGINE EFFORT ON THE LEAF.** ROADMAP #81's stop recommendation is
  now supported by the instrument it was made without. Engine correctness is not the bottleneck.
- **AN INCIDENTAL CONTROLLED SPEED NUMBER, the first this division has.** Identical positions, seeds,
  budget, shard layout and machine, back to back: **one in-game leaf call is 1.75× SLOWER on WIRE 10
  than on pre-WIRE-1** (2,591 s against 1,478 s for 8,883 calls). Not a battles/sec figure and must not
  be quoted as one.

### Added
- `engine/leaf_engine_contrast.js` → `data/leaf-engine-contrast.json` and
  `data/leaf-engine-contrast-rows.jsonl`. Reads two frozen releases and never the live tree; refuses to
  start unless the two manifests differ in `engine/medicham2-browser.js` alone; stamps the live
  instrument before and after every arm; resumable, with a reused arm **reproduced** rather than
  trusted.
- `engine/leaf_scoring.js` — the leaf-scoring definitions that were private functions inside
  `backtest_winrate.js`. `--verify` replays `data/winrate-backtest-rows.jsonl` and reproduces
  **749 of 749 scalars** of the published artifact exactly; the generator refuses to run if it does not.
- `engine/status.js` prints the contrast, its noise floor, both depth correlations and the depth
  ruler's own reliability. A small number without its floor is how a null gets published from a ruler
  with no resolution.

### Fixed
- **A RESUME GUARD THAT CHECKED COUNTS INSTEAD OF MEMBERS.** Reusing a completed arm was validated by
  row count, which passes when a re-derived sample has the same size and different members — and the
  store grew 8,887 → 9,003 during the run that needed the resume. It checks the id set now, and a
  resumed run reads the photograph rather than today's store.

### Notes on the depth arm's reproducibility
- The reuse-reproduction check **refused the depth arm**, 16 of 24 positions disagreeing, and that is
  correct rather than a bug: `game_differential`'s driver is coverage-seeking and its `CLICKS` /
  `COV_HITS` carry across games deliberately, so a divergence depth is a function of the position **and
  of every game played before it**. The check is scoped to arms that are pure functions of the
  position; the depth arm's substitute is the reversed-order control above. Weakening the check to make
  it pass would have thrown that distinction away.

---

## [3.68.0] — 2026-08-07

### Fixed
- **FOUR DEFECTS WILL FOUND BY READING REAL DIVERGENCES, all measured on STATE rather than protocol.**
- **The spread modifier is decided by targets ENTERED, not targets hit** (`battle-actions.ts:551` sets
  `move.spreadHit` above the whole step list). Dazzling Gleam → Archaludon, measured: partner alive
  **65**; partner behind a **Protect 87 → 65**; partner already fainted **87, unchanged**. The
  shield-vs-alone ratio reads **0.747** against the **0.745** Will spotted in a live game.
- **White Herb — and the third effect is the one that mattered.** Sneasler Intimidated, read at the
  switch-in: atk **−1 → 0**, item slot `whiteherb` **→ empty**. And **Unburden**: Sneasler at 100 Speed
  against an Intimidating Incineroar at 150 on 1 HP took **155 → 0 damage** — losing the item doubles
  100 to 200, Sneasler moves first, and **the Incineroar never acts at all.** Will named that third
  effect; it is a speed-tier change mid-turn, not an announcement.
- **Contact punish fired before the damage.** Order corrected; the state half measured on a 20 HP
  Aftermath body holding a Focus Sash — it survives at 1 and the attacker now pays **43 → 0** (43 being
  a quarter of Tyranitar's 175), with the no-item control still paying 43 in both builds.
- **A critical hit ignores three things and we modelled none.** Meowscarada into Garchomp, Flower Trick
  against Knock Off: **Intimidated 76 → 113**, equal to the un-Intimidated 113; **defender at +2 Def
  58 → 113**; **under Reflect 76 → 113**. Intimidate is on 31,129 observed sets, so this was live
  constantly. **And burned reads 56 → 56, unchanged** — the trap Will named ("i dont think it ignores
  burn tho") is now a probe and a red demonstration. Crit ODDS were already correct and untouched:
  `[1/24, 1/8, 1/2, 1]` against Showdown's `critMult = [0, 24, 8, 2, 1]`.

### Changed
- Census **270/271 → 281/282 live**, `armed` 282/282. Red demonstrations **168 → 177**, 0 failed —
  eleven probes, **eight written RED and watched failing**, three written for claims that turned out
  already live.

### Notes
- **THREE OF THE CLAIMS WERE NOT DEFECTS, AND THE AGENT'S OWN PROBE CORRECTED ITS DIAGNOSIS.**
  The already-fainted-partner half was already right (`live(foes)` filters exactly as `Side#allies()`
  does). **White Herb was not "doing nothing"** — WIRE 56 had wired the effect, at the residual only, so
  three of Showdown's four triggers were missing and the herb was **a whole turn late**; the
  residual/negative-only probe came back LIVE on the unmodified engine and corrected the dispatch. And
  *"a dead attacker takes no contact punish"* has no state consequence here because `curHP` clamps at 0
  — real in the authority, so the guard was added, but counted as a stream fix rather than a win.
- **A GATE WENT RED BECAUSE THE ENGINE GOT BETTER, AND IT HAD SAID SO IN ADVANCE IN ITS OWN FAILURE
  MESSAGE.** `tests/test-protocol-trace.js` PART 5 asserted `meIntim !== meCtrl` with the text *"either
  the declared crit limitation is gone (good news, and this test must then be rewritten)…"*. It was.
  Rewritten, inverted, and the escape hatch closed with a control that requires the `|-unboost|` present
  in one arm and absent in the other, on each engine's own stream.
- **FILED, NOT FIXED — and it is WIRE-10-sized.** `buffsHolderOnHit` and `punishesAttacker` are the
  **same Showdown event** (`onDamagingHit`, which runs *after* the secondaries). Stamina, Weak Armor and
  Rough Skin are all one family; this wire moved the punish below the damage but not below the
  secondaries, and left the buff family in `_stepEffects`. Closing it moves where **every secondary on
  every contact move** lands — its own rung. The agent's control found this by going red on itself.
- `docs/MODELS.md`'s `88.9%` is marked rather than restated: `data/archetypes.json` was regenerated by a
  Python job mid-session and no longer carries it. Third time in two days a regenerated artifact has
  stranded a quoted figure.

---

## [3.67.0] — 2026-08-07

### Notes
- **THE STOP TEST RETURNED A NEGATIVE. THE MEDIAN COMPLETED TURN IS STILL 1, AT THE TENTH CONSECUTIVE
  RUNG.** WIRE 10 restructured the hit loop from per-target to per-step — the largest structural target
  in the file, and the one WIRE 9 predicted was "worth more than the next five mechanics." **That
  prediction was wrong.** It bought **+103 net games, the smallest rung of the last five**, with **265
  games parting EARLIER — the largest such count anywhere in the ladder.**
- **`ordering` fell 440 → 315 (−125) and `extra event emitted by medicham2` rose 140 → 266 (+126).**
  Near enough the same count that the honest reading is **reclassification, not removal.** The +103
  paired and the +5 whole-game agreement are the only figures here that cannot be reclassified.
- **RECOMMENDATION, FROM THE AGENT AND ACCEPTED: STOP GRINDING THE DIFFERENTIAL.** 1,863 of 1,997 games
  still diverge across **1,421 distinct causes, the largest worth 36 games.** That is a long tail with
  no head; the next mechanic is worth ~0.1% of the corpus.
- **AND THE INSTRUMENT ITSELF IS NOW IN QUESTION.** Line depth moved 13 → 19 across the series while the
  median turn never moved once. **Nobody has measured which of the two predicts rollout fidelity** — the
  thing the engine actually exists to serve. Ten rungs were steered by a number whose relevance is
  unvalidated. That is the next question, and it is MEASURE's.

### Fixed
- **WIRE 10 — the hit loop resolves in STEPS across all targets, not target at a time.** The load-bearing
  line is `for (const _step of _STEPS) for (const R of _rows) { if (R.out) continue; _step(R); }`;
  reversing the two `for`s is the entire known-bad engine and is what the demonstrations revert to.
- **THE CONTROL BAR WAS CORRECTED MID-FLIGHT BY WILL AND IT CAUGHT A REAL BUG.** The dispatch said
  single-target must be *byte-identical before and after* — which assumes yesterday was right. Restated
  as *must agree with the AUTHORITY*: **`medicham2` already had one path**, and what was not unified was
  the step structure inside it, indistinguishable at N=1. **The accuracy roll was our step 0 and is
  Showdown's step 4.** A Normal move at a Ghost on a losing roll is `-immune` upstream and was `-miss`
  here — **at one target as much as four.** Byte-identical-to-yesterday would have preserved it.
  Controls after the fix: `test-engine-diff` 1/150 on the same row; 36 single-target clicks × 3 rolls,
  step driver against a reverted per-target driver, **36/36 byte-identical**.

### Changed
- Census **267/268 → 270/271 live**. Red demonstrations at 167, 0 failed; five reversals threw and had to
  be re-anchored, which is the guard working.
- Ladder, 14 arms × 1,997, baseline reproduced exactly, all arms comparable, all eleven watched inputs
  and all three game stores byte-identical around the run. Whole games agreeing **129 → 134**, median
  line **18 → 19**, mean 33.24 → 33.98.
- New top surviving cause unchanged from WIRE 9: `|-end|throatchop <> |upkeep`, **36 games**.
- Filed and not fixed, all three staged in the authority: contact punish paid before the damage where
  Showdown pays it after the secondaries (16 games); a move-level `self` drop emitted after the faint
  rather than before; and a resist berry spent in the apply step where Showdown eats it inside
  `getDamage`.

---

## [3.66.0] — 2026-08-07

### Fixed
- **WIRE 9 — 33 SPREAD MOVES, 56,524 CORPUS USES, 20% OF EVERY DAMAGING CLICK IN THIS FORMAT, DEALT
  ZERO DAMAGE. This is the largest defect found in the entire differential programme and it was hiding
  behind a protocol line.** `playerAction`'s damaging branch was gated on `target` being non-null,
  because `dmgRange(me, target, …)` needs a defender — **and a spread move has no target.** Showdown's
  request carries none for `allAdjacentFoes` / `allAdjacent`, so the driver correctly hands a `null`,
  the click fell through the entire status chain, and Heat Wave / Rock Slide / Snarl became
  `{kind:'affect'}` while Earthquake / Dazzling Gleam / Make It Rain became `{kind:'pass'}`. **In a
  DOUBLES format.**
  It surfaced as a bare `-fail` only because Mode A's pin misses every sub-100-accuracy move on both
  sides. **It had been seen once and mis-filed:** `docs/ENGINE.md` records *"Icy Wind was clicked with
  no target, so `playerAction` classified it as a non-attack"* under a heading blaming the **scenario**.
  Icy Wind is `allAdjacentFoes`.
- **The engine stored NOTHING for whether a move worked — not one boolean.** `moveResult` appears in
  `medicham2-browser.js` exactly once, in a comment. So Stomping Tantrum (3,545 uses) **never doubled**,
  and did so silently: `variablePower` was consumed under `if (_vp && _vp.kind)` and twelve moves carry
  the tag with no `kind`, with the unknown-kind counter gated on the same field.
  Membership was printed before names were typed: `moveLastTurnResult === false` occurs exactly twice in
  `data/moves.ts` — `stompingtantrum` **and `temperflare`** (48 uses, absent from the dispatch). There is
  no tag shape to match on: both carry `variablePower {computed:true}` and **so do ten others, including
  Last Respects at 5,248 uses.**
  Each member read off its own handler. **false** — flinch, paralysis, freeze, sleep, Taunt, Throat Chop,
  Disable, no PP, a `beforeMoveCallback`, **a miss**, a type immunity. **null** — recharge, and
  **Protect**, whose `onTryHit` returns `NOT_FAIL` (`''`): falsy but not `false`. **A Tantrum into a
  Protect does not double; one that missed does.**
- Also taken because this wire opened them: Wide Guard announced an **empty body field** (a whole new
  class, 18 games), and **a quake hits your own partner first** — `getMoveTargets` pushes allies before
  falling through to foes, staged in the authority as `[spread] p1b,p2a,p2b`.

### Changed
- Census **262/263 → 267/268 live**. Red demonstrations **157 → 164**, 0 failed.
- Ladder, 13 arms × 1,996, every arm comparable, baseline reproduces exactly:
  diverged **1903 → 1859**, whole games agreeing **93 → 137**, **median first-divergence line 16 → 18**
  (baseline 13), p75 37 → 41, mean 31.62 → 33.11.
- Net vs baseline **1,275 later / 123 earlier / +1,152**; vs WIRE 8 **506 / 163 / +343**, the largest
  single-rung net since WIRE 7.
- `|-miss|ATT|TGT <> |-fail|ATT` **96 → 5**. All `<> -fail` 233 → 88. `event missing` 672 → 522.
- **THE MEDIAN COMPLETED TURN DID NOT MOVE. It is 1, for the ninth wire running.**

### Notes
- **THE NEXT TARGET IS NOT A MECHANIC, AND THE AGENT DIAGNOSED IT.** `ordering :: |-supereffective| <>
  |-damage|` is 45 games, with `|-immune| <> |-miss|` 31, Rough Skin 28, `|-resisted| <> |-damage|` 19
  and `|-immune| <> |-damage|` 17 beside it — **>110 games, ONE root.** Showdown resolves a spread move
  in **steps across all targets**; this engine resolves it **target at a time**. Staged: Showdown writes
  both `-supereffective` lines *then* all three `-damage` lines; we write `SE(a) DMG(a) SE(b) DMG(b)`.
  **A per-target loop against a per-step one parts on turn 1 of almost any doubles game containing a
  spread move, however many mechanics are correct** — which is exactly why the LINE moves (13 → 18) and
  the TURN never does. One restructure of the hit loop is worth more than the next five mechanics.
  **If that lands and the median turn is still 1, that is the point to stop grinding the differential.**
- **A LADDER RUN WAS VOIDED AND IS REPORTED, NOT DROPPED.** OPS's ingest appended to
  `data/games.bo3.jsonl` at 13:01:49 mid-run; the team-pool digest moved between arms and
  `arms_comparable` refused all twelve, writing `determinism.verdict: "THE TWO BASELINES DISAGREE. Do
  not read the table below as a ladder."` The instrument worked. **But this is the photograph rule
  arriving through the one door a frozen engine release cannot close: the release freezes the ENGINE;
  the game store is not in it.** The published table is the clean re-run.
- **`wire_ladder.js` carried WIRE 8's bug one function over.** The drift check named
  `'a01-baseline-run1'` / `'a12-baseline-run2'` as literals, and inserting a rung renamed the second.
  Both baseline arms are now derived, refusing if there are not exactly two. `top_rung` was already
  derived and reads `a12-wire9`.

---

## [3.65.0] — 2026-08-07

### Fixed
- **WIRE 8 — both families were real, and I HAD READ THE ARTIFACT'S COLUMNS BACKWARDS.**
  `classify()` writes `SD <> ME` (`game_differential.js:1145`), so `|-fail|p2b <> |-sidestart|Tailwind`
  means **Showdown FAILS the second Tailwind and this engine SET it** — the opposite of what the
  dispatch said. The agent established it by staging the case in both engines rather than by re-reading
  the string.
  `Side.addSideCondition` returns false on an already-present condition with no `onSideRestart`, and
  measured across the format **none** of tailwind / reflect / lightscreen / auroraveil / safeguard /
  stealthrock / stickyweb has one — exactly two do (Spikes cap 3, Toxic Spikes cap 2). **We reset the
  clock, so a side re-clicking Tailwind or Reflect once a turn kept it forever.**
- The companion `-sideend` cause was not confused state: `scrP`/`scrS` were keyed by damage **category**,
  so the engine had no NAME to announce. Screens are now three named clocks keyed by move id, with
  category and order derived from `halvesDamage` — no screen is named in the engine.
- **Two-turn moves: an order bug, an announcement bug AND a state bug.** All ten `chargeTurn` moves in
  Champions carry `this.add('-prepare')` as the FIRST line of `onTryMove`, above the boost and the
  weather test. **A rain Electro Shot fired with no +1 SpA — Showdown 97, medicham2 65** into a Snorlax
  under Drizzle. Power Herb is `isNonstandard: 'Past'`, so its branch was kept correct and given no probe.

### Changed
- Census **258/259 → 262/263 live**. Red demonstrations **151 → 157**, 0 failed.
- Ladder, 12 arms × 1,995, all COMPARABLE, baseline reproduced exactly across three end-to-end runs:
  diverged **1931 → 1893**, whole games agreeing **64 → 102**, net vs baseline **+1,029** (was +882).
- Attribution: `|-prepare|` occurrences **141 → 0**; tailwind 94 → 27; solarbeam 107 → 26; electroshot
  68 → 10; `-sidestart` 142 → 18.
- **THE MEDIAN COMPLETED TURN IS STILL 1 — eight wires, never moved. And this time the median LINE did
  not move either** (16). Mean and p90 rose, so the tail lengthened while the middle stood still.

### Notes
- **THE INSTRUMENT WAS AIMED AT THE WRONG ARM, AND MY WIRE 8 ROADMAP WAS WRITTEN OFF IT.**
  `engine/wire_ladder.js` built `what_remains_at_the_top_rung` from a **hard-coded `'a09-wire6'`**, so
  the surviving-cause list published with WIRE 7 was WIRE 6's — still naming the 251 hospitality rows
  WIRE 7 had already zeroed. Now derived from the last non-baseline arm, with a `top_rung` block in the
  artifact. **Both of my inputs to this wire were wrong — the column order and the arm — and it landed
  anyway because the agent checked instead of trusting.**
- **THE TAIL IS NOT FLAT. I called that wrong too.** Read off a correct top rung, the largest surviving
  cause is **114 games** in one shape across four slot spellings:
  `|-miss|ATTACKER|TARGET <> |-fail|ATTACKER`. It is pre-existing and **growing with depth** —
  41 → 55 → 83 → 114 as games survive longer. Behind it: `-end|throatchop` 30, `-activate|feint` 25,
  `-enditem|whiteherb` 10. **It is not diagnosed**, and it is the same miss-vs-fail split already filed
  as ROADMAP #84.
- Two instruments went red for good reasons and both are closed without lowering a bar: Electro Shot now
  declares `expect: 'agree'` with `closed_by`, and the `ordering` acceptance test got a replacement
  staged **from the ladder's own largest surviving ordering cause** (sandstorm residual is speed-sorted,
  not slot-ordered).
- Declared, not fixed: hazard duplicates (the layer cap is not in `data/tags.json`, which cannot be
  regenerated — ROADMAP #65); side-residual sub-order; overlapping screens still apply one multiplier,
  unchanged deliberately.

---

## [3.64.0] — 2026-08-07

### Fixed
- **WIRE 7 — a BATCH of seven targets, and TWO OF THEM HAD NO DEFECT.** That is half the result and it
  is reported first.
  - **FOCUS SASH: nothing was wired, because nothing was wrong.** Staged in both engines, Showdown
    writes `|-enditem|Focus Sash` then `|-damage|1/103`; so does `medicham2` — same order, same 1 HP,
    same spent item. **It was ranked by ITEM USAGE (14,668), not by divergence.** The ladder's top rung
    carries exactly ONE `focussash` cause and it is the Knock Off bug wearing a Sash.
  - **REDIRECTION vs IMMUNITY: the diagnosis was wrong and INVERTED.** `onFoeRedirectTarget` is already
    gated on `validTarget` and, for Rage Powder, `runStatusImmunity('powder')`, both of which this
    engine asks. The real defect was the *announcement*, the other way round: we emitted an
    `|-activate|move: followme` Showdown never writes, and omitted the `|-activate|ability: Lightning
    Rod` it does.
  - **SHED TAIL: the claim was stale** — WIRE 130 already builds the doll. Wrong were the order and the
    rounding.
- **The six that landed:** Hospitality's full-HP gate and its phantom `|-ability|`; Knock Off stripping
  before the damage and taking mega stones (**75 legal items declare `onTakeItem` in this format and all
  75 are mega stones**); a self-eaten resist berry recorded as knocked off, writing one line where
  Showdown writes two; pinch and status berries firing at the residual instead of `eachEvent('Update')`;
  the Substitute doll floored instead of `ceil(maxhp/4)`, with its `-start` after the `-damage`; and
  **Protean converting after the move resolved** — measured, Meowscarada's Earthquake into an
  unfaintable Ceruledge reads **123 with no ability, 123 with Protean, 184 after the fix.** The
  ability's entire offensive half was worth exactly zero.

### Changed
- Census **251/252 → 258/259 live**. Red demonstrations **142 → 151**, 0 failed, each shown red on a
  source-reverted engine.
- **THE MEDIAN FIRST-DIVERGENCE LINE MOVED FOR THE FIRST TIME IN THE SERIES — 14 → 16**, and the paired
  `median_delta_lines` against the baseline is **1**, the first non-zero. p90 **55 → 89**, mean
  **23.36 → 27.75**. Whole games agreeing **33 → 64** (baseline 6).
- **THE MEDIAN COMPLETED TURN IS STILL 1.** Seven wires have not moved it.
- Net vs baseline **1,060 later / 178 earlier / +882**; vs WIRE 6 **533 later / 174 earlier / +359**.
- Per-family, both arms re-run alone and asserted COMPARABLE: `hospitality` **251 → 0**; `knockoff`
  90 → 21; redirect 63 → 15; `protean` 39 → 19; `sitrusberry` 38 → 6; `substitute` 31 → 3; `focussash`
  7 → 3 (nothing wired — a consequence of the Knock Off fix); `shedtail` 6 → 2.
- `-damage field 3` went **UP** 169 → 257: games surviving 16 lines reach bugs the earlier arms could
  not get to.

### Notes
- **MY RANKING HEURISTIC WAS WRONG, AND THIS IS THE THIRD CORRECTION TO IT IN ONE NIGHT.** I first
  picked targets because they were interesting to read (Shed Tail, 64 uses), then over-corrected to
  entity usage (Focus Sash, 14,668) — and **entity usage is not bug frequency.** A Sash appears in a
  seventh of all games and diverges in one cause. The correct rank is by the DIVERGENCE's own weight —
  how many games it parts, times how often the entity occurs — which is what the per-family table above
  actually measures and what the next batch will be chosen on.
- **THREE INSTRUMENTS WENT RED BECAUSE THE ENGINE GOT BETTER, AND THE BAR WAS NOT LOWERED.** Two §5a
  directed scenarios stopped diverging and now declare `expect: 'agree'` + `closed_by`, failing loudly
  if they re-open. A scripted game ran past the end of its one-turn script and reported a FIXED engine
  as `THREW`. The `ordering` acceptance test needed a live case, and one was staged **from the ladder's
  own surviving causes** rather than by relaxing the assertion. `wire_ladder.js` refused to publish the
  arm at all ("1994 games vs 1995") — a recharging body's `recharge` pseudo-move is not a dex entry, so
  the driver answered `pass` and Showdown rejected it; now counted as `declared_gaps.forced_first_slot`.
- Declared and not fixed: Hospitality's `onSwitchInPriority: -2` (16 abilities carry one, `tags.json`
  carries none); Shed Tail's missing self-switch and `ceil(maxhp/2)` cost; Lightning Rod not drawing its
  own ally's move (10 rows); and Protean now converting on ~9 moves Showdown fails at `Try`, traded
  against 20 it previously missed.
- **`status.js` still opens FEATURE SEMANTICS CHECK FAILED on eight features. This wire adds to it and
  cannot close it** — a refit is MEASURE's and stays gated behind MEDICHAM per Will's standing call.

---

## [3.63.0] — 2026-08-07

### Added
- **THE RELEASE LADDER — `engine/wire_ladder.js` → `data/wire-ladder.json`.** Every frozen release of
  the 2026-08-06/07 wire night, replayed through `engine/game_differential.js` under **one** pinned
  census and **one** team pool, so all nine arms are mutually comparable rather than only adjacent.
  This replaces the pairwise before/afters retracted in 3.62.1, and it replaces WIRE 6's own artifact,
  which pinned its census to a path inside an agent scratchpad and stopped being checkable when that
  session ended. The pin is now `data/wire-ladder-census.pin.json`, checked in beside the result.
- **1,995 games per arm, ten arms, identical sample by construction** — the release manifests show
  exactly one file moving anywhere in the ladder (`engine/medicham2-browser.js`), so every arm builds
  the same teams. `arms_comparable.compare()` cleared all nine arms against the baseline; the eleven
  watched inputs were byte-identical before and after; the planted-divergence proof and all seven
  equivalence rules passed on every arm.
- **Three cuts that were never published as wires are rungs of their own, each with its reason stated
  in the generator** — mega resolution order, the Knock Off base-power truncation, and the fixed-point
  half of WIRE 4. Folding them into the named wire that follows is the same misattribution WIRE 5 was
  written to stop.

### Changed
- **THE HEADLINE IS A NEGATIVE. The median game still parts after ONE completed turn, at every rung.**
  Six wires did not move it. Whole-game agreement went **2 → 22 of 1,995**; 98.9% of games still
  diverge. What moves is the DEPTH of the first divergence — median line 13 → 14, **mean 15.01 →
  23.97**, p90 30 → 57. Paired over the same games, the top rung parts later on **742**, earlier on
  **141**, and at the same line on **1,112**. More than half the sample is untouched by the whole night.
- **Per rung, net games parting later (paired against the rung before it):** mega order +73, Knock Off
  truncation **0**, WIRE 1 +65, WIRE 2 +156, WIRE 3 +99, WIRE 4 fixed-point +16, WIRE 4 recoil/drain
  +48, WIRE 6 **+287**. Class effects: `-miss field 3` **18 → 1** (WIRE 1), `unrelated event mismatch`
  **700 → 562** (WIRE 2), `-damage field 3` **216 → 141** across WIRE 4's two halves, `turn order`
  **85 → 3** (WIRE 6), `ordering` **247 → 170** (mega order).
- **AN UNPUBLISHED INTERMEDIATE OUTRANKS A NAMED WIRE.** The mega-resolution-order cut
  (`28e66a7c9ab8`, 02:36) is worth more than WIRE 1 on every measure here — net **+73** against **+65**,
  `ordering` **247 → 170** against `-miss field 3` **18 → 1**. It sits between the baseline release and
  WIRE 1, so a pairwise baseline→WIRE-1 comparison credits WIRE 1 with all of it and reports WIRE 1 as
  more than twice its true size. The largest rung of the night is WIRE 6 (+287); the finding here is
  the misattribution, not a new champion.
- **An unambiguously correct arithmetic fix was worth zero at the whole-game level.** The Knock Off
  base-power truncation moved the divergence position in **0 of 1,995 games** and reclassified four.
  It is right, it is not measurable by this instrument, and those are different statements.
- **Coverage, controlled: distinct moves connected 224 → 261 (+37)**, against the **173 → 197** the
  wires' own uncontrolled ~346-game reports claimed. Absolute levels are not comparable across a
  different census; the controlled delta is **larger** than the claimed one — WIRE 4's pattern again.
- **A class count can fall because a game parts EARLIER on something else.** `-damage field 3` rises
  170 → 216 over WIREs 1-3 before falling to 141: the earlier wires push games deeper and expose damage
  divergences that had been masked. A per-class delta is only readable beside the depth column, and
  `event missing from medicham2` growing 604 → 627 is not a regression.
- **141 games part EARLIER than the baseline after six correct fixes** (7.1%), most of it appearing at
  the mega and WIRE 1 rungs. Changing a trajectory surfaces a different pre-existing bug sooner. This
  is why "net later" is reported and never "later".

### Fixed
- **`provenance.js` penalised the workflow it recommends.** It tells every generator to stamp
  `run_stamp.sourceDigests()` as `source_digests`, then iterates **every** key of that map as a path to
  re-hash — including the prose `note` key that same function writes. The first artifact to take the
  advice (`data/wire-ladder.json`) was marked *unverifiable* for having taken it. `run_stamp.js` now
  exports `STAMP_NOTE_KEY` and `provenance.js` imports it and skips exactly that key, so one place
  knows which key is prose. Artifacts verified by CONTENT digest **5 → 6**; the mtime-only ratchet
  falls 92 → 91. `docs/MEASURE.md` §19's note recording the per-generator workaround is superseded in
  place rather than deleted.

### Notes
- **`tests/test-mechanics.js` was not run at any point in this pass**, because running it regenerates
  `data/mechanics-census.json` — the steering input the ladder pins. `tests/run-all.js` runs it, so
  run-all was not used either; the five gates that read `provenance.js` or `run_stamp.js`
  (`test-json-nan-guard`, `test-timestamps`, `test-site-data-fresh`, `test-engine-release`,
  `test-quality`) plus `test-docs-current` were run standalone and pass.
- **Carried forward to ENGINE, not fixed here:** every arm reports `trace_body_off_field` 54-69 — a
  `??` identifier reaching the medicham2 stream, which `tests/test-protocol-trace.js` PART 6 says must
  read **0**. It is present in all nine releases, so the night did not introduce it.
- **What remains at the top rung**, in cause order: `[from] hospitality` heals medicham2 emits and
  Showdown does not (127 games, the single largest cause), Illusion (`zoroarkhisui` on every
  `switch: a different body`), `-prepare` for two-turn moves, `-activate|feint`, `-end|throatchop`.
  Full list in `data/wire-ladder.json` → `what_remains_at_the_top_rung`.
- **Still outside any check:** an uncommitted edit inside `SHOWDOWN_PATH`. The other two blind spots
  `arms_comparable.js` declares — the driver itself and `data/protocol-events.json` — are now digested
  before and after every arm and recorded in the artifact.

## [3.62.2] — 2026-08-07

### Fixed
- **WIRE 6 — TWO OF THE ENGINE'S 27 ACTION KINDS ANNOUNCED NOTHING.** Everything above the kind
  dispatch — Taunt (WIRE 119), Throat Chop (WIRE 77), the priority bracket, and the `|move|` line
  itself — asked `actionMoveId(a)`, which read `a.mv` and fell back to **three hand-written rows**. Two
  kinds were not in them:

  | kind | moves | corpus uses | announced |
  |---|---:|---:|---|
  | `trickroom` | 1 | 8,077 | **nothing** |
  | `pass` | **46** — Quick Guard 803, Ally Switch 190, Instruct 173, Heal Pulse 126 | 2,145 | **nothing** |
  | the other 25 | 454 | — | correctly |

  `playerAction` now stamps `mv` on every action it builds. A bare `{kind:'pass'}` built by a *caller*
  still carries no `mv` and still announces nothing, which is correct.
- **It moved three other rules, measured against a frozen release rather than argued.** Quick Guard
  **+3**, Ally Switch **+2**, Counter **−5** and Mirror Coat **−5** were all resolving at bracket **0**.
  Taunt and Throat Chop now refuse them too.

### Changed
- Census **249/250 → 251/252 live**. Red demonstrations **139 → 142**, 0 failed.
- **Coverage +20 — distinct moves connected 177 → 197**, the largest gain of the series (WIRE 3 +5,
  WIRE 4 −1). Species 258 → 260, abilities 161 → 162. `not_exercised` stays 5 but its membership
  swapped: `move:reversesSpeed` left, `move:inflictsToxic` arrived.
- Controlled pair, the instrument's own verdict: **COMPARABLE** — before `45485dee6a43`, after
  `3fd06d865427`, both steering `c6be796631be`, 346 games each. `event missing` 133/107 → **120/113**,
  of which the `|move|`-head sub-family **56 → 0**; **turn order 9 → 0**; diverged **343 → 341**.

### Notes
- **THE ROOT EXPLAINS 27 OF 133 AND THE REPORT SAYS SO.** Of the family, 56 games first part on a
  missing `|move|` line; **27** of those resolve to a silent kind (Trick Room 20, Heal Pulse 3, Quick
  Guard 2, Wish 1, Role Play 1). The other 29 resolve to a LOUD kind and are lost for a different
  reason; 77 are some other event entirely. Post-wire the whole `|move|`-head sub-family reads 0, which
  is *more* than 27 — the surplus is the priority correction. **27 is claimed, 56 is observed.** A
  partial root honestly bounded is worth more than a claimed total.
- **A CLASS COUNT IS A FIRST-DIVERGENCE COUNT, NOT A BUG COUNT.** The class fell 13 while its causes
  rose 6: emitting an owed line pushes first divergence later, so games leave the class and other games
  arrive in it.
- **A FIFTH PROBE FOUND RESTING ON THE DEFECT IT WATCHED — and this one was WIRE 4's.**
  `tests/test-tag-wire.js` asserted `rain Solar Beam ×0.545` against a 3% tolerance. Replayed on frozen
  releases: pre-WIRE-4 `cf6a68fa412c` gives 22 → **11**, exactly ×0.500 — **the probe passed because of
  the float truncation**. Post-fix `45485dee6a43` gives 22 → 12, because Showdown's `floor(…) + 2` means
  halving base power cannot halve damage when the top roll is 22. The arm now aims at a body where one
  point is not 4.5%; the tolerance is unchanged, and stripping `weatherScaled` still reads ×1.000 and
  fails.
- **`tests/run-all.js` REPORTS FAILURES ITS OWN TESTS DO NOT REPRODUCE** — a different set each run, on
  tests that play real games (`test-wiring` read *mega 0.00/game* under the runner and normal standalone).
  Every failure this session was re-run standalone before being believed or dismissed. Filed; it means
  the suite's verdict is not currently trustworthy on its own.
- **The published artifact is a SINGLE arm and carries `steering` but no `baseline_comparability`** —
  the comparable pair lives in the session scratchpad. That is the "the number lives where nobody will
  look" problem in miniature, and it is superseded by the release-ladder replay: every frozen release
  from WIRE 1 to WIRE 6, one pinned census, one pinned team pool, each against the next.
- Four filed: `{kind:'struggle'}` is returned by `chooseAction` and dispatched by nothing; `classify`
  files an ordering fault as a missing event (~29 games — the largest remaining share of that class, and
  an instrument bug rather than an engine one); `movePriority` reads 0 for Metal Burst and Comeuppance
  where both are −4; and the runner's non-reproducible failures.

---

## [3.62.1] — 2026-08-07

### Fixed
- **WIRE 5 — THE DIFFERENTIAL'S SAMPLE WAS STEERED BY A FILE OUTSIDE THE PHOTOGRAPH, AND NOTHING
  CHECKED IT.** `covWant()` prefers the legal action reaching the **least-exercised** census row, and
  `COV_TARGETS` read the LIVE `data/mechanics-census.json`. **Landing a probe changes which games the
  differential plays.** Every before/after pair reported tonight was therefore uncontrolled.
- **`engine/steering.js` + `engine/arms_comparable.js`.** The selection policy is now declared, its
  inputs digested, and **an incomparable pair is REFUSED rather than reported** — `--baseline` exits 3
  having written no artifact and played no game, and an arm with no `steering` block fails closed.
- **A SECOND, UNLISTED STEERING INPUT FOUND WHILE FIXING THE FIRST.** `diff_swarm.buildSwarm` reads the
  bo3/ots stores live and picks teams by a **stride**, so one appended game shifts which teams play —
  and OPS appends continuously. Now digested as `team_pool_digest` (the keys actually picked), which
  replaces WIRE 4's hand-written size+mtime assertion with something the instrument checks itself.

### Changed
- **EVERY ABSOLUTE FIGURE IN WIRE 4's BEFORE/AFTER TABLE IS RETRACTED. THE CONCLUSION IS LARGER THAN WAS
  CLAIMED.** Both arms re-run at 395 games under one pinned census (`c6be796631be`) and one team pool
  (`19174ee16416`), asserted comparable by the instrument; the before-arm run a **third** time
  reproduced the first exactly, so this is input and not noise.

  | | published 3.62.0 | controlled |
  |---|---|---|
  | `-damage field 3` | 46/45 → 31/31 | **59/56 → 38/35** |
  | the effect | −33% / −31% | **−36% / −37.5%** |
  | `[from]recoil` causes | 4 → 2 | **8 → 0** |
  | diverged | 391 → 390 | **392 → 389** |
  | moves connected | 177 → 176 | **175 → 173** |

  Receipts: WIRE 4's after-arm was written 06:51:15 and the census regenerated at 06:57:42 — **six
  minutes later** — so the census those arms ran under no longer exists. The store also grew,
  206,789,118 → 207,410,186 bytes.
- **By the same reasoning, the before/after numbers published for WIREs 1, 2 and 3 are also
  uncontrolled and should not be quoted as magnitudes.** Each landed probes into the census in the same
  session that measured with it. Their *findings* stand — they rest on red demonstrations and on
  Showdown's source, not on the differential's deltas — but their deltas do not.
- Census **249/250 live, unchanged and deliberately so**: no mechanic moved, and `test-mechanics.js` was
  not run, because running it regenerates the very file this wire pins.

### Notes
- **WHY OPTION 3 AND NOT "PUT IT IN THE RELEASE".** Freezing the census into the release is not merely
  bigger, it is **wrong for the only case that matters**: a before-arm runs as `--release <old-id>`, so
  the before-arm would read the OLD census and the after-arm the NEW one — **the two arms would steer
  differently by construction.** It is also unworkable, measured rather than argued: the census carries
  a `generated` stamp, so its bytes change on every `test-mechanics.js` run even when no mechanic moves
  (content digest `28203348a7ff` stable, file digest `c6be796631be` not), and every test run would fork
  a release id.
- **THE CONTROL WAS CLEARED BEFORE THE KNOB WAS TURNED.** Two arms, same release, byte-identical census
  → identical numbers, guard exit 0. Only then the knob: same frozen release, census minus 43 move rows
  → `unrelated event mismatch` 20→16, `ordering` 6→9, `-damage field 3` 2→1, moves connected 76→80 —
  **on a byte-identical engine.** That is the bug demonstrated, not asserted.
- Three more filed: `game_differential.js` itself is digested nowhere; `data/protocol-events.json` is a
  **third** unlisted input that moves every class count; and `COV_TARGETS`' comment says 235/192/43
  where the run prints 250/205/45.
- Not ours, reported not filed: `status.js` now shows **eight** features whose meaning changed since the
  fit (was three) — `koTarget`, `dmgFrac`, `killIsRoll`, `killsThreat`, `switchSurvives1`, `switchKOSlow`,
  `switchDiesFirst`, `screenValue`. That is WIRE 4's `md4096` propagating into board features. **It is
  MEASURE's refit**, still gated behind MEDICHAM per Will's standing call.

---

## [3.62.0] — 2026-08-07

### Fixed
- **WIRE 4 — THE FIXED-POINT HYPOTHESIS HELD, AND LIFE ORB DAMAGE WAS WRONG 64% OF THE TIME.** Showdown
  does every damage multiplier in fixed point on 4096ths with a round-half-up baked into integer
  arithmetic (`sim/battle.ts:2329`). `medicham2` multiplied in floating point. Exact comparison against
  `battle.actions.getDamage` at rolls 15 and 0, **tolerance zero**, 300 sampled real matchups per arm:

  | arm | before | after |
  |---|---|---|
  | no modifier — the CONTROL | 293/300 | 293/300 unchanged |
  | a SPREAD move | **226/300 (75.3%)** | **291/300 (97.0%)** |
  | a **LIFE ORB** holder | **107/300 (35.7%)** | **293/300 (97.7%)** |

  Both fixed arms land exactly on the control's floor. `md4096` / `ch4096` / `mdChain` are Showdown's
  `modify`/`chain`, exported, and ~30 sites route through them — **one implementation of a FACT**, per
  `CLAUDE.md`, not 30 patched call sites. The float argument is not an approximation:
  `trunc(1.3 × 4096) = 5324` **is** Life Orb's literal `[5324, 4096]`.
- **A SECOND ROOT THE DIFFERENTIAL NAMED: recoil never went through `modify` at all.** Three of the
  four largest before-arm causes were `[from]recoil`.
  ```
  showdown   clampIntRange(Math.round(dealt * recoil[0] / recoil[1]), 1)
  medicham2  Math.floor(dealt * (recoil[0] / recoil[1]))
  ```
  **Two errors on one line** — the wrong rounding *and* no minimum of 1. Measured by calling it: dealt
  1 → 1 vs 0; 5 → 2 vs 1; 102 → 34 vs 33. Drain is the same rule.
- **`tests/test-engine-diff.js` structurally could not see any of this.** Its stated bar is *"midpoints
  within 12%"*, chosen so rounding would not read as a bug. A 12% tolerance cannot find a 1-point error.

### Changed
- `-damage field 3` **46 games / 45 causes → 31 / 31**. `-heal field 3` 2 → **0**. `-immune field 3`
  1 → **0**. Diverged 391/395 → 390/395. Census **246/247 → 249/250 live**. Red demonstrations
  **136 → 139**, 0 failed.
- Coverage **down one** — distinct moves connected 177 → 176, because a recoil that rounds up kills its
  user sooner. Abilities reached 160 → 161. Reported, not omitted.
- `engine/game_differential.js` gained `--release <id>`, so a before-arm runs from an existing frozen
  release without hand-cutting or swapping files in the tree.

### Notes
- **A FALSE LIMB OF THE HYPOTHESIS, FOUND ONLY BY MEASURING IT.** `boostMul(-1)` returns `2/3` where
  Showdown divides by 1.5, and `3 * (2/3) === 1.9999999999999998`. A genuine float defect — and **not
  part of this family**: the boosted arms read 293/292/292 against a control of 293. Left alone and
  recorded rather than swept in. The instruction was to test the hypothesis rather than assume it, and
  this is what that bought.
- **THE RECOIL FIX TURNED TWO GREEN PROBES RED, AND THAT IS THE FINDING.** The Choice Scarf and Swift
  Swim probes both prove *"the foe never acted"* by asserting the killer took **zero** damage — and both
  had the killer click **Wave Crash**, whose recoil clamps to a minimum of 1. **They were green BECAUSE
  OF the bug**, which made a real cost vanish. That is the fourth probe in four wires found resting on
  the defect it was meant to watch, and the first where the probe was green *because* the engine was
  wrong. It is also the argument for grinding wires over auditing probes: the differential surfaces
  these for free, attached to a real bug, with the fix already in hand.
- **WIRE 8 FILED AND IT IS A MEASUREMENT-INTEGRITY BUG, NOT A MECHANIC.**
  `data/mechanics-census.json` **STEERS** the differential and sits outside the photograph. `covWant()`
  scores a move by the least-exercised census mechanic it can reach, and `COV_TARGETS` is the **live**
  census — so **landing a probe changes which games the differential plays.** Found because the
  before-arm moved 51/50 → 46/45 across two runs of the *identical frozen release* over a byte-identical
  store; a third run reproduced the second exactly, so the instrument is deterministic and the input was
  not. Both arms above were re-run after the census settled.
- Also filed: recoil is charged on **uncapped** damage (Showdown passes `move.totalDamage`; a 1 HP kill
  with Brave Bird costs 1 there and 21 here); base-power modifiers are applied to the wrong quantity
  (Technician, Tough Claws, terrains and the type items are `onBasePower` upstream — arithmetic now
  right, placement not); and `board.js` still multiplies in float, with the exports now in place for it
  to call the one implementation.
- One unrelated red gate **fixed rather than filed**: `tests/test-no-silent-failure.js` was red on four
  new silent catches in `engine/game_differential.js` — the format-standing lookups added earlier today.
  They now count and print themselves. **Not re-baselined**, because `--update` rewrites a shared
  artifact.

---

## [3.61.3] — 2026-08-07

### Fixed
- **WIRE 3 — REFUSED STAT DROPS. IT WAS TWO BUGS, NOT ONE, AND THE SECOND IS THE EXPENSIVE ONE.** The
  spec asked which of the two it was; the answer, measured on STATE (`boosts.at` after switch-in) before
  a line changed, is **both**:

  | | medicham2 | Showdown | |
  |---|---|---|---|
  | Intimidate → Clear Body | atk **0** | atk **0** | blocked-but-silent — a protocol bug |
  | Charm (−2) → Inner Focus | atk **0** | atk **−2** | **refused here, applied there — a STATE bug** |

  **We were refusing stat drops that should land.** Inner Focus blocks *Intimidate*, not Charm. Three
  separate sites decided "is this drop refused" and **none read the tag's `blocks` param** — a ten-name
  `INTIM_IMMUNE` list, `TAGS.has(…,'preventsStatDrop')` used as a **boolean** at both move-inflicted
  sites, and a hardcoded `clearbody‖whitesmoke‖fullmetalbody` triple in the secondary block. From
  `data/abilities.ts`: Keen Eye / Illuminate / Mind's Eye delete `boost.accuracy` **only**, Big Pecks
  `boost.def` **only**, and Inner Focus / Oblivious / Own Tempo / Scrappy fire **only** on
  `effect.name === 'Intimidate'`. **All eight took a Charm at stage 0 and now take −2.** One gate, four
  callers, with `preventsStatDrop.onlyFrom` added to `engine/tag_dex.js`.

### Changed
- Target family `|-fail|X|unboost|…` **16 games → 1**. All `-fail` mentions **81 → 67**.
  `event missing from medicham2` 145 → 134.
- Census **244/245 → 246/247 live**. Red demonstrations **134 → 136**, 0 failed.
- **Coverage went UP this time: distinct moves connected 169 → 174.** A scoped refusal means Charm,
  Parting Shot and Breaking Swipe now *do* something instead of being eaten. Distinct species fell
  257 → 256 — the same mechanism working the other way, reported rather than omitted.
- Divergence unchanged at 393/395; median unchanged at 1 turn.
- `docs/ADR-002` no longer quotes the census count. **That figure moved four times in one night and was
  hand-corrected three of them**; it now points at the artifact, like the store counts in
  `docs/GAME-DIFFERENTIAL-DESIGN.md`.

### Notes
- **A THIRD PROBE FOUND ENCODING ITS BUG.** `Clear Body refuses Intimidate` was green — on an engine
  that refused *everything* from *everyone*. WIRE 2 found the same shape (a probe that stopped one turn
  before the turn that separates the engines). **Three in three wires.** A probe that only ever asserts
  the behaviour the engine already has cannot fail, and "armed" does not fix that — the red
  demonstration proves the probe detects *a* break, not that it watches the *right* case.
- Three WIREs filed: **Guard Dog REVERSES Intimidate** — measured in the authority, Okidogi ends at
  **atk +1** with `|-ability|…|Guard Dog|boost`, where we leave it at 0; **Mirror Armor reflects the
  drop back at the source** (~390 store mentions) and the new gate deliberately suppresses `-fail`
  for it rather than inventing a line Showdown never writes; and **Hospitality's heal sits at the wrong
  point in the entry-effect order**, which is also the one survivor of the target family.
- Depth reported as **mega evolutions 504 → 518**, real counted events. `total_lines_collapsed` is not
  quoted, per 3.61.2 — it is quadratic in depth.

---

## [3.61.2] — 2026-08-07

### Fixed
- **WIRE 2 — THE `stall` VOLATILE HAD THREE RULES IN SHOWDOWN AND ONE IN OURS.** Protect and its family
  carry `onPrepareHit(p) { return !!this.queue.willAct() && this.runEvent('StallMove', p); }`, and the
  `stall` condition carries `onStallMove(p) { const ok = this.randomChance(1, counter); if (!ok) delete
  p.volatiles['stall']; return ok; }`.
  1. **The counter is deleted the instant the roll fails**, so the shield after a failed one is a clean
     100% again. `medicham2` incremented on every attempt and never brought it down — a body that lost
     one roll decayed 1/27, 1/81, 1/243 **for the rest of its life on the field.**
  2. **A shield fails outright when its user holds the last action of the turn**, short-circuited before
     the die is drawn. We did not model it at all. **Protect is on 99.30% of declared teams**, so four
     bodies clicking a shield means the slowest one simply fails.
- The pre-pass had to move **below `sortTurnOrder`** — rule 2 is only answerable from resolution order.
- `docs/ADR-002` carried a census figure this change staled; fixed in the same session.

### Changed
- Target family (`|-singleturn|X|protect` ⇄ `|-fail|X`, both directions) **37 games → 7**.
  `unrelated event mismatch` 125 → 100. `-unboost: a different body` 1 → 0.
- Divergence **394/395 → 393/395**, and the stripped-stone control arm 395 → 394. **That is one game.**
  The instrument is deterministic and corpus-pinned so it is a real game, but the honest reading is
  still WIRE 1's: a game stops at its first divergence, so clearing a cause makes games run ON and part
  deeper — which is why three classes GREW while the target family emptied.
- Census **243/244 → 244/245 live**. Red demonstrations **132 → 134**, 0 failed.
- **THE COST, STATED RATHER THAN OMITTED:** distinct moves connected fell **173 → 169** and
  `not_exercised` rose 6 → 7. That is the fix working in the direction that hurts coverage — a
  correctly-resetting shield goes up more often, so fewer clicks connect.

### Notes
- **A PROBE THAT ENCODED THE BUG, REPLACED.** `repeated Protect starts failing` spent three turns and
  asserted `dealt[0]===0 && dealt[last]>0` — the decay half, which was never wrong. **It stopped one
  turn before the only turn that separates the two engines**, so it scored LIVE on a wrong engine for
  as long as it existed. A probe can be green, armed, and still be watching the wrong turn.
- **WIRE 1's DEPTH HEADLINE WAS WRONG AND IS CORRECTED HERE RATHER THAN REPEATED.**
  `total_lines_collapsed` is not "protocol lines compared": `alignAndCheck()` re-reduces the whole
  stream once per turn and `bumpNorm` counts every invocation, so a T-turn game contributes ~T²/2 ×
  lines-per-turn. **The metric is quadratic in depth.** WIRE 1's reported "+6.6% lines compared" was
  nearer **+3% of turns**, and 21,214 → 54,773 here is roughly **1.6× the turns played**, not 2.6× the
  protocol. Filed as its own item. The direction of both findings survives; the magnitudes do not.
- Three WIREs filed and not fixed: **Wide Guard and Quick Guard share the `stall` volatile and this
  engine RESETS it** — they carry `onTry() { return !!this.queue.willAct(); }` and
  `onHitSide(s, src) { src.addVolatile('stall'); }`, so they never *roll* the counter but they *arm*
  it, and we do the opposite (`tookProtectTurns = 0`); the quadratic metric above; and **four-fifths of
  the remaining `-fail` is not Protect** — 81 first divergences still mention it, mostly
  `|-fail|X|unboost|[from] clearbody / innerfocus / hypercutter / scrappy / oblivious`, where Showdown
  announces a refused stat drop and we emit nothing.
- Ran lean, per Will (*"BRO ITS ONE WIRE IT SHOULDNT TAKE 45 MINS"*): no release cut by hand, no
  living-docs pass, no version bump, and **two** broken engines rather than four. **25 minutes against
  WIRE 1's 45.** What was kept is what earned its time — the red demonstrations, and asserting the team
  corpus identical before, between and after both differential arms.

---

## [3.61.1] — 2026-08-07

### Fixed
- **ROADMAP #81 WIRE 1 — A PROTECT BLOCK WAS RESOLVED AS A TYPE IMMUNITY AND AS A MISS, AND THE CRASH
  IT OWES WAS NEVER PAID.** Showdown's hit steps (`sim/battle-actions.ts:553-576`) run TryHit — where
  Protect lives — as step 1, the type chart as step 2 and **accuracy as step 4**. `medicham2` rolled
  accuracy first and checked the type chart before the shield, so a shielded body emitted `|-miss|`
  or a bare `|-immune|` where the authority emits `|-activate|X|move: Protect`. One root, three sites.
- **The crash is an `onMoveFail`, not an `onMiss`.** `crashOnMiss` was consumed at exactly one site —
  the accuracy roll — and Showdown fires it from `singleEvent('MoveFail', …)`, which runs on ANY falsy
  move result. Measured in the authority with both dice pinned: High Jump Kick into a Protect prints
  `|-activate|` then `|-damage|…|[from] highjumpkick`; into a Ghost it prints `|-immune|` then the
  same crash. `medicham2` charged nothing in either. **High Jump Kick is on 146 sets, Supercell Slam
  88**, and Axe Kick carries the same tag — a 130 BP move with no downside against the most-clicked
  move in the format. The `[from]` field said `Recoil` and now says the move's own id, as upstream does.
- **A Spiky Shield now tolls a contact move its holder is immune to**, because the shield answers
  before the type chart: `|-activate|` plus 1/8 of the attacker, verified against a real Champions
  battle log on Body Slam into Gengar and on Supercell Slam into Garchomp.

### Changed
- **Mechanics census 240/241 → 243/244 live**, `unarmed` 0, `directCall` 0, `hollow` 0. Red
  demonstrations **128 → 132, 0 failed** — four new, each red on a *different* deliberately broken
  engine, because a single "delete the wire" revert would only prove the wire exists.
- **Whole-game differential: the rate and the median BOTH UNCHANGED at 394/395 and one completed
  turn.** Measured as a controlled experiment — the same 395 games against the frozen releases
  `0771dc47b5f6` and `41e28311e591`, whose manifests differ in `engine/medicham2-browser.js` and in
  nothing else. What moved is the target cause: **`-activate protect <> -miss` / `<> -immune` as a
  first divergence, 6 games → 0**; classes 14 → 13; `-miss field 3` 1 → 0; the crash's
  `[from] recoil` cause gone from `-damage field 4`; `ordering` 43 → 40; `extra event` 37 → 32.

### Notes
- **THE RATE DID NOT MOVE, THE MEDIAN DID NOT MOVE, AND TWO CLASSES GOT BIGGER — that is the correct
  shape of the result.** A game stops at its FIRST divergence, so removing a first-turn cause makes
  the game run on and part deeper rather than agree; `unrelated event mismatch` 116 → 125 and
  `event missing` 128 → 129 are those games reappearing further in. The only aggregate that can show
  the gain is DEPTH: **19,906 → 21,214 normalised protocol lines compared** for the same 395 games
  (+6.6%), 173 distinct moves connected against 171, 104 of 109 census mechanics reached by a
  connecting move against 103.
- **A FIRST VERSION OF THESE NUMBERS WAS WRONG IN THE FLATTERING DIRECTION AND IS RETRACTED HERE
  RATHER THAN QUIETLY FIXED.** It read `395/395 → 394/395`. That game was not the wire:
  `engine/diff_swarm.js` draws its teams from the LIVE store, `data/games.ladder.jsonl` and
  `data/games.bo3.jsonl` were both appended to between the two arms, and a different corpus is a
  different 395 games. Re-run back to back with the store's size and mtime asserted identical before,
  between and after, both arms read 394/395.
- **ROADMAP #81's stated first consequence is corrected rather than worked around.** The spec asked
  for an assertion that the protection counter increments on a block and not on an immunity. It does
  not: Showdown's counter is the `stall` volatile added by Protect's own `onHit`, i.e. by consecutive
  USE, and a Protect that blocked nothing still carries `stall {counter: 3}`. The state difference
  that IS real — the contact toll — is what the probe asserts, on HP rather than on a protocol line.
- **THE DIFFERENTIAL'S INPUT CORPUS IS NOT IN THE PHOTOGRAPH, and that is a hole in the release rule
  rather than a mistake by anyone.** Twenty-three files are frozen and the team store is not one of
  them, so `loadTeams()` reads whatever the ingest has appended. Until it is fixed, any before/after
  on this instrument must assert the store unchanged across both arms. Filed for whoever owns
  `engine_release.js`'s `SOURCES`.
- **Filed, not fixed (WIRE 2+):** (1) the stall counter never resets — Showdown deletes the volatile
  the moment the 1/X roll fails and also fails Protect outright when its user moves last, neither of
  which `medicham2` models; the largest single family of causes left in the table;
  (2) the punishing shields' own emits are one field off (`[from] move: spikyshield` against
  `[from] Spiky Shield`, and `|-singleturn|X|Protect` against `|-singleturn|X|move: Protect`);
  (3) `data/interaction-matrix.json` is stale against `data/tags.json`, which moved after it was
  published, so the shrink guard correctly refuses a re-publish — a re-run at `--full` on this engine
  reads 1,557 / 1,574 and loses exactly the two "crash damage on a blocked move" rows.

## [3.61.0] — 2026-08-06

### Added
- **MEGA EVOLUTION IS A CHOICE, NOT A BUILD-TIME FACT (ROADMAP #31).** `buildMon` on a stone-holder
  returned the mega forme already evolved, so a stone parted the two engines on line one of every game
  carrying one and the differential had been stripping **460 stone sets** — ~26% of this format's usage,
  untested. Evolution is now an action the engine is told to take mid-turn. Will chose this over
  covering megas in a separate staged suite, on the grounds that the same change is what #31 needs
  anyway: a search cannot choose *whether* to mega against an engine that has already done it.
- **Mega bodies are in the differential.** `mega_stones_stripped` **460 → 0**, 372 stone sets kept, and
  the driver plays every pair **twice** — with the stone and without — so the arms are paired rather
  than compared across runs.

### Changed
- **Census 234/235 → 240/241 live**, red demonstrations **122 → 128** with 0 failed, protocol events
  36 → 38 (`-mega`, `detailschange`), differential sets unbuildable **117 sets / 3 teams → 0 / 0**,
  divergence classes 19 → 11.
- **THE RATE IS SATURATED AND THE ARTIFACT REFUSES TO PRETEND OTHERWISE.** Every measured game diverges
  in both arms, so the rate cannot answer *"what did megas cost"*. The **paired** comparison answers it:
  the mega arm parted LATER on 96 games, EARLIER on 15, at the same line on 28, and **zero games have a
  `|-mega|` line as their first divergence.** The mega implementation is not a source of divergence — it
  pushed the horizon out.
- **The evolution floor is on the CHOICE, not on the stone.** **181 evolutions in MEDICHAM, 181 in
  Showdown, from 181 offered choices — 100%.** Not 181/255 sides-that-brought-a-stone: a game stops at
  its first divergence, so a benched stone-holder is never offered. `tests/test-protocol-trace.js` PART 2
  carries the other floor on games that run to the end — **8/8 capable sides, 4 left slot / 4 right**.
  That right-slot half is not decoration: the historical defect was a base class that could only evolve
  from the left, which passed "at least one happened" while firing on 56% of sides against a correct 85%.
- **A new caveat now travels with every rate this instrument prints**, beside the turn-1 horizon: both
  sides are built Serious / 0 EVs / 31 IVs so the two engines compute the same stat line before *and*
  after a forme change. **It tests RULES, not the spreads the ladder brings.**

### Fixed
- **`buildMon` returned a chimera** — base stats carrying the mega's ability (`gengar` → `shadowtag`).
- **Knock Off's ×1.5 kept the half.** Showdown's `chainModify` truncates 65 × 1.5 to **97**; we used
  97.5 and dealt 103 where the real game deals 105. **3,341 uses.**
- **Re-setting the standing weather is a no-op, not a refresh** — announced every time, constant after
  every mega weather setter.
- **The protocol identifier followed the FORME**, so a pivot parted every later line. Already live for
  Palafin.
- **`id()` stripped hyphens**, dropping **117 sets from every differential run** and hiding a 35-game
  naming class.
- **Zero to Hero is silent** — Showdown transforms on switch-OUT and announces on the way in; we did
  neither. Emitter now exists.
- **`engine/status.js` had been silently skipping `docs/ENGINE.md`.** Its GENERATED-block regex required
  `-->
` and `core.autocrlf` is `true`, so the ledger printed `skip` while its block stayed frozen at an
  older run. Now newline-agnostic and rewritten in whatever ending the file arrived in.
- Two conformance findings, both from this session's own new files: the mega census hardcoded the format
  id (S12 — it lives in `champions_sim.js` and nowhere else), and `diff_swarm.js` lost its opening block
  comment when a `RAW-STORE-OK` note was prepended above it rather than folded into it.

### Notes
- **THE ROUTER BROKE ITS OWN INVARIANT TWICE, AND THE SECOND TIME DESTROYED WORK.** See
  `docs/LESSONS.md` #11. Three new files were written into a tree an ENGINE agent was holding, turning
  two of its gates red and costing it part of a report defending work that was clean when it started.
  Then, fixing a mangled edit, `git checkout -- tests/test-effective-identity.js` **discarded that
  agent's uncommitted rewrite** of the file — section 2b, which it had corrected to assert the mega
  contract at *both* moments, plus two `DECLARED` entries. The file reverted to asserting the chimera
  and failed 49 megas: **the test was wrong and the engine was right**, which is the direction that gets
  "fixed" by editing the engine if nobody notices. The agent restored it verbatim and the assertion
  counts came back identical — 62/62, 62/62, 61/61 — which is what proves a restoration faithful rather
  than merely green.
- **The rule that earned:** `git checkout -- <path>` is a DELETE of whatever is uncommitted under it,
  with no reflog, reached through a command that reads like a revert. **A file has one holder, and that
  includes the router** — the same session had spent the evening enforcing one-writer-per-file on
  subagents while exempting itself. And **ask the author to restore; do not reconstruct** — a
  reconstruction by whoever destroyed it is a guess at someone else's design, and it would have passed.
- `engine/mega_decision_census.js` + `data/mega-decision.json` + `docs/MEGA-FEATURES-SPEC.md`: whether
  "when do I mega" is an observed, timed, varying decision, written because Will asked what adding mega
  to MAG's weights would look like. It is: **59.53% of clean megas are held past turn 1**, which is what
  kills the current "the lead keeps it" default. His constraint reorganised the design — *"it needs to be
  a separate score than the move selection or switching because you can mega and act at the same turn"* —
  so mega is modelled as a **board transformation**, scoring the same moves twice on two boards, rather
  than as a row in a softmax that assumes you pick one thing.
- **Three corrections the census forced on claims made in conversation before it was run:** weather-setting
  is **4 of 98** mega formes and not a family; conditional speed abilities are **one** (Swampert, Swift
  Swim); and **Charizard-Mega-Y gains ZERO base Speed** while being the most-used mega in the format — the
  biggest counter-example to *"if mega I outspeed"* sits at the top of the usage table.
- **MAG's weights are invalidated by this release.** `switchSurvives1`, `switchKOSlow` and
  `switchDiesFirst` changed digest, because a stone-holder's static build changed. That is #31 and nothing
  else — the tree was clean when the work started. The refit is MEASURE's and remains gated behind
  MEDICHAM being finished, per Will's standing call.

---

## [3.60.1] — 2026-08-06

### Fixed
- **THE AUTO-COMMIT IS DEAD AND `CLAUDE.md` DESCRIBED IT IN THE PRESENT TENSE FOR TWELVE DAYS.**
  Will: *"WHY DO WE STILL HAVE AN AUTO COMMIT"* — we do not. It was real: **513 `auto: <date>` commits
  between 2026-07-22 and 2026-07-25, the last at 16:51 on the 25th.** Nothing has fired since. Measured:
  no scheduled task matches commit/push/git, `.git/hooks` holds only `.sample` files, and the working
  tree sat modified for over an hour on 2026-08-06 without an unattended commit — a natural experiment
  a ~2-minute timer could not have survived. CHANGELOG 2.8.1 was right that `push-all.bat` was not the
  source; it writes `manual push …`.
- **A pre-commit hook on the living-docs rule, whose stated blocker no longer existed.** `CLAUDE.md`
  said *"No pre-commit hook enforces this, deliberately… a blocking hook would collide with the
  auto-commit timer."* `.githooks/pre-commit` now runs the docs-currency and roadmap-register gates
  (~2s) on any commit touching `docs/`, `engine/`, `tests/`, `web/` or top-level markdown. It skips
  mid-rebase — this repository has reached a detached HEAD 43 commits into a 45-commit rebase, and a
  hook that blocks a replay turns a recoverable rebase into a wedged one — and skips data-only
  commits, because demanding a version bump for an artifact regeneration trains everyone to pass
  `--no-verify`.

### Notes
- **THE HOOK WAS SHOWN RED BEFORE IT WAS TRUSTED**, per the arming rule that governs every probe here.
  A deliberate break — bump the CHANGELOG, leave the nine version-headed documents behind — was
  BLOCKED, and `HEAD` was verified unmoved. The skip path was proved separately: a data-only commit
  landed without the gate running. A hook that has never been demonstrated failing is the same thing
  as no hook.
- **THE COST OF THE STALE RULE WAS NOT ZERO, WHICH IS THE POINT.** On 2026-08-06 a session committed
  early *specifically* to avoid a partial auto-push — a real decision taken against a hazard twelve
  days dead. And the rule the missing hook was protecting broke the same evening: commit `f60b01c`
  stamped `3.60.0` in its message with no CHANGELOG entry, written by the session that had just quoted
  the rule, and caught only because a test happened to run afterwards.
- **The hook does not replace the sentence.** The original failure was NORMALISATION — a red gate
  reported as *"one of the two known failures"* for two days — and no hook catches a report. *Say the
  test is red and what you are doing about it, or fix it. Never file it.* Same shape as the fourteen
  stale handoffs and the hand-maintained ban list of four: an observation written as prose and kept
  past the thing it described.

---

## [3.60.0] — 2026-08-06

### Added
- **THE WHOLE-GAME DIFFERENTIAL RUNS (ROADMAP #68).** `engine/game_differential.js` plays a real
  stored team through MEDICHAM and through the official Showdown engine, step for step, and reports
  where the two part. 160 games, 14 turns, 1.5s, 0 throws, stamped `engine_release 9491abe09f54` +
  `showdown 20ad99ffc9a5` so it reads a photograph rather than a live tree. The instrument is
  **armed**: `planted_divergence_proof_ok = true`, and a plant is now asserted CAUGHT *and* EARLIER
  THAN CLEAN *and* AT EXACTLY THE PLANTED LINE, because an earlier version of that proof passed for
  the wrong reason.
- **A semantic normaliser, with every equivalence proved in both directions.** Seven rules collapse
  4,627 lines of protocol-shape difference — the `|move|` target field, effect namespacing, display
  flags, the `|-ability|` announcement, `[of]` source tags, switch causes, stat attribution. Each
  carries an `equal` pair that MUST collapse and a `distinct` pair that must NOT, and
  `tests/test-game-differential.js` fails on either. **An equivalence with no red demonstration is a
  silencer, not a normaliser.** The unifying argument: every rule drops an announcement or an
  attribution, never a state change.

### Fixed
- **The provenance ratchet, which three artifacts written the same evening had BROKEN.**
  `diff-swarm.json`, `rerun-list.json` and `store-validation.json` recorded no digest of what they
  read, so they rested on mtime alone — and the ratchet may shrink and may never grow. All three now
  stamp `source_digests` by CONTENT. `rerun_list.js`, whose entire job is to say which artifacts are
  stale, resting on mtime alone would have been the joke telling itself.
- **`diff_swarm.js` read the raw ladder store undeclared**; now `RAW-STORE-OK` with its reason. The
  teams there are TEST CONFIGURATIONS, not evidence about play: every quality filter we have selects
  on WHO PLAYED, which would narrow the pool toward one ladder segment and remove precisely the tail
  a swarm exists to reach.
- **#71, #78, #79 and #80 were unregistered in `docs/ROADMAP.md` §5**, so the register gate failed on
  any ledger citing them.

### Changed
- **The normalised divergence rate is 159/160, and it barely moved from run one's 160/160.** That is
  the honest finding and it is the opposite of the comfortable one: **the protocol-shape noise was
  HIDING real classes, not inflating a small number.** Two limits travel with the rate and must not be
  separated from it — the median game still parts after **one completed turn**, so nothing past turn 1
  is tested; and **zero mega bodies were tested**, 460 stone sets stripped, ~26% of format usage, now
  a top-level `rate_excludes` field rather than a line buried in `declared_gaps`.
- **Ten confirmed WIREs, ranked by usage.** Protect success disagrees (80,328 uses). Trick Room emits
  no `|move|` line at all, because `playerAction` returns `kind:'trickroom'` and never reaches the
  emitter — 8,077 uses, and **the same shape for every non-attack kind**. Intimidate ordering between
  two Intimidate bodies. Turn order, 9 distinct causes. Damage off by one under a **pinned MAXIMUM
  roll**, one case `H/H` vs `0 fnt` — one engine kills and the other does not. Intimidate blockers
  announce nothing. Mirror Armor does not reflect; we unboost our own side. Illusion announces the
  real body.

### Notes
- **THE FIRST THING THIS INSTRUMENT CAUGHT WAS A CLAIM MADE IN THIS REPOSITORY HOURS EARLIER.**
  ROADMAP #80 was filed on 2026-08-06 asserting that because MEDICHAM strips the item before damage,
  *"Colbur Berry can never fire for us — we deal full super-effective damage where Showdown deals
  half, a KO/no-KO difference on 11.19% of games."* Staged arms under a pinned MAX roll: no item
  204/204, Leftovers 300/302, **Colbur Berry 150/151**. The boost half reads 1.471/1.480 and the
  reduction half 0.500/0.500, asserted separately precisely so cancellation could not hide a fault.
  **Colbur fires for us** — `playerAction` computes the damage RANGE at click time, before the item
  is stripped, so the emit ordering costs no damage. Showdown's `moves.ts:9962` was read correctly and
  MEDICHAM's consequence was then INFERRED from the order of its output lines instead of measured.
  **A diagnosis from one side of a differential is a guess.**
- **A narrower real bug survives, and it is the more interesting one.** Showdown records `[eat]` — the
  berry ate ITSELF and `takeItem()` found nothing — where we record `[from] move: knockoff`. Same HP,
  different FACT, and *"was it eaten"* is what Harvest, Recycle, Belch, Cud Chew and Unburden read.
  Invisible to a one-turn comparison, which is exactly the horizon this instrument currently has.
- **`docs/ROADMAP.md` §5.6b is retracted.** It answered *"are there too many variables"* using
  collinearity correlations and weight magnitudes from a fit stamped `2026-08-05T04:00:43Z` — twelve
  hours before `3be3f3b` rewrote `movesFirst` in `board.js`, and nine engine commits before WIRES
  123–132. The SHAPE of the finding stands; every magnitude is withdrawn pending the refit.

---

## [3.59.0] — 2026-08-06

### Changed
- **THE HEADLINE METRIC IS EXPLOITABILITY, NOT WIN RATE (ADR-003, accepted).** The field has been
  treating VGC as a chess problem or a pure-RL problem. It is a poker problem, and the missing
  measurement now exists. VGC-Bench (Angliss, Cui, Hu, Rahman, Stone — AAMAS 2026,
  [arXiv 2506.10326](https://arxiv.org/abs/2506.10326)) trained behaviour cloning on 700,000+ human
  logs and fine-tuned with PPO under self-play, fictitious play and double oracle; their agent beat a
  World Championships competitor in a single-team mirror, and they measured **all their agents at
  approximately 100% exploitable**. Their expert tester's own words: *"after enough successive games,
  strong human players can adapt and beat the agent."* Against their *advanced* tester the agent won
  2 of 5.

  That is not a weakness of their execution — it is the predicted behaviour of a **compiled policy**
  in an imperfect-information game. `docs/POKER-TO-POKEMON.md` argued from theory that the solution
  concept here must be a mixed equilibrium rather than a single best move; it had no measurement of
  what happens to a project that assumes otherwise. It has one now, so ADR-003 **promotes** that
  paper from one track among several to the project's central claim.

  Consequences, all published in this pass: **WOBBUFFET moves from side-check to primary
  instrument**; SLOWKING stops being "the preview solver" and becomes the shape of the whole agent;
  the published comparator is VGC-Bench's ~100%.

  **The thesis is that a re-solving agent should be harder to exploit than a compiled one** — a
  learned policy *recalls*, a search *recomputes*, and a best-response exploiter attacks a fixed
  mapping that a per-turn re-solve does not present. **Whether this survives simultaneity,
  stochasticity and a ~6-turn horizon is UNKNOWN. That is the experiment, not the assumption.**

- **THE 117x SIMULATOR SLOWDOWN IS CORRECTED TO 24.9x, AND THE OLD FIGURE IS KEPT.** ADR-001 recorded
  **29 vs 3,401 battles/sec/core — 117x** and decided the architecture on it. Re-measured on this
  machine, same four teams (derived from the store, not typed), 8-second runs, 60-turn cap:

  ```
                   turns/sec    battles/sec
  MEDICHAM           13,041         217
  champions_sim         523          28
  ratio               24.9x         7.7x
  ```

  **`turns/sec` is the comparable unit and `battles/sec` is not**: the two engines were driven
  differently — MEDICHAM to its 60-turn cap, Showdown with `choose('default')` to a natural end — so
  a "battle" is not the same amount of work on the two sides. The honest statement is **24.9x**.

  ROADMAP #61 had already measured MEDICHAM at **1,606** battles/sec against the 3,401 on record, so
  the earlier ratio had been drifting for some time in one direction, and the correction runs the
  other way once the unit is fixed. **The architectural decision in ADR-001 was justified with a
  number that does not reproduce.** ADR-001's reasoning is left standing and is annotated in place;
  ADR-002 and `docs/MODELS.md` carry the same annotation. The decision ADR-001 reached is not
  disturbed by this — a 24.9x gap still rules out live browser simulation — but the number that
  carried it has to be stated correctly wherever it is quoted.

- **MEDICHAM's justification is now explicit and falsifiable.** VGC-Bench used real Showdown via
  poke-env and carried **no engine-correctness debt at all**, because behaviour cloning and PPO do
  not need a fast simulator. We wrote one so that per-turn re-solving is affordable. Therefore: *the
  engine work is justified if and only if search pays.* **ROADMAP #62 stops being a MILTANK question
  and becomes the project's gate**, and §5 of the roadmap is reordered around that.

  Supporting evidence that this is a real trade rather than a rationalisation — every project that
  searches hits the engine-speed wall, and the pattern is clean:

  | project | searches? | engine | depth reached |
  |---|---|---|---|
  | VGC-Bench | no | real Showdown | n/a |
  | Future Sight AI | yes | modified Showdown | ~3 turns in 15 s on 16 cores |
  | Foul Play | yes | built poke-engine | ~10+ turns |

- **The plan is four phases, and branch 4 is a result rather than a defeat.**

  ```
  1  finish MEDICHAM        search needs an engine that is fast AND correct
  2  GATE #62               does compute buy anything: untimed vs on-the-clock
  3  if yes -> search, and measure EXPLOITABILITY against their ~100%
  4  if no  -> adopt their recipe: BC + PPO self-play/FP/DO, open source, reproducible
  ```

  Will, 2026-08-06, approving branch 4 explicitly: *"IM OKAY TRYING THINGS OUT LIKE SEARCH TO SEE IF
  OUR ATTEMPT WORKS BUT IF THAT FAILS IM OKAY ALSO TRYING THEIR OTHER METHODS."*

  **On compute:** cores help SEARCH (CPU-bound, root-parallelisable); GPUs help BC/PPO. MILTANK needs
  26 s against a 20 s budget on **one core of sixteen**, so 16 cores fixes the clock today — but root
  parallelisation scales **sublinearly**, so it converts a failed budget into a met one rather than a
  shallow search into a deep one. Buying cores does not buy depth.

### Fixed
- **`docs/GAME-DIFFERENTIAL-DESIGN.md` §3.2's usage table was a stale snapshot of `data/tags.json`,
  and only two of its fifteen figures were catchable.** `tests/test-docs-current.js` §3b(c) flagged
  Trick Room at 7,423 and Wide Guard at 3,353 because those two values appear in no artifact; the
  other thirteen passed by **coincidence** — 74,245 and 13,292 and 424 and 76 all happen to occur in
  unrelated artifacts. The whole column is re-derived from the current `data/tags.json`
  (`sheet_entries` 119,616, generated 2026-08-06): Protect 80,328, Fake Out 14,380, Trick Room
  **8,077**, Prankster 8,061, Sucker Punch 7,704, Wide Guard **3,568**, Phantom Force 465, Feint 437,
  Illusion 242, Trace 221, Ally Switch 190, Quash 175, Instruct 173, Disguise 133, Upper Hand 80.
  The argument is unchanged — Upper Hand is three orders of magnitude rarer than Protect — and the
  document's final column now says plainly that its conversion factor from declared uses to expected
  exercises per 1,000 games **is not recorded anywhere**, rather than carrying an estimate nobody can
  reproduce.

### Notes
- **Nothing in this release is a new measurement.** The speed benchmark, the VGC-Bench holdings and
  the exploitability comparator were all measured before this pass; this is the living-docs rule
  applied to a strategic reframe, so that the same reframe lands in the white paper, the deck, the
  technical documentation, the summary, the model ledger, the two ADRs, the roadmap and the MEASURE
  ledger in one pass instead of four.
- **The VGC-Bench dataset is not usable and the code already knew.** Their Reg M-B holding is 4,167
  games over 4 days in June 2026 and **100% of it is already in our store** as `data/games.ots.jsonl`,
  against our own 9,701 bo3 games over 15 days. The 700,000 headline is Reg M-A, the previous
  regulation. `fit_policy.js`'s comment was exactly right. An earlier claim in this session that their
  archive covered our format was **wrong and is retracted**: it inferred coverage from a FILENAME
  (`logs_gen9championsvgc2026regmb.json`) instead of opening the file. `docs/PRIOR-ART.md` §2 carries
  the correction, and it must not be re-introduced anywhere.
- **VGC-Bench is OPEN TEAM SHEETS** — the same information setting as our Reg M-B bo3. They had
  *more* information than a closed-sheet agent and were still ~100% exploitable, which strengthens
  the poker frame: the exploitability comes from having a fixed policy, not from hidden teams.
- **Comparison does not require playing them.** Their checkpoints are Reg M-A and ours is Reg M-B,
  and their own paper shows policies do not transfer across team sets. But **exploitability is
  intrinsic** — measured against a best response trained against *you*, in *your* format — so the
  numbers compare although the agents can never meet.
- **We are not claiming we will beat them.** Their agent beat a Worlds competitor; ours has never
  played a human. Nor that search is known to work here: Metamon (RLC 2025,
  [arXiv 2504.04395](https://arxiv.org/abs/2504.04395)) reached top 10% in singles with **no search
  at all**, and Future Sight AI removed its machine learning entirely after finding a structural
  method beat it on both accuracy and speed. Both are live counter-evidence and both are in
  `docs/PRIOR-ART.md`.
- **ABRA has no exploitability number today.** `data/exploitability.json` is declared VOID and
  `provenance.js --strict` exits non-zero on it. Making the headline metric one this project cannot
  currently produce is deliberate: it converts a nice-to-have into a first-class deliverable and
  states the gap instead of hiding it.
- **The figures introduced by this entry, in one place**, so that every document quoting them has a
  trace: 13,041 and 217 (MEDICHAM turns/sec and battles/sec), 523 and 28 (champions_sim), the 24.9x
  and 7.7x ratios, the 8-second run and 60-turn cap, the prior 29 / 3,401 / 117 pair from ADR-001,
  1,606 from ROADMAP #61, VGC-Bench's 700,000 logs and 4,167 Reg M-B games over 4 days, our 9,701 bo3
  games over 15 days, `10^139` team configurations, Future Sight AI's ~3 turns in 15 s on 16 cores,
  Foul Play's ~10+ turns, and MILTANK's 26 s against a 20 s budget on 1 of 16 cores.

---

## [3.58.0] — 2026-08-06

### Added
- **MEDICHAM emits a Showdown-shaped protocol trace (ROADMAP #68, step one).**
  `docs/GAME-DIFFERENTIAL-DESIGN.md` §5 compares two engines by diffing their EVENT STREAMS rather
  than their end-of-turn state, because Showdown's protocol log is already a step-level trace
  *labelled with the mechanism that made each decision* — a missing `|-unboost|` is Intimidate, an
  out-of-order `|move|` pair is turn order, an absent `|-enditem|` is the Sash. Showdown emits one.
  **MEDICHAM emitted nothing, so there was nothing to diff.**

  Opt-in: `battleInit(A, B, {trace: []})`. Off by default — every emit site is `if(TR)` against a
  module-level `let` that is null unless a caller asked, and the sink is re-bound at the top of every
  `battleTurn` and released on the way out so a nested rollout cannot inherit one.

  **36 event types emitted**, in Showdown's own grammar: `turn move cant switch drag faint -damage
  -heal -status -curestatus -boost -unboost -clearallboost -clearnegativeboost -ability -item
  -enditem -weather -fieldstart -fieldend -fieldactivate -sidestart -sideend -start -end -activate
  -singleturn -fail -miss -crit -supereffective -resisted -immune -prepare -mustrecharge upkeep`.

- **`engine/derive_protocol_events.js` and `data/protocol-events.json`.** The event list is DERIVED
  from Showdown's own `add()` call sites, never typed — and the scan covers `data/mods/champions/`
  as well as `sim/`, because **this format overrides the emit**: `sim/battle-actions.ts:1800` writes
  `add('-supereffective', target)` and `data/mods/champions/scripts.ts:271` writes
  `add('-supereffective', target, Math.min(typeMod, 2))`. A trace built from the generic protocol
  would have had the wrong shape on every super-effective hit in this format. **91 events found; 36
  emitted, 58 declared with a written reason, 10 partial shapes with a written reason.** Two gates:
  an INVENTED event (claimed here, never emitted by Showdown) and an UNDECLARED one (Showdown emits
  it and this engine neither emits it nor says why) both fail the run.

- **`tests/test-protocol-trace.js`**, seven parts. Part 1 plays 16 real games and FAILS if any of the
  36 claimed events never fires. Part 2 is the rate floors — every game emits `|move|`, a game that
  ended with a hurt body emits `|-damage|`, an Intimidate lead emits `|-ability|` then exactly two
  `|-unboost|` *in that order*. Part 3 is the off-by-default control: the same game with and without
  a trace must end in an identical state. Part 5 is the acceptance test below.

### Notes — the acceptance test, and why the obvious version of it is wrong
`docs/GAME-DIFFERENTIAL-DESIGN.md` §6: Showdown ignores the attacker's NEGATIVE offensive stages on a
crit (`sim/battle-actions.ts:1683-1691`) and MEDICHAM's declared limitation says it does not. Staged
as an Intimidated Meowscarada throwing Flower Trick (a guaranteed crit) into an Incineroar:

```
showdown   Intimidate 112/170   control 112/170     <- the crit ignored the -1
medicham2  Intimidate 130/170   control 111/170     <- it did not
  the two streams agree on all 15 lines before the divergence
  the FIRST differing line is the |-damage| itself
```

**The control is the same scenario with Intimidate swapped for Blaze, and each engine is compared
against ITSELF across it.** Asserting "the two engines' numbers match" would be false for a reason
that has nothing to do with crits: MEDICHAM's damage range for that hit is **11 integers sampled
uniformly** and Showdown rolls **16** indices onto the same span with unequal multiplicities, so a
"median" roll is not the same die on the two sides.

### Notes — two things the instrument found on its first night, neither of them a census row
1. **The intermediate damage rolls are a different distribution, and no instrument we own looks at
   them.** `tests/test-engine-diff.js` compares `roll=0` and `roll=15` against MEDICHAM's `min` and
   `max` — endpoint to endpoint, by construction. The fourteen rolls between are a linear
   interpolation over an 11-wide integer range where Showdown floors sixteen base values separately.
   149/150 endpoint agreement is compatible with every middle roll being off by one or two.
2. **The order within a hit is not Showdown's.** MEDICHAM resolves the knock-off, the resist berry
   and the contact punish *before* subtracting the target's HP. End-of-turn state is identical, which
   is exactly why `tests/test-game-diff.js` agrees on all five scripted games and this trace does not.

Both are FILED in `docs/ENGINE.md`, not fixed: changing how a damage roll is drawn moves every seeded
run in the repository.

### Changed
- `tests/probe_red_demo.js`: five demonstrations re-anchored, because it reverts the engine by exact
  source text and instrumenting a line breaks its anchor — loudly. **Only the SHIPPED half moved in
  every case; each known-bad half is byte-identical**, so every demonstration still shows the defect
  it was written for. 122 demonstrations, 0 failed.

### Fixed
- `data/protocol-events.json` ships with `source_digests` and the pinned Showdown commit, so it does
  not join `engine/provenance.js`'s mtime-only list.

### Notes — nothing about the simulator's behaviour changed
Census **234 live / 235 probed**, unchanged and re-measured against `data/tags.json` both before and
after `5da0b0d` regenerated it mid-session. `unarmed` 0, `directCall` 0, `hollow` 0, `threw` 0.
Differential **1/150**. `test-game-diff.js --all` agrees on all five scripted games and 0 of 40
generated pairs part. `test-engine-consistency.js` all passed.

## [3.57.1] — 2026-08-06

### Fixed
- **`data/tags.json` is unfrozen — a CATALOGUE must not inherit a FIT's narrowing (ROADMAP #65).**
  `engine/tag_dex.js` called `fit_policy.loadCorpus()` and silently inherited a decision made for the
  *fit*. Under the bo3-only narrowing its `sheet_entries` fell **110,760 → 78,480**, and a
  regeneration would have deleted **Serene Grace, Tinted Lens, Curious Medicine, Steely Spirit and
  Leppa Berry** from the engine's knowledge — invisibly, because a missing entry looks identical to a
  mechanic that does not exist.

  The general rule, which is the part worth keeping: **a training sample deliberately narrows to the
  distribution you want to learn; a catalogue must not, because narrowing DELETES entries rather than
  reweighting them.**

  `loadCorpus(opts)` now takes an **optional** `scope`, reports which scope and which files it
  actually read, and throws on an unknown one. The default is unchanged, so all **46 call sites across
  34 files** behave exactly as before and no measurement moved. `tag_dex` asks for `scope: 'all'` out
  loud.

### Notes — the regeneration, and a claim about it withdrawn the same evening
Regenerated and **diffed** rather than trusted: **0 entries lost, 1 added (`ability|victoryStar`).**
The zero is the result that matters and it is what #65 was about.

**The addition was oversold and the correction is the entry.** It was first described as "a fifth
accuracy modifier joining the WIRE 129 family, which the narrowed corpus had been hiding". Will:
*"ive never heard of victory star"*, then *"i understand wanting to future proof this engine, but
cmon man"* — both fair. **Victory Star's only carrier is Victini, which is `isNonstandard: 'Past'` in
this format.** Nothing legal can have it, so the entry is inert, and calling it a *gain* implied a
relevance it cannot have.

Two things were also wrong in how it was investigated, and they are the more useful half. It did not
enter from usage — it reads `uses: 0`, and `tag_dex` enumerates the DEX, so a wider corpus scope
simply lets more of the dex through rather than discovering anything. And the three "Victini
appearances in the store" that seemed to explain it are a **player's username, `Victini_Emil`** —
a substring match against a person, not a Pokémon, which is the same class of error as the
case-sensitive `Floette` scan earlier in the day.

**What the diff actually established** is the thing worth keeping: the narrowing deletes real entries
and the widening restores them, verified entity by entity. Serene Grace, Tinted Lens, Curious
Medicine, Steely Spirit and Leppa Berry all hold their counts exactly.

### Notes
- **This unblocks the whole tagging queue.** A frozen `tags.json` was the common blocker behind the
  hazard secondaries and hazard removal, the seven-move signature collapse, six untagged mega
  abilities including Trace, `auraBoost`, and the Outrage-family lock-in. Every one is a derivation
  change that only reaches the engine through a regeneration.
- **A decision reversed after looking, recorded because the reversal is the lesson.** The first call
  was to make `scope` REQUIRED so no caller can inherit anything. Then the call sites were counted:
  46 across 34 files, each a judgement about what that consumer wants, every one silently moving a
  measurement if made carelessly. That is a larger risk than the bug. The required-argument pass is
  ROADMAP #73 and gets its own careful treatment — including checking whether `medicham_coverage`,
  `tag_exposure`, `feature_coverage` and `click_census` are mis-scoped the same way, since all four
  DESCRIBE the format rather than learn from it.
- Verified read-only: `test-tag-wire` 104 checks pass and the artifact reaches the damage calculation;
  NaN guard clean; conformance ratchet 0 new; silent-failure ratchet 0 new. **The full suite was not
  run** — it regenerates the census and interaction matrix, which the ENGINE agent has open.

## [3.57.0] — 2026-08-06

### Added — the arming pass finishes: `unarmed` 76 → 0
Every probed mechanic now has a probe that has been shown RED. Coverage **armed, weighted by corpus
usage**: moves **63.4% → 97.4%**, abilities **82.2% → 93.8%**, items **58.9% → 99.9%**. Tags probed and
live with no ARMED probe: **62 → 0**.

```
                      before      after
probed / live        232/231    235/234    same single miss, needsTargetToAttack
armed / unarmed       156/76     235/0
directCall                 0          0    held
red demonstrations   79, 0 fail  122, 0 fail
differential           1/150      1/150    same row
interaction matrix   1624/1643   identical
```

### Fixed
- **WIRE 131 — the VALUATION path was blind while resolution was correct.** WIRE 129 fixed whether a
  move HITS. It did not fix what the bot thinks a move is WORTH. Measured over seven arms of Hydro
  Pump, `bestMoveVs.acc` and `playerAction.acc` read **0.8 against a bare defender, a No Guard
  defender, Bright Powder, +6 evasion, +6 accuracy and a Wide Lens alike**. The only arm that moved was
  a hand-written attacker-only No Guard check — a fifth copy of a rule the accuracy table already owns,
  and **half the ability**, since No Guard works in BOTH directions. Found because Will said so:
  *"no guard also makes it so your opponents cant miss."* All four sites now call `hitProb`.
  **Declared, not faked:** the KO scan and `bestKOsNow` sit inside the unexported `_chooseAction` and
  could not be demonstrated red.
- **WIRE 132 — Mega Floette threatened nothing, on 10.5% of ladder sides.** `data/abra-tags.js` maps
  `Floettite → {Floette-Eternal: Floette-Mega}`; the builder instead concatenated `'-mega'` and reached
  `floette-eternal-mega`, the one row in 318 with **both `ab: null` and `mv: []`**. Membership printed
  before the fix: **74 of 76 into-pairs agree with the concatenation guess, exactly 2 differ.**
  Before → after: ability `''` → `fairyaura`, SpA 175 → 192, `buildMon` from **0 moves to 4**, its
  Dazzling Gleam dealing 160. Found from Will asking what Fairy Aura actually does.

### Added — three instruments, each shown RED on known-bad input before being committed
- **`engine/status.js --selftest`** (6 cases). The board printed `refit edge: CLEAN` for two days over a
  contrast that had measured three feature columns MOVING on 1,136,845 rows. Third verdict added:
  **FIXTURE ONLY**. Red on the pre-fix behaviour at 4 of 6.
- **`engine/rerun_list.js --selftest`** (8 cases), ROADMAP #57. Of **30** artifacts reporting a number
  produced by playing games: **16 UNSTAMPED, 2 VOID, 11 STALE, 1 DECLARED N/A, 0 CURRENT.** Not one is
  quotable against the current engine. UNSTAMPED vs STALE is the distinction that matters — a stale
  number can be re-run and compared, an unstamped one cannot be compared to anything.
- **`engine/validate_store.js --selftest`** (11 cases). Will: *"it shouldnt be this hard, lets just
  filter all the games through showdowns valid team check if we have to."* 46,612 games in **23 s**.

### Removed
- **`engine/format_drift.js`, deleted the same night it was written.** It discriminated on a COUNT: a
  rejected species appearing often meant our dex was stale, rarely meant the game was anomalous. Will
  killed it on sight — *"legal = common is the worst possible logic i could think of."* The confound is
  specific: this format hands out mega evolutions, so a Pokémon with no mega is rare BECAUSE it is
  outclassed, not because it is illegal. A real check — the TeamValidator — existed the whole time.

### Notes — what the validator found, largest first
**The store's `sets` are OBSERVATIONS, not DECLARATIONS, and a team validator only speaks declaration.**
The first run flagged **12.15%** of games and almost none was illegality: mid-battle formes
(Palafin-Hero, Aegislash-Blade, Mimikyu-Busted), post-mega abilities recorded against the base row
(Meowstic/Intimidate, Gardevoir/Pixilate), moves Imposter copied, long nicknames, and **Struggle**,
which nobody declares because it is what zero PP forces. Separated: **1.549%**.

**What remains is a real bug that species-checking would never have found.** `whimsicott` is credited
with **Bitter Malice** in 14 games and **13 of the 14 have a Zoroark on the team**. The signature runs
down the whole list — hatterene/Parting Shot, farigiraf/Round, sylveon/Boomburst, overqwil/Memento —
the popular DISGUISE TARGETS, each credited with a move it cannot learn. **Illusion mis-attributes
every move to the body being imitated**, and `g.sets` carries that into `data/meta-usage.json` (what
CHOMP reads), into XATU's opponent model, and into the sheet channels.

**`engine/illusion.js` already exists, and `engine/durable-ingest.js` requires it ZERO times** (Will:
*"we addressed this before where if a pokemon uses a move not on its learnset, its zoroark"*). It is
wired into `data/board-data.js` and nowhere near ingest — built, correct, and not connected at the
place that decides what gets stored. ROADMAP #67.

**Identified and NOT yet excluded: the custom-rules games.** 19–21 games carry player-typed rules that
unban the format's `Past` class — `+past`, `!obtainable`, and in ten of them `+jirachi` by name.
Showdown keeps the base format id on a custom challenge and the marker is a `|raw|` HTML infobox that
`extract()` has no branch for, so **the fact is destroyed at ingest and the store cannot answer the
question**. The pipeline's only acceptance test is that both sides have at least 4 Pokémon. ~14 survive
into the clean corpus of ~8,100; `data/meta-usage.json` carries `amoonguss` at `teamRate 0.0002`. The
live bot is unaffected — it builds from `data/species-sets.json`, which holds none of them.

**A larger version of the same hole, pointing the other way:** 393 archived logs carry custom-rules
infoboxes and some REMOVED legal species (`-Sneasler, -Garchomp`). Those bias usage DOWNWARD and no
legality check can ever see them, because everything in them is legal.

### Notes — corrections on the record
- **My ordering rationale for the refit was wrong.** I held 3.56.0 so the refit would follow the engine
  fixes; `git show --stat 9ad0d15` contains neither `board.js` nor `fit_policy.js`. Will then superseded
  the question entirely — *"dont we only want refits once medicham is done"* — which is his own standing
  bar. The refit is **correctly blocked**, not overdue.
- **I claimed Mega Floette was the most-used mega. It is third.** Charizard-Mega-Y 9,843 sets,
  Staraptor-Mega 5,600, Floette-Mega 4,981. I compared *sides with it in the six* against *sets*.
  Will: *"no zard should be the most used."*
- **I claimed auraBoost had essentially zero exposure.** My scan was case-sensitive against a store that
  keys `floettemega`. It is 10.5% of sides.
- Two more probes were wrong before the engine was, making **39**: `forbidsStatusMoves` (a status click
  does not always carry a move name — Tailwind emits `{kind:'tail', move:null}`) and the `megaStone`
  valuation probe, which clicked `moves[0]` and got Protect.
- **Ten red demonstrations stayed GREEN under a tag strip** — `inflictsBurn` (24,070 uses),
  `inflictsSleep`, `inflictsParalysis`, `inflictsFreeze`, `readsTargetItem`, `takesTargetItem`,
  `locksTarget`, `setsWeather`, `doublesSideSpeed`, `thawsTarget`. Those census rows name tags **the
  engine never reads**; the mechanics run off `fx.status`, `fx.secondary`, `fx.weather`, `removesItem`
  and a hard-coded `id==='tailwind'`. Every demonstration now targets the fact actually read.
- `tests/test-mc-key.js` went red from WIRE 132 and was **fixed, not re-baselined upward**: 13/2 → 15/0,
  `medicham2-browser.js` lookups 5 → 1, baseline re-stamped **downward** 17 → 16.
- Six silent-catch blocks introduced by tonight's new files were made to speak before commit.

### Fixed — carried from 3.56.1
- **The board printed `refit edge: CLEAN` for two days over a measured three-column change.** Found by
  MEASURE while checking whether the refit was owed, and it outranks the gate counts it was sent to
  fix. `data/feature-engine-contrast.json` had measured `deadNoLastMove`, `movesFirst` and
  `diesBeforeMoving` MOVING on **1,136,845 corpus rows**. `engine/status.js:117` then muzzles the
  contrast whenever medicham2's digest differs from the artifact's — correct, because an artifact
  measured on another tree must not speak. **The defect is what the muzzle returned:** a bare `null`,
  which is also what a contrast that was *never run* returns. Two opposite facts arrived as one value,
  and the caller reported the fixture's answer as the whole answer.

  It is not a gap but the **steady state**: ENGINE lands on medicham2 roughly every half hour and the
  contrast takes far longer than that to re-run, so the second instrument is muzzled essentially
  always. `feature_fixture --check` genuinely passes — it hashes ~50 frozen boards, and its own header
  says a guard only guards what it exercises. 3.49.0 made speed order dynamic; no fixture board stands
  on that branch.

  A muzzled instrument now returns `{muzzled: why}` carrying the reason, and the verdict has a third
  state. **Only the both-spoke case earns the word CLEAN:**

  ```
  refit edge: FIXTURE ONLY — not clean, and not owed either; only one of the two instruments spoke
    feature_fixture --check passes: all 58 columns hash-identical to fit time — but the corpus
    contrast is MUZZLED (it was measured on medicham2 82bed8cdcf6b, live is 50def15ac8f0), so
    nothing checked the branches no fixture board stands on
  ```

### Added
- **`node engine/status.js --selftest`, registered as a GATE in `tests/run-all.js`.** Six cases over
  synthetic artifacts, no filesystem and no dex, so it costs milliseconds. Shown RED on the pre-fix
  behaviour — **4 of 6 fail** — before being committed, per the standing rule.
  `status.js` is a *reporter* and was not otherwise gated, which is precisely how this survived.

  **The first draft of the selftest crashed instead of failing**, reading `r.muzzled` off the pre-fix
  `null`. That is the shape CLAUDE.md already records for two ratchets that crashed rather than failed
  and stayed invisible for it. The predicates are null-safe by construction now.

### Notes
- **A correction to my own ordering, made on the record because it changed the schedule.** 3.56.0 was
  held back on the reasoning that a refit should follow the engine fixes. `git show --stat 9ad0d15`
  contains **neither `engine/board.js` nor `engine/fit_policy.js`** — both last moved at `3be3f3b`
  (3.47.0–3.49.0, 2026-08-05 16:47), whose own commit message already announced the refit as owed. The
  refit is **~28 hours overdue, not newly due**, and waiting for 3.56.0 bought nothing.
- **The refit did not run, and the blocker is architectural rather than scheduling.** `fit_policy.js`
  and `fit_joint.js` contain **zero references to `engine_release.js`**, and `fit_policy.js` is not
  among the 23 frozen `SOURCES` — so the fitter reads the live tree by construction and cannot be run
  from inside a snapshot either. **The one expensive operation on the one expensive edge is the one
  thing that cannot take a photograph.** With ENGINE's arming pass in flight and `medicham2-browser.js`
  uncommitted, a fit started now reproduces the 2026-08-04 void exactly. Held, with the reason named.
- `em_validation` re-ran and is **GREEN** (bias 0.9567 > floor 0.3259, EM recovers 91.4%, 31,940 rows
  over 1,200 games). Reported against itself: medicham2 moved *inside* that run's window, and
  `em_validation.js` does not list medicham2 in its `SOURCES`, so provenance cannot see it. It is owed
  a re-run once ENGINE settles.
- `provenance --strict` **6 UNSAFE → 5** (`strong-player-baseline.json` cleared by re-running it under
  the conformance fixes). The remaining five are named in `docs/MEASURE.md`; three sit on the refit
  path, two do not.

## [3.56.0] — 2026-08-06

### Fixed
- **WIRE 129 — "does this move hit" had four doors and every one of them was dead.** ~5,000 uses.
  Measured into a Garchomp before anything was touched, and the giveaway is that every arm is
  identical:

  | | with | without |
  |---|---|---|
  | Coil | 0 | 0 |
  | Minimize | 258 | 258 |
  | Wide Lens | 0 | 0 |
  | Bright Powder | 116 | 116 |
  | Sand Veil in sand | 115 | 115 |
  | No Guard | 0 | 0 |

  **Three unrelated root causes.** `SD2ENG` mapped `accuracy` and `evasion` to **null**, and all
  eleven boost appliers key off it — so `targetBoostsAlways:{atk:1,def:1,accuracy:1}` landed
  two-thirds of itself. Items and abilities were read **nowhere**. And the loop's roll called
  `moveAccuracy(id, field)`, which **is handed no bodies at all**, so it could not have consulted an
  attacker or a defender even in principle. One authority now — `hitChance(att, def, id, field, ctx)`
  at all four to-hit sites — plus `printedAccuracy` so `true` survives as `true`, the (3+n)/3 stage
  table, and the roll **moved below target resolution** so there is a defender to ask about.
- **WIRE 130 — Substitute was charged for and never built. 1,976 clicks of a move strictly worse
  than passing.** `playerAction` resolves it to `kind:'affect'`, so WIRE 42's `kind==='sub'` branch
  is unreachable **and always was**; the generic `costsUserHP` block took 25% of the user's HP and
  produced nothing. `_sub` read 0 and the body took full damage. Fixed with `grantSubstitute`, a
  free-fail on a second click, and `subBlocks` as **one** answer for the damage path and every status
  path.
  **The comfortable fix would have been the bigger bug, and it was measured first:** Encore (4,848),
  Taunt (1,503) and Disable (730) all carry `bypasssub` and **none is a sound move**, so a
  `sound`-tag rule would have walled all three.
- **`engine/tag_dex.js`'s `writesAccuracy` derivation was inverted on all nine carriers.**
  `onModifyAccuracy` fires on the **target** and was labelled "its own moves", so the artifact records
  Sand Veil as sharpening its own attacks. Derivation fixed; nothing consumes `scope`, so the engine
  was correct either way.

### Added
- **Two conformance gates, so the tables are checked rather than remembered.**
  **ACCURACY-MODIFIER** re-derives all 12 accuracy handlers from the live format and takes direction
  from the hook name — 12 handlers, 13 rows, **0 disagree**, and it caught its own key-casing bug on
  first run. **SUBSTITUTE-BYPASS** re-derives `bypasssub` across all 500 moves: **51 carried, 0
  missing, 0 invented.**
- Eleven new probes, all through `battleInit` + `battleTurn`, all armed, each with a reverted or
  tag-stripped demonstration. **Two of them revert in the direction that still *works*** — so only
  the control arm catches them.

### Notes
```
                        before      after
mechanics live         218/221    231/232
declared missing             3          1
red demonstrations          65         79      0 failed
coverage gate (b) NO PROBE  17          9
directCall                   0          0      held
unarmed                     76         76      all 11 new probes armed
```
**Two of the three declared-missing mechanics are gone** — Sand Veil and No Guard. Differential holds
at 1/150, accuracy conformance 500/500, interaction matrix **byte-for-byte identical**,
`feature_fixture --check` **CLEAN — no refit owed**.

**A probe was wrong before the engine was, and that is thirty-seven.** The first `boostsFromFallen`
probe put Kingambit on the field at `battleInit` — but Supreme Overlord snapshots at **switch-in**,
so it read 97 in every arm and reported the mechanic missing on a **correct** engine.

### Notes — reported honestly rather than faked
Five tags are **absent, not merely unprobed**, and were left in the coverage gate's (b) column rather
than probed red, because (c) ratchets on "every probe MISSING" and a red probe would have failed it:
- **`auraBoost` (5,663 uses — the largest)** needs state `dmgRange` cannot see. The multiplier is
  field-wide over every body; `dmgRange` holds two bodies and a field with no roster. Measured 79
  with Fairy Aura on attacker, ally, foe and nobody. **Wiring it changes a `board.js`-facing input,
  so it is a design call and is routed rather than patched.**
- `instructsTarget` (2,222) is absent **by construction** — needs re-entrant action resolution.
- `passesState` (1,793) — `switchOut` clears `out.boosts` unconditionally.
- `punishesBoostedTarget` (604) needs a per-turn "was boosted" flag **and the confusion volatile,
  which this engine has nowhere.**
- `randomBoostEachTurn` (Moody, 590) is stochastic; a probe must assert the mechanism, not a stat.

### Notes — a consequence of MY OWN corpus change, traced by comparing rather than trusting
**`data/tags.json` cannot be safely regenerated today.** A regeneration was run and **diffed** rather
than accepted: tag membership and every param are **identical** (0 diffs across 500/262/146), but
`sheet_entries` falls **110,760 → 78,480** and **five entities drop out** — including **Serene Grace
and Tinted Lens**. Regenerating would silently delete them from the engine's knowledge. The artifact
was restored byte-identical.

The cause is `engine/fit_policy.js:304`, which I narrowed to `['games.bo3.jsonl']` earlier in this
same session on Will's open-sheet directive, dropping `games.ots.jsonl` — **41.5% of the corpus.**
That was the right call for the *fit*; nobody traced that `tag_dex.js` reads the same `loadCorpus()`
and would lose entities by it. **A corpus decision is not local to the model it was made for.**

## [3.55.0] — 2026-08-06

### Fixed
- **WIRE 128 — the battle loop and the damage calculator had two different answers to three
  questions, and all three probes were GREEN because they only ever asked the half that was right.**
  Measured before a line of engine changed:

  | | `dmgRange` said | a real turn dealt |
  |---|---|---|
  | Scrappy Incineroar, Body Slam → Gengar | **88** | **0** |
  | Mold Breaker Tinkaton, Earthquake → Levitate | **60** | **0** |

  Three gates inside `battleTurn` were each a second implementation of a fact `dmgRange` already
  owned: the type gate was a bare `mcEff(...)` that knew nothing about Scrappy, Mind's Eye or
  Freeze-Dry's `overridesEffectiveness`; the absorb gate read `tg.ability` raw, so a Mold Breaker was
  absorbed by ten `breakable` abilities; and `moveClassBlocked()` read it raw while `dmgRange` carried
  its own private copy that did not.
  **Consequence: every Scrappy Normal-or-Fighting click into a Ghost dealt zero, in every rollout and
  every self-play game this engine has ever run.** One owner each now — `suppressedAbility`,
  `typeEffAgainst`, `absorbedBy` — and all ten `moveClassBlocked` call sites pass the attacker.

### Added
- **`tests/test-medicham-coverage.js` — Will's bar is now a gate rather than a sentence.** It names
  no entity; `tests/regulation_usage.js` derives the 99%-of-usage set at runtime, so a threshold
  cannot go stale when the metagame moves. Red-proven: `--selftest` plants three faults and all three
  are rejected.
  **It reads the UNION of the raw and clean corpora, and the first version was wrong about why** —
  `engine/selftest.js` caught the new file, and measuring showed the raw corpus sees *more* entities
  while demanding a *smaller* prefix (abilities: raw asks 78, clean asks 98). Picking either alone
  would have quietly relaxed the bar.
- **`directCall` is a first-class census field**, computed structurally from each probe's own source,
  printed with offenders named, and **ratcheted downward** — the thing #42 said `unarmed` could never
  be.
- **Two Stadium cabinets, GARY and DUSK**, closing a gate that went red *because* those two models
  were added to the ledger this session.

### Notes — the arming pass is done and the numbers moved a long way
```
                        session start      now
direct-call probes            47             0      every probe spends a real turn or entry
unarmed                      145            76
armed                         74           145
red demonstrations            35            65      0 failed
mechanics live           216/219        218/221
```
**Usage-weighted armed coverage**, over 807 entities with any usage, 495 in the union 99% set:

| | LIVE | ARMED |
|---|---|---|
| moves (288) | 96.7% | **63.1%** — was 9.2% |
| abilities (98) | 93.3% | **81.8%** |
| items (109) | 99.7% | **58.8%** |

**The carve-out is 17 of 17 live and armed** — the things that turn a certainty into a failure, armed
regardless of usage, which was the condition attached to the 99% target.

### Notes — three probes were wrong before the engine was, and that is now thirty-six
Arms 34, 35 and 36: a burn-chip confound, a Thunder fired at a Ground type, and an "ally holds it"
arm that was the same body relabelled. Nine further probes were tightened — `Sacred Sword` had been
accepting what an engine ignoring *all* stat stages would print, and `privateWeather` asserted its
"private" half **in a comment**.

### Notes — corrections to my own instructions, recorded because both were wrong in the same way
- **I told WEB that DUSK's cell counts (1v1 = 16, 2v1 = 96, 2v2 = ~1,296) trace to
  `data/dusk-size-gate.json`. They do not.** I derived them in conversation; they live in
  `docs/ROADMAP.md` §5.4, and `~5,738` is `docs/SEARCH.md`'s. WEB checked each against the JSON,
  found the mismatch, and cited them where they actually live. `grep 1296 data/dusk-size-gate.json`
  returns one hit and it is a coverage percentile.
- **`docs/MODELS.md`'s DUSK entry still says the size question is "NOT MEASURED".** The gate answered
  it at 06:49 the same day. The cabinet quotes the artifact rather than the ledger, which is the
  right precedence and the wrong reason to need it.

### Notes — routed, not fixed
- `docs/MODELS.md`'s MACHAMP entry says *"2 of 6 generations on a 17-FEATURE vector"* and *"the
  vector is now 48"*; `data/ladder.json` records `gensRequested: 8`, 2 generations, **48** features,
  and `data/policy-weights.json` is **58**.
- `docs/MODELS.md`'s MEDICHAM entry quotes 1,634 live / 1,614 agree; the artifact reads
  **1,643 / 1,624**.
- **A concurrent writer was active during the arming pass** and both agents said so unprompted.
  `tests/test-stadium-roster.js` flipped FAIL→PASS between two runs of a suite that was not editing
  it. Nothing overlapped, but **a `run-all` taken while another agent is writing is not a
  photograph** — the same lesson as the frozen release, one level up.

## [3.54.0] — 2026-08-06

### Fixed — three real bugs, every one of them under a probe the census graded LIVE
- **WIRE 124 — 78 moves could not miss.** `moveAccuracy` ended `return ACC[id] || 100` over a
  **hand-typed 35-move literal**. Of the 500 moves in `MC.moves`, **78 sit below 100% accuracy in this
  format and not one was on the list** — Heat Wave at 90% and **7,405 clicks**, Matcha Gotcha 5,352,
  Draco Meteor, Hyper Beam, Icy Wind, Toxic, Triple Axel. **35,608 clicks of moves that never missed.**
  The old probe asserted `moveAccuracy('aerialace') >= 100`, which is exactly what an engine where
  *everything* is 100% also returns. It was also a FACTS-ARE-GLOBAL violation: two other sites in the
  same file already read `data/move-effects.js` for this. Now derived from that artifact, and
  `tests/test-engine-diff.js` re-derives **all 500 against the live format every run — 0 disagree, 0
  unknown**. Independently confirmed against the dex: 112 moves in the format are below 100%.
- **WIRE 125 — the death counter forgot the dead, one turn later.** The end-of-turn recount ran over
  `act + bench`, and `bringIn()` overwrites the active slot and splices the bench, so a fainted body
  is in neither. **Last Respects (19,299 uses) dropped back to 50 BP the turn after its ally died**,
  and Supreme Overlord's snapshot undercounted for every later entrant. Now counted over the roster
  `battleInit` already stamps. Found while converting the probe whose old body read
  `S.sfA.fainted = 3;  // the input, not the effect`.
- **WIRE 126 — a comment claimed the -ate abilities were honoured; the function it named takes no
  attacker.** **An Aerilate Body Slam into a Ghost was priced at 136–162 by `dmgRange` and dealt 0 in
  the battle loop.** Four more sites were wrong the same way: a Galvanized Body Slam was not drawn by
  Lightning Rod, not absorbed by Volt Absorb, did not thaw, did not retype a Protean body.
  **This is WIRE 119's Taunt failure again, arriving through a comment, twice in three days.**
- Four silent catch blocks in `build/strong_player_baseline.js`. Two dropped records out of the
  corpus a rating distribution is computed over; two turned "git could not be asked" into an
  unrecorded null — the mistake `engine/run_stamp.js` documents in its own comments. `git_why_null`
  now travels with the stamp so a reader of the **artifact** can tell the two apart.

### Notes
- **Census 217/220 → 218/221 live. `unarmed` 145 → 116. Direct-call probes 47 → 37** (182 now spend a
  real turn or entry). **Red demonstrations 35 → 38, 0 failed.** Differential unchanged at 1/150.
  Interaction matrix re-run at `--full`: **byte-identical**, 1,624/1,643. `feature_fixture --check`
  **CLEAN — no refit owed.**
- **The red-demo guard earned its keep mid-pass.** WIRE 124's reversal stopped matching after that
  block was edited again, and `revertedEngine()` **threw and printed the stale text** rather than let
  a known-bad arm quietly become the shipped one.
- 28 of 47 converted, the whole ranked top 30 bar two, each judged rather than skipped and the reason
  written at the probe. Stopped at `multiAccuracy`, where converting re-derives the same expected-hits
  number through one more layer and asks nothing new.
- **The agent's own probe was wrong before the engine was — the thirty-third time this has happened.**
  Its `overridesEffectiveness` control read "Freeze-Dry equals Ice Beam off-type"; Freeze-Dry is 70 BP
  against Ice Beam's 90, so it would have failed a **correct** engine.

### Notes — routed, not fixed
- **`engine/position_features.js:197` reads `moveAccuracy` as a `risk` feature**, and that column
  genuinely moved for 78 moves — constant zero to a true miss chance. Not MAG's vector, so
  `feature_fixture` is correctly clean, but **any model fitted on position features predates the
  correct number.** MEASURE's call.
- `clickFragility` still prices an -ate click on the raw type; fixing it moves a MAG feature and owes
  a refit. Declared at the line.
- `data/move-effects.js` disagrees with the format dex on four accuracies (crabhammer, makeitrain,
  syrupbomb, clangoroussoul). Corrected locally; the generator is `build/build_browser_data.js` over
  CHOMP's JSON and is still wrong upstream.

## [3.53.0] — 2026-08-06

### Added
- **The PORYGON2 separation gate (#23) — PASS. The MILTANK leaf redesign is buildable.** 39,843
  same-game position pairs two turns apart over 6,328 clean HUMAN ladder games; thresholds written to
  disk at 05:59:44Z against a run at 06:56:06Z, and `--run` refuses to start unless the on-disk
  declaration matches the generator character for character.

  | | measured | bar |
  |---|---|---|
  | T1 separation, median \|Δ\| | 0.1628 [0.1600, 0.1653] | ≥ 0.02 |
  | T2 locality, R = same/unrelated | 0.709 [0.700, 0.718] | ≤ 0.75 |
  | T3 direction | 85.58% [85.16, 85.98] | ≥ 60 |

  **The second negative control is the finding.** A constant 0.5 fails all three — that was the
  mandated control and it is the weak one. **Uniform random PASSES T1** with a median of 0.2924,
  nearly twice PORYGON2's separation, and fails T2 and T3. **Separation alone cannot tell a value
  function from static**, and a gate proved only against a constant would have been passed by noise.

  **The caveat, stated first:** a material count through the identical pipeline also passes at two
  turns (R = 0.703), indistinguishable from PORYGON2's 0.709. **The 1-turn addendum settles it** —
  at the granularity a search actually uses, material goes flat (median \|Δ\| = 0.000, identical
  score on 58% of adjacent positions) while PORYGON2 moves on 99.3% and its locality improves to
  R = 0.5464. **Every branch material cannot separate is one the argmax decides by tie-break.**
  It says the leaf SEPARATES, not that it WINS. `MODELS.md`'s 63.59% stays **NOT MEASURED**.

- **`tests/test-json-nan-guard.js`**, auto-discovered by `run-all`, ratcheted, and **shown red on
  planted input before it was trusted** (`--selftest`, 3/3, including the multi-line-across-a-nested-
  dict shape a regex implementation gets wrong).

### Fixed
- **`engine/provenance.js` reported `ok` on a file it could not parse.** Python's `json.dump` writes
  a bare `NaN` by default — not valid JSON — and the first `porygon2-separation-gate.json` carried
  one. Every declaration in it became invisible **including the artifact's own `void` flag, the field
  that exists so a generator can condemn its own run.** The tool whose job is to say which artifacts
  can be trusted was unable to open one and said nothing.
  `data/mag.js` is JavaScript and is *expected* to fail the parse, which is why the catch was empty;
  a `.json` that fails is now `bad` + **UNPARSABLE**, which is **louder than UNSAFE** — an unsafe
  artifact still tells you what it claims, an unparsable one tells you nothing. Proven by planting a
  bare NaN in a real artifact, confirming `bad UNPARSABLE` where it previously said `ok`, and
  restoring byte-identically (sha256 verified).
- **`allow_nan=False` on all 39 unguarded `json.dump` calls across 27 Python files.** Transformed by
  paren-matching rather than regex, because six open `json.dump({` and span a nested dict a regex
  would land inside; all 27 compile clean. Repo now: **42 calls, 42 guarded, 0 unguarded**, and no
  shipped artifact carries a bare NaN or Infinity.
- Two silent catch blocks in `engine/dusk_size_gate.js`; `source_digests` emitted by the generator
  rather than re-keyed by hand.

### Notes — the coverage bar Will set, and what sizing it actually found
- **819 distinct moves, abilities and items carry real usage in this regulation** (derived over
  53,796 games / 117,588 sheet entries, counting declared sheet entries AND moves actually clicked).
  That is the denominator for *"fully wired and tested on every move and ability and item… with any
  usage at all"*, and nobody had computed it. **This is also why "216/219 mechanics live" is the
  wrong number — it counts probes that executed.**
- **The 1.8% that number produces is as misleading as 216/219, in the other direction.** `armed` is
  set when a probe *returns* `arms: {control, test}`, and **the arms protocol is two days old**, so
  almost every probe predates it. The Choice Scarf probe is counted unarmed and builds two
  Basculegion, gives one the item, and asserts `sb > sa * 1.4` — **delete the item and it goes red.**
  It has a control; it does not declare one.
- **Measured across all 142 unarmed-and-live probes: 93 spend a real turn (test the WIRING), 47 call
  the mechanic directly (test the FUNCTION only), and 111 have a control variant anyway.** The class
  worth fixing is **47, not 482**.
- **WIRE 123 proves which diagnostic is right.** The entry-drop handlers were all correct and the
  ORDER was not — and the Intimidate probe calls `M.applyIntimidate(foe)` **directly, never through a
  switch-in**, so it would not have caught it. It is `live`, and it covers the most-used ability in
  the format. **Ratchet on direct-call, not on `unarmed`** (#42).
- **The cutoff question, answered with the curve rather than a guess.** 0.5% per entity was rejected:
  it keeps 49 moves covering **70.8%** of move usage, because moves have a far fatter tail than
  abilities (86.3%) or items (89.2%) and one threshold cannot serve all three. **A 99%-of-usage
  coverage target** — moves 267, abilities 117, items 100, **484 of 819** — is the cliff; 99.5% costs
  73 more entities for half a point. A target is a mechanism and re-derives itself as the meta moves;
  a threshold is a list and goes stale. **Plus a carve-out**, because usage-weighting weights by
  notional and not by tail risk: anything that turns a **certainty into a failure** gets armed
  regardless of usage. Queenly Majesty is **0.361%, rank 50**, and it blocked a Sucker Punch in a
  real game the same day.
- **A figure corrected in the same pass.** Armor Tail was first cited as that carve-out case at 0.36%
  — a misread of the wrong table row. It is **3,403 uses, 2.894%, rank 8 of 185**, and Smogon's
  1630-cutoff file has Farigiraf running it **99.06%** of the time. It needs no carve-out; it clears
  any threshold on usage alone. That it is unarmed at rank 8 makes the gap worse, not more excusable.

## [3.52.0] — 2026-08-06

### Fixed
- **WIRE 123 — MEDICHAM applied entry abilities in ARRAY ORDER, and the weather that resulted was
  wrong.** This is a live correctness bug with a large blast radius, not a missing feature: side B's
  lead always won the weather regardless of Speed, and **every damage roll for the rest of the battle
  carried the wrong multiplier**. Found by asking a question Will asked about something else — *"if
  two incins come out, which intim goes first indicates speed"*. Differential against the official
  engine at pinned commit `20ad99ff`, three arms measured before any code moved:

  | leads (L50, Champions SP) | Showdown | medicham2 before |
  |---|---|---|
  | Pelipper 117 Drizzle v Tyranitar 81 Sand Stream | sand | sand |
  | Pelipper 85 Drizzle v Tyranitar 113 Sand Stream | **rain** | **sand** |
  | Pelipper 117 + ally Torkoal 40 Drought v Tyranitar 113 | **sun** | **sand** |

  Identical result across a varied knob — unwired, not *"it does not matter"*. The rule is
  `sim/battle-actions.ts:184` → `sim/battle.ts:794 speedSort`: faster resolves first, so **the SLOWER
  weather setter owns the sky**, and the sort is **global across both sides** — the third row exists
  because a per-side implementation passes the first two and fails it.
  `battleInit` now builds one entrants list across both sides and sorts it with the **existing**
  `effSpeed` + `compareTurnOrder`, so there is no second copy of *"who is faster"* and Trick Room
  inversion comes free. A Speed tie keeps declaration order — Showdown flips a coin, and `battleInit`
  has no rng to flip one with — counted loudly as `MEDFAILS.entryOrderTie`, **155 ties over 2,000
  random starts, 0.077 per start**.

- **Two silent catch blocks in `engine/dusk_size_gate.js`.** One would have discarded the whole
  forme map, which is the gate's matchup axis — Charizard-Mega-Y stops folding onto Charizard and the
  headline species-pair count silently inflates. The other skipped unparsable raw-log lines, which
  drops a game from the AUTHORITATIVE protocol arm while leaving it in the cross-check arm, so a
  corpus defect would have read as a reconstruction problem. Both now speak.
  `tests/test-no-silent-failure.js` re-baselined: **9 previously-baselined blocks now speak**, 0 new.

### Added
- **The DUSK size gate (#40) — verdict TOO BIG, and the reach rate kills it before the size does.**
  See the 3.51.0 note for the framing; the numbers are in `data/dusk-size-gate.json`.
  **16.42%** of 5,815 clean open-sheet games reach 1v1 and **58.95%** of those end in one decision, so
  the positions DUSK exists to answer are **3.75% of all decision points**. Independently re-derived
  off the stored turn events at 16.18% against the protocol's 16.42%.
  A memo cannot work at all: trained on the older half and tested on the newer, the hit rate is 34.9%
  at species-pair and **0.11%** once HP is bucketed; at DUSK's needed fidelity saturation is 0.86, so
  the distinct-position count measures the corpus rather than the state space.
  Enumerated instead, the shippable table (1.58M entries, 36 MB) **cannot see a Choice Scarf, a burn
  or a Swords Dance**; sets cost 25× on the matchup axis and open sheets are DUSK's whole premise.
  **Consequence:** DUSK no longer carries the argument for the Python→JavaScript bridge (#41), and a
  better successor is filed (#47) — a 1v1 under open sheets needs **one solve**, not a table.

### Notes
- **`data/dusk-size-gate.json` tripped the provenance ratchet and was not actually unstamped.** It
  recorded sha256 of both inputs **before** counting and re-verified them after (`corpus_moved:
  false`) — stronger evidence than `source_digests` normally carries — but under a private key, which
  is indistinguishable from unstamped to anything automated. The generator now emits both. The
  existing artifact was re-keyed from its own snapshot; nothing was hashed at stamping time, because
  a digest taken afterwards proves only that the file is unchanged *since*, which is not what the
  ratchet asks.
- **Census 216/219 → 217/220 live**, armed 74 → 75, unarmed unchanged at 145. Differential unchanged
  at 1/150. Interaction matrix re-run at `--full` against the changed engine: **unchanged**, 1,624 of
  1,643, same six disagreements. `engine/feature_fixture.js --check` **CLEAN — all 58 columns
  hash-identical to fit time. No refit owed.**
- **The Intimidate signal lives in the PROTOCOL STREAM, not the board.** Measured both ways
  (Incineroar 112 v Arcanine-H 110, then 80 v 142): final boosts are `[-1,-1,-1,-1]` either way, so
  the order is unobservable in the resulting state. **#43 part 2 must hook into the replay/live
  protocol parser**, not into MEDICHAM, which emits no protocol stream.
- **The new probe was shown RED before it was shown green**, and the red is permanent:
  `tests/probe_red_demo.js` carries a `demoSource` arm whose known-bad comparator replaces the entry
  sort with `sort(() => 0)`. **35 demonstrations, 0 failed.**

## [3.51.0] — 2026-08-06

### Added
- **GARY is named** — the opponent inside the search, the model that decides what the *other* side
  clicks on every turn of an imagined game (Will, 2026-08-06). It answers an ACTION-shaped question,
  so it is a MAG relative and deliberately **not** a member of the PORY value-function family, which
  scores a POSITION with no action attached. Naming it is the point: *a capability that cannot prove
  it ran is assumed broken* needs something to be missing under, and GARY had no name. New entry in
  `docs/MODELS.md`, new section R11 in `docs/SEARCH.md`, new box on the model map.
- **DUSK is re-scoped as an endgame tablebase and as the language bridge** (Will, 2026-08-06:
  *"a repository of scenarios in dusk that can show which mons beat which… and solve for those
  endings"*). Solve 1v1 positions once offline, look them up live — Syzygy for VGC. **Open team
  sheets are the precondition that makes it exact:** at 1v1 nothing is hidden but their next click, a
  small matrix game with known payoffs, which `engine/slowking/nash.py` already solves and is
  verified to solve. It is simultaneously the only route that lets the Python solver reach the
  JavaScript bot without a second implementation. Supersedes task #30's description.
- **`docs/ROADMAP.md` §4 — THE SEARCH REDESIGN**, and **a THE SEARCH band on `web/models.html`**.
- Tasks #32–#43.

### Fixed
- **The model map was missing the model that picks the moves.** `web/models.html` went from THE
  DECIDERS straight to the ALAKAZAM capstone with **MILTANK — the shipping search player — not on it
  at all**. Added, with GARY and DUSK, plus a drawn **language boundary**. viewBox 1310 → 1560;
  layout re-verified for bounds and overlaps.
- **The map filed PORYGON2 under "retired".** The box read *"PORYGON — same, mid-game"* beside
  JOLTEON, which merged a **retracted** model (PORY, which ties a two-feature baseline across three
  corpora) with a **built, never-retracted, never-live** one. Filing an unmeasured model under
  RETIRED is how it stayed unmeasured. Split.
- **ALAKAZAM's build order put the value net before the search.** At a **median game of 6 turns** a
  rollout reaches a real terminal state, so there is no position left to approximate — the leaf is
  the least of it, and the six turns leading to it are played by a coin.
  `docs/POKER-TO-POKEMON.md` §4b already said the binding constraint is **breadth, not depth**.
  Reordered to `GARY off the coin → prune with MAG not the coin → belief → equilibrium`.

### Notes — four capabilities that are built, correct, and switched off
This is the 2026-07-28 failure mode arriving through a door the rules had not covered. **Nothing
below was measured in this pass; all of it was read out of the source and is filed the day it was
found.**
- **GARY defaults to a coin, in the library and in the live bot.** `engine/miltank.js:455` and
  `engine/mag_bot.js:173` both default `foePolicy` to `'uniform'` — every imagined Pokémon draws one
  of its four moves with equal probability. The `'prior'` path at `engine/rollout_leaf.js:289`
  samples `data/move-priors.json` (128,548 clicks, 295 species) and is wired end to end. (#32)
- **The flag steers *both* sides** (`rollout_leaf.js:302-303`), so the opponent cannot be improved
  without also changing how the search models itself (#34); **the target is drawn uniformly in both
  modes** (`:290`), so `'prior'` fixes which move and never who it hits (#35); and **GARY has two
  seats that disagree** — `rolloutAfterActions`: *"The opponent is NOT modelled. It plays
  chooseAction during the stepped turn."* (#36)
- **No artifact records which GARY ran.** `data/rollout-r1.json` and
  `data/rollout-r1-explore-sweep.json` carry no `foePolicy` key, so R1's leaf verdict and R4's 55.5%
  describe an unrecorded configuration. Not a retraction — the arms were paired — but the result
  cannot be transferred to a run whose GARY differs, and nothing prevents that transfer today. (#33)
- **The candidate screen is run by the coin.** `miltank.js:1204` ranks every pair with a cheap
  rollout, the leaf measured at 51.0% of 1,314 decisive calls, CI [48.3, 53.7]. So the coin is not
  only scoring the finalists, it is **selecting** them. MAG is unused there because `_candsFor`
  returns candidates **with no scores attached** (`:1008-1012`). (#37)
- **The equilibrium solver is in the wrong language.** `engine/slowking/nash.py` and `ismcts.py` do
  simultaneous-move regret matching and recover exact Nash on RPS and an asymmetric 2×2. 127 JS files
  must play because Showdown is TypeScript; 40 Python files do the maths. `rollout_leaf.js` states
  the gap: *"a best response to a fixed opponent rather than an equilibrium."* (#41)

### Notes — two figures corrected, and both were mine
- **The rollout horizon is ~10× the real game.** `maxTurns` is 60; measured over **53,059 stored
  games the median is 6**, mean 6.5, p90 10, p99 16, with 0.01% over 60. A leaf evaluation is
  therefore ~5,600 move-decisions, not ~48,000 — which puts MAG-as-GARY back as an open question
  pending #39, the `board.js` ↔ MEDICHAM translation cost, which has never been measured. (#38)
- **MAG is not deterministic**, and *"sampling it would collapse the playout variance"* was never a
  reason. `greedy=false` draws from a softmax and `magnemite.js:217` calls it *"the single biggest
  measured lever in the project."*

### Notes — coverage, stated honestly
- **`data/mechanics-census.json`: probed 219, live 216, missing 3 — armed 74, unarmed 145.** An
  unarmed probe runs, reports a result, and would report the same result if the mechanic were
  deleted. **"216/219 mechanics live" counts probes that executed, not mechanics that work, and
  overstates coverage by roughly 3×.** The instrument that does not depend on anyone thinking of the
  right probe — random games diffed against real Showdown — finds **1 disagreement in 150**, and that
  is the honest signal. The remedy is arming the 145, not writing more. (#42)

### Notes — the free information nobody reads
- **Speed is revealed by resolution order** (Will, 2026-08-06: *"if two incins come out, which intim
  goes first indicates speed"*). Entry abilities resolve in speed order, so two Intimidates on one
  switch give a strict inequality before a move is clicked. Under open sheets the hidden information
  is *"what's in the back and the exact EV spread"*, so **Speed is essentially the only hidden
  variable** and each observation is a hard constraint on it. `engine/dynamics.js` already derives
  speed from who moved first, but reads **move order only**, aggregates **per species over the whole
  corpus**, and is read by `ditto.js` and `kadabra.js` and by nothing in `board.js`, `miltank.js`,
  `mag_bot.js`, `magnemite.js` or `medicham2-browser.js`. Entry-ability **order** is modelled
  nowhere: `entryOrder|switchInOrder|abilityOrder|speedOrder` matches no line in any of the 127 JS
  files. First question is an ENGINE correctness one — does MEDICHAM order entry abilities by speed
  at all. (#43)

## [3.50.0] — 2026-08-06

### Taunt did not exist, and the #1 disagreement by volume was not a harness fault

Four wires against the top of `data/interaction-matrix.json`'s disagreement list, ranked by CARRIER
uses × REACTOR uses. Every expected value was played at the pinned Showdown commit `20ad99ff` FIRST,
both arms printed, before a line of engine changed; every probe was shown RED on a known-bad engine.

**WIRE 119 — Taunt (1,503 clicks).** The volatile was written, decremented, and **read by nothing**,
so a Taunted body still landed Hypnosis, Stun Spore, Decorate, Screech, Disable, Feather Dance,
Strength Sap, Trick-or-Treat and another Taunt — twelve matrix rows. The comment at `chooseAction`
claimed the opposite in words. Both of Showdown's halves are now wired: **SELECTION** (`onDisableMove`)
through a module-scope `illegalMoveNow` that the priors sampler asks too, and **EXECUTION**
(`onBeforeMove`) through one gate **above the kind dispatch** — WIRE 77's place, because Taunt refuses
a status move of *any* kind. Derived from the tag (`forbidsStatusMoves.forbids` + the same move's
`statusInflict` volatile), membership printed before it was trusted, and `statusCategory` verified
against the format dex as an exact match for `move.category === 'Status'`. The duration tick moved to
end-of-turn beside Disable's, and Showdown's *"the target already moved"* +1 bump is wired off WIRE
118's `unresolved` set — measured both ways, three refusals either way.

**WIRE 120 — `partingshot -> throatchop`, the largest row (7,475 × 2,946), is an ENGINE fault.** It
was filed as a probable harness staging fault; it is not. `kind:'switch'` was given priority +6
whether or not it carried a MOVE, so **Parting Shot was the fastest action in the game** — it dodged
every hit aimed at its user and the replacement ate the attack. A pivot move now resolves in its own
bracket.

**WIRE 121 — `voltswitch -> lightningrod` (1,459 × 2,108).** Showdown fires `selfSwitch` only when the
move connected, so Volt Switch into Lightning Rod / Volt Absorb / Motor Drive leaves its user
standing. medicham2 pivoted anyway, turning the three abilities built to punish an Electric click into
a free escape. Also removed the three `flipturn -> <protect variant>` rows.

**WIRE 122 — Good as Gold refuses Yawn.** `refusesStatusMoves` is checked in nine places; the `yawn`
branch was the tenth site and had no check.

### Changed
- `engine/medicham2-browser.js` — WIRES 119–122. New derived table `forbidByVolatile()` (with a
  `TAGS.__onSetDB` rebuild hook so the mutation harness can perturb it), `volatileForbidsMove`,
  `actionMoveId`, and `illegalMoveNow` hoisted to module scope. The hand-copied Disable clause in the
  priors sampler is gone — it is now the same call the move-list filter uses, so Throat Chop's silence
  and the Gigaton Hammer lockout stop leaking through the sampler as well.
- `engine/medicham2-browser.js` — `pick.kind==='speed'` now asks about the action it PRODUCES rather
  than the move that was sampled. Milotic's priors label **Icy Wind** as `speed`, so a sampled Icy
  Wind was coming out of the chooser as a Tailwind; that mapping defect is **filed, not fixed**.

### Added
- `tests/test-mechanics.js` — five armed probes: Taunt at execution time, Taunt at selection time,
  Parting Shot not jumping the queue, Volt Switch not pivoting out of an absorbed hit, Good as Gold
  refusing Yawn. Each names the reference figures it was measured against.
- `tests/probe_red_demo.js` — five new demonstrations, three by stripped tag and two by source
  revert. **34 demonstrations, 0 failed.**
- `engine/medicham2-browser.js` — counters `seen.tauntRefusedAtExecution`,
  `seen.tauntRefusedAtSelection`, `fails.forbidCategoryUnknown` (+`…First`).

### Fixed
- The seeded LCG in the two new probes overflowed float53. `tests/test-prng.js` forbids the constant
  outright and caught it; both now use mulberry32, the generator `engine/chomp_ev.js` settled on.

### Notes
- **Mechanics census 211 → 216 live of 214 → 219 probed.** Missing still 3 (the same three), hollow 0,
  `threw` 0, `unarmed` still 145 — every new probe is armed.
- **Interaction matrix, `--full`: total known disagreements 94 → 72.** Live disagreements 20 → 19;
  off-gate 74 → 53; live cases 1,634 → 1,643 (nine became judgeable once a fix stopped the harness
  reading them as inert). Agreement 98.8%, unchanged as a rate.
- Damage differential unchanged at **1/150** — the same pre-existing `chesnaught woodhammer ->
  mimikyu` row. `tests/test-game-diff.js` agrees on every turn of all five scripted games.
- **MAG's inputs did not move, and it is measured.** Counters over the fit's own decision walk —
  57,275 candidate vectors from 300 clean games — record `battleTurn` 0, `actionPriority` 0,
  `playerAction` 0, against `compareTurnOrder` 37,084 and `dmgRange` 262,737. Every site these wires
  touch is inside a function the feature path never calls. `engine/feature_engine_contrast.js` was
  deliberately NOT quoted: it contrasts live against a frozen release and every release predates WIRE
  118, so its verdict is a documented `MOVED` about something else. **No refit is owed.**
- **Still open, named rather than filed quietly:** `taunt -> taunt` is a harness speed tie (the
  generator gives both sides Alakazam); `voltswitch -> lightningrod` is still STAGED TWICE under one
  key; `refusesStatusMoves` wants one predicate and has ten call sites.

## [3.49.1] — 2026-08-06

### The 97 "defect candidates" were triaged. Nought of them is a defect.

`tests/mutation_harness.js` reported **97 DEFECT-CANDIDATE** operators and they were presented as 97
bugs. The top two, checked by hand, were **both false positives**:

- `damageMultAll / lifeorb` (10,791 uses, the highest row) — the DAMAGE half is read straight off the
  tag at `medicham2:1216`. Only the **recoil** branches on `m.item==='lifeorb'`, so mutating
  `costsPerAttack` cannot move behaviour. A *derive, never name* violation that is **latent**, not live.
- `halvesDamage / lightscreen` (3,404 uses) — **not a defect at all.** The engine keeps separate P/S
  counters, honours the category the tag declares, and ignores the tag's `mult` **on purpose**: the
  artifact carries the SINGLES 0.5 and this is a doubles engine where the reduction is 2732/4096.

The harness's own header already said READ-AND-IGNORED is not the same thing as a defect. Its triage
could not see a **deliberate override**, and that was the gap.

### Added

- **An A/B/C/D classifier, graded on what the SOURCE DOES**, not on comments — a comment is prose.
  It parses every `TAGS.param/has/withTag/reactorsTo` call in the frozen engine (balanced-paren
  argument extraction), then asks whether the mutated param is dereferenced off the bound variable and
  whether the carrier's id drives a branch by name.
  **A** tag never read (the defect class) · **B** param overridden with the engine's own constant ·
  **C** hardcoded by name (latent — the carrier count of the tag is printed as the risk) ·
  **D** the param IS read and this battery could not move it.
- **The triage is gated like any other check.** Three cases decided by hand — Taunt **A**, Light Screen
  **B**, Life Orb **C** — must all be reproduced or the sweep refuses to run and writes no artifact.
  `tests/test-mutation-coverage.js` asserts the artifact on disk was produced by a rule that could.

### Changed

- **The ratchet moves from `defectCandidates + tagNotConsumed + noConsumerInSource` (340) to CLASS A
  ONLY (163).** A number that counts false positives is a number people learn to ignore. The ceiling
  carries its own scope, hashing **the text of the classifier**, for the same reason the battery scope
  hashes the script text: changing what is counted makes two counts incomparable. The per-operator
  ratchet keeps the battery scope alone — a triage change must not reset it.
- The ranked list is class A only, and prints the B and C lists above it so a reader can check the
  demotions rather than take them.

### Fixed

- **Three false-match shapes in the classifier, each found by printing the membership before trusting
  it, and each of which DEMOTES a row out of the defect class — the dangerous direction.** Comments
  quote code (`'encore'` inside a sentence at 2478), so comments are stripped before any name is looked
  for. `{kind:'protect'}` writes an action kind and decides nothing. And `SPREAD_LEGACY` at line 166 is
  live code holding `'blizzard'`, `'rockslide'` and `'heatwave'` — a plain "is the name in a set" test
  moved `blizzard / inflictsFreeze`, `rockslide / flinches` and `heatwave / inflictsBurn` out of the
  defect class on the strength of a set about something else. A name-set match now requires **half the
  set's members to carry the tag** (POWDER scores 0.88 against `powder` and passes; SPREAD_LEGACY
  scores 0.03 against `flinches` and does not).

### Notes

- **0 of the 97 survive as class A** — 40 B, 5 C, 52 D. Class A is 163 operators over 56 carrier x tag
  rows, and every one of them came from the NO-CONSUMER-IN-SOURCE bucket, not from the 97.
- **Class A is not "163 missing mechanics" and the artifact says so.** It means the fact reaches the
  simulator neither as a tag nor through the carrier's name; a third route — `mv.rc`,
  `data/move-effects.js`, an action kind — can still carry it, and this instrument cannot see those.
  49 of the 56 rows have no ARMED census probe, and that is the number that is a defect claim.
- No engine file was read for behaviour and none was edited. Measured against frozen release
  **`032b4a2979dd`** and stamped with it, while a second ENGINE agent held `medicham2-browser.js` open.

## [3.49.0] — 2026-08-05

### There were two implementations of "who moves first". One is deleted, and the survivor is dynamic.

Will, three times now: modern VGC uses **dynamic speed** — the remaining actions are re-sorted
mid-turn, so a Tailwind speeds the partner up in the SAME turn if the partner has not yet moved. The
previous answers were the wrong shape (a consistency test, a ratchet, a proposed shared module).
**A test that checks two copies agree is a workaround for having two copies.**

| | before | after |
|---|---|---|
| `engine/medicham2-browser.js` | sorted the action list ONCE per turn and walked it frozen — no dynamic speed at all | freezes the bracket, then **re-sorts the remaining actions before each one resolves** |
| `engine/board.js:2791` | `(slowFirst ? mySpe < thSpe : mySpe > thSpe) ? 1 : 0` — the Trick Room inversion and the speed comparison restated by hand, twelve lines below a call it already makes into that same engine | asks `compareTurnOrder` |

They had measurably diverged. `board.js:466` says in words that a Tailwind lets the partner move first
THIS turn, so MAG's `speedSwing` and `speedSetupHelpsPartner` believe in dynamic speed, while the
rollout that checks MAG's opinion said the Tailwind did nothing — and **the search believes the
simulator.** Tailwind is the dominant strategy in this format.

The rule is Showdown's own, quoted from Showdown at the pinned commit: *"Actions are sorted based on
order (lower first) followed by priority (higher first) followed by speed (higher first)"*, and
*"In gen 8, speed is updated dynamically so update the queue's speed properties and sort it."* The
re-sort re-derives the **speed** only; `order` and `priority` are resolved once when the action is
queued, so the bracket is frozen at the top of the turn here too.

### Added

- `compareTurnOrder`, `turnOrderKey`, `sortTurnOrder` and `actionPriority` in
  `engine/medicham2-browser.js`, exported on `module.exports` **and** on the global root — board.js
  reaches this engine through `window` in a browser, and a module-only export would have left the
  Battle Tower page falling back on a hand-rolled order, which is the duplicate reappearing in the one
  environment nothing tests.
- Census probe `move doublesSideSpeed — "Tailwind speeds the PARTNER up inside the same turn"`, armed.
  The tag's existing probe reads the partner's speed AFTER the turn and structurally cannot see when
  the boost starts counting.

### Fixed

- After You and Quash write the action's `order` (Showdown's own `3` / `201` against `200`) instead of
  splicing the array. A splice is undone by the next re-sort, so WIRE 109 would have gone silently
  dead under dynamic speed.
- The speed tie is rolled **once per action, on first demand, and stored**, not flipped inside the
  comparator. A coin inside a comparator is re-drawn on every re-sort, which would have diverged the
  RNG stream of every seeded run in the repo for reasons that have nothing to do with speed. Rolled
  lazily, so a turn with no speed tie draws exactly as many numbers as before.
- The flinch bookkeeping is a set of actions **not yet resolved** rather than an index into a list
  frozen at the top of the turn. It keeps the half the index was quietly also answering: a body with no
  action this turn cannot be handed a flinch that would leak into the next turn.

### Notes

- **Census 210 → 211 live / 213 → 214 probed**; missing still 3, hollow 0, threw 0, unarmed 145.
  Differential **1/150**, the same pre-existing `chesnaught woodhammer -> mimikyu` row.
  `tests/test-game-diff.js` agrees on every turn of all five scripted games.
- **The RED is permanent.** `tests/probe_red_demo.js` gained a `demoSource` arm whose known-bad engine
  is exactly the frozen queue and nothing else — the three-line re-sort deleted, everything else left
  in place — so the one thing that flips is the thing the wire is about. 29 demonstrations, 0 failed.
- **The probe was shown RED first**, and its first staging was wrong before the engine was — the 0-EV
  Garchomp/Incineroar pair the analysis named does not overtake at `buildMon`'s USAGE spreads
  (Garchomp 161 vs a Tailwind Incineroar's 160), so it would have printed identical arms on a FIXED
  engine and read as agreement. Milotic (101) and Incineroar (80) are the two bodies whose `MC` lines
  are exactly the reference's own 0-EV lines.
- **The board.js edit is measured, not argued.** A direct A/B — the WIRE 118 hunk reverted and compiled
  in memory at board.js's own path — is **IDENTICAL on all 58 feature columns over 1,136,845 candidate
  vectors from 6,055 clean games**, with the same row keys, and the instrument's positive control
  (the same rule INVERTED) moves `movesFirst`, `deadNoLastMove` and `diesBeforeMoving`. Separately,
  `battleTurn` — the only existing function this change touched — is called **0 times** by the feature
  path over a 300-game walk.
- **`engine/feature_engine_contrast.js` says MOVED, and it is reported as it came out.** Three columns
  differ against both frozen bundles on identical pinned rows: `movesFirst`, `deadNoLastMove`,
  `diesBeforeMoving`. It holds board.js FIXED in every arm and swaps only the engine, so the release
  arms run the **live** board.js against an engine with no `compareTurnOrder` and trip board.js's own
  loud unavailable branch — measured in that arrangement: `dmgFailures.unavailable` fires **2,110**
  times over 20 games and mean `movesFirst` falls from **0.5212 to 0.2302**, while the like-for-like
  A/B above is identical on every row. The consequence is real and is MEASURE's call, not ENGINE's:
  live board.js now requires a post-118 engine, and the alternative — letting board.js fall back on the
  hand-rolled comparison — is the duplicate this pass deletes, restored for cross-version convenience.
  **No refit was started here.**
- **What the re-sort costs, measured:** `sortTurnOrder` on a four-action list is **1.96 µs** against the
  old inline comparator's **2.38 µs** (keys are built once per action, not once per comparison), so two
  extra sorts add about **4 µs** to a turn that takes 800–1,100 µs. The whole-turn benchmark cannot
  resolve that — five interleaved pairs ran 760–3,327 turns/sec inside a single arm — and is recorded
  as noise rather than as a win.
- **FILED, NOT FIXED, and not caused by this pass: the fit corpus moved three times in one hour.**
  `fit_policy.loadCorpus()` returned **9,361** clean open-sheet games at 19:48Z, **6,055** at 19:52Z
  when this pass measured, and **8,957** at 20:35Z; 3.47.0 recorded 9,230 this morning. An earlier
  `data/feature-engine-contrast.json` was written straight across that — arms of 9,361 and 6,055 games
  — and published `MOVED — this is a REFIT, not a restamp` off a `same_rows: false` comparison, which
  is the corpus moving and not a feature-function change. The instrument now pins the sample of game
  ids before any bundle runs and `provenance.js` has a CORPUS DRIFT check; both landed in the same hour
  and are somebody else's work. This pass's own A/B is a photograph of the 6,055-game moment and its
  row-key hash proves both arms walked it. Why the corpus moves is MEASURE's.

---

## [3.48.0] — 2026-08-05

### The two-arm gate was discarding 74 real disagreements between the engines

Will: *"why dont we compare medicham to showdown while testing? that would be the easiest way to
catch? instead of the dumb way of comparing it to itself."*

We do compare them — that is the 1,614/1,634 headline. The two-arm test is a second, different check
and it is not the dumb half: a mechanic MISSING from medicham2, in a staging that also stops it
firing in Showdown, makes both engines produce identical states and scores as **AGREE**. An absent
capability would pass. That is this project's signature failure and the reason the check exists.

**But it was being used as a GATE.** A case whose reference arms matched was bucketed INERT and
discarded *before* its medicham2-vs-Showdown result was ever read. The comparison was computed and
thrown away. Measured across the run: **74 discarded cases have the two engines in different states.**

**INERT means "an AGREEMENT here proves nothing". It never meant "a DISAGREEMENT here does not
count".** The label suppresses the positive claim only. These are now reported and recorded in
`data/interaction-matrix.json` as `off_gate` / `off_gate_rows`, and deliberately kept OUT of the
agreement rate, because that rate is a claim about pairs where the reactor demonstrably fired.

### What was hiding there

| reactor | cases | uses | what it says |
|---|---|---|---|
| `taunt` | 12 | 11,042 | **medicham2 does not implement Taunt blocking status moves.** A Taunted body still lands Hypnosis, Stun Spore, Decorate, Screech, Disable, Feather Dance, Strength Sap, Trick-or-Treat |
| `beakblast` | 7 | 9,652 | |
| `weakarmor` | 7 | 8,044 | |
| `quickclaw` / `prankster` / `suckerpunch` / `upperhand` | 11 | — | Simple Beam and Worry Seed do not change the target's ability |
| `toxicdebris` | 4 | 572 | medicham2 sets Toxic Spikes where Showdown does not |

Full list in the artifact. Every one is medicham2's fault by construction — Showdown is the
authority.

### Added

- `data/interaction-matrix.json` records `off_gate` and `off_gate_rows`, and the run prints them
  under their own heading rather than silently dropping them.

### Notes

- **Two corrections from Will on the AXIS-4 spec, both taken.** Sucker Punch is NOT a turn-denier —
  it requires the target to be clicking an attacking move and fails otherwise; it moves first, it
  does not cost the target its turn. And modern VGC uses **dynamic speed**: the remaining actions are
  re-sorted mid-turn, so a Tailwind speeds the partner up in the SAME turn if the partner has not yet
  moved. The AXIS-4 measurement was specified against turn 2 and is wrong; it belongs on turn 1.
- **Dynamic speed is confirmed in Showdown and absent from medicham2.** Staged at L50/0EV: Whimsicott
  136, Garchomp 122, Incineroar 80 (160 under Tailwind). Control order is
  `Whimsicott → Garchomp → Milotic → Incineroar`; with Tailwind it is
  `Whimsicott → Incineroar → Garchomp → Milotic` — Incineroar overtakes inside the turn.
  `engine/medicham2-browser.js:2439` sorts the action list ONCE and never re-sorts. Filed for ENGINE.
- **The 3,401 battles/sec figure is a July quote, not a measurement.** ADR-002 says so itself about
  the 117× ratio. medicham2 has gained roughly 35 mechanics since it was taken, and nothing measures
  its speed on any run — so "are the new rules slowing us down" is currently a matter of opinion,
  which this repo treats as a defect. A benchmark and a floor are filed.

---

## [3.47.0] — 2026-08-05

### Two artifacts were computed from an engine that moved. The confound was measured instead of argued, and it is empty.

`engine/provenance.js --strict` was red on `data/click-censoring-census.json` and
`data/censoring-value.json`: `engine/medicham2-browser.js` and `data/tags.json` both moved under them
(WIRES 114–116 in 3.42.0, WIRE 117 in 3.44.0, the tag dex regeneration in 3.45.0). `MEASURE.md` §16
listed three options — refit both weight vectors, re-measure through a frozen release, or leave the
artifact UNSAFE and unquotable. **None of the three was taken.**

The blocking rule is CLAUDE.md's *fitting environment and playing environment must match*, and that
is a claim about the FEATURE FUNCTION. A feature function is a function from a board to a number, and
two versions of it are the same function if they agree on every board — so they were run against each
other on every board the fit uses.

**All 58 feature columns are hash-identical across the three engine bundles, on 1,751,688 candidate
feature vectors from all 9,230 clean open-sheet games.** The bundles were loaded out of the frozen
releases `09acd3b404ef` (`medicham2` `e2bcff0db96f`, the engine `censoring-value.json` read) and
`032b4a2979dd` (`80fe43fba1a9`, the census's) and registered under the live module paths, so only the
simulator and the tag dex differ between arms. The harness was shown SEEING a difference first: under
a Psychic Terrain with a Levitate body the frozen engines return `0` and the live one returns
`Infinity`.

### Added

- **`engine/feature_engine_contrast.js` → `data/feature-engine-contrast.json`.** The measurement above
  is not left in a session scratchpad — that is §16's own lesson, where a published contrast's baseline
  vector lived in `%TEMP%` and was not reproducible by anyone. It contrasts any set of engine bundles
  (release ids or `live`) column by column over the whole corpus, records the exposure of the
  incomplete-defender-body input, and stamps `source_digests`.
- **It refuses to report agreement unless its positive control disagreed.** `BUNDLES=live,live`
  returns **NOT A RESULT — the positive control did not separate the bundles**, seen failing before
  the passing run was believed. A harness that silently loaded the same bytes twice would otherwise
  publish a confident "identical", which is this project's signature failure mode.
- It is **not** a replacement for `engine/feature_fixture.js`. The fixture hashes ~50 frozen boards so
  a weight file can carry the hashes, and its own header states the limit — a guard only guards what
  it exercises. This asks the same question on every board the fit actually uses. Both are green.

### Changed

- **`data/click-censoring-census.json` re-run on the current engine and corpus** — 249,404 actions
  over **9,230** games (was 244,146 over 9,022): CLEAN **94.9111%**, PARTIAL **1.3344%** (3,328),
  COERCED **0.5545%** (1,383 — Encore 1,152, `|drag|` 231). Classifier against the raw protocol:
  encore recall **99.69%** precision **96.31%**, drag **96.74% / 96.74%**, on the 67.23% of games
  that carry a raw log. The three class shares have now held to a hundredth of a point across
  censuses at 8,942, 9,022 and 9,230 games.
- **`data/censoring-value.json` re-run against `data/policy-weights-pre-censoring.json`** (sha12
  `01bc43936324`, the preserved incumbent) — **48,274 held-out decisions over 1,851 games**, and
  every 3.42.0 figure reproduces inside its interval: COERCED P(the coerced action)
  **−0.002613 [−0.003650, −0.001672]**, PARTIAL mass **+0.000122 [−0.000261, +0.000514]** (still
  contains zero — the redirection correction still buys nothing), CLEAN logL
  **+0.000485 [0.000189, 0.000777]**. Every effect is still smaller than its own class's split-half
  floor and resolves only because the comparison is paired per decision.
- Both artifacts now stamp `source_digests` over the tree they were computed on. **`node
  engine/provenance.js --strict` exited 0 at that point — 0 UNSAFE, 1 declared VOID
  (`exploitability.json`), 57 ok — and is RED again forty minutes later. See the second section
  below; it is the more important half of this release.**
- `docs/ABRA-whitepaper.md`, `docs/SUMMARY.md`, `docs/MODELS.md`, `docs/ABRA-technical-docs.md` and
  `docs/ABRA-deck-plain-english.md` carry the re-measured figures; the 3.42.0 run is stated beside
  them rather than overwritten, because a prior conclusion is never silently rewritten.

### Notes

- **The `board.js` over-refusal ENGINE filed is worth 0 rows, and the number is now on the record.**
  `board.js:2565` and `position_features.js:231` hand `priorityRefusedAbove` a `{ability, fainted}`
  body, so `isGrounded()` cannot see types or item. Over the whole corpus: 1,751,688 candidate
  vectors, 332,030 with a priority move, **135,552** reaching `board.js:2560`'s `cand.targetMon`
  guard, **362** of those under a Psychic Terrain, and **0** where a complete body changes the
  answer. The only five rows in the corpus that flip are `protect` ×4 and `ragepowder` ×1 — self-
  targeted moves that never reach the call site at all. **It does not justify a refit**; it should
  ride along with the next one, because `fails.groundedBodyIncomplete` fires on 100% of 173,478 calls
  and the nil consequence is a property of this corpus, not of the code.
- **WIRE 117 could not have moved a feature here and the counter says why:** of 173,478 guarded
  calls, 424 are under a Psychic Terrain and in none of them is every live defender airborne. The bar
  only lifts when no grounded body is left to hold it up.
- **This is not a general licence to score old weights through a new simulator.** It says these four
  wires moved no feature on this corpus. The next engine move gets the same treatment: run the
  columns, then decide.
- **AND THE NEXT ENGINE MOVE CAME BEFORE THIS ENTRY WAS FINISHED, AND IT DID MOVE THREE COLUMNS.**
  While this was being written, `engine/fit_policy.js` (15:40, corpus **9,230 → 6,055** open-sheet
  games), `engine/medicham2-browser.js` (15:43) and `engine/board.js` (15:44) all changed. Re-run with
  the sample pinned — 1,136,845 vectors, identical `row_key_hash` in all three arms — the verdict is
  **MOVED: `deadNoLastMove`, `movesFirst`, `diesBeforeMoving`.** That is 3.49.0's dynamic-speed
  unification, and **a refit is owed to it.** `engine/feature_fixture.js --check` reports *feature
  semantics OK* on the same tree, because no fixture board stands on the branch that moved — so
  `status.js`'s `refit edge: CLEAN` is currently reporting an edge that is not clean. Both instruments
  work; only one of them can see this. Full account in `docs/MEASURE.md` §17b.
- **Consequently the two artifacts above are UNSAFE again**, now through `engine/fit_policy.js`,
  alongside `data/partial-label-em.json` (same cause, another division's file, untouched).
  `provenance.js --strict` exits 1 with 3 UNSAFE. They were deliberately NOT re-run a third time: the
  corpus definition changed by a third in the same twenty minutes, so a third run would publish a
  different population under the same headline. Re-run both against a still tree.

## [3.46.0] — 2026-08-05

### The harness was defending against its own experiment: 379 of 2,300 cases gave the holder Protect

Will asked one word — *"Goodra?"* — about the review sheet for the 706 cases the matrix reported as
INERT. Goodra appeared as the holder for both Gooey (135 cases) and Sap Sipper (15), which was worth
a question. It was the largest staging fault in the instrument.

Every case needs the holder to ACT while it is hit, so it is given a filler move.
`tests/interaction_matrix.js` `fillerFor()` ended:

    for (const f of FILLERS) if (learns(sp, norm(f))) return f;
    return 'Protect';

**A holder that learned none of the six fillers was handed a Protect, which blocks the very carrier
the case exists to land.** Both arms then behave identically, the case reports INERT, and INERT is
indistinguishable from the outside from *"this interaction genuinely cannot express itself"*.

Measured before it was fixed: **379 of 2,300 staged cases** — Goodra 158, Garbodor 136, Gholdengo 62,
Arbok 22, Gourgeist 1. That is every Gooey case, every Aftermath case, and every Good as Gold case.

**Gooey was proven to fire in the official engine while this harness recorded it doing nothing.** A
standalone reproduction gives `|-ability|p2a: Goodra|Gooey` then `|-unboost|p1a: Blastoise|spe|1`;
through the fixed harness the same case now reports `sdWitness=[".A.active[0].boosts.spe"]` and
medicham2 agrees.

### Fixed

- **`fillerFor()` no longer falls back to Protect.** It returns `null` for a body it cannot stage,
  and `holderFor()` REJECTS that body under a named drop reason rather than poisoning the case. The
  last resort before `null` is DERIVED rather than hand-listed — any Status move the body learns that
  targets **self** and is not in the protect family. Self only, not ally: the script emits the
  filler with no target slot, and an ally-aiming move is rejected by `battle.choose` (Dragon Cheer
  got as far as *"Invalid target"* before this was narrowed).
- **An assertion in `tests/test-interaction-matrix.js` throws if a holder is ever handed a protect**,
  because degrading quietly is the entire failure. It is scoped to the FILLER branch only: when the
  REACTOR is the protect — Spiky Shield, Baneful Bunker, King's Shield — the holder clicking it is
  the whole case, and the first version threw on `fakeout x spikyshield` for behaving correctly. A
  guard that fires on correct behaviour gets deleted.

### Changed

- **LIVE 1,453 → 1,634. INERT 706 → 530.** 176 cases stopped being blocked by their own holder.
  Staged and theoretical are unchanged at 2,300 of 8,795 — nothing was added or removed, cases that
  were already there simply started expressing themselves.
- Agreement **1,614 / 1,634 (98.8%)**, disagreements 17 → 20.
- **`data/interaction-matrix.json` now records `inert_rows`.** Until this release only the COUNT of
  inert cases was written, so there was no way to look at them — which is why this fault survived
  every previous pass. INERT is the one outcome the instrument structurally cannot self-diagnose: if
  the staging is wrong, both arms are wrong together, they agree perfectly, and a shared blind spot
  cancels out exactly.

### Notes

- **Three newly reachable disagreements**, filed not fixed. The important one is
  `yawn -> goodasgold`: MEDICHAM applies Yawn through Good as Gold and Showdown does not, and
  MEDICHAM's own two arms are identical, so the knob is UNWIRED rather than miscalculated.
- **One newly reachable HARNESS fault**, not an engine one: `yawn -> insomnia` reports
  `.B.active[0].species medi="gourgeist" sd="milotic"` — the two engines have different bodies in
  slot 0, which is a staging bug and must not be counted against the simulator.
- **This mistake was made six times in one session.** The Psychic Terrain reference harness hit it
  twice (both defenders given Protect; then Earthquake, which `battle.choose` rejects). Diagnosing
  THIS one hit it three more times: the defender given Protect, Fake Out aimed at the wrong slot, and
  a bench filler of Farigiraf whose Armor Tail refused the priority move under test. That is why the
  fallback was REMOVED rather than replaced with a better guess.

---

## [3.45.0] — 2026-08-05

### The interaction matrix threw away 902 of 8,676 pairs because they "have a probability", and the reason string was hiding two different faults

Will: *"We cant just toss inaccurate moves can we?"*, then *"Flare blitz is 100 accurate man same with
iron head."* Both right. `carrier-is-a-die` was **one reason covering two faults with nothing in
common** — a move that CAN MISS (647 pairs) and a move that ALWAYS CONNECTS but carries a chance side
effect of its own (255 pairs) — and reading it back got Flare Blitz, a 100%-accurate move, described
as inaccurate. Between them they are the most-clicked physical moves in Reg M-B, so the contact
reactors were being tested only with the contact moves nobody clicks.

**The dice were counted before they were forced.** Every draw both engines took was tallied, in both
arms, for all 717 of the 902 that reach the carrier loop. The premise did not survive it: under
`pinDice` the reference engine's `prng.random` is a **pure function of its arguments**, so a differing
draw COUNT between arms cannot shift a later draw. **There was no stream to diverge.**

**What there was instead was a misalignment, and the drop was hiding it.** `random` was pinned to the
middle of its range and `randomChance` to `num >= den`, which is a different die —
`PRNG.randomChance(n, d)` *is* `random(d) < n` (sim/prng.ts:115). Accuracy is checked through
`randomChance(accuracy, 100)`, so **every sub-100-accuracy move MISSED in the reference engine and
CONNECTED in medicham2**. Two pinned functions and nothing comparing them; the filter that dropped all
647 such pairs is why nobody noticed.

Measured against frozen release `032b4a2979dd` before any of it was written: bucket B staged with the
roll left completely alone gave **124 live, 123 agree (99.2%)** — the drop was precautionary and
wrong; bucket A under the old pin had **377 of 501 INERT** and **24 of its 95 live pairs disagreeing
for no reason but the miss**.

### Fixed

- **`tests/test-game-diff.js` — the two pinned dice were not the same die.** `randomChance` is now
  `Math.floor(den / 2) < num`, which is the PRNG's own definition evaluated at the median `random` was
  already pinned to. Both pins are named constants and **a module-load assertion checks them against
  each other**; that assertion goes red on the old value at `(90,100)` and `(95,100)`. Controlled: all
  **1,675 cases the matrix already staged were run under both pins, case by case, and NOT ONE verdict
  moved** (1,027/1,031 either way).

### Changed

- **`tests/interaction_matrix.js` — the reason string is split by FAULT.** `carrier-is-a-die` no
  longer exists. What survives is `carrier-misses-the-pinned-median-die: accuracy N <= 50` (44 pairs;
  at exactly 50 the two engines split on a strict-versus-non-strict reading of the same median) and
  `carrier-reaches-this-key-only-through-a-roll` (108 pairs; derived from the linkage KEY —
  `moveSecondary` membership *is* "the move has a secondary" and `volatile:flinch` is reached by Iron
  Head only through its 30%, so a secondary that cannot fire leaves the pair with nothing to express).
  Membership was **printed before it was wired**, and all 47 measured members of the second rule came
  back INERT, 47 of 47.
- **Will's collision rule was asked for and is NOT shipped, because the measurement says the set is
  empty.** No staged carrier has a secondary above 50% — the maximum across all 216 is exactly 50 — so
  at the pinned median none of them fires and a collision cannot occur. A guard that can never fire is
  a silent default with extra steps.
- **`tests/test-game-diff.js` — trap 2 is now about LUCK rather than about a percentage being
  written on a move.** `opts.allowRolls` lifts it for one script, is passed per CASE off the carrier
  the generator marked, and is **REFUSED without `opts.pinDice`**, because unpinned the roll really is
  luck.
- **`tests/test-interaction-matrix.js`** now exposes its staging (`main()` + `module.exports`) so the
  harness can be measured with the harness instead of publishing an artifact as a side effect of a
  `require`.

### Notes

- **Published at 3.45.0, and the figures moved between the dry run and the publish.** The entry above
  was measured against frozen release `032b4a2979dd` while a second ENGINE agent held
  `engine/medicham2-browser.js`, so nothing was written then: a full pass against a moving engine is
  void. The published pass ran afterwards, against a still tree, and on top of **two changes the dry
  run could not see** — the Psychic Terrain wire (3.44.0) and the `data/tags.json` regeneration that
  gave `priorityMove` its three reactor MOVES, which the dry run's tags did not have.

  | | 3.43.0 | dry run | **published 3.45.0** |
  |---|---|---|---|
  | theoretical | 8,676 | 8,676 | **8,795** |
  | staged | 1,675 | 2,272 | **2,300** |
  | LIVE | 1,031 | 1,428 | **1,453** |
  | agreement | 1,027 (99.6%) | 1,412 (98.9%) | **1,436 (98.8%)** |
  | disagreements | 4 | 16 | **17** |
  | coverage of theoretical | 19.3% | — | **26.2%** |

  The dry-run row is kept rather than overwritten: it is what was true of the matrix change ALONE,
  and the difference between the two rows is the other two changes, not a correction.
- **Twelve newly reachable disagreements, filed not fixed** (this pass owns the matrix, not the
  simulator): `stoneaxe`'s 100% Stealth Rock secondary is absent (6 rows, 62 uses); `scaleshot`'s
  self-boosts are in the move's own `self` rather than in `secondaries[].self`, which is all WIRE 81
  wired (2 rows, 151 uses); `gigaimpact` and `rockwrecker` keep `mustrecharge` after a move that was
  blocked or made immune; `supercellslam` pays no crash damage into King's Shield;
  `bugbuzz -> throatchop` — the one row whose verdict was not stable across quantiles, so it is filed
  as *possibly the harness*.
- Reconciliation still balances and `node tests/interaction_matrix.js --selftest-reconcile` still
  passes; every pair that stopped being dropped became a STAGED pair, none vanished.

---

## [3.44.0] — 2026-08-05

### Psychic Terrain refused priority against Pokémon that were not on the ground

Will: *"Psych terrain is sorta like queenly majesty"*. He is right, and that is precisely what hid
the defect — both resolve through one function, `priorityRefusedAbove`, and **the terrain branch sat
outside the defender loop and never inspected a body at all.** Real Psychic Terrain refuses priority
only against a **grounded** target.

So MEDICHAM refused **Fake Out — 12,872 corpus uses, one of the most-clicked moves in the format** —
along with Extreme Speed, Sucker Punch, Aqua Jet, Ice Shard and Upper Hand, into every Flying type,
every Levitate body and every Air Balloon on the field.

Mechanics census **208 live of 211 probed → 210 live of 213 probed**; missing still 3, hollow 0,
threw 0, unarmed **146 → 145**.

### Fixed

- **`priorityRefusedAbove` now asks each body whether it is grounded.** The bar is per-SIDE for the
  abilities (Queenly Majesty and Armor Tail protect their partner) and per-TARGET for the terrain, so
  the function gained an optional third argument naming the body being aimed at. Without it a
  grounded partner would refuse a Fake Out aimed at the Talonflame beside it.
- **`isGrounded(mon)` is one function and every site calls it.** The predicate had been written by
  hand **three** times — the hazard block, `preventsSwitch.onlyGrounded`, and the Grassy Terrain heal
  — and the three disagreed about Iron Ball and about Eelevate. CLAUDE.md's *FACTS ARE GLOBAL*,
  broken and repaired.
- **Grassy Terrain no longer heals a Levitate body.** That copy applied the type half only and
  **counted its own known-wrong half** in `MEDFAILS.terrainHealUngrounded` — somebody knew it was
  wrong and the counter was the receipt. The failure counter is retired and replaced by the
  capability counter `seen.terrainHealSkippedAirborne`, so the event stays countable.

### Added

- **A census probe with five arms**, `move setsTerrain — "Psychic Terrain refuses priority only
  against a GROUNDED target"`. Each arm kills a different wrong engine: grounded-blocked alone passes
  on the shipped-broken build; Flying-lands alone passes on a build with no terrain at all;
  **Earth Eater** is the over-match control; **Iron Ball** is the clause that outranks Flying.
- **A second kind of known-bad engine in `tests/probe_red_demo.js`.** The existing mechanism strips a
  TAG, which cannot express a defect that lives in the CODE. `demoSource()` loads the engine into a
  fresh module, textually reverts the wire's sites to what they said before, and **asserts every
  reversal applied**. Both WIRE 117 rows flip; 28 demonstrations, 0 failed.
- **`seen.terrainSparedAirborne`** — a Psychic Terrain priority bar that was not applied because the
  target is airborne. The branch could not fire at all before this change.
- **`fails.groundedBodyIncomplete`** — grounded-ness asked of a body carrying no type list.

### Changed

- **`engine/tag_dex.js`'s `priorityMove` linkage test**, from `move.priority > 0` to the two idioms
  Showdown actually uses, derived from the handler's shape and **not by naming a terrain**. It adds
  three reactor MOVES (`psychicterrain`, `quickguard`, `upperhand`) and changes the ability side not
  at all. **STAGED — `data/tags.json` is untouched.**

### Notes

- **Every expected value came out of the official engine**, played at the pinned commit under
  `gen9championsvgc2026regmb`: Garchomp and Orthworm show `|-activate| move: Psychic Terrain` and take
  0; Talonflame and Hydreigon show `|-hint| "Psychic Terrain doesn't affect airborne Pokémon"` and
  take 237→216 and 251→233; Iron Ball drags both of them back down and the move is blocked again.
- **The reference harness was wrong before the engine was, twice** — Lesson 5 verbatim. Its first
  version gave both defending bodies Protect as their only move, so every arm read "blocked" and the
  engine would have been declared correct.
- **Every clause was checked against the format rather than remembered.** Air Balloon and Telekinesis
  are `isNonstandard: 'Past'` — banned — and Air Balloon is absent from `data/tags.json` entirely.
  Iron Ball is legal (113 uses) and is wired. Gravity (79 uses) and Roost (2,109 uses) also ground a
  body, are legal, and are **declared unwired**: this engine holds no pseudo-weather slot and no
  per-turn type override.
- **The airborne ability set is a NAME, deliberately.** `typeImmunity {type:'Ground'}` looks like the
  shape to read; its membership is levitate, eelevate **and eartheater**, and the official engine
  blocks Fake Out into an Earth Eater Orthworm — it is Ground-immune and firmly on the floor.
  Showdown hard-names the pair inside its own `isGrounded`.
- **FILED, NOT FIXED:** `board.js` and `position_features.js` map their priority defenders to
  `{ability, fainted}`, so a Flying-type foe is still over-refused in the FEATURE vector. Changing
  that is a refit edge, which MEASURE owns. The gap is loud rather than silent.

## [3.43.0] — 2026-08-05

### The interaction matrix now checks its own arithmetic, and it was wrong three ways

The matrix is this project's largest conformance instrument — 8,676 theoretical carrier × reactor
pairs. It printed a theoretical total, an emitted count and a ledger of named drops within four lines
of each other, and **nothing in the code compared them.** They differed by 5,090.

The identity is `theoretical === staged + dropped`, per axis, asserted at generation time. It is not
a total for a reader to check; it throws. On the flag axis it is asserted per `(key, reactor)`, where
the carrier count N is known exactly — so a failure names the reactor rather than reporting a gap
somewhere in eight thousand pairs.

### Fixed

- **The theoretical denominator omitted the generator's own supplementary linkage keys.**
  `tests/interaction_matrix.js` stages against `LINKAGE` — `data/tags.json`'s keys MERGED with keys
  the file derives itself — while `theoreticalSize()` counted only `tags.linkage`. 170 pairs were
  staged or dropped against a universe that had never heard of them. Theoretical **8,506 → 8,676**.
  Both now read the same object, so they cannot drift apart again.
- **The type axis mis-costed its depth-cap tail by exactly one, 32 times.** The carrier index was
  incremented *before* the cap was tested, so the recorded tail excluded the very carrier the break
  was rejecting. The error ran in the direction that flatters the coverage rate.
- **The outcome buckets were not a partition.** `saturated` did not exclude a case that had THROWN
  and `ko_timing` excluded nothing at all, so four cases were counted in two buckets each and the
  five printed totals summed to 1,679 against 1,675 cases run. `tests/test-interaction-matrix.js`
  now classifies once, in a stated precedence, and throws if the five do not partition the run.
- **`reconcile()` was defined and never called**, while this file's header stated it was "the only
  thing that can stop a run" and that `--selftest-reconcile` proved it fired. Neither was true. Both
  are now.

### Added

- `node tests/interaction_matrix.js --selftest-reconcile` — mis-costs exactly one drop by one pair,
  the smallest lie the ledger can tell, and requires the identity to stop the run. Exit 1 if it does
  not. This satisfies the standing gate: no check is committed until it has been seen FAILING on
  input known to be bad.
- A failed reconciliation prints the drop ledger. A bare "170 pairs" names no suspect, and a failure
  nobody can act on is how this file acquired an assertion that was never called.

### Changed

- **Interaction matrix: 1,514 → 1,675 staged, 899 → 1,031 live, agreement 100.0% → 99.6%
  (1,027/1,031).** Closing the ledger recovered 161 pairs the generator had been discarding without
  naming them, and four of those pairs are ones MEDICHAM gets wrong: `fakeout`, `throatchop` and
  `psychicnoise` against **Shield Dust**, and `upperhand` against **Steadfast**. All four are UNWIRED
  knobs — MEDICHAM's own two arms are identical on each — rather than wrong arithmetic.

### Notes

- **The headline agreement figure went DOWN and that is the instrument working.** A 100.0% computed
  over a denominator that dropped 5,090 pairs in silence was the less honest number; it was a
  statement about where nobody had looked. `docs/ADR-002-showdown-is-the-authority.md` cited both the
  old figures and now carries a revision section saying which way they moved and why, because a prior
  conclusion is never silently rewritten.
- The `899/899` claim is left standing in `docs/ENGINE.md`'s 3.40.0 narrative with a pointer forward,
  rather than edited out of the history.

---

## [3.42.0] — 2026-08-05

### Outplayed turns stop being noise: 1,336 recorded actions were not clicks, and MAG was learning from every one

Will: *"i def dont like just tossing turns because they got outplayed with a move liek encore or
follow me, these are the basis of vgc man."* `docs/CLICK-CENSORING-FIX.md` is the spec; MEASURE
implemented all four stages and both fitters were refitted under them.

**The result, with the half that did not work first.** Two headline classes were measured on 47,195
paired held-out decisions over 1,809 games, bootstrapped over GAMES:

- **COERCED turns (n=284)** — Encore replaced the click, or the mon was dragged in.
  P(model picks the action no human chose) **−0.002614, 95% CI [−0.003663, −0.001637]**. The
  fabricated label is unlearned. This is the only headline that moved.
- **REDIRECTION turns (n=643)** — mass on the true candidate set **+0.000109 [−0.000286, +0.000491]**,
  contains zero; log-likelihood on the set **−0.002646 [−0.004037, −0.001377]**, very slightly
  WORSE. **Stage C bought nothing measurable**, and its own pre-refit validation predicted that: at
  the rate the corpus actually censors, the weight-space bias is −0.0030 against a 0.2600 noise floor.
- **CONTROL, clean turns (n=46,268)** — logL +0.000447 [0.000142, 0.000743]; top-1 +0.002
  [−0.094, 0.099]. No corpus-wide top-1 change, exactly as the spec disclaimed in advance.

Every effect is smaller than its own class's split-half noise floor and resolves only because the
comparison is paired per decision.

### Added
- `engine/click_class.js` — the one reader for *is this recorded action a click at all*, shared by
  `fit_policy` and `joint_rows`. Mechanism sets are DERIVED from the running format (moves with
  `condition.onOverrideAction`; moves with `forceSwitch`; abilities with `onFoeTryMove`; items
  assigning `switchFlag`/`forceSwitchFlag`, **empty in Champions**; `data/tags.json`'s `redirects`)
  and every set refuses to be empty.
- `engine/click_census.js` → `data/click-censoring-census.json`. 241,927 actions over 8,942 games:
  **CLEAN 229,555 (94.886%), PARTIAL 3,260 (1.3475%), COERCED 1,336 (0.5522%)**. A second arm reads
  the raw protocol on the 66.17% of the corpus that has logs and SCORES the classifier against it —
  Encore recall 99.68% / precision 96.11%, drag 96.51% / 96.51%.
- `engine/em_validation.js` → `data/partial-label-em.json`, plus `--check` for the suite. On heavy
  systematic censoring the naive fit is biased by 0.8935 against a 0.2600 noise floor and **EM
  recovers 97.4%** of it. Registered as a gate in `tests/run-all.js`.
- `engine/censoring_value.js` → `data/censoring-value.json`. Paired, class-conditional,
  game-clustered bootstrap, per-class noise floors, `void: true` if a source moves mid-run.
- `tests/test-click-censoring.js` — every check shown RED on known-bad input first, on planted
  protocol logs put through the real `durable-ingest.extract()`.
- `CENSORING=off` in `engine/fit_policy.js`: the control arm, which fits the old way on the new
  corpus and stamps `censoring: "off (CONTROL ARM — not shippable)"` in its own artifact. **Not yet
  run** — see Notes.

### Changed
- `engine/fit_policy.js` and `engine/joint_rows.js` remove COERCED actions from the labelled set and
  keep PARTIAL ones under the marginal likelihood (Cour, Sapp & Taskar 2011), fitted by Generalized
  EM. A zero on either counter is fatal in both fitters.
- **Both layers refitted.** `data/policy-weights.json`: 8,942 games, 232,815 usable decisions of
  241,927 seen. `‖new − old‖₂ = 0.8030`, 9 of 58 weights past 2 SE, and the largest single movement
  is `stallIntoEncore` **−1.0502 → −1.6281** — the feature named for the mechanic, moving in the
  predicted direction.
- `data/degradation-budgets.json`: `decisionsDropped` and `turnsDropped` are **retired to a new
  `superseded` block**, not renumbered. Stage B changes what "dropped" means, so the totals would
  have risen while the artifact got strictly better. Replaced by `*.decisionsUnreadable` /
  `*.turnsUnreadable` (a LOSS) and `*.coercedActions` / `*.coercedTurns` (a CORRECTION), each with
  its granularity recorded. `measured_at` no longer claims "over 120 corpus games" for rates that
  come from a whole-corpus artifact.
- `engine/status.js` prints the censoring line, the classifier's own recall/precision, the EM
  verdict and the class-conditional behaviour change — with the clean class labelled CONTROL.

### Fixed
- A `|drag|` is stored by `engine/durable-ingest.js:67` with the same shape as a `|switch|`, and
  `fit_policy`'s `forcedSlot` guard only knew about faints — so **220 phazed arrivals were fitted as
  voluntary switch decisions**.
- The Encore application turn passed every counter in the repository, because the move Encore forces
  out is on the victim's own menu. **1,116 of them** were fitted as human choices.
- `data/policy-weights.json`'s caveat claimed *"~11% of clicks were dropped as unmatched, mostly
  redirection"*. Both halves are retracted in the artifact: redirection does not drop a click at all.

### Notes
- **Will's Farigiraf case is answered: PARTIAL, not ERASED.**
  `|cant|BLOCKER|ability: Armor Tail|MOVE|[of] ATTACKER` — **284 of 284 (100.0%)** name the attacker
  slot, so user and move are exact and only the target is ambiguous, between two mons. It is counted
  and deliberately **not recovered**: the class lives only in raw logs, which cover 66.17% of the fit
  corpus, and the missing third is one store — recovering it would reweight the sample by source.
- **Found on the way, not fixed:** `board.js` narrows the choice set for a Choice item and not for
  the `onDisableMove` family, so **2,280 of 139,769 logged actions (1.6313%)** were priced with a
  menu that had already shrunk. A wrong denominator, not a wrong label; it owes its own refit.
- **The Stage D contrast carries a confound and it is stated:** the two vectors differ by the coerced
  removal, the EM, 86 extra games and the refit itself. `CENSORING=off` exists to isolate it and has
  not been run.
- `CHANGELOG.md` has **no entry for 3.41.1** (commit `43ff359`) and none for 3.39.0. Reported, not
  back-filled — they are other divisions' releases.

### ADR-002 — the repo's stated authority and its actual authority were different files

`docs/ADR-002-showdown-is-the-authority.md`. ADR-001 decided the official Champions mod becomes the
rules authority and `medicham2-browser.js` becomes a lookup table. **Migration steps 5–8 were never
executed and the opposite happened** — the hand-written engine is now a standing division whose
census may never fall, and the leaf of the live search player. That is ADR-001's explicitly rejected
alternative, adopted in practice, unrecorded for over a week.

Decided: **Showdown is the AUTHORITY, MEDICHAM is the RUNTIME.** Two measured reasons, neither of
them preference:

- **ADR-001's premise was falsified.** It held that hand-fixing "was never going to converge" after a
  31.1-point win-probability disagreement. It converged: **149/150** damage rows, **899/899**
  interaction pairs, **202/205** census. What changed is that the differential harness and the
  interaction matrix *did not exist* when ADR-001 was written. Hand-fixing did not converge;
  instrumented fixing did.
- **The migration is impossible for what we now build.** ADR-001 accepted the official simulator's
  **117×** slowdown as the price of a precomputed table. That price is unpayable under MILTANK, a
  search player acquired *after* ADR-001, which plays positions out thousands of times per turn.

Accepted and stated in the ADR: the matrix stages **1,514 of a theoretical 8,506** pairs, so the
honest claim is agreement on what ran, never "the engine is correct" — and **the decision weakens if
the coverage programme stalls.** `engine/champions_sim.js` header updated to point at both ADRs.

### Every division agent is now forbidden from killing processes by name

`.claude/agents/{engine,measure,search,ops,web}.md`. On 2026-08-05 an agent cleared a hung scan of
its own with `taskkill //F //IM node.exe` and killed three node processes repo-wide while four other
agents were working. It self-reported honestly and nothing was measurably lost — which is luck, not a
defence: a fit dying at minute 39 leaves a gap rather than an error. Rule added to all five: **kill
only what you started, and only by pid.** If the process cannot be identified, report and stop.

### Four published figures corrected against their own artifacts

Found by a derived doc-currency check built tonight, which was shown catching all three of the
named defects before it was trusted. It reports **99 figures attributed to an artifact that does not
contain them** and **86 traceable to nothing at all**; these four were verified by hand and fixed.

- **The deck was still quoting the retracted 63% exploitability figure**
  (`docs/ABRA-deck-plain-english.md:186`), two slides after saying we have no answer to how readable
  the bot is. The standing rule is that this number is never quoted. Rewritten to state the
  withdrawal and why: 17 features against the 58 shipped, a pre-filter corpus, and a re-run voided
  when the defender was refitted mid-search. **ABRA still has no exploitability number.**
- **`SUMMARY.md` overstated the project's one load-bearing win.** It read "31/31 within 2%";
  `data/damage-validation.json` says **36 scenarios, 100% within 5%, 97% within 2%, median 0%, worst
  3%**. Wrong in both the count and the tolerance, on the single result everything else rests on.
  The whitepaper's "within 5%, worst 3%" was correct throughout.
- **`MODELS.md`'s XATU belief entry was wrong in all four figures.** Artifact: CE **1.9889 vs
  2.0329**, top-1 **31.23% vs 30.39%**, improvement **0.0324 [0.028, 0.0364]**, four-known **1.7874
  vs 2.3428** on **3.84%** of events. The retracted headline (0.028) is exactly the artifact's
  **lower CI bound** — read out of the wrong end of an interval rather than a stale run.
- **`MODELS.md`'s XATU context entry inverted a comparison.** It claimed a *larger* gain than the
  in-game tracker; on the real figures it is **0.032 against 0.0324**, a tie. The comparison is
  removed rather than reversed, because at that separation neither ordering is supportable.

Every verdict is unchanged by these corrections. XATU still clears zero and is still the strongest
model in the project; the damage engine is still validated. Only the numbers move — which is the
argument for citing an artifact instead of retyping one.

## [3.41.0] — 2026-08-05

### Layer 0 executes, the joint layer refits, and the sheet's value becomes a measurement

Three division dispatches ran in parallel against the 3.40.0 landing, with measurements reading
frozen releases while writers worked the live tree — the discipline the release mechanism exists
for, exercised without incident (one measurement self-voided when the engine moved mid-run and was
re-run clean).

### Added
- WIREs 90–112 (ENGINE, Layer 0): entry hazards on drag (Toxic Spikes/Sticky Web), foe-aimed
  Decorate, Trick/Switcheroo item swap, Trick-or-Treat type writes, honest random drag, traps dying
  with their trapper, and the full 26-orphan triage — 7 hardcoded-by-name mechanics rewired to read
  the artifact by shape (Gale Wings had NO consumer at all), 8 genuinely missing mechanics wired
  (Shadow Tag, Sheer Force's ×1.3, Unaware's ability half, Tinted Lens, Stakeout, Aftermath-class,
  Stamina-class, weather-private abilities), 3 redundant tags retired with survivors named. Census
  **181→202 live of 205 probed, 3 missing**; matrix **899/899 (100.0%)** after the retired tags
  shrank the generated set from 1,012; DEAD ratchet **61→38**.
- `tests/probe_red_demo.js` — every new probe demonstrated red against a known-bad engine, 26/26
  flips; carries Layer 2's `__setDB` + derived-set rebuild hook, already exercised.
- Joint four-channel refit (`data/policy-weights-joint.json`): 95,886 usable turns, channel-reach
  counters 99.7%, held-out pair top-1 9.8%→12.2% with joint terms, feature semantics verified.
- `data/sheet-channel-value.json` — the held-out A/B/C measurement vs the frozen two-channel
  incumbent: **+0.005087 logL/decision end-to-end [0.003854, 0.006331]**, real and clearing zero;
  **no demonstrable top-1 gain** vs a 0.331-point split-half noise floor. Stated exactly that way.
- Pory-family corpus refresh (pory, pory-nn, nmf): 5,883 clean games, retraction tie holds
  (+0.000001), `population_ceiling` declarations close the §5f false-denominator class,
  site-freshness 7/7 green. Stadium page restamped from the artifacts (WEB), history preserved.

### Fixed
- Intimidate retaliation arithmetic: Defiant netted +2 (truth: +1), Competitive skipped the Attack
  drop entirely. Fixed in the shared `applyStatDrop`, verified against the official handlers.
- Sheer Force was strictly worse than no ability (suppression worked, the ×1.3 was absent).
- After You/Quash landed — the "cannot tell it from Instruct" blocker was false (`instructsTarget`
  is a declared shape); Marvel Scale landed via the staged `condStatMult` derivation.
- The tags regeneration was gated by `feature_fixture --check` against BOTH fitted vectors: zero of
  the 58 feature columns moved, so the night's fits stand.
- WIRE 113: the shape-read of `invertsBoosts` made a latent over-match live — Intimidate into
  Simple read +1 where the official engine gives −2 (verified by real battles at the pinned
  commit). Derivation corrected (Contrary-only), new `amplifiesBoosts` tag (Simple), Ripen
  excluded by its berry gate; `test-rollout-effects.js` re-pinned to the official table, 39/0.

### Added (late in the pass)
- `docs/CLICK-CENSORING-FIX.md` (+ `.pdf`) — Will's outplayed-turns finding, upgraded to a staged
  fix: redirected clicks are MNAR censoring (dropped exactly when the opponent's play worked),
  Encore-application turns are silent label noise (kept, wrong, counted nowhere). Fix: a
  protocol-derived censoring census, coerced-action detection, partial-label marginal likelihood
  via EM for redirected targets, then a paired refit with a class-conditional behavior comparison.
  MEASURE implements next session.

### Notes
- Still red, awaiting Will by name: `fit_joint.turnsDropped` 5.4929% vs 5.49% ceiling — the counter
  measures click-matching, is structurally insensitive to the refit, and crept over on corpus
  growth against a 1bp-granularity ceiling. Options presented: re-cut with rationale, or waive.
- `data/exploitability.json` remains void. The SEARCH re-run of the explore sweep and the
  reparameterization memo were in flight at this entry's writing; their results land at the next
  version.

### The coverage job lands, is re-examined, and the plan is amended where it was wrong

The 2026-08-04 session was stopped mid-write with three divisions in flight. This release is the
triage of that tree (verdict: everything KEEP, zero reverts — all three work products were finished,
not half-done), the gate closure that followed, and the re-examination of
`docs/ENGINE-COVERAGE-PLAN.md` that Will ordered, written up in `docs/COVERAGE-PLAN-REVIEW.md`
(+ PDF).

### Added
- `docs/COVERAGE-PLAN-REVIEW.md` (+ `.pdf`) — the re-examination: what stands, the two internal
  contradictions, the three mutation-tier traps, and the amended order of work.
- WIREs 87–89 in `engine/medicham2-browser.js` (drain-before-contact-toll order; Steel Roller
  terrain gate; secondary chance read from the FORMAT rulebook with a `rulebookChanceDrift`
  counter), completing the 82–89 batch. Census 167→**181 live of 186 probed**; every probe was
  demonstrated failing against a deliberately broken in-memory engine before its green was trusted.
- `tests/test-rulebook-collision.js` + `data/rulebook-collision.json` — the two-rulebook collision
  ratchet: 151 comparable facts, 149 agree, **2 clashes** (ratchet ≤2, may fall, may never rise).
  Iron Head was the live one — tags carried the format's 20% flinch, move-effects the generic 30%,
  and the engine read the wrong copy until WIRE 89.
- `engine/exploit_step_probe.js` + `data/exploit-step-probe.json` — the 58-dim step rule proven on
  a planted optimum, release-stamped. Finding: one accepted step ≈ 0.202 win-rate points against a
  4.77-point resolution; the 58-dim re-run is not launchable at any affordable budget.
- `engine/sheet_channels.js` + `engine/sheet_channel_value.js` — the four-channel sheet plumbing
  (the former was required by committed code; HEAD could not load without it) and the pending
  held-out A/B/C channel-value measurement.
- MAG four-channel refit artifact (`data/policy-weights.json`): 231,722 decisions, `fitEnvironment`
  stamped with point-of-use channel-reach counters (99.67%), `feature_fixture --check` passes.
  Pre-refit weights preserved at `data/policy-weights-presheet.json` and
  `data/policy-weights-joint-presheet.json`; arm-A baseline frozen at `data/releases/d3d04b669e18/`.

### Changed
- `docs/ENGINE-COVERAGE-PLAN.md` amended (see the review doc for the argument): **mutation now
  ships before the registry** — the original stub defense routed stubs into UNREACHED, the one
  bucket the ratchet deliberately never guards; mutation operators are now per-tag AND per-param
  with a derived-set rebuild hook (tag removal cannot see a read-and-ignored param, and medicham2
  builds its tag-derived sets at module load, so `__setDB` alone silently no-ops); the registry's
  exhaustiveness now runs over the unified fact model of BOTH rulebook outputs; the 35 duplicated
  move tags get a generated `carried-by-other-output` declaration; the endgame 58-dim exploitability
  re-run is cancelled in favor of a 4–8-dim reparameterization of MAG first.
- `data/interaction-matrix.json`: 68 disagreements → **13** (55 resolved by the wires; 1,012 live
  cases, 999 agree, reproduced on a fresh `--full` run).
- Shell Trap recorded as `isNonstandard: 'Past'` — banned in this format; its missing tag is the
  format door working, not a coverage gap.
- `engine/provenance.js` now verifies a mismatched stamped digest against the declared release's
  frozen bytes and classifies a match as a PRE-CHANGE photograph — release-pinned artifacts are no
  longer false-flagged UNSAFE for reading the snapshot they were told to read.

### Fixed
- All 34 NEW silent catch blocks made to speak (none blanket-baselined): 20 SEARCH-owned
  (`miltank.js`, `exploit.js`, `rollout_*`, `mag_bot.js` — logging only, control flow untouched),
  8 MEASURE-owned, 5 ENGINE-owned, plus a scanner false-positive fixed in the detector
  (`fail(...)` call syntax now recognized as speaking). Baseline re-locked at 231 blocks.
- `engine/miltank.js` `horizon()` carries its RAW-STORE-OK declaration (the clock plans against the
  whole opponent population, not the clean subset) — `engine/selftest.js` 25/0.
- `tests/test-effective-identity.js` 18/0 — the 5 new raw reads in the refit files walked and
  declared (routing `probeLive`'s counters through `effAbility()` would blind them to the exact
  silent-default failure they exist to catch).
- `tests/test-mc-key.js` 15/0 — the tag-consumption sweep now enumerates species through
  `mcKey.all()` instead of a private index (hand-rolled lookups 17→16).
- `docs/ENGINE.md` missing-mechanics hand table corrected: seven → five, `conditionalPower` and
  `needsUntrackedState` retired by WIRE 83.

### Notes
- Still red, named, not filed: `tests/test-degradation-budgets.js` (`fit_joint.turnsDropped` 5.4929%
  vs 5.49% ceiling — pre-existing at HEAD; the joint refit was never run and resolves it one way or
  the other; the ceiling was not touched) and `tests/test-site-data-fresh.js` (bundle mtimes vs an
  hourly-appending store, plus `pory-nn.json` corpus drift at 17.9% — a stop-and-ask for Will, since
  regenerating republishes quoted numbers).
- `data/exploitability.json` remains `void: true`. ABRA has no exploitability number.

### A measurement now reads a frozen release, so the divisions can keep working

Three division agents ran concurrently with their files separated, and a 7,100-game exploitability run
was destroyed anyway: `data/policy-weights.json` — MAG itself, the thing being defended — was refitted
at 22:15:24, between a search that froze its opponent at 21:41 and a replay that reloaded it at 22:17.
**The two legs of one measurement defended with different weight vectors.** `medicham2-browser.js`
showed four distinct content digests inside eight minutes. Nothing crashed and nothing failed.

The first response was a paragraph in `CLAUDE.md` saying a measuring agent must run alone. **That was
wrong twice** — it is prose, which this repository has learned three separate times is a preference
rather than a rule, and it serialises four divisions that were cut apart precisely so they could run at
once. (Will: *"we can run multiple agents at once that's the whole point."*) `docs/DIVISIONS.md`
encodes an invalidation **order**; treating that order as a scheduling constraint forfeits the
parallelism it exists to make safe.

`engine/engine_release.js` is the real fix. A measurement opens an immutable snapshot of the twelve
files whose content can change a reported number — the simulator, board, leaf, features, tags,
`champions_sim`, the engine data, **and the weights**, because "can anything beat MAG" is a claim about
one specific vector and the weights are what actually moved. The release id is the digest of the
digests, so an identical tree yields an identical id and re-cutting is a no-op.

**A copy, not a checksum.** Verifying digests afterwards establishes only that the run was wasted.
`tests/test-engine-release.js` proves the claim by doing it: cut a release, genuinely modify the live
file, assert the release still serves the original bytes and that `REL.read()` does not see the edit
either. A digest-comparison test would pass against a symlinked implementation — the plausible wrong
build, which reproduces the exact bug. The mutation restores in a `finally`, and a counter asserts the
mutation arm ran. First release `5fc1f711a0e3`, against Showdown `20ad99ff`.

### `provenance.js` was clearing artifacts by mtime — the method `CLAUDE.md` discredits by name

*"Treat 'newer than its source' as no evidence at all."* The file that exists to enforce that a derived
artifact is compared to its **source** was comparing `mtime(artifact) < mtime(input)`. It false-cleared
with a receipt: the void artifact is 153 seconds **newer** than an input it never read. An integrity
gate answering `ok` for a file that is not ok is worse than no gate, because the point of the row is
that somebody stops checking by hand.

It compares **content** now, and on its first run caught a real one nobody had noticed —
`rollout-r1-explore-sweep.json`, computed against a version of `engine/rollout_r1.js` that has since
changed. An artifact may also declare `void: true`, which outranks every inference; nothing else could
have known the WOBBUFFET re-run was invalid, since it passed every inferential check in the file.

**The ratchet's first break proved a count is not actionable.** It fired at 91 against 90, could say
only "one more than last time", nobody could identify the artifact, and `status.js` printed
`provenance: NOT DERIVED` for the rest of the session. It records the **list** now and names the file.
That also closes a hole a count could not have: an artifact gaining a stamp while an unstamped one
appears nets to zero.

**And a corrupt stamp must not read as "first run"** — that is the ratchet laundering itself, adopting
the current tree as a new baseline and blessing every artifact that had lost its stamp. Absent and
unreadable are now different events. The same distinction was added to `digestOf`, and to
`engine_release`'s `sha12`, which **throws** rather than returning `null`: a null digest inside a
manifest is the worst possible value, because `verify()` would compare null against null and certify a
release frozen over an unreadable file.

Standing: **0 artifacts verified by content, 92 by mtime alone**, printed on every run and ratcheted
downward.

### Also

- `data/exploitability.json` and `-holdout.json` marked `void: true` with the full reason. The site no
  longer publishes the retracted 63.2% — it states that there is no number, and why.
- The mirror control improves from a struck-through 47.5% (n=217) to a real **49.7% [46.2, 53.2]** at
  n=782, the one figure the void run produced that survives, and it retires the worry that the earlier
  number indicated a seat asymmetry rather than noise.
- Running `tests/test-interaction-matrix.js` without `--full` silently replaced the published
  1,008-case artifact with a 323-case one. Both record their own depth honestly, which is what makes it
  dangerous. A shallower run now refuses to overwrite a deeper one.
- `build/build_scoreboard.js` still hand-rolled its own `SHOWDOWN_PATH` gate — `build/` was never swept
  when the other twenty were routed through `engine/showdown_path.js`.
- The white paper, deck and technical docs carry 3.36–3.39 content: the refit null with its intervals,
  the sheet-channel gap, the generated interaction matrix, and a Diátaxis procedure for cutting and
  measuring against a release.

---

## [3.38.0] — 2026-08-04

### The interaction matrix is GENERATED now, and it found ten engine bugs no single-mechanic probe could reach

Will: *"Basically all the tags on moves and stuff should trigger all the flags on abilities and types
and etc and have it flow from there"* and *"the interactions should be pretty formulaic now that we
have all the tags and such."*

#### Added
- `tests/interaction_matrix.js` — the generator. It enumerates the cross product of every CARRIER tag
  against every REACTOR tag, on three axes: FLAG (a move that carries `contact`/`sound`/`punch`/… ×
  everything that reacts to it), TYPE (a move OF a type × every type-immunity, halving, resist berry
  and redirection — an axis the previous sampled version generated **zero** cases for, because
  `linkage.moveType.carrierMoves` is empty by construction), and FIELD (every ordered pair of
  persistent field effects, which is the MULTI-TURN half). It authors no expected outcome.
- `tests/test-interaction-matrix.js` — the runner. Every case is played **four** times: with the
  reactor and without it, in medicham2 and in the official pinned Showdown engine. A case whose two
  REFERENCE arms are identical is INERT and is never counted as agreement. Artifact:
  `data/interaction-matrix.json`.
- Three tag derivations: `weatherSuppression` (Air Lock / Cloud Nine),
  `rewritesAbilityOnContact` (Mummy / Wandering Spirit), and the flag half of `convertsMoveType`.

#### Fixed — WIRE 72 to 81, all in `engine/medicham2-browser.js`
- **72** Grassy Terrain never set a terrain: it carries `perTurnHP` and that branch sits above the
  terrain branch in `playerAction`. 24 of 156 multi-turn field cases at once.
- **73** Grassy Terrain's 1/16 per-turn heal, derived from the terrain move's own tag.
- **74** The sandstorm chipped on the turn it EXPIRED — five ticks against the official engine's four.
  Visible only as a pair, because the grassy heal cancels the sand exactly. **The counter was never
  wrong**, which is why nothing had caught it. Weather and terrain are not symmetric in the reference
  engine and both halves were measured before the line was written.
- **75** `convertsMoveType.converts` names either a TYPE or a FLAG and only the type half was read, so
  **Liquid Voice** (346 uses) was completely inert.
- **76** `immuneToMoveClass` had one consumer per stage-3 mechanism instead of one per STAGE: a
  Soundproof body took zero damage from Psychic Noise and still got two turns of Heal Block.
- **77** The Throat Chop silence was checked in the attack branch only, so a silenced body could still
  phaze with Roar.
- **78** Air Lock and Cloud Nine. The previous verdict — *"no artifact to wire from"* — was a claim
  about the DERIVATION, not about the dex: Showdown carries it as the flat property
  `suppressWeather`, which every handler-probing derivation missed. Exposure measured first: Air Lock
  has **zero** carriers in this format; Cloud Nine has two and 18 declared sheets in 40,595 games.
- **79** `statChangeInCode` with `on:'target'` had a reader (inside the pivot branch) and no
  classifier, so **Strength Sap** (637 uses) resolved to a wasted turn.
- **80** Mummy and Wandering Spirit rewrite the attacker's ability. Both grounds for filing this were
  retired: the dex states the whole rule in one call, and the "0 corpus sheets" claim no longer holds
  (mummy 41, wanderingspirit 58).
- **81** The secondary that boosts the **USER**. The block read `status`, `targetBoosts` and the
  flinch and never `selfBoosts` — 12 moves, 1,199 corpus uses, entirely unread.

#### Changed
- `tests/test-game-diff.js` exports its projection, comparator and `runScript` so the matrix does not
  write a second definition of "the same state"; it gained `pinDice` and `hpBoost` options and its
  screen projection now takes a MAX over Reflect / Light Screen / Aurora Veil.
- `tests/test-effective-identity.js` declares the two new files, with the construction reason.

#### Notes
- Census **157 → 167 live**, 8 → **7 missing**, 0 hollow, 0 threw. Interaction matrix **93.3%** of
  1,008 live cases (the multi-turn field axis is **156/156**). Damage differential unchanged at
  **1/400**, seed 20260804. `feature_fixture --check` still exits 0, so **no refit is owed**.
- Four harness bugs are recorded in `docs/ENGINE.md` alongside the engine ones, because each produced
  a confident wrong answer first: Protect's 8 PP, Sturdy on the control arm, a fainted body reading as
  zero damage, and an inertness test that deleted its own evidence.

## [3.37.0] — 2026-08-04

### WOBBUFFET was re-run, the tree moved under it, and the result is VOID — so ABRA now has no exploitability number at all

The re-run was authorised (*"rerun wobba"* … *"yes do the search once engine is all wrapped up"*) and
executed at full size: `engine/exploit.js --games 220 --rounds 24 --seed 90210`, 5,500 games, plus a
1,600-game held-out replay. **It produced no usable statement about MAG, because both things it was
measuring changed while it was measuring them.**

| what moved | when | why it is fatal |
|---|---|---|
| `data/policy-weights.json` — **MAG itself, the defender** — was refitted | `generated: 22:15:24.522Z` | the search froze the defender at **21:41**; the held-out replay reloaded the file at **22:17**. The two legs defended with different vectors |
| `engine/board.js` written | mtime 21:50:36 | mid-search, ~round 5. Every candidate is scored through `dmgMon` |
| `engine/medicham2-browser.js` — the simulator | **four distinct content digests across three sampling windows** 22:29–22:37: `0e4b2394edfc` → `e9a4215e13d4` → `d1a4e497c0e9` → moved again | every score goes through it. **It was still moving forty minutes after the run finished.** `data/policy-weights.json`, by contrast, has held sha `5a1930e8926af262` since the refit — the defender is settled, the simulator is not |

`data/engine-release.json` still does not exist, so DIVISIONS rule 1 remained a sentence rather than
a mechanism, and `engine/exploit.js` **stamps nothing** — no engine digest, no digest of the target
vector it read — so it could not detect any of this and did not.

**The old figure is retracted regardless of the re-run.** `docs/MODELS.md` called
~~**63.2%** [56.6, 69.3], mirror 47.5%~~ *"the most important number in the repo"*. It describes a
**17-feature** vector against the 58 we ship, on an engine 25 wire-fixes old, computed **before the
quality filter existed** — which is precisely why `provenance.js` carried it as its only `UNSAFE`
artifact. So the position after this session is *no number*, not *a worse number*. That is a real
loss and it is stated rather than papered over.

### Two findings survive, because they are about the tool rather than about MAG

**1. The attack dies in 58 dimensions.** `exploit.js` perturbs every coordinate by
`gauss() * scale * (|v| + 0.25)` and multiplies `scale` by 0.85 on **every** failure. At 17 features
it accepted **10 of 18** steps and ended at scale 0.164. At 58 features it accepted **1 of 24** and
ended at **0.0168** — the step *norm* is √(58/17) ≈ 1.85× larger for the same per-coordinate scale,
so round 1 threw the vector off a cliff (27.7%, the worst evaluation in either run) and the geometric
decay then ran unopposed. From ~round 10 the "challenger" was a near-copy of MAG. **A search that
takes one step is not a lower bound on anything**, so even on a still tree this would have returned
an uninformative null.

**2. `provenance.js` cleared the new artifact and should not have.** It now prints **0 UNSAFE** with
`exploitability.json` marked `ok`. The check is `mtime(artifact) < mtime(input)`; the artifact
(22:17:57) is newer than the weights file (22:15:24) by **153 seconds** while having been computed
from a version of it **34 minutes** older. An mtime test structurally cannot see this. The fix is not
in `provenance.js` — a generator must stamp the **content digest** of every input at the moment it
reads it, exactly as `run_stamp.sourceDigests()` already does for the leaf sources. **Consequence:
`provenance.js --strict` will pass and `data/exploitability.json` is still not quotable.**

### One thing that is clean and worth keeping

The held-out mirror control, at n=782 inside a single stable window: **49.7% [46.2, 53.2]**. That
retires a live worry — the 47.0% and 47.5% round-0 mirrors in the two searches are **noise at n=217**,
not a seat or pairing asymmetry biasing every other row. `mew.js`'s side alternation works.

### Changed
- `docs/SEARCH.md` — new §R8 with the timeline, the corpus (7,264 → 7,341 distinct clean teams,
  quality filter on, `--meta-teams` NOT used), five defects in `engine/exploit.js`, and the prepared
  re-run with three preconditions that must be verified by content and not by report.
- `docs/MODELS.md`, `docs/ROADMAP.md`, `docs/EXTERNAL-EVIDENCE.md`, `docs/PRIORITIES.md` — every
  citation of 63.2%/68.2%/60.2% struck through with its reason. PRIORITIES #18 re-stated as *not
  measured*, plus new #18a (`exploit.js` stamps nothing) and #18b (the provenance mtime hole).
- `data/exploitability.json` regenerated; `data/exploitability-holdout.json` added. **Neither is
  quotable.** The holdout's generator is not in `engine/`, so `provenance.js` does not enumerate it —
  it belongs inside `exploit.js` as a `--confirm` phase.

### Notes
- **Not applied, deliberately:** no fix to `engine/exploit.js`, `engine/provenance.js` or any engine
  file. Patching a tool mid-result is how a run silently invalidates itself, and the run still prints.
- `web/stadium.html` and `app/stadium.html` render the 63.2% struck through against
  `data/exploitability.json` and describe it as UNSAFE. That description is now wrong in a new way —
  the file is current and provenance calls it `ok`, and it is *still* not quotable. **WEB's item.**
- `docs/MEASURE.md` and `docs/WEB.md` also cite 63.2% and are their divisions' ledgers; flagged, not
  edited.

## [3.36.0] — 2026-08-04

### `test-wiring.js` — the guard this project's whole discipline rests on — had been skipping

`CLAUDE.md` names `tests/test-wiring.js` as the direct answer to the 2026-07-28 failures: it plays
real games and fails if a capability counter is zero, because *"a capability that cannot prove it ran
is assumed broken."* It needs a pokemon-showdown checkout, and when it cannot find one it skips
politely:

    test-wiring: set SHOWDOWN_PATH

`run-all` then reports a clean exit around the skip. **Six tests were doing this, and a checkout at
the pinned commit `20ad99f` was one directory up the entire time** — the fallback path was `/tmp/ps`
and this project runs on Windows. Run with the path supplied, all six pass and `test-wiring` prints
*every capability proved it ran*; nothing was broken. **That is the point.** The project's own central
lesson, pointed at its own toolchain: a skip is not a pass, and a guard that opts itself out is not a
guard.

The fix is not a better default in `champions_sim`, because **twenty files each wrote
`if (!process.env.SHOWDOWN_PATH)`** — one fact with twenty implementations. Fixing the loader would
have left all twenty *gates* still asking the env var and still skipping. `engine/showdown_path.js`
(new) resolves the sibling checkout, and **sets `process.env.SHOWDOWN_PATH` as a deliberate side
effect** so a spawned child inherits it without knowing the module exists. An explicit env var always
wins. **Eight previously-skipping tests now run: 113 assertions that had never executed.**

One of them, `test-effective-identity`, came back red on the new probe below — correctly — and is
declared with its reason rather than re-baselined.

### WIRE 71 — the rock fix landed on one weather branch of four

Weather is set four ways and each had its own branch: an ability on switch-in (Drought 899 uses,
Drizzle 3,075, Sand Stream 1,716, Snow Warning 1,561), a **move** (Sunny Day 588, Rain Dance 919,
Sandstorm 10, Snowscape 11), **mega evolution**, and a **punish** ability (the Sand Spit class).
WIRE 70, landed hours earlier by the weather audit, taught the *move* branch to read `extendsDuration`
off the rock. **The other three kept writing a literal 5.**

So a Torkoal holding a Heat Rock set **five** turns of sun by switching in and **eight** by clicking
Sunny Day. Same held item, same sky, two answers decided by how it arrived.

**The probe that found WIRE 70 was staged on one of the four routes and passed on that route.** Not a
weak probe — a correct probe pointed at one body, which is the same shape as the mega bug that ran at
56% of sides against 85% and passed a non-zero check. A tag with four consumers needs a probe per
consumer, or an assertion over the consumers as a set.

`tests/test-weather-duration.js` is the second: it asserts the **invariant** — for a given sky and a
given item, every route agrees — so a fifth route added tomorrow that hardcodes 5 fails without anyone
remembering to extend a list of four. The rule now lives once, in the exported
`weatherTurns(weather, item)`.

**The two vocabularies meet inside it**, which is why it could not be a one-line read at each site:
`extendsDuration.extends` holds MOVE ids (`sunnyday`), while `weatherSetter.weather` holds ENGINE
words (`sun`). WIRE 70's inline version compared the raw entry against `a.mv` — correct on the move
branch by luck of spelling, silently never matching on the other three.

**Small population, decisive effect.** 14 of 496 declared setters in the store carry the matching rock
— Damp Rock on a Drizzle body at 6.2%, Heat Rock at 2.2%, Smooth and Icy Rock at 0.0%. Three extra
turns of rain is most of a game, and no aggregate would ever have shown it.

**Two errors caught in review and recorded, because both are shapes that survive.** The first cut of
the punish branch read `m.item`, but `tg` holds the punish ability and `m` is the attacker — Sand Spit
would have run eight turns whenever the mon that *hit* it carried a Smooth Rock. And the probe's first
cut passed `{item: 'Heat Rock'}` to `buildMon`, whose override bag is keyed by **species**; the mon
silently kept its dataset default of Charcoal. Only the `ran` counter caught it — without that, a probe
measuring the wrong item reports a pass.

**Run against the pre-fix engine it fails 4 of 60**, then passes 60 of 60. The unit half alone would
not have caught the original bug — `weatherTurns` returns 8 whether or not the switch-in branch calls
it — so the probe builds a real Torkoal, runs the real `applyEntryEffects`, and reads the real field.

### Also

- **The mega weather branch did not route through `weatherId`.** It happened to carry the engine word
  today; a tag that ever spelled it `sunnyday` would have written a word no damage formula reads.
- `data/xatu.json` and `xatu.js` regenerated — 7,228 usable of 40,193 collected (18.0%), 364 species.
  Provenance's UNSAFE count is unchanged at 1 (`exploitability.json`, which the WOBBUFFET re-run
  regenerates) and possibly-stale falls 38 → 37.
- `web/status-data.js` rebuilt; `test-web-status` back to green.

---

## [3.35.0] — 2026-08-04

### Eight generators were writing `data/*` artifacts that no ledger had ever heard of

`tests/test-stadium-roster.js`'s third direction — the set of things that actually GENERATE an
artifact, read from `engine/provenance.js --graph` — was red on five generators and went red on eight
once the graph itself was fixed. `docs/MODELS.md` gains entries for **META-USAGE** (the model
`CLAUDE.md` itself calls *"the model CHOMP reads"*, 7,123 clean of 39,792 collected, two views it
refuses to choose between), **MOVE PRIORS** (295 species, 128,548 recorded clicks, declaring no game
count so the drift check cannot see it), **PORYGON2** (17 features, 3,898 self-play train games,
2,274 human test games — and six point estimates with **not one interval**, so *"beats material"* is
an ordering, not a result), **SPECIES SETS** (247 species, 7,175 open-sheet games, 85,992 sheets),
**COUNTERS** (1,081 tests across 11 archetypes, 61 clear a nominal 95% z and **ZERO survive
Benjamini–Hochberg**), **BRING PRIORS**, **CORES** (552 cells, median cell **9 games**, 5.8% decisive
against the 5% a nominal interval produces by construction) and **DYNAMICS**. `engine/bring_bias.js`
is declared a non-model with its reason. Where a model has no measured verdict the entry says **NOT
MEASURED** rather than describing it as working.

The guard was then proved to still bite end-to-end, WEB's way: a throwaway generator writing a
throwaway artifact was dropped in and check 5 rejected it.

### The provenance graph could not see seven artifacts, and two of them were UNSAFE

Three faults in `engine/provenance.js`'s write detection, each found by chasing the last:

- **`const` broke the path-indirection arm.** `const OUT = process.argv[3] || path.join(…)` put the
  keyword where an identifier was expected. `data/move-priors.json` — which nine files read — was
  credited to `engine/state_encoder.py`, which only READS it, instead of `engine/policy.js`, which
  computes it from the store. `state_encoder.py` opens no game file, so the behaviour clone was
  classed not-store-derived and **exempt from every corpus check**.
- **An assignment whose right-hand side is a read is not a writer.** Accepting `const` immediately
  credited `engine/fetch_smogon_stats.js` with generating `data/regulations.json` off
  `const r = JSON.parse(fs.readFileSync(…))` and a later unrelated `writeFileSync(file, r.body)`.
- **`named()` was a substring test.** `ladder.json` is a substring of `games.ladder.jsonl`, so every
  store reader was recorded as naming it — which credited `engine/refresh-site-data.NOARCH.py` with
  generating MACHAMP's hill-climb artifact (really `engine/ladder.js`) and hung a phantom
  `ladder.json` input on every generator that opens the store. `roles.js` inside `pokemon-roles.json`
  did the same across eight more.

The graph went **84 artifacts → 91, 57 store-derived → 60**. `data/bring-priors.json` was genuinely
UNSAFE and was regenerated: **n_sides 5,368 → 14,456**, and the format's mega rate had been measured
on **62 sides** and is now measured on **12,442** (`p_side_megas` 0.9355 → 0.8785).
`data/exploitability.json` is a false positive of the filter rule but a **true negative anyway** —
WOBBUFFET's 63.2% on 17 features against the 53 we ship, rendered on two stadium pages — and it is
deliberately **left red** rather than stamped clean. `provenance.js --strict` exits 1 on it.

### `data/slowking-playstyle.js` was a GURU run wearing the playstyle name, and the default did it

`engine/slowking_preview.py` took its output NAME from `TAG` and its MATRIX from `MATRIX_FILE`, which
defaulted to `guru-matchups.json`. Regenerated correctly: n_games 5,265 → **2,860**, archetypes 12 →
**8**, mixture → **Rain 0.81 / Setup 0.17 / FakeOutBalance 0.03**, greedy−Nash 0.0409 → **0.026
[−0.0001, 0.1498]**, triples 1,320 → **336**, and **the verdict flips** from *"substantially less
exploitable … non-transitive"* to *"no material exploitability gap … close to transitive."* The GURU
arm was re-run first and reproduces its own artifact bit-for-bit.

The fix is the default: the generator now **refuses** to write a `TAG`-named artifact from the default
matrix, a relative `MATRIX_FILE` resolves against the repo rather than the shell's cwd, and
`source_matrix` is derived instead of being the hardcoded literal `"data/guru-matchups.json"` — which
would have mis-stamped even a correct run. `engine/sanity_check.py` §5 and `tests/test-docs-current.js`
§1b were both passing while comparing two copies of the same wrong file; they now read the real one.
**The site's SLOWKING room still argues the withdrawn thesis and carries two typed literals (*"49, 37
and 15 games"*, *"1,320 candidate triples"*) that are now wrong — a WEB pass is owed.**

### `engine/train_value.py` silently discarded every forme-changed body

`idn()` normalises punctuation only, so `charizardmegay` never matched the bring list's `charizard`
and the event was dropped. Measured on 4,000 clean games: **21.7% of faints, 22.7% of damaging
events, 20.8% of all damage**, at least one discard in **96.5%** of games, **97.6%** of dropped
targets megas — and **88.9% of clean games ended with both sides still holding bodies.** Fixed by
giving `engine/mc_key.js` the verb it was missing (`mcKey.base`, `mcKey.bases`) rather than growing a
fourth hand-rolled resolver; it reads the `base` field already in `MC.mons`, returns a body id rather
than a table key (`floette-mega`'s base has no row of its own), and needs no `SHOWDOWN_PATH`.

**Dropped events 22.7% → 1.7%; games ending intact 88.9% → 26.3%.** Paired on identical held-out
states (1,445 games / 10,120 states): log-loss **0.6634 → 0.6520**, paired **−0.0114, 95% CI
[−0.0183, −0.0041]**; accuracy **59.72% → 61.47%**, paired **+1.75 pts, CI [0.50, 2.94]**; `hpDiff`
weight **0.169 → 0.377**. **Said plainly: both intervals clear zero and the effect is still inside
the 1.87-point split-half floor for an UNPAIRED comparison, and 61.4% is below the 66.92% in-sample
ceiling for this feature class and the live leaf's 67.97%.** A correctness fix, not a capability
change. A 1.7% residual remains, 1,613 of 1,625 of it Floette, filed to ENGINE as a dex-data gap.

## [3.34.0] — 2026-08-04

### The Stadium scored 100% on two guards while being unable to run

`web/stadium.html:423` carried `class="wd"` inside a **double-quoted JavaScript string**. The whole
inline block was a `SyntaxError`, so the page rendered its header and **nothing else** — no rack, no
stage, no controls. It was introduced by the commit that corrected PORY's coefficients: the
`<s class="wd" title="…">` inserted to preserve the retracted figures went inside a quoted string.
It was then published as an artifact and offered for review.

**Both guards passed throughout.** `test-stadium-roster` read the page as text and counted twelve
cabinets. `test-web-figures` scored it 100% traced. **Neither executes anything**, so a page that
could not run scored perfectly on both. Will found it by opening the URL — the same way, and the only
way, the 2026-07-28 failures were found.

`tests/test-web-parses.js` (new) parses every room's inline script, asserts its own scanner is not
silently reading zero blocks, and carries a negative test for exactly this bug.

### `app/` had seven rooms and `web/` had nine

`app/` is what GitHub Pages serves. `stadium.html` and `status.html` were built, tested, committed
and pushed — and never copied. They were done in two of the three places the umbrella `CLAUDE.md`
names, and the third is the one a visitor sees.

`test-site-sync.js` was green the entire time because it compared **one file**, `index.html`. **A
missing file is invisible to a check that compares two named files.** The room set is now derived
from `web/`, sidecar bundles included — `status.html` without `status-data.js` renders an empty board
with no error a visitor sees. It immediately found two more drifted rooms, `models.html` and
`tower.html`.

### Drift as a percentage was an age wearing a fraction's clothes

`1 − n(t₀)/n(t)` over an append-only corpus depends only on **elapsed time**. It is the clock
`docs/MEASURE.md` §5e had just removed from `test-site-data-fresh.js`, re-entering through the front
door — `pory-nn.json` failed its freshness check **on the day it was regenerated**.

Replaced with absolute power, printed beside every drift note: `ci_gain`, and
`max_shift = 2·0.5·√m/n`. Across all thirteen drifting artifacts the percentages span **4×** and the
power spans **2×**:

| artifact | drift | max shift |
|---|---|---|
| `war.json` | 48.6% | 0.83 pts |
| `guru-matchups.json` | 26.1% | 0.61 |
| `pory-nn.json` | 15.7% | 0.47 |
| `counterplay.json` | 12.8% | 0.42 |

**No artifact in the repository has enough missing data to move a proportion by one percentage
point**, against a smallest published split-half floor of 0.43. And since `max_shift = √f/√n`, the
same 15.7% moves 0.33 at n=14,000 — the treadmill ends on its own rather than being switched off.
The 10% trigger was deliberately **not** changed: power cannot see the distance from a headline to
its decision boundary, and `roles-eval.json`'s 0.6935-against-0.6931 is flippable by anything.

### `slowking-playstyle.js` is the wrong file, and the site renders it

`slowking_preview.py` takes its output **name** from `TAG` and its **matrix** from `MATRIX_FILE`,
which defaults to `guru-matchups.json`. So `slowking-playstyle.js` carries a payload byte-identical
to `slowking.js`, and `slowking-playstyle-eval.json` is byte-identical to `slowking-eval.json` —
5,265 games and 12 species-pair archetypes, where the real playstyle matrix holds **2,860 games and
8 playstyles**.

Regenerated correctly the **verdict flips**, from *"substantially less exploitable… non-transitive
(rock-paper-scissors)"* to *"no material exploitability gap… close to transitive."* `docs/MODELS.md`
already publishes the corrected numbers to the digit — **the docs are right and the artifact is
wrong**, the rare direction — so the 2026-08-02 withdrawal still rests on measured evidence.

### The roster guard needed a third direction, and it found four more

Comparing the page to the ledger and the ledger to the page catches a model in **one** of the two
files. It is structurally blind to a model in **neither** — which GURU was. The third source is the
set of things that **generate a `data/*` artifact**, read from `engine/provenance.js --graph` rather
than rescanned.

It found five undocumented models, of which two matter a great deal: `engine/analyze.js` →
**`meta-usage.json`**, the artifact `CLAUDE.md` itself calls *"the model CHOMP reads"*, and
`engine/state_encoder.py` → **`move-priors.json`**, among the most widely consumed files in the repo.
Neither has a ledger entry. The test is **left red** rather than made green with a false reason.

The rule separating a model from a pipeline step is written into the file: a **model** states
something about *Champions* that anything is meant to act on; a **pipeline step** states something
about *ABRA* — our own cost, coverage, calibration, corpus — or re-encodes a claim with a home
elsewhere. *If this number is wrong, who is misled?*

### Also

- **The banned-items list was incomplete by three items and three moves.** Rocky Helmet, Covert
  Cloak and Clear Amulet are `isNonstandard: 'Past'` — banned exactly as Assault Vest is — along with
  Silk Trap, Obstruct and Burning Bulwark. Replaced in the umbrella `CLAUDE.md` with a one-command
  check against `Dex.forFormat()`, because a hand-maintained list of four went stale unnoticed.
- **A test's `--fix` would have retrained two models to make itself pass.** `test-site-data-fresh.js`
  identified refits by the filename suffix `-eval.json`; it missed `nmf_roles.py` and `xatu.py`.
- **PORY's retraction cited bot-contaminated coefficients for ten days.** `1.256/1.544` come from the
  last run fitted on the *unfiltered* store; the clean filter landed two days later and they are
  `0.9943/1.4080`. The retraction survives — the intercept and turn terms are pinned at zero
  *structurally*, because emitting both perspectives cancels the gradient on any column identical
  across the two rows.
- **The ablation ran by accident.** Regenerating `pory-nn.json` varies representation and architecture
  separately: representation is worth **4.5×** what nonlinearity is worth, and a network *on top of*
  the rich representation is **worse** than the logistic. The best arm in the table is a logistic
  regression. Scope: this is the value net, not MAG's policy.
- `meta-usage.json` regenerated at Will's instruction, and `abra-meta.js` with it — a refresh that
  leaves its own downstream stale is half a refresh.
- The Stadium's marquee said *12 cabinets* while rendering 13; now derived from `MODELS.length`.
- `docs/TAGS.md` (new) names the flag/tag/param distinction formally, with the resolution order that
  determines what failure looks like, and Spicy Extract as the worked example for why consumers key
  off **params** and never tag names.

---

## [3.33.0] — 2026-08-04

### Corpus drift is measured in absolute power, not in percent — and `slowking-playstyle` is not a playstyle result

**The drift threshold was a treadmill by construction.** `data/pory-nn.json` was regenerated on the
current corpus and `tests/test-site-data-fresh.js` reported *CORPUS DRIFT 15.7%* the same day. The
store is append-only and collects hourly (clean games 5,269 → 7,123 in four days), so a percentage of
it is an AGE, not a fraction: a 10% threshold marks every artifact stale about a day and a half after
it is built, however often it is rebuilt. `engine/provenance.js` now prints an absolute-power line
beside every drift note — how many percentage points of 95% CI width the missing games buy, and a 2sd
bound on how far they could move the point estimate. Measured across all thirteen drifting artifacts
the percentages span 4× and the power spans 2×: `war.json` is missing **48.6%** of its corpus and can
move a proportion by **0.83 points**; `counterplay.json` at 12.8% can move it **0.42**, which is below
the smallest split-half noise floor this project has published (0.43). **No artifact in the repository
has enough missing data to move a proportion by one point.** The bound is `√f/√n`, so it shrinks as
the corpus grows — the treadmill ends on its own rather than being switched off.

**The 10% trigger is deliberately unchanged**, because `max_shift` still cannot see the distance from
an artifact's headline to its decision boundary — the thing that actually decided every row of
`docs/MEASURE.md` §5c's hand triage. The next rung is a declared `decision_margin`.

- **Added** `population_ceiling` as a declaration `provenance.js` honours, in the same convention as
  `not_store_derived`, `raw_store_ok`, `gate` and `games_requested`. It fixes the drift check's own
  measured false positive: `data/pory-eval.json`'s population is a strict subset (clean ladder games
  whose raw log exists AND names a winner — 5,456, not 7,123) and can never read below ~21% against
  the wrong denominator. The reader side exists; `engine/pory.py` must write the key on its next
  deliberate run.
- **Unchanged on purpose:** the quality-filter check (`data/counters.json`, UNSAFE for nine days) is a
  PREDICATE test, not a volume test, and no amount of power makes a differently-filtered artifact
  valid. Confusing the two is how a volume rule takes credit for a correctness rule's catch.

**`data/slowking-playstyle.js` has been a GURU result under the playstyle name since 2026-08-03.**
`engine/slowking_preview.py` takes its output NAME from `TAG` and its MATRIX from `MATRIX_FILE`, which
defaults to `data/guru-matchups.json`. Run with `TAG=playstyle` and `MATRIX_FILE` unset it writes GURU
under the playstyle filename, and that is what is on disk: `slowking-playstyle.js` has a payload
**byte-identical** to `slowking.js`, and `slowking-playstyle-eval.json` is a **byte-identical file** to
`slowking-eval.json` — 5,265 games over 12 species-pair archetypes, where the real playstyle matrix
holds 2,860 games over 8 playstyles. Re-running it correctly reproduces the figures `docs/MODELS.md`
already publishes (336 candidate triples, greedy−Nash 0.026 CI [−0.0001, 0.1498], mixture Rain 0.81 /
Setup 0.17 / FakeOutBalance 0.03) to the digit, so **the docs are right and the artifact is wrong**.
Not repaired here: it moves every figure the site's cycle panel renders, so it is a joint pass with
WEB. `engine/build-status.js:18`, `engine/sanity_check.py:32` and `tests/test-docs-current.js` all
read the clobbered file today.

- **Verified, not landed:** `data/engine-data.js` was reported 0.9 days stale;
  `build/rebuild_sets_from_sheets.js --write` reproduces it **byte-identically** (318 species, 195
  rebuilt, materially changed 0). The original mtime was restored, because bumping it turned
  `counterplay.json`, `scoreboard.js` and `winrate-backtest.json` into "older than its input" for a
  regeneration that changed nothing.
- **Fixed** `tests/test-site-data-fresh.js` printing `node engine/slowking_preview.py` as a repair
  command in its STALE table; the interpreter is now derived from the extension there too.

### `docs/MODELS.md` had drifted in three places, and a fourth report did not reproduce

- MAG's method line read *53 features / 6,091 games / 146,910 decisions (117,824 / 29,086)*. The
  artifact `data/policy-weights.json` carries **58** features and a `corpus` of
  **8,414 / 220,613 / 176,580 / 44,033**. A second heading two screens down said *56 features*, so the
  file disagreed with itself as well as with the artifact.
- MAG's corpus line read *198,157 usable decisions from 7,507 games*; the same artifact records
  **220,613 kept of 228,084 seen from 8,414 games**.
- SLOWKING's headline mixture (*Kingambit-Basculegion 0.84*), exploitability (*uniform 0.109*), named
  cycle (*Charizard-Venusaur → Whimsicott-Garchomp → Garchomp-Incineroar*) and gap CI (*upper bound
  0.27*) exist in **no file on disk**. Replaced with what `data/slowking-eval.json` says.
- **Did not reproduce:** the mechanics census. `data/mechanics-census.json` reads **102 live of 144
  probed, 42 missing**, `docs/ENGINE.md:15` already prints that, and `docs/MODELS.md` carries no
  census figure at all. Nothing was changed for the reported *42/54*.
- **Did not reproduce:** *"the site rendered GURU's 0.735"*. `0.735` appears nowhere in `web/` or
  `app/` except as Golurk's percentiles in the JOLTEON roster. The stale figure was in
  **`docs/SUMMARY.md`**, attached to a superseded 1,124-game / 11-archetype run; that row is corrected
  to the artifact's 5,265 games / 12 archetypes / **0.7124**, with the multiplicity arithmetic beside
  it. The verdict — worse than a coin — is the same under both runs.

### Added — GURU has an entry in `docs/MODELS.md`

The matchup matrix had no ledger entry, the same gap MILTANK had. It carries the honest state: a
12×12 = 144-cell matrix over **5,265 clean games** generated 2026-07-31 and now **26.1% behind**;
**6 directed / 3 distinct** decisive matchups of which **ZERO survive FDR at q=0.05 or Bonferroni**
(66 pairs, 3.3 expected by chance, 3 observed, smallest exact p **6.1e-3** against a BH threshold of
**7.6e-4**); a predictive test of **0.7124** against a coin's 0.6931 — **worse than a coin**; and the
`n_decisive` bug, in which `build_guru_js.js` read a
key that did not exist, recomputed the count from its own empty fallback and shipped *"ZERO
statistically-decisive matchups"* as a finding. It was **accidentally right by way of a bug**, which is
worse than wrong, because a conclusion produced by a broken path cannot be checked and licenses the
path. Not regenerated, deliberately — it moves every number the GURU booth renders.

### R2 and R3 stamp their configuration — and R3's published number turns out to have no control

R1 lost its result to a missing stamp: the published *"68.18% against material's 65.26%, +2.91
[1.79, 4.04]"* recomputes from the only committed evidence to **+0.456, 95% CI [-0.717, +1.630] —
UNDECIDED**, because a dump taken at `explore=0` and a dump taken at `explore=1` are byte-compatible
and differ by nearly four accuracy points. R2 and R3 had the identical hole. This closes it, and
finds two things on the way that matter more than the plumbing.

#### Do the published numbers reproduce?

| gate | published | recomputed from committed evidence | verdict |
| --- | --- | --- | --- |
| R2 | 477 boards over 200 games; 5.83 ms median at n=10 | affordability table reproduces to the digit (K=3 → 0.47 s / 1.75 s; K=4 → 1.49 s / 5.53 s) | derived layer **yes**; base layer **NOT CHECKABLE** |
| R3 | 72.9% over 70 decisions (19 agreed, 20 skipped) | 100 × (70 − 19) / 70 = **72.857142857142854**, bit-identical | **yes — and it is a tautology** |

Neither reproduction is worth much. R3's divergence is a pure function of two fields in the same
file; there are no per-decision rows, so "it reproduces" means only that the artifact is internally
consistent. R2 dumps no per-leaf timing, and a duration is not recomputable by anyone in principle —
it is a fact about a machine under a load, and nothing records the CPU, the node version or what else
was running. **R2 is re-run or it is nothing.** This is a different failure from R1's: R1's number was
wrong, these two are unfalsifiable.

#### R3's result is not interpretable as published

`engine/rollout_r3.js` computes the only control that makes a divergence rate mean anything — the same
search on a different seed disagreeing with **itself**, where the truth is 0.00 by construction — and
it prints it and does not write it. Its own verdict branches on that number (`rate <= floor` prints
NOT A RESULT), so `data/rollout-r3.json` cannot say which branch its own run took.
`docs/ROLLOUT-design.md` §5 publishes floors of 71.7 / 50.0 / 45.5 / 43.8% — for four earlier runs,
none of them the committed one. At N=20 that floor measured *higher* than the divergence.

The divergence is probably real: the floor fell as N rose, and this run used N=600. But *probably* is
an inference from a different run, and the Wilson interval on 51/70 is **[61.5%, 81.9%]**.
`engine/status.js` and `docs/MILTANK.md` both quote the 72.9%, and MILTANK.md spends it on a build
decision. The floor is now written into the artifact along with a `verdict` and `verdict_code`.

#### R2 timed a leaf the bot does not run

`rollout_r2.js` called `RL.rolloutWinProb` without `explore` or `maxTurns`, inheriting
`engine/rollout_leaf.js:197`'s `explore = 0` and `engine/medicham2-browser.js:1079`'s `maxTurns = 20`.
MILTANK's in-game leaf is **explore=1.0 at maxTurns=60**. R1's hole in cost form: two library
defaults, written down nowhere, deciding the number that the whole affordability table rests on.

#### And `data/rollout-r3.json`'s own caveat is false about the run it describes

It reads *"Switch candidates are excluded and counted"*. Commit `b4ec80b` deleted the
`if (ca.switchTo || cb.switchTo) continue;` line — switches went **on** the menu, which is what that
commit was for — and left the string alone. The `withSwitch` / `choseSwitch` counters it added were
printed and never written, so its headline ("4 of 12 when one is on the menu") lives in a commit
message.

### Added
- `engine/run_stamp.js` — one implementation of the sidecar `rollout_r1.js` hand-rolled inline, so the
  next gate cannot grow a second format. `writeStamp()` records N, explore, every knob including the
  ones left at a default, sha256 content digests of every source the gate reaches, the commit, and
  **whether the tree was dirty** — a clean commit id over a dirty tree is a lie of exactly the kind
  this exists to stop. `reconstruct()` infers a stamp for an artifact that predates all of this, from
  the commit that carried it, and marks itself `reconstructed: true` on every line.
- `data/rollout-cost.meta.json`, `data/rollout-r3.meta.json` — retrospective stamps. Both score HIGH:
  written 25 s and 159 s respectively before the commits that carried them.

### Changed
- `engine/rollout_r2.js` — `explore` and `maxTurns` are explicit, overridable and stamped, with
  defaults that preserve the previous behaviour exactly. `games` is now the distinct games actually
  traversed rather than the `GAMES` environment cap, which `status.js` had been printing as
  "over 200 games". Adds `n` / `n_unit`, `samples_per_n` (the quantile columns were not guaranteed to
  be measured over the same board set), `boards_traversed`, `leaf_config` and a `caveats` array.
- `engine/rollout_r3.js` — writes the noise floor, a `verdict` and `verdict_code`, the switch
  counters, and the disagreement-gap median from the same variable it prints rather than recomputing
  it at the write site. Caveat corrected and moved to a `caveats` array.
- `engine/status.js` — prints each gate's stamp, or its absence, under the gate line. It derives the
  sidecar path from `run_stamp.metaPathFor` rather than spelling it a second time, and stays quiet for
  an artifact that already carries its own `stamps` block, because a line that fires forever after the
  fix is a line people learn to skip.
- `caveats` is now an array on all four rungs. It was `caveats` on R1 and R4, scalar `note` on R2 and
  scalar `caveat` on R3 — three shapes for one idea. No reader breaks: `status.js` and
  `web/build-status.js` read only the count fields, `generated` and `verdict*`.

### Notes
- **Not renamed:** `data/rollout-cost.json` should be `data/rollout-r2.json` — it is the only rung
  whose file does not carry its gate's name. Four readers, three of them under `web/`, which MEASURE
  does not own. A rename that misses one prints NOT DERIVED and reads as "nobody ran this". Needs WEB
  in the same pass.
- **Not corrected:** `docs/ROLLOUT-design.md` §5's "roughly 200x the simulated turns per millisecond"
  is **155x** by the arithmetic of the two artifacts it cites, and 155x is itself a ceiling because it
  assumes no playout ends early. SEARCH's document, and a SEARCH sweep is live. `rollout_r2.js` now
  prints the division rather than a remembered figure.
- **Not fixed:** `n` / `n_unit` on R1 and R4 (one line in each generator); `rollout_r1_join.py`'s naked
  Python `isoformat()`, which JavaScript reads four hours early; `engine/rollout_r1.js` calling
  `run_stamp.js` instead of its inline copy — SEARCH holds that file.
- Neither R2 nor R3 was re-run. Every figure above is arithmetic over committed evidence.

---

## [3.32.0] — 2026-08-04

### Leaf calibration, re-measured: the leaf the search actually uses is WORSE than a coin

`data/winrate-backtest.json` said *"MEDICHAM does NOT beat coin; does NOT beat Elo"* off 350 games at
40 rollouts, dated 2026-08-02. Four things were wrong with it, and none of them was the leaf.

1. **It scored a leaf no live decision calls.** It measured `winProb2` — `battle()` at MEDICHAM's
   default 20-turn horizon with entry effects re-fired. MILTANK calls neither. Its team-preview leaf
   is a greedy playout at `maxTurns=60 / seeded:true`; its in-game leaf is
   `rollout_leaf.rolloutWinProb` at `explore=1.0 / foePolicy=uniform / maxTurns=60`.
2. **It was stale and nothing said so.** `engine/medicham2-browser.js` moved 2026-08-04 04:47 across
   22 commits, one of which records that 45% of rollouts had been on an illegal board.
3. **n=350 could not carry "does not beat a coin".** The 95% interval on 52.63% over 342 decisive
   calls is ±5.3 points. Absence of evidence was reported as evidence of absence.
4. **MEDICHAM and Elo were compared on different samples** — 350 games against 238.

`engine/backtest_winrate.js` now builds a real turn-0 `board.js` Board from the brought teams and the
real leads, hands it to `rollout_leaf` (no second body builder — LESSONS 8), scores three leaves on
identical positions, and publishes a **reliability curve with counts and Wilson intervals per bucket**
instead of a verdict string. Every comparison is paired with a bootstrap CI. n is set by a power
calculation printed before the run: detecting the prior 52.63% effect at 80% power / α 0.05 needs
n=2,835, so the full clean corpus (6,886) is used and the held-out fifth (1,378) is reported beside it.

| leaf | n | Brier vs coin, paired | discrimination | says 90-100% → wins |
| --- | --- | --- | --- | --- |
| in-game, 200 rollouts (held-out) | 1,378 | **+0.0502 [0.0371, 0.0628]** | 50.99% [48.3, 53.7], p=0.47 | 53.6% (n=56) |
| in-game, 40 rollouts (full clean) | 6,886 | **+0.0466 [0.0407, 0.0523]** | 51.80% [50.6, 53.0], p=0.004 | 53.5% (n=344) |
| team-preview, 40 rollouts (full clean) | 6,886 | **+0.0740 [0.0668, 0.0813]** | 53.22% [52.0, 54.4], p<1e-4 | 55.3% (n=933) |

Positive is worse. All three lose to a coin and to player-Elo, decisively and on paired intervals
that exclude zero. The curve is close to **horizontal**: the in-game leaf's 0-10% bucket also wins
53.8%. The preview leaf puts 25.6% of its predictions in the two extreme buckets and is wrong there
by about 40 points. **Confidence carries no information; the search is maximising a number that is
flat.** LESSONS 2.

**Not an engine regression.** The legacy `winProb2` path reproduces the old artifact closely
(held-out log-loss 1.0243 against 1.0748 published, discrimination 51.94% against 52.63%), so the 22
engine commits did not move the headline. Two independent full runs of that arm differ by 0.26
accuracy points on n=6,886, which is the run-to-run noise floor for this instrument; every seeded
config reproduces bit-identically.

Also fixed, all in the same file: the "temporal" split was cutting on **store append order**, and the
store has 4,775 date inversions — it is sorted by date now. A side-symmetry witness scores 400 boards
from both sides and reports mean(p1+p2−1) = −0.0099, so no side advantage is contaminating the result.

**The artifact now stamps the sha256 and mtime of every source the leaf reads**, and `engine/status.js`
re-hashes them and prints `CURRENT` or `PRE-CHANGE` — a comparison, not an mtime inference. The store
is reported separately from the engine sources: an append-only corpus growing means more power is
available, not that the number went stale, and a flag that is always on is a flag nobody reads.

Per-game predictions are kept in `data/winrate-backtest-rows.jsonl` so the curve can be re-cut without
re-running 17 minutes of rollouts. `MAXG` thins the corpus for a smoke run and the artifact records the
n it actually scored.

**Filed, not fixed** (MEASURE does not touch a search knob — DIVISIONS rule 2): the horizon is the
first suspect. `battleResult` falls back to bodies-then-HP whenever a playout does not finish, so a
confident leaf reading can be a material count wearing a probability's clothes.

### R1's published PASS is withdrawn. It had no artifact, and the evidence that survives says UNDECIDED

`docs/ROLLOUT-design.md` published *"R1 — PASSED ON THE BASELINE. 9,201 positions, fully random
playout: rollout 68.18% against material's 65.26%, +2.91, 95% CI 1.79 to 4.04."* `engine/rollout_r1.js`
printed that with `console.log` and wrote **no artifact for it**. Meanwhile `data/rollout-r1.json` —
the file `engine/status.js` read and labelled "R1 leaf accuracy" — held the 230-row cross-language
join that the same design doc records as **withdrawn**. So the gate reported a withdrawn result while
the real one had no file at all. The identical defect `status.js` already called out for R4, one gate
above it, undetected for longer.

Recomputed from the one committed input, `data/rollout-r1-rows.jsonl` (9,201 rows), with the formulas
in `rollout_r1.js`:225-272 and no re-run:

| judge | accuracy | Brier | log-loss |
| --- | --- | --- | --- |
| coin (= the base rate) | 52.46% | | |
| material, porygon2 form (graded) | **65.26%** | 0.2127 | 0.6124 |
| ROLLOUT, the dumped column | **65.72%** | 0.2573 | 1.7674 |

**+0.46 points, 95% CI −0.72 to +1.63. McNemar on 3,034 discordant positions (1,538 / 1,496).
UNDECIDED by `rollout_r1.js`'s own thresholds** — the interval spans zero.

The material column reproduces the published 65.26% exactly, so it is the same 9,201 positions. The
rollout column is a different rollout: its reliability bins reproduce §4.2.1's **greedy** saturation
table count-for-count (2,245 at 26.0%, 2,612 at 75.9%), so the surviving dump is the `explore=0`
incumbent, not the fully random playout the verdict was computed from. `mpy` is deterministic given a
position, so a matching material accuracy proves the same **sample**, never the same **run**. The
generator asserts that comparison against the design doc rather than restating it.

**The published 68.18% cannot be recomputed from anything committed.** It is retracted as
*uncheckable*, not as *wrong*, and the sentence is kept verbatim in `ROLLOUT-design.md` §5.

The cause is a missing stamp, not a bad number. The dump recorded neither `N` nor `explore` nor any
build digest, so two runs four accuracy points apart were byte-indistinguishable.

### Added
- `engine/rollout_r1_artifact.js` — recomputes R1 from the row dump and writes `data/rollout-r1.json`.
  Arithmetic only: no engine, no Showdown, no weights, because the engine is a fact about how the rows
  were produced and not about how they are counted. It records the reliability curve, a three-cut
  split-half floor (spread 0.43–2.01 points against an effect of 0.46 — the effect is inside its own
  noise floor) and `stamps: null` with the reason, rather than hashing today's sources and implying
  they describe the run.
- `data/rollout-r1-rows.meta.json` — a sidecar `rollout_r1.js` now writes beside every dump, carrying
  `N`, `explore`, the sweep and content digests of every source the leaf reaches. A sidecar and not a
  header line, because `rollout_r1_join.py` parses every line of the dump as a position.

### Changed
- `data/rollout-r1.json` is now the recomputed gate result. The withdrawn join moved to
  `data/rollout-r1-withdrawn-join.json` with `withdrawn: true` and its reason as a field. A withdrawn
  result must stay readable — a prior conclusion is never silently rewritten — but it must never be
  what a gate reads.
- `engine/rollout_r1_join.py` writes the withdrawn name, sets `withdrawn` from its own alignment
  check, and can no longer claim the gate's filename.
- `engine/status.js` prints R1's verdict the way it prints R4's, and **refuses to print any artifact
  carrying `withdrawn: true`** whatever it is called. It also prints which rollout the dumped column
  is, because that changes how the verdict reads.

### Fixed
- `rollout_r1.js` dumped `ps[N_LIST[last]]`, but the sweep keys become `${n}@${explore}` as soon as
  `EXPLORE_LIST` holds more than one value — so under an explore sweep the lookup returned `undefined`,
  `JSON.stringify` dropped the field, and every dumped row lost its rollout column silently. It now
  uses the same key the verdict does.

### Notes
- `--rollout-explore` still defaults to `1.0`, and `engine/rollout_leaf.js:147`, `engine/mag_bot.js:145`
  and `docs/MILTANK.md` all cite 68.18% as the reason. That default now rests on the MCTS literature and
  on the saturation table, not on a measured head-to-head. Filed to SEARCH; not changed here.
- R2 and R3 have the same missing-stamp hole. Neither `data/rollout-cost.json` nor `data/rollout-r3.json`
  records the build it measured, so neither can be checked against one.
- `engine/provenance.js` cannot see `data/rollout-r1-rows.jsonl` as an input — its scan covers `*.json`,
  `*.js` and `games.*.jsonl` — so the artifact carries the dump's sha256 instead.

---

### The differential count was never reproducible, and Rage Powder deletes the attack

`engine/status.js` printed *"6/120 differential comparisons disagree"* as an artifact-backed figure.
The sampler used bare `Math.random()`; two runs on identical source gave **6, then 3**. It is now
seeded (`--seed`, default `20260804`) and consecutive runs are byte-identical. Found while seeding:
`argv[argv.indexOf('--seed')+1]` reads `argv[0]` when the flag is absent, so the harness printed
`seed NaN` while quietly running seed 1 — the silent default this project bans. `argInt()` now exits
non-zero on a bad flag.

**Five of the six open differentials were HARNESS bugs, not engine bugs.** The hypothesis that they
shared a spread-move `0.75x` cause is **refuted**: the ratios cluster at **1.50**, not 1.33, and the
`0.75` cancels on both sides because `moveHit` enters at `spreadMoveHit` and never sets `spreadHit`.
The real causes were Intimidate and Sand Stream leaking through Showdown's switch-in, unpinned
`gender` handing Rivalry a seed-dependent 0.75 that no engine could match, and `moveHit` skipping
the ability's `onTryHit` so Water Absorb never fired — meaning the harness reported MEDICHAM's
**correct** 0-0 into Vaporeon as the engine's bug. Each fix was judged by driving its target case to
`rel 0.0%`, not by inspection. Seeded residual **4/400 (1.0%)**.

**Tag walk: 88 probes written, 40 red. Census 42 → 90 live. Coverage 53/176 → 137/176.** No
previously-live probe fell.

~~The worst thing found is redirection, 7,240 uses: the attack VANISHES.~~ **WITHDRAWN THE SAME DAY —
the probe was wrong, not the engine.** It aimed **Dragon** Claw at **Whimsicott**, which is
Grass/**Fairy** and immune to Dragon: Follow Me fired correctly and landed the attack on a body that
takes exactly zero, so both arms read 0. Re-staged with Milotic the same unmodified code reads
`aimed 0 / redirector 101`. **Redirection works and always has; nothing was invalidated.** The real
gap was `redirectsType` — Lightning Rod and Storm Drain, **1,901 uses** — where the engine only ever
looked for the Follow Me volatile. Fixed. Left in place rather than deleted because a prior
conclusion is never silently rewritten.
(Note this does **not** contradict 3.31.1 below, which measured the *fit's* unmatched clicks over
real games and is unaffected by a rollout defect — but any rollout-based claim touching redirection
is now suspect.)

Behind it: `drain` 8,553 uses (*"dealt 51 to the foe; user 85 → 85 hp"*), `choiceLock` 5,886 — **not
unimplemented**, `board.js` passes its own test, so two engines disagree about a fact — `multiHit`
4,655 priced as a single hit, and `fixedDamage` 1,122 where `mv.bp=0` makes Seismic Toss worth
literally zero.

**Six probes were wrong before the engine was**, each caught by its own control: a spread move where
single-target was needed, Close Combat at a Ghost, Toxic at a Steel, Fly from a slower body, Protean
tested with a type it already had, and a redirect probe with no control arm. That is the probe-first
rule paying for itself.

### WEB — a fifth division, and ten numbers on the site that were not true

`web/` had no owner. ENGINE, MEASURE, SEARCH and OPS are cuts on the **model's** invalidation graph
and a website is not on that graph, so site work fell to whoever was holding it. WEB is the **leaf**
— everything flows in, nothing flows out — which is why it gets hands on its own files and none
anywhere else, and why its restriction is about authority rather than tools: **it renders numbers and
never authors one.**

Added `web/stadium.html` (ABRA STADIUM — a Pokémon Stadium 2 model-select screen, one cabinet per
model, each carrying its real figures **and its honest caveat**) and `web/status.html` (the STATUS
BOARD, built by `web/build-status.js` into a script-tag global rather than `fetch()`, because under
`file://` a fetch of a local JSON is CORS-blocked and returns nothing **with no error a visitor
sees**).

Ten rendered figures did not match their artifacts and were corrected: GURU `0.735 → 0.7124`, XATU
`36%/72% → 29.8%/65.6%`, open-sheet entries `60,852 → 85,992`, SLOWKING `"11–18 games each" → 49, 37,
15` with the artifact's own `supported: false` now on the page, resist berries `16 → 18`, the RPS
cycles downgraded from *"the proof"* to *"the hypothesis"*, and *"for the real read, play it out with
MEDICHAM"* replaced by the measured verdict. Four stale hardcoded fallbacks now render **NOT
MEASURED** instead of a plausible wrong number.

`tests/test-stadium-roster.js` compares the cabinet rack against `docs/MODELS.md` and failed on its
first run: **MILTANK — the search player that owns the R4 result — had no entry in the per-model
ledger at all.** Added.

### External evidence, recorded as priors and never as findings

`docs/EXTERNAL-EVIDENCE.md` (new). Three independent sources now say search beats a search-free
policy in Pokémon: R4's 55.5%, PokeTransformer's ~1900-vs-2300 ELO, and the PokéAgent Challenge
reporting that *"the top participants all used RL or MCTS rather than LLM reasoning."*

Two corrections came out of it, both against ourselves:

- **"More features did not help a linear model" is NOT evidence that "a nonlinear model would not
  help."** ABRA's four feature nulls were measured on a linear conditional logit, which cannot
  exploit interaction structure however good its features are. Only the first claim has been tested;
  the second was being treated as settled.
- A claim written in this file at 03:00 — that Gen9 VGC Reg I ships with a 4M-trajectory dataset and
  30 pre-trained agents — **was wrong and is corrected in place**. Metamon excludes VGC entirely; the
  only VGC-inclusive dataset is `pokechamp`. Two true sentences were joined into a false one.

Filed from it: an audit of whether `board.js` leaks later-revealed information into the fit (the
Metamon "spectator point of view" problem, against 146,910 fitted decisions); a re-measurement of
exploitability, since greedy-over-sampling shipped for +12 points and makes the policy **more**
deterministic while WOBBUFFET's 63.2% is three feature generations stale; and **downside-aware
selection** — MILTANK argmaxes the **mean** rollout value, so it cannot tell a flat 60% line from a
90% line that loses on the spot, despite computing the whole distribution and discarding everything
past the first moment.

Also written down for the first time: real VGC allows **45 seconds per decision** on a 7-minute
clock. That is MILTANK's live budget and R2's leaf cost has never been checked against it.

### Housekeeping

- Three dead git worktrees removed (`ABRA-old21`, `ABRA-prefeat`, `ABRA-tagsoff`), 273 MB. All were
  clean and fully contained in `main`. They were **worktrees, not clones** — `rm -rf` would have left
  stale registrations in `.git/worktrees`.
- `engine/status.js`, `docs/DIVISIONS.md`, `docs/LESSONS.md` and the four division agent files were
  **untracked**. `CLAUDE.md`'s first instruction pointed at files a fresh clone would not have.
- 46 commits were unpushed. `data/rollout-r1-rows.jsonl` — R1's only evidence — and the
  `data/train-doduo*/` weights behind four published CHANGELOG 3.31.0 figures were untracked; both
  committed, with the regenerable self-play blocks gitignored in negation form so the rule reads the
  way it behaves.

---

## [3.31.1] — 2026-08-02

### The 23% drop was never redirection, and measuring first is the only reason we know

Three documents, the roadmap and `fit_policy.js`'s own caveat all said the clicks the fit could not
match were "mostly redirection (Follow Me, Rage Powder)". Nobody had measured it.
`engine/redirect_audit.js` (new) did, over 7,454 games and 86,242 two-slot turns:

| | |
| --- | --- |
| joint turns dropped as unmatched | 19,995 (**23.18%**) — reproduces the shipped fit exactly |
| ...with a redirector up for them | **319 (1.60%)** |

Redirection *cannot* make a click unmatchable. The protocol emits no `-activate` line for a redirect
and prints only a move's **resolved** target, so the redirector is a legal candidate: the matcher
finds it and accepts the click **with the wrong label**. That is real, small (**1.55%** of all
clicks), and unrecoverable — the chosen target was never written down by anyone.

**The roadmap item proposing a `board.js` change for this is void**, and so is its second argument:
`engine/collinearity_joint.js` (new) shows `redirectThenAttack`'s −0.405 is not split credit
(VIF **1.2**), and humans pick that pair only **1.09x** the base rate among the same alternatives.

### What the drop actually was — three defects, one shape

`engine/click_match.js` (new) is now the single reader of "whose moveset is this, and which candidate
did they press", replacing the same three lines in seven files. By share of failures:

- **44.4% — the foe switched in that same turn.** Switches resolve before moves, so the protocol
  records the mon that *arrived* while the human was choosing against the one that *left*. A human
  aims at a SLOT; the store records a SPECIES.
- **19.7% — an in-battle forme change with no sheet entry.** `floette` 3,627, then `aegislashblade`,
  `palafinhero`, `mimikyubusted`, `morpekohangry`. The forme problem, in a third table.
- **16.4% — a mirror collapsed the two team sheets.** Species Clause is per PLAYER, so
  `sheet[base(species)]` overwrote one player's set with the other's. **58.63%** of corpus games carry
  a species on both sheets, **8.02%** of all slots were scored against the opponent's four moves, and
  **62.16% of those matched anyway and were fitted against the wrong choice set** — a wrong
  denominator that nothing counted.

Same replays scored twice: usable joint turns **76.80% → 94.52%**; slot match rate **87.2% → 97.2%**.

### Both vectors refitted and shipped, the marginal one SPRT-gated

- **Marginal:** 176,981 → **196,803** usable decisions (+11.2%); unmatched clicks **2.94%**.
  Head-to-head against the incumbent, both arms greedy, arm 1 the challenger: **58.4% of 238 decisive
  pairs**, DECIDED at 219 by `engine/sprt.js`, with `paired_h2h.js` agreeing 139/139 and 99/99.
  Stopped at 2,750 games of 20,000 — **17,250 saved**.
- **Joint:** 66,236 → **81,515** usable turns. **Zero sign flips across all 74 weights**, 12.0% L2
  movement, held-out pair top-1 12.2%. Shipped on correctness: it is opt-in (`--joint`) and not on the
  default play path, so no machine time was spent on its H2H.
- `RANKER_WEIGHTS` / `OUT_JOINT` let a candidate pair vector be fitted against a candidate marginal
  one without overwriting either incumbent, and the joint artifact now **records which ranker built
  it** — the top-K cap is taken by the single-move score, so that pairing was previously implicit.

### Guards

- **`tests/test-click-match.js`** — 23 assertions, each built from a measured defect, and each also
  asserting the OLD lookup fails. A test that passes before and after proves nothing.
- **`tests/test-degradation-budgets.js` did the other half of its job.** Built last session to record
  rates, it tonight *refused to pass* when two new counters appeared without ceilings. Ratcheted:
  `fit_joint.turnsDropped` **23.2% → 5.49%**, plus `fit_policy.unmatchedClicks` 2.95% and
  `fit_policy.decisionsDropped` 3.30%.
- **`tests/test-site-data-fresh.js` caught a regression as it was introduced.** Routing `fit_joint`'s
  write through an `OUT` variable hid its generator from the provenance scan, which pairs a filename
  with a write call on ONE line. It reported the new orphan at once — and that exposed the same blind
  spot on `data/policy-weights.json`, baselined as "no generator" ever since `OUT_WEIGHTS` was added
  to `fit_policy.js`. **The shipped model file had no discoverable way to rebuild it.** Both fixed,
  orphan list 7 → 6. The scan was not loosened.

### `engine/joint_rows.js` — the replay loop lives in one place

Extracted from `fit_joint.js` so that asking a question about the pair fit does not mean writing a
fourth copy of it. Verified against the shipped artifact's own tally: 86,242 seen, 66,236 kept,
19,995 unmatched, 11 ambiguous. It needs `--max-old-space-size=4096` — the corrected matcher's extra
rows walk Node's default 2GB heap into an OOM that looks like a crash rather than a limit, now
recorded in the header.

### `build/omnibus.py` no longer reports success when it produced nothing

It printed `FAILED` and exited **0**. It now exits 1, prints to stderr, and names the headless-Chrome
command that works. WeasyPrint's `libgobject` breakage is unchanged — that is an environment problem;
a build step lying about it was a code one.

### Corrections to the record

- **"Total variation distance 54.8%, every top species under-represented" does not reproduce.**
  `realism_report.js` on the current self-play store (MAG vs MAG, both greedy) gives a **3.0-point**
  mean absolute gap over the top 12, with **four of twelve over-represented**. The metric behind 54.8%
  could not be found in the repository. The deduplicated team pool is a *documented deliberate choice*
  (`mew.js:270-301`), not an oversight.
- **The large realism gaps are mechanical**, in the category that report labels "fix these": Protect is
  **23.2%** of MAG's moves against a human's **13.8%**; games run 12.28 turns against 8.13; moves
  outright fail 5.6% against 2.5%.
- **Greedy, not the missing opponent model, causes the conditional-move failures.** Sucker Punch:
  greedy 47.9% failure, **sampling 33.2%**, human **33.9%** — at identical usage. Baneful Bunker
  37.3% → **17.6%** against human 17.5%. Greedy takes the argmax every time, so a condition-dependent
  move gets clicked in all the spots where it whiffs. **This corrects a claim made earlier in the same
  session** that the 48% figure priced the absent opponent model; it does not. Protect is the mixed
  case — greedy explains about half the excess (219.7 → 165.5 per 1,000 moves), the rest is the
  weights, still 1.44x human.
- **`partial_bring` deletes a third of the self-play corpus, and it is a MAG symptom.** Dropped games
  average 8.55 turns and 2.86 switch events against kept games' 12.28 and 4.25: MAG under-switches, so
  fewer of its team are revealed, so the filter bins the game — biased toward short decisive ones. It
  also inflates the metric it is read from: across all self-play games the mean is **10.98** turns,
  not 12.28.

---

## [3.31.0] — 2026-07-31

**The first tagged release.** Both the engineering review and the systems audit noted that nothing
existed to roll back to. `v3.31.0` is that point. It is tagged with one test failing, named below,
because a rollback point that waits for a perfect tree is a rollback point that never exists.

### DODUO can be trained for winning
The 18 coordination weights had only ever been fitted to predict a human click. `train_policy.js
--joint` now moves them by whether the game was **won**; `--joint-only` freezes the 56 singles so the
whole trust-region step reaches the block under test.

- The pair softmax gradient is the concatenation `[xa + xb, jf]` — the two single vectors summed
  (both scored by the same single block), then the pair terms. `accumulateLogitGrad` was already
  generic, so no new mathematics was required. Vector length **74 = 56 singles + 18 pair terms**.
- **Four faults would each have produced a plausible, wrong learning curve**, all caught by checks
  rather than by reading: a run gradient sized from the single weight file and summed with
  `k < GRAD.length` (74 truncated to 56); `learnGrad` allocated before `this.wj` loaded; a hardcoded
  joint-weights path that made every iteration replay the frozen fit; and a preflight gate that
  indexed only `B.FEATURES`, certifying a joint run without checking the block it exists to train.
- **The trust region starved the pair block**, structurally rather than by mistuning. The first run
  (48,691 games) moved it 4.7% while the singles moved 21.7%. Single features appear in nearly every
  choice set; pair features are sparse, so they lose the shared budget by construction and more
  iterations scale both equally. With `--joint-only`: **40.0%**, and three sign flips —
  `overkill` −0.951 → +0.980, `focusFireKills` −0.107 → +1.094, `partnerCoversMe` −0.004 → +0.639,
  with `bothSameTarget` 0.031 → 2.249. The imitation fit penalised focus fire; training to win
  reverses it.
- **No win rate is claimed.** The head-to-head is running; nothing about winning has been measured.

### Every artifact is quotable again — 26 UNSAFE → 0
Both reviews independently reached the same item: wire `provenance --strict`, or waive by name.
Waiving 26 things is a promise to forget, so 25 were regenerated by re-running their own generators
and the last by fixing what the gate was actually complaining about. Two real bugs were underneath:

- `illusion.json` carried a sound RAW-STORE-OK justification **in its generator's source** that never
  travelled to the artifact, where provenance deliberately requires it. It is now stamped by reading
  the generator's own header rather than retyped.
- `archetypes.json` declared 10,538 games against 5,269 clean. The data was always clean; 10,538 is
  exactly 2 × 5,269 — **team sides**, two per game, reported as `n_games`. Every share and silhouette
  in that file had team sides as its sample size while the label said games.

A false-positive class in the checker was also fixed: a generator writing two artifacts in sequence
left the first permanently "older than its input" the second, a complaint no regeneration can satisfy.

### Speed multipliers are cross-checked (systems audit R2)
`board.js` derives them from the dex; `medicham2-browser.js` hardcodes them; nothing compared the two.
`tests/test-speed-multipliers.js` — **15 passed, 0 failed** — compares behaviour as ratios, and
compares the *sets*, so a new weather-speed ability in the dex cannot hide behind four passing
constants. The constants are correct today; that was never the finding.

### Reporting discipline (thesis defence)
- **Multiplicity correction now reaches the reader.** The script had been run since 14:04 and its
  result appeared in no reader-facing document; the only Benjamini–Hochberg text anywhere was about
  a different family of tests. Now stated where the weights are: 56 features, ~2.8 clear zero by
  chance, **53 uncorrected / 53 FDR / 49 Bonferroni, none lost**, family named.
- **`PUBLICATION.md` still cited the retired NMF justification** ("recon-err 0.53", "coherence is
  next") — the two phrases the defence ordered removed. The honest disclosure was in `SUMMARY.md`
  while the retired one was what would have been published.
- **A test asserted a count where it meant a direction.** `sanity_check.py` required Sun > 1000
  teams; Sun is the third largest of eight styles. Now relative, and mutation-tested.
- **`meta-nash.json` has no generator** anywhere in the repository. Rather than fabricate a date it
  carries the git add date, explicitly labelled as such, and a statement that it must not be quoted.

### Known failing at this tag
`tests/test-mag-page.js` — `app/index.html` assigns 21 of 56 features, so the site scores positions
the bot did not. Pre-existing, honest, and visible. Suite: **42 passed, 1 failed, 1 skipped**;
`sanity_check.py` 96 passed, 0 failed; `provenance --strict` green.

---

## [3.30.0] — 2026-07-31

### Every fix and recommendation from the three reviews

**`validate_damage_sim` was red, and the engine was never wrong.** ADR-001 step 3 blocked on 2 of 36
scenarios where the simulator's maximum damage was exactly **double** the calculator's with matching
minima. Diagnosed: the harness probes damage twice (`lo = dmgAt(15)`, `hi = dmgAt(0)`) against the
**same defender**, and a resist berry (Colbur, Chople) applies through `onSourceModifyDamage` and
**consumes itself**. The first probe ate the berry and came back correctly halved; the second ran
against a defender holding nothing. The reported range was `[halved_min, unhalved_max]` — a min/max
ratio of 0.42 where sixteen damage rolls can only give ~0.85. Same class as the crit leak the file
already documents: per-call state on a reused object.

```
before   within-5%  97%   worst 100%   FAIL
after    within-5% 100%   worst   2%   PASS — the wiring is sound
```

### Multiplicity correction — `engine/weight_multiplicity.js` (new)

The thesis defence: 56 features are reported with individual 95% intervals and **~2.8 clear zero by
chance**; no correction existed anywhere. Now measured, family named as the whole shipped vector:

| test | survives |
|---|---|
| uncorrected | 53 |
| Benjamini–Hochberg (FDR) | **53** — nothing lost |
| Bonferroni (FWER) | 49 |

The four that only Bonferroni drops: `killsThreat`, `priority`, `switchDiesFirst`, `switchSurvives2`.
Never significant: `allyHit`, `volatileOnFoe`, `tgtDefenseStage`.

### NMF rank — the disclosure the defence required

`SUMMARY.md` advertised *"6 clean archetypes (recon-err 0.53)"*. Reconstruction error **cannot select
a rank** — `nmf_rank.py`'s own caveat says so. The criterion it does use (bootstrap factor stability,
Brunet et al. 2004) selects **rank 4**, and **rank 6 scores −0.107 excess over null**: less
reproducible than factors fitted to shuffled data. Row now reads ⚠️ **Rank not defensible**.

### 48.1% reconciled against 55.9%

Both stand as measurements of **different configurations** — 55.9% on 53 features with switching off,
48.1% [46.5, 49.8] on 56 with switching on, over 9,728 paired games. Neither generalises to "self-play
helps". Three candidate causes named and untested.

### The bring phrasing the filter mandates

`require_full_bring` conditions on game length: measured, the games it keeps are **1.71× longer**
(7.4 vs 4.3 mean turns, 19,589 kept / 8,713 dropped). Every bring statistic is *"the bring, among
games long enough to show it"*. Now stated in `SUMMARY.md` and the white paper, as
`quality-filter.json` has always required.

### Gates wired

- **`validate_damage.js`** — the golden master against `@smogon/calc`, previously **not in the
  suite**. The coverage assertion missed it because it detects checks by *output format*; widened to
  recognise a gate by behaviour, then narrowed after the first version matched 36 files.
- **`validate_damage_sim.js`** — found by that widening.
- **`provenance.js --strict`** — both the systems audit and the engineering review found it
  independently: correct, complete, wired to nothing. **It is red at 31 artifacts.** The fix is to
  regenerate them, not to remove it from the list.

### Also

- `@smogon/calc` pinned to exactly **0.11.0** — it is the ground truth of the damage golden master and
  was a caret range.
- The simulator pin is now **verified**, not asserted: `actualCommit()` reads HEAD, `verify()` reports
  `commit_matches` as true/false/**null-for-unknown**, and `mew.js` stamps the **real** commit —
  it previously stamped the constant, so a checkout at any other commit still produced records
  claiming `20ad99ff`.
- Paralysis (×0.5) and Tailwind (×2) now checked in `test-engine-consistency.js`. `CLAUDE.md` names
  three multipliers that must be one definition; only Scarf was guarded.
- The suite's only literal tautology (`ok(true, …)`) replaced with a real assertion, and a silent
  fallback in `position_features.js` that reverted a documented bug is now counted.

---

## [3.29.0] — 2026-07-31

### Three features from the tag artifact, and all three are large

`data/tags.json` derives **96 move tags with their parameters**, and `engine/tags.js` exists to load
them — its own header says *"172 tags were a specification, not a component ... built, saved, quoted,
never used."* `board.js` read **none** of them; **72 of the 96 reached no consumer at all**.

Will spotted it from the symptom: *"DOES MAG STILL NOT VALUE TAILWIND?"* It did not, and could not.
Tailwind's tag is `doublesSideSpeed {speedMult: 2}` over 7,676 clicks, and MAG scored **Tailwind and
Protect identically at −1.54**, because the only features firing were `accuracy`, `isStatus` and
`priorLogP`. There was no speed-control feature in the 53.

Written as **conditions, not flags** — the design point. A bare "this move is Tailwind" cannot help a
one-ply scorer, because the payoff is on later turns and this turn shows only a turn spent doing no
damage. What one ply *can* see is whether the condition that makes it worth doing is true now:

| feature | fires when | measured weight |
|---|---|---|
| `speedSwing` | it flips speed order **in my favour** — zero when I'm already faster | **+0.983** [0.933, 1.032] |
| `screenValue` | it halves incoming damage AND something is hitting hard, graded by **category** | **+1.128** [1.031, 1.225] |
| `healValue` | it heals me AND I'm hurt enough for it not to be wasted; zero at full HP | **+2.220** [2.004, 2.436] |

Every interval clears zero by a wide margin and `healValue` is among the largest weights in the
model. Fit: logL/decision **−1.7380**, top-1 **31.1%**, in-sample −1.7402 against held-out −1.7380.
Against the current bot: **+0.9192 logL/decision, +7.9 points of top-1**.

**This breaks the four-null pattern of 3.28.0**, and the reason is worth keeping: those four were
knowledge already implied by other features. These three are mechanics with *no representation at
all*.

### Choice lock — a wrong denominator, not a scoring error

Will: *"LIKE CHOICE MONS ONLY GET SWITCH OR ATTACK AFTER SELECTION THATS EASY."* Live play was never
wrong — `magnemite.js` takes candidates from the request, which marks the rest `disabled`. **Fitting
was**: `fit_policy.js` handed `candidates()` all four sheet moves with no legality filter, so a
choice-locked human appeared to have ~9 options when they had 4. A conditional logit divides by the
sum over the choice set, so five alternatives that were never available inflated the denominator.
**6.52% of items in this format.**

Turn one needs no turn counter: `switchIn` starts every arrival with `lastMove: ''`, so that field
already means "has this moved since it arrived."

**After the refit** (6,517 games, 156,118 decisions), six of eight switch features have intervals
clearing zero — `switchKOSlow` +0.238 [0.142, 0.333], `switchSurvives1` +0.186 [0.149, 0.223].
`magnemite.js` describes the previous ones as *"fitted out of noise, acted on 4.43 times a game."*
They are now measured. And crucially: **switches now win the argmax** — greedy play went from 222
switch events per 60 games (all forced post-KO) to 239, where before the refit `--switching` changed
*nothing*.

### Job 2 of ALAKAZAM: the opponent model

`incomingThreat` took a **max** — the foe's hardest available hit — and nine features are built on
it. Measured on a real board, the foe's lead clicks a damaging move **52.9%** of the time and MAG
assumed 100%, *and* assumed it was the nastiest. It needed no new model: `candidates` and
`featuresFor` already take `side`, so the same weights score the other side of the field.

The max is now an expectation weighted by `P(their action)`. Across 44 boards: `protectThreatened`
fell 84%, `diesBeforeMoving` 78%, `switchDiesFirst` 88%. **The bot stops panicking.**

**Off by default**, which makes it an A/B by construction. Recursion is bounded at one level by
design. **A refit is required before it ships**, because nine features now mean something different.

### The preflight gate — 24 games instead of 144,000

Two 1.5-hour training runs completed before anyone compared the outputs. The **switch weights were
bit-identical to the behaviour clone in both** — zero change, every decimal, over 288,000 games.
Cause: `train_policy.js` spawned the farm without `--switching`, and `mew.js` makes it opt-in, so
MAG could not switch in a single training game and that block's gradient was exactly zero.

`engine/preflight.js` runs 24 games and reports which feature **blocks** received no gradient.
Verified both directions, because a test that always fails is useless: without `--switching`, 0 live
/ 8 dead / |grad| 0.00; with it, 7 live / 1 dead / |grad| 10.73. **14 seconds against 1.5 hours.**
Registered as a gate — `train_policy.js` refuses to start and passes the farm the same flags the
preflight verified.

### `engine/type_coverage.js` — best coverage against this meta

Usage-weighted. **Offence:** Ground + Ice + Electric + Steel covers **85.7%** of the meta
super-effectively, verified exhaustively over all 3,060 four-type combinations. **Defence:** Fire
9.7% of incoming power, Fighting 8.6%; best typings Ghost/Steel 39.9%, Ghost/Water 31.4%,
Ghost/Grass 29.9% — all typings people actually run. **The split:** physical 52.0% / special 48.0%
incoming, but **65.8% of the meta is bulkier physically** — so defend against physical and attack
specially.

A bug caught by disbelieving a number: counting move *slots* made Fake Out (40 BP, most-used damaging
move at 1,918,410 weight) count the same as Hyper Beam, putting Normal top of "what hurts me" while
Normal is super-effective against nothing. Base-power weighting moved Normal 12.0% → 8.1%.

### A bug the 3.28.0 mega repair shipped

`merge_mega_into_engine.js` wrote `st` (level-50) and never `bs` (base stats). The 48 existing formes
kept theirs through `Object.assign`; the **19 it added had none** — and `buildMon` opens with
`if(!m||!m.bs) return null`, so those formes **could not be built by the damage engine at all.** The
commit that fixed that class of bug introduced another instance of it.

Found by accident: a new CHOMP script vendoring ABRA's dex counted 289 species where ABRA reports
308. `engine/artifact_audit.js` missed it because `bs` was not in its field list — the one field the
repair forgot was the one field nothing looked at. Now checked, with the list commented as the
audit's entire field of view.

---

## [3.28.0] — 2026-07-30

### The finding that should govern what gets built next

Four experiments added KNOWLEDGE to the feature vector. All four measured a null. Two experiments
changed how the policy is USED. Both were large wins:

| change | kind | result |
|---|---|---|
| taking the best move instead of sampling it | how it is used | **+12 points raw, 79.7% of decisive pairs** |
| self-play policy improvement over the clone | how it is used | **55.9%** |
| four separate feature additions | knowledge | four nulls |

The nulls were tested for the obvious confound and survived it: an overdispersion check across teams
gives ~1.00 where a known real effect gives 1.169, so the nulls are genuine rather than a real effect
hidden by team heterogeneity.

**The constraint is the OBJECTIVE, not the KNOWLEDGE.** Search is a change to how the policy is used,
which is the category that has actually paid, and it is now the ranked next build.

### A class of bug: the fact reached one consumer and not the next

Every integrity bug found on 2026-07-30 was one shape — a fact living in the artifact, correctly read
by one file, and never reaching the file that makes the decision.

- **Priority blocking.** Armor Tail, Queenly Majesty, Dazzling and Psychic Terrain sat in the tag
  artifact, read by `clickFragility` and by nothing else. **Sucker Punch beat a Farigiraf in every
  rollout and every self-play game ever run.** A blocked move FAILS; it does not go second.
- **The sheet's ITEM and ABILITY** reached `switchIn` and not `switchFeatures` — the path that
  chooses the switch. A Choice Scarf switch-in read at two thirds of its speed.
- **The sheet's MOVES** reached `dmgMon` and not `position_features`, so every Pokemon was valued on
  the dataset's average moveset rather than the one it declared.
- **Mega formes** were never applied under node at all.

### Switch-in abilities reach the path that CHOOSES

Measured before fixing, over 40,001 switch-in matchups, changing ONLY the declared sheet ability:

| declared | matchups where the vector moved |
|---|---|
| `levitate` (control, known-wired) | 2,754 |
| `intimidate` | **0** |
| `drizzle` | **0** |
| `drought` | **0** |

MAG weighed bringing Incineroar in against the foe's FULL Attack, and weighed a rain setter with the
Water damage it is about to enable left out.

Modelling the drop alone would have been **worse than modelling neither** (Will: *"does it also proc
defiant and competitive when it switches in"*) — Intimidate into Kingambit is not a free -1 Attack,
it is +2 Attack for them. A stat drop is a three-stage pipeline on the TARGET's ability and all three
now run: `onChangeBoost` (Contrary inverts, Simple doubles), `onTryBoost` (Clear Body deletes; Inner
Focus / Own Tempo / Scrappy block Intimidate BY NAME; Guard Dog converts to +1; Mirror Armor reflects
it back), `onAfterEachBoost` (Defiant +2 Atk, Competitive +2 SpA).

Derived by calling the dex's own handlers against a recording stub. No ability and no weather is
named in `board.js`. **After: intimidate 9,227 of 40,001, drizzle 3,463, drought 3,438.**

### Every mega had no ability, no moves and no item — 26.0% of the format

`data/mega-dex-official.json` carried an ability for all 340 formes and `merge_mega_into_engine.js`
existed to apply them, while `data/engine-data.js` had `ab: null`, `mv: []`, `item: null` on all 57
mega entries. The two files disagreed on how to spell a key (`venusaurmega` vs `venusaur-mega`), so
**zero of the builder's 67 writes ever matched**, and a later wholesale regeneration left the nulls.

**The empty `mv` was the expensive half.** `buildMon` returned a Pokemon with no moves, so
`incomingThreat` found no attack, scored `best = 0`, and reported **every mega as threatening
NOTHING** — `switchSurvives` read "survives" against all of them and `switchDiesFirst` could never
fire. No Contrary on Staraptor-Mega (428,748 usage), no Drought on Charizard-Mega-Y, no Swift Swim on
Swampert-Mega, no Huge Power on Mawile-Mega.

289 → 308 species, 75 mega formes complete, 0 duplicate keys.

### Post-KO replacement, and Run and Bun's conjunction

Replacement after a KO was a coin flip. It is now scored, per foe rather than collapsed into a max
(Will: *"score that for both pokemon against both other mons"*), with one rule covering every case:

    hits = (voluntary ? 1 : 0) + (slower ? 1 : 0)

So the SAME slow candidate reads as dying when the switch is voluntary and as surviving when it is a
forced replacement. Three new features — `switchKOFast`, `switchKOSlow`, `switchDiesFirst` — are
mutually exclusive per foe, with "survives and has no kill" left as the reference level.

### Clean-data discipline: 11 raw-store violations → 0

Not one problem. One was a **false positive** (`calibrate.py` reaches the store through a third clean
entry point the checker did not know); one is a **legitimate raw read** (`role_atlas.py` builds a
COVERAGE catalogue, where filtering shrinks the thing that must not shrink, now declared
`RAW-STORE-OK`); nine were genuine.

`predictability.py`'s answer moved materially once cleaned: at a 100–200 rating gap the higher-rated
player wins **53.8%** where Elo predicts 65.9%. In `flywheel.py` and `train_value.py` only the LADDER
half is filtered — self-play is clean by construction and quality.py would reject it for lacking
fields it was never going to have.

### JOLTEON: from worse-than-a-coin to predictive

Retrained on self-play rather than the contaminated ladder store. DITTO consumes its weights.

### Two rules added to CLAUDE.md

- **FEATURES ARE PER-MODEL. FACTS ARE GLOBAL.** The models answer differently-shaped questions and
  must not share a feature vector; they must never each own a FACT about the game. Enforced by
  `tests/test-engine-consistency.js`.
- **A DERIVED ARTIFACT IS NOT A FACT UNTIL SOMETHING COMPARES IT TO ITS SOURCE.** The mega hole was
  invisible for as long as nobody ran a check. Enforced by `engine/artifact_audit.js`, registered as
  a gate.

### Measurement tools that were themselves wrong

- **`paired_h2h` attributed wins by POLICY NAME** and reported **100.0%** on a valid experiment. Now
  attributed by `winnerArm`; it refuses (exit 2) when the arms are indistinguishable, and labels each
  arm with its own flags.
- **`mew_farm` ate the workers' capability accounting**, which meant a 117k-game measurement could
  not prove the lever under test was even on.
- **`artifact_audit.js` shipped with two false positives of its own**, both fixed before landing: it
  first cleared the broken builder by averaging over rows that builder skips, then cried wolf forever
  after the fix by comparing raw key spellings instead of asking whether the artifact holds
  duplicates.

### Also

- `engine/position_features.js` — 16 features for what a POSITION is worth, with the damage engine
  finally pointed at it.
- `engine/train_policy.js` — the self-play improvement loop, closing the clone→farm→refit cycle.
- `app/scoreboard.html` + `build/build_scoreboard.js` — scores computed in node by the real engine and
  shipped as data, so the page renders a decision as an argument rather than a number.
- PORYGON2 retrained on open-sheet greedy self-play: **a clean null** (63.8% vs 63.6%). The
  closed-sheet-training-set hypothesis is refuted, stated plainly.
- `PORYGON2_MAXTRAIN` (default 120,000, uniform subsample) after an OOM that asked for 34.7 GiB.

---

## [3.27.0] — 2026-07-28

### The GARBODOR guard had a false negative, and a CHOMP input was built on the raw store

`engine/selftest.js` checks that every file naming the ladder store either filters or declares why not,
and it looked for the string `load_games`. Three files **defined their own** `def load_games()` reading the
store line by line with no filter at all — so they satisfied the guard by naming a function:

- `engine/xatu_context.py` — builds `data/xatu-context-sets.json`, **which CHOMP consumes**
- `engine/xatu_belief.py`
- `engine/train_value.py`

A false negative is the one error this check must never make, and it produced exactly the outcome the
GARBODOR rule exists to prevent: a CHOMP input derived from a population that is ~87% bot games,
forfeits, partial brings and stubs, with the guard reporting no offence.

**This also corrects yesterday's correction.** On 2026-07-27 the offender count was taken from 17 to 12 by
recognising three files that only *mention* the path. That was right and incomplete — the same pass should
have found these three. **The true debt was 15.** Over-counting is noise; under-counting is a clean bill of
health for contaminated data, and it is the worse direction to be wrong in.

The guard is now structural rather than textual: a loader name counts as evidence of filtering only if the
file did not define that loader itself. Stripping the definition and re-testing was the first attempt and
does not work, because the file goes on to *call* its own loader.

### Regenerated on clean data — and CHOMP does not survive it

`engine/xatu_context.py` now reads through `engine/quality.py`. `data/pokemon-roles.json` was not unsafe —
`roles.py` has always filtered, so the handoff's claim was wrong for that file — but it was **stale**,
generated 2026-07-24 against 1,061 clean games. Both regenerated in dependency order (roles → context →
CHOMP-EV) against the current store: **2,653 usable of 20,387 collected.**

**Roles, on 2.5× the data.** Held-out log-loss `roles = 0.6975`, `rating = 0.6982`, coin = 0.6931, CI
(0.6908, 0.7036). The existing null result **holds up**: role-level winner prediction still ties a coin.
334 species tagged, 52 roles, 978 matchup cells, median n = 51.

**XATU context survives.** Cross-entropy 3.595 → 3.5624, improvement **+0.0324, CI (0.021, 0.0435)**,
which clears zero. Top-1 37.1% → 37.9%. A small real effect on clean data.

**CHOMP-EV, on 2,603 eval games with clean inputs and a working bootstrap:**

| model | held-out log-loss | 95% CI |
|---|---|---|
| naive usage prior — "bring your most-brought four" | **0.6919** | — |
| CHOMP alignment | 0.6925 | [0.6898, 0.6951] |
| CHOMP + XATU context | 0.6926 | [0.6903, 0.6949] |
| CHOMP + belief weighting | 0.6929 | [0.6904, 0.6955] |
| a coin | 0.6931 | — |
| Elo rating | 0.6938 | — |

Every CHOMP variant's interval contains the coin, and **the naive baseline is better than all three of
them.** Adding XATU context and belief weighting makes the score slightly *worse*, which is consistent
with the project's existing null result that better beliefs did not improve the bring decision.

The bring effect is essentially unchanged by cleaning: **0.5132 → 0.5134, CI [0.4944, 0.5319]**, still
containing 0.5. So cleaning the inputs neither rescued CHOMP nor explained away its weakness — it simply
confirmed it on 20% more games.

**Stated plainly, because it is the point of the exercise: CHOMP has no demonstrated edge over bringing
your four most-used Pokémon.** That is a null result, and it is reported here with the same prominence the
positive results get.

---

## [3.26.0] — 2026-07-27

### Every self-play record states its whole configuration, including the defaults

`engine/mew.js` wrote `randmove`, `greedy` and `switching` **only when they differed from their defaults**.
That overloads a missing field with two incompatible meanings — "the default was used" and "this run
predates the flag" — so `engine/paired_h2h.js` had to guess, and printed **"SWITCH SETTING NOT RECORDED
(run predates the flag)"** about runs created minutes earlier. It did so three times on 2026-07-27, on the
two runs that answered the popularity × greedy question. The provenance of a published experiment was
unrecoverable from its own records while the run was still warm.

Now written unconditionally, plus the weight-file paths — a run of `policy=score` says nothing about
*which* fit played it, and the two arms of a popularity 2×2 are distinguished by nothing else. Recording
only deviations requires the reader to know what the defaults were on the day, which is the hand-kept
knowledge S13 forbids.

### xorshift32 seeded with zero returns zero forever, in three files

`engine/brood.js`, `engine/exploit.js` and `engine/ladder.js` all did `let _s = SEED0 >>> 0`. xorshift32
has exactly one fixed point and it is 0 — every shift and xor of zero is zero. Measured from seed 0 over
200,000 draws: **mean 0.00000, one distinct value.**

Both `--seed 0` and a non-numeric `--seed abc` reach it, because `+arg(...)` yields 0 or NaN and
`NaN >>> 0` is 0. In `brood.js` the result is a hang, since `gauss()` spins on `while (!u) u = rnd()` —
that is the *good* case. In `ladder.js` and `exploit.js` every "random" choice silently becomes identical
and the run reports a result anyway. Guarded with `(SEED0 >>> 0) || 1`; seed 0 now gives mean 0.50013 and
50,000 distinct values over 50,000 draws.

These three were audited because the broken LCG in 3.25.0 raised the question of what else generates
randomness here. The xorshift itself is sound: `<<` and `^` coerce to int32 *before* operating, which is
exactly why it survives where the LCG's float64 multiply did not.

### Not affected, and worth stating

`engine/paired_h2h.js` uses **no random source at all** — it computes the Wilson score interval in closed
form. The paired head-to-head figures never touched the broken bootstrap.

### Measured: popularity helps winning too, so it was never dragging MAG down

The fourth cell of the popularity × greedy 2×2 and its matching control, both run identically — closed
sheets, greedy, paired, versus the random bot:

| arm | decisive pairs | 95% CI |
|---|---|---|
| **popularity in** + greedy | **93.2%** | [92.3, 94.1] |
| popularity out + greedy | 90.8% | [89.6, 91.8] |

Intervals do not overlap, so popularity is worth about **2.4 points of decisive pairs**, on top of the
2.2 points of human-click prediction from 3.23.0. The retracted claim had it backwards in both
directions. The earlier handoff cells (91.8%, 81.9%) were run on **open** sheets and are not comparable;
MAG's features read the sheet, which is why the control was re-run rather than the old figure reused.

---

## [3.25.0] — 2026-07-27

### RETRACTED: "CHOMP's bring direction is the winning direction". The bootstrap PRNG was broken.

Every confidence interval in `engine/chomp_ev.js` came from a clustered bootstrap driven by this:

```js
seedState = (seedState * 1103515245 + 12345) & 0x7fffffff
```

That recurrence is correct in C, where the arithmetic is 32-bit. JavaScript has no integers. A mid-range
state times 1103515245 is about 1.4e18, past `Number.MAX_SAFE_INTEGER` (9.0e15), so the product loses its
**low** bits to float rounding — and the low bits are exactly what the mask and `Math.floor(rnd() * n)`
consume. Measured over 200,000 draws:

| | measured | should be |
|---|---|---|
| mean | **0.4954** | 0.5 |
| chi-square, 10 bins | **159.5** (9 df) | < 16.9 at 5% |
| distinct values | **16,403** | ~200,000 |

χ² = 159.5 on 9 df rejects uniformity at p < 10⁻²⁸, and the generator cycles with a period around sixteen
thousand.

**What gave it away** was the shape of the headline interval: `p = 0.5129, ci95 [0.5021, 0.5395]` is
asymmetric by a factor of 2.5 around a proportion near 0.5, which a healthy bootstrap cannot produce at
n = 2,124. The Wilson interval is **[0.4916, 0.5341]** and it contains 0.5.

Swapped for mulberry32 (all arithmetic through `Math.imul` and `>>>`, so the state never leaves 32-bit
range; mean 0.49984, χ² 13.2, 199,989 distinct) and re-ran the file otherwise unchanged:

| | p | ci95 | verdict the file printed |
|---|---|---|---|
| broken | 0.5129 | [0.5021, 0.5395] | "CI clear of 0.5 — CHOMP's bring direction is the winning direction." |
| fixed | 0.5132 | **[0.493, 0.533]** | **"suggestive, not significant."** |

The verdict is gated on `signCI[0] > 0.5`, so **the broken generator is the only reason this project ever
claimed a significant CHOMP bring effect.** The correct branch was already written in the same ternary.

The same file's proper score behaves the same way: CHOMP-alignment log-loss **0.6923, CI [0.6905, 0.694]**
against a coin's ln 2 = 0.6931. The interval contains the coin, so CHOMP's win-probability model is not
distinguishable from a coin flip on this evidence. Every location quoting `CI [0.5021, 0.5395]` is now
wrong and is corrected in `docs/THESIS-DEFENCE-REVIEW-2026-07-27.md`.

`build/build_mew_bundle.js` carried the same recurrence for its reservoir sample. Lower stakes — it biases
which games land in a viewer bundle rather than publishing an interval — but fixed for the same reason.

**`tests/test-prng.js` (new)** — 7 checks. It lifts each generator out of its source rather than
re-typing it, then asserts mean, χ² uniformity across 10 bins, and distinct-value count against the short
period. A structural check refuses the constant outright, with comments stripped first so the two files
can keep *describing* the old bug without tripping it. Verified to fail on the pre-fix code (3 failures)
and pass on the fix. A bad PRNG is the ideal silent failure: plausible numbers, no exception, and the
output is a confidence interval — the one artifact a reader is least likely to re-derive.

### Measured: the full-bring filter's selection bias, which the filter file predicted but nobody sized

`data/quality-filter.json` states the limitation correctly and has all along: requiring all four brought
to be revealed "conditions on game length, so the filtered set skews toward longer games." Isolating that
rule — games passing every other rule, split on full bring:

| | n | mean turns | median |
|---|---|---|---|
| full bring (kept) | 2,245 | **8.4** | 8 |
| partial (dropped) | 487 | **5.8** | 6 |

Difference 2.6 turns, Welch **t = 23.5**. Across 84 species with ≥60 appearances, 15 differ at |z| > 1.96
between kept and dropped — against 4.2 expected by chance at that threshold, so there is a real aggregate
effect — but Bonferroni requires |z| > 3.43 and **the largest observed is 2.9, so no individual species
difference is established.** Fast offensive Pokémon skew to the dropped short games (Volcarona, Mimikyu,
Oranguru); bulk and support skew to the kept long ones (Incineroar 3.84% vs 2.89%, Grimmsnarl).

The magnitude is a lower bound: the dropped set has incomplete brings by construction, so it under-counts
species revealed late — the comparison is contaminated by the censoring it measures. A censoring-aware
estimator is required and does not exist.

### Also

The funnel in `data/quality-filter.json` records `store_size: 8356, clean: 1061` from 2026-07-25. Measured
now: **17,075 collected → 2,245 usable (13.1%)**. The store doubled; the clean share barely moved
(12.7% → 13.1%), so nothing downstream is wrong, but a hand-kept provenance record in the file whose
purpose is to be the single answer is out of date.

---

## [3.24.0] — 2026-07-27

### The set sampler draws whole observed sets, and the correction that existed was unreachable

`set_priors.fillSet` filled unrevealed move slots from P(move | species) independently, which cannot
represent a **slot**: Dire Claw and Gunk Shot are both perfectly normal Sneasler moves competing for one
place, so marginals paired them at roughly P(a)·P(b) and the bot brought a Sneasler holding both.

The interesting part is that a fix was already in the file and could not be reached. `sampleMoves()`
carries a measured co-occurrence lift built precisely to stop near-substitutes pairing up — but
`fillSet` consulted **Smogon's percentages first** and only fell through to `sampleMoves` when Smogon
returned nothing, which is rare. So for most species the correction was dead code and the sampler drew
raw marginals.

**What is used now.** An open team sheet *is* the joint distribution, observed directly, and this
project holds **37,903 complete four-move sets across 232 species** in `games.bo3.jsonl` and
`games.ots.jsonl`. The sampler had been using none of them. `observedSets()` loads them (clean games
only, corpus named by path); `observedDraw()` takes the sets containing every already-revealed move —
the exact conditional distribution — and falls back to maximum-overlap nearest neighbour rather than
silence, because returning nothing would send the rarest builds back to the sampler that gets them
wrong. Species with fewer than 8 observed sets still use the marginal paths, which is now the third
preference rather than the first.

**Measured, `engine/stab_audit.js`,** two-or-more same-type attacking moves per set:

| corpus | human | generated before | generated after | gap before | gap after |
|---|---|---|---|---|---|
| bo3 (12,619 sets) | 23.0% | 32.9% | **27.4%** | +9.9 [8.8, 11.0] | **+4.3 [3.3, 5.4]** |
| ots (25,284 sets) | 23.6% | 33.0% | **27.4%** | +9.4 [8.6, 10.2] | **+3.7 [3.0, 4.5]** |
| ladder (1,392 sets) | 28.5% | 35.1% | **30.0%** | +6.6 [3.1, 10.0] | **+1.4 [−1.9, 4.8]** — now noise |

Sneasler holding both Dire Claw and Gunk Shot: **3.3% of 300 draws → 0.0%**.

**The residual +4.3 is not claimed as fixed.** Roughly half the original gap remains, from species below
the 8-set floor and from partially-revealed sets that mix an observed draw with what was already on
them. Recorded as open in `docs/ARCHITECTURE-REVIEW-2026-07-27.md` §6.

### The GARBODOR count was overstated, because naming a path is not reading it

`engine/selftest.js` greps for the store filename anywhere in a file, so three files that never open it
were counted as unfiltered readers: `coach.js` names it in a `console.log` describing where a finished
game goes, `stamp.js` shows it in a usage docstring as the value a caller passes for `corpus:`, and
`mew_farm.js` resolves it **only to refuse to write output over it** — a safety guard counted as a
violation of the rule it protects.

The count matters because this check is deliberately left failing while offenders remain, so its number
is the project's measure of remaining debt. Stripping comments and strings before matching is the obvious
fix and is wrong: `readFileSync('data/games.ladder.jsonl')` puts the path inside a string, so it would
produce false negatives — the one error this check must never make. A separate `RAW-STORE-NOT-READ`
declaration is recognised instead, and it has to say what the path is for.

`reprocess.js` gets `RAW-STORE-OK` on its merits: it REBUILDS the store, so it must read the dirty
records too. `isClean` is an analysis filter, not a retention policy, and filtering there would silently
delete replays that can never be re-fetched.

**17 → 12 offenders**, and all 12 are real. Each is an analysis script that should filter, and each needs
its own verification that filtering does not change a published output, so none were touched here.

**`tests/test-set-realism.js` (new)** — 6 checks, threshold 6.0 points, chosen to sit between the
pre-fix +9.9 and the current +4.3 so it fails on the old sampler and passes with headroom on the new
one. Verified both ways: pre-fix **3 passed, 3 failed**; current **6 passed, 0 failed**. It asserts
direction as well as magnitude, so the sampler cannot be "fixed" into under-producing doubles instead;
it asserts the observed-set store is populated, because if that store ever empties the sampler silently
reverts to marginals with nothing failing; and it checks the named Sneasler case directly.

---

## [3.23.0] — 2026-07-27

### RETRACTED: "dropping popularity makes MAG predict human clicks better". The drop never applied.

`DROP=<feature>` in `engine/fit_policy.js` refits the model as if a feature did not exist, by zeroing
its column. `decisionsFor` builds a decision's features in **two** places — once for a voluntary
switch, once for a move — and only the move path zeroed it. Every switch row kept its real value.

The column was therefore not constant. It had become a proxy for *"this row is a switch"*, and the
optimiser fitted a confident coefficient to it: `priorLogP` came out at **−1.73, SE 0.05** in a fit
whose entire purpose was its absence, with the **opposite sign** to the full model's +0.16. Nothing
errored. The fit exited 0 and wrote a weight file.

Refitting with the drop actually applied reverses the published result:

| held-out top-1 human-click accuracy | value |
|---|---|
| full model (popularity in) | 30.9% |
| popularity dropped — as published (broken) | 35.3% — *better* |
| popularity dropped — drop actually applied | **28.7% — worse** |

So dropping popularity makes MAG **worse** at predicting human clicks, not better. The claim in
CHANGELOG 3.22.0 and in commit `baa6425` is withdrawn. Both weight files were refitted.

**Fixed:** both paths now go through one `featsFor()`. `assertDropped()` refuses to fit if any row
escaped — it checks the whole corpus, not a leading sample. `tests/test-drop-guard.js` (7 checks) has
a behavioural half and a structural half; the structural half counts `B.featuresFor(` call sites and
fails on the pre-fix code (2 sites) while passing on the fix (1).

### The set-sampler audit was reading the closed-sheet ladder store

`engine/stab_audit.js` called `Q.loadGames('ots')`. `loadGames` takes an **options object**, so the
string had no `.path`, `readStore` fell back to its default, and the audit read
`data/games.ladder.jsonl` — the CLOSED-sheet ladder. It printed "clean open-sheet games 2,245" while
its stated premise, *all four moves public, no revelation bias*, was false for **95%** of that sample:
only 116 of those 2,245 games (5.2%) carry a sheet at all.

Measured on the corpora that actually have sheets, the finding is **stronger** and now replicates
across two independent collections:

| corpus | clean games | sheeted | human sets | human | generated | gap | 95% CI |
|---|---|---|---|---|---|---|---|
| `games.bo3.jsonl` (ours, sheets forced) | 1,059 | 99.4% | 12,619 | 23.0% | 32.9% | **+9.9** | [8.8, 11.0] |
| `games.ots.jsonl` (external archive) | 2,114 | 100% | 25,284 | 23.6% | 33.0% | **+9.4** | [8.6, 10.2] |
| `games.ladder.jsonl` (what was measured) | 2,245 | 5.2% | 1,392 | 28.5% | 35.1% | +6.6 | [3.1, 10.0] |

The old headline was **+6.2 points from 1,392 sets**; it is **+9.4 to +9.9 points from 12,619–25,284
sets**, and the two corpora agree. The per-species list is entirely different — Scrafty +47.9, Metagross
+40.0, Annihilape +40.0, none of which appeared before — and **40 of 58** per-species gaps clear zero.
Every row now carries the interval on its own gap; the generated sample is matched to the observed one
instead of being a quarter its size.

`loadGames()` now throws on a non-object argument. There is no honest default: guessing which store a
caller meant is what produced this.

### The test suite ran 6 of 18 files, and the gate that catches silent wrongness ran never

`.github/workflows/tests.yml` named each test in its own step. It named **6** of the 18 files in
`tests/`, and did not run `engine/selftest.js`, `engine/conformance.js` or
`engine/validate_selfplay.js` at all.

`selftest.js` — whose own header calls it "the checks that catch silent wrongness" — **was failing the
whole time**: 17 files read the raw ladder store with neither a clean filter nor a `RAW-STORE-OK`
declaration. That is the GARBODOR rule, and the guard was left failing on purpose while nothing
observed it.

**`tests/run-all.js` (new)** derives the list: 21 checks discovered. It keeps three outcomes distinct
that the hand-written workflow blurred into two — passed, failed, and **never ran**. A skip prints its
reason and is not a pass. Exit code 2 means "could not run" so a gate whose corpus is gitignored stays
listed instead of being forgotten. It also warns about `engine/*.js` files that report their own
pass/fail summary and are run by nothing, which is how `validate_selfplay.js` was found.

### The MEW acceptance gate could not be aimed at the artifact it gates

`engine/validate_selfplay.js` hardcoded `STORE = data/games.selfplay.jsonl` and ignored `argv`, while
`mew_farm.js` ends every run by printing "VALIDATE BEFORE USE: node engine/validate_selfplay.js".
Pointed at a real 59 MB run it reported **"FAIL self-play store exists"** three times about a file
that was plainly there. The store is now an argument and the raw-log path is derived from it.

Two further defects in the same file, both found by running it:

- **It baselined "realism" against the raw ladder store** — 13,374 games, roughly seven in eight of
  them bot games, forfeits, partial brings or stubs. Measuring a corpus of bots against other people's
  bots and calling the difference realism is circular. Filtered through `quality.js`, the real-ladder
  mega rate is **98.3% on 1,725 clean games**, not the 92.9% this file's own header quotes.
- **A side-balance check fired on 8 games.** Its guard was `if (!N) continue`, which skips only an
  empty sample. Seven wins in eight gives a Wilson interval of [52.9, 97.8], which excludes 50, so it
  announced "the harness itself favours a side" — while the dedicated 300-battle mirror check in the
  same run said 53.3% [47.7, 58.9] and passed. It now needs 100 games and otherwise reports
  *inconclusive*, which is neither a pass nor a failure.

### The site's MAGNEMITE room scores a 21-feature model and presents it as MAG

`web/index.html` re-implements `featuresFor`. It assigns **21 of 47** features; the other 26 are never
written and sit at the zero the array was filled with. `data/mag.js` was also stale at 46 features,
missing `deadNoLastMove` — regenerated.

`tests/test-mag-page.js` passed this for weeks because a fixture position where the engine also scored
zero agrees perfectly. Two checks were strengthened: the fixture comparison now reports **how many**
features disagree (7 across 9 cases: accuracy, koTarget, dmgFrac, tgtMayProtect, movesFirst, priority,
volatileOnSelf) instead of printing one example; and a new structural check reads the page's own source
for `x[MAGIX.<name>]` assignments and requires one per bundled feature.

**Not fixed, deliberately.** The 26 missing features cannot be written into the page as it stands —
`data/mag.js` does not ship the fields they need, including no accuracy field on a bundled move at all.
Closing it means extending the bundle and porting the logic, or deriving the browser scorer from
`board.js` instead of re-implementing it, which is the S13-correct answer. The check fails loudly in
the meantime rather than reporting a subset as agreement.

### Measured: the store duplication story is half right

The three large doublings all occurred with `merge=union` **active** (added at ancestry depth 307,
removed at 417; the doublings sit at 329, 336 and 383). That much holds. But a fourth event — `009af26`
"store: dedupe after rebase (137 duplicate lines)" — sits at depth **625**, with no active union
attribute, 208 commits after the driver was removed. `.gitattributes` states that the driver "had to
go, or the duplication returns on the next divergence"; the driver went and a duplication returned
anyway. Recorded as a hypothesis with a known counter-example rather than as the cause. A fifth event
is visible at depth 14: a commit published a store of **0 lines** and nothing caught it.

Current store measures clean: **17,075 lines, 17,075 unique ids, 0 duplicates, 0 unparseable.**

### Also

`data/h2h-nopop-greedy.jsonl` quarantined to `data/quarantine/` and re-run clean: **4,823 pairs,
90.8% of 2,814 decisive pairs [89.6, 91.8]** to MAG. The retracted figure was 35.4%. `engine/
encore_test.js` moved to `tests/test-encore-gate.js`; it and `engine/stab_audit.js` both carried
absolute `C:/Users/willj/...` paths and a hardcoded `SHOWDOWN_PATH` default, so neither could ever have
run on CI or another machine. `stab_audit.js` also had a `Q.loadGames ? ... : []` fallback that would
have reported a clean "+0.0 points" difference computed from nothing.

---

## [3.22.0] — 2026-07-27

### Encore no longer fires into a fresh switch-in, and Prankster is why the first fix was wrong

A human playing the bot for ten minutes found what no automated check had: MAG was clicking Encore at
Pokémon that had just switched in, where it fails outright. The whole "this move cannot work right
now" family — `deadStatus`, `deadSide`, `deadField`, `deadWeather`, `deadStall` — was missing this
member. Added `GAME_RULES.needsTargetToHaveMoved` (Encore, Disable, Torment, Spite, Mimic, Instruct,
Mirror Move) and feature #47 `deadNoLastMove`. Encore is on **5.34%** of teams in this format. The fit
agreed hard: **−2.943**, 95% CI [−3.359, −2.528].

The first version was still wrong, and the user said why: *"especially if they have Prankster
Encore."* The fact is not "the target has no last move" but "the target has no last move **and I
resolve first**." A fresh switch-in is about to move; a **slower** Encore lands after it does, which
is the normal correct play. Only a faster one fails — and Prankster's +1 makes Whimsicott, Sableye
and Grimmsnarl fail *every* time. The ungated feature penalised the good play exactly as hard as the
bad one. Now gated on `movesFirst`, and moved to the bottom of `featuresFor` because move order is not
settled until Tailwind, Trick Room and priority have been applied.

### Measured: the set sampler invents move combinations humans do not play, and misses ones they do

Prompted by a generated Sneasler holding both Dire Claw and Gunk Shot. Against open team sheets
(all four moves public, no revelation bias) from 2,245 clean games: sets with two or more *attacking*
moves of one type are **28.5%** for humans and **34.7%** generated. The per-species split is the real
result — Incineroar 0.0% → 22.5%, Raichu 9.3% → 30.0%, but **Kingambit 98.9% → 71.0%**, because Sucker
Punch and Kowtow Cleave are both Dark and nearly every Kingambit runs both.

So this is not a case for a "no two same-type attacks" rule, which would be wrong 99% of the time for
Kingambit. It is `set_priors.fillSet` drawing each move **independently** from P(move | species) when
real sets are correlated within a role: two moves competing for one slot get paired at P(a)·P(b).
Not yet fixed — `engine/stab_audit.js` measures it and `docs/HANDOFF-2026-07-27.md` proposes drawing
whole observed sets instead.

### Retracted before it was ever reported: the no-popularity greedy experiment

The fourth cell of the popularity × greedy 2×2 returned "35.4% of decisive pairs against a bot that
clicks at random." Losing two-to-one to a monkey takes confidently bad play, and the cause was ours:
the weight file was fitted at 46 features, `board.js` went to 47 mid-run, and the run kept writing for
another seven minutes. Games before and after the edit were not playing the same model. Discarded.
**New rule: never edit `board.js` while a fit or a self-play run is in flight** — Node caches the
module at require time, so old and new feature vectors land in one output file with no error.

### Also

`engine/mag_bot.js` — the live-odds page drops the confidence trace graph (user asked; the team sheet
it might have shown is already available by hovering the sprites in Showdown). `engine/encore_test.js`
promoted from scratch. `fit_policy.js` flags documented: they are the environment variables `DROP=` and
`OUT_WEIGHTS=`, and passing `--drop`/`--out` is silently ignored — it did a plain refit and overwrote
the main weight file.

---

## [3.21.0] — 2026-07-26

### Every document has a PDF, and the list is derived

23 of 36 markdown documents had **no PDF at all** — including ARCHITECTURE.md, MODELS.md, BACKLOG.md
and THEORY.md, which are the four a new reader would reach for first. The cause was that the build
list was typed on the command line each release, so it only ever covered the six somebody remembered,
and the source-to-output mapping (`DEFENSE.md` → `ABRA-Defense.pdf`) was retyped every time — S13, in
the publishing step of a project whose discipline is that documents track the code.

**`build/build_pdfs.js` (new)** derives it: every `docs/*.md` gets `docs/<same name>.pdf`. Three
legacy output names are kept in one place because published links point at them; everything new
builds to its own name. `--check` reports stale or missing without building, so CI can fail on a
document that says something the project no longer believes.

35 built. Markdown stays as the source — it is what git can diff and what the PDFs are built from.

### `docs/ROADMAP.md` (new)

Written to one bar: **a claim is only on the completed list if it would survive twenty hours of
someone trying to break it.** Several items that would have been on it a week ago are not, for
failing to be true when re-run today.

What passed: the quality filter and behavioural bot detection; the damage engine at 31/31 against an
independent implementation; MAGNEMITE's out-of-sample improvement; the exploitability result and what
it proves about imitation; the open-sheet corpus check; hourly Bo3 collection; the derived ability
rules; and the self-auditing tooling.

What did not, and is now listed as such: MAG is exploitable and is a starting position rather than a
player; the ladder has produced no evidence; 28 artifacts are unsafe to quote; and eight models are
retracted, null, or without usable input — recorded by name so they are not quoted again.

The summary the roadmap ends on: *the project's most valuable output to date is not a model — it is
the ability to tell which of its own results are real, demonstrated by dissolving four of them in a
single day.*

---

## [3.20.0] — 2026-07-26

### Full-codebase conformance review: the standards are now executable

132 source files, 23,909 lines, checked against S1–S13. Report in
[`docs/CONFORMANCE-REVIEW-2026-07-26.md`](docs/CONFORMANCE-REVIEW-2026-07-26.md).

**`engine/conformance.js` (new)** encodes the standards as checks. They were good standards and
nothing enforced them — they were kept by whoever remembered, which over one evening produced a
hand-typed threshold inside a file arguing against hand-typed thresholds, a hardcoded list inside the
tool built to catch hardcoded lists, two models quoted without checking their data, and a Pokémon not
legal in the format. Each passed review by someone who had just written the rule it broke.

### S12 — one format id, thirteen copies

`champions_sim.js` declared it as a literal and eleven other files restated it. `regulations.json`
already held it and two ingesters already read it. **All thirteen now do; S12 findings 13 → 0.** On a
regulation rotation every copy would have kept describing a metagame that no longer exists, and
nothing would have noticed, because a stale format id produces plausible output rather than an error.

### Three dead files deleted, and the stale claim one of them was propping up

All three were swept in by the auto-commit watcher on 23 July. `display-maps.json` (19 KB) and
`real-sets.json` (10 KB) were referenced by **nothing**.

`nontransitivity.json` was worse: nothing generated or loaded it, yet **`docs/MODELS.md` cited it as
live fact — "the meta is rock-paper-scissors"**. It was computed two days before the quality filter
existed, so its cycles were measured over a corpus that is 87% bots. Re-run on clean data, the
equilibrium collapses to 100% on one option with zero gap to greedy, and the clean matrix has 0
decisive matchups. Withdrawn in `MODELS.md`, and the file **deleted rather than kept — a stale
artifact on disk is how a retracted claim gets quoted again**, which is precisely what happened to it.

### The checker was wrong three times before it was trusted, and once dangerously

- It called **`engine/bring_priors.js` dead**. The hourly workflow invokes it by name; acting on that
  **would have stopped data collection**. Files are also reached by workflows, scripts and documented
  commands.
- It called **`build/build_engine_data.js` dead**. It generates the file the entire site loads.
- It reported **13 hardcoded format ids when 3 were real** — the other ten were the format named in
  prose, explaining itself. It now strips comments before looking.

False positives were treated as more serious than gaps throughout: a report that cries wolf is one
people learn to scroll past, which is how the project reached this state.

### Still open, catalogued rather than claimed done

13 generated artifacts that do not say they are generated, one undeclared constant
(`Z_ALPHA = 1.959964` in `triggers.js`), 13 files without the project's standard header paragraph,
and one dead-code candidate (`chomp-predict.js`). All listed by `node engine/conformance.js`.

Full test suite green throughout: 9 JS suites, 6 Python suites, selftest at 24 passed / 1 failed —
the failure being the 18-file raw-reader tracker, which is the intended signal.

---

## [3.19.0] — 2026-07-26

### One shape for every model, and the audit graph is derived rather than typed

Directive: standardise across all models, no stale models, no hardcodes, only links.

**`engine/stamp.js` (new)** is the single provenance block every artifact carries. Until now each
model described itself differently or not at all — `n_games` in one file, `games` in another,
`corpus.games` in a third, and nothing whatsoever in `chomp-ev.json`, `move-priors.json` or
`bring-priors.json`. Four fields, the same everywhere:

| field | why |
|---|---|
| `corpus` | which file the data came from |
| `games` | how many, so it can be checked against what exists clean |
| `clean` | whether the quality filter ran — the single most important bit |
| `filter` | the filter version in force, so a later rule change is detectable |

The filter version is the modification time of `data/quality-filter.json`, not a number somebody
types, because a version number is a thing to forget to bump. `raw_store_ok` takes a **reason**, never
a boolean, and `stamp()` throws if given one.

### The checker was breaking the rule it exists to enforce

`provenance.js` carried a **hand-written list** of every artifact, its generator and its inputs —
exactly the hand-maintained state S13 forbids, inside the tool built to catch it. Such a list is
correct the day it is written and rots when anyone adds a model.

It is now **derived from the source**: a generator that writes `data/x.json` names it beside a write
call, one that reads `data/y.json` names it beside a read. Both are greppable facts about the code
rather than claims about it, so a new model joins the audit by existing.

The difference is the whole point: the typed list covered **15** artifacts. The derived graph finds
**60**, of which **28 are UNSAFE** and 15 possibly stale. **Three quarters of the pipeline was
outside the audit I had just written.**

A first attempt at the dependency edges matched any filename appearing anywhere in a generator, which
gave `xatu-context.json` seventeen inputs because they were named in comments. The name must now sit
within ~120 characters of an actual read.

### Standing state

`No generator makes the quality filter opt-in. Clean is the default everywhere.` — the audit's own
last line, now true.

**28 artifacts remain unsafe to quote.** They are listed by `node engine/provenance.js` and none of
them should appear in any result until regenerated. That is the honest size of the problem, and it
was not visible before tonight.

---

## [3.18.0] — 2026-07-26

### The lazy path is now the right path

Asked whether the bad games should simply be deleted so they cannot be used by accident. **No — and
the reason they keep getting used is structural, not a matter of discipline.**

**They carry real value, and four things need them:** the behavioural bot detector identifies bot
ACCOUNTS by watching them replay one team across many games, so deleting the games destroys the
ability to find the bots; ability mechanics derived from all 14,933 battles yield 14 rules against 11
from clean-only, because physics does not care who is at the keyboard; the scrape-bias correction
needs them to measure the bias; and every past filtering decision becomes permanent and unreviewable
without the raw data. It is also the project's governing rule — *store raw, analyse on top; changing
how we segment games is a re-filter, never a re-pull.*

**The actual defect was that the wrong answer was the easy one.** `engine/pory_nn.py` took `--clean`
as an OPT-IN flag, so a plain run trained on the raw archive — which is how `data/pory-nn.json` came
to declare **61,274 games** against a clean store of ~2,000, and how its numbers came to be quoted in
conversation as PORY's honest standing.

Four other models already had it the right way round: `guru.py`, `archetypes.py`, `counterplay.py`
and `nmf_roles.py` all filter by default and take `ABRA_UNFILTERED=1` to opt out. `pory_nn.py` now
matches them, and `engine/provenance.js` fails the build on any generator that makes the filter
opt-in — with an exception for a file carrying a `RAW-STORE-OK` declaration, the same convention
`selftest.js` already enforces.

### The one justified exception, verified rather than argued

`build/build_ability_blocks.js` keeps the raw archive as its default. The defence is that ability
rules are mechanics rather than behaviour, and it was checked rather than asserted: both were
computed and **every rule is identical**, while filtering loses Volt Absorb, Water Absorb and
Purifying Salt entirely. The declaration and the comparison are recorded in the file and in the
artifact, so a reader sees them without opening the generator.

**This holds only because the quantity is mechanical.** Nothing about how people play may be taken
from the raw archive on the same reasoning.

---

## [3.17.0] — 2026-07-26

### Every input audited before anything else gets built

Directive, and it is the right one: *do not wire up SLOWKING and PORY and XATU only to say afterwards
that the data was bad — make the inputs bulletproof first.* The SLOWKING withdrawal in 3.16.0 was
exactly that failure, and it was not a one-off.

`engine/provenance.js` checks every published artifact against four questions no file currently
answers about itself:

1. **Is it older than the quality filter?** Then it was computed under different rules about what
   counts as a usable game. This is precisely what invalidated SLOWKING.
2. **Is it older than its own inputs?** Then it describes a corpus that has since moved.
3. **Does it declare more games than exist clean?** Then it cannot have been filtered.
4. **Does it record a corpus at all?** A file that does not say what it was built from can never be
   checked by anyone.

### What the audit found

**Four artifacts are UNSAFE and must not be quoted:**

| artifact | why |
|---|---|
| `pory-nn.json` | its generator's filter is **opt-in** (`--clean`, default off) and the file does not record it was used; declares **61,274 games** against ~2,000 clean |
| `playstyle-matchups.json` | predates the quality filter; declares 3,310 games against ~2,000 clean |
| `slowking-playstyle-eval.json` | derived from the above, and also predates the filter |
| *(and `slowking-eval.json`, fixed in 3.16.0 by re-running it)* | |

**And I quoted one of them in this very conversation.** The comparison offered as "the honest state of
PORY" — that simply counting Pokemon and HP scores 0.638 against PORY's 0.674 — came from
`pory-nn.json`, which was trained without the filter switched on. **Withdrawn.** PORY's standing is
now unknown rather than weak; `pory-eval.json` itself (from `pory.py`, which does refuse the raw
store) is a separate and still-usable artifact.

**Eight more are possibly stale** — older than inputs that have since grown, or recording no game
count at all. `move-priors.json`, `bring-priors.json` and `chomp-ev.json` state no corpus, so nobody
can check them without re-running them.

### The checker's own false alarm, fixed before it shipped

The first version compared every artifact's game count against the **ladder** clean count and flagged
`policy-weights.json` as unsafe for declaring 2,723 games. It is fitted on the **open-sheet** corpus,
which is a different population with its own clean count. A checker that cries wolf is one people
learn to scroll past — the same argument this project already made about a diagnostic that fired
every run — so each artifact now declares which corpus its count should be judged against.

---

## [3.16.0] — 2026-07-26

### WITHDRAWN: "this metagame is rock-paper-scissors, so you must mix"

Quoted earlier tonight as the justification for building a mixed-strategy branch scorer, citing
SLOWKING's equilibrium — a 48/33/19 mixture and a named cycle through Charizard-Venusaur, Trick Room
and Incineroar-Sneasler. **Both came from a stale artifact computed on the UNFILTERED store.**

`data/slowking-eval.json` is dated **24 July** and reports **7,314 games over 8 archetypes**. GURU was
quality-filtered on **25 July**, one day later. The clean store has never held more than about 2,000
games, so 7,314 could only have come from the raw store — which is 87% bots, forfeits and stubs.

Re-run against the current clean matrix (1,124 games, 5 archetypes, **0 decisive matchups**):

| | stale, unfiltered | clean |
|---|---|---|
| equilibrium | 48% / 33% / 19% mixture | **100% on one option** |
| gap between mixing and picking the best | material | **zero** |
| cycle found | Charizard-Venusaur → Trick Room → Incineroar-Sneasler | **none** |

SLOWKING's own output now says it: *"this meta is close to transitive at this granularity, so mixing
buys little here."*

### But the honest reading is "no input", not "mixing does not help"

The clean matrix contains **0 decisive matchups** — every cell's interval spans a coin. A Nash
solution over a matrix of noise is meaningless in either direction, so this cannot distinguish
"mixing is unnecessary" from "there is nothing here to solve". **SLOWKING currently has no usable
input**, and that is the accurate statement.

### What still stands, and it is the thing that matters

The case for a mixed strategy does **not** depend on GURU at all. It rests on a direct measurement
made tonight: a challenger built only to counter MAG beat it **63.2%**, and beat MAG's predecessor
68.2% where MAG manages 60.2%. MAG is demonstrably readable. That is measured on fresh games and is
untouched by any of the above.

So: the *empirical* claim about this metagame being cyclic is withdrawn. The *specific* claim that
MAG is exploitable stands. Whether mixing at the TURN level helps is untested — a team-preview null
over five coarse buckets says nothing about it.

### The rule this violated

Quoting a model's output without checking what its inputs were built from. The stale file carried no
warning, was a day older than the filter that invalidated it, and was cited as evidence for an
architecture. Every published artifact should record the corpus it was computed on, and a consumer
should refuse one that predates the filter it depends on.

---

## [3.15.0] — 2026-07-26

### The ladder: optimise for winning, against an opponent that improves too — and it caught my own bad statistics

`engine/ladder.js` runs champion versus challenger: beat the champion and you become it, so the bar
rises every generation instead of staying frozen. That matters because hill-climbing against a fixed
opponent is the trap this project already fell into — MAG's 60% over the prior bot turned out to be
mostly punishing a flaw it had been built to punish.

**The first run produced a false promotion, and the round robin is what caught it.** A generation-3
champion was promoted for beating generation 2 at **56.1%** over 319 games, then scored **49%**
against the very same opponent when replayed on different seeds.

The cause was mine: the challenger is the **best of five probes**, so its measured win rate is the
maximum of several noisy draws and is optimistically biased. Testing that maximum with an ordinary
95% interval — as though it were a single pre-planned comparison — is not a valid test. It is the
same selection error the project already documented once in `build_lab`, committed again.

**Fixed: a winner must now win twice.** Once to be selected, then again in a confirmation match on
independent seeds against the same champion, and only the second interval counts.

### And the reassuring message was also wrong

The first run printed *"No cycle detected: every champion beats or ties all of its ancestors."* Every
single ancestor comparison had an interval spanning a coin — nothing was decided either way. The
honest statement is that the round robin **had no power at that sample size**, not that the ladder
is clean. It now says that instead, and only claims a clean result when at least one comparison was
actually decisive.

That distinction matters more here than usual: in a cyclic metagame a ladder can climb forever
without going anywhere, and "no cycle detected" is precisely the sentence that would hide it.

### Net result of the first run: nothing established

Two promotions, both unconfirmed, and a round robin that could not resolve anything. **No evidence
the ladder improved on MAG.** Reported as a null rather than as two generations of progress, which is
what the original output would have implied.

---

## [3.14.0] — 2026-07-26

### MAG is exploitable, and the thing that exploits it is simply a better player

The first exploitability measurement this project has ever run on in-battle play, and it answers the
question that has been open all evening: are we building something that plays okay, or something
that approaches solved. **Plays okay.**

`engine/exploit.js` hill-climbed a challenger over **MAG's own 17 features** — same machinery, only
different numbers — to maximise its win rate against MAG. Eighteen rounds, ~220 games each, about
forty minutes:

| | win rate | 95% CI |
|---|---|---|
| challenger vs **MAG** | 63.2% | [56.6, 69.3] |
| MAG vs the prior bot | 60.2% | [57.4, 63.0] |
| **challenger vs the prior bot** | **68.2%** | **[64.6, 71.6]** |

**MAG is more exploitable than it is strong.** A counter found by a crude search beats it by more
than it beat its own predecessor.

**And it is not a rock-paper-scissors counter — it is transitively better.** Played against the old
prior bot, the challenger wins 68.2% where MAG manages 60.2%, on non-overlapping intervals. It is not
exploiting MAG specifically; it is a straightforwardly stronger policy that MAG's fitting procedure
failed to find.

**Which number to trust.** The 63.2% is the maximum over eighteen searched candidates and is
therefore optimistically biased — it was selected on that opponent. The **68.2% against the prior bot
is an independent evaluation** the search never optimised against, and it is the solid one.

### Why the fitting missed it, and what the counter actually learned

MAG's weights were fitted to **predict a human's next click**. The challenger's were fitted to **win**.
Those are different objectives and they disagree, in an interpretable way:

| feature | MAG (imitates humans) | challenger (wins games) |
|---|---|---|
| never waste a move (`immune`) | −2.24 | **−9.11** |
| finish a weakened target (`tgtHurt`) | +0.34 | **+2.75** |
| hit a 4x weakness (`eff4`) | +1.31 | **+0.19** |
| hit a 2x weakness (`eff2`) | +0.96 | +0.09 |

The winning policy barely cares about type effectiveness and cares enormously about **not wasting a
turn and finishing what is already hurt**. That is a real hypothesis about the game — KOs win games,
chip damage does not — and it is the opposite of what humans visibly do.

**This is the clearest demonstration yet that imitation is a ceiling, not a target.** Everything
reported about MAG until today measured how well it predicts people. Optimising the same seventeen
features for *winning* instead found something clearly stronger in forty minutes.

`abilityBlock` fell to ~0 in the challenger, one release after being added. It may be genuinely
unhelpful for winning, or noise in an 18-round search; it is flagged, not concluded.

### What this changes

The imitation fit should stop being treated as the objective. It is a sane initialisation and it is
now demonstrably leaving strength on the table. The next step is the one that was always the plan:
generate games with MAG and optimise for the outcome rather than for resemblance.

---

## [3.13.0] — 2026-07-26

### Measured before building: humans do NOT choose their two moves independently

MAG decides each of its two Pokemon separately, blind to what its partner is doing. Before building
joint scoring, the question was whether the effect is real. It is, and it is large — over 18,575 real
turns where both Pokemon acted:

| joint effect | if chosen independently | what humans actually do |
|---|---|---|
| both aim a single-target attack at the **same** foe | ~50% | **23.4%** |
| both use Protect on the same turn | 1.66% of turns | **3.47% — 2.1x** |
| Follow Me / Rage Powder used, partner then attacks | — | **97%** |

**Aiming is the big one.** MAG picks each target separately, so it doubles into one foe about half the
time; humans do it under a quarter of the time. That is a measurable gap MAG fails today, and it is a
new realism metric with a clear target.

Redirection is the cleanest case there is: Follow Me is used to enable the partner and essentially
nothing else. A model that scores the two Pokemon separately cannot represent that at all.

### And the finding that contradicted my own prediction

I expected humans to **avoid** double Protect as wasteful. They do it **twice as often as chance**. It
is a real tactic — scouting, stalling a Trick Room or Tailwind out, ducking a predicted double-up.
Had this been hand-written as a rule, it would have been written as a penalty and it would have been
backwards. Another entry for the same ledger: the values must be learned.

### A third keying error, caught before it was published

The first version of this measurement keyed the two Pokemon on **resolution order** rather than on
their field slot. Protect has +4 priority so it almost always resolves first, which manufactured a
fake asymmetry — "slot A protects 22.2%, slot B 3.5%" — and inflated the double-Protect effect to
4.45x. Keyed on the actual slot, the two sides come out at 12.5% and 13.3% as they must, and the
effect is 2.1x.

That is the third time tonight a keying or denominator mistake invented an effect, after
switches-per-move and the Protect-chain counter. The rule is now in three changelog entries and was
still not applied before running the query.

---

## [3.12.0] — 2026-07-26

### Abilities that eat a move — derived from real battles, not typed

"Flash Fire is immune to Fire" is a **rule of the game**, not a judgement about value, so encoding it
costs nothing in ceiling — the same way a chess engine is told how a knight moves. That is the line
this project now works to: **encode what the game permits, learn what is valuable.** "Moving first is
good" stays out, because it is usually true and flatly wrong under Trick Room, and only data knows
the difference.

`build/build_ability_blocks.js` reads the rules out of **14,744 recorded battles** rather than typing
them, because a fact typed in July is a fact nobody re-checks in November. Probing Showdown's own
handlers with a stubbed battle context was tried first and **failed silently** — it reported Fake Out
getting through Armor Tail.

`engine/board.js` gains `abilityBlock`: the probability that the target's ability nullifies the move,
weighted by Smogon's per-species ability odds — so it never peeks at hidden information, it only
knows what the population knows. Fitted weight **−1.75, 95% CI [−1.96, −1.55]**. Held out:
**−1.5858**, from −1.5927.

### Three wrong rules caught on the way, all the same mistake

1. **Assuming the rule is about type.** The first derivation recorded the *types* of everything an
   ability stopped, which is right for Levitate and badly wrong for the rest: Armor Tail came out
   "blocks Dark/Normal/Flying/Fire/Grass/Fairy" — merely the types of priority moves people threw at
   it. Fixed by testing candidate rules (type, priority, status, sound, bullet, powder) and taking
   the one that explains the evidence most cleanly.
2. **Letting a broad rule win a tie.** Good as Gold blocks status moves; "priority or status" also
   explained 100% of what it stopped, being broader — and would have claimed Fake Out, which Good as
   Gold does not block. **Ties now go to the narrower rule**, breadth measured as how many moves in
   the format each rule matches.
3. **Over-claiming anyway, in the shipped version.** The priority rule counted *every* status move,
   so it told MAG that no status move ever lands on Farigiraf. Armor Tail blocks moves that go
   **early**, and a status move goes early only if its **user has Prankster** — so Whimsicott's
   Thunder Wave is refused and an ordinary Pokemon's is not. The rule now depends on the user and
   returns a probability. Measured: from Whimsicott 99%, from Incineroar 0%, and Fake Out 99%
   from anyone.

All three are the same error — generalising from what was observed into cases that were not — and
the third one shipped despite the first two being caught the same hour.

---

## [3.11.2] — 2026-07-26

### The Protect-chain measurement was wrong, and the "bot signature" reading of it was wrong twice

3.11.1 reported Protect chains up to nine long and treated a long chain as evidence of a failing bot.
Two corrections, both from the same objection: *a human would never click Protect nine times, it only
has 8 PP.*

**First: Protect has 5 base PP, 8 with PP Ups. A chain of nine is not something a bot does — it is
something my detector invented.** It keyed the chain on the field SLOT rather than on the Pokemon, so
when one fainted and its replacement used Protect, the counter carried on as if it were the same
Pokemon. Re-keyed on slot *and* species, and restricted to the moves the dex actually marks
`stallingMove` (Wide Guard and Quick Guard have 16 PP and different mechanics and should never have
been in the bucket):

| | share of moves | repeated immediately | longest chain, same Pokemon |
|---|---|---|---|
| humans, as published in 3.11.1 | 14.3% | 12.5% | 9 |
| **humans, corrected** | **13.8%** | **8.1%** | **8** |

Eight is exactly max PP. Nothing anomalous survives.

**Second: even a chain longer than eight would not be bot evidence.** A Leppa Berry restores PP, so a
Pokemon can Protect to empty, eat the berry and continue. The "impossible, therefore a bot" reading
was wrong on its own terms.

**The bot-side figures in 3.11.1 came from the same broken detector and are withdrawn**, not merely
adjusted — the prior bot's 42.8% and MAG's 21.5% must be re-measured before either is quoted again.
The qualitative point that the baseline over-Protects survives; the numbers do not.

This is the third time a denominator or keying mistake has manufactured a defect in this project,
after switches-per-move and the set-diversity artifact. The rule stands and was not applied here:
before believing any gap, check that both sides had the same opportunity to produce it — and check
what the counter is actually keyed on.

---

## [3.11.1] — 2026-07-26

### Withdrawn: "MAG wins 60% of the time" as a claim about competence

3.11.0 reported MAG beating the prior bot 60.2% and called it the first evidence the policy is
better at the game. The number is real. **The framing was not**, and the objection was exact: *do we
want MAG playing against the bot that clicks Protect eight times in a row?*

Measured, and the description was literally accurate:

| | Protect-family, share of moves | clicked Protect AGAIN straight after | longest chain |
|---|---|---|---|
| prior bot | 23.6% | **42.8%** | 8 |
| MAG | 16.7% | 21.5% | 8 |
| **real humans** | 14.3% | **12.5%** | 9 |

The baseline wastes roughly a quarter of its turns on Protect and follows one Protect with another
almost half the time. MAG has a fitted term for exactly that failure. **So a large part of that 60%
is MAG beating a self-inflicted flaw it was specifically built to punish** — which is close to
teaching to the test, and is not evidence of competence. The claim is withdrawn. What survives is
weaker and still worth having: reading the board is not *harmful*, which was not guaranteed.

**MAG is not competent by this measure either.** It still repeats Protect at nearly double the human
rate and still produces an eight-long chain.

### The finding that cuts the other way, and defends the whole design

**Humans chain Protect too — up to nine in a row, 12.5% of the time.** So a hand-written rule saying
"never Protect twice" would be *more* wrong than the fitted weight, not less. The defect was never
the behaviour; it was the **rate**. A rule cannot express a rate, and this is the concrete case for
why nothing in this model is typed: two hundred hand-written rules would beat the other bots and
would encode a ceiling equal to whoever wrote them.

### What a competent opponent actually means

The opponent should be **the policy's own previous version**, not a fixed weak bot — that is what
makes the bar rise as the policy improves, and it is the missing piece between where this is and
outcome-based learning. `--policy2` now makes that runnable; nothing yet runs it.

---

## [3.11.0] — 2026-07-26

### The head-to-head gate, and the first evidence MAG is actually BETTER rather than just more human

Backlog item 4, and it was overdue. Everything reported about MAG until now measured how well it
**predicts a human's next click**. That is a different question from whether it **wins**, and only the
second one is the goal. The distinction was raised directly and it was fair: a policy fitted to
imitate people can get better at imitating while getting no better at playing.

`engine/mew.js` gains `--policy2`, so two policies play each other. Sides **alternate every battle**,
because a challenger that always sat on p1 would score that seat's advantages as policy strength, and
the winner is recorded as a **policy** rather than a side.

**MAG against the prior bot it replaced, 1,176 decisive games:**

| | |
|---|---|
| MAG wins | 708 |
| prior bot wins | 468 |
| MAG win rate | **60.2%**, 95% CI [57.4, 63.0] |

The interval clears a coin comfortably. Balanced across seats — 61.4% on p1, 59.0% on p2 — so it is
not a side artifact. **This is the first result in the project showing the board-aware policy is
better at the game, not merely better at resembling people.**

### Withdrawn: the old self-play corpus as evidence for anything

Previous entries used the 199,524-game self-play corpus to argue that outcome-based learning needs a
strong starting policy, citing PORY's weakness on it. **That corpus is not usable evidence** — it was
generated before the mega option was passed to the players, so essentially no game in it contains a
mega evolution in a format built around megas, and the set generator of the time could put two
Protect-family moves on one set. PORY's weakness on it may be those defects rather than anything
about outcome learning. The argument is withdrawn; the head-to-head above does not depend on it.

---

## [3.10.0] — 2026-07-26

### Effectiveness is no longer forced to be linear, and spread moves now know they hit your partner

Both came out of a direct challenge to the fitted weights.

**"Should a 4x hit be the highest click?"** The old model could not answer, because it had assumed
the answer: a single `eff` term on Showdown's integer scale forces 4x to be worth **exactly twice**
2x by construction. Effectiveness is now one-hot — a separate fitted weight per bucket, expressed as
the fraction of targets hit in each, with a neutral hit as the reference level. Measured:

| bucket | pull |
|---|---|
| 4x weakness | **+1.27** |
| 2x weakness | +0.95 |
| resisted | −0.79 |
| resisted twice over | −1.12 |
| immune | **−2.24** |

So a 4x hit is the biggest positive pull available — but only **1.33x** the pull of a 2x hit, not
2x. The old linear model was overstating the 4x premium by half. Humans treat super-effective as
close to a threshold, which is unsurprising once you notice that both usually take the same number
of hits to matter. And the strongest single term in the whole model remains a **negative** one:
doing nothing at all.

**Sixteen moves hit your own partner** — `allAdjacent`, which includes Earthquake, Discharge, Lava
Plume, Sludge Wave and Explosion. They were lumped in with foe-only spreads (`allAdjacentFoes`) and
scored against the opponents ONLY, so clicking Earthquake beside your own Garchomp looked free. It is
not, and the fit can now price it.

**The first version of that feature returned a POSITIVE weight** — "humans like hitting their own
partner" — which is not a credible reading. It fired on any non-immune ally, so it was mostly
measuring "this is a strong, popular spread move". Narrowed to fire only when the partner does not
resist, it comes back at **+0.11, 95% CI [0.01, 0.21]**: still positive, barely distinguishable from
zero. **Reported as a null.** The honest reading is that real teams are built so the partner resists
whatever it stands next to, so there is little left to detect — not that the cost is unreal.

Held out by game: **−1.5927**, against −1.5953 for the linear model. A real but small gain.

### Also

The room gains a **partner slot**, without which the ally feature could not be demonstrated at all.
`web/index.html` scoring, `engine/selftest.js` and `tests/test-mag-page.js` all follow the new
feature list, and the drift guard caught the page still computing the old single `eff` term.

**Confirmed rather than assumed while checking a related claim:** Showdown separates the
one-at-a-time major statuses (`brn/par/tox/slp`, on `move.status`) from stackable volatiles (Encore,
Taunt, confusion, on `move.volatileStatus`), and `deadStatus` only ever reads the former. That parse
was already correct.

---

## [3.9.2] — 2026-07-26

### Correction: open team sheets do not show the stat spread

3.9.1 said a damage calculation "needs the target's spread, item and ability &mdash; which in a normal
game you do not know. In open team sheets you do." **The last part is wrong**, and it was pointed out
immediately.

Measured over **60,852 sheet entries** across both open-sheet corpora:

| on the sheet | not on the sheet |
|---|---|
| species, ability, nature, level &mdash; 100% | **stat spread &mdash; 0%** |
| item 99.8%, all four moves 99.9% | IVs 0%, Tera type 0% |

So an exact damage number is **not** available even with sheets open: how much a Pokemon invested in
a stat stays hidden either way. The claim overstated what open sheets buy.

What they do buy is real, though, and larger than it first looks. **Nature is revealed** &mdash; and
Smogon lists its spread statistics keyed by nature, so knowing it cuts the plausible spreads for a
species from about six to one or two. Item and ability, the two biggest multipliers in a damage
calculation, are known outright. So the open-sheet damage calculation is a **tight estimate**, not an
exact figure, and the page now says exactly that.

---

## [3.9.1] — 2026-07-26

### Weather Ball was being scored as a Normal move. It is Water under rain.

Reported from the site: *Weather Ball changes type with the weather, Pelipper sets rain, so it should
be super effective on Incineroar.* Correct, and the bug was in **`engine/board.js`**, not just the
page — `featuresFor` read `move.type`, which is the move's type **on paper**. Thirteen moves in this
format change type with the board, and Weather Ball is the one that matters: Pelipper sets rain on
switch-in with Drizzle, so a rain team's main attack was being scored as a Normal move that is
neutral on everything, when it is a Water move that is super effective on Incineroar and carries
STAB. Terrain Pulse has the same problem on terrain.

`moveType()` now resolves it by **calling Showdown's own `onModifyType` handler** with a stub of the
tracked board and asking what the type would be. The mapping is not written down anywhere — the
source of truth answers for itself, so a regulation that changes a move stays correct. Moves whose
handler needs context the stub cannot supply (Judgment, Techno Blast, Tera Blast — item, species and
Tera dependent) fall back to their base type, which is a stated gap rather than a solved problem.

Refitted on the corrected features: **58,281 decisions**, held-out top-1 33.3%, +6.4 points over the
behaviour clone. `build/build_mag_data.js` asks the handler once per trackable weather and ships the
answers, and the browser fixture now scores **under rain** so this specific bug cannot come back
unnoticed. It immediately caught two harnesses that were not reproducing the fixture's weather.

### The weights chart was plotting the wrong quantity

Asked directly: *is the direction all that matters, or the magnitude too?* Both matter — the score is
a sum, so a term twice as large moves the answer twice as far. But the chart was comparing **raw
weights**, and those are only comparable if the things they multiply share a scale. They do not: most
features are 0-or-1 flags, while `eff` runs about −4..+2 and `priorLogP` about −7.6..0.

So the chart now plots **weight × how much that feature actually varies**, measured across every
candidate in the corpus and shipped in `data/policy-weights.json`. That reorders it completely, and
**corrects a claim this changelog has been repeating**:

| by raw weight | by actual influence |
|---|---|
| `deadSide` −2.29 | **`eff` +0.47** |
| `deadField` −2.19 | `immune` −0.45 |
| `immune` −2.07 | `priorLogP` +0.33 |
| `eff` +0.80 | `deadSide` −0.20 |

Earlier entries said "the biggest learned effects are not about damage at all, they are the dead-move
terms". That is true **per occurrence** — a dead move is punished about five times harder than a
weakness is rewarded — and false **overall**, because dead moves are rare while effectiveness differs
on every board. Hitting a weakness is the single biggest driver of a real decision. Both statements
are now on the page, distinguished.

### The room, remade

The old-bot comparison panel is gone — it existed to prove the improvement once, that is recorded
here, and it does not need permanent screen space. In its place: the **actual score** for every
option in its own column, and any row opens to show the arithmetic that produced it, term by term.
The opening board changed from Pelipper into Garchomp + Incineroar — where Hurricane is neutral on
**both**, so it scored 17% and 17% and looked like a bot that was not aiming — to Garchomp into
Charizard + Kingambit, which puts immunity, aiming, super-effective and spread on screen at once.

"What I do not do" now says **why not yet** for each item, because none of them are impossible:
switching needs to know when a human could have switched and did not (open sheets give that);
a real damage calculation needs the target's spread, item and ability (open sheets give that too);
and reading a Protect is a search problem, which is ALAKAZAM's.

---

## [3.9.0] — 2026-07-26

### The scoring bot is now MAGNEMITE, and it has a room on the site

**MAGNEMITE — Move Appraisal Grounded iN Effectiveness, Matchup, Immunity and Timing Estimates.**
"MAG" in the nav. The name is thematically right: the model's single biggest win was **locking onto
the correct target**, which the old policy left to a coin flip. `engine/score_policy.js` →
`engine/magnemite.js`.

**A real room in `web/index.html`, not a separate page.** Set a board up — your active and its four
moves, the two Pokémon opposite, their HP, whether they are statused, whether Tailwind or Trick Room
is already up, whether you Protected last turn — and watch it choose, with MAG on the left and the
old popularity-only bot on the right. Every row carries the reason in plain words: *4× super
effective*, *does nothing — immune*, *already up*, *target is hurt*. Underneath, what it is weighing,
as bars.

The tab is **derived, not placed**. `build/build_status.js` gains a MAGNEMITE rule that reads
`data/policy-weights.json` and compares the fit to the behaviour clone it replaces, both held out by
game. It currently reports *"guesses a human's next click 33% of the time, 7 points better than
popularity alone"* and a status of **win**. A refit that loses to the clone relabels the room and
drops the tab into the PC on the next build, with nobody editing the page.

**Two implementations of one definition, and the guard against them drifting.** The room re-implements
`engine/board.js` `featuresFor` in browser JavaScript, because the engine runs in Node. That is
exactly the drift this project keeps paying for, so `build/build_mag_data.js` ships a fixture the
**real engine** scored inside `data/mag.js`; the room re-scores it on open and shows a red banner on
any disagreement; and `tests/test-mag-page.js` lifts the page's own scoring functions out of the HTML
and fails the build if they disagree. Nine assertions, including that the page aims a 4× move at the
right foe and that Tailwind loses value once Tailwind is up.

Nothing in the room is typed: weights, moves, species, the type chart and the popularity priors all
come from the generated bundle (500 moves, 357 species, 111 KB).

### Smogon's Bo3 open-team-sheet statistics were being downloaded and never opened

`engine/fetch_smogon_stats.js` has pulled `gen9championsvgc2026regmbbo3` at all four cutoffs since it
was written. `engine/smogon_priors.js` only ever read the closed-sheet format, so **every** prior in
the project — sets, spreads, items, abilities, the build space — described one metagame while the
policy work had moved to the other.

`node engine/smogon_priors.js --bo3` now builds `data/smogon-priors-bo3.json`, and the monthly
workflow builds both. Separate files on purpose: writing the open-sheet population over
`smogon-priors.json` would repoint every downstream prior at a different metagame with nothing to
notice it. First build confirms they are not the same population — **224 species against 283**.

---

## [3.8.0] — 2026-07-26

### We were not collecting the Bo3 open-team-sheet ladder. Now we are.

Asked directly: *does the pull grab the Bo3 open-team-sheet data too?* It did not. The capability was
fully wired and never switched on — `data/regulations.json` already names the format
(`gen9championsvgc2026regmbbo3`) and already says `"openTeamSheets": true`, `durable-ingest.js`
already honours an `INCLUDE_BO3` flag, and **nothing anywhere in the repo ever set it.**

Confirmed against the simulator's own format table, and the distinction turns out to matter:

| format | ruleset | consequence |
|---|---|---|
| `gen9championsvgc2026regmb` (main ladder) | `Open Team Sheets` | **optional** — both players must agree, which is why only 184 of 15,386 stored games carry sheets |
| `gen9championsvgc2026regmbbo3` | **`Force Open Team Sheets`** | **every game** publishes all six sets of both sides |

So the Bo3 ladder is a continuously-refreshing corpus in which the **choice set of every decision is
known** — the one thing `fit_policy.js` needs and the reason it had been fitted on an external
archive instead. It is also our own scrape of our own ladder.

- `ingest.yml` now pulls it hourly into **`data/games.bo3.jsonl`**, a **separate store**. Bo3 is a
  different information regime and a different metagame; pooling it into the ladder store would
  silently change every behavioural statistic in the project. The format id is read from
  `regulations.json`, so a regulation rotation carries it automatically.
- The reconcile loop preserves that store across its `git reset --hard` exactly as it does the ladder
  store. Omitting that would have discarded every Bo3 game on the first push race.
- `fit_policy.js` now reads all three open-sheet sources: **48,538 → 58,085 usable decisions.**

**A store nobody was deduplicating.** `data/games.bo3.jsonl` was being written by something on this
machine that is not in the repo, and survived only because `git add -A` swept it up. It held **595
duplicate lines out of 2,504** — the same append-only-under-git duplication that has hit the ladder
store twice. `dedupe_store.py` was hardcoded to one path; it now takes one, defaulting to the ladder
store so every existing caller is unchanged, and the workflow dedupes both.

### The fitted weights now ship confidence intervals — and that changed the answer

3.7.1 judged "did the covariate correction move the weights" against a **hand-typed 0.25**. That is
precisely the invented constant S12/S13 forbid, it was mine, and it was wrong: it reported the
weights as *stable* when they are not.

Conditional logit has the observed information in closed form, so every weight now carries a proper
standard error and the shift is measured in **standard errors** against the same z = 1.96 the project
uses for every Wilson interval. Judged properly, five weights move materially:

| feature | open-sheet fit | reweighted to closed | shift |
|---|---|---|---|
| `priorLogP` | +0.241 | +0.192 | **10.8 SE** |
| `bp` | −0.131 | +0.032 | 6.2 SE (sign flips) |
| `deadSide` | −2.293 | −1.928 | 3.4 SE |
| `stab` | +0.164 | +0.121 | 2.5 SE |
| `deadField` | −2.185 | −1.883 | 2.1 SE |

So the open-sheet objection has real teeth, and precisely where it should: the terms that move are
**popularity** and **base power**, not board-reading. `eff` (+0.800), `immune` (−2.073),
`deadStatus` and `deadStall` are unmoved. Reading the board transfers between the two metagames;
how much popularity is worth does not — which is unsurprising, since `priorLogP` is itself derived
from the closed ladder.

**The reweighted vector now ships**, because MEW draws its teams from the clean ladder store and the
bot therefore plays in the closed-sheet metagame. Both vectors are recorded in
`data/policy-weights.json` along with which one shipped and why.

Every weight is also printed with a 95% interval, and any interval containing zero is labelled as a
feature doing no measurable work — this project asks that of every other model and this one had been
shipping a bare vector.

---

## [3.7.1] — 2026-07-26

### The open-sheet corpus objection, measured instead of argued

Raised against 3.7.0: *open team sheet teams have different incentives than closed team sheet teams.*
Correct, and sharper than the caveat 3.7.0 recorded — that one said open-sheet players *hedge less*,
which is about play. The real point is that the **teams themselves** are built differently, because a
surprise set or a bluff item is worth nothing against someone who read your sheet before game one.
The corpus even ships with a warning saying so: *"Different information AND incentive regime … Do
not pool."* It was there and the fit used the corpus anyway.

**`engine/corpus_shift.js` (new)** measures it, applying the same code to both corpora so a
difference is the population and not the measurement. The objection is right, and large:

| | open-sheet | closed ladder |
|---|---|---|
| Garchomp on a team | 81.6% | 47.7% |
| Basculegion | 61.3% | 33.2% |
| Staraptor | 44.0% | 25.1% |
| Tyranitar | 7.4% | 21.2% |
| Sitrus Berry (share of items) | 8.4% | 17.5% |

**551.9 points of total absolute species difference across 109 species.** Not the same metagame.

But behaviour *given a board* — the only thing the policy learns — is nearly identical: super
effective 35.59% against 37.08%, resisted 15.06% against 15.04%, immune 1.00% against 0.97%, dead
moves 1.30% against 1.53%, status 33.89% against 34.09%, Protect 13.87% against 13.79%.

That split is what licenses the corpus. The model is **conditional** on the board and never learns
what to bring — MEW samples teams from the clean ladder store regardless — so the composition gap
changes which situations were sampled, not what was learned from them.

**Corrected rather than argued away.** `fit_policy.js` now re-estimates on a sample
importance-weighted to the closed-sheet species mix on **every run**, and reports whether the weights
move. They do not: largest change `deadStatus` by **0.222** on a weight of −1.374, with 47% of the
sample surviving reweighting (Kish effective sample size, reported so a correction that ate the
sample would be visible). If that ever stops holding, the run says so in words and the conclusion is
void.

### "Most games are bot games" — checked on this corpus specifically, and it is the cleaner one

`quality.js`'s bot detection was tuned on our own scrape, so running it over a corpus somebody else
assembled proves little by itself. `corpus_shift.js` applies the project's own **team-invariance**
signal to both, before and after filtering:

| corpus | accounts flagged | games touched | after filtering |
|---|---|---|---|
| open-sheet | 1 | 50 of 4,167 (1.2%) | 0 remain |
| closed ladder store | 7 | 1,980 of 14,878 (13.3%) | 0 remain |

The scraped open-sheet corpus is **less** bot-contaminated than our own ladder store, not more. But
the rule needs ≥50 games from one account to fire and only 6 of 2,149 open-sheet accounts play that
many, so this is a **floor on detection, not a clean bill of health** — the right phrase stays "no
bot detected", never "human".

### Move quality barely varies with rating, which is a finding about the metrics

Raised alongside: low-rated players make rule-ignorant plays — Prankster Taunt into Farigiraf, Fake
Out into Tsareena. Measured against the protocol on the clean closed store:

| rating | failed | immune | super effective | blocked action |
|---|---|---|---|---|
| under 1100 | 2.59% | 1.94% | 22.59% | 4.66% |
| 1100–1250 | 2.38% | 2.13% | 21.57% | 4.25% |
| 1250–1400 | 2.34% | 2.40% | 20.50% | 4.25% |
| 1400+ | 2.30% | 1.61% | 21.21% | 3.43% |

Blocked actions do fall with rating. Failed and immune moves are **flat**, and low-rated players hit
super effectively *slightly more often*. So the open-sheet corpus being ~185 rating points weaker is
less dangerous than it looks — but the sharper consequence is that **these realism metrics are not
skill metrics**. Matching a human failure rate makes the bot human-*like*, not good, and ALAKAZAM
eventually needs the second thing.

### A gap the feature set cannot represent, now named

The specific plays raised are real and present: **Armor Tail 52, Queenly Majesty 9** in the clean
closed store. **No feature in `board.js` can represent any of them** — `immune` is computed from
**types only**, so ability-based immunity (Levitate, Flash Fire, Storm Drain, Sap Sipper) and
priority-blocking abilities are invisible to the model. Recorded in `data/policy-weights.json` and
DEFENSE §6 as a known hole rather than fixed here; at ~0.2% of moves it is a small slice of the
remaining 3.87-point failed-move gap, and switching is the larger prize.

---

## [3.7.0] — 2026-07-26

### The scoring bot — a player that looks at the other side of the field

Backlog item 3, and the one everything else was waiting on. The behaviour clone answers a single
question — *what does this species usually click?* — and is blind to the board. That showed up as two
numbers no amount of prior-tuning could fix, and it made every `build_lab` result a measurement of
what beats **bad** play.

- **`engine/board.js` (new)** reconstructs the state a decision was made against, and turns
  (move, target) pairs into features. Every "this move cannot work right now" test reads a dex **data
  field** — `move.status`, `move.sideCondition`, `move.pseudoWeather`, `move.weather`,
  `move.stallingMove` — and compares it against tracked state. **No move is named anywhere in the
  file**, so a move added by a future regulation is handled without an edit (S13).
- **`engine/fit_policy.js` (new)** fits those features to what people actually clicked, by
  conditional logit over **2,240 clean open-sheet games and 48,538 decisions**.
- **`engine/score_policy.js` (new)** is the player. `engine/mew.js` gains `--policy score`.

**Why open team sheets.** A choice model needs the *choice set* — the moves that could have been
clicked. A normal replay only reveals moves that were **used**, so alternatives reconstructed from
revelation are biased by revelation itself. Open sheets publish all four moves of all six up front.
The caveat is recorded in the weight file: open-sheet play involves less hedging against unknown
sets, so the weights are learned on a slightly different game than the one they are played in.

**Held out by game** (decisions inside a game are correlated, so splitting by decision leaks):

| model | logL/decision | top-1 |
|---|---|---|
| uniform over candidates | −1.7627 | 24.1% |
| behaviour clone alone (the current bot) | −1.9302 | 27.1% |
| board-aware fit | **−1.6006** | **33.6%** |

In-sample −1.5997 against held-out −1.6006, so it is not memorising games; weights identical at 200,
300 and 500 iterations.

**Two findings worth stating on their own.** The behaviour clone alone scores **worse than picking
uniformly at random** (−1.93 against −1.76), and the fit puts only **+0.25** on it — it is saying the
clone is far too confident about the popular move. And the largest learned effects are not about
damage at all: they are the "this move is already dead" features, at −2.3 each. Reading the board
turns out to be mostly about **not clicking moves that cannot work**.

### Measured out of sample — 600 seed-matched battles per policy

The fit never consults the realism report; it is held back as the out-of-sample check, because it
stops being evidence the moment it becomes the objective.

| metric | prior (was) | score (now) | real |
|---|---|---|---|
| moves that were super effective | 9.71% | **14.91%** | 21.37% |
| moves that outright failed | 9.68% | **6.34%** | 2.47% |
| moves that hit an immune target | 4.30% | **2.92%** | 1.91% |
| moves that were Protect-type | 21.62% | **16.71%** | 13.87% |
| moves resisted | 14.78% | **9.92%** | 11.20% |
| turns per game | 11.57 | 10.70 | 8.35 |
| games containing a mega | 81.15% | 84.78% | 98.52% |
| usable games of 591 | 382 | **427** | — |

Both target gaps roughly halved. Immune moves and Protect spam fell without being targeted, and more
games survive the quality filter, so the games are less degenerate.

**Aiming is most of it.** `RandomPlayerAI` picks which foe to hit with `prng.random(2)` *before*
`chooseMove` is called, so the target was a coin flip no matter how good the move choice was — and in
doubles, aiming is most of what "super effective" means. 13,474 decisions in this batch chose a target.

**It samples, it does not take the best move.** A greedy bot sails past 23.4% super-effective and is
*less* human, not more. Same argument as DEFENSE §2: a corpus is closest to reality in distribution
when it is drawn from the distribution.

### Reported plainly: one metric moved the wrong way, and it is measurement

Distinct sets per species goes from 0.53 above real to **4.21 above**. This change does not touch set
generation at all, so the underlying diversity cannot have moved. The scoring bot uses more of its
moveset, so it **reveals** more: 2.00 moves per set against the prior policy's 1.90 and a real 1.70,
and distinct counts over partial views grow with revelation depth. This is exactly the confound
BACKLOG item 1 documents.

Switches per game barely moved (8.31 → 8.38 against a real 10.67) because the switch decision is
inherited untouched. Said because it is the next thing, not because this release quietly does it.

### Four silent failures found and fixed

- **Pokemon were being buried alive.** HP was tracked as cumulative damage and the store records no
  healing, so mons drifted to zero and left the field without ever fainting. **1,219 unmatched clicks
  were aimed at a foe the tracker had already retired.** Faints now come only from faint events.
- **Spread moves were scored as status moves.** Rock Slide, Heat Wave and Dazzling Gleam were treated
  as target-less, so their type effectiveness read as zero — a large share of all damage in doubles.
  Once corrected, `tgtHurt` flipped from −0.19 to **+0.31**: humans do finish weakened targets.
- **A locked two-turn move killed the battle.** The request omits `target` for a charging move, and
  defaulting the missing field to `normal` made the engine reject the choice outright.
- **MEW reported the new policy through the wrong counter**, printing "0.0% sampled" and "the policy
  sampled NOTHING — do not use this batch" over a run in which 100% of decisions were scored. A false
  alarm on that line is worse than none: it is the line that catches a genuinely dead policy. Team
  preview accounting also moved out of the prior-only branch, where it would have silently stopped
  being reported.

### `engine/selftest.js` grows a board-reading section

Six checks, all of failures that would otherwise look fine: the weight vector matching the feature
list it was fitted against (insert a feature without refitting and every later weight silently
applies to a different quantity), a refit that comes out worse than the policy it replaces, a damaged
Pokemon staying on the field, per-foe scoring, spread scoring, and a dead move expiring on its own
from the dex duration.

One of those checks was itself wrong on the first run: it asserted Rock Slide scores above zero
against Garchomp and Incineroar, whose effectiveness is −1 and +1 — an average of exactly zero. It
failed while the code was correct. Fixed by choosing two Rock-weak foes, and recorded here because it
is the same error class the file exists to catch: an expected value arrived at by assumption.

The clean-data check now recognises `quality.reasons()` as a genuine filter alongside `loadGames()` —
it is the entry point for a record judged on its own structure rather than by store id, and rejecting
it would have pushed a correctly-filtered file into declaring `RAW-STORE-OK`. Still RED on the same
**18** undeclared raw readers; that is the tracker, not a regression.

---

## [3.6.0] — 2026-07-26

### The build space is now derived from Smogon instead of typed by hand

`build_lab` split moves at a hand-written `LOCK_AT = 85`. That violated S12/S13 and was wrong in both
directions: it called Garchomp's Earthquake a free choice at 76.9% usage, and said nothing at all
about how much room was left once the four most common moves were fixed.

- **`engine/set_space.js` (new)** replaces the threshold with an identity. Smogon's move percentages
  are shares of sets and every set has four moves, so the listed percentages plus "Other" sum to 400.
  Therefore `freedom = (400 - sum of the top four) / 100` reads directly as *slots a real player
  changes*: Garchomp 0.71, Farigiraf 1.47, Kingambit 0.59. Across 259 species with 2,000+ teams the
  four most common moves account for **68% of every move slot played**.
- **Where a cutoff is genuinely needed there is an exact one.** Always-including a move that sits on
  a fraction `p` of sets matches reality on `p`; sampling it matches on `p² + (1-p)²`. The difference
  is `(2p-1)(1-p)`, so always-include wins **exactly when p > 1/2**. No tuning, no judgement.
- **The blind spot is now quantified and printed.** Smogon buckets rare moves as "Other" at 15–20%
  per species, so `1 - (1 - other/400)^4` ≈ **17% of real sets contain a move no prior of ours can
  propose** (median 17%, worst 19%; Kingambit 3%). This is a floor on set realism and had never been
  written down. Spreads are worse — Garchomp's spread "Other" is 38.4% against 19.8% for moves.

### `build_lab` runs a full factorial

One-factor-at-a-time cannot detect interactions, and factorial designs need fewer runs for the same
power. The design now crosses move-combinations × items × spreads.

**Confirmed on the first 240-battle smoke run:** Adamant beats Jolly by ~10 points **under Life Orb**
and does nothing **under Choice Scarf**. Neither sweep alone could have produced that sentence.

### Three bugs found by that run

- **`fillSet` ignored a caller-supplied spread** and re-sampled from the prior, so any experiment
  holding the spread fixed was not holding it fixed.
- **`build_lab` forwarded only moves/item/ability into `packTeam`**, dropping the spread entirely, so
  all three spread arms were the same team. The tell was win rates identical *to the decimal* across
  supposedly different arms — a genuinely varied factor cannot tie that exactly.
- **The results table never printed the spread**, which is how the above survived a full run looking
  like a tie rather than a defect.

### A previously reported cause was tested and disproven

BACKLOG item 1 claimed the set-diversity gap came from too thin a candidate pool. Measured: the
correlation between our pool size and the gap is **0.04** across 28 species — none. Every species has
~7.8 candidates, Rotom-Wash and Garchomp alike, and Rotom-Wash has no gap.

The measurable cause is **mode collapse**: we produce the single most common set **48%** of the time
against a real **44%**, concentrated exactly where the gap is — Toxapex +18 points, Whimsicott +15,
Garchomp +11, Kingambit **−2** (we are slightly *more* varied than reality).

### Documentation

- **`docs/METHODOLOGY.md` (new)** — every design choice with the literature behind it: common random
  numbers for paired comparison (Goldsman; Nelson & Matejcik 1995; Yang & Nelson 1991) including the
  negative-covariance failure mode; factorial versus OFAT (Czitrom; Box/Hunter/Hunter); self-play
  overfitting and league training (AlphaStar; Minimax Exploiter; NeurIPS 2023); Benjamini–Hochberg.

---

### Mega rate 74% -> 80%, and three ruled-out causes

The preview draw now knows about mega stones. `bring_priors.js` measures two numbers from real
protocol logs — **77.5%** of real sides mega at all, **57.7%** of megas are one of the two leads —
and `chooseTeamPreview` aims at both. On 300 seed-matched games with identical teams, only the
preview policy changed: **71.6% -> 80.1%** of games contain a mega, 0.96 -> 1.07 megas per game.

The species priors could not express this, because "Charizard" and "Charizard holding Charizardite Y"
are the same key and different decisions.

**The previously stated cause was wrong.** BACKLOG said "real players bring their mega". Smogon's raw
counts against real counts say a mega forme is brought **0.90x** as often as a non-mega. Ruled out by
measurement, not argument:

- **team generation** — 1.54 stones per packed team against the 1.58 Smogon implies; stones match
  their holder 99.6% of the time
- **the form-change probability** — 0.85 to 1.0 moved the rate 0.7 points. Now a `--mega` flag so the
  claim can be re-checked
- **Terastallization stealing the roll** — `RandomPlayerAI` checks tera before mega, but Champions has
  no tera at all: measured 0.00 per game

The cause was the **lead**, not the bring.

**Residual, unfixed:** 80% against 93%, 1.07 against 1.58 megas per game. Form-change 1.0 on top of
the fix gives 80.5%, so that is saturated. Most likely a back-slot holder still reaches the field less
often than a human's, consistent with 4.3 switches per game against 5.7 — downstream of the scoring bot.

---

### Adversarial review, and an engine selftest

`docs/REVIEW-2026-07-26.md` — two passes at v3.6.0, statistical and engineering, every finding
grounded in a measurement or a line of code. **Three of the defects it found were in the measurement
apparatus rather than the model**, and one of those reverses the project's top backlog item.

- **Set diversity is CLOSED — the gap never existed.** `realism_report` capped the generated corpus
  with `--limit` but read the real one in full, and distinct-counts grow with n mechanically. Compared
  at matched n across 76 shared species: **13.2 distinct sets per species for us against 11.3 real.**
  We are slightly *more* varied than the ladder. It had been reported as a defect three times.
- **`build_lab` compared each arm to a field mean containing that arm**, shrinking every effect by
  exactly `(m-1)/m` — 17% at m=6, 1.2% at m=84, so it hid in the small runs people iterate on.
- **The factorial took a nested prefix when subsampled**, freezing the move axis and confounding
  factors with loop position. Now stride-walked, coprime to the cell count.
- **`--conc` does nothing** — 14.9 / 14.4 / 14.3 games/sec at conc 1 / 4 / 12. The simulator is
  CPU-bound and single-threaded; the 46 games/sec figure is a 12-**process** number and no tool here
  fans out. `set_space` now prints both, so the top-14 factorial is honestly ~39 hours as shipped.

**`engine/selftest.js` (new)** — 17 assertions on the parts that fail silently, no Showdown checkout
needed. It found a bug on its first run: an unlisted forme resolved to nothing and produced an
**empty moveset**, so the Pokémon plays Struggle all game and nothing is raised. `forSpecies` and
`resolveSpecies` now strip trailing hyphenated qualifiers progressively — a rule that covers formes
nobody has thought of yet, replacing a hand-kept list that was itself an S13 violation and had
already failed three times.

**Known and NOT fixed:** every `build_lab` win rate is still conditioned on a pilot that does not read
the board (super-effective 10.8% against 23.3%, failed moves 8.6% against 2.7%, games 10.1 turns
against 6.3). That makes every current build result provisional, and it is why the scoring bot is
the top of the backlog. `build_lab` also tests one host team against 40 opponents without saying so.

---

## [3.5.0] — 2026-07-26

### The self-play corpus was not modelling this format

Four independent defects, none of which errored, combined to leave 199,524 self-play games with
essentially **no mega evolutions** — in a format where **93% of real ladder games contain one**.

- **The player was never told it could mega.** `RandomPlayerAI` defaults `mega` to 0 and
  `engine/mew.js` never passed the option. Now passed as a per-decision probability.
- **The teams had no stones.** `fillSet` consulted Smogon's *base-forme* item list first, which
  contains no stones at all. Our own parse of real Champions replays does. Our measurement now wins.
- **Every Tyranitar held a stone.** `gearPriors` kept only the mode, turning a choice into a species
  trait. The full distribution is kept and sampled.
- **Megas used base-forme moves.** Mega Dragonite is special, ordinary Dragonite is physical, and 26
  mega formes had their own priors sitting unused. Unrevealed slots now re-drawn from the mega forme.

Result: **54.7% of self-play games contain a mega**, from ~0%.

### Smogon's statistics adopted, after verifying the methodology

We had been deriving from ~1,700 clean replays what Smogon publishes from **1,163,315 battles**.
Before relying on it, the key claim was checked: does Smogon know a Pokémon held a mega stone even
when it died without revealing it? **Yes — verified three ways.**

- **Raw counts sum to exactly 12.00 per battle** (13,959,780 ÷ 1,163,315). A VGC battle has 12
  Pokémon across the two teams, so every team slot is counted, brought or not. The `Real` column is
  5.49 per battle — that one is appearances.
- **They publish EV spreads**, which are never revealed in battle and can only come from team data.
- **Base-forme Charizard's item list contains zero mega stones.** Reveal-derived data would show
  stone-holders that died in the base entry. None appear.

Now parsed and available: **mega formes as separate species** (`megaInfo()`), **Checks and
Counters** with 95% intervals, **full teammates** (was truncated to 10), **viability ceiling**.

Stone-holding rates, weighted usage, 2026-06 cutoff 1630: Charizard 99.3% (Y 96.1% / X 3.2%),
Swampert 98.0%, Metagross 96.0%, Raichu 88.3%, Staraptor 81.7%, Tyranitar 66.0%, Aerodactyl 58.3%,
Venusaur 55.5%.

**Retracted from earlier the same session:** the claim that Smogon's non-mega share was inflated by
Pokémon that carried a stone and died before using it. It is not — those are counted under the mega
forme. The base entries are genuinely stone-less builds.

### The bots do not know the type chart

Measured, bots vs humans: hit something **immune** 4.3% vs 2.2%; **super effective** 9.9% vs
**23.4%**; **outright failed** 10.3% vs 2.7%. Super-effective-to-immune ratio 2.3:1 against humans'
10.7:1 — one bot move in twenty-three does literally nothing.

### Also

- **Redundant protection moves.** Sets held both Protect and Detect (1.1% of protection users across
  40,000 games). Redundant families now capped at one member per set, in both draw paths; 0 of 4,800
  after.
- **Mega timing confirmed.** Of 16,631 mega events in real games, **zero** occurred on the mon's
  switch-in turn — switching is that turn's action. 1.88% of switch-ins faint before acting.
- **Seed base wrapped every 2.78 hours** (`Date.now() % 1e7`), regenerating identical battles under
  fresh ids. Fixed, plus a guard against the engine's 28-bit seed ceiling. Adjacent seeds were
  checked and are *not* correlated.
- **Site numbers generated, not typed** (S13): dataset counts, team count, matchups and turns-per-game
  now derive from `data/live.js`, each tile showing its own arithmetic. Turns-per-game had been
  computed over all 12,872 collected games beside a tile using clean games only — corrected to 8.3.
- **MEW's replay viewer replaced** with Pokémon Showdown's own player. MEW stores the exact Showdown
  protocol, so it reads our games with no conversion; the hand-written viewer is deleted.

### Superseded

The 199,524-game corpus is **obsolete** — every game was played with no megas, wrong items, and mega
Pokémon using base-forme moves. Mechanically valid, but not this format. Regenerate before analysis.

Full write-up: `docs/FINDINGS-2026-07-26.md`.

## [3.4.0] — 2026-07-25

### Fixed — six defects in MEW, every one found by testing the chain before the first large run

The self-play engine had been built, validated and benchmarked, and was about to generate a corpus.
Testing it end to end first — from team construction through to the file PORY actually reads — found
six faults. Four of them produce data that looks completely normal and is quietly wrong, which is the
only kind of bug that matters for a training corpus. Recorded in the order they would have done
damage.

**1. Four in five self-play teams were illegal.** `BattleStream` does not run the team validator; it
plays whatever it is handed. Showdown's own `TeamValidator` rejected **80.5% of the pool (161/200
teams)**. The dominant cause was Item Clause — VGC permits one of each item per team, the set sampler
drew items independently per species, and **66 teams carried two Focus Sashes**. Every such game was
played with a team no human could bring, and nothing anywhere reported a problem.

`packTeam` now enforces Item Clause during packing (resampling from the species' own measured item
distribution rather than blanking the item, which would have biased the corpus toward itemless
Pokemon), then validates and repairs, and MEW discards anything still invalid instead of recording
it. **100% valid**, at a measured 9.6% throughput cost — 4.30 ms/team with the validator cached, and
constructing it per call rather than once accounted for 6.5 ms of the original 7.7.

The hand-rolled learnset check written first was itself wrong — 40 false positives on cosmetic formes
(Sinistcha-Masterpiece does learn Matcha Gotcha). Asking the official validator is both correct and
less code. S12 applies to legality rules as much as to constants.

**2. Illegal abilities, 0.4% of packed sets.** Meowstic with Intimidate, Snorlax with No Guard,
Gardevoir with Good as Gold. Abilities were sampled from observed sets keyed by species name and
never checked against the species. Intimidate alone shifts every physical damage roll against that
side, so these silently corrupted the battles they appeared in. Now clamped to the species' legal set
and **reported in `filled`** — a silent correction would hide the ingest fault that produced it.

**3. Matchup coverage was 0.15%.** Both teams were drawn as linear functions of the same seed:

    const a = teams[(seed * 2654435761) % teams.length];
    const b = teams[(seed * 40503 + 17) % teams.length];

Two linear maps of one counter do not explore a 2-D space, they walk a 1-D lattice through it.
Measured over 1,000,000 sequential seeds on a 1,326-team pool: **1,325 distinct matchups of 879,801
possible, each replayed ~755 times**, and zero mirror matches despite a comment asserting they
occurred. Independent random draws would have reached 68%.

Matchups are now **enumerated** over the triangular index of unordered pairs, verified bijective at
T=5, 50 and 1,326 (879,801 pairs, every one exactly once, zero malformed). The walk order is
scrambled by a stride coprime to the total, so coverage stays exactly-once while any **prefix** of an
interrupted run remains spread across the whole pool rather than being one team's matchups.

**4. Team preview was a constant.** `RandomPlayerAI.chooseTeamPreview` returns the literal `'default'`
— bring slots 1-4, lead 1-2 — and `PriorPlayerAI` did not override it. Every game with a given team
therefore made the identical preview decision: **1 of C(6,4) x C(4,2) = 90 choices per side**,
forever. Team selection is a large share of VGC skill and it was a fixed constant.

It is now sampled from measured ladder behaviour (`engine/bring_priors.js`: P(brought | on team) and
P(lead | brought), shrunk by 10 pseudo-observations). Uniform sampling over all 90 was rejected
deliberately — most brings are ones no player would make, and the corpus would fill with positions
that never occur. The lead rankings have face validity: Grimmsnarl 84%, Talonflame 82%, Whimsicott
77%, which are the format's actual screens and Tailwind leads. `p_lead` is measured from turn-1 leads
and is unbiased; `p_bring` comes from REVEALED species and is biased down, so it is a ranking rather
than a calibrated rate.

A consequence worth stating plainly: the 40–92% spread in per-species bring rates reported earlier in
this session was **positional artifact of the constant `default` bring**, not preference. It is
retracted.

**5. Battles were not replayable.** `>start {seed}` seeds the battle's dice; it does nothing for the
players, whose PRNG defaulted to a fresh random seed, and two draws in the policy used
`Math.random()`. A recorded seed therefore reproduced the damage rolls but not the decisions, and the
game diverged at the first choice. Any claim of the form "this switch is what won the game" was
unfalsifiable. Both players are now seeded from the battle seed via `PRNG.get`, and every sampling
draw uses the player's own PRNG. **Verified: 25/25 games byte-identical across separate runs** once
the `|t:|` wall-clock line is excluded.

**6. Writes were not durable, and the claim that they were is retracted.** The record and log streams
were `createWriteStream(..., {flags:'a'})`, described in a comment as keeping everything already
flushed if a run were killed. That was false. Observed directly: during a 12-worker run **every shard
sat at exactly 0 bytes for fifteen minutes** while each worker held ~500 MB resident. Records are
~5 KB, workers out-produce the disk, and Node answers backpressure by queueing in memory — nothing
reaches disk until the stream closes at process exit.

Three consequences: a killed worker lost **all** of its games rather than the last few; memory grew
in proportion to games generated (~170 MB queued per worker at 16,667 games); and progress was
invisible, which is how a **healthy 200,000-game run was mistaken for a hung one and killed at 15
minutes**, when each worker needed ~1.7 hours. Batched `appendFileSync` (50 records) bounds memory
and lands data continuously — verified at 7 MB / 21 MB / 31 MB on disk at t=20/40/60s of a live run.

### Fixed — the JS/Python parity test was verifying nothing

`tests/test-quality.js` probed `python3`, `python`, `py -3` and skipped with exit 2 when none worked.
On Windows all three resolve to the **Microsoft Store alias stub**, which prints "Python was not
found" and exits 9009 — while a working Python 3.12.10 sits in `%LOCALAPPDATA%\Programs\Python`. The
test that guarantees the two quality filters select identical games had therefore been skipping on
the development machine, reporting success while checking nothing.

`engine/python.js` (new) resolves a real interpreter by **executing** each candidate and requiring it
to echo a token — a name resolving on PATH proves nothing — and additionally searches the standard
install roots. The probe had been duplicated in `server.js` and the test and had drifted; it is now
one reader (S12). The parity check now runs: **27 passed**.

### Added

- `engine/bring_priors.js` — measured bring/lead propensities from clean ladder games.
- `engine/state_encoder.py` — a rich per-turn state encoding (121 features): HP per slot, active vs
  benched, status, boosts, weather/terrain/Trick Room/Tailwind/screens, hazards, active types. Both
  perspectives are emitted with sides swapped, because antisymmetry in the two players is a property
  of the game and a model trained on p1's view alone will not respect it.
- `engine/pory_nn.py` — the network-versus-baselines comparison, eight arms on one split.
- `engine/python.js`, `build/serve.js`.

### Changed

- `engine/mew_farm.js` — **`--conc` now defaults to 1, not 4.** The prior default cost 4x. Measured on
  8 physical / 16 logical cores: 8 procs at conc 4 gave 11 games/sec, the same 8 procs at conc 1 gave
  38. The simulator is synchronous and CPU-bound, so in-process concurrency never overlaps real work —
  it holds N battles live at once and multiplies GC pressure. 12 procs / conc 1 reproduced at 44–46.
  Two earlier throughput figures in this file are retracted: a projection of 131 games/sec
  (extrapolated from one process, never measured) and a claim that scaling collapses past 4 processes
  (measured, but every row carried the bad `--conc`, so a config artifact was written up as a hardware
  limit). Run-to-run variance is large — 8/conc-1 measured 37.8 and 15.1 on identical config — so
  single microbenchmarks here are worth ±2x.
- `engine/mew_farm.js` — merges the raw-log shards. It previously deleted the entire shard directory
  at merge, **destroying every protocol log a distributed run produced** at the moment it succeeded.
  Single-process runs kept them; the farm silently did not.
- `engine/mew.js` — writes a `.raw-logs.jsonl` sidecar in the ladder's own `{id, uploadtime, log}`
  schema. MEW captured the full omniscient log, passed it to `extract()`, and discarded it; but
  `extract()` produces game-level summaries and every value model reconstructs board states from the
  **protocol log**. A million games in the old format would have been unreadable by the model they
  exist to train.

---

## [3.3.0] — 2026-07-25

### Added — Smogon's official statistics, archived monthly, and what they immediately corrected

ABRA's ladder collection began 2026-07-22. Reg M-B started mid-June, so five weeks of the regulation
are missing and are **not recoverable**: Showdown's replay search exposes only a recent window, and
although an old replay still resolves by id, the ids are not discoverable — an archived sample of 324
Reg M-B games spans 1.9M sequential ids, because Showdown numbers across every format at once. Data
not captured at the time is gone.

Smogon has been computing statistics over the **whole ladder** throughout and publishes them monthly.
`engine/fetch_smogon_stats.js` archives them and `.github/workflows/smogon-stats.yml` runs it on the
4th and 11th of each month — in CI rather than on a machine, because a cron in the cloud cannot be
forgotten and the files stop being retrievable if nobody takes them. June 2026 backfilled: 16 files,
5.4 MB, both Reg M-B formats at cutoffs 0/1500/1630/1760.

**Cutoffs are weightings, not subsets.** All four files report the same 1,163,315 battles; the cutoff
changes how heavily strong play is weighted. "1760" never means "only 1760+ players".

#### Every Pokémon had a flat SP spread. That was wrong in every damage figure.

`champions_sim.js` gave every Pokémon `11/11/11/11/11/11` and nature Hardy, justified as "spread
evenly when unknown rather than maximising, because maximising would systematically overstate every
unknown Pokemon". The caution was right and the result was still badly wrong.

Real Garchomp runs **Jolly 2/32/0/0/0/32 on 42% of sets**. Since `stat = base + SP + 20`, that is
Attack **182** against the flat assumption's **161** — the format's most-used attacker understated by
**13%**, in every damage number the project has produced and in every MEW battle generated.

Flat spreads also erase the format's shape: **92% of real spreads touch the 32-per-stat cap**, so a
flat one invents a jack-of-all-trades that exists nowhere on the ladder.

`engine/smogon_priors.js` parses the moveset files into per-species spreads, items, abilities, moves
and teammates — 283 species. `set_priors.js` now samples a real spread proportional to how often it
is run, and prefers Smogon's **P(move is ON the set)** over our `move-priors.json` **P(move | action)**,
which is a different quantity: a move clicked rarely can still sit on most sets. Smogon's percentages
sum to ~400% precisely because every Pokémon carries four.

**Two mechanics confirmed against an independent source.** The SP budget is 66 and 97% of real
spreads spend all of it. And SP is capped at **32 per stat** — an early version asserted "sums to 66"
and flagged 100 spreads including `Jolly:32/0/0/0/0/32`, which sums to 64. Those were not malformed;
a two-stat spread cannot spend more, however much budget remains. Both invariants are now asserted.

### Fixed — open team sheets were parsed and then discarded

CHANGELOG 3.0.0 claimed "open team sheets are now parsed … the entire hidden-information problem
removed". The parsing landed; the **use** of it never did. `extract()` built its output only from what
play revealed and never merged the `sheets` it had just captured, so an open-sheet game came out
exactly as blind as a closed-sheet one. ARCHITECTURE fault 1.4 again — a fix applied to the wrong
artifact and reported as done.

Caught by importing an archived OTS corpus and noticing impossible numbers:

| | moves/4 | no item | no ability |
|---|---|---|---|
| closed-sheet ladder | 1.38 | 69.7% | 75.5% |
| OTS **before** fix | 1.50 | 69.7% | 73.8% |
| OTS **after** fix | **4.30** | **0.4%** | **10.1%** |

52,964 sets, 86% declared complete. The 1,624 Bo3 games already in the store have been blind this
whole time and will come back complete on the next reparse.

### Added — two metagames, published separately

`meta-usage.json` used to publish one distribution and call it "the metagame". There are two.

- **competitive** (filtered): what humans choose when trying. Correct for tournament preparation, for
  any claim *about the game*, and for anything an agent should imitate.
- **ladder** (everything): what you actually face. **6,297 of 8,356 stored games involve a bot —
  three in four opponents.** Filtering them out optimises for a metagame the user meets one game in
  four.

The top six differ, and informatively:

```
competitive   garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion
ladder        garchomp, whimsicott, kingambit, basculegion, charizard, incineroar
```

Charizard is 25.7% on the ladder view and outside the competitive top six — it is a bot-team member,
correctly surfacing as something you will meet.

The ladder view is not merely "unfiltered". Bots are the **most predictable opponent in the format**:
one account played 459 games with a single team, four ran the same six in 1,446. "23% of your
opponents will bring precisely these six" is more actionable than any distribution, because it is
certain rather than probabilistic.

And there is a genuine grey area, which is why both ship rather than one being chosen: **humans copy
strong bot teams to practise against**, so a bot team can re-enter the competitive metagame as a
legitimate archetype. Neither view alone is the truth. Consumers must state which they used.

### Notes — what the archives could and could not settle

- **Uploaded replays are broadly representative.** Comparing our uploaded Bo3 games against Smogon's
  whole-ladder Bo3 file for the same month and format: mean absolute difference **1.84 points** over
  the top 20 non-mega species, Spearman **0.733** across 202. Only 3.2% of battles are uploaded, but
  what is uploaded looks like the ladder. Mega formes appear to differ wildly only because Smogon
  counts the mega as its own species while our extractor collapses megas to base forme.
- **Our bot filter is far more aggressive than anyone else's.** Smogon does not filter bots at all
  (it weights by rating); VGC-Bench filters for open sheets only. Ours removes ~75% of the store.
  Consequence: **our filtered numbers are not directly comparable to theirs.**
- **The store is 8,757 unique games, 0 duplicates**, after a night of pushes, rebases and CI commits.
  The `merge=union` removal is holding.

---

## [3.2.0] — 2026-07-25

### Changed — five engines now read through the quality filter, and one headline result did not survive

`war.py`, `roles.py`, `nmf_roles.py`, `vocab.py` and `counterplay.py` each carried an identical
`load_games()` that opened the store directly. They now read through `engine/quality.py`, which reads
the single definition in `data/quality-filter.json`. No threshold is duplicated in any of them.
`ABRA_UNFILTERED=1` restores the old behaviour, for demonstrating the difference only — the same
switch `analyze.js` already had.

Each engine was run **both ways on the same store**, so the difference below is the filter alone and
not the reparse.

#### WAR no longer beats a coin. The prior conclusion is withdrawn.

| | held-out log-loss | vs coin 0.6931 | accuracy |
|---|---|---|---|
| unfiltered (as previously published) | **0.6860** | beats it | 0.539 |
| clean, 1,061 games | **0.7048** | **worse than a coin** | 0.502 |

This is the finding of the release and it is a negative one. WAR was described in the white paper,
`MODELS.md`, `ROLE-FAMILY.md`, `SUMMARY.md` and `PUBLICATION.md` as the model that *did* clear the
bar — "which specific species you bring at preview carries a small real signal that roles and raw
sheets do not". **On games with no bot detected, it does not.**

The mechanism is visible in the coefficients. Basculegion's WAR falls from **281.87 to 23.64**, and
Basculegion is one of the six Pokemon that four undetected bot accounts played in 1,446 identical
games. A ridge RAPM fitted on that data is not learning which species win; it is learning which
species belong to the account that played the most games. Charizard, also on that team, is the
largest negative in both runs — the same artifact with the sign reversed.

Accuracy of **0.502** is the plainest statement of it: on clean data the species model is a coin.

This does not touch PORY (0.567 vs 0.693), which is measured mid-game rather than at preview and is
unaffected by this change.

#### COUNTERPLAY got stronger, and that is also informative

| | tech-vs-standard coverage gap | 95% CI | species positive |
|---|---|---|---|
| unfiltered | +0.0321 | (0.0078, 0.0561) | 72/124 (58%) |
| clean | **+0.0707** | **(0.0252, 0.1179)** | 36/55 (65%) |

More than double, with the interval further from zero. This is the expected direction once the
mechanism is stated: the claim is about **human** choices — that players spend spare move slots
answering the metagame — and a bot never re-teches. Bot games were not noise here, they were
counter-evidence, and removing them sharpened the effect rather than shrinking it.

The top-threat list also corrects to the post-filter metagame:
`garchomp, incineroar, kingambit, sinistcha, basculegion, whimsicott`.

#### ROLES is unchanged in conclusion, corrected in magnitude

Preview roles still tie a coin — held-out log-loss **0.6915** vs 0.6931, CI (0.6783, 0.7049), which
contains the coin. That conclusion has never moved and does not move now.

The **role-pair median cell is 20**, across 1,051 cells. For the record of a number that has been
wrong in three documents for two versions:

| figure | where it came from | status |
|---|---|---|
| n = 7,971 | v2.6.0, over-tagged (19.6 of 26 roles per team) | retracted in 2.7.0, **still printed in the white paper, ROLE-FAMILY.md and PUBLICATION.md** |
| n ≈ 95 | 2.7.0, credible tags, 27 roles | superseded |
| n ≈ 50 | 2.8.0, 39 roles | superseded |
| **n = 20** | **this release: 52 roles, 1,061 clean games** | current |

The direction is the honest story: every step that made the taxonomy more precise, and now the games
cleaner, has cost cell size. n=20 is still above the single-label archetype cells (11–18) that
motivated the role model, but the pooling argument is far weaker than 7,971 ever suggested.

#### VOCAB and NMF

VOCAB: 1,061 games, 26,677 move events, 380 distinct moves; curated roles cover **97.3%** of real
in-battle move usage. NMF still factorises cleanly. Neither makes a claim that turns on the filter.

### Notes — why this was the right thing to do before any model work

The project's own build order (`docs/ALAKAZAM-v2-spec.md`) is inputs first, capstone last. The store
and the rules engine were secured earlier today; the filter was the third input and the only one
still broken. Wiring it first meant WAR's result was retracted **before** anything was built on top
of it, rather than after.

**28 engines still read the store raw.** These five were done first because they share an identical
`load_games()`, so one patch reached all five.

---

## [3.1.2] — 2026-07-24

### Fixed — the store duplication was `merge=union`, not `merge -X ours`

The diagnosis carried in `docs/HANDOFF-2026-07-24.md` and `docs/PROJECT-HANDOFF.md` named
`git merge -X ours` as the confirmed cause of the store duplicating three times. That is wrong, and
acting on it would not have stopped a fourth occurrence.

`.gitattributes` carried `data/games.ladder.jsonl merge=union` (and a catch-all `*.jsonl
merge=union`), added to stop the ingest Action's merge conflicts, with the note "readers dedupe by
id, so duplicate lines are harmless".

`merge=union` resolves a conflicting hunk by concatenating **both** sides in full. On an append-only
log every divergent reconciliation replays the entire appended block, doubling it. The decisive
point the old diagnosis missed: **the union driver applies to `git rebase` as well as `git merge`.**
Rewriting `push-all.bat` to use `--rebase` (shipped in 3.1.1) therefore did not remove the mechanism;
it only changed which command triggered it.

The merge driver has been removed. Divergent appends now produce a real conflict and the
reconciliation stops, which is what `push-all.bat` already expects. Resolution procedure is recorded
in `.gitattributes` itself.

The second half of the old note was also wrong: duplicates are not harmless. They break the S7
store-shape assertions and they corrupt every game count published by the site and the white paper.

### Repaired — store deduplicated, rebase completed

The repository was not in the state the handoff described. It was not a plain detached HEAD: an
interactive rebase was stopped 43 commits into 45. The documented repair (`git checkout main`) would
have abandoned those 43 replayed commits, and because `main` had diverged from `origin/main` by two
`ingest:` commits, the subsequent push would have been rejected as non-fast-forward — the exact point
at which a reconciliation strategy gets reached for. The rebase was completed instead; it finished
clean, with no conflicts.

`engine/dedupe_store.py --write` then took `data/games.ladder.jsonl` from 16,139 lines to **8,000
unique**, 0 duplicates, 0 unparseable, and a second run is a no-op. The store is 8,000 rather than
the 7,547 the handoff predicted because the two `ingest:` commits already on `origin/main` added
games after that document was written.

### Known issue — `sanity_check.py` reports 96 assertions, 94 passed, 2 failed

Reported plainly rather than worked around. Both failures are S7 store-shape:

    FAIL  store shape: every `brought` is a subset of `six`  (1,006 bad of 8,000 games)
    FAIL  store shape: nobody brings more than four
          ({0: 180, 2: 1001, 3: 1929, 4: 12022, 5: 845, 6: 23} over 16,000 player-sides)

These are **not** introduced by the deduplication, and not introduced by keeping the first of each
duplicated id. Evidence: the deduplicated store is byte-identical to the one already on
`origin/main`, and the same check run against the pre-incident merge base `4a5b455` is far worse —
11,239 bad player-sides, with 9,364 sides showing five brought and 3 showing seven. The current
figures are an improvement on the pre-incident store, not a regression from it.

**Cause established — battle forme changes are appended to `brought`.** Of the 1,033 offending
entries, **1,003 contain `mega`**; the remaining 30 are `palafinhero` (18), `aegislashblade` (7),
`mimikyubusted` (4) and `morpekohangry` (1). Zoroark accounts for **zero**. Every case is the same
mechanism: a forme change during battle is recorded as an additional species in `brought`, while
`six` carries the base forme, so the side shows five or six brought and the forme name is not a
member of `six`.

This is `docs/ARCHITECTURE.md` fault 1.5 recurring. That fault was recorded when the mega double
count collapsed CHOMP-EV's eval set from ~1,200 games to 43, and §5 of the same document still lists
"`brought` is still 5 in ~115 games and 0 in 176; not yet explained" as an open gap. It is now
explained, and it has grown from ~115 sides to 845 at five and 23 at six.

The fix belongs in `engine/durable-ingest.js` — a forme change must update the identity of an
existing `brought` entry rather than append a new one — followed by a `MODE=reparse`, which the raw
archive makes free. Not done in this pass.

An earlier version of this entry named Zoroark's Illusion as the likely cause. That was a guess and
it is wrong; the measurement above replaces it.

---

## [3.1.1] — 2026-07-24

### Fixed — the metagame model was literally the bot's team
`engine/analyze.js`, which writes `data/meta-usage.json` (the file CHOMP reads to make
recommendations), read the store directly and filtered only on the per-player `bot` NAME flag. It now
goes through the shared quality filter.

The old top six by team usage was:

    garchomp, whimsicott, basculegion, kingambit, charizard, sylveon

That is, exactly and in full, the six Pokemon on the team four undetected bot accounts played in
1,446 identical games. The recommender's picture of the metagame WAS one bot's team.

Corrected top six: `garchomp, incineroar, kingambit, sinistcha, whimsicott, basculegion`.

| species | was | now | change |
|---|---|---|---|
| whimsicott | 31.5% | 17.9% | -13.6 |
| basculegion | 30.5% | 17.8% | -12.6 |
| charizard | 29.1% | 16.5% | -12.6 |
| sylveon | 22.8% | 10.5% | -12.3 |
| garchomp | 34.2% | 24.4% | -9.7 |
| kingambit | 30.0% | 20.4% | -9.5 |
| incineroar | 21.0% | 23.5% | +2.5 |

Sampled team-slots drop from 9,594 to 1,854. Incineroar and Sinistcha - genuine top-tier picks that
the bot did not use - were being pushed down the list by it.

### Added
- `data/meta-usage.json` now carries its own **provenance block**: source, filter, the full funnel,
  and the caveat that bot detection is a floor rather than a proof. A consumer can now tell what a
  number is a statistic about.
- `ABRA_UNFILTERED=1` recomputes over everything, for demonstrating the difference only.

### Notes
36 other engines still read the store directly. This one was done first because it is the only one
whose output is consumed by another product.

---

## [3.1.0] — 2026-07-24

### Added — the official Champions engine
Showdown's `champions` mod exists in the master branch and implements this format exactly.
`engine/champions_sim.js` runs it on `gen9championsvgc2026regmb` — the format id on every replay in
the store — at pinned commit `20ad99ff`. `engine/prior_player.js` ports our behaviour-clone policy
into it so the two engines can be compared like for like.

- `data/quality-filter.json` v1.1 — behavioural bot detection by **team invariance**. Five accounts
  the name filter missed (459 / 426 / 294 / 267 / 147 games, **one team each**) were in 52.2% of the
  previously-clean set. Clean games: 1,941 -> **927 of 7,547 (12.3%)**.
- `engine/quality.js` and `engine/quality.py` — one shared definition, cross-checked by a test that
  asserts both readers select an identical set of game ids.
- `engine/dedupe_store.py`, `build/build_browser_data.js`, `tests/test-rollout-effects.js` (39),
  `tests/test-quality.js` (24), `docs/ADR-001-use-the-champions-mod.md`.

### Fixed — the rollout engine was wrong in eight ways, all silent
Random status instead of the move's status; only Fake Out could flinch; no type or ability
immunities; priority a hand-typed table of 18 moves (all 14 negative-priority moves resolved at 0, so
Trick Room went at normal speed); flinch leaked into the next turn; **Intimidate applied
unconditionally with the sign reversed on Defiant and Competitive**; no powder immunity; Prankster hit
Dark types. Measured effect on 120 real matchups: mean **4.35** points of P(win), max 24.2, favourite
flipped in 9.2%.

Also: the nature table held 23 of 25 (Naughty and Lax fell through to neutral), and the store's
duplicate check read only the first 5,000 lines while all 401 duplicates sat past line 7,144.

### Notes — what the validation actually showed
With identical teams, an identical policy, and both engines verified symmetric on mirror matchups,
our engine and the official simulator disagree by **31.1 percentage points on average**, flipping the
favourite in 3 of 8 matchups. Everything we fixed today was worth 4.35 points. The remaining gap is
seven times larger. This is why ADR-001 replaces the engine rather than continuing to repair it.

Three earlier versions of that comparison were wrong (32.2, 23.7, and a 32.2 where the policy port
silently fell through to random on 100% of decisions). All three are recorded in the ADR rather than
quietly re-run.

### Notes — measured, not asserted
Three Champions status constants had lived as unsourced inline comments. Checked against the mod's
`conditions.ts`: paralysis `randomChance(1, 8)` = 12.5%, sleep `sample([2, 3, 3])`, freeze
`randomChance(1, 4)` with `startTime = 3`. All three correct, and all three now cited. Independently
measured from 7,948 raw logs: 13.8% [11.9, 16.0], 35.3% [31.5, 39.2], 31.6% [23.3, 41.4].

The stat formula is confirmed from `scripts.ts`: `base + SP + 20`, and HP `base + SP + 75`.

### Notes — the meta model was reporting a bot's team
Four of the five undetected bot accounts played the **same six Pokémon** in 1,446 games. Those six are
exactly the species whose usage collapses once they are removed: Basculegion 34.1% -> 17.9%,
Whimsicott 31.9% -> 17.9%, Garchomp 35.5% -> 24.4%, Charizard 26.1% -> 16.5%, Sylveon 19.4% -> 10.5%,
Kingambit 29.1% -> 20.4%. `meta-usage.json`, which CHOMP reads, carries the inflated figures.
**37 engines still read the store directly and bypass the quality filter.** Not yet fixed.

---

## [3.0.2] — 2026-07-24

### Fixed — a store check that was aimed away from the fault
`sanity_check.py` reported "no duplicate ids" while the store held **401 duplicates**. It read only
the first 5,000 lines; the duplicates all sat past line 7,144. Duplicates enter an append-only log at
the **end**, which is exactly the region a head-sample cannot see, so the check passed 95/95 on a
store that was 5% duplicated. The duplicate scan now shares the existing full-file pass.

- Store deduplicated: **7,948 -> 7,547 unique games.**
- `engine/dedupe_store.py` is new: idempotent, order-preserving, atomic rewrite.

### Notes — where the duplicates come from
Not from the ingest. `durable-ingest.js` reads every stored id before appending and refuses repeats.
They come from **git**: an append-only file reconciled by a non-fast-forward merge replays the
appended block. This happened once before (7,040 duplicates from `merge -X ours`). Because the cause
is outside the ingest, a one-off cleanup cannot hold, which is why the fix is a re-runnable script
plus a check that actually looks at the whole file.

Counts computed before this pass were inflated by ~5%, and duplicated rows narrow confidence
intervals without adding information. Models have not yet been re-run on the deduplicated store.

### Notes — the rollout engine is NOT to standard (found, not yet fixed)
Two defects in `engine/medicham2-browser.js`, recorded here rather than silently carried:
- **Status moves apply a uniformly random status.** Line 205 picks from `['brn','par','slp']` at
  random, so Thunder Wave burns a third of the time and Will-O-Wisp can paralyse.
- **Only Fake Out can flinch.** Rock Slide's 30% flinch does nothing in simulation.
The shared rulebook (`data/move-effects.json`, 954 moves, 211 with a secondary, 33 flinch) exists and
is tested, but the rollout does not read it — a second, worse rulebook that fault 1.1 predicted.

---

## [3.0.1] — 2026-07-24

### Fixed — two of the twenty-five natures were missing
`CHOMP/engine/champ-model.js` held 23 natures. **Naughty** (+Atk / -SpD) and **Lax** (+Def / -SpD)
were absent from the table, and an absent nature falls through to the neutral multiplier. Those sets
therefore computed with 1.0 where the game applies 1.1 and 0.9 — a Naughty Kingambit read 187 Attack
instead of 205. Both are now present and verified against the Champions calculator.

### Added
- **S10 — enumerate the domain, do not spot-check it.** Where a rule has a closed, known domain the
  test walks every member and asserts the expected behaviour, plus a count assertion that the
  reference list is complete.
- `tests/test-mega-and-boosts.js` now iterates **all 25 natures** and asserts the *direction* of
  change for all five stats against a neutral baseline, and pins the Champions stat formula
  (`stat = (base + 20 + SP) x nature`, `HP = base + 75 + SP`). 24 -> 28 assertions.

### Notes
- The earlier nature check reported "unexpected multipliers: none" and was **wrong to be reassuring**.
  It asked whether any nature produced a multiplier outside {0.9, 1.0, 1.1}; a missing nature produces
  1.0, which is inside that set. A missing row and a legitimately neutral row are indistinguishable by
  count, which is exactly why S10 asserts direction instead.
- `docs/ARCHITECTURE.md` -> v1.1: fault 1.9 and standard S10 recorded.

---

## [3.0.0] — 2026-07-24

### Architecture — the plumbing, reviewed and standardised
`docs/ARCHITECTURE.md` is new: a blunt review of the whole system, ten engineering standards drawn
from it, and the check that enforces each. Every fault named there is one this project actually
shipped. The pattern behind all of them was singular: **knowledge with more than one home, and no
mechanism that noticed when the homes disagreed.**

### Fixed — faults found by the review
- **Three implementations of the same rules** (canonical engine, browser rollout, embedded site
  copy). When the canonical engine learned real mega base stats the rollout was left behind and the
  two disagreed by **30%** on Charizard-Mega-Y's Special Attack, silently. Fowler's Rule of Three
  says the third duplication is the moment to act; we were past it.
- **`data/engine-data.js` stored only DERIVED values** (level-50 stat lines, no base stats). Data
  that cannot be recomputed can only be copied — which is exactly why the browser engine could not
  follow the forme fix. It is now generated by `build/build_engine_data.js` and carries base stats.
- **A mega dex merged into the wrong artifact.** 67 formes were added to `engine-data.js` and
  reported as "in the engine dex"; the damage engine reads a different file entirely, so the fix
  reached nothing. The claim was made in good faith and was false.
- **Two hand-maintained mega-ability tables** from different sources (Showdown and Serebii). They
  agreed by luck. Now one generated file, `data/mega-formes.json`, read by both.
- **Identifiers were not normalised across boundaries** (`"sand stream"` vs `"sandstream"`).

### Added
- **`CHOMP/tests/test-engine-contract.js`** — a consumer-driven contract test (the Pact pattern):
  an executable statement of what every implementation must agree on. It caught the mega drift on
  its first run. 20 assertions.
- **`CHOMP/data/move-effects.json`** — one secondary-effect rulebook generated from Showdown's
  `moves.json`: 954 moves, 211 with a secondary effect, 33 that can flinch, with accuracy, status
  chances and stat drops. Two rules that are easy to get wrong are stated once and tested:
  **a flinch only lands if the user moves first** and expires at end of turn; **a status cannot
  apply to a Pokémon that already has one**, and type immunities hold (Scald cannot burn a Fire
  type — verified at 0%).
- **Store-shape invariants** in `sanity_check.py` (S7): `brought ⊆ six`, `lead ⊆ brought`, winner is
  a player, every field present, nobody brings more than four. A parser change that breaks the store
  now fails immediately — the mega double-count silently collapsed CHOMP-EV's eval set from ~1,200
  games to **43** before anything noticed.
- **Open team sheets are now parsed.** `|showteam|` declares every Pokémon's item, ability, all four
  moves and nature — the entire hidden-information problem removed. We were detecting these lines
  only to set a flag and discarding the sets. 1,624 Bo3 games are affected; that data now accumulates.
- **Forfeit flag** captured at parse time (1,911 of 7,948 games, 24%), so quality filters no longer
  need the raw archive.

### Changed
- Mega formes: all **95 stones** now carry real base stats, typing and ability. Pre-mega state is
  explicit and overridable (`premega: true`) — holding the stone is not the same as having used it.
- Stat stages (±6) are supported for attacker and defender, with the full crit rule pinned: a crit
  **ignores** the attacker's drops and the defender's boosts, and **keeps** the attacker's boosts and
  the defender's drops. Only the first of those four was previously asserted.

### Notes
- The Champions stat formula simplifies exactly: **normal stat = (base + 20 + SP) × nature**, and
  **HP = base + 75 + SP**, for every base value 1–255. SP budget is 66.
- Largest remaining gap, stated plainly: the canonical engine's dex is still scraped from an HTML
  file and parsed with `eval()`. That is the reason the wrong-artifact fault was possible, and it is
  the top of the remaining list in `ARCHITECTURE.md` §5.

## [2.10.1] — 2026-07-24

### Changed — every model re-run on the deduplicated store
All reports were still computed on the 14,361-line store that turned out to be ~half duplicates.
Re-run on the 7,315 unique games. What survived, and what did not:

| Model | On clean data | Verdict |
|---|---|---|
| PORY (mid-game value) | log-loss **0.5648** vs coin 0.6931, ECE 1.8%, CI [0.550, 0.584] | **holds** |
| WAR (species RAPM) | **0.6856** vs coin 0.6931, accuracy 54.1% | **holds** |
| MEDICHAM damage | 100% within 5% of the Smogon calculator | **holds** |
| SLOWKING (species) | greedy 0.078 vs Nash 0.0002, gap CI **[0.0031, 0.0977]** | **holds** |
| SLOWKING (playstyle) | gap CI **[-0.0001, 0.2105]** | **no longer clears zero** |
| COUNTERPLAY tech-lift | +0.0274, CI **[0.0006, 0.0533]** (was +0.0386 [0.0155, 0.0617]) | **barely holds** |
| GURU predictive test | log-loss 0.7007 vs coin 0.6931 | still a coin, as always documented |
| CHOMP-EV | winners lean more aligned, CI includes 0.5 | still the honest null |
| XATU policy clone | top-1 32%, phase-conditioning again did not help | unchanged |

- The pattern is consistent and worth stating plainly: **the strong results were unaffected and the
  marginal ones got weaker.** Duplicated rows inflate apparent independent evidence, so they narrow
  intervals without adding information. Nothing that was solid became shaky; two things that were
  already borderline (the playstyle equilibrium gap, the tech-lift) lost the significance they had
  been credited with.
- Site data regenerated from the clean store (7,315 games, 48,326 turns, 11 archetypes).

## [2.10.0] — 2026-07-24

### Fixed — the store was half duplicates, and every sample size was overstated
- **`data/games.ladder.jsonl` held 14,361 lines but only 7,315 unique games** — 7,040 duplicate rows,
  left over from the `merge -X ours` reconciliations during the earlier git incident. Every "14,355
  games" figure quoted today was inflated roughly 2x, and duplicated rows also narrow confidence
  intervals artificially. The store is now deduplicated; **no unique game was lost** (verified by id
  set comparison against the pre-merge backup).
- **Store reparsed from the raw log archive**, so the mega/weather/terrain parsing now applies to
  history rather than only to new games. Effect: **12,146 mega events** and **8,752 weather/terrain
  events** where there were none, and setter abilities appear at last — Pelipper **Drizzle 0 -> 1,490**,
  Torkoal **Drought 0 -> 613**, Incineroar Intimidate 1,934.
- **Illegal ability readings rejected.** Log attribution is imperfect (Trace copies opponents; a
  mis-attributed slot handed Basculegion an "Intimidate" it can never have). Observed abilities are
  now validated against the species' legal set from the dex, and impossible readings are dropped
  instead of creating phantom roles.

### Changed — a result got weaker on clean data, and that is reported
- **COUNTERPLAY's tech-lift, recomputed on the deduplicated store: +0.0274, 95% CI [0.0006, 0.0533].**
  It was +0.0386, CI [0.0155, 0.0617] on the duplicated store. The interval still excludes zero, but
  only barely — the earlier version overstated the evidence because duplicate games were counted as
  independent observations. The direction stands; the confidence does not. **WAR is unaffected in
  direction and still beats a coin: 0.6856 vs 0.6931, accuracy 54.1%.**

### Notes — what "known" actually means under closed sheets
- A correction to how the new `species-abilities.json` was described. **Nothing about an opponent's
  Pokemon is known until it is proven in play — ability, item, and moves alike.** The dex narrows the
  *possibilities*; it does not reveal the set:
  - **94 species have exactly one legal ability**, so for those the species genuinely does determine
    it at preview. That is the only truly certain case.
  - **213 species have two or three**, so the ability stays a belief until the log proves it —
    Basculegion is Swift Swim *or* Adaptability *or* Mold Breaker.
  - **A mega's ability is certain only once it megas.** Before that you cannot see the stone, so you
    do not even know a mega is coming, let alone which form.
  - **Items and moves are never given by the dex at all** — only revealed by use.
  - **EVs are the hardest of all, and are never stated anywhere.** They are only *bounded*, and only
    by inference: a damage roll narrows an attacking stat to a range rather than a value (16 possible
    rolls, all consistent with a band of EVs), and moving first only proves a Speed *inequality*
    against whatever it outsped — sharpest at a known benchmark, useless in Trick Room or under a
    Choice Scarf. So an EV spread never collapses to a point the way an ability or an item does; it
    narrows to an interval that tightens with every turn. The engine's level-50 numbers assume a
    standard competitive spread and are labelled an approximation for exactly this reason.
- The consequence is a design one: this is a belief-state problem, not a lookup. The right structure
  is a per-slot information state that starts as the legal possibility set and collapses on each
  reveal. That is XATU's job, and it is the next thing to build properly.

## [2.9.0] — 2026-07-24

### Fixed — the extractor never knew mega evolution existed
- **`engine/durable-ingest.js` did not parse `|detailschange|` or `|-mega|`.** Every mega therefore
  kept its BASE form's identity, and its new ability was never attributed to anything: **904 of 906**
  Charizard-Mega-Y sets had a blank ability, and Raichu-Mega-X (Electric Surge) was indistinguishable
  from Raichu-Mega-Y (No Guard) even though they play nothing alike. Now parsed, with the mega, its
  base form and the stone recorded.
- **Weather and terrain setters were half-invisible.** A setter ability is usually stated *only* in
  `|-weather|...[from] ability: Drizzle|[of] p1b: Pelipper`, which we did not read. Verified on a live
  replay: the fix recovers `pelipper -> Drizzle` and `glimmoramega` + `Glimmoranite`.
- **`engine/roles.py` had stopped finishing** (>120 s at 14k games). Two hot spots, both replaced with
  the identical calculation vectorised: the logistic fit, and a bootstrap that was re-running the model
  600 x |test| x |roles| times when per-row losses do not change between resamples. **5.2 s** now.

### Added
- **Mega dex from the authoritative source** (`engine/build_mega_dex.js` -> `data/mega-dex-official.json`,
  merged by `engine/merge_mega_into_engine.js`). Source is Showdown's own `pokedex.json` — the data the
  server runs this format on. **67 mega formes** added to the engine dex with real types, abilities,
  base stats and required stone. Damage validation re-run and unchanged (100% within 5%).
- **Zoroark-Hisui illusion detector** (`engine/illusion.js` -> `data/illusion.json`). Illusion copies the
  NAME, not the moveset, so a legality contradiction proves the disguise: the apparent species cannot
  learn the move and Zoroark can. On 395 Zoroark team-sides it proves **156 disguises** (0.39 each).
  Most common disguise Whimsicott; the giveaway moves are Hyper Voice (32) and **Bitter Malice (30)**,
  a Zoroark-Hisui signature. Conservative by construction, so the count is a floor.
- **Weather and terrain roles split by type** — rain/sun/sand/snow and psychic/grassy/electric/misty, on
  BOTH the setter and abuser side, so "Swift Swim with no Drizzle" is a detectable defect rather than
  two generic tags that never meet. Taxonomy is **52 roles**, covering **98.0%** of real move usage.

### Notes — measured, including what it cannot yet measure
- **Mega abilities cannot be harvested from logs, at all.** Mega evolution emits only `detailschange`
  and `-mega`; no ability line follows. An earlier harvest appeared to find 9 conflicts with the
  official dex — three were **Trace** correctly copying an opponent's ability, and the rest were
  attribution noise on 1–6 observations. The official dex is the source; the harvester is kept only
  to discover which formes exist.
- **First dead-ability measurement:** 72% of teams carrying an Expanding Force user have **no Psychic
  Terrain setter**, and 99.6% of Electric Terrain abusers have no setter. The weather equivalents
  return nothing yet — those roles are ability-based, abilities only announce sometimes, and the
  Wilson credibility gate correctly drops them as under-observed. Fix is to source abilities from the
  dex (certain where a species has only one) rather than from observation; not done yet.
- The store still needs a **reparse** before any of the new mega/weather events exist historically.

## [2.8.1] — 2026-07-24

### Notes — a wrong diagnosis, corrected
- The `auto: <date>` commits were diagnosed as a rogue timer running `push-all.bat` every ~2 minutes.
  **That was wrong.** Reading the commits properly showed they are authored by the workspace's own
  auto-commit, which fires ~2 minutes *after files change*, then commits and pushes. The apparent
  fixed cadence was simply a long stretch of continuous editing. Verified: a test edit was committed
  and pushed to origin unattended, with nothing outstanding afterwards.
- Consequence: the publish automation the project needed **already existed**. The idle-publisher
  scripts added earlier today (`build/auto-push.ps1`, `AUTO-PUSH-START.bat`, `AUTO-PUSH-INSTALL.bat`,
  `find-autocommit-task.bat`) were removed — a second publisher racing the first is what wedged the
  repo mid-rebase in the first place. One publisher is correct; two is a bug.

### Kept
- `push-all.bat` stays disarmed (requires the `GO` argument) and now refuses to act on a repo that is
  mid-rebase. That guard is the durable fix and is unrelated to the misdiagnosis.

## [2.8.0] — 2026-07-24

### Fixed
- **`engine/guru.py` aborted on a truncated store line**, so the site's headline numbers were frozen
  at **5,199 games** while the store had grown past **7,400**. The ingest job appends on a schedule
  and an interrupted run can leave a partial line (6 of 7,449 lines). GURU now skips unparseable
  lines like the other engines. Map metrics are live again.
- **`engine/vocab.py` ignored the multi-role override table**, so tagged moves (Psychic Fangs, Brick
  Break, Stockpile) were reported as untagged. Coverage of real in-battle move usage is **97.1%**.
- **The MAP's hover text** was long and carried leftover nickname glosses ("(MEDIcham)"). Every node
  blurb rewritten to one plain sentence.

### Changed
- **MAP edges are curved rather than straight.** A crossing-free drawing is not possible for this
  dependency graph — ALAKAZAM has six parents spread across a row and MEDI feeds both the far left
  and the far right — so instead of claiming otherwise, each edge now bows in proportion to how far
  it travels, which separates lines that previously overlapped. Hover still isolates one path.
- **Taxonomy expanded 27 → 39 roles**, all from real gameplay distinctions:
  status split by type (**burn** = a debuff that halves Attack, **paralysis** = speed control,
  **sleep** = action denial, **poison** = a clock) — each 1,000+ uses and 20–59 species, so none is
  sparse; **spread attacker** split from **field-wide (hits your own partner)**, because Earthquake /
  Surf / Discharge constrain team building (they need an immune partner); plus **multi-hit** (breaks
  Sash, Sturdy, Multiscale, Substitute), **fixed/fractional damage** (Super Fang, Seismic Toss —
  ignores stats and the type chart), **residual chip**, **hazards** (incl. Toxic Debris),
  **substitute**, **weather/effect denial** (Cloud Nine, Air Lock, screen-breakers),
  **weather/field abuser** (distinct from setter), and **positioning** (now including Roar-family
  forced switches). Freeze is documented as functionally sleep but *not* tagged: no move in Reg M-B
  sets it, so crediting every Ice attack would be dishonest.
- Ability mapping corrected throughout: Lightning Rod / Storm Drain → redirection; Hospitality and
  Regenerator → healing; trigger-boosters (Defiant, Competitive, Moxie) → setup. Fairy Aura and Dark
  Aura are deliberately **left untagged** — they are passive, permanent, type-wide multipliers, not
  the same job as Helping Hand's active one-turn boost.

### Added
- `engine/build_roles_js.py` → `data/roles.js`; the Roles booth gains a **species explorer** showing
  any Pokémon's role *distribution* with confidence intervals, and archetypes now show their most
  distinctive Pokémon by lift.

### Notes — the fragmentation trade-off, stated plainly
- A finer taxonomy costs cell size. The median role-pair cell has moved **7,971** (over-tagged, v2.6)
  → **95** (credible tags, 27 roles) → **~50** (39 roles). It is still far above the old single-label
  archetype cells (n=11–18), but the direction is the price of resolution. The test and sanity bars
  were lowered 100 → 50 → 35 **with the reason recorded in-line**, and they now act as the tripwire
  against adding roles without a justification.
- Winner-prediction from preview roles is unchanged at the coin (0.6935 vs 0.6931); WAR still beats
  it (0.6867, accuracy 54.4%). Neither headline conclusion moved.

## [2.7.0] — 2026-07-24

### Changed
- **A species now has a role DISTRIBUTION, not a role list.** The same species is support on one set
  and offensive on another, so `dex[species][role]` is now `p(role | that species appears)` measured
  across its revealed sets, and a team's role vector is a **noisy-OR** over its six
  (`1 − Π(1 − p_i)` = probability at least one of them plays the role). Under closed sheets this is
  also the correct object: before the set is revealed, the distribution *is* our belief.
- **Credibility is judged by a Wilson lower bound on the rate, not a flat count.** The old
  `count ≥ 2` rule could not tell a real minor set from noise — it tagged Basculegion as *debuff* on
  **2 of 3,566** appearances (0.06%). A role now counts only when the Wilson lower bound of its
  per-set rate clears 5%, which automatically demands more evidence from a common species and stays
  honest for a rare one.

### Fixed
- **Ability→role gaps found by audit:** *Lightning Rod* and *Storm Drain* now map to **redirection**
  (they redirect, and were untagged). Added a new role **weather/field abuser** (Chlorophyll, Swift
  Swim, Sand Rush, Solar Power, Protosynthesis, Quark Drive…) — a distinct job from *setting* the
  weather. Trigger-boosters (Defiant, Competitive, Moxie, Justified, Berserk…) now map to **setup**.
  Taxonomy is 27 roles; curated roles cover **90.8%** of real in-battle move usage.

### Added
- **`docs/ROLE-ATLAS.md` (+ PDF)** — the master list: every move (478) and ability (99) with the role
  it is tagged as, generated directly from `engine/roles.py` so it cannot drift, plus a ranked list of
  untagged-but-used moves as tagging candidates. Generator: `engine/role_atlas.py`.
- **`docs/ROLE-FAMILY.md` (+ PDF)** — one read-through of the role model, WAR, and the emergent NMF
  archetypes, with every result stated against its baseline.
- Site: the MAP tab now renders a real **map icon** in the nav, town and room hero (the Porygon2
  sprite is gone), and **MAP is first** in the nav order.

### Notes — a prior number changed, and why (not silently rewritten)
- The v2.6.0 claim "median role-pair cell **n = 7,971**" was **inflated by over-tagging**: under the
  old binary rule a team carried **19.6 of 26** roles on average, so nearly every game landed in
  nearly every cell. With credible tags a team carries **4.3 of 27**, and the honest median cell is
  **n ≈ 95**. That is still far above the old single-label archetype cells (n = 11–18) — the pooling
  argument stands — but the earlier figure overstated it. Test and sanity bars moved 100 → 50 with
  the reason recorded in-line.
- Winner-prediction from preview roles remains at the coin (0.694 vs 0.693); WAR still beats it
  (0.6875). Neither conclusion changed.
- The hourly **ingest** workflow no longer fails the run when Showdown rate-limits or serves a bad
  log (`continue-on-error` on the fetch/rebuild steps) — it was emailing a failure notice every hour.

## [2.6.0] — 2026-07-24

### Added
- **Emergent roles via NMF** (`engine/nmf_roles.py` → `data/nmf-roles.json`, `data/nmf.js`). Instead of
  hand-declaring roles, this factorizes the data (Lee & Seung 1999; topic-model / Label Distribution
  Learning framing, Geng 2016) into roles that are *discovered*. Two cuts: (1) team×MOVE usage →
  offensive cores (recon-err 0.79; attacking moves dominate — shown honestly); (2) team×ROLE →
  **emergent archetypes** (recon-err **0.53**, the clean view): Intimidate+Fake-Out control, physical
  offense, special offense+sustain, **bulky wall + screens + redirection**, Tailwind+Encore, priority.
  A team is a *blend* of these, never one hard label — the structural fix for the single-label grid.
- **Vocabulary census** (`engine/vocab.py` → `data/vocab-usage.json`): tags every move/ability/item and
  counts **actual in-battle usage** (from the turn log), not just sheet reveals. Curated roles cover
  90.4% of non-neutral battle usage; surfaces high-usage uncovered moves as tagging candidates.
- **Roles booth on the site** (`web/index.html` → `app/`): the "Role Foundry" (Smeargle) renders the
  emergent archetypes and offensive cores live from `data/nmf.js`, with the reconstruction errors shown.
- Role taxonomy grown to **26** roles (added ally-support/positioning and item-disruption); factual
  multi-role membership for multi-effect moves (Matcha Gotcha = attack+heal+status; Body Press =
  wall+attack; Knock Off = attack+item-strip; Fake Out = tempo only, not an attacker).

### Changed
- **Removed hand-set role weights.** An earlier draft assigned fractional primary/secondary weights
  (0.6, 0.4…) by hand — asserted, not measured. These were stripped: role *presence* is binary and
  data-justified, and graded *strength* is now the learned output of the NMF, not a typed input. This
  is the project's "measured, not asserted" rule applied to itself.
- Sanity extended to 77 checks (role model + WAR + NMF); `tests/test-roles.py` at 19 checks.

### Notes
- Honest read on the NMF: at the team level the dominant axis of variation is offensive core + speed
  control, so the move-level cut is coarse; the role-level cut is the useful one. Rank and the human
  names are the only non-data choices. Rigorous rank/weighting selection by topic coherence (Mimno
  2011) is noted as the next refinement — reconstruction error alone is not comparable across weightings.
- Still local + (about to) push. Site booth added; white paper / deck / technical docs for the role
  family remain to be written in a dedicated docs pass.

## [2.5.0] — 2026-07-24

### Added
- **ROLE model — multi-label team composition** (`engine/roles.py` → `data/pokemon-roles.json`,
  `data/role-matchups.json`, `data/roles-eval.json`). Replaces the single-label playstyle view.
  A team is tagged with every role it reveals (24 roles across speed control, weather, terrain,
  disruption, status/debuff, priority, prankster, setup, healing, screens, walls, pivot, trapping,
  perish, and physical/special attacker), where each **species earns a role from data** — it is
  credited once observed doing it (≥2 times). Team role vectors are built from the **team-preview six**
  (leak-free). Why: the old model forced one label per team and shattered the data into
  archetype×archetype cells of n=11–18; role-pair pooling gives a **median cell of n=7,750** (576 cells).
- **Role-pair matchup matrix** with Wilson CIs — the descriptive "which role beats which," now dense
  enough to reach significance, ready to feed GURU/KING and the site grid.
- **Win-credit attribution:** per-role logistic coefficients (each role's marginal contribution to
  winning) plus **KO-credit per species** from the turn log (who actually scored the knockouts in
  games their side won).
- **WAR for Pokémon — Wins Above Replacement** (`engine/war.py` → `data/war.json`). Ridge-regularized
  Adjusted Plus-Minus (basketball RAPM) on team-preview species indicators, with an explicit
  20th-percentile replacement baseline and the logistic wins conversion (0.25·Δβ·games).
- **Tests + sanity:** `tests/test-roles.py` (19 checks; hand-derived tags, reads shipped reports so it
  can't drift). `engine/sanity_check.py` extended to cover the role model + WAR (now 70 checks).

### Notes
- **Two honest results, stated plainly.** (1) Predicting the winner from **preview roles** ties a coin
  (held-out log-loss 0.6938 vs 0.6931) — consistent with the sheet-level null; the role model's value
  is descriptive + attribution, not prediction. (2) But the **species-level WAR model does beat a coin**
  (0.6875 < 0.6931) and beats the rating baseline (0.6905): *which* species you bring at preview carries
  a small real signal that raw roles and raw sheets do not. Effect sizes are small; WAR magnitudes are
  ridge-shrunk and flagged exploratory.
- White paper / deck / technical docs and the site grid are **not yet** updated for this model — code and
  reports are written and tested locally; the doc + site pass is the next step (flagged, not silently skipped).

## [2.4.0] — 2026-07-23

### Added
- **v2 models on the site (`web/index.html` → `app/`):** new booths for **GURU** (meta matchup matrix), **XATU** (opponent belief), **PORY** (mid-game win% — with a live interactive "your win %" demo driven by `data/pory.js`), and **ALAKAZAM** (the in-battle capstone, honestly flagged in-development). SLOWKING's booth rewritten to show its real equilibrium mixture + a **rock-paper-scissors triangle diagram**. Model names rendered in **ALL CAPS** across the nav and town.
- **Playstyle layer** (`engine/playstyle.js` → `data/playstyle-matchups.json`; SLOWKING re-run → `data/slowking-playstyle-eval.json`): classifies each real team by playstyle and builds a playstyle×playstyle matrix; surfaces the strongest non-transitive cycle (TrickRoom → HyperOffense → Sand → TrickRoom).
- **ALAKAZAM plain-English one-pager** (`docs/ALAKAZAM-one-pager.md` + `.pdf`): context, what it will be, how it works, compute needs, timeline — for a non-Pokémon audience.

### Changed
- **Honest framing of the playstyle cycle:** the cycle legs are 62% / 71% / 67% but on only n=13–18 games each, with 95% CIs that cross 50%. Site copy now calls it a **suggestive pattern, not a settled fact** — it sharpens as the store grows. No overclaiming.
- **Docs folder cleaned:** 13 superseded/duplicate files (old simulator whitepaper, special-cut, v2-plan PDF, old summaries/reviews/handoffs) moved to `docs/archive/`; one canonical version of each kept.
- **Site chrome:** removed the static side-advisor mascot (kept the roaming Abra sprites).

### Documentation (full v2 rewrite — brought to standard)
- **White paper, deck, and technical docs rewritten for v2** (they had drifted to pre-pivot v1). The white paper now covers the empirical ceiling, every model with its validated result (incl. the two honest negatives), the mathematics (Wilson interval, value-net logistic, regret-matching/exploitability, clustered + Beta-resampled CIs, HodgeRank for future core analysis), limits, and cited sources. The deck is plain-English; the technical docs are ASD-STE100 Simplified Technical English organised by Diátaxis. Each ships a matching **PDF**.
- **New `docs/SUMMARY.md` (+ PDF):** one-page whole-project + per-component summary table.
- **Corrected an error** in the ALAKAZAM one-pager: poker is *sequential*, not simultaneous — reframed as "hidden information like poker **plus** same-time choices like rock-paper-scissors."
- **CLAUDE.md** now lists the docs that MUST update in the same pass as any change (living-docs enforcement), so the white paper/deck/technical docs cannot silently drift again.

### Removed
- Nothing deleted — superseded docs are archived (reversible), not destroyed.

---

## [2.3.0] — 2026-07-23

### Added
- **SLOWKING preview-Nash** (`engine/slowking_preview.py` → `data/slowking-eval.json`, `data/slowking.js`): solves GURU's real 13-archetype matchup matrix (5,199 games) to an equilibrium mixed strategy and grades it by **exploitability** (the spec's acceptance bar for the strategic layer) against greedy-single-deck and uniform baselines, with a bootstrap CI that propagates matchup-count uncertainty (Beta resampling). Also reports the strongest **non-transitive 3-cycle** in the meta.
- **Playstyle layer** (`engine/playstyle.js` → `data/playstyle-matchups.json`; SLOWKING re-run with `MATRIX_FILE=…/playstyle TAG=playstyle` → `data/slowking-playstyle-eval.json`): a rule-based classifier tags each real team by playstyle (TrickRoom / Rain / Sun / Sand / Snow / Setup / PerishTrap / TailwindOffense / FakeOutBalance / Stall / HyperOffense) and builds a playstyle×playstyle matrix from 2,866 games. **This is where the non-transitivity is real:** greedy single-playstyle exploitability 0.115 vs Nash 0.0002, gap CI [0.001, 0.280] (clears 0), with a clean cycle **TrickRoom → HyperOffense → Sand → TrickRoom** (~0.115 edge/leg). Equilibrium: Rain 0.51 / Sand 0.26 / HyperOffense 0.10 / Setup / PerishTrap / Snow.
- **Test + CI:** `tests/test-slowking.py` — a hand-derived Rock-Paper-Scissors unit test of the Nash solver (answer is uniform, value 0) plus shipped-artifact invariants; gated in the `tests` workflow (regenerates the artifact then checks it).
- **Portfolio:** ABRA added to `willhoop.github.io` as a one-object entry in the `PROJECTS` array (its own convention), leading with a measured number (PORY 0.567 vs coin 0.693). A `PUSH-TO-GITHUB.bat` was added to the portfolio repo for one-click publishing.

### Findings (honest)
- **Equilibrium mixture:** Kingambit-Basculegion 0.84 / Garchomp-Incineroar 0.16. Exploitability **Nash ≈ 0 vs uniform 0.109** — mixing over the right decks is far less exploitable than spreading evenly.
- **Greedy ≈ Nash at the archetype level:** this meta is currently near-transitive (a dominant deck), so "pick the single best deck" is about as unexploitable as the equilibrium *right now* — stated plainly rather than spun as a win for mixing. **However** a real rock-paper-scissors cycle exists (Charizard-Venusaur → Whimsicott-Garchomp → Garchomp-Incineroar → back, ~0.10 edge/leg), and the greedy-vs-Nash gap CI reaches 0.27, so under plausible resamples the meta is non-transitive. Finer, playstyle-level archetypes (stall / Trick Room / perish-trap / setup) would expose more cycles — the documented next refinement.

### Notes
- Archetype-level, not set-level: SLOWKING solves over 13 discovered archetypes, not exact teams/sets; a belief over the opponent's real six (XATU) is the next refinement. Exploitability grades the preview *decision*, never who wins a match (GURU's own predictive test ties a coin).

---

## [2.2.0] — 2026-07-23

The v2 decision-stack release: stop predicting winners, support decisions. Models built + graded
this session, each with a proper score + clustered-by-game CI + honest baseline, persisted to JSON.

### Added
- **GURU** — meta/matchup matrix from REAL game outcomes with Wilson CIs (`engine/guru.py` → `data/guru.js`). Replaces the biased *simulated* payoff matrix at the source.
- **XATU** — opponent belief (item/ability/moves) inferred from replays (`engine/xatu.py` → `data/xatu.js`).
- **PORY** — mid-game win-prob value net from real replays (`engine/pory.py` → `data/pory.js`). **The win:** held-out log-loss **0.567 vs coin 0.693**, beats a material-sign heuristic, calibrated (ECE 1.6%), clustered-by-game CI [0.548, 0.583]. Proves the v2 pivot — mid-game state is predictable even though pre-game sheets are not.
- **PORY wired into KADABRA:** the coach now shows a per-turn **"you're at X%"** chip at each key moment, computed in-browser from `data/pory.js` (site includes it now). `web/index.html` `kadBuild`/`renderKad`; mirrored to `app/`.
- **CHOMP-EV proof** (`engine/chomp_ev.js` → `data/chomp-ev.json`): the winnable team-preview test — do CHOMP's recommended brings beat humans' actual brings on held-out games? Ranks each side's actual bring among all 15 candidate brings by CHOMP exact-damage coverage; headline sign test + held-out logistic log-loss (Brier too), clustered bootstrap CI, baselines = coin / Elo / usage-prior, plus a forfeit-robustness pass and a measured selection audit.
- **Test + CI:** `tests/test-chomp-ev.js` validates the committed `data/chomp-ev.json` invariants (split bookkeeping, score ranges, CI brackets, verdict-vs-numbers consistency, honesty block); gated in the `tests` workflow.

### Findings (honest)
- **CHOMP-EV is a NULL at the format ceiling.** On 1,205 held-out human games, CHOMP's bring ranking does **not** beat a coin (log-loss 0.6918 vs 0.6931, CIs overlap), ties an Elo and a usage-prior baseline, and winners are only marginally more CHOMP-aligned than losers (0.512, CI [0.493, 0.535] — includes 0.5). CHOMP's top pick matches the human bring ~9.5% of the time (chance 6.7%). **Robust:** dropping all forfeits leaves it unchanged (0.505; log-loss 0.690 vs 0.693). **Selection audit:** eval games average 6.5 turns / 1280 rating vs 6.08 / 1267 excluded — a mild bias that, if anything, *favors* CHOMP, making the null conservative.
- **What this does NOT impugn:** CHOMP's damage math stays VALIDATED vs `@smogon/calc`; the null is about the *bring-selection signal*, which sits at the same near-coin ceiling as pre-game win prediction. It guards against optimizing a bring metric with no held-out winning signal (the DITTO/measure-gaming trap). Path to a real edge: score brings with belief-aware value (XATU) + the lead stage-game (SLOWKING) + PORY leaf value, then re-run this exact test.

### Notes
- White paper and plain-English deck updates for GURU/XATU/PORY/CHOMP-EV are still pending (this pass shipped code + CHANGELOG + MODELS/HANDOFF; the long-form docs are the next documentation pass).

---

## [2.1.0] — 2026-07-23

### Validated
- **MEDICHAM damage engine validated against `@smogon/calc`** (`engine/validate_damage.js`): with stats aligned, matches the ground-truth calc within 5% on 100% of 31 meta scenarios (median 0% error). Fixed the level-50 harness bug, then closed the ability gaps it surfaced.

### Added
- **Ability/item layer, each validated vs Smogon:** Ruin quartet, Solar Power, Guts, Orichalcum Pulse, Hadron Engine, Adaptability, Technician, Tinted Lens, Filter/Solid Rock, Multiscale, Thick Fat, Heatproof, Purifying Salt, type-immunity abilities, Expert Belt, Muscle Band, Wise Glasses.
- **DITTO policy hardening:** accuracy-weighted move value, recoil cost, self-stat-drop moves (Close Combat/Superpower/Overheat) with **Contrary** flip, **Mega ability tracking** (base vs Mega stone — Staraptor→Contrary, Swampert→Swift Swim + canonical Megas), weather-speed abilities (Swift Swim/Chlorophyll/Sand Rush/Slush Rush). Reduces the speed/frailty over-crediting (the Staraptor problem).
- **Site now grows:** `data/live.js` (counts + data-derived archetypes) and `data/kad-replays.js` (offline replay bundle) regenerate via `engine/refresh-site-data.py`, run by the daily replay pull. Town stats + DITTO archetypes read live.
- **Archetypes discovered from data** (`engine/archetypes.py`, k-means over 9,998+ real teams), not hand-listed — refreshes as the meta shifts.
- **ORB (CHOMP dock) upgraded to a validated Smogon-grade substitute:** reads live stats/items/boosts/weather/terrain/Helping Hand/spread/screens, shows applied conditions. One-click install; auto-updates.

### Fixed
- KADABRA works offline (`file://`) — coaches from the local bundle, clean move-by-move viewer with arrows and a bold "what you should've done" (dropped the Showdown iframe clutter).
- Abilities corrected from a curated meta map (no more bogus "Pressure"); real move names + spacing; Laplace smoothing so win rates never read 0%/100%.
- Non-transitivity view rebuilt as big whimsical rock-paper-scissors loops (no tiny text). Town card honesty (daily, real counts). Footer/sprite overlap.

### Known gaps (not guessed — need confirmation)
- **Champions rule changes vs Gen 9** (sleep, paralysis, specific move changes) are NOT yet modelled — pending the exact format rules.
- Enemy EVs are assumed (unknowable). Mega **stats/types** not yet swapped (abilities are).

---

## [2.0.0] — 2026-07-23

The "honest instrument" release: a real doubles engine, an evaluation layer that grades every
probability, the SLOWKING belief-search stack, and the first learned value function (the flywheel's
core). Also a strict self-review that reshaped the roadmap.

### Added
- **MEDICHAM v3 — real Gen-9 doubles engine** (`engine/medicham2-browser.js`, embedded in the site):
  replaces the 1v1 OHKO-chain that collapsed to 0%/100%. Damage formula with boosts/spread/crit/rolls,
  weather, Trick Room, Tailwind, priority, Protect, items, abilities, Fake Out; behaviour-cloned policy
  (samples real move rates), need-based Protect. Verified: mirror 0.50, healthy distribution, 400
  rollouts/29ms. Win rates now carry a 95% CI on the site.
- **Evaluation harness** (`engine/eval_harness.py`): temporal held-out log-loss / Brier / calibration
  vs coin, player-Elo, and usage baselines with bootstrap CIs. **Verdict: JOLTEON ties a coin in
  log-loss** — demoted from headline predictor to fast prior + baseline; site copy made honest.
- **Calibration** (`engine/calibrate.py`): temperature scaling; the Python JOLTEON was 6× overconfident.
- **Learned in-battle value function** (`engine/train_value.py` → `data/value-net.json`): reconstructs
  per-turn HP state and regresses the outcome. Beats a coin (log-loss 0.682) and is calibrated — the
  first genuinely learned, calibrated component, and the leaf evaluator + flywheel core.
- **SLOWKING infrastructure** (`engine/slowking/`): `nash.py` (equilibrium, verified on RPS/2×2),
  `belief.py` (public-belief-state + Bayesian filter), `ismcts.py` (simultaneous-move regret matching,
  recovers exact Nash), `game.py` (engine interface), `solver.py` (team-preview Nash + continual
  re-solve; returns bring *mixes* + win%), `value.py` (loads the learned leaf). All unit-tested.
- **Self-play data pipeline** (`sim/generate-dataset.js`) writing engine games into the store schema —
  the unlimited, unbiased "more games" path. Scraper default raised 2→25 pages (~10× per run).
- **Non-transitivity finding** (`data/nontransitivity.json`, DITTO tab): the meta is rock-paper-scissors
  (3 robust cycles after noise control) — empirical proof an additive rating can't capture it. Shown
  with an explicit "preliminary, thin data" caveat.
- **Docs:** `docs/POKER-TO-POKEMON.md` (the founding white paper), `docs/THESIS-REVIEW.md` +
  `docs/THESIS-REVIEW-v2.md` (strict self-critique with fixes), `docs/COMPETITORS.md` (VGC-Bench et al.
  and how we refine them), `docs/OVERNIGHT-HANDOFF.md`.
- **Site:** in-browser DITTO (item tuning + PokéPaste export) and KADABRA (client-side replay coach);
  MEDICHAM/DITTO use the sprite picker; saved-teams in the matchup; ORB opens from Chomp's room;
  per-room personality mascots; threats table with sample-adjusted Win%, real speed, Games column.

### Changed / Honest corrections
- JOLTEON reframed as a fast prior, not an oracle (backtest: ~coin in log-loss).
- White paper corrected: the current SLOWKING search is IS-MCTS/PIMC (strategy fusion), a rung below
  the ReBeL target — no longer overclaimed.
- Non-transitivity presented as preliminary (approximate engine, small sample), not a settled claim.

### Fixed
- MEDICHAM special-move bug (special attackers dealt 0 damage); booth slot regression that broke
  "Surprise me"; DITTO/KADABRA no longer require a server.

---

## [1.0.0] — 2026-07-22

### Added
- **ABRA is born**, split out from CHOMP as its own project: the Automated Battle Replay Analyzer.
  CHOMP stays the bring-4/lead-2 engine; ABRA is the meta-analysis brain that feeds it.
- **Durable, incremental, no-redo ingest** (`engine/durable-ingest.js`): pulls public Champions
  Reg M-B replays from the Showdown API (paginated, ~200 logs/sec, concurrent), stores every game
  raw and tagged — both teams' six, brings, leads, observed moves/items/abilities, result, both
  ratings, and a bot flag. Appends only new games (dedup by id). Tested on 1,501 real ladder games.
- **Analysis over the store** (`engine/analyze.js`): usage model at any rating cutoff / humans-only,
  plus a personal split by Showdown username. Writes `data/meta-usage.json` for CHOMP.
- **`ME` alias list** so a Showdown rename is a one-word edit, never a re-pull.
- `tests/test-parse.js` — 12 hand-derived checks on the replay extractor (teams, leads, brings,
  observed set fields, bot flag, rating, date).
- Governance: LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, .gitignore, CI workflow.

### Validated
- High-ladder filter (humans, 1300+) reveals real signal distinct from the raw ladder — e.g.
  Kingambit 62% win, Incineroar 65% — confirming the tag-and-filter design earns its keep.

## [1.1.0] — 2026-07-22

### Changed
- **Reframed to its true scope.** ABRA is documented as the live-data platform whose purpose is to
  feed a simulator that models games and teams — a self-improving flywheel (collect → simulate →
  optimise teams → play with CHOMP → auto-ingest enemy teams → improve). CHOMP is one small early
  consumer, not the point. White paper §8 states the flywheel and the honest built-vs-roadmap status.

## [1.2.0] — 2026-07-22

### Added
- **Simulator research white paper** (`docs/ABRA-simulator-whitepaper.md`): an MIT-level treatment of
  learning a VGC battle simulator from logged replays. Formalises the game (POSG, imperfect info,
  simultaneous moves), derives three modelling tiers with their estimators and failure modes, frames
  team optimisation and the self-improving flywheel, and grounds every claim in the 2025 literature
  (PokéChamp, Metamon, VGC-Bench, ReBeL/Player-of-Games, Sampled/Gumbel MuZero, offline RL). Names the
  model family in the CHOMP/ABRA tradition — **JOLTEON** (fastest, win-prob),
  **MEDICHAM** (Rapidash, rollouts), **SLOWKING** (slow deep learned dynamics), **DITTO** (team
  optimiser) — speed of the Pokémon matches the cost of the model. Folds in CHOMP's pKO threat scoring
  as JOLTEON's features and MEDICHAM's dynamics (grey-box modelling).

## [1.6.0] — 2026-07-23

### Major finding
- **The Champions engine is OPEN, not closed** (`docs/OPEN-ENGINE-FINDING.md`). Verified by cloning
  `smogon/pokemon-showdown`: the exact format `[Gen 9 Champions] VGC 2026 Reg M-B` (and its Bo3
  variant) is in `config/formats.ts`, backed by a full `champions` mod (SP system in
  `data/mods/champions/scripts.ts`). This overturns the project's founding assumption. SLOWKING no
  longer needs to *learn* the dynamics — it can query the real engine (ReBeL over a known simulator),
  and MEDICHAM/DITTO/JOLTEON can use exact rollouts + self-play. SLOWKING white paper §3 corrected;
  roadmap task added to wire the engine as ABRA's simulator.

### Added
- **MEDICHAM runs in the browser** — the damage engine, type chart, sets, and behaviour-clone priors
  (96KB) are embedded in `web/index.html`; the rollout runs client-side (~40ms / 200 rollouts). The
  "MEDICHAM check" button and Medicham's run panel now work with **no server**. Validated: mirror
  0.53, rain-vs-sun 0.19 (matches the Node engine).
- **Combined team+rating predictor** (`engine/predictability.py` §2.5): the real pre-game ceiling is
  ~57% — combining team sheets AND player ratings does no better than team alone, confirming the game
  is variance-dominated (and that the two ~55%s are different axes that corroborate, not the same
  claim). Predictability study updated with the honest framing.
- **ABRA MCP server** (`mcp/`): exposes the models as tools Claude can call — `abra_win_probability`
  (JOLTEON), `abra_rollout` (MEDICHAM), `abra_threats`, `abra_species_stats`, `abra_optimize_team`
  (DITTO), `abra_coach_replay` (KADABRA). Local stdio server; `claude mcp add abra -- node mcp/server.js`.
- **Regulation registry + archive** (`data/regulations.json`, `build/archive-regulation.js`): the
  active regulation is a one-line config edit; ingest/analysis read it. When a reg ends,
  `archive-regulation.js` snapshots the store + all models into `data/archive/<id>/` (date-stamped,
  with a manifest) so previous-regulation data is preserved forever. `--rotate` starts a fresh store.
- **Mega Evolution** added to the game's action model (SLOWKING white paper §2) as a per-turn step.
- **Ditto page rebuilt**: team-builder on top + a live, sortable/searchable **threat rankings table**
  (usage / bring / lead / win% / speed) from the real stats; static chips removed.
- **Team carries between models** (localStorage), hover-× to remove a Pokémon / clear team, usage-
  ranked picker, in-browser MEDICHAM, lightning flash on JOLTEON, confetti idle-loop stopped.
- **Omnibus is now robust** (`build/omnibus.py`): always emits a self-contained HTML (SVG embedded
  directly, no LibreOffice), attempts the PDF only if `OMNIBUS_PDF=1` — reproduces the Special Cut
  reliably as the docs grow.
- New docs sewn into the Special Cut: predictability study, SLOWKING white paper + roadmap,
  architecture notes.

## [1.5.0] — 2026-07-23

### Added
- **Recency weighting (concept-drift decay)** in JOLTEON: every training game is weighted
  `w = 0.5 ** (age_days / τ)` with a half-life τ (default 30d), so the models track the *live*
  metagame instead of averaging over stale history. Normalised to mean 1 (L2 scale unchanged);
  `τ → ∞` recovers equal weighting. No-op on the current 2-day store (reported honestly);
  unit-verified on synthetic 90-day data (oldest 0.33, newest 2.14). Same rule applies to the usage
  model and behaviour-clone. Fully documented in `docs/ARCHITECTURE-NOTES.md`.
- **SLOWKING white paper** (`docs/SLOWKING-whitepaper.md`): the definitive Tier-3 design — offline
  belief-state search over a *learned grey-box model* of the *closed* Champions engine (residual over
  CHOMP), simultaneous-move mixed-Nash subgames, warm-started by the behaviour-clone. Grounded in
  ReBeL, Student of Games, PokéChamp (ICML 2025), Gumbel MuZero, Metamon. Plus a
  **research roadmap** (`docs/SLOWKING-research-roadmap.md`) turning it into five buildable papers.
- **SLOWKING Paper-1 built** (`engine/game-spec.js`): encodes stored replays into
  `(state, observation, action, reward)` trajectories — 30,608 real state-transitions with actions and
  terminal rewards. The offline dataset a Tier-3 solver trains on; a re-parse, never a re-pull.
- **Behaviour-clone + status/field MEDICHAM v2** (`engine/policy.js`, `engine/moves-meta.js`,
  `engine/medicham.js`): the rollout now samples *what real players click* (Tailwind 34% for
  Whimsicott, Fake Out 30% for Incineroar, …) and applies the effects — sleep, burn, paralysis,
  Tailwind (2× speed), Trick Room (inverted order), setup boosts, Protect. Speed control and setup are
  now *valued emergently*. Fixed a faint-and-replace symmetry bug (mirror back to ~0.50) and gated
  support on survival (don't set up into a KO). `tests/test-medicham.js`, `tests/test-dynamics.js`.
- **DITTO ported to Node** (`engine/ditto.js`): the whole live app now runs with **no Python**.
  JOLTEON scoring reimplemented in JS from the trained weights; **MEDICHAM wired in natively as the
  finalist re-ranker** (coarse-to-fine: JOLTEON proposes thousands, MEDICHAM decides the finalists).
  In a real run MEDICHAM overruled JOLTEON — chose the rain team (75.7%) over JOLTEON's tyranitar pick
  (68% grounded vs 79.8% JOLTEON). `server.js` `/api/ditto` now calls Node.
- **Local app + server** (`server.js`, `start.bat`, `app/`): the site is served from `app/` and runs
  the real engines on the user's machine (MEDICHAM/KADABRA/DITTO via Node, JOLTEON in-page). Lazy,
  robust Python probe (skips the Windows Store stub) kept only for optional JOLTEON *retraining*.
  Booth is searchable and usage-ranked; team-builder enlarged; live "MEDICHAM check" button.
- **Multi-format + open-sheet tags**, **dedup-by-replay-id everywhere** (never double-count a game
  reviewed or self-uploaded), **per-turn extractor + raw-log archive** (any new field is a re-parse).
- **ABRA WORLD website** with per-model "How X thinks" panels, teleporting-Abra background,
  usage-ranked sprite picker, PokéPaste input (accepts any species; off-roster treated as neutral).
- `docs/ARCHITECTURE-NOTES.md`: the Python/JS split rationale and the recency-weighting design, in
  detail.

### Changed
- Model labels describe the role (win probability, battle rollouts, team optimiser, replay coach,
  belief search, bring-4 engine), not the Pokémon name twice.

### Queued
- **ORB** — CHOMP's auto-fill mid-game calculator (the Life Orb of the CHOMP family): pulls your six
  (moves/items/EVs) and the opponent's revealed team from the live battle so there's nothing to type
  mid-game; opens in its own tab.

## [1.4.0] — 2026-07-22

### Added — the model family (the simulator, stages 2–3, now has working v1s)
- **Per-turn extraction** (`engine/durable-ingest.js` v2): the extractor now captures a per-turn
  event stream — move order (→ speed), exact damage % per move, faints, status, and reveals — on
  every game. Backfilled onto all 4,999 games: **30,611 turns, 55,336 damaging move events.**
- **Raw-log archive + `MODE=reparse`**: each raw `.log` is archived (`data/*.raw-logs.jsonl`), so any
  NEW field is a re-parse, never a re-pull. Proven by backfilling `format`/`openSheet` onto 4,999
  games with **zero network calls.** (Archive is gitignored; the extracted store carries the turns.)
- **Dynamics model** (`engine/dynamics.js` → `data/dynamics.json`): observed speed (who-moves-first,
  incl. Choice-Scarf hints) for 186 species, and observed damage distributions for 1,170
  (attacker, move) pairs. E.g. Garchomp Earthquake mean 57%, Basculegion Wave Crash 62.5%.
- **JOLTEON v2** (`engine/jolteon.py`): win-probability model gains **rarity-aware L2 shrinkage**
  (a species seen 25× is pulled toward neutral; seen 1000× is trusted — a measure-gaming guard at the
  model level) plus speed-edge and firepower-edge features from the dynamics model. Honest result:
  ~55% humans-only held-out vs ~49% coin flip; the dynamics features tie species-only (firepower
  earns weight +0.30, speed-edge is noise at this scale). Reported straight.
- **MEDICHAM built** (`engine/medicham.js`): Tier-2 Monte-Carlo rollout over CHOMP's exact damage
  engine. Rain core beats sun core 0.60; mirror 0.51; ~1s / 300 playouts. Sequential-singles v1
  (honest scope). `tests/test-medicham.js`.
- **DITTO built** (`engine/ditto.py`): team optimiser using JOLTEON as evaluator against a gauntlet
  of REAL ladder teams, double-oracle rounds, **usage-weighted threat coverage** (guarantees an
  answer to high-bring threats like Basculegion, ignores rare ones like Camerupt), and a **bias
  report** showing where rarity shrinkage suppresses a pick. Surfaces the measure-gaming failure honestly:
  JOLTEON-optimised "90%" team → MEDICHAM rollouts reveal ~12% → this is *why* Tier-2 vets Tier-1.
- **KADABRA v1 built** (`engine/kadabra.js`): turn-by-turn coach over a replay — reconstructs each
  scene, gives the speed read + damage read (cross-checked vs the ladder average, flags high/low
  rolls), draws the lesson, and background-appends the game (the flywheel from the coaching seat).
- **SLOWKING scaffold** (`engine/slowking.py`): Tier-3 interface fixed + data-readiness report;
  honestly flagged as a research effort, not a trained model.
- **Multi-format + open-sheet tags**: `FORMATS=` env supports collecting other ladders (e.g. the
  Reg-G best-of-3); every record now carries `format` and `openSheet` (bo3 / agreed open team sheet
  is a distinct information regime). 42 open-sheet games found in the current store.
- **ABRA WORLD website** (`web/index.html`): a Club-Penguin-styled interactive town — one room per
  model — with the JOLTEON win-probability model running live client-side (real embedded weights),
  sprite team pickers, animated odds meter, and links to the rest of the portfolio.
- Tests: `tests/test-medicham.js`, `tests/test-dynamics.js` (all green alongside parse + jolteon).

### Changed
- The flywheel's honest status advances: stages 2 (simulate) and 3 (optimise) now have working v1
  models (MEDICHAM, DITTO), with the tiered vetting (Tier-1 proposes, Tier-2 checks) demonstrated
  end-to-end. Tier-3 depth (SLOWKING) remains roadmap.

## [1.3.0] — 2026-07-22

### Added
- **JOLTEON v1 built** (`engine/jolteon.py`) — the Tier-1 win-probability model, a Bradley–Terry
  logistic over per-species strengths with a min-sample floor (anti-overfit). Trained on 5,000 real
  ladder games (temporal split, humans only). **Measured: 56.6% held-out accuracy vs 49.6% baseline**,
  Brier 0.251 (calibrated) — a real, honest, modest edge from team composition alone, as the domain's
  variance predicts. Ships a `predict` CLI and `tests/test-jolteon.py` (antisymmetry, mirror=50%,
  coverage, range). Model saved to `data/jolteon-weights.json`.
- **Full ladder pulled** — the durable store grew from 1,501 to **5,000 games** (incremental, dedup).

### Notes
- The first training on 1,501 games did **not** beat the baseline; more data (5,000) and a min-sample
  floor were what cleared it. Recorded honestly: this is why the flywheel (more games over time) and
  damage-grounded features (§4.3.1) matter, not species identity alone.
