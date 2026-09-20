# The rewrite line names the outgoing ability, and an entry announcement that outranks the hazards is written above them

**2026-09-19. ENGINE. ISOLATED WORKTREE, LIGHT MODE.** Staged boards and single-game replays only. No
lattice run, no full battery, no `engine/quarantine.js`, no `status.js --write`, no commit, no push.

`SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown`.
Worktree: `C:\Users\willj\Projects\Pokemon\ABRA\.claude\worktrees\agent-ac0d80d92aba90c77`.
Release cut in this worktree and used for every pinned run below: **`8f1396257b70`** (27 files frozen).
`data/engine-release.json` was backed up before the cut and restored byte-for-byte afterwards.

This is two of the four mechanisms in 6.72.0's 250-game narration class
(`docs/_reports/2026-09-19-ability-line-blindness.md` §3b and §3d): **`-ability field 4`, 47 games over
42 causes**, and **`ordering`, 1 game**. The 198-game announce-before-boost class belongs to another
agent and was not touched.

---

## THE VERDICT

| | before | after |
|---|---|---|
| census (`data/mechanics-census.json`) | 970 live / 0 missing / 970 probed | **972 live / 0 missing / 972 probed** |
| `tests/probe_ability_rewrite_name.js` | did not exist | **27 claims, all green** |
| the same probe `--red` (`MEDI_ABILITY_REWRITE_NO_OLD=1`) | — | 5 rewrite arms PART, 6 controls hold |
| the same probe `--red-order` (`MEDI_START_ANNOUNCE_AFTER_HAZARDS=1`) | — | the Unnerve arm PARTS, 10 controls hold |
| census under either knob | — | **971 live / 1 missing, and the write is REFUSED** |

Nothing went down.

---

## 1. FIELD 4 — WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED

`sim/pokemon.ts:1936-1943`, `Pokemon#setAbility`'s `default` branch:

```js
default:
    if (source) {
        this.battle.add('-ability', this, ability.name, oldAbility.name, `[from] ${sourceEffect.fullname}`, `[of] ${source}`);
    } else {
        this.battle.add('-ability', this, ability.name, oldAbility.name, `[from] ${sourceEffect.fullname}`);
    }
    break;
```

`const oldAbility = this.battle.dex.abilities.get(this.ability)` is at `:1919`, and the assignment
`this.ability = ability.id` is at `:1930`. **So field 4 is the ability that was there a moment ago, and
it is written on every branch that writes the line at all — there is no case where it is absent.** What
varies is the `[of]`, and it varies with whether the caller passed a `source`.

This engine wrote `['-ability', ident(m), newAbility, '[from] …']` — four fields, with the `[from]`
sitting where field 4 belongs. 42 distinct ability names appear in the pool's causes because field 3
varies; the defect does not.

### THE LEGAL SET, DERIVED FROM THE CALL SITE

The line is written only when `sourceEffect && !isFromFormeChange && !isTransform` (`:1933`) and the
effect is neither Mummy nor Lingering Aroma, which take their own `-activate` case (`:1935-1937`).
Every caller, grepped out of `data/abilities.ts`, `data/moves.ts`, `data/conditions.ts`, `sim/*.ts` and
`data/mods/champions/scripts.ts`:

