# 2026-09-09 — MEASURE: named test waivers, printed by the runner

Historical findings record (see CLAUDE.md on `docs/_reports/`). Not maintained; superseded by the
register rows and `data/test-waivers.json` itself.

## Brief

Will, 2026-09-09: *"yes web paused and mag paused all i care about is medicham working."* CLAUDE.md,
"KNOWN FAILURE IS A BANNED PHRASE": a red test is fixed in the session that saw it, or waived by Will
BY NAME, out loud. Nothing recorded such a waiver and nothing printed one. This pass gives the waiver a
file and makes `tests/run-all.js` print it, minimally.

## What landed (no commits — another agent is running the gate chain)

- **`data/test-waivers.json`** — 7 entries. Each carries `path`, `group`, `reason` (the mechanism),
  `waived_by: "Will"`, `date: "2026-09-09"`, `quote`, `lifts_when`.
  - web group (4): `tests/test-site-sync.js`, `tests/test-site-data-fresh.js`,
    `tests/test-web-quarantine-loaders.js`, `tests/test-web-status.js` — lifts when WEB is unpaused
    and `app/` republished.
  - MAG group (3): `tests/test-forced-switch.js`, `tests/test-team-preview-race.js`,
    `tests/test-wiring.js` — lifts when the MAG refit lands after 6.0.0 and
    `data/policy-weights.json` loads under `ABRA_STRICT_SEMANTICS=1`.
- **`tests/run-all.js`** — reads the file once, after `all` is built:
  - a waiver naming a path not in the suite → `ERROR — data/test-waivers.json names N path(s) that
    are not in the suite: …`, exit 1, before anything runs (also fires under `--list`);
  - a waived check that fails → `WAIVED  <path>  — by Will 2026-09-09: <reason>  (exit N, Ns)`,
    pushed to `waived`, NOT to `fail`;
  - a waived check that passes → `ok (waiver no longer needed)  <path> … — remove its entry`;
  - summary → `N passed, N failed, N waived, N skipped`, plus a `WAIVED (red, by Will's name — not
    passed, not counted against the exit code)` block beside SKIPPED and FAILURES;
  - `--list` marks each waived path `[WAIVED by Will 2026-09-09: …]` and prints the count;
  - exit expression is unchanged: `fail.length || coverageFailures`. `waived` is not in it.
  - the exit-2 SKIP branch is untouched — a waived check that cannot run is still a SKIP.
  - **`--only a,b`** added: runs only checks whose path contains a substring, prints `A FILTERED RUN
    IS NOT THE SUITE. The full run is still owed.`, leaves the coverage verdict and exit rule as they
    are. Added so this change could be exercised on a loaded machine without the 45-minute suite.
- `tests/test-lownode.js` — NOT touched. It asserts only its own `LOWNODE: N passed, N failed` line,
  not run-all's summary shape (grep of the file, 2026-09-09).

## The one I refused to waive: `engine/em_validation.js`

The brief's stated MAG mechanism is *"data/policy-weights.json refuses to load under the FEATURE
SEMANTICS check."* `em_validation.js --check` never reaches a weights load — it exits at line 61-91
on the RECORDED verdict in `data/partial-label-em.json`:

```
EM VALIDATION FAILED:
  - the amplified regime's censoring bias did not exceed its own noise floor
```

The artifact (measured `2026-08-26T13:07:19Z`, committed `61f523a7` 2026-08-27, planted from
`data/policy-weights.json (reweighted_to_closed)`) records `censoring_bias 0.7643 < noise_floor 0.8655`,
`bias_exceeds_noise_floor: false`, `em_beats_naive: true`, `em_recovered_fraction 0.931`. Its five
source digests still match the tree — this is not a stale-source red, it is a measured negative
verdict of MEASURE's own Stage C gate, recorded two weeks before the MAG pause was spoken. It is
related to MAG (its re-run plants the refit vector) but it is red for a different reason than the
one the waiver would state, so per the brief it is not waived. It stays FAIL and is MEASURE's. Two
honest routes: re-measure Stage C on the refit vector after 6.0.0 (25-min fit), or Will waives it
under its own reason by name.

## Verification of the seven (the review's §1 A-table, plus what was run here)

- `test-site-sync.js` — review: *Confirmed: red because web is paused, not for another reason.*
  Re-run here under `--only`: exit 1 in 0.1 s, printed WAIVED.
- `test-site-data-fresh.js`, `test-web-quarantine-loaders.js`, `test-web-status.js` — review §1
  attributes each to the paused site bundles; `test-web-status.js` re-run here: exit 1, 12.6 s, WAIVED.
- `test-forced-switch.js` — re-run alone under `ABRA_STRICT_SEMANTICS=1`: throws at
  `engine/magnemite.js:101` with `FEATURE SEMANTICS — policy-weights.json / the fixture itself changed
  (rounding 6 -> 6, scenarios 10 -> 12) … the DAMAGE TABLE these weights were fitted against has been
  regenerated (318 species -> 322, digest 405c836793d1 -> 9d289cf77e24)`. Mechanism confirmed.
  (A first probe calling `makeScoringPlayer()` alone LOADED — `loadWeights` runs in the player
  CONSTRUCTOR at `magnemite.js:324`, not in the factory. The probe was wrong, not the review.)
