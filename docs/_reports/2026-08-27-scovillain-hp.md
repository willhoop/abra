# `pair-protect-bust` turn 6, two HP on a Scovillain — 2026-08-27, ENGINE

## WHAT REMOVED THE HP, AND THE EXACT ARITHMETIC ON BOTH SIDES

**It is not a residual, an item chip or a field fraction.** It is a **one-point disagreement about a
MEGA EVOLVED body's Attack**, doubled to two HP by the x1.5 STAB.

The full medicham2 stream for the game, replayed (`--dump-games` with the lead-in window widened for
the diagnosis and then reverted), settles what was on the board:

```
turn 4  |-damage|p2a: Primarina|0 fnt  |faint|p2a: Primarina
        |switch|p2a: Scovillain|scovillain, L50|140/140      <- enters FULL. Takes nothing after this.
turn 5  |move|p2a: Scovillain|protect        |-singleturn|p2a: Scovillain|Protect
        |move|p1a: Golurk|phantomforce       |-prepare|p1a: Golurk|phantomforce
        |-boost|p2a: Scovillain|def|2|[from] ability: moody   <- +2 DEFENCE, agreed by both engines
        |-unboost|p2a: Scovillain|spe|1|[from] ability: moody
turn 6  |move|p2a: Scovillain|protect        |-singleturn|p2a: Scovillain|Protect
        |move|p1a: Golurk|phantomforce
        |-activate|p2a: Scovillain|move: Phantom Force|[broken]
        |-damage|p2a: Scovillain|62/140     showdown    -> 78 dealt
        |-damage|p2a: Scovillain|64/140     medicham2   -> 76 dealt
```

The bodies: **Golurk @ Golurkite, Iron Fist, Adamant**, which mega evolved on turn 1
(`|-mega|p1a: Golurk|Golurk|golurkite`) and is therefore **Golurk-Mega, Unseen Fist** by turn 6;
**Scovillain @ Scovillainite, Moody, Calm**, which never megad because its partner Raichu took the
side's one mega. Both sets are read out of `data/team-pool-frozen/games.bo3.jsonl`.

**Unseen Fist is a red herring here and it was checked, not assumed.** `checkMoveBypassesProtect`
gates the `onHitProtect` on `move.flags['protect']` (`sim/battle.ts:1300-1309`); Phantom Force carries
no `protect` flag, so the ability's handler never runs and Champions' `modify(baseDamage, 0.25)`
(`data/mods/champions/scripts.ts:301`) never applies. The shield comes down through `breaksProtect`
instead, which is what the `[broken]` line says, and both engines emitted it. The same Golurk broke
the same way through Primarina's Protect on turns 2 and 4 and **both engines agreed on those hits** —
Primarina had no Defence stage. The knob is the +2.

### The authority

The forme change recomputes the WHOLE stat line from the SET, in one step, with the nature applied
once:

```
formeChange()  if (!this.setSpecies(species, effect, true)) return false;         sim/pokemon.ts:1295
setSpecies()   const stats = this.battle.spreadModify(this.species.baseStats, this.set);
               ... this.storedStats[statName] = stats[statName];                  sim/pokemon.ts:1404
statModify()   stat = stat + evs + 20;                        <- else-branch: Reg M-B carries
               ...                                               `adjustlevel`, NOT `levelclausemod`
               if (nature.plus === statName)
                 stat = tr(tr(stat * 110, 16) / 100);
                                                          data/mods/champions/scripts.ts:10-38
```

