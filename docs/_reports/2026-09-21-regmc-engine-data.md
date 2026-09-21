# The Reg M-C damage table — MEDICHAM can now build every Reg M-C body

**Date.** 2026-09-21. **Division.** ENGINE. **Status.** Findings record — historical by construction,
never cited as current state (CLAUDE.md, `docs/_reports/` rule).

**No Reg M-C figure is published here.** Every count below describes the artifact this pass built or
the instrument that judged it. None of the 41 new M-C mechanics was touched, and no M-C differential
was run.

| | |
|---|---|
| worktree | `…/ABRA/.claude/worktrees/agent-a9a94e4ad52fd5061` |
| M-B authority, PINNED, untouched | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` `20ad99ff` |
| M-C authority, untouched | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d6798f2ba` |
| M-C pool read | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc`, `games.bo3.jsonl` `a68263bb568d` + `games.ots.jsonl` `4dcc2aa61562` — the digests `FROZEN.md` names |
| M-B pool, both lattice arms | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` |

---

## 0. The verdict

| | |
|---|---|
| **how the table is produced** | `build/build_engine_data_regmc.js` → `data/engine-data-regmc.js` (+ `data/engine-data-regmc-receipt.json`). A **separate artifact**; `data/engine-data.js` is not written, not regenerated, and `git diff HEAD` on it is empty. |
| **sources** | the M-C Champions dex, the FROZEN M-C pool's open team sheets, `engine/legal_scope.js`. Nothing is read back off its own output, so `--check` proves the whole artifact. CHOMP is not used. |
| **the 35 added species** | **35 of 35 build**, through medicham2's own `buildMon`, with stats, four moves and an ability the forme can have. 32 on their own observed sets, 2 inherited from the body they change from (the two Squawkabilly colour formes), 1 derived from the format (Persian — zero sheets in the pool). |
| **every M-C species** | **382 of 382 build** (the format walk, with legal_scope's `Future` re-admission). 350 observed, 25 inherited, 7 derived. |
| **the dropped `Future` ability** | `auraguard` — re-admitted by legal_scope, carried on the `lucario-mega-z` row, and `buildMon('lucario-mega-z').ability === 'auraguard'`. |
| **a real team** | six sets off the table's own rows — five added species plus the `auraguard` carrier — **accepted by the M-C TeamValidator with no problems**; every body carries 4 moves and a real M-C ability. |
| **control, knob cleared** | the same 35 added species against Reg M-B's table: **0 of 35** build. Against the M-C table: 35 of 35. |
| **Reg M-B** | damage differential and a 1200-game lattice, before and after — §5. |
| **`artifact_audit.js`** | **1 GAP, pre-existing and worktree-only** (CHOMP unresolvable from `.claude/worktrees/`, same as the previous pass). Check G now COMPARES the new bundle: `ok data/engine-data-regmc.js is what build/build_engine_data_regmc.js would write`. |

## 1. Why a second builder, not a flag on the first

`build/build_engine_data.js` is stage one of three over `CHOMP/engine/champ-model.js`; stages two and
three edit `data/engine-data.js` in place, and stage one carries **2,072** of their field values off its
own previous output (`data/engine-data-purity.json`). None of that exists for M-C — no champ-model, no
previous artifact, nothing to preserve. A flag on that builder would have had to invent all three
layers or fall back to M-B's, and falling back to M-B's is the exact failure this brief is about.

And ENGINE may not write `data/engine-data.js`. A separate file makes "Reg M-B does not move" true by
construction; the before/after runs confirm it rather than carry it.

## 2. How a row gets its set

| source | rows | rule |
|---|---|---|
| **OBSERVED** | 350 | the species' most common JOINT set (item, ability, nature, four moves) over the pool's 297,984 sheet entries. A **mega forme is observed too**: `item.megaStone[baseName]` names the forme, so a sheet declaring a base species with its stone IS that mega. 87,310 sheet entries carry one; all 82 legal M-C megas are reached. |
| **INHERITED** | 25 | no sheet of its own; the set of the body it CHANGES FROM (`changesFrom` first, `baseSpecies` second — the order Reg M-B paid for on Floette-Mega). The ability is always this forme's own. Castform's three weather formes, Aegislash-Blade, Mimikyu-Busted, Morpeko-Hangry, Palafin-Hero, the cosmetic Vivillon/Alcremie patterns, Tauros-Paldea-Combat, Stunfisk-Galar, two Squawkabilly colours. |
| **DERIVED** | 7 | no sheet and nothing to inherit. Slot-0 ability; three damaging moves from the species' own move pool ranked on base power × STAB × accuracy, one per type, plus Protect; **put to the TeamValidator** (all 7 accepted). Persian, Flareon, Garbodor, Furfrou, Slurpuff, Gourgeist, Gourgeist-Large. |

**The derived ranking was wrong twice before it was right, and both were caught by printing it.** Base
power alone handed Garbodor and Gourgeist **Explosion** and four species **Giga Impact**. Excluding the
field-stated costs (`selfdestruct`, `recharge`/`charge` flags, `ohko`) then picked **Last Resort, Belch
and Poltergeist**, all three of which fail by their own handler. Excluding `onTry`/`onDisableMove`
fixed it. These 7 rows are ASSUMPTIONS and their `set_source` says so; none of them is one of the 35
added species except Persian.

**Mega abilities.** 69 mega rows took the mega's own ability in place of the ability the sheet
declared, which is the pre-evolution one — expected ("Mega evolution overwrites the ability"). They are
counted apart from real repairs so a real one cannot hide among them: **1** real repair,
Stunfisk-Galar inheriting base Stunfisk's Sand Veil, replaced with its own slot 0.

**The stat line** is `medicham2.spreadL50` — the function buildMon's mega swap already uses — fed the
SP rule `build/rebuild_sets_from_sheets.js` uses (50 into the attacking stat the moves use, 25 into the
nature-favoured one). Control: `spreadL50` reproduces M-B's stored `st` on **195 of 195** rows that
carry `sp` and `nature`. The nature chart is medicham2's `natureShift`; no third copy was written.

**Moves**: all 515 legal M-C moves, not only the learnable ones — a missing row is UNLOOKUPABLE. Every
move any row carries has an entry. **Type chart**: derived from the dex (`getImmunity` /
`getEffectiveness`) over the types a legal species or move uses — 18, Stellar not carried. Control:
the same derivation reproduces M-B's `MC.C` with **0 of 324 cells** differing.

**Keys**: merge_mega_into_engine.js's stated artifact convention (display name, lowercased,
non-alphanumeric runs → one hyphen). Plain lowercasing was tried first and wrote `vivillon-icy snow`
and `mr. rime`. The control re-derives the rule over the live M-B artifact each run: **317 of 322**
reproduce, the 5 that do not are CHOMP spellings (`kommoo`, `mrrime`, three `tauros-paldea*`) and all
5 flatten to the same key.

