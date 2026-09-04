/* ABRA — Automated Battle Replay Analyzer — durable, incremental, no-redo ingest.
 * Stores EVERY game's raw facts keyed by id (append-only, dedup).
 * Rating + bot tagged so any cutoff is a re-filter, never a re-pull.
 * Records observed moves/items/abilities per species AND a per-turn event
 * stream (move order -> speed, damage % -> observed rolls, faints, reveals).
 *
 * STORE RAW, ANALYSE ON TOP: this run also archives each raw .log to
 * data/raw-logs.jsonl so any NEW field is a re-parse (mode=reparse), never a
 * re-fetch. Re-pull the network at most once. */
const https=require('https'), fs=require('fs'), path=require('path');
// Which format(s) to collect. Source of truth is data/regulations.json (the active
// regulation), so switching regulations is a one-line config edit. FORMATS env
// overrides; INCLUDE_BO3=1 also pulls the best-of-3 open-sheet ladder.
//   FORMATS=gen9championsvgc2026regmb,gen9vgc2025reggbo3 node engine/durable-ingest.js ...
function activeFormats(){
  try{ const r=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','regulations.json'),'utf8'));
    const a=r.regulations[r.active]||{}; const out=[a.showdownFormat].filter(Boolean);
    if(process.env.INCLUDE_BO3 && a.bo3Format) out.push(a.bo3Format);
    return out.length?out:null;
  }catch(e){ return null; }
}
const FORMATS=(process.env.FORMATS ? process.env.FORMATS.split(',') : (activeFormats()||['gen9championsvgc2026regmb']))
  .map(s=>s.trim()).filter(Boolean);
const PAGES=+(process.env.PAGES||25), CONC=+(process.env.CONC||16);  // was 2 (~100 games/run); 25 exhausts the public pool (~1250/format), auto-stops when empty
const STORE=process.argv[2]||'games.jsonl';
const RAW=process.env.RAW||(STORE.replace(/\.jsonl$/,'')+'.raw-logs.jsonl');
const MODE=process.env.MODE||'fetch'; // fetch | reparse | backfill
/* `x.setEncoding('utf8')` IS LOAD-BEARING AND ITS ABSENCE CORRUPTED THE STORE. Found 2026-08-28 by
 * MEASURE, chasing engine/sanity_check.py's `the winner is always one of the two players (2 bad)`.
 *
 * This read `let d=''; x.on('data', c => d += c)`. `c` is a Buffer and `d` is a string, so `+=`
 * calls Buffer#toString('utf8') on EACH CHUNK SEPARATELY. A multi-byte UTF-8 character that
 * straddles a chunk boundary is therefore decoded as two partial sequences and comes back as
 * U+FFFD replacement characters — silently, with a 200 and a well-formed log. Reproduced exactly:
 *   Buffer.from([0xE2,0x80])+Buffer.from([0x99])  -> '��'   ("It’sJustKen" -> "It??sJustKen")
 *   '塔' split 1/2                                 -> '���'
 * both of which are byte-for-byte what the two bad store rows contain.
 *
 * MEASURED BLAST RADIUS at the time of the fix: 2 rows of data/games.ladder.jsonl (the `winner`
 * field, ids ...-2662690089 of 2026-08-10 and ...-2672145722 of 2026-08-28) and 194 archived raw
 * logs across the ladder and bo3 stores, 496 replacement characters over 204 protocol lines. EVERY
 * ONE lands inside a NICKNAME or a chat/join/leave username — never a species, move, item or number,
 * because those are ASCII. It is not harmless even so: extract() keys `nick[side+nickname] ->
 * species` for damage attribution, and the corruption hits one occurrence of a nickname and not the
 * others, so the lookup misses on that line.
 *
 * setEncoding routes the stream through StringDecoder, which holds an incomplete sequence back until
 * the next chunk completes it. Do not "optimise" this back to a bare concatenation. */
/* ---- THREE FACTS MUST NOT SHARE ONE VALUE ---------------------------------------------------
 * This resolved `''` on an HTTP error, on a timeout, AND on an empty-but-successful body. A dead
 * replay API and a genuinely quiet hour were therefore INDISTINGUISHABLE to every caller, and the
 * run printed "appended 0 games" and exited 0 in both cases — the project's signature failure mode,
 * a capability absent while everything reports success.
 *
 * `null` now means THE REQUEST DID NOT COMPLETE; a string (including '') means the endpoint
 * answered and that is what it said. Callers that only asked "is there a body" are unaffected —
 * `null` and `''` are both falsy — but the run can now count the difference and refuse to call a
 * broken endpoint a quiet day. See the counters and the exit-code discriminators in main(). */
const get=u=>new Promise(r=>{const q=https.get(u,x=>{let d='';x.setEncoding('utf8');x.on('data',c=>d+=c);x.on('end',()=>r(d));});q.on('error',()=>r(null));q.setTimeout(12000,()=>{q.destroy();r(null);});});
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const isBot=n=>/^pcrlbot|bot\d|^[a-z]+bot$/i.test(n||'');

// Mega/primal formes collapse to their base species for `six`/`brought`/`lead`, because team
// preview only ever shows the base. Built from data/mega-dex-official.json when present, with a
// name-shape fallback so it still works if that file is missing.
let BASE_FORME = null;
function baseForme(sp){
  if(BASE_FORME === null){
    BASE_FORME = {};
    try{
      // every forme that exists ONLY during a battle - mega, primal, Palafin-Hero,
      // Mimikyu-Busted - mapped back to the species team preview actually shows
      const bf = JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','battle-formes.json'),'utf8'));
      Object.assign(BASE_FORME, bf.base_of||{});
    }catch(e){ /* fallback below */ }
  }
  if(BASE_FORME[sp]) return BASE_FORME[sp];
  const m = /^(.*?)(mega[xy]?|primal)$/.exec(sp);
  return m && m[1] ? m[1] : sp;
}

/* ---- THE ATTRIBUTION CLAUSE, PARSED ONCE ---------------------------------------------------
   Showdown states WHY on the same line as the effect: `|-damage|p2b: Sylveon|7/100|[from] item:
   Life Orb`, `|-enditem|p1a: X|Sitrus Berry|[from] move: Knock Off|[of] p2a: Y`. The parser used
   to TEST for `[from]` to decide a damage was residual and then discard the text, so burn,
   sandstorm, Life Orb and Rocky Helmet all landed as an anonymous HP drop. Measured on the
   46,587-game raw ladder archive: 191,678 residual damage lines, led by Life Orb 51,523,
   Recoil 37,265, Sandstorm 36,348, burn 23,435, poison 14,358, Rough Skin 13,056.
   One function, because a `[from]` clause means the same thing on every line that carries one. */
