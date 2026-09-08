// connect/lib/repos.mjs
// resolverRepo(conceito) — o analogo do `resolver` para REPOSITORIO DE CODIGO (P64).
//
// Por que existe: a espinha promete "ao mencionar ou investigar codigo, resolver o
// repositorio e conecta-lo direto — sem perguntar o caminho ao operador nem pedir
// reconexao a toa". Sem primitivo, essa promessa era cumprida por `grep` no vault
// pessoal (`_cerebro/clientes/{slug}/repos.md`) — path de maquina escrito dentro de
// conteudo coletivo, exatamente o que D35 proibe, e um contorno que virou atrito
// recorrente de dogfooding (D108).
//
// Modelo (o mesmo do sub-vault, deliberadamente — um so conceito de "onde isso mora
// nesta maquina"):
//   - o CONHECIMENTO declara que o repo existe e como ele se chama (nota do projeto
//     no vault: nome, remoto, papel). Isso e coletivo, viaja, e verdade pra todos.
//   - o PATH LOCAL mora so em connect.config.json, tabela `repos: { conceito: caminho }`,
//     por-operador, por-maquina (D35). Nunca no vault.
//
// Diferenca em relacao ao sub-vault: repo NAO e montado como junction dentro do
// workspace da sessao. Codigo tem ferramental proprio (git, build, IDE) e caminho
// canonico na maquina; junction de repo cria duplicata de arvore de trabalho e
// confunde git/IDE. O primitivo devolve o caminho REAL para o agente pedir acesso
// direto (no Cowork) ou usar como cwd.
//
// Zero dependencias externas.

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from './session.mjs';
import { gravarChaveLocal } from './config-local.mjs';
import { lerTabela, casarPonteiro, montarChave, resumirCandidatos } from './ponteiro.mjs';

const norm = (s) => String(s || '').toLowerCase().trim();

// ---------------------------------------------------------------------------
// registrarRepoLocal — grava o path local de UM repo (por-maquina, D35).
// Chamada legitima: (a) handshake guiado, depois de `resolver_repo` devolver
// 'local-nao-configurado'; (b) apos um clone que o proprio agente conduziu.
//
// `coletivo` (ADR-22 item 1): quando informado, a chave nasce escopada
// (`cliente-alfa/pagamentos-api`). Sem ele a chave e legada (so o conceito) e continua
// valendo — nunca se reescreve config do operador sem que ele peca.
// ---------------------------------------------------------------------------
export function registrarRepoLocal({ home, conceito, caminho, coletivo = null, escopo = null } = {}) {
  if (!conceito) return { status: 'erro', motivo: 'conceito ausente' };
  const chave = coletivo
    ? montarChave({ coletivo, escopo: escopo ? [escopo] : [], conceito })
    : norm(conceito);
  return gravarChaveLocal({ home, tabela: 'repos', chave, caminho });
}

