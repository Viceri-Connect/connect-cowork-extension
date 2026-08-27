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
import { verificarRaiz } from './governanca.mjs';

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
// GOVERNANCA DA RAIZ (ADR-18, Fase 3): quem ocupa `{vault}/CLAUDE.md` — o slot que
// o harness carrega sozinho e rotula como *override* (D226). O check mora AQUI, e
// nao em session.mjs, porque `montarL1` e o unico ponto por onde passam os dois
// casos que importam: a matriz (eager, no startup) e todo sub-vault (lazy, via
// `resolver`). Um lugar so cobre o grafo inteiro.
//
// E o recorte da ADR-18 §6 cai de graca: `montarL1` e para vault de CONHECIMENTO;
// o perfil do operador entra por `montarL1Pessoal`, onde `CLAUDE.md` e a Camada 0
// legitima e nao pode ser tratada como ocupacao indevida.
export function montarL1(matrizRoot, aliasMatriz = 'matriz') {
  const cerebro = path.join(matrizRoot, '_cerebro');
  const vaultConfig = readIfExists(path.join(cerebro, 'vault-config.md'));
  const carta = lerCarta(matrizRoot, aliasMatriz);
  // Sem `vault:` de proposito — a comparacao de slug exigiria uma identidade
  // ESTAVEL do vault, e o alias e nome de sessao (o mesmo acervo pode montar sob
  // outro alias). Comparar com o alias produziria falso positivo, e falso positivo
  // em check de procedencia queima a confianca no check. Fica para quando a
  // identidade de vault tiver casa declarada (P101/P103).
  const governanca = verificarRaiz(matrizRoot);

  return {
    identidadeVault: parseKeyValues(vaultConfig), // empresa, cliente, contexto, ponto focal
    vaultConfigInline: vaultConfig,
    alias: aliasMatriz,
    carta,
    governanca,
    // `governanca.avisos` NAO entra aqui de proposito: ele e renderizado como
    // SECAO propria (`blocoGovernanca`), no topo do bloco acionavel. Somar aos
    // avisos faria o mesmo texto sair duas vezes — secao no topo e bullet no fim.
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
// Casa canonica da Camada 0 do operador: `CLAUDE.md` na RAIZ do perfil — que e onde
// a `cnct-fabrica-operador` materializa (tabela do Passo 3 da skill). Ate a 0.12.2 esta
// funcao lia so `_cerebro/CLAUDE.md` e emitia a raiz como mero ponteiro: quem rodasse a
// fabrica ao pe da letra nascia com uma Camada 0 que o mecanismo nunca injetava (P76).
// O caminho `_cerebro/CLAUDE.md` continua sendo lido como LEGADO — e o mesmo nome da
// carta legada do contrato de navegacao, e a colisao originou a divergencia.
export function montarL1Pessoal(cerebroPessoalRoot, aliasPessoal = 'pessoal') {
  if (!cerebroPessoalRoot) return null;
  const canonico = path.join(cerebroPessoalRoot, 'CLAUDE.md');
  const legado = path.join(cerebroPessoalRoot, '_cerebro', 'CLAUDE.md');
  const hotCache = readIfExists(canonico) ?? readIfExists(legado);
  const hotCacheOrigem = readIfExists(canonico) ? 'canonica' : (readIfExists(legado) ? 'legada' : 'ausente');

  const avisos = [];
  if (hotCacheOrigem === 'legada') {
    avisos.push(`Camada 0 do operador lida de ./${aliasPessoal}/_cerebro/CLAUDE.md (casa legada) — a casa canonica e ./${aliasPessoal}/CLAUDE.md.`);
  }

  const ponteiros = [];
  const addPtr = (rel, nota) => {
    if (fs.existsSync(path.join(cerebroPessoalRoot, rel))) {
      ponteiros.push({ caminho: `./${aliasPessoal}/${rel}`, nota });
    }
  };
  // Ponteiros PRESCRITOS pelo produto ficam restritos ao que o proprio produto
  // materializa (fabrica de operador). Nome de pasta de vault de operador especifico
  // nao entra aqui — era vazamento de instancia no mecanismo, contra D98.
  addPtr('_cerebro/memory', 'memoria profunda (indice)');
  addPtr('TASKS.md', 'kanban pessoal');

  return {
    hotCacheInline: hotCache, // delta de comportamento do operador, inline por ser curto
    hotCacheOrigem,
    ponteiros,
    avisos,
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
