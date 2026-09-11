/* probe_healblock_clock.js — HEAL BLOCK RUNS A TURN LONGER HERE THAN IN THE AUTHORITY, AND LAPSES
 * WITHOUT SAYING SO.
 *
 *   SHOWDOWN_PATH=... node tests/probe_healblock_clock.js
 *   SHOWDOWN_PATH=... MEDI_HEALBLOCK_CLOCK_LONG=1 node tests/probe_healblock_clock.js   (the red)
 *
 * ================= WHERE THIS CAME FROM =========================================================
 *
 * TWO of the 141 protocol divergences on release `0dec37ff5ad9` (961 games, arm `middle`, empirical
 * driver) are the same missing line, and one of them parts a BOARD:
 *
 *   baseline t7  ...2662088596   sd |-end|p1b: Garchomp|move: Heal Block
 *                                us |upkeep
 *     board  p1.party.garchomp.hp   medi 76 / sd 121
 *            p1.party.garchomp.item medi "sitrusberry" / sd ""
 *   baseline     ...2655283926   the same pair on a Chandelure
 *
 * The board half is the clock, not the line: the authority's Heal Block had already lapsed, so the
 * Sitrus went off; ours was still running, so the berry stayed in the pocket and the body stayed 45 hp
 * down. `data/tags.json` carries exactly one `blocksHealing` member in this format — Psychic Noise,
 * 349 corpus uses — so this is the whole mechanic, not a corner of it.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/moves.ts:8276-8345`, healblock.condition (Champions overrides neither `healblock` nor
 * `psychicnoise` — `data/mods/champions/moves.ts` was grepped for both ids):
 *
 *     duration: 5,
 *     durationCallback(target, source, effect) { if (effect?.name === "Psychic Noise") return 2; ... }
 *     onResidualOrder: 20,
 *     onEnd(pokemon) { this.add('-end', pokemon, 'move: Heal Block'); },
 *
 * and the clock, `sim/battle.ts:515-523`, inside `fieldEvent('Residual')`:
 *
 *     handler.state.duration--;
 *     if (!handler.state.duration) { handler.end.call(...); continue; }
 *
 * `duration: 2` therefore blocks the APPLICATION turn's residual and ONE more, and the second of
 * those two is where `onEnd` writes the `-end`. Measured in the official simulator before anything
 * was edited: Psychic Noise on turn 2, Leftovers refused on turns 2 and 3, `-end` on turn 3, healing
 * back on turn 4.
 *
 * medicham2 set `_healBlock = turns + 1` — a "+1 for the residual that fires on the application turn
 * too", which is the convention this engine uses for clocks it ticks BELOW their consumer. This one is
 * ticked below its consumer as well, so the +1 bought a third blocked residual, and the lapse branch
 * wrote no line at all ("It announces nothing when it lapses in this engine", in the file's own
 * comment). Measured here before the fix: Leftovers refused on turns 2, 3 AND 4.
 *
 * ================= WHAT IS ASSERTED, AND ON WHAT ================================================
 *
 * Both sides are read off the STATE EACH ENGINE COMPUTED — the victim's hp turn by turn, and whether
 * each engine still holds the block (`_healBlock` here, `volatiles.healblock` there). The one line
 * this file reads out of a protocol stream is the `-end` it is about.
 *
 *   1  FIXTURE   the `blocksHealing` family and the bodies are derived and printed
 *   2  CONTROL   with the SAME attacker clicking a move that carries no `blocksHealing`, the victim's
 *                Leftovers heals on EVERY turn in BOTH engines — so a refused heal below is
 *                attributable to the block and to nothing else about the fixture
 *   3  CONTROL   the per-turn heal AMOUNT agrees between the engines
 *   4  TEST      the number of residuals on which the heal is refused agrees with the authority
 *   5  TEST      the first turn healing RESUMES agrees with the authority
 *   6  TEST      medicham2 announces the lapse, on the same turn the authority does
 *   7  COUNTER   MEDSEEN.healBlockApplied and MEDSEEN.healBlockExpired are non-zero — the block was
 *                really applied and really lapsed on the CLOCK, rather than the arms agreeing because
 *                nothing reached the handler
 *
 * `MEDI_HEALBLOCK_CLOCK_LONG=1` restores both halves (the +1 and the silence). The parent re-runs
 * ITSELF as a child under it and FAILS if the child passes.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('HEAL BLOCK CLOCK');
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

const CHILD = process.env.MEDI_HEALBLOCK_CLOCK_LONG === '1' || process.env.MEDI_HEALBLOCK_REFRESH === '1';
let bad = 0, stage = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const FIXTURE = (m) => { stage++; console.log('  FIXTURE  ' + m); };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };

console.log('\n== HEAL BLOCK\'S CLOCK ==' + (CHILD ? '   [MEDI_HEALBLOCK_CLOCK_LONG=1]' : '') + '\n');

/* ================================================================================================
 * 1 — THE FIXTURE, DERIVED.
 * ============================================================================================= */
