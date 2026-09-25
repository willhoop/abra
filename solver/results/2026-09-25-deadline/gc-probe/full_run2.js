// The full deadline measurement, final code. Two lanes, one core each, runs in sequence per lane, through tools\lownode.cmd.
// Each bench writes its own stdout/stderr to a file (not a pipe to this driver), so this driver dying cannot kill a run.
// Lane A (core 15): the deliberate break first (pool 1 s x300, 5 s x100), then pool 1 s x2000, pool 5 s x2000.
// Lane B (core 14): serial (collectIdle between decisions) 1 s x2000, 5 s x2000.
const cp = require('child_process');
const fs = require('fs');
const WT = 'C:\\Users\\willj\\Projects\\Pokemon\\ABRA\\.claude\\worktrees\\agent-a0ffd3be7ba08dc95';
const LOG = __dirname + '\\full_run2.log';
const LOAD = ['--burn', '1', '--starve', '0.35', '--idle', '0.2'];
const lanes = {
  A: [
    { env: { MILTANK_DEADLINE_BREAK: '1' }, args: ['--lane', 'pool', '--workers', '1', '--budget', '1000', '--decisions', '300', '--core', '15', ...LOAD, '--tag', 'final-BREAK'] },
    { env: { MILTANK_DEADLINE_BREAK: '1' }, args: ['--lane', 'pool', '--workers', '1', '--budget', '5000', '--decisions', '100', '--core', '15', ...LOAD, '--tag', 'final-BREAK'] },
    { args: ['--lane', 'pool', '--workers', '1', '--budget', '1000', '--decisions', '2000', '--core', '15', ...LOAD, '--tag', 'final'] },
    { args: ['--lane', 'pool', '--workers', '1', '--budget', '5000', '--decisions', '2000', '--core', '15', ...LOAD, '--tag', 'final'] },
  ],
  B: [
    { args: ['--lane', 'serial', '--idle-gc', '--budget', '1000', '--decisions', '2000', '--core', '14', ...LOAD, '--tag', 'final'] },
    { args: ['--lane', 'serial', '--idle-gc', '--budget', '5000', '--decisions', '2000', '--core', '14', ...LOAD, '--tag', 'final'] },
  ],
};
const log = s => fs.appendFileSync(LOG, new Date().toISOString() + ' ' + s + '\n');
async function lane(name, runs) {
  for (const [k, r] of runs.entries()) {
    const outFile = __dirname + '\\run2-' + name + k + '.out';
    const fd = fs.openSync(outFile, 'w');
    log(name + ' START ' + r.args.join(' ') + ' ' + JSON.stringify(r.env || {}) + ' -> ' + outFile);
    const code = await new Promise(res => {
      const c = cp.spawn('cmd.exe', ['/c', 'tools\\lownode.cmd', 'solver/bench/deadline_bench.js', '--release', 'eaa5becc54eb', ...r.args],
        { cwd: WT, stdio: ['ignore', fd, fd], env: Object.assign({}, process.env, { MILTANK_DEADLINE_BREAK: '' }, r.env || {}) });
      log(name + ' cmd pid ' + c.pid);
      c.on('exit', res);
    });
    fs.closeSync(fd);
    log(name + ' EXIT ' + code);
  }
}
Promise.all(Object.entries(lanes).map(([n, r]) => lane(n, r))).then(() => log('ALL DONE'));
