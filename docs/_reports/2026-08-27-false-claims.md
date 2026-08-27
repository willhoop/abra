# The eight false comment claims — six corrected, two filed. 2026-08-27 (MEASURE)

Historical findings record. Not current state, not maintained, superseded by the register row it
feeds (`#480`). See the `docs/_reports/` policy in CLAUDE.md.

## VERDICT

**Six corrected, two filed to ENGINE. The oldest stood 34 days; the worst stood 32.** The comment
census in `tests/test-claim-truth.js` now reports **2 false of 2,822** references, down from 8 of
2,805. The records half is unchanged at **280 claims / 252 checkable / 0 false**, exit 0.

**The checkable proportion did not change and the check was not weakened.** No predicate, window or
regex was touched — the only edit to `tests/test-claim-truth.js` is its header comment, which cited
two of the claims this pass corrected and would otherwise have gone stale itself. `--break` still
goes RED on the real retracted `derive_protocol_events` sentence through the same extractor.
`commentRefs` rose 2,805 → 2,822 **because the corrections name files**: a bigger denominator, not
better coverage, and it is stated here rather than quietly banked.

**No engine byte moved and no game was played.** Predicted before the pass, true after it.

---

## 1. EVERY ACCUSATION WAS VERIFIED BEFORE IT WAS ACTED ON

The brief's standing warning — a regex trap in the same audit turned 31 real missing paths into 186
reported ones — applies to this pass too. So each of the eight names was checked twice:

```
fs.existsSync(<path>)            -> ABSENT, all eight
git log --all --oneline -- <p>   -> 0 commits, all eight
```

**All eight paths have zero commits in this repository's entire history.** Not one is a file that was
deleted; every one is a file that was never written. That distinction decides the correction: a
deleted file's sentence gets a retraction, a never-written file's sentence was wrong the day it was
typed.

## 2. THE SIX CORRECTED

Each was repointed at what is actually true. Where no true version exists, the claim is retracted and
the absence is stated — nothing was invented to keep a sentence alive.

### `build/build_mag_data.js` — 32 days (`4a7c82f1`, 2026-07-26). The worst.

> *"web/magnemite.html carries a self-check against a fixture generated here: if the browser's
> scoring and the engine's scoring ever disagree on the fixture, the page says so on screen rather
> than quietly showing wrong numbers."*

A reader asking whether the engine/browser drift is covered was told **yes**, and pointed at nothing.

**The mechanism is real.** The MAGNEMITE room is `roomMagnemite()` in `web/index.html`, and the check
is `magSelfCheck()` in the same file, fed by the `fixture()` this build script generates. On a
mismatch it renders `SELF-CHECK FAILED — data/mag.js and engine/board.js disagree by up to …` above
the numbers.

**IT WAS WRONG TWICE AND ONLY ONE HALF WAS DETECTABLE.** The same block said the page *"re-implements
`featuresFor` over that data"*, which is what made a self-check necessary in its own telling. That
stopped being true: `magScore()` loads `engine/board.js` live through `MAGENG_FILES` and calls
`B.featuresFor` directly, and the room's own comment says so — *"There is no copy any more."* What
the check detects today is a **bundle-vs-engine vintage mismatch**: `data/mag.js` carries weights and
a fixture scored at build time, `board.js` is fetched live, and a stale bundle beside a newer engine
is the original drift in a new costume.

**Nothing in this repository can see that second half.** Mechanism prose is explicitly UNCHECKABLE —
the instrument's own header says so — and this sentence was caught only because the wrong mechanism
happened to be attached to a filename. Both halves are corrected; only one was findable.

### `engine/prior_player.js` — 34 days (`e5d5d05d`, 2026-07-24). The oldest.

> *"The matching comparison therefore runs OUR engine with those heuristics DISABLED … See
> tests/test-policy-parity.js."*

**The switch is real and the comparison is not.** `setPurePriors()` in `engine/medicham2-browser.js`
disables the KO / Protect / Wide Guard heuristics for exactly this purpose and documents itself in
the same terms. **Nothing in `engine/`, `tests/` or `build/` calls it** — grep for `setPurePriors` or
`PURE_PRIORS` outside that file returns nothing. So the like-for-like run this paragraph describes
has never been made, and the paragraph is now marked as the DESIGN of a comparison that is owed.

### `engine/lookup.js` — 25 days. **No true version; retracted.**

> *"tests/test-lookup-contract.js reads this, and any long run can print it to find out what it is
> tolerating."*

`misses()` is exported and **nothing calls it** — not a test, not a runner, not a long run. The
claim has no true form, so it is deleted and replaced by the fact: a diagnostic with no reader, which
is a weaker thing than the sentence claimed.

**The age was reported as 21 days and it is 25.** First written 2026-08-02 (`ebe91bfa`), removed at
19:25 on 2026-08-06 when the file was overwritten (`eb500a1c`), restored with the file 42 minutes
later (`21edc99a`). Yesterday's row measured from the restore. Corrected in `#480`.

### `engine/million_run.js` — 16 days (`0067c4e8`, 2026-08-11). It pointed away from a guard that was there.

> *"engine/status_residual.js asserts it and refuses to report otherwise."*

