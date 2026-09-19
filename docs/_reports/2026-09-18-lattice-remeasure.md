# Three-lattice re-measure, diagnosis, and one fix (Beat Up) — 2026-09-18, ENGINE

A findings record, not a living document. It is superseded by the register rows it feeds and is not
cited as current state. `node engine/status.js` and `node engine/quarantine.js` hold the current state.

---

## 0. VERDICT

| release | `--games 1200` | `--games 1350` | `--games 1950` |
|---|---|---|---|
| `bc8d7cf849dd` (2026-09-12, prior) | 0 of 961 | 9 of 1069 | 21 of 1497 |
| `ffc11ac41a26` (tags bundle only) | **0 of 961** | **9 of 1069** | **21 of 1497** |
| `ce34d0a89f01` (Beat Up fix) | **0 of 961** | **7 of 1069** | **20 of 1497** |

These are board-material counts, computed as `state.games − state.games_board_never_diverged`.
Narration (undeclared, as the gate reads it) is **0 / 12 / 25** on all three releases. Protocol-diverged
games are 0 / 22 / 45 on `ffc11ac41a26` and 0 / 20 / 44 on `ce34d0a89f01`.

`node engine/quarantine.js` on `ce34d0a89f01` reads **`GATE: CLOSED — 1 of 8 GATING clauses fail`**. The
failing clause is whole-game BOARD-MATERIAL. NARRATION is `RPRT`: it reports and does not gate. The brief
said the gate was closed on two clauses; narration does not gate.

**The fix.** Beat Up now prices each hit off the ally's SET species, as `data/moves.ts:1155` does. Before
the run I predicted which three games would leave. Those three left and no game joined.

**Next mechanisms.** Four are tied at 2 games each. Each is checked against the authority and none is
probed yet: Transform does not run the copied ability's `Start` (Hospitality); Gooey's drop skips
Contrary and Defiant; Rough Skin is paid twice after a Parental Bond first hit KOs; an `allyswitch`
volatile stays on a benched body. The `vol.charge` lead is now diagnosed: a damaging Electric click
stopped by Protect keeps the bank. It is 1 game, red in a scratch staging.

---

## 1. TREE CONSISTENCY AND THE RELEASE

- `node build/build_tags_js.js --check` returned *"data/abra-tags.js is exactly what data/tags.json would
  produce."* Nothing was rebuilt.
- `node engine/engine_release.js cut …` produced **`ffc11ac41a26`**. Its `release.json` `files` digests
  differ from `bc8d7cf849dd` on one file only: `data/abra-tags.js` (`eb4b143f6599` → `594980dd86f1`).
  Both releases record the same `showdown_commit`, `20ad99ffc9a5…`.

## 2. THE RE-MEASURE ON `ffc11ac41a26` — PINS AND PROOF OF IDENTICAL SAMPLES

The invocation matches `latticeRerun()` in `engine/quarantine.js:3664-3666`. This is the lattice report's
§2 command. `--turns 50` is the default. The session-close OWED block omits `--arm middle`, and without
that flag every arm runs, so the session-close command would not have matched. I used the quarantine form:

```
tools\lownode.cmd engine/game_differential.js --steering empirical --release <id> --arm middle --end-state
  --census data/mechanics-census.json --team-store data/team-pool-frozen --games <N> --write --out <slot file>
```

I launched each run from Node through `spawn('cmd.exe', ['/c', 'tools\\lownode.cmd', …])` with an argv
vector (ROUTE A in `tests/probe_lownode_argv.js`). A first launch typed the backslash through a heredoc,
which lost it. cmd.exe reported `'toolslownode.cmd' is not recognized` and nothing ran. Every artifact
still carried its 2026-09-12 `generated` stamp. The relaunch ran.

The pins are identical across the three lattices and against the 2026-09-12 artifacts, except the release:

| field | 1200 | 1350 | 1950 |
|---|---|---|---|
| `games_requested` | 1200 | 1350 | 1950 |
| `steering.policy` | empirical-click/v1 | same | same |
| census `steering.input_digest` | `632a699468ca` | same | same |
| pool `steering.team_pool_digest` | `0d103fb9fa87` | `7e7a37ded7fc` | `a5ce76242f8d` |
| `team_store_pinned_to` | data/team-pool-frozen | same | same |
| `mode` | A/middle/pins:de38d17e15a2/credit:observed-effect/v1/nature:real | same | same |
| `turns_cap` / `end_state_mode` / `until_covered` | 50 / true / false | same | same |
| `driver_code_stable` | true | true | true |
| games played | 961 | 1069 | 1497 |
| boundaries identical | 10705/10705 | 11819/11842 | 16614/16702 |

The pool digests and games-played match the lattice report §2 exactly. The `first_board_divergences`
lists hold 0, 9 and 21 entries, below the cap of 40, so they are the whole population. They are the same
games, config and seed for seed, with the same diffs, as the HEAD artifacts
(`git show HEAD:data/game-differential.g1{350,950}.json`). That is the expected result: only the tags
bundle moved, and the node engine does not read it.

On the first write run, `--dump-out` was aimed one directory too high. `path.join` resolved it to
`C:\Users\AppData\…`, and the runs threw ENOENT after the artifacts had already been written. That
caused exit 1 on 1350 and 1950. The artifacts were complete and the `->` line printed before the throw.
I replayed the dumps without `--write`, and those replays reproduced 9/1069 and 21/1497
(`BOARD-MATERIAL GAMES` in their logs).

The gate read on `ffc11ac41a26` was `CLOSED — 6 of 8`. Four of those clauses were withheld as
"MEASURED AGAINST A DIFFERENT ENGINE" (damage differential, roster ×3, mechanics) because a release
had been cut. The fifth was board-material. The four were re-run after the fix, on the final release.

## 3. DIAGNOSIS — 30 BOARD-MATERIAL GAMES, BY MECHANISM

Sources: the full `--dump-games 300` output (22 of 22 and 45 of 45 diverging games, each with context),
joined to `state.first_board_divergences`. The cause printed on each card was treated as a hypothesis.
Where the check below says "authority", the rule was read from `/data/mods/champions/` first, then from
mainline. Exact speed ties: none of these is an ordering between tied bodies. The one ordering case,
Round, is a queue promotion. The rest are values or state.

