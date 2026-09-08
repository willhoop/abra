/* probe_midturn_herb_resort.js — THE POST-ACTION RE-SORT IS THE *LAST* THING IN `runAction`, SO A
 * WHITE HERB SPENT BY THE `Update` PASS THAT CLOSES A PIVOT SWITCH REACHES IT. THIS ENGINE SORTED
 * FIRST AND SPENT THE HERB AFTERWARDS, SO UNBURDEN'S DOUBLING ARRIVED ONE ACTION TOO LATE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_midturn_herb_resort.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `7f012a9afe01`
 * (`data/game-differential.json`, 961 games, census digest `fa4c4746e13f`, pool
 * `data/team-pool-frozen`, `--steering empirical --arm middle`). It is the ONE row in that run's
 * `order_probe` carrying `speed_tied:false` AND `same_priority:true` — ROADMAP #290's gate, and one
 * of the two clauses holding the quarantine shut:
 *
 *   config omit-weather, seed ...bo3-2655813620 vs ...bo3-2655861625, turn 2, index 30
 *   ordering :: |move|p2a|closecombat <> |move|p2b|tailwind        speed gap 286, both priority 0
 *
 *     the six agreed lines immediately before it
 *       |move|p1a: Incineroar|Parting Shot|p2a: Sneasler
 *       |-unboost|p2a: Sneasler|atk|1
 *       |-unboost|p2a: Sneasler|spa|1
 *       |switch|p1a: Rotom|Rotom-Mow, L50|125/125|[from] Parting Shot
 *       |-enditem|p2a: Sneasler|White Herb
 *       |-clearnegativeboost|p2a: Sneasler|[silent]
 *     then    showdown   |move|p2a: Sneasler|Close Combat|p1a: Rotom
 *             medicham2  |move|p2b: Aerodactyl|tailwind|p2b: Aerodactyl
 *
 * IT IS NOT A SPEED TIE AND IT IS NOT A PRIORITY MODIFIER. Neither body carries Gale Wings or
 * Prankster — the sheet gives Sneasler `Unburden` and Aerodactyl `Unnerve`, and this probe re-derives
 * that class membership from the format rather than trusting the sentence.
 *
 * THE RULE, READ OFF THE AUTHORITY. `Battle#runAction` ends with
 *
 *     if (this.gen >= 8 && (this.queue.peek()?.choice === 'move' || ... )) {
 *       // In gen 8, speed is updated dynamically so update the queue's speed properties and sort it.
 *       this.updateSpeed();
 *       for (const queueAction of this.queue.list) {
 *         if (queueAction.pokemon) this.getActionSpeed(queueAction);
 *       }
 *       this.queue.sort();
 *     }
 *                                                              sim/battle.ts:2915-2923
 *
 * and that block is BELOW `this.eachEvent('Update')` at sim/battle.ts:2856, which is where an
 * `onUpdate` item settles. White Herb is one (`data/items.ts`, four triggers, all the same body), and
 * `unburden.onAfterUseItem` adds the volatile whose `onModifySpe` is `chainModify(2)` the instant the
 * item leaves. So the herb is spent, the doubling exists, and only THEN is the remaining queue sorted.
 *
 * MEASURED IN THE AUTHORITY, by wrapping `Battle.prototype.runAction` on this very fixture:
 *     AFTER runSwitch <entrant> | queue: <holder>@344/p0:move, <ally>@184/p0:move, residual
 * — 344 against a base reading of 172, in front of a 184 ally, and the sort puts the holder first.
 *
 * WHY THIS ENGINE MISSED IT. medicham2 has no queue object: the tail of action k-1 is emulated at the
 * TOP of iteration k. Inside that block `_resortTail(actIdx)` stood ABOVE `_updateAll()`, i.e. above
 * the pass that carries `restoreStatsAll` — White Herb's `onAnySwitchIn` / `onAnyAfterMove` door for
 * every mid-turn spend. The counters say so rather than the reasoning: on this fixture the pre-fix
 * engine reads `queueResorted 2, queueResortChangedOrder 0` — the re-sort RAN and saw no change,
 * because the item was still in the hand when it looked.
 *
 * THE FIXTURE. One turn, no damage roll worth reading, no accuracy die, no KO.
 *   a PIVOT body clicks a stat-dropping self-switch move at the herb holder;
 *   the herb holder is the SLOWER of the two bodies on its side and doubles when the item goes;
 *   its ALLY sits strictly between the holder's Speed and twice it, so the ONLY thing that can put
 *   the holder in front is the mid-turn doubling.
 * Every one of those inequalities is CHECKED against the authority's own `getActionSpeed()` readings
 * rather than computed here; a candidate that does not satisfy them is refused BY NAME and the next
 * one is tried, because a COULD-NOT-STAGE verdict is a claim about the fixture and never about the
 * mechanic.
 *
 * THE ARMS:
 *   REAL     the speed ability on the holder. Both engines must run the holder's move before the ally's.
 *   SILENT   the identical board with a NON-speed ability on the holder. The herb still spends at the
 *            same place and BOTH engines must run the ALLY first — that is what proves the order in
 *            the real arm is the ability and not the way the board was built.
 *   CONTROL  `MEDI_RESORT_BEFORE_UPDATE=1` in a child. The REAL arm must part again under it, and the
 *            SILENT arm must NOT move. An identical result across a varied knob means the knob is
 *            unwired, not that the placement does not matter.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_RESORT_BEFORE_UPDATE === '1';
require(D('tests', '_live_release.js'));

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let bad = 0;
const NL = String.fromCharCode(10);

/* ================================================================================================
 * 1. THE CAST, DERIVED FROM THE FORMAT. Nothing here is a remembered Pokemon fact.
 * ============================================================================================== */
