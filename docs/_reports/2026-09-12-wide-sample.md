# THE GATE'S ZERO IS A PROPERTY OF ONE TEAM SELECTION, NOT OF THE ENGINE

2026-09-12, ENGINE. A findings record, not a living document; it is superseded by the register rows
it feeds and is never quoted as current state.

---

## 0. THE HEADLINE, AND IT IS NOT THE ONE THE BRIEF EXPECTED

The brief asked why MEDICHAM reads correct on the gate's ~961-game sample and incorrect on a wider
draw from the same store, and asked how much of the 84 the three fixes in `302b48a5` account for.
Both questions have measured answers and neither is the flattering one.

**The three fixes account for ZERO of the 84.** Measured, not inferred: the same 12,000-game request,
same frozen pool, same census pin, same turn cap, played on the PRE-fix release `48ac1c228e02` and on
the POST-fix release `8ad1ab5e1f86`, produce **the same 84 board-material games, the same 79,267 of
79,588 identical turn boundaries, and the same `families` table to the row.** The protocol count moved
by one, 222 → 221.

| run | release | `--games` | games played | board-material | protocol | boundaries |
|---|---|---|---|---|---|---|
| `data/verification/game-differential-10k-middle.json` | `48ac1c228e02` (pre-fix) | 12000 | 7178 | **84** | 222 | 79267 / 79588 |
| `data/verification/game-differential-12k-postfix.json` | `8ad1ab5e1f86` (post-fix) | 12000 | 7178 | **84** | 221 | 79267 / 79588 |

**And the gate's zero survives ONLY at `--games 1200`.** On the identical post-fix release, with the
identical pinned census (`e04072b49220`), the identical pinned store (`data/team-pool-frozen`), the
identical steering (`empirical-click/v1`), the identical arm (`middle`), the identical cap (50) and
the identical `--end-state` stop rule, changing ONE flag by 12.5% changes the answer from zero to a
rate:

| `--games` | games played | teams picked | pool digest | board-material | protocol |
|---|---|---|---|---|---|
| **1200** | 961 | 1968 | `0d103fb9fa87` | **0** | **0** |
| **1350** | 1069 | 2206 | `7e7a37ded7fc` | **10** (0.94%) | 23 |
| **12000** | 7178 | 14746 | `e398641bda45` | **84** (1.17%) | 221 |

`data/verification/2026-09-12-wide-sample-repro-n1200.json` reproduces the published gate artifact
**exactly** — 961 games, 10,705 of 10,705 boundaries, 0 and 0, pool digest `0d103fb9fa87`, 1968 picked
— so the gate figure is not an error and not a fluke of a bad run. It is a correct measurement of a
sample that happens to contain none of the divergence.

### Why `--games` moves the SAMPLE and not merely its SIZE

```js
_SWARM = SWARM.buildSwarm(Math.max((UNTIL_COVERED ? MAX_GAMES : GAMES) * 2, 18), ...)
                                                    engine/game_differential.js:6833
```

```js
const per  = Math.max(1, Math.floor((n || N) / CFG.length));
const step = Math.max(1, Math.floor(matching.length / per));
const picked = [];
for (let i = 0; i < matching.length && picked.length < per; i += step) picked.push(matching[i]);
                                                    engine/diff_swarm.js:416-431
```

The swarm size is `--games * 2`, and the teams are taken by a **deterministic STRIDE whose step is
computed from that size.** `--games 1200` walks the matching list at one step, `--games 1350` at
another, and the two lattices barely intersect. `pairsFor` then pairs **adjacent** entries of the
picked list, so a different lattice is also a different set of MATCHUPS.

That makes the 961-game run 984 team-PAIRS, not 961 independent trials. Divergence here is
entity-linked — a Bellibolt that banks a charge, a Kingambit whose Defiant should fire, a Flash Fire
body that megas — so the effective sample size for any one mechanism is the number of pairs carrying
it, and a lattice that misses ~30 carriers misses every game they would have produced. The stride is
deterministic and declared; nothing is broken. What is wrong is reading one lattice as a statement
about the engine.

**This is the CLAUDE.md rule about `--games` being part of the sample definition, arriving through a
door nobody had opened: it is not only that two runs at different `--games` are two different
questions — it is that the small one can be a question with no divergence in it at all.**

---

## 1. THE 84, BUCKETED

### 1a. By leaf family — this IS the population

