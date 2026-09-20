# An ability-sourced stat change announces the ability above its first stat line. One function, ten sites.

**2026-09-19. ENGINE, LIGHT MODE, isolated worktree**
`C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-a30a7aef401c15ab7`.
No gate lattice, no full battery, no `quarantine.js`, no `status.js --write`, no commit, no push.
`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.

Answers the largest class of `docs/_reports/2026-09-19-ability-line-blindness.md` (main tree, 6.72.0,
HEAD `221ab64a`): **198 games where the authority announces an ability before an ability-sourced boost
and this engine writes no line**, plus **4 where this engine announces Defiant and the authority
refuses on a capped stat**.

---

## 1. THE AUTHORITY'S RULE, READ WHOLE

`sim/battle.ts:2017-2085`, `Battle#boost`. **Champions overrides no `boost`** — `data/mods/champions/
scripts.ts` was grepped for `boost` and its only hits are the accuracy/evasion stage table
(`:485-502`) and a `ModifyBoost` read (`:488`, `:497`). So mainline IS the authority here.

```js
let boosted = isSecondary;                                                       // :2034
for (boostName in boost) {
  let boostBy = target.boostBy(currentBoost);        // the APPLIED delta, AFTER the ±6 clamp
  let msg = '-boost';
  if (boost[boostName] < 0 || target.boosts[boostName] === -6) { msg = '-unboost'; boostBy = -boostBy; }
  if (boostBy) {
    switch (effect?.id) {
    case 'bellydrum': case 'angerpoint':
      this.add('-setboost', target, 'atk', target.boosts['atk'], '[from] ' + effect.fullname);
      break;                                                                     // :2047-2049
    default:
      if (!effect) break;
      if (effect.effectType === 'Move')      { this.add(msg, target, boostName, boostBy); }
      else if (effect.effectType === 'Item') { this.add(msg, ..., '[from] item: ' + effect.name); }
      else {
        if (effect.effectType === 'Ability' && !boosted) {
          this.add('-ability', target, effect.name, 'boost');                    // :2065-2067
          boosted = true;
        }
        this.add(msg, target, boostName, boostBy);                               // :2069
      }
    }
  } else if (effect?.effectType === 'Ability') {
    if (isSecondary || isSelf) this.add(msg, target, boostName, boostBy);        // :2074-2076
  } else if (!isSecondary && !isSelf) { this.add(msg, target, boostName, boostBy); }
}
```

**Which event announces:** `|-ability|TARGET|<effect.name>|boost` — four fields, the tail literally
`boost`, the body being BOOSTED (not the source).

**In what order:** ABOVE the `-boost`/`-unboost` line, `:2065` then `:2069`, with nothing between.

**How often:** ONCE per `boost()` CALL, not once per stat. `boosted` is a single latch over the whole
table, so Weak Armor's `{def:-1, spe:+2}` is one announcement and two stat lines, and Moody's
`{plus:+2, minus:-1}` — built as ONE table and passed to ONE `this.boost(boost, pokemon, pokemon)`
(`data/abilities.ts` moody, read whole) — is also one announcement.

**When it does NOT announce, three ways, all of them live:**
1. **A boost of zero on a capped stat.** The announce sits INSIDE `if (boostBy)`. At +6 (or -6) the
   applied delta is 0, control falls to `:2074`, and the authority writes the ZERO stat line (when the
   handler passed `isSecondary` or `isSelf`) and **no ability line at all**.
2. **`isSecondary`.** `boosted` STARTS at `isSecondary`, so a handler passing `true` announces nothing
   from `boost()`. Intimidate, Supersweet Syrup and Mirror Armor are that case and each writes its own
   `-ability` line in its handler; Gooey is that case with no line of its own.
3. **The `-setboost` family.** `case 'angerpoint'` (and `bellydrum`) writes `-setboost` and BREAKS
   before the `default` branch is ever reached. **Anger Point announces nothing** and must keep
   announcing nothing.

---

## 2. THE FIX — ONE FUNCTION, AND THE MEMBERSHIP IS DERIVED

`abilityBoostRun(body, abilityId, {isSecondary})` in `engine/medicham2-browser.js`, sited beside
`abilityZeroAnnounces`. It holds the authority's `boosted` latch for the length of ONE `boost()` call
and exposes `.bst(engStat, appliedDelta, zeroSays, from)`, which writes the announcement on the first
non-zero delta and then the stat line. `.done()` counts a run that announced nothing, so a road that
never fires is visible rather than indistinguishable from a road nobody walked.

**TEN call sites are routed through it. Six of them wrote no announcement at all, two announced
UNCONDITIONALLY where the authority is silent at a cap, and two already had the rule inline and now
share it rather than restating it.**

| site | tag it reads | what it was |
|---|---|---|
| `absorbGift` | `typeImmunity.gain.boosts` | no line (Lightning Rod, Sap Sipper, Motor Drive) |
| `buffsHolderOnHit` loop | `buffsHolderOnHit.boosts` | no line (Stamina, Weak Armor, Justified) |
| the residual per-turn boost | `boostsEachTurn.boosts` | no line (Speed Boost) |
| Moody's residual pair | `randomBoostEachTurn` | no line |
| the flinch payout | `boostsOnFlinch.boosts` | no line (Steadfast) |
| Opportunist's copy payout | `copiesFoeBoosts` | no line |
| `retaliateWhenLowered` | `boostsWhenLowered.boosts` | announced UNCONDITIONALLY (Defiant, Competitive) |
| `_hpThresholdBoost` | `boostsAtHPThreshold.boosts` | lazy and correct (Berserk, Anger Shell) |
| `_koBoost` | `boostsOnKO.stat` | announced unconditionally (Moxie, Eelevate) |
| the punish drop | `punishesAttacker.boosts` | lazy and correct (Gooey), now shares the latch |

**Anger Point is deliberately NOT routed** — its branch keeps writing `-setboost` and no announcement,
per `:2047`.

### The derived membership, printed on every probe run

The probe and the census row read the class out of `data/tags.json` — **any ability whose tag params
carry a `boosts` table, Moody's `randomStat`, or a `stat`+`stages` pair, walked to any depth** (so
`typeImmunity.gain.boosts` is found two levels down). Printed before anything read it:

```
angerpoint        buffsHolderOnHit.boosts          moody             randomBoostEachTurn.randomStat
berserk           boostsAtHPThreshold.boosts       motordrive        typeImmunity.gain.boosts
competitive       boostsWhenLowered.boosts         moxie             boostsOnKO.stat
defiant           boostsWhenLowered.boosts         sapsipper         typeImmunity.gain.boosts
eelevate          boostsOnKO.stat                  speedboost        boostsEachTurn.boosts
gooey             punishesAttacker.boosts          stamina           buffsHolderOnHit.boosts
intimidate        onSwitchInDrop.boosts            steadfast         boostsOnFlinch.boosts
justified         buffsHolderOnHit.boosts          supersweetsyrup   onSwitchInDrop.boosts
lightningrod      typeImmunity.gain.boosts         weakarmor         buffsHolderOnHit.boosts
18 abilities
excluded (`-setboost` family, sim/battle.ts:2047 breaks before the announce): angerpoint
```

**NO OVER-MATCH, checked before wiring:** every one of the 18 genuinely applies a stat change.
`intimidate` and `supersweetsyrup` are in the class and are correctly SILENT through this road,
because their sites pass `isSecondary: true` — `boosted` starts armed, exactly as `:2034` says, and
each writes its own line in its own handler.

**Two members were fixed that the pinned pool never saw** — Steadfast and Opportunist. Neither appears
in the 250-game blind spot; both were wrong and both are right now, which is the whole return on
routing rather than naming.

---

## 3. DEFIANT AT THE CAP — THE MIRROR-IMAGE DEFECT

`retaliateWhenLowered` wrote `TR.ab(f, ab, 'boost')` above its loop, unconditionally. A Defiant body at
+6 Attack that takes a drop on ANOTHER stat (Icy Wind's Speed, Parting Shot's second stat) retaliates
`{atk: +2}` into a capped stage: the applied delta is 0, `:2065` is never reached, and the authority
writes only `|-boost|X|atk|0`. This engine wrote the announcement as well — §3c of the blindness
report, 4 games.

The announcement is now `abilityBoostRun`'s, so it fires on the first non-zero delta and never on a
capped one. Measured on the probe's `DEFIANT-CAP` arm, both engines:

```
["boost:p2a:atk:2","boost:p2a:atk:2","boost:p2a:atk:2","unboost:p2a:spe:1","boost:p2a:atk:0"]
```

The zero line is present on both sides and the announcement is on neither.

**The same defect was found in `_koBoost` by generalising** — Moxie announced unconditionally too, and
a Moxie KO at +6 Attack is not in the pinned pool's 250. It is fixed by the same routing.

---

## 4. THE PROBE, AND THE KNOB THAT PUTS IT RED

`tests/probe_ability_boost_announce.js` — 15 staged games, both engines, the same pinned dice, on
release `5c1004a454fa`.

Seven member arms (Stamina, Speed Boost, Moody, Lightning Rod, Sap Sipper, Weak Armor, Defiant-live),
one capped arm (Defiant at +6), seven controls carrying the SAME body on a non-member ability. What is
compared is the **interleaved** sequence of `|-ability|…|boost` and `|-boost|`/`|-unboost|` lines, so
the ORDER is asserted and not just the presence.

```
STAMINA        ["ABILITY:p2a:stamina","boost:p2a:def:1"]                     both engines
SPEEDBOOST     ["ABILITY:…","boost:p2a:spe:1","ABILITY:…","boost:p2a:spe:1"] both engines (2 calls)
MOODY          ["ABILITY:…","boost:p2a:spe:2","unboost:p2a:atk:1", …]        both engines (ONE announce per PAIR)
LIGHTNINGROD   ["ABILITY:p2a:lightningrod","boost:p2a:spa:1"]                both engines
SAPSIPPER      ["ABILITY:p2a:sapsipper","boost:p2a:atk:1"]                   both engines
WEAKARMOR      ["ABILITY:p2a:weakarmor","unboost:p2a:def:1","boost:p2a:spe:2"] both engines (ONE announce, TWO lines)
DEFIANT-LIVE   ["unboost:p2a:spe:1","ABILITY:p2a:defiant","boost:p2a:atk:2"] both engines
DEFIANT-CAP    [… ,"unboost:p2a:spe:1","boost:p2a:atk:0"]                    both engines, NO announce
CLEAN ARM  PASSED — every claim held      abilityBoostAnnounced +9
```

**THE AUTHORITY IS ASSERTED SEPARATELY ON EVERY ARM** — the member arms claim the authority writes
exactly N announcements and each one IMMEDIATELY above a stat line; the controls claim it writes NONE.
Without that the engine-vs-engine comparison would be green on two engines that were both silent.

**NARRATION ONLY, ASSERTED AND NOT CLAIMED.** Every arm asserts `stateDiv === null` and
`boundariesAgreed === boundaries` — no board leaf parts, on the clean arm AND under the knob. 15 arms,
2-5 board boundaries each, all identical.

### RED FIRST

`MEDI_ABILITY_BOOST_SILENT=1` takes the whole shared road quiet: no announcement anywhere on it, and
Defiant/Competitive announcing unconditionally at their own site (the old line is kept, behind the knob,
verbatim). Stamped at load as `MEDFAILS.abilityBoostAnnounceRestored`.

**IT IS NOT A BYTE-FOR-BYTE PRE-FIX ENGINE AND THE CODE SAYS SO.** For the six families that had no
line at all it is the old engine verbatim, and for Defiant it restores the unconditional line; for
Berserk, Moxie / Eelevate and Gooey it goes FURTHER, because those three already announced correctly
and are silenced with the rest. The knob's job is to prove the ROAD carries the line, not to
reconstruct a commit — and §6 measures the gap at exactly two games.

```
node tests/probe_ability_boost_announce.js --red --release 5c1004a454fa
  every member arm PARTS from the authority again
  every control HOLDS
  the RED arm STAMPED its restore counter    abilityBoostAnnounceRestored = 1
  abilityBoostAnnounced +0                   the knob reached the rule
