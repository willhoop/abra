/* fixture_legality.js — every SET declared by a fixture in this repo, put to Showdown's own
 * TeamValidator.
 *
 *   node engine/fixture_legality.js            the whole population, with the authority's verdicts
 *   node engine/fixture_legality.js --json     the same as an artifact
 *
 * The gate that ratchets this is tests/test-fixture-legality.js.
 *
 * WHY THIS EXISTS
 * ---------------
 * CLAUDE.md's cardinal rule is that no Pokemon, item, ability or move outside the regulation may be
 * NAMED — "every example, every illustration and every derived result", because an illegal entity is
 * indistinguishable from a claim about the game we actually play. It was being broken inside the
 * tests, where it is worse than in prose: a fixture built on a set that cannot exist is measuring a
 * game we do not play, and every number it produces inherits that. It is the same class as the
 * blank-spread rig that tested turn order in the one configuration where turn order cannot be got
 * wrong — a PASS that proves nothing.
 *
 * BOTH KNOWN INSTANCES WERE FOUND IN PASSING RATHER THAN BY A CHECK, which is the whole argument for
 * this file. `engine/feature_fixture.js` gave Venusaur a ROCKY HELMET, banned in this format since
 * 2026-08-04, and it was noticed by an agent doing something else. Seven illegal learnset pairs were
 * ratcheted in data/fixture-learnset-baseline.json after an agent sent to repair ONE faint happened
 * to run the validator on a fixture.
 *
 * THE VERDICT IS THE AUTHORITY'S, AND IT IS ASKED ABOUT THE WHOLE SET
 * -------------------------------------------------------------------
 * Will, 2026-08-13: *"i thought we were using showdowns team validator as the ultimate legality
 * test."* The first plan for this sweep was to check the species with `isNonstandard`, then the
 * ability against the species' list, then the item, then each move with `checkCanLearn`. That is a
 * RE-IMPLEMENTATION of the validator — four hand-written rules standing in for a table that Showdown
 * maintains — and it is the FACTS ARE GLOBAL rule broken in the file written to enforce a rule.
 *
 * A piecemeal check only ever finds the rules somebody thought to write. `validateTeam` enforces the
 * whole format: the 66-point SP budget, the 32-per-stat cap, the level, the item clause, every ban
 * the Champions mod adds and every one it will add next. On the day this was written it caught a
 * spread putting 34 points into one stat — *"Weavile has more than 32 Stat Points in Special
 * Defense"* — in code whose author was not checking spreads at all.
 *
 * So this file contains NO legality rule of its own. It calls `champions_sim.checkLegal`, which is
 * one shared `TeamValidator` instance, validating the subject inside five filler slots that are
 * themselves proved clean, and it prints the validator's exact sentences rather than a summary of
 * them. `checkLegal` also already draws the distinction that matters here: EXISTENCE ("does not exist
 * in Gen 9") is always wrong, PAIRING ("can't learn", "can't have") is something an isolation probe
 * does on purpose and may declare.
 *
 * WHAT A "FIXTURE SOURCE" IS, DERIVED RATHER THAN LISTED
 * ------------------------------------------------------
 * A hand-listed set of files is the thing this repository has been wrong about most often — the ban
 * list of four, the fourteen handoffs, the `need` lists. So the sweep walks every .js in the tree and
 * finds set declarations by shape. Four rules, every one of them put in after it caught the scanner
 * being wrong on a real file:
 *
 *   1. A LITERAL IS AN ENTITY ONLY IF IT NAMES ITSELF. `dex.species.get('p2')` answers Porygon2, and
 *      'p2' in this tree is a SIDE. A literal counts only when it normalises to that entity's own id,
 *      which is derived from the format and needs no exclusion list.
 *   2. MOVES COME FROM ARRAY LITERALS ONLY. tests/test-mechanics.js calls `hit('vaporeon','icebeam')`
 *      where the move is clicked BY SOMEBODY ELSE at that body. Attributing a loose move literal to
 *      the nearest species produced three false accusations before this rule existed.
 *   3. HELPERS ARE TAKEN AT TOP LEVEL ONLY. test-mechanics.js is 22,000 lines and redeclares `run`,
 *      `hit` and `at` inside dozens of probe callbacks. A file-global name set made every one of them
 *      a candidate set-builder and paired an ability stamped on the ATTACKER with the DEFENDER's name.
 *      Scope is not recoverable from a regex, so the sweep takes the one scope a regex can see.
 *   4. A SET IS DECLARED TWO WAYS: an object literal keyed species+moves, or a body built by MUTATION
 *      (`b.moves = ...; b.ability = ...; b.item = ...`), which is what tests/test-protocol-trace.js
 *      does. Only the first has a `species` key to match on, and requiring one hid 64 real sets.
 *
 * WHAT IT CANNOT SEE, SAID RATHER THAN IMPLIED. A fixture that builds its bodies from the format
 * (tests/roster.js walks the regulation; engine/all_mechanics_fire.js reads the tag dex) declares no
 * literal and is not in this population — correctly, since it cannot type a name that does not exist.
 * A fixture that builds a body through `buildMon(key)` and assigns the click LATER — which is most of
 * tests/test-mechanics.js — has no set to validate at the point the body is made, and this sweep says
 * so instead of guessing. Those are counted and printed as NOT STATICALLY PAIRED.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'docs', 'dist', 'coverage']);

/* ROADMAP #258 — A DIRECTORY THIS SCAN COULD NOT OPEN IS NOT A DIRECTORY WITH NOTHING IN IT.
 * `return out` on a read failure makes a legality scan pass by looking at less, which is the exact
 * shape of the defect the scan exists to catch. The walk still continues (one unreadable directory
 * must not kill the run), and the skipped directories are recorded so the caller can refuse. */
