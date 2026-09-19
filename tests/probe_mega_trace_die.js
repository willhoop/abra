/* probe_mega_trace_die.js — A MEGA THAT ARRIVES HOLDING TRACE, OPPOSITE A FOE THAT MEGAS THE SAME TURN. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mega_trace_die.js
 *   SHOWDOWN_PATH=... node tests/probe_mega_trace_die.js --seeds 24
 *   SHOWDOWN_PATH=... node tests/probe_mega_trace_die.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/game-differential.g1950.json` (release 482e8f5ca701) parted a board at turn 2 on
 * `p2.party.alakazam.ability medicham toughclaws showdown competitive`: a p2 Alakazam megas into its
 * Trace forme opposite a Charizard (whose Mega X carries Tough Claws) and a Milotic (Competitive), and
 * the two engines copied different foes. Trace's pick is `this.sample(possibleTargets)`
 * (data/abilities.ts:5110; no Champions row) — a DIE over the eligible foes — so a different pick is
 * one of three things, and they have different fixes:
 *
 *   LIST      the eligible foes differ (a membership or an order difference). The copy on the
 *             medicham side was Tough Claws, which a Charizard only has AFTER its own mega — so a
 *             mega-phase ORDER difference is a list difference in disguise.
 *   ADDRESS   the lists agree and the die was drawn from a different address / repeat counter.
 *   TIE       the two megas tie on speed, so the order is itself a die.
 *
 * ================= THE ARMS ====================================================================
 *
 * Every arm plays turn 1 only: everyone Protects, the Trace holder and (in two arms) the foe mega
 * evolve. It is read at the turn-1 boundary on BOTH engines — the holder's ability, and on the
 * medicham side the eligible list and index `traceCopy` actually used (`traceListSink`). Each arm is
 * played under the two pinned corners (the die as a knob) and under the MIDDLE arm across `--seeds`
 * seed tags (default 16), because the middle arm's die is an event-addressed hash and one seed is one
 * value of it.
 *
 *   foe-megas-slower   the foe's base forme is SLOWER than the Trace holder's: the holder megas first.
 *   foe-megas-faster   the foe's base forme is FASTER: the foe megas first and the holder sees its mega ability.
 *   foe-no-stone       the same slower foe with no stone: nothing else changes on the field.
 *
 * NO TYPED EXPECTATION. An arm passes when the two engines' copied ability agrees on every play.
 * The report prints the medicham list beside each disagreement so LIST and ADDRESS can be told apart.
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
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const NL = String.fromCharCode(10);
const SEEDS = Math.max(1, +(ARG('--seeds') || 16));
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_mega_trace_die.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const G = require(D('engine', 'game_differential.js'));
const M = G.REL.require('engine/medicham2-browser.js');

/* ---- THE FIXTURE, DERIVED FROM THE FORMAT ---------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legalS = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const legalI = x => x && x.exists && !x.isNonstandard;
const abOf = s => Object.values(s.abilities || {});
const AB = id => dex.abilities.get(id);
const traceable = a => { const x = AB(a); return !!(x && x.exists && !(x.flags && x.flags.notrace)); };
const QUIET = ['onStart', 'onSwitchIn', 'onUpdate', 'onModifySpe', 'onModifyPriority', 'onResidual', 'onTryHit',
  'onDamagingHit', 'onAnySwitchIn', 'onFoeTrapPokemon', 'onTryBoost', 'onAfterEachBoost', 'onChangeBoost'];
const quiet = a => { const x = AB(a); return !!(x && x.exists && QUIET.every(h => !x[h])); };
const LS = dex.data.Learnsets;
const learns = (s, mv) => {
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[mv]);
};
const MEGAS = [];
for (const it of dex.items.all().filter(legalI).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!it.megaStone || typeof it.megaStone !== 'object') continue;
  for (const baseName of Object.keys(it.megaStone)) {
    const m = dex.species.get(it.megaStone[baseName]), b = dex.species.get(baseName);
    if (!legalS(m) || !legalS(b) || !learns(b, 'protect')) continue;
    MEGAS.push({ stone: it, base: b, mega: m, ab: abOf(m)[0] });
  }
}
const TRACER = MEGAS.find(x => norm(x.ab) === 'trace');
/* a foe mega whose ability is traceable, quiet on entry, and not its base forme's ability — so WHEN it
 * megas relative to the tracer is visible in what the tracer copies */
const foeMega = cmp => MEGAS.filter(x => x !== TRACER && traceable(x.ab) && quiet(x.ab)
  && !abOf(x.base).map(norm).includes(norm(x.ab)) && abOf(x.base).some(a => traceable(a) && quiet(a))
  && cmp(x.base.baseStats.spe, TRACER.base.baseStats.spe))
  .sort((a, b) => a.base.name.localeCompare(b.base.name))[0];
const SLOWFOE = TRACER && foeMega((f, t) => f <= t - 10);
const FASTFOE = TRACER && foeMega((f, t) => f >= t + 10);
const SPECIES = dex.species.all().filter(s => legalS(s) && !/-Mega/.test(s.name) && learns(s, 'protect'))
  .sort((a, b) => a.name.localeCompare(b.name));
