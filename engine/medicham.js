/* MEDICHAM — Matchup Evaluation, Damage-Informed CHOMP-Heuristic Approximate Moves.
 * ABRA Tier-2 (mid-cost). Plays a matchup out a few turns with CHOMP's EXACT
 * per-hit damage, Monte-Carlo over damage rolls, and returns P(win).
 *
 * v2 — BEHAVIOUR-CLONED policy + status/field effects. The rollout no longer only
 * clicks max damage: each turn it samples WHAT KIND of move to make from the
 * behaviour-clone (data/move-priors.json — what real players actually click with
 * that species), and it APPLIES the effects that decide Champions games:
 *   - speed control : Tailwind doubles your speed; Trick Room inverts the order
 *   - status        : sleep skips turns, burn halves physical, paralysis 1/4 speed
 *   - setup         : Swords Dance / Nasty Plot / Dragon Dance raise later damage
 *   - protect       : eats a turn of damage
 * So speed control and setup are now VALUED emergently — a Tailwind lead wins more
 * rollouts because it actually moves first. Attacks always use CHOMP's exact best
 * damage; the behaviour-clone only decides attack-vs-support.
 *
 * HONEST SCOPE: still sequential-singles (one active per side); doubles-only
 * tactics (redirection, spread, position) are roadmap. What it models it models
 * correctly, and it now models the non-damage moves that were invisible in v1.
 *
 *   node engine/medicham.js "garchomp,incineroar,charizard,kingambit" "pelipper,whimsicott,basculegion,sinistcha" [rollouts]
 */
const path=require('path'), fs=require('fs');
const S=require('./sets.js'); const M=S.M;
const { classify } = require('./moves-meta.js');

