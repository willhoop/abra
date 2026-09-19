/* probe_hit_event_buff_order.js — AN ON-HIT STAT ABILITY AGAINST THE SAME HIT'S STAT-CHANGING SECONDARY,
 * FOR EVERY LEGAL MEMBER OF BOTH CLASSES, PUT TO THE AUTHORITY. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_hit_event_buff_order.js
 *   SHOWDOWN_PATH=... node tests/probe_hit_event_buff_order.js --release <id> --only angerpoint
 *
 * ================= THE CARD =====================================================================
 *
 * `data/all-mechanics-fire.json`, release `d92bdfb50d88`, the Hyper Cutter row's CONTROL arm: a
 * Crabominable carrying ANGER POINT takes a critical Chilling Water. Attack reads +6 here and +5 in the
 * authority. No gate clause read it, because it was the control arm (see `control_arm_parted` and
 * `summary.control_arm_partings` in engine/all_mechanics_fire.js, added in the same pass).
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * `spreadMoveHit` is overridden by the Champions mod (data/mods/champions/scripts.ts:315-425) and numbers
 * its own steps: 2 `spreadDamage` (:369), 3 `runMoveEffects` (:375, "onHit event happens here" — it
 * raises `runEvent('Hit')`, sim/battle-actions.ts:1283), 4 `selfDrops` (:385), 5 `secondaries` (:388),
 * then `runEvent('DamagingHit')` (:410). `onAfterMoveSecondary` is later still, in the hit loop.
 *
 * So the EVENT a stat ability hangs on decides which side of the secondary it lands:
 *     onHit                 ABOVE the secondary      (Anger Point)
 *     onDamagingHit         BELOW the secondary      (Stamina, Justified, Weak Armor, Gooey)
 *     onAfterMoveSecondary  BELOW the whole hit      (Berserk)
 * The class is DERIVED below from the handlers, never listed. This engine paid Anger Point with the
 * `DamagingHit` family, so it landed below the secondary: a crit Chilling Water's -1 hit a neutral stage
 * and the +12 clamped it back to +6.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line or number. Both engines play the same one-turn script on the
 * `bottom-tie-first` arm (every crit and every secondary fires — the arm the staged battery played the
 * card on) and the pass is that the protocol streams AND the boards agree. SHOWDOWN IS THE EXPECTATION.
 * `MEDI_HIT_BUFF_AT_DAMAGING_HIT=1` restores the old position, so an `onHit` pair that the authority
 * shows the ability acting on must PART under it (red), and every other pair must hold under it (a
 * control: the knob moves only the `Hit`-event members).
 *
 * A PAIR THE ABILITY DID NOT ACT ON IS NOT A PASS. Justified needs a Dark hit, Weak Armor a physical one,
 * Gooey contact; the authority's own log says whether the ability acted (`[from] ability: <Name>` on the
 * carrier) and whether the secondary landed, and a pair missing either is reported NOT-EXERCISED.
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
/* THE BOARD IS PART OF THE PASS. game_differential reads `--state` at load; without it `playGame` compares
 * the protocol only, and the card is a board divergence. */
if (!process.argv.includes('--state')) process.argv.push('--state');

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_hit_event_buff_order.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_HIT_BUFF_AT_DAMAGING_HIT';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE CLASS, DERIVED ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.dexFor(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* A body that needs a stone or a forme change to exist is not a carrier a one-turn sheet can field. */
const fieldable = s => legal(s) && !s.battleOnly && !s.requiredItem && !(s.requiredItems && s.requiredItems.length);
const SPECIES = dex.species.all().filter(fieldable).sort((a, b) => (a.name < b.name ? -1 : 1));
const carriersOf = ab => SPECIES.filter(s => Object.values(s.abilities).map(id).includes(ab));
const ALL_AB = [...new Set(dex.species.all().filter(legal).flatMap(s => Object.values(s.abilities).map(id)))].sort();

