# CLAUDE.md — ABRA

Project-specific context. Universal rules are inherited from the Pokémon umbrella and the global
instructions; only what is specific to ABRA is here.

## START HERE — the handoff is generated, not written

```bash
node engine/status.js
```

That output is the current state of the project. Every figure in it is read out of an artifact;
`NOT DERIVED` means no artifact says it. **Do not take a number out of a `docs/HANDOFF-*.md` file** —
there are fourteen of them, each was typed by hand at the end of a session, and each was stale within
a day. The 2026-08-04 handoff says "172 tags, 118 unprobed" against a `tags.json` holding 176 unique
tags with 123 unprobed. Nobody mistyped anything; prose cannot track a corpus. They are history now.

Work is divided five ways — ENGINE, MEASURE, SEARCH, OPS, WEB — cut on the invalidation graph so
that a change in one does not silently invalidate the others. Read [docs/DIVISIONS.md](docs/DIVISIONS.md)
for the map, the routing rule for a new bug, and the frozen-engine-release rule. Each division's
ledger is `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md`; `status.js --write` stamps the numbers into them
and leaves the judgement alone.

*(WEB was added 2026-08-04 and this file said "four" in three places until 2026-08-05. The count was
cosmetic; the ledger list was not — the living-docs rule below named four ledgers, so a WEB change
carried no documented obligation to record itself anywhere.)*

The lessons that cost hours are in [docs/LESSONS.md](docs/LESSONS.md), written once.

## WILL TALKS TO YOU. YOU TALK TO THE DIVISIONS.

**He does not address subagents and should never be asked to pick one.** He says what he wants in
plain terms; you route it. That is the standing arrangement, not a mode he opts into — the `/abra`
skill states the routing rule but you follow it whether or not he invokes it.

One question decides the route: **which artifact does fixing this invalidate?**

| It touches… | Hand it to |
|---|---|
| a move, an ability, an item, the damage table, the simulator being wrong | `@engine` |
| whether a number is true — staleness, calibration, an SPRT result, the refit | `@measure` |
| what MILTANK clicks — leads, brings, opponent model, mega, post-KO | `@search` |
| the live bot, Showdown, replays, ingest, the store | `@ops` (read-only) |
| the site — ABRA WORLD, a room, a visualisation, a model interface | `@web` (renders, never authors a number) |

Spans two? Run the **upstream** one first; the graph is one-way. Routes nowhere? Say so and ask —
do not invent a home for it.

Report back **one answer**, not a transcript. Lead with the verdict. If the news is bad, give it
plainly — softening a result is the failure this whole structure exists to prevent.

## Cowork handoff

Cowork drafts docs and analysis; Claude Code applies, tests and pushes.

- Cowork writes ONLY to `docs/_inbox/`. Never anywhere else in the repo.
- Claude Code writes ONLY to `docs/_outbox/`. Never into `_inbox`.
  Single writer per folder, so the two sessions cannot collide.
- When the user says **"apply inbox"**: read every file in `docs/_inbox/`, apply what you agree
  with, fill any `<<MEASURED>>` placeholder with a real measured number, run the tests, commit and
  push, then move the file to `docs/_inbox/applied/` and write a short result note to
  `docs/_outbox/`.
- Cowork never authors a number. If a draft contains a figure that is not `<<MEASURED>>`, treat it
  as suspect and verify it yourself.
- You are the sole publisher. Cowork runs no git and no scripts.

## WHO MAY WRITE TO THIS REPO (S11 — one publisher)

Three agents can touch these files. Only one may touch git.

| Agent | May run tests/engines | May run git |
|---|---|---|
| **Claude Code** (runs on the machine, has the credentials) | yes | **yes — only this one** |
| **Cowork** (isolated VM, no git credentials, `push` cannot authenticate) | no — it has no real store | **never** |
| ~~**The workspace auto-commit**~~ — **DEAD since 2026-07-25 16:51. See below before reasoning from it.** | n/a | no longer fires |

**Cowork proposes; Claude Code applies and pushes.** Cowork must not run a git command at all. Not a
trust judgement — its shell cannot authenticate a push, so it fails partway and leaves state behind.
That is how this repo reached a detached HEAD 43 commits into a 45-commit rebase.

