/* set_priors.js — fill the ~2.6 of 4 move slots a replay never revealed, plus item and ability.
 *
 * WHY THIS EXISTS
 * ---------------
 * A Champions replay reveals a mean of 1.38 of four moves per set; 69.7% of sets show no item and
 * 75.5% no ability (measured over 72,367 sets, 2026-07-25). Any simulator handed those sets must
 * invent the rest, and ADR-001 records that WHAT FILLS THE GAP DOMINATES THE RESULT — an early
 * engine comparison filled alphabetically from the learnset, gave Charizard "Acrobatics, Aerial Ace,
 * Air Cutter, Air Slash", and produced a 32-point difference that was almost entirely filler.
 *
 * That failure recurred on 2026-07-25. `packTeam` in champions_sim.js read its fallback from
 * `globalThis.MC`, which only exists when the browser bundle is loaded. Under Node it is undefined,
 * so the fallback was empty and unrevealed slots fell through to a literal ['Tackle']. The first MEW
 * run produced self-play games whose most common move was Tackle, by 4x, over Protect. The data was
 * worthless and nothing failed.
 *
 * WHAT THIS USES INSTEAD
 * ----------------------
 * MOVES: data/move-priors.json — the behaviour-clone, P(move | species) measured from real ladder
 * play (e.g. garchomp over 4,476 observed actions: rockslide .228, earthquake .218, dragonclaw .178).
 * This is a measured distribution, not a guess, and it is the same object the rollout policy uses.
 *
 * ITEM and ABILITY: measured from the CLEAN store, taking the most frequently revealed value per
 * species. Reading the raw store would let a bot that ran one set hundreds of times define the
 * "typical" item for its species.
 *
 * SAMPLED, NOT TOP-K. Slots are drawn from the distribution rather than taking the four most common
 * moves. Two reasons. It is the honest representation of the uncertainty — we do not know the set,
 * and a modal set asserts one we never observed. And it supplies variety across games, which Leela
 * Chess Zero pursues deliberately (policy temperature ~2.25) because a generator that always plays
 * the same line explores a narrow band of states. Draws are seeded, so a run reproduces exactly.
 *
 * WHAT THIS STILL CANNOT DO. It cannot recover the real set. Self-play games are between PLAUSIBLE
 * RECONSTRUCTIONS of observed teams. Any result that turns on exact sets must say so.
 *
 * KNOWN LIMITATION, MEASURED — low-marginal moves are over-represented on generated sets.
 * Incineroar's priors list eight candidate moves and every set needs four, so even a move with a
 * 0.9% marginal (Close Combat) lands on ~45% of generated sets once the common moves are taken. The
 * top of the ranking is right — Fake Out 82%, Flare Blitz 72%, Parting Shot 67%, matching the
 * marginal order — but the tail is inflated by the four-slot constraint, not by the sampler.
 *
 * Two things cause it and neither is fixed here. P(move | action), which is what move-priors.json
 * measures, is not P(move on set) — a move clicked rarely may still be on many sets, or vice versa.
 * And the candidate pool is only the moves actually OBSERVED, so it is far smaller than the real
 * learnset and offers nothing else to draw. The principled fix is to fit P(set) over a
 * learnset-sized pool with a floor for unobserved moves. Until then, treat generated sets as
 * "typical for the species, with a tech slot more often than reality".
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let _moves = null;      // species -> [{mv, p}]
let _gear = null;       // species -> {item, ability}

/* ---- COSMETIC FORMES RESOLVE TO THEIR BASE ----------------------------------------------------
 *
 * Our store records the forme a replay named — sinistchamasterpiece, mausholdfour,
 * vivillonmonsoon, vivillonelegant and eight more Vivillon patterns. Smogon collapses all of them
 * into one entry (sinistcha 860,069 · maushold 194,126 · vivillon 35,448), and so does most of our
 * own prior data, because the split names are rare individually.
 *
 * The consequence was silent and total: `vivillonmonsoon` matched no prior anywhere, so fillSet
 * returned an EMPTY MOVESET. Around 2,100 team slots in the store carry a cosmetic forme name.
 *
 * The suffixes below are cosmetic in this format — the same Pokemon wearing a different coat, with
 * the same stats and the same learnset. Collapsing them is correct, not an approximation. The guard
 * is what keeps it safe: only fall back when the exact name has NO data and the base does, so a
 * genuinely distinct forme (Rotom-Wash, Slowbro-Galar, Ninetales-Alola) is never folded into
 * something it does not play like. */
