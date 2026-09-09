/* probe_hazard_lay_order.js — TWO HAZARDS ON ONE SIDE BITE IN THE ORDER THEY WERE LAID, AND THIS
 * ENGINE BIT THEM IN A FIXED ORDER WRITTEN INTO ITS SOURCE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_hazard_lay_order.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential on release `2a90ecca8005`
 * (`data/game-differential.json`; `--steering empirical --arm middle --end-state --games 1200
 * --team-store data/team-pool-frozen --turns 50`, 961 games, 958 non-void). One of the 21
 * NARRATION-ONLY causes:
 *
 *   config omit-protect — extra event emitted by medicham2 ::
 *     |-status|p1a|tox <> |-damage|p1a|H/H|[from]stealthrock
 *
 *     agreed   |switch|p1a: Farigiraf|farigiraf, L50|195/195
 *     then   showdown    |-status|p1a: Farigiraf|tox
 *                        |-damage|p1a: Farigiraf|171/195 tox|[from] Stealth Rock
 *            medicham2   |-damage|p1a: Farigiraf|171/195|[from] Stealth Rock
 *                        |-status|p1a: Farigiraf|tox
 *
 * -- the same two events, the other way round.
 *
 * THE RULE, READ OFF THE AUTHORITY RATHER THAN RECALLED. Every hazard is a SIDE CONDITION with an
 * `onSwitchIn` and none of the four declares a priority, so they tie on speed, on priority and on
 * subOrder, and `Battle#resolvePriority` says in its own comment what breaks the tie:
 *
 *     if (callbackName.endsWith('SwitchIn') || callbackName.endsWith('RedirectTarget')) {
 *       // If multiple hazards are present on one side, their event handlers all perfectly tie in
 *       // speed, priority, and subOrder. They should activate in the order they were created,
 *       // which is where effectOrder comes in.
 *       handler.effectOrder = handler.state?.effectOrder;
 *     }                                                        sim/battle.ts:994-999
 *
 *     comparePriority(a, b) {
 *       return -((b.order || …) - (a.order || …)) || ((b.priority || 0) - (a.priority || 0))
 *           || ((b.speed || 0) - (a.speed || 0)) || -((b.subOrder || 0) - (a.subOrder || 0))
 *           || -((b.effectOrder || 0) - (a.effectOrder || 0)) || 0;
 *     }                                                        sim/battle.ts:407-412
 *
 * -- `-((b.effectOrder) - (a.effectOrder))` is ASCENDING, so the side condition created FIRST fires
 * first. `effectOrder` is stamped once, in `initEffectState` (sim/battle.ts:3319-3326), when the
 * condition is CREATED; `addSideCondition` on an existing condition calls `onSideRestart` and does
 * not re-stamp it, so a second Spikes layer does not move the hazard down the list.
 *
 * WHAT THIS ENGINE DID. `applyEntryConditions` ran four `if` blocks in a fixed source order —
 * Stealth Rock, Spikes, Toxic Spikes, Sticky Web — whatever order the layers actually went down in.
 *
 * THE ARMS. Two boards that differ in ONE BIT: which hazard was laid first.
 *   TSPIKES-FIRST   Toxic Spikes on turn 1, Stealth Rock on turn 2. The authority poisons and THEN
 *                   chips. THIS IS THE RED ARM.
 *   ROCKS-FIRST     Stealth Rock on turn 1, Toxic Spikes on turn 2. The authority chips and THEN
 *                   poisons — which is what this engine did in both arms, so this one is GREEN before
 *                   the fix and must stay green after it. It is the control that stops the fix being
 *                   read as "swap the two".
 *   CONTROL         `MEDI_HAZARD_FIXED_ORDER=1` restores the source order in a child. It must take
 *                   TSPIKES-FIRST back to the rocks-first reading and must NOT move ROCKS-FIRST — an
 *                   identical result across a varied knob means the knob is unwired.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_HAZARD_FIXED_ORDER === '1';
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
 * 0. WHAT THE AUTHORITY SAYS, ASKED RATHER THAN ASSUMED
 * ============================================================================================== */
