#!/usr/bin/env node
// Cross-platform `WG_SLOW=1 vitest run` (works in Windows cmd too).
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run'], { stdio: 'inherit', env: { ...process.env, WG_SLOW: '1' } });
process.exit(r.status ?? 1);
