// tests/integration/sessao/sessao-nuvem.spike.mjs
// 0.40.0 — Connect numa sessao na NUVEM: agente e hook no servidor, MCP no PC do
// operador, chamado pela ponte do app desktop. Medido em 07/11:
//   (a) o hook rodava no servidor com CONNECT_HOME vazio, diagnosticava "1o uso" e
//       mandava parar tudo — com o operador plenamente configurado no PC;
//   (b) a ponte entrega o `content[].text` e descarta o `structuredContent` — o
//       oposto do Cowork local (medido em 23/08 e 26/08). A carta do sub-vault e o
//       vinculo do operador, que viajavam so no JSON, sumiam.
// Este spike trava as duas correcoes: o hook orienta em vez de diagnosticar, e a
// primeira entrega de carta e vinculo vai nos DOIS canais (dedup a partir da segunda).
//
//   node tests/integration/sessao/sessao-nuvem.spike.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { execucaoNaNuvem } from '../../../plugins/connect/lib/ambiente.mjs';
import { renderResolucao, renderVinculoOperador, renderSessaoNuvem } from '../../../plugins/connect/lib/render.mjs';
import { gravarConfig, registrarSubVaultLocal } from '../../../plugins/connect/lib/session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(__dirname, '..', '..', '..', 'plugins', 'connect');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// Ambiente limpo: nada do CONNECT_* nem do sinal de nuvem da maquina que roda o teste.
const envBase = Object.fromEntries(Object.entries(process.env)
  .filter(([k]) => !k.startsWith('CONNECT_') && k !== 'CLAUDE_CODE_REMOTE'));

// ---------------------------------------------------------------------------
// 1. Deteccao de ambiente
// ---------------------------------------------------------------------------
ok(execucaoNaNuvem({ CLAUDE_CODE_REMOTE: 'true' }) === true, 'CLAUDE_CODE_REMOTE=true e nuvem');
ok(execucaoNaNuvem({}) === false, 'sem sinal e local');
ok(execucaoNaNuvem({ CLAUDE_CODE_REMOTE: 'false' }) === false, 'CLAUDE_CODE_REMOTE=false e local');
ok(execucaoNaNuvem({ CLAUDE_CODE_REMOTE: 'true', CONNECT_EXECUCAO: 'local' }) === false, 'CONNECT_EXECUCAO=local vence o sinal');
ok(execucaoNaNuvem({ CONNECT_EXECUCAO: 'nuvem' }) === true, 'CONNECT_EXECUCAO=nuvem forca nuvem');

// ---------------------------------------------------------------------------
// 2. Hook SessionStart
// ---------------------------------------------------------------------------
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-nuvem-'));
const hook = path.join(raiz, 'hooks', 'session-start.mjs');
const rodarHook = (env) => spawnSync('node', [hook], {
  input: JSON.stringify({ session_id: 'nuvem-1' }), env: { ...envBase, ...env }, encoding: 'utf8',
});

const homeVazio = path.join(base, 'home-vazio');
const hn = rodarHook({ CLAUDE_CODE_REMOTE: 'true', CONNECT_HOME: homeVazio });
ok(hn.status === 0, 'hook na nuvem termina com exit 0');
ok(/sessao na nuvem/.test(hn.stdout), 'na nuvem sem config local, o hook injeta o bloco de sessao na nuvem');
ok(!/configuracao necessaria/i.test(hn.stdout), 'na nuvem o hook NAO afirma que a matriz falta (diagnostico falso de 07/11)');
ok(!/perfil do operador nao provisionado/i.test(hn.stdout), 'na nuvem o hook NAO afirma que o perfil falta');
ok(/estado_sessao/.test(hn.stdout) && /iniciar_sessao/.test(hn.stdout), 'o bloco manda perguntar o estado ao MCP pela ponte');
ok(!fs.existsSync(path.join(homeVazio, 'sessions')), 'na nuvem o hook nao cria scaffold de sessao no servidor');

const hl = rodarHook({ CONNECT_HOME: path.join(base, 'home-local') });
ok(!/sessao na nuvem/.test(hl.stdout), 'local: comportamento anterior preservado (sem bloco de nuvem)');
ok(/configuracao necessaria/i.test(hl.stdout), 'local sem config: o 1o uso continua sendo anunciado');

// Nuvem COM configuracao de verdade no servidor: segue o fluxo normal.
const matrizSrv = path.join(base, 'matriz-srv');
fs.mkdirSync(path.join(matrizSrv, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matrizSrv, '_cerebro', 'vault-config.md'), '---\ntipo-vault: matriz\n---\n');
const homeSrv = path.join(base, 'home-srv');
gravarConfig({ home: homeSrv, vaultMatriz: matrizSrv });
const hs = rodarHook({ CLAUDE_CODE_REMOTE: 'true', CONNECT_HOME: homeSrv });
ok(!/sessao na nuvem/.test(hs.stdout) && /sessao iniciada/.test(hs.stdout), 'nuvem COM config local: fluxo normal (nao mascara instalacao real)');

