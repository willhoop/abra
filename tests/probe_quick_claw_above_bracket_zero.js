/* probe_quick_claw_above_bracket_zero.js — QUICK CLAW'S `priority <= 0` IS THE RELAY VAR, NOT THE
 * MOVE'S PRIORITY, SO THE CLAW FIRES ON A PRIORITY MOVE TOO. THIS ENGINE REFUSED IT ABOVE BRACKET 0
 * AND SWALLOWED BOTH THE LINE AND THE NUDGE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_quick_claw_above_bracket_zero.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential on release `2a90ecca8005`
 * (`data/game-differential.json`; `--steering empirical --arm middle --end-state --games 1200
 * --team-store data/team-pool-frozen --turns 50`, 961 games, 958 non-void). One of the 21
 * NARRATION-ONLY causes:
 *
 *   config omit-intimidate — event missing from medicham2 ::
 *     |-activate|p1a|quickclaw <> |move|p2b|protect
 *
 *     turn 6, agreed up to `|turn|6`, then
 *       showdown    |-activate|p1a: Rotom|item: Quick Claw
 *                   |move|p1a: Rotom|Protect|p1a: Rotom        <- the SLOWER body goes first
 *                   |move|p2b: Charizard|Protect|p2b: Charizard
 *       medicham2   |move|p2b: Charizard|protect                <- no claw line, and the other order
 *                   |move|p1a: Rotom|protect
 *
 * -- a Quick Claw holder clicking PROTECT, which is priority +4.
 *
 * THE RULE, READ OFF THE AUTHORITY RATHER THAN RECALLED.
 *
 *     action.fractionalPriority = this.battle.runEvent('FractionalPriority',
 *                                    action.pokemon, null, action.move, 0);
 *                                                              sim/battle-queue.ts:249
 *     quickclaw.onFractionalPriority(priority, pokemon, target, move) {
 *       if (move.category === 'Status' && pokemon.hasAbility('myceliummight')) return;
 *       if (priority <= 0 && this.randomChance(1, 5)) {
 *         this.add('-activate', pokemon, 'item: Quick Claw');
 *         return 0.1;
 *       }
 *     }                                                        data/items.ts:4985-4993
 *     action.priority = priority + action.fractionalPriority;   sim/battle.ts:2644
 *
 * THE TRAILING `0` IS THE RELAY VAR. `onFractionalPriority(priority, ...)` receives whatever an
 * EARLIER handler in the same event returned, and on an ordinary claw holder that is the literal `0`
 * the call site passes — so `priority <= 0` is TRUE whatever the move's own bracket is, the claw
 * rolls, and the 0.1 is added to the bracket the move already has. Champions overrides neither
 * `quickclaw` nor the queue (asserted below on every run).
 *
 * WHAT THIS ENGINE DID. It read the same `priority <= 0` as the MOVE's priority and gated the
 * RESULT on it (`_fpOk = actionPriority(it, field) <= 0`). Its own header had already corrected the
 * reading for the DIE — the draw was un-gated on 2026-08-27 and the gap left standing and counted as
 * `MEDFAILS.fracPriPriorityGateUnmodelled`, *"the DIE now agrees; the EFFECT does not, and that is a
 * separate defect on a separate line."* This is that line.
 *
 * THE DIE DOES NOT MOVE. `_fpDraws` never contained `_fpOk`, so the roll was already taken at the
 * authority's address on a priority click and merely discarded. Nothing about the RNG stream changes
 * here; only what is done with a roll that already happened.
 *
 * THE BOARD IS BUILT SO THAT NOTHING CAN HAPPEN ON IT. All four active bodies are GHOST-typed and
 * every attack clicked is NORMAL-typed, so every click is an immunity: no damage, no faint, no
 * switch, and the arm can run for as many turns as it needs to see a 20% coin land. What is left to
 * observe is exactly the claw — its line, and which of the two +1 clicks resolves first.
 *
 * THE ARMS.
 *   PRIORITY   the claw holder clicks a +1 Normal attack; the faster foe clicks the same move. The
 *              authority announces the claw on ~20% of turns and the SLOWER body moves first on
 *              exactly those turns. THIS IS THE RED ARM: this engine announced nothing and never
 *              moved first.
 *   BRACKET0   the same board, the claw holder clicking a priority-0 Normal attack instead. Both
 *              engines already agree here, and they must go on agreeing — it is what stops the fix
 *              being read as "the claw started working", and what proves the counting is not simply
 *              off in the red arm.
 *   ORDER      asserted inside both arms: a claw turn puts the SLOWER body first and a non-claw turn
 *              does not. That is the EFFECT half; the `-activate` line alone would pass on an engine
 *              that announced and then sorted the old way.
 *   CONTROL    `MEDI_FRACPRI_PRIORITY_GATE=1` restores the gate in a child. It must take the PRIORITY
 *              arm's claw count to zero and must NOT move BRACKET0 — an identical result across a
 *              varied knob means the knob is unwired, not that the gate does not matter.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_FRACPRI_PRIORITY_GATE === '1';
/* Requiring `engine/game_differential.js` without a `--release` CUTS one as a side effect and
 * repoints `data/engine-release.json` under whatever else is measuring. */
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

