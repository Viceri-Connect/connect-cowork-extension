// tests/e2e/fluxo-card.test.mjs
// SIMULA o caminho de um card: o agente resolve o acervo do cliente e o Delivery Hub
// pelo MCP real (stdio), como o GitHub Copilot (cliente que le o texto) e como o
// Cowork (cliente Claude). Medido em 13/11: no Copilot o `resolver` de um acervo de
// cliente devolvia 46,8 KB e ia para um arquivo fora do contexto, e o Delivery Hub
// voltava so "montado", sem dizer onde gravar.
//
// Orcamentos (contrato-navegacao §9.4, lib/navegacao.mjs): carta local ≤ 1.400 tok,
// carta de processo ≤ 2.000 tok. A resposta ao cliente que le o texto tem de caber no
// que esses orcamentos permitem — carta + processo + moldura — e nao no dobro.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { estimarTokens } from '../../plugins/connect/lib/frontmatter.mjs';
import { ORCAMENTO_TOKENS_DELTA, ORCAMENTO_TOKENS_PROCESSO } from '../../plugins/connect/lib/navegacao.mjs';
import { TETO_MAPA } from '../../plugins/connect/lib/resolver.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVIDOR = path.join(RAIZ, 'plugins', 'connect', 'mcp', 'connect-mcp.mjs');

// Moldura da resposta (titulo, alias, acesso, avisos, resumo JSON): folga fixa.
const MOLDURA_TOKENS = 1000;

let raiz;
let env;

const escrever = (rel, txt) => {
  const p = path.join(raiz, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, txt, 'utf8');
  return p;
};

// Linhas de tabela ate somar ~N tokens, medidos pela mesma regua do mecanismo.
function enchimento(tokens, prefixo) {
  const linhas = [];
  for (let i = 0; estimarTokens(linhas.join('\n')) < tokens; i += 1) linhas.push(`| ${prefixo} ${String(i).padStart(3, '0')} | arquivo-${i}.md |`);
  return linhas.join('\n');
}

function montarMaquina() {
  fs.mkdirSync(path.join(RAIZ, '.test-tmp'), { recursive: true });
  raiz = fs.mkdtempSync(path.join(RAIZ, '.test-tmp', 'fluxo-card-'));
  const home = path.join(raiz, 'home');
  const connectHome = path.join(home, 'Connect');

  // Matriz: carta, carta de PROCESSO perto do orcamento (com historico) e manifestos.
  escrever('Matriz/_cerebro/vault-config.md', '# Config\n## Identidade\n- tipo-vault: matriz\n- contexto: "teste"\n');
  escrever('Matriz/_cerebro/camada-1.md', '---\ntipo-artefato: camada-1\nvault: Matriz de teste\n---\n\n# Camada 1\n\n## O que e este vault\nMatriz.\n');
  escrever('Matriz/_cerebro/processos/sdd.md', `---\ntipo-artefato: carta-processo\nprocesso: sdd\ntopologia: projetos/{ciclo}/{projeto}\n---\n\n# Carta de processo — SDD\n\n## Quando carregar\n\n| Gatilho | Arquivo |\n|---|---|\n${enchimento(ORCAMENTO_TOKENS_PROCESSO - 400, 'processo')}\n\n## Histórico\n\n| Data | O quê |\n|---|---|\n${enchimento(300, 'HISTORICO-NAO-INJETAR')}\n`);
  const manifesto = (rel, campos, corpo = '') => escrever(rel, `---\n${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n# ${campos.conceito}\n\n${corpo}`);
  manifesto('Matriz/clientes/cliente-x.md', { tipo: 'cliente', externo: 'true', 'criado-por': 'Teste', 'criado-em': '2026-01-01', conceito: 'cliente-x', escopo: 'cliente-x', entrada: '_cerebro/camada-1.md' });
  manifesto('Matriz/clientes/cliente-x-delivery-hub.md', { tipo: 'delivery-hub', classe: 'diretorio', externo: 'true', 'criado-por': 'Teste', 'criado-em': '2026-01-01', conceito: 'cliente-x-delivery-hub', escopo: 'cliente-x' },
    '## Estrutura interna\n\n- Uma pasta por frente.\n- Uma pasta por card: `{card} - {titulo}/`, com `{card} - Diario de execucao.md` e `{card} - Relatorio de analise.docx`.\n\n## Histórico\n\n| 2026 | criado |\n');
  manifesto('Matriz/clientes/cliente-y-delivery-hub.md', { tipo: 'delivery-hub', classe: 'diretorio', externo: 'true', 'criado-por': 'Teste', 'criado-em': '2026-01-01', conceito: 'cliente-y-delivery-hub', escopo: 'cliente-y' });

  // Acervo do cliente: carta local perto do orcamento, herdando o processo.
  escrever('acervo-x/_cerebro/vault-config.md', '# Config\n## Identidade\n- tipo-vault: sub-vault\n- contexto: "cliente-x"\n');
  escrever('acervo-x/_cerebro/camada-1.md', `---\ntipo-artefato: camada-1\nvault: Cliente X\nprocesso: sdd\n---\n\n# Camada 1 — Cliente X\n\n## O que e este vault\nAcervo do cliente X. CARTA-LOCAL-DO-CLIENTE-X.\n\n## Estrutura\n\n| Casa | O que |\n|---|---|\n| projetos/ | entregas |\n\n## Ordem de entrada\n1. Esta carta.\n\n## Quando carregar\n\n| Gatilho | Arquivo |\n|---|---|\n${enchimento(ORCAMENTO_TOKENS_DELTA - 350, 'local')}\n\n## Fronteiras\n- Delivery Hub: conceito \`cliente-x-delivery-hub\`.\n`);
  // Acervo com carta ACIMA do orcamento: o mecanismo tem de avisar (M3), nunca cortar calado.
  manifesto('Matriz/clientes/cliente-z.md', { tipo: 'cliente', externo: 'true', 'criado-por': 'Teste', 'criado-em': '2026-01-01', conceito: 'cliente-z', escopo: 'cliente-z', entrada: '_cerebro/camada-1.md' });
  escrever('acervo-z/_cerebro/vault-config.md', '# Config\n## Identidade\n- tipo-vault: sub-vault\n- contexto: "cliente-z"\n');
  escrever('acervo-z/_cerebro/camada-1.md', `---\ntipo-artefato: camada-1\nvault: Cliente Z\n---\n\n# Camada 1 — Cliente Z\n\n## O que e este vault\nZ.\n\n## Estrutura\nx\n\n## Ordem de entrada\n1. Esta carta.\n\n## Quando carregar\n\n| Gatilho | Arquivo |\n|---|---|\n${enchimento(ORCAMENTO_TOKENS_DELTA + 400, 'gorda')}\n\n## Fronteiras\n- nada\n`);
  fs.mkdirSync(path.join(raiz, 'hub-x'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'hub-y'), { recursive: true });

  // Operador com vinculo no cliente X (o card 123456 esta no estado dele).
  escrever('home/Connect/operador/_cerebro/meu-config.md', '# Minha Config\n## Identidade (cross-cliente)\n- nome: "Operadora de Teste"\n- emails: "teste@exemplo.com"\n');
  escrever('home/Connect/operador/_cerebro/vinculos/cliente-x/estado.md', '---\nschema: vinculos-v1\ncoletivo: cliente-x\n---\n\n# Estado\n\n| projeto | status |\n|---|---|\n| Card 123456 | em analise |\n');
  fs.writeFileSync(path.join(connectHome, 'connect.config.json'), JSON.stringify({
    vaultMatriz: path.join(raiz, 'Matriz'),
    subVaults: {
      'cliente-x': path.join(raiz, 'acervo-x'),
      'cliente-z': path.join(raiz, 'acervo-z'),
      'cliente-x-delivery-hub': path.join(raiz, 'hub-x'),
      'cliente-y-delivery-hub': path.join(raiz, 'hub-y'),
    },
  }));

  env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CONNECT_')));
  Object.assign(env, { HOME: home, USERPROFILE: home, CONNECT_HOME: connectHome, NO_COLOR: '1' });
}

