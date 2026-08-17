// tests/spike-perfil-operador.mjs
// Prova que o perfil do operador gerido no CONNECT_HOME torna o vault pessoal
// OPCIONAL: identidade restaurada sem nenhum vault Obsidian pessoal montado.
// Decisao 2026-08-17 (perfil no CONNECT_HOME; vault pessoal = enriquecimento).
//
//   node tests/spike-perfil-operador.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarSessao } from '../plugins/connect/lib/session.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-perfil-'));
const home = path.join(base, 'home');       // CONNECT_HOME
const matriz = path.join(base, 'matriz');

// matriz minima
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'vault-config.md'), '---\nempresa: "Viceri Seidor"\n---');

// perfil do operador GERIDO PELO CONNECT (nao ha vault pessoal Obsidian)
fs.mkdirSync(path.join(home, 'operador', '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(home, 'operador', '_cerebro', 'meu-config.md'), [
  '---', 'plugin: dois-cerebros', '---', '# Minha Config',
  '- nome: "Gabriel Vasconcelos Guilhem"',
  '- emails: "gabriel.guilhem@viceri.com.br"',
  '- papeis-estaveis: [Tech Lead, Arquiteto]',
].join('\n'));

// sessao SEM cerebroPessoal
const r = iniciarSessao({ sessionId: 'sem-pessoal', home, vaultMatriz: matriz });

ok(r.identidade && r.identidade.nome === 'Gabriel Vasconcelos Guilhem', 'identidade restaurada do CONNECT_HOME (sem vault pessoal)');
ok(r.identidade && r.identidade.email === 'gabriel.guilhem@viceri.com.br', 'email do perfil gerido');
ok(r.identidade && r.identidade.papeis.join(',') === 'Tech Lead,Arquiteto', 'papeis do perfil gerido');
ok(!r.avisos.some(a => /nao provisionado|nao restaurada/.test(a)), 'sem aviso de identidade ausente');
ok(!r.mounts.some(m => m.alias === 'pessoal'), 'nenhum ./pessoal montado (vault pessoal opcional, ausente)');
ok(r.protocoloMecanismo, 'espinha do mecanismo injetada pelo produto (independe de vault pessoal)');

// estado zero: sem perfil e sem vault pessoal -> avisa para rodar a fabrica
const home2 = path.join(base, 'home2');
const r2 = iniciarSessao({ sessionId: 'zero', home: home2, vaultMatriz: matriz });
ok(r2.identidade === null && r2.avisos.some(a => /cnct-fabrica-operador/.test(a)), 'estado zero delega a fabrica de operador');

try { fs.rmSync(base, { recursive: true, force: true }); } catch {}
console.log(`\nspike-perfil-operador: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
