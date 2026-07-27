/* deadNoLastMove must depend on MOVE ORDER, not just on the target having no last move.
 *
 *   Prankster Encore (+1) into a fresh switch-in  -> resolves first, target still has not moved, FAILS
 *   slow Encore into the same fresh switch-in     -> target moves first, Encore LANDS  <- the good play
 *   any Encore into something that has moved      -> lands
 *
 * Prankster is held as P(this species has Prankster), so the fast case scores near 1 rather than
 * exactly 1 — the model does not get to see the opponent's ability sheet any more than a player does.
 */
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const R = 'C:/Users/willj/Projects/Pokemon/ABRA/';
const B = require(R + 'engine/board.js');
const CS = require(R + 'engine/champions_sim.js');
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const mon = (species, extra) => Object.assign({
  species, hp: 100, maxhp: 100, boosts: {}, status: '', moves: ['encore'],
}, extra || {});

function run(label, userSpecies, foeSpecies, lastMove) {
  const board = new B.Board();
  const user = mon(userSpecies);
  const foe = mon(foeSpecies, { lastMove: lastMove || null, moveThisTurn: false });
  board.p1 = [user]; board.p2 = [foe];
  const cand = { move: dex.moves.get('encore'), targetMon: foe, spread: null, allies: [], foes: [foe] };
  const x = B.featuresFor(cand, user, board, 'p1', dex, 0.05);
  const v = x[B.FEATURE_INDEX.deadNoLastMove];
  const mf = x[B.FEATURE_INDEX.movesFirst];
  console.log(`  ${label.padEnd(44)} deadNoLastMove=${v.toFixed(2)}   movesFirst=${mf.toFixed(2)}`);
  return v;
}

console.log('ENCORE, GATED ON WHO MOVES FIRST\n');
const fast = run('Whimsicott (Prankster) -> fresh Garchomp', 'Whimsicott', 'Garchomp', null);
const slow = run('Torkoal (slow, no Prankster) -> fresh Garchomp', 'Torkoal', 'Garchomp', null);
const moved = run('Whimsicott -> Garchomp that already moved', 'Whimsicott', 'Garchomp', 'earthquake');

const ok = fast > 0.5 && slow < 0.5 && moved < 0.01;
console.log(`\nFEATURES: ${B.FEATURES.length}`);
console.log(ok ? 'PASS — fast Encore flagged, slow Encore left alone' : 'FAIL');
process.exit(ok ? 0 : 1);
