/* web/build-quarantine.js — THE WITHHOLDING THE CITATION CHECKER CANNOT SEE.
 *
 *   node web/build-quarantine.js          write web/quarantine-data.js and restamp web/stadium.html
 *   node web/build-quarantine.js --check  build in memory and diff against what is committed
 *
 * WHY THIS EXISTS
 * ---------------
 * Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
 * should stop referencing them until medicham is up to date and we can rerun them."
 *
 * `engine/quarantine.js`'s `citations()` walks docs/, web/ and app/ looking for a quarantined
 * artifact's VERDICT SENTENCE. That finds a page that QUOTES a withheld number. It structurally
 * cannot find the larger class:
 *
 *   web/index.html      <script src="../data/mag.js">   <script src="../data/mew.js">
 *   web/replay.html     <script src="../data/mew.js">
 *   web/scoreboard.html <script src="../data/scoreboard.js">
 *
 * All three of those files are in the withheld set. The pages do not quote a sentence out of them —
 * they LOAD them and draw the whole room from the object. Nothing in a verdict-string grep can see
 * that, and `tests/test-web-quarantine-loaders.js` is the probe that can.
 *
 * WHAT THIS FILE EMITS, AND WHY IT IS ONE FILE FOR FIVE PAGES
 * ----------------------------------------------------------
 * `web/quarantine-data.js` sets `window.ABRA_QUARANTINE`, carrying
 *
 *   - the GATE: whether MEDICHAM is correct, clause by clause, with each clause's magnitude;
 *   - `held`: every quarantined artifact -> why it is downstream, which clauses fail, what re-runs it;
 *   - `R`: the RELEASED figures, keyed, and **emitted only when their artifact is not withheld**.
 *
 * `R` is the half that makes the quarantine reversible. A page that has been stripped of a number can
 * never show it again, which `tests/test-web-quarantine.js` already argues is exactly as broken as a
 * page showing a stale one. So the numbers live in `web/quarantine-release.json` — HARVESTED out of
 * the page by script, never retyped — and this builder decides, per artifact, whether to put them
 * back on the page. Gate closed: the key is absent and the page renders a plate. Gate open: the key
 * is present and the page renders exactly what it rendered before the quarantine.
 *
 * THE WITHHOLDER IS AN ARGUMENT, NOT A FLAG. `buildQuarantine(withhold, gate)` takes the same
 * `quarantine.withholder(gate, rows)` function `web/build-status.js` takes, for the same reason:
 * anything that can silence a quarantine from the command line eventually does. The test drives this
 * exact shipping function twice over one classification and changes only the gate.
 *
 * IT DOES NOT REQUIRE web/build-status.js. That module runs `node engine/status.js` at require time,
 * which takes over two minutes; a builder and a test that both paid it would not get run.
 *
 * THE STADIUM IS STAMPED IN PLACE, AND THAT IS NOT A STYLE CHOICE.
 * `web/stadium.html` must stay publishable as a claude.ai artifact, where a sibling `<script src>` is
 * blocked exactly like a remote one (docs/WEB.md). So the same generated block is written INTO the
 * page between two markers, and `--check` fails if the committed copy has drifted from what this
 * would emit now — the same relation `tests/test-web-status.js` holds over `web/status-data.js`.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const QUARANTINE = require('../engine/quarantine.js');

const OUT = D('web', 'quarantine-data.js');
const STADIUM = D('web', 'stadium.html');
const BEGIN = '/* ==== BEGIN GENERATED QUARANTINE BLOCK — web/build-quarantine.js ==== */';
const END = '/* ==== END GENERATED QUARANTINE BLOCK ==== */';

/* ================================================================================================
 * THE SHARED RUNTIME. One implementation of "may this page show this artifact", because five pages
 * asking the question separately is CLAUDE.md's FACTS ARE GLOBAL failure waiting to happen — two of
 * them would disagree eventually and the disagreement would be invisible.
 *
 * It is emitted as text rather than kept in a hand-written sibling file so that the Stadium, which
 * cannot load a sibling file at all, gets the identical code rather than a second copy of it.
 * ============================================================================================== */
