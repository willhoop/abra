/* divergence_shape.js — WHAT THE TWO PROTOCOL LINES ACTUALLY DISAGREE ABOUT. ONE IMPLEMENTATION.
 *
 * This was written inside `engine/divergence_report.js` on 2026-08-11 and stayed there for a day. It
 * moved out the moment a SECOND reader needed it: `engine/game_differential.js` cross-tabs the
 * end-state verdict against the shape, and a second copy of "same event, different slot means
 * ORDERING" is exactly the two-implementations-of-one-fact CLAUDE.md forbids. The two would have
 * agreed on the day they were written and diverged the first time either was tuned.
 *
 * THE SHAPES, and why the differential's own class names are the wrong grouping:
 *
 *   ORDERING  same event, different slot   — the two engines did the same thing in a different order.
 *   RULE      same slot, different event   — they disagree about what happened to that body.
 *   FIELD     same event and slot, a field differs — they agree on the event and not on its value.
 *   EMISSION  one side has a line the other does not.
 *   UNPARSED  the cause string is not two protocol lines and cannot be shaped at all. It is NOT a
 *             fifth kind of disagreement and must never be read as one — it is the comparator saying
 *             it could not tell, which is a gap in this file rather than a fact about the engines.
 *
 * The weather-residual defect was SIX causes that read as separate rows and turned out to be one rule.
 * Protect is FIFTEEN causes spread across FOUR of the differential's classes at once.
 *
 * `PINNED` marks a cause naming a mechanic that reads one of Mode A's pinned dice. It is a SUSPECT
 * flag and never an exclusion: the Protect case proved a coupling suspect can still be a real
 * disagreement, because the authority was pinned the same way and the divergence survived anyway.
 */
'use strict';

const LINE = (s) => {
  const t = String(s || '').trim();
  if (!t.startsWith('|')) return null;
  const parts = t.split('|').slice(1);
  return { event: parts[0] || '', slot: (parts[1] || '').split(':')[0], rest: parts.slice(2).join('|') };
};

const PINNED = /accuracy|acc\b|crit|secondar|damage|protect|stall|miss|-fail/i;

function shapeOf(cause) {
  const body = String(cause).replace(/^[^:]*:: /, '');
  const half = body.split(' <> ');
  const a = LINE(half[0]), b = LINE(half[1]);
  if (!a || !b) return { shape: 'UNPARSED', key: body.slice(0, 40) };
  if (a.event === b.event && a.slot !== b.slot) return { shape: 'ORDERING', key: a.event };
  if (a.slot === b.slot && a.event !== b.event) return { shape: 'RULE', key: a.event + ' vs ' + b.event };
  if (a.event === b.event && a.slot === b.slot) return { shape: 'FIELD', key: a.event };
  return { shape: 'EMISSION', key: a.event + ' vs ' + b.event };
}

module.exports = { LINE, PINNED, shapeOf, SHAPES: ['ORDERING', 'RULE', 'FIELD', 'EMISSION', 'UNPARSED'] };
