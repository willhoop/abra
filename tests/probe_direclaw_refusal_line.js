#!/usr/bin/env node
/* tests/probe_direclaw_refusal_line.js — NARRATION BATCH S, CLUSTER 2
 * ==================================================================================================
 * CHAMPIONS GIVES DIRE CLAW A REFUSAL LINE MAINLINE DOES NOT HAVE, AND THIS ENGINE SAID NOTHING.
 *
 * READING data/moves.ts HERE IS READING THE WRONG GAME. Mainline's Dire Claw secondary is
 * `const status = this.sample(['psn','par','slp']); target.trySetStatus(status, source);` and
 * `trySetStatus` refuses an already-statused body SILENTLY. The Champions mod REWRITES the whole
 * secondary (data/mods/champions/moves.ts:191-209, chance 50 -> 30) and inserts, above the set:
 *
 *     if (target.status) {
 *       if (target.status === status) { this.add('-fail', target, status); }   <- names the status
 *       else                          { this.add('-fail', target); }           <- bare
 *       return;
 *     }
 *
 * with its own comment, "This seems to only happen with Dire Claw". TRI ATTACK IS NOT OVERRIDDEN and
 * gets neither line, so a fix keyed on the `proceduralStatus` TAG rather than on the member would
 * invent a `-fail` on every Tri Attack into a statused body. That is the TRI-STATUSED arm below, and
 * it is the arm that matters.
 *
 * ONE NARRATION-ONLY CAUSE, TWO GAMES on release `2c4e125866cc`:
 *     event missing from medicham2 :: |-fail|p2a <> |faint|p2a
 * Both cards are a Sneasler Dire Claw into an already-poisoned body that the hit also kills — but the
 * corpse is incidental: `this.add` is unconditional, so the line is owed at ANY HP. Every arm here
 * stages the LIVE body, which is the general case the pool only ever showed the fatal corner of.
 *
 * THE ARMS — the two shapes fall out of the ARM, not out of a seed hunt
 *   SAME-STATUS    `bottom-tie-first`. The sample lands on the status the body already carries, so
 *                  the authority names it: `|-fail|p2a: Garchomp|psn`.
 *   OTHER-STATUS   `middle`. The sample lands elsewhere, so the authority writes the bare line.
 *   NO-SECONDARY   `top-tie-first`. The 30% never fires, so there is no `-fail` at all and both
 *                  engines are silent — the control that stops "always write a `-fail`" passing.
 *   TRI-CLEAN      Tri Attack into an UNSTATUSED body under the same arm as TRI-STATUSED: the
 *                  status LANDS, which is what proves the 20% secondary is firing at all.
 *   TRI-STATUSED   the same Tri Attack into a PARALYSED body: the authority writes NOTHING. This is
 *                  the over-match negative.
 *
 * Every arm asserts the boards are identical at every boundary.
 *
 * DERIVED, NOT NAMED: Sneasler is the ONLY legal carrier of Dire Claw in this regulation and the Tri
 * Attack user is the first legal carrier that also learns Thunder Wave — both read off
 * `Dex.forFormat('gen9championsvgc2026regmb')` on every run, so a roster change renames the cast
 * rather than breaking the probe silently.
 *
 * RED-FIRST KNOB: `MEDI_NO_PROCEDURAL_REFUSAL_LINE=1` takes the line back out — the engine exactly as
 * it stood before batch S. Under it SAME-STATUS and OTHER-STATUS go RED and every control stays
 * green; any run carrying it also carries `MEDFAILS.proceduralRefusalLineRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_direclaw_refusal_line.js
 *   MEDI_NO_PROCEDURAL_REFUSAL_LINE=1 SHOWDOWN_PATH=... node tests/probe_direclaw_refusal_line.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '8');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_NO_PROCEDURAL_REFUSAL_LINE === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_direclaw_refusal_line.js — the Champions-only refusal Dire Claw announces');
console.log('  MEDI_NO_PROCEDURAL_REFUSAL_LINE=' + (KNOB ? '1  (PRE-FIX ENGINE: the refusal is silent)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — the MOD, read this run. CR stripped: this checkout is CRLF and a carriage
 *    return is a JavaScript line terminator, so a multi-line anchor would match nothing.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const CH = read('/data/mods/champions/moves.ts');
const MAIN = read('/data/moves.ts');
const block = (src, id) => {
  const m = new RegExp('\\n\\t' + id + ': \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(src);
  return m ? m[1] : null;
};

console.log(NL + '0. THE AUTHORITY');
const DC = block(CH, 'direclaw');
ok(!!DC && /if \(target\.status\) \{/.test(DC) && /this\.add\('-fail', target, status\);/.test(DC)
   && /this\.add\('-fail', target\);/.test(DC),
   'the CHAMPIONS mod gives Dire Claw a refusal that announces — the status named when it matches, '
   + 'bare when it does not',
   DC ? (DC.match(/if \(target\.status\) \{[\s\S]{0,240}/) || ['not found'])[0] : 'no direclaw block in the mod');
ok(!/\n\ttriattack: \{/.test(CH) && !!block(MAIN, 'triattack')
   && !/this\.add\('-fail'/.test(block(MAIN, 'triattack') || ''),
   'the mod does NOT override Tri Attack, and mainline\'s secondary writes no `-fail` at all — '
   + 'so the announcement is ONE member\'s and not the tag\'s',
   (block(MAIN, 'triattack') || '').match(/secondary: \{[\s\S]{0,200}/) ? (block(MAIN, 'triattack').match(/secondary: \{[\s\S]{0,200}/) || [''])[0] : '');

/* THE TAG CARRIES THE DIFFERENCE, and which members carry it is read out of the artifact. */
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const PROC = Object.keys(TAGS.moves || {})
  .filter(k => ((TAGS.moves[k] && TAGS.moves[k].tags) || []).indexOf('proceduralStatus') >= 0);
