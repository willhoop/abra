# An unknown format id silently returned mainline Gen 9 — the refusal, its callers, and what it did not touch

**2026-09-08. ENGINE.** Dated findings record, not a living document. Nothing here is maintained;
read `node engine/status.js` for state.

---

## The defect, measured

`Dex.forFormat(id)` **does not throw** on a format id the checkout has never heard of. It returns the
BASE mod. Measured on the pinned checkout (`20ad99ffc9a5`, 2026-07-22), printed by
`tests/probe_unknown_format_refusal.js`:

```
gen9championsvgc2026regmb  exists=true   fmt.mod=champions  currentMod=champions  347 legal species  rockyhelmet=Past   silktrap=Past
gen9championsvgc2026regmc  exists=false  fmt.mod=gen9       currentMod=base       911 legal species  rockyhelmet=LEGAL  silktrap=LEGAL
```

The National Dex arrives wearing the format's **name and id**, every Champions override gone, every
banned item legal again, and every caller reports success. It is not specific to one id —
`gen9thisformatdoesnotexistanywhere` and the empty string resolve exactly the same way.

**It was armed for the moment `active` moves in `data/regulations.json`.** `engine/champions_sim.js`
derives `FORMAT` from that file, and **228 call sites** resolve it through `CS.sim().Dex.forFormat(...)`.
Nothing anywhere would have said the dex had changed underneath them.

**The regulation token is derived, never named.** The probe walks the active regulation's token
forward — `regm{b}` → `regm{c}` → … — and takes the first id this checkout does not carry. The day
Showdown ships that format, the probe walks past it on its own. No file changed here contains the
string `regmc`.

## What was shown RED

`tests/probe_unknown_format_refusal.js`, run before any fix. The probe then held 12 clauses; the
end-to-end rehearsal below was written after the seam was wired and is red without it too
(`CS.dexFor` does not exist), so **4 of 13** is the honest red count for the probe as it now stands:

```
THE SEAM — `CS.sim().Dex.forFormat(...)`, which 228 call sites use:
  FAIL REFUSES the unavailable regulation id       RETURNED A DEX — the base mod, silently
  FAIL REFUSES an unavailable id of any shape      RETURNED A DEX — the base mod, silently
  FAIL REFUSES an empty format id                  RETURNED A DEX — the base mod, silently
FAIL — 3 assertion(s)                                                        exit 1
```

After the fix, **PASS, exit 0 — 13 of 13 clauses**, with the control block unchanged throughout: the active format
resolves without throwing, to a champions mod, to **347** legal species, with Rocky Helmet and Silk
Trap still `isNonstandard: 'Past'`.

The probe also carries the raw-Showdown block as assertions (`exists=false`, `currentMod=base`,
911 > 347, item legal). Those are true before AND after — they describe upstream, not us. They are
asserted so that if Showdown ever starts throwing here, the probe fails rather than quietly becoming
a test of nothing. The raw block reads the Showdown Dex **around** our seam on purpose; resolving it
through `CS.sim().Dex` would have flipped it red-to-green for the wrong reason.

## The fix — one refusal at one seam

`engine/champions_sim.js`:

1. **`dexFor(formatId)`** — the resolver. Two clauses, neither naming a format:
   - `Dex.formats.get(id).exists` must be true. This is the whole defect and it catches **any**
     unavailable id.
   - the resolved dex's `currentMod` must match `/^champions/`. **A prefix test, not equality** —
     measured on this checkout, `gen9championsvgc2026regma` carries mod `championsregma` while
     `regmb` carries `champions`, so `=== 'champions'` would refuse a real regulation the day M-B is
     frozen off the live mod.

   The error names the checkout, the pinned commit, and lists the Champions formats it **does** carry.

2. **`sim().Dex` is now a Proxy** whose only difference is that `forFormat` is `dexFor`. Everything
   else forwards to the real Dex, with methods bound to it so Showdown's own `this` is never the
   proxy. **This is the structural half:** all 228 sites are covered with no edit, and a site written
   tomorrow is covered the day it is written. A checker that had to be called is a checker somebody
   forgets.

3. **The `FORMAT` fallback is loud.** It was `catch (e) { }` returning the hardcoded literal. It has
   never fired, and if it ever does the run says so on stderr and `verify().format_fallback` carries
   the reason instead of `null`. Guessing still beats crashing a collection job; guessing silently
   does not.

