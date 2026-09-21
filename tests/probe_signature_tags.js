#!/usr/bin/env node
/* tests/probe_signature_tags.js — ROADMAP #127: THE FIVE SPLIT SIGNATURES ARE DECIDED BY THE TAG, AND THIS
 * SHOWS IT BY TAKING THE TAG AWAY.
 *   node tests/probe_signature_tags.js                              -> must be green
 *   PROBE_STRIP=protect:shieldsUser node tests/probe_signature_tags.js   -> must be red on its arms
 * ==================================================================================================
 *
 * #127 found five tag signatures whose members the engine treated differently, and said a split can only
 * mean a NAME match or a tag missing the param that separates them. Re-measured 2026-09-18 on the live
 * engine, every one of the five is now separated by a tag or a param:
 *
 *   A  protect/detect/... -> protect   endure -> affect        `shieldsUser` vs `survivesAnyHit`
 *   B  wideguard / quickguard -> wideguard                      `oneTurnGuard` (mv carries which)
 *   C  roost/recover/... -> heal       wish/rest -> healdesc    `healDescriptor`
 *   D  beatup/hex/storedpower/spitup -> attack                  `variablePower.kind` (+ `spendsVolatile`)
 *   E  bellydrum/tidyup -> statcode    acupressure -> affect    `statChangeInCode.boosts` vs `.op`
 *
 * A signature that is "separated by a tag" is only proved to be separated BY THE TAG if taking the tag
 * away changes the answer. Otherwise the tag is decoration and something else -- a name -- is deciding,
 * which is exactly what `ACCMOD` turned out to be. So every arm below states the behaviour, and each has
 * a PROBE_STRIP target that must turn it red. Group A also had name reads left (`PROTECTMOVES` in the
 * pasted-set filter, in the chooser's `canProtect`, and as a dispatch fallback); those now read the tag,
 * and MEDI_SHIELD_BY_NAME=1 restores them -- so the strip goes red and strip + knob goes green again.
 *
 * Every move named here is legal in this format and every body is built by the engine; nothing is typed.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require('../engine/regulation.js');   /* before the table: the selected regulation resolves which table loads */
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('engine', 'tags.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

/* ---- THE STRIP SWITCH: remove one tag from one move, on this engine, in this process ---------------- */
{
  const strip = process.env.PROBE_STRIP;
  if (strip) {
    const [mv, tag] = strip.split(':');
    const db = JSON.parse(JSON.stringify(require(D('data', 'tags.json'))));
    const rec = db.moves[mv];
    if (!rec || !rec.tags.includes(tag)) { console.log('PROBE_STRIP=' + strip + ' names nothing strippable'); process.exit(2); }
    rec.tags = rec.tags.filter(t => t !== tag); if (rec.params) delete rec.params[tag];
    TAGS.__setDB(db);
    console.log('\n  PROBE_STRIP: move ' + mv + ' has lost `' + tag + '` -- the arms that rest on it MUST go red\n');
  }
}

const bare = sp => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row for ' + sp); b.item = ''; b.ability = 'none'; return b; };
const FIELD = () => ({ weather: '', terrain: '', twA: 0, twB: 0, tr: 0, sgA: {}, sgB: {} });
const me = bare('medicham'), tgt = bare('garchomp');
const kindOf = (id, t) => { const a = M.playerAction(me, id, t === undefined ? tgt : t, FIELD()); return a || {}; };

console.log('\n  ROADMAP #127 — each split signature, and the tag that decides it\n');

/* ---- A: shields --------------------------------------------------------------------------------- */
{
  const p = kindOf('protect'), e = kindOf('endure');
  ok(p.kind === 'protect' && e.kind !== 'protect',
     'A1 dispatch — Protect resolves as a shield and Endure does not',
     'protect -> ' + p.kind + ', endure -> ' + e.kind);
  /* NO ARM FOR THE PASTED-SET FILTER, AND THAT IS MEASURED. `buildMonFromSet`'s usable-move filter now asks
   * `isShieldMove` instead of `PROTECTMOVES`, but the same filter also admits anything `moveFx` knows, and
   * `moveFx` answers truthy for all five legal shields -- so Protect survives the filter with or without
   * `shieldsUser`, and an arm here would be green on an engine that never asked. It was written first and
   * stayed green under the strip; it was removed rather than kept as coverage it does not give. */
  /* A3 -- the engine's own chooser: a threatened body holding Protect, driven by battleTurn with no action
   * maps. The `canProtect` branch rolls `rng() < 0.5` on every threatened turn, so it alone should shield
   * about half the staged turns; the chooser's separate priors road adds a few more. Measured 2026-09-18:
   * 117 of 200 with the tag, 21 of 200 with `shieldsUser` stripped (the priors road only). The bar is 80
   * (40%), grounded in the 0.5 roll, well clear of both. */
  let shielded = 0;
  for (let g = 0; g < 200; g++) {
    const a = bare('garchomp'), b = bare('incineroar'), f1 = bare('kingambit'), f2 = bare('incineroar');
    a.moves = ['protect', 'dragonclaw'];
    const S = M.battleInit([a, b], [f1, f2], { seeded: true });
    a.curHP = Math.max(1, Math.floor(a.st.hp * 0.3));
    let s = (g * 2654435761) >>> 0;
    const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    M.battleTurn(S, rng);
    if (a.protect) shielded++;
  }
  ok(shielded >= 80, 'A3 chooser — a threatened body holding Protect raises it on at least 40% of turns (canProtect)',
     shielded + ' of 200 staged turns ended shielded');
}

/* ---- B: side guards ------------------------------------------------------------------------------ */
{
  const w = kindOf('wideguard'), q = kindOf('quickguard');
  ok(w.kind === 'wideguard' && q.kind === 'wideguard' && q.mv === 'quickguard',
     'B dispatch — Wide Guard and Quick Guard both resolve as a side guard, and the guard raised is named',
     'wideguard -> ' + w.kind + '/' + w.mv + ', quickguard -> ' + q.kind + '/' + q.mv);
}

/* ---- C: heals ----------------------------------------------------------------------------------- */
{
  const r = kindOf('recover'), w = kindOf('wish'), s = kindOf('rest');
  ok(r.kind === 'heal' && w.kind === 'healdesc' && s.kind === 'healdesc',
     'C dispatch — Recover heals now; Wish (delayed) and Rest (also sleeps) take the descriptor road',
     'recover -> ' + r.kind + ', wish -> ' + w.kind + ', rest -> ' + s.kind);
}

/* ---- D: variable power -------------------------------------------------------------------------- */
{
  const bu = kindOf('beatup');
  ok(bu.kind === 'attack', 'D1 dispatch — Beat Up (dex base power 0; the power IS the calculation) is an attack',
     'beatup -> ' + bu.kind);
  const healthy = bare('garchomp'), burned = bare('garchomp'); burned.status = 'brn';
  const h1 = kindOf('hex', healthy), h2 = kindOf('hex', burned);
  const m1 = h1.move && h1.move.d ? h1.move.d.max : null, m2 = h2.move && h2.move.d ? h2.move.d.max : null;
  ok(m1 > 0 && m2 >= 1.9 * m1,
     'D2 damage — Hex into a statused target is priced at double base power (`variablePower.kind: targetStatused`)',
     'max damage healthy ' + m1 + ', burned ' + m2);
}

/* ---- E: procedural stat changes ------------------------------------------------------------------ */
{
  const b = kindOf('bellydrum'), a = kindOf('acupressure');
  ok(b.kind === 'statcode' && a.kind !== 'statcode',
     'E dispatch — Belly Drum takes the self-boost road; Acupressure (a random stat, `op`) does not',
     'bellydrum -> ' + b.kind + ', acupressure -> ' + a.kind);
}

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
