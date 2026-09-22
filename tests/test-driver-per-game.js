#!/usr/bin/env node
/* tests/test-driver-per-game.js — A GAME THE DIFFERENTIAL PLAYS IS THE SAME GAME WHEREVER IT FALLS IN THE RUN.
 * 2026-09-22 (MEASURE, abra/regmc 0.40.0).
 *
 *   node tests/test-driver-per-game.js --regulation regmc                          # green, exit 0
 *   GD_MEGA_SLOT_CARRIES=1 node tests/test-driver-per-game.js --regulation regmc   # RED, exit 1 (the old run-wide parity)
 *
 * THE DEFECT (filed by ENGINE, docs/_reports/2026-09-22-regmc-engine.md §2). `engine/game_differential.js` chose which
 * slot megas, when both could, by a parity (`MEGA_PREFER_B`) that flipped on every mega of the WHOLE RUN and sat outside
 * `driverSnap`. So a game with two stones on the field megaed one body when it came after an even number of megas and
 * the other after an odd number: the same pair, same seed, same driver state, gave two different games depending on
 * what had been played before it. ENGINE's "Aura Guard card that only parts after earlier games" was exactly that.
 *
 * THE CHECK. One pair whose side p1 LEADS TWO STONE HOLDERS (so both slots are offered `canMegaEvo` on turn 1 and the
 * slot rule is actually asked) is played:
 *   ALONE      first game of the process, driver reset;
 *   AGAIN      straight after itself, driver reset (under the old parity, its own mega flipped the rule);
 *   AFTER      after a different game with one stone, driver reset.
 * All three must give the same authority stream, the same medicham2 stream and the same board comparison at every
 * boundary (the streams carry the game; the board line carries what the comparator saw).
 * `driverReset()` is called before each, so the coverage maps the driver carries ON PURPOSE are equal across the arms
 * and the only state that could differ is state that crosses a game boundary without being part of the snapshot.
 * The rule must have been ASKED (`both_offered` moved in every arm), or the check is vacuous and says so.
 *
 * The cast is derived: legal mega stones whose base species the selected regulation's table builds, moves each holder
 * learns. Under Reg M-B the closed regulation keeps the parity by design (see `MEGA_SLOT_CARRIES` in the driver), so
 * this test is a Reg M-C test and exits 2 elsewhere. */
'use strict';
const K = require('./regmc_probe_kit.js').open('test-driver-per-game', ['GD_MEGA_SLOT_CARRIES']);
const { G, D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, hitFor } = K;

const pick0 = G.megaSlotPick();
console.log('\n1. THE RULE');
console.log('     driver slot rule under ' + K.REGN.ID + ': ' + pick0.rule);
ok(K.KNOBS.length ? pick0.rule === 'run-wide-parity' : pick0.rule === 'per-game-address',
  'the driver reads the rule the regulation and the knob call for', JSON.stringify(pick0));

/* ---- the cast ---------------------------------------------------------------------------------------------------- */
const legal = K.legal;
const stones = D.items.all().filter(i => legal(i) && i.megaStone).map(i => {
  const base = i.megaEvolves || (i.megaStone && typeof i.megaStone === 'object' ? Object.keys(i.megaStone)[0] : null);
  return { item: i, base: base ? D.species.get(base) : null };
}).filter(x => x.base && legal(x.base) && !x.base.isMega);
console.log('\n2. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     legal stones with a legal base: ' + stones.length);
const built = (sets) => { const p = G.buildPair(sets); return p && p.length === sets.length ? p : null; };
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
function setFor(s, item, foe) {
  const hit = hitFor(s, foe || s);
  const mv = ['Protect'].concat(hit ? [hit.name] : []);
  return mon(s, item, mv, quiet(s) || undefined);
}
let X = null, Y = null;
outer:
for (let i = 0; i < stones.length; i++) {
  for (let j = i + 1; j < stones.length; j++) {
    const a = stones[i], b = stones[j];
    if (a.base.baseSpecies === b.base.baseSpecies) continue;
    if (!learns(a.base, 'protect') || !learns(b.base, 'protect')) continue;
    const used = new Set([a.base.baseSpecies, a.base.id, b.base.baseSpecies, b.base.id]);
    const f = pickDistinct(FILL, used, 6);
    if (f.length < 6) continue;
    const A = [setFor(a.base, a.item.name, f[2]), setFor(b.base, b.item.name, f[2]), setFor(f[0], ''), setFor(f[1], '')];
    const B = [setFor(f[2], '', a.base), setFor(f[3], '', a.base), setFor(f[4], ''), setFor(f[5], '')];
    const Y1 = [setFor(a.base, a.item.name, f[2]), setFor(f[0], ''), setFor(f[1], ''), setFor(f[4], '')];
    const pa = built(A), pb = built(B), py = built(Y1);
    if (!pa || !pb || !py) continue;
    X = { a: pa, b: pb, cast: a.base.id + ' @ ' + a.item.id + ' + ' + b.base.id + ' @ ' + b.item.id + ' lead p1; foes ' + show([f[2], f[3]]) };
    Y = { a: py, b: pb, cast: a.base.id + ' @ ' + a.item.id + ' alone' };
    break outer;
  }
}
if (!X) { console.log('  NOT STAGED — no pair of legal stone holders the table builds with a legal filler.'); process.exit(1); }
console.log('     X: ' + X.cast);
console.log('     Y: ' + Y.cast);

