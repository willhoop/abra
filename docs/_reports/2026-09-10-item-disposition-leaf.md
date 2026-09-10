# The item-disposition board leaf — falsified, wired, and the defect it found

2026-09-10, ENGINE. A batch of ONE, deliberately: it was the one change of the night expected to move
boards, so its effect had to be attributable to it alone.

---

## Verdict

The `wrong_if` **SURVIVED**, the leaf is **WIRED**, and it immediately found a real engine defect —
**medicham2 had no `Pokemon#useItem` door at all**, so every non-berry item SPEND went unrecorded. The
leaf parted **192 of 961** pinned-pool games before the fix and **0 of 961** after it. The gate is
**OPEN** and was already open before this batch; nothing here opened it and nothing here closed it.

The artifact clause that motivated the batch was **stale in one of its two sentences**, and the stale
half is the one that named Colbur.

---

## 1. The `wrong_if`, run first

`data/game-differential.json` `state.not_compared` declared its own falsification:

> a path in either engine writes the field on a REMOVAL rather than on a consumption — then the two
> shapes diverge on bookkeeping and the leaf would MANUFACTURE divergences. Falsified by a staged
> Knock Off with both fields printed side by side.

**Probe:** `tests/probe_item_disposition.js` → `data/verification/probe-item-disposition.json`.
Eight arms, each reading `lastItem` / `ateBerry` RAW off both engines at every turn boundary. Nothing
is recomputed on either side, so a disagreement is the engines' and never the reader's.

| arm | kind | medicham2 | showdown | verdict |
|---|---|---|---|---|
| `ko-leftovers` | REMOVAL | `-/--` | `-/--` | MATCH |
| `ko-colbur` | CONSUMPTION | `colburberry/ate` | `colburberry/ate` | MATCH |
| `ko-sitrus` | REMOVAL | `-/--` | `-/--` | MATCH |
| `eat-sitrus` | CONSUMPTION (control) | `sitrusberry/ate` | `sitrusberry/ate` | MATCH |
| `sash-used` | CONSUMPTION | `-/--` | `focussash/--` | **PARTS** |
| `trick-swap` | REMOVAL | `-/--` | `-/--` | MATCH |
| `thief-steal` | REMOVAL | `-/--` | `-/--` | MATCH |
| `eat-then-switch` | CONSUMPTION, BENCHED | `sitrusberry/ate` | `sitrusberry/ate` | MATCH |

**SURVIVED.** No removal path in either engine writes either field. That is also what the source says,
re-read rather than taken from the artifact: gen 9 Showdown has exactly THREE write sites —
`eatItem` (`sim/pokemon.ts:1805` `lastItem`, `:1809` `ateBerry`), `useItem` (`:1846` `lastItem` only),
and a `battle-actions.ts:128` carry that is guarded on `gen <= 4`. `takeItem` (`:1856-1870`) writes
neither. medicham2's write sites are `consumeBerry` (both fields) plus two `_ateBerry`-only sites that
reproduce the authority's own quirks — a flung berry force-eaten on the TARGET, and a Bug Bite / Pluck
berry eaten by the THIEF (`data/moves.ts` bugbite `onHit`, `if (item.onEat) source.ateBerry = true`).

**THE LINE NUMBERS IN THE ARTIFACT'S ROW WERE STALE** (`:8786-8787`, `:20425`). The real sites are
`consumeBerry` at `:11179-11181` and the turn reset at `:26271`. The file has moved ~2,400 lines since
the row was written. The claim was right; the citation was not.

### The probe was wrong before the engine was, twice

Both caught by printing rather than by reasoning:

1. **First run: all sixteen cells read `-/--`.** Identical output across a varied knob is an unwired
   knob, not a finding. The target's first move was `Protect`, so Knock Off never landed and the probe
   was measuring a shielded turn.
2. **The bench arm switched to a body that was already active.** `{ sw: 'toxapex' }` is slot B's
   partner in a doubles pair, so Showdown rejected the choice and the arm measured nothing. The arm
   also had to look the body up BY NAME on both engines — an actives-only read starts reporting the
   REPLACEMENT's empty fields as a match.

---

## 2. The converse the row did not ask

A row that only checks *does a removal write it* cannot see the other way two write-site sets fail to
line up: **a CONSUMPTION one engine records and the other does not.** That is what was actually there.

The authority's `useItem` family, DERIVED over the format rather than recalled — every item whose
consumption runs `useItem`:

- **legal in Reg M-B: `whiteherb`, `mentalherb`, `focussash`.** Three.
- `boosterenergy`, `roomservice`, `weaknesspolicy`, `airballoon`, `powerherb`, `ejectbutton`,
  `ejectpack`, `mirrorherb`, `berryjuice`, `throatspray`, `blunderpolicy`, `adrenalineorb`,
  `absorbbulb`, `cellbattery`, `luminousmoss`, `snowball`, the type gems — all `isNonstandard: 'Past'`.