const RUNTIME = `
  /* ---- the one question every page asks ------------------------------------------------------
     Returns null when the figure may be shown, and the reason record when it may not. It answers
     "no" whenever the gate is OPEN, so a page needs no second branch for the healthy case. */
  Q.heldFor = function (p) {
    if (Q.open !== false) return null;
    var k = String(p).replace(/^\\.\\.\\//, '');
    if (k.indexOf('data/') !== 0) k = 'data/' + k;
    return Q.held[k] || null;
  };
  /* A RELEASED figure. Absent while its artifact is withheld — the key is not in the payload at all,
     so a page cannot accidentally read a stale value out of it. */
  Q.rel = function (k) { return (Q.R && Q.R[k]) || null; };

  Q.esc = function (s) { return String(s).replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };

  /* ---- THE PLATE. Full visual weight, never a footnote. --------------------------------------
     docs/WEB.md: a missing measurement is rendered at the same weight as a real one, and
     engine/quarantine.js: "a caption is not a quarantine". This is the caption's replacement — the
     number is gone and its whole space is given to why it is gone and what brings it back. */
  Q.plate = function (p, o) {
    var h = Q.heldFor(p); if (!h) return '';
    o = o || {};
    var dark = o.theme === 'dark';
    var bg = dark ? '#2a0f0c' : '#fff5f3', fg = dark ? '#ffe2dc' : '#5b2a20',
        line = dark ? '#ff6b57' : '#ff6b57', hd = dark ? '#ff9c8f' : '#c0432f';
    return '<div class="qplate" data-q="' + Q.esc(h.file) + '" role="note" style="background:' + bg +
      ';border:2px solid ' + line + ';border-left:7px solid ' + line + ';border-radius:12px;padding:14px 16px;margin:12px 0;color:' + fg + '">' +
      '<div style="font-size:11px;letter-spacing:.14em;font-weight:800;color:' + hd + '">QUARANTINED — THE FIGURE IS WITHHELD, NOT ANNOTATED</div>' +
      (o.subject ? '<div style="font-size:15px;font-weight:800;margin-top:6px">' + Q.esc(o.subject) + '</div>' : '') +
      '<p style="margin:8px 0 0;font-size:12.5px;line-height:1.6;max-width:70ch"><b>' + Q.esc(h.file) + '</b> is downstream of ' +
        Q.esc(Q.simulator) + ' — ' + Q.esc(h.because) + '.</p>' +
      '<p style="margin:6px 0 0;font-size:12.5px;line-height:1.6;max-width:70ch">' + Q.esc(h.clause) + '. ' +
        'A quarantined number does not become true when MEDICHAM becomes correct; it becomes re-runnable.</p>' +
      (h.rerun ? '<p style="margin:6px 0 0;font-size:12.5px">Re-run it: <code style="background:' + (dark ? '#120504' : '#20344a') +
        ';color:#e6ecf8;padding:2px 7px;border-radius:5px">' + Q.esc(h.rerun) + '</code></p>' : '') +
      '<p style="margin:8px 0 0;font-size:11.5px;opacity:.8;max-width:70ch">Derivation: <code>' + Q.esc(Q.derivation) +
        '</code>. Nothing here is a list somebody maintains — the withheld set falls out of one root.</p>' +
      '</div>';
  };

  /* ---- THE CHIP. What a withheld figure looks like INSIDE a sentence. ------------------------- */
  Q.chip = function (p) {
    var h = Q.heldFor(p); if (!h) return '';
    return '<span class="qchip" data-q="' + Q.esc(h.file) + '" title="' + Q.esc(h.file + ' — ' + h.because + '. ' + h.clause) +
      '" style="display:inline-block;background:#ff6b57;color:#fff;font-weight:800;font-size:11px;letter-spacing:.08em;' +
      'padding:1px 7px;border-radius:5px;white-space:nowrap">QUARANTINED</span>';
  };
`;

/* ================================================================================================
 * BUILD
 * ============================================================================================== */
