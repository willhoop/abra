/* dynamics model tests. node tests/test-dynamics.js
 * Verifies the per-turn stream produced real speed + damage signal. */
const fs=require('fs'), path=require('path');
const D=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/dynamics.json'),'utf8'));
let pass=0,fail=0; const chk=(c,m)=>{console.log((c?'pass  ':'FAIL  ')+m);c?pass++:fail++;};

chk(D.games>1000, `analysed many games (${D.games})`);
chk(Object.keys(D.speed).length>50, `speed profiles for the meta (${Object.keys(D.speed).length})`);
chk(Object.keys(D.damage).length>200, `damage profiles per attacker|move (${Object.keys(D.damage).length})`);

// speed rates are probabilities
const badSpeed=Object.values(D.speed).find(v=>v.firstRate<0||v.firstRate>1);
chk(!badSpeed, 'all speed first-rates in [0,1]');

// damage means are sane percentages
const dmgs=Object.values(D.damage);
chk(dmgs.every(d=>d.mean>0&&d.mean<=100), 'all damage means in (0,100]');
chk(dmgs.every(d=>d.max>=d.mean), 'max roll >= mean for every profile');

// a known heavy hitter really does hit hard
const wc=D.damage['basculegion|wavecrash'];
chk(wc && wc.mean>40, `Basculegion Wave Crash is a heavy hit (mean ${wc?wc.mean:'?'}%)`);

// scarf detection fired for at least a few mid-speed mons
const scarves=Object.entries(D.speed).filter(([k,v])=>v.scarfHint).length;
chk(scarves>=1, `scarf hints detected from move order (${scarves})`);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
