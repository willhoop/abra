/* end_state_severity.js — HOW BAD THE END-STATE DIFFERENCE IS, not how many leaves differ.
 *
 * WHY THIS EXISTS. On 2026-08-12 the end-state comparison counted `DIFFERENT-END-STATE` as ONE ROW
 * PER GAME. A game in which we killed a Pokemon the authority says cannot be touched by that move —
 * a healthy body dead on one side, a replacement brought in, every subsequent line a different game —
 * weighed **exactly the same as a three-HP rounding residue**. Will found three such games by reading
 * twenty-five battles by hand; no instrument in this repository could have surfaced them, because the
 * only end-state number was a count.
 *
 * The same day, five defects were verified against Showdown's own source, staged, shown red, fixed,
 * and the whole-game divergence count moved by +1 and +3. All five were narration. A count cannot
 * tell those two kinds of finding apart. A LADDER CAN.
 *
 * ================== THE LADDER, AND THE ONE PLACE IT DEPARTS FROM THE BRIEF ======================
 *
 *   1  DIFFERENT-WINNER                  the battle resolved and the two engines disagree about who won
 *   2  DIFFERENT-BODIES-ALIVE            somebody is dead on one side and standing on the other
 *   3  HP-BEYOND-A-TYPICAL-HIT           a health difference larger than one hit does in this run
 *   4  DIFFERENT-IDENTITY-ON-A-LIVE-BODY the species, the typing or the ability on a body still standing
 *   5  OTHER-STATE-DIFFERENCE            a status, an item, a hazard, a screen, the weather, a volatile
 *   6  SMALL-HP-OR-BOOST-ONLY            an HP residue under one hit, or a stat stage. Plausibly rounding.
 *
 * THE BRIEF PUT `DIFFERENT-BODIES-ALIVE` FIRST AND `DIFFERENT-WINNER` SECOND, AND THAT ORDER MAKES
 * THE SECOND BAND STRUCTURALLY EMPTY. A battle whose winner differs is a battle in which one side has
 * been wiped in one engine and not the other, so it ALWAYS also has a different set of bodies alive.
 * First-match-wins over the brief's order would put every different-winner game in band 1 and leave
 * band 2 permanently at zero — a band that can never fire is not a band. Swapped, and the containment
 * is reported explicitly (`also_different_bodies_alive`) so nothing is hidden by the swap.
 *
 * A FIFTH BAND WAS ADDED FOR THE SAME REASON. The brief's bottom rung is "small HP or boost
 * differences — plausibly rounding", and folding a burn that exists in one engine and not the other,
 * or a layer of Spikes, into "plausibly rounding" would repeat in miniature the exact weighting bug
 * this file exists to fix. Status, item, field, hazard, screen, PP and volatile differences get their
 * own rung ABOVE the rounding one. They are not rounding and they are not identity.
 *
 * ================== WHAT DECIDES BAND 2, AND WHY IT IS NOT READ OFF THE DIFF LIST ================
 *
 * A body's death shows up in the diff list as `party.<species>.fainted` — but so does a body the two
 * engines have given DIFFERENT NAMES, because the party map is keyed by species and a mega evolution
 * or a forme change that fires in one engine and not the other renames the key. Reading band 2 off
 * the diff list would then report "somebody died" for a rename, which is a false alarm at the top of
 * the ladder, the one place a false alarm is most expensive.
 *
 * So band 2 is decided over the SPECIES PRESENT IN BOTH PARTIES: a body both engines agree exists,
 * alive in one and not in the other. A species present in only one engine's party is a different
 * claim — an identity claim — and it goes to band 4 with its own evidence line.
 *
 * ================== THE BAND 3 THRESHOLD IS MEASURED, NOT PICKED =================================
 *
 * `typicalHit()` takes every single-hit `-damage` event the AUTHORITY narrated across the run,
 * expressed as a fraction of the body's own maximum HP, and returns the MEDIAN. Showdown emits every
 * HP change twice — a `|split|pX` line, then the exact figure, then the same event as a percentage —
 * so the exact line is the one after the split and the percentage line after it is skipped. Counting
 * both would halve every figure and would look like a working measurement.
 *
 * IT IS THE AUTHORITY'S OWN NARRATION AND NOT OURS, deliberately: the threshold must not move when
 * medicham2's damage moves, or the ruler would be made of the thing being measured.
 *
 * AND A WARNING THAT TRAVELS WITH THE BAND. "More than a typical hit" does NOT catch a missing damage
 * MULTIPLIER. A missing x1.33 on a hit worth 40% of a health bar is a 10-point difference — about a
 * quarter of a hit — so it lands in band 6 unless it flips a knockout, in which case it is band 2.
 * The Fairy Aura case the brief cites is therefore a band 2 finding or an invisible one, never a band
 * 3 one. `hp_gap_in_typical_hits` is published for exactly this reason: the histogram shows where the
 * quarter-hit mass sits instead of burying it under the word "rounding".
 */
