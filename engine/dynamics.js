/* ABRA dynamics model — turns the per-turn event stream into observed physics.
 *
 * Two signals the raw usage model cannot see, both asked for directly:
 *   1. SPEED  — who moved first. In every non-priority, non-Trick-Room move
 *      exchange between the two sides, the mon that resolved first is faster.
 *      Aggregated per species -> an EMPIRICAL speed rank, and a Choice-Scarf
 *      flag when a mon outspeeds things its base stat says it shouldn't.
 *   2. DAMAGE — the exact % each move actually took off, per (attacker, move):
 *      the observed roll distribution. Grounds MEDICHAM's rollouts and lets us
 *      sanity-check CHOMP's calculator against reality.
 *
 * Reads the durable store (which already carries turns); writes data/dynamics.json.
 * Pure re-computation over stored data — never a re-pull. */
const fs=require('fs'), path=require('path');
const STORE=process.argv[2]||path.join(__dirname,'../data/games.ladder.jsonl');
const OUT=process.argv[3]||path.join(__dirname,'../data/dynamics.json');
const CHOMP=path.join(__dirname,'../../CHOMP/engine/champ-model.js');

// base speeds from CHOMP's validated stat table (optional — degrade gracefully)
let BASE={}; try{ const M=require(CHOMP); for(const k in M.MONS) BASE[k]=M.MONS[k].bs.spe; }catch(e){ process.stderr.write('note: base speeds unavailable ('+e.message+')\n'); }

// priority moves excluded from the speed signal (they resolve out of speed order)
const PRIORITY=new Set(['fakeout','quickattack','aquajet','bulletpunch','machpunch','iceshard','shadowsneak',
  'extremespeed','suckerpunch','vacuumwave','grassyglide','thunderclap','iceball','feint','firstimpression',
  'accelerock','jetpunch','waterspout','pursuit','uproar','followme','ragepowder','protect','detect',
  'wideguard','quickguard','allyswitch','helpinghand','tailwind','trickroom']);
const key=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

const spd={};   // sp -> {first,total}
const dmg={};   // 'sp|move' -> {n,sum,max,rolls:[]}
let games=0, nonTR=0;

function side(slot){ return slot.slice(0,2); }
for(const line of fs.readFileSync(STORE,'utf8').split('\n')){
  if(!line.trim())continue; let r; try{r=JSON.parse(line);}catch(e){continue;}
  const turns=r.turns||[]; if(!turns.length)continue; games++;
  // Trick Room active? (crude but safe: any use of Trick Room in the game -> drop from speed signal)
  const hasTR=turns.some(t=>t.ev.some(e=>e.t==='m'&&key(e.mv)==='trickroom'));
  if(!hasTR) nonTR++;
  for(const t of turns){
    const moves=t.ev.filter(e=>e.t==='m');
    // SPEED: first cross-side non-priority move pair in the turn
    if(!hasTR){
      const np=moves.filter(e=>e.mon&&!PRIORITY.has(key(e.mv)));
      for(let i=0;i<np.length;i++){
        for(let j=i+1;j<np.length;j++){
          if(side(np[i].s)===side(np[j].s))continue; // need opposite sides
          const fast=np[i].mon, slow=np[j].mon;      // i resolved earlier => faster
          spd[fast]=spd[fast]||{first:0,total:0}; spd[slow]=spd[slow]||{first:0,total:0};
          spd[fast].first++; spd[fast].total++; spd[slow].total++;
          break; // only the first cross-side pair per turn (cleanest signal)
        }
        if(np.slice(i+1).some(x=>side(x.s)!==side(np[i].s)))break;
      }
    }
    // DAMAGE: observed % per (attacker, move)
    for(const e of moves){ if(!e.mon||!e.mv||!(e.dmg>0))continue;
      const k=e.mon+'|'+key(e.mv); dmg[k]=dmg[k]||{n:0,sum:0,max:0,rolls:[]};
      dmg[k].n++; dmg[k].sum+=e.dmg; if(e.dmg>dmg[k].max)dmg[k].max=e.dmg;
      if(dmg[k].rolls.length<200)dmg[k].rolls.push(e.dmg);
    }
  }
}

// finalize speed: rate + scarf flag (fast beyond base-speed peers)
const speed={};
const ranked=Object.keys(spd).filter(s=>spd[s].total>=8)
  .map(s=>({s,rate:spd[s].first/spd[s].total,base:BASE[s]??null,n:spd[s].total}))
  .sort((a,b)=>b.rate-a.rate);
for(const r of ranked){
  // scarf hint: high observed first-rate but only mid base speed
  const scarf = r.base!=null && r.rate>=0.75 && r.base<=95;
  speed[r.s]={firstRate:+r.rate.toFixed(3), n:r.n, baseSpe:r.base, scarfHint:scarf};
}
// finalize damage
const damage={};
for(const k in dmg){ const d=dmg[k]; if(d.n<3)continue;
  const rs=d.rolls.slice().sort((a,b)=>a-b); const p90=rs[Math.min(rs.length-1,Math.floor(rs.length*0.9))];
  damage[k]={n:d.n, mean:+(d.sum/d.n).toFixed(1), max:d.max, p90};
}
const outObj={generated:new Date().toISOString().slice(0,10), games, nonTRgames:nonTR,
  speciesWithSpeed:Object.keys(speed).length, attackerMovePairs:Object.keys(damage).length,
  speed, damage};
fs.writeFileSync(OUT, JSON.stringify(outObj,null,0));
process.stderr.write(`dynamics: ${games} games (${nonTR} non-TR) -> ${Object.keys(speed).length} speed profiles, ${Object.keys(damage).length} attacker|move damage profiles -> ${OUT}\n`);
// quick human readout
const top=ranked.slice(0,12).map(r=>`${r.s}(${(r.rate*100).toFixed(0)}%${speed[r.s].scarfHint?' scarf?':''})`);
process.stderr.write('fastest observed: '+top.join(', ')+'\n');
module.exports={};
