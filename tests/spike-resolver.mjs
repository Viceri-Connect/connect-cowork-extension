// tests/spike-resolver.mjs
// Spike do `resolver` por conceito: registro DERIVADO de manifestos PUROS (sem
// path/url, D35) -> path local (connect.config.json.subVaults) -> mount.
// Roda no Linux via symlink (mesma logica do junction no Windows). Zero-dep.
//
//   node tests/spike-resolver.mjs
//
// Cria uma matriz temporaria com um MANIFESTO puro (nota `connect.md` cujo
// frontmatter declara `tipo`+`externo:true`+`criado-por`/`criado-em`), resolve
// por um GATILHO (tag "impulsa") contra uma tabela local `subVaults` (override,
// simulando connect.config.json) e verifica: derivou do manifesto, casou,
// achou o path local, montou, leu ATRAVES do atalho, origem intacta, L1
// carregada, `entrada` devolvida. Cobre tambem os estados sem-acervo-externo,
// pendente-criacao, local-nao-configurado e nao-encontrado.
// Sem `sub-vaults.json` — registro autorado e proibido (contrato-manifesto §3).
// Sem `onedrive-rel`/`fonte` — path nunca e conteudo coletivo (D35, corte 17/08).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolver, lerRegistro, casar, parseManifesto } from '../plugins/connect/lib/resolver.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗', msg); } };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-resolver-'));
const matriz = path.join(base, 'matriz');
const acervo = path.join(base, 'tribo-impulsa');   // sub-vault (acervo da tribo)
const workspace = path.join(base, 'workspace');

// --- matriz temporaria com um MANIFESTO puro, ja materializado ---
fs.mkdirSync(path.join(matriz, 'organizacao', 'tribos', 'Impulsa'), { recursive: true });
fs.writeFileSync(path.join(matriz, 'organizacao', 'tribos', 'Impulsa', 'connect.md'),
`---
tipo: programa
papel: tribo
governanca: Gabriel
conceito: tribo-impulsa
externo: true
criado-por: Gabriel
criado-em: 2026-08-17
entrada: hub-connect
tags: [connect, impulsa, tribo]
---
# manifesto
`);
// entidade organizacional SEM acervo externo (conteudo inline na matriz)
fs.mkdirSync(path.join(matriz, 'organizacao', 'areas'), { recursive: true });
fs.writeFileSync(path.join(matriz, 'organizacao', 'areas', 'engenharia.md'),
`---
tipo: organizacao-area
papel: area
governanca: Gabriel
---
# area sem sub-vault
`);
// entidade declarada mas AINDA NAO materializada (pendente-criacao)
fs.mkdirSync(path.join(matriz, 'clientes'), { recursive: true });
fs.writeFileSync(path.join(matriz, 'clientes', 'cliente-novo.md'),
`---
tipo: cliente
papel: cliente-externo
governanca: Gabriel
externo: true
tags: [cliente-novo]
---
# ainda sem criado-por/criado-em (conceito default = slug do arquivo)
`);
// entidade com externo:true, criada, mas SEM path local configurado nesta maquina
fs.mkdirSync(path.join(matriz, 'clientes'), { recursive: true });
fs.writeFileSync(path.join(matriz, 'clientes', 'cliente-sem-local.md'),
`---
tipo: cliente
papel: cliente-externo
governanca: Gabriel
externo: true
criado-por: Gabriel
criado-em: 2026-08-17
tags: [cliente-sem-local]
---
# criado, mas esta maquina nunca resolveu o path (conceito default = slug do arquivo)
`);
// uma nota NAO-entidade (sem tipo) para garantir que nao entra no registro
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'nota-solta.md'), `texto sem frontmatter`);

