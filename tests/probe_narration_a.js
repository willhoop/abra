#!/usr/bin/env node
/* tests/probe_narration_a.js — FOUR NARRATION MECHANISMS, EACH STAGED AS A CLASS IN BOTH ENGINES.
 *
 *   SHOWDOWN_PATH=... node tests/probe_narration_a.js --release <id>
 *   ... MEDI_ROOST_ANNOUNCE_FLYING_ONLY=1  (red)  Roost's `-singleturn` only when a Flying type was deleted
 *   ... MEDI_SPREAD_NOFOE_FAILS=1          (red)  an allAdjacent move with no foe left fails beside a partner
 *   ... MEDI_SYNC_IMMUNE_SILENT=1          (red)  a refused Synchronize reflection prints nothing
 *   ... MEDI_COACHING_NOALLY_SILENT=1      (red)  an adjacentAlly boost with no partner prints nothing
 *   ... MEDI_ITEMMOVE_NOTARGET_SILENT=1    (red)  a Corrosive Gas with nobody left prints nothing
 * ==================================================================================================
 *
 * 2026-09-19. The narration gate (the SECOND MEDICHAM gate, Will 2026-08-22) read 0 / 11 / 24 games on
 * release a1c7dcd5696b. The four largest undeclared buckets (docs/_reports/2026-09-19-a1c7-remeasure.md
 * §3, Forewarn excluded by Will) are each one missing or extra protocol line with no board effect.
 * Read off the authority, not recalled:
 *
 *   ROOST      data/moves.ts:15439-15447 — the `roost` condition's `onStart` writes
 *              `-singleturn|X|move: Roost` for every body (only Terastallization is checked); deleting
 *              Flying is a separate `onType`. Champions overrides neither.
 *   SPREAD     sim/pokemon.ts:808-817 — an `allAdjacent` list is `adjacentAllies()` then `adjacentFoes()`;
 *              sim/battle-actions.ts:509-513 writes `[notarget]` + `-fail` only when the list is EMPTY.
 *   SYNC       data/abilities.ts:4849-4858 passes `{ status, id: 'synchronize' }` as the sourceEffect, and
 *              sim/pokemon.ts:1704-1722 gates every refusal line on `(sourceEffect as Move)?.status`.
 *   COACHING   `adjacentAlly` (data/moves.ts:2590-2604); a fainted partner gives an empty target list
 *              (sim/pokemon.ts:844-846), so sim/battle-actions.ts:509-513 writes `[notarget]` + `-fail`.
 *
 * NOTHING HERE TYPES AN EXPECTED LINE. Both engines play the identical script under the middle arm;
 * SHOWDOWN IS THE EXPECTATION. Every game must agree on the protocol stream AND on the board at every
 * turn boundary. NON-VACUITY is asserted off the AUTHORITY's stream per class (the line in question
 * must actually appear), and each knob runs in a child: it must part its own class on PROTOCOL, part
 * nothing else, and leave EVERY board identical — a narration fix that moves a board is not narration.
 *
 * Every species, move and ability named or derived here is checked legal in the regulation before use.
 */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--release')
    && !require.cache[require.resolve(path.join(ROOT, 'tests', '_live_release.js'))]) {
  console.log('REFUSING TO RUN — pass --release <id>, or preload tests/_live_release.js with -r.');
  process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOBS = { MEDI_ROOST_ANNOUNCE_FLYING_ONLY: 'roost', MEDI_SPREAD_NOFOE_FAILS: 'spread',
                MEDI_SYNC_IMMUNE_SILENT: 'sync', MEDI_COACHING_NOALLY_SILENT: 'coach', MEDI_ITEMMOVE_NOTARGET_SILENT: 'spread' };
const ARMED = Object.keys(KNOBS).filter(k => process.env[k] === '1');
const CHILD = process.env.PROBE_NARA_CHILD === '1';
const K = +(process.env.PROBE_NARA_K || 3);

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (detail != null ? '   — ' + detail : ''));
  if (!cond) bad++;
  return cond;
};
console.log(NL + 'tests/probe_narration_a.js — Roost / spread-no-foe / Synchronize refusal / ally-boost no-ally'
  + (ARMED.length ? '   [KNOB ARMED: ' + ARMED.join(',') + ']' : ''));

