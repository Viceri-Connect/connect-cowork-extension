#!/usr/bin/env node
// Gera plugins/connect-http (variante com MCP em Streamable HTTP local) a partir de
// plugins/connect. So o que e de TRANSPORTE muda: manifests de identidade e as configs de
// MCP de cada host. Hooks, skills, lib/ e o runtime portatil (scripts/) sao os mesmos do
// pacote stdio — 0.41.0: os hooks de todos os hosts sobem pelo Node portatil
// (scripts/run-node.*), entao scripts/ deixa de ser filtrado e nada de hook e regerado.
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
    return !/(^|\/)(\.claude-plugin|bin|sessions)(\/|$)/.test(relative)
      && !/(^|\/)(\.mcp\.json|connect\.config\.json)$/.test(relative)
      && !/(^|\/)(launcher\.bat|spike-junction\.ps1)$/.test(relative);
  },
});

const DESCRICAO = 'Connect knowledge, session, and governance tools through a local HTTP MCP server.';
const URL_MCP = 'http://127.0.0.1:3737/mcp';
const gravar = (relativo, valor) => fs.writeFileSync(path.join(output, relativo), `${JSON.stringify(valor, null, 2)}\n`);

const manifest = JSON.parse(fs.readFileSync(path.join(source, 'plugin.json'), 'utf8'));
manifest.name = 'connect-http';
manifest.description = DESCRICAO;
const openai = manifest.extensions?.['com.openai'];
if (openai?.interface) {
  openai.interface.displayName = 'Connect HTTP (Local)';
  openai.interface.shortDescription = 'Connect over a loopback-only HTTP MCP endpoint';
}
gravar('plugin.json', manifest);

gravar('mcp.json', {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  mcpServers: { connect: { type: 'streamable-http', url: URL_MCP } },
});
gravar('mcp_config.json', { mcpServers: { connect: { serverUrl: URL_MCP } } });

fs.mkdirSync(path.join(output, '.claude-plugin'), { recursive: true });
gravar(path.join('.claude-plugin', 'plugin.json'), {
  name: 'connect-http',
  version: manifest.version,
  description: DESCRICAO,
  author: manifest.author,
  mcpServers: './.mcp.json',
});
gravar('.mcp.json', { mcpServers: { connect: { type: 'http', url: URL_MCP } } });

const codexOverlayPath = path.join('.codex-plugin', 'plugin.json');
const codexOverlay = JSON.parse(fs.readFileSync(path.join(output, codexOverlayPath), 'utf8'));
codexOverlay.name = 'connect-http';
if (codexOverlay.interface) codexOverlay.interface.displayName = 'Connect HTTP (Local)';
gravar(codexOverlayPath, codexOverlay);

const antigravityPath = path.join('.antigravity-plugin', 'plugin.json');
const antigravity = JSON.parse(fs.readFileSync(path.join(output, antigravityPath), 'utf8'));
antigravity.name = 'connect-http';
antigravity.displayName = 'Connect HTTP (Local)';
antigravity.description = 'Connect knowledge, session, and governance workflows through local HTTP MCP.';
gravar(antigravityPath, antigravity);

fs.writeFileSync(path.join(output, 'README.md'), `# Connect HTTP (Local)

This package uses the same Connect skills, hooks, and MCP tools as the stdio plugin, over a loopback-only Streamable HTTP endpoint.

Start the server and keep it running. The launcher provisions the same portable Node runtime as Cowork, so Node on PATH is not required:

\`\`\`
plugins/connect-http/scripts/connect-mcp --transport=http --port=3737        # macOS/Linux
plugins\\connect-http\\scripts\\connect-mcp.cmd --transport=http --port=3737   # Windows
\`\`\`

The endpoint is \`${URL_MCP}\`. The server binds only to localhost and rejects non-local Host and Origin headers. Set \`CONNECT_HOME\` before starting it if the default Connect data directory is not the one you want.

Use this marketplace option only when the agent host cannot launch a stdio MCP server. Do not install both Connect transport variants in the same host session, because they expose the same tools.
`);

process.stdout.write(`Connect HTTP plugin created: ${output}\n`);
