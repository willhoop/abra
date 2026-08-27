# The middle arm's die was translating, not re-drawing — FNV-1a gains a finaliser

ENGINE, 2026-08-27. ROADMAP `#489`. Will ruled this directly, over two alternatives, knowing it
re-baselines the differential.

---

## THE HEADLINE

| quantity | before | after |
|---|---|---|
| **whole-game, counted** | **3** of 961 (8 raw, less 5 declared) | **14** of 961 (19 raw, less 5 declared) |
| **board-material** | **1** of 961 (961 − 960) | **12** of 961 (961 − 949) |
| **pin digest** | `2efbc9ed1946` | **`f646b0163bc0`** — it moved, deliberately |
| engine release | `01be9daf14ee` | `f9d6be635d34` |
| artifact stamp | `2026-08-27T13:26:24Z` | `2026-08-27T14:07:26Z` |

Both figures read out of `data/game-differential.json`, never off stdout.

**THE NUMBERS ROSE AND THAT IS THE INSTRUMENT SEEING WHAT IT WAS BLIND TO.** It was predicted before
the run (below), it was not tuned for, and the direction was the predicted one. The magnitude on
board-material was **outside my stated band** and that is recorded rather than smoothed.

**THE PIN DIGEST MOVING IS THE SECOND HALF OF THE FIX, AND IT IS ALREADY DOING ITS JOB.** The gate
now says, unprompted:

> DIRECTION OF TRAVEL WITHHELD — the baseline was stamped under `A/middle/pins:2efbc9ed1946/…` and
> this run is `A/middle/pins:f646b0163bc0/…`. One pin is one corner: those are two instruments, and
> subtracting one rate from the other invents a trend.

That refusal did not exist an hour ago. Without it `engine/arms_comparable.js` would have tabled a
pre-fix run against a post-fix one as comparable, and 3 → 14 would have been published as a
regression in the engine rather than a reset of the ruler.

**I DID NOT WAIT FOR THE SLOT.** `data/game-differential.json` was last written at 09:26:24 and was
still unchanged at 10:01:19 — 35 minutes stable — and I re-checked immediately before starting. No
other differential ran beside mine. **A different collision did occur and is reported at the foot.**

---


> **CORRECTION, SAME DAY, AND IT STRENGTHENS THE RESULT.** The artifact committed in this pass is
> **not the one my own run wrote.** The concurrent agent re-ran `game_differential.js` at 14:16:31Z
> and again at 14:24:49Z against THEIR release `f9f3a61481cb` — my die fix **plus** their doll-blind
> family — and it overwrote `data/game-differential.json` while I was staging. **I staged a file
> another process had just rewritten, which is the torn-read hazard CLAUDE.md names, and it is
> reported rather than quietly corrected.**
>
> It is not a contradiction, because the two runs agree exactly: **961 games, 19 raw, 12
> board-material, pin digest `f646b0163bc0`**, on two different releases. That is an independent
> corroboration I did not plan and could not have arranged — the doll-blind family moved neither
> number, so the whole of 3 -> 14 and 1 -> 12 is the die. My measurement was taken on
> `f9d6be635d34`; the committed artifact is stamped `f9f3a61481cb`. **Read the stamp, not this
> paragraph.**
>
> The three roster stages were likewise re-run on `f9f3a61481cb` at 14:25 with **verdict
> distributions identical to mine**, so the withholding noted below is already resolving. The
> `OWED` item stands as written — it belongs to that batch, not this one.


## THE DEFECT

`engine/medicham2-browser.js` `midEventHash` and `engine/game_differential.js` `midHash` were bare
FNV-1a. The loop's last round is

```js
h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
```

with **nothing after it**. So changing only the final character of the address does not diffuse the
word — it TRANSLATES it:

```
v(nth=d) − v(nth=0)  =  ((A XOR c_d) − (A XOR c_0)) · 16777619  mod 2^32  / 2^32
```

and the final field of every address in this arm is `nth`, the repeat index. For a **one-digit**
index `c_d` and `c_0` differ in the low four bits only, bounding the entire shift at
15 · 16777619 / 2^32 = 0.0586. Two-digit indices mix fine, which is why nothing caught it: the
failure lives in the small-`nth` population, which is nearly all of it.

### Measured, both hashes, 2,000–5,000 synthetic addresses of the real shape

