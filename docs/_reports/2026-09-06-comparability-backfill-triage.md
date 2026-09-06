# Comparability backfill — triage of the artifacts that carry no `driver_code`

2026-09-06, 04:30–04:40 EDT, MEASURE. Read-only pass: no engine job, no differential, no census, no
roster, no release cut, no `status.js --write`. Nothing here is typed from memory; every count is
derived by the commands recorded in §0.

## 0. How this was derived, and the torn-read guard

- The artifact set comes from `node engine/provenance.js --graph --json` — the canonical derivation,
  not a second parser. It covers `data/*.json|js` and returns 303 rows.
- `provenance --graph` does not reach `data/verification/`, which is where the differential's arms
  actually live, so that directory (plus `data/quarantine/`, `data/archive/`) was walked with the
  same predicate. **450 JSON objects scanned in total.**
- The living-document set is `engine/docs_scan.js` `livingDocs()` — **25** documents, derived from the
  presence of a version header, not from a list. Division ledgers and `CHANGELOG.md` are scanned
  separately, because `docs/ENGINE.md` and `docs/MEASURE.md` carry no version header and are therefore
  *not* in the living set even though they are where numbers get quoted.
- Register rows use `quarantine.roadmapRowIsClosed()`, the same closed-detector `open_work.js` uses.
- Quarantine membership uses `quarantine.classify({ graph })` — the gate's own derivation.
- Strandedness: release manifests (`data/releases/<id>/release.json` — `bodies_pruned`, `files`,
  `provides`) against `ER.callerNeeds()`'s requirement for `engine/game_differential.js`, then
  **spot-checked against the loader** (`ER.surface`) on 5 releases, because a derived value is not a
  fact until something compares it to its source.

**Torn-read guard.** An ENGINE agent was writing throughout: `data/roster.*` 04:14, `mechanics-census`
04:17, `game-differential.json` 04:19, `all-mechanics-fire.json` 04:26, `engine-release.json` 04:26,
`provenance-stamp.json` 04:27. All 112 artifacts in the population were **re-`stat`ed after the scan
and none had moved** (`moved since scan = 0`). `data/game-differential.json` was read at 04:29 with an
mtime of 04:19:39 and had the same mtime at 04:38. The counts below are a photograph taken at 04:38
EDT and **they drift upward** — see §1.

## 1. The population, and why "78" is not a fixed denominator

`arms_comparable.js` can only be asked about an artifact that carries a `steering` block. Everything
else has no comparability verdict to restore: `vouches()` refuses it one level earlier — *"declares no
steering policy at all"* — and has done since WIRE 5. So the triage population is exactly the steering
artifacts, and the other 338 objects in `data/` are not "UNKNOWN", they are outside the question.

|  | count |
|---|---|
| JSON objects scanned across `data/`, `data/verification/`, `data/quarantine/`, `data/archive/` | 450 |
| carry a `steering` block | **112** |
| — written by `engine/game_differential.js` | 110 |
| — written by `engine/wire_ladder.js` | 2 |
| carry `steering.driver_code` | **16** |
| **carry no `driver_code` — the triage set** | **96** |
| distinct engine releases referenced by the 112 | 61 |
| policies: coverage / empirical / joint | 34 / 70 / 8 |

**The brief's "74 of 78" was true on 2026-09-05 and is now 94 of 110 on the same definition** (the
differential family). It is not a fixed set: ENGINE writes a new arm roughly every 30 minutes, and the
stamped count went 4 → 16 overnight. A plan that reads "backfill 74 files" is chasing a moving
denominator. The right framing is *which cited figures are unstamped*, which is §3.

**The one that matters is already fixed.** `data/game-differential.json` — the only steering artifact
the gate reads, cited by 7 living documents and named in 21 open register rows — was rewritten at
08:19:39Z today and **carries `driver_code` `0c1fc935a5fb` over 11 files, with `driver_code_stable:
true`.** The highest-value comparability hole closed itself when ENGINE re-ran on a settled tree.

## 2. The four buckets, and what decides each

The bucket is decided in this order, and each test is a measurement rather than a judgement:

1. **QUARANTINED ANYWAY** — `quarantine.classify()` marks it downstream of MEDICHAM.
   **Measured: 0 of 112.** Every one of them *measures* MEDICHAM rather than consuming it, which is the
   exemption CLAUDE.md already declares for the differential. Comparability is moot for none of them.
