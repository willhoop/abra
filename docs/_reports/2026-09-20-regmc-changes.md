# Reg M-B → Reg M-C: Will's recollections checked against published sources

Date: 2026-09-20. Historical findings record — not a living document, not current state.

**What this is.** Will gave four recalled statements about what changed from Champions VGC 2026
Regulation M-B to Regulation M-C (live 2026-09-09). Each is checked here against third-party change
notes and against Pokémon Showdown's own source.

**Rule followed throughout.** No Pokémon, item, ability or move name in this document was typed from
memory. Every name is either transcribed from a source page (URL given) or derived from a Showdown
dex/mod file (path and, where upstream, commit given).

---

## 0. The two code bases this report compares

| Label | What it is | M-C format present? |
|---|---|---|
| **M-B checkout** | `C:\Users\willj\Projects\Pokemon\pokemon-showdown` — the repo's pinned Showdown. Read-only here; nothing was modified and nothing was pulled. | **No.** `config/formats.ts` holds `[Gen 9 Champions] VGC 2026 Reg M-B` / `Reg M-A` and no M-C entry. Its `champions` mod IS M-B. |
| **Upstream master** | `smogon/pokemon-showdown` on GitHub, read over HTTPS on 2026-09-20. | Yes. `[Gen 9 Champions] VGC 2026 Reg M-C` → `mod: 'champions'`; M-B has been frozen into a new `championsregmb` mod (and `championsregma` is gone). |

So the M-B checkout is the **"before" side** of every comparison below. It predates M-C entirely and
**cannot** be used to say what M-C does. Where this report states an M-C behaviour from code, the
source is upstream master, cited by commit.

Upstream format id for M-C (derived from the format name, not typed): `gen9championsvgc2026regmc`.

---

## 1. Claim: "it's mostly terrain setters"

### Verdict: **REFUTED as stated, CONFIRMED as a theme.**

Terrain is unmistakably the item-side headline, and terrain setters do arrive — but they are 3 of the
26 dex entries added, not "mostly".

**Source — Serebii, "Ranked Battle Regulation M-C":**
<https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-c.shtml>

> **Newly Useable Pokémon:** Wigglytuff, Persian (both forms), Farfetch'd, Mr. Mime, Swalot,
> Salamence, Gogoat, Golisopod, Rillaboom, Cinderace, Inteleon, Thievul, Toxtricity (both forms),
> Grapploct, Perrserker, Sirfetch'd, Pincurchin, Indeedee (both forms), Pawmot, Arboliva,
> Squawkabilly, Mabosstiff, and Baxcalibur.

> **Newly Added Items:** Leek, Rocky Helmet, Air Balloon, Red Card, Binding Band, Eject Button,
> Normal Gem, Terrain Extender, Electric Seed, Psychic Seed, Misty Seed, and Grassy Seed.

**Derivation — abilities of every species on that list** (M-B checkout, `Dex.forFormat(...regmb)`;
the species are all `isNonstandard: 'Past'` there, i.e. not legal in M-B, which is consistent):

Exactly three carry a terrain-setting ability:

| Species | Ability, as the dex spells it |
|---|---|
| Rillaboom | Grassy Surge |
| Pincurchin | Electric Surge |
| Indeedee and Indeedee-F | Psychic Surge |

The other 23 entries carry none. **3 of 26 is not "mostly".**

**But the terrain framing is right, and stronger than Will put it.** Derived from the same checkout,
the only M-B-legal holder of any of the four terrain-setting abilities is **Raichu-Mega-X**
(Electric Surge) — and no M-B-legal species has Grassy Surge, Psychic Surge or Misty Surge at all.
So terrain as a usable strategy essentially *begins* in M-C. Five of the twelve new items are terrain
items by name (Terrain Extender, Electric Seed, Psychic Seed, Misty Seed, Grassy Seed).

**One loose end worth flagging:** Misty Seed is added, but **no species on Serebii's list carries
Misty Surge** and no M-B-legal species does either. Either Misty Terrain has no setter in M-C, or a
setter exists that no source I read names. Not resolved here.