const COSMETIC_SUFFIX = [
  'masterpiece', 'unremarkable',                     // Sinistcha / Poltchageist
  'four', 'three',                                   // Maushold family size
  'monsoon', 'elegant', 'sandstorm', 'continental', 'jungle', 'polar', 'modern', 'savanna',
  'garden', 'marine', 'archipelago', 'highplains', 'icysnow', 'meadow', 'ocean', 'river',
  'sun', 'tundra', 'fancy', 'pokeball',              // Vivillon patterns
  'red', 'orange', 'yellow', 'blue', 'white',        // Florges / Flabebe flowers
];
function cosmeticBase(sp) {
  const n = norm(sp);
  for (const suf of COSMETIC_SUFFIX) {
    if (n.length > suf.length && n.endsWith(suf)) return n.slice(0, -suf.length);
  }
  return null;
}
/* Resolve a species name against a lookup table, falling back to its cosmetic base.
 *
 * THE SUFFIX LIST IS A BACKSTOP, NOT THE MECHANISM — because a hand-kept list of formes is exactly
 * the hand maintenance S13 forbids, and it fails SILENTLY. A name matching nothing yields an EMPTY
 * moveset rather than an error, so the Pokemon plays Struggle and nobody notices. It has now happened
 * three times: Vivillon patterns, Floette-Eternal, and Tatsugiri-Droopy — the last found by
 * engine/selftest.js after the previous two had supposedly closed the class.
 *
 * So try the general rule first: a forme name is the base plus a hyphenated qualifier, and the raw
 * names arrive hyphenated ("Tatsugiri-Droopy"). Strip trailing segments one at a time and take the
 * first that resolves. That handles every present and FUTURE cosmetic forme without an edit, which
 * is the point. The explicit list stays only for names that arrive already normalised, where the
 * hyphens are gone and there is nothing to strip. */
function resolveSpecies(sp, table) {
  const n = norm(sp);
  if (table[n]) return n;
  const parts = String(sp || '').split('-');
  for (let k = parts.length - 1; k > 0; k--) {
    const cand = norm(parts.slice(0, k).join('-'));
    if (cand && table[cand]) return cand;
  }
  const base = cosmeticBase(n);
  return (base && table[base]) ? base : n;
}

function movePriors() {
  if (_moves) return _moves;
  _moves = {};
  try {
    const j = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'));
    for (const [sp, v] of Object.entries(j.species || {})) {
      const rows = (v.moves || []).filter(m => m && m.mv && m.p > 0);
      if (rows.length) _moves[norm(sp)] = rows.map(m => ({ mv: m.mv, p: m.p }));
    }
  } catch (e) { /* leave empty; callers must handle a miss rather than invent */ }
  return _moves;
}

