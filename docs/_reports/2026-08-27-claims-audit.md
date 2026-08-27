# Claims audit — the assertions INSIDE a structured record, 2026-08-27 (MEASURE)

Historical findings record. Not current state, not maintained, superseded by the register rows it
feeds. See `docs/_reports/` policy in CLAUDE.md.

## VERDICT

**170 claims extracted from the five derived declaration records, plus ~110 from `docs/ROADMAP.md`'s
`VERIFIED BY` markers. Every mechanically checkable one is TRUE. ZERO are FALSE.** The one false
claim this pass was dispatched about — `PENDING_WIRE`'s *"NOTHING HAS EVER RUN IT"* on
`engine/derive_protocol_events.js` — had already been corrected before this pass started, and the
correction is itself now checked.

**THE ROADMAP HALF IS A MOVING READ AND IS REPORTED AS SUCH.** ENGINE is appending to
`docs/ROADMAP.md` during this pass: three successive runs read 119, 122 and 124 markers and 112, 112
and 110 claims. The five-code-record half (170) did not move. Totals below are the settled read at
the end of the pass — 280 claims, 252 checkable, 0 false — and the marker component of that total
should not be quoted to the unit.

**A second census found EIGHT false claims, all outside the records, in comment prose:** a comment
that names a `.js` / `.py` / `.html` file inside this repository is asserting that file exists, and
eight name something that has never been there. **The worst asserts a drift-detection safety
mechanism on a page that has never existed in this repository's history, and it has stood 32 days.**

**Out of reach: the majority.** 80 of the 175 record entries (46%) yield a checkable claim; 95 do
not. Across ~51,000 comment lines in `engine/`, `tests/` and `build/`, exactly ONE claim class is
decidable by anything that exists.

Instrument: `tests/test-claim-truth.js`. Auto-discovered by the `tests/test-*.js` glob, so it needed
no list edit. Shown RED first — see below.

---

## 1. WHAT A CLAIM-CARRYING RECORD IS, AND WHY IT IS DERIVED

The brief named two places. A hand-listed set of claim-carrying places is itself a claim that rots,
which is the finding, so membership is derived from shape:

> A RECORD is any top-level `const UPPER_NAME = { ... }` in `engine/`, `tests/` or `build/` whose
> keys are ALL repo-relative paths and at least one of whose values is a long string.

That found **five**, not two:

| Record | Entries |
|---|---|
| `tests/run-all.js` `NOT_A_CHECK` | 23 |
| `tests/run-all.js` `PENDING_WIRE` | 36 |
| `tests/test-effective-identity.js` `DECLARED` | 32 |
| `tests/test-mc-key.js` `HOLDERS` | 10 |
| `tests/test-stadium-roster.js` `NOT_A_MODEL` | 74 |
| `docs/ROADMAP.md` `VERIFIED BY:` markers | 124 markers / 45 distinct files (moving) |

A sixth invented tomorrow joins by existing.

## 2. THE CLAIM KINDS AND THE RESULT

| Kind | How it is decided | n | FALSE |
|---|---|---|---|
| `NAMES-A-PATH` | every repo path named in the prose exists on disk | 208 | 0 |
| `RUNNER-SOME` | "it HAS a runner" — something executes it, or a `VERIFIED BY` marker names it | 11 | 0 |
| `RUNNER-NONE` | "no runner" / "nothing has ever run it" — neither | 8 | 0 |
| `WRITES` | "writes `data/x.json`" — the subject's source names that file | 8 | 0 |
| `COMMIT` | a sha in the prose resolves with `git cat-file` | 6 | 0 |
| `DISCOVERED` | "`X` is DISCOVERED" — X matches the `tests/test-*.js` glob | 5 | 0 |
| `MARKER-NONE` / `MARKER-SOME` | the `VERIFIED BY` marker really is / is not in `docs/ROADMAP.md` | 5 | 0 |
| `REFUSES` | "refuses to run without `--x` (exit 2)" — the source names both | 1 | 0 |
| **UNCHECKABLE: dated measurement** | *"Measured exit 0 on 2026-08-22"* — deciding it means re-running, which plays a game | 13 | — |
| **UNCHECKABLE: mechanism** | *"the shield is step 1 and semi-invulnerability is step 0"* — a claim about the GAME | 15 | — |

