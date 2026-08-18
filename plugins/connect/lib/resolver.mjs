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
    externo: ehVerdadeiro(top.externo),
    criadoPor: top['criado-por'] || null,
    criadoEm: top['criado-em'] || null,
    entrada: top.entrada || null,
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
export function casar(registro, termo) {
  if (!termo) return null;
  const t = String(termo).toLowerCase().trim();

  // conceito exato: qualquer entidade, mesmo sem acervo (precisa achar pra
  // devolver 'sem-acervo-externo' quando alguem nomeia ela certinho).
  let hit = registro.find((e) => String(e.conceito).toLowerCase() === t);
  if (hit) return hit;

  // gatilho/substring: restrito a quem tem acervo — nunca deixar uma tag
  // topica de doc de conteudo roubar o match de quem de fato monta algo.
  const candidatas = registro.filter((e) => e.externo);
  hit = candidatas.find((e) => e.gatilhos.some((g) => String(g).toLowerCase() === t));
  if (hit) return hit;
  hit = candidatas.find((e) =>
    String(e.conceito).toLowerCase().includes(t) ||
    e.gatilhos.some((g) => String(g).toLowerCase().includes(t)));
  return hit || null;
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
export function resolver({ conceito, workspaceDir, alias, replace = false, ...override } = {}) {
  const cfg = resolveConfig(override);
  const roots = [cfg.cerebroPessoal, cfg.vaultMatriz].filter(Boolean);
  const registro = lerRegistro(roots);
  const disponiveis = registro.map((e) => e.conceito);

  if (!conceito) {
    return { status: 'erro', motivo: 'conceito ausente', disponiveis };
  }
  const entry = casar(registro, conceito);
  if (!entry) {
    return { status: 'nao-encontrado', conceito, disponiveis, avisos: [`nenhum manifesto casa com "${conceito}"`] };
  }

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

  const caminhoLocal = cfg.subVaults?.[entry.conceito];
  if (!caminhoLocal) {
    return {
      status: 'local-nao-configurado',
      conceito: entry.conceito,
      avisos: [`esta maquina ainda nao sabe onde "${entry.conceito}" mora localmente — pergunte ao operador o diretorio e grave com registrarSubVaultLocal({ conceito: "${entry.conceito}", caminho })`],
    };
  }
  if (!fs.existsSync(caminhoLocal)) {
    return {
      status: 'origem-ausente',
      conceito: entry.conceito,
      origem: caminhoLocal,
      avisos: [`origem nao existe: ${caminhoLocal} (se for OneDrive, sincronize "manter neste dispositivo"; sem acesso a fonte, procure quem governa — D97)`],
    };
  }
  if (!workspaceDir) {
    return { status: 'sem-workspace', conceito: entry.conceito, origem: caminhoLocal, avisos: ['workspaceDir ausente — informe o diretorio da sessao (estado_sessao.workspace)'] };
  }

  const aliasFinal = alias || entry.alias;
  let mountReport;
  try {
    mountReport = mount({ workspaceDir, alias: aliasFinal, source: caminhoLocal, replace });
  } catch (e) {
    return { status: 'erro-mount', conceito: entry.conceito, alias: aliasFinal, avisos: [e.message] };
  }

  // Camada 1 do sub-vault — MESMA forma da matriz (corolario do D97: o interior
  // tem o mesmo contrato em todos os niveis). Sempre montada: a carta de
  // navegacao e o que orienta o agente dentro do acervo, e a AUSENCIA dela e
  // informacao (lacuna anunciada), nao motivo para omitir a camada.
  let l1 = null;
  try {
    l1 = montarL1(caminhoLocal, aliasFinal);
  } catch { /* nunca derruba a resolucao por causa da camada 1 */ }

  // Ponto de pouso — `entrada` do manifesto resolvida a CAMINHO real. Sem isso,
  // pousar exigiria varrer o diretorio: exatamente o contorno que o protocolo
  // proibe (o gap que o D120 deixou aberto).
  const entradaResolvida = resolverEntrada(caminhoLocal, entry.entrada, aliasFinal);

  const avisos = [
    ...(l1?.avisos || []),
    ...(entradaResolvida.avisos || []),
  ];

  return {
    status: 'resolvido',
    conceito: entry.conceito,
    tipo: entry.tipo,
    papel: entry.papel,
    alias: aliasFinal,
    origem: caminhoLocal,
    caminhoRelativo: `./${aliasFinal}`,
    entrada: entry.entrada || null,
    entradaResolvida,
    mount: mountReport,
    l1,
    nota: entry.nota,
    avisos,
  };
}
