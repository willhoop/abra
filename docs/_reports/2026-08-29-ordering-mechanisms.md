# THE `ordering` CLASS IS 19 MECHANISMS, NOT ONE — AND THE TWO BIGGEST ARE ALREADY DECLARED IN THE ENGINE'S OWN COMMENTS

**2026-08-29. Diagnosis only — nothing was fixed and nothing was run.**

Read from `git show HEAD:data/verification/divergence-turns.afterfaint.json` and
`git show HEAD:data/verification/game-differential.afterfaint.json` (both tracked at HEAD `85f87a2d`;
a second agent was writing `data/verification/`, so the stable read was used deliberately).
Release `26787be1b8b4`, pool `data/team-pool-frozen`, census pin `9446a684709d`, 961 games, cap 12,
arm `middle`, all 8 configs.

**The class holds 53 games; the dump carries 52 of them** (`pool_considered: 190` of
`of_diverged: 199`). The 53rd is listed as unexplained below.

---

## THE RANKED TABLE

BM = games where the board parted (from `end_state[].summary.by_cause`, deduped by cause string).
**A board parting is CORRELATION, not attribution** — `first_board_divergence_turns` is often several
turns after the split, so the ordering defect may not be what parted it.

| # | Games | BM | Mechanism | Confidence |
|---|---|---|---|---|
| G3 | 6 | 1 | Damage-triggered ability reactions are **batched after the last hit** of a multi-hit move instead of firing after each hit | HIGH |
| G4 | 6 | 1 | A **type-resist berry is consumed when the damage is APPLIED**, not when it is calculated | HIGH — cited |
| G1 | 5 | 0 | **All status chips run as one residual step at order 9.** Burn is order 10 | HIGH — cited, one small fix |
| G2 | 5 | 1 | **Perish Song's counter is not in the residual walk at all** — it ticks below it, so every order-26 side clock is announced first | HIGH — cited |
| G5 | 5 | 0 | **Ability immunity (Levitate) is hoisted into a pre-pass** ahead of every type immunity | HIGH |
| G6 | 4 | 1 | **Disguise busts inline at the hit**; the authority busts it in `onUpdate`, after the rest of the move | HIGH — cited |
| G7 | 3 | 0 | A **switch-in ability fires before the other side's simultaneous replacement has entered** | MEDIUM |
| G8 | 3 | 0 | **Cheek Pouch heals before the berry it ate** | HIGH |
| G9 | 3 | 0 | Two damage reactions on **one hit** come out in the wrong order relative to each other | MEDIUM |
| G10 | 2 | 0 | **Faint messages from the residual phase are flushed after `\|upkeep\|`** instead of during the walk | MEDIUM |
| G11 | 2 | 0 | Two **mirror-species** residual steps come out reversed | **CANNOT SETTLE — see below** |
| G12 | 1 | 0 | **Dragon Darts' two strikes are resolved as one simultaneous spread hit** | MEDIUM |
| G13 | 1 | 1 | **Mega evolution resolves before a start-of-turn White Herb** | LOW |
| G14 | 1 | 0 | **Wide Guard is checked before the accuracy step** | LOW |
| G15 | 1 | 1 | **Substitute breaking on one spread target is emitted after another target's damage** | LOW |
| G16 | 1 | 1 | The **Hyper Cutter block message is emitted after the stat drop that succeeded**, not in the move's boost order | MEDIUM |
| G17 | 1 | 0 | **Cursed Body fires before the spread move's secondary on the other target** | LOW |
| G18 | 1 | 0 | A **berry eaten by end-of-turn damage is consumed after `\|upkeep\|`** | MEDIUM |
| G19 | 1 | 0 | **A slower body acted first.** A real turn-order defect — the only one in the class | HIGH — instrumented |
| — | 1 | 1 | **Not in the dump.** `\|-curestatus\|p1b\|slp\|[msg] <> \|move\|p2b\|sleeppowder` | **UNEXPLAINED** |

