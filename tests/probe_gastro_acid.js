/* probe_gastro_acid.js — DOES GASTRO ACID SUPPRESS THE TARGET'S ABILITY IN BOTH ENGINES? 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_gastro_acid.js                   live tree, scratch release
 *   SHOWDOWN_PATH=... node tests/probe_gastro_acid.js --release <id>    a named release
 *   SHOWDOWN_PATH=... node tests/probe_gastro_acid.js --only rough-skin
 *
 * ================= WHY =========================================================================
 *
 * medicham2 wrote `_vol.gastroacid` and suppressed nothing: no reader of any ability asked about it, and
 * data/protocol-events.json declared `-endability` NOT EMITTED because "ability SUPPRESSION ... is not
 * modelled". Found while making Unburden a compared leaf (docs/_reports/2026-09-19-unburden-leaf.md §6).
 *
 * THE AUTHORITY, read at run time below and cited here:
 *   Pokemon#ignoringAbility   `if (this.volatiles['gastroacid']) return true;`        sim/pokemon.ts:870
 *                             after `if (this.getAbility().flags['cantsuppress']) return false;`   :869
 *   gastroacid.condition      onStart: `this.add('-endability', pokemon);`
 *                             `this.singleEvent('End', pokemon.getAbility(), ...)`    data/moves.ts:6448-6452
 *   clearVolatile             drops it on the way out                   data/mods/champions/scripts.ts:124
 * No key for gastroacid in data/mods/champions/ outside learnsets.
 *
 * ================= THE ARMS =====================================================================
 *
 *   unburden-end     Sneasler is knocked off (Unburden granted), then Gastro Acided: the ability's End
 *                    drops `unburden` and the doubling stops — `vol.unburden` and Speed.
 *   rough-skin       Garchomp is Gastro Acided, then struck by a contact Knock Off: no Rough Skin chip on
 *                    the attacker — the attacker's `hp`.
 *   switch-restores  (CONTROL) Garchomp is Gastro Acided, switches out and back, then is struck: Rough Skin
 *                    chips again — the suppression leaves with the volatile. The knob must NOT part it.
 *
 * CLEAN: zero board diffs on every boundary, the authority must actually hold `gastroacid` at some
 * boundary, and no Speed disagreement. KNOB `MEDI_GASTRO_SUPPRESSES_NOTHING=1` (the pre-fix engine): the
 * two red arms must part, the control must not.
 * EXIT 0 pass / 1 fail / 2 cannot answer.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) { REL_ID = ER.cut('tests/probe_gastro_acid.js — freeze the tree under test').id; process.argv.push('--release', REL_ID); }
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_GASTRO_SUPPRESSES_NOTHING';

let _cur = null, _G = null;
function harness(on) {
  const key = on ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (on) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE AUTHORITY, READ ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const SIM = require(process.env.SHOWDOWN_PATH + '/dist/sim');   /* `Pokemon` is not on CS.sim()'s object */
