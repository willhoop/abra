# Generated files, and whether any of them can prove they match their source — 2026-08-26

MEASURE, read-only pass. Nothing under `data/` was written, no builder was run in write mode,
`data/abra-tags.js` was **not** rebuilt, and no commit was made. An ENGINE agent held the play layer
throughout; every artifact quoted below was read either through `git show HEAD:` or from a file whose
mtime was checked against the clock first.

Trigger: Will, 2026-08-26 — *"i just dont want this to ever be an issue again."*

---

## 1. The verdict, up front

| | |
|---|---|
| generated files in the repo | **360** (of 1,934 tracked) |
| declare their **builder** | **279** (77.5%) |
| declare the **digest of their source** | **71** (19.7%) |
| carry a digest of **their own content** | **0** (0.0%) |
| can be **proved** to match their source today | **8** — 3 by re-running the builder, 5 by source digests |
| **unprovable** — drift in them is undetectable by anything in this repo | **285** |

The new check is `engine/generated_audit.js`. It was shown **RED on a deliberate break** across
**two pairs built by two different builders**, with a green control leg on the same fixture.

**It catches the class, not the instance.** Measured, not claimed — see §5.

---

## 2. What was actually wrong with the tags pair, and it is not drift

`build/build_tags_js.js --check` is **RED on this machine right now**, and so therefore is
`engine/artifact_audit.js` — a registered gate in `tests/run-all.js`. Its message reads:

```
data/abra-tags.js DOES NOT MATCH data/tags.json — the browser engine and the node
engine are reading different rulebooks.
  tags.json generated 2026-08-25T03:37:49.224Z   abra-tags.js generated 2026-08-25T03:37:49.224Z
```

**That message is false.** The content agrees exactly. Measured:

| | bytes | CR bytes | git blob |
|---|---|---|---|
| `data/abra-tags.js` at HEAD | 767,938 | 0 | `6035c9bf11ea` |
| `data/abra-tags.js` in the working tree | 809,190 | **41,252** | `6035c9bf11ea` (identical) |
| `data/tags.json` in the working tree | 767,840 | 0 | unchanged |

`core.autocrlf` is `true`. A generated file that **git** last wrote (checkout, stash, restore) carries
CRLF on disk; one a **generator** last wrote carries LF. Both normalise to the same blob, so
`git status` is clean and `git diff HEAD` is empty — and any `--check` that compares BYTES is red for
a cause that is not drift. Repo-wide, exactly two generated bundles are in the CRLF state today:
`data/abra-tags.js` (41,252 CRs) and `data/engine-data.js` (13 CRs). Every other bundle holds none.

This matters more than a noisy gate, for two reasons.

**(a) It has already fragmented the release ladder.** `engine/engine_release.js` digests raw bytes and
computes the release id as the digest of the digests, on the stated invariant *"an identical tree
always yields an identical id."* Over the **407** releases that hold `data/abra-tags.js`:

- 51 distinct tag contents;
- **35 releases froze CRLF bytes**;
- **2 contents split into two release identities purely by line endings** — content `1d983f932231`
  exists as 11 CRLF releases + 1 LF release, and content `4883ee33156a` as 7 CRLF + 2 LF.

So **18 releases are byte-duplicates of two other releases** with different ids. The current release
pointer, `419e9636ec6a`, records `data/abra-tags.js = 784bdb77ed0e` — the **CRLF** digest. The LF
digest of that same content is `4883ee33156a`.

**(b) It defeats the content-not-mtime fix.** `engine/run_stamp.js` `sha12()` hashes raw bytes, so
every `source_digests` entry for `data/abra-tags.js` flips on a checkout with no content change. The
audit already shows artifacts reporting `data/abra-tags.js 27e7a3cfa369 -> 784bdb77ed0e`, where
`27e7a3cfa369` is the CRLF form of a different content — a signal in which real movement and
line-ending movement are not separable after the fact.