const FAM = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('blocksHealing') >= 0)
  .map(k => ({ id: k, turns: +TAGS.moves[k].params.blocksHealing.turns, uses: TAGS.moves[k].uses || 0 }))
  .filter(f => legal(dex.moves.get(f.id)))
  .sort((a, b) => b.uses - a.uses);
console.log('  THE `blocksHealing` FAMILY legal in this format, off data/tags.json:');
for (const f of FAM) console.log('    ' + f.id.padEnd(14) + 'turns=' + f.turns + '  acc='
  + dex.moves.get(f.id).accuracy + '  uses=' + f.uses);
if (!FAM.length) { console.log('  NOT RUN — this format carries no heal-blocking move. A claim about the format.'); process.exit(2); }
const BLK = FAM[0];

/* THE ATTACKER learns the blocker, a HARMLESS non-blocking control move of the same category, and a
 * self-target filler it can click on every later turn without touching the victim. */
/* 2026-09-11 -- A PURE SELF-BOOST, AND THE FIRST FILTER LET ALLY SWITCH THROUGH. `target: 'self'` with no
 * charge, pivot, stall or heal flag still admits Ally Switch, which SWAPS THE TWO SLOTS: after turn 1 the
 * authority's slot a held the partner, so any later click aimed "from slot a" came from the wrong body,
 * while medicham2 (which clicks per BODY) did not move. Arm 8 read that as a clock result. A filler must
 * change nothing but the clicker's own stages, so it now has to be a boost table with no handler. */
const SELF_STATUS = s => Object.keys(LS(s)).filter(id => { const m = dex.moves.get(id);
  return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
    && !m.flags.charge && !m.selfSwitch && !m.stallingMove && !m.heal
    && m.boosts && !m.onHit && !m.onTryHit && !m.onTry && !m.volatileStatus; });
let PICK = null;
for (const s of dex.species.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!LS(s)[BLK.id]) continue;
  const fill = SELF_STATUS(s); if (!fill.length) continue;
  /* THE CONTROL CLICK: same attacker, same target, same turn — it just carries no `blocksHealing`.
   * No secondaries and no drain, so nothing else about the victim's hp can move. */
  const ctl = Object.keys(LS(s)).filter(id => { const m = dex.moves.get(id);
    return m.exists && !m.isNonstandard && m.category !== 'Status'
      && (m.accuracy === true || m.accuracy === 100)
      && !(TAGS.moves[id] && (TAGS.moves[id].tags || []).indexOf('blocksHealing') >= 0)
      && !m.secondaries && !m.secondary && !m.multihit && !m.recoil && !m.drain && !m.self; });
  if (ctl.length) { PICK = { sp: s, fill: fill[0], ctl: ctl[0] }; break; }
}
if (!PICK) { FIXTURE('no legal ' + BLK.id + ' user with a self-status filler and a plain control attack'); process.exit(2); }

