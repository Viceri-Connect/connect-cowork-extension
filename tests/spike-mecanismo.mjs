#!/usr/bin/env node
// tests/spike-mecanismo.mjs
// Prova o mecanismo do iniciarSessao() de ponta a ponta, sem Cowork:
//   - cria uma matriz e um cerebro pessoal falsos (com a mesma forma real)
//   - roda iniciarSessao() apontando para eles
//   - verifica: scaffold criado fora da origem, atalhos montados, LEITURA
//     ATRAVES do atalho (premissa 2 no equivalente POSIX), identidade e L1.
//
// Em Linux os atalhos sao symlinks; em Windows, junctions NTFS. A logica e a
// mesma — este teste roda no sandbox (Linux) como rede de seguranca do nucleo.
// A prova especifica de junction NTFS + leitura pelo Cowork e o spike no host.

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarSessao } from '../plugins/connect/lib/session.mjs';
import { renderContexto } from '../plugins/connect/lib/render.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-spike-'));
const home = path.join(tmp, 'connect-home');          // {CONNECT_HOME} (fora do "OneDrive")
const matriz = path.join(tmp, 'onedrive', 'viceri-vault');
const pessoal = path.join(tmp, 'onedrive', 'second brain');

// --- monta uma matriz falsa com a forma real ---
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.mkdirSync(path.join(matriz, '_inteligencia'), { recursive: true });
fs.mkdirSync(path.join(matriz, 'projetos', 'Connect'), { recursive: true });
fs.mkdirSync(path.join(matriz, 'organizacao'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'vault-config.md'), [
  '# Config do Vault — Viceri (interno)',
  '## Identidade',
  '- empresa: "Viceri Seidor"',
  '- cliente: "Viceri (interno)"',
  '- contexto: "interno-viceri"',
  '## Ponto Focal',
  '- vault-focal-nome: "Gabriel Vasconcelos Guilhem"',
  '- vault-focal-email: "gabriel.guilhem@viceri.com.br"',
].join('\n'));
fs.writeFileSync(path.join(matriz, '_cerebro', 'modelo-roteamento.md'), '# roteamento\n');
fs.writeFileSync(path.join(matriz, '_inteligencia', 'convencao-skills.md'), '# skills\n');

// carta de navegacao da matriz falsa — a camada 1 DECLARADA pelo vault (0.12.0).
// Deliberadamente SEM a secao "Fronteiras": o spike verifica que o mecanismo
// acusa secao obrigatoria faltante em vez de aceitar carta pela metade.
fs.writeFileSync(path.join(matriz, '_cerebro', 'camada-1.md'), [
  '---',
  'tipo-artefato: camada-1',
  'vault: Matriz de teste',
  '---',
  '',
  '# Camada 1 — Matriz de teste',
  '',
  '## O que e este vault',
  'Matriz da instancia de teste.',
  '',
  '## Estrutura',
  '- `projetos/` — uma nota por projeto',
  '',
  '## Ordem de entrada',
  '1. `_cerebro/modelo-roteamento.md`',
  '',
  '## Quando carregar',
  '| Gatilho | Arquivo |',
  '|---|---|',
  '| roteamento de nota | `_cerebro/modelo-roteamento.md` |',
].join('\n'));

// --- cerebro pessoal falso ---
fs.mkdirSync(path.join(pessoal, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(pessoal, '_cerebro', 'meu-config.md'), [
  '# Minha Config — Gabriel',
  '## Identidade (cross-cliente)',
  '- nome: "Gabriel Vasconcelos Guilhem"',
  '- emails: "gabriel.guilhem@viceri.com.br"',
  '- papeis-estaveis: ["Tech Lead", "Arquiteto"]',
].join('\n'));

// --- roda o bootstrap ---
const r = iniciarSessao({
  sessionId: 'janela-A:123',       // com caractere invalido de proposito
  home,
  vaultMatriz: matriz,
  cerebroPessoal: pessoal,
});

let falhas = 0;
const check = (nome, cond) => {
  if (cond) { console.log(`  ok  ${nome}`); }
  else { console.error(`  XX  ${nome}`); falhas++; }
};

console.log('\n[spike] verificacoes:');

// 1. scaffold criado dentro do CONNECT_HOME, fora da origem
check('scaffold criado', fs.existsSync(r.workspace));
check('scaffold fica sob CONNECT_HOME (fora do OneDrive)', r.workspace.startsWith(home));
check('session_id sanitizado', r.sessionId === 'janela-A-123');

// 2. atalhos montados
const aliases = Object.fromEntries((r.mounts || []).map((m) => [m.alias, m]));
check('matriz montada', aliases.matriz && (aliases.matriz.status === 'mounted' || aliases.matriz.status === 'exists'));
check('pessoal montado', aliases.pessoal && (aliases.pessoal.status === 'mounted' || aliases.pessoal.status === 'exists'));

// 3. LEITURA ATRAVES do atalho (equivalente POSIX da premissa 2)
const viaAtalho = path.join(r.workspace, 'matriz', '_cerebro', 'vault-config.md');
check('le arquivo da matriz ATRAVES do atalho', fs.existsSync(viaAtalho));
const conteudo = fs.existsSync(viaAtalho) ? fs.readFileSync(viaAtalho, 'utf8') : '';
check('conteudo lido pelo atalho confere', conteudo.includes('Viceri Seidor'));

// 4. identidade restaurada
check('identidade: nome', r.identidade && r.identidade.nome === 'Gabriel Vasconcelos Guilhem');
check('identidade: email', r.identidade && r.identidade.email === 'gabriel.guilhem@viceri.com.br');
check('identidade: papeis', r.identidade && r.identidade.papeis.join(',') === 'Tech Lead,Arquiteto');

// 5. L1 da matriz — identidade do vault + carta de navegacao DECLARADA pelo vault
// (0.12.0: o produto nao emite mais ponteiros presumidos; ver spike-navegacao)
check('L1: empresa', r.l1 && r.l1.identidadeVault.empresa === 'Viceri Seidor');
check('L1: nao prescreve ponteiros', r.l1 && !('ponteiros' in r.l1));
check('L1: carta declarada pelo vault e lida', r.l1 && r.l1.carta && r.l1.carta.presente === true);
check('L1: carta injetada verbatim no bloco', renderContexto(r).includes('## Quando carregar'));
check('L1: lacuna de secao obrigatoria acusada', r.l1 && r.l1.carta.validacao && r.l1.carta.validacao.faltando.includes('fronteiras'));

// 6. origem intacta (nada apagado)
check('origem da matriz intacta', fs.existsSync(path.join(matriz, '_cerebro', 'vault-config.md')));

// 7. idempotencia: rodar de novo nao quebra (replace)
const r2 = iniciarSessao({ sessionId: 'janela-A:123', home, vaultMatriz: matriz, cerebroPessoal: pessoal });
check('idempotente (2a chamada ok)', r2.mounts.every((m) => m.status === 'mounted' || m.status === 'exists'));

// limpeza
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }

console.log(`\n[spike] ${falhas === 0 ? 'TODAS PASSARAM' : falhas + ' FALHA(S)'}\n`);
process.exit(falhas === 0 ? 0 : 1);
