/* solver/rotom/applied.js — did the server DO what ROTOM chose? Chosen vs applied, for every decision ROTOM sends.
 *
 * WHY (Will, 2026-09-26, after aa2: 14 of 17 game-1 team previews were dropped by the server's message throttle and
 * played with the default team while every log said `sent: true`). A choice that was queued, or even written to the
 * socket, is not a choice the server applied. The only proof is the server's own later lines. So every decision is
 * checked after its turn resolves, against what the server reported:
 *
 *   preview   bring (4) and leads (2), in order: the first request after preview lists OUR side in the order the
 *             server applied (sim/battle.ts runAction 'team' rebuilds side.pokemon in the chosen order), and the
 *             `|switch|` lines at turn 1 name the leads.
 *   move      per slot, the move: the slot's first `|move|` line that is not `[from]` another effect.
 *   target    per slot, for a move whose target the player chooses: the slot named in that `|move|` line.
 *   mega      a mega chosen -> `|-mega|` / a `-Mega` `|detailschange|` for that body this turn; none chosen -> none seen.
 *   switch    a switch chosen in a move request -> `|switch|` (or `|replace|`) of that body into that slot.
 *   forced    the same, for a forced or replacement switch request.
 *   timer     `/timer on` sent -> `|inactive|Battle timer is ON … (requested by ME)` or `|inactive|ME also wants the
 *             timer to be on.` (pokemon-showdown-mc server/room-battle.ts:214-237). Anything else never arrived.
 *
 * Three verdicts per check: APPLIED (the server did it), EXPLAINED (the server did something else, and the log itself
 * says why — every reason below is read from a line, never assumed), MISMATCH (anything else). The reasons:
 *   cant        `|cant|<slot>|<reason>` — flinch, sleep, paralysis, freeze, recharge, Taunt, Disable, Imprison, …
 *   fainted     our body fainted before it moved
 *   left        our body left the slot (dragged, ejected, …) before it moved
 *   ended       the battle ended before it moved
 *   encored     `|-start|<slot>|Encore` this turn before it moved (the move is replaced)
 *   instructed  an Instruct repeat precedes its own move (that line is skipped, not judged)
 *   target-fainted   the chosen target slot's body fainted this turn before our move (the move retargets)
 *   target-empty     the chosen target slot was already empty when the turn began (fainted, nobody left to send in)
 *   redirected  a redirection was set this turn (`-singleturn … move: <a move whose condition has onFoeRedirectTarget>`)
 *               or an ability drew the move (`-activate … ability: <an ability with onAnyRedirectTarget>`). Both sets are
 *               DERIVED from the format, filtered to the regulation (redirectors() below), never typed.
 *   swapped     a `|swap|` moved the bodies between slots this turn
 *   no-target   the move line says `[notarget]`
 *   failed      the move line names no target and the move failed (`[still]` / `[notarget]`, or `-fail` for the user
 *               next): the server never prints where a failed move was aimed. A move turned SPREAD (`[spread] p2a,p2b`)
 *               that hit the chosen slot among others is APPLIED.
 * A choice of `default` (the last fallback) is UNVERIFIABLE by construction and counted as such, never as applied.
 *
 * Pure functions over (request, choice, the public lines of the turn, the next request): unit-tested in
 * solver/tests/test-rotom-applied.js, and run offline over a finished run's own logs by solver/rotom/applied_audit.js.
 */
'use strict';
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CHOOSABLE = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe']);
const SLOTS = 'ab';