PASSED — every claim held
```

**`DEFIANT-LIVE` IS A CONTROL IN THE RED ARM AND THE PROBE SAYS SO OUT LOUD.** The pre-fix engine
announced Defiant unconditionally, which is the RIGHT line whenever the boost actually applies — the
defect was only ever the capped case, which `DEFIANT-CAP` carries. An arm asserting that DEFIANT-LIVE
"must part" would be asserting a defect that never existed, and would go green on an engine that had
lost the line entirely.

`abilityBoostAnnounceRestored` is in `tests/test-mechanics.js`'s `DELIBERATE_BREAK`, so a red
demonstration cannot write the census.

---

## 5. THE CENSUS

| | HEAD (`git show HEAD:data/mechanics-census.json`) | now |
|---|---|---|
| probed | 970 | **971** |
| **live** | **970** | **971** |
| missing | 0 | **0** |
| threw / hollow | 0 / 0 | 0 / 0 |

New row: `ability / abilityBoostAnnounce` — *"an ability-sourced stat change announces the ability
above its first stat line — and says nothing when the stat is capped"*. Three arms: Stamina hit
(one announcement, immediately above the `-boost`), the same body with no ability (nothing at all),
and a Defiant body at +6 Attack taking a Speed drop through a real turn (the zero stat line, no
announcement). The member set is derived from `data/tags.json` in the row itself and printed in the
detail.

### TWO EXISTING ROWS WENT RED ON THE FIX AND BOTH WERE THE PROBE, NOT THE ENGINE

Caught because the census dropped 970 → 969 before they were corrected. Both counted LINES and the fix
adds a line the authority writes:

- **`condition / residualPerishStep`** folded the Speed Boost arm's `-ability` and `-boost` into one
  `BOOST` token and read `BOOST BOOST`. The tokeniser now names the announcement `ANNOUNCE` and the
  arm asserts `p1a p1b p2a p2b ANNOUNCE BOOST` — **strictly stronger than before**, because it now
  also asserts the announcement sits above the stat line.
- **`move / redirects`** asserted the Lightning Rod arm emits exactly ONE line. It now emits two, and
  both are the authority's: `-activate` for the redirect (`onAnyRedirectTarget`) and
  `-ability|…|Lightning Rod|boost` for the absorb that follows (`onTryHit`'s `this.boost({spa: 1})`).
  The row now checks the two lines per-line, so a third would still fail it.

---

## 6. THE WHOLE-GAME REPLAY — ONE KNOB, ONE RELEASE, ONE POOL, SAME 260 GAMES

The blindness report's seeds live in another session's scratchpad, so the replay is done the way that
does not depend on them: **the same run, twice, with only `MEDI_ABILITY_BOOST_SILENT` moving.** Same
release (`5c1004a454fa`), same `data/team-pool-frozen`, same `--games 300`, same `middle` arm, same
cap 50, same 260 usable games, written to a scratch `--out`. `data/game-differential.json` and the two
lattice artifacts were NOT written.

| | BEFORE (`MEDI_ABILITY_BOOST_SILENT=1`) | AFTER |
|---|---|---|
| games | 260 | **260** |
| diverged (protocol) | 44 | **24** |
| causes | 30 | **20** |
| narration-only | 41 | **21** |
| **board-material** | **3 of 260** | **3 of 260 — UNMOVED** |
| `by_cause_reconciles` | true | true |

**TEN CAUSES GONE, ZERO NEW.** The full list, off the complete `by_cause` table and not off a capped one:

```
  7  event missing from medicham2 :: |-ability|p1a|speedboost|boost <> |-boost|p1a|spe|1
  3  event missing from medicham2 :: |-ability|p2a|moody|boost      <> |-boost|p2a|spa|2
  2  event missing from medicham2 :: |-ability|p1a|stamina|boost    <> |-boost|p1a|def|1
  2  event missing from medicham2 :: |-ability|p2a|moody|boost      <> |-boost|p2a|spe|2
  1  event missing from medicham2 :: |-ability|p2a|eelevate|boost   <> |-boost|p2a|atk|1
  1  event missing from medicham2 :: |-ability|p1a|moody|boost      <> |-boost|p1a|spa|2
  1  event missing from medicham2 :: |-ability|p2a|speedboost|boost <> |-boost|p2a|spe|1
  1  event missing from medicham2 :: |-ability|p1b|moxie|boost      <> |-boost|p1b|atk|1
  1  event missing from medicham2 :: |-ability|p1b|speedboost|boost <> |-boost|p1b|spe|1
  1  event missing from medicham2 :: |-ability|p2b|stamina|boost    <> |-boost|p2b|def|1
