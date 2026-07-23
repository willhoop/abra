/* ABRA — Automated Battle Replay Analyzer — durable, incremental, no-redo ingest.
 * Stores EVERY game's raw facts keyed by id (append-only, dedup).
 * Rating + bot tagged so any cutoff is a re-filter, never a re-pull.
 * Records observed moves/items/abilities per species AND a per-turn event
 * stream (move order -> speed, damage % -> observed rolls, faints, reveals).
 *
 * STORE RAW, ANALYSE ON TOP: this run also archives each raw .log to
 * data/raw-logs.jsonl so any NEW field is a re-parse (mode=reparse), never a
 * re-fetch. Re-pull the network at most once. */
const https=require('https'), fs=require('fs');
const FORMAT='gen9championsvgc2026regmb';
const PAGES=+(process.env.PAGES||2), CONC=+(process.env.CONC||16);
const STORE=process.argv[2]||'games.jsonl';
const RAW=process.env.RAW||(STORE.replace(/\.jsonl$/,'')+'.raw-logs.jsonl');
const MODE=process.env.MODE||'fetch'; // fetch | reparse
const get=u=>new Promise(r=>{const q=https.get(u,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(d));});q.on('error',()=>r(''));q.setTimeout(12000,()=>{q.destroy();r('');});});
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const isBot=n=>/^pcrlbot|bot\d|^[a-z]+bot$/i.test(n||'');

function extract(id, uploadtime, text){
  const P={p1:{},p2:{}}, poke={p1:[],p2:[]}, brought={p1:new Set(),p2:new Set()}, lead={p1:[],p2:[]};
  const sets={};           // species -> {moves:Set, item, ability}
  const nick={};           // 'p1a'+nickname -> species     (for move/reveal attribution)
  const slotSp={};         // 'p1a' -> species currently active
  const hp={};             // 'p1a' -> current HP % (0..100)
  const turns=[];          // per-turn event stream
  let cur=null, lastMove=null, winner=null;
  const touch=sp=>sets[sp]=sets[sp]||{moves:new Set(),item:null,ability:null};
  const flush=()=>{ if(cur&&cur.ev.length) turns.push(cur); };
  for(const l of text.split('\n')){ let m;
    if(m=l.match(/^\|player\|(p[12])\|([^|]*)\|[^|]*\|(\d*)/)){ P[m[1]]={name:m[2],rating:+m[3]||null,bot:isBot(m[2])}; }
    else if(m=l.match(/^\|poke\|(p[12])\|([^,|]+)/)){ poke[m[1]].push(norm(m[2])); }
    else if(m=l.match(/^\|turn\|(\d+)/)){ flush(); cur={n:+m[1],ev:[]}; }
    else if(m=l.match(/^\|(?:switch|drag|replace)\|(p[12][ab]): ([^|]*)\|([^,|]+)[^|]*(?:\|(\d+)\/(\d+))?/)){
      const slot=m[1], side=slot.slice(0,2), sp=norm(m[3]);
      nick[side+m[2]]=sp; slotSp[slot]=sp; hp[slot]=m[4]?Math.round(100*+m[4]/+m[5]):100;
      brought[side].add(sp); touch(sp);
      if(lead[side].length<2&&!lead[side].includes(sp))lead[side].push(sp);
      if(cur) cur.ev.push({t:'s',s:slot,mon:sp});
    }
    else if(m=l.match(/^\|move\|(p[12][ab]): ([^|]*)\|([^|]+)(?:\|(p[12][ab]):)?/)){
      const slot=m[1], side=slot.slice(0,2), sp=nick[side+m[2]]||slotSp[slot];
      if(sp){ touch(sp); sets[sp].moves.add(m[3].trim()); }
      lastMove={slot,sp,mv:m[3].trim(),tgt:m[4]||null,dmg:0};
      if(cur) cur.ev.push({t:'m',s:slot,mon:sp,mv:m[3].trim(),tgt:m[4]?slotSp[m[4]]:null,dmg:0});
    }
    else if(m=l.match(/^\|-damage\|(p[12][ab])[^|]*\|(\d+)\/(\d+)(.*)/)){
      const slot=m[1], nw=Math.round(100*+m[2]/+m[3]), was=hp[slot]==null?100:hp[slot];
      const delta=Math.max(0,was-nw); hp[slot]=nw;
      const residual=/\[from\]/.test(m[4]);
      if(!residual && cur && cur.ev.length){ // attribute to the just-used move
        const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e){ e.dmg=Math.max(e.dmg,delta); e.tgt=e.tgt||slotSp[slot]; }
      }
    }
    else if(m=l.match(/^\|-damage\|(p[12][ab])[^|]*\|0 fnt(.*)/)){
      const slot=m[1], was=hp[slot]==null?100:hp[slot]; hp[slot]=0;
      if(!/\[from\]/.test(m[2]) && cur){ const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e){ e.dmg=Math.max(e.dmg,was); e.ko=true; } }
    }
    else if(m=l.match(/^\|faint\|(p[12][ab])/)){ if(cur) cur.ev.push({t:'f',s:m[1],mon:slotSp[m[1]]}); }
    else if(m=l.match(/^\|-heal\|(p[12][ab])[^|]*\|(\d+)\/(\d+)/)){ hp[m[1]]=Math.round(100*+m[2]/+m[3]); }
    else if(m=l.match(/^\|-item\|(p[12][ab]): ([^|]*)\|([^|]+)/)){ const sp=slotSp[m[1]]; if(sp){touch(sp);sets[sp].item=m[3].trim();} }
    else if(m=l.match(/^\|-enditem\|(p[12][ab]): ([^|]*)\|([^|]+)/)){ const sp=slotSp[m[1]]; if(sp){touch(sp);sets[sp].item=sets[sp].item||m[3].trim();} }
    else if(m=l.match(/^\|-ability\|(p[12][ab]): ([^|]*)\|([^|]+)/)){ const sp=slotSp[m[1]]; if(sp){touch(sp);sets[sp].ability=m[3].trim();} }
    else if(m=l.match(/^\|-status\|(p[12][ab]): ([^|]*)\|([^|]+)/)){ if(cur) cur.ev.push({t:'x',s:m[1],mon:slotSp[m[1]],st:m[3].trim()}); }
    else if(m=l.match(/^\|win\|(.*)/)) winner=m[1].trim();
  }
  flush();
  const setsOut={}; for(const k in sets) setsOut[k]={moves:[...sets[k].moves],item:sets[k].item,ability:sets[k].ability};
  return { id, date:new Date(uploadtime*1000).toISOString().slice(0,16).replace('T',' '),
    p1:P.p1, p2:P.p2, winner:winner||null,
    six:{p1:[...new Set(poke.p1)],p2:[...new Set(poke.p2)]},
    brought:{p1:[...brought.p1],p2:[...brought.p2]}, lead, sets:setsOut, turns };
}
async function pool(items,fn,c){const out=[];let i=0;await Promise.all(Array.from({length:c},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k]);}}));return out;}