const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const D = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const learns = (s, mv) => {
  let cur = s;
  for (let g = 0; cur && g < 6; g++) {
    const l = D.species.getLearnsetData(cur.id);
    /* A source from an older generation is not a Champions learn (Reuniclus reached Explosion through
     * Duosion's 5M-7M and the fixture check refused it), so only a `9…` source counts. */
    if (l && l.learnset && (l.learnset[mv] || []).some(src => String(src).startsWith('9'))) return true;
    cur = cur.prevo ? D.species.get(cur.prevo) : null;
  }
  return false;
};
const POOL = D.species.all().filter(s => legal(s) && !/mega/i.test(s.forme || '') && !s.battleOnly)
  .sort((a, b) => a.id.localeCompare(b.id));
const abIds = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a).id);
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
const tagsOf = id => (((TAGS.abilities || {})[id] || {}).tags) || [];
/* A QUIET ABILITY: every tag is a passive damage/stat modifier (the multi-hit probe's set, minus the two
 * that refuse a status or a volatile, because those are exactly what this probe stages on purpose). */
const PASSIVE = new Set(['breakable', 'damageBoost', 'typeImmunity', 'halvesTypeDamage', 'boostsMoveClass',
  'damageReduce', 'preventsCrit', 'weatherChipImmune', 'critRatioUp', 'stabBoost', 'speedCond']);
const quietAbOf = s => Object.values(s.abilities).map(a => D.abilities.get(a))
  .find(ab => legal(ab) && tagsOf(ab.id).every(t => PASSIVE.has(t)) && !['levitate'].includes(ab.id));
const IDLE = D.moves.all().filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && !m.selfSwitch
  && !m.selfdestruct && m.boosts && Object.values(m.boosts).every(v => v > 0) && !m.boosts.evasion && !m.boosts.accuracy
  && !m.heal && !m.flags.charge && !m.volatileStatus).sort((a, b) => a.id.localeCompare(b.id));
const idleOf = s => IDLE.find(m => learns(s, m.id)) || null;
const spe = s => s.baseStats.spe;
const mustLegal = (kind, id) => { const e = D[kind].get(id);
  if (!legal(e)) throw new Error('FIXTURE NAMES AN ENTITY OUTSIDE THE REGULATION: ' + kind + ' ' + id); return e.name; };
for (const m of ['roost', 'quickattack', 'memento', 'healingwish', 'toxic', 'willowisp', 'thunderwave', 'safeguard',
                 'sunnyday', 'protect']) mustLegal('moves', m);
const QUIET = POOL.map(s => ({ s, ab: quietAbOf(s) })).filter(x => x.ab);
/* THE PARTNER THAT LEAVES MID-TURN: the fastest legal Healing Wish learner, on an ability that is passive
 * or merely absorbs one type (no legal learner is fully quiet; printed below). */
const WISHER = POOL.filter(s => learns(s, 'healingwish')).map(s => ({ s, ab: Object.values(s.abilities).map(a => D.abilities.get(a))
  .find(ab => legal(ab) && tagsOf(ab.id).every(t => PASSIVE.has(t) || t === 'absorbMakesClickSure')) }))
  .filter(x => x.ab).sort((a, b) => spe(b.s) - spe(a.s))[0];
if (!WISHER) throw new Error('no legal Healing Wish learner on a passive ability — the partner-gone arms cannot be staged');
const mon = (s, ab, moves) => ({ species: s.name, item: '', ability: ab ? (ab.name || ab) : '',
  moves: [...new Set(moves.filter(Boolean))].map(m => D.moves.get(m).name) });
/* Fillers: quiet, not Flying and not Levitating (they never act; they come in only as replacements). */
const FILL = QUIET.filter(x => !x.s.types.includes('Flying') && learns(x.s, 'protect') && idleOf(x.s)).slice(0, 60);
const fillers = (avoid, n) => FILL.filter(f => !avoid.includes(f.s.id)).slice(0, n).map(f => mon(f.s, f.ab, ['protect']));

const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');
console.log('  release ' + G.REL.id + '   K = ' + K);

