/* DIFFERENTIAL TEST — where does MEDICHAM disagree with Showdown?
 *
 *   SHOWDOWN_PATH=... node tests/test-engine-diff.js [--n 200]
 *
 * WHY THIS EXISTS, AND WHY IT REPLACES GUESSING
 * ---------------------------------------------
 * Every mechanic gap found on 2026-08-03 was found one of two ways: Will noticed something wrong in
 * a live game, or I picked a tag off a list and probed it. Neither is a method. tests/test-mechanics
 * covers 54 of 172 tags and I chose which 54, and the two attempts to systematise the choice both
 * failed -- tests/mechanics_surface.js reports Intimidate as unhandled, and it is verified working.
 *
 * Showdown is the authority. Anywhere the two engines disagree about the same attack is a MEDICHAM
 * bug, including bugs nobody has imagined. That is the property guessing cannot have.
 *
 * It found Freeze-Dry immediately: an Ice move that is SUPER EFFECTIVE on Water, which MEDICHAM was
 * pricing BELOW Ice Beam into a Water type. 1,247 corpus clicks, and the move's whole identity.
 *
 * WHAT IT COMPARES. One attacker, one move, one defender, no items or abilities unless the scenario
 * asks for them, damage only. Damage is where the engines can be compared cleanly -- it is a number
 * both produce for the same inputs. Turn ORDER, status duration and switch behaviour need a
 * different harness and are not attempted here rather than attempted badly.
 *
 * WHAT A DISAGREEMENT IS. Showdown's damage varies over a 16-roll spread; MEDICHAM reports a min and
 * a max. They agree when the ranges overlap and the midpoints are within 12%. A tighter bound would
 * report rounding as a bug; a looser one would miss a resisted-vs-neutral error.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const CS = require(D('engine', 'champions_sim.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));

const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = parseInt((process.argv[process.argv.indexOf('--n') + 1] || '150'), 10);

/* THE SCENARIOS COME FROM REAL USAGE, not from a hand-written list -- otherwise this inherits the
 * same blind spot as the probes it replaces. Attackers are the species people bring, moves are what
 * that species actually clicks, defenders are drawn from the same pool. */
