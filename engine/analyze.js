/* Operation Ladder — analysis over the durable store.
 * ONE store -> many views by filter. Never re-pulls. */
const fs=require('fs');
const path=require('path');
const Q=require(path.join(__dirname,'quality.js'));
/* The active format id, from data/regulations.json — never restated (S12). */
const ACTIVE_FORMAT = (() => { try { const r = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'regulations.json'), 'utf8')); return (r.regulations[r.active] || {}).showdownFormat || 'gen9championsvgc2026regmb'; } catch (e) { return 'gen9championsvgc2026regmb'; } })();
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

/* ---- ONE REGULATION PER MODEL. THE KEY WAS ALREADY IN EVERY ROW AND NOTHING READ IT -------------
 *
 * `format: ACTIVE_FORMAT` above is a LABEL — it says what this file is called, never what went into
 * it. The corpus came from `Q.loadGames()`, which has no format logic at all, so every regulation in
 * the store pooled into one distribution and the result was stamped with the ACTIVE regulation's
 * name. On the day the ladder rotates that is not a rounding error: the new regulation's games land
 * on top of the previous regulation's corpus, and `data/meta-usage.json` is what CHOMP reads.
 *
 * The segmentation key has existed in every row since 2026-08-31, derived by
 * engine/durable-ingest.js from Showdown's own |tier| line precisely so a rotation would be visible,
 * and until now build/triggers.js was its only reader. This is the second.
 *
 * THE TOKEN IS DERIVED THROUGH THE PARSER THAT WROTE IT, never re-spelled here — two copies of one
 * derivation is how the two files come to disagree invisibly (CLAUDE.md: facts are global, and it is
 * the same reason status.js shells out to provenance.js). `activeStoreFormat()` throws if the active
 * regulation's label and its Showdown id disagree about which regulation it is.
 *
 * AN EMPTY RESULT IS A REFUSAL, NOT A MODEL. If the store holds rows and none of them are this
 * regulation's — which is exactly what a store frozen on the old ladder looks like after the flip —
 * writing a model computed from nothing is the silent default this project is named after. It stops.
 *
 * MEASURED WHEN THIS LANDED: 76,833 of 76,833 ladder rows are the active regulation, so no published
 * figure moves today. Staged red first with real rows from another regulation
 * (tests/probe_usage_regulation_pool.js): 41 Reg M-A games — 82 team-sides — were inside a model
 * labelled gen9championsvgc2026regmb, and moved the top three species by 0.5-0.6 points. */
const DI = require(path.join(__dirname, 'durable-ingest.js'));
const ACTIVE_STORE_FORMAT = DI.activeStoreFormat();
const _regTally = rows => { const t = {}; for (const g of rows) t[g.format || '(no format field)'] = (t[g.format || '(no format field)'] || 0) + 1; return t; };
const _inActive = g => g.format === ACTIVE_STORE_FORMAT;

const _allRows = Q.loadGames({ clean: false, path: STORE });
const _byReg = _regTally(_allRows);
const _otherRegs = Object.fromEntries(Object.entries(_byReg).filter(([k]) => k !== ACTIVE_STORE_FORMAT));
const _otherN = Object.values(_otherRegs).reduce((a, b) => a + b, 0);

const games = Q.loadGames({ clean: !UNFILTERED, path: STORE }).filter(_inActive);
const _funnel = Q.funnel(STORE);
if (_allRows.length && !games.length) {
  process.stderr.write(`REFUSING TO WRITE A MODEL: the store holds ${_allRows.length} row(s) and NONE of them `
    + `are ${ACTIVE_STORE_FORMAT} — it holds ${JSON.stringify(_byReg)}. Either data/regulations.json names a `
    + `regulation this store does not contain, or the collector has stopped. A model computed from zero `
    + `games of the active regulation is not a model.\n`);
  process.exit(1);
}
if (_otherN) process.stderr.write(`format filter: ${games.length} usable games are ${ACTIVE_STORE_FORMAT}; `
  + `${_otherN} stored row(s) from another regulation were EXCLUDED ${JSON.stringify(_otherRegs)}\n`);
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
const _all = _allRows.filter(_inActive);   // the ladder view is this regulation's ladder, not every regulation's
const ladderOut = UNFILTERED ? out : usage(_all,{humansOnly:true});
const view = o => ({
  sampledTeams:o.sides,
  threats:o.table.map(t=>({sp:t.sp,teamRate:+t.team.toFixed(4),bringRate:+t.bring.toFixed(3),leadRate:+t.lead.toFixed(3),winRate:t.win!=null?+t.win.toFixed(3):null,n:t.n}))
});
/* The model CHOMP reads. It now carries its own provenance: which games it was computed from and
 * what was excluded, so a consumer can tell whether a number is about the metagame or about a bot. */
fs.writeFileSync('data/meta-usage.json',JSON.stringify({
  /* S12: the format is not restated here. It comes from data/regulations.json via the one
     loader, so a regulation rotation relabels every artifact at once. */
  format: ACTIVE_FORMAT,
  generated:new Date().toISOString().slice(0,10),
  provenance:{
    source:'data/games.ladder.jsonl',
    filter:'data/quality-filter.json',
    filtered:!UNFILTERED,
    collected:_funnel.collected,
    usable:games.length,
    funnel:_funnel,
    /* WHICH REGULATION THIS IS ABOUT, as the STORE spells it. `format` at the top level is the
       Showdown id of the active regulation and is a label; this is the key the rows were actually
       filtered on, plus everything that key excluded. The funnel above is store-wide and is counted
       BEFORE this filter, which is why the two can differ. */
    formatToken:ACTIVE_STORE_FORMAT,
    rowsInStore:_allRows.length,
    otherRegulations:_otherRegs,
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
