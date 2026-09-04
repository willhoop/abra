# THREE REGISTER ROWS WERE WRONG OVER LIVE DEFECTS — VERIFIED, THEN CORRECTED

Register edits only. **No engine byte moved, no artifact was hand-edited, nothing was committed, and
nothing that plays a game was run.** Every claim below was checked at the code, the Showdown source or
a derivation on the format before the row was touched — the diagnosis
(`docs/_reports/2026-09-04-the-77-by-mechanism.md`) was treated as evidence, not authority.

Files changed: `docs/ROADMAP.md` (three rows), this report.
Side effect to declare: `node engine/open_work.js` rewrote `data/open-work.json`, which is what that
tool does on every run. Its new contents reflect the corrected register.

---

## 1. #403 — CLOSED OVER A LIVE DEFECT. REOPENED ON THE REDIRECT ROAD.

**What the row claimed.** *"SUCKER PUNCH LANDED ON A TARGET THAT HAD ALREADY MOVED … CLOSED
2026-08-23 BY ENGINE"*, status cell `closed 2026-08-23 — engine DEFECT, fixed as a SHARED READER …`,
carrying an executable `VERIFIED BY` marker pointing at `node tests/test-mechanics.js`.

**What is actually true.** The closure is real and is not disturbed: `queueWillMove`
(`engine/medicham2-browser.js:23141`) mirrors `BattleQueue.willMove`, 85/85 became 0/85, and the
`tests/test-mechanics.js` assertion it was closed on is still green. It closed the **queue clause**.
A **second road into the same `if`** is live and was never in scope:

- Our side evaluates the refusal against the ORIGINAL aim. `medicham2-browser.js:29528` opens
  `if(TAGS.has('move',a.move.id,'failsIfTargetNotAttacking'))` on `const _tgt=a.target`, and the
  Follow Me / Rage Powder draw does not run until `redirectDrawnTo(...)` at `:29665` — **137 lines
  below it.**
- The authority orders them the other way. `sim/battle-actions.ts:467` calls
  `pokemon.getMoveTargets(move, target)`, which fires the `RedirectTarget` priority event at
  `sim/pokemon.ts:835` and rebinds `target`; only then does `:590` run
  `singleEvent('Try', move, null, pokemon, targets[0], move)`. So `suckerpunch`'s `onTry`
  (`data/moves.ts:18399`; **no Champions override** — `data/mods/champions/moves.ts` does not mention
  it) asks `this.queue.willMove(target)` about the **redirector**, which clicked a status move at +2
  and has already gone, and returns `false`.
- Both of Showdown's refusal clauses therefore fire on the redirector (`!move` from the spent queue
  entry, and `category === 'Status'`), and neither can fire for us because we asked about the
  redirector's PARTNER, which is attacking.

Cross-check that this is NOT a regression of the closed half: had the attacker aimed *directly* at the
redirector, our own `queueWillMove` would already refuse it — the Follow Me action is `kind:'redirect'`,
`unresolved.delete()` has already run for that body, so the lookup returns `null` and `mvFail` fires.
The defect is reachable only through the redirect, which is exactly why the 2026-08-23 fix did not
touch it.

Measured (release `8ad06030e129`, arm `middle`, `--end-state`, census `9446a684709d`, pool
`0d103fb9fa87`): **4 board-material games of 961** — 14, 46, 69, 70; Kingambit x3, Meowscarada x1;
game 70 is a 91 HP board difference on turn 9.

**What I changed.**
- Status cell → `open 2026-09-04 — engine DEFECT on the REDIRECT road, 4 board-material games of 961
  on release 8ad06030e129, unprobed. The queue-clause half stays CLOSED 2026-08-23 and is not
  reopened;` **and it quotes the old cell verbatim.** Nothing was deleted.
- A dated `REOPENED 2026-09-04 BY MEASURE` addendum carrying the code sites, the authority ordering,
  the four games, and the note that `upperhand` inherits the same ordering (the tag's membership rule
  is the regex `/willMove\(\s*target\s*\)/`, so a third member gets it for free).
- **The executable marker was DEMOTED, and the citation kept word for word.** `tests/test-mechanics.js`
  decides the queue clause and stages no redirector. Left executable on a reopened row,
  `engine/register_reality.js` would classify this `STALE ROW` (open + green) and **exit 1** on a row
  that is neither stale nor verified — the fault its own header files under #241/#276/#283. Replaced
  with `INSTRUMENT OWED:` naming the probe that does not exist.

