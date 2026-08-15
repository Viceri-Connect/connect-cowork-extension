// connect/lib/session.mjs
// iniciarSessao() — o bootstrap de uma sessao do Connect.
//
// Responsabilidades (POC / fatia 1):
//   1. Cria o scaffold da sessao numa pasta fixa do Connect, FORA do OneDrive
//      ({CONNECT_HOME}/sessions/{session_id}) — nunca dentro de vault sincronizado.
//   2. Monta a MATRIZ como atalho flat "./matriz" no scaffold (junction/symlink).
//   3. Restaura a IDENTIDADE do operador (le o cerebro pessoal na origem).
//   4. Carrega o contexto lazy da CAMADA 1 da matriz (inline curto + ponteiros).
//
// Nao ha entidade "cliente" aqui: o unico mount incondicional e a casca +
// a matriz (o teto de governanca). Sub-vaults descem sob demanda via `resolver`
// (roadmap), acionados pelo protocolo compartilhado das skills.
//
// Fonte dos caminhos: variaveis de ambiente injetadas pelo user_config do
// pacote (CONNECT_HOME, CONNECT_VAULT_MATRIZ, CONNECT_CEREBRO_PESSOAL), com
// fallback para {CONNECT_HOME}/connect.config.json. Nenhum path hardcoded.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mount, ensureDir, listMounts } from './mount.mjs';
import { lerIdentidade, montarL1, montarL1Pessoal, lerProtocoloMecanismo } from './matriz.mjs';

const ALIAS_MATRIZ = 'matriz';
const ALIAS_PESSOAL = 'pessoal';

// Descarta valores vazios ou placeholders de env nao substituidos (ex.: quando
// o .mcp.json declara "${CONNECT_HOME}" e o host nao tem essa env var — o
// launcher pode deixar passar o literal em vez de omitir a chave).
const clean = (v) => (typeof v === 'string' && v.trim() && !v.includes('${') ? v.trim() : null);

function defaultConnectHome() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'Connect');
  }
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'connect');
}

// Resolve a config a partir de env + arquivo local (env vence).
export function resolveConfig(override = {}) {
  const homeOverride = clean(override.home);
  const homeEnv = clean(process.env.CONNECT_HOME);
  let homeOrigem = 'default';
  if (homeOverride) homeOrigem = 'override';
  else if (homeEnv) homeOrigem = 'env';
  const home = homeOverride || homeEnv || defaultConnectHome();

  let fileCfg = {};
  const cfgPath = path.join(home, 'connect.config.json');
  try {
    if (fs.existsSync(cfgPath)) {
      fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
    }
  } catch { /* config invalida e ignorada; a sessao ainda sobe */ }

  return {
    home,
    // 'override' | 'env' | 'default' — quando 'default', home caiu no fallback
    // por SO (nenhuma env var / config explicita); vale anunciar esse caminho
    // ao operador em vez de usa-lo silenciosamente (ver iniciarSessao/render).
    homeOrigem,
    vaultMatriz: override.vaultMatriz || clean(process.env.CONNECT_VAULT_MATRIZ) || clean(fileCfg.vaultMatriz),
    cerebroPessoal: override.cerebroPessoal || clean(process.env.CONNECT_CEREBRO_PESSOAL) || clean(fileCfg.cerebroPessoal),
    _configPath: fs.existsSync(cfgPath) ? cfgPath : null,
  };
}

