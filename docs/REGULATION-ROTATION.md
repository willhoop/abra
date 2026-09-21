# REGULATION ROTATION — what has to change when a new Champions regulation goes live

**Version: 0.19.0 — 2026-09-21.**
**Line: abra/regmc** — `CHANGELOG-REGMC.md`.


**Opened 2026-09-20**, during the Reg M-B → M-C rotation. Will: *"identify all the things we need to
update in between regulations and make a list so its easier for next time"*.

## READ THIS FIRST: THIS PAGE IS NOT THE LIST

The list is **printed**, not typed. A typed inventory of every file that names a regulation is the
fourteen stale handoffs in a new costume — and it would be a longer list than any of them:

```bash
node engine/regulation_touchpoints.js            # every tracked file naming a regulation, classified
node engine/regulation_touchpoints.js --rules    # how each class was decided, so you can check it
node engine/next_regulation.js --checklist       # the readers of the config, and the order of the flip
node engine/format_id_scan.js                    # typed format-id call sites under engine/ build/ tests/
```

What this page carries is the part **no scan can derive**: the ORDER the steps unblock each other in,
and the judgements a person has to make. Every step below is marked:

- **DERIVED** — a command prints the answer. Run it; do not remember it.
- **JUDGEMENT** — a person decides, and the decision is written down with its reason.

The classes `regulation_touchpoints.js` reports mean different work, and the counts are useless
undifferentiated:

| class | what the rotation does |
|---|---|
| **CONFIGURATION** | EDIT it. The id is a setting and everything downstream follows it. |
| **HARDCODED** | DECIDE, per site. After the flip it keeps working, about the OLD regulation, reporting success. |
| **DERIVED** | RE-RUN its generator. No edit — but the figure is about the old regulation until you do. |
| **COMMENTED** | Read once. The id is only in a comment: stale prose living inside live code. |
| **PROSE** | Rewrite at the documentation pass. Judgement, never a find-and-replace. |
| **HISTORICAL** | **LEAVE IT.** Dated evidence, frozen releases, archived stores, findings records. Rewriting these edits the evidence chain, which this repository forbids. |

---

## THE ORDER

### 1. Collect the new regulation from the day it exists — DERIVED, and already automatic

`engine/next_regulation.js` derives candidate format ids by SHAPE and probes three authorities; the
hourly `.github/workflows/next-regulation.yml` collects them. Nothing here needs an edit for a
regulation to start being stored.

**Collectable and simulatable are two different questions, and the checkout LAGS.** A format can be
laddered for days before the local Showdown checkout carries it. `next_regulation.js` reports the gap
rather than smoothing it; believe the report.

### 2. Take a SECOND checkout. Never pull the one the closing regulation's figures rest on — JUDGEMENT

This is the lesson the M-C rotation paid for first. A single Showdown checkout that gets pulled moves
the authority **under the published figures of the regulation that is closing** — the same failure as
a measurement reading a live store, one level up. The two checkouts and their roles are recorded in
[`docs/REGMC.md`](REGMC.md).

The outgoing checkout becomes **pinned**: never pull it, never build it, never modify it. Prove the
separation disturbed nothing rather than assuming it — the M-C pass compared the outgoing format's
legal species set across both checkouts and found it identical (CHANGELOG 7.1.0).

### 3. Derive the delta AGAINST THE PINNED AUTHORITY — DERIVED, and the shortcut is a trap

The new checkout ships a backward-compatibility mod for the old regulation, so it is tempting to
derive both sides from one set of bytes. **That mod is not a faithful reproduction of what ABRA was
built against.** On this rotation it failed to revert the moves the delta names, so the same-bytes walk reported
*moves +0* where the honest answer against ABRA's pinned authority was a non-zero count
([`docs/_reports/2026-09-20-regmc-delta.md`](_reports/2026-09-20-regmc-delta.md) §1). Both numbers are
true statements about different questions; only one of them describes the work.

