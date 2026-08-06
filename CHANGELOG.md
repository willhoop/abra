# Changelog — ABRA

All notable changes to ABRA are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Rule.** Every change is logged here in the same pass as the code, together with the matching
updates to the white paper, the deck, and the technical documentation. A prior conclusion is never
silently rewritten; what changed and why is stated.

---

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
