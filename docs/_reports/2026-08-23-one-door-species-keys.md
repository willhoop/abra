# One door for species keys — the table is sealed, the lookup is total, and the debt file is gone

**2026-08-23 · ENGINE.** Will: *"i want no more problems not finding certain names cause of spelling
differences make a bulletproof solution and close it out."*

Historical record, not maintained state. Superseded by `node engine/status.js` and by the gates named
below. Every number here was measured on this machine on 2026-08-23 between 19:00 and 21:00 UTC-4.

---

## 1. What was chosen, and why

Turning a species name into a key of `MC.mons` has broken four times, twice after being "fixed and
gated". Every fix so far was **a list of wrong forms**, and a list cannot catch a form nobody thought
of — two of the four got through a list that already existed.

The common property of the four is **not** the spelling. It is the **silence**: every one returned
`undefined` or `null`, which reads as "the engine has never seen this Pokemon" — a real and common
condition — so every caller carried on and nothing complained.

Two changes, in opposite directions, and both are needed:

| | what | where |
|---|---|---|
| **THE SEAL** | `MC.mons` is a `Proxy`. Reading a key the table does not have **THROWS `LookupMiss`**, and the message names the key the caller meant. | `engine/mc_key.js` `seal()`, installed on require, no call needed |
| **TOTALITY** | `buildMon` resolves through the table's own flattened index. `'Rotom-Wash'`, `'rotom-wash'`, `'Rotom Wash'`, `'rotomwash'` all build the same body. | `engine/medicham2-browser.js` `monKey()/monRow()` |

Together: **a name that IS in the table is found however it is spelled, and a name that is NOT crashes
at the call site.** The seal was chosen over "make lookups total everywhere" because silently resolving
a wrong spelling lets the wrong string keep propagating — into a key that gets stored, printed and
compared. At the RESOLVER (`buildMon`) totality is right; at the RAW TABLE a throw is right.

**Why a Proxy and not a better regex.** The trap is on the OBJECT, so it does not care about syntax.
Seven shapes are executed in `tests/test-mc-seal.js` rather than matched as text — a `globalThis.`
prefix, a local alias, an alias through a function return, a run-time concatenation, a destructure, a
template string, and `Reflect.get`. All seven throw. No regex catches the last five.

### What could NOT be done, and it matters

`data/engine-data.js` is off-limits to ENGINE (CLAUDE.md hard limit), so the seal could not be installed
where the table is published. It is installed by `engine/mc_key.js` instead — which means a process that
loads the table without loading `mc_key.js` is **unsealed**. That hole is closed by a fourth, positive
static clause (section 4 of `tests/test-mc-key.js`): every file that requires `data/engine-data.js` must
require `engine/mc_key.js` (or `medicham2-browser.js`, which now requires it) in the same file. Eight
files were fixed in the same pass; the clause reads zero.

**NODE ONLY BY DEFAULT.** `web/index.html`, `web/tower.html` and their `app/` twins index `MC.mons`
directly in ~20 places with `MC.mons[n] || {}`, expecting a miss. They belong to WEB and are not
ENGINE's to rewrite; sealing in a page would break the site on load. Every one of the four incidents
happened under node. A page may opt in with `MCKEY.mcKey.seal({force:true})` once those sites are
routed, and `mcKey.sealed()` reports the truth rather than pretending.

---

## 2. The 96 sites

`data/mc-key-door-baseline.json` recorded **96 doorways in 37 files**. It is **deleted**
(`git rm`; recoverable at `eec2407`).

| | count |
|---|---|
| routed through `engine/mc_key.js` | **~62 sites in 26 files** |
| cleared because the regex was over-matching a now-correct shape (`buildMon(sp.id)`) | 5 sites in 4 files |
| **named HOLDERS with a written reason, in the gate** | 7 files (+3 that are the door/gates themselves) |
| still tolerated as an anonymous count | **zero — the debt file no longer exists** |

The holders, and why each one is not routable:

