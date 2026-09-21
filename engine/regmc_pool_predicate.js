/* regmc_pool_predicate.js -- WHICH REG M-C GAMES ARE IN SCOPE. MEASURE, abra/regmc 0.23.0.
 *
 * ONE DEFINITION, TWO READERS. engine/cut_regmc_pool.js cuts the frozen pool with it, and
 * engine/usage_regulation.js counts Reg M-C usage with it, so the usage model CHOMP reads and the
 * pool MEDICHAM is measured on cannot describe two different populations. It was inline in the
 * cutter until a second reader needed it; a copy would have been the second implementation this
 * project keeps paying for.
 *
 * The reasons for each clause (open sheets only, Will 2026-09-20; the Eject Button conjunction, Will
 * 2026-09-20, Showdown aa6d5f0856) are in the cutter's header and in data/team-pool-frozen-regmc/
 * FROZEN.md. Nothing here restates them. */
'use strict';

const CUTOFF = '2026-09-14';                       // UTC date boundary; strictly before is "old rule"
const FIX_COMMIT = 'aa6d5f0856';                   // Showdown, 2026-09-13 20:13 UTC
const EJECT_ID = 'ejectbutton';                    // READ: <showdown>/data/mods/champions/items.ts, key added by aa6d5f0856
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

const sheetsPresent = g => !!(g.sheets && Array.isArray(g.sheets.p1) && Array.isArray(g.sheets.p2)
                              && g.sheets.p1.length && g.sheets.p2.length);
const declaresItem = g => ['p1', 'p2'].some(s => (g.sheets[s] || []).some(p => norm(p && p.item) === EJECT_ID));
/* CLAUSE 1 -- scope. Open team sheets only, and a sheet that is not there is not a sheet. */
const inScope = g => g.openSheet === true && sheetsPresent(g);
/* CLAUSE 2 -- the conjunction. Before the fix AND the item is declared on a sheet. Asked only of an
 * in-scope game (it reads the sheets). */
const before = g => String(g.date || '') < CUTOFF;
const oldRule = g => before(g) && declaresItem(g);
const keep = g => inScope(g) && !oldRule(g);

module.exports = { CUTOFF, FIX_COMMIT, EJECT_ID, norm, sheetsPresent, declaresItem, inScope, before, oldRule, keep };
