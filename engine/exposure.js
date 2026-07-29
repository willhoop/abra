/* exposure.js — the pricing-risk engine's PUBLIC DOOR. The implementation lives inside
 * engine/medicham2-browser.js, next to the scorer that consumes it (bestMoveVs subtracts the price
 * from every candidate click — Will: "that actually get priced into decisions"). It moved there
 * because a helper module cannot be required BY the engine it needs (cycle), and a second copy of
 * the pricing is how the price and the simulation drift apart. This file re-exports the same
 * functions under the names its first callers used, so nothing downstream has to know the move.
 *
 * What the price is, channel by channel, and everything it deliberately does not price yet, is
 * documented at the implementation site (search medicham2-browser.js for THE PRICING-RISK ENGINE).
 * In the browser there is nothing to load here: window.punishExposure is set by the engine script. */
'use strict';
const M = require('./medicham2-browser.js');
module.exports = {
  punishExposure: M.punishExposure,
  statusCost: M.statusCostOf,
  physicalShare: M.physicalShare,
  speedFlipShare: M.speedFlipShare,
  DEFAULT_HORIZON: M.EXPOSURE_HORIZON,
};
