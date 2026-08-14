#!/usr/bin/env node
// tests/handshake-mcp.mjs
// Sobe o servidor MCP como processo filho, faz initialize / tools/list /
// tools/call(iniciar_sessao) e valida as respostas. Encerra o servidor no fim.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(__dirname, '..', 'plugins', 'connect', 'mcp', 'connect-mcp.mjs');

const child = spawn('node', [server], { stdio: ['pipe', 'pipe', 'inherit'], env: process.env });

const pending = new Map();
let buf = '';
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});

const call = (id, method, params) => new Promise((resolve) => {
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});

let falhas = 0;
const check = (nome, cond) => { console.log(`  ${cond ? 'ok' : 'XX'}  ${nome}`); if (!cond) falhas++; };

console.log('\n[handshake] verificacoes:');
const init = await call(1, 'initialize', { protocolVersion: '2025-06-18' });
check('initialize responde serverInfo', init.result?.serverInfo?.name === 'connect');

const list = await call(2, 'tools/list', {});
const names = (list.result?.tools || []).map((t) => t.name);
check('tools/list inclui iniciar_sessao', names.includes('iniciar_sessao'));
check('tools/list inclui os primitivos de mount', names.includes('mount_junction') && names.includes('unmount_junction') && names.includes('list_mounts'));

const called = await call(3, 'tools/call', { name: 'iniciar_sessao', arguments: { session_id: 'handshake-1' } });
check('iniciar_sessao sem isError', !called.result?.isError);
check('iniciar_sessao devolve bloco de contexto', /Connect — sessao iniciada/.test(called.result?.content?.[0]?.text || ''));
check('iniciar_sessao devolve structuredContent', !!called.result?.structuredContent?.workspace);

child.kill();
console.log(`\n[handshake] ${falhas === 0 ? 'TODAS PASSARAM' : falhas + ' FALHA(S)'}\n`);
process.exit(falhas === 0 ? 0 : 1);
