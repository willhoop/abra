---
name: start
description: Start an ABRA session. Prints the real state, the open work and what is red, then says what to pick up next. Use at the beginning of any ABRA session, or whenever Will says "start", "where are we", "what's the state", "catch me up", or opens a new session on this project.
---

# Start the session by PRINTING the state, never by reading prose

Six steps, in order. The order is load-bearing twice: step 1 must precede step 2 because step 2
writes, and step 5 must precede any real work because the coordinator's job is to route it.

---

## 1. Check the tree FIRST, because step 2 writes to it

```bash
git status                     # must be clean, and NO rebase in progress
ls docs/_inbox/                # Cowork drafts waiting to be applied
```

**`git status` goes before `status.js`, not after.** `status.js` rewrites
`data/provenance-stamp.json` (a timestamp, every run) and `open_work.js` rewrites
`data/open-work.json`. Run them first and the clean-tree check is polluted by this skill's own
commands — you then cannot tell your own noise from work someone left half-finished.

If a rebase is in progress, **finish it** (`git rebase --continue`). Never `git checkout` away from
one — that abandons every commit already replayed.

Anything in `docs/_inbox/` beyond `.gitkeep` and `applied/` is Cowork work waiting on you. Do not apply
it unless Will says "apply inbox", and treat any figure in it that is not `<<MEASURED>>` as suspect.

**Check for a leftover engine edit before trusting the tree.** A killed agent can leave the simulator
half-changed and it will still LOAD — JavaScript does not resolve a call until it runs. A session once
found 26 call sites to a function that was never written. If `git status` shows `engine/` dirty and no
agent is running, read the diff before running anything.

## 2. Print the state

```bash
node engine/status.js
node engine/open_work.js
git log --oneline -8
ls docs/_reports/ | tail -5
```

`status.js` is the project's state — the MEDICHAM gate clause by clause, the census, provenance, and
every figure WITHHELD because the artifact under it is stale or downstream of a broken engine.
`open_work.js` is every unclosed register row plus every defect a live instrument is measuring, and it
prints **UNREGISTERED**. **Every number in both is read out of an artifact.** `NOT DERIVED` means no
artifact says it.

The commit subjects here are full sentences stating a finding. Eight of them are the last sessions'
conclusions and are worth more than any document.

**This is the entire budget for finding out where you are.** Do not go reading engine files or
artifacts to enrich the picture — that is the coordinator doing a division's job. If a
`docs/_reports/` file looks relevant, read its `## VERDICT IN ONE PARAGRAPH` block and nothing else.
If the print leaves a question open, that question is a brief.

**If a command here errors or has been renamed, fix this skill in the session that saw it.**

## 3. Read the gate: a FAILING clause is not the same as a BROKEN engine

| The clause says | What it means | What clears it |
|---|---|---|
| `MEASURED AGAINST A DIFFERENT ENGINE — ran on release X, tree is Y` | **Nothing is known.** Not evidence of breakage in either direction. | A re-run. No fix. |
| a named instrument is RED, or a row asserts breakage with an instrument that decides it | **Something is wrong**, and the row names it. | A fix. |
| a row asserts breakage with **no** instrument | DEBT, not evidence. It does not hold the clause shut. | A `VERIFIED BY` line naming the gate. |

Count them separately and lead with the split. On 2026-08-22 six of eight failed and **five were the
first row** — reporting the count without the split would have described a broken simulator when the
true state was an unmeasured one.

**A PASS measured against an old release is not a pass.** Check the release id against the tree id.
And a passing clause says nothing about what it does not sample: the damage differential read
`0/6000` at three points of a sixteen-index band while a 157-row red sat beside it.

## 4. What NOT to do

- **Do not do the work yourself.** See §5.
- **Do not read a `docs/HANDOFF-*.md`.** Fourteen, each typed by hand, each stale within a day.
- **Do not type a list of what is open.** Print it.
- **Do not quote a QUARANTINED figure**, even with a caveat. Withheld means absent.
- **Do not take a number from a `docs/_reports/` file as current state.**
- **Do not commit the artifacts §2 rewrote** as though they were an outcome.

## 5. ROUTE IT. THE COORDINATOR PRINTS THE STATE AND THEN HANDS OUT BRIEFS.

*(Will, 2026-08-22, on the first session that ran this skill: "ur delegating right?" — and it was not.
It had cut a release, pinned a census and checked the frozen pool inline, and was one command from
running a five-stage measurement chain itself.)*

**Everything after the state print is a brief, not a task.** One question routes it: *which artifact
does fixing this invalidate?* Table in CLAUDE.md, map in `docs/DIVISIONS.md`.

**DERIVE THE FACTS THE BRIEF NEEDS. DO NOT TRUST THIS FILE FOR THEM:**

