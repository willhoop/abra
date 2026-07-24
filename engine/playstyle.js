/* playstyle.js — label each real team by its PLAYSTYLE (not its species pair) and build a
 * playstyle x playstyle matchup matrix from real outcomes (Wilson CIs), same shape as
 * data/guru-matchups.json so SLOWKING can solve it. Answers: do stall / Trick Room / perish-trap /
 * setup / weather form stronger non-transitive cycles than the coarse species archetypes?
 *
 * Classification is a rule-based prior over the six species + any REVEALED moves/items (sets are
 * partial in Bo1, so species roles carry most of the signal). Priority order resolves overlaps.
 *   node engine/playstyle.js   ->  data/playstyle-matchups.json
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const STORE = path.join(ROOT, 'data', 'games.ladder.jsonl');
const OUT = path.join(ROOT, 'data', 'playstyle-matchups.json');
const idn = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// species role priors (Reg M-B relevant). A species can carry more than one signal.
const RAIN = new Set(['pelipper', 'politoed']);
// Charizard in Reg M-B is overwhelmingly Mega-Y (Drought) → a sun setter. (Rare Charizardite-X exists.)
const SUN = new Set(['torkoal', 'groudon', 'ninetales', 'charizard']);
const SAND = new Set(['tyranitar', 'hippowdon', 'gigalith', 'tyranitarmega']);
const SNOW = new Set(['ninetalesalola', 'abomasnow', 'abomasnowmega']);
const TR_SETTER = new Set(['torkoal', 'farigiraf', 'hatterene', 'hattrenemega', 'indeedee', 'indeedeef',
  'cresselia', 'bronzong', 'porygon2', 'dusclops', 'oranguru', 'stonjourner', 'ursaluna', 'mudsdale']);
const TRAP = new Set(['gothitelle', 'gengar', 'gengarmega', 'politoed']);          // shadow tag / perish enablers
const TAILWIND = new Set(['whimsicott', 'tornadus', 'talonflame', 'murkrow', 'pelipper', 'staraptor']);
const FAKEOUT = new Set(['incineroar', 'rillaboom', 'meowscarada', 'mienshao', 'hitmontop', 'purugly']);
const STALL = new Set(['amoonguss', 'dondozo', 'toxapex', 'alomomola', 'blissey', 'clefairy', 'sinistcha']);
// revealed-move signals
const SETUP_MOVES = ['dragon dance', 'swords dance', 'calm mind', 'nasty plot', 'bulk up', 'quiver dance',
  'shell smash', 'agility', 'iron defense', 'coil', 'work up'];
const TR_MOVE = 'trick room', PERISH_MOVE = 'perish song', TW_MOVE = 'tailwind';

function classify(six, sets) {
  const s = six.map(idn);
  const moves = [];
  for (const k in (sets || {})) for (const mv of (sets[k].moves || [])) moves.push(mv.toLowerCase());
  const has = set => s.some(x => set.has(x));
  const hasMove = m => moves.some(x => x.includes(m));
  const countAtk = s.filter(x => !STALL.has(x) && !TR_SETTER.has(x)).length;

  // priority: explicit strategy signals first, then weather, then tempo, then default
  if (hasMove(PERISH_MOVE) || (has(TRAP) && s.includes('gothitelle'))) return 'PerishTrap';
  if (hasMove(TR_MOVE) || (TR_prior(s) && slowLeaning(s))) return 'TrickRoom';
  if (moves.some(m => SETUP_MOVES.some(su => m.includes(su)))) return 'Setup';
  if (has(STALL) && s.filter(x => STALL.has(x)).length >= 2) return 'Stall';
  if (has(RAIN)) return 'Rain';
  if (has(SUN)) return 'Sun';
  if (has(SAND)) return 'Sand';
  if (has(SNOW)) return 'Snow';
  if ((hasMove(TW_MOVE) || has(TAILWIND)) && countAtk >= 3) return 'TailwindOffense';
  if (has(FAKEOUT)) return 'FakeOutBalance';
  return 'HyperOffense';
}
function TR_prior(s) { return s.some(x => TR_SETTER.has(x)); }
function slowLeaning(s) { // a TR setter present AND at least one heavy slow attacker archetype
  const SLOW_ATK = new Set(['torkoal', 'ursaluna', 'kingambit', 'incineroar', 'basculegion', 'archaludon', 'crawdaunt', 'marowak']);
  return s.some(x => SLOW_ATK.has(x));
}

// ---- accumulate matchups from real human games -------------------------------------------------
const seen = new Set();
const N = {};       // N[a][b] = games where a-team beat b-team (a is p1-perspective winner)
const G = {};       // G[a][b] = total games between a and b
const styleCount = {};
function bump(o, a, b) { o[a] = o[a] || {}; o[a][b] = (o[a][b] || 0) + 1; }

let nGames = 0;
for (const line of fs.readFileSync(STORE, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let g; try { g = JSON.parse(line); } catch (e) { continue; }
  if (seen.has(g.id)) continue; seen.add(g.id);
  if (!g.winner || g.p1.bot || g.p2.bot) continue;
  const six1 = g.six && g.six.p1, six2 = g.six && g.six.p2;
  if (!six1 || !six2 || six1.length < 6 || six2.length < 6) continue;
  const s1 = classify(six1, g.sets), s2 = classify(six2, g.sets);
  styleCount[s1] = (styleCount[s1] || 0) + 1; styleCount[s2] = (styleCount[s2] || 0) + 1;
  const p1win = idn(g.winner) === idn(g.p1.name);
  bump(G, s1, s2); bump(G, s2, s1);
  if (p1win) bump(N, s1, s2); else bump(N, s2, s1);
  nGames++;
}

const styles = Object.keys(styleCount).sort((a, b) => styleCount[b] - styleCount[a]);
function wilson(w, n) {
  if (!n) return { p: null, lo: null, hi: null, n: 0 };
  const z = 1.96, ph = w / n, d = 1 + z * z / n;
  const c = (ph + z * z / (2 * n)) / d, m = z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / d;
  return { p: +ph.toFixed(3), lo: +(c - m).toFixed(3), hi: +(c + m).toFixed(3), n };
}
const matrix = {};
for (const a of styles) {
  matrix[a] = {};
  for (const b of styles) {
    if (a === b) { matrix[a][b] = null; continue; }
    const n = (G[a] && G[a][b]) || 0, w = (N[a] && N[a][b]) || 0;
    matrix[a][b] = n ? wilson(w, n) : null;
  }
}
const out = {
  generated: 'engine/playstyle.js — playstyle matchup matrix from REAL outcomes (Wilson CIs)',
  n_games: nGames, n_archetypes: styles.length,
  archetypes: styles,
  style_counts: styleCount,
  matrix,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`playstyle matrix: ${nGames} games, ${styles.length} styles`);
console.log('  distribution:', styles.map(s => `${s} ${styleCount[s]}`).join(' | '));