const abilitiesOf = s => Object.values(s.abilities || {}).map(norm);
const learns = (s, mv) => {                       /* walk the prevo chain, as a learnset lookup must */
  let cur = s;
  for (let g = 0; cur && g < 6; g++) {
    const l = dex.species.getLearnsetData(cur.id);
    if (l && l.learnset && l.learnset[mv]) return true;
    cur = cur.prevo ? dex.species.get(cur.prevo) : null;
  }
  return false;
};
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''));

/* THE SPEED ABILITY IS READ OFF OUR OWN TAG, NOT OFF A NAME. `speedOnItemLoss` is the param
 * effSpeed() consults, so the arm is built from the same fact the engine reads — and it is PRINTED,
 * because a derived tag that over-matches is this division's standing hazard. */
const TAGS = require(D('data', 'tags.json'));
const carriers = (ns, tag) => Object.keys(TAGS[ns] || {})
  .filter(k => ((TAGS[ns][k] || {}).tags || []).includes(tag));
const SPEED_ON_LOSS = carriers('abilities', 'speedOnItemLoss');
console.log(NL + '  === THE CAST, DERIVED THIS RUN ===');
console.log('  `speedOnItemLoss` abilities in data/tags.json : ' + (SPEED_ON_LOSS.join(', ') || '(none)'));
if (!SPEED_ON_LOSS.length) { console.log('  NOT STAGED — nothing carries the tag this probe is about.'); process.exit(1); }

/* THE ITEM: the one that restores lowered stages, read off the tag rather than named. */
const HERBS = carriers('items', 'restoresStats');
console.log('  `restoresStats` items in data/tags.json       : ' + (HERBS.join(', ') || '(none)'));
if (HERBS.length !== 1) { console.log('  NOT STAGED — the herb is not a single item.'); process.exit(1); }
const HERB = dex.items.get(HERBS[0]);

/* THE PIVOT MOVE: a SELF-SWITCH status move aimed at a foe that also lowers a stat on it.
 *
 * "ALSO LOWERS A STAT" IS NOT DERIVABLE FROM THE MOVE DATA AND THE FIRST DRAFT ASSUMED IT WAS. Every
 * Status self-switch move in this format reports `boosts: undefined` — the drop lives inside an
 * `onHit` body — so a filter on `m.boosts` matched NOTHING and the probe printed NOT STAGED, which is
 * a claim about the fixture and never about the mechanic. The candidates are now enumerated by the
 * half that IS derivable and the drop is CHECKED on the staged board. */
