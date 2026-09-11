/* probe_encore_pp_end.js — DOES ENCORE END EARLY WHEN THE ENCORED MOVE RUNS OUT OF PP?
 *
 *   SHOWDOWN_PATH=... node tests/probe_encore_pp_end.js [--release <id>]
 *
 * READ, NOT GATED ON. It stages the case, prints both engines' answer and exits 0 whatever it finds;
 * it exits 1 only when it could not stage. The finding is registered, not fixed, in this batch.
 *
 * ================= THE QUESTION ==================================================================
 *
 * Five top-corner board-material games on release 8ac9c4d888f1 part on `vol.encore` (medicham2 2 or 1,
 * the authority 0), four of them with the protocol card `|-end|<mon>|Encore` <> `|upkeep` and the fifth an
 * Encored Incineroar that repeats Flare Blitz in the authority and clicks Parting Shot here. Two readings
 * were on the table:
 *   (a) FORMATTING — this engine writes `|-end|<mon>|move: encore` and the normaliser misses it;
 *   (b) MECHANIC — `encore.condition.onResidual` (data/moves.ts, order 16, inherited by the Champions
 *       override) ends the volatile when the encored move's slot is at 0 PP:
 *           const moveSlot = target.getMoveData(this.effectState.move);
 *           if (!moveSlot || moveSlot.pp <= 0) target.removeVolatile('encore');
 *       and this engine has no such end.
 *
 * ================= THE ARMS — under `top-tie-first` =============================================
 *
 *   RUN-OUT   the target clicks a 5-PP move every turn. Its SLOT holds `maxpp = pp * 8 / 5` (PP Ups;
 *             read off the format, not typed — the first version of this file assumed 5 and never reached
 *             0), so after maxpp-1 uses it stands at 1 PP, the slower foe's Encore lands after that use,
 *             and the next turn's forced use spends the last PP. The move is a WEATHER move, derived: it
 *             fails harmlessly on a repeat and still spends its PP, and it carries no stall die (a Protect
 *             run cannot be used: the seventh alternating Protect always succeeds and blocks the Encore)
 *   FULL-PP   the same turns on a self-boost move with PP to spare — the knob cleared on one field
 *   NATURAL   FULL-PP played on until Encore expires by its clock, so both engines' `-end` lines are
 *             printed side by side and the comparator's own verdict on them is read (reading (a))
 *
 * Nothing is typed: the authority's `-end` lines and the `vol.encore` / PP leaves are the expectation.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
require(path.join(ROOT, 'engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('ENCORE PP END');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const SP = process.env.SHOWDOWN_PATH;
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const learns = (sp, mv) => !!CS.canLearn(sp, mv);
const fnKeys = o => Object.keys(o).filter(k => /^on[A-Z]/.test(k) && typeof o[k] === 'function');
const HARMLESS = /^on(ModifySpe|SetStatus|TryAddVolatile|Immunity|DragOut|TrapPokemon|MaybeTrapPokemon|FoeTrapPokemon|FoeMaybeTrapPokemon|Update|CheckShow)$/;
const quietAb = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a))
  .find(a => a.exists && fnKeys(a).every(k => HARMLESS.test(k))) || null;
const rawLearnset = sp => ((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {};
const selfBoost = m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts
  && !Object.keys(m.boosts).some(k => k === 'accuracy' || k === 'evasion') && !fnKeys(m).length
  && !m.heal && !m.volatileStatus && !m.self && !m.secondary && !m.stallingMove && !m.sideCondition
  && !m.weather && !m.terrain && !m.pseudoWeather && m.pp >= 10;
const selfMoves = sp => Object.keys(rawLearnset(sp)).map(id => D.moves.get(id)).filter(selfBoost)
  .filter(m => learns(sp, m.id)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2);
const maxpp = m => (m.noPPBoosts ? m.pp : Math.floor(m.pp * 8 / 5));

console.log(NL + 'tests/probe_encore_pp_end.js — does Encore end when the encored move reaches 0 PP?');
console.log('  encore.condition.onResidual: ' + String((D.moves.get('encore').condition || {}).onResidual || '').replace(/\s+/g, ' ').slice(0, 200));

/* THE RUN-OUT MOVE, DERIVED: a legal Status weather move at the format's lowest PP, no stall die. */
/* the LOWEST PP is taken over the candidates themselves: taken over every legal move it was 1 (a move no
 * weather setter shares), and the first run of this line found no candidate at all */
