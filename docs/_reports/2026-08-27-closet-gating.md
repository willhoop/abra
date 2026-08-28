# The closet becomes a gate exemption — 2026-08-27, MEASURE

## LEAD: THE CLAUSE COUNT DID NOT CHANGE

```
BEFORE   5 of 8 clauses PASS      whole-game 1 of 961 (6 raw, less 5 declared)
AFTER    5 of 8 clauses PASS      whole-game 1 of 961 (6 raw, less 5 declared)
```

Both readings taken on the SAME pinned pair — `data/game-differential.json` release
`f3d423e19e88`, 961 games, generated `2026-08-28T03:29:20Z`, plus
`data/all-mechanics-fire.json` on the same release — at 23:47 EDT, three minutes before the ENGINE
agent cut `ccd5c7f5a5d7`. The failing three are the same three either way: roster/moves (1 red
demonstration that did not behave as its rule predicted), whole-game (1 of 961), mechanics (4 of 11,
all four in ENGINE's live batch).

**Nothing improved, and if it had, the improvement would have been a RULE CHANGE and not an engine
change.** The new exemption kind ships with an empty list, so it cannot subtract anything. That is
stated first because a gate that opens because somebody widened the rules is the exact failure this
division exists to catch.

The `--selftest` count moved 109 → 148 (0 failed), which is a count of assertions and not of engine
correctness.

---

## WHAT WILL RULED, AND WHAT IT HAD COST

2026-08-26: *"no if i put things into the closet it should not be gated — like illusion"*.
2026-08-27: *"things in the closet shouldnt block a gate if we know why they fail and choose to
accept it."*

He closeted Tailwind's expiry order on 2026-08-24 — *"put it into the closet with that note and move
on"*. It was filed as `DEFERRED`, and `declaredMatch` refuses to subtract that kind **by design**,
because a deferred row asserts something IS wrong. ROADMAP `#355` wrote the refusal into its own
cell: *"it stays UNDECLARED, red, and named on every run, which is exactly the behaviour that stops
a chosen deferral becoming a quiet pass."* The instruction was recorded correctly and had no effect
for two days.

## WHAT LANDED — `engine/quarantine.js`, no engine byte touched

`CLOSETED` is a third `DECLARED_KINDS` entry, and the only one that ADMITS a defect exists.
`INCOMPARABLE` and `AUTHORITY-WRONG` both claim there is nothing to fix; this one claims there is,
and that the owner has ruled it does not matter. It is honoured by the whole-game clause and by
`classifyMechanics` through the one shared door, so the two cannot disagree.

### 1. A reason with a mechanism, not prose

`closetFault(d)` refuses a row missing or malforming any of nine fields:

| field | what it pins |
|---|---|
| `closet.by`, `.on`, `.ruling`, `.authority` | the owner, an ISO date, his own quoted words (≥20 chars), the register row carrying the account |
| `evidence.instrument`, `.release`, `.on`, `.says` | what MEASURED the no-board-effect claim, on which frozen release, when, and what it reported |
| `falsifiedBy` | the observation that would make this entry wrong |

A refused row is **not subtracted** and is named through the same sink as a row typed with an
unknown kind, so a half-written exemption holds the gate SHUT rather than opening it.

This is the deliberate inverse of the mechanism the brief warned about. `roadmapRowSaysBroken` tests
`/NOT A DEFECT/i` against a register cell — a phrase anybody can type into a cell by accident, and
one that once subtracted three live turn-order divergences. `CLOSETED` cannot be opened by writing a
sentence; it can only be opened by filling in fields that name a person, a date, an instrument and a
falsifier.

### 2. Excluded is not invisible

`declaredRegisterLine` prints EVERY row of `DECLARED_DIVERGENCE` on every run, matched or not, with
the count it took, the owner, the ruling and the falsifier — and marks any row that
**MATCHED NOTHING IN THIS RUN** as a claim that may have quietly become false. The previous printer
(`declaredLine`) emitted nothing at all when a declaration matched nothing, which is precisely how a
stale exemption would have survived unnoticed. It also prints at zero: `CLOSETED: 0` appears on every
run today.

The register is carried on the clause object as `declared_register` as well, so a later reader does
not have to parse the sentence.

### 3. A closet entry is a claim and must be re-checked

`closetEvidenceStale(d, ctx)` compares the entry's `evidence.release` against the release the
artifact under judgement was measured on, and returns

```
EVIDENCE NOT RE-CHECKED — the no-board-effect claim was measured on release `X` (date) and this
artifact was measured on release `Y`. The ruling stands; the measurement under it has not been
repeated against these bytes.
```

It **still subtracts**. The owner ruled; staleness is a warning about the measurement under the
ruling, not a reversal of it. A run carrying no release reports nothing and never reports the
evidence FRESH — an absence is not a clean bill.

This is the constraint the brief put third, and it is the one with the most receipts: four
declarations in this project have been refuted (speed ties, Tailwind's coin, Moody, a fainted body
in an active slot), and the die fix of 2026-08-27 voided every measurement taken before it.

## THE DECISION: WHICH ROWS MOVE INTO THIS TREATMENT

**None. The closet ships empty, and that is measured rather than assumed.**

The only candidate was Tailwind's expiry order, `#355`. ROADMAP `#493` **FIXED** it on 2026-08-27 —
ENGINE rebuilt the authority's residual handler LIST as a shadow, whole-game 13 → 11 of 961. Walking
`classes[].causes[]` of the current artifact:

```
6 causes, 6 first_divergences, none a `-sideend` / `tailwind` pair
  event missing from medicham2 :: |upkeep <> |faint|p2b                          x1   (undeclared)
  event missing from medicham2 :: |-end|pNb|fallenundefined <> |switch|...       x5   (declared)
```

Writing the row would have registered a permanent exemption for a divergence that no longer occurs.
The refusal is recorded as a comment where the row would have gone, and `#355` is **closed** with
that evidence — its cell had said `open — DEFERRED BY DECISION` for three days after the defect was
fixed.

That is the fifth time a declaration in this project has been overtaken, and it is the first
question the new door asks: *is the divergence still there?*

**Rows deliberately NOT moved, each with the mechanism that already covers it:**

- **Illusion (`#67`, `#160`)** — a SAMPLE EXCLUSION in `game_differential.js`, stamped into the
  artifact's `closet` block and printed beside the headline. Already outside the gate. Correct where
  it is: it drops teams before pairing, which no declaration kind can express.
- **Stall (`#195`)** — `DEFERRED-BY-OWNER` on the roster shelf, already excluded from its clause and
  already carrying a `would_pass_now` staleness check. Zero corpus uses.
- **The four mechanics rows shelved by the owner** — `summary[k].shelved_by_owner_diverging`,
  already subtracted and already printed beneath the headline.
- **`#310` ("engine DEFECT, deferred by cost") and `#343` ("fix deliberately deferred")** — these
  are the rows `CLOSETED` must NOT swallow. *"A declaration whose reason is cost is a defect wearing
  a label"* is this file's own receipt: the spread-accuracy declaration at
  `medicham2-browser.js:17440` hid the largest real defect in the engine on exactly that reasoning.
  Neither has an owner ruling, a measured no-board-effect claim, or a falsifier.

## THE OTHER DOOR: THE `NOT A DEFECT` RECEIPT OVERSTATED ITSELF 8×

`\bDEFECT\b` matches **inside the phrase `NOT A DEFECT` itself**, so the early return in
`roadmapRowSaysBroken` fires for every row carrying the phrase — including rows whose only `DEFECT`
token is the one inside it, and which would never have counted as broken on their own merits.

Re-derived tonight over all **432 register rows (205 open)**, not inherited from the earlier report:

| row | subject | verdict |
|---|---|---|
| **#252** | futility gate carries a declared prediction (SEARCH) | **SUPPRESSES** — prose fallback matches `IS DEAD` inside the metaphor *"a Farigiraf is dead only while that Farigiraf is still there"*. Legitimate; this is the case the override was built for. |
| #336 | sleep: distribution right, draw ADDRESS never checked | phrase-only |
| #381 | register hygiene: unlaunchable `VERIFIED BY` rows | phrase-only |
| #386 | `open_work.js`'s UNREGISTERED input set is one artifact wide | phrase-only |
| #387 | whole-game headline changed quantity with no label | phrase-only |
| #395 | damage differential publishes 40 of however many it found | phrase-only |
| #396 | whole-game 82 → 31 mechanisms, board-material split unmeasured | phrase-only |
| #480 | eight comments naming a source file that is not there | phrase-only |

**Nine became eight**: `#344` (a fainted body in an active slot) was refuted and closed the same
night — the authority also leaves the corpse in the slot, and our instrument was comparing array
membership against a boolean flag. The earlier report's two "unsafe" flags are therefore down to
one, and it resolves the other way than expected:

- **`#344` — gone.** Refuted and closed, not excused.
- **`#336` — still excused, and now demonstrably suppressing nothing.** Its cell reads
  `open — verification owed, MEASURE`. It makes no breakage claim, so the override only cancels its
  own phrase. It is still the row worth re-opening on its merits (see OWED), but it is not being
  hidden by this mechanism, which is what the flag was about.

`notADefectSuppresses(l, cell)` strips every occurrence of the phrase and re-tests. The receipt now
prints both numbers and marks the suppressing rows by name:

```
8 open row(s) declare NOT A DEFECT in their status cell and are excused from this clause, of
which 1 would otherwise have counted as broken (#252) — the rest carry no breakage claim but the
phrase's own `DEFECT` token, so the override only cancels itself on them: #252 SUPPRESSES [...]
```

**NO VERDICT MOVES.** `roadmapRowSaysBroken` returns `false` for all eight before and after; the open
set, the red set and the clause's pass/fail are byte-identical. **Reported as a display correction,
not as a gate improvement.** `BREAKAGE_PROSE` is now one constant with two readers rather than one
regex written out twice.

## SHOWN RED ON A DELIBERATE BREAK

Five breaks, each applied to the shipping file, run, and reverted (the file was restored byte-for-byte
and re-verified green afterwards):

| break | assertions red |
|---|---|
| `closetFault` never faults — the door stops checking the schema | **22** |
| `CLOSETED` removed from `DECLARED_KINDS` | **16** |
| `declaredRegisterLine` prints nothing | **3** |
| `closetEvidenceStale` never reports | **2** |
| `notADefectSuppresses` collapses to "the phrase is present" | **1** |

`node engine/quarantine.js --selftest` → **148 passed, 0 failed**, exit 0 (read unpiped).
`node tests/test-roadmap-register.js` → 3 passed, 0 failed.
`node tests/test-docs-current.js` → 23 passed, 0 failed.

**One design note forced by the existing rules, recorded rather than hidden:** the staleness
assertions are driven through `declaredMatch` and `declaredRegisterLine` rather than through
`wholeGameClause`, because `#298` makes the clause REFUSE outright any artifact whose release differs
from the tree's. An injected artifact can therefore only ever carry the current release or none, and
there is no way to hand the clause a second release to compare against. The comparison a closeted row
actually makes is "my evidence's release against the release this run measured", which is what the
assertions exercise.

## WHAT WAS NOT RUN, AND WHY

The ENGINE agent held the game slot throughout and was rewriting `data/game-differential.json`, the
roster artifacts and the census. **`game_differential.js`, the roster stages, `all_mechanics_fire.js`
and `status.js --write` were not run.** The artifacts were read at 23:47 EDT, 15 minutes after they
settled, and cross-checked against `git show HEAD:data/game-differential.json`. ENGINE then cut
release `ccd5c7f5a5d7` at 23:50:52, which is why a gate read taken after that time reports 3 of 8 —
the artifacts are now stale against the tree. **That is ENGINE's batch in flight, not a regression,
and it is not what the before/after above is measured on.**

## OWED, NOT RUN

```bash
# 1. Restamp the ledgers once the artifacts stop moving. NOT run tonight — ENGINE held the slot.
node engine/status.js --write

# 2. #336 — the sleep draw ADDRESS, never checked. Still excused by the phrase, and it is the
#    exact shape of the four refuted declarations: "the distribution is right and whether the draw
#    is addressed identically has never been checked". A pinned staged sleep on both engines,
#    printing the draw count and the address consumed, against Champions' `slp` override read from
#    /data/mods/champions/ and cited by line.

# 3. #218's verdict is still stored against a superseded artifact (register-reality generated
#    16:12 EDT; the differential was rewritten at 23:29 and the release moved at 23:50).
node engine/register_reality.js
node engine/quarantine.js --whole-game ; echo "EXIT=$?"     # read the code UNPIPED

# 4. The `uses` scrape in openDefectClause still ranks the open queue on the first `\d+ uses|clicks`
#    anywhere in a row. #218's is 94,313 = Protect corpus clicks from a family #222 RETRACTED, and
#    click-counts.json says 147,242. Not fixed here; it is a display and ordering figure with no
#    provenance and it deserves its own decision about what `uses` should mean.

# 5. THE STANDING PRIORITY IS STILL UNTOUCHED. data/winrate-backtest.json remains older than
#    engine-data.js, 350 games at 40 rollouts, and says MEDICHAM beats neither a coin nor Elo.
#    Nothing tonight moved it and nothing tonight is a substitute for it.
```

**Not mine and not done:** the four state fixes landing now (shields blind to status-blocking,
Belch's berry gate, Smack Down's airborne gate, Shell Side Arm's category), the narration batch, the
unreproducible faint row (`|upkeep <> |faint|p2b`, the one undeclared whole-game divergence), and
anything under `web/` or `app/`.

**Debris reported, not touched:** ~30 untracked `.scratch_*` files and directories at the repository
root, plus `data/_scratch-scovillain-dump.json`, `data/_pair-pilot.json` and
`data/medicham-represented-clicks.json`. All belong to other sessions. Left in place.