const results = [];
function play(group, tag, A, B, script) {
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const a = G.buildPair(A), b = G.buildPair(B);
  const parts = [];
  const r = (!a || !b) ? { err: 'buildPair returned null' } : G.playGame(a, b, 'directed', 'nara-' + tag,
    { script, arm: ARM, onBoundary: (snap, t) => { if ((snap.diffs || []).length) parts.push({ t, d: snap.diffs.slice(0, 3) });
                                                   snap.identical = true; snap.diffs = []; } });
  const SC = G.scriptCounters ? G.scriptCounters() : {};
  const sd = r.err ? [] : G.sdStream(G.lastSdLog()).map(String);
  const x = { group, tag, err: r.err || (SC.moveNotOnRequest ? 'scripted click not on the request: ' + SC.firstMissing : null),
              div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, parts, sd };
  results.push(x);
  return x;
}

/* ==== 1. ROOST: a non-Flying body, a dual Flying body, a pure Flying body (if the regulation has one),
 *      each hit first by a priority move so the heal lands; and the negative, a Roost at full HP. ===== */
{
  const roosters = QUIET.filter(x => learns(x.s, 'roost') && learns(x.s, 'protect') && !x.s.types.includes('Ghost'));
  const cast = [
    ['nonflying', roosters.find(x => !x.s.types.includes('Flying'))],
    ['dualflying', roosters.find(x => x.s.types.includes('Flying') && x.s.types.length === 2)],
    ['pureflying', roosters.find(x => x.s.types.length === 1 && x.s.types[0] === 'Flying')],
  ];
  const castIds = cast.filter(c => c[1]).map(c => c[1].s.id);
  const hitter = QUIET.find(x => learns(x.s, 'quickattack') && idleOf(x.s) && !castIds.includes(x.s.id));
  console.log(NL + '  === ROOST — cast derived this run ===');
  for (const [k, c] of cast) console.log('    ' + k.padEnd(11) + (c ? c.s.name + ' (' + c.s.types.join('/') + ') @' + c.ab.name : 'NONE in the regulation'));
  console.log('    hitter     ' + hitter.s.name + ' @' + hitter.ab.name + ' with Quick Attack (priority ' + D.moves.get('quickattack').priority + ')');
  ok(!!cast[0][1] && !!cast[1][1], 'a non-Flying and a Flying Roost user exist');
  for (const [k, c] of cast) {
    if (!c) continue;
    const used = castIds.concat([hitter.s.id]);
    const [ally, fb] = FILL.filter(f => !used.includes(f.s.id));
    const A = [mon(c.s, c.ab, ['roost', 'protect']), mon(ally.s, ally.ab, ['protect', idleOf(ally.s).id])]
      .concat(fillers(used.concat([ally.s.id, fb.s.id]), 2));
    const B = [mon(hitter.s, hitter.ab, ['quickattack', idleOf(hitter.s).id]), mon(fb.s, fb.ab, [idleOf(fb.s).id, 'protect'])]
      .concat(fillers(used.concat([ally.s.id, fb.s.id]), 4).slice(2));
    const idle = { p1: [{ m: 'protect' }, { m: idleOf(ally.s).id }], p2: [{ m: idleOf(hitter.s).id }, { m: idleOf(fb.s).id }] };
    for (let n = 0; n < K; n++) {
      play('roost', 'roost-' + k + '-' + n, A, B, Array.from({ length: n }, () => idle).concat([{ p1: [{ m: 'roost' }, { m: idleOf(ally.s).id }],
        p2: [{ m: 'quickattack', t: 0 }, { m: idleOf(fb.s).id }] }]));
    }
    /* THE NEGATIVE: Roost at full HP fails and announces nothing but the `-fail|heal`. */
    play('roost', 'roost-' + k + '-fullhp', A, B, [{ p1: [{ m: 'roost' }, { m: idleOf(ally.s).id }],
      p2: [{ m: idleOf(hitter.s).id }, { m: idleOf(fb.s).id }] }]);
  }
}