| quantity | bare FNV-1a | + fmix32 | independent |
|---|---|---|---|
| max circular shift, v(nth=d) vs v(nth=0) | **0.0351571** | 0.4999829 | ~0.5 |
| mean circular shift | **0.01607** | 0.25091 | 0.25 |
| consecutive arrivals sharing a 16-bucket damage index | **89.5%** | 6.2% | 6.25% |
| distinct damage indices from a ten-hit address | **1.75** | 7.60 | 7.56 |
| two same-turn residual ½ coins landing the same way | **99.1%** | 48.5% | 50% |
| lag-1 autocorrelation on `'acc|'+i` | **0.8873** | −0.0024 | ~0 |
| runs above/below 0.9 on that sweep | **91** | 901 | ~901 |
| marginal hit rate on that sweep | 0.9214 | 0.8992 | 0.9 |

`0.0351571` reproduces the figure MEASURE derived over 2,400 real addresses, from an independently
written probe. The last row is the point of the whole table: **the marginal was always fine.** A die
can be uniform in aggregate and almost perfectly predictable one step at a time, and only the
conditional structure can tell you.

**THE HEADLINE IS DAMAGE.** `_R.dmg()` is floored into sixteen buckets, and a translation smaller
than a bucket cannot leave the bucket. A ten-hit move drew 1.75 distinct indices where it should draw
7.56. Every residual coin is the same story from the other end: `midClearActiveMove` collapses those
addresses to `seed|turn|any|-|-`, so two same-turn residual coins were the same coin.

---

## THE FIX — FOUR THINGS, ONE COMMIT

### 1. The hash, mixed properly, in both engines byte-identically

`fmix32` — murmur3's finalisation step — appended to the FNV-1a loop:

```js
h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x85ebca6b) >>> 0;
h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0;
h = (h ^ (h >>> 16)) >>> 0;
```

**A FINALISER, NOT A RESHUFFLED STRING, AND THE CHOICE IS LOAD-BEARING.** Mixing `nth` in somewhere
other than the tail would fix `nth` and leave every other trailing character — the target slot's
digit, a move id's last letter — exactly as weak. `fmix32` diffuses the whole word once at the end,
so no field of the address is privileged by its position.

The two bodies are **asserted** byte-identical, not assumed:

```
$ node -e "…extract both function bodies, compare…"
BYTE-IDENTICAL
```

CLAUDE.md's rule is one implementation of a fact, never two that agree today. There is a **third**
copy — hand-written from the constants inside `tests/test-middle-identity.js` — which is the only
thing that can catch one of the two drifting, and it was updated in the same pass and asserts 0 of
2,000 disagreements.

**No string changed, so no address changed.** The arm's identity claim is about strings and is
untouched by construction; the VALUES at those addresses are what moved.

### 2. `DICE_MODEL` into `PIN_DIGEST`

`engine/game_differential.js:1577` now digests `dice: DICE_MODEL`, and the model string is bumped
`split/v1` → `split/v2`. The comment that said *"`dice` is DELIBERATELY NOT IN THE DIGEST … Had the
split been kept, this line would have to include it"* is replaced by the reason it no longer holds,
rather than deleted.

The version number is inside the digested string on purpose: editing the description without moving
`v1 → v2` would leave the digest tracking a sentence rather than a behaviour.

### 3. Two vacuous assertions in `tests/test-middle-identity.js`, replaced

**`:89` asserted DIFFERENCE where it meant INDEPENDENCE.** `midEventValue(…|0) !== midEventValue(…|1)`
is true when the two differ by 1/256, which is exactly what they did. It is kept as a floor and joined
by the quantity: max circular shift > 0.40 and mean within 0.03 of 0.25, plus the consequence —
ten arrivals at one damage address must land in more than 7.0 distinct buckets of sixteen.

**`:97` swept the failing axis and measured the marginal.** `'acc|' + i` varies the trailing digit,
which is precisely what the un-finalised hash could not mix, so the sweep walked a near-arithmetic
sequence and averaged it to 0.9214. The hit rate is kept and joined by lag-1 autocorrelation
(|ρ| < 0.05) and a Wald-Wolfowitz runs test at 4σ.

**SHOWN RED, THEN GREEN.**

```
release 01be9daf14ee (pre-fix)          release f9d6be635d34 (post-fix)
FAIL  … INDEPENDENT value, not a translation      ok  max shift 0.4999829, mean 0.25091
        max shift 0.0351571, mean 0.01607
FAIL  … ten arrivals … independently-drawn        ok  7.60 distinct indices
        1.75 distinct indices
FAIL  … consecutive draws … uncorrelated          ok  rho = -0.0024
        rho = 0.8873
FAIL  … CLUSTERS no more than chance              ok  901 runs, expected 901 +/- 51
        91 runs, expected 901 +/- 51
RED — 4 claim(s) failed          exit 1           GREEN — every claim held        exit 0
```

### 4. Re-baselined

