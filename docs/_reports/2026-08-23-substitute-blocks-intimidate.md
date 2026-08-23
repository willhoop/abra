# A Substitute refuses an entry stat drop — ENGINE, 2026-08-23

Historical findings record. Not maintained, not current state, superseded by the register row it feeds.

**LIGHT MODE was a hard requirement.** No roster, no `game_differential`, no `all_mechanics_fire`, no
`test-mechanics` full run, no `quarantine`, no `status.js`, no `run-all`. Everything measured here is a
staged board or a single dex read, seconds each. The OWED list is at the bottom.

---

## 1. WHAT THE PREVIOUS AGENT LEFT, AND WHAT WAS DONE WITH IT

`git status` at start: `engine/medicham2-browser.js`, `engine/tag_dex.js`, `tests/test-mechanics.js`
modified; `data/_pair-pilot.json` untracked (not ours, left alone).

The killed agent had landed a **complete** fix:

| file | what was there |
|---|---|
| `engine/medicham2-browser.js` | the substitute guard inside `applyEntryDrops`, the `MEDI_ENTRYDROP_SUB_BLIND` restore knob, and two counters (`entryDropRefusedBySub`, `entryDropSubBridge`) |
| `engine/tag_dex.js` | a `blockedBySubstitute` derivation on the `onSwitchInDrop` param, read off the handler source |
| `tests/test-mechanics.js` | a census probe naming `incineroar`/`intimidate` and `hydrapple`/`supersweetsyrup` |

**Decision: FINISH, not revert.** Every claim in its comments was re-derived from the authority before
being kept (§2, §3). The probe was **rewritten** (§4) because it named two abilities, and the brief's
requirement is a gate that catches a new member spelled differently.

Nothing it wrote turned out to be wrong. The one thing it had not reached — the reason it was still
working — is that the derivation is not in `data/tags.json` yet, which is §5.

---

## 2. THE PREMISE HELD

Relayed: *"`engine/medicham2-browser.js:11244-11249` carries no substitute guard on the Intimidate
path. Authority: `abilities.ts:2191`."*

**Both confirmed.** `HEAD`'s `applyEntryDrops` walked `for (const f of foes)` with no substitute test.
`data/abilities.ts:2191`, read whole:

```js
intimidate: {
  onStart(pokemon) {
    let activated = false;
    for (const target of pokemon.adjacentFoes()) {
      if (!activated) { this.add('-ability', pokemon, 'Intimidate', 'boost'); activated = true; }
      if (target.volatiles['substitute']) { this.add('-immune', target); }
      else { this.boost({ atk: -1 }, target, pokemon, null, true); }
    }
  },
  ...
}
```

**The Champions mod was checked FIRST, as CLAUDE.md requires.** `/data/mods/champions/abilities.ts`
overrides **thirteen** abilities — `angershell berserk disguise dragonize eelevate firemane healer
megasol naturalcure piercingdrill regenerator spicyspray unseenfist` — and neither `intimidate` nor
`supersweetsyrup` is among them. So mainline's handler IS the Champions handler for both.

---

## 3. THE CLASS: FOUR ABILITIES ON TWO HOOKS, AND ONLY TWO ARE THIS RULE

Derived, not recalled. Every LEGAL ability in the regulation
(`Dex.forFormat(FORMAT).abilities.all()` filtered `exists && !isNonstandard && tier !== 'Illegal'`),
asked for a `volatiles['substitute']` test on ANY handler:

```
disguise            onCriticalHit, onEffectiveness
iceface             onCriticalHit, onEffectiveness
intimidate          onStart
supersweetsyrup     onStart
```

- `disguise` / `iceface` are the **hitSub** rule — `target.volatiles['substitute'] &&
  !move.flags['bypasssub'] && !(move.infiltrates && gen >= 6)` — a different rule on a different hook,
  and Champions overrides `disguise` while KEEPING that clause. Mimikyu is queued separately and was
  not touched. `iceface` has **zero legal carriers** (`abilityCarriers('iceface')` → `[]`; Eiscue is
  `isNonstandard: 'Past'`, tier `Illegal`).
