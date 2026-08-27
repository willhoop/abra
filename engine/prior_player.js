/* prior_player.js — our behaviour-clone policy, running inside the OFFICIAL Showdown simulator.
 *
 * WHY THIS IS NECESSARY
 * ---------------------
 * Comparing our hand-written engine to the official simulator is meaningless unless both make
 * decisions the same way. Two earlier attempts failed on exactly this:
 *
 *   attempt 1  teams filled from the raw learnset   -> 32.2 point mean difference (the filler)
 *   attempt 2  identical teams, different policies  -> 23.7 point mean difference (the policy)
 *
 * Our engine samples the move a species actually clicks, at the frequency it clicks it (MC.priors,
 * built from observed usage). `RandomPlayerAI` picks uniformly. A uniform player throws away Protect
 * timing, spread-move choice and setup discipline, which moves win rates by far more than any rules
 * bug would. So the policy has to be held constant before a residual difference can be attributed to
 * the RULES, which is the only quantity ADR-001 actually cares about.
 *
 * This class ports the prior-sampling half of the policy. It deliberately does NOT port the two
 * damage-dependent heuristics ("take a guaranteed KO 85% of the time", "Protect when threatened and
 * unable to KO back") because those need a damage calculation the request object does not carry.
 * The matching comparison therefore has to run OUR engine with those heuristics DISABLED, so that
 * both sides are pure prior samplers.
 *
 * THE SWITCH EXISTS; THE COMPARISON DOES NOT, AND THIS LINE NAMED A TEST FOR 34 DAYS. It said *"See
 * tests/test-policy-parity.js"* — but there is no tests/test-policy-parity.js, that path has never
 * existed in this repository's history, and it is the oldest of the eight false comment claims found
 * by tests/test-claim-truth.js. Written 2026-07-24 in e5d5d05d, corrected 2026-08-27 by MEASURE.
 * What is real is `setPurePriors()` in
 * engine/medicham2-browser.js, which turns off the KO / Protect / Wide Guard heuristics and is
 * documented there in the same terms; NOTHING IN engine/, tests/ OR build/ CALLS IT, so the like-for-
 * like run this paragraph describes has never been made. Treat the paragraph as the DESIGN of a
 * comparison that is owed, not as a description of one that happened.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const path = require('path');
const fs = require('fs');

function loadBase() {
  const base = process.env.SHOWDOWN_PATH || '/tmp/ps';
  return {
    RandomPlayerAI: require(path.join(base, 'dist', 'sim', 'tools', 'random-player-ai')).RandomPlayerAI,
  };
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Mega stones are the only items whose id ends in "ite" — Charizardite Y, Tyranitarite, Swampertite.
 * The length guard keeps the handful of short false friends out; there is no item called just "ite",
 * but "White Herb" and friends normalise to something ending in other letters, so the tail test is
 * enough on its own and the guard is belt-and-braces. Deliberately a rule about the item id rather
 * than a list of stones, so a new mega in a future regulation is handled without an edit (S13). */
const isMegaStone = it => {
  const s = norm(it);
  return s.length > 4 && /ite$|itex$|itey$/.test(s);
};

/* Build species -> [[moveId, probability], ...].
 *
 * READS THE FILE, NOT A BROWSER GLOBAL. This used to read `globalThis.MC.priors`, which exists only
 * when the site bundle is loaded — so under Node it threw, and PriorPlayerAI could not be
 * constructed at all. MEW's first attempt to use it produced 0 games from 40 battles.
 *
 * That is the third instance of the same defect this week: packTeam filled unrevealed moves from
 * `globalThis.MC` and silently produced teams of Tackle, and `set_priors.js` was written to replace
 * it. A module that runs in both the browser and Node must load from disk and treat the global as an
 * optional accelerator, never as the source.
 *
 * data/move-priors.json is the behaviour-clone: P(move | species) measured from real ladder play,
 * e.g. incineroar over 3,130 observed actions. */
