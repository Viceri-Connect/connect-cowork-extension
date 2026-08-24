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
import { renderContexto, renderContextoCurto } from '../lib/render.mjs';
import { materializarContexto } from '../lib/contexto-arquivo.mjs';

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

  // M1 — presenca em vez de entrega unica.
  //
  // O bloco completo e materializado no workspace (arquivo que o harness rele) e o
  // stdout carrega so o minimo acionavel + o ponteiro. Motivo medido em 24/08: o
  // bloco unico chegou a ~16 KB, o cliente Cowork truncou, salvou num log de hook e
  // entregou 2 KB de preview — camada 0/1 ausente, sem sinal. Ver
  // `lib/contexto-arquivo.mjs` para a historia completa.
  //
  // Degradacao: se a escrita falhar, emite o bloco INTEIRO no stdout (comportamento
  // <= 0.13.0). Pior, mas nunca contexto ausente — e o bloco curto avisaria o agente
  // de uma leitura que ele nao tem como fazer.
  const completo = renderContexto(report);
  const arquivo = materializarContexto({ workspace: report.workspace, bloco: completo });

  if (arquivo.status === 'materializado') {
    process.stdout.write(renderContextoCurto(report, arquivo));
  } else {
    process.stderr.write(`[connect] contexto nao materializado (${arquivo.status}: ${arquivo.motivo || '—'}) — emitindo bloco inteiro no stdout\n`);
    process.stdout.write(completo);
  }
  process.exit(0);
}

main();
