#!/usr/bin/env node
/* tests/probe_corpse_priority_galewings.js — ROADMAP #495: A CORPSE'S QUEUED GALE WINGS ACTION, RE-PRICED
 *
 *   SHOWDOWN_PATH=... node tests/probe_corpse_priority_galewings.js --release <id> [--red]
 *
 * ================= THE QUESTION, AND THE AUTHORITY AT THE LINE ====================================
 *
 * After every action the authority re-prices the whole remaining queue and re-sorts it:
 *   sim/battle.ts:2915-2923   gen >= 8 and the next action is a move: updateSpeed(), getActionSpeed() on
 *                             every queued action, queue.sort().
 *   sim/battle.ts:2639-2643   getActionSpeed: priority from the base move, then
 *                             runEvent('ModifyPriority', action.pokemon, …).
 *   data/abilities.ts:1578-1581  galewings.onModifyPriority: `move.type === 'Flying' &&
 *                             pokemon.hp === pokemon.maxhp` → priority + 1. No Champions override.
 * #495 measured that for a body that died earlier in the turn the event collects NO handlers
 * (`findEventHandlers` skips a target that is not active), so the corpse's queued Flying move drops
 * from +1 to 0 and moves in the queue. Whether medicham2 does the same was unmeasured, and the only way
 * a dead action's POSITION can show is through the tie shuffle of the group it lands in — so the
 * fixture puts it in a speed tie with TWO live actions.
 *
 * ================= THE FIXTURE — CONSTRUCTED, EVERY ENTITY DERIVED FROM THE FORMAT ================
 *
 *   p1a  Talonflame, Gale Wings, Brave Bird (+1 at full HP)       — the body that becomes a corpse
 *   p1b  Pyroar, Pyroarite, mega on turn 1 → Pyroar-Mega          — base Speed 126, the same as Talonflame
 *   p2a  Lycanroc, Choice Scarf, Accelerock (+1, Rock, x4 on Talonflame) — outspeeds Talonflame in the
 *        +1 bracket and KOs it before its Brave Bird
 *   p2b  Talonflame, Flame Body, Flare Blitz (priority 0)          — the second live body at Speed 126
 * `talonflame` and `pyroarmega` are the only two legal species at base Speed 126 (derived below). After
 * Accelerock the authority's corpse sits at priority 0 in a three-way speed tie with Pyroar-Mega and the
 * other Talonflame; an engine that kept the corpse at +1 would put only two bodies in that tie.
 *
 * CONTROL: the identical board with Lycanroc clicking Protect instead — no corpse, the Brave Bird lands.
 * RED (--red): an in-memory engine in which `abilityPriorityShift`'s full-HP test spares a FAINTED
 * body, i.e. the corpse keeps its +1 — "the knob in the direction that restores the priority".
 *
 * WHAT IS COMPARED: the driver's first protocol divergence and every board at every turn boundary.
 * The fixture must also be SHOWN to stage: on the authority, p1a must faint BEFORE any Brave Bird, and
 * the engine's own counter must show the corpse's bracket was re-derived (`bracketRederiveMoved`).
 * Exit 0 = staged and agreeing; 1 = parts or did not stage; 2 = cannot run.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
const RED = process.argv.includes('--red');
const SB = require(D('tests', 'staged_board.js'));
const BS = require(D('engine', 'board_state.js'));
const CS = require(D('engine', 'champions_sim.js'));
const DX = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* ---- 0. DERIVED, NOT TYPED -------------------------------------------------------------------- */
let bad = 0;
const ok = (c, what, detail) => { console.log('  ' + (c ? 'ok   ' : 'FAIL ') + what + (detail ? '\n         ' + detail : '')); if (!c) bad++; };
console.log('\ntests/probe_corpse_priority_galewings.js — ROADMAP #495\n\n0. THE FORMAT');
const s126 = DX.species.all().filter(legal).filter(s => s.baseStats.spe === 126).map(s => s.id).sort();
ok(JSON.stringify(s126) === JSON.stringify(['pyroarmega', 'talonflame']), 'the legal base-126 species are exactly Talonflame and Pyroar-Mega', s126.join(','));
const gw = DX.abilities.get('galewings');
ok(/pokemon\.hp === pokemon\.maxhp/.test(String(gw.onModifyPriority)) && /Flying/.test(String(gw.onModifyPriority)),
   'Gale Wings shifts a Flying move only at full HP (read off the handler)', String(gw.onModifyPriority).replace(/\s+/g, ' '));
