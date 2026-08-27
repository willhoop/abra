/* probe_mega_spread_stat.js — A MEGA'S STAT LINE IS RECOMPUTED FROM THE SET, NOT CARRIED AS A DELTA.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mega_spread_stat.js
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * The 2026-08-27 pinned differential (release `6afa148cbeb1`, 961 games, middle arm) has ten games
 * whose BOARD parts. One of them is two HP:
 *
 *     pair-protect-bust  seed ...-2660356793 vs ...-2660492912   turn 6
 *       |-damage|p2a: Scovillain|62/140      (showdown)
 *       |-damage|p2a: Scovillain|64/140      (medicham2)
 *
 * Replayed in full: a Golurk that MEGA EVOLVED on turn 1 lands a Phantom Force through a broken
 * Protect on a Scovillain that Moody had put to +2 Defence. Nothing residual removed the HP — the
 * two engines dealt 78 and 76 with the same shared damage roll, because they disagree about the
 * MEGA'S ATTACK by ONE POINT and the ×1.5 STAB doubles the gap.
 *
 * ================= THE ARITHMETIC, BOTH SIDES, CITED =============================================
 *
 * THE AUTHORITY recomputes the whole line from the SET the instant the forme changes:
 *
 *     setSpecies()  const stats = this.battle.spreadModify(this.species.baseStats, this.set);
 *                   ... this.storedStats[statName] = stats[statName];      sim/pokemon.ts:1393,1404
 *     formeChange() if (!this.setSpecies(species, effect, true)) return false;   sim/pokemon.ts:1295
 *
 * and `spreadModify` spends Champions' own `statModify`, whose else-branch (Reg M-B carries
 * `adjustlevel`, not `levelclausemod`) is
 *
 *     if (statName === 'hp') return stat + evs + 75;
 *     stat = stat + evs + 20;
 *     ...
 *     if (nature.plus  === statName) stat = tr(tr(stat * 110, 16) / 100);
 *     else if (nature.minus === statName) stat = tr(tr(stat * 90, 16) / 100);
 *                                                        data/mods/champions/scripts.ts:10-38
 *
 * So the authority's Golurk-Mega Attack is ONE truncation of ONE sum:
 *     tr(tr((159 + 32 + 20) * 110, 16) / 100) = tr(211 * 1.1) = 232
 *
 * MEDICHAM2 does not recompute. `megaEvolveNow` (engine/medicham2-browser.js) carries the investment
 * across as an ADDITIVE DELTA between two anchors:
 *
 *     const b = l50(baseRow.bs, null, m._nature), g = l50(megRow.bs, null, m._nature);
 *     const st = { at: g.at + (m.st.at - b.at), ... };
 *
 *     tr(179 * 1.1) + ( tr(176 * 1.1) - tr(144 * 1.1) ) = 196 + (193 - 158) = 231
 *
 * THE DELTA IS ALGEBRAICALLY EXACT AND ARITHMETICALLY IS NOT, which is why it survived every check
 * this repo owns. Without truncation the two expressions are identical — `1.1(Bm+20) + 1.1(Bb+S+20)
 * − 1.1(Bb+20) = 1.1(Bm+S+20)` — so the error is purely the three separate `tr()`s: 196.9, 193.6 and
 * 158.4 each lose their fraction, and the sum of what they lose does not cancel. The exact answer is
 * 232.1 and the delta lands on 231.
 *
 * IT IS EXACT WHENEVER THE NATURE IS NEUTRAL, which is why nothing saw it for fifteen days:
 * `game_differential.js` built every body `Serious` until 2026-08-12, and under a neutral nature
 * `natureStat` is the identity and the delta composes perfectly. `freshBodies`' own comment still
 * says the swap "come[s] out at a delta of exactly zero and land[s] on Showdown's recomputed
 * numbers" — true then, false since the sheet's nature and the SP spread arrived together.
 *
 * `tests/test-nature-differential.js` PART 4 asks EXACTLY this question and is green, because it
 * stages ONE stone — chosen for a SPEED trap — and that one body's deltas happen to compose. One
 * witness is not a sweep, and this file is the sweep.
 *
 * ================= WHAT THIS FILE ASSERTS ========================================================
 *
 * It drives the REAL `megaEvolveNow` through `battleInit` + `battleTurn` — never a second copy of the
 * swap — for every mega stone in the format whose base forme `data/engine-data.js` carries, at every
 * lead slot the spread ladder reaches, and compares the resulting line against the authority's
 * `statModify` over the SAME declared set.
 *
 * THE CONTROL IS THE NATURE AND IT CAN FAIL. The same sweep is run under `Serious`, where the delta
 * is exact by construction. If the neutral arm is not clean, the probe is measuring something other
 * than the nature/truncation seam and says so instead of claiming a finding. If the DECLARED arm is
 * clean while the neutral arm is too, the probe reports that it staged no case that could bite —
 * which is a failure, not a pass.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

/* The live-release preload, for the same reason probe_recoil_after_clamp.js takes it: the driver cuts
 * a release into the real store at require time, and a probe about freshly-written bytes must read
 * the working tree rather than a snapshot. */
