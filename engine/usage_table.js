/* usage_table.js -- THE SPECIES USAGE TABLE, one implementation. MEASURE, abra/regmc 0.23.0.
 *
 * Lifted verbatim out of engine/analyze.js when the usage model became per-regulation: the Reg M-B
 * model (engine/analyze.js) and every other regulation's (engine/usage_regulation.js) count team,
 * bring, lead and win rates with THIS function, so two regulations' files mean the same thing by
 * construction. Reg M-B's output was shown byte-identical before and after the move (CHANGELOG-REGMC
 * 0.23.0). */
'use strict';

const idn = n => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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

const view = o => ({
  sampledTeams:o.sides,
  threats:o.table.map(t=>({sp:t.sp,teamRate:+t.team.toFixed(4),bringRate:+t.bring.toFixed(3),leadRate:+t.lead.toFixed(3),winRate:t.win!=null?+t.win.toFixed(3):null,n:t.n}))
});

module.exports = { idn, usage, view };
