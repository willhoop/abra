/* probe_bigroot_family.js — BIG ROOT DECLARES FIVE HEAL SOURCES AND THIS ENGINE READ ONE. 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_bigroot_family.js
 *   SHOWDOWN_PATH=... node tests/probe_bigroot_family.js --release <id> --only ingrain-bigroot
 *
 * ================= WHAT THE AUTHORITY DOES, READ AND NOT RECALLED ================================
 *
 *     data/items.ts  bigroot
 *       onTryHealPriority: 1,
 *       onTryHeal(damage, target, source, effect) {
 *         const heals = ['drain', 'leechseed', 'ingrain', 'aquaring', 'strengthsap'];
 *         if (heals.includes(effect.id)) return this.chainModify([5324, 4096]);
 *       }
 *
 * Champions overrides neither the item nor any of the five handlers (`data/mods/champions/items.ts`
 * carries no `bigroot`), and the membership is RE-DERIVED on every run below out of
 * `data/tags.json`'s own `healMultBySource.from` — nothing here is typed from the block above.
 *
 * THE ORDER OF OPERATIONS IS THE OTHER HALF AND IT IS READ OFF `Battle#heal` (sim/battle.ts:2258):
 *
 *       if (damage && damage <= 1) damage = 1;
 *       damage = this.trunc(damage);                                   <- the base is truncated FIRST
 *       damage = this.runEvent('TryHeal', target, source, effect, damage);   <- then Big Root
 *
 * so a 155 HP Ingrain is `trunc(155/16) = 9`, then `modify(9, 5324, 4096) = 12` — not
 * `trunc(155/16 * 1.2998) = 12` by luck and not `trunc(9 * 1.2998) = 11`. `md4096` is this engine's
 * one implementation of `Battle#modify` and is what the fix calls.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `healMultBySource` had exactly two readers, both on the DRAIN road (`_payDrainRow` and the
 * MEDI_DRAIN_LUMP_ROUND restore), and both filtered `from.includes('drain')`. The four other members
 * of the item's own list had no reader at all:
 *
 *     ingrain / aquaring   the `volHeal` residual step   `Math.max(1, trunc(maxhp / per))`
 *     leechseed            the seeder's return           `_s.curHP += _d`
 *     strengthsap          `_sapHeal`                    `m.curHP += _sapHeal`
 *
 * FOUND IN THE POOL, not in the lab: `|-heal|p1a: Meganium|71/155|[from] Ingrain` against this
 * engine's `68/155`, release `63cbcc2ef605`, first board divergence of one whole-game pair.
 *
 * ================= NOTHING BELOW IS TYPED =======================================================
 *
 * No arm declares an expected heal. Both engines play the identical script under the differential's
 * own `middle` pin and the file asserts they AGREE on the `-heal` lines and on the board at every
 * boundary. `MEDI_BIGROOT_DRAIN_ONLY=1` must part every red arm and move no control. Each red arm is
 * paired with the SAME board carrying no item at all, and the pair is asserted DIFFERENT ON THE
 * AUTHORITY'S OWN LINES — so "the two engines agree" can never be read off a turn where Big Root
 * could not have mattered.
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
if (!REL_ID) REL_ID = ER.cut('tests/probe_bigroot_family.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_BIGROOT_DRAIN_ONLY';

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

/* ---- THE BOARDS -------------------------------------------------------------------------------
 * ONE FOE SHEET AND TWO HEALER SHEETS, and the ITEM is the only thing an arm varies.
 *
 * Lucario's AURA SPHERE is the damage source on every arm and it is chosen for what it does NOT do:
 * `accuracy: true` (no accuracy die), no `secondary`, not a contact move, and Fighting is NEUTRAL
 * into Grass and into Water — so no `-supereffective`, no reaction ability and no second mechanic
 * lands in the comparison. It is `target: "any"`, so every arm names its slot explicitly.
 *
 * The healer must be BELOW full HP when the residual opens or the authority's `heal()` returns false
 * at `if (target.hp >= target.maxhp) return false` and the arm measures nothing. Lucario is FASTER
 * than all three healers (90 against 80 / 81 / 50), so the hit always lands before the click. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const MEG = it => ['meganium', it, 'Overgrow', ['Ingrain', 'Leech Seed', 'Protect', 'Body Slam']];
const MIL = it => ['milotic', it, 'Marvel Scale', ['Aqua Ring', 'Protect']];
const VIL = it => ['vileplume', it, 'Chlorophyll', ['Strength Sap', 'Protect', 'Growth']];
const LUC = ['lucario', '', 'Inner Focus', ['Aura Sphere', 'Protect']];
const LAX = ['snorlax', '', 'Immunity', ['Protect']];
/* THE SAP ARM NEEDS A DIFFERENT FOE AND THE REASON IS ARITHMETIC, NOT TASTE. Strength Sap heals by
 * the TARGET'S ATTACK STAT, and Lucario's is large enough that the heal clamps at full HP — an arm
 * in which both engines write `150/150` cannot tell a 1.30x heal from a 1.00x one. Gardevoir has the
 * low Attack (65) and the high Special Attack (125), and Psyshock is 2x into Grass/Poison, so the
 * damage outruns the sap from the second turn on. Synchronize reacts only to status, of which this
 * arm inflicts none. */
