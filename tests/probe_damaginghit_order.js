/* probe_damaginghit_order.js — `DamagingHit` IS ONE EVENT, IT RUNS BELOW THE SECONDARIES, AND ITS
 * HANDLERS ARE SORTED BY `onDamagingHitOrder` AND THEN BY TARGET INDEX. THIS ENGINE PAID TWO OF THEM
 * INSIDE THE SECONDARY STEP, A WHOLE STEP EARLY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_damaginghit_order.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `3b30a88ffa23`
 * (`data/game-differential.json`, 961 games, census digest `87d990cf3634`, pool
 * `data/team-pool-frozen`, `--steering empirical --arm middle --end-state --turns 50`). Two of the
 * twelve NARRATION-ONLY `ordering` causes, and they are one mechanism:
 *
 *   omit-weather ...bo3-2661573110   ordering :: |-damage|p1a|[from]roughskin <> |-status|p2a|psn|[from]poisontouch
 *   omit-weather ...bo3-2662074768   ordering :: |-status|p1b|brn        <> |-start|p2b|disable|[from]cursedbody
 *
 * THE RULE, READ OFF THE AUTHORITY.
 *
 *   1. THE EVENT IS ONE EVENT AND IT IS BELOW THE SECONDARIES. `spreadMoveHit` runs
 *      `runMoveEffects` (3), `selfDrops` (4) and `secondaries` (5) and only then
 *      `runEvent('DamagingHit', damagedTargets, pokemon, move, damagedDamage)` (7) —
 *      data/mods/champions/scripts.ts:374-410, the Champions mod's own copy.
 *
 *   2. ITS HANDLERS ARE SORTED LEFT TO RIGHT, NOT BY SPEED. `runEvent` puts `DamagingHit` in the
 *      `compareLeftToRightOrder` branch (sim/battle.ts:789), which is
 *      `order ASC -> priority DESC -> target index ASC` (:421). SIX abilities in this format carry
 *      `onDamagingHitOrder: 1` and everything else defaults — the probe DERIVES that membership and
 *      prints it rather than naming it.
 *
 *   3. WITHIN ONE INDEX the collection order is the body's status, its volatiles, its ABILITY, its
 *      item, and the SOURCE's `onSource…` handlers LAST (`findEventHandlers`, sim/battle.ts:1053-1069).
 *      So a Rough Skin toll (order 1, on the target) is above a Poison Touch poison (no order, on the
 *      source) even though both are index 0.
 *
 * WHAT THIS ENGINE DID. Cursed Body and Poison Touch were paid inside `_stepEffects`, the secondary
 * step. BOTH SITES SAID SO IN THEIR OWN COMMENTS — *"This engine pays it in `_stepEffects`, which is a
 * DIFFERENT STEP and a separate question"* — and the separate question is this file. They are now
 * deferred to `_stepDamagingHitLate`, which is the last two entries of one index in the authority's
 * sorted list.
 *
 * WHAT IS STILL OUT OF ORDER, SAID PLAINLY AND NOT ASSERTED HERE: `_stepDamagingHit` mixes the
 * order-1 punishers with the default-order ones, so a spread hit whose order-1 reactor stands at a
 * HIGHER target index than a default-order reactor still runs them index-major. That is the pool's
 * third row of this mechanism (`-boost p1a def 1 <> -status p2b brn [spicyspray]`) and it is not
 * closed by this pass.
 *
 * THE ARMS:
 *   REAL       a Poison Touch attacker's contact move into an order-1 punisher. Both engines must put
 *              the toll ABOVE the poison. The board is SEARCHED rather than named, because the middle
 *              arm keys its dice on the ADDRESS: the 30% comes out the same on every replay of one
 *              fixture, so the fixture is what decides whether the poison lands at all.
 *   SILENT     the identical board with the attacker's OTHER legal ability. No poison line may appear
 *              in either engine — that is what says the second line is the ability and not the board.
 *   CONTROL    `MEDI_DH_IN_EFFECTS=1` in a child, which pays both handlers back inside `_stepEffects`.
 *              The REAL arm must part under it and the SILENT arm must not move.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_DH_IN_EFFECTS === '1';
require(D('tests', '_live_release.js'));

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const NL = String.fromCharCode(10);
let bad = 0;

const learns = (s, mv) => {
  let cur = s;
  for (let g = 0; cur && g < 6; g++) {
    const l = dex.species.getLearnsetData(cur.id);
    if (l && l.learnset && l.learnset[mv]) return true;
    cur = cur.prevo ? dex.species.get(cur.prevo) : null;
  }
  return false;
};
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''));
const abOf = s => Object.values(s.abilities || {}).map(norm);
const carriers = (ns, tag) => Object.keys(TAGS[ns] || {}).filter(k => ((TAGS[ns][k] || {}).tags || []).includes(tag));

/* ================================================================================================
 * 1. THE CAST, DERIVED FROM THE FORMAT AND FROM OUR OWN TAGS. Nothing is typed from memory.
 * ============================================================================================== */