/* WHICH HANDLER CARRIES A `boost(` — the event is the handler's name, read off the ability object. */
const EVENTS = ['onHit', 'onDamagingHit', 'onAfterMoveSecondary', 'onTryHit', 'onAfterEachBoost', 'onSourceAfterFaint'];
const ORDERED = { onHit: 'above the secondary', onDamagingHit: 'below the secondary', onAfterMoveSecondary: 'below the whole hit' };
const CLASS = [], EXCLUDED = [];
for (const ab of ALL_AB) {
  const a = dex.abilities.get(ab);
  for (const e of EVENTS) {
    if (typeof a[e] !== 'function' || !/\bboost\(/.test(String(a[e]))) continue;
    if (ORDERED[e]) CLASS.push({ ab, name: a.name, event: e });
    else EXCLUDED.push(a.name + ' (' + e + ': '
      + (e === 'onTryHit' ? 'absorbs the move, so no secondary runs'
        : e === 'onAfterEachBoost' ? 'is triggered BY the secondary\'s drop, not ordered against it'
          : 'fires on the attacker after a KO, not on the body that was hit') + ')');
  }
}
const MOVES = dex.moves.all().filter(legal).filter(m => m.category !== 'Status')
  .filter(m => [].concat(m.secondaries || []).some(x => x && x.boosts)).sort((a, b) => (a.id < b.id ? -1 : 1));

/* THE ATTACKER'S ABILITY MUST NOT TOUCH WHAT IS BEING ORDERED. Read off its handler text rather than named:
 * anything that edits secondaries or crits, changes a stat, starts on entry, sets a field, or suppresses an
 * ability is refused, and the first of the species' own abilities that passes is used. */
const NOISY = /secondar|crit|boost\(|onStart|onSwitchIn|onBeforeSwitchIn|Weather|Terrain|ignoreAbility|contact|onModifyMove|onModifyType/;
const quietAttackerAbility = sp => Object.values(sp.abilities).find(n => {
  const a = dex.abilities.get(n);
  return !Object.keys(a).some(k => /^on[A-Z]/.test(k) && (NOISY.test(k) || NOISY.test(String(a[k]))));
}) || null;
const learns = (sp, mv) => CS.canLearn(sp, mv);
const immune = (mv, sp) => !dex.getImmunity(mv.type, sp.types);
/* THE CARRIER CLICKS SLEEP TALK, whose `onTry` refuses for a body that is awake — a click that writes no
 * state. A carrier that cannot learn it is passed over and the next legal carrier is used. */
const IDLE = 'Sleep Talk';

const ATTACKER_ALLY = ['corviknight', '', 'Pressure', ['Protect', 'Iron Defense']];
const CARRIER_ALLY = ['snorlax', '', 'Thick Fat', ['Protect', 'Curse']];
const TAIL = [['toxapex', '', 'Regenerator', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect', 'Coil']]];
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));

const pairs = [], unstaged = [];
for (const c of CLASS) {
  if (ONLY && !ONLY.split(',').map(id).includes(c.ab)) continue;
  for (const mv of MOVES) {
    const carrier = carriersOf(c.ab).find(s => !immune(mv, s) && learns(s.id, IDLE));
    if (!carrier) { unstaged.push(c.name + ' × ' + mv.name + ': no legal carrier learns ' + IDLE + ' and takes a ' + mv.type + ' hit'); continue; }
    const attacker = SPECIES.find(s => s.id !== carrier.id && learns(s.id, mv.id) && quietAttackerAbility(s));
    if (!attacker) { unstaged.push(c.name + ' × ' + mv.name + ': no legal learner with a quiet ability'); continue; }
    pairs.push({ c, mv, carrier, attacker, atkAb: quietAttackerAbility(attacker),
      a: [[attacker.id, '', quietAttackerAbility(attacker), [mv.name, 'Protect'].filter(n => n === mv.name || learns(attacker.id, n))],
          ATTACKER_ALLY].concat(TAIL),
      b: [[carrier.id, '', c.name, [IDLE]], CARRIER_ALLY].concat(TAIL) });
  }
}

/* ---- LEGALITY OF THE FIXED BODIES, CHECKED ON EVERY RUN ----------------------------------------- */
let illegal = 0;
for (const row of [ATTACKER_ALLY, CARRIER_ALLY].concat(TAIL)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0]); illegal++; continue; }
  if (!Object.values(sp.abilities).map(id).includes(id(row[2]))) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++; }
  for (const m of row[3]) if (!legal(dex.moves.get(m)) || !learns(sp.id, m)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' / ' + m); illegal++; }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

