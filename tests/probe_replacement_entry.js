/* probe_replacement_entry.js — TWO FAINT REPLACEMENTS ARE ONE ANNOUNCEMENT AND ONE ENTRY EVENT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_replacement_entry.js
 *
 * TWO BEHAVIOURS, TWO ARMS, TWO KNOBS. They share a fixture and nothing else, and each is judged by
 * the two protocol streams with no typed expectation.
 *
 * ---- ARM `batch` -------------------------------------------------------------------------------
 * The authority announces EVERY replacement first and then runs ONE entry event.
 * `BattleActions#switchIn` emits the `|switch|` line and only QUEUES `{choice:'runSwitch'}`
 * (sim/battle-actions.ts:155-158); `runSwitch` then DRAINS every consecutive `runSwitch` off the
 * queue head and fires a single `fieldEvent('SwitchIn', switchersIn)` (:172-186). Hazards live in
 * that event — `stealthrock.condition.onSwitchIn` is a SIDE CONDITION handler, collected by
 * `findSideEventHandlers(side, 'onSwitchIn', undefined, active)` in `Battle#fieldEvent`
 * (sim/battle.ts:498-505) — so they cannot fire between two switch lines.
 *
 * MEDICHAM2 FIRED THEM INLINE. `bringIn()` took the hazard bite at the moment the body was placed,
 * above the `deferEntry` return, so `refill()`'s batching moved the ABILITIES and left the hazards
 * interleaved. The pinned pool's card is exactly that:
 *     ordering :: |switch|p1b|garganacl,l50|H/H <> |-damage|p2a|H/H|[from]stealthrock
 *
 * ---- ARM `order` -------------------------------------------------------------------------------
 * WHICH replacement is announced first. TWO EARLIER READINGS OF THIS WERE REFUTED and the truth is
 * neither of them:
 *
 *   NOT the incoming body.  The `instaswitch` action is built as `{pokemon: the FAINTED active,
 *                           target: the bench body}` (sim/side.ts:1007-1011) and `comparePriority`
 *                           reads `action.speed`, which `getActionSpeed(action)` fills from
 *                           `action.pokemon.getActionSpeed()` (sim/battle.ts:2652-2657).
 *   NOT the outgoing body's ACTION SPEED EITHER, which is why the second reading failed: by the time
 *                           the switch request is issued, `faintMessages()` has run
 *                           `pokemon.clearVolatile(false)` and `pokemon.isActive = false`
 *                           (sim/battle.ts:2560-2562). `clearVolatile` ZEROES THE BOOSTS, and
 *                           `isActive === false` makes `findEventHandlers` skip its whole
 *                           Pokemon-and-bubble-to-Side block (sim/battle.ts:1053-1067) — so
 *                           `runEvent('ModifySpe', corpse)` COLLECTS NO HANDLERS AT ALL. No Choice
 *                           Scarf, no Tailwind, no weather-speed ability, no paralysis.
 *
 * SO IT IS THE CORPSE'S RAW STORED SPEED, and Trick Room still inverts it because `getActionSpeed`
 * reads `field.getPseudoWeather('trickroom')` directly rather than through an event
 * (sim/pokemon.ts:getActionSpeed). "Behaves as if the two switch actions tie" is what an observer
 * sees when they expect a modifier the authority has already dropped.
 *
 * THE ARM IS THE KNOB-CLEARED CONTROL FOR THAT CLAIM. The same two bodies are played twice, once
 * with the side-speed-doubling move up over the SLOWER corpse and once without. The doubling is
 * large enough to reverse the raw order, and the probe FAILS if the authority's own announcement
 * order moves — because if it moved, the modifier reached the corpse and this whole reading is wrong.
 * It also asserts the doubling reached SOMETHING: the ENTRY order (the arriving bodies, which are
 * still active and do get their modifiers) must change under it, or the fixture proves nothing.
 *
 * THE FIXTURE IS CONSTRUCTED, NOT FOUND, AND NOTHING IN IT IS TYPED.
 *   - the HAZARD is the move tagged `hazard` whose own condition damages on entry and does not ask
 *     `isGrounded` — read out of the format's move table, membership printed;
 *   - the SPEED DOUBLER is the move tagged `doublesSideSpeed`;
 *   - the KILLER is a zero-damage `userFaints` move with target `normal`, so both bodies die at a
 *     known moment with no damage roll anywhere in it;
 *   - the two DYING bodies are the slowest and a faster learner of the killer, chosen so the doubler
 *     reverses their raw order;
 *   - the KILLER'S VICTIM is the foe's slot b, which clicks the hazard every turn and never Protect —
 *     a victim that shields refuses the killer and nobody dies.
 *
 * KNOBS. `MEDI_ENTRY_HAZARD_INLINE=1` restores the per-body hazard bite; `MEDI_REPLACE_SPEED_MODIFIED=1`
 * restores the modified-speed sort. Each is re-run in a child and MUST move its own arm's outcome —
 * an identical result across a varied knob means the knob is unwired.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_ENTRY_HAZARD_INLINE === '1' || process.env.MEDI_REPLACE_SPEED_MODIFIED === '1';

require(D('tests', '_live_release.js'));
process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));

let bad = 0;
const stop = (why) => { console.log('  ' + why); process.exit(2); };

console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* THE HAZARD. Tagged `hazard`, and its own condition must DAMAGE on entry (so it writes a line the
 * two streams can be compared on) and must NOT ask `isGrounded` (so the arriving body's typing and
 * item cannot silently exempt it). Printed before it is used. */
