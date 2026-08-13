/* divergence_cards.js — RENDER DIVERGING GAMES SO A PERSON CAN READ THEM.
 *
 *   node engine/divergence_cards.js                     # data/divergence-turns.json -> divergences.html
 *   node engine/divergence_cards.js --in X --out Y
 *
 * ================= WHY THIS EXISTS =================================================================
 *
 * Will, on the first attempt: *"dont do it with a bunch of illegible text like you did before"*. On the
 * second: *"p1a is hard to read"*, *"can you make clear the health an stuff"*, *"make it clear like you
 * did for the last one with the moves and megas"*. Then: *"keep this a template so we can easily use it
 * in the future if need be"* — which is why it lives here rather than in a scratch directory.
 *
 * Raw protocol is unreadable at review speed. `|-damage|p1a: Corviknight|162/173` carries a SLOT CODE
 * instead of a side, a bare fraction instead of a health bar, and an event name instead of a verb. A
 * reviewer asked to find a rule defect across sixty of those spends the attention on decoding rather
 * than on the mechanic — which is this project's recurring failure in another costume: the information
 * was present and nobody could act on it.
 *
 * ================= WHAT IT FIXES, EACH FROM A SPECIFIC COMPLAINT ===================================
 *
 *   SLOT CODES      p1a -> the species name, coloured by side. The slot is not the identity.
 *   HEALTH          162/173 -> a bar, the fraction and a percent. A status suffix is KEPT and
 *                   highlighted, because `49/170 brn` and `49/170` are different boards.
 *   EVENTS          -unboost -> "lowers". A verb table, not a protocol dump.
 *   MEGAS           -mega / detailschange / -formechange get their own highlight. They rendered as raw
 *                   protocol the first time and Will asked "why arent the mons mega evolving".
 *   THE TURN        sixteen lines of lead-in rather than four. Four loses the `|move|` that caused the
 *                   split, so a reader sees a consequence with its cause cropped off.
 *   THE [from] TAG  kept and emphasised. Dropping it made two cards render identically, and Will said
 *                   "i see no change for 7, there is no difference" — there was one; it had been stripped.
 *
 * ================= WHAT IT IS NOT =================================================================
 *
 * A debugging VIEW, never a measurement. It reads the dump and computes nothing: every number on the
 * page came out of `game_differential.js`. Do NOT add an aggregate here — a figure whose only home is a
 * rendering is a figure no gate can check, which is the shape this repo has been burned by repeatedly.
 *
 * The dump it reads is produced by:
 *   node engine/game_differential.js --games N --team-store data/team-pool-frozen \
 *        --dump-games 60 --dump-out data/divergence-turns.json --write
 *
 * `--dump-games` takes a COUNT, not a bare flag, and the dump only writes ALONGSIDE `--write`. Both of
 * those cost a wasted run, and both times the stale file on disk was read as the fresh result.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const arg = (f, dflt) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : dflt; };
const IN = arg('--in', path.join(__dirname, '..', 'data', 'divergence-turns.json'));
const OUT = arg('--out', path.join(__dirname, '..', 'divergences.html'));
const d = JSON.parse(fs.readFileSync(IN, 'utf8'));
const all = (d.divergences || []);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* WILL: "p1a is hard to read" and "can you make clear the health an stuff".
 * A slot code is not a name and `140/170` is not a health bar. Every line is parsed into a shape a
 * person reads: WHO (side + species), WHAT (the event, in words), and HOW MUCH (a bar + percent). */