/* ================================================================================================
 * 0. WHAT THE FORMAT SAYS, ASKED RATHER THAN ASSUMED
 * ============================================================================================== */
console.log(NL + '  === THE AUTHORITY, RE-DERIVED THIS RUN ===');
{
  const fs = require('fs');
  const SP = process.env.SHOWDOWN_PATH;
  const chItems = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'items.ts'), 'utf8');
  const over = /^\tquickclaw:/m.test(chItems);
  console.log('  champions overrides quickclaw                       : ' + (over ? 'YES' : 'no'));
  if (over) { console.log('  RED — the mainline handler quoted in this header is not the rule here.'); bad++; }
  const q = fs.readFileSync(path.join(SP, 'sim', 'battle-queue.ts'), 'utf8');
  const relay = /runEvent\('FractionalPriority',\s*action\.pokemon,\s*null,\s*action\.move,\s*0\)/.test(q);
  console.log("  the call site passes a RELAY of 0                   : " + relay);
  if (!relay) { console.log('  RED — the relay this probe is built on is not in the source.'); bad++; }
  const b = fs.readFileSync(path.join(SP, 'sim', 'battle.ts'), 'utf8');
  const add = /action\.priority = priority \+ action\.fractionalPriority/.test(b);
  console.log('  and the 0.1 is ADDED to the move bracket            : ' + add);
  if (!add) { console.log('  RED — the fold this probe is built on is not in the source.'); bad++; }
  const item = fs.readFileSync(path.join(SP, 'data', 'items.ts'), 'utf8');
  const gate = /if \(priority <= 0 && this\.randomChance\(1, 5\)\)/.test(item);
  console.log('  quickclaw still reads `priority <= 0` on the relay  : ' + gate);
  if (!gate) { console.log('  RED — quickclaw’s handler has changed shape.'); bad++; }
}

/* ================================================================================================
 * 1. THE CAST, DERIVED FROM THE FORMAT
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
const tagsOf = (kind, id) => ((TAGS[kind] || {})[id] || {}).tags || [];

console.log(NL + '  === THE CAST, DERIVED THIS RUN ===');
/* THE ITEM IS READ OFF OUR OWN TAG, never named, and the membership is PRINTED. */
const FRACPRI = Object.keys(TAGS.items || {}).filter(k => tagsOf('items', k).includes('fractionalPriority'))
  .filter(k => { const i = dex.items.get(k); return i.exists && !i.isNonstandard; });
console.log('  items carrying `fractionalPriority` in this format : '
  + FRACPRI.map(k => dex.items.get(k).name + ' (' + JSON.stringify(
      (((TAGS.items[k] || {}).params || {}).fractionalPriority || {}).chance) + ')').join(', '));
const CLAW_ITEM = FRACPRI.find(k => (((TAGS.items[k] || {}).params || {}).fractionalPriority || {}).chance);
if (!CLAW_ITEM) { console.log('  NOT STAGED — no fractional-priority item with a chance.'); process.exit(1); }
const CHANCE = +(((TAGS.items[CLAW_ITEM] || {}).params || {}).fractionalPriority || {}).chance;

/* A NORMAL-TYPE PRIORITY ATTACK AND A NORMAL-TYPE PRIORITY-0 ATTACK, so that the two arms differ in
 * the BRACKET and in nothing else — same type, same immunity, same board. */
