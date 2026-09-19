# 2026-09-18 — the in-scope roster rows that were never staged

ENGINE division, isolated worktree `.claude/worktrees/agent-a3958a3f18be49387`, LIGHT MODE (single rows
only; no full stage, no differential, no quarantine, no all_mechanics_fire). Historical record, not
maintained.

## 1. What was open (read off `data/roster.{moves,abilities}.json`, both generated 2026-09-12 on release `bc8d7cf849dd`)

| stage | row | verdict | reason on file |
|---|---|---|---|
| moves | Focus Energy | COULD-NOT-STAGE | it IS the control click; no second control click (23 candidates, all refused) |
| moves | Struggle | COULD-NOT-STAGE | "contradiction": the menu must be empty, and the control's replacement click must be choosable |
| moves | Axe Kick | DEFERRED-BY-OWNER | usage shelf (2 clicks) — left alone |
| moves | Copycat | DEFERRED-BY-OWNER | Will, 2026-08-10 — left alone |
| moves | Electrify | DEFERRED-BY-OWNER | usage shelf (18 clicks) — left alone |
| abilities | Frisk | COULD-NOT-STAGE | only handler is `onStart` → `this.add` (message only) |
| abilities | Good as Gold | COULD-NOT-STAGE | both in-play controls are Status moves, which it refuses |
| abilities | Quick Feet | COULD-NOT-STAGE | Speed window 182..273 holds one body (Dragapult), no usable ability |
| abilities | Simple | COULD-NOT-STAGE | conferred (Simple Beam), no sheet body, no conferral rule |
| abilities | Zero to Hero | COULD-NOT-STAGE | `failskillswap` + `cantsuppress` + single slot: every control shape shut |
| abilities | Anticipation, Forewarn, Illusion, Pickup, Stall | DEFERRED-BY-OWNER | left alone |

Showdown: `C:/Users/willj/Projects/Pokemon/pokemon-showdown` (absolute path, same checkout the main tree
uses — `tests/roster.js` reads `SHOWDOWN_PATH`, nothing resolves it relatively, so the worktree needed
no change). `tools/lownode.cmd` could not be used: the worktree sandbox refuses `cmd.exe`, so every run
was a plain `node --max-old-space-size=6144`, one row at a time.

## 2. Verdicts — every row staged ALONE with `--only <id> --reds`

