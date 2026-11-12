#!/usr/bin/env node
import fs from 'node:fs';
import { contextoDeInicio } from '../lib/bootstrap.mjs';
import { jsonAscii } from '../lib/saida-hook.mjs';

let payload = {};
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch { /* Continue without optional session metadata. */ }

try {
  const sessionId = payload.session_id || payload.sessionId;
  const context = contextoDeInicio({ sessionId, host: 'copilot' }).texto;
  process.stdout.write(jsonAscii(context.trim() ? { additionalContext: context } : {}));
} catch (error) {
  process.stderr.write(`[connect] session bootstrap failed: ${error.message}\n`);
  process.stdout.write('{}');
}
