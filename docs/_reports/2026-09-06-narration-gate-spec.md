# THE NARRATION GATE — SPECIFICATION

MEASURE, 2026-09-06. Design only; nothing was run, nothing outside this file was written.

## 0. PROVENANCE OF EVERY NUMBER BELOW

Every count is computed from `git show 324ae2b8:data/game-differential.json`, extracted to a
scratch copy and read there. **The live `data/game-differential.json` was last written at 04:19,
the minute this analysis was running**, by the ENGINE agent; it was not read. Shape composition
is computed by calling `engine/divergence_shape.js` (the project's one implementation of "what do
these two lines disagree about") rather than by a second classifier written here.

Artifact under analysis: release `db248fe67a5e`, 961 games, cap 20, arm `middle`,
`empirical-click/v1`, census pin `9446a684709d`, pool `data/team-pool-frozen` (digest `0d103fb9fa87`,
8778 teams), instrument digest `driver_code = 0c1fc935a5fb`, `driver_code_stable: true`,
`planted_divergence_proof_ok: true`, `undeclared_event_drops: 0`.

**The trap named in the brief is real and I hit its sibling.** `by_cause_totals.games_board_material`
= **46**; the board clause quantity is `state.games − state.games_board_never_diverged` = 961 − 911
= **50**. The gap is exactly the 4 games that part a board with the protocol identical all game, so
they have no cause to attribute. Both numbers are correct and they answer different questions.

---

## 1. THE 151, CHARACTERISED

`classes[].causes[].n` sums to **151 over 130 distinct causes** and reconciles with `arms[0].diverged`,
`state.protocol_diverged_games` and `end_state[0].summary.by_cause_totals.games`. It is the
POPULATION. `first_divergences` (60 rows) and `state.first_board_divergences` (40 rows) are capped
SAMPLES and were not used for any count here.

### 1.1 The four classes the brief asked for, computed

`classify()` in `engine/game_differential.js:5142-5160` already decides exactly this question, and it
decides it mechanically:

```js
const sdLater = meAt.indexOf(sdHead) > 0;    // showdown's line turns up later on our side
const meLater = sdAt.indexOf(meHead) > 0;    // our line turns up later on showdown's side
if (sdLater && meLater) cls = 'ordering';
else if (sdLater)       cls = 'extra event emitted by medicham2';
else if (meLater)       cls = 'event missing from medicham2';
else if (sdEv === meEv) cls = <field / different body / turn order>;
else                    cls = 'unrelated event mismatch';
```

So the class names are not labels, they are the answer. Counts:

| # | Class the brief named | The artifact's class | of 151 | narration-only | board-material |
|---|---|---|---:|---:|---:|
| 1 | **a line we never emit** | `event missing from medicham2` | **68** | 53 | 15 |
| 3a | **emitted at the wrong point** — we insert a line the authority has not got there | `extra event emitted by medicham2` | **28** | 18 | 10 |
| 4 | **ordering between two lines we both emit** | `ordering` | **23** | 21 | 2 |
| 2 | **emitted with a wrong field** | `-fail field 3` (3), `-damage field 3` (2) | **5** | 3 | 2 |
| 2b | wrong field 2 — a different body | `-crit: a different body` | **1** | 0 | 1 |
| 5 | *neither line relates to the other* | `unrelated event mismatch` | **20** | 9 | 11 |
| 6 | *one stream stopped* | the two truncation classes | **6** | 1 | 5 |
| | | **total** | **151** | **105** | **46** |

Classes 5 and 6 are not in the brief's taxonomy and must not be folded into it. Class 5 is the
comparator saying it could not relate the two lines; on inspection most of it is a **rule**
disagreement (`-boost|atk|1` vs `-unboost|atk|1`, `cant|par` vs `move`, `-activate|protect` vs
`-immune|[from]goodasgold`, `-status|slp|[from]sleeppowder` vs `-miss`), and **11 of the 20 part a
board.** Class 6 means everything the authority did afterwards is unmeasured, which is worse than
different; **5 of the 6 part a board.**

### 1.2 THE SEPARATION BETWEEN CLASS 1 AND CLASS 3 IS A TEN-LINE WINDOW, AND THAT MUST BE SAID

`sdAfter: a.slice(i, i + 10)` (`game_differential.js:4046`). `sdLater`/`meLater` are decided over
**ten compared lines**. So class 1 means *"not emitted within the next ten lines"*, not *"never
emitted"*, and a reordering wider than ten lines is scored as class 1 **and** class 3 in two
different games rather than as an ordering. Any sentence of the form "68 lines we never emit" is
wrong by that much. This is a limit of the instrument, not of the engine, and it is not currently
stamped anywhere.

### 1.3 Shape composition, from `divergence_shape.js` (the canonical module)

EMISSION 72, RULE 53, FIELD 10, ORDERING 10, UNPARSED 6. Note this does **not** agree with the class
table above and is not supposed to: `shapeOf` asks *"do these two lines share an event or a slot"*
and `classify` asks *"does either line turn up later on the other side"*. Both are computed, both
are published, and quoting one under the other's name is the ROADMAP #292 failure in a new costume.

### 1.4 THE TWO NAMED GAPS ARE NOT IN THE 151, AND THAT IS THE MOST IMPORTANT FINDING IN THIS SECTION

`fairyaura` and `unnerve` appear **zero times** in the whole artifact. `docs/ENGINE.md:258-260` says
plainly that this engine emits neither `|-ability|<x>|Fairy Aura` on the carrier's entry or mega, nor
`|-ability|<x>|Unnerve` on a switch-in, and that both are measured and unfixed.

They are absent because **a first-divergence is a CENSORED observation.** Under `--end-state` the game
plays on past the divergence (`game_differential.js:4135`) but `firstDiv` is written once
(`:4420 if (!firstDiv && pd)`) and every later `pd` is discarded. A defect that is never the earliest
disagreement in any game is invisible to `diverged` no matter how often it fires.

**Consequence for the gate: any count taken off `first_divergences` or `classes` is a LOWER BOUND on
the number of narration defects, and the gate must print that word.** A gate that can read zero while
two named, measured, unfixed non-emissions are still in the engine is not a gate; it is the
fourteen-stale-handoffs failure with a green light on it.

### 1.5 What the 105 narration-only games actually are

Bucketed by the line at issue (games / distinct causes):

| games | causes | the line |
|---:|---:|---|
| 22 | 16 | **`-fail` not emitted.** Fifteen of the sixteen are followed on our side by an end-of-turn line (`upkeep`, `-weather …[upkeep]`, `-heal …leftovers`, `faint`, `-sideend`) — a move that failed as the last action of a turn and we said nothing |
| 17 | 4 | **Struggle's `-activate`** (one cause per slot). Named, owed, needs `data/tags.json` regenerated |
| 8 | 8 | **Poltergeist announced at use time** where the authority announces inside `onTryHit` |
| 4 | 4 | **Levitate immunity** — `\|-immune\|pXY` vs `\|-immune\|pZW\|[from]levitate`, spread-move immunity announced for a different body |
| 4 | 4 | **`-boost\|atk\|0`** — the authority emits a zero-magnitude boost line, we suppress it |
| 3 | 3 | **`-fail` field 3** — we write bare `\|-fail\|pXY` where the authority carries `substitute\|[weak]` or `allyswitch` |
| 3 | 3 | **`-hitcount\|1`** emitted where the authority emits none |
| 3 | 3 | **Supreme Overlord** announced before the `\|switch\|` lines |
| 4 | 4 | **freeze/thaw** — `-damage …frz` vs `-curestatus frz`, two missing and two extra |
| 2 | 2 | `detailschange\|aegislash` on faint |
| 2 | 2 | **Good as Gold vs Protect** precedence (probably a rule, not narration) |
| 2 | 2 | Mega Sol `-activate` |
| 2 | 2 | White Herb vs mega `detailschange` order |
| ~29 | ~29 | singletons: substitute end/damage order, Lightning Rod vs `-prepare`, Rough Skin vs Poison Touch, Quick Claw, Flash Fire end, Future Sight end, `faint` vs `upkeep`, `-supereffective` order, Instruct/Rage Powder/Psychic Terrain `-singleturn`, and ~19 more |

Mean 1.22 games per cause; **36 of the 86 narration-only causes occur exactly once.**

---

## 2. HOW MANY OF THE 151 ARE ALREADY DECLARED

**Zero.** Three separate declaration mechanisms exist; here is what each one does and what it took.

### 2.1 `data/protocol-events.json` `notEmitted[]` — 50 rows. STRUCTURALLY CANNOT APPEAR IN THE 151

This is the mechanism `tests/test-game-differential.js` PART 4 guards. It drops a Showdown line from
the stream **before alignment**, at EVENT-KIND granularity
(`game_differential.js:2089`, keyed on `String(l).split('|')[1]`). A declared kind therefore never
reaches the aligner and cannot produce a divergence. All 151 are drawn from the **44 kinds medicham2
CLAIMS** (`emitted[]`). `declared_gaps.undeclared_event_drops` reads **0** and `undeclared_events` is
empty, so nothing was dropped silently on this run.

**Is it derived?** Half. The event UNIVERSE is derived — scanned from `sim/battle.ts`,
`battle-actions.ts`, `pokemon.ts`, `side.ts`, `field.ts`, `battle-queue.ts`, the five `data/` files,
the five `data/mods/champions/` files and `SIM-PROTOCOL.md`, with the mod's arity winning. The
PARTITION is not: `NOT_EMITTED` is a **hand-typed reason table of ~80 entries** in
`engine/derive_protocol_events.js:135-330`. Its `UNDECLARED` gate makes it self-correcting when
Showdown adds an event; it is **not** self-correcting when a reason quietly becomes false, and that
has already happened twice in this repository (`-zbroken`, `-formechange`), both caught by a human
reading the sentence.

**Say loudly:** the artifact's own header comment at `game_differential.js:36` says *"36 emitted here,
58 declared-not-emitted, 10 partial shapes"*. The file on disk says **44 / 50 / 10**. The prose is
stale by 8 and 8. Reported, not touched.

### 2.2 `partial[]` — 10 rows. NOT SUBTRACTED ANYWHERE, AND IT MUST STAY THAT WAY

Also hand-typed, in the same file. Three of the ten are prose descriptions of exactly the ordering
differences this gate would count:

- `|-damage|` — *"ORDER WITHIN A HIT DIFFERS. medicham2 resolves the knock-off, the resist berry and
  the contact punish BEFORE subtracting the target's HP"*
- `|-heal|` — *"the pinch berries fire in the END-OF-TURN residual here and on the `onUpdate`
  immediately after the hit in Showdown. Same turn, different position in the stream."*
- `|-crit|` — *"a spread move's per-target effectiveness and crit lines INTERLEAVE with its damage
  lines here; Showdown batches all of them ahead of the damages"*

Wiring `partial[]` into the clause as a subtraction would remove a large fraction of the ordering and
emission buckets **on the strength of a sentence somebody typed, with no measurement behind it.**
It is the single cheapest way to make this gate meaningless. It is documentation. §5 says what a
narration declaration must cost instead.

### 2.3 `DECLARED_DIVERGENCE` in `engine/quarantine.js:1554` — **TWO ROWS, ENTIRELY HAND-TYPED, AND IT SUBTRACTS NOTHING ON THIS ARTIFACT**

| row | kind | matches on this artifact |
|---|---|---|
| Supreme Overlord `fallenundefined` | `AUTHORITY-WRONG` | **0** — `fallenundefined` does not occur in any of the 130 causes |
| the perish drain sits above `\|upkeep\|` | `CLOSETED` | matches the cause `event missing from medicham2 :: \|upkeep <> \|faint\|p1a` (1 game) and then **DECLINES** |

**Why the second one declines, and this is a defect in the gate rather than in the engine.** Its
matcher requires evidence: every `first_divergences` row for that cause must carry a `perish0` line
in `showdown_before`. `causeEvidence` (`quarantine.js:1537-1547`) builds that index **from
`j.first_divergences`, which is capped at 60 rows**. The cause's row is not in the 60, so
`rows.length === 0`, and the matcher's own contract — *"NO EVIDENCE IS A DECLINE, NEVER A MATCH"* —
returns false.

**Measured: only 52 of the 130 distinct causes, covering 66 of the 151 games, appear in
`first_divergences` at all.** So an evidence-needing declaration is honoured or refused depending on
whether its cause happened to fit in a capped list — **57% of the population cannot be declared at
all right now.** It fails in the safe direction (declines → counted undeclared → gate stays shut),
which is why nobody has been bitten, but it makes the declared count a function of the cap rather
than of the decision.

`data/decision-impact.json` **does not exist** (not on disk, not in `324ae2b8`), so the second
subtraction path — `DI.clear('cause:…')` — clears 0 by refusal.

### 2.4 Therefore

**declared 0, decision-cleared 0, undeclared 151 of 151** — or on the quantity proposed below,
**undeclared narration-only 105 of 105.**

---

## 3. THE GATE CLAUSE

### 3.1 The quantity, and why it is not `j.diverged`

`j.diverged` = 151. **46 of those 151 games also part a board and are already the BOARD-MATERIAL
clause's business.** A narration gate on 151 would be 30% a second copy of the gating clause, and
would be tightened or loosened by work that has nothing to do with narration.

The artifact already computes the disjoint split, per cause, and reconciles it:

```
end_state[0].summary.by_cause_totals
  causes 130   games 151
  BOARD_MATERIAL 44 causes / games_board_material 46
  NARRATION_ONLY 86 causes / games_narration_only  105
  UNKNOWN 0 / games_unknown 0
  by_cause_reconciles: true
```

**Quantity: `end_state[0].summary.by_cause_totals.games_narration_only`, less declared, less
decision-cleared.** Today: **105 − 0 − 0 = 105.**

Two properties this buys that `diverged` does not:

- **Disjointness is computed, not asserted.** 105 + 46 = 151, `by_cause_reconciles: true`. The two
  clauses cannot both take credit for one game.
- **The 4 games that part a board with the protocol identical all game have no cause**, so they
  belong to the board clause and to nothing else. This is exactly why the two clause quantities
  (50 and 105) cannot be derived from each other and why neither may be recomputed from the other.

**The caveat rides with the number, in the print.** The artifact says it itself:

> NARRATION-ONLY is bounded by board_state.js NOT_COMPARED (published in this artifact as
> `end_state_not_compared`) and by the turn cap: a board that would part after the cap reads as
> narration here.

Nine leaves are in `end_state_not_compared` and the cap is 20. So the honest name is **"no board
effect among compared leaves, within the cap"**, never "cosmetic". And the count is a **LOWER BOUND**
for §1.4's reason.

### 3.2 The threshold: ZERO undeclared narration-only games

Justified from the counts, not from principle:

1. **86 causes over 105 games; 36 causes occur exactly once.** A tolerance of "≤5 games" or "≤2% of
   games" is cleared by fixing the four largest mechanisms (`-fail` 22, Struggle 17, Poltergeist 8,
   Levitate 4 = 51 games) **and leaving roughly 36 distinct, undiagnosed causes standing.** The
   failure mode this repository has is not a large number; it is a long tail nobody looks at. A rate
   threshold hides a tail by construction. Zero is the only threshold a tail cannot sit under.