EXECUTES is derived, never listed: a file under `engine/`, `tests/`, `build/`, `tools/` or
`.github/` that names the subject within 250 characters of a spawn / exec / require / `run:`, with
comments stripped first. `tests/run-all.js` is excluded as a candidate executor and asked properly
instead (its `tests/test-*.js` glob plus its `GATES` array) — it would otherwise credit itself as
the runner of every file it merely EXEMPTS, which is the exact inversion under audit.

Every `VERIFIED BY` marker names a file that exists — 45 distinct files at the settled read. `engine/register_reality.js` already RUNS those
instruments; what it did not assert is that the name resolves at all, so that is the only thing
added here and nothing about a marker is re-decided.

## 3. SHOWN RED FIRST — WHAT WAS PLANTED

`node tests/test-claim-truth.js --break` feeds three synthetic entries through the **same
`extract()`** the audit uses, not a copy of its predicates. The first plant is the real retracted
sentence, verbatim:

- `engine/derive_protocol_events.js` — *"a real two-gate conformance check that NOTHING HAS EVER RUN
  IT and that no list here has ever named."* → **RED** (`tests/test-protocol-trace.js` runs it).
- `engine/orient.js` — *"a REAL CHECK, and it HAS a runner: tests/test-does-not-exist.js is
  DISCOVERED and it writes data/no-such-artifact.json."* → **RED** on `NAMES-A-PATH` ×2,
  `DISCOVERED`, `WRITES`. The `RUNNER-SOME` half is planted TRUE and correctly reported not-red, so
  the check is not simply calling everything false.
- `tests/test-mechanics.js` — *"landed in commit 0000000 and it carries no VERIFIED BY marker in
  docs/ROADMAP.md."* → **RED** on `COMMIT` and `MARKER-NONE`.

7 of 9 planted claims reported FALSE, covering five kinds. Exit 1 when any required kind is missed —
demonstrated, by pointing the marker plant at a file with no marker and watching `--break` fail.

## 4. THE EIGHT FALSE CLAIMS — ALL IN COMMENT PROSE, NONE IN A RECORD

**2,792 references to a repo `.js` / `.py` / `.html` file inside a comment in `engine/`, `tests/`
and `build/`. Eight name something that is not there and do not say so.** A file that says the thing
is missing is not making a false claim, so a negation within 200 characters clears it — three did:
`engine/lookahead_divergence.js` (*"There is no engine/lookahead_divergence.py yet"*),
`engine/validate_store.js` (which already declares `engine/format_drift.js` never existed) and
`tests/test-medicham.js` (past tense).

Ordered worst first. "Stood" is from `git blame` to 2026-08-27.

### 4.1 `build/build_mag_data.js` — a safety mechanism asserted on a page that has never existed. 32 days.

Lines 7 and 20 assert, in the present tense:

> *"`web/magnemite.html` has to score a move exactly the way `engine/board.js` scores it, or the site
> shows numbers the bot does not actually use … which is why `web/magnemite.html` carries a
> self-check against a fixture generated here: if the browser's scoring and the engine's scoring ever
> disagree on the fixture, the page says so on screen rather than quietly showing wrong numbers."*

**`web/magnemite.html` does not exist and `git log --all` has no record of it ever existing.** What
is true: the MAGNEMITE room is inside `web/index.html`, which loads `data/mag.js` and DOES carry the
fixture self-check (`web/index.html:1125`, `const fx = MAG.fixture`). So the mechanism is real and
the file named is not. This is the worst of the eight because it is the shape the project has paid
for most: **a stated guard, on a named artifact, where the artifact is absent** — a reader checking
whether the drift risk is covered is told yes and pointed at nothing. Landed `4a7c82f12`, 2026-07-26.

