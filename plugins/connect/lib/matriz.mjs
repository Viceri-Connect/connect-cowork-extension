// connect/lib/matriz.mjs
// Leitura da matriz e do cerebro pessoal para (a) restaurar a identidade do
// operador e (b) montar a carga inicial de contexto "lazy camada 1" (L1).
//
// Filosofia (ADR-6, token-efficiency lazy): L1 nao despeja o vault inteiro no
// contexto. Ela traz o minimo sempre-ligado — identidade + verdades globais da
// matriz — e PONTEIROS relativos para o resto, que o agente le sob demanda.
//
// Camada 1 (sempre): identidade do operador + `_cerebro/vault-config.md` da
//   matriz (verdades globais) inline, por serem curtos e definirem "quem/como".
// Ponteiros (sob demanda): modelo-roteamento, metodologias, projetos, skills.
//
// O que e a camada 1 hoje esta hardcodado num conjunto sensato; a definicao
// canonica de camadas por TIPO de vault e trabalho do trilho de tipologia
// (manifesto de vault + molde da matriz) e entra aqui depois via manifesto.

import fs from 'node:fs';
import path from 'node:path';

function readIfExists(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      // Tolera BOM (editores Windows gravam UTF-8 com BOM).
      return fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
    }
  } catch { /* ignore */ }
  return null;
}

function listDirs(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch { return []; }
}

// Extrai pares "key: value" de linhas markdown do tipo "- key: value" ou "key: value".
// Remove aspas e comentarios ao estilo YAML (# ...).
function parseKeyValues(md) {
  const out = {};
  if (!md) return out;
  const re = /^\s*-?\s*([a-zA-Z0-9_.\-]+)\s*:\s*(.+?)\s*$/;
  for (const raw of md.split(/\r?\n/)) {
    const m = raw.match(re);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/\s+#.*$/, '').trim(); // tira comentario inline
    val = val.replace(/^["'](.*)["']$/, '$1');    // tira aspas
    if (!(key in out)) out[key] = val;            // primeira ocorrencia vence
  }
  return out;
}

// ---------------------------------------------------------------------------
// Identidade do operador — lida do cerebro pessoal (_cerebro/meu-config.md).
// Retorna null se o cerebro pessoal nao estiver disponivel (identidade opcional
// no POC: a sessao sobe mesmo sem ela, so avisa).
// ---------------------------------------------------------------------------
export function lerIdentidade(cerebroPessoalRoot) {
  if (!cerebroPessoalRoot) return null;
  const cfgPath = path.join(cerebroPessoalRoot, '_cerebro', 'meu-config.md');
  const md = readIfExists(cfgPath);
  if (!md) return { _origem: cfgPath, _ausente: true };

  const kv = parseKeyValues(md);
  const papeis = (kv['papeis-estaveis'] || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.replace(/["']/g, '').trim())
    .filter(Boolean);

  return {
    _origem: cfgPath,
    nome: kv['nome'] || null,
    email: kv['email-viceri'] || kv['email'] || null,
    papeis,
  };
}

// ---------------------------------------------------------------------------
// L1 — carga inicial de contexto da matriz.
// Retorna conteudo inline curto (vault-config) + ponteiros relativos ao alias
// da matriz no workspace, para o agente seguir sob demanda.
// ---------------------------------------------------------------------------
export function montarL1(matrizRoot, aliasMatriz = 'matriz') {
  const cerebro = path.join(matrizRoot, '_cerebro');
  const vaultConfig = readIfExists(path.join(cerebro, 'vault-config.md'));

  const ponteiros = [];
  const addPtr = (rel, nota) => {
    if (fs.existsSync(path.join(matrizRoot, rel))) {
      ponteiros.push({ caminho: `./${aliasMatriz}/${rel}`, nota });
    }
  };
  addPtr('_cerebro/modelo-roteamento.md', 'o que vai para onde; regra de forma/despromocao');
  addPtr('_cerebro/CLAUDE.md', 'hot cache humano da matriz');
  addPtr('_cerebro/metodologias', 'processo / metodologias (SDD, papeis)');
  addPtr('_inteligencia/convencao-skills.md', 'protocolo de inicializacao das skills + requer-diretorios');
  addPtr('organizacao', 'organizacao: identidade, politicas, tribos/squads');

  const projetos = listDirs(path.join(matrizRoot, 'projetos'))
    .map((nome) => ({ nome, caminho: `./${aliasMatriz}/projetos/${nome}` }));

  return {
    identidadeVault: parseKeyValues(vaultConfig), // empresa, cliente, contexto, ponto focal
    vaultConfigInline: vaultConfig,
    ponteiros,
    projetos,
  };
}
