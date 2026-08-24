# Ordering cards — 2026-08-24

Four things I could not decide without you. Everything else in the pass was either fixed or is
owed as ordinary work; those are in `docs/_reports/2026-08-24-entry-order.md`.

Every line below was read out of the official simulator or out of `data/game-differential.json`.
Nothing here is recalled.

---

### Two Tailwinds running out on the same turn

WHAT HAPPENS   Both sides set Tailwind on the same turn. Four turns later both wear off, and the two
"Tailwind ended" messages come out in the opposite order from ours. Both Tailwinds are gone either
way; nothing on the board differs.

SHOWDOWN       `|-sideend|p2: B|move: Tailwind` then `|-sideend|p1: |move: Tailwind`

US             `|-sideend|p1: |move: Tailwind` then `|-sideend|p2: B|move: Tailwind`

WHY IT DIFFERS These two are tied on **all five** of the authority's sort keys. `resolvePriority`
(`sim/battle.ts:993-999`) only fills the fifth key, `effectOrder`, for `SwitchIn` and
`RedirectTarget` events — an end-of-turn side clock never gets one. So `speedSort` hands the pair to
`prng.shuffle` (`sim/battle.ts:456`) and **a coin decides**. Staged both ways just now: with the
shuffle pinned to the identity the authority says p1 first, with it reversed it says p2 first, and
both Tailwinds end in both arms. Our side is `residualOrder` (`engine/medicham2-browser.js:5487`),
a stable sort, which always says p1.

DOES IT MATTER Narration. I checked what your question asked rather than assuming it: the residual
handler list is speed-sorted **once**, before the walk (`sim/battle.ts:505`), so a Tailwind ending
cannot reorder anything after it; nothing between the two lines reads side state; and the speed
consequence is not applied until the next turn's `commitChoices`. 2 games of 961 in the pool.

THE QUESTION   Do I declare this pair — as *impossible to compare*, because the authority itself is
flipping a coin — or leave it undeclared and red?

---

### The speed ties the differential is measuring are mostly ones the harness invented

WHAT HAPPENS   An open team sheet does not show a spread, so `game_differential.js` gives every body
a synthetic one off a fixed ladder: the first body brought gets +32 Speed points, the second +22,
the third +11, the fourth 0 (`engine/game_differential.js:2282`). Two bodies whose base Speed differs
by exactly the gap between two rungs come out **dead level**.

SHOWDOWN       Politoed (base 70, Modest) and Incineroar (base 60, Impish) both read **112** — I
staged that exact lead and read `storedStats.spe` off both bodies.

US             The same 112 on both. We agree about the number and disagree about who goes first.

WHY IT DIFFERS Nothing differs about the *speed*. The ladder is why there is a tie to disagree about
at all. Of the 13 distinct `ordering` rows in the pool, **at least 8 are exact ties** — the two
entry-ability rows, three "both clicked Protect" rows, two mega rows and the Tailwind pair.

DOES IT MATTER It decides how much of the `ordering` class is real. Ladder players do run spreads,
so ties genuinely happen; they do not happen at a rate any ladder produces, because a real spread
almost never lands two bodies on the same number by construction.

THE QUESTION   Is the `ordering` class worth ENGINE's remaining batches at this weight, or should the
harness spread be jittered by a point or two first so the class shrinks to what the game produces?

---

### Two more sorts still use the wrong algorithm — one batch or two?

WHAT HAPPENS   The authority resolves a speed tie with a selection sort whose swaps move *untied*
bodies past the tied pair; a plain stable sort cannot produce that order. There are **four** places
this engine sorts on speed. The move queue was fixed in 3.74.0. The entry pass is fixed in this pass.
The **mega phase** and the **residual** still use `Array.prototype.sort`.

SHOWDOWN       `Battle#speedSort` (`sim/battle.ts:429-460`) for all four, ending in `prng.shuffle`.

US             `engine/medicham2-browser.js:16787` (`_run.sort(...)`, the mega phase) and `:5487`
(`residualOrder`).

WHY IT DIFFERS Same mechanism as the entry defect I closed today, at two more call sites.
Both mega rows in the pool are exact ties (Starmie Adamant 167 against Charizard Timid 167;
two Adamant/Brave Mawile at 112), so the class is already showing them.

DOES IT MATTER Board-material at the mega site — which body evolves first can decide which side spends
its one mega — and narration at the residual site. Small counts either way: 2 mega rows, 2 Tailwind
rows of 961 games.

THE QUESTION   Do I take both remaining sites in one batch, or one at a time? Your standing rule is
small batches, and these two share a mechanism but land in completely different parts of the turn.

---

### A rollout has no coin to flip

WHAT HAPPENS   The entry tie is now decided by the shared `tie` die, exactly as the move queue's is.
But a caller that hands `battleInit` no rng — every rollout, every census probe, MILTANK's search —
has no die, so the tied group keeps the order the selection sort handed it. That is deterministic and
it is one branch of a coin flip.

SHOWDOWN       A real battle flips (`prng.shuffle`).

US             `MEDFAILS.entryOrderTieNoDie` counts every time this happens, so it is loud rather
than silent.

WHY IT DIFFERS `battleInit` takes `opts.rng` and most callers do not pass one
(`engine/medicham2-browser.js:15431`). Making it default to a die would move **every seeded run in
the repo** that meets an entry tie.

DOES IT MATTER Only for search quality, not for correctness against the authority: the differential
pins the die to a constant anyway, so the measured number does not move either way.

THE QUESTION   Leave rollouts deterministic on a tie (cheap, reproducible, biased to one branch), or
give `battleInit` a die and accept that every existing seeded baseline shifts?
