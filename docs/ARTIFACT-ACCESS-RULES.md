# Rules for reading artifacts, and the tests that enforce them

**Written 2026-08-01, after the same three-line bug was written four separate times by the same
author across four sessions.**

Will: *"i feel like we have encountered the formes problem a thousand times please finally fix"* and
*"i want all engines to basically refer to artifacts we update, so that way a dozen different engines
dont use a dozen different artifacts? is this the best practice?"*

---

## 1. The finding that makes this document necessary

**Sharing the artifact was never the problem, and would not have prevented the bug.**

Every engine in ABRA already read the *same* table — `MC.mons`, published by the single generated
file `data/engine-data.js`. One artifact, one source of truth, exactly the arrangement Will proposed.
It broke anyway, because one artifact had **five private doorways**:

| file | how it resolved a species name | verdict |
| --- | --- | --- |
| `medicham2-browser.js` | own `pasteKey()` — lowercase, spaces→hyphens, linear rescan | worked |
| `merge_mega_into_engine.js` | own `byNorm` Map | worked |
| `board.js` | `MC.mons[norm(x)]` | **broken** — 101 of 308 keys unreachable |
| `backtest_winrate.js` | `.map(norm).filter(n => MC.mons[n])` | **broken** — silently deleted every forme |
| `forced_switch_audit.js` | `MC.mons[norm(x)]` | **broken** — `null` for every forme |
| `type_coverage.js` | `MC.mons[key] \|\| MC.mons[norm(key)]` | **broken** for normalised names |

`MC.mons` keys formes with a hyphen (`rotom-wash`); the project's `norm()` strips punctuation. The
mismatch cost **8.17% of all observed metagame usage** — Floette-Eternal, Ninetales-Alola,
Rotom-Wash, five Hisuian formes — and it cost it *silently*, because a missing key reads as "the
engine has never seen this Pokémon", which is a legitimate condition nothing should complain about.

> **The unit that has to be single-source is the FUNCTION THAT READS the data, not just the data.**

---

## 2. What the industry calls this, and what it prescribes

Three established ideas apply, and they stack.

### 2.1 Primitive obsession — the root cause

