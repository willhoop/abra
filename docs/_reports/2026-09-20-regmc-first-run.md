# Can this engine run Reg M-C at all? — the first-run smoke test

**Date.** 2026-09-20. **Division.** ENGINE. **Status.** Findings record — historical by construction,
never cited as current state (CLAUDE.md, `docs/_reports/` rule).

**NO FIGURE IN THIS REPORT IS A MEASUREMENT.** Nothing here is pinned to a frozen release, a pinned
census or a frozen M-C team pool (the M-C pool is being cut by another agent as this runs). Every
number is a SMOKE READING, and the divergence counts in §4 are stated only as *the knob moved*, never
as a rate. Do not publish any of them.

Inputs, stated so the run can be reproduced:

| | |
|---|---|
| M-B authority, PINNED | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d6798f2ba5af92e55892c8c7063ca7b53c18a` |
| team source, BOTH arms | `C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen` (the **M-B** frozen pool, static since 2026-08-12) |
| flags | `--games 2 --team-store <above>` (+ `--allow-authority-drift` on the M-C arm) |
| release | CUT fresh, not named — deliberately, because the point was whether it runs, not what it measures |

Neither checkout was pulled, built or modified. No git command was run against either. Probe scripts
are in the session scratchpad at `…/scratchpad/mcrun/`.

---

## 0. The verdict in one table

| step | result |
|---|---|
| **1. Load** | **YES.** The M-C dex resolves through the existing seam. 382 species / 515 moves / 166 items / 316 abilities under the strict filter. `champions_sim.verify()` reports `mod: champions` and `commit_matches: false` — correctly and loudly, because `PINNED_COMMIT` is M-B's. |
| **2. Build** | **YES for Showdown, NO for MEDICHAM.** The M-C `TeamValidator` accepts a team of five newly-legal species plus the `Future`-flagged ability carrier; the same team is rejected by the pinned M-B validator (cleared control). MEDICHAM builds a body for **1 of the 35 added species** — and that one is an accident (§3). |
| **3. Play** | **YES, end to end.** 8 games × 3 tie arms against the M-C authority, exit 0, median 14 turns, 0 threw, 0 VOID. All 8 games used **M-B teams**, so this proves the LOOP runs against M-C, not that M-C teams can be played. |
| **what broke** | One class, and it is **ours, not the game's**: two tag predicates read `move.shortDesc`, and M-C ships with every Champions description removed, so both silently fall to their defaults. One of the two is board-material (§5). Plus the whole of the 41-mechanic surface being unmodelled, as expected. |
| **the `Future` ability** | It **does not survive**, and the failure is one level deeper than the brief expected (§2). |

---

## 1. Load — the seam already works, and it refuses correctly

`engine/champions_sim.js` resolves its format from `data/regulations.json`, and `dexFor()` refuses any
id the checkout does not carry. Pointed at the M-C checkout:

```
SHOWDOWN_PATH = …/pokemon-showdown-mc
verify(): {"ok":true,"format":"gen9championsvgc2026regmc","mod":"champions",
           "actual":"f10d679","commit_matches":false,"champ_formats":16,"fallback":null}

gen9championsvgc2026regmb  mod=championsregmb  species=347 moves=515 items=148 abilities=316
gen9championsvgc2026regmc  mod=champions       species=382 moves=515 items=166 abilities=316
  Future-flagged abilities dropped by the strict filter: auraguard      (BOTH regulations)
```

Three things to record.

**a. There is no way to select a regulation other than the active one.** `CS.FORMAT` is a module
constant read from `data/regulations.json` at load, and `CS.FORMAT` appears **473 times across 345 files** in
`engine/` and `tests/`. There is no `--format` flag on `game_differential.js` and no environment
override anywhere. To run any M-C probe at all this session, `data/regulations.json` had to be flipped
to `active: "regmc"` **in this worktree only**, and it was restored in the same session — `git status`
is clean. **That is a real piece of work and it is not a one-line change**: M-B and M-C must be
runnable side by side for as long as both matter, and today they cannot be.

**b. `authorityDrift` fires, and that is correct behaviour.** Run without the bypass:

```
REFUSED: the Showdown checkout f10d6798… is not the pinned authority 20ad99ff…
         (champions_sim.js PINNED_COMMIT). Pass --allow-authority-drift to measure anyway.