function fromOf(tail){
  const t=tail||'';
  const f=/\[from\]\s*([^|\[]+)/.exec(t), o=/\[of\]\s*(p[12][ab])/.exec(t);
  return { from: f?f[1].trim():null, of: o?o[1]:null };
}
/* ---- ONE MOVE, ONE ROW PER BODY IT ACTUALLY HIT ---------------------------------------------
   A spread move is ONE `|move|` line and several `|-damage|` lines. Every damage was folded onto
   the move as `dmg = max(dmg, delta)` with `tgt = tgt || <slot>`, so a Matcha Gotcha that hit two
   bodies came out as the LARGER of the two deltas, attributed to the FIRST target's species, at
   the LAST target's hp. engine/replay_differential.js could not score those and refused 8,360 of
   37,177 damage units. A multi-hit move has the same shape from the other direction: three damage
   lines against one body, and `max` reported one hit of an attack that landed three.
   `tgts` accumulates PER SLOT — dmg sums, hp is the last value, n counts the lines — so a spread
   move gets one row per body and a multi-hit move gets the whole attack. The legacy `dmg`, `tgt`,
   `tgthp` and `ko` fields are written exactly as before, because analysis across the repository
   reads them. */
function addTgt(e, slot, mon, delta, nw, ko){
  const a=e.tgts||(e.tgts=[]);
  let x=a.find(y=>y.s===slot);
  if(!x){ x={s:slot,mon:mon||null,dmg:0,hp:nw,n:0}; a.push(x); }
  x.dmg+=delta; x.hp=nw; x.n++;
  if(mon&&!x.mon) x.mon=mon;
  if(ko) x.ko=true;
  return x;
}

function extract(id, uploadtime, text){
  const P={p1:{},p2:{}}, poke={p1:[],p2:[]}, brought={p1:new Set(),p2:new Set()}, lead={p1:[],p2:[]};
  const sets={};           // species -> {moves:Set, item, ability}
  const nick={};           // 'p1a'+nickname -> species     (for move/reveal attribution)
  const slotSp={};         // 'p1a' -> species currently active
  const hp={};
  const boosts={};   // slot -> {atk,def,spa,spd,spe} stage, absolute             // 'p1a' -> current HP % (0..100)
  const turns=[];          // per-turn event stream
  /* ---- THE ENTRY PHASE IS A TURN THIS STORE USED TO HAVE NO ROOM FOR --------------------------
     `cur` was null until `|turn|1`, so everything Showdown emits between `|start` and the first
     turn was dropped: the four lead switch-ins, every Intimidate, and a Drought or Drizzle lead's
     WEATHER — which is on the field for the whole of turn 1 and which replay_differential.js had
     to reconstruct or refuse. 72,203 such lines across 25,583 of 46,587 archived games.
     It is kept in its OWN top-level field rather than as `turns[0]`, deliberately: a turn 0 in
     `turns` would change the shape every existing consumer iterates, and this change may only add. */
  const preTurn=[];
  let cur={n:0,ev:[]}, lastMove=null, winner=null, forfeit=false;
  const sheets={p1:null,p2:null};   // open team sheets, when the format declares them
  const touch=sp=>sets[sp]=sets[sp]||{moves:new Set(),item:null,ability:null};
  const flush=()=>{ if(!cur||!cur.ev.length) return;
    if(cur.n===0) preTurn.push(...cur.ev); else turns.push(cur); };
  for(const l of text.split('\n')){ let m;
    if(m=l.match(/^\|player\|(p[12])\|([^|]*)\|[^|]*\|(\d*)/)){ P[m[1]]={name:m[2],rating:+m[3]||null,bot:isBot(m[2])}; }
    else if(m=l.match(/^\|poke\|(p[12])\|([^,|]+)/)){ poke[m[1]].push(norm(m[2])); }
    else if(m=l.match(/^\|turn\|(\d+)/)){ flush(); cur={n:+m[1],ev:[]}; }
    else if(m=l.match(/^\|(?:switch|drag|replace)\|(p[12][ab]): ([^|]*)\|([^,|]+)[^|]*(?:\|(\d+)\/(\d+))?/)){
      const slot=m[1], side=slot.slice(0,2), sp=norm(m[3]);
      /* ---- A COPIED SPECIES IS NOT AN EXTRA POKEMON -------------------------------------
         Ditto's Imposter, and Zoroark's Illusion, make the SPECIES field disagree with the
         NICKNAME. A transformed Ditto switching in is logged as

             |switch|p2a: Ditto|Sneasler, L50|131/131

         — nickname Ditto, details Sneasler. Taking the species verbatim put the OPPONENT'S
         Pokemon into this side's `brought`, pushing the count to five and breaking the
         subset invariant. Caught on the first 200,004-game self-play corpus: 5 games, every
         one a Ditto team, every offender a species from the other side.

         Nicknames are unique within a team, so if this nickname is already bound to a
         different species, this is the SAME Pokemon wearing another form — exactly the mega
         case below, and handled the same way: track it for damage attribution, but do not
         count it as brought. */
      const known=nick[side+m[2]];
      const copied = known && known!==sp && baseForme(known)!==baseForme(sp);
      slotSp[slot]=sp; hp[slot]=m[4]?Math.round(100*+m[4]/+m[5]):100;
      /* Stat stages belong to the POKEMON, not the slot, so anything switching in starts clean.
         Getting this wrong would leave an Intimidate drop on the mon that replaced its victim. */
      boosts[slot]={};
      if(!copied) nick[side+m[2]]=sp;
      touch(sp);
      if(!copied){
        // `brought` and `lead` must speak the same language as `six`, which comes from team preview
        // and therefore always names the BASE forme. A mega that switches back in is logged as
        // "Charizard-Mega-Y", so recording it verbatim put a species in `brought` that was not in
        // `six` (1,649 games) and pushed the count to 5 (1,560 games). Normalise to the base.
        const bsp=baseForme(sp);
        brought[side].add(bsp);
        if(lead[side].length<2&&!lead[side].includes(bsp))lead[side].push(bsp);
      }
      if(cur) cur.ev.push({t:'s',s:slot,mon:sp});
    }
    else if(m=l.match(/^\|move\|(p[12][ab]): ([^|]*)\|([^|]+)(?:\|(p[12][ab]):)?/)){
      const slot=m[1], side=slot.slice(0,2), sp=nick[side+m[2]]||slotSp[slot];
      if(sp){ touch(sp); sets[sp].moves.add(m[3].trim()); }
      lastMove={slot,sp,mv:m[3].trim(),tgt:m[4]||null,dmg:0};
      const evm={t:'m',s:slot,mon:sp,mv:m[3].trim(),tgt:m[4]?slotSp[m[4]]:null,dmg:0};
      /* `|move|p2a: Charizard|Heat Wave|p1b: Incineroar|[spread] p1a,p1b` — the target field names
         ONE body and the attribute names every body the move reached. Without it a spread move that
         happened to hit one target is indistinguishable from a single-target move, and a consumer
         cannot tell a missing row from a target that was never in range. 127,674 spread moves in
         38,873 of 46,587 archived games. */
      const sprd=(l.match(/\[spread\]\s*([^|]+)/)||[])[1];
      if(sprd){ const ss=sprd.trim().split(',').map(x=>x.trim()).filter(x=>/^p[12][ab]$/.test(x));
        if(ss.length) evm.spread=ss; }
      if(cur) cur.ev.push(evm);
    }
    /* ---- THE MOVE THAT DID NOT HAPPEN, AND WHY -------------------------------------------------
       `|cant|p2a: X|flinch`. Never read, so a flinched, fully paralysed, asleep, frozen, recharging,
       taunted, disabled or Armor-Tailed body was one indistinguishable ABSENCE of an `m` event —
       zero games in 52,089 carried a flinch marker. 35,430 lines across 21,301 of 46,587 archived
       games: flinch 21,546, slp 7,041, ability: Armor Tail 1,771, recharge 1,677, par 1,015,
       frz 772, Disable 668, move: Taunt 461, Queenly Majesty 272, and a long tail.
       The reason is kept VERBATIM rather than bucketed — `ability: Armor Tail` and `move: Taunt`
       name the rule that stopped the move, and bucketing them here would throw away the same fact
       twice. The 4th field, where present, is the move that was refused. */
    else if(m=l.match(/^\|cant\|(p[12][ab]): ([^|]*)\|([^|]*)(?:\|([^|]*))?/)){
      if(cur) cur.ev.push({t:'c',s:m[1],mon:slotSp[m[1]]||null,why:(m[3]||'').trim(),
        mv:m[4]?m[4].trim():null});
    }
    /* `|-hitcount|p2a: X|3` — how many times a multi-hit move landed, stated outright and never
       read. The differential skipped 630 multi-hit rows as incomparable while the count was on the
       wire. 11,200 lines in 6,553 of 46,587 archived games; 2 hits is the mode (6,567), 10 the tail
       (430, Population Bomb). NOTE THE SLOT: after the target faints Showdown drops the a/b letter
       (`|-hitcount|p1: Venusaur|2`), so the position is optional and the count still belongs to the
       move — that shape is 4 of the first 8 occurrences in the archive, not an edge case. */
    else if(m=l.match(/^\|-hitcount\|(p[12])([ab])?[^|]*\|(\d+)/)){
      const n=+m[3], slot=m[2]?m[1]+m[2]:null;
      if(cur){ const e=[...cur.ev].reverse().find(x=>x.t==='m');
        if(e){ e.hitcount=n;
          const rows=e.tgts||[];
          const x=slot?rows.find(y=>y.s===slot):(rows.length===1?rows[0]:null);
          if(x) x.hitcount=n; } }
    }
    /* ---- HP IS RECORDED ABSOLUTELY, NOT AS A RUNNING TOTAL OF DAMAGE ---------------------
       This used to write ONLY the delta (`dmg`) onto the move, and the absolute figure it had
       just computed was thrown away. Every consumer therefore had to rebuild health by adding
       damage up, and since healing was never emitted as an event at all -- no Leftovers tick,
       no Sitrus, no Regenerator, no residual burn or sandstorm chip -- the rebuilt number could
       only ever drift DOWNWARD from the truth.

       That is not a cosmetic gap. It is measured: MAGNEMITE's "this move is a guaranteed kill"
       fired on targets that actually died 56.5% of the time, because it was aiming at Pokemon
       it believed were far closer to death than they were. Sitrus Berry alone is 10.7% of every
       item held in this format.

       The protocol states health absolutely on every line (`|-damage|p1a: Garchomp|142/207`), so
       there was never a reason to accumulate. `hp` on an event is now the percentage that mon is
       at AFTER the event, and healing and residual chip get events of their own. `dmg` stays for
       the consumers that already use it. */
    else if(m=l.match(/^\|-damage\|(p[12][ab])[^|]*\|(\d+)\/(\d+)(.*)/)){
      const slot=m[1], nw=Math.round(100*+m[2]/+m[3]), was=hp[slot]==null?100:hp[slot];
      const delta=Math.max(0,was-nw); hp[slot]=nw;
      const residual=/\[from\]/.test(m[4]);
      if(!residual && cur && cur.ev.length){ // attribute to the just-used move
        const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e){ e.dmg=Math.max(e.dmg,delta); e.tgt=e.tgt||slotSp[slot]; e.tgthp=nw;
          addTgt(e,slot,slotSp[slot],delta,nw,false); }
      }
      /* Chip damage is nobody's move, so it cannot ride on one -- burn, sandstorm, Life Orb and
         Rocky Helmet all land here and were previously invisible to every replay. They NAME
         THEMSELVES on the line (`[from] item: Life Orb`, `[of] p2a: X` for a Rocky Helmet or Rough
         Skin), and the parser had that text in hand at the moment it decided the damage was
         residual. `from`/`of`/`dmg` are added; `hp` keeps its exact meaning. */
      else if(residual && cur){ const fo=fromOf(m[4]);
        cur.ev.push({t:'hp',s:slot,mon:slotSp[slot],hp:nw,dmg:delta,from:fo.from,of:fo.of}); }
    }
    else if(m=l.match(/^\|-damage\|(p[12][ab])[^|]*\|0 fnt(.*)/)){
      const slot=m[1], was=hp[slot]==null?100:hp[slot]; hp[slot]=0;
      if(!/\[from\]/.test(m[2]) && cur){ const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e){ e.dmg=Math.max(e.dmg,was); e.ko=true; e.tgthp=0;
        addTgt(e,slot,slotSp[slot],was,0,true); } }
      else if(cur){ const fo=fromOf(m[2]);
        cur.ev.push({t:'hp',s:slot,mon:slotSp[slot],hp:0,dmg:was,from:fo.from,of:fo.of}); }
    }
    /* ---- STAT STAGES ---------------------------------------------------------------------
       Intimidate, Snarl, Icy Wind, Swords Dance, Tailwind's cousins. NONE of this was recorded,
       so every replay in this project has believed every Pokemon on the field was sitting at
       neutral for its entire life. The damage formula has always had the machinery to apply
       stages (`boostMul`) and has always been handed zeros.

       It is not a small effect and it is measured, not assumed: of MAGNEMITE's false "guaranteed
       kill" calls, 8.8% had an Intimidate on the field cutting the physical damage by a third.
       Intimidate is the most common ability in this format.

       ABSOLUTE, NOT A DELTA -- the lesson the HP bug taught. The running stage per stat is kept
       here and the FULL set is written onto the event, so a consumer never has to add anything up
       and a missed line cannot corrupt everything after it. */
    else if(m=l.match(/^\|-(boost|unboost|setboost)\|(p[12][ab])[^|]*\|([a-z]+)\|(-?\d+)/)){
      const kind=m[1], slot=m[2], st=m[3], n=+m[4];
      const b=boosts[slot]||(boosts[slot]={});
      if(kind==='setboost') b[st]=n;
      else b[st]=Math.max(-6,Math.min(6,(b[st]||0)+(kind==='unboost'?-n:n)));
      if(cur) cur.ev.push({t:'b',s:slot,mon:slotSp[slot],b:{...b}});
    }
    else if(m=l.match(/^\|-(clearboost|clearnegativeboost|clearallboost)\|?(p[12][ab])?/)){
      if(m[1]==='clearallboost'){ for(const k of Object.keys(boosts)) boosts[k]={};
        if(cur) for(const k of Object.keys(slotSp)) cur.ev.push({t:'b',s:k,mon:slotSp[k],b:{}}); }
      else if(m[2]){
        const b=boosts[m[2]]||(boosts[m[2]]={});
        if(m[1]==='clearnegativeboost'){ for(const k of Object.keys(b)) if(b[k]<0) delete b[k]; }
        else boosts[m[2]]={};
        if(cur) cur.ev.push({t:'b',s:m[2],mon:slotSp[m[2]],b:{...(boosts[m[2]]||{})}});
      }
    }
    /* ---- WHAT ACTUALLY HAPPENED TO THE MOVE -----------------------------------------------
       Recorded so a model's EXPECTATION can be checked against the engine's ANSWER. MAG predicts
       accuracy, immunity, ability blocks and kills; the protocol states all four outright and none
       of them were kept. Without these, the only way to find a mechanic MAG does not know is for a
       human to think of it and ask -- which is how every gap this session was found, and does not
       scale. engine/surprise.js turns these into a ranked list of what to fix next. */
    else if(m=l.match(/^\|-miss\|(p[12][ab])/)){ if(cur){const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e)e.miss=1;} }
    else if(m=l.match(/^\|-immune\|(p[12][ab])/)){ if(cur){const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e)e.immune=1;} }
    else if(m=l.match(/^\|-fail\|(p[12][ab])/)){ if(cur){const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e)e.fail=1;} }
    else if(m=l.match(/^\|-crit\|(p[12][ab])/)){ if(cur){const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e)e.crit=1;} }
    else if(m=l.match(/^\|-prepare\|(p[12][ab])/)){ if(cur){const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e)e.charging=1;} }
    /* An ability that ate the move names itself: |-immune|p2a: X|[from] ability: Flash Fire, and
       |-activate| carries Armor Tail and friends. Kept as the ability NAME so the review can say
       which rule was missed rather than only that something was. */
    else if(m=l.match(/^\|-(?:activate|block)\|(p[12][ab])[^|]*\|ability: ([^|]+)/)){
      if(cur){const e=[...cur.ev].reverse().find(x=>x.t==='m'); if(e)e.blockedBy=m[2].trim();}
    }
    else if(m=l.match(/^\|faint\|(p[12][ab])/)){ if(cur) cur.ev.push({t:'f',s:m[1],mon:slotSp[m[1]]}); }
    /* A heal names its source on the same line and for the same reason chip damage does:
       `[from] item: Sitrus Berry`, `[from] ability: Regenerator`, `[from] move: Wish`. `heal:1`
       distinguishes it from a chip event without a consumer having to infer direction from hp. */
    else if(m=l.match(/^\|-heal\|(p[12][ab])[^|]*\|(\d+)\/(\d+)(.*)/)){
      const slot=m[1], nw=Math.round(100*+m[2]/+m[3]), was=hp[slot]==null?nw:hp[slot]; hp[slot]=nw;
      const fo=fromOf(m[4]);
      // `got` is how much came BACK; `dmg` is deliberately not reused, because it means damage taken
      // on every other event that carries it and one field with two signs is how a fact goes wrong.
      if(cur) cur.ev.push({t:'hp',s:slot,mon:slotSp[slot],hp:nw,heal:1,got:Math.max(0,nw-was),from:fo.from,of:fo.of});
    }
    /* |-sethp| is how Pain Split and a few others state a new value outright. */
    else if(m=l.match(/^\|-sethp\|(p[12][ab])[^|]*\|(\d+)\/(\d+)(.*)/)){
      const slot=m[1], nw=Math.round(100*+m[2]/+m[3]); hp[slot]=nw;
      const fo=fromOf(m[4]);
      if(cur) cur.ev.push({t:'hp',s:slot,mon:slotSp[slot],hp:nw,from:fo.from,of:fo.of});
    }
    else if(m=l.match(/^\|-item\|(p[12][ab]): ([^|]*)\|([^|]+)/)){ const sp=slotSp[m[1]]; if(sp){touch(sp);sets[sp].item=m[3].trim();} }
    /* ---- AN ITEM LEAVING IS AN EVENT, NOT ONLY A REVEAL -----------------------------------------
       This line was read for ONE purpose — to infer what item the body had been holding — and the
       fact that it left, on this turn, was thrown away. So "the Focus Sash triggered here" was gone,
       and so was every consumed berry and every Knock Off. That is the exact hazard CLAUDE.md
       records: a sharpened item estimate with nothing tracking what stales it, and the damage and
       speed calculations keep applying a Life Orb or a Choice Scarf that is no longer there.
       56,506 lines in 31,838 of 46,587 archived games: Sitrus Berry 24,684, Focus Sash 12,680,
       Chople 4,180, White Herb 2,397, Colbur 2,356 ... Choice Scarf 523, Life Orb 691.
       `why` is the bracket qualifier — a resist berry emits BOTH `[eat]` and `[weaken]` for one
       consumption, so a consumer that counts events without reading it will double-count. */
    else if(m=l.match(/^\|-enditem\|(p[12][ab]): ([^|]*)\|([^|]+)(.*)/)){
      const slot=m[1], sp=slotSp[slot], item=m[3].trim(), tail=m[4]||'';
      if(sp){touch(sp);sets[sp].item=sets[sp].item||item;}
      const fo=fromOf(tail), why=(tail.match(/\[(eat|weaken|silent)\]/)||[])[1]||null;
      if(cur) cur.ev.push({t:'ei',s:slot,mon:sp||null,item,why,from:fo.from,of:fo.of});
    }
    else if(m=l.match(/^\|-ability\|(p[12][ab]): ([^|]*)\|([^|]+)/)){ const sp=slotSp[m[1]]; if(sp){touch(sp);sets[sp].ability=m[3].trim();} }
    /* ---- MEGA EVOLUTION -------------------------------------------------------------
       Showdown announces a mega with |detailschange| (and |-mega|). Without this the slot
       still points at the BASE species, so the mega's stats, typing and - critically - its
       NEW ABILITY were never attributed to anything. That left 904 of 906 Charizard-Mega-Y
       sets with a blank ability, and made Raichu-Mega-X (No Guard) indistinguishable from
       Raichu-Mega-Y (Electric Surge) even though they play completely differently. */
    else if(m=l.match(/^\|(?:detailschange|-formechange)\|(p[12][ab]): ([^|]*)\|([^,|]+)/)){
      const slot=m[1], side=slot.slice(0,2), was=slotSp[slot], sp=norm(m[3]);
      nick[side+m[2]]=sp; slotSp[slot]=sp; touch(sp);
      if(was && was!==sp){ sets[sp].from=was; }
      // NOTE: deliberately NOT added to `brought`. A mega is the SAME Pokemon in a new forme, not an
      // extra one brought. Adding it counted Charizard and Charizard-Mega-Y as two of the four, which
      // pushed `brought` to 5-6 in ~4,700 games and silently disqualified them from CHOMP-EV
      // (its eval set collapsed from ~1,200 games to 43 before this was caught).
      if(cur) cur.ev.push({t:'mega',s:slot,mon:sp,from:was||null});
    }
    else if(m=l.match(/^\|-mega\|(p[12][ab]): ([^|]*)\|([^|]+)\|([^|]+)/)){
      const slot=m[1]; const sp=slotSp[slot]; if(sp){ touch(sp); sets[sp].item=sets[sp].item||m[4].trim(); }
    }
    /* ---- WEATHER / TERRAIN, and WHO switched it on ------------------------------------
       These lines carry "[from] ability: X|[of] pNa: Species", which is often the only place
       a setter ability is ever stated (Drought, Drizzle, Electric Surge...). Parsing them
       recovers the ability AND tells us which side owns the weather. */
    else if(m=l.match(/^\|-weather\|([^|]+)\|\[from\] ability: ([^|]+)\|\[of\] (p[12][ab])/)){
      const sp=slotSp[m[3]]; if(sp){ touch(sp); sets[sp].ability=sets[sp].ability||m[2].trim(); }
      if(cur) cur.ev.push({t:'w',s:m[3],mon:sp||null,field:m[1].trim(),by:m[2].trim()});
    }
    else if(m=l.match(/^\|-weather\|([^|]+)/)){
      const w=m[1].trim(); if(cur && w && w!=='none' && !/upkeep/i.test(l)) cur.ev.push({t:'w',field:w});
    }
    else if(m=l.match(/^\|-fieldstart\|move: ([^|]+)\|\[from\] ability: ([^|]+)\|\[of\] (p[12][ab])/)){
      const sp=slotSp[m[3]]; if(sp){ touch(sp); sets[sp].ability=sets[sp].ability||m[2].trim(); }
      if(cur) cur.ev.push({t:'fs',s:m[3],mon:sp||null,field:m[1].trim(),by:m[2].trim()});
    }
    else if(m=l.match(/^\|-fieldstart\|move: ([^|]+)/)){
      if(cur) cur.ev.push({t:'fs',field:m[1].trim()});
    }
    /* A status names its cause on 1,052 of 4,408 lines (23.9%, measured on 8,000 archived games):
       `[from] move: Sleep Powder` 536, `move: Hypnosis` 192, `ability: Spicy Spray` 191, Poison
       Touch 90, Rest 17, Flame Body 14, Static 7. Same clause, same helper as the chip damage above.
       The other 76% are the ordinary case where the move that just resolved carries the secondary,
       and a null `from` means exactly that — it does NOT mean the cause is unknown. */
    else if(m=l.match(/^\|-status\|(p[12][ab]): ([^|]*)\|([^|]+)(.*)/)){
      const fo=fromOf(m[4]);
      if(cur) cur.ev.push({t:'x',s:m[1],mon:slotSp[m[1]],st:m[3].trim(),from:fo.from,of:fo.of});
    }
    /* ---- OPEN TEAM SHEETS (Bo3 / tournament format) --------------------------------------
       |showteam|p1|Gengar||Gengarite|CursedBody|ShadowBall,PerishSong,...|Timid||F|||50|]Swampert|...
       This line declares the FULL set of all six: item, ability, every move, nature, level. It is
       the whole hidden-information problem removed - a perfect-information game. We were detecting
       these lines only to set the openSheet flag and then discarding the sets themselves, so 1,624
       stored Bo3 games showed almost no revealed movesets. Now captured into `sheets`. */
    else if(m=l.match(/^\|showteam\|(p[12])\|(.*)$/)){
      const side=m[1];
      sheets[side]=m[2].split(']').map(entry=>{
        const f=entry.split('|');
        return { species:norm(f[0]||''), nickname:(f[1]||'')||null, item:(f[2]||'')||null,
                 ability:(f[3]||'')||null,
                 moves:(f[4]||'').split(',').filter(Boolean),
                 nature:(f[5]||'')||null, evs:(f[6]||'')||null, gender:(f[7]||'')||null,
                 level:+(f[10]||f[11]||50)||50 };
      }).filter(x=>x.species);
    }
    else if(m=l.match(/^\|win\|(.*)/)) winner=m[1].trim();
    // a forfeit means the winner did not necessarily win on the merits - a quality signal that
    // several models want, and reading it here saves every one of them re-opening the raw logs
    else if(/\|-message\|.*forfeited/i.test(l)) forfeit=true;
  }
  flush();
  const setsOut={}; for(const k in sets) setsOut[k]={moves:[...sets[k].moves],item:sets[k].item,ability:sets[k].ability};
  /* MERGE THE DECLARED SHEETS. `sheets` was captured above and then never used: setsOut was built
   * only from what play REVEALED, so an open-team-sheet game came out exactly as blind as a
   * closed-sheet one. Measured on the 4,167-game OTS archive before this fix: 1.50 of 4 moves,
   * 69.7% no item, 73.8% no ability — indistinguishable from the closed-sheet ladder's 1.38 / 69.7%
   * / 75.5%, when the correct answer is 4 of 4 and zero missing.
   *
   * CHANGELOG 3.0.0 said "open team sheets are now parsed ... the entire hidden-information problem
   * removed". The parsing landed; the USE of it did not. That is ARCHITECTURE fault 1.4 again — a
   * fix applied to the wrong artifact and reported as done.
   *
   * A declared sheet is the ACTUAL set, so it wins over inference. Observed moves are unioned in
   * anyway: a mega forme can reveal a move under a species name the sheet lists differently, and
   * dropping it would lose a real observation. `declared` is stamped so no consumer mistakes a
   * known set for an inferred one. */
  for(const side of ['p1','p2']){
    for(const e of (sheets[side]||[])){
      if(!e.species) continue;
      const prev=setsOut[e.species]||{moves:[],item:null,ability:null};
      const merged=new Set([...(e.moves||[]), ...(prev.moves||[])]);
      setsOut[e.species]={
        moves:[...merged],
        item:e.item||prev.item||null,
        ability:e.ability||prev.ability||null,
        nature:e.nature||null,
        declared:true,          // from |showteam|, not inferred from play
      };
    }
  }
  // information regime + format tags (bo3 is open team sheet; players may also agree to it)
  const tier=(text.match(/^\|tier\|(.+)$/m)||[])[1]||null;
  const openSheet=/\|showteam\|/.test(text) || /best of three|bo3/i.test(tier||'');
  /* THE REGULATION IN THIS TAG WAS A CONSTANT, AND THE ONLY ALARM THAT WATCHES FOR A ROTATION READS
   * THIS FIELD. Every Champions tier collapsed to the literal 'champions-regmb', so a Reg M-A replay
   * stored as `champions-regmb` (measured 2026-08-31 on 51 of them), and on the day the next
   * regulation ships its games would have been stamped with the OLD regulation's name too.
   * build/triggers.js's formatTrigger compares the modal format across the store against the recent
   * window; with one constant on both sides it can never differ, so the rotation alarm was dead by
   * construction — the exact shape CLAUDE.md opens with, a capability absent while everything
   * reports success.
   *
   * The regulation is IN the tier line Showdown writes, so it is read rather than assumed:
   *   |tier|[Gen 9 Champions] VGC 2026 Reg M-B (Bo3)  ->  champions-regmb
   *   |tier|[Gen 9 Champions] VGC 2026 Reg M-A (Bo3)  ->  champions-regma
   * REG M-B IS BYTE-IDENTICAL TO WHAT THE CONSTANT PRODUCED, deliberately: relabelling the active
   * regulation would make every new row differ from every stored row and fire the rotation alarm on
   * a rotation that had not happened. triggers.js's own comment says an alarm that cries wolf on day
   * one is worse than no alarm. This refines the label; it does not rename anything already true.
   *
   * A Champions tier with no readable Reg token keeps its own value rather than borrowing a
   * regulation's — 'champions-reg?' is visibly a gap, 'champions-regmb' would be a false fact. */
  const chReg=(tier||'').match(/\breg\s*([a-z0-9]+(?:-[a-z0-9]+)*)/i);
  const fmt=(tier||'').toLowerCase().includes('champions')
             ? 'champions-reg'+(chReg?chReg[1].toLowerCase().replace(/[^a-z0-9]/g,''):'?')
           : /vgc/i.test(tier||'')?'vgc-'+((tier||'').match(/reg\w*\s*\w*/i)||['reg?'])[0].toLowerCase().replace(/[^a-z0-9]/g,'')
           : 'other';
  return { id, date:new Date(uploadtime*1000).toISOString().slice(0,16).replace('T',' '),
    format:fmt, openSheet,
    p1:P.p1, p2:P.p2, winner:winner||null, forfeit, sheets,
    six:{p1:[...new Set(poke.p1)],p2:[...new Set(poke.p2)]},
    brought:{p1:[...brought.p1],p2:[...brought.p2]}, lead, sets:setsOut, preTurn, turns };
}
async function pool(items,fn,c){const out=[];let i=0;await Promise.all(Array.from({length:c},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k]);}}));return out;}

