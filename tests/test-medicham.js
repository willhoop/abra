/* MEDICHAM sanity tests. node tests/test-medicham.js
 * Stochastic model — tolerances are generous but the invariants must hold. */
const path=require('path');
const S=require(path.join(__dirname,'../engine/sets.js'));
const {winProb}=require(path.join(__dirname,'../engine/medicham.js'));
let pass=0,fail=0; const chk=(c,m)=>{console.log((c?'pass  ':'FAIL  ')+m);c?pass++:fail++;};

const full=S.team6(['garchomp','kingambit','incineroar','tyranitar']);
const short=S.team6(['garchomp','kingambit','incineroar']);           // one fewer mon
const mir =S.team6(['garchomp','incineroar','kingambit','whimsicott']);

chk(full.length===4 && short.length===3, 'set-builder builds legal teams from names');
// invariant 1: mirror is a coin flip (symmetry) — with random speed-tie breaking
const pMirror=winProb(mir,mir.map(m=>({...m})),500);
chk(Math.abs(pMirror-0.5)<0.10, `mirror match ~0.5 (got ${pMirror.toFixed(3)})`);
// invariant 2: a numbers advantage (4 vs 3) favours the bigger team
const pNum=winProb(full,short,500);
chk(pNum>0.5, `numbers edge (4 vs 3) favours the full team (got ${pNum.toFixed(3)})`);
// invariant 3: probabilities in range, and antisymmetric within Monte-Carlo noise
chk(pNum>=0 && pNum<=1, 'win prob in [0,1]');
const ab=winProb(full,short,300), ba=winProb(short,full,300);
chk(Math.abs((ab+ba)-1.0)<0.15, `antisymmetry within MC noise (P+P'=${(ab+ba).toFixed(2)})`);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