## 3. Priors are EMPTY, deliberately

`MC.priors` is the rollout's opponent model, not a row. M-B's 230 rows are hand-authored and
`data/mc-priors.json` names their owner as the opponent model. A first draft derived M-C priors from
observed clicks (`turns[].ev`, `t: 'm'`); the intent label it had to attach **over-matched on first
print — Endure came out as `protect`** — and M-B's other four labels are judgements, one a recorded
defect. So M-C ships `priors: {}` and every build prints that the sampler will fall through to its
non-prior chooser for every species. The click data exists in the pool for whoever owns that model.

## 4. The guards, and each was shown to fire

- **Judged on the rows it writes, and refuses on them.** A row with no `bs`, no `st`, no moves, no
  ability or no weight fails the build AND `--check`; a byte comparison alone would pass an artifact and
  a candidate that are empty in the same place, which is the 2026-07-30 shape. Census on the written
  table: all bands **0** except `item null: 7` (the derived rows — no held item is a legal state).
- **Two keys, one body** — asked of the ARTIFACT, not of two files' spellings: **0 collisions**; the
  build refuses on any.
- **`--check`** — pure function of upstream, so it proves every field. Green on the real artifact;
  **red on a broken copy** (`mons: 2 row(s) differ — rillaboom, golisopod`).
- **The regulation** — the builder names M-C itself when nothing is chosen, and REFUSES an explicit
  other choice (`--regulation regmb` → exit 2).
- **`tests/test-engine-data-regmc.js`** — 15 clauses from the CONSUMER side (the format walk through
  `buildMon`), each regulation in its own child. **Shown RED first**: a copy with Rillaboom's moves
  emptied and Golisopod's row deleted fails 4 clauses — `380 of 382`, `33 of 35`, the validator
  refusing a moveless set, and the team-body clause. The first red attempt CRASHED instead of failing
  (`mc_key.js` guards `MC.mons` and throws on a missing key); fixed, then red for the right reasons.
- **`tests/test-no-silent-failure.js`** caught 3 new silent catches in the builder on its first draft;
  all 3 now speak or are gone. NEW since baseline: 0.