EXIT=2
```

The guard did its job. M-C will need its **own** pinned commit and date; `--allow-authority-drift` is
a bypass for a smoke test, not a way to run a regulation.

**c. The tag derivation runs to completion under M-C.** `engine/tag_dex.js` regenerated `data/tags.json`
against the M-C dex and wrote it: **515 moves, 165 items, 211 abilities** (M-B: 500 / 148 / 201).
Nothing was removed. It also printed its own alarm, which §5 is about.

---

## 2. The `Future` ability does NOT survive, and the trap is deeper than a walk

The brief said any generator built on the strict filter would drop `auraguard`. It does. But the drop
is not in a generator — **it is in `engine/legal_scope.js`, the single scope authority every walk in
this project defers to**:

```
auraguard        {"inScope":false,"code":"NOT-LEGAL","why":"not a legal ability in gen9championsvgc2026regmc"}
grassysurge      {"inScope":true,"code":"CARRIED", "carrier":{"species":"rillaboom","slot":"H"}}
emergencyexit    {"inScope":true,"code":"CARRIED", "carrier":{"species":"golisopod","slot":"0"}}
```

`engine/tag_dex.js:10570` then pre-filters on `a.isNonstandard` before asking scope at all, so the
ability is dropped twice over. The consequence is exactly what the brief predicted: **`auraguard` has
no row in `data/tags.json`** and never will, while the file reports full coverage.

My own re-admission walk, printed on every run as required:

```
FUTURE-FLAGGED ABILITIES IN M-C: auraguard
RE-ADMITTED (Future but carried by a legal M-C species): auraguard <- lucariomegaz
CARRIER: Lucario @ Lucarionite Z -> Lucario-Mega-Z / Aura Guard
```

`tag_dex.js` prints `LEGAL_CARRIED.size` on every run; it will keep printing a reassuring number with
Aura Guard missing from it. **The fix belongs in `legal_scope.js`, not in each caller** — one verdict,
so one place to re-admit `Future` entries the validator accepts.

---

## 3. Build — Showdown yes, MEDICHAM no

Legality was asked of the `TeamValidator`, per Will's rule of 2026-09-20, never of a hand-rolled
predicate. The team was assembled from derived names only (added-species set computed by diffing the
pinned M-B legal set against M-C in-process).

```
TEAM: Wigglytuff, Persian, Farfetch'd, Mr. Mime, Swalot, Lucario @ Lucarionite Z
M-C TeamValidator:               LEGAL (null = no problems)
CONTROL, same team vs PINNED M-B: ["Wigglytuff does not exist in Gen 9.", "Persian does not exist in
                                   Gen 9.", …]
```

A cleared control in both directions: the same team is legal under one authority and rejected under the
other, so the instrument could have seen no difference and did.

**MEDICHAM cannot build any of it.**

```
buildMon over the 35 added species: built=1  NULL=34
  CONTROL (M-B species): Venusaur=built  Venusaur-Mega=built  Charizard=built
engine-data MC.mons rows: 322   |  added M-C species with a row: 0
engine-data MC.moves (500 rows): MISSING 15 of 15 added moves
```

`buildMon` reads `MC.mons` out of `data/engine-data.js`, which is an M-B artifact. Every M-C species
returns `null`; every M-C move is absent from `MC.moves`.

**The one that built is worse than the 34 that did not.** `data/engine-data.js` already carries a
`salamence-mega` row — `item: "Salamencite"`, `ab: "Aerilate"`, **`mv: []`** — while `salamence`
itself has **no row at all**. So the engine can build a Salamence-Mega that threatens nothing, and
nothing can ever mega into it, because the base body cannot be built. That is the empty-`mv` mega
failure CLAUDE.md already describes, sitting in the artifact today. `data/engine-data.js` is a hard
limit for ENGINE; this is a builder/refit item and is reported, not touched.

---

## 4. Play — it runs end to end, and the knob moved

```
M-C authority   games  diverged  threw  median turns   arm
                    8         1      0            14   middle
                    8         1      0            15   top-tie-first
                    8         2      0            10   bottom-tie-first
                EXIT=0   VOID 0 of 8

M-B authority   games  diverged  threw  median turns   arm     <- CONTROL, identical flags and pool
                    8         0      0            10   middle
                    8         0      0            17   top-tie-first
                    8         0      0            10   bottom-tie-first
                EXIT=0
```

The loop runs. Games reach completion, the planted-divergence proof passed, the switch-index and
forced-switch mirrors all read their required zeros, `0 set(s) had no MC.mons row` (because the pool is
M-B), `0 choice(s) Showdown REFUSED`.

**The control is what makes the 1 worth reading at all.** Same teams, same flags, same `--games`: M-B
0, M-C 1. The teams are provably the same lattice — both runs print
`the OTHER half of the sample: team pool 6de2a8cdd6b1  (18 teams picked from a corpus of 8778 —
PINNED to …/data/team-pool-frozen)`, byte-identical. It is eight games and it is not a rate — but the instrument could have shown no difference
and it did.

**One lead was killed by the control and should not be chased.** The M-C run reports a `|-ability|`
Trace narration gap (`showdown … |[of]p1b: pelipper` / ours without the `[of]`), 42 + 39 lines. The
M-B control shows the identical shape at 420 + 196 + 192 lines. **Pre-existing, not M-C.**

---

## 5. What actually broke: two predicates read a field M-C no longer ships

`tag_dex` raised its own alarm on the M-C run:

```
  2 TAG(S) MATCHED NOTHING -- a bug, not an empty category:
    clearsScreens  (move)  -- wrong list, broken probe, or delete it
    typeSplitMove  (move)  -- wrong list, broken probe, or delete it
```

Diffing the two derived `tags.json` files, **12 entries legal in BOTH regulations have different
derived tags or params under M-C**:

| entry | what moved | cause |
|---|---|---|
| `brickbreak`, `psychicfangs`, `ragingbull` | **LOSE `clearsScreens` entirely** | ours |
| `reflect`, `lightscreen` | `halvesDamage.category` `Physical` / `Special` → **`both`** | ours |
| `wish`, `strengthsap` | `pp.base` 10 → 5, `max` 12 → 8 | the regulation (as derived on 2026-09-20) |
| `curse` | loses `typeSplitMove` + `statusInflict`, gains `dualPurpose`, `statChangeInCode`, `lowersTarget` | upstream handler change |
| `instruct`, `forewarn` | their derived move lists grow | the 15 added moves — correct |
| `direclaw`, `spicyspray` | lose `announcesRefusalOnStatus` / an announcement param | upstream (`f0039f5`, extra immune messages removed) |

**The root cause of the first five is one field.** `engine/tag_dex.js` reads `move.shortDesc` in exactly
two places, and **M-C ships with every Champions description removed** (`02bb2ae Remove redundant
Champions descriptions`). Measured on both checkouts:

```
reflect       MB shortDesc="For 5 turns, physical damage to allies is halved."   MC shortDesc=""
lightscreen   MB shortDesc="For 5 turns, special damage to allies is halved."    MC shortDesc=""
auroraveil    MB shortDesc="For 5 turns, damage to allies halved. Snow only."    MC shortDesc=""
brickbreak    MB shortDesc="Destroys screens, unless the target is immune."      MC shortDesc=""
   brickbreak/psychicfangs/ragingbull onTryHit still contains removeSideCondition: MB true, MC true
```

- `engine/tag_dex.js:3856` — `const d = String(m.shortDesc || m.desc || ''); const cat = /physical/i.test(d) ? 'Physical' : /special/i.test(d) ? 'Special' : 'both';` — empty string falls through to the
  **`'both'` default**.
- `engine/tag_dex.js:1846` — `clearsScreens` requires `/reflect|screen|veil/i.test(String(m.shortDesc || ''))`
  **in addition to** the `removeSideCondition` probe that still matches. Empty string, no match.

**One of the two is a silent default that changes a board, and it is almost certainly the single
divergence in §4.** The only divergence class in the M-C run:

```
-damage field 3    1 games   1 distinct cause
   |-damage|p2a:toxapex|30/125  (showdown)  vs  |-damage|p2a:toxapex|43/125  (medicham)
```

and the worked example three lines above it reads `|move|p2b:grimmsnarl|reflect` →
`|-sidestart|p2:|reflect` → `|move|p1a:primarina|moonblast`. **Reflect halving a Moonblast** is the
exact error the comment at `tag_dex.js:3848` says it was written to prevent: *"Treating them as one
tag would have Reflect reducing a Moonblast, which it does not."* It does now, under M-C, because the
sentence it derives that from is gone.

`typeSplitMove` matching nothing is the other half: `curse` was its only member, and the upstream
handler change removed the shape it keys on.

**The fix is bounded** — two sites, both derivable from handler source instead of prose. It is NOT
attempted here; this pass finds the work.

---

## 6. What I believe the first batch of work is, in order

1. **Re-admit `Future` in `engine/legal_scope.js`**, gated on the validator accepting a set carrying the
   entity, and PRINT the re-admitted list. One verdict, one place. Everything else — tags, census,
   roster — inherits it. Without this, Aura Guard is absent from every artifact and all of them report
   full coverage.
2. **Stop `tag_dex` reading `shortDesc`.** Two sites. Derive the screen's category and the
   screen-clearing membership from the handler source, the way every other predicate here does. This
   is the only thing in the whole pass that is *measurably* changing a board today.
3. **Make the regulation selectable.** `CS.FORMAT` is a load-time constant behind `data/regulations.json`
   with 473 readings across 345 files and no override. M-B stays the published authority while M-C is built, so both have
   to run side by side; a global flip is not that. M-C also needs its own `PINNED_COMMIT`/date so that
   `authorityDrift` protects it instead of being bypassed.
4. **`data/engine-data.js` needs the 35 species and the 15 moves** before a single M-C team can be
   played by MEDICHAM, and the existing `salamence-mega` row (`mv: []`, no base row) says the builder
   needs auditing at the same time. ENGINE may not write that file — this is a refit item.
5. **Then the 41 mechanics.** Of the 15 abilities new to the format: 10 already carry a derived tag,
   4 are in scope and carry **no tag at all** (`emergencyexit`, `liquidooze`, `runaway`, `seedsower`),
   and 1 is out of scope entirely (`auraguard`). Of the 18 items, 17 carry a tag and `normalgem` carries
   none. All 15 moves carry tags. **A tag is necessary and not sufficient** — nothing here says the
   engine CONSUMES those tags correctly, and `grassysurge`/`psychicsurge` arriving with four seeds and
   Terrain Extender means the terrain path gets its first legal setter in this format.

**Not yet asked, and it should be next after the above:** the census and the deliberate roster have not
been run against M-C at all. Both are steered by artifacts derived from the M-B dex.

---

## 7. Housekeeping

- `data/regulations.json` was flipped to `active: "regmc"` in this worktree for the duration of the
  probe and restored from a backup in the same session. `data/tags.json` was regenerated against M-C
  and restored from a backup. `data/engine-release.json` was moved by the release cuts and restored.
  **`git status` is clean.** The M-C-derived `tags.json` is kept at `…/scratchpad/mcrun/tags.MC.json`.
- The two differential runs each CUT a release. Those snapshot directories are untracked debris under
  `data/releases/` in this worktree. **Reported, not deleted.**
- `cmd /c 'tools\lownode.cmd …'` is refused outright for a worktree-isolated agent ("this command runs
  cmd in a plain command"). The equivalent was obtained with
  `os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL)` inside the node process for the
  `tag_dex` run; the two 8-game differential runs are small and were run at normal priority. **Worth a
  routing note: the lownode rule and worktree isolation are currently incompatible.**

## 8. Reproduction

```bash
S=…/scratchpad/mcrun
ABRA=<worktree> SHOWDOWN_PATH=…/pokemon-showdown-mc node $S/p1_load.js
ABRA=<worktree> SHOWDOWN_PATH=…/pokemon-showdown-mc node $S/p2_build.js
# with data/regulations.json flipped to active: regmc, in the worktree only:
SHOWDOWN_PATH=…/pokemon-showdown-mc node -e "…setPriority…; require('./engine/tag_dex.js')"
SHOWDOWN_PATH=…/pokemon-showdown-mc node engine/game_differential.js --games 2 \
  --team-store …/ABRA/data/team-pool-frozen --allow-authority-drift
# then restored, and the control:
SHOWDOWN_PATH=…/pokemon-showdown node engine/game_differential.js --games 2 \
  --team-store …/ABRA/data/team-pool-frozen
```
