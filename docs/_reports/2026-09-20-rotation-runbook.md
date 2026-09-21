# The regulation-rotation runbook, and what the touchpoint inventory actually says

**Date.** 2026-09-20. **Division.** MEASURE. **Status.** Findings record — historical by construction,
never cited as current state (CLAUDE.md, `docs/_reports/` rule).

Every count below is a **live derivation over the working tree on the day**, reproduced by
`node engine/regulation_touchpoints.js`. It is quoted as the readout that produced it, not claimed as
an artifact figure, and it is stale the moment a file is added. **Re-run rather than quote this page.**

Deliverables: `engine/regulation_touchpoints.js` (the derivation) and
[`docs/REGULATION-ROTATION.md`](../REGULATION-ROTATION.md) (the procedure).

---

## 1. The inventory, classified

```
$ node engine/regulation_touchpoints.js                                        (2026-09-20)

  1586 file(s) name a regulation id or token.
  734 skipped (binary or over 20 MB), 0 unreadable.

  CONFIGURATION      3   EDIT — the id is a setting; everything downstream follows it
  HARDCODED         25   DECIDE, per site — it keeps working about the OLD regulation after the flip
  UNDECIDED          1   READ IT — no structural rule fits; a human says which class it is
  DERIVED          110   RE-RUN its generator — no edit; the figure is about the old regulation until then
  COMMENTED         66   READ ONCE — the id is only in a comment; stale prose inside live code
  PROSE             17   REWRITE at the documentation pass — judgement, not a find-and-replace
  HISTORICAL      1364   LEAVE IT — dated evidence; rewriting it edits the evidence chain
```

**HISTORICAL is 86% of the population** and every one of those files must NOT change:

| root | files |
|---|---|
| `data/releases/` | 651 |
| `data/verification/` | 548 |
| `docs/_reports/` | 140 |
| `data/archive/` | 13 |
| `docs/archive/` | 3 |
| dated or release-stamped filenames elsewhere, `CHANGELOG.md`, `docs/RUNNING-NOTES.md` | 9 |

### Reconciling with the 702 in the brief

The brief's count excluded `data/releases/`, `data/archive/`, `data/_*`, `docs/_reports/` and
`docs/HANDOFF*`, and matched only the full format id. This scan excludes nothing up front — it
classifies instead — and also matches a regulation TOKEN in a path. Subtract the excluded roots and
the two populations agree in shape: the brief's `data 608` is overwhelmingly `data/verification/`
(548), which the brief did not exclude and which is the same kind of write-once evidence as
`data/releases/`. **Nothing disagrees; the two numbers answer questions with different exclusion sets,
which is exactly why the classifier does not take an exclusion set as input.**

---

## 2. Is `data/regulations.json` genuinely the single source of truth?

Its own `_note` claims it is *"Single source of truth for which Champions regulation ABRA is
tracking"*. **The claim survives the audit with one word added and two holes named.**

**It IS the single source of truth for the active format ID.** It is one of only three CONFIGURATION
files in the repository (the others are `.gitignore`, which names an old store file, and
`data/quality-filter.json`, which mentions the format in its documented rules). And the narrow gate
that guards the doctrine is clean:

```
$ node engine/format_id_scan.js                                                (2026-09-20)
  0 live call site(s) across 730 file(s); ids named: (none)
```

Zero typed `forFormat(...)` call sites under `engine/`, `build/` and `tests/`. That is a real
achievement and it is why the flip is one edit.

**Hole 1 — it is not the single source of truth for the AUTHORITY.** Which Showdown checkout the
simulator reads is resolved by `engine/showdown_path.js` from a sibling directory, with `SHOWDOWN_PATH`
taking precedence. The config cannot re-point it. The Reg M-C rotation needed a second checkout for
exactly this reason, and no config edit expresses that.

**Hole 2 — nine files carry a hardcoded fallback to the CURRENT regulation, and eight of them are
silent.** Each reads the config inside a `try` and returns a literal id when the read fails or the
`active` entry lacks a `showdownFormat`:

| file | announces the fallback? |
|---|---|
| `engine/champions_sim.js` | **yes** — `console.error('champions_sim: FALLING BACK to a hardcoded format id — ' + why)` and sets `FORMAT_FALLBACK` |
| `engine/analyze.js` | no |
| `engine/chomp_ev.js` | no |
| `engine/durable-ingest.js` | no |
| `engine/fetch_smogon_stats.js` | no |
| `engine/meta-ingest.js` | no |
| `engine/smogon_priors.js` | no |
| `engine/validate_damage_sim.js` | no |
| `sim/champions-battle.js` | no |

