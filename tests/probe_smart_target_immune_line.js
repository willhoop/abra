/* probe_smart_target_immune_line.js — A SMART-TARGET MOVE'S TYPE IMMUNITY IS ANNOUNCED WITH THE SAME
 * ONE-SHOT THAT SILENCES ITS SHIELD LINE, AND THIS ENGINE ANNOUNCED IT ALWAYS.
 *
 *   SHOWDOWN_PATH=... node tests/probe_smart_target_immune_line.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential on release `2a90ecca8005`
 * (`data/game-differential.json`; `--steering empirical --arm middle --end-state --games 1200
 * --team-store data/team-pool-frozen --turns 50`, 961 games, 958 non-void). One of the 21
 * NARRATION-ONLY causes:
 *
 *   config omit-weather, seed ...2634... — extra event emitted by medicham2 ::
 *     |-damage|p2a|H/H <> |-immune|p2b
 *
 *     agreed, immediately before   |move|p1b: Dragapult|Dragon Darts|p2a: Gengar
 *     then   showdown    |-damage|p2a: Gengar|81/135
 *                        |-damage|p2a: Gengar|24/135          <- both darts, and NO immunity line
 *            medicham2   |-immune|p2b: Primarina              <- an extra line
 *                        |-damage|p2a: Gengar|81/135
 *                        |-damage|p2a: Gengar|24/135
 *
 * THE CLASS NAMES THE COMPARATOR, NOT THE DEFECT. Nothing is mis-ordered: medicham2 writes a line the
 * authority does not write at all, and the comparator reports the first pair that fails to match.
 *
 * THE RULE, READ OFF THE AUTHORITY RATHER THAN RECALLED.
 *
 *     hitStepTypeImmunity(targets, pokemon, move) {
 *       ...
 *       for (const i of targets.keys()) {
 *         hitResults[i] = targets[i].runImmunity(move, !move.smartTarget);
 *       }                                                     sim/battle-actions.ts:653-662
 *
 *     runImmunity(source, message?) {
 *       ...
 *       if (!message) return false;              <- NO LINE AT ALL
 *       if (notImmune === null) { ... '[from] ability: Levitate' ... }
 *       else { this.battle.add('-immune', this); }
 *       return false;                                             sim/pokemon.ts (runImmunity tail)
 *
 * -- so for a move whose `smartTarget` is still set, a type immunity is refused SILENTLY. It is the
 * same field, and therefore the same one-shot, that already silences the shield line
 * (`tests/probe_smart_target_shield_line.js`), and the two roads spend it between them:
 *
 *     protect.condition.onTryHit   if (move.smartTarget) { move.smartTarget = false; } else { add(...) }
 *                                                                          data/moves.ts (each shield)
 *     trySpreadMoveHit             if (move.smartTarget && atLeastOneFailure) move.smartTarget = false;
 *                                                                          sim/battle-actions.ts:607
 *     getSmartTargets              move.smartTarget = false   when the darts cannot split
 *                                                                          sim/pokemon.ts:757-768
 *
 * Champions overrides NEITHER `hitStepTypeImmunity` NOR `runImmunity` (asserted below on every run;
 * `data/mods/champions/scripts.ts` overrides `hitStepMoveHitLoop` and `spreadMoveHit` and neither of
 * these), so the mainline lines above are the rule for this format.
 *
 * THE ARMS.
 *   REAL       the smart move into a side holding one immune body and one that is not. The authority
 *              writes ZERO `-immune` and lands both darts on the other foe. THIS IS THE RED ARM.
 *   PLAIN      a NON-smart single-target move OF THE SAME TYPE, aimed at the same immune body. Both
 *              engines must write exactly ONE `-immune`. Without it a green REAL arm is
 *              indistinguishable from an engine that has stopped announcing immunities at all.
 *   SPENT      the smart move again, with the OTHER foe SHIELDED. The shield answers at
 *              `hitStepTryHitEvent` (step 2), spends the one-shot in silence, and the immunity at
 *              step 3 is then ANNOUNCED. Same move, same immune body, and the line comes back — which
 *              is what stops the fix being read as "a smart move never announces an immunity".
 *   DAMAGE     asserted on every arm: the two darts still land on the surviving foe in both engines,
 *              so silencing the line cannot be mistaken for dropping the volley.
 *   CONTROL    `MEDI_SMART_IMMUNE_LINE=1` restores the announcement in a child. It must move REAL and
 *              must NOT move PLAIN or SPENT — an identical result across a varied knob means the knob
 *              is unwired, not that the rule does not matter.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_SMART_IMMUNE_LINE === '1';
/* THE RELEASE IS REDIRECTED TO A SCRATCH STORE. Requiring `engine/game_differential.js` without a
 * `--release` CUTS one as a side effect and repoints `data/engine-release.json` under whatever else
 * is measuring; batch T left 17 stray release directories exactly this way. */
