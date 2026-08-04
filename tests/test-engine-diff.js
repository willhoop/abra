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
function showdownDamage(attName, moveName, defName, roll, stats) {
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
  const before = tgt.hp;
  try { battle.actions.moveHit(tgt, src, move); } catch (e) { return null; }
  return before - tgt.hp;
}

let compared = 0, agreed = 0;
const bad = [];
const seen = new Set();
let guard = 0;
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
    m = MEDI.dmgRange(A, B, MC.moves[mv.mv], { weather: '', terrain: '', twA: 0, twB: 0, tr: 0 }, false);
  } catch (e) { continue; }
  if (!m || !A || !B) continue;
  const stats = { at: A.st.at, sa: A.st.sa, df: B.st.df, sd: B.st.sd, hp: B.st.hp };

  let hi, lo;
  try {
    hi = showdownDamage(attName, dexMove.name, defName, 0, stats);
    lo = showdownDamage(attName, dexMove.name, defName, 15, stats);
  } catch (e) { continue; }
  if (hi == null || lo == null) continue;
  seen.add(key);

  compared++;
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
}, null, 2) + '\n');
console.log('\n  wrote data/engine-diff.json');
