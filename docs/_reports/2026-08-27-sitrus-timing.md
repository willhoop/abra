# Sitrus timing — the pinch berry is eaten BETWEEN the hits of a volley

ENGINE, 2026-08-27. Target: the `extra event emitted by medicham2 :: |-enditem|p2a|sitrusberry|[eat]
<> |-damage|p2a|H/H` singleton in `data/game-differential.json`. CLOSED. CHANGELOG 5.171.0,
ROADMAP #482, release `f3383ff4aa29`.

**LEAD: BOTH ENGINES ATE THE BERRY. The authority ate it BETWEEN hit 3 and hit 4 of a four-hit Scale
Shot, at 80/170. This engine ate it after the whole volley, at 50/170.** The `extra event` is our
fourth `-damage` line; the authority's fourth reads `92/170`, because its body had already healed.
Both ended the turn on 92/170, which is why no board check ever saw it.

---

## `eachEvent('Update')` IS INSIDE THE HIT LOOP, SO A PINCH BERRY IS EATEN BETWEEN THE HITS OF A VOLLEY AND NOT AFTER IT. **WHOLE-GAME CLAUSE 6 OF 961 -> 5 OF 961.** BOARD-MATERIAL UNMOVED AT 1 OF 961. CENSUS UNMOVED AT 754 LIVE / 754 PROBED / 0 MISSING. 2026-08-27.

Release `f3383ff4aa29` (cut for this — `engine/medicham2-browser.js` is a SOURCES file and it moved),
arm `middle`, 961 games, `--turns 12`, `--team-store data/team-pool-frozen`, census pin
`9446a684709d`. Register row: ROADMAP **#482 — CLOSED**. CHANGELOG 5.171.0.
Probe: `tests/probe_multihit_update.js`. Full account: `docs/_reports/2026-08-27-sitrus-timing.md`.

### WHICH SCOREBOARD IT SHOULD MOVE, SAID BEFORE THE RUN

**The pinned pool, by one game. The census not at all, and board-material not at all.** The target was
a named singleton in `data/game-differential.json`, so the pool is exactly where it lives; the mechanic
is a POSITION rather than a new capability, so no census row could be added without inventing one; and
the two engines' end-of-turn boards already agreed on the observed game, so board-material had no room
to fall. Board-material MAY rise on a fix that changes mid-turn HP, and a rise would have been the
signal to stop and report. All three held.

### WHO ATE THE BERRY AND WHO DID NOT — THE DIRECTION, BEFORE ANYTHING WAS TOUCHED

The artifact's cause string names the CLASS and not the direction:

```
extra event emitted by medicham2 :: |-enditem|p2a|sitrusberry|[eat] <> |-damage|p2a|H/H
```

`classify()` sets that class when `sdLater && !meLater` — the authority's head line reappears LATER in
our stream, and ours reappears nowhere in theirs. So the `showdown` field is the authority's first
unmatched line, the `medicham` field is ours, and OUR line is the extra one. Read out of
`data/divergence-turns.json` card 3 with both streams side by side — a four-hit Scale Shot into a 170 HP
Incineroar holding a Sitrus:

```
SHOWDOWN                              MEDICHAM2
-damage 140/170                       -damage 140/170
-damage 110/170                       -damage 110/170
-damage  80/170   <- crosses 1/2      -damage  80/170
-enditem Sitrus Berry [eat]           -damage  50/170   <- a body the authority never had
-heal   122/170                       -enditem Sitrus Berry [eat]
-damage  92/170                       -heal    92/170
-hitcount 4                           -hitcount 4
```

**BOTH ENGINES ATE THE BERRY AND BOTH ENDED THE TURN ON 92/170.** The authority ate it BETWEEN hit 3 and
hit 4, at **80/170**; this engine ate it after the whole volley, at **50/170**. The `extra event` is our
fourth `-damage` line, which has no counterpart because the authority's fourth reads `92/170` — it lands
on a body that has already healed.

### IT IS NOT NARRATION, AND THE OBSERVED GAME IS THE BENIGN CORNER OF IT

The engine spent two hits standing on an HP the authority never reaches. Where the remaining packets
total more than the post-berry pool, the authority's body LIVES and this one FAINTS — a board
difference, off the same wire, that this particular pair of teams happened not to reach. The end-of-turn
board agreeing is a fact about the sample, not about the mechanism.

### THE AUTHORITY'S POSITION, AND WHICH FILE IT WAS READ FROM

`hitStepMoveHitLoop` raises the Update event once per HIT, one statement below the damage accounting
and INSIDE the loop:

