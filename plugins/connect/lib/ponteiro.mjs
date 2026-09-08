// connect/lib/ponteiro.mjs
// A gramatica UNICA de "onde isso mora nesta maquina" (ADR-22).
//
// Antes desta ADR o produto tinha duas: `subVaults` (mapa plano conceito->path,
// lido por resolver.mjs) e `repos` (mapa plano conceito->path, lido por repos.mjs).
// As duas sem eixo de coletivo — logo dois coletivos com repo homonimo colidiam por
// construcao, e o operador compensava a mao: a tabela de repos legada de um operador
// trazia `⚠️ nao confundir com <o outro de nome parecido>` escrito na coluna de
// notas, que e o recibo do defeito.
//
// O que este modulo e:
//   - a CHAVE escopada `{coletivo}[/{escopo}]/{conceito}` e sua normalizacao;
//   - o casamento, com a assimetria da ADR-22 item 6 (bidirecional so em leitura);
//   - a recusa de ambiguidade, qualificada por coletivo.
//
// O que este modulo NAO e: comportamento de classe. Montar junction, cobrar `.git`,
// injetar carta — isso e de quem chama. Aqui so se responde "qual entrada da tabela
// o operador quis dizer, e ela e unica?".
//
// Retrocompatibilidade (ADR-22 item 1): chave em formato antigo (sem `/`) continua
// valida e nunca e reescrita sozinha — config de operador so muda quando ele pede.
//
// Zero dependencias externas.

const norm = (s) => String(s || '').toLowerCase().trim();

// Piso do fuzzy. Abaixo disso, qualquer termo casa meio acervo — e o casamento
// frouxo ja devolveu `resolvido` para entrada nao registrada uma vez (revisao 0.12.0).
const PISO_FUZZY = 3;

// ---------------------------------------------------------------------------
// partirChave — `cliente-alfa/squad-um/delivery-hub` -> as tres partes.
// O ultimo segmento e SEMPRE o conceito; o primeiro, quando ha mais de um, e o
// coletivo; o que sobra no meio e escopo (squad, area) e pode ser vazio.
// Chave sem `/` e formato legado: conceito sem coletivo declarado.
// ---------------------------------------------------------------------------
export function partirChave(chave) {
  const partes = norm(chave).split('/').filter(Boolean);
  if (partes.length <= 1) {
    return { coletivo: null, escopo: [], conceito: partes[0] || '', legado: true };
  }
  return {
    coletivo: partes[0],
    escopo: partes.slice(1, -1),
    conceito: partes[partes.length - 1],
    legado: false,
  };
}

// montarChave — a forma canonica. Segmentos vazios somem; nada de `//`.
export function montarChave({ coletivo, escopo = [], conceito } = {}) {
  return [coletivo, ...(Array.isArray(escopo) ? escopo : [escopo]), conceito]
    .map(norm)
    .filter(Boolean)
    .join('/');
}

