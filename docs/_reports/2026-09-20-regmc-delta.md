# The Regulation M-B → M-C delta, derived from the two Showdown checkouts

**Date.** 2026-09-20. **Division.** ENGINE. **Status.** Findings record — historical by construction,
never cited as current state (CLAUDE.md, `docs/_reports/` rule).

Every name and number below is derived from a dex walk or cited to the file and line it was read on.
Nothing is recalled. Scripts live in the session scratchpad at
`C:\Users\willj\AppData\Local\Temp\claude\C--Users-willj-Projects-Pokemon-ABRA\29d6f78c-ebd1-40dc-b2a3-d3eac1846836\scratchpad\mc\`.

---

## 0. The two authorities, and the structural surprise

| | path | HEAD | date |
|---|---|---|---|
| **M-B authority, PINNED** | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` | `20ad99f` | 2026-07-22 |
| **M-C authority, NEW** | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` | `f10d679` | 2026-09-20 |

Neither checkout was pulled, built or modified.

**The mod layout moved under us.** In the pinned checkout the `champions` mod *is* M-B, with
`championsregma` carrying the backward compatibility. In the new checkout `champions` *is* M-C, and a
**new `championsregmb` mod** carries M-B backward compatibility. Commit `812501e Add Champions
Regulation M-C` (2026-09-09) performed the rename `championsregma` → `championsregmb`.

```bash
ls C:/Users/willj/Projects/Pokemon/pokemon-showdown/data/mods/ | grep -i champ
#   champions  championsregma
ls C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc/data/mods/ | grep -i champ
#   champions  championsregmb
```

So both formats ARE derivable from the new checkout's bytes — but see §1, which is the most important
section in this report.

Format ids, read from `config/formats.ts:288` and `:301` in the new checkout:
`gen9championsvgc2026regmc` (mod `champions`) and `gen9championsvgc2026regmb` (mod `championsregmb`).

### The legality filter used everywhere below

```js
const legal = (x, kind) => x.exists && !x.isNonstandard && !(kind === 'species' && x.tier === 'Illegal');
```

Every walk is filtered. The only unfiltered inspections are §6 and §7, which deliberately examine
`isNonstandard` itself and say so.

---

## 1. THE SAME-BYTES SHORTCUT IS NOT SAFE, AND IT HID FIFTEEN MOVES

The brief proposed deriving both regulations from the new checkout, "same bytes, so the comparison is
clean". That is true for the *regulation* difference and **false for the difference that matters to
ABRA**, because `championsregmb` is not a faithful reproduction of the pinned M-B. It overrides only
five files and **has no `abilities.ts` at all**:

```bash
ls C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc/data/mods/championsregmb/
#   formats-data.ts  items.ts  learnsets.ts  moves.ts  scripts.ts
```

`data/mods/championsregmb/abilities.ts` was created by `812501e` (renamed from `championsregma`) and
then **deleted outright** by `cc089d3 Delete the M-A ability mechanics (#12301)`. So M-B in the new
checkout inherits `champions/abilities.ts` — the M-C file — unmodified.

**The fidelity check.** Dumping every definition from each checkout and diffing (`dump.js`, `cmp.js`,
`buckets.js`):

```bash
node dump.js "C:/Users/willj/Projects/Pokemon/pokemon-showdown"    gen9championsvgc2026regmb mb_pinned.json
node dump.js "C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc" gen9championsvgc2026regmb mb_new.json
node dump.js "C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc" gen9championsvgc2026regmc mc_new.json
node buckets.js mb_pinned.json mb_new.json MB-PINNED MB-NEW
```

PINNED M-B vs NEW-CHECKOUT M-B — these should be identical and are not:

| kind | legal, pinned | legal, new checkout | changed handlers |
|---|---|---|---|
| species | 347 | 347 | 0 |
| **moves** | **500** | **515** | 9 entries |
| items | 148 | 148 | 1 entry (`whiteherb`) |
| abilities | 316 | 316 | 11 entries |

The 15 moves that `championsregmb` fails to revert to `isNonstandard: 'Past'`:
`courtchange doubleshock drumbeating glaiverush jawlock meteorassault milkdrink octolock overdrive
pyroball revivalblessing shiftgear slash snipeshot zingzap`.

**Consequence.** A same-bytes walk reports **0 moves added** M-B → M-C. Against ABRA's actual pinned
authority the answer is **+15**. Both numbers are true statements about different questions; only the
second one describes the change ABRA has to implement. Every count in this report is given against
the **pinned** M-B, with the same-bytes figure named where it differs.

---

## 2. Legality: added and removed, by id

Derivation: `delta.js` (same-bytes) and `buckets.js mb_pinned.json mc_new.json` (authoritative).

| kind | pinned M-B | M-C | added | removed |
|---|---|---|---|---|
| species | 347 | 382 | **+35** | **0** |
| moves | 500 | 515 | **+15** | **0** |
| items | 148 | 166 | **+18** | **0** |
| abilities | 316 | 316 | **0** | **0** |

**Nothing is removed in any category.** M-C is a strict superset of M-B's legal sets.

### 2.1 Species added (35) — confirms the coordinator's list exactly

```
absolmegaz arboliva baxcalibur baxcaliburmega cinderace farfetchd garchompmegaz gogoat golisopod
golisopodmega grapploct indeedee indeedeef inteleon lucariomegaz mabosstiff mrmime pawmot perrserker
persian persianalola pincurchin rillaboom salamence salamencemega sirfetchd squawkabilly
squawkabillyblue squawkabillywhite squawkabillyyellow swalot thievul toxtricity toxtricitylowkey
wigglytuff
```

Six of the 35 are item-locked formes (`megas.js`):

| forme | changesFrom | requiredItem | ability |
|---|---|---|---|
| absolmegaz | Absol | Absolite Z | Sharpness |
| baxcaliburmega | Baxcalibur | Baxcalibrite | Thermal Exchange |
| garchompmegaz | Garchomp | Garchompite Z | Levitate |
| golisopodmega | Golisopod | Golisopite | Tough Claws |
| lucariomegaz | Lucario | Lucarionite Z | **Aura Guard** |
| salamencemega | Salamence | Salamencite | Aerilate |

The species set is **identical in both checkouts for M-B** (347 either way, 0 added, 0 removed) —
confirmed, as the coordinator reported.

### 2.2 Moves added (15)

```
courtchange doubleshock drumbeating glaiverush jawlock meteorassault milkdrink octolock overdrive
pyroball revivalblessing shiftgear slash snipeshot zingzap
```

Fourteen of these arrive with an added species (§5). The fifteenth, **`slash`**, is different: it is
granted to **28 species that are legal in both regulations**, by `812501e` itself (`git log -S'slash:
["9M"]'`). `championsregmb` does not revert it, so within the new checkout both regulations have it —
but the pinned M-B does not. See §4.

### 2.3 Items added (18) — six stones and twelve held items

Stones: `absolitez baxcalibrite garchompitez golisopite lucarionitez salamencite`.

**Held items, the real new mechanics surface (12):**
`airballoon bindingband ejectbutton electricseed grassyseed leek mistyseed normalgem psychicseed
redcard rockyhelmet terrainextender`.

### 2.4 Abilities added: 0

No ability's `isNonstandard` changes. The 15 abilities that become *reachable* are a different
question and are in §5 — the legality list reveals none of them.

---

## 3. Entries legal in BOTH whose DEFINITION CHANGED

This is the dangerous category. Derivation: `defs.js` for same-bytes, `buckets.js` + `show.js` for
the authoritative pinned comparison.

### 3.1 The genuine regulation change: 2 moves, same bytes, nothing else

```
node defs.js
# SPECIES:   1 of 347 changed  (alakazammega — tier labels only)
# MOVES:     2 of 515 changed
# ITEMS:     0 of 148
# ABILITIES: 0 of 316
```

| entry | field | M-B | M-C |
|---|---|---|---|
| `strengthsap` | pp | **10** | **5** |
| `wish` | pp | **10** | **5** |

Cited: `data/mods/championsregmb/moves.ts:2-9` restores `pp: 10` for exactly these two and nothing
else. **These are the only two entries legal in both regulations whose behaviour the regulation
itself changes.** A PP halving on Wish and Strength Sap is board-material in long games and is
invisible to every legality list.

`alakazammega` moves `UUBL` → `Uber` on `tier`, `doublesTier` and `natDexTier` (commit `d5fb7ea
Champions OU: Ban Lucario-Mega-Z, Alakazam-M and Baxcalibur`). Those are **singles/Doubles-OU tiering
labels**; the VGC format's expanded ruleset (§6) contains no tier clause, and Alakazam-Mega is legal
in both. Not a behaviour change.

### 3.2 Changes that are upstream Showdown work, not regulation

Against the **pinned** M-B, a further 20 entries differ. Every one was attributed to a commit in
`20ad99f..f10d679`, and every one applies to **M-B and M-C alike in the new checkout** — they are two
months of Showdown fixes, not a regulation delta. They still matter to ABRA, because ABRA's M-B
engine was built against the pinned bytes.

**Board-material (7):**

| entry | what changed | commit |
|---|---|---|
| `disguise` | pinned cached a `neutral` flag across a multi-hit move, so hits after Disguise broke stayed neutral; M-C drops it. **Mimikyu is legal in both** (2 carriers). | `10f47c9` |
| `growth` | pinned deleted the boosts for a `megasol` user outside sun; M-C removed the clause. **Meganium-Mega carries Mega Sol in both.** Read at pinned `data/moves.ts:7871`. | `10f47c9` |
| `curse` | non-Ghost target becomes `"self"` rather than `move.nonGhostTarget`; gains `tracksTarget: true`; loses `volatileStatus` | `2345119` |
| `disable` | M-C adds `&& !move.flags["cantusetwice"]` — Disable no longer blocks such a move | upstream |
| `ceaselessedge`, `stoneaxe` | pinned required `source.hp` to lay Spikes; M-C lays them even if the user fainted | upstream |
| `whiteherb` | pinned queued a deferred `WhiteHerb` event at `order: 99` (before switches); M-C calls `onStart` inline | `aa6d5f0` |
| `emergencyexit`, `wimpout` | pinned cleared **every** active Pokémon's `switchFlag` on both sides first; M-C does not | `57ecb34` |

Reachability check (`reach.js`) — a handler change on an unreachable ability cannot move a board:
`emergencyexit` has **0** carriers in M-B and 1 in M-C (golisopod); `wimpout` has **0 carriers in
both** and is dead either way.

**Narration-only (9), verified by reading both bodies:**
`bigpecks hypercutter innerfocus oblivious owntempo scrappy` all change one protocol argument,
`this.add("-fail", target, "unboost", "Attack", …)` → `"atk"`. `spicyspray` and `direclaw` drop an
extra `-immune`/`-fail` message (`f0039f5 Remove extra immune messages from Spicy Spray and Dire
Claw`); `trySetStatus` does the same work. `allyswitch` is the refactor `this.format.gameType` →
`this.gameType`.

Two whole-corpus fields were excluded as schema churn after inspecting them: `nonGhostTarget`
(present-as-`""` in the pinned build, absent in the new one, across every move) and
`desc`/`shortDesc` (`02bb2ae Remove redundant Champions descriptions`).

---

## 4. Learnsets

Derivation: `lsdiff.js`. The first instrument was **wrong** and is recorded here because the wrong
answer was the comfortable one.

**The instrument error.** The first walk climbed the prevo chain (`sp.prevo`), which reported
**0 of 347 species changed**. It was masking Archaludon's loss behind Duraludon's table. The
`TeamValidator` is the authority and disagrees:

```
M-B Archaludon + Metal Burst -> LEGAL
M-C Archaludon + Metal Burst -> REJECTED: Archaludon can't learn Metal Burst.
M-B Archaludon + Slash       -> REJECTED: Archaludon can't learn Slash.
M-C Archaludon + Slash       -> LEGAL
```

That is a cleared control in both directions: the same probe returns opposite verdicts across the
knob, so the instrument could have seen no difference and did.

**The regulation change, species legal in both: Archaludon, and only Archaludon.**

| | |
|---|---|
| **GAINED** | `slash` |
| **LOST** | `metalburst`, `mirrorcoat` |

Cited: `data/mods/championsregmb/learnsets.ts` overrides exactly one species — `archaludon` — with a
51-entry M-B table; M-C's is 50 entries. Archaludon is a heavily-used mon in this format, and losing
Mirror Coat is a real set change.

**Against the pinned M-B there are 30 changed species, not 1.** The other 29 are the `slash` grant
from `812501e` (28 species gain it) and Politoed losing `pound`. `championsregmb` does not revert
them, so they are identical across the two regulations in the new checkout and differ only from
ABRA's pinned authority.

---

## 5. What the 35 added species actually bring — the real implementation surface

Derivation: `learn2.js`, using each species' own learnset table and confirming **every** claim with
`TeamValidator`. All 14 move claims returned `M-C = true`.

### 15 abilities new to the format

| ability | brought by |
|---|---|
| `auraguard` | lucariomegaz |
| `emergencyexit` | golisopod |
| `grasspelt` | gogoat |
| `grassysurge` | rillaboom |
| `guarddog` | mabosstiff |
| `libero` | cinderace |
| `liquidooze` | swalot |
| `psychicsurge` | indeedee, indeedeef |
| `punkrock` | toxtricity, toxtricitylowkey |
| `rattled` | persianalola |
| `runaway` | thievul |
| `seedsower` | arboliva |
| `stakeout` | mabosstiff, thievul |
| `steelyspirit` | perrserker |
| `thermalexchange` | baxcalibur, baxcaliburmega |

**`grassysurge` and `psychicsurge` are the structurally significant pair**: M-C introduces two terrain
setters at the same time as four terrain-reading seeds and Terrain Extender (§2.3). Terrain becomes a
live field mechanic in this format rather than a dormant one.

### 14 moves new to the format

`courtchange` (cinderace), `doubleshock` (pawmot), `drumbeating` (rillaboom), `glaiverush`
(baxcalibur, baxcaliburmega), `jawlock` (mabosstiff), `meteorassault` (sirfetchd), `milkdrink`
(gogoat), `octolock` (grapploct), `overdrive` (toxtricity, toxtricitylowkey), `pyroball` (cinderace),
`revivalblessing` (pawmot), `shiftgear` (toxtricity), `snipeshot` (inteleon), `zingzap` (pincurchin).

Note `bc4eb07 Champions: Make Double Shock a punching move (#12304)` — Double Shock carries the punch
flag in this format.

### 13 of the 35 species bring no new ability and no new move

```
absolmegaz farfetchd garchompmegaz golisopodmega mrmime persian salamence salamencemega
squawkabilly squawkabillyblue squawkabillywhite squawkabillyyellow wigglytuff
```

**So the species count is the wrong measure of work.** 35 species reduce to **15 abilities + 14 moves
+ 12 held items = 41 mechanics**, and 13 species are pure stat/typing entries.

---

## 6. The ruleset diff: THERE IS NONE

Derivation: `dump.js` captures `Dex.formats.getRuleTable(f)` fully expanded; `fmt.js` compares.

```
SAME  declaredRuleset  ["Flat Rules","VGC Timer","Open Team Sheets"]
SAME  expandedRules    ["-nonexistent","-tag:mythical","-tag:restrictedlegendary","-tag:unobtainable",
                        "-unreleased","adjustlevel","cancelmod","dctimerbank","evlimit","flatrules",
                        "itemclause","minteamsize","nicknameclause","obtainable","obtainableabilities",
                        "obtainableformes","obtainablemisc","obtainablemoves","openteamsheets",
                        "pickedteamsize","speciesclause","teampreview","timeoutautochoose",
                        "timeraddperturn","timergrace","timermaxfirstturn","timermaxperturn",
                        "timerstarting","vgctimer"]
SAME  valueRules       ["adjustlevel=50","evlimit=Auto","itemclause=1","minteamsize=6",
                        "pickedteamsize=Auto","timeraddperturn=0","timergrace=90",
                        "timermaxfirstturn=90","timermaxperturn=55","timerstarting=420"]
SAME  declaredBanlist, declaredUnbanlist, complexBans, complexTeamBans
SAME  gameType, minTeamSize, maxTeamSize, pickedTeamSize, minLevel, maxLevel, defaultLevel,
      adjustLevel, maxMoveCount, evLimit, bestOfDefault
```

`data/mods/champions/rulesets.ts` is **byte-identical between the two checkouts** (`diff -q`), and
`championsregmb` does not override it.

Only three fields differ, none of them a rule:

| field | pinned M-B | new M-B | M-C |
|---|---|---|---|
| `mod` | `champions` | `championsregmb` | `champions` |
| `name` | …Reg M-B | …Reg M-B | …Reg M-C |
| `searchShow` | `true` | **`false`** | `true` |

**`searchShow: false` is an OPS fact worth routing**: the M-B ladder is no longer searchable on
Showdown, so the M-B replay stream stops. It is not a rules change.

### The ban list, asked of the format rather than recalled (`bans.js`)

DELIBERATELY inspects `isNonstandard`. `'Past'` = banned, `null` = legal.

| item | M-B | M-C | |
|---|---|---|---|
| choicespecs, choiceband, assaultvest, safetygoggles, covertcloak, clearamulet | Past | Past | banned in both |
| **rockyhelmet** | **Past** | **null** | ***UNBANNED IN M-C*** |
| choicescarf, leftovers, sitrusberry, focussash, lifeorb | null | null | legal in both |
| silktrap, obstruct, burningbulwark | Past | Past | banned in both |
| banefulbunker, spikyshield, protect | null | null | legal in both |

**Rocky Helmet returns in M-C.** It is one of the seven banned items named in the umbrella
`CLAUDE.md`, and it is the only one that moves. That list will need the M-C amendment when Will flips
the regulation over — not before; M-B remains authority until he says so.

---

## 7. `isNonstandard: "Future"` — the flag means nothing, the handler means everything

Derivation: `future.js`, `verify.js`. Unfiltered walk, deliberately.

The full `Future` population of the M-C dex:

| kind | ids |
|---|---|
| species (9) | `heatranmega darkraimega zygardemega magearnamega magearnaoriginalmega zeraoramega tatsugiricurlymega tatsugiridroopymega tatsugiristretchymega` |
| moves (1) | `nihillight` |
| items (4) | `magearnite tatsugirinite zeraorite zygardite` |
| abilities (1) | **`auraguard`** |

**Thirteen of these fourteen are simply not legal in M-C** — the filter excludes them and no legal
species reaches them. They are the regulation *after* M-C and are out of scope.

**`auraguard` is the exception, and it is the trap the brief named.** It carries
`isNonstandard: 'Future'` in both mainline and the Champions mod, so **every legality filter excludes
it** — and it is nonetheless live in M-C, because a mega's ability is never *chosen*, it is forced on
mega evolution. The validator accepts the set:

```
validate Lucario @ Lucarionite Z -> null      (null = no problems; the set is legal)
lucariomegaz abilities = {"0":"Aura Guard"}  changesFrom=Lucario  requiredItem=Lucarionite Z
```

And it has a real body, not a declaration:

```js
onSourceModifyDamage(damage, source, target, move) {
  if (move.flags["contact"]) return this.chainModify(0.5);
}
```

**Aura Guard halves contact damage.** It must be implemented. Reading the `Future` flag alone would
have dropped it, and no legality list mentions it anywhere.

### Implementation check on all 41 new entities

Every one of the 15 abilities, 14 moves and 18 items was checked for a handler body, a behavioural
field, or an external consumer. **Genuinely unimplemented: zero.** No `// TODO` and no empty body.

Three entries first flagged as "declaration only" were **instrument over-matches**, cleared by
reading the source:

- **`milkdrink`** — the check omitted `heal` from its list of behavioural fields. It carries
  `heal: [1,2]`, `target: "adjacentAllyOrSelf"`, `flags: {snatch,heal,metronome}`. Fully implemented.
- **`terrainextender`** — no handlers of its own; consumed by the four terrain setters at
  `data/moves.ts:4511, 7687, 12165, 14109` (`if (source?.hasItem('terrainextender'))`).
- **`bindingband`** — no handlers; consumed at `data/conditions.ts:231`
  (`this.effectState.boundDivisor = source.hasItem('bindingband') ? 6 : 8`).

Six of the 18 items (`absolitez baxcalibrite garchompitez golisopite lucarionitez salamencite`) carry
only `onTakeItem`, which is correct and complete for a mega stone.

`octolock` and `meteorassault` are `isNonstandard: 'Past'` in mainline and set to `null` by the
Champions mod — implemented and legal. `leek` and `salamencite` are the same shape.

---

## 8. What this means for ENGINE

Stated plainly, and none of it is done in this pass — this report derives, it does not implement.

1. **41 mechanics to implement**, not 35 species: 15 abilities, 14 moves, 12 held items.
2. **`auraguard` will be dropped by any legality-filtered generator.** It needs an explicit carve-out
   keyed on "reachable as a mega's forced ability", or it will be silently absent — this project's
   signature failure mode.
3. **Terrain becomes live.** Grassy Surge + Psychic Surge + four seeds + Terrain Extender land
   together; the terrain code path has had no legal setter in M-B.
4. **Two silent PP changes** — Wish and Strength Sap, 10 → 5 — that no legality list reveals.
5. **Archaludon loses Mirror Coat and Metal Burst** and gains Slash.
6. **Twenty entries have moved under the pinned M-B engine** (§3.2), seven of them board-material,
   independent of the regulation. `disguise` and `growth`/`megasol` are reachable in M-B *today* and
   mean ABRA's M-B simulator now differs from current Showdown. Whether to chase that while M-B is
   still the published authority is a routing decision, not ENGINE's call — it is a MEASURE question
   about which authority a figure rests on.
7. **The M-B ladder is `searchShow: false`.** OPS should know the M-B replay stream ends.

---

## 9. Reproduction

```bash
S=C:/Users/willj/AppData/Local/Temp/claude/C--Users-willj-Projects-Pokemon-ABRA/29d6f78c-ebd1-40dc-b2a3-d3eac1846836/scratchpad/mc
node $S/delta.js        # legality sets, same-bytes
node $S/defs.js         # definition diff for entries legal in both, same-bytes
node $S/learn2.js       # learnsets + added-species surface, validator-confirmed
node $S/future.js       # Future scan + handler-body check on all 41 new entities
node $S/verify.js       # the four suspect cases
node $S/bans.js         # the CLAUDE.md ban list, asked of both formats
node $S/dump.js <checkout> <formatId> <out.json>    # run three times
node $S/buckets.js mb_pinned.json mc_new.json MB-PINNED MC-NEW
node $S/lsdiff.js mb_pinned.json mc_new.json MB-PINNED MC
node $S/fmt.js mb_pinned.json mb_new.json mc_new.json
```

Neither checkout was modified. No git command was run against either. No file in the ABRA main tree
was edited.
