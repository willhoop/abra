// EXPERIMENT: the bench with V8's GC on the main thread only (no helper threads), set at run time.
require('v8').setFlagsFromString(process.env.STGC_FLAGS || '--single-threaded-gc');
const BENCH = 'C:\\Users\\willj\\Projects\\Pokemon\\ABRA\\.claude\\worktrees\\agent-a0ffd3be7ba08dc95\\solver\\bench\\deadline_bench.js';
process.argv = [process.argv[0], BENCH].concat(process.argv.slice(2));
require(BENCH);