| caller | site | writes `-ability` + field 4 | `[of]` | in Reg M-B |
|---|---|---|---|---|
| Trace | `data/abilities.ts:5137` | yes | yes | **4 legal carriers** — Alakazam-Mega, Gardevoir, Meowstic-M-Mega, Meowstic-F-Mega |
| Receiver | `:3782` | yes | yes | **1** — Passimian |
| Power of Alchemy | `:3395` | yes | yes | legal ability, **0 legal carriers** |
| Entrainment | `data/moves.ts:4880` | yes | yes | **9 legal learners** |
| Role Play | `:15332` | yes | yes | **8** |
| Simple Beam | `:16492` (`target.setAbility('simple')`) | yes | **no** | **1** — Audino |
| Worry Seed | `:21066` (`target.setAbility('insomnia')`) | yes | **no** | **9** |
| Doodle | `:3828` (`setAbility(target.ability, null, move)`) | yes | **no** (`source` is explicitly `null`) | **`isNonstandard: 'Past'`** — `data/mods/champions/moves.ts:217` |
| Mummy | `data/abilities.ts:2776` | **no** — `-activate` case | — | 1 — Cofagrigus |
| Lingering Aroma | `:2384` | **no** — `-activate` case | — | 0 legal carriers |
| forme change | `sim/pokemon.ts:1493`, `data/conditions.ts:891`/`:921`, `data/mods/champions/scripts.ts:113` | **no** — `isFromFormeChange` | — | every mega |
| transform / Imposter | `sim/pokemon.ts:1358` | **no** — `isTransform` | — | Ditto |
| **Skill Swap / Wandering Spirit** | `sim/battle.ts:1310-1340` | **no — `setAbility` is never called.** `Battle#skillSwap` assigns `source.ability`/`target.ability` directly and writes ONE `-activate|Skill Swap|<gets>|<gives>|[of] …` | — | 42 learners / Runerigus |

**The only case where anything is "absent" is the `[of]`, not field 4.** Verified on the authority for
all five staged forms, where Simple Beam and Worry Seed write exactly five fields and the other three
write six.

### THE FIX — ONE SHARED SITE

`engine/medicham2-browser.js`:

- **`abRewrite(m, ab)` now RETURNS the outgoing ability.** That is the authority's own signature —
  `setAbility` returns `oldAbility.id` at `:1950` and every caller in `data/moves.ts` binds it
  (`const oldAbility = target.setAbility(...)`). It matters most on the SUPPRESSED road: upstream the
  parked ability is still `pokemon.ability`, so it is what `oldAbility` reads, and only `abRewrite`
  knows this engine keeps it in `m._abParked`.
- **new sink `TR.abFrom(m, newAb, oldAb, from)`** beside `TR.ab`, writing
  `['-ability', ident(m), newAb, oldAb, from]`.
- four call sites moved from `TR.ab` to `TR.abFrom`: Trace (`traceCopy`), Receiver
  (`inheritAbility`), the `abilitywrite` family (Entrainment / Simple Beam / Worry Seed) and Role Play.
- `MEDSEEN.abilityRewriteNamedOld` counts every line that carried the field.

The two `CONTACT_ABILITY_LEGACY` call sites (Mummy / Wandering Spirit under a deliberate-break knob)
were deliberately left alone: the live road already writes `TR.abinfect` / `abswap`, which is correct.

### STILL PARTIAL, DECLARED RATHER THAN LEFT TO BE FOUND

This engine still writes no `[of]` on any of these lines. That shortfall was already declared in
`traceCopy` and at the Receiver site before this pass, and the differential's `source-tag` rule strips
`[of] pXy` from both streams, so it does not part. **It is not fixed here and it is not claimed fixed.**

---

## 2. THE ORDER AGAINST THE ENTRY HAZARDS — A SORT, NOT A RULE ABOUT ABILITIES

The pool's card:

```
ordering :: |-ability|p2a|unnerve <> |-damage|p2a|H/H|[from]stealthrock
```

Reproduced exactly on a staged board before a byte moved: the authority writes the Unnerve line ABOVE
the rock damage and this engine wrote it below.

**The mechanism.** `BattleActions#runSwitch` fires ONE `fieldEvent('SwitchIn', switchersIn)`
(`sim/battle-actions.ts:184`). `fieldEvent` collects the entrant's own handlers through
`findPokemonEventHandlers(active, 'onSwitchIn')` — and from gen 5 an ability's `onStart` IS its
`onSwitchIn` (`getCallback`, `sim/battle.ts:1018-1032`) — together with the side's hazards through
`findSideEventHandlers(side, 'onSwitchIn', undefined, active)` (`:502`), which passes the ACTIVE
POKEMON as `customHolder`. It then `speedSort`s the lot (`:507`).

