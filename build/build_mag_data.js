/* build_mag_data.js — the browser bundle for MAGNEMITE.
 *
 *   SHOWDOWN_PATH=... node build/build_mag_data.js   ->   data/mag.js
 *
 * WHY IT IS GENERATED AND NOT HAND-WRITTEN
 * ---------------------------------------
 * web/magnemite.html has to score a move exactly the way engine/board.js scores it, or the site
 * shows numbers the bot does not actually use — which is the drift this project keeps getting bitten
 * by (the site's clean-game count, ORIENTATION's figures, the hand-typed LOCK_AT). So the page is
 * given the SAME three things the engine reads, in the same form:
 *
 *   1. the fitted weight vector and the feature list it was fitted against, straight out of
 *      data/policy-weights.json — including WHICH vector shipped;
 *   2. per move, only the dex DATA FIELDS the features test — type, base power, category, target,
 *      and the four "this cannot work" markers (status / sideCondition / pseudoWeather+terrain /
 *      weather / stallingMove). No move is named here either;
 *   3. per species, its types, and the behaviour clone's P(move | species).
 *
 * The page then re-implements `featuresFor` over that data. That is a second implementation and
 * therefore a drift risk in itself, which is why web/magnemite.html carries a self-check against a
 * fixture generated here: if the browser's scoring and the engine's scoring ever disagree on the
 * fixture, the page says so on screen rather than quietly showing wrong numbers.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('../engine/champions_sim.js');
const B = require('../engine/board.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm;

const W = JSON.parse(fs.readFileSync(D('data', 'policy-weights.json'), 'utf8'));
if ((W.features || []).join(',') !== B.FEATURES.join(',')) {
  console.error('policy-weights.json was fitted against a different feature set — refit first');
  process.exit(1);
}

/* ---- moves: only the fields a feature reads ---------------------------------------------------- */
const moves = {};
for (const m of dex.moves.all()) {
  if (!m || !m.exists || m.isNonstandard || m.isZ || m.isMax) continue;
  const e = { n: m.name, t: m.type, c: m.category === 'Status' ? 'S' : (m.category === 'Physical' ? 'P' : 'E'),
              bp: m.basePower || 0, tg: m.target || 'normal' };
  if (m.status) e.st = norm(m.status);
  if (m.sideCondition) e.sc = norm(m.sideCondition);
  const fk = B.fieldKey(m);
  if (fk) e.fd = fk;
  if (m.weather) e.wx = norm(m.weather);
  if (m.stallingMove) e.sl = 1;
  if (m.condition && m.condition.duration) e.du = m.condition.duration;
  moves[m.id] = e;
}

/* ---- species: types, and a sensible default four so the page opens on something real ----------- */
const priors = {};
try {
  const j = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'));
  for (const [sp, v] of Object.entries(j.species || {})) {
    const row = {};
    for (const mv of v.moves || []) if (mv && mv.mv) row[norm(mv.mv)] = +mv.p || 0;
    if (Object.keys(row).length) priors[norm(sp)] = row;
  }
} catch (e) { console.error('no data/move-priors.json — the page will have no popularity term'); }

const mons = {};
for (const s of dex.species.all()) {
  if (!s || !s.exists || s.isNonstandard) continue;
  const id = norm(s.id);
  const e = { n: s.name, t: s.types };
  const p = priors[id];
  if (p) e.mv = Object.entries(p).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  mons[id] = e;
}

/* ---- the type chart, as the page needs it ------------------------------------------------------ */
const TYPES = dex.types.all().map(t => t.name);
const chart = {};
for (const atk of TYPES) {
  chart[atk] = {};
  for (const def of TYPES) {
    chart[atk][def] = dex.getImmunity(atk, [def]) ? dex.getEffectiveness(atk, [def]) : 'i';
  }
}

/* ---- a fixture the page checks itself against -------------------------------------------------
 * Scored HERE by the real engine.featuresFor, so any disagreement in the browser is a browser bug
 * and is reported on screen instead of silently changing the answer. */
function fixture() {
  const bd = new B.Board();
  bd.switchIn('p1', 'a', 'Pelipper'); bd.switchIn('p1', 'b', 'Archaludon');
  bd.switchIn('p2', 'a', 'Garchomp'); bd.switchIn('p2', 'b', 'Incineroar');
  const user = bd.slot('p1', 'a');
  const cases = [];
  for (const mv of ['icebeam', 'hurricane', 'rockslide', 'tailwind', 'protect']) {
    const cands = B.candidates([mv], user, bd, 'p1', dex);
    for (const c of cands) {
      const x = B.featuresFor(c, user, bd, 'p1', dex, (priors.pelipper || {})[mv] || 0);
      cases.push({ mv, tgt: c.targetMon ? norm(c.targetMon.species) : (c.spread ? '*' : ''), x });
    }
  }
  return { user: 'pelipper', foes: ['garchomp', 'incineroar'], cases };
}

const OUT = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'build/build_mag_data.js',
  features: B.FEATURES,
  weights: W.weights,
  shipped: W.shipped || 'unweighted',
  priorFloor: B.PRIOR_FLOOR,
  heldOut: W.heldOut || null,
  moves, mons, chart, priors,
  fixture: fixture(),
};

const js = '/* mag.js — GENERATED by build/build_mag_data.js. Do not hand-edit. */\n' +
  '(function(root){root.MAG=' + JSON.stringify(OUT) + ';})(typeof window!=="undefined"?window:this);\n';
fs.writeFileSync(D('data', 'mag.js'), js);
console.log(`wrote data/mag.js — ${Object.keys(moves).length} moves, ${Object.keys(mons).length} species, ` +
            `${TYPES.length} types, ${OUT.fixture.cases.length} fixture cases, ${(js.length / 1024).toFixed(0)} KB`);
console.log(`  weight vector shipped: ${OUT.shipped}`);
