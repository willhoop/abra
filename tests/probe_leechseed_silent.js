/* probe_leechseed_silent.js — `Battle#heal` GIVES LEECH SEED ITS OWN CASE AND THIS ENGINE WROTE THE
 * `default:` BRANCH'S SHAPE ON IT. 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_leechseed_silent.js
 *   SHOWDOWN_PATH=... node tests/probe_leechseed_silent.js --release <id> --only seeder-heal-is-silent
 *
 * ================= WHAT THE AUTHORITY DOES, READ AND NOT RECALLED ================================
 *
 *     sim/battle.ts:2276-2279          switch (effect?.id) {
 *                                        case 'leechseed':
 *                                        case 'rest':
 *                                          this.add('-heal', target, target.getHealth, '[silent]');
 *
 * and the `default:` branch further down is the one that writes `'[from] ' + effect.fullname`. The
 * seed's residual is `const damage = this.damage(baseMaxhp / 8, pokemon, target); if (damage)
 * this.heal(damage, target, pokemon);` (data/moves.ts, `leechseed.condition.onResidual`), so the
 * effect id in front of that switch is `leechseed` and the seeder's line takes the FIRST case.
 *
 * THE VICTIM'S LINE IS THE CONTROL AND IT IS THE OPPOSITE. `Battle#damage` has no such case, so the
 * chip keeps its `[from] Leech Seed` — the two lines of ONE handler are narrated differently, which
 * is exactly why "attribute the effect everywhere" is the wrong rule and why this arm asserts both
 * halves rather than only the one that moved.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 *     TR.heal(_s, '[from] Leech Seed', m)      ->  |-heal|p1b: X|47/140|[from] Leech Seed|[of] p2a: Y
 *     the authority                            ->  |-heal|p1b: X|47/140|[silent]
 *
 * Measured on the pinned pool at release `63cbcc2ef605` as the FIRST protocol divergence of two
 * whole-game pairs, class `-heal field 4`. `[silent]` is stripped by the differential's normaliser, so
 * the comparison is between a bare line and one carrying two extra fields.
 *
 * ================= NOTHING BELOW IS TYPED =======================================================
 *
 * No arm declares a line. Both engines play the identical script under the differential's own
 * `middle` pin and the file asserts the WHOLE `-heal`/`-damage` line agrees, attribution fields
 * included. `MEDI_LEECHSEED_HEAL_ATTRIBUTED=1` must part the red arm and move no control.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const NL = '\n';
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) REL_ID = ER.cut('tests/probe_leechseed_silent.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_LEECHSEED_HEAL_ATTRIBUTED';
const KNOB2 = 'MEDI_LEECHSEED_CHIP_WITHOUT_SEEDER';

let _cur = null, _G = null;
function harness(knobOn, which) {
  const K = which === 2 ? KNOB2 : KNOB;
  const key = (knobOn ? 'on' : 'off') + (which || 1);
  if (_G && _cur === key) return _G;
  delete process.env[KNOB]; delete process.env[KNOB2];
  if (knobOn) process.env[K] = '1';
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE BOARD --------------------------------------------------------------------------------
 * The seeder must be BELOW full HP when the tick arrives or `heal()` returns false at
 * `if (target.hp >= target.maxhp) return false` and there is no line to compare. Lucario's Aura
 * Sphere is the damage source for what it does NOT do: `accuracy: true`, no secondary, no contact,
 * and Fighting is neutral into Grass — no second mechanic reaches the turn. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const MEG = ['meganium', '', 'Overgrow', ['Leech Seed', 'Ingrain', 'Protect']];
const MIL = ['milotic', '', 'Marvel Scale', ['Protect']];
const LUC = ['lucario', '', 'Inner Focus', ['Aura Sphere', 'Protect']];
const LAX = ['snorlax', '', 'Immunity', ['Protect']];
/* THE KILL ARM NEEDS THE SEEDER DEAD ON A TURN THE SEED IS STILL UP, so the second foe slot carries a
 * super-effective attacker. X-Scissor is `accuracy: 100`, has no secondary and is 2x into Grass. */
const SCI = ['scizor', '', 'Technician', ['X-Scissor', 'Protect']];

const SEED_SIDE = stage([MEG, MIL]).concat(BENCH('clefable', 'sylveon'));
const FOE_SIDE = stage([LUC, LAX]).concat(BENCH('garchomp', 'kingambit'));
const KILL_SIDE = stage([LUC, SCI]).concat(BENCH('garchomp', 'kingambit'));

const P = { m: 'protect' }, SEED = { m: 'leechseed', t: 0 }, ING = { m: 'ingrain' },
      AS0 = { m: 'aurasphere', t: 0 }, XS0 = { m: 'xscissor', t: 0 };

