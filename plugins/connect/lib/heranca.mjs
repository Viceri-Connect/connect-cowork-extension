// connect/lib/heranca.mjs
// Heranca de processo — o mecanismo da §9 do contrato de navegacao.
//
// O problema que fecha (medido em 01/09, quatro vaults reais): a carta local
// reescrevia, uma vez por vault, o que nao era dela. Das 15 linhas de gatilho da
// carta de uma tribo, 2 eram delta local; das 31 de um cliente maduro, 16 eram
// derivadas. Uma sessao de quatro vaults pagava 39.355 B / ~9.837 tokens so de
// cartas, e o piso escalava LINEARMENTE com o numero de vaults tocados.
//
// A regra (contrato §9.3): o vault declara `processo:` no frontmatter da propria
// `_cerebro/camada-1.md` e HERDA a carta daquele processo. O mecanismo injeta a
// carta de processo UMA VEZ POR SESSAO — nao uma vez por vault. N vaults do mesmo
// processo passam a pagar uma carta de processo + N deltas pequenos.
//
// Duas regras que este modulo nao negocia:
//   - Ausencia de `processo:` NAO e lacuna (contrato §9.3). Vault que nao declara
//     processo nao herda nada, a carta local carrega tudo, e o mecanismo degrada
//     para o comportamento anterior a v0.5.0 sem quebrar. Zero aviso.
//   - `processo:` declarado SEM carta de processo correspondente E lacuna, e e
//     ruidosa de proposito: e exatamente o modo de falha que a §7 classifica como
//     o pior (quebra em silencio), porque o vault podado nao tem de onde herdar
//     o que foi removido dele.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, extrairFrontmatter, estimarTokens } from './frontmatter.mjs';
import { lerDeclaracoes, corpoSemAlcance } from './alcance.mjs';

// Casa canonica da carta de processo, relativa a raiz do vault que GOVERNA o
// processo (a matriz, no caso do dois-cerebros desta instancia). O nome do
// arquivo e o proprio valor de `processo:` — derivavel, nunca catalogado.
export const DIR_PROCESSOS = path.join('_cerebro', 'processos');

// Registro por sessao — mora no workspace da sessao (nunca em vault, nunca em
// memoria do processo MCP). Arquivo em vez de variavel de modulo por dois
// motivos medidos: o servidor MCP e longo-vivo e atende varias sessoes (variavel
// de modulo vazaria de uma para outra), e ele pode reiniciar no meio de uma
// sessao (variavel perderia o registro e a carta seria injetada de novo).
const ARQUIVO_REGISTRO = path.join('.connect', 'heranca.json');

const slug = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '');

function readIfExists(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
    }
  } catch { /* ignore */ }
  return null;
}

export function caminhoCartaProcesso(processo) {
  return path.join(DIR_PROCESSOS, `${slug(processo)}.md`);
}

// ---------------------------------------------------------------------------
// lerCartaProcesso — le a carta do processo `processo` no vault que o governa.
// Nunca lanca. Retorna sempre objeto com `presente` explicito.
//
// `estruturaMinima` vem do frontmatter (`estrutura-minima:`) e e o insumo da M7:
// a estrutura que a carta de processo PRESSUPOE existir em todo vault que a
// herda. Sem ela declarada, a M7 nao tem contra o que verificar — e o proprio
// contrato diz isso (§9.4, nota final).
// ---------------------------------------------------------------------------
export function lerCartaProcesso(governanteRoot, processo, aliasGovernante = 'matriz') {
  const vazio = {
    presente: false,
    processo: processo || null,
    caminho: null,
    caminhoRelativo: null,
    inline: null,
    corpo: null,
    frontmatter: {},
    topologias: [],
    alcance: [],
    tokens: 0,
    avisos: [],
  };
  if (!processo) return vazio;
  if (!governanteRoot || !fs.existsSync(governanteRoot)) {
    return {
      ...vazio,
      avisos: [`processo "${processo}" declarado, mas o vault que governa os processos nao esta acessivel — heranca nao resolvida (contrato-navegacao.md §9.3)`],
    };
  }

  const rel = caminhoCartaProcesso(processo);
  const abs = path.join(governanteRoot, rel);
  const md = readIfExists(abs);

  if (!md) {
    return {
      ...vazio,
      avisos: [`LACUNA DE HERANCA: o vault declara \`processo: ${processo}\` e a carta de processo nao existe em ./${aliasGovernante}/${rel.replace(/\\/g, '/')} — o que foi podado da carta local nao tem de onde ser herdado. Ofereca a \`cnct-fabrica-navegacao\` (modo processo) ao operador; nao supra por varredura (contrato-navegacao.md §9.3)`],
    };
  }

  const fm = parseFrontmatter(md);
  const asLista = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

  return {
    presente: true,
    processo,
    caminho: abs,
    caminhoRelativo: `./${aliasGovernante}/${rel.replace(/\\/g, '/')}`,
    inline: md.replace(/\s+$/, ''),
    // So o corpo vai ao contexto: `estrutura-minima`/`alcance` sao para o mecanismo.
    corpo: corpoSemAlcance(md),
    frontmatter: fm,
    // TOPOLOGIA, nao estrutura-minima (correcao de 02/09). Ver o comentario no
    // topo deste arquivo: exigir EXISTENCIA de pasta reprovava todo vault
    // recem-nascido, porque vault sem projeto nao tem casa de ADR, de backlog
    // nem de RNF — e essas casas nascem quando o projeto passa pelos
    // refinamentos, nao no provisionamento. O que a heranca precisa verificar e
    // a FORMA do caminho: gatilho herdado que aponta para uma forma que aquele
    // vault nunca usa nasce morto com projeto ou sem.
    topologias: asLista(fm.topologia ?? fm.topologias).map(String),
    alcance: lerDeclaracoes(md).decls,
    tokens: estimarTokens(corpoSemAlcance(md)),
    avisos: [],
  };
}