**Never run both agents against this repo at the same time.** They cannot see each other's edits and
the later write silently wins.

### A MEASURING AGENT MAY NOT RUN BESIDE A WRITING AGENT. THIS COST 7,100 GAMES.

The rule above was written about Cowork and it does not cover **division subagents**, which are
agents too. On 2026-08-04 three were dispatched at once — ENGINE on the mechanics, MEASURE on the
refit, SEARCH re-running WOBBUFFET — with their FILES separated so they could not clobber each other.
File separation was the wrong invariant, and the run was destroyed anyway:

| what moved under the measurement | when |
|---|---|
| `data/policy-weights.json` — **MAG itself, the thing being defended** — refitted by MEASURE | 22:15:24, between the two legs |
| `engine/medicham2-browser.js` — the simulator — **four distinct content digests** | 22:29–22:37 |
| `engine/board.js`, through which every candidate is scored | 21:50, mid-search |

The search froze the defender at 21:41 and the held-out replay reloaded it at 22:17. **The two legs
defended with different weight vectors**, and the 5,500-game search plus the 1,600-game replay are
void. Nothing crashed and nothing reported a failure, which is this project's signature failure mode
arriving through a door the rules had not covered.

**The invariant is not "different files". It is that a measurement is a PHOTOGRAPH — nothing in
frame may move, including files the measuring agent never opens.**

