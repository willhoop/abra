# Three instrument debts — 2026-09-19, ENGINE

Worktree `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a6f425d58838fc6bf`, branch `main`,
at `dec05b65` (content-identical to the briefed `eb80e54a`; the two differ only in the ingest commits
that landed after the worktree was cut).

**Pin.** Every measurement below was taken against engine release **`18773c22878f`**, cut in this
worktree (`engine_release.js cut` reported *"THIS TREE WAS ALREADY FROZEN — this is cut 2 of the same
bytes, appended, nothing overwritten"*, so the id is the same one HEAD already points at).
`data/engine-release.json` and the two `data/releases/18773c22878f/` files were restored afterwards
(`git checkout --`), so the tree carries no release churn.

**No engine byte changed.** `engine/medicham2-browser.js` is untouched, so the census cannot have
moved and was not regenerated: **970 rows, 970 live, 0 missing**, generated `2026-09-19T20:41:52.493Z`
— the same artifact the pass started with.

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` throughout. Light mode: probes,
single-row roster runs and staged boards only. No battery, no lattice, no `quarantine.js`.

---

## 1. `tests/staged_board.js --reds` — 14 of 25 breaks demonstrated → 25 of 25

### What was actually wrong

Eleven of the twenty-five deliberate breaks had anchors that matched **zero** times, so
`patchedSource()` refused them and the file printed `BROKEN ENGINE -> PATCH NOT APPLIED` eleven times.
Measured before anything was changed (`--release 18773c22878f`):

```
FAIL  fakeout-flinch                    FAIL  pivot-then-the-slot-is-hit
FAIL  stealthrock-entry                 FAIL  allyswitch-follows-the-slot
FAIL  nuzzle-paralysis                  FAIL  hungerswitch-flips-every-turn
FAIL  focussash-survives                FAIL  fling-spends-the-users-item
FAIL  disguise-forme                    FAIL  roar-drags-whoever-is-standing-there
FAIL  sandstorm-residual-order
11 of 25 anchors do not apply
```

**One of the eleven was `fakeout-flinch`, and that is the expensive half.** `allowProof()` uses that
scenario's break as its fixture, so with the plant unapplied **all three declared-divergence machinery
checks were dead** and every run of the file printed *"THE QUIETENING MECHANISM IS NOT TRUSTWORTHY"*.
Nothing ran the file, so nothing said so.

### The re-aims

Preferring what the code reads or builds over a line in a body, as briefed:

| scenario | old anchor (0 matches) | re-aimed at |
|---|---|---|
| `fakeout-flinch` | `if(m._flinch){m._flinch=false;m._mvRes=false;` (spans a line break) | the guard `if(m._flinch){` |
| `stealthrock-entry` | `if(sf.hz.stealthrock){nx.curHP-=` | the LIST the entry walk runs: `const _hzSrc=['stealthrock',…]` |
| `nuzzle-paralysis` | `function applyStatus(t,st,src){` | the signature today: `function applyStatus(t,st,src,eff,why,dstream){` |
| `focussash-survives` | one combined `survivesFromFull` read | the ITEM half's tag read, `const _svIt=TAGS.param('item',tg.item,'survivesFromFull');` |
| `disguise-forme` | `if(_fh&&_fh.becomes&&!tg._disguiseBusted&&dmg>0){` | the signature `function formeOnHitAbsorbs(tg,att,mvId){` |
| `pivot-then-the-slot-is-hit` | `let _t=reaimToSlot(a.target,…)` | the dispatch re-aim **and** `let _t0=reaimToSlot(aTarget,…)` in `statusMoveTargets` |
| `allyswitch-follows-the-slot` | `const now=foes[it.tgtSlot]||null;` | `let now=foes[it.tgtSlot]||null;` (the `const` became `let`) |
| `hungerswitch-flips-every-turn` | inline `formeCycleResidual` tag read | the signature `function formeCycleResidualStep(m){` |
| `fling-spends-the-users-item` | `{const _it=m.item;m.item='';` | the update-pass spend (`ROADMAP #308` moved it) |
| `roar-drags-whoever-is-standing-there` | `const _t=reaimToSlot(a.target,…)` | the dispatch re-aim **and** `bounceAtTryHit(m,reaimToSlot(…),a.mv)` |
| `sandstorm-residual-order` | the chip gate before `_G.has('weather')` was added | the gate as it reads today |

### Two re-aims were wrong first, and the harness caught both

This is worth recording because it is the failure mode the brief warned about — a plant that applies
cleanly and proves nothing.

1. **Flinch.** Dropping `m._mvRes=false;if(TR)TR.cant(m,'flinch');` planted, and the boards stayed
   **IDENTICAL** → `NOT CAUGHT`. `_mvRes` is bookkeeping; what actually stops the body acting is the
   `continue` at the foot of the block. Re-aimed at the guard, it now moves `party.hp, hp, pp.bodyslam`.
2. **Both slot scenarios.** The branch-level `reaimToSlot` call alone left the boards IDENTICAL. The
   rule was consolidated into **one** call at the action dispatch —
   `const _aimed=reaimToSlot(it.a.target,…); if(_aimed!==it.a.target){ it.a.target=_aimed; }`, whose own
   comment says *"thirty branches read the field"* and *"every one of the thirteen existing calls stays
   and is now IDEMPOTENT"*. So the Pokemon-first model is restored only when the dispatch write goes
   too. Both scenarios now carry a two-part patch and differ in which BRANCH loses its copy.
   Roar now parts on `species, hp, maxhp, types, ability, pp.irondefense, pp.uturn, pp.roar`; the pivot
   on `party.boosts.atk, party.boosts.def, boosts.atk, boosts.def`.

### The August stale-cache claim does not reproduce

The file's own comment filed a second defect: that correcting the flinch anchor would turn a loud
printed FAIL into *"24 silent false divergences"*, because a patched module survives into the clean
arms. **Measured on `18773c22878f` with all 25 plants applying: the clean arms are 25 of 25
board-identical.** The comment is rewritten to record the August reading and the 2026-09-19
re-measurement rather than deleted.

### Result

```
SUMMARY
  clean and board-identical: 25 of 25
  breaks caught and localised: 25 of 25
  fixture check (buildPair, callers under tests/): 71 distinct set(s) checked, 9 illegal — 0 NOT baselined
exit 0, 22s
```

and the three machinery checks, dead since 2026-08-19, now read:

```
  THE DECLARED-DIVERGENCE MACHINERY, both directions, before any scenario uses it:
    ok   a TRUE divergence, declared, is quietened
    ok   a declaration matching NOTHING is STALE-ALLOW, not a pass
    ok   a declaration aimed at another field does NOT swallow this one
```

### Off the pending list

- `tests/staged_board.js` added to `GATES` in `tests/run-all.js`, with `EXTRA['tests/staged_board.js'] = ['--reds']`.
  The argument is load-bearing: bare, the file plays only the clean arm, and a comparator that had
  stopped catching anything would print 25 of 25 and exit 0.
- Its `PENDING_WIRE` entry was **removed**, not edited — the blocker it named ("RED on ONE of 25
  scenarios … `roar-drags-whoever-is-standing-there`") has stopped describing anything, and a stale
  exemption is what `staleExemption` refuses.
- Through the runner: `ok tests/staged_board.js (16.8s)` alone, `62.3s` on a contended machine.
  `run-all --coverage` is unchanged at **29 unaccounted**; PENDING-WIRE 46 → 47 (−`staged_board`,
  +`probe_roster_inert_legality`); no STALE EXEMPTION line.
- The `PENDING_WIRE` entries for `probe_mid_cat_reload.js` and `probe_selfdrop_address.js` still name
  "it loads tests/staged_board.js" as their blocker. That is still true of those two files and was left
  alone.

---

## 2. Roster illegal fixtures — 73 → 58 control-click bodies

### The instrument

`tests/probe_roster_inert_legality.js` (new). It asks the BUILDER rather than a stage run: `assign(kind)`
for the stage, `withLegalInert(scenario)` for the control-click substitution, then
`engine/fixture_legality.js` `checkSet` — the same function `buildPair` and the static sweep use, so the
three cannot disagree about what is legal. `tests/roster.js` gained four exports for it
(`withLegalInert`, `inertChoice`, `INERT`, `INERT_SUBS`, `INERT_ALT_CANDS`); nothing else reads them.

**This is not the same number as the brief's 17 / 94 / 57.** Those come from `buildPair`'s live check
during a full stage run, which also builds the CONTROL arm of every row and the spine fixtures. The
probe counts the SUBJECT scenario's distinct bodies only. Before/after are both taken with the probe, so
they are comparable with each other and not with the live figure.

### Before

```
  ITEMS      232 distinct set(s), 14 illegal, 11 of them a CONTROL CLICK the species cannot learn
  ABILITIES  331 distinct set(s), 48 illegal, 36 …
  MOVES      557 distinct set(s), 51 illegal, 26 …
  TOTAL     1120 distinct set(s), 113 illegal, 73 …
```

and the reason each one was NOT substituted:

```
  63  KEPT: something on this fixture names sleep, and a sleeping body's Sleep Talk calls a move
   7  KEPT: ditto cannot learn Sleep Talk
   3  KEPT: the scenario reads Focus Energy's own effect / the entity modifies the crit ratio
```

### The derivation

`INERT_SUBS` holds exactly one member, Sleep Talk, and the clause that refused it was declared
over-wide: *"a scenario in which anything … so much as names `'slp'` … keeps Focus Energy"*. What the
substitute's rule actually reads, off the format rather than remembered:

```
sleeptalk.onTry(source) { return source.status === "slp" || source.hasAbility("comatose"); }
```

The Comatose half already has its own clause (`INERT_SUB_BLOCKS`, derived from that same handler). The
other half asks one question: **can anything here WRITE `slp` onto a body?** So a handler now counts
only when it names the status AND makes a status-writing call (`.setStatus(` / `.trySetStatus(`).

**Printed over every legal entity before it was wired:**

| | kept | dropped |
|---|---|---|
| moves | Dire Claw, Hypnosis, Rest, Sing, Sleep Powder, Spore, Yawn | Electric Terrain, Facade, Sleep Talk, Snore, Uproar, Worry Seed |
| abilities | Effect Spore, Synchronize | Bad Dreams, Insomnia, Sweet Veil, Vital Spirit |
| items | — | Chesto Berry |

Every dropped one prevents, cures, reads or requires sleep. **Dire Claw is why the test is not a literal
`setStatus('slp')`**: its secondary does `const status = this.sample(["psn","par","slp"]);` then
`target.trySetStatus(status, source)`, so the argument is a variable and a literal match would have
dropped a move that really does sleep a body. **Synchronize is kept and cannot actually sleep anything**
(`if (status.id === "slp" || status.id === "frz") return;`); the remaining over-width is left in rather
than special-cased, because a name-level exception is the list this file refuses.

`ROSTER_INERT_SLEEP_WIDE=1` restores the name-level gate.

### After

```
  ITEMS      232 distinct set(s), 14 illegal, 11 of them a CONTROL CLICK the species cannot learn
  ABILITIES  331 distinct set(s), 42 illegal, 30 …
  MOVES      556 distinct set(s), 42 illegal, 17 …
  TOTAL     1119 distinct set(s), 98 illegal, 58 …
```

### No roster verdict moved

Exactly **ten rows** changed their control click (diffed across the knob over all 844 built rows):

```
ability  mimicry          ability/type-follows-the-terrain     -> sleeptalk
ability  regenerator      ability/switch-out                   -> sleeptalk
ability  surgesurfer      ability/conditional-speed            -> sleeptalk
move     electricterrain  move/terrain-setter                  -> sleeptalk
move     expandingforce   move/needs-the-terrain-it-names      -> sleeptalk
move     facade           move/plain-attack                    -> sleeptalk
move     snore            move/plain-attack                    -> sleeptalk
move     steelroller      move/needs-the-terrain-it-names      -> sleeptalk
move     terrainpulse     move/needs-the-terrain-it-names      -> sleeptalk
move     sleeptalk        move/generic-status                  -> (unchanged; its KEPT reason text changed)
```

seven rules: `ability/{type-follows-the-terrain,switch-out,conditional-speed}`,
`move/{terrain-setter,needs-the-terrain-it-names,plain-attack,generic-status}`.

**None of the ten fixtures can produce a sleeping body** — checked directly: no seeded `status`
anywhere in the scenario object, and no sleep-writing move on any body. They were blocked by Electric
Terrain (which PREVENTS sleep), Facade, Snore and Sleep Talk itself.

Single-row runs, both knob positions, `--stage <s> --only <id> --release 18773c22878f`, comparing the
whole `SUMMARY … IN SCOPE` block:

```
mimicry          exit 0->0  VERDICT UNMOVED   illegal before[14] after[9]
regenerator      exit 0->0  VERDICT UNMOVED   illegal before[15] after[10]
surgesurfer      exit 0->0  VERDICT UNMOVED   illegal before[14] after[9]
electricterrain  exit 0->0  VERDICT UNMOVED   illegal before[5]  after[1]
expandingforce   exit 0->0  VERDICT UNMOVED   illegal before[6]  after[1]
facade           exit 0->0  VERDICT UNMOVED   illegal before[6]  after[1]
snore            exit 0->0  VERDICT UNMOVED   illegal before[6]  after[1]
steelroller      exit 0->0  VERDICT UNMOVED   illegal before[6]  after[1]
terrainpulse     exit 0->0  VERDICT UNMOVED   illegal before[6]  after[1]
sleeptalk        exit 0->0  VERDICT UNMOVED   illegal before[6]  after[6]
```

(`illegal` is `buildPair`'s own live fixture-check count for that run.) No `--write`, so no roster
artifact was touched.

### Why the residue cannot be closed with another move

The format offers exactly **three** moves passing `inertShapeComplaint`: Focus Energy, Sleep Talk and
Magnet Rise (the roster's own `--rules` prints the full candidate list, with a REFUSED reason on every
other one). A click names ONE move id and the body in a slot changes across a switch, so every holder
must learn the substitute.

**Measured: of the 41 scenarios that still have a holder who cannot learn Focus Energy, the number where
every holder learns Magnet Rise is ZERO.** Magnet Rise is learned by even fewer species than Focus
Energy, and its volatile grants a Ground immunity that a general fixture cannot prove shut. So the
remaining 58 are: fixtures that really can sleep a body (Yawn, Dire Claw, Sleep Powder, Hypnosis, Sing,
Rest, Effect Spore on the board), seven Ditto rows that cannot learn Sleep Talk, and three rows whose
entity reads the crit ratio Focus Energy raises.

`probe_roster_inert_legality.js --strict` exits 1 on those 58. It is registered in `PENDING_WIRE` with
that blocker stated in full, rather than wired without `--strict` — which would register a gate that can
only exit 0.

---

## 3. `needsUntrackedState` and `readsOwnItem` — descriptive, declared, guarded

### The carriers, and what already reads them

```
needsUntrackedState (move)  ragefist, electroball, gyroball, lastrespects
readsOwnItem        (move)  acrobatics
```

Every one of the five computes its power correctly today, through a **different tag on the same row**
that the damage engine does read:

| carrier | behaviour tag | read at |
|---|---|---|
| `ragefist` | `variablePower {kind: userTimesHit, base 50, per 50, cap 350}` | `medicham2-browser.js` `_vp.kind==='userTimesHit'` |
| `gyroball` | `variablePower {kind: speedRatioLinear, invert, mult 25, plus 1, cap 150}` | `_vp.kind==='speedRatioLinear'` |
| `electroball` | `variablePower {kind: speedRatioTable, table, clampAt 4}` | `_vp.kind==='speedRatioTable'` |
| `lastrespects` | `powerFromFallen {base 50, perFallen 50, counts live}` | `TAGS.param('move',mv.id,'powerFromFallen')` |
| `acrobatics` | `variablePower {kind: userNoItem, mult 2}` | `_vp.kind==='userNoItem'` |

And both tags already carry a **LIVE, non-hollow census row** measuring exactly that against the
authority:

```
move/needsUntrackedState  "Gyro Ball scales with the speed gap"
    same Archaludon, only its Speed moves — 30 Spe deals 81, 150 Spe deals 18
move/readsOwnItem         "Acrobatics doubles when the user holds nothing"
    holding Leftovers 15, holding nothing 29 (the tag says x2)
```

What the two tags themselves say is what STATE a power depends on — written for `engine/board.js`,
whose own note is *"dex basePower is 0, so board.js returns null and scores them as non-damaging"*.
That is a statement about a consumer, not an instruction to one. Giving either tag its own engine line
would be the x2 implemented twice, which is the breach CLAUDE.md names.

### The declaration

`engine/tag_descriptive.js` (new) — one declaration, two readers:

- `engine/tag_dex.js` requires it and stamps `descriptive` onto the tag's generated row;
- `engine/coverage.js` requires it directly, so the count is right **before** any regeneration.

`coverage.js` counts such a row as read and **prints** it with its `via` tag on every run:

```
  tags with an engine consumer            301
    0 in-scope tags have a carried row that no engine line reads … 2 row(s) are DECLARED DESCRIPTIVE
    and are NOT counted as unread — they name a dependency and the behaviour is carried by another tag
    on the same row, which IS read: needsUntrackedState (move) — behaviour via
    variablePower/powerFromFallen, readsOwnItem (move) — behaviour via variablePower. Declared in
    engine/tag_descriptive.js, guarded by tests/probe_descriptive_tags.js
```

(from 299 of 301.) `consumedBy` is untouched and still reports NOT READ, which is true.

### The guard

`tests/probe_descriptive_tags.js` (new, registered in `run-all`'s `GATES`, ~1s, no game, no release).
For every **in-scope** carrier (scope from `engine/legal_scope.js`; a failure to derive is exit 2
CANNOT-ANSWER, never a fallback): the carrier must also carry a declared `via` tag; every `via` tag
actually used must have a non-empty `consumedBy`; and the descriptive tag AND every used `via` tag must
have a LIVE, non-hollow census row.

```
green : 5 in-scope carrier(s) over 2 descriptive tag(s); 0 failing clause(s) — exit 0
red   : TAG_DESCRIPTIVE_BREAK=needsUntrackedState → 4 failing clauses, named by carrier — exit 1
```

It deliberately plays no game: clause C's census rows ARE the measurement against Showdown, and
re-staging them here would be a second instrument answering a question the census already answers.

---

## Files changed

```
M  docs/ENGINE.md
M  engine/coverage.js
M  engine/tag_dex.js
M  tests/roster.js
M  tests/run-all.js
M  tests/staged_board.js
?? engine/tag_descriptive.js
?? tests/probe_descriptive_tags.js
?? tests/probe_roster_inert_legality.js
```

`data/engine-release.json`, `data/releases/18773c22878f/{cuts.jsonl,release.json}` and
`data/provenance-stamp.json` were all touched by tools during the pass and **restored** with
`git checkout --`. `data/tags.json` and `data/abra-tags.js` were regenerated once to measure the drift
(below) and restored from a byte copy. No commit, no push.

---

## PROPOSED NOTES ROW

```
### 2026-09-19 — three instrument debts closed; no engine byte changed

**What changed.** `tests/staged_board.js --reds` had **11 of 25 deliberate breaks matching ZERO
times**, including `fakeout-flinch`, which is `allowProof()`'s own fixture — so the file's three
declared-divergence machinery checks were dead as well, and nothing ran the file to say so. All eleven
re-aimed at what the code reads or builds today (function signatures, a built list, a tag read), and the
file is now a `tests/run-all.js` gate with `--reds`. The roster's control-click substitution was
narrowed from "anything names `slp`" to what Sleep Talk's own `onTry` reads. Two move tags with no
engine reader were declared descriptive, printed by `coverage.js` and guarded by a new probe.

**Figures.** `staged_board --reds` on release `18773c22878f`: **25 of 25 clean and board-identical,
25 of 25 breaks caught and localised** (was 25 clean, **14** caught, 11 PATCH NOT APPLIED), exit 0, 22s
— artifact: the run's own stdout, `docs/_reports/2026-09-19-instrument-debts.md` §1. Roster fixture
bodies carrying a control click their species cannot learn: **73 → 58** (items 11, abilities 36 → 30,
moves 26 → 17) — artifact: `tests/probe_roster_inert_legality.js`, §2. `engine/coverage.js` "tags with
an engine consumer": **299 of 301 → 301 of 301**, with the two rows printed as DECLARED DESCRIPTIVE —
artifact: `engine/coverage.js` run output, §3. Census **unmoved at 970 live / 0 missing**; no engine
byte changed.

**Supersedes.** The `docs/ENGINE.md` hand-list item *"`tests/staged_board.js --reds` has 11 dead
anchors … 11 of 25 breaks are not demonstrated"* (struck in place). The `tests/run-all.js`
`PENDING_WIRE` entry claiming `staged_board` is *"RED on ONE of 25 scenarios"* — it is green on all 25.
The `tests/staged_board.js` source comment predicting that a corrected flinch anchor would produce
*"24 silent false divergences"* — re-measured and it does not reproduce.

**Basis.** unchanged — the same instruments answer the same questions; they now answer them where they
previously could not answer at all.

**Owed.** `data/tags.json` is **804 entities** out of date with respect to its own generator (measured
and reverted this pass; `consumedBy` moved on no row). 58 roster fixture bodies still carry an
unlearnable control click, and `probe_roster_inert_legality.js --strict` is red on them.
```

---

## OWED, NOT RUN

- **The full `tests/run-all.js` battery.** Light mode. `staged_board.js` and
  `probe_descriptive_tags.js` were each run through the runner with `--only` (both `ok`), and
  `--coverage` was run in full (29 unaccounted, unchanged; no stale exemption). The suite itself is owed
  by whoever merges this — `staged_board` is a new gate and adds ~20–60s to it.
- **`engine/quarantine.js`, the lattices, the whole-game differential, the roster stage runs.** None
  was run and none should have been: no engine byte changed, so nothing downstream is invalidated, but
  nothing here re-confirms them either.
- **`node engine/status.js --write`.** Forbidden by the brief; the generated blocks in `docs/ENGINE.md`
  are untouched and are owed a restamp at merge.
- **`data/tags.json` is 804 entities stale.** Regenerating it with `engine/tag_dex.js` was measured
  here and **reverted**: `consumedBy` changed on no row, but 804 move/item/ability entries differ from
  what the current derivation produces. tags.json steers the census and the roster, so this is its own
  pass with its own before/after — it must not ride along with an instrument change. Until it is run,
  the `descriptive` field `tag_dex` now stamps does **not** appear in `data/tags.json`; `coverage.js`
  reads the declaration module directly, which is why the count is already right.
- **`data/abra-tags.js`** would need `build/build_tags_js.js` re-run in the same pass as any tags.json
  regeneration. Not done.
- **The live 17 / 94 / 57 figure the brief quotes was not re-measured.** That is `buildPair`'s count
  across a full stage run including the control arm; re-taking it needs three stage runs, which light
  mode excludes. The before/after in §2 is the builder-side count and is internally comparable.
- **The 58 remaining illegal control-click bodies.** Derived, itemised and shown not to be closable
  with another inert move in this format. Closing them means changing which BODIES the roster's rules
  pick (the repeated fillers — Milotic, Clefable, Corviknight, Goodra-Hisui, Torterra — are most of the
  count), which is a rules pass, not an instrument one.
- **`tests/probe_selfdrop_address.js` still has no `VERIFIED BY` marker.** Noted in its `PENDING_WIRE`
  entry as owed; untouched here.
- **Debris, reported and left in place** (per the file-deletion rule): nothing was deleted. The
  scratchpad folder `…/scratchpad/instrument-debts/` holds the measuring scripts and the before/after
  run logs for everything above.
