/* PROBE — DOES A ROSTER RED DEMONSTRATION'S PLANT MOVE OUR OWN BOARD AT ALL?  (ROADMAP #513)
 *
 * `tests/roster.js --reds` asks whether planting a deliberate break FLIPS A VERDICT, which is a
 * question about the two-engine comparison. Thirty rules do not flip, and a non-flip has three
 * possible causes that the reds loop cannot tell apart:
 *
 *   1  THE DEMONSTRATION IS MISWRITTEN — the anchor no longer matches, or it matches and the
 *      patched code is not semantically different, so nothing was ever broken.
 *   2  THE RULE IS WRONG — something broke, but not the thing the rule predicts.
 *   3  THE ENGINE GENUINELY DOES NOT REACT — the path the rule names is not in the fixture's way.
 *
 * This probe asks the NARROWER question that separates them, exactly the way `healStagingWorks()`
 * already does for one rule: apply the plant to the frozen release's bytes and compare OUR OWN board
 * against OUR OWN board. Showdown is not involved, so the control arm, the delta subtraction and the
 * usage shelf cannot cancel anything.
 *
 *   MOVED>0  the plant reaches our engine on this fixture. If `--reds` still said NOT CAUGHT, the
 *            cancellation is in the reds loop or in the comparison, not in the simulator.
 *   MOVED=0  the plant does not reach our engine on this fixture — the demonstration is aimed
 *            somewhere the fixture never goes, or the branch it removes is dead.
 *
 * A MOVED=0 IS NOT A VERDICT ON THE MECHANIC. It is a verdict on the demonstration, and saying
 * otherwise is the COULD-NOT-STAGE conflation this project has been taught twice.
 *
 * Usage:
 *   SHOWDOWN_PATH=... node tests/probe_reds_plant_reaches.js --release <id> --stage moves
 *   ... --rule move/variable-power         one rule
 *   ... --members 4                        how many staged members to try per rule (default 3)
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent.'); process.exit(2); }

const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const STAGE = ARG('--stage') || 'moves';
const RULE_ONLY = ARG('--rule');
const MEMBERS = ARG('--members') ? +ARG('--members') : 3;

/* the roster is loaded as a LIBRARY, so its own --stage/--rule handling must not fire */
/* `--state` MUST SURVIVE, and leaving it out is how the first run of this probe reported NO REACH on
 * a rule whose plant reaches fine: without it every boundary compares ZERO leaves and `play()`
 * returns SHORT, which reads exactly like a plant that changed nothing. */
const keep = process.argv.slice();
process.argv = [keep[0], keep[1], '--state']
  .concat(ARG('--release') ? ['--release', ARG('--release')] : []);
const R = require(D('tests', 'roster.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open(ARG('--release') || null);
const BS = require(D('engine', 'board_state.js'));
process.argv = keep.includes('--state') ? keep : keep.concat(['--state']);

const KINDS = STAGE === 'all' ? ['item', 'ability', 'move'] : [{ items: 'item', abilities: 'ability', moves: 'move' }[STAGE] || STAGE];

const clean = REL.read('engine/medicham2-browser.js');
let bad = 0;
console.log('PLANT REACH PROBE   release ' + REL.id + '   stage ' + STAGE + '   up to ' + MEMBERS + ' member(s)/rule\n');

for (const kind of KINDS) {
  const entries = R.assign(kind).entries;
  const byRule = {};
  for (const e of entries) if (e.scenario && !e.verdict) (byRule[e.rule] = byRule[e.rule] || []).push(e);
  for (const rid of Object.keys(byRule).sort()) {
    if (RULE_ONLY && rid !== RULE_ONLY) continue;
    const rule = byRule[rid][0].ruleObj;
    if (!rule || !rule.break) continue;
    let src = clean, err = null;
    for (const [find, repl] of rule.break.patch) {
      const n = src.split(find).length - 1;
      if (n !== 1) { err = 'ANCHOR MATCHED ' + n + ' TIME(S), NOT ONE — nothing was planted. ['
        + find.slice(0, 70).replace(/\s+/g, ' ') + ']'; break; }
      src = src.replace(find, repl);
    }
    if (err) { console.log('  UNPLANTED   ' + rid + '\n      ' + err); bad++; continue; }
    if (src === clean) { console.log('  NO-OP PLANT ' + rid + '\n      the patch applied and produced '
      + 'IDENTICAL bytes'); bad++; continue; }
    const rows = [];
    let anyMoved = 0;
    for (const e of byRule[rid].slice(0, MEMBERS)) {
      const sc = { ...e.scenario, id: 'plantreach/' + e.id };
      const a = R.play(sc, null, e.scenario.arm || null);
      const b = R.play(sc, src, e.scenario.arm || null);
      /* A PLANT THAT MAKES THE FIXTURE UNPLAYABLE HAS REACHED, AND CALLING THAT "did not play" IS THE
       * CONFLATION THIS PROBE EXISTS TO REMOVE. Measured on `move/self-switch`: the clean arm plays
       * and the planted arm returns SHORT, because a body that refuses to pivot leaves the script
       * aiming at a slot nobody is standing in. The reds loop scores that COULD-NOT-STAGE and does
       * not count it, so a live mechanism reads NOT CAUGHT. Reported here as its own outcome. */
      if (!a.bad && b.bad) { rows.push(e.name + ': THE PLANT MADE THE FIXTURE UNPLAYABLE (' + b.bad
        + ' — ' + String(b.why || '').replace(/\s+/g, ' ').slice(0, 90) + '), which IS a reaction');
        anyMoved++; continue; }
      if (a.bad) { rows.push(e.name + ': the CLEAN fixture did not play (' + a.bad + ') — this rule '
        + 'member cannot answer'); continue; }
      if (b.bad) { rows.push(e.name + ': fixture did not play (' + b.bad + ')'); continue; }
      /* `BS.compare` returns `{path, medicham, showdown}` — here arg1 is the CLEAN board and arg2 the
       * PLANTED one, so `showdown` is the planted value. Named that way in the print so nobody reads
       * this as a two-engine comparison; the authority is not in this probe at all. */
      let moved = 0; const seen = [];
      for (let i = 0; i < a.boards.length; i++)
        for (const d of BS.compare(a.boards[i].medi, b.boards[i].medi, { compared: 0 })) {
          moved++;
          if (seen.length < 4) seen.push('t' + a.boards[i].turn + ' ' + d.path + ' clean='
            + JSON.stringify(d.medicham) + ' planted=' + JSON.stringify(d.showdown));
        }
      anyMoved += moved;
      rows.push(e.name + ': ' + moved + ' leaf/leaves' + (moved ? '  ' + seen.join(' | ') : ''));
    }
    console.log('  ' + (anyMoved ? 'REACHES  ' : 'NO REACH ') + rid + '   (' + rule.break.why + ')');
    for (const r of rows) console.log('      ' + r);
    if (!anyMoved) bad++;
  }
}
console.log('\n' + bad + ' rule(s) whose plant does not demonstrably reach our own board on the members tried.');
process.exit(bad ? 1 : 0);
