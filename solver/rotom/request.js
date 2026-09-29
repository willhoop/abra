/* solver/rotom/request.js — the SERVER'S request is the legality authority. Everything ROTOM sends is checked here.
 *
 *   options(req)             per-slot legal options read ONLY from the |request| JSON
 *   joints(req)              the joint product, less what the server refuses across slots
 *   isLegal(req, choice)     does this choice string name one of those joints?
 *   fromEngine(req, joint, sheetOfPos)   a MEDICHAM joint -> a request option per slot (or null for a slot)
 *   heuristic(req)           the last-resort choice that is always legal (first usable move at a live foe)
 *   previewChoice(order)     'team 3142' from four request positions (1-based), leads first
 *
 * THE RULES, READ FROM THE AUTHORITY (not recalled):
 *  - choice grammar: sim/side.ts `choose` — `move N [target] [mega]`, `switch N`, `pass`, `team 1234`, joined by ', '.
 *  - target locations and the choosable target classes: the API's own `validTargetLoc` / `CHOOSABLE_TARGETS`
 *    (engine/medicham_api.js, read from sim/battle.ts validTargetLoc and sim/battle-actions.ts).
 *  - across slots: one body switched in once, one mega per turn (sim/side.ts chooseSwitch / chooseMove).
 *  - a trapped slot has no switch; a disabled move is not offered; `forceSwitch[i]` slots may only switch (or pass
 *    when nobody is left); Revival Blessing (`reviving`) switches to a FAINTED body.
 * MEDICHAM's menu is a second opinion used to SCORE options, never to legalise one.
 */
'use strict';

const CHOOSABLE = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe']);
function validTargetLoc(targetLoc, sourceLoc, targetType, numSlots) {   // sim/battle.ts:2399-2430, via engine/medicham_api.js
  if (targetLoc === 0) return true;
  if (Math.abs(targetLoc) > numSlots) return false;
  const isSelf = (sourceLoc === targetLoc);
  const isFoe = targetLoc > 0;
  const acrossFromTargetLoc = -(numSlots + 1 - targetLoc);
  const isAdjacent = (targetLoc > 0 ? Math.abs(acrossFromTargetLoc - sourceLoc) <= 1 : Math.abs(targetLoc - sourceLoc) === 1);
  switch (targetType) {
    case 'randomNormal': case 'scripted': case 'normal': return isAdjacent;
    case 'adjacentAlly': return isAdjacent && !isFoe;
    case 'adjacentAllyOrSelf': return (isAdjacent && !isFoe) || isSelf;
    case 'adjacentFoe': return isAdjacent && isFoe;
    case 'any': return !isSelf;
  }
  return false;
}
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fainted = p => /\bfnt\b/.test(String(p && p.condition || '')) || String(p && p.condition || '').startsWith('0');

function options(req) {
  const side = req.side || {}, mons = side.pokemon || [];
  const n = req.forceSwitch ? req.forceSwitch.length : (req.active || []).length;
  const reviving = mons.some(p => p.reviving);
  const bench = [];
  mons.forEach((p, j) => { if (!p.active && (reviving ? fainted(p) : !fainted(p))) bench.push(j); });
  const slots = [];
  for (let i = 0; i < n; i++) {
    const mon = mons[i];
    const opts = [];
    if (req.forceSwitch) {
      /* two slots forced and fewer bench bodies than that: one of them passes (sim/side.ts: a forced slot may
       * pass only when there is nobody left to send in — `joints` then keeps exactly min(bench, forced) switches) */
      const forcedN = req.forceSwitch.filter(Boolean).length;
      if (req.forceSwitch[i]) for (const j of bench) opts.push({ kind: 'switch', pos: j + 1, choice: 'switch ' + (j + 1) });
      if (!req.forceSwitch[i] || bench.length < forcedN) opts.push({ kind: 'pass', choice: 'pass' });
      slots.push({ slot: i, options: opts, forced: !!req.forceSwitch[i] });
      continue;
    }
    const a = req.active && req.active[i];
    if (!a || !mon || fainted(mon) || mon.commanding) { opts.push({ kind: 'pass', choice: 'pass' }); slots.push({ slot: i, options: opts }); continue; }
    const moves = a.moves || [];
    /* a hard lock (Struggle, a recharge, a rampage or charge continuation) arrives as ONE move with no target class */
    const locked = moves.length === 1 && (moves[0].id === 'struggle' || moves[0].id === 'recharge' || !moves[0].target);
    moves.forEach((mv, k) => {
      if (mv.disabled) return;
      const tt = mv.target;
      const src = -(i + 1);
      const locs = (!locked && CHOOSABLE.has(tt) && n > 1) ? [1, 2, -1, -2].filter(l => validTargetLoc(l, src, tt, 2)) : [null];
      for (const loc of locs) for (const mega of (a.canMegaEvo && !locked) ? [false, true] : [false]) {
        opts.push({ kind: 'move', idx: k + 1, id: toID(mv.id || mv.move), target: loc, mega,
                    choice: 'move ' + (k + 1) + (loc == null ? '' : ' ' + loc) + (mega ? ' mega' : '') });
      }
    });
    if (!a.trapped) for (const j of bench) opts.push({ kind: 'switch', pos: j + 1, choice: 'switch ' + (j + 1) });
    if (!opts.length) opts.push({ kind: 'move', idx: 1, id: toID(moves[0] && (moves[0].id || moves[0].move)), target: null, mega: false, choice: 'move 1' });
    slots.push({ slot: i, options: opts });
  }
  return slots;
}