- plus **Fling**, which is not an item handler: its own condition writes the identical two fields
  (`data/moves.ts` fling.condition.onUpdate, `pokemon.lastItem = item.id; pokemon.usedItemThisTurn = true`).

medicham2 recorded NONE of them. `_lastItem` was written only in `consumeBerry`, so `spendsLastItem`
— Recycle — could give back a berry and **never** a spent Sash or herb, and Pickup (gated on
`_lastItem && _usedItemThisTurn`) could never take one.

---

## 3. The prediction, written before the measurement

`data/verification/_prediction-2026-09-10-item-disposition.json`.

| | predicted | measured |
|---|---|---|
| stage 1 — leaf wired, engine UNFIXED | NOT ZERO; point estimate **250**, interval **100–450** | **192 of 961** |
| dominant field | `last_item` | `active[].last_item`, **the only family** |
| `ate_berry` contribution | **ZERO** | **ZERO** |
| dominant value | `focussash` | `focussash` 24, `whiteherb` 15, `lightball` 1 (capped list) |
| stage 2 — engine FIXED | **0 of 961** | **0 of 961** |

`lightball` is the Fling road and was not in the prediction's dominant-value line, though Fling was
named in its population block.

**Clause named:** BOARD-MATERIAL is `state.games` less `state.games_board_never_diverged`.
**Flags, because `--games` is part of the sample definition:** `--games 1200 --turns 50 --arm middle
--steering empirical --end-state --team-store data/team-pool-frozen`. 961 games played (pool-limited)
in every run below.

**The two stages are the same sample**, proved rather than assumed: identical `first_divergences` head,
identical `coverage` block, identical `classes` (`event missing from medicham2: 1`), 961 games each.

Stage 1: `data/verification/gd-stage1-item-disposition.json` (release `8ac9c4d888f1`).
Stage 2: `data/verification/gd-stage2-item-disposition.json` (release `ea3fead04c70`).

---

## 4. The fix

`recordItemUsed(m, itemId)` in `engine/medicham2-browser.js` — the `useItem` half of the record, beside
`consumeBerry` which is the `eatItem` half. It writes `_lastItem` and `_usedItemThisTurn`, counts
`MEDSEEN.itemUsedRecorded`, and refuses an empty id loudly into `MEDFAILS.itemUsedWithNoId`.

Six call sites: White Herb (`restoreStatsUpdate`), Mental Herb (`mentalHerbCures`), the Focus Sash
branch of `consumesItem`, the Fling spend in the update pass, and two that cannot fire in this
regulation and are kept correct rather than deleted — Power Herb (`isNonstandard: 'Past'`) and the
non-berry branch of `berryCureUpdate`.

**It records and does not announce.** Each caller already owns its own `-enditem` line and its own
measured line ORDER — the herb's above its `-clearnegativeboost`, the Sash's above the `-damage` it
survived. Folding six orderings into one door in the same pass as a state fix is how a refactor eats a
fix.

**The counter fires and the receipt was nearly read off the wrong module.** A first check read
`0 -> 0` because it imported the LIVE `medicham2-browser.js` while the run was playing the RELEASE
snapshot's bytes. Read through `REL.require('engine/medicham2-browser.js')` it is
`MEDSEEN.itemUsedRecorded 0 -> 1` on one staged Focus Sash, with `MEDFAILS.itemUsedWithNoId` at 0 and
`berryConsumed` at 0 as the control.

---

## 5. The stale published verdict

`knock_off_roadmap_80.verdict` ended:

> *What differs is the item DISPOSITION: Showdown records Colbur as EATEN BY ITSELF, medicham2 as
> KNOCKED OFF.*

**That sentence is false and the same artifact already contradicted it.** Its own `arms` block shows
both engines emitting `|-enditem|…|Colbur Berry|[eat]` then `|[weaken]`, and the probe reads
`colburberry/ate` off both. It was quoted verbatim into `board_state.js`'s `NOT_COMPARED` row as a
PUBLISHED FINDING and used to price this batch. **The prediction was right by accident** — the leaf did
part 192 games, on the Focus Sash and on no berry at all.

Corrected in place in `engine/game_differential.js` with the record of what it said. The row in
`NOT_COMPARED` is replaced by a comment recording both things it got wrong: the stale `cost` clause,
and a `wrong_if` that named only one of the two ways the write-site sets could fail to line up.

---

## 6. The full gate chain, re-run