2. **There is no sampling noise to absorb.** Mode A pins accuracy, crit, secondary, damage and stall
   on both sides; both engines are deterministic functions of one input. `noise floor` is not the
   argument for a tolerance here because the floor is exactly zero on a re-run of identical pins —
   the 5.257.0 pass demonstrated it, six runs bit-identical within each side of an edit. Any non-zero
   threshold would be a number somebody chose, and §5 is about numbers somebody chose.
3. **The counter-argument has a real receipt and is answered by declaration, not by tolerance.** A
   clause red for weeks is one people learn to skip; `tests/test-docs-current.js` sat red for two
   days as "one of the two known failures" and the rule it guarded then broke. The answer to that is
   the CLOSETED path — a dated owner ruling, an instrument, a release, a falsifier — which costs
   somebody looking at the cause. A tolerance costs nobody anything and absorbs things nobody has
   looked at. That is the whole difference.

### 3.3 WHEN IT STARTS GATING — COMPUTED, NEVER REMEMBERED

Will's ruling was *board-material now, narration as its own separate gate **afterwards***.
"Afterwards" is currently nowhere in code; it is a sentence in a comment
(`quarantine.js:2682-2700`) explaining why `gates: false`. That sentence is what "we'll do narration
later" looks like at the moment it becomes permanent.