require(D('tests', '_live_release.js'));

const G = require(D('engine', 'game_differential.js'));
const M = G.REL.require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex, Battle } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));
const id = N.id;
const { mcKey } = require(D('engine', 'mc_key.js'));
const MAY = { mayMiss: 'the format defines species data/engine-data.js has no row for; counted and skipped' };

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

/* ---- THE AUTHORITY -------------------------------------------------------------------------------
 * Showdown's own `statModify`, asked about the set this file actually builds. Not a third copy of the
 * formula: `spreadModify` calls exactly this, once per stat, and that is what `setSpecies` writes
 * into `storedStats` when a forme changes. */
const ORACLE = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
const SKEYS = ['hp', 'at', 'df', 'sa', 'sd', 'sp'];
const oracleSet = (bs, set) => ({
  hp: ORACLE.statModify(bs, set, 'hp'), at: ORACLE.statModify(bs, set, 'atk'),
  df: ORACLE.statModify(bs, set, 'def'), sa: ORACLE.statModify(bs, set, 'spa'),
  sd: ORACLE.statModify(bs, set, 'spd'), sp: ORACLE.statModify(bs, set, 'spe') });
const lineStr = l => SKEYS.map(k => k + ' ' + l[k]).join(' / ');
const lineEq = (a, b) => SKEYS.every(k => a[k] === b[k]);

/* ---- WHAT CAN BE STAGED, DERIVED AND PRINTED BEFORE IT IS USED ----------------------------------
 * docs/LESSONS.md: every derived set in this project over-matched on its first try. The membership is
 * printed, and a stone whose base forme the engine table has no row for is COUNTED, never dropped in
 * silence. */
const STONES = [];
const skipped = { noRow: 0, noMegaMap: 0, nonstandard: 0 };
for (const it of dex.items.all()) {
  if (!it || !it.exists || it.isNonstandard) { if (it && it.megaStone) skipped.nonstandard++; continue; }
  if (!it.megaStone) continue;
  const base = Object.keys(it.megaStone)[0];
  const megaName = base && it.megaStone[base];
  if (!base || !megaName) { skipped.noMegaMap++; continue; }
  const baseSp = dex.species.get(base), megaSp = dex.species.get(megaName);
  if (!baseSp || !baseSp.exists || !megaSp || !megaSp.exists) { skipped.noMegaMap++; continue; }
  const k = mcKey(baseSp.name, MAY), mk = mcKey(megaSp.name, MAY);
  if (!k || !mk) { skipped.noRow++; continue; }
  STONES.push({ stone: it.name, base: baseSp, mega: megaSp });
}
STONES.sort((a, b) => a.base.name.localeCompare(b.base.name));
console.log('\nWHAT IS STAGED');
note(STONES.length + ' mega stone(s) in the format whose base forme data/engine-data.js carries');
note('skipped: ' + skipped.noRow + ' with no engine-data row, ' + skipped.noMegaMap
     + ' whose megaStone map does not resolve, ' + skipped.nonstandard + ' non-standard');
