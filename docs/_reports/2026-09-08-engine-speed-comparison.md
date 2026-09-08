# Does a simulator like MEDICHAM already exist, and was building it justified on speed?

**MEASURE, 2026-09-08.** Will's question: *"does a battle simulator like MEDICHAM already exist that
can play Champions VGC, and how fast are the publicly available ones?"* — with the stated rationale
*"the idea was that all the other ones were too slow to accurately do search"* and the immediate
caveat *"but maybe im misremembering."* Treated as a hypothesis, not a premise.

This is a THROUGHPUT report. It makes **no claim about correctness**. MEDICHAM is quarantined for
accuracy and a fast wrong engine is still wrong.

---

## HEADLINE

| | whole games/sec | turns/sec | ms/turn |
|---|---|---|---|
| **MEDICHAM** (`rollout_leaf.runPlayout`, cap 60) | **134** | **1,482** | 0.675 |
| **Showdown sim**, raw `Battle`, my chooser (best case for it) | **33.7** | **375** | 2.665 |
| **Showdown sim**, `BattleStream` + official `RandomPlayerAI` (the documented way) | **8.6** | **92** | 10.90 |

**MEDICHAM is 3.94x faster than Showdown's own simulator** on the same machine, the same team pairs,
the same random policy, played to a real result in 100% of games in both arms.

- Ratio over the **8 contention-free reps**: min 3.75, median **3.94**, max 4.07 (cap 60).
  At the rollout horizon (cap 14): min 3.85, median **4.00**, max 4.18.
- **Noise floor** (LESSONS §9 — same arm, first half of the clean reps against the second half, on
  ms/turn): MEDICHAM **0.3%**, Showdown **2.7%** at cap 60; 4.0% and 3.9% at cap 14. A 294%
  difference against a ≤4% floor is an effect.
- Against the interface a public user would actually write — `BattleStream` + `RandomPlayerAI` —
  the gap is **16.1x**. Which number is right depends entirely on how you drive Showdown, and both
  are stated for that reason.

**The claimed rationale does not hold at the magnitude it was written at, and the direction of travel
is the finding.** The record for this same comparison:

| when | figure | ratio | status |
|---|---|---|---|
| 2026-07 (ADR-001) | 29 vs 3,401 battles/sec/core | **117x** | quoted, never had an artifact |
| 2026-08-06 (ADR-002 correction) | 523 vs 13,041 turns/sec | **24.9x** | measured, no artifact on disk |
| **2026-09-08 (this run)** | **375 vs 1,482 turns/sec** | **3.94x** | measured, artifacts below |

**Showdown did not get faster. MEDICHAM got slower as it got correct.** MEDICHAM's own throughput
went 13,041 → ~1,800 (`data/medicham-speed.json`, 2026-08-28, release `5f3f7141227c`, cap 60:
1,596–2,044 turns/sec) → 1,482 turns/sec today. Roughly **8.8x of MEDICHAM's speed has been spent on
mechanics** in 33 days. The Showdown side of the three rows is not like-for-like — the 2026-08-06 run
drove it with `choose('default')` and this one drives it with random choices and switches — so only
the MEDICHAM column supports a trend claim.

---

## JOB 1 — METHOD

Harness: `data/verification/speed-2026-09-08/bench_two_engines.js` (and
`bench_showdown_stream.js` for the streams arm). Both are copies of what was run; the run logs and
JSON are in the same directory.

### What is pinned

| pin | value |
|---|---|
| engine release | **`fb0058fb5702`** — read from `data/engine-release.json`, passed explicitly with `--release`, never resolved by parsing `engine_release.js list` |
| team store | `data/team-pool-frozen` — 8,778 teams, 40 pairs by the same deterministic stride `bench_speed.js` uses |
| Showdown | sibling master checkout, commit `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` (2026-07-22), format `gen9championsvgc2026regmb` |
| switch census | `data/rollout-switch-census.json`, digest `b599f8d581b5`, switchRate **0.0998**, passed EXPLICITLY into both arms |
| `game_differential.js` | digest `9c61584c1e4a` recorded before AND after every run; **unchanged in all three**, so the ENGINE agent's live edits did not reach this measurement |