**Encode "afterwards" as a condition on the other clause:**

```js
gates: boardMaterialClauseIsPassing
```

The narration clause begins holding the gate shut **exactly when the board-material clause reads
zero**, automatically, with nobody deciding. Until then it computes, prints its count and its
verdict, and exits non-zero on its own through `--narration` — which is what it does today. This
honours the ruling literally, removes narration from the critical path exactly as long as the ruling
intended, and makes it impossible to abandon: there is no step where a person has to remember to turn
it on.

### 3.4 What it prints when it fails

Same shape as the existing clauses. It must say the quantity, the split, the bound and which clause
is failing:

```
  whole-game differential / NARRATION — protocol divergence with no board effect      FAIL
    105 of 961 games (10.9%) diverge in narration and never part a board, across 86 causes.
    declared 0   decision-cleared 0   UNDECLARED 105
    THIS IS A LOWER BOUND: a game records only its FIRST divergence, so a defect that is never
    earliest is not counted here. Two are named and measured and do not appear in this number —
    no |-ability|<x>|Fairy Aura on entry or mega, no |-ability|<x>|Unnerve on a switch-in.
    BOUNDED BY: board_state.js NOT_COMPARED (9 leaves, see end_state_not_compared) and the
    turn cap (20) — a board that would part after the cap reads as narration here.
    NOT the board clause: 46 further games diverge in narration AND part a board; those are
    counted by whole-game differential / BOARD-MATERIAL and are not counted here.
    GATES: no — the BOARD-MATERIAL clause is still failing (50 of 961). This clause begins
    gating automatically when that one reads zero. Will, 2026-08-22.
    LARGEST: -fail not emitted 22/16c · Struggle -activate 17/4c · Poltergeist announced at
    use time 8/8c · Levitate immunity order 4/4c · -boost|atk|0 4/4c
    THE REGISTER, matched or not: [2 rows; CLOSETED 1]
      0  Supreme Overlord `fallenundefined`  — matched nothing this run
      0  the perish drain sits above `|upkeep|`  — MATCHED a cause worth 1 game and DECLINED:
         its evidence predicate reads first_divergences, which is capped at 60 of 151 rows
         and does not carry that cause. 52 of 130 causes are in the cap.
```