- `intimidate` / `supersweetsyrup` are the entry drop, character for character.

**Those two are exactly the `onSwitchInDrop` membership**, printed from `data/tags.json`:

```
intimidate       {"drop":true,"boosts":{"atk":-1},"oncePerBattle":null}           18,772 uses
supersweetsyrup  {"drop":true,"boosts":{"evasion":-1},"oncePerBattle":"syrupTriggered"}   22 uses
```

The wider sweep over `data/items.ts`, `data/moves.ts`, `data/conditions.ts` and their Champions
counterparts returns only the `hitSub` compound (items, contact reactions) and move-specific clauses —
nothing else in the entry-drop class.

### Where the fix went

`applyEntryDrops` — the tag's ONE consumer, reached from all three of its call sites (leads,
mid-battle switch-in, the entry-effect pass). Not on a name. A third member of the tag inherits the
guard with no edit.

**Deliberately NOT routed through the engine's `subBlocks` helper.** That helper consults `bypasssub`
and Infiltrator; neither can apply to an ability's entry drop, because there is no move to carry a flag
and `infiltrator.onModifyMove` only ever writes onto a MOVE. Using the shared helper would have let an
Infiltrator body Intimidate through a doll, which the authority does not do — LESSONS §4's over-match
arriving as a shared helper instead of as a name.

`engine/board.js` was checked and has **no independent entry-drop path** (one comment, no code), so
there is no second copy of this fact to keep in step.

---

## 4. THE PROOF

### 4a. The authority was ASKED this board, not quoted

Official Champions simulator, one battle, dex only (no store, no team pool). Scizor U-turns an
Incineroar in against a Snorlax behind a Substitute, with a Corviknight beside it that has no doll.
All sets learnset-checked with `canLearn` first:

```
|move|p1a: Scizor|U-turn|p2b: Corviknight
|switch|p1a: Incineroar|Incineroar, L50|202/202|[from] U-turn
|-ability|p1a: Incineroar|Intimidate|boost
|-immune|p2a: Snorlax
|-unboost|p2b: Corviknight|atk|1
```

Final board: Snorlax `atk 0` with its doll at 66 HP, Corviknight `atk -1`. One **bare** `-immune`, no
`[from]` and no ability attribution — which is why `TR.imm(f)` is called with no attribute.

### 4b. The census probe, rewritten to be membership-driven

`tests/test-mechanics.js`, `ability/onSwitchInDrop` — *"a SUBSTITUTE refuses an entry stat drop and
answers `|-immune|` — every member of the onSwitchInDrop tag, read from the artifact, not just
Intimidate"*.

- **Membership comes out of `data/tags.json`**, not from a name. A third member is probed automatically.
- **The expectation comes out of the row too**: `blockedBySubstitute` decides whether the arm requires
  a refusal or requires the drop to go THROUGH the doll.
- **The whole seven-slot boost table is compared**, not a stat the probe picked, so a member dropping
  something else is judged correctly with no case added.
- **One body in every arm** — the ability is assigned onto the same Incineroar, including the control,
  so nothing about a carrier's species can be mistaken for the mechanic.
- Two identical Garchomp as foes; only the first is behind a doll.

**RED** (`MEDI_ENTRYDROP_SUB_BLIND=1`):

```
intimidate       subbed {"at":-1,...}  open {"at":-1,...}  imm[-]
supersweetsyrup  subbed {"eva":-1,...} open {"eva":-1,...} imm[-]
CONTROL none     subbed all-zero       open all-zero       imm[-]
=> MISSING
```

**GREEN** (knob unset):

```
intimidate       subbed all-zero  open {"at":-1,...}   imm[|-immune|p2a:garchomp]
supersweetsyrup  subbed all-zero  open {"eva":-1,...}  imm[|-immune|p2a:garchomp]
CONTROL none     subbed all-zero  open all-zero        imm[-]
=> WORKS
```