`comparePriority` (`:404-411`):

```js
return -((b.order || 4294967296) - (a.order || 4294967296)) ||
    ((b.priority || 0) - (a.priority || 0)) ||
    ((b.speed || 0) - (a.speed || 0)) ||
    -((b.subOrder || 0) - (a.subOrder || 0)) ||
    -((b.effectOrder || 0) - (a.effectOrder || 0)) || 0;
```

`resolvePriority` sets `handler.priority = effect.onSwitchInPriority || 0` (`:953`) and, absent an
explicit subOrder, gives a **side condition 4** and an **Ability 7** (`:957-987`). Because
`findSideEventHandlers` was handed the active Pokemon, BOTH handlers get `handler.speed = pokemon.speed`
(`:1001-1012`) — **the speeds tie**. So:

- an ability with **no** `onSwitchInPriority` ties on priority and speed and loses on subOrder — the
  rocks bite first, which is what this engine already did and is correct;
- an ability with a **positive** `onSwitchInPriority` wins on priority, before subOrder is reached.

**I derived this backwards first** and predicted rocks-before-Unnerve from the subOrder table alone.
The staged game said the opposite, and reading Unnerve showed why: `onSwitchInPriority: 1`
(`data/abilities.ts:5251`). The measurement corrected the derivation.

### THE MEMBERSHIP, FILTERED TO THE REGULATION

Every `onSwitchInPriority` in `data/abilities.ts`, against this format's legal carriers:

| priority | ability | legal carriers |
|---|---|---|
| **+2** | Neutralizing Gas, Tera Shift | **0** |
| **+1** | As One (Glastrier), As One (Spectrier) | **0** |
| **+1** | **Klutz** | 3 — Lopunny, Audino, Golurk |
| **+1** | **Unnerve** | 6 — Arbok, Aerodactyl, Houndoom, Tyranitar, Pyroar, Corviknight |
| −1 | Mimicry | 1 — Stunfisk-Galar |
| −1 | Schooling, Shields Down | 0 |
| −2 | Forecast | 4 (Castform line) |
| −2 | Hospitality | 2 (Sinistcha line) |
| −2 | Costar, Flower Gift, Ice Face, Protosynthesis, Quark Drive | 0 |

Items carrying one are all −1 or −2, so none moves.

**Klutz's `onStart` writes no line** — it is `this.singleEvent('End', pokemon.getItem(), …)`,
`data/abilities.ts:2273-2275` — and it is not an `announcesOnStart` member. **So Unnerve's is the only
line this moves**, which is exactly the one game the pool found.

### THE FIX

- `engine/tag_dex.js`: `announcesOnStart` now derives `switchInPriority: (+a.onSwitchInPriority || 0)`.
- `engine/medicham2-browser.js`: new `startAnnounceEarly(nx)`, called above `applyEntryConditions` on
  BOTH the placement road (`bringIn`) and the deferred road (`runEntryPass`, which is `refill`'s ordered
  walk). It emits only when `switchInPriority > 0`, leaves `nx._startAnnEarly` behind, and
  `applyEntryEffects` consumes that flag so the line is written exactly once per Start — the mega,
  copy and swap roads never set it and still announce from their own site.
- An entrant the hazard KILLS still spoke, which is the authority: `fieldEvent` skips a fainted
  holder's LATER handlers (`:512-513`), and a +1 handler has already run.

### WHAT IS NOT FIXED, AND IS NOT CLAIMED

Two bodies arriving together (a double faint through `refill`) share ONE sorted handler list upstream,
so a +1 announcement on body A outranks body B's hazards too. This engine's walk is per body, so the
early announce is above THAT body's hazards only. It cannot be reached by any legal fixture I could
build (it needs a double replacement onto hazards with an Unnerve body in it) and it is listed in OWED
rather than asserted either way.

---

## 3. `data/tags.json` WAS PATCHED, NOT REGENERATED — AND THE REASON IS MEASURED