/* THE VICTIM holds the heal this probe reads. It is derived off the ITEM tag, not named. */
const LEFT = Object.keys(TAGS.items || {}).filter(k => (TAGS.items[k].tags || []).indexOf('passiveHeal') >= 0
  && legal(dex.items.get(k)));
if (!LEFT.length) { console.log('  NOT RUN — no legal `passiveHeal` item. A claim about the format.'); process.exit(2); }
const HEALITEM = LEFT.sort((a, b) => (TAGS.items[b].uses || 0) - (TAGS.items[a].uses || 0))[0];

const INERT = ab => { const t = (TAGS.abilities[ab] || {}).tags || [];
  return !t.some(x => /heal|regen|residual|absorb|magicguard|poisonheal|immun/i.test(x)); };
let VIC = null;
for (const s of dex.species.all().filter(legal).sort((a, b) => b.baseStats.hp - a.baseStats.hp)) {
  if (s === PICK.sp) continue;
  const ab = s.abilities[0]; if (!ab || !INERT(dex.abilities.get(ab).id)) continue;
  if (!dex.getImmunity(dex.moves.get(BLK.id).type, s)) continue;
  const fill = SELF_STATUS(s); if (!fill.length) continue;
  let built = null; try { built = MEDI.buildMon(mcKey(s.name, { mayMiss: 'the victim must be a real row' }), {}); } catch (e) { built = null; console.error('probe fixture: buildMon threw for ' + (s && s.name) + ' -- ' + e.message + '. The candidate pool is NARROWER than the format, so a COULD-NOT-STAGE below is a statement about this search and NOT about the mechanic.'); }
  if (!built) continue;
  VIC = { sp: s, fill: fill[0] }; break;
}
if (!VIC) { FIXTURE('no legal victim with a self-status filler and an inert slot-0 ability'); process.exit(2); }

console.log('\n  CHOSEN   blocker=' + BLK.id + ' (turns=' + BLK.turns + ', ' + BLK.uses + ' uses)'
  + '   attacker=' + PICK.sp.name + '   filler=' + PICK.fill + '   control move=' + PICK.ctl
  + '\n           victim=' + VIC.sp.name + ' (ability ' + VIC.sp.abilities[0] + ', ' + HEALITEM
  + ', filler ' + VIC.fill + ')');

const TURNS = BLK.turns + 4;
/* THE VICTIM IS STAGED DAMAGED rather than hit for it: an opening attack would put a damage roll and
 * a secondary between the fixture and its own claim. The gap is wide enough that the heal never caps. */
const GAP = 60;

/* `again` IS THE LIST OF LATER TURNS ON WHICH THE ATTACKER CLICKS `firstClick` AGAIN, AIMED AT THE SAME
 * VICTIM (2026-09-11, arm 8). Absent, every run is the single application it always was. */
function runMedi(firstClick, again) {
  const mk = (name, moves, item) => { const b = MEDI.buildMon(mcKey(name, { mayMiss: 'a probe body must be a real row' }), {});
    if (!b) throw new Error('buildMon failed for ' + name);
    b.moves = moves.map(m => dex.moves.get(m).id); b.item = item || ''; b.ability = 'none'; return b; };
  const A = mk(PICK.sp.name, [firstClick, PICK.fill]), A2 = mk(PICK.sp.name, [PICK.fill]);
  const V = mk(VIC.sp.name, [VIC.fill], HEALITEM), V2 = mk(VIC.sp.name, [VIC.fill]);
  const trace = [];
  const S = MEDI.battleInit([A, A2], [V, V2], { seeded: true, trace });
  V.curHP = Math.max(1, V.st.hp - GAP);
  const rng = () => 0.5;
  const hp = [], ends = [];
  for (let t = 1; t <= TURNS; t++) {
    const n0 = trace.length;
    const aimed = t === 1 || !!(again && again.indexOf(t) >= 0);
    const mv = aimed ? firstClick : PICK.fill;
    MEDI.battleTurn(S, rng,
      new Map([[A, MEDI.playerAction(A, mv, aimed ? V : null, S.field)], [A2, MEDI.playerAction(A2, PICK.fill, null, S.field)]]),
      new Map([[V, MEDI.playerAction(V, VIC.fill, null, S.field)], [V2, MEDI.playerAction(V2, VIC.fill, null, S.field)]]));
    hp.push(V.curHP);
    if (trace.slice(n0).some(l => /^\|-end\|/.test(String(l)) && /heal *block/i.test(String(l)))) ends.push(t);
  }
  return { maxhp: V.st.hp, hp, ends, blockLeft: V._healBlock | 0 };
}