const plainNormal = pri => dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category !== 'Status'
  && m.type === 'Normal' && m.priority === pri && m.target === 'normal' && !m.multihit && m.basePower > 0
  && !m.secondary && !m.secondaries && !m.recoil && !m.selfSwitch && !(m.flags && m.flags.charge)
  && (m.accuracy === true || m.accuracy >= 100)
  && !tagsOf('moves', m.id).includes('takesTargetItem'))
  .sort((a, b) => a.id.localeCompare(b.id));
const PRI_ALL = plainNormal(1);
console.log('  +1 Normal attacks in this format                   : ' + PRI_ALL.map(m => m.name).join(', '));
if (!PRI_ALL.length) { console.log('  NOT STAGED — no +1 Normal attack.'); process.exit(1); }

/* BOTH SIDES ARE GHOST, so every one of those clicks is an immunity and the board cannot move. */
const GHOSTS = POOL.filter(s => s.types.includes('Ghost'));
const IDLE = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.selfSwitch && !m.selfdestruct && !(m.flags && m.flags.charge)
  && m.boosts && Object.keys(m.boosts).length && Object.values(m.boosts).every(v => v > 0)
  && !m.boosts.evasion && !m.boosts.accuracy && !m.boosts.spe).sort((a, b) => a.id.localeCompare(b.id));
let PRI = null, CLAW = null, FAST = null;
for (const mv of PRI_ALL) {
  const carriers = GHOSTS.filter(s => learns(s, mv.id)).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
  if (carriers.length < 2) continue;
  PRI = mv; CLAW = carriers[0]; FAST = carriers[carriers.length - 1];
  break;
}
if (!PRI) { console.log('  NOT STAGED — no +1 Normal attack with two Ghost carriers.'); process.exit(1); }
const BRACKET0 = plainNormal(0).find(m => learns(CLAW, m.id));
if (!BRACKET0) { console.log('  NOT STAGED — the claw holder knows no priority-0 Normal attack.'); process.exit(1); }
const idlersFor = sp => IDLE.filter(m => learns(sp, m.id));
const PARTNERS = GHOSTS.filter(s => s.id !== CLAW.id && s.id !== FAST.id && idlersFor(s).length);
if (PARTNERS.length < 6) { console.log('  NOT STAGED — the two benches could not be filled with Ghosts.'); process.exit(1); }
const P1B = PARTNERS[0], P2B = PARTNERS[1];
const BENCH1 = [PARTNERS[2], PARTNERS[3]], BENCH2 = [PARTNERS[4], PARTNERS[5]];
console.log('  the +1 click, and the two Ghost carriers of it     : ' + PRI.name + '   '
  + CLAW.name + ' (base Spe ' + CLAW.baseStats.spe + ', holds the claw)   vs   '
  + FAST.name + ' (base Spe ' + FAST.baseStats.spe + ')');
console.log('  the priority-0 control click                       : ' + BRACKET0.name);
console.log('  the two idling partners                            : ' + P1B.name + ' / ' + P2B.name);
if (CLAW.baseStats.spe >= FAST.baseStats.spe) {
  console.log('  NOT STAGED — the claw holder is not the slower body, so the order proves nothing.');
  process.exit(1);
}

/* ================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
/* HOW MANY TURNS, DERIVED FROM THE PP OF EVERY CLICK ON THE BOARD. The first draft asked for 24 and
 * the arm died at *"Facade is disabled"* — a body out of PP, which reads exactly like a fixture that
 * cannot be built. `m.pp` is the BASE value, so this is a floor whatever PP-ups the builder applies. */
const idle1 = idlersFor(P1B)[0], idle2 = idlersFor(P2B)[0];
const TURNS = +(process.env.PROBE_TURNS
  || Math.max(6, Math.min.apply(null, [PRI, BRACKET0, idle1, idle2].map(m => m.pp)) - 2));
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));