Release `4a13ae246e89` = the worktree tree (HEAD `10c6bbbf` + this pass's engine fix). It lives in the
worktree's ignored `data/releases/`; the pointer `data/engine-release.json` was restored to HEAD so it
does not collide on merge.

| row | fixture (all derived; carrier printed by the run) | verdict | red demo |
|---|---|---|---|
| **Good as Gold** | Pangoro (Iron Fist) clicks Scary Face at Gholdengo. CONTROL = the same thrower holding **Mold Breaker** — the carrier is never touched, the refusal is pierced. Reading: Gholdengo `boosts.spe` | **DID-NOT-FIRE on `bc8d7cf849dd`** → FIRED-AND-BOARDS-MATCH on `4a13ae246e89`; DID-NOT-FIRE again under `MEDI_STATUS_REFUSAL_UNBREAKABLE=1` | CAUGHT (new anchor on `statusRefuser`) |
| **Simple** | new rule `ability/conferred-by-a-move`: Audino (Klutz) clicks Simple Beam at Glimmora (Corrosion); Glimmora clicks Acid Armor. CONTROL = the beam replaced by the inert click. Reading: `boosts.def` (+4 vs +2) | FIRED-AND-BOARDS-MATCH | CAUGHT (amplifier anchor) |
| **Quick Feet** | Blaziken clicks **Agility** on the setup turn in both arms (264 after the boost, inside 182..273, 2-point margins); Whimsicott's Poison Powder is aimed at its **ally** Jolteon (bottom-tie-first, `mayMiss` declared). Reading: whether Feather Dance lands before Body Slam's paralysis | FIRED-AND-BOARDS-MATCH | CAUGHT |
| **Focus Energy** | every body clicks Focus Energy 3 turns; CONTROL swaps every click for **Magnet Rise**, admitted because its volatile's only non-announcing handler is `if (type === 'Ground') return false;` and the script (asserted) holds no Ground move, hazard or terrain. New selftest clause 1b proves Magnet Rise inert (48 own-leaf moves, 0 foreign, 547 leaves agree) | FIRED-AND-BOARDS-MATCH | CAUGHT (`vol.focusenergy` write skipped) |
| **Struggle** | Starmie holds Recover ALONE (max PP 8 from `tags.json`), clicks it 8× at full HP (fails, spends PP), turn 9 Struggle. CONTROL = same body with the inert click added to its menu — the moveset is not a board leaf. Struck Torterra 680→662, recoil 540→405 | FIRED-AND-BOARDS-MATCH | CAUGHT (new max-HP recoil anchor; the old `_rc` anchor read NOT CAUGHT) |
| **Zero to Hero** | Palafin switches out to Torkoal and back, then Ice Beam at Goodra-Hisui. CONTROL removes the **trigger** (never leaves). Reading DECLARED and narrowed (`ignore.only`): Palafin's party-row species + the struck foe's HP (31 vs 18). The two-engine comparison of the subject arm is NOT narrowed. `hpB: 1` because the authority recomputes maxhp on a forme change (first run read 175 vs 700 — the harness, not the engine) | FIRED-AND-BOARDS-MATCH | CAUGHT (new switch-out-trigger anchor) |
| **Frisk** | not built (no board leaf) | DEFERRED-BY-OWNER (Will, 2026-09-18) — was COULD-NOT-STAGE; see §5 | — |

Regression checks, same release, nothing moved: `--selftest` all ok; `--rule ability/conditional-speed`
2 MATCH; `--rule ability/an-arrival-a-field-or-a-refusal` 5 MATCH + Frisk; `--rule move/recoil` 11 MATCH;
`--only intimidate` MATCH; every red demonstration CAUGHT, none WEAK.

## 3. The engine defect

**A Mold Breaker's Status move was refused by Good as Gold.** Authority:
`data/abilities.ts:1620-1627` (`onTryHit` returns null for a Status move; `flags: { breakable: 1 }`),
`sim/battle.ts:836-840` (a breakable ability handler is skipped while `suppressingAbility`),
`sim/battle.ts:365-367`, Mold Breaker `data/abilities.ts:2679-2685` (`move.ignoreAbility = true`).
`data/mods/champions/abilities.ts` overrides neither. medicham2 read `refusesStatusMoves` off the RAW
ability at seven sites (`tryHitRefusal` + six inline) and never through `suppressedAbility`, the reader
`absorbedBy` already uses. Fix: one reader, `statusRefuser(m,t)`, at all seven; counter
`MEDSEEN.statusRefusalPiercedByMoldBreaker`; knob `MEDI_STATUS_REFUSAL_UNBREAKABLE=1` restores the
defect (stamps `MEDFAILS.statusRefusalUnbreakableRestored`, added to test-mechanics' DELIBERATE_BREAK
list so a knob run cannot write the census).

Census probe added (`tests/test-mechanics.js`, tag `ignoresDefenderAbility`): *Mold Breaker's Status move
reaches a Good as Gold body* — Thunder Wave `none`→`par`, Scary Face `0`→`-2`. MISSING under the knob,
LIVE without. Census in the worktree: **886 → 887 live, 0 missing** (the regenerated file was restored to
HEAD afterwards so it cannot conflict on merge; it must be regenerated after the merge).

**Suspected sibling, not probed, not fixed:** `moveIdRefusal` (Oblivious, `refusesMovesById`, also
breakable) asks the raw ability the same way.

## 4. What changed in the instrument (tests/roster.js)

- `controlOf`: new control kinds `piercer`, `conferred`, `trigger`; `ignoreSubjectInert` (Struggle) gives
  the control carrier the inert click back; `armDelta` honours `ignore.only` (only the `trigger` kind sets it).
- `INERT_ALT` admits a condition whose `onImmunity` is exactly one-type (`INERT_ALT_IMMUNE_TO`); every
  other handler still refused. Selftest clause 1b added.
- `speedFlipFoe` / `speedOrderFoe` take optional `{foeMult, foePred}`; absent, byte-identical behaviour.
- Latent bug in the never-reached Quick Feet branch fixed: the status click was aimed at FOE slot 0
  (Blaziken got poisoned) — it is aimed at the ally now, with `mayMiss` on the bottom arm.
- Breaks added: `statusRefuser` (arrival rule), max-HP recoil (`move/recoil`), switch-out trigger
  (`ability/entry`), `vol.focusenergy` write (`move/is-the-control-click`), boost amplifier
  (`ability/conferred-by-a-move`).
- **The arrival rule's new anchor exists only in releases ≥ `4a13ae246e89`.** A full abilities stage on
  `bc8d7cf849dd` would print it as a DEAD ANCHOR.

Predicted after a full re-run (NOT measured — single rows only): moves tested 492 → 494 of 497, CNS 2 → 0;
abilities tested 190 → 194 of 200, CNS 5 → 0, DEFERRED 5 → 6 (Frisk).

## 5. Frisk — deferred by Will

Its whole effect is one `-item` protocol line; no leaf `board_state.js` compares moves. Will, 2026-09-18:
*"set frisk aside."* Wired, not recorded: `frisk` is in the `DEFERRED` map beside Anticipation and
Forewarn (same shape: `by`, `on`, `why` carrying his words). Because its rule REFUSES it before `runEntry`
(where the closet is checked), `assign` now applies an owner shelf to an in-scope refusal and keeps
COULD-NOT-STAGE as `underlying_verdict`. `--stage abilities --only frisk` now reads **DEFERRED-BY-OWNER 1,
COULD-NOT-STAGE 0**; `--only forewarn` is unchanged (DEFERRED-BY-OWNER).

## 6. Second batch (coordinator, same day)

### 6a. ROADMAP #421 — the usage shelf keyed on the stage name

`usageShelf` opened with `if (STAGE !== 'moves' || ...) return r;`, so a move row was shelved under
`--stage moves` and not under `--stage all`. Measured before the fix, each row staged alone on
`4a13ae246e89`:

| row | `--stage moves` | `--stage all` |
|---|---|---|
| Axe Kick | DEFERRED-BY-OWNER | **FIRED-AND-BOARDS-DIFFER** |
| Electrify | DEFERRED-BY-OWNER | **FIRED-AND-BOARDS-DIFFER** |

Fix: `if (!r || !CLICKS || r.kind !== 'move') return r;`. After: all four cells DEFERRED-BY-OWNER.
Items and abilities are untouched (they were excluded before by the stage name and are excluded now by
the row kind).

### 6b. Oblivious under Mold Breaker — board-identical, not changed

Authority: `oblivious` carries `flags: { breakable: 1 }` (`data/abilities.ts:3026`), its `onTryHit`
refuses Attract, Captivate and Taunt (`:3014-3019`), and its `onUpdate` (`:2999-3010`) removes an
`attract` or `taunt` volatile. No Champions override. So a Mold Breaker's Taunt passes the refusal and
the volatile is then cured at once.

Fixture (scratch, through `tests/roster.js` as a library, both engines): Pangoro holding Iron Fist
(subject) / Mold Breaker (control) clicks Taunt at a Salazzle holding Oblivious; turn 2 Salazzle clicks
Protect. Result: `vol.taunt` **0 at every boundary, both arms, both engines**, zero two-engine diffs;
Showdown's own delta empty (THE STAGING IS INERT). Control for the reading: the same fixture with
Salazzle on Corrosion reads `taunt 3` in both engines at turn 1, so the leaf is live.

So this engine refusing (`moveIdRefusal` on the raw ability) and the authority landing-then-curing agree on
the board. The difference is narration only (`-immune` here against `-start`/`-activate`/`-end` there),
unmeasured. **No engine change** — a knob restoring a defect with no board consequence would be red on
nothing.

### 6c. Other breakable refusal abilities still read raw — listed, not staged, not fixed

From the tags carrying `breakable` beside a refusal/immunity tag, every engine site that reads one off a
body's RAW `.ability` rather than through `suppressedAbility`:

| site | tag / ability | note |
|---|---|---|
| `bounceOff` (`medicham2-browser.js`, `TAGS.param('ability',target.ability,'reflectsStatusMoves')`) | Magic Bounce | a Mold Breaker's status move should not be bounced |
| `abilityRefusesItemLoss` (`m.ability`, `refusesItemLoss`) | Sticky Hold | a Mold Breaker's Knock Off/Trick |
| `applyConfusion` (`t.ability`, `refusesVolatile`) | Own Tempo | a Mold Breaker's confusion move |
| the Damp gate (`x.ability`, `blocksExplosion`) | Damp | a Mold Breaker exploder |
| `moveIdRefusal` (`t.ability`, `refusesMovesById`) | Oblivious | measured board-identical (6b) |
| the `blocksMove` narration site (`x.ability`) | Armor Tail / Queenly Majesty | narration line only |

Sites seen calling `suppressedAbility` directly: `absorbedBy` (and the `typeImmunity` /
`refusesAllyDamage` reads inside it), both `immuneToMoveClass` readers, both `refusesForcedSwitch`
readers. The remaining reads (`preventsCrit`, `refusesSecondaries`, `statusImmune`, `preventsStatDrop`,
`halvesTypeDamage`) take an ability argument whose origin was NOT traced in this pass. Each of the first
four table rows needs its own fixture before it is called a defect.

## 7. Third batch — every breakable refusal against a Mold Breaker

Instrument: **`tests/probe_moldbreaker_refusals.js`** (new, ENGINE-owned). Each case is a roster scenario
played through `tests/roster.js` as a library: the SUBJECT thrower holds a non-piercing ability, the
CONTROL is the same thrower holding Mold Breaker (`controlKind: 'piercer'`), and a READABLE arm puts a
different ability on the carrier to prove the click lands on a board leaf the reading can see. Legality of
every thrower (Mold Breaker slot + learnset) and carrier is re-asserted on each run. Parent plays clean;
one child per knob must read DID-NOT-FIRE.

Authority, all four `flags: { breakable: 1 }`, none overridden in `data/mods/champions/`:
Magic Bounce `data/abilities.ts:2427-2450`, Sticky Hold `:4614-4623`, Own Tempo `:3134-3154`,
Damp `:801-815`; the skip is `sim/battle.ts:836-840`.

| case | thrower / move → carrier | pre-fix (`4a13ae246e89`) | verdict now (`0fe2604193c8`) | class |
|---|---|---|---|---|
| Magic Bounce | Pangoro (Iron Fist / Mold Breaker) Scary Face → Espeon | DID-NOT-FIRE (drop bounced onto Pangoro) | MATCH | **board — fixed**, `MEDI_BOUNCE_UNBREAKABLE=1` red |
| Sticky Hold | Pangoro Knock Off → Hydrapple holding Light Clay | DID-NOT-FIRE (item kept) | MATCH | **board — fixed**, `MEDI_STICKYHOLD_UNBREAKABLE=1` red |
| Good as Gold | Pangoro Scary Face → Gholdengo | (fixed in §3) | MATCH | board, `MEDI_STATUS_REFUSAL_UNBREAKABLE=1` red |
| Own Tempo | Basculegion (Adaptability / Mold Breaker) Confuse Ray → Slowbro | INERT | INERT; READABLE arm (Regenerator) confusion lands | **narration only**: `onUpdate` cures it; not changed |
| Oblivious | Pangoro Taunt → Salazzle | INERT | INERT; READABLE arm (Corrosion) taunt lands | narration only (§6b) |
| Damp | — | — | — | **cannot occur**: no legal Mold Breaker user learns Explosion / Self-Destruct / Misty Explosion (asserted every run) |

Fix shape: `bounceOff` and `abilityRefusesItemLoss` keep their raw read BYTE-IDENTICAL (so the roster's
existing plant on the Sticky Hold line still applies on every release) and then ask
`suppressedAbility(user, target)`; a pierced refusal is counted (`MEDSEEN.bouncePiercedByMoldBreaker`,
`MEDSEEN.itemLossRefusalPiercedByMoldBreaker`). A first version that rewrote the raw line killed the
roster's Sticky Hold anchor (DEAD ANCHOR, `ability/an-item-is-eaten-taken-or-handed-on`) and was redone.

Evidence: probe 21 of 21 PASS on `0fe2604193c8`; `--only stickyhold` on `4a13ae246e89` FAILS the board
clause. Census **887 → 889 live, 0 missing** (two new probes: *Mold Breaker's status move is not bounced by
Magic Bounce*, *Mold Breaker's Knock Off takes a Sticky Hold item*), each MISSING under its own knob with
the census write refused; file restored to HEAD afterwards. Single-row roster re-stages on
`0fe2604193c8`: magicbounce, stickyhold, goodasgold, knockoff all FIRED-AND-BOARDS-MATCH.
`--only magicbounce --reds` reads NOT CAUGHT for `ability/absorbs-a-type` — the SAME on `4a13ae246e89`,
pre-existing (that rule's plant aims at `typeImmunity`).

## PROPOSED NOTES ROW

> **2026-09-18 — ENGINE: six of the seven unstaged in-scope roster rows get constructed fixtures; Mold
> Breaker now pierces Good as Gold.** Good as Gold, Simple, Quick Feet, Focus Energy, Struggle and Zero to
> Hero each staged alone (`tests/roster.js --only <id> --reds`) on release `4a13ae246e89`: all six
> FIRED-AND-BOARDS-MATCH with the red demonstration CAUGHT. Good as Gold read **DID-NOT-FIRE** on
> `bc8d7cf849dd` — a Mold Breaker's Status move was refused at seven refusal sites that read the raw
> ability (`data/abilities.ts:1620-1627`, `sim/battle.ts:836-840`); fixed through one reader
> `statusRefuser`, knob `MEDI_STATUS_REFUSAL_UNBREAKABLE=1`. The same defect at **Magic Bounce** (a Mold
> Breaker's Scary Face bounced onto the thrower) and **Sticky Hold** (a Mold Breaker's Knock Off kept the
> item), both DID-NOT-FIRE before and fixed through `suppressedAbility`, knobs
> `MEDI_BOUNCE_UNBREAKABLE=1` / `MEDI_STICKYHOLD_UNBREAKABLE=1`, proven by new
> `tests/probe_moldbreaker_refusals.js` (21/21 on release `0fe2604193c8`). Own Tempo and Oblivious
> measured board-identical (narration only, unchanged); Damp cannot occur in Reg M-B (no legal Mold
> Breaker user learns a self-destructing move). Census **886 → 889 live, 0 missing**
> (`data/mechanics-census.json`, three new probes).
> Frisk is DEFERRED-BY-OWNER (Will, 2026-09-18: *"set frisk aside."*), wired into the same `DEFERRED`
> map as Anticipation and Forewarn; a single-row stage reads DEFERRED-BY-OWNER. ROADMAP #421 closed: the
> move usage shelf is keyed on the row being a move, not on `--stage moves`, so Axe Kick and Electrify
> read DEFERRED-BY-OWNER under both `--stage moves` and `--stage all` (they read FIRED-AND-BOARDS-DIFFER
> under `all`). Oblivious under Mold Breaker measured board-identical in both engines (narration-only,
> not changed); four other breakable refusals that read the raw ability are listed in the report,
> unstaged. Full stage re-runs owed; predicted moves 494/497 and abilities 194/200 tested with
> in-scope COULD-NOT-STAGE 0 in both, not yet measured. Report:
> `docs/_reports/2026-09-18-roster-unstaged.md`.
> **Supersedes.** The roster's `could_not_stage_in_scope` 2 (moves) and 5 (abilities), and abilities
> DEFERRED 5 → 6, once the stages are re-run. **Basis.** unchanged. **Owes.** `docs/ABRA-technical-docs.md` and `docs/SUMMARY.md` roster
> figures at the next major.

## OWED, NOT RUN

Run from the main tree after the merge, one at a time, with a release cut over the merged tree:

```bash
node engine/engine_release.js cut "ENGINE 2026-09-18: roster unstaged rows + Good as Gold/Mold Breaker"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/test-mechanics.js        # census 889 expected
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown MEDI_STATUS_REFUSAL_UNBREAKABLE=1 node tests/test-mechanics.js   # must print MISSING and refuse to write
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node --max-old-space-size=6144 tests/probe_moldbreaker_refusals.js --release <id>   # 21/21, three knob children red
cmd.exe /c "tools\lownode.cmd tests\roster.js --selftest --release <id>"
cmd.exe /c "tools\lownode.cmd tests\roster.js --stage items --reds --write --release <id>"
cmd.exe /c "tools\lownode.cmd tests\roster.js --stage abilities --reds --write --release <id>"
cmd.exe /c "tools\lownode.cmd tests\roster.js --stage moves --reds --write --release <id>"
node engine/status.js --write
```

The engine byte change invalidates every artifact on the old release; the usual re-runs (engine-diff,
game differential at the three lattices, all_mechanics_fire, quarantine) are the coordinator's call.