Golurk-Mega base Atk **159**, Champions SP **32** (slot 0 of `spreadFor`'s ladder), Adamant:

```
tr( tr((159 + 32 + 20) * 110, 16) / 100 )  =  tr(211 * 1.1)  =  tr(232.1)  =  232
```

And the defence side, for completeness: Scovillain base Def 65, 0 points, Calm (Def is neutral) —
`65 + 0 + 20 = 85`; `calculateStat('def', +2)` is `Math.floor(85 * boostTable[2]) = 170`
(`sim/pokemon.ts:559-592`). So

```
baseDamage = tr(tr(tr(tr(2*50/5+2) * 90 * 232) / 170) / 50) + 2
           = tr(tr(459360 / 170) / 50) + 2 = tr(2702/50) + 2 = 54 + 2 = 56     sim/battle-actions.ts:1856
roll 93    floor(56 * 93/100) = 52   ->  STAB md4096(52, 1.5) = 78             (champions/scripts.ts:263)
```

### medicham2, before the fix

`megaEvolveNow` did not recompute. It carried the investment across as an **additive delta between
two natured anchors**:

```js
const b = l50(baseRow.bs, null, m._nature), g = l50(megRow.bs, null, m._nature);
const st = { at: g.at + (m.st.at - b.at), ... };
```

```
tr(179 * 1.1)  +  ( tr(176 * 1.1)  -  tr(144 * 1.1) )   =   196 + (193 - 158)  =  231
   196.9              193.6              158.4
```

```
baseDamage = tr(tr(1980 * 231 / 170) / 50) + 2 = tr(2690/50) + 2 = 53 + 2 = 55
roll 93    floor(55 * 93/100) = 51   ->  md4096(51, 1.5) = 76
```

**78 and 76, reproduced exactly.** (Roll 94 gives the same pair, so the conclusion does not depend on
which of the two indices the shared die drew.)

### Why it is wrong, precisely

The delta is **algebraically exact**: `1.1(Bm+20) + 1.1(Bb+S+20) − 1.1(Bb+20)` *is* `1.1(Bm+S+20)`.
The error is entirely the **three separate truncations**, which throw away 0.9, 0.6 and 0.4 — losses
that do not cancel. The exact value is 232.1 and the delta lands on 231.

**Under a neutral nature `natureStat` is the identity and the delta composes perfectly.** That is why
this survived: `game_differential.js` built every body `Serious` until 2026-08-12, and
`freshBodies`' own comment still claimed the swap *"come[s] out at a delta of exactly zero and land[s]
on Showdown's recomputed numbers"*. True when written; false the day the sheet's nature and the SP
spread arrived together. The comment is corrected in place with the date and the reason.

## WHY EVERY EXISTING INSTRUMENT WAS GREEN

| instrument | why it could not see this |
|---|---|
| `tests/test-engine-diff.js` (0/6000 at sixteen corners) | its own words: both engines "start from an empty field and **zero boosts**", and it compares a body **as built** — it never mega evolves one mid-turn. Both halves of this defect are outside its question. |
| `tests/test-nature-differential.js` PART 4 | asks EXACTLY this question, and stages **one** stone, selected for a SPEED trap. That body's deltas happen to compose. One witness is not a sweep. |
| the deliberate roster | stages an entity alone; a mega's post-evolution stat line is not an entity row. |
| the census | 765 probes, none of which compares a mega's recomputed stat line against the authority. |

## THE PROBE

`tests/probe_mega_spread_stat.js`. It drives the **real** `megaEvolveNow` through `battleInit` +
`battleTurn` — never a second copy of the swap — for all **75** mega stones in the format whose base
forme `data/engine-data.js` carries, at **both lead slots** of the SP ladder (150 cells), and compares
the resulting line against the authority's own `statModify` over the same declared set.

**RED FIRST, 8 of 150:**

```
Delphox @ Delphoxite  Mild     slot 0/1   sa authority 232  engine 231
Drampa  @ Drampanite  Adamant  slot 0/1   sa authority 190  engine 191
Golurk  @ Golurkite   Adamant  slot 0/1   at authority 232  engine 231     <- the game's witness
Lucario @ Lucarionite Adamant  slot 0/1   sa authority 172  engine 173
```

Two of the four err low and two err high, which is what a truncation looks like and what a systematic
sign error does not.

**The control is the NATURE and it can fail.** The same sweep under `Serious` is clean at **150/150**,
so the instrument can pass and the knob is real. If the neutral arm were dirty, the probe refuses to
report ARM 1 as a finding and says so instead.

**The knob:** `MEDI_MEGA_STAT_DELTA=1` restores the old delta and puts the same 8 back, stamping
`MEDFAILS.megaStatDelta`.

**What the probe structurally cannot see, stated:** only a LEAD can be told to evolve, so the sweep
covers the SP ladder's slot-0 and slot-1 spreads and not slot-2 or slot-3. A stone-holder that
switches in and megas later sits on a spread this instrument does not stage. The arithmetic is
identical; the membership of the biting set may not be.

## THE FIX

`engine/medicham2-browser.js` `megaEvolveNow` recomputes from `(the mega's base stats, the body's
spread, its nature)` — the same question `setSpecies` asks — **gated on that spread reproducing the
line the body is currently standing with**. A body whose `st` was rewritten after the build (a
transform, a staged fixture) keeps the delta rather than having it silently discarded, and both arms
carry a receipt: `MEDSEEN.megaStatFromSpread`, `MEDFAILS.megaStatDeltaFallback`,
`MEDFAILS.megaStatSpreadStale`. A `buildMon` body carries neither field and takes the delta, where it
is exact.

`engine/game_differential.js` `freshBodies` stamps `b._sp` beside the `b._nature` it already stamped —
one field, inert to anything that does not read it.

## PREDICTION AND OUTCOME

| | predicted before the run | measured |
|---|---|---|
| board-material | 10 -> **9** | 10 -> **9** (961 − 952) |
| whole-game | 11 -> **10** | 11 -> **10** (15 raw − 5 declared) |
| any of the other nine board-material games | **none move** — 4 of 75 megas bite at the lead spreads | none moved; exactly one row removed, none added |
| census | must not fall | 765 live / 765 probed / 0 missing, unmoved |

## THE SAMPLE IS THE SAME SAMPLE

Checked rather than assumed, before/after:

```
pin digest        44bd49403231   ==   44bd49403231
census pin        9446a684709d   ==   9446a684709d
team-pool digest  0d103fb9fa87   ==   0d103fb9fa87
coverage          measurable 580, exercised 563   ==   identical
games             961            ==   961
first divergences 16 rows        ->   15 rows; the ONLY difference is the removal of
                                      pair-protect-bust | ...-2660356793 | turn 6 | -damage field 3
```

Every other row is identical in config, seed, turn and class.

## EVERYTHING RE-RUN, WITH THE NUMBER

Release **`f6a3b35ed665`**, cut once and passed explicitly to every run.

| run | result |
|---|---|
| `tests/test-engine-diff.js --n 6000` | **0 of 6000** disagree, at all sixteen corners (midpoint, top, bottom, idx01–idx14). Unchanged. |
| `tests/test-mechanics.js` | **765 live / 765 probed / 0 missing**, 0 threw. Unchanged. |
| `tests/roster.js --stage items --write` | 139 FIRED-AND-BOARDS-MATCH, **0 DIFFER, 0 DID-NOT-FIRE**, 8 COULD-NOT-STAGE, 1 deferred |
| `tests/roster.js --stage abilities --write` | 129 match, **0 DIFFER, 0 DID-NOT-FIRE**, 141 could-not-stage, 45 control-not-quiet, 1 deferred |
| `tests/roster.js --stage moves --write` | 475 match, **0 DIFFER, 0 DID-NOT-FIRE**, 22 could-not-stage, 3 deferred |
| `engine/all_mechanics_fire.js --kind all --write` | moves diverged 8, abilities 3, items 1 — unchanged; 1,289 games, 0 threw |
| `engine/game_differential.js` (pinned) | 961 games, raw 15, **board-material 9**, whole-game 10 |
| `engine/status.js` | **3 of 8 gate clauses fail** (whole-game differential; mechanics 5 of 12; one open register row naming a red instrument) |

## WHAT I DID NOT DO

- Did not touch `board.js`, `magnemite.js` or `data/engine-data.js`. **`engine/board.js` has its own
  float stat arithmetic and is not this division's file** — it does not perform a mega forme change,
  so it is not exposed to this defect, but that is a claim I read rather than measured.
- Did not run a fit or self-play.
- Did not touch the random-target row, any declared row (including Supreme Overlord's
  `fallenundefined`), `magnetrise@18`, `perishsong@24`/`uproar@28`/`lockedmove`, the other nine
  board-material games, `web/`, `app/`, `engine/quality.js` or `data/quality-filter.json`.
- Did **not** execute `.scratch_eng_diffrun.cmd` or anything else in the tree I did not write this
  session.

## OWED, NOT RUN

- **The probe does not sweep the SP ladder's slot-2 and slot-3 spreads.** Only a lead can be told to
  mega, so a stone-holder that switches in and evolves later sits on a spread nothing stages. The
  membership of the biting set at those two spreads is **unknown**, not zero.
- **The three new counters are not printed by `game_differential.js`, so the differential run carries
  no receipt for them.** They were verified on a single staged mega instead:
  `MEDSEEN.megaStatFromSpread = 1`, `MEDFAILS.megaStatDeltaFallback = 0`,
  `MEDFAILS.megaStatSpreadStale = 0`, `_sp = {at:32, df:0, sa:0, sd:2, sp:32}`, `st.at = 232`. Wiring
  them into the differential's counter block is **owed**.
- **`data/engine-data.js`'s `MC.mons[key].st` lines are natured or not — I did not establish which.**
  The fix relies on a `buildMon` body having no `_nature`, which makes the delta exact for it. The
  *property* of the table was not audited.
- **`buildMon`'s own mega branch still carries the delta** (`engine/medicham2-browser.js`, the
  `mf && mf.bs` block). Under node `megaForme()` reads `window.MEGA_FORMES` and returns null, so that
  branch is browser-only and did not fire in any run here — filed, not fixed, and not measured in a
  browser.
- **`data/roster.json`** (the convenience copy) was not regenerated by this pass; the three real stage
  files were.
- **A stale scratch file is still in the repo root: `.scratch_eng_diffrun.cmd`**, pinning release
  `6272fa445b73` — a different simulator. **Reported, left in place.** Two more untracked files sit in
  `data/`: `_pair-pilot.json` and `medicham-represented-clicks.json`, neither mine. Also left.
- **`data/_scratch-scovillain-dump.json` is mine**, written by the diagnosis runs. It is debris and I
  am leaving it rather than deleting, per the standing rule; delete it freely.
- The three roster stages were re-run **without** `--team-store`/census pins, because `roster.js`
  stages its own fixtures and takes neither. Stated so nobody reads them as pinned.
- **Board-material is now 9.** Nothing here says which of the remaining nine is next.