const UNWALKED = [];
function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) {
    const msg = String((e && e.message) || e).split(String.fromCharCode(10))[0];
    UNWALKED.push({ dir, error: msg });
    console.error('  UNWALKED — ' + dir + ' could not be listed (' + msg + '); this scan covers LESS '
                + 'than it appears to');
    return out;
  }
  for (const e of ents) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* ---- source handling ------------------------------------------------------------------------- */
/* Comments are blanked before anything is matched, or a species named in prose — and this repo's
 * comments name a great many — becomes a fixture. Newlines are preserved so line numbers survive. */
function stripComments(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2); const to = e < 0 ? src.length : e + 2;
      out += src.slice(i, to).replace(/[^\n]/g, ' '); i = to; continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i); const to = e < 0 ? src.length : e;
      out += src.slice(i, to).replace(/[^\n]/g, ' '); i = to; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

function balanced(src, i, open, close) {
  let d = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; k++;
      while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++; }
      continue;
    }
    if (c === open) d++;
    else if (c === close) { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  return null;
}
const lineOf = (src, i) => src.slice(0, i).split('\n').length;
const STR = /(['"])((?:[^'"\\]|\\.)*)\1/g;
const strings = s => (s.match(STR) || []).map(x => x.slice(1, -1));

/* ---- what IS this literal? asked of the format ------------------------------------------------ */
const nrm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function makeRoleOf(dex) {
  const isA = (row, s) => row && row.exists && row.id === nrm(s);
  return function roleOf(s) {
    if (s === '') return 'blank';
    if (isA(dex.species.get(s), s)) return 'species';
    if (isA(dex.abilities.get(s), s)) return 'ability';
    if (isA(dex.items.get(s), s)) return 'item';
    if (isA(dex.moves.get(s), s)) return 'move';
    return 'unknown';
  };
}

/* ---- the scan ---------------------------------------------------------------------------------- */
function scan(dex) {
  const roleOf = makeRoleOf(dex);
  const files = walk(ROOT, []);
  const sets = [], unpaired = [];
  /* A FIXTURE FILE THAT WOULD NOT READ USED TO BE SKIPPED IN SILENCE, AND SILENCE HERE READS AS
     CLEAN — the scan says nothing illegal is declared in a file it never opened. Named. */
  const unread = [];

  for (const f of files) {
    let raw;
    try { raw = fs.readFileSync(f, 'utf8'); }
    catch (e) {
      unread.push(path.relative(ROOT, f).split(path.sep).join('/')
        + ' (' + String((e && e.message) || e).split('\n')[0] + ')');
      continue;
    }
    const src = stripComments(raw);
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel === 'engine/fixture_legality.js') continue;   /* the scanner's own prose and regexes */

    /* (A) top-level helpers that declare a set. Two passes so FILL/BENCH, which only call mon/st,
     *     are picked up after the helper they wrap. */
    const helpers = new Set();
    for (let pass = 0; pass < 3; pass++) {
      const re = /^const\s+([A-Za-z_$][\w$]*)\s*=\s*/gm; let m;
      while ((m = re.exec(src))) {
        const name = m[1];
        if (helpers.has(name)) continue;
        const body = src.slice(m.index, m.index + 500);
        if (!/=>|function/.test(body.slice(0, 80))) continue;
        const byLiteral = /\bspecies\s*[:,}]/.test(body) && /\bmoves\s*[:,}]/.test(body);
        const byMutation = /\.moves\s*=/.test(body) && /\.ability\s*=/.test(body) && /\.item\s*=/.test(body);
        const wrapsOne = [...helpers].some(h => new RegExp('\\b' + h.replace(/\$/g, '\\$') + '\\s*\\(').test(body));
        if (byLiteral || byMutation || wrapsOne) helpers.add(name);
      }
    }

    for (const h of helpers) {
      const re = new RegExp('\\b' + h.replace(/\$/g, '\\$') + '\\s*\\(', 'g'); let m;
      while ((m = re.exec(src))) {
        if (/=\s*$/.test(src.slice(Math.max(0, m.index - 3), m.index))) continue;  /* the definition */
        const call = balanced(src, m.index + m[0].length - 1, '(', ')');
        if (!call) continue;
        const args = call.slice(1, -1);
        if (/\bconst\b|=>/.test(args)) continue;
        /* which string literals sit inside an array — those, and only those, are MOVES */
        const inArr = new Set();
        { let k = 0; while (k < args.length) {
            if (args[k] === '[') { const a = balanced(args, k, '[', ']'); if (a) { for (const s of (a.match(STR) || [])) inArr.add(s); k += a.length; continue; } }
            k++; } }
        const scal = [], mv = [];
        STR.lastIndex = 0; let t;
        while ((t = STR.exec(args))) (inArr.has(t[0]) ? mv : scal).push(t[2]);
        const line = lineOf(src, m.index);
        if (!scal.length && !mv.length) {
          unpaired.push({ file: rel, line, how: h + '()', why: 'no string literal — the body is DERIVED' });
          continue;
        }
        const roles = scal.map(s => ({ s, r: roleOf(s) }));
        const species = roles.filter(x => x.r === 'species').map(x => x.s);
        if (!species.length) {
          unpaired.push({ file: rel, line, how: h + '()', why: 'no species literal in the call' });
          continue;
        }
        const item = (roles.find(x => x.r === 'item') || {}).s || '';
        const ability = (roles.find(x => x.r === 'ability') || {}).s || '';
        const unknown = roles.filter(x => x.r === 'unknown').map(x => x.s);
        /* more than one species in one call is a FILL/BENCH list: the item and ability, if any,
         * cannot be attributed to one of them, so they are not. */
        for (const sp of species) {
          sets.push({ file: rel, line, how: h + '()', species: sp,
                      item: species.length > 1 ? '' : item,
                      ability: species.length > 1 ? '' : ability,
                      moves: mv.slice(), unknown });
        }
      }
    }

    /* (C) POSITIONAL-ARRAY ROWS — `['species', ['move', ...], 'ability', 'item']`.
     *
     * ADDED 2026-08-14 (ROADMAP #266) AFTER IT HID FIVE ILLEGAL SETS INCLUDING A BANNED ITEM. A set
     * written as a row in a table is neither a helper CALL nor an object literal keyed `species:`, so
     * both matchers above walked straight past `tests/test-protocol-trace.js`'s twelve-body pool —
     * which drives 200 games — while this gate reported the tree clean. Put through the validator by
     * hand it rejected five of the twelve: three unlearnable moves, and a Toxapex holding BLACK
     * SLUDGE, an item that "does not exist in Gen 9".
     *
     * IT IS SAFE TO ADD IN THE SAME PASS AS THOSE REPAIRS PRECISELY BECAUSE THEY ARE DONE. Measured
     * first, repaired, then the matcher turned on: the population grows by twelve declarations and the
     * verdict count does not move at all, so nothing here is unattributable. Repo-wide this shape
     * occurs in ONE file — measured, not assumed.
     *
     * Conservative on purpose: the first literal must NAME ITSELF as a species (rule 1 above), the
     * second element must be an ARRAY of string literals (rule 2 — moves come from arrays only), and
     * the trailing scalars are taken in declaration order. */
    const POSROW = /\[\s*(['"])([a-z0-9-]+)\1\s*,\s*\[([^\]]*)\]\s*,\s*(['"])([^'"]*)\4\s*(?:,\s*(['"])([^'"]*)\6\s*)?[,\s]*\]/gi;
    let m4;
    POSROW.lastIndex = 0;
    while ((m4 = POSROW.exec(src))) {
      const spName = m4[2];
      const spRow = dex.species.get(spName);
      if (!(spRow && spRow.exists && spRow.id === nrm(spName))) continue;
      const mvs = (m4[3].match(STR) || []).map(x => x.slice(1, -1));
      if (!mvs.length) continue;
      const tail = [m4[5], m4[7]].filter(x => x !== undefined && x !== '');
      const roles = tail.map(s => ({ s, r: roleOf(s) }));
      sets.push({ file: rel, line: lineOf(src, m4.index), how: 'positional-row', species: spName,
                  item: (roles.find(x => x.r === 'item') || {}).s || '',
                  ability: (roles.find(x => x.r === 'ability') || {}).s || '',
                  moves: mvs, unknown: roles.filter(x => x.r === 'unknown').map(x => x.s) });
    }

    /* (B) bare object literals holding species: and moves: */
    const re3 = /\bspecies\s*:/g; let m3;
    while ((m3 = re3.exec(src))) {
      let i = m3.index, d = 0;
      for (; i >= 0; i--) { if (src[i] === '}') d++; else if (src[i] === '{') { if (d === 0) break; d--; } }
      if (i < 0) continue;
      const blk = balanced(src, i, '{', '}');
      if (!blk || !/\bmoves\s*:/.test(blk) || blk.length > 1500) continue;
      const line = lineOf(src, m3.index);
      const sp = /\bspecies\s*:\s*(['"])([^'"]*)\1/.exec(blk);
      if (!sp) { unpaired.push({ file: rel, line, how: 'object', why: 'species is not a literal — DERIVED' }); continue; }
      if (roleOf(sp[2]) !== 'species') { unpaired.push({ file: rel, line, how: 'object', why: `species literal "${sp[2]}" does not name a species in this format` }); continue; }
      const it = /\bitem\s*:\s*(['"])([^'"]*)\1/.exec(blk);
      const ab = /\bability\s*:\s*(['"])([^'"]*)\1/.exec(blk);
      const mb = /\bmoves\s*:\s*\[/.exec(blk);
      let mvs = [];
      if (mb) { const a = balanced(blk, mb.index + mb[0].length - 1, '[', ']'); if (a) mvs = strings(a); }
      sets.push({ file: rel, line, how: 'object', species: sp[2],
                  item: it ? it[2] : '', ability: ab ? ab[2] : '', moves: mvs, unknown: [] });
    }
  }
  return { files: files.length, sets, unpaired, unread };
}

/* ---- the sweep --------------------------------------------------------------------------------- */
/* A finding is keyed by the AUTHORITY'S OWN SENTENCE, lowercased. That is deliberate and matches the
 * key already chosen for data/fixture-learnset-baseline.json: the same illegal declaration moved to a
 * new scenario is the SAME defect, and a ratchet keyed on file and line would let somebody relocate
 * `Snorlax can't learn Swords Dance` (11 sites today) and call it new. What must be new is a NEW
 * SENTENCE from the validator. */
const keyOf = p => String(p).toLowerCase().replace(/\s+/g, ' ').trim();

function sweep() {
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const { files, sets, unpaired, unread } = scan(dex);
  if (unread && unread.length) {
    console.error('  fixture_legality: ' + unread.length + ' FIXTURE FILE(S) COULD NOT BE READ and were '
      + 'NOT scanned, so nothing below says they are legal: ' + unread.join('; '));
  }

  /* one verdict per distinct set; every site that declares it is carried */
  const seen = new Map();
  for (const s of sets) {
    const k = [nrm(s.species), nrm(s.item), nrm(s.ability), s.moves.map(nrm).sort().join('+')].join('|');
    if (!seen.has(k)) seen.set(k, { ...s, sites: [] });
    seen.get(k).sites.push(s.file + ':' + s.line);
  }
  const distinct = [...seen.values()];

  const findings = new Map();
  let rejected = 0;
  for (const s of distinct) {
    const v = CS.checkLegal({ species: s.species, item: s.item, ability: s.ability, moves: s.moves });
    if (v.unavailable) throw new Error('fixture_legality: ' + v.problems.join('; '));
    if (v.legal) continue;
    rejected++;
    for (const p of v.problems) {
      const k = keyOf(p);
      if (!findings.has(k)) findings.set(k, { key: k, problem: p, kind: (v.banned || []).includes(p) ? 'EXISTENCE' : 'PAIRING', sets: [], sites: new Set() });
      const f = findings.get(k);
      f.sets.push(`${s.species} @ ${s.item || '(no item)'} / ${s.ability || '(species default)'} / [${s.moves.join(', ')}]`);
      for (const site of s.sites) f.sites.add(site);
    }
  }
  const out = [...findings.values()].map(f => ({ ...f, sites: [...f.sites].sort() }))
    .sort((a, b) => (a.kind === b.kind ? a.key.localeCompare(b.key) : (a.kind === 'EXISTENCE' ? -1 : 1)));

  /* ---- THE PAIR PASS, BECAUSE THE VALIDATOR STOPS AT THE FIRST PROBLEM PER SET ------------------
   *
   * MEASURED 2026-08-14, and it had been under-reading since this file was written. `validateTeam`
   * returns ONE complaint per Pokemon: a Snorlax declared with Swords Dance, Iron Defense, U-turn and
   * Roar — FOUR moves it cannot learn — produces the single sentence "Snorlax can't learn Swords
   * Dance." Keying the ratchet on the sentence is still right (see `keyOf`), but COUNTING sentences
   * understates the defect, and worse: repairing the first illegal move in a set makes the second one
   * appear as a NEW verdict, which reads as a regression caused by the repair.
   *
   * So every declared move is also asked of `champions_sim.canLearn`, which is the validator's own
   * `checkCanLearn` — not a hand-walked learnset. The verdict sentences are unchanged and remain the
   * ratchet; `pairs` is the honest population count beside them. On the day it was added the sweep
   * reported 32 verdicts and 34 pairs.
   *
   * AND EVERY PAIR CARRIES ITS CLASS, which is what decides the SEVERITY and the repair:
   *   UNREACHABLE  nothing in this regulation can carry the entity. A fixture asserting it is testing
   *                a game nobody plays, and — the expensive part — a probe that fails on it reads as
   *                an ENGINE DEFECT when the engine is correct not to model it. Four phantom defects
   *                were filed from this shape in one session on 2026-08-14.
   *   PAIRING      the entity exists and has carriers; THIS body is not one of them. Re-aimable onto
   *                a legal carrier, which is what the repairs in ROADMAP #266 do. */
  const pairs = [];
  {
    const seenPair = new Map();
    for (const s of distinct) {
      const sp = dex.species.get(s.species);
      if (!sp.exists) continue;
      const push = (kind, entity, problem, carriers) => {
        const k = keyOf(problem);
        if (!seenPair.has(k)) {
          seenPair.set(k, { key: k, problem, kind, entity, carriers,
                            cls: carriers === 0 ? 'UNREACHABLE' : 'PAIRING', sites: new Set() });
          pairs.push(seenPair.get(k));
        }
        for (const site of s.sites) seenPair.get(k).sites.add(site);
      };
      for (const m of s.moves) {
        const mv = dex.moves.get(m);
        if (!mv.exists) continue;                       /* a stray literal — reported separately */
        if (CS.canLearn(sp.name, mv.name)) continue;
        push('move', mv.name, `${sp.name} can't learn ${mv.name}.`, CS.moveCarriers(mv.name).length);
      }
      if (s.ability) {
        const ab = dex.abilities.get(s.ability);
        const owns = Object.values(sp.abilities || {}).some(a => nrm(a) === nrm(s.ability));
        if (ab.exists && !owns) {
          push('ability', ab.name, `${sp.name} can't have ${ab.name}.`, CS.abilityCarriers(ab.name).length);
        }
      }
    }
    for (const p of pairs) p.sites = [...p.sites].sort();
    pairs.sort((a, b) => (a.cls === b.cls ? a.key.localeCompare(b.key) : (a.cls === 'UNREACHABLE' ? -1 : 1)));
  }

  const byFile = {};
  for (const s of sets) byFile[s.file] = (byFile[s.file] || 0) + 1;

  /* A LITERAL THAT NAMES NOTHING, WHICH THE VALIDATOR CANNOT REPORT AND WHICH IS ITS OWN DEFECT.
   * tests/test-protocol-trace.js:131 gives Politoed the item `'dampro'`. There is no such item, so
   * `checkLegal` is handed no item at all and answers about a Politoed holding nothing — the set is
   * legal and the fixture is still wrong, silently, in exactly the shape CLAUDE.md calls "a capability
   * was absent and everything reported success". Reported separately because it is a different fault
   * from an illegal set: nobody is accused of an illegal pairing, the string simply means nothing. */
  const strays = new Map();
  for (const s of sets) {
    for (const u of (s.unknown || [])) {
      const k = nrm(u);
      if (!strays.has(k)) strays.set(k, { literal: u, sites: new Set() });
      strays.get(k).sites.add(s.file + ':' + s.line);
    }
  }
  const unknownLiterals = [...strays.values()].map(x => ({ literal: x.literal, sites: [...x.sites].sort() }));

  return {
    unknownLiterals,
    format: CS.FORMAT,
    filesScanned: files,
    declarations: sets.length,
    distinctSets: distinct.length,
    rejectedSets: rejected,
    findings: out,
    pairs,
    unreachable: pairs.filter(p => p.cls === 'UNREACHABLE'),
    byFile,
    notStaticallyPaired: unpaired.length,
  };
}

module.exports = { sweep, scan, keyOf };

/* ---- CLI --------------------------------------------------------------------------------------- */
if (require.main === module) {
  const r = sweep();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`FIXTURE LEGALITY — every declared set through TeamValidator (${r.format})\n`);
  console.log(`  ${r.filesScanned} .js files scanned`);
  console.log(`  ${r.declarations} set declarations, ${r.distinctSets} distinct sets`);
  console.log(`  ${r.rejectedSets} distinct sets REJECTED, producing ${r.findings.length} distinct verdicts`);
  console.log(`  ${r.pairs.length} distinct illegal DECLARATIONS behind those verdicts `
    + `(${r.unreachable.length} of them UNREACHABLE — no legal carrier anywhere in the regulation)`);
  console.log(`  ${r.notStaticallyPaired} construction sites carry no literal set and are NOT in this population\n`);
  console.log('DECLARATIONS BY FILE');
  for (const k of Object.keys(r.byFile).sort((a, b) => r.byFile[b] - r.byFile[a])) {
    console.log(`  ${String(r.byFile[k]).padStart(4)}  ${k}`);
  }
  if (r.unknownLiterals.length) {
    console.log('\nSTRING LITERALS INSIDE A SET DECLARATION THAT NAME NOTHING IN THIS FORMAT');
    for (const u of r.unknownLiterals) console.log(`  "${u.literal}"   ${u.sites.join(', ')}`);
  }
  if (r.unreachable.length) {
    console.log('\nUNREACHABLE — NOTHING IN THIS REGULATION CAN CARRY THESE, so a probe that asserts');
    console.log('them is measuring a game nobody plays and its failure is NOT an engine defect:');
    for (const p of r.unreachable) console.log(`  [${p.kind}] ${p.problem}   ${p.sites.join(', ')}`);
  }
  console.log('\nTHE AUTHORITY\'S VERDICTS');
  for (const f of r.findings) {
    console.log(`\n  [${f.kind}] ${f.problem}`);
    for (const s of [...new Set(f.sets)]) console.log(`      set:  ${s}`);
    console.log(`      sites: ${f.sites.join(', ')}`);
  }
}
