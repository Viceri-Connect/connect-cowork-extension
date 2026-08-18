#!/usr/bin/env node
// tests/spike-repos.mjs
// Spike do primitivo de REPOSITORIO DE CODIGO (P64) — 0.12.0.
//
// Premissas que este spike mata:
//   1. Repo desconhecido devolve 'local-nao-configurado' (a skill PERGUNTA) —
//      nunca varredura de disco, nunca advinhacao.
//   2. Path local mora so em connect.config.json (tabela `repos`), por-maquina (D35).
//   3. Path invalido nao entra na tabela (o modo de falha comum e OneDrive cloud-only).
//   4. Repo sem `.git` resolve com status proprio ('sem-git'), nao com sucesso mudo.
//   5. Repo registrado e depois movido devolve 'origem-ausente' (nao tenta outro path).
//   6. A tabela local nunca vaza para vault nenhum: o unico arquivo tocado e o config.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolverRepo, registrarRepoLocal, listarRepos } from '../plugins/connect/lib/repos.mjs';

let passou = 0, falhou = 0;
const ok = (cond, nome) => {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome}`); }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-repos-'));
const home = path.join(tmp, 'connect-home');
const repoOk = path.join(tmp, 'repos', 'connect-site');
const repoSemGit = path.join(tmp, 'repos', 'pasta-qualquer');
fs.mkdirSync(path.join(repoOk, '.git'), { recursive: true });
fs.mkdirSync(repoSemGit, { recursive: true });

console.log(`\nspike-repos — sandbox: ${tmp}\n`);

// 1. desconhecido -> pergunta, nunca procura
const r1 = resolverRepo({ home, conceito: 'connect-site' });
ok(r1.status === 'local-nao-configurado', 'repo desconhecido: local-nao-configurado');
ok(/pergunte|Nunca procure/i.test(r1.avisos.join(' ')), 'aviso manda perguntar, e proibe procurar');

// 2. grava e resolve
const g = registrarRepoLocal({ home, conceito: 'connect-site', caminho: repoOk });
ok(g.status === 'gravado', 'registra o path local');
const cfg = JSON.parse(fs.readFileSync(path.join(home, 'connect.config.json'), 'utf8'));
ok(cfg.repos && cfg.repos['connect-site'] === repoOk, 'path mora na tabela `repos` do config (D35)');
const r2 = resolverRepo({ home, conceito: 'connect-site' });
ok(r2.status === 'resolvido' && r2.caminho === repoOk, 'resolve o repo registrado');
ok(!('mount' in r2), 'repo NAO e montado como junction (codigo tem caminho canonico proprio)');

// casamento por substring (nome curto do dia a dia)
ok(resolverRepo({ home, conceito: 'site' }).status === 'resolvido', 'casa por substring do nome');

// 2b. AMBIGUIDADE E RECUSADA (bloqueador achado na revisao 0.12.0)
// repo e superficie de ESCRITA: resolver pro repo errado faz o agente commitar
// no lugar errado. O casamento bidirecional antigo devolvia 'resolvido' para um
// nome nao registrado.
const repoWeb = path.join(tmp, 'repos', 'connect-web');
const repoWebApi = path.join(tmp, 'repos', 'connect-web-api');
fs.mkdirSync(path.join(repoWeb, '.git'), { recursive: true });
fs.mkdirSync(path.join(repoWebApi, '.git'), { recursive: true });
registrarRepoLocal({ home, conceito: 'connect-web', caminho: repoWeb });
registrarRepoLocal({ home, conceito: 'connect-web-api', caminho: repoWebApi });
const amb = resolverRepo({ home, conceito: 'connect-web' });
ok(amb.status === 'resolvido' && amb.caminho === repoWeb, 'nome exato vence a ambiguidade');
const amb2 = resolverRepo({ home, conceito: 'web' });
ok(amb2.status === 'ambigua' && amb2.candidatos.length === 2, 'termo que casa 2 repos devolve ambigua (nunca escolhe)');
const naoReg = resolverRepo({ home, conceito: 'connect-web-frontend' });
ok(naoReg.status === 'local-nao-configurado', 'nome NAO registrado nao resolve pro repo de nome parecido');
ok(resolverRepo({ home, conceito: 'we' }).status === 'local-nao-configurado', 'termo com menos de 3 letras nao dispara fuzzy');

// 3. path invalido nao entra
const gi = registrarRepoLocal({ home, conceito: 'fantasma', caminho: path.join(tmp, 'nao-existe') });
ok(gi.status === 'invalido', 'path inexistente e recusado');
ok(/OneDrive/.test(gi.motivo), 'motivo nomeia a causa real mais comum (cloud-only)');
const cfg2 = JSON.parse(fs.readFileSync(path.join(home, 'connect.config.json'), 'utf8'));
ok(!('fantasma' in (cfg2.repos || {})), 'repo invalido nao suja a tabela');

// 4. sem .git
registrarRepoLocal({ home, conceito: 'pasta-qualquer', caminho: repoSemGit });
const r3 = resolverRepo({ home, conceito: 'pasta-qualquer' });
ok(r3.status === 'sem-git', 'diretorio sem .git tem status proprio');

// 5. registrado e movido
fs.rmSync(repoOk, { recursive: true, force: true });
const r4 = resolverRepo({ home, conceito: 'connect-site' });
ok(r4.status === 'origem-ausente', 'repo movido/apagado: origem-ausente (sem tentar outro path)');

// 6. superficie tocada
const listagem = listarRepos({ home });
ok(listagem.repos.length === 4, 'listar_repos devolve a tabela inteira');
ok(listagem.repos.every((r) => 'existe' in r && 'git' in r), 'listagem diz existe/git por repo');
const tocados = fs.readdirSync(home);
ok(tocados.length === 1 && tocados[0] === 'connect.config.json', 'unico arquivo tocado e o config local');

// 7. config ilegivel nunca e sobrescrita (perda silenciosa de configuracao)
fs.writeFileSync(path.join(home, 'connect.config.json'), '{ isso nao e json', 'utf8');
const ileg = registrarRepoLocal({ home, conceito: 'x', caminho: repoWebApi });
ok(ileg.status === 'config-ilegivel', 'config corrompida devolve config-ilegivel');
ok(fs.readFileSync(path.join(home, 'connect.config.json'), 'utf8').includes('isso nao e json'),
  'config corrompida NAO e sobrescrita (nao apaga matriz/subVaults do operador)');

console.log(`\n${passou} ok, ${falhou} falha(s)\n`);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
process.exit(falhou ? 1 : 0);