function runSD(firstClick, again) {
  const set = (n, mv, item) => ({ name: n, species: n, item: item || '', ability: dex.species.get(n).abilities[0],
    moves: mv.map(m => dex.moves.get(m).name),
    nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack([set(PICK.sp.name, [firstClick, PICK.fill]), set(PICK.sp.name, [PICK.fill, PICK.fill])]) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack([set(VIC.sp.name, [VIC.fill, VIC.fill], HEALITEM), set(VIC.sp.name, [VIC.fill, VIC.fill])]) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  const vic = b.sides[1].active[0];
  vic.hp = Math.max(1, vic.maxhp - GAP);
  const hp = [], ends = [];
  let landed2 = null;
  for (let t = 1; t <= TURNS; t++) {
    const n0 = b.log.length;
    const aimed = t === 1 || !!(again && again.indexOf(t) >= 0);
    b.choose('p1', (aimed ? ('move ' + firstClick + ' 1') : ('move ' + PICK.fill)) + ', move ' + PICK.fill);
    b.choose('p2', 'move ' + VIC.fill + ', move ' + VIC.fill);
    hp.push(vic.hp);
    const seg = b.log.slice(n0);
    if (seg.some(l => /^\|-end\|/.test(l) && /Heal Block/i.test(l))) ends.push(t);
    /* THE SECOND CLICK LANDED: its `|move|` line names the victim and nothing between it and the next
     * `|move|` refuses it. Read off the log, never assumed. */
    if (t === 2 && again && again.indexOf(2) >= 0) {
      const mvName = dex.moves.get(firstClick).name;
      const i = seg.findIndex(l => l.startsWith('|move|p1a') && l.split('|')[3] === mvName && /\|p2a/.test(l));
      if (i >= 0) {
        const j = seg.findIndex((l, k) => k > i && l.startsWith('|move|'));
        const tail = seg.slice(i + 1, j < 0 ? seg.length : j);
        landed2 = !tail.some(l => /^\|-(fail|miss|immune|activate)\|/.test(l)) && tail.some(l => /^\|-damage\|p2a/.test(l));
      } else landed2 = false;
    }
  }
  return { maxhp: vic.maxhp, hp, ends, landed2 };
}

/* Healing turns: from turn 2 onward the only thing that can RAISE the victim's hp is the item. */
const healedOn = r => r.hp.map((h, i) => (i >= 1 && h > r.hp[i - 1]) ? i + 1 : 0).filter(Boolean);
const healAmt = r => Array.from(new Set(r.hp.map((h, i) => i >= 1 ? h - r.hp[i - 1] : 0).filter(x => x > 0)));

/* ================================================================================================
 * 2 — CONTROL: same attacker, a click that carries no `blocksHealing`.
 * ============================================================================================= */
const cM = runMedi(PICK.ctl), cS = runSD(PICK.ctl);
ok(healedOn(cM).length === TURNS - 1 && healedOn(cS).length === TURNS - 1,
  'CONTROL — with ' + PICK.ctl + ' (no `blocksHealing`) the item heals on EVERY later turn, both engines',
  'medi healed on turns ' + JSON.stringify(healedOn(cM)) + '   sd ' + JSON.stringify(healedOn(cS))
  + '   (expected ' + (TURNS - 1) + ' turn(s) each)');
ok(cM.ends.length === 0 && cS.ends.length === 0,
  'CONTROL — and neither engine announces a Heal Block that was never applied',
  'medi ends ' + JSON.stringify(cM.ends) + '  sd ends ' + JSON.stringify(cS.ends));

/* ================================================================================================
 * THE BLOCK ARM
 * ============================================================================================= */
const M = runMedi(BLK.id), S = runSD(BLK.id);
console.log('\n  medi  maxhp ' + M.maxhp + '  hp by turn ' + JSON.stringify(M.hp)
  + '  healed on ' + JSON.stringify(healedOn(M)) + '  `-end` on ' + JSON.stringify(M.ends));
console.log('  sd    maxhp ' + S.maxhp + '  hp by turn ' + JSON.stringify(S.hp)
  + '  healed on ' + JSON.stringify(healedOn(S)) + '  `-end` on ' + JSON.stringify(S.ends) + '\n');

/* 3 — CONTROL: the heal AMOUNT. */
ok(healAmt(M).length === 1 && healAmt(S).length === 1 && healAmt(M)[0] === healAmt(S)[0],
  'CONTROL — the per-turn heal AMOUNT is one value and the two engines agree on it',
  'medi ' + JSON.stringify(healAmt(M)) + '  sd ' + JSON.stringify(healAmt(S))
  + '  — the fix is a clock, not arithmetic; this must hold on BOTH arms of the knob');

/* 4 — TEST: how many residuals refuse the heal. */
const refusedM = TURNS - healedOn(M).length - 1, refusedS = TURNS - healedOn(S).length - 1;
ok(refusedM === refusedS,
  'TEST — the number of residuals that REFUSE the heal agrees with the authority',
  'medi ' + refusedM + ' refused, authority ' + refusedS + ' refused'
  + (refusedM === refusedS ? '' : '   <-- medicham2 blocks ' + (refusedM - refusedS)
     + ' residual(s) too many; the clock is set to turns+1'));

/* 5 — TEST: and healing resumes on the same turn. */
ok(healedOn(M)[0] != null && healedOn(M)[0] === healedOn(S)[0],
  'TEST — healing resumes on the same turn in both engines',
  'medi turn ' + healedOn(M)[0] + '  authority turn ' + healedOn(S)[0]);

/* 6 — TEST: the lapse is announced, on the same turn. */
ok(M.ends.length === 1 && S.ends.length === 1 && M.ends[0] === S.ends[0],
  'TEST — medicham2 announces `-end … Heal Block` once, on the authority\'s turn',
  'medi ' + JSON.stringify(M.ends) + '  authority ' + JSON.stringify(S.ends)
  + (M.ends.length ? '' : '   <-- the lapse branch writes no line at all'));

/* 7 — COUNTER. */
const C = MEDI.MEDSEEN || {};
ok((C.healBlockApplied || 0) > 0 && (C.healBlockExpired || 0) > 0,
  'COUNTER — the block was applied AND lapsed on the clock during this run',
  'healBlockApplied=' + (C.healBlockApplied === undefined ? 'ABSENT' : C.healBlockApplied)
  + '  healBlockExpired=' + (C.healBlockExpired === undefined ? 'ABSENT' : C.healBlockExpired));

/* ================================================================================================
 * 8 — TEST: A SECOND APPLICATION WHILE THE BLOCK IS STILL UP DOES NOT RESTART THE CLOCK. 2026-09-11.
 *
 * `Pokemon#addVolatile` (sim/pokemon.ts:1987-1990) answers a volatile the body already carries with
 *     if (!status.onRestart) return false;
 *     return this.battle.singleEvent('Restart', status, this.volatiles[status.id], ...);
 * and never touches `duration`. Heal Block's `onRestart` (data/moves.ts:8337-8344, no Champions
 * override) opens `if (effect?.name === 'Psychic Noise') return;` — so a second Psychic Noise on turn 2
 * leaves the turn-1 clock running: it lapses at turn 2's residual exactly as if the second click had
 * missed. medicham2's `applyHealBlock` overwrote `_healBlock` unconditionally, which bought one more
 * blocked residual and a `-end` a turn late.
 *
 * THE CLICK IS THE SAME MOVE ON TURNS 1 AND 2, at the same victim. Everything else is the block arm.
 * `MEDI_HEALBLOCK_REFRESH=1` puts the overwrite back; the parent re-runs itself under it below.
 * ============================================================================================= */
const M2 = runMedi(BLK.id, [2]), S2 = runSD(BLK.id, [2]);
console.log('\n  TWICE  medi  healed on ' + JSON.stringify(healedOn(M2)) + '  `-end` on ' + JSON.stringify(M2.ends)
  + '\n         sd    healed on ' + JSON.stringify(healedOn(S2)) + '  `-end` on ' + JSON.stringify(S2.ends) + '\n');
/* THE FIXTURE CLAIM IS THAT THE SECOND CLICK REALLY LANDED IN THE AUTHORITY — not a typed turn. The turn
 * the block lapses is the authority's answer and the TEST line below compares against it. */
ok(S2.landed2 === true && S2.ends.length === 1,
  'FIXTURE — in the authority the second ' + BLK.id + ' really hit the victim on turn 2, and the block lapsed once',
  'sd second click landed=' + S2.landed2 + '  `-end` on ' + JSON.stringify(S2.ends));
ok(M2.ends.length === S2.ends.length && M2.ends[0] === S2.ends[0]
   && healedOn(M2)[0] != null && healedOn(M2)[0] === healedOn(S2)[0],
  'TEST — a SECOND application while the block is up does not restart the clock (same `-end` turn, same first heal)',
  'medi `-end` ' + JSON.stringify(M2.ends) + ' first heal ' + healedOn(M2)[0]
  + '   authority `-end` ' + JSON.stringify(S2.ends) + ' first heal ' + healedOn(S2)[0]
  + (M2.ends[0] > S2.ends[0] ? '   <-- medicham2 restarted the clock on the second click' : ''));
if (!CHILD) {
  const C8 = MEDI.MEDSEEN || {};
  ok((C8.healBlockRestartKept || 0) > 0,
    'COUNTER — the restart branch was reached and KEPT the running clock',
    'healBlockRestartKept=' + (C8.healBlockRestartKept === undefined ? 'ABSENT' : C8.healBlockRestartKept));
}

/* ================================================================================================
 * THE KNOBS. Each re-runs this file as a child and must RED it on its own arm.
 * ============================================================================================= */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const kid = (env, pat) => {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, ...env }, encoding: 'utf8' });
    const out = String(r.stdout || '') + String(r.stderr || '');
    return { status: r.status, line: (out.match(pat) || [''])[0].trim() };
  };
  const r = kid({ MEDI_HEALBLOCK_CLOCK_LONG: '1' }, /^ *(PASS|FAIL) *TEST — the number of residuals.*$/m);
  ok(r.status !== 0 && /FAIL/.test(r.line),
    'KNOB — restoring the turns+1 clock and the silent lapse REDS this probe',
    'child exit ' + r.status + '   ' + (r.line || '(the arm printed nothing — the knob is not wired)'));
  const r2 = kid({ MEDI_HEALBLOCK_REFRESH: '1' }, /^ *(PASS|FAIL) *TEST — a SECOND application.*$/m);
  const r2single = kid({ MEDI_HEALBLOCK_REFRESH: '1' }, /^ *(PASS|FAIL) *TEST — the number of residuals.*$/m);
  ok(r2.status !== 0 && /FAIL/.test(r2.line) && /PASS/.test(r2single.line),
    'KNOB — restoring the restart overwrite REDS the second-application arm and ONLY that arm',
    'child exit ' + r2.status + '   ' + (r2.line || '(the arm printed nothing — the knob is not wired)')
    + '   single-application arm under the same knob: ' + (r2single.line || '(nothing)'));
}

console.log('\n  ' + (stage ? stage + ' FIXTURE problem(s) — a claim about the fixture, never about the mechanic. ' : '')
  + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad || stage ? 1 : 0);
