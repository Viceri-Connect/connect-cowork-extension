// connect/lib/config-local.mjs
// Escrita das TABELAS LOCAIS do connect.config.json — o unico lugar onde path de
// maquina pode existir (D35: path e sempre por-operador, por-maquina; nunca conteudo
// coletivo, nunca frontmatter de manifesto).
//
// Duas tabelas hoje, mesma mecanica:
//   subVaults: { conceito: caminho }  — acervo de conhecimento (montado como junction)
//   repos:     { conceito: caminho }  — repositorio de codigo (nunca montado; ver repos.mjs)
//
// Extrair este modulo evitou a terceira copia da mesma funcao de gravacao: o
// primitivo de repo (P64) precisava exatamente do mecanismo que `registrarSubVaultLocal`
// ja tinha inline. Tabela nova entra aqui, nao em copia.
//
// Zero dependencias externas.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureDir } from './mount.mjs';

const clean = (v) => (typeof v === 'string' && v.trim() && !v.includes('${') ? v.trim() : null);

export function defaultConnectHome() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'Connect');
  }
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'connect');
}

export function caminhoConfig(home) {
  const base = clean(home) || clean(process.env.CONNECT_HOME) || defaultConnectHome();
  return { base, cfgPath: path.join(base, 'connect.config.json') };
}

export function lerConfigBruta(home) {
  const { cfgPath } = caminhoConfig(home);
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    // NUNCA tratar config ilegivel como vazia: a gravacao seguinte apagaria
    // vaultMatriz/cerebroPessoal/subVaults/repos em silencio — o operador perderia
    // a configuracao inteira sem saber por que (achado na revisao da 0.12.0).
    const err = new Error(`config ilegivel em ${cfgPath}: ${e.message}`);
    err.code = 'CONFIG_ILEGIVEL';
    err.configPath = cfgPath;
    throw err;
  }
}

// Escrita atomica: grava num .tmp no MESMO diretorio e renomeia. rename() e
// atomico no mesmo volume — sem isso, uma falha no meio do write deixa o config
// truncado, e config truncado (ver lerConfigBruta) e perda de configuracao.
export function gravarAtomico(cfgPath, obj) {
  const tmp = `${cfgPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, cfgPath);
}

// ---------------------------------------------------------------------------
// gravarChaveLocal — grava { chave: caminho } numa tabela local do config.
// Valida que o diretorio existe (o modo de falha mais comum e OneDrive
// cloud-only: o path "existe" no Explorer e nao no filesystem).
// ---------------------------------------------------------------------------
export function gravarChaveLocal({ home, tabela, chave, caminho } = {}) {
  if (!tabela) return { status: 'erro', motivo: 'tabela ausente' };
  if (!chave) return { status: 'erro', motivo: 'chave ausente' };

  const p = caminho ? path.resolve(caminho) : null;
  if (!p || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    return {
      status: 'invalido',
      tabela,
      chave,
      caminho,
      motivo: 'path nao existe ou nao e diretorio (se for OneDrive, sincronize "manter neste dispositivo")',
    };
  }

  const { base, cfgPath } = caminhoConfig(home);
  ensureDir(base);

  let atual;
  try {
    atual = lerConfigBruta(home);
  } catch (e) {
    if (e.code === 'CONFIG_ILEGIVEL') {
      return {
        status: 'config-ilegivel',
        configPath: e.configPath,
        tabela,
        chave,
        motivo: `${e.message} — NAO sobrescrevi para nao apagar a configuracao existente. Corrija o arquivo (ou apague-o para reconfigurar) antes de repetir.`,
      };
    }
    throw e;
  }

  atual[tabela] = { ...(atual[tabela] || {}), [chave]: p };
  gravarAtomico(cfgPath, atual);
  return { status: 'gravado', configPath: cfgPath, tabela, chave, caminho: p };
}

// ---------------------------------------------------------------------------
// gravarConfigBruta — grava o objeto de config inteiro, atomicamente. Usada pela
// configuracao guiada (gravarConfig, em session.mjs); tabelas locais preferem
// gravarChaveLocal, que faz o merge de uma chave so.
// ---------------------------------------------------------------------------
export function gravarConfigBruta(home, obj) {
  const { base, cfgPath } = caminhoConfig(home);
  ensureDir(base);
  gravarAtomico(cfgPath, obj);
  return { configPath: cfgPath };
}
