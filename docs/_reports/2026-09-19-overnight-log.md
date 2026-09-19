# Overnight log — 2026-09-19

Will, 2026-09-19: *"keep going overnight dont stop for anything unless you get stuck, just make note of it and
go around it."* This file records every place the night got stuck and what was done instead. It is a findings
record, not current state; read the gate with `node engine/status.js`.

## Standing at the start of the night

- Pushed: `2a1ff00c`. Whole-game board-material 0 / 1 / 2 (release `a1c7dcd5696b`, 6.53.0). Narration
  0 / 11 / 24. Gate CLOSED.
- The next-major document draft is at `docs/_reports/2026-09-19-700-draft/` and is NOT published.

## Stuck, and routed around

| time (UTC) | what | what was done instead |
|---|---|---|
| ~08:00 | MEASURE staged 95 releases (570 MB of checkout, ~2 MB of pack) | kept the 19 that published figures' artifacts cite (118 MB); the other 76 are named only in prose and stay on disk. Commit `ba5e03d0`. |
| ~09:30 | the tie-order agent overwrote a shared scratchpad `inspect.js`, probably another agent's tool | nothing lost from the repo; later briefs require a per-task scratchpad subfolder and forbid overwriting |
| ~11:40 | narration's last games include Forewarn, which Will set aside (roster row) | the ROSTER deferral stays; the narration gate measures Forewarn's message itself, so the agent makes our announcement match the authority's instead of asking. **Will may want to look at this.** |

## Progress

- 6.58.0 (`a43e94f6`): board-material 0 / 0 / 0 on all three lattices, the first time. Gate CLOSED 1 of 9, narration only (0 / 2 / 6).
- 6.59.0 (`2c83fa6d`): the last narration mechanisms (Forewarn, Harvest's coin, Chilly Reception, held status before terrain, spin/Defog attribution, Magician, partial drop-refusal order).
- 6.60.0 / 6.61.0 (`e85e48c8`): board-material 0 / 0 / 0 and narration 0 / 0 / 0; a dead Harvest red anchor re-aimed; **`GATE: OPEN` — all nine clauses pass on release `4c9b0cc4a4da`.** The next-major basis change is NOT published: the draft is being filled from these artifacts for Will to read.

## Queued for after the current measurement (done in 6.56.0) (these touch files the measuring agent reads)

- Wire COULD-NOT-STAGE into the gate (draft README item 2; Will's standing rule).
- Retract the white paper's 2026-09-12 UPDATE lattice counts from `bc8d7cf849dd` on main (draft README item 4).
- Commit the releases the recent measurements cite (`git add -f data/releases/<id>`), after checking their size.

## OWED, NOT RUN

```bash
node engine/status.js
node engine/open_work.js
```