`data/game-differential.json` and `data/divergence-turns.json`, both on release `f9d6be635d34`,
arm `middle`, `--games 1200` (yields 961), cap 12, `--team-store data/team-pool-frozen`, census pin
`9446a684709d`, `--state --end-state`. **Run twice** — once without the dump and once with it — and
the two agreed exactly (961 / 19 raw / 12 board-material / digest `f646b0163bc0`), so the corrected
die is deterministic.

---

## THE PREDICTION, WRITTEN BEFORE THE RUN

Pinned to `scratchpad/PREDICTION.txt` at 09:58 EDT, before a single game was played.

| # | predicted | outcome |
|---|---|---|
| 1 | pin digest moves off `2efbc9ed1946` | **HELD** — `f646b0163bc0` |
| 2 | `test-engine-diff` stays 0/6000 at all sixteen corners | **HELD** — 0/6000 at every corner, 134 multi-hit not comparable |
| 3 | census unmoved by me — no mechanic byte changed | **HELD** (see the collision note; it moved under another agent) |
| 4 | three roster stages unmoved | **HELD** — verdict distributions byte-identical |
| 5 | identity rates stay above their floors, with a point or two of wobble | **HELD, and they IMPROVED** |
| 6 | whole-game counted 3 → **3..15**; board-material 1 → **1..8** | whole-game **14 — inside**. board-material **12 — OUTSIDE, ABOVE** |
| 7 | nothing tuned to keep the numbers low | held — the fix was written before any game was played and not touched after |

**I WAS WRONG ABOUT THE SIZE ON BOARD-MATERIAL AND THE BAND IS PUBLISHED AS I WROTE IT.** 12 against
a predicted ceiling of 8. The under-estimate is instructive: I priced the die as re-sampling the
games that already diverged, and it does more than that — `board_parted_before_the_protocol_did` went
**0 → 5**, five games whose boards now part with no protocol line ever disagreeing. Those are boards
the old die could not reach at all, not re-rolls of boards it could.

---

## WHAT THE CORRECTED DIE FOUND

Raw 8 → 19. Declared 5 → 5 (all Supreme Overlord `fallenundefined`, unchanged and still not mine).

| class | before | after |
|---|---|---|
| event missing from medicham2 | 5 (all `fallenundefined`) | 9 |
| ordering (`-sideend` tailwind) | 2 | 2 |
| `-damage`: a different body | 1 | 1 |
| unrelated event mismatch | — | 3 |
| extra event emitted by medicham2 | — | 2 |
| `-boost field 3` | — | 1 |
| `-damage field 3` | — | 1 |

Severity, off the gate: `emission 7, rule 7, ordering 3, field 2`. End-state split:
`BOARD_MATERIAL 6 causes / 7 games`, `NARRATION_ONLY 11 causes / 12 games`, `UNKNOWN 0`.
`by_cause_reconciles: true`.

The two Tailwind rows survived unchanged, as expected — they are a genuine `speedSort` tie and are
**not mine**; that batch is next and it depends on this die.

**THE INSTRUMENT ALSO GOT SHARPER AT NAMING EVENTS**, which is a second-order effect of the same fix
(different dice → different games → different draws):

| | before | after |
|---|---|---|
| of medicham2's events, the authority also asked | 44.4% | **54.0%** |
| of the authority's events, medicham2 also asked | 72.8% | **78.0%** |
| `acc` identity | 99.5% | **99.8%** |
| `sec` identity | 98.2% | **99.1%** |
| `dmg` / `crit` identity | 99.4 / 99.2% | 99.4 / 99.2% |

---

## ATTRIBUTION — CHECKED, NOT ASSUMED

`data/releases/01be9daf14ee` vs `data/releases/f9d6be635d34`: **exactly one SOURCES file differs**,
`engine/medicham2-browser.js`, and the only executable difference between the two frozen copies is
the three finaliser lines. Nothing else is in that delta. So 3 → 14 and 1 → 12 are the die and
nothing else.

## SCOPE — CONFIRMED, ONE NON-TEST CALLER

`midEventDice` has exactly one non-test caller, `engine/game_differential.js:1219`. Re-verified by a
repository-wide grep excluding `data/releases/`. The other four callers are
`tests/test-middle-identity.js`, `tests/test-middle-draw-scope.js`,
`tests/probe_random_target_address.js` and `tests/probe_spread_secondary_address.js`. No refit, no
leaf calibration, no weights, no rollout, no census, no roster reads this die.

**`tests/probe_random_target_address.js` reads `midEventValue` directly and its printed numbers will
have moved.** It is a probe, not a gate, it is the random-target row, and that row is Will's to
re-ask after this lands. Flagged, not touched.

---

## THE COLLISION — REPORTED, NOT PAPERED OVER

**Another agent was writing `engine/medicham2-browser.js` and the census throughout this batch.**

