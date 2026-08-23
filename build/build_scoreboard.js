/* build_scoreboard.js — generate the data behind app/scoreboard.html.
 *
 *   SHOWDOWN_PATH=... node build/build_scoreboard.js [--games 8] [--seed N]
 *
 * WHY THE PAGE DOES NOT DO THIS ITSELF
 * ------------------------------------
 * app/index.html carries an embedded JavaScript re-implementation of the scorer, and
 * tests/test-mag-page.js has failed for weeks with the reason: it assigns 21 of 53 features, so 32
 * are silently zero and the scores a visitor reads are not the scores the bot computed. The obvious
 * repair — finish the re-implementation — is the wrong one. It is a second copy of the engine, which
 * is the exact failure this project has bled for elsewhere (mega Charizard-Y's Special Attack
 * disagreeing by 30% between two damage engines).
 *
 * So the scores are computed HERE, in node, by the real engine, and shipped as data. The page renders
 * numbers it cannot compute and therefore cannot get wrong. One engine, no copies.
 *
 * WHAT IT CAPTURES. Real self-play games with `--explain`, which keeps every option's per-feature
 * breakdown: score, probability after the softmax, and w_k * x_k for every feature that contributed.
 * Those sum to the score, so the page can show a decision as an argument rather than as a number.
 *
 * THE FEATURE LABELS ARE PARSED, NOT TYPED. board.js documents every feature with a trailing comment
 * -- `'eff4', // it hits a 4x weakness` -- and that comment is the plain-English name. Retyping 53 of
 * them here would be hand-maintained state that drifts the first time somebody edits one (S13). Any
 * feature whose comment cannot be found is reported rather than silently shown as a bare identifier.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const GAMES = parseInt(arg('games', '8'), 10);
const SEED = parseInt(arg('seed', '4242000'), 10);
const OUT = D('data', 'scoreboard.js');
const TMP = D('data', '.scoreboard-games.jsonl');

/* THE GATE AND THE LOADER HAVE TO BE THE SAME FUNCTION, which is engine/showdown_path.js's whole
 * argument. It swept the twenty hand-rolled `if (!process.env.SHOWDOWN_PATH)` gates in engine/ and
 * tests/ and did NOT reach build/, so this file went on printing `set SHOWDOWN_PATH` and exiting 2
 * with a checkout sitting one directory up. Found 2026-08-04 while rebuilding the bundle a refit had
 * invalidated: it exits 2, the shell reports 0 for the pipeline it was in, and nothing regenerates.
 * That is docs/MEASURE.md §5e's "crashes rather than fails" one step worse — it neither crashed nor
 * failed. */
const SP = require(D('engine', 'showdown_path.js')); /* resolves SHOWDOWN_PATH from the sibling checkout */
if (!process.env.SHOWDOWN_PATH) {
  /* WHY, not just THAT. `rejected` keeps the reason each candidate failed, because "no checkout" and
   * "a checkout this process cannot read" are different problems that look identical from here. */
  console.error('build_scoreboard: no pokemon-showdown checkout found. Tried: '
    + SP.CANDIDATES.join(', ') + '. ' + JSON.stringify(SP.rejected || {}));
  process.exit(2);
}

require(D('data', 'engine-data.js'));
/* THE DOOR IS LOADED BESIDE THE TABLE, ALWAYS. engine/mc_key.js installs the SEAL on MC.mons --
 * a raw read of a key the table does not have then THROWS instead of returning undefined, which
 * is how the same species-key bug went unnoticed four separate times. Requiring it here is not
 * decoration: section 4 of tests/test-mc-key.js FAILS on any file that loads the table without
 * it, because a seal that depends on load order is a seal that is sometimes absent. */
require(D('engine', 'mc_key.js'));
const B = require(D('engine', 'board.js'));

/* ---- plain-English names, read off board.js's own comments ---------------------------------- */
function featureLabels() {
  const src = fs.readFileSync(D('engine', 'board.js'), 'utf8');
  const out = {}, missing = [];
  for (const f of B.FEATURES) {
    /* `'name',` optionally followed by a trailing // comment on the same line. */
    const re = new RegExp(`'${f}',\\s*//\\s*(.+)`);
    const m = re.exec(src);
    if (m) out[f] = m[1].trim().replace(/\s+/g, ' ');
    else { out[f] = f; missing.push(f); }
  }
  if (missing.length) {
    console.error(`  NOTE: ${missing.length} feature(s) have no trailing comment in board.js and will ` +
                  `show as bare identifiers: ${missing.join(', ')}`);
  }
  return out;
}