Everything below is release **`cbd510bc2b13`**, census `data/mechanics-census.json` digest
`ab219c68f165` (835 rows — the ROW COUNT is unchanged from the `257acf955593` pin; the file digest
moved because `tests/test-mechanics.js` restamped `generated`, and under `--steering empirical` the
census is CREDITED ONLY and does not select the sample).

| instrument | result |
|---|---|
| `tests/test-engine-diff.js --n 6000 --seed 20260804 --write` | 6000 compared, **0 disagreed** |
| roster / items | DIFFER **0**, DID-NOT-FIRE **0**, matched 142 |
| roster / abilities | DIFFER **0**, DID-NOT-FIRE **0**, matched 139 |
| roster / moves | DIFFER **0**, DID-NOT-FIRE **0**, matched 487 |
| `all_mechanics_fire --kind all` | written on `cbd510bc2b13` |
| whole-game differential, `--arm middle` | **BOARD-MATERIAL 0 of 961**, families `[]` |
| `engine/quarantine.js` | **GATE: OPEN**, every clause PASS |

**Census: 835 probed / 835 live / 0 missing — unchanged. Nothing went down.**

### The corner arms are unmoved

| arm | before (`8ac9c4d888f1`) | after (`cbd510bc2b13`) |
|---|---|---|
| `top-tie-first` | 16 of 961 | **16 of 961** |
| `bottom-tie-first` | 15 of 961 | **15 of 961** |

Not just the counts: the capped first-board-divergence **seed sets are identical** on both arms. The
new leaf appears there only as an ADDITIONAL differing field inside games that had already parted —
`active[].last_item` 1 game top, 2 games bottom, `active[].ate_berry` 1 game bottom. **The leaf added
no corner-arm game.**

### The gate was already open

`data/game-differential.json` at 07:04:15Z, BEFORE this batch, already read board-material 0 of 961,
`protocol_diverged_games` 1, all of it declared. **Nothing in this batch opened the gate.** What the
batch changed is that the gate now holds under a strictly wider board comparison: `mediBody`/`sdBody`
each grew two leaves.

---

## 7. Registered and left

- **ROADMAP #573** — `AfterUseItem` is raised at two of the six spend sites and not at the other four,
  so **Symbiosis does not answer a spent Mental Herb or a flung item**. Three legal carriers. Not
  folded into this batch because the batch was a batch of one and had to stay attributable.
- `MEDFAILS.flingSpendNotBooked` is **narrowed, not retired**: two of its three halves are now done
  and it counts only the `AfterUseItem` third. The name is kept so the reports that quoted it still
  trace.

## 8. One thing that went wrong here

**I overwrote two untracked artifacts I did not create.** `data/verification/gd-top-tie-first-2026-09-10.json`
and `…-bottom-tie-first-…` already existed from the previous batch's 05:27/05:29 corner runs; I chose
the same `--out` names and clobbered them. Untracked, so unrecoverable. **Nothing about the record was
lost** — the tracked `data/verification/game-differential-{top,bottom}-tie-first.json` (08:08/08:11Z,
release `8ac9c4d888f1`) still hold that measurement at 16 and 15, and
`docs/_reports/2026-09-10-corner-arms.md` states it. Reported rather than glossed: the file rule in the
ENGINE brief is about deletion and this is the overwrite shape of the same hazard.

---

## OWED, NOT RUN

```bash
# 1. ROADMAP #573 — the AfterUseItem half. No probe stages it today; this is the fixture it needs.
#    A Symbiosis partner must hand its item over when the OTHER body spends a Mental Herb.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  node -e "require('./engine/champions_sim.js')" # then: stage mentalherb + a Symbiosis ally, read the ally's item on both engines

# 2. The three berry-eat roads that bypass consumeBerry were NOT staged by this probe.
#    Bug Bite / Pluck (ateBerry on the THIEF) and Fling (ateBerry on the TARGET) are read from the
#    source and from the engine's comments, never played side by side.
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  cmd /c tools\lownode.cmd tests\probe_item_disposition.js   # after adding a bugbite arm and a fling arm

# 3. The census was regenerated in this pass (digest 257acf955593 -> ab219c68f165, 835 rows both).
#    Nothing steers on it in the empirical arm, but a coverage-steered run WOULD differ:
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown \
  cmd /c tools\lownode.cmd engine\game_differential.js --end-state --games 1200 --turns 50 \
    --arm middle --steering coverage --team-store data/team-pool-frozen --release cbd510bc2b13 \
    --out data/verification/gd-coverage-recheck.json --write

# 4. `node engine/status.js --write` was run at the end of this batch; the FEATURE SEMANTICS
#    CHECK it prints first is MEASURE's (policy-weights vs a regenerated damage table) and was
#    already failing before this batch. Not touched, not fixed, not this division's.
node engine/status.js
```