**THE POINTER MOVED WHILE THIS RAN, AND THE PIN HELD.** `data/engine-release.json` read `fb0058fb5702` when the runs started and reads `cf8567c4db78` now — the ENGINE agent cut at least one release mid-measurement. `data/releases/fb0058fb5702/` is intact and is what every figure here was measured on, which is the whole reason the release id is passed explicitly rather than defaulted. **MEDICHAM's number is therefore already one release old**, and the direction of that staleness is known: the engine has only ever got slower.

`champions_sim.js` inside a release resolves `SHOWDOWN_PATH` relative to `data/releases/<id>/engine/`,
so the sibling-checkout fallback misses and it falls back to `/tmp/ps`. **`SHOWDOWN_PATH` must be set
explicitly for any release-pinned run that touches the oracle.** Set to the sibling checkout here.

### What is timed, symmetrically

| | MEDICHAM | Showdown |
|---|---|---|
| construct | `freshBodies` x2 + `battleInit` | `new Battle` + `setPlayer` x2 |
| play | `runPlayout` | the choice loop to a result |

**Excluded from every per-game figure, both arms:** process start, dex load, team-pool load,
`buildPair`, `Teams.pack` (cached once per pair), and **any protocol comparison** — neither engine's
log is read or compared. The MEDICHAM per-turn figure quoted above is the PLAY leg only; construction
is 0.078 ms/game against 7.14 ms of play, so folding it in moves the number by about 1%.

### The policy is matched

Both arms play `rollout_leaf.runPlayout(explore=1.0, foePolicy='uniform')`: with probability 0.0998
switch to a uniformly random legal bench body (once per body per turn), otherwise a uniformly random
selectable move at a uniformly random live foe. **No mega on either side**, because `runPlayout` does
not mega. Evidence the two arms are playing the same game: mean turns **11.05 vs 11.13** at cap 60,
**100% vs 100%** reaching a result, **10.27 vs 10.32** and 77.3% vs 78.3% at cap 14.

### Why interleaved, and what the outlier reps are

An ENGINE agent is live. Running arm A to completion then arm B makes the ratio a function of when
contention landed, so the arms alternate A,B,A,B inside one process and the ratio is taken **per rep,
paired**. That makes contention common-mode. It worked: 30 reps were run across two runs and **14 of
them show a 2–20x wall-clock inflation on BOTH arms simultaneously** — the paired ratio stays near 4
through most of them, and the ones that do not (1.02x, 22.3x) are reps where one arm caught the spike
and the other did not. Those are excluded by a stated rule — a rep is CLEAN if both arms are within
1.25x of that cap's minimum — leaving 8 clean reps per cap, which are what the headline reports.

### Two things done deliberately against my own hypothesis

1. **Showdown's chooser cost is measured and subtracted; MEDICHAM's is not.** My chooser is my
   JavaScript, not Showdown's, so leaving it inside Showdown's play time would inflate the ratio in
   the direction I would like. MEDICHAM's chooser is inside `runPlayout` and cannot be separated, so
   it stays in. Removing Showdown's chooser moves the ratio **3.94 → 3.93** — it is not where the
   difference lives.
2. **Showdown is driven through the fastest API it has** — a bare `Battle`, no `BattleStream`, no
   protocol strings parsed. That is an upper bound on Showdown throughput, not a handicap. Its own
   documented interface is 4.2x slower again.

### Sample and counters

**12,000 games per engine** across the two main runs (400 games/arm/rep, 6 and 9 reps, two caps),
plus 2,000 for the npm arm and 300 for the streams arm. Warm-up is discarded in every run and is
itself both arms, because whichever arm runs first is measured cold (`bench_speed.js` documents a
5.6x V8 tier-up).

Counters, run 2 (7,200 games/arm): `pair_build_fail 0, medi_threw 0, sd_threw 0, sd_rejected_choice
319, sd_fell_back_to_default 319, sd_stuck 0, sd_no_request 3059`. The 319 rejections are ~0.2% of
choices and each fell back to `choose('default')`; `sd_no_request` is the ordinary doubles condition
of one side waiting while the other answers a forced switch. **No catch in either harness is silent.**

### Comparability with the published MEDICHAM figure

`data/medicham-speed.json` (2026-08-28, release `5f3f7141227c`) reads **148.5–190.1 playouts/sec** and
**1,596–2,044 turns/sec** at cap 60. This run reads 134–140 games/sec and 1,482–1,547 turns/sec on
release `fb0058fb5702`. Those are **consistent, not identical**: a different release, and `battleInit`
moved from the sim leg to the construct leg here. This report does not supersede that artifact.