| # | mechanism | games | lattice(s) | authority check |
|---|---|---|---|---|
| 1 | **Beat Up prices a mega / transformed ally off the field forme** — FIXED here | **3** | 1350 ×2, 1950 ×1 | `data/moves.ts:1155` `…set.species`; no champions override |
| 2 | Transform does not run the copied ability's `Start`: Hospitality from a transformed Ditto (heals the partner in SD) | 2 | 1950 ×2 | `sim/pokemon.ts:1946-1948` runs `Start` when `isTransform` and the ability differs; `transformInto` calls `setAbility(…, true, true)` |
| 3 | Gooey's Speed drop skips the target's Contrary (Staraptor-Mega) / Defiant (Kingambit) | 2 | 1950, 1350 | `data/abilities.ts:1636` `this.boost({spe:-1}, source, target, null, true)`, the standard boost pipeline |
| 4 | Rough Skin paid twice when a Parental Bond (Kangaskhan-Mega) first hit KOs | 2 | 1350, 1950 | champions hit loop breaks when every target is at 0 HP (`data/mods/champions/scripts.ts:461-464`, cited in `probe_volley_reactor_count.js`) |
| 5 | `vol.allyswitch 1\|0` on a BENCHED Runerigus, no protocol divergence | 2 | 1950 ×2 (same team, `…2635170965`) | not read yet; no card, because protocol never parted |
| 6 | **Charge bank kept after a DAMAGING Electric click stopped by Protect** | 1 | 1950 | `charge.condition.onAfterMove` (`data/moves.ts:2264+`) runs after a blocked move. Scratch staging on `ce34d0a89f01`: Thunderbolt into Protect → `vol.charge` medicham 1 / showdown 0; landing control 0 / 0 |
| 7 | Mummy overwrites Zero to Hero (MEASURE's lead) | 1 | 1950 | `mummy.onDamagingHit` returns on a `cantsuppress` source ability (`data/abilities.ts:2772`); Zero to Hero flags `cantsuppress` (`:5632`). Confirmed |
| 8 | Darkest Lariat misses a Minimized target | 1 | 1950 | `ignoreEvasion: true` (dex, read at run time) |
| 9 | Alluring Voice confuses unconditionally | 1 | 1950 | secondary `onHit` requires `target.statsRaisedThisTurn` |
| 10 | Decorate's boosts skip the target's Contrary (Malamar) | 1 | 1950 | Malamar-Mega ability 0 = Contrary; Decorate `boosts {atk:2, spa:2}` on the target |
| 11 | Heal Pulse ignores Mega Launcher (75%) | 1 | 1950 | `healpulse.onHit` `this.modify(target.baseMaxhp, 0.75)` when the source has Mega Launcher |
| 12 | Magic Bounce does not reflect Yawn (Hatterene) | 1 | 1950 | Yawn flags include `reflectable`; SD reflected it. The medicham side (the ability as built) is not read yet |
| 13 | Round not promoted after the ally's Round | 1 | 1350 | `round.onTry` walks `queue.list` and prioritises the other Round |
| 14 | Helping Hand succeeds at an ally that has already moved | 1 | 1350 | `helpinghand.onTryHit`: `if (!target.newlySwitched && !this.queue.willMove(target)) return false`. This is **not** "at a protecting partner" as #622 (9) says. The partner had simply already moved |
| 15 | Trace picks a different foe (Alakazam-Mega; toughclaws vs competitive) | 1 | 1950 | a random-target / sample die (#478 family). An address question, not a rule |
| 16 | Poison Touch on Fake Out beside Spicy Spray | 1 | 1950 | not diagnosed. Possibly a shared-die address |
| 17 | Full paralysis on one engine only (Sinistcha `cant par`) | 1 | 1950 | not diagnosed. Possibly a die address |
| 18 | Cursed Body disable absent (Triple Axel) | 1 | 1950 | #622 (6). Not re-read |
| 19 | Sleep woke on one engine only (Trevenant) | 1 | 1350 | #622 (3). Not re-read |
| 20 | Grav Apple damage 39 vs 16 on Torkoal | 1 | 1350 | #622 (1). Ratio is exactly 1.5, which fits Grav Apple's Gravity ×1.5; not verified |
| 21 | Game-end order: Life Orb (Slowking-Galar) / burn chip (Sinistcha) / a Lum Berry not eaten | 3 | 1350, 1950 ×2 | "one engine stopped emitting". End-of-battle ordering; each is 1 game with a different item |
| 22 | PP `thunderbolt 2\|1`, no protocol divergence | 1 | 1950 | #622 (2). Not read |

The rows sum to 30. Mechanism 21 is three different stop points and is counted as three
leads, not one.

## 4. THE FIX

**Authority.** `data/moves.ts:1154-1155`:

```ts
basePowerCallback(pokemon, target, move) {
    const setSpecies = this.dex.species.get(move.allies!.shift()!.set.species);
```

`set.species` is the team sheet's species. Mega evolution, Transform and a forme swap do not rewrite it.
`data/mods/champions/moves.ts` has no `beatup` key; the probe checks this at run time.

**Engine.** `beatUpAllies` (`engine/medicham2-browser.js`) read `_bsAtk`. WIRE 83 rewrites that field
on `megaEvolveNow`, `transformOnto`, the forme swap and `imposterRevert`, and Beat Up is its only reader.
The change: `buildMon` stamps `_setBsAtk` from `m.bs.atk`, the row the body is built from, not the mega
row `mf`. Nothing rewrites it. `beatUpPowerAtk()` reads it. A body without the field falls back to
`_bsAtk` and is counted in `MEDFAILS.beatUpNoSetSpeciesAtk`. `MEDI_BEATUP_FIELD_FORME=1` restores the
old read and stamps `MEDFAILS.beatUpFieldFormeRestored`.

**Probe, red first.** `tests/probe_beatup_set_species.js` has five arms. The side is Weavile (Beat Up),
a partner, Kangaskhan and Hydreigon. The target is Snorlax, which clicks Stockpile both turns.

| arm | on `ffc11ac41a26` (pre-fix) | on `ce34d0a89f01` | under the knob |
|---|---|---|---|
| mega-corner (Staraptor → Staraptor-Mega) | SD `[18,18,15,15]` vs ME `[18,19,15,15]`, board PART | agree, board ok | PART on `p2.party.snorlax.hp` |
| mega-middle | SD `[16,16,13,30]` vs ME `[16,18,13,30]`, PART | agree | PART |
| transform-corner (Ditto → Snorlax) | SD `[18,10,15,15]` vs ME `[18,16,15,15]`, PART | agree | PART |
| plain-corner (control) | agree | agree | agree |
| plain-middle (control) | agree | agree | agree |

Pre-fix exit was 1 with *"4 failure(s) across 5 arm(s)"* (three DEFECT plus KNOB ABSENT). Post-fix exit
was 0 with *"all 5 arms clear"*. `tests/probe_beatup_ally_order.js` still reads "all 4 arms clear" on
`ce34d0a89f01`.

**Release `ce34d0a89f01`** was cut after the edit. `cmp` shows the live `engine/medicham2-browser.js`
equals the snapshot, and `engine_release list` reports "0 of 27 files have moved since".

## 5. RE-MEASURE ON `ce34d0a89f01`

The pins are the same as §2: census `632a699468ca`, pools `0d103fb9fa87` / `7e7a37ded7fc` /
`a5ce76242f8d`, the same mode, cap 50, end-state, and `driver_code_stable: true`.

| `--games` | games | board-material | protocol | boundaries identical | generated |
|---|---|---|---|---|---|
| 1200 | 961 | **0** | 0 | 10705/10705 | 2026-09-19T00:45:31Z |
| 1350 | 1069 | **7** (was 9) | 20 (was 22) | 11825/11842 | 2026-09-19T00:47:08Z |
| 1950 | 1497 | **20** (was 21) | 44 (was 45) | 16619/16702 | 2026-09-19T00:51:30Z |

The set difference against `ffc11ac41a26` shows three games gone:
`omit-weather …2635200630 vs …2634296085` (Metagross),
`pair-speedctrl …2634623157 vs …2635935818` (Floette), and
`pair-redirect-priority …2653923955 vs …2653911846` (Gholdengo). No game is new, and every remaining
game's first diffs are byte-identical.

These artifacts were then re-run on `ce34d0a89f01` so the gate would not withhold them:
- `data/engine-diff.json`: 0 of 6000 at the midpoint, top, bottom and idx01–idx14 (seed 20260804).
- `data/roster.items.json` 148 match / 0 / 0; `roster.abilities` 190 / 5 CNS / 5 deferred / 0 differ / 0
  DNF; `roster.moves` 492 / 2 CNS / 3 deferred / 0 differ / 0 DNF. These are unchanged.
- `data/all-mechanics-fire.json`: 4,702 games, 0 threw. The clause reads 2 diverge, 1 declared, 1 below
  the shelf, leaving 0.
- `tests/test-mechanics.js`: census 886 probed / 886 live / 0 missing, unchanged. It was run after
  every census-pinned measurement, so it pins nothing above. Its new digest is **`959405d780a2`**, which
  means the next lattice re-run is under a different census pin.

Gate: **`CLOSED — 1 of 8`**. Damage differential, roster ×3, coverage, mechanics and open-defect PASS.
Board-material FAILs at 0 / 7 / 20. Narration RPRTs 0 / 12 / 25.

## 6. THINGS THAT WERE NOT AS BRIEFED

- **Other agents are writing into the main tree and into this session's scratchpad.** Three locked
  agent worktrees exist (`.claude/worktrees/agent-a3958…`, `-a8553…`, `-a9f3a…`). During this pass,
  files I did not write appeared or changed in the MAIN tree: `docs/ROADMAP.md`,
  `engine/register_reality.js`, `tests/probe_random_target_address.js`,
  `tests/probe_selfdestruct_winner.js`, the new `tests/probe_corpse_priority_galewings.js` and
  `tests/probe_protect_stall_lifecycle.js`, and `docs/_reports/2026-09-18-register-hygiene.md`.
  `data/tag-consumption.json` also changed; `git diff` shows line endings only. About 40 files I did not
  write appeared in the scratchpad (`gag*.txt`, `mech_*.txt`, `red_probe_*.txt`, …), and one of them
  shows roster runs on a release `4a13ae246e89` that is not in `data/releases/`. None of these is a
  SOURCES file. My measurements read frozen releases, and `driver_code_stable` was true on all six
  lattice runs, so nothing in frame moved. Still, "the only agent that plays games" was not true. I
  touched none of their files and deleted nothing.
- The session-close OWED lattice command omits `--arm middle`; the quarantine `latticeRerun` includes it.
- #622 (9), "Helping Hand succeeds at a protecting partner", is misdescribed. The authority fails it
  because the ally already moved (`queue.willMove`), not because of Protect.

## 7. FILES CHANGED BY THIS PASS

Code and tests: `engine/medicham2-browser.js`, and `tests/probe_beatup_set_species.js` (new).
Docs: `CHANGELOG.md` (6.47.0), `docs/RUNNING-NOTES.md`, `docs/ENGINE.md`, and the generated blocks in
`docs/{ENGINE,MEASURE,SEARCH,OPS,WEB}.md` (`status.js --write`); this report is new.
Data: `data/engine-release.json`, `data/releases/ffc11ac41a26/`, `data/releases/ce34d0a89f01/`,
`data/game-differential.json`, `data/game-differential.g1350.json`, `data/game-differential.g1950.json`,
`data/engine-diff.json`, `data/published-samples.json`, `data/roster.{items,abilities,moves}.json`,
`data/roster.{items,abilities,moves}.prev.json`, `data/roster.json`, `data/all-mechanics-fire.json`,
`data/mechanics-census.json`, `data/open-work.json` and `data/provenance-stamp.json` (the last two were
already modified before this pass; `status.js` rewrites them).

Not touched: the held 7.0.0 documents and `docs/_reports/2026-09-11-700-*`. No git command was run.

## OWED, NOT RUN

The next fix. It is batch-of-one, and any of the four 2-game leads could come first. Write each probe
red first, from PowerShell:

```powershell
# 1. Transform runs the copied ability's Start (Hospitality). Stage: Ditto uses Transform on a Hospitality body with a damaged partner beside it
# 2. Gooey's drop through the boost pipeline. Stage: a Contrary body and a Defiant body making contact with a Gooey holder
# 3. Parental Bond + Rough Skin when hit 1 KOs
# 4. the allyswitch volatile on a benched body: read the cause first
# and the 1-game Electric-bank-through-Protect lead, red in a scratch staging:
$env:SHOWDOWN_PATH="C:/Users/willj/Projects/Pokemon/pokemon-showdown"
cmd /c tools\lownode.cmd tests\probe_electric_charge_abort.js --release <new>   # extend with a Thunderbolt-into-Protect arm
```

After any engine change, cut a release and re-measure. The census is now `959405d780a2`, so the new
lattices are a new census pin as well:

```powershell
node engine/engine_release.js cut "<why>"
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release <new> --arm middle --end-state --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1200 --write --out data/game-differential.json
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release <new> --arm middle --end-state --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1350 --write --out data/game-differential.g1350.json
cmd /c tools\lownode.cmd engine\game_differential.js --steering empirical --release <new> --arm middle --end-state --census data/mechanics-census.json --team-store data/team-pool-frozen --games 1950 --write --out data/game-differential.g1950.json
cmd /c tools\lownode.cmd tests\test-engine-diff.js --n 6000 --seed 20260804
cmd /c tools\lownode.cmd tests\roster.js --stage items --reds --write --release <new>
cmd /c tools\lownode.cmd tests\roster.js --stage abilities --reds --write --release <new>
cmd /c tools\lownode.cmd tests\roster.js --stage moves --reds --write --release <new>
cmd /c tools\lownode.cmd engine\all_mechanics_fire.js --kind all --write --release <new>
node engine/quarantine.js
```

Register work, not done here (MEASURE or the router): a row for the Mummy / `cantsuppress` lead, which
has none; the correction to #622 (9) above; and refreshing #622 with this grouping. The publisher must
also commit, because `tests/test-docs-current.js` clause 5 counts 23 bot `docs/ORIENTATION.md` commits
since the notes page last moved. Its other two FAILs are in the held 7.0.0 documents, which are
unchanged by this pass.