// ---------------------------------------------------------------------------
// 3. Render: carta ja entregue e vinculo
// ---------------------------------------------------------------------------
const res = {
  status: 'resolvido', conceito: 'cliente-x', caminhoRelativo: './cliente-x', tipo: 'cliente',
  entradaResolvida: { status: 'resolvida', caminhoRelativo: './cliente-x/_cerebro/camada-1.md' },
  vinculo: { status: 'lido', coletivo: 'cliente-x', blocos: [{ arquivo: 'config.md', texto: 'VINCULO DO OPERADOR' }] },
  l1: { carta: { presente: true, caminhoRelativo: './cliente-x/_cerebro/camada-1.md', inline: 'CARTA DO CLIENTE X', validacao: { ok: true, faltando: [] } } },
};
const t1 = renderResolucao(res, { cartaInline: true, vinculoBlocos: res.vinculo.blocos });
ok(/CARTA DO CLIENTE X/.test(t1) && /VINCULO DO OPERADOR/.test(t1), '1a entrega: carta e vinculo no texto');
ok(t1.indexOf('VINCULO DO OPERADOR') < t1.indexOf('CARTA DO CLIENTE X'), 'o vinculo vem ANTES da carta (curadoria-pessoal-coletivo)');
const t2 = renderResolucao(res, { cartaInline: false, cartaJaEntregue: true, vinculoBlocos: [] });
ok(!/CARTA DO CLIENTE X/.test(t2) && !/VINCULO DO OPERADOR/.test(t2), '2a entrega: nem carta nem vinculo repetidos');
ok(/ja entregue nesta sessao/.test(t2), '2a entrega: o texto diz que ja foi entregue (e manda abrir o arquivo se compactou)');
ok(!/lacuna de CANAL/.test(t2), '2a entrega: nao acusa lacuna de canal onde nao ha');
ok(/VINCULO X/.test(renderVinculoOperador({ status: 'lido', coletivo: 'x', blocos: [{ arquivo: 'a.md', texto: 'VINCULO X' }] })),
  'estado_operador: o texto leva o vinculo inteiro');
ok(/ausente/.test(renderVinculoOperador({ status: 'ausente', coletivo: 'y' })), 'estado_operador: vinculo ausente e dito no texto');
ok(!/configurar_por_codigo|catalogo_sync|cnct-fabrica-operador/.test(renderSessaoNuvem()), 'o bloco de nuvem nao dispara o fluxo de 1o uso (configurar, catalogo, fabrica do operador)');

// ---------------------------------------------------------------------------
// 4. Ponta a ponta no MCP: resolver duas vezes na mesma sessao
// ---------------------------------------------------------------------------
const matriz = path.join(base, 'matriz');
const acervo = path.join(base, 'acervo-x');
fs.mkdirSync(path.join(matriz, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(matriz, '_cerebro', 'vault-config.md'), '---\ntipo-vault: matriz\n---\n');
fs.mkdirSync(path.join(matriz, 'frentes'), { recursive: true });
fs.writeFileSync(path.join(matriz, 'frentes', 'cliente-x.md'),
  '---\ntipo: cliente\npapel: freela\nconceito: cliente-x\nalias: cliente-x\nexterno: true\ncriado-por: T\ncriado-em: 2026-11-07\nentrada: _cerebro/camada-1.md\n---\n# manifesto\n');
fs.mkdirSync(path.join(acervo, '_cerebro'), { recursive: true });
fs.writeFileSync(path.join(acervo, '_cerebro', 'vault-config.md'), '---\ntipo-vault: sub-vault\n---\n');
const CARTA = 'MARCADOR-UNICO-DA-CARTA-XYZ';
fs.writeFileSync(path.join(acervo, '_cerebro', 'camada-1.md'),
  `---\ntipo-artefato: camada-1\n---\n\n# Camada 1 — X\n\n${CARTA}\n\n## O que e este vault\n\nx\n\n## Estrutura\n\nx\n\n## Ordem de entrada\n\n1. Esta carta.\n\n## Quando carregar\n\n| a | b |\n|---|---|\n\n## Fronteiras\n\n- x\n`);
const home = path.join(base, 'home-mcp');
gravarConfig({ home, vaultMatriz: matriz });
registrarSubVaultLocal({ home, conceito: 'cliente-x', caminho: acervo });
const ws = path.join(base, 'ws');
fs.mkdirSync(ws, { recursive: true });

const child = spawn('node', [path.join(raiz, 'mcp', 'connect-mcp.mjs')],
  { stdio: ['pipe', 'pipe', 'pipe'], env: { ...envBase, CONNECT_HOME: home } });
const pending = new Map();
let buf = '';
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
const call = (id, method, params) => new Promise((resolve) => {
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});

await call(1, 'initialize', { protocolVersion: '2025-06-18' });
const r1 = await call(2, 'tools/call', { name: 'resolver', arguments: { conceito: 'cliente-x', workspace_dir: ws } });
const txt1 = r1.result?.content?.[0]?.text || '';
ok(!r1.result?.isError && /montado/.test(txt1), 'MCP: resolver resolve o fixture');
ok(txt1.includes(CARTA), 'MCP 1a chamada: a carta vai no TEXTO (cliente que descarta o JSON nao perde a camada 1)');
ok(JSON.stringify(r1.result?.structuredContent || {}).includes(CARTA), 'MCP 1a chamada: a carta segue no structuredContent (Cowork local nao regride)');
const r2 = await call(3, 'tools/call', { name: 'resolver', arguments: { conceito: 'cliente-x', workspace_dir: ws } });
const txt2 = r2.result?.content?.[0]?.text || '';
ok(!txt2.includes(CARTA), 'MCP 2a chamada: a carta NAO e repetida no texto');
ok(!JSON.stringify(r2.result?.structuredContent || {}).includes(CARTA), 'MCP 2a chamada: nem no structuredContent');
ok(/ja entregue nesta sessao/.test(txt2), 'MCP 2a chamada: o texto aponta que ja foi entregue');
child.kill();

console.log(`spike-sessao-nuvem: ${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
