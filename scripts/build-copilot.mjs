#!/usr/bin/env node
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
    return !/(^|\/)(\.claude-plugin|\.codex-plugin|\.antigravity-plugin|bin|sessions|scripts)(\/|$)/.test(relative)
      && relative !== 'hooks'
      && !relative.startsWith('hooks/')
      && !/(^|\/)(\.mcp\.json|mcp_config\.json|hooks\.json|connect\.config\.json)$/.test(relative)
      && !/(^|\/)launcher\.bat$/.test(relative);
  },
});

fs.copyFileSync(path.join(root, 'templates', 'copilot', 'README.md'), path.join(output, 'README.md'));

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

process.stdout.write(`Copilot Agent Plugin created: ${output}\n`);
