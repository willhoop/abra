# `probe_sec_addr_selfdrop.js` — which half of the merge broke it — 2026-09-19, ENGINE (LIGHT MODE)

This is a findings record, not a living document. It is not current state and is not cited as such.
`node engine/status.js` and `node engine/quarantine.js` hold current state. **No lattice, no full
battery and no `quarantine.js` was run in this pass, so nothing here is a claim about the gate.**
No git command that writes was run. `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js`
and `engine/game_differential.js` were not edited, and `status.js --write` was not run.

---

## 0. VERDICT — **(b), and more precisely: the INSTRUMENT moved, not the game and not the engine**

The brief offered two hypotheses. Measured, it is neither "the merge lost the fix" nor "other merged
fixes changed the game's course". It is the third thing the (b) branch covers: **the comparator
started comparing a line class it had deleted for 44 days**, and the probe's whole-game arm was
worded as a claim about that class.

- **(a) is REFUTED.** Both halves of the self-drop/corpse address fix are in
  `engine/medicham2-browser.js` on the merged tree and both FIRE on this run:
  `secAddrFromSelfDrop +4`, `kingsRockFlinchRefusedOnCorpse +1`, `kingsRockRolls +11`,
  `kingsRockRollSkippedOnKO +0`. The `self:` write is at `medicham2-browser.js:47001`
  (`if(sdrop&&!SEC_ADDR_IGNORES_SELFDROP){_secAddrSlot=midEventSlot(m);…}`) and the corpse case at
  `:45463-45483`. The direct claim — the t1 `sec` draws byte-identical in order — **passes on all
  three games**, and each knob still turns its own half red.
- **(b) is CONFIRMED, with the cause named.** The failing arm was not reading the mechanic.

## 1. PINS

| pin | value |
|---|---|
| release | `bcf89770cc61` (read off the probe's own header line, `G.REL.id`) |
| team store | `--team-store C:\Users\willj\Projects\Pokemon\ABRA\data\team-pool-frozen` |
| census | `data/mechanics-census.json`, digest `fb06d943a029`, 983 rows, generated 2026-09-20T01:51:24Z, **identical to the live census** |
| `--games` | **12000** — part of the sample definition, not a budget; each fixture names its own |
| arm | `middle` |
| flags | `--steering empirical --state --end-state --turns 50` |
| concurrency | every process was mine; nothing else was running in this tree |

## 2. THE MEASUREMENT

### What the parent read on the merged tree, before any edit

```
---- A  a `self:` move — Make It Rain out of a King's Rock Gholdengo
     omit-weather  arm middle  --games 12000  …bo3-2657252654 vs …bo3-2657249003
     replay: turns=9 protocol_div=26 board_div=null boundaries=10/10 err=-
     protocol split: sd |-ability|p1a: Blaziken|Speed Boost|boost
                     me |-boost|p1a: Blaziken|spe|1|[from] ability: speedboost
PASS  omit-weather t1: every `sec` draw OF THAT TURN is addressed identically  (4 draws, byte-identical)
FAIL  omit-weather t1: neither the protocol nor the board parts               (protocol at index 26)
```

Three facts settle it:

1. **The split line is not a flinch line and not a board line.** It is an ability ANNOUNCEMENT —
   the authority writes `|-ability|…|Speed Boost|boost` before an ability-sourced boost and this
   engine does not.
2. **The board never parts and the game's course did not change.** `board_div=null`,
   `boundaries=10/10`, 9 turns — the same course
   `docs/_reports/2026-09-19-heldout-stall-flinch.md` §3 recorded when the fix landed on release
   `6536e903efe2` ("both null, 10/10 boundaries"). The stall/weather/recoil/trapping/redirect/
   Fickle-Beam fixes in the merge did **not** reroute this game.
3. **The comparator is what changed.** Commit `221ab64a` (6.72.0) RETIRED
   `game_differential.js`'s `ability-announcement` equivalence, born with the file at `f60b01c7`
   and never edited in 44 days, which had dropped **every** `|-ability|` line from BOTH streams
   before comparing. That commit measured the newly-visible class at **250 of 961 games, all
   narration, board-material unchanged at 0** — 198 of them "we write no line where the authority
   announces before an ability-sourced boost", **Speed Boost 48**. This game is one of them. With
   those lines restored, the indices shift and the first protocol divergence lands at 26, three
   lines ahead of where the flinch split used to be (23) before the fix.

So the arm `!r.div && !r.stateDiv` had stopped being a statement about the secondary address: it was
asserting the whole-game narration zero, which **6.72.0 withdrew on purpose**.

### The knob controls, run separately with full detail

| run | `omit-weather` A | `omit-intimidate` B | `pair-speedctrl` B |
|---|---|---|---|
| parent, no knob | protocol 26 (`-ability`), **board null**, 10/10 | null / null, 7/7 | null / null, 12/12 |
| `MEDI_SEC_ADDR_IGNORES_SELFDROP=1` | protocol **23** (`|cant|…|flinch` vs `|move|…Overheat|[miss]`), **board 1**, 9/10, `p2.pp[1].overheat` 0/1 | null / null | null / null |
| `MEDI_KINGSROCK_SKIPS_DEAD=1` | protocol 26 (`-ability`), board null | protocol **85**, **board 5**, 5/7 | protocol **127**, **board 10**, 10/12 |

This is the design evidence for the repair: **the board arm alone is red under the knob that owns
each game**, and it reads the whole game — `stateDiv` is computed at every boundary independently of
where the protocol first parted, which the middle row proves (protocol 23, board 1, and the board
still caught it although a divergence preceded it).

## 3. WHAT CHANGED

**`tests/probe_sec_addr_selfdrop.js` only. No engine byte moved in this pass.**

Claim 4 was **split, not deleted**:

- **4a — THE BOARD.** `!r.stateDiv && r.boundaries > 1 && r.boundariesAgreed === r.boundaries`. No
  board leaf parts at any boundary of the whole game. This is the arm the knobs answer to.
- **4b — THE PROTOCOL, AND WHAT IT IS ALLOWED TO BE.** The protocol parts nowhere, **or** parts only
  on an `|-ability|` INSERTION — exactly one of the two raw lines is an `|-ability|` line — with
  **no flinch on either side**. A flinch split, a board-material split, or any other narration class
  is a FAILURE of this file. The `|-ability|` audit delta around the replay is printed beside the
  verdict (via the exported `G.abilityAuditRows()`) so the excusal is NAMED rather than asserted:
  `p1a:blaziken|speedboost|boost`, positive = the authority wrote it and we did not.

Two honesty notes written into the file at the site:

- The audit delta is **an upper bound, not a per-game line count**. `alignAndCheck` runs at the
  leads, at every turn and at the tail (`game_differential.js:4867, :5163, :5204`), each time over
  the whole stream so far, and audits on each pass — so one emitted line is counted once per
  remaining pass. The printed `+17` is therefore good for its SIGN and its KEY and for nothing else,
  and the comment says so. Reading it as "17 missing lines in a 9-turn game" would be wrong by
  roughly the turn count.
- The header carries the retraction in place: what the old arm said, why it went red with the
  mechanic green beside it, and that the comparator moved rather than the engine.

## 4. RESULT

```
SHOWDOWN_PATH=… node tests/probe_sec_addr_selfdrop.js                              -> exit 0   ALL ARMS PASS
SHOWDOWN_PATH=… MEDI_SEC_ADDR_IGNORES_SELFDROP=1 node tests/probe_sec_addr_selfdrop.js -> exit 1   3 FAIL
SHOWDOWN_PATH=… MEDI_KINGSROCK_SKIPS_DEAD=1      node tests/probe_sec_addr_selfdrop.js -> exit 1   6 FAIL
```

The parent's own claim 6 re-runs both children and reports `child exit 1, 3 FAIL line(s)` and
`child exit 1, 6 FAIL line(s)`. Under the self-drop knob all three of game A's arms go red (address,
board, protocol); under the KO-skip knob all six of games B's arms go red and **game A correctly
stays green**, because game A is half A's fixture and not half B's.

