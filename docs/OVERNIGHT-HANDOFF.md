# ABRA — overnight handoff (2026-07-23, ~04:30)

Stopped at a clean point. `web/index.html` and `engine/medicham2-browser.js` both pass `node --check`. No git touched.

## Done tonight (all in `web/index.html` unless noted)

**Bugs fixed & verified**
- **MEDICHAM special-move bug** — the damage function skipped every `c==='S'` (Special) move, so any special-attacking team scored 0%. Removed the clause; verified (matchup 0.47, mirror 0.50).
- **Booth regression** — generalizing the slot renderer to `[data-slots]` had left the JOLTEON booth's own slots without the attribute, so "Surprise me" and team display rendered nothing. Fixed.
- **JOLTEON coin-flip** — it was purely additive (team-strength sum), so all meta teams read ~50%. Added a team-vs-team type-coverage term (`typeEdge`). Now spreads 16–82% across matchups; mirror stays 0.50.
- **DITTO was server-only** — ported to run fully in-browser (`runDitto`): hill-climb vs a usage-weighted 24-team gauntlet, MEDICHAM-scored item tuning, Goodhart re-check. Weak seed climbs 37→89% in tests.
- **KADABRA was server-only** — rewrote `runKadabra`/`kadBuild` to fetch the public replay JSON client-side and parse it into key-turn scenes (verified on a synthetic doubles log). Falls back to a paste box if the browser blocks the cross-site fetch.
- Threats table: **sample-adjusted Win%** (shrink toward 50% by games; rare mons no longer top the chart), **real Champions speed** stat with base-forme fallback, added **Games** column, **ascending sort** toggle, sprite fallback to base forme. Removed the confusing **Dmg** column.

**Features added**
- MEDICHAM & DITTO rooms now use the **JOLTEON sprite picker** bound to the shared carried team (no more text boxes). MEDICHAM room mirrors the booth (meter + result on top). "MEDICHAM check" button removed from JOLTEON (it has its own tab).
- **Saved-teams bar** now appears in the MEDICHAM room too (answers "how do I load my saved team into the matchup").
- DITTO shows **full sets** — item, ability, and **top-6 moves** with usage% (`MOVESETS` embed from `data/move-priors.json`) — plus **Copy as PokéPaste**. Results redesigned and moved **above** the picker with a rating meter.
- **Per-room mascot advisors** with distinct **personalities** — each model animates in character (Jolteon twitchy/electric, Medicham disciplined strike, Ditto squishy, Kadabra psychic float, Slowking regal sway, Chomp lunges) and speaks in its own voice on rotation.
- Removed the stray "Try the odds booth" button from CHOMP's room.

**NEW — the big one: real doubles engine** (`engine/medicham2-browser.js`)
- Replaces the old 1v1 OHKO-chain (which collapsed to 0%/100%) with a proper **Gen-9 doubles rollout**: correct damage formula, stat boosts, spread ×0.75, crit, damage rolls, STAB, type chart, weather, Trick Room, Tailwind, priority brackets, Protect, items (scarf/band/specs/AV/Life Orb/leftovers/sitrus), abilities (weather-setters, Intimidate, huge/pure power), status, **Fake Out flinch**.
- Policy = **behavior cloning**: samples the move each species actually clicks (from `data/move-priors.json` rates) so Fake Out / Protect / Tailwind appear at real frequencies, while still taking obvious KOs and Protecting when threatened.
- Validation (headless): mirror **0.501**, random-matchup distribution p10 0.09 / p50 0.52 / p90 0.92 with only ~13% extreme, **400 rollouts in 29 ms**.

## NOT done / next steps (in priority order)
1. **Embed the new engine** — inline `medicham2-browser.js` into `web/index.html` and repoint `mcWinProb`→`winProb2(a,b,N)` and `mcWinProbI`→`winProb2(a,b,N,items)`. Then browser-QA every tab. (This is why the live site still shows the old 0/100 MEDICHAM — the new engine is built & tested but not wired in yet.)
2. **MIT stats-chair teardown** (task #32) — Will's ask: adopt the persona of an MIT stats chair reviewing a PhD thesis; read the ML/rating/game-AI literature; write a scathing, concrete review of JOLTEON / MEDICHAM / DITTO / SLOWKING / the predictability study. **Will explicitly authorized scrapping and rebuilding anything fundamentally flawed** — not just patching. Then begin fixes.
3. **Advance the open Showdown sim** (`sim/`, task #31) — greedy CHOMP-damage agent is written; next wrap `playBattle` as `MEDICHAM.exactRollout` and `DITTO.selfPlayScore`. Runs on Will's machine (`cd sim && npm install pokemon-showdown && node selfplay.js 20`); does not run in the sandbox.
4. **Docs/papers + special-cut** (task #33) — fold all of tonight's changes into the whitepapers/exec summaries/cheat sheet/changelog and rebuild the special-cut PDF.

## Known honest caveats (for the review to scrutinize)
- The browser MEDICHAM is an **approximation**, not the real engine. Its policy is a greedy/behavior-clone hybrid, so it over-rewards speed-control cores (Tailwind runaways) because it can't fully model disruption/positioning. **The trustworthy path is the open Showdown sim** (#31), which is ground truth.
- Champions stats in `MC.mons` are the SP-system final stats; damage runs high (frail mons, more OHKOs) — plausibly correct for the format but unvalidated against the real engine.
- JOLTEON's coverage term is a hand-set coefficient (0.55), not learned. DITTO optimizes against JOLTEON then re-checks with MEDICHAM — both are approximations, so "team ratings" are directional, not absolute.
