// Contexto que cabe no host mais apertado (medido no Copilot em 12-13/11):
// mapa do Delivery Hub, JSON compacto para cliente que le o texto, carta de processo
// sem historico e as skills do Connect listadas no bloco de sessao.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerMapa, TETO_MAPA } from '../../plugins/connect/lib/resolver.mjs';
import { clienteLeTexto, compactarParaTexto } from '../../plugins/connect/lib/entrega.mjs';
import { semHistorico, SKILLS_DO_CONNECT, renderResolucao, renderContextoCurto } from '../../plugins/connect/lib/render.mjs';
import { idsDoVinculo, coletivosDaPista, resumoDosVinculos } from '../../plugins/connect/lib/vinculo.mjs';
import { publicarGovernanca } from '../../plugins/connect/lib/governanca.mjs';
import { montarL1 } from '../../plugins/connect/lib/matriz.mjs';
import { ARQUIVO_REGRAS_COPILOT, textoRegrasSempreAtivas } from '../../plugins/connect/lib/regras.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function manifesto(corpo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-'));
  const f = path.join(dir, 'hub.md');
  fs.writeFileSync(f, `---\ntipo: delivery-hub\nclasse: diretorio\nexterno: true\n---\n\n# Hub\n\n${corpo}`);
  return f;
}

