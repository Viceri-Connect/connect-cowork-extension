#!/usr/bin/env node
// connect/hooks/session-start.mjs
// Executado pelo hook SessionStart (type: command — baseline provado).
// Le o payload do hook no stdin (Claude Code entrega JSON com session_id),
// chama iniciarSessao() e imprime no stdout o bloco de contexto da sessao,
// que o Cowork injeta no contexto do agente.
//
// stdout = contexto para a sessao. Logs de diagnostico vao para stderr.
// Nunca derruba a sessao: qualquer falha vira aviso, exit 0.

import { iniciarSessao } from '../lib/session.mjs';
import { renderContexto } from '../lib/render.mjs';

function lerStdin() {
  return new Promise((resolve) => {
    let data = '';
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(data); } };
    if (process.stdin.isTTY) return finish();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', finish);
    // Nao trava o hook esperando stdin que nunca fecha.
    setTimeout(finish, 500);
  });
}

async function main() {
  let sessionId = process.env.CLAUDE_SESSION_ID || process.env.CONNECT_SESSION_ID || null;
  try {
    const raw = await lerStdin();
    if (raw && raw.trim()) {
      const payload = JSON.parse(raw);
      sessionId = payload.session_id || payload.sessionId || sessionId;
    }
  } catch { /* sem payload utilizavel; segue com env/gerado */ }

  let report;
  try {
    report = iniciarSessao({ sessionId });
  } catch (e) {
    process.stderr.write(`[connect] falha no iniciar_sessao: ${e.message}\n`);
    process.exit(0);
  }

  process.stdout.write(renderContexto(report));
  process.exit(0);
}

main();