/* Item and ability, measured from the CLEAN store. Cached in memory; the pass is ~1s on 1k games. */
function gearPriors() {
  if (_gear) return _gear;
  _gear = {};
  const item = {}, abil = {};
  /* WHICH GAMES COUNT FOR AN ITEM, AND WHY IT IS NOT THE SAME ANSWER AS FOR BEHAVIOUR.
   *
   * This read only quality-filtered games, which left FIFTEEN observations deciding Charizard's
   * item and ten deciding Staraptor's. At that size the estimate is barely better than a guess,
   * and Tyranitar's stone rate moves from 47% to 27% depending on which pile you use.
   *
   * The filter exists to stop bot games contaminating claims about how people PLAY. An item is not
   * a play decision though -- it is a team-building fact, and bot teams are overwhelmingly copied
   * human teams, so excluding them throws away most of the evidence for no gain.
   *
   * But the raw store cannot be used either: a bot grinding 200 games on one team would contribute
   * 200 identical observations and swamp everyone else -- precisely the team-invariance the filter
   * detects.
   *
   * So: use the WHOLE store, and count each distinct (player, species, item, ability) ONCE. A bot
   * playing the same Tyranitar two hundred times counts as one Tyranitar, exactly like a human who
   * played it once. That keeps the sample size without letting repetition vote. */
  const seenCombo = new Set();
  try {
    const Q = require('./quality.js');
    for (const g of Q.loadGames({ clean: false })) {
      const owner = { p1: norm(((g.p1 || {}).name) || 'p1'), p2: norm(((g.p2 || {}).name) || 'p2') };
      const voteKey = (sp, s, side) =>
        owner[side] + '|' + sp + '|' + norm((s && s.item) || '') + '|' + norm((s && s.ability) || '');
      const owners = (sp) => ['p1', 'p2'].filter(side =>
        (((g.brought || {})[side]) || []).map(norm).includes(sp));
      for (const [sp0, s] of Object.entries(g.sets || {})) {
        const sp = norm(sp0);
        /* CANONICALISE THE ITEM NAME BEFORE COUNTING. The store carries the same item under two
         * spellings depending on which protocol line revealed it — "CharizarditeY" from one path
         * and "Charizardite Y" from another. Counted separately they split one item's rate across
         * two entries, understating how often it is actually held (Charizard's stone read 67% + 13%
         * instead of 80%) and letting a rarely-seen spelling win a sample. Key on the normalised
         * form, keep the most common spelling for display. */
        /* One vote per (player, species, item, ability). A player who ran this exact set before has
         * already voted; repetition does not get to count again. Sets belonging to nobody we can
         * identify (species not in either bring list) are skipped rather than attributed. */
        const sides = owners(sp);
        if (!sides.length) continue;
        let voted = false;
        for (const side of sides) {
          const key = voteKey(sp, s, side);
          if (seenCombo.has(key)) continue;
          seenCombo.add(key);
          voted = true;
        }
        if (!voted) continue;

        if (s && s.item) {
          const key = norm(s.item);
          const bucket = (item[sp] = item[sp] || {});
          const rec = (bucket[key] = bucket[key] || { n: 0, names: {} });
          rec.n++;
          rec.names[s.item] = (rec.names[s.item] || 0) + 1;
        }
        if (s && s.ability) { (abil[sp] = abil[sp] || {})[s.ability] = (abil[sp][s.ability] || 0) + 1; }
      }
    }
  } catch (e) { return _gear; }
  /* KEEP THE WHOLE DISTRIBUTION, NOT THE MODE.
   *
   * This returned only the single most common item per species, so every generated Tyranitar held
   * a Tyranitarite and every Charizard held the same stone. Both are wrong, and wrong in opposite
   * directions: almost every Charizard really does carry its stone, while a third of Tyranitars run
   * a berry or a Sash instead and never mega at all — the stone is a choice, not a species trait.
   * Collapsing to the mode erases exactly that choice.
   *
   * Counts are kept so fillSet can SAMPLE proportionally, which reproduces the real split: near-
   * universal stones on the species that always mega, a genuine mix on the ones that sometimes do.
   * `item` stays as the mode for callers that want one value. */
  const top = o => o ? Object.entries(o).sort((a, b) => b[1] - a[1])[0][0] : null;
  /* Collapse the canonical buckets back to {displayName: count}, picking the spelling that was
   * actually seen most often for each item. */
  const flatten = (buckets) => {
    if (!buckets) return null;
    const out = {};
    for (const rec of Object.values(buckets)) {
      const name = Object.entries(rec.names).sort((a, b) => b[1] - a[1])[0][0];
      out[name] = (out[name] || 0) + rec.n;
    }
    return out;
  };
  for (const sp of new Set([...Object.keys(item), ...Object.keys(abil)])) {
    const idist = flatten(item[sp]);
    _gear[sp] = {
      item: top(idist),
      ability: top(abil[sp]),
      itemDist: idist,                     // {displayName: count}, spellings merged
      abilityDist: abil[sp] || null,
    };
  }
  return _gear;
}

/* Draw from a {value: count} table proportionally, with a seeded PRNG so a seeded MEW run stays
 * reproducible. Returns null on an empty table so callers can fall through to their next source. */
function sampleDist(dist, r) {
  if (!dist) return null;
  const entries = Object.entries(dist);
  if (!entries.length) return null;
  let total = 0;
  for (const [, c] of entries) total += c;
  if (total <= 0) return null;
  let x = r() * total;
  for (const [v, c] of entries) { x -= c; if (x <= 0) return v; }
  return entries[entries.length - 1][0];
}

/* Deterministic PRNG so a seeded MEW run reproduces exactly. */
/* Seeded PRNG. THE SEED MUST BE AVALANCHED BEFORE USE, and skipping that silently destroyed every
 * single-draw sample in this file.
 *
 * Raw xorshift32 barely mixes on its first output — it is almost linear in the seed:
 *
 *     seed  3 -> 0.000189      seed  9 -> 0.000567
 *     seed  5 -> 0.000315      seed 11 -> 0.000692
 *     seed  7 -> 0.000441      seed 13 -> 0.000818
 *
 * Every value sits near zero, so any ONE-DRAW decision always landed on the first entry of its
 * distribution: the modal item, the modal spread. Across 199,524 self-play games every Incineroar
 * held a Sitrus Berry with the same Careful spread, and the "sampled, not top-k" design this file
 * argues for at length produced modal sets anyway. Moves escaped only because they draw four times
 * and the later draws decorrelate.
 *
 * A splitmix32 finalizer on the seed fixes it: one multiply-xor-shift round before the stream starts,
 * so the first output is already well distributed. */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  /* splitmix32 avalanche — cheap, and enough to decorrelate adjacent seeds */
  s = (s + 0x9E3779B9) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x21f0aaad) >>> 0;
  s = Math.imul(s ^ (s >>> 15), 0x735a2d97) >>> 0;
  s = (s ^ (s >>> 15)) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* COMPLETE OBSERVED SETS, from the corpora where all four moves are public.
 *
 * WHY THIS EXISTS. Everything below models a set as four draws with a correction applied. No
 * correction is needed when the whole set was published: an open team sheet IS the joint distribution,
 * observed directly. `data/games.bo3.jsonl` (our own scrape; the Bo3 ruleset carries Force Open Team
 * Sheets) and `data/games.ots.jsonl` (external archive) together hold roughly 38,000 complete
 * four-move sets. Until 2026-07-27 the sampler used none of them.
 *
 * Measured effect of not using them, engine/stab_audit.js: generated sets carried two-or-more
 * same-type attacking moves 9.9 points more often than human sets on bo3 [8.8, 11.0] and 9.4 points
 * more on ots [8.6, 10.2] — two independent corpora agreeing, across 40 of 58 species with enough
 * observations to judge. Sneasler was generated holding both Dire Claw and Gunk Shot; both are normal
 * Sneasler moves and they compete for one slot, which is precisely what marginals cannot represent.
 *
 * The store is keyed on normalised species. Only sets with four distinct moves are kept: a partial
 * sheet is the revelation bias this exists to avoid. */