**A full `node engine/tag_dex.js` in a worktree DESTROYS the file.** `loadCorpus` reads the UNTRACKED
`data/games.ladder.jsonl` / `games.bo3.jsonl`, which exist only in the main tree, and the run does not
fail — it prints its reason and writes `sheet_entries: 0` with every `uses` at 0 and every `examples`
empty. Measured here: **1,806 insertions, 6,957 deletions**. Restored byte-for-byte from a backup taken
before the run (`git diff --stat data/tags.json` empty afterwards).

So the derivation went into `engine/tag_dex.js` — the next real regeneration, in the main tree with the
store present, produces it — and the four live `announcesOnStart` rows were patched in place by a
scratch script that parses, sets one key and re-serialises with the file's own
`JSON.stringify(obj, null, 1)`. The round-trip was asserted byte-identical BEFORE the patch. The whole
diff:

```
 data/tags.json | 12 ++++++++----
      3 +     "switchInPriority": 0          (Fairy Aura, Mold Breaker, Pressure)
      1 +     "switchInPriority": 1          (Unnerve)
      4 +     "visibleOnABoard": false,
      4 -     "visibleOnABoard": false
```

**And the fallback is LOUD.** If an `announcesOnStart` row carries no `switchInPriority`, the engine
counts `MEDFAILS.startAnnouncePriorityMissing` and announces late — it does not silently answer 0. The
probe asserts that counter at zero on every arm.

---

## 4. THE PROBE, AND WHAT MAKES IT NOT VACUOUS

`tests/probe_ability_rewrite_name.js`. Ten staged games, each played by BOTH engines on the same pinned
dice under the differential's `middle` arm, and the verdict is `playGame`'s own first divergence under
the honest 6.72.0 comparator — **the instrument, not a second copy of its rule.**

| arm | what it stages | what is asserted |
|---|---|---|
| TRACE | Gardevoir copies Blastoise's Torrent; the foe's partner is a `notrace` Aegislash so the copy is DETERMINISTIC | authority writes one 6-field line; whole stream agrees |
| ENTRAINMENT | Audino's Entrainment onto Blastoise | 5-field line with `[of]`; whole stream agrees |
| SIMPLEBEAM | Audino's Simple Beam onto Blastoise | 5-field line, **no `[of]`**; whole stream agrees |
| WORRYSEED | Whimsicott's Worry Seed onto Blastoise | as above |
| ROLEPLAY | Alakazam takes Blastoise's Torrent | 6-field line; whole stream agrees |
| **CTRL-SKILLSWAP** | Medicham's Skill Swap with Blastoise | **NEITHER engine writes any `-ability` line**, and the `-activate|Skill Swap` proves it swapped |
| **CTRL-MEGA** | Gyarados megas into Mold Breaker | the authority writes only a **BARE 3-field** `-ability` — no field 4 |
| **ORDER-UNNERVE** | Aerodactyl walks onto one Stealth Rock layer | the line is ABOVE the damage in both engines |
| **CTRL-ORDER-PRESSURE** | Absol (Pressure, priority 0) does the identical thing | the line is BELOW the damage in both engines |

The two bare-announcement controls are what refuse "glue a fourth field onto every `-ability` line".
`CTRL-ORDER-PRESSURE` is what refuses "move every announcement above the rocks" — the one wrong fix
available here.

**The fixture was wrong before the engine was, twice.** Entrainment, Simple Beam and Worry Seed all
carry `flags: { protect: 1 }`, so a protecting target refused the move and four arms reported agreement
while staging nothing; the foes were moved onto a self-targeting boost. And the Stealth Rock layer was
first given to a Toxapex, which does not learn it — the probe's own legality check caught that and
refused to run.

### RED BEFORE TRUSTED