const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const V = new TeamValidator(CS.FORMAT);
const DX = V.dex;
const src = f => String(f || '').replace(/\s+/g, ' ');
const GA = DX.moves.get('gastroacid');
const read = {
  ignoringAbility_names_gastroacid: /volatiles\[["']gastroacid["']\]/.test(src(SIM.Pokemon.prototype.ignoringAbility)),
  onStart_writes_endability: /add\(\s*["']-endability["']/.test(src(GA.condition && GA.condition.onStart)),
  onStart_ends_the_ability: /singleEvent\(\s*["']End["']\s*,\s*pokemon\.getAbility\(\)/.test(src(GA.condition && GA.condition.onStart)),
  legal: !!(GA.exists && !GA.isNonstandard),
};
console.log(NL + 'tests/probe_gastro_acid.js   release ' + REL_ID);
for (const [k, v] of Object.entries(read)) console.log('    ' + k.padEnd(34) + JSON.stringify(v));
if (Object.values(read).some(v => !v)) { console.log('CANNOT ANSWER — the authority no longer has the shape this probe stages.'); process.exit(2); }
const legalSp = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learners = DX.species.all().filter(legalSp)
  .filter(s => !V.checkCanLearn(GA, s, V.allSources(s), { species: s.name, moves: ['gastroacid'] })).map(s => s.name);
console.log('    legal Gastro Acid learners (' + learners.length + '): ' + learners.join(', '));

function problems(m) {
  const sp = DX.species.get(m.species), out = [];
  if (!legalSp(sp)) { out.push(m.species + ' is not legal'); return out; }
  if (m.ability && !Object.values(sp.abilities).map(a => DX.abilities.get(a).id).includes(DX.abilities.get(m.ability).id)) out.push(sp.name + ' cannot have ' + m.ability);
  if (m.item && DX.items.get(m.item).isNonstandard) out.push(m.item + ' is not legal');
  for (const mv of m.moves) {
    const mm = DX.moves.get(mv);
    if (!mm.exists || mm.isNonstandard) { out.push(mv + ' is not legal'); continue; }
    if (V.checkCanLearn(mm, sp, V.allSources(sp), { species: sp.name, moves: [mv] })) out.push(sp.name + ' cannot learn ' + mm.name);
  }
  return out;
}
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability, moves });
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };
const ARBOK = mon('arbok', '', 'Shed Skin', ['Gastro Acid', 'Knock Off', 'Protect']);
const CLEF = mon('clefable', '', 'Magic Guard', ['Calm Mind', 'Protect']);
const FILL = [mon('milotic', '', 'Marvel Scale', ['Recover', 'Protect']), mon('toxapex', '', 'Limber', ['Recover', 'Protect'])];
const SNEAS = mon('sneasler', 'Leftovers', 'Unburden', ['Swords Dance', 'Protect']);
const CHOMP = mon('garchomp', '', 'Rough Skin', ['Swords Dance', 'Protect']);

const CASES = [
  { id: 'unburden-end', red: true, target: 'sneasler',
    p1: [ARBOK, CLEF, ...FILL], p2: [SNEAS, CHOMP, ...FILL],
    script: [T([{ m: 'knockoff', t: 0 }, { m: 'calmmind' }], [{ m: 'swordsdance' }, { m: 'swordsdance' }]),
             T([{ m: 'gastroacid', t: 0 }, { m: 'calmmind' }], [{ m: 'swordsdance' }, { m: 'swordsdance' }]),
             T([PROT, { m: 'calmmind' }], [{ m: 'swordsdance' }, { m: 'swordsdance' }])] },
  { id: 'rough-skin', red: true, target: 'garchomp',
    p1: [ARBOK, CLEF, ...FILL], p2: [SNEAS, CHOMP, ...FILL],
    script: [T([{ m: 'gastroacid', t: 1 }, { m: 'calmmind' }], [{ m: 'swordsdance' }, { m: 'swordsdance' }]),
             T([{ m: 'knockoff', t: 1 }, { m: 'calmmind' }], [{ m: 'swordsdance' }, { m: 'swordsdance' }])] },
  { id: 'switch-restores', red: false, target: 'garchomp',
    p1: [ARBOK, CLEF, ...FILL], p2: [SNEAS, CHOMP, ...FILL],
    script: [T([{ m: 'gastroacid', t: 1 }, { m: 'calmmind' }], [{ m: 'swordsdance' }, { m: 'swordsdance' }]),
             T([PROT, { m: 'calmmind' }], [{ m: 'swordsdance' }, { sw: 'milotic' }]),
             T([PROT, { m: 'calmmind' }], [{ m: 'swordsdance' }, { sw: 'garchomp' }]),
             T([{ m: 'knockoff', t: 1 }, { m: 'calmmind' }], [{ m: 'swordsdance' }, { m: 'swordsdance' }])] },
];
let illegal = 0;
for (const c of CASES) for (const m of c.p1.concat(c.p2)) for (const p of problems(m)) { console.log('  ILLEGAL FIXTURE [' + c.id + '] ' + p); illegal++; }
if (illegal) { console.log('CANNOT ANSWER — illegal fixture.'); process.exit(2); }
console.log('    fixture legality (TeamValidator): every entry in ' + CASES.length + ' arms is legal');

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function play(G, c) {
  G.resetScriptCounters();
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) return { notStaged: true };
  const reads = [], diffs = [];
  const r = G.playGame(a, b, 'directed', 'probe_gastro_acid :: ' + c.id + ' :: ' + _cur, { script: c.script,
    onBoundary: (snap, t, S, battle) => {
      const m = [...(S.actB || []), ...(S.benchB || [])].find(x => x && norm(x.name) === c.target);
      const p = battle.p2.pokemon.find(x => norm(x.species.id) === c.target);
      const ab = m ? norm(m._abParked != null ? m._abParked : m.ability) : '?';
      reads.push('b' + t + ' ga ' + (m && m._vol && m._vol.gastroacid ? 1 : 0) + '/' + (p && p.volatiles.gastroacid ? 1 : 0)
        + ' live-ab ' + (m ? norm(m.ability) || '-' : '?') + '/' + (p ? (p.ignoringAbility() ? '-' : norm(p.ability)) : '?')
        + ' ab ' + ab + '/' + (p ? norm(p.ability) : '?'));
      for (const d of snap.diffs) diffs.push({ t, path: d.path, medicham: d.medicham, showdown: d.showdown });
      snap.identical = true; snap.diffs = [];
    } });
  const sdHeld = (G.lastSdLog() || []).some(l => /\|-endability\|/.test(l));
  return { r, reads, diffs, sc: G.scriptCounters(), sdLines: (G.lastSdLog() || []).filter(l => /endability|Gastro Acid|Rough Skin/.test(l)),
           meLines: (r.mediTrace || []).map(x => Array.isArray(x) ? x.join('|') : String(x)).filter(l => /endability|gastro|roughskin|Rough Skin/i.test(l)),
           sdHeld, speedRows: (r.speedRows || []).filter(x => norm(x.body) === c.target) };
}

let bad = 0, ran = 0;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '  ---- ' + c.id + (c.red ? '   [red arm]' : '   [control]'));
  const clean = play(harness(false), c);
  if (clean.notStaged || clean.r.err) { console.log('    NOT-STAGED / THREW ' + ((clean.r && clean.r.err) || '')); bad++; continue; }
  ran++;
  console.log('    clean  [gastroacid me/sd, live ability me/sd, identity me/sd]   ' + clean.reads.join('   '));
  console.log('    authority lines: ' + clean.sdLines.join('  ||  '));
  console.log('    medicham  lines: ' + clean.meLines.join('  ||  '));
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — ' + clean.sc.firstMissing); bad++; continue; }
  if ((clean.r.turns || 0) < c.script.length) { console.log('    >> FIXTURE FAILED — the game ended at turn ' + clean.r.turns); bad++; continue; }
  if (!clean.sdHeld) { console.log('    >> FIXTURE FAILED — the authority never wrote `-endability`: Gastro Acid did not land.'); bad++; continue; }
  console.log('    clean  board diffs ' + clean.diffs.length + (clean.diffs.length ? '   first ' + JSON.stringify(clean.diffs[0]) : '')
    + '   speed rows on the target ' + clean.speedRows.length);
  if (clean.diffs.length || clean.speedRows.length) { console.log('    >> RED — the engines part with the fix in'); bad++; }
  const brk = play(harness(true), c);
  /* READ BEFORE THE RELOAD: `harness(false)` re-requires the engine, which replaces globalThis.MEDFAILS. */
  const stamp = ((globalThis.MEDFAILS || {}).gastroSuppressesNothingRestored) || 0;
  harness(false);
  if (brk.notStaged || brk.r.err) { console.log('    NOT-STAGED / THREW under the knob'); bad++; continue; }
  console.log('    knob   board diffs ' + brk.diffs.length + (brk.diffs.length ? '   first ' + JSON.stringify(brk.diffs[0]) : '')
    + '   speed rows ' + brk.speedRows.length + '   stamp ' + stamp);
  const parted = brk.diffs.length > 0 || brk.speedRows.length > 0;
  if (!stamp) { console.log('    >> THE KNOB DID NOT LOAD'); bad++; }
  else if (c.red && !parted) { console.log('    >> RED — the knob moved nothing: this arm cannot see the break'); bad++; }
  else if (!c.red && parted) { console.log('    >> the CONTROL parted under the knob — the knob is not isolated'); bad++; }
  else console.log('    OK');
}
console.log(NL + (ran ? (bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)') : 'NOT RUN'));
console.log('release ' + REL_ID);
process.exit(!ran ? 2 : (bad ? 1 : 0));