const HAZ_ALL = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('hazard')).map(([k]) => k);
const hazSrc = k => { const c = dex.moves.get(k).condition; return c && c.onSwitchIn ? String(c.onSwitchIn) : ''; };
console.log('  moves tagged hazard                :');
for (const k of HAZ_ALL) {
  const src = hazSrc(k);
  console.log('      ' + k.padEnd(14) + ' damages=' + (/this\.damage\(/.test(src) ? 'yes' : 'no ')
    + '  asks isGrounded=' + (/isGrounded\(\)/.test(src) ? 'yes' : 'no '));
}
const HAZ = HAZ_ALL.find(k => { const s = hazSrc(k); return /this\.damage\(/.test(s) && !/isGrounded\(\)/.test(s); });
if (!HAZ) stop('NO UNGROUNDED DAMAGING HAZARD — a claim about the format.');
const HAZ_NAME = dex.moves.get(HAZ).name;

/* THE SPEED DOUBLER. */
const TW = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('doublesSideSpeed')).map(([k]) => k)[0];
if (!TW) stop('NOTHING CARRIES doublesSideSpeed — a claim about the artifact.');
const TW_NAME = dex.moves.get(TW).name;

/* THE KILLER — the same derivation tests/probe_refill_entry_herb.js uses, and for the same reason. */
const KILL = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('userFaints')).map(([k]) => k)
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard && m.basePower === 0
    && m.target === 'normal' && !(TAGS.moves[k].tags || []).includes('fixedDamage'); })[0];
if (!KILL) stop('NO ZERO-DAMAGE SELF-KO MOVE — a claim about the fixture.');
console.log('  hazard / doubler / killer          : ' + HAZ + ' / ' + TW + ' / ' + KILL);

/* THE TWO DYING BODIES. The slowest learner of the killer, and the fastest one the doubler can still
 * overtake — so the arm's knob genuinely reverses the RAW order and the reading is testable. */
const DIE = POOL.filter(s => LEARNS(s, KILL) && LEARNS(s, 'protect'))
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe);
if (DIE.length < 2) stop('FEWER THAN TWO LEGAL KILLERS — a claim about the fixture.');
const SLOW = DIE[0];
const FAST = DIE.filter(s => s.baseStats.spe > SLOW.baseStats.spe
  && s.baseStats.spe < SLOW.baseStats.spe * 2).pop();