`state.families` counts **every differing leaf of the first divergent board in all 84 games**, not a
capped list. `party.hp` and `active[].hp` read the same standing body, so the HP row is one fact
counted twice.

| leaves | games | family | what it is |
|---|---|---|---|
| 53 | **47** | `party.hp` + `active[].hp` | a damage or residual NUMBER differs |
| 45 | ≤45 | `pp[].*` across **33 distinct moves** | a PP count off by one |
| 43 | ≤39 | `status`, `fainted` | a status landed or did not, or a body died or did not |
| 26 | ≤26 | `species`, `types`, `ability`, `item`, `ate_berry`, `last_item` | identity |
| 22 | ≤18 | `boosts.*` | a stat stage |
| 14 | **14** | `active[].vol.charge` | **the Electric bank — one mechanism, no ambiguity** |
| 10 | ≤10 | `tailwind`, `field.trickroom_turns`, `field.weather_turns`, `screens.*` | field and side clocks |
| 8 | ≤8 | `vol.flashfire` 2, `vol.trapped` 2, `vol.disable` 2, `vol.taunt` 1, `stall` 2 | per-body volatiles |

**A FIELD IS NOT A MECHANISM AND THE HP ROW IS THE PROOF.** 47 games where an HP number differs is 47
games with an unknown number of causes behind them. Only `vol.charge` is self-identifying.

### 1b. By mechanism — this is a SAMPLE, and it is capped at 40

`state.first_board_divergences` is `.slice(0, 40)`, so what follows describes 40 of 84 (48%) and is
evidence of what EXISTS, never of how much.

| rows of 40 | mechanism | verdict |
|---|---|---|
| **9** | `vol.charge 1\|0` — the Electric bank survives a click that spent it | **ENGINE — FIXED this pass** |
| 11 | HP only — a damage or residual number differs | UNDIAGNOSED |
| 4 | PP only — a count off by one | UNDIAGNOSED |
| 3 | forme / species (`mimikyubusted`, `froslassmega`, and one whole-side desync) | UNDIAGNOSED |
| 3 | clocks (`stall 0\|3`, `vol.disable 0\|3`, `vol.trapped 1\|0`) | UNDIAGNOSED, see §3 |
| 2 | `vol.flashfire 1\|0` after a MEGA | **ENGINE — FIXED this pass** |
| 2 | a status (`brn`) landed on one engine and not the other | UNDIAGNOSED |
| 2 | a `spd -2` landed on the **WRONG BODY** (Whimsicott here, Clefable there) | UNDIAGNOSED — targeting |
| 2 | a boost missing entirely (`kingambit atk 0\|2`, `archaludon spa 2\|0`) | see §3, Defiant |
| 1 | `types "water"\|"electric"` on Bellibolt | UNDIAGNOSED |
| 1 | a Tailwind clock plus a faint | UNDIAGNOSED |

**UNDIAGNOSED is the honest word and it is not a synonym for "the instrument".** Five of the last six
passes found the instrument at fault, so the prior is real — but nothing in this artifact decides it
for the HP and PP rows, and a guess that flattered either side would be the failure this division
exists to prevent.

---

## 2. WHAT WAS FIXED, AND THE PROBE THAT PROVES IT

### 2a. THE ELECTRIC BANK — `tests/probe_electric_charge_abort.js` — 14 of 84

Two roads were dead, and **only one of them was the one the artifact pointed at.**

**The abort road, which the file's own comment predicted.** `charge.condition` carries `onMoveAborted`
and `onAfterMove` with the IDENTICAL body; WIRE 157 implemented `onAfterMove` and wrote, at its own
call site, *"Showdown's `onMoveAborted` is a separate handler this engine reaches by having already
`continue`d."* It does not reach it. Five of the six charge causes in the artifact that carry context
show `|cant| ... |flinch` on the line before the missing `|-end|pXa|charge`.

**The status road, which nothing pointed at and which the probe found.**

```js
if(a.kind!=='attack'&&a.mv)spendChargeOnMove(m,a.mv,a.move&&a.move.mv,field);
```

A `{kind:'status'}` action **has no `a.move`**, so the move row arrived `undefined`.
`effMoveType` opens `let t = mv ? mv.t : ''` and every branch under it is a conditional REWRITE, so a
null row falls out as the empty string, which is not `'Electric'`. **The one branch that call site was
written for was the one branch it could never serve** — a Thunder Wave clicked with nothing in its way
left the bank standing. The `electric-runs` control arm exists because of it, and it was RED before
the fix.

