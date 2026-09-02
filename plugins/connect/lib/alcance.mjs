// connect/lib/alcance.mjs
// Declaracao de ALCANCE (contrato-navegacao.md §8) — a corrente
// carta -> hub da casa -> nivel, e a leitura dela.
//
// POR QUE A CORRENTE, E NAO A LISTA NA CARTA (correcao de 02/09).
// A primeira implementacao pos toda a declaracao de alcance na carta de
// navegacao: uma entrada por NIVEL do vault. Isso violava o proprio criterio
// que o alcance implementa. A §7 arbitra risco de varredura (1), depois massa
// no caminho (2), depois saltos (3) — e declara que *mais saltos costuma ser
// melhor, porque um salto custa uma leitura pequena e REDUZ massa*. Concentrar
// a declaracao na carta maximiza (2), que e cobrado de TODOS que passam
// inclusive de quem ia para outro lugar, para economizar (3), que e o de menor
// peso e cobrado so de quem vai. Invertido.
//
// A forma correta: a carta declara a CASA e QUEM A GOVERNA (o hub); o hub
// declara o alcance do nivel dele. A cobertura passa a ser TRANSITIVA e
// continua total — nada vira orfa enquanto a corrente estiver completa —, e
// cada sessao paga apenas a declaracao das casas em que entra.
//
// Efeito colateral bom: aparece uma classe de defeito que a versao anterior nao
// tinha como detectar — CASA DECLARADA CUJO HUB NAO DECLARA ALCANCE. O nivel
// abaixo fica sem cobertura e o defeito e silencioso, porque a carta parece
// completa. E o pior tipo pela §7: produz resposta errada, nao so cara.
//
// FORMA DA DECLARACAO: tabela markdown numa secao `## Alcance`, no corpo.
// Nao frontmatter: array de objeto em YAML nao e editavel na view de Properties
// do Obsidian, e estes vaults sao operados no Obsidian — forma do produto que
// atrita com a ferramenta em que o produto vive e defeito de dogfooding.
// Tabela e o idioma que carta e hub ja usam, e o mecanismo faz o strip da secao
// na injecao: quem abre o arquivo nao paga a declaracao.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';
import { extrairFrontmatter } from './frontmatter.mjs';

export const SECAO_ALCANCE = 'alcance';
// Profundidade maxima da corrente. Tres degraus (carta -> hub -> sub-hub) cobre
// tudo o que se mediu em vault real; o limite existe para que hub que aponta
// para si mesmo nao rode para sempre.
export const PROFUNDIDADE_MAXIMA = 3;

const semAcento = (s) => String(s)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const limparCelula = (s) => String(s ?? '')
  .replace(/`/g, '')
  .replace(/\*\*/g, '')
  .replace(/^\[\[|\]\]$/g, '')
  .trim();

const vazia = (s) => {
  const v = limparCelula(s);
  return v === '' || v === '—' || v === '-' || v === '–' || semAcento(v) === 'n/a';
};

function readIfExists(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
    }
  } catch { /* ignore */ }
  return null;
}

// ---------------------------------------------------------------------------
// recortarSecao — devolve { corpo, secao } separando uma secao H2/H3 do resto.
// Usada duas vezes: para LER a declaracao e para REMOVE-LA da injecao.
// ---------------------------------------------------------------------------
export function recortarSecao(md, tituloNormalizado) {
  const linhas = String(md ?? '').split(/\r?\n/);
  const fora = [];
  const dentro = [];
  let nivel = 0;
  for (const l of linhas) {
    const h = l.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (h) {
      const t = semAcento(h[2].replace(/[#*`>]/g, ''));
      if (!nivel && t.startsWith(tituloNormalizado)) { nivel = h[1].length; continue; }
      if (nivel && h[1].length <= nivel) nivel = 0;
    }
    (nivel ? dentro : fora).push(l);
  }
  return { corpo: fora.join('\n'), secao: dentro.join('\n') };
}