let _observed = null;
function observedSets() {
  if (_observed) return _observed;
  _observed = {};
  const path = require('path');
  const fs = require('fs');
  try {
    const Q = require('./quality.js');
    for (const f of ['games.bo3.jsonl', 'games.ots.jsonl']) {
      const p = path.join(__dirname, '..', 'data', f);
      if (!fs.existsSync(p)) continue;
      for (const g of Q.loadGames({ path: p })) {
        for (const side of ['p1', 'p2']) {
          for (const st of (g.sheets && g.sheets[side]) || []) {
            if (!st || !st.species || !Array.isArray(st.moves)) continue;
            const mv = [...new Set(st.moves.map(norm))].filter(Boolean);
            if (mv.length !== 4) continue;
            const sp = norm(st.species);
            (_observed[sp] = _observed[sp] || []).push(mv);
          }
        }
      }
    }
  } catch (err) { /* no store: every caller below falls back to the marginal paths */ }
  return _observed;
}

/* Draw a whole observed set consistent with what is already revealed.
 *
 * Returns null rather than guessing when the species has too few observations to draw from — 8 is the
 * floor at which a draw is sampling rather than memorising one player's team. A null sends the caller
 * back to the co-occurrence-corrected marginals, which is the right order of preference: observed
 * joint, then corrected marginals, then raw marginals. */
function observedDraw(species, have, seed) {
  const OB = observedSets();
  const sp = resolveSpecies(norm(species), OB);
  const pool = OB[sp];
  if (!pool || pool.length < 8) return null;
  const want = have.map(norm).filter(Boolean);

  /* Sets that contain everything already revealed. That is the conditional distribution, exactly. */
  let cand = pool.filter(s => want.every(w => s.includes(w)));
  /* NEAREST NEIGHBOUR, not silence. If no observed set contains all of them — a genuinely unusual
   * build, or a sheet we mis-parsed — take the sets that overlap most. Returning null here instead
   * would send exactly the rarest cases back to the sampler that gets them wrong. */
  if (!cand.length) {
    let best = -1;
    for (const s of pool) {
      const ov = want.reduce((a, w) => a + (s.includes(w) ? 1 : 0), 0);
      if (ov > best) best = ov;
    }
    cand = pool.filter(s => want.reduce((a, w) => a + (s.includes(w) ? 1 : 0), 0) === best);
  }
  if (!cand.length) return null;
  const r = rng((seed || 1) + sp.length * 104729);
  const chosen = cand[Math.min(cand.length - 1, Math.floor(r() * cand.length))];
  /* Keep the revealed moves and fill the rest from the drawn set, so a known move is never displaced. */
  const out = want.slice();
  for (const m of chosen) if (out.length < 4 && !out.includes(m)) out.push(m);
  return out.length === 4 ? out.slice(want.length) : null;
}

/* Pairwise co-occurrence, measured from revealed sets in the CLEAN store.
 * co[sp][a][b] = times a and b were revealed on the same set. solo[sp][a] = times a was revealed. */
let _co = null;
function coocc() {
  if (_co) return _co;
  _co = {};
  try {
    const Q = require('./quality.js');
    for (const g of Q.loadGames()) {
      for (const [sp0, s] of Object.entries(g.sets || {})) {
        const sp = norm(sp0);
        const mv = [...new Set((s.moves || []).map(norm))].filter(Boolean);
        if (mv.length < 1) continue;
        const e = _co[sp] = _co[sp] || { solo: {}, pair: {} };
        for (const a of mv) {
          e.solo[a] = (e.solo[a] || 0) + 1;
          for (const b of mv) if (a !== b) {
            (e.pair[a] = e.pair[a] || {})[b] = (e.pair[a][b] || 0) + 1;
          }
        }
      }
    }
  } catch (err) { /* no store: fall back to independent marginals */ }
  return _co;
}