const PIVOT_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.selfSwitch && m.target === 'normal').sort((a, b) => a.id.localeCompare(b.id));
console.log('  self-switch status moves aimed at a foe       : '
  + (PIVOT_MOVES.map(m => m.name + ' (pri ' + m.priority + ')').join(', ') || '(none)'));
if (!PIVOT_MOVES.length) { console.log('  NOT STAGED — the format carries no such move.'); process.exit(1); }

/* THE HOLDER: carries the `speedOnItemLoss` ability AND a boring priority-0 damaging move it can
 * click. The move is picked for having no secondary, no recoil and no charge, so the only thing this
 * probe can see is the ORDER. */
const BORING = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category !== 'Status'
  && m.priority === 0 && !m.secondaries && !m.secondary && !m.recoil && !m.selfSwitch
  && !(m.flags && m.flags.charge) && !m.multihit && (m.accuracy === true || m.accuracy >= 100)
  && m.target === 'normal').sort((a, b) => a.id.localeCompare(b.id));
const HOLDERS = POOL.filter(s => abilitiesOf(s).some(a => SPEED_ON_LOSS.includes(a)))
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe);
console.log('  legal bodies carrying that ability            : '
  + HOLDERS.map(s => s.name + ' ' + s.baseStats.spe).join(', '));
if (!HOLDERS.length) { console.log('  NOT STAGED — no legal carrier.'); process.exit(1); }

/* THE CANDIDATE BOARDS. The ally sits strictly between the holder's base Speed and twice it, so the
 * doubling is the ONLY thing that can reorder the two of them; the pivot is scarfed so it acts
 * first. All three inequalities are re-checked below against the authority's own readings. */
const CANDIDATES = [];
for (const h of HOLDERS) {
  const mv = BORING.find(m => learns(h, m.id));
  if (!mv) continue;
  const hAb = Object.values(h.abilities).find(a => SPEED_ON_LOSS.includes(norm(a)));
  const qAb = Object.values(h.abilities).find(a => !SPEED_ON_LOSS.includes(norm(a)));
  if (!hAb || !qAb) continue;
  for (const pm of PIVOT_MOVES) {
    for (const p of POOL.filter(s => learns(s, pm.id)).sort((x, y) => y.baseStats.spe - x.baseStats.spe)) {
      for (const a of POOL) {
        if (a.id === h.id || a.id === p.id) continue;
        if (!(a.baseStats.spe > h.baseStats.spe && a.baseStats.spe < 2 * h.baseStats.spe)) continue;
        if (!learns(a, 'tailwind')) continue;                        /* a priority-0 status click */
        if (!(p.baseStats.spe * 1.5 > a.baseStats.spe)) continue;    /* the pivot must go first */
        CANDIDATES.push({ p, pm, h, mv, a, hAb, qAb });
      }
    }
  }
}
console.log('  candidate boards satisfying the speed window  : ' + CANDIDATES.length);
if (!CANDIDATES.length) { console.log('  NOT STAGED — no (pivot, holder, ally) triple fits.'); process.exit(1); }

/* ================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const MOVE_RE = /^\|move\|/;
const bodyOf = l => String(l).split('|')[2] || '';
const nameOf = l => norm(bodyOf(l).replace(/^p[12][ab]:\s*/, ''));

