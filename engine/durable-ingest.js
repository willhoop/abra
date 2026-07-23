/* Operation Ladder — durable, incremental, no-redo ingest.
 * Stores EVERY game's raw facts keyed by id (append-only, dedup).
 * Rating + bot tagged so any cutoff is a re-filter, never a re-pull.
 * Also records observed moves/items/abilities per species (set inference later). */
const https=require('https'), fs=require('fs');
const FORMAT='gen9championsvgc2026regmb';
const PAGES=+(process.env.PAGES||2), CONC=+(process.env.CONC||16);
const STORE=process.argv[2]||'games.jsonl';
const get=u=>new Promise(r=>{const q=https.get(u,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(d));});q.on('error',()=>r(''));q.setTimeout(12000,()=>{q.destroy();r('');});});
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const ME=(process.env.ME||'willhoop').split(',').map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));
const isBot=n=>/^pcrlbot|bot\d|^[a-z]+bot$/i.test(n||'');

function extract(id, uploadtime, text){
  const P={p1:{},p2:{}}, poke={p1:[],p2:[]}, brought={p1:new Set(),p2:new Set()}, lead={p1:[],p2:[]};
  const sets={}; // species -> {moves:Set, item, ability}
  const nick={}; // p1a: Pelipper -> species
  let winner=null;
  const touch=sp=>sets[sp]=sets[sp]||{moves:new Set(),item:null,ability:null};
  for(const l of text.split('\n')){ let m;
    if(m=l.match(/^\|player\|(p[12])\|([^|]*)\|[^|]*\|(\d*)/)){ P[m[1]]={name:m[2],rating:+m[3]||null,bot:isBot(m[2])}; }
    else if(m=l.match(/^\|poke\|(p[12])\|([^,|]+)/)){ poke[m[1]].push(norm(m[2])); }
    else if(m=l.match(/^\|(?:switch|drag|replace)\|(p[12])[ab]: ([^|]*)\|([^,|]+)/)){
      const side=m[1], sp=norm(m[3]); nick[m[1]+m[2]]=sp; brought[side].add(sp); touch(sp);
      if(lead[side].length<2&&!lead[side].includes(sp))lead[side].push(sp);
    }
    else if(m=l.match(/^\|move\|(p[12])[ab]: ([^|]*)\|([^|]+)/)){ const sp=nick[m[1]+m[2]]; if(sp){touch(sp);sets[sp].moves.add(m[3].trim());} }
    else if(m=l.match(/^\|-(?:item|enditem)\|(p[12])[ab]: ([^|]*)\|([^|]+)/)){ const sp=nick[m[1]+m[2]]; if(sp){touch(sp);sets[sp].item=m[3].trim();} }
    else if(m=l.match(/^\|-ability\|(p[12])[ab]: ([^|]*)\|([^|]+)/)){ const sp=nick[m[1]+m[2]]; if(sp){touch(sp);sets[sp].ability=m[3].trim();} }
    else if(m=l.match(/^\|win\|(.*)/)) winner=m[1].trim();
  }
  const setsOut={}; for(const k in sets) setsOut[k]={moves:[...sets[k].moves],item:sets[k].item,ability:sets[k].ability};
  return { id, date:new Date(uploadtime*1000).toISOString().slice(0,16).replace('T',' '),
    p1:P.p1, p2:P.p2, winner:winner||null,
    six:{p1:[...new Set(poke.p1)],p2:[...new Set(poke.p2)]},
    brought:{p1:[...brought.p1],p2:[...brought.p2]}, lead, sets:setsOut };
}
async function pool(items,fn,c){const out=[];let i=0;await Promise.all(Array.from({length:c},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k]);}}));return out;}

async function main(){
  const have=new Set();
  if(fs.existsSync(STORE)) for(const l of fs.readFileSync(STORE,'utf8').split('\n')) if(l.trim()){try{have.add(JSON.parse(l).id);}catch(e){}}
  let items=[];
  for(let p=1;p<=PAGES;p++){const j=await get(`https://replay.pokemonshowdown.com/search.json?format=${FORMAT}&page=${p}`);try{items.push(...JSON.parse(j));}catch(e){}}
  const seen=new Set(); items=items.filter(x=>!seen.has(x.id)&&seen.add(x.id)&&!have.has(x.id));
  process.stderr.write(`already stored: ${have.size}; new to fetch: ${items.length}\n`);
  const logs=await pool(items,x=>get(`https://replay.pokemonshowdown.com/${x.id}.log`).then(t=>[x,t]),CONC);
  const out=fs.createWriteStream(STORE,{flags:'a'}); let added=0;
  for(const [x,t] of logs){ if(!t)continue; const rec=extract(x.id,x.uploadtime,t);
    if(rec.six.p1.length<4||rec.six.p2.length<4)continue; out.write(JSON.stringify(rec)+'\n'); added++; }
  out.end();
  process.stderr.write(`appended ${added} games. store now ${have.size+added} total.\n`);
  // show ONE full record so the schema can be confirmed
  const sample=logs.map(([x,t])=>t&&extract(x.id,x.uploadtime,t)).find(r=>r&&r.sets&&Object.values(r.sets).some(s=>s.moves.length>=2));
  console.log('\n=== SAMPLE STORED RECORD ===');
  console.log(JSON.stringify(sample,null,1).slice(0,1500));
}
if(require.main===module) main();
module.exports={extract};
