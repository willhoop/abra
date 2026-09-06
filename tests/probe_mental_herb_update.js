/* probe_mental_herb_update.js — MENTAL HERB IS AN `onUpdate` ITEM, AND IT HAD ONLY EVER BEEN REACHED
 * FROM THE MOVE THAT WROTE THE VOLATILE. 2026-09-06.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mental_herb_update.js
 *   PROBE_RELEASE=<id> ...   opens a FROZEN release instead of the live tree (the red-first arm)
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `data/game-differential.json` on release `83874ed37e9e` reads 19 board-material games of 961. One
 * of them is:
 *
 *     omit-weather  t14  ...bo3-2661171085 vs ...bo3-2661204750
 *       p2.party.farigiraf.item   medi `mentalherb`  sd `""`
 *       p2.active[1].item         medi `mentalherb`  sd `""`
 *       p2.active[1].vol.disable  medi 3            sd 0
 *
 * The authority's turn 14:
 *     |-start|p2b: Farigiraf|Disable|Thunderbolt|[from] ability: Cursed Body|[of] p1a: Gengar
 *     |-enditem|p2b: Farigiraf|Mental Herb
 *     |-end|p2b: Farigiraf|Disable
 * and this engine wrote only the first of the three.
 *
 * ================= THE MECHANISM ================================================================
 *
 * `mentalHerbCures` is called from `applyMoveVolatile` and from `applyHealBlock` AND FROM NOWHERE
 * ELSE, so any road that writes one of the six volatiles straight into `_vol` never woke the item.
 * WIRE 52 — Cursed Body — is exactly such a road: `(m._vol=m._vol||{}).disable = ...`. That is the
 * shape CLAUDE.md's FACTS-ARE-GLOBAL rule names: state written past the one function that owns the
 * reaction to it.
 *
 * The engine's own counters said which half was missing before anything was edited, on the accusing
 * game: `volDurationApplied +1` — the Disable landed — and `herbSpentBeforeEnd +0`.
 *
 * ================= THE AUTHORITY, RE-DERIVED ON EVERY RUN =======================================
 *
 * `mentalherb.onUpdate` (data/items.ts, no Champions override — checked by key below):
 *     const conditions = ['attract','taunt','encore','torment','disable','healblock'];
 *     for (const c of conditions) if (pokemon.volatiles[c]) { if (!pokemon.useItem()) return;
 *                                   for (const c2 of conditions) pokemon.removeVolatile(c2); break; }
 * It is a handler on the `Update` EVENT, which is why the fix sits in `_updateEvent` beside the
 * berries — which are `onUpdate` items too — and not at the Cursed Body site.
 *
 * `cursedbody.onDamagingHit` calls `source.addVolatile('disable', ...)` and writes no line of its
 * own; the `|-start|` is `disable`'s condition.
 *
 * ================= WHAT IS ASSERTED =============================================================
 *
 *   1  AUTHORITY  the herb's six conditions are re-derived off the live format and PRINTED, and
 *                 Champions' non-override of both entities is checked BY KEY.
 *   2  MEMBERSHIP the engine's `curesVolatile.cures` set equals the handler's list.
 *   3  FIXTURE    the accusing game is found in the PINNED pool and both pairs build.
 *   4  TEST       no board leaf parts at any boundary.
 *   5  COUNTERS   `herbCuredAtUpdate` moved, and it is a SUBSET of `herbSpentBeforeEnd`.
 *   6  CONTROL    `volDurationApplied` moved in the same replay — an engine that had stopped applying
 *                 Cursed Body's Disable at all would pass arm 4 and be a worse defect.
 *   7  RED        re-run under `MEDI_MENTAL_HERB_MOVE_ONLY=1`; the child MUST fail.
 *   8  SILENT     re-run under `MEDI_WEATHER_FORME_SURVIVES_FAINT=1` — an unrelated knob — and the
 *                 child MUST pass.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('MENTAL HERB ON THE UPDATE EVENT');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', 'data/team-pool-frozen');
if (process.env.PROBE_RELEASE) process.argv.push('--release', process.env.PROBE_RELEASE);

const G = require(D('engine', 'game_differential.js'));
const MEDI = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));

const CHILD = process.env.MEDI_MENTAL_HERB_MOVE_ONLY === '1'
           || process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1';
const C0 = { upd: MEDI.MEDSEEN.herbCuredAtUpdate | 0,
             spent: MEDI.MEDSEEN.herbSpentBeforeEnd | 0,
             dur: MEDI.MEDSEEN.volDurationApplied | 0 };
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== MENTAL HERB ON THE UPDATE EVENT =='
  + (process.env.MEDI_MENTAL_HERB_MOVE_ONLY === '1' ? '   [MEDI_MENTAL_HERB_MOVE_ONLY=1]' : '')
  + (process.env.MEDI_WEATHER_FORME_SURVIVES_FAINT === '1' ? '   [MEDI_WEATHER_FORME_SURVIVES_FAINT=1 — SILENT CONTROL]' : '')
  + (process.env.PROBE_RELEASE ? '   [release ' + process.env.PROBE_RELEASE + ']' : '') + '\n');

/* ---- 1..2. THE AUTHORITY AND THE MEMBERSHIP --------------------------------------------------- */
{
  const it = dex.items.get('mentalherb');
  const src = String(it.onUpdate || '');
  const list = [...src.matchAll(/["']([a-z]+)["']/g)].map(m => m[1]);
  const uniq = [...new Set(list)].sort();
  console.log('  mentalherb.onUpdate, READ off ' + CS.FORMAT + ':');
  console.log('    ' + src.replace(/\s+/g, ' ').slice(0, 260));
  console.log('    the conditions it names: ' + JSON.stringify(uniq));
  ok(uniq.length >= 5, 'the herb names a non-empty condition list', uniq.length + ' name(s)');

  const p = (TAGS.items && TAGS.items.mentalherb && TAGS.items.mentalherb.params
             && TAGS.items.mentalherb.params.curesVolatile) || null;
  const ours = p && Array.isArray(p.cures) ? [...p.cures].sort() : null;
  console.log('    data/tags.json curesVolatile.cures: ' + JSON.stringify(ours));
  ok(!!ours && JSON.stringify(ours) === JSON.stringify(uniq),
     'the tag the engine reads carries EXACTLY the handler\'s list',
     'format ' + JSON.stringify(uniq) + ' vs tag ' + JSON.stringify(ours));

  const cb = dex.abilities.get('cursedbody');
  ok(/addVolatile\(\s*["']disable["']/.test(String(cb.onDamagingHit || '')),
     'Cursed Body adds the `disable` volatile and writes no line of its own',
     String(cb.onDamagingHit || '').replace(/\s+/g, ' ').slice(0, 200));

  const fs = require('fs');
  const modItems = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'items.ts'), 'utf8');
  const modAb = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
  ok(!/^\s*mentalherb\s*:/m.test(modItems), 'Champions does not override `mentalherb`');
  ok(!/^\s*cursedbody\s*:/m.test(modAb), 'Champions does not override `cursedbody`');
}

/* ---- 3..6. THE ACCUSING GAME ------------------------------------------------------------------ */
const W = { cfg: 'omit-weather', turn: 14,
  tag: 'gen9championsvgc2026regmbbo3-2661171085 vs gen9championsvgc2026regmbbo3-2661204750' };

const t0 = Date.now();
const SW = SWARM.buildSwarm(PIN_GAMES * 2, { storeDir: D('data', 'team-pool-frozen') });
console.log('\n  pool built in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — '
  + SW.out.reduce((a, c) => a + c.picked, 0) + ' teams picked from ' + SW.teams.length);

{
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) {
    ok(false, 'FIXTURE — the pair is in the PINNED pool', 'a=' + !!ta + ' b=' + !!tb);
  } else {
    const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
    ok(!!a && !!b, 'FIXTURE — both sides build', a && b ? 'built' : 'buildPair refused');
    if (a && b) {
      let SDLOG = null; const marks = [];
      const r = G.playGame(a, b, W.cfg, W.tag, {
        driverSeed: W.cfg + '|' + W.tag,
        onBoundary: (snap, t, S, battle) => { SDLOG = battle.log; marks.push({ t, len: battle.log.length }); },
      });
      console.log('\n  ---- ' + W.cfg + '  ' + W.tag);
      console.log('       artifact says: board parts at t' + W.turn + ' on item + vol.disable');
      console.log('       replay: turns=' + r.turns + ' protocol_div=' + (r.div ? r.div.index : null)
        + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null) + ' void=' + !!r.void + ' err=' + (r.err || '-'));
      if (r.stateDiv) console.log('       board diffs: ' + JSON.stringify(r.stateDiv.diffs));

      const bt = (r.stateDiv && r.stateDiv.turn) || W.turn;
      const mi = marks.findIndex(m => m.t === bt);
      const from = mi > 0 ? marks[mi - 1].len : 0, to = mi >= 0 ? marks[mi].len : (SDLOG || []).length;
      console.log('       AUTHORITY t' + bt + ': ' + JSON.stringify((SDLOG || []).slice(from, to)));
      const mt = r.mediTrace || [];
      let s0 = -1, e0 = mt.length;
      for (let i = 0; i < mt.length; i++) {
        if (mt[i] === '|turn|' + bt) s0 = i; else if (mt[i] === '|turn|' + (bt + 1)) { e0 = i; break; }
      }
      console.log('       MEDICHAM2 t' + bt + ': ' + JSON.stringify(mt.slice(Math.max(0, s0), e0)));

      ok(!r.stateDiv, 'TEST — no board leaf parts at any boundary',
         r.stateDiv ? 'parted at t' + r.stateDiv.turn + ': '
                      + r.stateDiv.diffs.map(d => d.path + ' medi ' + JSON.stringify(d.medicham)
                                                + ' / sd ' + JSON.stringify(d.showdown)).join('; ')
                    : 'boards identical at all ' + marks.length + ' boundaries');
    }
  }
}

/* ---- THE COUNTERS ----------------------------------------------------------------------------- */
{
  const M = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  const upd = (M.herbCuredAtUpdate | 0) - C0.upd;
  const spent = (M.herbSpentBeforeEnd | 0) - C0.spent;
  const dur = (M.volDurationApplied | 0) - C0.dur;
  console.log('\n  COUNTERS across the replay: herbCuredAtUpdate +' + upd
    + '  herbSpentBeforeEnd +' + spent + '  volDurationApplied +' + dur
    + '   mentalHerbMoveOnlyRestored=' + (F.mentalHerbMoveOnlyRestored | 0));
  ok(dur > 0, 'CONTROL — the Cursed Body Disable still LANDS in this replay',
     'volDurationApplied moved by ' + dur + '. A zero here with the board arm green is an engine that '
     + 'stopped applying the volatile at all, which passes that arm and is a worse defect');
  ok(upd > 0 || process.env.MEDI_MENTAL_HERB_MOVE_ONLY === '1', 'the UPDATE road is reached',
     'herbCuredAtUpdate moved by ' + upd + ' — a zero means the sweep is present and dead');
  ok(upd <= spent, 'the update road is a SUBSET of the herb\'s own line-writing counter',
     'herbCuredAtUpdate ' + upd + ' <= herbSpentBeforeEnd ' + spent
     + '. A rise here with a flat `herbSpentBeforeEnd` would mean the two count different events and '
     + 'the item is being spent without its lines');
  if (process.env.MEDI_MENTAL_HERB_MOVE_ONLY === '1') {
    ok((F.mentalHerbMoveOnlyRestored | 0) === 1, 'the restore knob is LIVE in the child');
  } else {
    ok((F.mentalHerbMoveOnlyRestored | 0) === 0, 'the restore knob is OFF in this process');
  }
}

/* ---- THE RED, AND THE SILENT CONTROL ---------------------------------------------------------- */
if (!CHILD) {
  const { spawnSync } = require('child_process');
  const run = (env) => spawnSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env), encoding: 'utf8' });

  console.log('\n  ---- RE-RUNNING UNDER MEDI_MENTAL_HERB_MOVE_ONLY=1 (the child must FAIL)');
  const red = run({ MEDI_MENTAL_HERB_MOVE_ONLY: '1' });
  const redLines = String(red.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(red.status !== 0, 'the restore knob makes this probe RED',
     red.status !== 0 ? 'child exit ' + red.status + ', ' + redLines.length + ' FAIL line(s):\n          '
                        + redLines.join('\n          ')
                      : 'THE CHILD PASSED — this probe cannot tell the move road from the update road');

  console.log('\n  ---- RE-RUNNING UNDER MEDI_WEATHER_FORME_SURVIVES_FAINT=1 (the SILENT control must PASS)');
  const quiet = run({ MEDI_WEATHER_FORME_SURVIVES_FAINT: '1' });
  const quietLines = String(quiet.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(quiet.status === 0, 'SILENT CONTROL — an unrelated knob does not move this probe',
     quiet.status === 0 ? 'child exit 0 — the fixes are independent'
                        : 'child exit ' + quiet.status + ', ' + quietLines.length + ' FAIL line(s):\n          '
                          + quietLines.join('\n          '));
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