/* 'move 2 1 mega, switch 3' -> per-slot actions */
function parseChoice(choice) {
  const c = String(choice || '').trim();
  if (/^team \d+$/.test(c)) return [{ kind: 'team', order: c.slice(5).split('').map(Number) }];
  if (c === 'default' || !c) return [{ kind: 'default' }];
  return c.split(/,\s*/).map(tok => {
    const t = tok.trim().split(/\s+/);
    if (t[0] === 'move') {
      const o = { kind: 'move', idx: +t[1], target: null, mega: false };
      for (const x of t.slice(2)) { if (x === 'mega') o.mega = true; else if (/^-?\d+$/.test(x)) o.target = +x; }
      return o;
    }
    if (t[0] === 'switch') return { kind: 'switch', pos: +t[1] };
    if (t[0] === 'pass') return { kind: 'pass' };
    return { kind: 'unknown', text: tok };
  });
}
const nickOf = ident => String(ident || '').replace(/^p[1-4][a-d]?:\s*/, '');
/* 'p2a: Nick' -> { side: 'p2', slot: 0, nick } */
function posOf(field) {
  const m = /^(p[1-4])([a-d])?:\s*(.*)$/.exec(String(field || ''));
  return m ? { side: m[1], slot: m[2] ? SLOTS.indexOf(m[2]) : null, nick: m[3] } : null;
}
const split = l => String(l).split('|');
/* a [from] line is ANOTHER effect's move (a called move, a copied dance, a reflection) — except `[from] lockedmove`, which is
 * the user's own continuation (a charge move's second turn, a rampage) */
const hasFrom = p => p.some(x => /^\[from\]/.test(x) && !/lockedmove/.test(x));

/* the redirecting moves and abilities of THIS regulation, read from the format (legal = exists, not isNonstandard, not
 * tier Illegal). No checkout -> empty sets: a redirected move then reads as a MISMATCH, which is the safe direction. */
let REDIRECT = null;
function redirectors() {
  if (REDIRECT) return REDIRECT;
  REDIRECT = { moves: new Set(), abilities: new Set() };
  try {
    const { D } = require('../human/dex.js');
    const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
    for (const m of D.moves.all()) if (legal(m) && m.condition && m.condition.onFoeRedirectTarget) REDIRECT.moves.add(m.name);
    for (const a of D.abilities.all()) if (legal(a) && a.onAnyRedirectTarget) REDIRECT.abilities.add(a.name);
  } catch (e) { REDIRECT.error = e.message; }
  return REDIRECT;
}
/* was this slot EMPTY when the turn began? The last line naming it before the turn (o.before[0 .. o.beforeEnd)) is a
 * faint, with no switch-in after it: a foe that fainted last turn with nobody left to send in. A move aimed there is
 * retargeted by the server (sim/battle.ts getTarget). */
function slotEmptyBefore(o, slotTag) {
  const B = o.before; if (!B) return false;
  for (let k = (o.beforeEnd == null ? B.length : o.beforeEnd) - 1; k >= 0; k--) {
    const p = split(B[k]);
    if (!String(p[2] || '').startsWith(slotTag + ':')) continue;
    if (p[1] === 'faint') return true;
    if (p[1] === 'switch' || p[1] === 'drag' || p[1] === 'replace') return false;
  }
  return false;
}
/* the verdict record */
const V = (kind, slot, status, chosen, applied, why) => ({ kind, slot, status, chosen, applied: applied == null ? null : applied, why: why || null });

/* One decision, after its turn resolved.
 *   o = { me: 'p1'|'p2', req, choice, lines: [public lines from the choice to the turn's end], nextReq? }
 * -> [verdict...] (one per checked thing) */
