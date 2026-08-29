/* SAFEGUARD PROTECTS A SIDE, AND THIS ENGINE ONLY EVER ASKED IT ABOUT THE OTHER SIDE.
 *
 *   node tests/probe_ally_safeguard.js
 *   MEDI_SIDEBUFF_FOE_SIDE_ONLY=1 node tests/probe_ally_safeguard.js     (the red demonstration)
 *
 * THE THIRD SITE OF THE CLASS THE 2026-08-29 ally-side pass named and did not close. C2 was
 * `redirectDrawnTo`'s two callers, C3 was the attack branch's guard map; both hard-coded the far
 * side, and `docs/_reports/2026-08-29-ally-side.md` §6 filed this one unstaged. There is no shared
 * function between the three -- what they share is a SENTENCE, and this file's is written above
 * `sideBuffRefuses` in medicham2-browser.js:
 *
 *     "IT ONLY REFUSES SOMETHING WRITTEN BY THE OTHER SIDE."
 *     if(src._sf&&src._sf===sf)return null;            // an ally is not the other side
 *
 * That sentence is the bug. No handler says it.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/moves.ts` `safeguard.condition`. Champions overrides neither `safeguard` nor the condition
 * -- `data/mods/champions/moves.ts` was grepped for the id and contains no match, and `moves.ts` is
 * one of the eight files the mod DOES override, so the absence is a reading rather than a guess.
 *
 *     onSetStatus(status, target, source, effect) {
 *       if (!effect || !source) return;                                   // a source-less status walks
 *       if (effect.id === 'yawn') return;                                 // yawn's SLEEP walks
 *       if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
 *       if (target !== source) {                                          // <- the WHOLE side test
 *         this.debug('interrupting setStatus');
 *         if (effect.id === 'synchronize' || (effect.effectType === 'Move' && !effect.secondaries)) {
 *           this.add('-activate', target, 'move: Safeguard');
 *         }
 *         return null;
 *       }
 *     },
 *     onTryAddVolatile(status, target, source, effect) {
 *       if (!effect || !source) return;
 *       if (effect.effectType === 'Move' && effect.infiltrates && !target.isAlly(source)) return;
 *       if ((status.id === 'confusion' || status.id === 'yawn') && target !== source) {
 *         if (effect.effectType === 'Move' && !effect.secondaries) this.add('-activate', target, 'move: Safeguard');
 *         return null;
 *       }
 *     },
 *
 * The exclusion is `target !== source` -- IDENTITY, not side. The one place `isAlly` appears is
 * INSIDE the Infiltrator clause, and it appears there to make an ALLY'S infiltrating move still be
 * refused. So the authority is not merely silent about the near side; it names it and keeps it.
 *
 * ================= STAGED IN THE OFFICIAL SIMULATOR BEFORE ANYTHING WAS EDITED ==================
 *
 *   ally Glare, Safeguard up     |move|p1b: Pikachu|Glare|p1a: Clefable
 *                                |-activate|p1a: Clefable|move: Safeguard        (and NO -status)
 *   ally Glare, Safeguard down   |move|p1b: Pikachu|Glare|p1a: Clefable
 *                                |-status|p1a: Clefable|par
 *   ally Confuse Ray, up         |-activate|p1a: Clefable|move: Safeguard        (the VOLATILE road)
 *   ally Teeter Dance, up        |move|p1b: Tsareena|Teeter Dance|p2b: Garchomp|[spread] p1a,p2b
 *                                |-activate|p1a: Clefable|move: Safeguard
 *                                |-start|p2b: Garchomp|confusion                 (the foe still gets it)
 *
 * medicham2 paralysed, confused and confused respectively, on both arms of the knob.
 *
 * ================= WHAT THIS FILE ASSERTS THAT THE CENSUS ROWS DO NOT ===========================
 *
 * The census rows are the ratchet; this is the knob. `MEDI_SIDEBUFF_FOE_SIDE_ONLY=1` puts the ally
 * exclusion back and reds EXACTLY the four near-side arms -- the Glare, its `-activate` line, the
 * Confuse Ray and the Teeter Dance -- and nothing else. The remaining seven are the negative arms an
 * over-firing fix breaks: a refusal that stopped asking WHOSE side the condition is on, or stopped
 * exempting the body from itself, or reached a stat drop or a damage roll, changes boards that are
 * correct today.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));

const OFF = process.env.MEDI_SIDEBUFF_FOE_SIDE_ONLY === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n  SAFEGUARD ON THE CASTER\'S OWN SIDE' + (OFF ? '   [MEDI_SIDEBUFF_FOE_SIDE_ONLY=1]' : ''));

/* ---- THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS WIRED TO IT ------------------------------------
 * `sideBuff` is the tag the near half lands on, and the fix is inside its ONE reader -- so whatever
 * carries the tag gains the near half without a name being spelled into the engine. Printed on every
 * run so that a second carrier arriving later is visible here rather than assumed. */
