# REG M-C — the ledger

**Version: 0.1.0 — 2026-09-20.**

A leading `0` means NOT USABLE YET (SemVer 2.0.0 clause 4). This line reaches **1.0.0 the day the M-C
gate opens**, which is the same condition MEDICHAM met for Reg M-B: the differential at zero on every
lattice and on the held-out draw, the roster and staged battery clean, and no open defect an instrument
measures. Nothing is typed to declare it — `engine/quarantine.js` computes it.

Reg M-B's published record is **7.0.0** and is closed. Nothing here changes it.

---

## THE TWO CHECKOUTS, AND WHY THERE ARE TWO

| | path | HEAD | role |
|---|---|---|---|
| **M-B authority** | `C:/Users/willj/Projects/Pokemon/pokemon-showdown` | `20ad99f`, 2026-07-22 | **PINNED. Never pull it, never build it, never modify it.** Every figure in ABRA 7.0.0 rests on these bytes. |
| **M-C authority** | `C:/Users/willj/Projects/Pokemon/pokemon-showdown-mc` | `f10d679`, 2026-09-20 | The moving one. M-C work reads this. |

**The separation is the whole point.** A single checkout that gets pulled would move the authority under
M-B's published figures — the same failure as a measurement reading a live store, one level up.

**M-B DID NOT DRIFT, AND THIS WAS MEASURED RATHER THAN ASSUMED.** The legal species set of
`gen9championsvgc2026regmb` is identical in both checkouts — 347 either way, 0 added, 0 removed
(CHANGELOG 7.1.0). So
adding the second checkout disturbed nothing that 7.0.0 published.

---

## THE DELTA, DERIVED AGAINST THE PINNED AUTHORITY

Full account, with every list and every derivation command:
[`docs/_reports/2026-09-20-regmc-delta.md`](_reports/2026-09-20-regmc-delta.md).

These counts are a LIVE DERIVATION over the two checkouts, not a row in a `data/*.json` artifact, so
they carry no artifact citation and are quoted as the readout that produced them:

```
$ node -e "compare Dex.forFormat('...regmb') in the PINNED checkout
           against Dex.forFormat('...regmc') in the M-C checkout"
  species    +35   -0
  moves      +15   -0
  items      +18   -0
  abilities   +0   -0
  ruleset    identical: same expanded rules, value rules, banlists, timer

  new to the format, by kind:  abilities 15   moves 14   held items 12   = 41 mechanics
  added species bringing nothing new:  13
```

**M-C is a strict superset. Nothing is removed anywhere.**

**THE REAL SURFACE IS THE MECHANIC COUNT, NOT THE SPECIES COUNT** — a third of the added species bring
nothing new at all, so counting species would have overstated the work and pointed it at the wrong
things.

### The changes that no legality list reveals

**Two moves are legal in BOTH regulations and had their PP cut.** Verified directly against both
checkouts:

```
$ node -e "MB(pinned).moves.get(id).pp  vs  MC.moves.get(id).pp"
  wish          pp  10 -> 5
  strengthsap   pp  10 -> 5
```
 A changed number on an entity that exists in both is the dangerous kind of change: every
"what was added / what was removed" list shows nothing, and an engine built by assuming *M-B plus the
new things* carries the old value forever. One species also loses two moves and gains one, confirmed in
both directions by the validator.

**Rocky Helmet is UNBANNED in M-C** — `isNonstandard` moves from `"Past"` to `null`. The umbrella
`CLAUDE.md` ban list is correct for M-B and becomes wrong for M-C the day this line goes active. The
other six banned items and all three banned moves are unchanged.

**A pivot move plus Eject Button behaves differently.** Showdown commit `aa6d5f0856` (2026-09-13,
*"Champions: Allow self-switches even if Eject Button is triggered"*) adds an Eject Button override that
is the mainline handler **minus** the line clearing the attacker's switch flag: both bodies now switch
out. **That fix landed four days AFTER M-C went live on 2026-09-09**, so M-C replays collected in that
window were played under the old rule. Any measurement over the M-C store must either exclude that
window or account for it.

---

## THE TRAP THAT WILL BITE FIRST

**THE STRICT LEGALITY FILTER SILENTLY DELETES A LIVE ABILITY.**

`CLAUDE.md` requires every dex walk to be filtered — `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`
— and that rule is right, and was written because an unfiltered walk once invented five exceptions to a
rule that has none. **In M-C it drops one entity that is real.**

One ability introduced with the new mega formes carries `isNonstandard: "Future"`, which the filter
rejects. But it is **live**: the validator accepts a legal set carrying it, and it has a real handler
body that halves contact damage. Measured on the M-C checkout, as a quoted readout:

```
$ node -e "abilities under gen9championsvgc2026regmc"
  passing the strict filter                316
  flagged Future and dropped by it           1   <- live, validator-accepted, has a handler body
```

