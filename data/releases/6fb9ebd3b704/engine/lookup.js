/* lookup.js — a miss must be DECLARED, not discovered.
 *
 * THE DEFECT THIS EXISTS TO END, stated as a shape rather than as an incident
 * ---------------------------------------------------------------------------
 * Every expensive bug in this project has been one thing:
 *
 *     lookup(x)  ->  null
 *
 * where `null` means BOTH "this genuinely is not in the data" and "you asked the wrong question".
 * Those two are indistinguishable at the call site, so every caller treats both as the first one and
 * carries on. Nothing throws, nothing counts, and the answer is quietly wrong:
 *
 *   the forme lookup      101 of 308 keys unreachable       8.17% of the metagame, for weeks
 *   the mirror sheet      one player's set overwrote the other's   62% of those FITTED anyway
 *   the switched-in target   44.4% of every failed match
 *   the browser tags      every tag lookup returned null     3 of the largest weights read 0
 *   mc_key in a browser   an empty alias map, returned without a word
 *
 * Seven of these in one session, 2026-08-02. Each was fixed, and each fix was a NEW GUARD covering
 * ONE pathway. Will, correctly: *"each time I tell you to research it and implement a universal fix,
 * and each time you devise more and more tests and they continually fail. Are we actually making
 * progress or going in circles?"*
 *
 * The honest answer was that the guards are instrumentation, not a cure. The count of error-swallowing
 * blocks went 233 -> 238 across the session that was supposed to be fixing them. A guard per pathway
 * cannot finish, because there is no end to the pathways.
 *
 * WHAT ACTUALLY FIXES IT
 * ----------------------
 * Stop making the two meanings the same value. A caller that expects a miss must SAY SO:
 *
 *     mcKey('Rotom-Wash')                    // throws if absent — the default
 *     mcKey(sp, { mayMiss: 'unseen forme' }) // returns null, and you have written down why
 *
 * The reason string is required rather than a bare `true`, because "a boolean is not a parameter"
 * (CLAUDE.md) and because the reason is the thing a reviewer needs. It also makes the opt-outs
 * greppable, so the number of places that tolerate a miss is a measurable quantity that can be
 * driven DOWN — unlike a test count, which only ever goes up.
 *
 * WHY IT IS SAFE TO TURN ON
 * -------------------------
 * A miss that was always legitimate becomes one word of code. A miss that was a BUG becomes a
 * crash, immediately, at the exact call site — which is the entire point and the opposite of the
 * current failure mode. `ABRA_LOOKUP_SOFT=1` downgrades throws to counted warnings for one run, so a
 * long fit already in flight can be finished and its misses read off rather than losing the run;
 * it is a diagnostic, not a setting to leave on, and misses() reports what it saw.
 */
'use strict';

const MISSES = Object.create(null);
const SOFT = typeof process !== 'undefined' && process && process.env && process.env.ABRA_LOOKUP_SOFT;

class LookupMiss extends Error {
  constructor(what, key, hint) {
    super(`${what}: no entry for ${JSON.stringify(key)}${hint ? ' — ' + hint : ''}\n` +
      `  If a miss is legitimate here, pass { mayMiss: '<why>' } and say why in one phrase.\n` +
      `  If it is not, this is the bug: the lookup returned null and the caller could not tell.`);
    this.name = 'LookupMiss';
    this.what = what;
    this.key = key;
  }
}

/* The one decision point. Every accessor routes its miss through here.
 *
 * @param value  what the lookup found, or null/undefined
 * @param what   the table being read, e.g. 'MC.mons'
 * @param key    what was asked for, verbatim
 * @param opts   { mayMiss: '<why>' } from the caller, if it expects misses
 * @param hint   optional extra context for the message
 */
function resolve(value, what, key, opts, hint) {
  if (value !== null && value !== undefined) return value;
  const why = opts && opts.mayMiss;
  if (why) {
    /* Counted even when allowed. A declared miss that fires a million times is still worth seeing,
     * and it is how a `mayMiss` that has quietly become wrong gets noticed. */
    const k = `${what} (allowed: ${why})`;
    MISSES[k] = (MISSES[k] || 0) + 1;
    return null;
  }
  const err = new LookupMiss(what, key, hint);
  if (SOFT) {
    const k = `${what} UNDECLARED`;
    if (!MISSES[k]) console.error(`  ABRA_LOOKUP_SOFT: ${err.message.split('\n')[0]}`);
    MISSES[k] = (MISSES[k] || 0) + 1;
    return null;
  }
  throw err;
}

/* What misses happened, declared and otherwise. tests/test-lookup-contract.js reads this, and any
 * long run can print it to find out what it is tolerating. */
function misses() { return Object.assign(Object.create(null), MISSES); }
function resetMisses() { for (const k of Object.keys(MISSES)) delete MISSES[k]; }

module.exports = { resolve, misses, resetMisses, LookupMiss, SOFT: !!SOFT };
