/* A PUNISH ABILITY'S STATUS ARRIVED WITH NO SOURCE, SO EVERY GUARD THAT NEEDS ONE STOOD DOWN.
 *
 *   node tests/probe_punish_status_source.js
 *   MEDI_PUNISH_STATUS_SOURCELESS=1 node tests/probe_punish_status_source.js   (the red demonstration)
 *
 * ================= THE GAME THAT FOUND IT =======================================================
 *
 * The LAST board parting in the held-out 12,000-game draw on release `c2d68f8cab07`
 * (`data/verification/game-differential.g12000.json`, `state.first_board_divergences[0]`;
 * `--games 12000 --arm middle --steering empirical --team-store data/team-pool-frozen`,
 * census pin `data/verification/census-pin-3a69f40d67f4.json`):
 *
 *   config  omit-weather
 *   seed    gen9championsvgc2026regmbbo3-2654574813 vs gen9championsvgc2026regmbbo3-2654567638
 *   turn    9
 *   p1.party.sinistcha.hp      medicham 75   showdown 84
 *   p1.party.sinistcha.status  medicham brn  showdown ""
 *
 * The 9 hp is the burn's own residual. The board line either engine writes at that instant
 * (`data/divergence-turns.json`, the same run):
 *
 *   showdown   |faint|p2b: Primarina
 *   medicham   |-status|p1b: Sinistcha|brn|[from] ability: Spicy Spray|[of] p2a: Scovillain
 *
 * Sinistcha's Matcha Gotcha hit a just-switched-in Scovillain-Mega, whose Spicy Spray answers
 * `onDamagingHit`. Its PARTNER on that turn was a Floette-Eternal -- and Sinistcha is GRASS.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `data/abilities.ts` spicyspray (Champions overrides only `isNonstandard`, `data/mods/champions/
 * abilities.ts:85-88, so the handler below is the one that runs):
 *
 *     onDamagingHit(damage, target, source, move) {
 *       if (!source.trySetStatus('brn', target) && !source.status && source.hasType('Fire')) {
 *         this.add('-immune', source);
 *       }
 *     }
 *
 * `trySetStatus(status, source)` -- the SECOND argument is `target`, i.e. the ABILITY HOLDER. The
 * status therefore arrives at `setStatus` carrying a source, and `runEvent('SetStatus', ...)` runs
 * every handler that asks who is doing it. Flower Veil's is one of them (`data/abilities.ts`):
 *
 *     onAllySetStatus(status, target, source, effect) {
 *       if (target.hasType('Grass') && source && target !== source && effect && effect.id !== 'yawn') {
 *         if (effect.name === 'Synchronize' || effect.effectType === 'Move' && !effect.secondaries) {
 *           this.add('-block', target, 'ability: Flower Veil', `[of] ${effectHolder}`);
 *         }
 *         return null;
 *       }
 *     }
 *
 * `source &&` is the clause. It is satisfied, the handler returns null, and the burn never lands --
 * SILENTLY, because Spicy Spray is neither Synchronize nor a Move, so the `-block` line is not
 * written either. That is exactly what the authority's stream shows: no status line and no refusal
 * line, just the next event.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * The `punishesAttacker` consumer called
 *
 *     applyStatus(m, status, null, ATTR.ability(tg.ability, tg))
 *                            ^^^^ the source slot, written NULL with the source in scope as `tg`
 *
 * and `allyRefusesStatus` reads that slot:
 *
 *     if(src===undefined){MEDSEEN.allyVeilSourceUnknown++;}
 *     else{ if(p.needsSource&&!src)continue; ... }
 *
 * `null` is not `undefined`, so it took the else branch, `needsSource && !src` was TRUE, and the
 * veil was skipped. `sideBuffRefuses(t,src,...)` returns null on `!src` outright, so Safeguard was
 * skipped too, and the Synchronize reflect below is guarded on `src` as well. One null disarmed
 * three guards the authority runs.
 *
 * ================= THE POPULATION, PRINTED BEFORE THE WIRE ======================================
 *
 * Five abilities reach that call site with a status (`data/tags.json`, `punishesAttacker.inflicts`):
 * Static 1,171 sheets, Flame Body 630, Poison Point 165, Effect Spore 40, Spicy Spray 0 (a mega
 * ability, so it carries no base-sheet count). Three abilities can refuse one: Flower Veil 8,939
 * sheets, Sweet Veil 53, Aroma Veil 136 -- and Aroma Veil's `statuses` list is EMPTY, so it refuses
 * no status at all. One move can: Safeguard, 44 uses. The probe prints all of it on every run.
 *
 * ================= AND THE SAFEGUARD LINE IS GATED IN THE SAME PASS =============================
 *
 * `MEDI_SIDEBUFF_LINE_UNGATED=1`. Opening the Safeguard road to an ABILITY-sourced status makes an
 * announce reachable that the authority does not write. `safeguard.condition.onSetStatus`
 * (data/moves.ts) speaks only for `effect.id === 'synchronize' || (effect.effectType === 'Move' &&
 * !effect.secondaries)`; this engine wrote `-activate|TARGET|move: Safeguard` for every refusal,
 * with a comment beside it declaring that "the direct status-move path is exactly what this engine
 * routes here". That declaration stopped being true the moment a punish ability routed here, so the
 * clause is read instead of assumed. It was ALREADY reachable through Poison Touch
 * (`applyStatus(tg,'psn',m,ATTR.ability(...))`), which is why it is fixed rather than deferred.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const T = require(D('data', 'tags.json'));
const MC = globalThis.MC;
/* THE FIXTURE IS SEARCHED FOR, NOT LOOKED UP, SO IT TAKES THE TABLE THROUGH THE RECORDED DOOR.
 * `mcKey` resolves a KEY; this file has no key to resolve — it scans for a body carrying a given
 * ability, type and damaging move, which is the project's own rule that a fixture is derived rather
 * than typed. `mcKey.rawTable(why)` is the sanctioned road for a raw question: the reason is
 * greppable and `mcKey.rawTable.reasons()` lists every one taken in a run, so the exemption is
 * recorded at RUN TIME rather than resting on a name in a list. */