const annOf = k => ((TAGS.moves[k].params || {}).proceduralStatus || {}).announcesRefusalOnStatus || null;
ok(PROC.length >= 2 && PROC.some(k => annOf(k)) && PROC.some(k => !annOf(k)),
   '`proceduralStatus.announcesRefusalOnStatus` splits the tag rather than covering it — '
   + PROC.length + ' member(s) read this run',
   PROC.map(k => '  ' + k.padEnd(12) + (annOf(k) ? JSON.stringify(annOf(k)) : 'absent (refuses silently)')).join('\n'));

/* ==================================================================================================
 * 1. THE CAST — derived from the format, never named
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require('../engine/champions_sim.js').FORMAT);
const legalX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => !!(((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {})[mv];
const carriers = mv => D.species.all().filter(s => legalX(s) && learns(s.name, mv));

const DC_USER = carriers('direclaw')[0];
const TRI_USER = carriers('triattack').filter(s => learns(s.name, 'thunderwave'))[0];
console.log(NL + '1. THE CAST');
ok(!!DC_USER, 'a legal Dire Claw carrier exists',
   'direclaw carriers: ' + carriers('direclaw').map(s => s.name).join(', '));
ok(!!TRI_USER, 'a legal Tri Attack carrier that also learns Thunder Wave exists',
   'triattack + thunderwave: ' + carriers('triattack').filter(s => learns(s.name, 'thunderwave')).map(s => s.name).join(', '));
if (!DC_USER || !TRI_USER) { console.log(NL + 'RED — the cast could not be derived.'); process.exit(1); }
console.log('     Dire Claw user : ' + DC_USER.name);
console.log('     Tri Attack user: ' + TRI_USER.name);

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };

function play(tag, armId, A, B, script) {
  const ARM = G.ARM_BY_ID.get(armId);
  if (!ARM) return { staged: false, why: 'arm ' + armId + ' is not in ARM_BY_ID' };
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_direclaw_refusal_line :: ' + tag, {
    script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).slice(0, 4) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW/REJECTED: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const norm = s => s.filter(l => /^\|-(fail|status)\|/.test(l))
                     .map(l => l.replace(/\s+/g, ' ').toLowerCase().replace(/[:,]/g, ''));
  return { staged: true, sd, me, sdLines: norm(sd), meLines: norm(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* THE TARGET RESISTS POISON (Ground) so it lives through six clicks, and is immune to none of
 * psn / par / slp, so whichever status the sample picks can actually be carried. */