Four things the delta must ask, because three of them are invisible to a legality list:

1. **Added and removed**, by id, for species, moves, items and abilities — the easy half.
2. **Entries legal in BOTH regulations whose DEFINITION moved.** On this rotation two moves had their
   PP halved (§3.1). Every *what was added / what was removed* list shows nothing, and an engine built
   as *the old regulation plus the new things* carries the old value forever.
3. **The ruleset and the ban list, asked of the format rather than recalled.** A ban that LIFTS reads
   as no change at all in an added/removed list. One did on this rotation (§6), and it is named in the
   umbrella `CLAUDE.md` ban list, which becomes wrong the day the new line goes active.
4. **Learnsets, confirmed with the `TeamValidator` in both directions.** The first instrument used on
   this rotation climbed the pre-evolution chain and reported zero changed species; the validator
   disagreed for a heavily-used one (§4). A control that returns opposite verdicts across the knob is
   what made the second answer believable.

**Count MECHANICS, not species.** A third of the added species on this rotation brought no new ability
and no new move (§5). Counting species overstates the work and points it at the wrong things.

### 4. Re-admit what the strict legality filter drops — JUDGEMENT, with a printed list

`CLAUDE.md` requires every dex walk to be filtered, and that rule is right. On this rotation the
filter **silently dropped a live ability** carrying `isNonstandard: "Future"` — the validator accepts a
legal set carrying it and it has a real handler body
([`docs/_reports/2026-09-20-regmc-delta.md`](_reports/2026-09-20-regmc-delta.md) §7). A generator or a
census walk built on the strict filter would never see it, never stage it, and report full coverage
while doing so: **a capability absent with everything reporting success.**

**Will, 2026-09-20: legality is what the `TeamValidator` accepts.** A flag is evidence, never the
answer. So: filter as before, then re-admit the flagged entries the validator accepts, and **print the
re-admitted list on every run** so it can never be silently empty.

### 5. Decide the scope — JUDGEMENT

Which information regime (open sheets, bo1, bo3), which exclusions, which population is in scope. The
M-C decision was *the same scope as the outgoing regulation, for now* — explicitly a decision to
revisit once the format is understood, because added mechanics can change what is worth modelling
([`docs/REGMC.md`](REGMC.md)).

Nothing derives this. Write down the decision and the words it was made in.

### 6. Check whether the upstream RULES moved mid-regulation, and cut by the CONJUNCTION — JUDGEMENT

A regulation's rules are not fixed on its start date. On this rotation an upstream Showdown commit
changed an item interaction **days after the format went live**, so replays collected in that window
were played under a different rule regime than the ones after it. Any measurement over that store must
exclude the window or account for it.

**The exclusion is a CONJUNCTION, not a date range.** Will: *"i mean can we just remove the games that
have an eject button on the team sheet"*. A game leaves the pool only if it was played before the fix
**AND** the item appears on a team sheet; the rule change cannot have altered a game the item never
appears in. The date cut alone was proposed, called cheap without being measured, and would have
discarded roughly twenty-five times more evidence than the change could possibly have affected
(CHANGELOG 7.2.0).

**And the conjunction is exact rather than approximate, because of the information regime.** Under
open team sheets every item on the field is declared by one of the two players, so scanning BOTH
sheets catches an item transferred mid-battle. That was measured, not assumed (CHANGELOG 7.2.0). Under
closed sheets the same argument does not hold and the cut would have to be wider — **check the regime
before reusing this reasoning.**

### 7. Archive the outgoing regulation — DERIVED, and it is the one unrecoverable step

```bash
node build/triggers.js               # says whether the archive is already due
node build/archive-regulation.js     # snapshots store + raw logs + models into data/archive/<reg>/
```

Do this **before** the flip. Everything it writes is HISTORICAL from that moment.

### 8. Flip the config — DERIVED list, JUDGEMENT on when