console.log(NL + '  === THE CAST, DERIVED THIS RUN ===');
const ORDER1 = dex.abilities.all().filter(a => a.exists && !a.isNonstandard && a.onDamagingHitOrder === 1)
  .map(a => a.id).sort();
console.log('  abilities carrying `onDamagingHitOrder: 1` here : ' + (ORDER1.join(', ') || '(none)'));
const PT = carriers('abilities', 'poisonsOnMyContact');
console.log('  `poisonsOnMyContact` abilities in data/tags.json : ' + (PT.join(', ') || '(none)'));
if (!ORDER1.length || !PT.length) { console.log('  NOT STAGED — one of the two families is empty.'); process.exit(1); }

/* THE ONE `onDamagingHitOrder: 1` MEMBER THAT WRITES A LINE OF ITS OWN, so the arm can be READ. The
 * others in the family boost or faint; the toll is the observable one, and it is identified by our
 * own `punishesAttacker` tag intersected with the authority's order list — not by a name. */
const PUNISH1 = carriers('abilities', 'punishesAttacker').filter(a => ORDER1.includes(a));
console.log('  ...of which this engine treats as a PUNISH      : ' + (PUNISH1.join(', ') || '(none)'));
if (!PUNISH1.length) { console.log('  NOT STAGED — no order-1 ability writes a toll line.'); process.exit(1); }

const ATT = POOL.filter(s => abOf(s).some(a => PT.includes(a)) && abOf(s).some(a => !PT.includes(a)));
const DEF = POOL.filter(s => abOf(s).some(a => PUNISH1.includes(a))
  && !s.types.includes('Steel') && !s.types.includes('Poison'));
console.log('  legal Poison-Touch bodies with a SECOND ability : ' + (ATT.map(s => s.name).join(', ') || '(none)'));
console.log('  legal order-1 punishers that can be poisoned    : ' + (DEF.map(s => s.name).join(', ') || '(none)'));
if (!ATT.length || !DEF.length) { console.log('  NOT STAGED — a side of the pairing has no legal body.'); process.exit(1); }

const CONTACT = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category !== 'Status'
  && m.flags && m.flags.contact && m.target === 'normal' && (m.accuracy === true || m.accuracy >= 100)
  && !m.multihit && !m.recoil && !m.selfSwitch && !m.secondaries && !m.secondary
  && m.basePower > 0 && m.basePower <= 70).sort((a, b) => a.id.localeCompare(b.id));
const IDLE = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.selfSwitch && !m.selfdestruct && m.boosts && Object.keys(m.boosts).length
  && Object.values(m.boosts).every(v => v > 0) && !m.boosts.evasion && !m.boosts.accuracy);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js — this probe needs LIVE dice');

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const TOLL = /\|-damage\|.*\[from\] ability: /i;
const PSN = /\|-status\|.*psn.*\[from\] ability: /i;

