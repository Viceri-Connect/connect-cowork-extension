// tests/unit/render-hosts.test.mjs
// 0.41.0 — o bloco injetado fala a lingua de cada host. Fora do Cowork nao existe
// "pasta conectada ao projeto": mandar o agente procurar o marcador de governanca no
// proprio contexto, ou conectar a pasta ao projeto Cowork, e instrucao impossivel. Ali o
// bloco entrega os caminhos completos (governanca e carta) dentro do workspace da sessao.

import { describe, expect, it } from 'vitest';
import { renderContextoCurto } from '../../plugins/connect/lib/render.mjs';

const WS = '/home/op/Connect/sessions/s1';
const report = {
  workspace: WS,
  identidade: { nome: 'Operadora' },
  mounts: [{ alias: 'matriz', source: '/onedrive/Matriz', kind: 'symlink', status: 'mounted' }],
  matrizConfigurada: true,
  operadorProvisionado: false,
  l1: { governanca: { estado: 'governado', marcador: { vault: 'matriz' } } },
  concessao: { necessaria: true, caminho: '/home/op/Connect', origens: [{ alias: './matriz', caminho: '/onedrive/Matriz' }] },
  avisos: [],
};

describe('bloco injetado por host', () => {
  it('Cowork: canal da pasta conectada, como sempre', () => {
    const t = renderContextoCurto(report, { host: 'claude' });
    expect(t).toMatch(/conectada ao projeto Cowork/);
    expect(t).toContain('acesso de pasta (faca isto primeiro)');
  });

  it.each(['codex', 'copilot', 'antigravity'])('%s: nada de Cowork, caminhos completos no workspace da sessao', (host) => {
    for (const acesso of ['completo', 'lembrete']) {
      const t = renderContextoCurto(report, { host, acesso });
      expect(t, `${host}/${acesso}`).not.toMatch(/Cowork/);
      expect(t).toContain(`${WS}/matriz/CLAUDE.md`);
      expect(t).toContain(`${WS}/matriz/_cerebro/camada-1.md`);
      // O fluxo de nascimento do operador continua igual em todo host.
      expect(t).toContain('perfil do operador nao provisionado');
      expect(t).toContain('cnct-fabrica-operador');
    }
  });
});
