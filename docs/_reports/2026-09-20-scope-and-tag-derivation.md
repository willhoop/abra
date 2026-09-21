# Two defects that were OURS: the scope authority never asked, and a tag was derived from prose

**Date.** 2026-09-20. **Division.** ENGINE. **Status.** Findings record — historical by construction,
never cited as current state (CLAUDE.md, `docs/_reports/` rule).

Both were found by the first Reg M-C run (`docs/_reports/2026-09-20-regmc-first-run.md` §2 and §5) and
both are latent in Reg M-B. Neither is a change to the game.

Inputs, stated so every figure can be reproduced:

| | |
|---|---|
| M-B authority, PINNED | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4` |
| M-C authority | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` `f10d6798f2ba5af92e55892c8c7063ca7b53c18a` |
| neither checkout | pulled, built, or modified. No git command was run against either. |
| worktree | `.claude/worktrees/agent-a1ef03d008104552d` |

---

## 0. The verdict in one table

| | |
|---|---|
| **Scope authority** | `engine/legal_scope.js` now puts every `Future`-flagged candidate to the `TeamValidator` and re-admits on an accept. Two caller-side filters in `engine/tag_dex.js` that re-decided scope were removed. |
| **Tag derivation** | The two `move.shortDesc` reads are gone. `engine/screen_tags.js` derives the screen set, the halved CATEGORY and screen-breaking membership from the handler bodies and condition objects. |
| **M-B** | Unchanged, measured with a cleared control both ways. Scope `845 of 964` before and after; `data/tags.json` identical in membership and params. |
| **M-C** | `auraguard` is `CARRIED` and in scope; the screens derive `Physical` / `Special` / `both` and the three screen-breakers keep the tag, with every description absent. |
| **`data/tags.json`** | **Does NOT need regenerating.** Proved by a regenerate-and-diff, below. |
| **probes** | `0` clean / `1` under each knob, on both checkouts. Exit codes in §4. |
| **census** | `1002 → 1003` probed, `1002 → 1003` live, `0` missing, `0` hollow, `run_ok: true`. |

---

## 1. DEFECT 1 — the scope authority answered `NOT-LEGAL` without asking

### What it was

`engine/legal_scope.js` is the single authority on what is in scope; `engine/coverage.js` (the
denominator), `engine/stage_planner.js` (the fixtures) and `engine/tag_dex.js` all defer to it. It
built its candidate list with CLAUDE.md's strict filter and returned `NOT-LEGAL` for anything the
filter rejected — including `isNonstandard: 'Future'`.

Reg M-C carries exactly such an ability, with a real body:

```
auraguard.onSourceModifyDamage(damage, source, target, move) {
  if (move.flags["contact"]) return this.chainModify(0.5); }
```

Its sole carrier is `lucariomegaz` (`isNonstandard: null`, `tier: Uber`), reached as **Lucario @
Lucarionite Z**, and the M-C `TeamValidator` accepts that set. Under the old filter it got no row in
`data/tags.json`, no probe and no roster stage, **while coverage reported FULL** — a capability
absent with everything reporting success.

### The rule applied

Will, 2026-09-20: *"lets use the showdown team validator again for reg mc"*. The strict filter stays
and is still right for a bulk walk; its output is now a CANDIDATE list, and every `Future` entry is
put to `champions_sim.checkLegal` in the set it is actually reached through (a mega as its base
holding the stone, a battle-only forme as its `battleOnly` base). One implementation, in the one
authority, so every caller inherits it.

### The over-match this would have been, measured before it was wired

Naively re-admitting the marker widens Reg M-B. On the pinned M-B authority `absolmegaz` and
`garchompmegaz` **are** legal species, so the existing `HELD` rule — which never asks a validator —
would have put **Absolite Z** and **Garchompite Z** in scope while the validator answers *"Absol's
item Absolite Z does not exist in Gen 9."* So Future moves and Future items get an explicit validator
gate rather than inheriting `LEARNED` / `HELD`.

### What the authority now prints, on every derive

M-B, all 20 refused — **and the refusals are the validator's own words**:

```
legal_scope: 20 `Future`-flagged candidate(s) in gen9championsvgc2026regmb put to the
  TeamValidator (species 11, ability 0, move 1, item 8)
  RE-ADMITTED: none — all 20 refused, first: species:heatranmega
               "Heatran (Heatran-Mega) does not exist in Gen 9."
```

M-C:

```
legal_scope: 15 `Future`-flagged candidate(s) in gen9championsvgc2026regmc put to the
  TeamValidator (species 9, ability 1, move 1, item 4)
  RE-ADMITTED: ability:auraguard <- Lucario @ Lucarionite Z
```

The full per-candidate table (`RE-ADMITTED` / `refused` + the problem string) prints when the module
is run as main, and is carried on `S.future` for any caller.

### M-B is unchanged, with a cleared control

| | in scope | species | moves | abilities | items |
|---|---|---|---|---|---|
| **fixed** | **845 of 964** | 347 | 497 of 500 | 200 of 316 | 148 of 148 |
| **`ABRA_SCOPE_STRICT_FUTURE=1`** (pre-fix) | **845 of 964** | 347 | 497 of 500 | 200 of 316 | 148 of 148 |

M-C, same pair: `892 of 998` with **215** abilities in scope against **214** under the knob, and
`verdict('ability','auraguard')` moving from
`{"inScope":false,"code":"NOT-LEGAL"}` to `{"inScope":true,"code":"CARRIED"}`. The instrument could
have shown a difference on M-B and did not; it showed one on M-C.

### The two caller-side filters that made "every caller inherits it" false

`engine/tag_dex.js` dropped the ability **twice more**, before the authority was consulted:

- `LEGAL_CARRIED` (`if (!a || !a.exists || a.isNonstandard) continue;` **above** the `SCOPE_V.verdict`
  call) — the marker test now removed; a `Past` ability is still excluded because it is not a
  candidate, so `verdict` answers `NOT-LEGAL`.
- `collect()` (`if (!o || !o.exists || o.isNonstandard) continue;`) — now
  `if (!SCOPE_V.isLegal(kind, o.id || o.name)) continue;`.

**Non-widening is proved, not asserted.** `tests/probe_future_scope_readmission.js` clause 4 walks
954 moves, 320 abilities and 583 items and asserts `isLegal(kind,id)` equals the old strict test
everywhere except on a re-admitted id — **0 disagreements** on both checkouts.

### Still deciding scope their own way, reported and not touched

`engine/all_mechanics_fire.js` and `tests/roster.js`, both already named in `legal_scope.js`'s own
header and in `docs/_reports/2026-09-11-scope-unified.md`. Out of this brief's scope.

---

## 2. DEFECT 2 — two tag predicates read a human-readable string

### What it was

`engine/tag_dex.js` read `move.shortDesc` at two sites. Reg M-C's checkout ships with every Champions
description removed (upstream `02bb2ae Remove redundant Champions descriptions`):

```
reflect      M-B "For 5 turns, physical damage to allies is halved."   M-C ""
lightscreen  M-B "For 5 turns, special damage to allies is halved."    M-C ""
brickbreak   M-B "Destroys screens, unless the target is immune."      M-C ""
```

`/physical/i.test('')` is false and so is `/special/i.test('')`, so both screens fell through to the
`'both'` DEFAULT and **Reflect halved a Moonblast** in the smoke run; `clearsScreens` required
`/reflect|screen|veil/i` on the same empty string, so Brick Break, Psychic Fangs and Raging Bull
silently lost the tag. The engine reads the category — `screenCat` / `screenUp` in
`engine/medicham2-browser.js` read `TAGS.param('move', id, 'halvesDamage').category` — so this is
board-material, and it is our derivation.

### The structure it is derived from instead

- **What a screen IS**: a side condition whose own `condition` object carries a damage-modifying
  handler. Derived, not listed: Safeguard writes `onSetStatus`, Mist `onTryBoost`, Tailwind
  `onModifySpe`, Lucky Chant `onCriticalHit` — none of them qualifies. Both checkouts derive
  `{auroraveil, lightscreen, reflect}`.
- **Which category one halves**: the condition's own gate,
  `this.getCategory(move) === "Physical"` / `"Special"`. Aurora Veil names both, inside a bail-out
  that defers to whichever of the two is already up, so it restricts to neither. The rule is "the
  handler gates on exactly one category, or it does not restrict", which reads the same however the
  conjunction is ordered.
- **What takes one down**: a screen named as a STRING LITERAL argument of `removeSideCondition`.

### The membership decision that is stated rather than absorbed

**Defog and Tidy Up build a list and loop it** (`const removeTarget = ["reflect", "lightscreen",
"auroraveil", "safeguard", "mist", ...removeAll]`), so they name no screen at the call site and do not
match. Defog does clear screens in this format — and it carried **no `clearsScreens` row before this
change either**, because its description holds no screen word. Membership is therefore unchanged in
both directions. Widening to the loop form is a MEMBERSHIP change and belongs to its own pass, where a
moved count cannot be confused with this one. The probe prints both non-members every run.

