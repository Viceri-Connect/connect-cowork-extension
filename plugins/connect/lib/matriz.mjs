// connect/lib/matriz.mjs
// Leitura da matriz e do cerebro pessoal para (a) restaurar a identidade do
// operador e (b) montar a carga inicial de contexto "lazy camada 1" (L1).
//
// Filosofia (ADR-6, token-efficiency lazy): L1 nao despeja o vault inteiro no
// contexto. Ela traz o minimo sempre-ligado — identidade + verdades globais da
// matriz — e PONTEIROS relativos para o resto, que o agente le sob demanda.
//
// Camada 1 (sempre): identidade do operador + a CARTA DE NAVEGACAO do vault
//   (`_cerebro/camada-1.md`), injetada verbatim.
//
// MUDANCA DE CONTRATO (0.12.0): a camada 1 e DECLARADA PELO VAULT, nunca
// prescrita pelo produto. Antes, `montarL1` emitia um conjunto fixo de ponteiros
// (`modelo-roteamento`, `organizacao`, `projetos/`...) — o produto decidindo os
// eixos do vault, contradicao direta com D98, e `ponteiros: []` em qualquer
// vault que nao seguisse esses nomes. Agora o mecanismo le a carta (contrato em
// config/contrato-navegacao.md) e, na ausencia dela, reporta LACUNA — jamais
// inventa ponteiro (D97: ausencia e gatilho de nascimento, nao erro).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerCarta } from './navegacao.mjs';

// Raiz deste modulo — usada para achar a config de mecanismo do proprio plugin,
// de forma robusta ao local de instalacao (nunca path absoluto de maquina).
const HERE = path.dirname(fileURLToPath(import.meta.url));

function readIfExists(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      // Tolera BOM (editores Windows gravam UTF-8 com BOM).
      return fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
    }
  } catch { /* ignore */ }
  return null;
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
  const asList = (v) => (v || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.replace(/["']/g, '').trim())
    .filter(Boolean);

  const papeis = asList(kv['papeis-estaveis']);
  // Campo generico (agnostico de empresa): `emails` (lista) ou `email` (escalar).
  // NUNCA um campo especifico de empresa (ex.: `email-viceri`) — isso e conteudo
  // da instancia, nao contrato do produto.
  const emails = asList(kv['emails'] || kv['email']);

  return {
    _origem: cfgPath,
    nome: kv['nome'] || null,
    email: emails[0] || null,
    emails,
    papeis,
  };
}

// ---------------------------------------------------------------------------
// L1 — carga inicial de contexto de UM vault (a matriz ou qualquer sub-vault:
// a forma e a mesma em todos os niveis, corolario do D97).
//
// Duas partes, ambas do proprio vault:
//   - identidadeVault — `_cerebro/vault-config.md` (camada machine-readable:
//     empresa, contexto, ponto focal). Curto, lido inline.
//   - carta          — `_cerebro/camada-1.md`, a navegacao DECLARADA pelo vault
//     (por onde entra, o que carrega por gatilho, onde termina). Injetada
//     verbatim pelo render. Ausente => lacuna anunciada, nunca suprida.
// ---------------------------------------------------------------------------
export function montarL1(matrizRoot, aliasMatriz = 'matriz') {
  const cerebro = path.join(matrizRoot, '_cerebro');
  const vaultConfig = readIfExists(path.join(cerebro, 'vault-config.md'));
  const carta = lerCarta(matrizRoot, aliasMatriz);

  return {
    identidadeVault: parseKeyValues(vaultConfig), // empresa, cliente, contexto, ponto focal
    vaultConfigInline: vaultConfig,
    alias: aliasMatriz,
    carta,
    avisos: carta.avisos,
  };
}

// ---------------------------------------------------------------------------
// L1 do cerebro pessoal — Camada 0 do operador (D104).
// O bootstrap montava so a identidade (`meu-config.md`) e ignorava o hot cache
// pessoal; esta funcao carrega a Camada 0 pessoal SEMPRE, junto do L1 da matriz.
// A espinha do mecanismo NAO vem daqui — vem de `lerProtocoloMecanismo()` (e do
// produto). Aqui fica so o DELTA pessoal (o que sobra no `_cerebro/CLAUDE.md`
// depois do corte: interpretacao pessoal, projetos-exemplo, indice de memoria).
// ---------------------------------------------------------------------------
export function montarL1Pessoal(cerebroPessoalRoot, aliasPessoal = 'pessoal') {
  if (!cerebroPessoalRoot) return null;
  const hotCache = readIfExists(path.join(cerebroPessoalRoot, '_cerebro', 'CLAUDE.md'));

  const ponteiros = [];
  const addPtr = (rel, nota) => {
    if (fs.existsSync(path.join(cerebroPessoalRoot, rel))) {
      ponteiros.push({ caminho: `./${aliasPessoal}/${rel}`, nota });
    }
  };
  addPtr('CLAUDE.md', 'camada 0 minima da raiz do cerebro pessoal');
  addPtr('_cerebro/memory', 'memoria profunda (indice)');
  addPtr('30-Áreas', 'interpretacao pessoal de papeis/metodologias (delta do coletivo)');
  addPtr('TASKS.md', 'kanban pessoal');

  return {
    hotCacheInline: hotCache, // _cerebro/CLAUDE.md pessoal (delta), inline por ser curto
    ponteiros,
  };
}

// ---------------------------------------------------------------------------
// Protocolo do mecanismo — a espinha dorsal do dois-cerebros, entregue pelo
// PRODUTO (D104/D96). Vive no proprio plugin (`config/protocolo-mecanismo.md`)
// e e injetada no bloco de sessao pelo render — garantia estrutural de que o
// protocolo executa, sem depender de arquivo do operador. Retorna o markdown
// (ou null se, por algum motivo de empacotamento, o arquivo faltar).
// ---------------------------------------------------------------------------
export function lerProtocoloMecanismo() {
  return readIfExists(path.join(HERE, '..', 'config', 'protocolo-mecanismo.md'));
}