if (!FAST) stop('NO KILLER THE DOUBLER CAN OVERTAKE — a claim about the fixture.');
console.log('  dying bodies (raw base Spe)        : SLOW ' + SLOW.name + ' ' + SLOW.baseStats.spe
  + '   FAST ' + FAST.name + ' ' + FAST.baseStats.spe
  + '   (' + SLOW.baseStats.spe + ' x2 = ' + SLOW.baseStats.spe * 2 + ' > ' + FAST.baseStats.spe + ')');

/* THE SUPPORT BODY sets the hazard and the doubler and NEVER Protects — it is the killer's victim. */
const SUP = POOL.filter(s => LEARNS(s, HAZ) && LEARNS(s, TW) && LEARNS(s, 'protect')
  && ![SLOW.name, FAST.name].includes(s.name));
if (SUP.length < 2) stop('FEWER THAN TWO LEGAL SUPPORT BODIES — a claim about the fixture.');
const supA = SUP[0], supB = SUP[1];
const REST = POOL.filter(s => LEARNS(s, 'protect')
  && ![SLOW.name, FAST.name, supA.name, supB.name].includes(s.name)).slice(0, 4);
if (REST.length < 4) stop('NOT ENOUGH LEGAL FILLER — a claim about the fixture.');
console.log('  support (hazard + doubler)         : ' + supA.name + ' / ' + supB.name);
console.log('  replacements                       : ' + REST.map(s => s.name).join(', '));

const mon = (species, moves) => ({ species, item: '', ability: '', moves });

/* ---- THE TOKENISER ------------------------------------------------------------------------------
 * The two engines spell names differently (`Stealth Rock` vs `stealthrock`, `Abomasnow` vs
 * `abomasnow`), so a raw string compare would fail on spelling and prove nothing. A line becomes
 * `KIND:SLOT[:FROM]`, all normalised — which keeps exactly what this probe is about (what happened,
 * to whom, in what order) and drops what it is not. NOTHING IS TYPED into the expectation: the two
 * token lists are compared against each other. */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const tok = (L) => {
  const p = L.split('|');
  const kind = p[1] || '';
  const who = norm((p[2] || '').split(':')[0]);
  const from = /\[from\]\s*([^|]+)/.exec(L);
  return kind + ':' + who + (from ? ':' + norm(from[1]) : '');
};
/* THE REPLACEMENT BLOCK — from the `|upkeep` that closes the turn two bodies died on, to the next
 * `|turn|`. FOUND, never indexed: an index typed here goes stale the moment the script changes. */
const block = (lines) => {
  for (let i = 0; i < lines.length; i++) {
    if (!/^\|upkeep/.test(lines[i])) continue;
    const out = [];
    for (let j = i + 1; j < lines.length && !/^\|turn\|/.test(lines[j]); j++) out.push(lines[j]);
    if (out.filter(l => /^\|switch\|/.test(l)).length >= 2) return out;
  }
  return null;
};