// ---------------------------------------------------------------------------
// resolverRepo — devolve o caminho local de um repo declarado.
//
// Status:
//   'local-nao-configurado' — esta maquina nao sabe onde o repo mora: PERGUNTAR ao
//                             operador (ou oferecer clonar) e gravar. Nunca advinhar.
//   'ambigua'               — o termo casa com mais de um repo registrado: PERGUNTAR
//                             qual. Jamais escolher por ordem da tabela (repo e
//                             superficie de escrita; errar aqui commita no lugar errado).
//   'origem-ausente'        — path registrado mas o diretorio nao existe mais
//   'sem-git'               — diretorio existe mas nao tem .git (pode ser pasta errada)
//   'resolvido'             — caminho valido; pedir acesso ao Cowork e seguir
// ---------------------------------------------------------------------------
export function resolverRepo({ conceito, coletivo = null, escopo = null, ...override } = {}) {
  const cfg = resolveConfig(override);
  const entradas = lerTabela(cfg.repos || {});
  const disponiveis = entradas.map((e) => e.chave);

  if (!conceito) return { status: 'erro', motivo: 'conceito ausente', disponiveis };

  const chave = norm(conceito);
  // Casamento: exato SEMPRE vence. Fuzzy so como prefixo/substring do NOME
  // REGISTRADO (UMA direcao), com piso de 3 caracteres, e AMBIGUIDADE E RECUSADA.
  //
  // Por que tao restrito, e por que a ADR-22 NAO afrouxou isto: repo e superficie
  // de ESCRITA (o agente vai commitar ali). O casamento bidirecional que existia
  // aqui resolvia silenciosamente pro repo errado — `resolverRepo('connect-web-api')`
  // (nao registrado) devolvia o caminho de `connect-web` com status 'resolvido'.
  // Achado na revisao da 0.12.0, e reencontrado na varredura de drift da ADR-22:
  // o item 6 dela chegou a propor bidirecional em todas as classes e foi emendado
  // no mesmo dia por causa deste bloco. Termo mais longo que a chave, em repo,
  // significa entrada AUSENTE — nao entrada parecida.
  //
  // O que a ADR-22 mudou aqui: o EIXO. Antes a tabela era plana, entao dois
  // clientes com repo homonimo colidiam por construcao; agora `coletivo` filtra
  // duro, e a recusa vem qualificada (`cliente-alfa/pagamentos-api`), nao com dois
  // nomes iguais que nao ajudam ninguem a escolher.
  const m = casarPonteiro(entradas, { termo: chave, coletivo, escopo, bidirecional: false });

  if (m.status === 'ambigua') {
    const candidatos = resumirCandidatos(m.candidatos);
    return {
      status: 'ambigua',
      conceito: chave,
      candidatos,
      coletivoUsado: m.desempatadoPor,
      avisos: [`"${chave}" casa com ${candidatos.length} repos registrados (${candidatos.join(', ')}) — pergunte ao operador qual, ou repita informando \`coletivo\`. Nunca escolher por ordem da tabela.`],
    };
  }

  if (m.status === 'nenhum') {
    return {
      status: 'local-nao-configurado',
      conceito: chave,
      disponiveis,
      avisos: [`esta maquina ainda nao sabe onde o repo "${chave}" mora — pergunte o diretorio ao operador (ou ofereca clonar) e grave com registrar_repo_local, informando \`coletivo\`. Nunca procure por conta propria.`],
    };
  }

  const { caminho, chave: hit, coletivo: colDaChave } = m.entrada;
  if (!fs.existsSync(caminho)) {
    return {
      status: 'origem-ausente',
      conceito: hit,
      coletivo: colDaChave,
      desempatadoPor: m.desempatadoPor,
      caminho,
      avisos: [`repo registrado mas o diretorio nao existe: ${caminho} — confirmar com o operador (movido? nunca clonado nesta maquina?)`],
    };
  }

  const temGit = fs.existsSync(path.join(caminho, '.git'));
  const avisos = temGit ? [] : [`${caminho} existe mas nao contem .git — confirmar se e a raiz do repo antes de usar`];
  // Desempate por parametro e sempre DECLARADO (ADR-22 item 4): heuristica silenciosa
  // e o modo de falha que esta ADR existe para extinguir.
  if (m.desempatadoPor) avisos.push(`desempatado pelo coletivo "${m.desempatadoPor}"`);

  return {
    status: temGit ? 'resolvido' : 'sem-git',
    conceito: hit,
    coletivo: colDaChave,
    caminho,
    desempatadoPor: m.desempatadoPor,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// listarRepos — a tabela local inteira (para o operador conferir/curar).
// ---------------------------------------------------------------------------
export function listarRepos({ ...override } = {}) {
  const cfg = resolveConfig(override);
  const entradas = lerTabela(cfg.repos || {});
  return {
    configPath: cfg._configPath,
    repos: entradas.map((e) => ({
      conceito: e.conceito,
      coletivo: e.coletivo,
      chave: e.chave,
      caminho: e.caminho,
      existe: fs.existsSync(e.caminho),
      git: fs.existsSync(path.join(e.caminho, '.git')),
      // Entrada sem coletivo declarado ainda funciona (shim), mas e o que
      // reabre a colisao que a ADR-22 fechou — visivel na listagem de proposito.
      legado: e.legado,
    })),
    semColetivo: entradas.filter((e) => e.legado).map((e) => e.chave),
  };
}
