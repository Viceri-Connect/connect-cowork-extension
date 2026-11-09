#!/usr/bin/env node
import fs from 'node:fs';
import { iniciarSessao } from '../lib/session.mjs';
import { renderContextoCurto } from '../lib/render.mjs';

let payload = {};
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch { /* Continue without optional session metadata. */ }

try {
  const sessionId = payload.session_id || payload.sessionId;
  const context = renderContextoCurto(iniciarSessao({ sessionId }));
  const output = context.trim()
    ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }
    : {};
  process.stdout.write(JSON.stringify(output));
} catch (error) {
  process.stderr.write(`[connect] Codex session bootstrap failed: ${error.message}\n`);
  process.stdout.write('{}');
}