```
--red        MEDI_ABILITY_REWRITE_NO_OLD=1
  TRACE — [red] {"sd":"|-ability|p1a:gardevoir|torrent|trace|[from]trace",
                 "me":"|-ability|p1a:gardevoir|torrent|[from]trace"}
  ... 5 rewrite arms part, all 6 controls hold, abilityRewriteNamedOld +0, stamp set

--red-order  MEDI_START_ANNOUNCE_AFTER_HAZARDS=1
  ORDER-UNNERVE — [red] {"sd":"|-ability|p2a:aerodactyl|unnerve",
                         "me":"|-damage|p2a:aerodactyl|117/155|[from]stealthrock"}
  ... 10 controls hold, startAnnouncedEarly +0, abilityRewriteNamedOld +5 (the two knobs are independent)
```

The TRACE red card is the pinned pool's `-ability field 4` card character-for-character, and the
ORDER-UNNERVE red card is the pool's `ordering` card character-for-character.

---

## 5. THE CENSUS

Two rows were uncovered and are now covered. `970 → 972 live, 0 missing, 972 probed, run_ok true`,
ratchet `{unarmed: 0, directCall: 1}` unchanged.

| tag | row |
|---|---|
| `move` `rewritesTargetAbility` | *an ability rewrite names the OUTGOING ability in field 4, and a bare start announcement has no field 4* |
| `ability` `announcesOnStart` | *an entry announcement that outranks the hazards is written ABOVE the rock damage, and a priority-0 one below it* |

Both carry `arms: {control, test}`. The outgoing ability is read off the no-click arm of the same
fixture rather than typed; the priority and the membership are read off `data/tags.json`.

**The ordering row was MISSING on its first run** and the reason was the probe, not the engine: the
hazard's attribution is `[from] Stealth Rock`, with a space, and the filter matched `stealthrock`. It
read as "the engine wrote no damage line". Fixed at the regex, and the layer count is now printed in
the row's detail so that failure mode cannot recur silently.

**Both knobs are in `tests/test-mechanics.js` `DELIBERATE_BREAK` and both are stamped at LOAD.** Under
each, the census reads **971 live / 1 missing** and prints
`REFUSED to write data/mechanics-census.json`. `md5sum data/mechanics-census.json` is
`1122ec9cce3e45e4f9542cd0c1ad4be7` before both knob runs and after both.

---

## 6. REGRESSION SWEEP (LIGHT MODE — NAMED PROBES ONLY, NOT THE BATTERY)

| probe | verdict |
|---|---|
| `probe_start_announce.js` clean / `--red` | PASSED / PASSED |
| `probe_ability_start_on_rewrite.js` | ALL CLAUSES HELD |
| `probe_contact_ability_transfer.js` | all checks passed |
| `probe_entry_announce_batched.js` | PASSED |
| `probe_trace_choice.js` | 12 staged games, 0 not matching |
| `probe_mega_trace_entry.js` | PASS |
| `probe_replacement_entry.js` | green |
| `test-entry-effects.js` | all passed |
| **`probe_trace_target.js`** | **1 FAILING CLAUSE — PRE-EXISTING, see below** |

**`probe_trace_target.js` is RED AND IT IS NOT MINE, AND IT IS NAMED RATHER THAN FILED.** Its
`MEDI_MID_RANGE_DRAWS=1` child arm exits 1 on `NOT-STAGED — the sweep produced 0 TIE and 24 NO-TIE
boards`. **Measured both ways**: with clean `HEAD`'s `engine/medicham2-browser.js` copied over the
working file, the same arm fails with `0 TIE and 0 NO-TIE boards`; with this change it reads `0 and 24`.
The engine file was restored from a byte backup immediately and its md5 verified. The failing clause is
about that knob's tie sweep and has nothing to do with the `-ability` line. It is owed to whoever owns
`MEDI_MID_RANGE_DRAWS`.

---

## 7. FILES CHANGED