**Code confirmation (upstream `data/mods/champions/formats-data.ts` vs the M-B checkout's):** exactly
33 keys stop being `isNonstandard: "Past"` and **zero** become `"Past"` — M-C removes nothing, matching
every source. The 33, verbatim from the files:

```
absolmegaz, arboliva, baxcalibur, cinderace, farfetchd, garchompmegaz, gogoat, golisopod,
grapploct, indeedee, indeedeef, inteleon, lucariomegaz, mabosstiff, mrmime, pawmot, perrserker,
persian, persianalola, pincurchin, rillaboom, salamence, salamencemega, sirfetchd, squawkabilly,
squawkabillyblue, squawkabillywhite, squawkabillyyellow, swalot, thievul, toxtricity,
toxtricitylowkey, wigglytuff
```

(33 > 26 because Serebii's "both forms" and the Squawkabilly plumage formes expand out, and because
two mega keys ride along in this file.)

---

## 2. Claim: "some nuances with the eject button and other items"

### Verdict: **CONFIRMED.**

Twelve items are added, and one of them (Eject Button) carries a rule change — see §3.

Serebii's list is quoted in §1. It is corroborated item-for-item by theclick.gg:
<https://www.theclick.gg/pokemon-champions-regulation-m-c-items/>

> Pokémon Champions Regulation M-C Items add 12 held items with the September 9, 2026 update: Leek,
> Rocky Helmet, Air Balloon, Red Card, Binding Band, Eject Button, Normal Gem, Terrain Extender,
> Electric Seed, Psychic Seed, Misty Seed and Grassy Seed.

> Eject Button switches the holder out of battle when the holder takes damage from a move and
> disappears for the duration of the battle after a single use.

**Code confirmation.** Diffing `data/mods/champions/items.ts` (M-B checkout) against upstream master's:
exactly twelve keys stop being `isNonstandard: "Past"`, zero become it —

```
airballoon, bindingband, ejectbutton, electricseed, golisopite, grassyseed, mistyseed,
normalgem, psychicseed, redcard, rockyhelmet, terrainextender
```

plus six keys that are new to the file and legal: `absolitez, baxcalibrite, garchompitez, leek,
lucarionitez, salamencite`. Eleven of the twelve item names match Serebii exactly; the twelfth,
`golisopite`, is a mega stone (Serebii lists Leek under items and the stones under megas).

**ABRA-relevant nuance, not in any fan source.** **Rocky Helmet** is on the added list. The repo's
umbrella `CLAUDE.md` records it as a *banned* item — correctly, for M-B (derived: the M-B checkout
has `rockyhelmet: { inherit: true, isNonstandard: "Past" }`). In M-C it is legal. Any team-building
or damage logic that hard-codes "no Rocky Helmet in this format" is wrong the moment M-C is in scope.

---

## 3. Claim: "they fixed the eject button and u turn bug — so then both mons now switch out, i think the eject button used to cancel the attacker's switch"

### Verdict: **CONFIRMED, including the description of the old behaviour.** Two independent sources
plus the Showdown commit that implements it.

**Source — Bulbapedia, "Eject Button", raw wikitext** (fetched via `?action=raw`):
<https://bulbapedia.bulbagarden.net/wiki/Eject_Button>

The page files this under `=====Generation IX=====` → `======Champions======`:

> If {{m|U-turn}}, {{m|Volt Switch}} or {{m|Flip Turn}} causes a Pokémon's held Eject Button to
> activate, the Pokémon that used the move will now switch out.

and preserves the old rule one section up, under `=====Generation V=====`:

> If {{m|U-turn}} or {{m|Volt Switch}} causes a Pokémon's held Eject Button to activate, the Pokémon
> that used the move is not switched out.

That is Will's recollection almost word for word, and his hedge ("i think the eject button used to
cancel the attacker's switch") is exactly right.

**Timing evidence that this is an M-C change and not launch behaviour.** Bulbapedia's revision
history for the page (<https://bulbapedia.bulbagarden.net/w/index.php?title=Eject_Button&action=history>)
shows the Effect section gaining 226 bytes on **2026-09-10**, one day after M-C went live, with the
previous edits on 2026-09-09 being the Champions description and acquisition rows. Circumstantial,
but it points one way.

**Second source, stated as a change:** a search of change-notes coverage returns the sentence
"Eject Button activating no longer stops U-turn, Volt Switch and Flip Turn from switching the Pokémon
using it out." Candidate pages carrying M-C mechanics write-ups:
<https://gamewith.ai/pokemon-champions/en/articles/regulation-mc>,
<https://www.pokemon-zone.com/champions/regulations/m-c/> (returned HTTP 403 to a direct fetch — not
read first-hand, listed for the record only),
<https://www.youtube.com/watch?v=Ci2XIZZnsXI> ("Every Mechanics Change In Pokemon Champions M-C
Explained" — not watched).

**The code, both sides.**

*Before (M-B checkout, `data/items.ts`; the `champions` mod there only sets `isNonstandard`, so this
mainline body is what M-B would run):*

```js
	ejectbutton: {
		...
		onAfterMoveSecondaryPriority: 2,
		onAfterMoveSecondary(target, source, move) {
			...
				target.switchFlag = true;
				if (target.useItem()) {
					source.switchFlag = false;      // <-- cancels the attacker's pivot switch
				} else {
					target.switchFlag = false;
				}
		},
	},
```

*After — upstream commit `aa6d5f0856`, 2026-09-13, "Champions: Allow self-switches even if Eject
Button is triggered (#12309)", the whole of which is +16/-0 in `data/mods/champions/items.ts`:*

```js
+	ejectbutton: {
+		inherit: true,
+		onAfterMoveSecondary(target, source, move) {
+			if (source && source !== target && target.hp && move && move.category !== 'Status' && !move.flags['futuremove']) {
+				if (!this.canSwitch(target.side) || target.forceSwitchFlag || target.beingCalledBack || target.isSkyDropped()) return;
+				if (target.volatiles['commanding'] || target.volatiles['commanded']) return;
+				for (const pokemon of this.getAllActive()) {
+					if (pokemon.switchFlag === true) return;
+				}
+				target.switchFlag = true;
+				if (!target.useItem()) {
+					target.switchFlag = false;
+				}
+			}
+		},
+	},
```

The commit message body reads, in full:

> Champions: Allow self-switches even if Eject Button is triggered
>
> * Remove onAfterMoveSecondaryPriority

**Ordering — two separate things changed, and only one of them is in any fan source.**

1. **The switch itself.** `source.switchFlag = false` is gone. The attacker's pivot switch now stands,
   so both Pokémon leave the field. Fan sources describe this; the code matches.
2. **The handler's priority.** The override drops `onAfterMoveSecondaryPriority: 2`, so Eject Button
   now resolves at the default `onAfterMoveSecondary` priority. In the M-B checkout that `2` is the
   **only** `onAfterMoveSecondaryPriority` in `data/items.ts`, and **Red Card** — newly legal in M-C —
   runs the same hook with no explicit priority. Before this change Eject Button was guaranteed to be
   offered first; now the two are ordered by the engine's normal tie-breaking. **No source I read
   mentions this.** It is read straight off the diff, and it is the kind of ordering detail that
   decides which item fires when both are on the field.

**Also load-bearing and easy to miss:** Eject Button did not exist in M-B at all (`isNonstandard:
"Past"`, §2). So this is not a bug in a thing people were using — it is a rule attached to an item on
its first regulation. "They fixed the bug" is the right outcome with a slightly wrong history.

**Nothing to reconcile between sources here.** Bulbapedia, the change-note coverage and Showdown's
code all say the same thing. The one genuine timing gap: upstream Showdown shipped M-C on
**2026-09-09** (`812501ede8`) and did not land this behaviour until **2026-09-13** (`aa6d5f0856`).
**Any M-C replay played on Showdown between those dates ran the old, attacker-does-not-switch rule.**
That is a corpus-segmentation fact, not a mechanics fact, and it will not announce itself.

---

## 4. Claim: "new megas they added"

### Verdict: **CONFIRMED — six.**

**Source — Serebii (same URL as §1):**

> **New Mega Evolutions:** Mega Absol Z, Mega Salamence, Mega Garchomp Z, Mega Lucario Z, Mega
> Golisopod, and Mega Baxcalibur.

**Source — official, "Get Ready for Regulation Set M-C in Pokémon Champions":**
<https://www.pokemon.com/us/news/get-ready-for-regulation-set-m-c-in-pokemon-champions>
The article gives the window as "Tuesday, September 8, 2026, at 7:00 p.m. PDT to Tuesday, December 1,
2026, at 5:59 p.m. PST", says "24 Pokémon newly available for battle", names the same six megas, and
names Rillaboom among those that "have made an impact in past VGC tournaments". It says nothing about
terrain, Eject Button, pivot moves or bug fixes.

**A date disagreement, unresolved.** The official page says the set starts 2026-09-08 19:00 PDT;
Serebii's regulation page says "September 9th 2026 - December 2nd 2026"; Serebii's patch page dates
Version 1.2.0 to "September 9th 2026". These are the same instant read in different time zones. Use
the official page for the boundary.

**A count disagreement, unresolved.** The official page says **24** newly available Pokémon; Serebii's
"Newly Useable" sentence lists **23 names** (with three "both forms" parentheticals); Serebii's patch
page lists **29 entries** because it folds the mega formes in. Showdown's formats-data yields **33
newly legal keys** because it expands every forme. All four are consistent under different counting
rules; none is wrong. **Do not quote a single "how many Pokémon were added" number without saying
which rule it counts by.**

**Derivation — the six mega formes, from upstream `data/pokedex.ts` on master:**

| Key | Ability (verbatim from the file) | Types | Base stats |
|---|---|---|---|
| `absolmegaz` | `Sharpness` | `["Dark", "Ghost"]` | `{ hp: 65, atk: 154, def: 60, spa: 75, spd: 60, spe: 151 }` |
| `salamencemega` | `Aerilate` | `["Dragon", "Flying"]` | `{ hp: 95, atk: 145, def: 130, spa: 120, spd: 90, spe: 120 }` |
| `garchompmegaz` | `Levitate` | `["Dragon"]` | `{ hp: 108, atk: 130, def: 85, spa: 141, spd: 85, spe: 151 }` |
| `lucariomegaz` | `Aura Guard` | `["Fighting", "Steel"]` | `{ hp: 70, atk: 100, def: 70, spa: 164, spd: 70, spe: 151 }` |
| `golisopodmega` | `Tough Claws` | `["Bug", "Steel"]` | `{ hp: 75, atk: 150, def: 175, spa: 70, spd: 120, spe: 40 }` |
| `baxcaliburmega` | `Thermal Exchange` | `["Dragon", "Ice"]` | `{ hp: 115, atk: 175, def: 117, spa: 105, spd: 101, spe: 87 }` |

Three of these are a **second** mega forme for a species that already had one in M-B. Derived from the
M-B checkout, where `absolmega` / `garchompmega` / `lucariomega` are all `isNonstandard: null`:

| Species | M-B mega (ability / types) | M-C additional mega (ability / types) |
|---|---|---|
| Absol | `Absol-Mega` — Magic Bounce, `["Dark"]` | `Absol-Mega-Z` — Sharpness, `["Dark", "Ghost"]` |
| Garchomp | `Garchomp-Mega` — Sand Force, `["Dragon", "Ground"]` | `Garchomp-Mega-Z` — Levitate, `["Dragon"]` |
| Lucario | `Lucario-Mega` — Adaptability, `["Fighting", "Steel"]` | `Lucario-Mega-Z` — Aura Guard, `["Fighting", "Steel"]` |

Each pair is reached by a **different stone** (`absolite`/`absolitez`, `garchompite`/`garchompitez`,
`lucarionite`/`lucarionitez`), so the choice is made at team build, not in battle. Any code that maps
species → one mega forme is wrong for these three. The Z formes also change **type** in two of the
three cases — Absol gains Ghost, Garchomp loses Ground — which moves every immunity and multiplier.

---

## 5. What the sources describe that Will did **not** mention

Ordered by how much damage each would do if it went unnoticed.

### 5.1 A brand-new ability, `Aura Guard`, and Showdown's implementation is provisional

Derived by diffing `data/abilities.ts` upstream against the M-B checkout: **exactly one key exists
upstream and not in the checkout**, `auraguard`. Verbatim from upstream `data/abilities.ts`:

```js
	auraguard: {
		isNonstandard: "Future",
		onSourceModifyDamage(damage, source, target, move) {
			if (move.flags['contact']) return this.chainModify(0.5);
		},
		flags: { breakable: 1 }, // TODO check breakable
		name: "Aura Guard",
		rating: 3.5,
		num: 319,
	},
```

Added in upstream commit `7340ea4971` (2026-09-01) "Add Absol, Garchomp, and Lucario Mega Z's
Abilities (#12275)", then marked nonstandard by `50408e6f95` (2026-09-01) "Mark Aura Guard as
nonstandard". It halves the damage of contact moves aimed at the holder, and it is the ability of a
mega forme M-C makes legal.

Two things make this the most dangerous item on this page:

- **It is a new mechanic, not a new statline.** A damage engine with no `Aura Guard` branch will
  silently over-predict every contact hit into Lucario-Mega-Z by a factor of two, and nothing will
  report an error.
- **Showdown's own implementation is not settled.** `isNonstandard: "Future"` plus `// TODO check
  breakable` means Showdown itself has not confirmed whether Mold Breaker-class effects bypass it.
  **Do not treat Showdown as authority on this one ability** the way this repo normally does — it is
  flagged unfinished in its own source. This is a disagreement-in-waiting, recorded as such.

### 5.2 Move changes shipped with M-C — thirteen unbanned, and several with altered numbers

No source Will named lists these; they are derived by diffing `data/mods/champions/moves.ts` between
the M-B checkout and upstream master. Thirteen keys stop being `isNonstandard: "Past"`; **zero** become
it:

```
courtchange, doubleshock, drumbeating, glaiverush, jawlock, milkdrink, overdrive, pyroball,
revivalblessing, shiftgear, slash, snipeshot, zingzap
```

Several carry non-default values in the M-C mod, verbatim:

| Key | M-C mod body |
|---|---|
| `slash` | `basePower: 80` (mainline gen 9 in the checkout is `basePower: 70`, `pp: 20`) |
| `snipeshot` | `basePower: 85` |
| `doubleshock` | `flags: { contact: 1, protect: 1, mirror: 1, punch: 1 }` |
| `milkdrink` | `target: "adjacentAllyOrSelf"` — it can be aimed at the partner, which is a doubles-shaped change |
| `meteorassault` | `basePower: 170`, newly written into the mod |
| `wish` | `pp: 5` |
| `strengthsap` | `pp: 5` |
| `disable` | gains a `condition.onBeforeMove` override keyed on `move.flags['cantusetwice']` |
| `octolock` | `isNonstandard: null` |

And one behaviour change that is **narration-shaped**, which matters to this repo specifically:

`direclaw` in the M-B checkout carried a hand-written `secondary.onHit` that emitted `-fail` lines when
the target was already statused:

```js
				if (target.status) {
					if (target.status === status) {
						this.add('-fail', target, status);
					} else {
						this.add('-fail', target);
					}
					return;
				}
				target.trySetStatus(status, source);
```

Upstream's M-C `champions/moves.ts` reduces the same block to `target.trySetStatus(status, source);`
with the `-fail` branch deleted. Given that bare `-fail` rows were the largest narration bucket in the
M-B differential work, this is worth knowing before anyone compares narration across regulations.

**A caveat on that move diff.** Fifteen move bodies differ, but most differ only because upstream
commit `02bb2aead9` (2026-09-01) "Remove redundant Champions descriptions" stripped `desc`/`shortDesc`
strings. Those are `belch, fakeout, firstimpression, freezedry, ironhead, makeitrain, moonblast,
ragefist, saltcure, stuffcheeks, toxicthread` — **cosmetic, not mechanics.** Only the entries tabulated
above are real.

### 5.3 Ability changes in the mod

Diffing `data/mods/champions/abilities.ts`:

- **`disguise` override removed in M-C.** The M-B mod carried a bespoke `onEffectiveness` that forced
  neutral effectiveness for `['mimikyu', 'mimikyutotem']`; upstream's M-C file has no `disguise` entry
  at all, so it inherits mainline.
- **`runaway` override added in M-C**, clearing `trapped` and `maybeTrapped` at priority `-10`. This
  is live content, not dead code: Thievul, newly legal in M-C, has Run Away (derived from the dex).
- `healer` and `unseenfist` keep the same bodies; only their description strings were dropped.

### 5.4 Learnset removals, all three confirmed in code

**Source — Serebii, "Patches & Updates", Version 1.2.0, released "September 9th 2026":**
<https://www.serebii.net/pokemonchampions/patch.shtml>

> Removed the following moves from movepools:
> Politoed - Pound
> Archaludon - Mirror Coat, Metal Burst

> Move PP Adjusted
> Wish - 12 to 8
> Strength Sap - 12 to 8

Verified against the mod learnsets: `pound` is present in the M-B `politoed` block and absent from the
M-C one; `mirrorcoat` and `metalburst` are present in the M-B `archaludon` block and absent from the
M-C one. All three removals are real.

### 5.5 A numeric disagreement on the PP change — flagged, not resolved

| | Wish | Strength Sap |
|---|---|---|
| Serebii patch page (above) | "12 to 8" | "12 to 8" |
| M-B checkout, `Dex.forFormat(...regmb)` | `pp: 10` (no mod override) | `pp: 10` (no mod override) |
| Upstream M-C `champions/moves.ts` | `pp: 5` | `pp: 5` |

Showdown's `pp` field is base PP; its maximum-with-PP-Ups convention is `pp × 8/5`, which turns `5`
into `8` and matches Serebii's post-change figure — but turns the M-B `10` into `16`, which does **not**
match Serebii's pre-change `12`. So the two sources already disagreed *before* M-C, and the agreement
after it may be coincidence.

**This is a disagreement between a fan site and Showdown's code and is recorded as one.** Neither is
picked here. Anything that depends on Wish or Strength Sap PP in M-C needs this settled first.

### 5.6 Serebii's 1.2.0 bug-fix list is empty

The patch page has a heading — "Fixes: The following bugs were fixed" — with **no bullets beneath it**,
unlike Version 1.0.3, which lists six. So **Serebii does not document the Eject Button change**, and
neither does the official pokemon.com article. §3 rests on Bulbapedia plus the Showdown commit. The
game's own completion notice reportedly says only that the update "fixes some additional issues".

### 5.7 Two features, and a new Showdown ladder

Serebii's 1.2.0 additions, verbatim: "Added Battle Log feature" and "Added Selection Support". Neither
is a battle mechanic; a Battle Log is worth a look for OPS if it changes what a replay carries.

Separately, upstream `config/formats.ts` adds `[Gen 9 Champions] Random Doubles Battle` (`mod:
'champions'`, `team: 'random'`). A new ladder is a new population in `search.json` results.

### 5.8 Mega Baxcalibur briefly had two abilities in the data, and no longer does

The M-B checkout's `data/pokedex.ts` gives `baxcaliburmega` two slots — `{ 0: "Thermal Exchange",
H: "Ice Body" }` — while it is `isNonstandard: "Future"` there. Upstream master gives it one,
`{ 0: "Thermal Exchange" }`, changed by commit `490b7fb8c2` (2026-09-10) "Fix Mega Baxcalibur's
abilities". Mega Golisopod moved the same way: the M-C commit `812501ede8` itself changes
`golisopodmega` from `abilities: { 0: "Emergency Exit" }` to `{ 0: "Tough Claws" }`.

**Why this is worth a paragraph.** The umbrella `CLAUDE.md` records a measured invariant — the
regulation holds "76 legal megas and ZERO with more than one ability" — and an unfiltered walk of the
M-B checkout *today* would find a two-ability mega forme and appear to break it. It does not: that
forme is `"Future"` in M-B (so the filter excludes it) and single-ability in M-C. **The invariant
survives into M-C.** But it survived by one upstream bug-fix commit, so it should be re-derived, not
assumed, whenever M-C data is first loaded.

### 5.9 The 208 changed `formats-data` bodies are tier strings, not legality

The diff shows 208 species blocks with changed bodies. Sampled: `politoed` `tier: "UU"` → `"RU"`,
`incineroar` `tier: "UU"` → `"RU"`. Per this repo's standing rule, singles tier labels carry no
information about a doubles format's legality. **They are noise. Do not report tier movements.**

---

## 6. Sources, and what each is worth

| Source | URL | Read first-hand | What it is good for |
|---|---|---|---|
| Serebii — Reg M-C ranked battle | <https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-c.shtml> | yes | the Pokémon / mega / item lists, verbatim |
| Serebii — Patches & Updates | <https://www.serebii.net/pokemonchampions/patch.shtml> | yes (raw HTML) | the 1.2.0 movepool and PP lines; its bug list is empty |
| pokemon.com — official M-C article | <https://www.pokemon.com/us/news/get-ready-for-regulation-set-m-c-in-pokemon-champions> | yes | the authoritative date window and the "24" count |
| Bulbapedia — Eject Button (raw wikitext) | <https://bulbapedia.bulbagarden.net/wiki/Eject_Button> | yes | the only first-hand source for the pivot rule, old and new |
| Bulbapedia — that page's revision history | <https://bulbapedia.bulbagarden.net/w/index.php?title=Eject_Button&action=history> | yes | dates the pivot line to 2026-09-10 |
| theclick.gg — M-C items / 1.2 update | <https://www.theclick.gg/pokemon-champions-regulation-m-c-items/>, <https://www.theclick.gg/pokemon-champions-version-1-2-update/> | yes | corroborates the item list and the 1.2 summary table |
| smogon/pokemon-showdown, master | commits `812501ede8`, `aa6d5f0856`, `7340ea4971`, `50408e6f95`, `490b7fb8c2`, `02bb2aead9` | yes | the only machine-checkable statement of what M-C *does* |
| pokemon-zone.com — M-C changes | <https://www.pokemon-zone.com/champions/regulations/m-c/> | **no — HTTP 403** | listed for completeness only; nothing here rests on it |
| gamewith.ai, YouTube "Every Mechanics Change" | <https://gamewith.ai/pokemon-champions/en/articles/regulation-mc>, <https://www.youtube.com/watch?v=Ci2XIZZnsXI> | **no** | named as corroboration only; not quoted |

**Standing caveat.** Serebii, Bulbapedia, theclick.gg and the rest are **sources, not authorities**.
Where a fan site and Showdown's code diverge, both readings are recorded above (§5.5) and neither is
picked. Where the game itself is the authority — the in-game roster, the in-game PP values — nothing
in this report was checked against it, because nobody here has the game open.

**Not done, and not guessed at:** nobody re-read the in-game 1.2 completion notice; the 403'd page and
the video were not read; and no M-C battle was simulated anywhere, so every behavioural statement above
is read off source code rather than observed.
