/* build_mag_data.js — the browser bundle for MAGNEMITE.
 *
 *   SHOWDOWN_PATH=... node build/build_mag_data.js   ->   data/mag.js
 *
 * WHY IT IS GENERATED AND NOT HAND-WRITTEN
 * ---------------------------------------
 * The MAGNEMITE room — `roomMagnemite()` in web/index.html, NOT a page of its own — has to score a
 * move exactly the way engine/board.js scores it, or the site
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
 * CORRECTED 2026-08-27 (MEASURE), AFTER 32 DAYS. This block said the page "re-implements
 * `featuresFor` over that data", and that `web/magnemite.html carries a self-check against a fixture
 * generated here`. BOTH HALVES WERE WRONG, and the second was the one that mattered:
 * there is no web/magnemite.html and there never has been — zero commits in this repository's
 * history have touched that path — so a reader asking whether the drift above is covered was told
 * yes and pointed at nothing. Written 2026-07-26 in 4a7c82f1, caught by the comment census in
 * tests/test-claim-truth.js.
 *
 * WHAT IS ACTUALLY TRUE. The room is `roomMagnemite()` inside web/index.html, and it no longer holds
 * a second implementation at all: `magScore()` fetches engine/board.js live (MAGENG_FILES) and calls
 * `B.featuresFor` directly. The self-check IS real and IS fed by the fixture built below — it is
 * `magSelfCheck()` in web/index.html, and what it now detects is a VINTAGE mismatch rather than
 * two scorers diverging: data/mag.js carries weights and a fixture scored at build time, board.js is
 * fetched live, and a stale bundle beside a newer engine is the same drift in a new costume. On a
 * mismatch the room prints SELF-CHECK FAILED above the numbers instead of showing them quietly.
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

/* ---- THE GLOSSARY: what MAG is allowed to see, READ OUT OF THE SOURCE ---------------------------
 *
 * The site has to be able to show every input the model gets, because "what is this thing allowed to
 * know?" is the question that decides whether a result means anything. Typing that list into the HTML
 * would put a 26-row description of the model in a file that does not change when the model does —
 * hand-maintained state (S13) describing the very thing it would go stale against, which is the exact
 * shape of the stale-PDF and stale-artifact problems this project has already had twice.
 *
 * So it is PARSED from the FEATURES block in engine/board.js. Each feature's plain-English line is
 * the comment already sitting beside it, and the group headings are the `---- LIKE THIS ----` banners
 * already used to divide the block. Adding a feature to board.js publishes it here with no edit.
 *
 * If a feature has no comment the build FAILS rather than shipping a blank row, because a silently
 * undocumented input is worse than a missing page. */
const featDoc = (() => {
  const src = fs.readFileSync(D('engine', 'board.js'), 'utf8');
  const m = src.match(/const FEATURES = \[([\s\S]*?)\n\];/);
  if (!m) { console.error('could not find the FEATURES block in engine/board.js'); process.exit(1); }
  const out = {}; const order = [];
  let group = 'What the move does', pending = [];
  for (let raw of m[1].split('\n')) {
    const line = raw.trim();
    const banner = line.match(/-{3,}\s*(.+?)\s*-{3,}/);
    if (banner) { group = tidy(banner[1]); pending = []; continue; }
    const entry = line.match(/^'([a-zA-Z0-9]+)',\s*(?:\/\/\s*(.*))?$/);
    if (entry) {
      const en = tidy(entry[2] || pending.join(' '));
      if (!en) { console.error(`feature '${entry[1]}' has no description in engine/board.js`); process.exit(1); }
      out[entry[1]] = { en, group }; order.push(entry[1]);
      pending = [];
      continue;
    }
    /* Comment prose accumulates so a feature documented by the block ABOVE it still gets a line. */
    const prose = line.replace(/^\/\*+/, '').replace(/\*+\/$/, '').replace(/^\*+/, '').trim();
    if (prose && !/^-+$/.test(prose)) pending.push(prose); else if (!prose) pending = [];
  }
  const missing = B.FEATURES.filter(f => !out[f]);
  if (missing.length) { console.error('features with no glossary entry: ' + missing.join(', ')); process.exit(1); }
  return { doc: out, order };
})();

/* First sentence only, em-dashes and stray punctuation cleaned. The comments are written for a
 * programmer reading the file; the site wants the first clause of each, which is reliably the
 * definition — the rest is the argument for why the feature exists. */
function tidy(s) {
  if (!s) return '';
  let t = String(s).replace(/\s+/g, ' ').trim();
  t = t.split(/\.\s|\s--\s|\s—\s/)[0].trim();
  return t.replace(/[.,;:]+$/, '');
}