const run = (C, ability, tag) => {
  const rest = POOL.filter(s => learns(s, 'protect') && ![C.att.id, C.def.id].includes(s.id)).map(s => s.name);
  if (rest.length < 6) return { staged: false, why: 'the bench could not be filled' };
  const A = stage([[C.att.name, '', ability, [C.mv.name, 'Protect']], [rest[0], '', '', ['Protect']],
                   [rest[1], '', '', ['Protect']], [rest[2], '', '', ['Protect']]]);
  const B = stage([[C.def.name, '', C.defAb, ['Protect', C.idle.name]], [rest[3], '', '', ['Protect']],
                   [rest[4], '', '', ['Protect']], [rest[5], '', '', ['Protect']]]);
  /* THE DEFENDER MUST NOT SHIELD. A first cut had it clicking Protect, every arm read "identical",
   * and the fixture proved nothing at all — the same trap `probe_reaction_address.js` records. */
  const script = [{ p1: [{ m: norm(C.mv.id), t: 0 }, { m: 'protect' }],
                    p2: [{ m: norm(C.idle.id) }, { m: 'protect' }] }];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  const r = G.playGame(a, b, 'directed', 'probe_damaginghit_order :: ' + tag, { script, arm: ARM });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) {
    return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  }
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const at = (arr, re) => arr.findIndex(l => re.test(l));
  return { staged: true,
           sdToll: at(sd, TOLL), sdPsn: at(sd, PSN), meToll: at(me, TOLL), mePsn: at(me, PSN),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

/* THE SEARCH. The middle arm keys every draw on the ADDRESS, so replaying one board gives the SAME
 * 30% every time — a fixture either poisons or it never will, and which one it is cannot be reasoned
 * out. Candidates are tried in a derived order and the first one where the AUTHORITY writes both
 * lines is taken; a refusal names the clause it failed. */
const CANDS = [];
for (const att of ATT) {
  for (const mv of CONTACT.filter(m => learns(att, m.id)).slice(0, 8)) {
    for (const def of DEF) {
      if (def.id === att.id) continue;
      const idle = IDLE.find(m => learns(def, m.id));
      const ptAb = Object.values(att.abilities).find(a => PT.includes(norm(a)));
      const quiet = Object.values(att.abilities).find(a => !PT.includes(norm(a)));
      const defAb = Object.values(def.abilities).find(a => PUNISH1.includes(norm(a)));
      if (!idle || !ptAb || !quiet || !defAb) continue;
      CANDS.push({ att, mv, def, idle, ptAb, quiet, defAb });
    }
  }
}
console.log('  candidate boards                               : ' + CANDS.length);
if (!CANDS.length) { console.log('  NOT STAGED — no (attacker, contact move, punisher) triple fits.'); process.exit(1); }

let CAST = null, REAL = null;
const refused = [];
for (const C of CANDS.slice(0, 60)) {
  const label = C.att.name + ' [' + C.ptAb + '] ' + C.mv.name + ' -> ' + C.def.name + ' [' + C.defAb + ']';
  const R = run(C, C.ptAb, CHILD ? 'real-control' : 'real');
  if (!R.staged) { refused.push(label + ': ' + R.why); continue; }
  const why = R.sdToll < 0 ? 'the authority never paid the toll'
            : R.sdPsn < 0 ? 'the authority never landed the poison (the 30% at this address is above the line)'
            : null;
  if (why) { refused.push(label + ': ' + why); continue; }
  CAST = C; REAL = R; break;
}
if (!CAST) {
  console.log(NL + '  NOT STAGED — every candidate was refused, and this is a claim about the FIXTURE:');
  for (const x of refused.slice(0, 10)) console.log('    ' + x);
  process.exit(1);
}
console.log(NL + '  chosen: ' + CAST.att.name + ' @ ' + CAST.ptAb + ' clicks ' + CAST.mv.name + ' at '
  + CAST.def.name + ' @ ' + CAST.defAb + ', which idles on ' + CAST.idle.name + '.');
console.log('          silent-arm ability on the same attacker: ' + CAST.quiet);
console.log('          ' + (refused.length ? refused.length + ' earlier candidate(s) refused, first: ' + refused[0]
                                           : 'the first candidate staged'));

const SIL = run(CAST, CAST.quiet, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log(NL + '  NOT STAGED (silent) — ' + SIL.why); process.exit(1); }

const show = (tag, R) => {
  console.log(NL + '  === ' + tag + ' ===');
  console.log('    line index of the order-1 TOLL   showdown ' + R.sdToll + '   medicham2 ' + R.meToll);
  console.log('    line index of the POISON         showdown ' + R.sdPsn + '   medicham2 ' + R.mePsn);
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
};
show('REAL — ' + CAST.ptAb + ' on the attacker', REAL);
show('SILENT — the same board, attacker ability ' + CAST.quiet, SIL);

if (CHILD) {
  console.log(NL + '  CONTROL ARM (MEDI_DH_IN_EFFECTS=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    cast: CAST.att.name + '/' + CAST.mv.name + '/' + CAST.def.name,
    meToll: REAL.meToll, mePsn: REAL.mePsn, realDiv: !!REAL.div, realDivLine: REAL.div && REAL.div.me,
    silPsn: SIL.mePsn, silDiv: !!SIL.div }));
  console.log(NL + 'green — the control arm ran');
  process.exit(0);
}