/* ---- ARCHIVE THEN STORE — THE ONE ORDERING, IN ONE PLACE ------------------------------------
 * THE INVARIANT: the raw log is the ONLY source of truth. Everything else in the store is a
 * derived view that can be thrown away and rebuilt offline. Two things broke it, both in the
 * same loop, and both are fixed here rather than at the call site — an inline fix holds the
 * instance and not the class, and this script is also SPAWNED by engine/next_regulation_ingest.js,
 * which would have inherited neither.
 *
 * 1. THE LOG OF AN UNPARSEABLE GAME WAS DELETED. The `six.p1.length<4` filter sat BEFORE the
 *    archive write, so a game the CURRENT parser chokes on had its raw log discarded — destroying
 *    the one artifact a FUTURE parser could have used, and doing it silently. The public replay
 *    pool is a rolling ~1,250 per format, so nothing can be re-fetched later. Pass A archives
 *    every log we hold; the filter now lives in pass B, where it decides a ROW and nothing else.
 *
 *    CONSEQUENCE, STATED OUT LOUD: the archive is now a strict SUPERSET of the store. It always
 *    should have been. MODE=reparse re-applies the identical filter, so a reparse still produces
 *    the same store; MODE=backfill compares ids and simply finds less missing.
 *
 * 2. THE ROW WAS WRITTEN BEFORE THE LOG. Two independent unawaited streams, row first — so a
 *    crash between them leaves a row whose log was never archived, which is the ORPHAN direction:
 *    unrecoverable. The other direction (a log with no row yet) is repaired by a free offline
 *    reparse. Pass A therefore completes AND CLOSES ITS STREAM before pass B derives anything,
 *    from the same in-memory strings — no second read, no second fetch.
 *
 * The store output is byte-identical to what the old loop produced: same iteration order, same
 * `if(!t) continue`, same filter, same JSON.stringify(rec). Only the archive gains rows. */
