/* solver/arena/env.js — select Reg M-C and its Showdown checkout BEFORE anything loads the engine or
 * the dex. Required first by the arena and the MILTANK tests.
 *
 * The regulation is set only if the caller named none; a caller that named another one is refused,
 * because this code plays Reg M-C sheets and nothing else. The checkout is the one the engine's own
 * resolver names for the regulation (engine/regulation.js `checkoutCandidates`), so solver/human/dex.js
 * — which looks only one directory above the repo and so misses from a worktree — reads the same
 * checkout the engine does. An explicit SHOWDOWN_PATH always wins.
 */
'use strict';
const fs = require('fs');
const path = require('path');
if (!process.env.ABRA_REGULATION && !process.argv.some(a => a.startsWith('--regulation'))) process.env.ABRA_REGULATION = 'regmc';
if (process.env.ABRA_REGULATION !== 'regmc') throw new Error('solver arena: Reg M-C only; ABRA_REGULATION=' + process.env.ABRA_REGULATION);
const REG = require('../../engine/regulation.js');
if (!process.env.SHOWDOWN_PATH) {
  const c = (REG.checkoutCandidates() || []).find(p => fs.existsSync(path.join(p, 'dist', 'sim')));
  if (c) process.env.SHOWDOWN_PATH = c;
}
module.exports = { regulation: REG.ID, checkout: process.env.SHOWDOWN_PATH };