ok(DX.moves.get('accelerock').priority === 1 && DX.moves.get('bravebird').priority === 0 && DX.moves.get('flareblitz').priority === 0,
   'Accelerock +1, Brave Bird 0 printed, Flare Blitz 0');
ok(!DX.items.get('choicescarf').isNonstandard && !DX.items.get('pyroarite').isNonstandard, 'Choice Scarf and Pyroarite are legal');

const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = [mon('milotic', '', 'Marvel Scale', ['Protect']), mon('garchomp', '', 'Rough Skin', ['Protect'])];
const A = [mon('talonflame', '', 'Gale Wings', ['Brave Bird', 'Protect']),
           mon('pyroar', 'Pyroarite', 'Unnerve', ['Flamethrower', 'Protect'])].concat(FILL);
const B = [mon('lycanroc', 'Choice Scarf', 'Keen Eye', ['Accelerock', 'Protect']),
           mon('talonflame', '', 'Flame Body', ['Flare Blitz', 'Protect'])].concat(
           [mon('clefable', '', 'Magic Guard', ['Protect']), mon('snorlax', '', 'Thick Fat', ['Protect'])]);
const SCEN = [
  { id: 'corpse-in-a-three-way-tie', what: 'Accelerock KOs the Gale Wings Talonflame in the +1 bracket; its '
      + 'queued Brave Bird is re-priced and lands in a Speed-126 tie with Pyroar-Mega and the other Talonflame.',
    script: [{ p1: [{ m: 'bravebird', t: 1 }, { m: 'flamethrower', t: 0, mega: true }], p2: [{ m: 'accelerock', t: 0 }, { m: 'flareblitz', t: 1 }] }],
    corpse: true },
  { id: 'control-no-corpse', what: 'The same board with Lycanroc protecting: nobody dies, Brave Bird keeps its +1.',
    script: [{ p1: [{ m: 'bravebird', t: 1 }, { m: 'flamethrower', t: 0, mega: true }], p2: [{ m: 'protect' }, { m: 'flareblitz', t: 1 }] }],
    corpse: false },
].map(s => ({ ...s, A, B, kind: 'ability', shape: 'corpse priority', census: '#495', negative: 'control-no-corpse' }));

const fx = SB.fixtureAudit(SCEN);
if (fx.length) { console.log('THE FIXTURE IS WRONG — refusing to play it:'); for (const f of fx) console.log('  ' + f); process.exit(2); }

