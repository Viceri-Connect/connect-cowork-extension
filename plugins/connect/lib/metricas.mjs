// connect/lib/metricas.mjs
// M1..M7 — a face de verificacao do INTERIOR do vault (contrato-navegacao.md §9.4).
//
// Até a v0.4.0 as sete metricas existiam so como norma escrita, e o contrato
// dizia isso na cara: "nenhuma esta implementada". A consequencia medida: um
// vault que violasse as §§7-9 montava e navegava normalmente, sem aviso — e a
// carta que fora podada a mao em 26/08 voltou 26% MAIOR em cinco dias, porque
// reducao sem teto mecanico nao persiste.
//
// A precondicao dura da M1 (declarada no contrato) e obedecida aqui: resolver a
// HERANCA e o passo 1. Medir cobertura sobre a carta local sozinha, num vault que
// herda, produz orfa falsa em massa — cada arquivo coberto pela carta de processo
// apareceria como nao coberto. Por isso `medirVault` monta o `alcanceEfetivo`
// (herdado + delta) antes de qualquer varredura.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';
import {
  lerCarta,
  ORCAMENTO_TOKENS_DELTA,
  ORCAMENTO_TOKENS_PROCESSO,
  ORCAMENTO_TOKENS_ENTRADA,
} from './navegacao.mjs';
import { lerCartaProcesso } from './heranca.mjs';
import { estimarTokens, extrairFrontmatter } from './frontmatter.mjs';
import { resolverCorrente } from './alcance.mjs';

// Casas do MECANISMO — cobertas por construcao, nunca exigidas da carta de um
// vault. Sao do produto (corte `_`/conteudo, D96): obrigar cada vault a declarar
// alcance para `_cerebro/` seria o produto cobrando do coletivo a declaracao de
// uma pasta que o proprio produto impoe.
export const CASAS_MECANISMO = ['_cerebro', '_inteligencia', '_automacoes'];

// Arquivos e diretorios que nao sao conteudo de vault e nunca contam como orfa.
const IGNORAR_DIR = new Set(['.git', '.obsidian', 'node_modules', '.connect', '.trash']);
const IGNORAR_ARQ = new Set(['claude.md', '.gitkeep', '.gitignore', '.ds_store', 'thumbs.db']);

const escaparRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Converte um padrao declarado em regex. Placeholders `{...}` casam um segmento
// (nunca atravessam `/`), com dois tipos especiais reconhecidos porque sao os
// que tornam o grau "derivavel" verificavel:
//   {N} / {n}  -> inteiro sequencial
//   {data}     -> AAAA-MM-DD
function paraRegex(padrao, { ancorarFim = true } = {}) {
  let re = '';
  const texto = String(padrao || '');
  for (let i = 0; i < texto.length; i += 1) {
    if (texto[i] === '{') {
      const fim = texto.indexOf('}', i);
      if (fim === -1) { re += escaparRegex(texto[i]); continue; }
      const nome = texto.slice(i + 1, fim).toLowerCase();
      if (nome === 'n') re += '\\d+';
      else if (nome === 'data') re += '\\d{4}-\\d{2}-\\d{2}';
      else re += '[^/]+';
      i = fim;
      continue;
    }
    if (texto[i] === '*') {
      if (texto[i + 1] === '*') { re += '.*'; i += 1; continue; }
      re += '[^/]*';
      continue;
    }
    re += escaparRegex(texto[i]);
  }
  return new RegExp(`^${re}${ancorarFim ? '$' : ''}`, 'i');
}

const normalizarCasa = (casa) => String(casa || '')
  .replace(/\\/g, '/')
  .replace(/^\.?\//, '')
  .replace(/\/+$/, '');

function listarArquivos(raiz) {
  const out = [];
  const walk = (dir, rel) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const nome = e.name;
      const filho = rel ? `${rel}/${nome}` : nome;
      if (e.isDirectory()) {
        if (IGNORAR_DIR.has(nome.toLowerCase())) continue;
        walk(path.join(dir, nome), filho);
      } else if (e.isFile()) {
        if (IGNORAR_ARQ.has(nome.toLowerCase())) continue;
        if (nome.startsWith('.')) continue;
        out.push(filho);
      }
    }
  };
  walk(raiz, '');
  return out;
}

