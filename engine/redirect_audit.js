/* redirect_audit.js — how much of the joint fit's drop rate is actually redirection?
 *
 *   SHOWDOWN_PATH=... node engine/redirect_audit.js [--games=N]   ->  data/redirect-audit.json
 *
 * WHY THIS EXISTS BEFORE THE FIX
 * ------------------------------
 * docs/MODELS.md, docs/DEFENSE.md and fit_policy.js's own caveat all say the same thing: the clicks
 * the fit cannot match are "mostly redirection (Follow Me, Rage Powder), where the protocol records
 * the target that was HIT, not the one chosen". That sentence is a diagnosis, and it has never been
 * measured. `fit_joint.js` still drops 23.20% of two-slot turns, and the roadmap proposes changing
 * board.js -- which invalidates every weight and forces a refit -- on the strength of it.
 *
 * So: attribute the drop. Nothing here fixes anything.
 *
 * WHAT THE PROTOCOL ACTUALLY SHOWS, WHICH IS THE POINT
 * ---------------------------------------------------
 * Read from data/games.bo3.raw-logs.jsonl, 2026-08-02:
 *
 *     |move|p1b: Sinistcha|Rage Powder|p1b: Sinistcha
 *     |-singleturn|p1b: Sinistcha|move: Rage Powder
 *     |move|p2b: Starmie|Liquidation|p1b: Sinistcha      <- Starmie aimed SOMEWHERE; we see Sinistcha
 *
 * There is no `-activate` line for the redirect and no record of the original target. The `|move|`
 * line carries the RESOLVED target only. Which means redirection does not make a click UNMATCHABLE
 * -- the redirector is a perfectly legal candidate target, so the matcher finds it and is happy.
 * It makes the click MISLABELLED. Those are different defects with different fixes, and the counter
 * that would tell them apart is the one nobody has run.
 *
 * DERIVED, NOT LISTED. The redirecting moves and abilities come from data/abra-tags.js via
 * engine/tags.js (`redirects`, `redirectsType`), including the TYPE each ability draws -- so a new
 * redirector is picked up with no edit here.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');
const TAGS = require('./tags.js');
const CM = require('./click_match.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
const D = (...p) => path.join(__dirname, '..', ...p);

const LIMIT = (() => { const a = process.argv.find(s => s.startsWith('--games=')); return a ? +a.slice(8) : 0; })();

/* ---- the redirectors, from the artifact ------------------------------------------------------ */
const REDIRECT_MOVES = new Set(TAGS.withTag('move', 'redirects').map(norm));
const REDIRECT_ABILITY = {};
for (const ab of TAGS.withTag('ability', 'redirectsType')) {
  const p = TAGS.param('ability', ab, 'redirectsType') || {};
  if (p.type) REDIRECT_ABILITY[norm(ab)] = norm(p.type);
}
if (!REDIRECT_MOVES.size) { console.error('no `redirects` moves in the tag artifact — refusing to report a zero'); process.exit(1); }

/* A move is redirectable only if it is single-target and aimed at a foe. Spread moves ignore
 * redirection entirely, and so do self- and ally-targeting moves. Read from the dex, not listed. */
const SINGLE_FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe']);
const redirectable = (mv) => mv && mv.exists && SINGLE_FOE_TARGETS.has(mv.target || 'normal');

const { games: allGames } = FP.loadCorpus();
const games = LIMIT ? allGames.slice(0, LIMIT) : allGames;
console.log(`REDIRECT AUDIT — ${games.length.toLocaleString()} clean open-sheet games` +
            (LIMIT ? ` (of ${allGames.length.toLocaleString()}; --games=${LIMIT})` : '') + '\n');

/* ---- counters -------------------------------------------------------------------------------- */
const joint = { turns: 0, kept: 0, oneSlot: 0, unmatched: 0, ambiguous: 0 };
/* Why a slot failed to match. One slot failing loses the whole joint turn. */
const why = { noUser: 0, noSheet: 0, noCands: 0, moveNotEnumerated: 0, targetMismatch: 0, switchNotFound: 0, matched: 0, ambiguous: 0 };
/* ...and WHY the target did not match, which is the number the roadmap is actually asking about. */
const detail = {};
const bump = k => { detail[k] = (detail[k] || 0) + 1; };
/* Species that appear on BOTH sides' sheets in the same game. `sheet` is keyed by base species with
 * no side, so in a mirror one player's set silently overwrites the other's. */
