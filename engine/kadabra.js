/* KADABRA — Key Analysis of Decisions, Advice & Better Replay Annotation.
 * The interactive coaching front-end of ABRA (spec: docs/KADABRA-coach-spec.md).
 *
 * v1 ENGINE: walks a single Champions replay turn by turn, reconstructs each
 * scene from the per-turn event stream, and annotates it with grounded reads:
 *   - SPEED  : who moved first (from move order) -> the real speed picture
 *   - DAMAGE : exact % each hit took, cross-checked against ABRA's observed
 *              roll for that (attacker, move) from the dynamics model
 *   - TEMPO  : KOs, faints, and momentum swings, with a coaching note per turn
 * Then it background-appends the game to the durable store (the flywheel from
 * the coaching seat).
 *
 * This is the turn-by-turn engine the chatbot UI wraps; the conversational
 * "ask a question, then advance" loop and rendered board are the roadmap
 * (see the spec). Deep equilibrium advice arrives with SLOWKING; v1's reads are
 * exact-damage + observed-data grounded and already actionable.
 *
 *   node engine/kadabra.js <replayId|url> [meName]
 */
const https=require('https'), fs=require('fs'), path=require('path');
const { extract } = require('./durable-ingest.js');
const idn=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const get=u=>new Promise(r=>{https.get(u,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(d));}).on('error',()=>r(''));});

