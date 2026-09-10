# Fixture legality, batch 2 — 2026-09-10 (MEASURE)

**Dated evidence, not current state.** Every figure below was read from a command run between roughly
2026-09-10 01:30Z and 03:30Z on a working tree at HEAD `48b26d01` with `engine/medicham2-browser.js`
under live rewrite by another agent (release `489bea0577bc` was cut mid-run by that agent). Format
`gen9championsvgc2026regmb`; Showdown at the pinned commit `20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4`
(2026-07-22), `actualCommit()` equal to the pin. Nothing here is maintained; the register rows and the
RUNNING-NOTES row it proposes supersede it. **No commit was made.** Rules honoured: no differential, no
roster, no census write, no `status.js`, no `run-all`; every probe through `tools\lownode.cmd`; the
forbidden files (`engine/game_differential.js`, `engine/medicham2-browser.js`, `tests/roster.js`,
`tests/test-mechanics.js`, `docs/RUNNING-NOTES.md`, `CHANGELOG.md`, `docs/ROADMAP.md`) untouched.

A previous MEASURE agent on this brief was killed before editing anything; no partial work existed.

---

## 0. The verdict

`node tests/test-fixture-legality.js`, before: **25 NEW illegal sets / 19 NEW illegal declarations in 21
files** (plus the 6 EXISTENCE sets). After:

```
        632 files, 2367 set declarations, 753 distinct sets
  ok    the sweep found 753 distinct sets to validate
  FAIL  1 NEW illegal fixture set(s). The game would refuse these teams:
              set:   incineroar @ (no item) / Blaze / [Knock Off, Protect]
              sites: engine/game_differential.js:6186, engine/game_differential.js:6256, engine/game_differential.js:6325, engine/game_differential.js:6348
  ok    every one of the 15 baselined verdicts is still produced — no stale allowance
  ok    all 15 baseline entries carry a kind and a written reason
  FAIL  1 NEW illegal DECLARATION(S) that no verdict sentence names:   [the same Incineroar Knock Off]
  ok    every one of the 15 baselined declarations is still produced
        1 UNREACHABLE declaration(s) ... Milotic can't learn Spore.   tests/staged_status_counters.js:189,209   [baselined, declared]
  ok    the closed origin set is intact at 41 historical verdicts
  ok    no new stray literal (0 known)
  ok    the ratchet still discriminates: a planted verdict reads NEW, a baselined one does not
FIXTURE LEGALITY: 2 FAILED
```

**Outside `engine/game_differential.js`: 0 sets / 0 declarations.** The one remaining verdict is in the
file this brief forbids me to touch (§3). Sets 25 → 1, declarations 19 → 1 (the 19 "declarations" are
clause 5's per-move PAIR ratchet — the same pairings the 25 sets carry, counted per move — so repairing
the sets repaired them; there was no separate list to delete).

**Probes touched: 25 files. All 25 GREEN on the final tree except one, which was RED before this batch
on the same clause (§4).**

---

## 1. Why the probes' own gates had passed these sets (the instrument, not the engine)

Thirteen of the files carry their own "LEGALITY, DERIVED AND REFUSED" gate, and every one of them passed
the sets the validator refuses. The gate's `learns(sp, mv)` walked `dex.data.Learnsets` up the prevo
chain and returned true on ANY entry, whatever its source tag. Read on the disputed pairs:

```
clefable curse      canLearn=false   clefable:null <- clefairy:["7V"] <- cleffa:["7V"]
gengar explosion    canLearn=false   gengar:null <- haunter:["7M","7V","6M","5M","4M","3T"] <- gastly:[...]
snorlax doubleteam  canLearn=false   snorlax:null <- munchlax:["7M","6M","5M","4M"]
clefable toxic      canLearn=false   clefable:null <- clefairy:["8V","7M","7V","6M","5M","4M","3M"] <- ...
archaludon bodypress canLearn=false  archaludon:null <- duraludon:["9M","8M"]
incineroar knockoff canLearn=false   incineroar:null <- torracat:null <- litten:null
garchomp nastyplot  canLearn=false   garchomp:null <- gabite:null <- gible:null
```

