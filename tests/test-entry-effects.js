/* WHAT A POKEMON BRINGS WITH IT WHEN IT ARRIVES — and what the thing across from it does about that.
 *
 * The switch path used to price the hit a candidate takes on entry against the foe's FULL Attack,
 * with no weather it was about to set. Measured over 40,001 switch-in matchups, declaring
 * `intimidate`, `drizzle` or `drought` on the incoming Pokemon changed the feature vector in exactly
 * ZERO of them, while the control (`levitate`) moved 2,754. The fact was in the dex, it reached the
 * mon after it landed, and it never reached the path that CHOOSES.
 *
 * Will asked the question that makes the fix non-trivial: "does it also proc defiant and competitive
 * when it switches in". It does — and modelling the drop without modelling the ANSWER to it would
 * have been worse than modelling neither, because Intimidate into Kingambit is not a free -1 Attack,
 * it is +2 Attack for them. A scorer that knew only the drop would rate the most punishing
 * Intimidate matchup in the format as the most attractive one.
 *
 * So the direction of each effect is asserted here, not just its presence. A test that only checked
 * "the vector moved" would pass on a sign error, and a sign error is precisely the failure mode.
 *
 * NOTHING IS NAMED IN THE ENGINE. Every effect below is derived by calling the dex's own handler
 * against a recording stub, so these tests are checking that the derivation reads the dex correctly.
 * They name abilities because a TEST is allowed to state the case it is about; board.js is not.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};
const I = n => B.FEATURE_INDEX[n];

console.log('ENTRY EFFECTS — THE DROP, THE WEATHER, AND THE ANSWER TO THE DROP\n');

/* ---- 1. THE EFFECTS ARE READ OFF THE DEX ----------------------------------------------------- */
console.log('1. derived from the dex handler, not from a list');
const intim = B.entryEffects('intimidate', dex);
ok(intim && intim.foeBoosts && intim.foeBoosts.atk === -1,
  'intimidate drops the foe\'s Attack by exactly 1', intim ? JSON.stringify(intim.foeBoosts) : 'null');
ok(intim && intim.name === 'Intimidate',
  'the display name is carried (four abilities block Intimidate BY NAME)', intim && intim.name);

const drz = B.entryEffects('drizzle', dex);
ok(drz && drz.weather === 'raindance', 'drizzle sets rain', drz && drz.weather);
const drt = B.entryEffects('drought', dex);
ok(drt && drt.weather === 'sunnyday', 'drought sets sun', drt && drt.weather);
const snow = B.entryEffects('snowwarning', dex);
ok(snow && snow.weather === 'snowscape', 'snow warning sets snow — never named in board.js', snow && snow.weather);

/* A self-boost on entry is the same shape read from the other argument slot. */
const sword = B.entryEffects('intrepidsword', dex);
ok(sword && sword.selfBoosts && sword.selfBoosts.atk > 0,
  'intrepid sword lands as a SELF boost, not a foe drop', sword ? JSON.stringify(sword.selfBoosts) : 'null');

/* An ability with no entry effect must return null rather than an empty record, so the switch path
 * can skip the whole pipeline for the overwhelming majority of Pokemon. */
ok(B.entryEffects('levitate', dex) === null, 'an ability with no onStart effect returns null');
ok(B.entryEffects('', dex) === null, 'no declared ability returns null');

/* ---- 2. WILL'S QUESTION: THE ANSWER TO THE DROP ---------------------------------------------- */
console.log('\n2. what the target does about it (Will: "does it also proc defiant and competitive")');
const drop = { atk: -1 };
const net = (ability) => {
  const r = B.resolveDrop(drop, { ability }, dex, 'Intimidate');
  const t = {};
  for (const [k, v] of Object.entries(r.applied || {})) t[k] = (t[k] || 0) + v;
  for (const [k, v] of Object.entries(r.targetGains || {})) t[k] = (t[k] || 0) + v;
  return { net: t, reflected: r.reflected };
};

const def = net('defiant');
ok(def.net.atk === 1, 'DEFIANT: -1 then +2, so the foe ends up STRONGER (+1 net)', JSON.stringify(def.net));

const comp = net('competitive');
ok(comp.net.atk === -1 && comp.net.spa === 2,
  'COMPETITIVE: the Attack drop lands AND it answers with +2 Sp. Atk', JSON.stringify(comp.net));

const clear = net('clearbody');
ok(!clear.net.atk, 'CLEAR BODY: the drop is deleted outright', JSON.stringify(clear.net));

const inner = net('innerfocus');
ok(!inner.net.atk, 'INNER FOCUS: blocks Intimidate', JSON.stringify(inner.net));

/* The name test, and the reason the display name is carried. Inner Focus stops Intimidate and
 * nothing else — a drop from any other source must still land. */
