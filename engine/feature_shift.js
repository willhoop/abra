/* feature_shift.js — WHICH FITTED COLUMNS DID THIS CHANGE MOVE? Named, not asserted.
 *
 *   node engine/feature_shift.js            print the report and write data/feature-shift.json
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT `feature_fixture.js --check`
 * ---------------------------------------------------------------
 * `--check` compares the code against the hashes STAMPED IN A WEIGHT FILE. It answers "are these
 * weights stale", which is the right question at fit time and the wrong one here: `data/policy-
 * weights.json` is already quarantined and already owes a refit, so a red `--check` says something
 * everybody already knows and names nothing.
 *
 * The question a landing change has to answer is narrower: **exactly which of the per-feature columns
 * differ between this build and the build before it.** That list is not a warning, it is the input to
 * the refit — it says which weights describe a different quantity now.
 *
 * SO IT COMPARES TWO BUILDS OF THE SAME FILE ON THE SAME BOARDS. The "before" arm is `engine/board.js`
 * with a textual patch that restores the previous behaviour, compiled into `require.cache` rather than
 * written to disk (#254's technique) — because other agents may be live in the tree and reverting a
 * file underneath them is the failure that cost this project 7,100 games. Every patch is asserted to
 * have APPLIED; a patch that silently matched nothing would report "no columns moved", which is the
 * most dangerous possible output of this file.
 *
 * *** AND THE FROZEN FIXTURE CANNOT SEE A CLOCK, WHICH IS MEASURED HERE RATHER THAN ASSUMED. ***
 * `feature_fixture.buildScenario` sets `board.turn` and THEN calls `board.setWeather`, so every
 * fixture weather is zero turns old and no board in it has a weather that has run out. A weather-
 * expiry change is therefore INERT on the frozen fixture — its hashes do not move, and reading that
 * as "no columns move" would be R7 for the seventh time: a guard only guards what it exercises.
 *
 * So each arm is run TWICE: once on the fixture as it stands, and once on the same boards with the
 * clock advanced past the longest weather the format can set. The second run is not a proposal to
 * change the fixture — adding a board moves every stored hash at once and that is a refit-time
 * decision — it is the population the frozen one is missing, computed on the same bodies.
 *
 * ROUNDING is `feature_fixture.ROUND`, so a column that moves here is a column that would move there.
 */
'use strict';
require('./showdown_path.js');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const BOARD = path.join(__dirname, 'board.js');
const FIXTURE = path.join(__dirname, 'feature_fixture.js');

/* ---- THE ARMS -------------------------------------------------------------------------------
 *
 * Each patch is a [find, replace] pair against board.js's own source, and each is CHECKED to have
 * applied exactly once. The replacements restore the behaviour that was there before the row landed —
 * they are not a "disable the feature" switch, which would measure a third build nobody has. */
const ARMS = {
  /* #276 — the board's weather never expires, which is what `weatherLeft` returning null means to
   * every caller: "cannot say", so leave the sky alone. */
  'pre-276': [[
    `  weatherLeft() {\n    const w = this._weatherWord;\n    if (!w) return null;`,
    `  weatherLeft() {\n    const w = this._weatherWord;\n    if (w || !w) return null;   /* pre-#276 */\n    if (!w) return null;`,
  ]],
  /* #283 — the stub side is the literal it used to be, no ally list, no first-hit index. */
  'pre-283': [
    [`      side: { sideConditions: {}, totalFainted: fallen, pokemon: [] },`,
     `      side: { sideConditions: {} },   /* pre-#283 */`],
    [`    if (sd && board.party && board.party[sd] && board.party[sd].length) {`,
     `    if (false) {   /* pre-#283 */`],
    [`    } else if (mo) { self.side.pokemon.push(self); bpCounters.partyUnknown++; }`,
     `    } else if (mo) { bpCounters.partyUnknown++; }   /* pre-#283 */`],
    [`  const mv = Object.create(m);\n  mv.hit = 1;`,
     `  const mv = Object.create(m);   /* pre-#283 */`],
    [`  if (typeof m.onModifyMove === 'function') {\n    try { m.onModifyMove.call(ctx, mv, u, t); } catch (e) { probeFailures.onModifyMove_power++; }\n  }`,
     `  /* pre-#283 */`],
  ],
};
ARMS['pre-both'] = ARMS['pre-276'].concat(ARMS['pre-283']);