A gen-7 TM on a prevo is not a gen-9 Champions learnset entry; `TeamValidator#checkCanLearn` says so and
the raw-row walk cannot. **In the 13 files whose gate walks only LITERAL rows, `learns` is now
`CS.canLearn(sp, mv)` — the validator's own verdict, the same function the sweep uses.** The idiom
exists in **47 files** (`grep -l "e.learnset && e.learnset\[id\]" tests/*.js`); the other 34 are owed
(§7), and one of the edited files — `probe_priority_modified.js` — keeps its walk because line 355 also
uses it to DERIVE a printed membership, and changing a derivation moves what the probe prints.

---

## 2. Per site

Deriving commands, all read from the format on this run (`node <scratch>/derive.js …` is a 30-line
wrapper over these; nothing was typed):

- carriers of a move: `CS.legalRoster().filter(sp => CS.canLearn(sp.name, <move>))`, printed with
  base stats, types and ability slots (`derive.js carriers <Move> [<Move2> …]` intersects);
- a pairing: `CS.canLearn(<species>, <move>)`;
- a species' legal moves: `dex.moves.all().filter(m => m.exists && !m.isNonstandard && CS.canLearn(sp, m))`;
- every species key through `engine/mc_key.js` `mcKey()` — all 15 new bodies resolve
  (`gourgeist-small`, `slowking`, `slowbro`, `hydreigon`, `chandelure`, `audino`, `staraptor`,
  `umbreon`, `skarmory`, `scizor`, `lucario`, `garganacl`, `vanilluxe`, `sinistcha`, `archaludon`);
- HP at the differential's own spread (no HP investment: `floor((2·base+31)/2)+60` at L50), checked
  against the sim by building a `Battle` at `LEGAL_SPREAD` and reading `maxhp`.

### 2.1 The six EXISTENCE sets (more than four moves) — same board, fourth slot per arm