/* ---- moves: only the fields a feature reads ---------------------------------------------------- */
const moves = {};
for (const m of dex.moves.all()) {
  if (!m || !m.exists || m.isNonstandard || m.isZ || m.isMax) continue;
  const e = { n: m.name, t: m.type, c: m.category === 'Status' ? 'S' : (m.category === 'Physical' ? 'P' : 'E'),
              bp: m.basePower || 0, tg: m.target || 'normal', pr: m.priority || 0 };
  const fl = {}; for (const k of ['sound', 'bullet', 'powder']) if (m.flags && m.flags[k]) fl[k] = 1;
  if (Object.keys(fl).length) e.fl = fl;
  if (m.status) e.st = norm(m.status);
  if (m.sideCondition) e.sc = norm(m.sideCondition);
  const fk = B.fieldKey(m);
  if (fk) e.fd = fk;
  if (m.weather) e.wx = norm(m.weather);
  if (m.stallingMove) e.sl = 1;
  if (m.condition && m.condition.duration) e.du = m.condition.duration;
  /* MOVES WHOSE TYPE DEPENDS ON THE BOARD. Weather Ball is Normal on paper and Water under rain,
   * and Pelipper sets rain on switch-in — so a rain team's main attack was being scored as a
   * neutral Normal move. The mapping is not typed: engine/board.js moveType() calls Showdown's own
   * onModifyType handler, and this asks it once per weather we can track, so the browser gets the
   * same answer without shipping the handler. */
  if (typeof m.onModifyType === 'function') {
    const tw = {};
    for (const w of ['', 'sunnyday', 'raindance', 'sandstorm', 'snowscape']) {
      const bd = new B.Board(); bd.setWeather(w);
      const t = B.moveType(m, bd, dex);
      if (t && t !== m.type) tw[w || 'none'] = t;
    }
    if (Object.keys(tw).length) e.tw = tw;
  }
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

/* ONLY SPECIES THIS FORMAT ACTUALLY PLAYS.
 *
 * dex.species.get() answers from the whole Gen 9 dex, not from the format, so a demo written against
 * it happily used Chi-Yu — which is flagged `Past` and is not legal here. The same hole put 14
 * species in the site's dropdown that have never been played in this regulation, most of them
 * in-battle formes a player cannot even choose (Aegislash-Blade, Mimikyu-Busted, Morpeko-Hangry) and
 * Vivillon patterns that are purely cosmetic.
 *
 * The filter is Smogon's own usage list for this format — measured from played battles rather than a
 * banlist typed here, so it tracks the regulation automatically. */
const PLAYED = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(D('data', 'smogon-priors.json'), 'utf8'));
    return new Set(Object.keys(j.species || {}));
  } catch (e) { return null; }
})();

const mons = {};
let skippedUnplayed = 0;
for (const s of dex.species.all()) {
  if (!s || !s.exists || s.isNonstandard) continue;
  if (PLAYED && !PLAYED.has(norm(s.id)) && !PLAYED.has(norm(s.baseSpecies))) { skippedUnplayed++; continue; }
  const id = norm(s.id);
  const e = { n: s.name, t: s.types, bs: s.baseStats };
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
  /* Rain is set deliberately: it is the board on which Weather Ball changes type, which the first
   * version of this model got wrong, so the fixture now pins it. */
  bd.setWeather('raindance');
  for (const mv of ['icebeam', 'hurricane', 'rockslide', 'tailwind', 'protect', 'weatherball']) {
    const cands = B.candidates([mv], user, bd, 'p1', dex);
    for (const c of cands) {
      const x = B.featuresFor(c, user, bd, 'p1', dex, (priors.pelipper || {})[mv] || 0);
      cases.push({ mv, tgt: c.targetMon ? norm(c.targetMon.species) : (c.spread ? '*' : ''), x });
    }
  }
  return { user: 'pelipper', foes: ['garchomp', 'incineroar'], weather: 'raindance', cases };
}

const OUT = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'build/build_mag_data.js',
  features: B.FEATURES,
  /* name -> {en, group}, parsed from board.js. The site renders every input the model gets. */
  featDoc: featDoc.doc,
  /* Standard errors, so the page can MARK a feature whose 95% interval contains zero instead of
   * presenting a weight the data cannot tell apart from "this input does nothing". The site showing
   * a confident-looking bar for killsThreat (+0.027, interval spanning zero) would be the same
   * failure as quoting a model without checking what it was trained on. */
  standardErrors: W.standardErrors || null,
  weights: W.weights,
  spread: W.spread || null,
  shipped: W.shipped || 'unweighted',
  priorFloor: B.PRIOR_FLOOR,
  heldOut: W.heldOut || null,
  moves, mons, chart, priors,
  /* The ability tables, so the page can compute abilityBlock exactly as engine/board.js does.
   * blocks = the measured rule per ability; abil = Smogon's per-species ability odds. */
  blocks: (() => { try { return JSON.parse(fs.readFileSync(D('data','ability-blocks.json'),'utf8')).abilities || {}; } catch(e){ return {}; } })(),
  abil: (() => { const o={}; try { const j=JSON.parse(fs.readFileSync(D('data','smogon-priors.json'),'utf8'));
      for (const [k,v] of Object.entries(j.species||{})) if (v && v.abilities) o[norm(k)] = v.abilities.map(a=>[norm(a.ability), (+a.pct||0)/100]);
    } catch(e){} return o; })(),
  fixture: fixture(),
};

const js = '/* mag.js — GENERATED by build/build_mag_data.js. Do not hand-edit. */\n' +
  '(function(root){root.MAG=' + JSON.stringify(OUT) + ';})(typeof window!=="undefined"?window:this);\n';
fs.writeFileSync(D('data', 'mag.js'), js);
if (skippedUnplayed) console.log(`  skipped ${skippedUnplayed} species never played in this format`);
console.log(`wrote data/mag.js — ${Object.keys(moves).length} moves, ${Object.keys(mons).length} species, ` +
            `${TYPES.length} types, ${OUT.fixture.cases.length} fixture cases, ${(js.length / 1024).toFixed(0)} KB`);
console.log(`  weight vector shipped: ${OUT.shipped}`);
