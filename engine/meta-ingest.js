/* Operation Ladder — LADDER-WIDE meta model from public replays.
 * Aggregates both players in every public replay for the format:
 * true meta usage (team%, bring%, lead%), not just one account. */
const https = require('https');
const FORMAT = 'gen9championsvgc2026regmb';
const PAGES = 3;      // ~50 replays/page
const get = u => new Promise((res,rej)=>{https.get(u,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});
const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

function parse(text){
  const names={}, poke={p1:[],p2:[]}, brought={p1:new Set(),p2:new Set()}, lead={p1:[],p2:[]};
  let winner=null;
  for(const line of text.split('\n')){ let m;
    if(m=line.match(/^\|player\|(p[12])\|([^|]*)/)) names[m[1]]=m[2];
    else if(m=line.match(/^\|poke\|(p[12])\|([^,|]+)/)) poke[m[1]].push(norm(m[2]));
    else if(m=line.match(/^\|switch\|(p[12])[ab]: [^|]*\|([^,|]+)/)){ const sp=norm(m[2]); brought[m[1]].add(sp); if(lead[m[1]].length<2&&!lead[m[1]].includes(sp))lead[m[1]].push(sp); }
    else if(m=line.match(/^\|win\|(.*)/)) winner=m[1].trim();
  }
  return {names,poke,brought,lead,winner};
}

(async()=>{
  let ids=[];
  for(let p=1;p<=PAGES;p++){ const l=JSON.parse(await get(`https://replay.pokemonshowdown.com/search.json?format=${FORMAT}&page=${p}`)); ids.push(...l.map(x=>x.id)); }
  ids=[...new Set(ids)];
  console.log(`Pulled ${ids.length} public ladder replays. Parsing...`);

  const stat={}; let sides=0, teams=0;
  const bump=(sp,k)=>{(stat[sp]=stat[sp]||{seen:0,brought:0,led:0,won:0,played:0})[k]++;};
  for(const id of ids){
    let text; try{ text=await get(`https://replay.pokemonshowdown.com/${id}.log`); }catch(e){ continue; }
    const g=parse(text); if(!g.poke.p1.length||!g.poke.p2.length) continue;
    teams++;
    for(const side of ['p1','p2']){
      sides++;
      const won = g.winner && g.names[side]===g.winner;
      for(const sp of new Set(g.poke[side])) bump(sp,'seen');
      for(const sp of g.brought[side]){ bump(sp,'brought'); bump(sp,'played'); if(won)bump(sp,'won'); }
      for(const sp of g.lead[side]) bump(sp,'led');
    }
  }
  const N=sides;
  const table=Object.entries(stat)
    .filter(([_,s])=>s.seen>=3)
    .map(([sp,s])=>({sp, teamRate:+(s.seen/N).toFixed(4), bringRate:+(s.brought/s.seen).toFixed(3),
                     leadRate:+(s.led/s.seen).toFixed(3), winRate: s.played? +(s.won/s.played).toFixed(3):null, n:s.seen}))
    .sort((a,b)=>b.teamRate-a.teamRate);

  const out={format:FORMAT, generated:new Date().toISOString().slice(0,10), sampledReplays:teams, sampledTeams:sides, threats:table};
  require('fs').writeFileSync(process.argv[2]||'meta-usage.json', JSON.stringify(out));
  console.log(`\nLADDER META (${teams} replays, ${sides} teams)`);
  console.log('species          team%   bring%  lead%   win%    n');
  for(const t of table.slice(0,20))
    console.log(t.sp.padEnd(16),(100*t.teamRate).toFixed(1).padStart(5),(100*t.bringRate).toFixed(0).padStart(6)+'%',
      (100*t.leadRate).toFixed(0).padStart(5)+'%',(t.winRate!=null?(100*t.winRate).toFixed(0).padStart(5)+'%':'  -  '),String(t.n).padStart(5));
})();
