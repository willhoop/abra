/* fit_policy.js — learn how much a human's move choice depends on the board.
 *
 *   SHOWDOWN_PATH=... node engine/fit_policy.js   ->   data/policy-weights.json
 *
 * WHAT THIS IS
 * ------------
 * A discrete-choice fit. At every decision a real player faced a set of (move, target) pairs and
 * picked one. Each pair is described by the features in engine/board.js — type effectiveness against
 * the actual target, base power, whether the move is already dead on the board, and the behaviour
 * clone's P(move | species). Fitting is conditional logit:
 *
 *     P(pick j) = exp(w . x_j) / sum_k exp(w . x_k)
 *
 * maximised over w by gradient ascent on the log-likelihood of what people really clicked.
 *
 * WHY IT IS A FIT AND NOT A SCORING FUNCTION SOMEBODY WROTE
 * --------------------------------------------------------
 * The obvious way to make a bot aim better is to write `score = damage * effectiveness` and tune the
 * coefficients until the realism report looks right. That is an asserted model, it has as many free
 * parameters as it has terms, and tuning it against the number being reported is circular — the
 * report stops being evidence the moment it becomes the objective.
 *
 * Here the coefficients are estimated from 2,136 clean open-sheet games and the realism report is
 * never consulted during fitting. It is held back as the out-of-sample check, which is the only role
 * it can play honestly.
 *
 * A GREEDY BOT WOULD OVERSHOOT, WHICH IS THE POINT.
 * The target is not "maximise super-effective moves". Humans hit super effectively on 23.4% of moves,
 * not 100%, because they also click Protect, set Tailwind, and hit a resisted button to break a Sash.
 * A max-damage bot sails past 23.4% and is LESS human, not more. Fitting to observed clicks targets
 * the right quantity — it reproduces the rate rather than maximising it.
 *
 * WHY OPEN TEAM SHEETS, AND THE CAVEAT THAT COMES WITH THEM
 * --------------------------------------------------------
 * A choice model needs the CHOICE SET: the moves the player could have clicked. A normal replay only
 * reveals moves that were used, so the alternatives are unobservable and any set reconstructed from
 * revealed moves is biased by revelation — a move is in it BECAUSE it was clicked. Open-sheet games
 * publish all four moves of all six Pokemon up front, so the choice set is known exactly.
 *
 * The caveat, stated rather than buried: open-sheet play is not identical to closed play. Both
 * players can see everything, so there is less bluffing and less hedging against an unknown set.
 * These weights are therefore fitted on a slightly different game than the one the ladder plays. It
 * is the only corpus where the choice set is not guessed, which is why it is used, and the direction
 * of the bias is toward MORE board-reading rather than less.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const Q = require('./quality.js');
const B = require('./board.js');
/* One reader for "whose moveset is this, and which candidate did they press". See its header and
 * docs/ARTIFACT-ACCESS-RULES.md R1/R6. */