**Not added: a `require` of `next_regulation.js`** for its `VGC_REG` shape test. `champions_sim.js` is
in `engine_release.js`'s `SOURCES`, and a new require edge there retroactively strands every release
cut before it (CLAUDE.md §12). The two clauses need no shape.

**The first cut was wrong and the stack said so:** `dexFor` read `sim().Dex`, whose `forFormat` **is**
`dexFor` — unbounded recursion, `RangeError: Maximum call stack size exceeded`. It now holds `_rawDex`.

### The change is a no-op for the live format, and that is proven by identity

```
CS.sim().Dex.forFormat(CS.FORMAT) === rawDex.forFormat(CS.FORMAT)   ->  true
Dex.formats / getImmunity / forGen / species, all forwarded          ->  true
CS.sim().Dex.forFormat === CS.dexFor                                 ->  true
```

Every consumer receives **literally the same dex instance** it received before. That is a stronger
claim than a sampled differential, which is why it is the evidence offered below.

## The callers — how many were unguarded

| | count | how |
|---|---|---|
| live `forFormat` call sites (excludes `data/releases/`) | 297 | |
| **routed structurally, zero edits** — obtain `Dex` from `CS.sim()` | **228** | the Proxy |
| **unguarded, carrying a MOVING format id, fixed by hand** | **13 sites in 12 files** | 12 routed through `CS.dexFor(...)`, 1 stated in place |
| pinned to the literal `gen9championsvgc2026regmb` on a direct Dex | 37 | left; see residue |

**All six named by the readiness sweep** — `mag_bot.js`, `showdown_bot.js`, `tag_dex.js`, `roster.js`,
`merge_mega_into_engine.js`, `build_engine_data.js` — take `Dex` from `CS.sim()` and are therefore
covered by the Proxy with **no edit to any of them**.

The thirteen, each of which reads the ACTIVE regulation (or `CS.FORMAT`) but held a
direct `require(dist/sim).Dex`:

| file | why it mattered |
|---|---|
| `engine/names.js` ×2 | `megaTable()` — `canMega`/`mega` would have answered off mainline |
| `engine/validate_store.js` | the Illusion set, derived from the National Dex |
| `engine/joint_click_census.js` | already refused a config naming no format, then accepted any id one line later |
| `engine/residual_order.js` | **writes `data/residual-order.json`, which is in `SOURCES`** — a mainline end-of-turn order would have been frozen into the next release |
| `engine/immunity_sweep.js` | an immunity sweep over 911 species |
| `engine/mega_census.js` | `/-Mega/` over the National Dex |
| `engine/scenario_catalogue.js` | the scenario population |
| `engine/replay_differential.js` | the phaze-move set |
| `tests/probe_pair.js`, `tests/test-pinch-family.js`, `tests/test-residual-order-population.js` | fixtures built off the wrong dex |
| `tests/mutation_harness.js` | **stated locally, not routed** — see below |

`tests/mutation_harness.js` reads its format id out of the frozen **release**, and reaching into the
live tree for the resolver would put a moving file inside a pinned block; a release cut before today
has no `dexFor` to call either. So the existence clause is stated there once, in place, with the
reason written beside it.

### The end-to-end rehearsal

The probe stages the real failure — `data/regulations.json` naming a regulation the checkout does not
carry — by moving `CS.FORMAT` in a **child process** (nothing on disk is touched) and then loading
`engine/tag_dex.js`, one of the six the sweep named:

```
ok   a named caller that never mentions the refusal is refused anyway
     REFUSED:champions_sim: REFUSING to resolve format "gen9championsvgc2026regmc" — this Showdown checkout does not carry it.
```

### The residue, named and bounded

**37 call sites in 35 files** pass the literal `'gen9championsvgc2026regmb'` to a direct Dex — mostly
probes, plus `build/build_browser_data.js`, `engine/derive_switch_carry.js`, `engine/fixture_preflight.js`.
They do **not** follow the active regulation, so they cannot silently switch dex when `active` moves;
they become wrong only on the day the pinned checkout stops carrying Reg M-B, and on that day the file
is describing a dead regulation anyway. Routing 30-odd test files while two agents hold `tests/` was
judged the worse trade. It is on the ENGINE hand list.

