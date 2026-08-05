/* click_class.js — is this recorded action a CLICK at all, and if so do we know which one?
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * engine/click_match.js answers "which candidate did they press". It assumes the recorded action IS
 * the pressed one. Whenever an opponent's play makes those differ, that assumption is wrong, and it
 * is wrong EXACTLY on the turns where the opponent's play worked. Will, 2026-08-05:
 *
 *     "i def dont like just tossing turns because they got outplayed with a move liek encore or
 *      follow me, these are the basis of vgc man."
 *
 * docs/CLICK-CENSORING-FIX.md is the spec. Four classes, and the reason each is its own class is
 * that each needs a DIFFERENT thing done with it:
 *
 *   CLEAN    the recorded action is the click.                      fit it, as today
 *   PARTIAL  the click is one of a known small set (Cour, Sapp &    fit it under the marginal
 *            Taskar 2011). Redirection: the visible target is the   likelihood, by EM
 *            redirector, the intended one was any live foe.
 *   COERCED  the recorded action is NOT a click. Encore overrode    REMOVE from the labeled set,
 *            it; a phazing move dragged the mon in.                 and COUNT it.
 *   ERASED   the click existed and is unrecoverable (flinch, full   stays dropped
 *            paralysis, sleep). Leaves no event at all.
 *
 * COERCED IS THE PRIORITY. A dropped turn costs information; a MISLABELLED turn supplies
 * misinformation (Natarajan, Dhillon, Ravikumar & Tewari, 2013), and both of the coerced classes
 * below are today kept with a wrong label:
 *
 *   - the Encore application turn passes every counter we have, because the move Encore forces out
 *     is on the victim's own legal menu, so the matcher "matches" it;
 *   - engine/durable-ingest.js:67 parses `|drag|` with the SAME regex as `|switch|`, so a mon
 *     phazed in by Roar / Whirlwind / Dragon Tail / Circle Throw is stored as `t:'s'` and read by
 *     engine/fit_policy.js as a VOLUNTARY switch. Its `forcedSlot` guard only excludes a switch
 *     that follows a faint.
 *
 * THE MECHANISM LIST IS DERIVED FROM THE FORMAT, NEVER TYPED
 * ---------------------------------------------------------
 * CLAUDE.md: "The ban is a MECHANISM, not a list, so read it from the format rather than from
 * memory." A hand list of four items went stale in this project without anybody noticing. So:
 *
 *   action override   every move whose applied condition defines onOverrideAction   -> {encore}
 *   forced switch     every move with forceSwitch                                   -> {roar,
 *                                                                                       whirlwind,
 *                                                                                       dragontail,
 *                                                                                       circlethrow}
 *   priority block    every ability with onFoeTryMove                               -> {armortail,
 *                                                                                       dazzling,
 *                                                                                       queenlymajesty}
 *   redirection       data/tags.json `redirects` / `redirectsType`
 *
 * Eject Button, Eject Pack and Red Card are all `isNonstandard: 'Past'` in this format, so the
 * item-driven forced switch does not exist here. That is READ, not remembered — see isLive().
 *
 * Each set REFUSES TO BE EMPTY. A silently empty mechanism set would make every counter below read
 * zero and every check pass, which is this repository's signature failure.
 */
'use strict';
const B = require('./board.js');
const TAGS = require('./tags.js');

const norm = B.norm, base = B.baseSpecies;

/* --------------------------------------------------------------------------------------------
 * 1. THE MECHANISMS, read out of the running format
 * ------------------------------------------------------------------------------------------ */