const CM = require('./click_match.js');
/* ...and one reader for "is the recorded action a CLICK at all". docs/CLICK-CENSORING-FIX.md. */
const CC = require('./click_class.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const OUT = process.env.OUT_WEIGHTS ? require('path').resolve(process.env.OUT_WEIGHTS) : D('data', 'policy-weights.json');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

/* ---- THE OPPONENT MODEL, opt-in (--opponent-model) --------------------------------------------
 *
 * board.js's incomingThreat normally takes a MAX -- the foe's hardest available hit -- and nine
 * features are built on it. With the opponent model on, that max becomes an EXPECTATION weighted by
 * P(their action), scored with the same weights on the other side of the field. Measured on a real
 * board, the foe's lead clicks a damaging move 52.9% of the time while MAG assumes 100%, so the
 * survive/die half of the vector is priced against a worst case the opponent declines to inflict
 * roughly half the time.
 *
 * THE BOOTSTRAP, and it is a real assumption rather than a detail. Modelling the opponent needs
 * weights; fitting weights needs the features the model changes. That circle is broken the way
 * fictitious play breaks it: model the opponent with the CURRENT shipped weights, refit against
 * that, and stop. One round, not iterated to a fixed point -- iterating would be the more principled
 * thing and it is not done here, so this is a first-order correction and is reported as one.
 *
 * The opponent is therefore assumed to play like the current MAG. A human who always clicks Protect
 * is mispredicted, and on a CLOSED-sheet corpus this would be indefensible; on open sheets we know
 * their four moves, which is what makes it legitimate at all. */
const OPP_MODEL = process.argv.includes('--opponent-model');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

if (OPP_MODEL) {
  const seed = JSON.parse(require('fs').readFileSync(D('data', 'policy-weights.json'), 'utf8'));
  const sw = seed[seed.shipped || 'weights'] || seed.weights;
  if ((seed.features || []).join(',') !== B.FEATURES.join(',')) {
    console.error('REFUSING: the seed weights were fitted against a different feature list than board.js exposes.');
    process.exit(1);
  }
  B.setOpponentModel(sw);
  console.log(`  opponent model  ON  (seeded from data/policy-weights.json, ${sw.length} weights, one round)`);
}
const norm = B.norm, base = B.baseSpecies;

/* ---------------------------------------------------------------------------------------------
 * THE BEHAVIOUR CLONE, as a feature
 *
 * Read exactly the table engine/prior_player.js reads, so that "weight 1 on priorLogP and 0 on
 * everything else" reproduces the CURRENT bot's move distribution. That equivalence is what makes
 * the baseline in the report a real baseline rather than a strawman.
 * ------------------------------------------------------------------------------------------- */
function priorTable() {
  const j = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'));
  const out = {};
  for (const [sp, v] of Object.entries(j.species || {})) {
    const row = {};
    for (const m of v.moves || []) if (m && m.mv) row[norm(m.mv)] = +m.p || 0;
    out[norm(sp)] = row;
  }
  return out;
}
const PRIORS = priorTable();
const priorFor = (species, moveId) => {
  const r = PRIORS[norm(species)] || PRIORS[base(species)] || null;
  return r ? (r[norm(moveId)] || 0) : 0;
};

/* ---------------------------------------------------------------------------------------------
 * CORPUS
 *
 * Both open-sheet sources, deduplicated by replay id, every game through engine/quality.js.
 * GARBODOR: the raw store is 87% bots, forfeits and stubs; nothing here touches it unfiltered.
 * ------------------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------------------
 * THE OPEN-SHEET METAGAME IS NOT THE CLOSED-SHEET METAGAME, AND THAT IS MEASURED, NOT ASSUMED
 *
 * Open team sheets change the incentives on TEAM BUILDING, not just on play: a surprise set or a
 * bluff item is worth nothing against an opponent who read your sheet before game one. The corpus
 * even ships with a warning saying so ("Different information AND incentive regime ... Do not pool").
 *
 * Measured with engine/corpus_shift.js, the difference in teams is large:
 *
 *     Garchomp     81.6% of open-sheet teams   47.7% of closed      Tyranitar  7.4% v 21.2%
 *     Basculegion  61.3%                       33.2%                Sitrus     8.4% v 17.5% of items
 *     total absolute difference across 109 species: 551.9 points
 *
 * and the difference in BEHAVIOUR GIVEN A BOARD is not:
 *
 *     super effective 35.6% v 37.1%   resisted 15.1% v 15.0%   immune 1.00% v 0.97%
 *     dead moves 1.30% v 1.53%        status 33.9% v 34.1%     Protect 13.9% v 13.8%
 *
 * That distinction is what licenses using this corpus at all. The fit is a CONDITIONAL model,
 * P(choice | board, choice set) — it never learns what to bring, and MEW draws its teams from the
 * clean LADDER store regardless. So the composition shift changes which situations the fit saw, not
 * the behaviour it is learning.
 *
 * It is still a shift, and this function corrects for it the standard way: importance weighting.
 * Each decision is weighted by how much more or less common its acting species is in closed play,
 * which reweights the open-sheet sample to look like the closed-sheet metagame. Nothing here is
 * typed — both shares are counted from the two corpora — and the weights are normalised to mean 1
 * so the log-likelihood stays on its usual scale.
 *
 * Reweighting can quietly destroy a sample by concentrating it on a handful of rows, so the
 * effective sample size (Kish, (sum w)^2 / sum w^2) is reported rather than assumed harmless.
 * ------------------------------------------------------------------------------------------- */
/* THE REWEIGHTING DESCRIBED A DIFFERENT POPULATION FROM THE ONE IT REWEIGHTED.
 *
 * The open side was read from data/games.ots.jsonl alone, but loadCorpus() below feeds the fit from
 * THREE stores — games.bo3.jsonl, games.ots.jsonl and games.ladder.jsonl — keeping the clean
 * open-sheet games of each. Measured 2026-07-31:
 *
 *     games.bo3.jsonl      3,807 clean open-sheet   54.7% of the corpus
 *     games.ots.jsonl      2,891                    41.5%   <- the ONLY source of the ratio
 *     games.ladder.jsonl     268                     3.8%
 *     total                6,966
 *
 * So 58.5% of the rows being reweighted contributed nothing to the number doing the reweighting,
 * and bo3 — our own scrape, which the comment at loadCorpus calls "the same population as the closed
 * store" and which should therefore sit near weight 1 — was corrected by species shares measured on
 * a different collection entirely. data/policy-weights.json records shipped:
 * "reweighted_to_closed", so this is the vector magnemite.js loads at runtime.
 *
 * The fix is to take the open side FROM THE CORPUS, so the thing being described and the thing being
 * corrected are the same set of games by construction rather than by coincidence. Whole-repo review,
 * 2026-07-31.
 *
 * @param {Array} corpus  the games loadCorpus() accepted — pass it rather than re-reading, both to
 *                        guarantee they match and because re-reading three stores is not free. */
function speciesShares(corpus) {
  const cfg = Q.config();
  const count = (games) => {
    const c = {}; let n = 0;
    for (const g of games) {
      n++;
      for (const s of ['p1', 'p2']) for (const sp of ((g.six || {})[s] || [])) {
        const k = base(sp); c[k] = (c[k] || 0) + 1;
      }
    }
    return { c, n };
  };
  const closedG = [];
  /* The same behavioural bot set loadCorpus uses. Screening the covariate-shift comparison with a
   * weaker filter than the fit itself would make the two sides incomparable. */
  const bots = Q.behaviouralBots(Q.readStore());
  /* THE OPEN SIDE IS THE CORPUS ITSELF. Refusing a missing corpus rather than silently falling back
   * to one store: a fallback here is how the original defect would come back unnoticed. */
  if (!Array.isArray(corpus) || !corpus.length) {
    throw new Error('speciesShares(corpus): the covariate-shift correction must be measured on the '
      + 'games the fit actually uses. Pass loadCorpus().games.');
  }
  const openG = corpus;
  for (const g of Q.loadGames()) if (!g.openSheet) closedG.push(g);
  const O = count(openG), C = count(closedG);
  const ratio = {};
  for (const sp of new Set([...Object.keys(O.c), ...Object.keys(C.c)])) {
    const o = (O.c[sp] || 0) / Math.max(1, O.n);
    const c = (C.c[sp] || 0) / Math.max(1, C.n);
    /* A species absent from one side gets no ratio; those decisions keep weight 1 rather than 0 or
     * infinity, so the correction never deletes or explodes a slice of the sample. */
    ratio[sp] = (o > 0 && c > 0) ? c / o : 1;
  }
  return { ratio, openGames: O.n, closedGames: C.n };
}

/* THE ILLUSION CLOSET — one predicate, one label, both used everywhere so the exclusion cannot be
 * applied in one place and reported in another. CLAUDE.md: one implementation, everyone calls it.
 *
 * SPECIES, NOT ABILITY. A sheet may declare Illusion and never bring the Zoroark; a sheet we cannot
 * read still corrupts the game. Only two lines carry Illusion in this format and both are tested by
 * name-stem, so a forme added later (Zoroark-Hisui already exists) is caught without an edit. */
const ILLUSION_SPECIES = /zoroark|zorua/i;
const ILLUSION_KEY = 'illusion_closeted (Zoroark/Zorua present — the protocol names the disguise, not '
                   + 'the mover, so every click is mis-attributed). TEMPORARY, ROADMAP #67: model '
                   + 'Illusion, then re-admit with ILLUSION_IN=1 and REFIT.';
function hasIllusionSpecies(g) {
  if (!g) return false;
  for (const side of ['p1', 'p2']) {
    const sheet = g.sheets && g.sheets[side];
    if (!sheet) continue;
    /* the sheet's shape has moved before, so test whatever it is rather than assuming an array of
     * objects — a structural assumption here would fail SILENTLY and closet nothing. */
    if (ILLUSION_SPECIES.test(typeof sheet === 'string' ? sheet : JSON.stringify(sheet))) return true;
  }
  /* the brought team is not always in the sheet (a bo3 game carries three), so the whole record is
   * the fallback. Broad on purpose: a false positive costs one game, a false negative costs the
   * corpus a mis-attributed one, and those are not symmetric. */
  return ILLUSION_SPECIES.test(JSON.stringify(g));
}

function loadCorpus(opts) {
  const cfg = Q.config();
  /* THE BEHAVIOURAL BOT SET, WHICH THIS USED TO PASS AS `null`.
   *
   * Q.reasons takes it as a third argument and skips the check entirely without it, so the corpus
   * was screened only for accounts that ANNOUNCE themselves as bots. That is the exact filter the
   * project measured as inadequate: six unflagged accounts appearing in 52.2% of the games a
   * name-only check called clean, one of them playing 459 games with a single team.
   *
   * It let one game through out of 3,260 here, because those accounts' other games were already
   * being rejected as forfeits or partial brings. One game is nothing. A disabled check is not --
   * it would have gone on being disabled as the corpus grew. */
  const bots = Q.behaviouralBots(Q.readStore());
  const seen = new Set();
  const games = [];
  const rejected = {};
  /* NO_FORFEITS=1 — exclude every forfeited game, whatever the quality filter now says.
   *
   * On 2026-07-28 the forfeit rule was narrowed to "before any action", which readmitted 1,528
   * resignations and grew the clean corpus 35%. That was justified by measuring that the player who
   * quit was BEHIND on mons 86.8% of the time -- which establishes the OUTCOME is trustworthy. It
   * does not establish that the DECISIONS are representative, and this file fits a model of
   * decisions, not outcomes. Measured afterwards, they are not quite:
   *
   *     hit super effectively   23.1% completed   vs   20.4% in resignation games
   *     landed a KO             10.8%             vs    8.4%
   *
   * so 24.5% of the training decisions now come from games someone was on the way to conceding.
   * That may be worse PLAY or merely worse POSITIONS -- a losing player genuinely has fewer
   * super-effective options -- and this flag is how the two are told apart. Refit with it on, put
   * the result on the opposite side of the same battles as the build fitted without it, and the
   * head-to-head answers which. Nothing else changes between the two fits. */
  const NO_FORFEITS = !!process.env.NO_FORFEITS;
  /* DEFAULT ON, and the escape hatch exists so the re-admit measurement can be taken WITHOUT editing
   * this file — ROADMAP #67 has to compare both corpora, and a gap you must edit code to close is a
   * gap nobody closes. `ILLUSION_IN=1` puts them back. */
  const EXCLUDE_ILLUSION = process.env.ILLUSION_IN !== '1';
  const add = (g) => {
    if (!g || !g.openSheet || !g.sheets || !g.sheets.p1 || !g.sheets.p2) return;
    if (g.id && seen.has(g.id)) return;
    if (NO_FORFEITS && g.forfeit) { rejected.forfeit_excluded_by_flag = (rejected.forfeit_excluded_by_flag || 0) + 1; return; }
    /* ============ ZOROARK IS IN THE CLOSET, AND THE CLOSET HAS A LABEL ON IT ======================
     *
     * Will, 2026-08-11: *"if there is a zoroark in the game lets just set those games aside if we
     * truly cannot handle its presence"*, then: *"at some point we are going to have to have zoroark
     * in our engine but to start we can just put those in the closet."*
     *
     * WHAT ILLUSION DOES TO A CORPUS. Zoroark enters disguised as the LAST living Pokemon on its
     * bench, and the protocol names the disguise, not the Zoroark. So every move it clicks is filed
     * against a Pokemon that never moved. That is not noise we can average out — it manufactures
     * FALSE SET EVIDENCE for the impersonated body and hides the real one, and it flows straight into
     * `meta-usage.json`, into the set priors, and into XATU.
     *
     * MEASURED, NOT ESTIMATED: 386 of 12,314 bo3 games (3.13%) and 1,731 of 52,840 ladder games
     * (3.28%) contain a Zoroark or Zorua. Three percent is a cheap price for removing a source of
     * confidently-wrong data.
     *
     * THIS IS A DECLARED GAP, WHICH IS THE ONLY KIND THIS PROJECT ALLOWS — the same shape as
     * `RAW-STORE-OK` on Ditto's ability. It is COUNTED and it PRINTS: a filter that cannot say how
     * much it removed is indistinguishable from a filter that is not running, and this repo's
     * signature failure is a capability that is silently absent.
     *
     * IT IS TEMPORARY BY DECISION, NOT BY HOPE. ROADMAP #67 owns the real fix — model Illusion, then
     * re-admit these games and REFIT, because a corpus that changes size is a corpus that changes
     * answers. Until then the exclusion is stated everywhere the corpus is reported.
     *
     * NOT A NAME MATCH ON THE ABILITY. The sheet may declare Illusion, but a Zoroark that never
     * switched in still corrupts nothing — and one whose sheet we cannot read still corrupts
     * everything. The species is the reliable signal, so the species is what is tested. */
    if (EXCLUDE_ILLUSION && hasIllusionSpecies(g)) {
      rejected[ILLUSION_KEY] = (rejected[ILLUSION_KEY] || 0) + 1;
      return;
    }
    const why = Q.reasons(g, cfg, bots);
    if (why.length) { for (const r of why) rejected[r] = (rejected[r] || 0) + 1; return; }
    if (g.id) seen.add(g.id);
    games.push(g);
  };
  /* THREE SOURCES OF KNOWN CHOICE SETS, AND THEY ARE NOT EQUALLY GOOD.
   *
   *   games.bo3.jsonl     OUR OWN scrape of gen9championsvgc2026regmbbo3, whose ruleset carries
   *                       "Force Open Team Sheets" — so EVERY game in it publishes all six sets.
   *                       Same ladder, same regulation, same population as the closed store. This is
   *                       the best of the three and it was sitting unused while the fit ran on an
   *                       external archive.
   *   games.ladder.jsonl  the closed-sheet ladder, whose ruleset carries plain "Open Team Sheets" —
   *                       OPTIONAL, both players must agree. That is why only ~1% of it has sheets,
   *                       and those few are exactly the games usable here.
   *   games.ots.jsonl     the external VGC-Bench archive. Largest, but a different collection with a
   *                       different metagame (engine/corpus_shift.js measures it).
   *
   * All three are deduplicated by replay id and every one goes through quality.js. */
  /* OPEN TEAM SHEET ONLY. Will, 2026-08-05, twice and in capitals: "WE ONLY CARE ABOUT OPEN TEAM
   * SHEET GAMES AT THE MOMENT. CLOSED SHEET GAMES SHOULD NOT BE USED AT ALL" and "KEEP CLOSED SHEET
   * GAMES AS A RESERVOIR TO TRAIN FROM ONCE WE COMPLETE OPEN TEAM SHEETS."
   *
   * `games.ladder.jsonl` is DROPPED FROM THE FIT and NOT from disk. It holds 43,409 games and the
   * store is append-only by design — "store raw, analyse on top", and never design an analysis that
   * forces a re-pull. It is the reservoir for the closed-sheet phase, which comes after this one.
   *
   * It was contributing 268 games, 3.8% of the corpus: the ~1% of closed ladder games where both
   * players happened to agree to optional Open Team Sheets. Those 268 are a self-selected slice of a
   * population we are not currently targeting, and MAG's features need a sheet, so the other 43,141
   * could never have fed this fit anyway.
   *
   * `games.ots.jsonl` IS DROPPED TOO, and the reason is dates rather than sheets — it is open-sheet
   * and does not violate the instruction above. Measured on disk:
   *
   *     games.ots.jsonl   4,167 games   2026-06-18 -> 2026-06-21    4 distinct days
   *     games.bo3.jsonl   8,898 games   2026-07-23 -> 2026-08-05   14 distinct days
   *
   * The external VGC-Bench archive is a FOUR-DAY SNAPSHOT FROM MID-JUNE, seven weeks stale, and it
   * was 41.5% of the corpus. It is also a different collection with a different metagame —
   * engine/corpus_shift.js exists precisely to measure that shift and has never written an artifact,
   * so the size of the drift is unknown rather than small.
   *
   * What remains is the one on-distribution source: bo3 is OUR OWN scrape of the SAME ladder and the
   * SAME regulation, its ruleset carries "Force Open Team Sheets" so every game publishes all six
   * sets, it is current through today, and it grows hourly. It outnumbers the archive two to one.
   *
   * REVERSIBLE, and the way back is measured rather than remembered: put ots back only once
   * corpus_shift.js has written an artifact saying how far its metagame sits from ours. */
  /* THE SCOPE IS NOW NAMED, DECLARED IN THE RETURN, AND OVERRIDABLE — because the narrowing above is
   * a decision made FOR THE FIT, and it was silently inherited by a consumer that wanted the opposite.
   *
   * `engine/tag_dex.js` calls this same function to derive data/tags.json, which is a catalogue of
   * WHAT EXISTS rather than a training sample of what a good player does. Narrowing to bo3 cut its
   * sheet_entries 110,760 -> 78,480 and would have DELETED five entities from the engine's knowledge
   * — Serene Grace, Tinted Lens, Curious Medicine, Steely Spirit and Leppa Berry. Caught only because
   * a regeneration was DIFFED instead of accepted (ROADMAP #65).
   *
   * A CORPUS DECISION IS NOT LOCAL TO THE MODEL IT WAS MADE FOR. The default is unchanged, so all 46
   * existing call sites behave exactly as before and this carries no measurement risk; what changes is
   * that the choice is no longer invisible — the caller can ask for a different one, and the RESULT
   * says which one it got and which files it actually read.
   *
   * NOT DONE HERE, deliberately: making `scope` REQUIRED so every one of the 46 callers must state its
   * intent. That is the shape that ends this class of bug for good, and it is 46 judgement calls that
   * each silently move a measurement if made carelessly. It is its own careful pass, not a side effect
   * of this one. */
  const SCOPES = {
    fit: ['games.bo3.jsonl'],                                          /* the default: see the reasoning above */
    all: ['games.bo3.jsonl', 'games.ots.jsonl', 'games.ladder.jsonl'], /* everything on disk — for CATALOGUES, not fits */
  };
  const scope = (opts && opts.scope) || 'fit';
  const files = SCOPES[scope];
  if (!files) throw new Error(`fit_policy.loadCorpus: unknown scope "${scope}". Known: ${Object.keys(SCOPES).join(', ')}`);

  const read = [];
  for (const f of files) {
    const p = D('data', f);
    if (!fs.existsSync(p)) continue;
    read.push(f);
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let g; try { g = JSON.parse(line); } catch (e) { continue; }
      add(g);
    }
  }
  return { games, rejected, scope, files: read };
}