const mirrorGames = { games: 0, species: {} };
/* THE SILENT HALF. A slot whose sheet came from the OTHER side and still matched is worse than one
 * that failed: it is fitted, against the opponent's four moves, and nothing counts it. */
const wrongSheet = { slots: 0, matched: 0, failed: 0 };
const unknownSpecies = {};
/* THE SAME REPLAY, MATCHED TWICE. Same boards, same candidates where the sheet agrees — the only
 * difference is engine/click_match.js's side-keyed sheet, forme fold and switch-aware target. Two
 * separate runs would not be comparable; one run scored two ways is. */
const fixedJoint = { turns: 0, kept: 0, unmatched: 0, ambiguous: 0 };
const fixedWhy = { matched: 0, ambiguous: 0, moveNotEnumerated: 0, targetMismatch: 0, switchNotFound: 0, noSheet: 0 };
/* Of the joint turns lost to `unmatched`, how many had a redirector up for that side's decisions? */
const unmatchedCtx = { total: 0, redirectUp: 0, noRedirect: 0 };
/* Every single-target foe-aimed human move click, redirect-labelled. This is the mislabel exposure. */
const clicks = {
  total: 0, redirectableTotal: 0,
  moveRedirectUp: 0,          // Follow Me / Rage Powder resolved earlier this turn on the foe side
  moveRedirectHitIt: 0,       // ...and the recorded target IS that redirector
  moveRedirectAmbiguous: 0,   // ...and there was another live foe it could have been aimed at
  abilityDrawer: 0,           // recorded target has Lightning Rod / Storm Drain and the type matches
  abilityAmbiguous: 0,        // ...and there was another live foe
};
/* Species of the mons doing the soaking, for a sanity read. */
const soakers = {};
const reasonSamples = [];

const sheetAbility = {};      // per-game, base species -> normalised ability