require(D('tests', '_live_release.js'));

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const NL = String.fromCharCode(10);
let bad = 0;

/* ================================================================================================
 * 0. WHAT THE FORMAT SAYS, ASKED RATHER THAN ASSUMED
 * ============================================================================================== */
console.log(NL + '  === THE AUTHORITY, RE-DERIVED THIS RUN ===');
{
  const fs = require('fs');
  const SP = process.env.SHOWDOWN_PATH;
  const scripts = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  for (const fn of ['hitStepTypeImmunity', 'runImmunity']) {
    const overridden = new RegExp('(^|[^A-Za-z])' + fn + '\\s*\\(').test(scripts);
    console.log('  champions overrides ' + fn + (' ').repeat(Math.max(0, 20 - fn.length))
      + ': ' + (overridden ? 'YES' : 'no'));
    if (overridden) { console.log('  RED — the mainline lines quoted in this header are not the rule here.'); bad++; }
  }
  const moves = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const smOver = /^\tdragondarts:/m.test(moves);
  console.log('  champions overrides dragondarts     : ' + (smOver ? 'YES' : 'no'));
  const act = fs.readFileSync(path.join(SP, 'sim', 'battle-actions.ts'), 'utf8');
  const line = /runImmunity\(move,\s*!move\.smartTarget\)/.test(act);
  console.log('  `runImmunity(move, !move.smartTarget)` present in sim/battle-actions.ts : ' + line);
  if (!line) { console.log('  RED — the clause this probe is built on is not in the source.'); bad++; }
}

/* ================================================================================================
 * 1. THE CAST, DERIVED FROM THE FORMAT. Nothing here is a remembered Pokemon fact.
 * ============================================================================================== */
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

console.log(NL + '  === THE CAST, DERIVED THIS RUN ===');
const SMART = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.smartTarget)
  .sort((a, b) => a.id.localeCompare(b.id));
console.log('  moves carrying `smartTarget` in this format : '
  + (SMART.map(m => m.name + ' (' + m.type + ', multihit ' + JSON.stringify(m.multihit) + ')').join(', ') || '(none)'));
if (!SMART.length) { console.log('  NOT STAGED — the format carries no smart-target move.'); process.exit(1); }
const SM = SMART[0];

const USERS = POOL.filter(s => learns(s, SM.id));
console.log('  legal carriers of ' + SM.name + '                : ' + (USERS.map(s => s.name).join(', ') || '(none)'));
if (!USERS.length) { console.log('  NOT STAGED — no legal carrier of the smart move.'); process.exit(1); }
const USER = USERS[0];

/* THE PLAIN CONTROL CLICK MUST BE THE SAME TYPE, or it is not the same immunity being asked about. */
const PLAINS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category !== 'Status'
  && m.type === SM.type && !m.smartTarget && m.priority === 0 && !m.secondaries && !m.secondary
  && !m.recoil && !m.selfSwitch && !(m.flags && m.flags.charge) && !m.multihit
  && (m.accuracy === true || m.accuracy >= 100) && m.target === 'normal'
  && (m.flags && m.flags.protect) && learns(USER, m.id)).sort((a, b) => a.id.localeCompare(b.id));
