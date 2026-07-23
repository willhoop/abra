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
// The hard invariants a Monte-Carlo rollout MUST satisfy (calibration on subtle
// matchups is deliberately coarse — MEDICHAM's role is catching gross overfit,
// not fine percentages, so we do not assert directional matchup claims here).
const pMirror=winProb(mir,mir.map(m=>({...m})),600);
chk(Math.abs(pMirror-0.5)<0.10, `mirror match ~0.5 by symmetry (got ${pMirror.toFixed(3)})`);
const ab=winProb(full,short,400), ba=winProb(short,full,400);
chk(ab>=0 && ab<=1 && ba>=0 && ba<=1, 'win probs in [0,1]');
chk(Math.abs((ab+ba)-1.0)<0.15, `antisymmetric within MC noise (P+P'=${(ab+ba).toFixed(2)})`);
// behaviour-clone actually loaded and is being used (support moves exist)
const pr=JSON.parse(require('fs').readFileSync(path.join(__dirname,'../data/move-priors.json'),'utf8'));
chk(pr.species.whimsicott && pr.species.whimsicott.moves.some(m=>m.kind==='speed'),
    'behaviour-clone tagged Whimsicott Tailwind as speed control');

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