/* ==== 2. SPREAD WITH NO FOE LEFT: both foes Memento first (the two fastest legal Memento users), then
 *      a slower user fires every legal `allAdjacent` move with its partner standing. Negatives: an
 *      `allAdjacentFoes` move in the same spot, and the same `allAdjacent` move with the partner gone
 *      too (it Healing-Wished before the user moved). ============================================== */
{
  const ALLADJ = D.moves.all().filter(m => legal(m) && m.target === 'allAdjacent').sort((a, b) => a.id.localeCompare(b.id));
  const FOEADJ = D.moves.all().filter(m => legal(m) && m.target === 'allAdjacentFoes' && m.category !== 'Status')
    .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 3);
  const mementoers = QUIET.filter(x => learns(x.s, 'memento')).sort((a, b) => spe(b.s) - spe(a.s)).slice(0, 2);
  const wisher = WISHER;
  console.log(NL + '  === SPREAD, NO FOE LEFT — class derived this run: ' + ALLADJ.length + ' allAdjacent moves ===');
  console.log('    ' + ALLADJ.map(m => m.id).join(' '));
  console.log('    foes (Memento): ' + mementoers.map(x => x.s.name + ' spe ' + spe(x.s)).join(', ')
    + '   negatives: ' + FOEADJ.map(m => m.id).join(' ') + '   partner-gone via Healing Wish: ' + wisher.s.name + ' spe ' + spe(wisher.s));
  ok(mementoers.length === 2, 'two Memento users exist');
  const avoid0 = mementoers.map(x => x.s.id).concat([wisher.s.id]);
  const slowest = spe(mementoers[1].s);
  const B = [mon(mementoers[0].s, mementoers[0].ab, ['memento']), mon(mementoers[1].s, mementoers[1].ab, ['memento'])]
    .concat(fillers(avoid0, 2));
  const foeTurn = [{ m: 'memento', t: 0 }, { m: 'memento', t: 1 }];
  const users = [], unstaged = [];
  for (const mv of ALLADJ.concat(FOEADJ)) {
    /* THE USER LEARNS THE MOVE AND IS SLOWER THAN BOTH FOES, preferring a quiet ability; a learner with
     * any ability is taken only when no quiet one exists, and it is printed. */
    const learners = POOL.filter(s => !avoid0.includes(s.id) && learns(s, mv.id) && spe(s) < slowest)
      .sort((a, b) => spe(a) - spe(b));
    const q = learners.map(s => ({ s, ab: quietAbOf(s) })).find(x => x.ab);
    const u = q || (learners[0] && { s: learners[0], ab: D.abilities.get(learners[0].abilities[0]) });
    if (!u) { unstaged.push(mv.id); continue; }
    const al = FILL.find(x => !avoid0.includes(x.s.id) && x.s.id !== u.s.id);
    users.push(mv.id + ':' + u.s.name + '@' + u.ab.name + '+' + al.s.name);
    const A = [mon(u.s, u.ab, [mv.id]), mon(al.s, al.ab, [idleOf(al.s).id])].concat(fillers(avoid0.concat([u.s.id, al.s.id]), 2));
    play('spread', 'spread-' + mv.id + (mv.target === 'allAdjacentFoes' ? '-foesonly' : ''), A, B,
      [{ p1: [{ m: mv.id }, { m: idleOf(al.s).id }], p2: foeTurn }]);
    if (mv.target === 'allAdjacent' && spe(wisher.s) > spe(u.s)) {
      const A2 = [mon(u.s, u.ab, [mv.id]), mon(wisher.s, wisher.ab, ['healingwish'])]
        .concat(fillers(avoid0.concat([u.s.id]), 2));
      play('spread', 'spread-' + mv.id + '-partnergone', A2, B, [{ p1: [{ m: mv.id }, { m: 'healingwish' }], p2: foeTurn }]);
    }
  }
  console.log('    users: ' + users.join('  '));
  if (unstaged.length) console.log('    NO LEGAL LEARNER SLOWER THAN ' + slowest + ': ' + unstaged.join(' ') + '   (stated, not skipped silently)');
}