const DCA = [mon(DC_USER.name, '', '', ['Dire Claw']), mon('sableye', '', 'Prankster', ['Nasty Plot']),
             mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
/* THE FILLER IS NASTY PLOT AND THREE OF THE ORIGINAL BODIES COULD NOT LEARN IT (2026-09-10). The
 * validator refuses Nasty Plot on Garchomp, Kingambit and Milotic, and the packed team carried it anyway
 * because a raw Battle validates nothing. A body that is CLICKED (or can enter after a faint and then be
 * clicked) is swapped for a legal Nasty Plot carrier of the same shape — Slowbro for the Water target,
 * Sinistcha for the bench body that enters — and a body that is never clicked keeps its species with a
 * move it legally learns. A scripted move the request does not offer is a silent `pass` on BOTH engines
 * (`scriptMoveNotOnRequest`), which is why the clicked slots could not simply be given any legal move. */
/* Garchomp is KEPT as the Ground target (nothing in the regulation both resists Poison and learns Nasty
 * Plot with a quiet ability); its own idle click is Swords Dance, which is `self`, priority 0 and legal. */
const DCB = [mon('garchomp', '', 'Sand Veil', ['Swords Dance']), mon('raichu', '', 'Static', ['Nasty Plot']),
             mon('kingambit', '', 'Defiant', ['Swords Dance']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const DC_TURN = { p1: [{ m: 'direclaw', t: 0 }, IDLE], p2: [{ m: 'swordsdance' }, IDLE] };
const DC_SCRIPT = [DC_TURN, DC_TURN, DC_TURN, DC_TURN, DC_TURN];

const SAME = play('SAME-STATUS', 'bottom-tie-first', DCA, DCB, DC_SCRIPT);
const OTHER = play('OTHER-STATUS', 'middle', DCA, DCB, DC_SCRIPT);
const NOSEC = play('NO-SECONDARY', 'top-tie-first', DCA, DCB, DC_SCRIPT);

/* THE POOL'S OWN SHAPE: the hit that rolls the refusal also KILLS the body. `this.add` carries no HP
 * guard — unlike `cureStatus` and `removeVolatile`, which both open `if (!this.hp) return false` —
 * so the line is still owed on a corpse, ABOVE the `|faint|`. Both pool cards are this. The status is
 * planted by an ally so the arm does not depend on which way an earlier roll fell. */
const KOA = [mon(DC_USER.name, '', '', ['Dire Claw']), mon(TRI_USER.name, '', '', ['Thunder Wave', 'Nasty Plot']),
             mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const KOB = [mon('slowbro', '', 'Oblivious', ['Nasty Plot']), mon('raichu', '', 'Static', ['Nasty Plot']),
             mon('sinistcha', '', 'Heatproof', ['Nasty Plot']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const KO_TURN = k => ({ p1: [{ m: 'direclaw', t: 0 }, k], p2: [IDLE, IDLE] });
const KO_SCRIPT = [KO_TURN({ m: 'thunderwave', t: 0 }), KO_TURN(IDLE), KO_TURN(IDLE), KO_TURN(IDLE),
                   KO_TURN(IDLE), KO_TURN(IDLE)];
const KO = play('KO-ON-A-CORPSE', 'bottom-tie-first', KOA, KOB, KO_SCRIPT);

/* TRI ATTACK. The target is a Water body — immune to none of brn / par / frz. */
const TRA = [mon(TRI_USER.name, '', '', ['Tri Attack', 'Thunder Wave']), mon('sableye', '', 'Prankster', ['Nasty Plot']),
             mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const TRB = [mon('slowbro', '', 'Oblivious', ['Nasty Plot']), mon('raichu', '', 'Static', ['Nasty Plot']),
             mon('sinistcha', '', 'Heatproof', ['Nasty Plot']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const TRI = k => ({ p1: [k, IDLE], p2: [IDLE, IDLE] });
const TRI_CLEAN = play('TRI-CLEAN', 'bottom-tie-first', TRA, TRB,
  [TRI({ m: 'triattack', t: 0 }), TRI({ m: 'triattack', t: 0 })]);
const TRI_STAT = play('TRI-STATUSED', 'bottom-tie-first', TRA, TRB,
  [TRI({ m: 'thunderwave', t: 0 }), TRI({ m: 'triattack', t: 0 }), TRI({ m: 'triattack', t: 0 }),
   TRI({ m: 'triattack', t: 0 })]);

/* ==================================================================================================
 * 3. THE JUDGEMENT
 * ============================================================================================== */
console.log(NL + '2. THE ARMS');
const arms = [['SAME-STATUS', SAME], ['OTHER-STATUS', OTHER], ['NO-SECONDARY', NOSEC],
              ['KO-ON-A-CORPSE', KO], ['TRI-CLEAN', TRI_CLEAN], ['TRI-STATUSED', TRI_STAT]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown : ' + (R.sdLines.join('   ') || '(no -fail / -status line)'));
  console.log('     medicham : ' + (R.meLines.join('   ') || '(no -fail / -status line)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(JSON.stringify(R.sdLines) === JSON.stringify(R.meLines),
     tag + ' — the two engines write the SAME `-fail` / `-status` lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

console.log(NL + '3. THE SHAPES THE ARMS EXIST FOR');
const has = (R, re) => R.staged && R.sdLines.some(l => re.test(l));
const nofail = R => R.staged && !R.sdLines.some(l => /^\|-fail\|/.test(l));
ok(has(SAME, /^\|-fail\|p2a garchomp\|(psn|par|slp)$/),
   'SAME-STATUS — the authority named the status it re-rolled', SAME.staged ? SAME.sdLines.join(' | ') : SAME.why);
ok(has(OTHER, /^\|-fail\|p2a garchomp$/),
   'OTHER-STATUS — the authority wrote the BARE line', OTHER.staged ? OTHER.sdLines.join(' | ') : OTHER.why);
ok(nofail(NOSEC), 'NO-SECONDARY — the authority wrote NO `-fail` at all (the arm that stops "always announce")',
   NOSEC.staged ? NOSEC.sdLines.join(' | ') : NOSEC.why);
/* THE ORDER IS THE ASSERTION HERE, not merely the presence: the `-fail` must sit between the lethal
 * `-damage` and the `|faint|`, which is where the pool cards put it. */
const koRaw = KO.staged ? KO.sd.map(String) : [];
const koDmg = koRaw.findIndex(l => /^\|-damage\|p2a: Slowbro\|0 fnt/.test(l));
const koFaint = koRaw.findIndex(l => /^\|faint\|p2a: Slowbro/.test(l));
const koFail = koRaw.findIndex((l, i) => i > koDmg && /^\|-fail\|p2a: Slowbro/.test(l));
ok(KO.staged && koDmg >= 0 && koFaint > koDmg && koFail > koDmg && koFaint > koFail,
   'KO-ON-A-CORPSE — the authority writes the refusal BETWEEN the lethal `-damage` and the `|faint|`',
   KO.staged ? koRaw.slice(Math.max(0, koDmg - 1), koFaint + 1).join(NL) : KO.why);
ok(has(TRI_CLEAN, /^\|-status\|p2a slowbro\|(brn|par|frz)$/),
   'TRI-CLEAN — Tri Attack\'s secondary DOES fire under this arm, so TRI-STATUSED is not vacuous',
   TRI_CLEAN.staged ? TRI_CLEAN.sdLines.join(' | ') : TRI_CLEAN.why);
ok(nofail(TRI_STAT),
   'TRI-STATUSED — Tri Attack into an already-statused body writes NOTHING (the over-match negative)',
   TRI_STAT.staged ? TRI_STAT.sdLines.join(' | ') : TRI_STAT.why);

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