const carriers = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('sideBuff') >= 0)
  .map(k => k + ' ' + JSON.stringify((TAGS.moves[k].params || {}).sideBuff) + ' {' + TAGS.moves[k].uses + ' uses}');
console.log('\n  DERIVED — moves carrying `sideBuff` (every one of them gains the near half):');
console.log('    ' + (carriers.join('\n    ') || 'NONE'));
/* The two roads the tag opens. `blocksStatus` is `onSetStatus`; `blocksVolatile` is
 * `onTryAddVolatile`. They are separate handlers in the authority and separate calls here, so both
 * are exercised below rather than one standing in for the other. */
const roads = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('sideBuff') >= 0)
  .map(k => (TAGS.moves[k].params || {}).sideBuff || {})
  .reduce((a, p) => { for (const r of ['blocksStatus', 'blocksVolatile', 'blocksStatDrop']) if (p[r]) a.add(r); return a; }, new Set());
console.log('  DERIVED — the roads this format\'s side buffs actually block: ' + [...roads].join(', '));
if (!roads.has('blocksStatus') || !roads.has('blocksVolatile')) {
  console.log('  FIXTURE — this probe stages both roads and the tag no longer carries both.');
  bad++;
}

/* ---- THE FIXTURE -------------------------------------------------------------------------------
 * p1a raises the side condition on turn 1 and does nothing on turn 2. p1b, its PARTNER, casts at it.
 * The knob is the turn-1 click and nothing else about the board moves.
 *
 * Glare and Confuse Ray are 100-accuracy — derived, not chosen for taste: they and Spore, Toxic
 * Thread, Flatter, Teeter Dance and Yawn are the format's ENTIRE set of `Status`-category moves at
 * accuracy >= 100 that write a status or a confusion/yawn volatile. Thunder Wave is 90 and a coin
 * that lands the comfortable way is exactly the failure this file exists to avoid — the first
 * staging of this defect drew a `[miss]` on its control arm. */
const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row ' + sp);
  b.item = ''; b.ability = 'none'; return b; };
const rng5 = () => 0.5;

function turn(o) {
  const me = bare(o.user || 'clefable');
  const ally = bare(o.ally || 'pikachu');
  const f1 = bare(o.foe1 || 'garchomp');
  const f2 = bare(o.foe2 || 'incineroar');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  const act = (mon, mv, tgt) => mv ? M.playerAction(mon, mv, tgt || null, S.field) : { kind: 'pass' };
  /* turn 1 — the knob: our side raises the condition, or the FOE side does, or nobody does. */
  M.battleTurn(S, rng5,
    new Map([[me, act(me, o.t1me, me)], [ally, { kind: 'pass' }]]),
    new Map([[f1, act(f1, o.t1foe, f1)], [f2, { kind: 'pass' }]]));
  const sc = JSON.stringify((me._sf && me._sf.sc) || {});
  const scFoe = JSON.stringify((f1._sf && f1._sf.sc) || {});
  /* turn 2 — the cast. `castBy` says which body clicks it, and every one of them aims at `me`. */
  const cast = { ally: [ally, me], foe: [f1, me], self: [me, me] }[o.castBy || 'ally'];
  const acts = new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]);
  const facts = new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]);
  const a = o.cast ? act(cast[0], o.cast, cast[1]) : { kind: 'pass' };
  (acts.has(cast[0]) ? acts : facts).set(cast[0], a);
  M.battleTurn(S, rng5, acts, facts);
  /* THE VOLATILE'S NAME IS READ OFF THE ENGINE, NOT GUESSED. `applyConfusion` writes
   * `t._vol.confusion`; a probe that asked for `me.confused` reads `undefined` on every arm and
   * would have called the CONTROL green while measuring nothing at all. It did, first time. */
  const cf = (x) => !!(x && x._vol && x._vol.confusion > 0);
  return { status: me.status || '-', conf: cf(me), sc, scFoe, trace, kind: a && a.kind,
           foeConf: cf(f1) || cf(f2), foeStatus: f1.status || '-' };
}
const show = (r) => '[status ' + r.status + ', confused ' + r.conf + ', our sc ' + r.sc + ']';
const said = (r) => r.trace.filter(l => /Safeguard/i.test(String(l)) && /-activate/.test(String(l)));

