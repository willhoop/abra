# The last undeclared narration game — the arrival announcement spoke for an ability the body did not walk in with

2026-09-20, ENGINE, isolated worktree `agent-a47e07f0a1828966d`. Worktree release **`11d290f19ea3`**.

---

## 1. Which of the three was undeclared, and how that was decided rather than guessed

The 1,950-game lattice on release `6a0582efeda6` carried three protocol causes:

```
event missing from medicham2   1  |-end|p1a|fallenundefined <> |switch|p1a|delphox,l50|H/H
event missing from medicham2   1  |-end|p2a|fallenundefined <> |switch|p2a|sableye,l50|H/H
extra event emitted by medicham2  1  |-ability|p2a|cloudnine <> |-ability|p1b|cloudnine
```

`engine/quarantine.js`'s narration clause was run against the coordinator's artifact directly (copied
into `data/game-differential.json` in this worktree, then restored). It printed:

```
NARRATION-ONLY: 1 of 1497 = 0.1% of games ... (3 narration-only raw, less 2 declared ...)
DECLARED / THE AUTHORITY IS WRONG ...  [2 game(s), 1 row(s)]
     2  Supreme Overlord `fallenundefined`
```

So **both `fallenundefined` games are declared** by the `AUTHORITY-WRONG` row whose matcher is
`(c) => /fallenundefined/.test(c)` (`engine/quarantine.js`, `DECLARED_DIVERGENCE`), and the
**undeclared game is the `cloudnine` one**. The starting hypothesis in the brief — that the newest
class was the one to look at — happened to be right here, but it was not adopted: the clause was run.

**The `fallenundefined` row was NOT touched.** It already carries its reason (Showdown guards
`supremeoverlord`'s `onStart` on `pokemon.side.totalFainted` and does not guard its `onEnd`, so the
template interpolates the literal string `fallenundefined` onto a `[silent]` line), and reproducing a
typo is not correctness.

## 2. The mechanism

The undeclared game, from `first_divergences` in the coordinator's dump:

```
config   pair-protect-bust
seed     gen9championsvgc2026regmbbo3-2658408069 vs ...2658389819
turn 4   index 66   agreed_lines 66
before   |switch|p1b: Ditto|Ditto, L50|123/123
         |switch|p2a: Drampa|Drampa, L50|153/153
         |-transform|p1b: Ditto|p2a: Drampa|[from] ability: Imposter
showdown |-ability|p2a: Drampa|Cloud Nine
medicham |-ability|p1b: Ditto|cloudnine
```

A Ditto refills opposite a Drampa, Imposters it, acquires Cloud Nine, **and then announces it**. The
authority never does, and cannot:

- `Battle#fieldEvent` (`sim/battle.ts:490-506`) builds its ENTIRE handler list over every entrant
  **before** `speedSort` at `:507` and before a single handler runs. At that instant the Ditto's
  ability is `imposter`, so the only `onSwitchIn` it contributes is Imposter's. Cloud Nine, acquired
  two lines later, has no handler in the list. (`:526-539` goes further and drops a handler whose
  `abilityState` no longer matches the one collected.)
- The acquisition road agrees from the other side: `transformInto` ends at
  `setAbility(pokemon.ability, this, null, true, true)` (`sim/pokemon.ts:1358`) and `setAbility`
  raises `singleEvent('Start', …)` (`:1946-1949`) — **`Start`, never `SwitchIn`**. Cloud Nine's
  announcement lives only in its `onSwitchIn` (`data/abilities.ts:534-538`); its `onStart` writes no
  line at all.
- The handler's own comment states the rule: *"Cloud Nine does not activate when Skill Swapped or when
  Neutralizing Gas leaves the field"* (`data/abilities.ts:535`).

In this engine, `switchInAnnounce()` (landed the same day) was called BELOW `imposterCopy` and
`traceCopy` at both arrival roads, so it read the body's ability AFTER the copy had replaced it.

**Trace is the same defect and the pool had not sampled it.** A Gardevoir that Traces a Cloud Nine
foe also announced. That was found by writing the probe arm, not by reading the lattice.

## 3. The fix

`engine/medicham2-browser.js`, both arrival roads — `runEntryPass` (every replacement and deferred
refill) and the lead pass. `switchInAnnounce` moves ABOVE `imposterCopy`/`traceCopy`:

```js
if(!SWITCHIN_ANNOUNCE_AFTER_COPY)switchInAnnounce(nx);
imposterCopy(nx,foes,i);
traceCopy(nx,_live(foes));
if(SWITCHIN_ANNOUNCE_AFTER_COPY)switchInAnnounce(nx);
```