console.log(NL + '  === THE AUTHORITY, RE-DERIVED THIS RUN ===');
{
  const fs = require('fs');
  const SP = process.env.SHOWDOWN_PATH;
  const b = fs.readFileSync(path.join(SP, 'sim', 'battle.ts'), 'utf8');
  const tie = /handler\.effectOrder = handler\.state\?\.effectOrder;/.test(b);
  const asc = /-\(\(b\.effectOrder \|\| 0\) - \(a\.effectOrder \|\| 0\)\)/.test(b);
  console.log('  SwitchIn handlers carry effectOrder                 : ' + tie);
  console.log('  and comparePriority sorts it ASCENDING              : ' + asc);
  if (!tie || !asc) { console.log('  RED — the tie-break this probe is built on is not in the source.'); bad++; }
  /* AND NEITHER HAZARD MAY DECLARE A PRIORITY, or the tie-break never gets reached. */
  const mv = fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8');
  for (const h of ['stealthrock', 'toxicspikes']) {
    const i = mv.indexOf(NL + '\t' + h + ': {');
    const block = i < 0 ? '' : mv.slice(i, i + 3000);
    const pri = /onSwitchInPriority/.test(block);
    console.log('  ' + h + ' declares onSwitchInPriority' + (' ').repeat(Math.max(0, 24 - h.length))
      + ': ' + (pri ? 'YES' : 'no'));
    if (pri) { console.log('  RED — a declared priority would decide the order before effectOrder does.'); bad++; }
  }
  const ch = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  for (const h of ['stealthrock', 'toxicspikes']) {
    const over = new RegExp('^\\t' + h + ':', 'm').test(ch);
    console.log('  champions overrides ' + h + (' ').repeat(Math.max(0, 30 - h.length)) + ': ' + (over ? 'YES' : 'no'));
  }
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
const abTags = a => ((TAGS.abilities || {})[norm(a)] || {}).tags || [];
/* A BODY WHOSE ABILITIES CANNOT SPEAK ON ENTRY AND CANNOT REFUSE EITHER HAZARD. Derived: no
 * `onStart`/`onSwitchIn` handler at all (so no Intimidate line lands between the two hazard lines and
 * makes the arm red for something that is not this rule), and no tag that refuses indirect damage or
 * a status. EVERY possible ability is checked, not just slot 0, because the builder picks. */
const quietAbility = a => {
  const A = dex.abilities.get(a);
  if (!A || !A.exists) return false;
  if (A.onStart || A.onSwitchIn || A.onAnySwitchIn || A.onSwitchOut) return false;
  const t = abTags(a);
  return !t.includes('refusesIndirectDamage') && !t.includes('statusImmune')
      && !t.includes('typeImmunity') && !t.includes('immuneToMoveClass');
};
const quietBody = s => Object.values(s.abilities || {}).every(quietAbility);

console.log(NL + '  === THE CAST, DERIVED THIS RUN ===');
/* THE TWO HAZARDS ARE READ OFF OUR OWN TAG, never named: one that DAMAGES and one that STATUSES, so
 * the two events on the entrant's line are trivially distinguishable. */
const HAZ = Object.keys(TAGS.moves || {}).filter(k => (((TAGS.moves[k] || {}).tags) || []).includes('hazard'))
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard; });
console.log('  moves carrying `hazard` in this format : ' + (HAZ.join(', ') || '(none)'));
if (!HAZ.includes('stealthrock') || !HAZ.includes('toxicspikes')) {
  console.log('  NOT STAGED — the two hazards this probe distinguishes are not both in the tag set.');
  process.exit(1);
}
const SETTERS = POOL.filter(s => learns(s, 'stealthrock') && learns(s, 'toxicspikes') && quietBody(s));
console.log('  legal bodies that learn BOTH and say nothing on entry : '
  + (SETTERS.map(s => s.name).join(', ') || '(none)'));
if (!SETTERS.length) {
  console.log('  legal bodies that learn both, quiet or not          : '
    + POOL.filter(s => learns(s, 'stealthrock') && learns(s, 'toxicspikes')).map(s => s.name).join(', '));
  console.log('  NOT STAGED — no quiet setter.'); process.exit(1);
}
const SETTER = SETTERS[0];

const IDLE = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.selfSwitch && !m.selfdestruct && !(m.flags && m.flags.charge)
  && m.boosts && Object.keys(m.boosts).length && Object.values(m.boosts).every(v => v > 0)
  && !m.boosts.evasion && !m.boosts.accuracy).sort((a, b) => a.id.localeCompare(b.id));
