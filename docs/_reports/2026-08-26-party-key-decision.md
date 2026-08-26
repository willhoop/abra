# The party key: measured, and HELD — 2026-08-26 (ENGINE)

**THE SAMPLE ANSWER, FIRST. The game LIST did not move — 961 of 961, same pairs, same order. The
GAMES DID: 109 of 961 trajectories differ. The re-key is NOT landed.**

The brief's criterion was the ordered `config|seed` list. That criterion is **necessary and not
sufficient, and on this run it gives the comfortable answer.** Under `--games N` the scheduler walks
`pairsCached(cfg)` in a fixed order and takes a prefix, so the pair list is decided by the pinned pool
alone and **cannot** move whatever the credit does. Only `--until-covered` moves the stop point.
A run that compared only the list would have reported "sample held, land it" — and been wrong.

What actually decides is whether the same games were **played**, and the census-coverage driver picks
the clicks off exactly the credit the re-key changes.

---

## The instrument, and its control

`MEDI_SAMPLE_DUMP=<file>` (new, `engine/game_differential.js`) writes one row per game per arm:
`config`, `seed`, `turns`, `lines`, `diverged`, `end_reason`, the per-game board result, and a
**digest of medicham2's own emitted stream** for that game. Purely observational — it reads records
that already exist, changes no die, no click and no board, and is off unless the env var names a file.

**The control was run before the arms were believed.** Two identical display-key runs at identical
pins:

```
  GAME LIST identical (ordered):  true
  TRAJECTORY differing games:     0 of 961
  diverged set:                   15 vs 15, no membership change
```

So the 109 below is a signal the instrument could have failed to see and did not.

**And the display arm reproduces the published artifact exactly** — the 15-game diverged set is
identical to `data/game-differential.json`'s `first_divergences` member for member, and the two
board-parted games are the same two. The `stableKey` move and the dump are therefore proven
behaviour-neutral against an artifact rather than assumed.

Pins, both arms: `--games 1200 --arm middle --turns 12 --team-store data/team-pool-frozen
--census data/verification/census-pin-9446a684709d.json --state --end-state`, release `667278050dcf`.

---

## The measurement

```
  display  vs  identity        (MEDI_PARTY_KEY_IDENTITY=1)
  GAME LIST identical (ordered):  true      961 vs 961, 0 positions differ
  TRAJECTORY differing games:     109 of 961
    turns differ 10 · lines differ 67 · diverged-flag differs 7
  diverged count:                 15  ->  20      (1 left the set, 6 joined it)
  board-parted games:              2  ->   4
  reader failures:   {"duplicate_species_in_party":20,...}  ->  {}
```

**109 trajectories moved, so no count in that table may be read as a before/after.** "Board-material
2 -> 4" is not a regression and "15 -> 20" is not a finding; they are two different populations.

---

## What IS attributable, because those two games were played identically

The two board-parted games under display keying **both have an unchanged trace digest across the
arms**, so their per-game verdicts transfer. This is a claim about two named games, not a count over
a moved sample.

| game (config `baseline`) | display key | identity key |
|---|---|---|
| `...2636042531 vs ...2635567733` | parts at turn 3 on four `p2.party.garchomp.*` leaves | **does not part at all** |
| `...2635122796 vs ...2634861011` | parts at turn 2, `-damage: a different body` | **parts identically** |

```
  DISPLAY   p2.party.garchomp.hp          medi 123        sd 183
            p2.party.garchomp.maxhp       medi 123        sd 183
            p2.party.garchomp.item        medi lifeorb    sd choicescarf
            p2.party.garchomp.boosts.atk  medi -2         sd 0
```

One engine's row is a transformed Ditto (its own 123 HP, its own Life Orb); the other's is the real
Garchomp it copied (183, Choice Scarf). Four leaves that read as four rule disagreements and are one
reader losing a body.

### THE BRIEF'S PREMISE IS WRONG AND SO IS ROADMAP #463's CLOSING LINE

Both said *"both remaining games are the same cause"* / *"the two that remain are the HELD Ditto
body-key pair"*. **They are not.** One is the party key. The other, `-damage: a different body` at
turn 2, is a genuine engine divergence — a spread hit landing on `p2a` here and `p2b` in the
authority — and it survives the re-key untouched. **Closing the party key does not take
board-material to zero. It takes it to one, and that one is real work.**

---

## The re-key itself is correct, and it is reached

- `duplicate_species_in_party` **20 -> 0** on the pinned run, and no `stable_key_fallback_*` and no
  `party_key_no_identity` appeared: every party row on 961 games resolved off a stamp.
