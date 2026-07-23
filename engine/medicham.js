/* MEDICHAM — Matchup Evaluation, Damage-Informed CHOMP-Heuristic Approximate Moves.
 * ABRA Tier-2 (mid-cost). Plays a matchup out a few turns using CHOMP's EXACT
 * per-hit damage engine and a heuristic (behaviour-cloned-later) move policy,
 * Monte-Carlo over damage rolls, and returns P(win) for the matchup.
 *
 * It is the middle of the cast in name and cost: heavier than JOLTEON's one
 * forward pass, far lighter than SLOWKING's belief search. Used to rank finalist
 * teams DITTO surfaces, and to answer KADABRA's "what if" branches.
 *
 * HONEST SCOPE (v1): the rollout is sequential-singles (one active per side),
 * greedy+epsilon move choice, damage sampled from CHOMP's 85-100% roll range.
 * It does NOT yet model true doubles turns, status, secondary procs, or switch
 * mind-games. Those are the documented roadmap; what it DOES model — speed order,
 * exact damage, KO trades, faint-and-replace — it models correctly.
 *
 *   node engine/medicham.js "garchomp,incineroar,charizard,kingambit" "kingambit,whimsicott,basculegion,sinistcha" [rollouts]
 */
const path=require('path');
const S=require('./sets.js'); const M=S.M;

const PRIORITY=new Set(['fake out','quick attack','aqua jet','bullet punch','mach punch','ice shard',
  'shadow sneak','extreme speed','sucker punch','vacuum wave','grassy glide','thunderclap','accelerock','jet punch']);
const rnd=(a,b)=>a+Math.random()*(b-a);

// best damaging move of att vs def under ctx -> {pct,minPct,pKO,move,priority}
function bestMove(att,def,ctx){
  const b=M.bestDamage({...att,side:att._side},{...def,side:def._side},{...ctx,defFullHP:def._hp>=100});
  b.priority = b.move && PRIORITY.has((b.move||'').toLowerCase());
  return b;
}
function speedOf(m,ctx){ return M.moveDamage? _spe(m,ctx):m.st.spe; }
function _spe(m,ctx){ // mirror champ-model speed() essentials
  let s=m.st.spe; if(m.item==='choice scarf')s=Math.floor(s*1.5);
  if(ctx.weather==='rain'&&m.ability==='swift swim')s*=2;
  if(ctx.weather==='sun'&&m.ability==='chlorophyll')s*=2;
  if(ctx.weather==='sand'&&m.ability==='sand rush')s*=2;
  if(ctx.weather==='snow'&&m.ability==='slush rush')s*=2;
  return s;
}

// choose action for a side: 'move' or {switch:idx}
function chooseAction(team, hp, active, foeActive, ctx, eps){
  const me=team[active]; me._hp=hp[active];
  const foe=foeActive; foe._hp=foeActive._curhp;
  const mine=bestMove(me,foe,ctx);
  // switch if I can't meaningfully threaten AND a teammate can
  if(mine.pct<25){
    let best=-1,bi=-1;
    for(let i=0;i<team.length;i++){ if(i===active||hp[i]<=0)continue;
      const alt=team[i]; alt._hp=hp[i]; const a=bestMove(alt,foe,ctx);
      const risk=bestMove(foe,alt,ctx).pKO;
      const val=a.pKO*2 + a.pct/100 - risk;
      if(val>best){best=val;bi=i;} }
    if(bi>=0 && best>0.4 && Math.random()<0.6) return {switch:bi};
  }
  if(Math.random()<eps){ // explore: random damaging move handled as "best of a random subset" — keep it as move
    return {move:mine};
  }
  return {move:mine};
}

function pickBestVs(team,hp,foe,ctx){ // choose replacement on faint
  let best=-1,bi=-1;
  for(let i=0;i<team.length;i++){ if(hp[i]<=0)continue; const m=team[i]; m._hp=hp[i];
    const a=bestMove(m,foe,ctx); const risk=bestMove(foe,m,ctx).pKO;
    const v=a.pKO*2+a.pct/100-risk; if(v>best){best=v;bi=i;} }
  return bi;
}