const used = new Set([TRACER && TRACER.base.id, SLOWFOE && SLOWFOE.base.id, FASTFOE && FASTFOE.base.id]);
const QUIETS = SPECIES.filter(s => !used.has(s.id) && abOf(s).some(a => traceable(a) && quiet(a)));
if (!TRACER || !SLOWFOE || !FASTFOE || QUIETS.length < 5) {
  console.log('NOT RUN — the format no longer supplies this fixture. That is a finding, not a pass.');
  process.exit(2);
}
const qAb = s => abOf(s).find(a => traceable(a) && quiet(a));
const row = (s, item, ab) => ({ species: s.name, item: item || '', ability: ab || qAb(s), moves: ['Protect'] });
const PARTNER = QUIETS[0];
const TRACE_SIDE = [row(TRACER.base, TRACER.stone.name, abOf(TRACER.base)[0]), row(QUIETS[1]), row(QUIETS[2]), row(QUIETS[3])];
const foeSide = (f, stone) => [row(f.base, stone ? f.stone.name : '', qAb(f.base)), row(PARTNER), row(QUIETS[4]), row(QUIETS[5] || QUIETS[1])];
console.log(NL + '  DERIVED FROM THE FORMAT, NOT TYPED:');
console.log('    trace mega   ' + TRACER.base.name + ' + ' + TRACER.stone.name + ' -> ' + TRACER.mega.name + ' (base spe ' + TRACER.base.baseStats.spe + ')');
console.log('    slower foe   ' + SLOWFOE.base.name + ' / ' + qAb(SLOWFOE.base) + ' + ' + SLOWFOE.stone.name + ' -> ' + SLOWFOE.ab + ' (base spe ' + SLOWFOE.base.baseStats.spe + ')');
console.log('    faster foe   ' + FASTFOE.base.name + ' / ' + qAb(FASTFOE.base) + ' + ' + FASTFOE.stone.name + ' -> ' + FASTFOE.ab + ' (base spe ' + FASTFOE.base.baseStats.spe + ')');
console.log('    foe partner  ' + PARTNER.name + ' / ' + qAb(PARTNER));

const PR = { m: 'protect' };
const ARMS = [
  { id: 'foe-megas-slower', foe: SLOWFOE, stone: true },
  { id: 'foe-megas-faster', foe: FASTFOE, stone: true },
  { id: 'foe-no-stone', foe: SLOWFOE, stone: false },
  /* the card's own timing: the foe is ALREADY mega on turn 1, the Trace holder megas on TURN 2 */
  { id: 'turn2-foe-already-mega', foe: SLOWFOE, stone: true, late: true },
  { id: 'turn2-fast-foe-already-mega', foe: FASTFOE, stone: true, late: true },
];
let bad = 0, plays = 0;
for (const a of ARMS) {
  console.log(NL + '--- ' + a.id);
  const script = a.late
    ? [{ p1: [{ m: 'protect', mega: true }, PR], p2: [PR, PR] },
       { p1: [{ m: 'protect' }, PR], p2: [{ m: 'protect', mega: true }, PR] }]
    : [{ p1: [{ m: 'protect', mega: a.stone }, PR], p2: [{ m: 'protect', mega: true }, PR] }];
  const runs = [['bottom-tie-first', 0], ['top-tie-first', 0]].concat(Array.from({ length: SEEDS }, (_, k) => ['middle', k]));
  const tally = { agree: 0, differ: 0 };
  for (const [pin, k] of runs) {
    const arm = G.ARM_BY_ID.get(pin);
    const pa = G.buildPair(foeSide(a.foe, a.stone)), pb = G.buildPair(TRACE_SIDE);
    if (!pa || !pb) { console.log('    NOT-STAGED'); bad++; break; }
    const lists = [];
    const prev = M.traceListSink ? M.traceListSink(x => lists.push(x)) : null;
    let med = null, sd = null, sdFoe = null, medFoe = null;
    let r;
    try {
      r = G.playGame(pa, pb, 'directed', 'probe_mega_trace_die :: ' + a.id + ' :: ' + pin + ' :: s' + k, { script, arm,
        onBoundary: (snap, t, S, battle) => {
          med = norm(S.actB[0] && S.actB[0].ability);
          sd = norm(battle.p2.active[0] && battle.p2.active[0].ability);
          medFoe = norm(S.actA[0] && S.actA[0].ability);
          sdFoe = norm(battle.p1.active[0] && battle.p1.active[0].ability);
        } });
    } finally { if (M.traceListSink) M.traceListSink(prev); }
    if (r.err) { console.log('    THREW ' + pin + ' s' + k + '  ' + r.err); bad++; continue; }
    plays++;
    const sdLine = (G.lastSdLog() || []).map(String).filter(l => /^\|-ability\|/.test(l) && /\[from\] ability: Trace/i.test(l));
    const sdMega = (G.lastSdLog() || []).map(String).filter(l => /^\|-mega\|/.test(l)).map(l => l.split('|')[2].slice(0, 3)).join('>');
    const medMega = (r.mediTrace || []).map(l => Array.isArray(l) ? '|' + l.join('|') : String(l)).filter(l => /^\|-mega\|/.test(l)).map(l => l.split('|')[2].slice(0, 3)).join('>');
    const L = lists.filter(x => x.holder && norm(x.holder.name || x.holder.sp || '').includes(norm(TRACER.base.name)));
    const desc = L.map(x => '[' + x.eligible.map(t => norm(t.ability)).join(',') + ']#' + x.index).join(' ');
    if (med === sd) tally.agree++; else tally.differ++;
    if (med !== sd || pin !== 'middle') console.log('    ' + (med === sd ? 'agree ' : 'DIFFER') + '  ' + pin.padEnd(17) + ' s' + String(k).padEnd(3)
      + ' medicham ' + med + ' / showdown ' + sd + '   foe ' + medFoe + '/' + sdFoe + '   medicham list ' + desc
      + '   mega order med ' + medMega + ' sd ' + sdMega + '   sd trace line ' + (sdLine[0] || 'none'));
  }
  console.log('    middle arm over ' + SEEDS + ' seeds + 2 corners: agree ' + tally.agree + ', differ ' + tally.differ);
  if (tally.differ) bad++;
}
console.log(NL + (bad ? 'FAIL — ' + bad + ' arm(s) with a disagreement' : 'PASS') + ' over ' + plays + ' plays');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
