/* Operation Ladder — analysis over the durable store.
 * ONE store -> many views by filter. Never re-pulls. */
const fs=require('fs');
const path=require('path');
const Q=require(path.join(__dirname,'quality.js'));
const STORE=process.argv[2]||null;
const ME=(process.env.ME||'willhoop').split(',').map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));

/* GAMES COME THROUGH THE SHARED QUALITY FILTER (data/quality-filter.json).
 *
 * This file used to read the store directly and filter only on the per-player `bot` NAME flag. That
 * missed five high-volume accounts which were not named like bots, four of which played the SAME six
 * Pokemon in 1,446 games. Their team dominated the output: this file was reporting Basculegion at
 * 34.1% team usage when the real figure among non-bot accounts is 17.9%, and the same for the other
 * five members of that one team. `data/meta-usage.json` is what CHOMP reads to make recommendations,
 * so a bot's team was being handed to the recommender as the metagame.
 *
 * Set ABRA_UNFILTERED=1 to compute over everything, which is only ever useful for demonstrating the
 * difference the filter makes. */
const UNFILTERED = !!process.env.ABRA_UNFILTERED;
const games = Q.loadGames({ clean: !UNFILTERED, path: STORE });
const _funnel = Q.funnel(STORE);
process.stderr.write(UNFILTERED
  ? `WARNING: ABRA_UNFILTERED — using all ${games.length} games, including bots and forfeits\n`
  : `quality filter: ${games.length} usable of ${_funnel.collected} collected (${(100*games.length/_funnel.collected).toFixed(1)}%)\n`);
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

/* ---- TWO METAGAMES, NOT ONE ---------------------------------------------------------------
 * This file used to publish a single distribution and call it "the metagame". There are two, and
 * which one is correct depends entirely on what the reader is doing.
 *
 *   COMPETITIVE (filtered). What humans choose when they are trying. The right answer for tournament
 *   preparation, for any claim ABOUT THE GAME, and for anything an agent should learn to imitate —
 *   bots play badly, and a policy trained on them gets worse.
 *
 *   LADDER (everything). What you will actually face. 6,297 of 8,356 stored games involve a bot:
 *   THREE IN FOUR OPPONENTS. A tool that helps someone climb must model the population they meet,
 *   and filtering bots out optimises for a metagame they encounter one game in four.
 *
 * The ladder view is not merely "unfiltered data". Bots are the most predictable opponent in the
 * format — one account played 459 games with a single team, and four ran the same six in 1,446. A
 * fixed, high-frequency opponent is the easiest thing in the world to prepare for, and "23% of your
 * opponents will bring precisely these six" is more actionable than any distribution.
 *
 * There is also a genuine grey area, which is why this ships both rather than picking: humans copy
 * strong bot teams to practise against, so a bot team can re-enter the competitive metagame as a
 * legitimate archetype. Neither view alone is the truth.
 *
 * Both are written. Consumers must state which they used. */
const out=usage(games,{humansOnly:true});
const _all = Q.loadGames({ clean:false, path: STORE });
const ladderOut = UNFILTERED ? out : usage(_all,{humansOnly:true});
const view = o => ({
  sampledTeams:o.sides,
  threats:o.table.map(t=>({sp:t.sp,teamRate:+t.team.toFixed(4),bringRate:+t.bring.toFixed(3),leadRate:+t.lead.toFixed(3),winRate:t.win!=null?+t.win.toFixed(3):null,n:t.n}))
});
/* The model CHOMP reads. It now carries its own provenance: which games it was computed from and
 * what was excluded, so a consumer can tell whether a number is about the metagame or about a bot. */
fs.writeFileSync('data/meta-usage.json',JSON.stringify({
  format:'gen9championsvgc2026regmb',
  generated:new Date().toISOString().slice(0,10),
  provenance:{
    source:'data/games.ladder.jsonl',
    filter:'data/quality-filter.json',
    filtered:!UNFILTERED,
    collected:_funnel.collected,
    usable:games.length,
    funnel:_funnel,
    caveat:'Bot detection is name-based plus a team-invariance rule. Accounts that play few games or vary their team can still escape it. Describe this set as "no bot detected", not as human.',
  },
  /* Top level stays the COMPETITIVE view so existing consumers keep the corrected behaviour they
   * were given in 3.1.1. The two views are also published explicitly, and `views.ladder` is the one
   * a laddering tool should read. */
  sampledTeams:out.sides,
  threats:view(out).threats,
  views:{
    competitive:{
      ...view(out),
      population:'quality-filtered — no bot detected',
      use:'tournament preparation; claims about the game; anything an agent should imitate',
      games:games.length,
    },
    ladder:{
      ...view(ladderOut),
      population:'every stored game, bots included',
      use:'what you will actually face while laddering',
      games:_all.length,
      note:'Bots are the MOST predictable opponent here — one account played 459 games with a single team. For a climbing tool that is free information, not contamination.',
    },
  },
  choosing:'State which view you used. They answer different questions and neither is "the" metagame.',
}, null, 1));
console.log('\nwrote data/meta-usage.json (competitive + ladder views)');