```

**THE BEFORE-ARM IS THE KNOB, NOT HEAD, AND THE DIFFERENCE IS TWO GAMES.** The knob silences the WHOLE
shared road, and Moxie / Eelevate announced correctly BEFORE this pass at their own site. So the honest
attribution is **18 games to this fix** (speedboost 9, moody 6, stamina 3) and **2 that were already
right and the knob over-silenced** (one Moxie, one Eelevate). Saying "20" would be crediting the fix
with two games it did not win.

**WHAT IS STILL THERE, AND NONE OF IT IS THIS CLASS:**

| remaining | games | whose |
|---|---|---|
| `-ability field 4` — the authority names the OLD ability on a rewrite | 15 | not mine, §OWED |
| Cloud Nine's `onSwitchIn` announcement | 6 | not this class, §OWED |
| a Forecast/weather ordering, a No Retreat, a Quick Guard body | 3 | not this class |

**BOARD-MATERIAL DID NOT MOVE**, 3 of 260 on both arms, which is the whole-game confirmation of the
per-arm `stateDiv === null` the probe asserts. Those 3 are pre-existing and are NOT this pass's: the
`--games 300` lattice is not one of the gate's three, and `d93a70a2` already measured 34 board-material
games in a 12,000-game held-out draw.

---

## 7. FILES CHANGED

| file | what |
|---|---|
| `engine/medicham2-browser.js` | `abilityBoostRun`; seven call sites routed through it; `MEDI_ABILITY_BOOST_SILENT` + `MEDFAILS.abilityBoostAnnounceRestored`; `MEDSEEN.abilityBoostAnnounced` / `…First` / `abilityBoostRunsSilent` |
| `tests/probe_ability_boost_announce.js` | NEW — 15 arms, both engines, `--red` |
| `tests/test-mechanics.js` | the `abilityBoostAnnounce` census row; `abilityBoostAnnounceRestored` in `DELIBERATE_BREAK`; `residualPerishStep` and `redirects` corrected for the new line |
| `data/mechanics-census.json` | regenerated — 971 probed / **971 live** / 0 missing |

`engine/game_differential.js` was **checked out verbatim from `221ab64a`** (`git checkout 221ab64a --
engine/game_differential.js`, `git diff 221ab64a` is empty). This worktree branched from `dec05b65`
and did not carry the honest comparator, so without it every `-ability` line would still be deleted
from both streams before comparison and nothing here could be measured. **Not edited** — imported.

`data/engine-release.json` was RESTORED from its backup at the end of the pass (pointer back at
`18773c22878f`); the backup is `<scratch>/ability-announce-boost/engine-release.json.bak`.
`data/provenance-stamp.json` was REVERTED: cutting a release moved its ratchet `mtime_only 178 -> 177`,
and the shrink is not earned — the missing file is `_scratch-bench-smoke.json`, untracked debris that
exists in the main tree and not in this worktree. A ratchet that moves because of where it was run is
not a measurement.

## PROPOSED NOTES ROW

```markdown
### 6.73.0 — 2026-09-19 — an ability-sourced stat change announces the ability above its first stat line