async function main(){
  // reparse mode: rebuild STORE from the raw-log archive, no network.
  if(MODE==='reparse'){
    if(!fs.existsSync(RAW)){ process.stderr.write(`no raw archive at ${RAW}; run a fetch first.\n`); return; }
    const tmp=STORE+'.tmp', out=fs.createWriteStream(tmp); let n=0;
    for(const l of fs.readFileSync(RAW,'utf8').split('\n')){ if(!l.trim())continue;
      let r; try{r=JSON.parse(l);}catch(e){continue;} const rec=extract(r.id,r.uploadtime,r.log);
      if(rec.six.p1.length<4||rec.six.p2.length<4)continue; out.write(JSON.stringify(rec)+'\n'); n++; }
    out.end(); out.on('finish',()=>{ fs.renameSync(tmp,STORE); process.stderr.write(`reparsed ${n} games from raw archive -> ${STORE}\n`); });
    return;
  }
  const have=new Set();
  if(fs.existsSync(STORE)) for(const l of fs.readFileSync(STORE,'utf8').split('\n')) if(l.trim()){try{have.add(JSON.parse(l).id);}catch(e){}}
  let items=[];
  for(let p=1;p<=PAGES;p++){const j=await get(`https://replay.pokemonshowdown.com/search.json?format=${FORMAT}&page=${p}`);try{items.push(...JSON.parse(j));}catch(e){}}
  const seen=new Set(); items=items.filter(x=>!seen.has(x.id)&&seen.add(x.id)&&!have.has(x.id));
  process.stderr.write(`already stored: ${have.size}; new to fetch: ${items.length}\n`);
  const logs=await pool(items,x=>get(`https://replay.pokemonshowdown.com/${x.id}.log`).then(t=>[x,t]),CONC);
  const out=fs.createWriteStream(STORE,{flags:'a'}), rawOut=fs.createWriteStream(RAW,{flags:'a'}); let added=0;
  for(const [x,t] of logs){ if(!t)continue; const rec=extract(x.id,x.uploadtime,t);
    if(rec.six.p1.length<4||rec.six.p2.length<4)continue;
    out.write(JSON.stringify(rec)+'\n'); rawOut.write(JSON.stringify({id:x.id,uploadtime:x.uploadtime,log:t})+'\n'); added++; }
  out.end(); rawOut.end();
  process.stderr.write(`appended ${added} games. store now ${have.size+added} total. raw archived -> ${RAW}\n`);
}
if(require.main===module) main();
module.exports={extract};