function buildQuarantine(withhold, gate, rows, release) {
  release = release || JSON.parse(fs.readFileSync(D('web', 'quarantine-release.json'), 'utf8'));

  const held = {};
  if (rows) {
    for (const r of rows.values()) {
      if (!r.quarantined) continue;
      const w = withhold ? withhold('data/' + r.file) : null;
      if (!w) continue;          /* gate open — nothing is withheld, and `held` stays empty */
      held['data/' + r.file] = { file: w.file, because: w.because, rerun: w.rerun, clause: w.clause };
    }
  }

  /* THE RELEASED SET, DECIDED PER ARTIFACT. An entry is emitted only when its own source is not
     withheld, so a page can carry a figure from a clean artifact beside a hole from a dirty one. */
  const R = {};
  const withheldKeys = [];
  /* THE SOURCE MAP IS EMITTED IN BOTH DIRECTIONS, and that is deliberate. Naming the artifact a
     figure came from is not publishing the figure, and a page needs the name while the figure is
     gone — it is what the plate cites, what the re-run command hangs off, and how a cabinet knows it
     is the one being withheld. Only `R` is gated. */
  const sources = {};
  for (const e of release.entries) {
    sources[e.key] = e.src;
    if (withhold && withhold(e.src)) { withheldKeys.push(e.key); continue; }
    R[e.key] = e.value;
  }

  return {
    generated: new Date().toISOString(),
    by: 'web/build-quarantine.js',
    simulator: QUARANTINE.SIMULATOR,
    open: gate ? !!gate.ok : null,
    /* A CLAUSE CARRIES ITS MAGNITUDE AND ITS SOURCE ON ONE LINE. The magnitude is not optional —
       engine/quarantine.js: "a gate whose distance cannot be seen is a gate that gets argued with" —
       and a magnitude is a figure, so it needs the artifact it was read out of beside it or
       web/figure-audit.js scores it untraced, correctly. `read_from` is the file the clause reader
       opens: rosterStage() returns it, and differentialClause() names data/engine-diff.json in its
       own error path. Nothing here is computed; the numbers inside `why` are quarantine.js's own. */
    clauses: gate ? gate.clauses.map(c => ({
      name: c.name, ok: !!c.ok,
      why: String(c.why || '').replace(/\s+/g, ' ')
        /* THE CITATION GOES INSIDE THE SENTENCE, not into a sibling field, because
           web/figure-audit.js attributes a figure to the STRING a reader sees and a `read_from` key
           two characters away is not in it. It is also better for the reader: the clause now says
           which artifact it was read out of, which is the first thing anyone asks of a failing gate. */
        + ' [read from ' + (c.file || (c.name === 'game differential' ? 'data/engine-diff.json' : 'engine/quarantine.js')) + ']',
    })) : [],
    failing: gate ? gate.failing.map(c => c.name) : [],
    n_quarantined: rows ? [...rows.values()].filter(r => r.quarantined).length : null,
    n_artifacts: rows ? rows.size : null,
    rule: 'CLAUDE.md — EVERYTHING DOWNSTREAM OF MEDICHAM IS WITHHELD UNTIL MEDICHAM IS CORRECT. '
        + 'Will, 2026-08-08: "all engines that take medicham\'s output should be regarded as out of '
        + 'date and we should stop referencing them until medicham is up to date and we can rerun them."',
    derivation: 'node engine/quarantine.js --graph',
    held,
    sources,
    withheld_keys: withheldKeys.sort(),
    R,
  };
}

