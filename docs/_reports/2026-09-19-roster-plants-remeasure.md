# Roster plants re-aimed, a legal control click, and 6.50.0 re-measured on `74be319d02fa` — 2026-09-19, ENGINE

A findings record, not a living document. Superseded by the register rows it feeds; not cited as current
state. `node engine/status.js` and `node engine/quarantine.js` hold the current state.

---

## 0. VERDICT

- **Both red plants CAUGHT again.** `item/accuracy-scaled` via Bright Powder, `ability/weather-evasion` via
  Sand Veil, each on a single-rule `--reds` run, and each shown NOT CAUGHT on the same command first.
- **Legality: the Focus Energy filler is gone from almost every body.** Runtime fixture check, illegal sets
  per stage: items **385 → 17**, abilities **583 → 94**, moves **638 → 57** (before = `482e8f5ca701`,
  `docs/_reports/2026-09-18-merged-remeasure.md` §4; after = this pass). `all_mechanics_fire` **83 → 0**.
  "can't learn Focus Energy" alone: **13 / 49 / 29**. All of those are rows KEPT on Focus Energy by name
  (§2). The rest are other moves (Dragon Claw, Bite, Skill Swap...), which is #318 territory and was
  not touched.
- **Lattices on `74be319d02fa`: board-material 0 / 5 / 12, from 0 / 7 / 20.** The ten predicted games left,
  exactly those ten. **No game joined.** Narration stays at 0 / 12 / 24.
- **Roster:** items 147 MATCH + **1 DIFFER** (Greninjite), abilities 194 of 200, moves 494 of 497. Reds
  22 / 63 / 37, every one CAUGHT, 0 dead anchors.
- **Gate `CLOSED — 2 of 8`** (was 3 of 8). The two FAILs are board-material (0 / 5 / 12) and
  **roster/items (1 DIFFER)**. The items FAIL is new and it is a **real engine divergence** that the
  legal control exposed: Protean converts the user on a status move whose `onTry` fails. It is not an
  instrument error (§3).

## 1. PART A.1 — THE TWO PLANTS

Both old anchors still matched once, but on lines inside `if(ACCMOD_BY_NAME){…}`, which only runs under
`MEDI_ACCMOD_BY_NAME=1` since 6.48.0. So the patches were applied to dead code. The re-aim is tied to
function **signatures**, not to lines in a function body:

| rule | new anchor | break |
|---|---|---|
| `item/accuracy-scaled` | `function accModRow(kind,id){` | `if(kind==='item')return null;`. Every item's accuracy row is dropped, on both the tag path and the knob path |
| `ability/weather-evasion` | `function _accWhen(w,ctx,holder){` | `if(w&&ctx&&w===ctx.weather)return false;`. A row gated on the weather now in the sky never applies. This reads what the gate compares; no weather id is typed |

Evidence (release `74be319d02fa`):

| command | before re-aim | after |
|---|---|---|
| `tests/roster.js --rule item/accuracy-scaled --stage items --reds` | `NOT CAUGHT`, exit 1 | `CAUGHT via brightpowder -> DID-NOT-FIRE on party.hp, hp`, exit 0 |
| `tests/roster.js --rule ability/weather-evasion --stage abilities --reds` | `NOT CAUGHT`, exit 1 | `CAUGHT via sandveil -> DID-NOT-FIRE on party.hp, hp`, exit 0 |

On the full `--reds` stages both are still CAUGHT (items 22 of 22, abilities 63 of 63).

## 2. PART A.2 — THE CONTROL CLICK AND THE LEGALITY CHECK

**Measured first.** 55 of the 347 legal species learn Focus Energy, and 346 learn Sleep Talk. The one that
does not is Ditto. `scaffold()` appended Focus Energy to every body.

**The substitute is derived, not named.** It uses the same rule as `tests/probe_partingshot_conditional.js`:
a legal Status move, `target: 'self'`, that passes the primary's own `inertShapeComplaint` cap and whose
`onTry` RETURNS the sleep test. That derivation yields exactly Sleep Talk. Inertness was proved with
`--selftest --inert sleeptalk`: no board leaf moved in either engine over 3 turns, beyond its own 24
`pp.sleeptalk` movements. The selftest now proves both clicks every run: Focus Energy kept on purpose
(48 own leaf movements), and the scenario as built (Sleep Talk).