### 3.5 The diff, in the shape the file already uses

`engine/quarantine.js`. Nothing here reimplements an existing rule; the door, the declared matcher,
the register printer and the decision-impact filter are all reused unchanged.

```diff
+/* THE NARRATION QUANTITY IS THE ARTIFACT'S OWN BY-CAUSE ATTRIBUTION, NOT `diverged`.
+ * Measured 2026-09-06 on release db248fe67a5e: `diverged` is 151 and 46 of those games ALSO part a
+ * board, which the BOARD-MATERIAL clause already counts. A narration clause on 151 is 30% a second
+ * copy of the gating clause. `by_cause_totals` splits it, reconciles it (`by_cause_reconciles`) and
+ * publishes the bound it rests on, so this reads the split rather than recomputing it. */
+function narrationOnlyRows(j) {
+  const es = Array.isArray(j.end_state) ? j.end_state[0] : null;
+  const sum = es && es.summary;
+  const t = sum && sum.by_cause_totals;
+  if (!t || t.by_cause_reconciles !== true || !Array.isArray(sum.by_cause)) return null;
+  return { rows: sum.by_cause.filter((r) => r.materiality === 'NARRATION-ONLY'),
+           games: +t.games_narration_only || 0, causes: +t.NARRATION_ONLY || 0,
+           boardGames: +t.games_board_material || 0, bound: t.bounded_by || null };
+}

 function narrationClause(artifact, wgDecisionImpact) {
   const r = narrationVerdict(artifact, wgDecisionImpact);
   if (!r || typeof r !== 'object') return r;
-  return Object.assign({ quantity: 'protocol_first_divergence_games' }, r, { gates: false });
+  /* `gates` IS COMPUTED, NOT TYPED. Will, 2026-08-22: board-material now, narration as its own
+   * separate gate AFTERWARDS. "Afterwards" was a sentence in a comment, which is what "we'll do
+   * narration later" looks like the moment it becomes permanent. It is now the board clause's own
+   * verdict, so this clause starts holding the gate shut the instant that one reads zero and
+   * nobody has to remember to switch it on. */
+  const wg = wholeGameClause(artifact);
+  const gates = !!(wg && wg.ok === true);
+  return Object.assign({ quantity: 'narration_only_undeclared_games' }, r,
+                       { gates, gates_because: gates
+                           ? 'the BOARD-MATERIAL clause passes, so narration now gates (Will, 2026-08-22)'
+                           : 'the BOARD-MATERIAL clause is still failing, so narration reports only '
+                             + '(Will, 2026-08-22) — this flips automatically, it is not a decision' });
 }
```

