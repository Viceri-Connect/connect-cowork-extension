// tests/architecture/harnesses.test.mjs
// Testes de ARQUITETURA do marketplace: todo pacote (connect, connect-http) precisa
// entregar, em todo harness (Claude/Cowork, Codex, Antigravity, Copilot), as mesmas
// features — identidade/versao, servidor MCP, hook de SessionStart que de fato injeta o
// bootstrap, skills canonicas — no formato nativo de cada host.
//
// O contrato mora em ./harness-contract.mjs; as verificacoes em ./harness-checks.mjs.
// Qualquer alteracao em arquivo especifico de harness que quebre o contrato falha aqui,
// com a violacao legivel (pacote/harness: o que divergiu).
//
// Diagnostico sem Vitest: `node tests/architecture/harness-checks.mjs`.
//
// As checagens executam hooks e o MCP com spawnSync. Cada teste cede um ciclo do event
// loop antes de rodar: sem isso, uma sequencia longa de testes sincronos (mais lenta no
// Windows) deixa o worker sem responder ao Vitest ("Timeout calling onTaskUpdate").

import { describe, it, expect } from 'vitest';
import { HARNESSES, PACOTES } from './harness-contract.mjs';
import {
  FEATURES, checarInventario, checarLauncherMcp, checarMarketplaces, checarSkills,
} from './harness-checks.mjs';

const pacotes = Object.keys(PACOTES);
const harnesses = Object.keys(HARNESSES);
const ceder = () => new Promise((resolve) => setImmediate(resolve));

describe('arquitetura: marketplace', () => {
  it('todo pacote em plugins/ esta no contrato e listado em todos os marketplaces', async () => {
    await ceder();
    expect(checarMarketplaces()).toEqual([]);
  });
});

describe.each(pacotes)('arquitetura: pacote %s', (pacote) => {
  it('entrega o conjunto canonico de skills', async () => {
    await ceder();
    expect(checarSkills(pacote)).toEqual([]);
  });

  it('nao tem superficie de host sem dono no contrato', async () => {
    await ceder();
    expect(checarInventario(pacote)).toEqual([]);
  });

  it('o launcher do MCP sobe pelo runtime portatil', async () => {
    await ceder();
    expect(checarLauncherMcp(pacote)).toEqual([]);
  });

  describe.each(harnesses)('harness %s', (harness) => {
    it.each(Object.keys(FEATURES))('%s', async (feature) => {
      await ceder();
      expect(FEATURES[feature](pacote, harness)).toEqual([]);
    });
  });
});