**52 grouped + 1 unseen = 53. Board-parted: 7 of the 52, plus the unseen one = 8, which reconciles
with the artifact.**

---

## THE ENTRIES

Row numbers are indices into `divergences[]`.

### G1 — the status residual chip runs as ONE step at order 9. Burn is order 10. (5 games, 0 BM)
Rows 21, 64, 71, 111, 133. Every row: the authority chips **psn/tox on every body first, then brn on
every body**; this engine chips all three in one speed-sorted pass.

`data/residual-order.json` publishes `status:psn` order 9, `status:tox` order 9, `status:brn` **order
10**. `engine/medicham2-browser.js:7340` says so out loud and then merges them anyway:

> *"One id is enough; where a chunk implements several they share an order by construction (psn/tox/brn are 9,9,10 and run as one step)."*

`{ step: 'status', id: 'psn', ns: 'status' }` is one entry in `MAP`.

**HYPOTHESIS: splitting `status` into a psn/tox step at 9 and a brn step at 10 closes all five.**
This is the one group that is obviously a single small fix, and it is a fix to a table entry rather
than to the walk.

### G2 — Perish Song is not a step of the residual walk (5 games, 1 BM)
Rows 7, 70, 127, 137, 186. Every row: the authority emits the `perishN` counters and **then**
`-sideend|…|tailwind`; this engine emits the `-sideend` first.

`perishsong` is order **24**; `expiry:tailwind` is order **26** and is spent inside the group loop by
`residualExpireAt(RESIDUAL_GROUPS[_gi].order, …)` (`:35328`). **There is no perish step in
`RESIDUAL_GROUPS`' `MAP` at all** — the tick is in the foot-of-turn clock loop at `:35441`, below the
whole walk. `residualExpiryDeferred()` exists precisely to publish what is still down there.

`residualOrder`'s own header already declares this class of miss:
> *"the two `|-sideend|…|tailwind` rows in the pool are a case it does NOT fix"* (`:7862`).

**It is now five rows, not two.** A second symptom rides along: the counters themselves come out in a
different body order, which is expected if they are ticked after the order-28 Speed Boost group has
already moved the speeds.

**HYPOTHESIS: moving the perish tick into `RESIDUAL_GROUPS` at order 24 closes both halves.**

### G3 — damage reactions are batched after the last hit of a multi-hit move (6 games, 1 BM)
Rows 44, 62, 76, 184 (Rough Skin), 110, 174 (Stamina). The authority interleaves: hit 1 damage →
reaction → hit 2 damage → reaction → `-hitcount`. This engine emits every hit, then every reaction.

**HYPOTHESIS: the reaction is raised once per CLICK rather than once per ARRIVAL.**

*Not a defect and do not chase it:* several of these rows also show this engine writing
`|[from] ability: stamina` where the authority writes a bare `-boost`. The comparator's
`stat-attribution` rule normalises that away; it is not what split the rows.

### G4 — the type-resist berry is consumed at damage APPLICATION (6 games, 1 BM)
Rows 12, 14, 34, 140, 148, 164. In the authority the berry is spent inside the damage calculation, so
on a spread move **every** target's berry is announced before **any** target's `-damage`. Here the
`-enditem [eat]` / `[weaken]` pair is written at `medicham2-browser.js:30715`, inside the block that
runs "at the point a real hit lands" — so it lands between the other targets' damage lines.

Row 140 is single-target and shows the same root from the other side: the berry comes out **before**
`-supereffective` / `-crit` rather than after.

**HYPOTHESIS: move the berry spend to the damage-calculation pass.**

### G5 — ability immunity is resolved in a pre-pass (5 games, 0 BM)
Rows 13, 29, 65, 139, 161. In **all five**, this engine emits the Levitate `-immune` first and the
type-based `-immune` lines after; the authority emits them in target order with the ability line in
its place. Nothing else about the rows differs.