describe('mapa do diretorio de output', () => {
  it('le a secao ## Mapa do corpo do manifesto, ate a proxima secao', () => {
    const f = manifesto('Intro.\n\n## Mapa\n\n- `{frente}/{card} - {titulo}/`\n- diario: `{card} - Diario de execucao.md`\n\n## Historico\n\nnao entra\n');
    expect(lerMapa(f)).toBe('- `{frente}/{card} - {titulo}/`\n- diario: `{card} - Diario de execucao.md`');
  });

  it('aceita ## Estrutura interna, o nome que os manifestos de Delivery Hub ja usavam', () => {
    expect(lerMapa(manifesto('## Estrutura interna\n\n- pasta por card\n\n## Histórico\n\nx\n'))).toBe('- pasta por card');
  });

  it('sem secao ## Mapa devolve null', () => {
    expect(lerMapa(manifesto('So texto.\n'))).toBeNull();
  });

  it('corta mapa grande no teto', () => {
    const m = lerMapa(manifesto(`## Mapa\n\n${'x'.repeat(TETO_MAPA + 500)}\n`));
    expect(m.length).toBeLessThan(TETO_MAPA + 120);
    expect(m).toMatch(/mapa cortado/);
  });

  it('o render do diretorio mostra o mapa, ou manda perguntar quando nao ha', () => {
    const base = { status: 'resolvido', classe: 'diretorio', conceito: 'x-delivery-hub', caminhoRelativo: './x-delivery-hub', tipo: 'delivery-hub' };
    expect(renderResolucao({ ...base, mapa: '- pasta do card' })).toMatch(/### Mapa de `\.\/x-delivery-hub`[\s\S]*- pasta do card/);
    expect(renderResolucao({ ...base, mapa: null })).toMatch(/nao declara `## Mapa`[\s\S]*nunca invente/);
  });
});

describe('canal da resposta por cliente MCP', () => {
  it('Claude (Cowork) recebe os dois canais; outros clientes, so o texto inteiro', () => {
    expect(clienteLeTexto('claude-ai', {})).toBe(false);
    expect(clienteLeTexto('Visual Studio Code', {})).toBe(true);
    expect(clienteLeTexto('github-copilot', {})).toBe(true);
    expect(clienteLeTexto(null, {})).toBe(false);
    expect(clienteLeTexto('Visual Studio Code', { CONNECT_MCP_CANAL: 'ambos' })).toBe(false);
    expect(clienteLeTexto('claude-ai', { CONNECT_MCP_CANAL: 'texto' })).toBe(true);
  });

  it('o JSON compacto troca texto longo por marcador e mantem a estrutura', () => {
    const r = { status: 'resolvido', alias: 'iu', l1: { carta: { inline: 'c'.repeat(5000), presente: true } }, avisos: ['curto'] };
    const c = compactarParaTexto(r);
    expect(c.status).toBe('resolvido');
    expect(c.l1.carta.presente).toBe(true);
    expect(c.l1.carta.inline).toMatch(/^<no texto desta resposta \(5000 caracteres\)>$/);
    expect(c.avisos).toEqual(['curto']);
    expect(JSON.stringify(c).length).toBeLessThan(400);
  });
});

describe('carta de processo injetada', () => {
  it('sai sem a secao Historico e mantem o resto', () => {
    const carta = '# Carta\n\n## Alcance\n\nx\n\n## Histórico\n\n| Data | O que |\n|---|---|\n| 2026 | y |\n\n<!-- fim -->\n';
    const t = semHistorico(carta);
    expect(t).toMatch(/## Alcance/);
    expect(t).not.toMatch(/Histórico/);
    expect(t).toMatch(/<!-- fim -->/);
  });
});

describe('vinculos do operador: IDs e pista', () => {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'vinculos-'));
  const casa = (c) => path.join(perfil, '_cerebro', 'vinculos', c);
  fs.mkdirSync(casa('cliente-x'), { recursive: true });
  fs.mkdirSync(casa('cliente-y'), { recursive: true });
  fs.writeFileSync(path.join(casa('cliente-x'), 'estado.md'), '---\natualizado: 2026-11-13\n---\n| Card 149073 — permissoes | ok |\n| PR 15236 | aberto |\n| 978 pares, 2026-11-09, valor 12.34567 |\n| 145215, 146127 Active |\n');
  fs.writeFileSync(path.join(casa('cliente-y'), 'config.md'), '- frente: card 555123\n');

  it('extrai os IDs registrados (5 a 7 digitos), sem data nem numero curto', () => {
    expect(idsDoVinculo(perfil, 'cliente-x')).toEqual(['145215', '146127', '149073', '15236']);
  });

  it('a pista aponta o coletivo que registra o ID', () => {
    expect(coletivosDaPista(perfil, 'card 149073')).toEqual(['cliente-x']);
    expect(coletivosDaPista(perfil, '555123')).toEqual(['cliente-y']);
    expect(coletivosDaPista(perfil, '000000')).toEqual([]);
  });

  it('o bloco de sessao fora do Cowork lista os vinculos e manda usar a pista', () => {
    const report = { matrizConfigurada: true, workspace: '/ws', vinculosResumo: resumoDosVinculos(perfil), avisos: [] };
    const texto = renderContextoCurto(report, { host: 'copilot', acesso: 'lembrete' });
    expect(texto).toMatch(/### Seus vinculos/);
    expect(texto).toMatch(/`cliente-x` — IDs registrados: 145215, 146127, 149073, 15236/);
    expect(texto).toMatch(/pista: "<ID>"/);
    expect(renderContextoCurto(report, { host: 'claude' })).not.toMatch(/### Seus vinculos/);
  });
});

describe('governanca: AGENTS.md espelho do CLAUDE.md', () => {
  it('publica os dois com o mesmo texto e o marcador', () => {
    const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-'));
    const r = publicarGovernanca(vault, { vault: 'matriz', agora: new Date('2026-01-01T00:00:00Z') });
    expect(r.status).toBe('publicado');
    expect(r.espelho.status).toBe('publicado');
    const claude = fs.readFileSync(path.join(vault, 'CLAUDE.md'), 'utf8');
    expect(fs.readFileSync(path.join(vault, 'AGENTS.md'), 'utf8')).toBe(claude);
    expect(claude).toMatch(/CNCT-GOV-matriz/);
    expect(publicarGovernanca(vault, { vault: 'matriz', agora: new Date('2026-02-01T00:00:00Z') }).espelho.status).toBe('inalterado');
  });

  it('montar um vault ja governado cria o espelho que falta, copiando o CLAUDE.md como esta', () => {
    const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-'));
    publicarGovernanca(vault, { vault: 'matriz' });
    fs.rmSync(path.join(vault, 'AGENTS.md'));
    const l1 = montarL1(vault, 'matriz');
    expect(l1.governanca.espelho.status).toBe('publicado');
    expect(fs.readFileSync(path.join(vault, 'AGENTS.md'), 'utf8')).toBe(fs.readFileSync(path.join(vault, 'CLAUDE.md'), 'utf8'));
    expect(montarL1(vault, 'matriz').governanca.espelho.status).toBe('inalterado');
  });

  it('nunca sobrescreve um AGENTS.md alheio (sem marcador do Connect)', () => {
    const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-'));
    fs.writeFileSync(path.join(vault, 'AGENTS.md'), '# instrucoes de outro time\n');
    const r = publicarGovernanca(vault, { vault: 'matriz' });
    expect(r.status).toBe('publicado');
    expect(r.espelho.status).toBe('recusado');
    expect(fs.readFileSync(path.join(vault, 'AGENTS.md'), 'utf8')).toBe('# instrucoes de outro time\n');
  });
});

describe('regras sempre ativas no Copilot', () => {
  it('o arquivo do plugin do Copilot existe e e igual ao gerado de lib/regras.mjs', () => {
    const f = path.join(RAIZ, 'plugins', 'connect', ARQUIVO_REGRAS_COPILOT);
    expect(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).toBe(textoRegrasSempreAtivas());
    expect(textoRegrasSempreAtivas()).toMatch(/_cerebro\/camada-1\.md/);
  });
});

describe('skills do Connect no bloco de sessao fora do Cowork', () => {
  it('a lista bate com as skills do pacote', () => {
    const noPacote = fs.readdirSync(path.join(RAIZ, 'plugins', 'connect', 'skills'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(SKILLS_DO_CONNECT.map(([n]) => n).sort()).toEqual(noPacote);
  });
});