```
for (const [i, md] of moveDamage.entries()) { ... move.totalDamage += damage[i]; }
this.battle.eachEvent('Update');                       sim/battle-actions.ts:967
if (!pokemon.hp && targets.length === 1) { hit++; break; }
}
this.battle.faintMessages(false, false, !pokemon.hp);  :976
```

**Champions overrides the whole loop** — `data/mods/champions/scripts.ts:428` — **and keeps that line
verbatim at `:538`.** It does **not** override the berry: `grep -c sitrus
data/mods/champions/items.ts` is `0`, so `sitrusberry` is mainline `data/items.ts:5740`,
`onUpdate(pokemon) { if (pokemon.hp <= pokemon.maxhp / 2) pokemon.eatItem(); }` with
`onEat: this.heal(pokemon.baseMaxhp / 4)`. Both files were opened this session; neither number is typed
from memory.

### THE ENGINE HAD ALREADY DECLARED THIS HALF MISSING, AND NO COUNTER COULD SAY SO

`_stepUpdate`'s own header, written 2026-08-23, lists it under *what this does not do*: *"the pass is
per HIT in the authority and this engine wraps the step list once per MOVE, so a multi-hit move gets one
pass rather than n"*. `_stepUpdate` is the LAST hit's pass. The other n-1 did not exist.

**`MEDSEEN.inMoveUpdateRan` has been non-zero since the day that header was written**, so the existing
counter reads exactly the same on an engine with this wire and on one without it. The new
`MEDSEEN.multiHitUpdateBetweenHits` is kept apart for that reason and for no other.

### THE FIX

`engine/medicham2-browser.js` only, inside `_stepApply`'s packet loop: `_updateEvent()` after each
packet except the last, which `_stepUpdate` already owns. It is `_updateEvent` and NOT `_updateAll`,
for `_stepUpdate`'s reason — the White Herb sweep rides on `onAnyAfterMove`, which the authority raises
in `useMove` a level ABOVE the hit loop, so it must not fire between two hits of one move.

### WHAT THE FIX DOES NOT DO — DECLARED, NOT LEFT TO BE FOUND

The authority raises the pass below that hit's WHOLE `spreadMoveHit`, its secondaries and its
`onAfterHit` included; this engine raises it below the PACKET, with those steps still wrapped once per
move. **No multi-hit move in this format carries a target secondary** — derived and printed on every
probe run rather than trusted to this sentence — so the two positions coincide today. The once-per-move
wrap of the step list is untouched and remains `tests/test-resolution-order.js`'s KNOWN-OPEN
`a1-multihit-frequency` arm, which still parts on Toxic Debris between two Dual Wingbeat hits.

### THE PROBE, AND WHY THE FIXTURE IS SEARCHED

A crossing that lands on the LAST hit is invisible — both engines eat in the same slot — and a crossing
that KILLS is a different claim. So `tests/probe_multihit_update.js` derives the usable multi-hit moves
from the format (printing every one with the reason it is or is not usable: a sub-100 accuracy misses on
this arm, `smartTarget` splits the hits across bodies, and **two hits cannot produce a surviving
mid-volley crossing at all**, because the crossing needs `d >= H/2` and survival needs `2d < H`), picks
the berry off `healsAtThreshold` in `data/tags.json` — the same tag `berryPinchUpdate` consumes — and
then PLAYS candidate boards, keeping the first whose **SHOWDOWN** stream shows the eat strictly between
the first and last `-damage` with no faint. medicham2's stream is never consulted while choosing, and
the selection is printed so a reader can check that.

Red first, on Bullet Seed into a Sitrus Absol:

```
`-damage` lines BEFORE the eat     : showdown 3    medicham2 5     RED
lowest HP the body ever stood on   : showdown 45   medicham2 10    RED
HP at the end of the volley        : showdown 45   medicham2 45    green  <- why every board check passed
```

and green after, with the control child on `MEDI_MULTIHIT_UPDATE_ONCE=1` reading `beforeEat=5
lowest=10` — the knob moves the eat AND parts from the authority, so it is wired and it is the old
behaviour.

### THE SAMPLE WAS PROVEN IDENTICAL, NOT ASSUMED

Same 961 games, same 12,450 turn boundaries, same steering digest `9446a684709d`, same pin digest
`2efbc9ed1946`, same 252 rows credited, same end-reason split (`946` at the turn cap, `15` battles
ended). Diffing the two first-divergence lists: **exactly one gone, none arrived** — `baseline`
`seed ...2655780718 vs ...2655961808` t12, the `extra event emitted by medicham2` game. That class is
now absent from the artifact.

### THE HAND LIST

**Left it:** the mid-volley `onUpdate` position — it is `tests/probe_multihit_update.js` now.
**Joined it:** nothing. The per-hit wrap of the whole step list was already carried by
`tests/test-resolution-order.js`'s KNOWN-OPEN arm and is unchanged.