`data/regulations.json` is the single place the active format id is a setting. Setting `active`
simultaneously re-points the ladder collector, re-labels the model CHOMP reads, and re-points the
simulator at a format the pinned checkout may not carry.

```bash
node engine/next_regulation.js --checklist   # the block to paste, the direct readers, the order
```

**AND `active` IS NO LONGER THE ONLY WAY TO SAY WHICH REGULATION A RUN IS ABOUT — 2026-09-21.** It is
the DEFAULT, and a run may now name one instead:

```bash
node <anything> --regulation regmc        # or ABRA_REGULATION=regmc; both bring the right checkout
```

`engine/regulation.js` is the single resolver and `champions_sim.FORMAT` reads it, so every caller
follows with no edit. **This matters to the ORDER of this page**: flipping `active` used to be the
only way to run the incoming regulation at all, so it had to happen early and it moved the whole
repository at once. It can now happen when the outgoing regulation is genuinely finished, with both
runnable side by side in the meantime. A run that rewrites shared config is a run that can corrupt
another one beside it, and two agents on two regulations share one `active` key.

Two things it does NOT change, and both are the point of the two maps:

- **`data/regulations.json` has a second map, `runtime`, and the incoming regulation goes THERE
  first.** `engine/next_regulation.js` walks `regulations` to decide what is already known, so adding
  the incoming id to `regulations` reclassifies it from `candidate` to `known` and the hourly
  collector quietly stops collecting it. **Being selectable is not being active.**
- **Everything a MEASUREMENT pins is still separate** — step 9 below is unaffected. The flag selects a
  format and a checkout; it does not select a pool, a census or a release.

**Three things the config does NOT control, and each one is a separate decision:**

- **Which Showdown checkout is the authority.** ~~That is resolved by `engine/showdown_path.js` from a
  sibling directory, not from the config. A second checkout (step 2) therefore needs an explicit
  `SHOWDOWN_PATH`, per run or per shell.~~ **Superseded 2026-09-21**: the checkout is now part of the
  regulation. `runtime.<id>.checkout` in `data/regulations.json` names it and
  `engine/showdown_path.js` tries it first, so selecting a regulation selects its authority. An
  explicit `SHOWDOWN_PATH` still wins over all of it, for a checkout kept somewhere else. **The
  pinned commit moved with it** — `champions_sim.PINNED_COMMIT` was a literal and one constant cannot
  pin two authorities.
- **The silent fallbacks.** Several scripts read the config inside a `try` and fall back to a
  hardcoded format id when the read fails — deliberately, so a batch job guesses rather than crashes.
  `engine/champions_sim.js` ANNOUNCES its fallback on stderr and records why; the others are silent.
  Run `node engine/regulation_touchpoints.js --class hardcoded` for the live list. **A silent fallback
  after a flip is this project's signature failure mode**: nothing is broken, nothing reports a
  failure, and every downstream figure is about the previous regulation.
- **The pinned corpora** — step 9.

### 9. Re-point what a MEASUREMENT pins — three things, none of them the config

A frozen release pins the engine SOURCE files. It does not pin the store, the pool, the census or the
artifacts, and a rotation moves all four. `regulation_touchpoints.js` prints the frozen corpora it can
find and how many live source lines name each — **it cannot see them by id, because a pinned path
carries no regulation id at all.**

