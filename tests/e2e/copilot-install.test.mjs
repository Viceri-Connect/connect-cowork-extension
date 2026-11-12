import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Copilot bundle end to end', () => {
  it('starts the packaged MCP server and exposes Connect domain tools only', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-copilot-e2e-'));
    const output = path.join(temp, 'bundle');
    try {
      const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-copilot.mjs'), output], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(build.status, build.stderr).toBe(0);

      const serverPath = path.join(output, 'mcp', 'connect-mcp.mjs');
      const input = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      ].map((message) => JSON.stringify(message)).join('\n') + '\n';
      const run = spawnSync(process.execPath, [serverPath], {
        cwd: temp,
        env: { ...process.env, CONNECT_HOME: path.join(temp, 'connect-home') },
        input,
        encoding: 'utf8',
        timeout: 20_000,
        windowsHide: true,
      });
      expect(run.status, run.stderr).toBe(0);

      const replies = run.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
      expect(replies.find((reply) => reply.id === 1)?.result?.serverInfo?.name).toBe('connect');
      const names = replies.find((reply) => reply.id === 2)?.result?.tools?.map((tool) => tool.name) || [];
      expect(names).toContain('iniciar_sessao');
      expect(names).toContain('resolver');
      expect(names).toContain('ambiente_connect');
      expect(names.some((name) => /powershell|shell|execute_command|desktop/i.test(name))).toBe(false);
      expect(replies.find((reply) => reply.id === 1)?.result?.serverInfo?.version)
        .toBe(JSON.parse(fs.readFileSync(path.join(output, 'plugin.json'), 'utf8')).version);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});