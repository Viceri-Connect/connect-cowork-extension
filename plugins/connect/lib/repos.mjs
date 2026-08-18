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

const norm = (s) => String(s || '').toLowerCase().trim();

// ---------------------------------------------------------------------------
// registrarRepoLocal — grava o path local de UM repo (por-maquina, D35).
// Chamada legitima: (a) handshake guiado, depois de `resolver_repo` devolver
// 'local-nao-configurado'; (b) apos um clone que o proprio agente conduziu.
// ---------------------------------------------------------------------------
export function registrarRepoLocal({ home, conceito, caminho } = {}) {
  if (!conceito) return { status: 'erro', motivo: 'conceito ausente' };
  return gravarChaveLocal({ home, tabela: 'repos', chave: norm(conceito), caminho });
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
export function resolverRepo({ conceito, ...override } = {}) {
  const cfg = resolveConfig(override);
  const tabela = cfg.repos || {};
  const disponiveis = Object.keys(tabela);

  if (!conceito) return { status: 'erro', motivo: 'conceito ausente', disponiveis };

  const chave = norm(conceito);
  // Casamento: exato SEMPRE vence. Fuzzy so como prefixo/substring do NOME
  // REGISTRADO (uma direcao), com piso de 3 caracteres, e AMBIGUIDADE E RECUSADA.
  //
  // Por que tao restrito: repo e superficie de ESCRITA (o agente vai commitar ali).
  // O casamento bidirecional que existia aqui resolvia silenciosamente pro repo
  // errado — `resolverRepo('connect-web-api')` (nao registrado) devolvia o caminho
  // de `connect-web` com status 'resolvido'. Achado na revisao da 0.12.0: no lado
  // do conhecimento, ambiguidade devolve 'ambigua' e se recusa a escolher; no lado
  // do codigo o preco de errar e maior, entao a regra nao pode ser mais frouxa.
  let hit = disponiveis.find((k) => k === chave);
  if (!hit && chave.length >= 3) {
    const candidatos = disponiveis.filter((k) => k.includes(chave));
    if (candidatos.length > 1) {
      return {
        status: 'ambigua',
        conceito: chave,
        candidatos,
        avisos: [`"${chave}" casa com ${candidatos.length} repos registrados (${candidatos.join(', ')}) — pergunte ao operador qual, nunca escolher por ordem da tabela`],
      };
    }
    hit = candidatos[0];
  }

  if (!hit) {
    return {
      status: 'local-nao-configurado',
      conceito: chave,
      disponiveis,
      avisos: [`esta maquina ainda nao sabe onde o repo "${chave}" mora — pergunte o diretorio ao operador (ou ofereca clonar) e grave com registrar_repo_local. Nunca procure por conta propria.`],
    };
  }

  const caminho = tabela[hit];
  if (!fs.existsSync(caminho)) {
    return {
      status: 'origem-ausente',
      conceito: hit,
      caminho,
      avisos: [`repo registrado mas o diretorio nao existe: ${caminho} — confirmar com o operador (movido? nunca clonado nesta maquina?)`],
    };
  }

  const temGit = fs.existsSync(path.join(caminho, '.git'));
  return {
    status: temGit ? 'resolvido' : 'sem-git',
    conceito: hit,
    caminho,
    avisos: temGit ? [] : [`${caminho} existe mas nao contem .git — confirmar se e a raiz do repo antes de usar`],
  };
}

// ---------------------------------------------------------------------------
// listarRepos — a tabela local inteira (para o operador conferir/curar).
// ---------------------------------------------------------------------------
export function listarRepos({ ...override } = {}) {
  const cfg = resolveConfig(override);
  const tabela = cfg.repos || {};
  return {
    configPath: cfg._configPath,
    repos: Object.entries(tabela).map(([conceito, caminho]) => ({
      conceito,
      caminho,
      existe: fs.existsSync(caminho),
      git: fs.existsSync(path.join(caminho, '.git')),
    })),
  };
}
