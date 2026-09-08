// connect/lib/resolver.mjs
// resolver(conceito) — entrega um SUB-VAULT por CONCEITO como atalho no workspace.
//
// Realinhado (17/08, 2a rodada — corte de raiz sobre P69): o manifesto NUNCA guarda
// path/url de acervo, nem relativo. Path e por-maquina, por-operador (D35) — nunca
// conteudo coletivo. O manifesto so declara FATOS coletivos:
//   - `externo` (bool)   — esta entidade tem acervo fora da matriz? (default false)
//   - `criado-por`/`criado-em` — alguem ja declarou que isso nasceu de verdade?
//     (ausencia = intencao registrada, acervo ainda NAO existe — pendente-criacao)
//   - `conceito`/`alias` — chave estavel (default: slug do arquivo), ja existia no
//     contrato antigo como override de casamento — reaproveitada como chave da
//     tabela local (nao inventamos um `escopo` novo: esse nome ja e usado em toda
//     a matriz pra governanca/cliente e colidiria, achado no dogfooding 17/08)
//   - `entrada`          — nome da nota-hub dentro do acervo (pra pousar direto)
//
// O path local (por operador, por maquina) mora SO em connect.config.json,
// tabela `subVaults: { conceito: caminhoAbsoluto }` — nunca no vault. `resolver`
// nunca pergunta nada sozinho (e MCP, burro por design); so devolve status pra
// a skill decidir o proximo passo (perguntar ao operador, acionar fabrica, etc).
//
// Contrato do manifesto: config/contrato-manifesto.md (plugin). Zero dependencias
// externas.
//
// Principios (SPEC): nunca path/url no coletivo, mount != acesso, lazy antes de
// tudo, governanca desce da matriz. Registro autorado = proibido (contrato §3).

import fs from 'node:fs';
import path from 'node:path';
import { mount } from './mount.mjs';
import { resolveConfig } from './session.mjs';
import { montarL1 } from './matriz.mjs';
import { resolverEntrada } from './navegacao.mjs';
import { lerTabela, casarPonteiro, vizinhos } from './ponteiro.mjs';
import { lerVinculo } from './vinculo.mjs';

// ---------------------------------------------------------------------------
// CLASSE DE ARTEFATO (ADR-22 item 2, emendado em 08/09) — declarada, nunca inferida.
//
// O produto tinha duas gramaticas para "onde isso mora nesta maquina": sub-vault
// (aqui) e repo (lib/repos.mjs). Diretorio de OUTPUT do processo — o Delivery Hub —
// nao cabia em nenhuma, e cinco skills instaladas mandavam resolve-lo por
// `resolver_repo`, que devolveria `sem-git`, status que nenhuma delas trata:
// instrucao morta em cinco lugares (P149).
//
// ⚠️ A PRIMEIRA implementacao disto era uma lista de `tipo` conhecidos aqui dentro
// (`diretorio-entrega`, `delivery-hub`, ...). Estava errada, e o proprio
// `contrato-manifesto.md` §2 ja dizia por que: sobre `tipo`, *"a empresa declara;
// o produto NAO prescreve o conjunto"*. Uma lista de tipos aqui e o produto
// conhecendo vocabulario de coletivo — e teria obrigado cada coletivo novo a
// batizar o Hub exatamente como o produto adivinhou.
//
// A separacao correta tem duas palavras porque sao duas coisas:
//   `tipo`   — o que a entidade E, no vocabulario do coletivo. Ilimitado, e o
//              produto so o carrega adiante sem interpretar.
//   `classe` — o que o MECANISMO precisa fazer com ela. Conjunto fechado do
//              produto: `vault` (default) ou `diretorio`.
//
// `diretorio` monta, devolve concessao, e NAO cobra carta de navegacao, heranca de
// processo nem ponto de pouso — o que impede o payload de sub-vault (~5.958 tok
// medidos em 08/09) de contaminar uma pasta de entregaveis, e o que evita anunciar
// "lacuna de navegacao" para um acervo que por definicao nunca tera carta.
//
// Default `vault` e deliberado: manifesto antigo, sem `classe`, continua exatamente
// como era. Nenhum vault em campo precisa ser tocado para o plugin subir.
// ---------------------------------------------------------------------------
const CLASSES = new Set(['vault', 'diretorio']);

