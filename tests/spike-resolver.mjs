// tests/spike-resolver.mjs
// Spike do `resolver` por conceito: registro DERIVADO de manifestos -> mount.
// Roda no Linux via symlink (mesma logica do junction no Windows). Zero-dep.
//
//   node tests/spike-resolver.mjs
//
// Cria uma matriz temporaria com um MANIFESTO (nota `connect.md` cujo frontmatter
// declara `tipo` + `fonte`), resolve por um GATILHO (tag "impulsa") e verifica:
// derivou do manifesto, casou, montou, leu ATRAVES do atalho, origem intacta, L1
// carregada. Tambem checa parseManifesto, onedriveRoot, e nao-encontrado.
// Sem `sub-vaults.json` — registro autorado e proibido (contrato-manifesto §3).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolver, lerRegistro, casar, parseManifesto, onedriveRoot } from '../plugins/connect/lib/resolver.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-resolver-'));
const matriz = path.join(base, 'matriz');
const acervo = path.join(base, 'tribo-impulsa');   // sub-vault (acervo da tribo)
const workspace = path.join(base, 'workspace');

// --- matriz temporaria com um MANIFESTO derivavel ---
fs.mkdirSync(path.join(matriz, 'organizacao', 'tribos', 'Impulsa'), { recursive: true });
fs.writeFileSync(path.join(matriz, 'organizacao', 'tribos', 'Impulsa', 'connect.md'),
`---
tipo: programa
papel: tribo
governanca: Gabriel
fonte:
  - escopo: tribo-impulsa
    url: "${acervo}"
tags: [connect, impulsa, tribo]
---
# manifesto
`);
// uma nota NAO-entidade (sem fonte) para garantir que nao entra no registro
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'nota-solta.md'), `---\ntipo: nota\n---\ntexto`);

// --- acervo com forma de vault (para carregar L1) ---
fs.mkdirSync(path.join(acervo, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(acervo, '_cerebro', 'vault-config.md'), 'tipo: programa\npapel: tribo\n');
fs.mkdirSync(path.join(acervo, 'projetos', 'Connect'), { recursive: true });
fs.writeFileSync(path.join(acervo, 'projetos', 'Connect', 'marcador.md'), 'conteudo real do Connect');

fs.mkdirSync(workspace, { recursive: true });

// --- parseManifesto (puro) ---
const manOk = parseManifesto(`tipo: programa\nfonte:\n  - url: "/x/y"\ntags: [a, b]`);
ok(manOk && manOk.tipo === 'programa' && manOk.fontes[0] === '/x/y', 'parseManifesto extrai tipo + fonte');
ok(manOk.gatilhos.includes('a') && manOk.gatilhos.includes('b'), 'parseManifesto extrai gatilhos das tags');
ok(parseManifesto(`tipo: nota\n`) === null, 'parseManifesto rejeita entidade sem fonte');
ok(parseManifesto(`fonte:\n  - url: "/x"`) === null, 'parseManifesto rejeita nota sem tipo');

// --- onedriveRoot (deriva a raiz do sufixo declarado) ---
const odBase = fs.mkdtempSync(path.join(os.tmpdir(), 'od-'));
const vaultOD = path.join(odBase, 'Viceri Seidor', 'Matriz');
fs.mkdirSync(path.join(vaultOD, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(vaultOD, '_cerebro', 'vault-config.md'),
`---\nonedrive-rel: "Viceri Seidor/Matriz"\n---`);
ok(onedriveRoot(vaultOD) === odBase, `onedriveRoot deriva a raiz (foi: ${onedriveRoot(vaultOD)})`);

// --- lerRegistro (derivado) ---
const reg = lerRegistro([matriz]);
ok(reg.length === 1, `registro derivou 1 entidade (foi: ${reg.length})`);
ok(reg[0].conceito === 'connect', 'conceito = slug do arquivo');
ok(casar(reg, 'connect')?.conceito === 'connect', 'casa por conceito exato');
ok(casar(reg, 'impulsa')?.conceito === 'connect', 'casa por gatilho (tag)');
ok(casar(reg, 'conn')?.conceito === 'connect', 'casa por substring');
ok(casar(reg, 'inexistente') === null, 'nao casa termo desconhecido');

// --- resolver (efeito: monta) ---
const r = resolver({ conceito: 'impulsa', workspaceDir: workspace, vaultMatriz: matriz });
ok(r.status === 'resolvido', `status resolvido (foi: ${r.status})`);
ok(r.alias === 'connect', 'alias = conceito derivado');
ok(r.caminhoRelativo === './connect', 'caminho relativo correto');

const link = path.join(workspace, 'connect');
ok(fs.existsSync(link), 'atalho criado no workspace');
const lido = fs.readFileSync(path.join(link, 'projetos', 'Connect', 'marcador.md'), 'utf8');
ok(lido.includes('conteudo real'), 'leu atraves do atalho');
ok(fs.existsSync(path.join(acervo, 'projetos', 'Connect', 'marcador.md')), 'origem intacta');
ok(r.l1 && r.l1.identidadeVault, 'L1 do sub-vault carregada');

// --- nao-encontrado ---
const nf = resolver({ conceito: 'zzz', workspaceDir: workspace, vaultMatriz: matriz });
ok(nf.status === 'nao-encontrado', 'status nao-encontrado para conceito ausente');

// limpeza
try { fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(odBase, { recursive: true, force: true }); } catch {}

console.log(`\nspike-resolver: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
