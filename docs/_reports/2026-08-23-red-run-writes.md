# Red-run writes — `tests/test-unmodelled-clicks.js`

2026-08-23, MEASURE. Historical findings record; not current state, not maintained.

## Verdict

The premise held, and it **understates the defect**. The relayed claim was "a red run publishes a
plausible-looking artifact for a downstream reader". True, but the important consumer of
`data/unmodelled-clicks.json` is **the test itself** — it is the ratchet's own baseline. So a failing
run wrote the GROWN set as the new baseline, and the regression it had just caught became the accepted
state. **The ratchet erased its own finding in exactly one re-run.**

## Measured, before the fix

Deliberate break: removed `healbell` from the baseline on disk so the live set appeared to have grown.
Nothing else changed between the two runs.

| run | result | exit | artifact |
|---|---|---|---|
| 1 | `FAIL the set did not GROW ... NEW: healbell` | 1 | **rewritten, including `healbell`** |
| 2 | `ok the set did not GROW ... 3 -> 3` | 0 | rewritten |

Run 2 is green. `healbell` is accepted forever. The natural human response to a red test — run it again —
is precisely what destroys the evidence.

## Measured, after the fix

Same break, same procedure:

| run | result | exit | artifact |
|---|---|---|---|
| 1 | `FAIL ... NEW: healbell` + `DID NOT WRITE ... this run FAILED` | 1 | untouched (md5 identical) |
| 2 | `FAIL ... NEW: healbell` | 1 | untouched |
| `--accept` | writes, records `accepted_from_red_run: true` | **still 1** | rebaselined, loudly |
| green, set unmoved | `unchanged — the set did not move` | 0 | not rewritten |

## What changed

`tests/test-unmodelled-clicks.js` only. The write is now **green-only**, and additionally **only when
the set actually moved**.

- **Never on red.** No `void: true` half-measure. `provenance.js` does honour a self-declared void, but
  that hook is for a run invalidated by something *else* that still must publish. A failing check has no
  such obligation — it can simply not write, and then no consumer needs to know how to refuse it.
  Writing `void: true` on every red run would also trip provenance's **void ratchet** (a NEW void fails),
  failing a second gate to paper over this one.
- **Not when nothing moved.** A green run that found nothing used to rewrite `generated` and dirty the
  tree. Three commits today (`086dd25`, `4383241`, `483f529`) were cleanups after that same churn in the
  neighbouring docs gate.
- **`--accept`** re-baselines deliberately, prints what it is accepting, and still exits 1. Same idiom as
  `test-rulebook-collision.js --update`. What no longer exists is a path where a regression enters the
  baseline because nobody typed anything.

Green-only + monotone is the property `.githooks/pre-commit` already relies on to stage a moved ratchet
safely, so this file now satisfies that contract instead of contradicting it.

The fix is **a property (a check writes nothing unless it passed), not a list**. No move ids, no
artifact names, no known-bad list — a new offender or a check added later inherits it.

Nothing the test *checks* was weakened. The measured set is byte-identical: `count 3`, `clicks 44`,
`moves [roleplay, reflecttype, healbell]`. Only `generated` moved and `write_policy` was added.

## The enumeration I was handed was wrong

"Of `tests/test-*.js` ... this one is the outlier" — **false**. Verified read-only (not run: running them
rewrites artifacts while other agents are live).

**Same defect, self-baselining ratchet — the severe class:**

- `tests/test-tag-consumed.js` — reads its own stamp as `prev` (line 257), writes unconditionally
  (line 304), exits `F ? 1 : 0` (line 326). A tag that LOST a consumer is red via
  `prevStatus[t] !== 'DEAD'`; the run then writes `by_tag` with that tag as `DEAD`, so the next run
  labels it `STILL DEAD` and the `regressed` check passes. **Partial laundering** — the file stays red on
  the separate `outside the ratchet floor` check (the floor only shrinks), but the *diagnosis* degrades
  from `REGRESSED (was LIVE)` to `STILL DEAD`, losing the fact that a consumer was lost.

**Writes on red but does not self-baseline — the milder class:**

- `tests/test-forme-assert.js` — writes 464, `process.exit(1)` at 471.
- `tests/test-switch-back-renamed.js` — writes 235, `process.exit(1)` at 241.
- `tests/test-game-diff.js` — writes 814, `exitCode = 1` at 822. Nastiest of the three: that red means
  the **comparator failed its own planted-divergence proof**, i.e. the instrument is lying, and it
  publishes `data/game-diff.json` anyway.
- `tests/test-mechanics.js` — writes the census then exits 1 for HOLLOW. ENGINE owns it. It already
  refuses to write under the `residualCollapsed` deliberate break, and its comment says *"any future
  switch of the same kind belongs here"* — the right instinct, scoped to deliberate breaks rather than to
  failure generally.

**Good precedent, already correct:** `tests/test-rulebook-collision.js` exits 1 *before* its write.

Hook-gate claim verified as relayed: `test-roadmap-register.js` has zero writes,
`test-artifact-rerunnable.js` writes only under `--stamp`.

## Consumers that could not tell a red artifact from a green one

The artifact carried **no run-status field at all** before this change — no `red`, no `void`, no `ok`.

1. **`tests/test-unmodelled-clicks.js` itself** — the baseline consumer, and the one that mattered.
2. **`engine/provenance.js`** — sweeps every `data/*.json` (line 446). A red-run write with a fresh
   timestamp read as a good current artifact. It honours `void: true`; the file never set it.
3. **`web/quarantine-data.js`** (line 350) — lists the artifact on the web surface.

`status.js` and `open_work.js` do not read it.

## OWED, NOT RUN

- `tests/test-tag-consumed.js`, `test-forme-assert.js`, `test-switch-back-renamed.js`,
  `test-game-diff.js` — same class, **not mine, not fixed, not run.** `test-tag-consumed.js` is the one
  worth doing next; it is the only other self-baselining ratchet.
- No general gate asserting "a red run writes nothing" exists. Four instruments already contain a
  write-detecting regex (`test-rollout-gates.js` line 58, `test-site-data-fresh.js` line 81,
  `test-publish-guard.js` line 147, `test-register-reality-readonly.js`), so the machinery to ratchet this
  as a property is present and unbuilt.
- No CHANGELOG entry written — the dispatching agent owns that file tonight.
- Not committed. Not run: `roster.js`, `game_differential.js`, `test-engine-diff.js`,
  `all_mechanics_fire.js`, `test-mechanics.js`, `quarantine.js`, `status.js --write`. No games played.