### 4.2 `engine/million_run.js:153` — an asserting instrument that does not exist. 16 days.

> *"… nothing computed from it means anything. `engine/status_residual.js` asserts it …"*

No such file. This is `derive_protocol_events` exactly: a claim that a property IS asserted, where
nothing asserts it. Landed `0067c4e8c`, 2026-08-11.

### 4.3 `engine/medicham2-browser.js:5839` — a contract test that does not exist. 34 days, the oldest.

> *"… this file is what makes `tests/test-engine-contract.js` able to hold them together."*

No such file. In the simulator, which is the most-read file in the repository. Landed `4687f7bab`,
2026-07-24. **ENGINE owns this file and is editing it live; not touched here.**

### 4.4 `engine/lookup.js:92` — a consumer of the miss log that does not exist. 21 days.

> *"What misses happened, declared and otherwise. `tests/test-lookup-contract.js` reads this, and
> any …"*

No such file, so the declared-miss log has no contract test reading it. Landed `21edc99a6`,
2026-08-06.

### 4.5 `engine/speed_vs_pokeenv.js:41,269,289` — a benchmark arm that does not exist, printed at run time. 16 days.

> *"Arm A lives in `engine/bench_pokeenv.py` because poke-env is Python. It writes the same shape."*

and at line 289, **printed to the operator on every run**:

> *"arm A (poke-env) is Python — run `engine/bench_pokeenv.py`, it merges into the same artifact"*

No such file. The artifact's own `what` field repeats it. Landed `ff5d2a654`, 2026-08-11.

### 4.6 `engine/game_differential.js:101` — a sibling instrument that does not exist. 15 days.

> *"… while `tests/rate_runner.js` next door derives its trials from …"* — no such file, next door
> or anywhere. Landed `13e94cb7f`, 2026-08-12.

### 4.7 `engine/prior_player.js:21` — a parity test that does not exist. 34 days.

> *"… pure prior samplers. See `tests/test-policy-parity.js`."* Landed `e5d5d05d9`, 2026-07-24.
> The weakest of the eight — a pointer, not an assertion of coverage — and still a reader sent
> nowhere.

### 4.8 `engine/quarantine.js:51` — the wrong path in an explanation of a design decision. 13 days.

> *"This helper is also pointed at `.js` BUNDLES (`data/mag.js`, `data/mew.js`, `web/scoreboard.js`)
> to ask cheaply whether they happen to be JSON …"*

`web/scoreboard.js` does not exist; `data/scoreboard.js` does, and `quarantine.js:2451` names
`data/scoreboard.js` correctly. One of the three examples is misspelled. Cosmetic next to the others
and included because the census does not get to choose which instances it reports. Landed
`f545e35cb`, 2026-08-14.

## 5. WHY THE COMMENT CENSUS IS REPORTED AND NOT GATED

Every one of the eight sits in a file this division does not own, and one of them
(`engine/medicham2-browser.js`) is being edited by another agent right now. A check that goes red on
something its owner cannot fix becomes *"one of the two known failures"* — the phrase CLAUDE.md
bans, and the exact mechanism by which `tests/test-docs-current.js` sat red for two days across ~40
commits. So `tests/test-claim-truth.js` gates on the RECORDS only, prints the census with every name
under a heading that says it is not a verdict, and the eight are filed as register rows. **The
register is the authority; the printed census is a pointer to it.**

## 6. WHAT WALKS PAST THIS CHECK

Stated because pretending to coverage would be the defect being fixed.

1. **FREE PROSE.** A claim in a header, a ledger or a `docs/` page is not in a record. That is the
   large majority of the prose here. `tests/run-all.js`'s own header claim that one detector clause
   *"adds exactly TWO files and no others — `tests/probe_red_demo.js` and
   `engine/derive_protocol_events.js`"* was **checked BY HAND this pass and is TRUE today**; nothing
   re-checks it.