const innerOther = B.resolveDrop({ atk: -1 }, { ability: 'innerfocus' }, dex, 'Snarl');
ok(innerOther.applied.atk === -1,
  'INNER FOCUS blocks Intimidate BY NAME — the same drop from Snarl still lands',
  JSON.stringify(innerOther.applied));
/* Clear Body is the contrast: it does not care where the drop came from. */
const clearOther = B.resolveDrop({ atk: -1 }, { ability: 'clearbody' }, dex, 'Snarl');
ok(!clearOther.applied.atk, 'CLEAR BODY blocks it regardless of source', JSON.stringify(clearOther.applied));

const guard = net('guarddog');
ok(guard.net.atk === 1, 'GUARD DOG: blocked, then converted to +1 Attack', JSON.stringify(guard.net));

const contr = net('contrary');
ok(contr.net.atk === 1, 'CONTRARY: the drop is INVERTED into a boost', JSON.stringify(contr.net));

const simple = net('simple');
ok(simple.net.atk === -2, 'SIMPLE: the drop is doubled', JSON.stringify(simple.net));

const mirror = net('mirrorarmor');
ok(mirror.reflected && mirror.reflected.atk === -1 && !mirror.net.atk,
  'MIRROR ARMOR: bounced back at whatever just arrived, and does not land on the foe',
  JSON.stringify(mirror));

/* ---- 3. END TO END: THE SIGN SURVIVES THE FEATURE VECTOR -------------------------------------
 * The pipeline being right in isolation is not the claim. The claim is that switching an Intimidate
 * Pokemon into a Defiant foe scores WORSE than into an otherwise identical neutral foe. The case is
 * FOUND BY SEARCHING rather than named, and if no discriminating case exists the test FAILS loudly —
 * "I could not find an example" is information, not a pass. */
console.log('\n3. end to end — Intimidate into Defiant must read worse than into a neutral foe');

function mkBoard(foeSpecies, foeAbility, benchSpecies, benchAbility) {
  const b = new B.Board();
  b.turn = 3;
  b.sides.p2.active = {
    a: { species: foeSpecies, hp: 1, boosts: {}, status: '', fainted: false,
         nature: 'Serious', item: '', ability: foeAbility,
         moves: ((MC.mons[foeSpecies] || {}).mv || []).slice(0, 4) },
  };
  b.sides.p1.active = {};
  b.party.p1 = [benchSpecies];
  b.party.p2 = [foeSpecies];
  b.setSheet('p1', benchSpecies, {
    nature: 'Serious', item: '', ability: benchAbility,
    moves: ((MC.mons[benchSpecies] || {}).mv || []).slice(0, 4),
  });
  return b;
}
const featOf = (board, sp) =>
  B.featuresFor({ raw: null, move: null, targetMon: null, switchTo: sp, forced: false },
    null, board, 'p1', dex, B.PRIOR_FLOOR);

const names = Object.keys(MC.mons);
/* A physical attacker is required for an Attack change to be visible at all. */
const physical = names.filter(n => {
  const m = MC.mons[n] || {};
  return (m.st || {}).at >= 100 && ((m.mv || []).some(id => (MC.moves[id] || {}).c === 'P'));
});

let found = 0, checked = 0, backwards = 0;
outer:
for (const bench of names) {
  for (const foe of physical) {
    if (bench === foe) continue;
    let vNeutral, vDefiant;
    try {
      vNeutral = featOf(mkBoard(foe, 'noability', bench, 'intimidate'), bench);
      vDefiant = featOf(mkBoard(foe, 'defiant', bench, 'intimidate'), bench);
    } catch (e) { continue; }
    if (!vNeutral || !vDefiant) continue;
    checked++;
    const s1n = vNeutral[I('switchSurvives1')], s1d = vDefiant[I('switchSurvives1')];
    const s2n = vNeutral[I('switchSurvives2')], s2d = vDefiant[I('switchSurvives2')];
    const dn = vNeutral[I('switchDiesFirst')], dd = vDefiant[I('switchDiesFirst')];
    if (s1n !== s1d || s2n !== s2d || dn !== dd) {
      /* Defiant makes the foe hit HARDER, so survival may only fall and death may only rise. */
      const worse = (s1d <= s1n) && (s2d <= s2n) && (dd >= dn);
      if (worse) { if (!found) console.log(`     found: ${bench} (Intimidate) into ${foe}`); found++; }
      else { backwards++; if (backwards <= 2) console.log(`     BACKWARDS: ${bench} into ${foe}  survives1 ${s1n}->${s1d} survives2 ${s2n}->${s2d} dies ${dn}->${dd}`); }
      if (found > 200) break outer;
    }
    if (checked > 6000) break outer;
  }
}
ok(found > 0, 'a discriminating case exists — Defiant changes the switch-in read', `${found} of ${checked} matchups`);
ok(backwards === 0, 'and it is NEVER in the wrong direction', `${backwards} backwards`);

console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
process.exit(fails ? 1 : 0);