const run = (clickId, tag) => {
  const A = stage([[CLAW.name, dex.items.get(CLAW_ITEM).name, '', [PRI.name, BRACKET0.name]],
                   [P1B.name, '', '', [idle1.name]],
                   [BENCH1[0].name, '', '', [idle1.name]], [BENCH1[1].name, '', '', [idle1.name]]]);
  const B = stage([[FAST.name, '', '', [PRI.name]],
                   [P2B.name, '', '', [idle2.name]],
                   [BENCH2[0].name, '', '', [idle2.name]], [BENCH2[1].name, '', '', [idle2.name]]]);
  const one = { p1: [{ m: norm(clickId), t: 0 }, { m: norm(idle1.id) }],
                p2: [{ m: norm(PRI.id), t: 0 }, { m: norm(idle2.id) }] };
  const script = []; for (let i = 0; i < TURNS; i++) script.push(one);
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  const r = G.playGame(a, b, 'directed', 'probe_quick_claw_above_bracket_zero :: ' + tag, { script });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) {
    return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  }
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  /* PER TURN: did the claw speak, and did the SLOWER body move first?
   *
   * READ BY SLOT, AND THE SLOT MAP COMES OFF THE `|switch|` DETAILS FIELD. The first draft matched the
   * NICKNAME in field 2 against the species name and never matched once: showdown writes the BASE
   * name there for a regional forme (`|switch|p1a: Typhlosion|Typhlosion-Hisui, L50|...`), so every
   * turn read as "the fast body went first" and the order assertion was measuring nothing. */
  const slotOfSpecies = {};
  for (const l of sd) {
    const g = /^\|switch\|(p[12][ab]): [^|]*\|([^,|]+)/.exec(l);
    if (g && !slotOfSpecies[g[2].trim()]) slotOfSpecies[g[2].trim()] = g[1];
  }
  const CS_ = slotOfSpecies[CLAW.name], FS_ = slotOfSpecies[FAST.name];
  const read = arr => {
    const turns = [];
    let cur = null;
    for (const l of arr) {
      if (/^\|turn\|/.test(l)) { cur = { claw: 0, order: [] }; turns.push(cur); continue; }
      if (!cur) continue;
      if (/^\|-activate\|/.test(l) && new RegExp(norm(CLAW_ITEM), 'i').test(norm(l))) cur.claw++;
      const g = /^\|move\|(p[12][ab]): /.exec(l);
      if (g) cur.order.push(g[1]);
    }
    return turns;
  };
  const T = { sd: read(sd), me: read(me) };
  const clawTurns = t => t.map((x, i) => (x.claw ? i : -1)).filter(i => i >= 0);
  const firstOf = (t, i) => {
    const f = (t[i] && t[i].order.filter(n => n === CS_ || n === FS_)[0]) || null;
    return f === CS_ ? 'CLAW' : f === FS_ ? 'fast' : f;
  };
  if (!CS_ || !FS_) return { staged: false, why: 'the two bodies could not be located: ' + JSON.stringify(slotOfSpecies) };
  return { staged: true, r, T, slots: { claw: CS_, fast: FS_ },
           sdClaw: clawTurns(T.sd), meClaw: clawTurns(T.me),
           sdFirst: T.sd.map((x, i) => firstOf(T.sd, i)), meFirst: T.me.map((x, i) => firstOf(T.me, i)),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const PRIO = run(PRI.id, CHILD ? 'priority-control' : 'priority');
if (!PRIO.staged) { console.log(NL + '  NOT STAGED (priority) — ' + PRIO.why); process.exit(1); }
const ZERO = run(BRACKET0.id, CHILD ? 'bracket0-control' : 'bracket0');
if (!ZERO.staged) { console.log(NL + '  NOT STAGED (bracket 0) — ' + ZERO.why); process.exit(1); }

const show = (tag, R) => {
  console.log(NL + '  === ' + tag + ' ===');
  console.log('    showdown  claw fired on turn(s) ' + JSON.stringify(R.sdClaw)
    + ' of ' + R.T.sd.length + '   first mover per turn: ' + JSON.stringify(R.sdFirst));
  console.log('    medicham2 claw fired on turn(s) ' + JSON.stringify(R.meClaw)
    + ' of ' + R.T.me.length + '   first mover per turn: ' + JSON.stringify(R.meFirst));
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
};
show('PRIORITY — ' + CLAW.name + ' clicks ' + PRI.name + ' (+' + PRI.priority + ') holding a '
     + dex.items.get(CLAW_ITEM).name, PRIO);
show('BRACKET 0 — the same body clicks ' + BRACKET0.name + ' (+0) instead', ZERO);

if (CHILD) {
  console.log(NL + '  CONTROL ARM (MEDI_FRACPRI_PRIORITY_GATE=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    prio: PRIO.meClaw, prioDiv: !!PRIO.div, prioDivLine: PRIO.div && PRIO.div.me,
    zero: ZERO.meClaw, zeroDiv: !!ZERO.div }));
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
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* THE FIXTURE FIRST. A coin that never landed would make every assertion below vacuous. */
cmp('the fixture: the authority DOES fire the claw on a priority click', PRIO.sdClaw.length > 0,
    PRIO.sdClaw.length + ' of ' + PRIO.T.sd.length + ' turn(s), against ' + CHANCE + ' expected per turn');