const build = (C, ability) => {
  /* A bench that cannot collide with the cast, derived rather than named. */
  const FILL = POOL.filter(s => ![C.p.id, C.h.id, C.a.id].includes(s.id) && learns(s, 'protect'))
    .map(s => s.name);
  return {
    A: stage([[C.p.name, 'Choice Scarf', Object.values(C.p.abilities)[0], [C.pm.name]],
              [FILL[0], '', '', ['Protect']]]).concat(BENCH(FILL[1], FILL[2])),
    B: stage([[C.h.name, HERB.name, ability, [C.mv.name, 'Protect']],
              [C.a.name, '', '', ['Tailwind', 'Protect']]]).concat(BENCH(FILL[3], FILL[4])),
    script: [{ p1: [{ m: norm(C.pm.id), t: 0 }, { m: 'protect' }],
               p2: [{ m: norm(C.mv.id), t: 0 }, { m: 'tailwind' }] }],
  };
};

const run = (C, ability, tag) => {
  const spec = build(C, ability);
  const a = G.buildPair(spec.A), b = G.buildPair(spec.B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  const r = G.playGame(a, b, 'directed', 'probe_midturn_herb_resort :: ' + tag,
                       { script: spec.script, speedCensus: true });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const herbLine = l => /^\|-enditem\|/.test(l) && norm(String(l).split('|')[3]) === norm(HERB.name)
                        && nameOf(l) === norm(C.h.name);
  const dropLine = l => /^\|-unboost\|/.test(l) && nameOf(l) === norm(C.h.name);
  /* THE ORDER CLAIM IS MADE WITHIN ONE STREAM, NEVER ACROSS TWO. The authority's raw log carries a
   * preamble medicham2 has no equivalent of, so a shared index would mean nothing. What is compared
   * is WHICH BODY moved first among the two on the herb side, in each stream separately. */
  const firstOf = (arr) => {
    for (const l of arr) {
      if (!MOVE_RE.test(l)) continue;
      const who = nameOf(l);
      if (who === norm(C.h.name)) return 'holder';
      if (who === norm(C.a.name)) return 'ally';
    }
    return null;
  };
  const cen = (r.speedCensus || []).filter(x => x.when === 0);
  const speedOf = nm => { const x = cen.find(y => norm(y.body) === norm(nm)); return x ? x.showdown : null; };
  return { staged: true, r,
           sdFirst: firstOf(sd), meFirst: firstOf(me),
           sdHerb: sd.some(herbLine), meHerb: me.some(herbLine),
           sdDrop: sd.some(dropLine), meDrop: me.some(dropLine),
           speeds: { pivot: speedOf(C.p.name), holder: speedOf(C.h.name), ally: speedOf(C.a.name) },
           /* WHICH ENGINE IS WRONG — THE NUMBER, OR THE ORDER? Those need different fixes, and the
            * order pair alone cannot tell them apart. `speedRows` is the differential's own
            * boundary-by-boundary comparison of the AUTHORITY's `getActionSpeed()` against this
            * engine's `effSpeed()` for every active body, and it carries ONLY the readings that
            * DISAGREE. Empty means both engines put the same number in the sort key, so a parted
            * order is the SORT and cannot be the speed. Read off each side, never assumed from one. */
           speedDisagreements: (r.speedRows || []).length,
           speedDisagreeRows: (r.speedRows || []).slice(0, 4),
           speedDesync: r.speedDesync || 0,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

/* THE STAGING LOOP. A candidate is accepted only when the AUTHORITY's stream shows the drop, the
 * herb coming off, and the three speed inequalities holding on its own readings. A refusal names
 * which clause failed. */
let CAST = null, REAL = null;
const refused = [];
for (const C of CANDIDATES.slice(0, 40)) {
  const R = run(C, C.hAb, CHILD ? 'real-control' : 'real');
  const label = C.p.name + '/' + C.h.name + '/' + C.a.name + ' [' + C.pm.name + ']';
  if (!R.staged) { refused.push(label + ': ' + R.why); continue; }
  const S0 = R.speeds;
  const why = !R.sdDrop ? 'the authority never lowered a stat on the holder'
            : !R.sdHerb ? 'the herb never came off in the authority'
            : (S0.holder == null || S0.ally == null || S0.pivot == null) ? 'a speed reading was missing'
            : !(S0.holder < S0.ally) ? 'the holder is not slower than its ally (' + S0.holder + ' vs ' + S0.ally + ')'
            : !(2 * S0.holder > S0.ally) ? 'twice the holder does not beat the ally'
            : !(S0.pivot > S0.ally && S0.pivot > S0.holder) ? 'the pivot does not act first'
            : null;
  if (why) { refused.push(label + ': ' + why); continue; }
  CAST = C; REAL = R; break;
}
if (!CAST) {
  console.log(NL + '  NOT STAGED — every candidate was refused, and this is a claim about the FIXTURE:');
  for (const x of refused.slice(0, 12)) console.log('    ' + x);
  process.exit(1);
}
console.log(NL + '  chosen: ' + CAST.p.name + ' @ Choice Scarf clicks ' + CAST.pm.name + ' at '
  + CAST.h.name + ' @ ' + HERB.name + ' [' + CAST.hAb + '], whose ally ' + CAST.a.name + ' clicks Tailwind.');
console.log('          ' + CAST.h.name + ' clicks ' + CAST.mv.name + '.');
console.log('          ' + (refused.length ? refused.length + ' earlier candidate(s) refused, first: ' + refused[0]
                                           : 'the first candidate staged'));
console.log('          silent-arm ability on the same body: ' + CAST.qAb);

console.log(NL + '  === THE REAL ARM — ' + CAST.hAb + ' on the herb holder ===');
console.log('  authority getActionSpeed at turn 0: pivot ' + REAL.speeds.pivot
  + ' (scarfed), holder ' + REAL.speeds.holder + ', ally ' + REAL.speeds.ally);
console.log('  stat dropped on the holder?  showdown ' + REAL.sdDrop + '   medicham2 ' + REAL.meDrop);
console.log('  herb spent?                  showdown ' + REAL.sdHerb + '   medicham2 ' + REAL.meHerb);
console.log('  moved first on that side:    showdown ' + REAL.sdFirst + '   medicham2 ' + REAL.meFirst);
console.log('  speed readings that DISAGREE between the engines (getActionSpeed vs effSpeed, every '
  + 'active body at every boundary): ' + REAL.speedDisagreements + '   [desyncs ' + REAL.speedDesync + ']');
for (const x of REAL.speedDisagreeRows) console.log('      ' + JSON.stringify(x));
console.log('  first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log(NL + '  === THE SILENT CONTROL — the same board, ability ' + CAST.qAb + ' ===');
const SIL = run(CAST, CAST.qAb, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
console.log('  herb spent?                  showdown ' + SIL.sdHerb + '   medicham2 ' + SIL.meHerb);
console.log('  moved first on that side:    showdown ' + SIL.sdFirst + '   medicham2 ' + SIL.meFirst);

if (CHILD) {
  console.log(NL + '  CONTROL ARM (MEDI_RESORT_BEFORE_UPDATE=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    cast: CAST.p.name + '/' + CAST.h.name + '/' + CAST.a.name,
    meFirst: REAL.meFirst, div: !!REAL.div, divLine: REAL.div && REAL.div.me,
    silFirst: SIL.meFirst, silDiv: !!SIL.div, speedDis: REAL.speedDisagreements,
  }));
  console.log(NL + 'green — the control arm ran');
  process.exit(0);
}

console.log(NL + '  === THE VERDICT ===');
const cmp = (what, ok, detail) => {
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + detail);
  if (!ok) bad++;
  return ok;
};
const S = REAL.speeds;
/* THE FIXTURE FIRST — every inequality this probe rests on, checked against the AUTHORITY's readings
 * and not against the base stats the cast was chosen from. */
cmp('the fixture: the holder is SLOWER than its ally', S.holder < S.ally, S.holder + ' < ' + S.ally);
cmp('the fixture: twice the holder is FASTER than the ally', 2 * S.holder > S.ally,
    '2 x ' + S.holder + ' = ' + (2 * S.holder) + ' > ' + S.ally);
cmp('the fixture: the pivot outruns both, so it acts first', S.pivot > S.ally && S.pivot > S.holder, 'pivot ' + S.pivot);
cmp('the fixture: the herb really was spent in the authority', REAL.sdHerb, String(REAL.sdHerb));
cmp('the fixture: ...and in medicham2', REAL.meHerb, String(REAL.meHerb));
/* WHICH ENGINE IS WRONG, AND ABOUT WHAT. A parted order has exactly two causes and they need
 * different fixes: the two engines disagree about the SPEED they sorted on, or they agree about the
 * speed and disagree about WHEN they sorted. This asks the first question so the answer to the
 * second is not an assumption — both sides are read, neither is inferred from the other. */
cmp('the two engines agree on EVERY speed reading, so any parted order is the SORT and not the number',
    REAL.speedDisagreements === 0, REAL.speedDisagreements + ' disagreeing reading(s)');
/* THE AUTHORITY SECOND, as a control on the derivation above. */
cmp('the authority runs the HOLDER first once the item is gone', REAL.sdFirst === 'holder', String(REAL.sdFirst));
/* THEN THE ENGINE. */
cmp('medicham2 runs the holder first too', REAL.meFirst === 'holder', String(REAL.meFirst));
cmp('the real arm does not part at all', REAL.div === null, REAL.div ? JSON.stringify(REAL.div) : 'none');
/* AND THE SILENT CONTROL — the same board with no speed ability must go the OTHER way in BOTH
 * engines. A probe whose two arms give the same order is measuring the board, not the mechanic. */
cmp('SILENT CONTROL: the herb still spends in the authority', SIL.sdHerb, String(SIL.sdHerb));
cmp('SILENT CONTROL: and in medicham2', SIL.meHerb, String(SIL.meHerb));
cmp('SILENT CONTROL: the authority runs the ALLY first', SIL.sdFirst === 'ally', String(SIL.sdFirst));
cmp('SILENT CONTROL: medicham2 runs the ally first too', SIL.meFirst === 'ally', String(SIL.meFirst));
cmp('SILENT CONTROL: and that game does not part', SIL.div === null, SIL.div ? JSON.stringify(SIL.div) : 'none');
cmp('THE TWO ARMS DISAGREE, so the ability is what decides the order', REAL.sdFirst !== SIL.sdFirst,
    'real ' + REAL.sdFirst + ' vs silent ' + SIL.sdFirst);

{
  const { spawnSync } = require('child_process');
  console.log(NL + '  --- re-running under MEDI_RESORT_BEFORE_UPDATE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_RESORT_BEFORE_UPDATE: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split(NL).map(l => '  |' + l).join(NL) + NL);
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log(NL + '  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log(NL + '  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    cmp('the control child staged the SAME board', ctl.cast === CAST.p.name + '/' + CAST.h.name + '/' + CAST.a.name,
        ctl.cast);
    cmp('the knob CHANGES the real arm', ctl.meFirst !== REAL.meFirst,
        'default ' + REAL.meFirst + ' vs control ' + ctl.meFirst
        + (ctl.meFirst === REAL.meFirst ? '   [an identical result across a varied knob means the knob is UNWIRED]' : ''));
    cmp('the control arm parts on its own line, so the knob reached the RULE', ctl.div === true,
        ctl.divLine ? String(ctl.divLine) : 'no divergence at all');
    cmp('the SILENT arm does NOT move under the knob', ctl.silFirst === SIL.meFirst,
        'default ' + SIL.meFirst + ' vs control ' + ctl.silFirst);
    cmp('...and the silent arm still does not part under the knob', ctl.silDiv === false, String(ctl.silDiv));
    /* AND THE KNOB MOVED THE ORDER WITHOUT MOVING THE NUMBER. Under the old placement the engines
     * still agree on every speed reading and STILL part on the order — which localises the defect to
     * WHEN the queue was sorted and rules out the other candidate cause outright. */
    cmp('the knob does NOT move any speed reading — it moves only WHEN the sort happened',
        ctl.speedDis === 0, 'disagreeing readings under the knob: ' + ctl.speedDis);
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