console.log('  plain ' + SM.type + '-type clicks the same body knows : '
  + (PLAINS.map(m => m.name).join(', ') || '(none)'));
if (!PLAINS.length) { console.log('  NOT STAGED — the carrier knows no plain same-type single-target move.'); process.exit(1); }
const PLAIN = PLAINS[0];

/* IMMUNE AND NOT-IMMUNE ARE BOTH DERIVED OFF THE TYPE CHART, never named. */
const IMMUNES = POOL.filter(s => s.id !== USER.id && !dex.getImmunity(SM.type, s.types) && learns(s, 'protect'));
const HITTABLE = POOL.filter(s => s.id !== USER.id && dex.getImmunity(SM.type, s.types)
  && learns(s, 'protect') && !IMMUNES.some(x => x.id === s.id));
console.log('  bodies IMMUNE to ' + SM.type + ' that learn Protect      : ' + IMMUNES.length
  + '   e.g. ' + IMMUNES.slice(0, 4).map(s => s.name + ' [' + s.types.join('/') + ']').join(', '));
if (IMMUNES.length < 2 || HITTABLE.length < 5) {
  console.log('  NOT STAGED — the two halves of the board could not be filled.'); process.exit(1);
}
const IMM = IMMUNES[0];
/* THE HITTABLE FOE NEEDS AN IDLE CLICK OF ITS OWN. REAL and SPENT differ in exactly one bit — whether
 * that body shielded — so it must be able to do something that is not Protect and does not touch the
 * board: a pure self-targeting status move, derived rather than named. */
/* A PURE SELF-BOOST AND NOTHING ELSE. The first draft took any `target: 'self'` status move and the
 * alphabetical winner was ALLY SWITCH, which swaps the two foe slots mid-turn — so every arm's board
 * map inverted under it and three assertions went red against a fixture that had moved. No evasion and
 * no accuracy either, for the shield probe's reason: a missed click reads exactly like a fixture that
 * cannot be built. */
const SELF_STATUS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.selfSwitch && !m.selfdestruct && !(m.flags && m.flags.charge)
  && m.boosts && Object.keys(m.boosts).length
  && Object.values(m.boosts).every(v => v > 0) && !m.boosts.evasion && !m.boosts.accuracy)
  .sort((a, b) => a.id.localeCompare(b.id));
const HIT = HITTABLE.find(s => SELF_STATUS.some(m => learns(s, m.id)));
if (!HIT) { console.log('  NOT STAGED — no hittable foe with an idle self-click.'); process.exit(1); }
const HIT_IDLE = SELF_STATUS.find(m => learns(HIT, m.id));
/* AND THE IMMUNE BODY IDLES ON EVERY ARM. The first draft had it clicking Protect, so the shield
 * answered at step 2 and NO arm ever reached the type-immunity step at all — three assertions red
 * against a fixture that had never staged the mechanic. */
const IMM_IDLE = SELF_STATUS.find(m => learns(IMM, m.id));
if (!IMM_IDLE) { console.log('  NOT STAGED — the immune body knows no idle self-click.'); process.exit(1); }
const REST = HITTABLE.filter(s => s.id !== HIT.id);
if (REST.length < 4) { console.log('  NOT STAGED — the benches could not be filled.'); process.exit(1); }
const ALLY = REST[0];
const BENCH = [REST[1].name, REST[2].name, REST[3].name];
console.log('  the board                                  : ' + USER.name + ' + ' + ALLY.name
  + '   vs   ' + HIT.name + ' (slot 0, hittable) + ' + IMM.name + ' (slot 1, IMMUNE)');
console.log('  slot-0 idle click for the REAL arm         : ' + HIT_IDLE.name);