let DYN={speed:{},damage:{}}; try{ DYN=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/dynamics.json'),'utf8')); }catch(e){}
let META={}; try{ (JSON.parse(fs.readFileSync(path.join(__dirname,'../data/meta-usage.json'),'utf8')).threats||[]).forEach(t=>META[t.sp]=t); }catch(e){}
const dmgKey=(sp,mv)=>sp+'|'+idn(mv);
const cap=s=>(s||'').charAt(0).toUpperCase()+(s||'').slice(1);

function coachTurn(t, hp, meSide){
  const lines=[]; const foeSide=meSide==='p1'?'p2':'p1';
  const S=x=>x.slice(0,2); // 'p1a'->'p1'
  // switches
  for(const e of t.ev.filter(e=>e.t==='s')) lines.push(`   ${S(e.s)===meSide?'you':'they'} sent in ${cap(e.mon)}`);
  const moves=t.ev.filter(e=>e.t==='m');
  // SPEED read: first cross-side pair
  const cross=moves.filter(m=>m.mon);
  if(cross.length>=2){
    const first=cross[0], second=cross.find(m=>S(m.s)!==S(first.s));
    if(second){
      const youFirst=S(first.s)===meSide;
      lines.push(`   speed: ${cap(first.mon)} moved before ${cap(second.mon)} — ${youFirst?'you were faster':'they were faster'}`);
    }
  }
  // DAMAGE reads with dynamics cross-check
  for(const m of moves){ if(!(m.dmg>0))continue;
    const who=S(m.s)===meSide?'your':'their';
    const obs=DYN.damage[dmgKey(m.mon,m.mv)];
    const norm=obs?`  (ladder avg ${obs.mean}% for ${cap(m.mon)} ${m.mv}; you saw ${m.dmg}%${m.dmg>=obs.p90?' — high roll':m.dmg<=obs.mean-obs.mean*0.2?' — low roll':''})`:'';
    lines.push(`   ${who} ${cap(m.mon)} ${m.mv} -> ${m.dmg}%${m.ko?' KO':''}${norm}`);
  }
  // faints + coaching note
  const faints=t.ev.filter(e=>e.t==='f');
  for(const f of faints){ lines.push(`   ${S(f.s)===meSide?'you lost':'you KO’d their'} ${cap(f.mon)}`); }
  return lines;
}

(async()=>{
  const arg=process.argv[2]; if(!arg){ console.log('usage: node engine/kadabra.js <replayId|url> [meName]'); process.exit(1); }
  const ME=idn(process.argv[3]||'willhoop');
  const bare=arg.replace(/^https?:\/\/[^/]+\//,'').replace(/\.log$/,'');
  const text=await get(`https://replay.pokemonshowdown.com/${bare}.log`);
  if(!text){ console.log('could not fetch replay'); process.exit(1); }
  const tm=(text.match(/\|t:\|(\d+)/)||[])[1];
  const r=extract(bare,+tm||0,text);
  let meSide=idn(r.p1.name)===ME?'p1':(idn(r.p2.name)===ME?'p2':'p1');
  const foeSide=meSide==='p1'?'p2':'p1';
  const won=r.winner&&idn(r.winner)===idn(r[meSide].name);

  // ---- JSON scenes for the Showdown-style renderer ----
  if(process.argv.includes('--json')){
    const SS=sl=>sl.slice(0,2), II=sl=>sl.endsWith('b')?1:0;
    const hp={}, status={}, active={p1:[],p2:[]};
    for(const s of ['p1','p2']) (r.lead[s]||[]).slice(0,2).forEach((sp,i)=>{active[s][i]=sp; hp[s+(i?'b':'a')]=100;});
    const scenes=[];
    for(const t of r.turns){
      const snap=side=>active[side].map((sp,i)=>({sp,hp:Math.max(0,Math.round(hp[side+(i?'b':'a')]??100)),st:status[side+(i?'b':'a')]||null}));
      const you=snap(meSide), foe=snap(foeSide), acts=[], log=[], faints=[]; const speedPair=[];
      for(const e of t.ev){
        if(e.t==='s'){ active[SS(e.s)][II(e.s)]=e.mon; hp[e.s]=hp[e.s]??100;
          acts.push({type:'switch',side:SS(e.s)===meSide?'you':'foe',mon:e.mon}); log.push(`${SS(e.s)===meSide?'You':'They'} sent out ${cap(e.mon)}.`); }
        else if(e.t==='m'){ if(e.mon) active[SS(e.s)][II(e.s)]=e.mon;
          const obs=DYN.damage[e.mon+'|'+idn(e.mv)];
          const roll = (e.dmg>0&&obs)?(e.dmg>=obs.p90?'high':(e.dmg<=obs.mean-obs.mean*0.2?'low':'')):'';
          acts.push({type:'move',side:SS(e.s)===meSide?'you':'foe',mon:e.mon,mv:e.mv,dmg:e.dmg||0,ko:!!e.ko,avg:obs?obs.mean:null,roll,tgt:e.tgt||null});
          log.push(`${cap(e.mon)} used ${e.mv}!${e.dmg?` (−${e.dmg}%)`:''}`);
          if(e.mon) speedPair.push({side:SS(e.s)===meSide?'you':'foe',mon:e.mon}); }
        else if(e.t==='x'){ status[e.s]=e.st; log.push(`${cap(active[SS(e.s)][II(e.s)]||'?')} was ${e.st}.`); }
        else if(e.t==='f'){ hp[e.s]=0; const m=active[SS(e.s)][II(e.s)]; faints.push({side:SS(e.s)===meSide?'you':'foe',mon:m}); log.push(`${cap(m||'?')} fainted!`); }
      }
      for(const e of t.ev){ if(e.t==='m'&&e.tgt&&e.dmg>0){ for(const sl of ['p1a','p1b','p2a','p2b']) if(active[SS(sl)][II(sl)]===e.tgt){ hp[sl]=Math.max(0,(hp[sl]??100)-e.dmg); break; } } }
      // ---- pick the RELEVANT turns and write the lesson KADABRA pops up with ----
      const cross=speedPair.length>=2?speedPair[0]:null;
      const bigOnYou=acts.filter(a=>a.type==='move'&&a.side==='foe'&&a.dmg>=55).sort((a,b)=>b.dmg-a.dmg)[0];
      const yourKO=acts.find(a=>a.type==='move'&&a.side==='you'&&a.ko);
      const youLost=faints.filter(f=>f.side==='you');
      let key=false, kind='', coach='';
      if(youLost.length){ key=true; kind='loss'; coach=`You lost ${cap(youLost[0].mon)} here — this is the turn the game swung. Look one move earlier: was there a switch that kept it alive, or a faster answer to what took it out?`; }
      else if(bigOnYou){ key=true; kind='threat'; coach=`Their ${cap(bigOnYou.mon)} hit ${bigOnYou.tgt?cap(bigOnYou.tgt):'you'} with ${bigOnYou.mv} for ${bigOnYou.dmg}%${bigOnYou.roll==='high'?' — a high roll':''}. Bring a resist or click Protect into that next time instead of trading into it.`; }
      else if(yourKO){ key=true; kind='good'; coach=`Nice tempo — your ${cap(yourKO.mon)} took out ${yourKO.tgt?cap(yourKO.tgt):'their mon'}. Keep pressing while you're ahead.`; }
      let note='';
      if(cross) note=`${cap(cross.mon)} moved first — ${cross.side==='you'?'you were faster':'they were faster'}.`;
      scenes.push({n:t.n, you, foe, acts, log, note, key, kind, coach});
    }
    console.log(JSON.stringify({result:won?'WIN':'LOSS', me:r[meSide].name, foe:r[foeSide].name,
      six:r.six[foeSide], meLed:r.lead[meSide], foeLed:r.lead[foeSide], scenes}));
    return;
  }

  console.log(`\n╔══ KADABRA — coaching ${r[meSide].name} vs ${r[foeSide].name} ══`);
  console.log(`║ result: ${won?'WIN':'LOSS'}  ·  ${r.turns.length} turns logged`);
  console.log(`║ you led ${r.lead[meSide].map(cap).join(' + ')}  vs  ${r.lead[foeSide].map(cap).join(' + ')}`);
  // opponent six with meta context (the read going in)
  console.log(`║ their six:`);
  for(const sp of r.six[foeSide]){ const m=META[sp]; const spd=DYN.speed[sp];
    const tag=[m?`${(100*m.bringRate).toFixed(0)}% bring`:null, spd?`speed ${(100*spd.firstRate).toFixed(0)}%${spd.scarfHint?' scarf?':''}`:null].filter(Boolean).join(', ');
    console.log(`║   ${cap(sp).padEnd(15)} ${tag||''}`); }
  console.log(`╚${'═'.repeat(46)}`);

  const hp={};
  for(const t of r.turns){
    console.log(`\n── turn ${t.n} ──`);
    for(const line of coachTurn(t,hp,meSide)) console.log(line);
  }

  // headline lesson
  console.log(`\n── the lesson ──`);
  const bigHits=r.turns.flatMap(t=>t.ev).filter(e=>e.t==='m'&&e.mon&&r.six[foeSide].includes(e.mon)&&e.dmg>=70);
  if(bigHits.length){ const h=bigHits[0]; console.log(`   biggest threat: their ${cap(h.mon)} ${h.mv} hit for ${h.dmg}% — prep a switch-in or faster answer next time.`); }
  const yourFaints=r.turns.flatMap(t=>t.ev).filter(e=>e.t==='f'&&e.s.slice(0,2)===meSide).length;
  console.log(`   you lost ${yourFaints} of your brought Pokémon. ${won?'Closed it out — good.':'Focus the review on the turn a KO race flipped.'}`);
  console.log(`\n[flywheel] this replay is appended to data/games.ladder.jsonl (dedup) and folded into the models.`);

  // background ingest — dedup append (the coaching seat feeds the store)
  try{
    const store=path.join(__dirname,'../data/games.ladder.jsonl');
    const have=new Set(); if(fs.existsSync(store)) for(const l of fs.readFileSync(store,'utf8').split('\n')) if(l.trim()){try{have.add(JSON.parse(l).id);}catch(e){}}
    if(!have.has(r.id)&&r.six.p1.length>=4&&r.six.p2.length>=4){ fs.appendFileSync(store,JSON.stringify(r)+'\n'); console.log('[flywheel] appended (new game).'); }
    else console.log('[flywheel] already in store — no dupe.');
  }catch(e){ console.log('[flywheel] store append skipped:',e.message); }
})();