`web/build-quarantine.js:353` already carries a comment about this exact failure biting that builder
(*"back with CRs, and --check reported the WITHHOLDING as stale when not one character of it had…
changed"*). It was fixed there, locally, and never generalised.

**The new check calls this `CHECKOUT-EOL` and gives it its own count and its own fix.** Folding it
into DRIFTED makes the drift count a number nobody believes; folding it into `ok` leaves a registered
gate red for a cause nobody named, which is how a gate becomes *"one of the two known failures."*

---

## 3. The drift itself: still real, and why no existing gate saw it

`data/tags.json` and `data/abra-tags.js` are in sync at HEAD (`c12ef5fa`) — verified by rebuilding the
wrapper in memory from `git show HEAD:data/tags.json` and comparing to `git show HEAD:data/abra-tags.js`.
The last committed drift was:

- `382e9989` (2026-08-25 00:00) — changed `data/tags.json` and **not** `data/abra-tags.js`. Verified:
  at that commit the pair does not match.
- fixed by `dfbfea60` (2026-08-25 03:49), *"…again, 38 minutes after the last drift was fixed."*

Why nothing caught it, and this is the load-bearing part:

1. **The stamps are identical by construction.** `build_tags_js.js` copies `tags.json` verbatim, so
   the `generated` field is inherited. Both files said `2026-08-25T03:37:49.224Z` while disagreeing.
   No mtime, no timestamp and no "newer than its source" heuristic can ever see this.
2. **`engine/artifact_audit.js` check G is not run at commit time.** It is registered in
   `tests/run-all.js` only. `.githooks/pre-commit` runs four gates — docs-currency, roadmap-register,
   artifact-rerunnable and the silent-catch ratchet — and none of them asks this question.
3. **The hook's scope guard exits 0 on a data-only commit**, by design (*"a pure artifact
   regeneration is not a documentation event"*). A future `tag_dex`-only commit skips every gate in
   the hook, including any that might be added there.
4. **Check G's membership is `data/*.js` that declare a header.** One directory, one extension, one
   kind of declaration. A generated file in `app/`, in `web/`, in `docs/`, or one that simply forgot
   its header, is invisible to it.

---

## 4. The three questions, answered for all 360

**Q1 — does it declare its builder? 279 of 360.** 81 do not; provenance's writer scan is the only
thing that knows they are generated at all.

**Q2 — does it declare the digest of its source? 71 of 360.** 62 carry `source_digests` directly, the
rest through a `run_stamp` `.meta.json` sidecar. Of those 71: **5 still verify**, 66 have at least one
source that has moved since. The 66 are reported as `SOURCE-MOVED`, **not** as a failure — an artifact
whose sources moved after it was written is STALE, which is `engine/provenance.js`'s verdict and its
gate. Failing on it here would duplicate that gate and open this one red at 66 rows, and a gate that
fires at sixty-six is a gate people learn to waive.

The five that verify: `data/diff-team-pool.json`, `data/game-differential.json`,
`data/partial-label-em.json`, `data/quarantine-stamp.json`, `data/strong-player-baseline.json`.

**Q3 — does it carry a digest of its own content? 0 of 360.** Confirmed by an independent sweep for
any top-level key matching `/digest|sha|hash|checksum/i` across every JSON in `data/`: every hit
describes **inputs** (`source_digests`, `census_digest`, `team_pool_digest`, `harness_digests`,
`fitter_digests`, `positions_file_digest`, …). Nothing in this repository carries a digest of itself.
The check prints the 18 digest-shaped keys it deliberately does **not** read, with the reason —
`source_digests_before` is *supposed* to be the old state, and comparing it to today would manufacture
a mismatch.

### What "unprovable" is made of — 285 files

| | count | what it means |
|---|---|---|
| builder named, no `--check` mode | 203 | one edit each from covered |
| builder named, has `--check`, **reaches the play layer** | 4 | re-running it would play games and write; not re-run |
| no builder can be named at all | 78 | nothing here can rebuild them to compare |

Largest single blocks: `engine/train_policy.js` (102 training checkpoints),
`tests/test-engine-diff.js` (11), `tests/roster.js` (11), `tests/test-mechanics.js` (7),
`engine/porygon2.py` (4).

### The shortlist — 12 files one cheap `--check` away

No require path from the builder reaches the frozen engine and it spawns nothing, so the comparison
would cost milliseconds:

```
data/abra-meta.js                  <- build/build_meta_js.js  from data/meta-usage.json
data/click-counts.json             <- engine/click_counts.js
data/damage-validation.json        <- engine/validate_damage.js
data/engine-data.js                <- build/build_engine_data.js  from CHOMP/engine/champ-model.js
data/json-nan-guard-baseline.json  <- tests/test-json-nan-guard.js
data/mechanics-rank.json           <- tests/mechanics_rank.js
data/mechanics-surface.json        <- tests/mechanics_surface.js
data/mew.js                        <- build/build_mew_bundle.js
data/published-samples.json        <- engine/publish_guard.js
data/residual-order.json           <- engine/residual_order.js
data/status.js                     <- build/build_status.js
data/weight-multiplicity.json      <- engine/weight_multiplicity.js
```

`data/engine-data.js` is on that list and is **frozen into every release**, exactly like
`data/abra-tags.js`. It is the same hazard, one file over, and it has no comparison at all today.

The shortlist is a **triage aid, not a proof**. It is derived from a require walk, and a require walk
cannot see two things this repo does: a Python builder's imports (`porygon2.py`, `nmf_rank.py`,
`lookahead_bound.py`, `sanity_check.py` are **excluded rather than cleared**) and a spawn of a
runtime-computed script name (`engine/rollout_r4.js:64` does exactly that). The check says so on the
line rather than in a footnote.