for (const g of games) {
  const board = new B.Board();
  const sheet = {};
  const SI = CM.sheetIndex(g, dex);
  for (const k of Object.keys(sheetAbility)) delete sheetAbility[k];
  let mirrored = false;
  for (const side of ['p1', 'p2']) {
    for (const m of (g.sheets && g.sheets[side]) || []) {
      if (m && m.species) {
        const k = base(m.species);
        if (sheet[k] && sheet[k].side !== side) {
          mirrored = true;
          mirrorGames.species[k] = (mirrorGames.species[k] || 0) + 1;
        }
        sheet[k] = { side, moves: (m.moves || []).map(norm) };
        sheetAbility[k] = norm(m.ability || '');
        board.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
      }
    }
    board.setParty(side, ((g.brought || {})[side] || []));
    const lead = (g.lead || {})[side] || [];
    if (lead[0]) board.switchIn(side, 'a', lead[0]);
    if (lead[1]) board.switchIn(side, 'b', lead[1]);
  }
  if (mirrored) mirrorGames.games++;

  for (const t of g.turns || []) {
    const ev = t.ev || [];
    for (const e of ev) if (e.t === 'mega' && e.s) { const mn = board.slot(e.s.slice(0, 2), e.s.slice(2)); if (mn) mn.species = norm(e.mon); }

    /* Index of the first redirect-move event by each side, in RESOLUTION order. `ev` is the order
     * the turn actually happened in, so "was the redirect up when this move resolved" is exact
     * rather than a priority guess. */
    const redirectAt = { p1: -1, p2: -1 };
    const redirectBy = { p1: null, p2: null };
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.t !== 'm' || !e.s || !e.mv) continue;
      const id = norm((dex.moves.get(e.mv) && dex.moves.get(e.mv).id) || e.mv);
      if (!REDIRECT_MOVES.has(id)) continue;
      const s = e.s.slice(0, 2);
      if (redirectAt[s] < 0) { redirectAt[s] = i; redirectBy[s] = base(e.mon); }
    }
    if (redirectBy.p1) soakers[redirectBy.p1] = (soakers[redirectBy.p1] || 0) + 1;
    if (redirectBy.p2) soakers[redirectBy.p2] = (soakers[redirectBy.p2] || 0) + 1;

    /* ---- CLICK-LEVEL EXPOSURE (every move event, both sides) --------------------------------- */
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.t !== 'm' || !e.s || !e.mv) continue;
      clicks.total++;
      const mv = dex.moves.get(e.mv);
      if (!redirectable(mv)) continue;
      const side = e.s.slice(0, 2), foe = side === 'p1' ? 'p2' : 'p1';
      const liveFoes = board.field().filter(f => f.side === foe && !f.mon.fainted);
      if (liveFoes.length < 1) continue;
      clicks.redirectableTotal++;

      if (redirectAt[foe] >= 0 && redirectAt[foe] < i) {
        clicks.moveRedirectUp++;
        if (e.tgt && base(e.tgt) === redirectBy[foe]) {
          clicks.moveRedirectHitIt++;
          if (liveFoes.length > 1) clicks.moveRedirectAmbiguous++;
        }
      } else if (e.tgt) {
        const ab = REDIRECT_ABILITY[sheetAbility[base(e.tgt)] || ''];
        if (ab && norm(B.moveType(mv, board, dex) || mv.type) === ab) {
          clicks.abilityDrawer++;
          if (liveFoes.length > 1) clicks.abilityAmbiguous++;
        }
      }
    }

    /* ---- JOINT-TURN MATCHING, the same matcher fit_joint.js runs ----------------------------- */
    for (const side of ['p1', 'p2']) {
      const acted = {};
      const actedAt = {};
      const fainted = new Set();
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        if (e.t === 'f' && e.s) fainted.add(e.s);
        if (!e.s || e.s.slice(0, 2) !== side) continue;
        const L = e.s.slice(2);
        if (acted[L]) continue;
        if (e.t === 'm' && e.mv) { acted[L] = { kind: 'move', mv: e.mv, tgt: e.tgt || null }; actedAt[L] = i; }
        else if (e.t === 's' && !fainted.has(e.s)) { acted[L] = { kind: 'switch', to: base(e.mon) }; actedAt[L] = i; }
      }
      if (!acted.a || !acted.b) { joint.oneSlot++; continue; }
      joint.turns++;

      const foe = side === 'p1' ? 'p2' : 'p1';

      /* ---- THE SAME TURN, SCORED AGAIN WITH engine/click_match.js ----------------------------
       * Identical board, identical events. The only differences are the side-keyed sheet, the dex
       * forme fold and resolving the recorded target back through the turn's own switches. */
      fixedJoint.turns++;
      {
        let amb = false, fail = false;
        for (const L of ['a', 'b']) {
          const user = board.slot(side, L);
          const sh2 = (user && !user.fainted) ? SI.get(side, user.species) : null;
          if (!sh2) { fail = true; fixedWhy.noSheet++; continue; }
          const c2 = B.candidates(sh2.moves, user, board, side, dex);
          if (!c2.length) { fail = true; fixedWhy.noSheet++; continue; }
          const want = acted[L];
          const rt = want.kind === 'move' ? CM.targetAtDecision(ev, actedAt[L], foe, want.tgt, board) : undefined;
          const m = CM.matchClick(c2, want, dex, rt);
          if (m.ambiguous) { amb = true; fixedWhy.ambiguous++; continue; }
          if (m.chosen >= 0) { fixedWhy.matched++; continue; }
          fail = true;
          if (want.kind === 'switch') fixedWhy.switchNotFound++;
          else if (m.sameMove) fixedWhy.targetMismatch++;
          else fixedWhy.moveNotEnumerated++;
        }
        if (amb) fixedJoint.ambiguous++;
        else if (fail) fixedJoint.unmatched++;
        else fixedJoint.kept++;
      }

      let anyAmbiguous = false, anyFail = null;

      for (const L of ['a', 'b']) {
        const user = board.slot(side, L);
        if (!user || user.fainted) { if (!anyFail) anyFail = 'noUser'; why.noUser++; continue; }
        const sh = sheet[base(user.species)];
        if (!sh) {
          if (!anyFail) anyFail = 'noSheet'; why.noSheet++;
          /* A mega keeps its sheet under the BASE name, so a slot whose species was rewritten to the
           * mega forme by the `mega` event stops resolving. Distinguished rather than lumped. */
          const k = base(user.species);
          bump('noSheet:' + (/mega[xy]?$/.test(k) && sheet[k.replace(/mega[xy]?$/, '')] ? 'megaForme' : 'speciesUnknown'));
          unknownSpecies[k] = (unknownSpecies[k] || 0) + 1;
          continue;
        }
        if (sh.side !== side) wrongSheet.slots++;
        const cands = B.candidates(sh.moves, user, board, side, dex);
        if (!cands.length) { if (!anyFail) anyFail = 'noCands'; why.noCands++; continue; }
        const want = acted[L];
        if (want.kind === 'switch') {
          if (cands.findIndex(c => c.switchTo === want.to) < 0) { if (!anyFail) anyFail = 'switchNotFound'; why.switchNotFound++; }
          else why.matched++;
          continue;
        }
        const mvId = norm((dex.moves.get(want.mv) && dex.moves.get(want.mv).id) || want.mv);
        const sameMove = [], hits = [];
        for (let i = 0; i < cands.length; i++) {
          const c = cands[i];
          if (!c.move || norm(c.move.id) !== mvId) continue;
          sameMove.push(i);
          if (!c.targetMon) { hits.push(i); continue; }
          if (want.tgt && base(c.targetMon.species) === base(want.tgt)) hits.push(i);
        }
        if (hits.length === 1) { why.matched++; if (sh.side !== side) wrongSheet.matched++; continue; }
        if (hits.length > 1) { anyAmbiguous = true; why.ambiguous++; continue; }
        if (sh.side !== side) wrongSheet.failed++;
        const reason = sameMove.length ? 'targetMismatch' : 'moveNotEnumerated';
        why[reason]++;
        if (!anyFail) anyFail = reason;

        /* ---- WHY, precisely. One label per failure, most specific first. -------------------- */
        const tgtBase = want.tgt ? base(want.tgt) : null;
        const onFoe = tgtBase ? board.field().some(f => f.side === foe && base(f.mon.species) === tgtBase) : false;
        const onMine = tgtBase ? board.field().some(f => f.side === side && base(f.mon.species) === tgtBase) : false;
        /* Did that species come IN this turn, on the foe side, before this move resolved? Switches
         * resolve before every move, so the protocol writes down the mon that ARRIVED while the
         * human was choosing against the one that left. */
        let switchedIn = false;
        if (tgtBase) for (let i = 0; i < actedAt[L]; i++) {
          const e2 = ev[i];
          if (e2.t === 's' && e2.s && e2.s.slice(0, 2) === foe && base(e2.mon) === tgtBase) { switchedIn = true; break; }
        }
        const prefix = reason === 'targetMismatch' ? 'target:' : 'move:';
        if (sh.side !== side) bump(prefix + 'mirrorSheetFromOtherSide');
        else if (reason === 'moveNotEnumerated') bump(prefix + (sh.moves.includes(mvId) ? 'onSheetButNotOffered' : 'notOnSheet'));
        else if (!tgtBase) bump(prefix + 'noTargetRecorded');
        else if (switchedIn) bump(prefix + 'foeSwitchedInThisTurn');
        else if (onMine && !onFoe) bump(prefix + 'recordedTargetIsOwnSide');
        else if (onFoe) bump(prefix + 'onFieldButNotOffered');
        else bump(prefix + 'targetNotOnFieldAtAll');
        if (reasonSamples.length < 40) {
          reasonSamples.push({
            game: g.id || '', turn: t.n, side, slot: L, reason,
            move: want.mv, recordedTarget: want.tgt,
            sheetMoves: sh.moves, onField: board.field().map(f => f.side + f.letter + ':' + base(f.mon.species)),
            redirectUp: redirectAt[foe] >= 0 && redirectAt[foe] < actedAt[L] ? redirectBy[foe] : null,
          });
        }
      }

      if (anyAmbiguous) { joint.ambiguous++; continue; }
      if (anyFail) {
        joint.unmatched++;
        unmatchedCtx.total++;
        /* Was a redirector up on the FOE side before either of this side's decisions resolved? That
         * is the only way redirection could have touched what the protocol wrote down for us. */
        const up = redirectAt[foe] >= 0 && (redirectAt[foe] < actedAt.a || redirectAt[foe] < actedAt.b);
        if (up) unmatchedCtx.redirectUp++; else unmatchedCtx.noRedirect++;
        continue;
      }
      joint.kept++;
    }

    /* ---- resolve, exactly as fit_joint does -------------------------------------------------- */
    for (const e of ev) {
      const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
      if (e.t === 's' && side) board.switchIn(side, letter, e.mon);
      else if (e.t === 'm' && side) {
        const user = board.slot(side, letter);
        const mv = dex.moves.get(e.mv);
        if (user && mv && mv.exists) {
          const already = (mv.sideCondition && board.hasSide(side, mv.sideCondition)) ||
                          (B.fieldKey(mv) && board.hasField(B.fieldKey(mv)));
          B.noteMove(board, side, user, mv, !already);
        }
        if (e.tgt && (e.tgthp != null || e.dmg)) {
          const foe = side === 'p1' ? 'p2' : 'p1';
          let hit = false;
          for (const s of [foe, side]) { for (const L of ['a', 'b']) {
            const m2 = board.slot(s, L);
            if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) {
              m2.hp = e.tgthp != null ? Math.max(0, e.tgthp / 100) : Math.max(0, m2.hp - e.dmg / 100);
              hit = true; break;
            } } if (hit) break; }
        }
      }
      else if (e.t === 'x' && side) { const m2 = board.slot(side, letter); if (m2) m2.status = norm(e.st); }
      else if (e.t === 'hp' && side) { const m2 = board.slot(side, letter); if (m2 && e.hp != null) m2.hp = Math.max(0, e.hp / 100); }
      else if (e.t === 'b' && side) { const m2 = board.slot(side, letter); if (m2 && e.b) m2.boosts = { ...e.b }; }
      else if (e.t === 'f' && side) { board.faint(side, letter); }
      else if (e.t === 'w' && e.field) { board.setWeather(e.field); }
      else if (e.t === 'fs' && e.field) {
        const mv = dex.moves.get(e.field);
        const k = mv && mv.exists ? B.fieldKey(mv) : norm(e.field);
        if (k) board.startField(k, mv && mv.condition && mv.condition.duration);
      }
    }
    board.endTurn();
  }
}

