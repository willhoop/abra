/* solver/tournaments/validate.js — the format's own TeamValidator over every team in the tournament store.
 *
 *   node solver/tournaments/validate.js [--regulation regmc] [--root <dir>]   -> data/tournaments/<reg>/validation.json
 *
 * Needs the regulation's Showdown checkout (solver/human/dex.js finds it), so it runs locally, not on the GitHub runner.
 * The store is never edited: an illegal team stays in its shard and is FLAGGED here, with the validator's own words.
 *
 * The set handed to the validator is the sheet as published, names resolved by the format's dex (species, item, ability,
 * moves, nature), level 50, IVs 31 (the format refuses anything else). Spreads: the published Stat Points when the paste
 * carries them, else all zero — an open team sheet has no spreads, and zero is always within the format's budget, so
 * the verdict is about the sheet and never about a spread we invented.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./store.js');

function resolve(X, s) {
  const sp = X.D.species.get(s.species), it = X.D.items.get(s.item || ''), ab = X.D.abilities.get(s.ability || ''), nat = X.D.natures.get(s.nature || '');
  return { name: '', species: sp.exists ? sp.name : s.species, item: it.exists ? it.name : (s.item || ''), ability: ab.exists ? ab.name : (s.ability || ''),
           moves: (s.moves || []).map(m => { const mv = X.D.moves.get(m); return mv.exists ? mv.name : m; }), nature: nat.exists ? nat.name : (s.nature || ''),
           gender: s.gender || '', level: 50,
           evs: s.evs ? Object.assign({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, s.evs) : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } };
}

function validateTeams(teams, X) {
  const { TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
  const V = TeamValidator.get(X.FORMAT);
  const out = {};
  for (const t of teams) {
    const sets = t.sets.map(s => resolve(X, s));
    const problems = V.validateTeam(JSON.parse(JSON.stringify(sets)));
    out[t.team_id] = problems && problems.length ? { ok: false, problems } : { ok: true };
  }
  return out;
}

function checkoutCommit(X) {
  try { const h = fs.readFileSync(path.join(X.SHOWDOWN_PATH, '.git', 'HEAD'), 'utf8').trim(); if (!h.startsWith('ref:')) return h; const r = path.join(X.SHOWDOWN_PATH, '.git', h.slice(5).trim()); return fs.existsSync(r) ? fs.readFileSync(r, 'utf8').trim() : h; }
  catch (e) { return null; }
}

function run(argv) {
  const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const reg = flag('regulation', process.env.ABRA_REGULATION || 'regmc');
  process.env.ABRA_REGULATION = reg;
  if (reg === 'regmc') require('../arena/env.js');   // finds the checkout from a worktree too; another regulation sets SHOWDOWN_PATH
  const X = require('../human/dex.js');
  const root = flag('root', null);
  const teams = S.teams(reg, root);
  const res = validateTeams(teams, X);
  const bad = Object.entries(res).filter(([, v]) => !v.ok);
  const out = { generated: new Date().toISOString(), builder: 'solver/tournaments/validate.js', format: X.FORMAT, checkout: path.basename(X.SHOWDOWN_PATH), checkout_commit: checkoutCommit(X),
                store_events: S.events(reg, root).map(e => ({ key: e.key, shard_sha256: e.shard_sha256 })),
                teams: teams.length, legal: teams.length - bad.length, illegal: bad.length,
                illegal_teams: bad.map(([k, v]) => ({ team_id: k, problems: v.problems })), by_team: res };
  const f = S.dirs(reg, root).validation;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(out, null, 1) + '\n');
  console.log('validated ' + teams.length + ' teams against TeamValidator(' + X.FORMAT + '): ' + out.legal + ' legal, ' + out.illegal + ' illegal -> ' + path.relative(S.ROOT, f));
  for (const [k, v] of bad) console.log('  ILLEGAL ' + k + ': ' + v.problems.join(' | '));
  return out;
}

if (require.main === module) { try { run(process.argv.slice(2)); } catch (e) { console.error(e.stack || e); process.exit(1); } }
module.exports = { run, resolve, validateTeams };
