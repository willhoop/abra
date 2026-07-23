/* Operation Ladder — analysis over the durable store.
 * ONE store -> many views by filter. Never re-pulls. */
const fs=require('fs');
const STORE=process.argv[2]||'data/games.ladder.jsonl';
const ME=(process.env.ME||'willhoop').split(',').map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));
const games=fs.readFileSync(STORE,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const idn=n=>(n||'').toLowerCase().replace(/[^a-z0-9]/g,'');

function usage(rows, {minRating=0, humansOnly=true}={}){
  const stat={}; let sides=0;
  const bump=(sp,k)=>{(stat[sp]=stat[sp]||{seen:0,brought:0,led:0,won:0,played:0})[k]++;};
  for(const g of rows) for(const s of ['p1','p2']){
    const pl=g[s]; if(!pl)continue;
    if(humansOnly&&pl.bot)continue;
    if(minRating&&(pl.rating||0)<minRating)continue;
    sides++;
    const won=g.winner&&idn(g.winner)===idn(pl.name);
    for(const sp of new Set(g.six[s]))bump(sp,'seen');
    for(const sp of g.brought[s]){bump(sp,'brought');bump(sp,'played');if(won)bump(sp,'won');}
    for(const sp of g.lead[s])bump(sp,'led');
  }
  const t=Object.entries(stat).filter(([_,s])=>s.seen>=8)
    .map(([sp,s])=>({sp,team:s.seen/sides,bring:s.brought/s.seen,lead:s.led/s.seen,win:s.played?s.won/s.played:null,n:s.seen}))
    .sort((a,b)=>b.team-a.team);
  return {sides, table:t};
}
function show(title,u){ console.log(`\n${title}  (${u.sides} teams)`);
  console.log('species        team%  bring% lead%  win%'); 
  for(const t of u.table.slice(0,10))
    console.log(t.sp.padEnd(14),(100*t.team).toFixed(1).padStart(5),(100*t.bring).toFixed(0).padStart(6)+'%',
      (100*t.lead).toFixed(0).padStart(5)+'%',(t.win!=null?(100*t.win).toFixed(0).padStart(5)+'%':'  -')); }

const mine=games.filter(g=>ME.includes(idn(g.p1&&g.p1.name))||ME.includes(idn(g.p2&&g.p2.name)));
console.log(`STORE: ${games.length} games. Yours: ${mine.length}.`);
show('LADDER META — humans, all ratings', usage(games,{humansOnly:true}));
show('HIGH LADDER — humans, 1300+',        usage(games,{humansOnly:true,minRating:1300}));

// personal: your record + your win rate when facing each threat
if(mine.length){
  let w=0; const vs={};
  for(const g of mine){ const meSide = ME.includes(idn(g.p1&&g.p1.name))?'p1':'p2'; const foe=meSide==='p1'?'p2':'p1';
    const won=g.winner&&ME.includes(idn(g.winner)); if(won)w++;
    for(const sp of g.brought[foe]){ (vs[sp]=vs[sp]||{n:0,w:0}).n++; if(won)vs[sp].w++; } }
  console.log(`\nYOUR RECORD: ${w}-${mine.length-w}`);
  const worst=Object.entries(vs).filter(([_,v])=>v.n>=3).map(([sp,v])=>({sp,n:v.n,win:v.w/v.n})).sort((a,b)=>a.win-b.win).slice(0,6);
  console.log('Your worst matchups (faced >=3):');
  for(const t of worst) console.log('  '+t.sp.padEnd(14),(100*t.win).toFixed(0).padStart(4)+'%  (n='+t.n+')');
}

// write the shared meta model the plugin/dashboard read
const out=usage(games,{humansOnly:true});
fs.writeFileSync('data/meta-usage.json',JSON.stringify({format:'gen9championsvgc2026regmb',generated:new Date().toISOString().slice(0,10),
  sampledTeams:out.sides, threats:out.table.map(t=>({sp:t.sp,teamRate:+t.team.toFixed(4),bringRate:+t.bring.toFixed(3),leadRate:+t.lead.toFixed(3),winRate:t.win!=null?+t.win.toFixed(3):null,n:t.n}))}));
console.log('\nwrote data/meta-usage.json');
