# A LINE ENDING COULD REFUSE A BEFORE/AFTER, AND FIVE CLAUSES WERE STALE FOR A RELEASE CUT

2026-09-08, MEASURE. Tree at `fc191d49` at the start of the pass, nothing else running.
Every heavy run through `cmd.exe /c "tools\lownode.cmd ..."`. Nothing was committed.

---

## 1. THE THIRD CRLF INCIDENT — AND THE FIRST ONE THAT REACHED COMPARABILITY

### What was measured, before anything was changed

Both files named in the brief reproduce exactly:

| file | bytes on disk | raw sha12 | sha12 of the LF form |
|---|---|---|---|
| `data/protocol-events.json` | 35,775 (1,600 CRLF, 0 LF) | `2638eb253525` | **`7c9de3868d6f`** |
| `engine/medicham2-browser.js` | 3,271,371 (43,530 CRLF, 0 LF) | `8bdea30dbb42` | **`9a54ee6881cf`** |

The old digest is the LF form of the same content in both cases. `git status` reports both files
clean, and both index blobs are **pure LF with zero lone CRs** — so nothing was edited and `git`
wrote the CRLF, because `core.autocrlf` is `true` on this machine.

**The brief's third bullet is stale and is corrected here.** It says only
`data/rollout-switch-census.json` carries `eol=lf`. **Eighteen files carry it**, added in commit
`eb24dc31` ("Seventeen files stop being translated"). What was missing was not the mechanism — it
was that the pinned set is the ENGINE's frozen sources and nothing pinned the INSTRUMENT that
measures them.

### The at-risk set, derived rather than chosen

Derived from the code that computes each digest — `engine_release.SOURCES`,
`steering.driverCode`'s static require closure of `engine/game_differential.js`, and the
`driver_inputs` / `alignment_inputs` / census entries read off `data/game-differential.json`
itself. **41 members, 23 of them at risk** (tracked, not binary, no `eol=lf`, no `-text`).

After this pass: **9 at risk, and all 9 are release SOURCES** — `engine/medicham2-browser.js`,
`engine/rollout_leaf.js`, `engine/position_features.js`, `engine/tags.js`, `engine/mc_key.js`,
`engine/set_priors.js`, `engine/smogon_priors.js`, `data/quality-filter.json`,
`data/engine-data.js`. That is exactly the nine the existing `.gitattributes` comment already
names as a filed, separate job, and this pass does not do it: pinning them rewrites them, moves
every release id, and breaks `tests/roster.js`, whose red demonstrations match `\r\n` against the
simulator's source.

### Which route, and why BOTH halves were needed

The brief named two routes. They fix **different populations** and neither is sufficient alone.

**`.gitattributes eol=lf` — the structural half, and it does not reach this machine.** An
attribute pins the bytes a CHECKOUT writes. The index blobs here are already LF, so adding it moves
no byte today and shows nothing in `git status`; it removes the translation that would move them
tomorrow. It cannot help a working tree that ALREADY holds CRLF, which is the state this tree is in
right now.

**The digest at the read — and NOT by touching `sha12`.** `engine/engine_release.js` already argues
at length that the release digest must stay raw bytes: it is an IDENTITY, it decides whether a
measurement may be reused, and 601 release manifests hold raw digests that a normalised function
would strand. That argument is correct and is untouched.

**What it does not cover is that not every digest in this repository is an identity.**
`steering.driver_code`, `steering.input_digest`, `steering.alignment_inputs` and `provenance.js`'s
stamped-input check all answer *did these two runs use the same RULE* — and a carriage return is
not part of a rule. So a SECOND digest was added beside the first:

```
engine_release.sha12Content(abs)   sha256 over EOL-normalised bytes, 12 hex
```

It reuses the `eolNorm` that `classifyChange` already owns, so there is one normaliser, and it
**agrees with `sha12` on every LF file** — which is the whole migration story. A digest recorded
when a file was LF reproduces exactly; only stamps taken while a file was CRLF move, and those are
precisely the wrong ones.

Every producer now records the byte digest beside it (`raw_digest`, `files_raw`,
`input_raw_digest`), so **a byte difference is never hidden — it merely stops being a refusal.**

### The migration, which is the half a new digest function usually gets wrong

Every artifact on disk carries ONE field, `digest`, holding a RAW digest — `data/game-differential.json`
holds `2638eb253525`, taken while this machine's checkout was CRLF. Comparing that against a new
arm's content digest would refuse the pair for exactly the reason this pass removes.