| file | what |
|---|---|
| `engine/medicham2-browser.js` | `TR.abFrom`; `abRewrite` returns the outgoing ability on all three roads; four call sites; `startAnnounceEarly` + three call sites; the `_startAnnEarly` consume in `applyEntryEffects`; two knobs (`MEDI_ABILITY_REWRITE_NO_OLD`, `MEDI_START_ANNOUNCE_AFTER_HAZARDS`), both stamped at load; counters `abilityRewriteNamedOld`, `startAnnouncedEarly`, `startAnnouncePriorityMissing` |
| `engine/tag_dex.js` | `announcesOnStart` derives `switchInPriority` from `onSwitchInPriority` |
| `data/tags.json` | the four `announcesOnStart` rows gain `switchInPriority` (8 insertions, 4 deletions, nothing else) |
| `tests/probe_ability_rewrite_name.js` | NEW — 10 staged games, 27 claims, two red arms |
| `tests/test-mechanics.js` | two census rows; two `DELIBERATE_BREAK` entries |
| `data/mechanics-census.json` | regenerated, 970 → 972 live |
| `docs/ENGINE.md` | the pass's section (outside the `<!-- GENERATED -->` block) and the new probe in Owns |
| `engine/game_differential.js` | **NOT AUTHORED — restored to the committed `221ab64a` blob.** See below. |

**`engine/game_differential.js` shows as modified and NOT ONE BYTE IS MINE.** This worktree's branch
does not contain `221ab64a` (6.72.0), so it still carried the `ability-announcement` equivalence that
drops every `|-ability|` line — under which none of this work is visible. The file was replaced with the
committed blob from `221ab64a` verbatim; `git diff 221ab64a -- engine/game_differential.js` is empty.
Whoever merges should take that side from `221ab64a` and not from here.

---

## PROPOSED NOTES ROW

*(For `docs/RUNNING-NOTES.md`. NOT written by this pass — the brief forbids it.)*

```
### 6.73.0 — 2026-09-19 — an ability rewrite names the outgoing ability, and a +priority entry announcement sorts above the hazards

**What changed.** `Pokemon#setAbility`'s `default` branch writes the OLD ability's name as field 4 of
its `|-ability|` line (`sim/pokemon.ts:1936-1943`, `oldAbility` read at `:1919` before the assignment at
`:1930`); this engine omitted it on all four of its rewrite roads — Trace, Receiver, the
Entrainment/Simple Beam/Worry Seed family and Role Play. Fixed at the shared `abRewrite`, which now
returns the outgoing ability, plus one new sink. Separately, `fieldEvent('SwitchIn')` sorts the
entrant's ability handler against the side's hazards by `onSwitchInPriority` before subOrder
(`sim/battle.ts:404-411`, `:953`, `:957-987`), so Unnerve's `+1` announcement belongs ABOVE the entry
hazard damage; `engine/tag_dex.js` now derives `announcesOnStart.switchInPriority` and the engine reads
it. Over this regulation the only positive-priority member that writes a line is Unnerve — Klutz is
`+1` and silent.

**The figures.** Census `data/mechanics-census.json` **970 → 972 live, 0 missing, 972 probed**. These are
the `-ability field 4` (**47 of 961 games**, 42 causes) and `ordering` (**1 of 961**) mechanisms of the
250-game narration class measured in 6.72.0; the whole-game re-measure has NOT been run, so no new
narration figure is claimed here. Proof: `tests/probe_ability_rewrite_name.js`, 27 claims green on
release `8f1396257b70`, red under `MEDI_ABILITY_REWRITE_NO_OLD=1` (5 rewrite arms) and under
`MEDI_START_ANNOUNCE_AFTER_HAZARDS=1` (the Unnerve arm), with both knobs in `tests/test-mechanics.js`
`DELIBERATE_BREAK` and the census refusing to write under either.

**Supersedes.** Nothing. No published figure is restated.

**Basis.** unchanged — the census counts the same quantity and two rows were added to it.