if (!STONES.length) fail('no mega stone could be staged — this probe tested nothing');

/* THE FILLERS ARE DERIVED, NEVER TYPED (CLAUDE.md). Three legal species the engine table carries,
 * used only to fill the sheet so `buildPair` returns four bodies; nothing about them is asserted. */
const FILLERS = dex.species.all()
  .filter(s => s && s.exists && !s.isNonstandard && s.tier !== 'Illegal' && s.baseStats
               && !/mega/i.test(s.forme || '') && mcKey(s.name, MAY))
  .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3);
if (FILLERS.length < 3) fail('fewer than three filler bodies could be derived — the sheet cannot be built');
note('filler bodies (nothing is asserted about them): ' + FILLERS.map(s => s.name).join(', '));

/* THE MOVE EVERY BODY CLICKS, derived rather than typed: the one status move in the format that
 * targets self and needs no target slot, so a doubles choice is never rejected for want of one. */
const CLICK = (() => {
  const m = dex.moves.all().find(x => x && x.exists && !x.isNonstandard && x.id === 'protect');
  return m ? m.name : null;
})();
if (!CLICK) fail('the click move could not be resolved from the format');
note('every slot clicks: ' + CLICK);

/* ---- ONE STAGED MEGA -----------------------------------------------------------------------------
 * Returns { want, got, set } or a reason string. The stone-holder sits at `slot` so the SP ladder
 * gives it a different spread; only slots 0 and 1 lead, and only a lead can be told to evolve. */
function stage(row, slot, nature) {
  const sheet = [];
  for (let i = 0; i < 4; i++) {
    if (i === slot) {
      sheet.push({ species: row.base.name, item: row.stone,
                   ability: Object.values(row.base.abilities || {})[0] || '',
                   nature, moves: [CLICK] });
    } else {
      const f = FILLERS[(i + (i > slot ? -1 : 0)) % FILLERS.length];
      sheet.push({ species: f.name, item: '', ability: Object.values(f.abilities || {})[0] || '',
                   nature, moves: [CLICK] });
    }
  }
  const pair = G.buildPair(sheet);
  const foe = G.buildPair(sheet.map(x => Object.assign({}, x)));
  if (!pair || !foe) return 'buildPair returned null';
  const A = G.freshBodies(pair), B = G.freshBodies(foe);
  const trace = [];
  const S = M.battleInit(A, B, { trace, autoMega: false });
  const me = S.actA[slot];
  if (!me) return 'the stone-holder is not on the field at slot ' + slot;
  const set = pair[slot].sd;
  const before = oracleSet(row.base.baseStats, set);
  /* BEFORE THE MEGA THE TWO MUST ALREADY AGREE, or an "after" mismatch says nothing about the swap. */
  if (!lineEq(before, me.st)) return 'BEFORE the mega the engine and the authority already differ: '
                                    + lineStr(me.st) + ' vs ' + lineStr(before);
  const mk = (own, acts) => { const map = new Map();
    own.forEach((mon, i) => { if (!mon) return;
      const a = acts[i]; if (!a) { map.set(mon, { kind: 'pass' }); return; }
      const pa = M.playerAction(mon, a.move, null, S.field);
      if (a.mega && pa) pa.mega = true; map.set(mon, pa); });
    return map; };
  const acts = [{ move: 'protect' }, { move: 'protect' }];
  acts[slot] = { move: 'protect', mega: true };
  M.battleTurn(S, () => 0, mk(S.actA, acts), mk(S.actB, [{ move: 'protect' }, { move: 'protect' }]));
  if (!trace.some(l => /^\|-mega\|/.test(String(l)))) return 'medicham2 never megad';
  return { want: oracleSet(row.mega.baseStats, set), got: Object.assign({}, S.actA[slot].st), set };
}