/* ---- the three arms ----------------------------------------------------------------------------------------------- */
const ARM = G.ARM_BY_ID.get('middle') || G.PRIMARY_ARM;
function play(p, tag) {
  G.driverReset();
  const before = G.megaSlotPick();
  const boards = [];
  const r = G.playGame(p.a, p.b, 'baseline', 'per-game :: ' + tag, { arm: ARM, driverSeed: 'test-driver-per-game',
    onBoundary: (snap, ti) => {
      boards.push('t' + ti + ':' + (snap.leaves_compared || 0) + ':' + (snap.diffs || []).map(d => d.path + '=' + d.medicham + '/' + d.showdown).join(','));
      snap.identical = true; snap.diffs = [];
    } });
  const after = G.megaSlotPick();
  const sd = G.sdStream(G.lastSdLog()).map(String);
  const me = (r.mediTrace || []).map(String);
  return { r, sd, me, boards, asked: after.both_offered - before.both_offered, right: after.chose_right - before.chose_right,
           megaLines: sd.filter(l => /^\|-mega\||^\|detailschange\|/.test(l)).slice(0, 4) };
}
const alone = play(X, 'alone');
const again = play(X, 'again');
play(Y, 'intervening');
const after = play(X, 'after another game');
console.log('\n3. THE ARMS');
for (const [tag, R] of [['ALONE', alone], ['AGAIN', again], ['AFTER', after]]) {
  console.log('  ' + tag.padEnd(6) + ' turns ' + R.r.turns + ', err ' + (R.r.err || 'none') + ', rule asked ' + R.asked
    + 'x (right slot ' + R.right + 'x), showdown lines ' + R.sd.length + ', mega: ' + (R.megaLines.join('  ') || '(none)'));
}
ok(!alone.r.err && !again.r.err && !after.r.err, 'every arm played to an end without throwing',
  [alone, again, after].map(R => R.r.err).filter(Boolean).join(' | ') || null);
ok(alone.asked > 0 && again.asked > 0 && after.asked > 0,
  'the slot rule was ASKED in every arm (both slots offered a mega on one turn) — otherwise this check is vacuous',
  'asked ' + [alone.asked, again.asked, after.asked].join(' / '));
const same = (u, v) => u.length === v.length && u.every((l, i) => l === v[i]);
const firstDiff = (u, v) => { for (let i = 0; i < Math.max(u.length, v.length); i++) if (u[i] !== v[i]) return 'line ' + i + ': ' + u[i] + '  VS  ' + v[i]; return null; };
for (const [tag, R] of [['AGAIN', again], ['AFTER', after]]) {
  ok(same(alone.sd, R.sd), tag + ' — the authority stream is identical to ALONE', firstDiff(alone.sd, R.sd));
  ok(same(alone.me, R.me), tag + ' — the medicham2 stream is identical to ALONE', firstDiff(alone.me, R.me));
  ok(same(alone.boards, R.boards), tag + ' — the board comparison (leaves compared, every parting) is identical to ALONE at every boundary', firstDiff(alone.boards, R.boards));
}
K.finish();