### The derivation agrees with the description present and absent

`tests/probe_tag_derivation_without_prose.js` runs every legal move through `engine/screen_tags.js`
twice: once as itself, once through a shallow copy with `shortDesc` and `desc` blanked. (A Proxy
cannot do it — a `DataMove` is frozen, so the `get` trap throws rather than returning `''`. The
blinding arm is proved by its own clause before clause 2 reads it.)

| | M-B `20ad99f` | M-C `f10d679` |
|---|---|---|
| screen set | `auroraveil, lightscreen, reflect` | `auroraveil, lightscreen, reflect` |
| categories | `reflect Physical, lightscreen Special, auroraveil both` | **identical** |
| `clearsScreens` | `brickbreak, psychicfangs, ragingbull` | **identical** |
| moves whose answer MOVED when blinded | **0 of 500** | **0 of 515** |
| descriptions present on that checkout? | yes | **no — all `""`** |

Under `ABRA_TAGDEX_SCREENS_FROM_PROSE=1` the same probe goes red on **both** checkouts, by different
clauses, which is the defect stated twice:

- **M-B** — clause 2, five rows move when the description is blanked:
  `brickbreak / psychicfangs / ragingbull  clearsScreens {"clears":"screens"} -> null`,
  `reflect Physical -> both`, `lightscreen Special -> both`. Exactly the five rows the M-C run
  reported.
- **M-C** — clause 3 (the cleared control), because present and absent are trivially equal when both
  are empty: `auroraveil -> both, lightscreen -> both, reflect -> both` and
  `MEMBERSHIP clearsScreens: (none)`.

---

## 3. `data/tags.json` — measured, not assumed

The live artifact already carries the structural answer: `clearsScreens n=3`
(`brickbreak 1,047 / psychicfangs 3,610 / ragingbull 118` uses), `halvesDamage n=3`
(`reflect Physical 5,690 / lightscreen Special 7,539 / auroraveil both 4,169`).

Proved rather than eyeballed: `data/tags.json` was backed up, regenerated with the fixed
`engine/tag_dex.js`, compared on membership and params only, and restored with
`git checkout -- data/tags.json` (md5 `d680f2eb40feed77b3677d9069f05b72` before and after).

```
LIVE generated 2026-09-20T05:08:44.844Z  sheet_entries 316656
NEW  generated 2026-09-21T01:54:55.701Z  sheet_entries 0
  moves: 500 rows compared, 500 live / 500 new
  items: 148 rows compared, 148 live / 148 new
  abilities: 201 rows compared, 201 live / 201 new
NO membership or param difference — the artifact does not need regenerating
```

**AND THE WORKTREE HAZARD IS CONFIRMED, WITH A NUMBER.** `sheet_entries` went `316656 -> 0`: the store
shards live only in the main tree, `tag_dex` catches the `ENOENT`, zeroes every usage figure and exits
`0`. It printed `0 sheet entries of real teams for the usage weighting` in the middle of a run that
otherwise looked perfect. **Nothing regenerated in a worktree may be kept.** That regenerated file was
not kept.

A guard now stands where the write is. `tag_dex.js` `TAGDEX_BREAK` refuses to write `data/tags.json`
under any declared restore knob and says which one. This does NOT belong in
`tests/test-mechanics.js`'s `DELIBERATE_BREAK`: that list is `.filter(k => M.fails[k])` over
`MEDFAILS`, the SIMULATOR's stamp object, and a knob in the tag derivation sets nothing in it — a name
added there would be inert decoration on a load-bearing list. Demonstrated: the `ABRA_SCOPE_STRICT_FUTURE=1`
dry run above left `data/tags.json` at the same md5.

---

## 4. Exit codes, pasted

