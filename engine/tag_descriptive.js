/* tag_descriptive.js — THE TAGS THAT NAME A DEPENDENCY RATHER THAN DRIVE A BEHAVIOUR. 2026-09-19.
 *
 * `engine/coverage.js` counts a tag as covered when every in-scope row has an engine reader
 * (`consumedBy`). Two move tags have sat at NO READER since the counter existed:
 *
 *     needsUntrackedState   Rage Fist, Gyro Ball, Electro Ball, Last Respects
 *     readsOwnItem          Acrobatics
 *
 * NEITHER IS AN ENGINE GAP, AND THE EVIDENCE IS THAT EVERY ONE OF THOSE FIVE MOVES COMPUTES ITS
 * POWER CORRECTLY TODAY. The behaviour is carried by a DIFFERENT tag on the SAME row, and the engine
 * reads that one:
 *
 *     ragefist      variablePower {kind: userTimesHit}          medicham2-browser.js, `_vp.kind==='userTimesHit'`
 *     gyroball      variablePower {kind: speedRatioLinear}      ... `_vp.kind==='speedRatioLinear'`
 *     electroball   variablePower {kind: speedRatioTable}       ... `_vp.kind==='speedRatioTable'`
 *     lastrespects  powerFromFallen {base, perFallen}           ... `TAGS.param('move',mv.id,'powerFromFallen')`
 *     acrobatics    variablePower {kind: userNoItem}            ... `_vp.kind==='userNoItem'`
 *
 * WHAT THE TWO TAGS ACTUALLY SAY is what state a power depends on — written for `engine/board.js`,
 * whose own note is "dex basePower is 0, so board.js returns null and scores them as non-damaging".
 * That is a statement ABOUT a consumer, not an instruction TO one, and no engine line can read it
 * without duplicating the behaviour tag beside it. Two implementations of one fact is the breach
 * CLAUDE.md names; the right answer is to declare the tag descriptive, not to give it a second reader.
 *
 * THIS IS NOT A SILENT RECLASSIFICATION, AND THAT IS THE WHOLE POINT OF THE FILE:
 *   - the declaration is DATA, in one place, read by `engine/tag_dex.js` (which stamps `descriptive`
 *     onto the tag's row on its next run) and by `engine/coverage.js` (which reads it directly, so the
 *     count is right before any regeneration). One declaration, two readers, no chance of disagreement;
 *   - `coverage.js` PRINTS the descriptive rows and their `via` tag on every run rather than dropping
 *     them out of the report — a reclassification nobody can see is the caption-as-quarantine failure;
 *   - `tests/probe_descriptive_tags.js` is the guard. For every in-scope carrier of a descriptive tag
 *     it asserts the carrier also carries the `via` tag, that the `via` tag HAS an engine reader, and
 *     that BOTH tags have a LIVE census row — so the day somebody deletes the behaviour tag, or its
 *     reader, or its probe, this stops being a reclassification and goes red by name.
 *     `TAG_DESCRIPTIVE_BREAK=<tag>` drops the via-link and shows it red.
 *
 * TO ADD ONE: name the tag, say WHY it cannot have a reader, and name every tag that carries the
 * behaviour instead. A row whose carriers are not all covered by a named `via` fails the probe.
 */
'use strict';

const DESCRIPTIVE = {
  needsUntrackedState: {
    kind: 'move',
    why: 'it names the STATE a variable power depends on, for engine/board.js, which prices these '
       + 'moves at 0. It is a note about a consumer, not an instruction to one — the power itself is '
       + 'computed from variablePower / powerFromFallen, which the damage engine does read.',
    via: ['variablePower', 'powerFromFallen'],
  },
  readsOwnItem: {
    kind: 'move',
    why: 'it says WHICH state Acrobatics reads (the user\'s own item slot) so that the item-loss '
       + 'cluster — Knock Off, Trick, a spent Sash, Unburden — can be reasoned about in one place. '
       + 'The doubling itself is variablePower {kind: userNoItem}, which the damage engine reads. A '
       + 'second reader here would be the x2 implemented twice.',
    via: ['variablePower'],
  },
};

const isDescriptive = tag => Object.prototype.hasOwnProperty.call(DESCRIPTIVE, tag);

module.exports = { DESCRIPTIVE, isDescriptive };
