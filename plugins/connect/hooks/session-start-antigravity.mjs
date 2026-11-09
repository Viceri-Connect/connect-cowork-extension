#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hookRoot = path.dirname(fileURLToPath(import.meta.url));
let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch { /* Continue without optional hook metadata. */ }

const sessionId = payload.conversationId || payload.sessionId || payload.session_id;
const child = spawnSync(process.execPath, [path.join(hookRoot, 'session-start.mjs')], {
  input: JSON.stringify({ session_id: sessionId }),
  encoding: 'utf8',
  env: process.env,
  windowsHide: true,
});

if (child.error) process.stderr.write(`[connect] ${child.error.message}\n`);
if (child.stderr) process.stderr.write(child.stderr);
const context = child.stdout?.trim();
process.stdout.write(JSON.stringify({
  injectSteps: context ? [{ systemMessage: { systemMessage: context } }] : [],
}));