// ---------------------------------------------------------------------------
// Registro de injecao por sessao — leitura e marcacao.
// Degrada em silencio quando nao ha workspace (chamada fora de sessao, teste):
// sem registro, a carta e injetada, que e o lado seguro do erro.
// ---------------------------------------------------------------------------
export function lerRegistro(workspaceDir) {
  if (!workspaceDir) return { processos: [], persistente: false };
  const p = path.join(workspaceDir, ARQUIVO_REGISTRO);
  const bruto = readIfExists(p);
  if (!bruto) return { processos: [], persistente: true };
  try {
    const j = JSON.parse(bruto);
    return { processos: Array.isArray(j.processos) ? j.processos.map(String) : [], persistente: true };
  } catch {
    // Registro corrompido nao pode fazer a sessao cair nem esconder a carta:
    // trata como vazio (injeta) e segue.
    return { processos: [], persistente: true };
  }
}

export function marcarInjetado(workspaceDir, processo) {
  if (!workspaceDir || !processo) return false;
  try {
    const dir = path.join(workspaceDir, path.dirname(ARQUIVO_REGISTRO));
    fs.mkdirSync(dir, { recursive: true });
    const atual = lerRegistro(workspaceDir);
    const chave = slug(processo);
    if (atual.processos.includes(chave)) return true;
    const proximo = { processos: [...atual.processos, chave] };
    const p = path.join(workspaceDir, ARQUIVO_REGISTRO);
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(proximo, null, 2), 'utf8');
    fs.renameSync(tmp, p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// resolverHeranca — o ponto de entrada. Recebe a carta local ja lida (para nao
// ler o arquivo duas vezes) e devolve o que o render precisa saber.
//
// status:
//   'sem-processo'  — nao declarou. Nao e lacuna, zero aviso (contrato §9.3).
//   'injetada'      — primeira vez nesta sessao: `inline` vai verbatim.
//   'ja-injetada'   — outro vault da mesma sessao ja pagou: so o ponteiro.
//   'ausente'       — declarou e a carta nao existe: LACUNA, aviso ruidoso.
// ---------------------------------------------------------------------------
export function resolverHeranca({
  carta,
  governanteRoot,
  aliasGovernante = 'matriz',
  workspaceDir = null,
} = {}) {
  const processo = carta?.processo || null;

  if (!processo) {
    return {
      status: 'sem-processo',
      processo: null,
      cartaProcesso: null,
      avisos: [],
    };
  }

  const cp = lerCartaProcesso(governanteRoot, processo, aliasGovernante);
  if (!cp.presente) {
    return { status: 'ausente', processo, cartaProcesso: cp, avisos: cp.avisos };
  }

  const registro = lerRegistro(workspaceDir);
  const ja = registro.processos.includes(slug(processo));
  if (ja) {
    return { status: 'ja-injetada', processo, cartaProcesso: cp, avisos: [] };
  }

  marcarInjetado(workspaceDir, processo);
  return { status: 'injetada', processo, cartaProcesso: cp, avisos: [] };
}