/* ---- THE SWEEP, TWICE: THE DECLARED NATURE AND THE NEUTRAL CONTROL ------------------------------ */
function sweep(natureOf, label) {
  const bad = [], reasons = new Map();
  let checked = 0;
  for (const row of STONES) {
    for (const slot of [0, 1]) {
      const nature = natureOf(row);
      const r = stage(row, slot, nature);
      if (typeof r === 'string') { reasons.set(r, (reasons.get(r) || 0) + 1); continue; }
      checked++;
      if (!lineEq(r.want, r.got)) {
        bad.push({ who: row.base.name + ' @ ' + row.stone + '  ' + nature + '  slot ' + slot,
                   want: r.want, got: r.got, evs: r.set.evs,
                   off: SKEYS.filter(k => r.want[k] !== r.got[k])
                             .map(k => k + ' authority ' + r.want[k] + ' engine ' + r.got[k]).join(', ') });
      }
    }
  }
  console.log('\n' + label);
  for (const [why, n] of reasons) note('could not stage x' + n + ': ' + why);
  note(checked + ' (mega x lead slot) stat line(s) compared against the authority');
  for (const b of bad.slice(0, 12)) {
    note('  ' + b.who + '   evs ' + JSON.stringify(b.evs));
    note('    ' + b.off);
  }
  if (bad.length > 12) note('  ... and ' + (bad.length - 12) + ' more');
  return { checked, bad };
}

/* THE NATURE THAT BITES IS DERIVED PER STONE, not typed: the one whose PLUS stat has the largest
 * base-stat jump from base forme to mega, because that is where `tr(mul*(Bm+20))` and the delta are
 * furthest apart. A stone whose mega changes no stat cannot bite and is reported as such. */
const SD2ENG = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };
const NATS = dex.natures.all().filter(n => n.plus && n.minus);
const natureThatBites = (row) => {
  let best = null, bestGap = -1;
  for (const n of NATS) {
    const s = n.plus;
    const gap = (row.mega.baseStats[s] || 0) - (row.base.baseStats[s] || 0);
    if (gap > bestGap) { bestGap = gap; best = n.name; }
  }
  return best || 'Serious';
};

const declared = sweep(natureThatBites, 'ARM 1 — THE DECLARED NATURE (the arm the differential plays under)');
const control = sweep(() => 'Serious', 'ARM 2 — THE CONTROL: a NEUTRAL nature, where the delta is exact by construction');

console.log('\nVERDICT');
if (!control.checked) fail('the CONTROL staged nothing — the sweep proves nothing either way');
else if (control.bad.length)
  fail('the CONTROL is dirty: ' + control.bad.length + ' of ' + control.checked + ' neutral-nature '
     + 'lines differ. Under a neutral nature the delta composes exactly, so this probe is measuring '
     + 'something OTHER than the nature/truncation seam and its ARM 1 result must not be read as one');
else pass('the control is clean: ' + control.checked + ' neutral-nature lines all match the authority '
        + '— so this instrument CAN pass, and the nature is the knob');

if (control.bad.length === 0 && declared.bad.length === 0 && declared.checked)
  note('ARM 1 and the control are BOTH clean. If nothing here is expected to bite, that is itself the '
     + 'finding — check that a staged mega actually moves the stat its nature moves.');

if (declared.bad.length)
  fail(declared.bad.length + ' of ' + declared.checked + ' mega stat lines differ from the authority '
     + 'under the declared nature — a mega evolution is landing on a line Showdown does not compute');
else if (declared.checked) pass(declared.checked + ' mega stat lines under a declared nature all match the authority');

console.log('\n' + (failures ? 'RED — ' + failures + ' failure(s)' : 'GREEN'));
process.exit(failures ? 1 : 0);