const GAR = ['gardevoir', '', 'Synchronize', ['Calm Mind', 'Protect']];

const HEAL_SIDE = it => stage([MEG(it), MIL(it)]).concat(BENCH('clefable', 'sylveon'));
const SAP_SIDE = it => stage([VIL(it), MIL(it)]).concat(BENCH('clefable', 'sylveon'));
const FOE_SIDE = stage([LUC, LAX]).concat(BENCH('garchomp', 'kingambit'));
const SAP_FOE_SIDE = stage([GAR, LUC]).concat(BENCH('garchomp', 'kingambit'));

const P = { m: 'protect' };
const ING = { m: 'ingrain' }, SEED = { m: 'leechseed', t: 0 }, RING = { m: 'aquaring' },
      SAP = { m: 'strengthsap', t: 0 };
const AS0 = { m: 'aurasphere', t: 0 };   /* the opposing slot A */
const CM = { m: 'calmmind' }, GRO = { m: 'growth' };
const AS0B = { m: 'aurasphere', t: 0 };
const AS1 = { m: 'aurasphere', t: 1 };   /* the opposing slot B */

/* Three residual turns after the hit, so a heal that is right on the first tick and wrong on the
 * second cannot pass. `side` names which sheet plays p1. */
const CASES = [
  { id: 'ingrain-bigroot', kind: 'red', side: 'heal', item: 'bigroot', mirror: false,
    script: [{ p1: [ING, P], p2: [AS0, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'INGRAIN IS ON BIG ROOT\'S OWN LIST AND THIS ENGINE HEALED THE BARE 1/16. The `volHeal` '
        + 'residual step read no item at all.' },

  { id: 'ingrain-bigroot-mirror', kind: 'red', side: 'heal', item: 'bigroot', mirror: true,
    script: [{ p1: [AS0, P], p2: [ING, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE.' },

  { id: 'aquaring-bigroot', kind: 'red', side: 'heal', item: 'bigroot', mirror: false,
    script: [{ p1: [P, RING], p2: [AS1, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'THE SECOND MEMBER OF THE SAME RESIDUAL STEP. Aqua Ring and Ingrain share one branch, so '
        + 'this arm is what proves the fix is on the STEP and not on one volatile name.' },

  { id: 'leechseed-bigroot', kind: 'red', side: 'heal', item: 'bigroot', mirror: false,
    script: [{ p1: [SEED, P], p2: [AS0, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'THE SEEDER\'S RETURN. `this.heal(damage, target, pokemon)` puts the effect id `leechseed` '
        + 'in front of Big Root\'s list, and this engine added the raw chip to the seeder.' },

  { id: 'strengthsap-bigroot', kind: 'red', side: 'sap', item: 'bigroot', mirror: false,
    foe: 'sap',
    script: [{ p1: [GRO, P], p2: [CM, AS0B] }, { p1: [GRO, P], p2: [CM, AS0B] },
             { p1: [SAP, P], p2: [CM, AS0B] }],
    what: 'THE FIFTH MEMBER, ON THE MOVE ROAD RATHER THAN THE RESIDUAL. Two turns of Aura Sphere put '
        + 'Vileplume far enough down that the sap CANNOT clamp at full HP — an arm where both engines '
        + 'write `150/150` could not tell a 1.30x heal from a 1.00x one, which is what the first '
        + 'staging of this arm did. Gardevoir is the sap TARGET for its low Attack (65) and clicks '
        + 'Calm Mind, which moves neither the stat the sap reads nor the damage it takes.' },

  /* ---- CONTROLS. Each clears the ITEM and nothing else ----------------------------------------- */
  { id: 'ingrain-noitem', kind: 'control', side: 'heal', item: '', mirror: false,
    differsFrom: 'ingrain-bigroot',
    script: [{ p1: [ING, P], p2: [AS0, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board with NO item. The heal is the bare 1/16 '
        + 'in both engines and always was, so the knob must not move one byte of it.' },

  { id: 'leechseed-noitem', kind: 'control', side: 'heal', item: '', mirror: false,
    differsFrom: 'leechseed-bigroot',
    script: [{ p1: [SEED, P], p2: [AS0, P] }, { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }],
    what: 'AND THE SEED HALF CLEARED THE SAME WAY.' },

  { id: 'strengthsap-noitem', kind: 'control', side: 'sap', item: '', mirror: false,
    differsFrom: 'strengthsap-bigroot',
    foe: 'sap',
    script: [{ p1: [GRO, P], p2: [CM, AS0B] }, { p1: [GRO, P], p2: [CM, AS0B] },
             { p1: [SAP, P], p2: [CM, AS0B] }],
    what: 'AND THE SAP HALF.' },
];

/* ---- LEGALITY AND THE MEMBERSHIP, DERIVED AND REFUSED ------------------------------------------ */
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
for (const row of HEAL_SIDE('bigroot').concat(SAP_SIDE('bigroot'), FOE_SIDE, SAP_FOE_SIDE)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) {
    console.log('ILLEGAL FIXTURE  ' + row.item + ' is not in this format'); illegal++;
  }
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

/* THE ITEM'S OWN LIST, OUT OF THE ARTIFACT THIS ENGINE READS, and the arms checked against it. */
const TAGS = require(D('data', 'tags.json'));
const HMS = ((TAGS.items || {}).bigroot || {}).params || {};
const FROM = ((HMS.healMultBySource || {}).from) || [];
const MULT = (HMS.healMultBySource || {}).mult;
const CARRIERS = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('healMultBySource')).map(([k]) => k);
console.log(NL + '  THE MEMBERSHIP, RE-DERIVED THIS RUN:');
console.log('    healMultBySource carriers : ' + CARRIERS.join(' '));
console.log('    bigroot.from              : ' + FROM.join(' ') + '    mult ' + MULT);
const ARM_SOURCES = ['ingrain', 'aquaring', 'leechseed', 'strengthsap'];
const UNCOVERED = FROM.filter(x => x !== 'drain' && !ARM_SOURCES.includes(x));
console.log('    non-drain members with no arm here : ' + (UNCOVERED.length ? UNCOVERED.join(' ') : 'none'));
if (CARRIERS.length !== 1 || CARRIERS[0] !== 'bigroot' || !(MULT > 1) || UNCOVERED.length) {
  console.log(NL + 'NOT RUN — the artifact\'s `healMultBySource` population is not the one every arm '
    + 'below stages. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READER -------------------------------------------------------------------------------
 * WHAT A HEAL DID, reduced to what both narrators must agree on. The `[from]` field is DROPPED —
 * `Battle#heal`'s `case 'leechseed'` writes `[silent]` where this engine writes an attribution, and
 * that is a separate, narration-only defect this file is not about. The HP FIELD IS KEPT WHOLE,
 * because it is the whole claim. */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9/]/g, '');
const KEEP = /^\|(-heal|-damage|-start|-end|faint)\|/;
function shape(lines) {
  const out = [];
  for (const raw of lines.map(String)) {
    if (!KEEP.test(raw)) continue;
    const p = raw.split('|');
    out.push(p[1] + '|' + norm(String(p[2] || '').split(':').slice(-1)[0]) + '|' + norm(p[3]));
  }
  return out;
}

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const HEALER = c.side === 'sap' ? SAP_SIDE(c.item) : HEAL_SIDE(c.item);
  const FOE = c.foe === 'sap' ? SAP_FOE_SIDE : FOE_SIDE;
  const A = c.mirror ? FOE : HEALER, B = c.mirror ? HEALER : FOE;
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_bigroot_family :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t) => {
      boards.push({ t, identical: !!snap.identical,
                    diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) });
    },
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  return { r, delta, boards, sd: shape(sdAll), me: shape(meAll),
           sdHeals: sdAll.filter(l => /^\|-heal\|/.test(l)).length,
           restored: (globalThis.MEDFAILS || {}).bigRootDrainOnlyRestored || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const boardEq = rows => rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

let bad = 0, ran = 0;
const seen = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   item=' + (c.item || '(none)'));
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  console.log('    showdown  ' + clean.sd.join('  ->  '));
  console.log('    medicham  ' + clean.me.join('  ->  '));
  console.log('    medicham  ' + brk.me.join('  ->  ') + '   [knob]');
  console.log('    board     ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards));
  if (!boardEq(clean.boards)) for (const b of clean.boards) if (!b.identical) console.log('      b' + b.t + ' diffs ' + JSON.stringify(b.diffs));
  console.log('    authority `-heal` lines on this arm : ' + clean.sdHeals);
  console.log('    counters  bigRootNonDrain ' + (clean.delta.bigRootAppliedNonDrain || 0)
    + '   |   knob ' + ((brk.delta || {}).bigRootAppliedNonDrain || 0)
    + '   |   MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored);
  console.log('    turns played  clean ' + clean.r.turns + '  knob ' + brk.r.turns
    + '  of ' + c.script.length);

  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out.'); bad++; continue; }
  /* THE ARM MUST CONTAIN A HEAL AT ALL. A body already at full HP heals nothing and every verdict
   * below would be about an empty turn. */
  if (!clean.sdHeals) {
    console.log('    >> FIXTURE FAILED — the authority healed nothing on this arm.'); bad++; continue; }
  if (!(clean.restored === 0 && brk.restored === 1)) {
    console.log('    >> KNOB DID NOT BIND — the stamp is not absent-clean/present-on-knob.');
    bad++; continue; }

  seen.set(c.id, { sd: clean.sd });

  const agree = eq(clean.sd, clean.me) && boardEq(clean.boards);
  if (!agree) { console.log('    >> DEFECT — the engines part on the heal lines or on the board.'); bad++; }
  else console.log('    >> the two engines agree on the heal lines AND the board.');

  const knobAgree = eq(clean.sd, brk.me) && boardEq(brk.boards);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob.'); bad++; }
  }
}

/* THE INSTRUMENT'S OWN CONTROL, READ OFF THE AUTHORITY ALONE: the item-less arm must produce
 * DIFFERENT SHOWDOWN LINES from the Big Root arm it clears. Without it, every "the engines agree"
 * above could be a board on which the item could not have mattered. */
for (const c of CASES) {
  if (!c.differsFrom) continue;
  const a = seen.get(c.id), b = seen.get(c.differsFrom);
  if (!a || !b) continue;
  const moved = !eq(a.sd, b.sd);
  console.log(NL + '  INSTRUMENT CONTROL — showdown plays `' + c.id + '` differently from `'
    + c.differsFrom + '`: ' + (moved ? 'YES' : 'NO'));
  if (!moved) { console.log('    >> BIG ROOT IS INERT IN THE AUTHORITY ON THIS BOARD — nothing here measures anything.'); bad++; }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