// ---------------------------------------------------------------------------
// parseTabelaAlcance — le a tabela da secao `## Alcance`.
//
// Colunas reconhecidas por CABECALHO (a ordem nao importa, e colunas extras de
// comentario sao ignoradas — a tabela e para humano tambem):
//   casa | padrao | grau | filtros | hub
//
// Linha com `hub` preenchido e sem `padrao` = casa DELEGADA: o alcance daquele
// nivel esta no hub, e e ele que responde por ele.
// ---------------------------------------------------------------------------
export function parseTabelaAlcance(secaoMd) {
  const linhas = String(secaoMd ?? '').split(/\r?\n/).map((l) => l.trim());
  const decls = [];
  const ignoradas = [];
  let cols = null;

  for (const l of linhas) {
    if (!l.startsWith('|')) { cols = null; continue; }
    const celulas = l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (/^[:\-\s|]+$/.test(l.replace(/\|/g, ''))) continue; // separador

    if (!cols) {
      cols = celulas.map((c) => semAcento(c));
      // Uma linha de tabela separada do proprio cabecalho (por um blockquote,
      // uma linha em branco, um paragrafo) e lida como cabecalho NOVO e a
      // declaracao dela e perdida. Aconteceu de verdade em 02/09: a linha de
      // `squads/{squad}` na carta de processo `sdd` ficou depois de uma nota e
      // as 10 declaracoes viraram 9 — em silencio, e so apareceu porque alguem
      // foi contar. Declaracao engolida sem aviso e a mesma classe de defeito
      // que este modulo existe para combater, um andar acima. Heuristica: um
      // "cabecalho" cuja primeira celula parece caminho ou padrao de arquivo
      // nao e cabecalho, e um cabecalho legitimo comeca por 'casa'/'nivel'.
      const primeira = cols[0] || '';
      const pareceDeclaracao = /[\/{}]|\.md$/.test(limparCelula(celulas[0] || ''));
      const pareceCabecalho = ['casa', 'nivel', 'caminho'].some((n) => primeira.startsWith(n));
      if (pareceDeclaracao && !pareceCabecalho) {
        ignoradas.push(celulas.join(' | '));
        cols = null;
      }
      continue;
    }
    const get = (...nomes) => {
      for (const n of nomes) {
        const i = cols.findIndex((c) => c === n || c.startsWith(n));
        if (i >= 0 && celulas[i] !== undefined) return celulas[i];
      }
      return '';
    };
    const casaBruta = get('casa', 'nivel', 'caminho');
    // A RAIZ do vault e declarada como `.` ou `/` — explicito, nunca celula
    // vazia. Celula vazia e ambigua entre "raiz" e "esqueci de preencher", e o
    // mecanismo que adivinha nesse ponto engole declaracao incompleta em
    // silencio: foi o defeito medido na primeira execucao real (4 arquivos da
    // raiz reportados como orfaos porque a linha que os cobria foi descartada).
    const casaLimpa = limparCelula(casaBruta);
    const ehRaiz = casaLimpa === '.' || casaLimpa === '/' || casaLimpa === './';
    const casa = ehRaiz ? '' : (vazia(casaBruta) ? null : casaLimpa);
    // Linha sem casa e sem hub nao declara nada — ignorar em vez de inventar.
    const hub = vazia(get('hub', 'governada por', 'governado por', 'indice')) ? null : limparCelula(get('hub', 'governada por', 'governado por', 'indice'));
    if (casa === null && !hub) continue;

    const padrao = vazia(get('padrao', 'padrão', 'nomenclatura')) ? null : limparCelula(get('padrao', 'padrão', 'nomenclatura'));
    const grau = vazia(get('grau')) ? null : semAcento(get('grau'));
    const filtrosBruto = get('filtros', 'frontmatter', 'recorte');
    const filtros = vazia(filtrosBruto) ? [] : limparCelula(filtrosBruto).split(/[,;·]/).map((x) => x.trim()).filter(Boolean);

    decls.push({ casa: casa ?? '', padrao, grau, filtros, hub });
  }
  if (ignoradas.length) decls.ignoradas = ignoradas;
  return decls;
}

// ---------------------------------------------------------------------------
// lerDeclaracoes — de UM arquivo (carta, carta de processo ou hub).
// Aceita as duas formas por compatibilidade: a tabela `## Alcance` (canonica) e
// o `alcance:` do frontmatter (forma da v0.5.0, mantida para nao quebrar vault
// que ja migrou — mas nao e mais a recomendada, e a razao esta no topo).
// ---------------------------------------------------------------------------
export function lerDeclaracoes(md) {
  const { corpo } = extrairFrontmatter(md);
  const { secao } = recortarSecao(corpo, SECAO_ALCANCE);
  const daTabela = parseTabelaAlcance(secao);
  if (daTabela.length) return { decls: daTabela, forma: 'tabela', ignoradas: daTabela.ignoradas || [] };

  // Sem tabela: quem chama decide se cai no `alcance:` do frontmatter (forma
  // legada da v0.5.0, mantida para nao quebrar vault que ja migrou).
  return { decls: [], forma: 'ausente', ignoradas: daTabela.ignoradas || [] };
}