const MONS = require('../engine/mc_key.js').mcKey.rawTable('probe_punish_status_source SEARCHES for its fixture -- a body with a given ability, a Grass body, and a non-Grass non-Fire attacker with a damaging move -- so it has no key to resolve and must read the table itself');

const OFF = process.env.MEDI_PUNISH_STATUS_SOURCELESS === '1';
const LINE_OFF = process.env.MEDI_SIDEBUFF_LINE_UNGATED === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n  A PUNISH ABILITY\'S STATUS CARRIES ITS SOURCE'
  + (OFF ? '   [MEDI_PUNISH_STATUS_SOURCELESS=1]' : '')
  + (LINE_OFF ? '   [MEDI_SIDEBUFF_LINE_UNGATED=1]' : ''));

/* ---- THE MEMBERSHIP, DERIVED AND PRINTED BEFORE ANYTHING IS ASSERTED --------------------------- */
const AB = T.abilities, MV = T.moves;
const punishers = Object.keys(AB).filter(k => {
  const p = AB[k].params && AB[k].params.punishesAttacker;
  return p && Array.isArray(p.inflicts) && p.inflicts.length;
});
console.log('\n  DERIVED — abilities that reach the call site with a STATUS (punishesAttacker.inflicts):');
for (const k of punishers) {
  const p = AB[k].params.punishesAttacker;
  console.log('    ' + (AB[k].name || k).padEnd(14) + String(AB[k].uses).padStart(6) + ' sheets  trigger='
    + p.trigger + '  ' + p.inflicts.map(x => x.status + '@' + x.chance).join(','));
}
const refusers = Object.keys(AB).filter(k => AB[k].params && AB[k].params.protectsAllyFromStatus);
console.log('  DERIVED — abilities that can refuse one (protectsAllyFromStatus):');
for (const k of refusers) {
  const p = AB[k].params.protectsAllyFromStatus;
  console.log('    ' + (AB[k].name || k).padEnd(14) + String(AB[k].uses).padStart(6) + ' sheets  statuses='
    + JSON.stringify(p.statuses) + '  needsSource=' + p.needsSource + '  grassOnly=' + p.onlyGrassTypes);
}
const sideRefusers = Object.keys(MV).filter(k => MV[k].params && MV[k].params.sideBuff && MV[k].params.sideBuff.blocksStatus);
console.log('  DERIVED — moves that can refuse one (sideBuff.blocksStatus): '
  + sideRefusers.map(k => (MV[k].name || k) + ' ' + MV[k].uses).join(', '));