'use strict';

const BANDS = [
  { rank: 1, id: 'DIFFERENT-WINNER',
    what: 'the battle RESOLVED in both engines and they disagree about who won' },
  { rank: 2, id: 'DIFFERENT-BODIES-ALIVE',
    what: 'a body both engines carry is dead in one and standing in the other' },
  { rank: 3, id: 'HP-BEYOND-A-TYPICAL-HIT',
    what: 'a health difference larger than one hit does in this run' },
  { rank: 4, id: 'DIFFERENT-IDENTITY-ON-A-LIVE-BODY',
    what: 'the species, the typing or the ability of a body still standing' },
  { rank: 5, id: 'OTHER-STATE-DIFFERENCE',
    what: 'a status, an item, a hazard, a screen, the weather, PP or a volatile' },
  { rank: 6, id: 'SMALL-HP-OR-BOOST-ONLY',
    what: 'an HP residue under one hit, or a stat stage — plausibly rounding' },
];
const BAND_BY_ID = new Map(BANDS.map(b => [b.id, b]));
const SIDES = ['p1', 'p2'];

/* ---- THE COMPACT END BOARD ---------------------------------------------------------------------
 * One BS snapshot in, the minimum a band decision needs out. Kept small on purpose: the driver holds
 * one of these per game per arm for the whole run, and the alternative — keeping the snapshot — is
 * two full board projections per game.
 *
 * THE PARTY IS KEPT WHOLE AND NOT REDUCED TO A COUNT. "Three alive against three alive" hides a swap,
 * and a band that cannot name the body is a band nobody can open and read. */
function endBoard(snap) {
  const side = (S, s) => {
    const out = {};
    for (const [sp, r] of Object.entries(S.sides[s].party || {}))
      out[sp] = { hp: r.hp, maxhp: r.maxhp, fainted: !!r.fainted };
    return out;
  };
  return {
    parties: {
      medi: { p1: side(snap.medi, 'p1'), p2: side(snap.medi, 'p2') },
      sd: { p1: side(snap.sd, 'p1'), p2: side(snap.sd, 'p2') },
    },
  };
}

/* ALIVE MEANS `fainted` IS FALSE, AND `hp > 0` IS ASKED TOO. The two agree in every engine state this
 * comparator has seen; asking both means a body at 0 HP whose faint flag has not been written yet
 * cannot be counted as standing, which would be the flattering direction. */
const aliveSet = (party) => new Set(Object.entries(party || {})
  .filter(([, r]) => !r.fainted && r.hp > 0).map(([sp]) => sp));

/* WHO WON, DERIVED THE SAME WAY FOR BOTH ENGINES FROM THE SAME PROJECTION. Neither engine is asked
 * for its own answer: medicham2's `battleOver` is also true at its turn cap and Showdown's `winner`
 * is a field the frozen release has no counterpart for, so two different questions would be compared.
 * FACTS ARE GLOBAL (CLAUDE.md) — "has this side run out of Pokemon" is one rule, applied twice.
 *
 * `null` means UNRESOLVED and is never a third contestant: at a 12-turn cap almost no battle finishes,
 * and a run in which nothing resolved must report an EMPTY band 1 rather than a green one. */