2. **STRANDED** — its release cannot be opened. **Measured: 0 of 112.** All 61 referenced releases
   exist, none is `bodies_pruned`, and 59 record a `provides` list containing all 14 symbols
   `engine/game_differential.js` demands of `engine/medicham2-browser.js`. The 2 that predate the
   `provides` field (`6155acc0fb26`, `a81663f17c0c`) were opened with the loader and export all 14.
   The 168-of-200 stranding of 2026-08-12 does **not** apply to this family.
3. **DEAD** — nothing cites it: not a living document, not `status.js`, not `quarantine.js`, not an
   open register row, not any file in `engine/ tests/ build/ web/`, not a division ledger or the
   CHANGELOG. **36 of the 96.**
4. **RE-RUNNABLE** — everything else, i.e. something still reads it. **60 of the 96.**

### Bucket counts

| bucket | count | honest answer |
|---|---|---|
| RE-RUNNABLE | **60** | **re-run** — cheap (~2–4½ min per arm) except the two 14-arm ladders |
| STRANDED | **0** | n/a |
| DEAD | **36** | **delete** — proposed only, not done |
| QUARANTINED ANYWAY | **0** | n/a |
| *(already stamped, out of scope)* | *16* | nothing owed |

**Cost.** A 961-game arm records its own `elapsed_s`: 117.4 s (`fix-batch-7`, cap 12), 139.6 s
(`cap20-empirical`, cap 20), 120.3 s (today's `game-differential.json`, cap 20), with one outlier at
268.3 s (`game-differential.afterfaint`). The whole RE-RUNNABLE set minus the ladders is roughly
**2 hours of single-process wall clock**, and it is a *pair* cost: a before/after must be re-taken on
**both** sides or the pair still reads UNKNOWN. The ladders are the expensive item —
`wire-ladder.json` and `state-ladder.json` are 14 arms each at ~400 s per arm, **~1.5 h each**.

## 3. Priority order — what restores the most currently-cited figures

Weighted by whether a living document or the gate actually reads it.

1. **`data/game-differential.json` — ALREADY DONE.** Nothing owed. Listed first so nobody spends a run
   on it: gate + 7 living docs + 21 open register rows, all restored at 08:19Z today.
2. **`data/wire-ladder.json`** — 5 living documents *and* `engine/status.js` names it, plus open rows
   #424 and #108. It is the only unstamped steering artifact `status.js` reads. **~1.5 h**, and it is
   one 14-arm job rather than fourteen decisions. Highest cited-figure yield per decision.
3. **`data/state-ladder.json`** — 7 living documents (whitepaper, deck, technical docs, DAMAGE-STAGES,
   GAME-DIFFERENTIAL-DESIGN, MODELS, SUMMARY) and open row #396. **~1.5 h.** Note that
   `game_differential.js`'s own header already says the 75.5% turn-1 figure and this artifact
   *"describe the old instrument"* — so this is a candidate for **withdraw-and-supersede** rather than
   re-run, and that call belongs to whoever owns the turn-1 figure.
4. **The six `fix-batch-*` artifacts** — `fix-batch-7`, `-8`, `-M1M3M4`, `-M5M7M8`, `-M6-sidesel`,
   `-M6instr-defog`. Each is cited by 6 living documents (1 for `-8`). 961 games / cap 12 / empirical,
   all six releases openable. **~12 min total, six 2-minute runs.** Best ratio in the table.
5. **The eleven `game-differential.<mechanic>.json` arms** cited by `docs/ABRA-whitepaper.md` alone
   (`afterfaint`, `eatevent`, `enginedata`, `formeoneat`, `instructaim534`, `instructshield532`,
   `packettiming`, `residualorder`, `sidetarget`, `stolenberry`, `volleyreact`). **~25–45 min.**
6. **Everything below that — 41 artifacts — is cited only by a ledger, the CHANGELOG or a source file.**
   Those are historical records of closed work; re-running them buys a receipt on a figure nobody is
   about to quote. **Leave them unstamped and say so** rather than spending two hours.

**Do NOT re-run three of them, on purpose.** `data/verification/leaf-widening-all16-joint.json`,
`…-joint-BEFORE.json` and `…-empirical.json` are the FIXTURES for `tests/probe_instrument_digest.js`
and the receipt quoted by name in `engine/steering.js`'s own header. They are cited *because* they are
unstamped — they are the 138-vs-167 pair this function once certified COMPARABLE and additionally a
REPEAT. Re-running them destroys the evidence for the wire. The same applies to `_repro-smoke.json`,
`cap20-control-12.json` and `cap20-empirical.json` (already stamped, and PART 3's over-fire control).

## 4. NOBODY MAY BACK-STAMP. Checked, and nothing on disk does.

**A digest computed today is not evidence about the code that produced a file three weeks ago.**
Stamping one manufactures a receipt, and it launders exactly the pair this wire exists to re-examine.

Every occurrence of `driver_code` outside `steering.js` and `arms_comparable.js` was read. **No tool
writes a `driver_code` block into an artifact it did not produce.** The only place a block is moved
between artifacts is `tests/probe_instrument_digest.js` §2b, which copies `_repro-smoke.json`'s block
onto an **in-memory** copy of `cap20-control-12.json` to isolate the clause. It is labelled
`CONSTRUCTED, AND SAID SO`, both digests are real measured values from real runs, and its only
`writeFileSync` calls target a temp directory. That is correct — and it is also the shape somebody
would copy. **If a `--stamp` subcommand is ever proposed for `steering.js`, refuse it.** There is no
version where it is fine: `engine/feature_fixture.js --stamp` already demonstrates the failure mode in
this repository — a restamp answers the identity gate and silences the table gate, writing over the
evidence for the refit it was supposed to trigger.

The honest answer per bucket:

- **RE-RUNNABLE (60):** *re-run*, in the priority order above, and only for the ones somebody quotes.
- **STRANDED (0):** nothing to withhold on this axis.
- **DEAD (36):** *delete* — proposed, not done. See §6.
- **QUARANTINED ANYWAY (0):** n/a.
- **Anything not re-run:** *quote it only while saying out loud that the instrument axis was never
  checked.* That is `arms_comparable`'s own prescribed wording for UNKNOWN, and it is a refusal to
  publish the pair as a before/after — not a caption on a published figure.

## 5. `data/protocol-events.json` — the hazard is real, and it is worse than "not stamped"

**Verified independently, four ways:**

1. It is **not** in the engine release. The current release `a985300cb8ed` freezes 26 files and
   `data/protocol-events.json` is not one of them.
2. It is **not** in `steering.driver_code.files` (11 files) — correctly so: it is read with
   `fs.readFileSync` at `game_differential.js:2062`, not `require`d, so `requireClosure` cannot see it.
3. It is **not** in `steering.driver_inputs` (which holds only `move-priors.json` and
   `rollout-switch-census.json`) and not in `pins`.
4. `data/game-differential.json` nevertheless records **`driver_code_stable: true`**.

So the claim holds: it is in **no digest set at all**, and its only appearance anywhere in the
artifact is the prose string in `does_not_cover`.

**It moves.** `data/wire-ladder.json` digested it at `9c1dfeb7973c` on 2026-08-07. The live file is
`9abf74a7597e`, regenerated 2026-08-26. Two callers already watch it by hand — `wire_ladder.js`'s
`WATCHED` and `leaf_engine_contrast.js`'s `INSTRUMENT` — and the one caller that actually **reads** it
does not. That is the FACTS ARE GLOBAL rule broken: the fact lives in two typed lists and not in the
reader.

**And it is stale against the engine it describes, which is the part that is not merely a provenance
gap.** The file carries its own `source_digests`:

    "source_digests": { "engine/derive_protocol_events.js": "477e53d8315b",
                        "engine/medicham2-browser.js":      "1337ff095e92" }

The live *and released* `engine/medicham2-browser.js` is **`67756e457a55`**. The skip list is DERIVED
from the simulator's own emission sites, and it was derived from a simulator eleven days and many
narration fixes ago. The declared-not-emitted list **is** the skip list: every event on it is deleted
from the Showdown side before alignment. `undeclared_event_drops: 0` does not cover this — that
counter fires when Showdown emits something *neither claimed nor declared*; it cannot fire when
medicham2 has **started** emitting something that is still on the skip list, which is exactly the
direction the list rots in as the narration gate closes rows. On that axis the differential is
currently unable to see a class of divergence, and nothing says so.

### Where it belongs: `driver_inputs`, not the closure and not the release

**NOT in `driverCode()`'s closure.** That function derives its set from static `require` edges and
covers *code*. A data file read with `readFileSync` can only be added as a typed exception inside the
derived function — the hand-maintained ban list of four in a new costume, inside the one function this
repo built specifically to avoid it — and it would file a data input under a field whose own `covers`
string reads *"the INSTRUMENT: every local .js reachable by static require"*.

**NOT in the release SOURCES.** `steering.js`'s rejected-option (1) applies verbatim, and it is
stronger here than it was for the census: a before-arm run as `--release <old-id>` would take the OLD
skip list and the after-arm the NEW one, so **the two arms would be measured with different alignment
rules by construction** — you would be measuring "the engine changed" and "we started comparing more
lines" together, with no way to separate them. It would also fork the release id every time
`derive_protocol_events.js --write` runs.

**YES in `steering.resolve()`, beside `driver_inputs`**, digested by the caller that holds the bytes —
exactly where `move-priors.json` already sits, for the reason that block's own comment gives. With two
corrections that are not optional:

- **The comparison must be UNCONDITIONAL.** `comparable()` only compares `driver_inputs` inside
  `if (TABLE_DRIVEN.has(a.policy))`. The skip list applies under **all three** arms, including the 34
  `census-coverage-seeking/v1` artifacts. A clause that fires on 70 of 112 is not a guard.
- **Absence must read UNKNOWN, not a refusal.** Putting it in `vouches()` would flip all 112 existing
  artifacts from UNKNOWN to NOT COMPARABLE — asserting they were *shown* to differ, which is false and
  is the same laundering in the opposite direction. It belongs in `comparable()`'s `unknown` bucket,
  next to the `driver_code` clause it mirrors.

And separately from comparability: **the skip list is owed a REFIT, not a restamp.** Its input function
(medicham2's emission sites) changed, so re-running `derive_protocol_events.js --write` is the answer,
and `game_differential.js` should **refuse** when `PROTO.source_digests['engine/medicham2-browser.js']`
differs from the release's digest for the same file. That refusal is worth more than the digest: it is
the difference between recording which ruler was used and noticing the ruler is wrong.

### Proposed diff (NOT applied — MEASURE was read-only this pass)

```diff
--- a/engine/game_differential.js
+++ b/engine/game_differential.js
@@ near line 2062, the PROTO read
-const PROTO = JSON.parse(fs.readFileSync(D('data', 'protocol-events.json'), 'utf8'));
+/* PINNABLE AND DIGESTED. The declared-not-emitted list IS the alignment rule: it decides which
+ * Showdown lines are deleted before comparison, so two arms handed different bytes are not a
+ * before/after. It goes to steering.resolve() as an alignment input rather than into driverCode()'s
+ * closure (that derives from static require and covers CODE) or into the engine release (a
+ * before-arm on an old release would then take the OLD rule — steering.js's rejected option (1)). */
+const PROTO_PATH = argVal('--protocol-events') || D('data', 'protocol-events.json');
+const PROTO = JSON.parse(fs.readFileSync(PROTO_PATH, 'utf8'));
+const PROTO_INPUT = {
+  file: 'data/protocol-events.json',
+  read_from: PROTO_PATH === D('data', 'protocol-events.json') ? 'live tree' : path.relative(ROOT, PROTO_PATH),
+  digest: ER.sha12(PROTO_PATH), generated: PROTO.generated || null,
+  rows: (PROTO.notEmitted || []).length,
+  what: 'the DECLARED SKIP LIST — every event medicham2 says it does not emit is removed from the '
+      + 'Showdown side before alignment, so this decides what can count as a divergence',
+  derived_from_medicham2: (PROTO.source_digests || {})['engine/medicham2-browser.js'] || null,
+};
@@ lines 2320-2322
 const DRIVER_CODE = STEERING.driverCode({ frozen: Object.keys((REL.manifest && REL.manifest.files) || {}) });
+/* THE SKIP LIST IS DERIVED FROM THE SIMULATOR'S OWN EMISSION SITES. A list derived from a different
+ * simulator over-skips exactly the lines a narration fix has just started emitting, and
+ * `undeclared_event_drops` cannot see that direction. REFUSE rather than caption. */
+{
+  const want = REL.stamp().source_digests['engine/medicham2-browser.js'];
+  const got  = PROTO_INPUT.derived_from_medicham2;
+  if (got && want && got !== want) {
+    throw new Error('data/protocol-events.json was derived from engine/medicham2-browser.js ' + got
+      + ' and this run plays ' + want + '. The declared-not-emitted list is the ALIGNMENT RULE and it '
+      + 'is a function of the simulator; a stale one deletes the very lines a narration fix has just '
+      + 'started emitting. Regenerate it — SHOWDOWN_PATH=... node engine/derive_protocol_events.js '
+      + '--write — or pin it deliberately with --protocol-events <path>. This is a REFIT, not a '
+      + 'restamp: the feature FUNCTION changed.');
+  }
+}
 const STEER = STEERING.resolve({ censusPath: CENSUS_PIN, mode: STEER_MODE, driverInputs: EMP_INPUTS,
-                                 driverCode: DRIVER_CODE });
+                                 driverCode: DRIVER_CODE, alignmentInputs: [PROTO_INPUT] });

--- a/engine/steering.js
+++ b/engine/steering.js
@@ in resolve(), beside driver_inputs
+    /* WHAT DECIDES WHICH LINES MAY COUNT AS A DIVERGENCE, as opposed to which games get played.
+     * Separate from driver_inputs because it applies under EVERY policy, including the coverage arm
+     * where driver_inputs is null. REFUSED on absence for the same reason an unreadable census is:
+     * a run whose alignment rule nobody recorded is a run measured with an unknown ruler. */
+    alignment_inputs: (() => {
+      const a = opts.alignmentInputs;
+      if (!Array.isArray(a) || !a.length) {
+        throw new Error('steering: no alignmentInputs. data/protocol-events.json decides which '
+          + 'Showdown lines are deleted before alignment, so it moves every class count; a run that '
+          + 'does not digest it cannot be compared with any other run.');
+      }
+      return a;
+    })(),
@@ in comparable(), AFTER the driver_code clause, UNCONDITIONAL — not inside TABLE_DRIVEN
+  /* THE ALIGNMENT RULE. Not gated on policy: the skip list applies under all three arms, and a
+   * clause that fires on 70 of 112 artifacts is not a guard. ABSENCE IS `unknown`, NOT a refusal —
+   * every artifact on disk predates the field, and "nothing recorded it" is no more evidence that
+   * they differed than that they matched. Deliberately NOT added to vouches(), which would flip 112
+   * artifacts from UNKNOWN to NOT COMPARABLE and assert something false about them. */
+  const align = s => (s.alignment_inputs || []).map(x => (x && x.file) + '@' + (x && x.digest)).sort().join(', ');
+  const aa = a.alignment_inputs, ab = b.alignment_inputs;
+  if (aa && ab) {
+    if (align(a) !== align(b)) {
+      bad.push('the ALIGNMENT RULE differs: ' + align(a) + ' vs ' + align(b) + '. '
+        + 'data/protocol-events.json is the declared skip list — an event on it is deleted from the '
+        + 'Showdown side before comparison, so a row added or removed moves every class count in the '
+        + 'table for a reason unrelated to the change under test.');
+    }
+  } else {
+    unknown.push((aa || ab ? 'only the ' + (aa ? 'before' : 'after') + '-arm records'
+                           : 'NEITHER arm records') + ' `alignment_inputs`, so the '
+      + 'data/protocol-events.json bytes that decided which lines could count as a divergence are not '
+      + 'on record. It moved once already (9c1dfeb7973c on 2026-08-07 -> 9abf74a7597e on 2026-08-26) '
+      + 'and it is DERIVED from engine/medicham2-browser.js, which moves constantly.');
+  }

--- a/engine/arms_comparable.js
+++ b/engine/arms_comparable.js
@@ the limits list
-    'data/protocol-events.json — the DECLARED SKIP LIST. It decides which Showdown lines are removed '
-      + 'before alignment, so a change to it moves every class count in the table. Not stamped.',
+    ([a, b].every(x => x.steering && x.steering.alignment_inputs)
+      ? 'data/protocol-events.json — the DECLARED SKIP LIST — is CHECKED for this pair '
+        + '(steering.alignment_inputs, both arms).'
+      : 'data/protocol-events.json — the DECLARED SKIP LIST. It decides which Showdown lines are '
+        + 'removed before alignment, so a change to it moves every class count. REPORTED ABOVE as '
+        + 'UNKNOWN for this pair.'),
```

The last hunk matters as much as the first: the limits line is **computed from the two blocks in front
of it**, the same repair `driverCode` got on 2026-09-05, so it cannot go on saying "not stamped" after
it is stamped. A limits list that says the same thing whatever it is handed is prose outliving what it
described.

## 6. The tables

### 6a. RE-RUNNABLE, tier 1 — cited by a living document, `status.js`, or the gate (19)

| artifact | living docs | in `status.js` | open register rows | release | policy | games/cap |
|---|---|---|---|---|---|---|
| `data/state-ladder.json` | 7 | — | #396 | none | coverage | 14 arms |
| `data/verification/fix-batch-7.json` | 6 | — | — | `316669459d67` | empirical | 961/12 |
| `data/verification/fix-batch-M1M3M4.json` | 6 | — | — | `f3504e5f88d6` | empirical | 961/12 |
| `data/verification/fix-batch-M5M7M8.json` | 6 | — | — | `9b449a41c865` | empirical | 961/12 |
| `data/verification/fix-batch-M6-sidesel.json` | 6 | — | — | `7ffc58da8ef8` | empirical | 961/12 |
| `data/verification/fix-batch-M6instr-defog.json` | 6 | — | — | `252025cfcddc` | empirical | 961/12 |
| `data/wire-ladder.json` | 5 | **yes** | #424, #108 | none | coverage | 14 arms |
| `data/verification/fix-batch-8.json` | 1 | — | — | `a5c736283129` | empirical | 961/12 |
| `data/verification/game-differential.afterfaint.json` | 1 | — | — | `26787be1b8b4` | empirical | 961/12 |
| `data/verification/game-differential.eatevent.json` | 1 | — | — | `f933a01b792a` | empirical | 961/12 |
| `data/verification/game-differential.enginedata.json` | 1 | — | — | `862624c9826e` | empirical | 961/12 |
| `data/verification/game-differential.formeoneat.json` | 1 | — | — | `68c90b3b9f17` | empirical | 961/12 |
| `data/verification/game-differential.instructaim534.json` | 1 | — | — | `e8f7c7dba595` | empirical | 961/12 |
| `data/verification/game-differential.instructshield532.json` | 1 | — | — | `705ead2014b2` | empirical | 961/12 |
| `data/verification/game-differential.packettiming.json` | 1 | — | — | `a18431d6dbe2` | empirical | 961/12 |
| `data/verification/game-differential.residualorder.json` | 1 | — | — | `b45e6b257029` | empirical | 961/12 |
| `data/verification/game-differential.sidetarget.json` | 1 | — | — | `070890fc77a2` | empirical | 961/12 |
| `data/verification/game-differential.stolenberry.json` | 1 | — | — | `0e8ec5729a7b` | empirical | 961/12 |
| `data/verification/game-differential.volleyreact.json` | 1 | — | — | `12dae69813f6` | empirical | 961/12 |

Every release named here opens. `data/wire-ladder.json` and `data/state-ladder.json` carry no
top-level release id because they are ladders over fourteen releases; each arm names its own, and
their `comparability.per_arm` block already reads `all_ok: true` under the pre-instrument-digest rules.

### 6b. RE-RUNNABLE, tier 3 — cited only by a source file, a division ledger or the CHANGELOG (41)

`web/quarantine-data.js` is a *generated inventory* of artifact names, not a reader that would re-run
anything, so it is omitted from the "cited in source" column below. **Leave this whole tier
unstamped** unless somebody is about to quote one.

| artifact | release | policy | cited in source | cited in ledger/CHANGELOG |
|---|---|---|---|---|
| `data/_dmg-inverted.json` | `978ca8fe72c9` | coverage | — | — |
| `data/_pair-pilot.json` | `5e0853311131` | coverage | — | ENGINE, WEB, CHANGELOG |
| `data/_r220-gd-post.json` | `978ca8fe72c9` | coverage | `engine/game_differential.js` | ENGINE |
| `data/_r220-gd-pre.json` | `978ca8fe72c9` | coverage | `engine/game_differential.js` | ENGINE |
| `data/_r220-void-pair-POST.json` | `978ca8fe72c9` | coverage | — | ENGINE |
| `data/_r220-void-pair-PRE.json` | `978ca8fe72c9` | coverage | — | ENGINE |
| `data/_turncap-cap12.json` | `c6d45355668e` | coverage | — | — |
| `data/_turncap-cap16.json` | `c6d45355668e` | coverage | — | — |
| `data/_turncap-cap30.json` | `c6d45355668e` | coverage | — | — |
| `data/_void-fields.json` | `978ca8fe72c9` | coverage | — | — |
| `data/_void-fields2.json` | `978ca8fe72c9` | coverage | — | — |
| `data/_void-final.json` | `978ca8fe72c9` | coverage | — | — |
| `data/_void-leak.json` | `978ca8fe72c9` | coverage | — | — |
| `data/_void-pair-POST-newrule.json` | `978ca8fe72c9` | coverage | — | — |
| `data/game-differential-endstate-turn19.json` | `6155acc0fb26` | coverage | — | MEASURE |
| `data/game-differential-endstate-turn30.json` | `6155acc0fb26` | coverage | — | — |
| `data/game-differential-endstate-turn40.json` | `6155acc0fb26` | coverage | — | MEASURE |
| `data/game-differential-endstate-v2.json` | `a81663f17c0c` | coverage | — | ENGINE |
| `data/game-differential-endstate.json` | `6155acc0fb26` | coverage | — | ENGINE, MEASURE |
| `data/game-differential-PRE.json` | `1a9d81ca552c` | coverage | `engine/game_differential.js` | ENGINE, CHANGELOG |
| `data/verification/closet-control.json` | `d38d117e68e9` | coverage | — | ENGINE, CHANGELOG |
| `data/verification/fix-batch-5.json` | `3187ea18c625` | empirical | `medicham2-browser.js`, 2 probes | ENGINE |
| `data/verification/fix-batch-6.json` | `014fe780a1a6` | empirical | `probe_sun_refuses_freeze.js` | ENGINE |
| `data/verification/game-differential.accstage.json` | `52e0e7effbd6` | empirical | — | CHANGELOG |
| `data/verification/game-differential.allyside.json` | `2c884278412b` | empirical | — | ENGINE |
| `data/verification/game-differential.allytarget.json` | `6e7fff81fcec` | empirical | — | ENGINE |
| `data/verification/game-differential.coverage-2026-09-04T0141.json` | `8ad06030e129` | coverage | — | MEASURE, CHANGELOG |
| `data/verification/game-differential.empirical-after.json` | `e129bca605e3` | empirical | — | CHANGELOG |
| `data/verification/game-differential.joint.json` | `a5c736283129` | joint | `engine/game_differential.js` | — |
| `data/verification/game-differential.kingsrock.json` | `b43a2fea0cb1` | empirical | — | CHANGELOG |
| `data/verification/game-differential.partingshot531.json` | `124f5aa8c8bd` | empirical | — | ENGINE, ROADMAP, CHANGELOG |
| `data/verification/game-differential.prioritymod.json` | `eb6a797411cd` | empirical | — | ENGINE |
| `data/verification/game-differential.safeguard.json` | `552e2a4510e8` | empirical | — | ENGINE, CHANGELOG |
| `data/verification/game-differential.stallbase.json` | `cc7dca43e395` | empirical | `probe_shield_rearm.js` | — |
| `data/verification/gd-after-241-256-259.json` | `4fe582c3c59a` | coverage | — | ENGINE |
| `data/verification/gd-endstate-309.json` | `9b216aeeaa84` | coverage | — | ROADMAP, CHANGELOG |
| `data/verification/gd-endstate-982.json` | `94a84744346d` | coverage | `divergence_shape.js`, `probe_endstate_by_cause.js` | ENGINE |
| `data/verification/gd-endstate-trial.json` | `94a84744346d` | coverage | — | CHANGELOG |
| `data/verification/leaf-widening-all16-empirical.json` | `688e696f00c8` | empirical | `probe_instrument_digest.js` | — |
| `data/verification/leaf-widening-all16-joint-BEFORE.json` | `688e696f00c8` | joint | `engine/steering.js`, `probe_instrument_digest.js` | — |
| `data/verification/leaf-widening-all16-joint.json` | `688e696f00c8` | joint | `engine/steering.js`, `probe_instrument_digest.js` | CHANGELOG |

The last three rows are the **do-not-re-run** fixtures named in §3.

### 6c. DEAD — unstamped and cited by nothing (36, 23.9 MB)

**Proposed for deletion. Not deleted, and not by me.** CLAUDE.md's standing rule is that a file you
did not create is reported and left; an untracked file is unrecoverable. All 36 below are tracked or
untracked working artifacts in `data/verification/` and the call belongs to whoever owns that
directory. If in doubt, the cost of leaving them is 24 MB and nothing else.

| artifact | written | release |
|---|---|---|
| `data/verification/gd-endstate-982-t30.json` | 2026-08-20 | `94a84744346d` |
| `data/verification/gd-endstate-AFTER.json` | 2026-08-20 | `94a84744346d` |
| `data/verification/gd-dump-run.json` | 2026-08-22 | `6a05dd9ad60d` |
| `data/verification/gd-card8-BEFORE.json` | 2026-08-26 | `705d2c7e86e8` |
| `data/verification/gd-card8-AFTER.json` | 2026-08-26 | `705d2c7e86e8` |
| `data/verification/game-differential.coverage-control.json` | 2026-08-29 | `e129bca605e3` |
| `data/verification/gd-empirical-cards.json` | 2026-08-29 | `e129bca605e3` |
| `data/verification/game-differential.weightfix.json` | 2026-08-29 | `b39a5c87fe2d` |
| `data/verification/game-differential.redirect.json` | 2026-08-29 | `4b67526d29d8` |
| `data/verification/game-differential.innardsout.json` | 2026-08-29 | `0a2282c9231b` |
| `data/verification/game-differential.encore.json` | 2026-08-29 | `cc7dca43e395` |
| `data/verification/game-differential.shieldrearm.json` | 2026-08-29 | `03e049dc7299` |
| `data/verification/game-differential.shieldrearm-dump.json` | 2026-08-29 | `03e049dc7299` |
| `data/verification/game-differential.prioritymod-knob.json` | 2026-08-29 | `eb6a797411cd` |
| `data/verification/game-differential.instructaim534-knob.json` | 2026-08-29 | `e8f7c7dba595` |
| `data/verification/game-differential.punishkinds.json` | 2026-09-01 | `cde6cb10daa7` |
| `data/verification/game-differential.punishkinds-before.json` | 2026-09-01 | `cde6cb10daa7` |
| `data/verification/game-differential.terrainspread-before.json` | 2026-09-01 | `1c346ff23712` |
| `data/verification/game-differential.terrainspread.json` | 2026-09-01 | `1c346ff23712` |
| `data/verification/game-differential.terraingate-before.json` | 2026-09-01 | `d9dc3afe16ef` |
| `data/verification/game-differential.terraingate.json` | 2026-09-01 | `d9dc3afe16ef` |
| `data/verification/game-differential.eterrain-before.json` | 2026-09-03 | `53e3e90dce8d` |
| `data/verification/game-differential.eterrain.json` | 2026-09-03 | `53e3e90dce8d` |
| `data/verification/game-differential.empirical.json` | 2026-09-04 | `8ad06030e129` |
| `data/verification/leaf-widening-batch1.json` | 2026-09-04 | `8ad06030e129` |
| `data/verification/leaf-widening-batch2.json` | 2026-09-05 | `6f96db9da019` |
| `data/verification/driver-control-empirical.json` | 2026-09-05 | `a5c736283129` |
| `data/verification/charge-fixture-empirical-knobs.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/charge-fixture-empirical.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/charge-fixture-joint-knobs.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/charge-fixture-joint.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/leaf-widening-all16-empirical-BEFORE.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/_smoke-leafwiden.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/leaf-widening-all16-joint-REPEAT.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/protect-fix-empirical-KNOB-BEFORE.json` | 2026-09-05 | `688e696f00c8` |
| `data/verification/protect-fix-empirical.json` | 2026-09-05 | `688e696f00c8` |

**Two cautions on this list.** `leaf-widening-all16-empirical-BEFORE.json` and
`leaf-widening-all16-joint-REPEAT.json` are the *other halves* of pairs whose surviving halves are
fixtures in `tests/probe_instrument_digest.js`; deleting them would leave a cited artifact with no
counterpart. And a run written **today** can read as uncited here only because `docs/_reports/` is
exempt from the currency baseline and the ENGINE agent has not yet written its ledger entry — so a
freshly-written artifact must never be swept on this list's strength. Nothing dated 2026-09-06 appears
above for that reason.

## 7. What this pass did NOT do

- **No back-stamping, of anything.** See §4.
- **No re-run.** Not one arm was played; the priority list is a proposal, not a record.
- **Leaf calibration is not in this report.** `data/winrate-backtest.json` remains downstream of
  MEDICHAM, the gate is shut on the board-material clause, and the standing brief is not discharged
  by anything here.
- **The noise floor for the whole-game count is still unmeasured**, so nothing above should be read as
  a claim about how big a difference in a class count has to be before it is a difference.
