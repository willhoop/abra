/* probe_weather_defence_stat.js — SNOW AND SAND RAISE A *STAT*, NOT A *CATEGORY*.
 *
 *   node tests/probe_weather_defence_stat.js
 *   MEDI_WEATHER_DEF_BY_CATEGORY=1 node tests/probe_weather_defence_stat.js   (the knob: expect RED)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED ====================================
 *
 * `data/mods/champions/conditions.ts` has NO `snowscape` and NO `sandstorm` key — grepped, not
 * assumed — so mainline governs. `data/conditions.ts:696-726` (snowscape) and :653-660 (sandstorm):
 *
 *     snowscape: {
 *       onModifyDefPriority: 10,
 *       onModifyDef(def, pokemon) {
 *         if (pokemon.hasType('Ice') && pokemon.effectiveWeather() === 'snowscape') {
 *           return this.modify(def, 1.5);
 *
 *     sandstorm: {
 *       onModifySpDPriority: 10,
 *       onModifySpD(spd, pokemon) {
 *         if (pokemon.hasType('Rock') && pokemon.effectiveWeather() === 'sandstorm') {
 *           return this.modify(spd, 1.5);
 *
 * They are `onModifyDef` and `onModifySpD` — handlers on a STAT. Which handler a hit runs is decided
 * in `sim/battle-actions.ts:1676` and :1709, and the decision is NOT the move's category:
 *
 *     const defenseStat: StatIDExceptHP = move.overrideDefensiveStat || (isPhysical ? 'def' : 'spd');
 *     ...
 *     defense = this.battle.runEvent('Modify' + statTable[defenseStat], target, source, move, defense);
 *
 * `move.overrideDefensiveStat` wins. `Dex.forFormat(...).moves.get('psyshock')` reads
 * `category: Special, overrideDefensiveStat: 'def'` (derived on every run below, and printed) — so a
 * SPECIAL Psyshock runs `ModifyDef` and therefore DOES get snow's x1.5 and does NOT get sand's.
 *
 * ================= WHAT WAS WRONG, AND IT IS WRONG IN BOTH DIRECTIONS ==========================
 *
 * `engine/medicham2-browser.js` gated both weathers on the move's CATEGORY:
 *
 *     if(phys && field.weather==='snow' && def.types.includes('Ice')) DCH(1.5);
 *     if(!phys&& field.weather==='sand' && def.types.includes('Rock'))DCH(1.5);
 *
 * `phys` is `mv.c==='P'`. Psyshock is `S`, so:
 *   - snow: the authority halves-ish the hit and this engine did not  -> WE OVERKILL an Ice type.
 *   - sand: the authority does nothing and this engine reduced anyway -> WE UNDER-DAMAGE a Rock type.
 *
 * The engine already computes the authority's own `defenseStat` thirty lines above, as `_dKey`
 * (`statSwap.attackInto` || (phys?'df':'sd')) — the same expression, already honoured by the stat
 * chain, by Wonder Room and by the boost stages. The two weather lines were the only readers of the
 * category where every neighbour reads the stat.
 *
 * ================= WHAT IT COST, MEASURED =====================================================
 *
 * Two of the 34 board partings in the held-out 12,000-game draw on release `18773c22878f`
 * (`data/verification/game-differential.g12000.json`, rows 11 and 16), both a Psyshock into a
 * Froslass in its own Snow Warning snow:
 *
 *     row 16  |-damage|p2a: Froslass|69/145   (authority)   vs  |-damage|p2a: Froslass|31/145 (ours)
 *             76 damage against 114 — exactly x1.5.
 *     row 11  |-damage|p2a: Froslass|6/145    (authority)   vs  |-damage|p2a: Froslass|0 fnt  (ours)
 *             the same 1.5x, and this one KILLS. It changes who is on the field.
 *
 * ================= WHY EACH ARM IS HERE, AND WHY IT CAN FAIL ===================================
 *
 * Every arm is ONE attacker clicking ONE Psychic move into ONE target, read as the target's HP loss
 * over a turn, against THE SAME CELL IN A CLEAR SKY. Only the sky varies inside a cell, so nothing
 * but the weather handler can move the reading.
 *
 * ALL THREE MOVES ARE PSYCHIC ON PURPOSE. Effectiveness, STAB and the type chart are then identical
 * across every arm, which removes the one confound that would otherwise differ between a physical
 * arm and a special one. What varies is precisely the pair (category, stat read):
 *
 *     psychicfangs   Physical, reads Def      snow must CUT    sand must NOT
 *     psychic        Special,  reads SpD      snow must NOT    sand must CUT
 *     psyshock       Special,  reads DEF      snow must CUT    sand must NOT     <- the defect
 *
 * A wire gated on CATEGORY and a wire gated on STAT agree on the first two rows and disagree on the
 * third. That is the whole knob: the first two rows are the control that proves the weather effect
 * is wired at all, and the third is the question. **Identical results across a varied knob mean the
 * knob is unwired** — so the probe also refuses a run in which the two control rows do not move.
 *
 * TWO MORE ARMS FOR THE TYPE GATE. The same three moves into a body that is neither Ice nor Rock
 * (Garchomp, Dragon/Ground) in each sky: every one must be IDENTICAL to its clear-sky reading. A
 * wire that reduced damage in any snow would pass the three arms above and fail these.
 *
 * ================= THE SECOND REASONS, DERIVED AND REFUSED ======================================
 *
 * A cell is only evidence if exactly ONE thing can move it. Two things could:
 *   (a) WEATHER CHIP. Snowscape has no residual at all in this generation; sandstorm does, and it is
 *       additive, present in only one of the two readings, and would move the number for a reason
 *       that is not the handler. So every sand target must be chip-immune BY TYPE, asked of the
 *       authority's own `dex.getImmunity('sandstorm', types)` and printed per cell.
 *   (b) A TYPE IMMUNITY. A 0x cell reads 0 in both skies and can never fail. Effectiveness is read
 *       from the authority's chart and printed; a 0 is refused.
 * Both are derived here, not recalled, and a cell that qualifies for more than one reason is a
 * FAILURE rather than a caveat.
 *
 * RESOLUTION. A x1.5 on a control of 3 is a delta of 1, which one truncation can swallow. Every
 * clear-sky control must read at least 20 or the arm is refused as unable to fail honestly.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('REFUSING TO RUN — SHOWDOWN_PATH is not set. Every category, every overrideDefensiveStat '
    + 'and every effectiveness below is read out of the AUTHORITY, and guessing them is the failure '
    + 'this probe exists to avoid.');
  process.exit(2);
}
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat(require(D('engine', 'champions_sim.js')).FORMAT);

const bare = (sp) => {
  const b = M.buildMon(sp, {});
  if (!b) throw new Error('no MC row for ' + sp);
  b.item = ''; b.ability = 'none';
  return b;
};
const unfaintable = (m) => { m.st = Object.assign({}, m.st, { hp: m.st.hp * 8 }); m.curHP = m.st.hp; };
const rng5 = () => 0.5;
const PASS2 = (a, b) => new Map([[a, { kind: 'pass' }], [b, { kind: 'pass' }]]);

const ATTACKER = 'metagross';   /* derived: Espeon, Metagross and Farigiraf are the only Reg M-B
                                 * bodies whose learnset holds all three Psychic moves at once */

