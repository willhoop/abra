/* probe_volatile_leaves.js — WHAT DOES EACH ENGINE ACTUALLY HOLD, BEFORE ANY LEAF IS WIRED.
 *
 *   SHOWDOWN_PATH=... node tests/probe_volatile_leaves.js
 *
 * `engine/board_state.js` compares eight per-body volatiles. The end-state measurement is only as
 * strong as that set — a leaf the reader does not read cannot make two boards differ, and an
 * unlisted omission reads exactly like "compared and equal". That is how TYPING and ABILITY survived
 * uncompared until ROADMAP #225.
 *
 * SO THIS PRINTS WHAT IT MATCHED BEFORE ANYTHING IS WIRED (CLAUDE.md, ENGINE's standing rule). For
 * each candidate volatile it finds a LEGAL carrier of the move from the format's own learnsets, clicks
 * it under the differential's own driver, and reads the raw state out of BOTH engines. Three outcomes,
 * and only the first is safe to wire:
 *
 *   BOTH      both engines hold something. A leaf can be compared, and a disagreement is a finding.
 *   ONE-SIDED only one engine holds it. Wiring it would part every board carrying that volatile —
 *             which may be a REAL defect, but it is a defect to be probed and named, not smuggled in
 *             as a comparison leaf that fires everywhere at once.
 *   NEITHER   the fixture never produced the volatile. That is a claim about THE FIXTURE and says
 *             nothing about the mechanic (Will has taught this twice).
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));

/* THE CANDIDATES — every per-body volatile a mechanic in this format can leave on a board that
 * board_state.js does not currently read. `target` says who the click is aimed at. */
const CANDIDATES = [
  { vol: 'yawn', move: 'yawn', target: 'foe' },
  { vol: 'aquaring', move: 'aquaring', target: 'self' },
  { vol: 'ingrain', move: 'ingrain', target: 'self' },
  { vol: 'magnetrise', move: 'magnetrise', target: 'self' },
  { vol: 'focusenergy', move: 'focusenergy', target: 'self' },
  { vol: 'torment', move: 'torment', target: 'foe' },
  { vol: 'imprison', move: 'imprison', target: 'self' },
  { vol: 'attract', move: 'attract', target: 'foe' },
  { vol: 'curse', move: 'curse', target: 'self' },
  { vol: 'healblock', move: 'psychicnoise', target: 'foe' },
  { vol: 'destinybond', move: 'destinybond', target: 'self' },
  { vol: 'saltcure', move: 'saltcure', target: 'foe' },
  { vol: 'syrupbomb', move: 'syrupbomb', target: 'foe' },
  { vol: 'twoturnmove/charge', move: 'solarbeam', target: 'foe' },
];

/* A LEGAL CARRIER, DERIVED. Never typed: `.all()` is the National Dex and the regulation is a filter
 * on it (CLAUDE.md). The learnset is asked of the format, so a move a body cannot learn is never
 * staged — a scenario built on an illegal set measures nothing. */
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPECIES = dex.species.all().filter(legal).filter(s => !s.forme || !/mega/i.test(s.forme));
function carrierOf(moveId) {
  for (const s of SPECIES) {
    let ls;
    try { ls = dex.species.getLearnsetData(s.id); } catch (e) { continue; }
    if (ls && ls.learnset && ls.learnset[moveId]) return s;
    /* prevo chains: the learnset of an evolved body can sit on its pre-evolution */
    let p = s.prevo, guard = 0;
    while (p && guard++ < 3) {
      const pid = N.id(p);
      let pl; try { pl = dex.species.getLearnsetData(pid); } catch (e) { pl = null; }
      if (pl && pl.learnset && pl.learnset[moveId]) return s;
      const ps = dex.species.get(pid); p = ps && ps.prevo;
    }
  }
  return null;
}

const FILLER = ['clefable', 'milotic', 'corviknight'];
const bench = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

