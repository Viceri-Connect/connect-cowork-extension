import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseFrontmatter } from '../../plugins/connect/lib/frontmatter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const plugin = path.join(root, 'plugins', 'connect');

function listarArquivos(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory()
      ? listarArquivos(path.join(directory, entry.name), relative)
      : [relative];
  }).sort();
}

describe('Codex and Antigravity adapters', () => {
  it('shares portable skills and MCP while declaring native host metadata', () => {
    const skillRoot = path.join(plugin, 'skills');
    const skillDirs = fs.readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(skillDirs.length).toBeGreaterThan(0);
    for (const dir of skillDirs) {
      const skill = fs.readFileSync(path.join(skillRoot, dir.name, 'SKILL.md'), 'utf8');
      const metadata = parseFrontmatter(skill);
      expect(metadata.name, dir.name).toBe(dir.name);
      expect(metadata.description, dir.name).toBeTruthy();
    }

    const portableMcp = JSON.parse(fs.readFileSync(path.join(plugin, 'mcp.json'), 'utf8'));
    expect(portableMcp.mcpServers.connect.type).toBe('stdio');
    expect(portableMcp.mcpServers.connect.args).toEqual(['${PLUGIN_ROOT}/mcp/connect-mcp.mjs']);

    const codexOverlay = JSON.parse(fs.readFileSync(path.join(plugin, '.codex-plugin', 'plugin.json'), 'utf8'));
    expect(codexOverlay.name).toBe('connect');
    const codexHooks = JSON.parse(fs.readFileSync(path.join(plugin, 'hooks', 'codex-hooks.json'), 'utf8'));
    expect(codexHooks.hooks.SessionStart[0].matcher).toBe('startup|resume|clear|compact|fork');
    expect(codexHooks.hooks.SessionStart[0].hooks[0].command).toContain('session-start-codex.mjs');

    const antigravity = JSON.parse(fs.readFileSync(path.join(plugin, '.antigravity-plugin', 'plugin.json'), 'utf8'));
    expect(antigravity.$schema).toBe('https://antigravity.google/schemas/v1/plugin.json');
    expect(antigravity.name).toBe('connect');
    const antigravityMcp = JSON.parse(fs.readFileSync(path.join(plugin, 'mcp_config.json'), 'utf8'));
    expect(antigravityMcp.mcpServers.connect.args).toEqual(['${PLUGIN_ROOT}/mcp/connect-mcp.mjs']);
    // repos/subVaults sao por maquina: todos os hosts compartilham o home do Cowork.
    expect(JSON.stringify([portableMcp, antigravityMcp])).not.toContain('CONNECT_HOME');
    const antigravityHooks = JSON.parse(fs.readFileSync(path.join(plugin, 'hooks.json'), 'utf8'));
    expect(antigravityHooks['connect-session'].SessionStart[0].command).toContain('session-start-antigravity.mjs');

    const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
    expect(marketplace.plugins[0].source.path).toBe('./plugins/connect');
    expect(marketplace.plugins[1].source.path).toBe('./plugins/connect-http');

    const copilotSettings = JSON.parse(fs.readFileSync(path.join(root, '.github', 'copilot', 'settings.json'), 'utf8'));
    expect(copilotSettings.extraKnownMarketplaces[0].name).toBe('impulsa');
    expect(copilotSettings.enabledPlugins).toEqual(['connect@impulsa']);

    const claudeMarketplace = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
    expect(claudeMarketplace.plugins.map((entry) => entry.name)).toEqual(['connect', 'connect-http']);
    for (const entry of claudeMarketplace.plugins) {
      const source = path.join(root, entry.source);
      expect(fs.existsSync(path.join(source, '.claude-plugin', 'plugin.json'))).toBe(true);
    }
  });

  it('builds the HTTP marketplace option with matching host manifests', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-http-build-test-'));
    const output = path.join(temp, 'connect-http');
    try {
      const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-connect-http.mjs'), output], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(build.status, build.stderr).toBe(0);

      const manifest = JSON.parse(fs.readFileSync(path.join(output, 'plugin.json'), 'utf8'));
      const mcp = JSON.parse(fs.readFileSync(path.join(output, 'mcp.json'), 'utf8'));
      const antigravity = JSON.parse(fs.readFileSync(path.join(output, 'mcp_config.json'), 'utf8'));
      const claudeManifest = JSON.parse(fs.readFileSync(path.join(output, '.claude-plugin', 'plugin.json'), 'utf8'));
      const claudeMcp = JSON.parse(fs.readFileSync(path.join(output, '.mcp.json'), 'utf8'));
      const copilotHooks = JSON.parse(fs.readFileSync(path.join(output, 'com.github.copilot', 'hooks', 'hooks.json'), 'utf8'));
      expect(manifest.name).toBe('connect-http');
      expect(mcp.mcpServers.connect).toEqual({
        type: 'streamable-http',
        url: 'http://127.0.0.1:3737/mcp',
      });
      expect(antigravity.mcpServers.connect.serverUrl).toBe('http://127.0.0.1:3737/mcp');
      expect(claudeManifest.name).toBe('connect-http');
      expect(claudeMcp.mcpServers.connect).toEqual({
        type: 'http',
        url: 'http://127.0.0.1:3737/mcp',
      });
      expect(copilotHooks.hooks.sessionStart[0].command).toContain('copilot/session-start.mjs');
      expect(fs.existsSync(path.join(output, 'skills', 'cnct-nucleo-sessao', 'SKILL.md'))).toBe(true);
      expect(fs.readFileSync(path.join(output, 'hooks', 'hooks.json'), 'utf8')).toContain('session-start.mjs');

      const marketplacePackage = path.join(root, 'plugins', 'connect-http');
      const generatedFiles = listarArquivos(output);
      expect(listarArquivos(marketplacePackage)).toEqual(generatedFiles);
      for (const relative of generatedFiles) {
        expect(fs.readFileSync(path.join(marketplacePackage, relative)))
          .toEqual(fs.readFileSync(path.join(output, relative)));
      }
    } finally {
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
