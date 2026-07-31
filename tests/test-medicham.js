/* MEDICHAM sanity tests. node tests/test-medicham.js
 * Stochastic model — tolerances are generous but the invariants must hold.
 *
 * REPOINTED AT THE LIVE ENGINE 2026-07-30. This tested `engine/medicham.js`, which is v2: a 1v1
 * sequential-singles rollout, in a DOUBLES format. That file is now `engine/graveyard/
 * medicham-v2-singles.js` and nothing on any live path reads it — so these invariants were guarding
 * a corpse while the engine `board.js` actually calls (`engine/medicham2-browser.js`, the real
 * doubles rollout) went unchecked by them.
 *
 * The invariants below are the same three and they are the right three: a rollout that fails
 * symmetry, range or antisymmetry is broken regardless of which engine computes it. What changed is
 * the subject. `winProb2` takes SPECIES NAMES and builds its own doubles teams, so the S.team6
 * round-trip v2 needed is gone.
 *
 * Deliberately NOT asserted: directional matchup claims. MEDICHAM's role here is catching gross
 * breakage, not fine percentages, and a test that asserts "Garchomp beats Whimsicott 62%" fails the
 * day a regulation changes rather than the day the engine breaks.
 */
const path=require('path');
/* MC MUST BE IN SCOPE BEFORE THE ENGINE IS REQUIRED. medicham2-browser.js runs in the browser as well
 * as node and reads its species table off the global rather than requiring one — its own header says
 * "in node tests they're injected". board.js does the same injection at its damage-engine entry
 * point. Without this the module loads fine and then throws `MC is not defined` on the first real
 * call, which is a failure that looks like a broken test rather than a missing setup line. */
require(path.join(__dirname,'../data/engine-data.js'));
const S=require(path.join(__dirname,'../engine/sets.js'));
const {winProb2}=require(path.join(__dirname,'../engine/medicham2-browser.js'));
let pass=0,fail=0; const chk=(c,m)=>{console.log((c?'pass  ':'FAIL  ')+m);c?pass++:fail++;};

const fullN=['garchomp','kingambit','incineroar','tyranitar'];
const shortN=['garchomp','kingambit','incineroar'];            // one fewer mon
const mirN =['garchomp','incineroar','kingambit','whimsicott'];

chk(S.team6(fullN).length===4 && S.team6(shortN).length===3, 'set-builder builds legal teams from names');

/* A team played against ITSELF must be a coin flip. This is the single strongest check on a rollout:
 * it cannot be passed by a broken engine that happens to favour one side, and it needs no knowledge
 * of the metagame to be correct. */
const pMirror=winProb2(mirN,mirN.slice(),600);
chk(Math.abs(pMirror-0.5)<0.10, `mirror match ~0.5 by symmetry (got ${pMirror.toFixed(3)})`);

const ab=winProb2(fullN,shortN,400), ba=winProb2(shortN,fullN,400);
chk(ab>=0 && ab<=1 && ba>=0 && ba<=1, 'win probs in [0,1]');
chk(Math.abs((ab+ba)-1.0)<0.15, `antisymmetric within MC noise (P+P'=${(ab+ba).toFixed(2)})`);

// behaviour-clone actually loaded and is being used (support moves exist)
const pr=JSON.parse(require('fs').readFileSync(path.join(__dirname,'../data/move-priors.json'),'utf8'));
chk(pr.species.whimsicott && pr.species.whimsicott.moves.some(m=>m.kind==='speed'),
    'behaviour-clone tagged Whimsicott Tailwind as speed control');

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
