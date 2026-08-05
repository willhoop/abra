/* sheet_channels.js — WHAT AN OPEN TEAM SHEET TELLS THE BOARD. One list, because it is a FACT.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `|showteam|` declares four things the board can act on: nature, item, ability and moves.
 * `Board.switchIn` copies all four onto the active mon and `dmgMon`, `effAbility` and `movePriority`
 * read them. Which of the four a caller passes to `setSheet` is therefore not a style choice — it
 * decides what the board KNOWS, and CLAUDE.md's rule is that fitting environment and playing
 * environment must match.
 *
 * That rule has now been broken in both directions:
 *
 *   2026-07-28  MAG's weights were fitted WITH the sheet visible and the bot played WITHOUT it.
 *   2026-08-04  the opposite. `engine/magnemite.js:522` — the thing that actually plays — passed all
 *               four, while `engine/fit_policy.js` and `engine/joint_rows.js` passed `{nature, item}`.
 *               Measured: 50.47% of fitted decisions were priced against a board the player never
 *               sees, 20 of 58 feature columns, 99.75% of games.
 *
 * The second one survived a week because the list was TYPED OUT in each caller. Three copies of a
 * fact is how they diverge, and the divergence is invisible because every copy keeps working —
 * CLAUDE.md, *FEATURES ARE PER-MODEL, FACTS ARE GLOBAL*. This is the fact.
 *
 * NOT A FEATURE FLAG. The default is all four and the shipping configuration is all four. `pick()`
 * takes a subset only so that "what is the sheet channel worth" has a CONTROL ARM that can be re-run
 * from a command line instead of by patching a source file in memory. A control arm nobody else can
 * reproduce is not evidence.
 *
 * WHAT THIS FILE DOES NOT DO. It does not make a caller correct. `setSheet` writes under
 * `baseSpecies(species)` and `switchIn` reads back under `baseSpecies` of a DIFFERENT string, so a
 * caller can pass all four channels and still land none of them on a board — the `venusaurmega` /
 * `venusaur-mega` shape, 67 writes and 0 matches. Passing the right list is necessary and not
 * sufficient; the callers probe the mon at the point of USE and record the rate.
 */
'use strict';

/* The order is the order `|showteam|` declares them in, which is also the order
 * engine/durable-ingest.js stores them in. */
const CHANNELS = ['nature', 'item', 'ability', 'moves'];

/* Parse a SHEET_CHANNELS environment override. Returns the full list when unset.
 * Exits rather than falling back: a typo silently narrowing the fitting environment is the exact
 * failure this module was written after. */
function fromEnv(raw, label) {
  const s = String(raw || '').trim();
  if (!s) return CHANNELS.slice();
  const want = s.split(',').map(x => x.trim()).filter(Boolean);
  const bad = want.filter(c => !CHANNELS.includes(c));
  if (bad.length) {
    console.error(`unknown sheet channel in SHEET_CHANNELS=${s}: ${bad.join(', ')}` +
      `\nknown channels: ${CHANNELS.join(', ')}`);
    process.exit(1);
  }
  if (want.length !== CHANNELS.length && label) {
    console.log(`SHEET_CHANNELS=${want.join(',')} — ${label} will see a NARROWER board than the live ` +
      `player. This is a control arm, not a shipping configuration.\n`);
  }
  return want;
}

/* Build the object `setSheet` takes, from a stored sheet entry, honouring the channel set.
 * A withheld channel is passed EMPTY rather than omitted, so the shape of the object never depends
 * on the configuration — `switchIn` reads `.moves` unconditionally and an absent key and an empty
 * array must not take different paths through it.
 *
 * The store writes `null` for an absent field (engine/durable-ingest.js: `(f[2]||'')||null`), so
 * every read is defended. */
function pick(entry, channels) {
  const on = new Set(channels || CHANNELS);
  const e = entry || {};
  return {
    nature: on.has('nature') ? (e.nature || '') : '',
    item: on.has('item') ? (e.item || '') : '',
    ability: on.has('ability') ? (e.ability || '') : '',
    moves: on.has('moves') && Array.isArray(e.moves) ? e.moves : [],
  };
}

const isFull = channels => CHANNELS.every(c => (channels || []).includes(c)) &&
                           (channels || []).length === CHANNELS.length;

module.exports = { CHANNELS, fromEnv, pick, isFull };