The control is flat in BOTH arms, so the knob moves the **guard** and not the drop machinery.

### 4c. What would make this probe green while the engine stayed wrong?

Asked before believing it, per the brief.

| way it could lie | why it cannot |
|---|---|
| the doll was never up, so "not dropped" is trivial | `doll` asserts `f1._sub > 0`; and a foe with no doll and no drop would fail `open` |
| the switch never happened, so no entry effect ran | `arrived` asserts `S.actA[0] === bench` |
| the engine stopped dropping entirely | the foe BESIDE the doll must be dropped, in the same turn |
| the `-immune` came from something else | exactly one, canonicalised, aimed at the SUBBED slot; the control emits none |
| the probe reads its answer out of the same artifact the engine reads | it reads the artifact for the EXPECTATION and reads the BOARD for the answer — the artifact cannot make a board |

**The census probe could not be run in situ** (`tests/test-mechanics.js` is forbidden in light mode).
It was run through a standalone mirror that EXTRACTS the probe's body out of the live test file at run
time, so the mirror cannot drift from the row it stands in for:
`<scratch>/probe_entrydrop_sub.js`.

---

## 5. DERIVED vs BRIDGED — the judgement the brief asked for

**The previous agent's instinct was right and its derivation is correct.** `tag_dex.js` reads
`blockedBySubstitute` off the handler's own source, so a member that does NOT gate on a substitute
comes back `false` and the consumer stops guarding it — the direction a hand-written rule gets wrong.

**Verified without regenerating the artifact**, by replicating the extractor over every legal ability
(the "print what it matched before wiring it" rule):

```
intimidate          {"drop":true,"boosts":{"atk":-1},"oncePerBattle":null,"blockedBySubstitute":true}
supersweetsyrup     {"drop":true,"boosts":{"evasion":-1},"oncePerBattle":"syrupTriggered","blockedBySubstitute":true}
members: 2
OVER-MATCH CHECK — legal abilities whose onStart mentions a substitute: intimidate, supersweetsyrup (both tagged)
```

No over-match, no missed member, no confusion with the `hitSub` hook.

**Why it is still bridged.** `node engine/tag_dex.js` calls
`fit_policy.loadCorpus({ scope: 'all' })` — the whole 30 MB store — and rewrites every usage count in
`data/tags.json`. That is not a light run, and a cross-cutting artifact regeneration should not ride
along with a one-mechanic fix. So the key is absent today and **both the engine and the probe fall back
on "blocked"**, loudly:

```js
const _sb = (_osd.blockedBySubstitute != null) ? !!_osd.blockedBySubstitute
          : (MEDSEEN.entryDropSubBridge++, true);
```

`MEDSEEN.entryDropSubBridge` reads 2 per probe run today. **After the regeneration it must read ZERO**;
a non-zero after that is a member whose handler the derivation could not read, which is a finding.

---

## 6. WHAT THIS DOES NOT CLOSE, AND WHAT IT FOUND WITHOUT FIXING

- **The `omit-weather` turn-0 row** already filed in `docs/ENGINE.md` — *"a leads-time Intimidate
  Showdown refused and we applied"* — is **NOT** this. A substitute cannot exist at boundary 0, so
  that refusal is a different mechanism (Clear Amulet, Clear Body, an ally guard). Nothing here may be
  credited with it.
- **Supersweet Syrup's `|-ability|` narration is wrong and predates this pass.** `data/abilities.ts:4708`
  emits it **bare and unconditionally**, before the foe loop; this engine emits it with the protocol's
  `boost` marker and only when a live foe exists. 22 uses, narration-only. Not fixed — batches of one.
- **The probe's `blockedBySubstitute: false` arm has no subject and has never run.** Both members carry
  `true`. Said in the probe's own header rather than discovered later, as the brief requires of a gate
  that cannot catch every shape.