Fixed in `engine/medicham2-browser.js`: `spendChargeOnMove` resolves the row through `MC.moves` when
the caller has none and **counts the miss** (`MEDFAILS.chargeSpendNoMoveRow`, never defaults);
`midAbortElectricCharge()` sweeps an aborted Electric click on `midAbortTwoTurn`'s idiom, armed at the
head of the BeforeMove gate, **disarmed at the `|move|` line** (without which a bank re-banked by
Electromorphosis after a click that already spent one would be destroyed by a stale marker) and swept
at both sites that cover every action including the turn's last.

Four arms, all green, knob `MEDI_ELECTRIC_CHARGE_SURVIVES_ABORT=1`:

| arm | before | after | under the knob |
|---|---|---|---|
| `abort-flinch` (the defect) | RED `vol.charge 1\|0` | green | RED, same leaf |
| `protect-blocked` (control: the click RAN and was shielded) | RED | green | green |
| `electric-runs` (control: the leaf can move at all) | RED | green | green |
| `abort-nonelectric` (over-match guard: a GROUND move aborted) | green | green | green |

### 2b. A MEGA RUNS THE OUTGOING ABILITY'S `End` — `tests/probe_mega_ends_absorb_gift.js` — 2 of 84

```js
Pokemon#setAbility: this.battle.singleEvent('End', oldAbility, this.abilityState, this, source);
flashfire.onEnd(pokemon) { pokemon.removeVolatile("flashfire"); }
```

medicham2 already knows this rule — `abRewrite` has called `endAbsorbGiftVolatile` since 2026-08-29 —
but `megaEvolveNow` does not go through `abRewrite`. It writes `m.ability=ab; m.baseAbility=ab;`
directly, and correctly so (a mega's ability survives the bench, which `abRewrite`'s `_preAb` snapshot
would undo). **So the one ability rewrite that happens in every game of this format was the one that
skipped the End.** Both artifact instances are a Flash Fire body megaing — Houndoom-Mega and
Chandelure-Mega.

**PRINTED BEFORE IT WAS WIRED:** the engine keys the removal on
`typeImmunity.gain.volatileBoost.endsWithAbility`, and a walk over `data/tags.json` matches
**exactly one ability in this format** — `flashfire`, 1,777 uses. The probe repeats the walk at run
time and refuses if it ever matches more.

Three arms, all green, knob `MEDI_MEGA_KEEPS_ABSORB_GIFT=1`: `mega-drops-gift` RED → green → RED
under the knob on `vol.flashfire`; `no-mega` and `mega-no-gift` green throughout.

**EIGHTEEN OTHER LEGAL ABILITIES CARRY AN `onEnd` AND NONE IS TOUCHED** — Unburden, Protosynthesis,
Quark Drive, Slow Start, Zen Mode, Supreme Overlord, Air Lock, Cloud Nine, Gorilla Tactics,
Neutralizing Gas, Opportunist, Illusion, Delta Stream, Desolate Land, Primordial Sea, Unnerve and the
two As One formes. That is a real remaining mechanism and it is stated rather than folded in; see §3.

---

## 3. WHAT THE WIDE DRAW SHOWS THAT IS NOT FIXED, EACH NAMED

Read out of the protocol cause contexts of `2026-09-12-wide-sample-repro-n1350.json` and the 10k
artifact. **None of these is claimed diagnosed; each is a named lead with a citation.**

- **DAMAGE NUMBERS DIFFER — the HP bucket, 47 games.** Three worked examples, all board-material:
  Torkoal takes Grav Apple to `16/145` on the authority and `39/145` here; Beat Up on Metagross is off
  by 2 per arrival; Floette is off by 1. `test-engine-diff.js` reads **0 of 6000 at every one of the
  sixteen indices**, so whatever this is, it is not the one-hit formula — it is something the whole
  game supplies that the single-hit harness does not.
- **SUPREME OVERLORD'S `onEnd`** — 11 protocol causes, `|-end|pXa|fallenundefined|[silent]`. Already
  a DECLARED row (the authority emits a literal typo), and narration-only. It is the same mechanism as
  §2b through a different door: an ability's End on faint.
- **SLEEP WOKE ON ONE ENGINE AND NOT THE OTHER** — `|-curestatus|p2a|slp|[msg]` against `|cant|p2a|slp`,
  board `status "slp"|""`, `status_counter 2|0`.
