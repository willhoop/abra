# The board-material set — four mechanisms, four games, and board-material moved for the first time in four passes

2026-08-24. ENGINE. A dated findings record, not a living document: it is never maintained and is
superseded by the register rows it feeds.

---

## The verdict

**Board-material went 24 games → 20 (23 causes → 19). Narration did not rise: 19 games / 18 causes
both sides. Census 677 → 681 live, 0 missing.** Arm `middle`, 961 games, `--team-store
data/team-pool-frozen`, census pinned to `data/verification/census-pin-9446a684709d.json`, release
**`fbf74de3fbd6`** (the before-arm is release `2535a9c59886`, which is HEAD).

Four games cleared. **Zero new diverging games, and no game merely changed its label** — the
game-by-game diff on `config|seed` is the attribution, not a net.

| what was wrong | games cleared | probe |
|---|---|---|
| **Role Play did nothing at all** — a whole move resolving to a spent turn | 2 | `move/copiesTargetAbility` |
| **A body dragged off the field still took its turn** from the bench | 1 | `move/forcesSwitch` |
| **A single-target STATUS move walked past Follow Me / Rage Powder** | (see below) | `move/redirects` |
| **Two redirectors on one side: we took the one in the lower slot, the game takes the faster** | 1 | `move/redirects` |

The last two are one game between them and are reported as a pair below, because the first was
measured NOT to clear it on its own.

---

## 1. Role Play was a whole move doing nothing — 2 games

`playerAction` classifies a click by walking ~40 tag branches and returning the first that matches.
Role Play carried `[pp, targetClass, neverMisses, ignoresProtect, statusCategory]` — an accuracy, a
category and a Protect flag, and **no effect at all** — so it fell past every branch and came out
`{kind:'pass'}`. 40 corpus uses of a turn that changed nothing.

**The artifact had nothing to route on, and that is the actual defect.** `tag_dex.js` already derived
`rewritesTargetAbility` by reading `target.setAbility(...)` out of the handler — Entrainment, Simple
Beam, Worry Seed. Role Play is the only legal move that writes to `source`, so the existing pattern
could never match it.

**Membership printed over the whole legal move table before anything was wired**, as the working rule
requires. Exactly four legal moves call `setAbility` at all:

```
entrainment   target.setAbility(source.ability, source)
roleplay      source.setAbility(target.ability, target)     <- the only one writing to the USER
simplebeam    target.setAbility("simple")
worryseed     target.setAbility("insomnia")
```

So the new tag `copiesTargetAbility` is Role Play and nothing else today, and a fifth member arriving
next regulation is caught by the shape rather than by a name.

**The derivation was wrong before the engine was, and printing the params is what caught it.** The
first cut of the refusal regexes read `flags['failroleplay']` — the TypeScript spelling. The dex is
loaded from `dist/`, where it is compiled to `flags["failroleplay"]`, so both refusals came back
`null` and the tag would have shipped refusing nothing. It printed
`{"failsIfSame":true,"targetFlagRefuses":null,"userFlagRefuses":null}` and the null was the tell.

The three refusals are the handler's own, in the handler's order (`data/moves.ts:15327`):

```
if (target.ability === source.ability) return false;                    -> failsIfSame
if (target.getAbility().flags["failroleplay"]) return false;            -> targetFlagRefuses
if (source.getAbility().flags["cantsuppress"]) return false;            -> userFlagRefuses
```

Both flags are answered from `refusesCopy`, which is the one place this artifact records who may not
be copied — the same row Trace consults.