/* ==== 3. SYNCHRONIZE HANDS A STATUS BACK TO A SOURCE THAT REFUSES IT. The source is refused by TYPE, by
 *      ABILITY, by its side's SAFEGUARD, or by ALREADY holding a status (same and different); the
 *      positive control is a source that takes it. Every source LEARNS the move it inflicts with: a
 *      primary-status move first, else a 100% secondary. ============================================= */
{
  const PRIM = st => D.moves.all().filter(m => legal(m) && m.status === st && m.target === 'normal').sort((a, b) => a.id.localeCompare(b.id));
  const SEC = st => D.moves.all().filter(m => legal(m) && m.secondary && m.secondary.status === st && m.secondary.chance >= 100
    && m.target === 'normal').sort((a, b) => a.id.localeCompare(b.id));
  const inflict = (s, sts) => { for (const st of sts) { const m = PRIM(st).concat(SEC(st)).find(m => learns(s, m.id)); if (m) return { st, mv: m.id }; } return null; };
  const carriers = POOL.filter(s => abIds(s).includes('synchronize') && learns(s, 'protect') && idleOf(s));
  const holder = carriers.find(s => !['Poison', 'Steel', 'Fire', 'Electric', 'Ground', 'Grass'].some(t => s.types.includes(t)));
  /* THE HOLDER'S PARTNER: idle by default; for the two already-statused arms it must learn the move that
   * pre-statuses the source. Chosen per arm below. */
  const hAllyFor = pre => QUIET.find(q => q.s.id !== holder.id && idleOf(q.s) && learns(q.s, 'protect') && (!pre || learns(q.s, pre)));
  const hAlly = hAllyFor(null);
  console.log(NL + '  === SYNCHRONIZE — holder ' + holder.name + ' (' + holder.types.join('/') + ') ===');
  const STS = { tox: ['tox', 'psn'], psn: ['psn', 'tox'], brn: ['brn'], par: ['par'] };
  const IMM_TYPES = { tox: ['Poison', 'Steel'], brn: ['Fire'], par: ['Electric'] };
  const arms = [];
  const addArm = (why, s, ab, sts, extra) => {
    const f = inflict(s, sts);
    if (!f) { console.log('    arm ' + why.padEnd(38) + ' — ' + s.name + ' learns no ' + sts.join('/') + ' move; not staged'); return false; }
    arms.push(Object.assign({ why, s, ab, st: f.st, mv: f.mv }, extra || {}));
    return true;
  };
  for (const st of Object.keys(IMM_TYPES)) for (const ty of IMM_TYPES[st]) {
    const x = QUIET.find(q => q.s.types.includes(ty) && q.s.id !== holder.id && q.s.id !== hAlly.s.id && idleOf(q.s) && inflict(q.s, STS[st]));
    if (x) addArm('type ' + ty, x.s, x.ab, STS[st]); else console.log('    arm type ' + ty + ': no quiet legal source learns a ' + st + ' move');
  }
  for (const [ab, sts] of [['immunity', ['tox', 'psn']], ['limber', ['par']], ['waterbubble', ['brn']], ['purifyingsalt', ['tox', 'psn']],
                           ['purifyingsalt', ['brn']], ['purifyingsalt', ['par']]]) {
    const ok_ = POOL.filter(s => abIds(s).includes(ab) && s.id !== holder.id && idleOf(s)).some(s => addArm('ability ' + ab + ' ' + sts[0], s, D.abilities.get(ab), sts));
    if (!ok_) console.log('    arm ability ' + ab + ' ' + sts[0] + ': no legal carrier can be staged');
  }
  const aAllyFor = (move, avoid) => FILL.find(f => !avoid.includes(f.s.id) && (!move || learns(f.s, move)));
  const lg = POOL.filter(s => abIds(s).includes('leafguard') && idleOf(s)).find(s => inflict(s, ['tox', 'psn', 'par']));
  if (lg) addArm('ability leafguard in sun', lg, D.abilities.get('leafguard'), ['tox', 'psn', 'par'], { allyMove: 'sunnyday' });
  else console.log('    arm leafguard: no legal carrier learns a status move');
  const plain = QUIET.filter(x => !['Poison', 'Steel', 'Fire', 'Electric'].some(t => x.s.types.includes(t))
    && ![holder.id, hAlly.s.id].includes(x.s.id) && idleOf(x.s));
  const p0 = plain.find(x => inflict(x.s, ['tox'])), p1 = plain.find(x => inflict(x.s, ['brn']));
  if (!p0 || !p1) throw new Error('no quiet, non-immune legal source learns Toxic and a burn move — the refusal arms cannot be staged');
  addArm('Safeguard on the source side', p0.s, p0.ab, ['tox'], { allyMove: 'safeguard' });
  addArm('source already tox (same)', p0.s, p0.ab, ['tox'], { prestatus: 'toxic' });
  addArm('source already brn (different)', p0.s, p0.ab, ['tox'], { prestatus: 'willowisp' });
  addArm('CONTROL the source takes it', p1.s, p1.ab, ['brn']);
  for (const arm of arms) {
    const hAlly = QUIET.filter(q => q.s.id !== holder.id && q.s.id !== arm.s.id && idleOf(q.s) && learns(q.s, 'protect')
      && (!arm.prestatus || learns(q.s, arm.prestatus)))[0];
    if (!hAlly) { console.log('    arm ' + arm.why + ': no holder partner learns ' + arm.prestatus + '; not staged'); continue; }
    const avoid = [holder.id, arm.s.id, hAlly.s.id];
    const aAlly = aAllyFor(arm.allyMove, avoid);
    if (!aAlly) { console.log('    arm ' + arm.why + ': no partner learns ' + arm.allyMove + '; not staged'); continue; }
    const aIdle = idleOf(aAlly.s).id, sIdle = idleOf(arm.s).id, hIdle = idleOf(holder).id, haIdle = idleOf(hAlly.s).id;
    const A = [mon(arm.s, arm.ab, [arm.mv, sIdle]), mon(aAlly.s, aAlly.ab, [arm.allyMove, aIdle])]
      .concat(fillers(avoid.concat([aAlly.s.id]), 2));
    const B = [mon(holder, D.abilities.get('synchronize'), [hIdle, 'protect']), mon(hAlly.s, hAlly.ab, [arm.prestatus, haIdle])]
      .concat(fillers(avoid.concat([aAlly.s.id]), 4).slice(2));
    console.log('    arm ' + arm.st.padEnd(4) + arm.why.padEnd(34) + ' source ' + arm.s.name + ' @' + (arm.ab.name || arm.ab)
      + ' with ' + arm.mv + (arm.allyMove ? '   partner ' + aAlly.s.name + ' ' + arm.allyMove : ''));
    const idle = { p1: [{ m: sIdle }, { m: aIdle }], p2: [{ m: hIdle }, { m: haIdle }] };
    for (let n = 0; n < K; n++) {
      const script = Array.from({ length: n }, () => idle);
      /* SETUP TURN: the source's partner raises Safeguard or the sun; the holder's partner pre-statuses the source. */
      script.push({ p1: [{ m: sIdle }, { m: arm.allyMove || aIdle }],
                    p2: [{ m: hIdle }, arm.prestatus ? { m: arm.prestatus, t: 0 } : { m: haIdle }] });
      script.push({ p1: [{ m: arm.mv, t: 0 }, { m: aIdle }], p2: [{ m: hIdle }, { m: haIdle }] });
      play('sync', 'sync-' + arm.st + '-' + arm.why.replace(/[^a-z0-9]+/gi, '_') + '-' + n, A, B, script);
    }
  }
}