console.log('probe_hit_event_buff_order — release ' + REL_ID);
console.log('  the class, derived: ' + CLASS.map(c => c.name + ' [' + c.event + ', ' + ORDERED[c.event] + ']').join('; '));
console.log('  excluded, with the reason read off the handler: ' + EXCLUDED.join('; '));
console.log('  damaging moves with a stat-changing secondary on the target: ' + MOVES.length);
console.log('  pairs staged ' + pairs.length + ', unstaged ' + unstaged.length);

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, p) {
  const arm = G.ARM_BY_ID.get('bottom-tie-first');
  if (!arm) { console.log('NOT RUN — the driver has no arm named bottom-tie-first'); process.exit(2); }
  G.resetScriptCounters();
  /* x6 keeps both bodies standing through a crit (the pool the staged battery played the card on); four bodies, the
   * driver's default, because `max` is the validator's six-body rule and nothing here is validated by it. */
  const seam = { hpBoost: 6 };
  const a = G.buildPair(stage(p.a), seam), b = G.buildPair(stage(p.b), seam);
  if (!a || !b) return { notStaged: true };
  const script = [{ p1: [{ m: p.mv.name, t: 0 }, { m: 'Protect' }], p2: [{ m: IDLE }, { m: 'Protect' }] }];
  const g = G.playGame(a, b, 'directed', 'probe_hit_event_buff_order :: ' + p.c.ab + ' x ' + p.mv.id, { script, arm });
  /* KEPT COMPACT, because 2 x 220 games are held until both passes are read: the first draft kept the whole game
   * object and re-required the driver per pair, and ran out of heap at 2 GB. */
  const r = { err: g.err || null,
              div: g.div ? { sdRaw: g.div.sdRaw, meRaw: g.div.meRaw } : null,
              stateDiv: g.stateDiv ? { turn: g.stateDiv.turn, diffs: (g.stateDiv.diffs || []).slice(0, 2) } : null };
  return { r, ex: exercised(p, G.lastSdLog() || []), sc: G.scriptCounters(),
           restored: (globalThis.MEDFAILS || {}).hitBuffAtDamagingHitRestored || 0,
           unknown: (globalThis.MEDFAILS || {}).buffOnHitEventUnknown || 0 };
}
/* WHAT THE AUTHORITY'S OWN LOG SAYS HAPPENED, read in its own two shapes (sim/battle.ts:2047-2070, `Battle#boost`):
 * Anger Point writes `-setboost ... [from] ability: Anger Point`; every other ability writes a bare
 * `|-ability|BODY|Name|boost` and then UNATTRIBUTED `-boost`/`-unboost` lines. So a `-boost`/`-unboost` on the carrier
 * is the ability's when it follows that `-ability ... boost` line, and the SECONDARY's otherwise — and only on a stat
 * the move's own secondary names (read off the dex). */
const exercised = (p, sd) => {
  const esc = p.c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* either side: Gooey's boost targets the ATTACKER, so its `-ability ... boost` line names p1a */
  const fromAb = new RegExp('^\\|[^|]*\\|p[12]a: [^|]*\\|.*\\[from\\] ability: ' + esc + '(\\||$)');
  const abLine = new RegExp('^\\|-ability\\|p[12]a: [^|]*\\|' + esc + '\\|boost');
  const secStats = new Set([].concat(p.mv.secondaries || []).filter(x => x && x.boosts).flatMap(x => Object.keys(x.boosts)));
  /* A HANDLER THAT BOOSTS THE ATTACKER as a secondary-flagged boost (Gooey: `boost({spe: -1}, source, target, null,
   * true)`) writes no `-ability` line at all (`boosted = isSecondary`), so its receipt is a stat line on p1a — the
   * attacker clicks a move with no self drop and its ally clicks Protect, so nothing else moves a p1a stage. */
  const hitsSource = /boost\([^)]*\bsource\b/.test(String(dex.abilities.get(p.c.ab)[p.c.event] || ''))
    && !p.mv.self && !p.mv.selfBoost;
  let acted = false, sec = false, inAb = false;
  for (const l0 of sd) {
    const l = String(l0);
    if (hitsSource && /^\|-(unboost|boost)\|p1a: /.test(l) && !/\[from\]/.test(l)) acted = true;
    if (fromAb.test(l)) { acted = true; inAb = false; continue; }
    if (abLine.test(l)) { acted = true; inAb = true; continue; }
    const m = /^\|-(unboost|boost)\|(p[12])a: [^|]*\|([a-z]+)\|/.exec(l);
    if (m && inAb) continue;
    inAb = false;
    if (m && m[2] === 'p2' && !/\[from\]/.test(l) && secStats.has(m[3])) sec = true;
  }
  return { acted, sec };
};