| file | reason |
|---|---|
| `engine/mc_key.js` | IS the door |
| `tests/test-mc-key.js` | IS the gate |
| `tests/test-mc-seal.js` | ASSERTS the seal by executing the raw accesses the gate only reads as text |
| `engine/medicham2-browser.js` | the BROWSER twin of the resolver — it cannot `require` on the live site, so it carries its own flattened index by the same rule; both raw indexes use a key that index already resolved |
| `engine/artifact_audit.js` | AUDITS key spelling — it asks on purpose whether a normalised key resolves and whether two keys normalise alike. Takes the table through `mcKey.rawTable('<why>')`, so the exemption is recorded at run time too |
| `engine/merge_mega_into_engine.js` | BUILDS the table. `JSON.parse`s `data/engine-data.js` as TEXT into a private object and adds, merges and DELETES rows. There is no shared table in that process |
| `build/rebuild_sets_from_sheets.js` | same — parses the file as text. **Routing it through mcKey was tried and REVERTED**: it would have read the loaded table instead of the one being rewritten, a different object, silently |
| `build/build_engine_data.js` | WRITES `data/engine-data.js`. Its `mons` is the output being constructed |
| `build/build_mag_data.js` | WRITES `data/mag.js`. Its `mons` is MAG's table, not MC.mons |
| `build/medicham-embed.js` | BUILDS the browser embed. Its `out.mons` is the output being constructed |

The three-way split is the load-bearing part. Only the first group touches the shared sealed table at
all. The regex could not tell them apart because it matches on the word `mons`; a reader can, which is
the argument for putting the list in the gate with reasons instead of in a JSON file with counts.

**The list is capped at 10 and the cap is asserted.** Every named holder must be a real file (a stale
entry would silently widen the exemption to a file somebody later creates with that name).

---

## 3. What a brand-new wrong spelling now does

**Both.** It throws at run time, and — for the shapes static analysis can see — it fails a gate.

```
> globalThis.MC.mons['venusaurmega']
LookupMiss: MC.mons: no entry for "venusaurmega" — the table keys that species
"venusaur-mega"; you asked for "venusaurmega". Resolve it with mcKey(name) from
engine/mc_key.js -- that is the one door, and it accepts any spelling.
```

```
> globalThis.MC.mons['gyaradosmegaXYZ']
LookupMiss: MC.mons: no entry for "gyaradosmegaXYZ" — no key of this table flattens
to "gyaradosmegaxyz" at all. If a miss is legitimate here, ask through
mcKey.row(name, {mayMiss: "<why>"}) instead of indexing the table.
```

And a *right* name in a *wrong* spelling now simply works at `buildMon`: 347 table-backed legal species
sweep through a fully flattened name with **zero dropped** (that same sweep was **138 of 345 dropped**
yesterday).

---

## 4. The planted breaks

Every edit made from a byte copy and restored **from that copy**, with sha1 verified identical — not
`git checkout`, which would hide a partial write. Both shapes that have actually beaten this gate
before (`globalThis.` prefix; alias through a local) are in section 5 of `tests/test-mc-seal.js` and
pass as executed code, not as matched text.

| # | break | expected | result |
|---|---|---|---|
| 1a | a COMPUTED raw index of a novel spelling (`"gyarados" + "megaXYZ"`) in a non-holder file | static RED | **RED** — sections 2 and 3 both fired, `tests/test-exposure.js:176` |
| 1b | a STRING-LITERAL index of that same wrong spelling | static GREEN **by design**, runtime RED | **GREEN static** (a literal index of a real key is legal, so the pattern excludes it) — and the **seal threw** on the same line, message quoted above |
| 2 | a file loads the table and DROPS the `mc_key` require | static RED | **RED** — section 4, named the file |
| 3 | the seal disarmed (`seal()` returns false) | both gates RED | **RED** — `test-mc-seal.js` 12 failures; `test-mc-key.js`'s own runtime clause RED |
| 4 | totality removed — `buildMon` back to exact-key AND the mc_key fallback cut | `test-mc-seal.js` RED | **RED** — the three totality assertions |

**Break 1b is the demonstration that matters.** It is the shape the static gate structurally *cannot*
see, and the runtime seal caught it with a message naming the fix. That is the whole argument for
moving the guarantee off text and onto the object.

**A first attempt at break 4 came back GREEN and was wrong, not the probe.** Cutting only medicham2's
local index left `MCK.mcKey(...)` still resolving, so buildMon stayed total by a second path. Worth
recording as a fact about the design: **under node there are two independent routes to totality**, and
one has to cut both to lose it.

---

## 5. Performance

The seal is on `MC.mons` property reads. Measured, not assumed.

| | raw | sealed | overhead |
|---|---|---|---|
| 200,000 direct table reads | 1.5 ms | 15.1 ms | **+68 ns per read** |
| 20,000 `buildMon` calls | 19.4 ms | 26.3 ms | +26% of buildMon, **+345 ns per body** |
| `4 x winProb2(A,B,100)` — a real rollout, two processes, one variable | 2395 / 2391 ms | 2367 / 2428 ms | **within noise, both directions** |