The move is stream-neutral for every body that is not itself an Imposter or a Trace carrier, because
those two functions emit nothing for anybody else — and a body cannot both announce (ability at
arrival is a member) and copy (ability at arrival is `imposter`/`trace`). The two cases are disjoint,
so this is not a re-ordering trade-off.

- **Knob:** `MEDI_SWITCHIN_ANNOUNCE_AFTER_COPY=1`, stamped AT LOAD to
  `MEDFAILS.switchInAnnounceAfterCopyRestored`, listed in `DELIBERATE_BREAK` in
  `tests/test-mechanics.js`.
- **Census row:** `ability / announcesOnSwitchInCopyDoor` in `tests/test-mechanics.js`, quoting the
  authority's literal lines (`sim/battle.ts:490-506`, `sim/pokemon.ts:1358`, `:1946-1949`,
  `data/abilities.ts:535`) and the divergence pair verbatim. Copier membership is read off
  `transformsOnEntry` / `copiesFoeAbility`, the announcer off `announcesOnSwitchIn`; nothing is named.
- **Probe:** `tests/probe_switchin_announce.js`, four new arms — `IMPOSTER-DOOR`,
  `CTRL-IMPOSTER-DOOR`, `TRACE-DOOR`, `CTRL-TRACE-DOOR` — plus a `--red-copy` mode.

### Exit codes

| run | exit |
|---|---|
| `tests/probe_switchin_announce.js` **BEFORE the engine change** | **1** — `FAIL IMPOSTER-DOOR`, `FAIL TRACE-DOOR` |
| `tests/probe_switchin_announce.js` (clean, after) | **0** — every claim held |
| `tests/probe_switchin_announce.js --red-copy` | **1** — `FAILED — 2 claim(s)`, and the restore stamp reads 1 |
| `tests/probe_switchin_announce.js --red` (the older knob, unchanged) | **0** |
| `tests/test-mechanics.js` | **0** — 980 live, 0 missing |
| `MEDI_SWITCHIN_ANNOUNCE_AFTER_COPY=1 tests/test-mechanics.js` | 979 live, **1 missing**, `REFUSED to write data/mechanics-census.json` |

### Two fixture corrections, both caught by a landing check rather than by luck

1. **The Trace arm was vacuous on its first draft.** Trace copies a RANDOM live foe
   (`this.sample(possibleTargets)`). With Cloud Nine on one foe only, the draw took the other foe's
   Heatproof: `|-ability|p1a: Gardevoir|Heatproof|Trace|[from] ability: Trace|[of] p2b: Sinistcha`.
   The arm was green while tracing nothing this probe is about. Both foes now carry the member, and a
   `tracedMustBeMember` claim reads the copied ability off the authority's own line.
2. **Ditto learns exactly one move** (`CS.canLearn('ditto', …)`: Transform yes, Protect no), so its
   declared set is `['Transform']` and the script clicks Protect off the COPIED moveset. That the
   click is legal is itself evidence the transform landed, and `copyMustLand` checks the authority's
   `|-transform|…|[from] ability: Imposter` line directly.

## 4. The gate, re-measured on release `11d290f19ea3`

Three lattices, same pins as the reference run — census `data/verification/census-pin-56e17cc610e8.json`,
team store `data/team-pool-frozen` (read from the MAIN tree; the frozen store is untracked and absent
from a worktree, and the first attempt silently played **0 games** because of it),
`--steering empirical --arm middle --end-state`:

| `--games` | games | board-material | narration raw | undeclared | causes |
|---|---|---|---|---|---|
| 1200 | 961 | 0 | 0 | **0** | — |
| 1350 | 1069 | 0 | 1 | **0** | `fallenundefined` (declared) |
| 1950 | 1497 | 0 | 2 | **0** | `fallenundefined` x2 (declared) |

`node engine/quarantine.js --narration`:

```
PASS  whole-game differential / NARRATION — protocol divergence with no board effect, on EVERY team lattice
  NARRATION-ONLY: ZERO ON EVERY LATTICE — --games 1200: 0 of 961 [pool 0d103fb9fa87];
  --games 1350: 0 of 1069 [pool 7e7a37ded7fc];  --games 1950: 0 of 1497 [pool a5ce76242f8d]
  exit 0
  THIS CLAUSE NOW HOLDS THE QUARANTINE GATE SHUT — the BOARD-MATERIAL clause reads zero on every lattice.
```

