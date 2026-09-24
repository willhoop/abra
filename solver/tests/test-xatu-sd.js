/* solver/tests/test-xatu-sd.js — pins XATU's Showdown adapter against the Showdown checkout itself.
 * Exits non-zero on any failure.   node solver/tests/test-xatu-sd.js
 * No Pokemon value is typed: every expectation is read back from the sim (a built Battle, the
 * TeamValidator, Pokemon.getHealth, a direct getDamage), and fixtures are real open sheets from data/raw. */
'use strict';
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const SD = require('../xatu/sd.js');
const { parseShowteam } = require('../human/parse_game.js');
let fail = 0, pass = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + msg); } };

// fixture: two real sheets from the raw Reg M-C stream
const dir = path.join(__dirname, '..', '..', 'data', 'raw', 'games.gen9championsvgc2026regmcbo3');
const f0 = fs.readdirSync(dir).filter(f => f.endsWith('.gz')).sort()[0];
const teams = [];
for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f0))).toString('utf8').split('\n')) {
  if (!line || /\|replace\|/.test(line)) continue;
  for (const l of JSON.parse(line).log.split('\n')) if (l.startsWith('|showteam|')) teams.push(parseShowteam(l.split('|').slice(3).join('|')));
  if (teams.length >= 8) break;
}
ok(teams.length >= 2, 'fixture sheets found');
const sheets = { p1: teams[0], p2: teams[1] };
let seed = 12345; const R = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// 1. SP rules: the validator accepts SP_TOTAL and rejects SP_TOTAL+1 and SP_CAP+1
{
  const set = SD.toSet(teams[0][0]);
  const V = SD.VALIDATOR;
  const at = evs => V.validateSet({ ...set, evs }, {}) || [];
  const legal = {}; let left = SD.SP_TOTAL; for (const st of SD.STATS) { legal[st] = Math.min(SD.SP_CAP, left); left -= legal[st]; }
  ok(!at(legal).some(p => /Stat Point|total|limit/i.test(p)), 'a spread at the SP total is legal: ' + at(legal).join('; '));
  ok(at({ ...legal, spe: legal.spe + 1 }).some(p => /limit|total|more than/i.test(p)), 'one SP over the total is rejected');
  ok(at({ hp: SD.SP_CAP + 1, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }).some(p => /more than/i.test(p)), 'one SP over the per-stat cap is rejected');
}

// 2. statValue equals the stored stats of a real built battle, for random spreads, every stat, both sides
{
  for (let t = 0; t < 12; t++) {
    const sp = { p1: [], p2: [] };
    const b = new SD.Battle({ formatid: SD.FORMAT, seed: [1, 2, 3, t + 1] });
    for (const s of ['p1', 'p2']) {
      const team = sheets[s].map(m => { const evs = {}; let left = SD.SP_TOTAL; for (const st of SD.STATS) { evs[st] = Math.min(SD.SP_CAP, left, Math.floor(R() * 20)); left -= evs[st]; } sp[s].push(evs); return { ...SD.toSet(m), evs }; });
      b.setPlayer(s, { name: s, team: SD.Teams.pack(team) });
    }
    b.choose('p1', 'team 1234'); b.choose('p2', 'team 1234');
    for (const s of ['p1', 'p2']) for (const p of b[s].pokemon) {
      const i = sheets[s].findIndex(m => SD.D.species.get(m.species).num === p.baseSpecies.num);
      const m = sheets[s][i];
      for (const st of ['atk', 'def', 'spa', 'spd', 'spe']) ok(SD.statValue(p.species.name, m.nature, st, sp[s][i][st]) === p.storedStats[st], `statValue ${p.species.name} ${st}`);
      ok(SD.statValue(p.species.name, m.nature, 'hp', sp[s][i].hp) === p.maxhp, `statValue ${p.species.name} hp`);
    }
  }
}

// 3. hpBand inverts the sim's own display: for every hp of a real mon, the band of its display contains it
{
  const ctx = new SD.Ctx(sheets);
  const b = ctx.battleFor({ p1: [0, 1], p2: [0, 1] });
  const p = b.p1.active[0];
  let bad = 0, tight = 0;
  for (const maxhp of [101, 137, 199, 250]) {
    p.maxhp = maxhp;
    for (let hp = 1; hp <= maxhp; hp++) {
      p.hp = hp;
      const sh = p.getHealth().shared;
      const m = /^(\d+)\/100([a-z]?)/.exec(sh);
      const band = SD.hpBand({ pct: +m[1], color: m[2], fnt: false }, maxhp);
      if (!band || hp < band[0] || hp > band[1]) bad++;
      if (band && band[1] - band[0] <= 2) tight++;
    }
  }
  ok(bad === 0, `hpBand contains the true HP for every display (${bad} misses)`);
  ok(tight > 0, 'hpBand is not trivially wide');
}

// 4. damageTable (decomposed) equals direct getDamage enumeration on real sheets, every cell
{
  const ctx = new SD.Ctx(sheets);
  const b = ctx.battleFor({ p1: [0, 1], p2: [0, 1] });
  let cells = 0, mism = 0, tested = 0;
  for (const [A, T] of [[b.p1.active[0], b.p2.active[0]], [b.p2.active[1], b.p1.active[1]], [b.p1.active[1], b.p2.active[0]]]) {
    for (const mv of A.moves) {
      const move = b.dex.moves.get(mv);
      if (move.category === 'Status' || move.basePowerCallback || move.damageCallback || move.damage) continue;
      const prepared = SD.prepareMove(b, A, T, mv, { crit: false });
      const phys = b.getCategory(prepared) === 'Physical';
      const offStat = prepared.overrideOffensiveStat || (phys ? 'atk' : 'spa');
      const defStat = prepared.overrideDefensiveStat || (phys ? 'def' : 'spd');
      const offMon = prepared.overrideOffensivePokemon === 'target' ? T : A;
      const vals = [0, 5, 13, 22, 32];
      const setOff = i => { offMon.storedStats[offStat] = SD.statValue(offMon.species.name, offMon.set.nature, offStat, vals[i]); };
      const setDef = j => { T.storedStats[defStat] = SD.statValue(T.species.name, T.set.nature, defStat, vals[j]); };
      for (const crit of [false, true]) {
        const dt = SD.damageTable(b, A, T, mv, { crit }, setOff, setDef, vals.length, vals.length, 0);
        if (!dt || !dt.table) continue;
        tested++;
        for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals.length; j++) {
          setOff(i); setDef(j);
          const r = SD.damageRange(b, A, T, mv, { crit });
          cells++;
          if (!r || r[0] !== dt.table[i][j][0] || r[1] !== dt.table[i][j][1]) mism++;
        }
      }
    }
  }
  ok(tested >= 3, `damageTable exercised on ${tested} move/crit cases`);
  ok(cells > 0 && mism === 0, `damageTable equals direct getDamage on ${cells} cells (${mism} mismatches)`);
}

console.log(`test-xatu-sd: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
