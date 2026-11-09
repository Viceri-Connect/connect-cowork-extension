#!/usr/bin/env node
import fs from 'node:fs';
import { contextoDeInicio } from '../lib/bootstrap.mjs';

let payload = {};
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch { /* Continue without optional session metadata. */ }

try {
  const sessionId = payload.session_id || payload.sessionId;
  const context = contextoDeInicio({ sessionId }).texto;
  process.stdout.write(JSON.stringify(context.trim() ? { additionalContext: context } : {}));
} catch (error) {
  process.stderr.write(`[connect] session bootstrap failed: ${error.message}\n`);
  process.stdout.write('{}');
}