let _M = null;
function mechanisms(dex) {
  if (_M) return _M;
  const overrideMoves = new Set();      // the action the player chose is REPLACED
  const forceSwitchMoves = new Set();   // the opponent's mon is DRAGGED, its arrival is not a click
  const menuSealMoves = new Set();      // the menu shrinks on LATER turns (choice-set effect)
  for (const m of dex.moves.all()) {
    const c = m.condition;
    if (c && typeof c.onOverrideAction === 'function') overrideMoves.add(m.id);
    if (c && typeof c.onDisableMove === 'function') menuSealMoves.add(m.id);
    if (m.forceSwitch) forceSwitchMoves.add(m.id);
  }
  const priorityBlockAbilities = new Set();
  for (const a of dex.abilities.all()) if (typeof a.onFoeTryMove === 'function') priorityBlockAbilities.add(a.id);

  const redirectMoves = new Set(TAGS.withTag('move', 'redirects').map(norm));
  const redirectAbility = Object.create(null);
  for (const ab of TAGS.withTag('ability', 'redirectsType')) {
    const p = TAGS.param('ability', ab, 'redirectsType') || {};
    if (p.type) redirectAbility[norm(ab)] = norm(p.type);
  }

  /* THE ITEM-DRIVEN FORCED SWITCH, asked of the format rather than remembered. Eject Button, Eject
   * Pack and Red Card all set `switchFlag` in a handler; all three are `isNonstandard: 'Past'` here,
   * so the class is empty in Champions. Recorded as a MEASUREMENT (both sets are published in the
   * census) rather than as a sentence, because a later regulation could readmit one. */
  const forceSwitchItems = new Set(), forceSwitchItemsBanned = new Set();
  for (const i of dex.items.all()) {
    let src = '';
    for (const k of Object.keys(i)) if (typeof i[k] === 'function') src += String(i[k]);
    /* It must SET the flag, not read it. The loose test `/switchFlag|forceSwitch/` matched Life Orb
     * and Shell Bell, both of which merely READ `forceSwitchFlag` to decide whether to fire — caught
     * by tests/test-click-censoring.js on real dex data the first time it ran, which is the whole
     * argument for showing a check red before believing it. Two flags, not one: Eject Button and
     * Eject Pack set `switchFlag`, Red Card sets `forceSwitchFlag`; matching only the first lost
     * Red Card, also caught by the test. */
    if (!/\.(?:switchFlag|forceSwitchFlag)\s*=\s*true/.test(src)) continue;
    (i.isNonstandard ? forceSwitchItemsBanned : forceSwitchItems).add(i.id);
  }

  const empty = [];
  if (!overrideMoves.size) empty.push('overrideMoves (onOverrideAction)');
  if (!forceSwitchMoves.size) empty.push('forceSwitchMoves (forceSwitch)');
  if (!priorityBlockAbilities.size) empty.push('priorityBlockAbilities (onFoeTryMove)');
  if (!redirectMoves.size) empty.push('redirectMoves (tag `redirects`)');
  if (empty.length) {
    throw new Error('click_class.js: mechanism set(s) empty — ' + empty.join(', ') +
      '. Refusing to report a zero: an empty set makes every censoring counter read 0 and every ' +
      'check pass. Is SHOWDOWN_PATH set and data/tags.json current?');
  }
  _M = { overrideMoves, forceSwitchMoves, menuSealMoves, priorityBlockAbilities,
         redirectMoves, redirectAbility, forceSwitchItems, forceSwitchItemsBanned };
  return _M;
}

/* --------------------------------------------------------------------------------------------
 * 2. WHAT WAS COERCED THIS TURN
 *
 * Pure over the turn's own event stream, in resolution order. No board: `ev` is what happened, in
 * the order it happened, and both coercion mechanisms are "X resolved BEFORE this slot acted".
 *
 * @param ev   the turn's events (g.turns[i].ev)
 * @param dex  Dex.forFormat(CS.FORMAT)
 * @param opts { disable: ['actionOverridden'|'draggedIn'] } — TURNS A RULE OFF, and it exists for
 *             one reason: a check that has never been red is not evidence. tests/ runs the planted
 *             log with the Encore rule disabled and requires the classification to FAIL, then turns
 *             it on and requires it to pass. Making that a PARAMETER rather than a second copy of
 *             this function is docs/ARTIFACT-ACCESS-RULES.md R2.
 * @returns Map slotKey('p1a') -> { cls:'COERCED', why, by }   — only coerced slots appear
 * ------------------------------------------------------------------------------------------ */