`steering.stampsAgree` therefore uses **share-any-value**: two stamps agree if any recorded digest
of one equals any recorded digest of the other. It cannot launder a real difference — for two
different contents no form of one hashes to any form of the other — and it lets an old raw stamp
and a new pair of stamps meet on the value they share. One rule, used by all four axes.

### SHOWN RED FIRST

`tests/probe_instrument_digest.js` cases 7 and 8. **No digest in it is typed**: both byte forms of
the real `data/protocol-events.json` are written to a temp directory and handed to the REAL
producers, so the RED arm is the pre-fix producer's actual output rather than a reconstruction.
The pair is `data/game-differential.json` cloned twice, so nothing but the alignment stamp differs.

```
=== 7. LINE ENDINGS — the RED arm (pre-fix producer) then the GREEN arm (this pass) ===

    one content, two checkouts:  LF 34175 bytes   CRLF 35775 bytes
    RED  pre-fix producer:  7c9de3868d6f vs 2638eb253525
    as expected  verdict: NOT COMPARABLE
    as expected  and the reason is the ALIGNMENT RULE: true
    as expected  exactly one reason — nothing else differs between the arms: 1
    GREEN this pass:        7c9de3868d6f vs 7c9de3868d6f   (raw 7c9de3868d6f vs 2638eb253525, still recorded)
    as expected  the two checkouts now produce ONE digest: true
    as expected  and the byte difference is still on the record: true
    as expected  verdict: COMPARABLE
    as expected  an OLD raw stamp against a NEW pair of stamps, same checkout: COMPARABLE
    as expected  an OLD raw-CRLF stamp against a NEW run on an LF checkout: NOT COMPARABLE
    CONTROL a row removed from the skip list: acf4e07ee888
    as expected  a real content change is still refused: NOT COMPARABLE

=== 8. THE INSTRUMENT ROLL — content digest and byte digest are BOTH recorded ===

    16 instrument file(s)   digest cafb5cc052c3   raw_digest 3126b1590c91
    9 of 16 differ raw-vs-content right now: engine/board_state.js, engine/effect_kind.js,
      engine/empirical_driver.js, engine/engine_release.js, engine/game_differential.js,
      engine/names.js, engine/set_priors.js, engine/smogon_priors.js, engine/steering.js
    as expected  a pair differing only in the BYTE roll: COMPARABLE
    as expected  a real instrument change is still refused: NOT COMPARABLE
    as expected  and it names the file that moved: true

ALL EXPECTATIONS MET
```

**Two controls, so the clause cannot simply accept everything**: a row removed from the skip list
is still refused, and a moved instrument file is still refused BY NAME.

**AND THE LIMIT IS MEASURED, NOT LEFT TO BE DISCOVERED.** An artifact stamped on a CRLF checkout
against a new run on an LF one shares no value and is **still refused** — the old arm never recorded
what its content digest was, and nothing done today can recover it. That is the same shape as the
pre-2026-09-05 pairs in case 6 of the same file. It closes when both arms are re-taken.

### What moved, measured

- **`provenance.js`: 184 UNSAFE, 2 VOID, 39 possibly stale, 30 ok, 0 missing — identical before and
  after the digest change.** No artifact was being falsely accused via line endings today; the hazard
  is removed and nothing was re-labelled. (It reads **184 / 2 / 35 / 34 / 0** at the end of the pass.
  The four that moved from `possibly stale` to `ok` are the four artifacts the SECTION BELOW re-ran,
  not the digest change.)
- **`driverCodeGuard` no longer voids a run** when git flips a line ending mid-run. That is correct
  rather than lenient: node read the modules at load, and nobody edited a character.
- Green after the change: `tests/probe_instrument_digest.js`, `tests/test-empirical-driver.js`
  (26/26), `tests/test-pin-arms.js`, `tests/test-provenance-discovery.js`, `tests/test-game-diff.js`,
  `tests/test-json-nan-guard.js`, `tests/test-red-run-writes.js`, `tests/test-engine-release.js`
  (80/80), `tests/test-artifact-rerunnable.js` (5/5, and it audits the new export: 98 exports agree
  with `require()`).

### One observation, reported and not fixed

`tests/test-engine-release.js` and `tests/test-artifact-rerunnable.js` **die at exit 134, heap
limit, on node's default old space**, in `REL.compat(...)` — 601 releases × a 3.2 MB
`medicham2-browser.js`. Both pass at `--max-old-space-size=4096`. **This is not caused by this
pass** — neither changed function is reachable from `compat`, and neither test is registered in
`tests/run-all.js`. It is a scale problem that grows one release at a time, and it is the shape
CLAUDE.md already names: *a memory ceiling read as a verdict.* Reported, not fixed, not registered.