---

## JOB 2 — WHAT CAN ACTUALLY PLAY THIS FORMAT

The format is a **mod**: `gen9championsvgc2026regmb` overrides eight files under
`/data/mods/champions/`. An engine that cannot express the mod is not an alternative at any speed.

| candidate | Gen 9 doubles? | can load this mod? | throughput | verdict |
|---|---|---|---|---|
| **smogon/pokemon-showdown** `sim` | yes | **yes — it IS the mod** | 375 turns/s raw, 92 turns/s streamed (this box) | the only real option |
| **`pokemon-showdown` on npm, 0.11.11** | yes | **yes — measured here** | 2.588 ms/turn vs the checkout's 2.579 — identical | drop-in; see below |
| **`@pkmn/sim` 0.10.11** | yes | **no** | n/a | ships `gen1…gen8legends` mods only |
| **`@pkmn/engine`** | no — RBY/GSC | **no, by design** | 51,282 RBY battles/s (their box) | ends the comparison |
| **`poke-engine` 0.0.48 (Rust)** | **singles only** | has its own Champions data | not measured | structurally singles |
| **`battler` 0.9.1 (Rust)** | yes, doubles | no Champions mod exists | no published figure found | would be a rewrite |
| **`poke-env` (Python)** | yes | via a Showdown server | bounded by Showdown + websocket | a client, not an engine |

### The finding that matters most here

**`pokemon-showdown@0.11.11` on npm CONTAINS the Champions mod, and `engine/champions_sim.js`'s header
says it does not.** [read]

- `pokemon-showdown@0.11.10` (published 2025-02-27): **0** files under `data/mods/champions/`, **0**
  occurrences of `VGC 2026 Reg M-B` in `dist/config/formats.js`. The header's claim was TRUE when it
  was written.
- `pokemon-showdown@0.11.11` (published **2026-07-28**, six days after our pinned commit): ships
  `data/mods/champions/` and `data/mods/championsregma/`, and `dist/config/formats.js` defines
  `[Gen 9 Champions] VGC 2026 Reg M-B`, `… (Bo3)` and `[Gen 9 Champions] BSS Reg M-B`.
- Loaded and run here: `Dex.forFormat('gen9championsvgc2026regmb')` gives mod `champions`, gametype
  `doubles`, `rockyhelmet.isNonstandard === 'Past'`, `silktrap.isNonstandard === 'Past'`, 347 legal
  species.
- **7 of the 8 champions mod files are byte-identical** to our pinned master build
  (`moves`, `abilities`, `items`, `conditions`, `rulesets`, `scripts`, `learnsets` — SHA-256 equal);
  only `formats-data.js` differs.
- Benchmarked as the Showdown arm: **2.5877 ms/turn** against the checkout's **2.5793**, with
  identical mean game length (11.13 turns) and identical mean log volume (302 lines). Artifact:
  `data/verification/speed-2026-09-08/two-engine-speed-npm.json`, field `sd_module`.

**Consequence:** the "REQUIRES a built checkout of pokemon-showdown master" constraint in
`engine/champions_sim.js` and in the ADRs went stale on 2026-07-28. That is an ENGINE/OPS routing
matter, not mine to fix, and it is filed here rather than patched.

### The rest, with sources

**`@pkmn/sim` 0.10.11** [read] — tarball inspected: `build/cjs/data/mods/` contains exactly
`gen1 gen2 gen3 gen4 gen5 gen6 gen7 gen8 gen8bdsp gen8legends`. **Zero** files in the package match
`champions`. Its README states it is "an automatically generated extraction of just the simulator
portion of smogon/pokemon-showdown" and that if you do not need a browser build "you will probably be
better off vendoring the smogon/pokemon-showdown in your project." Same engine, same speed class, and
it cannot load our format as published.

**`@pkmn/engine`** [read] — README: RBY & GSC are stage 1 and **in progress**; modern generations are
stage 3 and "soft-blocked on the availability of high quality decompilations". Explicitly out of
scope, in its own words: *"team/set validation or custom rule ('format') enforcement"* and
*"first-class support for 'mods' to core Pokémon data and mechanics."* Its benchmark
(`docs/TESTING.md`, commit `9ce6e379`, **an `n2d-standard-48` GCE machine, AMD EPYC 7B12, not ours**,
`npm run benchmark -- --battles=10000`): libpkmn **195 ms**, `@pkmn/engine` 737 ms, patched Showdown
`DirectBattle` **618 s** — a 3,167x ratio, for **RBY**. That is the "1000x faster" claim, and it is
about a generation and a battle type we do not play, on hardware that is not this one. **It cannot
run our format and no amount of speed changes that.**