const SRC = fs.readFileSync(BOARD, 'utf8');

function patched(arm) {
  if (arm === 'head') return SRC;
  let s = SRC;
  for (const [find, repl] of ARMS[arm]) {
    const n = s.split(find).length - 1;
    if (n !== 1) {
      throw new Error(`feature_shift: arm "${arm}" patch matched ${n} times, not 1. The source has ` +
        `moved and this run would report "nothing changed" for a change it simply could not apply:\n` +
        find.slice(0, 120));
    }
    s = s.replace(find, repl);
  }
  return s;
}

/* Compile a source string as engine/board.js and hand back a FRESH feature_fixture bound to it. */
function loadArm(arm) {
  for (const f of [BOARD, FIXTURE]) delete require.cache[f];
  const m = new Module(BOARD, null);
  m.filename = BOARD;
  m.paths = Module._nodeModulePaths(path.dirname(BOARD));
  m._compile(patched(arm), BOARD);
  m.loaded = true;
  require.cache[BOARD] = m;
  const FF = require(FIXTURE);
  return { B: m.exports, FF };
}

/* ---- THE TWO POPULATIONS -------------------------------------------------------------------- */
const CS = require('./champions_sim.js');
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const MEDI = require('./medicham2-browser.js');
const TAGS = require('./tags.js');

/* HOW FAR TO AGE THE BOARDS: past the LONGEST weather this format can set, so no fixture weather can
 * still be up. Derived by asking the engine about every legal weather-setting move and every legal
 * item, exactly as tests/test-board-clock-power.js does. */
/* A THROW HERE USED TO BE SKIPPED INSIDE THE `Math.max`, and that is the worst shape this file can
 * have: if every call throws, `n` stays 0, `AGE` becomes 1, and the boards are "aged past the
 * weather" WITH THE WEATHER STILL UP — so the instrument compares two identical situations and
 * reports NO FEATURE SHIFT while measuring nothing. The throws are now counted; a total loss
 * REFUSES, and a partial loss says so, because the longest weather may be one of the ones that
 * threw. `engine/board.js` counts the same call the same way (`weatherCounters.noEngine`). Measured
 * 2026-08-23: 745 calls, 0 throws, n = 8, so a healthy run prints nothing. */
const AGE = (() => {
  let n = 0, threw = 0, first = '';
  const ask = (weather, item) => {
    try { n = Math.max(n, MEDI.weatherTurns(weather, item, TAGS) | 0); }
    catch (e) {
      threw++;
      if (!first) first = weather + ' + ' + (item || '(no item)') + ': ' + String((e && e.message) || e).split('\n')[0];
    }
  };
  for (const m of dex.moves.all()) {
    if (!m.exists || m.isNonstandard || m.tier === 'Illegal' || !m.weather) continue;
    for (const it of dex.items.all()) {
      if (!it || !it.exists || it.isNonstandard) continue;
      ask(m.weather, it.id);
    }
    ask(m.weather, '');
  }
  if (n === 0) {
    throw new Error('feature_shift: MEDI.weatherTurns answered for NO legal weather/item pair ('
      + threw + ' threw, first: ' + (first || '(none)') + '). The ageing horizon would collapse to 1 '
      + 'turn, the boards would be compared with the fixture weather STILL UP, and this run would '
      + 'report "no feature shift" for a change it never exposed. REFUSING rather than measuring '
      + 'nothing.');
  }
  if (threw) {
    console.error('feature_shift: WARNING — MEDI.weatherTurns threw on ' + threw + ' legal '
      + 'weather/item pair(s); first: ' + first + '. The horizon below (' + (n + 1) + ' turns) is a '
      + 'LOWER BOUND, so a longer weather may still be up when the boards are compared.');
  }
  return n + 1;
})();