Inside `narrationVerdict`, after the existing door / zero-games / planted-proof exits:

```diff
+  const NO = narrationOnlyRows(j);
+  if (!NO) {
+    /* WITHHELD, NOT FAILED. An older artifact predates `by_cause_totals`, or its own reconciliation
+     * flag is false. Failing on that would be a claim about the engine made out of a fact about the
+     * writer — the caption-is-not-a-quarantine rule pointed the other way. */
+    return { name: NAME, ok: false, withheld: true, generated: j.generated || null, pins: WGRCPT,
+      why: 'THIS ARTIFACT CARRIES NO RECONCILED by_cause_totals, so narration-only cannot be told '
+         + 'from board-material and `diverged` (' + div + ') is 30% the other clause. Re-run: '
+         + 'SHOWDOWN_PATH=... node engine/game_differential.js --games 961 --end-state --write' };
+  }
```

and the declared loop reads `NO.rows` instead of `j.classes[].causes[]`:

```diff
-  for (const c of (Array.isArray(j.classes) ? j.classes : [])) {
-    for (const k of (c.causes || [])) {
+  for (const k of NO.rows) {
+    {
       const d = declaredMatch(k.cause, EV, MATCHER_THREW, WGCTX);
-      if (d) { declaredGames += (k.n || 0); ...
+      if (d) { declaredGames += (k.games || 0); ...
```

