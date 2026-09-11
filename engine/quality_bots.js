/* quality_bots.js — WHICH GAMES IN A STORE A BOT PLAYED, BY ID, DECIDED BY quality.js AND NOTHING ELSE.
 *
 * WHY THIS EXISTS. engine/selftest.js requires every raw reader of the ladder store to filter or to
 * say why it may not. On 2026-09-10, once selftest ran on its declared heap for the first time since
 * the bo3 store grew, it named three census instruments that did neither:
 * engine/joint_click_census.js, engine/rollout_switch_census.js and engine/mega_sets_from_sheets.js.
 * Each describes a HUMAN population ("a pair of human clicks", "human replay logs", "declared by the
 * player"), and each counted bot games inside it.
 *
 * WHY NOT loadGames(). loadGames() applies every quality rule, and three of them would bias these
 * instruments rather than clean them:
 *   - `short` (min turns) and `forfeit_no_action` cut the short end off a GAME-LENGTH distribution.
 *     rollout_switch_census.js derives the playout cap from exactly that distribution.
 *   - `partial_bring` says nothing about what a player DECLARED on a sheet or CLICKED on a turn.
 * So this keeps only the reasons that make a game non-human or not this format: `bot`,
 * `behavioural_bot` and `illegal_team`. It reads those reasons from `quality.reasons()` with the same
 * behavioural bot set loadGames() builds, so there is one definition of a bot, and it lives in
 * quality.js. This file only chooses which of quality.js's reasons apply.
 *
 * `judged` is every id the parsed store holds. A raw log whose id is not in it cannot be judged, and
 * the callers exclude it and COUNT it. An unjudged game is not a clean one.
 *
 * Deliberately a separate file: engine/quality.js is one of the sources engine/engine_release.js
 * freezes, so a new export there would re-cut the engine.
 */
'use strict';
const path = require('path');
const Q = require('./quality.js');

const BOT_REASONS = Object.freeze(['bot', 'behavioural_bot', 'illegal_team']);

/** storePath: a parsed store, e.g. data/games.bo3.jsonl. Returns { judged: Set, bot: Set, games }. */
function botGameIds(storePath) {
  const games = Q.readStore(storePath);
  const cfg = Q.config();
  const bots = Q.behaviouralBots(games, cfg);
  const judged = new Set(), bot = new Set();
  for (const g of games) {
    if (!g || !g.id) continue;
    judged.add(g.id);
    if (Q.reasons(g, cfg, bots).some(r => BOT_REASONS.includes(r))) bot.add(g.id);
  }
  return { judged, bot, games: games.length, store: path.basename(String(storePath)) };
}

module.exports = { botGameIds, BOT_REASONS };
