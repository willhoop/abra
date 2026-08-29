# Replaying real stored games through both engines — scope and feasibility. MEASURE, 2026-08-29

**Scoping only. No game was played, no differential was run, no engine file was touched, nothing was
committed.** `data/game-differential.json` was mtime 2026-08-28 23:14 EDT with an ENGINE agent live on
it, so every figure taken from it was read through `git show HEAD:data/game-differential.json` into a
scratch copy. The store scans below are my own, run read-only over the append-only stores.

**Which store I read, said out loud.** The plaintext `data/games.ladder.jsonl` (346 MB, mtime
2026-08-28 21:09, **70,981 rows parsed, 0 parse failures**) and the plaintext `data/games.bo3.jsonl`
(191 MB, mtime 21:10, **21,726 rows**). **NOT** the tracked `.gz` of either. The plaintext/`.gz`
divergence is an open OPS finding and I did not touch it; the numbers here therefore describe the
plaintext stores as they stood at 2026-08-28 23:20 EDT and would shift slightly against the `.gz`.

Probe source: `<scratchpad>/scan_store.js`, `scan2.js`, `scan3.js`, `scan4.js`. They parse the JSONL
and classify events. They load no engine and play nothing.

---

## 0. VERDICT

**The coordinator's framing is right on the recommendation (SECOND ARM, not replacement) and wrong on
the mechanism, and the mechanism is what decides whether it is worth building.**

Three findings, in order of how much they change the plan:

1. **It already exists and its verdict is already on the register.** `engine/replay_differential.js`
   (2,221 lines, ROADMAP #68) replays real stored games against the record. **ROADMAP #263, filed
   2026-08-13, records Will personally talking the last agent out of leading with it**, for a reason
   that is still true and that I re-measured tonight.
2. **The record is a good CHOICE record — better than #263's framing implies.** **92.8% of live-slot
   decisions across 1,727,654 of them are recoverable to a definite click**, and the largest remaining
   hole is not a defect but a fact about the game.
3. **But a true replay is the wrong shape anyway, and the reason is not the clicks — it is that the
   spreads are unknown AND DIFFERENT, which destroys attribution.** The right instrument keeps the
   real *click distribution* and throws the real *outcomes* away. That is a much cheaper build, it
   preserves every pinned-die property, and **the components already exist and are already frozen.**

---

## 1. IS THE RECORD A CHOICE RECORD OR AN OUTCOME RECORD?

It is an OUTCOME record from which a CHOICE is recoverable most of the time. Measured, not argued.

**Shape first, per the rule.** Top-level keys: `id date format openSheet p1 p2 winner forfeit sheets
six brought lead sets turns`. `turns[i]` is `{n, ev[]}`. Event types actually present in the ladder
store, with counts over 70,981 games:

```
m 1,380,420   hp 453,187   f 356,946   s 352,689   b 322,262
mega 115,430  w 53,614     x 41,595    ei 23,714   fs 20,833   c 16,472
```

**Two of those are newer than `replay_differential.js`'s own header and it does not know about them.**
That header states *"THE STORE HAS NO `cant` EVENT AT ALL. Measured: the event types present are
`m hp f s b mega w x fs`."* Commit `39e913f8` (2026-08-10, *"the ingest keeps six facts it used to
reach and discard"*) added `c` (`|cant|`) at `engine/durable-ingest.js:192` and `ei` (`|-enditem|`) at
`:327`. The header's `cannot_see` list is therefore **stale on two entries** — item consumption and the
`cant` family — for every game ingested since. That is a caption on an instrument, not a published
figure, so it is a filing rather than a retraction.

### The reconstruction rate

I classified every slot that was **occupied and alive at the start of a turn** (occupancy seeded from
`g.lead`, then advanced by `s` / `mega` / `f`), and asked whether the record says what that slot's
player clicked.

**Ladder store, 70,981 games, 458,519 turns, 1,727,654 slot decisions:**

| class | n | share | is it a choice? |
|---|---|---|---|
| move + target named | 1,328,503 | **76.90%** | yes |
| voluntary switch | 110,495 | **6.40%** | yes |
| forced replacement after faint | 99,113 | **5.74%** | yes (which body to send) |
| move, no target named (spread / self / field) | 49,107 | **2.84%** | yes |
| `cant` recorded | 16,051 | **0.93%** | yes — no click was possible |
| switch under a phaze turn | 391 | 0.02% | **no — a die, not a choice** |
| **NO RECORD for a live slot** | **123,994** | **7.18%** | **no** |

**92.8% of slot decisions are recoverable.** In the August era, where `c` is being captured, it is
**93.5%** (66,555 unresolved of 1,019,995).

### The 7.18% hole, split — and the biggest piece is not a defect

| why | ladder | Aug era | recoverable by an ingest fix? |
|---|---|---|---|
| **fainted during the turn without acting** | 4.25% | 4.12% | **NO. Showdown emits nothing at all for a body KO'd before it moves.** |
| no event of any kind for the slot all turn | 2.06% | 1.72% | partly — this is what `c` covers |
| events for the slot but no move / switch / `cant` | 0.86% | 0.69% | unattributed |

The `cant` reasons the ingest now captures, ranked: flinch 10,398, slp 3,096, `ability: Armor Tail`
650, par 571, recharge 459, frz 381, Disable 329, `move: Taunt` 293, `ability: Queenly Majesty` 176,
`move: Imprison` 64, `move: Throat Chop` 22, Attract 19, `move: Heal Block` 11, Focus Punch 2,
`ability: Damp` 1.

**The raw logs are archived, so the July half is repairable without re-fetching.**
`data/games.ladder.raw-logs.jsonl` holds **64,722 of 70,981 rows (91.2%)** and
`data/games.bo3.raw-logs.jsonl` **21,297 of 21,726 (98.0%)**. `engine/reprocess.js` exists to reparse
them. **Expected gain is small**: it would move the whole store from 92.8% to about 93.5%, because
the binding constraint is faint-before-acting, which no ingest change can reach.

### Turn level and game level — and the number that kills the naive version

A turn is only replayable if **every** live slot on **both** sides is resolved.

| | ladder | bo3 |
|---|---|---|
| turns with every live slot resolved | **76.98%** (352,994 / 458,519) | 76.4% |
| **games fully reconstructable end to end** | **17.1%** (12,004 / 70,132) | **20.6%** |
| games fully reconstructable, **non-forfeit only** | **9.2%** | **10.3%** |
| median fraction of a game replayable before the first hole | **0.63** | **0.71** |

**A strict end-to-end replay of a real game works on one non-forfeit game in ten.** That is the answer
to the question as asked, and on its own it would be enough to stop.

### The reframing that recovers most of it, and it is worth stating

**"Fainted before acting" should be an ASSERTION, not a hole.** The record says that body died before
it moved. A replay does not need the click — it needs our engine to also kill it before it moves, and
**if our engine fails to, that is exactly the divergence the instrument exists to find.** Re-scored
with that one rule:

| | ladder | ladder non-forfeit | ladder Aug non-forfeit | bo3 | bo3 non-forfeit |
|---|---|---|---|---|---|
| **games fully reconstructable** | **54.4%** | 47.9% | **53.0%** | **60.4%** | 52.4% |
| median fraction of game replayable | **1.00** | 0.89 | **1.00** | **1.00** | **1.00** |
| mean turns before first hole / mean turns | 4.49 / 6.54 | 4.86 / 7.20 | 5.40 / 7.31 | 5.05 / 6.82 | 5.61 / 7.68 |

**So: 10% strict, ~53% with KO-as-assertion.** And 13,139 of 51,854 non-forfeit ladder games (25%) have
their first strict hole on the **final** turn — the game-ending sweep, where bodies die without acting
by construction.

**Answer to question 1: 92.8% of turns' individual slot decisions, 77.0% of whole turns, and between
9.2% (strict) and 53.0% (KO-as-assertion) of whole games. It is not low enough to stop.**

---

## 2. SWITCHES, MEGA, TERA, AND EVERYTHING THAT IS NOT A MOVE

**Switches: recorded, and separable into kinds.** 352,689 `s` events. `{t:'s', s:slot, mon:species}` —
the destination body is named. The KIND is not stamped, but it is derivable from position within the
turn: 99,113 forced replacements (an `f` for that slot earlier in the same turn), 110,495 voluntary
(no faint, no phaze), 391 under a phaze turn. Pivot switches (U-turn, Parting Shot, Chilly Reception,
Shed Tail, Teleport, Baton Pass) classify under the MOVE, correctly — the click was the move; the `s`
event is the follow-up choice and is present.

**Phaze replacements are a die, not a choice, and must be refused.** 1,080 turns contain a phaze move.
`replay_differential.js` already refuses turns downstream of one, and throws rather than degrading if
it cannot build the phaze list from the format — the right severity.

**Mega: recorded.** 115,430 `mega` events (`{t:'mega', s, mon, from}`), from `|detailschange|`. Mega is
a modifier on a move click and it is observable when it fires. **A mega that was *available* and
*declined* is not recorded** — nothing distinguishes "did not mega" from "could not". For a replay that
does not matter (the driver is told); for anything that scores the mega DECISION it does.

**Terastallization: THERE IS NONE IN THIS FORMAT, and this is derived, not assumed.**
`data/mods/champions/scripts.ts:180-182`:

```ts
actions: {
    canTerastallize(pokemon) {
        return null;
    },
```

The mod returns `null` unconditionally, so no body can ever tera. `Dex.formats.get('gen9championsvgc2026regmb').ruleset`
is `["Flat Rules","VGC Timer","Open Team Sheets"]` — no Terastal clause is needed because the mod
removes the action. Consistent with the store: **0 tera events in 92,707 games.** Nothing to replay.

**Team preview and the bring: recorded.** `six` (6 per side), `brought` (4), `lead` (2). Every game
carries them; 0 of 70,981 ladder games lack `lead`.

---

## 3. WHAT IS MISSING, AND THE PINNED-DICE TRADE — THE CRUX

### 3a. What the record does not carry

| missing | consequence | can it be worked around? |
|---|---|---|
| **the SP spread** | the binding limit | **no** |
| exact item at each moment | `ei` now records consumption (23,714 events); Knock Off / Trick still inferred | partly |
| PP | a Struggle at turn 30 is unexplainable | no |
| side conditions (`-sidestart`) | Reflect / Light Screen / Aurora Veil invisible; Tailwind read off the MOVE | partial |
| Substitute | a move that hit a doll reads as connecting for zero | no |
| volatile durations, choice locks, Encore, Taunt, Disable | not in the record | no |
| the damage roll index | see below | no |

**The spreads are the whole argument and they are absolute.** Champions team sheets publish species,
ability, item, moves and NATURE — **never the 66 stat points**. Measured tonight: of **1,534** ladder
games and **21,375** bo3 games carrying a sheet on both sides, **every single sheet body has
`evs: null`. Zero have a spread. And all 22,909 carry a nature.** That reproduces ROADMAP #263's
independent measurement (4,001 bo3 games, 47,856 sheet bodies, all null) on a larger sample.

### 3b. The pinned-die property, and what a true replay does to it

This is the trade the brief asked me to state plainly.

**What Mode A buys today.** Four arms; the current published run is `middle` — "REAL dice, seeded and
shared by CATEGORY (acc / crit / sec / dmg / stall) so both engines draw the same values for the same
kind of roll." Both engines are handed **the same value at the same event**, addressed by
`<seed>|<turn>|<cat>|<move>|<target slot>|<nth>`. **Therefore any difference between the two engines is
a RULE.** That is the entire epistemic value of the instrument.

**What a true real-game replay does to it.** ROADMAP #263 states the loss in one line and it is the
correct line:

> **the synthetic differential's spreads are unknown AND IDENTICAL ON BOTH SIDES, so a divergence can
> only be a rule; a replay's spreads are unknown AND DIFFERENT from whatever the player actually
> brought, so a divergence may be either. Unknown-but-identical is fine; unknown-and-wrong is not.**

And the half that is easy to miss: **speed is worse than damage.** A wrong damage figure is a wrong
number; a wrong Speed is a wrong TURN ORDER, which is categorical, and every line after it diverges for
a reason that is not a rule. With SP unknown across a ~1.35x offensive envelope and a ~19% HP
denominator, `replay_differential.js` cannot identify which of 16 rolls was played — its
`spread_envelope` block measures exactly this and reports it as the reason the roll test had to be
inverted into interval containment.

**So the honest statement: a true replay against the record gives up the pinned dice, and gets
attribution back only for facts that do not depend on exact numbers — did that ability fire, did that
switch happen, was that move legal, did the order come out this way given the legal Speed envelope.
It can never arbitrate a KO or a speed tie, which is most of what a game turns on.**

### 3c. AND THE REFRAMING THAT DOES NOT PAY THAT PRICE

**#263 refutes replaying real games to reproduce a real outcome. It does not refute using real games as
a source of CLICKS.**

If the recorded action sequence is fed to **both engines** as a driver, and Mode A's dice stay pinned
engine-to-engine, then the spreads are once again **unknown-but-identical**, and every divergence is
once again a rule. The simulated game does not have to resemble the real one at all — the record is
being used for the *distribution of clicks*, not for the *ground truth of outcomes*.

**The one real cost of that shape, stated before anyone builds it:** the recorded sequence goes stale
against the simulated board. The pins make the simulation deterministic and *different* from reality,
so by turn 3-4 "Incineroar clicks Fake Out at p2a" may be illegal — Incineroar fainted, or the target
is gone. **A fallback policy is then required, and the fallback is a driver again.** I cannot bound how
fast that happens without playing games, which I may not do; §6 says how to bound it cheaply.

**Which is why the better version drops the sequence and keeps only the distribution — see §6, Option
B, and it is already built.**

---

## 4. DOES THIS ALREADY EXIST? YES, THREE TIMES OVER

**Building a second copy would have been the worst outcome here, and it was close.**

| file | what it does | why the differential does not use it |
|---|---|---|
| **`engine/replay_differential.js`** (2,221 lines, ROADMAP #68) | **Exactly the brief's idea, built.** Replays real stored games, reconstructs clicks from `m` events, refuses what it cannot reconstruct and counts the refusals, recovers accuracy / crit / secondaries / speed-tie order from the record, and **rebuilds the board from the log at the start of every turn** so a compounding divergence cannot poison later turns. Artifact `data/replay-differential.json`, 2026-08-11, 400 games / 389 replayed / 2,364 turns, **5.29% turn divergence, 4.63% at turn 1, 2.75% skip.** Has `--sheets-only`, `--blind-sheets` (the information control), `--turn1-only`, `--phaze-through`, `--rates`. | **Different question.** It compares ONE engine against THE RECORD, not two engines against each other, and because it rebuilds the board every turn **it never plays a game forward and never reaches an ending either.** It has the same blind spot as the differential, reached from the opposite side. |
| **ROADMAP #263** | The register row that already adjudicated this, 2026-08-13, with Will's own words | It is `open — measure` and its verdict is *"Do not lead with replay; build #262 instead, which is synthetic and therefore controls its own spreads."* |
| **`data/move-priors.json` + `engine/policy.js`** | **P(move \| species) over real recorded clicks. 345 species, per-species `acts` counts (Incineroar 16,942), a full move distribution, AND a separate `lead` distribution for turn 1.** Already one of `engine_release.js`'s frozen SOURCES; already consumed by `rollout_leaf.js:289` under `foePolicy:'prior'`, and by `board.js` twice more. | **Nothing has ever pointed it at `game_differential.js`'s `chooseAction`.** This is the gap. |

Also checked and **not** this capability: `engine/backtest_winrate.js` reads `g.brought` and `g.lead` to
build a **turn-0 position** and asks whether the leaf names the eventual winner — it replays no turns.
`engine/wire_ladder.js` orchestrates `game_differential.js` as a child process and measures nothing
itself. `engine/kadabra.js` walks a single replay turn by turn for a **human viewer** and annotates it;
it is a coaching front-end, marked `RAW-STORE-OK`, and computes no engine claim. `engine/replay_one.js`
replays a **synthetic** differential game for debugging and explicitly writes no artifact.

---

## 5. REPLACEMENT OR SECOND ARM? — SECOND ARM, CONFIRMED BY MEASUREMENT

**The coordinator's reading is correct and here is the evidence rather than the argument.**

Distinct entities ever seen in **21,726 real bo3 games** (440,373 clicks) against what the format
actually contains:

| | seen at all | seen ≥20 times | legal in the format |
|---|---|---|---|
| moves | **452** | 313 | **500** |
| items | 144 | 137 | 148 |
| abilities | 187 | 159 | 316 |
| species | 340 | 324 | 347 |

**48 legal moves are clicked ZERO times in 21,726 real games, and 187 are clicked fewer than 20
times.** The roster and census stage 500 moves / 202 abilities / 148 items **regardless of usage**. A
real-click driver cannot reach the tail, by construction — this is CLAUDE.md's own pinned-pool ruling
(*"the pool holds zero Malamar"*) measured on the click side instead of the team side.

**And the coverage-seeking driver earns its keep in the first four turns, not the last eight.**
`credit_turn_profile` in the current artifact: 178 of 253 credited census rows are first credited on
turn 1 (70.4%), 243 by turn 4 (96.1%), deepest first credit turn 10. So the coverage leg is bought
early and **is not what the truncation is protecting.**

**Refutation of one half of the brief's framing.** The brief says *"the census leg depends on it"* —
true — and implies the coverage driver is what makes the games run long. **The census is finished by
turn 4.** The games run long for a different reason, which §6 quantifies.

---

## 6. COST AND SHAPE — THREE OPTIONS, RANKED

**First, the size of the prize, from the artifact.** `data/game-differential.json` at HEAD (generated
2026-08-29T00:24:05Z, release `4e5c7b3400de`, arm `middle`, 961 games, `turns_cap` 12):

```
end_reasons: { "the turn cap (12)": 944, "both engines ended the battle": 17 }
```

**98.2% truncated. Will's diagnosis is confirmed by the artifact.** And the driver is the cause rather
than the cap, measured tonight on a settled file — `data/_bench-order-12-60.json` (mtime 21:47 EDT,
1,000 playouts, **the same cap of 12**), medicham2 driving itself:

```
truncated_pct: 35.9   reached_a_result_pct: 64.1   turn_distribution: mean 9.61, p50 10, max 12
```

**64.1% of games reach a result at cap 12 under a self-interested driver, against 1.8% under the
coverage-seeker. A 36x difference at an identical cap.** That is the finding, and it is why raising the
cap is not the fix (see the companion report `docs/_reports/2026-08-29-turn-cap-scope.md` §5: the
hazard rate is flat at ~0.53%/turn and you would need a cap near turn 130).

For scale, real non-forfeit games: median **6-7 turns**, 90% done by turn 10, 99.4% by turn 18.

### Option A — TRUE REPLAY against the record. **DO NOT BUILD. Already built, already adjudicated.**
`replay_differential.js` is it. **Cost of a re-run: ~0**, and MEASURE could publish a fresh
`replay-differential.json` on the current release for the price of one command. **Cost of extending it
to play whole games forward: 3-5 days, and it would be wrong** — it gives up unknown-but-identical
spreads for unknown-and-wrong ones, per #263. **The only cheap thing worth doing here is a re-run**,
because the standing artifact is 2026-08-11 and 18 days of engine work old.

### Option B — EMPIRICAL DRIVER ARM. **RECOMMENDED. Small, and mostly already built.**

Keep `game_differential.js` exactly as it is — same swarm teams, same Mode A pins, same comparators,
same release/census/pool pinning. Change **only** the action selection: a second steering policy that
samples `data/move-priors.json` instead of scoring `covWant`.

**What has to be written:**

| piece | size | notes |
|---|---|---|
| `steering.js`: a second `POLICY` id, e.g. `empirical-click/v1`, with its own rule string and digest over `move-priors.json` | ~40 lines | the file is already shaped for this; `arms_comparable.js` already refuses a cross-policy pair, which is correct — an empirical arm is a re-baseline, never a delta |
| `chooseAction`: an alternate branch sampling `P(move \| species)`, `lead` distribution on turn 1, drawn off the arm's own `rngStreams` so it is reproducible under a seed | ~80 lines | `chooseAction` is already exported at `game_differential.js:5758` |
| a switch/target policy | ~60 lines | **this is the honest gap** — see below |
| `--steering empirical` flag + artifact stamp + the counter that proves it ran | ~30 lines | CLAUDE.md: a capability that cannot prove it ran is assumed broken |

**Roughly 200 lines against an existing, frozen, digested prior. Half a day to a day.** No new data, no
ingest change, no engine change.

**The gap to state before anyone starts, because it is ROADMAP #35 and it is already filed:**
`move-priors.json` gives P(move | species) and nothing else. **It has no target model and no switch
model.** `rollout_leaf.js:290` draws the target uniformly even under `prior`, and `board.js:377`
records humans double-targeting **23.4%** of the time against ~50% for independent choice. A driver
that clicks realistically and targets uniformly is realistic in one dimension. Switching is worse: the
priors say nothing about when to switch, and switches are **12.1%** of real slot decisions
(voluntary + post-faint). A first version can hold the existing switch heuristic and **say so in the
artifact**; a second version derives P(switch) from the same corpus — the store carries the labels
already (§2), so it is a derivation and not a new capability.

**What a first run looks like.** Same shape as the standing run so it is readable beside it:
961 games from the same 1,200-pair budget, arm `middle`, release pinned, census pinned,
`--team-store data/team-pool-frozen`, `--state --end-state`, **`--out data/verification/`** — never the
published artifact. Expected wall clock **4-6 minutes** at the measured 22.3 ms/turn-pair (games end
earlier, so probably fewer turn-pairs than the standing run, not more).

**What it would claim, and it is a claim nothing in this repo has ever made:** *the two engines were
driven by a realistic click distribution to a natural end, and they ended the same way N times in
961.* Severity band 1 — `DIFFERENT-WINNER` — becomes reachable for the first time.

### Option C — RECORDED-SEQUENCE DRIVER. **A cheap experiment inside Option B, not a project.**
Feed a real game's exact click sequence to both engines, falling back to the empirical prior when the
recorded click is illegal in the simulated board. **The one number that decides whether this is worth
anything is how many turns the sequence survives**, and it costs ~30 lines on top of Option B to
instrument (count `sequence_followed` vs `fell_back`). If it survives 5+ turns it is a stronger arm than
B; if it survives 1-2 it is B with extra machinery. **Measure it before building it.**

---

## 7. IS COMPARING THE WINNER MEANINGFUL? YES — BUT AGAINST THE AUTHORITY, NOT THE RECORD

**Against the record: no.** It confounds unknown SP, the unrecoverable damage roll, the 7% unresolved
clicks, and **26.6% of ladder games being forfeits** (18,892 of 70,981) whose winner is not a
game-mechanical outcome at all.

**Against the authority in a synthetic game: yes, and there is a known open defect that only this can
see.** **ROADMAP #362, filed 2026-08-23 by MEASURE:** in Gen 5+ a simultaneous double wipe is not a
draw — `sim/battle.ts:2605`, `this.win(faintData && this.gen > 4 ? faintData.target.side : null)` —
the side whose body fainted LAST wins. `battleResult(S)` in medicham2 compares live-body counts, falls
through to total HP fraction, and returns **0.5**. `tests/probe_selfdestruct_winner.js` board
`w3-simultaneous` reads showdown `winner="B"` against medicham2's draw. That row says it plainly:

> every whole-game comparison here compares PROTOCOL LINES or BOARDS. Two engines can emit identical
> lines to the character and still disagree about who won, so `engine/game_differential.js` has no
> class for this and never will until a winner is compared.

**And the blast radius is the LEAF, which is MEASURE's one number.** `battleResult` is what the sealed
rollout reads, so every mutual wipe in every rollout is scored half a win including the ones the
authority scores as a loss. **A winner comparison is worth building, it belongs in Option B's arm, and
it needs games that END — which is the whole point.**

**One caution on the sample.** 51,502 of 51,854 non-forfeit ladder games end on a turn containing a
faint, so a "who won" comparison on a naturally-ending synthetic game is well-defined. But the current
run has 17 ended games; a winner rate on 17 carries nothing. Option B is what makes n large enough for
the claim.

---

## 8. WHAT I AM NOT CLAIMING

- **I did not measure how fast a recorded sequence goes stale** against a pinned simulation. It needs a
  game played and I may not play one. Option C is scoped as an experiment for that reason.
- **The attribution of the 98.2% truncation between the driver and the pin is not fully settled by me.**
  The artifact says 944/961 hit the cap; the coverage policy is declared; the 64.1%-vs-1.8% contrast at
  an identical cap is strong evidence for the driver. It is not proof, and the cap-30 diagnostic in the
  companion report is the cheap way to close it.
- **The 0.69% "events for the slot but no move/switch/cant" bucket is unattributed.** I did not chase
  it. Some of it is the final turn of a game ending mid-turn, where remaining slots never act.
- **`abilities: 187 of 316`** overstates the gap: many legal abilities sit on unusable slots or on
  species nobody brings. The **moves** row (452 of 500, 48 at exactly zero) is the clean one.
- **`data/replay-differential.json` is 2026-08-11 and I quoted it as a description of the instrument,
  not as a current engine result.** Its 5.29% divergence rate describes an engine that is 18 days and
  many WIREs old and must not be cited as today's number.

---

## OWED, NOT RUN

**Nothing below was executed. MEASURE does not hold the machine — ENGINE does, and it was live on the
differential throughout this scoping. `SHOWDOWN_PATH` must be set. All heavy runs go through
`tools/lownode.cmd`.**

Pins are the current artifact's own stamps: release `4e5c7b3400de`, census
`data/verification/census-pin-9446a684709d.json` (digest `9446a684709d`),
`--team-store data/team-pool-frozen`, arm `middle`.

**1. MEASURE's own, and the cheapest thing on this page — re-run the replay differential.**
The standing artifact is 18 days old. This measures MEDICHAM rather than consuming it, so it is not
quarantined. ~1-3 minutes at 400 games; run it at 4,000 so the number can carry a claim. **It never
cuts a release.**

```bash
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/replay_differential.js \
  --games 4000 --release 4e5c7b3400de \
  --out data/verification/replay-diff-4e5c7b3400de.json \
  --freeze-out data/verification/replay-diff-freezes-4e5c7b3400de.json

# and the information control, byte-identical population, on the open-sheet arm
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/replay_differential.js \
  --games 4000 --release 4e5c7b3400de --store data/games.bo3.jsonl --sheets-only \
  --out data/verification/replay-diff-sheets-4e5c7b3400de.json
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/replay_differential.js \
  --games 4000 --release 4e5c7b3400de --store data/games.bo3.jsonl --sheets-only --blind-sheets \
  --out data/verification/replay-diff-blind-4e5c7b3400de.json
```

**Read `--store data/games.bo3.jsonl` for the sheet arms, not the ladder store.** 21,375 of 21,726 bo3
games carry both sheets (98.4%) against 1,534 of 70,981 in the ladder store (2.2%). The header's
"891 of 52,377" was measured against the ladder store before the bo3 store grew.

**2. ENGINE, and it is the build — the empirical-driver arm (Option B).** ~200 lines, half a day to a
day. Needs, in order:
   - a second `POLICY` in `engine/steering.js` with its own digest over `data/move-priors.json`;
   - an alternate branch in `chooseAction` sampling `P(move | species)`, using the `lead` distribution
     on turn 1, drawn off the arm's own `rngStreams`;
   - a counter (`empirical_clicks` / `fell_back_to_coverage`) printed on every run, **including its
     zero**;
   - the artifact stamp, so `arms_comparable.js` refuses a cross-policy diff. **It will refuse. That is
     correct — this is a re-baseline, not a delta.**

   First run, diverted, never to the published artifact:

```bash
SHOWDOWN_PATH=/path/to/pokemon-showdown tools/lownode.cmd engine/game_differential.js \
  --games 1200 --arm middle --turns 12 --steering empirical \
  --release 4e5c7b3400de \
  --team-store data/team-pool-frozen \
  --census data/verification/census-pin-9446a684709d.json \
  --state --end-state \
  --write --out data/verification/gd-empirical-4e5c7b3400de.json
```

   **The number to read first is `arms[0].end_reasons`.** If "the turn cap (12)" is still ~944, the
   driver was not the cause and this whole line of work is refuted — say so and stop.

**3. Instrument the recorded-sequence survival (Option C) inside that arm before proposing it as its
own instrument.** One counter: turns the recorded sequence stayed legal before the first fallback.
**Under 3 turns and Option C is dead.**

**4. Derive a SWITCH prior from the store, and route it to whoever owns `engine/policy.js`.** The labels
are already in the record — 110,495 voluntary switches, 99,113 post-faint replacements, separable by
position within the turn (§2). Without it the empirical arm is realistic about moves and not about the
12.1% of decisions that are switches, and the artifact must say so.

**5. Filed, not fixed — `engine/replay_differential.js`'s `cannot_see` list is stale on two entries.**
It states the store has no `cant` event and no item-consumption event. `durable-ingest.js:192` emits
`c` and `:327` emits `ei` since commit `39e913f8` (2026-08-10); the store carries **16,472** and
**23,714** of them. The instrument is therefore refusing turns it could now score. **ENGINE or whoever
holds that file — not me; I did not touch it.**

**6. Filed, not fixed — a reprocess would close ~0.7 points of the reconstruction hole and no more.**
`data/games.ladder.raw-logs.jsonl` covers 91.2% of the ladder store and `games.bo3.raw-logs.jsonl`
98.0% of bo3, so `engine/reprocess.js` would backfill `c` and `ei` into the July era. Expected gain:
92.8% → ~93.5% of slot decisions. **Not worth a run on its own; worth folding into the next reprocess
OPS does for another reason.**

**7. ROADMAP #263 should be annotated rather than closed.** Its verdict — *"do not lead with replay"* —
stands for Option A and is why Option A is not being built. It does **not** cover Option B, which keeps
spreads unknown-but-identical and therefore keeps attribution. A register row for the empirical-driver
arm is owed; the companion turn-cap report already flagged the same instrument from the other side
(*"a greedy-driver arm ... is the instrument that would populate severity rank 1. Not scoped here.
Needs a register row."*). **It is the same row. Do not open two.**

**8. `node engine/status.js --write` was NOT run and is deliberately owed.** ENGINE was mid-write on
`data/game-differential.json` (mtime 2026-08-28 23:14 EDT) for the whole of this scoping, and
`status.js` reads it. Running it would have risked stamping a torn read into four ledgers. **Whoever
lands the first item on this list runs it.**
