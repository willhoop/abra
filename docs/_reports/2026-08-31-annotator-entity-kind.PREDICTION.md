# PREDICTION — written 2026-08-31 BEFORE the probe was run or the annotator was touched

Point estimates. Anything wrong stays on the page.

Baselines quoted in the brief and confirmed by me from
`data/verification/game-differential.enginedata.json` (generated `2026-08-31T03:49:08.571Z`,
release `862624c9826e`, pool `0d103fb9fa87`, census pin `9446a684709d`, 961 games, cap 12,
arm `middle`): protocol diverged **172**, distinct causes **150**, board-parted — I have NOT
re-derived the 82 and do not quote it.

## P1 — the collision membership

Derived from `Dex.forFormat('gen9championsvgc2026regmb')`, filtered
`exists && !isNonstandard && tier !== 'Illegal'`:

- Condition names reachable from a **legal** setter (declared `volatileStatus` / `sideCondition` /
  `slotCondition` / `pseudoWeather` / `weather` / `terrain` / `status` on a legal move, ability or
  item, PLUS `addVolatile('…')`-style literals inside those entities' handlers, PLUS the 35-entry
  standalone `Dex.data.Conditions` table): **96**.
- Of those 96, the number whose name also names a move that is NOT in this format: **3** —
  `confusion` (Past), `hail` (Past), `healblock` (Past).
- Already rescued by the existing standalone-table rule: **2** (`confusion`, `hail`).
- **Live hole in the condition class: 1 — `healblock`.**

Two further guises of the same "first dex hit wins" fault, derived the same way:

- Legal **items** whose id collides with an illegal move: **1** (`metronome`).
  Legal **abilities**: **0**.
- Illegal **base species** that carry at least one legal forme: **1** (`floette` →
  `floetteeternal`, `floettemega`).

**So five names in the whole regulation can be mislabelled, of which three are live holes:
`healblock`, `metronome`, `floette`.**

## P2 — rows mislabelled in the current artifact

- Rows carrying the flag at all: **112**. Rows carrying `cannot_occur_in_format: true`: **3**.
- **All 3 are mislabelled.** One is the filed Heal Block row; **two are Floette** —
  `-damage field 3` value divergences on `p1a:floette`, whose rosters hold `floettemega` /
  `floetteeternal`, both legal.
- After the fix I predict `cannot_occur_in_format: true` = **0** on this artifact.
- `metronome` predicted to appear on **0** rows of this artifact — the fix is derived, not
  observed, and I expect it to change nothing here.

## P3 — what was hidden

- Board-material among the three: **2** — both Floette rows are `board_parted: 1`,
  `DIFFERENT-END-STATE`. The Heal Block row is `board_parted: 0`, `materiality:
  NARRATION-ONLY`.
- So the mislabelling hid **two board-parting damage divergences on a legal body** for as long as
  the flag has been used to triage.

## P4 — would it catch a collision spelled differently

I predict **yes for all three guises**, because each rule is a derivation over the format rather
than a list of names: the condition set is computed from legal setters, the kind preference is
"prefer a reachable kind over an unreachable one", and the species rule is "a base forme with a
legal forme is reachable". I predict the printed membership counts will be **96 / 3 / 1 / 1** and
that a new Past move colliding with a live volatile would be picked up with no edit.

## P5 — no game moves

This is an instrument change. I predict board-parted, protocol `diverged`, distinct causes and the
census are all **unchanged**, because nothing in the fix is on a game path. If any of them move,
that is a stop-and-report.

## P6 — the declared_gaps bookkeeping item (E8 row 147, #321)

I predict this is **NOT trivial and independent** and I will file it rather than land it, because
`declared_gaps` is a gate-visible list and adding an entry changes what the gate excuses.