with `const undeclared = Math.max(0, NO.games - declaredGames - impactGames);` and
`const ok = undeclared === 0;` unchanged in form.

### 3.6 Two instrument repairs the clause needs, both cheap, both ENGINE's to land

- **`causeEvidence` may not read a capped list.** Either `game_differential.js` writes an uncapped
  `first_divergences` for causes a declaration names, or — simpler and strictly safer — the clause
  REFUSES (withheld, not failed) when a declared matcher's cause is present in `by_cause` and absent
  from `first_divergences`, and says so by name. Today that silently costs the perish row its
  declaration and would cost any future one a coin flip: **52 of 130 causes are in the cap.**
- **`data/protocol-events.json` is in no digest set.** Not in `engine_release` SOURCES, not in
  `steering.driver_code.files`, not in `source_digests` — and `driver_code.does_not_cover` says so
  in as many words: *"data/protocol-events.json (read as data, not required)"*. It is the skip list
  that decides which Showdown lines are removed before alignment. Edit it and the sample changes
  while `driver_code_stable` stays `true`. That is the 5.257.0 lesson — a named limit is not a guard
  — on the one file this gate's meaning rests on. It should be in `driver_inputs` with a digest, and
  `arms_comparable.js` should refuse a pair that spans a change to it.

---

## 4. WHAT IT COSTS TO GET TO ZERO

Counted over the **86 narration-only causes / 105 games**, not the 151.

**Named mechanisms — 12 fixes, ~70 games (67% of the count):**

