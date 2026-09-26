/* solver/rotom/applied_audit.js — CHOSEN VS APPLIED, offline, over a finished run's own files (read only).
 *
 *   node solver/rotom/applied_audit.js <run dir> [--name medicham32] [--json <file>]
 *
 * The live client checks every decision against the server's next request (rotom.js runVerify, solver/rotom/applied.js).
 * A run from BEFORE that check (aa1, aa2) has no requests on disk: the decision log holds the choice, the game's log holds
 * the public lines (ours, from rotom.js endBattle; |request| and |inactive| lines are not in it). So the request each
 * decision answered is RECONSTRUCTED:
 *   - our side's order after preview: the chosen order if the log's leads are the chosen leads, the server default (slots
 *     1-4) if they are sheet slots 1+2, else the game is marked unreconstructable;
 *   - positions then follow the server's own rule — a switch swaps the incoming body with the slot's occupant
 *     (sim/battle.ts switchIn) — line by line;
 *   - each active body's moves are its OPEN SHEET's, in sheet order (the request lists them in set order), with the
 *     target class read from the format (Dex.moves.get(id).target).
 * Each decision is judged on its turn's lines exactly as live (a move decision: `|turn|T` to `|turn|T+1`; a forced switch:
 * from our first replacement after a faint or a switch-out in that turn). What cannot be reconstructed is counted as such,
 * never as applied. Throttle notices are counted where they fall: before turn 1 (the preview window) or after.
 * Every mismatch is listed with its lines so a human can check the VERIFIER as well as the game.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const A = require('./applied.js');
const { parseShowteam } = require('../human/parse_game.js');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function readJsonl(f) { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } }

function auditGame(logFile, decFile, name, D) {
  const lines = fs.readFileSync(logFile, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
  const decs = readJsonl(decFile);
  const out = { room: path.basename(logFile, '.log'), verdicts: [], notices: { preview: 0, after: 0 }, unreconstructable: 0, notes: [] };
  const pl = lines.map(l => l.split('|'));
  const meL = pl.find(p => p[1] === 'player' && toID(p[3]) === toID(name));
  if (!meL) { out.notes.push('no |player| line for ' + name); return out; }
  const me = meL[2];
  const st = pl.find(p => p[1] === 'showteam' && p[2] === me);
  if (!st) { out.notes.push('no |showteam| for our side'); return out; }
  /* a body with no nickname is named by its BASE species in the protocol (a regional forme's ident is the base name), so
   * the sheet's name is mapped the same way before it is compared with a log line */
  const sheet = parseShowteam(st.slice(3).join('|')).map(m => {
    const sp = D ? D.species.get(m.species) : null;
    const nick = (!m.nick || toID(m.nick) === toID(m.species)) && sp && sp.exists ? sp.baseSpecies : m.nick;
    return Object.assign({}, m, { nick });
  });
  const turnIdx = {}; pl.forEach((p, k) => { if (p[1] === 'turn') turnIdx[+p[2]] = k; });
  const t1 = turnIdx[1] == null ? pl.length : turnIdx[1];
  pl.forEach((p, k) => { if (p[1] === 'raw' && /message-throttle-notice/.test(p.join('|'))) out.notices[k < t1 ? 'preview' : 'after']++; });
  /* the preview: the leads the server switched in, against the choice */
  const pv = decs.find(d => d.kind === 'preview');
  const leads = [0, 1].map(i => { const p = pl.find(q => q[1] === 'switch' && (A.posOf(q[2]) || {}).side === me && (A.posOf(q[2]) || {}).slot === i); return p ? A.posOf(p[2]).nick : null; });
  let order = null;
  if (pv && /^team \d+$/.test(pv.choice)) {
    const ch = pv.choice.slice(5).split('').map(Number);
    const preq = { side: { id: me, pokemon: sheet.map(m => ({ ident: me + ': ' + m.nick })) } };
    const v = A.verifyPreview({ me, req: preq, choice: pv.choice, lines: lines.slice(0, t1 + 1) });
    out.verdicts.push(Object.assign(v, { rqid: pv.rqid, turn: 0, choice: pv.choice }));
    if (leads[0] === sheet[ch[0] - 1].nick && leads[1] === sheet[ch[1] - 1].nick) order = ch;
    else if (leads[0] === sheet[0].nick && leads[1] === sheet[1].nick) { order = [1, 2, 3, 4]; out.notes.push('preview defaulted: the server played slots 1-4'); }
  }
  if (!order) { out.unreconstructable = decs.filter(d => d.kind !== 'preview').length; out.notes.push('our order after preview could not be reconstructed'); return out; }
  /* positions, line by line (sim/battle.ts switchIn swaps the incoming body with the slot's occupant) */
  let pos = order.map(i => sheet[i - 1]);
  const posAt = [];   // posAt[k] = positions BEFORE line k
  let megaUsed = false;
  const megaAt = [];
  for (let k = 0; k < pl.length; k++) {
    posAt[k] = pos.slice(); megaAt[k] = megaUsed;
    const p = pl[k];
    if ((p[1] === 'switch' || p[1] === 'drag') && k > 0) {
      const x = A.posOf(p[2]); if (!x || x.side !== me) continue;
      if (k < t1 && pos[x.slot] && pos[x.slot].nick === x.nick) continue;   // the leads
      const j = pos.findIndex(m => m.nick === x.nick);
      if (j >= 0 && j !== x.slot) { const t = pos[x.slot]; pos[x.slot] = pos[j]; pos[j] = t; }
    }
    if ((p[1] === '-mega') && (A.posOf(p[2]) || {}).side === me) megaUsed = true;
  }
  posAt[pl.length] = pos.slice(); megaAt[pl.length] = megaUsed;
  const reqAt = (k, forced) => {
    const P = posAt[k];
    const req = { side: { id: me, pokemon: P.map((m, i) => ({ ident: me + ': ' + m.nick, active: i < 2 })) } };
    if (forced) req.forceSwitch = [true, true];
    else req.active = P.slice(0, 2).map(m => {
      const stone = D && m.item && D.items.get(m.item).megaStone;
      return { canMegaEvo: !!stone && !megaAt[k], moves: (m.moves || []).map(n => { const mv = D ? D.moves.get(n) : null; return { move: n, id: toID(n), target: mv && mv.exists ? mv.target : 'normal' }; }) };
    });
    return req;
  };
  const used = new Set();
  for (const d of decs) {
    if (d.kind === 'preview') continue;
    if (d.choice === 'default' || d.used === 'default') { out.verdicts.push({ kind: 'default', status: 'unverifiable', why: 'the last-resort default', rqid: d.rqid, turn: d.turn }); continue; }
    const T = d.turn;
    const s = turnIdx[T], e = turnIdx[T + 1] != null ? turnIdx[T + 1] : pl.length;
    if (s == null) { out.unreconstructable++; continue; }
    if (d.kind === 'move') {
      const vs = A.verifyDecision({ me, req: reqAt(s + 1, false), choice: d.choice, lines: lines.slice(s + 1, e + 1), before: lines, beforeEnd: s + 1 });
      for (const v of vs) out.verdicts.push(Object.assign(v, { rqid: d.rqid, turn: T, choice: d.choice }));
    } else {
      /* a forced switch in turn T: from our first switch-in that follows a faint of ours, or a switch-out mid-turn */
      let a = -1;
      for (let k = s + 1; k < e; k++) {
        if (used.has(k)) continue;
        const p = pl[k], x = A.posOf(p[2]);
        if (p[1] === 'switch' && x && x.side === me && pl.slice(s + 1, k).some(q => (q[1] === 'faint' && (A.posOf(q[2]) || {}).side === me) || (q[1] === 'move' && (A.posOf(q[2]) || {}).side === me))) { a = k; break; }
      }
      if (a < 0) { out.verdicts.push({ kind: 'forced', status: 'unverifiable', why: 'no replacement line found in the turn (offline)', rqid: d.rqid, turn: T, choice: d.choice }); continue; }
      used.add(a);
      const vs = A.verifyDecision({ me, req: reqAt(a, true), choice: d.choice, lines: lines.slice(a, e + 1), before: lines, beforeEnd: a });
      for (const v of vs) out.verdicts.push(Object.assign(v, { rqid: d.rqid, turn: T, choice: d.choice }));
    }
  }
  return out;
}

