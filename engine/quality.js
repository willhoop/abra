/* quality.js - the shared definition of a usable game (JavaScript side).
 *
 * There is ONE definition, in data/quality-filter.json. This module and engine/quality.py are thin
 * readers of that file; neither hard-codes a threshold. tests/test-quality.js asserts that both
 * readers select the IDENTICAL set of game ids, which is the only thing that stops the two drifting.
 *
 *   const Q = require('./quality.js');
 *   const games = Q.loadGames();            // clean only
 *   const all   = Q.loadGames({clean:false});
 *   console.log(Q.funnel());
 */
'use strict';
const fs = require('fs');
const path = require('path');

const STORE = path.join(__dirname, '..', 'data', 'games.ladder.jsonl');
const CONFIG = path.join(__dirname, '..', 'data', 'quality-filter.json');

/* Memoised. `reasons()` is called once per game, and re-reading + re-parsing the config file on each
 * call turned a 1-second filter into a multi-minute one. Cached after the first read. */
let _cfg = null;
function config() { if (!_cfg) _cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); return _cfg; }

/* Deduplicate by id, first occurrence wins - the same order-preserving rule as dedupe_store.py, so
 * an un-deduped file on disk cannot silently change a result. */
function readStore(p) {
  const seen = new Set(), out = [];
  for (const line of fs.readFileSync(p || STORE, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let g; try { g = JSON.parse(s); } catch (e) { continue; }
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

/* Accounts that BEHAVE like bots regardless of their name. The decisive signal is team invariance:
 * an account playing hundreds of games without ever changing a slot is running a script. Computed
 * once over the whole store, because it is a property of an ACCOUNT and not of a game. */
function behaviouralBots(games, cfg) {
  cfg = cfg || config();
  const r = cfg.rules.exclude_behavioural_bots;
  if (!r || !r.on) return new Set();
  const count = new Map(), teams = new Map();
  for (const g of games) {
    for (const s of ['p1', 'p2']) {
      const n = (g[s] || {}).name;
      if (!n) continue;
      count.set(n, (count.get(n) || 0) + 1);
      const six = ((g.six || {})[s] || []).slice().sort().join('|');
      if (six) { if (!teams.has(n)) teams.set(n, new Set()); teams.get(n).add(six); }
    }
  }
  const out = new Set();
  for (const [n, c] of count) {
    const t = teams.get(n);
    if (c >= r.min_games && t && t.size <= r.max_distinct_teams) out.add(n);
  }
  return out;
}

/* Did anything actually happen? One move or one switch is enough. Deliberately NOT a turn count:
 * a game can carry turn objects with no action in them, and the question the forfeit rule asks is
 * whether the players produced evidence, not how far the clock got. */
function hadAction(g) {
  for (const t of (g.turns || [])) {
    for (const e of (t.ev || [])) if (e.t === 'm' || e.t === 's') return true;
  }
  return false;
}

// every reason this game is unusable; empty means clean
function reasons(g, cfg, bots) {
  cfg = cfg || config();
  const r = cfg.rules, bad = [];
  if (r.exclude_bot_games.on && ((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot))) bad.push('bot');
  if (bots && ((g.p1 && bots.has(g.p1.name)) || (g.p2 && bots.has(g.p2.name)))) bad.push('behavioural_bot');
  /* A FORFEIT AFTER REAL PLAY IS A RESIGNATION, AND RESIGNATIONS ARE EVIDENCE.
   *
   * This rule used to drop every forfeit, on the stated rationale that "a forfeit records who quit,
   * not who was winning". That rationale was never tested, and it is false in this corpus. Of the
   * 1,528 open-sheet forfeits in which at least one action was taken, the player who quit was:
   *
   *     BEHIND on mons   1,326   86.8%
   *     even               189   12.4%
   *     AHEAD               13    0.9%
   *
   * -- a mean of 1.42 Pokemon down. People resign lost positions; they very rarely quit while
   * winning. Throwing those games away discarded the OUTCOME OF A DECIDED GAME, and it cost 72% of
   * the usable open-sheet corpus (2,114 -> 3,642) in the one regime MAG can actually be fitted on.
   *
   * WILL'S RULE, and it is sharper than a turn threshold: a forfeit BEFORE ANY ACTION does not
   * count, a forfeit after one does. It keys on whether a game happened rather than on an arbitrary
   * turn number. A player who disconnects at team preview produced no evidence about anything; a
   * player who led, traded damage and then conceded produced a result. Measured, only 4 of 1,532
   * forfeits fall on the discard side -- which is the point: the old rule was throwing away 1,528
   * decided games to exclude 4 undecided ones.
   *
   * THE RESIDUAL ERROR IS STATED: 13 games (0.9%) were forfeited by the player who was ahead on
   * material. Those are the genuine "I had to leave" cases and they are now counted as losses for
   * someone who was winning. That is a real 0.9% contamination, and it is smaller by two orders of
   * magnitude than the 72% of evidence the old rule destroyed to avoid it. */
  if (r.exclude_forfeits.on && g.forfeit && !hadAction(g)) bad.push('forfeit_no_action');
  if (r.min_turns.on && (g.turns || []).length < r.min_turns.value) bad.push('short');
  if (r.require_full_bring.on) {
    const br = g.brought || {};
    if ((br.p1 || []).length !== 4 || (br.p2 || []).length !== 4) bad.push('partial_bring');
  }
  return bad;
}

const isClean = (g, cfg, bots) => reasons(g, cfg, bots).length === 0;

function loadGames(opts) {
  /* A NON-OBJECT ARGUMENT IS A PROGRAMMING ERROR, NOT A CORPUS SELECTOR.
   *
   * `engine/stab_audit.js` called `loadGames('ots')`, meaning "the open-team-sheet store". A string has
   * no `.path`, so `readStore(undefined)` silently fell back to STORE — the closed-sheet LADDER store.
   * The audit then reported "2,245 clean open-sheet games" when data/games.ots.jsonl holds 4,167 games
   * that are 100% sheeted; what it had actually read was clean LADDER games, of which 116 (5.2%) happen
   * to carry a sheet. Its stated premise — "all four moves public, no revelation bias" — was false for
   * 95% of the sample, and the resulting figure looked entirely plausible.
   *
   * There is no honest default to pick here: guessing which store a caller meant is what produced the
   * defect. Throwing costs one stack trace and stops a wrong number reaching a document. */
  if (opts != null && (typeof opts !== 'object' || Array.isArray(opts))) {
    throw new TypeError(
      `loadGames() takes an options object, not ${JSON.stringify(opts)}. ` +
      `To choose a corpus, pass its path: loadGames({ path: 'data/games.ots.jsonl' }). ` +
      `A bare string silently read the default ladder store and produced a published figure ` +
      `computed on the wrong corpus.`);
  }
  const o = opts || {};
  const games = readStore(o.path);
  if (o.clean === false) return games;
  const cfg = config();
  const bots = behaviouralBots(games, cfg);
  return games.filter(g => isClean(g, cfg, bots));
}

/* THE FUNNEL IS DERIVED FROM reasons(), NOT RE-IMPLEMENTED BESIDE IT.
 *
 * It used to be a second copy of every rule, and the copies drifted the moment one rule changed:
 * when the forfeit rule became "forfeited before anyone acted" the filter honoured it and the funnel
 * did not, so loadGames() returned 2,860 clean open-sheet games while funnel() printed 2,114 on the
 * same store, in the same process. Two different answers to "how many usable games are there", both
 * from the file whose entire purpose is that the question has ONE answer.
 *
 * Each step now asks reasons() whether a game is excluded by the rules applied SO FAR, so a rule can
 * only be stated once. Adding a rule means adding its code here; forgetting to is visible as a step
 * that does not move rather than as a number that is quietly wrong. */
const FUNNEL_STEPS = [
  ['after_bot_filter', 'bot'],
  ['after_behavioural_bots', 'behavioural_bot'],
  ['after_forfeit_filter', 'forfeit_no_action'],
  ['after_min_turns', 'short'],
  ['after_full_bring', 'partial_bring'],
];
function funnel(p) {
  const games = readStore(p), cfg = config();
  const bots = behaviouralBots(games, cfg);
  const all = games.map(g => reasons(g, cfg, bots));
  const out = { collected: games.length };
  const applied = [];
  for (const [label, code] of FUNNEL_STEPS) {
    applied.push(code);
    out[label] = all.filter(rs => !rs.some(x => applied.includes(x))).length;
  }
  out.clean = all.filter(rs => rs.length === 0).length;
  /* A reason that no step accounts for would silently make `clean` smaller than the last step, which
   * reads as a rounding oddity rather than as a missing rule. Named, it reads as what it is. */
  const known = new Set(FUNNEL_STEPS.map(s => s[1]));
  const orphan = [...new Set([].concat(...all))].filter(x => !known.has(x));
  if (orphan.length) out.unaccounted_reasons = orphan;
  return out;
}

module.exports = { config, readStore, reasons, isClean, loadGames, funnel, behaviouralBots, STORE, CONFIG };

if (require.main === module) {
  const f = funnel(), t = f.collected;
  console.log('GAME QUALITY FUNNEL');
  const rows = [['collected', 'collected from Showdown'],
                ['after_bot_filter', 'after removing NAMED bot games'],
                ['after_behavioural_bots', 'after removing accounts that behave like bots'],
                ['after_forfeit_filter', 'after removing forfeits'],
                ['after_min_turns', 'after removing games under 3 turns'],
                ['after_full_bring', 'after requiring all four brought to be revealed']];
  let prev = t;
  for (const [k, label] of rows) {
    if (!(k in f)) continue;
    const n = f[k], drop = prev - n;
    console.log(`  ${label.padEnd(48)} ${String(n).padStart(6)}  (${(100 * n / t).toFixed(1)}% of collected)` + (drop ? `   -${drop}` : ''));
    prev = n;
  }
  console.log(`\n  USABLE: ${f.clean} of ${t} (${(100 * f.clean / t).toFixed(1)}%)`);
}
