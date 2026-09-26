# MAG v2 (per-slot dead-click gate) + DODUO v2 (pair gate), Reg M-C

2026-09-25. SOLVER. Historical findings record, not maintained. Frozen release `eaa5becc54eb` for every run that
played or stepped MEDICHAM. Branch `worktree-agent-aeb8fbd78a6dce427`, not merged, not pushed.

## Verdict

**Built, and they do different jobs; safe in substance, short of the bar as written; no measurable strength gain.**

- **MAG v2 is a per-slot dead-click gate, DODUO v2 adds the pair gate, and they remove different things.** On 1,999
  held-out Reg M-C decisions (seed 4, final code `37d1c2e7`): MAG cuts 1.56% of per-slot options (and weights 1.84%
  near zero); the joints it removes are 2.29% of the legal set, the pair gate removes 4.10%, together 6.35%. Of MAG's
  removals the pair gate touches 1.8%, of the pair gate's MAG touches 1.0%, and in every overlap each gate cut a
  DIFFERENT click: **0 pair cuts on a click MAG calls dead.** Nothing is a list: every verdict is MEDICHAM's own move
  result and turn-end board, over every partner option and a covering design of the opponent's joints.
- **Survival: 1,996 of 1,999 (99.85%, Wilson [99.56, 99.95]).** The 99.9% bar is NOT met as a rate. All 3 losses were
  clicks the replay shows failed or did nothing (a Toxic into a Poison-type, a Tailwind already up, a Quick Guard with
  nothing to block) — so no loss is a gate error. Three earlier confirmation draws each exposed a gate or world defect;
  13 were found, fixed and tested, and each fix was confirmed on a fresh draw (§2, §3).
- **Helping Hand, as Will specified:** kept beside an attacking partner, cut beside a Protecting or switching one
  (`solver/tests/test-gates.js` HH, HEAL, MEGA; 30 checks, 15 deliberate breaks, each red).
- **Play:** DODUO-greedy gated vs ungated 0.500 [0.451, 0.549], 400 games, SPRT inconclusive — the gate changed 25 of
  2,870 picks and no result. MILTANK (gen5 nets, 1 s, equal wall-clock) gated vs ungated 0.505 [0.456, 0.554], 400
  games, inconclusive — inside 150 ms a side the gate proves little (26 cuts in 6,294 lists). On the previous gate code
  the same MILTANK test stopped at H0, 0.466 [0.415, 0.518]. **The gates are a correct filter that does not yet buy
  strength; their value in the search is unproven.**
- Also: ROTOM's world builder learned four things it was forgetting (a pivot-return's Fake Out, last move, Protect
  streak, moves used since entry, an empty opposing slot's place). The `#509` shielded-status-move residual is filed
  again in `docs/ENGINE.md` with its readers; not fixed.

## 1. What the two gates are, and why they cannot overlap

Will's design (2026-09-25): MAG stops scoring and becomes a per-slot DEAD-CLICK gate; DODUO keeps its learned scoring
and adds the PAIR-level gate. Both are derived from the engine, never from a list.

| | MAG v2 — `solver/mag/gate.js` | DODUO v2 — `solver/doduo/gate.js` |
|---|---|---|
| judges | one click of one slot | one joint (two clicks) |
| question | does the engine ever report this click as a SUCCESS, whatever my partner does and whatever the opponent does? | does this click CHANGE THE BOARD beside this partner click, against anything the opponent does? |
| evidence | MEDICHAM's own move result (`_mvRes`, its mirror of Showdown's `moveThisTurnResult`), the LAST value written in the step | the move result AND the turn-end board (`engine/board_state.js` `readMedi`), compared with the same world where the slot PASSES |
| verdicts | live / **soft** (succeeds only when the opponent switches: near-zero weight, not cut) / **dead** (cut) / untested (kept) | cut / kept |
| cuts only if | no success in any informative world | futile beside THIS partner click AND not futile beside some other one |

**Disjoint by construction.** The pair gate cuts a click beside partner `b` only if the same click has an effect
beside another partner — so it cannot cut a click MAG calls dead (a dead click never succeeds, so it never has an
effect), and MAG cannot call dead a click the pair gate cuts (it has an effect somewhere, so it succeeded). The
eval's 2x2 and `solver/tests/test-gates.js` DISJOINT check it on data rather than trusting the argument.

