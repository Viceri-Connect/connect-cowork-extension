import { describe, it, expect } from 'vitest';
import {
  extrairFrontmatter, parseFrontmatter, estimarTokens, BYTES_POR_TOKEN,
} from '../../plugins/connect/lib/frontmatter.mjs';

describe('extrairFrontmatter', () => {
  it('separa o bloco do corpo', () => {
    const r = extrairFrontmatter('---\na: 1\n---\n# titulo\n');
    expect(r.presente).toBe(true);
    expect(r.bruto).toBe('a: 1');
    expect(r.corpo).toBe('# titulo\n');
  });

  it('--- no meio do documento e regra horizontal, nao frontmatter', () => {
    const r = extrairFrontmatter('# titulo\n\n---\n\ntexto\n');
    expect(r.presente).toBe(false);
  });

  it('abertura sem fechamento nao consome o documento', () => {
    const md = '---\na: 1\n# sem fechar\n';
    const r = extrairFrontmatter(md);
    expect(r.presente).toBe(false);
    expect(r.corpo).toBe(md);
  });

  it('tolera BOM, linhas em branco iniciais e CRLF', () => {
    const r = extrairFrontmatter('\uFEFF\r\n---\r\na: 1\r\n---\r\ncorpo');
    expect(r.presente).toBe(true);
    expect(r.bruto).toBe('a: 1');
  });

  it('nunca lanca com entrada vazia ou nula', () => {
    expect(extrairFrontmatter(null).presente).toBe(false);
    expect(extrairFrontmatter(undefined).presente).toBe(false);
    expect(extrairFrontmatter('').presente).toBe(false);
  });
});

describe('parseFrontmatter', () => {
  it('le escalares, removendo aspas e comentarios', () => {
    const fm = parseFrontmatter('---\ntipo: cliente\nnome: "Viceri"  # comentario\n---\n');
    expect(fm).toEqual({ tipo: 'cliente', nome: 'Viceri' });
  });

  it('le lista inline', () => {
    expect(parseFrontmatter('---\ntags: [a, b, "c"]\n---\n').tags).toEqual(['a', 'b', 'c']);
  });

  it('le lista de bloco', () => {
    expect(parseFrontmatter('---\ntags:\n  - a\n  - b\n---\n').tags).toEqual(['a', 'b']);
  });

  it('le lista de objetos (alcance)', () => {
    const fm = parseFrontmatter(
      '---\nalcance:\n  - casa: clientes\n    grau: listavel\n  - casa: produtos\n    filtros: [tipo, externo]\n---\n',
    );
    expect(fm.alcance).toEqual([
      { casa: 'clientes', grau: 'listavel' },
      { casa: 'produtos', filtros: ['tipo', 'externo'] },
    ]);
  });

  it('sem frontmatter devolve objeto vazio', () => {
    expect(parseFrontmatter('# so corpo')).toEqual({});
  });

  it('nunca lanca com lixo', () => {
    expect(() => parseFrontmatter('---\n:::\n  - ???\n---\n')).not.toThrow();
  });
});

describe('estimarTokens', () => {
  it('usa ~4 bytes por token', () => {
    expect(BYTES_POR_TOKEN).toBe(4);
    expect(estimarTokens('a'.repeat(40))).toBe(10);
  });

  it('conta bytes UTF-8, nao caracteres', () => {
    expect(estimarTokens('ã'.repeat(4))).toBe(2); // 8 bytes
  });

  it('vazio vale zero', () => {
    expect(estimarTokens('')).toBe(0);
    expect(estimarTokens(null)).toBe(0);
  });
});