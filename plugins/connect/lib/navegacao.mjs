// connect/lib/navegacao.mjs
// Contrato de NAVEGACAO — o interior do vault (par do contrato de manifesto, que
// e a fronteira). Ver config/contrato-navegacao.md.
//
// O manifesto responde "esta entidade existe, quem governa, tem acervo externo?".
// A carta de navegacao responde "montei; por onde entro, o que e camada 1, o que
// carrego so por gatilho, onde termina este vault".
//
// Regras que este modulo implementa (nao negocia):
//   - a camada 1 e DECLARADA pelo vault, nunca prescrita pelo produto (D98).
//     Se a carta nao existe, o retorno e LACUNA — jamais um conjunto de ponteiros
//     inventado pelo mecanismo.
//   - ausencia e gatilho de nascimento, nao erro (D97): o vault monta igual, com a
//     lacuna anunciada e a fabrica oferecida.
//   - compatibilidade de LEITURA com o hot cache legado (`_cerebro/CLAUDE.md`) dos
//     coletivos que funcionavam antes do Connect: le, injeta, marca origem
//     'legado' e avisa a migracao. Nunca reescreve nada.
//   - `entrada` do manifesto e CAMINHO relativo ao acervo. Nome puro (legado) e
//     resolvido por busca limitada que DEIXA MARCA (aviso): a busca e o sintoma de
//     manifesto incompleto, nunca o caminho normal.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';

export const CARTA_CANONICA = path.join('_cerebro', 'camada-1.md');
export const CARTA_LEGADA = path.join('_cerebro', 'CLAUDE.md');

// Secoes obrigatorias (contrato-navegacao.md §3). O contrato exige a RESPOSTA,
// nao o titulo literal (D98: o produto declara a exigencia, a empresa responde
// como quiser). Cada exigencia traz os sinonimos observados em vault real que
// contam como resposta valida — destilados do coletivo maduro que ja funciona
// sem Connect. Titulos sao comparados normalizados (sem acento, minusculo), em
// H2 e H3 (vault real aninha as tabelas de gatilho um nivel abaixo).
export const SECOES_OBRIGATORIAS = [
  { chave: 'o que e este vault', sinonimos: ['o que e este vault', 'o que e este', 'escopo do vault', 'sobre este vault'] },
  { chave: 'estrutura', sinonimos: ['estrutura', 'mapa do vault', 'organizacao do vault'] },
  { chave: 'ordem de entrada', sinonimos: ['ordem de entrada', 'ordem de leitura', 'ponto de pouso', 'por onde comecar'] },
  { chave: 'quando carregar', sinonimos: ['quando carregar', 'protocolo de carregamento', 'carregamento em camadas', 'tabela de gatilhos', 'gatilhos de carregamento'] },
  { chave: 'fronteiras', sinonimos: ['fronteiras', 'fronteira', 'o que nao mora aqui', 'o que fica fora'] },
];

export const LIMITE_LINHAS_CARTA = 250;

const semAcento = (s) => String(s)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

function readIfExists(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
    }
  } catch { /* ignore */ }
  return null;
}

