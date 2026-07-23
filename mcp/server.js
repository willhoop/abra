#!/usr/bin/env node
/* ABRA MCP server — exposes the Champions models as tools Claude can call.
 * Local stdio server. Wraps the existing engines (all JS) directly.
 *   Tools: abra_win_probability (JOLTEON), abra_rollout (MEDICHAM),
 *          abra_threats, abra_species_stats, abra_optimize_team (DITTO),
 *          abra_coach_replay (KADABRA).
 * Add to Claude:  claude mcp add abra -- node /path/to/ABRA/mcp/server.js
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRequire } from "module";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { spawn } from "child_process";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENG = path.join(HERE, "..", "engine");
const DATA = path.join(HERE, "..", "data");
const ROOT = path.join(HERE, "..");

const ditto = require(path.join(ENG, "ditto.js"));      // pwin, loadMeta, prep, optimise
const medi  = require(path.join(ENG, "medicham.js"));   // winProb
const sets  = require(path.join(ENG, "sets.js"));       // team6
const meta  = JSON.parse(fs.readFileSync(path.join(DATA, "meta-usage.json"), "utf8"));
const dyn   = JSON.parse(fs.readFileSync(path.join(DATA, "dynamics.json"), "utf8"));

const idn = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const parseTeam = t => (Array.isArray(t) ? t : String(t).split(",")).map(idn).filter(Boolean);
const ok  = (text, structured) => ({ content: [{ type: "text", text }], structuredContent: structured });
const err = text => ({ content: [{ type: "text", text }], isError: true });

const server = new McpServer({ name: "abra", version: "1.0.0" });

server.registerTool("abra_win_probability", {
  description: "JOLTEON — instant pre-game win probability that team A beats team B, from the trained ladder model. Fast (one forward pass). Accuracy ~57%, which the predictability study shows is near the hard ceiling for team-sheet prediction, so treat outputs as modest edges, not certainties.",
  inputSchema: { team_a: z.string().describe("your team: comma-separated species, e.g. 'garchomp,incineroar,kingambit,whimsicott'"),
                 team_b: z.string().describe("opponent team, same format") },
  annotations: { readOnlyHint: true }
}, async ({ team_a, team_b }) => {
  const A = parseTeam(team_a), B = parseTeam(team_b);
  if (!A.length || !B.length) return err("Provide both teams as comma-separated species.");
  const p = ditto.pwin(A, B);
  return ok(`JOLTEON: P(team A wins) = ${(p*100).toFixed(1)}%`, { p_team_a: p });
});

server.registerTool("abra_rollout", {
  description: "MEDICHAM — grounded win probability from playing the matchup out with CHOMP's exact damage and a behaviour-cloned move policy (Monte-Carlo). Slower than JOLTEON but resolves status, speed control and setup, so it catches teams JOLTEON over- or under-rates. Use to VET a JOLTEON call.",
  inputSchema: { team_a: z.string(), team_b: z.string(), rollouts: z.number().int().min(50).max(1000).optional().default(200) },
  annotations: { readOnlyHint: true }
}, async ({ team_a, team_b, rollouts }) => {
  const A = sets.team6(parseTeam(team_a).slice(0,4)), B = sets.team6(parseTeam(team_b).slice(0,4));
  if (A.length < 1 || B.length < 1) return err("Could not build those teams (unknown species?).");
  const p = medi.winProb(A, B, rollouts);
  return ok(`MEDICHAM: P(team A wins) = ${(p*100).toFixed(1)}% over ${rollouts} rollouts`, { p_team_a: p, rollouts });
});

server.registerTool("abra_threats", {
  description: "The most common Champions ladder threats, ranked. Returns usage %, bring %, lead %, win %, and sample size per species. Sort by any of those.",
  inputSchema: { sort_by: z.enum(["teamRate","bringRate","leadRate","winRate"]).optional().default("teamRate"),
                 limit: z.number().int().min(1).max(100).optional().default(20) },
  annotations: { readOnlyHint: true }
}, async ({ sort_by, limit }) => {
  const rows = (meta.threats||[]).slice().sort((a,b)=>(b[sort_by]||0)-(a[sort_by]||0)).slice(0, limit)
    .map(t => ({ species: t.sp, usage: t.teamRate, bring: t.bringRate, lead: t.leadRate, win: t.winRate, games: t.n }));
  const txt = rows.map((r,i)=>`${i+1}. ${r.species} — usage ${(r.usage*100).toFixed(0)}%, bring ${(r.bring*100).toFixed(0)}%, lead ${(r.lead*100).toFixed(0)}%, win ${(r.win*100).toFixed(0)}%`).join("\n");
  return ok(txt || "no threats", { threats: rows, sorted_by: sort_by });
});

server.registerTool("abra_species_stats", {
  description: "Full ladder profile for one species: team/bring/lead/win rates, observed first-move (speed) rate with a Choice-Scarf hint, and observed damage per move — all from real replays.",
  inputSchema: { species: z.string() },
  annotations: { readOnlyHint: true }
}, async ({ species }) => {
  const s = idn(species);
  const t = (meta.threats||[]).find(x=>x.sp===s) || {};
  const sp = (dyn.speed||{})[s] || null;
  const dmg = Object.entries(dyn.damage||{}).filter(([k])=>k.split("|")[0]===s)
    .map(([k,v])=>({ move: k.split("|")[1], mean: v.mean, max: v.max, n: v.n })).sort((a,b)=>b.mean-a.mean).slice(0,8);
  if (!t.sp && !sp && !dmg.length) return err(`No data for '${species}'.`);
  const txt = `${species}: usage ${((t.teamRate||0)*100).toFixed(0)}%, bring ${((t.bringRate||0)*100).toFixed(0)}%, win ${((t.winRate||0)*100).toFixed(0)}%`
    + (sp ? `, moves first ${(sp.firstRate*100).toFixed(0)}%${sp.scarfHint?" (Choice Scarf likely)":""}` : "")
    + (dmg.length ? `. Top hit: ${dmg[0].move} ~${dmg[0].mean}% avg` : "");
  return ok(txt, { species: s, usage: t, speed: sp, damage: dmg });
});

server.registerTool("abra_optimize_team", {
  description: "DITTO — build a six that beats the live ladder meta. Hill-climbs from a seed using JOLTEON as the evaluator, usage-weighted so it answers high-bring threats (e.g. Basculegion) rather than rare ones. Compute-heavy (a few seconds). Always vet the result with abra_rollout.",
  inputSchema: { seed: z.string().optional().describe("optional seed six, comma-separated; omit for a strong default") },
  annotations: { readOnlyHint: true }
}, async ({ seed }) => {
  const gauntlet = ditto.loadMeta(); ditto.prep(gauntlet);
  const cnt = {}; for (const m of gauntlet) for (const x of m) cnt[x]=(cnt[x]||0)+1;
  const pool = Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,30);
  const usage = Object.fromEntries(Object.entries(cnt).map(([k,v])=>[k, v/gauntlet.length]));
  const seedTeam = seed ? parseTeam(seed) : ["pelipper","whimsicott","archaludon","basculegion","kingambit","sinistcha"];
  const { team, best } = ditto.optimise(seedTeam, pool, gauntlet, usage);
  return ok(`DITTO optimised team: ${team.join(", ")}  (JOLTEON score ${(best*100).toFixed(0)}%). Vet with abra_rollout — JOLTEON can over-rate.`, { team, jolteon_score: best });
});

server.registerTool("abra_coach_replay", {
  description: "KADABRA — coach a Champions replay. Fetches the game, reconstructs it, and returns the pivotal turns (a big hit you traded into, a KO you scored, a Pokémon you lost) with the better play for each. Provide the replay id or URL and your Showdown name.",
  inputSchema: { replay: z.string().describe("replay id or full URL"), me: z.string().optional().default("").describe("your Showdown name") },
  annotations: { readOnlyHint: true, openWorldHint: true }
}, async ({ replay, me }) => {
  const out = await new Promise(res => { let o=""; const p = spawn("node",[path.join(ENG,"kadabra.js"), replay, me, "--json"], { cwd: ROOT });
    p.stdout.on("data",d=>o+=d); p.stderr.on("data",d=>o+=d); p.on("close",()=>res(o)); p.on("error",()=>res("")); });
  const a=out.indexOf("{"), b=out.lastIndexOf("}"); let j=null; try { j=JSON.parse(out.slice(a,b+1)); } catch {}
  if (!j) return err("Could not fetch or parse that replay (check the id and that it's a Champions game).");
  const keys = (j.scenes||[]).filter(s=>s.key);
  const txt = `${j.me} vs ${j.foe} — ${j.result}. ${keys.length} key turn(s):\n` + keys.map(s=>`Turn ${s.n} (${s.kind}): ${s.coach}`).join("\n");
  return ok(txt, { result: j.result, me: j.me, foe: j.foe, key_turns: keys.map(s=>({ turn: s.n, kind: s.kind, coach: s.coach })) });
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("ABRA MCP server running (stdio). Tools: win_probability, rollout, threats, species_stats, optimize_team, coach_replay.\n");