function arm(label, doubler) {
  const SIDE_A = [mon(SLOW.name, [KILL, 'Protect']), mon(supA.name, [HAZ_NAME, TW_NAME, 'Protect']),
                  mon(REST[0].name, ['Protect']), mon(REST[1].name, ['Protect'])];
  const SIDE_B = [mon(FAST.name, [KILL, 'Protect']), mon(supB.name, [HAZ_NAME, TW_NAME, 'Protect']),
                  mon(REST[2].name, ['Protect']), mon(REST[3].name, ['Protect'])];
  const a = G.buildPair(SIDE_A), b = G.buildPair(SIDE_B);
  if (!a || !b) return { err: 'COULD NOT BUILD THE PAIR' };
  /* turn 1  both sides lay the hazard.
   * turn 2  P1's support puts the doubler up over the SLOW corpse (or lays the hazard again, which
   *         fails harmlessly and keeps both arms the same length).
   * turn 3  both slot-a bodies click the killer at the foe's slot b and die together.
   * turn 4  a further boundary, so the block is closed. */
  const SCRIPT = [
    { p1: [{ m: 'protect' }, { m: HAZ }], p2: [{ m: 'protect' }, { m: HAZ }] },
    { p1: [{ m: 'protect' }, { m: doubler ? TW : HAZ }], p2: [{ m: 'protect' }, { m: HAZ }] },
    { p1: [{ m: KILL, t: 1 }, { m: HAZ }], p2: [{ m: KILL, t: 1 }, { m: HAZ }] },
    { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
  ];
  G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'replentry/' + label, {
    arm: G.ARM_BY_ID.get('middle'), script: SCRIPT,
  });
  if (r.err) return { err: 'THE GAME THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { err: SC.moveNotOnRequest + ' scripted click(s) were NOT on the request ('
    + SC.firstMissing + '); the arm did not run.' };
  const sdB = block(G.sdStream(G.lastSdLog())), meB = block(r.mediTrace || []);
  if (!sdB) return { err: 'the AUTHORITY never replaced two bodies at once — the fixture did not stage.' };
  if (!meB) return { err: 'medicham2 never replaced two bodies at once — the fixture did not stage.' };
  return {
    sd: sdB, medi: meB,
    sdTok: sdB.map(tok), meTok: meB.map(tok),
    sdSw: sdB.filter(l => /^\|switch\|/.test(l)).map(tok),
    meSw: meB.filter(l => /^\|switch\|/.test(l)).map(tok),
    sdHaz: sdB.filter(l => /^\|-damage\|/.test(l) && new RegExp(norm(HAZ_NAME)).test(norm(l))).map(tok),
    meHaz: meB.filter(l => /^\|-damage\|/.test(l) && new RegExp(norm(HAZ_NAME)).test(norm(l))).map(tok),
  };
}

const PLAIN = arm('plain', false);
const DOUBLED = arm('doubled', true);
for (const [n, a] of [['plain', PLAIN], ['doubled', DOUBLED]]) {
  if (a.err) { console.log('\n  ARM ' + n + ' — ' + a.err); process.exit(2); }
}

const show = (n, a) => {
  console.log('\n  === THE REPLACEMENT BLOCK, ARM `' + n + '` ===');
  console.log('   SHOWDOWN');  a.sd.forEach(l => console.log('      ' + l));
  console.log('   MEDICHAM2'); a.medi.forEach(l => console.log('      ' + l));
};
show('plain', PLAIN);
show('doubled', DOUBLED);

/* ---- THE FIXTURE MUST HAVE STAGED --------------------------------------------------------------- */
console.log('\n  === THE FIXTURE ASSERTIONS (a green verdict below is worthless without these) ===');
const fix = (what, ok, detail) => {
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + (detail ? '   ' + detail : ''));
  if (!ok) bad++;
  return ok;
};
fix('two bodies really were replaced at once, in BOTH engines',
  PLAIN.sdSw.length === 2 && PLAIN.meSw.length === 2, PLAIN.sdSw.join(' ') + '  |  ' + PLAIN.meSw.join(' '));
fix('the hazard really bit BOTH arrivals, in BOTH engines',
  PLAIN.sdHaz.length === 2 && PLAIN.meHaz.length === 2, PLAIN.sdHaz.join(' ') + '  |  ' + PLAIN.meHaz.join(' '));
/* THE INSTRUMENT CAN SEE A MODIFIER. The doubler is up over the side whose body arrives; the arriving
 * bodies ARE still active, so their entry order must move under it. If this does not move, the fixture
 * cannot distinguish "the corpse ignores modifiers" from "this rig ignores everything". */
const sdEntryPlain = PLAIN.sdHaz.join(' '), sdEntryDoubled = DOUBLED.sdHaz.join(' ');
fix('the doubler DOES reach the authority somewhere — the arriving bodies\' entry order moves',
  sdEntryPlain !== sdEntryDoubled, JSON.stringify(sdEntryPlain) + ' -> ' + JSON.stringify(sdEntryDoubled));