/* ==== 4. AN adjacentAlly MOVE WITH NO PARTNER STANDING: the partner Healing-Wishes first. Class derived:
 *      every legal `adjacentAlly` move. Control: the same click with the partner standing. ========== */
{
  const CLS = D.moves.all().filter(m => legal(m) && m.target === 'adjacentAlly').sort((a, b) => a.id.localeCompare(b.id));
  const wisher = WISHER;
  console.log(NL + '  === ALLY-AIMED, NO PARTNER — class derived this run: ' + CLS.map(m => m.id).join(' ') + ' ===');
  const foes = FILL.filter(f => f.s.id !== wisher.s.id).slice(10, 12);
  const B = foes.map(f => mon(f.s, f.ab, [idleOf(f.s).id])).concat(fillers([wisher.s.id].concat(foes.map(f => f.s.id)), 4).slice(2));
  const foeTurn = foes.map(f => ({ m: idleOf(f.s).id }));
  const wIdle = idleOf(wisher.s);
  for (const mv of CLS) {
    const learners = POOL.filter(s => s.id !== wisher.s.id && !foes.some(f => f.s.id === s.id) && learns(s, mv.id) && spe(s) < spe(wisher.s))
      .sort((a, b) => spe(a) - spe(b));
    const q = learners.map(s => ({ s, ab: quietAbOf(s) })).find(x => x.ab);
    const u = q || (learners[0] && { s: learners[0], ab: D.abilities.get(learners[0].abilities[0]) });
    if (!u) { console.log('    ' + mv.id.padEnd(13) + ' NO LEGAL LEARNER slower than ' + wisher.s.name + '; not staged'); continue; }
    const avoid = [u.s.id, wisher.s.id].concat(foes.map(f => f.s.id));
    const A = [mon(u.s, u.ab, [mv.id]), mon(wisher.s, wisher.ab, ['healingwish', wIdle && wIdle.id, 'protect'])].concat(fillers(avoid, 2));
    console.log('    ' + mv.id.padEnd(13) + ' user ' + u.s.name + ' @' + u.ab.name + ' spe ' + spe(u.s) + '   partner ' + wisher.s.name + ' spe ' + spe(wisher.s));
    play('coach', 'coach-' + mv.id + '-nopartner', A, B, [{ p1: [{ m: mv.id }, { m: 'healingwish' }], p2: foeTurn }]);
    play('coach', 'coach-' + mv.id + '-control', A, B, [{ p1: [{ m: mv.id }, { m: wIdle ? wIdle.id : 'protect' }], p2: foeTurn }]);
  }
}