## `sim/package.json` — the caret, and a bigger finding underneath it

`"pokemon-showdown": "^0.11.9"` → `"0.11.11"`. A caret range is not a pin; the oracle could move
between two `npm install`s with nothing in any artifact saying which one ran.

**The version is not a guess and not "the newest".** `0.11.11` is the one published version whose
legality has actually been compared to ours:
`data/verification/npm-oracle-2026-09-08/npm-oracle-legality.json` — `LEGAL_SETS_IDENTICAL: true`
against the pinned master checkout, 347 species / 500 moves / 148 items / 316 abilities with zero
members on either side only, identical resolved rule table, all three Champions formats identical,
14,192 learnset cells with 0 diffs.

**Safe to change now:** measured 2026-09-08, `pokemon-showdown` **is not installed in
`sim/node_modules` at all**, so all four files in `sim/` are running their `catch` branch today. No
live path resolves the dependency and no measurement can be disturbed by it.

**A WRONG CLAIM WAS WRITTEN HERE FIRST AND IS RECORDED RATHER THAN QUIETLY REMOVED.** The first draft
of this section, and of `sim/README.md`, said the champions mod is absent from the published package
so an `npm install` yields mainline Gen 9 — quoting `engine/champions_sim.js`'s header, which says
"0.11.10 does not contain it". **That header is STALE and the artifact above measured the opposite.**
It is exactly the failure CLAUDE.md names: a value typed from a comment looks as authoritative as one
that was read. Corrected in the same pass, in the README and in `champions_sim.js`'s own header.

## What was NOT measured, and why

**The whole-game differential was NOT re-run, deliberately.** `engine/champions_sim.js` is read by
`engine/game_differential.js`, so the brief's board-material clause applies. Two agents were writing
to the tree while this ran:

```
engine/rollout_leaf.js       2026-09-08T13:08Z   48 min before this run   (a SOURCE, the board leaf)
engine/register_reality.js   2026-09-08T13:31Z   24 min
tests/roster.js              2026-09-08T13:33Z   23 min
```

A `--release`-pinned run serves the **frozen** `champions_sim.js` and therefore cannot see this change
at all; an unpinned run would have been a measurement taken beside two writing agents, which is the
void-run failure CLAUDE.md is built around. **The last measured value stands and is not restated
here.** The evidence offered instead is the object-identity proof above: the differential receives the
same dex instance it received before, so no board can move through this path.

**`data/mechanics-census.json` was NOT regenerated.** No mechanic changed, and `tests/test-mechanics.js`
would have rewritten the artifact under the same two live writers. Census stands at **830 probed /
830 live / 0 missing / 0 unarmed**, read from the existing artifact, not re-measured.

**Green gates run:** `tests/probe_unknown_format_refusal.js` PASS, `tests/test-mod-conformance.js`
passed, `tests/test-engine-consistency.js` all checks passed, `engine/names.js --selftest` 11/11,
`node engine/champions_sim.js` FOUND / mod champions, `engine/residual_order.js` exit 0, plus
`node --check` on all fourteen edited files.

**One side effect to know about:** running `engine/format_audit.js` as a smoke test rewrote
`data/format-audit.json` (268 lines shorter than the committed copy). It was clean at session start
and has been restored with `git checkout --`. **The shrink is not explained here and is worth a look
by whoever owns that artifact** — it means the committed copy and a fresh derivation disagree.

## A RED TEST FOUND IN PASSING, NOT CAUSED HERE AND NOT FIXED HERE

`tests/test-pinch-family.js` reports **1 of 61 FAILED**, clause 4, *"all five 0-use members are still
in the ungated set"* — `ungated set is: firemane`.

**It is not this pass's.** The file was `git stash`ed back to `HEAD` and re-run: **1 of 61 FAILED**
identically. The only edit here is `Dex.forFormat(CS.FORMAT)` → `CS.dexFor(CS.FORMAT)`, which returns
the same object by identity.

It is out of this brief's scope (an urgent format-resolution pass, with an instruction not to touch
`engine/medicham2-browser.js`), so it is **reported, not filed and not renamed a known failure.** It
belongs to whoever owns the `damageBoost` hp-gate set.

## Nothing was committed

`docs/RUNNING-NOTES.md` carries the row. `engine/status.js --write` was not run and no release was
cut, both per the brief.