let PRIORS={species:{}}; try{ PRIORS=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/move-priors.json'),'utf8')); }catch(e){}
const PRIORITY=new Set(['fake out','quick attack','aqua jet','bullet punch','mach punch','ice shard',
  'shadow sneak','extreme speed','sucker punch','vacuum wave','grassy glide','thunderclap','accelerock','jet punch']);
const rnd=(a,b)=>a+Math.random()*(b-a);
const stageMul=st=>st>=0?(2+st)/2:2/(2-st);

function bestMove(att,def,ctx){
  const b=M.bestDamage({...att,side:att._side},{...def,side:def._side},{...ctx,defFullHP:def._hp>=100});
  b.priority = b.move && PRIORITY.has((b.move||'').toLowerCase());
  return b;
}
function isPhysical(m){ return (m.st?m.st.atk:m.bs?m.bs.atk:100) >= (m.st?m.st.spa:m.bs?m.bs.spa:100); }
function _spe(m,ctx){ let s=m.st.spe; if(m.item==='choice scarf')s=Math.floor(s*1.5);
  if(ctx.weather==='rain'&&m.ability==='swift swim')s*=2; if(ctx.weather==='sun'&&m.ability==='chlorophyll')s*=2;
  if(ctx.weather==='sand'&&m.ability==='sand rush')s*=2; if(ctx.weather==='snow'&&m.ability==='slush rush')s*=2; return s; }
// effective speed with field + status + boosts
function effSpeed(m,ctx,side,st){
  let s=_spe(m,ctx)*stageMul(st.boost.spe||0);
  if(st.field['tw'+side]>0) s*=2;
  if(st.status==='par') s*=0.25;
  return s;
}

// sample the KIND of action from the behaviour-clone; attacks always use best damage.
function chooseAction(team, hp, active, foeActive, ctx, sideState, turnNo, field){
  const me=team[active]; me._hp=hp[active];
  const stMe=sideState[active];
  if(stMe.status==='slp' && stMe.slp>0) return {kind:'sleep'};   // skip, handled in resolve
  const foe=foeActive; const mine=bestMove(me,foe,ctx);
  // clearly outmatched -> maybe switch to a better answer
  if(mine.pct<25){
    let best=-1,bi=-1;
    for(let i=0;i<team.length;i++){ if(i===active||hp[i]<=0)continue; const alt=team[i]; alt._hp=hp[i];
      const a=bestMove(alt,foe,ctx); const risk=bestMove(foe,alt,ctx).pKO; const v=a.pKO*2+a.pct/100-risk; if(v>best){best=v;bi=i;} }
    if(bi>=0 && best>0.4 && Math.random()<0.55) return {kind:'switch',idx:bi};
  }
  // behaviour-clone: what does this species actually do here?
  const pr=(process.env.MEDICHAM_BC==='0')?null:PRIORS.species[me.key];
  if(pr){
    const dist=(turnNo===0 && pr.lead && pr.lead.length)?pr.lead:pr.moves;
    let r=Math.random(), pick=null;
    for(const m of dist){ r-=m.p; if(r<=0){ pick=m; break; } }
    if(pick){
      const c=classify(pick.mv), side=me._side==='me'?'A':'B';
      if(c.kind==='setup' && Math.max(...Object.values(c.boosts))<=2){
        const cur=stMe.boost; const cap=Object.values(c.boosts).some(v=>v>0 && (cur.atk>=4||cur.spa>=4||cur.spe>=4));
        if(!cap) return {kind:'setup',boosts:c.boosts};
      }
      if(c.kind==='speed'){
        if(c.effect==='tailwind' && field['tw'+side]<=0) return {kind:'tailwind',side};
        if(c.effect==='trickroom') return {kind:'trickroom'};
        if(c.effect==='lowerspe') return {kind:'lowerspe'};
      }
      if(c.kind==='status' && !foeActive._status) return {kind:'status',effect:c.effect};
      if(c.kind==='protect' && !stMe.protLast && Math.random()<0.8) return {kind:'protect'};
    }
  }
  return {kind:'attack'};
}
function pickBestVs(team,hp,foe,ctx){ let best=-1,bi=-1;
  for(let i=0;i<team.length;i++){ if(hp[i]<=0)continue; const m=team[i]; m._hp=hp[i];
    const a=bestMove(m,foe,ctx); const risk=bestMove(foe,m,ctx).pKO; const v=a.pKO*2+a.pct/100-risk; if(v>best){best=v;bi=i;} }
  return bi; }

function rollout(A,B,opts={}){
  const maxTurns=opts.maxTurns||24;
  const w=M.resolveWeather(A,B); const weather=w.contested?null:w.weather;
  const ctx={weather, tw:{has:()=>false}, turn:0, spread:false};
  const hpA=A.map(()=>100), hpB=B.map(()=>100);
  const field={twA:0,twB:0,tr:0};
  const mk=n=>Array.from({length:n},()=>({status:null,slp:0,brn:0,boost:{atk:0,spa:0,spe:0},protLast:false,field}));
  const sA=mk(A.length), sB=mk(B.length);
  let ai=0, bi=0;
  const setActive=()=>{ A[ai]._side='me'; A[ai]._curhp=hpA[ai]; A[ai]._status=sA[ai].status;
                        B[bi]._side='foe'; B[bi]._curhp=hpB[bi]; B[bi]._status=sB[bi].status; };
  for(let t=0;t<maxTurns;t++){
    if(hpA.every(h=>h<=0)||hpB.every(h=>h<=0))break;
    setActive();
    const actA=chooseAction(A,hpA,ai,B[bi],ctx,sA,t,field);
    const actB=chooseAction(B,hpB,bi,A[ai],ctx,sB,t,field);
    if(actA.kind==='switch'){ ai=actA.idx; sA[ai].boost={atk:0,spa:0,spe:0}; }
    if(actB.kind==='switch'){ bi=actB.idx; sB[bi].boost={atk:0,spa:0,spe:0}; }
    setActive();
    // clear protect from last turn, set this turn's
    sA[ai].protThis=(actA.kind==='protect'); sB[bi].protThis=(actB.kind==='protect');
    // apply non-attack, non-order-sensitive effects immediately (setup, field, status)
    const applySupport=(act,stSelf,stFoeArr,foeIdx,side)=>{
      if(act.kind==='setup'){ for(const k in act.boosts) stSelf.boost[k]=Math.max(-6,Math.min(6,(stSelf.boost[k]||0)+act.boosts[k])); }
      else if(act.kind==='tailwind'){ field['tw'+side]=4; }
      else if(act.kind==='trickroom'){ field.tr=field.tr>0?0:5; }
      else if(act.kind==='status'){ const f=stFoeArr[foeIdx]; if(!f.status){ f.status=act.effect; if(act.effect==='slp')f.slp=1+Math.floor(Math.random()*2); } }
      else if(act.kind==='lowerspe'){ stFoeArr[foeIdx].boost.spe=Math.max(-6,(stFoeArr[foeIdx].boost.spe||0)-1); }
    };
    applySupport(actA,sA[ai],sB,bi,'A'); applySupport(actB,sB[bi],sA,ai,'B');
    // order the attackers
    const movers=[];
    if(actA.kind==='attack') movers.push('A'); if(actB.kind==='attack') movers.push('B');
    const spd=s=> s==='A'?effSpeed(A[ai],ctx,'A',{...sA[ai],field}):effSpeed(B[bi],ctx,'B',{...sB[bi],field});
    const prio=s=> s==='A'?(actA.mvPrio||bestMove(A[ai],B[bi],ctx).priority?1:0):(bestMove(B[bi],A[ai],ctx).priority?1:0);
    movers.sort((x,y)=>{ const dp=prio(y)-prio(x); if(dp)return dp; const d=spd(y)-spd(x); const base=field.tr>0?-d:d; return base||(Math.random()<0.5?-1:1); });
    const fainted={A:false,B:false};
    for(const s of movers){
      if(fainted[s]) continue;                        // active was KO'd this turn; its replacement does NOT act until next turn
      const attSt=s==='A'?sA[ai]:sB[bi];
      if(attSt.status==='par' && Math.random()<0.25) continue;          // fully paralysed
      const att=s==='A'?A[ai]:B[bi], def=s==='A'?B[bi]:A[ai], defProt=s==='A'?sB[bi].protThis:sA[ai].protThis;
      if(defProt) continue;                                             // protected
      const b=bestMove({...att,_side:s==='A'?'me':'foe',_hp:s==='A'?hpA[ai]:hpB[bi]},
                       {...def,_side:s==='A'?'foe':'me',_hp:s==='A'?hpB[bi]:hpA[ai]},ctx);
      let dmg=rnd(b.minPct,b.pct);
      const off=Math.max(attSt.boost.atk,attSt.boost.spa); if(off) dmg*=stageMul(off);   // setup pays off
      if(attSt.status==='brn' && isPhysical(att)) dmg*=0.5;                                // burn halves physical
      if(s==='A'){ hpB[bi]-=dmg; if(hpB[bi]<=0){ fainted.B=true; const nx=pickBestVs(B,hpB,A[ai],ctx); if(nx<0)break; bi=nx; sB[bi].boost={atk:0,spa:0,spe:0}; } }
      else       { hpA[ai]-=dmg; if(hpA[ai]<=0){ fainted.A=true; const nx=pickBestVs(A,hpA,B[bi],ctx); if(nx<0)break; ai=nx; sA[ai].boost={atk:0,spa:0,spe:0}; } }
    }
    // end of turn: burn chip, sleep countdown, decrement field, protect memory
    for(const [arr,st,idx] of [[hpA,sA,ai],[hpB,sB,bi]]){
      const s=st[idx]; if(s.status==='brn'&&arr[idx]>0) arr[idx]-=6.25;
      if(s.status==='slp'){ if(s.slp>0)s.slp--; if(s.slp<=0||Math.random()<0.34)s.status=null; }
      s.protLast=s.protThis||false;
    }
    if(field.twA>0)field.twA--; if(field.twB>0)field.twB--; if(field.tr>0)field.tr--;
  }
  const aliveA=hpA.filter(h=>h>0).length, aliveB=hpB.filter(h=>h>0).length;
  if(aliveA!==aliveB) return aliveA>aliveB?1:0;
  const hA=hpA.reduce((s,h)=>s+Math.max(0,h),0), hB=hpB.reduce((s,h)=>s+Math.max(0,h),0);
  return hA===hB?0.5:(hA>hB?1:0);
}

function winProb(A,B,N=200,opts={}){ if(!A.length||!B.length)return 0.5;
  let s=0; for(let i=0;i<N;i++) s+=rollout(A.map(m=>({...m})),B.map(m=>({...m})),opts); return s/N; }

module.exports={ rollout, winProb };

if(require.main===module){
  const a=(process.argv[2]||'garchomp,incineroar,charizard,kingambit').split(',').map(s=>s.trim());
  const b=(process.argv[3]||'pelipper,whimsicott,basculegion,sinistcha').split(',').map(s=>s.trim());
  const N=+(process.argv[4]||300);
  const A=S.team6(a), B=S.team6(b);
  if(A.length<2||B.length<2){ console.error('could not build enough mons; check species names'); process.exit(1); }
  const t0=Date.now(); const p=winProb(A,B,N);
  console.log(`MEDICHAM v2 rollout  (${N} playouts, ${Date.now()-t0}ms, behaviour-cloned + status/field)`);
  console.log(`  A: ${A.map(m=>m.name).join(', ')}`);
  console.log(`  B: ${B.map(m=>m.name).join(', ')}`);
  console.log(`  P(A wins) = ${p.toFixed(3)}`);
}