---

## 2. THE FIVE CLAUSES THE RELEASE CUT STALED — RE-RUN

All five read `MEASURED AGAINST A DIFFERENT ENGINE` because release `1415f271058e` was cut and the
artifacts named `f0f10cd06861`. Every command was read off `engine/status.js`, not reconstructed.
Release id read from `data/engine-release.json`.

| clause | expected | measured on `1415f271058e` | |
|---|---|---|---|
| game differential (`data/engine-diff.json`) | 0 of 6000 | **6000 compared, 6000 agreed, 0 disagreed** | as expected |
| roster / items | 140 of 148, 0 DIFFER, 0 DID-NOT-FIRE | **140 of 148, DIFFER 0, DID-NOT-FIRE 0**, COULD-NOT-STAGE 8 | as expected |
| roster / abilities | 139 of 202, 0 DIFFER, 0 DID-NOT-FIRE | **139 of 202, DIFFER 0, DID-NOT-FIRE 0**, CONTROL-NOT-QUIET 14, COULD-NOT-STAGE 158, DEFERRED 5 | as expected — **139, not 146** |
| roster / moves | 487 of 500, 0 DIFFER, 0 DID-NOT-FIRE | **487 of 500, DIFFER 0, DID-NOT-FIRE 0**, COULD-NOT-STAGE 10, DEFERRED 3 | as expected |
| mechanics (`data/all-mechanics-fire.json`) | — | moves 500 tried / 495 resolved / **4 diverged** / 11 resolution disagreements; abilities 316 tried / 104 fired / **1 diverged**; items 148 / 64 / **0 diverged** | **every count identical to the pre-cut artifact** |

**The mechanics artifact is the strongest reading of the five.** Compared field-by-field against
`git show HEAD:data/all-mechanics-fire.json`, every summary count reproduces exactly and the only
thing that moved is the release stamp `f0f10cd06861` → `1415f271058e`. A release cut with no
engine change should reproduce a measurement exactly, and it did.

**Census: 830 rows, generated 2026-09-08T16:22:09Z, UNCHANGED.** `tests/test-mechanics.js` was NOT
re-run — the gate did not name it among the five, and re-running it would move the file that steers
the differential. 830/830 stands as taken.

**Board-material was NOT touched.** It reads `PASS — 0 of 958` and no whole-game differential was
run in this pass, so `data/game-differential.json` is exactly the artifact that produced it.

### Two side effects, reported

- `data/engine-release.json` gained a 12th cut event on the SAME id `1415f271058e`, written by
  `tests/test-game-diff.js` during the control run. The id did not move, so nothing is invalidated.
- `data/game-diff.json` was rewritten by `tests/test-game-diff.js`, which is what that test does.

---

## 3. `docs/ENGINE.md` ON THE ABILITY COUNT

**The brief's premise is confirmed by measurement.** `docs/ENGINE.md` contains exactly **one**
`<!-- GENERATED -->` block and it holds **neither 146 nor 139**. The roster counts are hand-authored
prose wherever they appear, so the restamp that was asked for was never available to anybody — which
is itself the thing that needed correcting.

**Corrected:**

- **`:354`** — *"the abilities count is stamped into `<!-- GENERATED -->` blocks and still reads 146
  there."* False on both clauses. Struck, with the measurement that refutes it and a note that a
  hand-authored figure can only be corrected by hand.
- **`:522`** — the `f0f10cd06861` re-run table's `146 of 202`. Struck in place and superseded with
  **139 of 202**, with the reason stated: the 146 was true of that run, and twelve of those greens
  rested on the ability-swap control describing its own name. The original figure is left visible;
  a dated measurement is evidence.

**NOT corrected, deliberately: `:16998`.** It reads **`129 of 202`**, not 146. It belongs to a
**2026-08-26** section reporting release `7fc604e5bc44`, where 129 was the truth. Rewriting it would
falsify a dated measurement, which this repository's own rule forbids. Reported, left standing.

---

## WHAT IS OWED

- **The nine SOURCES are still translatable**, and that is the filed larger job. The comparability
  axes are closed for them; the release ID is not, and it must not be closed by normalising `sha12`.
- **Cross-checkout legacy pairs stay refused.** An artifact stamped raw-CRLF against a new run on an
  LF checkout cannot be shown the same. Re-take both arms.
- `tests/test-engine-release.js` and `tests/test-artifact-rerunnable.js` need
  `--max-old-space-size=4096` on this tree. Neither is a registered gate.
