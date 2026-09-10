# Raw-learnset sweep (#565) — 2026-09-10 (MEASURE)

**Dated evidence, not current state.** Every figure below was read from a command run on 2026-09-09
between roughly 22:40 and 23:10 local on a working tree at HEAD `bf4ff432`, with
`engine/medicham2-browser.js`, `tests/probe_residual_trio_handlerless_body.js`, `data/engine-release.json`,
`data/mechanics-census.json` and `data/releases/489bea0577bc/*` under live rewrite by an ENGINE agent
(none opened or written here). Format `gen9championsvgc2026regmb`; the probes read the Showdown checkout
through `champions_sim.js`. **No commit was made.** Rules honoured: no differential, no roster, no census
write, no `status.js`, no `run-all`; every probe through `cmd //c tools\lownode.cmd`; the forbidden files
(`engine/`, `tests/roster.js`, `tests/test-mechanics.js`, `tests/test-engine-diff.js`,
`tests/probe_residual_trio_*.js`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md`) untouched.

---

## 0. The verdict

**37 of 37 named files converted.** The raw-learnset prevo walk (`e.learnset && e.learnset[id]`) is at
**zero** in `tests/`; every one of the 37 gates is now `const learns = (sp, mv) => CS.canLearn(sp, mv);`
— the validator's own `checkCanLearn`, the same function `tests/test-fixture-legality.js` uses. Four of
the 37 also DERIVED a cast off the species' own raw row (three Instruct user lists, one Gigaton Hammer
carrier list); those now go through `learns` too, and the carriers were shown identical before the edit.

**Before → after, 37 probes each way, sequential, through the wrapper:** 36 green / 1 red → 36 green /
1 red, and the two verdicts that moved are both attributed (§2):

- `probe_shield_refusal_line.js` green → **rc=2 `ILLEGAL FIXTURE Lucario does not learn Role Play`** —
  the switched gate doing its job on a set the sweep cannot see (a `mover(...)` construction site). The
  mover is now Delphox / Blaze, derived from the 14 legal carriers; the probe is **green again, 13 arms
  staged, 0 failing, `CONTROL HELD roleplay-noflag 1/1`**.
- `probe_yawn_substitute.js` red → green — red BEFORE on a stale scratch release
  (`release 0fecb64fce0b has been MODIFIED since it was cut: engine/medicham2-browser.js manifest
  235dc9e79e01, snapshot 9af4a019b8b1`); ENGINE's edit changed the tree digest, so the after-run cut a
  fresh live release and passed. Not this change in either direction.

**Every derived cast is unchanged under the validator** (§3): the raw walk and `canLearn` name the same
carriers for every move any of the 37 files derives from — so no probe picks a different body.

**`getLearnsetData` remains in 72 files / 88 lines of `tests/`, and none of them is one of the 37.** The
brief's expected remainder ("the files you were told not to touch plus a helper") does not describe the
tree: the `getLearnsetData` population is a SECOND, disjoint idiom family the batch-2 report never
named. Classified in §4; owed, not done.

---

## 1. Method

1. **Read the converted shape** (`tests/probe_curse_pressure_pp.js:85-89`): a comment and
   `const learns = (sp, mv) => CS.canLearn(sp, mv);`. All 37 files already `require` `champions_sim.js`
   as `CS` and build `dex` from it two lines above the walk, so nothing else had to be added.
2. **Inventory before editing**, per file: the `const CS = require(...)` line exactly once; the
   `const LS = dex.data.Learnsets;` line exactly once; the walk exactly once (two textual variants —
   `probe_spread_status_steps.js` splits the first line in two); **and every other word-bounded `LS`
   use**, which is what found the four extra derivations. (My first grep filtered them out because the
   derivation line also contains `const e = LS[s.id]` — the JS `\bLS\b` count caught it.)
3. **BEFORE run**, all 37, sequential, `cmd //c "tools\lownode.cmd tests/<f>"`, rc and seconds logged.
   The first attempt passed a literal `tests$f` (bash quoting inside the runner) — 37 × `rc=1` in 0-1s,
   `Cannot find module ...tests$f`. Caught on timing and on the non-zero rc; re-run. Recorded because it
   is the same family as batch 2's twelve fake greens, from the other side.
4. **Read-only derivation check** (§3) — walk vs `canLearn` on every derived cast, BEFORE any edit.
5. **Apply** by exact-match replacement (each pattern asserted to match once; 37/37), preserving each
   file's own line-ending convention (18 LF, 19 CRLF on disk); `node --check` on all 37.
6. **AFTER run**, same runner, same order; compare rc file by file; attribute every change (§2).

## 2. Per file

Columns: what changed in the file; rc BEFORE; rc AFTER (the sweep pass); last line of the after-log.

| file | change | before | after | after-log last line |
|---|---|---|---|---|
| `probe_arrival_drift_zero.js` | gate only | rc=0 | rc=0 | all assertions green |
| `probe_arrival_reprice.js` | gate only | rc=0 | rc=0 | all claims held |
| `probe_bigroot_family.js` | gate only | rc=0 | rc=0 | all 8 arms clear |
| `probe_bond_arrival_reprice.js` | gate only | rc=0 | rc=0 | GREEN every claim held. |
| `probe_bond_one_arrival_hitcount.js` | gate only | rc=0 | rc=0 | PASSED — every claim held |
| `probe_bounce_accuracy_address.js` | gate only | rc=0 | rc=0 | PASS — a bounced move takes its accuracy draw at the address of the body it wa… |
| `probe_damaginghit_walk.js` | gate only | rc=0 | rc=0 | PASS — a spread hit's DamagingHit handlers run order-1 first and then index-ma… |
| `probe_delayed_hit_immune.js` | gate only | rc=0 | rc=0 | PASS — a delayed hit that comes due on a type-immune body writes the condition… |
| `probe_drain_per_arrival.js` | gate only | rc=0 | rc=0 | PASSED — every claim held |
| `probe_gigaton_repeat.js` | gate + `CARRIERS` (Gigaton Hammer) derivation | rc=0 | rc=0 | all 9 arms clear |
| `probe_immune_step_order.js` | gate + `fillerFor` (derived filler; unchanged for all 10 bodies) | rc=0 | rc=0 | PASSED — every claim held |
| `probe_instruct_lastmove_pp.js` | gate + `users` (Instruct) derivation | rc=0 | rc=0 | PASS — Instruct is refused when the slot it would repeat is empty and granted… |
| `probe_instruct_shield.js` | gate + `users` (Instruct) derivation | rc=0 | rc=0 | PASS — a shield refuses Instruct and the engine says so, all four `blocksStatu… |
| `probe_instruct_target.js` | gate + `users` (Instruct) derivation | rc=0 | rc=0 | PASS — the instructed repeat goes back at the slot the click named, on both th… |
| `probe_lastresort_entry.js` | gate only | rc=0 | rc=0 | GREEN every claim held. |
| `probe_leechseed_silent.js` | gate only | rc=0 | rc=0 | all 4 arms clear |
| `probe_moldbreaker_ally_guard.js` | gate only | rc=0 | rc=0 | all 5 arms clear |
| `probe_noguard_invuln.js` | gate only | rc=0 | rc=0 | GREEN — every claim held over 5 staged turns |
| `probe_ohko_type_immunity.js` | gate only | rc=0 | rc=0 | PASS — an OHKO move whose type gate the target carries is announced as an immu… |
| `probe_pivot_immune_attr.js` | gate only | rc=0 | rc=0 | PASSED — every claim held |
| `probe_premajor_above_refusals.js` | gate only | rc=0 | rc=0 | PASS — the `[premajor]` line is written above a refusal that would have swallo… |
| `probe_priority_modified.js` | gate + `excReach` (printed; unchanged) | rc=0 | rc=0 | all 14 arms clear |
| `probe_reaction_address.js` | gate only | rc=0 | rc=0 | GREEN — every claim held over 5 staged turns |
| `probe_redirect_volatile_already_up.js` | gate + Rage Powder / Instruct user lists (26 / 1; unchanged) | rc=0 | rc=0 | PASS — a redirect move whose volatile is already up fails with `\|-fail\|` and… |
| `probe_refill_update_pass.js` | gate only | rc=0 | rc=0 | GREEN — every claim held over 4 staged games |
| `probe_replacement_tie.js` | gate only | rc=0 | rc=0 | PASS — two corpses on equal raw Speed refill in the order the authority's tie… |
| `probe_residual_faint_flush.js` | gate only | rc=0 | rc=0 | PASSED — every claim held |
| `probe_shield_refusal_line.js` | gate; **fixture repaired** — `roleplay-noflag` mover Lucario/Steadfast → Delphox/Blaze | rc=0 | **rc=2** (gate: `Lucario does not learn Role Play`) → **rc=0** after the repair, 7s | PASS — a shield answers `\|-activate\|<target>\|move: Protect` and writes no `-fa… |
| `probe_smarttarget_row_order.js` | gate only | rc=0 | rc=0 | GREEN every claim held. |
| `probe_spread_secondary_address.js` | gate only | rc=0 | rc=0 | GREEN — every claim held over 5 staged turns |
| `probe_spread_status_steps.js` | gate only (the two-line walk variant) | rc=0 | rc=0 | PASS — every spread status move runs each step across every target the way the… |
| `probe_state_trio.js` | gate only | rc=0 | rc=0 | DIAGNOSTIC — no pass/fail verdict is asserted here. |
| `probe_substitute_family.js` | gate only | rc=0 | rc=0 | PASS — a doll is absorbed at step 0 over every row before any row's step-1 lin… |
| `probe_substitute_roll_address.js` | gate only | rc=0 | rc=0 | GREEN — every claim held over 4 staged turns |
| `probe_syrupbomb_source_faint.js` | gate + Syrup Bomb carriers (1; unchanged) | rc=0 | rc=0 | GREEN every claim held. |
| `probe_trick_refusal.js` | gate + Trick-learners-with-stone (20; unchanged) | rc=0 | rc=0 | PASS — a Trick the authority's onHit refuses is announced as `-fail` with its… |
| `probe_yawn_substitute.js` | gate only | **rc=1** (stale scratch release, §2.2) | rc=0 | PASS — the yawn branch asks the doll, answers `-fail` on the mover, and the sl… |

### 2.1 `probe_shield_refusal_line.js` — the one set the gate now refuses

`roleplay-noflag` is the over-fire CONTROL: p1a Alakazam clicks Protect, p2a clicks Role Play at it;
Role Play carries no `protect` flag, so it must go straight through the shield with **zero**
`shieldRefusalAnnounced` on both loads. The mover was `mover('lucario', 'Steadfast', 'Role Play')`.

Why the old gate passed it — read from the rows, not recalled:

```
lucario roleplay  canLearn=false   lucario:null <- riolu:["7T","6T","5T","4T"]
```

A gen-4..7 tutor row on Riolu; no gen-9 entry anywhere on the chain. The validator says no.

Why `tests/test-fixture-legality.js` never saw it: the row is built by `mover(sp, ab, mv)` — a
construction site, outside the sweep's "declares a literal set" population. Re-run on this tree the
sweep still reports exactly the one known survivor (the differential's Incineroar Knock Off), so the
probe's own gate is the ONLY instrument that could have caught this, and it could not until tonight.

Replacement, derived: 14 legal Role Play carriers (`CS.legalRoster().filter(sp => CS.canLearn(sp.name,
'roleplay'))`: Alakazam and -Mega, Banette and -Mega, Delphox and -Mega, Greninja and -Mega, Meowstic,
Meowstic-F and both megas, Mr. Rime, Wyrdeer). Requirements: an ability that is quiet on this board and
that Role Play may overwrite, and **not Alakazam** — the target is Alakazam / Inner Focus and Role Play
refuses when `target.ability === source.ability`. Rejected for protocol: Frisk and Intimidate announce
on entry, Trace announces, Magician steals. **Delphox / Blaze** (a body batch 2 already uses in
`probe_immune_step_order.js`): Blaze is inert with no Fire move on the board. Speed is irrelevant —
Protect is +4. The arm's `what`, the header's kind table (`abilitycopy … unreachable`) and every regex
name no species. Result: `CONTROL HELD roleplay-noflag 1/1 turns`, `refusal reasons for p1a against
Role Play, NOT counting the shield: (none) [declared: none]`, whole file `13 arms staged, 0 failing`.
The premise — Role Play goes THROUGH the shield — holds on the new body.

### 2.2 `probe_yawn_substitute.js` — red before, green after, neither one mine

The probe cuts a live release of the tree under test through `tests/_live_release.js` (store redirected
to `%TEMP%\abra-live-release-store`). BEFORE: `open` threw `release 0fecb64fce0b has been MODIFIED since
it was cut: engine/medicham2-browser.js: manifest says 235dc9e79e01, snapshot is 9af4a019b8b1` — the
scratch store held a snapshot whose bytes disagree with its own manifest, which is what a cut taken
while ENGINE was mid-write to that file looks like. AFTER: ENGINE's edit had moved the tree digest, a
fresh id was cut, and the probe passed `6 arms staged, 0 failing`. The scratch release is a **torn
snapshot in a throwaway store, not mine to delete**, and it is not a fixture matter. Reported, left.

## 3. The derived casts did not move

Read-only, before any edit (`derive_cmp.js`, `derive_cmp2.js` in the session scratchpad; each defines the
old walk verbatim beside `CS.canLearn` and diffs them over `legalRoster()`):

| file | derivation | raw walk | `canLearn` | moved? |
|---|---|---|---|---|
| `probe_immune_step_order.js` | `fillerFor` — first of `[swordsdance, nastyplot, bulkup, irondefense, honeclaws, agility]` the body learns | garchomp/charizard/incineroar/kommoo/mawile → swordsdance; hydreigon/rotomfan/delphox → nastyplot; staraptor → bulkup; toxapex → irondefense | identical, all 10 | no |
| `probe_priority_modified.js` | `excReach` — a Prankster carrier learning perishsong / flowershield / rototiller | perishsong false; the other two not legal | identical | no |
| `probe_redirect_volatile_already_up.js` | legal Rage Powder users / Instruct users | 26 / 1 | 26 / 1, same names | no |
| `probe_syrupbomb_source_faint.js` | legal Syrup Bomb carriers (asserts Hydrapple) | 1 | 1 | no |
| `probe_trick_refusal.js` | Trick learners holding a legal mega stone (asserts Metagross) | 20 | 20, same names | no |
| `probe_gigaton_repeat.js` | Gigaton Hammer carriers (species' own row) | Tinkaton | Tinkaton | no |
| `probe_instruct_{lastmove_pp,shield,target}.js` | Instruct users (species' own row) | Oranguru | Oranguru | no |

`validatorThrew=0` on every run (`champions_sim.learnCounters`).

## 4. What remains, and why

**The walk idiom: 0 files** (`grep -l "e.learnset && e.learnset\[id\]" tests/*.js`).

**`getLearnsetData`: 72 files, 88 lines** (`grep -rn getLearnsetData tests/`). **None of the 72 is one
of the 37**, and none was named by the batch-2 report — it is a second idiom family with the same
source-tag defect (a raw row read on one species, sometimes with its own prevo walk). By shape:

| shape | files | what it does | note |
|---|---|---|---|
| A — one-line gate `learns`/`LEARNS = … getLearnsetData(sp).learnset[mv]` | 10: `probe_direclaw_refusal_line`, `probe_disable_pp`, `probe_faint_before_source_gone_end`, `probe_protect_stall`, `probe_recoil_on_a_corpse`, `probe_refusal_this_engine_swallowed`, `probe_shield_before_ability`, `probe_yawn_safeguard_refusal`, **`probe_residual_trio_handlerless_body`, `probe_residual_trio_lower_order_handler`** (ENGINE's, left) | gate only, species' own row, no prevo | the same one-line swap as tonight; `probe_recoil_on_a_corpse` and `probe_disable_pp` ALSO derive casts (`RECOILERS`, `chipFor`, a move list) so they are a per-file judgement |
| B — `const LS = s => (getLearnsetData(s.id).learnset)` object helper | 32 files (`probe_berserk_switcheroo` … `probe_volley_collapse`) | `Object.keys(LS(s))` to DERIVE fillers and carriers | not a sed: a move-set derivation needs `dex.moves.all().filter(m => canLearn(s, m))` and the picked body/filler may move |
| C — `learnsetOf = sp => …` | 5: `probe_ability_zero_boost_line`, `probe_charge_release_chosen_slot`, `probe_misty_terrain_status`, `probe_pivot_shield_before_ability`, `probe_thaw_on_a_corpse` | as B | as B |
| D — inline try/catch prevo walk over `cur.id` / `s.id` | 11: `probe_damaginghit_order`, `probe_hazard_lay_order`, `probe_midturn_herb_resort`, `probe_quick_claw_above_bracket_zero`, `probe_residual_shadow`, `probe_smart_target_immune_line`, `probe_smart_target_shield_line`, `probe_volatile_leaves`, `test-multihit-damage-game`, `test-switch-carry`, **`roster.js`** (forbidden) | the batch-2 defect exactly | same one-line swap where it is a gate |
| E — other | 14: `interaction_matrix.js` (raw `learnsetCache`, a shared helper), `staged_board.js` (**implements its own `_canLearn`**; `getLearnsetData` appears only in its comment), `test-game-diff`, `test-interaction-matrix`, `test-oracle-differential`, **`test-mechanics.js`** (forbidden; comments only), `probe_absorb_gift_end_on_leave`, `probe_dbond_stall`, `probe_forme_revert_silent`, `probe_hp_pair`, `probe_leaf_widening`, `probe_mega_direct`, `probe_shell_side_arm`, `probe_sucker_redirect_refusal` | mixed | per file |

So the count the brief expected — forbidden files plus a helper — is **4 + 1** (`roster.js`,
`test-mechanics.js`, the two residual-trio probes; `staged_board.js` as the helper that implements
`canLearn`), and the **other 67 are owed** under #565 as a second wave. `engine/champions_sim.js` itself
reads `getLearnsetData` (lines 442, 604, 685) inside `firstLegalMove`/`checkLegal`; that is the canonical
implementation and ENGINE's file, not a probe.

Also verified: `tests/probe_residual_trio_*.js` — untouched; ENGINE modified
`probe_residual_trio_handlerless_body.js` at 23:02 while this ran (`git status`: 38 modified test files,
37 mine). `canLearn` now appears in 82 files under `tests/`.

## 5. Edit mechanics

- Every replacement asserted an exact match count of one before writing (dry run 37/37, then apply).
- Line endings preserved per file: 18 LF and 19 CRLF on disk, each written back in its own convention.
  The `LF will be replaced by CRLF` lines `git diff` prints are `core.autocrlf` noise.
- `node --check` passed on all 37 after the sweep and after the Delphox repair.
- Net `git diff --stat tests/` for the 37: 226 insertions, 412 deletions.

## 6. Proposed RUNNING-NOTES row, CHANGELOG bullet and #565 text (NOT written)

> **2026-09-10 — MEASURE — raw-learnset sweep, #565.** The 37 probe files still carrying the
> raw-learnset prevo walk now ask `champions_sim.canLearn` (the validator's `checkCanLearn`); four of them
> also derived a cast off the species' own raw row and now derive it through the same call, with the
> carriers shown identical first (Tinkaton; Oranguru). 37 probes run before and after through
> `tools\lownode.cmd`: 36/37 green both ways. The switched gate refused ONE set the file sweep cannot
> see — `probe_shield_refusal_line.js`'s Role Play mover, Lucario, learns it only through Riolu's
> gen-4..7 tutor rows — repaired with Delphox / Blaze from the 14 derived carriers; the control still
> holds 1/1 with zero shield announcements. `probe_yawn_substitute.js` was red BEFORE on a torn snapshot
> in the live-release scratch store and green after ENGINE's edit moved the tree digest — not this
> change. The walk idiom is at zero; **`getLearnsetData` remains in 72 files / 88 lines**, a disjoint
> second idiom family (10 one-line gates, 37 learnset-object cast derivations, 11 inline walks, 14
> other), owed as #565's second wave. **Basis.** unchanged. **Supersedes.** Nothing published.

- Fixed: the remaining 37 probe legality gates now ask `TeamValidator` (`champions_sim.canLearn`) instead
  of walking raw learnset rows that accepted pre-gen-9 source tags; four cast derivations moved with them.
- Fixed: `probe_shield_refusal_line.js` clicked Role Play from a Lucario the format refuses; the control
  now runs on Delphox / Blaze, derived, and holds.
- Notes: `getLearnsetData` still read raw in 72 `tests/` files (second idiom family, none among the 37);
  `tests/probe_yawn_substitute.js` hit a torn snapshot in `%TEMP%\abra-live-release-store` once.

**#565 status text:** *Wave 1 closed 2026-09-10: the `e.learnset && e.learnset[id]` prevo walk is at 0 in
`tests/` (13 files in batch 2 + 37 in the sweep), one illegal control fixture surfaced and repaired.
OPEN for wave 2: 72 files read `getLearnsetData` raw — 10 one-line gates (8 ours, 2 ENGINE's), 37
`Object.keys(learnset)` cast derivations that need a `canLearn`-filtered move walk, 11 inline prevo walks,
14 mixed; `roster.js`, `test-mechanics.js` and `interaction_matrix.js` are their owners' calls.*

---

## OWED, NOT RUN

1. **Wave 2 of #565 — the 67 non-forbidden `getLearnsetData` files** (§4). Shapes A and D are the same
   one-line swap; shapes B and C DERIVE move sets from `Object.keys(learnset)` and need
   `dex.moves.all().filter(m => legal(m) && CS.canLearn(sp, m))` — which may move a filler or a body, so
   each is a before/after with the cast printed, not a sed.
2. **The torn snapshot in `%TEMP%\abra-live-release-store` (`0fecb64fce0b`)** — a scratch store I did not
   create; `tests/_live_release.js` should probably re-cut on a failed `verify` rather than throw, since a
   cut taken while ENGINE writes the simulator is not rare tonight. Reported, not touched.
3. **Constructed fixtures are outside the sweep's population.** `mover(...)`, `mon(...)` and their
   siblings are how `Lucario / Role Play` survived batch 2 with a green sweep beside it. Extending
   `fixture_legality.js` to resolve construction helpers, or asserting every probe carries a `canLearn`
   gate, would make this class visible to one instrument instead of 37.
4. **RUNNING-NOTES row, CHANGELOG bullet, `status.js --write`, commit** — forbidden this wave; proposed
   text in §6.