/* ==== VERDICT ====================================================================================== */
const GROUPS = ['roost', 'spread', 'sync', 'coach'];
console.log(NL + '  === PER GAME (only games that parted are listed) ===');
for (const x of results) {
  if (!(x.err || x.div || x.parts.length)) continue;
  console.log('    PART ' + x.tag + (x.err ? '  ERR ' + x.err : '') + (x.div ? '  div sd=' + x.div.sd + ' | me=' + x.div.me : '')
    + (x.parts.length ? '  BOARD t' + x.parts[0].t + ' ' + x.parts[0].d.map(d => d.path + ' me ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)).join('; ') : ''));
}
console.log(NL + '  === THE VERDICT ===');
for (const g of GROUPS) {
  const xs = results.filter(x => x.group === g);
  const errs = xs.filter(x => x.err), divs = xs.filter(x => !x.err && x.div), boards = xs.filter(x => !x.err && x.parts.length);
  ok(xs.length > 0 && errs.length === 0, g + ': every staged game played its whole script', errs.length ? errs[0].tag + ': ' + errs[0].err : xs.length + ' games');
  ok(divs.length === 0, g + ': every game — the two protocol streams agree', divs.length ? divs.length + ' parted, first ' + divs[0].tag : null);
  ok(boards.length === 0, g + ': every game — the boards agree at every turn boundary', boards.length ? boards.length + ' parted, first ' + boards[0].tag : null);
}
/* NON-VACUITY, off the authority's own stream. */
const has = (g, re, tagRe) => results.filter(x => x.group === g && (!tagRe || tagRe.test(x.tag)) && x.sd.some(l => re.test(l))).length;
ok(has('roost', /^\|-singleturn\|p1a: .*\|move: Roost$/, /nonflying-\d/) > 0, 'NON-VACUOUS: the authority announced Roost on a body with no Flying type');
ok(has('roost', /^\|-singleturn\|p1a: .*\|move: Roost$/, /dualflying-\d/) > 0, 'NON-VACUOUS: the authority announced Roost on a Flying body');
ok(has('roost', /^\|-fail\|p1a: .*\|heal$/, /fullhp/) > 0, 'NON-VACUOUS: a full-HP Roost failed in the authority');
const allyOnly = results.filter(x => x.group === 'spread' && !/foesonly|partnergone/.test(x.tag)
  && x.sd.some(l => /^\|faint\|p2b/.test(l)) && x.sd.some(l => /^\|move\|p1a: [^|]*\|[^|]*\|p1b: /.test(l)) && !x.sd.some(l => /^\|-fail\|p1a/.test(l)));
ok(allyOnly.length > 0, 'NON-VACUOUS: the authority aimed an allAdjacent move at the partner alone, with no -fail', allyOnly.length + ' games');
ok(has('spread', /\[notarget\]/, /foesonly/) > 0, 'NON-VACUOUS: an allAdjacentFoes move with no foe wrote [notarget] in the authority');
ok(has('spread', /\[notarget\]/, /partnergone/) > 0, 'NON-VACUOUS: an allAdjacent move with nobody left wrote [notarget] in the authority');
const syncAfter = (re, tagRe) => results.filter(x => x.group === 'sync' && tagRe.test(x.tag) && x.sd.some((l, i) =>
  /ability: Synchronize/.test(l) && x.sd.slice(i + 1, i + 3).some(y => re.test(y)))).length;
ok(syncAfter(/^\|-immune\|p1a: [^|]*$/, /type/) > 0, 'NON-VACUOUS: a TYPE-refused reflection printed the bare -immune in the authority');
ok(syncAfter(/^\|-immune\|p1a: .*\[from\] ability: /, /ability/) > 0, 'NON-VACUOUS: an ABILITY-refused reflection printed an attributed -immune');
ok(syncAfter(/^\|-activate\|p1a: .*move: Safeguard/, /Safeguard/) > 0, 'NON-VACUOUS: Safeguard announced refusing a reflection');
ok(syncAfter(/^\|-fail\|p1a: [^|]*\|tox$/, /same/) > 0, 'NON-VACUOUS: a same-status reflection wrote -fail|SOURCE|tox');
ok(syncAfter(/^\|-fail\|p2a: [^|]*$/, /different/) > 0, 'NON-VACUOUS: a different-status reflection wrote -fail|HOLDER');
ok(syncAfter(/^\|-status\|p1a: /, /CONTROL/) > 0, 'NON-VACUOUS: the control reflection landed');
ok(has('coach', /^\|-fail\|p1a: [^|]*$/, /nopartner/) >= 2, 'NON-VACUOUS: the authority failed an ally-aimed move with no partner', has('coach', /^\|-fail\|p1a: [^|]*$/, /nopartner/) + ' games');
console.log('  counters: roostAnnouncedNoFlying ' + (M.MEDSEEN.roostAnnouncedNoFlying | 0) + '   spreadAllyOnlyTarget ' + (M.MEDSEEN.spreadAllyOnlyTarget | 0)
  + '   syncRefusalAnnounced ' + (M.MEDSEEN.syncRefusalAnnounced | 0) + '   allyBoostNoTargetFail ' + (M.MEDSEEN.allyBoostNoTargetFail | 0) + '   itemMoveNoTargetFail ' + (M.MEDSEEN.itemMoveNoTargetFail | 0)
  + '   syncRefusalUnrouted ' + (M.MEDFAILS.syncRefusalUnrouted | 0));
if (!ARMED.length) {
  ok((M.MEDSEEN.roostAnnouncedNoFlying | 0) > 0, 'the non-Flying Roost announcement actually ran (counter moved)');
  ok((M.MEDSEEN.spreadAllyOnlyTarget | 0) > 0, 'the ally-only spread target actually ran (counter moved)');
  ok((M.MEDSEEN.syncRefusalAnnounced | 0) > 0, 'the Synchronize refusal line actually ran (counter moved)');
  ok((M.MEDSEEN.allyBoostNoTargetFail | 0) > 0, 'the ally-boost no-target -fail actually ran (counter moved)');
  ok((M.MEDSEEN.itemMoveNoTargetFail | 0) > 0, 'the item-move no-target -fail actually ran (counter moved)');
  ok((M.MEDFAILS.syncRefusalUnrouted | 0) === 0, 'no Synchronize refusal fell through unrouted');
}

if (CHILD) {
  console.log('__CHILD__' + JSON.stringify({
    div: results.filter(x => x.err || x.div).map(x => x.group + '#' + x.tag),
    board: results.filter(x => x.parts.length).map(x => x.group + '#' + x.tag) }));
  process.exit(bad ? 1 : 0);
}
/* ---- EACH KNOB MUST PART ITS OWN CLASS ON PROTOCOL, NOTHING ELSE, AND NO BOARD, IN A CHILD --------- */
if (!ARMED.length) {
  const { spawnSync } = require('child_process');
  for (const [kn, g] of Object.entries(KNOBS)) {
    console.log(NL + '  --- child under ' + kn + '=1 ---');
    const c = spawnSync(process.execPath, [...process.execArgv, __filename, ...process.argv.slice(2)],
      { env: { ...process.env, [kn]: '1', PROBE_NARA_CHILD: '1' }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const mark = /__CHILD__(\{.*\})/.exec(String(c.stdout || ''));
    if (!mark) { ok(false, kn + ': the child printed a verdict', 'exit ' + c.status + ' ' + String(c.stderr || '').slice(-400)); continue; }
    const res = JSON.parse(mark[1]);
    const inScope = res.div.filter(p => p.startsWith(g + '#')), outScope = res.div.filter(p => !p.startsWith(g + '#'));
    ok(c.status !== 0 && inScope.length > 0, kn + ' makes its own class RED on protocol',
       inScope.length + ' parted' + (inScope.length ? ', first ' + inScope[0] : '   [identical output across a varied knob means the knob is UNWIRED]'));
    ok(outScope.length === 0, kn + ' parts nothing outside its own class', outScope.length ? outScope.slice(0, 4).join(', ') : null);
    ok(res.board.length === 0, kn + ' moves NO board leaf (the old emission was narration only)', res.board.length ? res.board.slice(0, 4).join(', ') : null);
  }
}
console.log(NL + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
