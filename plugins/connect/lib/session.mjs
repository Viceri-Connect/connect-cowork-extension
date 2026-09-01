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
// Fonte unica de CONNECT_HOME e da escrita do config (nao reimplementar aqui:
// duas resolucoes independentes do mesmo cfgPath divergem com o tempo).
import { gravarChaveLocal, defaultConnectHome, caminhoConfig, lerConfigBruta, gravarConfigBruta, migrarHomeLegado } from './config-local.mjs';

const ALIAS_MATRIZ = 'matriz';
const ALIAS_PESSOAL = 'pessoal';
const ALIAS_OPERADOR = 'operador';

// Descarta valores vazios ou placeholders de env nao substituidos (ex.: quando
// o .mcp.json declara "${CONNECT_HOME}" e o host nao tem essa env var — o
// launcher pode deixar passar o literal em vez de omitir a chave).
const clean = (v) => (typeof v === 'string' && v.trim() && !v.includes('${') ? v.trim() : null);

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
    // subVaults: { conceito: caminhoAbsoluto } — tabela LOCAL, por-maquina, de onde
    // cada sub-vault mora nesta maquina (D35). Chave e o `conceito` do manifesto
    // (mesmo campo usado pra casar — nunca inventamos um `escopo` novo, esse nome
    // ja e usado em toda a matriz pra governanca/cliente, achado no dogfooding).
    // Nunca vem do vault, so daqui. override vence arquivo (mesma precedencia dos
    // demais campos).
    subVaults: { ...(fileCfg.subVaults || {}), ...(override.subVaults || {}) },
    // repos: { conceito: caminhoAbsoluto } — mesma natureza da tabela acima, para
    // REPOSITORIO DE CODIGO (P64). Repo nunca e montado como junction (ver
    // lib/repos.mjs); o primitivo devolve o caminho real da maquina.
    repos: { ...(fileCfg.repos || {}), ...(override.repos || {}) },
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
  // 0. Migracao do home legado (pasta de aplicativo -> perfil do usuario), ANTES de
  // resolver a config: se rodasse depois, a sessao leria um home novo e vazio e
  // pediria a configuracao inteira de novo a quem ja estava configurado.
  const migracao = migrarHomeLegado(override.home);

  const cfg = resolveConfig(override);
  const sid = sanitizeSessionId(sessionId);
  const avisos = [];

  if (migracao.status === 'migrado') {
    avisos.push(`CONNECT_HOME migrado de ${migracao.legado} para ${cfg.home} (${migracao.migrados.join(', ')}) — pasta de aplicativo e inalcancavel pelas file tools do harness. O home antigo foi preservado e marcado, nada foi apagado.`);
  } else if (migracao.status === 'falhou') {
    avisos.push(`migracao do CONNECT_HOME legado falhou: ${migracao.motivo} — a sessao segue no home novo (${cfg.home}), possivelmente sem a config anterior.`);
  }

  // Estado zero: matriz nunca configurada nesta maquina, ou o path gravado
  // nao existe mais (ex.: pasta renomeada/OneDrive nao sincronizado). Esta
  // flag e a fonte de verdade que o render usa para decidir se a sessao abre
  // com o bloco de configuracao guiada ANTES de qualquer outra coisa — nao
  // basta um aviso solto no fim do bloco (achado no dogfooding: 1o uso real
  // nao perguntou o caminho da matriz).
  const matrizConfigurada = !!(cfg.vaultMatriz && fs.existsSync(cfg.vaultMatriz));

  if (cfg.homeOrigem === 'default') {
    avisos.push(`CONNECT_HOME nao configurado — usando a pasta padrao: ${cfg.home}. Grave CONNECT_HOME se quiser outro local (nunca dentro de pasta de aplicativo/sistema).`);
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

  // 3. vault pessoal (ENRIQUECIMENTO OPCIONAL) — montado como ./pessoal se o
  // operador tiver um e o configurar. Deixou de ser requisito: a espinha vem do
  // produto (D104) e a identidade, do perfil gerido no CONNECT_HOME (passo 3b).
  // Um vault Obsidian proprio do usuario CONVIVE — nunca condiciona o mecanismo.
  if (cfg.cerebroPessoal) {
    try {
      mounts.push(mount({ workspaceDir: workspace, alias: ALIAS_PESSOAL, source: cfg.cerebroPessoal, replace: true }));
    } catch (e) {
      avisos.push(`vault pessoal (opcional) nao montado: ${e.message}`);
    }
  }

  // 3b. identidade do operador — perfil GERIDO PELO CONNECT ({CONNECT_HOME}/operador),
  // com fallback para o vault pessoal (back-compat). O perfil no CONNECT_HOME e o que
  // torna o vault pessoal dispensavel: sem ele, a identidade ainda e restaurada.
  const perfilOperador = path.join(cfg.home, 'operador');

  // 3c. monta ./operador (SEMPRE) — superficie de escrita do estado do operador gerido
  // pelo Connect (TASKS.md, delta de identidade). Nao e conteudo de vault (fora do
  // contrato cnct-nucleo-escrita); precisa de alias proprio para o executor de
  // encerramento (cnct-nucleo-encerramento) escrever la via file tools do Cowork —
  // mesma exigencia de acesso de qualquer outro mount (nao concede leitura por si so).
  try {
    ensureDir(perfilOperador);
    mounts.push(mount({ workspaceDir: workspace, alias: ALIAS_OPERADOR, source: perfilOperador, replace: true }));
  } catch (e) {
    avisos.push(`perfil do operador (./operador) nao montado: ${e.message}`);
  }

  let identidade = lerIdentidade(perfilOperador);
  if (identidade && identidade._ausente && cfg.cerebroPessoal) {
    const alt = lerIdentidade(cfg.cerebroPessoal);
    if (alt && !alt._ausente) identidade = alt;
  }
  if (!identidade || identidade._ausente) {
    identidade = null;
    avisos.push('perfil do operador ainda nao provisionado ({CONNECT_HOME}/operador) — rode a cnct-fabrica-operador para materializa-lo. O vault pessoal Obsidian e opcional.');
  }

  // 4. carga L1 da matriz
  let l1 = null;
  if (cfg.vaultMatriz && fs.existsSync(cfg.vaultMatriz)) {
    l1 = montarL1(cfg.vaultMatriz, ALIAS_MATRIZ);
    // A governanca da raiz (`l1.governanca`) NAO vira aviso aqui: o render a emite
    // como secao propria no topo do bloco acionavel, porque aviso no fim ja se
    // provou insuficiente para o agente parar e agir (licao da 0.12.1).
  }

  // 4b. Camada 0 do operador (D104) — hot cache/delta. Prefere o perfil gerido no
  // CONNECT_HOME; se ausente, cai no vault pessoal montado (quando houver). A espinha
  // NAO vem daqui (vem de lerProtocoloMecanismo) — aqui e so o delta do operador.
  // O gate NAO pode ser `fs.existsSync(perfilOperador)`: o passo 3c faz ensureDir()
  // nessa mesma pasta, entao ela existe SEMPRE a partir da 1a sessao e o fallback
  // ficava inalcancavel — operador com vault legado perdia a Camada 0 em silencio
  // (P75). O gate certo e a presenca de CONTEUDO de Camada 0, nao da pasta.
  let l1Pessoal = montarL1Pessoal(perfilOperador, ALIAS_OPERADOR);
  if ((!l1Pessoal || l1Pessoal.hotCacheOrigem === 'ausente') && cfg.cerebroPessoal && fs.existsSync(cfg.cerebroPessoal)) {
    const alt = montarL1Pessoal(cfg.cerebroPessoal, ALIAS_PESSOAL);
    if (alt && alt.hotCacheOrigem !== 'ausente') l1Pessoal = alt;
  }
  if (l1Pessoal?.avisos?.length) avisos.push(...l1Pessoal.avisos);

  // Estado zero do OPERADOR — mesma natureza de `matrizConfigurada` (0.12.1): a flag
  // e a fonte de verdade que o render usa para abrir a sessao com o bloco de
  // provisionamento ANTES de qualquer outra coisa. Aviso solto no fim do bloco ja se
  // provou insuficiente para o agente parar e agir — foi exatamente o defeito que a
  // 0.12.1 corrigiu para a matriz e deixou de corrigir para o operador.
  const operadorProvisionado = !!identidade && l1Pessoal?.hotCacheOrigem !== 'ausente';

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
    matrizConfigurada,
    operadorProvisionado,
    // Concessao de acesso — contrato ESTRUTURAL, nao instrucao em prosa (P90).
    // Ate a 0.12.2 a exigencia vivia so no texto da skill ("resolvido -> pedir acesso
    // ao Cowork") e dois agentes independentes a contornaram (D148, 3 recorrencias).
    // O mecanismo passa a devolver o pedido pronto, com o caminho exato: uma pasta so,
    // porque o workspace e a porta unica para todas as origens montadas nele.
    //
    // M2 (24/08) — a promessa de "uma concessao so" foi RETIRADA, por medicao.
    // O D149 concluiu que junction com destino no perfil do usuario ou no OneDrive
    // e lida "inclusive SEM conceder a origem separadamente". Medido em 24/08, em
    // sessao real: conceder o CONNECT_HOME nao alcancou `./matriz` nem o sub-vault
    // resolvido — as tres origens (duas no OneDrive) tiveram de ser concedidas uma a
    // uma. A causa nao e o momento do mount (pre-montar nao resolveria): o harness
    // aplica politica sobre o DESTINO REAL da junction, e destino sincronizado por
    // OneDrive exige concessao propria.
    //
    // Consequencia de produto: o mecanismo para de prometer o que nao entrega e passa
    // a DECLARAR o que falta. Custo conhecido e melhor que surpresa — e o operador
    // concede uma vez por origem, nao uma vez por sessao.
    concessao: {
      necessaria: true,
      caminho: cfg.home,
      motivo: 'o harness precisa de acesso concedido a esta pasta — ela alcanca o workspace da sessao e o estado do operador',
      alcanca: mounts.filter((m) => m.status === 'mounted').map((m) => `./${m.alias}`),
      origens: mounts
        .filter((m) => m.status === 'mounted' || m.status === 'exists')
        .map((m) => ({ alias: `./${m.alias}`, caminho: m.source })),
    },
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
  const { base, cfgPath } = caminhoConfig(home);
  ensureDir(base);

  // Config ilegivel NAO e tratada como vazia (ver config-local.lerConfigBruta):
  // sobrescrever apagaria matriz/pessoal/subVaults/repos em silencio.
  let atual;
  try {
    atual = lerConfigBruta(home);
  } catch (e) {
    if (e.code === 'CONFIG_ILEGIVEL') {
      return { configPath: e.configPath, gravados: {}, invalidos: [], erro: 'config-ilegivel', motivo: `${e.message} — nada foi gravado. Corrija (ou apague) o arquivo antes de reconfigurar.` };
    }
    throw e;
  }

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

  // grava UTF-8 sem BOM, atomico (tmp + rename)
  gravarConfigBruta(home, atual);
  return { configPath: cfgPath, gravados, invalidos, config: atual };
}

