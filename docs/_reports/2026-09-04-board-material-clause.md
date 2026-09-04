# The whole-game gate now counts boards, and narration got its own clause

2026-09-04, ENGINE. Owned file: `engine/quarantine.js`. Nothing committed.

Will's ruling, CLAUDE.md 2026-08-22: **board-material now, narration as its own separate gate
afterwards**, chosen so the narration work is not silently abandoned once quarantine lifts. The
clause gated on `j.diverged` — protocol first-divergence — and never computed the quantity the
ruling names.

## What the numbers were and are

Read off `data/game-differential.json`, release `8ad06030e129`, generated 2026-09-04T02:01:07Z,
961 games, arm `A/middle`, empirical driver, pool `fixture`-free (the real frozen pool), snapshot
copied to the scratchpad before reading so a concurrent rewrite could not tear it.

| clause | quantity | reads | gates |
|---|---|---|---|
| `whole-game differential / BOARD-MATERIAL — games whose boards part` | `state.games` − `state.games_board_never_diverged` = 961 − 884 | **77 of 961 (8.0%)** | **yes** |
| `whole-game differential / NARRATION — protocol first divergence` | `j.diverged` less declared/cleared | **167 of 961 (17.4%)** (168 raw, less 1 declared) | no |

Before this change the single clause printed **167 of 961** and nothing computed 77.

## Does narration hold the gate shut? No — and that is not dropping it

`gates: false`, applied by a wrapper to **every** return path of `narrationClause`, including the
refusals. It still gets a clause row, a count, a `quantity` field, a place in `failing`, and its own
command `node engine/quarantine.js --narration` which exits 1 while it is red.

The failure this project actually has is a real finding going **unread** — the fourteen stale
handoffs, the ban list of four, `PRE-CHANGE` printed as a caption. Every one of those was something
nobody printed, or printed as an annotation on a figure. This is the opposite shape: computed by the
shipping clause on every run, printed on its own line with the word NARRATION in it, exported as
data, exiting non-zero on its own. What it does not do is block — which is precisely what Will took
off the critical path, and re-adding it here under a different name would be overriding him.

**What that costs, said plainly:** a regression that adds only protocol divergences — new narration,
identical boards — will no longer hold the gate shut. That is the deliberate content of the ruling.
It is the reason the narration row prints its count on a passing run as well as a failing one.

The wrapper matters more than it looks. In the first draft only the final verdict carried the flag,
so a **stale or torn** artifact would have made narration come back WITHHELD with no `gates` field,
default to gating, and hold the quarantine gate shut on a quantity nobody had chosen to gate on.
Two selftest arms assert the flag survives both refusal families (the pin door and the planted-proof
exit).

## The uncaused set — the failure mode of this change, named

A game whose protocol divergence closes while its board still parts has **nothing in the narration
pointing at it**: no cause, no class, no shape, nothing to grep.

**The split makes them visible; it does not hide them.** Under the single clause such a game left
the count altogether — a fix could improve the headline while making the engine no more correct.
The board clause counts them and names them as a distinct kind:

```
UNCAUSED — 11 of the 77 game(s) part a BOARD while the protocol NEVER diverges at all
(77 less 66 whose protocol also parted: 168 protocol divergence(s) less 102 whose board never did).
```

Derived from four artifact fields, named as derived, and **not clamped** — a negative result is
reported as the artifact contradicting itself, because `Math.max(0, …)` there would turn a broken
instrument into a clean bill of health. There is a red arm for that.

Six of the eleven have a worked example in the artifact's `first_board_divergences` sample (which is
40 rows of the 77 — labelled as a sample, never as the list), and they are printed with their leaf
paths:

```
turn 5  …2655542565   p2.party.morpeko.species
turn 9  …2635542983   p2.active[1].vol.choicelock
turn 7  …2635517567   p1.active[0].vol.charging
turn 7  …2660414382   p1.active[1].stall
turn 9  …2635949496   p1.active[0].stall
turn 5  …2635567134   p2.party.aegislash.species
```

The Morpeko row is the one CLAUDE.md already records as the INSTRUMENT (`freshBodies` dropping
`_switchKey`), not the game. The other five are not classified here.