let redBoard = 0, bad = 0, redProven = 0, controlsHeld = 0, notEx = 0, boardParts = 0;
const byAb = {};
/* TWO PASSES, ONE LOAD EACH: every pair on the clean engine, then every pair under the knob. */
const CLEAN = new Map(), BRK = new Map();
{ const G = harness(false); for (const p of pairs) CLEAN.set(p, play(G, p)); }
{ const G = harness(true); for (const p of pairs) BRK.set(p, play(G, p)); }
harness(false);
for (const p of pairs) {
  const clean = CLEAN.get(p);
  if (clean.notStaged || clean.r.err) { bad++; console.log('NOT-STAGED  ' + p.c.ab + ' × ' + p.mv.id + '  ' + (clean.r ? clean.r.err : '')); continue; }
  const brk = BRK.get(p);
  if (brk.notStaged || brk.r.err) { bad++; console.log('NOT-STAGED under the knob  ' + p.c.ab + ' × ' + p.mv.id); continue; }
  const ex = clean.ex;
  const refused = clean.sc.moveNotOnRequest || 0;
  const s = byAb[p.c.name] || (byAb[p.c.name] = { pairs: 0, exercised: 0, red: 0, held: 0, parted: [], redBoard: [] });
  s.pairs++;
  const fails = [];
  if (refused) fails.push('a scripted click was not on the request (' + refused + ')');
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (clean.unknown) fails.push('the tag carries no event for ' + p.c.name + ' (MEDFAILS.buffOnHitEventUnknown ' + clean.unknown + ')');
  const cleanPart = clean.r.div || clean.r.stateDiv;
  if (cleanPart) { fails.push('the engines part on the CLEAN load'); s.parted.push(p.mv.id); if (clean.r.stateDiv) boardParts++; }
  const isRed = p.c.event === 'onHit' && ex.acted && ex.sec;
  if (!(ex.acted && ex.sec)) { notEx++; }
  else s.exercised++;
  const brkPart = brk.r.div || brk.r.stateDiv;
  if (isRed) { if (!brkPart) fails.push('the knob did not move an exercised onHit pair — this arm proves nothing'); else { redProven++; s.red++; if (brk.r.stateDiv) { redBoard++; s.redBoard.push(p.mv.id); } } }
  else if (brkPart) fails.push('OVER-FIRE — a pair outside the Hit event moved under the knob');
  else if (ex.acted && ex.sec) { controlsHeld++; s.held++; }
  if (fails.length) {
    bad++;
    const d = clean.r.div || brk.r.div;
    const st = clean.r.stateDiv || brk.r.stateDiv;
    console.log(NL + 'FAIL  ' + p.c.name + ' × ' + p.mv.name + '  (' + p.carrier.name + ' hit by ' + p.attacker.name + ' [' + p.atkAb + '])');
    for (const f of fails) console.log('    >> ' + f);
    if (d) { console.log('      showdown  ' + d.sdRaw); console.log('      medicham  ' + d.meRaw); }
    if (st) console.log('      board     ' + JSON.stringify((st.diffs || []).slice(0, 2)));
  }
}
harness(false);

console.log(NL + 'BY ABILITY (pairs / exercised by the authority\'s own log / red proven under the knob / controls held):');
for (const [n, s] of Object.entries(byAb))
  console.log('  ' + n.padEnd(12) + String(s.pairs).padStart(3) + ' / ' + String(s.exercised).padStart(3) + ' / red ' + String(s.red).padStart(3)
    + ' / held ' + String(s.held).padStart(3) + (s.redBoard.length ? '   knob parts the BOARD on: ' + s.redBoard.join(',') : '') + (s.parted.length ? '   CLEAN PARTS: ' + s.parted.join(',') : ''));
console.log('  not exercised (the ability or the secondary did not act, per the authority): ' + notEx + ' — reported, never counted as a pass');
if (unstaged.length) console.log('  unstaged: ' + unstaged.length + ' — ' + unstaged.slice(0, 6).join(' | '));
console.log(NL + pairs.length + ' pairs staged, ' + bad + ' failing, ' + redProven + ' red proven, ' + controlsHeld + ' controls held, '
  + redBoard + ' of the red arms part a BOARD under the knob, ' + boardParts + ' clean BOARD partings   [release ' + REL_ID + ']');
const noRed = !ONLY && redProven === 0;
if (noRed) console.log('FAIL — no onHit pair was exercised, so the knob was never shown to move anything');
console.log(bad || noRed ? 'FAIL' : ONLY ? 'PASS for the abilities named by --only. THIS IS NOT THE FILE\'S VERDICT.'
  : 'PASS — every exercised pair agrees with the authority on the stream and the board; the knob parts every exercised onHit pair and no other');
process.exit(bad || noRed ? 1 : 0);
