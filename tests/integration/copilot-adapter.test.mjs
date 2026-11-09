import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Copilot adapter package', () => {
  it('builds a native sessionStart hook and injects context on startup, resume, and new sessions', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-copilot-build-'));
    const output = path.join(temp, 'bundle');
    try {
      const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-copilot.mjs'), output], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(build.status, build.stderr).toBe(0);

      const manifest = JSON.parse(fs.readFileSync(path.join(output, 'plugin.json'), 'utf8'));
      expect(manifest.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
      expect(manifest.name).toBe('connect');
      const config = JSON.parse(fs.readFileSync(path.join(output, 'mcp.json'), 'utf8'));
      const hooks = JSON.parse(fs.readFileSync(path.join(output, 'com.github.copilot', 'hooks', 'hooks.json'), 'utf8'));
      expect(config.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
      expect(config.mcpServers.connect).toEqual({
        type: 'stdio',
        command: 'node',
        args: ['${PLUGIN_ROOT}/mcp/connect-mcp.mjs'],
      });
      expect(hooks.version).toBe(1);
      expect(hooks.hooks.sessionStart).toHaveLength(1);
      expect(hooks.hooks.SessionStart).toBeUndefined();
      expect(hooks.hooks.sessionStart[0]).toMatchObject({
        type: 'command',
        command: 'node "${PLUGIN_ROOT}/copilot/session-start.mjs"',
        timeoutSec: 30,
      });
      expect(hooks.hooks.sessionStart[0].env).toBeUndefined();
      expect(fs.existsSync(path.join(output, 'skills', 'cnct-nucleo-sessao', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(output, '.claude-plugin', 'plugin.json'))).toBe(false);
      expect(fs.existsSync(path.join(output, 'hooks', 'hooks.json'))).toBe(false);
      expect(fs.existsSync(path.join(output, 'mcp', 'connect-mcp.mjs'))).toBe(true);
      expect(fs.existsSync(path.join(output, 'copilot', 'session-start.mjs'))).toBe(true);

      const home = path.join(temp, 'connect-home');
      const hookEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('CONNECT_')));
      hookEnv.CONNECT_HOME = home;
      for (const source of ['startup', 'resume', 'new']) {
        const sessionId = `copilot-${source}-check`;
        const hook = spawnSync(process.execPath, [path.join(output, 'copilot', 'session-start.mjs')], {
          cwd: root,
          env: hookEnv,
          input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: sessionId, source }),
          encoding: 'utf8',
          timeout: 20_000,
          windowsHide: true,
        });
        expect(hook.status, `${source}: ${hook.stderr}`).toBe(0);
        const injected = JSON.parse(hook.stdout);
        expect(injected.additionalContext).toContain('Connect — sessao iniciada');
        expect(injected.additionalContext).toContain('configuracao necessaria');
        expect(fs.existsSync(path.join(home, 'sessions', sessionId))).toBe(true);
      }
      expect(manifest.version)
        .toBe(JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'connect', '.claude-plugin', 'plugin.json'), 'utf8')).version);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
