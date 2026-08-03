/* THE CHARGE TURN.  node tests/test-charge.js
 *
 * Ten moves cost a turn before they land. medicham2-browser played all of them in ONE turn, and its
 * own header said so -- "Solar Beam is (wrongly, pre-existing) never charged anywhere -- stated, not
 * fixed by pretending". The visible cost was Will watching the live bot fire Electro Shot out of
 * rain, where it is a two-turn move, because the search priced it as a free 130 BP nuke.
 *
 * WHY THE OPPONENTS DO NOTHING, AND WHY THAT IS NOT PROTECT
 * ---------------------------------------------------------
 * Three times this week a test here reported FAIL while the code under it was right: an unforced
 * opponent knocked out the Pokemon being measured, or an rng roll made a move miss, and the
 * assertion read the wreckage. A charge test is especially exposed -- it spans TWO turns by
 * construction, so there are twice as many chances for something unrelated to kill the subject.
 *
 * The first version made both foes Protect, and that broke three assertions in a way worth keeping
 * a note about: Protect BLOCKS THE HIT BEING MEASURED. Every "fires on turn 1" case failed while the
 * engine was right, and the two-turn cases passed only because Protect fails on its second
 * consecutive use and let turn two through. A control that interferes with the measurement is not a
 * control.
 *
 * So both opposing slots take an explicit no-op instead. They cannot attack, cannot faint the user,
 * cannot change the weather, and cannot absorb the move under test.
 */
const path = require('path');
require(path.join(__dirname, '../data/engine-data.js'));
const M = require(path.join(__dirname, '../engine/medicham2-browser.js'));

let pass = 0, fail = 0;
const chk = (c, m) => { console.log((c ? 'pass  ' : 'FAIL  ') + m); c ? pass++ : fail++; };

/* A fixed rng. Charging must not depend on dice, so a deterministic stream makes a failure a real
 * failure rather than an unlucky one -- and 0.99 also defeats Protect's (1/3)^n consecutive check,
 * which would otherwise let the opponents start attacking on turn three. */
const rng = () => 0.99;
const mk = (sp, item) => { const b = M.buildMon(sp, {}); if (item) b.item = item; return b; };

/* Both foes take an explicit no-op, every turn. */
function run(userSpecies, moveId, weather, turns, item) {
  const me = mk(userSpecies, item), ally = mk('incineroar');
  const f1 = mk('incineroar'), f2 = mk('incineroar');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  S.field.weather = weather || '';
  const seen = [];
  for (let t = 0; t < turns; t++) {
    const fa = new Map(), fb = new Map();
    fa.set(me, M.playerAction(me, moveId, f1, S.field));
    fa.set(ally, { kind: 'pass' });
    fb.set(f1, { kind: 'pass' });
    fb.set(f2, { kind: 'pass' });
    M.battleTurn(S, rng, fa, fb);
    seen.push({ turn: t + 1, charging: me._charging || null, invuln: !!me._invuln,
                /* FRACTION of max, not raw HP: curHP is absolute (Archaludon 165) and comparing it
                 * to 1 made an untouched foe read as damaged. */
                foeHP: f1.curHP / f1.st.hp, spa: me.boosts ? me.boosts.sa : 0, item: me.item });
  }
  return { me, f1, seen };
}

/* ---- 1. ELECTRO SHOT OUT OF RAIN COSTS A TURN --------------------------------------------------
 * The bug Will found. Turn one must deal NO damage and must leave the user charging. */
{
  const { seen } = run('archaludon', 'electroshot', '', 2);
  chk(seen[0].charging === 'electroshot', 'electroshot out of rain: turn 1 spends the turn charging');
  chk(seen[0].foeHP === 1, 'electroshot out of rain: turn 1 deals no damage');
  chk(seen[0].spa === 1, 'electroshot out of rain: turn 1 still raises Special Attack');
  chk(seen[1].charging === null, 'electroshot out of rain: turn 2 releases');
  chk(seen[1].foeHP < 1, 'electroshot out of rain: turn 2 deals the damage');
}

/* ---- 2. IN RAIN IT IS A DIFFERENT MOVE ---------------------------------------------------------
 * chargeSkippedByWeather says rain, and a charge move that is not charging is a one-turn move. */
{
  const { seen } = run('archaludon', 'electroshot', 'rain', 1);
  chk(seen[0].charging === null, 'electroshot IN RAIN: never charges');
  chk(seen[0].foeHP < 1, 'electroshot IN RAIN: hits on turn 1');
}