/* ---- report ---------------------------------------------------------------------------------- */
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(2) + '%';
const seenSlots = why.matched + why.noUser + why.noSheet + why.noCands + why.moveNotEnumerated + why.targetMismatch + why.switchNotFound + why.ambiguous;

console.log('JOINT TURNS (both slots acting)\n');
console.log(`  seen        ${joint.turns.toLocaleString()}`);
console.log(`  usable      ${joint.kept.toLocaleString()}  (${pct(joint.kept, joint.turns)})`);
console.log(`  unmatched   ${joint.unmatched.toLocaleString()}  (${pct(joint.unmatched, joint.turns)})`);
console.log(`  ambiguous   ${joint.ambiguous.toLocaleString()}  (${pct(joint.ambiguous, joint.turns)})`);
console.log(`  one slot only (not counted above): ${joint.oneSlot.toLocaleString()}`);

console.log('\nWHY A SLOT FAILED — per slot examined, not per turn\n');
for (const k of ['matched', 'ambiguous', 'moveNotEnumerated', 'targetMismatch', 'switchNotFound', 'noUser', 'noSheet', 'noCands']) {
  console.log(`  ${k.padEnd(20)} ${String(why[k]).padStart(9)}  ${pct(why[k], seenSlots)}`);
}

console.log('\nTHE SAME TURNS, MATCHED WITH engine/click_match.js\n');
console.log(`  usable      ${fixedJoint.kept.toLocaleString()}  (${pct(fixedJoint.kept, fixedJoint.turns)})   was ${pct(joint.kept, joint.turns)}`);
console.log(`  unmatched   ${fixedJoint.unmatched.toLocaleString()}  (${pct(fixedJoint.unmatched, fixedJoint.turns)})   was ${pct(joint.unmatched, joint.turns)}`);
console.log(`  ambiguous   ${fixedJoint.ambiguous.toLocaleString()}  (${pct(fixedJoint.ambiguous, fixedJoint.turns)})   was ${pct(joint.ambiguous, joint.turns)}`);
console.log('  per slot: ' + Object.entries(fixedWhy).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(', '));