/* ---- 1/2. THE STATUS ROAD — `onSetStatus` ------------------------------------------------------ */
const glareNo = turn({ cast: 'glare' });
ok(glareNo.status === 'par' && glareNo.kind === 'status',
  'CONTROL: with nothing up, our partner\'s Glare paralyses us', show(glareNo));

const glareSG = turn({ t1me: 'safeguard', cast: 'glare' });
ok(glareSG.status === '-', 'our OWN Safeguard refuses our OWN partner\'s Glare',
  show(glareSG) + '  — expected status "-".' + (OFF ? '  This is an arm the knob reds.' : ''));

/* ---- 3. AND IT ANNOUNCES, NAMING THE BODY IT SHIELDED ------------------------------------------ */
/* `this.add('-activate', target, 'move: Safeguard')` fires for a MOVE with no secondaries, which
 * Glare is. One line, naming the shielded partner, on our own side. */
ok(said(glareSG).length === 1 && /clefable/i.test(String(said(glareSG)[0])),
  'the near-side refusal announces `-activate` naming the shielded body',
  (said(glareSG).join(' | ') || '(no -activate line)')
  + '\n          full trace: ' + glareSG.trace.join(' | '));

/* ---- 4/5. THE VOLATILE ROAD — `onTryAddVolatile`, a DIFFERENT handler ------------------------- */
const crNo = turn({ ally: 'gengar', cast: 'confuseray' });
ok(crNo.conf === true, 'CONTROL: with nothing up, our partner\'s Confuse Ray confuses us', show(crNo));

const crSG = turn({ t1me: 'safeguard', ally: 'gengar', cast: 'confuseray' });
ok(crSG.conf === false, 'our OWN Safeguard refuses our OWN partner\'s Confuse Ray',
  show(crSG) + '  — expected confused false.' + (OFF ? '  This is an arm the knob reds.' : ''));

/* ---- 6. THE KNOB MOVES THE OUTCOME ------------------------------------------------------------- */
ok(!(glareNo.status === glareSG.status && crNo.conf === crSG.conf) || OFF,
  'the Safeguard knob MOVES the outcome on both roads',
  'none ' + show(glareNo) + ' / ' + show(crNo) + '   safeguard ' + show(glareSG) + ' / ' + show(crSG)
  + '  — identical readings across a varied click mean the near axis is unwired');

/* ================= THE NEGATIVE ARMS ============================================================
 * An over-firing fix refuses statuses that should land, which is worse than the gap: it changes
 * boards that are correct today. Each arm below is a clause of the handler, one clause per arm.
 * ============================================================================================== */

/* ---- 7. THE REGRESSION CONTROL: the FAR half, which has worked since WIRE 133 ------------------ */
const foeSG = turn({ t1me: 'safeguard', castBy: 'foe', cast: 'glare' });
const foeNo = turn({ castBy: 'foe', cast: 'glare' });
ok(foeSG.status === '-' && foeNo.status === 'par',
  'a FOE\'s Glare is still refused — unchanged, both arms',
  'safeguard ' + show(foeSG) + '  none ' + show(foeNo));

/* ---- 8. WHOSE SIDE IT IS ON STILL DECIDES. The FOES raise it; ours is bare. -------------------- */
/* This is the arm that fails if the fix deletes the side question instead of widening it. */
const theirSG = turn({ t1foe: 'safeguard', cast: 'glare' });
ok(theirSG.status === 'par' && theirSG.scFoe.indexOf('safeguard') >= 0,
  'the FOES\' Safeguard does NOT protect our body from our own partner',
  show(theirSG) + '  their sc ' + theirSG.scFoe + '  — a side condition still belongs to a side');

/* ---- 9. `target !== source` — THE BODY IS STILL NOT SHIELDED FROM ITSELF ----------------------- */
/* Rest is a self-inflicted sleep. The authority's exclusion is IDENTITY, so it lands under a
 * Safeguard; a fix that read "same side" as "refuse" would break it. Staged on a DAMAGED body,
 * because Rest at full HP fails for a reason that has nothing to do with this. */
