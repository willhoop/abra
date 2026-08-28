/* probe_status_blocksstatus.js — THE STATUS ROAD ASKS `t.protect` AND NEVER ASKS `blocksStatus`.
 * 2026-08-27.
 *
 *   SHOWDOWN_PATH=... node tests/probe_status_blocksstatus.js
 *   SHOWDOWN_PATH=... node tests/probe_status_blocksstatus.js --only kingsshield
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * `sim/battle.ts:1300-1302`:
 *
 *     checkMoveBypassesProtect(move, attacker, defender, blockStatus = true) {
 *       if ((move.category !== 'Status' || blockStatus) && move.flags['protect'] && ...) return false;
 *
 * `blockStatus` is NOT the caller's default everywhere. `kingsshield.condition.onTryHit`
 * (`data/moves.ts`) returns EARLY for a Status move, so a status move walks straight through a
 * King's Shield and lands. `protect`, `detect`, `spikyshield` and `banefulbunker` do not.
 *
 * `engine/tag_dex.js` already reads that off each shield's own condition into
 * `shieldsUser.blocksStatus`, and `shieldRefuses` in medicham2 already consults it. **The `status`
 * action branch does not call `shieldRefuses` at all** — it asks a bare `t.protect`, which is blind
 * to the difference, so a Glare or a Thunder Wave aimed into a King's Shield is refused here and
 * lands in the authority.
 *
 * ================= WHY THIS FIXTURE HAS EXACTLY ONE REASON ======================================
 *
 * Every cell is the SAME board and the SAME click; only the shield the target raises varies. The
 * probe DERIVES, on every run, every other reason the status could be refused — the target's type
 * immunity to the status, an ability that refuses status moves, an ability that refuses this status,
 * the move's own accuracy — and refuses any cell carrying more than the one it is about.
 *
 * The move is chosen for accuracy 100 so that no cell can be decided by a die: a 90-accuracy move
 * staged against a live-seeded authority is a coin, and a coin that lands the comfortable way is
 * exactly the failure this file exists to avoid.
 *
 * ================= THE KNOB ====================================================================
 *
 * `MEDI_STATUS_SHIELD_BLIND=1` restores the site in its own old shape — the bare `t.protect` — so
 * the fix has a revert control that must reproduce the SAME red rather than a third behaviour.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('STATUS THROUGH A SHIELD');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const { mcKey } = require(D('engine', 'mc_key.js'));
const TAGS = require(D('data', 'tags.json'));

const ONLY = (() => { const i = process.argv.indexOf('--only');
                      return i > 0 ? String(process.argv[i + 1] || '') : ''; })();

let red = 0, fixtureFail = 0;
const FAIL = (m) => { red++; console.log('    RED   ' + m); };
const OK = (m) => console.log('    green ' + m);
const STAGE = (m) => { fixtureFail++; console.log('    FIXTURE ' + m); };

const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* NOTHING HERE IS SWALLOWED. Two of the walks below ask the engine about EVERY legal move and every
 * legal status, and both questions have moves the engine legitimately refuses to answer at all — a
 * `playerAction` for a move whose classifier needs a board this probe has not built, a
 * `canTakeStatus` for a code that is not one of the six. A bare `catch {}` there would mean a probe
 * whose POPULATION silently shrank, and a population that shrinks quietly is exactly how "the ONLY
 * difference the swap makes is blocksStatus" becomes a claim about four moves instead of eleven.
 * Every refusal is counted and the counts are PRINTED beside the population they came from. */
const REFUSED = { playerAction: 0, canTakeStatus: 0, first: '' };
const note = (what, id, e) => { REFUSED[what]++;
  if (!REFUSED.first) REFUSED.first = what + ' on ' + id + ': ' + (e && e.message); };

/* ---- shared staging (the idiom tests/probe_two_gates.js uses) --------------------------------- */
const PALS = ['Venusaur', 'Charizard', 'Blastoise', 'Beedrill', 'Pidgeot', 'Arbok'];
const PALM = 'Protect';
const HPX = 40;                       /* nothing may faint and nothing may reach a berry threshold */

