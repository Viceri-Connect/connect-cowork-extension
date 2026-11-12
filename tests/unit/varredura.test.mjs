// tests/unit/varredura.test.mjs — guarda de varredura (lib/varredura.mjs), regra dura 4.
import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { alvoNoVault, ehVarreduraNoShell, raizesDoConnect } from '../../plugins/connect/lib/varredura.mjs';

describe('ehVarreduraNoShell', () => {
  it.each([
    'rg -n TODO .',
    'grep -rn "x" vault/',
    'find . -name "*.md"',
    'cd x && fd camada',
    'Get-ChildItem -Recurse -Filter *.md',
    'dir /s *.md',
    'ls -R',
    'Select-String -Path *.md -Pattern x',
    'findstr /s x *.md',
  ])('reconhece busca: %s', (c) => expect(ehVarreduraNoShell(c)).toBe(true));

  it.each([
    'npm test',
    'ls',
    'dir',
    'git status',
    'cat _cerebro/camada-1.md',
    'node scripts/build.mjs --find-me',
    'echo grepping',
  ])('nao e busca: %s', (c) => expect(ehVarreduraNoShell(c)).toBe(false));
});

describe('alvoNoVault', () => {
  const home = path.join(os.tmpdir(), 'connect-home-guarda');
  const matriz = path.join(os.tmpdir(), 'Matriz Coletiva');
  const raizes = raizesDoConnect({ home, vaultMatriz: matriz, subVaults: { cliente: path.join(os.tmpdir(), 'cliente-x'), legado: { caminho: path.join(os.tmpdir(), 'legado') } } });

  it('acha o vault citado no comando, com ou sem barra invertida', () => {
    expect(alvoNoVault({ comando: `rg x "${matriz}"` }, raizes)?.rotulo).toBe('matriz');
    expect(alvoNoVault({ comando: `rg x "${matriz.replaceAll('/', '\\')}\\projetos"` }, raizes)?.rotulo).toBe('matriz');
  });

  it('acha o vault pelo caminho da ferramenta, inclusive relativo ao cwd', () => {
    expect(alvoNoVault({ caminhos: [path.join(os.tmpdir(), 'cliente-x', 'docs')] }, raizes)?.rotulo).toBe('sub-vault cliente');
    expect(alvoNoVault({ caminhos: ['docs'], cwd: path.join(os.tmpdir(), 'legado') }, raizes)?.rotulo).toBe('sub-vault legado');
  });

  it('acha atalho do workspace de sessao', () => {
    expect(alvoNoVault({ comando: 'grep -r x ./matriz/projetos' }, raizes)?.rotulo).toBe('matriz');
    expect(alvoNoVault({ caminhos: [path.join(home, 'sessions', 'abc', 'matriz')] }, raizes)?.rotulo).toBe('workspace de sessao');
  });

  it('fora do vault nao decide nada', () => {
    expect(alvoNoVault({ comando: 'rg x src/' , cwd: os.tmpdir() }, raizes)).toBeNull();
    expect(alvoNoVault({ caminhos: [path.join(os.tmpdir(), 'Matriz Coletiva-backup')] }, raizes)).toBeNull();
    expect(alvoNoVault({ comando: 'grep -r x docs/matriz' }, raizes)).toBeNull();
  });
});