/* Draw up to `k` distinct moves, CONDITIONAL on what is already on the set.
 *
 * WHY NOT INDEPENDENT MARGINALS. P(move) and P(set) are different objects. Incineroar's marginals
 * are fakeout .302, flareblitz .245, partingshot .184, throatchop .114, darkestlariat .079. Drawing
 * four independently produced "darkestlariat, partingshot, fakeout, throatchop" — it MISSED Flare
 * Blitz, the second most common move on the species, and took BOTH Dark-type physical attacks. Real
 * sets carry one. Independent sampling from correct marginals builds sets no human would build.
 *
 * So each subsequent draw is reweighted by the measured LIFT of a candidate against every move
 * already chosen: lift(m|s) = P(m and s together) / (P(m) * P(s)) approximated from counts. Moves
 * that genuinely travel together (Fake Out with Flare Blitz) get boosted; near-substitutes that
 * rarely co-occur (Darkest Lariat with Throat Chop) get suppressed. Lift is clamped so a single
 * thin cell cannot dominate, and falls back to 1 (independence) when there is no evidence.
 */
function sampleMoves(species, have, k, seed) {
  const sp = resolveSpecies(species, movePriors());
  const pool = (movePriors()[sp] || []).filter(m => !have.some(h => norm(h) === norm(m.mv)));
  if (!pool.length) return [];
  const e = coocc()[resolveSpecies(sp, coocc())] || { solo: {}, pair: {} };
  const nSets = Math.max(1, Object.values(e.solo).reduce((a, b) => Math.max(a, b), 0));

  /* Lift, SHRUNK BY EVIDENCE. Raw lift is badly biased at small counts: a rare move has a tiny
   * expected co-occurrence, so (both+0.5)/(expected+0.5) is large almost by construction, while a
   * common move sits near 1. Unshrunk, that INVERTS the ranking — Close Combat (marginal 0.9%)
   * landed on 45% of sampled Incineroar sets, and Darkest Lariat (7.9%) matched Flare Blitz (24.5%).
   *
   * So the lift is pulled toward 1 (independence) by how much evidence supports it, n/(n+K) with
   * K=10 — the same shrinkage rule xatu_context.py uses for its context cells (K=12). A pair seen
   * once barely moves the draw; a pair seen fifty times moves it a lot. */
  const K = 10;
  const lift = (a, b) => {
    const sa = e.solo[a], sb = e.solo[b];
    if (!sa || !sb) return 1;                       // no evidence -> independence
    const both = (e.pair[a] || {})[b] || 0;
    const expected = (sa * sb) / nSets;
    if (expected <= 0) return 1;
    const raw = (both + 0.5) / (expected + 0.5);
    const clamped = Math.min(3, Math.max(0.2, raw));
    const n = Math.min(sa, sb);                     // evidence is bounded by the rarer of the two
    const w = n / (n + K);
    return 1 + (clamped - 1) * w;
  };

  const chosen = have.map(norm);
  const out = [];
  const r = rng(seed);
  const avail = pool.slice();
  while (out.length < k && avail.length) {
    /* GEOMETRIC mean of the lifts, not the product. The product compounds: with three moves already
     * chosen a clamped 3x lift becomes 27x, which was enough to put Darkest Lariat (marginal 7.9%)
     * on 80% of sampled Incineroar sets — above Flare Blitz at 24.5%. The geometric mean keeps the
     * adjustment on the scale of a single lift however much context there is, so co-occurrence
     * reshapes the draw without overwhelming the marginal it is adjusting. */
    const w = avail.map(m => {
      if (!chosen.length) return m.p;
      let logsum = 0;
      for (const c of chosen) logsum += Math.log(lift(norm(m.mv), c));
      return m.p * Math.exp(logsum / chosen.length);
    });
    let tot = 0; for (const x of w) tot += x;
    if (tot <= 0) break;
    let t = r() * tot, i = 0;
    for (; i < w.length; i++) { t -= w[i]; if (t <= 0) break; }
    if (i >= w.length) i = w.length - 1;
    out.push(avail[i].mv);
    chosen.push(norm(avail[i].mv));
    avail.splice(i, 1);

    /* ONE MOVE PER REDUNDANT FAMILY. Co-occurrence lift discourages nonsense pairs but cannot
     * forbid them, so sets came out with BOTH Protect and Detect — measured at 1.1% of Pokemon that
     * used any protection move, across 40,000 games. No real player runs two; the second slot is
     * simply wasted, and a bot holding both wastes turns failing with one after the other.
     *
     * Same argument for the other exact-duplicate families: two forms of the same effect where
     * carrying both is strictly worse than carrying one plus anything else. This is a legality-
     * shaped constraint on SET CONSTRUCTION, not a play heuristic — it says what a set looks like,
     * never what to click. */
    const fam = FAMILY_OF[norm(avail_last_picked(out))];
    if (fam) {
      for (let j = avail.length - 1; j >= 0; j--) {
        if (FAMILY_OF[norm(avail[j].mv)] === fam) avail.splice(j, 1);
      }
    }
  }
  return out;
}
function avail_last_picked(out) { return out[out.length - 1]; }

