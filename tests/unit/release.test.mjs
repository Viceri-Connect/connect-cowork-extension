// A versao declarada em plugin.json tem de ser a primeira entrada do CHANGELOG.
// O CHANGELOG e o que a sessao de trabalho toca; o manifesto e o que a INSTALACAO le.
// Ja divergiram uma vez (CHANGELOG 0.30.0 x plugin.json 0.29.1) e quem pegou foi o operador.
// Migrado de tests/spike-release.mjs.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const plugin = path.join(RAIZ, 'plugins', 'connect');

const manifesto = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), 'utf8'));
const manifestoAgente = JSON.parse(fs.readFileSync(path.join(plugin, 'plugin.json'), 'utf8'));
const manifestoAntigravity = JSON.parse(fs.readFileSync(path.join(plugin, '.antigravity-plugin', 'plugin.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(plugin, 'CHANGELOG.md'), 'utf8');
const primeira = changelog.match(/^## (\d+\.\d+\.\d+)\b/m)?.[1];

describe('release', () => {
  it('o CHANGELOG tem ao menos uma entrada de versao', () => {
    expect(primeira, 'nenhum cabecalho "## x.y.z" no CHANGELOG').toBeTruthy();
  });

  it('a versao do plugin.json e a primeira entrada do CHANGELOG', () => {
    expect(manifesto.version).toBe(primeira);
  });

  it('os manifests Claude e Agent Plugins compartilham a mesma versao', () => {
    expect(manifestoAgente.version).toBe(manifesto.version);
    expect(manifestoAgente.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  });

  it('o manifest Antigravity acompanha a versao Claude', () => {
    expect(manifestoAntigravity.version).toBe(manifesto.version);
  });

  it('o marketplace aponta para o plugin que existe', () => {
    const mk = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'));
    for (const p of mk.plugins) {
      const destino = path.join(RAIZ, p.source);
      expect(fs.existsSync(path.join(destino, '.claude-plugin', 'plugin.json')), `fonte ${p.source}`).toBe(true);
    }
    expect(mk.plugins.map((p) => p.name)).toEqual(['connect']);
  });
});