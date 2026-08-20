/* gate_offfield_target.js — ROADMAP #224: THE `??:` SLOT PLACEHOLDER REACHES THE PROTOCOL STREAM.
 * The row was closed on a measurement and nothing has re-taken it since. This takes it every run.
 *
 * ================= WHY A CLOSED ROW GETS A GATE =================================================
 *
 * #224 closed on 2026-08-12 with a claim of exactly the right shape — *"Verified in the artifacts
 * rather than the source: `data/game-differential.json` and `data/divergence-turns.json` contain zero
 * occurrences"* — and then nothing re-checked it for six days while the simulator was rewritten
 * nightly. A measurement taken once and quoted afterwards is prose about a number, which is what the
 * fourteen stale handoffs were. #297 then reopened the row, so it was ALSO a row asserting breakage
 * with no instrument. Either way the answer is the same: run it.
 *
 * ================= WHAT IT ASSERTS, AND WHY IT IS TWO THINGS ====================================
 *
 * ARM 1 — THE ENGINE'S OWN COUNTER. `MEDFAILS.traceBodyOffField` is the capability announcing its own
 * absence, and the row's whole point is that it *"already counts itself … and nothing was reading the
 * counter"*. `engine/game_differential.js` publishes it as `declared_gaps.trace_body_off_field` and
 * prints `(must read 0)` beside it. This reads it. It is the STRONGER arm: it fires on the emitting
 * site whether or not any protocol line survived to be written down.
 *
 * ARM 2 — THE ARTIFACT TEXT. Zero occurrences of the literal `??:` anywhere in the run's output. This
 * is the weaker arm and it is kept because it is the row's own stated verification, and because it
 * catches a placeholder arriving through a path that does not increment the counter.
 *
 * THE ROW SAYS THE FALLBACK MUST STAY VISIBLE, so nothing here greps `engine/medicham2-browser.js`:
 * *"The three literals left in medicham2-browser.js are the fallback itself, which this row says must
 * stay visible."* A source scan would fail on the thing the row deliberately kept.
 *
 * ================= A STALE ARTIFACT IS NOT A CLEAN ONE =========================================
 *
 * Every artifact is checked against `data/engine-release.json` first and one measured against other
 * bytes is NOT COUNTED — named, with both release ids, and excluded from the verdict. That is #298's
 * rule applied before it could be broken again here: `data/divergence-turns.json` is stamped
 * `0c5bb83c5744` and would otherwise contribute a five-day-old zero to a claim about today's engine.
 * If NO artifact is current the gate exits 2 rather than reporting the row clean, because a defect
 * nobody looked for is not a defect that is absent.
 *
 *   node engine/gate_offfield_target.js            the verdict, artifact by artifact
 *   node engine/gate_offfield_target.js --json
 *   node engine/gate_offfield_target.js --selftest every branch on synthetic input, red and green
 *
 * Reads artifacts. Runs no games and loads no simulator. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const has = (f) => process.argv.includes(f);
const PLACEHOLDER = '??:';

/* The artifacts a differential run writes. Both are named by the row. */
const ARTIFACTS = ['data/game-differential.json', 'data/divergence-turns.json'];

/* THE VERDICT TABLE, EXTRACTED SO THE SELFTEST DRIVES THE SHIPPING FUNCTION. Exit 2 is RED to
 * `register_reality.js` exactly as 1 is. */
function verdict(m) {
  if (!m || m.error) return { code: 2, tag: 'CANNOT ANSWER', why: (m && m.error) || 'no measurement' };
  if (!m.counted.length) {
    return { code: 2, tag: 'CANNOT ANSWER',
      why: 'NO CURRENT ARTIFACT — every artifact this row names is either absent or measured against '
         + 'other bytes, so nothing here describes the engine in the tree. '
         + (m.stale.length ? 'Stale: ' + m.stale.map((s) => s.file + ' (' + s.ranOn + ')').join(', ') + '. ' : '')
         + 'Re-run: SHOWDOWN_PATH=... node engine/game_differential.js --games 1200 --write' };
  }
  const bad = m.counted.filter((a) => a.placeholders > 0 || a.counter > 0);
  if (bad.length) {
    return { code: 1, tag: 'LIVE',
      why: 'AN OFF-FIELD BODY IS STILL BEING NAMED: ' + bad.map((a) => a.file + ' — '
        + a.placeholders + ' `' + PLACEHOLDER + '` occurrence(s), engine counter '
        + (a.counter == null ? 'absent' : a.counter)).join('; ')
        + '. The row is reopened by measurement: an effect written onto a body that is not on the '
        + 'field is read by nobody again, so no board comparison can see it.' };
  }
  return { code: 0, tag: 'CLEAN',
    why: m.counted.length + ' current artifact(s) carry zero `' + PLACEHOLDER + '` occurrences and '
       + 'the engine\'s own traceBodyOffField counter reads 0'
       + (m.stale.length ? '. NOT COUNTED (measured against other bytes): '
          + m.stale.map((s) => s.file + ' @ ' + s.ranOn).join(', ') : '') + '.' };
}