**The guard exists, in this same file.** The `if (DUMP_STATUS)` block at the end of the free arm sums
the dumped rows by key against that key's `n` and `k`, and on any mismatch prints `REFUSING TO WRITE
THE STATUS DUMP` and exits 1. It has been red once for real, on the six leaked scald trials. This was
the one case where the first draft of the correction was itself wrong — the retraction was written to
say *"nothing asserts that identity today"* before the file was read to the end. Caught and fixed
before commit; recorded here because "verify the accusation" applies to the correction too.

### `engine/speed_vs_pokeenv.js` — 16 days. **The only one that misled at RUN TIME.**

Three sites, not one:

| where | what it said |
|---|---|
| header comment | *"Arm A lives in `engine/bench_pokeenv.py` … It writes the same shape."* |
| `console.log` on every run | *"arm A (poke-env) is Python — run engine/bench_pokeenv.py, it merges into the same artifact"* |
| `data/speed-vs-pokeenv.json` `what` field | *"Simulation cost, three arms … Arm A (poke-env) is written by engine/bench_pokeenv.py and merged in."* |

The file's own STATE section already said *"ARM A … the Python side is unwritten"* about 1,000
characters further down — outside the census's 200-character negation window, correctly, because a
declaration that far from the claim does not reach a reader who stops at the claim.

All three now say arm A did not run. **The artifact field matters most**: it asserted a three-arm
benchmark beside an `arms` array holding two, and an artifact outlives the comment that produced it.

### `engine/quarantine.js` — 13 days (`f545e35c`, 2026-08-14). One word.

`web/scoreboard.js` where `data/scoreboard.js` was meant — the bundle that file's own withheld-set
clause names. A slip, and still a pointer at a file that does not exist.

## 3. THE TWO FILED, NOT TOUCHED

Both sit in ENGINE-owned files and were left alone. Each is recorded in `#480` with the file its
sentence should name, so the fix is a repoint and not a research task:

| file | age | names | what is really there |
|---|---|---|---|
| `engine/medicham2-browser.js` | **34 d** | `tests/test-engine-contract.js` | `tests/test-engine-consistency.js` — the file CLAUDE.md names as the one that asserts the FACTS agree across engines |
| `engine/game_differential.js` | 15 d | `tests/rate_runner.js` | `engine/million_run.js` — the instrument that derives its trials from statistical power (`--detect`, per-row required-N), which is exactly the property the sentence contrasts itself against |

The second is a suggestion with evidence, not a verdict: ENGINE owns the sentence and may know of
another intent. **Do not repoint it on this report's say-so without reading the paragraph.**

## 4. A COMMENT-ONLY EDIT IS NOT A FREE EDIT

`engine/lookup.js` and `engine/quarantine.js` are stamped by content in artifacts, and
`engine/provenance.js` compares CONTENT — it cannot know a diff is cosmetic.

- **`data/quarantine-stamp.json` went UNSAFE immediately**: *"COMPUTED FROM DIFFERENT CONTENT —
  engine/quarantine.js was 34ef3b4177c0 at read time, is ae573406caa0 now."* Repaired by re-running
  `node engine/quarantine.js --check` (the stamp is written only under `--check`; a plain run exits 0,
  prints 27 KB and leaves the stamp untouched — read the output, not the exit code). The gate reported
  clean and the citation ratchet held at 3 sites.
- **The ~40 artifacts stamping `engine/lookup.js` were unaffected.** They pin a frozen release, and
  provenance reads them exactly as designed: *"pinned to engine release 978ca8fe72c9 —
  engine/lookup.js matches the frozen copy; live is 17f49e5aed43 now (a PRE-CHANGE measurement of
  that release, not corruption)."*
- After the restamp, **no artifact is content-unsafe from any of the six files**, and content-verified
  artifacts are back to 3.

`data/provenance-stamp.json` was rewritten by these provenance runs. It had already been modified in
the working tree by another agent's earlier run; that agent's on-disk version was overwritten by
mine. The differences are the `mtime_only` discovery of `engine-data-purity.json` and the `void_files`
addition of `medicham-bench.json`, neither of which is this pass's work.

## 5. WHAT STILL WALKS PAST THE CHECK

Unchanged from yesterday, restated because the coverage figure should never be quoted without it:

1. **Free prose** — the large majority of comment text. One claim class of one is decidable.
2. **Quoted text** is stripped by construction, so a false claim inside quotation marks passes. Every
   retraction written this pass quotes the sentence it retracts, which is exactly why that hole has
   to exist.
3. **Dated measurements** and **mechanism prose** are counted UNCHECKABLE and named, never counted as
   true. The `build_mag_data.js` mechanism error above is a live example of what that costs.
4. **46% of record entries** (80 of 175) yield a checkable claim.
5. The comment census is **reported, not gated** — two of its names are in files this division cannot
   land a fix in, and a red nobody can clear becomes the banned "known failure".

## OWED, NOT RUN

- **The two ENGINE-owned sentences.** `engine/game_differential.js` → `tests/rate_runner.js` and
  `engine/medicham2-browser.js` → `tests/test-engine-contract.js`. Open in `#480`.
- **Nothing checks the MECHANISM half of a claim.** The 32-day sentence was wrong about what the page
  does as well as about where it lives, and only the filename half was findable. No instrument
  proposed; naming it is not fixing it.
- **`node engine/status.js --write`.** Not run — this pass was not permitted to. The generated blocks
  in the division ledgers are therefore one pass behind.
- **`tests/run-all.js` in full.** Not run. What ran: `tests/test-claim-truth.js` (exit 0),
  `tests/test-claim-truth.js --break` (BREAK OK), `tests/test-roadmap-register.js` (3 passed),
  `node --check` on all seven edited files, `engine/quarantine.js --check`, `engine/provenance.js`.
- **`engine/million_run.js --dump-status` has never been re-run since its guard was mislabelled.** The
  guard was always there, so nothing is retroactively suspect; this is a note that the correction
  changed a comment and not a number.