const CASES = [
  { id: 'seeder-heal-is-silent', kind: 'red', mirror: false,
    script: [{ p1: [SEED, P], p2: [AS0, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'THE SEEDER\'S RETURN CARRIES NO ATTRIBUTION. Three ticks, so a line that is right once and '
        + 'wrong afterwards cannot pass. The VICTIM\'S chip is asserted on the same turns and must '
        + 'KEEP its `[from] Leech Seed` — the two lines of one handler are narrated differently.' },

  { id: 'seeder-heal-is-silent-mirror', kind: 'red', mirror: true,
    script: [{ p1: [AS0, P], p2: [SEED, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE.' },

  { id: 'seeder-fainted-stops-the-chip', kind: 'red', mirror: false, foe: 'kill', knob2: true,
    script: [{ p1: [SEED, P], p2: [AS0, XS0] }, { p1: [P, P], p2: [AS0, XS0] },
             { p1: [P, P], p2: [AS0, XS0] }],
    what: 'THE BOARD HALF. `leechseed.onResidual` looks the sower slot up and RETURNS before it '
        + 'damages anything when that slot is empty, fainted or at 0 HP — and a body that faints '
        + 'mid-turn is still standing in its slot when the residual of that turn opens, because the '
        + 'replacement is a NEXT-turn request. This engine gated only the heal on that lookup, so a '
        + 'seed whose sower had just died went on taking maxhp/8 off the victim. The chip is a BOARD '
        + 'leaf, which is why this arm is not about a line.' },

  { id: 'ingrain-keeps-its-attribution', kind: 'control', mirror: false, differsFrom: 'seeder-heal-is-silent',
    script: [{ p1: [ING, P], p2: [AS0, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'THE OTHER RESIDUAL HEAL ON THE SAME BODY, AND IT IS THE ARM A BLANKET "MAKE RESIDUAL HEALS '
        + 'SILENT" FIX WOULD FAIL. Ingrain falls through to `default:` and the authority DOES write '
        + '`[from] Ingrain`. The knob must not move one byte of it either.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const row of SEED_SIDE.concat(FOE_SIDE, KILL_SIDE)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* THE AUTHORITY'S OWN SWITCH, RE-DERIVED. If `Battle#heal` ever stops giving leechseed its own case
 * this file is asking about a rule the format no longer has, and that is a finding rather than a
 * pass. Read out of the checkout this run loaded, never out of the header. */
const fs = require('fs');
/* IT MUST NOT SWALLOW THE READ FAILURE — 2026-09-06. Returning '' here made `HAS_CASE` false, and the
 * message underneath then accused the AUTHORITY of having dropped its `case 'leechseed'`. An
 * unreadable checkout and a changed rulebook are two different findings and this file was printing
 * the second one for both. It now names the file and the errno and stops. */
const HEAL_PATH = path.join(process.env.SHOWDOWN_PATH || '', 'sim', 'battle.ts');
let HEAL_SRC;
try { HEAL_SRC = fs.readFileSync(HEAL_PATH, 'utf8'); }
catch (e) {
  console.log(NL + 'NOT RUN — could not read the authority at ' + HEAL_PATH + ': ' + e.message
    + '. That is a broken SHOWDOWN_PATH, NOT a statement about `Battle#heal`.');
  process.exit(2);
}
const HAS_CASE = /case 'leechseed':\s*\n\s*case 'rest':\s*\n\s*this\.add\('-heal', target, target\.getHealth, '\[silent\]'\)/.test(HEAL_SRC);
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    Battle#heal has `case leechseed -> [silent]` : ' + HAS_CASE);
if (!HAS_CASE) {
  console.log(NL + 'NOT RUN — the authority no longer routes a leechseed heal past `default:`. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READER. THE ATTRIBUTION FIELDS ARE KEPT, WHICH IS THE WHOLE POINT. `[silent]` IS DROPPED
 * because the differential's own normaliser drops it on both sides, so an engine that emitted it and
 * one that did not are indistinguishable to the measurement this probe is about. What is NOT dropped
 * is `[from]` and `[of]`. */
/* THE FIELD NORMALISER MIRRORS THE DIFFERENTIAL'S OWN, and it has to: the two engines legitimately
 * spell an effect `Ingrain` and `move: ingrain`, and `engine/game_differential.js` folds that away on
 * both sides before it compares. A probe with a stricter reader than the measurement it is defending
 * reports defects the measurement cannot see -- which is what the first draft of this file did, and
 * it accused the Ingrain CONTROL rather than the mechanic. What is NOT folded away is the PRESENCE of
 * `[from]` and `[of]`, which is the whole claim.
 * `[silent]` is dropped because the differential drops it on both sides. */
const fld = x => String(x)
  .replace(/(move|ability|item)[ ]*:[ ]*/gi, '')
  .replace(/p[12][ab][ ]*:[ ]*/gi, '')
  .toLowerCase().replace(/[^a-z0-9\/]/g, '');
const KEEP = /^\|(-heal|-damage|-start)\|/;
function shape(lines) {
  const out = [];
  for (const raw of lines.map(String)) {
    if (!KEEP.test(raw)) continue;
    const p = raw.split('|').filter(x => !/^\s*\[silent\]\s*$/.test(x));
    out.push(p[1] + '|' + fld(p[2]) + '|' + p.slice(3).map(fld).filter(Boolean).join('|'));
  }
  return out;
}

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const FOE = c.foe === 'kill' ? KILL_SIDE : FOE_SIDE;
  const A = c.mirror ? FOE : SEED_SIDE, B = c.mirror ? SEED_SIDE : FOE;
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_leechseed_silent :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical }),
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  return { r, delta, boards, sd: shape(sdAll), me: shape(meAll),
           sdHeals: sdAll.filter(l => /^\|-heal\|/.test(l)).length,
           sdSeedChips: sdAll.filter(l => /^\|-damage\|/.test(l) && /Leech Seed/i.test(l)).length,
           meSeedChips: meAll.filter(l => /^\|-damage\|/.test(l) && /Leech Seed/i.test(l)).length,
           noChip: (delta.leechSeedNoSeederNoChip || 0),
           restored: ((globalThis.MEDFAILS || {}).leechSeedHealAttributedRestored || 0)
                   + ((globalThis.MEDFAILS || {}).leechSeedChipWithoutSeederRestored || 0) };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const boardEq = rows => rows.every(r => r.identical);

let bad = 0, ran = 0;
const seen = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']');
  console.log('  ' + c.what);

  const which = c.knob2 ? 2 : 1;
  const clean = play(harness(false, which), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true, which), c);
  harness(false, which);
  ran++;

  console.log('    showdown  ' + clean.sd.join('  ->  '));
  console.log('    medicham  ' + clean.me.join('  ->  '));
  console.log('    medicham  ' + brk.me.join('  ->  ') + '   [knob]');
  console.log('    board     ' + clean.boards.map(b => 'b' + b.t + ':' + (b.identical ? 'ok' : 'PART')).join(' '));
  console.log('    authority `-heal` lines : ' + clean.sdHeals
    + '   |   counters  silentSeederHeals ' + (clean.delta.leechSeedHealSilent || 0)
    + '  knob ' + ((brk.delta || {}).leechSeedHealSilent || 0)
    + '   |   noSeederNoChip ' + clean.noChip + ' knob ' + brk.noChip
    + '   |   MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored);

  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out.'); bad++; continue; }
  /* THE FIXTURE, PER ARM. A heal arm with no heal and a chip arm with no chip are both empty turns,
   * and an empty turn agrees with anything. The CHIP arm additionally requires the authority to have
   * emitted FEWER chips than turns of standing seed — otherwise the sower never died and the guard
   * this arm exists for was never reached. */
  if (!c.knob2 && !clean.sdHeals) {
    console.log('    >> FIXTURE FAILED — the authority healed nothing on this arm.'); bad++; continue; }
  if (c.knob2 && !(clean.sdSeedChips > 0 && brk.meSeedChips > clean.sdSeedChips)) {
    console.log('    >> FIXTURE FAILED — the authority wrote ' + clean.sdSeedChips + ' Leech Seed '
      + 'chip(s) and the knob load wrote ' + brk.meSeedChips + '; the arm needs a sower that dies '
      + 'while the seed still stands.'); bad++; continue; }
  if (!(clean.restored === 0 && brk.restored === (c.kind === 'red' ? 1 : brk.restored))) {
    console.log('    >> KNOB DID NOT BIND on a red arm.'); bad++; continue; }

  seen.set(c.id, { sd: clean.sd });

  const agree = eq(clean.sd, clean.me) && boardEq(clean.boards);
  if (!agree) { console.log('    >> DEFECT — the engines part on a line or on the board.'); bad++; }
  else console.log('    >> the two engines agree on every -heal/-damage line, attribution included.');

  const knobAgree = eq(clean.sd, brk.me) && boardEq(brk.boards);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob.'); bad++; }
  }
}

for (const c of CASES) {
  if (!c.differsFrom) continue;
  const a = seen.get(c.id), b = seen.get(c.differsFrom);
  if (!a || !b) continue;
  const moved = !eq(a.sd, b.sd);
  console.log(NL + '  INSTRUMENT CONTROL — showdown plays `' + c.id + '` differently from `'
    + c.differsFrom + '`: ' + (moved ? 'YES' : 'NO'));
  if (!moved) { console.log('    >> THE TWO RESIDUAL HEALS ARE NARRATED THE SAME IN THE AUTHORITY — '
    + 'nothing here measures the case split.'); bad++; }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