/* AND THE AUTHORITY'S ANNOUNCEMENT ORDER MUST NOT MOVE. This is the claim, asserted against the
 * AUTHORITY rather than against this engine: if the corpse's speed took the doubler, it would. */
fix('the authority\'s ANNOUNCEMENT order does NOT move under the doubler (the corpse drops modifiers)',
  PLAIN.sdSw.join(' ') === DOUBLED.sdSw.join(' '),
  JSON.stringify(PLAIN.sdSw.join(' ')) + ' -> ' + JSON.stringify(DOUBLED.sdSw.join(' ')));

/* ---- THE VERDICT --------------------------------------------------------------------------------- */
const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
const BATCH_OK = eq(PLAIN.sdTok, PLAIN.meTok);
const ORDER_OK = eq(DOUBLED.sdSw, DOUBLED.meSw);

if (CHILD) {
  console.log('\n  CONTROL ARM (' + (process.env.MEDI_ENTRY_HAZARD_INLINE === '1' ? 'MEDI_ENTRY_HAZARD_INLINE' : 'MEDI_REPLACE_SPEED_MODIFIED')
    + '=1) — this arm asserts nothing.');
  console.log('__CONTROL__' + JSON.stringify({ batch: PLAIN.meTok, order: DOUBLED.meSw, batchOk: BATCH_OK, orderOk: ORDER_OK }));
} else {
  console.log('\n  === ARM `batch` — every line of the replacement block, both engines ===');
  const n = Math.max(PLAIN.sdTok.length, PLAIN.meTok.length);
  for (let i = 0; i < n; i++) {
    const s = PLAIN.sdTok[i] || '(none)', m = PLAIN.meTok[i] || '(none)';
    console.log('   ' + (s === m ? '   ' : '>> ') + String(i).padStart(2) + '  showdown ' + s.padEnd(34) + ' medicham2 ' + m);
  }
  console.log('  ' + (BATCH_OK ? 'green' : 'RED  ') + '  the two engines emit the SAME replacement block');
  if (!BATCH_OK) bad++;

  console.log('\n  === ARM `order` — which replacement is announced first, under the doubler ===');
  console.log('   showdown  ' + DOUBLED.sdSw.join(' -> '));
  console.log('   medicham2 ' + DOUBLED.meSw.join(' -> '));
  console.log('  ' + (ORDER_OK ? 'green' : 'RED  ') + '  the two engines announce the replacements in the SAME order');
  if (!ORDER_OK) bad++;
}

if (!CHILD) {
  const { spawnSync } = require('child_process');
  for (const [knob, key, mine] of [['MEDI_ENTRY_HAZARD_INLINE', 'batch', PLAIN.meTok.join(' ')],
                                   ['MEDI_REPLACE_SPEED_MODIFIED', 'order', DOUBLED.meSw.join(' ')]]) {
    console.log('\n  --- re-running under ' + knob + '=1 (the control), in a child ---');
    const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
      { env: { ...process.env, [knob]: '1' }, encoding: 'utf8' });
    const out = String(c.stdout || '');
    const mark = /__CONTROL__(\{.*\})/.exec(out);
    if (!mark) {
      console.log('  RED    the control child printed no verdict line (exit ' + c.status + '):');
      process.stdout.write(out.split('\n').slice(-25).map(l => '        |' + l).join('\n') + '\n');
      if (c.stderr) process.stderr.write(String(c.stderr));
      bad++; continue;
    }
    const ctl = JSON.parse(mark[1]);
    const got = (ctl[key] || []).join(' ');
    const moved = got !== mine;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the `' + key + '` outcome');
    console.log('        default ' + JSON.stringify(mine));
    console.log('        control ' + JSON.stringify(got));
    if (!moved) { console.log('        An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