function winnerOf(parties) {
  const a = aliveSet(parties.p1).size, b = aliveSet(parties.p2).size;
  if (a > 0 && b > 0) return null;
  if (a === 0 && b === 0) return 'draw';
  return a === 0 ? 'p2' : 'p1';
}

/* Which of the located diffs is an HP leaf, and how big is it against the body's own health bar.
 * `p1.active[0].hp` and `p1.party.<that species>.hp` are the SAME body seen twice — deduplicated on
 * (side, species), or one difference would be counted as two pieces of evidence. */
function hpGaps(diffs, parties) {
  const seen = new Set(), out = [];
  for (const d of diffs) {
    const f = String(d.field || '');
    if (f !== 'hp' && f !== 'party.hp') continue;
    if (typeof d.us !== 'number' || typeof d.sd !== 'number') continue;
    const key = d.side + '/' + d.body;
    if (seen.has(key)) continue;
    seen.add(key);
    const rec = (parties.sd[d.side] || {})[d.body] || (parties.medi[d.side] || {})[d.body] || null;
    const maxhp = d.maxhp || (rec && rec.maxhp) || 0;
    const gap = Math.abs(d.us - d.sd);
    out.push({ side: d.side, body: d.body, us: d.us, sd: d.sd, gap,
               maxhp: maxhp || null, frac: maxhp ? gap / maxhp : null });
  }
  return out;
}

const IDENTITY_FIELDS = new Set(['species', 'types', 'ability']);
const ROUNDING_FIELDS = (f) => f === 'hp' || f === 'party.hp' || f.indexOf('boosts.') === 0;

/* ---- THE BAND ----------------------------------------------------------------------------------
 * One end board in, one rung out, plus the evidence that put it there. PURE — every branch can be
 * exercised on a fabricated board by tests/test-end-state-severity.js, including the two a real run
 * may never happen to produce, which is exactly where a classifier rots (the same argument
 * `endStateVerdict` is written under).
 *
 * `opts.hpThresholdFrac` is the fraction of a health bar that counts as "a typical hit". It is a
 * REQUIRED argument and there is no default: a hard-coded number here would be exactly the picked
 * threshold this ladder was told not to have, and it would be invisible at the call site. */