/* THE CERTAIN PUNISHER IS THE ONE THIS PROBE STAGES, and it is chosen by its CHANCE rather than by
 * its name: a punish whose chances sum to 1 needs no die (the engine skips it -- see
 * `reactionDieSkippedCertain`), so the arms below cannot be decided by a roll that landed the
 * comfortable way. If the format ever holds two, both are printed and the first is staged. */
const certain = punishers.filter(k => AB[k].params.punishesAttacker.inflicts
  .reduce((s, x) => s + (+x.chance || 0), 0) >= 1);
const PUN = certain[0];
const veilGrass = refusers.filter(k => {
  const p = AB[k].params.protectsAllyFromStatus;
  return p.needsSource && p.onlyGrassTypes && (p.statuses === 'all' || (Array.isArray(p.statuses) && p.statuses.length));
});
const VEIL = veilGrass[0];
console.log('  DERIVED — staged: punisher=' + PUN + ' (chance 1, no die)   veil=' + VEIL
  + '   (candidates ' + certain.join(',') + ' / ' + veilGrass.join(',') + ')');
if (!PUN || !VEIL) { console.log('  FIXTURE — the format no longer carries both halves; nothing was measured.'); process.exit(1); }

/* The BODIES are looked up by the ability they carry in this engine's own data, never typed. */
const byAb = (ab) => Object.keys(MONS).filter(s => String(MONS[s].ab || '').toLowerCase().replace(/[^a-z0-9]/g, '') === ab);
const PUNMON = byAb(PUN)[0], VEILMON = byAb(VEIL)[0];
const isGrass = (s) => (MONS[s].t || []).some(x => String(x).toLowerCase() === 'grass');
const dmgMove = (s) => (MONS[s].mv || []).find(id => MC.moves[id] && MC.moves[id].bp > 0);
const GRASSMON = Object.keys(MONS).find(s => isGrass(s) && dmgMove(s) && s !== PUNMON && s !== VEILMON);
const PLAINMON = Object.keys(MONS).find(s => !isGrass(s) && dmgMove(s) && s !== PUNMON && s !== VEILMON
  && !(MONS[s].t || []).some(x => String(x).toLowerCase() === 'fire'));
console.log('  DERIVED — bodies: punisher=' + PUNMON + '  veil=' + VEILMON
  + '  grass attacker=' + GRASSMON + ' (' + dmgMove(GRASSMON) + ')'
  + '  non-grass attacker=' + PLAINMON + ' (' + dmgMove(PLAINMON) + ')');
if (!PUNMON || !VEILMON || !GRASSMON || !PLAINMON) { console.log('  FIXTURE — no body carries one of them.'); process.exit(1); }

/* ---- THE FIXTURE -------------------------------------------------------------------------------
 * p1b attacks p2a. p2a holds the punisher. p1a is p1b's PARTNER and is the knob: it carries the veil
 * or it carries nothing. Nothing else about the board moves between the two arms. */
const bare = (sp, ab) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row ' + sp);
  b.item = ''; b.ability = ab === undefined ? 'none' : ab; return b; };
const rng5 = () => 0.5;