function compatible(pre, o) {
  if (o.kind === 'switch' && pre.some(p => p.kind === 'switch' && p.pos === o.pos)) return false;
  if (o.mega && pre.some(p => p.mega)) return false;
  return true;
}
function joints(req) {
  const slots = options(req);
  let J = [[]];
  for (const s of slots) {
    const next = [];
    for (const pre of J) for (const o of s.options) if (compatible(pre, o)) next.push(pre.concat([o]));
    J = next;
  }
  /* a forced switch with fewer bench bodies than forced slots: a slot may pass, but never both when one can switch */
  if (req.forceSwitch) {
    const mons = (req.side && req.side.pokemon) || [];
    const reviving = mons.some(p => p.reviving);
    const bench = mons.filter(p => !p.active && (reviving ? fainted(p) : !fainted(p))).length;
    const need = Math.min(bench, req.forceSwitch.filter(Boolean).length);
    J = J.filter(j => j.filter(o => o.kind === 'switch').length === need);
  }
  return J;
}
const joinChoice = j => j.map(o => o.choice).join(', ');

function isLegal(req, choice) {
  if (req.teamPreview) {
    const m = /^team (\d+)$/.exec(choice);
    if (!m) return false;
    const n = (req.side && req.side.pokemon || []).length;
    const d = m[1].split('').map(Number);
    const want = req.maxChosenTeamSize || Math.min(4, n);
    return d.length === want && new Set(d).size === d.length && d.every(x => x >= 1 && x <= n);
  }
  return joints(req).some(j => joinChoice(j) === choice);
}

/* A MEDICHAM joint -> request options, slot by slot. `posOfTeam(i)` maps the engine's team index to a 1-based
 * request position (by the body's sheet row). Returns an array (null where a slot does not map). */
function fromEngine(req, joint, posOfTeam) {
  const slots = options(req);
  return slots.map((s, i) => {
    const o = joint && joint[i];
    if (!o || o.kind === 'pass') return s.options.find(x => x.kind === 'pass') || null;
    if (o.kind === 'switch') { const pos = posOfTeam(o.to); return s.options.find(x => x.kind === 'switch' && x.pos === pos) || null; }
    if (o.forced) return s.options.length === 1 ? s.options[0] : (s.options.find(x => x.kind === 'move' && x.id === toID(o.move) && !x.mega) || null);
    return s.options.find(x => x.kind === 'move' && x.id === toID(o.move) && x.mega === !!o.mega && (x.target === (o.target == null ? null : o.target))) ||
           s.options.find(x => x.kind === 'move' && x.id === toID(o.move) && x.mega === !!o.mega && x.target == null) || null;
  });
}

/* ALWAYS LEGAL, NEVER CLEVER: the first usable move at a live foe per slot (a switch or pass when that is all
 * there is), no mega, no repeated switch. The floor under every policy. */
function heuristic(req) {
  const J = joints(req);
  if (!J.length) return null;
  const foesAlive = [1, 2];
  const score = j => j.reduce((s, o) => s + (o.kind === 'move' ? (o.target == null || foesAlive.includes(o.target) ? 2 : 1) - (o.mega ? 0.5 : 0) : o.kind === 'switch' ? 0.5 : 0), 0);
  let best = J[0], bs = score(J[0]);
  for (const j of J) { const s = score(j); if (s > bs) { best = j; bs = s; } }
  return joinChoice(best);
}

const previewChoice = order => 'team ' + order.map(p => String(p)).join('');

/* the 1-based REQUEST position of open-sheet member `s` (0-based): the request lists the team in its own order,
 * so the member is found by its nickname (open sheets carry the species as the nick). Unmatched -> s + 1.
 * DELIBERATE BREAK (env ROTOM_BREAK=posmap): the sheet index is returned as the position unmapped —
 * solver/tests/test-chomp.js must go red on a request whose order differs from the sheet's. */
function posOfSheet(req, sheet, s) {
  const r = sheet && sheet[s];
  if (!r) return s + 1;
  if (process.env.ROTOM_BREAK === 'posmap') return s + 1;
  const j = ((req.side && req.side.pokemon) || []).findIndex(pk => String(pk.ident).replace(/^p[12]:\s*/, '') === r.nick);
  return j >= 0 ? j + 1 : s + 1;
}

module.exports = { options, joints, joinChoice, isLegal, fromEngine, heuristic, previewChoice, posOfSheet, validTargetLoc, fainted, toID };