- `test-team-preview-race.js` — same throw via `ScoringPlayerAI` per the review; same constructor path.
- `test-wiring.js` — every configuration is `mew.js --policy score` (`test-wiring.js:61, :78, :139`),
  and `mew.js:376` is `makeScoringPlayer()`; the constructor throw above is what leaves no capability
  line. Not re-run here (6 games × configurations on a loaded machine); the review also marks it
  *consistent, not proven*. Its `reason` says *re-run the day the weights load*, which is the review's
  own instruction.
- **Correction to the brief's `lifts_when` wording:** `engine/feature_fixture.js --check` exits 0
  TODAY (it certifies the fixture, not the weights against it), so *"passes feature_fixture --check"*
  would name a condition that already holds while the tests are red. The entries say instead:
  loads under `ABRA_STRICT_SEMANTICS=1` (`feature_fixture.verify` of the file's `featureHashes`).

## Proof lines (all under `tools\lownode.cmd`)

`--list` (exit 0): 7 × `RUN   tests/… [WAIVED by Will 2026-09-09: …]` and
`7 waiver(s) in data/test-waivers.json — a red on a waived check is printed WAIVED and does not set the exit code`.

`--only test-counter-init,test-site-sync,test-web-status`:
```
  FAIL  tests/test-counter-init.js  (exit 1, 0.5s)
  WAIVED  tests/test-site-sync.js  — by Will 2026-09-09: web/{stadium,status,tower}.html must be byte-identical to app/, and app/ is not republished while WEB is paused.  (exit 1, 0.1s)
  WAIVED  tests/test-web-status.js  — by Will 2026-09-09: web/status-data.js (board of 2026-08-11) must match the artifacts it is built from, and the board is not rebuilt while WEB is paused.  (exit 1, 12.6s)
  0 passed, 1 failed, 2 waived, 0 skipped
```
`--only test-site-sync,test-forced-switch,test-prng`: `2 passed, 0 failed, 2 waived, 0 skipped`
(`test-prng.js` is GREEN today, 0.3 s — the review's 6/1 red no longer reproduces; not mine, noted).
Both filtered runs exit 1 — on the coverage assertion (`FAIL — UNACCOUNTED-FOR CHECK. 163 file(s)`),
which is unchanged by this pass and was 161 in the review. A run-all exit 0 with waived reds present
cannot be demonstrated until that assertion is green; the exit expression is
`process.exit(fail.length || coverageFailures ? 1 : 0)` and `waived` is not in it.

Planted `tests/test-does-not-exist.js` into the JSON, `--list`:
```
ERROR — data/test-waivers.json names 1 path(s) that are not in the suite: tests/test-does-not-exist.js
  A waiver must name a real check. Fix the path or delete the entry.
```
exit 1; file restored from a copy, 7 entries.

## Proposed (NOT written — those files are owned by other agents right now)

**RUNNING-NOTES row.** *2026-09-09 — MEASURE. Will waived two groups of red tests by name ("yes web
paused and mag paused all i care about is medicham working"). Waivers live in `data/test-waivers.json`
(7 entries: 4 web, 3 MAG); `tests/run-all.js` prints each as `WAIVED <path> — by Will 2026-09-09:
<reason>`, counts `N waived` separately, and keeps them out of the exit code; a waived check that
passes prints `ok (waiver no longer needed)`; a waiver naming a non-existent check is an error.
`engine/em_validation.js` was NOT waived — it is red on the recorded Stage C verdict in
`data/partial-label-em.json` (bias 0.7643 < floor 0.8655, 2026-08-26), not on the weights loader.
Figure: none. Supersedes: nothing. **Basis.** unchanged. Owes: CLAUDE.md "KNOWN FAILURE" section,
one line.*

**CHANGELOG bullet (Added, PATCH).** *`data/test-waivers.json` and waiver printing in
`tests/run-all.js`: a red test waived by Will by name is printed `WAIVED` with his words and the date,
counted separately, and never silently skipped; a stale waiver prints `ok (waiver no longer needed)`;
a waiver naming no real check fails the runner. `--only a,b` added for filtered runs, which the
runner labels as not the suite. `engine/em_validation.js` deliberately not waived (different mechanism).*

**CLAUDE.md, "KNOWN FAILURE IS A BANNED PHRASE", one line to add after the second paragraph:**
*A waiver lives in `data/test-waivers.json` with his words and the date, and `tests/run-all.js` prints
it on every run as `WAIVED` — a waived red is visible state, never a silent skip.*

## OWED, NOT RUN

- The full `tests/run-all.js` — owed to the close pass. Expected on today's tree: the seven print
  WAIVED, `em_validation.js` prints FAIL, the summary carries `7 waived`, and the exit stays 1 on the
  coverage assertion and on the group-B/C reds the review lists.
- `node engine/status.js --write` — not run; it restamps every ledger and other agents hold them.
- `tests/test-wiring.js` — not re-run in this pass; re-run the day the weights load.
