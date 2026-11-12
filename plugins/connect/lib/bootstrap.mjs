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
// 0.41.0 — `host`: fora do Cowork o pedido de acesso vai inteiro so na 1a sessao do host
// e quando as pastas mudam (ver registrarOrientacaoDeAcesso); nas outras, um lembrete.
//
// Erro do iniciarSessao propaga: cada hook decide como registrar sem derrubar o host.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { iniciarSessao, estadoSessao } from './session.mjs';
import { renderContextoCurto, renderSessaoNuvem } from './render.mjs';
import { execucaoNaNuvem } from './ambiente.mjs';

// Hosts cujo pedido de acesso e lembrado entre sessoes. O Cowork concede por sessao.
const HOSTS_COM_MEMORIA_DE_ACESSO = new Set(['codex', 'copilot', 'antigravity']);

// 'completo' na 1a sessao do host e quando o conjunto de pastas muda; 'lembrete' depois.
// A marca fica em {CONNECT_HOME}/hosts/{host}.json — estado da maquina, como o resto do
// CONNECT_HOME. Sem conseguir ler ou gravar a marca, pede de novo: pedir a mais e seguro,
// pedir a menos nao.
export function registrarOrientacaoDeAcesso(report, host) {
  const c = report?.concessao;
  if (!c?.necessaria || !HOSTS_COM_MEMORIA_DE_ACESSO.has(host)) return 'completo';
  const pastas = [c.caminho, ...(c.origens || []).map((o) => o.caminho)].map((p) => path.resolve(String(p))).sort();
  const assinatura = createHash('sha256').update(JSON.stringify(pastas)).digest('hex');
  const marca = path.join(c.caminho, 'hosts', `${host}.json`);
  try {
    if (JSON.parse(fs.readFileSync(marca, 'utf8')).assinatura === assinatura) return 'lembrete';
  } catch { /* sem marca: 1a sessao neste host */ }
  try {
    fs.mkdirSync(path.dirname(marca), { recursive: true });
    fs.writeFileSync(marca, `${JSON.stringify({ host, assinatura, pastas, orientadoEm: new Date().toISOString() }, null, 2)}\n`);
  } catch { /* sem escrita: a proxima sessao pede de novo */ }
  return 'completo';
}

export function contextoDeInicio({ sessionId = null, env = process.env, host = 'claude' } = {}) {
  if (execucaoNaNuvem(env)) {
    let configurado = false;
    try { configurado = estadoSessao({}).configurado; } catch { /* sem config legivel = nao configurado */ }
    if (!configurado) return { nuvem: true, texto: renderSessaoNuvem() };
  }
  const report = iniciarSessao({ sessionId });
  const acesso = registrarOrientacaoDeAcesso(report, host);
  return { nuvem: false, acesso, texto: renderContextoCurto(report, { host, acesso }) };
}