/* ================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const isImm = l => /^\|-immune\|/.test(String(l));
const isDmg = l => /^\|-damage\|/.test(String(l));
const isAct = l => /^\|-activate\|/.test(String(l)) && /move: Protect/i.test(String(l));
const bodyOf = l => String(l).split('|')[2] || '';
const slotOf = l => (/^(p[12][ab])\s*:/.exec(bodyOf(l)) || [null, null])[1];

const run = (click, aimSlot, foeAClick, tag) => {
  const A = stage([[USER.name, '', '', [SM.name, PLAIN.name, 'Protect']],
                   [ALLY.name, '', '', ['Protect']],
                   [BENCH[0], '', '', ['Protect']], [BENCH[1], '', '', ['Protect']]]);
  const B = stage([[HIT.name, '', '', ['Protect', HIT_IDLE.name]],
                   [IMM.name, '', '', ['Protect', IMM_IDLE.name]],
                   [BENCH[2], '', '', ['Protect']], [IMMUNES[1].name, '', '', ['Protect']]]);
  const script = [{ p1: [{ m: norm(click), t: aimSlot }, { m: 'protect' }],
                    p2: [{ m: norm(foeAClick) }, { m: norm(IMM_IDLE.id) }] }];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  const r = G.playGame(a, b, 'directed', 'probe_smart_target_immune_line :: ' + tag, { script });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) {
    return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  }
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const dmgOn = arr => arr.filter(isDmg).map(slotOf).filter(s => s === 'p2a' || s === 'p2b');
  /* WHICH SLOT HOLDS WHICH BODY IS READ OFF THE STREAM, NEVER ASSUMED FROM THE ORDER THE TEAM WAS
   * WRITTEN IN. `buildPair` does not preserve it — the first draft asserted `p2b` for the immune body
   * and the board had put it in `p2a`, so three arms went red against a fixture that was correct. */
  const slots = {};
  for (const l of sd) {
    const g = /^\|switch\|(p[12][ab]): ([^|,]+)/.exec(l);
    if (g && !slots[g[1]]) slots[g[1]] = g[2].trim();
  }
  if (process.env.PROBE_DUMP === '1') {
    console.log('  [dump ' + tag + '] SD'); sd.slice(0, 16).forEach(l => console.log('     ' + l));
    console.log('  [dump ' + tag + '] ME'); me.slice(0, 16).forEach(l => console.log('     ' + l));
  }
  return { staged: true, r, slots,
           imm: Object.keys(slots).find(k => slots[k] === IMM.name),
           hit: Object.keys(slots).find(k => slots[k] === HIT.name),
           sd: sd.filter(isImm).map(slotOf), me: me.filter(isImm).map(slotOf),
           sdAct: sd.filter(isAct).map(slotOf), meAct: me.filter(isAct).map(slotOf),
           sdDmg: dmgOn(sd), meDmg: dmgOn(me),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

/* REAL and SPENT differ in exactly ONE BIT: whether the hittable foe shielded. Everything else — the
 * two teams, the aim, the immune body — is identical, so nothing but the one-shot can explain a
 * difference between them. */
/* THE AIM IS VERIFIED AGAINST THE BOARD THE GAME ACTUALLY BUILT, NOT AGAINST THE ORDER THE TEAM WAS
 * WRITTEN IN. `playGame` does not guarantee that slot 0 holds the first body on the sheet — measured
 * here, two arms built from the SAME sheet put the immune body in different slots — so a probe that
 * hard-codes `p2b` is asserting about a fixture it has not checked. `aimAt` tries each foe index and
 * keeps the game whose OWN stream shows the intended body in the slot it aimed at. */
const aimAt = (wantSpecies, click, foeAClick, tag) => {
  let last = null;
  for (const i of [0, 1]) {
    const r = run(click, i, foeAClick, tag);
    if (!r.staged) { last = r; continue; }
    if (r.slots['p2' + 'ab'[i]] === wantSpecies) return r;
    last = { staged: false, why: 'index ' + i + ' aimed at ' + r.slots['p2' + 'ab'[i]]
             + ', wanted ' + wantSpecies + '  (board ' + JSON.stringify(r.slots) + ')' };
  }
  return last || { staged: false, why: 'no arm staged' };
};

const REALB = aimAt(HIT.name, SM.id, HIT_IDLE.id, CHILD ? 'real-control' : 'real');
if (!REALB.staged) { console.log(NL + '  NOT STAGED (real) — ' + REALB.why); process.exit(1); }
/* PLAIN aims straight at the IMMUNE body, because a non-smart single-target click does not widen. */
const PLN = aimAt(IMM.name, PLAIN.id, HIT_IDLE.id, CHILD ? 'plain-control' : 'plain');
if (!PLN.staged) { console.log(NL + '  NOT STAGED (plain) — ' + PLN.why); process.exit(1); }
/* SPENT: the hittable foe SHIELDS, so the shield road eats the one-shot at step 2 and the immunity at
 * step 3 is announced. */
const SPENT = aimAt(HIT.name, SM.id, 'protect', CHILD ? 'spent-control' : 'spent');
if (!SPENT.staged) { console.log(NL + '  NOT STAGED (spent) — ' + SPENT.why); process.exit(1); }

const show = (tag, R) => {
  console.log(NL + '  === ' + tag + ' ===');
  console.log('    the board this game built: ' + JSON.stringify(R.slots)
    + '   (immune ' + R.imm + ', hittable ' + R.hit + ')');
  console.log('    showdown  |-immune x' + R.sd.length + ' ' + JSON.stringify(R.sd)
    + '   |-activate Protect x' + R.sdAct.length + '   |-damage on the foe side ' + JSON.stringify(R.sdDmg));
  console.log('    medicham2 |-immune x' + R.me.length + ' ' + JSON.stringify(R.me)
    + '   |-activate Protect x' + R.meAct.length + '   |-damage on the foe side ' + JSON.stringify(R.meDmg));
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
};
show('REAL — ' + SM.name + ' into [' + HIT.name + ' hittable, ' + IMM.name + ' IMMUNE], neither shielded', REALB);
show('PLAIN — ' + PLAIN.name + ' (not smart) straight at the IMMUNE body', PLN);
show('SPENT — ' + SM.name + ' with the hittable foe SHIELDED, so the one-shot is already gone', SPENT);

if (CHILD) {
  console.log(NL + '  CONTROL ARM (MEDI_SMART_IMMUNE_LINE=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    real: REALB.me, realDiv: !!REALB.div, realDivLine: REALB.div && REALB.div.me,
    plain: PLN.me, plainDiv: !!PLN.div, spent: SPENT.me, spentDiv: !!SPENT.div,
    realDmg: REALB.meDmg }));
  console.log(NL + 'green — the control arm ran');
  process.exit(0);
}