| when | what |
|---|---|
| 09:58:34 | a release was cut over a tree that already carried my fix — the id my own cut then matched |
| 10:00:56 | `engine/medicham2-browser.js` written by that agent (identical bytes; my cut still matched) |
| 10:08:38 | `data/mechanics-census.json` regenerated **757 → 764 live**, seven new *"a substitute refuses …"* rows — the doll-blind family, **not mine** |
| 10:09:27 | release **`f9f3a61481cb`** cut, *"doll-blind family: seven kinds that never asked the substitute"* — one SOURCES file moved, `engine/medicham2-browser.js` |

**MY MEASUREMENTS ARE INTACT AND HERE IS WHY, RATHER THAN AN ASSERTION THAT THEY ARE.** Both
differential runs finished at 10:04:08 and 10:07:26, **before** the census moved; both were pinned to
`--census data/verification/census-pin-9446a684709d.json`, so the live census never steered them; and
every run read the frozen release, not the tree. `data/game-differential.json` carries my stamp alone.

**MY FIX SURVIVED THEIR EDIT.** Verified: the two hash bodies are byte-identical in the live tree,
in `f9d6be635d34`, and in their `f9f3a61481cb`.

**THE CONSEQUENCE IS REAL AND IT IS OWED, NOT HIDDEN.** The tree is now `f9f3a61481cb` while my
artifacts are stamped `f9d6be635d34`, so `engine/quarantine.js` correctly **WITHHOLDS** the three
roster clauses and the mechanics clause as *"measured against a different engine."* I did **not**
re-run against their release: they may still be writing, and measuring bytes mid-flight is the exact
hazard the release mechanism exists to prevent. The whole-game and board-material figures above are
about `f9d6be635d34` and say so.

**I ALSO DID NOT REGENERATE THE CENSUS.** My change touches no mechanic, so it cannot move a census
row, and regenerating it would have broken the pin my own run was measured under.

---

## OWED, NOT RUN

- **THE PUSH IS OWED AND IS DELIBERATELY NOT DONE.** Two commits (`6ee4a666`, `d988aadc`) sit local.
  `origin/main` is **one ahead** and that one commit is OPS's `ingest: new ladder games`, which
  rewrites `data/games.ladder.jsonl.gz`, `data/meta-usage.json` and `data/bring-priors.json`. The
  concurrent agent is **still running** — `data/all-mechanics-fire.json` was rewritten 37 seconds
  before this was written — and `game_differential.js` draws its team pool **LIVE from that store**.
  Rebasing would swap the store under a live measurement, which is the exact hazard CLAUDE.md records
  as costing 7,100 games. **Push when the tree is quiet:** `git pull --rebase && git push`. No file
  in that upstream commit overlaps anything committed here, so the rebase will be clean.

- **RE-RUN THE ROSTER STAGES AND THE MECHANICS CLAUSE ON THE FINAL TREE.** They are withheld against
  `f9f3a61481cb` right now. This belongs to whoever closes the doll-blind batch, because a re-run
  started now would be superseded by their next edit. It is **not** a claim that anything is wrong —
  every stage read 0 FIRED-AND-BOARDS-DIFFER and 0 DID-NOT-FIRE on `f9d6be635d34`.
- **THE TWO TAILWIND ROWS.** Both carry `onSideResidualOrder: 26` / `onSideResidualSubOrder: 5`, and
  `Battle#speedSort` (`sim/battle.ts:429-458`) breaks the tie with `this.prng.shuffle(...)`. Matching
  them means matching a random draw, which is why they waited for this die. Next batch, not this one.
- **THE FIVE NEW `board_parted_before_the_protocol_did` GAMES ARE UNDIAGNOSED.** They are the
  clearest thing the corrected die exposed — a board that parts with no protocol line disagreeing —
  and nothing here says what they are. `data/divergence-turns.json` was re-baselined for exactly this.
- **`tests/probe_random_target_address.js`'s PUBLISHED FIGURES ARE STALE.** Every number it printed
  was computed under the translating hash, including its `single`/`twoDig` shift measurements, which
  were measuring the defect itself. Re-run before quoting.
- **NO CLAIM IS MADE ABOUT STRENGTH.** ENGINE cannot measure one. Landing the mechanic is the result.
- **NOT TOUCHED, AS INSTRUCTED:** Tailwind, the random-target row, every declared row including
  Supreme Overlord's `fallenundefined`, `magnetrise@18`, `perishsong@24` / `uproar@28` / `lockedmove`,
  `_refills` vs `speedSort`, the doll-blind status family, `web/`, `app/`, `data/engine-data.js`,
  `engine/quality.js`, `data/quality-filter.json`.