async function archiveThenStore(fetched, opts){
  const o=opts||{}, store=o.store||STORE, raw=o.raw||RAW;
  const closed=s=>new Promise((res,rej)=>{ s.on('error',rej); s.end(res); });

  // PASS A — the log, always, for every body we actually hold. Nothing is derived yet.
  const rawOut=fs.createWriteStream(raw,{flags:'a'}); let archived=0, noLog=0;
  for(const [x,t] of fetched){
    if(!t){ noLog++; continue; }
    rawOut.write(JSON.stringify({id:x.id,uploadtime:x.uploadtime,log:t})+'\n'); archived++;
  }
  await closed(rawOut);

  // PASS B — derive rows from the SAME strings. A game the parser cannot read costs a row, never a log.
  const out=fs.createWriteStream(store,{flags:'a'}); let added=0, unparsed=0;
  for(const [x,t] of fetched){
    if(!t) continue;
    const rec=extract(x.id,x.uploadtime,t);
    if(rec.six.p1.length<4||rec.six.p2.length<4){ unparsed++; continue; }
    out.write(JSON.stringify(rec)+'\n'); added++;
  }
  await closed(out);
  return {archived,added,unparsed,noLog};
}

async function main(){
  /* backfill mode: refetch raw logs for games that are in STORE but missing from the archive.
     WHY THIS IS NEEDED. The hourly GitHub Action appends to STORE, but the raw archive is
     gitignored (41 MB and growing), so a CI-ingested game never gets a local raw log. The store
     and the archive therefore drift apart silently, and "a new question is a re-parse, never a
     re-pull" stops being true for exactly the games CI collected. Found 2026-07-24: 453 games were
     in the store with no raw log, and a plain reparse would have deleted every one of them.
     RUN THIS BEFORE ANY REPARSE. It is idempotent and does nothing when the archive is complete. */
  if(MODE==='backfill'){
    if(!fs.existsSync(STORE)){ process.stderr.write(`no store at ${STORE}\n`); return; }
    const recs=new Map();
    for(const l of fs.readFileSync(STORE,'utf8').split('\n')){ if(!l.trim())continue;
      try{ const g=JSON.parse(l); recs.set(g.id,g); }catch(e){} }
    const have=new Set();
    if(fs.existsSync(RAW)) for(const l of fs.readFileSync(RAW,'utf8').split('\n')){ if(!l.trim())continue;
      try{ have.add(JSON.parse(l).id); }catch(e){} }
    const missing=[...recs.keys()].filter(id=>!have.has(id));
    /* `archive > store` IS THE CORRECT STATE, NOT A DEFECT. The fetch path archives the log of a
     * game its parser cannot turn into a row, so the archive is a strict SUPERSET. This line
     * measures `store \ archive` — the only direction that is ever a problem — and says so, because
     * "archive is complete" printed next to a larger archive count reads as a bug otherwise. */
    process.stderr.write(`store ${recs.size}, archive ${have.size} (a superset by design), missing ${missing.length}\n`);
    if(!missing.length){ process.stderr.write('archive is complete: every stored game has its raw log; nothing to do\n'); return; }
    // The .json endpoint carries the authoritative `uploadtime`. extract() derives `date` from it
    // (new Date(uploadtime*1000)), so guessing it corrupts the date on every backfilled record.
    // Fall back to reconstructing the timestamp from the store's own date string, which is UTC.
    const tsFromDate=d=>{ if(!d) return null; const ms=Date.parse(String(d).replace(' ','T')+':00Z');
      return Number.isFinite(ms)?Math.floor(ms/1000):null; };
    const res=await pool(missing, async id=>{
      let log=null, uploadtime=null;
      try{ const j=JSON.parse(await get(`https://replay.pokemonshowdown.com/${id}.json`)); log=j.log; uploadtime=j.uploadtime; }catch(e){}
      if(!log) log=await get(`https://replay.pokemonshowdown.com/${id}.log`);
      if(uploadtime==null) uploadtime=tsFromDate((recs.get(id)||{}).date);
      return [id,log,uploadtime];
    }, CONC);
    const out=fs.createWriteStream(RAW,{flags:'a'}); let ok=0, noLog=0, noTime=0;
    for(const [id,log,uploadtime] of res){
      if(!log||log.length<50){ noLog++; continue; }
      if(uploadtime==null){ noTime++; continue; }
      out.write(JSON.stringify({id,uploadtime,log})+'\n'); ok++;
    }
    await new Promise(r=>out.end(r));
    process.stderr.write(`backfilled ${ok} raw logs (${noLog} unavailable, ${noTime} no timestamp)\n`);
    if(noLog||noTime) process.stderr.write('WARNING: archive still incomplete — do NOT reparse yet\n');
    return;
  }
  // reparse mode: rebuild STORE from the raw-log archive, no network.
  if(MODE==='reparse'){
    if(!fs.existsSync(RAW)){ process.stderr.write(`no raw archive at ${RAW}; run a fetch first.\n`); return; }
    /* GUARD: reparse REPLACES the store with whatever the archive can rebuild, so any game the
       archive is missing is destroyed. That is not hypothetical — 453 CI-ingested games had no raw
       log on 2026-07-24. Refuse rather than silently lose them. MODE=backfill fixes it; FORCE=1
       overrides if the loss is genuinely intended. */
    if(fs.existsSync(STORE)){
      const have=new Set();
      for(const l of fs.readFileSync(RAW,'utf8').split('\n')){ if(!l.trim())continue;
        try{ have.add(JSON.parse(l).id); }catch(e){} }
      let orphan=0;
      for(const l of fs.readFileSync(STORE,'utf8').split('\n')){ if(!l.trim())continue;
        try{ if(!have.has(JSON.parse(l).id)) orphan++; }catch(e){} }
      if(orphan && !process.env.FORCE){
        process.stderr.write(`REFUSING TO REPARSE: ${orphan} stored games have no raw log.\n`+
          `Reparsing would delete them. Run:  MODE=backfill node engine/durable-ingest.js ${STORE}\n`+
          `Then reparse. Set FORCE=1 only if losing those games is intended.\n`);
        process.exitCode=1; return;
      }
    }
    /* DEDUPE BY ID, FIRST OCCURRENCE WINS — the same rule the store and the reconcile loop use.
     * The archive is now a strict superset of the store, so a game the CURRENT parser cannot read
     * has a log and no row, is therefore never in `have`, and is re-fetched and re-archived on
     * every run. That is correct — we would rather hold the log twice than not at all — but the
     * day a future parser learns to read it, an un-deduped reparse would emit one store row per
     * archived copy. A no-op on today's archive (76,431 logs, 76,431 ids) and a guarantee after. */
    const tmp=STORE+'.tmp', out=fs.createWriteStream(tmp); let n=0, dup=0; const seenIds=new Set();
    for(const l of fs.readFileSync(RAW,'utf8').split('\n')){ if(!l.trim())continue;
      let r; try{r=JSON.parse(l);}catch(e){continue;}
      if(seenIds.has(r.id)){ dup++; continue; } seenIds.add(r.id);
      const rec=extract(r.id,r.uploadtime,r.log);
      if(rec.six.p1.length<4||rec.six.p2.length<4)continue; out.write(JSON.stringify(rec)+'\n'); n++; }
    if(dup) process.stderr.write(`skipped ${dup} duplicate archived log(s) (same id seen earlier)\n`);
    out.end(); out.on('finish',()=>{ fs.renameSync(tmp,STORE); process.stderr.write(`reparsed ${n} games from raw archive -> ${STORE}\n`); });
    return;
  }
  const have=new Set();
  if(fs.existsSync(STORE)) for(const l of fs.readFileSync(STORE,'utf8').split('\n')) if(l.trim()){try{have.add(JSON.parse(l).id);}catch(e){}}
  let items=[], pagesOk=0, pagesFailed=0;
  for(const FORMAT of FORMATS){
    for(let p=1;p<=PAGES;p++){
      const j=await get(`https://replay.pokemonshowdown.com/search.json?format=${FORMAT}&page=${p}`);
      /* A REQUEST THAT NEVER COMPLETED IS NOT "NO MORE PAGES". Both used to arrive here as '' and
       * both broke the loop, so a dead endpoint read as an exhausted pool. */
      if(j===null){ pagesFailed++; process.stderr.write(`search page ${p} of ${FORMAT}: request failed\n`); break; }
      let arr; try{ arr=JSON.parse(j); }catch(e){ pagesFailed++; process.stderr.write(`search page ${p} of ${FORMAT}: unparseable body (${j.length} bytes)\n`); break; }
      if(!Array.isArray(arr)){ pagesFailed++; process.stderr.write(`search page ${p} of ${FORMAT}: body is not a list\n`); break; }
      pagesOk++;
      if(!arr.length) break;
      items.push(...arr);
    }
  }
  const idsSeen=items.length;                       // BEFORE dedupe: what the search endpoint offered
  const seen=new Set(); items=items.filter(x=>!seen.has(x.id)&&seen.add(x.id)&&!have.has(x.id));
  const newIds=items.length;
  process.stderr.write(`already stored: ${have.size}; new to fetch: ${newIds}\n`);
  const logs=await pool(items,x=>get(`https://replay.pokemonshowdown.com/${x.id}.log`).then(t=>[x,t]),CONC);
  const logsRequested=logs.length, logsNull=logs.filter(([,t])=>t===null).length;
  const r=await archiveThenStore(logs);
  process.stderr.write(`ingest counters: idsSeen=${idsSeen} newIds=${newIds} `
    +`logsRequested=${logsRequested} logsNull=${logsNull} archived=${r.archived} `
    +`rows=${r.added} unparsed=${r.unparsed} searchPagesOk=${pagesOk} searchPagesFailed=${pagesFailed}\n`);
  process.stderr.write(`appended ${r.added} games. store now ${have.size+r.added} total. raw archived -> ${RAW}\n`);

  /* ---- A ZERO-GAIN RUN MUST NOT LOOK LIKE A QUIET DAY -----------------------------------------
   * "appended 0 games" was printed with exit 0 whether the API was dead or nothing new had been
   * played. THE DISCRIMINATOR IS A FACT ABOUT THE ENDPOINT, NOT AN INVENTION: Showdown's public
   * replay pool is a ROLLING ~1,250 per format (the cadence note in .github/workflows/ingest.yml
   * is built on the same fact), so a live format ALWAYS fills page one. Zero ids offered is the
   * search being broken, never the ladder being idle.
   *
   * The exit code is the signal. The workflow keeps `continue-on-error: true` on the pull steps —
   * a collection job must never page the owner — and the shrink guard, which already runs under
   * `set -eu`, is where this becomes loud. */
  if(idsSeen===0){
    process.stderr.write(`ZERO-GAIN: the search endpoint offered NO ids for ${FORMATS.join(',')}. `
      +`The replay pool is a rolling ~1,250 per format, so a live format always fills page one. `
      +`This is the search failing, not a quiet ladder.\n`);
    process.exitCode=1; return;
  }
  if(logsRequested && logsNull/logsRequested>0.5){
    process.stderr.write(`ZERO-GAIN: ${logsNull} of ${logsRequested} log requests did not complete `
      +`(>50%). The log endpoint is failing; the ids were found but the logs were not fetched.\n`);
    process.exitCode=1; return;
  }
  if(newIds===0) process.stderr.write(`nothing new: the search offered ${idsSeen} id(s) and every one was already stored.\n`);
}
if(require.main===module) main();
/* archiveThenStore is EXPORTED so a second ingest path cannot quietly grow its own ordering. Any
 * caller that has fetched logs writes them through this and inherits both halves of the invariant. */
module.exports={extract,archiveThenStore};