function auditRun(dir, name) {
  let D = null; try { D = require('../human/dex.js').D; } catch (e) { /* targets default to 'normal' */ }
  const gdir = path.join(dir, 'games', toID(name));
  const logs = fs.existsSync(gdir) ? fs.readdirSync(gdir).filter(f => f.endsWith('.log')) : [];
  const res = { dir, name, games: 0, preview: new A.Tally(), nonpreview: new A.Tally(), notices: { preview: 0, after: 0, games_with_preview_notice: 0, games_with_later_notice: 0 },
                unreconstructable: 0, games_preview_defaulted: 0, mismatches: [], per_game: [] };
  for (const f of logs) {
    const room = f.slice(0, -4);
    const g = auditGame(path.join(gdir, f), path.join(gdir, room + '.decisions.jsonl'), name, D);
    res.games++;
    res.notices.preview += g.notices.preview; res.notices.after += g.notices.after;
    if (g.notices.preview) res.notices.games_with_preview_notice++;
    if (g.notices.after) res.notices.games_with_later_notice++;
    res.unreconstructable += g.unreconstructable;
    if (g.notes.some(n => /defaulted/.test(n))) res.games_preview_defaulted++;
    const gt = new A.Tally();
    for (const v of g.verdicts) { (v.kind === 'preview' ? res.preview : res.nonpreview).add(v, { room }); gt.add(v, { room }); if (v.status === 'mismatch') res.mismatches.push(Object.assign({ room }, v)); }
    res.per_game.push({ room, notices: g.notices, notes: g.notes, unreconstructable: g.unreconstructable, chosen: gt.chosen, applied: gt.applied, explained: gt.explained_diff, mismatch: gt.mismatch, unverifiable: gt.unverifiable });
  }
  res.preview = res.preview.toJSON(); res.nonpreview = res.nonpreview.toJSON();
  return res;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const fl = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const dir = path.resolve(argv[0]);
  const r = auditRun(dir, fl('name', 'medicham32'));
  if (fl('json')) fs.writeFileSync(fl('json'), JSON.stringify(r, null, 1));
  const f = t => `${t.chosen} checks: applied ${t.applied}, explained ${t.explained_diff}, MISMATCH ${t.mismatch}, unverifiable ${t.unverifiable}`;
  console.log(`${r.dir}\n${r.games} games; throttle notices: ${r.notices.preview} before turn 1 (${r.notices.games_with_preview_notice} games), ${r.notices.after} after (${r.notices.games_with_later_notice} games); previews defaulted by the server: ${r.games_preview_defaulted}; decisions not reconstructable: ${r.unreconstructable}`);
  console.log('preview      ' + f(r.preview));
  console.log('non-preview  ' + f(r.nonpreview) + '\n  by kind ' + JSON.stringify(r.nonpreview.by_kind) + '\n  explained by ' + JSON.stringify(r.nonpreview.why));
  for (const m of r.mismatches.filter(m => m.kind !== 'preview')) console.log(`  MISMATCH ${m.room.slice(-12)} t${m.turn} ${m.kind}${m.slot != null ? ' slot ' + m.slot : ''}: chose ${m.chosen}, server ${m.applied} — ${m.why}  [${m.choice}]`);
}
module.exports = { auditRun, auditGame };