2. **QUOTED TEXT.** A phrase inside double quotes is read as a report of what something said, not as
   an assertion by the record, and is stripped before the phrase kinds match. Required — the
   corrected `derive_protocol_events` entry quotes the false claim it retracts — and a hole: **a
   false claim written inside quotation marks is out of reach.**
3. **DATED MEASUREMENTS** (13 found). *"Measured exit 0 on 2026-08-22."* Deciding one means
   re-running the thing, which plays a game. Counted and named, never counted as true.
4. **MECHANISM PROSE** (15 found). A claim about the game, not about the tree.
5. **EXTERNAL PATHS.** A path inside a URL or in the Showdown checkout is skipped by the
   preceding-character rule.
6. **EXECUTES IS REACHABILITY, NOT EXECUTION.** A runner that exists but is itself unwired still
   counts as a runner. The entries say so in their own words; this does not re-litigate it.
7. **DATA FILES.** The comment census covers source files only. A `data/*.json` named in a comment
   may be legitimately absent — gitignored, regenerable, not yet built — so its absence is not
   evidence. **31 absent `data/` paths are named in comments and are NOT reported as false.**

**Proportion out of reach: 80 of 175 record entries (46%) yield a checkable claim; 95 do not. Across
~51,000 comment lines in `engine/`, `tests/` and `build/`, exactly one claim class is decidable.**

## 7. TWO THINGS FOUND WHILE MEASURING, NOT PART OF THE BRIEF

- **`node tests/run-all.js --coverage` exits 1 today.** Three checks are unaccounted for:
  `tests/probe_recoil_after_clamp.js`, `tests/probe_refill_entry_herb.js`,
  `tests/probe_transform_faint_revert.js`. **All three are untracked and are ENGINE's in-flight work
  from this session** (`probe_transform_faint_revert.js` is named in ENGINE's own brief). They are
  not classified here: writing a `PENDING_WIRE` blocker for a file whose blocker this division has
  not measured would commit the exact defect under audit. **ENGINE to classify or wire.**
- **A regex trap that nearly produced a fictitious finding, recorded because it is reusable.** A
  path pattern ending `\.(?:js|py|json|…)` with a MANDATORY extension truncates `data/tags.json` to
  `data/tags.js`, because JS alternation is leftmost-**first**, not leftmost-longest. A first pass
  with that pattern reported **186 distinct missing paths**; the true number is 31, and every one of
  the 155 phantoms looked exactly like a finding. The extension group must be optional so the greedy
  body consumes the whole token first. `tests/test-claim-truth.js` uses the corrected form.

## OWED, NOT RUN

- **The eight false comment claims are NOT corrected.** They are named above and filed as register
  rows. Seven sit in files owned by ENGINE or by no division in this session's split; correcting a
  sentence in another agent's live file is how a measurement gets destroyed. **Owed: the owning
  division deletes or repoints each sentence.**
- **`build/build_mag_data.js`'s header is the one worth doing first** and it is a WEB/OPS question as
  much as a comment fix: does `web/index.html`'s fixture self-check actually cover what the header
  promises, or is the mechanism as absent as the filename? **Not measured here.** The self-check code
  exists at `web/index.html:1125`; whether it fires and what it does on disagreement was NOT run.
- **`tests/run-all.js --coverage` is RED and is left red**, with the three names reported. Not
  waived, not filed as a known failure — handed to ENGINE, who created the three files this session.
- **No claim inside a quotation mark was checked**, by construction. If a false claim is ever written
  in quotes it will pass. There is no fix for this that does not also re-fire on every retraction.
- **No claim in a `docs/` page, a ledger, or a file header was checked** except the one run-all.js
  header claim done by hand. **The header class is the one the brief asked about that is least
  covered**, and a general checker for it is not proposed — the claims are not shaped alike.
- **Nothing was re-run to decide a dated measurement.** 13 of them stand as written.
- **No game was played and no game number moved.** Predicted before the pass and held: this
  instrument reads files, runs `git cat-file`, and writes nothing.