**HYPOTHESIS: a separate ability-immunity loop runs over all targets before the type-immunity loop.**

### G6 — Disguise busts inline (4 games, 1 BM)
Rows 8, 94, 113, 160. The authority finishes the move — the other spread target's damage, the
secondary unboost, the Throat Chop silence — and **then** writes `detailschange` + the 1/8 chip. Here
those two lines come first.

The file already knows where the authority does it: *"The authority busts the disguise in
`disguise.onUpdate`, raised by `eachEvent('Update')` INSIDE the hit loop
(data/mods/champions/scripts.ts:538)"* (`:11967`). **HYPOTHESIS: the bust is applied at the hit rather
than at the `Update` that follows it.** Row 94 is the board-parted one and the board parts on turn 2,
the same turn as the split.

### G7 — a switch-in ability fires before the other side's replacement lands (3 games, 0 BM)
Rows 72, 85, 142. After a double faint the authority emits **both** replacements' `|switch|` lines and
then runs switch-in abilities; here the ability fires between the two switches. All three rows are
Supreme Overlord, which is the only announcing switch-in ability in the sample.

**HYPOTHESIS: switch-in abilities are run per arrival instead of after all simultaneous arrivals.**

### G8 — Cheek Pouch heals before the berry (3 games, 0 BM)
Rows 55, 157, 178. Authority: `-enditem` → `-heal [from] item` → `-heal [from] Cheek Pouch`. Here:
`-heal [from] Cheek Pouch` → `-enditem` → `-heal [from] item`, and the berry's `-heal` prints the
post-both HP, so both heals are applied in one lump.

**HYPOTHESIS: the Cheek Pouch third is added into the same heal as the berry's own, before the berry
resolves.** Final HP agrees in all three; narration only.

### G9 — two reactions on one hit, wrong order (3 games, 0 BM)
Rows 22 (Stamina before Spicy Spray), 58 (Rough Skin before Poison Touch), 154 (Electromorphosis
before Stamina) — the authority's order in each case; this engine reverses all three.

**HYPOTHESIS: same root as G3 — the reaction handlers are not collected and sorted, they are run
where the damage was applied.** It may fall out of G3's fix; it may not.

### G10 — faint messages are flushed past `|upkeep|` (2 games, 0 BM)
Row 120: authority `faint|faint|upkeep`, here `upkeep|faint|faint`. Row 150: the authority interleaves
a faint between two residual handlers.

**HYPOTHESIS: the residual walk's faint drain runs at the foot of the turn instead of after each
handler.** Note the engine has a whole `RESIDUAL_AFTER_PERISH` apparatus (`:7252`) deciding exactly
this above-or-below-`|upkeep|` question, so this is likely that decision landing wrong on these two
boards rather than a missing capability.

### G11 — CANNOT SETTLE. Two mirror-species residual steps, reversed (2 games, 0 BM)
Row 32: two Sinistcha, both burned, both at residual order 10. Row 163: two Blaziken, both Speed
Boost, both at order 28. **Both are mirror matchups**, which is the signature of an exact speed tie.

Two readings and I cannot choose between them from the artifact:
1. **NOT A DEFECT** — an exact tie, the authority shuffles, we shuffle, neither is wrong.
2. **The declared limitation** — `residualOrder`'s header (`:7858`) says this engine's walk is
   group-major over BODIES and *"reproduces (1) only when the tied group's members are the whole of
   what is in the list"*, so a shared die can still produce a different permutation.

`order_probe` cannot help: it only instruments ACTION order. **This is one for Will's judgement** —
the answer decides whether these two rows are filed `NOT A DEFECT` or added to G2's fix.

### G12 — Dragon Darts resolved as one spread hit (1 game, 0 BM)
Row 119. The authority resolves strike 1 (damage) then strike 2 (effectiveness, damage). Here the
effectiveness of strike 2 is emitted before strike 1's damage — the calc-all-then-apply shape of a
spread move.