- **DEFIANT DID NOT FIRE** — `boosts.atk 0|2` on Kingambit in the 10k run and again in the n1350 run.
  Defiant IS implemented and routes through `applyStatDrop`; the context shows the Speed drop coming
  from **Gooey on the target it just hit**, so the suspect is that road not reaching `applyStatDrop`
  with a source.
- **ROUGH SKIN ORDER AND MAGNITUDE** — medicham takes a Kangaskhan to `0 fnt` on Rough Skin where the
  authority leaves it at `9/180` after recoil. Board-material (`kangaskhan hp 18|40`).
- **CURSED BODY DISABLE LANDS BETWEEN MULTI-HIT ARRIVALS** on the authority and after them here —
  this is the `vol.disable 0|3` row.
- **RESIDUAL ORDER WITHIN A SIDE** — sandstorm chips `p1a` then `p1b` on the authority, the reverse
  here. Narration unless it decides a faint.
- **FOREWARN AND ROOST'S `-singleturn` ARE NOT EMITTED**; Roost also removes the Flying type for the
  turn, which is a board leaf, and that half is unmeasured.
- **HELPING HAND AT A PROTECTING PARTNER** fails on the authority and succeeds here.
- **THE MEGA PHASE AND `Round`'s RE-ORDER** both place a line on the other side of a neighbouring
  action.

---

## 4. IS 961 BIG ENOUGH — NO, AND WHAT IT WOULD COST

**It is not a power problem, it is a selection problem, so raising the number is only half a fix.**

At the measured rate of 1.17%, a *random* 961-game sample would be expected to contain ~11 parted
boards and would miss all of them with probability ~1.4 × 10⁻⁵. The gate misses all of them every
time, deterministically, because the sample is not random: it is one stride lattice over the team
list, its games are clustered by team pair, and the same 984 pairs are drawn on every run.

**The cost of drawing more, measured on this machine today, one arm, `--arm middle --end-state`:**

| `--games` | games played | wall clock | board-material found |
|---|---|---|---|
| 1200 | 961 | **4.4 min** | 0 |
| 1350 | 1069 | 5.2 min | 10 |
| 12000 | 7178 (3 arms) | 42 min | 84 |

A single-arm run at `--games 12000` is roughly **20–25 minutes**, five times the current gate cost, on
one process at `BELOWNORMAL`. That is affordable for a gate that is run once per engine release, and
it is not affordable for a per-commit hook.

**RECOMMENDATION FOR WILL — not a change made here.** Two options, and the second is the cheap one:

1. **Raise the gate's `--games` to 12000** (~20–25 min per release). Costs time; buys a sample whose
   board-material count has been measured at 84 rather than 0.
2. **Keep the cost and break the lattice** — run the same ~1,000 games at two or three DIFFERENT
   `--games` values and require all of them at zero. Two runs at 1200 and 1350 cost 10 minutes
   together and would have caught 10 divergences the current gate does not see. A gate that reads one
   lattice can be satisfied by luck; a gate that reads three cannot be satisfied by the same luck.

Either way the standing claim needs its caveat made load-bearing rather than printed:
**`BOARD-MATERIAL: 0 of 961` is true and it does not mean what four RUNNING-NOTES rows have used it to
mean.** The honest sentence today is *"zero on the lattice `--games 1200` selects, and 84 of 7,178 on
a wider draw from the same store."*

---

## 5. WHAT THIS PASS LEFT IN THE TREE

- `engine/medicham2-browser.js` — two fixes, two knobs, three new counters.
- `tests/probe_electric_charge_abort.js`, `tests/probe_mega_ends_absorb_gift.js` — new.
- Release **`bc8d7cf849dd`** cut; it needs force-adding.
- `data/verification/2026-09-12-wide-sample-repro-n1200.json`,
  `data/verification/2026-09-12-wide-sample-repro-n1350.json` — the two reproductions §0 rests on.
- All four artifacts the engine edit invalidated re-run on `bc8d7cf849dd` rather than captioned:
  `data/engine-diff.json`, `data/roster.{items,abilities,moves}.json`, `data/all-mechanics-fire.json`,
  `data/game-differential.json`. Census re-derived: **886 probed / 886 live / 0 missing**, unmoved —
  neither fix adds a tag row.
- `engine/quarantine.js` exit 0:
  `GATE: OPEN — MEDICHAM passes both conditions; nothing is withheld`
  **and §4 is why that line must not be read as "MEDICHAM is correct".**
