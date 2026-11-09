// connect/lib/bootstrap.mjs
// O texto que TODO hook de SessionStart injeta — Claude/Cowork, Codex, Copilot e
// Antigravity. Cada host so muda o envelope (texto puro, hookSpecificOutput,
// additionalContext, injectSteps); a decisao do que dizer mora aqui, uma vez.
//
// 0.40.0 — Sessao na nuvem sem configuracao local: o estado do operador esta no PC
// dele, fora do alcance deste processo. Orientar, nunca diagnosticar (lib/ambiente.mjs).
// Com configuracao presente aqui (Connect instalado de fato no servidor), segue o normal.
// 0.41.0 — a regra saiu do hook do Claude para ca: os hooks de Codex e Copilot chamavam
// iniciarSessao direto e, na nuvem, diagnosticavam "1o uso" como o do Claude fazia antes.
//
// Erro do iniciarSessao propaga: cada hook decide como registrar sem derrubar o host.

import { iniciarSessao, estadoSessao } from './session.mjs';
import { renderContextoCurto, renderSessaoNuvem } from './render.mjs';
import { execucaoNaNuvem } from './ambiente.mjs';

export function contextoDeInicio({ sessionId = null, env = process.env } = {}) {
  if (execucaoNaNuvem(env)) {
    let configurado = false;
    try { configurado = estadoSessao({}).configurado; } catch { /* sem config legivel = nao configurado */ }
    if (!configurado) return { nuvem: true, texto: renderSessaoNuvem() };
  }
  return { nuvem: false, texto: renderContextoCurto(iniciarSessao({ sessionId })) };
}