// --- acervo com forma de vault (para carregar L1) ---
fs.mkdirSync(path.join(acervo, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(acervo, '_cerebro', 'vault-config.md'), 'tipo: programa\npapel: tribo\n');
fs.mkdirSync(path.join(acervo, 'projetos', 'Connect'), { recursive: true });
fs.writeFileSync(path.join(acervo, 'projetos', 'Connect', 'marcador.md'), 'conteudo real do Connect');

fs.mkdirSync(workspace, { recursive: true });

// --- parseManifesto (puro, zero path/url) ---
const manOk = parseManifesto(`tipo: programa\nconceito: x\nexterno: true\ncriado-por: A\ncriado-em: 2026-08-17\ntags: [a, b]`);
ok(manOk && manOk.tipo === 'programa' && manOk.conceito === 'x' && manOk.externo === true, 'parseManifesto extrai tipo + conceito + externo');
ok(manOk.criadoPor === 'A' && manOk.criadoEm === '2026-08-17', 'parseManifesto extrai criado-por/criado-em');
ok(manOk.gatilhos.includes('a') && manOk.gatilhos.includes('b'), 'parseManifesto extrai gatilhos das tags');
ok(parseManifesto(`conceito: x\nexterno: true`) === null, 'parseManifesto rejeita nota sem tipo (nao e manifesto)');
const manSemExterno = parseManifesto(`tipo: organizacao-area\n`);
ok(manSemExterno && manSemExterno.externo === false, 'parseManifesto default externo=false quando omitido');

// --- lerRegistro (derivado, indexa QUALQUER tipo, mesmo sem externo) ---
const reg = lerRegistro([matriz]);
ok(reg.length === 4, `registro derivou 4 entidades (foi: ${reg.length})`);
ok(casar(reg, 'tribo-impulsa')?.conceito === 'tribo-impulsa', 'casa por conceito exato (override declarado no frontmatter)');
ok(casar(reg, 'connect')?.conceito === 'tribo-impulsa', 'casa por gatilho (slug do arquivo vira gatilho quando difere do conceito)');
ok(casar(reg, 'impulsa')?.conceito === 'tribo-impulsa', 'casa por gatilho (tag)');
ok(casar(reg, 'tribo-impuls')?.conceito === 'tribo-impulsa', 'casa por substring');
ok(casar(reg, 'inexistente') === null, 'nao casa termo desconhecido');
ok(casar(reg, 'engenharia')?.externo === false, 'entidade organizacional sem externo casa, mas externo=false');

// --- resolver: sem-acervo-externo ---
const semAcervo = resolver({ conceito: 'engenharia', workspaceDir: workspace, vaultMatriz: matriz });
ok(semAcervo.status === 'sem-acervo-externo', `status sem-acervo-externo (foi: ${semAcervo.status})`);

// --- resolver: pendente-criacao (externo:true, sem criado-por/criado-em) ---
const pendente = resolver({ conceito: 'cliente-novo', workspaceDir: workspace, vaultMatriz: matriz });
ok(pendente.status === 'pendente-criacao', `status pendente-criacao (foi: ${pendente.status})`);

// --- resolver: local-nao-configurado (externo:true, criado, sem path local) ---
const semLocal = resolver({ conceito: 'cliente-sem-local', workspaceDir: workspace, vaultMatriz: matriz });
ok(semLocal.status === 'local-nao-configurado', `status local-nao-configurado (foi: ${semLocal.status})`);
ok(semLocal.conceito === 'cliente-sem-local', 'devolve o conceito pra a skill perguntar/gravar');

// --- resolver: resolvido (path local via override, simulando connect.config.json) ---
const r = resolver({ conceito: 'impulsa', workspaceDir: workspace, vaultMatriz: matriz, subVaults: { 'tribo-impulsa': acervo } });
ok(r.status === 'resolvido', `status resolvido (foi: ${r.status})`);
ok(r.alias === 'tribo-impulsa', `alias = conceito derivado (foi: ${r.alias})`);
ok(r.caminhoRelativo === './tribo-impulsa', 'caminho relativo correto');
ok(r.entrada === 'hub-connect', `devolve entrada do manifesto (foi: ${r.entrada})`);

const link = path.join(workspace, 'tribo-impulsa');
ok(fs.existsSync(link), 'atalho criado no workspace');
const lido = fs.readFileSync(path.join(link, 'projetos', 'Connect', 'marcador.md'), 'utf8');
ok(lido.includes('conteudo real'), 'leu atraves do atalho');
ok(fs.existsSync(path.join(acervo, 'projetos', 'Connect', 'marcador.md')), 'origem intacta');
ok(r.l1 && r.l1.identidadeVault, 'L1 do sub-vault carregada');

// --- nao-encontrado ---
const nf = resolver({ conceito: 'zzz', workspaceDir: workspace, vaultMatriz: matriz });
ok(nf.status === 'nao-encontrado', 'status nao-encontrado para conceito ausente');

// limpeza
try { fs.rmSync(base, { recursive: true, force: true }); } catch {}

console.log(`\nspike-resolver: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