**Why no protocol line ever said so.** `|-ability|` is dropped as cosmetic by the whole-game
comparator (`game_differential.js`'s reducer, with its own written reason), so a successful Role Play
is invisible in both streams. The two games diverged a turn or more LATER, on the authority's
`|-fail|` when Mr. Rime tried to copy an ability it already held. **The board was the only witness**:
`p2.party.mrrime.ability` read `screencleaner` against the authority's `lightningrod` in one game and
`hospitality` in the other.

**The probe.** `move/copiesTargetAbility`, four arms on one board. A Milotic with Marvel Scale clicks
Role Play at a Garchomp, then the Garchomp clicks Earthquake at the Milotic. The consequence is a
Ground move at the USER — a label that moves proves an assignment happened; an immunity that appears
proves the copied ability is LIVE. Pre-fix all four arms read `[marvelscale, 93]`, which is the
unwired-knob signature. Post-fix:

```
NO CLICK                    [marvelscale, 93]
into a Levitate body        [levitate, 0]      and the target still holds levitate — a copy, not a swap
into the user's OWN ability [marvelscale, 93]  failsIfSame
into a failroleplay carrier [marvelscale, 93]  Zero to Hero, read out of tags.json, inert on this board
```

---

## 2. A body dragged off the field still took its turn — 1 game

`Battle#runAction` opens with two refusals and this engine only ever had one:

```
case 'move':
  if (!action.pokemon.isActive) return false;      <- MISSING
  if (action.pokemon.fainted) return false;        <- present
```

So a body phazed out by Roar, Whirlwind, Dragon Tail or Circle Throw came back later in the same turn
and used its move **from the bench**.

**It printed itself in this engine's own emitter and nobody read it**: `|move|??: farigiraf|roar|p2a:
Farigiraf`. The `??:` is `ident()` saying the mover holds no slot. That phantom Roar then dragged the
other side's lead out, so the two engines finished the turn with different Pokemon standing.

The refusal is SILENT — the authority's `return false` emits no `-fail` and no `cant`. The guard is
counted with its first witness, because a guard that started firing on every action would be
indistinguishable from a quiet engine. **Measured over 699 pinned games: it fires exactly once,
witness `farigiraf/roar`.**

`isActive` needed no new flag: `switchOut` already does `act[i]=nx`, so the leaver's index in the
active array goes to −1 the instant it is gone.

**The probe** is a priority sandwich rather than a speed one, so nothing rests on a tie: Incineroar
clicks Trick Room (priority −7), the foe clicks Roar (−6), so the drag ALWAYS resolves first and the
victim's action is ALWAYS still pending. The consequence is read off the field — `field.tr` is set or
it is not.

```
pre-fix    foe passes [incineroar, true]   foe roars [snorlax, TRUE]    <- the room went up from the bench
post-fix   foe passes [incineroar, true]   foe roars [snorlax, false]
```

---

## 3 and 4. Redirection — 1 game, and it took both halves

### 3a. A status move was never redirected at all

`Pokemon#getMoveTargets` runs the `RedirectTarget` event in its `default:` case
(`sim/pokemon.ts:829`) — **every single-target move, damaging or not** — and `useMoveInner` calls it
once for every move it resolves. This engine asked only inside the ATTACK branch, so a Glare, a
Will-O-Wisp, a Taunt or a Thunder Wave walked past a Follow Me and landed on the body behind it.

Measured: an Arbok's Glare crossed a Maushold's Follow Me and paralysed the Blaziken behind it —
`|-status|p1b: Maushold|par` against this engine's `|-status|p1a: Blaziken|par`, and the wrong body
then carried paralysis for the rest of the game.

**One fact, one implementation.** The draw was extracted out of the attack branch into
`redirectDrawnTo()` and both sites now call it. The attack branch keeps its own ANNOUNCEMENTS, because
they are the only site that knows where its `|move|` line is.

**The non-attack draw runs at the dispatch choke point and moves `tgtSlot` as well as `target`**, and
the second is what makes it stick: every branch below re-resolves through `reaimToSlot`, which reads
`it.tgtSlot` and hands back that slot's occupant, so writing only `it.a.target` would be undone by the
first branch that asked.

**Membership is Showdown's own `move.target` value**, off the `targetClass` tag — the five names that
fall through to `default:`. A spread status move never reaches redirection in the authority and does
not reach it here. A move with no tag row is NOT treated as redirectable; it is counted
(`MEDFAILS.redirectAimClassUnknown`, which reads **0** over 699 pinned games), because guessing "yes"
would silently pull a spread move onto one body.

**Lightning Rod's `-activate` is deferred, and that is the authority's position rather than a
convenience.** `useMoveInner` writes `addMove('move', …)` at `:457` and calls `getMoveTargets` at
`:467`, so the line belongs BELOW the move line, while the choke point runs above it. `TR` parks it and
flushes it on the next `|move|` it writes. **The park is cleared at the top of EVERY action, not only
the ones that set it** — the choke point sits above the five BeforeMove gates, so a flinched or
sleeping body can have a draw computed and never write a move line, and the parked line would
otherwise be flushed onto the next body's move, on the wrong side of the field.

### 3b. Between two redirectors, the game takes the FASTER one

`priorityEvent` passes `fastExit`, so `runEvent` sorts the handlers with `Battle.compareRedirectOrder`
(`sim/battle.ts:413`) and takes the first that returns a body:

```
handler priority DESC  ->  holder SPEED desc  ->  (two ABILITY holders) effectOrder asc
```

Follow Me and Rage Powder both declare `onFoeRedirectTargetPriority: 1`; Lightning Rod and Storm Drain
declare none, which is 0. **That is where "the volatile outranks the ability" comes from** — it is the
handler priority and not a rule this engine invented, and it is why the two families stay in two passes
rather than being merged into one sorted list.

Within a family only SPEED separates them, and this engine used `Array.find` over the foe array — slot
order, every time. In the diverging game a Maushold's Follow Me and a Sinistcha's Rage Powder were both
up; the authority sent the Gunk Shot into the Maushold (base 111 Speed) and killed it, and this engine
sent it into the Sinistcha (base 70). **Two engines, two different Pokemon dead.**

It goes through `compareTurnOrder` because the sort key is Trick-Room-inverted UPSTREAM:
`pokemon.speed` is `getActionSpeed()`, which is `10000 - speed` inside a room
(`sim/pokemon.ts:641-648`), and `compareRedirectOrder` then sorts plain descending — so the SLOWER
redirector draws in a room. `compareTurnOrder` is this engine's one implementation of that rule.

**A remaining tie falls back to slot order and that is stated rather than claimed correct.**
`Array.prototype.sort` is stable, so a genuine Speed tie keeps array order. The authority breaks a tie
between two ABILITY holders on `abilityState.effectOrder`; that is NOT modelled, and it needs two rods
of the same type on one side at identical Speed, which the differential has never produced.

**The probe knob is the Speed and nothing else** — the same two bodies, the same two clicks, the same
aimed slot, only the Speed numbers exchanged, plus a Trick Room arm on the first board:

```
pre-fix    A=150 B=50 [85,0]    Speeds exchanged [85,0]    Trick Room [85,0]      <- the same pair three times
post-fix   A=150 B=50 [85,0]    Speeds exchanged [0,99]    Trick Room [0,99]
```

### Which of the two cleared the game

**The status redirect alone did NOT clear it, and that was observed rather than assumed.** With 3a
landed and 3b not, the game still diverged — its first divergence moved from turn 9
(`|-status|p1b: Maushold|par <> |-status|p1a: Blaziken|par`) to turn 11
(`|-damage|p1b: Maushold|0 fnt <> |-damage|p1a: Sinistcha|83/146`). **3b is what closed it.** 3a is
nevertheless exercised in that game: replayed alone at the final release,
`MEDSEEN.redirectedNonAttack` increments by 1.

---

## The numbers — a re-baseline, said first

Arm **`middle`**, **961 games**, turn cap 12, `--team-store data/team-pool-frozen`, census pinned to
`data/verification/census-pin-9446a684709d.json` (digest `9446a684709d`, 643 rows). Before-arm release
**`2535a9c59886`** (= HEAD `ce31ff0`), after-arm release **`fbf74de3fbd6`**. Both arms played the same
961 games in the same order under the same steering, which is what makes the game-by-game diff an
attribution.

| | before | after |
|---|---|---|
| raw protocol divergences | 43 | **39** |
| undeclared (the published headline) | 30 of 961 = 3.1% | **26 of 961 = 2.7%** |
| **BOARD-MATERIAL** | 23 causes / **24 games** | 19 causes / **20 games** |
| NARRATION-ONLY | 18 causes / 19 games | 18 causes / **19 games** (unmoved) |
| DIFFERENT-END-STATE | 18 | **14** |
| census live / probed / missing | 677 / 677 / 0 | **681 / 681 / 0** |

The four cleared, by `config|seed`:

```
pair-protect-bust     ...2657758279  event missing :: |-fail|p1a <> |move|p2b|roleplay        Role Play
pair-protect-bust     ...2660789599  event missing :: |-fail|p2b <> |move|p1a|curse           Role Play
pair-protect-bust     ...2634201050  extra event   :: |upkeep <> |move|??:farigiraf|roar      off-field action
pair-redirect-priority...2662386191  unrelated     :: |-damage|p1b|H/H <> |-supereffective|   redirection (3b)
```

**Of the 20 board-material games that remain, 8 are Moody** — the declared non-defect, the stat pick
having no shared die. So roughly **12 are ENGINE board-material**, down from roughly 15. **The "one
off-field body" that was previously grouped with Moody as the instrument was not the instrument — it
was §2, and it is fixed.**

### The must-not-move list, checked

- **damage differential 0 of 6000** at `--n 6000 --seed 20260804`, and 0 at **all 16 corners**
  (`top`, `bottom`, `idx01`–`idx14`). Re-run after the last engine edit.
- **census 681 probed / 681 live / 0 missing**, 0 probes threw.
- **narration did not rise** — 19 games / 18 causes on both arms.
- **the three deliberate-roster stages were re-run and re-written** against release `fbf74de3fbd6`:
  items 0 / 0 (139 of 148 tested), abilities 0 / 0 (130 of 202), moves 0 / 0 (475 of 500). Zero
  `FIRED-AND-BOARDS-DIFFER` and zero `DID-NOT-FIRE` in all three.
- **`engine/all_mechanics_fire.js --kind all` re-run and re-written**; the gate clause still reads
  16 of 23.
- **the gate holds at 5 of 8 PASS**, exactly as it stood.

### Everything else that was run green

`test-engine-consistency`, `test-volatile-duration`, `test-resolution-order`, `test-protocol-trace`,
`test-encore-fail-silent`, `test-end-state`, `test-bracket-regain`, `test-immunity-gate`,
`test-tag-params-derived`, `test-mc-seal`, `test-medicham-coverage`, `test-nature-differential`,
`test-roster-arm-pin`, `test-coverage-stop`, `test-middle-identity`, `walk_tags`, `artifact_audit`,
`test-no-silent-failure --only` (the three files this batch touches), and
`engine/move_result_state.js --selftest` (18 passed, 0 failed).

### Two gates are RED and they were RED at HEAD

Said plainly rather than filed. Both were measured on a `git worktree` of HEAD `ce31ff0` **before**
this batch, and both failed there too:

- **`engine/selftest.js`** — *"every raw reader of the ladder store declares why"*: 10 files read the
  ladder store with neither a clean filter nor a `RAW-STORE-OK` declaration, `medicham2-browser.js`
  among them. This batch adds no store read; the declaration is missing and always was.
- **`engine/conformance.js`** — 47 S13 regressions on this tree, **60 at HEAD**. Almost all are
  MEASURE/SEARCH artifacts with no attributable generator (`data/exploitability-*.json`,
  `data/policy-weights-*.json`, the rollout meta files). Not ENGINE's files and not touched here.

Neither is a new red and neither is being called a "known failure": they belong to the divisions that
own those files and are on the OWED list below with that said out loud.

---

## What was NOT claimed

- **The instrument cannot vouch for a persisting Substitute.** Nothing in this batch touches
  Substitute HP, which is named in `end_state_not_compared`.
- **The `-ability` line is three fields where the authority writes six.** Role Play's real line is
  `|-ability|USER|New|Old|[from] move: Role Play|[of] TARGET`. `|-ability|` is dropped as cosmetic by
  the whole-game comparator, so the extra fields are invisible to every instrument this repo owns, and
  a second emitter shape for one move would be the drift the FACTS-ARE-GLOBAL rule is about. Known
  residue, not a discovery.
- **A refused Role Play does not blank its move line's target field.** The authority's `onTryHit`
  returning false is `add('-fail', pokemon)` **plus** `attrLastMove('[still]')`, which blanks field 4.
  This engine writes the `-fail` and not the `[still]`, exactly as `abilitywrite` next door does. The
  comparator normalises that field away — it is how the pre-fix streams aligned at all — so it is
  invisible today. Left alone rather than changed for one move and not its three neighbours.
- **`MEDSEEN.abilityCopyNoRefusalRow` is expected to be non-zero and is not an alarm.** Only ten
  abilities in this format carry a `refusesCopy` row, so almost every lookup misses and the miss means
  what the authority means by it: no refusal. 3 copies / 6 misses on 699 pinned games — both flag
  checks on all three attempts. What WOULD be wrong is the family disappearing from `tags.json`, and
  the guard against that is Trace's own probe, which reads the same rows.
- **No `MEDI_*` knob was added.** Each of the four probes was watched RED on the live tree with its
  control arm already green, and the pre-fix output is quoted above. That is the evidence; there is no
  environment-variable revert to re-demonstrate it later, and this says so rather than implying one
  exists.

---

## The thing that will bite the next reader: a single-game replay is NOT reproducible in isolation

Replaying one diverging pair on its own gives a **different game** from the same pair played in
sequence inside the 961-game run, and the difference is not small — it changes which turn the game
diverges on and sometimes whether it diverges at all.

Measured twice during this batch:

- the phazing game diverged at turn 3 when it was the 11th game in a process and at turn 1 (on a
  MEGA-ORDER speed tie between two identical Aerodactyls) when it was played alone;
- the redirect game diverged at turn 11 in sequence and at turn 10, on a different cause, alone.

**That mega-order divergence was NOT caused by this batch** — it was reproduced with
`engine/medicham2-browser.js` reverted to HEAD, in the same isolated position. The cause is that the
tie key and the mid-battle address log are process-scoped in a way a per-game reset does not fully
clear, so a game's dice depend on how many games ran before it.

**The consequence for anybody debugging here:** a single-game replay is a fine way to READ a
divergence and a bad way to prove one was fixed. The 961-game run, played in the same order on both
arms, is the only attribution.

---

## Proposed register rows

- *Role Play resolved to a pass — the user never took the target's ability.* ENGINE. **CLOSED**
  2026-08-24. Instrument: `engine/game_differential.js`, arm `middle`, causes
  `event missing from medicham2 :: |-fail|p1a <> |move|p2b|roleplay` and
  `… |-fail|p2b <> |move|p1a|curse`. 2 games of 961, BOARD-MATERIAL. Probe:
  `tests/test-mechanics.js` `move/copiesTargetAbility`.
- *A body dragged off the field still took its own action.* ENGINE. **CLOSED** 2026-08-24.
  `runAction`'s `if (!action.pokemon.isActive) return false` was missing. Instrument: the same, cause
  `extra event emitted by medicham2 :: |upkeep <> |move|??:farigiraf|roar`. 1 game of 961,
  BOARD-MATERIAL. Probe: `move/forcesSwitch`.
- *A single-target STATUS move was never redirected.* ENGINE. **CLOSED** 2026-08-24. The draw lived
  inside the attack branch; the authority runs `RedirectTarget` for every single-target move. Probe:
  `move/redirects`. Exercised in the pool (`MEDSEEN.redirectedNonAttack` non-zero) but did not clear a
  game on its own.
- *Between two redirectors on one side, this engine took the one in the lower slot.* ENGINE.
  **CLOSED** 2026-08-24. `Battle.compareRedirectOrder` is priority then SPEED, and the speed key is
  Trick-Room-inverted upstream. Instrument: the same, cause
  `unrelated event mismatch :: |-damage|p1b|H/H <> |-supereffective|p1a|1`. 1 game of 961,
  BOARD-MATERIAL. Probe: `move/redirects`.
- *A single-game replay is not reproducible in isolation.* ENGINE, **OPEN**, instrument defect rather
  than a game defect. The tie key and the mid-battle address log are process-scoped, so a game's dice
  depend on how many games ran before it in the same process. Shown by reverting
  `medicham2-browser.js` to HEAD and reproducing the same isolated-position divergence. Blocks nothing
  today; it makes every single-game debugging session quietly unreliable.

---

## OWED, NOT RUN

- **`tests/run-all.js`** in full — not run. The ENGINE instruments were run individually (listed
  above) and two repo-wide gates were measured RED at HEAD and named above.
- **`engine/selftest.js`** — RED at HEAD and RED now, same clause. Owner: whoever owns the
  ladder-store declarations. `medicham2-browser.js` is on its list and needs either a clean filter or
  a `RAW-STORE-OK` declaration.
- **`engine/conformance.js`** — RED at HEAD (60 regressions) and RED now (47). Owner: MEASURE/SEARCH,
  whose artifacts make up nearly all of it.
- **`engine/feature_fixture.js --check`** — FAILED on `data/policy-weights.json` before and after this
  batch: the fixture itself changed (scenarios 10 → 12) and the damage table was regenerated
  (318 → 322 species). That is the REFIT question and belongs to MEASURE. **Not touched here, and its
  verdict must be settled before anybody restamps** — a restamp silences the table gate and writes over
  the evidence.
- **`tests/interaction_matrix.js`** — last run 2026-08-11.
- **`tests/mutation_harness.js`** — still needs `--gate-only --no-write` wiring.
- **`engine/quarantine.js`** — its clauses were run directly, at the pins, via `engine/status.js`.
- **`node engine/replay_one.js --census <the pin>`** — still the way to attribute the weather-upkeep
  five.
- **`node engine/explain_divergence.js --dump-speeds`** — the tie-settling command, untouched per the
  brief.
- **`data/game-differential.json`'s own state-comparator proof reads `planted_state_proof_ok: false`**
  on BOTH arms — two plants (`vol.saltcure`, `vol.syrupbomb`) are NOT CAUGHT. That is pre-existing:
  the before-arm artifact at HEAD has the identical false. It is named here because the artifact
  prints *"every state number below is worthless"* beside it, and every board-material figure this
  sprint has published — including the standing 24 — was measured under that same condition.

---

## What is still board-material, after Moody comes out

19 causes / 20 games, of which 8 games are Moody. The remaining twelve, verbatim from the artifact:

```
1  unrelated event mismatch :: |move|p2a|psychicfangs <> |cant|p2a|flinch
1  unrelated event mismatch :: |-activate|p2a|telepathy <> |-immune|p2a|[from]telepathy
1  -damage: a different body :: |-damage|p2a|H/H <> |-damage|p2b|H/H          (an Outrage random-target draw)
1  extra event emitted by medicham2 :: |-immune|p2b <> |-sideend|p2:|reflect  (we end Reflect early)
1  extra event emitted by medicham2 :: |faint|p2b <> |-status|p2a|brn         (the KO'd spread target's faint)
1  event missing from medicham2 :: |switch|p2a|crabominable,l50|H/H <> |cant|p1b|recharge
1  ordering :: |switch|p1b|whimsicott,l50|H/H <> |switch|p1a|alakazam,l50|H/H
1  unrelated event mismatch :: |cant|p2a|slp <> |-curestatus|p2a|slp|[msg]    (a sleep-duration draw)
1  unrelated event mismatch :: |-supereffective|p1a|1 <> |move|p1a|gravity
1  extra event emitted by medicham2 :: |upkeep <> |-activate|p1b|sitrusberry  (a berry eaten and NOT consumed)
1  event missing from medicham2 :: |switch|p2a|talonflame,l50|H/H <> |switch|p1a|falinksmega,l50|H/H
1  unrelated event mismatch :: |-fail|p2b <> |-start|p1a|disable|protect      (we start a Disable the authority fails)
```

Two of those were read at the line during this batch and are worth handing on:

- **Magic Room is parked, not suppressed, and the board reads the parked slot as empty.**
  `itemRoomHide` moves the item to `_roomItem` and sets `m.item=''`; Showdown suppresses the item's
  EFFECTS while the body still HOLDS it, so `pokemon.item` stays set. Every board comparison taken
  inside a Magic Room therefore reports every item on the field as missing. Seen on the
  `omit-spread` arm with four bodies' items reading `""` against `alakazite / meowsticite /
  twistedspoon / focussash`. **It is our REPRESENTATION, not our behaviour** — the fix is either the
  ~40-call-site `heldItem()` gate the original author weighed and rejected, or having the board reader
  say `m.item || m._roomItem`. The second is an instrument change and should be argued as one.
- **A Sitrus Berry is eaten and then not gone.** Trevenant pays Curse's HP, eats its Sitrus
  (`-enditem` + `-heal`, both matching), and then this engine emits an extra
  `|-activate|p1b: Trevenant|item: sitrusberry` and finishes the turn still holding the berry. The
  authority's board has `item: ""`. One game, board-material, and the extra line is the tell.