| pin | what the rotation does |
|---|---|
| **the frozen team pool** (`--team-store`) | The new regulation gets its **own** pinned pool, cut from its own store with step 6's exclusion applied. The old one is the old regulation by construction and is never re-pointed. |
| **the census pin** | Regenerate for the new format. A count taken either side of a census regeneration is **not a before/after**. |
| **the gate's lattices** (`--games` values) | `engine/quarantine.js` requires zero on several sample sizes chosen by walking the swarm builder so the samples share few teams. A zero that holds at one sample size is a fact about that sample. Re-derive the sizes against the new pool with `node engine/lattice_walk.js --regulation <new> --anchor 1200 --from 1250 --to 2000 --greedy 2` and add one row to `LATTICE_GAMES` in `engine/quarantine.js`. |
| **every gate artifact** | Nothing to re-point: `engine/regulation.js` `artifactFor` sends every artifact the gate reads or an instrument writes to `data/<name>-<new>.<ext>` (pool: `data/team-pool-frozen-<new>`) for any regulation but Reg M-B, and refuses a write onto any other existing `data/` file. Run the gate with `--regulation <new>`. A new artifact family gets a pattern in `PER_REGULATION_ARTIFACTS`; `tests/test-regulation-artifacts.js` fails until it has one. |
| **the release set** | Every release cut before the flip describes the previous regulation. Cut the first new one only after the rebuild and re-point steps below have settled, or it freezes the old format. |

### 10. Rebuild what the format decides — DERIVED

Every artifact in the DERIVED class is regenerated, not edited. `--checklist` prints the builders in
dependency order. Each is a frozen-release source or an input to one, so a release cut before they
settle freezes the previous regulation.

### 11. Decide every HARDCODED site — DERIVED list, JUDGEMENT per site

```bash
node engine/regulation_touchpoints.js --class hardcoded
```

**This is the list worth shrinking, and it is NOT a find-and-replace.** Three kinds live in it and they
want opposite treatment:

*(Shrunk on 2026-09-21 — the counts are in `CHANGELOG-REGMC.md` 0.10.0 and the live list is PRINTED by
the command above, never typed here. Every site closed was the FIRST kind below: an inlined
`JSON.parse(readFileSync('data/regulations.json'))` in a `try`, with its own copy of the format
literal in the `catch`, and all but one of them silent when it fell back. They read
`engine/regulation.js` now, which carries the one surviving literal and answers the DEFAULT path only.
What remains is the second and third kinds — workflows, UI pages, the M-C pool cutter and probe
fixtures pinned to the format they were measured on, including a deliberate Reg M-A control.
Full account: `docs/_reports/2026-09-21-regulation-runtime.md` §7.)*

- **A fallback or a default in engine code** — should read the config, and should say so out loud when
  it cannot. This is the avoidable cost.
- **A pin on what was MEASURED** — a replay id, a probe fixture, a deliberate old-regulation control.
  **Rewriting one edits the record.** `engine/format_id_scan.js` states this doctrine and takes no
  position on which sites are wrong, correctly: the caller decides.
- **A workflow or a UI string** — a shell loop naming the format, a placeholder in a page. Cheap, and
  visible to a user, so it is the kind that survives longest unnoticed.

### 12. Re-measure. Nothing carries over — JUDGEMENT

A figure measured under the old regulation is not stale, it answers a question nobody is asking any
more. Under this repository's versioning that is a **basis change**, so it is a MAJOR and the old
figures come OUT of the living documents rather than being captioned. A caption is not a quarantine.

```bash
node engine/status.js       # what is stale, what is withheld, what is owed
node engine/provenance.js
node engine/open_work.js
```

### 13. The documents — JUDGEMENT

The ban list in the umbrella `CLAUDE.md` is a *mechanism, not a list* and must be re-asked of the new
format. The white paper, the deck, the technical documentation, `docs/SUMMARY.md` and `docs/MODELS.md`
are rewritten at the major, from the running-notes rows. `regulation_touchpoints.js --class prose`
prints which documents still name the old regulation.

---

## WHAT CANNOT BE DERIVED, AND MUST BE JUDGED EVERY TIME

A runbook that pretends judgement is mechanical is worse than none. These do not have commands:

1. **Scope.** Which information regime is in scope, which exclusions stand, whether the new mechanics
   change the answer. A derivation can list what arrived; it cannot say what is worth modelling.
2. **What to exclude, and on what predicate.** The date-versus-conjunction choice on this rotation was
   the difference between discarding a third of a store and discarding barely any of it — and the
   conjunction is only exact because of the information regime. Measure the cut before taking it.
