/* Move classification shared by the behaviour-clone (policy.js) and the MEDICHAM
 * rollout. Tags the non-damaging moves that actually decide Champions games —
 * status, speed control, setup, protect — so the rollout can VALUE them, and so
 * we can visualize what each Pokemon really clicks. Keyed by normalized move id. */
const key=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

// status a move inflicts on the target
const INFLICT={ spore:'slp', sleeppowder:'slp', hypnosis:'slp', lovelykiss:'slp', darkvoid:'slp', yawn:'slp',
  willowisp:'brn', scald:'brn', lavaplume:'brn',                          // (scald/lavaplume also damage; handled as chance)
  thunderwave:'par', nuzzle:'par', glare:'par', stunspore:'par', bodyslam:'par',
  toxic:'tox', poisonpowder:'psn' };

// speed control (field-level)
const SPEEDCTRL={ tailwind:'tailwind', trickroom:'trickroom', icywind:'lowerspe', electroweb:'lowerspe',
  stringshot:'lowerspe', scaryface:'lowerspe', bulldoze:'lowerspe' };

// setup: stat-stage boosts applied to self
const SETUP={ swordsdance:{atk:2}, nastyplot:{spa:2}, dragondance:{atk:1,spe:1}, calmmind:{spa:1,spd:1},
  bulkup:{atk:1,def:1}, quiverdance:{spa:1,spd:1,spe:1}, shellsmash:{atk:2,spa:2,spe:2,def:-1,spd:-1},
  agility:{spe:2}, rockpolish:{spe:2}, irondefense:{def:2}, amnesia:{spd:2}, workup:{atk:1,spa:1},
  growth:{atk:1,spa:1}, curse:{atk:1,def:1,spe:-1}, coil:{atk:1,def:1}, victorydance:{atk:1,def:1,spe:1},
  clangoroussoul:{atk:1,def:1,spa:1,spd:1,spe:1}, tidyup:{atk:1,spe:1}, filletaway:{atk:2,spa:2,spe:2} };

const PROTECT=new Set(['protect','detect','spikyshield','kingsshield','banefulbunker','silktrap','burningbulwark','maxguard']);
const REDIRECT=new Set(['followme','ragepowder','spotlight']);
const PIVOT=new Set(['uturn','voltswitch','flipturn','partingshot','teleport','chillyreception']);

function classify(mv){
  const k=key(mv);
  if(INFLICT[k]) return {kind:'status', effect:INFLICT[k]};
  if(SPEEDCTRL[k]) return {kind:'speed', effect:SPEEDCTRL[k]};
  if(SETUP[k]) return {kind:'setup', boosts:SETUP[k]};
  if(PROTECT.has(k)) return {kind:'protect'};
  if(REDIRECT.has(k)) return {kind:'redirect'};
  if(PIVOT.has(k)) return {kind:'pivot'};
  return {kind:'other'};
}
module.exports={ key, classify, INFLICT, SPEEDCTRL, SETUP, PROTECT, REDIRECT, PIVOT };