**What changed.** `engine/medicham2-browser.js` gained `abilityBoostRun`, the one announce-then-boost
road, and every ability-sourced stat change in the file is routed through it — the absorb gift, the
on-hit buffs, the per-turn boosts, Moody's pair, the flinch payout, Opportunist's copy, the KO boost,
the HP-threshold boost, the punish drop and the lowered-stat retaliation. It keeps the authority's
four clauses (`sim/battle.ts:2017-2085`, `Battle#boost`; Champions overrides no `boost`): the
announcement is ABOVE the stat line, ONCE per `boost()` call, INSIDE `if (boostBy)` so a capped stat
says nothing, and `boosted` starts at `isSecondary`. The `-setboost` family (Anger Point) is excluded
by the authority's own `case` at `:2047` and still announces nothing.

**Figure.** `data/mechanics-census.json` (regenerated this pass): **971 probed / 971 live / 0
missing**, up from 970 / 970 / 0 at `dec05b65`. The new row is `ability / abilityBoostAnnounce`;
`tests/probe_ability_boost_announce.js` is green on 15 staged arms against the authority and red under
`MEDI_ABILITY_BOOST_SILENT=1`. Membership is derived from `data/tags.json` (18 abilities, printed on
every run), never named.

**Supersedes.** Nothing published. The 198-game and 4-game classes of
`docs/_reports/2026-09-19-ability-line-blindness.md` §3a/§3c are addressed; the three gate lattices
have NOT been re-run and no narration figure is claimed here. The withheld `0 undeclared of 961` stays
withheld.