// ---------------------------------------------------------------------------
// corpoSemAlcance — o que vai ao contexto do agente. A declaracao e para o
// mecanismo; cobra-la de quem le a carta ou o hub puniria exatamente quem
// declara bem (incentivo invertido — o mesmo motivo do strip do frontmatter).
// ---------------------------------------------------------------------------
export function corpoSemAlcance(md) {
  const { corpo } = extrairFrontmatter(md);
  return recortarSecao(corpo, SECAO_ALCANCE).corpo.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
}

// Resolve o caminho de um hub declarado, que pode vir com placeholder
// (`projetos/{projeto}/{projeto}.md` na carta de PROCESSO) ou concreto
// (`projetos/Connect/adr/adr-connect.md` num hub local).
function expandirHub(vaultRoot, hubDeclarado, casaResolvida) {
  const bruto = String(hubDeclarado).replace(/\\/g, '/').replace(/^\.?\//, '');
  const candidatos = [];

  if (!/[{}*]/.test(bruto)) {
    candidatos.push(bruto);
    // Hub declarado relativo a casa (ex.: `adr-connect.md` dentro de `adr/`).
    if (!bruto.includes('/') && casaResolvida) candidatos.push(`${casaResolvida}/${bruto}`);
  } else {
    // Com placeholder: substituir pelos segmentos reais da casa ja resolvida.
    // Substitui APENAS o `{...}` dentro do segmento, preservando o resto —
    // `{produto}.md` com a casa `produtos/Auto-Demais` tem de virar
    // `Auto-Demais.md`, nao `Auto-Demais`. Trocar o segmento inteiro perdia a
    // extensao e transformava hub em diretorio, e o mecanismo reportava
    // hub-ausente num vault que tinha o hub no lugar certo.
    const segCasa = (casaResolvida || '').split('/').filter(Boolean);
    const segHub = bruto.split('/');
    const ultimoDaCasa = segCasa[segCasa.length - 1] || '';
    const concreto = segHub.map((seg, i) => {
      if (!/\{[^}]*\}/.test(seg)) return seg;
      const substituto = segCasa[i] !== undefined && i < segHub.length - 1 ? segCasa[i] : ultimoDaCasa;
      return seg.replace(/\{[^}]*\}/g, substituto);
    });
    candidatos.push(concreto.join('/'));
    // Forma IRMA: o hub mora ao lado da pasta, nao dentro dela
    // (`produtos/Auto-Demais.md` + `produtos/Auto-Demais/`). Medido no acervo
    // de cliente maduro — as duas convivem, e recusar uma seria o produto
    // decidindo a forma do coletivo.
    if (concreto.length > 1) candidatos.push([...concreto.slice(0, -2), concreto[concreto.length - 1]].join('/'));
  }

  for (const c of candidatos) {
    const abs = path.join(vaultRoot, c);
    try { if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return { rel: c, abs }; } catch { /* ignore */ }
  }
  return { rel: candidatos[0] || bruto, abs: null };
}