**`poke-engine` 0.0.48** [read] — its README's first line is *"An engine for searching through Pokémon
battles (singles only)"*, and `src/state.rs` gives `Side` a single `pub active_index: PokemonIndex`;
`src/` holds `gen1 gen2 gen3 genx` and no doubles module. **But it is the most interesting near-miss
in this list**: `Cargo.toml` carries a `champions` feature with `bss = ["champions"]`, its CI runs
`cargo test --features "champions"`, and the v0.0.48 changelog (2026-07-19) lists *"Reg M-B Champions
data + abilities"*, *"Champions base stat calc for stat points"*, *"Champions paralysis change"*,
*"Champions sleep duration changes"*, *"Champions thaw chance change"*, *"Champions unseenfist and
piercingdrill"*, and *"Mega evolving"*. Somebody has implemented this regulation's mechanics in Rust,
with MCTS and expectiminimax on top — **for Battle Stadium Singles**. Doubles is not a feature flag
there, it is a different state representation.

**`battler` 0.9.1** [read] — Rust, `no_std` core, README states *"All moves, abilities, and items
through Generation 9 have been implemented and validated"*, lists **double battles**, team preview,
team validation, Mega Evolution and Terastallization, and advertises *"a high level of customization
for all sorts of effects through an interpreted language written directly on effect data."* On
capability it is the only non-Showdown engine in this list that could in principle host the format.
It has **no Champions mod**, no published throughput figure I could find, and its data models the
mainline games rather than Showdown's practical interpretation — so adopting it means authoring the
whole regulation and then building a differential against Showdown to prove it, which is the work
ABRA has already done once.

**`poke-env`** [read] — README: "a Python library for building scripted agents, self-play experiments,
and reinforcement learning workflows on Pokemon Showdown", and it "requires ... access to a Pokemon
Showdown server." It is a client. Its ceiling is Showdown's speed minus websocket and process
overhead, so it is strictly slower than the 92 turns/sec streams arm above.

Nothing else surfaced on crates.io or npm that plays Gen 9 doubles. `kazam-*` are Showdown protocol
and replay libraries, `firecore-*` and `lemon-mbl` are game-engine crates for other projects.

### Protocol

Only Showdown and its repackagings emit the `|`-delimited sim protocol the differential aligns on.
`@pkmn/engine` defines **its own** binary protocol (`docs/PROTOCOL.md`), `poke-engine` emits
instruction lists, `battler` emits its own battle log. **Every one of them would require a new
alignment layer**, which is a rewrite of `game_differential.js`.

---

## JOB 3 — THE VERDICT

**The speed rationale is DIRECTIONALLY TRUE AND QUANTITATIVELY DEAD, and the reason MEDICHAM was
worth building turns out not to be the reason that was written down.**

Taking the three outcomes offered in order:

1. **Was any public engine ever a shortcut? No, and not on speed.** Every engine that is dramatically
   faster than Showdown is faster because it does not do this: `@pkmn/engine` is RBY/GSC and rules
   mods out **by design**; `poke-engine` is singles-only even though somebody has already written this
   regulation's mechanics into it. The only public code that can play `gen9championsvgc2026regmb`
   today is Showdown's own simulator and its repackagings, all of which run at the same speed. **There
   was no faster mod-capable engine to adopt in July and there is none now.** That part of the
   decision is vindicated, though not by the argument that was recorded for it.

2. **Was the 117x real? No, and the current margin is 4x.** ADR-001 decided the architecture on a
   number that had no artifact; ADR-002 re-measured it at 24.9x on 2026-08-06 and said so; it is
   **3.94x today**, and the collapse is almost entirely MEDICHAM slowing down as it became correct.
   The honest sentence is: **we did not buy a 117x engine, we bought a 4x engine, and the price of
   correctness is still being paid out of that margin.**