### RE-CONFIRMED, NOT RE-FILED — ROADMAP #446

`tests/test-resolution-order.js` ran out of heap at node's default limit here (`FATAL ERROR: Reached
heap limit`, ~2 GB, 25 s in) and **PASSES at `--max-old-space-size=6144`** — 26 arms staged, 1
KNOWN-OPEN, 0 failing. **That is ROADMAP #446, filed 2026-08-26, and this is a second observation of
it rather than a new finding.** #446 already names the cause (the file opens a release per arm and ~26
frozen engines are resident at once) and already proved it is not a batch's doing. Re-proved here the
same way, on this change: it OOMs identically under `MEDI_MULTIHIT_UPDATE_ONCE=1`, which restores the
previous behaviour exactly, so the extra `_updateEvent()` calls are not the allocation.

### OWED, NOT RUN

Nothing on this fix's own critical path. `data/divergence-turns.json` was **not** regenerated — the
`--dump-out` path is joined to the repo root, so the run's dump write threw AFTER the artifact was
written, and rewriting the repo copy would have clobbered an artifact another session is holding. The
readable card for this game is card 3 of the existing dump, quoted above.


---

## THE EXACT COMMANDS THAT PRODUCED EVERY NUMBER ABOVE

Every heavy run went through `tools/lownode.cmd` via a `spawnSync` shim (`cmd.exe /c <abs path to the
.cmd>` — Git Bash cannot invoke it as `cmd /c "…"`, and a repo-relative path is not resolved either).
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` throughout.

```
node tests/probe_multihit_update.js                      # RED before, green after

tools/lownode.cmd tests/test-mechanics.js                # census -> 754 live / 754 probed / 0 missing
tools/lownode.cmd tests/test-engine-diff.js --n 6000     # 0 of 6000, all sixteen corners
tools/lownode.cmd engine/engine_release.js cut "..."     # -> release f3383ff4aa29

tools/lownode.cmd engine/game_differential.js --games 1200 --arm middle --turns 12
    --team-store data/team-pool-frozen
    --census data/verification/census-pin-9446a684709d.json
    --state --end-state --release f3383ff4aa29
    --baseline <a copy of the 08:58Z artifact> --write

tools/lownode.cmd tests/roster.js --stage items     --write
tools/lownode.cmd tests/roster.js --stage abilities --write
tools/lownode.cmd tests/roster.js --stage moves     --write
tools/lownode.cmd engine/all_mechanics_fire.js --kind all --write
node engine/status.js
```

Also run and green after the change: `test-game-diff`, `test-damage-roll-support`,
`test-volatile-duration`, `test-protocol-trace`, `test-engine-consistency`,
`probe_recoil_after_clamp`, `probe_lifeorb_toll --release f3383ff4aa29`, `test-tag-params-derived`,
`probe_spread_status_steps`, `probe_poltergeist_use_time`, `probe_unburden_herb_paths`,
`probe_knockoff_megastone`, `test-encore-fail-silent`, `test-bracket-regain`, `test-immunity-gate`.

## OWED, NOT RUN

- **The readable divergence dump was not regenerated.** `--dump-out` is joined to the repo root, so an
  absolute out-path threw AFTER the artifact had been written; the repo copy was left alone
  deliberately, because another session is holding it. To refresh it inside the repo:

```
tools/lownode.cmd engine/game_differential.js --games 1200 --arm middle --turns 12
    --team-store data/team-pool-frozen
    --census data/verification/census-pin-9446a684709d.json
    --state --end-state --release f3383ff4aa29 --write --dump-games 20
```

- **`tests/test-resolution-order.js` heap headroom.** ENGINE-owned, and it is not this mechanic. It
  passes with headroom and OOMs at the default, identically with the knob restoring the old behaviour:

```
node tests/test-resolution-order.js                                          # FATAL: heap limit, ~2 GB
node --max-old-space-size=6144 tests/test-resolution-order.js                # PASS, 26 arms, 0 failing
MEDI_MULTIHIT_UPDATE_ONCE=1 node tests/test-resolution-order.js              # also FATAL — the control
```

- **The interaction matrix, the release ladder and the tag coverage are still WITHHELD** by
  `engine/provenance.js`. They were already withheld before this change and were not re-run here:

```
tools/lownode.cmd tests/test-interaction-matrix.js
tools/lownode.cmd engine/wire_ladder.js
tools/lownode.cmd engine/tag_dex.js
```

- **The refit is still OWED and was not touched.** `feature_fixture --check` was already failing on
  the fixture identity and the damage table before this session. That is MEASURE's, not ENGINE's.
