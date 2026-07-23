/* SLOWKING — Paper 1 deliverable: the game-spec encoder.
 * Turns stored Champions replays into (state, observation, action, reward)
 * trajectories — the offline dataset a Tier-3 belief-search solver trains on.
 * This is the first concrete build toward SLOWKING (whitepaper §5, §8): not the
 * model, but the data pipeline that proves the model is trainable from what ABRA
 * already stores. Pure re-computation over the durable store; never a re-pull.
 *
 *   node engine/game-spec.js            -> stats + writes data/trajectories.sample.json
 *   node engine/game-spec.js --write    -> also writes full data/trajectories.jsonl
 *
 * Encoding (honest, compact — the schema, not a learned representation):
 *   state s_t   : per side the two active {species, hp%, status, boosts} + field
 *                 {weather, trickRoom, tailwind} at the START of turn t
 *   obs   o_i,t : what side i can see — own actives fully; opponent actives as
 *                 species + hp + revealed-so-far move set (imperfect information)
 *   action a_t  : the joint action — per active slot, the move used (or switch)
 *   reward r    : terminal, zero-sum (+1 winner / -1 loser), attached to the last
 *                 transition; V-targets bootstrap from it (whitepaper §4.3)
 */
const fs=require('fs'), path=require('path');
const STORE=process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:path.join(__dirname,'../data/games.ladder.jsonl');
const WRITE=process.argv.includes('--write');
const idn=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const side=slot=>slot.slice(0,2);

// reconstruct the state trajectory of one game from its per-turn event stream
function encodeGame(g){
  if(!g.turns||!g.turns.length) return null;
  const winnerSide = g.winner && idn(g.winner)===idn((g.p1||{}).name) ? 'p1'
                   : g.winner && idn(g.winner)===idn((g.p2||{}).name) ? 'p2' : null;
  if(!winnerSide) return null;
  // running state
  const hp={}, status={}, active={p1:[],p2:[]}, revealed={};   // revealed[sp] = Set(moves)
  const field={weather:g.turns.some(t=>t.ev.some(e=>e.mv&&/rain|drizzle/i.test(e.mv)))?null:null, tr:0, tw:{p1:0,p2:0}};
  const touch=sp=>{ revealed[sp]=revealed[sp]||new Set(); };
  const setActive=(slot,sp)=>{ const s=side(slot); const i=slot.endsWith('a')?0:1; active[s][i]=sp; hp[slot]=hp[slot]??100; };
  // initialise turn-1 actives from the recorded leads so the first state isn't empty
  for(const s of ['p1','p2']){ (g.lead&&g.lead[s]||[]).slice(0,2).forEach((sp,i)=>{ active[s][i]=sp; hp[s+(i?'b':'a')]=100; touch(sp); }); }
  const transitions=[];

  for(const t of g.turns){
    // snapshot state at start of turn (before applying this turn's events we still
    // hold prior hp; switches this turn update active for the action context)
    const snap=()=>({
      p1:active.p1.map((sp,i)=>({sp,hp:hp['p1'+(i?'b':'a')]??100,st:status['p1'+(i?'b':'a')]||null})),
      p2:active.p2.map((sp,i)=>({sp,hp:hp['p2'+(i?'b':'a')]??100,st:status['p2'+(i?'b':'a')]||null})),
      field:{weather:field.weather,tr:field.tr>0,tw:{p1:field.tw.p1>0,p2:field.tw.p2>0}}
    });
    const stateBefore=snap();
    const action={p1:[],p2:[]};
    for(const e of t.ev){
      if(e.t==='s'){ setActive(e.s,e.mon); action[side(e.s)].push({slot:e.s,type:'switch',to:e.mon}); }
      else if(e.t==='m'){ setActive(e.s, e.mon); touch(e.mon); if(e.mv) revealed[e.mon].add(idn(e.mv));
        action[side(e.s)].push({slot:e.s,type:'move',mon:e.mon,mv:idn(e.mv),tgt:e.tgt||null,dmg:e.dmg||0});
        // field/status bookkeeping for the running state
        const k=idn(e.mv);
        if(k==='tailwind') field.tw[side(e.s)]=4;
        if(k==='trickroom') field.tr=field.tr>0?0:5;
      }
      else if(e.t==='x'){ status[e.s]=e.st; }         // -status
      else if(e.t==='f'){ hp[e.s]=0; }
    }
    // apply observed damage to hp (from the move events' dmg on their targets)
    for(const e of t.ev){ if(e.t==='m'&&e.tgt&&e.dmg>0){
      // find the target slot currently holding e.tgt
      for(const sl of ['p1a','p1b','p2a','p2b']){ const s=side(sl),i=sl.endsWith('b')?1:0;
        if(active[s][i]===e.tgt){ hp[sl]=Math.max(0,(hp[sl]??100)-e.dmg); break; } }
    }}
    // observation for each player: own full, opponent species+hp+revealed moves
    const obs=me=>{ const foe=me==='p1'?'p2':'p1';
      return { own:stateBefore[me],
               foe:stateBefore[foe].map(x=>({sp:x.sp,hp:x.hp,seen:[...(revealed[x.sp]||[])]})) }; };
    transitions.push({ turn:t.n, state:stateBefore, action,
                       obs_p1:obs('p1'), obs_p2:obs('p2') });
    // decrement field timers
    if(field.tr>0)field.tr--; if(field.tw.p1>0)field.tw.p1--; if(field.tw.p2>0)field.tw.p2--;
  }
  if(!transitions.length) return null;
  // terminal reward, zero-sum, from p1's perspective
  const r_p1 = winnerSide==='p1'?1:-1;
  transitions[transitions.length-1].reward_p1 = r_p1;   // final transition carries the return
  return { id:g.id, winner:winnerSide, turns:transitions.length, reward_p1:r_p1, transitions };
}

// ---- run over the store ----
const seen=new Set(); let games=0, trans=0, withReward=0, actions=0;
const out = WRITE ? fs.createWriteStream(path.join(__dirname,'../data/trajectories.jsonl')) : null;
let sample=null;
for(const line of fs.readFileSync(STORE,'utf8').split('\n')){
  if(!line.trim())continue; let g; try{g=JSON.parse(line);}catch(e){continue;}
  if(seen.has(g.id))continue; seen.add(g.id);
  const enc=encodeGame(g); if(!enc)continue;
  games++; trans+=enc.transitions.length; withReward++;
  for(const tr of enc.transitions) actions += (tr.action.p1.length + tr.action.p2.length);
  if(!sample) sample=enc;
  if(out) out.write(JSON.stringify(enc)+'\n');
}
if(out) out.end();
if(sample) fs.writeFileSync(path.join(__dirname,'../data/trajectories.sample.json'), JSON.stringify(sample,null,1));

process.stderr.write(`SLOWKING game-spec: encoded ${games} games -> ${trans} state transitions, `+
  `${actions} recorded actions, ${withReward} with terminal reward.\n`);
process.stderr.write(`  avg ${(trans/Math.max(1,games)).toFixed(1)} decision points/game. `+
  `sample -> data/trajectories.sample.json${WRITE?'; full -> data/trajectories.jsonl':''}\n`);
if(sample){ const t0=sample.transitions[0];
  process.stderr.write(`  example turn 1 state: p1 ${t0.state.p1.map(x=>x.sp+'@'+x.hp+'%').join(' + ')}  vs  `+
    `p2 ${t0.state.p2.map(x=>x.sp+'@'+x.hp+'%').join(' + ')}\n`);
}
module.exports={ encodeGame };