3. **Whether a figure is comparable across regulations.** Usually it is not: the basis moved. But
   "usually" is not a rule, and `engine/arms_comparable.js` answers only for one artifact and only
   within one regulation. State the claim; do not let a number drift across the boundary unlabelled.
4. **Which HARDCODED sites are defects and which are pins.** Structural scanning finds the sites. Only
   a reader can tell a stale default from a deliberate record of what was measured.
5. **When to flip.** Collectable, simulatable and *worth switching to* are three different dates.
6. **What a divergence MEANS in a format nobody has played yet.** The new mechanics have no baseline,
   so the first runs have nothing to be a regression against.
7. **Which CUSTOM-RULE rooms are contamination and which are the target population** — added 0.6.0,
   and it is a genuinely different answer per regulation. A tournament room played under Showdown's
   custom rules is indexed under the BASE format id, so `search.json?format=` pulls it into the
   ordinary store; `engine/durable-ingest.js` filters on the format id and a format id does not encode
   custom rules. On the Reg M-B ladder that is a twentieth of the store and all of it is out of scope
   (`data/quality-filter.json` `exclude_custom_ruleset`). **On Reg M-C the same scan gives the opposite
   answer**: nearly every custom-rule game in `data/team-pool-frozen-regmc/games.ots.jsonl` is a
   `Force Open Team Sheets` room — and that rule is what makes a ladder game open-sheet, which is the
   M-C scope. Copying the M-B rule across would delete the evidence the scope was chosen to collect.
   The counts are in [`docs/REGMC.md`](REGMC.md) and the full account in
   [`docs/_reports/2026-09-21-custom-ruleset-filter.md`](_reports/2026-09-21-custom-ruleset-filter.md).
   **DERIVED** for the counts, **JUDGEMENT** for the cut:

   ```bash
   node engine/scan_custom_rulesets.js \
     --raw data/games.<store>.raw-logs.jsonl --store data/games.<store>.jsonl --out /tmp/scan.json
   ```

   Read the UNTESTABLE line before reading anything else: the infobox is in the RAW log, so the answer
   is always a floor. On Reg M-C that line says the great majority of the store has no local raw log —
   which does not mean *M-C is nearly clean*, it means *M-C has barely been asked*.

## FOUND DURING THE REBUILD — APPEND A ROW EVERY TIME ONE BITES

