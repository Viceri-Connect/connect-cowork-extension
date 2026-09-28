// connect/lib/vinculo.mjs
// O LEITOR do vinculo operador x coletivo (ADR-22 item 8, fecha P81).
//
// O defeito que este arquivo corrige, medido em 08/09: `vinculos` tinha ZERO
// ocorrencias em lib/, mcp/, hooks/ e config/. As skills (`daily-ingest`,
// `discovery-intake`, `tasks-sync`) escrevem em
// `./operador/_cerebro/vinculos/{coletivo}/estado.md` desde a migracao do E2, e
// nada no mecanismo jamais leu. Escrita sem leitor nao e memoria, e deposito.
//
// A decisao de QUE isso e lido antes da carta do coletivo nao e nova: a ADR-14
// (D131, 18/08) ja a tomou — "o vinculo operador x coletivo e lido ANTES da carta
// de navegacao do coletivo, sempre que declarado". O que faltava era a
// implementacao, registrada como P81 e parada desde entao.
//
// Divisao de trabalho (ADR-22 item 8): markdown continua sendo a CASA (versionavel,
// editavel, legivel por humano — converter para JSON perderia justamente a prosa
// que da valor, como os gotchas de build do `repos.md` legado); o MCP passa a ser
// o CARTEIRO, entregando o recorte junto do `resolver` daquele coletivo.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';

// Casa canonica do registro de vinculo, relativa a raiz do perfil do operador.
const CASA = ['_cerebro', 'vinculos'];

// Ordem de leitura dentro da casa do coletivo. `config.md` primeiro: e o vinculo em
// si — papel efetivo e `## Alocacoes` (ponteiros: lotacao e frentes -> hub), que e
// por onde se chega ao que e do operador naquele coletivo. Ate 28/09 ele nao era entregue: o `resolver`
// trazia o hot cache e omitia o papel, e quem precisava saber "o que e meu" tinha
// de abrir o arquivo por fora. Depois `estado.md`, que e o que as skills instaladas
// ja escrevem; os outros nascem da ADR-22 item 7 (os eixos orfaos do `repos.md`:
// ambientes locais, particularidades por-maquina de repo).
const ARQUIVOS = ['config.md', 'estado.md', 'ambientes.md', 'repos.md'];

// Teto por arquivo. O vinculo entra num payload que ja e o mais caro do produto
// (~6k tok no `resolver` de sub-vault); um estado que apodreceu nao pode arrastar
// a resolucao junto. Truncar e ANUNCIAR e melhor que omitir em silencio.
const TETO_BYTES = 6000;