---

## 5. Does it catch the CLASS or just this instance?

**The class, and it was measured rather than asserted.**

The shape requirement was: do not name this file pair; make the resolver the only door. So:

- **Membership is a union of two independent, derived doors.** Door 1 is the file's own
  `GENERATED … by <script>` header or its JSON `by` / `generated_by` / `written_by` / `generator`
  field. Door 2 is `engine/provenance.js`'s derived writer graph, **read** out of
  `data/provenance-stamp.json` and never re-derived — two implementations of "which script writes
  this file" would disagree eventually and invisibly. A file that stops declaring itself is still
  caught by door 2; a file no writer scan can reach is still caught by door 1.
- **The comparison is the builder's own `--check`, never a re-implementation** — the pattern
  `tests/test-guru-derived.js` set in 2026-08-04 and check G reused in 2026-08-25.
- **Nothing is typed.** No list of files, no list of builders, no list of known-bad spellings — the
  failure that let the third species-key instance walk past two gates.

The self-test damages **two** pairs built by **two different** builders:

```
$ node engine/generated_audit.js --break
    data/abra-tags.js  <- build/build_tags_js.js  from data/tags.json
    data/guru.js       <- build/build_guru_js.js  from data/guru-matchups.json

  CONTROL: every copy is exactly what its builder would write.
  control: exit 0, DRIFTED=0
  BREAK: one value changed inside the payload of EACH of the 2 copies.
  broken: exit 1, DRIFTED=2  data/abra-tags.js, data/guru.js

  SELF-TEST PASSED — green on the untouched pairs, RED on all 2, each named.
```

The control leg is not decoration: a fixture that is red both ways proves nothing. The fixture is a
scratch tree with its own git index; **nothing in the real tree is written**, which matters because a
rebuild of `data/abra-tags.js` under a live measurement voids the measurement.

### What would walk past it — stated in the file's own header

1. **The triple-blind file.** Generated, no header, no script in `engine/ build/ tests/` names it
   beside a write, and untracked by git. All three doors shut.
2. **A builder with no `--check`.** 203 files. Membership known; drift **not detectable**. They are
   counted and named, which is the honest output — not a pass.
3. **A `--check` that asks the wrong question.** The comparison is the builder's own, deliberately.
   `build/build_browser_data.js --check` compares the PAYLOAD and not the bytes, so a header or
   date-stamp difference passes it by design.
4. **A file generated outside this repository** and pasted in.
5. **A stale `data/provenance-stamp.json`.** Door 2 is only as wide as the last provenance run. The
   check prints the stamp's age and artifact count on every run rather than quietly covering less
   than it looks like it does.

### Safety properties of the check itself

It spawns child processes, so it was built to be safe beside a live measurement:

- **A comment is not a mode.** Nine builders contain the string `--check`; only five read it off
  argv once comments are stripped. One of the four that merely mention it is
  `engine/quarantine.js`, whose `--check` runs a 20,000-comparison differential and writes to
  `data/`. Spawning it because a comment matched would be the audit doing damage while measuring.
- **A builder that reaches the play layer is never re-run.** "The play layer" is parsed out of
  `SOURCES` in `engine/engine_release.js` — the one place that defines what the engine is — plus
  `engine_release.js` itself, because opening a release reaches the simulator through the loader
  rather than through a require. The require walk understands all three spellings this repo uses:
  `require('./x.js')`, `require(D('engine','x.js'))` and `REL.require('engine/x.js')`.
- **A builder that spawns anything is treated as cost-unknown and never re-run.**
- **Every failed read is recorded, never swallowed.** `tests/test-no-silent-failure.js --only
  engine/generated_audit.js` reports **no new silent catch blocks**.

Cost: ~7s. Three builders are actually spawned today —
`build_tags_js.js`, `build_guru_js.js`, `build_browser_data.js` — all three verified to guard every
write behind their `CHECK` flag.

---

## 6. What I did not do

- **Did not rebuild `data/abra-tags.js`.** It is frozen into every release; a rebuild under a live
  measurement voids it. Owed below.