/* Redundant move families: carrying two members is never a real set. */
const FAMILY_OF = {};
[
  ['protect', ['protect', 'detect', 'spikyshield', 'banefulbunker', 'burningbulwark', 'silktrap',
               'obstruct', 'kingsshield']],
  ['tailwind', ['tailwind']],
  ['weather', ['raindance', 'sunnyday', 'sandstorm', 'snowscape', 'hail', 'chillyreception']],
  ['terrain', ['electricterrain', 'grassyterrain', 'psychicterrain', 'mistyterrain']],
  ['trickroom', ['trickroom']],
  ['fakeout', ['fakeout']],
].forEach(([fam, moves]) => { if (moves.length > 1) moves.forEach(m => { FAMILY_OF[m] = fam; }); });

/* Sample a SPREAD from Smogon's official distribution, proportional to how often it is actually run.
 *
 * WHY THIS MATTERS MORE THAN THE MOVES. champions_sim.js gave every Pokemon a flat
 * 11/11/11/11/11/11, documented as "spread evenly when unknown rather than maximising, because
 * maximising would systematically overstate every unknown Pokemon". The reasoning was sound and the
 * result was still badly wrong: real Garchomp runs Jolly 2/32/0/0/0/32 on 42% of sets. Since
 * stat = base + SP + 20, that is Attack 182 against the flat assumption's 161 — a 13% understatement
 * on the format's most-used attacker, applied to EVERY damage figure the project has computed.
 *
 * Flat spreads do not merely lose accuracy, they lose the SHAPE of the format: real sets are
 * specialised (92% touch the 32 cap on some stat), so a flat spread makes every Pokemon a
 * jack-of-all-trades that exists nowhere on the ladder. */
function sampleSpread(species, seed) {
  let SM = null;
  try { SM = require('./smogon_priors.js').forSpecies(species); } catch (e) { /* optional */ }
  if (!SM || !SM.spreads || !SM.spreads.length) return null;
  const r = rng((seed || 1) + norm(species).length * 104729);
  let tot = 0; for (const s of SM.spreads) tot += s.pct;
  if (tot <= 0) return null;
  let x = r() * tot, i = 0;
  for (; i < SM.spreads.length; i++) { x -= SM.spreads[i].pct; if (x <= 0) break; }
  if (i >= SM.spreads.length) i = SM.spreads.length - 1;
  const s = SM.spreads[i];
  return { nature: s.nature, sp: { hp: s.sp[0], atk: s.sp[1], def: s.sp[2], spa: s.sp[3], spd: s.sp[4], spe: s.sp[5] }, pct: s.pct };
}