```bash
node engine/where.js --artifacts    # every artifact and who writes it -> what may run beside what
node engine/where.js --gates        # every instrument the register names
node engine/where.js <thing>        # which file owns this fact, which test would catch it
```

**Every brief must carry:**

- **The report contract.** Write the full account to `docs/_reports/<YYYY-MM-DD>-<topic>.md`, return a
  verdict of a few lines plus that path.
- **The wrapper, at BelowNormal, repo-relative, FROM POWERSHELL.**
  `cmd /c tools\lownode.cmd engine\quarantine.js`
  From Git Bash, `cmd /c "the whole thing quoted"` starts cmd with NO arguments and **exits 0 having
  done nothing.** Check an artifact's `generated` stamp actually moved before reading a number out of it.
- **All three pins, when it measures** — `--release <id>`, `--census <pinfile>`,
  `--team-store data/team-pool-frozen`. Cut the release ONCE and hand the same id to every agent.
- **The artifacts it writes, and a ban on the others reading them.**
- **No fixing while measuring**, and no re-measuring a changed tree against the old release.
- **DERIVE THE RIPPLE — a coordinator naming two consequences is NOT the list.** Both consequences
  named in one brief were vacuous and the real one was elsewhere. Tell the agent to find what reads the
  relevant state between the two points.
- **The brief's premise may be wrong, and saying so is a result.** One card said a defect was "stored
  as prose"; that was already fixed and the real defect was three layers away.
- **Batches of one.** Land, measure, then start the next.

**Concurrency: one heavy chain at a time, and it serialises INSIDE one agent.** Several agents at once
is the point of the divisions and is not the hazard. Split by **"does it play a game"** — only one
agent may. Everything else (register rows, docs, run-all, the registry) is safely parallel.

**HEAVY RUNS AND WILL'S MACHINE ARE INCOMPATIBLE, AND `lownode` DOES NOT FIX IT.** BelowNormal governs
CPU scheduling. It does nothing about memory bandwidth or L3, and the differential loads a 30 MB store
plus the dex across every core. If Will is gaming or on a call, **ask before starting a chain** or run
the agent in LIGHT MODE — staged boards and single census rows are seconds; the differential, the
roster stages, `all_mechanics_fire`, `quarantine` and `status.js` are minutes. A light-mode agent ends
its report with an explicit **OWED, NOT RUN** list of exact commands.

**Verify what comes back.** Agents are wrong often enough to matter, and verifying is cheap.

**If nothing is red**, take the top of the current phase from `open_work.js` and say plainly that the
gate is open, because that has not been true yet.

## 6. Reporting back — the contract

