/* MEDICHAM sanity tests. node tests/test-medicham.js
 * Stochastic model — tolerances are generous but the invariants must hold. */
const path=require('path');
const S=require(path.join(__dirname,'../engine/sets.js'));
const {winProb}=require(path.join(__dirname,'../engine/medicham.js'));
let pass=0,fail=0; const chk=(c,m)=>{console.log((c?'pass  ':'FAIL  ')+m);c?pass++:fail++;};

const rain=S.team6(['pelipper','basculegion','archaludon','kingambit']);
const sun =S.team6(['charizard','venusaur','torkoal','garchomp']);
const mir =S.team6(['garchomp','incineroar','kingambit','whimsicott']);

chk(rain.length>=3 && sun.length>=3, 'set-builder builds legal teams from names');
const pMirror=winProb(mir,mir.map(m=>({...m})),300);
chk(Math.abs(pMirror-0.5)<0.12, `mirror match ~0.5 (got ${pMirror.toFixed(3)})`);
const pRain=winProb(rain,sun,300);
chk(pRain>0.5, `rain core beats sun core (got ${pRain.toFixed(3)})`);
chk(pRain>=0 && pRain<=1, 'win prob in [0,1]');
const ab=winProb(rain,sun,250), ba=winProb(sun,rain,250);
chk(Math.abs((ab+ba)-1.0)<0.15, `antisymmetry within MC noise (P+P'=${(ab+ba).toFixed(2)})`);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