**THE FIX IS NOT TO RUN ONE AGENT AT A TIME.** (Will, 2026-08-04: *"we can run multiple agents at
once that's the whole point"*.) That was the first response to this failure and it is wrong twice:
it serialises four divisions that were cut apart precisely so they could run at once, and it is
PROSE — the thing this file says three separate times is a preference rather than a rule.

`docs/DIVISIONS.md` encodes an invalidation ORDER. Treating that order as a scheduling constraint
throws away the parallelism it exists to make safe.

**A MEASUREMENT DOES NOT READ THE LIVE TREE. IT READS A FROZEN RELEASE.**

```bash
node engine/engine_release.js cut "why"     # freeze; identical tree -> identical id
node engine/engine_release.js list          # and how far each has drifted since
```

```js
const REL  = require('./engine_release.js').open();
const MEDI = REL.require('engine/medicham2-browser.js');   // the SNAPSHOT's bytes
artifact = { ...REL.stamp(), ...result };                  // says exactly what was measured
```

**Twenty-three** files are frozen — the simulator, the board, the leaf, the features, the tags, the
loader closure, the lazily-read data files, **and the weights**, because "can anything beat MAG" is a
claim about one specific vector and the weights are what actually moved. It is a **copy, not a
checksum**: verifying digests afterwards only tells you the run was wasted.
`tests/test-engine-release.js` proves it by editing a live file while a release is open and asserting
the release still serves the old bytes.

*(This said "twelve" until 2026-08-05. The set grew twice, each time because a release that was a
valid DIGEST SET turned out not to be a loadable — then not a runnable — engine: +6 loader deps so
`REL.require` resolves, +5 lazily-read data files so a snapshot can actually play a game. Read the
count from `SOURCES` in `engine/engine_release.js`, never from this sentence.)*

**A re-cut over an identical tree appends, it does not overwrite.** Cutting twice yields the same id
by design, and the second cut used to rewrite the first one's timestamp and reason — so an artifact
could point at a release stamped minutes *after* the run that used it. Cuts are now events in
`data/releases/<id>/cuts.jsonl`; top-level `cut`/`why` mean the FIRST freeze and are never rewritten.

Now ENGINE may rewrite the simulator all night while SEARCH measures. **That is the point of the
divisions, and it only works because the measurement is not reading those bytes.**

**The router owns this, not the agent.** SEARCH could not have known; it was told the engine was
wrapped, and the census moved 157/165 → 164/171 while it worked. A subagent cannot see what it was
dispatched alongside — so the guard belongs at the measurement, not in a dispatch rule someone has
to remember.

**And nothing could have caught it.** `exploit.js` stamps no engine digest and no digest of the
target vector, and `engine/provenance.js` compared MTIMES — so the void artifact, being newer than an
input it had never read, was marked `ok`. Provenance now compares CONTENT and honours a
self-declared `void: true`. A stamped release is the first thing in this repo that can be *verified*
rather than assumed; the count of artifacts still resting on mtime alone is printed on every run and
is ratcheted downward in `data/provenance-stamp.json`.

**THE AUTO-COMMIT IS DEAD, AND THIS PARAGRAPH DESCRIBED IT IN THE PRESENT TENSE FOR TWELVE DAYS.**
(Will, 2026-08-06: *"WHY DO WE STILL HAVE AN AUTO COMMIT"* — we do not.) It was real: **513 `auto: <date>`
commits between 2026-07-22 and 2026-07-25, the last at 16:51 on the 25th**, and CHANGELOG 2.8.1 was
right that `push-all.bat` was not the source (it writes `manual push …`). **Nothing has fired since.**
Measured 2026-08-06: no scheduled task matches commit/push/git, `.git/hooks` holds only `.sample`
files, and this working tree sat modified for over an hour that evening without a single unattended
commit — a natural experiment a ~2-minute timer could not have survived.

**THE COST OF LEAVING IT IN THE PRESENT TENSE WAS NOT ZERO.** On 2026-08-06 a session committed early
*specifically* to avoid a partial auto-push — a real decision taken against a hazard that had not
existed for twelve days. Worse, this paragraph was the stated reason there was **no pre-commit hook on
the living-docs rule**, and that rule broke that same evening: commit `f60b01c` stamped `3.60.0` in its
message with no CHANGELOG entry, written by the session that had just quoted the rule. **A hook now
exists** (`.githooks/pre-commit`, armed with `git config core.hooksPath .githooks`); it skips during a
rebase and on data-only commits, and it has been shown RED on a deliberate break before being trusted.

This is the same shape as the fourteen stale handoffs and the hand-maintained ban list of four: **an
observation written down as prose, kept past the thing it described.** What follows still stands on its
own merits — a half-finished rebase is dangerous whoever interrupts it:

- **Before any git work, `git status` must be clean AND no rebase may be in progress.** Check first,
  every time. If a rebase is in progress, FINISH it (`git rebase --continue`) — do not `git checkout`
  away from it, which abandons every commit already replayed.
- `push-all.bat` stays disarmed behind its `GO` argument and refuses to act mid-rebase. Leave it that
  way. Its header comments still describe the retracted timer diagnosis and point at
  `find-autocommit-task.bat`, which was deleted — ignore both.
- Never use `git merge -X ours`, and never restore `merge=union` in `.gitattributes`. The union driver
  is the confirmed cause of the store duplicating, it applies to `rebase` as well as `merge`, and it is
  why switching to rebase alone did not stop it. See `.gitattributes` and CHANGELOG 3.1.2.

## What ABRA is
The Automated Battle Replay Analyzer. It ingests public Champions Reg M-B replays from Pokémon
Showdown, models the ladder meta, and feeds `data/meta-usage.json` to CHOMP. **Separate but
connected to CHOMP** — CHOMP is only the pick-4/lead-2 engine; ABRA is the meta brain.

## The one principle that governs the data
**Store raw, analyze on top.** Every game is stored durably with every fact we might ever want,
plus rating and bot tags. All filtering/analysis runs on the store. Changing how we segment games
is a re-filter, never a re-pull. Never design an analysis that forces re-fetching replays.

## The failure mode this project actually has (2026-07-28)

Every serious bug found on 2026-07-28 had ONE shape: **a capability was absent, and everything
reported success.** No exception, no failed test, no discarded game.

- the player had never read a team sheet — `setSheet()` existed, six offline scripts called it,
  `magnemite.js` never did
- self-play had never used open team sheets — 0 `|showteam|` in 1,934 games, and structurally
  impossible in the ladder format
- mega evolution never fired on the server, and in self-play only from the LEFT slot
- the joint layer fell back on 100% of eligible turns
- PORYGON2 and DODUO were fitted, saved, quoted in documents, and never once in a live decision

**These are invisible to every automated check.** A head-to-head, an exploitability search and a
prediction score all compare two bots that SHARE the blind spot, so a missing capability cancels
out exactly. Only a human looking at the screen found them.

### The rules that follow

**A capability that cannot prove it ran is assumed broken.** Every capability emits a counter, the
run prints it, and a zero is called out. `tests/test-wiring.js` plays real games and FAILS if a
counter is zero. Not "is the code there", not "did it parse", not "did the run finish" — all of
those were true every time.

**Non-zero is not always a strong enough bar.** Mega passed "at least one happened" while running
at 56% of sides against the correct 85%, because the base class could only mega from the left slot.
Where a domain rule exists, it becomes a RATE floor: Will's "a game without a mega should be rare"
is now a test threshold.

**Replacing a hedge with a certainty is only an improvement if you also track what invalidates the
certainty.** The Focus Sash drag was a 78.6% population prior. Trusting the open sheet made it a
hard 1.0 — better on average, and CATASTROPHIC after a Knock Off, because nothing tracked that the
item was gone. A probability is wrong more often and fails more gracefully. If you sharpen an
estimate, you inherit responsibility for every event that stales it.

**Correct the diagnosis, not just the bug.** The Focus Sash example above is real but was NOT the
worst case, and Will caught that too: Knock Off DEALS DAMAGE, so the target is no longer at full HP
and the Sash drag never applied anyway. The genuine cost of an untracked Knock Off is that the
damage and speed calculations keep applying an Assault Vest, Choice Scarf or Life Orb that is gone —
and those apply at ANY hp. A fix aimed at the wrong mechanism is still a bug.

**Prefer OBSERVED over DECLARED.** The sheet says what they started with. Knock Off (1,640 uses),
Trick, consumed berries and used Sashes all make it a lie mid-battle.

**FEATURES ARE PER-MODEL. FACTS ARE GLOBAL.** (Will, 2026-07-30: *"does every model need our
features to flow through them? would it ever make sense for each model to have their own
features?"*)

The models answer differently-shaped questions and must NOT share a feature vector. MAG scores an
ACTION — what happens if I click this. A value function scores a POSITION with no action attached.
SLOWKING scores a BRING, four of mine against six of theirs. DITTO scores a TEAM with no opponent
at all. Feeding action-features to a position model is a category error, so
`engine/position_features.js` having its own 15 is correct rather than duplication.

What they must NEVER each own is a FACT about the game: how much damage this does, who moves first,
whether that ability refuses this move, what the sheet declared. One implementation, everyone calls
it. Two files that both decide Choice Scarf multiplies Speed by 1.5 will disagree eventually, and
the disagreement will be invisible because both keep working.

Every integrity bug found on 2026-07-30 was this rule broken — a fact living inside feature code and
diverging:
  - priority blocking sat in the artifact and was read by `clickFragility` and by nothing else, so
    Sucker Punch beat a Farigiraf in every rollout and every self-play game ever run;
  - the sheet's ITEM and ABILITY reached `switchIn` and not `switchFeatures`;
  - the sheet's MOVES reached `dmgMon` and not `position_features`, so every Pokemon was valued on
    the dataset's average moveset instead of the one it declared.

A legitimate exception, so the rule is not misread: `board.js` computes EXPECTED speed across
unknown spreads while `medicham2` computes EXACT speed for a built mon. Those are different
questions and both deserve to exist. The MULTIPLIERS underneath them — Scarf x1.5, paralysis x0.5,
Tailwind x2 — are the fact, and must be one function that both call.

Enforced by `tests/test-engine-consistency.js`, which asserts the FACTS agree across engines and
deliberately says nothing about whether their features match.

**A DERIVED ARTIFACT IS NOT A FACT UNTIL SOMETHING COMPARES IT TO ITS SOURCE.** (Will, 2026-07-30:
*"bro arent we making sure all fixes get applied to every applicaiton? how was this not caught? i
want a thorough audit"*)

The rule above covers a fact reaching every MODEL. It does not cover a fact reaching the ARTIFACT
that carries it, and that is a separate hole. `data/mega-dex-official.json` held an ability for all
340 formes, `engine/merge_mega_into_engine.js` existed to apply them, and `data/engine-data.js`
still had `ab: null`, `mv: []` and `item: null` on every mega — 26.0% of this format's usage. The
builder keyed `venusaurmega` while the artifact keyed `venusaur-mega`, so zero of its 67 writes ever
matched, and a later wholesale regeneration left the nulls in place. Nothing noticed, because
nothing compared the two files. The empty `mv` was the expensive half: `buildMon` returned a Pokemon
with no moves, so every mega scored as threatening NOTHING.

So: a generated file needs a check that its SOURCE's values are actually in it. Three things that
check must do, learned from getting each wrong first:
  - judge a builder only on the rows it actually WRITES. Averaging over rows it skips will clear the
    builder that is broken;
  - ask whether the ARTIFACT has two keys that normalise alike, not whether the two files spell keys
    the same. Spellings differ legitimately; duplicates never do. A check that keeps firing after
    the fix gets ignored, which is how the hole survived;
  - treat "newer than its source" as no evidence at all. `engine-data.js` was newer than the merge
    script and had still lost its output.

A gap that is a JUDGEMENT gets declared with its reason, like `RAW-STORE-OK` — Ditto keeps a null
ability because the dex's slot 0 says Limber and every Ditto that matters runs Imposter.

Enforced by `engine/artifact_audit.js`, registered as a GATE in `tests/run-all.js`, because this was
invisible for exactly as long as nobody ran it.

**Fitting environment and playing environment must match.** MAG's weights were fitted WITH the
sheet visible and the bot played WITHOUT it. MACHAMP's champion was trained under broken mega. Same
error, twice: trained under one set of capabilities, deployed under another.

## Flags vs tags — one vocabulary, written down

**A FLAG is Showdown's** (`move.flags.contact`) — upstream, canonical, boolean, never invented here.
**A TAG is ours** (`redirects`, `swapsStat`), derived by `engine/tag_dex.js` into `data/tags.json`,
carrying **params**. Flags feed tags; the engine reads tags. Match on **tag shape, never on a name**,
so an ability added later is picked up without editing the engine.

The full spec — the interaction model, the five-stage resolution order and why the stage decides
what failure looks like, and the checklist for adding a mechanic — is [docs/TAGS.md](docs/TAGS.md).

## Where things are
- `engine/durable-ingest.js` — the pull+store (source of truth for the schema; `extract()` exported).
- `engine/analyze.js` — views + writes the model CHOMP reads.
- `data/games.ladder.jsonl` — the append-only store. `data/meta-usage.json` — the CHOMP-facing model.
- `tests/test-parse.js` — pins the extractor.

## The CHOMP loop
ABRA produces `meta-usage.json`; CHOMP reads it to infer real leads/sets. When ABRA improves, CHOMP
gets smarter without a plugin change.

## "KNOWN FAILURE" IS A BANNED PHRASE

A red test is never a status. It is either **fixed in the session that saw it red**, or **waived by
Will, by name, out loud**. There is no third state, and reporting one is what this rule exists to
stop.

*(Will, 2026-07-30: "HOW WAS CLAUDE.MD JUST BEING IGNORED")*

The rule below — living docs move in the same pass as the code — was written, was given a guard
(`tests/test-docs-current.js`, built 2026-07-25), and was broken anyway for two consecutive days
across ~40 commits. **The guard was not missed. It was red on every run and reported as "one of the
two known failures."** Naming it *known* is what made it acceptable; each report made the next one
easier. The docs then fell four days behind the code, and the next session mischaracterised the whole
model family because of it — DODUO called unbuilt when it had been built, wired, controlled and
measured at 42.0%; MEDICHAM audited in its graveyard version; pruning "proposed" that
`fit_joint.js` already implemented.

This is the same lesson as `engine/artifact_audit.js`: **a check nobody acts on is not a check.** A
new gate was registered on 2026-07-30 to prevent silent regression while an existing gate sat red
beside it.

~~No pre-commit hook enforces this, deliberately.~~ **REVERSED 2026-08-06.** The stated reason — that
a blocking hook would collide with the auto-commit timer — rested on a timer that had not fired since
2026-07-25. `.githooks/pre-commit` now runs the docs-currency and roadmap-register gates (~2s) on any
commit touching `docs/`, `engine/`, `tests/`, `web/` or the top-level markdown; it skips mid-rebase and
on data-only commits, and it was demonstrated RED on a deliberate break before being armed.

**The hook does not replace the sentence, because a hook cannot read a report.** The original failure
was normalisation — a red gate reported as "one of the two known failures" for two days — and no hook
catches that. So this still governs: **say the test is red and what you are doing about it, or fix it.
Never file it.** And do not pass `--no-verify`; if the gate is wrong, fix the gate and say so.

## EVERYTHING DOWNSTREAM OF MEDICHAM IS QUARANTINED UNTIL MEDICHAM IS CORRECT

*(Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
should stop referencing them until medicham is up to date and we can rerun them".)*

`docs/DIVISIONS.md` states the graph and says it is one-way:

```
  MEDICHAM  ──►  board.js  ──►  MAG weights  ──►  MILTANK baselines  ──►  live
  (engine)       (features)     (the refit)       (every H2H result)
```

One-way means a wrong simulator does not stay in ENGINE. It reaches every number to its right. On
2026-08-08 MEDICHAM is **known incorrect** — Weather Ball ignores three of the four weathers on 8,620
uses, Sand Rush and Damp fire in Showdown and not here, Solar Beam never charges, a transform never
reverts. So every figure to the right of that arrow was measured under an engine that does not play
this game, and **may not be quoted, compared against, or reasoned from.**

QUARANTINED — do not cite until MEDICHAM passes its gate and the run is repeated:
R1 leaf accuracy, R2 leaf cost, R3 divergence, R4 head-to-head, leaf calibration, the
engine-correctness→leaf comparison, `data/policy-weights.json` and the joint weights, and every
model report that reads a rollout (MAG, DODUO, PORYGON2, SLOWKING, GARY, MILTANK).

NOT quarantined, because they MEASURE MEDICHAM rather than consume it: the census, the interaction
matrix, the game differential, the deliberate roster, and everything OPS reports out of the store
(`meta-usage.json`, usable %, battles recorded) — the store is upstream of the simulator, not
downstream.

**A CAPTION IS NOT A QUARANTINE.** `status.js` already printed `PRE-CHANGE` and
`[engine moved since; transfer assumed, not measured]` beside these numbers and they went on being
quoted anyway, including by me. That is the identical failure to "one of the two known failures" one
section up: the number is rendered, the warning is skimmed, the number gets used. **The figure must be
WITHHELD, not annotated.** Printing it with a caveat is the bug.

**THE GATE IS READ, NOT REMEMBERED.** Quarantine lifts on a measured condition, never on somebody
deciding MEDICHAM feels finished — the fourteen stale handoffs and the ban list of four are what a
remembered state is worth here. The condition is that the differential shows no disagreements and the
deliberate roster shows no `FIRED-AND-BOARDS-DIFFER` and no `DID-NOT-FIRE` across items, abilities
and moves. `engine/status.js` computes it and says which clause is failing.

**Re-running is not optional once it lifts.** A quarantined number does not become true when MEDICHAM
becomes correct; it becomes re-runnable. The re-run list is ROADMAP #57.

## Living docs — update these EVERY change (do not let them drift)
Any change to a model, a result, or the site updates ALL of the following in the **same pass**, each
with its matching PDF where applicable, plus a CHANGELOG entry and a version bump:
- `docs/ABRA-whitepaper.md` (+ `.pdf`) — technical, with math + cited sources + honest results/CIs.
- `docs/ABRA-deck-plain-english.md` (+ `.pdf`) — plain-English; links the white paper on the last slide.
- `docs/ABRA-technical-docs.md` (+ `.pdf`) — ASD-STE100 Simplified Technical English, by Diátaxis.
- `docs/SUMMARY.md` (+ `.pdf`) — whole-project + per-component summary table.
- `docs/MODELS.md` — the per-model living ledger.
- The division ledger your change belongs to — `docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md` — and then
  `node engine/status.js --write` to restamp the generated blocks. **Never hand-edit inside a
  `<!-- GENERATED -->` block, and never write a handoff document.** State is printed, not typed;
  `docs/HANDOFF-*.md` are historical narrative and are not maintained.
- `CHANGELOG.md` — Keep-a-Changelog; the top version matches the artifacts.
A result reported on the site or in the deck must match the number in the white paper and the model's
JSON report. Rebuild PDFs from the `.md` (pandoc → HTML → weasyprint; see `docs/` build notes).
This standard failed once by drifting to v1 while code moved to v2 — it is now written down so it is
checked, not remembered.