function columnsAged(arm, age) {
  const { B, FF } = loadArm(arm);
  const slots = FF.build(dex);
  const seen = new Set();
  for (const s of slots) if (!seen.has(s.board)) { seen.add(s.board); s.board.turn += age; }
  /* Re-scored through the SAME two entry points feature_fixture uses, so this is its matrix with the
   * clock moved and nothing else. */
  const r = (v) => { const n = Number(v); return isFinite(n) ? n.toFixed(FF.ROUND) : String(v); };
  const marg = {}, joint = {};
  for (const f of B.FEATURES) marg[f] = [];
  for (const f of B.JOINT_FEATURES) joint[f] = [];
  const rescored = slots.map(s => {
    const user = s.board.slot(s.side, s.letter);
    const cands = B.candidates(user.moves, user, s.board, s.side, dex);
    const feats = cands.map((c, i) => B.featuresFor(c, user, s.board, s.side, dex, (i + 1) / (cands.length + 1)));
    return { ...s, cands, feats };
  });
  for (const s of rescored) for (const x of s.feats) for (let k = 0; k < B.FEATURES.length; k++) marg[B.FEATURES[k]].push(r(x[k]));
  for (let i = 0; i < rescored.length; i++) {
    const A = rescored[i];
    const Bs = rescored.find(s => s !== A && s.side === A.side && s.label.split('/')[0] === A.label.split('/')[0] && s.letter > A.letter);
    if (!Bs) continue;
    for (let ia = 0; ia < A.cands.length; ia++) for (let ib = 0; ib < Bs.cands.length; ib++) {
      const j = B.jointFeaturesFor(A.cands[ia], Bs.cands[ib], A.feats[ia], Bs.feats[ib]);
      for (let k = 0; k < B.JOINT_FEATURES.length; k++) joint[B.JOINT_FEATURES[k]].push(r(j[k]));
    }
  }
  return { marg, joint, nCands: Object.values(marg)[0].length, nPairs: Object.values(joint)[0].length };
}

function columnsFrozen(arm) {
  const { FF } = loadArm(arm);
  return FF.columns(dex);
}

/* ---- THE THIRD POPULATION: THE FIT'S OWN ROWS, IN LOCKSTEP -----------------------------------
 *
 * WHY IT IS HERE AND NOT OPTIONAL. The frozen fixture answers "did a feature change meaning on these
 * boards"; it cannot answer "how much of the corpus does that reach", and for a change that fires
 * only on moves NO fixture board carries it cannot answer the first question either. #283 is exactly
 * that case — no scenario in `feature_fixture.js` holds Last Respects, Beat Up or Triple Axel — so the
 * frozen answer for it is "(none)" and reading that as "no refit is owed" would be wrong.
 *
 * IT IS RUN IN LOCKSTEP, ONE PROCESS, TWO BOARD MODULES REPLAYING THE SAME GAME. Two passes would
 * have to be aligned afterwards, and a menu that differs by one candidate would silently offset every
 * comparison after it — noise attributed to the change, which is R17's first load-bearing decision in
 * a different file. Lockstep also makes the memory O(1): nothing is stored but counters.
 *
 * THE REPLAY IS THE FITTER'S REPLAY, copied from `engine/feature_coverage.js` including its own hard
 * lesson (`noteMove` and `endTurn`, not `turn++`), because a lighter replay reports features dead that
 * carry strong fitted weights. */
const FP = require('./fit_policy.js');
const CM = require('./click_match.js');
const MAXG = +(process.env.MAXG || 300);