function verifyDecision(o) {
  const acts = parseChoice(o.choice);
  if (acts[0].kind === 'default') return [V('default', null, 'unverifiable', 'default', null, 'the last-resort `default` choice: the server picks')];
  if (acts[0].kind === 'team') return [verifyPreview(o)];
  const req = o.req || {}, me = o.me, mons = (req.side && req.side.pokemon) || [];
  const out = [];
  const lines = (o.lines || []).map(split);
  const ended = lines.findIndex(p => p[1] === 'win' || p[1] === 'tie');
  acts.forEach((a, i) => {
    const slotTag = me + SLOTS[i];
    const atSlot = p => { const x = posOf(p); return x && x.side === me && x.slot === i; };
    if (a.kind === 'pass') return;
    if (a.kind === 'unknown') { out.push(V('parse', i, 'mismatch', a.text, null, 'an action the verifier cannot read')); return; }
    if (a.kind === 'switch') {
      const want = mons[a.pos - 1];
      const wantNick = want ? nickOf(want.ident) : null;
      const kind = req.forceSwitch ? 'forced' : 'switch';
      const k = lines.findIndex(p => (p[1] === 'switch' || p[1] === 'drag' || p[1] === 'replace') && atSlot(p[2]));
      if (k >= 0 && posOf(lines[k][2]).nick === wantNick) { out.push(V(kind, i, 'applied', wantNick, wantNick)); return; }
      /* a `|replace|` later in the turn names the body behind a disguise */
      if (lines.some(p => p[1] === 'replace' && atSlot(p[2]) && posOf(p[2]).nick === wantNick)) { out.push(V(kind, i, 'applied', wantNick, wantNick, 'named by |replace|')); return; }
      if (ended >= 0 && (k < 0 || ended < k)) { out.push(V(kind, i, 'explained', wantNick, null, 'ended')); return; }
      /* the next request is the second witness: who is in this slot now */
      const nx = o.nextReq && o.nextReq.side && o.nextReq.side.pokemon && o.nextReq.side.pokemon[i];
      if (k < 0 && nx && nx.active !== false && nickOf(nx.ident) === wantNick) { out.push(V(kind, i, 'applied', wantNick, wantNick, 'the next request')); return; }
      out.push(V(kind, i, 'mismatch', wantNick, k >= 0 ? posOf(lines[k][2]).nick : null, k >= 0 ? 'a different body came in' : 'no switch into the slot'));
      return;
    }
    /* a move */
    const mv = req.active && req.active[i] && req.active[i].moves && req.active[i].moves[a.idx - 1];
    const wantMove = mv ? (mv.move || mv.id) : null;
    const who = mons[i] ? nickOf(mons[i].ident) : null;
    let moveAt = -1, why = null, instructSkip = false;
    for (let k = 0; k < lines.length; k++) {
      const p = lines[k], c = p[1];
      if (c === 'win' || c === 'tie') { why = why || 'ended'; break; }
      if (!atSlot(p[2]) && !(c === 'swap')) continue;
      if (c === 'swap') { if (posOf(p[2]) && posOf(p[2]).side === me) { why = why || 'swapped'; break; } continue; }
      if (c === 'cant') { why = 'cant: ' + (p[3] || '?'); break; }
      if (c === 'faint') { why = 'fainted'; break; }
      if ((c === 'switch' || c === 'drag' || c === 'replace') && posOf(p[2]).nick !== who) { why = 'left'; break; }
      if (c === '-singleturn' && /Instruct/.test(p[3] || '')) { instructSkip = true; continue; }
      if (c === '-start' && /Encore/.test(p[3] || '')) { why = 'encored'; continue; }
      if (c === 'move' && !hasFrom(p)) {
        if (instructSkip) { instructSkip = false; why = why || 'instructed'; continue; }
        moveAt = k; break;
      }
    }
    if (moveAt < 0) {
      if (why) out.push(V('move', i, 'explained', wantMove, null, why));
      else out.push(V('move', i, 'mismatch', wantMove, null, 'no |move| line for the slot and no line that explains it'));
    } else {
      const p = lines[moveAt], used = p[3];
      if (toID(used) === toID(wantMove)) out.push(V('move', i, 'applied', wantMove, used));
      else if (why === 'encored') out.push(V('move', i, 'explained', wantMove, used, 'encored'));
      else out.push(V('move', i, 'mismatch', wantMove, used, 'the server used a different move'));
      /* the target: only for a move whose target the player chooses, and only when the move itself was applied */
      if (a.target != null && mv && CHOOSABLE.has(mv.target) && toID(used) === toID(wantMove)) {
        const tf = p[4] || '', flags = p.slice(5);
        const tp = posOf(tf);
        const foe = me === 'p1' ? 'p2' : 'p1';
        const loc = tp ? (tp.side === foe ? tp.slot + 1 : -(tp.slot + 1)) : null;
        const chosenSlot = a.target > 0 ? foe + SLOTS[a.target - 1] : me + SLOTS[-a.target - 1];
        /* a move that became a spread move (a terrain, a field effect) names one target and lists every slot it hit */
        const spread = flags.find(x => /^\[spread\]/.test(x));
        const spreadSlots = spread ? spread.replace(/^\[spread\]\s*/, '').split(',').map(x => x.trim()) : [];
        /* no target printed and the move failed or was still ([still] / [notarget], or a -fail for the user next): the
         * server never says where a failed move was aimed, so there is nothing to compare */
        const nextL = lines[moveAt + 1];
        const failed = !tp && (flags.some(x => /\[(still|notarget)\]/.test(x)) || (nextL && nextL[1] === '-fail' && atSlot(nextL[2])));
        if (loc === a.target) out.push(V('target', i, 'applied', chosenSlot, tf));
        else if (spreadSlots.includes(chosenSlot)) out.push(V('target', i, 'applied', chosenSlot, spread, 'spread: hit the chosen slot among others'));
        /* turned spread, and the chosen slot is not in the hit list (it protected, or was immune): the move went at every
         * foe it could, so the chosen target no longer decided anything */
        else if (spread) out.push(V('target', i, 'explained', chosenSlot, tf || spread, 'spread: the move turned spread; the chosen slot was not hit (protected or immune)'));
        else if (failed) out.push(V('target', i, 'explained', chosenSlot, null, 'no target printed: the move failed or charged ([still] / [notarget] / -fail)'));
        else {
          const before = lines.slice(0, moveAt);
          const tgtFainted = before.some(q => q[1] === 'faint' && String(q[2]).startsWith(chosenSlot + ':'));
          const R = redirectors();
          const redirect = lines.some(q => (q[1] === '-singleturn' && R.moves.has(String(q[3] || '').replace(/^move:\s*/, ''))) ||
                                         (q[1] === '-activate' && R.abilities.has(String(q[3] || '').replace(/^ability:\s*/, ''))));
          const swapped = before.some(q => q[1] === 'swap');
          const noTarget = !tp && flags.some(x => /\[notarget\]/.test(x));
          const r = noTarget ? 'no-target' : tgtFainted ? 'target-fainted' : slotEmptyBefore(o, chosenSlot) ? 'target-empty' : redirect ? 'redirected' : swapped ? 'swapped' : null;
          out.push(V('target', i, r ? 'explained' : 'mismatch', chosenSlot, tf || null, r || 'the move went to a different slot and no line says why'));
        }
      }
    }
    /* mega: chosen -> it happened this turn; not chosen -> it did not */
    const megaLine = lines.findIndex(q => (q[1] === '-mega' && atSlot(q[2])) || (q[1] === 'detailschange' && atSlot(q[2]) && /-Mega/.test(q[3] || '')));
    if (a.mega) {
      if (megaLine >= 0) out.push(V('mega', i, 'applied', 'mega', 'mega'));
      else if (ended >= 0 && !lines.slice(0, ended).some(q => q[1] === 'move' || q[1] === 'switch')) out.push(V('mega', i, 'explained', 'mega', null, 'ended'));
      else out.push(V('mega', i, 'mismatch', 'mega', null, 'mega chosen, no |-mega| for the slot this turn'));
    } else if (megaLine >= 0 && req.active && req.active[i] && req.active[i].canMegaEvo) {
      out.push(V('mega', i, 'mismatch', 'no mega', 'mega', 'a mega the policy did not choose'));
    }
  });
  return out;
}

