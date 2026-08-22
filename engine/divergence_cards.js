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
/* THE VERB TABLE AND THE TWO FIELD PARSERS NOW LIVE IN engine/protocol_words.js, AND THIS FILE READS
 * THEM RATHER THAN OWNING THEM. engine/replay_one.js needs the identical translation for a terminal,
 * and CLAUDE.md's rule is that a FACT — what `-enditem` means in English — has one implementation
 * while a RENDERING is per-caller. This file keeps the HTML; the words are shared. Behaviour here is
 * unchanged: `VERB`, `who` and `hp` are byte-for-byte what they were, moved. */
const WORDS = require('./protocol_words.js');
const VERB = WORDS.VERB, who = WORDS.who, hp = WORDS.hp;

/* WHO WAS IN THAT SLOT BEFORE — WILL, 2026-08-13: *"and include the clear switch ins"*.
 *
 * A bare `sends in Greninja` hides the half that matters. Which body LEFT decides whether the switch
 * was a pivot, a forced replacement after a faint, or a lead arriving — and those read identically in
 * the protocol. The occupant table is rebuilt per card by walking the lead-in in order, so it reflects
 * that card's own history rather than a global guess.
 *
 * THE TWO PANELS ARE ALTERNATIVE FUTURES OF ONE INSTANT, AND THE TABLE MUST NOT LEAK BETWEEN THEM.
 * Will, 2026-08-13: *"but look at how busted our switches are, they are replacing themselves?"* — and
 * that was this renderer, not the engine. Showdown's panel rendered first and wrote `p2a -> Gholdengo`;
 * ours then read it back and printed "Gholdengo replacing Gholdengo". Each side has to start from the
 * board as it stood AT THE SPLIT, so occupancy is snapshotted after the shared lead-in and restored
 * before each panel. A viewer that invents a defect is worse than one that misses it. */
const occupant = {};
function resetSlots() { for (const k of Object.keys(occupant)) delete occupant[k]; }
function snapSlots() { return { ...occupant }; }
function restoreSlots(s) { resetSlots(); Object.assign(occupant, s); }
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
/* THE PAGE CARRIES ITS OWN READING ORDER — WILL, 2026-08-13: *"i dont want to keep scrolling up
 * for the list of things you want me to look at, can you either just remake the artifact in the order
 * you want?"*. Fair: an ordered list that lives in the chat is a handoff document, and this project has
 * fourteen of those it no longer trusts. The order and the question now travel WITH the evidence.
 *
 * Ranked by how much a human judgement is worth on it, which is NOT the same as how many cards there
 * are. The classifier can say what SHAPE a disagreement is; it can never say which engine is right, and
 * that is the whole reason these groups are ordered this way. */
const READING_ORDER = [
  { cls: 'event missing from medicham2',
    title: 'Showdown says something we never say',
    ask: 'Would that missing line have changed what happens next? If yes it is a defect. If no it is '
       + 'narration and I will stop counting it against us.' },
  { cls: 'showdown stopped emitting while medicham2 continued',
    title: 'We keep playing after Showdown has stopped',
    ask: 'Showdown thinks the game is over and we are still going. This class was 38 games and an '
       + 'agent got it to 2 — these are what is left, so each one is either a new cause or an old one '
       + 'resurfacing.' },
  { cls: 'ordering',
    title: 'Same events, different order',
    ask: 'Is the order actually wrong, or a different-but-equivalent way to say the same turn? Two of '
       + 'tonight\'s fixes came out of this class.' },
  { cls: 'extra event emitted by medicham2',
    title: 'We say something Showdown never says',
    ask: 'Is that line describing something that really happened, or are we inventing an event?' },
  { cls: 'unrelated event mismatch',
    title: 'Both engines emit — different events entirely',
    ask: 'These are the hardest to classify automatically. Often the two sides are describing the '
       + 'same board from different angles; sometimes the boards genuinely differ.' },
  { cls: '-damage field 3',
    title: 'Same damage event, different number',
    ask: 'A number mismatch is nearly always a real defect. Worth a look even though there are few.' },
];
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
/* SORTED BEFORE NUMBERING, so card 1 is the first thing worth reading rather than the first thing
 * the differential happened to record. A class not named in READING_ORDER keeps its place at the end
 * rather than being dropped — an unlisted class is an unranked one, never an invisible one. */
