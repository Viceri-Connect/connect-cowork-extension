// tests/unit/skills-hosts.test.mjs
// Paridade das skills fora do Cowork (docs/paridade-harness.md). Toda instrucao que so
// existe no Cowork (pasta conectada ao projeto, concessao, tarefa agendada do Cowork)
// precisa vir acompanhada do equivalente em Codex, Copilot e Antigravity — senao o
// agente desses hosts recebe uma ordem impossivel e trava o fluxo.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugins', 'connect', 'skills');
const ler = (s) => fs.readFileSync(path.join(SKILLS, s, 'SKILL.md'), 'utf8');

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
