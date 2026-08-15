// tests/spike-resolver.mjs
// Spike do `resolver` por conceito: registro declarativo -> mount por conceito.
// Roda no Linux via symlink (mesma logica do junction no Windows). Zero-dep.
//
//   node tests/spike-resolver.mjs
//
// Cria um cerebro pessoal temporario com _cerebro/sub-vaults.json declarando um
// sub-vault "gestao-financeira" (origem = um vault temporario com forma de vault),
// resolve por um GATILHO ("pensao") e verifica: casou, montou, leu ATRAVES do
// atalho, origem intacta, L1 carregada. Tambem checa nao-encontrado e precedencia.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolver, lerRegistro, casar } from '../plugins/connect/lib/resolver.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-resolver-'));
const cerebro = path.join(base, 'cerebro');
const gestao = path.join(base, 'gestao-vault');
const workspace = path.join(base, 'workspace');

// cerebro pessoal com registro declarativo
fs.mkdirSync(path.join(cerebro, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(cerebro, '_cerebro', 'sub-vaults.json'), JSON.stringify([
  { conceito: 'gestao-financeira', origem: gestao, alias: 'gestao', gatilhos: ['financas', 'pensao', 'orcamento'], nota: 'minha gestao' },
], null, 2));

// sub-vault de gestao com forma de vault (para carregar L1)
fs.mkdirSync(path.join(gestao, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(gestao, '_cerebro', 'vault-config.md'), 'tipo: coletivo-pessoal\nponto-focal: Gabriel\n');
fs.mkdirSync(path.join(gestao, 'financas'), { recursive: true });
fs.writeFileSync(path.join(gestao, 'financas', 'marcador.md'), 'conteudo real de financas');

fs.mkdirSync(workspace, { recursive: true });

// --- casar (puro) ---
const reg = lerRegistro([cerebro]);
ok(reg.length === 1, 'registro leu 1 entrada');
ok(casar(reg, 'gestao-financeira')?.conceito === 'gestao-financeira', 'casa por conceito exato');
ok(casar(reg, 'pensao')?.conceito === 'gestao-financeira', 'casa por gatilho');
ok(casar(reg, 'financ')?.conceito === 'gestao-financeira', 'casa por substring');
ok(casar(reg, 'inexistente') === null, 'nao casa termo desconhecido');

// --- resolver (efeito: monta) ---
const r = resolver({ conceito: 'pensao', workspaceDir: workspace, cerebroPessoal: cerebro });
ok(r.status === 'resolvido', `status resolvido (foi: ${r.status})`);
ok(r.alias === 'gestao', 'alias do registro aplicado');
ok(r.caminhoRelativo === './gestao', 'caminho relativo correto');

const link = path.join(workspace, 'gestao');
ok(fs.existsSync(link), 'atalho criado no workspace');
// leitura ATRAVES do atalho
const lido = fs.readFileSync(path.join(link, 'financas', 'marcador.md'), 'utf8');
ok(lido.includes('conteudo real'), 'leu atraves do atalho');
// origem intacta
ok(fs.existsSync(path.join(gestao, 'financas', 'marcador.md')), 'origem intacta');
// L1 carregada
ok(r.l1 && r.l1.identidadeVault && r.l1.identidadeVault['ponto-focal'] === 'Gabriel', 'L1 do sub-vault carregada');

// idempotencia (replace)
const r2 = resolver({ conceito: 'gestao-financeira', workspaceDir: workspace, cerebroPessoal: cerebro, replace: true });
ok(r2.status === 'resolvido', 'idempotente com replace');

// nao-encontrado
const r3 = resolver({ conceito: 'nao-existe', workspaceDir: workspace, cerebroPessoal: cerebro });
ok(r3.status === 'nao-encontrado' && Array.isArray(r3.disponiveis), 'nao-encontrado lista disponiveis');

// limpeza
try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* ignore */ }

console.log(`\nspike-resolver: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