// Sanitiza o session_id para uso como nome de diretorio.
export function sanitizeSessionId(sessionId) {
  const s = String(sessionId || '').trim();
  const safe = s.replace(/[^a-zA-Z0-9_.\-]/g, '-').replace(/^-+|-+$/g, '');
  return safe || `sess-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// iniciarSessao — orquestra o bootstrap. Nunca lanca por falta de vault:
// coleta avisos e devolve um relatorio; a sessao do Cowork nunca cai por mount.
// ---------------------------------------------------------------------------
export function iniciarSessao({ sessionId, ...override } = {}) {
  const cfg = resolveConfig(override);
  const sid = sanitizeSessionId(sessionId);
  const avisos = [];

  if (cfg.homeOrigem === 'default') {
    avisos.push(`CONNECT_HOME nao configurado — usando pasta padrao sugerida: ${cfg.home}. Conecte esta pasta ao Cowork (ou grave CONNECT_HOME) se quiser outro local.`);
  }

  // 1. scaffold da sessao, fora do OneDrive
  const workspace = path.join(cfg.home, 'sessions', sid);
  ensureDir(workspace);

  // 2. monta a matriz (teto de governanca) como ./matriz
  const mounts = [];
  if (cfg.vaultMatriz) {
    try {
      mounts.push(mount({ workspaceDir: workspace, alias: ALIAS_MATRIZ, source: cfg.vaultMatriz, replace: true }));
    } catch (e) {
      avisos.push(`matriz nao montada: ${e.message}`);
    }
  } else {
    avisos.push('CONNECT_VAULT_MATRIZ nao definido — matriz nao montada. Configure o caminho da matriz.');
  }

  // 3. cerebro pessoal (identidade) como ./pessoal — opcional
  if (cfg.cerebroPessoal) {
    try {
      mounts.push(mount({ workspaceDir: workspace, alias: ALIAS_PESSOAL, source: cfg.cerebroPessoal, replace: true }));
    } catch (e) {
      avisos.push(`cerebro pessoal nao montado: ${e.message}`);
    }
  }

  // 3b. le a identidade direto da origem (robusto a premissa 2 no bootstrap)
  let identidade = null;
  if (cfg.cerebroPessoal) {
    identidade = lerIdentidade(cfg.cerebroPessoal);
    if (identidade && identidade._ausente) avisos.push(`identidade nao encontrada em ${identidade._origem}`);
  } else {
    avisos.push('CONNECT_CEREBRO_PESSOAL nao definido — identidade do operador nao restaurada.');
  }

  // 4. carga L1 da matriz
  let l1 = null;
  if (cfg.vaultMatriz && fs.existsSync(cfg.vaultMatriz)) {
    l1 = montarL1(cfg.vaultMatriz, ALIAS_MATRIZ);
  }

  // 4b. Camada 0 do cerebro pessoal (D104) — o handshake que faltava. Ate aqui
  // o pessoal entrava so como mount + identidade; o hot cache pessoal (delta)
  // nunca era carregado. Agora carrega sempre, junto do L1 da matriz.
  let l1Pessoal = null;
  if (cfg.cerebroPessoal && fs.existsSync(cfg.cerebroPessoal)) {
    l1Pessoal = montarL1Pessoal(cfg.cerebroPessoal, ALIAS_PESSOAL);
  }

  // 4c. Espinha do mecanismo (D104/D96) — protocolo entregue pelo produto,
  // injetado no bloco de sessao. Independe de arquivo do operador.
  const protocoloMecanismo = lerProtocoloMecanismo();
  if (!protocoloMecanismo) {
    avisos.push('protocolo de mecanismo nao encontrado no pacote (config/protocolo-mecanismo.md) — a garantia de protocolo nao foi injetada.');
  }

  return {
    sessionId: sid,
    workspace,
    home: cfg.home,
    homeOrigem: cfg.homeOrigem,
    configPath: cfg._configPath,
    mounts,
    identidade,
    protocoloMecanismo,
    l1,
    l1Pessoal,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// gravarConfig — persiste os caminhos em {CONNECT_HOME}/connect.config.json.
// Usada pela configuracao guiada no 1o uso (a skill connect-bootstrap conduz a
// conversa; esta funcao valida e grava). Atualizacao parcial: so grava as chaves
// informadas cujo path exista como diretorio; reporta as invalidas para re-perguntar.
// ---------------------------------------------------------------------------
export function gravarConfig({ home, vaultMatriz, cerebroPessoal } = {}) {
  const base = clean(home) || clean(process.env.CONNECT_HOME) || defaultConnectHome();
  ensureDir(base);
  const cfgPath = path.join(base, 'connect.config.json');

  let atual = {};
  try {
    if (fs.existsSync(cfgPath)) atual = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
  } catch { /* config corrompida e sobrescrita */ }

  const gravados = {};
  const invalidos = [];
  const tentar = (chave, valor) => {
    if (valor == null || valor === '') return;
    const p = path.resolve(valor);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) { atual[chave] = p; gravados[chave] = p; }
    else invalidos.push({ chave, valor, motivo: 'path nao existe ou nao e diretorio (se for OneDrive, sincronize "manter neste dispositivo")' });
  };
  tentar('vaultMatriz', vaultMatriz);
  tentar('cerebroPessoal', cerebroPessoal);

  // grava UTF-8 sem BOM
  fs.writeFileSync(cfgPath, JSON.stringify(atual, null, 2) + '\n', 'utf8');
  return { configPath: cfgPath, gravados, invalidos, config: atual };
}

// ---------------------------------------------------------------------------
// estadoSessao — checagem leve (sem montar nada): esta configurado? ja montado
// nesta sessao? Deixa a skill decidir se precisa configurar / iniciar / seguir.
// ---------------------------------------------------------------------------
export function estadoSessao({ sessionId } = {}) {
  const cfg = resolveConfig();
  const existeDir = (p) => !!(p && fs.existsSync(p) && fs.statSync(p).isDirectory());
  const configurado = existeDir(cfg.vaultMatriz);

  let workspace = null, montados = [];
  if (sessionId) {
    workspace = path.join(cfg.home, 'sessions', sanitizeSessionId(sessionId));
    if (fs.existsSync(workspace)) montados = listMounts(workspace).map((m) => m.alias);
  }

  return {
    configurado,
    home: cfg.home,
    homeOrigem: cfg.homeOrigem,
    configPath: cfg._configPath,
    matriz: { path: cfg.vaultMatriz, existe: existeDir(cfg.vaultMatriz) },
    pessoal: { path: cfg.cerebroPessoal, existe: existeDir(cfg.cerebroPessoal) },
    workspace,
    montados,
    montadoNestaSessao: montados.includes('matriz'),
  };
}