/* ---------------------------------------------------------------------------------------------
 * REPLAY -> DECISIONS
 *
 * Decisions in a turn are made SIMULTANEOUSLY, before any of that turn's events resolve, so the
 * board a decision is scored against is the board at the START of the turn. Collecting features
 * after applying the turn's own damage would let the model see the future — the single easiest way
 * to produce a fit that looks excellent and cannot be reproduced by a player.
 *
 * The one exception is mega evolution, applied before collection: a player commits to the mega as
 * part of the same choice, so the typing they were choosing with is the mega's.
 * ------------------------------------------------------------------------------------------- */
/* THE DROP MUST REACH EVERY ROW.
 *
 * `DROP=<feature>` fits as if a feature did not exist, and it does that by zeroing the column. A
 * decision's features get built in TWO places in this function -- a voluntary switch and a move --
 * and for one release only the move path zeroed it. A DROP fit therefore kept the real value on
 * every switch row. The column was not constant, so the optimiser happily fitted a coefficient to
 * what had become a proxy for "this row is a switch": `priorLogP` came out at -1.73 (SE 0.05) in a
 * fit whose entire purpose was its absence, with the OPPOSITE SIGN to the full model's +0.16.
 *
 * Consequences, both of which were published: the no-popularity arm of the popularity x greedy 2x2
 * was never a no-popularity model, and "dropping how often people click this makes MAG predict human
 * clicks BETTER" was measured on it.
 *
 * Every feature build now goes through this one function, and assertDropped() refuses to fit if any
 * row escaped it anyway. A drop that silently half-applies is worse than one that crashes. */
function featsFor(cands, user, board, side) {
  return cands.map(c => {
    const x = B.featuresFor(c, user, board, side, dex,
      c.switchTo ? B.PRIOR_FLOOR : priorFor(user.species, c.move.id));
    for (const i of DROP_IDX) x[i] = 0;
    return x;
  });
}

/* The check that makes the above fail loudly. A dropped column must be identically zero across the
 * whole corpus; anything else means a build path was missed. Refuse to fit rather than report. */
function assertDropped(rows) {
  if (!DROP_IDX.length) return;
  for (let k = 0; k < DROP_IDX.length; k++) {
    const i = DROP_IDX[k];
    let worst = 0, offending = 0;
    for (const r of rows) {
      for (const x of r.feats) {
        const v = Math.abs(x[i]);
        if (v > 0) { offending++; if (v > worst) worst = v; }
      }
    }
    if (offending) {
      console.error(`\nDROP=${DROP[k]} DID NOT APPLY. ${offending.toLocaleString()} candidate rows ` +
        `still carry a nonzero value (largest |x| = ${worst.toFixed(4)}).\n` +
        `A dropped feature must be identically zero everywhere or the fit gives it a coefficient ` +
        `for being a proxy of whichever rows escaped. Refusing to fit.`);
      process.exit(1);
    }
  }
  console.log(`  drop check ${DROP.join(', ')} is identically zero across all ` +
    `${rows.length.toLocaleString()} decisions`);
}

/* WHAT EACH CANDIDATE ACTUALLY WAS, carried alongside its feature row.
 *
 * The fit does not need this — it multiplies a matrix. Any question ABOUT the fit does: "how often
 * does this model predict the Protect family, against how often a human pressed it" cannot be asked
 * of a feature matrix alone, because nothing in the vector says which row was Protect.
 *
 * It is added HERE rather than in a second replay loop, which is the whole of R2 in
 * docs/ARTIFACT-ACCESS-RULES.md: callers differ by PARAMETER, never by re-implementation. The last
 * time this repository grew a second copy of the pair-decision replay the two drifted and the copy
 * that had not learned the spread rule threw away 70% of the pair fit's data. One reader, one extra
 * field, no second replay. */
function candIds(cands) {
  return cands.map(c => (c.switchTo ? 'switch:' + norm(c.switchTo) : (c.move && c.move.id) || ''));
}

/* DID THE CHANNEL ACTUALLY REACH THE BOARD. CLAUDE.md: a capability that cannot prove it ran is
 * assumed broken, and this one has now failed silently once in each direction.
 *
 * `setSheet` succeeding proves nothing. It writes into `board.sheet[side][baseSpecies(species)]`, and
 * `switchIn` reads it back out under a key computed the same way from a DIFFERENT string — the store's
 * normalised species on one side, the replay's `|switch|` name on the other. That is the
 * `venusaurmega` / `venusaur-mega` shape exactly: 67 writes, 0 matches, every read defaulting quietly.
 *
 * So the counter is taken at the point of USE — off the mon that `featuresFor` is about to be handed,
 * after the key round trip — and it counts the FOE actives too, because the columns the sheet moves
 * most (`switchSurvives1`, `diesBeforeMoving`, `killsThreat`) are questions about what the OPPONENT
 * has, not about the user. A zero here with a nonzero `sheetEntries` is precisely the bug class. */
function probeLive(tally, board, side, user) {
  if (!tally) return;
  tally.probedDecisions = (tally.probedDecisions || 0) + 1;
  if (user && user.ability) tally.liveUserAbility = (tally.liveUserAbility || 0) + 1;
  if (user && user.moves && user.moves.length) tally.liveUserMoves = (tally.liveUserMoves || 0) + 1;
  if (user && user.item) tally.liveUserItem = (tally.liveUserItem || 0) + 1;
  if (user && user.nature) tally.liveUserNature = (tally.liveUserNature || 0) + 1;
  const foe = side === 'p1' ? 'p2' : 'p1';
  for (const L of ['a', 'b']) {
    const f = board.slot(foe, L);
    if (!f || f.fainted) continue;
    tally.probedFoes = (tally.probedFoes || 0) + 1;
    if (f.ability) tally.liveFoeAbility = (tally.liveFoeAbility || 0) + 1;
    if (f.moves && f.moves.length) tally.liveFoeMoves = (tally.liveFoeMoves || 0) + 1;
  }
}

/* WHICH SHEET CHANNELS THE FIT IS ALLOWED TO SEE — an explicit, RECORDED part of the environment.
 *
 * Default is all four, which is what `engine/magnemite.js:522` passes. The knob exists for one
 * reason and it is not tuning: without it the CONTROL ARM for "what is the sheet channel worth"
 * requires an in-memory patch of this file, and a control arm that cannot be re-run from the command
 * line is a number nobody can check.
 *
 * `SHEET_CHANNELS=nature,item` reproduces the environment every weight vector before 2026-08-04 was
 * fitted in. It is a measurement setting; the shipped fit uses the default and the artifact records
 * which it was, so the 2026-08-04 defect — the fit and the player disagreeing about what the board
 * knows, with nothing in either file saying so — is visible in the artifact next time instead of
 * requiring somebody to diff two source lines. */
const SC = require('./sheet_channels.js');
const ALL_CHANNELS = SC.CHANNELS;
const SHEET_CHANNELS = SC.fromEnv(process.env.SHEET_CHANNELS, 'the fit');
const SEES = new Set(SHEET_CHANNELS);

/* `channels` OVERRIDES SHEET_CHANNELS FOR THIS ONE CALL, and it exists for a measurement reason
 * rather than a fitting one.
 *
 * The control arm for "what is the sheet channel worth" has to score the SAME decisions under a
 * two-channel board and a four-channel board. Running that as two processes with SHEET_CHANNELS set
 * differently looks equivalent and is not: `engine/tags.js` loads `data/tags.json` once per process
 * with no way to pin it, and on 2026-08-04 that file changed twice in fifteen minutes while ENGINE
 * worked. Two processes can therefore differ by the TAG DATABASE as well as by the channel set, and
 * the run would not say so — which is the WOBBUFFET failure exactly: nothing in frame may move.
 *
 * One process, one require cache, one tag DB, both arms. Defaulted, so all seven existing callers are
 * unaffected. */