## Red first — the proof

`node engine/quarantine.js --selftest`: **186 passed / 0 failed before → 210 passed / 0 failed now**
(+24 arms).

Three deliberate breaks, each restored:

| break | arms red |
|---|---|
| `wholeGameClause` returns the narration verdict (the behaviour that shipped until today) | **13** |
| `Math.max(0, material − bothParted)` — clamping the uncaused count | 1 |
| `gateVerdict`: `gating = clauses` — narration back on the gate | 2 |

The two required opposite arms, both driven through the shipping functions on injected artifacts:

- **ARM A** — 12 boards part, `diverged: 0`, protocol never diverges: **board clause FAILS,
  narration clause PASSES**.
- **ARM B** — `diverged: 40` across a real cause shape, every board identical: **board clause
  PASSES, narration clause FAILS**.

Under the pre-change implementation ARM A passed and ARM B failed — both inverted, which is what
makes these two clauses and not one wearing two names.

**The third break is the one worth recording.** The gate-rule arms were first written against a
five-line reimplementation of the filter sitting beside them, and setting `gating = clauses` — the
whole ruling undone — left the selftest at **210 passed, 0 failed**. A test of a copy is a test of
the copy. The rule is now `gateVerdict(clauses)`, exported, and the arms drive it; the same break
now costs 2 arms.

## Other refusals the board clause takes

- **No board data → CANNOT ANSWER, and there is no fallback onto `j.diverged`.** That branch is the
  one that would quietly undo the change: it would publish the narration count under the board
  clause's name. The refusal names `state_mode` so a reader knows the run was never asked for
  boards rather than guessing that boards agreed. Red arm asserts the protocol number does not
  appear in the refusal string.
- **The board comparator's own planted proof.** `state.planted_state_proof_ok` and
  `state.mappings_all_proved`, not `planted_divergence_proof_ok`. The protocol proof shows the LINE
  comparator can see a planted line; it says nothing about whether the LEAF comparator can see a
  planted HP. A board clause vouched for by a different instrument reads exactly like a vouched one.
  Two red arms plus a green control.
- **The pin refusal landed hours ago is preserved and was not weakened.** The read, the pin guard,
  the digest guard and the steering/population guard were extracted into ONE `wholeGameDoor` with
  two callers — not copied — because `pin_guard.js`'s own header records that same sentence copied
  into five clauses being this file's most expensive defect. Every pin refusal is now asserted on
  **both** callers, so a door bypassed in one of them turns exactly one column red.

## Nothing may be subtracted from the board count, and it says so

`DECLARED_DIVERGENCE` and `data/decision-impact.json` both attribute by protocol CAUSE over
`classes[].causes[]`. The artifact records no cause for a parted board — a board divergence is a
leaf PATH. So the board clause publishes RAW and prints why. The perish-drain `CLOSETED` row is a
protocol declaration; it subtracts from narration and cannot open the board gate.

**Related, and not mine to rule on:** that same CLOSETED row's `falsifiedBy` clause (b) reads *"the
board claim failing — `state.games_board_never_diverged` below `state.games`, … or a non-empty
`state.first_board_divergences`"*. On this artifact both are true — 884 of 961 and 40 rows. The
falsifier is stated in the row and nothing evaluates it. Named in the board clause's header comment;
**no verdict taken here**, because withdrawing a declaration Will authorised is not ENGINE's call
inside a reporting change.

## Downstream consumer state — checked, NOT edited

**`tests/test-divergence-composition.js` is RED, and it was red before I arrived.** Measured three
ways in one command, same tree, same artifacts, seconds apart:

| `engine/quarantine.js` | failing checks |
|---|---|
| `git show HEAD:` — the version this session started from | **3** |
| mine, board clause in the `wholeGameClause` slot | **10** |
| mine, with `Q.wholeGameClause` pointed at `Q.narrationClause` | **0** |

So my change adds 7 of the 10; the other 3 pre-date it. I did **not** diagnose those 3 and I do not
claim to have fixed them — they are `ARM_NO_PIN` and the `team_pool_digest` control failing to be
withheld at HEAD (`withheld=undefined`, the clause answering `12 of 1000`), in a file I do not own,
while another agent is rewriting `data/`. Stable at 3 across three consecutive HEAD runs.

