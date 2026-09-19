/* probe_bounce_reflectable_class.js — EVERY LEGAL `reflectable` MOVE AT A MAGIC BOUNCE BODY, BOTH ENGINES. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_bounce_reflectable_class.js
 *   SHOWDOWN_PATH=... node tests/probe_bounce_reflectable_class.js --only yawn
 *   SHOWDOWN_PATH=... node tests/probe_bounce_reflectable_class.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/game-differential.g1950.json` (release 482e8f5ca701) parted a board on a Yawn aimed at a
 * Hatterene: the authority wrote `|move|p2a: Hatterene|Yawn|p1b: Umbreon|[from] ability: Magic Bounce`
 * and drowsed the Umbreon; this engine drowsed the Hatterene. `magicbounce.onTryHit` reflects any move
 * carrying the `reflectable` flag (data/abilities.ts:2427; no Champions row). This engine asks
 * `bounceOff` branch by branch, and a branch that never asks is a whole KIND of move that is never
 * reflected. So this file does not stage Yawn alone: it stages the CLASS — every legal move with the
 * flag, derived from the format — and reports which ones the engines disagree on.
 *
 * ================= EACH ROW ====================================================================
 *
 * One turn (two for a `delayedSleep` move). p1's user (the first legal learner of the move, alphabetically, holding a quiet ability)
 * clicks the move at p2a; p2a is a legal Magic Bounce carrier that spends the turn on a self-boost.
 * The CONTROL is the same carrier species under its other quiet ability — same body, same click — so
 * a row where the two engines agree only because nothing happened is visible as a control that agrees
 * on the same thing. The row passes when the two engines agree on the bounced-line count and the board
 * (`stateDiv`) under Magic Bounce. Nothing is typed: the authority's stream is the answer.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_bounce_reflectable_class.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const G = require(D('engine', 'game_differential.js'));
const TAGS = require(D('engine', 'tags.js'));

const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const learns = (s, mv) => {
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[dex.moves.get(mv).id]);
};
const QUIET = ['onStart', 'onSwitchIn', 'onUpdate', 'onModifyPriority', 'onTryHit', 'onAllyTryHitSide', 'onResidual',
  'onDamagingHit', 'onSetStatus', 'onTryBoost', 'onTryAddVolatile', 'onModifyMove', 'onChangeBoost', 'onAfterEachBoost',
  'onSwitchOut', 'onFoeTrapPokemon', 'onAnyModifyBoost', 'onModifySpe', 'onBeforeMove', 'onDragOut', 'onImmunity'];
const quiet = a => { const x = dex.abilities.get(a); return x.exists && QUIET.every(h => !x[h]); };
const SPECIES = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name)).sort((a, b) => a.name.localeCompare(b.name));
const quietAb = s => Object.values(s.abilities).find(quiet);
const MB = dex.abilities.get('magicbounce').name;
const selfBoost = s => {
  const e = LS[s.id]; if (!e || !e.learnset) return null;
  return Object.keys(e.learnset).map(id => dex.moves.get(id))
    .filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.onHit && !m.onTry
      && !m.volatileStatus && !m.heal && m.priority === 0)
    .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
};
const BOUNCERS = SPECIES.filter(s => Object.values(s.abilities).includes(MB) && quietAb(s) && selfBoost(s) && learns(s, 'protect'));
const BOUNCER = BOUNCERS[0];
const FILL = SPECIES.filter(s => learns(s, 'protect') && quietAb(s) && !Object.values(s.abilities).includes(MB));
if (!BOUNCER || FILL.length < 6) { console.log('NOT RUN — the format no longer supplies this fixture.'); process.exit(2); }
const IDLE = selfBoost(BOUNCER);
const row = (s, moves, ab) => ({ species: s.name, item: '', ability: ab || quietAb(s), moves });
const MOVES = dex.moves.all().filter(m => legal(m) && m.flags.reflectable).sort((a, b) => a.id.localeCompare(b.id));
console.log(NL + '  DERIVED FROM THE FORMAT, NOT TYPED:');
console.log('    bouncer   ' + BOUNCER.name + ' (' + MB + '; control ability ' + quietAb(BOUNCER) + '; idle ' + IDLE.name + ')');
console.log('    ' + MOVES.length + ' legal moves carry `reflectable`');

const lineCount = (lines, re) => (lines || []).map(l => Array.isArray(l) ? '|' + l.join('|') : String(l)).filter(l => re.test(l)).length;
const BOUNCED = /\[from\] ability: Magic ?Bounce/i;
const results = [];
for (const mv of MOVES) {
  if (ONLY && mv.id !== ONLY) continue;
  /* A quiet-ability learner first; failing that, any learner under an ability that neither pierces
   * Magic Bounce (it would suppress the thing measured) nor changes the click's bracket or refusal
   * (Prankster). Read off the ability's own handlers and flags, never a name list. */
  const benign = a => { const x = dex.abilities.get(a); return x.exists && norm(a) !== norm(MB)
    && !/ignoreAbility/.test(String(x.onModifyMove || '')) && !x.onModifyPriority; };
  let user = SPECIES.find(s => learns(s, mv.id) && learns(s, 'protect') && quietAb(s) && s.id !== BOUNCER.id
    && !Object.values(s.abilities).includes(MB));
  let userAb = user && quietAb(user);
  if (!user) {
    user = SPECIES.find(s => learns(s, mv.id) && learns(s, 'protect') && s.id !== BOUNCER.id
      && !Object.values(s.abilities).includes(MB) && Object.values(s.abilities).some(benign));
    userAb = user && Object.values(user.abilities).find(benign);
  }
  if (!user) { results.push({ id: mv.id, verdict: 'NO-LEARNER' }); continue; }
  const fills = FILL.filter(s => s.id !== user.id && s.id !== BOUNCER.id);
  const A = [row(user, [mv.name, 'Protect'], userAb), row(fills[0], ['Protect']), row(fills[1], ['Protect']), row(fills[2], ['Protect'])];
  const click = ['normal', 'any', 'adjacentFoe'].includes(mv.target) ? { m: mv.id, t: 0 } : { m: mv.id };
  /* A drowse only shows on the board a turn later, so a `delayedSleep` move (read off the tag) gets a
   * second, idle turn; every other row is one turn, because a second scripted turn is refused on boards
   * the first turn changed (a Taunt, a Torment, a drag). */
  const late = !!TAGS.param('move', mv.id, 'delayedSleep');
  const script = [{ p1: [click, { m: 'protect' }], p2: [{ m: IDLE.id }, { m: 'protect' }] }];
  if (late) script.push({ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: IDLE.id }, { m: 'protect' }] });
  const out = {};
  for (const [arm, ab] of [['bounce', MB], ['control', quietAb(BOUNCER)]]) {
    const B = [row(BOUNCER, [IDLE.name, 'Protect'], ab), row(fills[3], ['Protect']), row(fills[4], ['Protect']), row(fills[5], ['Protect'])];
    G.resetScriptCounters();
    const pa = G.buildPair(A), pb = G.buildPair(B);
    if (!pa || !pb) { out[arm] = { err: 'NOT-STAGED' }; continue; }
    const r = G.playGame(pa, pb, 'directed', 'probe_bounce_reflectable_class :: ' + mv.id + ' :: ' + arm,
      { script, arm: G.ARM_BY_ID.get('middle') });
    const sc = G.scriptCounters();
    out[arm] = { err: r.err || (sc.moveNotOnRequest ? 'NOT-ON-REQUEST' : null),
      sd: lineCount(G.lastSdLog(), BOUNCED), med: lineCount(r.mediTrace, BOUNCED), state: r.stateDiv, div: r.div };
  }
  const b = out.bounce, c = out.control;
  let verdict;
  if (b.err || c.err) verdict = 'NOT-STAGED ' + (b.err || c.err);
  else if (b.sd !== b.med || b.state) verdict = 'DIFFER';
  else if (c.sd !== c.med || c.state) verdict = 'CONTROL-DIFFER';
  else verdict = b.sd ? 'AGREE-BOUNCED' : 'AGREE-NOT-BOUNCED';
  results.push({ id: mv.id, target: mv.target, user: user.name + '/' + userAb, verdict, b, c });
}
const by = {};
for (const r of results) (by[r.verdict] = by[r.verdict] || []).push(r);
for (const k of Object.keys(by).sort()) {
  console.log(NL + k + '  (' + by[k].length + ')');
  for (const r of by[k]) {
    if (k === 'AGREE-BOUNCED') { console.log('    ' + r.id); continue; }
    const f = x => x ? ('sd ' + x.sd + ' med ' + x.med + (x.state ? ' BOARD ' + JSON.stringify(x.state.diffs || x.state).slice(0, 160) : '')) : '';
    console.log('    ' + String(r.id).padEnd(14) + String(r.target || '').padEnd(15) + String(r.user || '').padEnd(14)
      + ' bounce[' + f(r.b) + ']  control[' + f(r.c) + ']');
  }
}
const differ = (by.DIFFER || []).length + (by['CONTROL-DIFFER'] || []).length;
const unstaged = results.filter(r => /^NOT-STAGED/.test(r.verdict)).length;
console.log(NL + (differ || unstaged ? 'FAIL — ' + differ + ' reflectable move(s) disagree, ' + unstaged + ' not staged' : 'PASS')
  + ' over ' + results.length + ' moves (' + ((by['NO-LEARNER'] || []).length) + ' with no quiet-ability learner, listed above)');
console.log('release ' + REL_ID);
process.exit(differ || unstaged ? 1 : 0);