const idlesFor = sp => IDLE.filter(m => learns(sp, m.id));
if (!idlesFor(SETTER).length) { console.log('  NOT STAGED — the setter knows no idle self-boost.'); process.exit(1); }

/* THE ENTRANT: grounded, poisonable, chipped by the rocks, and silent on arrival. */
const ENTRANTS = POOL.filter(s => s.id !== SETTER.id && quietBody(s) && idlesFor(s).length
  && !s.types.includes('Poison') && !s.types.includes('Steel') && !s.types.includes('Flying'));
console.log('  candidate entrants (grounded, poisonable, quiet)   : ' + ENTRANTS.length
  + '   e.g. ' + ENTRANTS.slice(0, 5).map(s => s.name).join(', '));
if (ENTRANTS.length < 4) { console.log('  NOT STAGED — too few entrants.'); process.exit(1); }
const ENTRANT = ENTRANTS[0];
const REST = ENTRANTS.filter(s => s.id !== ENTRANT.id);
console.log('  the board : p1 ' + REST[0].name + ' + ' + REST[1].name + ' (bench holds ' + ENTRANT.name
  + ')   vs   p2 ' + SETTER.name + ' + ' + REST[2].name);

/* ================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const setIdle = idlesFor(SETTER)[0];
const iOf = sp => idlesFor(sp)[0];

const run = (first, second, tag) => {
  const A = stage([[REST[0].name, '', '', [iOf(REST[0]).name]],
                   [REST[1].name, '', '', [iOf(REST[1]).name]],
                   [ENTRANT.name, '', '', [iOf(ENTRANT).name]],
                   [REST[3].name, '', '', [iOf(REST[3]).name]]]);
  const B = stage([[SETTER.name, '', '', [dex.moves.get('stealthrock').name,
                                          dex.moves.get('toxicspikes').name, setIdle.name]],
                   [REST[2].name, '', '', [iOf(REST[2]).name]],
                   [REST[4].name, '', '', [iOf(REST[4]).name]],
                   [REST[5].name, '', '', [iOf(REST[5]).name]]]);
  const idleP1 = () => [{ m: norm(iOf(REST[0]).id) }, { m: norm(iOf(REST[1]).id) }];
  const idleP2b = { m: norm(iOf(REST[2]).id) };
  const script = [
    { p1: idleP1(), p2: [{ m: norm(first) }, idleP2b] },
    { p1: idleP1(), p2: [{ m: norm(second) }, idleP2b] },
    { p1: [{ sw: norm(ENTRANT.id) }, { m: norm(iOf(REST[1]).id) }],
      p2: [{ m: norm(setIdle.id) }, idleP2b] },
  ];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  const r = G.playGame(a, b, 'directed', 'probe_hazard_lay_order :: ' + tag, { script });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) {
    return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  }
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  /* THE ENTRANT'S OWN ARRIVAL, AND WHAT BIT IT, IN ORDER. The switch line is found by species so the
   * slot it lands in does not have to be guessed. */
  const seq = arr => {
    const i = arr.findIndex(l => new RegExp('^\\|switch\\|p[12][ab]: [^|]*\\|' + ENTRANT.name, 'i').test(l));
    if (i < 0) return null;
    const out = [];
    for (const l of arr.slice(i + 1, i + 12)) {
      if (/^\|(turn|move|switch)\|/.test(l)) break;
      if (/^\|-status\|/.test(l) && /\|(psn|tox)\b/.test(l)) out.push('POISON');
      else if (/^\|-damage\|/.test(l) && /stealth\s*rock/i.test(l)) out.push('ROCKS');
    }
    return out;
  };
  return { staged: true, r, sd: seq(sd), me: seq(me),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const TS_FIRST = run('toxicspikes', 'stealthrock', CHILD ? 'tspikes-first-control' : 'tspikes-first');
if (!TS_FIRST.staged) { console.log(NL + '  NOT STAGED (tspikes first) — ' + TS_FIRST.why); process.exit(1); }
const SR_FIRST = run('stealthrock', 'toxicspikes', CHILD ? 'rocks-first-control' : 'rocks-first');
if (!SR_FIRST.staged) { console.log(NL + '  NOT STAGED (rocks first) — ' + SR_FIRST.why); process.exit(1); }

const show = (tag, R) => {
  console.log(NL + '  === ' + tag + ' ===');
  console.log('    showdown  what bit the entrant, in order: ' + JSON.stringify(R.sd));
  console.log('    medicham2 what bit the entrant, in order: ' + JSON.stringify(R.me));
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
};
show('TSPIKES-FIRST — Toxic Spikes on turn 1, Stealth Rock on turn 2', TS_FIRST);
show('ROCKS-FIRST — the same two, laid the other way round', SR_FIRST);

if (CHILD) {
  console.log(NL + '  CONTROL ARM (MEDI_HAZARD_FIXED_ORDER=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ ts: TS_FIRST.me, tsDiv: !!TS_FIRST.div,
    tsDivLine: TS_FIRST.div && TS_FIRST.div.me, sr: SR_FIRST.me, srDiv: !!SR_FIRST.div }));
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

