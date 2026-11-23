// tests/unit/mcp-anotacoes.test.mjs
// 0.41.0 — toda tool do MCP declara `annotations` (MCP): os hosts usam isso para decidir
// quando pedir aprovacao. Tool nova sem anotacao, ou leitura marcada como escrita (e
// vice-versa), falha aqui.

import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function listarTools() {
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ].map((m) => JSON.stringify(m)).join('\n') + '\n';
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CONNECT_')));
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'plugins', 'connect', 'mcp', 'connect-mcp.mjs')], {
    input, env, encoding: 'utf8', timeout: 20_000, windowsHide: true,
  });
  return r.stdout.trim().split(/\r?\n/).map((l) => JSON.parse(l)).find((m) => m.id === 2).result.tools;
}

const tools = listarTools();
const porNome = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));

describe('anotacoes das tools do MCP', () => {
  it.each(tools.map((t) => t.name))('%s declara todas as dicas', (nome) => {
    const a = porNome[nome];
    expect(a, nome).toBeTruthy();
    expect(typeof a.title).toBe('string');
    for (const dica of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']) {
      expect(typeof a[dica], `${nome}.${dica}`).toBe('boolean');
    }
    if (a.readOnlyHint) expect(a.destructiveHint, `${nome}: leitura nao destroi`).toBe(false);
  });

  it('leitura pura passa sem friccao; o que sobrescreve pede confirmacao', () => {
    for (const nome of ['ambiente_connect', 'estado_sessao', 'listar_repos', 'list_mounts', 'resolver_repo']) {
      expect(porNome[nome].readOnlyHint, nome).toBe(true);
    }
    for (const nome of ['configurar', 'publicar_governanca', 'unmount_junction', 'mount_junction', 'configurar_por_codigo']) {
      expect(porNome[nome].destructiveHint, nome).toBe(true);
    }
    for (const nome of ['sincronizar_subvault', 'configurar_por_codigo']) {
      expect(porNome[nome].openWorldHint, nome).toBe(true);
    }
  });
});
