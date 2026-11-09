#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'plugins', 'connect');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'connect-http'));

if (output === source || output.startsWith(`${source}${path.sep}`)) {
  throw new Error('Output directory cannot be inside the source plugin.');
}
if (fs.existsSync(output)) {
  throw new Error(`Output already exists: ${output}. Use a new directory to rebuild.`);
}

fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, output, {
  recursive: true,
  filter(file) {
    const relative = path.relative(source, file).replaceAll('\\', '/');
    return !/(^|\/)(\.claude-plugin|bin|sessions|scripts)(\/|$)/.test(relative)
      && !/(^|\/)(\.mcp\.json|connect\.config\.json)$/.test(relative)
      && !/(^|\/)launcher\.bat$/.test(relative);
  },
});

const manifest = JSON.parse(fs.readFileSync(path.join(source, 'plugin.json'), 'utf8'));
manifest.name = 'connect-http';
manifest.description = 'Connect knowledge, session, and governance tools through a local HTTP MCP server.';
fs.writeFileSync(path.join(output, 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);

fs.writeFileSync(path.join(output, 'mcp.json'), `${JSON.stringify({
  $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  mcpServers: {
    connect: {
      type: 'streamable-http',
      url: 'http://127.0.0.1:3737/mcp',
    },
  },
}, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'mcp_config.json'), `${JSON.stringify({
  mcpServers: {
    connect: {
      serverUrl: 'http://127.0.0.1:3737/mcp',
    },
  },
}, null, 2)}\n`);

const copilotHooks = {
  version: 1,
  hooks: {
    sessionStart: [{
      type: 'command',
      command: 'node "${PLUGIN_ROOT}/copilot/session-start.mjs"',
      timeoutSec: 30,
    }],
  },
};
const copilotHooksPath = path.join(output, 'com.github.copilot', 'hooks', 'hooks.json');
fs.mkdirSync(path.dirname(copilotHooksPath), { recursive: true });
fs.writeFileSync(copilotHooksPath, `${JSON.stringify(copilotHooks, null, 2)}\n`);

const claudePlugin = {
  name: 'connect-http',
  version: manifest.version,
  description: manifest.description,
  author: manifest.author,
  mcpServers: './.mcp.json',
};
fs.mkdirSync(path.join(output, '.claude-plugin'), { recursive: true });
fs.writeFileSync(path.join(output, '.claude-plugin', 'plugin.json'), `${JSON.stringify(claudePlugin, null, 2)}\n`);
fs.writeFileSync(path.join(output, '.mcp.json'), `${JSON.stringify({
  mcpServers: {
    connect: {
      type: 'http',
      url: 'http://127.0.0.1:3737/mcp',
    },
  },
}, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'hooks', 'hooks.json'), `${JSON.stringify({
  description: 'Connect session bootstrap hook.',
  hooks: {
    SessionStart: [{
      matcher: 'startup|resume|fork',
      // Exec form (command + args), como o hook do pacote stdio desde a 0.39.0: shell form
      // no Windows sem Git Bash cai no PowerShell, que imprime a linha em vez de executar.
      hooks: [{
        type: 'command',
        command: 'node',
        args: ['${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs'],
        timeout: 20,
      }],
    }],
  },
}, null, 2)}\n`);

const codexOverlayPath = path.join(output, '.codex-plugin', 'plugin.json');
const codexOverlay = JSON.parse(fs.readFileSync(codexOverlayPath, 'utf8'));
codexOverlay.name = 'connect-http';
fs.writeFileSync(codexOverlayPath, `${JSON.stringify(codexOverlay, null, 2)}\n`);

const antigravityPath = path.join(output, '.antigravity-plugin', 'plugin.json');
const antigravity = JSON.parse(fs.readFileSync(antigravityPath, 'utf8'));
antigravity.name = 'connect-http';
antigravity.displayName = 'Connect HTTP (Local)';
antigravity.description = 'Connect knowledge, session, and governance workflows through local HTTP MCP.';
fs.writeFileSync(antigravityPath, `${JSON.stringify(antigravity, null, 2)}\n`);

fs.writeFileSync(path.join(output, 'README.md'), `# Connect HTTP (Local)\n\nThis package uses the same Connect skills and MCP tools as the stdio plugin, over a loopback-only Streamable HTTP endpoint.\n\nStart the server from the repository root and keep it running:\n\n\`\`\`powershell\nnode plugins/connect-http/mcp/connect-mcp.mjs --transport=http --port=3737\n\`\`\`\n\nThe endpoint is \`http://127.0.0.1:3737/mcp\`. The server binds only to localhost and rejects non-local Host and Origin headers. Set \`CONNECT_HOME\` before starting it if the default Connect data directory is not the one you want.\n\nUse this marketplace option only when the agent host cannot launch a stdio MCP server. Do not install both Connect transport variants in the same host session, because they expose the same tools.\n`);

process.stdout.write(`Connect HTTP plugin created: ${output}\n`);