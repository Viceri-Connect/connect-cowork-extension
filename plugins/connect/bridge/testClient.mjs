#!/usr/bin/env node
// Test client: inicia o connect-mcp.mjs e envia chamadas JSON-RPC básicas
import { spawn } from 'node:child_process';
import path from 'node:path';

const mcpPath = path.resolve(process.cwd(), 'plugins', 'connect', 'mcp', 'connect-mcp.mjs');
const proc = spawn('node', [mcpPath], { stdio: ['pipe', 'pipe', 'inherit'] });

let buffer = '';
proc.stdout.setEncoding('utf8');
proc.stdout.on('data', (chunk) => {
  buffer += chunk;
  let lines = buffer.split(/\r?\n/);
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      console.log('<<', JSON.stringify(msg, null, 2));
    } catch (e) {
      console.log('<< (non-json) ', line);
    }
  }
});

function send(msg) {
  const s = JSON.stringify(msg) + '\n';
  proc.stdin.write(s);
  console.log('>>', JSON.stringify(msg));
}

// Espera 200ms para o servidor subir
setTimeout(() => {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  setTimeout(() => {
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    setTimeout(() => {
      // chama iniciar_sessao via tools/call
      send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'iniciar_sessao', arguments: { session_id: 'test-session' } } });
      // fecha depois de um tempo
      setTimeout(() => { proc.kill(); }, 800);
    }, 200);
  }, 200);
}, 200);