const WEATHERS = D.moves.all().filter(m => legal(m) && m.category === 'Status' && m.weather && m.pp > 0
  && !m.flags.failencore && !m.stallingMove);
const LOWEST = Math.min(...WEATHERS.map(m => m.pp));
const RUNOUT = WEATHERS.filter(m => m.pp === LOWEST).sort((a, b) => a.name.localeCompare(b.name));
console.log('  run-out candidates (Status weather moves at ' + LOWEST + ' PP): ' + RUNOUT.map(m => m.name + ' maxpp ' + maxpp(m)).join(', '));
/* the cast: every body derived, every move asked of the validator */
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly && quietAb(s))
  .sort((a, b) => a.name.localeCompare(b.name));
const withTwo = SPEC.filter(s => selfMoves(s.name).length >= 2);
let TARGET = null, X = null;
for (const m of RUNOUT) {
  const t = withTwo.filter(s => learns(s.name, m.id)).sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0];
  if (t) { TARGET = t; X = m; break; }
}
const ENCORER = TARGET && withTwo.filter(s => learns(s.name, 'encore') && s.baseStats.spe < TARGET.baseStats.spe && s.id !== TARGET.id)
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe)[0];
if (!TARGET || !ENCORER) { console.log('  NOT STAGED — no legal target or encorer'); process.exit(1); }
const FILL = withTwo.filter(s => s.id !== TARGET.id && s.id !== ENCORER.id).slice(0, 6);
if (FILL.length < 6) { console.log('  NOT STAGED — fewer than six fillers'); process.exit(1); }
const body = (s, lead) => { const m = selfMoves(s.name); return { species: s.name, ability: quietAb(s).name, s1: m[0].id, s2: m[1].id,
  moves: lead.concat([m[0].name, m[1].name]) }; };
const T = body(TARGET, [X.name]), E = body(ENCORER, ['Encore']), Fb = FILL.map(s => body(s, []));
const N = maxpp(X);
console.log('  run-out move ' + X.name + ' (pp ' + X.pp + ', slot maxpp ' + N + ')');
console.log('  target  ' + T.species + ' (' + T.ability + ', spe ' + TARGET.baseStats.spe + ')  ' + T.moves.join(', '));
console.log('  encorer ' + E.species + ' (' + E.ability + ', spe ' + ENCORER.baseStats.spe + ')  ' + E.moves.join(', '));
const set = b => ({ species: b.species, item: '', ability: b.ability, moves: b.moves });
const A = [set(E), set(Fb[0]), set(Fb[1]), set(Fb[2])], B = [set(T), set(Fb[3]), set(Fb[4]), set(Fb[5])];
const c = id => ({ m: id });
/* turn i (0-based): the Encore lands on turn N-1 (1-based), right after the use that leaves 1 PP */
const turn = (tMove, encoreOn, i) => ({ p1: [i === encoreOn ? { m: 'encore', t: 0 } : c(i % 2 ? E.s1 : E.s2), c(i % 2 ? Fb[0].s1 : Fb[0].s2)],
                                       p2: [c(tMove), c(i % 2 ? Fb[3].s1 : Fb[3].s2)] });
const SCRIPT = (mv, n) => Array.from({ length: n }, (_, i) => turn(mv, N - 2, i));