1. **Where the gate stands and what KIND of failure holds it** (§3). The split, not the count.
2. **What is genuinely red — name the mechanic, never the row number.** *(Will: "i have no idea what
   they mean".)* Say "Fur Coat carries no defence multiplier", not the index.
3. **What you dispatched**, one line each.
4. **What you deliberately did NOT dispatch, and why.**

If the news is bad, give it plainly.

---

## 7. THE FAILURE SHAPES THIS PROJECT ACTUALLY HAS

Read this before believing any number, including your own. Every line is a real event with a receipt in
`CHANGELOG.md`. **They are ordered by how often they have bitten.**

**THE INSTRUMENT IS WRONG BEFORE THE ENGINE IS.** Five times in two days.
- The roster asked for its pinned dice **by omission** and had been rolling live ones for nine days:
  **169 accusations against the simulator, 162 of them the ruler.** Moves read 157 DIFFER; the truth was 5.
- A probe reported **RED PROVEN off a mechanism it was not staging.**
- A verifier **re-implemented the rule it was checking** and would have gone green while the engine
  stayed wrong.
- A counter was read out of the wrong namespace, comparing `undefined` to 0, so it could never be red.
- Three probe errors surfaced before one real Life Orb defect. **A corpus sweep found it, not another
  staged board** — the instinct is always to stage one more board.

**A CHECK THAT CANNOT FAIL.**
- A regex held two raw `0x08` bytes — `\bFAIL\b` flattened to backspaces — so one alternative could
  never match. **It renders correctly in an editor.**
- A coverage assertion whose comment said it fails, exiting on a different variable.
- Test arms asserting only a non-zero exit **passed with their own guard deleted**, because a
  neighbouring check covered for them.
- A test went **red because the engine got right** — it hunted for a divergence and the supply ran out.

**A COMMENT CLAIMING THE OPPOSITE OF ITS CODE.** Twice in two days: the engine's failed-Roost comment,
and the runner's coverage assertion.

**A NUMBER THAT MATCHES SOMETHING, SOMEWHERE, IS NOT A CITATION.** Three variants:
- `0.6981` counted as traceable because `0.69817…` sat in an unrelated file.
- `231 live of 232 probed` counted as traceable because `231` appears inside a 308 KB census.
- A retraction of `9.7%` accused **52 documents of restating `10%`**, because the comparison rounded.

**A LABEL IS NOT A RECEIPT.** The roster printed the arm it had not played. The differential records
which pool it drew from and **nothing reads the field**, so a wrong pin is invisible.

**THE TREE MOVES UNDER YOU.** An audit had **four of its six briefed figures superseded within two
hours**. Every engine fix re-stales every measurement in flight — which is why the pins exist and why
only one agent may play a game.

**A CORRECTION CAN BE WRONG TOO.** A published `9.7%` was corrected to `11.69%` with a stated mechanism,
and the mechanism was then refuted from the record. **Three layers, each caught by someone checking.**
Publish the correction against yourself and keep the retracted claim visible.

**A DEFECT CAN HIDE THE EVIDENCE FOR THE FIX BEFORE IT.** Scoring every tie `0.5` concealed that the
previous day's fix had a winner-level consequence.

**A SEARCH CAN MISS WHAT IT IS LOOKING FOR.** A grep for `arm:` missed ES6 shorthand `{ script, arm }`,
so "27 wrong callers" was 22 — and separately more than 27, because two whole classes were unreachable
by that pattern.

**A USAGE WEIGHT CAN BE WRONG BY TWO ORDERS.** "Malamar brought 1,340 times" counted sheet entries;
**two** carried the relevant ability, and the frozen pool held none.

**YOUR OWN COMMANDS CAN SUCCEED HAVING DONE NOTHING.** Twice: `cmd /c "…"` from Git Bash. The artifact
kept its old timestamp both times and the stale number was nearly reported as a confirmation.

**A SCRATCHPAD SCRIPT RE-RUN IS NOT A NO-OP.** Re-invoking a previous append script duplicated 46 lines
of a ledger silently. **Make every scratchpad script idempotent — refuse if its own marker is present.**

**THE REGISTER CAN DISAGREE WITH ITSELF.** Three tools gave three answers about which rows have a
deciding instrument, because a third copy of the closed-row detector disagreed with the canonical one on
**24 of 292 rows in both directions**. And a ledger writing a party slot as `name#5` was read as a
register citation — **the first repair reintroduced it by quoting the token in the explanation.**

**WILL PAUSES THINGS, AND THE PAUSE IS NOT IN THE GATE.** The five living documents were under a
declared pause at 3.98.0 and a session dispatched at them anyway. MAG, MILTANK and the quarantined
re-runs are his. **Check before dispatching at anything he owns.**

**A GATE BUILT FROM AN INSTANCE CATCHES THAT INSTANCE, NOT THE CLASS — AND THIS PROJECT HAS PAID FOR IT
THREE TIMES WITH THE SAME BUG.** Will, 2026-08-23: *"why tf this wasnt caught before. im sure it was it
just wasnt reported or corrected so it slipped through the cracks."* He was right, and it is worse than
that — it WAS reported, fixed, and gated. Twice. The species-key mismatch, in order:

1. **2026-07-30** — `merge_mega_into_engine.js` keyed `venusaurmega`, the artifact keyed
   `venusaur-mega`, **zero of 67 writes matched**, every mega carried `ab: null` / `mv: []`. Fixed, and
   `engine/artifact_audit.js` was built and registered as a gate.
2. **Later** — the same class found in FOUR more files (`board.js` 101 of 308 keys unreachable,
   `backtest_winrate.js` silently dropping every forme team, `forced_switch_audit.js` null for every
   forme). A canonical resolver `engine/mc_key.js` was written, plus a ratchet `tests/test-mc-key.js`
   whose header says *"there is ONE way to turn a species name into an MC.mons key, and this bans the
   others."*
3. **2026-08-23** — the identical mismatch in `tests/test-engine-diff.js`. **138 of 345 species
   dropped, and the damage differential had never compared a single one of the 76 megas.**

**Neither gate could see it.** `artifact_audit.js` watches ONE named file pair. `test-mc-key.js` scans
for the KNOWN-BAD SHAPES — and this file used `buildMon(s.toLowerCase())`, a spelling not on the list.
**A ratchet written as a list of wrong forms cannot catch a new wrong form.** The durable fix is to make
the resolver the only door and check that every caller goes through it, not to enumerate the ways in.

**So when you fix a defect, ask what CLASS it belongs to and whether the gate you are about to write
would catch a second instance spelled differently.** If it would not, say so in the gate's own header —
that is the difference between coverage and the appearance of it.

---

## 8. SOURCES THAT EXIST AND ARE NOT OBVIOUS

Everything below was discovered the expensive way. **Each entry says what QUESTION it answers, never
what the answer is** — an answer written here rots like the fourteen handoffs. Verify before citing:
ours with `where.js`, the authority's by opening the line.

### Ours — ask these instead of grepping

| Command | Answers |
|---|---|
| `node engine/where.js <thing>` / `--gates` / `--artifacts` | which file owns a fact, which instrument decides a question, who writes an artifact |
| `node engine/mod_audit.js` | did Champions change this entity |
| `node engine/engine_release.js compat <file> <symbol>…` | which releases can still serve a caller — a stranded release is a figure to WITHHOLD, `docs/LESSONS.md` §12 |
| `node engine/gate_fail_and_silent.js` | the announce-failure class; exits 2 = CANNOT ANSWER, which is a real state |
| `node engine/register_reality.js` | builds the verdict artifact the open-defect clause reads; it RUNS the instruments the register names |
| `node engine/feature_fixture.js --check <weights>` | the refit signal; `status.js` PARSES its output, so its shape is load-bearing |
| `node web/build-quarantine.js --check` | whether the site is telling a visitor the simulator is clean |
| `node engine/explain_divergence.js`, `engine/divergence_cards.js` | render `data/divergence-turns.json` into readable cards — **the highest-yield instrument in the repo** |

**`roadmapRowIsClosed` is exported from `engine/quarantine.js` on purpose** — so there is ONE
closed-row detector. A third copy once disagreed with it on 24 of 292 rows in both directions.

### Artifacts whose interesting parts are buried

- `data/game-differential.json` — `classes[]` (grouped causes), `mid_void` (void/usable split),
  `steering.team_store_pinned_to` and `team_pool_digest`. **The pool IS recorded and nothing reads it.**
- `data/roster.*.json` — `arms_played` is the RECEIPT; the declared arm is only a label.
- `data/team-pool-frozen/` holds **bo3 and ots only — NOT `games.ladder.jsonl`.** Two human stores,
  one frozen. That gap is why a store-derived file kept moving under measurements.
- `data/docs-currency-baseline.json` — a ratchet. Adding an entry is a hand edit with a reason, never a
  way to make a gate pass.

### The authority — file:line anchors, all verified 2026-08-22/23 in the local checkout

**Re-open the line before citing it; the checkout can move.** And Champions overrides **eight** files
under `/data/mods/champions/` (`abilities`, `moves`, `items`, `conditions`, `learnsets`, `rulesets`,
`formats-data`, `scripts`) — **reading `/data/*.ts` is reading a different game**, and a register row
was once closed on exactly that mistake.

| Anchor | What lives there |
|---|---|
| `sim/battle.ts:2603` `checkWin` | a Gen-5+ simultaneous wipe is not a draw — last faint's side wins |
| `sim/battle.ts:404` `comparePriority` | the residual sort: order ASC, priority DESC, **speed DESC** — this is why the slowest perish counter resolves last |
| `sim/battle-actions.ts:118-132` | a switch **SWAPS** party indices; the party order IS the drag die's index space |
| `sim/battle-actions.ts:499` | `selfdestruct === 'always'` faints the user **above the whole hit**, Protect included |
| `sim/battle-actions.ts:1287` | where the `ifHit` self-faint sits instead |
| `sim/battle-actions.ts:1353` `forceSwitch` → `runEvent('DragOut')` | ONE refusal site reached from two doors — `:1104` damaging, `:1260` status |
| `sim/battle-actions.ts:438` | `onModifyType` runs inside `useMoveInner`, ABOVE the `moveHit` entry point |
| `sim/battle-queue.ts:270` → `battle.ts:2657` | switch ordering among simultaneous switches |

### Conventions worth knowing before you trip them

- **`MEDI_*` / `ROSTER_*` env knobs restore a defect on demand** — `MEDI_BENCH_APPEND`,
  `MEDI_DAMAGE_SPAN_DRAW`, `MEDI_MULTIHIT_ONE_INDEX`, `MEDI_ORB_STALE_RANGE`,
  `ROSTER_ARM_FALLS_THROUGH`. The defect stays reachable **so the test that catches it can be shown
  red.** Add one whenever you fix something.
- **`MEDSEEN.*` counts what happened; `MEDFAILS.*` counts what went wrong.** Reading one out of the
  other's delta compares `undefined` to 0 and can never go red — that has happened.
- **The differential's arms are `middle`, `top-tie-first`, `bottom-tie-first`.** `middle` is real dice
  and is the DEFAULT; a corner must be asked for **by id**. Asking by omission is what produced 162
  false accusations.
- `.github/workflows/ingest.yml` runs `cron: '17 */6 * * *'` — **six-hourly, and it writes files the
  engine reads.** Anything it touches can expire a measurement.
- `docs/CARD-REVIEW-2026-08-22.md` — Will read 40 divergence cards by hand and found ~20 root causes
  where the automated rollup found none. **The method is grouping by MECHANISM, not by comparator
  class**, and it is still the highest-yield thing anyone has done here.
