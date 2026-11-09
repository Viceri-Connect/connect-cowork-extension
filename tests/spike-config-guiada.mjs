#!/usr/bin/env node
// tests/spike-config-guiada.mjs
// Prova o fluxo de 1o uso sem env pre-configurada:
//   estado_sessao (nao configurado) -> configurar (grava paths) ->
//   estado_sessao (configurado) -> iniciar_sessao (monta e restaura).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estadoSessao, gravarConfig, iniciarSessao } from '../plugins/connect/lib/session.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-cfg-'));
const home = path.join(tmp, 'connect-home');
const matriz = path.join(tmp, 'onedrive', 'viceri-vault');
const pessoal = path.join(tmp, 'onedrive', 'second brain');

// matriz + pessoal falsos
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'vault-config.md'),
  '## Identidade\n- empresa: "Viceri Seidor"\n- contexto: "interno-viceri"\n');
fs.mkdirSync(path.join(pessoal, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(pessoal, '_cerebro', 'meu-config.md'),
  '- nome: "Gabriel Vasconcelos Guilhem"\n- emails: "gabriel.guilhem@viceri.com.br"\n');

// isola: sem env apontando paths; so CONNECT_HOME
process.env.CONNECT_HOME = home;
delete process.env.CONNECT_VAULT_MATRIZ;
delete process.env.CONNECT_CEREBRO_PESSOAL;

let falhas = 0;
const check = (n, c) => { console.log(`  ${c ? 'ok' : 'XX'}  ${n}`); if (!c) falhas++; };
console.log('\n[config-guiada] verificacoes:');

// 1. estado inicial: nao configurado
const e0 = estadoSessao({ sessionId: 'S1' });
check('1o uso: nao configurado', e0.configurado === false);

// 2. configurar com um path invalido -> reporta e nao grava
const bad = gravarConfig({ vaultMatriz: path.join(tmp, 'nao-existe') });
check('path invalido reportado', bad.invalidos.length === 1 && !bad.gravados.vaultMatriz);

// 3. configurar correto (parcial: so matriz)
const c1 = gravarConfig({ vaultMatriz: matriz });
check('grava matriz', c1.gravados.vaultMatriz === path.resolve(matriz));
check('config.json criado', fs.existsSync(c1.configPath));

// 4. completa com cerebro pessoal (merge, nao sobrescreve matriz)
const c2 = gravarConfig({ cerebroPessoal: pessoal });
check('merge preserva matriz', c2.config.vaultMatriz === path.resolve(matriz) && c2.config.cerebroPessoal === path.resolve(pessoal));

// 5. estado agora configurado
const e1 = estadoSessao({ sessionId: 'S1' });
check('agora configurado', e1.configurado === true);
check('ainda nao montado nesta sessao', e1.montadoNestaSessao === false);

// 6. iniciar_sessao usa a config gravada (sem env)
const r = iniciarSessao({ sessionId: 'S1' });
check('matriz montada a partir da config', (r.mounts || []).some((m) => m.alias === 'matriz' && (m.status === 'mounted' || m.status === 'exists')));
check('identidade restaurada', r.identidade && r.identidade.nome === 'Gabriel Vasconcelos Guilhem');
check('sem avisos de config', !(r.avisos || []).some((a) => /nao definido/.test(a)));

// 7. estado reflete montado
const e2 = estadoSessao({ sessionId: 'S1' });
check('montadoNestaSessao = true', e2.montadoNestaSessao === true);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
console.log(`\n[config-guiada] ${falhas === 0 ? 'TODAS PASSARAM' : falhas + ' FALHA(S)'}\n`);
process.exit(falhas === 0 ? 0 : 1);