// Existe algum caminho que casa com `alvo`, expandindo placeholders `{...}` num
// segmento? Usado por M5 (ponteiro da carta de processo, que e generico por
// natureza) e por M7 (estrutura minima, idem).
function existeExpandindo(raiz, alvo) {
  const partes = normalizarCasa(alvo).split('/').filter(Boolean);
  if (!partes.length) return false;

  let atuais = [raiz];
  for (let i = 0; i < partes.length; i += 1) {
    const parte = partes[i];
    const ultima = i === partes.length - 1;
    const generico = parte.includes('{') || parte.includes('*');
    const proximos = [];
    for (const base of atuais) {
      if (!generico) {
        const p = path.join(base, parte);
        try { if (fs.existsSync(p)) proximos.push(p); } catch { /* ignore */ }
        continue;
      }
      const re = paraRegex(parte);
      let ents;
      try { ents = fs.readdirSync(base, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (IGNORAR_DIR.has(e.name.toLowerCase())) continue;
        if (!re.test(e.name)) continue;
        if (ultima || e.isDirectory()) proximos.push(path.join(base, e.name));
      }
    }
    atuais = proximos;
    if (!atuais.length) return false;
  }
  return atuais.length > 0;
}

// Caminho que, por natureza, NAO mora dentro de um vault de conhecimento. Sao
// dois casos, e nenhum e ponteiro morto — sao ponteiros que deveriam ser TIPADOS
// (regra do contrato de escrita: `[[wikilink]]` so para nota do mesmo vault,
// artefato externo -> path nomeando a natureza).
const ARQUIVOS_DO_PRODUTO = /^(config\/(contrato-[a-z-]+|protocolo-mecanismo|connect\.config\.example)\.(md|json)|(GLOSSARIO|FRAMEWORK|CONCEITOS|CHANGELOG)\.md)$/i;
const ALIAS_DE_OUTRO_VAULT = /^(operador|pessoal|matriz)\//i;

function naturezaExterna(caminho) {
  const c = normalizarCasa(caminho);
  if (ARQUIVOS_DO_PRODUTO.test(c)) return 'arquivo do produto (plugin `connect`), nao do vault';
  if (ALIAS_DE_OUTRO_VAULT.test(c)) return 'caminho de OUTRO vault montado na sessao, nao deste';
  return null;
}

// Acha `alvo` como SUFIXO de algum caminho do vault (busca limitada, ate 4
// niveis). Serve para separar ponteiro morto de ponteiro ambiguo na M5 — e a
// unica varredura deste modulo, e existe justamente para classificar defeito de
// navegacao, nunca para navegar.
function acharPorSufixo(raiz, alvo, maxDepth = 4) {
  const sufixo = normalizarCasa(alvo).toLowerCase();
  if (!sufixo) return null;
  const generico = sufixo.includes('{') || sufixo.includes('*');
  const re = generico ? paraRegex(sufixo, { ancorarFim: true }) : null;
  let achado = null;
  const walk = (dir, rel, depth) => {
    if (achado || depth > maxDepth) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (achado) return;
      if (IGNORAR_DIR.has(e.name.toLowerCase())) continue;
      const filho = rel ? `${rel}/${e.name}` : e.name;
      const alvoComp = filho.toLowerCase();
      const casa = generico ? re.test(alvoComp) : (alvoComp === sufixo || alvoComp.endsWith(`/${sufixo}`));
      if (casa) { achado = filho; return; }
      if (e.isDirectory()) walk(path.join(dir, e.name), filho, depth + 1);
    }
  };
  walk(raiz, '', 0);
  return achado;
}