function counters() { const o = {}; for (const b of [globalThis.MEDSEEN || {}, globalThis.MEDFAILS || {}]) for (const [k, v] of Object.entries(b)) if (typeof v === 'number') o[k] = v; return o; }
function play(sc, src) {
  const G = SB.harness(src);
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { verdict: 'NOT-STAGED' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const before = counters(), boards = [];
  const r = G.playGame(a, b, 'directed', 'staged:corpse:' + sc.id, { script: sc.script,
    onBoundary: (snap, t) => { boards.push({ t, n: snap.leaves_compared, diffs: snap.diffs.map(d => BS.locate(d, snap)) }); snap.identical = true; snap.diffs = []; } });
  if (r.err) return { verdict: 'THREW', why: r.err };
  const after = counters(), delta = {}; for (const k of Object.keys(after)) delta[k] = after[k] - (before[k] || 0);
  const sd = G.lastSdLog().map(String);
  const faintIdx = sd.findIndex(l => /^\|faint\|p1a/.test(l));
  const bbIdx = sd.findIndex(l => /^\|move\|p1a[^|]*\|Brave Bird/.test(l));
  const order = (lines) => lines.map(String).filter(l => /^\|move\|/.test(l)).map(l => l.split('|')[2].slice(0, 3) + ':' + l.split('|')[3]);
  return { r, boards, delta, sdOrder: order(sd), meOrder: order(r.mediTrace),
    corpseStaged: faintIdx >= 0 && (bbIdx < 0 || faintIdx < bbIdx),
    diffs: boards.reduce((n, x) => n + x.diffs.length, 0), sc2: G.scriptCounters ? G.scriptCounters() : {} };
}

function run(tag, src) {
  let parts = 0;
  for (const sc of SCEN) {
    const x = play(sc, src);
    if (x.verdict) { console.log('  ' + tag + '  ' + sc.id + '  ' + x.verdict + (x.why ? ' — ' + x.why : '')); parts++; bad++; continue; }
    const agree = !x.r.div && x.diffs === 0;
    console.log('  ' + tag + '  ' + (agree ? 'AGREES ' : 'PARTS  ') + sc.id);
    console.log('      showdown order  ' + x.sdOrder.join('  '));
    console.log('      medicham order  ' + x.meOrder.join('  '));
    console.log('      corpse staged on the authority: ' + x.corpseStaged + '   bracketRederiveMoved +' + (x.delta.bracketRederiveMoved || 0)
      + '   queueResorted +' + (x.delta.queueResorted || 0) + '   clicks not on request ' + (x.sc2.moveNotOnRequest || 0));
    if (x.r.div) console.log('      first protocol divergence: sd `' + x.r.div.sdRaw + '`  me `' + x.r.div.meRaw + '`');
    const fb = x.boards.find(b => b.diffs.length);
    if (fb) console.log('      first board parting, turn ' + fb.t + ': ' + fb.diffs.slice(0, 3).map(d => JSON.stringify(d)).join(' ; '));
    if (!agree) parts++;
    if (tag === 'CLEAN') {
      if (!agree) bad++;
      if (x.sc2.moveNotOnRequest) { console.log('      FIXTURE — a scripted click was not on the request'); bad++; }
      if (sc.corpse && !x.corpseStaged) { console.log('      NOT STAGED — p1a did not faint before its Brave Bird on the authority'); bad++; }
      if (!sc.corpse && x.corpseStaged) { console.log('      CONTROL BROKEN — p1a fainted before acting'); bad++; }
      if (sc.corpse && !(x.delta.bracketRederiveMoved > 0)) { console.log('      NOT EXERCISED — the engine never re-derived a bracket that moved'); bad++; }
    }
  }
  return parts;
}
console.log('\n1. CLEAN ENGINE');
run('CLEAN', null);
if (RED) {
  const p = SB.patchedSource({ break: { patch: [['if(/full hp/i.test(String(_pm.condition))){ if(mon.curHP<mon.st.hp)return 0; }',
    'if(/full hp/i.test(String(_pm.condition))){ if(mon.curHP<mon.st.hp&&!mon.fainted)return 0; }']] } });
  if (p.error) { console.log('\nRED ARM NOT BUILT — ' + p.error); bad++; }
  else {
    console.log('\n2. RED — the full-HP test spares a fainted body, so the corpse keeps its +1 (in memory)');
    const parts = run('RED', p.src);
    console.log('  ' + (parts ? 'THE RED ARM PARTS — the corpse\'s position is observable on this board and the clean engine matches the authority'
      : 'THE RED ARM ALSO AGREES — on this board the corpse\'s priority does not reach any live action; the clean agreement is not evidence about re-pricing'));
  }
}
console.log('\n' + (bad ? 'FAIL — ' + bad + ' problem(s)' : 'PASS'));
process.exit(bad ? 1 : 0);