const SIDE = { p1: 'yours', p2: 'theirs' };
function who(tok) {
  const m = /^(p[12])([ab]):?\s*(.*)$/.exec(String(tok || '').trim());
  if (!m) return null;
  const name = (m[3] || '').trim() || m[1] + m[2];
  return { side: m[1], slot: m[2], name, label: name };
}
function hp(tok) {
  const m = /^(\d+)\s*\/\s*(\d+)(.*)$/.exec(String(tok || '').trim());
  if (!m) return null;
  const cur = +m[1], max = +m[2];
  return { cur, max, pct: max ? Math.round(cur / max * 100) : 0, tail: (m[3] || '').trim() };
}
/* the event, said in words rather than in protocol */
const VERB = {
  move: 'uses', switch: 'sends in', drag: 'is dragged in', faint: 'faints',
  '-damage': 'drops to', '-heal': 'heals to', '-sethp': 'is set to',
  '-status': 'is', '-curestatus': 'is cured of', '-immune': 'is IMMUNE', '-miss': 'misses',
  '-fail': 'fails', '-crit': 'critical hit', '-resisted': 'resists', '-supereffective': "it's super effective",
  '-boost': 'raises', '-unboost': 'lowers', '-start': 'gains', '-end': 'loses',
  '-singleturn': 'braces with', '-activate': 'triggers', '-enditem': 'uses up',
  '-item': 'reveals', '-ability': 'reveals', '-weather': 'weather', '-fieldstart': 'field',
  '-fieldend': 'field ends', '-sidestart': 'side', '-sideend': 'side ends',
  '-mega': 'MEGA EVOLVES', detailschange: 'becomes', '-formechange': 'becomes',
  '-hitcount': 'hits', '-prepare': 'charges', '-transform': 'transforms into',
  cant: "can't move", upkeep: 'end of turn', turn: 'turn',
};

/* WHO WAS IN THAT SLOT BEFORE — WILL, 2026-08-13: *"and include the clear switch ins"*.
 *
 * A bare `sends in Greninja` hides the half that matters. Which body LEFT decides whether the switch
 * was a pivot, a forced replacement after a faint, or a lead arriving — and those read identically in
 * the protocol. The occupant table is rebuilt per card by walking the lead-in in order, so it reflects
 * that card's own history rather than a global guess. */
const occupant = {};
function resetSlots() { for (const k of Object.keys(occupant)) delete occupant[k]; }
function noteSlot(f) {
  const ev = f[0];
  if (ev !== 'switch' && ev !== 'drag' && ev !== 'replace') return null;
  const w = who(f[1]);
  if (!w) return null;
  const key = w.side + w.slot;
  const left = occupant[key] || null;
  occupant[key] = w.name;
  return left;
}