**What "every world" is.** A world is one engine step from the position: my joint, the opponent's joint, one dice
set. The opponent's joints form a covering design (`solver/mag/probe.js` `oppCover`): every option of each opposing
slot appears at least twice, each time beside a different companion (a second pass adds any option the first pass
could not pair legally — found when a foe's only switch never appeared). MAG plays EVERY option of my partner against
EVERY entry of that cover; the pair gate plays its fixed partner click against every entry. Both read the same worlds
(one cache per position), which is what makes "a pair-gate effect is a MAG success" a fact rather than a hope.
This is a covering design, not the full product of the opponent's two slots: a rescue that needs one specific
option of EACH opposing slot at once can be missed. The held-out survival rate is the measurement of what that costs.

**The dice.** Every world has fresh event-addressed dice. Round 0 of the cover plays on PINNED dice — every accuracy
roll hits (`acc`), a Protect streak holds (`stall`), no chance secondary lands (`sec` high) — and round 1 on free
dice, so every opposing option meets both. A click whose success is a roll is never called dead, and a futility never
rests on a lucky flinch.

**What a world is not allowed to know.** The gate reasons in a world where the viewer's opponent's unrevealed back
line is redrawn from its sheet (the searcher's own `sampleWorld`), with a second draw kept to re-check any would-be
hard cut against a different switch-in. The sleep clock is opened (both players are blind to it in Showdown), so no
click is cut because a body will certainly stay asleep.

## 2. Things the engine said that the first versions misread (each found on data, each fixed, each tested)

| # | what the gate saw | what was true | fix | test |
|---|---|---|---|---|
| 1 | a Normal move into a Ghost ally read as a SUCCESS | the engine writes a provisional `true` when a move is used and overwrites it with the result (`medicham2-browser.js` 36715 then 50842) | read the LAST value written | IMMUNE, break `anytrue` |
| 2 | Protect read as dead in the first smoke run (three times in 44 random positions) | two dice seeds per position, and an event-addressed roll is the same in every world of one seed: a second Protect in a row fails both rolls 4 times in 9 | fresh dice per world, `stall` pinned on every other world | DICE, break `dice` |
| 3 | a foe's only switch never appeared in the cover | the first pass paired options greedily and a refused pair dropped the option | a second pass guaranteeing every option of each slot | IMMUNE / STATUSED |
| 4 | a Glare into a Protecting body read as a success | the #509 residual: a shielded STATUS move ends `true` here, `null` in the authority (source read) — filed in `docs/ENGINE.md`, not fixed | a world where the click's target shielded is skipped | STATUSED, break `shieldcounts` |
| 5 | a partner's finishing blow made every click beside it "futile", deleting the finishing blow's joints | futility that needs a KO depends on damage, damage on spreads nobody can see | the TALL world (HP x4,096, fractions kept) | TALL, break `short` |
| 6 | in the tall world a Moonblast that landed read as "no effect" | a turn-end heal is a fraction of max HP, so it washed the hit away | the tall world caps every body at 60% HP | HEAL, break `fullheal` |
| 7 | a partner's click beside which every slot-k click is futile would vanish | nothing kept it reachable | one representative pair is kept | REACH, break `norep` |
| 8 | on the first confirmation run the pair gate cut 57 joints on a click MAG had called dead | MAG played each partner option beside only two opponent joints; the pair gate played every partner beside the whole cover, and found an Encore at my partner that works once the partner has moved (and no Fake Out stopped it) | MAG plays the full product, partner x cover, the SAME worlds the pair gate plays | DISJOINT, break `pairany` |
| 9 | a mega Encore blocked by my partner's own Protect read as an "effect" | the pass counterfactual also removed the mega evolution, and the mega alone changes the board | the counterfactual is "mega-evolve and pass" (`PASS_MEGA`, built through the engine's own action map) | MEGA, break `megapass`; MAP holds the map to the API's |
| 10 | a move aimed at an opposing slot b landed on an empty slot | the world compacted the opponent's survivors, so a lone slot-b body sat in slot a | an empty opposing slot is held by the fainted body the log last saw there | (world.js; the eval) |
| 11 | on the seed-3 confirmation a Wide Guard was cut beside an Iron Head | the partner's 30% flinch landed in BOTH of the only two worlds where the foe used its spread move: futility by dice | the pinned worlds also pin `sec` high (no chance secondary lands), and each cover round plays on one dice regime so every opposing option meets both | SEC, break `secfree`; PARITY, break `parity` |
| 12 | (found while fixing 13) the shield skip was blind to whether the shield worked | fix 4 skipped every world in which the target CLICKED a shield — held or failed on a streak, a blockable click or not | skip only when the shield HELD (its own move result) and only for a click it can block (the move's `protect` flag; Helping Hand goes straight through a Protect, and HH went red when the flag was missing) | SHIELDFAIL, break `shieldskipall`; HH |
| 13 | the pair gate cut a MAG-dead Disable at my partner beside the partner's other moves | beside the partner's Protect every world was uninformative, and "never tested" was read as "has an effect" | the pair gate's answer is three-valued: futile / effect / unknown; only a SEEN effect makes a futility "the pair's" | UNKNOWN, break `twovalued` |

World fidelity (`solver/rotom/world.js`, the live client's builder, so ROTOM gets these too): a body that left and
came back inside the last turn is new (its Fake Out is selectable again); each active body's last move, Protect
streak and moves used since entry (Encore and Last Resort read them) and one PP spent per move it has used are laid
on from the log. Before these, three human clicks (a Fake Out, a First Impression, a Last Resort) were refused or
failed only because the world had forgotten the turn before.

## 3. Safety: does the human's own click survive? (held-out Reg M-C decisions)

Sample: fully observed joint decisions by TEST-split players (the split every solver net uses), both brought fours
complete, drawn by a seeded stride over the dataset (`solver/out/human/games.jsonl`, sha256 `9d07c522…ccf2b4c8`); the
position rebuilt by `solver/rotom/world.js` from the public state (the opponent's true brought four; hindsight about
the opponent is allowed here because the question is whether the gates' logic ever cuts a human's click). Full gates,
no budget. Bar, fixed first: >= 99.9%, and every loss explained by its replay.

**The confirmation run (seed 4, final code `37d1c2e7`, 2,000 decisions drawn fresh — no decision in it was ever used
to build or fix the gates):**

| | |
|---|---|
| decisions evaluated | 1,999 (1 unmatched, 0 errors) |
| the human's joint survived both gates | **1,996 — 99.85% [99.56%, 99.95%]** (Wilson 95%) |
| lost to MAG / to the pair gate | 2 / 1 |
| human clicks MAG called SOFT (weighted, not cut) | 0 |
| bar (>= 99.9%) | **NOT MET as a rate**: 3 losses where 1 was allowed |
| losses the replay shows failed or did nothing in the real game | **3 of 3** |

**Every loss, with its replay** (the raw log in `data/raw/games.gen9championsvgc2026regmcbo3/`):

| game, turn | the human's joint | cut by, and why | what the replay shows |
|---|---|---|---|
| `…2680094940`, t18 | (slot a empty) + **Toxic** at the foe's Toxapex | MAG, dead: a Poison-type cannot be poisoned, and nothing can switch in | `|move|p2b: Toxapex|Toxic|p1b: Toxapex` / `|-immune|` |
| `…2681426122`, t4 | Zap Cannon + **Tailwind** | MAG, dead: Tailwind was already up on that side | `|move|p2b: Salamence|Tailwind||[still]` / `|-fail|` |
| `…2678066931`, t3 | **Quick Guard** + Darkest Lariat | the pair gate. Neither foe on the field knew a priority move (the Fake Out user sat on the bench), so Quick Guard changes nothing beside any partner click. Traced: its one "effect" beside the partner's Parting Shot was a speed tie between two other bodies resolving differently in the two arms (see §6, limit 5) — so the cut is right and its label is an artifact | Quick Guard went up; the foes Protected and switched; nothing was blocked |

**So no loss is a gate error: each lost click failed or did nothing in the real game.** That is a different statement
from the bar, and both are reported: the rate, 99.85%, is below the 99.9% Will set. Humans make futile clicks —
about 1 decision in 700 here — and a gate that is right cuts them. Whether the bar should read "no loss the replay
contradicts" is Will's call.

**The earlier runs, reported rather than dropped.** Seed 1 was development; seeds 2 and 3 were confirmations of code
that each turned out to hold a defect (§2), and each was re-registered and re-drawn:

| run | code | result | what it found |
|---|---|---|---|
| seed 1, 686 decisions (stopped) | pre-`6a080b2c` | 11 losses | 8 KO- and heal-dependent pair cuts (→ the tall world), world fidelity (Encore, Last Resort, a Fake Out after a pivot), 1 human Tickle into his own partner's Protect (replay: `-activate … move: Protect`) |
| seed 1, 309 decisions (stopped) | `6a080b2c` | 2 losses | a turn-end heal washing a hit off the tall board (→ the 60% cap) |
| seed 2, 2,000 | `ff4a6cba` | 1,995 / 1,998 (99.85%) | 3 losses, all futile per replay (Close Combat into a Ghost, Poison Jab into a Steel, a second Perish Song: `-fail`); but 57 joints cut by the pair gate ON a MAG-dead click (→ fixes 8, 9) |
| seed 3, 2,000 | `685725dc` | 1,993 / 1,997 (99.80%) | 4 losses, all futile per replay (Aurora Veil with no snow, a Reflect already up, a Protect nothing could reach, a Wide Guard) — but the Wide Guard was cut on dice luck (→ fix 11), and 6 joints still cut on a MAG-dead click (→ fixes 12, 13) |
| **seed 4, 2,000** | **`37d1c2e7`** | **1,996 / 1,999 (99.85%)** | 3 losses, all futile per replay; 0 cuts on a MAG-dead click |

Unmatched (survival undefined): one mega Curse the dataset records with the user's own slot as its target (Curse
takes no target for a non-Ghost; the parser read the self-hit as one).

## 4. How much each gate removes, and that they remove different things

Same 1,999 decisions (seed 4, `37d1c2e7`), full gates. Tables: `solver/results/2026-09-25-gates/eval-n2000-s4-37d1c2e7.{summary,tables}.json`
(`solver/doduo/gate_tables.js`).

**Per-slot options (MAG).**

| verdict | options | share of judged |
|---|---|---|
| live | 33,835 | 96.60% |
| **soft** (weighted 1e-3, not cut) | 646 | 1.84% |
| **dead** (cut) | 546 | 1.56% |
| untested | 0 | 0.00% |
| not judged (a switch, a pass, a locked move, Struggle) | 5,068 | |

Dead, most often (move ids from the players' own sheets): tailwind 93, encore 36, direclaw 30, toxic 27, closecombat 27,
fakeout 23, highhorsepower 22, sludgebomb 20, auroraveil 19. Soft, most often: direclaw 73, closecombat 65, fakeout 59,
highhorsepower 55, shadowball 42, earthpower 29 — the "read" plays: a click that fails into the body now in and lands
on a switch-in.

**Joints.**

| | joints | share |
|---|---|---|
| the slot product | 206,376 | |
| refused by MEDICHAM's `legalActions` (one body switched in twice, two megas) | 3,333 | 1.62% of the product |
| legal | 203,043 | |
| cut by MAG (the joint holds a dead click) | 4,653 | 2.29% of legal |
| cut by the pair gate (run on EVERY legal joint, so its removals are its own) | 8,324 | 4.10% of legal |
| cut by either | 12,895 | **6.35% of legal** |

**The ablation: they remove different things.**

| | pair gate cuts | pair gate keeps |
|---|---|---|
| **MAG cuts** | 82 | 4,571 |
| **MAG keeps** | 8,242 | 190,148 |

- **MAG's removals the pair gate never touches:** 4,571 of 4,653 (98.2%). The 82 in both are joints with TWO
  independent faults — a dead click in one slot and a pair-futile click in the other; the pair gate's cut in every
  one of them is on the OTHER click. **Pair cuts made on a click MAG calls dead: 0.**
- **The pair gate's removals MAG never touches:** 8,242 of 8,324 (99.0%). MAG's verdict on the click each pair cut
  removed: live 8,256, soft 68, dead 0 — every one works for its slot beside SOME partner click.
- What the pair gate cuts, by shape (from each decision's first 12 cut joints; the population is the table above):
  Helping Hand beside a switching partner (239) and beside a Protecting one (151); a Fake Out at my own partner
  beside that partner's Shadow Ball (106); Sucker Punch at my partner beside a switch (103); a Protect beside the
  partner's Follow Me (54); an attack at my own partner while the partner Protects. Each is the engine's answer in the
  tall worlds; none is a rule written here.

**Capability counters** (a zero would be the finding): 2,000 positions played tall, 54 sleep clocks opened, 0 step
errors, ~25,000 MAG worlds and ~203,000 pair worlds skipped because the target's shield held, 10 representatives kept so
a partner's click stayed reachable, 57 MAG worlds uninformative (the body never acted). Cost of the FULL gate: 672
engine steps a decision, median 1.5 s (mean 4.4 s, max 76 s) — an offline instrument; in play it is lazy (§5).

**Earlier versions, for the record:** seed 2 (`ff4a6cba`): MAG 2.14% of legal joints, pair gate 6.66%, 57 pair cuts on
a MAG-dead click; seed 3 (`685725dc`): 2.27% and 6.73%, 6. The pair gate's share fell to 4.10% with fix 13: a click
never testable beside one partner no longer licenses cutting it beside the others.

## 5. Does it play better? (frozen release `eaa5becc54eb`, frozen team store, test pairs, paired seats)

Pre-registered (`solver/doduo/preregistration-gates.json`): SPRT elo0 0, elo1 +20, alpha = beta = 0.05, read once at
the bound or at 400 games (`solver/machamp/sprt.js`: pair i plays test pair i mod 173 — the frozen store holds 173
test pairs — twice on its own battle seed, seats swapped). Test pairs only: both players held out of every net.

**On the final gate code (`37d1c2e7`):**

| | games | W–L | score, Wilson 95% | SPRT (read at its end) | gate changed the pick | decision ms (gated / ungated): mean, p99, max |
|---|---|---|---|---|---|---|
| **DODUO-greedy, gated vs ungated** (seed 41) | 400 | 200–200 | **0.500 [0.451, 0.549]** | **INCONCLUSIVE** (LLR 0 at 400 games) | 25 of 2,870 decisions (19 MAG cuts, 6 pair cuts; 2 soft weights) | 181 / 32, 776 / 106, 16,211 / 815 |
| **MILTANK, gen5 nets, 1 s, gated vs ungated** (seed 42) | 400 | 202–198 | **0.505 [0.456, 0.554]** | **INCONCLUSIVE (LLR −0.67 at 400 games)** | 26 joints cut (26 MAG, 0 pair) in 6,294 gated candidate lists; the 150 ms budget stopped the gate before it could prove most verdicts (kept, untested) | 953 / 951, 995 / 998, 1,344 / 1,278 |

MILTANK: equal wall-clock held — the gate is paid out of the same 1,000 ms and the gated arm's decisions took the
same time (mean 953 against 951 ms, max 1,344 against 1,278). But inside that budget the gate can prove very little:
it cut 26 joints in 6,294 candidate lists and ran out of its 150 ms on most verdicts (which it then keeps). A gate that
cuts almost nothing cannot move a 400-game SPRT; 0.505 is what that looks like. 64 of the 200 pairs did not split
(33 won both, 31 lost both).

DODUO-greedy: every one of the 200 pairs split (one win each), so the 25 changed decisions changed no result — the
greedy human clone rarely clicks a dead or pair-futile move, and when it does the game goes the same way. The
capability counters are on every row of the SPRT's shards (0 fallbacks).

**On the previous gate code (`685725dc`), reported as run:**

| | games | W–L | score, Wilson 95% | SPRT | decision ms (gated / ungated): mean, p99, max |
|---|---|---|---|---|---|
| DODUO-greedy, gated vs ungated (seed 31) | 126 | 64–62 | 0.508 [0.422, 0.594] | **H0** at pair 63 | 141 / 24, 856 / 107, 6,184 / 244 |
| MILTANK gen5 nets 1 s, gated vs ungated (seed 32) | 354 | 165–189 | 0.466 [0.415, 0.518] | **H0** at pair 177 | 992 / 971, 1,752 / 1,381, 12,438 / 7,050 |

A development run on `ff4a6cba` through `machamp/gate.js` (346 games, the 173 test pairs once): DODUO-greedy gated
0.503 [0.450, 0.555]; in 2,547 gated decisions the gate changed DODUO's pick 23 times (16 MAG cuts, 7 pair cuts).
**Why DODUO-greedy barely moves:** its argmax is rarely a dead or pair-futile click (23 of 2,547 decisions in the
development run), so most games are played identically by both arms. **Why MILTANK may lose a little:** the gate is paid out of the same 1,000 ms, and the
gated arm's decisions ran over budget more often (p99 1,752 ms against 1,381). How often it changed the candidate
list is not known for this run: the SPRT killed its workers at the bound and a killed worker writes no summary
(fixed for the re-run: `solver/mew/play.js` now writes the counters on every row).

## 6. Limits, stated

1. **"Proved" means: in every world of the covering design, on both dice regimes.** Not the full product of the two
   opposing slots, and not every roll. A rescue that needs one specific option of EACH opposing slot, or a roll the
   pinned streams do not reach, can be missed. The held-out survival rate is what measures that cost.
2. **The world is the live client's world.** It has no stat spreads (open sheets do not carry them), no Transform
   copy, no Substitute, Taunt, Encore or Disable on the opponent, and no hidden durations. Each is a way the world can
   be MORE permissive than the game (a click the gate calls live that the game refuses) — the safe direction — except
   where the world refuses a click the game allows; every such case found was fixed (§2) or is an unmatched decision.
3. **Soft is a policy weight (1e-3), not a measurement.** So are the tall factor (4,096), the 60% cap and the
   MILTANK gate budget (600 steps, 150 ms a side).
4. **The gate sees the #509 residual through a workaround,** not a fix: a world in which the click's target
   shielded AND the shield held is skipped (for a click the shield can block), so a status move at a body whose every
   option is a shield that always holds is never judged — untested, kept.
5. **The two arms of the pair gate's counterfactual can resolve a speed tie differently** (the event dice are
   addressed, but a tie's draw count depends on who is acting). A tie that falls differently shows up as a board
   difference — a spurious "effect". Its reach is bounded, and the argument is short: a spurious effect can only ADD
   evidence of an effect, so it can never make a click look futile beside a partner; the most it can do is let a
   click that is futile beside EVERY partner (MAG's territory, but a click that "succeeds", like a Quick Guard with no
   priority to stop) be cut by the pair gate instead of kept. Seen once in the confirmation losses; pinning the tie
   stream on both regimes is the fix, not applied, so that the measured code is the reported code.
6. **A click replaced mid-turn is judged as its replacement.** If my partner Encores my slot, the slot's move result
   is the encored move's — so a Reflect already up read as a "success" beside a partner Encore (seed 3). The
   direction is safe (it can only make MAG keep a click), and the pair gate still cut that Reflect beside every other
   partner click, correctly (the replay shows `-fail`).
7. **Cost.** The full gate (every option, every joint) is an offline instrument: seconds per decision. Inside a
   player it is lazy — only the joints the caller will read are verified — and bounded by a budget past which it cuts
   nothing.

## 7. Reproduce

```
node solver/tests/test-gates.js                                   # 30 checks, then 15 breaks, each must go red
node --max-old-space-size=4096 solver/doduo/eval_gates.js --release eaa5becc54eb --n 2000 --seed 4 --workers 3 --out solver/out/gates/eaa5becc54eb/eval-n2000-s4-37d1c2e7
node solver/doduo/gate_tables.js solver/out/gates/eaa5becc54eb/eval-n2000-s4-37d1c2e7
node solver/machamp/sprt.js --release eaa5becc54eb --x solver/doduo/specs/doduo-greedy-gated.json --y solver/machamp/league/human-clone.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 400 --seed 41 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/gates/eaa5becc54eb/sprt-doduo-greedy-gated-vs-clone-s41.json
node solver/machamp/sprt.js --release eaa5becc54eb --x solver/doduo/specs/gen5-gated.json --y solver/machamp/league/gen5.json --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 400 --seed 42 --workers 3 --team-store C:/Users/willj/Projects/Pokemon/ABRA/data/team-pool-frozen-regmc --out solver/out/gates/eaa5becc54eb/sprt-gen5-gated-vs-gen5-s42.json
```
Artifacts (small, tracked): `solver/results/2026-09-25-gates/`. Bulky shards: `solver/out/gates/eaa5becc54eb/` (ignored).
Every heavy run set its own priority to BELOW_NORMAL (`os.setPriority`, as `solver/mew/play.js` does); this agent's
shell could not call `cmd.exe /c tools\lownode.cmd`. At most three worker processes at a time.