console.log('\nAND WHY DID IT FAIL — the sub-cause, most specific label per failure\n');
const failTotal = Object.values(detail).reduce((a, b) => a + b, 0);
for (const [k, n] of Object.entries(detail).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(38)} ${String(n).padStart(8)}  ${pct(n, failTotal)} of failures, ${pct(n, seenSlots)} of slots`);
}
console.log(`\n  mirror games (a species on BOTH sheets): ${mirrorGames.games.toLocaleString()} of ${games.length.toLocaleString()} (${pct(mirrorGames.games, games.length)})`);
console.log('  most-mirrored: ' + Object.entries(mirrorGames.species).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, n]) => `${s} ${n}`).join(', '));
console.log(`\n  slots scored against the OTHER SIDE'S sheet: ${wrongSheet.slots.toLocaleString()} (${pct(wrongSheet.slots, seenSlots)} of slots)`);
console.log(`    of those, matched anyway and FITTED against the wrong four moves: ${wrongSheet.matched.toLocaleString()} (${pct(wrongSheet.matched, wrongSheet.slots)})`);
console.log(`    of those, failed to match and dropped:                            ${wrongSheet.failed.toLocaleString()} (${pct(wrongSheet.failed, wrongSheet.slots)})`);
const topUnknown = Object.entries(unknownSpecies).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('\n  species with no sheet entry at all: ' + topUnknown.map(([s, n]) => `${s} ${n}`).join(', '));