/* the preview: the order the server applied (the next request), and the leads it switched in */
function verifyPreview(o) {
  const acts = parseChoice(o.choice);
  const order = acts[0].order;
  const mons = (o.req && o.req.side && o.req.side.pokemon) || [];
  const expected = order.map(p => mons[p - 1] ? nickOf(mons[p - 1].ident) : '?');
  const nx = o.nextReq && o.nextReq.side && o.nextReq.side.pokemon;
  const leadsSeen = [0, 1].map(i => { const l = (o.lines || []).map(split).find(p => p[1] === 'switch' && (posOf(p[2]) || {}).side === o.me && (posOf(p[2]) || {}).slot === i); return l ? posOf(l[2]).nick : null; });
  if (!nx) {
    if (leadsSeen[0] && leadsSeen[1]) {
      const ok = leadsSeen[0] === expected[0] && leadsSeen[1] === expected[1];
      return Object.assign(V('preview', null, ok ? 'applied' : 'mismatch', expected.join(','), leadsSeen.join(',') + ' (leads only)', ok ? 'leads only: no later request' : 'the leads differ'), { expected, actual: leadsSeen });
    }
    return Object.assign(V('preview', null, 'unverifiable', expected.join(','), null, 'no request after the preview and no leads in the log'), { expected, actual: null });
  }
  const actual = nx.slice(0, order.length).map(p => nickOf(p.ident));
  const ok = actual.join('|') === expected.join('|');
  const leadsOk = actual[0] === expected[0] && actual[1] === expected[1];
  return Object.assign(V('preview', null, ok ? 'applied' : 'mismatch', expected.join(','), actual.join(','),
    ok ? null : (leadsOk ? 'the bring or its order differs' : 'the leads differ')), { expected, actual, leads_seen: leadsSeen });
}