function priorTable() {
  const fs = require('fs');
  const out = {};
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'move-priors.json'), 'utf8'));
    for (const [sp, v] of Object.entries(j.species || {})) {
      const rows = (v.moves || []).filter(m => m && m.mv && m.p > 0).map(m => [norm(m.mv), +m.p]);
      if (rows.length) out[norm(sp)] = rows;
    }
  } catch (e) { /* fall through to the global, then to empty */ }
  if (!Object.keys(out).length) {
    const MC = (typeof globalThis !== 'undefined' && globalThis.MC) || null;
    if (MC && MC.priors) {
      for (const [sp, rows] of Object.entries(MC.priors)) out[norm(sp)] = (rows || []).map(r => [norm(r[0]), +r[1] || 0]);
    }
  }
  if (!Object.keys(out).length) {
    throw new Error('no move priors found — expected data/move-priors.json');
  }
  return out;
}

/* Measured bring/lead propensities, generated by engine/bring_priors.js from clean ladder games.
 * Loaded once per process and shared by every player instance. Returns null when absent so the
 * caller degrades loudly rather than inventing weights. */
let _bring = undefined;
function bringTable() {
  if (_bring !== undefined) return _bring;
  const f = path.join(__dirname, '..', 'data', 'bring-priors.json');
  if (!fs.existsSync(f)) {
    process.stderr.write(`  WARNING: ${path.relative(path.join(__dirname, '..'), f)} missing — team preview will be the CONSTANT 'default'.\n`);
    process.stderr.write('  Run: node engine/bring_priors.js\n');
    _bring = null;
    return _bring;
  }
  /* Deliberately NOT wrapped in a silent catch. A malformed priors file must crash the run, not
   * quietly return null and hand back a corpus in which every team made the same preview decision —
   * that is indistinguishable from a working run and is how ADR-001 attempt 3 happened. */
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!j || !j.species || !Object.keys(j.species).length) {
    throw new Error(`${f} has no species table — regenerate with engine/bring_priors.js`);
  }
  _bring = j;
  return _bring;
}