**Per scenario, from per-species learnsets. The reason is the script language.** A click names one
move id (`scripted()` matches `want.m` against the request), and the body in a slot changes across a
switch or a faint. So a scenario idles on Focus Energy if every holder learns it, which leaves it
byte-identical to before. Otherwise every holder must learn Sleep Talk and the whole scenario is
rewritten to it inside `play()`. Both arms of one row take the same choice, memoised on the base id
plus the species.

**Where Sleep Talk is not inert, the row keeps Focus Energy, and the tally names each case:**

| reason kept | items | abilities | moves |
|---|---|---|---|
| substituted: Sleep Talk | 143 | 196 | 482 |
| something on the fixture names `'slp'` (a sleeping body's Sleep Talk calls a move) | 4 | 14 | 16 |
| the scenario reads Focus Energy's own crit stages (`inertEffect`, the crit-lens item rule) | 1 | – | – |
| the entity modifies the crit ratio (Super Luck, derived off `onModifyCritRatio`) | – | 2 | – |
| a Ditto cannot learn Sleep Talk | – | 2 | – |
| the row is the control click itself | – | – | 1 |

A runtime alarm counts any board that shows a sleeping body under the substitute. It read **0 in every
stage**.

**Three readers that spelled Focus Energy were repaired in the same pass. Two of them were found by the
runs, not predicted:**
- Steadfast's precondition meters "the carrier's spent PP for the idle click". It read `pp.focusenergy`,
  so under the substitute it read COULD-NOT-STAGE. It now reads whichever id was built.
- The Skill Swap swapper-slot exemption (`swapArmLeaf`) and the conferred-ability control exempted
  `pp.focusenergy` and `vol.focusenergy` only. Under the substitute, the swapper's `pp.sleeptalk` would have
  counted as evidence. That is the 39-vacuous-greens failure again. **It did happen, once, on the
  intermediate run: Super Luck read MATCH on `pp.sleeptalk` alone.** It was fixed through `INERT_IDS`.
  After the fix Super Luck read THE STAGING IS INERT, which is honest: its green had come from Focus
  Energy's +2 crit stages. Hence the crit-ratio keep rule above, after which Super Luck is MATCH again on
  Focus Energy.
- Check: across all three stages, no MATCH row rests only on control bookkeeping. The count is 0 / 0 / 2
  both before and after. The 2 are the Focus Energy and Sleep Talk move rows themselves, whose own PP
  IS the entity's evidence.

**Verdicts against `482e8f5ca701`:** items 1 of 148 changed (Greninjite, §3), abilities 0 of 200,
moves 0 of 497.

**The exit-code "inconsistency" was misattributed.** The runtime legality check sets no exit code
anywhere. `FX` in `engine/game_differential.js` only prints, and `fixtureIllegal()` has one consumer,
`tests/test-fixture-runtime-check.js`. The roster's exit is `DIFFER + DID-NOT-FIRE + failed reds`.
Items and abilities exited 1 on `482e8f5ca701` because of the two NOT CAUGHT reds, and moves exited 0
because it had none. Shown directly: the single-rule items run exited **1** with 151 illegal sets before
the re-aim, and **0** with the same 151 after it. **Decision: report-only is right.** The check
measures fixture honesty, not engine agreement. Showdown does not validate learnsets in battle, so an
illegal body still yields a valid two-engine comparison. A gate on it would turn the roster red over 168
declared residual sets that no engine change can move, and an over-firing gate is the kind that gets
ignored (#148).

## 3. THE NEW ITEMS DIFFER IS REAL — PROTEAN ON A STATUS MOVE THAT FAILS `onTry`

`Greninjite [item/mega-stone]`: SHOWDOWN has Greninja typed `dark/water`, OURS has it typed `normal`.
- Attribution: `--stage items --only greninjite` reads **MATCH with `ROSTER_INERT_FOCUSENERGY=1`** and
  **DIFFER without it**. The control click exposed it.
- The authority: `sim/battle-actions.ts:826-828` (and `:590-592` for spread moves) runs
  `singleEvent('Try')` BEFORE `runEvent('PrepareHit')`. Sleep Talk's `onTry` returns false on an awake
  body, so Protean's `onPrepareHit` (`data/abilities.ts:3487-3497`, which Champions does not override)
  never runs. Protean also returns early on `move.callsMove`, and Sleep Talk carries `callsMove: true`.
- Ours: `proteanConvert` (`engine/medicham2-browser.js:6989`) is called for a status click that reached a
  target (`:31551`) without asking whether the move's `Try` succeeded. `MEDFAILS.proteanGuardsUnmodelled`
  already counts the unasked guards. Focus Energy's first click succeeds, so it never exposed this.
- Reach beyond the fixture, **inferred and not measured**: a Protean body clicking any other status move
  whose `onTry` refuses, or any `callsMove` move. **Not fixed here.** The fix changes engine bytes and
  needs a probe first (OWED 1).

## 4. PART B — THE THREE LATTICES

**Pins.** Release `74be319d02fa` (cut 2026-09-19T03:44:42Z on HEAD `33663935`; `engine_release list`:
"0 of 27 files have moved since"). `tests/roster.js` is **not** in `SOURCES`
(`engine/engine_release.js:92`, 27 entries, checked by `require().SOURCES`), so the Part A edits needed
no new cut. Census: `data/mechanics-census.json` as committed at HEAD, 900 live / 900 probed, generated
2026-09-19T03:44:20Z, `steering.input_digest` **`322a5b4ba6b0`** in all three artifacts (the previous
run used `2a669b4c2dea`). `--team-store data/team-pool-frozen`, pools `0d103fb9fa87` / `7e7a37ded7fc` /
`a5ce76242f8d` (same as before), `--arm middle`, cap 50, `--end-state`, `--steering empirical`,
`--games` 1200 / 1350 / 1950. Mode `A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real`.
Driver code stable. **Two pins moved (release and census), so this is not a strict before/after.** The
census is `CREDITED ONLY` under empirical steering. The pools, the games played and the unchanged first
diffs show the comparison is close.

| `--games` | games | board-material | narration (undeclared) | protocol-diverged | boundaries identical | stamp |
|---|---|---|---|---|---|---|
| 1200 | 961 | **0** (was 0) | **0** (was 0) | 0 | 10705/10705 | 04:36:55Z |
| 1350 | 1069 | **5** (was 7) | **12** (was 12) | 18 (was 20) | 11828/11842 | 04:47:43Z |
| 1950 | 1497 | **12** (was 20) | **24** (was 24) | 37 (was 43) | 16650/16702 | 05:12:45Z |

Board-material is `state.games − state.games_board_never_diverged`. Narration is quarantine's NARRATION
clause. The lists behind the "left" and "joined" counts are uncapped at these sizes: 5 and 12 are under
40, and 18 and 37 are under 60.

**Prediction written before the runs, then checked:**

| lattice | predicted to leave | left |
|---|---|---|
| 1350 | Kingambit Defiant / Gooey (`…2656340617`), Kangaskhan Parental Bond Rough Skin (`…2663804834`) | **both, nothing else** |
| 1950 | Staraptor Contrary / Gooey (`…2661658477`), Palafin Mummy / Zero to Hero (`…2659857771`), Runerigus allyswitch ×2 (`…2635170965`, `…2634741388`), Kangaskhan Parental Bond (`…2653873219`), charge (`…2660663248`), Transform/Hospitality ×2 (`…2656930123` Talonflame, `…2635567733` Grimmsnarl) | **all eight, nothing else** |

**No game joined** on any lattice, board or protocol. Every remaining board-material game has a
first diff byte-identical to the one on `482e8f5ca701`. Six protocol-diverged games left at 1950
because the two allyswitch games never had a protocol divergence. None moved its split point.

Launch was a Node `spawn('cmd.exe', ['/c','tools\\lownode.cmd','engine/game_differential.js', …same
flags as latticeRerun()…, '--dump-games','400','--dump-out',…])`. The first `--dump-out` was an absolute
scratch path, which the driver joins onto the repo root. **The 1350 run therefore wrote its artifact and
then threw on the dump (exit 1).** The artifact is complete, because the dump is the last write
(`engine/game_differential.js:10070-10126`). I killed my own 1950 run by pid after 81 s and relaunched
it with a repo-relative dump path (exit 0, 1391 s). That dump was moved to scratch afterwards.

## 5. ROSTER, DAMAGE DIFF, MECHANICS, GATE

All on `74be319d02fa`, each `generated` stamp moved:

| artifact | stamp | reading |
|---|---|---|
| `data/roster.items.json` | 04:42:57Z | 147 MATCH, **1 DIFFER** (Greninjite), 0 DID-NOT-FIRE, 0 CNS, reds 22/22 |
| `data/roster.abilities.json` | 04:46:28Z | 194 MATCH, 6 deferred, 0 DIFFER, 0 CNS, reds 63/63 |
| `data/roster.moves.json` | 04:47:46Z | 494 MATCH, 3 deferred, 0 DIFFER, 0 CNS, reds 37/37 |
| `data/engine-diff.json` | 04:58:41Z | 0 of 6000 at the midpoint, top, bottom and idx01–idx14; ACCURACY-MODIFIER CONFORMANCE disagree 0 |
| `data/all-mechanics-fire.json` | 05:01:43Z | 4702 games, 0 threw; moves STATE 2 (axekick, clearsmog), the clause reads 2 diverge / 1 declared / 1 below shelf / 0 left |

Roster stages ran three times. Run 1 predates the `INERT_IDS` reader fix and run 2 predates the
crit-ratio keep. **Only run 3's artifacts are on disk and quoted.** The earlier logs are in scratch.

`node engine/quarantine.js` (through `tools\lownode.cmd`, exit 0): **`GATE: CLOSED — 2 of 8 GATING clauses
fail`**. The FAILs are board-material (0 / 5 / 12) and roster/items (1 DIFFER). Every other gating clause
passes: damage, roster abilities and moves, coverage (412 of 412), mechanics, and no-open-defect.
Narration RPRT 0 / 12 / 24.

## 6. FILES CHANGED

- `tests/roster.js`: the two plants; the derived legal control click (`INERT_SUBS`, `inertChoice`,
  `withLegalInert` in `play()`, `INERT_IDS` for the three readers, the per-stage `THE CONTROL CLICK` tally,
  the sleep alarm, the selftest proving both clicks, the legal pricing filler in `builtStats`); the crit-lens
  scenario's `inertEffect`.
- Data (written by the runs): `data/game-differential{,.g1350,.g1950}.json`, `data/roster.{items,abilities,moves}{,.prev}.json`,
  `data/roster.json`, `data/engine-diff.json`, `data/all-mechanics-fire.json`, plus whatever `status.js --write` restamps.
- Docs: `CHANGELOG.md` (6.50.1, and **6.51.0 where the brief said 6.50.2**: the re-measure supersedes published figures, and the docs gate clause 5d refuses that under a PATCH bump), `docs/RUNNING-NOTES.md` (two rows), `docs/ENGINE.md` (one section),
  `docs/ABRA-whitepaper.md` (the roster sentence in the MEDICHAM validation paragraph: items `differ` is now
  1), and this report.
- Not touched: the held 7.0.0 documents and `docs/_reports/2026-09-11-*`. No git command. Nothing deleted
  that I did not create. Every process I killed was my own and was killed by pid: the 1950 lattice
  (cmd 13508 and its node 9232), and one launcher (2772).

## OWED, NOT RUN

1. **Protean on a failed `Try` (ENGINE).** Write the probe first. Take a Protean body and click Sleep Talk
   while awake: measured, Showdown keeps the type and ours converts. Then click Fake Out on its second
   active turn: **not measured**, and it goes through the attack-path call (`:37269`), not the
   status-path call. Then make `proteanConvert` respect the move's `Try` result and the `callsMove`
   guard. Cut a release and re-run the items stage (Greninjite should go MATCH), the damage diff, AMF
   and the three lattices. Before the run, say which scoreboard should move. Whether any pinned-pool
   game has a Protean body clicking a failing-`Try` move is unmeasured.
2. **The 12 remaining board-material games at 1950 and the 5 at 1350** are the 17 singletons listed in
   `docs/_reports/2026-09-18-merged-remeasure.md` §2, unchanged.
3. **Residual illegal fixture sets** (17 / 94 / 57). "can't learn Focus Energy" is 13 / 49 / 29, all rows
   kept by name (sleep-naming fixtures, crit readers, Ditto, the control-click row). The rest are
   delivery moves (#318). The sleep test is deliberately over-wide (Insomnia matches), so narrowing it
   to setters only would recover some of those rows.
4. `INERT_ALT` (Magnet Rise) is still illegal on most bodies of the one row it serves. That is the same
   class of problem.
5. **Not claimed:** a census-pinned before/after. It would need a run of `482e8f5ca701` under census
   `322a5b4ba6b0`.
