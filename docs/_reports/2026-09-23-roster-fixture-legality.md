# The roster's two ruler defects: the text proxy, and fixture legality. 2026-09-23 (ENGINE, abra/regmc 0.71.0)

Light mode. No game was played by this pass except the rules' own control proofs inside `assign` (13 per sweep, see
"What was run"). No roster stage, differential, census, `quarantine.js` or `status.js` was run: another ENGINE agent
was playing games. Worktree branch `worktree-agent-a3f1e91545d33b1ee`, based on main `7fa84fe6`. No file under
`engine/` moved, so releases `89ac57f1f81b` (Reg M-B) and `485d0a6840ad` (Reg M-C) still describe the engine bytes.

## Verdict

| | before (HEAD) | after |
|---|---|---|
| Reg M-B refused fixture sets (items / abilities / moves / rule-built) | 17 / 77 / 47 / 2 | **0 / 6 / 3 / 2** |
| Reg M-C refused fixture sets | 17 / 80 / 47 / 2 | **0 / 7 / 3 / 2** |
| Reg M-B abilities staged | 192 on the throwing proxy (7 COULD-NOT-STAGE) | **199** |
| rows that stopped staging, either regulation | — | **0** |

No mechanic in either regulation is carrier-less. Every refusal that is left has a legal carrier for its mechanic. What
fails is a part of the instrument, in four named ways (below). None was baselined, and the legality check was not
changed.

## 1. The text proxy (7 abilities COULD-NOT-STAGE under Reg M-B)

- **Cause, read off the checkout.** Reg M-B's checkout carries 16 Hidden Power typings whose `desc` / `shortDesc` are
  frozen own properties holding `''`. Nihil Light is the 17th, and it has no text at all. Its text table holds "Varies
  in type based on the user's IVs." A Proxy may not report another value for a non-configurable, non-writable
  property, so the first read threw. Every shape rule that walks `moves.all()` threw with it.
- **Fix.** The view moved to `tests/roster_text_view.js`. An entity whose text is a frozen own property is left
  unwrapped and is **counted** in `kept`. `tests/roster.js` prints that count on every run beside `TEXT_FILLED`.
  Every other entity is wrapped exactly as before. Reg M-C carries no own text property on any entity (measured: 954
  moves, 583 items and 321 abilities), so it is unchanged there.
- **Guard.** `tests/test-roster-text-view.js`, which plays no game.
  - Clause D: a synthetic dex still fills text, and the `×` sign is still normalised.
  - Clauses A to C: 16 frozen entities exist under Reg M-B. A naive Proxy over one of them throws (the control). All
    1,857 entities read through the view. Each frozen entity comes back unwrapped with its declared value and is
    counted.
  - **Shown red on a deliberate break** (guard removed): 3 clauses FAIL with the exact proxy error. It is green with the
    guard. Under Reg M-C, A to C print NOT APPLICABLE, and D passes.
- **Result.** Iron Fist, Mega Launcher, Reckless, Sharpness, Strong Jaw, Technician and Tough Claws all stage again
  (`ability/base-power-scoped`). Measured by a staged-map diff against HEAD's `tests/roster.js`.

## 2. Fixture legality

**The instrument.** `tests/probe_roster_fixture_legality.js` (new). It builds every arm that `runEntry` plays:
subject, control, the second control and the trap-exception arms. It does this through `assign`, `controlOf` (now
exported) and `withLegalInert`. It then puts the first four bodies of each side (`PAIR_BODIES`) through
`fixture_legality.checkSet`. That is the same judge `buildPair`'s runtime hook uses. The probe also reads the hook's
store for the sets the rules build inside `match()`. On HEAD it reproduces the roster receipts **exactly**: Reg M-B
17 / 77 / 47, and Reg M-C 17 / 80 / 47. `--strict` exits 1 on any refused set. `--json` writes every refused set, with
its arm and rule.

**What was repaired, by class** (the counts are distinct refused sets, as the gate counts them):