/* ================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '  === THE VERDICT ===');
const cmp = (what, ok, detail) => {
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + detail);
  if (!ok) bad++;
  return ok;
};

/* THE FIXTURE FIRST, OFF THE AUTHORITY'S OWN STREAM. */
cmp('the fixture: the authority writes NO immunity line for the smart move', REALB.sd.length === 0,
    REALB.sd.length + ' line(s) ' + JSON.stringify(REALB.sd));
cmp('the fixture: and both darts still land on the OTHER foe',
    REALB.sdDmg.join(',') === REALB.hit + ',' + REALB.hit,
    JSON.stringify(REALB.sdDmg) + '   [expected ' + REALB.hit + ' twice]');
cmp('medicham2 writes no immunity line either', REALB.me.length === 0,
    REALB.me.length + ' line(s) ' + JSON.stringify(REALB.me));
cmp('...and lands the same two darts, so the silence did not eat the volley',
    REALB.meDmg.join(',') === REALB.sdDmg.join(','),
    'showdown ' + JSON.stringify(REALB.sdDmg) + ' vs medicham2 ' + JSON.stringify(REALB.meDmg));
cmp('the REAL arm does not part at all', REALB.div === null, REALB.div ? JSON.stringify(REALB.div) : 'none');

cmp('PLAIN: the authority announces a NON-smart immunity', PLN.sd.length === 1,
    PLN.sd.length + ' line(s) ' + JSON.stringify(PLN.sd));