/* ---- the measurement --------------------------------------------------------------------------- */
function readCurrentRelease() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'engine-release.json'), 'utf8'));
    return c.id || c.release || c.current || null;
  } catch (e) {
    /* ROADMAP #258 — NO RELEASE POINTER and A RELEASE POINTER I COULD NOT READ are different, and
     * only the second one is a broken checkout. Null still means "cannot compare releases", which
     * every caller of this already treats as an absence rather than as a match. */
    if (!(e && e.code === 'ENOENT')) {
      console.error('  data/engine-release.json EXISTS AND COULD NOT BE READ — '
                  + String((e && e.message) || e).split(String.fromCharCode(10))[0]
                  + '; this gate will report NO CURRENT RELEASE, which is not the same as a match');
    }
    return null;
  }
}

function measure(curId) {
  const counted = [], stale = [], missing = [];
  for (const rel of ARTIFACTS) {
    const p = path.join(ROOT, rel);
    let raw = null;
    try { raw = fs.readFileSync(p, 'utf8'); } catch (e) { missing.push(rel); continue; }
    let j = null;
    try { j = JSON.parse(raw); } catch (e) { missing.push(rel + ' (unparseable)'); continue; }
    const ranOn = j.engine_release || j.release || null;
    if (ranOn && curId && ranOn !== curId) { stale.push({ file: rel, ranOn }); continue; }
    const hits = raw.split(PLACEHOLDER).length - 1;
    const dg = j.declared_gaps || {};
    const counter = (dg.trace_body_off_field == null) ? null : +dg.trace_body_off_field;
    counted.push({ file: rel, ranOn: ranOn || '(unstamped)', generated: j.generated || null,
      placeholders: hits, counter: counter == null ? 0 : counter, counter_present: counter != null });
  }
  return { counted, stale, missing, current: curId };
}

/* ---- selftest ---------------------------------------------------------------------------------- */
if (has('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`); };
  const A = (o) => Object.assign({ file: 'data/x.json', placeholders: 0, counter: 0 }, o);
  const M = (o) => Object.assign({ counted: [A({})], stale: [], missing: [] }, o);

  ok('GREEN only when every current artifact is clean on BOTH arms', verdict(M({})).code === 0);
  ok('RED — one `??:` in the text is exit 1', verdict(M({ counted: [A({ placeholders: 1 })] })).code === 1);
  ok('RED — the ENGINE COUNTER alone is enough, with zero placeholders in the text: the emitting '
    + 'site announces its own absence and that is the stronger arm',
    verdict(M({ counted: [A({ counter: 3 })] })).code === 1);
  ok('RED — NO current artifact is CANNOT ANSWER (exit 2), never green: a defect nobody looked for '
    + 'is not a defect that is absent',
    verdict(M({ counted: [], stale: [{ file: 'data/y.json', ranOn: 'old' }] })).code === 2);
  ok('a stale artifact is NAMED with the release it ran on, and never silently dropped',
    /data\/y\.json/.test(verdict(M({ counted: [], stale: [{ file: 'data/y.json', ranOn: 'old' }] })).why));
  ok('a stale artifact beside a current CLEAN one does not turn the verdict red, and is still named',
    verdict(M({ stale: [{ file: 'data/y.json', ranOn: 'old' }] })).code === 0
    && /NOT COUNTED/.test(verdict(M({ stale: [{ file: 'data/y.json', ranOn: 'old' }] })).why));
  ok('RED — an errored measurement is CANNOT ANSWER and is never 0',
    verdict({ error: 'boom' }).code === 2 && verdict(null).code === 2);

  /* -- the reader, on synthetic files it never has to write ------------------------------------- */
  ok('the reader counts EVERY occurrence of the placeholder, not just the first',
    ('a' + PLACEHOLDER + 'b' + PLACEHOLDER + 'c').split(PLACEHOLDER).length - 1 === 2);

  console.log(`\nOFF-FIELD-TARGET GATE SELFTEST: ${ran - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- the run ----------------------------------------------------------------------------------- */
let m = null;
try { m = measure(readCurrentRelease()); }
catch (e) { m = { error: 'THE MEASUREMENT THREW — ' + String((e && e.message) || e).split('\n')[0] }; }
const v = verdict(m);
const out = {
  row: 224, gate: 'engine/gate_offfield_target.js',
  what: 'an effect written onto a body that is not on the field — the `' + PLACEHOLDER + '` slot '
      + 'placeholder in the protocol stream, and the engine\'s own traceBodyOffField counter',
  tree_release: m.current || null,
  counted: m.counted || [], not_counted_stale: m.stale || [], absent: m.missing || [],
  verdict: v.tag, exit: v.code, why: v.why,
};

if (has('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(v.code); }

console.log('');
console.log('ROADMAP #224 — a moved effect naming a body that is not on the field');
console.log('  tree release  ' + (out.tree_release || '(none)'));
for (const a of out.counted) {
  console.log('  COUNTED   ' + a.file + '   release ' + a.ranOn + '   generated ' + (a.generated || '?'));
  console.log('            `' + PLACEHOLDER + '` occurrences ' + a.placeholders
            + '   traceBodyOffField ' + (a.counter_present ? a.counter : 'NOT PUBLISHED BY THIS ARTIFACT'));
}
for (const s of out.not_counted_stale) console.log('  NOT COUNTED (other bytes)   ' + s.file + '   release ' + s.ranOn);
for (const f of out.absent) console.log('  ABSENT   ' + f);
console.log('');
console.log('  ' + v.tag + '   ' + v.why);
console.log('');
console.log('  exit ' + v.code + '   [0 clean, 1 the placeholder is back, 2 cannot answer]');
console.log('');
process.exit(v.code);