| games | fix | size |
|---:|---|---|
| 22 | `-fail` not emitted, dominated by a move that fails as the last action of a turn | **real work** — 16 causes, plausibly 2–4 distinct sites; needs the failure paths enumerated before anything is written |
| 17 | Struggle's `-activate` | **one-liner blocked on a regen** — named in `docs/ENGINE.md`, needs `data/tags.json` regenerated |
| 8 | Poltergeist announces at use time, authority announces inside `onTryHit` | **one move of an emit site** |
| 4 | Levitate immunity announced for a different body under a spread move | **small** — one attribution/order site |
| 4 | `-boost\|atk\|0` — the authority emits a zero-magnitude boost line | **one-liner** — remove a `!== 0` guard on the emit |
| 3 | `-fail` field 3 (`substitute\|[weak]`, `allyswitch`) | **one-liner** — pass the third argument |
| 3 | `-hitcount\|1` emitted where the authority emits none | **one-liner** — gate the emit on hits > 1 |
| 3 | Supreme Overlord announced before the `\|switch\|` lines | **small** — move one emit below the entry block |
| 4 | freeze/thaw: `-damage …frz` vs `-curestatus frz` order | **small** — one ordering site, 2 missing + 2 extra |
| 2 | `detailschange\|aegislash` emitted on faint | **one-liner** |
| 2 | Mega Sol `-activate` | **small** |
| 2 | White Herb vs mega `detailschange` order | **small** |

**Two named gaps that this count cannot see** (§1.4) — Fairy Aura's `-ability` on entry/mega and
Unnerve's on switch-in. Both **small** (an announce at an existing hook), both need a probe to carry
them because the gate cannot.

**Two that are probably not narration at all:** Good as Gold vs Protect precedence (2 games) and the
`-boost`/`-unboost` sign pair (board-material, 2 games) look like rule disagreements. They should be
routed to ENGINE as rules and will leave the narration count when they are fixed, not before.

**The tail: ~29 singleton causes, ~29 games.** Each needs its own diagnosis. On the evidence of the
last two nights — Big Root, Leech Seed, Fairy Aura, Beat Up — a singleton here costs somewhere
between an hour and an evening, and some will collapse into the named mechanisms once those land
(several `faint ~ upkeep` and `-end|substitute` rows look like the same residual-follower ordering as
the already-CLOSETED perish drain).

**Honest total: 12 named fixes plus roughly 25–30 singleton investigations, call it 37–42 distinct
fixes.** Of those, **6 are genuine one-liners worth ~15 games**, the `-fail` family is the one large
piece of real work at 22 games, and the rest is a tail. There is no version of this that is a week.
Two more nights at the rate of the last two would plausibly clear the named twelve and leave the
tail; the tail is the schedule.

---

## 5. WHAT THIS GATE MUST NOT DO

### 5.1 It must not fire on cosmetic churn

Three churn sources and the design answer to each:

- **A class rename or a normaliser respelling.** The quantity is a COUNT OF GAMES carrying
  materiality `NARRATION-ONLY`, not a set of strings. Re-spelling every cause moves it by zero. (The
  perish row's own comment already refuses to pin a class prefix for the same reason.)
- **A pool, census or pin change.** `wholeGameDoor` already refuses on pin/steering/mode mismatch and
  the clause already withholds the trend when `base.mode !== j.mode`. `driver_code_stable !== true`
  voids the run upstream. §3.6 closes the one hole left — `protocol-events.json`.
- **A ratchet.** There is none, deliberately. `progress`/`regressed` stay reporting-only, exactly as
  they are now: direction of travel is useful and may not open a gate.

### 5.2 It must not be a second copy of the board-material clause

Measured: **46 of the 151 games are board-material.** A gate on `diverged` duplicates 30% of the
other clause. This one reads `games_narration_only` = 105, which is disjoint by construction and
verified by the artifact's own `by_cause_reconciles: true`. The two quantities are 105 and 50, and
**neither can be computed from the other** — the board clause's 50 includes 4 games with no cause at
all. Any future refactor that derives one from the other is the bug.

### 5.3 IT MUST NOT BE SATISFIABLE BY DECLARING EVERYTHING — AND THIS IS THE ONE THAT WILL GO WRONG

A declaration mechanism that can absorb any failure is not a gate. Four properties. Three exist; the
fourth is the one this spec adds and it is the load-bearing one.

**(a) The kinds are narrow, and DEFERRED is not one of them.** `DECLARED_KINDS` is exactly
`INCOMPARABLE` / `AUTHORITY-WRONG` / `CLOSETED`. A row with any other kind is counted UNDECLARED and
named on the run (`quarantine.js:2012-2026`). A `CLOSETED` row that cannot produce `closet.by`,
`closet.on` (ISO), `closet.ruling` (≥20 chars), `closet.authority`, `evidence.instrument`,
`evidence.release`, `evidence.on`, `evidence.says` (≥20) and `falsifiedBy` (≥20) is refused at the
door and holds the gate SHUT. Cost of one declaration: a dated owner ruling, a named instrument, a
release id, and a written falsifier. Already built.

**(b) A declaration ages out with the bytes it was measured on.** `closetEvidenceStale` compares the
row's `evidence.release` against the artifact's. Already built.

**(c) Every row prints on every run, matched or not, with its hit count.** `declaredRegisterLine`.
An exemption covering nothing is visible. Already built.

**(d) NEW — A NARRATION DECLARATION MAY ONLY SUBTRACT A CAUSE THE ARTIFACT ITSELF CLASSIFIES
`NARRATION-ONLY`.** This is the property that makes the mechanism structurally incapable of absorbing
the thing it must not absorb.

Every narration declaration makes the same claim underneath: *this line's absence or position moves
no board.* The artifact computes that claim independently, per cause, in `by_cause[].materiality`,
from the board comparison rather than from the declaration. So the clause iterates `NO.rows` —
**narration-only rows only** — and a declared row that matches a `BOARD-MATERIAL` cause subtracts
nothing and is NAMED on the run:

```
  A DECLARED ROW MATCHED A BOARD-MATERIAL CAUSE AND WAS NOT SUBTRACTED:
    `<row name>` matched `<cause>`, which parted a board in 3 of its 3 games.
    A narration declaration asserts no board moves; this artifact measured one that does.
```

Why this is the right guard rather than a cap on the declared share (which is a tolerance in a
different costume, and would refuse a legitimately large declaration): **it is the same falsifier the
one real CLOSETED row already writes by hand** — clause (b) of the perish row's `falsifiedBy` is
*"the board claim failing — `state.games_board_never_diverged` below `state.games` …"*. This
promotes that sentence from prose into a check the run performs on every row, every time. A
declaration cannot outlive its premise, and the moment a declared cause starts parting a board the
row stops applying and lights up.

**And it cannot be gamed by writing `match: () => true`,** because such a row would immediately match
board-material causes and be named by the check above on the same run.

**What is explicitly refused:** wiring `protocol-events.json` `partial[]` (§2.2) into the clause as a
subtraction. Ten typed sentences that would silently remove most of the ordering and emission
buckets. Prose is not evidence. `docs/LESSONS.md` §10 in one line: *a JSON file on disk looks equally
authoritative whether it was generated this morning or before the filter that made it wrong.*

---

## 6. FOUND IN PASSING — REPORTED, NOT TOUCHED

1. `engine/game_differential.js:36` says *"36 emitted here, 58 declared-not-emitted, 10 partial"*.
   `data/protocol-events.json` says **44 / 50 / 10**. Stale prose beside a derived artifact.
2. `data/protocol-events.json` is in no digest set anywhere (§3.6). `driver_code.does_not_cover`
   already names it.
3. The perish-drain CLOSETED row is currently declining on a cause it matches, because
   `causeEvidence` reads a capped list (§2.3). Fails safe; still wrong.
4. `data/decision-impact.json` does not exist, so `DI.clear()` clears everything by refusal and
   `decision_cleared` is structurally 0. Not a defect; worth knowing before anyone quotes the field.
5. `steering.driver_code.unresolved` carries four entries, one of which is a require path parsed out
   of a **comment** (`'engine/game_differential.js -> ./engine/\r\n * game_differential.js'`). Cosmetic,
   but it means the closure scanner is reading comments as code.