| file:line | needed | replacement | probe |
|---|---|---|---|
| `tests/probe_default_target_side.js:146,148` | Lucario clicks Coaching, Swords Dance, Protect, Bullet Punch AND Aura Sphere across arms; Clefable clicks Helping Hand, Charm, Protect, Follow Me AND Copycat | `LUCA` `[Coaching, Swords Dance, Protect, Bullet Punch]` + `LUCA_AS` (Aura Sphere); `CLEF` `[Helping Hand, Charm, Protect, Follow Me]` + `CLEF_CC` (Copycat); `SIDE_VIC(luca, clef)`; three arms name their variant. Lucario's Copycat and Clefable's Moonblast were never clicked | RED — **pre-existing**, see §4 |
| `tests/probe_megasol_announce.js:119,120` | Meganium never clicks Protect (every `PROT` is the partner's) | drop Protect | GREEN — `PASSED — every claim held`; RED-1/RED-2 write 1 and 2 Mega Sol lines, CTRL-A/B/C write 0 |
| `tests/probe_encore_bracket.js:148` | Sylveon clicks Charm, Quick Attack, Protect, Calm Mind, and Helping Hand only on `already-moved` | `SYLV(item, fourth)` defaulting to Calm Mind; `already-moved` passes `'Helping Hand'`; Moonblast never clicked | GREEN — `all 11 arms clear`; instrument control `no-encore` ordered differently: YES |
| `tests/probe_priority_modified.js:152,153` | Roost never clicked | drop Roost | GREEN — `all 14 arms clear` |
| `tests/probe_shield_rearm.js:115` | Toxapex clicks Protect, Haze, Endure, Wide Guard, and Toxic Spikes only on `encore-into-nonshield` | `TOX` `[Protect, Haze, Endure, Wide Guard]` + `TOX_TS`; `VIC_TS`; the arm carries `vic: VIC_TS`; the gate walks `SUB.concat(VIC, VIC_TS)` | GREEN — `all 11 arms clear`, re-arms 1/1 on every red arm |

### 2.2 `tests/test-resolution-order.js`

| line | needed | replacement | evidence |
|---|---|---|---|
| 345, 358 | the Stamina body acts at priority 0 with no secondary of its own | Archaludon `Dragon Claw` (legal; Physical, priority 0, `secondary: null`); scripts `dragonclaw t:1` | `a1-red RED PROVEN`, both A1 controls HELD |
| 525, 544 | a Final Gambit user whose HP exceeds the target's so the kill needs no roll | **Staraptor / Reckless** — 4 legal carriers (Lucario 70, Staraptor 85, and their megas); Staraptor 160 HP vs Weavile 145. **Weavile now clicks Swords Dance, not Ice Shard**: Final Gambit deals the user's CURRENT HP, and a +1 Ice Shard landing first takes 160 below 145 (Basculegion's 195 had the margin) | `a3-gambit-red RED PROVEN`, `a3-gambit-control-blocked HELD` |
| 479 | a Toxic user that also clicks Calm Mind | **Umbreon / Inner Focus** `[Toxic, Calm Mind, Protect]` (36 Toxic carriers; Umbreon learns all three) | `a4-red RED PROVEN 5/5 turns` |

Whole file: `26 arms staged, 0 failing — PASS`.

### 2.3 Single-site pairings

| file:line | needed | replacement | probe result |
|---|---|---|---|
| `probe_curse_pressure_pp.js:120` | a NON-Ghost Curse user with a quiet ability | **Umbreon / Inner Focus** (`UMBR`); the Ghost-type fact check now asks `umbreon`; gate → `canLearn` | GREEN — `GREEN — every claim held over 5 staged turns`, Pressure charged 0 on the four accusations, 1 on the Ghost control |
| `probe_ally_forced_switch.js:122` | one body carrying Roar AND Dragon Tail, quiet ability, Dragon neutral into the Toxapex partner | **Hydreigon / Levitate** (`HYDRA`; 24 carriers of both, Hydreigon the quietest non-mega); gate → `canLearn` | GREEN — `all 6 arms clear`; `dragontail-at-ally` shows `drag/p1b` on both engines |
| `probe_entry_announce_batched.js:95` | an Explosion user FASTER than Pikachu (90) so its side refills first, and it must KO Pikachu | **Gourgeist-Small / Insomnia** (`gourgeistsmall`, base 99) — the only non-mega legal Explosion carrier above 90 (14 carriers); the Speed fact check reads `BOOM[0]`; gate → `canLearn` | GREEN — `PASSED`; RED wants `["switch:p1a:kingambit","switch:p2a:milotic","so:p1a","fallen:p1a:1"]` on both |
| `probe_choicelock_cleared.js:96` | a Knock Off user that survives three Ice Shards | **Scizor / Light Metal** (95 carriers; Ice into Bug/Steel resisted) | GREEN — `all checks passed`; `scarf-knocked-off-drops-the-lock -> IDENTICAL`, `choicelock = iceshard` read on the control |
| `test-imposter-transform-line.js:122` | never-clicked bench filler | Incineroar `Flare Blitz` (legal) | GREEN — `36/36 checks passed` |
| `probe_pivot_magic_bounce.js:131` | a damaging, non-reflectable pivot on "the same Incineroar" | **premise NOT kept, and the arm says so.** Incineroar's only legal self-switching move is Baton Pass (of 7 legal: Baton Pass, Chilly Reception, Flip Turn, Parting Shot, Shed Tail, U-turn, Volt Switch), and no legal body learns Parting Shot AND U-turn (0 carriers; Parting Shot ∩ Volt Switch = Morpeko only). The U-turn arm runs on **Toucannon / Keen Eye** (base 60 like Incineroar; non-STAB U-turn cannot KO Espeon); Incineroar keeps `[Parting Shot, Taunt, Protect]` | GREEN — all four arms `IDENTICAL`; `uturn-is-not-reflectable` bounceAnnounced +0 |
| `probe_doll_blind_family.js:169,172,179,180` | Simple Beam and Power Split carriers, each with a same-species Infiltrator control | Simple Beam → **Audino / Klutz** (its only legal carrier; Audino has NO Infiltrator slot, so **`INF.simplebeam` is deleted** — the premise cannot be kept and the header says so). Power Split → **Chandelure / Flash Fire** with **Chandelure / Infiltrator** as the control (6 carriers; Chandelure the only one with Infiltrator). The PASS sentence now derives the Infiltrator-arm count | GREEN — `33 arms staged, 0 failing`; `simplebeam@doll RED PROVEN`, `powersplit@doll RED PROVEN`, both `@nodoll CONTROL HELD` |
| `test-effect-credit.js:52` | a +2 ATTACK boost (the test greps `-boost|.*atk`) from a body with no self-stat ability | **Lucario / Inner Focus** `[Swords Dance, Protect]` (Meowscarada's legal self-boosts are Agility and Nasty Plot — wrong stat) | GREEN — `ALL PASSED` |
| `probe_selfdestruct_winner.js:239,240` | two more Explosion carriers with silent abilities on the exploding side | **Garganacl / Purifying Salt**, **Vanilluxe / Ice Body** | GREEN — `5 boards staged, 0 failing`; w2 faint order `p2 [vanilluxe#5 garganacl#6]`, winner A on both |
| `probe_substitute_status_step.js:151` | ONE mover for all five clicks (Thunder Wave, Swagger, Block, Hydro Pump, Disable) so nothing but the click differs | **Slowking / Oblivious** on every `BRO_*` row — the only legal carriers of all five are Slowking and Slowking-Galar; same base 30 Speed, same Special Attack. "Slowbro does not learn Pain Split" → Slowking (also `canLearn=false`) | GREEN — `12 arms staged, 0 failing`; `swagger-miss RED PROVEN` |
| `probe_endturn_clock_order.js:201,220,234` | a Snorlax filler for four post-Disable turns: `self`, priority 0, no HP cost, cannot fail inside five turns | **Curse** (non-Ghost: `self`, +Atk/+Def/−Spe; Snorlax is the slowest body on the field so the Speed shed changes no order). Rejected: Stockpile (4th click fails), Belly Drum (HP), Recycle/Swallow/Rest/Sleep Talk (fail), Screech (85%), weather moves (a second residual clock in a clock-order probe) | GREEN — `7 arms staged, 0 failing — PASS`; both red arms `RED PROVEN 5/5 turns` |
| `test-encore-fail-silent.js:194` | a Whirlwind user into the Suction Cups Malamar | **Skarmory / Keen Eye** (37 carriers) | GREEN — `10 staged, 0 parted — PASS`; the Suction Cups arm `AGREES` |

### 2.4 The Nasty Plot family (7 probes, 14 named sites)

`IDLE = { m: 'nastyplot' }` is the universal filler, and `packTeam` builds the raw `Battle` team from the
declared moves without validating — so Garchomp, Kingambit and Milotic HAD Nasty Plot in the battle and
the probes were green. A body that is CLICKED (or can enter after a faint and then be clicked) needs a
move the request actually offers: a scripted move not on the request is a **silent `pass` on BOTH
engines** (`scriptMoveNotOnRequest`, `engine/game_differential.js:4985`) — or, for a standing body, a
choice the authority REJECTS outright. So:

- **clicked Water target** (Dire Claw KO arm, Tri Attack target, Syrup Bomb target, Yawn/Leech Seed
  target, recoil "soft" target): Milotic → **Slowbro / Oblivious** (78 legal Nasty Plot carriers; Slowbro
  is the Water one that is immune to none of brn/par/frz and dies to the Dire Claw HIT rather than to the
  poison chip — verified by the `KO-ON-A-CORPSE` clause, `-fail` between lethal `-damage` and `|faint|`);
- **a bench body that enters after a faint and is then clicked**, or the second ACTIVE slot: Kingambit →
  **Sinistcha / Heatproof**;
- **never-clicked bench**: species kept, filler legal — Garchomp/Kingambit `Swords Dance`, Milotic `Recover`;
- **the Ground target in the Dire Claw arms is KEPT as Garchomp** (nothing in the regulation both resists
  Poison and learns Nasty Plot with a quiet ability — Runerigus/Cofagrigus swap abilities on contact,
  Spiritomb/Gourgeist do not resist), and its own click is `swordsdance` at `DC_TURN` p2 slot 0 — same
  `self`/priority-0/+2 shape and the same cap-fail on the 4th click that Nasty Plot had;
- **the Substitute attacker in `probe_fail_names_the_move.js` stays Kingambit** `[Iron Head, Swords Dance]`
  (base 50 < the doll holder's 60; a STAB Iron Head breaks the 56-HP doll on any roll and nothing spills)
  with its turn-2 idle `SD_K = { m: 'swordsdance' }`.

| file:lines | result |
|---|---|
| `probe_direclaw_refusal_line.js:170,171,185,186,195,196` | GREEN after a second fix — the judgement regexes at 243-249 named `Milotic` literally (`|-damage|p2a: Milotic|0 fnt`, `|faint|p2a: Milotic`, `|-status|p2a milotic|`); now `Slowbro`. `KO-ON-A-CORPSE` and `TRI-CLEAN` green; `TRI-STATUSED`, `SAME`, `OTHER`, `NO-SECONDARY` unchanged |
| `probe_fail_names_the_move.js:190,192,202,203,205` | GREEN — `SUB-WEAK+SUB-REPEAT`: authority `-fail|p2a farigiraf|move substitute` then `…|[weak]`, both engines |
| `probe_faint_before_source_gone_end.js:194,196,200` | GREEN — KO-SOURCE 6 turns: `|faint|p2ahydrapple` BEFORE `|-end|p1aslowbro|syrupbomb`; Sinistcha enters and is later fainted on both engines identically |
| `probe_recoil_on_a_corpse.js:183,185,186,187` | GREEN after a second fix — **slot 1 is the second ACTIVE, not the bench**, and the first cut gave it `Swords Dance`: the authority rejected `move 1 1, pass` ("Your Kingambit must make a move") and the fixture search refused all 8 candidates. Now Sinistcha / Nasty Plot in that slot. CORPSE/PUNISHED/SURVIVES all green (Garchomp punisher, Sharpedo Double-Edge attacker, Brick Break chip) |
| `probe_refusal_this_engine_swallowed.js:184,185,203,204,211` | GREEN after a second fix — regexes at 251 and 286 named `milotic` (`-start|p2a milotic|move yawn`, `-activate|p2a milotic|move safeguard`); now `slowbro` |
| `probe_shield_before_ability.js:203,208,246,248` | GREEN — 126 ok / 0 fail; `healpulse PLAIN-SHIELD` one line not two |
| `probe_yawn_safeguard_refusal.js:215` | GREEN — every arm agrees (SG-YAWN, NO-SG, SG-STATUS, SG-SEED, ALLY-YAWN, INFIL-FOE, INFIL-ALLY) |

The derived-cast rows (`mon(TRI_USER.name, '', '', ['Thunder Wave', 'Nasty Plot'])`, `KILLER`, `SEEDER`,
`VICTIM`, `PARTNER`, `x.user`, `PUNISH`…) still carry `'Nasty Plot'` as a filler. They are outside the
sweep's population ("construction sites declare no literal set") and are NOT checked here — owed (§7).

---

## 3. Left for its owner — `engine/game_differential.js`

`incineroar @ (no item) / Blaze / [Knock Off, Protect]` at lines 6186, 6256, 6325, 6348 (the directed
Knock Off scenarios and the `ko/<item>` damage-interior fixtures). Incineroar does not learn Knock Off
in Champions (`canLearn=false`, no entry on Incineroar, Torracat or Litten). The nearest legal shape by
this batch's precedent is Scizor / Light Metal (used in `probe_choicelock_cleared.js`), but the
damage-interior arms compare a specific Knock Off damage figure and the owner must re-derive it. This is
the only remaining verdict in `tests/test-fixture-legality.js`.

---

## 4. Attribution — three controls

Every red was run against a control before being called a regression, because
`engine/medicham2-browser.js` was being rewritten under the runs.

| probe | live-engine, new fixture | live-engine, HEAD fixture | release `7d66b526659e` (cut 23:38Z, before tonight's rewrite), new fixture | verdict |
|---|---|---|---|---|
| `probe_default_target_side.js` | RED 12/12 — `near-side draws counted clean 3-6, expected 0/1`; every arm also prints "the two engines agree, line for line, on all four facts" | **RED 12/12, same clause** (`clean 5, expected 1`) | **RED 12/12, same clause** | **pre-existing; not this fixture and not tonight's engine bytes.** The `nearSideDraws` counter over-counts against the probe's `near:` expectations while boards and lines agree — a stale expectation or a counter that now fires on more roads. ENGINE/instrument; defect card below |
| `probe_direclaw_refusal_line.js` | RED 2 | GREEN | — | mine — literal `Milotic` in the judgement regexes; fixed, GREEN |
| `probe_recoil_on_a_corpse.js` | RED | GREEN | — | mine — slot-1 body given a filler the request never offers; fixed, GREEN |
| `probe_refusal_this_engine_swallowed.js` | RED 2 | (not run; same shape as direclaw) | — | mine — literal `milotic` in two regexes; fixed, GREEN |

**Defect card (not fixed here — engine/instrument, not fixture):** `tests/probe_default_target_side.js`
reports `>> THE BRANCH DID NOT RUN AS CLAIMED` on all 12 arms because `near-side draws counted` reads
3–6 clean where each arm expects 0 or 1, while `MEDFAILS stamp clean 0 knob 1`, `script clicks not on
request 0`, and the four protocol facts agree on both engines. It reads identically on the HEAD fixture
and on release `7d66b526659e`. Either the probe's per-arm `near:` expectation is stale against a counter
that now counts every near-side resolution, or the counter fires on roads it should not; the boards say
the former is likelier. Route: ENGINE (owner of `nearSideDraws`), with the probe's expectation as the
question.

Also observed, not asserted: the final-tree green of the 24 other probes was measured against whatever
`engine/medicham2-browser.js` bytes existed at the moment each `_live_release.js` cut ran (the store was
overridden to a temp dir by that helper; `data/releases` untouched by these runs).

---

## 5. Sanity on the edit mechanics

- Every replacement asserted an exact match count before writing; three mismatches were caught and
  narrowed (a Weavile row that occurs 7 times, a `learns` block that is split differently in 4 files).
- Line endings: each file was normalised to LF for matching and written back in its own convention.
  Measured on all 25 after the last edit: CR count equals line count in every file AND in every file's
  HEAD blob (e.g. `test-resolution-order.js` 932/932 now, 931/931 at HEAD) — uniform CRLF both sides,
  nothing mixed. The `LF will be replaced by CRLF` warnings `git diff` prints are `core.autocrlf` noise,
  not a change this batch made.
- `node --check` passed on all 25 files. `git status` shows other agents' concurrent work
  (`engine/medicham2-browser.js`, `tests/probe_red_demo.js`, `tests/probe_substitute_family.js`
  untracked, fourteen `data/*.json` artifacts, two `data/verification/*` files) — none opened or written
  by this batch.
- The `cmd /c` form of the lownode wrapper under Git Bash never launched node and returned exit 0 for
  every probe in the first chain — twelve fake greens in seconds. Caught on the timing, re-run with
  `cmd //c`. Recorded because it is exactly the "green asking nothing" shape.

---

## 6. Proposed RUNNING-NOTES row (NOT written) and CHANGELOG bullet (NOT written)

> **2026-09-10 — MEASURE — fixture legality, batch 2.** `tests/test-fixture-legality.js` 25 NEW sets /
> 19 NEW declarations → 1 / 1, the survivor being `engine/game_differential.js`'s Incineroar Knock Off
> (four sites, owner's). 24 fixture files repaired with carriers derived from
> `gen9championsvgc2026regmb` at Showdown `20ad99f` (Staraptor Final Gambit, Umbreon Toxic/Curse,
> Hydreigon Roar+Dragon Tail, Gourgeist-Small Explosion, Scizor Knock Off, Audino Simple Beam,
> Chandelure Power Split, Lucario Swords Dance, Garganacl/Vanilluxe Explosion, Slowking for the
> Substitute mover, Snorlax Curse, Skarmory Whirlwind, Toucannon U-turn; six over-four-move sets split
> per arm; the Nasty Plot filler's three illegal bodies swapped or re-fillered). Root cause in the
> probes' own gates: a raw-learnset prevo walk accepting gen-7 source tags — replaced by
> `champions_sim.canLearn` in 13 files, 34 files still carry it. Two premises could not be kept and say
> so (no Infiltrator Simple Beam carrier; Incineroar has no legal damaging pivot). 24 of 25 probes green;
> `probe_default_target_side.js` red on a `near-side draws` expectation that is red on the HEAD fixture
> and on release `7d66b526659e` too — pre-existing, ENGINE. Three regressions of my own (literal
> `Milotic` in judgement regexes ×2, a slot-1 body given an unofferable filler) caught by HEAD-fixture
> controls and fixed. **Basis.** unchanged. **Supersedes.** Nothing published.

- Fixed: 25 illegal fixture sets / 19 declarations the Champions validator refuses, across 24 probe and
  test files, repaired with format-derived carriers; every touched probe re-run.
- Fixed: 13 probe legality gates now ask `TeamValidator` (`champions_sim.canLearn`) instead of walking
  raw learnset rows that accepted pre-gen-9 source tags.
- Notes: `engine/game_differential.js` Incineroar Knock Off (4 sites) remains; `probe_default_target_side`
  is red on a pre-existing counter expectation; 34 files still carry the raw-learnset walk.

---

## OWED, NOT RUN

1. **`engine/game_differential.js:6186,6256,6325,6348`** — Incineroar Knock Off ×4; the only remaining
   verdict. Owner's file. The damage-interior arms will need their Knock Off figure re-derived for the
   replacement body.
2. **34 files still carry the raw-learnset `learns` walk** (`grep -l "e.learnset && e.learnset\[id\]"
   tests/*.js` minus the 13 switched here). Same one-line replacement where the gate walks literal rows;
   where `learns` also DERIVES a cast (`probe_priority_modified.js:355`, `probe_direclaw_refusal_line.js`
   `TRI_USER`, `probe_refusal_this_engine_swallowed.js` `YAWNER`, …) the switch may change the cast and
   is a per-file judgement, not a sed.
3. **Derived-cast fillers carrying `'Nasty Plot'`** (`mon(TRI_USER.name, …, ['Thunder Wave', 'Nasty Plot'])`
   and its siblings in the seven Nasty Plot probes) are outside the sweep's population and unchecked. A
   per-body `firstLegalMove`-style filler, or extending `fixture_legality.js` to resolve `X.name` rows
   when `X` is derivable, would close it.
4. **`probe_default_target_side.js` near-side counter** — defect card in §4; ENGINE to decide whether the
   counter or the expectation moved. It is red today regardless of this batch.
5. **A fixture-legality gate in every probe that types a body name inside a judgement regex** — two
   probes had one and both went red only because the body changed; a third such regex could equally sit
   in a FILTER and leave an arm green and vacuous. `grep -n "p2a [a-z]*\|p1a [a-z]*" tests/probe_*.js`
   over the judgement sections is the audit; not run here.
6. **RUNNING-NOTES row, CHANGELOG bullet, `status.js --write`, commit** — forbidden this wave; proposed
   text in §6.
