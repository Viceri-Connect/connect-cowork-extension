import { describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const serverPath = path.join(root, 'plugins', 'connect-http', 'mcp', 'connect-mcp.mjs');

async function portaLivre() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function ambienteIsolado(home) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('CONNECT_')));
  env.CONNECT_HOME = home;
  return env;
}

describe('MCP Streamable HTTP local', () => {
  it('serves MCP over a configurable loopback port and rejects external origins', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-mcp-http-'));
    const port = await portaLivre();
    const processServer = spawn(process.execPath, [serverPath, '--transport=http', `--port=${port}`], {
      cwd: root,
      env: ambienteIsolado(path.join(temp, 'connect-home')),
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    processServer.stderr.setEncoding('utf8');
    processServer.stderr.on('data', (chunk) => { stderr += chunk; });

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`HTTP server startup timed out: ${stderr}`)), 5000);
        processServer.stderr.on('data', (chunk) => {
          if (chunk.includes('servidor pronto')) {
            clearTimeout(timer);
            resolve();
          }
        });
        processServer.once('error', reject);
        processServer.once('exit', (code) => reject(new Error(`HTTP server exited (${code}): ${stderr}`)));
      });

      const url = `http://127.0.0.1:${port}/mcp`;
      const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
      const [initialize, listing] = await Promise.all([
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }),
        }),
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
        }),
      ]);
      const initialized = await initialize.json();
      const tools = await listing.json();
      expect(initialize.status).toBe(200);
      expect(initialized.result.serverInfo.name).toBe('connect');
      expect(listing.status).toBe(200);
      expect(tools.result.tools.map((tool) => tool.name)).toContain('iniciar_sessao');

      const notification = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      });
      expect(notification.status).toBe(202);

      const rejectedOrigin = await fetch(url, {
        method: 'POST',
        headers: { ...headers, origin: 'http://attacker.example' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' }),
      });
      expect(rejectedOrigin.status).toBe(403);

      const get = await fetch(url, { headers: { accept: 'text/event-stream' } });
      expect(get.status).toBe(405);
    } finally {
      processServer.kill();
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  it('keeps stdio as the default and rejects unknown transport parameters', () => {
    const stdioInput = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    ].map((message) => JSON.stringify(message)).join('\n') + '\n';
    const stdio = spawnSync(process.execPath, [serverPath], {
      env: ambienteIsolado(path.join(os.tmpdir(), `connect-mcp-stdio-${process.pid}`)),
      input: stdioInput,
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
    });
    expect(stdio.status, stdio.stderr).toBe(0);
    expect(JSON.parse(stdio.stdout.trim()).result.serverInfo.name).toBe('connect');

    const invalid = spawnSync(process.execPath, [serverPath, '--transport=unknown'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain('transporte invalido');
  });
});