// ---------------------------------------------------------------------------
// registrarSubVaultLocal — grava o path LOCAL (nesta maquina) de UM conceito na
// tabela `subVaults` do connect.config.json. Nunca grava path/url no vault —
// so aqui, por operador, por maquina (D35). Duas origens legitimas de chamada:
//   1. handshake guiado — a skill perguntou ao operador onde o sub-vault mora
//      e grava a resposta (resolver devolveu 'local-nao-configurado');
//   2. fabrica — ao materializar um sub-vault do zero, ja sabe o path que
//      acabou de criar e se auto-registra (nunca precisa perguntar de novo).
// ---------------------------------------------------------------------------
export function registrarSubVaultLocal({ home, conceito, caminho } = {}) {
  if (!conceito) return { status: 'erro', motivo: 'conceito ausente' };
  // Chave SEMPRE normalizada: o `resolver` procura por `entry.conceito`, que e
  // sempre lowercase. Gravar a chave crua (`Alpha-Tribo`) fazia o resolver devolver
  // 'local-nao-configurado' para sempre — loop infinito de handshake, o operador
  // informando o diretorio de novo a cada sessao (achado na revisao da 0.12.0).
  const chave = String(conceito).toLowerCase().trim();
  const r = gravarChaveLocal({ home, tabela: 'subVaults', chave, caminho });
  // preserva o contrato de retorno anterior (conceito, nao chave/tabela)
  return r.status === 'gravado'
    ? { status: 'gravado', configPath: r.configPath, conceito, caminho: r.caminho }
    : { ...r, conceito };
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