cmp('PLAIN: on the immune body', PLN.sd[0] === PLN.imm, String(PLN.sd[0]) + '   [expected ' + PLN.imm + ']');
cmp('PLAIN: medicham2 agrees, so the announcement machinery is not simply off',
    PLN.me.length === 1 && PLN.me[0] === PLN.sd[0], JSON.stringify(PLN.me));
cmp('PLAIN: and that game does not part', PLN.div === null, PLN.div ? JSON.stringify(PLN.div) : 'none');

cmp('SPENT: the shield eats the one-shot, so the authority DOES announce the immunity',
    SPENT.sd.length === 1, SPENT.sd.length + ' line(s) ' + JSON.stringify(SPENT.sd));
cmp('SPENT: and writes no Protect line at all, which is what spent it', SPENT.sdAct.length === 0,
    SPENT.sdAct.length + ' Protect line(s)');
cmp('SPENT: and it names the immune body', SPENT.sd[0] === SPENT.imm,
    String(SPENT.sd[0]) + '   [expected ' + SPENT.imm + ']');
cmp('SPENT: medicham2 announces it too', SPENT.me.length === 1 && SPENT.me[0] === SPENT.sd[0],
    JSON.stringify(SPENT.me));
cmp('SPENT: and that game does not part', SPENT.div === null, SPENT.div ? JSON.stringify(SPENT.div) : 'none');

cmp('THE TWO SMART ARMS DISAGREE, so the silence is the one-shot and not the move',
    REALB.sd.length !== SPENT.sd.length,
    'unshielded ' + REALB.sd.length + ' vs shielded ' + SPENT.sd.length);

/* ================================================================================================
 * 4. THE KNOB
 * ============================================================================================== */
{
  const { spawnSync } = require('child_process');
  const knob = 'MEDI_SMART_IMMUNE_LINE';
  console.log(NL + '  --- re-running under ' + knob + '=1 (a control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, [knob]: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = String(c.stdout || '');
  process.stdout.write(out.split(NL).map(l => '  |' + l).join(NL) + NL);
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log(NL + '  RED — the ' + knob + ' child did not run at all.'); bad++; }
  else if (!mark) { console.log(NL + '  RED — the ' + knob + ' child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    cmp(knob + ': the knob CHANGES the real arm', ctl.real.length === 1,
        'default ' + REALB.me.length + ' line(s) vs control ' + ctl.real.length
        + (ctl.real.length === REALB.me.length
           ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    cmp(knob + ': the control arm parts, so the knob reached the RULE', ctl.realDiv === true,
        ctl.realDivLine ? String(ctl.realDivLine) : 'no divergence at all');
    cmp(knob + ': the darts still land under it, so it moves the LINE and nothing else',
        ctl.realDmg.join(',') === REALB.meDmg.join(','),
        'default ' + JSON.stringify(REALB.meDmg) + ' vs control ' + JSON.stringify(ctl.realDmg));
    cmp(knob + ': PLAIN does NOT move under it', ctl.plain.length === PLN.me.length,
        'default ' + PLN.me.length + ' vs control ' + ctl.plain.length);
    cmp(knob + ': ...and PLAIN still does not part', ctl.plainDiv === false, String(ctl.plainDiv));
    cmp(knob + ': SPENT does NOT move under it either', ctl.spent.length === SPENT.me.length,
        'default ' + SPENT.me.length + ' vs control ' + ctl.spent.length);
    cmp(knob + ': ...and SPENT still does not part', ctl.spentDiv === false, String(ctl.spentDiv));
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