function coercedSlots(ev, dex, opts) {
  const off = new Set((opts && opts.disable) || []);
  const M = mechanisms(dex);
  const out = new Map();
  const idOf = (mv) => { const m = dex.moves.get(mv); return norm((m && m.id) || mv); };

  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.t !== 'm' || !e.s || !e.mv) continue;
    if (e.fail || e.miss || e.immune) continue;   // a failed Encore overrides nothing
    const id = idOf(e.mv);
    const side = e.s.slice(0, 2), foe = side === 'p1' ? 'p2' : 'p1';

    /* ---- ENCORE: the victim's action this turn is REPLACED, not chosen ---------------------
     * Showdown applies the override only if the victim has not moved yet, which is exactly
     * "its move event comes later in ev". The victim is identified by the SPECIES the protocol
     * recorded as the target, matched against the species that acts. */
    if (M.overrideMoves.has(id) && !off.has('actionOverridden')) {
      const victim = e.tgt ? base(e.tgt) : null;
      for (let j = i + 1; j < ev.length; j++) {
        const e2 = ev[j];
        if (!e2.s || e2.s.slice(0, 2) !== foe) continue;
        if (e2.t !== 'm' || !e2.mon) continue;
        if (victim && base(e2.mon) !== victim) continue;
        if (out.has(e2.s)) continue;
        out.set(e2.s, { cls: 'COERCED', why: 'actionOverridden', by: id });
        break;
      }
    }

    /* ---- PHAZING: the arrival is a DRAG. engine/durable-ingest.js stores |drag| as t:'s',
     * indistinguishable from a click, and fit_policy scores it as a voluntary switch. */
    if (M.forceSwitchMoves.has(id) && !off.has('draggedIn')) {
      for (let j = i + 1; j < ev.length; j++) {
        const e2 = ev[j];
        if (e2.t !== 's' || !e2.s || e2.s.slice(0, 2) !== foe) continue;
        if (out.has(e2.s)) continue;
        out.set(e2.s, { cls: 'COERCED', why: 'draggedIn', by: id });
        break;
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------------------------------------
 * 3. WHERE A REDIRECTOR WAS UP
 *
 * @returns { p1:{at,by}|null, p2:{at,by}|null } — the FIRST redirect move each side landed, by
 *          index in ev, so "was it up when this move resolved" is exact rather than a priority
 *          guess. Same reading engine/redirect_audit.js used to measure the exposure.
 * ------------------------------------------------------------------------------------------ */
function redirectorsUp(ev, dex) {
  const M = mechanisms(dex);
  const out = { p1: null, p2: null };
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.t !== 'm' || !e.s || !e.mv) continue;
    if (e.fail) continue;
    const m = dex.moves.get(e.mv);
    const id = norm((m && m.id) || e.mv);
    if (!M.redirectMoves.has(id)) continue;
    const s = e.s.slice(0, 2);
    if (!out[s]) out[s] = { at: i, by: base(e.mon), move: id };
  }
  return out;
}

/* --------------------------------------------------------------------------------------------
 * 4. IS THIS MOVE CLICK PARTIALLY LABELLED
 *
 * The protocol prints the RESOLVED target of a move and never the chosen one. So when a redirector
 * soaked it, the recorded target is the redirector and the true click is any of the live foes. The
 * candidate set is exactly the identifiability condition Cour et al. need: it varies game to game
 * because which Pokemon carries Follow Me varies.
 *
 * ONLY single-target foe-aimed moves can be redirected. Spread moves ignore redirection, and so do
 * self- and ally-targeting moves. Read from the dex's own `target`, not listed.
 *
 * @param e        the move event
 * @param evIx     its index in ev
 * @param red      redirectorsUp()'s answer
 * @param liveFoes [{mon}] the foe actives that were alive at decision time
 * @param dex
 * @param board    needed only for moveType — Weather Ball is Normal on paper and Water under rain
 * @returns null, or { why, drawnBy } when the recorded target cannot be trusted
 * ------------------------------------------------------------------------------------------ */
const SINGLE_FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe']);
function partialTarget(e, evIx, red, liveFoes, dex, board, opts) {
  const off = new Set((opts && opts.disable) || []);
  const M = mechanisms(dex);
  const mv = dex.moves.get(e.mv);
  if (!mv || !mv.exists) return null;
  if (!SINGLE_FOE_TARGETS.has(mv.target || 'normal')) return null;
  /* One live foe means there was nothing else it could have been aimed at: the label is certain
   * even though the mechanic fired. A candidate set of one is a CLEAN click, not a partial. */
  if (!liveFoes || liveFoes.length < 2) return null;
  if (!e.tgt) return null;
  const tgt = base(e.tgt);

  const side = e.s.slice(0, 2), foe = side === 'p1' ? 'p2' : 'p1';
  const r = red[foe];
  if (r && r.at < evIx && tgt === r.by && !off.has('moveRedirect')) return { why: 'moveRedirect', drawnBy: r.move };

  /* Lightning Rod / Storm Drain draw by TYPE. The drawing mon must be the recorded target and the
   * move's type must be the one the ability draws. `moveType` resolves Weather Ball and friends. */
  if (off.has('abilityDraw')) return null;
  for (const f of liveFoes) {
    if (base(f.mon.species) !== tgt) continue;
    const ab = M.redirectAbility[norm(f.mon.ability || '')];
    if (ab && norm((board ? B.moveType(mv, board, dex) : mv.type) || mv.type) === ab) {
      return { why: 'abilityDraw', drawnBy: norm(f.mon.ability) };
    }
  }
  return null;
}

module.exports = { mechanisms, coercedSlots, redirectorsUp, partialTarget, SINGLE_FOE_TARGETS };