**Verified fix for the 7 that are mine, one word, five call sites:** `Q.wholeGameClause(` →
`Q.narrationClause(` (and the `typeof` guard on line 42). Proved without editing the file:

```
node -e "const Q=require('./engine/quarantine.js'); Q.wholeGameClause=Q.narrationClause;
         require('./tests/test-divergence-composition.js');"     ->  all checks passed
```

That is the correct owner: ROADMAP #292 is about `classes[].causes[]`, which are protocol causes.

Other consumers checked:

- `tests/test-web-quarantine.js` — **exit 0**, passes. Reads `.failing` / `.clauses` structurally.
- `tests/test-web-status.js` — exit 1, and **not mine**: every failure is a stale web payload
  against live artifacts (`engine.live = 423` vs census 829, `ops.games = 52089` vs 84340).
- `tests/test-web-quarantine-loaders.js` — exit 1, **2 failures at HEAD and the same 2 with my
  change**: the committed `web/quarantine-data.js` withholds a different set from what the builder
  decides now. Unchanged by this work.
- `engine/status.js:1209`, `web/build-quarantine.js:247/265`, `web/build-status.js:673/801`,
  `engine/speed_vs_pokeenv.js:232` — all read `gate.failing`, which still carries every not-ok
  clause, so nothing breaks. But they will print the narration row as `FAIL` and count it in
  *"N of M clauses fail"* beside a gate it does not decide. `gateVerdict` now also publishes
  `gate_failing` and `reporting` for exactly this. **Not edited — MEASURE owns status.js and WEB
  owns the two builders.**
- `data/register-reality.json` row for ROADMAP #218 runs `node engine/quarantine.js --whole-game`.
  The command still exists and still exits 1, but **its quantity changed**: it printed protocol
  first-divergence until today and now prints board-material. The command's own output says so in
  place, and `--narration` gives the old number. Any figure quoted from `--whole-game` before
  2026-09-04 is the other quantity.

## What was deliberately not run

`node engine/quarantine.js` with no flag (another agent is rewriting artifacts under `data/`; a torn
read there produces a plausible, well-formed, fictitious answer). The default report's printer block
was smoke-tested in isolation on synthetic clauses instead, through the shipping `gateVerdict`:
`RPRT` label, the `GATE: CLOSED — 1 of 2 GATING clauses fail` line, and the reporting-clause legend
all render without throwing.

No fit, no self-play, no game played, no artifact written, no commit.

# OWED

1. **`tests/test-divergence-composition.js` is red and I did not edit it.** Five `Q.wholeGameClause(`
   → `Q.narrationClause(` plus the `typeof` guard on line 42. Verified green by monkeypatch. Route it.
   **It was already red at 3 before this change** and those 3 are a separate, undiagnosed defect in
   the same file — an unpinned artifact not being withheld. Do not let the rename mask them; re-run
   after the rename and confirm it reads 0 rather than 3.
2. **`engine/status.js` and `web/build-{status,quarantine}.js` print a reporting clause as `FAIL`**
   and fold it into *"N of M clauses fail"* beside a gate it does not decide. `gate_failing` and
   `reporting` are published for them. MEASURE and WEB.
3. **`data/register-reality.json` / ROADMAP #218: the `--whole-game` command's quantity changed.**
   The row's cell quotes protocol figures against a command that now answers board-material.
4. **The perish-drain `CLOSETED` row's own falsifier (b) is TRUE on the current artifact** and
   nothing evaluates it. No verdict taken here.
5. **`docs/ENGINE.md` hand list and `node engine/status.js --write` were not touched** — outside the
   ownership this task was given, and `--write` stamps ledgers other agents hold.
6. **The narration clause has a bar and no ratchet.** Its baseline (`data/whole-game-baseline.json`,
   rate 0.0187, mode `A/middle/pins:2efbc9ed1946`) is a PROTOCOL rate and stays with narration. The
   BOARD clause has **no baseline at all** and takes none — comparing a board rate to a protocol
   baseline is the ROADMAP #292 failure. If a board ratchet is wanted, it needs its own stamp.