// Traduz uma casa declarada com placeholder nas INSTANCIAS reais do disco
// (`projetos/{projeto}` -> ['projetos/Connect']). E a instancia que tem hub, nao
// o padrao — sem esta traducao a corrente de alcance nao tem onde continuar.
function instanciasDaCasa(raiz, casaDeclarada) {
  const partes = normalizarCasa(casaDeclarada).split('/').filter(Boolean);
  if (!partes.length) return [''];
  let atuais = [{ abs: raiz, rel: '' }];
  for (const parte of partes) {
    const generico = /[{}*]/.test(parte);
    const re = generico ? paraRegex(parte) : null;
    const prox = [];
    for (const base of atuais) {
      let ents;
      try { ents = fs.readdirSync(base.abs, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (!e.isDirectory()) continue;
        if (IGNORAR_DIR.has(e.name.toLowerCase())) continue;
        if (generico ? !re.test(e.name) : e.name.toLowerCase() !== parte.toLowerCase()) continue;
        prox.push({ abs: path.join(base.abs, e.name), rel: base.rel ? `${base.rel}/${e.name}` : e.name });
      }
    }
    atuais = prox;
    if (!atuais.length) return [];
  }
  return atuais.map((a) => a.rel);
}

// ---------------------------------------------------------------------------
// Declaracoes de alcance — normaliza uma entrada de `alcance:` do frontmatter.
// Forma canonica (contrato §8): casa + padrao + filtros, com `grau` explicito.
// ---------------------------------------------------------------------------
function normalizarDeclaracao(d, origem) {
  if (!d || typeof d !== 'object') return null;
  const casa = normalizarCasa(d.casa ?? d.house ?? '');
  if (!casa && casa !== '') return null;
  const filtros = Array.isArray(d.filtros) ? d.filtros : (d.filtros ? [d.filtros] : []);
  return {
    casa,
    padrao: d.padrao ? String(d.padrao) : null,
    grau: d.grau ? String(d.grau).toLowerCase() : null,
    filtros,
    // Linha com padrao E hub declara duas coisas ao mesmo tempo: o nivel TEM
    // padrao (logo e alcancavel por construcao) e ainda mantem um indice
    // autorado. E exatamente a classe da IMP-001, e a M2 reporta.
    // Linha com hub e SEM padrao e delegacao, nao indice — outra coisa.
    indiceAutorado: d['indice-autorado'] ? String(d['indice-autorado']) : ((d.hub && d.padrao) ? String(d.hub) : null),
    // PRESERVAR o hub: era aqui que a corrente morria. `normalizarDeclaracao`
    // descartava a coluna e `resolverCorrente` recebia toda linha como folha —
    // nenhum hub era percorrido, e a cobertura voltava a depender do que a carta
    // lista. Defeito silencioso: as metricas rodavam e diziam `ok`.
    hub: d.hub ? String(d.hub) : null,
    recursivo: String(d.recursivo ?? '').toLowerCase() === 'true',
    origem, // 'processo' | 'delta' | 'hub …'
  };
}

function cobre(decl, relArquivo) {
  const rel = relArquivo.replace(/\\/g, '/');
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  const base = rel.slice(rel.lastIndexOf('/') + 1);

  const casaRe = paraRegex(decl.casa, { ancorarFim: !decl.recursivo });
  if (!casaRe.test(dir)) return false;
  if (!decl.padrao) return true; // casa declarada sem padrao => nivel listavel
  return paraRegex(decl.padrao).test(base);
}

// ---------------------------------------------------------------------------
// Extracao de caminhos citados pela carta (insumo da M5).
// So o que esta em `backtick` e parece caminho de vault — nunca prosa, nunca
// wikilink (wikilink e nome de nota, resolvido pelo Obsidian, nao caminho).
// ---------------------------------------------------------------------------
export function caminhosCitados(md) {
  if (!md) return [];
  // So o CORPO. O frontmatter e declaracao de alcance (`padrao: "ADR-{N}-{slug}.md"`)
  // e nao ponteiro: medir padrao de nomenclatura como se fosse caminho produziu 8
  // "mortos" falsos na primeira execucao real, e falso positivo em metrica de
  // ponteiro e pior que metrica ausente — ela treina a ignorar o relatorio.
  const { corpo } = extrairFrontmatter(md);
  const out = new Set();
  for (const m of String(corpo).matchAll(/`([^`\n]+)`/g)) {
    const bruto = m[1].trim();
    if (!bruto || /\s/.test(bruto)) continue;
    if (/^[a-z]+:\/\//i.test(bruto)) continue;        // URL
    if (/^[A-Za-z]:[\\/]/.test(bruto)) continue;      // path de maquina (M6 cuida)
    const norm = bruto.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!/\.md$|\/$/.test(norm)) continue;            // nota ou diretorio, nada mais
    if (norm.startsWith('../') || norm.startsWith('/')) continue;
    // Nome nu com placeholder (`ADR-{N}-{slug}.md`) e PADRAO, nao caminho: o que
    // o declara e o `alcance`, e quem verifica e a M1/M2.
    if (!norm.includes('/') && /[{}]/.test(norm)) continue;
    out.add(norm);
  }
  return [...out];
}

function secao(md, tituloNormalizado) {
  if (!md) return '';
  const linhas = String(md).split(/\r?\n/);
  const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let dentro = false;
  const out = [];
  for (const l of linhas) {
    const h = l.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (h) {
      const t = semAcento(h[2].replace(/[#*`>]/g, '').trim());
      if (t.startsWith(tituloNormalizado)) { dentro = true; continue; }
      if (dentro) break;
    }
    if (dentro) out.push(l);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// medirVault — roda as sete metricas num vault. Nunca lanca.