- **Did not run `engine/provenance.js`** — it writes `data/provenance-stamp.json`, which is out of
  scope for this pass. Door 2 read the stamp that was already on disk (0.0–0.6h old on each run).
- **Did not fix the EOL condition**, register a roadmap row, touch `CHANGELOG.md`, or run
  `status.js --write`.
- **Did not delete anything.** `data/_pair-pilot.json` and `data/medicham-represented-clicks.json`
  were untracked at session start and are untouched; `.scratch_eng/` and
  `docs/_reports/2026-08-26-red-triage.md` appeared during the pass and belong to another agent.
  Reported, left.

---

## OWED, NOT RUN

Run in this order. Nothing here was run in this pass.

```bash
# 1. LAND THE CHECK (I did not commit).
#    New file, untracked:  engine/generated_audit.js
git add engine/generated_audit.js docs/_reports/2026-08-26-generated-file-digests.md

# 2. PROVE IT CAN STILL GO RED BEFORE TRUSTING IT. Control + break, two builders. ~10s.
node engine/generated_audit.js --break

# 3. THE FULL AUDIT. ~7s. Exits 1 today on the CHECKOUT-EOL row.
node engine/generated_audit.js
node engine/generated_audit.js --list        # machine-readable, one line per file

# 4. THE REBUILD — OWED, NOT RUN. data/abra-tags.js is frozen into every engine release and an
#    ENGINE agent held the play layer during this pass. Run it ONLY when no measurement is in
#    flight, and re-cut any release taken afterwards.
#    This is the command that clears the CHECKOUT-EOL row by rewriting the file with LF endings.
node build/build_tags_js.js
node build/build_tags_js.js --check          # must print "is exactly what data/tags.json would produce"
node engine/artifact_audit.js                # check G must go green; it is RED today

# 5. CONFIRM THE REBUILD CHANGED NOTHING BUT LINE ENDINGS.
#    If this prints anything, the pair had really drifted and step 4 was a fix, not a normalisation.
git diff --stat -- data/abra-tags.js

# 6. THE UNDERLYING EOL DEFECT — ENGINE/OPS decision, not taken here. Two candidate fixes:
#      (a) .gitattributes:  data/*.js -text      (stop git rewriting generated bundles on checkout)
#      (b) the byte-comparing --checks normalise CRLF before comparing
#    (a) is the one that also protects the release id and every source_digests entry. Measure first:
node -e "for(const f of ['data/abra-tags.js','data/engine-data.js','data/guru.js','data/mag.js','data/mew.js','data/move-effects.js','data/mega-formes.js','data/board-data.js','data/status.js','data/abra-meta.js'])\
{const b=require('fs').readFileSync(f);console.log(f,(b.toString('latin1').match(/\r/g)||[]).length,'CR')}"

# 7. THE 18 SPLIT RELEASES. Do not resurrect or re-sync them — a stranded or duplicated release is a
#    figure to WITHHOLD and re-measure. This only PRINTS the split; it changes nothing.
node -e "const fs=require('fs'),p=require('path'),c=require('crypto');const R='data/releases';const s=new Map();\
for(const id of fs.readdirSync(R)){const f=p.join(R,id,'data','abra-tags.js');if(!fs.existsSync(f))continue;\
const b=fs.readFileSync(f),n=c.createHash('sha256').update(b.toString('utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12),\
r=c.createHash('sha256').update(b).digest('hex').slice(0,12);if(!s.has(n))s.set(n,new Map());s.get(n).set(r,(s.get(n).get(r)||0)+1);}\
for(const [n,m] of s) if(m.size>1) console.log('SPLIT',n,[...m.entries()].map(e=>e.join(' x')).join(' | '));"

# 8. THE 12-FILE SHORTLIST. Each is one `--check` mode away from PROVED, and generated_audit.js
#    picks each up with NO edit to it. Highest value first — this one is frozen into every release:
#      build/build_engine_data.js   ->  data/engine-data.js
#      build/build_mew_bundle.js    ->  data/mew.js
#      build/build_meta_js.js       ->  data/abra-meta.js
#      build/build_status.js        ->  data/status.js
#    (build/build_mag_data.js and build/build_board_browser.js are on check G's uncovered list too.)

# 9. WIRE IT WHERE IT WILL BE READ. Not done, and it is the difference between a check and a gate:
#      tests/run-all.js   GATES list, beside engine/artifact_audit.js
#      .githooks/pre-commit — note the scope guard exits 0 on a data-only commit today, which is
#      exactly the commit shape that carried drift #4 (382e9989 touched data/tags.json alone).

# 10. RESTAMP AFTER ANY OF THE ABOVE.
node engine/status.js --write
```