const G = SB.harness();
const ARM = G.ARM_BY_ID.get('top-tie-first');
function play(tag, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair dropped a body' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_encore_pp_end :: ' + tag, { script, arm: ARM,
    onBoundary: (s, ti) => { boards.push({ turn: ti, diffs: (s.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      s.identical = true; s.diffs = []; } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const at = (xs, re) => { const out = []; let t = 0; for (const l of xs) { const m = /^\|turn\|(\d+)/.exec(l); if (m) t = +m[1];
    if (re.test(l)) out.push('t' + t + ' ' + l); } return out; };
  const END = /^\|-end\|p2a[^|]*\|(move: )?encore$/i, START = /^\|-start\|p2a[^|]*\|(move: )?encore$/i;
  return { staged: true, turns: r.turns, sdEnd: at(sd, END), meEnd: at(me, END), sdStart: at(sd, START), meStart: at(me, START), boards,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
const R = { 'RUN-OUT': play('run-out', SCRIPT(X.id, N)), 'FULL-PP': play('full-pp', SCRIPT(T.s1, N)),
            NATURAL: play('natural', SCRIPT(T.s1, N + 4)) };
for (const [tag, x] of Object.entries(R)) {
  console.log(NL + '  === ' + tag + ' ===');
  if (!x.staged) { console.log('    NOT STAGED — ' + x.why); process.exit(1); }
  console.log('    turns played ' + x.turns);
  console.log('    encore lands  showdown ' + (x.sdStart.join('  ') || 'NEVER') + '   medicham2 ' + (x.meStart.join('  ') || 'NEVER'));
  console.log('    encore ends   showdown ' + (x.sdEnd.join('  ') || 'none') + '   medicham2 ' + (x.meEnd.join('  ') || 'none'));
  for (const b of x.boards.filter(b => b.diffs.length)) console.log('    board t' + b.turn + ': ' + b.diffs.slice(0, 5).join(', '));
  if (!x.boards.some(b => b.diffs.length)) console.log('    boards: identical at every boundary');
  console.log('    comparator\'s first protocol divergence: ' + (x.div ? JSON.stringify(x.div) : 'none — the streams agree after normalisation'));
}
const ro = R['RUN-OUT'], fp = R['FULL-PP'], nat = R.NATURAL;
const staged = ro.sdStart.length > 0;
console.log(NL + '  VERDICT');
if (!staged) { console.log('    RUN-OUT did not stage: the authority never landed the Encore. Nothing below is evidence.'); process.exit(1); }
console.log('    (b) MECHANIC  — on the run-out turn the authority ends Encore: ' + (ro.sdEnd.length ? 'YES (' + ro.sdEnd[0] + ')' : 'no')
  + '; this engine: ' + (ro.meEnd.length ? 'YES (' + ro.meEnd[0] + ')' : 'NO') + '; boards ' + (ro.boards.some(b => b.diffs.length) ? 'PART' : 'agree'));
console.log('    control       — with PP to spare the authority keeps Encore through turn ' + N + ': ' + (fp.sdEnd.length ? 'NO, it ended ' + fp.sdEnd[0] : 'yes')
  + '; boards ' + (fp.boards.some(b => b.diffs.length) ? 'PART' : 'agree'));
console.log('    (a) FORMAT    — natural expiry: showdown ' + (nat.sdEnd[0] || 'none') + ' / medicham2 ' + (nat.meEnd[0] || 'none')
  + '; comparator ' + (nat.div ? 'PARTS: ' + JSON.stringify(nat.div) : 'agrees'));
/* `--assert` IS THE REGISTER'S VERIFIED-BY FORM: it exits 1 while the two engines part on RUN-OUT (the
 * defect stands) and 0 once they agree, so the row's instrument answers with its exit code. Without the
 * flag this file only reads. The control must hold in both modes, or nothing here is about PP. */
if (process.argv.includes('--assert')) {
  const parts = ro.boards.some(b => b.diffs.length) || ro.sdEnd.join() !== ro.meEnd.join().replace(/move: encore/gi, 'Encore');
  const ctlHolds = !fp.boards.some(b => b.diffs.length) && !fp.sdEnd.length;
  console.log('  --assert: RUN-OUT ' + (parts ? 'PARTS (defect stands)' : 'agrees') + ', FULL-PP control ' + (ctlHolds ? 'holds' : 'DOES NOT HOLD'));
  process.exit(!ctlHolds || parts ? 1 : 0);
}
process.exit(0);