export function classeDeclarada(classe) {
  const c = String(classe || '').toLowerCase().trim();
  return CLASSES.has(c) ? c : 'vault';
}

// ---------------------------------------------------------------------------
// Helpers de leitura / parse (zero-dep).
// ---------------------------------------------------------------------------
function readHead(p, bytes = 4096) {
  try {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    fs.closeSync(fd);
    return buf.slice(0, n).toString('utf8').replace(/^﻿/, '');
  } catch { return null; }
}

// Extrai o bloco de frontmatter (entre o primeiro par de linhas "---").
function extrairFrontmatter(text) {
  if (!text) return null;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

const desaspar = (v) => v.replace(/\s+#.*$/, '').trim().replace(/^["'](.*)["']$/, '$1');
const ehVerdadeiro = (v) => /^(true|sim|yes)$/i.test(String(v || '').trim());

// Interpreta o frontmatter PURO de um manifesto (D35: nunca path/url aqui).
// Retorna null se a nota nao declarar `tipo` (nao e entidade).
export function parseManifesto(fmText) {
  if (!fmText) return null;
  const top = {};
  for (const raw of fmText.split(/\r?\n/)) {
    const kv = raw.match(/^([a-zA-Z0-9_.\-]+)\s*:\s*(.*)$/);
    if (kv && !(kv[1] in top)) top[kv[1]] = desaspar(kv[2]);
  }
  if (!top.tipo) return null; // nao e manifesto de entidade

  const gatilhos = (top.tags || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.replace(/["']/g, '').trim().toLowerCase())
    .filter(Boolean);

  return {
    tipo: top.tipo,
    papel: top.papel || null,
    // Vocabulario do MECANISMO (conjunto fechado), ao lado do `tipo`, que e do
    // coletivo (ilimitado). Ausente = `vault`, o comportamento de sempre.
    classe: top.classe || null,
    externo: ehVerdadeiro(top.externo),
    criadoPor: top['criado-por'] || null,
    criadoEm: top['criado-em'] || null,
    entrada: top.entrada || null,
    escopo: top.escopo || null, // coletivo dono, no vocabulario que o acervo ja usa
    conceito: top.conceito || top.alias || null, // default (slug) resolvido no walk
    alias: top.alias || null,
    gatilhos,
  };
}

// ---------------------------------------------------------------------------
// lerRegistro — DERIVA as entidades dos manifestos nas raizes informadas.
// Indexa QUALQUER nota com `tipo` (e manifesto, mesmo sem acervo externo) —
// `externo` decide depois se ha algo a montar. Ordem de precedencia: a
// primeira raiz vence em conceito repetido (pessoal antes de matriz — o
// operador sobrepoe a governanca). Sem arquivo autorado (contrato §3).
// ---------------------------------------------------------------------------
export function lerRegistro(roots = []) {
  const out = [];
  const seen = new Set();

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;

    for (const file of walkMd(root)) {
      const fm = extrairFrontmatter(readHead(file));
      const man = parseManifesto(fm);
      if (!man) continue;

      const slug = path.basename(file, '.md').toLowerCase();
      const conceito = (man.conceito || slug).toLowerCase();
      if (seen.has(conceito)) continue;

      const gatilhos = Array.from(new Set([...man.gatilhos, slug].filter((g) => g && g !== conceito)));

      seen.add(conceito);
      out.push({
        conceito,
        externo: man.externo,
        criado: !!(man.criadoPor && man.criadoEm),
        entrada: man.entrada,
        alias: man.alias || conceito,
        gatilhos,
        tipo: man.tipo,
        papel: man.papel,
        classe: man.classe,
        escopo: man.escopo,
        nota: `${man.tipo}${man.papel ? '/' + man.papel : ''} — manifesto derivado`,
        _fonte: root,
      });
    }
  }
  return out;
}

// Varredura rasa de .md (ignora pastas ocultas e node_modules). Profundidade
// limitada: manifestos vivem perto da raiz (matriz enxuta, D103).
function walkMd(root, maxDepth = 4) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(root, 0);
  return out;
}

// ---------------------------------------------------------------------------
// casar — resolve um termo (conceito ou gatilho) para uma entrada do registro.
// Ordem: conceito exato (qualquer entidade) > gatilho exato > substring —
// as duas ultimas SO entre entidades com externo:true.
//
// Achado real testando contra o vault de producao (17/08): indexar QUALQUER
// nota com `tipo` (pra sem-acervo-externo funcionar) tem um preco — tags
// topicas genericas ("connect", "impulsa") aparecem em N documentos de
// conteudo (metodologia, papeis, politicas) que nunca foram pensados como
// alvo de mount. Sem essa restricao, `casar('connect')` colidia com 11
// entidades e resolvia pra uma delas por ordem de travessia, nunca a tribo.
// Fuzzy-match (gatilho/substring) so faz sentido entre quem TEM acervo pra
// montar — e' literalmente o unico caso em que resolver tem o que fazer.
// ---------------------------------------------------------------------------
// Duas mudancas da ADR-22 (itens 5 e 6), e elas se sustentam uma na outra:
//
//   (6) o casamento passa a ser BIDIRECIONAL. Antes so se testava
//       `conceito.includes(termo)` — logo termo MAIS ESPECIFICO que a chave nunca
//       casava. Medido em 08/09, em sessao real: `resolver('tribo-impulsa')` deu
//       `nao-encontrado` com o registro inteiro, e `resolver('impulsa')` resolveu.
//       O operador pagou duas chamadas por uma resolucao.
//
//   (5) por isso a ambiguidade passa a ser RECUSADA aqui tambem. Bidirecional
//       sozinho pioraria o defeito latente que ja existia: `casar('tribo')` casa
//       tres entidades cujo conceito comeca por `tribo-`, e o codigo devolvia o
//       primeiro da travessia em silencio. Falhar ruidoso e o unico modo aceitavel
//       — e e a mesma regra que o lado do repo ja aplicava desde a 0.12.0.
//
// Conceito exato continua vencendo sozinho: e como a skill chama quando sabe o nome.
export function casar(registro, termo) {
  const r = casarMuitos(registro, termo);
  return r.status === 'unico' ? r.entrada : null;
}

export function casarMuitos(registro, termo, coletivo = null) {
  if (!termo) return { status: 'nenhum', candidatos: [] };
  const t = String(termo).toLowerCase().trim();
  const nome = (e) => String(e.conceito).toLowerCase();

  // Desempate por coletivo TAMBEM no registro de manifestos, nao so na tabela local
  // (defeito irmao, medido no mesmo teste de 08/09): sem isto, dois coletivos com
  // Delivery Hub declarado devolveriam `ambigua` e o parametro `coletivo` da skill
  // nao teria como desfazer o empate. A chave e o campo `escopo` do manifesto, que
  // o acervo ja declara ha tempo — nao inventamos campo novo.
  if (coletivo) {
    const col = String(coletivo).toLowerCase().trim();
    const doColetivo = registro.filter((e) => String(e.escopo || '').toLowerCase() === col);
    if (doColetivo.length) registro = doColetivo;
  }

  // conceito exato: qualquer entidade, mesmo sem acervo (precisa achar pra
  // devolver 'sem-acervo-externo' quando alguem nomeia ela certinho).
  const exato = registro.find((e) => nome(e) === t);
  if (exato) return { status: 'unico', entrada: exato };

  // gatilho/substring: restrito a quem tem acervo — nunca deixar uma tag
  // topica de doc de conteudo roubar o match de quem de fato monta algo.
  const candidatas = registro.filter((e) => e.externo);

  const porGatilho = candidatas.filter((e) => e.gatilhos.some((g) => String(g).toLowerCase() === t));
  if (porGatilho.length === 1) return { status: 'unico', entrada: porGatilho[0] };
  if (porGatilho.length > 1) return { status: 'ambigua', candidatos: porGatilho };

  if (t.length < 3) return { status: 'nenhum', candidatos: [] };

  // Fuzzy em DEGRAUS, e o degrau importa mais que o casamento em si.
  //
  // Medido em 08/09, contra o registro real da matriz: `casarMuitos('tribo-impulsa')`
  // devolveu `ambigua` entre uma entidade de conceito proprio e duas de conceito
  // prefixado por `tribo-` — as tres
  // declaram o gatilho generico `tribo`, e o lado novo do bidirecional
  // (`termo.includes(alvo)`) faz "tribo-impulsa".includes("tribo") casar todas.
  // Sem degrau, o bidirecional teria apenas TROCADO a forma do defeito: de resolver
  // a entidade errada em silencio para recusar uma resolucao que e obvia.
  //
  // Precedencia: casar pelo CONCEITO e mais forte que casar por gatilho, porque o
  // conceito e a chave que o coletivo declarou como identidade. Ambiguidade so e
  // recusada DENTRO do mesmo degrau — dois conceitos igualmente proximos e um
  // empate real; conceito contra tag topica, nao.
  const casa = (alvo) => alvo.includes(t) || t.includes(alvo);
  const porNome = candidatas.filter((e) => casa(nome(e)));
  if (porNome.length === 1) return { status: 'unico', entrada: porNome[0] };
  if (porNome.length > 1) return { status: 'ambigua', candidatos: porNome };

  const porTag = candidatas.filter((e) => e.gatilhos.some((g) => casa(String(g).toLowerCase())));
  if (porTag.length === 1) return { status: 'unico', entrada: porTag[0] };
  if (porTag.length > 1) return { status: 'ambigua', candidatos: porTag };

  return { status: 'nenhum', candidatos: [] };
}

// ---------------------------------------------------------------------------
// resolver — orquestra: config -> registro derivado -> casa -> local -> monta -> L1.
// Nunca lanca, nunca pergunta nada (MCP e burro por design — quem pergunta ao
// operador e a skill, olhando o `status`). Nunca advinha path: so usa o que
// a tabela local (`connect.config.json.subVaults`, indexada por `conceito`)
// ja tiver.
//
// Status possiveis:
//   'nao-encontrado'        — nenhum manifesto casa com o termo
//   'sem-acervo-externo'    — entidade existe, mas `externo` != true (conteudo
//                              mora na propria matriz; nada a montar)
//   'pendente-criacao'      — `externo:true` mas sem criado-por/criado-em: a
//                              entidade foi declarada, o acervo ainda nao nasceu
//                              (aciona `cnct-fabrica-<tipo>`, nunca cria sozinho)
//   'local-nao-configurado' — `conceito` ainda sem path nesta maquina (a skill
//                              pergunta ao operador e grava com registrarSubVaultLocal)
//   'origem-ausente'        — path local conhecido, mas o diretorio nao existe
//   'sem-workspace'         — falta workspaceDir
//   'erro-mount'            — falha ao criar a junction/symlink
//   'resolvido'             — montado; usar `entrada` (se houver) pra pousar
// ---------------------------------------------------------------------------
export function resolver({ conceito, workspaceDir, alias, replace = false, coletivo = null, escopo = null, ...override } = {}) {
  const cfg = resolveConfig(override);
  const roots = [cfg.cerebroPessoal, cfg.vaultMatriz].filter(Boolean);
  const registro = lerRegistro(roots);
  const todos = registro.map((e) => e.conceito);

  if (!conceito) {
    return { status: 'erro', motivo: 'conceito ausente', disponiveis: vizinhos(todos, '', 20) };
  }

  const m = casarMuitos(registro, conceito, coletivo);

  if (m.status === 'ambigua') {
    const candidatos = m.candidatos.map((e) => e.conceito);
    return {
      status: 'ambigua',
      conceito,
      candidatos,
      avisos: [`"${conceito}" casa com ${candidatos.length} entidades (${candidatos.join(', ')}) — pergunte ao operador qual, ou chame de novo com o conceito exato. Escolher pela ordem da varredura ja resolveu para a entidade errada antes.`],
    };
  }

  if (m.status === 'nenhum') {
    // `disponiveis` era o registro INTEIRO: ~155 conceitos, ~900 tok gastos para
    // dizer "nao achei" (medido em 08/09). O agente precisa de pista, nao de
    // catalogo — o catalogo ele pede quando quiser.
    return {
      status: 'nao-encontrado',
      conceito,
      disponiveis: vizinhos(todos, conceito),
      totalNoRegistro: todos.length,
      avisos: [`nenhum manifesto casa com "${conceito}" — os ${Math.min(12, todos.length)} conceitos mais proximos de ${todos.length} no registro estao em \`disponiveis\``],
    };
  }

  const entry = m.entrada;

  if (!entry.externo) {
    return {
      status: 'sem-acervo-externo',
      conceito: entry.conceito,
      tipo: entry.tipo,
      papel: entry.papel,
      avisos: [`"${entry.conceito}" nao declara externo:true — o conteudo mora na propria matriz, nada a montar`],
    };
  }

  if (!entry.criado) {
    return {
      status: 'pendente-criacao',
      conceito: entry.conceito,
      tipo: entry.tipo,
      papel: entry.papel,
      avisos: [`"${entry.conceito}" existe como manifesto mas ainda nao foi materializado (sem criado-por/criado-em) — ofereca a cnct-fabrica-${entry.tipo || '<tipo>'} ao operador, nunca crie sozinho`],
    };
  }

  // Path local pela tabela ESCOPADA (ADR-22 item 1). O shim de `lerTabela` mantem
  // valida toda chave plana ja gravada — config de operador nunca e reescrita
  // sozinha, e nao ha validador de schema no produto que avisasse antes da sessao.
  const entradasLocais = lerTabela(cfg.subVaults || {});
  const local = casarPonteiro(entradasLocais, {
    termo: entry.conceito,
    coletivo: coletivo || entry.escopo,
    escopo,
    // ESTRITO: `entry.conceito` ja e a chave canonica, casada no registro de
    // manifestos. Adivinhar aqui so pode errar — e errou, na primeira resolucao real
    // de um Delivery Hub (08/09).
    estrito: true,
  });

  if (local.status === 'ambigua') {
    return {
      status: 'ambigua-local',
      conceito: entry.conceito,
      candidatos: local.candidatos.map((c) => c.chave),
      avisos: [`"${entry.conceito}" tem ${local.candidatos.length} caminhos registrados nesta maquina (${local.candidatos.map((c) => c.chave).join(', ')}) — informe \`coletivo\` para desempatar. Nunca escolher por ordem da tabela.`],
    };
  }

  const caminhoLocal = local.status === 'unico' ? local.entrada.caminho : null;
  if (!caminhoLocal) {
    return {
      status: 'local-nao-configurado',
      conceito: entry.conceito,
      classe: classeDeclarada(entry.classe),
      avisos: [`esta maquina ainda nao sabe onde "${entry.conceito}" mora localmente — pergunte ao operador o diretorio e grave com registrar_subvault_local({ conceito: "${entry.conceito}", coletivo, caminho })`],
    };
  }
  if (!fs.existsSync(caminhoLocal)) {
    return {
      status: 'origem-ausente',
      conceito: entry.conceito,
      origem: caminhoLocal,
      avisos: [`origem nao existe: ${caminhoLocal} (se for OneDrive, sincronize "manter neste dispositivo"; sem acesso a fonte, procure quem governa)`],
    };
  }
  if (!workspaceDir) {
    return { status: 'sem-workspace', conceito: entry.conceito, origem: caminhoLocal, avisos: ['workspaceDir ausente — informe o diretorio da sessao (estado_sessao.workspace)'] };
  }

  const aliasFinal = alias || entry.alias;
  const classe = classeDeclarada(entry.classe);
  let mountReport;
  try {
    mountReport = mount({ workspaceDir, alias: aliasFinal, source: caminhoLocal, replace });
  } catch (e) {
    return { status: 'erro-mount', conceito: entry.conceito, alias: aliasFinal, avisos: [e.message] };
  }

  // A concessao vale para as duas classes: montar nunca foi alcancar (M2, P97), e
  // o Delivery Hub e justamente onde isso mais dói — pasta sincronizada por
  // OneDrive exige concessao propria, e era o atrito manual de toda sessao (P149).
  const concessao = {
    necessaria: true,
    caminho: caminhoLocal,
    motivo: `sem acesso concedido a esta origem, \`./${aliasFinal}\` monta e nao abre — pedir ao operador, nunca contornar`,
  };

  // ---------------------------------------------------------------------------
  // Classe `diretorio` (ADR-22 item 2): sai AQUI, antes de montarL1.
  //
  // Um diretorio de output nao tem carta de navegacao, nao herda processo e nao
  // tem ponto de pouso — cobrar isso dele produziria "lacuna de navegacao" a cada
  // resolucao, para um acervo que por definicao nunca vai ter carta. E o que faz
  // esta classe custar ~80 tok em vez dos ~5.958 do sub-vault.
  // ---------------------------------------------------------------------------
  if (classe === 'diretorio') {
    return {
      status: 'resolvido',
      classe,
      conceito: entry.conceito,
      tipo: entry.tipo,
      papel: entry.papel,
      coletivo: local.entrada.coletivo,
      alias: aliasFinal,
      origem: caminhoLocal,
      caminhoRelativo: `./${aliasFinal}`,
      mount: mountReport,
      nota: `${entry.nota} — diretorio de OUTPUT do processo, nao vault: nao tem camada 1, nao herda processo, e nao e fonte para outro artefato de saida`,
      concessao,
      vinculo: lerVinculo(cfg.perfilOperador || null, local.entrada.coletivo || entry.conceito),
      avisos: local.desempatadoPor ? [`desempatado pelo coletivo "${local.desempatadoPor}"`] : [],
    };
  }

  // Camada 1 do sub-vault — MESMA forma da matriz (corolario do D97: o interior
  // tem o mesmo contrato em todos os niveis). Sempre montada: a carta de
  // navegacao e o que orienta o agente dentro do acervo, e a AUSENCIA dela e
  // informacao (lacuna anunciada), nao motivo para omitir a camada.
  let l1 = null;
  try {
    // O sub-vault nao governa processo nenhum: quem governa e a matriz. Passar o
    // `workspaceDir` e o que faz a carta de processo ser cobrada UMA vez na
    // sessao — o segundo sub-vault que declarar o mesmo processo recebe apenas o
    // ponteiro, e e disso que vem o fim da escala linear do piso (§9.3).
    l1 = montarL1(caminhoLocal, aliasFinal, {
      governanteRoot: cfg.vaultMatriz,
      aliasGovernante: 'matriz',
      workspaceDir,
    });
  } catch { /* nunca derruba a resolucao por causa da camada 1 */ }

  // Ponto de pouso — `entrada` do manifesto resolvida a CAMINHO real. Sem isso,
  // pousar exigiria varrer o diretorio: exatamente o contorno que o protocolo
  // proibe (o gap que o D120 deixou aberto).
  const entradaResolvida = resolverEntrada(caminhoLocal, entry.entrada, aliasFinal);

  const avisos = [
    ...(l1?.avisos || []),
    ...(entradaResolvida.avisos || []),
  ];

  // Vinculo do operador com este coletivo (ADR-22 item 8, fecha P81).
  //
  // A ADR-14 (D131) decidiu em 18/08 que o vinculo operador x coletivo e lido ANTES
  // da carta de navegacao do coletivo. A implementacao nunca aconteceu: em 08/09,
  // `vinculos` tinha ZERO ocorrencias em todo o codigo — as skills escreviam e nada
  // lia. Aqui o mecanismo vira o carteiro; a casa continua sendo markdown no perfil
  // do operador, sujeito a mesma deduplicacao por sessao dos outros blocos longos.
  const vinculo = lerVinculo(cfg.perfilOperador || null, local.entrada.coletivo || entry.conceito);
  if (vinculo.avisos?.length) avisos.push(...vinculo.avisos);
  if (local.desempatadoPor) avisos.push(`desempatado pelo coletivo "${local.desempatadoPor}"`);

  return {
    status: 'resolvido',
    classe,
    conceito: entry.conceito,
    tipo: entry.tipo,
    papel: entry.papel,
    coletivo: local.entrada.coletivo,
    alias: aliasFinal,
    origem: caminhoLocal,
    caminhoRelativo: `./${aliasFinal}`,
    entrada: entry.entrada || null,
    entradaResolvida,
    mount: mountReport,
    // Ordem de leitura da ADR-14: o vinculo vem ANTES da carta. Aparece antes de
    // `l1` no objeto de proposito — quem le o payload le nesta ordem.
    vinculo,
    l1,
    nota: entry.nota,
    // M2 (24/08) — montar nao e alcancar. O harness aplica politica de acesso sobre o
    // DESTINO REAL da junction; conceder o CONNECT_HOME nao alcancou este acervo em
    // nenhuma das 4 ocorrencias medidas (P97). O mecanismo declara a origem a conceder
    // em vez de deixar o agente descobrir por tentativa — e a alternativa a tentativa
    // e o contorno (D148), que e o que estamos tentando extinguir.
    concessao,
    avisos,
  };
}
