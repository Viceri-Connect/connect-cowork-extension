// tests/integration/runtime-sandbox.test.mjs
// 0.41.0 — host em SANDBOX: sem escrita no CONNECT_HOME, o runtime portatil
// (scripts/run-node.*) usa a pasta de dados que o host da ao plugin (PLUGIN_DATA,
// COPILOT_PLUGIN_DATA, CLAUDE_PLUGIN_DATA) em vez de cair no `node` do PATH.
//
// "Sem escrita" e simulado apontando o CONNECT_HOME para um ARQUIVO: `{home}/bin` nao
// pode ser criado, em qualquer SO, sem depender de ACL ou de chmod.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = path.join(RAIZ, 'plugins', 'connect', 'scripts');
const WIN = process.platform === 'win32';

function rodar(env, script) {
  const base = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !k.startsWith('CONNECT_') && !/^(CLAUDE_CODE_REMOTE|PLUGIN_DATA|COPILOT_PLUGIN_DATA|CLAUDE_PLUGIN_DATA)$/.test(k)));
  const opcoes = { env: { ...base, ...env }, encoding: 'utf8', timeout: 60_000, windowsHide: true };
  return WIN
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${path.join(SCRIPTS, 'run-node.bat')}" "${script}""`], { ...opcoes, windowsVerbatimArguments: true })
    : spawnSync('/bin/sh', [path.join(SCRIPTS, 'run-node.sh'), script], opcoes);
}

describe('runtime portatil em sandbox', () => {
  it.each(['PLUGIN_DATA', 'COPILOT_PLUGIN_DATA', 'CLAUDE_PLUGIN_DATA'])('sem escrita no CONNECT_HOME, usa %s', (variavel) => {
    fs.mkdirSync(path.join(RAIZ, '.test-tmp'), { recursive: true });
    const raiz = fs.mkdtempSync(path.join(RAIZ, '.test-tmp', 'runtime-sandbox-'));
    try {
      const homeSemEscrita = path.join(raiz, 'nao-e-pasta');
      fs.writeFileSync(homeSemEscrita, '');
      const dados = path.join(raiz, 'dados-do-host');
      const node = path.join(dados, 'bin', WIN ? 'node.exe' : 'node');
      fs.mkdirSync(path.dirname(node), { recursive: true });
      try { fs.linkSync(process.execPath, node); } catch { fs.copyFileSync(process.execPath, node); fs.chmodSync(node, 0o755); }
      const script = path.join(raiz, 'qual-node.mjs');
      fs.writeFileSync(script, 'process.stdout.write(process.execPath)\n');

      const r = rodar({ CONNECT_HOME: homeSemEscrita, [variavel]: dados }, script);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).not.toMatch(/node do PATH/);
      expect(path.resolve(r.stdout.trim()).toLowerCase()).toBe(path.resolve(node).toLowerCase());
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