- `tests/probe_party_key_collision.js` stages the collision from a derived fixture — the copier is
  the legal carrier of the `transformsOnEntry` tag read out of `data/tags.json`, the copied body sits
  BOTH diagonally opposite it and on its own bench. Display key: **3 of 4 party rows in both
  engines**, one body lost. Identity key: 4 of 4 in both, the same four, and the rename becomes a
  compared `species` leaf.
- **The fixture was wrong first and said so.** Version one put the copied body in the foe's slot A;
  Imposter copies the DIAGONAL, so the collision only happened because the derived filler happened to
  be the body that got copied. It went green for the wrong reason. Two guards now fail the probe if
  the copier did not rename and if it did not rename onto the species its own side carries.

## And it exposes divergences the display key could not report

Among the three new board-parted games (all on moved trajectories, so **not** attributable to the
re-key as a count):

```
  p1.party.ditto.species  medi "metagross"  sd "ditto"
  p1.party.ditto.types    medi "psychic/steel"  sd "normal"
```

A transform this engine is holding and the authority is not. Under the display key that row could
never be written under a stable name at all. **Landing the re-key will surface real defects, and they
will arrive looking like a regression.** That is a reason to re-baseline deliberately, not a reason
to leave the reader wrong.

---

## What a valid measurement needs — the re-baseline

The old numbers are **retired, not compared**. Concretely:

1. Land the re-key as the default and remove the knob's measurement role (keep it as the positive
   control that restores display keying).
2. Re-run the pinned differential and **stamp the identity-keyed run as the new baseline**:
   `node engine/quarantine.js --stamp-whole-game` under this pin.
3. Every quantity the gate reads — board-material, whole-game clause, raw diverged, the per-cause
   worklist — restarts from that run. Anything quoted across the boundary is two instruments.
4. Work the new worklist. On the arm measured here it is four games, one of which (`-damage: a
   different body`) is already open under the display key.

**The alternative that was considered and is worse:** freezing the CREDIT walk on display keying
while the COMPARATOR uses identity, so the driver is unmoved and a clean A/B exists. It buys one
comparable number and leaves the steering keyed on the known-wrong thing indefinitely, in a file
whose whole point is that there is one door.

---

## What is in the tree

Committed with `MEDI_PARTY_KEY_IDENTITY` **off**, so the default board is byte-identical (proven
against the published artifact, above):

- `engine/board_state.js` — `stableKey` (moved from `game_differential.js`, not copied), the knob,
  `species` as a party leaf under it, `party_key_no_identity` and `stable_key_fallback_*` counters.
- `engine/game_differential.js` — `rosterKey` now delegates to `BS.stableKey`; `MEDI_SAMPLE_DUMP`.
- `tests/probe_party_key_collision.js` — the staged collision, both keyings, parent + child.

### Every plant, comparator and serialiser that touches party identity — enumerated

| site | keys the party / a body how | changed? |
|---|---|---|
| `board_state.js partyMap` | displayed species, or `stableKey` under the knob | **yes** |
| `board_state.js benchRow` | projects the body; now carries `key`, which `partyMap` drops | **yes** |
| `board_state.js family()` | `party.<key>` -> `party.<leaf>` / `MISSING-OR-EXTRA-MEMBER` | no — key-agnostic by construction |
| `board_state.js locate()` | splits `p1.party.<key>.<field>`; `body` is the key | no — reports whatever key it is given |
| `game_differential.js rosterKey` | `set.species` / `_switchKey` | delegates now; same answer |
| `game_differential.js` switch addressing, speed rows, roster snapshot | all through `rosterKey` | no |
| `end_state_severity.js endBoard().parties` | reads the party map it is handed | no — follows `partyMap` |
| `board_state.js` PP map | keyed by MOVE ID, never by body | untouched |
| `data/game-differential.json` | stores `p2.party.<key>.<leaf>` path strings | **path strings change under the knob** — this is the re-baseline |

## OWED, NOT RUN

- The re-baseline itself. Nothing was stamped and `data/game-differential.json` was **not** written by
  any run in this session — the published artifact is untouched and still describes display keying.
- No release was cut: **no file in `engine_release.js`'s `SOURCES` moved** (`board_state.js` and
  `game_differential.js` are the reader and the instrument, neither is frozen), so `667278050dcf`
  still describes this tree and a cut would append a no-op event.
- The three roster stages and `all_mechanics_fire.js` were **not** re-run, for the same reason: the
  simulator is byte-identical and the display-key board reproduces the artifact exactly.
- `tests/test-engine-diff.js` was **not** re-run: no damage code was touched, and the stronger check
  already exists — 961 of 961 traces identical to the published run.
- `tests/test-middle-identity.js` and `tests/test-fixture-legality.js` are red at HEAD, pre-existing,
  untouched.