/* The public call. Returns what is KNOWN plus what was FILLED, so callers can report the split. */
function fillSet(species, known, seed) {
  known = known || {};
  const have = (known.moves || []).slice(0, 4);
  const filled = [];
  let moves = have.slice();

  /* Prefer Smogon's P(move is ON the set) over our P(move | action) when available. They are
   * different quantities: a move clicked rarely can still sit on most sets. Smogon's percentages sum
   * to ~400% precisely because every Pokemon carries four. */
  if (moves.length < 4) {
    let drawn = [];

    /* OBSERVED JOINT FIRST. An open team sheet is the set distribution, measured — not four marginals
     * with a correction bolted on. Tried before anything else, because the two paths below are both
     * independence approximations and the better one was unreachable: `sampleMoves` carries a measured
     * co-occurrence lift built precisely to stop near-substitutes pairing up, and fillSet only reached
     * it when Smogon returned nothing, which is rare. So the correction existed and was bypassed for
     * most species, and generated sets kept pairing Dire Claw with Gunk Shot. */
    const ob = observedDraw(species, moves, (seed || 1) + norm(species).length * 7919);
    if (ob && ob.length) {
      drawn = ob;
      filled.push(`${species}: ${ob.length} move(s) from an observed open-sheet set`);
    }

    try {
      /* Skipped by a null, not by a thrown Error. The first version of this threw to jump out of the
       * block, which allocated an exception on the common path and hijacked a catch whose comment says
       * "fall through to the behaviour-clone" — so a real failure inside the Smogon lookup and a
       * deliberate skip became the same event. */
      const SM = drawn.length ? null : require('./smogon_priors.js').forSpecies(species);
      if (SM && SM.moves && SM.moves.length) {
        const r = rng((seed || 1) + norm(species).length * 7919);
        const pool = SM.moves.filter(m => !moves.some(h => norm(h) === norm(m.move)));
        /* Drop family duplicates already present among the REVEALED moves, so a set that showed
         * Protect cannot then be handed Detect. The same rule is applied after each draw below. */
        for (let j = pool.length - 1; j >= 0; j--) {
          const f = FAMILY_OF[norm(pool[j].move)];
          if (f && moves.some(h => FAMILY_OF[norm(h)] === f)) pool.splice(j, 1);
        }
        while (moves.length + drawn.length < 4 && pool.length) {
          let tot = 0; for (const m of pool) tot += m.pct;
          if (tot <= 0) break;
          let x = r() * tot, i = 0;
          for (; i < pool.length; i++) { x -= pool[i].pct; if (x <= 0) break; }
          if (i >= pool.length) i = pool.length - 1;
          const picked = pool[i].move;
          drawn.push(picked); pool.splice(i, 1);
          const fam = FAMILY_OF[norm(picked)];
          if (fam) {
            for (let j = pool.length - 1; j >= 0; j--) {
              if (FAMILY_OF[norm(pool[j].move)] === fam) pool.splice(j, 1);
            }
          }
        }
      }
    } catch (e) { /* fall through to the behaviour-clone */ }
    if (!drawn.length) drawn = sampleMoves(species, moves, 4 - moves.length, (seed || 1) + norm(species).length * 7919);
    if (drawn.length) filled.push(`${species}: ${drawn.length} move(s)`);
    moves = moves.concat(drawn);
  }

  const gear = gearPriors()[resolveSpecies(species, gearPriors())] || {};
  let SM = null;
  try { SM = require('./smogon_priors.js').forSpecies(species); } catch (e) { /* optional */ }
  const smItem = SM && SM.items && SM.items[0] ? SM.items[0].item : null;
  const smAbil = SM && SM.abilities && SM.abilities[0] ? SM.abilities[0].ability : null;

  /* OUR OWN LADDER PARSE OUTRANKS SMOGON FOR ITEMS, AND THE REASON IS MEGA STONES.
   *
   * Smogon's Champions moveset files list no mega stones at all — Charizard's top items come back
   * as Choice Scarf / Life Orb / Charcoal, Tyranitar as Choice Scarf. Our own parse of real
   * Champions replays says Charizard holds CharizarditeY and Tyranitar holds Tyranitarite, and
   * 82.1% of the 12,872 games in the ladder store record a mega stone on some set.
   *
   * Because smItem was consulted FIRST, every generated team lost its stone. A Pokemon with no
   * stone cannot mega evolve, so the self-play corpus contained essentially no megas while 93% of
   * real ladder games contain one — in a format built around them. That is the single largest
   * realism defect found in the corpus, and it came from preferring an external source over our own
   * direct measurement of this exact format.
   *
   * Smogon stays as the FALLBACK: it covers species our store has not seen enough of. But where we
   * have measured this format ourselves, our measurement wins. */
  /* Sample the ladder distribution rather than taking its mode, so "almost every Charizard carries
   * the stone, plenty of Tyranitars do not" comes out of the data instead of being asserted. */
  const rGear = rng((seed || 1) + norm(species).length * 15485863);

  /* MEGA STONES COME FROM SMOGON, NOT FROM OUR REPLAYS. THIS IS THE ONE PLACE THEIR DATA IS
   * STRICTLY BETTER AND THE REASON IS STRUCTURAL, NOT VOLUME.
   *
   * An item enters our store only when a replay REVEALS it, and a mega stone reveals itself by the
   * mega — 16,631 `|-mega|` lines against 1,282 `|-item|` lines in 10,740 games. A Tyranitar holding
   * Assault Vest may reveal nothing all game. So our estimate is selection-biased in a direction we
   * cannot correct from replays: we had Tyranitar at 20% where the true rate is 66%.
   *
   * Smogon computes from the TEAM, server-side, so a Pokemon that dies in the back without revealing
   * anything is still counted. Verified three ways before adopting it (docs/FINDINGS-2026-07-26.md
   * §4.2), the decisive one being that their raw counts sum to exactly 12.00 per battle across
   * 1,163,315 battles — a VGC battle has 12 Pokemon across the two teams, so every slot is counted
   * whether or not it was ever brought.
   *
   * megaInfo also carries the X/Y split, so Charizard comes out 96.1% Y / 3.2% X / 0.7% no stone
   * rather than "always the modal stone". */
  let megaItem = null;
  if (!known.item) {
    try {
      const mi = require('./smogon_priors.js').megaInfo(species);
      if (mi && mi.rate > 0) {
        if (rGear() < mi.rate) {
          /* which forme, weighted by how often each is actually run */
          const tot = mi.options.reduce((a, o) => a + o.raw, 0);
          let x = rGear() * tot;
          for (const o of mi.options) { x -= o.raw; if (x <= 0) { megaItem = o.stone; break; } }
          if (!megaItem) megaItem = mi.options[0].stone;
        } else {
          megaItem = '';   // explicitly NOT a stone: this build genuinely runs something else
        }
      }
    } catch (e) { /* no Smogon data for this species — fall through to our own priors */ }
  }

  /* When Smogon says "no stone this time", the ordinary item draw must not hand one back. */
  const stoneish = (v) => { const n = norm(v); return (n.endsWith('ite') || /ite[xy]$/.test(n)) && n !== 'whiteherb' && n.length > 5; };
  let itemDist = gear.itemDist;
  if (megaItem === '' && itemDist) {
    itemDist = Object.fromEntries(Object.entries(itemDist).filter(([k]) => !stoneish(k)));
    if (!Object.keys(itemDist).length) itemDist = null;
  }

  const item = known.item || megaItem || sampleDist(itemDist, rGear) || (megaItem === '' ? (smItem || '') : (gear.item || smItem || ''));
  const ability = known.ability || sampleDist(gear.abilityDist, rGear) || gear.ability || smAbil || '';
  if (!known.item && (megaItem || smItem || gear.item)) filled.push(`${species}: item`);
  if (!known.ability && (smAbil || gear.ability)) filled.push(`${species}: ability`);

  /* A MEGA'S MOVES ARE NOT THE BASE FORME'S MOVES.
   *
   * Mega Dragonite is a special attacker; ordinary Dragonite is physical. Our own measured priors
   * say exactly that — `dragonite` leads with Extreme Speed (21%) and Earthquake, while
   * `dragonitemega` leads with Roost, Dragon Pulse, Blizzard and Draco Meteor. Twenty-six mega
   * formes carry their own move priors and every one of them was being ignored, because the moves
   * were drawn from the base species before the item was even known.
   *
   * So once a mega stone has been assigned, the UNREVEALED slots are re-drawn from the mega forme's
   * prior. Anything the replay actually revealed is kept — that is observation, not inference. */
  let megaForme = null;
  if (item && !known.item) {
    const it = norm(item);
    const base = norm(species);
    if (it.endsWith('ite') || /ite[xy]$/.test(it)) {
      const MP = movePriors();
      const cand = /ite y$|itey$/.test(it) ? [base + 'megay', base + 'mega']
                 : /ite x$|itex$/.test(it) ? [base + 'megax', base + 'mega']
                 : [base + 'mega', base + 'megay', base + 'megax'];
      megaForme = cand.find(k => MP[k] && (MP[k].length || (MP[k].moves || []).length)) || null;
    }
  }
  if (megaForme) {
    const keptKnown = have.slice();
    const need = 4 - keptKnown.length;
    if (need > 0) {
      const redrawn = sampleMoves(megaForme, keptKnown, need,
                                  (seed || 1) + norm(megaForme).length * 7919);
      if (redrawn.length) {
        moves = keptKnown.concat(redrawn);
        filled.push(`${species}: ${redrawn.length} move(s) from ${megaForme}`);
      }
    }
  }

  /* A CALLER-SUPPLIED SPREAD IS AN INSTRUCTION, NOT A HINT.
   *
   * This used to sample unconditionally, which silently broke any experiment that wanted to hold the
   * spread fixed or vary it deliberately: build_lab would ask for Adamant 252 Atk, get a re-sampled
   * Jolly, and then attribute the resulting win-rate difference to whichever move it thought it was
   * testing. Moves and items were already honoured when known; the spread was the one axis that was
   * not, so the omission was invisible until the factorial started crossing all three.
   *
   * `evs` arrives as Smogon's six-element array in HP/Atk/Def/SpA/SpD/Spe order — the same order the
   * moveset files print — and is widened to the named form the rest of the pipeline uses. */
  let spread = null;
  if (known.nature && known.evs) {
    const e = known.evs;
    spread = { nature: known.nature, sp: { hp: e[0], atk: e[1], def: e[2], spa: e[3], spd: e[4], spe: e[5] }, pct: null };
  } else {
    spread = sampleSpread(species, seed);
    if (spread) filled.push(`${species}: spread`);
  }
  return { moves, item, ability, spread, filled, knownMoves: have.length };
}

function coverage() {
  const m = movePriors(), g = gearPriors();
  return { species_with_move_priors: Object.keys(m).length, species_with_gear_priors: Object.keys(g).length };
}

module.exports = { fillSet, movePriors, gearPriors, coverage, sampleMoves, observedSets, observedDraw };

if (require.main === module) {
  console.log(JSON.stringify(coverage(), null, 2));
  for (const sp of ['garchomp', 'incineroar', 'sinistcha']) {
    console.log(sp, JSON.stringify(fillSet(sp, {}, 42)));
  }
}
