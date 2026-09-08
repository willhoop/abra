# The skip list is now in a digest set, and `probe_red_demo.js` is being re-aimed

2026-09-08, MEDICHAM-correctness sprint, MEASURE. Two pieces of instrument debt that undermine the
gate itself. Nothing here is typed from memory; every count is derived by a command recorded beside
it. **No commit** — Will publishes.

**Live-agent hazard, recorded because it moved under this pass.** An ENGINE agent held
`engine/medicham2-browser.js` throughout. It moved **twice while this ran**:
`1337ff095e92` (the artifact's stamp, 2026-08-26) -> `5a86b1d52bd5` (release `cf8567c4db78`, 05:03Z)
-> `9a54ee6881cf` (release `f0f10cd06861`, 05:41Z). That is not an aside — it is the measurement that
decided the shape of the guard in section 1.3.

---

## 1. JOB 1 — `data/protocol-events.json`

### 1.1 The refit was RUN, and the skip list did not move

```
cp data/protocol-events.json <scratch>/protocol-events.BEFORE.json
node engine/derive_protocol_events.js            # read-only first
node engine/derive_protocol_events.js --write
```

Read-only first: `91 distinct events from 17 files / medicham2 emits 44 / declared, with a reason 50 /
partial shapes 10 / BOTH GATES PASS`, exit 0 — identical to the artifact's own published counts.

Then the whole object diffed, `generated`, `source_digests` and `derivedFrom` excluded:

| field | before (2026-08-26) | after (2026-09-08) |
|---|---|---|
| `emitted` / `emittedCount` | 44 | **44, byte-identical** |
| `notEmitted` / `notEmittedCount` | 50 | **50, byte-identical** |
| `partial` / `partialCount` | 10 | **10, byte-identical** |
| `events` (91 rows, incl. each row's `medicham` standing) | — | **byte-identical** |
| `gates` | `invented: [], undeclared: []` | **unchanged** |
| `showdown_pinned_commit` | `20ad99ff...` | unchanged |
| `source_digests['engine/derive_protocol_events.js']` | `477e53d8315b` | unchanged |
| `source_digests['engine/medicham2-browser.js']` | `1337ff095e92` | **`5a86b1d52bd5`** |
| `generated` | `2026-08-26 22:47:00` | `2026-09-08 05:36:17` |

`git diff --stat data/protocol-events.json` -> **1 file changed, 3 insertions, 3 deletions** — the
timestamp, the medicham2 digest, and `derivedFrom.showdown` (a machine path whose slash style differs
because the run resolved it through `showdown_path.js` instead of a hand-set env var).

**SO: NARRATION DOES NOT MOVE.** No count in `data/game-differential.json` changes, because the bytes
that decide what is deleted before alignment are the same bytes. This is a published-figure question
and the answer is that no published figure moved.

**And the reason it did not rot is measurable rather than lucky.** The artifact's only dependence on
the simulator is `medicham2.TRACE_EVENTS`, and that list is **unchanged between 2026-08-26 and now** —
zero events added, zero removed, 44 both times:

```
require('./data/engine-data.js');
const M = require('./engine/medicham2-browser.js');
// added since 08-26: []   removed since 08-26: []
```

The three names that appear in **both** `emitted` and `notEmitted` — `upkeep`, `-fieldstart`,
`-fieldactivate` — are deliberate and their declared reasons say so ("EMITTED — see emitted[]").
`sdStream()` tests `CLAIMED.has(k)` **before** the skip list, so a claimed event is kept whatever the
list says.

### 1.2 What the hazard actually was, stated accurately

The triage (`docs/_reports/2026-09-06-comparability-backfill-triage.md` section 5) said the file is
"in no digest set at all". Two corrections, both derived:

- **Provenance already carried the edge.** `node engine/provenance.js --graph --json` lists
  `protocol-events.json` in `game-differential.json`'s `from` set — its `readFileSync` scan finds it.
  What was missing was a **content digest in the artifact**, which is the axis `arms_comparable.js`
  reads, not the mtime axis provenance reads.
- **The rot direction the triage feared is already closed by `sdStream`'s ordering**, per 1.1. The
  direction that is genuinely open is the reverse: an event medicham2 **stops** claiming, a change to
  the typed `NOT_EMITTED` table inside `derive_protocol_events.js`, or a Showdown checkout that moves
  the event universe. Those are what 1.3 refuses on.

The real, unarguable gap is the one the triage names first: **editing the file changed what the
differential sampled while `driver_code_stable` still read `true`.** A pin that does not pin.

### 1.3 The wiring, and why the guard asks about the FUNCTION and not the stamp

Landed exactly where the triage derived — `steering.resolve()` beside `driver_inputs`, compared
**unconditionally** in `comparable()` (not inside `TABLE_DRIVEN`, which would skip the 34 coverage
arms), absence reading **`unknown`** rather than being added to `vouches()`.

| file | change |
|---|---|
| `engine/game_differential.js` | `--protocol-events <path>` pin; `PROTO_INPUT` (digest, rows, `generated`, `derived_from_medicham2`, `medicham2_played`); three refusal clauses; `alignmentInputs: [PROTO_INPUT]` into `resolve()` |
| `engine/steering.js` | `alignment_inputs` in `resolve()` (REFUSES on absence); unconditional `ALIGNMENT RULE` clause in `comparable()`, absence -> `unknown` |
| `engine/arms_comparable.js` | the limits line is **computed from the two blocks in front of it** instead of reading "Not stamped." forever |
| `tests/test-empirical-driver.js` | fixture carries `alignment_inputs`; three new checks (differs -> NO, both-absent -> UNKNOWN, absent-at-resolve -> refusal) |

**THE ONE PLACE THIS DEPARTS FROM THE TRIAGE, AND IT WAS DECIDED BY A MEASUREMENT.** The triage's diff
throws when `PROTO.source_digests['engine/medicham2-browser.js']` differs from the release's digest for
the same file. That is a guard on a **stamp**. During this pass the engine moved twice with
`TRACE_EVENTS` byte-identical — so that guard would have refused two runs whose alignment rule had not
moved at all, on the same day it was written. An over-firing gate is the one people learn to ignore
(#148), and this repository's own restamp rule is that a restamp is valid exactly when the feature
FUNCTION is unchanged. Here the function is checkable, so it is checked:

1. **the CLAIM moved** — `PROTO.emitted` vs the played release's `M.TRACE_EVENTS`, and the error names
   the events added and removed. This is precisely the direction the triage was worried about.
2. **the DERIVATION RULE moved** — `source_digests['engine/derive_protocol_events.js']`, because every
   declared reason is typed inside that script.
3. **the AUTHORITY moved** — `showdown_pinned_commit`, because the skip list is a complement of the
   event universe that checkout defines.

The stamp is still **recorded** in `alignment_inputs` (`derived_from_medicham2` and `medicham2_played`
side by side), so a divergence between them can never be silent — it just does not stop a run whose
ruler has not changed.

### 1.4 RED FIRST, with a silent control

`node engine/game_differential.js --games 1 --turns 1 --team-store data/team-pool-frozen
--protocol-events <file>`:

| file handed to the run | exit | what fired |
|---|---|---|
| **CONTROL** — byte-identical copy at a different path | **0** | nothing (so it is not refusing on the path) |
| one event removed from `emitted` | **1** | *"...recorded 43 emitted events (from ...5a86b1d52bd5) and this run plays 44 (9a54ee6881cf). NOW CLAIMED, and the list may still be deleting them from the Showdown side: -boost"* |
| `derive_protocol_events.js` digest zeroed | **1** | *"...produced by engine/derive_protocol_events.js 000000000000 and that file is now 477e53d8315b."* |
| `showdown_pinned_commit` replaced | **1** | *"...derived from Showdown deadbeef... and this run plays against 20ad99ff..."* |

**The knob reached the rule**: the control and each break differ in one field of one JSON file and the
verdict moves 0 -> 1.

`node engine/arms_comparable.js`, on a real artifact written by the run above:

| pair | exit | verdict |
|---|---|---|
| identical `alignment_inputs` | 0 | COMPARABLE, limits line reads *"is CHECKED for this pair (steering.alignment_inputs, both arms)"* |
| digest changed on one arm | 1 | **NOT COMPARABLE — shown to differ**, `the ALIGNMENT RULE differs: ...@7c9de3868d6f vs ...@000000000000` |
| one arm has no `alignment_inputs` | 1 | **UNKNOWN**, limits line flips to *"REPORTED ABOVE as UNKNOWN for this pair"* |

`node tests/test-empirical-driver.js` — **GREEN, 26 of 26** (was 24; the intermediate state where the
section-5 fixture carried no `alignment_inputs` was the new clause firing correctly).

A tiny end-to-end run wrote the field into a real artifact:

```
"alignment_inputs": [{ "file": "data/protocol-events.json", "read_from": "data/protocol-events.json",
  "digest": "7c9de3868d6f", "generated": "2026-09-08 05:36:17", "rows": 50,
  "derived_from_medicham2": "5a86b1d52bd5", "medicham2_played": "9a54ee6881cf" }]
```

### 1.5 What this costs, said out loud

Every artifact on disk now reads **UNKNOWN** on the alignment axis when paired with a new one, because
none of them carries the field. That is the honest verdict and it is deliberately not a refusal: the
field was not asked for when they were taken, and "nothing recorded it" is no more evidence that two
runs differed than that they matched. It is the same call `driver_code` got on 2026-09-05.

`steering.resolve()` now throws without `alignmentInputs`. The only production caller is
`engine/game_differential.js` and it passes them; the two direct call sites in
`tests/test-empirical-driver.js` were updated in the same pass.

---