The two-process rollout arms print `sealed=true` / `sealed=false`, so "identical results" here is not an
unwired knob — the same seal costs a clear, repeatable 26% on `buildMon` itself. The rollout simply does
not spend its time there: `buildMon` runs once per BODY, not per turn.

**Verdict: no measurable cost on the hot path. No change of shape needed.**

---

## 6. What moved a number, and what did not

Stated before the run: **these are already-correct call sites being routed, and should move nothing.**
Two did. Both were live bugs.

### FINDING A — six megas were priced as their BASE forme in `position_features.monFor`

`engine/position_features.js` asked the raw table twice:

```js
if (MC.mons[hyphen]) name = hyphen;          // baseSpecies + '-mega'
else if (MC.mons[mega]) name = mega;         // B.megaFormeOf(...) -> a DEX id, which is FLAT
```

The second branch could never succeed: `megaFormeOf` returns `charizardmegax`, the table keys
`charizard-mega-x`. So every mega whose key is not exactly `<base>-mega` fell through to `name = key`
— the base forme. Derived, not guessed (six of them, printed):

```
charizard-mega-x   (base charizard      -> tried "charizard-mega")
charizard-mega-y   (base charizard      -> tried "charizard-mega")
floette-mega       (base floetteeternal -> tried "floetteeternal-mega")
meowstic-m-mega    (base meowstic       -> tried "meowstic-mega")
raichu-mega-x      (base raichu         -> tried "raichu-mega")
raichu-mega-y      (base raichu         -> tried "raichu-mega")
```

Size of the error, measured: **Charizard-Mega-Y SpA 232 was being priced at 196; Charizard-Mega-X Atk
200 at Charizard's.** Now `mcKey.has(mega)` resolves first and `name = mcKey(mega)`.

This is the identical shape as the species-key class — a fact asked in the wrong spelling, answered
`undefined`, and nothing said a word. It was found by routing the site, not by a probe aimed at it.

### FINDING B — `position_features` had a spelling-retry rung that could only ever fail

`M.buildMon(name) || M.buildMon(B.norm(name)) || M.buildMon(B.baseSpecies(name))`. The middle rung
existed because buildMon matched exact keys — and `B.norm` STRIPS the hyphen, so it could only succeed
for a name that had no punctuation to begin with. Removed. The base-species rung stays: it is a
different question ("price this as its base if the forme is not in the table"), not a spelling retry.

### Everything else moved nothing, and that was checked

| scoreboard | before | after |
|---|---|---|
| census (`tests/test-mechanics.js`) | 651 probed / 651 live / 0 missing | **651 / 651 / 0** — unchanged |
| damage differential, `--n 6000 --seed 20260804` | 0 of 6000, all 16 corners | **0 of 6000, all 16 corners** — unchanged, pool 336 of 345 drawable with 76 megas |
| `tests/test-game-diff.js` | passes | passes; `data/game-diff.json` differs by TIMESTAMP ONLY |
| whole-game differential | reads a FROZEN RELEASE (`REL.require`) | **unreachable by this change until a release is cut** — a 40-game smoke run completed with zero throws and zero fallbacks |

`mcKey.keys()` returns **the table's own order, not sorted**, and that was decided by measurement: the
first version returned `mcKey.all()`'s sorted keys and six test files went red at once, because every
one of them does `.slice(0, 12)` to pick a pool. Nothing was wrong with the new pools — they were a
different experiment, which is the worst change to make while re-routing sites that should move nothing.

---

## 7. Tests

| | |
|---|---|
| `tests/test-mc-seal.js` | **NEW.** 33 passed, 0 failed. The runtime guarantee, seven planted shapes, all five historical instances as live code, and the cost measurement |
| `tests/test-mc-key.js` | 21 passed, 0 failed. Four sections. Section 2's baseline is now **empty**; section 3 is **zero outside the holders**; section 4 is new |
| `data/mc-key-baseline.json` | 5 files -> **{}** |
| `data/mc-key-door-baseline.json` | **deleted** |