/* THE CENSORING COUNTERS. A capability that cannot prove it ran is assumed broken, and this one is
 * a REMOVAL — the easiest kind to have never fired. Both are broken out by mechanism so a zero on
 * one arm is visible rather than hidden inside a total. */
function bumpCoerced(tally, why, by) {
  if (!tally) return;
  tally.coerced = (tally.coerced || 0) + 1;
  tally.coercedWhy = tally.coercedWhy || {};
  tally.coercedWhy[why] = (tally.coercedWhy[why] || 0) + 1;
  tally.coercedBy = tally.coercedBy || {};
  tally.coercedBy[by] = (tally.coercedBy[by] || 0) + 1;
}
function bumpPartial(tally, why, drawnBy, size) {
  if (!tally) return;
  tally.partial = (tally.partial || 0) + 1;
  tally.partialWhy = tally.partialWhy || {};
  tally.partialWhy[why] = (tally.partialWhy[why] || 0) + 1;
  tally.partialBy = tally.partialBy || {};
  tally.partialBy[drawnBy] = (tally.partialBy[drawnBy] || 0) + 1;
  tally.partialSetSize = tally.partialSetSize || {};
  tally.partialSetSize[size] = (tally.partialSetSize[size] || 0) + 1;
}

/* `opts.keepCoerced` EMITS the coerced rows instead of dropping them, tagged `row.coerced`.
 *
 * It exists for exactly one caller — engine/censoring_value.js, which has to score the BEFORE arm
 * (coerced rows fitted with their wrong label) and the AFTER arm (coerced rows gone) on rows built
 * in ONE pass of ONE process. Building them twice would be two replays and two chances to differ;
 * building the before-arm in a separate process would let something move in between, which is the
 * failure the engine release exists to prevent. A PARAMETER, never a second copy.
 * Every other caller gets the default and never sees a coerced row. */
/* `CENSORING=off` FITS THE OLD WAY ON THE NEW CORPUS, and it exists for one reason: a control.
 *
 * The incumbent vector and the post-fix vector were fitted on corpora 86 games apart, because the
 * collector never stops. So "the new weights behave differently on coerced turns" has FOUR possible
 * causes — the coerced removal, the partial-label EM, the extra games, and the refit itself — and
 * docs/MEASURE.md keeps finding exactly that confound in other people's work. With this set, an arm
 * exists that differs from the shipped one ONLY in the treatment of the censoring.
 *
 * It is a MEASUREMENT SETTING, in the same shape as SHEET_CHANNELS, and it is recorded in the
 * artifact so a control arm can never be mistaken for a shipped one. */
const CENSORING_OFF = process.env.CENSORING === 'off';
if (CENSORING_OFF) {
  console.log('CENSORING=off — coerced actions are KEPT with their recorded label and partial rows');
  console.log('  are fitted as certain. This is the CONTROL ARM, not a shippable fit.\n');
}