function severity(rec, opts) {
  const o = opts || {};
  if (typeof o.hpThresholdFrac !== 'number' || !(o.hpThresholdFrac > 0))
    throw new Error('severity(): hpThresholdFrac must be a measured positive fraction — see typicalHit()');
  const diffs = (rec && rec.diffs) || [];
  const parties = (rec && rec.parties) || null;
  const ev = [];
  const band = (id, why) => ({ band: BAND_BY_ID.get(id).rank, band_id: id, why,
                               evidence: ev.slice(0, 8), evidence_total: ev.length,
                               bodies: [...new Set(ev.map(e => e.body).filter(Boolean))] });

  if (!parties) return band('OTHER-STATE-DIFFERENCE', 'NO PARTY PROJECTION — the board could not be read; '
    + 'banded at the middle rung rather than at either end, and said out loud');

  /* --- the alive sets, over the bodies BOTH engines carry ------------------------------------- */
  let bodiesAliveDiffer = false;
  const identityEv = [];
  for (const s of SIDES) {
    const M = parties.medi[s] || {}, S = parties.sd[s] || {};
    for (const sp of Object.keys(M)) {
      if (!(sp in S)) { identityEv.push({ side: s, body: sp, what: 'is on our team and not on the authority\'s' }); continue; }
      const am = !M[sp].fainted && M[sp].hp > 0, as = !S[sp].fainted && S[sp].hp > 0;
      if (am !== as) {
        bodiesAliveDiffer = true;
        ev.push({ side: s, body: sp, what: am ? 'is ALIVE for us and DEAD for the authority'
                                             : 'is DEAD for us and ALIVE for the authority',
                  us: M[sp].hp + '/' + M[sp].maxhp, sd: S[sp].hp + '/' + S[sp].maxhp });
      }
    }
    for (const sp of Object.keys(S)) if (!(sp in M))
      identityEv.push({ side: s, body: sp, what: 'is on the authority\'s team and not on ours' });
  }

  /* --- BAND 1 — a different winner ------------------------------------------------------------ */
  const wM = winnerOf(parties.medi), wS = winnerOf(parties.sd);
  if (wM && wS && wM !== wS) {
    ev.unshift({ side: '', body: '', what: 'the battle resolved differently', us: 'winner ' + wM, sd: 'winner ' + wS });
    const b = band('DIFFERENT-WINNER', 'we say ' + wM + ' won and the authority says ' + wS);
    b.also_different_bodies_alive = bodiesAliveDiffer;
    b.winner = { medi: wM, sd: wS };
    return b;
  }
  /* ONE ENGINE RESOLVED AND THE OTHER DID NOT is NOT a different winner and is NOT folded into one.
   * It is the board-level twin of ENDED-APART and belongs at the top of band 2, where the fact that
   * somebody is dead on one side and not the other is what actually produced it. */
  if (bodiesAliveDiffer) {
    const b = band('DIFFERENT-BODIES-ALIVE', ev.length + ' body/bodies alive in one engine and not the other');
    b.winner = { medi: wM, sd: wS };
    b.one_engine_resolved_alone = !!(wM || wS) && !(wM && wS);
    return b;
  }

  /* --- BAND 3 — a health difference bigger than a hit ------------------------------------------ */
  const gaps = hpGaps(diffs, parties);
  const big = gaps.filter(g => g.frac != null && g.frac > o.hpThresholdFrac);
  if (big.length) {
    for (const g of big.sort((a, b2) => b2.frac - a.frac))
      ev.push({ side: g.side, body: g.body, what: 'health differs by ' + g.gap + ' of ' + g.maxhp
                + ' (' + (100 * g.frac).toFixed(0) + '% of its bar, ' + (g.frac / o.hpThresholdFrac).toFixed(2)
                + ' typical hits)', us: g.us, sd: g.sd });
    return band('HP-BEYOND-A-TYPICAL-HIT', 'the largest health gap is '
      + (big[0] ? (100 * Math.max(...big.map(x => x.frac))).toFixed(0) : '?') + '% of a health bar');
  }

  /* --- BAND 4 — identity on a body that is still standing -------------------------------------- */
  for (const d of diffs) {
    const f = String(d.field || '');
    if (!IDENTITY_FIELDS.has(f)) continue;
    /* "ON A LIVE BODY" IS ASKED OF THE PARTY, NOT ASSUMED FROM THE SLOT. A body can occupy an active
     * slot after fainting and before its replacement is chosen, and a typing difference on a corpse
     * is not the Soak class. Unknown to the party projection counts as live, LOUDLY — the flag rides
     * on the evidence row rather than silently choosing the quieter answer. */
    const inP = (parties.sd[d.side] || {})[d.body] || (parties.medi[d.side] || {})[d.body] || null;
    const live = !inP || (!inP.fainted && inP.hp > 0);
    if (!live) continue;
    identityEv.push({ side: d.side, body: d.body, what: 'differs in ' + f, us: d.us, sd: d.sd,
                      body_known_to_the_party: !!inP });
  }
  if (identityEv.length) {
    for (const e of identityEv) ev.push(e);
    return band('DIFFERENT-IDENTITY-ON-A-LIVE-BODY', identityEv.length
      + ' identity difference(s) on a body still standing');
  }

  /* --- BANDS 5 and 6 — everything that is left ------------------------------------------------- */
  const other = diffs.filter(d => !ROUNDING_FIELDS(String(d.field || '')));
  if (other.length) {
    for (const d of other.slice(0, 8))
      ev.push({ side: d.side, body: d.body, what: 'differs in ' + d.field, us: d.us, sd: d.sd });
    return band('OTHER-STATE-DIFFERENCE', other.length + ' non-HP, non-boost leaf/leaves differ');
  }
  for (const g of gaps) ev.push({ side: g.side, body: g.body, us: g.us, sd: g.sd,
    what: 'health differs by ' + g.gap + (g.maxhp ? ' of ' + g.maxhp : '')
        + (g.frac != null ? ' (' + (g.frac / o.hpThresholdFrac).toFixed(2) + ' typical hits)' : '') });
  for (const d of diffs) if (String(d.field || '').indexOf('boosts.') === 0)
    ev.push({ side: d.side, body: d.body, what: 'differs in ' + d.field, us: d.us, sd: d.sd });
  const b = band('SMALL-HP-OR-BOOST-ONLY', diffs.length + ' leaf/leaves differ, all HP under a hit or a stat stage');
  b.largest_hp_gap_in_typical_hits = gaps.length && gaps.some(g => g.frac != null)
    ? +Math.max(...gaps.filter(g => g.frac != null).map(g => g.frac / o.hpThresholdFrac)).toFixed(3) : null;
  return b;
}