**Effect, measured rather than assumed** (`openDefectClause()` called directly; the heavy gate was not
run): #403 is now printed by `open_work.js` as a DEFECT — it was invisible to it before — and the
clause verdict is **unchanged at `ok = true`**, because a row with no runnable instrument is DEBT and
cannot hold the gate shut by assertion.

---

## 2. #361 — A TRUE NULL ON A FIXTURE THAT IS IMMUNE TO THE DEFECT.

**What the row claimed.** *"THE MULTI-HIT COUNT DIVERGENCE DOES NOT REPRODUCE …"*, filed 2026-08-22 on
a **Scale Shot** game.

**What is actually true.** Derived on `gen9championsvgc2026regmb` with the regulation filter
`x.exists && !x.isNonstandard && x.tier !== 'Illegal'`:

```
multiaccuracy: populationbomb(hits=10, acc=90), tripleaxel(hits=3, acc=90)
scaleshot:     exists true, isNonstandard null, multiaccuracy FALSE, multihit [2,5], acc 90
```

**Exactly two moves in this regulation carry the flag and Scale Shot is neither.** Its accuracy is
checked once, at `hitStepAccuracy`, so it cannot express a per-arrival divergence: the 2026-08-22 probe
could not have reproduced the defect whichever way it fell. The row recorded a true-but-irrelevant null
and its headline generalised from it.

On the current pinned artifact the mechanism reproduces on **6 board-material games of 961** (7, 19,
21, 31, 57, 77 — `tripleaxel` x3, `populationbomb` x3), and the same pair dominates the run's
unshared-address table, which is the desynchronisation behind most of the 8 VOID games.

**What I changed.** Headline corrected **in place** (it is a live claim), quoting the previous headline
in full and stating that the 2026-08-22 investigation below it is dated evidence kept verbatim. A
dated `CORRECTED 2026-09-04` addendum naming the two real carriers with the derivation, the six games,
and an explicit **non-retraction of the Scale Shot half** — `scaleshot` still does not appear in the
current cause table, and that remains a true null about its own 2-5 count draw. Status cell →
`open — engine DEFECT, 6 board-material games of 961 …`, quoting the old cell. `INSTRUMENT OWED:` a
probe asserting the same `acc` draws **at the same addresses**, not merely the same arrival count.

Effect: #361 now reads DEFECT in `open_work.js` and sits in the clause's **debt** column. Verdict
unchanged at `ok = true`.

---

## 3. #195 — THE CLOSET IS OVER THE ABILITY. THE COUNTER IS A DIFFERENT ENTITY.

**What the row claimed.** *"STALL IS IN THE CLOSET"*, on Will's ruling, measured at **zero corpus
uses**, only legal carrier Sableye. All of that is correct and none of it is retracted.

**What is actually true.** Two entities share the name.

- The **ability** `stall` — legal, one legal carrier (Sableye, derived), zero corpus uses, no row in
  `data/mechanics-census.json`. Closeted, correctly.
- The **volatile** `stall` — `data/conditions.ts:439`, the 1/3, 1/9, 1/27 denominator a stalling move
  rolls against. Derived from the source rather than recalled: **eight moves legal in this regulation**
  call `addVolatile('stall')` — `protect`, `detect`, `endure`, `banefulbunker`, `spikyshield`,
  `kingsshield`, `quickguard`, `wideguard` (plus `burningbulwark`, `obstruct`, `silktrap`, `maxguard`,
  which are `Past` here). Protect alone is one of the most-clicked moves in the format.

So a closet decision taken on the ability's zero usage says nothing whatever about the volatile, and the
volatile is the denominator behind M7 (4 games) and M9 (2 games) — **6 board-material games of 961** on
the current pins.

Collision derivation, done rather than quoted: `engine/effect_kind.js`'s computed condition set holds
**96 names in play**, of which **four also name a legal ABILITY** (`stall`, `primordialsea`,
`desolateland`, `deltastream`) and **three name a MOVE this format does not contain** (`confusion`,
`hail`, `healblock`). The brief's "five names collide" does not match either derived number; the two
figures above are what the format actually says, and the `cannot_occur_in_format` incident
(CHANGELOG 5.234.0) is the second shape, not this one.

**What I changed.** A dated `ADDENDUM 2026-09-04 BY MEASURE` scoping the row to the ability, naming the
eight legal setters of the volatile, carrying the collision derivation, and **pointing at #463 as the
row that owns the counter** (closed 2026-08-26 at board-material 2 of 961, against 6 today). Status
cell → `closet — engine, the ABILITY only; the stall VOLATILE counter is #463 and is NOT closeted`.