**Basis.** unchanged — the census still counts "probes whose arms both fire and whose engine matches
the authority", and the whole-game narration question is unchanged. The engine moved; the question did
not.

**Owes.** `docs/ENGINE.md` (hand list), and the narration re-measurement at the three gate lattices.
```

---

## OWED, NOT RUN

- **THE THREE GATE LATTICES WERE NOT RUN AND NO NARRATION FIGURE IS CLAIMED.** The brief is LIGHT MODE.
  The whole-game evidence here is ONE scratch run at `--games 300` on release `5c1004a454fa` against
  `data/team-pool-frozen`, written to a scratch `--out`; `data/game-differential.json` and the two
  lattice artifacts were **not** touched. `--games` is part of the sample definition and 300 is not
  1200, so this number is NOT comparable to the blindness report's 250 of 961.
- **CLOUD NINE (16 games) IS NOT FIXED AND IS NOT IN THIS CLASS.** It announces from `onSwitchIn`
  (`data/abilities.ts:534-538`, `this.add('-ability', pokemon, 'Cloud Nine')` then a manual
  `onStart.call`), not from `boost()` and not from `onStart`. `tag_dex.js`'s `announcesOnStart`
  excludes it **deliberately and says so in its own comment** — a different door, which does not speak
  on a mega or a copied ability. Fixing it is a new derivation (`onSwitchIn` whose body is nothing but
  the announce plus a delegation), not a member of `abilityBoostRun`. **Routed on, untouched.**
- **THE `-ability field 4` CLASS (47 games) IS NOT MINE AND IS NOT TOUCHED.** `sim/pokemon.ts:1939-1941`
  writes the OLD ability's name as field 4 on every rewrite; this engine omits it. Separate call site,
  separate fix.
- **THE `ordering` CLASS (1 game, Unnerve vs Stealth Rock) IS NOT TOUCHED.**
- **FOUND, NOT FIXED: THIS ENGINE TAGS ITS ABILITY BOOST LINES AND THE AUTHORITY DOES NOT.** Every
  routed site still passes `'[from] ability: <id>'` to `TR.bst`, so it writes
  `|-boost|p2a: archaludon|def|1|[from] ability: stamina` where the authority writes
  `|-boost|p2a: Archaludon|def|1` bare — the `else` branch at `:2069` carries no `[from]` on ANY
  ability boost. It is invisible to the whole-game differential because `EQUIV`'s `stat-attribution`
  rule strips `[from]`/`[of]` from every stat line, and it is a real difference underneath that rule.
  **Deliberately left**, because removing it would change lines that ~20 staged probes compare raw and
  that is a second change riding on this one. `_hpThresholdBoost`'s own header already states the rule.
- **ANGER POINT'S SILENCE IS ARGUED FROM `:2047` AND IS NOT STAGED IN THE PROBE.** It needs a
  guaranteed crit, which is a die the staged arms do not carry. The census row
  `buffsHolderOnHit / 'Anger Point needs the crit'` exercises the boost and not the line.
- **THE FULL BATTERY WAS NOT RUN** (the brief forbids it). Run: the whole 971-row census (green),
  `probe_ability_boost_announce` clean and `--red`, `probe_ability_zero_boost_line`,
  `probe_ally_lightning_rod`, `probe_gooey_boost_road`, `probe_punish_announce`,
  `probe_shield_punish_boost`, `probe_damaginghit_walk`, `probe_narration_b_line_order` — all green.
  Any probe not in that list that compares a raw stream carrying one of the ten routed families may
  now be red, and has not been counted.
- **`probe_shield_punish_boost.js` REFUSES A `--release` ID** and requires `tests/_live_release.js`'s
  temp store unconditionally (`ENOENT … abra-live-release-store/releases/<id>/release.json`). Run
  without the flag it is green. Reported, not touched — it is not this pass's.
- **FOUND, NOT FIXED: SUPERSWEET SYRUP ANNOUNCES IN INTIMIDATE'S SHAPE AND THE AUTHORITY'S IS DIFFERENT.**
  Measured in the `--games 300` run: `|-ability|p2a|supersweetsyrup <> |-ability|p2a|supersweetsyrup|boost`,
  1 game. Two differences, both on the wire (`data/abilities.ts`, both handlers read whole):

  ```
  intimidate        for (const target of pokemon.adjacentFoes()) {
                      if (!activated) { this.add('-ability', pokemon, 'Intimidate', 'boost'); ... }
  supersweetsyrup   this.add('-ability', pokemon, 'Supersweet Syrup');     // BARE, and ABOVE the loop
                    for (const target of pokemon.adjacentFoes()) { ... }
  ```

  Intimidate's line carries the `boost` FOURTH FIELD and sits INSIDE the foe loop (so a carrier with no
  live foe says nothing); Syrup's is BARE and sits ABOVE it (so it announces regardless). This engine
  writes Intimidate's shape for both, at `applyEntryDrops`'s one `TR.ab(m, m.ability, 'boost')`.

  **THE DERIVATION IS WRITTEN AND WAS REVERTED, ON PURPOSE.** It was added to `engine/tag_dex.js`'s
  `onSwitchInDrop` rule and produced exactly the right two rows —
  `intimidate {"event":"-ability","tail":"boost","gatedOnFoe":true}` and
  `supersweetsyrup {"event":"-ability","tail":null,"gatedOnFoe":false}`:

  ```js
  const flat = src.replace(/\s+/g, ' ');
  const am = flat.match(/this\.add\(\s*["']-ability["']\s*,\s*\w+\s*,\s*["'][^"']+["']\s*(?:,\s*["'](\w+)["']\s*)?\)/);
  const loopAt = flat.search(/for\s*\(\s*const\s+\w+\s+of\s+\w+\.adjacentFoes\(\)/);
  const announce = am ? { event: '-ability', tail: am[1] || null,
                          gatedOnFoe: loopAt >= 0 && flat.indexOf(am[0]) > loopAt } : null;
  ```

  **IT CANNOT LAND FROM THIS WORKTREE.** Regenerating `data/tags.json` here requires the corpus, and
  this worktree has no store: the first regeneration wrote `uses: 0` on **804 entries** and
  `sheet_entries 316,656 -> 0`. Hard-linking the main tree's `games.ladder.jsonl` / `games.bo3.jsonl`
  did not fix it either — those are a STALE Sep-10 monolith beside the tracked shards, and they give
  `sheet_entries 282,072`, moving 689 usage counts DOWNWARD for a reason that has nothing to do with
  this change. **Both `engine/tag_dex.js` and `data/tags.json` were reverted** (`git checkout --`) and
  the two hard links were removed, rather than ship a degraded artifact or a generator ahead of it.
  Owed: paste the block above into `onSwitchInDrop`'s `of()` on the MAIN tree, run
  `node engine/tag_dex.js`, then read `announce` at `applyEntryDrops`.
- **RELEASE-CUT SIDE EFFECTS, REPORTED RATHER THAN REVERTED.** Three cuts in this worktree produced
  `f18681aa4fdf` (pre-fix), `5c1004a454fa` (the fix, which the `--games 300` pair ran on) and
  `2cdd655ef6ea` (the final bytes, which the probe runs on) under `data/releases/`, and moved
  `data/engine-release.json` and `data/provenance-stamp.json`. The pointer's prior contents are backed
  up at `<scratch>/ability-announce-boost/engine-release.json.bak`.
- **`data/team-pool-frozen/games.bo3.jsonl` and `games.ots.jsonl` ARE HARD LINKS** into the main tree,
  created by this pass so the differential could read the pinned pool without copying 140 MB. They are
  gitignored, they are links rather than copies, and nothing was written to them. **LEFT IN PLACE** —
  the pool is frozen by construction, so a link to it cannot go stale.
  `data/games.ladder.jsonl` and `data/games.bo3.jsonl` were linked the same way for the tag
  regeneration and **were removed again**, because unlike the pool those ARE stale (Sep 10, beside the
  tracked shards) and a later run in this worktree would have read them silently.
- **NOT COMMITTED, NOT PUSHED.** `CHANGELOG.md`, `docs/RUNNING-NOTES.md`, `engine/quarantine.js` and
  `engine/game_differential.js` were not authored, per the brief; the notes row is proposed above.
  `node engine/status.js --write` was not run.
