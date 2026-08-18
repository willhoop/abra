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
  /* CURSE IS TYPE-CONDITIONAL AND THE FIRST CARRIER FOUND WAS NOT A GHOST. `data/moves.ts` curse
   * `onModifyMove` gives the Ghost branch (the volatile + the half-HP cost) only to a user that HAS
   * the Ghost type; every other user gets three stat stages and no volatile at all. So a probe that
   * takes the first legal carrier in dex order measures the stat branch and then reports the volatile
   * "never produced", which is a claim about the CARRIER and reads as a claim about the engines. */
  { vol: 'curse', move: 'curse', target: 'self', userType: 'Ghost' },
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
function carrierOf(moveId, wantType) {
  for (const s of SPECIES) {
    if (wantType && !(s.types || []).includes(wantType)) continue;
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
  const sp = carrierOf(c.move, c.userType);
  if (!sp) { rows.push({ ...c, verdict: 'NO LEGAL CARRIER — the fixture, not the mechanic' }); continue; }
  const A = [{ species: N.id(sp.id), item: '', ability: '', moves: [mv.name, 'Protect'] }].concat(bench(...FILLER));
  /* THE FOE CLICKS RECYCLE, NOT AGILITY — 2026-08-14. Snorlax cannot learn Agility in this
   * regulation (TeamValidator: "Snorlax can't learn Agility."), so this probe declared a body the
   * game would refuse. RECYCLE is this repo's derived no-op (champions_sim.INERT_MOVE, with the
   * reasoning at its definition): Snorlax can learn it, it is in MC.moves, and it FAILS outright when
   * the user has consumed no item — so it cannot damage, boost, heal, switch or touch the field.
   * It is strictly quieter than Agility, which was moving the foe's Speed by two stages every turn. */
  const B = [{ species: 'snorlax', item: '', ability: '', moves: ['Recycle', 'Protect'] }].concat(bench(...FILLER));
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) { rows.push({ ...c, carrier: sp.name, verdict: 'COULD NOT BUILD THE PAIR' }); continue; }
  let medi = '', sd = '';
  const seenMedi = [], seenSd = [];
  const script = [{ p1: [{ m: c.move, t: c.target === 'foe' ? 0 : undefined }, { m: 'protect' }],
                    p2: [{ m: 'recycle' }, { m: 'protect' }] },
                  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'recycle' }, { m: 'protect' }] }];
  /* ---- EVERY BOUNDARY, NOT THE LAST ONE — 2026-08-18 -------------------------------------------
   * This read `if (turnIdx < 1) return`, i.e. the board AFTER the second turn, and then reported
   * `NEITHER — the fixture never produced it` for yawn, attract and heal block. THAT VERDICT WAS THE
   * PROBE'S, NOT THE ENGINES'. Yawn's condition is `duration: 2` (data/moves.ts:21142): applied on
   * turn 1, it ENDS at the residual of turn 2 and puts the target to sleep, so by the only boundary
   * this probe looked at, the volatile is correctly gone in BOTH engines. A probe that samples one
   * boundary is asserting that the mechanic is still there when it looks.
   *
   * So both engines are now read at EVERY boundary and a leaf is credited if either engine held it at
   * ANY of them, with the boundary recorded. That can only ADD rows; it cannot turn a real BOTH into
   * a NEITHER. */
  const r = G.playGame(a, b, 'directed', 'volprobe/' + c.vol, { script,
    onBoundary: (snap, turnIdx, S, battle) => {
      const bodies = [...(S.actA || []), ...(S.actB || [])].filter(Boolean);
      const keys = new Set();
      for (const m of bodies) {
        for (const k of Object.keys(m._vol || {})) if (m._vol[k]) keys.add(k + '=' + JSON.stringify(m._vol[k]));
        /* `_healBlock` ADDED 2026-08-18, AND ITS ABSENCE WAS THIS PROBE REPORTING A DEFECT THAT DOES
         * NOT EXIST. The row read `healblock  SHOWDOWN ONLY`, which reads as "our engine drops Psychic
         * Noise's lock". It does not: `applyMoveVolatile` explicitly refuses the generic `_vol` write
         * for this one (`if (vol === 'healblock') return applyHealBlock(who, mvId)`) because the field
         * every consumer asks about is `_healBlock`. The probe was looking in the one place the engine
         * deliberately does not write. A leaf list that is not derived from the engine will do this. */
        for (const k of ['_yawn', '_charging', '_invuln', '_seededBy', '_sub', '_perish', '_healBlock'])
          if (m[k]) keys.add(k + '=' + JSON.stringify(m[k]).slice(0, 12));
      }
      const sk = new Set();
      for (const side of battle.sides) for (const p of side.active) {
        if (!p) continue;
        for (const [k, v] of Object.entries(p.volatiles || {}))
          sk.add(k + (v && v.duration != null ? '(d' + v.duration + ')' : ''));
      }
      /* KEPT PER BOUNDARY AND UNIONED, so a volatile that expires before the last board is still
       * seen. The boundary index is carried so a reader can tell "held on turn 1 only" from "held
       * throughout" — two different facts about the same leaf. */
      const mline = [...keys].join(' '), sline = [...sk].join(' ');
      seenMedi.push('b' + turnIdx + ': ' + (mline || '-'));
      seenSd.push('b' + turnIdx + ': ' + (sline || '-'));
      medi = [medi, mline].filter(Boolean).join(' ');
      sd = [sd, sline].filter(Boolean).join(' ');
    } });
  const wantMedi = new RegExp(c.vol.split('/')[0].replace(/[^a-z0-9]/g, ''), 'i');
  /* the engine's name for the fact, where it is not the authority's name for it */
  const MEDI_FIELD = { healblock: /_healBlock/ };
  const inMedi = wantMedi.test(medi.replace(/[^a-zA-Z0-9=]/g, '')) || (c.vol === 'twoturnmove/charge' && /_charging/.test(medi))
    || (MEDI_FIELD[c.vol] ? MEDI_FIELD[c.vol].test(medi) : false);
  const inSd = wantMedi.test(sd) || (c.vol === 'twoturnmove/charge' && /twoturnmove/.test(sd));
  rows.push({ ...c, carrier: sp.name, medi, sd, err: r.err, seenMedi, seenSd,
              verdict: inMedi && inSd ? 'BOTH' : inMedi ? 'MEDICHAM ONLY' : inSd ? 'SHOWDOWN ONLY' : 'NEITHER — the fixture never produced it' });
  console.log('  ' + c.vol.padEnd(20) + String(sp.name).slice(0, 15).padEnd(16)
    + (inMedi ? 'yes' : 'no ').padEnd(4) + medi.slice(0, 29).padEnd(30)
    + (inSd ? 'yes' : 'no ') + ' ' + sd.slice(0, 40));
}

console.log('\n  VERDICTS');
for (const r of rows) console.log('    ' + r.vol.padEnd(20) + r.verdict + (r.err ? '   [game threw: ' + r.err + ']' : ''));
console.log('\n  ONLY `BOTH` ROWS ARE SAFE TO WIRE AS A COMPARED LEAF. A `NEITHER` is a claim about this');
console.log('  fixture and never about the mechanic; a one-sided row is a defect to probe and name.\n');
