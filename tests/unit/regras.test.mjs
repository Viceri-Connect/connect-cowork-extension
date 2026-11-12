import { describe, it, expect } from 'vitest';
import { REGRAS_DURAS } from '../../plugins/connect/lib/regras.mjs';

describe('REGRAS_DURAS (fonte unica)', () => {
  it('sao numeradas em sequencia, porque skills as citam por numero', () => {
    REGRAS_DURAS.forEach((r, i) => expect(r.startsWith(`${i + 1}. `)).toBe(true));
  });

  it('nao ha regra duplicada', () => {
    expect(new Set(REGRAS_DURAS).size).toBe(REGRAS_DURAS.length);
  });
});