function lerArquivo(p) {
  try {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
    const bruto = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
    if (bruto.length <= TETO_BYTES) return { texto: bruto.replace(/\s+$/, ''), truncado: false };
    return {
      texto: `${bruto.slice(0, TETO_BYTES).replace(/\s+$/, '')}\n\n<... truncado em ${TETO_BYTES} B — abrir o arquivo para o resto>`,
      truncado: true,
    };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// lerVinculo — o recorte do vinculo do operador com UM coletivo.
//
// `status`:
//   'ausente'      — o operador ainda nao registrou vinculo com este coletivo.
//                    NAO e erro: e o estado normal do primeiro contato.
//   'sem-perfil'   — nao ha perfil de operador nesta maquina (a `cnct-fabrica-operador`
//                    e quem resolve; aqui so se reporta).
//   'lido'         — ha conteudo, e ele vai no payload.
// ---------------------------------------------------------------------------
export function lerVinculo(perfilOperadorRoot, coletivo) {
  const conceito = String(coletivo || '').toLowerCase().trim();
  if (!perfilOperadorRoot || !fs.existsSync(perfilOperadorRoot)) {
    return { status: 'sem-perfil', coletivo: conceito, avisos: [] };
  }
  if (!conceito) return { status: 'ausente', coletivo: null, avisos: [] };

  const casa = path.join(perfilOperadorRoot, ...CASA, conceito);
  if (!fs.existsSync(casa)) {
    return {
      status: 'ausente',
      coletivo: conceito,
      casa: path.join(...CASA, conceito),
      avisos: [],
    };
  }

  const blocos = [];
  const truncados = [];
  for (const nome of ARQUIVOS) {
    const r = lerArquivo(path.join(casa, nome));
    if (!r) continue;
    blocos.push({ arquivo: nome, texto: r.texto });
    if (r.truncado) truncados.push(nome);
  }

  if (!blocos.length) {
    return { status: 'ausente', coletivo: conceito, casa: path.join(...CASA, conceito), avisos: [] };
  }

  const avisos = [];
  if (truncados.length) {
    avisos.push(`vinculo com "${conceito}" truncado (${truncados.join(', ')}) — o registro passou de ${TETO_BYTES} B e pede despromocao; ver cnct-nucleo-escrita § Despromocao`);
  }

  return {
    status: 'lido',
    coletivo: conceito,
    casa: path.join(...CASA, conceito),
    blocos,
    // A ordem e o ponto da ADR-14: isto vem ANTES da carta do coletivo, nao depois.
    nota: 'leitura pessoal do operador sobre este coletivo — vale antes da carta de navegacao (ADR-14/D131). Nunca fundir ao acervo coletivo: fato e do vault, leitura e do operador',
    avisos,
  };
}

// ---------------------------------------------------------------------------
// chaveDoVinculo — QUAL vinculo pertence a uma entidade resolvida.
//
// O defeito que isto corrige, medido em 28/09 na primeira execucao do briefing
// diario: `resolver('vendas')` entregou o `estado.md` do vinculo `interno-viceri`,
// e nao o de `vendas`. A chave era `local.entrada.coletivo || entry.conceito` — o
// coletivo que ESCOPA O PONTEIRO LOCAL (a area Vendas mora sob a matriz, entao o
// ponteiro dela e `interno-viceri/vendas`) vencia o conceito da propria entidade.
// Escopo de ponteiro responde "onde este path foi registrado"; vinculo responde
// "qual e a leitura do operador sobre ESTA entidade". Sao perguntas diferentes, e
// a primeira nao pode responder pela segunda.
//
// Ordem: o operador tem vinculo com a propria entidade -> esse. Senao, o do
// coletivo que a escopa (projeto de um cliente cai no vinculo do cliente). Senao,
// a propria entidade (e `lerVinculo` devolve `ausente`, que e o estado normal).
// ---------------------------------------------------------------------------
export function chaveDoVinculo(perfilOperadorRoot, conceitoEntidade, coletivoDoPonteiro) {
  const proprio = String(conceitoEntidade || '').toLowerCase().trim();
  const escopo = String(coletivoDoPonteiro || '').toLowerCase().trim();
  const existe = (c) => !!c && !!perfilOperadorRoot && fs.existsSync(path.join(perfilOperadorRoot, ...CASA, c));
  if (existe(proprio)) return proprio;
  if (existe(escopo)) return escopo;
  return proprio || escopo || null;
}

// Atalho usado pelo `resolver`: resolve a chave certa e le.
export function lerVinculoDaEntidade(perfilOperadorRoot, conceitoEntidade, coletivoDoPonteiro) {
  return lerVinculo(perfilOperadorRoot, chaveDoVinculo(perfilOperadorRoot, conceitoEntidade, coletivoDoPonteiro));
}

// ---------------------------------------------------------------------------
// coletivosComVinculo — o que ja existe, para o operador conferir e para a skill
// saber o que ha sem abrir nada.
// ---------------------------------------------------------------------------
export function coletivosComVinculo(perfilOperadorRoot) {
  try {
    const casa = path.join(perfilOperadorRoot, ...CASA);
    if (!fs.existsSync(casa)) return [];
    return fs.readdirSync(casa, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name.toLowerCase());
  } catch { return []; }
}
