/* solver/tests/ladder_replay.js — rebuild ROTOM's world at a point of a SAVED ladder game (test helper, 2026-09-30).
 *
 *   const LR = require('./ladder_replay.js');
 *   const w = LR.worldAt(WB, { log: <file>, me: 'p2', bring: [0, 5, 2, 4], cut: '|turn|4' });
 *
 * The saved log (solver/out/rotom/<run>/games/<account>/*.log, copied into fixtures/rotom/postmortem/) is the room's public
 * protocol as our client received it, so our own side carries exact HP. The request is not saved, so it is REBUILT from
 * the log: my brought four (the preview choice, sheet indices) in request order — actives first, by slot — with the HP,
 * status, forme and item the log last showed. It carries no stat line and no ability, so the world takes both from the
 * sheet and the log: a test built on it exercises the log path. Everything the live request would add is exact; nothing
 * here is guessed beyond "no request field".
 */
'use strict';
const fs = require('fs');
const { parseGame, parseShowteam } = require('../human/parse_game.js');

function build(o) {
  const all = fs.readFileSync(o.log, 'utf8').replace(/\r/g, '').split('\n');
  const cutAt = all.indexOf(o.cut);
  if (cutAt < 0) throw new Error('ladder_replay: cut line not found: ' + o.cut);
  let lines = all.slice(0, cutAt + 1);
  /* o.inject: [[afterLine, [lines...]]] — synthetic lines spliced in after the first occurrence of afterLine */
  for (const [after, add] of o.inject || []) { const i = lines.indexOf(after); if (i < 0) throw new Error('ladder_replay: inject anchor not found: ' + after); lines = lines.slice(0, i + 1).concat(add, lines.slice(i + 1)); }
  const sheets = {};
  for (const l of lines) { const p = l.split('|'); if (p[1] === 'showteam') sheets[p[2]] = parseShowteam(p.slice(3).join('|')); }
  const me = o.me, mySheet = sheets[me];
  const mon = mySheet.map(r => ({ nick: r.nick, details: r.species + ', L50', cond: null, item: r.item ? r.item.toLowerCase().replace(/[^a-z0-9]/g, '') : '', pos: null }));
  const byNick = n => mon.find(m => m.nick === n);
  for (const l of lines) {
    const p = l.split('|'); const c = p[1];
    const id = /^(p[12])([ab]?):\s?(.*)$/.exec(p[2] || '');
    if (!id || id[1] !== me) continue;
    const m = byNick(id[3]); if (!m) continue;
    if (c === 'switch' || c === 'drag') { for (const x of mon) if (x.pos === id[2]) x.pos = null; m.pos = id[2]; m.details = p[3]; m.cond = p[4]; }
    else if (c === 'detailschange') m.details = p[3];
    else if (c === '-damage' || c === '-heal' || c === '-sethp') m.cond = p[3];
    else if (c === 'faint') { m.cond = '0 fnt'; m.pos = null; }
    else if (c === '-status') { const hp = String(m.cond || '').split(' ')[0]; m.cond = hp + ' ' + p[3]; }
    else if (c === '-curestatus') m.cond = String(m.cond || '').split(' ')[0];
    else if (c === '-enditem') m.item = '';
    else if (c === '-item') m.item = p[3].toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  /* no preview choice given: the mons the log has shown, then the first unshown sheet rows (the world needs four) */
  const bring = o.bring ? o.bring.map(i => mon[i]) : mon.filter(m => m.cond).concat(mon.filter(m => !m.cond)).slice(0, 4);
  const order = bring.filter(m => m.pos === 'a').concat(bring.filter(m => m.pos === 'b'), bring.filter(m => !m.pos));
  const req = { side: { id: me, pokemon: order.map(m => ({ ident: me + ': ' + m.nick, details: m.details, condition: m.cond || '100/100', active: !!m.pos, item: m.item })) } };
  /* a brought mon that never appeared is at full HP; `o.hpOf(sheetRow)` gives its max (the test builds the body) */
  order.forEach((m, k) => { if (!m.cond) { const hp = o.hpOf ? o.hpOf(mySheet[mon.indexOf(m)]) : 100; req.side.pokemon[k].condition = hp + '/' + hp; } });
  const row = parseGame({ id: 'replay', log: lines.join('\n') });
  return { row, sheets, me, req, lines };
}

function worldAt(WB, o) {
  const b = build(o);
  return Object.assign(WB.build({ row: b.row, sheets: b.sheets, me: b.me, req: b.req, oppGuess: null, lines: b.lines }), { replay: b });
}
/* the world body of a side's sheet row, by nickname */
function bodyOf(w, side, nick) {
  const list = side === w.replay.me ? w.mine : w.theirs;
  const x = list.find(y => w.replay.sheets[side][y.s].nick === nick);
  return x ? x.b : null;
}

module.exports = { build, worldAt, bodyOf };