- **The pre-commit hook BLOCKED the first commit, and it was the gate's environment, not the table.**
  `engine/artifact_audit.js --staged` audits a scratch copy of the commit under the OS temp directory;
  the builder's input (the untracked frozen pool) and its Showdown checkout (a sibling of the repo)
  were in neither the copy nor beside it, so `--check` could not run and G read `GAP … is NOT what its
  builder would write`. The first fix found the pool and then reached `/tmp/ps` for the simulator. Now
  the wrapper exports `ABRA_AUDIT_SOURCE_ROOTS` (the checkout the copy came from, and its main
  checkout) and the builder looks for BOTH the pool and its checkout under those roots, one rule for
  both. A pool found elsewhere cannot launder a wrong table: `--check` compares bytes.

## 5. Reg M-B is unmoved

No file in `engine/engine_release.js` SOURCES changed. `data/engine-data.js`: `git diff HEAD` empty.

| instrument | before | after |
|---|---|---|
| `tests/test-engine-diff.js --n 6000 --seed 20260804` | exit 0, 151 lines | exit 0, 151 lines — **`diff` returns nothing: byte-for-byte identical** |
| `engine/game_differential.js --games 1200 --team-store data/team-pool-frozen` | release `d8f3dc38a947`, pool `0d103fb9fa87`, **10 of 961** diverged | release `d8f3dc38a947`, pool `0d103fb9fa87`, **10 of 961** diverged |

The lattice outputs differ in exactly **three lines, all permitted**: the before arm's two
`pool cache MISS … written` lines (the first run in this worktree built the pool cache; the after arm
read it — the pool digest `0d103fb9fa87` is on an unchanged line in both), and the wall clock
(1501.2 s → 1420.6 s). The release id is **identical** this time, not merely explained: no `SOURCES`
file moved. Every divergence row, every counter and the census digest are the same.

Both arms: `SHOWDOWN_PATH` on the pinned M-B checkout, no `--regulation`. **The 10 of 961 is a
before/after FINGERPRINT and not a gate reading** — these runs omit `--steering empirical --arm middle
--end-state`, exactly as the previous pass's did, and it matches that pass's fingerprint.

The runs rewrite `data/engine-diff.json`, `data/engine-release.json` and `data/published-samples.json`
as a side effect; those three were restored to HEAD and are not part of this change.

## 6. Findings on the way, not fixed here

1. **A PROPAGATED `SHOWDOWN_PATH` BEATS AN M-C CHOICE, AND THE BANNER SAYS THE OPPOSITE.**
   `engine/showdown_path.js` writes `SHOWDOWN_PATH` into the environment as a side effect of being
   required, and `tests/run-all.js` requires it — so every child of the suite inherits the M-B
   checkout, and "an explicit SHOWDOWN_PATH still wins" then pins M-B under `--regulation regmc`.
   Measured: `champions_sim` REFUSES the format (loud, good), while the stderr banner still reads
   `checkout pokemon-showdown-mc` (wrong). The builder and the test both handle it locally; the class
   is open for every other M-C caller run under the suite. `engine/regulation.js` / `showdown_path.js`.
2. **Six M-C mega stones have no `megaStone` tag** — `absolitez`, `baxcalibrite`, `garchompitez`,
   `golisopite`, `lucarionitez`, `salamencite` (ids from the M-C dex, printed by the test on every run). A
   base forme holding one builds and **cannot mega evolve** — `megaTargetFor` reads the tag, and
   `lucarionitez` does not even match the `/ite(x|y)?$/` fallback. `buildMon('<forme>-mega')` works;
   the evolution does not. This is `data/tags.json` needing an M-C derivation, not this table.
3. **A worktree cannot run the M-B builder's `--check`** (CHOMP resolves to `.claude/worktrees/CHOMP`)
   — pre-existing, the audit's one GAP here.

## 7. What remains before an M-C game can be played

1. **Wire the table into the runtime.** ~50 callers `require('data/engine-data.js')` directly, including
   `game_differential.js` through `REL.require`, and `board.js` (ENGINE may not edit it). Selecting M-C
   must load `data/engine-data-regmc.js`. That also means adding it to `engine_release.js` SOURCES,
   which moves every future release id and is a MEASURE decision because of release compatibility.
2. **An M-C `data/tags.json`** (finding 2), which is also where the 41 new mechanics begin.
3. **The M-C opponent priors** (§3), for whoever owns the opponent model.
4. **The propagated-`SHOWDOWN_PATH` class** (finding 1).

## 8. Reproduction

```bash
POOL=C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc
ABRA_REGMC_POOL=$POOL node build/build_engine_data_regmc.js           # writes the table + receipt
ABRA_REGMC_POOL=$POOL node build/build_engine_data_regmc.js --check   # proves it, writes nothing
node tests/test-engine-data-regmc.js                                  # 15 clauses, consumer side
ABRA_REGMC_POOL=$POOL node engine/artifact_audit.js                   # check G compares the bundle
```
