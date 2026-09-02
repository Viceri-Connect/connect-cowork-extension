// connect/lib/frontmatter.mjs
// Parser minimo de frontmatter YAML — escalares, listas inline, listas de bloco
// e listas de OBJETOS (que e o que a declaracao de `alcance:` exige, contrato de
// navegacao §8).
//
// Por que existe um parser aqui em vez de uma dependencia: o produto e zero-dep
// por decisao (ADR-12/ADR-6 — runtime sem arvore de terceiros), e o subconjunto
// de YAML que os contratos usam e pequeno e fechado. O parser recusa o que nao
// entende em vez de adivinhar: chave nao reconhecida vira string crua, e quem le
// decide. Nunca lanca.
//
// Subconjunto suportado:
//   chave: valor                       -> string (aspas removidas)
//   chave: [a, b, c]                   -> array de string
//   chave:                             -> array de string
//     - a
//     - b
//   chave:                             -> array de objeto
//     - k1: v1
//       k2: [x, y]
//
// Fora do subconjunto (mapas aninhados de profundidade > 1, ancoras, blocos
// literais `|`/`>`, multi-documento): ignorado, nunca interpretado pela metade.

const desaspar = (s) => String(s).trim().replace(/^["'](.*)["']$/, '$1');

const listaInline = (s) => String(s)
  .replace(/^\[|\]$/g, '')
  .split(',')
  .map((x) => desaspar(x))
  .filter((x) => x !== '');

// ---------------------------------------------------------------------------
// extrairFrontmatter — separa o bloco `---` do corpo. Frontmatter tem de abrir
// na PRIMEIRA linha nao vazia; `---` no meio do documento e regra horizontal de
// markdown, nao frontmatter (era o falso positivo obvio).
// Retorna { bruto, corpo, presente }.
// ---------------------------------------------------------------------------
export function extrairFrontmatter(md) {
  const texto = String(md ?? '').replace(/^﻿/, '');
  const linhas = texto.split(/\r?\n/);
  let i = 0;
  while (i < linhas.length && linhas[i].trim() === '') i += 1;
  if (linhas[i]?.trim() !== '---') return { bruto: '', corpo: texto, presente: false };

  const inicio = i + 1;
  let fim = -1;
  for (let j = inicio; j < linhas.length; j += 1) {
    if (linhas[j].trim() === '---' || linhas[j].trim() === '...') { fim = j; break; }
  }
  // Abertura sem fechamento nao e frontmatter — nao consumir o documento inteiro.
  if (fim === -1) return { bruto: '', corpo: texto, presente: false };

  return {
    bruto: linhas.slice(inicio, fim).join('\n'),
    corpo: linhas.slice(fim + 1).join('\n'),
    presente: true,
  };
}

// ---------------------------------------------------------------------------
// parseFrontmatter — o subconjunto descrito no topo. Nunca lanca.
// ---------------------------------------------------------------------------
export function parseFrontmatter(md) {
  const { bruto, presente } = extrairFrontmatter(md);
  if (!presente) return {};

  const out = {};
  const linhas = bruto.split(/\r?\n/);

  const indentacao = (l) => l.length - l.replace(/^\s*/, '').length;

  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.trim() || linha.trim().startsWith('#')) { i += 1; continue; }
    if (indentacao(linha) > 0) { i += 1; continue; } // orfa de bloco nao consumido

    const m = linha.match(/^([A-Za-z0-9_.\-]+)\s*:\s*(.*)$/);
    if (!m) { i += 1; continue; }

    const chave = m[1];
    const resto = m[2].replace(/\s+#.*$/, '').trim();

    if (resto !== '') {
      out[chave] = resto.startsWith('[') ? listaInline(resto) : desaspar(resto);
      i += 1;
      continue;
    }

    // Valor em bloco: coleta as linhas indentadas seguintes.
    const bloco = [];
    let j = i + 1;
    while (j < linhas.length && (linhas[j].trim() === '' || indentacao(linhas[j]) > 0)) {
      if (linhas[j].trim() !== '') bloco.push(linhas[j]);
      j += 1;
    }
    out[chave] = parseBloco(bloco);
    i = j;
  }

  return out;
}

// Bloco de lista: cada item comeca com `- `. Item com `k: v` na mesma linha (e
// nas seguintes, mais indentadas) e OBJETO; item sem `:` e escalar.
function parseBloco(bloco) {
  if (!bloco.length) return [];
  const indentacao = (l) => l.length - l.replace(/^\s*/, '').length;
  const base = Math.min(...bloco.map(indentacao));
  const itens = [];

  let atual = null;
  for (const linha of bloco) {
    const nu = linha.slice(base);
    const item = nu.match(/^-\s*(.*)$/);
    if (item) {
      if (atual !== null) itens.push(atual);
      const conteudo = item[1].trim();
      const kv = conteudo.match(/^([A-Za-z0-9_.\-]+)\s*:\s*(.*)$/);
      if (kv) {
        atual = {};
        atribuir(atual, kv[1], kv[2]);
      } else {
        atual = desaspar(conteudo);
      }
      continue;
    }
    // Continuacao de um item-objeto (chave adicional, mais indentada).
    const kv = nu.trim().match(/^([A-Za-z0-9_.\-]+)\s*:\s*(.*)$/);
    if (kv && atual && typeof atual === 'object') atribuir(atual, kv[1], kv[2]);
  }
  if (atual !== null) itens.push(atual);
  return itens;
}

function atribuir(obj, chave, valorBruto) {
  const v = String(valorBruto).replace(/\s+#.*$/, '').trim();
  obj[chave] = v.startsWith('[') ? listaInline(v) : desaspar(v);
}

// ---------------------------------------------------------------------------
// estimarTokens — a grandeza que o check 4 do contrato passou a medir na v0.5.0
// (linha era a grandeza errada: cartas de 124-147 linhas custavam ~2.000-3.600
// tokens cada e o aviso de 250 linhas nunca disparava em nenhuma delas).
//
// Estimativa deliberadamente simples e local: ~4 bytes UTF-8 por token, o fator
// medido nas cartas reais desta instancia (39.355 B / ~9.837 tok em 01/09).
// Nao ha tokenizer no runtime e nao vale adicionar um: a metrica existe para
// disparar aviso de ordem de grandeza, nao para faturar.
// ---------------------------------------------------------------------------
export const BYTES_POR_TOKEN = 4;

export function estimarTokens(texto) {
  if (!texto) return 0;
  return Math.round(Buffer.byteLength(String(texto), 'utf8') / BYTES_POR_TOKEN);
}