const hit = (moveId, weather, target) => {
  const me = bare(ATTACKER), ally = bare('incineroar'), f1 = bare(target), f2 = bare(target);
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  unfaintable(f1); unfaintable(f2);
  S.field.weather = weather;
  const before = f1.curHP;
  M.battleTurn(S, rng5,
    new Map([[me, M.playerAction(me, moveId, f1, S.field)], [ally, { kind: 'pass' }]]),
    PASS2(f1, f2));
  return before - f1.curHP;
};

/* WHAT THE AUTHORITY SAYS EACH MOVE READS — derived, printed, and then USED to build the
 * expectation, so the table below cannot drift from the dex. */
const MOVES = ['psychicfangs', 'psychic', 'psyshock'].map((id) => {
  const mv = DEX.moves.get(id);
  const phys = mv.category === 'Physical';
  const stat = mv.overrideDefensiveStat || (phys ? 'def' : 'spd');
  return { id, name: mv.name, category: mv.category, stat, nonstandard: mv.isNonstandard };
});

const CELLS = [
  { weather: 'snow', target: 'froslass',   gateType: 'Ice',  gateStat: 'def' },
  { weather: 'sand', target: 'aerodactyl', gateType: 'Rock', gateStat: 'spd' },
  { weather: 'snow', target: 'garchomp',   gateType: 'Ice',  gateStat: 'def' },
  { weather: 'sand', target: 'garchomp',   gateType: 'Rock', gateStat: 'spd' },
];

const failures = [];
console.log('SNOW AND SAND RAISE A STAT, NOT A CATEGORY\n');
console.log('  attacker: ' + ATTACKER + '   reading: the aimed body\'s HP loss over one turn, '
  + 'against THE SAME CELL IN A CLEAR SKY\n');

console.log('  WHAT THE AUTHORITY SAYS EACH MOVE READS (derived from Dex.forFormat this run):');
for (const m of MOVES) {
  console.log('    ' + m.id.padEnd(14) + m.category.padEnd(10) + 'defenseStat = ' + m.stat
    + '   isNonstandard = ' + String(m.nonstandard));
  if (m.nonstandard) failures.push('move ' + m.id + ' is isNonstandard=' + m.nonstandard
    + ' — it is not in this regulation and cannot stage anything');
}
console.log('');