// Uma sessao do servidor MCP como um cliente com nome, com workspace proprio: a
// heranca de processo e registrada por workspace ("ja injetada nesta sessao"), e
// workspace compartilhado faria cada teste depender da ordem.
let sessoes = 0;
async function sessao(cliente) {
  sessoes += 1;
  const workspace = path.join(env.CONNECT_HOME, 'sessions', `fluxo-card-${sessoes}`);
  fs.mkdirSync(workspace, { recursive: true });
  const p = spawn(process.execPath, [SERVIDOR], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buf = '';
  const pendentes = new Map();
  p.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, i);
      buf = buf.slice(i + 1);
      try { const m = JSON.parse(linha); pendentes.get(m.id)?.(m); } catch { /* parcial */ }
    }
  });
  let id = 0;
  const chamar = (method, params) => new Promise((resolve, reject) => {
    id += 1;
    const t = setTimeout(() => reject(new Error(`${method} sem resposta`)), 20_000);
    pendentes.set(id, (m) => { clearTimeout(t); resolve(m); });
    p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  await chamar('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: cliente, version: '1' } });
  const resolver = async (args) => {
    const r = await chamar('tools/call', { name: 'resolver', arguments: { workspace_dir: workspace, ...args } });
    const texto = r.result.content.map((c) => c.text).join('');
    const json = JSON.stringify(r.result.structuredContent ?? {});
    return { texto, json, estruturado: r.result.structuredContent, tokens: estimarTokens(texto) + estimarTokens(json) };
  };
  return { resolver, fechar: () => p.kill() };
}

beforeAll(() => montarMaquina());
afterAll(() => fs.rmSync(raiz, { recursive: true, force: true, maxRetries: 3 }));

describe('fluxo de um card no Copilot (cliente que le o texto)', () => {
  it('"delivery-hub" sem coletivo e ambiguo e lista os candidatos; com o coletivo, resolve direto', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const amb = await s.resolver({ conceito: 'delivery-hub' });
      expect(amb.estruturado.status).toBe('ambigua');
      expect(amb.estruturado.candidatos).toEqual(expect.arrayContaining(['cliente-x-delivery-hub', 'cliente-y-delivery-hub']));

      const hub = await s.resolver({ conceito: 'delivery-hub', coletivo: 'cliente-x' });
      expect(hub.estruturado.status).toBe('resolvido');
      expect(hub.estruturado.conceito).toBe('cliente-x-delivery-hub');
    } finally {
      s.fechar();
    }
  });

  it('com a pista do card, "delivery-hub" resolve pelo vinculo do operador, sem perguntar', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const hub = await s.resolver({ conceito: 'delivery-hub', pista: '123456' });
      expect(hub.estruturado.status).toBe('resolvido');
      expect(hub.estruturado.conceito).toBe('cliente-x-delivery-hub');
      expect(hub.texto).toMatch(/desempatado pela pista "123456"/);
      expect(hub.texto).toMatch(/### Mapa de/);
    } finally {
      s.fechar();
    }
  });

  it('card fora de qualquer vinculo continua perguntando, em ordem alfabetica e com os seus vinculos', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const amb = await s.resolver({ conceito: 'delivery-hub', pista: '999999' });
      expect(amb.estruturado.status).toBe('ambigua');
      expect(amb.estruturado.candidatos).toEqual([...amb.estruturado.candidatos].sort((a, b) => a.localeCompare(b)));
      expect(amb.estruturado.seusVinculos).toEqual(['cliente-x-delivery-hub']);
    } finally {
      s.fechar();
    }
  });

  it('o Delivery Hub vem com o mapa de onde gravar, sem o historico do manifesto', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const hub = await s.resolver({ conceito: 'cliente-x-delivery-hub' });
      expect(hub.texto).toMatch(/### Mapa de `\.\/cliente-x-delivery-hub`/);
      expect(hub.texto).toContain('{card} - Diario de execucao.md');
      expect(hub.texto).not.toMatch(/\| 2026 \| criado \|/);
      expect(hub.estruturado.mapa.length).toBeLessThanOrEqual(TETO_MAPA + 120);
    } finally {
      s.fechar();
    }
  });

  it('o acervo do cliente traz a carta local e a de processo no texto, e o JSON so o resumo', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const x = await s.resolver({ conceito: 'cliente-x' });
      expect(x.estruturado.status).toBe('resolvido');
      expect(x.texto).toContain('CARTA-LOCAL-DO-CLIENTE-X');
      expect(x.texto).toContain('# Carta de processo — SDD');
      expect(x.texto).not.toContain('HISTORICO-NAO-INJETAR');
      expect(x.json).not.toContain('CARTA-LOCAL-DO-CLIENTE-X');
      expect(x.json.length).toBeLessThan(2000);
    } finally {
      s.fechar();
    }
  });

  it('a resposta cabe nos orcamentos de carta (local + processo + moldura), com as cartas no limite', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const x = await s.resolver({ conceito: 'cliente-x' });
      const orcamento = ORCAMENTO_TOKENS_DELTA + ORCAMENTO_TOKENS_PROCESSO + MOLDURA_TOKENS;
      expect(x.tokens, `resposta com ${x.tokens} tokens; orcamento ${orcamento}`).toBeLessThanOrEqual(orcamento);
    } finally {
      s.fechar();
    }
  });

  it('carta acima do orcamento de 1.400 tokens gera aviso (M3), sem cortar a carta', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const z = await s.resolver({ conceito: 'cliente-z' });
      expect(z.estruturado.status).toBe('resolvido');
      expect(z.texto).toMatch(/carta de navegacao com ~\d+ tokens \(> 1400/);
      expect(z.texto).toContain('| gorda 000 |');
    } finally {
      s.fechar();
    }
  });

  it('o cliente que le o texto recebe menos da metade do que o Cowork recebe', async () => {
    const copilot = await sessao('Visual Studio Code');
    const cowork = await sessao('claude-ai');
    try {
      const a = await copilot.resolver({ conceito: 'cliente-x' });
      const b = await cowork.resolver({ conceito: 'cliente-x' });
      expect(a.tokens).toBeLessThan(b.tokens / 2 + MOLDURA_TOKENS);
    } finally {
      copilot.fechar();
      cowork.fechar();
    }
  });

  it('a segunda resolucao na mesma sessao nao repete a carta', async () => {
    const s = await sessao('Visual Studio Code');
    try {
      const primeira = await s.resolver({ conceito: 'cliente-x' });
      const segunda = await s.resolver({ conceito: 'cliente-x' });
      expect(segunda.texto).not.toContain('CARTA-LOCAL-DO-CLIENTE-X');
      expect(segunda.tokens).toBeLessThan(primeira.tokens / 2);
    } finally {
      s.fechar();
    }
  });
});

describe('o Cowork (cliente Claude) continua recebendo a carta no JSON', () => {
  it('structuredContent leva a carta local inteira', async () => {
    const s = await sessao('claude-ai');
    try {
      const x = await s.resolver({ conceito: 'cliente-x' });
      expect(x.estruturado.l1.carta.inline).toContain('CARTA-LOCAL-DO-CLIENTE-X');
    } finally {
      s.fechar();
    }
  });
});
