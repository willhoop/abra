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
  /* ATTRACT NEEDS OPPOSITE SEXES AND THIS FIXTURE HAD NONE — 2026-09-12. The row came back
   * `NEITHER`, and `board_state.js` reads that correctly as a claim about the FIXTURE: "Attract needs
   * opposite genders that the staged pair did not have". `buildPair` wrote `gender: 'N'` on every body
   * and the condition's own `onStart` refuses two genderless bodies outright. The driver grew a
   * `declaredGender` seam on 2026-09-11, so the pair can now be declared — which is the `next` step
   * that NOT_COMPARED row names. The volatile lands on the TARGET, so the target takes 'F' against a
   * male user; `genderFree` keeps the derived carrier to a species this format leaves free to be
   * either, because Showdown would honour a declared gender even on a fixed one. */
  { vol: 'attract', move: 'attract', target: 'foe', genderFree: true, userGender: 'M', foeGender: 'F' },
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
  /* ROADMAP #308 -- THE THREE PER-BODY LEAVES THE `all_mechanics_fire` RUN NAMED, staged here first
   * for the reason this whole file exists: a leaf wired without printing what BOTH engines hold is a
   * leaf that parts every board at once.
   *   uproar    the three-turn lock and the sleep prevention ARE the move; the row came back
   *             ANNOUNCEMENT-ONLY because nothing read it
   *   trapped   Spirit Shackle's whole point, and a different volatile from `partiallytrapped`
   *             (which IS compared) -- this one has no chip and no clock
   *   charge    Electromorphosis banks it, and the move CHARGE applies the identical volatile; the
   *             move is staged because this probe clicks moves, and the leaf is the same one */
  { vol: 'uproar', move: 'uproar', target: 'foe' },
  { vol: 'trapped', move: 'spiritshackle', target: 'foe' },
  { vol: 'charge', move: 'charge', target: 'self' },
];

/* A LEGAL CARRIER, DERIVED. Never typed: `.all()` is the National Dex and the regulation is a filter
 * on it (CLAUDE.md). The learnset is asked of the format, so a move a body cannot learn is never
 * staged — a scenario built on an illegal set measures nothing. */
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPECIES = dex.species.all().filter(legal).filter(s => !s.forme || !/mega/i.test(s.forme));
function carrierOf(moveId, wantType, genderFree) {
  for (const s of SPECIES) {
    if (wantType && !(s.types || []).includes(wantType)) continue;
    /* `species.gender` is '' when the format leaves a body free to be either sex, and 'M'/'F'/'N'
     * when it fixes one. A declared gender on a fixed body WOULD be honoured by Showdown (its
     * constructor prefers `set.gender`), so staging one would assert a Pokemon the regulation does
     * not have — the filter is here rather than in the caller for that reason. */
    if (genderFree && s.gender !== '') continue;
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
  const sp = carrierOf(c.move, c.userType, c.genderFree);
  if (!sp) { rows.push({ ...c, verdict: 'NO LEGAL CARRIER — the fixture, not the mechanic' }); continue; }
  const A = [{ species: N.id(sp.id), item: '', ability: '', moves: [mv.name, 'Protect'],
               ...(c.userGender ? { gender: c.userGender } : {}) }].concat(bench(...FILLER));
  /* THE FOE CLICKS RECYCLE, NOT AGILITY — 2026-08-14. Snorlax cannot learn Agility in this
   * regulation (TeamValidator: "Snorlax can't learn Agility."), so this probe declared a body the
   * game would refuse. RECYCLE is this repo's derived no-op (champions_sim.INERT_MOVE, with the
   * reasoning at its definition): Snorlax can learn it, it is in MC.moves, and it FAILS outright when
   * the user has consumed no item — so it cannot damage, boost, heal, switch or touch the field.
   * It is strictly quieter than Agility, which was moving the foe's Speed by two stages every turn. */
  const FOE = 'snorlax';
  const foeSp = dex.species.get(FOE);
  /* THE FOE'S FREEDOM IS ASKED OF THE FORMAT, NOT ASSUMED, and a refusal is reported as the fixture's
   * rather than silently dropped — a row that needs a gender and cannot have one must not read as a
   * claim about the engines. */
  if (c.foeGender && foeSp.gender !== '') {
    rows.push({ ...c, carrier: sp.name,
      verdict: 'THE FOE HAS A FIXED GENDER (' + foeSp.name + ' reads ' + JSON.stringify(foeSp.gender)
             + ') — the fixture, not the mechanic' });
    continue;
  }
  const B = [{ species: FOE, item: '', ability: '', moves: ['Recycle', 'Protect'],
               ...(c.foeGender ? { gender: c.foeGender } : {}) }].concat(bench(...FILLER));
  /* THE SEAM IS OPENED ONLY FOR A ROW THAT DECLARES A GENDER, so every other candidate here builds
   * the byte-identical pair it built before this existed. */
  const gOpts = (c.userGender || c.foeGender) ? { declaredGender: true } : undefined;
  const a = G.buildPair(A, gOpts), b = G.buildPair(B, gOpts);
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
        /* `_mtLock` AND `_ptDmg` ADDED 2026-09-12, AND THEIR ABSENCE WAS THIS PROBE REPORTING TWO
         * DEFECTS THAT DO NOT EXIST — the identical trap `_healBlock` is in this list for. The rows
         * read `uproar SHOWDOWN ONLY` and `curse SHOWDOWN ONLY`, which reads as "our engine drops
         * the Uproar lock" and "our engine writes no Curse". Neither is true: medicham2 holds the
         * uproar lock in `_mtLock` (`{move,left,dur,vol}`), which `board_state.js` ALREADY compares
         * as a clock, and Curse's Ghost-branch chip in `_ptDmg` (ROADMAP #175 — it is a Condition
         * here, not a `_vol` entry). The probe was looking in the one place each engine deliberately
         * does not write. A leaf list that is not derived from the engine will keep doing this.
         *
         * THE SLICE IS 40 AND NOT 12 BECAUSE THE DISCRIMINATOR IS INSIDE THE VALUE: `_mtLock` is the
         * rampage lock shared with Outrage and Petal Dance, so `vol:"uproar"` is what tells an Uproar
         * from an Outrage, and it does not survive twelve characters. */
        for (const k of ['_yawn', '_charging', '_invuln', '_seededBy', '_sub', '_perish', '_healBlock',
                         '_mtLock', '_ptDmg'])
          if (m[k]) keys.add(k + '=' + JSON.stringify(m[k]).slice(0, 40));
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
  /* THE ENGINE'S NAME FOR THE FACT, wherever it is not the authority's name for it. Each entry is a
   * field medicham2 deliberately writes instead of a `_vol` key, so a bare `_vol` read reports the
   * mechanic missing. `uproar` is gated on the lock's OWN `vol` so an Outrage is not counted as one —
   * the same discriminator `board_state.js` applies to `_mtLock`. */
  const MEDI_FIELD = { healblock: /_healBlock/, uproar: /_mtLock=[^ ]*uproar/, curse: /_ptDmg/ };
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