console.log('\nTHE QUESTION THIS FILE EXISTS FOR: was a redirector up on the unmatched turns?\n');
console.log(`  unmatched joint turns                       ${unmatchedCtx.total.toLocaleString()}`);
console.log(`  ...with Follow Me / Rage Powder up for them  ${unmatchedCtx.redirectUp.toLocaleString()}  (${pct(unmatchedCtx.redirectUp, unmatchedCtx.total)})`);
console.log(`  ...with no redirector anywhere in the turn   ${unmatchedCtx.noRedirect.toLocaleString()}  (${pct(unmatchedCtx.noRedirect, unmatchedCtx.total)})`);

console.log('\nMISLABEL EXPOSURE — clicks the matcher accepts but may have labelled with the wrong target\n');
console.log(`  human move clicks seen                      ${clicks.total.toLocaleString()}`);
console.log(`  ...single-target, aimed at a foe            ${clicks.redirectableTotal.toLocaleString()}  (${pct(clicks.redirectableTotal, clicks.total)})`);
console.log(`  ...resolved with a redirector already up    ${clicks.moveRedirectUp.toLocaleString()}  (${pct(clicks.moveRedirectUp, clicks.total)})`);
console.log(`  ...and recorded as hitting that redirector  ${clicks.moveRedirectHitIt.toLocaleString()}  (${pct(clicks.moveRedirectHitIt, clicks.total)})`);
console.log(`  ...and another foe was alive to have meant  ${clicks.moveRedirectAmbiguous.toLocaleString()}  (${pct(clicks.moveRedirectAmbiguous, clicks.total)})   <- the mislabelled set`);
console.log(`  Lightning Rod / Storm Drain drew it instead ${clicks.abilityDrawer.toLocaleString()}  (${pct(clicks.abilityDrawer, clicks.total)})`);
console.log(`  ...with another foe alive                   ${clicks.abilityAmbiguous.toLocaleString()}  (${pct(clicks.abilityAmbiguous, clicks.total)})`);

const topSoak = Object.entries(soakers).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('\n  who soaks: ' + topSoak.map(([s, n]) => `${s} ${n}`).join(', '));

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'engine/redirect_audit.js',
  corpus: { games: games.length, ofTotal: allGames.length },
  redirectors: { moves: [...REDIRECT_MOVES], abilities: REDIRECT_ABILITY },
  joint, why, fixedJoint, fixedWhy, detail, mirrorGames, wrongSheet, unknownSpecies: Object.fromEntries(topUnknown), unmatchedCtx, clicks,
  soakers: Object.fromEntries(topSoak),
  samples: reasonSamples,
  caveat: 'The protocol records the RESOLVED target of a move and never the chosen one. Redirection '
        + 'therefore cannot make a click unmatchable — the redirector is a legal candidate — it can '
        + 'only make the matched label wrong. Both numbers are reported separately above.',
};
fs.writeFileSync(D('data', 'redirect-audit.json'), JSON.stringify(out, null, 1) + '\n');
console.log('\n  -> data/redirect-audit.json');
