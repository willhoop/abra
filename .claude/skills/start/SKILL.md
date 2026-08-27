---
name: start
description: Start an ABRA session. Prints the real state, the open work and what is red, then says what to pick up next. Use at the beginning of any ABRA session, or whenever Will says "start", "where are we", "what's the state", "catch me up", or opens a new session on this project.
---

# Start the session by PRINTING the state, never by reading prose

The sections below run in order, and the order is load-bearing twice: the tree check must precede the
state print because the print WRITES, and the routing section must precede any real work because the
coordinator's job is to hand it out rather than do it.

**No count is written here on purpose.** This line read "Six steps" while the file carried ten
sections — the same rot that had `docs/DIVISIONS.md` saying "Four divisions" for nineteen days after
WEB was added. A number typed next to a list is wrong the moment the list grows.

---

## WHAT THIS DOCUMENT IS — AN OPERATING MANUAL, NOT A STATUS REPORT

*(Will, 2026-08-23: **"BECAUSE APPARENTLY LONG RUNNING SESSIONS JUST DESTROY MY MEMORY AND YOUR
PERFORMANCE"** and **"I WANT A NEW SESSION TO BE CAUGHT UP TO SPEED ON EVERYTHING."**)*

**A long session is a liability.** It eats his machine's RAM and it degrades the coordinator, so
ending one early has to be CHEAP — and this file is what makes it cheap. The measure of success is
that a brand-new session runs `/start`, reads the print, and is as capable as one that has been
running for hours. **If a fresh session cannot pick up the work, this document has failed, and the
fix belongs here rather than in a longer session.**

So it says how to start, what to run, what to distrust, and how to route. **It does not say where the
project stands** — that is PRINTED, by §0's map and §2's state commands.

**It holds exactly two kinds of content, and mixing them is the failure it guards against:**

| | |
|---|---|
| **Commands that derive current state** | self-correcting, cannot rot |
| **Judgement that cannot be derived** | a failure shape and what it cost, a decision Will made, a convention that will trip you — dated, with a receipt |

Anything that is neither — a count, a status, a "currently N of M" — **does not belong in this file at
all**, because it will be wrong within a day and it will be believed. That is the fourteen-handoffs
failure, and §7 is a list of times it has already happened here.

**The test for whether a line may be written here: WOULD IT BE WRONG IN A WEEK?** If yes, it must be
derived by `engine/orient.js`, or not written. Adding to this file is governed by §9.

## 0. GET ORIENTED — RUN THE MAP. DO NOT READ A DESCRIPTION OF THE PROJECT.

*(Will, 2026-08-23: **"MAKE IT DYNAMIC SO IT AUTO UPDATES AS THE PROJECT PROGRESSES. I WANT THIS
BULLETPROOF AND NOT JUST A SNAPSHOT."**)*

```bash
node engine/orient.js          # ~0.2s. Reads no store and plays no game — safe in light mode.
node engine/orient.js --owed-all
```

Derived at run time, in eight sections: what ABRA is and how CHOMP consumes it; **which divisions
exist and what each owns**; the **invalidation graph computed from real `require()` edges**, and how
many modules sit downstream of the simulator — which is what quarantine means and why it is one-way;
**which entrypoints PLAY A GAME**, so only one may run at a time; the question each model answers;
what a measurement must pin; **what the last session left `OWED, NOT RUN`, as commands**; and who may
write.

**This section is short because the map is a COMMAND.** It was going to be a written orientation
section and that was the bug — a written list of divisions is wrong the day a sixth is added, which
has already happened once: `docs/DIVISIONS.md` still reads "Four divisions" in two places. Divisions
come from `.claude/agents/`, the graph from require edges, the models from `docs/MODELS.md`, the OWED
commands from `docs/_reports/`. **Nothing in it is typed, so nothing in it can go stale.**

**A `CANNOT DERIVE` line exits non-zero and is a job for THIS session** — a file was renamed or a
heading moved. Never carry it: a map that quietly drops a section reads as though the section does not
exist. `node tests/test-orient.js` (~1s) proves every failure path still fires, and both it and the
generator were shown red on deliberate breaks before being trusted.

**It answers WHAT and WHERE, never HOW MUCH.** Its counts are counts of the map — how many divisions,
how many modules downstream — printed so a silent drop shows up as a number moving. **None of them is
a project result and none is a gate.** The gate is §2 and §3.

## 1. Check the tree FIRST, because step 2 writes to it

```bash
git status                     # must be clean, and NO rebase in progress
ls docs/_inbox/                # Cowork drafts waiting to be applied
```

**AND CHECK YOU ARE THE ONLY SESSION ON THIS REPO — `ListAgents`.** The one-publisher rule in
CLAUDE.md is written about Cowork, and it does not mention the case that actually occurs: **a second
Claude Code session, on this machine, in this same working directory.** They cannot see each other's
edits and the later write silently wins.

*(2026-08-25: a session ran `/start` and worked for an hour before noticing `abra-f3` — an earlier
session on the SAME repo, started an hour before it, titled with the SAME brief. It turned out to be
finished and idle, so nothing was lost. Nothing in `/start` would have said if it had not been.)*

Ask it rather than assuming: a session that has already pushed is harmless, one mid-write is not.
`list_sessions` gives `isRunning` and `lastActivityAt`; a peer that answers "nothing running, nothing
uncommitted" can be left alone. **Do not archive another session to resolve this — that is Will's
call**, and the one time it was offered he took it himself.

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
git log -8                     # FULL BODIES. NOT --oneline. See below.
ls docs/_reports/ | tail -5
```

`status.js` is the project's state — the MEDICHAM gate clause by clause, the census, provenance, and
every figure WITHHELD because the artifact under it is stale or downstream of a broken engine.
`open_work.js` is every unclosed register row plus every defect a live instrument is measuring, and it
prints **UNREGISTERED**. **Every number in both is read out of an artifact.** `NOT DERIVED` means no
artifact says it.

### READ THE WHOLE RECORD EVERY TIME. `--oneline` IS A TABLE OF CONTENTS, NOT THE RECORD.

*(Will, 2026-08-23: **"READ THE WHOLE RECORD EVERY TIME."**)*

The commit subjects are full sentences stating a finding, and that is exactly what makes them
dangerous: a subject reads like a complete answer, so you stop. **The BODY is where the session put
what it learned** — what was shown red first, what the control ruled out, what it fixed, what it
deliberately did NOT fix, and what it could not publish.

Measured on the session that wrote this rule. `git log --oneline -8` produced *"The damage
differential had never compared a single mega, and now compares all 76"*. Its body carried all of:

- the `-ate` entry-point fix, **already landed** — the coordinator read the harness, saw
  `battle.actions.moveHit` still being called, and reported the fix as NOT MADE. It had been made;
  the authority's two lines were added ABOVE that call. **A brief was written and dispatched to redo
  finished work**, and it was luck that it got killed for an unrelated reason;
- why the published artifact still prints five stale `aurorus` rows — `publish_guard` REFUSED both
  n=300 runs, so `data/engine-diff.json` was never rewritten. Without that sentence the coordinator
  reported those rows to Will as a live finding;
- one real, unfixed defect (**Disguise fires on the already-busted forme**), a legal species with no
  `MC.mons` row (`florgeswhite`), and a counter that was wrong in its first version and says so.

**Two wrong statements to Will in one session, both from reading subjects.** Read the bodies. If eight
is too many to read, read fewer commits — never fewer lines of them.

### A GATE EXISTING IS NOT EVIDENCE IT FIRES, AND THE MEGAS ARE THE PROOF

*(Will, 2026-08-23: **"WE HAD GATES FOR THE MEGAS BEFORE THEY JUST FAILED."**)*

He is right, and it is the whole reason §7's species-key entry is three items long. When the print
says a class is gated, that is a claim by the gate about itself. `engine/artifact_audit.js` was BUILT
for this class and watches one named file pair. `tests/test-mc-key.js` is the ratchet whose own header
says there is ONE way to turn a species name into an `MC.mons` key — and it **did not catch** the
doorway fixed on 2026-08-23, because `buildMon(s.toLowerCase())` is not a shape on its list. The
damage differential had been silently dropping every mega for weeks with both gates green.

**So never report "that class is covered" from the existence of a gate.** Ask what shape the gate
matches and whether a second instance spelled differently would walk past it.

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

*(Will, 2026-08-23, putting it as a standing arrangement rather than a nudge: **"YOU ARE THE CEO AND
YOU DELEGATE TASKS TO SUBAGENTS SO YOUR CONTEXT DOESNT GET DESTROYED."**)*

**YOUR JOB IS TO ROUTE, VERIFY AND DECIDE. IT IS NOT TO DERIVE.** A grep across the engine, "what
does Champions do with X", a look at the shape of an artifact — every one of those belongs to a
division. A hundred-token answer costs the coordinator well over a thousand tokens to produce by
hand, and that context is gone for the rest of the session. **Delegate every derivation.**

**THE ONE THING THAT MAY NOT BE COMPRESSED IS THE VERIFICATION.** Checking a returned claim is
usually one command; producing it is not. Relaying an agent's number unchecked is how a wrong figure
enters the record wearing a receipt. It is the report that gets skipped, never the check.

**AND THE SHORTCUT IS WHERE THE ERROR LIVES.** On 2026-08-23 the coordinator delegated its
measurement questions and got two correct, verified findings back. The single derivation it did
inline — grepping `tests/test-engine-diff.js` for `moveHit` — was the **only** thing it got wrong,
and it dispatched a brief to redo finished work off the back of it (the full receipt is in §2).
**The cheapest-looking step was the one that was wrong.**

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
  verdict of a few lines plus that path. **The report MUST end with an `## OWED, NOT RUN` heading
  holding exact commands — mandatory in light mode, and not a courtesy: IT IS THE HANDOFF.**
  `engine/orient.js` collects those blocks across `docs/_reports/` and prints them to the next
  session (§0), so an agent that ends without one has broken the chain that lets a session be cheap
  to end. Heading must contain the word OWED; the collector keys on that and prints how many reports
  carry none.
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

**AND KEEP IT SHORT. FOUR ITEMS, A FEW LINES EACH, AND STOP.** *(Will, 2026-08-23: "STOP GIVING ME
WALLS OF TEXT JUST SHORT AND SWEET I AINT READING ALL THAT.")* The state print is long because it is
GENERATED and he does not read it — your summary of it is the thing he reads, and a summary nobody
finishes is worth less than four lines somebody does. Detail goes in `docs/_reports/`; give the path.
No preamble, no recap of his own request, no closing paragraph restating what you just said.

---

## 7. THE FAILURE SHAPES THIS PROJECT ACTUALLY HAS

**A DECLARATION IS ONLY AS GOOD AS ITS MECHANISM, AND FOUR IN THREE DAYS HAD NONE.** "Nothing to fix
here" is where real defects hide. Speed ties were declared incomparable on the claim that the tie die
was unshared — `RNG_STREAMS` has carried `tie` since 2026-08-20, and those rows were a real turn-order
defect. Tailwind was refused twice on the same shape. Moody was declared because the stat pick "has no
shared address" — the address was **ours and stale**, and fixing it cleared 6 of 8 games and exposed
two more defects the exemption had been hiding. **Every one was set up by the coordinator with
plausible reasoning; every one was caught by an agent checking the mechanism rather than accepting it.
Refusing a declaration is a result — brief for it.**

**A DECISION WILL HAS ALREADY MADE CAN SIT IN THE REGISTER AS PROSE AND NEVER BE BUILT — AND THEN YOU
ASK HIM AGAIN.** On 2026-08-24 he closed the Tailwind ordering question outright: *"tailwind coming out
in the wrong order doesnt matter, put it into the closet with that note and move on."* The row records
the decision faithfully **and says in its own words that it was never implemented** — *"NOT FIXED and
NOT declared — it is absent from the declared kinds in `engine/quarantine.js`, so it is still counted
UNDECLARED and named on every run."* So it kept appearing on every gate print, a session read it as
live blocking work, and **took it back to Will as a decision to make.** He answered: *"im pretty
certain last session already dealt with tailwind why are you bringing it up."* He had.

**The register recorded the RULING and not the WIRING, and nothing anywhere could tell the difference.**
This is the same shape as the fourteen handoffs and the ban list of four, arriving through the one door
that looks safest — a row that is honest, current, and correctly written.

**So: a decision is not done when it is recorded. It is done when the gate stops asking.** Before
carrying any "deferred by decision" row to Will, check whether the mechanism exists — is it in
`DECLARED_KINDS`, is it in the closet, does the instrument actually skip it. **If the decision is made
and the wiring is missing, that is not a question for him. That is the work.**

**A PHRASE IN A REGISTER CELL IS EXECUTABLE.** `engine/quarantine.js:1040` tests
`/NOT A DEFECT/i` against a row's status cell and treats it as a ruling that **overrides the
derived verdict**. A sentence somebody typed as a note was subtracting three live turn-order
divergences from the gate and printing them as excused.

**A GREP IS A CLAIM ABOUT A NAME, AND THE NAME MOVES.** `tests/test-middle-identity.js` was RED for
days on a claim that searched `game_differential.js`'s SOURCE TEXT for `MID_BATTLE = this.battle`. A
commit had moved that state into a shared holder, so the identifier survived **only in comments** —
the capture never stopped happening, the grep stopped matching. The same run was printing `acc 99.4 /
dmg 99.3 / crit 99.1` two screens below the failure.

**It cost more than the fix.** TWO agents in one night reported it as "pre-existing, not my file, not
touched", and the coordinator escalated it to Will as a live engine defect — the authority-side half of
a mechanic — when engine health was in fact BETTER than reported. A red test nobody owns gets described
rather than run.

**So: a check that greps for an identifier is testing the identifier, not the behaviour.** Assert on what
the code BUILT — the addresses, the counter, the exported value — never on the spelling of the line that
builds it. And when a test goes red beside its own healthy numbers, suspect the check first: the fix here
was one claim, and the diagnosis was three sessions late.

**A GENERATED FILE DRIFTS FROM ITS SOURCE IN MINUTES, NOT DAYS.** `data/abra-tags.js` — frozen into
every release — went stale against `data/tags.json` **38 minutes** after the previous drift was fixed,
because a `tag_dex` run rewrote the source and nothing rebuilt the copy. Fourth instance of this class.
Care does not close it; a check does.

**A MOVE CAN BE IMPLEMENTED AND DO NOTHING.** Destiny Bond wrote its volatile and **no line in the
engine ever read it** — the killer never fainted, the window never closed, a second use refreshed
instead of failing. It spent 5 PP for nothing, and nothing noticed because nothing compared that leaf.

**COVERAGE OF MECHANICS IS NOT COVERAGE OF DEFECTS.** At turn cap 12 the last new mechanic first acts
on turn 11 and real games have a median of 7 turns — so 12 is the right cap. But the same mechanics
exercised longer diverge more: parted 28 → 80 and board-material 10 → 41 between cap 12 and cap 30.
**Every board-material figure is a claim about the first twelve turns.**

**A PROOF CAN FAIL ON ITS OWN FIXTURE AND LOOK LIKE A BROKEN COMPARATOR.** The planted-state proof was
`false` on every artifact for two days. At the plant boundary one side was corpses: six plants
correctly refused a dead body and seven wrote onto one where the comparator deliberately stops reading.
`applied: true` was a false receipt. **The control — the same mutations on a STANDING body — settled it
in one run.**

**A FIXTURE IMMUNE FOR TWO REASONS PROVES NOTHING.** Two census probes were green on a live Thunder
Wave defect because both aimed it at a body blocked by type *and* by status. The sweep that replaced
them records **how many reasons each cell is immune for** and refuses any cell with more than one.

**TWO CORRECTLY-COMPUTED NUMBERS ARE PRINTED SIDE BY SIDE AND ONLY ONE IS PUBLISHED. THIS COST THREE
RECONCILES IN ONE SESSION.** The headline is `games - games_board_never_diverged` — the figure
`game_differential.js` prints and the only one `wire_ladder.js` consumes. Beside it sits a PER-CAUSE
table keyed on each game's protocol first-divergence cause. **A fix that closes a protocol divergence
drops a game out of the CAUSE TABLE while its board goes on parting** — so the per-cause count falls
when nothing improved. Neither number is wrong and no gate can catch it: both are correct, printed
together, and only one is the published quantity. **Say which quantity you are quoting, every time,
and read the headline out of the artifact rather than off stdout.**

*(The consequence is worse than a misquote: a game whose protocol divergence closes while its board
still parts is left UNCAUSED — a board that differs with nothing in the narration pointing at it. One
of the four board-material games is in that state now, put there by a correct fix.)*

**`--games` IS A PAIR BUDGET, NOT A GAME COUNT.** `--games 1200` yields 961 played. An agent read a
different budget's output as a catastrophe before catching it; the coordinator twice briefed figures
from two different budgets side by side.

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

**A READ-ONLY FLAG THAT WRITES — AND THE WRITE TURNED THE GATE GREEN.** `register_reality.js --list` is
an ENUMERATION and it rewrote the verdict artifact `openDefectClause` is computed from. Five rows carry
`green:false`; a wipe drops all five out of the red set and the clause **flips to OK**. So merely
*inspecting* the register published a gate saying the engine was correct, because the evidence had been
erased. **Worse half leaves no trace at all**: it also printed *"every marked row agrees with its
instrument"* three lines under its own *"0 distinct instruments actually run"*. The artifact wipe shows
in `git diff`. The sentence does not. Fix guards the DATA, never the flag — a mode check is one
re-derivation away from being wandered around.

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

**AND SO DO YOUR OWN BRIEFS. TWO ARTIFACTS OF THE SAME INSTRUMENT ARE NOT COMPARABLE UNLESS THE
REQUESTED SAMPLE SIZE MATCHES.** The coordinator twice handed an agent a class breakdown from a
777-game run beside a total from a 961-game run, and both times the agent caught it. `--games 1200`
yields 961 played, `--games 777` yields 777 — so a rate looks like it moved when only the request did.
**Restate the pins and the game count in every brief, and re-read the artifact rather than quoting
yourself from earlier in the session.**

**SOME DIVERGENCES HAVE NO CORRECT ANSWER, AND CHASING THEM IS INFINITE.** Three Protect/Detect rows sit
at `speed_gap: 0, same_priority: true` — an exact tie. Showdown picks one, we pick the other, neither is
wrong. That is a DECISION for Will, filed `NOT A DEFECT`, not a bug to fix. Before investing in a
divergence, check it is not a tie.

**A FIX MEASURED AGAINST THE WRONG SCOREBOARD LOOKS LIKE A FAILURE.** Four correct fixes moved the
whole-game rate **not at all** — the pinned pool holds ZERO Malamar and 0.45% self-destruct games, and
the win rule decides who WINS, which the differential never compares. The lab (roster + census) saw
every one of them. **The pool is real games, usage-weighted, and answers *does this matter*. The roster
and census are one staged scenario per entity and answer *is this correct*.** Say which one a fix should
move BEFORE running it.

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
**AN EIGHTH, AND ITS CAUSE IS MECHANICAL RATHER THAN A TYPO: A `.cmd` FILE WITH LF LINE
ENDINGS OPENS AN INTERACTIVE PROMPT INSTEAD OF RUNNING.** `core.autocrlf` is on here and 510 of 1,753
tracked files are CRLF, so a scratch `.cmd` written by a tool is LF and silently does nothing. The
agent that hit it worked around it with an absolute-path CRLF `.cmd`. **Write scratch `.cmd` files
with CRLF, or call the script directly.**

**A SIXTH AND SEVENTH, BOTH HIT IN ONE PASS ON 2026-08-26.** The differential and the roster stages
run WITHOUT `--write` print a full report, name every count, and **exit 0 while their artifact never
moves** — a complete-looking measurement of nothing. And `cmd.exe /c "<path>"` from Git Bash opens an
INTERACTIVE shell and returns a three-line banner at exit 0; **`cmd.exe //c` is the working form.**
Seven variants now. **Stop reading the exit code. Read the SIZE of the output and the `generated`
stamp on the artifact** — those are the only two things that have ever caught this.

**AND A FIFTH SHAPE, FOUND 2026-08-26: `toolslownode.cmd` ENDS IN `exit /b`, SO CALLING IT FROM
ANOTHER `.cmd` WITHOUT `call` ENDS THE CALLER.** An agent batching three roster stages ran the FIRST one
and stopped, **exit 0**, output that looks exactly like a finished run. The wrapper is correct — `exit /b`
is what propagates the exit code, which is the load-bearing property `tests/test-lownode.js` exists to
defend. The caller is what must say `call toolslownode.cmd …` when chaining. **One stage of three, with
a success code and no error, is this file's signature failure wearing yet another costume.**

**FOUR TIMES NOW, AND THE THIRD AND FOURTH WERE THE COORDINATOR, TEN MINUTES APART, WITH THIS
PARAGRAPH ALREADY ON THE PAGE.** Unquoted is no safer: `cmd /c tools\\lownode.cmd tests\\run-all.js`
from the Bash tool produced a three-line command-prompt banner and exit 0. And `> "$TMPDIR/x.txt"`
with `$TMPDIR` unset writes to `/x.txt`, which is refused — the inner command reported `EXIT=1` while
the harness reported the background task **completed, exit code 0**. **Reading the exit code is not
enough; the run-all output was 3 lines where a real run is ~660.** Check the SIZE of what came back
before you believe it, and run the wrapper from the PowerShell tool, which is what §5 says.

**A DRIFT IN THE SAFE DIRECTION SURVIVES LONGEST, BECAUSE NOTHING IT PRODUCES LOOKS WRONG.** The site
published *"6 of 8 gate clauses fail"* against a real 3 of 8, with three clean clauses marked red, for
three days. It OVERSTATED the damage, so no reader had a reason to check it, and `figure-audit.js`
scored the page **100% traced** the whole time. **A citation proves a figure HAS a source. It never
proves the source still says it** — and a checker that only asks "does this number appear somewhere"
cannot tell the difference. Meanwhile the published `app/` copy said *"1 of 6"*, understating the same
gate. **One fact, two copies, drifting opposite ways, both passing their checks.**

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
| `node -e "require('./data/engine-data.js');const{mcKey}=require('./engine/mc_key.js');console.log(mcKey(X))"` | **THE COORDINATOR MUST USE THIS TOO.** It resolves `castformsunny` to `castform-sunny` and THROWS by name on `raichumega`. On 2026-08-26 the coordinator hand-typed three keys into greps -- `castformsunny`, `raichumega`, `floette-eternal-mega` -- and reported a species MISSING that was present, twice, sending a false blocker to Will. Will: **"BRO U MISS SO MANY HYPHENS"**. Never type a species key into a grep or an `includes()`; ask the resolver |
| `engine/mc_key.js` | the ONE species-name → `MC.mons` key resolver. Three separate bugs came from not using it |
| `engine/artifact_audit.js` | does a generated file actually contain its source's values |
| `engine/policy.js --promote` | lands `move-priors.observed.json` on the engine and prints the delta — the scheduler no longer writes it |
| `engine/quarantine.js:1157` `DECLARED_KINDS` | **the only two things the gate will excuse**, and what a third would have to be. A row typed `DEFERRED` is counted UNDECLARED *by design* and the selftest asserts it — so "Will deferred it" does NOT stop it holding the clause shut |
| `SB.harness(null).CLOSET_SPECIES` / `.CLOSET_ABILITY` | who is in the Illusion closet, computed from the ABILITY over legal species. Import it; two instruments deriving membership separately is how they came to disagree about one Pokémon |
| `engine/medicham_coverage.js` | what % of real clicks the engine can perform (ROADMAP #27). **It stamps NO release** — it needs the live simulator, so its output can never be re-opened, only re-run |
| `.githooks/pre-commit` silent-catch gate | whether a staged `.js` adds a `catch` that hides an error. It names the file:line and the fix; a genuinely-correct silence is recorded ONE block at a time by the hash of the catch BODY, so editing the block re-arms the gate |
| `data/roster.*.json` → `carrier` / `carrierSpecies` | **which BODY a roster row was staged on.** It was prose inside `note` until 2026-08-25, which is why a carrier-shaped shelf could not be expressed or audited |

**TWO DIFFERENTIALS EXIST AND CONFUSING THEM COSTS AN HOUR.** `tests/test-engine-diff.js` is the DAMAGE
one and owns `data/engine-diff.json`. `engine/game_differential.js` is the WHOLE-GAME one and owns
`data/game-differential.json`. A defect in one is not owned by the other.

**`engine/publish_guard.js` REFUSES AN UNDER-SIZED RUN** and diverts it to `data/verification/<name>.n<N>.json`
instead of the published artifact. So a scoped run does NOT update the headline — the published figure
and the `GENERATED` block keep the old numbers until a full run happens. Say so rather than reporting the
scoped number as current.

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
| `sim/battle-actions.ts:430` `ModifyType` in `useMoveInner` | where every `-ate` ability fires — **932 lines above** `moveHit`, and it runs BEFORE `hitStepTryHitEvent` |
| `sim/battle-actions.ts:1370` `moveHit` | the entry point a damage harness reaches for. Call it alone and you lose the retype AND the boost |
| `sim/pokemon.ts:1564` `clearVolatile` | its closing `setSpecies(baseSpecies)` reverts a NON-permanent forme on switch-out |
| `data/abilities.ts:1891` | `formeChange` without `isPermanent` — which is why Hunger Switch reverts and Zero to Hero does not |

**AND THE MECHANISM YOU ARE CHECKING MAY NOT BE NAMED IN THE ENGINE AT ALL.** `medicham2-browser.js`
never says `refrigerate`; it matches the TAG shape `convertsMoveType` + `damageBoost`, so Pixilate,
Refrigerate and Aerilate are one mechanic and a fourth would be picked up with no code edit. **`grep`
returning zero is not evidence the mechanic is missing** — check `data/tags.json` before concluding it.

### The authority — anchors found the expensive way, 2026-08-24/25 (re-open the line, the checkout moves)

| Anchor | Answers |
|---|---|
| `sim/battle.ts:429-460` `speedSort` | why a tie is not a stable sort — the swaps move UNTIED bodies past a tied pair, so sorting the front displaces the tail |
| `sim/battle.ts:507` | the residual list is speed-sorted ONCE, before the walk — nothing mid-walk can reorder it |
| `sim/battle.ts:2031` / `:2073` / `:2079` | `TryBoost` before any stat lands; `AfterEachBoost` INSIDE the per-stat loop; `AfterBoost` once at the end |
| `sim/battle.ts:615-621` | weather handlers are suppressed by Air Lock EXCEPT `FieldStart`/`FieldResidual`/`FieldEnd` — which is why the upkeep line still prints under Cloud Nine |
| `sim/pokemon.ts:1528-1566` `clearVolatile` | switching out wipes every volatile and unlinks linked ones — so a benched body should carry nothing |
| `sim/pokemon.ts:1587` `faint()` | only QUEUES; the `|faint|` line comes from `faintMessages()` at eight step boundaries |
| `sim/battle-actions.ts:627` / `:731` | Toxic from a Poison-type user bypasses BOTH the invulnerability check and accuracy — the Aerial Ace mechanism, not 100% |
| `data/moves.ts:3483-3517` | Destiny Bond's window: stripped by `onBeforeMove` at priority −1, so surviving into the next turn depends on SPEED ORDER; KO must be from a move, not delayed, not an ally |
| `data/abilities.ts:2694-2713` | Moody skips `accuracy` and `evasion` by name, on BOTH the +2 and the −1 |
| `Dex.getImmunity(status, type)` | the whole type-immunity matrix without reading a handler — par/Electric, brn/Fire, psn/Poison+Steel, frz/Ice, powder/Grass, trapped/Ghost |

### Derivations that answer a question faster than reading source

- **`Dex.getImmunity('powder', type)`** and `move.flags.powder` — the seven legal powder moves and who resists them.
- **`ability.onSwitchInPriority`** — only a handful of switch-in abilities declare one; everything else, including Intimidate and Drizzle, sorts on speed alone.
- **Filter every entity walk by CARRIER, not by `isNonstandard`.** Neutralizing Gas reads legal and has **zero legal carriers**, so it cannot occur — an entity check alone would have sent someone to implement it.
- **`move.ignoreImmunity`** — the axis that separates Thunder Wave (respects type immunity) from Stun Spore and Glare (do not). One Ground body taking all three is a fixture that cannot be green by accident.

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

---

## 9. THIS FILE IS WRITTEN BY THE SESSIONS THAT PAY FOR IT

*(Will, 2026-08-23: **"WE ALSO HAVE THE /FINISH COMMAND THAT SHOULD AUTO ADD TO THE START COMMAND SO
MAKE SURE IT FLOWS."**)*

`/finish` is the WRITE end of this loop and `/start` is the READ end. **Every session that learns
something the expensive way writes it back before it ends** — that is an obligation, not an
encouragement, and it is the only reason §§7-8 are worth their tokens.

**The routing table — which lesson goes where — lives in `/finish` §6 and is not repeated here.**
Two copies of one rule drift apart, which is the failure this repo names against itself repeatedly.
Read it there; this section states the standard the entries are held to.

**Prefer MECHANICAL over REMEMBERED**, in this order:

1. **Best — nothing to remember.** The information already lives somewhere `/start` derives: the
   commit BODY (§2), the register, the tree (§1), the `OWED, NOT RUN` blocks `orient.js` collects
   (§0). `/finish`'s job is then only to make sure it was written *there*.
2. **Acceptable — append to a durable section here:** a failure shape into §7, a command or an
   authority `file:line` into §8, a routing or concurrency rule into §5.
3. **Banned — a handoff document.** CLAUDE.md forbids writing one and §4 forbids reading one.

**THE STANDARD: EVERY ENTRY IS A REAL EVENT WITH A RECEIPT.** Never a hypothetical, never a rule
someone thought sounded wise. **An entry that cannot name what it cost is a preference — and
preferences are precisely what this project has repeatedly discovered were never being followed.**
A confirmed expectation teaches nothing and dilutes the section; only what SURPRISED you belongs.

**And never add project STATE.** No counts, no gate clauses, no "the census is at N". Those rot
exactly like the fourteen handoffs. If it is derivable, it goes in `engine/orient.js` so it updates
itself; if it is measured, `status.js` prints it. **The test is the one at the top of this file:
would it be wrong in a week?**