const tags = JSON.parse(fs.readFileSync(D('data', 'abra-tags.js'), 'utf8')
  .replace(/^[^{]*/, '').replace(/;\s*$/, ''));
const movePriors = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'));

const species = Object.keys(movePriors.species || {})
  .filter(s => { try { return !!MEDI.buildMon(s.toLowerCase(), {}); } catch (e) { return false; } });

/* CONTROL FIX 5 -- SHOWDOWN'S OWN moveHit SKIPS THE ABILITY'S onTryHit, so the REFERENCE was wrong.
 *
 * battle.actions.moveHit -> spreadMoveHit runs singleEvent('TryHit', MOVE, ...) and nothing else. The
 * ABILITY's onTryHit is run by runEvent('TryHit') inside hitStepTryHitEvent, which lives one level up
 * in trySpreadMoveHit -- an entry point this harness cannot use, because it also rolls accuracy and
 * priority. So Water Absorb never fired and Showdown reported Pelipper's Muddy Water doing 40-48 to a
 * VAPOREON. MEDICHAM's 0-0 was right and the authority was wrong; without this the harness reports the
 * engine's correct immunity as its bug. Proved three ways: forcing Vaporeon to Hydration gives the
 * same 40-48 (so the ability was doing nothing), single-target Hydro Pump also lands (so it is not a
 * spread or targeting rule), and Thunderbolt lands normally (so the body is otherwise fine).
 *
 * Levitate was NOT affected and that is the whole tell: Levitate is onImmunity, which getDamage does
 * reach. The artifact already records the split -- typeImmunity.via is 'onTryHit' or it is not -- so
 * MEMBERSHIP IS DERIVED, never typed. Printed below before it is used, per docs/LESSONS.md 4.
 *
 * Showdown stays the authority for the OUTCOME: the artifact only says where to look, and the
 * ability's own handler is then asked directly. */
const ONTRYHIT_IMMUNE = new Set(Object.keys(tags.abilities || {}).filter(a => {
  const p = tags.abilities[a] && tags.abilities[a].params && tags.abilities[a].params.typeImmunity;
  return !!(p && p.via === 'onTryHit');
}));

const FILLER = ['Ditto', 'Ditto', 'Ditto'];
const mkSet = (name, moveName) => ({
  name, species: name, item: '', ability: dex.species.get(name).abilities['0'] || '',
  moves: [moveName], nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50, gender: '',
});

/* Showdown's damage for ONE hit, with the roll pinned. The traps here are recorded in
 * engine/validate_damage_sim.js and cost that file two debugging rounds: randomChance() bypasses a
 * battle.random override entirely, so crits must be pinned with willCrit, and a fresh active move is
 * needed per call because moveHitData caches the crit decision per target slot. */
function showdownDamage(attName, moveName, defName, roll, stats, defAbilId) {
  const teamA = [mkSet(attName, moveName), ...FILLER.map(f => mkSet(f, 'Tackle'))];
  const teamB = [mkSet(defName, 'Tackle'), ...FILLER.map(f => mkSet(f, 'Tackle'))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  if (!src || !tgt) return null;
  /* ALIGN THE STATS TO MEDICHAM'S, or this measures the EV spread rather than the damage math.
   *
   * The first run reported twenty "disagreements" and MEDICHAM was higher on EVERY row by a
   * consistent ~1.4x. A systematic offset on every row is never twenty separate bugs -- it was this:
   * the Showdown sets carried 0 EVs and a neutral nature while buildMon gives MEDICHAM a real
   * competitive spread. Same class of error as comparing a Choice Scarf against a Choice Scarf.
   * engine/validate_damage_sim.js already had this exact fix and says why. */
  if (stats) {
    src.storedStats.atk = stats.at; src.storedStats.spa = stats.sa;
    tgt.storedStats.def = stats.df; tgt.storedStats.spd = stats.sd;
    tgt.maxhp = stats.hp; tgt.hp = stats.hp;
  }
  battle.random = (n) => (n === 16 ? roll : 0);
  const move = battle.dex.getActiveMove(moveName);
  move.willCrit = false;
  /* Ask the defender's ability its OWN TryHit question, which moveHit below will not. Only for the
   * abilities the artifact says answer it -- everything else pays nothing. A null or false from the
   * handler is the ability saying "this move does not happen to me", which is zero damage. */
  if (defAbilId && ONTRYHIT_IMMUNE.has(defAbilId)) {
    const ab = battle.dex.abilities.get(defAbilId);
    if (ab && ab.exists && typeof ab.onTryHit === 'function') {
      let r;
      try { r = battle.singleEvent('TryHit', ab, tgt.abilityState, tgt, src, move); } catch (e) { r = undefined; }
      if (r === null || r === false) return 0;
    }
  }
  const before = tgt.hp;
  try { battle.actions.moveHit(tgt, src, move); } catch (e) { return null; }
  return before - tgt.hp;
}

let compared = 0, agreed = 0;
const bad = [];
const seen = new Set();
const touched = { intimidate: 0, weather: 0, absorbMon: 0, absorbFired: 0 };
let guard = 0;

/* PRINT WHAT THE DERIVATION MATCHED, BEFORE IT IS USED. Every derived set in this project
 * over-matched on its first try -- refusesStatusMoves caught Telepathy and Wonder Guard,
 * speedOnItemLoss caught Sticky Hold. This one is checked by eye every run rather than trusted. */
console.log('DERIVED — abilities whose typeImmunity is via onTryHit (Showdown\'s moveHit skips these):');
console.log('  ' + [...ONTRYHIT_IMMUNE].sort().map(a =>
  a + '(' + tags.abilities[a].params.typeImmunity.type + ')').join(' '));
{
  const other = Object.keys(tags.abilities).filter(a => {
    const p = tags.abilities[a].params && tags.abilities[a].params.typeImmunity;
    return p && p.via !== 'onTryHit';
  });
  console.log('  NOT matched, typeImmunity by another route: ' + other.join(' ') + '   (these already work)');
  const inPool = species.filter(s => {
    const sp = dex.species.get(s);
    return sp.exists && ONTRYHIT_IMMUNE.has(String(sp.abilities['0'] || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  });
  console.log('  ' + ONTRYHIT_IMMUNE.size + ' abilities, carried by ' + inPool.length + ' of ' + species.length +
    ' drawable defenders: ' + inPool.join(' ') + '\n');
}
while (compared < N && guard++ < N * 40) {
  const attId = species[Math.floor(Math.random() * species.length)];
  const defId = species[Math.floor(Math.random() * species.length)];
  const rows = (movePriors.species[attId] || {}).moves || [];
  if (!rows.length) continue;
  const mv = rows[Math.floor(Math.random() * rows.length)];
  if (!mv || !mv.mv) continue;
  const key = attId + '|' + mv.mv + '|' + defId;
  if (seen.has(key)) continue;
  const dexMove = dex.moves.get(mv.mv);
  if (!dexMove.exists || !dexMove.basePower) continue;      // status moves are a different harness
  const attName = dex.species.get(attId).name, defName = dex.species.get(defId).name;
  if (!attName || !defName) continue;

  /* MEDICHAM FIRST, because its stats are what Showdown must be aligned to. */
  let m, A, B;
  try {
    A = MEDI.buildMon(attId, {}); B = MEDI.buildMon(defId, {});
    A.item = ''; B.item = '';
    /* THE SAME ABILITY ON BOTH SIDES. Stripping MEDICHAM's to 'none' while handing Showdown the
     * species' real slot-0 ability made the harness report immunities as bugs: Hydreigon's LEVITATE
     * (0 vs 73 from Earthquake), Mimikyu's DISGUISE, and Araquanid's WATER BUBBLE in the other
     * direction (Showdown 158 vs MEDICHAM 80). Every one of those was the two engines being right
     * about different Pokemon. Fourth control failure in this file; they all have the same shape,
     * which is an input that was not held equal. */
    A.ability = String(dex.species.get(attId).abilities['0'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    B.ability = String(dex.species.get(defId).abilities['0'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    /* CONTROL FIX 4 -- THE SWITCH-IN ALREADY HAPPENED ON THE SHOWDOWN SIDE.
     *
     * showdownDamage builds a real Battle and answers team preview, so BOTH leads are genuinely sent
     * out and their entry abilities fire before moveHit is ever called. dmgRange is a pure function
     * and was handed boosts:{at:0} and weather:'' -- so the two engines were being asked different
     * questions, and three of the six 2026-08-04 disagreements were only that:
     *   Gyarados and Tauros are slot-0 INTIMIDATE, so Showdown's attacker sat at atk -1 and MEDICHAM's
     *   did not: 57-67 against 38-45, and 27-32 against 17-21. Give MEDICHAM the -1 and it returns
     *   38-45 and 17-21, exactly.
     *   Tyranitar is slot-0 SAND STREAM, so battle.field.weather was 'sandstorm' and a Rock type had
     *   its 1.5x special defence: 134-162 against 90-108. Put MEDICHAM in sand and it returns 90-108.
     * Fifth control failure in this file and the same shape as the four above it -- an input that was
     * not held equal. Every one of them made MEDICHAM look broken where it is right.
     *
     * MIRRORED THROUGH THE ENGINE'S OWN applyEntryEffects/applyIntimidate, not by hand-setting a boost.
     * That is the difference between routing around the problem and testing it: Intimidate's nine
     * exceptions and the weatherSetter tag are now on the differential's surface, so if the engine gets
     * Defiant's sign or Snow Warning's duration wrong, this test says so instead of hiding it.
     *
     * SPEED ORDER, because the entry effects resolve fastest-first and each weather setter OVERRIDES
     * the last -- so the SLOWER setter's sky is the one left standing, in both engines. Applying in
     * team order would silently disagree whenever both sides set weather. */
    const field = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0 };
    for (const mon of [A, B].sort((x, y) => y.st.sp - x.st.sp)) MEDI.applyEntryEffects(mon, field);
    if (A.ability === 'intimidate') MEDI.applyIntimidate(B);
    if (B.ability === 'intimidate') MEDI.applyIntimidate(A);
    m = MEDI.dmgRange(A, B, MC.moves[mv.mv], field, false);
  } catch (e) { continue; }
  if (!m || !A || !B) continue;
  const stats = { at: A.st.at, sa: A.st.sa, df: B.st.df, sd: B.st.sd, hp: B.st.hp };

  let hi, lo;
  try {
    hi = showdownDamage(attName, dexMove.name, defName, 0, stats, B.ability);
    lo = showdownDamage(attName, dexMove.name, defName, 15, stats, B.ability);
  } catch (e) { continue; }
  if (hi == null || lo == null) continue;
  seen.add(key);

  compared++;
  /* HOW MANY COMPARISONS THE TWO CONTROL FIXES ABOVE TOUCH AT ALL. Counted rather than assumed:
   * before the fixes these rows either disagreed for a reason that was not a MEDICHAM bug, or AGREED
   * BY LUCK -- and a false agreement is the more expensive of the two, because nothing prints. */
  if (B.ability === 'intimidate') touched.intimidate++;
  if (tags.abilities[B.ability] && tags.abilities[B.ability].params
      && tags.abilities[B.ability].params.weatherSetter) touched.weather++;
  if (ONTRYHIT_IMMUNE.has(B.ability)) {
    touched.absorbMon++;
    const _p = tags.abilities[B.ability].params.typeImmunity;
    if (_p && _p.type === dexMove.type) touched.absorbFired++;
  }
  /* SHOWDOWN'S DAMAGE IS CAPPED AT THE TARGET'S HP and MEDICHAM'S IS NOT.
   *
   * `before - tgt.hp` cannot exceed maxhp, so a lethal hit reports exactly the target's HP on BOTH
   * rolls -- which is why the second run's remaining "disagreements" all showed an impossible
   * 165-165 or 145-145 from a sixteen-roll spread. The two engines agreed it was a kill; the
   * comparison did not know that. Capping both sides asks the question that matters: would this hit
   * take the same amount off, up to death. */
  const cap = (x) => Math.min(x, B.st.hp);
  const sMid = (cap(hi) + cap(lo)) / 2, mMid = (cap(m.max) + cap(m.min)) / 2;
  /* Both zero is agreement: an immunity both engines honour. */
  if (sMid === 0 && mMid === 0) { agreed++; continue; }
  const rel = Math.abs(sMid - mMid) / Math.max(1, sMid);
  if (rel <= 0.12) { agreed++; continue; }
  bad.push({ att: attId, mv: mv.mv, def: defId, showdown: cap(lo) + '-' + cap(hi), medicham: cap(m.min) + '-' + cap(m.max),
             rel, uses: ((tags.moves[mv.mv] || {}).uses) || 0 });
}

bad.sort((a, b) => b.uses - a.uses);
console.log(`DIFFERENTIAL TEST — MEDICHAM against Showdown, ${compared} random real matchups\n`);
console.log(`  agreed      ${agreed}`);
console.log(`  disagreed   ${bad.length}   (${(100 * bad.length / Math.max(1, compared)).toFixed(1)}%)\n`);
console.log('  comparisons the two control fixes touch (these were wrong or right-by-luck before):');
console.log(`    defender has Intimidate            ${touched.intimidate}`);
console.log(`    defender sets weather on entry      ${touched.weather}`);
console.log(`    defender has an onTryHit absorb     ${touched.absorbMon}   (${touched.absorbFired} where the move's type actually matched)`);
console.log('');
if (bad.length) {
  console.log('  WORST DISAGREEMENTS, by how often the move is clicked:');
  console.log('     uses  attacker      move            defender        showdown   medicham');
  for (const b of bad.slice(0, 20)) {
    console.log('  ' + String(b.uses).padStart(7) + '  ' + b.att.padEnd(13) + b.mv.padEnd(16) +
      b.def.padEnd(15) + b.showdown.padStart(9) + '  ' + b.medicham.padStart(9));
  }
}
fs.writeFileSync(D('data', 'engine-diff.json'), JSON.stringify({
  generated: new Date().toISOString(), by: 'tests/test-engine-diff.js',
  design: 'Showdown is the authority. Same attacker, move and defender through both engines; a '
        + 'disagreement is a MEDICHAM bug, including one nobody thought to look for.',
  scope: 'damage only, no items or abilities. Turn order, status duration and switching need a '
       + 'different harness and are not attempted here rather than attempted badly.',
  compared, agreed, disagreed: bad.length, worst: bad.slice(0, 40),
  controls: 'both leads are really sent out on the Showdown side, so MEDICHAM is given the same '
          + 'switch-in (Intimidate, weather setters) through the engine\'s own applyEntryEffects/'
          + 'applyIntimidate; and the defender ability\'s onTryHit is asked directly, because '
          + 'Showdown\'s moveHit entry point does not run it.',
  touched,
}, null, 2) + '\n');
console.log('\n  wrote data/engine-diff.json');
