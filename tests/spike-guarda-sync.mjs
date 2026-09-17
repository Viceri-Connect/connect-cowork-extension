#!/usr/bin/env node
// tests/spike-guarda-sync.mjs
// Spike da TRAVA DE INTEGRIDADE do mount — incidente de 09/09/2026, medido em 17/09.
//
// O que aconteceu: uma resolucao de heranca rodou com `workspaceDir` = raiz da
// matriz (biblioteca SharePoint sincronizada). O mecanismo montou duas junctions
// de sub-vault ali e gravou `.connect/heranca.json`. O cliente OneDrive seguiu as
// junctions e materializou a arvore dos vaults de origem DENTRO da biblioteca da
// matriz — duplicata publicada na nuvem por 8 dias.
//
// Premissas que este spike mata:
//   1. Workspace dentro de sync root (marcador GUID oculto) e RECUSADO no mount.
//   2. Workspace sob a pasta de %OneDrive% e RECUSADO.
//   3. Raiz de vault (tem `_cerebro/`) e RECUSADA mesmo fora de nuvem.
//   4. Workspace efemero limpo continua montando (a trava nao pode matar o caso bom).
//   5. O registro de heranca NAO e gravado em workspace recusado — e a recusa e
//      ruidosa, nunca silenciosa.
//   6. A recusa acontece ANTES de qualquer escrita: nada e criado no destino.
//
// Roda em Windows (junction) e POSIX (symlink). Zero dependencias.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mount } from '../plugins/connect/lib/mount.mjs';
import { detectarSincronizacao, ehRaizDeVault, assertDestinoDeMountSeguro } from '../plugins/connect/lib/sincronizado.mjs';
import { marcarInjetado, lerRegistro } from '../plugins/connect/lib/heranca.mjs';

let passou = 0, falhou = 0;
const ok = (cond, nome) => {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome}`); }
};

const lanca = (fn) => {
  try { fn(); return null; } catch (e) { return e.message; }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-guarda-'));
const origem = path.join(tmp, 'origem-do-acervo');
fs.mkdirSync(path.join(origem, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(origem, '_cerebro', 'camada-1.md'), '# carta\n', 'utf8');

console.log('\n--- deteccao ------------------------------------------------------');

// 1. sync root por marcador GUID oculto (o sinal real do OneDrive/SharePoint)
const biblioteca = path.join(tmp, 'Tenant Qualquer', 'Colecao - Vault');
const dentroDaBiblioteca = path.join(biblioteca, 'nivel', 'mais', 'fundo');
fs.mkdirSync(dentroDaBiblioteca, { recursive: true });
fs.writeFileSync(path.join(biblioteca, '.849C9593-D756-4E56-8D6E-42412F2A707B'), '', 'utf8');

const d1 = detectarSincronizacao(dentroDaBiblioteca);
ok(d1.sincronizado, 'marcador GUID num ancestral denuncia o sync root');
ok(path.resolve(d1.raiz) === path.resolve(biblioteca), 'a raiz reportada e a biblioteca, nao o diretorio folha');
ok(/OneDrive|SharePoint/i.test(d1.provedor || ''), 'provedor identificado como OneDrive/SharePoint');

// 2. pasta limpa nao e falso positivo
const limpo = path.join(tmp, 'scaffold-efemero', 'sessions', 'abc-123');
fs.mkdirSync(limpo, { recursive: true });
ok(!detectarSincronizacao(limpo).sincronizado, 'workspace efemero limpo NAO e marcado como sincronizado');

// 3. variavel de ambiente do cliente OneDrive
const envAntes = process.env.OneDrive;
const pastaEnv = path.join(tmp, 'OneDriveDoTeste');
fs.mkdirSync(path.join(pastaEnv, 'sub'), { recursive: true });
process.env.OneDrive = pastaEnv;
ok(detectarSincronizacao(path.join(pastaEnv, 'sub')).sincronizado, 'caminho sob %OneDrive% e detectado');
ok(!detectarSincronizacao(limpo).sincronizado, '%OneDrive% nao contamina caminho de fora');
if (envAntes === undefined) delete process.env.OneDrive; else process.env.OneDrive = envAntes;

// 4. segmento de caminho conhecido, sem marcador nenhum
const porNome = path.join(tmp, 'OneDrive - Empresa Fulana', 'area');
fs.mkdirSync(porNome, { recursive: true });
ok(detectarSincronizacao(porNome).sincronizado, 'pasta "OneDrive - <tenant>" e detectada sem precisar de marcador');

// 5. raiz de vault
ok(ehRaizDeVault(origem), 'diretorio com _cerebro/ e reconhecido como raiz de vault');
ok(!ehRaizDeVault(limpo), 'scaffold nao e confundido com vault');

console.log('\n--- mount ---------------------------------------------------------');

// 6. o caso bom continua funcionando
const r = mount({ workspaceDir: limpo, alias: 'acervo', source: origem });
ok(r.status === 'mounted', 'mount em workspace efemero limpo continua funcionando');
ok(fs.existsSync(path.join(limpo, 'acervo', '_cerebro', 'camada-1.md')), 'o alias montado alcanca o conteudo da origem');

// 7. o incidente: montar dentro de biblioteca sincronizada
const e1 = lanca(() => mount({ workspaceDir: dentroDaBiblioteca, alias: 'acervo', source: origem }));
ok(e1 !== null, 'mount dentro de arvore sincronizada e RECUSADO');
ok(/sincronizada/i.test(e1 || ''), 'a mensagem de recusa nomeia a causa (arvore sincronizada)');
ok(!fs.existsSync(path.join(dentroDaBiblioteca, 'acervo')), 'a recusa acontece ANTES de qualquer escrita no destino');

// 8. montar na raiz de um vault, fora de nuvem
const e2 = lanca(() => mount({ workspaceDir: origem, alias: 'outro', source: limpo }));
ok(e2 !== null, 'mount na raiz de um vault e RECUSADO mesmo fora de pasta sincronizada');
ok(/vault/i.test(e2 || ''), 'a mensagem de recusa nomeia a causa (raiz de vault)');
ok(!fs.existsSync(path.join(origem, 'outro')), 'nada foi criado dentro do vault');

// 9. a mensagem ensina o que fazer
const e3 = lanca(() => assertDestinoDeMountSeguro(dentroDaBiblioteca));
ok(/sessions/i.test(e3 || ''), 'a recusa aponta o lugar certo (scaffold da sessao)');

console.log('\n--- registro de heranca -------------------------------------------');

// 10. o registro de sessao nunca cai em vault nem em biblioteca sincronizada
ok(marcarInjetado(limpo, 'sdd') === true, 'registro grava normalmente no workspace efemero');
ok(lerRegistro(limpo).processos.includes('sdd'), 'e o que foi gravado e lido de volta');

ok(marcarInjetado(dentroDaBiblioteca, 'sdd') === false, 'registro em arvore sincronizada e RECUSADO');
ok(!fs.existsSync(path.join(dentroDaBiblioteca, '.connect')), 'nenhum .connect criado na biblioteca');

ok(marcarInjetado(origem, 'sdd') === false, 'registro na raiz de um vault e RECUSADO');
ok(!fs.existsSync(path.join(origem, '.connect')), 'nenhum .connect criado no vault');

console.log(`\n${passou} ok, ${falhou} falha(s)`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(falhou === 0 ? 0 : 1);
