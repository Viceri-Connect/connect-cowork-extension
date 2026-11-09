#!/usr/bin/env node
// Hook de SessionStart do Antigravity: o mesmo bootstrap dos outros hosts
// (lib/bootstrap.mjs), no envelope `injectSteps` do Antigravity.
//
// 0.41.0 — chamava o hooks/session-start.mjs num segundo processo Node; agora chama o
// bootstrap direto (um processo a menos dentro do timeout do host) e devolve JSON em
// ASCII (lib/saida-hook.mjs), que atravessa o PowerShell do Windows sem perder acento.
import { readFileSync } from 'node:fs';
import { contextoDeInicio } from '../lib/bootstrap.mjs';
import { jsonAscii } from '../lib/saida-hook.mjs';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch { /* Continue without optional hook metadata. */ }

let context = '';
try {
  const sessionId = payload.conversationId || payload.sessionId || payload.session_id;
  context = contextoDeInicio({ sessionId, host: 'antigravity' }).texto.trim();
} catch (error) {
  process.stderr.write(`[connect] falha no iniciar_sessao: ${error.message}\n`);
}
process.stdout.write(jsonAscii({
  injectSteps: context ? [{ systemMessage: { systemMessage: context } }] : [],
}));