function decisionsFor(g, tally, channels, opts) {
  const keepCoerced = !!(opts && opts.keepCoerced) || CENSORING_OFF;
  const chan = channels || SHEET_CHANNELS;
  const out = [];
  const board = new B.Board();

  /* WHOSE MOVESET IS THIS. Keyed by SIDE as well as species, and folded through the dex's own
   * formes, by engine/click_match.js — because `sheet[base(species)]` carries no side and Species
   * Clause is per PLAYER, so in a mirror one player's set silently overwrote the other's. Measured
   * 2026-08-02 by engine/redirect_audit.js: 58.63% of corpus games carry a species on both sheets,
   * 8.02% of all slots were scored against the opponent's four moves, and 62.16% of those MATCHED
   * ANYWAY and were fitted against the wrong choice set. That is a wrong DENOMINATOR — the same
   * defect the choice-lock note in board.js describes — and nothing counted it. */
  const SI = CM.sheetIndex(g, dex);
  for (const side of ['p1', 'p2']) {
    for (const m of g.sheets[side] || []) {
      if (m && m.species) {
        /* ALL FOUR CHANNELS, BECAUSE THE PLAYER READS ALL FOUR.
         *
         * This passed `{nature, item}` while `engine/magnemite.js:522` — the thing that actually
         * plays — passes `{nature, item, ability, moves}`, off the same `|showteam|` line. `ability`
         * and `moves` were sitting in the very object this loop already reads `nature` and `item`
         * from, and 100.0% of 14,400 sheet entries over 1,200 games declare both.
         *
         * `Board.switchIn` copies all four onto the mon and `dmgMon`, `effAbility` and `movePriority`
         * read them, so the fit was pricing **50.47% of its decisions** against a board the player
         * never sees — 20 of 58 feature columns, 99.75% of games. The choice set was identical game
         * for game; only what the board KNEW differed.
         *
         * That is CLAUDE.md's fitting-environment rule broken a second time and in the OPPOSITE
         * direction from 2026-07-28, which is exactly why nothing was watching: back then the fit saw
         * MORE than the bot, so the bot underperformed its training. Here the bot sees more than the
         * fit, which cannot make it look broken in any self-play comparison — both sides of every
         * head-to-head share the handicap and it cancels out.
         *
         * Will, 2026-08-04: *"MAG NEEDS TO BE OPEN TEAM SHEETS ALWAYS. WE WILL SOLVE CLOSED TEAM
         * SHEETS LATER."* So this is deliberately NOT hedged into a probability. The known cost is
         * the Focus Sash lesson: an opponent who declines OTS now leaves MAG fitted on a channel it
         * does not have, and Knock Off, Trick and a consumed berry stale the declared item mid-battle
         * even when the sheet WAS shown. Both are real and both are deferred by decision. */
        const info = SC.pick(m, chan);
        board.setSheet(side, m.species, info);
        if (tally) {
          tally.sheetEntries = (tally.sheetEntries || 0) + 1;
          if (info.ability) tally.sheetAbility = (tally.sheetAbility || 0) + 1;
          if (info.moves.length) tally.sheetMoves = (tally.sheetMoves || 0) + 1;
        }
      }
    }
  }
  for (const side of ['p1', 'p2']) {
    /* THE BENCH, so a switch is a candidate at all. Without it board.bench() is empty and every
     * switch decision below silently finds nothing to match against -- the feature would be dead
     * weight in the vector rather than obviously broken. */
    board.setParty(side, ((g.brought || {})[side] || []));
    const lead = (g.lead || {})[side] || [];
    if (lead[0]) board.switchIn(side, 'a', lead[0]);
    if (lead[1]) board.switchIn(side, 'b', lead[1]);
  }

  /* WHICH TURN AND WHICH SLOT, carried on every row. Purely additive -- the fit ignores these and
   * every existing caller is unaffected -- but without them a decision cannot be paired with the
   * other decision its player made on the same turn, and a VGC turn is a JOINT choice of two.
   * engine/opponent_recall.js needs that pairing to ask what the opponent's whole turn was, which is
   * the branching that actually costs (~51 joint actions a side, not ~7). Tagging here rather than
   * re-walking the replay elsewhere: this function's turn ordering, forced-switch detection and
   * board resolution are subtle, and a second copy of them would drift. */
  let turnIx = 0;
  for (const t of g.turns || []) {
    const ev = t.ev || [];
    turnIx++;
    for (const e of ev) {
      if (e.t !== 'mega' || !e.s) continue;
      const mon = board.slot(e.s.slice(0, 2), e.s.slice(2));
      if (mon) { mon.species = norm(e.mon); }
    }

    /* WHICH SWITCHES WERE A CHOICE. A `t:'s'` covers two different acts: a player deciding to pull
     * something out, and a player being made to replace something that just fainted. Only the first
     * is a decision, and scoring the second would teach the model that switching follows death.
     * A slot whose occupant fainted EARLIER IN THE SAME TURN was forced. */
    const forcedSlot = new Set();
    for (const e of ev) {
      if (e.t === 'f' && e.s) forcedSlot.add(e.s);
      else if (e.t === 's' && e.s && forcedSlot.has(e.s)) forcedSlot.add(e.s + '|used');
    }

    /* ---- WHICH RECORDED ACTIONS ARE NOT CLICKS ------------------------------------------------
     * docs/CLICK-CENSORING-FIX.md Stage B. Two classes are today KEPT WITH A WRONG LABEL, which is
     * strictly worse than dropping them (Natarajan et al. 2013): the Encore application turn, whose
     * forced move is on the victim's own menu so the matcher is happy; and a `|drag|`, which
     * engine/durable-ingest.js stores with the same `t:'s'` shape as a click, so the voluntary-switch
     * branch below scores a phazed arrival as a decision. `forcedSlot` only knows about faints.
     *
     * Derived from the running format (onOverrideAction / forceSwitch), never a typed list. */
    const coerced = CC.coercedSlots(ev, dex);
    const redirect = CC.redirectorsUp(ev, dex);

    /* INDEXED, because resolving a recorded target needs to know which switches had already
     * happened when this event went off. */
    for (let evIx = 0; evIx < ev.length; evIx++) {
      const e = ev[evIx];
      if (e.t === 's' && e.s && !forcedSlot.has(e.s)) {
        /* A voluntary switch, scored against the same candidate list the moves are scored against --
         * the whole point is that "bring Torkoal in" competes with "click Earthquake" rather than
         * being decided separately by a coin, which is what happens today. */
        tally.seen++;
        const co = coerced.get(e.s);
        if (co && !keepCoerced) { bumpCoerced(tally, co.why, co.by); continue; }
        const side = e.s.slice(0, 2), letter = e.s.slice(2);
        const user = board.slot(side, letter);
        if (!user || user.fainted) { tally.noUser++; continue; }
        const sh = SI.get(side, user.species);
        if (!sh) { tally.noSheet++; continue; }
        const cands = B.candidates(sh.moves, user, board, side, dex);
        if (cands.length < 2) { tally.trivial++; continue; }
        const idx = CM.matchClick(cands, { kind: 'switch', to: base(e.mon) }, dex).chosen;
        if (idx < 0) { tally.unmatched++; continue; }
        probeLive(tally, board, side, user);
        const feats = featsFor(cands, user, board, side);
        const srow = { game: g.id || '', turn: turnIx, side, slot: letter, sp: base(user.species), feats, chosen: idx, mvs: candIds(cands) };
        if (co) { srow.coerced = co.why; bumpCoerced(tally, co.why, co.by); }
        out.push(srow);
        tally.kept++;
        continue;
      }
      if (e.t !== 'm' || !e.s || !e.mon || !e.mv) continue;
      tally.seen++;
      const co = coerced.get(e.s);
      if (co && !keepCoerced) { bumpCoerced(tally, co.why, co.by); continue; }
      const side = e.s.slice(0, 2), letter = e.s.slice(2);
      const user = board.slot(side, letter);
      if (!user || user.fainted) { tally.noUser++; continue; }
      const sh = SI.get(side, e.mon);
      if (!sh) { tally.noSheet++; continue; }

      const cands = B.candidates(sh.moves, user, board, side, dex);
      if (cands.length < 2) { tally.trivial++; continue; }

      /* Which candidate did they actually pick? engine/click_match.js, so this file and
       * engine/joint_rows.js cannot drift apart again — they did on 2026-08-01, and the copy that
       * had not learned the spread rule threw away 70% of the pair fit's data.
       *
       * THE TARGET IS RESOLVED BACK THROUGH THE TURN'S OWN SWITCHES. A human aims at a SLOT; the
       * store records the SPECIES that was standing in it after the turn resolved, and switches
       * resolve before moves. Measured 2026-08-02: that single mismatch is 44.37% of every failed
       * match, far and away the largest cause, and it is why "23% of clicks are unmatchable, mostly
       * redirection" was wrong — redirection is 1.60% of it. */
      const foe = side === 'p1' ? 'p2' : 'p1';
      const want = { kind: 'move', mv: e.mv, tgt: e.tgt || null };
      const m = CM.matchClick(cands, want, dex, CM.targetAtDecision(ev, evIx, foe, e.tgt, board));
      if (m.ambiguous) { tally.ambiguous++; continue; }
      if (m.chosen < 0) { tally.unmatched++; continue; }

      probeLive(tally, board, side, user);
      const feats = featsFor(cands, user, board, side);
      const row = { game: g.id || '', turn: turnIx, side, slot: letter, sp: base(e.mon), feats, chosen: m.chosen, mvs: candIds(cands) };
      if (co) { row.coerced = co.why; bumpCoerced(tally, co.why, co.by); }

      /* ---- STAGE C: THE OUTPLAYED TURNS KEEP THEIR HONEST UNCERTAINTY ------------------------
       * A redirected attack's recorded target is the redirector; the click was aimed at ONE of the
       * live foes and the protocol does not say which. Today that enters the fit as a CERTAIN label
       * on the redirector — MNAR mislabelling concentrated exactly on the turns where the opponent's
       * play worked. Cour, Sapp & Taskar (2011): the correct likelihood contribution is the marginal
       * over the candidate set, not a pick and not a drop.
       *
       * NOTE the correction to the spec's §1 table, measured rather than assumed: redirection does
       * NOT drop the turn. engine/redirect_audit.js established on 2026-08-02 that the redirector is
       * a perfectly legal candidate target, so the matcher finds it and is happy. It is a MISLABEL,
       * which makes this stage a poison fix as much as a recovery. */
      const liveFoes = board.field().filter(f => f.side === foe && !f.mon.fainted);
      const pt = CC.partialTarget(e, evIx, redirect, liveFoes, dex, board);
      if (pt) {
        const mvId = norm((dex.moves.get(e.mv) && dex.moves.get(e.mv).id) || e.mv);
        const foeSp = new Set(liveFoes.map(f => base(f.mon.species)));
        const set = [];
        for (let i = 0; i < cands.length; i++) {
          const c = cands[i];
          if (!c.move || norm(c.move.id) !== mvId) continue;
          if (!c.targetMon || !foeSp.has(base(c.targetMon.species))) continue;
          set.push(i);
        }
        /* A set of one is a certain label, not a partial. A set that lost the matched candidate
         * would be a bug rather than a partial, so it is refused rather than silently narrowed. */
        if (set.length > 1 && set.includes(m.chosen)) {
          /* Counted either way — the artifact must say how big the class is even in the control —
           * but the fit only SEES the candidate set when the treatment is on. */
          if (!CENSORING_OFF) row.cset = set;
          bumpPartial(tally, pt.why, pt.drawnBy, set.length);
        } else {
          tally.partialDegenerate = (tally.partialDegenerate || 0) + 1;
        }
      }
      out.push(row);
      tally.kept++;
    }

    /* ---- now resolve the turn ---------------------------------------------------------------- */
    for (const e of ev) {
      const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
      if (e.t === 's' && side) { board.switchIn(side, letter, e.mon); }
      else if (e.t === 'm' && side) {
        const user = board.slot(side, letter);
        const mv = dex.moves.get(e.mv);
        /* "It worked" offline means the setter was not already up. Nothing in the store says a move
         * failed, so this is the best available reading; it is applied identically by the live
         * player, whose |-fail| lines make it exact. The asymmetry is small and is in the direction
         * of the fit UNDER-counting dead moves, never over-counting them. */
        if (user && mv && mv.exists) {
          /* ROADMAP #254: a hazard lives on the side `move.target` names, not on the mover's.
           * B.sideFor is the one function that decides that; this used to decide it here. */
          const already = (mv.sideCondition && board.hasSide(B.sideFor(side, mv), mv.sideCondition)) ||
                          (B.fieldKey(mv) && board.hasField(B.fieldKey(mv)));
          B.noteMove(board, side, user, mv, !already);
        }
        /* Damage lands on the named species. The foe side is searched first because that is where a
         * move almost always points; a mirror match can still put it on the wrong slot, which is the
         * same ambiguity counted at choice time and is why `ambiguous` decisions are dropped. */
        /* ABSOLUTE WHEN THE STORE HAS IT, SUBTRACTION ONLY AS A FALLBACK.
         * Subtracting damage can only ever drift DOWNWARD, because healing was never recorded as an
         * event: no Leftovers tick, no Sitrus, no Regenerator, no residual burn. That is not a
         * theoretical worry, it was measured -- MAG's "guaranteed kill" was followed by an actual
         * death 56.5% of the time, because it was aiming at Pokemon it believed were nearly dead.
         * engine/durable-ingest.js now writes the absolute figure the protocol always stated, and
         * engine/reprocess.js rebuilt the store from the raw logs. 3,849 ladder games predate raw-log
         * archiving and cannot be rebuilt, so the old subtraction still runs for those. */
        if (e.tgt && (e.tgthp != null || e.dmg)) {
          const foeSide = side === 'p1' ? 'p2' : 'p1';
          let hit = false;
          for (const s of [foeSide, side]) {
            for (const L of ['a', 'b']) {
              const m2 = board.slot(s, L);
              if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) {
                m2.hp = e.tgthp != null ? Math.max(0, e.tgthp / 100)
                                        : Math.max(0, m2.hp - e.dmg / 100);
                hit = true; break;
              }
            }
            if (hit) break;
          }
        }
      }
      else if (e.t === 'x' && side) { const m2 = board.slot(side, letter); if (m2) m2.status = norm(e.st); }
      /* Healing and chip damage — Sitrus, Leftovers, Regenerator, burn, sandstorm, Life Orb, Rocky
       * Helmet. Nobody's move, so they cannot ride on one, and before the store carried them every
       * replay in this project believed the board was more damaged than it was. */
      else if (e.t === 'hp' && side) { const m2 = board.slot(side, letter); if (m2 && e.hp != null) m2.hp = Math.max(0, e.hp / 100); }
      /* Stat stages, absolute -- Intimidate, Snarl, Icy Wind, Swords Dance. Written as a whole set
       * by the ingest rather than as a delta, so a dropped event cannot corrupt everything after it. */
      else if (e.t === 'b' && side) { const m2 = board.slot(side, letter); if (m2 && e.b) m2.boosts = { ...e.b }; }
      else if (e.t === 'f' && side) { board.faint(side, letter); }
      else if (e.t === 'w' && e.field) { board.setWeather(e.field); }
      else if (e.t === 'fs' && e.field) {
        const mv = dex.moves.get(e.field);
        const k = mv && mv.exists ? B.fieldKey(mv) : norm(e.field);
        if (k) board.startField(k, mv && mv.condition && mv.condition.duration);
      }
    }
    board.endTurn();
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * CONDITIONAL LOGIT
 * ------------------------------------------------------------------------------------------- */
/* PARTIAL ROWS SCORE THE MARGINAL, NOT A PICK.
 *
 * For a row carrying `cset` — a candidate set guaranteed to contain the true click — the likelihood
 * contribution is log Σ_{c∈cset} P(c), and "top-1" means the argmax landed INSIDE the set. For an
 * ordinary row cset is absent and both reduce to the usual quantities exactly, so every existing
 * caller and every previously published number is unchanged on a corpus with no partial rows.
 *
 * `PARTIAL_MODE='pick'` scores a partial row the OLD way — as a certain label on the matched
 * candidate. That is the control arm: it is how a comparison of two weight vectors can be run on
 * identical rows with only the treatment of the censoring differing. A control that requires editing
 * this file is not a control. */
function logLik(rows, w, opts) {
  const asPick = !!(opts && opts.pick);
  let ll = 0, correct = 0;
  for (const r of rows) {
    let max = -Infinity, bestI = 0;
    const s = new Array(r.feats.length);
    for (let j = 0; j < r.feats.length; j++) {
      let v = 0; const f = r.feats[j];
      for (let k = 0; k < w.length; k++) v += w[k] * f[k];
      s[j] = v;
      if (v > max) { max = v; bestI = j; }
    }
    let z = 0;
    for (let j = 0; j < s.length; j++) z += Math.exp(s[j] - max);
    const cset = (!asPick && r.cset && r.cset.length > 1) ? r.cset : null;
    if (cset) {
      let num = 0;
      for (const c of cset) num += Math.exp(s[c] - max);
      ll += Math.log(num) - Math.log(z);
      if (cset.includes(bestI)) correct++;
    } else {
      ll += (s[r.chosen] - max) - Math.log(z);
      if (bestI === r.chosen) correct++;
    }
  }
  return { ll: ll / Math.max(1, rows.length), acc: correct / Math.max(1, rows.length) };
}

/* `useIW` estimates on the IMPORTANCE-WEIGHTED sample — each decision counted in proportion to how
 * much more or less common its acting species is in closed-sheet play. Evaluation is always
 * unweighted; the question this answers is "do the estimated weights move when the open-sheet
 * metagame is reweighted to look like the closed one", which is a question about the estimate, not
 * about held-out fit. */
/* STANDARD ERRORS ON THE FITTED WEIGHTS.
 *
 * Every other model in this project ships a confidence interval and this one shipped a bare vector,
 * which also meant the covariate-shift check had nothing to judge "did the weights move" against —
 * it compared the shift to a hand-typed 0.25, exactly the invented constant S12/S13 forbid.
 *
 * For conditional logit the observed information is available in closed form. With p_ij the fitted
 * choice probabilities and xbar_i = sum_j p_ij x_ij,
 *
 *     H = sum_i sum_j p_ij (x_ij - xbar_i)(x_ij - xbar_i)'
 *
 * and the covariance of the estimate is H^-1. One pass, a 12x12 inverse, and every weight gets a
 * standard error — so "this weight moved" becomes a question with a scale rather than a taste. */
function standardErrors(rows, w, nf) {
  const H = Array.from({ length: nf }, () => new Array(nf).fill(0));
  for (const r of rows) {
    const s = new Array(r.feats.length);
    let max = -Infinity;
    for (let j = 0; j < r.feats.length; j++) {
      let v = 0; const f = r.feats[j];
      for (let k = 0; k < nf; k++) v += w[k] * f[k];
      s[j] = v; if (v > max) max = v;
    }
    let z = 0;
    for (let j = 0; j < s.length; j++) { s[j] = Math.exp(s[j] - max); z += s[j]; }
    const xbar = new Array(nf).fill(0);
    for (let j = 0; j < s.length; j++) {
      const p = s[j] / z, f = r.feats[j];
      for (let k = 0; k < nf; k++) xbar[k] += p * f[k];
    }
    for (let j = 0; j < s.length; j++) {
      const p = s[j] / z, f = r.feats[j];
      const d = new Array(nf);
      for (let k = 0; k < nf; k++) d[k] = f[k] - xbar[k];
      for (let a = 0; a < nf; a++) {
        if (!d[a]) continue;
        for (let b = 0; b < nf; b++) H[a][b] += p * d[a] * d[b];
      }
    }
  }
  /* Gauss-Jordan inverse of a small symmetric matrix; a tiny ridge keeps it invertible if a feature
   * is degenerate in this sample rather than throwing on it. */
  const n = nf;
  const A = H.map((row, i) => row.slice().concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let i = 0; i < n; i++) A[i][i] += 1e-9;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r2 = c + 1; r2 < n; r2++) if (Math.abs(A[r2][c]) > Math.abs(A[piv][c])) piv = r2;
    if (Math.abs(A[piv][c]) < 1e-12) return new Array(nf).fill(NaN);
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
    for (let r2 = 0; r2 < n; r2++) {
      if (r2 === c) continue;
      const f = A[r2][c];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) A[r2][j] -= f * A[c][j];
    }
  }
  return Array.from({ length: nf }, (_, k) => Math.sqrt(Math.max(0, A[k][n + k])));
}