console.log('\n  WHAT EACH ENGINE HOLDS FOR A VOLATILE board_state.js DOES NOT COMPARE');
console.log('  (printed before anything is wired — an over-matching leaf parts every board at once)\n');
console.log('  ' + 'volatile'.padEnd(20) + 'carrier'.padEnd(16) + 'medicham2 holds'.padEnd(34) + 'showdown holds');

const rows = [];
for (const c of CANDIDATES) {
  const mv = dex.moves.get(c.move);
  if (!mv || !mv.exists || mv.isNonstandard) { rows.push({ ...c, verdict: 'MOVE NOT IN FORMAT' }); continue; }
  const sp = carrierOf(c.move);
  if (!sp) { rows.push({ ...c, verdict: 'NO LEGAL CARRIER — the fixture, not the mechanic' }); continue; }
  const A = [{ species: N.id(sp.id), item: '', ability: '', moves: [mv.name, 'Protect'] }].concat(bench(...FILLER));
  const B = [{ species: 'snorlax', item: '', ability: '', moves: ['Agility', 'Protect'] }].concat(bench(...FILLER));
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) { rows.push({ ...c, carrier: sp.name, verdict: 'COULD NOT BUILD THE PAIR' }); continue; }
  let medi = '', sd = '';
  const script = [{ p1: [{ m: c.move, t: c.target === 'foe' ? 0 : undefined }, { m: 'protect' }],
                    p2: [{ m: 'agility' }, { m: 'protect' }] },
                  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'agility' }, { m: 'protect' }] }];
  const r = G.playGame(a, b, 'directed', 'volprobe/' + c.vol, { script,
    onBoundary: (snap, turnIdx, S, battle) => {
      if (turnIdx < 1) return;
      const bodies = [...(S.actA || []), ...(S.actB || [])].filter(Boolean);
      const keys = new Set();
      for (const m of bodies) {
        for (const k of Object.keys(m._vol || {})) if (m._vol[k]) keys.add(k + '=' + JSON.stringify(m._vol[k]));
        for (const k of ['_yawn', '_charging', '_invuln', '_seededBy', '_sub', '_perish'])
          if (m[k]) keys.add(k + '=' + JSON.stringify(m[k]).slice(0, 12));
      }
      const sk = new Set();
      for (const side of battle.sides) for (const p of side.active) {
        if (!p) continue;
        for (const [k, v] of Object.entries(p.volatiles || {}))
          sk.add(k + (v && v.duration != null ? '(d' + v.duration + ')' : ''));
      }
      medi = [...keys].join(' '); sd = [...sk].join(' ');
    } });
  const wantMedi = new RegExp(c.vol.split('/')[0].replace(/[^a-z0-9]/g, ''), 'i');
  const inMedi = wantMedi.test(medi.replace(/[^a-zA-Z0-9=]/g, '')) || (c.vol === 'twoturnmove/charge' && /_charging/.test(medi));
  const inSd = wantMedi.test(sd) || (c.vol === 'twoturnmove/charge' && /twoturnmove/.test(sd));
  rows.push({ ...c, carrier: sp.name, medi, sd, err: r.err,
              verdict: inMedi && inSd ? 'BOTH' : inMedi ? 'MEDICHAM ONLY' : inSd ? 'SHOWDOWN ONLY' : 'NEITHER — the fixture never produced it' });
  console.log('  ' + c.vol.padEnd(20) + String(sp.name).slice(0, 15).padEnd(16)
    + (inMedi ? 'yes' : 'no ').padEnd(4) + medi.slice(0, 29).padEnd(30)
    + (inSd ? 'yes' : 'no ') + ' ' + sd.slice(0, 40));
}

console.log('\n  VERDICTS');
for (const r of rows) console.log('    ' + r.vol.padEnd(20) + r.verdict + (r.err ? '   [game threw: ' + r.err + ']' : ''));
console.log('\n  ONLY `BOTH` ROWS ARE SAFE TO WIRE AS A COMPARED LEAF. A `NEITHER` is a claim about this');
console.log('  fixture and never about the mechanic; a one-sided row is a defect to probe and name.\n');