// ---------------------------------------------------------------------------
// titulosH2 — lista os titulos H2 e H3 do markdown, normalizados.
// H3 conta porque vault real aninha as tabelas de gatilho sob um H2 guarda-chuva
// ("## Protocolo de Carregamento" > "### Processo — Quando Carregar").
// ---------------------------------------------------------------------------
export function titulosH2(md) {
  if (!md) return [];
  const out = [];
  for (const raw of md.split(/\r?\n/)) {
    const m = raw.match(/^#{2,3}\s+(.+?)\s*$/);
    if (m) out.push(semAcento(m[1].replace(/[#*`>]/g, '')));
  }
  return out;
}

// Variantes de um titulo normalizado: o inteiro + o que vem depois de um
// separador (em-dash, dois-pontos, barra vertical).
function variantesTitulo(t) {
  const out = [t];
  const m = t.split(/\s*[—–:|]\s*/).filter(Boolean);
  if (m.length > 1) out.push(m[m.length - 1].trim());
  return out;
}

// ---------------------------------------------------------------------------
// validarCarta — confere as secoes obrigatorias e o peso. Nunca lanca.
// Retorna { ok, presentes, faltando, linhas, avisos }.
// ---------------------------------------------------------------------------
export function validarCarta(md) {
  const titulos = titulosH2(md);
  const presentes = [];
  const faltando = [];

  for (const req of SECOES_OBRIGATORIAS) {
    // casamento por sinonimo + substring: "## Estrutura do Vault" satisfaz
    // 'estrutura'; "### Processo — Quando Carregar" satisfaz 'quando carregar'.
    // PREFIXO, nao substring solta (revisao 0.12.0): `t.includes(s)` deixava
    // "## Infraestrutura" satisfazer 'estrutura' e um "## Gatilhos de escrita"
    // satisfazer 'quando carregar' — carta sem nenhuma das 5 respostas passava
    // calada, minando a face de verificacao inteira.
    // Cada titulo gera variantes: o texto inteiro e a parte APOS um separador
    // ("Processo — Quando Carregar" -> "quando carregar"), porque vault real
    // prefixa a secao com o eixo. Casamento por igualdade ou PREFIXO da variante —
    // nunca substring solta (que fazia "Infraestrutura" satisfazer 'estrutura').
    const achou = titulos.some((t) => variantesTitulo(t).some((v) => req.sinonimos.some((s) => v === s || v.startsWith(s))));
    (achou ? presentes : faltando).push(req.chave);
  }

  const linhas = md ? md.split(/\r?\n/).length : 0;
  const avisos = [];
  if (linhas > LIMITE_LINHAS_CARTA) {
    avisos.push(`carta de navegacao com ${linhas} linhas (> ${LIMITE_LINHAS_CARTA}) — indice virando conteudo; mover peso para a nota de destino`);
  }

  return { ok: faltando.length === 0, presentes, faltando, linhas, avisos };
}

// ---------------------------------------------------------------------------
// lerCarta — le a camada 1 DECLARADA pelo vault.
//
// Retorna sempre um objeto (nunca null), com `presente` explicito:
//   { presente, origem: 'canonica'|'legado'|null, caminho, caminhoRelativo,
//     inline, validacao, avisos }
//
// `caminhoRelativo` e relativo ao ALIAS do vault no workspace — o unico formato
// que a sessao usa pra referenciar conhecimento (nunca path de maquina).
// ---------------------------------------------------------------------------
export function lerCarta(vaultRoot, alias = 'vault') {
  const vazio = {
    presente: false,
    origem: null,
    caminho: null,
    caminhoRelativo: null,
    inline: null,
    validacao: null,
    avisos: [],
  };
  if (!vaultRoot || !fs.existsSync(vaultRoot)) return vazio;

  const canonica = path.join(vaultRoot, CARTA_CANONICA);
  const legada = path.join(vaultRoot, CARTA_LEGADA);

  let md = readIfExists(canonica);
  let origem = md ? 'canonica' : null;
  let caminho = md ? canonica : null;
  let rel = md ? CARTA_CANONICA : null;

  if (!md) {
    md = readIfExists(legada);
    if (md) { origem = 'legado'; caminho = legada; rel = CARTA_LEGADA; }
  }

  if (!md) {
    return {
      ...vazio,
      avisos: [`vault sem carta de navegacao (${CARTA_CANONICA.replace(/\\/g, '/')}) — camada 1 NAO declarada. O mecanismo nao inventa ponteiros (D98); ofereca a cnct-fabrica-navegacao ao operador (D97)`],
    };
  }

  const validacao = validarCarta(md);
  const avisos = [...validacao.avisos];

  if (origem === 'legado') {
    avisos.push(`camada 1 lida do hot cache legado (${CARTA_LEGADA.replace(/\\/g, '/')}) — funciona, mas a casa canonica e ${CARTA_CANONICA.replace(/\\/g, '/')}; migracao pendente (nenhum arquivo foi alterado)`);
  }
  if (!validacao.ok) {
    avisos.push(`carta incompleta — secoes obrigatorias ausentes: ${validacao.faltando.join(', ')} (contrato-navegacao.md §3)`);
  }

  return {
    presente: true,
    origem,
    caminho,
    caminhoRelativo: `./${alias}/${rel.replace(/\\/g, '/')}`,
    inline: md.replace(/\s+$/, ''),
    validacao,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// resolverEntrada — transforma o `entrada` do manifesto num CAMINHO real.
//
// Formas aceitas, em ordem (a primeira que resolve vence):
//   1. caminho relativo com .md              -> projetos/Connect/Connect.md   [canonico]
//   2. caminho relativo sem .md              -> projetos/Connect/Connect
//   3. diretorio com nota homonima dentro     -> projetos/Connect/ + Connect.md
//   4. NOME PURO de nota (legado)             -> busca limitada, DEIXA MARCA
//
// Status: 'resolvida' | 'ambigua' | 'ausente' | 'recusada' | 'nao-declarada'
// A forma 4 sempre vem com aviso: manifesto deve declarar caminho (contrato §4).
// ---------------------------------------------------------------------------
export function resolverEntrada(vaultRoot, entrada, alias = 'vault', maxDepth = 4) {
  if (!entrada) return { status: 'nao-declarada', avisos: [] };
  if (!vaultRoot || !fs.existsSync(vaultRoot)) {
    return { status: 'ausente', entrada, avisos: ['acervo indisponivel para resolver a entrada'] };
  }

  const norm = String(entrada).trim().replace(/^\.?[\\/]+/, '').replace(/\\/g, '/');
  const ehCaminho = norm.includes('/');

  // Cinto de seguranca (revisao 0.12.0): `entrada` vem do frontmatter de um
  // manifesto — conteudo sincronizado, semi-confiavel — e o resultado e entregue
  // ao agente como "abra isto antes de qualquer outra coisa". Sem esta guarda,
  // `entrada: ../secret/senhas.md` resolvia como 'declarado', sem aviso, para
  // fora do acervo. Mesmo cinto que `mount.mjs` ja aplica ao alias.
  if (/(^|\/)\.\.(\/|$)/.test(norm) || path.isAbsolute(String(entrada).trim())) {
    return {
      status: 'recusada',
      entrada,
      avisos: [`entrada "${entrada}" sai do acervo (caminho absoluto ou com "..") — recusada. \`entrada\` e sempre caminho relativo a raiz do acervo (contrato-navegacao.md §4)`],
    };
  }

  const tentar = (rel) => {
    const abs = path.join(vaultRoot, rel);
    try { return fs.existsSync(abs) && fs.statSync(abs).isFile() ? rel : null; }
    catch { return null; }
  };

  const candidatos = [];
  if (norm.toLowerCase().endsWith('.md')) candidatos.push(norm);
  else {
    candidatos.push(`${norm}.md`);
    candidatos.push(`${norm}/${path.basename(norm)}.md`);
  }

  for (const c of candidatos) {
    const hit = tentar(c);
    if (hit) {
      return {
        status: 'resolvida',
        entrada,
        caminho: hit,
        caminhoRelativo: `./${alias}/${hit}`,
        origem: ehCaminho ? 'declarado' : 'nome-simples',
        avisos: ehCaminho ? [] : [`\`entrada: ${entrada}\` e nome de nota, nao caminho — resolveu por convencao; declare o caminho relativo ao acervo no manifesto (contrato-navegacao.md §4)`],
      };
    }
  }

  // Forma 4 — nome puro que nao casou por convencao: busca limitada.
  // Ultimo recurso deliberado: resolve a sessao E deixa marca, porque a busca
  // e o sintoma de um manifesto incompleto (nunca o caminho normal).
  // A busca casa pelo NOME do arquivo, mas quando a `entrada` declarou um caminho
  // o hit precisa TERMINAR com esse caminho (case-insensitive) — senao
  // `entrada: clientes/acme/estado.md` com a pasta trocada pousava em
  // `clientes/outro/estado.md`: nota errada, do cliente errado, com aviso genérico.
  // Efeito colateral bom: caixa divergente resolve igual em Linux e Windows.
  const alvo = `${path.basename(norm).replace(/\.md$/i, '')}.md`.toLowerCase();
  const sufixoExigido = ehCaminho ? norm.toLowerCase().replace(/\.md$/i, '') + '.md' : null;
  const achados = [];
  const walk = (dir, depth, relBase) => {
    if (depth > maxDepth || achados.length > 8) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), depth + 1, rel);
      else if (e.isFile() && e.name.toLowerCase() === alvo) {
        if (!sufixoExigido || rel.toLowerCase().endsWith(sufixoExigido)) achados.push(rel);
      }
    }
  };
  walk(vaultRoot, 0, '');

  if (achados.length === 1) {
    return {
      status: 'resolvida',
      entrada,
      caminho: achados[0],
      caminhoRelativo: `./${alias}/${achados[0]}`,
      origem: 'busca',
      avisos: [`entrada "${entrada}" resolvida por BUSCA no acervo (${achados[0]}) — varredura e ultimo recurso e fica registrada: declare \`entrada\` como caminho relativo no manifesto`],
    };
  }
  if (achados.length > 1) {
    return {
      status: 'ambigua',
      entrada,
      candidatos: achados,
      avisos: [`entrada "${entrada}" casa com ${achados.length} notas (${achados.join(', ')}) — manifesto precisa declarar o caminho; nunca escolher por ordem de travessia`],
    };
  }
  return {
    status: 'ausente',
    entrada,
    avisos: [`entrada "${entrada}" nao existe no acervo — nao tatear diretorio; avisar o operador (manifesto aponta para nota inexistente)`],
  };
}