// ---------------------------------------------------------------------------
// resolverCorrente — monta o alcance EFETIVO percorrendo a corrente.
//
// Ordem (e ela importa, porque e a precondicao dura da M1): as declaracoes
// HERDADAS da carta de processo entram primeiro, depois o delta da carta local,
// depois o que cada hub declara sobre a propria casa.
//
// `casasResolvidas` traduz a casa declarada com placeholder nas instancias reais
// do disco (`projetos/{projeto}` -> `projetos/Connect`), porque e a instancia que
// tem hub, nao o padrao.
//
// Devolve { decls, delegacoes, defeitos } — `defeitos` e a classe nova:
// casa delegada cujo hub nao existe, ou existe e nao declara alcance.
// ---------------------------------------------------------------------------
export function resolverCorrente({
  vaultRoot,
  declaracoesIniciais = [],
  instanciasDaCasa = () => [],
  profundidade = PROFUNDIDADE_MAXIMA,
} = {}) {
  const decls = [];
  const delegacoes = [];
  const defeitos = [];
  const visitados = new Set();

  const processar = (lista, origem, nivel) => {
    for (const d of lista) {
      // DELEGACAO e a linha com hub e SEM padrao: "o alcance deste nivel esta
      // la". Linha com hub E padrao e outra coisa — o nivel ja tem padrao (logo
      // e alcancavel por construcao) e ainda mantem um indice autorado, que e a
      // classe de defeito da IMP-001. Ela entra como folha, e a M2 reporta.
      if (!d.hub || d.padrao) { decls.push({ ...d, origem }); continue; }

      // Casa delegada: o alcance mora no hub. A casa em si continua declarada
      // (o hub e um arquivo dentro dela, e ele proprio precisa de cobertura).
      const instancias = d.casa && /[{}*]/.test(d.casa) ? instanciasDaCasa(d.casa) : (d.casa !== undefined ? [d.casa] : []);
      if (!instancias.length) {
        // Casa sem instancia no disco: nada a cobrir, nada a delegar. NAO e
        // defeito — vault recem-nascido nao tem projeto, e ausencia e gatilho
        // de nascimento, nao erro.
        delegacoes.push({ casa: d.casa, hub: d.hub, instancias: [], status: 'sem-instancia' });
        continue;
      }

      for (const casaReal of instancias) {
        const { rel, abs } = expandirHub(vaultRoot, d.hub, casaReal);
        // O proprio hub e coberto por construcao: ele e o ponteiro declarado.
        decls.push({ casa: casaReal, padrao: rel.split('/').pop(), grau: 'derivavel', filtros: [], origem: `${origem} (hub)` });

        if (!abs) {
          defeitos.push(`casa \`${casaReal}\` declara o hub \`${rel}\` e ele NAO existe — a corrente de alcance quebra aqui, e o nivel abaixo fica sem cobertura`);
          delegacoes.push({ casa: casaReal, hub: rel, status: 'hub-ausente' });
          continue;
        }
        if (visitados.has(abs) || nivel >= profundidade) {
          delegacoes.push({ casa: casaReal, hub: rel, status: nivel >= profundidade ? 'profundidade-excedida' : 'ja-visitado' });
          continue;
        }
        visitados.add(abs);

        const md = readIfExists(abs);
        const { decls: doHub, ignoradas: ignHub } = lerDeclaracoes(md);
        for (const ig of ignHub || []) {
          defeitos.push(`o hub \`${rel}\` tem uma linha de alcance FORA da tabela (\`${ig}\`) — separada do proprio cabecalho, ela e lida como cabecalho novo e a declaracao e perdida. O nivel que ela cobria fica sem cobertura`);
        }
        if (!doHub.length) {
          // Hub sem `## Alcance` NAO e defeito, e a razao e medida: exigir a
          // secao de todo hub obrigaria as 17 notas de projeto de um acervo de
          // cliente a repetir a MESMA declaracao (`adr/`, `backlog/`, `rnf/`) —
          // 17 copias do que e forma do processo, que e a violacao de
          // *deltas, nao copias* um andar abaixo.
          //
          // O corte que se sustenta: declara no PROCESSO o que e forma dele e
          // identico em toda instancia; delega ao HUB o que e do vault e
          // ilimitado. O hub declara so o DELTA da casa dele, e nao ter delta e
          // o caso normal.
          //
          // Quem cobra o resultado e a M1: se a corrente nao cobriu algum
          // arquivo, ele aparece nomeado como orfa. Reportar a FORMA (secao
          // ausente) em vez da CONSEQUENCIA (arquivo inalcancavel) produziria
          // 25 defeitos onde nao ha nenhum.
          delegacoes.push({ casa: casaReal, hub: rel, status: 'sem-delta' });
          continue;
        }
        delegacoes.push({ casa: casaReal, hub: rel, status: 'ok', declaracoes: doHub.length });
        // As casas declaradas pelo hub sao relativas ao VAULT quando comecam
        // pela propria casa; senao, relativas a casa dele.
        const normalizadas = doHub.map((h) => ({
          ...h,
          casa: h.casa && h.casa.startsWith(casaReal) ? h.casa : path.posix.join(casaReal, h.casa || ''),
        }));
        processar(normalizadas, `hub ${rel}`, nivel + 1);
      }
    }
  };

  processar(declaracoesIniciais, 'raiz', 0);
  return { decls, delegacoes, defeitos };
}