Artifacts: `data/verification/2026-09-20-copydoor-g{1200,1350,1950}.json`.

**WHAT THIS PASS DOES NOT CLAIM.** `node engine/status.js` in this worktree reads **6 of 10** because
four clauses — the damage differential and the three roster stages, plus the staged mechanics battery
— are `MEASURED AGAINST A DIFFERENT ENGINE`: their artifacts were produced on `6a0582efeda6` and the
tree is now `11d290f19ea3`. Those four are owed a re-run on a release cut from the MERGED tree. The
two whole-game clauses, coverage, board leaves and open-defect all PASS here.

## 5. The second item — the fainted-body diagnostics. CONFIRMED for speed, MOSTLY confirmed for `lastMove`, with a 7-reading live residue that is a real finding

The hypothesis was that the `lastMove` and speed "REAL GAP" diagnostics are the instrument comparing a
Showdown body that has already fainted. **Every one of the forty printed speed buckets carried
`status=-/sd:fnt`, and forty is the CAP** — so the split was computed over the population rather than
read off the list. `engine/game_differential.js` now records `sd_fainted` / `me_fainted` on both row
kinds and prints the split.

Control run: release `11d290f19ea3`, `--games 600` (505 games), same census pin and team store,
`data/verification/2026-09-20-corpse-control-g600.json`:

```
lastMove DISAGREEMENTS: 1401 readings in 394 of 505 games
  of which 1394 readings in 394 game(s) are on a body SHOWDOWN HAS ALREADY FAINTED
  ... LIVE-BODY readings: 7   <-- THESE are the engine claim

SPEED AGREEMENT: 253 disagreeing readings in 124 of 505 games
  ROUNDING ONLY    0
  REAL GAP       253 readings in 124 games
  of which 253 readings in 124 game(s) are on a body SHOWDOWN HAS ALREADY FAINTED
  ... LIVE-BODY REAL GAPs: 0   (zero — nothing here is an engine claim)
```

**Speed: CONFIRMED, 253 of 253.** `Pokemon#faint` drops the item and ability effects, so a fainted
Choice Scarf body reads its base Speed on the authority and x1.5 here. Not a multiplier disagreement —
the two engines are being asked about different bodies. Zero live readings.

**`lastMove`: 1,394 of 1,401 CONFIRMED as corpses, 7 are not, and they are a real class.** Printed by
name:

```
LIVE turn 8   p1b vileplume        showdown afteryou      medicham sleeppowder
LIVE turn 4   p2b scovillainmega   showdown sleeptalk     medicham flareblitz
LIVE turn 5   p2b scovillainmega   showdown sleeptalk     medicham flareblitz
LIVE turn 7   p2b scovillainmega   showdown sleeptalk     medicham flareblitz
LIVE turn 12  p2b scovillainmega   showdown sleeptalk     medicham rest
LIVE turn 11  p2b incineroar       showdown partingshot   medicham flareblitz
LIVE turn 8   p2a sylveon          showdown calmmind      medicham hypervoice
```

Four of the seven are one shape: **Showdown keeps the CALLER (`sleeptalk`) as `lastMove` and this
engine keeps the CALLED move.** `lastMove` is Encore's own gate (`condition.onStart` opens
`let move = target.lastMove; if (!move) return false`) and Disable walks `moveSlots` against it, so
the class is not cosmetic. The other three (`afteryou`, `partingshot`, `calmmind` against an attack)
are not diagnosed and may be a second shape.

**This is UNREGISTERED — no open `docs/ROADMAP.md` row names it** (grepped `lastMove`: #269, #454,
#117, #118, #534, all closed or about something else). It is reported, not fixed: it reaches no board
leaf and no protocol line, so it is outside both gate clauses, and landing a second engine change in
this batch would make neither attributable.

## 6. Files touched

| file | what |
|---|---|
| `engine/medicham2-browser.js` | knob + stamp + the two call-site moves |
| `tests/probe_switchin_announce.js` | 4 arms, `--red-copy`, `copyMustLand`, `tracedMustBeMember` |
| `tests/test-mechanics.js` | census row `announcesOnSwitchInCopyDoor`; stamp added to `DELIBERATE_BREAK` |
| `engine/game_differential.js` | the corpse split on both diagnostics, and the live rows printed by name |
| `docs/ENGINE.md`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md` | the ledger pass |

`data/engine-release.json` was restored to its incoming value at the end of the pass.
`data/releases/11d290f19ea3/` is left in place — the three gate artifacts name it.

**Nothing in the main tree was touched.** `data/verification/g1950-dump.json` was READ only.