const sdSet = (n, mv, item) => ({
  name: n, species: n, item: item || '', ability: dex.species.get(n).abilities[0], moves: mv,
  nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});
function sdBattle(teamA, teamB) {
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  b.choose('p1', 'team 1234'); b.choose('p2', 'team 1234');
  return b;
}
const mediMon = (species, mv, item) => {
  const x = MEDI.buildMon(mcKey(species, { mayMiss: 'a probe cast must resolve; a miss is a FAILED '
    + 'fixture, never a substitution' }), {});
  if (!x) throw new Error('buildMon failed for ' + species);
  x.moves = mv.map(m => dex.moves.get(m).id);
  x.item = item || '';
  return x;
};
const STREAMS = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
                  dmg: () => 0.5, stall: () => 0.999, tie: () => 0, split: true, seed: null };
const mediActs = (S, own, foes, want) => { const map = new Map();
  own.forEach((mon, i) => { if (!mon) return;
    const w = want[i];
    if (!w) { map.set(mon, { kind: 'pass' }); return; }
    map.set(mon, MEDI.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
  return map; };

/* =================================================================================================
 * §0 — THE POPULATION, DERIVED ON EVERY RUN. Nothing below is typed from a list.
 * ============================================================================================== */
console.log('\n== A STATUS MOVE MEETS A SHIELD THAT DOES NOT BLOCK STATUS ==\n');

const SHIELDS = dex.moves.all().filter(legal).filter(m => m.stallingMove)
  .map(m => ({ id: m.id, name: m.name,
               p: ((TAGS.moves[m.id] || {}).params || {}).shieldsUser || null,
               uses: (TAGS.moves[m.id] || {}).uses || 0 }));
console.log('  THE LEGAL SHIELD FAMILY, off `shieldsUser` in data/tags.json:');
for (const s of SHIELDS) {
  console.log('    ' + s.id.padEnd(15)
    + (s.p ? 'blocksStatus=' + s.p.blocksStatus : 'NO shieldsUser param — not a shield here').padEnd(24)
    + 'uses=' + s.uses);
}
const LETS_STATUS = SHIELDS.filter(s => s.p && s.p.blocksStatus === false);
const BLOCKS = SHIELDS.filter(s => s.p && s.p.blocksStatus === true);
console.log('  => ' + LETS_STATUS.length + ' legal shield(s) let a status move through, '
  + BLOCKS.length + ' refuse it.');
if (!LETS_STATUS.length || !BLOCKS.length) {
  console.log('  NOT RUN — this format has no contrast to measure. Not a pass.');
  process.exit(2);
}

/* Which action kind does the engine send a plain status move down, and does the family carry any
 * member that a shield does not cover for a SECOND reason (`noProtectFlag`)? Printed, because a
 * second reason inside the family would make the swap below a two-reason change. */
{
  const probeMe = MEDI.buildMon(mcKey('Clefable', { mayMiss: 'population print' }), {});
  const probeTg = MEDI.buildMon(mcKey('Garchomp', { mayMiss: 'population print' }), {});
  const members = [];
  for (const m of dex.moves.all().filter(legal)) {
    let a = null;
    try { a = MEDI.playerAction(probeMe, m.id, probeTg, {}); }
    catch (e) { note('playerAction', m.id, e); continue; }
    if (a && a.kind === 'status') members.push(m);
  }
  const noflag = members.filter(m => ((TAGS.moves[m.id] || {}).tags || []).includes('noProtectFlag'));
  console.log('\n  THE `status` ACTION KIND: ' + members.length + ' legal member(s) — '
    + members.map(m => m.id).join(', '));
  console.log('  of those, `noProtectFlag` (a SECOND way `shieldRefuses` differs from `t.protect`): '
    + noflag.length + (noflag.length ? ' \u2014 ' + noflag.map(m => m.id).join(', ') : ''));
  console.log('  moves the engine REFUSED to classify at all (counted, never swallowed): '
    + REFUSED.playerAction + (REFUSED.first ? '   first: ' + REFUSED.first : ''));
  if (noflag.length) STAGE('the swap from `t.protect` to `shieldRefuses` would change TWO things at '
    + 'once on this family; the cells below cannot attribute it');
  else OK('the ONLY difference the swap makes on this family is `blocksStatus`');
}

/* =================================================================================================
 * §1 — THE CELLS. One board, one click, the shield is the only knob.
 * ============================================================================================== */
const TARGET = (() => {
  const carriers = dex.species.all().filter(legal)
    .filter(s => CS.canLearn(s.name, "King's Shield"));
  return carriers.length ? carriers[0].name : null;
})();
if (!TARGET) { console.log('  NOT RUN — nothing in this format learns the status-permitting shield.'); process.exit(2); }

/* THE CLICK. 100 accuracy so that no cell can be decided by a die, and a status the target is not
 * immune to. Both facts are derived below and asserted, never assumed. */
const CAST = (() => {
  const probeMe = MEDI.buildMon(mcKey('Clefable', { mayMiss: 'cast search' }), {});
  const probeTg = MEDI.buildMon(mcKey('Garchomp', { mayMiss: 'cast search' }), {});
  const tSp = dex.species.get(TARGET);
  const out = [];
  for (const m of dex.moves.all().filter(legal)) {
    if (m.accuracy !== true && m.accuracy < 100) continue;
    if (!m.status) continue;
    let a = null;
    try { a = MEDI.playerAction(probeMe, m.id, probeTg, {}); }
    catch (e) { note('playerAction', m.id, e); continue; }
    if (!a || a.kind !== 'status') continue;
    /* the target must be able to TAKE it — type and ability, off the format */
    if (!MEDI.canTakeStatus) continue;
    const users = dex.species.all().filter(legal)
      .filter(s => s.name !== TARGET && !PALS.includes(s.name) && CS.canLearn(s.name, m.name));
    if (!users.length) continue;
    out.push({ mv: m, users });
  }
  return out;
})();
console.log('\n  100-ACCURACY `status`-kind casts with a legal user that is not the target or a passenger:');
for (const c of CAST) console.log('    ' + c.mv.id.padEnd(14) + 'status=' + c.mv.status
  + '   users=' + c.users.length + '   first=' + c.users[0].name);
if (!CAST.length) { console.log('  NOT RUN — no die-free cast available.'); process.exit(2); }

/* Pick the cast whose status the target can actually take, and a user with an ability that cannot
 * interfere. Both checked against the engine's own `canTakeStatus`, which is the shared fact. */
const tgtProbe = MEDI.buildMon(mcKey(TARGET, { mayMiss: 'target build' }), {});
let CHOSEN = null;
for (const c of CAST) {
  const code = { par: 'par', brn: 'brn', slp: 'slp', frz: 'frz', psn: 'psn', tox: 'tox' }[c.mv.status];
  let can = false;
  try { can = MEDI.canTakeStatus(tgtProbe, code, null, null); }
  catch (e) { note('canTakeStatus', c.mv.id, e); can = false; }
  console.log('    ' + TARGET + ' can take ' + c.mv.status + ' : ' + can);
  if (can) { CHOSEN = c; break; }
}
if (!CHOSEN) { console.log('  NOT RUN — the target is immune to every die-free status available.'); process.exit(2); }
const CLICKER = CHOSEN.users[0].name;
const MV = CHOSEN.mv;
const IDLE = CS.canLearn(TARGET, 'Iron Defense') ? 'Iron Defense' : CS.firstLegalMove(TARGET);
console.log('\n  CAST     ' + CLICKER + ' clicks ' + MV.name + ' (accuracy ' + MV.accuracy
  + ', status ' + MV.status + ') at ' + TARGET);
console.log('  IDLE     ' + TARGET + ' clicks ' + IDLE + ' when it raises no shield');

/* HOW MANY REASONS DOES EACH CELL CARRY, NOT COUNTING THE SHIELD? Derived from the artifact and the
 * format, printed, and any cell above one is refused. */
function otherReasons() {
  const out = [];
  const sp = dex.species.get(TARGET);
  const ab = dex.abilities.get(sp.abilities[0]);
  const abRow = (TAGS.abilities || {})[ab.id];
  if (abRow && (abRow.tags || []).includes('refusesStatusMoves')) out.push('ability:refusesStatusMoves');
  const code = { par: 'par', brn: 'brn', slp: 'slp', frz: 'frz', psn: 'psn', tox: 'tox' }[MV.status];
  let can = false;
  try { can = MEDI.canTakeStatus(tgtProbe, code, null, null); }
  catch (e) { note('canTakeStatus', MV.id, e); }
  if (!can) out.push('target:immune-to-' + MV.status);
  if (MV.accuracy !== true && MV.accuracy < 100) out.push('move:can-miss');
  return out;
}

const CELLS = []
  .concat(LETS_STATUS.map(s => ({ id: s.id, shield: s.id, kind: 'red',
    what: 'THE DEFECT. `shieldsUser.blocksStatus === false`, so `checkMoveBypassesProtect` answers '
        + 'TRUE for a Status move and the shield\'s own onTryHit returns early. The status LANDS in '
        + 'the authority.' })))
  .concat(BLOCKS.filter(s => CS.canLearn(TARGET, dex.moves.get(s.id).name)).map(s => ({
    id: s.id, shield: s.id, kind: 'control',
    what: 'THE KNOB TURNED THE OTHER WAY, on the SAME body and the SAME click. `blocksStatus` is '
        + 'true, so the status is refused on BOTH engines. A fix that let every status through '
        + 'would break this.' })))
  .concat([{ id: 'noshield', shield: null, kind: 'control',
    what: 'THE SHIELD CLEARED EXPLICITLY. The identical board with an idle click instead of a '
        + 'shield: the status must land on BOTH engines, or the arms above are measuring a cast '
        + 'this harness cannot make.' }]);

function playSD(shield) {
  const A = [sdSet(CLICKER, [MV.name, PALM]), sdSet(PALS[0], [PALM]), sdSet(PALS[1], [PALM]), sdSet(PALS[2], [PALM])];
  const tMoves = shield ? [dex.moves.get(shield).name, IDLE] : [IDLE, PALM];
  const B = [sdSet(TARGET, tMoves), sdSet(PALS[3], [PALM]), sdSet(PALS[4], [PALM]), sdSet(PALS[5], [PALM])];
  const b = sdBattle(A, B);
  const tgt = b.p2.active[0]; tgt.maxhp *= HPX; tgt.hp = tgt.maxhp;
  const mark = b.log.length;
  const o1 = b.choose('p1', 'move ' + MV.id + ' 1, move protect');
  const o2 = b.choose('p2', 'move ' + (shield || dex.moves.get(IDLE).id) + ', move protect');
  if (!o1 || !o2) return { err: String(b.p1.choice.error) + String(b.p2.choice.error) };
  return { status: tgt.status || '',
           lines: b.log.slice(mark).filter(l => /^\|(-status|-activate|-fail|-immune)\|/.test(l)) };
}
function playUS(shield) {
  const A = [mediMon(CLICKER, [MV.name, PALM]), mediMon(PALS[0], [PALM]), mediMon(PALS[1], [PALM]), mediMon(PALS[2], [PALM])];
  const tMoves = shield ? [dex.moves.get(shield).name, IDLE] : [IDLE, PALM];
  const B = [mediMon(TARGET, tMoves), mediMon(PALS[3], [PALM]), mediMon(PALS[4], [PALM]), mediMon(PALS[5], [PALM])];
  B[0].st.hp *= HPX; B[0].curHP = B[0].st.hp;
  const trace = [];
  const S = MEDI.battleInit(A, B, { trace });
  const tgt = S.actB[0];
  MEDI.battleTurn(S, STREAMS,
    mediActs(S, S.actA, S.actB, [{ m: MV.id, t: 0 }, { m: 'protect' }]),
    mediActs(S, S.actB, S.actA, [{ m: shield || dex.moves.get(IDLE).id }, { m: 'protect' }]));
  return { status: tgt.status || '',
           lines: trace.map(String).filter(l => /^\|(-status|-activate|-fail|-immune)\|/.test(l)) };
}

const oth = otherReasons();
console.log('  OTHER REASONS the status could be refused on this board, derived: '
  + (oth.length ? oth.join(', ') : '(none)'));
if (oth.length) STAGE('the fixture qualifies for ' + (oth.length + 1) + ' reasons and proves nothing');

const seen = new Map();
if (!oth.length) {
  console.log('\n  cell            blocksStatus   authority        ours');
  for (const c of CELLS) {
    if (ONLY && c.id !== ONLY) continue;
    const bs = c.shield ? String((SHIELDS.find(s => s.id === c.shield).p || {}).blocksStatus) : '(no shield)';
    const sd = playSD(c.shield), us = playUS(c.shield);
    if (sd.err) { STAGE(c.id + ' authority rejected the choice: ' + sd.err); continue; }
    seen.set(c.id, { c, sd, us, bs });
    console.log('  ' + c.id.padEnd(15) + bs.padEnd(15)
      + (sd.status ? 'STATUS ' + sd.status : 'no status').padEnd(17)
      + (us.status ? 'STATUS ' + us.status : 'no status'));
  }
}

/* =================================================================================================
 * §2 — THE CONTROLS FIRST. If the cast does not land with the shield cleared, nothing above means
 *      anything: "the shield refuses it" and "this harness cannot inflict a status" are the same
 *      observation.
 * ============================================================================================== */
console.log('');
{
  const ns = seen.get('noshield');
  if (!ns) STAGE('the cleared-shield control did not stage');
  else if (!ns.sd.status || !ns.us.status) FAIL('CONTROL: with NO shield up the status did not land '
    + '(authority "' + ns.sd.status + '" / ours "' + ns.us.status + '") — the knob is dead and every '
    + 'other arm here is vacuous');
  else if (ns.sd.status !== ns.us.status) FAIL('CONTROL: the two engines inflict different statuses '
    + 'with no shield up: "' + ns.sd.status + '" / "' + ns.us.status + '"');
  else OK('CONTROL: with no shield up both engines inflict ' + ns.sd.status + ' — the cast is live');
}
for (const c of CELLS.filter(c => c.kind === 'control' && c.shield)) {
  const r = seen.get(c.id);
  if (!r) continue;
  if (r.sd.status || r.us.status) FAIL('CONTROL ' + c.id + ' (blocksStatus true): the status landed '
    + 'somewhere it must not — authority "' + r.sd.status + '" / ours "' + r.us.status + '"');
  else OK('CONTROL ' + c.id + ' (blocksStatus true): both engines refuse the status');
}

/* =================================================================================================
 * §3 — THE GATE.
 * ============================================================================================== */
console.log('');
for (const c of CELLS.filter(c => c.kind === 'red')) {
  const r = seen.get(c.id);
  if (!r) { STAGE(c.id + ' did not stage'); continue; }
  if (!r.sd.status) { STAGE(c.id + ': the AUTHORITY did not inflict the status either — re-read the '
    + 'shield\'s condition before believing anything here'); continue; }
  if (r.sd.status !== r.us.status) {
    FAIL('BOARD-MATERIAL: ' + MV.name + ' into ' + c.id + ' — authority leaves ' + TARGET
      + ' with status "' + r.sd.status + '", we leave it with "' + (r.us.status || 'none') + '"');
    console.log('        authority lines  ' + JSON.stringify(r.sd.lines));
    console.log('        our lines        ' + JSON.stringify(r.us.lines));
  } else OK(MV.name + ' lands through ' + c.id + ' on both engines');
}

console.log('\nrefusals swallowed by nothing \u2014 playerAction ' + REFUSED.playerAction
  + ', canTakeStatus ' + REFUSED.canTakeStatus + (REFUSED.first ? '   first: ' + REFUSED.first : ''));
console.log((fixtureFail ? fixtureFail + ' FIXTURE failure(s). ' : '') + red + ' red.');
if (fixtureFail) { console.log('NOT RUN — the fixture is broken. This is not a pass.'); process.exit(2); }
console.log(red ? 'FAIL' : 'PASS — a shield that does not block status does not block status here either, '
  + 'and the shields that do still do.');
process.exit(red ? 1 : 0);