- **A `tests/staged_board.js` scenario was NOT added**, deliberately. That file's scenarios can only be
  run through `game_differential.js`, which loads the store at require time — forbidden in light mode —
  and landing a scenario nobody can run is the shape this project keeps paying for. The fixture is
  already validated against the authority in §4a and is ready to be added and run in one pass:
  A = Scizor(Swarm, U-turn/Protect), Clefable, **Incineroar(Intimidate)**, Milotic;
  B = Snorlax(Substitute/Protect), Corviknight(Iron Defense/Protect), + fill;
  script = `[protect, protect | substitute, irondefense]`, `[uturn t=1, protect | protect, irondefense]`;
  break = `['if(_sb&&!ENTRYDROP_SUB_BLIND&&f._sub>0){', 'if(false&&_sb&&!ENTRYDROP_SUB_BLIND&&f._sub>0){']`.
  Note that file's proof-plant machinery is itself FILED-NOT-FIXED, so `--reds` is not trustworthy
  there; the `MEDI_` knob is the red demonstration.

---

## 7. WHICH SCOREBOARD THIS SHOULD MOVE — stated BEFORE the run, per CLAUDE.md

**Intimidate is 18,772 uses**, the largest entry effect in the format, and Substitute is a move real
ladder teams click. So this should move the **pinned pool** as well as the lab. **That is a prediction,
not a result** — it cannot be measured in light mode. If the pool does not move, the honest reading is
that subbed-into-entry is rarer inside the frozen sample than usage suggests, not that the fix did
nothing. Supersweet Syrup (22 uses) rides the same code path and should move the **lab only**.

---

## 8. OWED, NOT RUN

Nothing below was run. **The census figure in `docs/ENGINE.md`'s GENERATED block is from
2026-08-23 01:59 and does not include this probe. No count is claimed to have moved.**

```
node tests/test-mechanics.js
node engine/tag_dex.js
node engine/engine_release.js cut "ENGINE 5.91.0 - a substitute refuses an entry stat drop"
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node tests/roster.js --stage abilities --release <that fresh id> --write
SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown node engine/game_differential.js --release <that fresh id> --census data/gate-census.pin.json --team-store data/team-pool-frozen --state
node tests/run-all.js
tools\lownode.cmd engine\quarantine.js
node engine/status.js --write
git add engine/medicham2-browser.js engine/tag_dex.js tests/test-mechanics.js docs/ENGINE.md docs/MEDICHAM-SPRINT-NOTES.md CHANGELOG.md data/docs-currency-baseline.json data/mechanics-census.json data/tags.json
```

`--release <a FRESH id>` and `--write` are both required and both have been forgotten today; a roster
run without `--write` exits 0 having changed no artifact. Never `git add -A` or `-u` —
`data/_pair-pilot.json` is untracked, is not ours, and must not be swept in.

**What WAS run this pass:** `node --check` on all three modified JS files; the standalone probe mirror
red and green; the authority battle in §4a; the derivation print in §5; `node tests/test-docs-current.js`
(22 passed, 0 failed — it restamped `data/docs-currency-baseline.json` to `5.91.0`).

---

## 9. PROPOSED REGISTER ROW (not written — `docs/ROADMAP.md` is not ENGINE's to edit)

> **A Substitute refuses an on-entry stat drop.** `data/abilities.ts:2191` (intimidate) and `:4710`
> (supersweetsyrup) gate the drop behind `target.volatiles['substitute']` and answer a bare `-immune`;
> `applyEntryDrops` walked the foes unconditionally, so every game this engine has played dropped a
> stat through a doll. Fixed at the tag's ONE consumer for the whole `onSwitchInDrop` membership
> (intimidate 18,772 uses, supersweetsyrup 22), not per ability, so a third member inherits it.
> **Probe:** census `ability/onSwitchInDrop — a SUBSTITUTE refuses an entry stat drop`, membership and
> expectation both read from `data/tags.json`, red under `MEDI_ENTRYDROP_SUB_BLIND=1` with the control
> cleared. **OWED:** `node engine/tag_dex.js` so `blockedBySubstitute` stops being bridged —
> `MEDSEEN.entryDropSubBridge` must then read zero.
