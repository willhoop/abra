# Pre-6.0.0 code review — 2026-09-09

Read-only. Nothing was fixed. Every figure below was measured on this tree today (HEAD `d6789951` at
the time of reading; the tree moved during the review, see §0). No game was played. Commands that
were NOT run are listed under **OWED, NOT RUN** at the end.

Severity vocabulary: **BLOCKS 6.0.0** — the 6.0.0 claim ("the simulator is correct against the
authority") would be false or unverifiable with this in place. **SHOULD FIX BEFORE** — the claim
survives, but a class this project has already paid for is open and cheap to close. **DEFER** — real,
not load-bearing for the major.

Counts: **BLOCKS 4 · SHOULD FIX BEFORE 15 · DEFER 7.**

---

## 0. What was read and what was run

- CLAUDE.md, docs/LESSONS.md, `.claude/skills/start/SKILL.md` §7, `.githooks/pre-commit`,
  `.githooks/commit-msg`, `tests/run-all.js`, `engine/engine_release.js` SOURCES, the simulator's
  structure by grep, `engine/tags.js`, `engine/pp.js`, `engine/board.js` (accuracy, speed, data
  loader), `engine/set_priors.js`, `engine/quality.js`, `engine/champions_sim.js`,
  `engine/register_reality.js` (exit classification), `engine/where.js`, `engine/quarantine.js`
  (closed-row detector, declared kinds), `engine/game_differential.js` (PRNG patching, --write).
- Run (all fast, none plays a game): `node tests/test-no-silent-failure.js`,
  `cmd /c tools\lownode.cmd tests\test-lownode.js`, `node engine/artifact_audit.js`,
  `node engine/orient.js`, `node engine/where.js --gates`, `--artifacts`,
  `cmd /c tools\lownode.cmd engine\gate_fail_and_silent.js`,
  `cmd /c tools\lownode.cmd engine\side_selection_census.js`, plus scratch scripts (knob census,
  require graph, CRLF census, test-shape census, `MC.mons` vs `Dex.forFormat`).
- Authority: `C:\Users\willj\Projects\Pokemon\pokemon-showdown` at `20ad99ffc9a5…`, which equals
  `PINNED_COMMIT` in `engine/champions_sim.js:85`. `sim/prng.ts:132-156` read for §5.
- Not read: `docs/HANDOFF-*.md`. `docs/_reports/*` treated as history only.

**The tree moved under this review.** `git status` at start showed HEAD `bf4ff432`; `git worktree
list` mid-review showed `d6789951`. Everything below was read from files, not from a snapshot, so a
line number can be off by a commit. Re-check line numbers before editing.

---

## 1. SILENT SUCCESS — a capability absent, everything reports success

### 1.1  BLOCKS — `tests/run-all.js:773-777` reads exit 2 as SKIP and the suite exits 0 with skips

```
else if (r.status === 2) { … skip.push([rel, why]); console.log(`  SKIP …`); }
…
process.exit(fail.length || coverageFailures ? 1 : 0);     // :819 — skips do not count
```

44 of 144 discovered `tests/test-*.js` have an `exit(2)` path. Most are "SHOWDOWN_PATH unset", which
is the intended use. **These are not:**

| test | exit(2) fires when | reads to run-all as |
|---|---|---|
| `tests/test-encore-fail-silent.js:266` | `illegal fixture(s)` | SKIP |
| `tests/test-multihit-damage-game.js:230, 298` | mislabelled fixture / `globalThis.MEDSEEN is absent` | SKIP |
| `tests/test-sleep-duration.js`, `tests/test-resolution-order.js` (same shape) | illegal fixture, `MEDSEEN` absent, arm not found | SKIP |
| `tests/test-damage-roll-support.js`, `tests/test-multihit-roll.js` | `the fixture could not be staged` | SKIP |
| `tests/test-set-realism.js:104` | `data/games.bo3.jsonl is absent` | SKIP |
| `tests/test-encore-fail-silent.js:353`+ | MEDSEEN missing | SKIP |

Every one of those prints *"This is not a pass."* and then produces a green suite. A fixture that
cannot be staged is the exact `COULD-NOT-STAGE` shape (memory: *a COULD-NOT-STAGE verdict is a claim
about the fixture, never about the mechanic*), and the runner launders it into a skip. The failure it
produces: a mechanic whose test can no longer stage — because the dex moved, because a counter was
renamed — stops being tested and nothing turns red.

**The exit-code vocabulary is decided in two files (ROADMAP #380 is still live).**
`engine/register_reality.js:489-518` reads exit 2 as `UNDECLARED` (neither red nor green) unless the
child prints `ABRA-EXIT 2 CANNOT-ANSWER`; `tests/run-all.js` reads it as SKIP unconditionally.
`engine/wire_ladder.js:269-407` exits **4** on refusal, which register_reality reads as UNDECLARED and
run-all reads as FAIL. Three readers, three meanings, one integer.

Fix shape: run-all counts a skip as a failure unless the child printed the `ABRA-EXIT 2
CANNOT-ANSWER` declaration register_reality already understands, and the reason is an environment
one (no simulator, no python). One classifier, imported by both.

### 1.2  BLOCKS — the roster gate passes with 60 entities never compared

`data/roster.abilities.json` (generated 2026-09-09T11:55Z, release `b730e44f3314`): **139 of 202**
`FIRED-AND-BOARDS-MATCH`, **44 `COULD-NOT-STAGE`**, **14 `CONTROL-NOT-QUIET`**, 5 deferred by owner.
`roster.moves.json`: 10 COULD-NOT-STAGE of 500. `roster.items.json`: 6 of 148.

CLAUDE.md's gate condition is *"no `FIRED-AND-BOARDS-DIFFER` and no `DID-NOT-FIRE`"*. COULD-NOT-STAGE
and CONTROL-NOT-QUIET are neither, so the clause is satisfied while **29% of the format's abilities
have never been compared to the authority** (34 of the 44 carry the reason *"THE STAGING IS INERT.
Showdown's own board is identical with and without…"* — i.e. the fixture cannot show the effect, which
LESSONS §5 says proves nothing about the mechanic). A 6.0.0 declaration on this artifact is a claim
about 139 abilities wearing the name of 202.

Fix shape: either the gate counts COULD-NOT-STAGE toward the bar with a per-row owner ruling
(`DEFERRED-BY-OWNER` already exists for exactly this), or the 6.0.0 text states the compared set.
Not both silently.

### 1.3  BLOCKS — a registered GATE is red today, its register row is CLOSED, and a second red ratchet has no runner

- `engine/gate_fail_and_silent.js` — in run-all's `GATES` (`tests/run-all.js:175`). **Exit 1 today**:
  `LIVE 1 cause(s) over 1 game(s) — event missing from medicham2 :: |-fail|p2a <> |move|p2b|rockslide`.
  `node engine/where.js --gates` lists it under **#241 (closed)**. A closed row whose regression gate is
  red is the "known failure" state CLAUDE.md bans.
- `engine/side_selection_census.js` — **exit 1: `undeclared: 88   ratchet 78   >> ROSE`**. It is in
  `PENDING_WIRE` (`tests/run-all.js:542`), so nothing runs it; the ratchet rose by ten with no
  consequence. Its keys are anchor strings that drift when unrelated code moves (its own output says
  *"RE-DECLARED UNDER A DRIFTED ANCHOR"* for several rows, and four declarations were destroyed by a
  `git checkout --` — LESSONS §11 again).
- `data/register-reality.json` (2026-09-08): 118 green, **4 VERDICT-RED** (`gate_fail_and_silent.js`,
  `quarantine.js --order-probe` ×2, `tests/test-quality.js`), 1 UNDECLARED (`wire_ladder.js`).

A major cut over these is the fourteenth handoff: the number is printed with a caption.

### 1.4  BLOCKS — the release the 6.0.0 artifacts stamp is not in the repository

Every headline artifact — `data/game-differential.json`, `data/all-mechanics-fire.json`,
`data/roster.{moves,items,abilities}.json` — stamps `engine_release: b730e44f3314`. That directory is
**untracked** (`.gitignore:174 data/releases/`; **26 of 636** release directories are tracked). The
ignore rule's own text (`.gitignore:167-173`) says *"When a NEW release becomes evidence for a published
number, add it deliberately: `git add -f data/releases/<id>`"*. It has not been. CLAUDE.md: *"a
stamped release is the first thing in this repo that can be VERIFIED rather than assumed"* — only if
the bytes are in the repo. After a clone, or after this disk, the 6.0.0 evidence chain ends at a
twelve-character id.

### 1.5  SHOULD FIX — the authority pin is a label, not a receipt

`engine/champions_sim.js:231-262` computes `actual_commit` and `commit_matches` (null when git is
unavailable — correctly). **Nothing reads `commit_matches`** (grep: zero consumers outside the file).
`engine/mew.js:589-593` and `engine/validate_selfplay.js:392-394` print `v.pinned_commit` — the typed
literal — as *"engine 20ad99ffc9a5"*, whatever is checked out. Today they agree (measured). Move
`../pokemon-showdown` one commit and every differential silently measures a different authority while
printing the pinned id. There is also no check that `dist/` was rebuilt from the checked-out `sim/`
and `data/mods/champions/` sources, so an edited `.ts` with a stale `dist/` is invisible.

### 1.6  SHOULD FIX — a frozen release still reads the live stores

`engine/engine_release.js` SOURCES = 27 files (CLAUDE.md says twenty-five; the prose is stale a fourth
time, as it predicted). `data/rollout-switch-census.json` is now in it (#530 closed). What is still
read at play time and NOT frozen:

| read | by | reached from | in SOURCES? |
|---|---|---|---|
| `data/games.bo3.jsonl`, `data/games.ots.jsonl` | `engine/set_priors.js:286-296 observedSets()` | `champions_sim.js:304 packTeam → fillSet` whenever a set has a gap | **no** |
| `data/store-validation.json` | `engine/quality.js:18,192` | `set_priors.js:292 Q.loadGames` | **no** |
| `data/smogon-priors.json`, `data/move-priors.json` | `board.js:1634,2474,2491 loadData` | rollouts | yes |

`games.bo3.jsonl` is appended by OPS hourly. A `--release`-pinned measurement whose pool has an
unfilled slot draws from a moving store — the 995-vs-982 class, through a door the pool pin does not
cover. `--team-store data/team-pool-frozen` pins the POOL, not the SET FILLER.

### 1.7  SHOULD FIX — the browser and node forks part silently

- `engine/medicham2-browser.js:15359-15375` `LATCH_FIELDS_WRITTEN` reads its own source via
  `require('fs')` under `typeof require==='function'`. In the browser that test is false, the set is
  empty, and **the counter `MEDFAILS.latchSourceUnreadable` is never set** because the `catch` only
  fires on a failed read. The site's engine "refuses nothing" and says so nowhere. Same class as
  `engine/tags.js:56`.
- `engine/artifact_audit.js` check G: **5 bundles have a builder and NO `--check`** —
  `data/board-data.js` (read by `board.js:1600-1620 BROWSER_DATA()` in place of the two priors
  files), `abra-meta.js`, `mag.js`, `mew.js`, `status.js`. Nine more `data/*.js` (`kad-replays`,
  `live`, `nmf`, `pory`, `roles`, `scoreboard`, `slowking*`, `xatu`) carry no GENERATED header at all.
- `engine/board.js:1389-1392` `catch (e) { _dmg = false; }` — the board silently runs without a
  damage engine. Not new, but not counted either.

### 1.8  SHOULD FIX — unknown id reads as "carries no tags"

`engine/tags.js:70-77 tagsFor()` returns `null` for an id not in the table and increments nothing.
`param()` counts ASKED per tag, never "asked about an entity the table does not know". An ability in
display case — the exact 85-of-318 failure the simulator documents at
`medicham2-browser.js:8209-8216` — reads as *no tags*, which is indistinguishable from a body that
genuinely has none. One counter (`MEDFAILS.tagEntityUnknown` + first offender) closes it.

### 1.9  SHOULD FIX — a heap declaration the register cannot honour

`engine/register_reality.js:985` rejects `--max-old-space-size` in a marker (`UNKNOWN NODE OPTION`)
and derives no `ABRA-HEAP:`. Register rows name instruments that declare a heap: `#319 open —
node tests/roster.js --stage moves` (6144), `node tests/test-resolution-order.js --only a2-red`,
`node -r ./tests/_live_release.js tests/probe_endturn_clock_order.js` ×2. Those die at exit 134 and are
classified UNDECLARED — *not red, not green* — which is the resource-verdict-as-check-verdict class
`tests/run-all.js:781-793` was written for. `engine/quarantine.js:524,646` also PRINTS a bare
`node tests/roster.js … --write` as the rerun command; `tests/roster.js:6-9` records that exact
command dying twice.

### 1.10  Silent-catch ratchet — status

`node tests/test-no-silent-failure.js`: 600 files, 1109 catch blocks, **262 silent (24%), 83
MANUFACTURE**, 201 baselined, 70 accepted, 9 fixed since baseline, 0 new. Green, and the 9 fixes are
not locked in (`--update` owed). The pre-commit gate scopes to staged files under `engine/ build/
tests/` top level only; `web/` and `mcp/` are outside both the ratchet and the hook.

### 1.11  `--write` shape

28 scripts know `--write` and can write; 15 carry no visible "nothing written" wording in source
(`engine/game_differential.js` among them, `WRITE` at :131, write at :9044). LESSONS already records
two agents reading a report-with-no-write as a measurement. Not a code defect; a UX one. DEFER, but
the fix is one line: print `NOT WRITTEN (no --write)` on the last line, always.

---

## 2. TESTS THAT CANNOT FAIL — 28 sampled

Method: header read, assertion shape, red arm, vacuity. "Load-bearing" means I could convince myself
the PASS is a claim about built behaviour.

| test | what it asserts on | red arm shown? | verdict |
|---|---|---|---|
| `tests/test-no-silent-failure.js` | catch bodies, hashed; monotone ratchet | yes (header, #258) | load-bearing |
| `tests/test-lownode.js` | exit code propagation, priority | yes (`exit /b` deleted) | load-bearing **but no heap-derivation arm** — the `:derive`/findstr path, the LF-sensitive one, is untested |
| `tests/test-wiring.js` | capability counters > 0 in real games | yes | load-bearing; needs simulator |
| `tests/test-engine-consistency.js` | multiplier RATIOS across engines | partly | load-bearing (the `ripenBerryBoostUnmodelled` mention at :330 is in a comment, not a live compare) |
| `tests/test-pp-fact.js` (29 `ok`) | pp.js vs simulator numbers | — | load-bearing, pins a duplicate (§3) |
| `tests/test-mc-key.js`, `tests/test-mc-seal.js` | the seal throws on a raw miss | yes (listed shapes) | load-bearing; the seal is the class fix, the list is not |
| `tests/test-effective-identity.js:187-235` | extracts `MEGA_ABIL` from **source text** by regex, compares to the dex | yes | load-bearing today; a re-spelling of the `const` makes `m` null and `:194` fails loudly — acceptable |
| `tests/test-assert-mode.js:135-170` | mutates source anchors, exits 1 if an anchor is missing | yes | load-bearing; anchors are loud |
| `tests/test-seed-clock.js:602` | `ENGSRC.includes(field+'>0')` — **a grep** as proof "the engine still READS field" | — | **not load-bearing for that claim**: a comment containing `field>0` keeps it green with the read gone (the `test-middle-identity` shape, §7 of the start skill) |
| `tests/test-docs-quarantine.js:141-145` | `ok(true, 'THE GATE IS OPEN…')` when `gate_open` | — | **vacuous on exactly the 6.0.0 day**, by design and stated. The document-republish check goes quiet the moment the documents are rewritten. Needs a replacement clause for the open state |
| `tests/test-dead-volatile.js:117,144` | `ok(true, 'Swagger is not in this dex')` | — | vacuous when the dex lacks the move; correct that the case is untestable, wrong that it counts as a pass |
| `tests/test-rollout-gates.js:98` | `ok(true, n_measured=…)` informational | — | informational, not vacuous |
| `tests/test-set-realism.js:104` | exit 2 when `games.bo3.jsonl` absent | — | see §1.1 |
| `tests/test-encore-fail-silent.js`, `test-multihit-damage-game.js`, `test-resolution-order.js`, `test-sleep-duration.js` | play staged boards vs authority | yes (knobs) | load-bearing when they run; **exit 2 on illegal fixture / MEDSEEN absent → SKIP** (§1.1) |
| `tests/test-damage-roll-support.js`, `test-multihit-roll.js` | roll mapping vs authority | — | same: `fixture could not be staged` → exit 2 |
| `tests/test-quality.js` | JS/Python parity | — | RED in register-reality (2026-09-08); exit 2 without python |
| `tests/test-site-sync.js` | `web/` == `app/` byte-identical | — | red on purpose per memory (web paused); run-all names it at :10 |
| `tests/test-docs-current.js` | living-doc currency, clause 5 | yes (stripCR) | load-bearing; was blind to CRLF for a day (§7) |
| `tests/test-artifact-rerunnable.js` | releases still openable per caller | yes | load-bearing; needs `ABRA-HEAP` |
| `tests/test-engine-release.js` | live edit does not reach the snapshot | yes | load-bearing |
| `tests/test-orient.js` | every orient section derives, `ORIENT_BREAK` goes red | yes | load-bearing |
| `tests/test-counter-init.js` | counters exist before first read | (self-test names `MEDSEEN.field`, `MEDFAILS.foo` — expected) | load-bearing |
| `tests/test-mechanics.js` (33,382 lines) | tag consumed → number moves | yes per row | not read in full; **size is a bus-factor item (§8)** |
| `engine/validate_damage.js` (GATE) | simulator vs `@smogon/calc 0.11.0` with a **hand-typed Gen-9 type chart** `TC` at :10-25 | — | validates the MATH; the chart is a typed Pokémon fact in a gate (CLAUDE.md rule), and the calc is mainline, not Champions. UNVERIFIED whether any Champions chart entry differs; no line here compares `TC` to `Dex.types` |
| `engine/gate_fail_and_silent.js` (GATE) | `-fail` events authority emits and we do not | declared | **RED today** (§1.3) |
| `engine/side_selection_census.js` (PENDING) | side-selection sites declared | ratchet | **RED today, unrun** (§1.3) |
| `engine/conformance.js`, `engine/provenance.js` (GATES) | S1-S13 ratchet; artifact freshness by CONTENT | baseline | headers read only; not run |

**Red-arm coverage of the simulator's knobs:** 237 `MEDI_*` knobs are read (all as `==='1'`, 151 at
module scope, and every test that sets one does so BEFORE requiring the engine — checked, 27/27).
**45 of 237 (19%) are named in no test and no engine script** — their red proof exists only in
`CHANGELOG.md` / `docs/ENGINE.md` prose. Names: `MEDI_VOL_RESTART_BLIND`,
`MEDI_GRAVITY_GROUNDS_EVERY_CHARGE`, `MEDI_CHARGE_WRAP_CLEARED_AT_EXECUTION`,
`MEDI_SUPPRESSED_ITEM_IS_LOST`, `MEDI_LOCK_STALE_ON_HANDED_ACTION`, `MEDI_ROOM_ITEM_SURVIVES_LOSS`,
`MEDI_EMPTY_HAND_IS_THE_SLOT`, `MEDI_PUNISH_MINIMIZE_BLIND`, `MEDI_MEGA_STAT_DELTA`,
`MEDI_RESIDUAL_COLLAPSE`, `MEDI_CRIT_ONCE_PER_CLICK`, `MEDI_DRAG_REFUSAL_FAILS`,
`MEDI_CRIT_VOLATILE_BLIND`, `MEDI_PROTEAN_ATTACK_ONLY`, `MEDI_SUCKER_QUEUE_BLIND`,
`MEDI_DISABLE_ONSTART_BLIND`, `MEDI_GUARD_NO_HITPROTECT`, `MEDI_BOUNCED_TRAP_KEEPS_CLICKER`,
`MEDI_RIDER_STATUS_NO_SOURCE`, `MEDI_BOUNCE_UNDONE_BY_REAIM`, `MEDI_STATUS_ABSORB_BLIND`,
`MEDI_HP_THRESHOLD_BOOST_EARLY`, `MEDI_SWAP_LINES_BLIND`, `MEDI_LEPPA_LINE_BARE`,
`MEDI_NO_BERRY_EAT_ANNOUNCE`, `MEDI_NO_CONDPOWER_LINE`, `MEDI_FORECAST_NAME_BLIND`,
`MEDI_DMG_OWNTYPE_BLIND`, `MEDI_ALLY_REFUSAL_IMMUNE`, `MEDI_NO_COPYBOOST_LINE`,
`MEDI_NO_ATTACKER_IMMUNE_LINE`, `MEDI_NO_ENTRY_FIELD_SYNC`, `MEDI_WEATHER_UPKEEP_GATED`,
`MEDI_WSUP_STALE`, `MEDI_UNNERVE_PARTIAL`, `MEDI_SIDEBUFF_IGNORES_INFILTRATOR`,
`MEDI_IMMUNITY_GATE_BLIND`, `MEDI_PRANKSTER_SIDE_BLIND`, `MEDI_NO_DESTINY_BOND`,
`MEDI_TYPES_SURVIVE_FAINT`, `MEDI_VOLLEY_REACT_DRAWN`, `MEDI_TERRAIN_TARGET_SINGLE`,
`MEDI_TERRAIN_SCALED_UNGATED`, `MEDI_ETERRAIN_ALLOWS_SLEEP`, `MEDI_STEALEAT_STRIP_ONLY`.
SHOULD FIX: a knob with no test is a red arm that was shown once and can never be shown again.

**Checks with no runner.** `tests/run-all.js` `PENDING_WIRE` = **38** files (24 more in
`NOT_A_CHECK`). 25 are `tests/probe_*.js`; only 8 of those are also named by a `VERIFIED BY:` marker,
so **17 probes are run by nothing** — not the suite, not the register. Plus `engine/feature_fixture.js`
(red by design), `engine/register_reality.js`, `tests/roster.js`, `tests/staged_board.js`,
`tests/mutation_harness.js`. `data/mutation-coverage.json` was last generated **2026-08-22**.

---

## 3. SINGLE SOURCE OF TRUTH — facts implemented twice

| fact | implementation A | implementation B | pinned by | severity |
|---|---|---|---|---|
| move accuracy after the field | `engine/medicham2-browser.js:10458 moveAccuracy` → tags artifact (`printedAccuracy`) | `engine/board.js:3283 moveAccuracy` → runs the dex `onModifyMove` against a stub with `hasItem:()=>false, hasAbility:()=>false` | nothing compares them (#58 still true) | SHOULD FIX — the stub is item/ability-blind by construction, so a board rollout and the simulator can price the same click's hit chance differently |
| PP maximum | `medicham2-browser.js:6111 ppMax` | `engine/pp.js:114 maxPP` | `tests/test-pp-fact.js` (29 ok) | DEFER — same artifact read twice, pinned; still two readers (#146) |
| speed multipliers | `medicham2-browser.js:17178 effSpeed` → `TAGS.param('item',…,'speedMult')` | `board.js:2510 speedMult` + ability/item/paralysis via dex `onModifySpe` handlers | `test-engine-consistency.js` ratio check | DEFER — CLAUDE.md's stated exception, and pinned; but the MULTIPLIER is derived twice (tags vs dex) rather than once |
| Levitate / airborne | `AIRBORNE_ABIL` set | `typeImmunity{type:'Ground'}` tag | `test-assert-mode.js:146-158` says "filed for ENGINE as a FACTS-ARE-GLOBAL duplicate" | SHOULD FIX — two agreeing gates means a mutation of one proves nothing (its own words) |
| exit-code meaning | `tests/run-all.js:773` (2=SKIP) | `engine/register_reality.js:489-518` (2=UNDECLARED unless declared); `engine/wire_ladder.js` (4=refused) | nothing | **BLOCKS via §1.1** (#380) |
| closed-row detector | `engine/quarantine.js:1191 roadmapRowIsClosed` | `engine/where.js:98` **delegates** and returns null-not-false if it cannot load | — | fixed; no second copy found. Good |
| species key | `engine/mc_key.js` + seal | 196 files carry a private `replace(/[^a-z0-9]/g,'')` toID — mostly for moves/abilities, not species | `test-mc-seal.js` | fixed at the seal, not the list. Good |
| the species table | `data/engine-data.js` ← `build/build_engine_data.js:139` ← `../CHOMP/engine/champ-model.js` ← scraped `champions-damage-lab.html` (Jul 24) | second writer `build/rebuild_sets_from_sheets.js:223` | **no test compares `MC.mons` to `Dex.forFormat`** | SHOULD FIX — **measured today: 347/347 legal species match the dex on base stats and types**, so no defect; but the builder's own header (`:68,:108,:114`) says a wrong source is invisible and `mv/item/ab` are inherited from the artifact, so `--check` cannot fail on those fields. The 20-line comparator that produced the 347/347 is owed as a test |

**Name matching where a tag shape should match.** 70 distinct entity ids at **163 sites** in the
simulator are matched with `==='<id>'`. Structural ones (`struggle` 22, `protect`, `substitute`)
are fine. These are damage/priority facts on a NAME, which the flags-vs-tags rule forbids:
`hugepower`/`purepower` `:13001`, `guts` `:13003`, `waterbubble` `:13023`, `muscleband` `:13503`,
`wiseglasses` `:13504`, `technician` `:8209,13255`, `intimidate` `:19391`, `prankster` `:18461`,
`defiant`/`competitive` `:19185`, `stalwart` `:25115`, `solarpower` `:13004`, `innerfocus`,
`overcoat`, `noguard`, `lifeorb` (comment), `leppaberry` ×3, `parentalbond` ×4, `yawn` ×11,
`wideguard` ×10, `encore` ×6, `disable` ×5, `uproar` ×6. No ratchet counts them. SHOULD FIX as a
ratchet; DEFER as a rewrite.

**Hand-typed Pokémon facts inside code** (CLAUDE.md: derive it or cite the line):
- `medicham2-browser.js:8191-8207 MEGA_ABIL` — 63 mega abilities typed "from Serebii". **Checked
  against the dex by `tests/test-effective-identity.js` §2** — so it is a HAND value with a
  comparator, which the rule allows. Fine, but it should be a `DERIVED` read of `data/tags.json` /
  the dex rather than a literal with a guard.
- `engine/validate_damage.js:10-25 TC` — 18×18 type chart typed in a GATE, no comparator.
- `engine/million_targets.js:445-453 PROC_WHAT` — 12 hand descriptions; the RATES beside them are
  DERIVED (`randomChance` parse), the prose is not load-bearing. Fine.

---

## 4. GENERATED ARTIFACTS WITHOUT A SOURCE CHECK

`node engine/artifact_audit.js` — **no gaps, exit 0**. Check G: 10 self-declaring bundles, 5 compared
(`abra-tags.js`, `engine-data.js`, `guru.js`, `mega-formes.js`, `move-effects.js`), **5 not**
(`abra-meta.js`, `board-data.js`, `mag.js`, `mew.js`, `status.js`). Nine `data/*.js` declare no
builder at all. `data/board-data.js` is the browser's copy of the two priors the board reads
(`board.js:1600-1620`) and is the one that matters for the site's rollouts.

Release SOURCES vs what the frozen files actually open at play time: §1.6. Two stores and one
validation artifact are read live from inside a frozen release.

`node engine/where.js --artifacts` — the "WHO WRITES" index is a **400/200-character proximity
heuristic** (`engine/where.js:130-141`: any `data/…` string within 400 chars of a `writeFileSync` in
the same file). Verified false positives: `engine/open_work.js` listed as writing
`data/interaction-matrix.json` (it only reads it), `tests/regulation_usage.js` as writing
`data/games.ladder.jsonl` (it writes a cache), `tests/test-publish-guard.js` as writing
`data/engine-diff.json` (from a comment at `:138`), `tests/test-arm-steering.js` as writing
`data/mechanics-census.json` (it copies it to temp files). The project trusts this index *because it
derives*; it derives wrong. SHOULD FIX (parse the actual `writeFileSync(` argument).

---

## 5. THE SIMULATOR — `engine/medicham2-browser.js`

- **45,345 lines, one file, runs in node and the browser.** 28 `_step*` procedures; `_stepApply`
  referenced 42×, `_stepFaint` 27×, `_stepUpdate` 22×, `_stepEffects` 20×. The step list is a
  convention in names, not a table: there is no single array that says the order, and
  `_steps`/`_step_order` appear once and three times.
- **RNG.** `RNG_STREAMS = ['acc','crit','sec','dmg','stall','tie','tgt']` (`:25567`), exported on
  `root`. `game_differential.js:4024-4055` replaces the authority's `battle.prng.random`,
  `.randomChance`, `.shuffle`. `sim/prng.ts:132-156` (read): `sample()` and `shuffle()` both call
  `this.random`, so the patch covers the 20 `this.sample(` sites in the data files. No gap found here.
- **Knobs.** 237 `MEDI_*`, all `==='1'`; a typo in a test would set a knob nobody reads — and four
  such names exist in tests but are read by `game_differential.js`/`board_state.js`, not the
  simulator (`MEDI_MIRROR_END_OF_TURN`, `MEDI_PARTY_KEY_DISPLAY`, `MEDI_MID_SELFDROP_SHARED`,
  `MEDI_MID_RANGE_DRAWS`) — correct, they are instrument knobs. 45 knobs have no test (§2).
- **`indexOf` sentinel sites: 90** (`=== -1` once; the rest `<0`/`>=0`). LESSONS says five side
  bugs resolved to `-1` read as "nothing here". No census of these exists; `side_selection_census.js`
  covers side selection only. DEFER: a one-off audit listing the 90 with what `-1` means at each.
- **Browser fork:** §1.7. `web/tower.html:195-200` loads `engine-data.js`, `abra-meta.js`,
  `move-effects.js`, `abra-tags.js`, then the simulator — the right set. `board-data.js` is loaded by
  the board pages and is the unchecked bundle.
- **Silent catches in the simulator:** 2 accepted, 3 baselined (from `data/silent-catch-baseline.json`).
  Low. Good.

---

## 6. DEAD AND DUPLICATE CODE

- Require+mention graph over engine/tests/build/web/mcp/tools/hooks/skills/docs (excluding the
  worktree copy): **208 `engine/*.js`; 2 required by nobody and named nowhere** —
  `engine/h2h_stats.js` (9.5 KB), `engine/team_heterogeneity.js` (6.3 KB). 117 are CLI-only
  entrypoints named in docs/ledgers. `engine/graveyard/medicham-v2-singles.js` is required by nothing
  and carries its own `choice scarf` ×1.5 (`:39`) — dead, harmless, but a third speed rule on disk.
- Two differentials: `engine/game_differential.js` (9,631 lines) and `engine/replay_differential.js`
  (2,223) — different questions (staged vs replayed), both live. Not a duplicate.
- Two writers of `data/engine-data.js` (§3). One should be the builder.
- `docs/HANDOFF-*.md`: read by no code as data; mentioned in comments of `status.js`, `open_work.js`,
  `test-docs-current.js`, `test-roadmap-register.js`, `build/build_archive_index.js`. Leave them.
- `.claude/worktrees/agent-af59bcfe6a6444960/` — a **539 MB locked git worktree** of this repo inside
  the repo (gitignored). Any repo-wide grep that does not exclude it double-counts; my first knob
  census did. DEFER: note in CLAUDE.md that `.claude/worktrees` must be excluded from every sweep.
- Do NOT delete tracked data for space — history is permanent here (CLAUDE.md §wall).

---

## 7. DEPENDENCY AND RUNTIME RISK

- `package.json`: `@smogon/calc 0.11.0` (mainline gen 9, used by the damage GATE), dev
  `@stryker-mutator/core 10.0.0`. **No `engines` field, no `scripts`, no `.nvmrc`.** Running node is
  **v24.15.0**; CLAUDE.md's `.cmd`-spawn rule is written for ≥20. `package-lock.json` present.
- **`tools/lownode.cmd` is LF** (`git ls-files --eol`: `i/lf w/lf`), as are `tools/r4-three-arm.cmd`,
  `start.bat`; `push-all.bat` is `i/lf w/crlf`; `PUSH-TO-GITHUB.bat` CRLF. `core.autocrlf=true`,
  1,118 tracked files CRLF / 1,807 LF. LESSONS records *"a `.cmd` file with LF line endings opens an
  interactive prompt instead of running"* and CLAUDE.md mandates this wrapper for every heavy run.
  `tests/test-lownode.js` passes today (4/4 via `cmd /c`) but has **no arm for `:derive`** — the
  `call :label`/`goto :eof`/`findstr` path that is exactly where LF batch files misbehave. Either pin
  the file CRLF in `.gitattributes` (`*.cmd text eol=crlf`) or add the arm; preferably both. SHOULD FIX.
- **Heap.** 10 files declare `ABRA-HEAP:`; honoured by `tests/run-all.js`, `tools/lownode.cmd`,
  `.githooks/pre-commit`. NOT honoured by `engine/register_reality.js` (§1.9). 123 files spawn a
  child; 17 pass `--max-old-space-size`.
- **CRLF regex hazards.** 265 of 600 `engine/tests/build` `.js` files are CRLF on disk. **380
  `split('\n')` sites vs 20 `split(/\r?\n/)`**; only 2 files use `stripCR`. 14 files combine a
  `readFileSync` with a `$`-anchored `m`-flag regex: `engine/docs_scan.js` (fixed), `provenance.js`,
  `status.js`, `register_reality.js`, `sweep.js`, `durable-ingest.js`, `fixture_legality.js`,
  `smogon_priors.js`, `tests/test-model-map.js`, `test-policy-promote.js`, `test-prng.js`,
  `test-stadium-roster.js`, two probes. A `\s*$` tolerates CR; a `[^|]*\|$` or `\d+$` does not. The
  docs_scan blindness read `0 of 100 owed` for a day and every test was green. SHOULD FIX: one
  `readText()` that strips CR, used by every file reader; or `.gitattributes` `* text=auto eol=lf`
  and a re-normalise commit.
- **Authority pin:** §1.5. **Release evidence:** §1.4.

---

## 8. BUS FACTOR — three items

1. **`engine/medicham2-browser.js` at 45,345 lines with no step table.** The resolution order is
   knowable only by reading; `docs/TAGS.md` describes five stages, the code has 28 `_step*` names and
   237 behaviour knobs whose default arm is the correct one and whose red arm is documented in
   CHANGELOG prose for 45 of them. A maintainer cannot tell a knob that guards a proven fix from one
   that guards a hypothesis without git archaeology. Owed: a generated `docs/STEPS.md` (derived, like
   `orient.js`) listing step order and, per knob, the test that shows it red.
2. **The exit-code protocol lives in one file's comments.** `ABRA-EXIT <n> <VERDICT-RED|CANNOT-ANSWER>`
   is defined in `engine/register_reality.js` only; run-all does not know it, wire_ladder uses 4,
   quality uses 2 for "no python". A new gate author has three conventions to choose from and no
   test that refuses the wrong one.
3. **`tests/run-all.js` exemption tables** (`NOT_A_CHECK` 24, `PENDING_WIRE` 38) are 200-500-word
   prose blobs per key, self-auditing on existence but not on truth — `derive_protocol_events.js`'s
   entry records that its previous reason was false for a day. The truth of an exemption is checked
   by nobody; the register's `VERIFIED BY:` marker is the mechanism that could, and 17 probes have
   neither.

---

## 9. What is fine (so nobody re-audits it)

- Pre-commit hooks armed (`core.hooksPath=.githooks`); silent-catch gate, bundle gate, notes gate,
  rerunnable ratchet all run there; `commit-msg` refuses a version with no CHANGELOG entry.
- Closed-row detector is single (`where.js` delegates, null on failure). Species key is sealed.
- `artifact_audit.js` green, `abra-tags.js` == `tags.json`.
- `MC.mons` matches `Dex.forFormat` on all 347 legal species (base stats, types) — measured today.
- Authority commit matches the pin today. `sample()`/`shuffle()` route through the patched `random`.
- Every `MEDI_*` set in a test is set before the engine is required (27/27).

---

## OWED, NOT RUN

Exact commands. None of these were run by this review; several play games or write.

```
# 1.1 — after the runner change: prove a COULD-NOT-STAGE exit turns the suite red
node tests/run-all.js --list
cmd /c tools\lownode.cmd tests\run-all.js

# 1.2 — the compared set behind the 6.0.0 claim, by verdict
node -e "for(const k of ['moves','items','abilities']){const r=require('./data/roster.'+k+'.json');const t={};for(const x of r.results)t[x.verdict]=(t[x.verdict]||0)+1;console.log(k,t)}"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown cmd /c tools\lownode.cmd tests\roster.js --stage abilities --reds --write --release b730e44f3314

# 1.3 — the red gates, on a settled tree
cmd /c tools\lownode.cmd engine\gate_fail_and_silent.js
cmd /c tools\lownode.cmd engine\side_selection_census.js
cmd /c tools\lownode.cmd engine\register_reality.js
cmd /c tools\lownode.cmd engine\quarantine.js --check
cmd /c tools\lownode.cmd engine\status.js

# 1.4 — put the cited release in the repository
git add -f data/releases/b730e44f3314
node engine/engine_release.js list

# 1.5 — nothing reads commit_matches; confirm, then wire it into the differential's preflight
grep -rn "commit_matches" engine tests build --include=*.js

# 1.6 — does a pinned run reach the live set filler?  (count fillSet calls under --release)
SHOWDOWN_PATH=... cmd /c tools\lownode.cmd engine\game_differential.js --arm middle --team-store data/team-pool-frozen --release b730e44f3314 --games 45

# 1.10 — lock in the nine fixed silent catches
node tests/test-no-silent-failure.js --update

# 2 — the source-grep and vacuous clauses
node tests/test-seed-clock.js
node tests/test-docs-quarantine.js
node tests/test-dead-volatile.js

# 3 — the owed comparator, as a test (the scratch version measured 347/347 today)
node -e "..."   # see docs/_reports/2026-09-09-pre-600-code-review.md §3: MC.mons vs Dex.forFormat, bs + types
node tests/test-pp-fact.js
node tests/test-engine-consistency.js

# 4 — the five unchecked bundles
node build/build_board_browser.js --check      # does not exist yet; that is the finding
node engine/artifact_audit.js

# 7 — line endings
git ls-files --eol tools/lownode.cmd
node tests/test-lownode.js                       # then add the :derive arm and re-run
git ls-files --eol | grep -c "w/crlf"

# 6 — dead modules
node -e "..."   # scratch require-graph script; re-derive rather than trust this report
```