function renderLine(line) {
  const raw = String(line || '').replace(/^\|/, '');
  if (!raw.trim()) return '';
  const f = raw.split('|').map(x => x.trim());
  const ev = f[0];
  const leaving = noteSlot(f);
  const isMega = ev === '-mega' || ev === 'detailschange' || ev === '-formechange';
  const parts = [];
  const subject = who(f[1]);
  if (subject) parts.push('<span class="mon ' + subject.side + '">' + esc(subject.label) + '</span>');
  parts.push('<span class="verb' + (isMega ? ' mega' : '') + '">' + esc(VERB[ev] || ev) + '</span>');
  if (leaving) parts.push('<span class="swap">replacing <b>' + esc(leaving) + '</b></span>');

  for (let i = subject ? 2 : 1; i < f.length; i++) {
    const t = f[i];
    if (!t) continue;
    const h = hp(t);
    if (h) {
      parts.push('<span class="hp"><span class="bar"><span style="width:' + h.pct + '%"></span></span>'
        + '<span class="num">' + h.cur + '/' + h.max + '</span>'
        + '<span class="pct">' + h.pct + '%</span>'
        + (h.tail ? '<span class="tail">' + esc(h.tail) + '</span>' : '') + '</span>');
      continue;
    }
    const w = who(t);
    if (w) { parts.push('<span class="arrow">→</span><span class="mon ' + w.side + '">' + esc(w.label) + '</span>'); continue; }
    if (/^\[from\]/.test(t)) { parts.push('<span class="from">from ' + esc(t.replace(/^\[from\]\s*/, '')) + '</span>'); continue; }
    if (/^\[of\]/.test(t)) continue;
    if (/^\[/.test(t)) { parts.push('<span class="from">' + esc(t.replace(/[\[\]]/g, '')) + '</span>'); continue; }
    parts.push('<span class="fld">' + esc(t) + '</span>');
  }
  return '<div class="line' + (isMega ? ' is-mega' : '') + '">' + parts.join(' ') + '</div>';
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const armTally = {}; for (const x of all) if (x.arm) armTally[x.arm] = (armTally[x.arm] || 0) + 1;
const ARMS_PRESENT = Object.keys(armTally).sort();
const TOTAL_DIVERGED = d.of_diverged || all.length;
const ARM_LINE = ARMS_PRESENT.length > 1 ? ', drawn evenly from both pinned corners' : '';
/* THE RATE IS THE ARTIFACT'S, NOT THIS FILE'S. `diverged_in_arm` is the population each corner
 * actually produced; the dump is a sample of it and must never be mistaken for it. */
const RATE_LINE = (() => {
  const by = (d.arms_in_dump && d.arms_in_dump.diverged_in_arm) || null;
  if (!by) return esc(TOTAL_DIVERGED + ' diverging games');
  return Object.keys(by).sort().map(k => esc(k + ' ' + by[k])).join(' &nbsp;·&nbsp; ') + ' diverged';
})();
const classes = [...new Set(all.map(x => x.cls || 'unclassified'))].sort();
const tally = {}; for (const x of all) tally[x.cls || 'unclassified'] = (tally[x.cls || 'unclassified'] || 0) + 1;

const cards = all.map((g, i) => {
  resetSlots();
  const lead = (g.before_raw && g.before_raw.length ? g.before_raw : g.before) || [];
  const sdAfter = ((g.after && g.after.showdown) || []).slice(1);
  const meAfter = ((g.after && g.after.medicham) || []).slice(1);
  const nothing = '<div class="line none">— nothing further —</div>';
  return `
  <article class="card" data-cls="${esc(slug(g.cls || 'unclassified'))}" data-arm="${esc(slug(g.arm || ''))}">
    <header class="card-h">
      <span class="num">${i + 1}</span>
      <span class="chip">${esc(g.cls || 'unclassified')}</span>
      <span class="arm arm-${esc(String(g.arm || '').replace(/[^a-z0-9]+/gi, '-'))}">${esc(g.arm || '')}</span>
      ${g.end_reason && g.end_reason !== 'the first divergent LINE'
        ? `<span class="why">${esc(g.end_reason)}</span>` : ''}
      <span class="agreed">agreed for ${g.agreed_lines} lines</span>
    </header>
    ${lead.length ? `<div class="both"><div class="lbl">the turn so far — both engines identical</div>
      ${lead.map(renderLine).join('')}</div>` : ''}
    <div class="split">
      <div class="side sd"><div class="lbl">Showdown</div>
        ${renderLine(g.at && g.at.showdown_raw) || nothing}
        ${sdAfter.length ? `<div class="then">${sdAfter.map(renderLine).join('')}</div>` : ''}</div>
      <div class="side me"><div class="lbl">ours</div>
        ${renderLine(g.at && g.at.medicham_raw) || nothing}
        ${meAfter.length ? `<div class="then">${meAfter.map(renderLine).join('')}</div>` : ''}</div>
    </div>
  </article>`;
}).join('');

const html = `<title>Where MEDICHAM and Showdown part</title>
<style>
:root{--ink:#0f1319;--ink-2:#3d4757;--muted:#7c8798;--paper:#f5f6f8;--card:#fff;
 --rule:#dde1e7;--rule-2:#eceff3;--sd:#26557f;--sd-bg:#eaf1f8;--me:#a8481a;--me-bg:#fdf0e8;
 --chip:#e8ebf0;--yours:#2f6f4f;--theirs:#7a3b6d;--bar:#cfd6de;--bar-f:#5b6b7f;--mega:#8a5a12;--mega-bg:#fbf1dc}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#e6eaf0;--ink-2:#aab4c2;--muted:#78838f;
 --paper:#0d1116;--card:#141a21;--rule:#242c36;--rule-2:#1b222a;--sd:#7db4e8;--sd-bg:#132231;
 --me:#e79a6b;--me-bg:#2a1a11;--chip:#1e262f;--yours:#6bc79a;--theirs:#d093c4;--bar:#2a333e;--bar-f:#8b9bad;
 --mega:#e0b25c;--mega-bg:#2b2313}}
:root[data-theme="dark"]{--ink:#e6eaf0;--ink-2:#aab4c2;--muted:#78838f;--paper:#0d1116;--card:#141a21;
 --rule:#242c36;--rule-2:#1b222a;--sd:#7db4e8;--sd-bg:#132231;--me:#e79a6b;--me-bg:#2a1a11;--chip:#1e262f;
 --yours:#6bc79a;--theirs:#d093c4;--bar:#2a333e;--bar-f:#8b9bad;--mega:#e0b25c;--mega-bg:#2b2313}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
 font:15px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:40px 24px 96px}
h1{font-size:clamp(24px,3.4vw,34px);margin:0 0 6px;letter-spacing:-.02em;text-wrap:balance}
.sub{color:var(--ink-2);margin:0 0 4px;max-width:66ch}
.meta{color:var(--muted);font-size:13px;margin:0 0 26px;font-variant-numeric:tabular-nums;
 font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.key{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 22px;font-size:12.5px;color:var(--ink-2)}
.key b{font-weight:600}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;padding:0;list-style:none}
.legend.arms{margin:0 0 26px}
.legend.arms button{border-style:dashed}
.legend button{font:inherit;font-size:12.5px;cursor:pointer;border:1px solid var(--rule);background:var(--card);
 color:var(--ink-2);border-radius:999px;padding:5px 11px;display:inline-flex;gap:7px;align-items:center}
.legend button[aria-pressed="true"]{border-color:var(--ink-2);color:var(--ink);background:var(--chip)}
.legend button:focus-visible{outline:2px solid var(--sd);outline-offset:2px}
.legend .n{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted);font-size:11.5px}
.cards{display:flex;flex-direction:column;gap:18px}
.card{background:var(--card);border:1px solid var(--rule);border-radius:10px;overflow:hidden}
.card[hidden]{display:none}
.card-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--rule-2)}
.card-h .num{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted);font-size:12px;min-width:1.6em}
.chip{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--chip);color:var(--ink-2)}
.agreed{margin-left:auto;color:var(--muted);font-size:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.both{padding:12px 16px;border-bottom:1px solid var(--rule-2)}
.lbl{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.split{display:grid;grid-template-columns:1fr 1fr}
@media(max-width:800px){.split{grid-template-columns:1fr}}
.side{padding:14px 16px;min-width:0;overflow-x:auto}
.side.sd{background:var(--sd-bg);border-right:1px solid var(--rule-2)}
.side.me{background:var(--me-bg)}
@media(max-width:800px){.side.sd{border-right:0;border-bottom:1px solid var(--rule-2)}}
.side.sd .lbl{color:var(--sd)}.side.me .lbl{color:var(--me)}
.line{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:3px 0;font-size:13.5px;line-height:1.6}
.both .line{opacity:.72}
.then{margin-top:8px;padding-top:8px;border-top:1px dashed var(--rule);opacity:.72}
.line.is-mega{background:var(--mega-bg);border-radius:6px;padding:4px 8px;margin:2px -8px}
.mon{font-weight:600}
.mon.p1{color:var(--yours)}.mon.p2{color:var(--theirs)}
.verb{color:var(--ink-2)}
.verb.mega{color:var(--mega);font-weight:700;letter-spacing:.02em}
.arrow{color:var(--muted)}
.fld{color:var(--ink);font-weight:500}
.from{color:var(--muted);font-style:italic;font-size:12.5px}
/* only shown when the game stopped for a reason OTHER than the split itself — a card that ended
 * because one engine went quiet is a different kind of evidence from one that ended on a mismatch,
 * and without the label the two are indistinguishable on the page. */
.why{font-size:11.5px;color:var(--me);border:1px solid var(--me);border-radius:999px;padding:2px 8px}
.swap{color:var(--muted);font-size:12.5px}
.swap b{color:var(--ink-2);font-weight:600}
.arm{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--rule);color:var(--muted);white-space:nowrap}
.arm-bottom-tie-first{border-color:var(--me);color:var(--me)}
.arm-top-tie-first{border-color:var(--sd);color:var(--sd)}
.none{color:var(--muted);font-style:italic}
.hp{display:inline-flex;align-items:center;gap:7px}
.bar{width:64px;height:7px;border-radius:4px;background:var(--bar);overflow:hidden;display:inline-block}
.bar>span{display:block;height:100%;background:var(--bar-f)}
.hp .num{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums;
 font-size:12px;color:var(--ink-2)}
.hp .pct{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;color:var(--muted)}
.hp .tail{font-size:11.5px;color:var(--me);font-weight:600;text-transform:uppercase}
footer.foot{margin-top:44px;padding-top:18px;border-top:1px solid var(--rule);color:var(--muted);
 font-size:12.5px;max-width:70ch}
</style>
<div class="wrap">
  <h1>Where MEDICHAM and Showdown part</h1>
  <p class="sub">${all.length} diverging games out of ${TOTAL_DIVERGED}${ARM_LINE}. Every die is pinned identically on both sides, so each
  of these is a <strong>rule the two engines disagree about</strong>. The turn so far is shown greyed;
  the two coloured panels are the moment they split.</p>
  <p class="meta">${esc(d.generated || '')} &nbsp;·&nbsp; ${esc(d.engine_release || '')} &nbsp;·&nbsp; ${RATE_LINE} &nbsp;·&nbsp; frozen team pool</p>
  <div class="key">
    <span><b class="mon p1" style="color:var(--yours)">green</b> = p1's side</span>
    <span><b class="mon p2" style="color:var(--theirs)">purple</b> = p2's side</span>
    <span><b style="color:var(--mega)">highlighted</b> = mega evolution</span>
    <span>bars show HP remaining</span>
  </div>
  <ul class="legend">
    <li><button type="button" data-f="all" aria-pressed="true">all <span class="n">${all.length}</span></button></li>
    ${classes.map(c => `<li><button type="button" data-f="${esc(slug(c))}" aria-pressed="false">${esc(c)} <span class="n">${tally[c]}</span></button></li>`).join('')}
  </ul>
  <ul class="legend arms">
    <li><button type="button" data-a="all" aria-pressed="true">both corners <span class="n">${all.length}</span></button></li>
    ${ARMS_PRESENT.map(a => `<li><button type="button" data-a="${esc(slug(a))}" aria-pressed="false">${esc(a)} <span class="n">${armTally[a]}</span></button></li>`).join('')}
  </ul>
  <div class="cards">${cards}</div>
  <footer class="foot">Read the two coloured panels first — everything above them is agreement. If the
  two sides describe the same board in different words, that's narration. If they describe different
  boards, that's a defect.</footer>
</div>
<script>
(function(){
 var c=[].slice.call(document.querySelectorAll('.card')), cls='all', arm='all';
 function apply(){c.forEach(function(k){
   k.hidden=(cls!=='all'&&k.getAttribute('data-cls')!==cls)||(arm!=='all'&&k.getAttribute('data-arm')!==arm);
 });}
 function group(sel,attr,set){var b=[].slice.call(document.querySelectorAll(sel));
  b.forEach(function(x){x.addEventListener('click',function(){
    b.forEach(function(o){o.setAttribute('aria-pressed',String(o===x))});
    set(x.getAttribute(attr)); apply();
  })});}
 group('.legend:not(.arms) button','data-f',function(v){cls=v});
 group('.legend.arms button','data-a',function(v){arm=v});
})();
</script>`;

fs.writeFileSync(OUT, html);
console.log('wrote ' + OUT + '  —  ' + all.length + ' cards, ' + classes.length + ' classes');
