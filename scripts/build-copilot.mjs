#!/usr/bin/env node
// Gera o bundle instalavel do Copilot (Agent Plugins) a partir de plugins/connect.
//
// 0.41.0 — o bundle leva scripts/ (runtime portatil: run-node.* e connect-mcp), porque
// o MCP e o hook do Copilot passam a subir pelo mesmo Node portatil do Cowork em vez de
// exigir `node` no PATH. O hooks.json do Copilot vem do pacote
// (com.github.copilot/hooks/hooks.json) — fonte unica, nada e regerado aqui.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins', 'connect');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'copilot'));

if (output === plugin || output.startsWith(`${plugin}${path.sep}`)) {
  throw new Error('Output directory cannot be inside the source plugin.');
}
if (fs.existsSync(output)) {
  throw new Error(`Output directory already exists: ${output}. Remove the generated directory before rebuilding.`);
}

fs.mkdirSync(output, { recursive: true });
fs.cpSync(plugin, output, {
  recursive: true,
  filter(source) {
    const relative = path.relative(plugin, source).replaceAll('\\', '/');
    return !/(^|\/)(\.claude-plugin|\.codex-plugin|\.antigravity-plugin|bin|sessions|rules)(\/|$)/.test(relative)
      && !/^hooks\/[^/]+\.json$/.test(relative)
      && !/(^|\/)(\.mcp\.json|mcp_config\.json|hooks\.json|connect\.config\.json)$/.test(relative)
      && !/(^|\/)(launcher\.bat|spike-junction\.ps1)$/.test(relative);
  },
});
// hooks.json na raiz e do Antigravity e foi filtrado acima; o do Copilot mora em
// com.github.copilot/hooks/ e precisa voltar (o filtro acima casa qualquer hooks.json).
const copilotHooks = path.join('com.github.copilot', 'hooks', 'hooks.json');
fs.mkdirSync(path.dirname(path.join(output, copilotHooks)), { recursive: true });
fs.copyFileSync(path.join(plugin, copilotHooks), path.join(output, copilotHooks));

fs.copyFileSync(path.join(root, 'templates', 'copilot', 'README.md'), path.join(output, 'README.md'));

process.stdout.write(`Copilot Agent Plugin created: ${output}\n`);