cmp('the fixture: both hazards really bit the entrant',
    eq((TS_FIRST.sd || []).slice().sort(), ['POISON', 'ROCKS'])
    && eq((SR_FIRST.sd || []).slice().sort(), ['POISON', 'ROCKS']),
    'tspikes-first ' + JSON.stringify(TS_FIRST.sd) + ', rocks-first ' + JSON.stringify(SR_FIRST.sd));
cmp('the fixture: the AUTHORITY bites in the order they were laid',
    eq(TS_FIRST.sd, ['POISON', 'ROCKS']) && eq(SR_FIRST.sd, ['ROCKS', 'POISON']),
    'tspikes-first ' + JSON.stringify(TS_FIRST.sd) + ', rocks-first ' + JSON.stringify(SR_FIRST.sd));
cmp('the fixture: so the two arms DISAGREE, which is the whole claim',
    !eq(TS_FIRST.sd, SR_FIRST.sd), JSON.stringify(TS_FIRST.sd) + ' vs ' + JSON.stringify(SR_FIRST.sd));

cmp('medicham2 matches the authority when Toxic Spikes went down first', eq(TS_FIRST.me, TS_FIRST.sd),
    'showdown ' + JSON.stringify(TS_FIRST.sd) + ' vs medicham2 ' + JSON.stringify(TS_FIRST.me));
cmp('...and that game does not part', TS_FIRST.div === null,
    TS_FIRST.div ? JSON.stringify(TS_FIRST.div) : 'none');
cmp('ROCKS-FIRST: medicham2 already agreed and still does', eq(SR_FIRST.me, SR_FIRST.sd),
    'showdown ' + JSON.stringify(SR_FIRST.sd) + ' vs medicham2 ' + JSON.stringify(SR_FIRST.me));
cmp('ROCKS-FIRST: and that game does not part', SR_FIRST.div === null,
    SR_FIRST.div ? JSON.stringify(SR_FIRST.div) : 'none');

/* ================================================================================================
 * 4. THE KNOB
 * ============================================================================================== */
{
  const { spawnSync } = require('child_process');
  const knob = 'MEDI_HAZARD_FIXED_ORDER';
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
    cmp(knob + ': the knob CHANGES the tspikes-first arm', !eq(ctl.ts, TS_FIRST.me),
        'default ' + JSON.stringify(TS_FIRST.me) + ' vs control ' + JSON.stringify(ctl.ts)
        + (eq(ctl.ts, TS_FIRST.me) ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    cmp(knob + ': and it reads the SOURCE order, which is rocks first', eq(ctl.ts, ['ROCKS', 'POISON']),
        JSON.stringify(ctl.ts));
    cmp(knob + ': the control arm parts, so the knob reached the RULE', ctl.tsDiv === true,
        ctl.tsDivLine ? String(ctl.tsDivLine) : 'no divergence at all');
    cmp(knob + ': ROCKS-FIRST does NOT move under it', eq(ctl.sr, SR_FIRST.me),
        'default ' + JSON.stringify(SR_FIRST.me) + ' vs control ' + JSON.stringify(ctl.sr));
    cmp(knob + ': ...and ROCKS-FIRST still does not part', ctl.srDiv === false, String(ctl.srDiv));
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