// ---------------------------------------------------------------------------
// lerTabela — normaliza o shape gravado.
//
// Shim da ADR-22 item 1: a tabela aceita `chave: "caminho"` (formato ate 0.27.0)
// e `chave: { caminho, ... }`. Ler os dois e o que permite subir o plugin sem
// tocar em nenhuma config ja gravada em campo — e nao ha validador de schema no
// produto, entao mudanca de shape so apareceria na sessao do operador.
// ---------------------------------------------------------------------------
export function lerTabela(tabela = {}) {
  const out = [];
  for (const [chaveBruta, valor] of Object.entries(tabela || {})) {
    const caminho = typeof valor === 'string' ? valor : (valor?.caminho || null);
    if (!caminho) continue;
    const partes = partirChave(chaveBruta);
    out.push({
      chave: norm(chaveBruta),
      caminho,
      ...partes,
      extra: typeof valor === 'string' ? {} : { ...valor, caminho: undefined },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// casarPonteiro — resolve termo (+ coletivo/escopo opcionais) numa entrada unica.
//
// Ordem, e ela e a decisao:
//   1. filtro duro por coletivo, quando informado — nunca "cai fora do coletivo
//      pedido porque la tinha um nome parecido";
//   2. chave completa exata;
//   3. conceito exato (o segmento final), que e como a skill costuma chamar;
//   4. fuzzy, so acima do piso;
//   5. N candidatos => `ambigua` QUALIFICADA (com coletivo em cada candidato),
//      nunca o primeiro da travessia.
//
// `bidirecional: false` e o modo de ESCRITA (repo). Ali termo mais longo que a
// chave significa entrada AUSENTE, nao entrada parecida — `resolverRepo`
// devolvia o caminho de `connect-web` para `connect-web-api` quando isto era
// frouxo (revisao 0.12.0), e commitar no repo errado nao tem desfazer barato.
//
// Retorno: { status: 'unico'|'ambigua'|'nenhum', entrada?, candidatos?, desempatadoPor? }
// ---------------------------------------------------------------------------
export function casarPonteiro(entradas, { termo, coletivo = null, escopo = null, bidirecional = true, estrito = false } = {}) {
  const t = norm(termo);
  if (!t) return { status: 'nenhum', candidatos: [] };

  const col = norm(coletivo) || null;
  let universo = entradas;
  let desempatadoPor = null;

  // (1) Coletivo informado e filtro DURO. Entrada legada (sem coletivo na chave)
  // permanece elegivel: ela ainda nao declarou a que coletivo pertence, e exclui-la
  // faria o upgrade do plugin "perder" repos que funcionavam ontem.
  if (col) {
    const doColetivo = entradas.filter((e) => e.coletivo === col || e.legado);
    if (doColetivo.length) {
      universo = doColetivo;
      desempatadoPor = col;
    }
  }

  // Escopo informado estreita mais, mas nunca zera: se nada casar o escopo pedido,
  // segue com o universo do coletivo e o chamador ve pelo `desempatadoPor`.
  if (escopo) {
    const esc = norm(escopo);
    const doEscopo = universo.filter((e) => e.escopo.includes(esc));
    if (doEscopo.length) universo = doEscopo;
  }

  // (2) chave completa exata
  let hit = universo.find((e) => e.chave === t);
  if (hit) return { status: 'unico', entrada: hit, desempatadoPor };

  // (3) conceito exato — pode haver N (o mesmo conceito em coletivos diferentes),
  // e e exatamente a colisao que esta ADR existe para tornar visivel.
  const porConceito = universo.filter((e) => e.conceito === t);
  if (porConceito.length === 1) return { status: 'unico', entrada: porConceito[0], desempatadoPor };
  if (porConceito.length > 1) return { status: 'ambigua', candidatos: porConceito, desempatadoPor };

  // (4) fuzzy — SO quando o termo veio de humano/skill.
  //
  // `estrito` desliga esta etapa, e existe por um defeito medido em 08/09, no primeiro
  // uso real: resolvendo o Delivery Hub de um coletivo, o termo era o conceito CANONICO
  // ja casado no registro de manifestos (`{coletivo}-delivery-hub`), e o fuzzy
  // bidirecional casou a entrada do VAULT daquele coletivo — porque o nome do coletivo e
  // substring do conceito. O mecanismo devolveu `resolvido` apontando para o acervo de
  // conhecimento no lugar do diretorio de entrega, em silencio.
  //
  // A licao e a mesma da assimetria de repo, um andar acima: fuzzy serve para adivinhar
  // o que o humano quis dizer. Quando a chave JA e canonica, adivinhar so pode errar —
  // e a resposta certa para "nao esta na tabela" e `local-nao-configurado`, que faz o
  // mecanismo PERGUNTAR, nunca um vizinho parecido.
  if (!estrito && t.length >= PISO_FUZZY) {
    const casa = (alvo) => (bidirecional ? (alvo.includes(t) || t.includes(alvo)) : alvo.includes(t));
    const fuzzy = universo.filter((e) => casa(e.conceito) || casa(e.chave));
    if (fuzzy.length === 1) return { status: 'unico', entrada: fuzzy[0], desempatadoPor };
    if (fuzzy.length > 1) return { status: 'ambigua', candidatos: fuzzy, desempatadoPor };
  }

  return { status: 'nenhum', candidatos: [] };
}

// ---------------------------------------------------------------------------
// resumirCandidatos — o que vai no aviso de `ambigua`.
// Qualificado por coletivo de proposito: `pagamentos-api, pagamentos-api` nao
// ajuda ninguem a escolher; `cliente-alfa/pagamentos-api, cliente-beta/pagamentos-api` ajuda.
// ---------------------------------------------------------------------------
export const resumirCandidatos = (cands = []) => cands.map((c) => c.chave);

// ---------------------------------------------------------------------------
// vizinhos — os N conceitos mais proximos de um termo que nao casou.
//
// Existe para nao devolver o registro inteiro num `nao-encontrado`: a matriz desta
// instancia tem ~155 conceitos, ~900 tok gastos para dizer "nao achei". O agente
// precisa de pista, nao de catalogo.
// ---------------------------------------------------------------------------
export function vizinhos(nomes = [], termo, limite = 12) {
  const t = norm(termo);
  if (!t) return nomes.slice(0, limite);
  const pontua = (n) => {
    const s = norm(n);
    if (s.includes(t) || t.includes(s)) return 0;
    // prefixo comum — barato e suficiente para "voce quis dizer".
    let i = 0;
    while (i < s.length && i < t.length && s[i] === t[i]) i++;
    return 100 - i;
  };
  return [...nomes].sort((a, b) => pontua(a) - pontua(b)).slice(0, limite);
}