### G13 — mega before a start-of-turn White Herb (1 game, 1 BM)
Row 114. Authority: `-enditem White Herb` + `-clearnegativeboost`, then `detailschange` + `-mega`.
Reversed here. LOW confidence — it may be the mega step's position in the turn queue and may be the
Herb's. Board parted at turn 7, six turns after the split, so the attribution is weak.

### G14 — Wide Guard checked before the accuracy step (1 game, 0 BM)
Row 131. Authority: the ally's `-miss` for all targets, then both Wide Guard `-activate` lines. LOW
confidence.

### G15 — Substitute break emitted after another target's damage (1 game, 1 BM)
Row 167. Authority breaks the sub on one spread target before applying damage to the other. LOW
confidence, and see the shared-root note below.

### G16 — the Hyper Cutter block message comes after the drop that succeeded (1 game, 1 BM)
Row 152. Parting Shot lowers atk then spa; the authority writes `-fail … unboost|Attack|[from] Hyper
Cutter` and then `-unboost … spa`, here the two are reversed.
**HYPOTHESIS: the refusal is reported after the whole boost table is applied rather than at its own
stat's position.**

### G17 — Cursed Body before the other target's secondary (1 game, 0 BM)
Row 60. LOW confidence; see the shared-root note.

### G18 — a berry eaten by end-of-turn damage is consumed after `|upkeep|` (1 game, 0 BM)
Row 134. Future Sight lands at end of turn and drops the body under half. Authority eats the Sitrus
before `|upkeep|`; here it is eaten after. Likely the same end-of-turn flush root as G10.

### G19 — A REAL TURN-ORDER DEFECT. A slower body acted first. (1 game, 0 BM)
Row 42, config `omit-weather`. **This is the one row `order_probe` also caught**, and the probe is
explicit:

```
showdown_first : p2a sneasler  speed 664  closecombat  priority 0
medicham_first : p2b aerodactyl speed 378  tailwind     priority 0
same_priority  : true   speed_tied : false   speed_gap : 286
```

Not a tie, not a priority question — the queue put the slower body first. `order_probe` holds 2 rows
and the other is `cls: move field 3` (a Ditto/Transform row at `speed_gap: 0`), so **51 of the 52
`ordering` rows are not turn-order disagreements at all.** That was worth checking and it held.

---

## SHARED-ROOT CANDIDATES — a hypothesis about the queue, not a finding

**G4, G14, G15 and G17 all have the shape "the authority runs each hit STEP across every target;
this engine runs every step per target".** That is 9 games in one fix if it is true. It is a
hypothesis and nothing measured it — G4 alone has a citation.

**G1 and G2 are both the residual walk and are independent fixes**, since G1 is a table entry and G2
is a step that is missing from the walk entirely. Together they are 10 games, the largest actionable
pair in the class.

**G3 and G9 may be one fix** (reaction scheduling), 9 games. Also unmeasured.

---

## WHAT I AM WITHHOLDING

- **No claim that any group's board-parting is caused by that group.** `first_board_divergence_turns`
  is 5–10 turns downstream on four of the seven, and the differential does not attribute.
- **No count of "narration-only" as a verdict.** `materiality` in the artifact is a per-cause label
  computed from whether the game's board ever parted; on a class where 45 of 52 causes have exactly
  one game each, that label is one game's worth of evidence.
- **G11 unsettled and the 53rd row unexplained.** Two of nineteen.

---

## WHAT WOULD SETTLE THE OPEN ONES CHEAPLY

- **G11:** print `effSpeed` for the two mirror bodies on those boards. If they are equal, file
  `NOT A DEFECT`; if not, it belongs with G2.
- **The 53rd row:** raise `--dump-games` so that `ordering` is fully covered. The dump held 190 of 199.
- **G13/G14/G15/G17:** each is one game and each is a staged probe, not an analysis.