console.log('  ONE REASON PER CELL, derived from the authority:');
for (const c of CELLS) {
  const sp = DEX.species.get(c.target);
  const chipSafe = !DEX.getImmunity('sandstorm', sp.types);
  const e = DEX.getImmunity('Psychic', sp.types) ? Math.pow(2, DEX.getEffectiveness('Psychic', sp.types)) : 0;
  const reasons = [];
  if (c.weather === 'sand' && !chipSafe) reasons.push('the target takes sandstorm chip — an additive '
    + 'constant present in only ONE of the two readings');
  if (e === 0) reasons.push('Psychic is 0x into ' + sp.types.join('/') + ' — the cell reads 0 in both skies');
  console.log('    ' + (c.weather + ' / ' + c.target).padEnd(24) + ('[' + sp.types.join('/') + ']').padEnd(16)
    + ' carries ' + (c.gateType + ':').padEnd(6) + (sp.types.includes(c.gateType) ? 'YES' : 'no ')
    + '   Psychic x' + e
    + (c.weather === 'sand' ? '   sand-chip-immune: ' + (chipSafe ? 'yes' : 'NO') : '')
    + '   extra reasons: ' + (reasons.length ? reasons.join(' + ') : 'NONE'));
  for (const r of reasons) failures.push('cell ' + c.weather + '/' + c.target + ' qualifies for a second reason (' + r + ') — refused');
  c.gated = sp.types.includes(c.gateType);
}
console.log('');

const rows = [];
for (const c of CELLS) {
  for (const m of MOVES) {
    /* THE EXPECTATION IS DERIVED, NEVER TYPED. The handler fires when the target carries the gate
     * type AND the hit reads the gated stat — which is exactly the authority's two conditions. */
    const mustCut = c.gated && m.stat === c.gateStat;
    const clear = hit(m.id, '', c.target);
    const wx = hit(m.id, c.weather, c.target);
    rows.push({ c, m, clear, wx, mustCut });
    const ratio = clear > 0 ? wx / clear : null;
    console.log('  ' + (c.weather + ' / ' + c.target).padEnd(24) + m.id.padEnd(14)
      + '(' + m.category[0] + ', reads ' + m.stat + ')   clear ' + String(clear).padStart(4)
      + '   ' + c.weather + ' ' + String(wx).padStart(4)
      + '   x' + (ratio === null ? '?' : ratio.toFixed(3))
      + '   want ' + (mustCut ? 'LOWER' : 'IDENTICAL'));
    if (!(clear >= 20)) {
      failures.push(c.weather + '/' + c.target + '/' + m.id + ': the clear-sky control dealt ' + clear
        + ', under the 20 a x1.5 needs to be bigger than one truncation — the arm cannot fail honestly');
    } else if (mustCut && !(wx < clear)) {
      failures.push(c.weather + '/' + c.target + '/' + m.id + ': ' + clear + ' -> ' + wx
        + ' — the authority runs Modify' + (m.stat === 'def' ? 'Def' : 'SpD') + ' here and this hit was not reduced');
    } else if (!mustCut && wx !== clear) {
      failures.push(c.weather + '/' + c.target + '/' + m.id + ': ' + clear + ' -> ' + wx
        + ' — reduced where the authority runs no handler at all');
    }
  }
}

/* THE SIZE, NOT JUST THE DIRECTION. x1.5 on the DEFENCE is x(1/1.5) on the damage, folded into the
 * defensive relay and truncated once with it. */
for (const r of rows.filter(x => x.mustCut && x.clear >= 20)) {
  const lo = Math.floor(r.clear / 1.5 * 0.94), hi = Math.ceil(r.clear / 1.5 * 1.06);
  if (r.wx < lo || r.wx > hi) failures.push(r.c.weather + '/' + r.c.target + '/' + r.m.id + ': '
    + r.clear + ' -> ' + r.wx + ' is outside the x1.5-defence band [' + lo + ',' + hi
    + '] — the multiplier is the wrong size');
}

/* THE CONTROL THAT PROVES THE KNOB IS WIRED AT ALL. If NO cell moved, the run says nothing about
 * which stat is gated — it says the weather handler is absent, and every IDENTICAL verdict above
 * would be passing for the wrong reason. */
const moved = rows.filter(r => r.mustCut && r.wx < r.clear).length;
const expectMoved = rows.filter(r => r.mustCut).length;
console.log('\n  cells the handler must cut: ' + expectMoved + '   cells actually cut: ' + moved);
if (moved === 0 && expectMoved > 0) {
  failures.push('NOT ONE gated cell moved — the weather defence handler is not wired at all, so every '
    + 'IDENTICAL verdict above passed for the wrong reason');
}

console.log('\n' + (failures.length ? 'RED — ' + failures.length + ' failure(s):' : 'GREEN — every hit is gated on the stat the authority reads.'));
for (const f of failures) console.log('  ' + f);
process.exit(failures.length ? 1 : 0);