/* THE BOARD CANNOT MOVE, SO BOTH STREAMS MUST REACH THE LAST SCRIPTED TURN. A short stream means the
 * comparator stopped the game at a divergence, which is itself the defect — this assertion is RED on
 * the pre-fix bytes for that reason and not for a staging one. */
cmp('the fixture: nothing on the board can end the game, so both run every scripted turn',
    PRIO.T.sd.length >= TURNS && PRIO.T.me.length >= TURNS,
    'showdown ' + PRIO.T.sd.length + ' turns, medicham2 ' + PRIO.T.me.length + ' of ' + TURNS);
cmp('the fixture: on a claw turn the SLOWER body moves first in the authority',
    PRIO.sdClaw.length > 0 && PRIO.sdClaw.every(i => PRIO.sdFirst[i] === 'CLAW'),
    JSON.stringify(PRIO.sdClaw.map(i => PRIO.sdFirst[i])));
cmp('the fixture: and on every other turn it does not',
    PRIO.sdFirst.every((n, i) => PRIO.sdClaw.includes(i) || n === 'fast' || n === null),
    JSON.stringify(PRIO.sdFirst.filter((n, i) => !PRIO.sdClaw.includes(i) && n !== 'fast' && n !== null)));

cmp('medicham2 fires the claw on the SAME turns', eq(PRIO.meClaw, PRIO.sdClaw),
    'showdown ' + JSON.stringify(PRIO.sdClaw) + ' vs medicham2 ' + JSON.stringify(PRIO.meClaw));
/* COMPARED OVER THE OVERLAP. The authority emits a trailing `|turn|N+1` that this engine does not, so
 * its per-turn list is one entry longer and that entry is always `null` — a length mismatch there is
 * the harness's own tail and not a disagreement about any turn that was played. */
const OVL = Math.min(PRIO.sdFirst.length, PRIO.meFirst.length);
cmp('...and puts the slower body first on exactly those turns',
    OVL >= TURNS && eq(PRIO.meFirst.slice(0, OVL), PRIO.sdFirst.slice(0, OVL)),
    'showdown ' + JSON.stringify(PRIO.sdFirst.slice(0, 8)) + ' … vs medicham2 '
    + JSON.stringify(PRIO.meFirst.slice(0, 8)) + ' …');
cmp('the PRIORITY arm does not part at all', PRIO.div === null, PRIO.div ? JSON.stringify(PRIO.div) : 'none');

cmp('BRACKET 0: the authority fires the claw there too', ZERO.sdClaw.length > 0,
    ZERO.sdClaw.length + ' of ' + ZERO.T.sd.length + ' turn(s)');
cmp('BRACKET 0: medicham2 already agreed and still does', eq(ZERO.meClaw, ZERO.sdClaw),
    'showdown ' + JSON.stringify(ZERO.sdClaw) + ' vs medicham2 ' + JSON.stringify(ZERO.meClaw));
cmp('BRACKET 0: and that game does not part', ZERO.div === null, ZERO.div ? JSON.stringify(ZERO.div) : 'none');

/* ================================================================================================
 * 4. THE KNOB
 * ============================================================================================== */
{
  const { spawnSync } = require('child_process');
  const knob = 'MEDI_FRACPRI_PRIORITY_GATE';
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
    cmp(knob + ': the knob takes the PRIORITY arm to zero', ctl.prio.length === 0,
        'default ' + PRIO.meClaw.length + ' claw turn(s) vs control ' + ctl.prio.length
        + (ctl.prio.length === PRIO.meClaw.length
           ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    cmp(knob + ': the control arm parts, so the knob reached the RULE', ctl.prioDiv === true,
        ctl.prioDivLine ? String(ctl.prioDivLine) : 'no divergence at all');
    cmp(knob + ': BRACKET 0 does NOT move under it', eq(ctl.zero, ZERO.meClaw),
        'default ' + JSON.stringify(ZERO.meClaw) + ' vs control ' + JSON.stringify(ctl.zero));
    cmp(knob + ': ...and BRACKET 0 still does not part', ctl.zeroDiv === false, String(ctl.zeroDiv));
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