/* ---- THE RULER --------------------------------------------------------------------------------
 * Every single-hit damage event the AUTHORITY narrated, as a fraction of the struck body's own
 * maximum HP. See the header for why the `|split|` duplicate is skipped and why the authority's log
 * rather than ours is the source.
 *
 * `hpOf` parses `123/175`, `123/175 brn` and `0 fnt`. A percentage line (`68/100`) is skipped by the
 * split rule and never by looking at the denominator — Pokemon in this format really can have 100
 * maximum HP, and a denominator test would silently drop those bodies' hits from the ruler. */
/* ---- `0 fnt` HAS NO DENOMINATOR, AND DROPPING IT BIASED THE RULER DOWNWARD ---------------------
 * Showdown writes a surviving body as `120/175` and a fainted one as `0 fnt` — no maximum at all. The
 * first version of this function required `\d+/\d+`, so EVERY KILLING BLOW fell out of the sample.
 * MEASURED on one 12-turn game: 20 damage events, 7 residual, 13 direct, and only 8 reached the ruler.
 * The five that vanished were the knockouts, which is precisely the top of the distribution — so the
 * median hit was being computed over hits that were not big enough to kill anybody.
 *
 * The maximum is carried per slot from the last line that stated one (a switch always does), so a
 * `0 fnt` resolves against the body's own health bar. `null` when no maximum has been seen for that
 * slot yet, which is COUNTED rather than defaulted. */