const rank = c => { const i = READING_ORDER.findIndex(r => r.cls === c); return i < 0 ? READING_ORDER.length : i; };
all.sort((a, b) => rank(a.cls) - rank(b.cls));
const GROUPS = (() => {
  const seen = [], out = [];
  for (const g of all) { const c = g.cls || 'unclassified'; if (!seen.includes(c)) { seen.push(c); out.push(c); } }
  return out.map(c => ({ cls: c, meta: READING_ORDER.find(r => r.cls === c) || null,
                         n: all.filter(x => (x.cls || 'unclassified') === c).length }));
})();
const classes = [...new Set(all.map(x => x.cls || 'unclassified'))].sort();
const tally = {}; for (const x of all) tally[x.cls || 'unclassified'] = (tally[x.cls || 'unclassified'] || 0) + 1;

let _lastCls = null;
const cards = all.map((g, i) => {
  /* The heading rides INSIDE the card list rather than wrapping it, so the class filter can hide a
   * whole group without leaving an orphaned header behind. */
  const cls_ = g.cls || 'unclassified';
  let head = '';
  if (cls_ !== _lastCls) {
    _lastCls = cls_;
    const grp = GROUPS.find(x => x.cls === cls_);
    head = `<section class="grouphead" data-cls="${esc(slug(cls_))}">
      <h2>${esc((grp && grp.meta && grp.meta.title) || cls_)}</h2>
      <p class="ask">${esc((grp && grp.meta && grp.meta.ask) || 'Unranked class — no reading question written for it yet.')}</p>
      <p class="grpmeta">${grp ? grp.n : 0} cards &nbsp;·&nbsp; classifier calls this <code>${esc(cls_)}</code></p>
    </section>`;
  }
  return head + (() => {
  resetSlots();
  const lead = (g.before_raw && g.before_raw.length ? g.before_raw : g.before) || [];
  const sdAfter = ((g.after && g.after.showdown) || []).slice(1);
  const meAfter = ((g.after && g.after.medicham) || []).slice(1);
  const nothing = '<div class="line none">— nothing further —</div>';
  /* RENDERED AS STATEMENTS, NOT INSIDE THE TEMPLATE, because the order these three run in is the whole
   * fix. The lead-in builds the occupancy; the snapshot is the board AT THE SPLIT; each panel then
   * starts from that same board instead of from whatever the other panel did to it. */
  const leadHtml = lead.map(renderLine).join('');
  const atSplit = snapSlots();
  const sdHtml = (renderLine(g.at && g.at.showdown_raw) || nothing)
    + (sdAfter.length ? `<div class="then">${sdAfter.map(renderLine).join('')}</div>` : '');
  restoreSlots(atSplit);
  const meHtml = (renderLine(g.at && g.at.medicham_raw) || nothing)
    + (meAfter.length ? `<div class="then">${meAfter.map(renderLine).join('')}</div>` : '');
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
    ${lead.length ? `<div class="both"><div class="lbl">the turn so far — both engines agree</div>
      ${leadHtml}</div>` : ''}
    <div class="split">
      <div class="side sd"><div class="lbl">Showdown</div>${sdHtml}</div>
      <div class="side me"><div class="lbl">ours</div>${meHtml}</div>
    </div>
  </article>`;
  })();
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
.caveat{color:var(--muted);font-size:12.5px;max-width:74ch;margin:0 0 22px;line-height:1.65}
.caveat b{color:var(--ink-2)}
.caveat code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;
 background:var(--chip);padding:1px 5px;border-radius:4px}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;padding:0;list-style:none}
.legend.arms{margin:0 0 26px}
.legend.arms button{border-style:dashed}
.legend button{font:inherit;font-size:12.5px;cursor:pointer;border:1px solid var(--rule);background:var(--card);
 color:var(--ink-2);border-radius:999px;padding:5px 11px;display:inline-flex;gap:7px;align-items:center}
.legend button[aria-pressed="true"]{border-color:var(--ink-2);color:var(--ink);background:var(--chip)}
.legend button:focus-visible{outline:2px solid var(--sd);outline-offset:2px}
.legend .n{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted);font-size:11.5px}
.cards{display:flex;flex-direction:column;gap:18px}
.grouphead{margin:26px 0 2px;padding-top:20px;border-top:2px solid var(--rule)}
.grouphead:first-child{margin-top:6px;padding-top:0;border-top:0}
.grouphead[hidden]{display:none}
.grouphead h2{font-size:19px;margin:0 0 6px;letter-spacing:-.01em}
.ask{margin:0 0 6px;color:var(--ink-2);max-width:70ch;font-size:14px;line-height:1.6}
.grpmeta{margin:0;color:var(--muted);font-size:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.grpmeta code{background:var(--chip);padding:1px 5px;border-radius:4px}
.toc{margin:0 0 26px;padding:14px 16px;border:1px solid var(--rule);border-radius:10px;background:var(--card)}
.toc ol{margin:0;padding-left:20px;color:var(--ink-2);font-size:13.5px;line-height:1.9}
.toc .n{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted);font-size:12px}
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
    <span><b>replacing X</b> = who left that slot</span>
  </div>
  <p class="caveat">The grey block is rendered from <b>our</b> stream, and the two engines agree there
  <em>after normalisation</em> — not byte for byte. Seven equivalences are applied before anything is
  compared (a <code>|move|</code> line's nominal target, a <code>[from]</code> switch cause, an
  ability announcement, and four more), so a line can read slightly differently on each side and still
  be the same claim about the board. Who was actually hit is compared body by body on the
  <code>-damage</code> and <code>-status</code> lines that follow.</p>
  <ul class="legend">
    <li><button type="button" data-f="all" aria-pressed="true">all <span class="n">${all.length}</span></button></li>
    ${classes.map(c => `<li><button type="button" data-f="${esc(slug(c))}" aria-pressed="false">${esc(c)} <span class="n">${tally[c]}</span></button></li>`).join('')}
  </ul>
  <ul class="legend arms">
    <li><button type="button" data-a="all" aria-pressed="true">both corners <span class="n">${all.length}</span></button></li>
    ${ARMS_PRESENT.map(a => `<li><button type="button" data-a="${esc(slug(a))}" aria-pressed="false">${esc(a)} <span class="n">${armTally[a]}</span></button></li>`).join('')}
  </ul>
  <nav class="toc"><ol>
    ${GROUPS.map(g => `<li>${esc((g.meta && g.meta.title) || g.cls)} <span class="n">${g.n}</span></li>`).join('')}
  </ol></nav>
  <div class="cards">${cards}</div>
  <footer class="foot">Read the two coloured panels first — everything above them is agreement. If the
  two sides describe the same board in different words, that's narration. If they describe different
  boards, that's a defect.</footer>
</div>
<script>
(function(){
 /* headings are hidden by the same rule as their cards, or filtering leaves orphans behind */
 var c=[].slice.call(document.querySelectorAll('.card,.grouphead')), cls='all', arm='all';
 function apply(){
   c.forEach(function(k){
     var isHead=k.classList.contains('grouphead');
     k.hidden=(cls!=='all'&&k.getAttribute('data-cls')!==cls)
            ||(!isHead&&arm!=='all'&&k.getAttribute('data-arm')!==arm);
   });
   /* A HEADING WITH NOTHING UNDER IT IS A LIE ABOUT THE FILTER. The arm filter hides cards and not
    * headings, so a one-card group (there are two) would otherwise show its title and question with
    * no evidence beneath. Second pass: a head survives only if a card of its class is still visible. */
   c.forEach(function(k){
     if(!k.classList.contains('grouphead')||k.hidden) return;
     var mine=k.getAttribute('data-cls'), any=false;
     c.forEach(function(x){
       if(x.classList.contains('card')&&!x.hidden&&x.getAttribute('data-cls')===mine) any=true;
     });
     if(!any) k.hidden=true;
   });
 }
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