/* ---- play some games with the reasoning kept ------------------------------------------------ */
console.error(`building scoreboard: ${GAMES} games, seed ${SEED}`);
execFileSync(process.execPath, [
  D('engine', 'mew.js'), '--n', String(GAMES), '--conc', '1', '--policy', 'score',
  '--explain', '--greedy', '--seed', String(SEED), '--out', TMP,
], { env: process.env, stdio: ['ignore', 'ignore', 'inherit'] });

const lines = fs.readFileSync(TMP, 'utf8').trim().split('\n').filter(Boolean);
const labels = featureLabels();
const games = [];

for (const l of lines) {
  let g; try { g = JSON.parse(l); } catch (e) { continue; }
  if (!g.thoughts || !g.thoughts.length) continue;

  /* Turn order matters for a stepper, and the thoughts of both sides arrive interleaved by side
   * rather than by turn. Sorted here so the page never has to know. */
  const decisions = g.thoughts.slice().sort((a, b) => (a.turn - b.turn) || (a.side < b.side ? -1 : 1) || (a.slot < b.slot ? -1 : 1))
    .map(t => ({
      turn: t.turn, side: t.side, slot: t.slot, mon: t.mon,
      opts: t.opts.map(o => ({
        mv: o.mv, tgt: o.tgt, s: o.s, p: o.p, chosen: !!o.chosen,
        /* [featureIndex, contribution] -> [plainEnglishName, contribution], biggest first. The page
         * shows the top few; the rest are kept so a total can be checked against the score. */
        why: (o.why || []).map(([k, v]) => [B.FEATURES[k], v]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])),
      })),
    }));

  games.push({
    id: g.id,
    p1: (g.six && g.six.p1) || [], p2: (g.six && g.six.p2) || [],
    broughtP1: (g.brought && g.brought.p1) || [], broughtP2: (g.brought && g.brought.p2) || [],
    winner: g.winner === (g.p1 && g.p1.name) ? 'p1' : 'p2',
    turns: (g.turns || []).length,
    decisions,
  });
}

if (!games.length) { console.error('no games carried reasoning — nothing to build'); process.exit(1); }

const weights = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
const payload = {
  generated: new Date().toISOString(),
  by: 'build/build_scoreboard.js',
  note: 'Scores computed by the real engine in node and shipped as data. The page renders them and ' +
        'never recomputes them, so it cannot disagree with the bot.',
  features: B.FEATURES,
  labels,
  weights: weights.weights,
  decisionRule: 'greedy (takes its best-scoring option)',
  games,
};
/* WRITTEN AS A SCRIPT, NOT AS JSON, and that is not a style choice. Every page in app/ is opened
 * straight off disk as well as served, and fetch() of a local JSON file is blocked by the file://
 * origin rules -- the page would work for a deployed visitor and be blank for Will double-clicking
 * it. Every other data file here (mag.js, live.js, xatu.js) is a script for the same reason. */
/* THE PATH IS NAMED ON THE WRITE LINE. tests/test-site-data-fresh.js pairs a filename with a write
 * call on ONE line to decide whether anything can regenerate a file, and writing through OUT hid this
 * generator: data/scoreboard.js was listed as a permanent orphan -- 'no generator exists' -- and
 * baselined as unfixable. That verdict is the one the freshness file itself calls the WORSE error,
 * because it tells a reader not to bother. Same defect and same fix as fit_policy.js. */
fs.writeFileSync(D('data', 'scoreboard.js'), 'window.SCOREBOARD = ' + JSON.stringify(payload) + ';' + String.fromCharCode(10));
try { fs.unlinkSync(TMP); fs.unlinkSync(TMP.replace(/\.jsonl$/, '') + '.raw-logs.jsonl'); } catch (e) {}

const nd = games.reduce((a, g) => a + g.decisions.length, 0);
console.error(`wrote ${path.relative(ROOT, OUT)} — ${games.length} games, ${nd} decisions, ` +
              `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
