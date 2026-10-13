#!/usr/bin/env node
// connect/hooks/session-start.mjs
// Executado pelo hook SessionStart (type: command — baseline provado).
// Le o payload do hook no stdin (Claude Code entrega JSON com session_id),
// chama iniciarSessao() e imprime no stdout o bloco de contexto da sessao,
// que o Cowork injeta no contexto do agente.
//
// stdout = contexto para a sessao. Logs de diagnostico vao para stderr.
// Nunca derruba a sessao: qualquer falha vira aviso, exit 0.
//
// 0.38.0 — CANAL UNICO. O stdout leva acionavel + identidade + regras duras +
// ponteiro da camada 1 + a CAMADA 0 do operador, dentro do teto de 10.000
// caracteres do cliente (`TETO_INJETADO` em lib/render.mjs). O `contexto-sessao.md`
// saiu: medido em 13/10, dos 22 KB dele so a camada 0 era exclusiva, e ele morava
// num caminho que pede concessao a cada sessao — o agente nao abria, e a camada 0
// sumia sem sinal. Releitura sob demanda = tool `iniciar_sessao`.

import { iniciarSessao } from '../lib/session.mjs';
import { renderContextoCurto } from '../lib/render.mjs';

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

  process.stdout.write(renderContextoCurto(report));
  process.exit(0);
}

main();