function hpOf(field, knownMax) {
  const t = String(field || '').trim();
  const m = /^(\d+)\s*\/\s*(\d+)/.exec(t);
  if (m) return { hp: +m[1], maxhp: +m[2] };
  if (/^0\b/.test(t) && knownMax > 0) return { hp: 0, maxhp: knownMax };
  return null;
}
function collectHits(log, into, fails) {
  const cur = new Map();                      // slot label -> hp
  const max = new Map();                      // slot label -> the last stated maximum
  for (let i = 0; i < log.length; i++) {
    const line = String(log[i]);
    if (!line.startsWith('|')) continue;
    let use = line;
    /* `|split|pX` is followed by the exact-figure line and then the same event as a percentage. Take
     * the first, step over the second. A run in which no split is ever seen is a receipt, not a
     * silent zero: the counter below says so. */
    if (line.startsWith('|split|')) {
      if (i + 2 >= log.length) { if (fails) fails.split_ran_off_the_end = (fails.split_ran_off_the_end || 0) + 1; continue; }
      use = String(log[i + 1]); i += 2;
      if (fails) fails.splits_seen = (fails.splits_seen || 0) + 1;
    }
    const p = use.split('|');
    const ev = p[1], who = p[2], val = p[3];
    if (!who) continue;
    const slot = String(who).split(':')[0];
    if (ev === 'switch' || ev === 'drag' || ev === 'replace') {
      const h = hpOf(p[4], max.get(slot)); if (h) { cur.set(slot, h.hp); max.set(slot, h.maxhp); }
      continue;
    }
    if (ev === '-damage') {
      const h = hpOf(val, max.get(slot));
      if (!h) { if (fails) fails.damage_line_unparsed = (fails.damage_line_unparsed || 0) + 1; continue; }
      max.set(slot, h.maxhp);
      const prev = cur.has(slot) ? cur.get(slot) : h.maxhp;
      const d = prev - h.hp;
      cur.set(slot, h.hp);
      if (!(d > 0 && h.maxhp > 0)) continue;
      /* ---- RESIDUALS ARE NOT HITS, AND LEAVING THEM IN HALVED THE RULER ------------------------
       * MEASURED 2026-08-12 on a 51-game arm: with sandstorm chip, burn, poison, Leech Seed, hazards
       * and Life Orb recoil counted as hits the median came out at 12.7% of a health bar with
       * quartiles 6.2% and 34.2% — a bimodal mixture whose median sits in the empty middle and
       * describes neither population. A threshold made from that is "more than a typical RESIDUAL",
       * and it would have promoted ordinary chip differences into the health-gap band.
       *
       * SHOWDOWN'S OWN LINE SAYS WHICH IS WHICH. Damage from a move that just resolved carries no
       * attribution; every indirect source is tagged `[from] …` — `[from] Sandstorm`, `[from] psn`,
       * `[from] item: Life Orb`, `[from] Leech Seed`, `[from] Stealth Rock`. So the filter is read off
       * the authority's protocol rather than guessed at from a size cutoff, which would be circular:
       * a size rule that discards small damage cannot then be used to decide what "small" means.
       *
       * COUNTED, NOT DISCARDED SILENTLY. `residual_damage_events` rides on the ruler so a reader can
       * see how much was excluded and a run where the filter matched everything is visible. */
      if (p.some(x => String(x).startsWith('[from]'))) {
        if (fails) fails.residual_damage_events = (fails.residual_damage_events || 0) + 1;
        continue;
      }
      into.push(d / h.maxhp);
      continue;
    }
    if (ev === '-heal' || ev === '-sethp') {
      const h = hpOf(val, max.get(slot)); if (h) { cur.set(slot, h.hp); max.set(slot, h.maxhp); }
    }
  }
}
const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return +(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)).toFixed(6);
};
function typicalHit(fracs, fails) {
  const s = fracs.slice().sort((a, b) => a - b);
  return {
    what: 'THE BAND 3 THRESHOLD, MEASURED FROM THIS RUN. Every DIRECT -damage event the AUTHORITY '
        + 'narrated — a hit from a move that just resolved, identified as a -damage line carrying no '
        + '[from] attribution — as a fraction of the struck body\'s own maximum HP. The median is the '
        + 'threshold. Residual chip (weather, status, Leech Seed, hazards, Life Orb) is EXCLUDED and '
        + 'counted; leaving it in put the median at 12.7% with quartiles 6.2/34.2, which is the middle '
        + 'of a bimodal mixture and describes neither half. Showdown emits each HP change twice '
        + '(|split|, exact, then the same event as a percentage); the exact line is taken and the '
        + 'percentage line stepped over.',
    source: 'the official simulator\'s own battle log, never medicham2\'s',
    hits: s.length,
    median_fraction_of_max_hp: quantile(s, 0.5),
    p25: quantile(s, 0.25), p75: quantile(s, 0.75), p90: quantile(s, 0.9),
    reader_failures: fails || null,
  };
}

module.exports = { BANDS, BAND_BY_ID, endBoard, severity, winnerOf, aliveSet, hpGaps,
                   collectHits, typicalHit, quantile, hpOf };