*(Will, 2026-09-21: "make sure to continuously update the regulation change document so next regulation
change is even easier".)* **This section is appended in the same commit as the fix that found it.** One
row per trap: what bit, how it showed, what to do next time. The steps above say what to do; this says
what went wrong while doing it, in the order it happened on Reg M-B → M-C.

| what bit | how it showed | next time |
|---|---|---|
| **Three files are per-regulation, not one.** The species table, `data/tags.json` and `data/protocol-events.json` are each derived from the format. | The first new-regulation games parted on things the new format added (terrain setters, new mega stones) because the OLD tag file had no row for them. | Add the three to `runtime.<reg>` in `data/regulations.json` on day one; `fileFor` in `engine/regulation.js` redirects all three and refuses a write onto the old regulation's files. Derive each with the new checkout. |
| **A reader that loads a tag file by path bypasses the redirect.** `engine/names.js` read Reg M-B's tags under Reg M-C. | The differential picked Reg M-C teams by Reg M-B membership. Nothing failed. | After adding the per-regulation files, grep for every direct load of `tags.json` / `protocol-events.json` / `engine-data.js` and route it through the selector. |
| **Editing a DERIVER restales the old regulation's artifact.** 0.14.0 added `--out` to `engine/derive_protocol_events.js` without regenerating Reg M-B's `data/protocol-events.json`. | Every differential, roster and battery run refused to start with "produced by … and that file is now …". A battery script that greps an OLD artifact afterwards then printed last run's clean numbers as if they were new. | Any edit to a deriver: regenerate the old regulation's artifact in the same commit and show it is byte-identical apart from its stamps. Read each run's exit code before any figure a wrapper prints. |
| **The pre-commit audit copied the whole Projects folder into `%TEMP%`.** `engine/artifact_audit.js` read `path.join(ROOT,'..','..','..','..',c)` in `engine/regulation.js` as a sibling checkout named `..`. | Every commit hung silently for minutes; stray copies (`%TEMP%/Pokemon`, `agents`, `worktrees`) piled up. | Fixed 0.15.0 (a name made of dots is not a sibling). If a commit hook goes silent, look at `%TEMP%` for a fresh copy of the repo's parent before anything else. |
| **The new regulation's smoke IS the work list.** | The first Reg M-C games played end to end the first time, and most of those that parted did so on terrain set on entry (`docs/_reports/2026-09-21-regmc-table-wiring.md`). | Build the species table, run a small unpinned smoke immediately, and rank by FIRST CAUSE. It found the headline features of the new format before anyone read a patch note. |
| **New mega stones arrive untagged.** | "Mega forme did not evolve" in the first smoke (`docs/_reports/2026-09-21-regmc-tags.md`). | Check every legal stone in the new format has its mega tag right after deriving the tag file. |
| **The closed regulation needs a regression check, not a re-measure.** | A full Reg M-B battery was re-run on 2026-09-21 and was not needed. | For the closed line: damage differential identical plus one lattice at 0. Anything more is re-measuring a published result. |
| **A whole item class came back from `Past` with no mechanic tag.** The terrain seeds were illegal in Reg M-B, so the old tag deriver never needed a rule for them; in the new tag file they carried only `flingable`, and tag_dex's coverage report did not flag them because `flingable` counts as a tag. | The largest first cause of the smoke by far, as a missing `-enditem` (`docs/_reports/2026-09-21-regmc-tags.md` §5, `docs/_reports/2026-09-21-regmc-seeds.md` §5). | After deriving the new tag file, list every item, ability and move that is legal now and was `Past` before, and read its handlers. Treat "only generic tags" (`flingable`, `pp`, `targetClass`, …) as UNTAGGED. Rocky Helmet, Air Balloon and the Eject items are the same class. |
| **A first-cause label can name the wrong mechanism.** The smoke card read "Grassy Terrain heal ORDER"; the authority was skipping a semi-invulnerable body. | One game, two heal lines in a different order (`docs/_reports/2026-09-21-regmc-seeds.md` §0). | Open the card's `before` lines before naming a cause. And ask whether the real mechanism also exists in the closed regulation: this one did, so the fix moved the closed line's engine and needed the row-7 regression check. A census row for it would move a figure the closed line published, so it was withheld for a decision (see the next row). |
| **The census belongs to the closed regulation.** `data/mechanics-census.json` is built from Reg M-B's table and tags, so a mechanic legal only in the new format has no row it can go live in, and a row for a shared mechanic moves the census count the closed line published. | The seeds have a staged probe and no census row; the heal row went live and was withdrawn when `tests/test-docs-current.js` refused the moved count in three published documents (`docs/_reports/2026-09-21-regmc-seeds.md` §0). | Give the new regulation its own census file early (the same `runtime.<reg>` map as the per-regulation files above). Until then, prove a mechanic with a `--regulation` probe and a knob, and say so in the changelog. |
| **The gate and every instrument wrote ONE fixed path.** Only the three engine files were per-regulation. | A Reg M-C `--write` would have overwritten Reg M-B's published evidence and exited 0, and the gate could only answer for Reg M-B (`docs/_reports/2026-09-21-regmc-gate.md`). | Fixed 0.16.0: per-regulation artifacts are `data/<name>-<reg>.<ext>`; see step 9's pin table. Run the gate with `--regulation <reg>`. The lattice sizes do NOT transfer: re-derive them with `engine/lattice_walk.js`. |
| **An absent input passed a clause.** The open-defect clause read no register verdicts for the new regulation and passed. | The first Reg M-C gate run showed PASS with 0 verdicts read. | Fixed 0.16.0: absent verdicts read CANNOT-ANSWER. Run the new regulation's gate once before its instruments exist. Every clause must read NO ARTIFACT or CANNOT-ANSWER. A PASS there is a clause that cannot see absence. |
| **A test that writes the old regulation's names into a sandbox becomes their writer.** `engine/provenance.js` credits whoever names an artifact beside a write into `data/`. | The gate's artifact closure moved under a new test; the report records it (`docs/_reports/2026-09-21-regmc-gate.md` section 2). | Found 0.16.0. In a test, assemble artifact names, never spell them next to a write. Re-derive `node engine/provenance.js --graph --json` and check nothing credits the test. |
| **Some builders read the old regulation's store whatever is selected.** `engine/click_counts.js` and `engine/sheet_usage.js` read the Reg M-B stores by name, and the steering inputs are Reg M-B's too. | Under the new regulation they would write old-store numbers into correctly named new files. Nothing would fail. | Found 0.16.0, not fixed. Before running a builder for the new regulation, check which store it opens. The not-yet-per-regulation inputs are listed in `tests/test-regulation-artifacts.js` (NOT_YET). |
| **The steered path reads more than the builders the brief named.** The empirical arm CLICKS out of the behaviour table (`data/move-priors.json`, read out of the release) and PRICES a switch off `data/rollout-switch-census.json`. Both were the old regulation's. | Found by reading `engine/game_differential.js`'s empirical block, not from the brief (`docs/_reports/2026-09-21-regmc-census.md` §2). | Fixed 0.19.0: `engine/regulation_stores.js` gives every builder the new regulation's frozen pool, and the behaviour table is a per-regulation engine file. Next time, list every `readFileSync` and `REL.read` in the steered path before building anything. |
| **The artifact seam also redirects a release cut.** `data/rollout-switch-census.json` is a release SOURCE. Declaring it per-regulation made the new regulation's cut read it through the seam. | The Reg M-C release froze the new census's bytes under the old file name, so the manifest pairs one name with the other file's digest (`docs/_reports/2026-09-21-regmc-census.md` §7). | Found 0.19.0, not fixed. Before declaring a file per-regulation, check `SOURCES` in `engine/engine_release.js`. A SOURCE belongs in the `fileFor` map (like the behaviour table) so the cut freezes it by its own name. |
| **A builder that never loads `engine/regulation.js` has no seam.** `engine/click_counts.js` did not. | Run with the new regulation selected, it would have overwritten the old regulation's file. The seam is installed only by a module that loads it. | Fixed 0.19.0 for the four steering builders. Every builder that writes into `data/` must load `engine/regulation.js` before it writes. |
| **A positional-argument parser reads `--regulation`'s value as an operand.** `engine/policy.js` took `--regulation regmc` as a store path. | Found while running it (`docs/_reports/2026-09-21-regmc-census.md` §7). | Fixed 0.19.0. When a script parses positionals by hand, exclude the value that follows `--regulation`, or select the regulation with `ABRA_REGULATION`. |
| **A store test in a worktree can pass by comparing nothing.** The worktree has no old-regulation stores, so "selects the literal stores" compared two empty lists. | It passed on the first run and could not have failed. | Fixed 0.19.0: `tests/test-regulation-steering.js` has a control arm with the old stores present in its sandbox. A selection test needs the thing selected to exist. |

## THE THING THAT WILL GO WRONG ANYWAY

Every failure this rotation found had the same shape as every failure this repository has ever had: a
**capability absent, with everything reporting success**. The same-bytes shortcut reported *+0 moves*.
The strict legality filter reported full coverage over an ability it had deleted. A silent config
fallback would report a clean run about the wrong regulation.

None of those crashes. So the standing question at every step is not *did it run* but **could this have
told me if it were wrong** — and where the answer is no, print the count, print the re-admitted list,
print the fallback. A zero that nothing could have made non-zero is not a measurement.
