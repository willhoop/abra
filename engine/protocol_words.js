/* protocol_words.js — THE ONE TRANSLATION FROM SHOWDOWN PROTOCOL INTO WORDS.
 *
 * WHY THIS FILE EXISTS AND WHY IT IS NOT A SECOND COPY.
 *
 * `engine/divergence_cards.js` already learned the expensive half of this lesson: raw protocol is
 * unreadable at review speed (`|-damage|p1a: Corviknight|162/173` is a slot code, a bare fraction and
 * an event name), and Will's words were *"dont do it with a bunch of illegible text like you did
 * before"*. That file owns the HTML rendering. `engine/replay_one.js` needs the same translation for a
 * TERMINAL, and CLAUDE.md's rule about facts is exactly on point: a rendering is a per-caller concern,
 * but "what does `-enditem` mean in English" is a FACT and must have one implementation. Two verb
 * tables would drift and the drift would be invisible, because both would keep rendering something.
 *
 * So the TABLE and the two PARSERS live here; the two callers keep their own output shapes.
 *
 * WHAT IS DELIBERATELY NOT HERE: any judgement. Nothing in this file decides whether a line is a
 * defect, and nothing computes a number. It renames fields. An event this table has never seen is
 * printed under its RAW protocol name rather than dropped — a dropped line reads as "nothing
 * happened", which is the failure mode this whole repo is organised against.
 */
'use strict';

/* the event, said in words rather than in protocol. Moved here from divergence_cards.js. */
const VERB = {
  move: 'uses', switch: 'sends in', drag: 'is dragged in', faint: 'faints',
  '-damage': 'drops to', '-heal': 'heals to', '-sethp': 'is set to',
  '-status': 'is', '-curestatus': 'is cured of', '-immune': 'is IMMUNE', '-miss': 'misses',
  '-fail': 'fails', '-crit': 'critical hit', '-resisted': 'resists', '-supereffective': "it's super effective",
  '-boost': 'raises', '-unboost': 'lowers', '-start': 'gains', '-end': 'loses',
  '-singleturn': 'braces with', '-activate': 'triggers', '-enditem': 'uses up',
  '-item': 'reveals', '-ability': 'reveals', '-weather': 'weather', '-fieldstart': 'field',
  '-fieldend': 'field ends', '-sidestart': 'side', '-sideend': 'side ends',
  '-mega': 'MEGA EVOLVES', detailschange: 'becomes', '-formechange': 'becomes',
  '-hitcount': 'hits', '-prepare': 'charges', '-transform': 'transforms into',
  cant: "can't move", upkeep: 'end of turn', turn: 'turn',
};

/* `p2b: Pelipper` -> { side, slot, name }. Returns null when the token is not a slot reference at
 * all, so a caller can tell "this field names a body" from "this field is a stat name". */
function who(tok) {
  const m = /^(p[12])([ab]):?\s*(.*)$/.exec(String(tok || '').trim());
  if (!m) return null;
  const name = (m[3] || '').trim() || m[1] + m[2];
  return { side: m[1], slot: m[2], name, label: name };
}

/* `35/135 brn` -> { cur, max, pct, tail }. The status tail is KEPT: `49/170 brn` and `49/170` are
 * different boards and collapsing them would hide a mechanic. */
function hp(tok) {
  const m = /^(\d+)\s*\/\s*(\d+)(.*)$/.exec(String(tok || '').trim());
  if (!m) return null;
  const cur = +m[1], max = +m[2];
  return { cur, max, pct: max ? Math.round(cur / max * 100) : 0, tail: (m[3] || '').trim() };
}

/* A ten-cell health bar for a terminal. Text, because the HTML caller has its own. */
function bar(pct, width) {
  const w = width || 10;
  const n = Math.max(0, Math.min(w, Math.round(pct / 100 * w)));
  return '[' + '#'.repeat(n) + '.'.repeat(w - n) + ']';
}

/* ONE PROTOCOL LINE AS ONE LINE OF ENGLISH.
 *
 * `occupant` is an optional slot -> species map the caller keeps and this function UPDATES on a
 * switch, so a replacement can be printed as "X sends in, replacing Y". divergence_cards.js keeps its
 * own copy of that bookkeeping because it has to snapshot and restore it across two alternative
 * futures of one instant; this is the simple linear case. */
function glossText(line, occupant) {
  const raw = String(line == null ? '' : line).replace(/^\|/, '');
  if (!raw.trim()) return '';
  const f = raw.split('|').map(x => x.trim());
  const ev = f[0];
  const subject = who(f[1]);
  let leaving = null;
  if (occupant && (ev === 'switch' || ev === 'drag' || ev === 'replace') && subject) {
    const k = subject.side + subject.slot;
    leaving = occupant[k] || null;
    occupant[k] = subject.name;
  }
  const out = [];
  if (subject) out.push(subject.side.toUpperCase() + subject.slot + ' ' + subject.name);
  out.push(VERB[ev] || ev);
  if (leaving) out.push('(replacing ' + leaving + ')');
  for (let i = subject ? 2 : 1; i < f.length; i++) {
    const t = f[i];
    if (!t) continue;
    const h = hp(t);
    if (h) { out.push(bar(h.pct) + ' ' + h.cur + '/' + h.max + ' ' + h.pct + '%' + (h.tail ? ' ' + h.tail : '')); continue; }
    const w = who(t);
    if (w) { out.push('-> ' + w.side.toUpperCase() + w.slot + ' ' + w.name); continue; }
    if (/^\[of\]/.test(t)) continue;
    if (/^\[from\]/.test(t)) { out.push('<from ' + t.replace(/^\[from\]\s*/, '') + '>'); continue; }
    if (/^\[/.test(t)) { out.push('<' + t.replace(/[[\]]/g, '') + '>'); continue; }
    out.push(t);
  }
  return out.join(' ');
}

module.exports = { VERB, who, hp, bar, glossText };