The fallback itself is deliberate and documented in each file ("the literal survives only as a
fallback for a corrupt config, where guessing beats crashing"). **The defect is the silence, not the
fallback.** A malformed config, a renamed key or a mistyped `active` value produces a clean run, a
committed store and a published figure — all about the previous regulation, with nothing reporting a
failure. That is the 2026-07-28 signature exactly, and `engine/champions_sim.js` already shows the
one-line shape of the fix.

**Not fixed in this pass.** Eight of the nine are engine files and belong to ENGINE; MEASURE builds the
ruler and does not change a mechanic. Filed here with the file list rather than patched.

**Hole 3 — a third population the config never mentions.** The new regulation's collector names its
format ids directly in a shell loop in `.github/workflows/next-regulation.yml`, deliberately ("belt
and braces — remove once the automatic step is seen collecting"), while `data/regulations.json` still
knows only the outgoing regulation. That is correct for today and it means the config is not a
complete statement of which regulations the repository is handling.

---

## 3. The largest avoidable cost

**Ranked by what a rotation actually pays:**

1. **The eight silent fallbacks** (§2, hole 2). Cost if they fire: an entire run's output, undetected.
   Cost to fix: one `console.error` each, copied from `engine/champions_sim.js`. This is the clearest
   avoidable cost in the inventory.
2. **The frozen-pool path, which the id scan cannot see at all.** `data/team-pool-frozen` is named on
   **95 live source lines** and carries no regulation id anywhere. It is the outgoing regulation by
   construction — every board-material figure rests on it. A rotation does not re-point it; the new
   regulation gets its own pinned pool, and every caller has to decide which it means. The scanner
   prints this as a BLIND SPOT and derives the corpus set from the `FROZEN` marker each one carries,
   so a second pinned corpus is picked up with no edit.
3. **66 COMMENTED files** — 42 under `tests/`, 20 under `engine/` — where a format id sits in prose
   inside live code. Harmless to run, and it is precisely the shape of every stale-prose failure this
   repository has recorded. Cheap to read once, and nothing schedules it.
4. **The 12 HARDCODED sites under `tests/`** are mostly legitimate PINS on measured evidence (replay
   ids, deliberate old-regulation fixtures). `engine/format_id_scan.js` already states that doctrine
   and refuses to take a position per site. **Rewriting one edits the record**, so this is a decision
   per site and not a cost to eliminate.

---

## 4. What the classifier got wrong first, and why it is in the source

Both errors are recorded in `engine/regulation_touchpoints.js` beside the rules that fix them, because
a classifier that has never been wrong in a way you can see is not one you should trust.

- **A bare-token pattern matched English.** `/\breg[a-z]{1,3}\d?\b/` matched `regex` in
  `.githooks/pre-commit` and `regime` in `data/test-waivers.json`, putting two innocent files on the
  list a human is asked to read. The token set is now **derived from the ids actually found**, through
  `next_regulation.parseFormatId`, so it cannot match a word.
- **A reader test admitted four row dumps as configuration.** The discriminator between "a setting"
  and "a recording" was "does tracked source read it by name" — and a `.jsonl` of games is read by its
  consumer exactly as a config file is. A `.jsonl` and a `window.`-assigning bundle are now never
  CONFIGURATION, whoever reads them: the id in them is a recorded fact about the run that wrote them.

After both fixes CONFIGURATION is 3 and UNDECIDED is 1 — a list a person reads in five seconds, which
is the bar a classifier has to clear to be worth running.

---

## 5. What the tool deliberately does not do

- **It is not a gate.** It exits 0 with findings. Will's standing instruction is to fix the thing
  rather than build scaffolding around it.
- **It does not restate a predicate that has an owner.** The id shape comes from
  `engine/next_regulation.js` `VGC_REG`; the comment and call-site predicates from
  `engine/format_id_scan.js` `COMMENT` and `CALL`. The ORDER of the flip stays in
  `engine/next_regulation.js --checklist`, which derives the readers of the config.
- **It does not duplicate `engine/provenance.js`'s writer graph.** The DERIVED class is decided by a
  generation STAMP, which is a weaker question than "who wrote this" and is the only one this tool
  needs. Measured on the day: 99 of the 102 non-historical `data/*.json` files naming a regulation
  carry a stamp at the top level.
- **It does not token-scan file CONTENT.** A document writing the regulation's name in a sentence is
  prose the PROSE class already carries, and matching it would bury the actionable list in English.
  Tokens are matched on the PATH only.

---

## 6. Reproduction

```bash
node engine/regulation_touchpoints.js
node engine/regulation_touchpoints.js --rules
node engine/regulation_touchpoints.js --class hardcoded      # with line numbers
node engine/regulation_touchpoints.js --class prose
node engine/regulation_touchpoints.js --json
node engine/format_id_scan.js
node engine/next_regulation.js --checklist
```

No measurement was run, no artifact was regenerated, and neither Showdown checkout was touched.