```
# DEFECT 2 — the tag derivation
SHOWDOWN_PATH=.../pokemon-showdown    node tests/probe_tag_derivation_without_prose.js   EXIT=0
ABRA_TAGDEX_SCREENS_FROM_PROSE=1 ...  node tests/probe_tag_derivation_without_prose.js   EXIT=1
SHOWDOWN_PATH=.../pokemon-showdown-mc node tests/probe_tag_derivation_without_prose.js   EXIT=0
ABRA_TAGDEX_SCREENS_FROM_PROSE=1 (M-C)                                                   EXIT=1

# DEFECT 1 — the scope authority
SHOWDOWN_PATH=.../pokemon-showdown    node tests/probe_future_scope_readmission.js       EXIT=0
ABRA_SCOPE_STRICT_FUTURE=1 ...        node tests/probe_future_scope_readmission.js       EXIT=1
SHOWDOWN_PATH=.../pokemon-showdown-mc node tests/probe_future_scope_readmission.js       EXIT=0

# regressions
node tests/test-stage-planner.js      GREEN  (clause oneScope included)          EXIT=0
node tests/probe_simple_beam.js       all checks passed                          EXIT=0
node tests/probe_descriptive_tags.js  ALL CLAUSES PASS                           EXIT=0
node engine/coverage.js                                                          EXIT=0
node tests/walk_tags.js   AGREE 6 DIVERGE 10 NOT COVERED 5 SKIP 19 — byte-identical to the
                          committed artifact apart from its timestamp; reverted.  EXIT=0
node tests/test-mechanics.js          1003 live, 0 missing, 1003 probed, 0 hollow EXIT=0
```

The two M-C arms required `data/regulations.json` flipped to `active: "regmc"` **in this worktree
only** — `CS.FORMAT` is a load-time constant and there is no `--format` flag
(`docs/_reports/2026-09-20-regmc-first-run.md` §1a, still open work). It was restored from a
byte-identical backup each time; md5 `bff21cabb8ccd066e93062a2ff2205ec` before and after, and
`git status` shows it unmodified.

---

## 5. The census row

`probe('move', 'halvesDamage', 'Reflect does NOT halve a SPECIAL attack')`, quoting
`reflect.condition.onAnyModifyDamage`'s literal `this.getCategory(move) === "Physical"`.

```
SPECIAL (earthpower): 72 with no screen -> 72 behind Reflect — it must NOT move.
CONTROL, same attacker and type, PHYSICAL (earthquake): 168 -> 112 — it must.
screens up on the special arm: [reflect]
```

Three arms, because two would not clear the control: an engine that ignored screens altogether, or
one whose Reflect never went up, passes "the special damage did not move" by doing nothing. The two
moves' categories are read out of `MC.moves` (`{"t":"Ground","c":"S"}` / `{"t":"Ground","c":"P"}`)
rather than trusted, so a fixture that picked two physical moves reports itself broken instead of
reporting the mechanic live.

**The `arms` are the PHYSICAL pair, deliberately.** The first version handed in the special pair and
`test-mechanics.js`'s own hollow detector flagged the row (`works && armsAgree(arms)`) — correctly,
because two equal numbers are satisfied by an engine that does nothing. Here the equality is the
CLAIM, so the arms carry the pair that must move. First run: `1003 live, 1 hollow, run_ok:false`;
after the change, `1003 live, 0 hollow, run_ok:true`.

**DEFECT 1 GETS NO CENSUS ROW, AND THAT IS DELIBERATE.** On the pinned M-B authority the validator
refuses all 20 `Future` candidates, so there is no M-B mechanic to stage. A census row for it would be
a fiction.

---

## 6. Files

| file | what |
|---|---|
| `engine/legal_scope.js` | the candidate list, the validator gate, `S.future` / `S.futureReadmitted`, the print |
| `engine/screen_tags.js` | **new** — the screen set, the halved category, the screen-breakers, all structural |
| `engine/tag_dex.js` | the two sites now call `screen_tags`; two caller-side scope filters removed; `TAGDEX_BREAK` |
| `tests/probe_future_scope_readmission.js` | **new** — 5 clauses; knob `ABRA_SCOPE_STRICT_FUTURE` |
| `tests/probe_tag_derivation_without_prose.js` | **new** — 4 clauses; knob `ABRA_TAGDEX_SCREENS_FROM_PROSE` |
| `tests/test-mechanics.js` | the new census row |
| `data/mechanics-census.json` | regenerated: 1003 / 1003 / 0 |

## 7. Housekeeping, reported and not acted on

- `data/regulations.json` was flipped and restored, twice; `data/tags.json` was regenerated for the
  §3 comparison and restored from git; `data/tag-walk.json` moved only its timestamp and was
  reverted. `git status` carries exactly the seven files in §6.
- Probe scratch is in the session scratchpad at `…/scratchpad/sc/`.
- `cmd /c 'tools\lownode.cmd …'` is still refused outright for a worktree-isolated agent, as the
  first M-C run reported. The equivalent was obtained with
  `os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL)` inside the node process for the
  two census runs and the two `tag_dex` runs. The lownode rule and worktree isolation remain
  incompatible; that is a routing item, not an engine one.