**Owed.** The three gate lattices and the whole-game narration count, which are withheld by 6.72.0 and
are not re-run here. `docs/ENGINE.md` (done, this pass). `node engine/status.js --write`.
```

---

## OWED, NOT RUN

- **NO LATTICE, NO GATE, NO BATTERY.** LIGHT MODE. `engine/quarantine.js`, `tests/run-all.js` and every
  `engine/game_differential.js` swarm run were not executed. **The 47-game and 1-game figures in this
  report are 6.72.0's measurement, quoted, not re-measured.** Nothing here claims the class is empty —
  only that the two mechanisms behind it are fixed on staged boards against the authority. The
  whole-game re-run is owed and is the only thing that can size what is left.
- **`node engine/status.js --write` WAS NOT RUN**, per the brief. The `<!-- GENERATED -->` block in
  `docs/ENGINE.md` still reads `970/970` and was not hand-edited.
- **`CHANGELOG.md` AND `docs/RUNNING-NOTES.md` WERE NOT TOUCHED**, per the brief. The proposed row is
  above and is owed by whoever merges.
- **NOT COMMITTED, NOT PUSHED.**
- **THE CROSS-BODY ENTRY SORT IS NOT MODELLED.** Two bodies arriving at the same instant (a double
  replacement through `refill`) share ONE sorted handler list upstream, so a `+1` announcement on body A
  outranks body B's hazards as well. This engine's early announce is above that body's own hazards only.
  I could not build a legal fixture for it — it needs a double faint replacement onto hazards with an
  Unnerve body among the entrants — so it is REPORTED, not asserted either way.
- **THE `[of]` FIELD IS STILL NOT WRITTEN** on any rewrite line. Pre-existing and already declared at
  both the Trace and Receiver sites; it does not part because the differential's `source-tag` rule
  strips it from both streams. Not fixed, not claimed.
- **A SUPPRESSED BODY'S REWRITE WRITES THE WRONG FIELD 3, AND THAT IS PRE-EXISTING.** `abSuppress` sets
  `m.ability = ''` and parks the real one in `m._abParked`; `abRewrite` returns early on that road
  without touching `m.ability`, and the four call sites pass `m.ability` as the NEW ability. The sink's
  `push` drops empty fields (`parts.filter(x => x != null && x !== '')`), so a Gastro Acid'd body that is
  then Entrained writes `|-ability|BODY|<old>|[from] …` — the new ability dropped and the old one
  standing in field 3. Field 4 is correct on that road after this pass (`abRewrite` returns
  `_abParked`); field 3 is older than this pass and was deliberately left alone rather than changed
  under cover of it. **No fixture was staged and the shape above is read off the code, not measured.**
- **`probe_trace_target.js --red` IS RED AT HEAD** (§6), measured, not assumed. Not mine, not fixed.
- **`engine/game_differential.js` IS MODIFIED IN THIS WORKTREE AND CONTAINS NONE OF MY BYTES** — it is
  the `221ab64a` blob, brought in because this branch predates 6.72.0 and the work is invisible without
  it. Take that side from `221ab64a` on merge.
- **RELEASE-CUT SIDE EFFECTS, REPORTED RATHER THAN REVERTED.** `data/releases/8f1396257b70/` was created
  in this worktree by the deliberate cut (27 files), and `data/releases/fa0e66a43c00/` by an UNPINNED
  probe run afterwards — `engine/game_differential.js` cuts at require time when no `--release` is given
  and `tests/_live_release.js` is not preloaded. `data/releases/` is gitignored, so nothing is staged.
  `data/engine-release.json` was repointed twice and RESTORED from a byte backup both times; `git status`
  shows it unmodified. **The second repoint was caught only by reading `git status` at the end** — a
  probe run without `--release` moves the shared pointer silently, which is worth remembering when a
  division is measuring beside you.
- **DEBRIS REPORTED, NOT DELETED.** The scratch folder
  `<scratchpad>/ability-rewrite-name/` holds the two exploratory scripts, the tags patch script, the
  byte backups of `data/tags.json`, `data/mechanics-census.json`, `data/engine-release.json` and both
  versions of `engine/medicham2-browser.js`, and four run logs. `data/roster.abilities.prev.json` and
  `data/roster.moves.prev.json` were already in the tree when this session started and are not mine.
