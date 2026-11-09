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
  const context = contextoDeInicio({ sessionId }).texto;
  const output = context.trim()
    ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }
    : {};
  process.stdout.write(jsonAscii(output));
} catch (error) {
  process.stderr.write(`[connect] Codex session bootstrap failed: ${error.message}\n`);
  process.stdout.write('{}');
}