//
// Retorna { vault, alias, processo, heranca, metricas: { M1..M7 }, resumo }.
// Cada metrica: { id, nome, status: 'ok'|'falha'|'nao-aplicavel', ... }.
// ---------------------------------------------------------------------------
export function medirVault({
  vaultRoot,
  alias = 'vault',
  governanteRoot = null,
  aliasGovernante = 'matriz',
  pouso = null,
} = {}) {
  const erro = (motivo) => ({
    vault: vaultRoot || null,
    alias,
    erro: motivo,
    metricas: {},
    resumo: { ok: 0, falha: 0, naoAplicavel: 7 },
  });
  if (!vaultRoot || !fs.existsSync(vaultRoot)) return erro('vault inacessivel');

  const carta = lerCarta(vaultRoot, alias);
  if (!carta.presente) return erro('vault sem carta de navegacao — medir alcance sem carta nao produz metrica, produz lista de arquivos');

  const processo = carta.processo;
  const cartaProcesso = processo ? lerCartaProcesso(governanteRoot, processo, aliasGovernante) : null;

  // PRECONDICAO DURA DA M1: heranca resolvida antes da varredura.
  // E, desde 02/09, a corrente tambem: a carta declara casa + hub, e e o HUB que
  // declara o alcance do nivel. Medir so o que a carta lista acusaria como orfa
  // tudo o que os hubs cobrem — inflacao de defeito falso, que queima a metrica.
  // A carta de processo declara UMA linha de alcance por topologia admissivel, e
  // so a do vault vale aqui. Sem este filtro, a topologia que o vault NAO usa
  // casa com os diretorios internos dele: medido em 02/09, `projetos/{ciclo}/{projeto}`
  // casou com `projetos/Connect/adr`, `.../backlog` e `.../historico`, e o
  // mecanismo passou a exigir um hub `adr/adr.md` que nunca deveria existir —
  // tres defeitos inventados pelo proprio medidor.
  const topologiaLocal = carta.frontmatter?.topologia ? String(carta.frontmatter.topologia).trim() : null;
  const topologiasDoProcesso = cartaProcesso?.topologias || [];
  const daOutraTopologia = (casa) => {
    const c = normalizarCasa(casa);
    if (!topologiaLocal || !topologiasDoProcesso.length) return false;
    return topologiasDoProcesso.some((t) => normalizarCasa(t) === c) && normalizarCasa(topologiaLocal) !== c;
  };

  const raizes = [
    ...(cartaProcesso?.alcance || [])
      .filter((d) => !daOutraTopologia(d.casa))
      .map((d) => normalizarDeclaracao(d, 'processo')),
    ...(carta.alcance || []).map((d) => normalizarDeclaracao(d, 'delta')),
  ].filter(Boolean);

  const corrente = resolverCorrente({
    vaultRoot,
    declaracoesIniciais: raizes,
    instanciasDaCasa: (casa) => instanciasDaCasa(vaultRoot, casa),
  });
  const declaracoes = corrente.decls.map((d) => normalizarDeclaracao(d, d.origem || 'corrente')).filter(Boolean);

  const heranca = {
    declarado: processo,
    cartaPresente: !!cartaProcesso?.presente,
    caminho: cartaProcesso?.caminhoRelativo || null,
    declaracoesHerdadas: raizes.filter((d) => d.origem === 'processo').length,
    declaracoesLocais: raizes.filter((d) => d.origem === 'delta').length,
    declaracoesDeHub: declaracoes.filter((d) => String(d.origem).startsWith('hub')).length,
    delegacoes: corrente.delegacoes,
    avisos: cartaProcesso?.avisos || [],
  };

  const M = {};

  // ---- M1 — Cobertura -----------------------------------------------------
  if (!declaracoes.length) {
    M.M1 = {
      id: 'M1',
      nome: 'Cobertura',
      status: 'falha',
      motivo: 'a carta efetiva (herdada + delta) nao declara nenhum `alcance:` — sem declaracao de nivel, TODO arquivo do vault e orfa por definicao (contrato §8)',
      orfas: [],
      total: 0,
    };
  } else {
    const arquivos = listarArquivos(vaultRoot);
    const orfas = [];
    for (const rel of arquivos) {
      const primeiroSeg = rel.split('/')[0];
      if (CASAS_MECANISMO.includes(primeiroSeg)) continue;
      if (declaracoes.some((d) => cobre(d, rel))) continue;
      orfas.push(rel);
    }
    M.M1 = {
      id: 'M1',
      nome: 'Cobertura',
      status: (orfas.length === 0 && !corrente.defeitos.length) ? 'ok' : 'falha',
      total: arquivos.length,
      orfas: orfas.slice(0, 50),
      orfasTotal: orfas.length,
      // Classe nova, que a declaracao concentrada na carta nao tinha como
      // detectar: casa delegada a um hub que nao existe, ou que existe e nao
      // declara `## Alcance`. O nivel abaixo fica sem cobertura e a carta
      // PARECE completa — defeito silencioso, o pior tipo pela §7.
      correnteQuebrada: corrente.defeitos,
      motivo: orfas.length
        ? `${orfas.length} arquivo(s) que nenhuma declaracao de nivel cobre — sao alcancaveis so por varredura, ou seja, orfas (check 6 do contrato, agora computavel)`
        : (corrente.defeitos.length ? 'a corrente de alcance quebra antes de cobrir o vault inteiro' : null),
    };
  }

  // ---- M2 — Grau de padrao ------------------------------------------------
  const defeitosGrau = [];
  for (const d of declaracoes) {
    const onde = `${d.casa || '(raiz)'}${d.padrao ? ` :: ${d.padrao}` : ''} [${d.origem}]`;
    // Linha DELEGADA nao declara grau, e nem deve: quem responde pelo grau
    // daquele nivel e o hub. Cobrar grau aqui obrigaria a carta a repetir o que
    // ela acabou de delegar — a duplicacao que a corrente existe para evitar.
    if (d.hub && !d.padrao) continue;
    if (!d.grau) {
      defeitosGrau.push(`${onde} — sem \`grau\` declarado (derivavel | listavel | autorado)`);
      continue;
    }
    if (!['derivavel', 'listavel', 'autorado'].includes(d.grau)) {
      defeitosGrau.push(`${onde} — grau "${d.grau}" nao existe no contrato §8.1`);
      continue;
    }
    if (d.grau === 'autorado' && !d.indiceAutorado) {
      defeitosGrau.push(`${onde} — grau \`autorado\` exige declarar qual e o indice (\`indice-autorado:\`), senao o nivel nao tem como ser alcancado`);
    }
    if (d.grau !== 'autorado' && d.indiceAutorado) {
      defeitosGrau.push(`${onde} — indice autorado (\`${d.indiceAutorado}\`) sobre nivel \`${d.grau}\`: e DEFEITO, nao zelo (contrato §8.1). Ele cobra a massa inteira de todo mundo que passa e apodrece; a listagem derivada substitui`);
    }
  }
  M.M2 = {
    id: 'M2',
    nome: 'Grau de padrao',
    status: defeitosGrau.length ? 'falha' : 'ok',
    defeitos: defeitosGrau,
  };

  // ---- M3 — Massa da carta, em duas partes --------------------------------
  const tokensDelta = estimarTokens(carta.corpo ?? carta.inline);
  const tokensProcesso = cartaProcesso?.presente ? cartaProcesso.tokens : 0;
  const partes = [
    {
      parte: 'delta local',
      dono: `quem governa ./${alias}`,
      tokens: tokensDelta,
      orcamento: ORCAMENTO_TOKENS_DELTA,
      ok: tokensDelta <= ORCAMENTO_TOKENS_DELTA,
    },
  ];
  if (processo) {
    partes.push({
      parte: `carta de processo (${processo})`,
      dono: `quem governa o processo (./${aliasGovernante}) — cobrada 1x por sessao, nao 1x por vault`,
      tokens: tokensProcesso,
      orcamento: ORCAMENTO_TOKENS_PROCESSO,
      ok: tokensProcesso <= ORCAMENTO_TOKENS_PROCESSO,
    });
  }
  M.M3 = {
    id: 'M3',
    nome: 'Massa da carta (tokens)',
    status: partes.every((p) => p.ok) ? 'ok' : 'falha',
    partes,
  };

  // ---- M4 — Massa do caminho de entrada -----------------------------------
  const lerTexto = (rel) => {
    try {
      const p = path.join(vaultRoot, rel);
      return fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p, 'utf8') : null;
    } catch { return null; }
  };
  const vaultConfig = lerTexto(path.join('_cerebro', 'vault-config.md'));
  // Pouso: o informado pelo chamador (manifesto ja resolvido) ou o primeiro
  // caminho citado na secao de ordem de entrada da carta.
  const pousoRel = pouso
    || caminhosCitados(secao(carta.inline, 'ordem de entrada')).find((c) => c.endsWith('.md'))
    || null;
  const pousoTexto = pousoRel ? lerTexto(pousoRel) : null;
  const compEntrada = [
    { componente: `carta (${carta.caminhoRelativo})`, tokens: tokensDelta },
    { componente: '_cerebro/vault-config.md', tokens: estimarTokens(vaultConfig) },
    { componente: pousoRel ? `pouso declarado (${pousoRel})` : 'pouso declarado (nao identificado)', tokens: estimarTokens(pousoTexto) },
  ];
  const totalEntrada = compEntrada.reduce((a, c) => a + c.tokens, 0);
  M.M4 = {
    id: 'M4',
    nome: 'Massa do caminho de entrada',
    status: totalEntrada <= ORCAMENTO_TOKENS_ENTRADA ? 'ok' : 'falha',
    total: totalEntrada,
    orcamento: ORCAMENTO_TOKENS_ENTRADA,
    componentes: compEntrada,
    motivo: totalEntrada > ORCAMENTO_TOKENS_ENTRADA
      ? 'o pouso declarado pode custar sozinho mais que a carta — e e cobrado de toda sessao que entra por ele'
      : null,
  };

  // ---- M5 — Ponteiro morto ------------------------------------------------
  // Duas classes distintas, e fundi-las tornaria a metrica inutil por ruido
  // (medido na primeira execucao real: 16 "mortos" na carta da matriz, dos quais
  // 14 eram caminhos citados relativos a uma pasta-mae, nao a raiz do vault):
  //   - MORTO      — nao existe em lugar nenhum do vault. Falha.
  //   - AMBIGUO    — existe, mas nao a partir da raiz: a carta cita
  //                  `metodologias/` dentro de uma secao sobre `_cerebro/`.
  //                  Resolve para quem ja sabe onde esta, que e justamente quem
  //                  a carta nao serve. Aviso, nao falha.
  //   - FORA       — caminho que nao e do vault: arquivo do proprio produto
  //                  (`config/contrato-*.md`) ou de outro vault (`operador/…`).
  //                  Nao e ponteiro morto, e ponteiro que deveria ser TIPADO —
  //                  regra que ja existe no contrato de escrita. Aviso.
  const mortos = [];
  const ambiguos = [];
  const fora = [];
  const conferir = (lista, origem) => {
    for (const c of lista) {
      if (existeExpandindo(vaultRoot, c)) continue;
      const natureza = naturezaExterna(c);
      if (natureza) { fora.push({ caminho: c, natureza, origem }); continue; }
      // Caminho que nao existe aqui e existe no GOVERNANTE nao e morto: e
      // ponteiro cross-vault que deveria ser tipado (nomear o conceito a
      // resolver, nunca o caminho do outro acervo). Medido na carta de um
      // cliente maduro, que citava `_cerebro/metodologias/sdd/...` da matriz
      // como se fosse caminho local — tres "mortos" que estavam vivos, no
      // vault ao lado.
      if (governanteRoot && existeExpandindo(governanteRoot, c)) {
        fora.push({ caminho: c, natureza: 'existe no vault que governa, nao neste — nomear o conceito a resolver, nunca o caminho do outro acervo', origem });
        continue;
      }
      const emOutroLugar = acharPorSufixo(vaultRoot, c);
      if (emOutroLugar) { ambiguos.push({ caminho: c, resolveEm: emOutroLugar, origem }); continue; }
      mortos.push({ caminho: c, origem });
    }
  };
  // `corpo`, nao `inline`: a secao `## Alcance` declara PADRAO, e padrao nao e
  // ponteiro. Ler o arquivo inteiro aqui fazia a propria declaracao de alcance
  // ser reportada como ponteiro morto.
  conferir(caminhosCitados(carta.corpo ?? carta.inline), 'carta local');

  // O modo de falha NOVO que a heranca cria: o ponteiro da carta de processo e
  // valido no vault A e morto no vault B, e nenhum dos dois donos ve isso.
  //
  // Mas a carta de processo mora no vault que GOVERNA o processo, e cita caminhos
  // dos dois mundos. Confundi-los produziria falso positivo em massa:
  //   - sem placeholder (`_cerebro/metodologias/sdd/`) -> e caminho do governante;
  //     resolve la, e ausencia AQUI nao significa nada.
  //   - com placeholder (`projetos/{projeto}/rnf/`)    -> e caminho de quem herda;
  //     ausencia aqui e real, e e exatamente o que a M7 reporta — entao vai para
  //     `heranca`, com o ponteiro para a M7, e nao duplicado como "morto".
  const herdadosSemCasa = [];
  if (cartaProcesso?.presente) {
    const origem = `carta de processo (${processo})`;
    for (const c of caminhosCitados(cartaProcesso.corpo ?? cartaProcesso.inline)) {
      const generico = /[{}*]/.test(c);
      if (!generico) {
        if (governanteRoot && existeExpandindo(governanteRoot, c)) continue;
        if (existeExpandindo(vaultRoot, c)) continue;
        const natureza = naturezaExterna(c);
        if (natureza) { fora.push({ caminho: c, natureza, origem }); continue; }
        mortos.push({ caminho: c, origem: `${origem} — nao existe nem no governante nem em ./${alias}` });
        continue;
      }
      // Generico tambem pode ser caminho do governante (`…/papeis/{papel}.md`):
      // conferir la ANTES de acusar ausencia aqui, senao todo template de papel
      // do processo apareceria como casa faltante em cada vault que o herda.
      if (governanteRoot && existeExpandindo(governanteRoot, c)) continue;
      if (existeExpandindo(vaultRoot, c)) continue;
      herdadosSemCasa.push({ caminho: c, origem });
    }
  }
  M.M5 = {
    id: 'M5',
    nome: 'Ponteiro morto',
    status: mortos.length ? 'falha' : 'ok',
    mortos,
    ambiguos,
    fora,
    // Ponteiro herdado sem casa NESTE vault. Nao e falha da M5: e o sintoma da
    // falha da M7, e reportar nos dois lugares treinaria a ignorar os dois.
    herdadosSemCasa,
  };

  // ---- M6 — Fronteiras nomeiam conceito -----------------------------------
  const fronteiras = secao(carta.inline, 'fronteira');
  const violacoes = [];
  if (!fronteiras.trim()) {
    violacoes.push('secao `## Fronteiras` ausente ou vazia — o agente nao sabe quando sair deste vault nem por onde');
  } else {
    for (const l of fronteiras.split(/\r?\n/)) {
      if (/[A-Za-z]:[\\/]/.test(l)) violacoes.push(`caminho de maquina em Fronteiras: ${l.trim()}`);
      if (/[a-z]+:\/\//i.test(l)) violacoes.push(`URL em Fronteiras: ${l.trim()}`);
    }
  }
  M.M6 = {
    id: 'M6',
    nome: 'Fronteiras nomeiam conceito',
    status: violacoes.length ? 'falha' : 'ok',
    violacoes,
  };

  // ---- M7 — Conformidade de heranca ---------------------------------------
  // NAO verifica existencia de pasta. Verifica COMPATIBILIDADE TOPOLOGICA.
  //
  // A versao de 02/09-manha exigia que as casas da `estrutura-minima` existissem
  // no disco, e isso reprovava todo vault recem-nascido: vault que a fabrica
  // acabou de provisionar nao tem projeto, logo nao tem casa de ADR, de backlog
  // nem de RNF — e essas casas nascem quando o projeto passa pelos refinamentos,
  // nao no provisionamento. Reprovar o estado normal de nascimento contraria o
  // invariante que o proprio contrato declara: ausencia e gatilho de nascimento,
  // nao erro.
  //
  // O que a heranca de fato quebra em silencio e outra coisa: gatilho herdado que
  // aponta para uma FORMA de caminho que aquele vault nunca usa. Um vault que
  // organiza `projetos/{ciclo}/{projeto}/` recebe da carta de processo ponteiros
  // para `projetos/{projeto}/` que nao resolvem nunca — com projeto ou sem.
  if (!processo) {
    M.M7 = {
      id: 'M7',
      nome: 'Conformidade topologica da heranca',
      status: 'nao-aplicavel',
      motivo: 'vault nao declara `processo:` — nao herda nada, logo nao ha conformidade a verificar. Ausencia de `processo:` NAO e lacuna (contrato §9.3)',
    };
  } else if (!cartaProcesso?.presente) {
    M.M7 = {
      id: 'M7',
      nome: 'Conformidade topologica da heranca',
      status: 'falha',
      motivo: `declara \`processo: ${processo}\` e a carta de processo nao existe — heranca quebrada, e este e o modo de falha silencioso que a M7 existe para pegar`,
    };
  } else if (!cartaProcesso.topologias.length) {
    M.M7 = {
      id: 'M7',
      nome: 'Conformidade topologica da heranca',
      status: 'nao-aplicavel',
      motivo: `a carta de processo \`${processo}\` nao declara \`topologia:\` — processo que nao restringe a forma do caminho admite qualquer uma, e nao ha incompatibilidade possivel a reportar`,
    };
  } else {
    // A topologia declarada pelo vault (frontmatter da carta local) vence; sem
    // declaracao, tenta casar com alguma das admissiveis pelo conteudo do disco.
    const declaradaLocal = carta.frontmatter?.topologia ? String(carta.frontmatter.topologia).trim() : null;
    const admissiveis = cartaProcesso.topologias;
    const comInstancia = admissiveis.filter((t) => instanciasDaCasa(vaultRoot, t).length > 0);

    let status = 'ok';
    let motivo = null;
    if (declaradaLocal && !admissiveis.includes(declaradaLocal)) {
      status = 'falha';
      motivo = `o vault declara \`topologia: ${declaradaLocal}\` e o processo \`${processo}\` admite ${admissiveis.map((t) => '`' + t + '`').join(' ou ')} — os ponteiros herdados nao resolvem nesta forma, com conteudo ou sem`;
    } else if (comInstancia.length === 0) {
      // Nenhuma forma admissivel tem instancia: pode ser vault recem-nascido
      // (normal) ou topologia divergente (defeito). Nao ha como distinguir sem
      // conteudo, e acusar aqui seria reprovar o nascimento.
      status = 'ok';
      motivo = 'nenhuma instancia no disco ainda — vault sem conteudo e conformante por construcao (ausencia e nascimento, nao defeito). A verificacao volta a ter o que medir no primeiro projeto';
    } else if (!declaradaLocal && comInstancia.length > 1) {
      status = 'falha';
      motivo = `o disco tem conteudo em mais de uma forma admissivel (${comInstancia.map((t) => '`' + t + '`').join(', ')}) e a carta local nao declara \`topologia:\` — o mecanismo nao adivinha qual e a do vault, e escolher por travessia daria resposta diferente por maquina`;
    }

    // Divergencia real: existe conteudo sob `projetos/` que nenhuma forma
    // admissivel alcanca. E o caso que a metrica existe para pegar.
    const raizProjeto = admissiveis[0].split('/')[0];
    const alcancadas = new Set();
    for (const t of admissiveis) for (const i of instanciasDaCasa(vaultRoot, t)) alcancadas.add(i);
    const orfaosDeForma = [];
    if (raizProjeto && fs.existsSync(path.join(vaultRoot, raizProjeto))) {
      for (const rel of listarArquivos(vaultRoot)) {
        if (!rel.startsWith(`${raizProjeto}/`)) continue;
        if ([...alcancadas].some((a) => rel.startsWith(`${a}/`))) continue;
        // Profundidade <= a da propria topologia nao e divergencia de FORMA:
        // arquivo direto no nivel do ciclo e projeto ainda nao empastado, e quem
        // cobra isso e a M1 (cobertura). A M7 so olha o que esta ABAIXO da
        // profundidade que a topologia alcanca — ali sim a forma divergiu.
        if (rel.split('/').length <= admissiveis[0].split('/').length) continue;
        orfaosDeForma.push(rel);
      }
    }
    if (orfaosDeForma.length) {
      status = 'falha';
      motivo = `${orfaosDeForma.length} arquivo(s) sob \`${raizProjeto}/\` em profundidade que nenhuma topologia admissivel alcanca (ex.: \`${orfaosDeForma[0]}\`) — a forma real do vault divergiu da que o processo declara, e os ponteiros herdados nao resolvem`;
    }

    M.M7 = {
      id: 'M7',
      nome: 'Conformidade topologica da heranca',
      status,
      admissiveis,
      declaradaLocal,
      comInstancia,
      orfaosDeForma: orfaosDeForma.slice(0, 10),
      motivo,
    };
  }

  const vals = Object.values(M);
  return {
    vault: vaultRoot,
    alias,
    processo,
    heranca,
    metricas: M,
    resumo: {
      ok: vals.filter((m) => m.status === 'ok').length,
      falha: vals.filter((m) => m.status === 'falha').length,
      naoAplicavel: vals.filter((m) => m.status === 'nao-aplicavel').length,
    },
  };
}
