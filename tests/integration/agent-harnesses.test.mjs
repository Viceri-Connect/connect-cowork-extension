import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../../plugins/connect/lib/frontmatter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const plugin = path.join(root, 'plugins', 'connect');

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
    // 0.41.0: o MCP sobe pelo runtime portatil (launcher), nunca por `node` do PATH.
    expect(portableMcp.mcpServers.connect.command).toBe('./scripts/connect-mcp');

    const codexOverlay = JSON.parse(fs.readFileSync(path.join(plugin, '.codex-plugin', 'plugin.json'), 'utf8'));
    expect(codexOverlay.name).toBe('connect');
    const codexHooks = JSON.parse(fs.readFileSync(path.join(plugin, 'hooks', 'codex-hooks.json'), 'utf8'));
    expect(codexHooks.hooks.SessionStart[0].matcher).toBe('startup|resume|clear|compact|fork');
    expect(codexHooks.hooks.SessionStart[0].hooks[0].command).toContain('session-start-codex.mjs');

    const antigravity = JSON.parse(fs.readFileSync(path.join(plugin, '.antigravity-plugin', 'plugin.json'), 'utf8'));
    expect(antigravity.$schema).toBe('https://antigravity.google/schemas/v1/plugin.json');
    expect(antigravity.name).toBe('connect');
    const antigravityMcp = JSON.parse(fs.readFileSync(path.join(plugin, 'mcp_config.json'), 'utf8'));
    expect(antigravityMcp.mcpServers.connect.command).toBe('${PLUGIN_ROOT}/scripts/connect-mcp');
    // repos/subVaults sao por maquina: todos os hosts compartilham o home do Cowork.
    expect(JSON.stringify([portableMcp, antigravityMcp])).not.toContain('CONNECT_HOME');
    const antigravityHooks = JSON.parse(fs.readFileSync(path.join(plugin, 'hooks.json'), 'utf8'));
    expect(antigravityHooks['connect-session'].SessionStart[0].command).toContain('session-start-antigravity.mjs');

    const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
    expect(marketplace.plugins[0].source.path).toBe('./plugins/connect');
    expect(marketplace.plugins.map((entry) => entry.name)).toEqual(['connect']);

    const copilotSettings = JSON.parse(fs.readFileSync(path.join(root, '.github', 'copilot', 'settings.json'), 'utf8'));
    expect(copilotSettings.extraKnownMarketplaces[0].name).toBe('impulsa');
    expect(copilotSettings.enabledPlugins).toEqual(['connect@impulsa']);

    const claudeMarketplace = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
    expect(claudeMarketplace.plugins.map((entry) => entry.name)).toEqual(['connect']);
    for (const entry of claudeMarketplace.plugins) {
      const source = path.join(root, entry.source);
      expect(fs.existsSync(path.join(source, '.claude-plugin', 'plugin.json'))).toBe(true);
    }
  });
});