**Census: 983 live, 0 missing, `run_ok: true`, unchanged.** It could not have moved — no engine byte
changed in this pass — and it did not go down.

Files changed:

- `tests/probe_sec_addr_selfdrop.js` — claim 4 split into 4a/4b, the retraction and the audit-delta
  caveat written into the header and at the call site.
- `docs/ENGINE.md` — one bullet under the secondary-address entry recording the re-aim and its
  evidence. Nothing inside a `<!-- GENERATED -->` block was touched.

## 5. NOTES-ROW TEXT (for the coordinator — I did not edit the notes page)

> **`tests/probe_sec_addr_selfdrop.js` re-aimed after 6.72.0 retired the ability-announcement
> equivalence.** On release `bcf89770cc61`, pool `data/team-pool-frozen`, `--games 12000`, arm
> `middle`, census `fb06d943a029`, the probe's whole-game arm went red on `omit-weather` t1 with the
> mechanic green beside it: `protocol_div=26, board_div=null, boundaries=10/10`, the split line
> `|-ability|p1a: Blaziken|Speed Boost|boost` against our `|-boost|…|[from] ability: speedboost`. The
> engine did not move (`secAddrFromSelfDrop +4`, `kingsRockFlinchRefusedOnCorpse +1`, t1 `sec` draws
> byte-identical, both knobs still red); `221ab64a` made `|-ability|` lines comparable, and this game
> is one of the 250 newly-visible narration games. The arm is now two: no board leaf parts at any
> boundary, and any surviving protocol divergence must be an `|-ability|` insertion with no flinch on
> either side. Probe green (exit 0), red under each knob (exit 1, 3 and 6 FAIL lines). Census 983
> live, 0 missing, unchanged. **Supersedes.** Nothing — no published figure moves. **Basis.**
> unchanged.

---

## OWED, NOT RUN

- **The Speed Boost announcement itself is a real, open engine defect and I did not fix it.** This
  engine writes no `|-ability|…|boost` line where the authority announces before an ability-sourced
  boost. 6.72.0 sized the family at 198 of 961 games (Stamina 112, **Speed Boost 48**, Cloud Nine 16,
  Lightning Rod 10, Moody 8, Weak Armor 2, Sap Sipper 2) and withheld every narration figure. It is
  board-immaterial on that measurement and it is the reason 4b exists as an excusal rather than a
  zero. **When it is fixed, 4b should tighten to "the protocol parts nowhere" and the excusal branch
  should be deleted** — the file's header says so.
- **No lattice, no battery, no `quarantine.js`** — LIGHT MODE as briefed. Nothing here says whether
  the gate is open or shut.
- **`node tests/test-mechanics.js` was not re-run.** No engine byte changed, so the census cannot
  have moved; the artifact was read (983 live, 0 missing) rather than regenerated.
- **`node engine/status.js --write` was not run** and `CHANGELOG.md` / `docs/RUNNING-NOTES.md` were
  not edited, as briefed. The notes-row text is §5 above; the version bump and the restamp are the
  coordinator's.
- **Not committed, not pushed**, as briefed.
- **Debris reported, not touched:** the merged tree carries pre-existing modifications in
  `engine/medicham2-browser.js` (staged AND unstaged), `engine/coverage.js`, `engine/tag_dex.js`,
  `tests/roster.js` and others, plus untracked `engine/tag_descriptive.js` and fourteen untracked
  `docs/_reports/` files. None of them is mine and none was deleted.