function stage(o) {
  const att = bare(o.attacker, o.attackerAb);
  const ally = bare(VEILMON, o.allyAb);
  const holder = bare(PUNMON, PUN);
  const f2 = bare(PLAINMON);
  const trace = [];
  const S = M.battleInit([att, ally], [holder, f2], { seeded: true, trace });
  const mv = dmgMove(o.attacker);
  /* turn 1 — the optional side condition, clicked by whichever side `o.sideBuffOn` names. */
  if (o.sideBuff) {
    const mine = new Map([[att, { kind: 'pass' }], [ally, { kind: 'pass' }]]);
    const theirs = new Map([[holder, { kind: 'pass' }], [f2, { kind: 'pass' }]]);
    const caster = o.sideBuffOn === 'foe' ? holder : att;
    (o.sideBuffOn === 'foe' ? theirs : mine).set(caster, M.playerAction(caster, o.sideBuff, caster, S.field));
    M.battleTurn(S, rng5, mine, theirs);
  }
  /* turn 2 — the hit that sets the punisher off. `hurt` is read off the HOLDER's HP before and
   * after, not off a `maxHP` field: a built body carries `curHP` and `st.hp` and NO `maxHP`, so a
   * comparison against `maxHP` is NaN and reads false on every arm — which is what the first cut of
   * this file did, and it would have called the fixture dead while the burn was landing. */
  const h0 = holder.curHP;
  M.battleTurn(S, rng5,
    new Map([[att, M.playerAction(att, mv, holder, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[holder, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { status: att.status || '-', hurt: holder.curHP < h0, trace,
           sc: JSON.stringify((att._sf && att._sf.sc) || {}), holderStatus: holder.status || '-' };
}
const show = (r) => '[attacker status ' + r.status + ', holder was hit ' + r.hurt + ']';

/* ---- 1. CONTROL: the punish fires at all ------------------------------------------------------- */
const plain = stage({ attacker: GRASSMON, allyAb: 'none' });
ok(plain.hurt && plain.status === 'brn',
  'CONTROL: with no veil beside it, the punisher burns the body that hit it',
  show(plain) + '  — if this is "-" the fixture never set the ability off and nothing below means anything');

/* ---- 2. THE DEFECT: the ally's veil refuses it -------------------------------------------------- */
const veiled = stage({ attacker: GRASSMON, allyAb: VEIL });
ok(veiled.hurt && veiled.status === '-',
  'the partner\'s ' + (AB[VEIL].name || VEIL) + ' refuses the punish burn on a GRASS body',
  show(veiled) + '  — expected "-".' + (OFF ? '  This is an arm the knob reds.' : ''));

/* ---- 3. AND IT IS SILENT, because the effect is an ABILITY ------------------------------------- */
/* `effect.name === 'Synchronize' || effect.effectType === 'Move' && !effect.secondaries` — a punish
 * ability is neither, so the authority writes NO `-block`. The parting game's authority stream shows
 * exactly that: the next line is the faint. */
const blocked = veiled.trace.filter(l => /-block/.test(String(l)));
ok(blocked.length === 0 || OFF,
  'the refusal writes NO `-block` line — a punish ability is not Synchronize and not a Move',
  (blocked.join(' | ') || '(no -block line, as the authority)'));

/* ---- 4. THE KNOB MOVES THE OUTCOME -------------------------------------------------------------- */
ok(plain.status !== veiled.status || OFF,
  'the veil knob MOVES the outcome',
  'no veil ' + show(plain) + '   veil ' + show(veiled)
  + '  — an identical reading across a varied ally means the source slot is unwired');

/* ================= THE NEGATIVE ARMS ============================================================
 * The fix hands the guard a source it did not have. An over-firing version refuses statuses that
 * should land; each arm below is one clause of the handler the fix must not have deleted.
 * ============================================================================================== */

/* ---- 5. `target.hasType('Grass')` — a non-Grass partner is NOT shielded ------------------------ */
const nonGrass = stage({ attacker: PLAINMON, allyAb: VEIL });
ok(nonGrass.hurt && nonGrass.status === 'brn',
  'a NON-Grass body beside the same veil is still burned — the type gate survives',
  show(nonGrass) + '  attacker ' + PLAINMON + ' types ' + JSON.stringify(MONS[PLAINMON].t));

/* ---- 6. THE VEIL BELONGS TO A SIDE — the punisher's own partner does not shield the attacker --- */
const farVeil = (() => {
  const att = bare(GRASSMON, 'none');
  const ally = bare(VEILMON, 'none');
  const holder = bare(PUNMON, PUN);
  const f2 = bare(VEILMON, VEIL);                        // the VEIL sits on the FOE side
  const trace = [];
  const S = M.battleInit([att, ally], [holder, f2], { seeded: true, trace });
  const h0 = holder.curHP;
  M.battleTurn(S, rng5,
    new Map([[att, M.playerAction(att, dmgMove(GRASSMON), holder, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[holder, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  return { status: att.status || '-', hurt: holder.curHP < h0, trace };
})();
ok(farVeil.hurt && farVeil.status === 'brn',
  'the veil standing beside the PUNISHER does not shield the attacker — it belongs to a side',
  show(farVeil));

/* ---- 7. THE SECOND ROAD THE SOURCE OPENS: Safeguard, which also refuses on `!source` ----------- */
/* `sideBuffRefuses` returns null outright on a missing source, so this road was shut for the same
 * reason. The authority's Safeguard refuses any sourced, non-yawn, non-infiltrating status. */
const SG = sideRefusers[0];
if (SG) {
  const sg = stage({ attacker: PLAINMON, allyAb: 'none', sideBuff: SG, sideBuffOn: 'mine' });
  ok(sg.hurt && sg.status === '-',
    'our own ' + (MV[SG].name || SG) + ' refuses the punish burn too',
    show(sg) + '  our sc ' + sg.sc + (OFF ? '  This is an arm the knob reds.' : ''));
  /* AND IT IS SILENT HERE AS WELL — the same clause, on a different handler. */
  const said = sg.trace.filter(l => /-activate/.test(String(l)) && new RegExp(SG, 'i').test(String(l)));
  /* NOT exempted under either knob. Under MEDI_SIDEBUFF_LINE_UNGATED this is the arm that reds;
   * under MEDI_PUNISH_STATUS_SOURCELESS the road is never reached, so it passes trivially and the
   * two arms above are the ones that carry that knob's demonstration. */
  ok(said.length === 0,
    'and it announces NOTHING — `effect.effectType === \'Move\'` is false for an ability',
    (said.join(' | ') || '(no -activate line, as the authority)'));
  /* THE REGRESSION CONTROL FOR THAT GATE: a direct status MOVE under the same Safeguard still
   * announces. A fix that silenced the line outright passes the arm above and breaks this one. */
  const direct = (() => {
    const me = bare('clefable'), ally = bare('pikachu'), f1 = bare('garchomp'), f2 = bare('incineroar');
    const trace = [];
    const S = M.battleInit([me, ally], [f1, f2], { seeded: true, trace });
    M.battleTurn(S, rng5,
      new Map([[me, M.playerAction(me, SG, me, S.field)], [ally, { kind: 'pass' }]]),
      new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
    M.battleTurn(S, rng5,
      new Map([[me, { kind: 'pass' }], [ally, { kind: 'pass' }]]),
      new Map([[f1, M.playerAction(f1, 'glare', me, S.field)], [f2, { kind: 'pass' }]]));
    return { status: me.status || '-', trace };
  })();
  const dsaid = direct.trace.filter(l => /-activate/.test(String(l)) && new RegExp(SG, 'i').test(String(l)));
  ok(direct.status === '-' && dsaid.length === 1,
    'REGRESSION: a foe\'s direct status MOVE under the same ' + (MV[SG].name || SG) + ' is still refused AND still announces',
    '[status ' + direct.status + ']  ' + (dsaid.join(' | ') || '(no -activate line)')
    + (LINE_OFF ? '' : '\n          full trace: ' + direct.trace.join(' | ')));
} else {
  console.log('  SKIP  no move in this format carries sideBuff.blocksStatus');
}

/* ---- 8. THE PUNISHER ITSELF IS UNCHANGED — it still damages, and it still burns when unguarded -- */
ok(plain.hurt === veiled.hurt && plain.hurt === nonGrass.hurt,
  'the hit itself is untouched on every arm — the fix reaches the STATUS and nothing else',
  'hit landed: none ' + plain.hurt + '  veil ' + veiled.hurt + '  non-grass ' + nonGrass.hurt);

/* ---- THE DEFECT'S OWN NUMBERS ------------------------------------------------------------------ */
const seen = M.MEDSEEN || {}, fails = M.MEDFAILS || {};
console.log('\n  COUNTERS  allyVeilRefused=' + (seen.allyVeilRefused || 0)
  + '  allyVeilSourceUnknown=' + (seen.allyVeilSourceUnknown || 0)
  + '  sideBuffRefused=' + (seen.sideBuffRefused || 0)
  + '  punishStatusSourced=' + (seen.punishStatusSourced || 0)
  + '  sideBuffLineSilent=' + (seen.sideBuffLineSilent || 0)
  + '  punishStatusSourcelessRestored=' + (fails.punishStatusSourcelessRestored || 0)
  + '  sideBuffLineUngatedRestored=' + (fails.sideBuffLineUngatedRestored || 0));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
