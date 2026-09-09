# 2026-09-09 — pre-6.0.0: do the guard tests fail when the thing they guard breaks?

MEASURE. Run in an isolated worktree at HEAD `d6789951` (engine sources byte-identical to the real
tree: a `cut` of this worktree produced the same release id the tracked pointer names,
`b730e44f3314`). Nothing here was committed or pushed. Every break was reverted byte-exact (`cmp`
against a backup taken before the edit) before the next one, and the two tracked files that
INSTRUMENTS rewrote during the session (`data/engine-release.json`, repointed by the cut;
`data/tag-consumption.json`, written by the green tag-consumed run) were `git checkout --`'d.

Method per test: run green, record exit code and output SIZE (bytes / lines — the size is the check
that has caught a no-op run every time here, so it is recorded beside the code); make ONE deliberate
break in the PROTECTED code, never in the test; re-run; classify; restore. Authority for each
mechanical break is cited to a file:line that was read this session, never recalled.

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown` throughout.

## Verdict

| | count | which |
|---|---|---|
| CAUGHT | 12 | a b c d e f g i j×3 k l |
| CAUGHT-BLIND | 0 | — |
| NOT CAUGHT | 1 | **h — `tests/test-docs-current.js`** (two independent mechanisms, both below) |
| COULD NOT BREAK | 0 | — |

Two blind spots inside CAUGHT tests, each proven with a variant and each named in its row: **(c)**
`test-mc-key.js` cannot see a doorway on a line that begins with a block comment; **(l)**
`test-sprt-arm-sign.js`'s source-spelling clause stayed green on an inverted sign (the behavioural
arms caught it). Three worktree-only reds were hit on UNBROKEN code and are separated out in §3 so
they cannot be mistaken for the real tree.

## 1. The twelve

Sizes are bytes / lines. "Green" is the untouched worktree; "red" is after the break.

### a) `tests/test-wiring.js` — capability counters, and the mega RATE floor — CAUGHT

- Green: exit 0, 799 B / 19 lines, 123 s. **Needs `NODE_OPTIONS=--max-old-space-size=6144`** and a
  restored `data/games.ladder.jsonl` (see §3.1). Mega 7 in 6 games = 1.17/game against the 1.00 floor.
- Break (`engine/magnemite.js` `_withMega`): return the choice un-mega'd when the deciding slot is
  index 1 — the 2026-07-28 left-slot-only bug, re-created exactly. Direction: fewer megas, never more.
- Red: exit 1, 1172 B / 22 lines. `it mega evolves when it holds a stone (4)` stayed **ok** — the
  non-zero check passed, as the file's own comment predicts — and the two rate clauses fired:
  `0.67 per game, expected at least 1.00` on the default run AND on the `--joint` run. Names the
  clause and the mechanism.

### b) `tests/test-engine-consistency.js` — FACTS agree across engines — CAUGHT

- Green: exit 0, 1676 B / 30 lines. `medicham2 effSpeed applies Choice Scarf as exactly x1.5  x1.496`.
- Break (`engine/medicham2-browser.js:17199`): `if(false&&_sm&&_sm.mult)_mods.push(+_sm.mult)` —
  the item speed multiplier is read and never applied. Authority: `data/items.ts:998-1001`
  `choicescarf.onModifySpe ... return this.chainModify(1.5)`; no Champions override
  (`grep choicescarf data/mods/champions/items.ts` → none).
- Red: exit 1, 1721 B / 30 lines. `FAIL medicham2 effSpeed applies Choice Scarf as exactly x1.5  x1.000`
  and `FAIL position_features: a declared Choice Scarf changes speedEdge  0.000 -> 0.000` — the
  second clause is the downstream consumer going flat, which is the propagation the test exists for.
  Names the fact and the engines.

### c) `tests/test-mc-key.js` — one species-key resolver — CAUGHT, with a named blind spot

- Green: exit 0, 3788 B / 49 lines, 21 passed.
- Break: append a hand-rolled doorway to `engine/board.js` (a non-holder), in three spellings:
  - **B2** `function __probeDoorway(name){ return MC.mons[name]; }` — a computed key.
    Red: exit 1, 3802 B, `FAIL NO file outside the named holders reaches a mon table except through
    mcKey (engine/board.js:4509)` and `FAIL no NEW file hand-rolls the species lookup (engine/board.js)`.
    **Names file:line.**
  - **A** `MC.mons["garchomp"]` — a literal key. Green, 21/21. **By design**: `PATTERNS`/`DOOR`
    exclude a literal index (`(?!['"\`])`, `tests/test-mc-key.js:231,341`) and hand wrong literals to
    the runtime seal (`tests/test-mc-seal.js`). Not a defect of the gate; recorded so nobody reads
    "green" as "seen".
  - **B — NOT CAUGHT variant.** The SAME computed-key doorway as B2 with a leading block comment on
    the line: `/* probe */ function __probeDoorway(name){ return MC.mons[name]; }`. Green, 21/21,
    **byte-identical output to the clean run**. Cause, read at `tests/test-mc-key.js:397`:
    `if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;  // a comment describing the bug is not the bug`.
    Any line that BEGINS with `/*` is skipped whole, including the code after the closing `*/`. This
    is the SKILL §7 shape "a check that cannot fail on a shape nobody listed", and it is one
    character of prefix away from B2. The runtime seal would still catch an EXECUTED wrong key; a
    correct computed key executed through this door is invisible to both halves.

### d) `tests/test-target-provenance.js` — no HAND-typed Pokémon value — CAUGHT

- Green: exit 0, 503 B / 10 lines. 234 DERIVED / 13 READ / 0 HAND / 0 MISSING of 247.
- Break (`data/million-targets.json:36`): the `protect-chain` row's `from` rewritten to begin `HAND:`.
- Red: exit 1, 717 B / 12 lines. `FAIL row "protect-chain" (chance) is HAND-typed: "HAND: …"` and the
  split moves to 12 READ / 1 HAND. Names the row and the family.
- Instrument note: my first attempt used an em-dash in the replacement and my latin1 edit helper
  mangled it into control bytes, so the run went red on `SyntaxError: Bad control character in
  string literal` — red for the wrong reason. Redone in ASCII. Recorded because "red" is not
  evidence about the assertion until the failing clause is read.

### e) `tests/test-tag-consumed.js` — a derived tag with no consumer — CAUGHT

- Green: exit 0, 2365 B / 32 lines. LIVE 164 / STAGED 90 / UNREACHED 27 / DEAD 11 (floor 11).
- Break (`engine/medicham2-browser.js:42467`): `const _wc=null;` in place of
  `TAGS.param('ability',m.ability,'weatherChipImmune')` — the one engine consumer of the tag removed;
  the literal survives only in `engine/tag_dex.js` (the derivation).
- Red: exit 1, 2975 B / 37 lines. `FAIL 1 tag(s) LOST a consumer they had at the baseline:
  weatherChipImmune (was LIVE)` and `FAIL 1 tag(s) are DEAD outside the ratchet floor:
  weatherChipImmune [REGRESSED (was LIVE)]`; DEAD 11 → 12 and the test **refused to write its own
  baseline** ("DID NOT WRITE data/tag-consumption.json — this run FAILED"). Names the tag.

### f) `tests/test-engine-release.js` — a release serves old bytes after a live edit — CAUGHT

- Green (heap 6144): exit **1**, 7728 B / 88 lines, 11 s — but the red clause is a worktree artifact
  (§3.3), and the load-bearing clauses ran and passed BEFORE it:
  `ok the RELEASE still serves the original bytes`, `ok REL.read() does not see the edit either`,
  `ok the mutation arm actually ran`.
- Break (`engine/engine_release.js` `frozen()`): `return D(rel)` in place of `return path.join(dir,
  rel)` — every `require`/`path`/`read` on the snapshot resolves to the LIVE tree. This is the
  "plausible wrong implementation" the file's header names (a symlink-equivalent).
- Red: exit 1, 7728 B / 88 lines. `FAIL the RELEASE still serves the original bytes — a division may
  rewrite the live tree mid-measurement` and `FAIL REL.read() does not see the edit either — the
  snapshot is a copy, not a symlink or a passthrough`. Names the property. Output size did not move,
  so the SIZE check alone would not have distinguished this red from green here — the exit code and
  the clause text did.

### g) `tests/test-lownode.js` — exit code propagates — CAUGHT

- Green: exit 0, 292 B / 7 lines, 4 passed.
- Break (`tools/lownode.cmd`): the line `exit /b %ERRORLEVEL%` deleted (the file's documented red).
- Red: exit 1, 301 B / 7 lines. `FAIL A FAILING SCRIPT WAS REPORTED AS SUCCESS. Every gate in this
  repo would read green.` plus `FAIL could not observe the child priority at all — the arm proves
  nothing, treat as red`. 2 passed / 2 failed, matching the 2026-08-11 demonstration's shape.

### h) `tests/test-docs-current.js` — a figure with no source fails — **NOT CAUGHT**

- Green: exit **1**, 7684 B / 105 lines, 32 passed / 1 failed. The one red is pre-existing on HEAD
  (§3.4: `the archive index matches the headers in docs/archive/`). Baseline for clause 3b(b)
  "figures a cited artifact does not contain": 61 entries, 41 of them in `docs/MODELS.md`.
- Break H1 (`docs/MODELS.md:7`, a paragraph citing `data/game-differential.json`):
  `**board-material 27 of 961**` → `**board-material 41 of 961**`.
  Result: exit 1, 7684 B / 105 lines, **byte-identical to green**, `no new entries (baseline 61, now 61)`.
- Break H2 (same line): `27 of 961` → `27 of 962`. Same: byte-identical, not caught.
- Break H3 (a NEW final paragraph): ``On this release `data/game-differential.json` reads
  **board-material 777 of 961**.`` → **caught**: `FAIL figures a cited artifact does not contain: no
  new entries (baseline 61, now 62) NEW: docs/MODELS.md:2445  777  not in data/game-differential.json`.
- Break H4 (the same NEW paragraph with 41 instead of 777): **not caught**, byte-identical to green.

Two mechanisms, both read at source:

1. `engine/docs_scan.js:807` — `if (QUALIFIED.test(text)) continue;` with
   `QUALIFIED = /retract|withdraw|superseded|void|…|prior|former|previously|…/i` (`:626`). The
   whole paragraph is exempt if it contains ANY of those words. MODELS.md line 7 says "reproduced
   the **superseded** 5.264.0 publication exactly", so every figure in the ledger's headline
   paragraph is unchecked. The word list is broad enough (`prior`, `void`, `former`) that a large
   share of the living documents' paragraphs will qualify; that share was not measured here and is
   owed (§5).
2. `engine/docs_scan.js:496-499` `artifactHas` — membership of the figure in the SET OF EVERY NUMBER
   in the cited artifact. `data/game-differential.json` (471 KB) contains the digit token `41` on 5
   lines and `27` on 7, while its actual headline is `games 961 − games_board_never_diverged 958 =
   3`. So a wrong headline whose digits occur anywhere in the artifact passes. This is the exact
   SKILL §7 entry "`231 live of 232 probed` counted as traceable because `231` appears inside a
   308 KB census", still live for this clause.

Note also that the WORKTREE artifact's headline is 3, not the 27 the document states — but the
document's 27 is on release `57679ef9a4a3` and the artifact on disk is a later run, so that is
documentation-vs-artifact drift already covered by the 41 baselined entries, not a finding of this
pass.

### i) `tests/test-resolution-order.js --only a1-red` — do the anchors still bite? — CAUGHT

- Green (heap 6144, one arm): exit 0, 4050 B / 34 lines, 2 s. `RED PROVEN [A1] a1-red`, counter
  `buffOnHitAfterSecondaries = 1 (exact), under the break: 0`. (The harness plants its OWN break per
  arm; mine below is a different edit so the two are not the same experiment.)
- Break (`engine/medicham2-browser.js:40828-40834` `_STEPS`): `_stepEffects` (secondaries) moved
  from before `_stepDamagingHit` to after `_stepDamagingHitLate` — secondaries BELOW `DamagingHit`.
  Authority: `data/mods/champions/scripts.ts:387` `// 5. secondary effects` inside `spreadMoveHit`,
  then `sim/battle-actions.ts:1121` `runEvent('DamagingHit', …)` — the authority's order is the one
  the clean `_STEPS` has.
- Red: exit 1, 4294 B / 39 lines. `PARTS CLEAN [A1] a1-red`, `CLEAN PARTED at reduced line 15`
  (`showdown |-unboost|p2a: Archaludon|spe|1` vs `medicham |-boost|p2a: Archaludon|def|1|[from]
  ability: stamina`), `counter buffOnHitAfterSecondaries WANT 1, GOT 0 <-- FAIL`, `2 failing`. Names
  the arm, the line and the counter.

### j) three MEDI_* knob probes from this week — CAUGHT ×3

| probe | bare | knob | what red looks like |
|---|---|---|---|
| `probe_multihit_through_doll.js` | exit 0, 2735 B / 40, `ALL CLAUSES PASS` | `MEDI_VOLLEY_STOPS_AT_DOLL=1`: **exit 0**, 3227 B / 49, `9 FAILING CLAUSE(S) — EXPECTED: the restore knob is on` | 9 clauses by arm: `BREAK-FIRST — BODY HP DISAGREES: authority 81, ours 124`, `LETHAL — the body FAINTED on one engine only`, `-hitcount DISAGREES: authority 2, ours null` … |
| `probe_yawn_safeguard_refusal.js` | exit 0, 7140 B / 103, `green — every arm agrees` | `MEDI_YAWN_THROUGH_SAFEGUARD=1`: exit 1, 8214 B / 115 | `RED SG-YAWN — every board boundary identical`, `RED ALLY-YAWN`, `RED INFIL-ALLY`; the controls (`SG-SEED`, `INFIL-FOE`, `SG-STATUS`) stay green |
| `probe_ohko_type_immunity.js` | exit 0, 8574 B / 69, `PASS`, `RED PROVEN sheercold-at-an-ice-body` | `MEDI_NO_OHKO_IMMUNE_LINE=1` in the environment: exit 0, 8574 B / 69 — **byte-identical** | the probe sets and clears the knob PER ARM in-process (`:118 if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];`), so its own knob arm reads `RED PROVEN` on every run and an external variable is a no-op by construction |

Two things a runner has to know, both read from the probes rather than assumed:
- The doll probe **inverts its exit code under the knob** (`:318 process.exit(RESTORED ? 0 : 1)` /
  `:321 process.exit(RESTORED ? 1 : 0)`): exit 0 with the knob on means "the defect demonstrably came
  back"; exit 1 with the knob on would mean the knob no longer reaches the mechanic. A runner that
  reads `MEDI_X=1 node probe && RED` would misfile it.
- The ohko probe's knob is not an external interface. Its red arm is internal and self-verifying;
  `MEDI_NO_OHKO_IMMUNE_LINE=1` on the command line does nothing and prints nothing about doing nothing.

### k) `engine/artifact_audit.js` — the abra-tags.js comparator — CAUGHT

- Green: exit **1**, 6044 B / 95 lines, 1 s, `2 GAP(S) FOUND` — both worktree artifacts (§3.5). The
  clause under test read `ok data/abra-tags.js is what build/build_tags_js.js would write from data/tags.json`.
- Break (`data/tags.json:37130`): Choice Scarf `speedMult.mult` 1.5 → 1.6. (A wrong value, not a
  reformat: the authority is `data/items.ts:1000` `chainModify(1.5)`.)
- Red: exit 1, 6400 B / 100 lines, `3 GAP(S) FOUND`; the new one is `GAP data/abra-tags.js is NOT
  what build/build_tags_js.js would write from data/tags.json — the browser engine and the node
  engine … tags.json generated 2026-09-09T06:54:05.424Z  abra-tags.js generated 2026-09-09T06:54:05.424Z`.
  Names the pair. Note it names the pair and not the entity/param that differs; that is a
  CAUGHT-not-BLIND because the clause IS "these two files differ", but a one-line "first differing
  key" would save the next reader a diff.

### l) my choice — `tests/test-sprt-arm-sign.js` (a clause that asserts source SPELLING) — CAUGHT, spelling clause blind

Chosen because SKILL §7 records a test going red for days on a grep of an identifier that survived
only in comments, and this file has the mirror image: `armRule(src)` at `:97-100` decides the sign
convention by regex-matching `winnerArm === 1 ? 1 : 0` in `engine/sprt.js` and `engine/paired_h2h.js`.

- Green: exit 0, 939 B / 16 lines, 12 passed.
- Break (`engine/sprt.js:196`): the real expression inverted to `winnerArm === 2 ? 1 : 0`, with the
  ORIGINAL spelling left on the same line inside a comment (`/* was: winnerArm === 1 ? 1 : 0 */`).
  Behaviour flips; the grep still matches.
- Red: exit 1, 938 B / 16 lines, 4 passed / 8 failed. The eight BEHAVIOURAL arms all fired (`when arm
  1 … wins every pair, the verdict says NEW is better` etc., in both directions). The two STRUCTURAL
  arms stayed green on inverted code: `ok sprt.js uses the SAME rule as paired_h2h.js (sprt arm1=NEW,
  paired_h2h arm1=NEW)`. The file is safe because the behavioural arms are load-bearing; the spelling
  clause is the one that would have been quoted if they were ever removed. Same class as (c)-B.

## 2. Knob census — derived, not estimated

`tests/` holds 372 entries: **366 `.js`** and 6 `.py`. Greps over the `.js` files:

| criterion | have it | lack it |
|---|---|---|
| mention any `MEDI_*` / `ROSTER_*` identifier | 175 | 191 |
| carry a documented invocation `MEDI_X=…` / `ROSTER_X=…` | 158 | 208 |
| any documented red arm: the above OR `--reds` OR `brk:` OR "SHOWN RED" / "shown red" / "RED ON A DELIBERATE" / "red on a deliberate" OR `--break` | **195** | **171** |

So **195 of 366 have a documented red arm of some kind and 171 have none.** The 171 include
behaviour-only tests like (b), (d), (g) and (l) above, which are red-demonstrable without a knob —
"no knob" is not "cannot go red" — but nothing in the tree records which of the 171 has ever been
shown red. Commands to reproduce the counts are in §5.

## 3. Reds hit on UNBROKEN code — every one a worktree/checkout artifact, none a finding about the real tree

Listed so that a future reader of this report does not carry any of them out of the worktree.

1. **`test-wiring.js` red twice before it was green.** (i) `data/games.ladder.jsonl` does not exist
   in a fresh checkout — the stores are tracked as `data/parsed/<store>/*.jsonl.gz` shards. Restored
   with `node build/compress-stores.js --restore-parsed` (81,269 rows, 392 MB; ignored paths). (ii)
   `engine/mew.js` then died at exit 134 parsing that store inside node's default ~2 GB old space
   (`FATAL ERROR: Ineffective mark-compacts near heap limit`), and `test-wiring.js` reported all ten
   counters as "does not even report" — which is the correct diagnosis of an absent report, but a
   heap ceiling filed as ten unwired capabilities. Green only with `NODE_OPTIONS=--max-old-space-size=6144`
   inherited by the two mew children. **Neither `tests/test-wiring.js` nor `engine/mew.js` carries an
   `ABRA-HEAP:` header, and `tests/test-wiring.js` is not referenced anywhere in `tests/run-all.js`**
   (`grep -n test-wiring tests/run-all.js` → nothing). The file's own header calls it "THE MOST
   IMPORTANT TEST IN THE REPOSITORY". Whether the real tree's routine runs pass it, and under what
   heap, is owed (§5) — this session did not run it there.
2. **`probe_yawn_safeguard_refusal.js` ENOENT on `data/releases/b730e44f3314/release.json`.** The
   pointer `data/engine-release.json` is tracked and names a release whose body is not in the
   checkout; `tests/staged_board.js:132` opens the pointer's release from the REAL store. Cutting the
   worktree tree (`node engine/engine_release.js cut …`) produced the same id and fixed it. A fresh
   clone will hit this on every staged-board probe until it cuts once.
3. **`test-engine-release.js` `FAIL the oldest release still verifies against its own manifest
   (d3d04b669e18)`** — `engine/medicham2-browser.js: manifest says 645b93a3878f, snapshot is
   f4bfddbb997d`, then the process throws and the remaining sections never run. Not CRLF (0 CRs in
   either file). The worktree's copy of that 2026-08-04 snapshot body does not hash to its manifest.
   Whether the real tree's `data/releases/d3d04b669e18/` has the same mismatch is owed (§5); if it
   does, the real tree's `test-engine-release.js` is red today for a reason that has nothing to do
   with releases working.
4. **`test-docs-current.js` `FAIL the archive index matches the headers in docs/archive/`** on HEAD
   `d6789951` — pre-existing, 32/1. Fix is the one it prints: `node build/build_archive_index.js`.
   This one is NOT worktree-specific; it is on the commit.
5. **`engine/artifact_audit.js` 2 GAPs**: (C) `engine-data.js` older than its source/builder — a
   checkout stamps every file with the checkout time; (D) `build/build_engine_data.js` resolves
   `../../CHOMP/engine/champ-model.js` relative to its own location, which in a worktree is
   `.claude/worktrees/CHOMP/…` and does not exist. Path-relative sibling resolution breaks in any
   worktree.

## 4. What this pass did NOT do

- Did not run `tests/run-all.js`, the differential, any roster stage, the census, `quarantine.js` or
  `status.js`, per the brief. Did not run `tests/probe_shield_rearm.js`.
- Ran `test-engine-release.js` and one `test-resolution-order.js` arm at `--max-old-space-size=6144`
  by plain `node`, not through `tools/lownode.cmd` (the wrapper was under test in (g), and the Bash
  tool's `cmd /c` path is the documented no-op hazard). RAM stayed under the 5.2 GB free at start.
- Did not measure how much of the living-document surface the `QUALIFIED` exemption removes from
  clause 3b(b). That is the number that decides whether (h) is a corner or a hole.
- Did not verify §3.1 and §3.3 against the real tree.

## OWED, NOT RUN

Exact commands, all from the REAL tree root unless stated. None was run here.

```
# (h) size the QUALIFIED exemption: paragraphs with a citation that clause 3b(b) skips
node -e "const S=require('./engine/docs_scan.js');console.log(Object.keys(S).filter(k=>/paragraph|citation|QUALIFIED|living/i.test(k)))"
#   then, with the names that prints, count cited paragraphs matching S.QUALIFIED per living document

# (h) the token-anywhere match: how many baselined MODELS.md figures would pass artifactHas by coincidence
node -e "const S=require('./engine/docs_scan.js');const b=require('./data/docs-currency-baseline.json');console.log((b.citation_mismatches||[]).filter(k=>k.startsWith('docs/MODELS.md|')).length)"

# (c) the leading-comment blind spot in test-mc-key section 3 — reproduce in the real tree, then revert
printf '\n/* x */ function __probe(n){ return MC.mons[n]; }\n' >> engine/board.js && node tests/test-mc-key.js; git checkout -- engine/board.js

# §3.1 does the real tree pass wiring, and under what heap
node tests/test-wiring.js
NODE_OPTIONS=--max-old-space-size=6144 node tests/test-wiring.js
grep -n "test-wiring" tests/run-all.js

# §3.3 is the oldest release's snapshot body really off its manifest in the real tree
node engine/engine_release.js verify d3d04b669e18

# §3.4 the pre-existing docs-current red on HEAD
node build/build_archive_index.js && node tests/test-docs-current.js

# §2 the knob census, reproducible
ls tests/*.js | wc -l
grep -l "MEDI_[A-Z_]*\|ROSTER_[A-Z_]*" tests/*.js | wc -l
grep -l "MEDI_[A-Z_]*=\|ROSTER_[A-Z_]*=" tests/*.js | wc -l
grep -l "MEDI_[A-Z_]*\|ROSTER_[A-Z_]*\|--reds\|brk:\|SHOWN RED\|shown red\|RED ON A DELIBERATE\|red on a deliberate\|--break" tests/*.js | wc -l
grep -L "MEDI_[A-Z_]*\|ROSTER_[A-Z_]*\|--reds\|brk:\|SHOWN RED\|shown red\|RED ON A DELIBERATE\|red on a deliberate\|--break" tests/*.js | wc -l

# (j) the doll probe's inverted exit code, for whoever wires it into a runner
MEDI_VOLLEY_STOPS_AT_DOLL=1 node tests/probe_multihit_through_doll.js; echo exit=$?   # 0 = knob re-broke it

# the eleven breaks not re-run through the wrapper, if the wrapper path is wanted on record
tools\lownode.cmd tests\test-engine-release.js
tools\lownode.cmd tests\test-resolution-order.js --only a1-red
```