3. **Does 4x justify the engine on speed alone? Not obviously, and this is the uncomfortable part.**
   Derived from this run: a `rolloutWinProb` call at n=200 and cap 14 costs 200 x (0.081 + 6.79) ≈
   **1.37 s** on one core — which agrees with the published 1,144–1,270 ms in `data/medicham-speed.json`.
   MILTANK's default 20,000 ms budget therefore buys **~15 leaf calls per decision on one core**. On
   Showdown's raw `Battle` the same budget buys **~4**. Both of those are small numbers. 4x is not the
   difference between a search that is possible and one that is not; it is the difference between 15
   evaluations and 4. The claim *"you cannot put that slowdown beneath a rollout search"* is fair
   about the 16x documented interface and is **not** fair about the 4x raw one.

**What would settle the part that is still open.** Whether 15 leaf calls per decision beats 4 by
enough to matter is a SEARCH question with a decisive-pair answer, not a throughput question, and
this report cannot reach it. ROADMAP #62 already frames it correctly: *the engine work is justified if
and only if search pays.* Nothing here changes that, and nothing here should be read as evidence for
it either way.

**One thing that is unambiguous and actionable:** if the engine keeps slowing at the rate of the last
33 days, the margin over Showdown is gone inside two months. **MEDICHAM's turns/sec is worth putting
on the status board next to its mechanics count**, because those two numbers are trading against each
other and only one of them is currently printed.

---

## What was retracted, and what deliberately was not

The `docs/RUNNING-NOTES.md` row for this work treats the ratio as a **routine revision of a series,
not a retraction**, and that was a decision rather than a convenience.

- **`24.9x` is superseded, not retracted.** It was a correct measurement of the engine of 2026-08-06.
  Striking it out puts `13,041` and `3,401` into the derived retraction registry, which then fires
  against **ten** sites across the white paper, the technical docs, `SUMMARY.md`, both ADRs and two
  archived handoffs — every one of which is correctly reporting what was true when it was written.
  The white paper already frames those three numbers as *"three measurements of MEDICHAM's
  throughput"*, and a decision record's evidence may not be rewritten in place.
- **What IS owed, and is not a caption:** three LIVING documents state `24.9x` as the CURRENT ratio
  — `docs/ABRA-whitepaper.md` (§0.3 and the ADR-002 correction block), `docs/ABRA-technical-docs.md`
  (two places) and `docs/SUMMARY.md`. Those sentences must be REWRITTEN to 3.94x. The ADRs keep
  theirs.
- **What IS retracted outright:** the claim that the Champions mod is absent from the published npm
  package. That is a statement of fact that is false today, it stands in `engine/champions_sim.js`'s
  header and in both ADRs, and it is ENGINE's to correct.

`node tests/test-docs-current.js` reads **33 passed, 0 failed** with the row and this report in place.

## Artifacts and how to reproduce

```
data/verification/speed-2026-09-08/bench_two_engines.js        the harness (both engines, interleaved)
data/verification/speed-2026-09-08/bench_showdown_stream.js    BattleStream + RandomPlayerAI arm
data/verification/speed-2026-09-08/two-engine-speed-main.json  run 1, 6 reps, caps 60 and 14
data/verification/speed-2026-09-08/two-engine-speed-run2.json  run 2, 9 reps, caps 60 and 14
data/verification/speed-2026-09-08/two-engine-speed-npm.json   npm 0.11.11 as the Showdown arm
data/verification/speed-2026-09-08/showdown-stream-run.log     the streams arm
```

```bash
export SHOWDOWN_PATH=/c/Users/willj/Projects/Pokemon/pokemon-showdown
node data/verification/speed-2026-09-08/bench_two_engines.js \
  --release fb0058fb5702 --team-store data/team-pool-frozen \
  --pairs 40 --per-pair 10 --reps 9 --caps 60,14 --out <out>.json
```

**Every flag above is part of the sample definition, not a budget.** `--pairs`, `--per-pair`, `--reps`
and `--caps` each change what was measured; two runs at different values are two different questions.

Run at BelowNormal priority. `tools\lownode.cmd` could not be invoked through this shell (`cmd.exe /c`
returned an interactive banner and swallowed the output), so priority was set by PID immediately after
spawn via PowerShell `Start-Process -PassThru` + `$p.PriorityClass='BelowNormal'`. Same class, same
intent; recorded because it is a deviation from the documented call.

**Machine:** 16 cores, 14.3 GB RAM, node v24.15.0, Windows 11. Nothing here transfers to another box
without re-measuring.
