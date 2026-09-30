/* solver/doduo/dp_rates.js — read a FINISHED `eval_gates.js --dp` run: the human double-Protect rate by stall condition,
 * and the human joint's survival under variants that switch exemptions off (2026-09-30, the double-Protect gate).
 *
 *   node solver/doduo/dp_rates.js <eval out dir> [--out <json>]
 *
 * Over decisions whose legal set OFFERS a double protect: for "no exemption" and for each exemption that holds ALONE, the
 * share of human joints that are a double protect (Wilson 95%). A stall condition the humans honour shows a rate well
 * above the no-exemption rate; one they ignore sits at it. Then, per variant (exemptions off), how many human double
 * protects the gate would weight and the survival over every evaluated decision.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const DIR = argv[0];
const OUT = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : null; })();
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 1]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - h) / d, (c + h) / d]; };
const R = [];
for (const f of fs.readdirSync(DIR).filter(n => /^decisions-\d+\.jsonl$/.test(n)).sort())
  for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) if (l) { const r = JSON.parse(l); if (!r.error && !r.unmatched && r.dp) R.push(r); }
const offered = R.filter(r => r.offered);
const set = r => [...new Set(r.reasons || [])];
const rate = (name, rs) => { const k = rs.filter(r => r.human_double).length; return { name, n: rs.length, human_double: k, rate: rs.length ? k / rs.length : null, ci95: wilson(k, rs.length) }; };
const by = [rate('no exemption', offered.filter(r => !set(r).length))];
for (const x of ['fakeout', 'trickroom', 'tailwind', 'perish', 'weather', 'terrain', 'screen', 'residual', 'firstturn'])
  by.push(rate('only ' + x, offered.filter(r => { const s = set(r); return s.length === 1 && s[0] === x; })));
const variants = [[], ['terrain', 'screen'], ['terrain', 'screen', 'weather'], ['terrain', 'screen', 'weather', 'residual']].map(off => {
  const O = new Set(off);
  const keep = r => set(r).filter(x => !O.has(x)).length > 0;
  const gated = R.filter(r => r.human_double && !keep(r)).length;
  return { exempt_off: off, human_doubles: R.filter(r => r.human_double).length, gated, survival: (R.length - gated) / R.length, ci95: wilson(R.length - gated, R.length),
    fires_on_offered: offered.filter(r => !keep(r)).length, offered: offered.length };
});
const out = { dir: DIR, evaluated: R.length, offered: offered.length, by_exemption: by, variants };
for (const b of by) console.log(b.name.padEnd(16), String(b.n).padStart(5), String(b.human_double).padStart(4), b.rate == null ? '-' : (100 * b.rate).toFixed(1) + '%', '[' + b.ci95.map(x => (100 * x).toFixed(1)).join(', ') + ']');
for (const v of variants) console.log('off ' + JSON.stringify(v.exempt_off).padEnd(44), 'gated', v.gated, 'of', v.human_doubles, 'survival', (100 * v.survival).toFixed(2) + '% [' + v.ci95.map(x => (100 * x).toFixed(2)).join(', ') + ']', 'fires on', v.fires_on_offered, 'of', v.offered);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