**Deliberately NOT done:** no verdict on whether those 6 games are a regression of #463 or a distinct
Encore clause. That is ENGINE's to answer, and the addendum says so. `roadmapRowIsClosed` and
`roadmapRowSaysBroken` both return the same values for #195 as before the edit, so no gate moved.

---

## 4. GATE ARITHMETIC — CHECKED, NOT ASSUMED

`node tests/test-roadmap-register.js` → **3 passed, 0 failed** (506 items, 315 ledger citations, 5
declared exceptions). `openDefectClause()` before and after: **`ok = true`** both times; 72 open rows,
0 `withRed`, 62 debt, 3 stale, 7 unrunnable. `tests/test-docs-current.js` has one pre-existing failure
(a version-header pin, `5.246.0`) that predates this session and is untouched by these edits.

All three rows remain well-formed three-cell table rows (4 unescaped pipes each).

---

## 5. THE UNFILED MECHANISMS — RECOMMENDATION, NOT ACTION

Nothing below was filed. An agent is fixing M1, M3 and M4 as this was written.

| mechanism | file now? | why |
|---|---|---|
| **M4 — the choice lock is never cleared** (5 games, 3 of them UNCAUSED) | **WAIT, then check the closure covers the residue** | It is in the fix batch right now. The house pattern is that the ENGINE agent files the row with its knob and control in the same pass, and a MEASURE-filed row would be superseded within the hour and then need reconciling. **The thing that must not be lost is the residue:** Showdown's two readable removal clauses (`!getItem().isChoice` — Trick, and `!hasMove(effectState.move)` — Transform) explain games 59 and 9 only. Games 10, 45 and 52 (`darkpulse`, `phantomforce`, `lastrespects`) are explained by neither. If the closure names only the two clauses, the remaining three carriers need their own row. |
| **M8 — an ability transfer lands on the wrong body** (2 of 4 games) | **FILE NOW** | Nobody is working it, no row names it, and the diagnosis is the only record. The `onStart` half already has a counter (`MEDFAILS.inheritedAbilityStartNotFired`) that has never been read on a real game; the wrong-body half has nothing at all. This one disappears when the 77 report ages. |
| **M2 — the multiplier half** (games 17, 18, 32; gaps of 15-29) | **FILE NOW, as a SPLIT instruction** | #333/#334 own the roll INDEX and gaps of 15-29 are outside the 85-100% band, so they cannot be an index. A row here is worth more as a fence than as a defect: it says the group must be split before any of it is worked, and that the Floette forme/stat mismatch (`floetteeternal` in the party key against `floette-mega` on the switch line) is ruled out FIRST. Without it somebody spends an evening on `dmgRange`. |

---

## 6. WHAT IS OWED

- **`node engine/register_reality.js` must be re-run by whoever owns the next gate pass.** #403 still
  sits in the clause's `staleRows` column because `data/register-reality.json` carries its old green
  verdict with a `cmd`. The artifact is generated and **was not hand-edited**; the next run will move
  the row to `debt`. I did not run it: it `execFileSync`s every marker it finds, and this brief
  forbids running anything that plays a game.
- **Two `INSTRUMENT OWED` debts were declared and neither exists yet.** (a) a probe staging Sucker
  Punch into a live Follow Me / Rage Powder user under pinned dice, asserting `-fail` on both engines;
  (b) a probe staging Triple Axel and Population Bomb under pinned dice, asserting the same `acc`
  draws **at the same addresses**. Until they exist, both rows are debt and cannot hold a gate shut.
- **#463 needs a look it did not get here.** It closed the `stall` counter at board-material 2 of 961
  on release `667278050dcf`; the same leaf reads 6 of 961 on `8ad06030e129`. Same pool and census pin,
  same arm. That is either a regression or an Encore clause #463 never covered, and **nothing in the
  register currently says which.**
- **Three mechanisms remain unfiled** — M4's residue, M8's wrong-body half, M2's multiplier half. See
  section 5.
- **`node engine/status.js --write` was NOT run, deliberately.** It restamps the `<!-- GENERATED -->`
  blocks in every division ledger, and `docs/ENGINE.md` is owned by another agent right now — a
  restamp mid-edit is the concurrency hazard one bullet down, executed on purpose. It is owed once the
  fix batch in flight settles, and it belongs to whoever runs that pass, not to this one.
- **A concurrency hazard, reported and not acted on.** `docs/ROADMAP.md` is being written by more than
  one agent this session (#535-#540 and #218 are other agents' uncommitted rows in the same file). My
  three edits are surgical string replacements over a file read seconds earlier and no other row moved,
  but a full-file rewrite by anyone else would silently drop one side's work.