function corpusShift(arm) {
  const HEAD = loadArm('head').B;
  const PRE = loadArm(arm).B;
  const { games } = FP.loadCorpus();
  const norm = HEAD.norm, base = HEAD.baseSpecies;
  const movedF = new Set(), movedJ = new Set();
  let seen = 0, cands = 0, differing = 0, gamesTouched = 0, menuMismatch = 0;

  for (const g of games) {
    if (seen >= MAXG) break;
    seen++;
    let touched = false;
    const boards = [HEAD, PRE].map(M => {
      const bd = new M.Board();
      for (const side of ['p1', 'p2']) {
        for (const m of (g.sheets && g.sheets[side]) || []) {
          if (m && m.species) bd.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
        }
        bd.setParty(side, ((g.brought || {})[side] || []));
        const lead = (g.lead || {})[side] || [];
        if (lead[0]) bd.switchIn(side, 'a', lead[0]);
        if (lead[1]) bd.switchIn(side, 'b', lead[1]);
      }
      return bd;
    });
    const SI = CM.sheetIndex(g, dex);
    for (const t of g.turns || []) {
      const ev = t.ev || [];
      for (const e of ev) {
        if (e.t !== 'm' || !e.s || !e.mon) continue;
        const side = e.s.slice(0, 2), letter = e.s.slice(2);
        const sh = SI.get(side, e.mon);
        if (!sh) continue;
        const rows = [];
        for (let i = 0; i < 2; i++) {
          const M = i === 0 ? HEAD : PRE, bd = boards[i];
          const user = bd.slot(side, letter);
          if (!user || user.fainted) { rows.push(null); continue; }
          const cs = M.candidates(sh.moves, user, bd, side, dex);
          rows.push({ M, cs, xs: cs.map(c => M.featuresFor(c, user, bd, side, dex,
            c.switchTo ? M.PRIOR_FLOOR : FP.priorFor(user.species, c.move.id))) });
        }
        if (!rows[0] || !rows[1]) continue;
        if (rows[0].cs.length !== rows[1].cs.length) { menuMismatch++; continue; }
        for (let k = 0; k < rows[0].xs.length; k++) {
          cands++;
          let any = false;
          for (let f = 0; f < HEAD.FEATURES.length; f++) {
            if (rows[0].xs[k][f] !== rows[1].xs[k][f]) { movedF.add(HEAD.FEATURES[f]); any = true; }
          }
          if (any) { differing++; touched = true; }
        }
        /* The joint block is formed the way `jointFeaturesFor` is ever asked: this slot against the
         * partner's, within one side. */
        const other = letter === 'a' ? 'b' : 'a';
        const osh = boards[0].slot(side, other);
        if (osh && !osh.fainted) {
          const orows = [];
          for (let i = 0; i < 2; i++) {
            const M = i === 0 ? HEAD : PRE, bd = boards[i];
            const u2 = bd.slot(side, other);
            const sh2 = SI.get(side, u2.species) || sh;
            const cs2 = M.candidates(sh2.moves || [], u2, bd, side, dex);
            orows.push({ M, cs: cs2, xs: cs2.map(c => M.featuresFor(c, u2, bd, side, dex,
              c.switchTo ? M.PRIOR_FLOOR : FP.priorFor(u2.species, c.move.id))) });
          }
          if (orows[0].cs.length === orows[1].cs.length) {
            const nA = Math.min(rows[0].cs.length, 6), nB = Math.min(orows[0].cs.length, 6);
            for (let ia = 0; ia < nA; ia++) for (let ib = 0; ib < nB; ib++) {
              const ja = HEAD.jointFeaturesFor(rows[0].cs[ia], orows[0].cs[ib], rows[0].xs[ia], orows[0].xs[ib]);
              const jb = PRE.jointFeaturesFor(rows[1].cs[ia], orows[1].cs[ib], rows[1].xs[ia], orows[1].xs[ib]);
              for (let f = 0; f < HEAD.JOINT_FEATURES.length; f++) {
                if (ja[f] !== jb[f]) { movedJ.add(HEAD.JOINT_FEATURES[f]); touched = true; }
              }
            }
          }
        }
      }
      for (let i = 0; i < 2; i++) {
        const M = i === 0 ? HEAD : PRE, bd = boards[i];
        for (const e of ev) {
          const side = e.s ? e.s.slice(0, 2) : null, L = e.s ? e.s.slice(2) : null;
          if (e.t === 'm' && side) {
            const u = bd.slot(side, L), mv = dex.moves.get(e.mv);
            if (u && mv && mv.exists) {
              const already = (mv.sideCondition && bd.hasSide(M.sideFor(side, mv), mv.sideCondition)) ||
                              (M.fieldKey(mv) && bd.hasField(M.fieldKey(mv)));
              M.noteMove(bd, side, u, mv, !already);
            }
          }
          if (e.t === 's' && side) bd.switchIn(side, L, e.mon);
          else if (e.t === 'f' && side) bd.faint(side, L);
          else if (e.t === 'x' && side) { const m2 = bd.slot(side, L); if (m2) m2.status = norm(e.st); }
          else if (e.t === 'hp' && side) { const m2 = bd.slot(side, L); if (m2 && e.hp != null) m2.hp = Math.max(0, e.hp / 100); }
          else if (e.t === 'b' && side) { const m2 = bd.slot(side, L); if (m2 && e.b) m2.boosts = { ...e.b }; }
          else if (e.t === 'm' && side && e.tgt && e.tgthp != null) {
            for (const sd of ['p1', 'p2']) for (const L2 of ['a', 'b']) {
              const m2 = bd.slot(sd, L2);
              if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) m2.hp = Math.max(0, e.tgthp / 100);
            }
          } else if (e.t === 'w') bd.setWeather(e.field);
          else if (e.t === 'fs') bd.startField(e.field, 5);
        }
        bd.endTurn();
      }
    }
    if (touched) gamesTouched++;
  }
  return { games: seen, candidates: cands, candidatesDiffering: differing,
    pctCandidates: cands ? +(100 * differing / cands).toFixed(3) : 0,
    gamesTouched, pctGames: seen ? +(100 * gamesTouched / seen).toFixed(2) : 0,
    menuMismatch,
    features: [...movedF], jointFeatures: [...movedJ] };
}