Also re-run green: `test-engine-consistency`, `test-switch-features`, `test-forced-switch`,
`test-exposure`, `test-priority-block`, `test-future-sight`, `test-choice-lock`, `test-mega-timing`,
`test-oracle-differential`, `test-rollout-fallen`, `test-rollout-switch`, `test-rollout-seed`,
`test-seed-clock`, `test-seed-residue`, `test-entry-effects`, `test-opponent-model`,
`test-board-clock-power`, `test-damage-stages`, `test-tag-wire`, `test-artifact-keys`,
`test-protocol-trace`, `test-interaction-matrix`, `walk_tags`, `artifact_audit`, `type_coverage`,
`format_audit`, `medicham_coverage`.

**RED, and not mine.** `tests/test-rollout-effects.js` fails **7 assertions at HEAD** and fails the same
ones after this change (verified by running the HEAD copy of the file against the current tree): status
moves with no status (`darkvoid`, `lovelykiss`, `grasswhistle`, `poisongas`), `darkvoid` accuracy, three
flinch chances, three priorities, and Full Metal Body / Guard Dog not refusing Intimidate. `engine/preflight.js`
also exits 1 at HEAD and after (the `--switching` advisory). Neither is filed as a known failure — both
are named here and on OWED so somebody decides.

---

## 8. OWED, NOT RUN

1. **`data/provenance-stamp.json` restamp (MEASURE).** It names the deleted `mc-key-door-baseline.json`,
   and a run in this session moved `verified` 4 -> 3. **Reverted to HEAD rather than committed** — a
   ratchet regression is not something to slip into a commit as a side effect.
2. **`data/conformance.json`** also names the deleted file (S13 row). Regeneration owed (MEASURE).
3. **Cut an engine release, then re-run the whole-game differential.** `engine/game_differential.js`
   reads `REL.require`, so the totality fix and the position_features mega fix do not reach the 67/961
   figure until a release is cut. NOT DONE — that is a MEASURE decision.
4. **Anything downstream of `engine/position_features.js`** — the value-function features moved for six
   megas. All of it is already quarantined; the re-run list is ROADMAP #57.
5. **`data/releases/ab482acf3efe/`** was created as a side effect of the 40-game `game_differential.js`
   smoke run, which cuts a release. **The pointer in `data/engine-release.json` was reverted to HEAD**;
   the directory is left in place (not deleted) and is reported here rather than tidied away.
6. **`data/medicham-represented-clicks.json`** and `data/format-audit.json` were regenerated by smoke
   runs. `format-audit.json` was reverted; `medicham-represented-clicks.json` is a new untracked file,
   left in place and reported.
7. **The web pages are unsealed.** ~20 raw `MC.mons[n] || {}` sites in `web/` and `app/`. WEB's call.
8. **`engine/train_value.py`** reaches the table through `node engine/mc_key.js --bases`, a subprocess.
   That route is correct and unchanged, but Python is outside every check here.

---

## 9. Is it bulletproof?

**No. It is much better, and the remaining holes are nameable, which the previous four fixes could not
say.**

What is now **structurally impossible** in a node process that loads the table:

- reading a key the table does not have and getting `undefined` back. There is no spelling, prefix,
  alias, template string, concatenation, destructure or `Reflect.get` that avoids the trap, because it
  traps the property access rather than the text. Demonstrated on seven shapes.
- losing a species at `buildMon` because of punctuation. Demonstrated across all 347 table-backed legal
  species under a fully flattened name.

What is **not** covered, said plainly:

1. **The browser.** Node only by default, for the reason in section 1. ~20 live raw sites in `web/`.
2. **Python.** `train_value.py` and anything else outside `engine/ build/ tests/`.
3. **A species key that never touches `MC.mons` at all** — put into JSON, carried through a store, read
   back and compared to a differently-spelled one. The seal is on one table; it is not a type system.
4. **`ABRA_LOOKUP_SOFT=1`** downgrades the throw to a counted warning. That is deliberate (a long run in
   flight can be finished and its misses read off) and it is a hole while it is set.
5. **The static half is still a list**, and section 3's header says so. It is defence in depth now, not
   the guarantee.
6. **The same class of bug on a DIFFERENT object is untouched.** The MEASURE agent's identity gate found
   `engine/position_features.js:249` reading `f.mon.ability` raw off a live stone-holder. Asked directly:
   **the seal does not catch that and was never going to** — it is a field on a per-mon object, not a key
   of `MC.mons`. The TECHNIQUE generalises exactly (that agent's recording accessor is the same idea
   applied to the mon object); the installed seal does not.

The honest summary: **the species-key class is closed under node, by construction rather than by
vigilance, and it is the first of the four fixes that can be shown red on a shape nobody listed.**
Calling it bulletproof would require sealing the browser and there is a named reason it is not done.