/* the timer: we sent `/timer on` to this battle; the room's `|inactive|` lines say whether the server took it */
function verifyTimer(o) {
  if (!o.sent) return null;
  const me = toID(o.name);
  const ack = (o.lines || []).some(l => { const m = /Battle timer is ON.*\(requested by (.+?)\)/.exec(l); if (m && toID(m[1]) === me) return true; const a = /\|inactive\|(.+?) also wants the timer to be on/.exec(l); return !!(a && toID(a[1]) === me); });
  if (ack) return V('timer', null, 'applied', 'timer on', 'timer on');
  return V('timer', null, 'mismatch', 'timer on', (o.lines || []).some(l => /Battle timer is ON/.test(l)) ? 'on (not by us)' : 'off', 'the server never acknowledged our /timer on');
}

/* counters: per game and per run */
class Tally {
  constructor() { this.chosen = 0; this.applied = 0; this.explained_diff = 0; this.mismatch = 0; this.unverifiable = 0; this.by_kind = {}; this.why = {}; this.mismatches = []; }
  add(v, ctx) {
    if (!v) return;
    const k = this.by_kind[v.kind] = this.by_kind[v.kind] || { chosen: 0, applied: 0, explained_diff: 0, mismatch: 0, unverifiable: 0 };
    if (v.status === 'unverifiable') { this.unverifiable++; k.unverifiable++; return; }
    this.chosen++; k.chosen++;
    if (v.status === 'applied') { this.applied++; k.applied++; }
    else if (v.status === 'explained') { this.explained_diff++; k.explained_diff++; const w = String(v.why).split(':')[0]; this.why[w] = (this.why[w] || 0) + 1; }
    else { this.mismatch++; k.mismatch++; if (this.mismatches.length < 30) this.mismatches.push(Object.assign({}, ctx || {}, v)); }
  }
  merge(t) { for (const k of ['chosen', 'applied', 'explained_diff', 'mismatch', 'unverifiable']) this[k] += t[k] || 0;
    for (const [k, v] of Object.entries(t.by_kind || {})) { const m = this.by_kind[k] = this.by_kind[k] || { chosen: 0, applied: 0, explained_diff: 0, mismatch: 0, unverifiable: 0 }; for (const x of Object.keys(m)) m[x] += v[x] || 0; }
    for (const [w, n] of Object.entries(t.why || {})) this.why[w] = (this.why[w] || 0) + n;
    for (const x of t.mismatches || []) if (this.mismatches.length < 30) this.mismatches.push(x); }
  toJSON() { return { chosen: this.chosen, applied: this.applied, explained_diff: this.explained_diff, mismatch: this.mismatch, unverifiable: this.unverifiable, by_kind: this.by_kind, why: this.why, mismatches: this.mismatches }; }
}

module.exports = { parseChoice, posOf, nickOf, verifyDecision, verifyPreview, verifyTimer, Tally, CHOOSABLE, redirectors };
