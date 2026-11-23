// tests/unit/skills-hosts.test.mjs
// Paridade das skills fora do Cowork (docs/paridade-harness.md). Toda instrucao que so
// existe no Cowork (pasta conectada ao projeto, concessao, tarefa agendada do Cowork)
// precisa vir acompanhada do equivalente em Codex, Copilot e Antigravity — senao o
// agente desses hosts recebe uma ordem impossivel e trava o fluxo.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checarSkill } from '../architecture/harness-checks.mjs';

const SKILLS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugins', 'connect', 'skills');
const ler = (s) => fs.readFileSync(path.join(SKILLS, s, 'SKILL.md'), 'utf8');

// Gatilhos da descricao da cnct-nucleo-sessao na 0.40.0 (Cowork). A descricao foi
// comprimida para caber nos 1.024 caracteres do padrao Agent Skills; nenhum gatilho podia
// sair — e por ela que o modelo decide carregar a skill.
const GATILHOS_SESSAO = [
  'INÍCIO', 'tarefa', 'projeto', 'demanda', 'cliente', 'reunião', 'ticket',
  '"trabalhar em"', '"continuar"', '"retomar"', 'iniciar_sessao', './matriz', 'camada 1',
  '"consultar o vault"', '"onde está"', '"mais detalhe"', '"qual a norma/decisão"',
  'recém-instalado', 'mesmo sem menção a projeto/tarefa', '"Personalizar"/"Customizar"', 'logo após a instalação',
  '"configurar o Connect"', '"conectar minha matriz"', '"onde fica meu vault"', '"sou novo aqui"',
  '"primeiro uso"', '"setup inicial"', 'CNCT1-', 'colado no pedido', 'configurar_por_codigo', 'OneDrive',
  'cnct-fabrica-operador', 'acervos das', 'briefing diário', 'FALLBACK', 'SessionStart', 'sem disparar o hook',
];

describe('descricao da cnct-nucleo-sessao', () => {
  it('cabe em 1.024 caracteres sem perder nenhum gatilho da 0.40.0', () => {
    const m = ler('cnct-nucleo-sessao').match(/description: >\r?\n([\s\S]*?)\r?\nmetadata:/);
    const descricao = m[1].split(/\r?\n/).map((l) => l.trim()).join(' ');
    expect(descricao.length).toBeLessThanOrEqual(1024);
    expect(GATILHOS_SESSAO.filter((g) => !descricao.includes(g))).toEqual([]);
  });
});

describe('frontmatter das skills', () => {
  const skill = (campos) => `---\nname: cnct-teste\n${campos}\n---\n\n# Teste`;

  it.each([
    'description: Carta do vault: por onde entrar',
    'description: Carta do vault\nname: cnct-outro',
    'description: Carta do vault\nmetadata:\n  versao: [incompleta',
  ])('recusa YAML invalido antes de anunciar a skill: %s', (campos) => {
    expect(checarSkill('cnct-teste', skill(campos))).toEqual([
      expect.stringContaining('cnct-teste/SKILL.md com YAML invalido'),
    ]);
  });

  it.each([
    'description: >\n  Carta do vault: por onde entrar.\n  Completa por delta.',
    'description: "Carta do vault: por onde entrar"',
  ])('aceita descricoes YAML validas com dois-pontos: %s', (campos) => {
    expect(checarSkill('cnct-teste', skill(campos))).toEqual([]);
  });

  it('recusa description que YAML interpreta como mapa em vez de texto', () => {
    expect(checarSkill('cnct-teste', skill('description:\n  resumo: Carta do vault'))).toEqual([
      'cnct-teste/SKILL.md sem description textual',
    ]);
  });
});

describe('skills fora do Cowork', () => {
  it('onboarding: pular "conectar a pasta ao projeto" fora do Cowork e usar o workspace da sessao', () => {
    const t = ler('cnct-nucleo-sessao');
    expect(t).toMatch(/Fora do Cowork\*\* \(Codex, Copilot, Antigravity\)/);
    expect(t).toMatch(/\{workspace da sessão\}\/matriz\/_cerebro\/camada-1\.md/);
    expect(t).not.toMatch(/pedir acesso ao Cowork;/);
  });

  it('briefing agendado: um caminho para cada host', () => {
    const t = ler('cnct-fabrica-operador');
    expect(t).toMatch(/VS Code \(Agents window \/ Copilot\)/);
    expect(t).toMatch(/Import Automation/);
    expect(t).toMatch(/Antigravity:\*\* a ferramenta `schedule`/);
    expect(t).toMatch(/Codex\/ChatGPT:\*\*/);
    expect(t).toMatch(/salva \*\*desabilitada\*\*/);
  });

  it('nenhuma skill manda pedir acesso "ao Cowork" sem o equivalente do host', () => {
    for (const s of fs.readdirSync(SKILLS)) {
      const t = ler(s);
      for (const linha of t.split('\n').filter((l) => /concess|conceder acesso|pedir acesso/i.test(l) && /Cowork/.test(l))) {
        expect(linha, `${s}: ${linha}`).toMatch(/host|no Cowork,|\(no Cowork/i);
      }
    }
  });
});