function diff(a, b) {
  const out = { features: [], jointFeatures: [] };
  for (const [blk, key] of [['features', 'marg'], ['jointFeatures', 'joint']]) {
    for (const f of Object.keys(a[key])) {
      const x = a[key][f], y = b[key][f];
      if (x.length !== y.length) { out[blk].push(f); continue; }
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { out[blk].push(f); break; }
    }
  }
  return out;
}

/* ---- RUN ------------------------------------------------------------------------------------- */
const report = { generated: new Date().toISOString(), by: 'engine/feature_shift.js',
  what: 'which per-feature columns move between the build before ROADMAP #276/#283 and the build after',
  rows: [276, 283], age: AGE, populations: {}, };

const head = { frozen: columnsFrozen('head'), aged: columnsAged('head', AGE) };
for (const arm of ['pre-276', 'pre-283', 'pre-both']) {
  const before = { frozen: columnsFrozen(arm), aged: columnsAged(arm, AGE) };
  report.populations[arm] = {
    frozenFixture: diff(head.frozen, before.frozen),
    agedFixture: diff(head.aged, before.aged),
    fitCorpus: corpusShift(arm),
  };
}
report.counts = {
  featuresInVector: head.frozen.nCands ? Object.keys(head.frozen.marg).length : 0,
  jointFeatures: Object.keys(head.frozen.joint).length,
  frozenCandidates: head.frozen.nCands, frozenPairs: head.frozen.nPairs,
  agedCandidates: head.aged.nCands, agedPairs: head.aged.nPairs,
};
/* THE CONTROL THAT SAYS THE INSTRUMENT IS LIVE: head against itself must be EMPTY. A comparison that
 * cannot reproduce itself is measuring its own state, which is R17's PURITY control in one line. */
report.purity = diff(head.frozen, columnsFrozen('head'));

const OUT = path.join(ROOT, 'data', 'feature-shift.json');
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

const line = (t, d) => console.log(`    ${t.padEnd(16)} features: ${d.features.join(', ') || '(none)'}` +
  `\n    ${''.padEnd(16)} joint:    ${d.jointFeatures.join(', ') || '(none)'}`);
console.log('\nFEATURE SHIFT — which fitted columns ROADMAP #276 and #283 move\n');
console.log(`  vector: ${report.counts.featuresInVector} features + ${report.counts.jointFeatures} joint`);
console.log(`  frozen fixture: ${report.counts.frozenCandidates} candidates, ${report.counts.frozenPairs} pairs`);
console.log(`  aged fixture:   the same boards, +${AGE} turns (past the longest weather this format can set)\n`);
console.log(`  PURITY (head vs head, must be empty): ` +
  `${report.purity.features.length + report.purity.jointFeatures.length} columns\n`);
for (const arm of Object.keys(report.populations)) {
  const P = report.populations[arm];
  console.log(`  ${arm}:`);
  line('frozen fixture', P.frozenFixture);
  line('aged fixture', P.agedFixture);
  line('fit corpus', P.fitCorpus);
  console.log(`    ${''.padEnd(16)} reach:    ${P.fitCorpus.candidatesDiffering.toLocaleString()} of ` +
    `${P.fitCorpus.candidates.toLocaleString()} candidate vectors (${P.fitCorpus.pctCandidates}%) over ` +
    `${P.fitCorpus.games} games, ${P.fitCorpus.pctGames}% of games touched` +
    (P.fitCorpus.menuMismatch ? `, ${P.fitCorpus.menuMismatch} menu mismatches SKIPPED` : ''));
  console.log('');
}
console.log('  wrote data/feature-shift.json');