function makePriorPlayer() {
  const { RandomPlayerAI } = loadBase();

  class PriorPlayerAI extends RandomPlayerAI {
    constructor(playerStream, options = {}, debug = false) {
      super(playerStream, options, debug);
      this.priors = options.priors || priorTable();
      /* Preview priors are OPTIONAL — if the file is absent the player still runs, but it degrades to
       * the constant 'default' bring and previewDefault counts it so the degradation is visible in
       * MEW's own accounting rather than silently poisoning a corpus. */
      this.bringPriors = options.bringPriors !== undefined ? options.bringPriors : bringTable();
      this.previewTemp = options.previewTemp != null ? +options.previewTemp
        : (process.env.MEW_PREVIEW_TEMP != null ? +process.env.MEW_PREVIEW_TEMP : 1.0);
      /* SPECIES THAT MUST NOT BE PILOTED BY POPULARITY — see chooseMove for why this exists. */
      this.uniformFor = new Set((options.uniformFor || []).map(norm));
      this.stats = { sampled: 0, fellBack: 0, noPrior: 0, previewSampled: 0, previewDefault: 0, uniform: 0 };
    }

    /* Capture the request so chooseMove can work out WHICH Pokemon is choosing.
     *
     * The `active` object passed to chooseMove carries only the move list - no species. A first
     * version read `active.species`, which is undefined, so every decision fell through to uniform
     * random while reporting itself as a prior sampler. The comparison it produced (32.2 points)
     * was therefore measuring random-versus-heuristic all over again. `request.active[i]` lines up
     * with `request.side.pokemon[i]`, whose `details` field carries the species. */
    receiveRequest(request) {
      this._req = request;
      return super.receiveRequest(request);
    }

    /* TEAM PREVIEW: CHOOSE THE FOUR, THEN CHOOSE THE LEADS.
     * ---------------------------------------------------------------------------------------------
     * RandomPlayerAI.chooseTeamPreview returns the literal string 'default', which brings slots 1-4
     * in packed order and leads slots 1-2. Inheriting that meant every MEW game with a given team
     * made the identical preview decision, so C(6,4) x C(4,2) = 90 choices per side were sampled at
     * exactly one point, forever. Team selection is a large share of VGC skill and it was a constant.
     *
     * Uniform over all 90 would be the wrong correction — most brings are ones no player would make,
     * and the corpus would fill with positions that never occur in real games. Instead each species is
     * drawn WITHOUT REPLACEMENT with weight p_bring, then two of the four are drawn with weight
     * p_lead. Both come from measured ladder behaviour (engine/bring_priors.js), so the common brings
     * dominate and the neighbourhood around them still gets explored.
     *
     * TEMP controls how far from the common line the draw wanders. 1.0 samples proportional to
     * measured propensity; ->0 collapses toward the single most likely bring; >1 flattens toward
     * uniform. It is exposed so the exploration/realism trade-off can be swept rather than argued.
     *
     * Falls back to 'default' if priors are missing, and COUNTS that, because a preview sampler that
     * silently degrades to a constant is precisely the failure this class was written to make visible. */
    chooseTeamPreview(team) {
      const P = this.bringPriors;
      if (!P) { this.stats.previewDefault++; return 'default'; }
      const TEMP = this.previewTemp;
      const idx = team.map((_, i) => i);
      const sp = team.map(m => norm(String(m && (m.details || m.speciesForme || m.species) || '').split(',')[0]));
      const w = (s, key, dflt) => {
        const r = P.species[s];
        return Math.pow(Math.max(1e-6, r ? r[key] : dflt), 1 / Math.max(0.05, TEMP));
      };

      /* weighted draw without replacement */
      const pick = (pool, key, dflt, k) => {
        const left = pool.slice(), out = [];
        while (out.length < k && left.length) {
          const ws = left.map(i => w(sp[i], key, dflt));
          /* this.prng, NOT Math.random(). RandomPlayerAI seeds this.prng from options.seed, so every
           * decision the player makes is reproducible from the battle's recorded seed. Math.random()
           * here would make the preview — the single largest branch in the game — unreplayable, and a
           * claim like "switching here won the game" cannot be checked if the game cannot be re-run. */
          let r = this.prng.random() * ws.reduce((a, b) => a + b, 0);
          let j = 0;
          while (j < left.length - 1 && (r -= ws[j]) > 0) j++;
          out.push(left[j]); left.splice(j, 1);
        }
        return out;
      };

      const size = Math.min(4, team.length);
      let four = pick(idx, 'p_bring', P.mean_bring, size);
      let leads = pick(four, 'p_lead', P.mean_lead, Math.min(2, four.length));

      /* ---- THE MEGA STONE OVERRIDES THE SPECIES PRIOR --------------------------------------------
       *
       * p_bring and p_lead are keyed on species, so "Charizard" and "Charizard holding Charizardite
       * Y" get the same weight — but the stone is the single most important thing a player is looking
       * at during preview, and the format is built around it.
       *
       * Leaving it out cost 21 points of realism: 74% of self-play games contained a mega against a
       * real 93%. Every other candidate was measured and ruled out — team generation puts 1.54 stones
       * on a team against Smogon's 1.58, mega-capable species were already brought at 88.6% against a
       * real 92.6%, and raising the form-change probability to 1.0 moved the rate 0.7 points. The
       * cause was the stone holder sitting in the back of a game that ended before it came out.
       *
       * Both numbers below are measured from real protocol logs by engine/bring_priors.js and read
       * from the file. Nothing here is chosen: p_side_megas is how often a real side megas at all,
       * p_mega_is_lead is how often the mega-evolver was one of the two leads. */
      const M = P.mega;
      if (M && M.p_side_megas) {
        const holders = idx.filter(i => isMegaStone(team[i] && team[i].item));
        if (holders.length) {
          /* Pick which stone to commit to by the species prior, so a team carrying two stones still
           * behaves sensibly — the engine allows only one mega per side regardless. */
          const hw = holders.map(i => w(sp[i], 'p_bring', P.mean_bring));
          let r = this.prng.random() * hw.reduce((a, b) => a + b, 0), h = 0;
          while (h < holders.length - 1 && (r -= hw[h]) > 0) h++;
          const star = holders[h];

          if (this.prng.random() < M.p_side_megas && !four.includes(star)) {
            /* Displace the LEAST likely of the four rather than a random one, so the rest of the
             * bring stays the bring the priors wanted. */
            let worst = 0;
            for (let k = 1; k < four.length; k++) {
              if (w(sp[four[k]], 'p_bring', P.mean_bring) < w(sp[four[worst]], 'p_bring', P.mean_bring)) worst = k;
            }
            four[worst] = star;
            leads = leads.map(i => (i === four[worst] ? star : i)).filter(i => four.includes(i));
            if (leads.length < Math.min(2, four.length)) {
              for (const i of four) if (!leads.includes(i) && leads.length < 2) leads.push(i);
            }
          }
          /* Then lead with it at the measured rate. Being in the back of a doubles game is how a
           * mega fails to happen, so this is the half of the fix that actually moves the number. */
          if (four.includes(star) && !leads.includes(star) && this.prng.random() < M.p_mega_is_lead) {
            let worst = 0;
            for (let k = 1; k < leads.length; k++) {
              if (w(sp[leads[k]], 'p_lead', P.mean_lead) < w(sp[leads[worst]], 'p_lead', P.mean_lead)) worst = k;
            }
            leads[worst] = star;
          }
        }
      }

      const rest = four.filter(i => !leads.includes(i));
      this.stats.previewSampled++;
      /* Showdown expects 1-based slot order; the first two are the leads in doubles. */
      return 'team ' + leads.concat(rest).map(i => i + 1).join('');
    }

    speciesFor(active) {
      const req = this._req;
      if (!req || !req.active || !req.side || !req.side.pokemon) return '';
      const i = req.active.indexOf(active);
      if (i < 0) return '';
      const mon = req.side.pokemon[i];
      if (!mon || !mon.details) return '';
      return norm(String(mon.details).split(',')[0]);
    }

    /* Sample the move this species actually clicks, at its observed frequency.
     *
     * Falls back to the parent's uniform choice when the species has no prior, or when the sampled
     * move is not currently legal (out of PP, disabled, Fake Out after turn one, Choice-locked).
     * Both cases are COUNTED rather than hidden, because a policy that silently degrades to random
     * would reintroduce the very confound this class exists to remove. */
    chooseMove(active, moves) {
      const species = this.speciesFor(active);

      /* ---- THE SPECIES UNDER TEST GETS EQUAL AIRTIME, NOT POPULARITY-WEIGHTED AIRTIME ------------
       *
       * Sampling a move by how often it is clicked is right for an OPPONENT — it puts the board in
       * positions that resemble real games. It is wrong for the Pokemon whose build is being
       * measured, and measurably so.
       *
       * The priors are renormalised over whichever four moves the build carries, so a build that
       * swaps a common move for a rare one gets that slot clicked LESS. Measured on Garchomp:
       * Earthquake occupies 29.4% of the pilot's decisions, Stomping Tantrum in the same slot only
       * 25.2% — 0.86x the airtime. So build_lab systematically gives rare moves fewer chances to
       * prove themselves, and rarity is the very thing under test. The experiment was biased toward
       * builds made of popular moves, which is circular: popularity is what we wanted to test
       * against, not with.
       *
       * Uniform over the legal moves removes the bias without touching the opponent's realism. It
       * is deliberately NOT applied globally — a corpus piloted uniformly everywhere would explore
       * positions that never occur, which is the failure the whole behaviour-clone exists to avoid. */
      if (this.uniformFor.size && this.uniformFor.has(species)) {
        const pick = moves[Math.floor(this.prng.random() * moves.length)] || moves[0];
        if (pick) { this.stats.uniform++; return pick.choice; }
      }

      const rows = this.priors[species];
      if (!rows || !rows.length) {
        this.stats.noPrior++;
        return super.chooseMove(active, moves);
      }
      const legal = new Map();
      for (const m of moves) {
        const id = norm((m.move && (m.move.id || m.move.move || m.move)) || '');
        if (id && !legal.has(id)) legal.set(id, m.choice);
      }
      // renormalise over the moves that are actually available this turn, then sample
      const avail = rows.filter(([id]) => legal.has(id));
      const mass = avail.reduce((s, [, p]) => s + p, 0);
      if (mass > 0) {
        /* Seeded, for the same reason as the preview draw: this is THE move decision, so an unseeded
         * draw here makes every recorded game unreplayable no matter what else is pinned. */
        let r = this.prng.random() * mass;
        for (const [id, p] of avail) {
          r -= p;
          if (r <= 0) { this.stats.sampled++; return legal.get(id); }
        }
        this.stats.sampled++;
        return legal.get(avail[avail.length - 1][0]);
      }
      this.stats.fellBack++;
      return super.chooseMove(active, moves);
    }
  }
  return PriorPlayerAI;
}

module.exports = { makePriorPlayer, priorTable, norm };
