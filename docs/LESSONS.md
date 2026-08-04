# LESSONS — written once, not re-typed every handoff

These do not change with the corpus, so they do not belong in a status print and they do not belong
in a dated handoff. Each one cost hours. Referenced by name from the division ledgers.

## 1. A silent default looks exactly like a working feature

The lead search never ran in a real game across **four** layers of bug. The post-KO search logged
every turn and never once decided. Both reported success the entire time.

This is the failure mode this project actually has, and it is invisible to every automated check: a
head-to-head, an exploitability search and a prediction score all compare two bots that **share** the
blind spot, so a missing capability cancels out exactly.

**Make every fallback loud.** A default that fires silently is indistinguishable from a feature that
works.

## 2. Search amplifies model error

A maximiser seeks out the lines its model is most optimistic about — which are precisely the lines it
is most wrong about. This is why R4 came back negative on the broken engine and positive on the fixed
one with the same search and the same flags.

**A search is worth exactly what its model is worth.** It follows that improving the leaf beats
improving the depth, every time, until the leaf is calibrated.

## 3. Usage counts are sheet counts

Blaze reads 4,585 uses and is worthless: 30 of 54 entries are a Charizard that megas into Drought on
turn one, so the ability never fires. Ice Scales, Filter, Aerilate, Prism Armor, Punk Rock and Ripen
read zero.

A count of how often something appears on a sheet is not a count of how often it matters.

## 4. Every derivation over-matches on the first try

- `refusesStatusMoves` caught Telepathy and Wonder Guard
- `speedOnItemLoss` caught Sticky Hold
- `failsIfTargetNotAttacking` caught Quick Guard, Wide Guard and Round

**Print what a new tag matched before wiring it.** Every time. The list is always longer than
expected and the extras are always plausible.

## 5. My own probes were wrong about fifteen times, always toward a comfortable answer

Three rules that came out of it:

- **Clear the control explicitly.** The first Choice Scarf probe compared a Scarf against a
  Basculegion that `buildMon` had already given a Scarf, and reported the engine broken.
- **Test the outcome, not the classification.** Whether the code labels something correctly is not
  whether the thing happens.
- **Identical results across a varied knob mean the knob is unwired.** Not that the knob does not
  matter.

## 6. Will's domain knowledge beat the data repeatedly

Blaze/mega. Gardevoir-is-Trace. Contrary-Staraptor. "Meganium needs the mega." "Reality is not a
1/4 split."

**When he says a number looks wrong, check it before defending it.**

## 7. Never read an interim SPRT

66.7% became 44%. 57.7% became 50%. The bound exists exactly so that you do not have to look, and
SPRT is only valid under continuous monitoring because its boundaries were derived for it. Reading a
Wilson interval repeatedly and stopping when it clears zero does not inherit that property — it
badly inflates the false-positive rate.

If you stop a run at a bound, report the SPRT verdict. Not a p-value computed as though n had been
fixed in advance.

## 8. Reuse the canonical path

Hand-rolling a second body builder produced `buildMon("Scizor") -> null`. `dmgMon` already existed
and does it right.

The same instinct is why `provenance.js` derives the artifact graph from source instead of carrying
a list, and why `status.js` shells out to `provenance.js` rather than reimplementing its staleness
rules.

## 9. Measure the noise floor before believing an effect

Split one arm in half and measure the spread between the halves. An effect smaller than that spread
is not an effect, however clean the number looks.

## 10. Check the corpus stamps before attributing an effect to a lever

SLOWKING's equilibrium and its named rock-paper-scissors cycle justified an entire architecture. The
file was computed on the unfiltered store — 87% bots, forfeits and stubs — one day before the quality
filter landed. Nothing on the file said so. Re-run on clean data the cycle disappears entirely.

A JSON file on disk looks equally authoritative whether it was generated this morning or before the
filter that made it wrong.