| class | cause | repair |
|---|---|---|
| **control click kept on Focus Energy** (most of the 141) | something on the fixture can sleep a body, so `inertChoice` keeps Focus Energy, and holders that do not learn it are refused | (a) the restaging pass runs twice: after the ordinary pass, if the click stays Focus Energy, a holder that cannot learn it is swapped (bench bodies, and leads with no other option) for a learner through the same tiers. (b) `withLegalInert` resolves the idle click **per body** where it has to: a holder that cannot learn the scenario's click idles on Sleep Talk if that is inert ON THAT BODY. That means the body declares no other move (Sleep Talk fails with nothing to call — `if (!randomMove) return false;`), or nothing else on the board can write sleep. The script follows the body through scripted switches. A per-body substitute on an asleep body is watched (`INERT_SUB_SLEPT`). Knobs: `ROSTER_FE_UNREPAIRED=1`, `ROSTER_IDLE_PER_BODY=0` |
| move-stage clicker (Goodra-Hisui learns none of 18 status moves) | `CLICKER` is one body per arm | `clickerFor` / `quietLearner`, and the berry, stat-stage, generic-status, heal, Healing Wish and Wish rules pick a learner |
| protect negative (Beedrill) | the partner carried a move it cannot learn and never clicks | it carries it only where it learns it |
| ability carriers' own clicks (Guts, Huge Power, Hustle, Pure Power, Solar Power, Anticipation, Forewarn, Fairy Aura, Natural Cure, Regenerator, Quick Draw) | table moves handed to carriers | the carrier's own neutral clicks of the same category, a legal partner, a plain switch for a carrier with no pivot move, and `lethalMove`'s `by` |
| Shadow Tag exception arms (Charizard / Weavile) | pivot and phaze bodies that cannot learn the move | a non-Ghost legal learner, and `throwerFor` for the phazer |
| Focus Band (Rhyperior "can't have Guts") | the ability of `KILL_ATT` was put on the widened attacker | the ability of the body that actually throws |
| Big Root (Bitter Blade) | the strongest drain in the format, which neither the bag nor Snorlax learns | the strongest drain that the holder and a partner both learn, and that the aggressor is not immune to |
| Merciless (Toxapex, its only carrier, learns no Focus Energy) | the blanket rule that "a crit entity keeps Focus Energy" | the rule derives `ret >= 4 && 1 + INERT_RAISES_CRIT_STAGES < 4` on the primary pin, so the idle click's stages cannot move the row (`critStagesUnread`) |
| Imposter (Ditto learns only Transform) | the entry kind's trailing idle turn | a carrier that learns no control click only switches, and the fixture ends at its re-entry |
| Limber (carrier Ditto) | the same | the status-refusal rule skips a carrier that can hold no control click |
| Focus Energy's own row | no legal species learns Focus Energy **and** Magnet Rise | the control uses the substitute where every body learns it and nothing can sleep |

**Churn is limited to rows that held a refused set.** A rule-level "legal first" choice made for every row changed 56
move fixtures under Reg M-B that the restaging pass had already made legal. So those choices sit behind
`LEGAL_FIRST`. `assign` raises that flag for one re-match of a row whose restaging left an UNRESOLVED pair. It keeps
the re-match only if it leaves fewer unresolved pairs, and stamps `legal_first` on the row (also written into the
artifact). Knob: `ROSTER_LEGAL_FIRST=0`. Measured by a staged-map diff against HEAD (fixture bytes hashed per row):

| | fixtures changed (all rows that held refused sets) | unchanged | lost staging | gained |
|---|---|---|---|---|
| Reg M-B | items 7, abilities 25, moves 32 | 141 / 167 / 465 | **0** | 7 (the proxy rows) |
| Reg M-C | items 8, abilities 24, moves 31 | 158 / 189 / 480 | **0** | 0 |

An earlier cut of this pass made the Skill Swap lender legal-only and applied the legal-first picks to every row. It
**lost the staging of 17 ability rows in each regulation and of 6 (Reg M-B) / 7 (Reg M-C) move rows**. Most were the
lender's MEGA- and SUPPRESS-tier rows; the rest were over-eager legal-first picks (prankster, hustle, recover, roost,
slackoff, healbell, reflecttype, transform and, under Reg M-C, simplebeam). The same diff caught it, and it was
reverted. A row that stops staging is not a repaired row.

**Other instruments.** `tests/probe_roster_learnset_refusals.js` reads GREEN under both regulations (0 refused pairs,
releases `89ac57f1f81b` and `485d0a6840ad`). `tests/probe_roster_inert_legality.js --strict` reads 0 control-click
refusals under both regulations. It read 58 on 2026-09-19, and its PENDING_WIRE entry in `tests/run-all.js` now says
so. It is **not wired**, because `run-all` could not be run in this pass.

## 3. What is still refused, by name, with the validator's message

None of these is carrier-less. Each is a limit of this instrument's fixture shape, so none belongs out of scope under
`engine/legal_scope.js`. Each still counts against the roster clause.