console.log(NL + '  === THE VERDICT ===');
const cmp = (what, ok, detail) => {
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + detail);
  if (!ok) bad++;
  return ok;
};
/* THE FIXTURE FIRST, ON THE AUTHORITY'S OWN STREAM. */
cmp('the fixture: the authority paid the order-1 toll', REAL.sdToll >= 0, 'line ' + REAL.sdToll);
cmp('the fixture: and landed the poison on the same hit', REAL.sdPsn >= 0, 'line ' + REAL.sdPsn);
cmp('the authority puts the TOLL above the POISON', REAL.sdToll < REAL.sdPsn,
    REAL.sdToll + ' < ' + REAL.sdPsn + '   [order 1 beats no order, whatever the index]');
/* THEN THE ENGINE. */
cmp('medicham2 paid the toll too', REAL.meToll >= 0, 'line ' + REAL.meToll);
cmp('medicham2 landed the same poison', REAL.mePsn >= 0, 'line ' + REAL.mePsn);
cmp('medicham2 puts the toll above the poison too', REAL.meToll >= 0 && REAL.mePsn >= 0 && REAL.meToll < REAL.mePsn,
    REAL.meToll + ' < ' + REAL.mePsn);
cmp('the REAL arm does not part at all', REAL.div === null, REAL.div ? JSON.stringify(REAL.div) : 'none');
/* AND THE SILENT CONTROL — the same board with no Poison Touch writes NO poison line in either
 * engine. A probe whose two arms produce the same lines is measuring the board, not the mechanic. */
cmp('SILENT: the authority writes no poison without the ability', SIL.sdPsn < 0, 'line ' + SIL.sdPsn);
cmp('SILENT: medicham2 writes none either', SIL.mePsn < 0, 'line ' + SIL.mePsn);
cmp('SILENT: the toll still happens, so the board is otherwise the same', SIL.sdToll >= 0 && SIL.meToll >= 0,
    'showdown ' + SIL.sdToll + ', medicham2 ' + SIL.meToll);
cmp('SILENT: and that game does not part', SIL.div === null, SIL.div ? JSON.stringify(SIL.div) : 'none');
cmp('THE TWO ARMS DISAGREE, so the poison line is the ability', (REAL.sdPsn >= 0) !== (SIL.sdPsn >= 0),
    'real ' + REAL.sdPsn + ' vs silent ' + SIL.sdPsn);

{
  const { spawnSync } = require('child_process');
  console.log(NL + '  --- re-running under MEDI_DH_IN_EFFECTS=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_DH_IN_EFFECTS: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(c.stdout || '');
  process.stdout.write(out.split(NL).map(l => '  |' + l).join(NL) + NL);
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log(NL + '  RED — the control child did not run at all.'); bad++; }
  else if (!mark) { console.log(NL + '  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    cmp('the control child staged the SAME board',
        ctl.cast === CAST.att.name + '/' + CAST.mv.name + '/' + CAST.def.name, ctl.cast);
    cmp('the knob INVERTS the real arm', ctl.mePsn >= 0 && ctl.meToll >= 0 && ctl.mePsn < ctl.meToll,
        'default toll ' + REAL.meToll + ' / poison ' + REAL.mePsn + ' vs control toll ' + ctl.meToll
        + ' / poison ' + ctl.mePsn
        + ((ctl.mePsn === REAL.mePsn && ctl.meToll === REAL.meToll)
           ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    cmp('the control arm parts on its own line, so the knob reached the RULE', ctl.realDiv === true,
        ctl.realDivLine ? String(ctl.realDivLine) : 'no divergence at all');
    cmp('the SILENT arm does NOT move under the knob', ctl.silPsn === SIL.mePsn,
        'default ' + SIL.mePsn + ' vs control ' + ctl.silPsn);
    cmp('...and the silent arm still does not part under the knob', ctl.silDiv === false, String(ctl.silDiv));
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