/* EM OVER THE PARTIAL LABELS (Dempster, Laird & Rubin 1977; Cour, Sapp & Taskar 2011).
 *
 * The marginal log-likelihood of a partial row is log Σ_{c∈C} p_c, whose gradient is
 *
 *     Σ_{c∈C} q_c x_c  −  E_p[x]        with  q_c = p_c / Σ_{c'∈C} p_{c'}
 *
 * — the E-step (recompute q under the current w) and the M-step (one gradient step of the ordinary
 * conditional logit on rows weighted by q) are literally these two lines. Because the M-step here is
 * itself iterative, running one gradient step per E-step is Generalized EM (Neal & Hinton 1998), and
 * it has the same fixed point as the nested version at a fraction of the cost.
 *
 * `opts.pick` fits partial rows the OLD way, as a certain label on the matched candidate. That is
 * the control arm and it is a PARAMETER, not a second copy of this function.
 */
function fit(rows, nf, lambda, iters, useIW, opts) {
  const asPick = !!(opts && opts.pick);
  const w = new Array(nf).fill(0);
  const m = new Array(nf).fill(0), v = new Array(nf).fill(0);
  const lr = 0.05, b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let mass = 0;
  for (const r of rows) mass += useIW ? (r.iw || 1) : 1;
  for (let it = 1; it <= iters; it++) {
    const g = new Array(nf).fill(0);
    for (const r of rows) {
      const iw = useIW ? (r.iw || 1) : 1;
      const s = new Array(r.feats.length);
      let max = -Infinity;
      for (let j = 0; j < r.feats.length; j++) {
        let x = 0; const f = r.feats[j];
        for (let k = 0; k < nf; k++) x += w[k] * f[k];
        s[j] = x; if (x > max) max = x;
      }
      let z = 0;
      for (let j = 0; j < s.length; j++) { s[j] = Math.exp(s[j] - max); z += s[j]; }
      const cset = (!asPick && r.cset && r.cset.length > 1) ? r.cset : null;
      if (cset) {
        /* E-step: responsibilities over the candidate set, under the CURRENT weights. */
        let qz = 0;
        for (const c of cset) qz += s[c];
        for (const c of cset) {
          const q = s[c] / qz, fc2 = r.feats[c];
          for (let k = 0; k < nf; k++) g[k] += iw * q * fc2[k];
        }
      } else {
        const fc = r.feats[r.chosen];
        for (let k = 0; k < nf; k++) g[k] += iw * fc[k];
      }
      for (let j = 0; j < s.length; j++) {
        const p = s[j] / z, f = r.feats[j];
        for (let k = 0; k < nf; k++) g[k] -= iw * p * f[k];
      }
    }
    for (let k = 0; k < nf; k++) {
      let gk = g[k] / mass - lambda * w[k];
      m[k] = b1 * m[k] + (1 - b1) * gk;
      v[k] = b2 * v[k] + (1 - b2) * gk * gk;
      const mh = m[k] / (1 - Math.pow(b1, it)), vh = v[k] / (1 - Math.pow(b2, it));
      w[k] += lr * mh / (Math.sqrt(vh) + eps);
    }
  }
  return w;
}

/* DROP=<feature>  fit as if that feature did not exist.
 *
 * Zeroing a column and REFITTING is not the same as zeroing a fitted weight: the rest of the vector
 * re-optimises around the absence, which is the only way to ask "how much was this actually adding"
 * rather than "how crippled is the model without it".
 *
 * The one worth asking about is priorLogP -- "how often people click this move". It is the single
 * feature that is NOT a fact about the game, it is the largest swing in the model, and it is exactly
 * the imitation ceiling everything else in this project keeps running into. */
const DROP = (process.env.DROP || '').split(',').map(s2 => s2.trim()).filter(Boolean);
const DROP_IDX = DROP.map(f => B.FEATURE_INDEX[f]).filter(i => i != null);
if (DROP.length) {
  if (DROP_IDX.length !== DROP.length) { console.error(`unknown feature in DROP=${DROP}`); process.exit(1); }
  console.log(`DROPPING ${DROP.join(', ')} — refitting everything else around the absence
`);
}