`species` is a `string`. `norm(species)` is *also* a `string`. Nothing — not the compiler, not the
runtime — stops you handing the second where the first was meant. This is the textbook
[primitive obsession](https://blog.ploeh.dk/2011/05/25/DesignSmellPrimitiveObsession/) smell: using a
raw primitive to carry a domain concept that has rules. The standard corrective is a
[strongly typed identifier](https://en.wikipedia.org/wiki/Strongly_typed_identifier) or value object,
so that a "display name" and a "table key" are different *types* and cannot be swapped by accident.

We are in plain JavaScript with no compiler, so we cannot get that check for free. What we can do is
the next best thing: **make the raw table unreachable and hand out only an accessor**, which is the
same idea enforced socially instead of by a type system.

### 2.2 Poka-yoke — make the wrong thing hard, not merely discouraged

[Poka-yoke design](https://blog.ploeh.dk/2011/05/24/Poka-yokeDesignFromSmelltoFragrance/) is the Lean
principle of building an interface so the incorrect use is difficult or impossible; in software this
is just encapsulation. A comment saying "use `mcKey`" is not poka-yoke. A test that fails the build
when you don't is.

Concretely: **the accessor takes the RAW name a human or a sheet would write, and does its own
normalising.** Callers never construct a key. There is then no wrong string to pass.

### 2.3 Architecture fitness functions — tests for structure, not behaviour

An [architecture fitness function](https://lukasniessen.com/blog/12-architecture-fitness-functions/)
sits between a unit test (does this return the right value) and a linter (is this formatted right):
it asserts that the *shape* of the system still matches intent — "all database calls still go through
the repository layer", "module A still does not import module B". Tools like ArchUnit exist for this
in typed languages; in this repo a `grep`-based test does the same job.

This matters because a behavioural test only proves *today's* callers work. The recurring failure here
is a **new** caller writing the same three lines again — which no behavioural test can catch.

The operational loop, from
[Factory.ai's write-up on using linters to direct agents](https://factory.ai/news/using-linters-to-direct-agents):
observe the recurring anti-pattern → codify it as a rule → run it repo-wide to list violations → mass-fix
→ put the rule on the hot path so it cannot land twice. The result is a codebase that "self-heals: new
issues become rules … and guardrails prevent the same problem from landing twice."

---

## 3. The rules

### R1 — One accessor per artifact. The raw artifact is not indexed outside it.

The shared unit is the reader, not the file. `engine/mc_key.js` is the only thing allowed to know how
`MC.mons` spells a species.

**Enforced by:** `tests/test-mc-key.js` — fails on any new file indexing `MC.mons` with a computed
key or building its own index over its keys.

### R2 — Callers differ by PARAMETER, not by re-implementation.

Will's own caution, and it is right: *"some callers will need different things from certain
artifacts."* That is a reason for the accessor to take an **argument**, never a reason for a second
lookup. The repo already has the good example — `species_sets.js:23`: the bot samples within
`cover(sp, 0.80)`, DITTO's gauntlet keeps the entire tail, because "optimising a team against
opponents who all run the modal set is optimising against a metagame that does not exist." One
accessor, one knob, two callers, opposite needs, no duplication.

**Share the FACT. Do not share the POLICY over the fact.** And some things must not be shared at all
— Will's Tower games are quarantined and never trained on, by design.

### R3 — The accessor takes the raw name; callers never build a key.

`mcKey('Rotom-Wash')`, `mcKey('rotom wash')` and `mcKey('rotomwash')` all answer `rotom-wash`. There
is no normalised-but-not-quite string for a caller to get wrong, because callers never hold one.

### R4 — Pin BEHAVIOUR, not just names and shapes.

`magnemite.js` already compared feature names and vector length, and both passed while `allyHit`
quietly changed meaning. `engine/feature_fixture.js` hashes each feature's values over frozen boards
and checks them at weight load, so a changed *meaning* fails loudly.

**Enforced by:** `tests/test-feature-semantics.js`, which proves the guard catches the real 2026-08-01
defect rather than asserting it in the abstract.

### R5 — Ratchet, never big-bang.

Baseline what exists; fail only on what is **new**. `tests/test-no-silent-failure.js` was adopted this
way with 233 pre-existing cases and is still running; a test that demands a 233-file cleanup before it
can be turned on gets turned off. `data/mc-key-baseline.json` holds the 16 files still hand-rolling
the lookup. **The list may only shrink.**

Two entries there are legitimate and will stay: `medicham2-browser.js` is a browser file with no
`require`, and `merge_mega_into_engine.js` *builds* the table, so it cannot ask an index of something
that does not exist yet.

### R6 — The second occurrence of a bug must ship the guard against the third.

This is the rule that would have ended the forme problem in July. Fixing an instance is not finishing;
if the same shape has now happened twice, the fix is not done until something *fails* when it happens
again.

The repo already had this instinct and applied it unevenly — `test-drop-guard.js` asserts
`B.featuresFor(` appears exactly once, precisely so a second call site cannot reappear. That is the
pattern. It was simply never applied to species lookup.

### R7 — A guard only guards what it exercises.

The semantics guard did **not** catch the forme bug, and that is worth stating rather than glossing:
every species in its fixture was hyphen-free, so the entire forme code path lay outside the boards it
checked. Coverage is not incidental to a fitness function, it *is* the function. `test-mc-key.js`
therefore asserts every key in the live table resolves, rather than spot-checking a few.

---

## 4. What was applied on 2026-08-01

- **`engine/mc_key.js`** — the one resolver, node + browser, index built from the artifact's own keys
  so nothing is typed and a change to the generator's naming is picked up with no edit.
- **`board.js` delegates to it** rather than keeping a fourth private copy. Verified behaviour-identical
  by the semantics hashes not moving.
- **Fixed:** `backtest_winrate.js` (was deleting every forme team from the MEDICHAM validation set),
  `forced_switch_audit.js`, `type_coverage.js`.
- **`tests/test-mc-key.js`** — the fitness function, ratcheted against `data/mc-key-baseline.json`.

## 5. Honest limits

- **R1 is enforced by regex, not by a type system.** A caller determined to get around it can. The
  regex is deliberately over-broad and then baselined, because a clever regex that decides which
  lookups are "fine" is how the next one gets through.
- **This document does not fix the 16 baselined files.** Most are tests indexing with keys they
  themselves just produced, which is harmless. They are recorded so the number can only go down.
- **The same audit has not been done for other artifacts.** `MC.moves` happens to be collision-free
  and hyphen-free today, so it has no equivalent bug — but nothing checks that it stays that way, and
  no other artifact has been swept. That is the obvious next application of R1.
