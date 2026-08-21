#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const PORT = process.env.BRIDGE_PORT ? Number(process.env.BRIDGE_PORT) : 3000;

const mcpPath = path.resolve(process.cwd(), 'plugins', 'connect', 'mcp', 'connect-mcp.mjs');
const mcpCwd = path.dirname(mcpPath);

console.error('[bridge] starting MCP from', mcpPath);
const mcp = spawn(process.execPath, [mcpPath], { stdio: ['pipe', 'pipe', 'inherit'], cwd: mcpCwd });

let buffer = '';
const pending = new Map();
let nextId = 1;

mcp.stdout.setEncoding('utf8');
mcp.stdout.on('data', (chunk) => {
  buffer += chunk;
  const parts = buffer.split(/\r?\n/);
  buffer = parts.pop();
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg.result || msg.error || msg);
      } else {
        console.error('[bridge] unsolicited message:', msg);
      }
    } catch (e) {
      console.error('[bridge] non-json:', line.slice(0, 200));
    }
  }
});

function sendRpc(payload) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const msg = { jsonrpc: '2.0', id, ...payload };
    pending.set(id, { resolve, reject });
    try {
      mcp.stdin.write(JSON.stringify(msg) + '\n');
    } catch (e) {
      pending.delete(id);
      return reject(e);
    }
    // timeout
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout waiting for mcp response'));
      }
    }, 10_000);
  });
}

async function writeContextToWorkspace(text) {
  try {
    const dir = path.resolve(process.cwd(), '.connect');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'context.md');
    await fs.writeFile(file, text, 'utf8');
    return file;
  } catch (e) {
    console.error('[bridge] failed to write context file', e.message);
    throw e;
  }
}

function extractTextFromResult(result) {
  if (!result) return '';
  if (Array.isArray(result.content)) {
    return result.content.map((c) => (c && c.text) || '').join('\n\n');
  }
  if (typeof result === 'string') return result;
  if (result.structuredContent && result.structuredContent.protocoloMecanismo) return result.structuredContent.protocoloMecanismo;
  return JSON.stringify(result, null, 2);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/tools/list') {
      const r = await sendRpc({ method: 'tools/list' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r));
      return;
    }

    if (req.method === 'POST' && (req.url === '/iniciar_sessao' || req.url === '/resolver')) {
      let body = '';
      for await (const chunk of req) body += chunk;
      const args = body ? JSON.parse(body) : {};

      if (req.url === '/iniciar_sessao') {
        const rpc = await sendRpc({ method: 'tools/call', params: { name: 'iniciar_sessao', arguments: args } });
        const text = extractTextFromResult(rpc.result || rpc);
        const file = await writeContextToWorkspace(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file, rpc }));
        return;
      }

      if (req.url === '/resolver') {
        const { conceito, workspace_dir, alias, replace } = args;
        if (!conceito || !workspace_dir) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'conceito and workspace_dir required' }));
          return;
        }
        const rpc = await sendRpc({ method: 'tools/call', params: { name: 'resolver', arguments: { conceito, workspace_dir, alias, replace } } });
        const text = extractTextFromResult(rpc.result || rpc);
        const file = await writeContextToWorkspace(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file, rpc }));
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => console.error(`[bridge] http server listening on ${PORT}`));

process.on('exit', () => { try { mcp.kill(); } catch {} });
process.on('SIGINT', () => process.exit());
