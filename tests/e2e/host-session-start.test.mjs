import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const plugin = path.join(root, 'plugins', 'connect');

function runHook(script, payload, home) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('CONNECT_')));
  env.CONNECT_HOME = home;
  return spawnSync(process.execPath, [path.join(plugin, 'hooks', script)], {
    cwd: root,
    env,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  });
}

describe('host session-start adapters', () => {
  it('emits host-native Codex and Antigravity context from the shared bootstrap', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-host-hooks-'));
    const codexHome = path.join(temp, 'codex-data');
    const antigravityHome = path.join(temp, 'antigravity-data');
    try {
      const codex = runHook('session-start-codex.mjs', { session_id: 'codex-session-check' }, codexHome);
      expect(codex.status, codex.stderr).toBe(0);
      const codexResult = JSON.parse(codex.stdout);
      expect(codexResult.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(codexResult.hookSpecificOutput.additionalContext).toContain('Connect');

      const antigravity = runHook('session-start-antigravity.mjs', { conversationId: 'antigravity-session-check' }, antigravityHome);
      expect(antigravity.status, antigravity.stderr).toBe(0);
      const result = JSON.parse(antigravity.stdout);
      expect(result.injectSteps[0].systemMessage.systemMessage).toContain('Connect');
      expect(fs.existsSync(path.join(codexHome, 'sessions', 'codex-session-check'))).toBe(true);
      expect(fs.existsSync(path.join(antigravityHome, 'sessions', 'antigravity-session-check'))).toBe(true);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