1. **The in-play Skill Swap lender** (control arms of every swap-controlled ability row: 84 rows under Reg M-B and 90
   under Reg M-C; the dedupe shows 6 and 7 distinct sets, plus 2 in `proof/swap-control`). Validator: *"Goodra-Hisui
   can't learn Skill Swap."*, *"Glimmora can't learn Skill Swap."*, *"Torterra can't learn Skill Swap."*, *"Torkoal
   can't learn Skill Swap."*, *"Samurott can't learn Skill Swap."*. **Asked of the format, under both regulations: no
   legal species that holds a quiet ability learns Skill Swap.** The holders are Kangaskhan, Houndoom, Torkoal,
   Torterra, Samurott, Goodra-Hisui, Salazzle, Falinks and Glimmora, and each is refused. So this control shape has no
   legal form in either regulation. That is a **decision** (MEASURE / Will), not a repair: accept the refused
   control-arm set, or build another control shape. Insomnia's lender also cannot learn Focus Energy (*"Glimmora
   can't learn Focus Energy."*). No Corrosion holder learns it (Salazzle and Glimmora are refused).
2. **Heal Bell.** *"Goodra-Hisui can't learn Heal Bell."* The move's one legal learner is Chimecho. Its only ability is
   Levitate, which the quiet pools exclude (it changes what can be staged against the body). The old body stands.
3. **Roost** (a HELD row). *"Torkoal can't learn Roost."* No quiet move-stage body learns Roost within the heal
   rule's chip band. The old body stands.
4. **Transform.** *"Goodra-Hisui can't learn Transform."* The one legal learner is Ditto, which learns nothing else,
   so it can neither chip nor idle. The old body stands.

## What was run

- The legality sweep, 12 times across both regulations, through `tools\lownode.cmd` (an argument-vector spawn). Each
  sweep runs `assign` for three stages. Inside `assign` the rules play their own control proofs (Skill Swap,
  crit-lands and so on): **13 proof games per sweep**, counted by the new `playCalls()` export and printed. They write
  no artifact. No roster arm was played.
- Staged-map diffs against `git show HEAD:tests/roster.js`, which was copied to a temporary `tests/_roster_head_tmp.js`
  and deleted afterwards. These ran as plain `node`, not through lownode, for about 2 minutes each.
- `tests/test-roster-text-view.js`, under both regulations. The learnset-refusal and inert-legality probes, as above.
- Release directories `89ac57f1f81b` and `485d0a6840ad` and `data/engine-release-regmc.json` were **copied** from the
  main checkout into this worktree so that the roster could open them. The releases are git-ignored.
  `data/engine-release-regmc.json` is untracked in main as well and was not committed.

## OWED, NOT RUN

Run after the other ENGINE agent finishes, one at a time, through the wrapper (from Bash, use an argument-vector
spawn of `cmd.exe /c tools\lownode.cmd ...`). The engine bytes are unchanged, so the gate's releases still apply:

```
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown   tools\lownode.cmd tests/roster.js --stage items     --reds --write --release 89ac57f1f81b
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown   tools\lownode.cmd tests/roster.js --stage abilities --reds --write --release 89ac57f1f81b
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown   tools\lownode.cmd tests/roster.js --stage moves     --reds --write --release 89ac57f1f81b
ABRA_REGULATION=regmc SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc tools\lownode.cmd tests/roster.js --stage items     --reds --write --release 485d0a6840ad
ABRA_REGULATION=regmc SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc tools\lownode.cmd tests/roster.js --stage abilities --reds --write --release 485d0a6840ad
ABRA_REGULATION=regmc SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc tools\lownode.cmd tests/roster.js --stage moves     --reds --write --release 485d0a6840ad
```

- **Expect**:
  - `fixture_legality.not_baselined` at 0 / 6 / 3 (+2 rule-built) for Reg M-B and 0 / 7 / 3 (+2) for Reg M-C.
  - The 7 proxy abilities back to MATCH under Reg M-B (they were MATCH on `2e9db8bb11fd`).
  - The printed `left unwrapped` count at `{"moves":16}` under Reg M-B and zero under Reg M-C.
- **Read every changed row's verdict** (the fixture-changed lists above). A repaired fixture was built without playing
  it, so a row may now read COULD-NOT-STAGE (inert) or change its red-demonstration outcome. This matters most for the
  HELD rows (belch, bugbite, pluck, recycle, wish, healingwish, quickdraw), which were held because an earlier legal
  restaging did not stage. If one does not stage, revert that rule to its old body (`ROSTER_LEGAL_FIRST=0` for the
  whole pass) and record it. Do not trade a staged row for a legal one.
- **Then read both gates**: `tools\lownode.cmd engine/quarantine.js`, and the same with `--regulation regmc`.
- **Decision owed (MEASURE / Will): the Skill Swap lender.** No legal form exists in either regulation (§3.1).
- **Wire `tests/probe_roster_inert_legality.js --strict` into `tests/run-all.js`.** Its residue is 0 in both
  regulations.
- **The status stamps** (`node engine/status.js --write`) were not run, because `status.js` was barred in this pass.
  They are owed after the roster stages.