/* ---- 3. SOLAR BEAM IS THE SAME RULE UNDER A DIFFERENT SKY -------------------------------------
 * Nothing in the engine names either move; both come from the same tag, so sun must work for free. */
{
  const dry = run('venusaur', 'solarbeam', '', 1);
  const sun = run('venusaur', 'solarbeam', 'sun', 1);
  chk(dry.seen[0].charging === 'solarbeam', 'solarbeam with no sun: charges');
  chk(sun.seen[0].charging === null && sun.seen[0].foeHP < 1, 'solarbeam IN SUN: hits on turn 1');
}

/* ---- 4. POWER HERB SKIPS THE CHARGE AND IS CONSUMED -------------------------------------------- */
{
  const { seen } = run('archaludon', 'electroshot', '', 1, 'powerherb');
  chk(seen[0].charging === null && seen[0].foeHP < 1, 'power herb: fires on turn 1');
  chk(seen[0].item === '', 'power herb: is consumed');
}

/* ---- 5. THE FIVE THAT LEAVE THE FIELD ----------------------------------------------------------
 * Fly, Dig, Dive, Bounce and Phantom Force are untargetable while charging; the other five stand
 * there. Getting this wrong in the other direction -- charge with no dodge -- would make them
 * strictly worse than reality, which is the same one-directional error the charge bug was. */
{
  const fly = run('corviknight', 'fly', '', 1);
  const beam = run('archaludon', 'electroshot', '', 1);
  chk(fly.seen[0].invuln === true, 'fly: untargetable while charging');
  chk(beam.seen[0].invuln === false, 'electroshot: charges in the open, NOT untargetable');
}

/* ---- 6. AN INVULNERABLE TARGET ACTUALLY CANNOT BE HIT ------------------------------------------
 * The flag is only worth having if the damage loop reads it. Here the foes attack rather than
 * Protect, because the whole question is whether an attack lands. */
{
  const me = mk('corviknight'), ally = mk('incineroar');
  const f1 = mk('incineroar'), f2 = mk('incineroar');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map(), fb = new Map();
  fa.set(me, M.playerAction(me, 'fly', f1, S.field));
  fa.set(ally, { kind: 'pass' });
  fb.set(f1, M.playerAction(f1, 'flareblitz', me, S.field));
  fb.set(f2, M.playerAction(f2, 'flareblitz', me, S.field));
  const before = me.curHP;
  M.battleTurn(S, rng, fa, fb);
  chk(me._invuln === true, 'fly: is flagged untargetable during the charge turn');
  chk(me.curHP === before, 'fly: two Flare Blitzes aimed at it deal nothing while it is off the field');
}

/* ---- 7. THE RELEASE TURN IS NOT A CHOICE -------------------------------------------------------
 * If a charging Pokemon could click something else it would collect the charge-turn stat boost and
 * never spend a turn -- strictly better than the one-turn version this replaced. */
{
  const me = mk('archaludon'), ally = mk('incineroar');
  const f1 = mk('incineroar'), f2 = mk('incineroar');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  const fa = new Map(), fb = new Map();
  fa.set(me, M.playerAction(me, 'electroshot', f1, S.field));
  M.battleTurn(S, rng, fa, null);
  const charging = me._charging;
  /* Turn two: hand the engine NO forced action for the user at all, so chooseAction would normally
   * pick freely. The lock has to override it. */
  M.battleTurn(S, rng, null, null);
  chk(charging === 'electroshot', 'release turn: the user was charging going into turn 2');
  chk(me._charging === null, 'release turn: the charge resolved rather than being abandoned');
}

/* ---- 8. LEAVING THE FIELD ENDS THE CHARGE ------------------------------------------------------
 * A benched mon that kept _charging would return locked into a move it started two switches ago,
 * and one that kept _invuln would return unhittable. */
{
  const me = mk('archaludon'), ally = mk('incineroar'), back = mk('rillaboom');
  const f1 = mk('incineroar'), f2 = mk('incineroar');
  const S = M.battleInit([me, ally, back], [f1, f2], { seeded: true });
  const fa = new Map();
  fa.set(me, M.playerAction(me, 'fly', f1, S.field));
  M.battleTurn(S, rng, fa, null);
  const fa2 = new Map();
  fa2.set(me, { kind: 'switch', to: back });
  M.battleTurn(S, rng, fa2, null);
  chk(!me._charging && !me._invuln, 'switching out clears both the charge and the invulnerability');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