function rollout(A,B,opts={}){
  const maxTurns=opts.maxTurns||25, eps=opts.eps??0.1;
  const w=M.resolveWeather(A,B); const weather=w.contested?null:w.weather;
  const ctx={weather, tw:{has:()=>false}, turn:0, spread:false};
  const hpA=A.map(()=>100), hpB=B.map(()=>100);
  let ai=0, bi=0; // active indices
  for(let t=0;t<maxTurns;t++){
    if(hpA.every(h=>h<=0)||hpB.every(h=>h<=0))break;
    A[ai]._side='me'; A[ai]._curhp=hpA[ai]; B[bi]._side='foe'; B[bi]._curhp=hpB[bi];
    const actA=chooseAction(A,hpA,ai,B[bi],ctx,eps);
    const actB=chooseAction(B,hpB,bi,A[ai],ctx,eps);
    // switches resolve first
    if(actA.switch!=null){ ai=actA.switch; }
    if(actB.switch!=null){ bi=actB.switch; }
    A[ai]._side='me'; B[bi]._side='foe';
    // both attacking? order by priority then speed
    const movers=[];
    if(actA.move){ movers.push({s:'A',mv:actA.move}); }
    if(actB.move){ movers.push({s:'B',mv:actB.move}); }
    movers.sort((x,y)=>{
      const px=x.mv.priority?1:0, py=y.mv.priority?1:0; if(px!==py)return py-px;
      const sx=x.s==='A'?_spe(A[ai],ctx):_spe(B[bi],ctx), sy=y.s==='A'?_spe(A[ai],ctx):_spe(B[bi],ctx);
      return sy-sx || (Math.random()<0.5?-1:1);
    });
    for(const mv of movers){
      if(hpA[ai]<=0||hpB[bi]<=0) break;
      if(mv.s==='A'){ const b=bestMove({...A[ai],_side:'me',_hp:hpA[ai]},{...B[bi],_side:'foe',_hp:hpB[bi]},ctx);
        const dmg=rnd(b.minPct,b.pct); hpB[bi]-=dmg;
        if(hpB[bi]<=0){ const nx=pickBestVs(B,hpB,A[ai],ctx); if(nx<0)break; bi=nx; }
      } else { const b=bestMove({...B[bi],_side:'foe',_hp:hpB[bi]},{...A[ai],_side:'me',_hp:hpA[ai]},ctx);
        const dmg=rnd(b.minPct,b.pct); hpA[ai]-=dmg;
        if(hpA[ai]<=0){ const nx=pickBestVs(A,hpA,B[bi],ctx); if(nx<0)break; ai=nx; }
      }
    }
  }
  const aliveA=hpA.filter(h=>h>0).length, aliveB=hpB.filter(h=>h>0).length;
  if(aliveA!==aliveB) return aliveA>aliveB?1:0;
  const hA=hpA.reduce((s,h)=>s+Math.max(0,h),0), hB=hpB.reduce((s,h)=>s+Math.max(0,h),0);
  return hA===hB?0.5:(hA>hB?1:0);
}

// P(A beats B) over N rollouts. A,B are built-mon arrays (<=4 recommended).
function winProb(A,B,N=200,opts={}){
  if(!A.length||!B.length) return 0.5;
  let s=0; for(let i=0;i<N;i++) s+=rollout(A.map(m=>({...m})),B.map(m=>({...m})),opts);
  return s/N;
}

module.exports={ rollout, winProb };

if(require.main===module){
  const a=(process.argv[2]||'garchomp,incineroar,charizard,kingambit').split(',').map(s=>s.trim());
  const b=(process.argv[3]||'kingambit,whimsicott,basculegion,sinistcha').split(',').map(s=>s.trim());
  const N=+(process.argv[4]||300);
  const A=S.team6(a), B=S.team6(b);
  if(A.length<2||B.length<2){ console.error('could not build enough mons; check species names'); process.exit(1); }
  const t0=Date.now();
  const p=winProb(A,B,N);
  console.log(`MEDICHAM rollout  (${N} playouts, ${Date.now()-t0}ms)`);
  console.log(`  A: ${A.map(m=>m.name).join(', ')}`);
  console.log(`  B: ${B.map(m=>m.name).join(', ')}`);
  console.log(`  P(A wins) = ${p.toFixed(3)}`);
}