So a generator, a census walk or a roster stage built on the strict filter will never see it, will never
stage it, and will report full coverage while doing so — **a capability absent, with everything
reporting success**, which is this project's signature failure mode.

**The rule for M-C:** filter every walk as before, then **re-admit the `Future` entries the validator
accepts**, and print the re-admitted list on every run so it can never be silently empty. `"Future"` is
also what every Champions-exclusive entity carries in mainline data — including ones already modelled
for M-B — so the flag alone means nothing either way. The question is always whether a handler body
exists and whether the validator accepts a set carrying it.

---

## THE THREE DECISIONS WILL TOOK, 2026-09-20

**1. THE REG M-B COLLECTOR IS OFF.** *"we can turn off the reg mb collector we have moved".*
`.github/workflows/ingest.yml` has its schedule commented out; `workflow_dispatch` is kept so a
catch-up pull is one click away, because that store is the frozen authority behind
`data/team-pool-frozen` and every figure ABRA published at 7.0.0. It would have gone quiet anyway:
the M-B format carries `searchShow: false` in the M-C checkout, so it cannot be laddered and its
rolling replay pool has stopped refilling. Reg M-C's collector is a different workflow and is
untouched.

**2. THE SCOPE IS THE SAME AS REG M-B, FOR NOW.** *"yes lets do the same scope as mb for now".*
Open team sheets only; Illusion remains the one declared exclusion; closed sheets and bo1 stay out of
scope. This is a decision to revisit once the format is understood, not a permanent boundary — the
added mechanics may change what is worth modelling.

**3. ONLY THE GAMES THE RULE COULD HAVE TOUCHED COME OUT.** Will: *"sure remove the old eject button
rule game"*, and then, when the first cut was by DATE: *"i mean can we just remove the games that have
an eject button on the team sheet"*.

**The exclusion is a CONJUNCTION, not a date range:** a game leaves the pool only if it was played
before the fix AND an Eject Button is declared on a team sheet. The rule change cannot have altered a
game in which the item never appears, so excluding such a game discards evidence for nothing.

```
$ count bo3 games by (date < 2026-09-14) x (Eject Button on either sheet)    (2026-09-20)
  total                                23808
  played before the fix                 8352   (35.1%)
  Eject Button on a sheet, any date     1516   ( 6.4%)
  BOTH -> excluded                       335   ( 1.4%)
  kept                                 23473
```

**A CUT BY DATE ALONE WOULD HAVE COST 8,352 GAMES TO PROTECT AGAINST 335** (CHANGELOG 7.2.0)**.** The coordinator proposed
the date cut, called it cheap without measuring it, measured it at 35% of the store, and was still
proposing it when Will replaced it with the conjunction. **Twenty-five times more evidence was about to
be thrown away than the change could possibly have affected.**

**AND THE CONJUNCTION IS EXACT, NOT AN APPROXIMATION — WILL'S ARGUMENT, THEN MEASURED.** The obvious
objection is an item acquired mid-battle, which a holder's own sheet would not show. Will: *"we would
know if it acquires one because the opposing team sheet would contain it"* — under open team sheets
every item on the field is declared by one of the two players, so scanning BOTH sheets catches a
transferred item whoever ends up holding it. Measured over the old-rule window (CHANGELOG 7.2.0): **335 games carry the
item on a sheet, 335 name it anywhere in the record, and 0 name it outside a sheet.** There is no
hidden case.

**The cut is applied when the frozen M-C pool is built, and both sheets are scanned.**

---

## WHAT EXISTS TODAY, AND WHAT DOES NOT

**The store is ready and collecting**, hourly since 2026-09-09. These counts are a LIVE DERIVATION over
untracked store files, not a row in a `data/*.json` artifact, so they carry no artifact citation and are
quoted as the readout that produced them rather than claimed:

```
$ zcat data/games.gen9championsvgc2026regmc{,bo3}.jsonl.gz | count openSheet   (2026-09-20 20:50)
  regmc     (bo1 ladder)   32918 games,  1376 open-sheet
  regmcbo3  (open sheets)  23554 games, 23554 open-sheet
```

The in-scope population is open-sheet play, and the bo3 store alone is **already larger than the frozen
M-B pool** that Reg M-B was finished against. Re-derive it rather than quoting this block: the collector
appends every hour, so any number here is stale by construction.

**Nothing is simulated yet.** No M-C engine, no census, no roster, no gate. The checkout exists, the
delta is derived, and that is the whole of it.

**Not started, in the order they unblock each other:** a frozen M-C team pool cut from the store; the
41 new mechanics staged (CHANGELOG 7.1.0); the census extended; the differential run against the M-C authority; the gate's
clauses re-pointed. Each one is an ordinary piece of work — the hard part, knowing what actually changed,
is done and is on this page.
