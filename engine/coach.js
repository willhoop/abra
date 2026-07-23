/* ABRA — game analyzer / coach.  node engine/coach.js <replayId> [me]
 * Reads one replay, gives instant structured feedback, and (optionally) appends
 * the game to the durable store. The brain of the coaching front-end. */
const https=require('https'), fs=require('fs'), path=require('path');
const { extract } = require('./durable-ingest.js');
const ID = process.argv[2];
const ME = (process.argv[3]||'willhoop').toLowerCase().replace(/[^a-z0-9]/g,'');
const get=u=>new Promise(r=>{https.get(u,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(d));}).on('error',()=>r(''));});
const idn=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

// ABRA meta for threat context
let META={}; try{ (JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','meta-usage.json'),'utf8')).threats||[]).forEach(t=>META[t.sp]=t); }catch(e){}

(async()=>{
  const bare = ID.replace(/^https?:\/\/[^/]+\//,'').replace(/\.log$/,'');
  const text = await get(`https://replay.pokemonshowdown.com/${bare}.log`);
  if(!text){ console.log('could not fetch replay'); process.exit(1); }
  // uploadtime from the |t:| line if present
  const tm=(text.match(/\|t:\|(\d+)/)||[])[1]; 
  const r = extract(bare, +tm||0, text);
  const meP = idn(r.p1.name)===ME?'p1':'p2', foeP = meP==='p1'?'p2':'p1';
  const meName=r[meP].name, foeName=r[foeP].name;
  const won = r.winner && idn(r.winner)===ME;

  // count faints per side from the log
  const faints={p1:0,p2:0}; for(const l of text.split('\n')){const m=l.match(/^\|faint\|(p[12])/); if(m)faints[m[1]]++;}
  const turns=(text.match(/\|turn\|(\d+)/g)||[]).pop();

  console.log(`\n=== GAME COACH — ${meName} vs ${foeName} ===`);
  console.log(`Result: ${won?'WIN':'LOSS'}   ·   ${(turns||'|turn|?').replace('|turn|','turns: ')}   ·   your faints ${faints[meP]} / theirs ${faints[foeP]}`);

  console.log(`\nOpponent's six:`);
  for(const sp of r.six[foeP]){ const m=META[sp]; const tag=m?`ladder ${(100*m.teamRate).toFixed(0)}% team, ${(100*m.bringRate).toFixed(0)}% bring, wins ${(100*(m.winRate||0)).toFixed(0)}%`:'(not in meta sample)'; console.log(`  ${sp.padEnd(15)} ${tag}`); }

  // the biggest meta threats they had, that you should have prepped for
  const threats=r.six[foeP].map(sp=>({sp,t:(META[sp]||{}).teamRate||0})).sort((a,b)=>b.t-a.t).slice(0,3);
  console.log(`\nTop meta threats you faced: ${threats.map(x=>x.sp+(x.t?` (${(100*x.t).toFixed(0)}%)`:'')).join(', ')}`);

  console.log(`\nWhat you brought: ${r.brought[meP].join(', ')||'(?)'}`);
  console.log(`What they brought: ${r.brought[foeP].join(', ')||'(?)'}`);
  console.log(`Your lead: ${r.lead[meP].join(' + ')}   ·   Their lead: ${r.lead[foeP].join(' + ')}`);

  // observed opponent sets (intel for next time)
  const seen=Object.entries(r.sets).filter(([k,v])=>r.six[foeP].includes(k)&&(v.moves.length||v.item||v.ability));
  if(seen.length){ console.log(`\nOpponent sets revealed this game (intel):`);
    for(const [k,v] of seen.slice(0,6)) console.log(`  ${k}: ${[...v.moves].slice(0,4).join('/')||'—'}${v.item?' @ '+v.item:''}${v.ability?' ['+v.ability+']':''}`); }

  console.log(`\n[background] this game would be appended to data/games.ladder.jsonl and folded into the model.`);
})();