const restSG = (() => {
  const me = bare('clefable'), ally = bare('pikachu'), f1 = bare('garchomp'), f2 = bare('incineroar');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'safeguard', me, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  me.curHP = Math.max(1, Math.floor(me.maxHP / 2));
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'rest', me, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { status: me.status || '-', sc: JSON.stringify(me._sf.sc), trace };
})();
ok(restSG.status === 'slp',
  'a SELF-inflicted sleep still lands under our own Safeguard — the exclusion is identity',
  '[status ' + restSG.status + ', our sc ' + restSG.sc + ']  — `if (target !== source)`');

/* ---- 10. A SPREAD MOVE THAT REACHES BOTH SIDES SHIELDS ONLY OURS ------------------------------- */
/* Teeter Dance is `allAdjacent`, so it confuses our partner AND both foes. The near half must stop
 * the one on our side and must not touch the two on theirs. */
const tdSG = turn({ t1me: 'safeguard', ally: 'tsareena', cast: 'teeterdance' });
const tdNo = turn({ ally: 'tsareena', cast: 'teeterdance' });
ok(tdSG.conf === false && tdSG.foeConf === true && tdNo.conf === true,
  'our own Teeter Dance confuses the FOES and not our shielded partner',
  'safeguard ' + show(tdSG) + ' foe confused ' + tdSG.foeConf
  + '   none ' + show(tdNo) + ' foe confused ' + tdNo.foeConf);

/* ---- 11. IT REFUSES A STATUS, NOT A STAT DROP -------------------------------------------------- */
/* `blocksStatDrop` is a separate flag on the same tag and Safeguard does not carry it (block 0
 * prints which flags the format's carriers do). An ally's Icy Wind must still drop our Speed. */
const drop = turn({ t1me: 'safeguard', ally: 'gengar', cast: 'icywind' });
const dropNo = turn({ ally: 'gengar', cast: 'icywind' });
ok(drop.status === '-' && dropNo.status === '-',
  'a stat drop is not a status — Safeguard carries `blocksStatus`, not `blocksStatDrop`',
  'safeguard ' + show(drop) + '  none ' + show(dropNo));

/* ---- 12. A DAMAGING MOVE IS UNTOUCHED ---------------------------------------------------------- */
/* Nothing about the near half may reach damage. Our partner's Earthquake still hits us for the
 * same amount with the Safeguard up as with it down. */
const eqPair = ['safeguard', null].map((t1) => {
  const me = bare('clefable'), ally = bare('garchomp'), f1 = bare('incineroar'), f2 = bare('clefable');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  M.battleTurn(S, rng5,
    new Map([[me, t1 ? M.playerAction(me, t1, me, S.field) : { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const h0 = me.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, { kind: 'pass' }], [ally, M.playerAction(ally, 'earthquake', f1, S.field)]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return h0 - me.curHP;
});
ok(eqPair[0] === eqPair[1] && eqPair[0] > 0,
  'our partner\'s Earthquake still hits us for the same amount, Safeguard or not',
  'safeguard ' + eqPair[0] + '  none ' + eqPair[1] + '  — Safeguard is not a damage guard');

/* ---- 13. THE SIDE CONDITION STILL EXPIRES ------------------------------------------------------ */
/* Five turns, and the near half must not extend or shorten it. */
{
  const me = bare('clefable'), ally = bare('pikachu'), f1 = bare('garchomp'), f2 = bare('incineroar');
  const trace = [];
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, 'safeguard', me, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const first = me._sf.sc.safeguard;
  for (let i = 0; i < 4; i++) M.battleTurn(S, rng5,
    new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  ok(first === 4 && !(me._sf.sc.safeguard > 0),
    'the condition still runs its five turns and then ends',
    'after the click ' + first + ', four turns later ' + JSON.stringify(me._sf.sc));
}

/* ---- THE DEFECT'S OWN NUMBERS ------------------------------------------------------------------ */
const seen = M.MEDSEEN || {}, fails = M.MEDFAILS || {};
console.log('\n  COUNTERS  sideBuffRefused=' + (seen.sideBuffRefused || 0)
  + '  allySideBuffRefused=' + (seen.allySideBuffRefused || 0)
  + '  sideBuffFoeSideOnlyRestored=' + (fails.sideBuffFoeSideOnlyRestored || 0));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