function emit(payload) {
  const banner =
    '/* web/quarantine-data.js — GENERATED by web/build-quarantine.js. Do not hand-edit.\n' +
    ' *\n' +
    ' * Sets window.ABRA_QUARANTINE. Loaded by web/index.html, web/replay.html, web/scoreboard.html and\n' +
    ' * web/models.html; the identical block is stamped INTO web/stadium.html, which must stay\n' +
    ' * self-contained because a claude.ai artifact blocks a sibling <script src> exactly like a remote\n' +
    ' * one.\n' +
    ' *\n' +
    ' * `held` is every artifact downstream of ' + payload.simulator + '. `R` is the figures that have been\n' +
    ' * RELEASED — a key is absent while its artifact is withheld, so a page cannot read a stale value\n' +
    ' * out of this file. Nothing in here was computed, rounded or averaged by the WEB division:\n' +
    ' * membership comes from engine/quarantine.js and the values come from web/quarantine-release.json,\n' +
    ' * which was harvested out of the pages by script.\n' +
    ' *\n' +
    ' * Regenerate:  node web/build-quarantine.js\n' +
    ' */\n';
  /* EACH CLAUSE ON ONE LINE, so its magnitude and its `read_from` share a source line. That is
     docs/WEB.md's own rule — "keep a model's figures and its citation on ONE source line" — applied
     to the block this builder emits, and it is what makes web/figure-audit.js agree with a human
     reading the file instead of scoring four gate magnitudes as uncited. */
  const flat = { ...payload, clauses: '@@CLAUSES@@' };
  const body = JSON.stringify(flat, null, 2).replace('"@@CLAUSES@@"',
    '[\n' + payload.clauses.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]');
  return banner + '(function (root) {\n  var Q = ' +
    body.split('\n').join('\n  ') + ';\n' +
    RUNTIME +
    '\n  root.ABRA_QUARANTINE = Q;\n})(typeof window !== \'undefined\' ? window : this);\n';
}

/* The Stadium gets the same text, indented into its inline <script> and assigning the same global. */
function stadiumBlock(text) {
  return BEGIN + '\n' + text.replace(/^\/\*[\s\S]*?\*\/\n/, '') + END;
}

function stampStadium(html, text) {
  const i = html.indexOf(BEGIN), j = html.indexOf(END);
  if (i < 0 || j < 0) return null;
  return html.slice(0, i) + stadiumBlock(text) + html.slice(j + END.length);
}

module.exports = { buildQuarantine, emit, stampStadium, RUNTIME, BEGIN, END, OUT, STADIUM };

/* ================================================================================================
 * CLI
 * ============================================================================================== */
if (require.main === module) {
  const check = process.argv.includes('--check');
  const cls = QUARANTINE.classify();
  if (cls.error) {
    console.log('QUARANTINE BUILD FAILED — the artifact graph could not be read: ' + cls.error);
    console.log('Nothing is written. A stale web/quarantine-data.js is caught by');
    console.log('tests/test-web-quarantine-loaders.js, which rebuilds and diffs.');
    process.exit(1);
  }
  const gate = QUARANTINE.medichamIsCorrect();
  const withhold = QUARANTINE.withholder(gate, cls.rows);
  const payload = buildQuarantine(withhold, gate, cls.rows);
  const text = emit(payload);

  const stamp = (a, b) => a.replace(/"generated": "[^"]*"/, '"generated": "X"') ===
                          b.replace(/"generated": "[^"]*"/, '"generated": "X"');

  let bad = 0;
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (check) {
    if (!stamp(cur, text)) { console.log('DRIFT: web/quarantine-data.js is not what this builder emits now.'); bad++; }
  } else {
    fs.writeFileSync(OUT, text);
    console.log('wrote web/quarantine-data.js');
  }

  const html = fs.readFileSync(STADIUM, 'utf8');
  const next = stampStadium(html, text);
  if (next === null) {
    console.log('web/stadium.html carries no generated quarantine block — add the two markers:');
    console.log('  ' + BEGIN);
    console.log('  ' + END);
    bad++;
  } else if (check) {
    if (!stamp(html, next)) { console.log('DRIFT: web/stadium.html\'s inline quarantine block is stale.'); bad++; }
  } else if (next !== html) {
    fs.writeFileSync(STADIUM, next);
    console.log('restamped web/stadium.html');
  }

  console.log('  gate: ' + (payload.open ? 'OPEN' : 'CLOSED — ' + payload.failing.length + ' of ' + payload.clauses.length + ' clauses fail'));
  console.log('  ' + Object.keys(payload.held).length + ' artifact(s) withheld; '
    + payload.withheld_keys.length + ' of ' + (payload.withheld_keys.length + Object.keys(payload.R).length)
    + ' page figure(s) held back');
  if (bad) console.log('\n' + bad + ' drift(s). Run: node web/build-quarantine.js');
  process.exit(bad ? 1 : 0);
}