function main() {
  const ITERS = +arg('--iters', 300);
  console.log('FIT POLICY — how much does a human move choice depend on the board?\n');

  const { games, rejected } = loadCorpus();
  if (!games.length) { console.error('no clean open-sheet games found'); process.exit(1); }
  const rej = Object.entries(rejected).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(', ');
  console.log(`  corpus     ${games.length.toLocaleString()} clean open-sheet games`);
  console.log(`  rejected   ${rej}`);

  const tally = { seen: 0, kept: 0, noUser: 0, noSheet: 0, trivial: 0, unmatched: 0, ambiguous: 0,
                  coerced: 0, partial: 0 };
  let rows = [];
  /* WHEN each game was played, kept beside the decisions so a TIME-based holdout is possible at all.
   * A decision row carries a game id and no date; this loop is the one place both are in scope. */
  const dateOf = new Map();
  for (const g of games) {
    if (g.id) dateOf.set(g.id, String(g.date || ''));
    rows = rows.concat(decisionsFor(g, tally));
  }
  console.log(`  decisions  ${tally.seen.toLocaleString()} seen -> ${tally.kept.toLocaleString()} usable`);
  console.log(`             dropped: ${tally.trivial.toLocaleString()} had only one candidate (no information), ` +
              `${tally.noSheet.toLocaleString()} species not on a sheet, ${tally.unmatched.toLocaleString()} click not matched, ` +
              `${tally.ambiguous.toLocaleString()} target ambiguous (mirror), ${tally.noUser.toLocaleString()} no active user`);
  /* ---- THE CENSORING COUNTERS, PRINTED, AND A ZERO CALLED OUT ------------------------------- */
  const nPartialRows = rows.filter(r => r.cset && r.cset.length > 1).length;
  console.log(`  censoring  ${(tally.coerced || 0).toLocaleString()} COERCED actions removed from the labeled set ` +
    `(${JSON.stringify(tally.coercedWhy || {})}), ` +
    `${nPartialRows.toLocaleString()} PARTIAL rows kept under the marginal likelihood ` +
    `(${JSON.stringify(tally.partialWhy || {})})`);
  for (const [k, n] of [['coerced', tally.coerced || 0], ['partial', CENSORING_OFF ? (tally.partial || 0) : nPartialRows]]) {
    if (!n) {
      console.error(`\n  ZERO ${k.toUpperCase()} ACTIONS OVER ${games.length.toLocaleString()} GAMES.`);
      console.error('  engine/click_class.js derives its mechanism sets from the running format, so a zero here');
      console.error('  means the classifier never fired, not that the metagame stopped using Encore and Follow Me.');
      console.error('  Refusing to fit — see docs/CLICK-CENSORING-FIX.md Stage A/B.');
      process.exit(1);
    }
  }
  if (rows.length < 500) { console.error('too few decisions to fit'); process.exit(1); }

  /* THE FITTING ENVIRONMENT, PROVED RATHER THAN ASSERTED, AND IT REFUSES TO FIT IF THE PROOF FAILS.
   *
   * Printing a rate is not enough on its own — `tests/test-docs-current.js` was red on every run for
   * two days and got reported as known. So a requested channel that reaches ZERO boards is fatal
   * here, in the generator, where the only way past it is to fix it. */
  const pc = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
  console.log(`  sheet      channels ${SHEET_CHANNELS.join(',')} — ` +
    `${(tally.sheetEntries || 0).toLocaleString()} sheet entries set, ` +
    `${pc(tally.sheetAbility || 0, tally.sheetEntries || 0)} declare an ability, ` +
    `${pc(tally.sheetMoves || 0, tally.sheetEntries || 0)} declare moves`);
  console.log(`  reached    of ${(tally.probedDecisions || 0).toLocaleString()} scored decisions the USER mon carried ` +
    `nature ${pc(tally.liveUserNature || 0, tally.probedDecisions || 0)}, ` +
    `item ${pc(tally.liveUserItem || 0, tally.probedDecisions || 0)}, ` +
    `ability ${pc(tally.liveUserAbility || 0, tally.probedDecisions || 0)}, ` +
    `moves ${pc(tally.liveUserMoves || 0, tally.probedDecisions || 0)}`);
  console.log(`             of ${(tally.probedFoes || 0).toLocaleString()} live FOE actives beside them: ` +
    `ability ${pc(tally.liveFoeAbility || 0, tally.probedFoes || 0)}, ` +
    `moves ${pc(tally.liveFoeMoves || 0, tally.probedFoes || 0)}`);
  for (const [ch, n] of [['ability', tally.liveUserAbility || 0], ['moves', tally.liveUserMoves || 0]]) {
    if (SEES.has(ch) && n === 0) {
      console.error(`\nSHEET CHANNEL '${ch}' WAS SET ON ${(tally.sheetEntries || 0).toLocaleString()} SHEET ENTRIES AND ` +
        `REACHED 0 OF ${(tally.probedDecisions || 0).toLocaleString()} SCORED BOARDS.\n` +
        `setSheet writes under baseSpecies(store species); switchIn reads under baseSpecies(replay species).\n` +
        `A fit run now would silently be the pre-2026-08-04 two-channel fit wearing a four-channel label.\n` +
        `Refusing to fit.`);
      process.exit(1);
    }
  }
  assertDropped(rows);

  /* HELD OUT BY GAME, NOT BY DECISION. Decisions inside one game share teams, players and board, so
   * splitting by decision leaks the answer across the split and every model looks good. */
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  /* A TIME SPLIT, OPTIONAL, AND THE ONLY ONE THAT CAN ANSWER "DOES OLD DATA STILL HELP".
   *
   * The random-by-game split below answers "does this generalise to other games from the same
   * period", which is the right question for feature work and the WRONG one for recency: a June game
   * in the test set is predicted by June games in the training set, so staleness is invisible by
   * construction. The metagame moves — Kingambit went 2.87% -> 3.88% of usage between the June and
   * July Smogon months, Staraptor-Mega -0.96 the other way — so "train on the past, test on the
   * future" is a different and harder question, and it is the one a recency policy turns on.
   *
   *   HOLDOUT_SINCE=2026-08-01   games on or after this date are the TEST set, the rest train
   *   TRAIN_SINCE=2026-07-01     additionally drop training games older than this
   *
   * Two runs differing only in TRAIN_SINCE share the same test set exactly, which is what makes them
   * comparable. Without that they are two different questions with two different answers — the same
   * confound that made "greedy fails Sucker Punch 47.9%" wrong. */
  const HOLDOUT_SINCE = process.env.HOLDOUT_SINCE || '';
  const TRAIN_SINCE = process.env.TRAIN_SINCE || '';
  let train, test;
  if (HOLDOUT_SINCE) {
    const when = r => String(dateOf.get(r.game) || '').slice(0, 10);
    test = rows.filter(r => when(r) >= HOLDOUT_SINCE);
    train = rows.filter(r => { const d = when(r); return d && d < HOLDOUT_SINCE && (!TRAIN_SINCE || d >= TRAIN_SINCE); });
    const dropped = rows.length - train.length - test.length;
    console.log('  split      ' + train.length.toLocaleString() + ' train / ' + test.length.toLocaleString() +
      ' held out (BY TIME: test on/after ' + HOLDOUT_SINCE + (TRAIN_SINCE ? ', train from ' + TRAIN_SINCE : '') + ')');
    if (dropped) console.log('             ' + dropped.toLocaleString() + ' decision(s) dropped as older than TRAIN_SINCE or undated');
    if (!test.length || train.length < 500) {
      console.error('the time split left too little on one side to fit or to score. Refusing.');
      process.exit(1);
    }
    console.log('');
  } else {
    train = rows.filter(r => hash(r.game) % 5 !== 0);
    test = rows.filter(r => hash(r.game) % 5 === 0);
    console.log(`  split      ${train.length.toLocaleString()} train / ${test.length.toLocaleString()} held out (split by GAME)\n`);
  }

  const nf = B.FEATURES.length;
  const iPrior = B.FEATURE_INDEX.priorLogP;

  /* Baselines. `bot` is literally the current player: sample the behaviour clone, aim at random. */
  const wUniform = new Array(nf).fill(0);
  const wBot = new Array(nf).fill(0); wBot[iPrior] = 1;
  const base0 = logLik(test, wUniform);
  const baseBot = logLik(test, wBot);

  /* The regularisation strength is SELECTED on held-out likelihood, not chosen. */
  let best = null;
  for (const lambda of [0, 1e-5, 1e-4, 1e-3, 1e-2]) {
    const w = fit(train, nf, lambda, ITERS);
    const te = logLik(test, w);
    if (!best || te.ll > best.te.ll) best = { lambda, w, te, tr: logLik(train, w) };
  }

  console.log('HELD-OUT FIT (higher log-likelihood is better; 0 would be perfect prediction)\n');
  const line = (name, r) => console.log(`  ${name.padEnd(34)} logL/decision ${r.ll.toFixed(4).padStart(8)}   top-1 ${(100 * r.acc).toFixed(1).padStart(5)}%`);
  line('uniform over candidates', base0);
  line('behaviour clone alone (current bot)', baseBot);
  line('board-aware fit', best.te);
  console.log(`\n  regularisation selected on held-out data: lambda = ${best.lambda}`);
  console.log(`  in-sample logL ${best.tr.ll.toFixed(4)} against held-out ${best.te.ll.toFixed(4)} ` +
              `(a large gap here would mean the fit is memorising games, not learning play)`);

  /* ---- IS THE FIT AN ARTEFACT OF THE OPEN-SHEET METAGAME? ------------------------------------
   * Re-estimate on the sample reweighted to the closed-sheet species mix and compare the weights.
   * If they barely move, the composition shift does not bias the policy; if they move a lot, these
   * weights describe a metagame the bot does not play in. Automatic, so it is re-checked on every
   * refit rather than argued about once. */
  const SH = speciesShares(games);
  let iwSum = 0, iwN = 0;
  for (const r of rows) { r.iw = SH.ratio[r.sp] != null ? SH.ratio[r.sp] : 1; iwSum += r.iw; iwN++; }
  const iwMean = iwSum / Math.max(1, iwN);
  for (const r of rows) r.iw /= iwMean;
  let s1 = 0, s2 = 0;
  for (const r of train) { s1 += r.iw; s2 += r.iw * r.iw; }
  const ess = s2 > 0 ? (s1 * s1) / s2 : 0;
  const wIW = fit(train, nf, best.lambda, ITERS, true);
  const teIW = logLik(test, wIW);
  /* HOW MUCH EACH FEATURE ACTUALLY VARIES. A weight is only comparable to another weight if the two
   * things they multiply are on the same scale, and they are not: most features are 0/1 flags while
   * `eff` runs about -4..+2 and `priorLogP` about -7.6..0. Reporting raw weights side by side
   * therefore understates the wide-ranging features. The standard deviation of each feature across
   * every candidate in the corpus turns a weight into "how much this swings a score in practice",
   * which is the quantity a reader actually wants. */
  const spread = (() => {
    const n = new Array(nf).fill(0), mean = new Array(nf).fill(0), m2 = new Array(nf).fill(0);
    for (const r of rows) for (const f of r.feats) for (let k = 0; k < nf; k++) {
      n[k]++; const d = f[k] - mean[k]; mean[k] += d / n[k]; m2[k] += d * (f[k] - mean[k]);
    }
    return m2.map((v, k) => (n[k] > 1 ? Math.sqrt(v / (n[k] - 1)) : 0));
  })();

  const SE = standardErrors(train, best.w, nf);
  /* The shift is judged in STANDARD ERRORS, not against a number chosen here. 1.96 is the same
   * z the project already uses for every Wilson interval, so a shift inside it is a shift this
   * sample could not have distinguished from noise in the first place. */
  let maxMove = 0, whichMove = '', maxZ = 0, whichZ = '';
  for (let k = 0; k < nf; k++) {
    const d = Math.abs(wIW[k] - best.w[k]);
    if (d > maxMove) { maxMove = d; whichMove = B.FEATURES[k]; }
    const z = SE[k] > 0 ? d / SE[k] : 0;
    if (z > maxZ) { maxZ = z; whichZ = B.FEATURES[k]; }
  }
  console.log('\nCOVARIATE SHIFT — open-sheet teams are NOT closed-sheet teams');
  console.log(`  the two metagames differ in composition (engine/corpus_shift.js measures it), so the`);
  console.log(`  fit is re-estimated on a sample reweighted to the closed-sheet species mix.`);
  console.log(`  effective sample size after reweighting: ${Math.round(ess).toLocaleString()} of ${train.length.toLocaleString()} ` +
              `(${(100 * ess / Math.max(1, train.length)).toFixed(0)}% — a small number here would mean the correction ate the sample)`);
  console.log(`  largest weight change: ${whichMove} moved ${maxMove.toFixed(3)}`);
  console.log(`  largest change RELATIVE TO ITS OWN STANDARD ERROR: ${whichZ} at ${maxZ.toFixed(2)} SE`);
  console.log(`  held-out logL reweighted ${teIW.ll.toFixed(4)} against unweighted ${best.te.ll.toFixed(4)}`);
  /* WHICH VECTOR SHIPS.
   *
   * The bot plays in the CLOSED-sheet metagame — MEW samples its teams from the clean ladder store —
   * so when the correction moves a weight further than this sample can resolve, the reweighted
   * estimate is the one that describes the distribution the bot actually plays in. Shipping the
   * unweighted vector in that case would be knowingly fitting the wrong population.
   *
   * An earlier version of this check compared the shift to a hand-typed 0.25 and concluded "stable".
   * That was the invented constant S12/S13 forbid, and it was hiding a real effect: priorLogP has a
   * very tight standard error, so a small absolute move is a large one in the units that matter. */
  const material = maxZ >= 1.96;
  console.log(material
    ? '  -> MATERIAL: a weight moved further than this sample can resolve. The REWEIGHTED vector\n' +
      '     ships, because the bot plays in the closed-sheet metagame, not this one.'
    : '  -> every weight moved less than this sample can resolve; the unweighted vector ships.');
  if (material) {
    console.log('\n  the weights that actually moved (unweighted -> reweighted, in standard errors)');
    const moved = B.FEATURES.map((f, k) => ({ f, a: best.w[k], b: wIW[k], z: SE[k] > 0 ? Math.abs(wIW[k] - best.w[k]) / SE[k] : 0 }))
      .filter(r => r.z >= 1.96).sort((x, y) => y.z - x.z);
    for (const r of moved) {
      console.log(`    ${r.f.padEnd(12)} ${(r.a >= 0 ? '+' : '') + r.a.toFixed(3)} -> ${(r.b >= 0 ? '+' : '') + r.b.toFixed(3)}   ${r.z.toFixed(1)} SE`);
    }
  }
  const shipW = material ? wIW : best.w;

  const gain = best.te.ll - baseBot.ll;
  const accGain = 100 * (best.te.acc - baseBot.acc);
  console.log(`\n  Against the current bot: ${gain >= 0 ? '+' : ''}${gain.toFixed(4)} logL/decision, ` +
              `${accGain >= 0 ? '+' : ''}${accGain.toFixed(1)} points of top-1 accuracy.`);
  if (gain <= 0) {
    console.log('  NEGATIVE RESULT: reading the board did NOT predict human choices better than');
    console.log('  popularity alone. Do not ship these weights on the strength of this run.');
  }

  console.log('\nWHAT THE FIT LEARNED (weight per feature; sign and size are the interesting part)\n');
  const order = B.FEATURES.map((f, i) => [f, best.w[i], SE[i]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [f, wv, se] of order) {
    const lo = wv - 1.96 * se, hi = wv + 1.96 * se;
    const crosses = lo <= 0 && hi >= 0;
    console.log(`  ${f.padEnd(12)} ${(wv >= 0 ? '+' : '') + wv.toFixed(3)}   95% CI [${lo.toFixed(3)}, ${hi.toFixed(3)}]` +
      (crosses ? '   <- interval contains zero; this feature is not doing measurable work' : ''));
  }

  const out = {
    generated: new Date().toISOString(),
    features: B.FEATURES,
    weights: shipW,
    weights_unweighted: best.w,
    weights_reweighted_to_closed: wIW,
    shipped: material ? 'reweighted_to_closed' : 'unweighted',
    standardErrors: SE,
    spread,
    lambda: best.lambda,
    /* WHICH ARM THIS IS. `off` means the coerced actions were fitted with their recorded (wrong)
     * label and the partial rows as certain — the CONTROL for docs/CLICK-CENSORING-FIX.md Stage D.
     * A control arm that does not say so in its own file is one commit away from being shipped. */
    censoring: CENSORING_OFF ? 'off (CONTROL ARM — not shippable)' : 'on',
    corpus: { games: games.length, decisions: rows.length, train: train.length, test: test.length },
    /* HOW MUCH OF THE CORPUS THIS FIT ACTUALLY SAW, recorded rather than only printed.
     *
     * The run prints "194,711 seen -> 170,142 usable" and the breakdown, and then the number scrolls
     * past. `corpus.decisions` keeps only the USABLE count, so nothing downstream could compute a
     * drop RATE from the artifact -- which is exactly how fit_joint.js ran on 30% of its data for
     * weeks with the loss visible in its own output every single time.
     *
     * Recorded here so tests/test-degradation-budgets.js can hold it to a ceiling. Same shape as the
     * `matching` block fit_joint.js writes. */
    matching: {
      seen: tally.seen, kept: tally.kept, noUser: tally.noUser, noSheet: tally.noSheet,
      trivial: tally.trivial, unmatched: tally.unmatched, ambiguous: tally.ambiguous,
      /* docs/CLICK-CENSORING-FIX.md. `coerced` is a REMOVAL of wrong labels, not a drop of good
       * ones, and it has its own ceiling in data/degradation-budgets.json so the two can never
       * again be added together into one "turnsDropped" number that means two different things. */
      coerced: tally.coerced || 0,
      coercedWhy: tally.coercedWhy || {},
      coercedBy: tally.coercedBy || {},
      partial: nPartialRows,
      partialWhy: tally.partialWhy || {},
      partialBy: tally.partialBy || {},
      partialSetSize: tally.partialSetSize || {},
      partialDegenerate: tally.partialDegenerate || 0,
    },
    heldOut: {
      uniform: base0, behaviourCloneOnly: baseBot, boardAware: best.te,
      gain_logL: gain, gain_top1_points: accGain,
    },
    /* WHAT THE BOARD KNEW WHILE THIS WAS FITTED. The one thing this artifact could not say on
     * 2026-08-04, and the reason a two-channel fit shipped against a four-channel player for a week
     * without any check being able to see it. CLAUDE.md: fitting environment and playing environment
     * must match — so the fitting environment has to be written down somewhere a checker can read it.
     *
     * `player_passes` is not a copy of a source line; it is the list magnemite.js actually hands to
     * setSheet, and `matches_player` is the comparison. If someone adds a fifth channel to the player
     * and not to the fit, this flips to false in the artifact on the next refit. */
    fitEnvironment: {
      sheet_channels: SHEET_CHANNELS.slice(),
      player_passes: ALL_CHANNELS.slice(),
      matches_player: SC.isFull(SHEET_CHANNELS),
      sheet_entries_set: tally.sheetEntries || 0,
      sheet_entries_declaring_ability: tally.sheetAbility || 0,
      sheet_entries_declaring_moves: tally.sheetMoves || 0,
      /* Measured AT THE POINT OF USE, downstream of the setSheet -> switchIn key round trip. */
      reached_board: {
        decisions_probed: tally.probedDecisions || 0,
        user_nature: tally.liveUserNature || 0,
        user_item: tally.liveUserItem || 0,
        user_ability: tally.liveUserAbility || 0,
        user_moves: tally.liveUserMoves || 0,
        foe_actives_probed: tally.probedFoes || 0,
        foe_ability: tally.liveFoeAbility || 0,
        foe_moves: tally.liveFoeMoves || 0,
      },
      deferred_debt: 'Will, 2026-08-04: "MAG NEEDS TO BE OPEN TEAM SHEETS ALWAYS. WE WILL SOLVE ' +
        'CLOSED TEAM SHEETS LATER." Two costs are accepted, not hedged. (1) An opponent who declines ' +
        'OTS leaves these weights fitted on a channel the board does not have; ability and moves fall ' +
        'back to Smogon per-species odds and the dataset representative set, and nothing here measures ' +
        'how the weights degrade under that. (2) Knock Off, Trick and a consumed berry stale the ' +
        'DECLARED item and ability mid-battle even when the sheet WAS shown — prefer OBSERVED over ' +
        'DECLARED. board.sheetItem() is the observed-item hatch and switchIn does not use it.',
    },
    covariateShift: {
      note: 'Open-sheet TEAMS differ enormously from closed-sheet teams (551.9 points of total ' +
            'absolute species difference, engine/corpus_shift.js). Open-sheet BEHAVIOUR given a ' +
            'board does not (largest gap 1.49 points). This model is conditional on the board and ' +
            'never learns what to bring, so the composition gap changes which situations were ' +
            'sampled, not what was learned from them.',
      reweighted_max_weight_change: null,   // filled below
      effective_sample_size: null,
    },
    caveat: 'Fitted on open-team-sheet games, the only corpus where the CHOICE SET is known rather ' +
            'than guessed. Known unmodelled gaps: ability-based immunity and priority-blocking ' +
            'abilities (Armor Tail, Queenly Majesty) are invisible to the feature set, which ' +
            'computes immunity from TYPES only. Open-sheet players also average ~185 ' +
            'rating points lower, though measured move quality is close to flat in rating. ' +
            'THE OLD CAVEAT HERE — "~11% of clicks were dropped as unmatched, mostly redirection" — ' +
            'was wrong twice and is retracted: engine/redirect_audit.js measured redirection at ' +
            '1.60% of failed matches, and redirection does not DROP a click at all (the redirector ' +
            'is a legal candidate target, so it MISLABELS one). Both halves are now counted: ' +
            'matching.coerced and matching.partial. See docs/CLICK-CENSORING-FIX.md.',
  };
  out.covariateShift.reweighted_max_weight_change = { feature: whichMove, delta: maxMove };
  out.covariateShift.effective_sample_size = { ess: Math.round(ess), of: train.length };
  /* WHAT EACH FEATURE MEANT WHEN THESE WEIGHTS WERE FITTED.
   *
   * The feature LIST is already recorded above and magnemite.js refuses a mismatch. That guard
   * passed on 2026-08-01 while allyHit quietly changed meaning under an unchanged name, and every
   * weight in this file had been fitted against the old definition. Recording a hash of each
   * feature's values over a frozen fixture board makes that failure loud instead of silent.
   * engine/feature_fixture.js explains the fixture and its limits. */
  try {
    out.featureHashes = require('./feature_fixture.js').hashes(dex);
  } catch (e) {
    console.error(`\n  WARNING: could not compute feature-semantics hashes (${e.message}).`);
    console.error('  These weights will load, but nothing will detect a feature changing meaning under');
    console.error('  its own name. Fix engine/feature_fixture.js and restamp with --stamp.');
  }
  /* THE DEFAULT PATH IS WRITTEN ON ITS OWN LINE — see the note in engine/fit_joint.js. Routing every
   * write through `OUT` made this file's generator invisible to tests/test-site-data-fresh.js, and
   * data/policy-weights.json has been carried in data/site-data-orphans.json as "no generator" ever
   * since OUT_WEIGHTS was added. The shipped model file having no discoverable way to rebuild it is
   * exactly the condition that guard exists to report. */
  const payload = JSON.stringify(out, null, 1);
  if (process.env.OUT_WEIGHTS) fs.writeFileSync(OUT, payload);
  else fs.writeFileSync(D('data', 'policy-weights.json'), payload);
  console.log(`\n  -> ${path.relative(ROOT, OUT)}`);
}

if (require.main === module) main();
module.exports = { decisionsFor, logLik, fit, loadCorpus, priorFor, assertDropped, DROP, DROP_IDX,
  /* Exported so engine/joint_rows.js fits in the SAME environment within one process, rather than
   * parsing SHEET_CHANNELS a second time. See the note at its require site. */
  SHEET_CHANNELS, probeLive };
